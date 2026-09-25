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

    // Notify admins (Assuming an admin might get it, but we can just use notificationService to a specific admin or just skip it if admin routing isn't explicit)
    // We will just notify the reporter that their complaint was received.
    await notificationService.createNotification(
      reporterId,
      'COMPLAINT',
      'Complaint Submitted',
      'Your complaint has been submitted and requires review by our moderation team.',
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
        reportedUser: { select: { name: true } }
      }
    });

    if (!complaint) return res.status(404).json({ status: 'error', message: 'Complaint not found' });

    if (role !== 'ADMIN' && complaint.reporterId !== userId) {
      return res.status(403).json({ status: 'error', message: 'Not authorized to view this complaint' });
    }

    return res.status(200).json({ status: 'success', data: complaint });
  } catch (err) {
    return res.status(500).json({ status: 'error', message: err.message });
  }
};

module.exports = {
  createComplaint,
  getMyComplaints,
  getComplaintById
};
