const prisma = require('../config/db');
const { checkPeerMentorEligibility } = require('../utils/peerMentorEligibility');

/**
 * GET /api/peer-mentor/apply/eligibility
 */
const getEligibility = async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      include: {
        studentProfile: true,
        mentorProfile: {
          include: { peerApplications: true }
        }
      }
    });

    if (!user) {
      return res.status(404).json({ status: 'error', message: 'User not found' });
    }

    const eligibility = checkPeerMentorEligibility(user);
    let applicationStatus = null;

    if (user.mentorProfile && user.mentorProfile.mentorType === 'PEER' && user.mentorProfile.status === 'APPROVED') {
      applicationStatus = 'APPROVED';
    } else if (user.mentorProfile && user.mentorProfile.peerApplications && user.mentorProfile.peerApplications.length > 0) {
      // Find the most recent active application
      const activeApp = user.mentorProfile.peerApplications.find(app => ['PENDING', 'AI_SCREENED', 'UNDER_REVIEW'].includes(app.status));
      if (activeApp) {
        applicationStatus = activeApp.status;
      } else {
        const rejectedApp = user.mentorProfile.peerApplications.find(app => app.status === 'REJECTED');
        if (rejectedApp) applicationStatus = 'REJECTED';
      }
    }

    return res.status(200).json({
      status: 'success',
      data: {
        ...eligibility,
        applicationStatus
      }
    });
  } catch (err) {
    return res.status(500).json({ status: 'error', message: err.message });
  }
};

/**
 * POST /api/peer-mentor/apply
 */
const createApplication = async (req, res) => {
  try {
    const { eligibilityInfo } = req.body; // Using eligibilityInfo field as a JSON string or text to hold motivation/skills

    if (!eligibilityInfo) {
      return res.status(400).json({ status: 'error', message: 'Application details are required' });
    }

    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      include: {
        studentProfile: true,
        mentorProfile: {
          include: { peerApplications: true }
        }
      }
    });

    if (!user) {
      return res.status(404).json({ status: 'error', message: 'User not found' });
    }

    if (user.role !== 'STUDENT') {
      return res.status(403).json({ status: 'error', message: 'Only students can apply to be a peer mentor' });
    }

    const eligibility = checkPeerMentorEligibility(user);
    if (!eligibility.eligible) {
      return res.status(400).json({ status: 'error', message: 'You are not eligible to apply', reasons: eligibility.reasons });
    }

    // Check for existing application
    if (user.mentorProfile && user.mentorProfile.peerApplications) {
      const activeApp = user.mentorProfile.peerApplications.find(app => ['PENDING', 'AI_SCREENED', 'UNDER_REVIEW'].includes(app.status));
      if (activeApp) {
        return res.status(400).json({ status: 'error', message: 'You already have an active peer mentor application' });
      }
    }

    const result = await prisma.$transaction(async (tx) => {
      let mentorProfile = user.mentorProfile;

      // Create mentor profile if it doesn't exist
      if (!mentorProfile) {
        mentorProfile = await tx.mentorProfile.create({
          data: {
            userId: user.id,
            mentorType: 'PEER',
            status: 'PENDING'
          }
        });
      }

      // Create the peer application
      const application = await tx.peerMentorApplication.create({
        data: {
          mentorId: mentorProfile.id,
          eligibilityInfo: typeof eligibilityInfo === 'string' ? eligibilityInfo : JSON.stringify(eligibilityInfo),
          status: 'PENDING'
        }
      });

      return application;
    });

    return res.status(201).json({ status: 'success', data: result });
  } catch (err) {
    return res.status(500).json({ status: 'error', message: err.message });
  }
};

/**
 * GET /api/peer-mentor/application
 */
const getMyApplication = async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      include: {
        mentorProfile: {
          include: {
            peerApplications: {
              orderBy: { createdAt: 'desc' },
              take: 1
            }
          }
        }
      }
    });

    if (!user || !user.mentorProfile || !user.mentorProfile.peerApplications.length) {
      return res.status(404).json({ status: 'error', message: 'No peer mentor application found' });
    }

    const application = user.mentorProfile.peerApplications[0];
    return res.status(200).json({ status: 'success', data: application });
  } catch (err) {
    return res.status(500).json({ status: 'error', message: err.message });
  }
};

/**
 * PUT /api/peer-mentor/apply
 */
const updateApplication = async (req, res) => {
  try {
    const { eligibilityInfo } = req.body;

    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      include: {
        mentorProfile: {
          include: {
            peerApplications: {
              orderBy: { createdAt: 'desc' },
              take: 1
            }
          }
        }
      }
    });

    if (!user || !user.mentorProfile || !user.mentorProfile.peerApplications.length) {
      return res.status(404).json({ status: 'error', message: 'No peer mentor application found' });
    }

    const application = user.mentorProfile.peerApplications[0];

    if (application.status !== 'PENDING') {
      return res.status(400).json({ status: 'error', message: 'You can only edit applications in PENDING status' });
    }

    const updated = await prisma.peerMentorApplication.update({
      where: { id: application.id },
      data: {
        eligibilityInfo: typeof eligibilityInfo === 'string' ? eligibilityInfo : JSON.stringify(eligibilityInfo)
      }
    });

    return res.status(200).json({ status: 'success', data: updated });
  } catch (err) {
    return res.status(500).json({ status: 'error', message: err.message });
  }
};

module.exports = {
  getEligibility,
  createApplication,
  getMyApplication,
  updateApplication
};
