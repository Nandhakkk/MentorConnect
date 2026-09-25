const express = require('express');
const router = express.Router();
const complaintController = require('../controllers/complaintController');
const authMiddleware = require('../middleware/authMiddleware');

router.use(authMiddleware.authenticateToken);

router.post('/', complaintController.createComplaint);
router.get('/my', complaintController.getMyComplaints);
router.get('/:id', complaintController.getComplaintById);

module.exports = router;
