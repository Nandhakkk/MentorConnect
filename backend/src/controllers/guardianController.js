const prisma = require('../config/db');

/**
 * GET /api/guardian/learners
 * Get all learners linked to this guardian.
 */
const getLinkedLearners = async (req, res) => {
  try {
    const guardianId = req.user.id;

    const relations = await prisma.guardian.findMany({
      where: { userId: guardianId, isMonitoringActive: true },
      include: {
        learner: {
          select: {
            id: true,
            name: true,
            email: true,
            dateOfBirth: true,
            studentProfile: true
          }
        }
      }
    });

    return res.status(200).json({
      status: 'success',
      learners: relations.map(r => ({ ...r.learner, relationship: r.relationship }))
    });
  } catch (err) {
    return res.status(500).json({ status: 'error', message: 'Failed to fetch linked learners.', details: err.message });
  }
};

/**
 * Helper to verify guardian has access to this learner
 */
const verifyGuardianAccess = async (guardianUserId, learnerId) => {
  const relation = await prisma.guardian.findUnique({
    where: {
      userId_minorStudentId: {
        userId: guardianUserId,
        minorStudentId: learnerId
      }
    }
  });
  return relation && relation.isMonitoringActive;
};

/**
 * GET /api/guardian/sessions/:learnerId
 * Get upcoming/past sessions for a linked learner.
 */
const getLearnerSessions = async (req, res) => {
  try {
    const { learnerId } = req.params;
    const hasAccess = await verifyGuardianAccess(req.user.id, learnerId);
    if (!hasAccess) {
      return res.status(403).json({ status: 'error', message: 'Unauthorized access to this learner.' });
    }

    const sessions = await prisma.session.findMany({
      where: {
        mentorship: {
          studentId: (await prisma.studentProfile.findUnique({ where: { userId: learnerId } })).id
        }
      },
      include: {
        mentorship: {
          include: {
            mentor: {
              include: { user: { select: { name: true } } }
            }
          }
        },
        payment: {
          select: { amount: true, status: true }
        }
      },
      orderBy: { scheduledAt: 'desc' }
    });

    return res.status(200).json({ status: 'success', sessions });
  } catch (err) {
    return res.status(500).json({ status: 'error', message: 'Failed to fetch sessions.', details: err.message });
  }
};

/**
 * GET /api/guardian/progress/:learnerId
 * Get high-level progress (goals, milestones, assignments) for a linked learner.
 */
const getLearnerProgress = async (req, res) => {
  try {
    const { learnerId } = req.params;
    const hasAccess = await verifyGuardianAccess(req.user.id, learnerId);
    if (!hasAccess) {
      return res.status(403).json({ status: 'error', message: 'Unauthorized access to this learner.' });
    }

    const studentProfile = await prisma.studentProfile.findUnique({ where: { userId: learnerId } });

    const goals = await prisma.goal.findMany({
      where: { studentId: studentProfile.id },
      include: { milestones: true }
    });

    const assignments = await prisma.assignment.findMany({
      where: { studentId: studentProfile.id },
      include: { submissions: true }
    });

    return res.status(200).json({
      status: 'success',
      progress: {
        goals,
        assignments
      }
    });
  } catch (err) {
    return res.status(500).json({ status: 'error', message: 'Failed to fetch progress.', details: err.message });
  }
};

module.exports = {
  getLinkedLearners,
  getLearnerSessions,
  getLearnerProgress
};
