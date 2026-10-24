const prisma = require('../config/db');
const { checkPeerMentorEligibility } = require('../utils/peerMentorEligibility');
const aiService = require('../services/aiService');

const peerMentorUserIncludes = {
  studentProfile: {
    include: {
      goals: {
        select: { id: true, title: true, status: true, createdAt: true }
      },
      mentorships: {
        include: {
          sessions: {
            include: {
              payment: {
                include: {
                  refunds: {
                    select: { id: true, status: true }
                  }
                }
              }
            }
          }
        }
      },
      assignments: {
        include: {
          submissions: {
            select: { id: true, status: true, submittedAt: true }
          }
        }
      }
    }
  },
  mentorProfile: {
    include: {
      peerApplications: {
        orderBy: { createdAt: 'desc' },
        include: { aiScreening: true }
      }
    }
  },
  complaintsReceived: {
    select: { id: true, status: true, category: true, createdAt: true }
  }
};

/**
 * GET /api/peer-mentor/apply/eligibility
 */
const getEligibility = async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      include: peerMentorUserIncludes
    });

    if (!user) {
      return res.status(404).json({ status: 'error', message: 'User not found' });
    }

    const eligibility = checkPeerMentorEligibility(user);
    let applicationStatus = null;
    let latestApplication = null;

    if (user.mentorProfile && user.mentorProfile.mentorType === 'PEER' && user.mentorProfile.status === 'APPROVED') {
      applicationStatus = 'APPROVED';
    }

    if (user.mentorProfile && user.mentorProfile.peerApplications && user.mentorProfile.peerApplications.length > 0) {
      latestApplication = user.mentorProfile.peerApplications[0];
      // Find the most recent active application
      const activeApp = user.mentorProfile.peerApplications.find(app => ['PENDING', 'AI_SCREENED', 'UNDER_REVIEW'].includes(app.status));
      if (activeApp) {
        applicationStatus = activeApp.status;
        latestApplication = activeApp;
      } else if (!applicationStatus) {
        const rejectedApp = user.mentorProfile.peerApplications.find(app => app.status === 'REJECTED');
        if (rejectedApp) {
          applicationStatus = 'REJECTED';
          latestApplication = rejectedApp;
        }
      }
    }

    return res.status(200).json({
      status: 'success',
      data: {
        ...eligibility,
        applicationStatus,
        latestApplication
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
      return res.status(400).json({ status: 'error', message: 'Application details (motivation, topics, and experience) are required' });
    }

    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      include: peerMentorUserIncludes
    });

    if (!user) {
      return res.status(404).json({ status: 'error', message: 'User not found' });
    }

    if (user.role !== 'STUDENT') {
      return res.status(403).json({ status: 'error', message: 'Only registered students can apply to become a peer mentor' });
    }

    // Authoritative Server-Side Eligibility Enforcement
    const eligibility = checkPeerMentorEligibility(user);
    if (!eligibility.eligible) {
      return res.status(400).json({
        status: 'error',
        message: 'You are not yet eligible to apply as a Peer Mentor.',
        reasons: eligibility.reasons,
        criteria: eligibility.criteria,
        stats: eligibility.stats
      });
    }

    // Check for existing active application
    if (user.mentorProfile && user.mentorProfile.peerApplications) {
      const activeApp = user.mentorProfile.peerApplications.find(app => ['PENDING', 'AI_SCREENED', 'UNDER_REVIEW'].includes(app.status));
      if (activeApp) {
        return res.status(400).json({ status: 'error', message: 'You already have an active peer mentor application in progress.' });
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
              take: 1,
              include: { aiScreening: true }
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
  // omitted unchanged function body...
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

/**
 * POST /api/peer-mentor/apply/screen
 */
const screenApplication = async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      include: {
        studentProfile: true,
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

    if (!user || !user.studentProfile || !user.mentorProfile || !user.mentorProfile.peerApplications.length) {
      return res.status(404).json({ status: 'error', message: 'No peer mentor application found' });
    }

    const application = user.mentorProfile.peerApplications[0];

    if (application.status !== 'PENDING' && application.status !== 'AI_SCREENED') {
      return res.status(400).json({ status: 'error', message: `Cannot run screening when status is ${application.status}.` });
    }

    const mentorScreeningService = require('../services/mentorScreeningService');
    const result = await mentorScreeningService.screenPeerMentorApplication(application.id);

    return res.status(200).json({
      status: 'success',
      message: result.outcome === 'AUTO_REJECTED'
        ? 'Application evaluated: Ineligible on published objective criteria.'
        : result.outcome === 'ELIGIBLE'
          ? 'Application pre-screening complete: Eligible for administrative approval.'
          : 'Application pre-screening complete: Queued for manual administrator review.',
      outcome: result.outcome,
      screeningResult: result.screeningResult,
      application: result.application,
      failedCriteria: result.failedCriteria || null
    });
  } catch (err) {
    return res.status(500).json({ status: 'error', message: 'Failed to run peer screening.', details: err.message });
  }
};

module.exports = {
  getEligibility,
  createApplication,
  getMyApplication,
  updateApplication,
  screenApplication
};
