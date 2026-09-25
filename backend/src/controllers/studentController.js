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

/**
 * PUT /api/students/onboarding
 * Complete the authenticated student's onboarding profile.
 */
const completeOnboarding = async (req, res) => {
  try {
    if (req.user.role !== 'STUDENT') {
      return res.status(403).json({ status: 'error', message: 'Only STUDENT users can complete student onboarding.' });
    }

    const {
      education,
      skills,
      interests,
      experienceLevel,
      careerGoal,
      preferredLearningStyle,
      preferredLanguage,
      budget,
      studyAvailability
    } = req.body;

    const updatedProfile = await prisma.studentProfile.update({
      where: { userId: req.user.id },
      data: {
        education,
        skills,
        interests,
        experienceLevel,
        careerGoal,
        preferredLearningStyle,
        preferredLanguage,
        budget: budget !== undefined ? parseFloat(budget) : null,
        studyAvailability,
        onboardingCompleted: true
      },
      include: { user: { select: { name: true, email: true } } }
    });

    return res.status(200).json({ status: 'success', message: 'Onboarding completed successfully.', profile: updatedProfile });
  } catch (err) {
    return res.status(500).json({ status: 'error', message: 'Failed to complete onboarding.', details: err.message });
  }
};

const { isMinor } = require('../utils/ageHelper');

/**
 * POST /api/students/link-guardian
 * Links a Guardian to the minor student by the guardian's email.
 */
const linkGuardian = async (req, res) => {
  try {
    if (req.user.role !== 'STUDENT') {
      return res.status(403).json({ status: 'error', message: 'Only students can link guardians.' });
    }

    const { guardianEmail, relationship } = req.body;
    if (!guardianEmail || !relationship) {
      return res.status(400).json({ status: 'error', message: 'guardianEmail and relationship are required.' });
    }

    const learner = await prisma.user.findUnique({ where: { id: req.user.id } });
    if (!learner || !learner.dateOfBirth) {
      return res.status(400).json({ status: 'error', message: 'Date of birth is required to link a guardian.' });
    }

    if (!isMinor(learner.dateOfBirth)) {
      return res.status(400).json({ status: 'error', message: 'Adult learners do not require a guardian.' });
    }

    const guardianUser = await prisma.user.findUnique({
      where: { email: guardianEmail.toLowerCase().trim() }
    });

    if (!guardianUser || guardianUser.role !== 'GUARDIAN') {
      return res.status(404).json({ status: 'error', message: 'Guardian account not found. Ensure they have registered as a GUARDIAN.' });
    }

    // Check if link already exists
    const existing = await prisma.guardian.findUnique({
      where: {
        userId_minorStudentId: {
          userId: guardianUser.id,
          minorStudentId: learner.id
        }
      }
    });

    if (existing) {
      return res.status(400).json({ status: 'error', message: 'Guardian is already linked.' });
    }

    const relation = await prisma.guardian.create({
      data: {
        userId: guardianUser.id,
        minorStudentId: learner.id,
        relationship,
        isMonitoringActive: true
      }
    });

    return res.status(201).json({ status: 'success', message: 'Guardian linked successfully.', relation });
  } catch (err) {
    return res.status(500).json({ status: 'error', message: 'Failed to link guardian.', details: err.message });
  }
};

module.exports = {
  getMyProfile,
  updateMyProfile,
  completeOnboarding,
  linkGuardian
};
