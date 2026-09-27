const express = require('express');
const router = express.Router();
const mentorApplicationController = require('../controllers/mentorApplicationController');
const authMiddleware = require('../middleware/authMiddleware');
const upload = require('../middleware/uploadMiddleware');

// All mentor application routes require MENTOR role
router.use(authMiddleware.authenticateToken);
router.use(authMiddleware.requireRole('MENTOR'));

router.get('/me', mentorApplicationController.getMyApplication);
router.post('/', mentorApplicationController.createApplication);
router.put('/me', mentorApplicationController.updateMyApplication);
router.post('/me/screen', mentorApplicationController.screenApplication);

// Credential Routes
router.post('/me/credentials', upload.single('file'), mentorApplicationController.uploadCredential);
router.delete('/me/credentials/:credentialId', mentorApplicationController.deleteCredential);

module.exports = router;
