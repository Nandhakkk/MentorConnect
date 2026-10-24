const prisma = require('../config/db');
const notificationService = require('../services/notificationService');

/**
 * CREATE COMPLAINT
 * POST /api/complaints
 */
const createComplaint = async (req, res) => {
  try {
    const reporterId = req.user.id;
    const { sessionId, category, description } = req.body;

    if (!sessionId || !category || !description) {
      return res.status(400).json({ status: 'error', message: 'Session ID, category, and description are required' });
    }

    if (description.length < 10 || description.length > 2000) {
      return res.status(400).json({ status: 'error', message: 'Description must be between 10 and 2000 characters' });
    }

    const validCategories = ['INAPPROPRIATE_BEHAVIOR', 'NO_SHOW', 'PAYMENT_ISSUE', 'OTHER'];
    if (!validCategories.includes(category)) {
      return res.status(400).json({ status: 'error', message: 'Invalid complaint category' });
    }

    // Verify Session
    const session = await prisma.session.findUnique({
      where: { id: sessionId },
      include: {
        mentorship: {
          include: { mentor: true, student: true }
        }
      }
    });

    if (!session) {
      return res.status(404).json({ status: 'error', message: 'Session not found' });
    }

    // Derive reported user
    let reportedUserId;
    if (session.mentorship.student.userId === reporterId) {
      reportedUserId = session.mentorship.mentor.userId;
    } else if (session.mentorship.mentor.userId === reporterId) {
      reportedUserId = session.mentorship.student.userId;
    } else {
      return res.status(403).json({ status: 'error', message: 'You are not a participant in this session' });
    }

    // Check for open duplicates
    const existing = await prisma.complaint.findFirst({
      where: {
        sessionId,
        reporterId,
        category,
        status: { in: ['OPEN', 'UNDER_REVIEW'] }
      }
    });

    if (existing) {
      return res.status(400).json({ status: 'error', message: 'You already have an active complaint of this category for this session' });
    }

    const complaint = await prisma.complaint.create({
      data: {
        reporterId,
        reportedUserId,
        sessionId,
        targetType: 'SESSION',
        targetId: sessionId,
        category,
        description,
        status: 'OPEN'
      }
    });

    // Notify reporter
    await notificationService.createNotification(
      reporterId,
      'COMPLAINT',
      'Complaint Submitted',
      'Your complaint has been submitted and requires review by our moderation team.',
      complaint.id,
      'COMPLAINT'
    );

    // Notify reported user
    await notificationService.createNotification(
      reportedUserId,
      'COMPLAINT',
      'Complaint Filed Regarding You',
      'Complaint filed regarding you. You can review the complaint and provide your response.',
      complaint.id,
      'COMPLAINT'
    );

    return res.status(201).json({ status: 'success', data: complaint });
  } catch (err) {
    return res.status(500).json({ status: 'error', message: err.message });
  }
};

/**
 * GET MY COMPLAINTS
 * GET /api/complaints/my
 */
const getMyComplaints = async (req, res) => {
  try {
    const reporterId = req.user.id;
    const complaints = await prisma.complaint.findMany({
      where: { reporterId },
      include: {
        session: { select: { scheduledAt: true, duration: true } },
        reportedUser: { select: { name: true } }
      },
      orderBy: { createdAt: 'desc' }
    });
    return res.status(200).json({ status: 'success', data: complaints });
  } catch (err) {
    return res.status(500).json({ status: 'error', message: err.message });
  }
};

/**
 * GET COMPLAINTS AGAINST ME
 * GET /api/complaints/against-me
 */
const getComplaintsAgainstMe = async (req, res) => {
  try {
    const reportedUserId = req.user.id;
    const complaints = await prisma.complaint.findMany({
      where: { reportedUserId },
      include: {
        session: { select: { scheduledAt: true, duration: true } },
        reporter: { select: { name: true } }
      },
      orderBy: { createdAt: 'desc' }
    });
    return res.status(200).json({ status: 'success', data: complaints });
  } catch (err) {
    return res.status(500).json({ status: 'error', message: err.message });
  }
};

/**
 * GET COMPLAINT DETAILS
 * GET /api/complaints/:id
 */
const getComplaintById = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    const role = req.user.role;

    const complaint = await prisma.complaint.findUnique({
      where: { id },
      include: {
        session: { select: { scheduledAt: true } },
        reportedUser: { select: { name: true } },
        reporter: { select: { name: true } },
        messages: {
          include: { sender: { select: { name: true, role: true } } },
          orderBy: { createdAt: 'asc' }
        }
      }
    });

    if (!complaint) return res.status(404).json({ status: 'error', message: 'Complaint not found' });

    if (role !== 'ADMIN' && complaint.reporterId !== userId && complaint.reportedUserId !== userId) {
      return res.status(403).json({ status: 'error', message: 'Not authorized to view this complaint' });
    }

    return res.status(200).json({ status: 'success', data: complaint });
  } catch (err) {
    return res.status(500).json({ status: 'error', message: err.message });
  }
};

/**
 * RESPOND TO COMPLAINT
 * POST /api/complaints/:id/respond
 */
const respondToComplaint = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    const { response } = req.body;

    if (!response || response.trim().length < 10) {
      return res.status(400).json({ status: 'error', message: 'Response must be at least 10 characters long' });
    }

    const complaint = await prisma.complaint.findUnique({ where: { id } });
    if (!complaint) return res.status(404).json({ status: 'error', message: 'Complaint not found' });

    if (complaint.reportedUserId !== userId) {
      return res.status(403).json({ status: 'error', message: 'Only the reported user can respond' });
    }

    if (complaint.reportedUserResponse) {
      return res.status(400).json({ status: 'error', message: 'Response already submitted' });
    }

    if (complaint.status === 'RESOLVED' || complaint.status === 'DISMISSED') {
      return res.status(400).json({ status: 'error', message: 'Cannot respond to a closed complaint' });
    }

    const updated = await prisma.complaint.update({
      where: { id },
      data: {
        reportedUserResponse: response,
        reportedUserRespondedAt: new Date()
      }
    });

    // Notify admins (find any admin)
    const admin = await prisma.user.findFirst({ where: { role: 'ADMIN' } });
    if (admin) {
      await notificationService.createNotification(
        admin.id,
        'COMPLAINT',
        'Complaint Response Submitted',
        `A response was submitted for Complaint ${id}`,
        id,
        'COMPLAINT'
      );
    }

    return res.status(200).json({ status: 'success', data: updated });
  } catch (err) {
    return res.status(500).json({ status: 'error', message: err.message });
  }
};

/**
 * SEND COMPLAINT MESSAGE
 * POST /api/complaints/:id/messages
 */
const sendComplaintMessage = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    const role = req.user.role;
    const { content } = req.body;

    if (!content || content.trim().length === 0) {
      return res.status(400).json({ status: 'error', message: 'Message content is required' });
    }

    const complaint = await prisma.complaint.findUnique({ where: { id } });
    if (!complaint) return res.status(404).json({ status: 'error', message: 'Complaint not found' });

    if (role !== 'ADMIN' && complaint.reporterId !== userId && complaint.reportedUserId !== userId) {
      return res.status(403).json({ status: 'error', message: 'Not authorized to participate in this complaint' });
    }

    if (complaint.status === 'RESOLVED' || complaint.status === 'DISMISSED') {
      return res.status(400).json({ status: 'error', message: 'Cannot send messages to a closed complaint' });
    }

    const message = await prisma.complaintMessage.create({
      data: {
        complaintId: id,
        senderId: userId,
        content: content.trim()
      },
      include: {
        sender: { select: { name: true, role: true } }
      }
    });

    // Notify other participants
    const participants = new Set();
    if (role !== 'ADMIN') {
      const admin = await prisma.user.findFirst({ where: { role: 'ADMIN' } });
      if (admin) participants.add(admin.id);
    }
    if (userId !== complaint.reporterId) participants.add(complaint.reporterId);
    if (userId !== complaint.reportedUserId) participants.add(complaint.reportedUserId);

    for (const participantId of participants) {
      await notificationService.createNotification(
        participantId,
        'COMPLAINT',
        `New message in complaint #${complaint.id.substring(0, 6)}`,
        'A new message has been added to the complaint discussion.',
        complaint.id,
        'COMPLAINT'
      );
    }

    return res.status(201).json({ status: 'success', data: message });
  } catch (err) {
    return res.status(500).json({ status: 'error', message: err.message });
  }
};

module.exports = {
  createComplaint,
  getMyComplaints,
  getComplaintsAgainstMe,
  getComplaintById,
  respondToComplaint,
  sendComplaintMessage
};
