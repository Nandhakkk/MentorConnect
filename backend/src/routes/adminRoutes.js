const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');
const authMiddleware = require('../middleware/authMiddleware');

// All admin routes require JWT and ADMIN role
router.use(authMiddleware.authenticateToken);
router.use(authMiddleware.requireRole('ADMIN'));

router.get('/dashboard-stats', adminController.getDashboardStats);
router.get('/users', adminController.getUsers);
router.get('/mentors', adminController.getMentors);
router.get('/mentorships', adminController.getMentorships);

// Professional Mentor Verification Portal routes
router.get('/mentor-applications', adminController.getMentorApplications);
router.get('/mentor-applications/:id', adminController.getMentorApplicationById);
router.put('/mentor-applications/:id/status', adminController.updateMentorApplicationStatus);

// Complaints
router.get('/complaints', adminController.getComplaints);
router.get('/complaints/:id', adminController.getComplaintById);
router.put('/complaints/:id/status', adminController.updateComplaintStatus);

// User Suspension
router.put('/users/:userId/suspend', adminController.toggleUserSuspension);

// Peer Mentor Applications
router.get('/peer-mentor-applications', adminController.getPeerMentorApplications);
router.get('/peer-mentor-applications/:id', adminController.getPeerMentorApplicationById);
router.put('/peer-mentor-applications/:id/status', adminController.updatePeerMentorApplicationStatus);

module.exports = router;
