const prisma = require('../config/db');
const notificationService = require('../services/notificationService');

/**
 * CREATE REVIEW
 * POST /api/reviews
 */
const createReview = async (req, res) => {
  try {
    const userId = req.user.id;
    const userRole = req.user.role; // 'STUDENT' or 'MENTOR'
    const { sessionId, rating, comment } = req.body;

    if (!sessionId || rating === undefined) {
      return res.status(400).json({ status: 'error', message: 'Session ID and rating are required' });
    }
    
    const parsedRating = parseInt(rating, 10);
    if (isNaN(parsedRating) || parsedRating < 1 || parsedRating > 5) {
      return res.status(400).json({ status: 'error', message: 'Rating must be an integer between 1 and 5' });
    }

    if (!['STUDENT', 'MENTOR'].includes(userRole)) {
      return res.status(403).json({ status: 'error', message: 'Only students and mentors can submit reviews' });
    }

    // Find the session and verify it's COMPLETED
    const session = await prisma.session.findUnique({
      where: { id: sessionId },
      include: {
        mentorship: {
          include: {
            mentor: { include: { user: true } },
            student: { include: { user: true } }
          }
        },
        payment: true
      }
    });

    if (!session) {
      return res.status(404).json({ status: 'error', message: 'Session not found' });
    }

    if (session.status !== 'COMPLETED') {
      return res.status(400).json({ status: 'error', message: 'Reviews can only be submitted for completed sessions' });
    }

    // Determine authorization and reviewee
    let revieweeId;
    if (userRole === 'STUDENT') {
      if (session.mentorship.student.userId !== userId) {
        return res.status(403).json({ status: 'error', message: 'Not authorized for this session' });
      }
      revieweeId = session.mentorship.mentor.userId;
    } else {
      if (session.mentorship.mentor.userId !== userId) {
        return res.status(403).json({ status: 'error', message: 'Not authorized for this session' });
      }
      revieweeId = session.mentorship.student.userId;
    }

    // The DB has @@unique([sessionId, reviewerRole]) protecting duplicates automatically
    // but we can check explicitly to provide a nicer error message
    const existing = await prisma.review.findUnique({
      where: {
        sessionId_reviewerRole: {
          sessionId,
          reviewerRole: userRole
        }
      }
    });

    if (existing) {
      return res.status(400).json({ status: 'error', message: 'You have already reviewed this session' });
    }

    const review = await prisma.review.create({
      data: {
        sessionId,
        reviewerId: userId,
        revieweeId: revieweeId,
        rating: parsedRating,
        comment: comment || null,
        reviewerRole: userRole
      }
    });

    // Notify reviewee
    const notificationTitle = userRole === 'STUDENT' ? 'New Mentor Review' : 'New Student Feedback';
    const notificationMsg = userRole === 'STUDENT' 
      ? 'You received a new review from a student after your mentoring session.'
      : 'You received feedback from your mentor after your mentoring session.';

    await notificationService.createNotification(
      revieweeId,
      'GENERAL', // using GENERAL as requested or existing if appropriate
      notificationTitle,
      notificationMsg,
      review.id,
      'REVIEW'
    );

    return res.status(201).json({ status: 'success', data: review });
  } catch (err) {
    if (err.code === 'P2002') {
      return res.status(400).json({ status: 'error', message: 'Duplicate review rejected' });
    }
    return res.status(500).json({ status: 'error', message: err.message });
  }
};

/**
 * GET REVIEWS FOR A SESSION
 * GET /api/reviews/session/:sessionId
 */
const getSessionReviews = async (req, res) => {
  try {
    const { sessionId } = req.params;
    const userId = req.user.id;

    const session = await prisma.session.findUnique({
      where: { id: sessionId },
      include: {
        mentorship: {
          include: { mentor: true, student: true }
        }
      }
    });

    if (!session) return res.status(404).json({ status: 'error', message: 'Session not found' });
    
    const isParticipant = session.mentorship.student.userId === userId || session.mentorship.mentor.userId === userId;
    const isAdmin = req.user.role === 'ADMIN';

    if (!isParticipant && !isAdmin) {
      return res.status(403).json({ status: 'error', message: 'Not authorized' });
    }

    const reviews = await prisma.review.findMany({
      where: { sessionId }
    });

    return res.status(200).json({ status: 'success', data: reviews });
  } catch (err) {
    return res.status(500).json({ status: 'error', message: err.message });
  }
};

/**
 * GET MY REVIEWS
 * GET /api/reviews/my
 */
const getMyReviews = async (req, res) => {
  try {
    const userId = req.user.id;
    const reviews = await prisma.review.findMany({
      where: { reviewerId: userId },
      include: {
        session: { select: { scheduledAt: true, topic: true } }
      },
      orderBy: { createdAt: 'desc' }
    });
    return res.status(200).json({ status: 'success', data: reviews });
  } catch (err) {
    return res.status(500).json({ status: 'error', message: err.message });
  }
};

/**
 * GET MENTOR REVIEWS (Public)
 * GET /api/reviews/mentor/:mentorId
 */
const getMentorReviews = async (req, res) => {
  try {
    const { mentorId } = req.params;
    
    // Validate mentor exists
    const mentor = await prisma.mentorProfile.findUnique({
      where: { id: mentorId },
      include: { user: true }
    });

    if (!mentor) {
      return res.status(404).json({ status: 'error', message: 'Mentor not found' });
    }

    // We only aggregate STUDENT reviews against this mentor
    const reviews = await prisma.review.findMany({
      where: { 
        revieweeId: mentor.userId,
        reviewerRole: 'STUDENT'
      },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        rating: true,
        comment: true,
        createdAt: true
      }
    });

    const reviewCount = reviews.length;
    const averageRating = reviewCount > 0 
      ? (reviews.reduce((acc, rev) => acc + rev.rating, 0) / reviewCount).toFixed(1)
      : 0;

    return res.status(200).json({ 
      status: 'success', 
      data: {
        averageRating: parseFloat(averageRating),
        reviewCount,
        recentReviews: reviews.slice(0, 5)
      } 
    });
  } catch (err) {
    return res.status(500).json({ status: 'error', message: err.message });
  }
};

module.exports = {
  createReview,
  getSessionReviews,
  getMyReviews,
  getMentorReviews
};
