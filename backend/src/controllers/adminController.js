const prisma = require('../config/db');

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
    
    let whereClause = {};
    if (role && role !== 'ALL') {
      whereClause.role = role;
    }
    
    if (search) {
      whereClause.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } }
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
    const mentors = await prisma.mentorProfile.findMany({
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            createdAt: true
          }
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
 * Returns professional mentor applications.
 */
const getMentorApplications = async (req, res) => {
  try {
    const { status } = req.query;
    
    let whereClause = {};
    if (status && status !== 'ALL') {
      whereClause.status = status;
    }

    const applications = await prisma.mentorApplication.findMany({
      where: whereClause,
      include: {
        mentor: {
          include: { user: { select: { name: true, email: true } } }
        },
        aiScreening: true
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
const getMentorApplicationById = async (req, res) => {
  try {
    const application = await prisma.mentorApplication.findUnique({
      where: { id: req.params.id },
      include: {
        mentor: {
          include: { user: { select: { name: true, email: true, dateOfBirth: true, phone: true, profileImage: true } } }
        },
        credentials: true,
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
 * Updates the application status and propagates to mentor profile if approved.
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
      include: { mentor: true }
    });

    if (!application) {
      return res.status(404).json({ status: 'error', message: 'Application not found.' });
    }

    // Status transition rules (simplified enforcement)
    const current = application.status;
    const isApproval = status === 'APPROVED';
    const isRejection = status === 'REJECTED';
    const isSuspension = status === 'SUSPENDED';

    if (isApproval && current !== 'UNDER_REVIEW') {
      return res.status(400).json({ status: 'error', message: 'Only UNDER_REVIEW applications can be APPROVED.' });
    }
    if (isRejection && current !== 'UNDER_REVIEW') {
      return res.status(400).json({ status: 'error', message: 'Only UNDER_REVIEW applications can be REJECTED.' });
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
        await tx.mentorProfile.update({
          where: { id: application.mentorId },
          data: {
            status: 'APPROVED',
            mentorType: 'PROFESSIONAL',
            verifiedAt: new Date()
          }
        });
      } else if (isRejection || isSuspension) {
        await tx.mentorProfile.update({
          where: { id: application.mentorId },
          data: {
            status: isSuspension ? 'REJECTED' : 'REJECTED' // or leave PENDING/REJECTED. For now, REJECTED.
          }
        });
      }

      return updated;
    });

    return res.status(200).json({ status: 'success', message: 'Application status updated.', application: updatedApp });
  } catch (err) {
    return res.status(500).json({ status: 'error', message: 'Failed to update application status.', details: err.message });
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

module.exports = {
  getDashboardStats,
  getUsers,
  getMentors,
  getMentorships,
  getMentorApplications,
  getMentorApplicationById,
  updateMentorApplicationStatus
};
