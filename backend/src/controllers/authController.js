const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const prisma = require('../config/db');

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
 * Validation handled by middleware
 */
const register = async (req, res) => {
  try {
    const { name, email, password, role } = req.body;

    // Check if user with this email already exists
    const existingUser = await prisma.user.findUnique({
      where: { email: email.toLowerCase().trim() }
    });

    if (existingUser) {
      return res.status(400).json({
        status: 'error',
        message: 'An account with this email address already exists.'
      });
    }

    // Hash password
    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(password, saltRounds);

    const normalizedRole = role.toUpperCase();

    // Create User and corresponding profile in a single atomic transaction
    const newUser = await prisma.user.create({
      data: {
        name: name.trim(),
        email: email.toLowerCase().trim(),
        password: hashedPassword,
        role: normalizedRole,
        // Automatically create associated profile
        ...(normalizedRole === 'STUDENT' ? { studentProfile: { create: {} } } : {}),
        ...(normalizedRole === 'MENTOR' ? { mentorProfile: { create: { status: 'PENDING' } } } : {})
      },
      include: {
        studentProfile: true,
        mentorProfile: true
      }
    });

    // Generate JWT token
    const token = generateToken(newUser.id, newUser.role);

    // Format response (never expose password)
    const userResponse = {
      id: newUser.id,
      name: newUser.name,
      email: newUser.email,
      role: newUser.role,
      profile: normalizedRole === 'STUDENT' ? newUser.studentProfile : newUser.mentorProfile,
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
 * Validation handled by middleware
 */
const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    // Find user by email (including student/mentor profile)
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

    // Verify password with bcrypt
    const isPasswordValid = await bcrypt.compare(password, user.password);

    if (!isPasswordValid) {
      return res.status(401).json({
        status: 'error',
        message: 'Invalid email or password.'
      });
    }

    // Generate JWT token
    const token = generateToken(user.id, user.role);

    // Format response (never expose password)
    const userResponse = {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      profile: user.role === 'STUDENT' ? user.studentProfile : user.mentorProfile,
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
      profile: user.role === 'STUDENT' ? user.studentProfile : user.mentorProfile,
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
