const prisma = require('../config/db');
const notificationService = require('../services/notificationService');
const aiService = require('../services/aiService');
const { isMinor } = require('../utils/ageHelper');
const guardianService = require('../services/guardianService');

/**
 * GET /api/admin/dashboard-stats
 * Returns total users, students, mentors, active mentorships, and recent users.
 */
const getDashboardStats = async (req, res) => {
  try {
    const totalUsers = await prisma.user.count();
    const totalStudents = await prisma.user.count({ where: { role: 'STUDENT' } });
    const totalMentors = await prisma.user.count({ where: { role: 'MENTOR' } });
    const activeMentorships = await prisma.mentorship.count({ where: { status: 'ACTIVE' } });

    const recentUsers = await prisma.user.findMany({
      where: { role: { not: 'ADMIN' } },
      take: 5,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        createdAt: true
      }
    });

    const recentMentorships = await prisma.mentorship.findMany({
      take: 5,
      orderBy: { createdAt: 'desc' },
      include: {
        student: { include: { user: { select: { name: true, email: true } } } },
        mentor: { include: { user: { select: { name: true, email: true } } } }
      }
    });

    return res.status(200).json({
      status: 'success',
      stats: {
        totalUsers,
        totalStudents,
        totalMentors,
        activeMentorships,
        recentUsers,
        recentMentorships
      }
    });
  } catch (err) {
    return res.status(500).json({ status: 'error', message: 'Failed to fetch admin stats.', details: err.message });
  }
};

/**
 * GET /api/admin/users
 * Returns all users with filtering by role and search query.
 */
const getUsers = async (req, res) => {
  try {
    const { role, search } = req.query;

    let whereClause = {
      role: 'STUDENT',
      NOT: {
        mentorProfile: {
          mentorType: 'PEER',
          status: 'APPROVED'
        }
      }
    };

    if (search) {
      whereClause.AND = [
        {
          OR: [
            { name: { contains: search, mode: 'insensitive' } },
            { email: { contains: search, mode: 'insensitive' } }
          ]
        }
      ];
    }

    const users = await prisma.user.findMany({
      where: whereClause,
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        createdAt: true
      },
      orderBy: { createdAt: 'desc' }
    });

    return res.status(200).json({ status: 'success', users });
  } catch (err) {
    return res.status(500).json({ status: 'error', message: 'Failed to fetch users.', details: err.message });
  }
};

/**
 * GET /api/admin/mentors
 * Returns all mentor profiles.
 */
const getMentors = async (req, res) => {
  try {
    const { type } = req.query;

    let whereClause = {};
    if (type) {
      whereClause.mentorType = type;
    }

    const mentors = await prisma.mentorProfile.findMany({
      where: whereClause,
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            createdAt: true
          }
        },
        applications: {
          select: {
            id: true,
            status: true,
            rejectionReason: true,
            reviewNotes: true,
            reviewedAt: true,
            createdAt: true,
            aiScreening: {
              select: {
                screeningStatus: true,
                recommendation: true,
                structuredFindings: true,
                riskFlags: true
              }
            }
          },
          orderBy: { createdAt: 'desc' },
          take: 1
        },
        peerApplications: {
          select: {
            id: true,
            status: true,
            rejectionReason: true,
            reviewNotes: true,
            reviewedAt: true,
            createdAt: true,
            aiScreening: {
              select: {
                screeningStatus: true,
                recommendation: true,
                structuredFindings: true,
                riskFlags: true
              }
            }
          },
          orderBy: { createdAt: 'desc' },
          take: 1
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    return res.status(200).json({ status: 'success', mentors });
  } catch (err) {
    return res.status(500).json({ status: 'error', message: 'Failed to fetch mentors.', details: err.message });
  }
};

/**
 * GET /api/admin/mentor-applications
 * Returns professional mentor applications with optional queue or status filter.
 */
const getMentorApplications = async (req, res) => {
  try {
    const { status, queue } = req.query;

    let whereClause = {};
    if (queue === 'ELIGIBLE') {
      whereClause.OR = [
        {
          status: { in: ['AI_SCREENED', 'UNDER_REVIEW', 'PENDING'] },
          aiScreening: {
            recommendation: { in: ['STRONG_PASS', 'PASS', 'ELIGIBLE'] }
          }
        }
      ];
    } else if (queue === 'MANUAL_REVIEW') {
      whereClause.OR = [
        {
          status: 'UNDER_REVIEW',
          aiScreening: {
            recommendation: { in: ['NEEDS_REVIEW', 'BORDERLINE', 'NEEDS_MANUAL_REVIEW'] }
          }
        },
        {
          status: { in: ['PENDING', 'AI_SCREENED'] },
          aiScreening: {
            recommendation: { in: ['NEEDS_REVIEW', 'BORDERLINE', 'NEEDS_MANUAL_REVIEW'] }
          }
        }
      ];
    } else if (queue === 'AUTO_REJECTED') {
      whereClause.OR = [
        {
          status: 'REJECTED',
          aiScreening: {
            recommendation: { in: ['REJECT', 'AUTO_REJECTED'] }
          }
        },
        {
          status: 'REJECTED',
          rejectionReason: { contains: 'Auto-Rejected' }
        },
        {
          status: 'REJECTED',
          rejectionReason: { contains: 'objective criteria' }
        }
      ];
    } else if (status && status !== 'ALL') {
      whereClause.status = status;
    }

    const applications = await prisma.mentorApplication.findMany({
      where: whereClause,
      include: {
        mentor: {
          include: { user: { select: { name: true, email: true } } }
        },
        aiScreening: true,
        credentials: true
      },
      orderBy: { createdAt: 'desc' }
    });

    return res.status(200).json({ status: 'success', applications });
  } catch (err) {
    return res.status(500).json({ status: 'error', message: 'Failed to fetch mentor applications.', details: err.message });
  }
};

/**
 * GET /api/admin/mentor-applications/:id
 * Returns detailed application view.
 */
/**
 * GET /api/admin/mentor-applications/:id
 * Returns detailed application view with complete verification workspace.
 */
const getMentorApplicationById = async (req, res) => {
  try {
    const application = await prisma.mentorApplication.findUnique({
      where: { id: req.params.id },
      include: {
        mentor: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true,
                dateOfBirth: true,
                phone: true,
                profileImage: true,
                isActive: true,
                isSuspended: true
              }
            },
            portfolio: true
          }
        },
        credentials: {
          orderBy: { uploadedAt: 'asc' }
        },
        aiScreening: true
      }
    });

    if (!application) {
      return res.status(404).json({ status: 'error', message: 'Application not found.' });
    }

    return res.status(200).json({ status: 'success', application });
  } catch (err) {
    return res.status(500).json({ status: 'error', message: 'Failed to fetch mentor application.', details: err.message });
  }
};

/**
 * PUT /api/admin/mentor-applications/:id/status
 * Updates the application status, verifies credentials, and generates AI portfolio on approval.
 */
const updateMentorApplicationStatus = async (req, res) => {
  try {
    const { status, reviewNotes, rejectionReason } = req.body;

    const validStatuses = ['PENDING', 'AI_SCREENED', 'UNDER_REVIEW', 'APPROVED', 'REJECTED', 'SUSPENDED'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ status: 'error', message: 'Invalid status.' });
    }

    const application = await prisma.mentorApplication.findUnique({
      where: { id: req.params.id },
      include: {
        mentor: {
          include: {
            user: true
          }
        },
        credentials: true
      }
    });

    if (!application) {
      return res.status(404).json({ status: 'error', message: 'Application not found.' });
    }

    // Status transition rules (simplified enforcement)
    const current = application.status;
    const isApproval = status === 'APPROVED';
    const isRejection = status === 'REJECTED';
    const isSuspension = status === 'SUSPENDED';

    if (isApproval && current !== 'UNDER_REVIEW' && current !== 'AI_SCREENED') {
      return res.status(400).json({ status: 'error', message: 'Only AI_SCREENED or UNDER_REVIEW applications can be APPROVED.' });
    }
    if (isRejection && current !== 'UNDER_REVIEW' && current !== 'AI_SCREENED') {
      return res.status(400).json({ status: 'error', message: 'Only AI_SCREENED or UNDER_REVIEW applications can be REJECTED.' });
    }
    if (isSuspension && current !== 'APPROVED') {
      return res.status(400).json({ status: 'error', message: 'Only APPROVED applications can be SUSPENDED.' });
    }
    if (status === 'UNDER_REVIEW' && current !== 'AI_SCREENED' && current !== 'PENDING') {
      return res.status(400).json({ status: 'error', message: 'Only PENDING or AI_SCREENED applications can move to UNDER_REVIEW.' });
    }

    const updatedApp = await prisma.$transaction(async (tx) => {
      const updated = await tx.mentorApplication.update({
        where: { id: application.id },
        data: {
          status,
          reviewNotes: reviewNotes !== undefined ? reviewNotes : application.reviewNotes,
          rejectionReason: rejectionReason !== undefined ? rejectionReason : application.rejectionReason,
          reviewedAt: isApproval || isRejection ? new Date() : application.reviewedAt,
          reviewerId: req.user.id
        }
      });

      if (isApproval) {
        // Sync application fields into mentorProfile
        const profileUpdateData = {
          status: 'APPROVED',
          mentorType: 'PROFESSIONAL',
          verifiedAt: new Date()
        };

        if (application.professionalSummary) profileUpdateData.bio = application.professionalSummary;
        if (application.expertise) profileUpdateData.expertise = application.expertise;
        if (application.experience !== null && application.experience !== undefined) profileUpdateData.experience = application.experience;
        if (application.teachingExperience !== null && application.teachingExperience !== undefined) profileUpdateData.teachingExperience = application.teachingExperience;
        if (application.proposedSessionFee !== null && application.proposedSessionFee !== undefined) profileUpdateData.sessionFee = application.proposedSessionFee;
        if (application.languages) profileUpdateData.language = application.languages;
        if (application.linkedinUrl) profileUpdateData.linkedinUrl = application.linkedinUrl;
        if (application.employmentHistory) profileUpdateData.employmentHistory = application.employmentHistory;
        if (application.teachingExperienceDetails) profileUpdateData.teachingEvidence = application.teachingExperienceDetails;

        await tx.mentorProfile.update({
          where: { id: application.mentorId },
          data: profileUpdateData
        });

        // Mark associated credentials as VERIFIED
        await tx.credential.updateMany({
          where: { applicationId: application.id },
          data: { status: 'VERIFIED' }
        });

        // Sync topics if provided in application
        if (application.topics) {
          const topicNames = application.topics.split(',').map(t => t.trim()).filter(Boolean);
          for (const tName of topicNames) {
            let topicRec = await tx.topic.findUnique({ where: { name: tName } });
            if (!topicRec) {
              topicRec = await tx.topic.create({ data: { name: tName, category: 'General' } });
            }
            const existingMT = await tx.mentorTopic.findUnique({
              where: { mentorId_topicId: { mentorId: application.mentorId, topicId: topicRec.id } }
            });
            if (!existingMT) {
              await tx.mentorTopic.create({
                data: { mentorId: application.mentorId, topicId: topicRec.id }
              });
            }
          }
        }
      } else if (isRejection || isSuspension) {
        await tx.mentorProfile.update({
          where: { id: application.mentorId },
          data: {
            status: 'REJECTED'
          }
        });
      }

      return updated;
    });

    // Post-transaction tasks: Notifications and Portfolio Generation
    try {
      if (isApproval) {
        // Generate AI Portfolio
        const fullApp = await prisma.mentorApplication.findUnique({
          where: { id: application.id },
          include: {
            mentor: {
              include: {
                user: true,
                topics: { include: { topic: true } }
              }
            },
            credentials: true
          }
        });

        const portfolioData = await aiService.generatePortfolio(
          fullApp,
          fullApp.mentor,
          fullApp.mentor.user,
          fullApp.credentials
        );

        const portfolioFields = {
          headline: portfolioData.headline || null,
          introduction: portfolioData.introduction || null,
          about: portfolioData.about || null,
          teachingApproach: portfolioData.teachingApproach || null,
          mentoringApproach: portfolioData.mentoringApproach || null,
          experienceSummary: portfolioData.experienceSummary || null,
          teachingSummary: portfolioData.teachingSummary || null,
          skills: portfolioData.skills || null,
          highlights: portfolioData.highlights || null,
          education: portfolioData.education || null,
          certifications: portfolioData.certifications || null,
          achievements: portfolioData.achievements || null,
          isGenerated: true,
          generatedAt: new Date()
        };

        await prisma.mentorPortfolio.upsert({
          where: { mentorId: application.mentorId },
          create: {
            mentorId: application.mentorId,
            ...portfolioFields
          },
          update: {
            ...portfolioFields,
            updatedAt: new Date()
          }
        });

        await notificationService.createNotification(
          application.mentor.userId,
          'GENERAL',
          'Application Approved & Portfolio Live!',
          'Congratulations! Your professional mentor application has been approved. Your AI-crafted professional portfolio is now live for students to view.'
        );
      } else if (isRejection) {
        await notificationService.createNotification(
          application.mentor.userId,
          'GENERAL',
          'Mentor Application Update',
          `Your application has been reviewed. Status: REJECTED. Reason: ${rejectionReason || 'Please review your application feedback.'}`
        );
      }
    } catch (postErr) {
      console.warn('Post-approval portfolio/notification warning (approval not affected):', postErr.message);
    }

    return res.status(200).json({ status: 'success', message: 'Application status updated.', application: updatedApp });
  } catch (err) {
    return res.status(500).json({ status: 'error', message: 'Failed to update application status.', details: err.message });
  }
};

/**
 * POST /api/admin/mentor-applications/:id/generate-portfolio
 * Manually trigger or refresh the AI professional portfolio for an approved mentor.
 */
const generateMentorPortfolio = async (req, res) => {
  try {
    const application = await prisma.mentorApplication.findUnique({
      where: { id: req.params.id },
      include: {
        mentor: {
          include: {
            user: true,
            topics: { include: { topic: true } }
          }
        },
        credentials: true
      }
    });

    if (!application) {
      return res.status(404).json({ status: 'error', message: 'Application not found.' });
    }

    const portfolioData = await aiService.generatePortfolio(
      application,
      application.mentor,
      application.mentor.user,
      application.credentials
    );

    const portfolioFields = {
      headline: portfolioData.headline || null,
      introduction: portfolioData.introduction || null,
      about: portfolioData.about || null,
      teachingApproach: portfolioData.teachingApproach || null,
      mentoringApproach: portfolioData.mentoringApproach || null,
      experienceSummary: portfolioData.experienceSummary || null,
      teachingSummary: portfolioData.teachingSummary || null,
      skills: portfolioData.skills || null,
      highlights: portfolioData.highlights || null,
      education: portfolioData.education || null,
      certifications: portfolioData.certifications || null,
      achievements: portfolioData.achievements || null,
      isGenerated: true,
      generatedAt: new Date()
    };

    const portfolio = await prisma.mentorPortfolio.upsert({
      where: { mentorId: application.mentorId },
      create: {
        mentorId: application.mentorId,
        ...portfolioFields
      },
      update: {
        ...portfolioFields,
        updatedAt: new Date()
      }
    });

    return res.status(200).json({ status: 'success', message: 'Professional portfolio generated successfully.', portfolio });
  } catch (err) {
    return res.status(500).json({ status: 'error', message: 'Failed to generate portfolio.', details: err.message });
  }
};

/**
 * GET /api/admin/mentorships
 * Returns all mentorships.
 */
const getMentorships = async (req, res) => {
  try {
    const { status } = req.query;

    let whereClause = {};
    if (status && status !== 'ALL') {
      whereClause.status = status;
    }

    const mentorships = await prisma.mentorship.findMany({
      where: whereClause,
      include: {
        student: { include: { user: { select: { id: true, name: true, email: true } } } },
        mentor: { include: { user: { select: { id: true, name: true, email: true } } } }
      },
      orderBy: { createdAt: 'desc' }
    });

    return res.status(200).json({ status: 'success', mentorships });
  } catch (err) {
    return res.status(500).json({ status: 'error', message: 'Failed to fetch mentorships.', details: err.message });
  }
};

/**
 * SUSPEND / ACTIVATE MENTOR OR USER
 * Existing endpoint handles Mentor status updates...
 * But if we want to suspend a generic user (student or mentor):
 */
const toggleUserSuspension = async (req, res) => {
  try {
    const { userId } = req.params;
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) return res.status(404).json({ status: 'error', message: 'User not found' });

    const updated = await prisma.user.update({
      where: { id: userId },
      data: { isSuspended: !user.isSuspended }
    });

    return res.status(200).json({ status: 'success', data: updated });
  } catch (err) {
    return res.status(500).json({ status: 'error', message: err.message });
  }
};

/**
 * COMPLAINTS
 */

const getComplaints = async (req, res) => {
  try {
    const complaints = await prisma.complaint.findMany({
      include: {
        reporter: { select: { id: true, name: true, role: true } },
        reportedUser: { select: { id: true, name: true, role: true } },
        session: { select: { id: true, scheduledAt: true } }
      },
      orderBy: { createdAt: 'desc' }
    });
    return res.status(200).json({ status: 'success', data: complaints });
  } catch (err) {
    return res.status(500).json({ status: 'error', message: err.message });
  }
};

const getComplaintById = async (req, res) => {
  try {
    const { id } = req.params;
    const complaint = await prisma.complaint.findUnique({
      where: { id },
      include: {
        reporter: { select: { id: true, name: true, role: true } },
        reportedUser: { select: { id: true, name: true, role: true } },
        session: { select: { id: true, scheduledAt: true, duration: true } },
        messages: {
          include: { sender: { select: { name: true, role: true } } },
          orderBy: { createdAt: 'asc' }
        }
      }
    });

    if (!complaint) return res.status(404).json({ status: 'error', message: 'Complaint not found' });
    return res.status(200).json({ status: 'success', data: complaint });
  } catch (err) {
    return res.status(500).json({ status: 'error', message: err.message });
  }
};

const updateComplaintStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, resolutionNote } = req.body;
    const adminId = req.user.id;

    const validStatuses = ['OPEN', 'UNDER_REVIEW', 'RESOLVED', 'DISMISSED'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ status: 'error', message: 'Invalid status' });
    }

    if (['RESOLVED', 'DISMISSED'].includes(status) && !resolutionNote) {
      return res.status(400).json({ status: 'error', message: 'Resolution note required when resolving or dismissing' });
    }

    const current = await prisma.complaint.findUnique({ where: { id } });
    if (!current) return res.status(404).json({ status: 'error', message: 'Complaint not found' });

    const updateData = { status, reviewedById: adminId };

    if (resolutionNote) updateData.resolution = resolutionNote;
    if (['RESOLVED', 'DISMISSED'].includes(status)) updateData.resolvedAt = new Date();

    const updated = await prisma.complaint.update({
      where: { id },
      data: updateData
    });

    // Optional refund issuance upon upholding/resolving complaint
    let refundResult = null;
    if (status === 'RESOLVED' && req.body.issueRefund && current.sessionId) {
      try {
        const sessionWithPayment = await prisma.session.findUnique({
          where: { id: current.sessionId },
          include: { payment: { include: { refunds: true } } }
        });
        if (sessionWithPayment?.payment && (sessionWithPayment.payment.status === 'PAID' || sessionWithPayment.payment.status === 'PARTIALLY_REFUNDED')) {
          const refundPolicyService = require('../services/refundPolicyService');
          const razorpayRefundService = require('../services/razorpayRefundService');
          const maxRefundable = refundPolicyService.getRemainingRefundableAmount(sessionWithPayment.payment, sessionWithPayment.payment.refunds);
          const refundAmount = req.body.refundAmount ? Math.min(Number(req.body.refundAmount), maxRefundable) : maxRefundable;

          if (refundAmount > 0) {
            const crypto = require('crypto');
            const refundRecord = await prisma.refund.create({
              data: {
                refundReference: `ref_${crypto.randomBytes(8).toString('hex')}`,
                paymentId: sessionWithPayment.payment.id,
                sessionId: current.sessionId,
                complaintId: current.id,
                amount: refundAmount,
                policyTier: 'COMPLAINT_UPHELD',
                initiator: 'ADMIN',
                reason: resolutionNote || 'Refund approved upon resolution of complaint.',
                adminNotes: resolutionNote || null,
                status: 'REQUESTED',
                reviewedById: adminId,
                reviewedAt: new Date()
              }
            });

            refundResult = await razorpayRefundService.executeGatewayRefund(refundRecord.id);

            // Real Transactional Email (Event 11: Complaint Refund Approved)
            const reporterUser = await prisma.user.findUnique({ where: { id: current.reporterId } });
            if (reporterUser && refundResult) {
              const transactionalEmailService = require('../services/transactionalEmailService');
              await transactionalEmailService.notifyComplaintRefundDecision({
                refund: refundResult,
                session: sessionWithPayment,
                studentUser: reporterUser,
                decisionTitle: 'Complaint Investigation Resolved & Refund Approved',
                resolutionNotes: resolutionNote || 'Refund approved upon resolution of complaint.'
              }).catch(e => console.error('[AdminController] Complaint refund email error:', e.message));
            }
          }
        }
      } catch (refundErr) {
        console.error('[AdminController] Complaint refund error:', refundErr.message);
      }
    }

    // Notify Reporter
    let notifTitle, notifMsg;
    if (status === 'UNDER_REVIEW' && current.status === 'OPEN') {
      notifTitle = 'Complaint Under Review';
      notifMsg = 'Your complaint is now under review.';
    } else if (status === 'RESOLVED') {
      notifTitle = 'Complaint Resolved';
      notifMsg = 'Your complaint has been reviewed and resolved.';
    } else if (status === 'DISMISSED') {
      notifTitle = 'Complaint Dismissed';
      notifMsg = 'Your complaint has been reviewed and dismissed.';
    }

    if (notifTitle) {
      await notificationService.createNotification(
        current.reporterId,
        'COMPLAINT',
        notifTitle,
        notifMsg,
        current.id,
        'COMPLAINT'
      );

      // Notify guardian of minor student with authorized non-confidential summary
      const categoryLabel = current.category ? current.category.replace(/_/g, ' ') : 'General Support';
      const resolutionText = status === 'RESOLVED' && resolutionNote ? ` Resolution summary: ${resolutionNote}` : '';
      await guardianService.notifyGuardianEvent(
        current.reporterId,
        'COMPLAINT',
        {
          title: `Authorized Update: ${notifTitle}`,
          message: `An authorized status update has been posted regarding a support inquiry (Category: ${categoryLabel}). Current Status: ${status}.${resolutionText} For any safety inquiries or urgent safeguarding concerns, please contact safeguarding@mentorconnect.edu.`,
          referenceId: current.id,
          referenceType: 'COMPLAINT'
        }
      ).catch(err => console.error('Guardian complaint update error:', err.message));
    }

    // Notify Reported User securely
    if (['UNDER_REVIEW', 'RESOLVED', 'DISMISSED'].includes(status) && current.status === 'OPEN') {
      await notificationService.createNotification(
        current.reportedUserId,
        'COMPLAINT',
        'Complaint Review Notice',
        'A complaint involving one of your mentoring interactions is under review.',
        current.id,
        'COMPLAINT'
      );
    }

    return res.status(200).json({ status: 'success', data: updated, refund: refundResult });
  } catch (err) {
    return res.status(500).json({ status: 'error', message: err.message });
  }
};

/**
 * GET /api/admin/peer-mentor-applications
 * Returns peer mentor applications with optional status filter.
 */
const getPeerMentorApplications = async (req, res) => {
  try {
    const { status, queue } = req.query;

    let whereClause = {};
    if (queue === 'ELIGIBLE') {
      whereClause.OR = [
        {
          status: { in: ['AI_SCREENED', 'UNDER_REVIEW', 'PENDING'] },
          aiScreening: {
            recommendation: { in: ['STRONG_PASS', 'PASS', 'ELIGIBLE'] }
          }
        }
      ];
    } else if (queue === 'MANUAL_REVIEW') {
      whereClause.OR = [
        {
          status: 'UNDER_REVIEW',
          aiScreening: {
            recommendation: { in: ['NEEDS_REVIEW', 'BORDERLINE', 'NEEDS_MANUAL_REVIEW'] }
          }
        },
        {
          status: { in: ['PENDING', 'AI_SCREENED'] },
          aiScreening: {
            recommendation: { in: ['NEEDS_REVIEW', 'BORDERLINE', 'NEEDS_MANUAL_REVIEW'] }
          }
        }
      ];
    } else if (queue === 'AUTO_REJECTED') {
      whereClause.OR = [
        {
          status: 'REJECTED',
          aiScreening: {
            recommendation: { in: ['REJECT', 'AUTO_REJECTED'] }
          }
        },
        {
          status: 'REJECTED',
          rejectionReason: { contains: 'Auto-Rejected' }
        },
        {
          status: 'REJECTED',
          rejectionReason: { contains: 'objective criteria' }
        }
      ];
    } else if (status && status !== 'ALL') {
      whereClause.status = status;
    }

    const applications = await prisma.peerMentorApplication.findMany({
      where: whereClause,
      include: {
        mentor: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true,
                role: true,
                dateOfBirth: true,
                isActive: true,
                isSuspended: true,
                studentProfile: {
                  select: {
                    skills: true,
                    experienceLevel: true,
                    education: true,
                    onboardingCompleted: true
                  }
                }
              }
            }
          }
        },
        aiScreening: true
      },
      orderBy: { createdAt: 'desc' }
    });

    return res.status(200).json({ status: 'success', applications });
  } catch (err) {
    return res.status(500).json({ status: 'error', message: 'Failed to fetch peer mentor applications.', details: err.message });
  }
};

/**
 * GET /api/admin/peer-mentor-applications/:id
 * Returns detailed peer mentor application view.
 */
const getPeerMentorApplicationById = async (req, res) => {
  try {
    const application = await prisma.peerMentorApplication.findUnique({
      where: { id: req.params.id },
      include: {
        mentor: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true,
                role: true,
                dateOfBirth: true,
                isActive: true,
                isSuspended: true,
                createdAt: true,
                studentProfile: {
                  select: {
                    skills: true,
                    interests: true,
                    careerGoal: true,
                    education: true,
                    experienceLevel: true,
                    preferredLearningStyle: true,
                    preferredLanguage: true,
                    studyAvailability: true,
                    onboardingCompleted: true
                  }
                }
              }
            }
          }
        },
        aiScreening: true
      }
    });

    if (!application) {
      return res.status(404).json({ status: 'error', message: 'Peer mentor application not found.' });
    }

    return res.status(200).json({ status: 'success', application });
  } catch (err) {
    return res.status(500).json({ status: 'error', message: 'Failed to fetch peer mentor application.', details: err.message });
  }
};

/**
 * PUT /api/admin/peer-mentor-applications/:id/status
 * Updates peer mentor application status with lifecycle enforcement.
 */
const updatePeerMentorApplicationStatus = async (req, res) => {
  try {
    const { status, reviewNotes, rejectionReason } = req.body;

    const validStatuses = ['UNDER_REVIEW', 'APPROVED', 'REJECTED', 'SUSPENDED'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ status: 'error', message: `Invalid status. Must be one of: ${validStatuses.join(', ')}` });
    }

    if ((status === 'REJECTED' || status === 'SUSPENDED') && !rejectionReason) {
      return res.status(400).json({ status: 'error', message: 'Reason is required when rejecting or suspending.' });
    }

    const application = await prisma.peerMentorApplication.findUnique({
      where: { id: req.params.id },
      include: {
        mentor: {
          include: {
            user: {
              include: { studentProfile: true }
            }
          }
        }
      }
    });

    if (!application) {
      return res.status(404).json({ status: 'error', message: 'Peer mentor application not found.' });
    }

    // Status transition rules
    const current = application.status;
    const isApproval = status === 'APPROVED';
    const isRejection = status === 'REJECTED';
    const isSuspension = status === 'SUSPENDED';

    if (status === 'UNDER_REVIEW' && current !== 'AI_SCREENED' && current !== 'PENDING') {
      return res.status(400).json({ status: 'error', message: 'Only PENDING or AI_SCREENED applications can move to UNDER_REVIEW.' });
    }
    if (isApproval && current !== 'UNDER_REVIEW') {
      return res.status(400).json({ status: 'error', message: 'Only UNDER_REVIEW applications can be APPROVED.' });
    }
    if (isRejection && current !== 'UNDER_REVIEW') {
      return res.status(400).json({ status: 'error', message: 'Only UNDER_REVIEW applications can be REJECTED.' });
    }
    if (isSuspension && current !== 'APPROVED') {
      return res.status(400).json({ status: 'error', message: 'Only APPROVED peer mentors can be SUSPENDED.' });
    }

    const applicantUser = application.mentor.user;

    // Approval pre-checks
    if (isApproval) {
      if (applicantUser.role !== 'STUDENT') {
        return res.status(400).json({ status: 'error', message: 'Applicant must have STUDENT role for peer mentor approval.' });
      }
      if (!applicantUser.studentProfile) {
        return res.status(400).json({ status: 'error', message: 'Applicant must have a student profile.' });
      }
      if (!applicantUser.studentProfile.onboardingCompleted) {
        return res.status(400).json({ status: 'error', message: 'Applicant must have completed onboarding.' });
      }
      if (!applicantUser.isActive) {
        return res.status(400).json({ status: 'error', message: 'Applicant account must be active.' });
      }
      if (applicantUser.isSuspended) {
        return res.status(400).json({ status: 'error', message: 'Applicant account is suspended.' });
      }
      if (applicantUser.dateOfBirth && isMinor(new Date(applicantUser.dateOfBirth))) {
        return res.status(400).json({ status: 'error', message: 'Applicant must be at least 18 years old.' });
      }
    }

    const updatedApp = await prisma.$transaction(async (tx) => {
      const updated = await tx.peerMentorApplication.update({
        where: { id: application.id },
        data: {
          status,
          reviewNotes: reviewNotes !== undefined ? reviewNotes : application.reviewNotes,
          rejectionReason: (isRejection || isSuspension) ? rejectionReason : application.rejectionReason,
          reviewedAt: (isApproval || isRejection) ? new Date() : application.reviewedAt,
          reviewerId: req.user.id
        }
      });

      if (isApproval) {
        await tx.mentorProfile.update({
          where: { id: application.mentorId },
          data: {
            status: 'APPROVED',
            mentorType: 'PEER',
            verifiedAt: new Date()
          }
        });
        // User.role stays STUDENT — CRITICAL
      } else if (isRejection) {
        await tx.mentorProfile.update({
          where: { id: application.mentorId },
          data: { status: 'REJECTED' }
        });
      } else if (isSuspension) {
        await tx.mentorProfile.update({
          where: { id: application.mentorId },
          data: { status: 'REJECTED' }
        });
      }

      return updated;
    });

    // Send notification (outside transaction — non-blocking)
    try {
      let notifTitle, notifMsg;
      if (isApproval) {
        notifTitle = 'Peer Mentor Application Approved';
        notifMsg = 'Congratulations! Your peer mentor application has been approved. You can now mentor other learners.';
      } else if (isRejection) {
        notifTitle = 'Peer Mentor Application Rejected';
        notifMsg = `Your peer mentor application has been rejected. Reason: ${rejectionReason}`;
      } else if (isSuspension) {
        notifTitle = 'Peer Mentor Status Suspended';
        notifMsg = `Your peer mentor status has been suspended. Reason: ${rejectionReason}`;
      } else if (status === 'UNDER_REVIEW') {
        notifTitle = 'Peer Mentor Application Under Review';
        notifMsg = 'Your peer mentor application is now under review by an administrator.';
      }

      if (notifTitle) {
        await notificationService.createNotification(
          applicantUser.id,
          'GENERAL',
          notifTitle,
          notifMsg,
          application.id,
          'PEER_MENTOR_APPLICATION'
        );
      }
    } catch (notifErr) {
      console.error('Failed to send peer mentor notification:', notifErr.message);
    }

    return res.status(200).json({ status: 'success', message: 'Peer mentor application status updated.', application: updatedApp });
  } catch (err) {
    return res.status(500).json({ status: 'error', message: 'Failed to update peer mentor application status.', details: err.message });
  }
};

/**
 * GET /api/admin/verification-requests
 */
const getVerificationRequests = async (req, res) => {
  try {
    const { status } = req.query;

    let whereClause = {};
    if (status && status !== 'ALL') {
      whereClause.status = status;
    }

    const requests = await prisma.verificationRequest.findMany({
      where: whereClause,
      include: {
        mentor: {
          include: { user: { select: { name: true, email: true } } }
        }
      },
      orderBy: { submittedAt: 'desc' }
    });

    return res.status(200).json({ status: 'success', requests });
  } catch (err) {
    return res.status(500).json({ status: 'error', message: 'Failed to fetch verification requests.', details: err.message });
  }
};

/**
 * PUT /api/admin/verification-requests/:id/status
 */
const updateVerificationRequestStatus = async (req, res) => {
  try {
    const { status, adminNotes, rejectionReason } = req.body;

    const validStatuses = ['PENDING', 'AI_SCREENED', 'UNDER_REVIEW', 'APPROVED', 'REJECTED'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ status: 'error', message: 'Invalid status.' });
    }

    const request = await prisma.verificationRequest.findUnique({
      where: { id: req.params.id },
      include: { mentor: true }
    });

    if (!request) {
      return res.status(404).json({ status: 'error', message: 'Verification request not found.' });
    }

    const updated = await prisma.$transaction(async (tx) => {
      const updatedReq = await tx.verificationRequest.update({
        where: { id: request.id },
        data: {
          status,
          adminNotes: adminNotes !== undefined ? adminNotes : request.adminNotes,
          rejectionReason: rejectionReason !== undefined ? rejectionReason : request.rejectionReason,
          reviewedAt: (status === 'APPROVED' || status === 'REJECTED') ? new Date() : request.reviewedAt,
          reviewerId: req.user.id
        }
      });

      if (status === 'APPROVED') {
        // If it's a NEW_CERTIFICATE or NEW_EXPERIENCE, we might create a Credential.
        if (['NEW_CERTIFICATE', 'NEW_EXPERIENCE', 'NEW_QUALIFICATION'].includes(request.type)) {
          await tx.credential.create({
            data: {
              mentorId: request.mentorId,
              type: request.type,
              title: request.title,
              description: request.description,
              issuingOrganization: request.institution,
              issueDate: request.startDate,
              expiryDate: request.endDate,
              fileReference: request.evidenceFiles,
              claimType: request.type,
              claimDescription: request.title,
              status: 'VERIFIED',
              adminVerificationInfo: updatedReq.adminNotes
            }
          });
        } else if (request.type === 'NEW_TEACHING_TOPIC') {
          // Add to topics
          let topicRec = await tx.topic.findUnique({ where: { name: request.title } });
          if (!topicRec) {
            topicRec = await tx.topic.create({ data: { name: request.title, category: 'General' } });
          }
          const existingMT = await tx.mentorTopic.findUnique({
            where: { mentorId_topicId: { mentorId: request.mentorId, topicId: topicRec.id } }
          });
          if (!existingMT) {
            await tx.mentorTopic.create({
              data: { mentorId: request.mentorId, topicId: topicRec.id }
            });
          }
        }
      }

      return updatedReq;
    });

    return res.status(200).json({ status: 'success', message: 'Verification request updated.', request: updated });
  } catch (err) {
    return res.status(500).json({ status: 'error', message: 'Failed to update verification request.', details: err.message });
  }
};

/**
 * PUT /api/admin/mentor-applications/:id/reconsider
 * Reopens an auto-rejected or flagged professional application for manual review.
 */
const reconsiderMentorApplication = async (req, res) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;
    const mentorScreeningService = require('../services/mentorScreeningService');
    const result = await mentorScreeningService.reconsiderApplication({
      applicationId: id,
      isPeer: false,
      adminUser: req.user,
      reason
    });
    return res.status(200).json({ status: 'success', message: 'Application reopened for administrative review.', data: result });
  } catch (err) {
    return res.status(500).json({ status: 'error', message: 'Failed to reconsider application.', details: err.message });
  }
};

/**
 * PUT /api/admin/peer-mentor-applications/:id/reconsider
 * Reopens an auto-rejected or flagged peer application for manual review.
 */
const reconsiderPeerMentorApplication = async (req, res) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;
    const mentorScreeningService = require('../services/mentorScreeningService');
    const result = await mentorScreeningService.reconsiderApplication({
      applicationId: id,
      isPeer: true,
      adminUser: req.user,
      reason
    });
    return res.status(200).json({ status: 'success', message: 'Peer application reopened for administrative review.', data: result });
  } catch (err) {
    return res.status(500).json({ status: 'error', message: 'Failed to reconsider peer application.', details: err.message });
  }
};

module.exports = {
  getDashboardStats,
  getUsers,
  getMentors,
  getMentorships,
  getMentorApplications,
  getMentorApplicationById,
  updateMentorApplicationStatus,
  reconsiderMentorApplication,
  getComplaints,
  getComplaintById,
  updateComplaintStatus,
  toggleUserSuspension,
  getPeerMentorApplications,
  getPeerMentorApplicationById,
  updatePeerMentorApplicationStatus,
  reconsiderPeerMentorApplication,
  generateMentorPortfolio,
  getVerificationRequests,
  updateVerificationRequestStatus
};
