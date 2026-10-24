const express = require('express');
const router = express.Router();
const complaintController = require('../controllers/complaintController');
const authMiddleware = require('../middleware/authMiddleware');

router.use(authMiddleware.authenticateToken);

router.post('/', complaintController.createComplaint);
router.get('/my', complaintController.getMyComplaints);
router.get('/against-me', complaintController.getComplaintsAgainstMe);
router.get('/:id', complaintController.getComplaintById);
router.post('/:id/respond', complaintController.respondToComplaint);
router.post('/:id/messages', complaintController.sendComplaintMessage);

module.exports = router;
