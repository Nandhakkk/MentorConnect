const prisma = require('../config/db');
const notificationService = require('./notificationService');
const { calculateAge } = require('../utils/ageHelper');
const emailService = require('./emailService');
const { auditLog } = require('../utils/guardianAuditLogger');
const logger = require('../utils/logger');

/**
 * Check for students who have turned 18 and automatically conclude guardian monitoring
 */
const checkAge18Transitions = async () => {
  try {
    const activeGuardians = await prisma.guardian.findMany({
      where: {
        isMonitoringActive: true
      },
      include: {
        learner: true,
        accessTokens: {
          where: { revokedAt: null }
        }
      }
    });

    const transitioned = [];

    for (const guardian of activeGuardians) {
      const { learner } = guardian;
      const age = calculateAge(learner.dateOfBirth);

      if (age !== null && age >= 18) {
        // Conclude guardian monitoring
        await prisma.$transaction([
          prisma.guardian.update({
            where: { id: guardian.id },
            data: {
              isMonitoringActive: false,
              accessRevokedAt: new Date(),
              accessRevokedReason: 'STUDENT_REACHED_AGE_18'
            }
          }),
          // Revoke all active summary links
          prisma.guardianAccessToken.updateMany({
            where: { guardianId: guardian.id, revokedAt: null },
            data: { revokedAt: new Date() }
          })
        ]);

        // 1. Notify Student in-app
        await notificationService.createNotification(
          learner.id,
          'GENERAL',
          'Guardian Monitoring Concluded (Turning 18)',
          'You have reached 18 years of age. In accordance with platform policy, automated guardian monitoring and summary access links have concluded. If you wish to grant adult access, you may configure explicit adult permissions in your account settings.',
          guardian.id,
          'GUARDIAN'
        );

        // 2. Notify Guardian via email
        if (guardian.email && guardian.isVerified) {
          await emailService.sendMail({
            to: guardian.email,
            subject: `MentorConnect — Guardian Monitoring Concluded for ${learner.name}`,
            html: `
              <div style="font-family: sans-serif; max-width: 600px; padding: 20px; border: 1px solid #e2e8f0; border-radius: 8px;">
                <h3 style="color: #1e3a8a;">Guardian Monitoring Concluded</h3>
                <p>Hello ${guardian.name || 'Guardian'},</p>
                <p><strong>${learner.name}</strong> has reached 18 years of age. In accordance with platform policy and applicable regulations, minor guardian monitoring and previous summary links have concluded.</p>
                <p style="font-size: 13px; color: #64748b;">No further automatic notifications or summary page access will be provided unless explicit adult authorization is initiated by the student.</p>
              </div>
            `,
            eventType: 'GENERAL'
          });
        }

        auditLog('GUARDIAN_AGE_18_TRANSITION_APPLIED', {
          studentId: learner.id,
          guardianId: guardian.id,
          details: { age, reason: 'STUDENT_REACHED_AGE_18' }
        });

        transitioned.push({ studentId: learner.id, guardianId: guardian.id });
      }
    }

    if (transitioned.length > 0) {
      logger.info(`[Age-18 Check] Transitioned ${transitioned.length} student(s) to adult status.`);
    }

    return transitioned;
  } catch (err) {
    logger.error(`Error in checkAge18Transitions: ${err.message}`);
    return [];
  }
};

/**
 * Check for overdue assignments and notify active verified guardians
 */
const checkOverdueAssignments = async () => {
  try {
    const now = new Date();
    // Overdue assignments created within last 7 days
    const overdueAssignments = await prisma.assignment.findMany({
      where: {
        dueDate: { lt: now },
        status: { notIn: ['REVIEWED'] }
      },
      include: {
        student: {
          include: {
            user: {
              include: {
                guardians: {
                  where: { isVerified: true, isMonitoringActive: true, consentStatus: 'GRANTED' }
                }
              }
            }
          }
        },
        submissions: {
          orderBy: { submittedAt: 'desc' },
          take: 1
        }
      }
    });

    const notified = [];

    for (const assignment of overdueAssignments) {
      const studentUser = assignment.student?.user;
      if (!studentUser || !studentUser.guardians || studentUser.guardians.length === 0) continue;

      const latestSub = assignment.submissions[0];
      if (latestSub && latestSub.status === 'SUBMITTED') continue;

      const guardian = studentUser.guardians[0];
      // Guardian notifications are mandatory for minor safeguarding

      // Deduplication: check if overdue notification was sent in last 24h
      const existingNotif = await prisma.notification.findFirst({
        where: {
          guardianId: guardian.id,
          referenceId: assignment.id,
          title: 'Assignment Overdue Notice',
          createdAt: { gt: new Date(Date.now() - 24 * 3600 * 1000) }
        }
      });

      if (!existingNotif) {
        const kolkataDue = emailService.formatKolkataDateTime(assignment.dueDate);
        await emailService.sendMail({
          to: guardian.email,
          subject: `MentorConnect — Assignment Overdue for ${studentUser.name}`,
          html: `
            <div style="font-family: sans-serif; max-width: 600px; padding: 20px; border: 1px solid #fed7aa; border-radius: 8px;">
              <h3 style="color: #c2410c;">Assignment Overdue Notice</h3>
              <p>Hello ${guardian.name || 'Guardian'},</p>
              <p>This is an update that the assignment <strong>"${assignment.title}"</strong> for <strong>${studentUser.name}</strong> was due on ${kolkataDue} and remains pending submission.</p>
              <p style="font-size: 13px; color: #64748b;">Please encourage ${studentUser.name.split(' ')[0]} to connect with their mentor or complete the task.</p>
            </div>
          `,
          eventType: 'ASSIGNMENT'
        });

        await prisma.notification.create({
          data: {
            userId: studentUser.id,
            guardianId: guardian.id,
            type: 'ASSIGNMENT',
            title: 'Assignment Overdue Notice',
            message: `Assignment "${assignment.title}" is overdue (was due on ${kolkataDue}).`,
            channel: 'EMAIL',
            deliveryStatus: 'DELIVERED',
            recipientEmail: guardian.email,
            referenceId: assignment.id,
            referenceType: 'ASSIGNMENT',
            sentAt: new Date()
          }
        });

        notified.push({ assignmentId: assignment.id, guardianEmail: guardian.email });
      }
    }

    return notified;
  } catch (err) {
    logger.error(`Error in checkOverdueAssignments: ${err.message}`);
    return [];
  }
};

/**
 * Send weekly learning progress summaries to guardians
 */
const sendWeeklySummaries = async () => {
  try {
    const activeGuardians = await prisma.guardian.findMany({
      where: {
        isVerified: true,
        isMonitoringActive: true,
        consentStatus: 'GRANTED'
      },
      include: {
        learner: {
          include: {
            studentProfile: {
              include: {
                goals: {
                  include: { milestones: true }
                }
              }
            }
          }
        }
      }
    });

    const sent = [];

    for (const guardian of activeGuardians) {
      // Guardian notifications are mandatory for minor safeguarding

      const { learner } = guardian;
      const goals = learner.studentProfile?.goals || [];

      let totalMilestones = 0;
      let completedMilestones = 0;
      goals.forEach(g => {
        (g.milestones || []).forEach(m => {
          totalMilestones++;
          if (m.status === 'COMPLETED') completedMilestones++;
        });
      });

      // Send summary email
      await emailService.sendMail({
        to: guardian.email,
        subject: `MentorConnect — Weekly Progress Summary for ${learner.name}`,
        html: `
          <div style="font-family: sans-serif; max-width: 600px; padding: 20px; border: 1px solid #e2e8f0; border-radius: 8px;">
            <h3 style="color: #1e3a8a;">Weekly Learning Summary</h3>
            <p>Hello ${guardian.name || 'Guardian'},</p>
            <p>Here is this week's learning progress update for <strong>${learner.name}</strong>:</p>
            <ul>
              <li><strong>Active Goals:</strong> ${goals.filter(g => g.status === 'ACTIVE').length}</li>
              <li><strong>Completed Milestones:</strong> ${completedMilestones} of ${totalMilestones}</li>
            </ul>
            <p style="font-size: 13px; color: #64748b;">To view complete details, ask your learner for an updated 24-hour summary link.</p>
          </div>
        `,
        eventType: 'GENERAL'
      });

      sent.push(guardian.email);
    }

    return sent;
  } catch (err) {
    logger.error(`Error in sendWeeklySummaries: ${err.message}`);
    return [];
  }
};

/**
 * Automatically cancel abandoned unpaid bookings older than timeout (default: 15 minutes)
 * to release mentor availability slots safely and idempotently.
 */
const cleanupAbandonedSessions = async (timeoutMinutes = 15) => {
  try {
    const expirationThreshold = new Date(Date.now() - timeoutMinutes * 60000);

    const abandonedSessions = await prisma.session.findMany({
      where: {
        status: 'SCHEDULED',
        createdAt: { lt: expirationThreshold },
        payment: {
          amount: { gt: 0 },
          status: { in: ['CREATED', 'PENDING'] }
        }
      },
      include: { payment: true }
    });

    if (abandonedSessions.length > 0) {
      const sessionIds = abandonedSessions.map(s => s.id);
      const paymentIds = abandonedSessions.map(s => s.payment?.id).filter(Boolean);

      await prisma.$transaction([
        prisma.session.updateMany({
          where: { id: { in: sessionIds }, status: 'SCHEDULED' },
          data: { status: 'CANCELLED' }
        }),
        prisma.payment.updateMany({
          where: { id: { in: paymentIds }, status: { in: ['CREATED', 'PENDING'] } },
          data: { status: 'CANCELLED' }
        })
      ]);

      logger.info(`[Scheduler] Cleaned up ${abandonedSessions.length} abandoned unpaid session(s).`);
    }

    return abandonedSessions.length;
  } catch (err) {
    logger.error(`Error in cleanupAbandonedSessions: ${err.message}`);
    return 0;
  }
};

const startScheduler = () => {
  // Run session reminder, cleanup & missed status every 1 minute
  setInterval(async () => {
    try {
      // 1. Expire abandoned unpaid checkout sessions (older than 15 mins)
      await cleanupAbandonedSessions(15);
      const now = new Date();
      // Look for sessions scheduled to start between now and 12 minutes from now
      const upcomingThreshold = new Date(now.getTime() + 12 * 60000);

      const upcomingSessions = await prisma.session.findMany({
        where: {
          status: 'SCHEDULED',
          scheduledAt: {
            gt: now,
            lte: upcomingThreshold
          },
          payment: {
            status: 'PAID'
          }
        },
        include: {
          mentorship: {
            include: {
              mentor: { include: { user: true } },
              student: { include: { user: true } }
            }
          }
        }
      });

      for (const session of upcomingSessions) {
        // Prevent duplicate reminders for this session
        const existingReminder = await prisma.notification.findFirst({
          where: {
            referenceId: session.id,
            type: 'SESSION_REMINDER'
          }
        });

        if (!existingReminder) {
          const scheduledTime = new Date(session.scheduledAt).toLocaleTimeString([], { timeStyle: 'short' });
          const title = 'Session Starting Soon';

          // Notify student
          await notificationService.createNotification(
            session.mentorship.student.userId,
            'SESSION_REMINDER',
            title,
            `Your mentoring session with ${session.mentorship.mentor.user.name} starts at ${scheduledTime}.`,
            session.id,
            'SESSION'
          );

          // Notify mentor
          await notificationService.createNotification(
            session.mentorship.mentor.userId,
            'SESSION_REMINDER',
            title,
            `Your mentoring session with ${session.mentorship.student.user.name} starts at ${scheduledTime}.`,
            session.id,
            'SESSION'
          );
        }
      }

      // Mark expired SCHEDULED sessions as MISSED (ONLY if confirmed/paid)
      const pastScheduledSessions = await prisma.session.findMany({
        where: {
          status: 'SCHEDULED',
          scheduledAt: {
            lt: now
          },
          payment: {
            status: 'PAID'
          }
        }
      });

      for (const session of pastScheduledSessions) {
        const sessionEnd = new Date(new Date(session.scheduledAt).getTime() + session.duration * 60000);
        if (now > sessionEnd) {
          await prisma.session.update({
            where: { id: session.id },
            data: { status: 'MISSED' }
          });
        }
      }
    } catch (err) {
      console.error('Error running session reminder scheduler:', err);
    }
  }, 60000);

  // Run Age-18 transitions and overdue checks every 10 minutes
  setInterval(async () => {
    try {
      await checkAge18Transitions();
      await checkOverdueAssignments();
    } catch (err) {
      console.error('Error in periodic guardian scheduler job:', err);
    }
  }, 10 * 60 * 1000);
};

module.exports = {
  startScheduler,
  cleanupAbandonedSessions,
  checkAge18Transitions,
  checkOverdueAssignments,
  sendWeeklySummaries
};
