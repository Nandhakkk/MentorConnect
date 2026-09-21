const express = require('express');
const router = express.Router();
const sessionController = require('../controllers/sessionController');
const authMiddleware = require('../middleware/authMiddleware');

// All session routes require authentication
router.use(authMiddleware.authenticateToken);

router.get('/', sessionController.getSessions);
router.post('/', sessionController.createSession);
router.get('/:id', sessionController.getSessionById);
router.put('/:id/cancel', sessionController.cancelSession);
router.put('/:id/complete', sessionController.completeSession);

module.exports = router;
