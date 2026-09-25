const express = require('express');
const router = express.Router();
const healthRoutes = require('./healthRoutes');
const adminRoutes = require('./adminRoutes');

const authRoutes = require('./authRoutes');
const studentRoutes = require('./studentRoutes');
const goalRoutes = require('./goalRoutes');
const milestoneRoutes = require('./milestoneRoutes');
const mentorRoutes = require('./mentorRoutes');
const mentorApplicationRoutes = require('./mentorApplicationRoutes');
const mentorshipRoutes = require('./mentorshipRoutes');
const availabilityRoutes = require('./availabilityRoutes');
const sessionRoutes = require('./sessionRoutes');
const messageRoutes = require('./messageRoutes');
const aiRoutes = require('./aiRoutes');
const guardianRoutes = require('./guardianRoutes');
// Mount sub-routers
router.use('/health', healthRoutes);
router.use('/admin', adminRoutes);
router.use('/auth', authRoutes);
router.use('/students', studentRoutes);
router.use('/goals', goalRoutes);
router.use('/milestones', milestoneRoutes);
router.use('/mentors', mentorRoutes);
router.use('/mentor-applications', mentorApplicationRoutes);
router.use('/mentorships', mentorshipRoutes);
router.use('/availability', availabilityRoutes);
router.use('/sessions', sessionRoutes);
router.use('/messages', messageRoutes);
router.use('/ai', aiRoutes);
router.use('/guardian', guardianRoutes);

module.exports = router;
