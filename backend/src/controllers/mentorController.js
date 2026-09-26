const prisma = require('../config/db');
const { isApprovedMentor, isPeerMentor, checkMentorReadiness } = require('../utils/mentorCapability');

/**
 * GET /api/mentors/me
 * Return the authenticated mentor's profile.
 * Works for both PROFESSIONAL and PEER mentors via requireApprovedMentor middleware.
 */
const getMyProfile = async (req, res) => {
  try {
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
 * Works for both PROFESSIONAL and PEER mentors.
 * Peer mentors CANNOT modify: status, mentorType, verifiedAt, verification fields.
 */
const updateMyProfile = async (req, res) => {
  try {
    const { bio, expertise, experience, isAvailable, language, linkedinUrl, teachingExperience, sessionFee, topics } = req.body;

    // Build update data — common fields for both types
    const updateData = {};
    if (bio !== undefined) updateData.bio = bio;
    if (expertise !== undefined) updateData.expertise = expertise;
    if (experience !== undefined) updateData.experience = parseInt(experience, 10);
    if (isAvailable !== undefined) updateData.isAvailable = Boolean(isAvailable);
    if (language !== undefined) updateData.language = language;
    if (sessionFee !== undefined) updateData.sessionFee = parseFloat(sessionFee);

    // Professional-only fields — peer mentors cannot modify these
    if (!isPeerMentor(req.user)) {
      if (linkedinUrl !== undefined) updateData.linkedinUrl = linkedinUrl;
      if (teachingExperience !== undefined) updateData.teachingExperience = parseInt(teachingExperience, 10);
    }

    const updatedProfile = await prisma.$transaction(async (tx) => {
      const profile = await tx.mentorProfile.update({
        where: { userId: req.user.id },
        data: updateData,
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
 * Now includes both PROFESSIONAL and PEER mentors who are ready.
 * Supports search and expertise query filters and optional mentorType filter.
 */
const getAvailableMentors = async (req, res) => {
  try {
    const { search, expertise, minFee, maxFee, mentorType } = req.query;

    const whereClause = {
      isAvailable: true,
      status: 'APPROVED',
      bio: { not: null },
      expertise: { not: null },
      sessionFee: { not: null },
      topics: { some: {} },
      availabilities: { some: { isActive: true } },
      user: {
        isActive: true,
        isSuspended: false
      }
    };

    // Filter by mentorType if specified, otherwise include both
    if (mentorType === 'PROFESSIONAL') {
      whereClause.mentorType = 'PROFESSIONAL';
      whereClause.user.role = 'MENTOR';
    } else if (mentorType === 'PEER') {
      whereClause.mentorType = 'PEER';
      whereClause.user.role = 'STUDENT';
    } else {
      // Include both PROFESSIONAL and PEER
      whereClause.mentorType = { in: ['PROFESSIONAL', 'PEER'] };
    }

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
 * Supports both PROFESSIONAL and PEER approved mentors.
 */
const getMentorById = async (req, res) => {
  try {
    const mentorId = req.params.id;

    const profile = await prisma.mentorProfile.findFirst({
      where: {
        id: mentorId,
        status: 'APPROVED',
        mentorType: { in: ['PROFESSIONAL', 'PEER'] },
        user: {
          isActive: true,
          isSuspended: false
        }
      },
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

    // Return the profile without exposing admin verification internals
    const { verifiedAt, teachingEvidence, employmentHistory, ...safeProfile } = profile;

    return res.status(200).json({ status: 'success', profile: { ...safeProfile, averageRating, reviewCount } });
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
