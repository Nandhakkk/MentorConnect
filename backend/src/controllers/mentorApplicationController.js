const prisma = require('../config/db');
const aiService = require('../services/aiService');
const fileService = require('../services/fileService');
const { isMinor, validateDateOfBirth } = require('../utils/ageHelper');

/**
 * Helper to ensure the mentor profile exists, creating it if needed
 */
const getOrCreateMentorProfile = async (userId) => {
  let profile = await prisma.mentorProfile.findUnique({ where: { userId } });
  if (!profile) {
    profile = await prisma.mentorProfile.create({
      data: {
        userId,
        status: 'PENDING',
        mentorType: 'PROFESSIONAL'
      }
    });
  }
  return profile;
};

const getMentorProfileId = async (userId) => {
  const profile = await getOrCreateMentorProfile(userId);
  return profile.id;
};

/**
 * GET /api/mentor-applications/me
 * Retrieves the current mentor application for the authenticated mentor.
 */
const getMyApplication = async (req, res) => {
  try {
    const mentorId = await getMentorProfileId(req.user.id);

    const application = await prisma.mentorApplication.findFirst({
      where: { mentorId },
      orderBy: { createdAt: 'desc' },
      include: {
        credentials: {
          orderBy: { uploadedAt: 'asc' }
        },
        aiScreening: true,
        mentor: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true,
                dateOfBirth: true,
                phone: true,
                profileImage: true
              }
            },
            portfolio: true
          }
        }
      }
    });

    if (!application) {
      return res.status(404).json({ status: 'error', message: 'No application found.' });
    }

    return res.status(200).json({ status: 'success', application });
  } catch (err) {
    console.error('[getMyApplication Error]:', {
      message: err.message,
      code: err.code,
      meta: err.meta,
      stack: err.stack ? err.stack.split('\n').slice(0, 3).join(' | ') : undefined
    });
    return res.status(500).json({ status: 'error', message: 'Failed to fetch application.', details: err.message });
  }
};

/**
 * POST /api/mentor-applications
 * Creates a new mentor application if none exists or updates existing PENDING application.
 */
const createApplication = async (req, res) => {
  try {
    const mentorId = await getMentorProfileId(req.user.id);

    const existingApp = await prisma.mentorApplication.findFirst({
      where: { mentorId },
      orderBy: { createdAt: 'desc' }
    });

    if (existingApp && ['AI_SCREENED', 'UNDER_REVIEW', 'APPROVED'].includes(existingApp.status)) {
      return res.status(400).json({
        status: 'error',
        message: `You already have an active application in ${existingApp.status} status. Please check your application status.`
      });
    }

    const user = await prisma.user.findUnique({ where: { id: req.user.id } });
    const userDob = req.body.dateOfBirth || user?.dateOfBirth;
    if (userDob && isMinor(userDob)) {
      return res.status(400).json({ status: 'error', message: 'You must be at least 18 years old to apply as a professional mentor.' });
    }

    const {
      professionalSummary,
      expertise,
      experience,
      teachingExperience,
      linkedinUrl,
      languages,
      proposedSessionFee,
      employmentHistory,
      teachingExperienceDetails,
      education,
      skills,
      certifications,
      achievements,
      topics,
      otherInfo,
      name,
      dateOfBirth,
      profileImage,
      bio
    } = req.body;

    // Safely update user profile fields if valid
    const validDob = dateOfBirth ? validateDateOfBirth(dateOfBirth) : undefined;
    const userUpdateData = {};
    if (name && typeof name === 'string' && name.trim()) userUpdateData.name = name.trim();
    if (validDob) userUpdateData.dateOfBirth = validDob;
    if (profileImage && typeof profileImage === 'string' && profileImage.trim()) userUpdateData.profileImage = profileImage.trim();

    if (Object.keys(userUpdateData).length > 0) {
      await prisma.user.update({
        where: { id: req.user.id },
        data: userUpdateData
      });
    }

    // Safely update mentorProfile profile fields
    const profileUpdateData = {};
    if (bio !== undefined && bio !== '') {
      profileUpdateData.bio = bio;
    } else if (professionalSummary !== undefined && professionalSummary !== '') {
      profileUpdateData.bio = professionalSummary;
    }

    if (expertise !== undefined) {
      profileUpdateData.expertise = Array.isArray(expertise) ? expertise.join(', ') : expertise;
    }

    if (proposedSessionFee !== undefined && proposedSessionFee !== '') {
      const feeNum = parseFloat(proposedSessionFee);
      if (!isNaN(feeNum)) {
        profileUpdateData.sessionFee = feeNum;
      }
    }

    if (languages !== undefined) profileUpdateData.language = languages;
    if (linkedinUrl !== undefined) profileUpdateData.linkedinUrl = linkedinUrl;

    if (Object.keys(profileUpdateData).length > 0) {
      await prisma.mentorProfile.update({
        where: { id: mentorId },
        data: profileUpdateData
      });
    }

    const parsedExp = (experience !== undefined && experience !== '' && !isNaN(parseInt(experience, 10)))
      ? parseInt(experience, 10)
      : undefined;

    const parsedTeachingExp = (teachingExperience !== undefined && teachingExperience !== '' && !isNaN(parseInt(teachingExperience, 10)))
      ? parseInt(teachingExperience, 10)
      : undefined;

    const parsedFee = (proposedSessionFee !== undefined && proposedSessionFee !== '' && !isNaN(parseFloat(proposedSessionFee)))
      ? parseFloat(proposedSessionFee)
      : undefined;

    const formattedExpertise = expertise !== undefined ? (Array.isArray(expertise) ? expertise.join(', ') : expertise) : undefined;
    const formattedTopics = topics !== undefined ? (Array.isArray(topics) ? topics.join(', ') : topics) : undefined;

    const applicationPayload = {
      professionalSummary: professionalSummary !== undefined ? professionalSummary : undefined,
      expertise: formattedExpertise,
      experience: parsedExp,
      teachingExperience: parsedTeachingExp,
      linkedinUrl: linkedinUrl !== undefined ? linkedinUrl : undefined,
      languages: languages !== undefined ? languages : undefined,
      proposedSessionFee: parsedFee,
      employmentHistory: employmentHistory !== undefined ? employmentHistory : undefined,
      teachingExperienceDetails: teachingExperienceDetails !== undefined ? teachingExperienceDetails : undefined,
      education: education !== undefined ? education : undefined,
      skills: skills !== undefined ? skills : undefined,
      certifications: certifications !== undefined ? certifications : undefined,
      achievements: achievements !== undefined ? achievements : undefined,
      topics: formattedTopics,
      otherInfo: otherInfo !== undefined ? otherInfo : undefined
    };

    let application;
    if (existingApp && existingApp.status === 'PENDING') {
      application = await prisma.mentorApplication.update({
        where: { id: existingApp.id },
        data: applicationPayload,
        include: {
          credentials: true,
          aiScreening: true,
          mentor: {
            include: {
              user: {
                select: {
                  id: true,
                  name: true,
                  email: true,
                  dateOfBirth: true,
                  phone: true,
                  profileImage: true
                }
              }
            }
          }
        }
      });
      return res.status(200).json({ status: 'success', message: 'Pending application updated successfully.', application });
    } else {
      application = await prisma.mentorApplication.create({
        data: {
          mentorId,
          status: 'PENDING',
          ...applicationPayload
        },
        include: {
          credentials: true,
          aiScreening: true,
          mentor: {
            include: {
              user: {
                select: {
                  id: true,
                  name: true,
                  email: true,
                  dateOfBirth: true,
                  phone: true,
                  profileImage: true
                }
              }
            }
          }
        }
      });
      return res.status(201).json({ status: 'success', message: 'Application created successfully.', application });
    }
  } catch (err) {
    console.error('[createApplication Error]:', {
      message: err.message,
      code: err.code,
      meta: err.meta,
      stack: err.stack ? err.stack.split('\n').slice(0, 3).join(' | ') : undefined
    });
    return res.status(500).json({ status: 'error', message: 'Failed to create application.', details: err.message });
  }
};

/**
 * PUT /api/mentor-applications/me
 * Updates the current mentor application (only if PENDING or REJECTED).
 */
const updateMyApplication = async (req, res) => {
  try {
    const mentorId = await getMentorProfileId(req.user.id);

    const application = await prisma.mentorApplication.findFirst({
      where: { mentorId },
      orderBy: { createdAt: 'desc' }
    });

    if (!application) {
      return res.status(404).json({ status: 'error', message: 'No application found.' });
    }

    if (application.status !== 'PENDING' && application.status !== 'REJECTED') {
      return res.status(400).json({ status: 'error', message: `Application cannot be edited while in ${application.status} status.` });
    }

    const {
      professionalSummary,
      expertise,
      experience,
      teachingExperience,
      linkedinUrl,
      languages,
      proposedSessionFee,
      employmentHistory,
      teachingExperienceDetails,
      education,
      skills,
      certifications,
      achievements,
      topics,
      otherInfo,
      name,
      dateOfBirth,
      profileImage,
      bio
    } = req.body;

    // Safely update user profile fields if provided
    const validDob = dateOfBirth ? validateDateOfBirth(dateOfBirth) : undefined;
    const userUpdateData = {};
    if (name && typeof name === 'string' && name.trim()) userUpdateData.name = name.trim();
    if (validDob) userUpdateData.dateOfBirth = validDob;
    if (profileImage && typeof profileImage === 'string' && profileImage.trim()) userUpdateData.profileImage = profileImage.trim();

    if (Object.keys(userUpdateData).length > 0) {
      await prisma.user.update({
        where: { id: req.user.id },
        data: userUpdateData
      });
    }

    // Safely update mentorProfile profile fields
    const profileUpdateData = {};
    if (bio !== undefined && bio !== '') {
      profileUpdateData.bio = bio;
    } else if (professionalSummary !== undefined && professionalSummary !== '') {
      profileUpdateData.bio = professionalSummary;
    }

    if (expertise !== undefined) {
      profileUpdateData.expertise = Array.isArray(expertise) ? expertise.join(', ') : expertise;
    }

    if (proposedSessionFee !== undefined && proposedSessionFee !== '') {
      const feeNum = parseFloat(proposedSessionFee);
      if (!isNaN(feeNum)) {
        profileUpdateData.sessionFee = feeNum;
      }
    }

    if (languages !== undefined) profileUpdateData.language = languages;
    if (linkedinUrl !== undefined) profileUpdateData.linkedinUrl = linkedinUrl;

    if (Object.keys(profileUpdateData).length > 0) {
      await prisma.mentorProfile.update({
        where: { id: mentorId },
        data: profileUpdateData
      });
    }

    const parsedExp = (experience !== undefined && experience !== '' && !isNaN(parseInt(experience, 10)))
      ? parseInt(experience, 10)
      : undefined;

    const parsedTeachingExp = (teachingExperience !== undefined && teachingExperience !== '' && !isNaN(parseInt(teachingExperience, 10)))
      ? parseInt(teachingExperience, 10)
      : undefined;

    const parsedFee = (proposedSessionFee !== undefined && proposedSessionFee !== '' && !isNaN(parseFloat(proposedSessionFee)))
      ? parseFloat(proposedSessionFee)
      : undefined;

    const formattedExpertise = expertise !== undefined ? (Array.isArray(expertise) ? expertise.join(', ') : expertise) : undefined;
    const formattedTopics = topics !== undefined ? (Array.isArray(topics) ? topics.join(', ') : topics) : undefined;

    const updatedApp = await prisma.mentorApplication.update({
      where: { id: application.id },
      data: {
        status: 'PENDING', // Reset to PENDING if was REJECTED
        professionalSummary: professionalSummary !== undefined ? professionalSummary : undefined,
        expertise: formattedExpertise,
        experience: parsedExp,
        teachingExperience: parsedTeachingExp,
        linkedinUrl: linkedinUrl !== undefined ? linkedinUrl : undefined,
        languages: languages !== undefined ? languages : undefined,
        proposedSessionFee: parsedFee,
        employmentHistory: employmentHistory !== undefined ? employmentHistory : undefined,
        teachingExperienceDetails: teachingExperienceDetails !== undefined ? teachingExperienceDetails : undefined,
        education: education !== undefined ? education : undefined,
        skills: skills !== undefined ? skills : undefined,
        certifications: certifications !== undefined ? certifications : undefined,
        achievements: achievements !== undefined ? achievements : undefined,
        topics: formattedTopics,
        otherInfo: otherInfo !== undefined ? otherInfo : undefined
      },
      include: {
        credentials: true,
        aiScreening: true,
        mentor: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true,
                dateOfBirth: true,
                phone: true,
                profileImage: true
              }
            }
          }
        }
      }
    });

    return res.status(200).json({ status: 'success', message: 'Application updated successfully.', application: updatedApp });
  } catch (err) {
    console.error('[updateMyApplication Error]:', {
      message: err.message,
      code: err.code,
      meta: err.meta,
      stack: err.stack ? err.stack.split('\n').slice(0, 3).join(' | ') : undefined
    });
    return res.status(500).json({ status: 'error', message: 'Failed to update application.', details: err.message });
  }
};

/**
 * POST /api/mentor-applications/me/screen
 * Runs AI preliminary screening on the mentor's application and submitted evidence.
 */
const screenApplication = async (req, res) => {
  try {
    const mentorId = await getMentorProfileId(req.user.id);

    const application = await prisma.mentorApplication.findFirst({
      where: { mentorId },
      orderBy: { createdAt: 'desc' },
      include: {
        credentials: true,
        mentor: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true,
                dateOfBirth: true,
                profileImage: true
              }
            }
          }
        }
      }
    });

    if (!application) {
      return res.status(404).json({ status: 'error', message: 'No application found to screen.' });
    }

    if (application.status !== 'PENDING' && application.status !== 'AI_SCREENED' && application.status !== 'REJECTED') {
      return res.status(400).json({ status: 'error', message: `Cannot run screening when status is ${application.status}.` });
    }

    const mentorScreeningService = require('../services/mentorScreeningService');
    const result = await mentorScreeningService.screenProfessionalMentorApplication(application.id);

    return res.status(200).json({
      status: 'success',
      message: result.outcome === 'AUTO_REJECTED'
        ? 'Application evaluated: Ineligible on published objective criteria.'
        : result.outcome === 'ELIGIBLE'
          ? 'Application pre-screening complete: Eligible for administrative approval.'
          : 'Application pre-screening complete: Queued for manual administrator review.',
      outcome: result.outcome,
      screeningResult: result.screeningResult,
      application: result.application,
      failedCriteria: result.failedCriteria || null
    });
  } catch (err) {
    return res.status(500).json({ status: 'error', message: 'Failed to run screening.', details: err.message });
  }
};

/**
 * POST /api/mentor-applications/me/credentials
 * Upload a supporting document/evidence for a claim in the application.
 */
const uploadCredential = async (req, res) => {
  try {
    const mentorId = await getMentorProfileId(req.user.id);
    
    const application = await prisma.mentorApplication.findFirst({
      where: { mentorId },
      orderBy: { createdAt: 'desc' }
    });

    if (!application) {
      return res.status(404).json({ status: 'error', message: 'No application found. Please create your application before uploading documents.' });
    }

    if (application.status !== 'PENDING' && application.status !== 'AI_SCREENED') {
      return res.status(400).json({ status: 'error', message: `Cannot modify credentials when application is in ${application.status} status.` });
    }

    if (!req.file) {
      return res.status(400).json({ status: 'error', message: 'No file provided.' });
    }

    const {
      type,
      title,
      description,
      issuingOrganization,
      issueDate,
      expiryDate,
      claimType,
      claimDescription
    } = req.body;
    
    if (!type || !title) {
      return res.status(400).json({ status: 'error', message: 'Document type and document name/title are required.' });
    }

    // Create the credential record first with Claim ↔ Document linkage
    const credential = await prisma.credential.create({
      data: {
        mentorId,
        applicationId: application.id,
        type,
        title,
        description,
        issuingOrganization,
        issueDate: issueDate ? new Date(issueDate) : undefined,
        expiryDate: expiryDate ? new Date(expiryDate) : undefined,
        claimType: claimType || 'EXPERIENCE',
        claimDescription: claimDescription || null,
        status: 'PENDING'
      }
    });

    // Upload to Cloudinary and create FileAsset
    const assets = await fileService.processUploads(
      [req.file], 
      req.user.id, 
      'mentorconnect/credentials', 
      'CREDENTIAL', 
      credential.id
    );

    const secureUrl = fileService.generateSecureUrl(assets[0].storageKey, assets[0].mimeType);

    // Update credential with the secure URL
    const updatedCredential = await prisma.credential.update({
      where: { id: credential.id },
      data: { fileReference: secureUrl }
    });

    return res.status(201).json({ status: 'success', message: 'Supporting document uploaded successfully.', credential: updatedCredential });
  } catch (err) {
    return res.status(500).json({ status: 'error', message: 'Failed to upload document.', details: err.message });
  }
};

/**
 * DELETE /api/mentor-applications/me/credentials/:credentialId
 */
const deleteCredential = async (req, res) => {
  try {
    const mentorId = await getMentorProfileId(req.user.id);
    const { credentialId } = req.params;

    const credential = await prisma.credential.findUnique({
      where: { id: credentialId },
      include: { application: true }
    });

    if (!credential) {
      return res.status(404).json({ status: 'error', message: 'Credential not found.' });
    }

    if (credential.mentorId !== mentorId) {
      return res.status(403).json({ status: 'error', message: 'Unauthorized.' });
    }

    if (credential.application && credential.application.status !== 'PENDING') {
      return res.status(400).json({ status: 'error', message: `Cannot delete credentials when application is in ${credential.application.status} status.` });
    }

    // Delete associated FileAssets
    const assets = await fileService.getFilesForEntity('CREDENTIAL', credential.id);
    for (const asset of assets) {
      await fileService.deleteFileAsset(asset.id, req.user.id);
    }

    await prisma.credential.delete({
      where: { id: credentialId }
    });

    return res.status(200).json({ status: 'success', message: 'Credential deleted.' });
  } catch (err) {
    return res.status(500).json({ status: 'error', message: 'Failed to delete credential.', details: err.message });
  }
};

module.exports = {
  getMyApplication,
  createApplication,
  updateMyApplication,
  screenApplication,
  uploadCredential,
  deleteCredential
};
