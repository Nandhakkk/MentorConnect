const jwt = require('jsonwebtoken');
const prisma = require('../config/db');

/**
 * Authentication Middleware
 * Validates the JWT from the Authorization header (Bearer TOKEN)
 * and attaches the authenticated user (with profile) to req.user
 */
const authenticateToken = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        status: 'error',
        message: 'Authentication required. Missing or invalid Authorization header.'
      });
    }

    const token = authHeader.split(' ')[1];

    if (!token) {
      return res.status(401).json({
        status: 'error',
        message: 'Authentication token not provided.'
      });
    }

    const secret = process.env.JWT_SECRET || 'mentorconnect_super_secret_jwt_key';

    // Verify token
    let decoded;
    try {
      decoded = jwt.verify(token, secret);
    } catch (err) {
      return res.status(401).json({
        status: 'error',
        message: 'Invalid or expired authentication token.'
      });
    }

    // Retrieve user from database (excluding sensitive password)
    const user = await prisma.user.findUnique({
      where: { id: decoded.id },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        createdAt: true,
        updatedAt: true,
        studentProfile: true,
        mentorProfile: true
      }
    });

    if (!user) {
      return res.status(401).json({
        status: 'error',
        message: 'The user belonging to this token no longer exists.'
      });
    }

    req.user = user;
    next();
  } catch (error) {
    return res.status(500).json({
      status: 'error',
      message: 'Authentication error',
      details: error.message
    });
  }
};

/**
 * Reusable Role Authorization Middleware
 * Restricts access to one or more specified roles
 * Usage: requireRole('STUDENT'), requireRole('MENTOR'), requireRole('STUDENT', 'MENTOR')
 */
const requireRole = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        status: 'error',
        message: 'Authentication required before verifying role permissions.'
      });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        status: 'error',
        message: `Forbidden: Access requires one of the following roles: [${roles.join(', ')}]. Your current role is '${req.user.role}'.`
      });
    }

    next();
  };
};

const requireApprovedMentor = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({
      status: 'error',
      message: 'Authentication required before verifying mentor approval status.'
    });
  }

  // A user is an approved mentor if they have an approved mentor profile, 
  // regardless of whether their role is MENTOR (Professional) or STUDENT (Peer).
  if (!req.user.mentorProfile || req.user.mentorProfile.status !== 'APPROVED') {
    return res.status(403).json({
      status: 'error',
      message: 'Forbidden: You must be an approved mentor (Professional or Peer) to access this resource.'
    });
  }

  next();
};

module.exports = {
  authenticateToken,
  requireRole,
  requireApprovedMentor
};
