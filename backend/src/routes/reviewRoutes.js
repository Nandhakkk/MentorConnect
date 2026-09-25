const express = require('express');
const router = express.Router();
const reviewController = require('../controllers/reviewController');
const authMiddleware = require('../middleware/authMiddleware');

// Public route for viewing mentor reviews (or just authenticated, using authenticateToken loosely depending on discovery needs, but assuming discovery needs auth)
router.get('/mentor/:mentorId', authMiddleware.authenticateToken, reviewController.getMentorReviews);

router.use(authMiddleware.authenticateToken);

router.post('/', reviewController.createReview);
router.get('/session/:sessionId', reviewController.getSessionReviews);
router.get('/my', reviewController.getMyReviews);

module.exports = router;
