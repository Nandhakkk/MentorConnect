const prisma = require('../config/db');

/**
 * Helper: verify the authenticated user belongs to the mentorship (as student or mentor)
 */
const verifyMentorshipAccess = async (mentorshipId, user) => {
  const mentorship = await prisma.mentorship.findUnique({
    where: { id: mentorshipId },
    include: {
      student: true,
      mentor: true
    }
  });
  if (!mentorship || mentorship.status !== 'ACTIVE') return null;

  const studentUserId = mentorship.student?.userId;
  const mentorUserId = mentorship.mentor?.userId;

  if (user.id !== studentUserId && user.id !== mentorUserId) return null;
  return mentorship;
};

/**
 * GET /api/messages/:mentorshipId
 * Get message history for a mentorship.
 */
const getMessages = async (req, res) => {
  try {
    const { mentorshipId } = req.params;

    const mentorship = await verifyMentorshipAccess(mentorshipId, req.user);
    if (!mentorship) {
      return res.status(403).json({ status: 'error', message: 'Access denied or mentorship not found.' });
    }

    const messages = await prisma.message.findMany({
      where: { mentorshipId },
      include: {
        sender: { select: { id: true, name: true } }
      },
      orderBy: { createdAt: 'asc' }
    });

    return res.status(200).json({ status: 'success', messages });
  } catch (err) {
    return res.status(500).json({ status: 'error', message: 'Failed to fetch messages.', details: err.message });
  }
};

/**
 * POST /api/messages/:mentorshipId
 * Send a message to a mentorship.
 */
const sendMessage = async (req, res) => {
  try {
    const { mentorshipId } = req.params;
    const { content } = req.body;

    if (!content || content.trim() === '') {
      return res.status(400).json({ status: 'error', message: 'Message content cannot be empty.' });
    }

    const mentorship = await verifyMentorshipAccess(mentorshipId, req.user);
    if (!mentorship) {
      return res.status(403).json({ status: 'error', message: 'Access denied or mentorship not found.' });
    }

    const message = await prisma.message.create({
      data: {
        senderId: req.user.id,
        mentorshipId,
        content: content.trim()
      },
      include: {
        sender: { select: { id: true, name: true } }
      }
    });

    // Emit via Socket.IO to the mentorship room
    try {
      const { getIO } = require('../sockets/socketManager');
      getIO().to(`mentorship:${mentorshipId}`).emit('newMessage', message);
    } catch (_) {
      // Socket.IO may not be needed for REST-only usage
    }

    return res.status(201).json({ status: 'success', message });
  } catch (err) {
    return res.status(500).json({ status: 'error', message: 'Failed to send message.', details: err.message });
  }
};

module.exports = {
  getMessages,
  sendMessage,
  verifyMentorshipAccess
};
