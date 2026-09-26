const express = require('express');
const router = express.Router();
const assignmentController = require('../controllers/assignmentController');
const authMiddleware = require('../middleware/authMiddleware');
const upload = require('../middleware/uploadMiddleware');

router.use(authMiddleware.authenticateToken);

// Mentor routes — requireApprovedMentor allows both PROFESSIONAL and PEER mentors
router.get('/mentor', authMiddleware.requireApprovedMentor, assignmentController.getMentorAssignments);
router.post('/', authMiddleware.requireApprovedMentor, upload.array('referenceFiles', 5), assignmentController.createAssignment);
router.put('/:id/review', authMiddleware.requireApprovedMentor, assignmentController.reviewAssignment);

// Student routes — any STUDENT can access (peer mentors also have STUDENT role)
router.get('/student', authMiddleware.requireRole('STUDENT'), assignmentController.getStudentAssignments);
router.post('/:id/submission', authMiddleware.requireRole('STUDENT'), upload.array('submissionFiles', 5), assignmentController.submitAssignment);

// Shared routes
router.get('/files/:assetId', assignmentController.downloadFile);
router.get('/:id', assignmentController.getAssignmentDetails);

module.exports = router;
