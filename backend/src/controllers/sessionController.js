const prisma = require('../config/db');

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
 * Returns sessions for the authenticated user based on role.
 */
const getSessions = async (req, res) => {
  try {
    const { role } = req.user;
    
    let whereClause = {};
    if (role === 'STUDENT') {
      const profile = req.user.studentProfile;
      if (!profile) return res.status(403).json({ status: 'error', message: 'Profile required.' });
      whereClause = { mentorship: { studentId: profile.id } };
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
    const { mentorshipId, scheduledAt, duration } = req.body;

    if (!mentorshipId || !scheduledAt || !duration) {
      return res.status(400).json({ status: 'error', message: 'Missing required fields.' });
    }

    const scheduledDate = new Date(scheduledAt);
    if (isNaN(scheduledDate.getTime())) {
      return res.status(400).json({ status: 'error', message: 'Invalid scheduledAt date format.' });
    }

    // 1 & 2 & 3. Verify mentorship ownership and active status
    const mentorship = await prisma.mentorship.findFirst({
      where: {
        id: mentorshipId,
        studentId: studentProfile.id,
        status: 'ACTIVE'
      },
      include: { mentor: { include: { availabilities: true } } }
    });

    if (!mentorship) {
      return res.status(404).json({ status: 'error', message: 'Active mentorship not found or unauthorized.' });
    }

    const mentor = mentorship.mentor;

    // 4. Check if mentor is generally available
    if (!mentor.isAvailable) {
      return res.status(400).json({ status: 'error', message: 'Mentor is currently unavailable for new sessions.' });
    }

    // 5. Check if selected time is within availability slots
    const dayOfWeek = getDayOfWeekString(scheduledDate);
    
    // Extract hours and minutes for comparison
    // We assume the scheduled time is passed in local/expected timezone, so we use getUTCHours or getHours based on setup.
    // For simplicity, let's treat the date object directly and extract HH:mm in UTC.
    const scheduledHours = scheduledDate.getUTCHours();
    const scheduledMinutes = scheduledDate.getUTCMinutes();
    const startMins = scheduledHours * 60 + scheduledMinutes;
    const endMins = startMins + parseInt(duration, 10);

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
    const scheduledEnd = new Date(scheduledDate.getTime() + duration * 60000);
    
    const conflictingSessions = await prisma.session.findMany({
      where: {
        mentorship: { mentorId: mentor.id },
        status: 'SCHEDULED'
      }
    });

    const hasConflict = conflictingSessions.some(sess => {
      const sessStart = new Date(sess.scheduledAt);
      const sessEnd = new Date(sessStart.getTime() + sess.duration * 60000);
      
      // Overlap logic: start < otherEnd AND end > otherStart
      return scheduledDate < sessEnd && scheduledEnd > sessStart;
    });

    if (hasConflict) {
      return res.status(400).json({ status: 'error', message: 'This time slot is already booked.' });
    }

    // Create session
    const session = await prisma.session.create({
      data: {
        mentorshipId,
        scheduledAt: scheduledDate,
        duration: parseInt(duration, 10),
        status: 'SCHEDULED'
      }
    });

    return res.status(201).json({ status: 'success', message: 'Session booked successfully.', session });
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
    const { role } = req.user;

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

    // Check authorization
    const isAuthorized = 
      (role === 'STUDENT' && session.mentorship.studentId === req.user.studentProfile?.id) ||
      (role === 'MENTOR' && session.mentorship.mentorId === req.user.mentorProfile?.id);

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
    const { role } = req.user;

    const session = await prisma.session.findUnique({
      where: { id },
      include: { mentorship: true }
    });

    if (!session) {
      return res.status(404).json({ status: 'error', message: 'Session not found.' });
    }

    const isAuthorized = 
      (role === 'STUDENT' && session.mentorship.studentId === req.user.studentProfile?.id) ||
      (role === 'MENTOR' && session.mentorship.mentorId === req.user.mentorProfile?.id);

    if (!isAuthorized) {
      return res.status(403).json({ status: 'error', message: 'Access denied.' });
    }

    const updated = await prisma.session.update({
      where: { id },
      data: { status: 'CANCELLED' }
    });

    return res.status(200).json({ status: 'success', message: 'Session cancelled.', session: updated });
  } catch (err) {
    return res.status(500).json({ status: 'error', message: 'Failed to cancel session.', details: err.message });
  }
};

/**
 * PUT /api/sessions/:id/complete
 * Only mentor can mark as completed.
 */
const completeSession = async (req, res) => {
  try {
    const { id } = req.params;
    
    if (req.user.role !== 'MENTOR') {
      return res.status(403).json({ status: 'error', message: 'Only mentors can complete sessions.' });
    }

    const session = await prisma.session.findUnique({
      where: { id },
      include: { mentorship: true }
    });

    if (!session) {
      return res.status(404).json({ status: 'error', message: 'Session not found.' });
    }

    if (session.mentorship.mentorId !== req.user.mentorProfile?.id) {
      return res.status(403).json({ status: 'error', message: 'Access denied.' });
    }

    const updated = await prisma.session.update({
      where: { id },
      data: { status: 'COMPLETED' }
    });

    return res.status(200).json({ status: 'success', message: 'Session marked as completed.', session: updated });
  } catch (err) {
    return res.status(500).json({ status: 'error', message: 'Failed to complete session.', details: err.message });
  }
};

module.exports = {
  getSessions,
  createSession,
  getSessionById,
  cancelSession,
  completeSession
};
