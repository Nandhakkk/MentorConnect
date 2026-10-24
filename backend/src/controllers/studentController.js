const prisma = require('../config/db');
const fileService = require('../services/fileService');
const guardianService = require('../services/guardianService');
const studentEmailVerificationService = require('../services/studentEmailVerificationService');

/**
 * GET /api/students/me
 * Return the authenticated student's profile with verified email status.
 */
const getMyProfile = async (req, res) => {
  try {
    if (req.user.role !== 'STUDENT') {
      return res.status(403).json({ status: 'error', message: 'Only STUDENT users can access this.' });
    }

    const profile = await prisma.studentProfile.findUnique({
      where: { userId: req.user.id },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
            isEmailVerified: true,
            emailVerifiedAt: true,
            pendingEmail: true,
            emailOtpExpiry: true,
            dateOfBirth: true,
            phone: true,
            profileImage: true
          }
        }
      }
    });

    if (!profile) {
      return res.status(404).json({ status: 'error', message: 'Student profile not found.' });
    }

    const emailVerificationPending = Boolean(
      profile.user.pendingEmail &&
      profile.user.emailOtpExpiry &&
      new Date() < new Date(profile.user.emailOtpExpiry)
    );

    return res.status(200).json({
      status: 'success',
      profile: {
        ...profile,
        user: {
          ...profile.user,
          emailVerificationPending
        }
      }
    });
  } catch (err) {
    return res.status(500).json({ status: 'error', message: 'Failed to fetch profile.', details: err.message });
  }
};

/**
 * PUT /api/students/me
 * Update the authenticated student's profile.
 * If a new email is requested, initiates email verification without altering the active email until verified.
 */
const updateMyProfile = async (req, res) => {
  try {
    if (req.user.role !== 'STUDENT') {
      return res.status(403).json({ status: 'error', message: 'Only STUDENT users can update student profiles.' });
    }

    const { bio, education, skills, interests, careerGoal, email } = req.body;
    let emailChangeResult = null;

    if (email && email.toLowerCase().trim() !== req.user.email.toLowerCase().trim()) {
      const clientIp = req.ip || req.headers['x-forwarded-for'];
      emailChangeResult = await studentEmailVerificationService.requestEmailChange(req.user.id, email, clientIp);
    }

    const updatedProfile = await prisma.studentProfile.update({
      where: { userId: req.user.id },
      data: {
        bio: bio !== undefined ? bio : undefined,
        education: education !== undefined ? education : undefined,
        skills: skills !== undefined ? skills : undefined,
        interests: interests !== undefined ? interests : undefined,
        careerGoal: careerGoal !== undefined ? careerGoal : undefined,
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            isEmailVerified: true,
            emailVerifiedAt: true,
            pendingEmail: true,
            emailOtpExpiry: true,
            dateOfBirth: true,
            phone: true,
            profileImage: true
          }
        }
      }
    });

    const goalText = (careerGoal !== undefined ? careerGoal : req.body.goal);
    if (goalText !== undefined && goalText && goalText.trim()) {
      const trimmed = goalText.trim();
      const existingGoal = await prisma.goal.findFirst({
        where: {
          studentId: updatedProfile.id,
          title: { equals: trimmed, mode: 'insensitive' }
        }
      });
      if (!existingGoal) {
        const goalsCount = await prisma.goal.count({
          where: { studentId: updatedProfile.id }
        });
        if (goalsCount === 0) {
          await prisma.goal.create({
            data: {
              studentId: updatedProfile.id,
              title: trimmed,
              description: 'Learning goal updated in profile.',
              status: 'ACTIVE'
            }
          });
        }
      }
    }

    const emailVerificationPending = Boolean(
      updatedProfile.user.pendingEmail &&
      updatedProfile.user.emailOtpExpiry &&
      new Date() < new Date(updatedProfile.user.emailOtpExpiry)
    );

    const message = emailChangeResult
      ? 'Profile details updated. A verification code has been dispatched to your new email address. Please verify to finalize the change.'
      : 'Profile updated successfully.';

    return res.status(200).json({
      status: 'success',
      message,
      profile: {
        ...updatedProfile,
        user: {
          ...updatedProfile.user,
          emailVerificationPending
        }
      },
      emailChange: emailChangeResult
    });
  } catch (err) {
    return res.status(400).json({ status: 'error', message: err.message });
  }
};

const { isMinor } = require('../utils/ageHelper');

/**
 * PUT /api/students/onboarding
 * Complete the authenticated student's onboarding profile.
 */
const completeOnboarding = async (req, res) => {
  try {
    if (req.user.role !== 'STUDENT') {
      return res.status(403).json({ status: 'error', message: 'Only STUDENT users can complete student onboarding.' });
    }

    const user = await prisma.user.findUnique({
      where: { id: req.user.id }
    });

    if (!user) {
      return res.status(404).json({ status: 'error', message: 'User not found.' });
    }

    // Strict Minor Verification Check
    if (user.dateOfBirth && isMinor(user.dateOfBirth)) {
      const guardian = await prisma.guardian.findFirst({
        where: { minorStudentId: req.user.id }
      });

      if (!guardian) {
        return res.status(400).json({
          status: 'error',
          message: 'Guardian setup is required for minor students under 18.'
        });
      }

      if (!guardian.isVerified) {
        return res.status(400).json({
          status: 'error',
          message: 'Guardian contact must be verified via OTP before completing onboarding.'
        });
      }

      if (guardian.consentStatus !== 'GRANTED') {
        return res.status(400).json({
          status: 'error',
          message: 'Guardian consent must be granted before completing onboarding.'
        });
      }
    }

    const {
      education,
      gradeLevel,
      schoolName,
      favoriteSubjects,
      skills,
      interests,
      experienceLevel,
      careerGoal,
      preferredLearningStyle,
      preferredLanguage,
      budget,
      studyAvailability,
      phone
    } = req.body;

    const goalText = (careerGoal || req.body.goal || '').trim();

    if (phone && !user.phone) {
      await prisma.user.update({
        where: { id: req.user.id },
        data: { phone: phone.trim() }
      });
    }

    const updatedProfile = await prisma.studentProfile.update({
      where: { userId: req.user.id },
      data: {
        education: education || undefined,
        gradeLevel: gradeLevel || undefined,
        schoolName: schoolName || undefined,
        favoriteSubjects: favoriteSubjects || undefined,
        skills: skills || undefined,
        interests: interests || undefined,
        experienceLevel: experienceLevel || undefined,
        careerGoal: goalText || undefined,
        preferredLearningStyle: preferredLearningStyle || undefined,
        preferredLanguage: preferredLanguage || undefined,
        budget: budget !== undefined && budget !== null && budget !== '' ? parseFloat(budget) : null,
        studyAvailability: studyAvailability || undefined,
        onboardingCompleted: true
      },
      include: { user: { select: { name: true, email: true, dateOfBirth: true, phone: true } } }
    });

    // Ensure the onboarding goal is saved as an active Goal linked to StudentProfile.id
    if (goalText) {
      const existingGoal = await prisma.goal.findFirst({
        where: {
          studentId: updatedProfile.id,
          title: { equals: goalText, mode: 'insensitive' }
        }
      });

      if (!existingGoal) {
        // If an initial registration goal existed with the previous careerGoal and 0 milestones, update it; otherwise create
        const oldCareerGoal = user.studentProfile?.careerGoal?.trim();
        let updatedOld = false;
        if (oldCareerGoal && oldCareerGoal.toLowerCase() !== goalText.toLowerCase()) {
          const oldGoal = await prisma.goal.findFirst({
            where: {
              studentId: updatedProfile.id,
              title: { equals: oldCareerGoal, mode: 'insensitive' }
            },
            include: { milestones: true }
          });
          if (oldGoal && oldGoal.milestones.length === 0) {
            await prisma.goal.update({
              where: { id: oldGoal.id },
              data: { title: goalText }
            });
            updatedOld = true;
          }
        }

        if (!updatedOld) {
          await prisma.goal.create({
            data: {
              studentId: updatedProfile.id,
              title: goalText,
              description: 'Initial learning goal set during registration.',
              status: 'ACTIVE'
            }
          });
        }
      }
    }

    return res.status(200).json({ status: 'success', message: 'Onboarding completed successfully.', profile: updatedProfile });
  } catch (err) {
    return res.status(500).json({ status: 'error', message: 'Failed to complete onboarding.', details: err.message });
  }
};

/**
 * POST /api/students/link-guardian
 * Links or updates a Guardian for the minor student without requiring a separate guardian login.
 */
const linkGuardian = async (req, res) => {
  try {
    if (req.user.role !== 'STUDENT') {
      return res.status(403).json({ status: 'error', message: 'Only students can link guardians.' });
    }

    const { guardianEmail, relationship, name, phone } = req.body;
    if (!guardianEmail || !relationship) {
      return res.status(400).json({ status: 'error', message: 'guardianEmail and relationship are required.' });
    }

    const guardianName = name || guardianEmail.split('@')[0];
    const clientIp = req.ip || req.headers['x-forwarded-for'];

    const result = await guardianService.saveOrUpdateContact(
      req.user.id,
      { name: guardianName, relationship, email: guardianEmail, phone },
      clientIp
    );

    return res.status(200).json({
      status: 'success',
      message: result.message,
      relation: result.guardian,
      requiresVerification: result.requiresVerification
    });
  } catch (err) {
    return res.status(400).json({ status: 'error', message: err.message });
  }
};

/**
 * POST /api/students/me/profile-image
 */
const uploadProfileImage = async (req, res) => {
  try {
    if (req.user.role !== 'STUDENT') {
      return res.status(403).json({ status: 'error', message: 'Only STUDENT users can update their profile image.' });
    }

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

    // Update User
    await prisma.user.update({
      where: { id: req.user.id },
      data: { profileImage: secureUrl }
    });

    return res.status(200).json({ status: 'success', message: 'Profile image updated successfully.', profileImage: secureUrl });
  } catch (err) {
    return res.status(500).json({ status: 'error', message: 'Failed to upload profile image.', details: err.message });
  }
};

/**
 * POST /api/students/email/change
 * Explicitly request changing the student account email.
 */
const requestEmailChange = async (req, res) => {
  try {
    if (req.user.role !== 'STUDENT') {
      return res.status(403).json({ status: 'error', message: 'Only STUDENT users can access this.' });
    }

    const { email } = req.body;
    const clientIp = req.ip || req.headers['x-forwarded-for'];

    const result = await studentEmailVerificationService.requestEmailChange(req.user.id, email, clientIp);

    return res.status(200).json({
      status: 'success',
      ...result
    });
  } catch (err) {
    return res.status(400).json({ status: 'error', message: err.message });
  }
};

/**
 * POST /api/students/email/verify
 * Validate the 6-digit OTP and update the verified account email.
 */
const verifyEmailChange = async (req, res) => {
  try {
    if (req.user.role !== 'STUDENT') {
      return res.status(403).json({ status: 'error', message: 'Only STUDENT users can access this.' });
    }

    const { otp } = req.body;
    const clientIp = req.ip || req.headers['x-forwarded-for'];

    const result = await studentEmailVerificationService.verifyEmailChange(req.user.id, otp, clientIp);

    return res.status(200).json({
      status: 'success',
      ...result
    });
  } catch (err) {
    return res.status(400).json({ status: 'error', message: err.message });
  }
};

/**
 * POST /api/students/email/resend
 * Resend the verification OTP to the pending email.
 */
const resendEmailChangeOtp = async (req, res) => {
  try {
    if (req.user.role !== 'STUDENT') {
      return res.status(403).json({ status: 'error', message: 'Only STUDENT users can access this.' });
    }

    const clientIp = req.ip || req.headers['x-forwarded-for'];
    const result = await studentEmailVerificationService.resendEmailChangeOtp(req.user.id, clientIp);

    return res.status(200).json({
      status: 'success',
      ...result
    });
  } catch (err) {
    return res.status(400).json({ status: 'error', message: err.message });
  }
};

/**
 * POST /api/students/email/cancel
 * Cancel a pending email change.
 */
const cancelEmailChange = async (req, res) => {
  try {
    if (req.user.role !== 'STUDENT') {
      return res.status(403).json({ status: 'error', message: 'Only STUDENT users can access this.' });
    }

    const result = await studentEmailVerificationService.cancelEmailChange(req.user.id);

    return res.status(200).json({
      status: 'success',
      ...result
    });
  } catch (err) {
    return res.status(400).json({ status: 'error', message: err.message });
  }
};

module.exports = {
  getMyProfile,
  updateMyProfile,
  completeOnboarding,
  linkGuardian,
  uploadProfileImage,
  requestEmailChange,
  verifyEmailChange,
  resendEmailChangeOtp,
  cancelEmailChange
};
