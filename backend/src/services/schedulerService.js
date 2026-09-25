const prisma = require('../config/db');
const notificationService = require('./notificationService');

const startScheduler = () => {
  // Run every 1 minute
  setInterval(async () => {
    try {
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
    } catch (err) {
      console.error('Error running session reminder scheduler:', err);
    }
  }, 60000);
};

module.exports = { startScheduler };
