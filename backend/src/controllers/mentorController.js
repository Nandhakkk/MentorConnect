const prisma = require('../config/db');
const { isApprovedMentor, isPeerMentor, checkMentorReadiness } = require('../utils/mentorCapability');
const fileService = require('../services/fileService');

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
 * Major verified claims (experience, teachingExperience) trigger re-verification if changed.
 */
const updateMyProfile = async (req, res) => {
  try {
    const { bio, expertise, experience, isAvailable, language, linkedinUrl, teachingExperience, sessionFee, topics } = req.body;

    const currentProfile = await prisma.mentorProfile.findUnique({
      where: { userId: req.user.id }
    });

    if (!currentProfile) {
      return res.status(404).json({ status: 'error', message: 'Mentor profile not found.' });
    }

    // If profile is APPROVED and PROFESSIONAL, modifying verified experience triggers re-verification
    let isApprovedProfessional = currentProfile.status === 'APPROVED' && currentProfile.mentorType === 'PROFESSIONAL';
    let reverificationRequired = false;

    // Build update data — common fields for both types
    const updateData = {};
    if (bio !== undefined) updateData.bio = bio;
    if (expertise !== undefined) updateData.expertise = expertise;
    if (experience !== undefined && experience !== '') updateData.experience = parseInt(experience, 10);
    if (isAvailable !== undefined) updateData.isAvailable = Boolean(isAvailable);
    if (language !== undefined) updateData.language = language;
    if (sessionFee !== undefined && sessionFee !== '') updateData.sessionFee = parseFloat(sessionFee);

    // Professional-only fields — peer mentors cannot modify these
    if (!isPeerMentor(req.user)) {
      if (linkedinUrl !== undefined) updateData.linkedinUrl = linkedinUrl;
      if (isApprovedProfessional) {
        if (
          (teachingExperience !== undefined && parseInt(teachingExperience, 10) !== currentProfile.teachingExperience) ||
          (experience !== undefined && parseInt(experience, 10) !== currentProfile.experience)
        ) {
          if (teachingExperience !== undefined) updateData.teachingExperience = parseInt(teachingExperience, 10);
          updateData.status = 'PENDING';
          reverificationRequired = true;
        }
      } else {
        if (teachingExperience !== undefined && teachingExperience !== '') {
          updateData.teachingExperience = parseInt(teachingExperience, 10);
        }
      }
    }

    const updatedProfile = await prisma.$transaction(async (tx) => {
      const profile = await tx.mentorProfile.update({
        where: { userId: req.user.id },
        data: updateData,
        include: { user: { select: { name: true, email: true } } }
      });

      if (!isApprovedProfessional && topics && Array.isArray(topics)) {
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

    const responseMsg = reverificationRequired
      ? 'Profile updated. Critical claims were modified; status changed to PENDING for re-verification.'
      : 'Profile updated successfully.';

    return res.status(200).json({
      status: 'success',
      message: responseMsg,
      profile: updatedProfile,
      reverificationRequired
    });
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
        availabilities: { where: { isActive: true } },
        portfolio: {
          select: {
            headline: true,
            introduction: true,
            skills: true,
            highlights: true
          }
        }
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
        reviewCount: stats.count,
        isVerified: Boolean(m.verifiedAt && m.status === 'APPROVED')
      };
    });

    return res.status(200).json({ status: 'success', mentors: mentorsWithStats });
  } catch (err) {
    return res.status(500).json({ status: 'error', message: 'Failed to fetch mentors.', details: err.message });
  }
};

/**
 * GET /api/mentors/:id
 * View a mentor's public profile and AI-generated professional portfolio by MentorProfile ID.
 * Supports both PROFESSIONAL and PEER approved mentors.
 * Does NOT expose private verification documents or internal AI/admin screening notes.
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
        availabilities: { where: { isActive: true } },
        portfolio: true,
        credentials: {
          where: { status: 'VERIFIED' },
          select: {
            id: true,
            type: true,
            title: true,
            issuingOrganization: true,
            issueDate: true,
            claimType: true,
            claimDescription: true
          }
        }
      }
    });

    if (!profile) {
      return res.status(404).json({ status: 'error', message: 'Mentor not found.' });
    }

    const reviews = await prisma.review.findMany({
      where: { revieweeId: profile.userId, reviewerRole: 'STUDENT' },
      select: { id: true, rating: true, comment: true, createdAt: true },
      orderBy: { createdAt: 'desc' }
    });

    const reviewCount = reviews.length;
    const averageRating = reviewCount > 0 ? (reviews.reduce((acc, r) => acc + r.rating, 0) / reviewCount).toFixed(1) : 0;

    // Securely omit internal administrative verification notes/evidence fields
    const { teachingEvidence, employmentHistory, ...safeProfile } = profile;

    return res.status(200).json({
      status: 'success',
      profile: {
        ...safeProfile,
        averageRating,
        reviewCount,
        reviews,
        isVerified: Boolean(profile.verifiedAt && profile.status === 'APPROVED')
      }
    });
  } catch (err) {
    return res.status(500).json({ status: 'error', message: 'Failed to fetch mentor details.', details: err.message });
  }
};

/**
 * GET /api/mentors/me/portfolio
 * View the authenticated mentor's own professional portfolio.
 */
const getMyPortfolio = async (req, res) => {
  try {
    const profile = await prisma.mentorProfile.findUnique({
      where: { userId: req.user.id },
      include: {
        portfolio: true,
        credentials: { where: { status: 'VERIFIED' } },
        topics: { include: { topic: true } },
        user: { select: { id: true, name: true, email: true, profileImage: true } }
      }
    });

    if (!profile) return res.status(404).json({ status: 'error', message: 'Mentor profile not found.' });

    return res.status(200).json({ status: 'success', portfolio: profile.portfolio, profile });
  } catch (err) {
    return res.status(500).json({ status: 'error', message: 'Failed to fetch portfolio.', details: err.message });
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
/**
 * GET /api/mentors/me/verification-requests
 */
const getVerificationRequests = async (req, res) => {
  try {
    const profile = await prisma.mentorProfile.findUnique({ where: { userId: req.user.id } });
    if (!profile) return res.status(404).json({ status: 'error', message: 'Profile not found.' });

    const requests = await prisma.verificationRequest.findMany({
      where: { mentorId: profile.id },
      orderBy: { submittedAt: 'desc' }
    });

    return res.status(200).json({ status: 'success', requests });
  } catch (err) {
    return res.status(500).json({ status: 'error', message: 'Failed to fetch verification requests.', details: err.message });
  }
};

/**
 * POST /api/mentors/me/verification-requests
 */
const createVerificationRequest = async (req, res) => {
  try {
    const profile = await prisma.mentorProfile.findUnique({ where: { userId: req.user.id } });
    if (!profile) return res.status(404).json({ status: 'error', message: 'Profile not found.' });

    const { type, title, description, institution, startDate, endDate, evidenceLinks } = req.body;

    if (!type || !title) {
      return res.status(400).json({ status: 'error', message: 'Type and title are required.' });
    }

    let evidenceFilesUrls = [];
    if (req.files && req.files.length > 0) {
      // Allowed MIME types limit handled by multer/config, but we can enforce here if needed
      // File sizes enforced by upload middleware

      const assets = await fileService.processUploads(
        req.files,
        req.user.id,
        'mentorconnect/verification_requests',
        'OTHER', // AssetType
        null
      );

      evidenceFilesUrls = assets.map(a => fileService.generateSecureUrl(a.storageKey, a.mimeType));
    }

    let parsedLinks = null;
    if (evidenceLinks) {
      // Validate URLs
      let linksArray = Array.isArray(evidenceLinks) ? evidenceLinks : [evidenceLinks];
      try {
        parsedLinks = JSON.stringify(linksArray.map(link => new URL(link).toString()));
      } catch (e) {
        return res.status(400).json({ status: 'error', message: 'Invalid URL provided in evidence links.' });
      }
    }

    // Evidence requirement check
    const reqEvidence = evidenceFilesUrls.length > 0 || parsedLinks !== null;
    if (!reqEvidence && ['NEW_TEACHING_TOPIC', 'NEW_CERTIFICATE', 'NEW_EXPERIENCE'].includes(type)) {
      return res.status(400).json({ status: 'error', message: 'Supporting evidence (document/image or valid link) is required for this request type.' });
    }

    const request = await prisma.verificationRequest.create({
      data: {
        mentorId: profile.id,
        type,
        title,
        description,
        institution,
        startDate: startDate ? new Date(startDate) : null,
        endDate: endDate ? new Date(endDate) : null,
        evidenceFiles: evidenceFilesUrls.length > 0 ? JSON.stringify(evidenceFilesUrls) : null,
        evidenceLinks: parsedLinks,
        status: 'PENDING'
      }
    });

    // TODO: Trigger AI Screening asynchronously if needed
    // For now, it stays PENDING until AI picks it up or Admin reviews it

    return res.status(201).json({ status: 'success', message: 'Verification request submitted.', request });
  } catch (err) {
    return res.status(500).json({ status: 'error', message: 'Failed to submit verification request.', details: err.message });
  }
};

/**
 * POST /api/mentors/me/profile-image
 */
const uploadProfileImage = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ status: 'error', message: 'No image provided.' });
    }

    const allowed = ['image/jpeg', 'image/png', 'image/jpg'];
    if (!allowed.includes(req.file.mimetype)) {
      return res.status(400).json({ status: 'error', message: 'Only PNG and JPEG images are allowed.' });
    }

    const assets = await fileService.processUploads(
      [req.file],
      req.user.id,
      'mentorconnect/profiles',
      'OTHER',
      null
    );
    const secureUrl = fileService.generateSecureUrl(assets[0].storageKey, assets[0].mimeType);

    // Update MentorProfile
    await prisma.mentorProfile.update({
      where: { userId: req.user.id },
      data: { profileImage: secureUrl }
    });

    // Also update User
    await prisma.user.update({
      where: { id: req.user.id },
      data: { profileImage: secureUrl }
    });

    return res.status(200).json({ status: 'success', message: 'Profile image updated successfully.', profileImage: secureUrl });
  } catch (err) {
    return res.status(500).json({ status: 'error', message: 'Failed to upload profile image.', details: err.message });
  }
};

module.exports = {
  getMyProfile,
  updateMyProfile,
  getAvailableMentors,
  getMentorById,
  getMyPortfolio,
  addAvailability,
  removeAvailability,
  getVerificationRequests,
  createVerificationRequest,
  uploadProfileImage
};
