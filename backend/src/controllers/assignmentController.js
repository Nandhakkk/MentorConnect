const prisma = require('../config/db');
const notificationService = require('../services/notificationService');

/**
 * CREATE ASSIGNMENT
 * POST /api/assignments
 */
const createAssignment = async (req, res) => {
  try {
    const mentorUserId = req.user.id;
    const { sessionId, title, description, dueDate, resourceUrl } = req.body;

    if (!sessionId || !title || !description || !dueDate) {
      return res.status(400).json({ status: 'error', message: 'Missing required fields' });
    }

    const dueDateObj = new Date(dueDate);
    if (isNaN(dueDateObj.getTime())) {
      return res.status(400).json({ status: 'error', message: 'Invalid due date' });
    }

    // Optional URL validation
    if (resourceUrl) {
      try {
        new URL(resourceUrl);
      } catch (e) {
        return res.status(400).json({ status: 'error', message: 'Invalid resource URL' });
      }
    }

    // Verify session belongs to mentor
    const session = await prisma.session.findUnique({
      where: { id: sessionId },
      include: {
        mentorship: {
          include: {
            mentor: true,
            student: { include: { user: true } }
          }
        }
      }
    });

    if (!session) {
      return res.status(404).json({ status: 'error', message: 'Session not found' });
    }

    if (session.mentorship.mentor.userId !== mentorUserId) {
      return res.status(403).json({ status: 'error', message: 'Not authorized to create assignment for this session' });
    }

    const assignment = await prisma.assignment.create({
      data: {
        sessionId,
        mentorshipId: session.mentorshipId,
        mentorId: session.mentorship.mentorId,
        studentId: session.mentorship.studentId,
        title,
        description,
        instructions: resourceUrl || null, // Storing resource URL in instructions if we don't have a dedicated field, though schema has instructions. Let's use instructions to store resourceUrl.
        dueDate: dueDateObj,
        status: 'ASSIGNED'
      }
    });

    // Notify Student
    await notificationService.createNotification(
      session.mentorship.student.userId,
      'ASSIGNMENT',
      'New Assignment',
      `You have a new assignment from your mentor: ${title}.`,
      assignment.id,
      'ASSIGNMENT'
    );

    return res.status(201).json({ status: 'success', data: assignment });
  } catch (err) {
    return res.status(500).json({ status: 'error', message: err.message });
  }
};

/**
 * LIST MENTOR ASSIGNMENTS
 * GET /api/assignments/mentor
 */
const getMentorAssignments = async (req, res) => {
  try {
    const mentorUserId = req.user.id;
    
    const mentorProfile = await prisma.mentorProfile.findUnique({
      where: { userId: mentorUserId }
    });

    if (!mentorProfile) {
      return res.status(404).json({ status: 'error', message: 'Mentor profile not found' });
    }

    const assignments = await prisma.assignment.findMany({
      where: { mentorId: mentorProfile.id },
      include: {
        student: { include: { user: true } },
        session: true,
        submissions: {
          orderBy: { submittedAt: 'desc' },
          take: 1
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    return res.status(200).json({ status: 'success', data: assignments });
  } catch (err) {
    return res.status(500).json({ status: 'error', message: err.message });
  }
};

/**
 * LIST STUDENT ASSIGNMENTS
 * GET /api/assignments/student
 */
const getStudentAssignments = async (req, res) => {
  try {
    const studentUserId = req.user.id;

    const studentProfile = await prisma.studentProfile.findUnique({
      where: { userId: studentUserId }
    });

    if (!studentProfile) {
      return res.status(404).json({ status: 'error', message: 'Student profile not found' });
    }

    const assignments = await prisma.assignment.findMany({
      where: { studentId: studentProfile.id },
      include: {
        mentor: { include: { user: true } },
        session: true,
        submissions: {
          orderBy: { submittedAt: 'desc' },
          take: 1
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    return res.status(200).json({ status: 'success', data: assignments });
  } catch (err) {
    return res.status(500).json({ status: 'error', message: err.message });
  }
};

/**
 * GET ASSIGNMENT DETAILS
 * GET /api/assignments/:id
 */
const getAssignmentDetails = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    const userRole = req.user.role;

    const assignment = await prisma.assignment.findUnique({
      where: { id },
      include: {
        mentor: { include: { user: true } },
        student: { include: { user: true } },
        session: true,
        submissions: {
          orderBy: { submittedAt: 'desc' }
        }
      }
    });

    if (!assignment) {
      return res.status(404).json({ status: 'error', message: 'Assignment not found' });
    }

    // Verify ownership
    if (userRole === 'STUDENT' && assignment.student.userId !== userId) {
      return res.status(403).json({ status: 'error', message: 'Not authorized' });
    }
    if (userRole === 'MENTOR' && assignment.mentor.userId !== userId) {
      return res.status(403).json({ status: 'error', message: 'Not authorized' });
    }

    return res.status(200).json({ status: 'success', data: assignment });
  } catch (err) {
    return res.status(500).json({ status: 'error', message: err.message });
  }
};

/**
 * SUBMIT ASSIGNMENT
 * POST /api/assignments/:id/submission
 */
const submitAssignment = async (req, res) => {
  try {
    const { id } = req.params;
    const studentUserId = req.user.id;
    const { content, resourceUrl } = req.body;

    if (!content) {
      return res.status(400).json({ status: 'error', message: 'Submission content required' });
    }
    if (resourceUrl) {
      try { new URL(resourceUrl); } catch(e) { return res.status(400).json({ status: 'error', message: 'Invalid URL' }); }
    }

    const assignment = await prisma.assignment.findUnique({
      where: { id },
      include: {
        student: true,
        mentor: { include: { user: true } }
      }
    });

    if (!assignment) {
      return res.status(404).json({ status: 'error', message: 'Assignment not found' });
    }
    if (assignment.student.userId !== studentUserId) {
      return res.status(403).json({ status: 'error', message: 'Not authorized' });
    }
    if (assignment.status === 'REVIEWED') {
      return res.status(400).json({ status: 'error', message: 'Assignment is already reviewed' });
    }

    let isLate = false;
    if (assignment.dueDate && new Date() > new Date(assignment.dueDate)) {
      isLate = true;
    }

    const submissionStatus = isLate ? 'LATE' : 'SUBMITTED';

    const submission = await prisma.$transaction(async (tx) => {
      const sub = await tx.assignmentSubmission.create({
        data: {
          assignmentId: id,
          studentId: assignment.studentId,
          content,
          fileReference: resourceUrl || null,
          status: submissionStatus
        }
      });

      await tx.assignment.update({
        where: { id },
        data: { status: 'SUBMITTED' }
      });

      return sub;
    });

    // Notify mentor
    await notificationService.createNotification(
      assignment.mentor.userId,
      'ASSIGNMENT',
      'Assignment Submitted',
      `A student submitted the assignment: ${assignment.title}.`,
      assignment.id,
      'ASSIGNMENT'
    );

    return res.status(201).json({ status: 'success', data: submission });
  } catch (err) {
    return res.status(500).json({ status: 'error', message: err.message });
  }
};

/**
 * REVIEW ASSIGNMENT
 * PUT /api/assignments/:id/review
 */
const reviewAssignment = async (req, res) => {
  try {
    const { id } = req.params;
    const mentorUserId = req.user.id;
    const { feedback, action } = req.body;

    if (!feedback || !action) {
      return res.status(400).json({ status: 'error', message: 'Feedback and action required' });
    }
    if (!['REVIEW', 'RETURN'].includes(action)) {
      return res.status(400).json({ status: 'error', message: 'Action must be REVIEW or RETURN' });
    }

    const assignment = await prisma.assignment.findUnique({
      where: { id },
      include: {
        mentor: true,
        student: { include: { user: true } },
        submissions: {
          orderBy: { submittedAt: 'desc' },
          take: 1
        }
      }
    });

    if (!assignment) {
      return res.status(404).json({ status: 'error', message: 'Assignment not found' });
    }
    if (assignment.mentor.userId !== mentorUserId) {
      return res.status(403).json({ status: 'error', message: 'Not authorized' });
    }
    
    if (assignment.submissions.length === 0) {
      return res.status(400).json({ status: 'error', message: 'No submission found to review' });
    }

    const latestSubmissionId = assignment.submissions[0].id;
    
    const newAssignmentStatus = action === 'REVIEW' ? 'REVIEWED' : 'RETURNED';
    const newSubmissionStatus = 'REVIEWED'; // Both logic indicate it has been reviewed

    await prisma.$transaction([
      prisma.assignmentSubmission.update({
        where: { id: latestSubmissionId },
        data: {
          feedback,
          status: newSubmissionStatus,
          reviewedAt: new Date()
        }
      }),
      prisma.assignment.update({
        where: { id },
        data: { status: newAssignmentStatus }
      })
    ]);

    // Notify student
    const title = action === 'REVIEW' ? 'Assignment Reviewed' : 'Assignment Needs Revision';
    const msg = action === 'REVIEW'
      ? `Your mentor reviewed the assignment: ${assignment.title}. Check the feedback.`
      : `Your mentor returned ${assignment.title} with feedback. Please review and resubmit.`;

    await notificationService.createNotification(
      assignment.student.userId,
      'ASSIGNMENT',
      title,
      msg,
      assignment.id,
      'ASSIGNMENT'
    );

    return res.status(200).json({ status: 'success', message: 'Review saved successfully' });
  } catch (err) {
    return res.status(500).json({ status: 'error', message: err.message });
  }
};

module.exports = {
  createAssignment,
  getMentorAssignments,
  getStudentAssignments,
  getAssignmentDetails,
  submitAssignment,
  reviewAssignment
};
