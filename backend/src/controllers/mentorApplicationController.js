const prisma = require('../config/db');

/**
 * Helper to ensure the mentor profile exists
 */
const getMentorProfileId = async (userId) => {
  const profile = await prisma.mentorProfile.findUnique({ where: { userId } });
  if (!profile) {
    throw new Error('Mentor profile not found.');
  }
  return profile.id;
};

/**
 * GET /api/mentor-applications/me
 * Retrieves the current mentor application for the authenticated mentor.
 */
const getMyApplication = async (req, res) => {
  try {
    const mentorId = await getMentorProfileId(req.user.id);

    const application = await prisma.mentorApplication.findFirst({
      where: { mentorId },
      orderBy: { createdAt: 'desc' },
      include: {
        credentials: true,
        aiScreening: true
      }
    });

    if (!application) {
      return res.status(404).json({ status: 'error', message: 'No application found.' });
    }

    return res.status(200).json({ status: 'success', application });
  } catch (err) {
    return res.status(500).json({ status: 'error', message: 'Failed to fetch application.', details: err.message });
  }
};

/**
 * POST /api/mentor-applications
 * Creates a new mentor application if none exists or previous was rejected.
 */
const createApplication = async (req, res) => {
  try {
    const mentorId = await getMentorProfileId(req.user.id);

    const existingApp = await prisma.mentorApplication.findFirst({
      where: { mentorId },
      orderBy: { createdAt: 'desc' }
    });

    if (existingApp && ['PENDING', 'AI_SCREENED', 'UNDER_REVIEW', 'APPROVED'].includes(existingApp.status)) {
      return res.status(400).json({ status: 'error', message: 'You already have an active application.' });
    }

    const {
      professionalSummary,
      expertise,
      experience,
      teachingExperience,
      linkedinUrl,
      languages,
      proposedSessionFee
    } = req.body;

    const application = await prisma.mentorApplication.create({
      data: {
        mentorId,
        status: 'PENDING',
        professionalSummary,
        expertise,
        experience: experience ? parseInt(experience, 10) : undefined,
        teachingExperience: teachingExperience ? parseInt(teachingExperience, 10) : undefined,
        linkedinUrl,
        languages,
        proposedSessionFee: proposedSessionFee ? parseFloat(proposedSessionFee) : undefined
      }
    });

    return res.status(201).json({ status: 'success', message: 'Application created successfully.', application });
  } catch (err) {
    return res.status(500).json({ status: 'error', message: 'Failed to create application.', details: err.message });
  }
};

/**
 * PUT /api/mentor-applications/me
 * Updates the current mentor application (only if PENDING).
 */
const updateMyApplication = async (req, res) => {
  try {
    const mentorId = await getMentorProfileId(req.user.id);

    const application = await prisma.mentorApplication.findFirst({
      where: { mentorId },
      orderBy: { createdAt: 'desc' }
    });

    if (!application) {
      return res.status(404).json({ status: 'error', message: 'No application found.' });
    }

    if (application.status !== 'PENDING') {
      return res.status(400).json({ status: 'error', message: `Application cannot be edited while in ${application.status} status.` });
    }

    const {
      professionalSummary,
      expertise,
      experience,
      teachingExperience,
      linkedinUrl,
      languages,
      proposedSessionFee
    } = req.body;

    const updatedApp = await prisma.mentorApplication.update({
      where: { id: application.id },
      data: {
        professionalSummary: professionalSummary !== undefined ? professionalSummary : undefined,
        expertise: expertise !== undefined ? expertise : undefined,
        experience: experience !== undefined ? parseInt(experience, 10) : undefined,
        teachingExperience: teachingExperience !== undefined ? parseInt(teachingExperience, 10) : undefined,
        linkedinUrl: linkedinUrl !== undefined ? linkedinUrl : undefined,
        languages: languages !== undefined ? languages : undefined,
        proposedSessionFee: proposedSessionFee !== undefined ? parseFloat(proposedSessionFee) : undefined
      }
    });

    return res.status(200).json({ status: 'success', message: 'Application updated successfully.', application: updatedApp });
  } catch (err) {
    return res.status(500).json({ status: 'error', message: 'Failed to update application.', details: err.message });
  }
};

module.exports = {
  getMyApplication,
  createApplication,
  updateMyApplication
};
