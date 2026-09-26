const prisma = require('../config/db');
const { isApprovedMentor, isMentorParticipant, isStudentParticipant } = require('../utils/mentorCapability');

/**
 * POST /api/mentorships
 * Create a new mentorship request. Only STUDENTS can create.
 * Supports both PROFESSIONAL and PEER approved mentors as targets.
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

    // Check if mentor is approved (PROFESSIONAL or PEER) and eligible
    const mentor = await prisma.mentorProfile.findFirst({
      where: { 
        id: mentorId, 
        status: 'APPROVED', 
        mentorType: { in: ['PROFESSIONAL', 'PEER'] },
        isAvailable: true 
      },
      include: { user: true }
    });
    if (!mentor) {
      return res.status(404).json({ status: 'error', message: 'Mentor not found.' });
    }

    if (mentor.user.isSuspended) {
      return res.status(403).json({ status: 'error', message: 'Mentor is suspended.' });
    }

    if (!mentor.user.isActive) {
      return res.status(403).json({ status: 'error', message: 'Mentor account is not active.' });
    }

    // Prevent self-mentorship
    if (mentor.userId === req.user.id) {
      return res.status(400).json({ status: 'error', message: 'You cannot mentor yourself.' });
    }

    // Prevent duplicate pending or active requests for the same mentor.
    const existing = await prisma.mentorship.findFirst({
      where: {
        studentId: studentProfile.id,
        mentorId: mentorId,
        status: { in: ['PENDING', 'ACTIVE'] }
      }
    });

    if (existing) {
      return res.status(400).json({ status: 'error', message: 'You already have a pending or active mentorship with this mentor.' });
    }

    const mentorship = await prisma.mentorship.create({
      data: {
        studentId: studentProfile.id,
        mentorId: mentorId,
        status: 'PENDING',
        startedAt: null
      }
    });

    return res.status(201).json({ status: 'success', message: 'Mentorship requested successfully.', mentorship });
  } catch (err) {
    return res.status(500).json({ status: 'error', message: 'Failed to create mentorship.', details: err.message });
  }
};

const updateMentorshipRequest = async (req, res, status) => {
  try {
    const mentorProfile = req.user.mentorProfile;
    const mentorship = await prisma.mentorship.findFirst({
      where: {
        id: req.params.id,
        mentorId: mentorProfile.id
      }
    });

    if (!mentorship) {
      return res.status(404).json({ status: 'error', message: 'Mentorship request not found or access denied.' });
    }

    if (mentorship.status !== 'PENDING') {
      return res.status(409).json({
        status: 'error',
        message: 'Only pending mentorship requests can be accepted or rejected.'
      });
    }

    const updatedMentorship = await prisma.mentorship.update({
      where: { id: mentorship.id },
      data: {
        status,
        ...(status === 'ACTIVE' ? { startedAt: new Date() } : {})
      },
      include: {
        student: { include: { user: { select: { name: true, email: true } } } },
        mentor: { include: { user: { select: { name: true, email: true } } } }
      }
    });

    return res.status(200).json({
      status: 'success',
      message: status === 'ACTIVE' ? 'Mentorship request accepted.' : 'Mentorship request rejected.',
      mentorship: updatedMentorship
    });
  } catch (err) {
    return res.status(500).json({ status: 'error', message: 'Failed to update mentorship request.', details: err.message });
  }
};

/** PUT /api/mentorships/:id/accept */
const acceptMentorship = (req, res) => updateMentorshipRequest(req, res, 'ACTIVE');

/** PUT /api/mentorships/:id/reject */
const rejectMentorship = (req, res) => updateMentorshipRequest(req, res, 'CANCELLED');

/**
 * GET /api/mentorships/student
 * Return the authenticated student's mentorships.
 * Works for both regular students and peer mentors (who are also students).
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

    await prisma.mentorship.update({ 
      where: { id: req.params.id },
      data: { status: 'CANCELLED' }
    });

    return res.status(200).json({ status: 'success', message: 'Mentorship cancelled successfully.' });
  } catch (err) {
    return res.status(500).json({ status: 'error', message: 'Failed to cancel mentorship.', details: err.message });
  }
};

/**
 * GET /api/mentorships/mentor
 * Return mentorships belonging to the authenticated mentor.
 * Works for both PROFESSIONAL and PEER approved mentors.
 */
const getMentorMentorships = async (req, res) => {
  try {
    // requireApprovedMentor middleware already checked capability
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

/**
 * GET /api/mentorships/:id
 * Return a specific mentorship (allowed for both STUDENT and MENTOR involved, or ADMIN).
 * Peer mentors can access as mentor participant via mentorProfile.
 */
const getMentorshipById = async (req, res) => {
  try {
    const mentorship = await prisma.mentorship.findUnique({
      where: { id: req.params.id },
      include: {
        mentor: {
          include: {
            user: { select: { name: true, email: true } },
            topics: { include: { topic: true } },
            availabilities: true
          }
        },
        student: {
          include: {
            user: { select: { name: true, email: true } }
          }
        }
      }
    });

    if (!mentorship) {
      return res.status(404).json({ status: 'error', message: 'Mentorship not found.' });
    }

    // Capability-based authorization: check by profile ID match rather than role
    const { role, studentProfile, mentorProfile } = req.user;
    const isAuthorized = 
      isStudentParticipant(req.user, mentorship.studentId) ||
      isMentorParticipant(req.user, mentorship.mentorId) ||
      role === 'ADMIN';

    if (!isAuthorized) {
      return res.status(403).json({ status: 'error', message: 'Access denied.' });
    }

    return res.status(200).json({ status: 'success', mentorship });
  } catch (err) {
    return res.status(500).json({ status: 'error', message: 'Failed to fetch mentorship.', details: err.message });
  }
};

module.exports = {
  createMentorship,
  getStudentMentorships,
  cancelMentorship,
  getMentorMentorships,
  acceptMentorship,
  rejectMentorship,
  getMentorshipById
};
