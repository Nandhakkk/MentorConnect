const express = require('express');
const router = express.Router();
const assignmentController = require('../controllers/assignmentController');
const authMiddleware = require('../middleware/authMiddleware');

router.use(authMiddleware.authenticateToken);

// Mentor routes
router.get('/mentor', authMiddleware.authorizeRoles('MENTOR'), assignmentController.getMentorAssignments);
router.post('/', authMiddleware.authorizeRoles('MENTOR'), assignmentController.createAssignment);
router.put('/:id/review', authMiddleware.authorizeRoles('MENTOR'), assignmentController.reviewAssignment);

// Student routes
router.get('/student', authMiddleware.authorizeRoles('STUDENT'), assignmentController.getStudentAssignments);
router.post('/:id/submission', authMiddleware.authorizeRoles('STUDENT'), assignmentController.submitAssignment);

// Shared routes
router.get('/:id', assignmentController.getAssignmentDetails);

module.exports = router;
