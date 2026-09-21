const express = require('express');
const router = express.Router();
const { register, login, getCurrentUser } = require('../controllers/authController');
const { authenticateToken } = require('../middleware/authMiddleware');
const { validate } = require('../utils/validation');

// Validation schemas
const registerSchema = {
  name: { required: true },
  email: { required: true, type: 'email' },
  password: { required: true, type: 'password' },
  role: { 
    required: true, 
    custom: (value) => {
      const normalizedRole = String(value).toUpperCase();
      if (normalizedRole === 'ADMIN') {
        return "Registration as ADMIN is not permitted.";
      }
      if (normalizedRole !== 'STUDENT' && normalizedRole !== 'MENTOR') {
        return "Invalid role. Allowed roles for registration are 'STUDENT' and 'MENTOR'.";
      }
      return null;
    }
  }
};

const loginSchema = {
  email: { required: true, type: 'email' },
  password: { required: true }
};

// Public authentication routes
router.post('/register', validate(registerSchema), register);
router.post('/login', validate(loginSchema), login);

// Protected authentication route
router.get('/me', authenticateToken, getCurrentUser);

module.exports = router;
