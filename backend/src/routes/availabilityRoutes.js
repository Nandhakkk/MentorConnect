const express = require('express');
const router = express.Router();
const availabilityController = require('../controllers/availabilityController');
const authMiddleware = require('../middleware/authMiddleware');

// All availability routes require authentication
router.use(authMiddleware.authenticateToken);
router.use(authMiddleware.requireApprovedMentor);

router.get('/', availabilityController.getAvailability);
router.post('/', availabilityController.createAvailability);
router.put('/:id', availabilityController.updateAvailability);
router.delete('/:id', availabilityController.deleteAvailability);

module.exports = router;
