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
router.put('/mentors/:id/status', adminController.updateMentorStatus);
router.get('/mentorships', adminController.getMentorships);

module.exports = router;
