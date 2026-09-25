const prisma = require('../config/db');

/**
 * GET /api/mentors/me
 * Return the authenticated mentor's profile.
 */
const getMyProfile = async (req, res) => {
  try {
    if (req.user.role !== 'MENTOR') {
      return res.status(403).json({ status: 'error', message: 'Only MENTOR users can access this.' });
    }

    const profile = await prisma.mentorProfile.findUnique({
      where: { userId: req.user.id },
      include: { user: { select: { name: true, email: true } } }
    });

    if (!profile) {
      return res.status(404).json({ status: 'error', message: 'Mentor profile not found.' });
    }

    return res.status(200).json({ status: 'success', profile });
  } catch (err) {
    return res.status(500).json({ status: 'error', message: 'Failed to fetch profile.', details: err.message });
  }
};

/**
 * PUT /api/mentors/me
 * Update the authenticated mentor's profile.
 */
const updateMyProfile = async (req, res) => {
  try {
    if (req.user.role !== 'MENTOR') {
      return res.status(403).json({ status: 'error', message: 'Only MENTOR users can update mentor profiles.' });
    }

    const { bio, expertise, experience, hourlyRate, isAvailable } = req.body;

    const updatedProfile = await prisma.mentorProfile.update({
      where: { userId: req.user.id },
      data: {
        bio: bio !== undefined ? bio : undefined,
        expertise: expertise !== undefined ? expertise : undefined,
        experience: experience !== undefined ? parseInt(experience, 10) : undefined,
        hourlyRate: hourlyRate !== undefined ? parseFloat(hourlyRate) : undefined,
        isAvailable: isAvailable !== undefined ? Boolean(isAvailable) : undefined,
      },
      include: { user: { select: { name: true, email: true } } }
    });

    return res.status(200).json({ status: 'success', message: 'Profile updated successfully.', profile: updatedProfile });
  } catch (err) {
    return res.status(500).json({ status: 'error', message: 'Failed to update profile.', details: err.message });
  }
};

/**
 * GET /api/mentors
 * Return available mentors (isAvailable = true).
 * Supports search and expertise query filters.
 */
const getAvailableMentors = async (req, res) => {
  try {
    const { search, expertise } = req.query;

    const whereClause = {
      isAvailable: true,
      status: 'APPROVED',
      user: { role: 'MENTOR' }
    };

    if (search) {
      whereClause.OR = [
        { user: { name: { contains: search, mode: 'insensitive' } } },
        { expertise: { contains: search, mode: 'insensitive' } },
        { bio: { contains: search, mode: 'insensitive' } }
      ];
    } else if (expertise) {
      whereClause.expertise = { contains: expertise, mode: 'insensitive' };
    }

    const mentors = await prisma.mentorProfile.findMany({
      where: whereClause,
      include: {
        user: { select: { id: true, name: true, email: true } }
      }
    });

    return res.status(200).json({ status: 'success', mentors });
  } catch (err) {
    return res.status(500).json({ status: 'error', message: 'Failed to fetch mentors.', details: err.message });
  }
};

/**
 * GET /api/mentors/:id
 * View a mentor's public profile by MentorProfile ID.
 */
const getMentorById = async (req, res) => {
  try {
    const mentorId = req.params.id;

    const profile = await prisma.mentorProfile.findFirst({
      where: { id: mentorId, status: 'APPROVED' },
      include: {
        user: { select: { id: true, name: true, email: true } }
      }
    });

    if (!profile) {
      return res.status(404).json({ status: 'error', message: 'Mentor not found.' });
    }

    return res.status(200).json({ status: 'success', profile });
  } catch (err) {
    return res.status(500).json({ status: 'error', message: 'Failed to fetch mentor details.', details: err.message });
  }
};

module.exports = {
  getMyProfile,
  updateMyProfile,
  getAvailableMentors,
  getMentorById
};
