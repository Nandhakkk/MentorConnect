const prisma = require('../config/db');

/**
 * Helper function to determine Mentor Readiness
 */
const checkMentorReadiness = (profile) => {
  if (profile.status !== 'APPROVED' || profile.mentorType !== 'PROFESSIONAL') return false;
  if (!profile.bio || !profile.expertise || profile.sessionFee == null) return false;
  if (!profile.topics || profile.topics.length === 0) return false;
  if (!profile.availabilities || profile.availabilities.filter(a => a.isActive).length === 0) return false;
  return true;
};

/**
 * GET /api/mentors/me
 * Return the authenticated mentor's profile.
 */
const getMyProfile = async (req, res) => {
  try {
    if (req.user.role !== 'MENTOR') {
      return res.status(403).json({ status: 'error', message: 'Only MENTOR users can access this.' });
    }

    const profile = await prisma.mentorProfile.findUnique({
      where: { userId: req.user.id },
      include: { 
        user: { select: { name: true, email: true, profileImage: true } },
        topics: { include: { topic: true } },
        availabilities: true
      }
    });

    if (!profile) {
      return res.status(404).json({ status: 'error', message: 'Mentor profile not found.' });
    }

    const isReady = checkMentorReadiness(profile);

    return res.status(200).json({ status: 'success', profile, isReady });
  } catch (err) {
    return res.status(500).json({ status: 'error', message: 'Failed to fetch profile.', details: err.message });
  }
};

/**
 * PUT /api/mentors/me
 * Update the authenticated mentor's profile.
 */
const updateMyProfile = async (req, res) => {
  try {
    if (req.user.role !== 'MENTOR') {
      return res.status(403).json({ status: 'error', message: 'Only MENTOR users can update mentor profiles.' });
    }

    const { bio, expertise, experience, isAvailable, language, linkedinUrl, teachingExperience, sessionFee, topics } = req.body;

    const updatedProfile = await prisma.$transaction(async (tx) => {
      const profile = await tx.mentorProfile.update({
        where: { userId: req.user.id },
        data: {
          bio: bio !== undefined ? bio : undefined,
          expertise: expertise !== undefined ? expertise : undefined,
          experience: experience !== undefined ? parseInt(experience, 10) : undefined,
          isAvailable: isAvailable !== undefined ? Boolean(isAvailable) : undefined,
          language: language !== undefined ? language : undefined,
          linkedinUrl: linkedinUrl !== undefined ? linkedinUrl : undefined,
          teachingExperience: teachingExperience !== undefined ? parseInt(teachingExperience, 10) : undefined,
          sessionFee: sessionFee !== undefined ? parseFloat(sessionFee) : undefined,
        },
        include: { user: { select: { name: true, email: true } } }
      });

      if (topics && Array.isArray(topics)) {
        await tx.mentorTopic.deleteMany({ where: { mentorId: profile.id } });
        for (const topicName of topics) {
          let topicRec = await tx.topic.findUnique({ where: { name: topicName } });
          if (!topicRec) {
            topicRec = await tx.topic.create({ data: { name: topicName, category: 'General' } });
          }
          await tx.mentorTopic.create({
            data: { mentorId: profile.id, topicId: topicRec.id }
          });
        }
      }
      return profile;
    });

    return res.status(200).json({ status: 'success', message: 'Profile updated successfully.', profile: updatedProfile });
  } catch (err) {
    return res.status(500).json({ status: 'error', message: 'Failed to update profile.', details: err.message });
  }
};

/**
 * GET /api/mentors
 * Return available mentors (isAvailable = true).
 * Supports search and expertise query filters.
 */
const getAvailableMentors = async (req, res) => {
  try {
    const { search, expertise, minFee, maxFee } = req.query;

    const whereClause = {
      isAvailable: true,
      status: 'APPROVED',
      mentorType: 'PROFESSIONAL',
      sessionFee: { not: null },
      topics: { some: {} },
      availabilities: { some: { isActive: true } },
      user: { role: 'MENTOR' }
    };

    if (search) {
      whereClause.OR = [
        { user: { name: { contains: search, mode: 'insensitive' } } },
        { expertise: { contains: search, mode: 'insensitive' } },
        { bio: { contains: search, mode: 'insensitive' } }
      ];
    } else if (expertise) {
      whereClause.expertise = { contains: expertise, mode: 'insensitive' };
    }

    if (minFee || maxFee) {
      whereClause.sessionFee = {};
      if (minFee) whereClause.sessionFee.gte = parseFloat(minFee);
      if (maxFee) whereClause.sessionFee.lte = parseFloat(maxFee);
    }

    const mentors = await prisma.mentorProfile.findMany({
      where: whereClause,
      include: {
        user: { select: { id: true, name: true, profileImage: true } },
        topics: { include: { topic: true } },
        availabilities: { where: { isActive: true } }
      }
    });

    const mentorIds = mentors.map(m => m.userId);
    const reviews = await prisma.review.findMany({
      where: { revieweeId: { in: mentorIds }, reviewerRole: 'STUDENT' },
      select: { revieweeId: true, rating: true }
    });

    const mentorStats = {};
    reviews.forEach(r => {
      if (!mentorStats[r.revieweeId]) mentorStats[r.revieweeId] = { sum: 0, count: 0 };
      mentorStats[r.revieweeId].sum += r.rating;
      mentorStats[r.revieweeId].count += 1;
    });

    const mentorsWithStats = mentors.map(m => {
      const stats = mentorStats[m.userId] || { sum: 0, count: 0 };
      return {
        ...m,
        averageRating: stats.count > 0 ? (stats.sum / stats.count).toFixed(1) : 0,
        reviewCount: stats.count
      };
    });

    return res.status(200).json({ status: 'success', mentors: mentorsWithStats });
  } catch (err) {
    return res.status(500).json({ status: 'error', message: 'Failed to fetch mentors.', details: err.message });
  }
};

/**
 * GET /api/mentors/:id
 * View a mentor's public profile by MentorProfile ID.
 */
const getMentorById = async (req, res) => {
  try {
    const mentorId = req.params.id;

    const profile = await prisma.mentorProfile.findFirst({
      where: { id: mentorId, status: 'APPROVED', mentorType: 'PROFESSIONAL' },
      include: {
        user: { select: { id: true, name: true, email: true, profileImage: true } },
        topics: { include: { topic: true } },
        availabilities: { where: { isActive: true } }
      }
    });

    if (!profile) {
      return res.status(404).json({ status: 'error', message: 'Mentor not found.' });
    }

    const reviews = await prisma.review.findMany({
      where: { revieweeId: profile.userId, reviewerRole: 'STUDENT' },
      select: { rating: true }
    });
    
    const reviewCount = reviews.length;
    const averageRating = reviewCount > 0 ? (reviews.reduce((acc, r) => acc + r.rating, 0) / reviewCount).toFixed(1) : 0;

    return res.status(200).json({ status: 'success', profile: { ...profile, averageRating, reviewCount } });
  } catch (err) {
    return res.status(500).json({ status: 'error', message: 'Failed to fetch mentor details.', details: err.message });
  }
};

/**
 * POST /api/mentors/me/availability
 * Add a new availability slot
 */
const addAvailability = async (req, res) => {
  try {
    const { dayOfWeek, startTime, endTime } = req.body;
    const profile = await prisma.mentorProfile.findUnique({ where: { userId: req.user.id } });
    if (!profile) return res.status(404).json({ status: 'error', message: 'Profile not found.' });
    
    // Basic validation
    if (!dayOfWeek || !startTime || !endTime) {
      return res.status(400).json({ status: 'error', message: 'Missing required availability fields.' });
    }
    
    const availability = await prisma.mentorAvailability.create({
      data: {
        mentorId: profile.id,
        dayOfWeek,
        startTime,
        endTime,
        isActive: true
      }
    });

    return res.status(201).json({ status: 'success', availability });
  } catch (err) {
    return res.status(500).json({ status: 'error', message: 'Failed to add availability.', details: err.message });
  }
};

/**
 * DELETE /api/mentors/me/availability/:id
 * Remove an availability slot
 */
const removeAvailability = async (req, res) => {
  try {
    const { id } = req.params;
    const profile = await prisma.mentorProfile.findUnique({ where: { userId: req.user.id } });
    if (!profile) return res.status(404).json({ status: 'error', message: 'Profile not found.' });
    
    await prisma.mentorAvailability.deleteMany({
      where: { id, mentorId: profile.id }
    });

    return res.status(200).json({ status: 'success', message: 'Availability removed.' });
  } catch (err) {
    return res.status(500).json({ status: 'error', message: 'Failed to remove availability.', details: err.message });
  }
};

module.exports = {
  getMyProfile,
  updateMyProfile,
  getAvailableMentors,
  getMentorById,
  addAvailability,
  removeAvailability
};
