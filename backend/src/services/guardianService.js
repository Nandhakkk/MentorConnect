const crypto = require('crypto');
const prisma = require('../config/db');
const { calculateAge, isMinor } = require('../utils/ageHelper');
const emailService = require('./emailService');
const smsService = require('./smsService');
const { auditLog } = require('../utils/guardianAuditLogger');
const logger = require('../utils/logger');

const CLIENT_URL = process.env.CLIENT_URL || 'http://localhost:5173';
const TOKEN_EXPIRY_HOURS = 24;

// Simple in-memory rate-limiter maps
const verificationRateLimitMap = new Map(); // key: studentId -> array of timestamps
const summaryLinkRateLimitMap = new Map();   // key: studentId -> array of timestamps
const tokenAttemptRateLimitMap = new Map();  // key: ip -> array of timestamps
const otpRateLimitMap = new Map();          // key: studentId -> array of timestamps

const maskEmail = (email) => {
  if (!email || !email.includes('@')) return email || '';
  const [local, domain] = email.split('@');
  if (local.length <= 2) return `${local[0]}*@${domain}`;
  return `${local.slice(0, 2)}${'*'.repeat(Math.max(1, local.length - 4))}${local.slice(-2)}@${domain}`;
};

const maskPhone = (phone) => {
  if (!phone || phone.length < 4) return phone || '';
  return `${'*'.repeat(Math.max(1, phone.length - 4))}${phone.slice(-4)}`;
};

const isRateLimited = (map, key, maxRequests, windowMs) => {
  const now = Date.now();
  const timestamps = map.get(key) || [];
  const validTimestamps = timestamps.filter(t => now - t < windowMs);
  if (validTimestamps.length >= maxRequests) {
    map.set(key, validTimestamps);
    return true;
  }
  validTimestamps.push(now);
  map.set(key, validTimestamps);
  return false;
};

/**
 * Hash a plain token using SHA-256 for secure storage
 */
const hashToken = (token) => {
  return crypto.createHash('sha256').update(String(token)).digest('hex');
};

/**
 * Save or update guardian contact details for an under-18 student
 */
const saveOrUpdateContact = async (studentUserId, { name, relationship, email, phone }, clientIp = null) => {
  // 1. Fetch student user
  const learner = await prisma.user.findUnique({
    where: { id: studentUserId },
    include: { studentProfile: true }
  });

  if (!learner) {
    throw new Error('Student account not found.');
  }

  if (learner.role !== 'STUDENT') {
    throw new Error('Only students can configure guardian monitoring.');
  }

  if (!learner.dateOfBirth) {
    throw new Error('Date of birth is required on your profile before configuring a guardian.');
  }

  // 2. Strict age check
  if (!isMinor(learner.dateOfBirth)) {
    throw new Error('Adult learners (18 and older) are not enrolled in guardian monitoring.');
  }

  // 3. Validation
  if (!name || name.trim().length < 2) {
    throw new Error('Guardian full name is required (minimum 2 characters).');
  }

  const validRelationships = ['Parent', 'Legal Guardian', 'Family Member', 'Other'];
  if (!relationship || !validRelationships.includes(relationship)) {
    throw new Error(`Valid relationship is required: ${validRelationships.join(', ')}.`);
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  const normalizedEmail = (email || '').toLowerCase().trim();
  if (!normalizedEmail || !emailRegex.test(normalizedEmail)) {
    throw new Error('A valid guardian email address is required.');
  }

  if (normalizedEmail === learner.email.toLowerCase().trim()) {
    throw new Error('Guardian email cannot be identical to the student email.');
  }

  const cleanPhone = phone ? phone.trim() : null;

  // 4. Check existing guardian record for this minor student
  const existingGuardian = await prisma.guardian.findFirst({
    where: { minorStudentId: studentUserId }
  });

  let guardian;
  const isEmailChanged = existingGuardian && existingGuardian.email !== normalizedEmail;
  const isPhoneChanged = existingGuardian && existingGuardian.phone !== cleanPhone;

  if (existingGuardian) {
    // If contact changed, contact must be re-verified
    const updateData = {
      name: name.trim(),
      relationship,
      email: normalizedEmail,
      phone: cleanPhone,
      updatedAt: new Date()
    };

    const verifiedChannelChanged = (isEmailChanged && existingGuardian.emailVerifiedAt) ||
                                  (isPhoneChanged && existingGuardian.phoneVerifiedAt) ||
                                  (isEmailChanged && existingGuardian.isVerified);

    if (isEmailChanged || isPhoneChanged) {
      updateData.otpHash = null;
      updateData.otpExpiry = null;
      updateData.otpAttempts = 0;
    }

    if (isEmailChanged) {
      updateData.emailVerifiedAt = null;
      updateData.verificationTokenHash = null;
      updateData.verificationTokenExpiry = null;
    }

    if (isPhoneChanged) {
      updateData.phoneVerifiedAt = null;
    }

    if (verifiedChannelChanged) {
      updateData.isVerified = false;
      updateData.isMonitoringActive = false;

      // Revoke any existing active summary access tokens
      await prisma.guardianAccessToken.updateMany({
        where: { guardianId: existingGuardian.id, revokedAt: null },
        data: { revokedAt: new Date() }
      });
    }

    guardian = await prisma.guardian.update({
      where: { id: existingGuardian.id },
      data: updateData
    });

    auditLog('GUARDIAN_CONTACT_UPDATED', {
      studentId: studentUserId,
      guardianId: guardian.id,
      ip: clientIp,
      details: { emailChanged: isEmailChanged, phoneChanged: isPhoneChanged, relationship }
    });
  } else {
    // Create new guardian record
    guardian = await prisma.guardian.create({
      data: {
        minorStudentId: studentUserId,
        name: name.trim(),
        relationship,
        email: normalizedEmail,
        phone: cleanPhone,
        isVerified: false,
        isMonitoringActive: false,
        consentStatus: 'PENDING',
        notificationPreferences: {
          emailPayments: true,
          emailSessions: true,
          emailAssignments: true,
          emailProgress: true,
          emailComplaints: true
        }
      }
    });

    auditLog('GUARDIAN_CONTACT_CREATED', {
      studentId: studentUserId,
      guardianId: guardian.id,
      ip: clientIp,
      details: { relationship }
    });
  }

  return {
    guardian,
    requiresVerification: !guardian.isVerified,
    message: (isEmailChanged || isPhoneChanged)
      ? 'Guardian contact details updated. Verification must be completed for the updated contact.'
      : 'Guardian contact details saved successfully.'
  };
};

/**
 * Record student consent for guardian updates
 */
const recordConsent = async (studentUserId, { consentGranted, policyVersion = '1.0' }, clientIp = null) => {
  const learner = await prisma.user.findUnique({ where: { id: studentUserId } });
  if (!learner || !learner.dateOfBirth || !isMinor(learner.dateOfBirth)) {
    throw new Error('Only minor students can record guardian consent.');
  }

  const guardian = await prisma.guardian.findFirst({
    where: { minorStudentId: studentUserId }
  });

  if (!guardian) {
    throw new Error('Please save guardian contact details before recording consent.');
  }

  const consentStatus = consentGranted ? 'GRANTED' : 'REVOKED';
  // Monitoring requires BOTH consent granted AND contact verified
  const isMonitoringActive = Boolean(consentGranted && guardian.isVerified === true);

  const updated = await prisma.guardian.update({
    where: { id: guardian.id },
    data: {
      consentStatus,
      consentTimestamp: new Date(),
      consentPolicyVersion: policyVersion,
      isMonitoringActive
    }
  });

  auditLog('GUARDIAN_CONSENT_RECORDED', {
    studentId: studentUserId,
    guardianId: guardian.id,
    ip: clientIp,
    details: { consentStatus, policyVersion }
  });

  return {
    consentStatus: updated.consentStatus,
    consentTimestamp: updated.consentTimestamp,
    consentPolicyVersion: updated.consentPolicyVersion
  };
};

/**
 * Send a verification email to the guardian contact
 */
const sendVerificationEmail = async (studentUserId, clientIp = null) => {
  // Rate limit: 1 per 60 seconds, max 5 per hour
  if (isRateLimited(verificationRateLimitMap, studentUserId, 5, 3600 * 1000)) {
    throw new Error('Too many verification requests. Please wait before requesting another email.');
  }

  const learner = await prisma.user.findUnique({
    where: { id: studentUserId },
    include: { studentProfile: true }
  });

  if (!learner || !learner.dateOfBirth || !isMinor(learner.dateOfBirth)) {
    throw new Error('Unauthorized verification request.');
  }

  const guardian = await prisma.guardian.findFirst({
    where: { minorStudentId: studentUserId }
  });

  if (!guardian || !guardian.email) {
    throw new Error('No guardian contact found to verify. Please enter guardian details first.');
  }

  // Generate single-use unguessable random token
  const rawToken = crypto.randomBytes(32).toString('hex');
  const tokenHash = hashToken(rawToken);
  const expiry = new Date(Date.now() + TOKEN_EXPIRY_HOURS * 60 * 60 * 1000);

  // Update guardian record with hashed verification token
  await prisma.guardian.update({
    where: { id: guardian.id },
    data: {
      verificationTokenHash: tokenHash,
      verificationTokenExpiry: expiry,
      verificationSentAt: new Date()
    }
  });

  const verifyUrl = `${CLIENT_URL}/guardian/verify/${rawToken}`;
  const studentFirstName = learner.name.split(' ')[0];

  const html = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; color: #1e293b; background-color: #ffffff; border-radius: 8px; border: 1px solid #e2e8f0;">
      <div style="border-bottom: 2px solid #3b82f6; padding-bottom: 12px; margin-bottom: 20px;">
        <h2 style="color: #1e3a8a; margin: 0; font-size: 22px;">MentorConnect — Guardian Verification</h2>
      </div>
      <p style="font-size: 15px; line-height: 1.6;">Hello ${guardian.name || 'Guardian'},</p>
      <p style="font-size: 15px; line-height: 1.6;">
        <strong>${learner.name}</strong> has registered you as their parent or responsible adult guardian on MentorConnect.
      </p>
      <p style="font-size: 14px; line-height: 1.6; color: #475569; background: #f8fafc; padding: 14px; border-radius: 6px; border-left: 4px solid #3b82f6;">
        <strong>What you will receive:</strong> Authorized notifications regarding session bookings, milestones, payments, and general safety updates for ${studentFirstName}.<br />
        <em>Note: Private chat conversations and private AI interactions are strictly confidential and never shared with guardians.</em>
      </p>
      <div style="text-align: center; margin: 30px 0;">
        <a href="${verifyUrl}" style="background-color: #2563eb; color: #ffffff; padding: 12px 28px; border-radius: 6px; text-decoration: none; font-weight: 600; display: inline-block;">
          Verify Guardian Contact
        </a>
      </div>
      <p style="font-size: 13px; color: #64748b; line-height: 1.5;">
        This verification link will expire in 24 hours. If you did not expect this email, you can safely disregard it.
      </p>
      <hr style="border: 0; border-top: 1px solid #e2e8f0; margin: 24px 0;" />
      <p style="font-size: 12px; color: #94a3b8; text-align: center;">MentorConnect Platform · Student Safeguarding & Monitoring</p>
    </div>
  `;

  // Send email via emailService
  const sendResult = await emailService.sendMail({
    to: guardian.email,
    subject: `MentorConnect — Confirm Guardian Contact for ${studentFirstName}`,
    html,
    eventType: 'GENERAL',
    metadata: { guardianId: guardian.id, studentId: studentUserId, action: 'VERIFICATION' }
  });

  // Track in notifications table
  await prisma.notification.create({
    data: {
      userId: studentUserId,
      type: 'GENERAL',
      title: 'Guardian Verification Sent',
      message: `A verification link was dispatched to ${guardian.email}.`,
      channel: 'EMAIL',
      deliveryStatus: sendResult.success ? 'DELIVERED' : 'FAILED',
      recipientEmail: guardian.email,
      guardianId: guardian.id,
      sentAt: new Date(),
      errorMessage: sendResult.error || null
    }
  });

  auditLog('GUARDIAN_VERIFICATION_SENT', {
    studentId: studentUserId,
    guardianId: guardian.id,
    ip: clientIp,
    details: { email: guardian.email, success: sendResult.success }
  });

  return {
    success: true,
    sentTo: guardian.email,
    expiresAt: expiry
  };
};

/**
 * Confirm contact verification via raw token
 */
const confirmVerification = async (rawToken, clientIp = null) => {
  if (!rawToken || typeof rawToken !== 'string') {
    throw new Error('Verification token is missing or malformed.');
  }

  const tokenHash = hashToken(rawToken);

  const guardian = await prisma.guardian.findFirst({
    where: { verificationTokenHash: tokenHash },
    include: { learner: true }
  });

  if (!guardian) {
    auditLog('GUARDIAN_VERIFICATION_FAILED', { ip: clientIp, details: { reason: 'INVALID_TOKEN' }, success: false });
    throw new Error('Invalid or already used verification token.');
  }

  if (!guardian.verificationTokenExpiry || new Date() > new Date(guardian.verificationTokenExpiry)) {
    auditLog('GUARDIAN_VERIFICATION_FAILED', { guardianId: guardian.id, ip: clientIp, details: { reason: 'TOKEN_EXPIRED' }, success: false });
    throw new Error('This verification link has expired. Please ask the student to resend verification.');
  }

  // Activate guardian verification
  const updated = await prisma.guardian.update({
    where: { id: guardian.id },
    data: {
      isVerified: true,
      emailVerifiedAt: new Date(),
      isMonitoringActive: true,
      verificationTokenHash: null,
      verificationTokenExpiry: null
    }
  });

  // Notify student
  await prisma.notification.create({
    data: {
      userId: guardian.minorStudentId,
      type: 'GENERAL',
      title: 'Guardian Contact Verified',
      message: `Your guardian (${guardian.name || guardian.email}) has confirmed their contact details. Monitoring updates are now active.`,
      channel: 'IN_APP',
      deliveryStatus: 'DELIVERED'
    }
  });

  // Send confirmation email to guardian
  await emailService.sendMail({
    to: guardian.email,
    subject: `MentorConnect — Guardian Monitoring Activated for ${guardian.learner.name}`,
    html: `
      <div style="font-family: sans-serif; max-width: 600px; padding: 20px; border: 1px solid #e2e8f0; border-radius: 8px;">
        <h3 style="color: #10b981;">Guardian Contact Verified</h3>
        <p>Your contact details have been successfully verified. You are now authorized to receive learning progress, booking, and payment updates for <strong>${guardian.learner.name}</strong>.</p>
        <p style="font-size: 13px; color: #64748b;">If at any time you wish to stop updates, please contact platform support or adjust your preferences with the student.</p>
      </div>
    `,
    eventType: 'GENERAL',
    metadata: { guardianId: guardian.id, action: 'VERIFICATION_CONFIRMED' }
  });

  auditLog('GUARDIAN_VERIFICATION_CONFIRMED', {
    studentId: guardian.minorStudentId,
    guardianId: guardian.id,
    ip: clientIp,
    details: { email: guardian.email }
  });

  return {
    success: true,
    message: 'Guardian contact verified successfully. Monitoring is now active.',
    studentName: guardian.learner.name,
    guardianName: guardian.name
  };
};

/**
 * Send a one-time verification OTP to Guardian contact (Email only)
 */
const sendGuardianOtp = async (studentUserId, { method = 'EMAIL' } = {}, clientIp = null) => {
  const learner = await prisma.user.findUnique({
    where: { id: studentUserId },
    include: { studentProfile: true }
  });

  if (!learner) {
    throw new Error('Student account not found.');
  }

  if (learner.role !== 'STUDENT') {
    throw new Error('Only students can configure guardian verification.');
  }

  if (!learner.dateOfBirth || !isMinor(learner.dateOfBirth)) {
    throw new Error('Only minor students under 18 require guardian verification.');
  }

  const guardian = await prisma.guardian.findFirst({
    where: { minorStudentId: studentUserId }
  });

  if (!guardian) {
    throw new Error('Please save guardian contact details first before requesting verification.');
  }

  const normalizedMethod = (method || 'EMAIL').toUpperCase();
  if (normalizedMethod === 'PHONE') {
    throw new Error('Phone/SMS OTP verification is no longer supported for Guardian setup. Verification uses Email only.');
  }

  if (normalizedMethod !== 'EMAIL') {
    throw new Error("Invalid verification method. Guardian verification uses 'EMAIL' only.");
  }

  if (!guardian.email) {
    throw new Error('Guardian email address is missing. Please update guardian contact details.');
  }

  // Rate Limiting: 60-second cooldown
  if (guardian.lastOtpSentAt) {
    const elapsedSeconds = Math.floor((Date.now() - new Date(guardian.lastOtpSentAt).getTime()) / 1000);
    if (elapsedSeconds < 60) {
      const waitTime = 60 - elapsedSeconds;
      throw new Error(`Please wait ${waitTime} seconds before requesting a new verification code.`);
    }
  }

  // Rate Limiting: Max 5 OTP requests per hour
  if (isRateLimited(otpRateLimitMap, studentUserId, 5, 3600 * 1000)) {
    throw new Error('Too many verification code requests. Please wait before requesting another code.');
  }

  // Generate cryptographically secure 6-digit OTP
  const rawOtp = crypto.randomInt(100000, 1000000).toString();
  const otpHash = hashToken(rawOtp);
  const expiry = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

  // Invalidate previous OTP and store new hashed OTP
  await prisma.guardian.update({
    where: { id: guardian.id },
    data: {
      otpHash,
      otpExpiry: expiry,
      otpAttempts: 0,
      otpMethod: 'EMAIL',
      lastOtpSentAt: new Date()
    }
  });

  const studentFirstName = learner.name.split(' ')[0];

  const html = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 32px 24px; color: #1e293b; background-color: #ffffff; border-radius: 12px; border: 1px solid #e2e8f0; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);">
      <div style="border-bottom: 2px solid #3b82f6; padding-bottom: 16px; margin-bottom: 24px;">
        <h2 style="color: #1e3a8a; margin: 0; font-size: 22px; font-weight: 700; letter-spacing: -0.5px;">MentorConnect</h2>
        <p style="margin: 4px 0 0 0; color: #64748b; font-size: 13px;">Parent &amp; Guardian Verification</p>
      </div>
      <p style="font-size: 15px; line-height: 1.6; margin-bottom: 16px;">Hello ${guardian.name || 'Guardian'},</p>
      <p style="font-size: 15px; line-height: 1.6; margin-bottom: 20px;">
        <strong>${learner.name}</strong> is registering an account on MentorConnect and listed you as their parent or legal guardian.
      </p>
      <div style="background-color: #f8fafc; border-radius: 8px; border: 1px solid #e2e8f0; padding: 24px; text-align: center; margin: 24px 0;">
        <p style="font-size: 13px; text-transform: uppercase; letter-spacing: 1.5px; color: #64748b; margin: 0 0 10px 0; font-weight: 600;">Your Verification Code</p>
        <div style="display: inline-block; font-size: 36px; font-weight: 800; letter-spacing: 8px; color: #2563eb; background: #eff6ff; padding: 12px 28px; border-radius: 8px; border: 2px dashed #93c5fd; font-family: monospace;">
          ${rawOtp}
        </div>
        <p style="font-size: 13px; color: #dc2626; margin: 12px 0 0 0; font-weight: 600;">
          ⏱️ Expires in 10 minutes.
        </p>
      </div>
      <div style="background-color: #fef2f2; border-left: 4px solid #ef4444; padding: 12px 16px; border-radius: 4px; margin-bottom: 24px;">
        <p style="font-size: 13px; color: #991b1b; margin: 0; line-height: 1.5; font-weight: 500;">
          ⚠️ <strong>Security Warning:</strong> Never share this verification code with anyone other than ${studentFirstName}. MentorConnect staff will never ask for this code.
        </p>
      </div>
      <div style="font-size: 13px; line-height: 1.6; color: #475569; background: #f8fafc; padding: 14px; border-radius: 6px; border: 1px solid #e2e8f0; margin-bottom: 24px;">
        <strong>Guardian Monitoring Notice:</strong> Once verified and authorized, you will receive notifications concerning session schedules, payments, assignments, and safeguarding updates. You will not have access to private student-mentor chats or private AI discussions.
      </div>
      <hr style="border: 0; border-top: 1px solid #e2e8f0; margin: 24px 0;" />
      <p style="font-size: 12px; color: #94a3b8; text-align: center; margin: 0;">
        MentorConnect Platform · Student Safeguarding &amp; Mentorship Excellence
      </p>
    </div>
  `;

  try {
    const sendRes = await emailService.sendMail({
      to: guardian.email,
      subject: `MentorConnect Verification Code: ${rawOtp} for ${studentFirstName}`,
      html,
      eventType: 'GENERAL',
      metadata: { guardianId: guardian.id, studentId: studentUserId, action: 'OTP_VERIFICATION' }
    });

    if (!sendRes.success) {
      throw new Error(`Failed to deliver verification email: ${sendRes.error}`);
    }
  } catch (sendErr) {
    // Delivery failed: clear stored OTP hash to prevent dangling unverified state and allow retry
    await prisma.guardian.update({
      where: { id: guardian.id },
      data: {
        otpHash: null,
        otpExpiry: null,
        otpAttempts: 0,
        lastOtpSentAt: null
      }
    }).catch(() => {});
    throw sendErr;
  }

  const userMessage = "A verification code has been sent to the Guardian's email address.";

  // Record dispatch in notification table
  await prisma.notification.create({
    data: {
      userId: studentUserId,
      type: 'GENERAL',
      title: 'Guardian Verification Code Dispatched',
      message: `A verification code was dispatched via email to ${maskEmail(guardian.email)}.`,
      channel: 'EMAIL',
      deliveryStatus: 'DELIVERED',
      recipientEmail: guardian.email,
      guardianId: guardian.id,
      sentAt: new Date()
    }
  });

  auditLog('GUARDIAN_OTP_SENT', {
    studentId: studentUserId,
    guardianId: guardian.id,
    ip: clientIp,
    details: { method: 'EMAIL' }
  });

  return {
    success: true,
    message: userMessage,
    method: 'EMAIL',
    recipient: maskEmail(guardian.email),
    expiresAt: expiry,
    cooldownSeconds: 60
  };
};

/**
 * Verify Guardian OTP and mark contact verified
 */
const verifyGuardianOtp = async (studentUserId, { otp, method } = {}, clientIp = null) => {
  const learner = await prisma.user.findUnique({
    where: { id: studentUserId }
  });

  if (!learner || !learner.dateOfBirth || !isMinor(learner.dateOfBirth)) {
    throw new Error('Unauthorized verification request.');
  }

  const guardian = await prisma.guardian.findFirst({
    where: { minorStudentId: studentUserId }
  });

  if (!guardian) {
    throw new Error('No guardian record found.');
  }

  if (!otp || typeof otp !== 'string' || !/^\d{6}$/.test(otp.trim())) {
    throw new Error('Please enter a valid 6-digit verification code.');
  }

  const cleanOtp = otp.trim();

  // Brute force / max attempts check
  if (guardian.otpAttempts >= 5) {
    await prisma.guardian.update({
      where: { id: guardian.id },
      data: { otpHash: null, otpExpiry: null, otpAttempts: 0 }
    });

    auditLog('GUARDIAN_OTP_BLOCKED', {
      studentId: studentUserId,
      guardianId: guardian.id,
      ip: clientIp,
      details: { reason: 'TOO_MANY_ATTEMPTS' },
      success: false
    });

    throw new Error('Too many incorrect attempts. This verification code has been invalidated. Please request a new code.');
  }

  // Active OTP check
  if (!guardian.otpHash || !guardian.otpExpiry) {
    throw new Error('No active verification code found. Please request a new code.');
  }

  if (new Date() > new Date(guardian.otpExpiry)) {
    auditLog('GUARDIAN_OTP_EXPIRED', {
      studentId: studentUserId,
      guardianId: guardian.id,
      ip: clientIp,
      details: { reason: 'OTP_EXPIRED' },
      success: false
    });

    throw new Error('Verification code has expired. Please request a new code.');
  }

  // Hash check
  const inputHash = hashToken(cleanOtp);
  if (inputHash !== guardian.otpHash) {
    const newAttempts = guardian.otpAttempts + 1;
    await prisma.guardian.update({
      where: { id: guardian.id },
      data: { otpAttempts: newAttempts }
    });

    auditLog('GUARDIAN_OTP_FAILED', {
      studentId: studentUserId,
      guardianId: guardian.id,
      ip: clientIp,
      details: { attempt: newAttempts },
      success: false
    });

    const remaining = 5 - newAttempts;
    if (remaining <= 0) {
      await prisma.guardian.update({
        where: { id: guardian.id },
        data: { otpHash: null, otpExpiry: null, otpAttempts: 0 }
      });
      throw new Error('Too many incorrect attempts. This verification code has been invalidated. Please request a new code.');
    }

    throw new Error(`Invalid verification code. ${remaining} attempt(s) remaining.`);
  }

  // OTP Matches: Single-use invalidation & Verification Mark
  const isConsentGranted = guardian.consentStatus === 'GRANTED';

  const updated = await prisma.guardian.update({
    where: { id: guardian.id },
    data: {
      isVerified: true,
      emailVerifiedAt: new Date(),
      verificationMethod: 'EMAIL',
      isMonitoringActive: isConsentGranted,
      otpHash: null,
      otpExpiry: null,
      otpAttempts: 0
    }
  });

  // Track in-app notification for the student
  await prisma.notification.create({
    data: {
      userId: studentUserId,
      type: 'GENERAL',
      title: 'Guardian Contact Verified',
      message: `Your guardian (${guardian.name || guardian.email}) has been successfully verified via Email OTP.`,
      channel: 'IN_APP',
      deliveryStatus: 'DELIVERED'
    }
  });

  auditLog('GUARDIAN_OTP_VERIFIED', {
    studentId: studentUserId,
    guardianId: guardian.id,
    ip: clientIp,
    details: { method: 'EMAIL', monitoringActive: isConsentGranted }
  });

  return {
    success: true,
    message: 'Guardian contact successfully verified via email OTP.',
    isVerified: true,
    isMonitoringActive: isConsentGranted,
    consentStatus: guardian.consentStatus,
    verificationMethod: 'EMAIL'
  };
};

/**
 * Get guardian status for the authenticated student
 */
const getGuardianStatus = async (studentUserId) => {
  const learner = await prisma.user.findUnique({
    where: { id: studentUserId },
    include: { studentProfile: true }
  });

  if (!learner) {
    throw new Error('Student account not found.');
  }

  const age = calculateAge(learner.dateOfBirth);
  const minor = isMinor(learner.dateOfBirth);

  if (!minor) {
    // Student is 18 or older: revoke any active monitoring and summary links
    const existingActiveGuardian = await prisma.guardian.findFirst({
      where: { minorStudentId: studentUserId, isMonitoringActive: true }
    });
    if (existingActiveGuardian) {
      await prisma.$transaction([
        prisma.guardian.update({
          where: { id: existingActiveGuardian.id },
          data: {
            isMonitoringActive: false,
            accessRevokedAt: new Date(),
            accessRevokedReason: 'STUDENT_REACHED_AGE_18'
          }
        }),
        prisma.guardianAccessToken.updateMany({
          where: { guardianId: existingActiveGuardian.id, revokedAt: null },
          data: { revokedAt: new Date() }
        })
      ]);
    }

    // For adults, guardian details and setup are strictly omitted
    return {
      isMinor: false,
      age,
      dateOfBirth: learner.dateOfBirth,
      hasGuardian: false,
      guardian: null,
      environment: process.env.NODE_ENV || 'development'
    };
  }

  const guardian = await prisma.guardian.findFirst({
    where: { minorStudentId: studentUserId },
    include: {
      accessTokens: {
        where: { revokedAt: null, expiresAt: { gt: new Date() } },
        orderBy: { createdAt: 'desc' },
        take: 1
      }
    }
  });

  // Safe DTO for minor student
  return {
    isMinor: true,
    age,
    dateOfBirth: learner.dateOfBirth,
    hasGuardian: !!guardian,
    guardian: guardian ? {
      id: guardian.id,
      name: guardian.name,
      relationship: guardian.relationship,
      email: guardian.email,
      phone: guardian.phone,
      isVerified: guardian.isVerified,
      emailVerifiedAt: guardian.emailVerifiedAt,
      verificationMethod: guardian.verificationMethod || 'EMAIL',
      otpMethod: 'EMAIL',
      lastOtpSentAt: guardian.lastOtpSentAt,
      otpPending: Boolean(guardian.otpHash && guardian.otpExpiry && new Date() < new Date(guardian.otpExpiry)),
      isMonitoringActive: guardian.isMonitoringActive,
      consentStatus: guardian.consentStatus,
      consentTimestamp: guardian.consentTimestamp,
      consentPolicyVersion: guardian.consentPolicyVersion,
      notificationPreferences: guardian.notificationPreferences || {
        emailPayments: true,
        emailSessions: true,
        emailAssignments: true,
        emailProgress: true,
        emailComplaints: true
      },
      accessRevokedAt: guardian.accessRevokedAt,
      accessRevokedReason: guardian.accessRevokedReason,
      hasActiveSummaryLink: guardian.accessTokens.length > 0,
      activeSummaryLinkExpiresAt: guardian.accessTokens[0]?.expiresAt || null
    } : null,
    environment: process.env.NODE_ENV || 'development'
  };
};

/**
 * Generate a secure, expiring 24-hour summary link
 */
const createSummaryLink = async (studentUserId, clientIp = null) => {
  // Rate limit: max 5 requests per hour
  if (isRateLimited(summaryLinkRateLimitMap, studentUserId, 5, 3600 * 1000)) {
    throw new Error('Too many summary link requests. Please wait before generating another link.');
  }

  const learner = await prisma.user.findUnique({
    where: { id: studentUserId }
  });

  if (!learner || !learner.dateOfBirth || !isMinor(learner.dateOfBirth)) {
    throw new Error('Summary links are only available for minor students with active guardian monitoring.');
  }

  const guardian = await prisma.guardian.findFirst({
    where: { minorStudentId: studentUserId }
  });

  if (!guardian) {
    throw new Error('Guardian setup is incomplete.');
  }

  if (!guardian.isVerified) {
    throw new Error('Guardian contact must be verified before generating a summary link.');
  }

  if (!guardian.isMonitoringActive) {
    throw new Error('Guardian monitoring is currently inactive or revoked.');
  }

  // Generate cryptographically secure random token
  const rawToken = crypto.randomBytes(32).toString('hex');
  const tokenHash = hashToken(rawToken);
  const expiresAt = new Date(Date.now() + TOKEN_EXPIRY_HOURS * 60 * 60 * 1000);

  // Invalidate previous active tokens for this guardian
  await prisma.guardianAccessToken.updateMany({
    where: { guardianId: guardian.id, revokedAt: null },
    data: { revokedAt: new Date() }
  });

  // Store only the hash in database
  const createdToken = await prisma.guardianAccessToken.create({
    data: {
      guardianId: guardian.id,
      tokenHash,
      expiresAt
    }
  });

  auditLog('GUARDIAN_SUMMARY_LINK_CREATED', {
    studentId: studentUserId,
    guardianId: guardian.id,
    ip: clientIp,
    details: { tokenId: createdToken.id, expiresAt }
  });

  const summaryUrl = `${CLIENT_URL}/guardian/summary/${rawToken}`;

  return {
    success: true,
    summaryUrl,
    token: rawToken,
    expiresAt,
    expiresInHours: TOKEN_EXPIRY_HOURS
  };
};

/**
 * Get allowlisted read-only summary via raw access token
 */
const getSummaryByToken = async (rawToken, clientIp = null) => {
  // Rate limit by IP: max 30 attempts per minute
  if (isRateLimited(tokenAttemptRateLimitMap, clientIp || 'ip_unknown', 30, 60 * 1000)) {
    throw new Error('Too many requests. Please try again later.');
  }

  if (!rawToken || typeof rawToken !== 'string') {
    throw new Error('Access token is missing or malformed.');
  }

  const tokenHash = hashToken(rawToken);

  const tokenRecord = await prisma.guardianAccessToken.findUnique({
    where: { tokenHash },
    include: {
      guardian: {
        include: {
          learner: {
            include: {
              studentProfile: true
            }
          }
        }
      }
    }
  });

  if (!tokenRecord) {
    auditLog('GUARDIAN_SUMMARY_ACCESS_DENIED', { ip: clientIp, details: { reason: 'TOKEN_NOT_FOUND' }, success: false });
    const err = new Error('Invalid, expired, or revoked summary link.');
    err.status = 404;
    throw err;
  }

  if (tokenRecord.revokedAt) {
    auditLog('GUARDIAN_SUMMARY_ACCESS_DENIED', { guardianId: tokenRecord.guardianId, ip: clientIp, details: { reason: 'TOKEN_REVOKED' }, success: false });
    const err = new Error('This summary link has been revoked.');
    err.status = 410;
    throw err;
  }

  if (new Date() > new Date(tokenRecord.expiresAt)) {
    auditLog('GUARDIAN_SUMMARY_ACCESS_DENIED', { guardianId: tokenRecord.guardianId, ip: clientIp, details: { reason: 'TOKEN_EXPIRED' }, success: false });
    const err = new Error('This summary link has expired.');
    err.status = 410;
    throw err;
  }

  const { guardian } = tokenRecord;
  const { learner } = guardian;

  // AGE 18 TRANSITION ENFORCEMENT
  const currentAge = calculateAge(learner.dateOfBirth);
  if (currentAge !== null && currentAge >= 18) {
    // Automatically revoke monitoring and link
    await prisma.$transaction([
      prisma.guardianAccessToken.updateMany({
        where: { guardianId: guardian.id, revokedAt: null },
        data: { revokedAt: new Date() }
      }),
      prisma.guardian.update({
        where: { id: guardian.id },
        data: {
          isMonitoringActive: false,
          accessRevokedAt: new Date(),
          accessRevokedReason: 'STUDENT_REACHED_AGE_18'
        }
      })
    ]);

    auditLog('GUARDIAN_AGE_18_TRANSITION_APPLIED', {
      studentId: learner.id,
      guardianId: guardian.id,
      ip: clientIp,
      details: { age: currentAge }
    });

    const err = new Error('Student has reached 18 years of age. Guardian monitoring access has concluded in accordance with platform policy.');
    err.status = 403;
    err.code = 'STUDENT_TRANSITIONED_18';
    throw err;
  }

  if (!guardian.isMonitoringActive) {
    const err = new Error('Guardian monitoring access is currently inactive or revoked.');
    err.status = 403;
    throw err;
  }

  // Update last used timestamp
  await prisma.guardianAccessToken.update({
    where: { id: tokenRecord.id },
    data: { lastUsedAt: new Date() }
  });

  auditLog('GUARDIAN_SUMMARY_ACCESSED', {
    studentId: learner.id,
    guardianId: guardian.id,
    ip: clientIp,
    details: { tokenId: tokenRecord.id }
  });

  // Query allowlisted data only
  const studentProfileId = learner.studentProfile?.id;

  // 1. Goals & Milestones
  const goals = studentProfileId ? await prisma.goal.findMany({
    where: { studentId: studentProfileId },
    select: {
      id: true,
      title: true,
      status: true,
      targetDate: true,
      createdAt: true,
      milestones: {
        select: {
          id: true,
          title: true,
          status: true,
          dueDate: true
        }
      }
    },
    orderBy: { createdAt: 'desc' }
  }) : [];

  let totalMilestones = 0;
  let completedMilestones = 0;
  goals.forEach(g => {
    (g.milestones || []).forEach(m => {
      totalMilestones++;
      if (m.status === 'COMPLETED') completedMilestones++;
    });
  });

  // 2. Mentoring Sessions (Allowlisted: mentor public name, topic, scheduledAt, duration, status)
  const sessions = studentProfileId ? await prisma.session.findMany({
    where: {
      mentorship: { studentId: studentProfileId },
      OR: [
        { payment: null },
        { payment: { amount: 0 } },
        { payment: { status: 'PAID' } }
      ]
    },
    select: {
      id: true,
      scheduledAt: true,
      duration: true,
      status: true,
      topic: true,
      mentorship: {
        select: {
          mentor: {
            select: {
              user: {
                select: { name: true }
              }
            }
          }
        }
      }
    },
    orderBy: { scheduledAt: 'desc' },
    take: 15
  }) : [];

  const formattedSessions = sessions.map(s => ({
    id: s.id,
    mentorName: s.mentorship?.mentor?.user?.name || 'Assigned Mentor',
    topic: s.topic || 'Mentoring Session',
    scheduledAt: s.scheduledAt,
    durationMinutes: s.duration,
    status: s.status
  }));

  // 3. Assignments (Allowlisted: title, description, dueDate, status, submissionStatus)
  const assignments = studentProfileId ? await prisma.assignment.findMany({
    where: { studentId: studentProfileId },
    select: {
      id: true,
      title: true,
      description: true,
      dueDate: true,
      status: true,
      submissions: {
        select: {
          status: true,
          submittedAt: true,
          reviewedAt: true
        },
        orderBy: { submittedAt: 'desc' },
        take: 1
      }
    },
    orderBy: { createdAt: 'desc' },
    take: 15
  }) : [];

  const now = new Date();
  const formattedAssignments = assignments.map(a => {
    const latestSub = a.submissions[0] || null;
    const isOverdue = a.dueDate && new Date(a.dueDate) < now && a.status !== 'REVIEWED' && (!latestSub || latestSub.status !== 'SUBMITTED');
    return {
      id: a.id,
      title: a.title,
      description: a.description,
      dueDate: a.dueDate,
      status: a.status,
      submissionStatus: latestSub ? latestSub.status : 'NOT_SUBMITTED',
      isOverdue
    };
  });

  // 4. Payments (Allowlisted: amount, status, date, session topic - NO credentials/secrets)
  const payments = studentProfileId ? await prisma.payment.findMany({
    where: { studentId: studentProfileId },
    select: {
      id: true,
      amount: true,
      currency: true,
      status: true,
      createdAt: true,
      paidAt: true,
      session: {
        select: {
          topic: true,
          scheduledAt: true
        }
      }
    },
    orderBy: { createdAt: 'desc' },
    take: 10
  }) : [];

  const formattedPayments = payments.map(p => ({
    id: p.id,
    amount: p.amount,
    currency: p.currency,
    status: p.status,
    paymentDate: p.paidAt || p.createdAt,
    sessionTopic: p.session?.topic || 'Mentoring Session'
  }));

  // 5. Authorized Complaints and Safeguarding Summary
  // Strictly filter confidential details, private messages, and internal notes
  const complaints = await prisma.complaint.findMany({
    where: {
      reporterId: learner.id
    },
    select: {
      id: true,
      category: true,
      status: true,
      resolution: true,
      createdAt: true,
      resolvedAt: true
    },
    orderBy: { createdAt: 'desc' },
    take: 5
  });

  const formattedComplaints = complaints.map(c => ({
    id: c.id,
    category: c.category,
    status: c.status,
    resolutionSummary: c.status === 'RESOLVED' ? (c.resolution || 'Resolution completed by moderation team.') : null,
    filedDate: c.createdAt
  }));

  return {
    student: {
      name: learner.name,
      displayFirstName: learner.name.split(' ')[0]
    },
    guardian: {
      name: guardian.name,
      relationship: guardian.relationship,
      email: guardian.email
    },
    lastUpdated: new Date().toISOString(),
    linkExpiresAt: tokenRecord.expiresAt,
    learningProgress: {
      totalGoals: goals.length,
      activeGoals: goals.filter(g => g.status === 'ACTIVE').length,
      totalMilestones,
      completedMilestones,
      completionPercentage: totalMilestones > 0 ? Math.round((completedMilestones / totalMilestones) * 100) : 0,
      goals
    },
    upcomingSessions: formattedSessions.filter(s => new Date(s.scheduledAt) >= now && s.status === 'SCHEDULED'),
    recentSessions: formattedSessions.filter(s => new Date(s.scheduledAt) < now || s.status !== 'SCHEDULED'),
    assignments: formattedAssignments,
    payments: formattedPayments,
    complaintUpdates: formattedComplaints,
    safetyNotice: {
      policy: 'MentorConnect safeguards student privacy. Direct student-mentor chat transcripts and private AI assistant conversations are strictly confidential and inaccessible.',
      supportContact: 'safeguarding@mentorconnect.edu'
    }
  };
};

/**
 * Update notification preferences for guardian
 * Note: Guardian notifications are mandatory under platform policy; customization is disallowed.
 */
const updateNotificationPreferences = async (studentUserId, preferences) => {
  throw new Error('Guardian notifications are mandatory for minor safeguarding under platform policy and cannot be customized or disabled.');
};

/**
 * Revoke guardian monitoring by the student
 */
const revokeGuardianAccess = async (studentUserId, reason = 'REVOKED_BY_STUDENT', clientIp = null) => {
  const guardian = await prisma.guardian.findFirst({
    where: { minorStudentId: studentUserId }
  });

  if (!guardian) {
    throw new Error('No guardian record found to revoke.');
  }

  await prisma.$transaction([
    prisma.guardian.update({
      where: { id: guardian.id },
      data: {
        isMonitoringActive: false,
        accessRevokedAt: new Date(),
        accessRevokedReason: reason
      }
    }),
    prisma.guardianAccessToken.updateMany({
      where: { guardianId: guardian.id, revokedAt: null },
      data: { revokedAt: new Date() }
    })
  ]);

  if (guardian.email && guardian.isVerified) {
    await emailService.sendMail({
      to: guardian.email,
      subject: 'MentorConnect — Guardian Monitoring Discontinued',
      html: `
        <div style="font-family: sans-serif; max-width: 600px; padding: 20px;">
          <h3>Guardian Monitoring Update</h3>
          <p>Guardian monitoring updates for your linked student have been discontinued (${reason === 'STUDENT_REACHED_AGE_18' ? 'Student has reached 18 years of age' : 'Updated by learner'}).</p>
          <p style="font-size: 12px; color: #64748b;">Previous summary links have been revoked.</p>
        </div>
      `,
      eventType: 'GENERAL'
    });
  }

  auditLog('GUARDIAN_ACCESS_REVOKED', {
    studentId: studentUserId,
    guardianId: guardian.id,
    ip: clientIp,
    details: { reason }
  });

  return { success: true, message: 'Guardian monitoring access has been revoked.' };
};

/**
 * Trigger guardian event notification
 */
const notifyGuardianEvent = async (studentUserId, eventType, { title, message, referenceId = null, referenceType = null, metadata = {} }) => {
  try {
    const learner = await prisma.user.findUnique({
      where: { id: studentUserId },
      include: {
        guardians: {
          where: { isVerified: true, isMonitoringActive: true, consentStatus: 'GRANTED' }
        }
      }
    });

    if (!learner || !learner.guardians || learner.guardians.length === 0) {
      return null; // No verified active guardian
    }

    // Verify student is still a minor
    if (!isMinor(learner.dateOfBirth)) {
      return null;
    }

    const guardian = learner.guardians[0];
    // Note: Guardian notifications are mandatory under platform policy and are never suppressed by preferences.

    // Deduplication check: prevent sending duplicate notification for same event & referenceId within 1 hour
    if (referenceId) {
      const existingNotif = await prisma.notification.findFirst({
        where: {
          guardianId: guardian.id,
          referenceId,
          title,
          createdAt: { gt: new Date(Date.now() - 3600 * 1000) }
        }
      });
      if (existingNotif) {
        logger.info(`[Guardian Notification Deduplicated] ${title} for reference ${referenceId}`);
        return null;
      }
    }

    const subject = `MentorConnect: ${title}`;
    const html = `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; color: #1e293b; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 8px;">
        <h3 style="color: #1e3a8a; margin-top: 0;">${title}</h3>
        <p style="font-size: 15px; line-height: 1.6;">Hello ${guardian.name || 'Guardian'},</p>
        <p style="font-size: 15px; line-height: 1.6; color: #334155;">
          Update regarding <strong>${learner.name}</strong>:
        </p>
        <div style="background: #f8fafc; padding: 16px; border-radius: 6px; border-left: 4px solid #3b82f6; margin: 20px 0; font-size: 15px; line-height: 1.6;">
          ${message}
        </div>
        <p style="font-size: 12px; color: #64748b; line-height: 1.5;">
          You received this email because you are registered and verified as a guardian on MentorConnect. Private chats and confidential investigation details are never included.
        </p>
      </div>
    `;

    const sendResult = await emailService.sendMail({
      to: guardian.email,
      subject,
      html,
      eventType: eventType === 'PAYMENT' ? 'PAYMENT' : 'GENERAL',
      metadata
    });

    // Record notification in database
    const notif = await prisma.notification.create({
      data: {
        userId: studentUserId,
        guardianId: guardian.id,
        type: eventType === 'PAYMENT' ? 'PAYMENT' : (eventType === 'ASSIGNMENT' ? 'ASSIGNMENT' : (eventType === 'COMPLAINT' ? 'COMPLAINT' : 'GENERAL')),
        title,
        message,
        referenceId,
        referenceType,
        channel: 'EMAIL',
        deliveryStatus: sendResult.success ? 'DELIVERED' : 'FAILED',
        recipientEmail: guardian.email,
        sentAt: new Date(),
        errorMessage: sendResult.error || null
      }
    });

    return notif;
  } catch (err) {
    logger.error(`Error notifying guardian event: ${err.message}`);
    return null;
  }
};

module.exports = {
  saveOrUpdateContact,
  recordConsent,
  sendVerificationEmail,
  confirmVerification,
  sendGuardianOtp,
  verifyGuardianOtp,
  getGuardianStatus,
  createSummaryLink,
  getSummaryByToken,
  updateNotificationPreferences,
  revokeGuardianAccess,
  notifyGuardianEvent,
  hashToken
};
