const prisma = require('../config/db');
const aiService = require('../services/aiService');
const { isMinor } = require('../utils/ageHelper');

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

    const user = await prisma.user.findUnique({ where: { id: req.user.id } });
    if (user.dateOfBirth && isMinor(user.dateOfBirth)) {
      return res.status(400).json({ status: 'error', message: 'You must be at least 18 years old to apply as a professional mentor.' });
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

/**
 * POST /api/mentor-applications/me/screen
 * Runs AI preliminary screening on the mentor's application.
 */
const screenApplication = async (req, res) => {
  try {
    const mentorId = await getMentorProfileId(req.user.id);

    const application = await prisma.mentorApplication.findFirst({
      where: { mentorId },
      orderBy: { createdAt: 'desc' },
      include: { credentials: true }
    });

    if (!application) {
      return res.status(404).json({ status: 'error', message: 'No application found to screen.' });
    }

    if (application.status !== 'PENDING' && application.status !== 'AI_SCREENED') {
      return res.status(400).json({ status: 'error', message: `Cannot run screening when status is ${application.status}.` });
    }

    // Call AI
    const prompt = aiService.buildScreeningPrompt(application);
    const rawResponse = await aiService.generateText(prompt);

    // Extract JSON from raw response
    let jsonResult;
    try {
      const match = rawResponse.match(/\{[\s\S]*\}/);
      if (match) {
        jsonResult = JSON.parse(match[0]);
      } else {
        throw new Error('No valid JSON block found in AI response.');
      }
    } catch (parseError) {
      return res.status(502).json({ status: 'error', message: 'Failed to parse AI screening response.', details: parseError.message });
    }

    // Transaction to update or create screening result and update app status
    const screeningResult = await prisma.$transaction(async (tx) => {
      const existingScreening = await tx.aIScreeningResult.findUnique({
        where: { applicationId: application.id }
      });

      let sr;
      const data = {
        screeningStatus: 'COMPLETED',
        recommendation: jsonResult.recommendation || 'NEEDS_MORE_INFORMATION',
        structuredFindings: {
          overallAssessment: jsonResult.overallAssessment,
          profileCompleteness: jsonResult.profileCompleteness,
          expertiseRelevance: jsonResult.expertiseRelevance,
          experienceAssessment: jsonResult.experienceAssessment,
          teachingAssessment: jsonResult.teachingAssessment,
          credentialAssessment: jsonResult.credentialAssessment,
          strengths: jsonResult.strengths || []
        },
        riskFlags: {
          concerns: jsonResult.concerns || [],
          verificationItems: jsonResult.verificationItems || []
        },
        modelInfo: aiService.modelName
      };

      if (existingScreening) {
        sr = await tx.aIScreeningResult.update({
          where: { id: existingScreening.id },
          data
        });
      } else {
        sr = await tx.aIScreeningResult.create({
          data: {
            ...data,
            applicationId: application.id
          }
        });
      }

      await tx.mentorApplication.update({
        where: { id: application.id },
        data: { status: 'AI_SCREENED' }
      });

      return sr;
    });

    return res.status(200).json({ status: 'success', message: 'AI Screening completed successfully.', screeningResult });
  } catch (err) {
    return res.status(500).json({ status: 'error', message: 'Failed to run AI screening.', details: err.message });
  }
};

module.exports = {
  getMyApplication,
  createApplication,
  updateMyApplication,
  screenApplication
};
