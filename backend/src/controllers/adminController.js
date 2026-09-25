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

const updateMentorStatus = async (req, res, status) => {
  try {
    const mentor = await prisma.mentorProfile.findUnique({
      where: { id: req.params.id },
      include: { user: { select: { id: true, name: true, email: true } } }
    });

    if (!mentor) {
      return res.status(404).json({ status: 'error', message: 'Mentor application not found.' });
    }

    if (mentor.status !== 'PENDING') {
      return res.status(409).json({
        status: 'error',
        message: `Only pending mentor applications can be ${status.toLowerCase()}.`
      });
    }

    const updatedMentor = await prisma.mentorProfile.update({
      where: { id: mentor.id },
      data: { status },
      include: { user: { select: { id: true, name: true, email: true } } }
    });

    return res.status(200).json({
      status: 'success',
      message: `Mentor application ${status.toLowerCase()} successfully.`,
      mentor: updatedMentor
    });
  } catch (err) {
    return res.status(500).json({ status: 'error', message: 'Failed to update mentor application.', details: err.message });
  }
};

/** PUT /api/admin/mentors/:id/approve */
const approveMentor = (req, res) => updateMentorStatus(req, res, 'APPROVED');

/** PUT /api/admin/mentors/:id/reject */
const rejectMentor = (req, res) => updateMentorStatus(req, res, 'REJECTED');

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
  approveMentor,
  rejectMentor,
  getMentorships
};
