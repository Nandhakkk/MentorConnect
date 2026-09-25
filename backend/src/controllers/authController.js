const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const prisma = require('../config/db');
const { validateDateOfBirth } = require('../utils/ageHelper');

/**
 * Helper to generate a JWT token
 */
const generateToken = (userId, role) => {
  const secret = process.env.JWT_SECRET || 'mentorconnect_super_secret_jwt_key';
  const expiresIn = process.env.JWT_EXPIRES_IN || '7d';

  return jwt.sign({ id: userId, role }, secret, { expiresIn });
};

/**
 * Register a new User (STUDENT or MENTOR)
 * POST /api/auth/register
 */
const register = async (req, res) => {
  try {
    const { name, email, password, role, dateOfBirth } = req.body;

    // 1. Validate required fields
    if (!name || !email || !password || !role) {
      return res.status(400).json({
        status: 'error',
        message: 'All fields (name, email, password, role) are required.'
      });
    }

    let parsedDob = null;
    if (role === 'STUDENT' || dateOfBirth) {
      parsedDob = validateDateOfBirth(dateOfBirth);
      if (!parsedDob) {
        return res.status(400).json({
          status: 'error',
          message: 'Valid Date of Birth is required and cannot be in the future.'
        });
      }
    }

    // 2. Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({
        status: 'error',
        message: 'Please provide a valid email address.'
      });
    }

    // 3. Validate password length
    if (password.length < 6) {
      return res.status(400).json({
        status: 'error',
        message: 'Password must be at least 6 characters long.'
      });
    }

    // 4. Validate role (public registration allowed only for STUDENT and MENTOR)
    const normalizedRole = role.toUpperCase();
    if (normalizedRole === 'ADMIN') {
      return res.status(400).json({
        status: 'error',
        message: 'Registration as ADMIN is not permitted.'
      });
    }

    if (normalizedRole !== 'STUDENT' && normalizedRole !== 'MENTOR' && normalizedRole !== 'GUARDIAN') {
      return res.status(400).json({
        status: 'error',
        message: "Invalid role. Allowed roles for registration are 'STUDENT', 'MENTOR', and 'GUARDIAN'."
      });
    }

    // 5. Check if user with this email already exists
    const existingUser = await prisma.user.findUnique({
      where: { email: email.toLowerCase().trim() }
    });

    if (existingUser) {
      return res.status(400).json({
        status: 'error',
        message: 'An account with this email address already exists.'
      });
    }

    // 6. Hash password
    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(password, saltRounds);

    // 7. Create User and corresponding profile in a single atomic transaction
    const newUser = await prisma.user.create({
      data: {
        name: name.trim(),
        email: email.toLowerCase().trim(),
        password: hashedPassword,
        role: normalizedRole,
        dateOfBirth: parsedDob,
        // Automatically create associated profile
        ...(normalizedRole === 'STUDENT' ? { studentProfile: { create: {} } } : {}),
        ...(normalizedRole === 'MENTOR' ? { mentorProfile: { create: {} } } : {})
      },
      include: {
        studentProfile: true,
        mentorProfile: true
      }
    });

    // 8. Generate JWT token
    const token = generateToken(newUser.id, newUser.role);

    // 9. Format response (never expose password)
    const userResponse = {
      id: newUser.id,
      name: newUser.name,
      email: newUser.email,
      role: newUser.role,
      studentProfile: newUser.studentProfile || null,
      mentorProfile: newUser.mentorProfile || null,
      createdAt: newUser.createdAt
    };

    return res.status(201).json({
      status: 'success',
      message: 'User registered successfully',
      token,
      user: userResponse
    });
  } catch (error) {
    console.error('[Register Error]:', error);
    return res.status(500).json({
      status: 'error',
      message: 'Server error during registration.',
      details: process.env.NODE_ENV === 'production' ? null : error.message
    });
  }
};

/**
 * Login existing User
 * POST /api/auth/login
 */
const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    // 1. Validate input presence
    if (!email || !password) {
      return res.status(400).json({
        status: 'error',
        message: 'Both email and password are required.'
      });
    }

    // 2. Find user by email (including student/mentor profile)
    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase().trim() },
      include: {
        studentProfile: true,
        mentorProfile: true
      }
    });

    if (!user) {
      return res.status(401).json({
        status: 'error',
        message: 'Invalid email or password.'
      });
    }

    // 3. Verify password with bcrypt
    const isPasswordValid = await bcrypt.compare(password, user.password);

    if (!isPasswordValid) {
      return res.status(401).json({
        status: 'error',
        message: 'Invalid email or password.'
      });
    }

    // 4. Generate JWT token
    const token = generateToken(user.id, user.role);

    // 5. Format response (never expose password)
    const userResponse = {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      studentProfile: user.studentProfile || null,
      mentorProfile: user.mentorProfile || null,
      createdAt: user.createdAt
    };

    return res.status(200).json({
      status: 'success',
      message: 'Login successful',
      token,
      user: userResponse
    });
  } catch (error) {
    console.error('[Login Error]:', error);
    return res.status(500).json({
      status: 'error',
      message: 'Server error during login.',
      details: process.env.NODE_ENV === 'production' ? null : error.message
    });
  }
};

/**
 * Get Current Logged-in User Profile
 * GET /api/auth/me
 * Requires authentication
 */
const getCurrentUser = async (req, res) => {
  try {
    const user = req.user;

    const userResponse = {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      studentProfile: user.studentProfile || null,
      mentorProfile: user.mentorProfile || null,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt
    };

    return res.status(200).json({
      status: 'success',
      user: userResponse
    });
  } catch (error) {
    console.error('[Get Current User Error]:', error);
    return res.status(500).json({
      status: 'error',
      message: 'Failed to retrieve current user.',
      details: error.message
    });
  }
};

module.exports = {
  register,
  login,
  getCurrentUser
};
