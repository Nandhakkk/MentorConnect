const express = require('express');
const router = express.Router();
const assignmentController = require('../controllers/assignmentController');
const authMiddleware = require('../middleware/authMiddleware');
const upload = require('../middleware/uploadMiddleware');

router.use(authMiddleware.authenticateToken);

// Mentor routes
router.get('/mentor', authMiddleware.authorizeRoles('MENTOR'), assignmentController.getMentorAssignments);
router.post('/', authMiddleware.authorizeRoles('MENTOR'), upload.array('referenceFiles', 5), assignmentController.createAssignment);
router.put('/:id/review', authMiddleware.authorizeRoles('MENTOR'), assignmentController.reviewAssignment);

// Student routes
router.get('/student', authMiddleware.authorizeRoles('STUDENT'), assignmentController.getStudentAssignments);
router.post('/:id/submission', authMiddleware.authorizeRoles('STUDENT'), upload.array('submissionFiles', 5), assignmentController.submitAssignment);

// Shared routes
router.get('/files/:assetId', assignmentController.downloadFile);
router.get('/:id', assignmentController.getAssignmentDetails);

module.exports = router;
