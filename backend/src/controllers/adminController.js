const prisma = require('../config/db');
const notificationService = require('../services/notificationService');
const { isMinor } = require('../utils/ageHelper');

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

/**
 * SUSPEND / ACTIVATE MENTOR OR USER
 * Existing endpoint handles Mentor status updates...
 * But if we want to suspend a generic user (student or mentor):
 */
const toggleUserSuspension = async (req, res) => {
  try {
    const { userId } = req.params;
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) return res.status(404).json({ status: 'error', message: 'User not found' });
    
    const updated = await prisma.user.update({
      where: { id: userId },
      data: { isSuspended: !user.isSuspended }
    });

    return res.status(200).json({ status: 'success', data: updated });
  } catch (err) {
    return res.status(500).json({ status: 'error', message: err.message });
  }
};

/**
 * COMPLAINTS
 */

const getComplaints = async (req, res) => {
  try {
    const complaints = await prisma.complaint.findMany({
      include: {
        reporter: { select: { id: true, name: true, role: true } },
        reportedUser: { select: { id: true, name: true, role: true } },
        session: { select: { id: true, scheduledAt: true } }
      },
      orderBy: { createdAt: 'desc' }
    });
    return res.status(200).json({ status: 'success', data: complaints });
  } catch (err) {
    return res.status(500).json({ status: 'error', message: err.message });
  }
};

const getComplaintById = async (req, res) => {
  try {
    const { id } = req.params;
    const complaint = await prisma.complaint.findUnique({
      where: { id },
      include: {
        reporter: { select: { id: true, name: true, role: true } },
        reportedUser: { select: { id: true, name: true, role: true } },
        session: { select: { id: true, scheduledAt: true, duration: true } }
      }
    });

    if (!complaint) return res.status(404).json({ status: 'error', message: 'Complaint not found' });
    return res.status(200).json({ status: 'success', data: complaint });
  } catch (err) {
    return res.status(500).json({ status: 'error', message: err.message });
  }
};

const updateComplaintStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, resolutionNote } = req.body;
    const adminId = req.user.id;

    const validStatuses = ['OPEN', 'UNDER_REVIEW', 'RESOLVED', 'DISMISSED'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ status: 'error', message: 'Invalid status' });
    }

    if (['RESOLVED', 'DISMISSED'].includes(status) && !resolutionNote) {
      return res.status(400).json({ status: 'error', message: 'Resolution note required when resolving or dismissing' });
    }

    const current = await prisma.complaint.findUnique({ where: { id } });
    if (!current) return res.status(404).json({ status: 'error', message: 'Complaint not found' });

    const updateData = { status, reviewedById: adminId };
    
    if (resolutionNote) updateData.resolution = resolutionNote;
    if (['RESOLVED', 'DISMISSED'].includes(status)) updateData.resolvedAt = new Date();

    const updated = await prisma.complaint.update({
      where: { id },
      data: updateData
    });

    // Notify Reporter
    let notifTitle, notifMsg;
    if (status === 'UNDER_REVIEW' && current.status === 'OPEN') {
      notifTitle = 'Complaint Under Review';
      notifMsg = 'Your complaint is now under review.';
    } else if (status === 'RESOLVED') {
      notifTitle = 'Complaint Resolved';
      notifMsg = 'Your complaint has been reviewed and resolved.';
    } else if (status === 'DISMISSED') {
      notifTitle = 'Complaint Dismissed';
      notifMsg = 'Your complaint has been reviewed and dismissed.';
    }

    if (notifTitle) {
      await notificationService.createNotification(
        current.reporterId,
        'COMPLAINT',
        notifTitle,
        notifMsg,
        current.id,
        'COMPLAINT'
      );
    }

    // Notify Reported User securely
    if (['UNDER_REVIEW', 'RESOLVED', 'DISMISSED'].includes(status) && current.status === 'OPEN') {
      await notificationService.createNotification(
        current.reportedUserId,
        'COMPLAINT',
        'Complaint Review Notice',
        'A complaint involving one of your mentoring interactions is under review.',
        current.id,
        'COMPLAINT'
      );
    }

    return res.status(200).json({ status: 'success', data: updated });
  } catch (err) {
    return res.status(500).json({ status: 'error', message: err.message });
  }
};

/**
 * GET /api/admin/peer-mentor-applications
 * Returns peer mentor applications with optional status filter.
 */
const getPeerMentorApplications = async (req, res) => {
  try {
    const { status } = req.query;

    let whereClause = {};
    if (status && status !== 'ALL') {
      whereClause.status = status;
    }

    const applications = await prisma.peerMentorApplication.findMany({
      where: whereClause,
      include: {
        mentor: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true,
                role: true,
                dateOfBirth: true,
                isActive: true,
                isSuspended: true,
                studentProfile: {
                  select: {
                    skills: true,
                    experienceLevel: true,
                    education: true,
                    onboardingCompleted: true
                  }
                }
              }
            }
          }
        },
        aiScreening: true
      },
      orderBy: { createdAt: 'desc' }
    });

    return res.status(200).json({ status: 'success', applications });
  } catch (err) {
    return res.status(500).json({ status: 'error', message: 'Failed to fetch peer mentor applications.', details: err.message });
  }
};

/**
 * GET /api/admin/peer-mentor-applications/:id
 * Returns detailed peer mentor application view.
 */
const getPeerMentorApplicationById = async (req, res) => {
  try {
    const application = await prisma.peerMentorApplication.findUnique({
      where: { id: req.params.id },
      include: {
        mentor: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true,
                role: true,
                dateOfBirth: true,
                isActive: true,
                isSuspended: true,
                createdAt: true,
                studentProfile: {
                  select: {
                    skills: true,
                    interests: true,
                    careerGoal: true,
                    education: true,
                    experienceLevel: true,
                    preferredLearningStyle: true,
                    preferredLanguage: true,
                    studyAvailability: true,
                    onboardingCompleted: true
                  }
                }
              }
            }
          }
        },
        aiScreening: true
      }
    });

    if (!application) {
      return res.status(404).json({ status: 'error', message: 'Peer mentor application not found.' });
    }

    return res.status(200).json({ status: 'success', application });
  } catch (err) {
    return res.status(500).json({ status: 'error', message: 'Failed to fetch peer mentor application.', details: err.message });
  }
};

/**
 * PUT /api/admin/peer-mentor-applications/:id/status
 * Updates peer mentor application status with lifecycle enforcement.
 */
const updatePeerMentorApplicationStatus = async (req, res) => {
  try {
    const { status, reviewNotes, rejectionReason } = req.body;

    const validStatuses = ['UNDER_REVIEW', 'APPROVED', 'REJECTED', 'SUSPENDED'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ status: 'error', message: `Invalid status. Must be one of: ${validStatuses.join(', ')}` });
    }

    if ((status === 'REJECTED' || status === 'SUSPENDED') && !rejectionReason) {
      return res.status(400).json({ status: 'error', message: 'Reason is required when rejecting or suspending.' });
    }

    const application = await prisma.peerMentorApplication.findUnique({
      where: { id: req.params.id },
      include: {
        mentor: {
          include: {
            user: {
              include: { studentProfile: true }
            }
          }
        }
      }
    });

    if (!application) {
      return res.status(404).json({ status: 'error', message: 'Peer mentor application not found.' });
    }

    // Status transition rules
    const current = application.status;
    const isApproval = status === 'APPROVED';
    const isRejection = status === 'REJECTED';
    const isSuspension = status === 'SUSPENDED';

    if (status === 'UNDER_REVIEW' && current !== 'AI_SCREENED' && current !== 'PENDING') {
      return res.status(400).json({ status: 'error', message: 'Only PENDING or AI_SCREENED applications can move to UNDER_REVIEW.' });
    }
    if (isApproval && current !== 'UNDER_REVIEW') {
      return res.status(400).json({ status: 'error', message: 'Only UNDER_REVIEW applications can be APPROVED.' });
    }
    if (isRejection && current !== 'UNDER_REVIEW') {
      return res.status(400).json({ status: 'error', message: 'Only UNDER_REVIEW applications can be REJECTED.' });
    }
    if (isSuspension && current !== 'APPROVED') {
      return res.status(400).json({ status: 'error', message: 'Only APPROVED peer mentors can be SUSPENDED.' });
    }

    const applicantUser = application.mentor.user;

    // Approval pre-checks
    if (isApproval) {
      if (applicantUser.role !== 'STUDENT') {
        return res.status(400).json({ status: 'error', message: 'Applicant must have STUDENT role for peer mentor approval.' });
      }
      if (!applicantUser.studentProfile) {
        return res.status(400).json({ status: 'error', message: 'Applicant must have a student profile.' });
      }
      if (!applicantUser.studentProfile.onboardingCompleted) {
        return res.status(400).json({ status: 'error', message: 'Applicant must have completed onboarding.' });
      }
      if (!applicantUser.isActive) {
        return res.status(400).json({ status: 'error', message: 'Applicant account must be active.' });
      }
      if (applicantUser.isSuspended) {
        return res.status(400).json({ status: 'error', message: 'Applicant account is suspended.' });
      }
      if (applicantUser.dateOfBirth && isMinor(new Date(applicantUser.dateOfBirth))) {
        return res.status(400).json({ status: 'error', message: 'Applicant must be at least 18 years old.' });
      }
    }

    const updatedApp = await prisma.$transaction(async (tx) => {
      const updated = await tx.peerMentorApplication.update({
        where: { id: application.id },
        data: {
          status,
          reviewNotes: reviewNotes !== undefined ? reviewNotes : application.reviewNotes,
          rejectionReason: (isRejection || isSuspension) ? rejectionReason : application.rejectionReason,
          reviewedAt: (isApproval || isRejection) ? new Date() : application.reviewedAt,
          reviewerId: req.user.id
        }
      });

      if (isApproval) {
        await tx.mentorProfile.update({
          where: { id: application.mentorId },
          data: {
            status: 'APPROVED',
            mentorType: 'PEER',
            verifiedAt: new Date()
          }
        });
        // User.role stays STUDENT — CRITICAL
      } else if (isRejection) {
        await tx.mentorProfile.update({
          where: { id: application.mentorId },
          data: { status: 'REJECTED' }
        });
      } else if (isSuspension) {
        await tx.mentorProfile.update({
          where: { id: application.mentorId },
          data: { status: 'REJECTED' }
        });
      }

      return updated;
    });

    // Send notification (outside transaction — non-blocking)
    try {
      let notifTitle, notifMsg;
      if (isApproval) {
        notifTitle = 'Peer Mentor Application Approved';
        notifMsg = 'Congratulations! Your peer mentor application has been approved. You can now mentor other learners.';
      } else if (isRejection) {
        notifTitle = 'Peer Mentor Application Rejected';
        notifMsg = `Your peer mentor application has been rejected. Reason: ${rejectionReason}`;
      } else if (isSuspension) {
        notifTitle = 'Peer Mentor Status Suspended';
        notifMsg = `Your peer mentor status has been suspended. Reason: ${rejectionReason}`;
      } else if (status === 'UNDER_REVIEW') {
        notifTitle = 'Peer Mentor Application Under Review';
        notifMsg = 'Your peer mentor application is now under review by an administrator.';
      }

      if (notifTitle) {
        await notificationService.createNotification(
          applicantUser.id,
          'GENERAL',
          notifTitle,
          notifMsg,
          application.id,
          'PEER_MENTOR_APPLICATION'
        );
      }
    } catch (notifErr) {
      console.error('Failed to send peer mentor notification:', notifErr.message);
    }

    return res.status(200).json({ status: 'success', message: 'Peer mentor application status updated.', application: updatedApp });
  } catch (err) {
    return res.status(500).json({ status: 'error', message: 'Failed to update peer mentor application status.', details: err.message });
  }
};

module.exports = {
  getDashboardStats,
  getUsers,
  getMentors,
  getMentorships,
  getMentorApplications,
  getMentorApplicationById,
  updateMentorApplicationStatus,
  getComplaints,
  getComplaintById,
  updateComplaintStatus,
  toggleUserSuspension,
  getPeerMentorApplications,
  getPeerMentorApplicationById,
  updatePeerMentorApplicationStatus
};
