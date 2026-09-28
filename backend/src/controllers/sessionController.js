const prisma = require('../config/db');
const notificationService = require('../services/notificationService');
const { isApprovedMentor, isMentorParticipant, isStudentParticipant } = require('../utils/mentorCapability');

/**
 * Helper to get the day of the week from a date object
 */
const getDayOfWeekString = (date) => {
  const days = ['SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'];
  return days[date.getDay()];
};

/**
 * Helper to parse "HH:mm" to minutes since midnight
 */
const parseTime = (timeStr) => {
  const [hours, minutes] = timeStr.split(':').map(Number);
  return hours * 60 + minutes;
};

/**
 * GET /api/sessions
 * Returns sessions for the authenticated user based on their profile.
 * Peer mentors with role=STUDENT can see sessions from both learner and mentor perspectives.
 */
const getSessions = async (req, res) => {
  try {
    const { role } = req.user;
    
    let whereClause = {};
    if (role === 'STUDENT') {
      const studentProfile = req.user.studentProfile;
      const mentorProfile = req.user.mentorProfile;
      
      if (!studentProfile && !mentorProfile) {
        return res.status(403).json({ status: 'error', message: 'Profile required.' });
      }

      // For peer mentors (STUDENT role + approved mentorProfile), show sessions from both sides
      if (mentorProfile && isApprovedMentor(req.user)) {
        whereClause = {
          OR: [
            { mentorship: { studentId: studentProfile?.id } },
            { mentorship: { mentorId: mentorProfile.id } }
          ].filter(c => c.mentorship.studentId || c.mentorship.mentorId)
        };
        // Remove nulls
        whereClause.OR = whereClause.OR.filter(c => {
          const val = c.mentorship.studentId || c.mentorship.mentorId;
          return val != null;
        });
        if (whereClause.OR.length === 0) {
          return res.status(403).json({ status: 'error', message: 'Profile required.' });
        }
      } else if (studentProfile) {
        whereClause = { mentorship: { studentId: studentProfile.id } };
      } else {
        return res.status(403).json({ status: 'error', message: 'Profile required.' });
      }
    } else if (role === 'MENTOR') {
      const profile = req.user.mentorProfile;
      if (!profile) return res.status(403).json({ status: 'error', message: 'Profile required.' });
      whereClause = { mentorship: { mentorId: profile.id } };
    } else {
      return res.status(403).json({ status: 'error', message: 'Unauthorized role.' });
    }

    const sessions = await prisma.session.findMany({
      where: whereClause,
      include: {
        mentorship: {
          include: {
            mentor: { include: { user: { select: { name: true, email: true } } } },
            student: { include: { user: { select: { name: true, email: true } } } }
          }
        }
      },
      orderBy: { scheduledAt: 'asc' }
    });

    return res.status(200).json({ status: 'success', sessions });
  } catch (err) {
    return res.status(500).json({ status: 'error', message: 'Failed to fetch sessions.', details: err.message });
  }
};

/**
 * POST /api/sessions
 * Book a new session. Only STUDENTS can book.
 */
const createSession = async (req, res) => {
  try {
    if (req.user.role !== 'STUDENT') {
      return res.status(403).json({ status: 'error', message: 'Only STUDENTS can book sessions.' });
    }

    const studentProfile = req.user.studentProfile;
    const { mentorshipId, scheduledAt, duration, topic } = req.body;

    if (!mentorshipId || !scheduledAt || !duration || !topic) {
      return res.status(400).json({ status: 'error', message: 'Missing required fields.' });
    }

    const scheduledDate = new Date(scheduledAt);
    if (isNaN(scheduledDate.getTime())) {
      return res.status(400).json({ status: 'error', message: 'Invalid scheduledAt date format.' });
    }

    const nowKolkataDateStr = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
    const scheduledDateStr = scheduledDate.toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
    
    if (scheduledDateStr < nowKolkataDateStr) {
      return res.status(400).json({ status: 'error', message: 'Cannot book a session on a past date.' });
    }

    // 1 & 2 & 3. Verify mentorship ownership and active status
    const mentorship = await prisma.mentorship.findFirst({
      where: {
        id: mentorshipId,
        studentId: studentProfile.id,
        status: 'ACTIVE'
      },
      include: { mentor: { include: { availabilities: true, user: true } } }
    });

    if (!mentorship) {
      return res.status(404).json({ status: 'error', message: 'Active mentorship not found or unauthorized.' });
    }

    const mentor = mentorship.mentor;

    // 4. Check if mentor is generally available and eligible
    if (!mentor.isAvailable || mentor.user.isSuspended || mentor.status !== 'APPROVED') {
      return res.status(400).json({ status: 'error', message: 'Mentor is currently unavailable or not eligible for new sessions.' });
    }
    
    // 4.1 Validate duration
    const dur = parseInt(duration, 10);
    if (isNaN(dur) || dur <= 0 || dur > 480) {
      return res.status(400).json({ status: 'error', message: 'Invalid duration.' });
    }

    // 5. Check if selected time is within availability slots
    // Explicitly parse the requested time into IST for comparison against the mentor's locally-defined availability.
    const istString = scheduledDate.toLocaleString('en-US', { timeZone: 'Asia/Kolkata' });
    const istDate = new Date(istString);
    const dayOfWeek = getDayOfWeekString(istDate);
    
    const scheduledHours = istDate.getHours();
    const scheduledMinutes = istDate.getMinutes();
    const startMins = scheduledHours * 60 + scheduledMinutes;
    const endMins = startMins + dur;

    const isWithinSlot = mentor.availabilities.some(slot => {
      if (slot.dayOfWeek.toUpperCase() !== dayOfWeek) return false;
      if (!slot.isActive) return false;
      
      const slotStart = parseTime(slot.startTime);
      const slotEnd = parseTime(slot.endTime);
      
      return startMins >= slotStart && endMins <= slotEnd;
    });

    if (!isWithinSlot) {
      return res.status(400).json({ status: 'error', message: 'Selected time is outside mentor availability slots.' });
    }

    // 6. Check for conflicting sessions for this mentor
    // We need to ensure that the mentor doesn't have another session overlapping.
    const scheduledEnd = new Date(scheduledDate.getTime() + dur * 60000);
    
    const conflictingSessions = await prisma.session.findMany({
      where: {
        mentorship: { mentorId: mentor.id },
        status: 'SCHEDULED'
      },
      include: { payment: true }
    });

    const hasConflict = conflictingSessions.some(sess => {
      // Ignore unpaid abandoned carts (older than 15 minutes)
      if (sess.payment && sess.payment.amount > 0 && sess.payment.status !== 'PAID') {
        const ageMinutes = (new Date() - new Date(sess.createdAt)) / 60000;
        if (ageMinutes > 15) return false;
      }
      
      const sessStart = new Date(sess.scheduledAt);
      const sessEnd = new Date(sessStart.getTime() + sess.duration * 60000);
      
      // Overlap logic: start < otherEnd AND end > otherStart
      return scheduledDate < sessEnd && scheduledEnd > sessStart;
    });

    if (hasConflict) {
      return res.status(400).json({ status: 'error', message: 'This time slot is already booked.' });
    }

    // 7. Calculate authoritative price server-side
    const hourlyFee = mentor.sessionFee || 0;
    const amount = (hourlyFee * dur) / 60;
    const platformFee = amount * 0.1;
    const mentorAmount = amount - platformFee;

    // 8. Create session and payment in transaction
    const session = await prisma.$transaction(async (tx) => {
      const sess = await tx.session.create({
        data: {
          mentorshipId,
          scheduledAt: scheduledDate,
          duration: dur,
          topic: topic.trim(),
          status: 'SCHEDULED'
        }
      });

      const payment = await tx.payment.create({
        data: {
          studentId: studentProfile.id,
          mentorId: mentor.id,
          sessionId: sess.id,
          amount: parseFloat(amount.toFixed(2)),
          platformFee: parseFloat(platformFee.toFixed(2)),
          mentorAmount: parseFloat(mentorAmount.toFixed(2)),
          currency: 'INR',
          status: 'CREATED'
        }
      });

      return { ...sess, payment };
    });

    return res.status(201).json({ status: 'success', message: 'Session selected — payment required.', session });
  } catch (err) {
    return res.status(500).json({ status: 'error', message: 'Failed to book session.', details: err.message });
  }
};

/**
 * GET /api/sessions/:id
 * Get session details if authorized.
 */
const getSessionById = async (req, res) => {
  try {
    const { id } = req.params;

    const session = await prisma.session.findUnique({
      where: { id },
      include: {
        mentorship: {
          include: {
            mentor: { include: { user: { select: { name: true, email: true } } } },
            student: { include: { user: { select: { name: true, email: true } } } }
          }
        }
      }
    });

    if (!session) {
      return res.status(404).json({ status: 'error', message: 'Session not found.' });
    }

    // Check authorization via profile IDs (supports peer mentors)
    const isAuthorized = 
      isStudentParticipant(req.user, session.mentorship.studentId) ||
      isMentorParticipant(req.user, session.mentorship.mentorId);

    if (!isAuthorized) {
      return res.status(403).json({ status: 'error', message: 'Access denied.' });
    }

    return res.status(200).json({ status: 'success', session });
  } catch (err) {
    return res.status(500).json({ status: 'error', message: 'Failed to fetch session.', details: err.message });
  }
};

/**
 * PUT /api/sessions/:id/cancel
 * Both student and mentor can cancel a session.
 */
const cancelSession = async (req, res) => {
  try {
    const { id } = req.params;

    const session = await prisma.session.findUnique({
      where: { id },
      include: {
        mentorship: {
          include: {
            mentor: { include: { user: { select: { id: true, name: true } } } },
            student: { include: { user: { select: { id: true, name: true } } } }
          }
        }
      }
    });

    if (!session) {
      return res.status(404).json({ status: 'error', message: 'Session not found.' });
    }

    const isAuthorized = 
      isStudentParticipant(req.user, session.mentorship.studentId) ||
      isMentorParticipant(req.user, session.mentorship.mentorId);

    if (!isAuthorized) {
      return res.status(403).json({ status: 'error', message: 'Access denied.' });
    }

    const updated = await prisma.session.update({
      where: { id },
      data: { status: 'CANCELLED' }
    });

    const scheduledTime = new Date(session.scheduledAt).toLocaleString();
    const isCancelledByStudent = isStudentParticipant(req.user, session.mentorship.studentId);

    if (isCancelledByStudent) {
      // Notify mentor
      await notificationService.createNotification(
        session.mentorship.mentor.userId,
        'GENERAL',
        'Session Cancelled',
        `Your mentoring session scheduled for ${scheduledTime} has been cancelled by the student.`,
        session.id,
        'SESSION'
      );
    } else {
      // Notify student
      await notificationService.createNotification(
        session.mentorship.student.userId,
        'GENERAL',
        'Session Cancelled',
        `Your mentoring session scheduled for ${scheduledTime} has been cancelled by the mentor.`,
        session.id,
        'SESSION'
      );
    }

    return res.status(200).json({ status: 'success', message: 'Session cancelled.', session: updated });
  } catch (err) {
    return res.status(500).json({ status: 'error', message: 'Failed to cancel session.', details: err.message });
  }
};

/**
 * PUT /api/sessions/:id/complete
 * Only an approved mentor (professional or peer) can mark as completed.
 */
const completeSession = async (req, res) => {
  try {
    const { id } = req.params;
    
    // Use capability check instead of role check
    if (!isApprovedMentor(req.user)) {
      return res.status(403).json({ status: 'error', message: 'Only approved mentors can complete sessions.' });
    }

    const session = await prisma.session.findUnique({
      where: { id },
      include: { 
        mentorship: true,
        payment: { include: { payout: true } }
      }
    });

    if (!session) {
      return res.status(404).json({ status: 'error', message: 'Session not found.' });
    }

    if (!isMentorParticipant(req.user, session.mentorship.mentorId)) {
      return res.status(403).json({ status: 'error', message: 'Access denied.' });
    }

    if (session.status === 'COMPLETED') {
      return res.status(400).json({ status: 'error', message: 'Session is already completed.' });
    }

    if (session.status !== 'SCHEDULED') {
      return res.status(400).json({ status: 'error', message: 'Only scheduled sessions can be completed.' });
    }

    if (!session.payment || session.payment.status !== 'PAID') {
      return res.status(400).json({ status: 'error', message: 'Session cannot be completed because it is not paid.' });
    }

    const updated = await prisma.$transaction(async (tx) => {
      const sess = await tx.session.update({
        where: { id },
        data: { status: 'COMPLETED' }
      });

      // Create exactly one PayoutRecord if it doesn't exist
      if (!session.payment.payout) {
        await tx.payoutRecord.create({
          data: {
            mentorId: session.mentorship.mentorId,
            paymentId: session.payment.id,
            grossAmount: session.payment.amount,
            platformFee: session.payment.platformFee,
            netAmount: session.payment.mentorAmount,
            status: 'ELIGIBLE'
          }
        });
      }
      return sess;
    });

    return res.status(200).json({ status: 'success', message: 'Session marked as completed and payout eligible.', session: updated });
  } catch (err) {
    return res.status(500).json({ status: 'error', message: 'Failed to complete session.', details: err.message });
  }
};

/**
 * GET /api/sessions/:id/live
 * Return live session details and access control
 */
const getLiveSession = async (req, res) => {
  try {
    const { id } = req.params;

    const session = await prisma.session.findUnique({
      where: { id },
      include: {
        mentorship: {
          include: {
            mentor: { include: { user: { select: { name: true, email: true } } } },
            student: { include: { user: { select: { name: true, email: true } } } }
          }
        },
        payment: true
      }
    });

    if (!session) {
      return res.status(404).json({ status: 'error', message: 'Session not found.' });
    }

    // Check authorization via profile IDs
    const isAuthorized = 
      isStudentParticipant(req.user, session.mentorship.studentId) ||
      isMentorParticipant(req.user, session.mentorship.mentorId);

    if (!isAuthorized) {
      return res.status(403).json({ status: 'error', message: 'Access denied.' });
    }

    if (session.status === 'CANCELLED') {
      return res.status(403).json({ joinAllowed: false, reason: 'SESSION_CANCELLED' });
    }
    
    if (session.payment?.status !== 'PAID') {
      return res.status(403).json({ joinAllowed: false, reason: 'PAYMENT_REQUIRED' });
    }

    // Check time window
    const now = new Date();
    const sessionStart = new Date(session.scheduledAt);
    const sessionEnd = new Date(sessionStart.getTime() + session.duration * 60000);
    
    // Allow joining 10 minutes before start
    const allowedJoinStart = new Date(sessionStart.getTime() - 10 * 60000);

    if (now < allowedJoinStart) {
      return res.status(200).json({ joinAllowed: false, reason: 'TOO_EARLY', joinAvailableAt: allowedJoinStart });
    }

    if (now > sessionEnd) {
      return res.status(200).json({ joinAllowed: false, reason: 'SESSION_ENDED' });
    }

    return res.status(200).json({ 
      joinAllowed: true, 
      meetingLink: session.meetingLink,
      sessionDetails: {
        id: session.id,
        topic: session.topic,
        scheduledAt: session.scheduledAt,
        duration: session.duration,
        mentor: session.mentorship.mentor.user,
        student: session.mentorship.student.user
      }
    });
  } catch (err) {
    return res.status(500).json({ status: 'error', message: 'Failed to fetch live session details.', details: err.message });
  }
};

module.exports = {
  getSessions,
  createSession,
  getSessionById,
  cancelSession,
  completeSession,
  getLiveSession
};
