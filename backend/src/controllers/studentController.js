const prisma = require('../config/db');

/**
 * GET /api/students/me
 * Return the authenticated student's profile.
 */
const getMyProfile = async (req, res) => {
  try {
    if (req.user.role !== 'STUDENT') {
      return res.status(403).json({ status: 'error', message: 'Only STUDENT users can access this.' });
    }

    const profile = await prisma.studentProfile.findUnique({
      where: { userId: req.user.id },
      include: { user: { select: { name: true, email: true } } }
    });

    if (!profile) {
      return res.status(404).json({ status: 'error', message: 'Student profile not found.' });
    }

    return res.status(200).json({ status: 'success', profile });
  } catch (err) {
    return res.status(500).json({ status: 'error', message: 'Failed to fetch profile.', details: err.message });
  }
};

/**
 * PUT /api/students/me
 * Update the authenticated student's profile.
 */
const updateMyProfile = async (req, res) => {
  try {
    if (req.user.role !== 'STUDENT') {
      return res.status(403).json({ status: 'error', message: 'Only STUDENT users can update student profiles.' });
    }

    const { bio, education, skills, interests, careerGoal } = req.body;

    const updatedProfile = await prisma.studentProfile.update({
      where: { userId: req.user.id },
      data: {
        bio: bio !== undefined ? bio : undefined,
        education: education !== undefined ? education : undefined,
        skills: skills !== undefined ? skills : undefined,
        interests: interests !== undefined ? interests : undefined,
        careerGoal: careerGoal !== undefined ? careerGoal : undefined,
      },
      include: { user: { select: { name: true, email: true } } }
    });

    return res.status(200).json({ status: 'success', message: 'Profile updated successfully.', profile: updatedProfile });
  } catch (err) {
    return res.status(500).json({ status: 'error', message: 'Failed to update profile.', details: err.message });
  }
};

module.exports = {
  getMyProfile,
  updateMyProfile
};
