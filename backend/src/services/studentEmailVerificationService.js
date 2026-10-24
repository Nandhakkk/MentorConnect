const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const prisma = require('../config/db');
const emailService = require('./emailService');
const logger = require('../utils/logger');

const emailRateLimitMap = new Map(); // key: studentUserId -> array of timestamps

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

const maskEmail = (email) => {
  if (!email || !email.includes('@')) return email || '';
  const [local, domain] = email.split('@');
  if (local.length <= 2) return `${local[0]}*@${domain}`;
  return `${local.slice(0, 2)}${'*'.repeat(Math.max(1, local.length - 4))}${local.slice(-2)}@${domain}`;
};

const hashToken = (token) => {
  return crypto.createHash('sha256').update(String(token)).digest('hex');
};

/**
 * Initiate an email change request for the student
 */
const requestEmailChange = async (studentUserId, newEmail, clientIp = null) => {
  if (!newEmail || typeof newEmail !== 'string') {
    throw new Error('Please provide a valid email address.');
  }

  const normalizedEmail = newEmail.toLowerCase().trim();
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(normalizedEmail)) {
    throw new Error('Please provide a valid email address format.');
  }

  const user = await prisma.user.findUnique({
    where: { id: studentUserId }
  });

  if (!user) {
    throw new Error('User account not found.');
  }

  // Detect if requested email is identical to current email
  if (normalizedEmail === user.email.toLowerCase().trim()) {
    throw new Error('The new email address cannot be the same as your current email address.');
  }

  // Check if email already assigned to another account
  const existingUser = await prisma.user.findFirst({
    where: {
      email: normalizedEmail,
      id: { not: studentUserId }
    }
  });

  if (existingUser) {
    throw new Error('An account with this email address already exists.');
  }

  // Check cooldown (60 seconds)
  if (user.lastEmailOtpSentAt) {
    const elapsedSeconds = Math.floor((Date.now() - new Date(user.lastEmailOtpSentAt).getTime()) / 1000);
    if (elapsedSeconds < 60) {
      const waitTime = 60 - elapsedSeconds;
      throw new Error(`Please wait ${waitTime} seconds before requesting another verification code.`);
    }
  }

  // Hourly rate limit: max 5 requests per hour
  if (isRateLimited(emailRateLimitMap, studentUserId, 5, 3600 * 1000)) {
    throw new Error('Too many email verification requests. Please wait before trying again.');
  }

  // Generate secure 6-digit OTP
  const rawOtp = crypto.randomInt(100000, 1000000).toString();
  const otpHash = hashToken(rawOtp);
  const expiry = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

  // Store in pending fields without touching active user.email
  await prisma.user.update({
    where: { id: studentUserId },
    data: {
      pendingEmail: normalizedEmail,
      emailOtpHash: otpHash,
      emailOtpExpiry: expiry,
      emailOtpAttempts: 0,
      lastEmailOtpSentAt: new Date()
    }
  });

  const studentFirstName = user.name.split(' ')[0];

  const html = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 32px 24px; color: #1e293b; background-color: #ffffff; border-radius: 12px; border: 1px solid #e2e8f0; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);">
      <div style="border-bottom: 2px solid #3b82f6; padding-bottom: 16px; margin-bottom: 24px;">
        <h2 style="color: #1e3a8a; margin: 0; font-size: 22px; font-weight: 700; letter-spacing: -0.5px;">MentorConnect</h2>
        <p style="margin: 4px 0 0 0; color: #64748b; font-size: 13px;">Account Email Verification</p>
      </div>
      <p style="font-size: 15px; line-height: 1.6; margin-bottom: 16px;">Hello ${studentFirstName},</p>
      <p style="font-size: 15px; line-height: 1.6; margin-bottom: 20px;">
        You requested to update your MentorConnect account email address to <strong>${normalizedEmail}</strong>.
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
          ⚠️ <strong>Security Warning:</strong> Do not share this code with anyone. MentorConnect staff will never ask for your verification code.
        </p>
      </div>
      <div style="font-size: 13px; line-height: 1.5; color: #64748b; background: #f8fafc; padding: 14px; border-radius: 6px; border: 1px solid #e2e8f0; margin-bottom: 24px;">
        🔒 If you did not request this change, please ignore this email. Your account remains secured with your existing email address (${maskEmail(user.email)}).
      </div>
      <hr style="border: 0; border-top: 1px solid #e2e8f0; margin: 24px 0;" />
      <p style="font-size: 12px; color: #94a3b8; text-align: center; margin: 0;">
        MentorConnect Platform · Account Security &amp; Privacy
      </p>
    </div>
  `;

  try {
    const sendRes = await emailService.sendMail({
      to: normalizedEmail,
      subject: `MentorConnect Verification Code: ${rawOtp} for Email Change`,
      html,
      eventType: 'GENERAL',
      metadata: { userId: studentUserId, action: 'STUDENT_EMAIL_CHANGE' }
    });

    if (!sendRes.success) {
      throw new Error(`Failed to deliver verification email: ${sendRes.error}`);
    }
  } catch (sendErr) {
    // Delivery failed: rollback pending fields on user to prevent unverified state and unblock retry
    await prisma.user.update({
      where: { id: studentUserId },
      data: {
        pendingEmail: null,
        emailOtpHash: null,
        emailOtpExpiry: null,
        emailOtpAttempts: 0,
        lastEmailOtpSentAt: null
      }
    }).catch(() => {});
    throw sendErr;
  }

  logger.info(`[Student Email Change Requested] User: ${studentUserId} -> Pending: ${normalizedEmail}`);

  return {
    success: true,
    message: `A verification code has been sent to ${normalizedEmail}. Please enter the 6-digit code to complete updating your email.`,
    currentEmail: user.email,
    pendingEmail: normalizedEmail,
    recipient: maskEmail(normalizedEmail),
    expiresAt: expiry,
    cooldownSeconds: 60
  };
};

/**
 * Verify OTP and finalize email change
 */
const verifyEmailChange = async (studentUserId, otp, clientIp = null) => {
  if (!otp || typeof otp !== 'string' || !/^\d{6}$/.test(otp.trim())) {
    throw new Error('Please enter a valid 6-digit verification code.');
  }

  const user = await prisma.user.findUnique({
    where: { id: studentUserId }
  });

  if (!user) {
    throw new Error('User account not found.');
  }

  if (!user.pendingEmail || !user.emailOtpHash || !user.emailOtpExpiry) {
    throw new Error('No pending email verification found. Please request an email change first.');
  }

  // Max incorrect attempts check
  if (user.emailOtpAttempts >= 5) {
    await prisma.user.update({
      where: { id: studentUserId },
      data: {
        pendingEmail: null,
        emailOtpHash: null,
        emailOtpExpiry: null,
        emailOtpAttempts: 0
      }
    });
    throw new Error('Too many incorrect attempts. This verification code has been invalidated. Please request a new email change.');
  }

  // Check expiration
  if (new Date() > new Date(user.emailOtpExpiry)) {
    throw new Error('Verification code has expired. Please request a new verification code.');
  }

  // Validate OTP hash
  const inputHash = hashToken(otp.trim());
  if (inputHash !== user.emailOtpHash) {
    const newAttempts = user.emailOtpAttempts + 1;
    await prisma.user.update({
      where: { id: studentUserId },
      data: { emailOtpAttempts: newAttempts }
    });

    const remaining = 5 - newAttempts;
    if (remaining <= 0) {
      await prisma.user.update({
        where: { id: studentUserId },
        data: {
          pendingEmail: null,
          emailOtpHash: null,
          emailOtpExpiry: null,
          emailOtpAttempts: 0
        }
      });
      throw new Error('Too many incorrect attempts. This verification code has been invalidated. Please request a new email change.');
    }

    throw new Error(`Invalid verification code. ${remaining} attempt(s) remaining.`);
  }

  // Final concurrency check: ensure pendingEmail wasn't registered by someone else
  const conflict = await prisma.user.findFirst({
    where: {
      email: user.pendingEmail,
      id: { not: studentUserId }
    }
  });

  if (conflict) {
    await prisma.user.update({
      where: { id: studentUserId },
      data: { pendingEmail: null, emailOtpHash: null, emailOtpExpiry: null }
    });
    throw new Error('The requested email address is now associated with another account. Please use a different email.');
  }

  const verifiedEmail = user.pendingEmail;
  const verifiedAt = new Date();

  // Atomically update user email, set verified, and clear pending OTP fields
  const updatedUser = await prisma.user.update({
    where: { id: studentUserId },
    data: {
      email: verifiedEmail,
      pendingEmail: null,
      isEmailVerified: true,
      emailVerifiedAt: verifiedAt,
      emailOtpHash: null,
      emailOtpExpiry: null,
      emailOtpAttempts: 0,
      lastEmailOtpSentAt: null
    }
  });

  // Track in-app notification
  await prisma.notification.create({
    data: {
      userId: studentUserId,
      type: 'GENERAL',
      title: 'Account Email Updated',
      message: `Your account email address was successfully updated and verified to ${verifiedEmail}.`,
      channel: 'IN_APP',
      deliveryStatus: 'DELIVERED'
    }
  });

  logger.info(`[Student Email Change Verified] User: ${studentUserId} is now ${verifiedEmail}`);

  const secret = process.env.JWT_SECRET || 'mentorconnect_super_secret_jwt_key';
  const expiresIn = process.env.JWT_EXPIRES_IN || '7d';
  const token = jwt.sign({ id: updatedUser.id, role: updatedUser.role }, secret, { expiresIn });

  return {
    success: true,
    message: 'Email address updated and verified successfully.',
    token,
    user: {
      id: updatedUser.id,
      name: updatedUser.name,
      email: updatedUser.email,
      role: updatedUser.role,
      isEmailVerified: true,
      emailVerifiedAt: updatedUser.emailVerifiedAt
    },
    email: updatedUser.email,
    isEmailVerified: true,
    emailVerifiedAt: updatedUser.emailVerifiedAt
  };
};

/**
 * Resend verification OTP to the pending email address
 */
const resendEmailChangeOtp = async (studentUserId, clientIp = null) => {
  const user = await prisma.user.findUnique({
    where: { id: studentUserId }
  });

  if (!user || !user.pendingEmail) {
    throw new Error('No pending email change to resend verification for.');
  }

  return requestEmailChange(studentUserId, user.pendingEmail, clientIp);
};

/**
 * Cancel a pending email change
 */
const cancelEmailChange = async (studentUserId) => {
  const user = await prisma.user.findUnique({
    where: { id: studentUserId }
  });

  if (!user) {
    throw new Error('User not found.');
  }

  await prisma.user.update({
    where: { id: studentUserId },
    data: {
      pendingEmail: null,
      emailOtpHash: null,
      emailOtpExpiry: null,
      emailOtpAttempts: 0
    }
  });

  return {
    success: true,
    message: 'Pending email change cancelled.'
  };
};

module.exports = {
  requestEmailChange,
  verifyEmailChange,
  resendEmailChangeOtp,
  cancelEmailChange,
  maskEmail,
  hashToken
};
