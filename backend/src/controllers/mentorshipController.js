const prisma = require('../config/db');

/**
 * POST /api/mentorships
 * Create a new mentorship request. Only STUDENTS can create.
 */
const createMentorship = async (req, res) => {
  try {
    if (req.user.role !== 'STUDENT') {
      return res.status(403).json({ status: 'error', message: 'Only STUDENTS can request mentorship.' });
    }

    const studentProfile = req.user.studentProfile;
    if (!studentProfile) {
      return res.status(403).json({ status: 'error', message: 'Student profile required.' });
    }

    const { mentorId } = req.body;
    if (!mentorId) {
      return res.status(400).json({ status: 'error', message: 'mentorId is required.' });
    }

    // Check if mentor exists
    const mentor = await prisma.mentorProfile.findUnique({ where: { id: mentorId } });
    if (!mentor) {
      return res.status(404).json({ status: 'error', message: 'Mentor not found.' });
    }

    // Prevent self-mentorship (if user somehow has both profiles or tests it)
    if (mentor.userId === req.user.id) {
      return res.status(400).json({ status: 'error', message: 'You cannot mentor yourself.' });
    }

    // Check for existing active mentorship
    const existing = await prisma.mentorship.findFirst({
      where: {
        studentId: studentProfile.id,
        mentorId: mentorId,
        status: 'ACTIVE'
      }
    });

    if (existing) {
      return res.status(400).json({ status: 'error', message: 'You already have an active mentorship with this mentor.' });
    }

    const mentorship = await prisma.mentorship.create({
      data: {
        studentId: studentProfile.id,
        mentorId: mentorId,
        status: 'ACTIVE'
      }
    });

    return res.status(201).json({ status: 'success', message: 'Mentorship requested successfully.', mentorship });
  } catch (err) {
    return res.status(500).json({ status: 'error', message: 'Failed to create mentorship.', details: err.message });
  }
};

/**
 * GET /api/mentorships/student
 * Return the authenticated student's mentorships.
 */
const getStudentMentorships = async (req, res) => {
  try {
    if (req.user.role !== 'STUDENT') {
      return res.status(403).json({ status: 'error', message: 'Access denied.' });
    }

    const profile = req.user.studentProfile;
    if (!profile) return res.status(403).json({ status: 'error', message: 'Profile required.' });

    const mentorships = await prisma.mentorship.findMany({
      where: { studentId: profile.id },
      include: {
        mentor: {
          include: {
            user: { select: { name: true, email: true } }
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    return res.status(200).json({ status: 'success', mentorships });
  } catch (err) {
    return res.status(500).json({ status: 'error', message: 'Failed to fetch mentorships.', details: err.message });
  }
};

/**
 * DELETE /api/mentorships/:id
 * Allow a student to cancel their own mentorship.
 */
const cancelMentorship = async (req, res) => {
  try {
    if (req.user.role !== 'STUDENT') {
      return res.status(403).json({ status: 'error', message: 'Access denied.' });
    }

    const profile = req.user.studentProfile;
    if (!profile) return res.status(403).json({ status: 'error', message: 'Profile required.' });

    const existing = await prisma.mentorship.findFirst({
      where: { id: req.params.id, studentId: profile.id }
    });

    if (!existing) {
      return res.status(404).json({ status: 'error', message: 'Mentorship not found or access denied.' });
    }

    await prisma.mentorship.delete({ where: { id: req.params.id } });

    return res.status(200).json({ status: 'success', message: 'Mentorship cancelled successfully.' });
  } catch (err) {
    return res.status(500).json({ status: 'error', message: 'Failed to cancel mentorship.', details: err.message });
  }
};

/**
 * GET /api/mentorships/mentor
 * Return mentorships belonging to the authenticated mentor.
 */
const getMentorMentorships = async (req, res) => {
  try {
    if (req.user.role !== 'MENTOR') {
      return res.status(403).json({ status: 'error', message: 'Access denied.' });
    }

    const profile = req.user.mentorProfile;
    if (!profile) return res.status(403).json({ status: 'error', message: 'Profile required.' });

    const mentorships = await prisma.mentorship.findMany({
      where: { mentorId: profile.id },
      include: {
        student: {
          include: {
            user: { select: { name: true, email: true } }
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    return res.status(200).json({ status: 'success', mentorships });
  } catch (err) {
    return res.status(500).json({ status: 'error', message: 'Failed to fetch mentorships.', details: err.message });
  }
};

module.exports = {
  createMentorship,
  getStudentMentorships,
  cancelMentorship,
  getMentorMentorships
};
