const logger = require('../utils/logger');

// Development test outbox for SMS inspection during testing/local development
const smsOutbox = [];

/**
 * Checks whether a production SMS provider (Twilio) is configured
 */
const isSmsConfigured = () => {
  return Boolean(
    process.env.TWILIO_ACCOUNT_SID &&
    process.env.TWILIO_AUTH_TOKEN &&
    process.env.TWILIO_PHONE_NUMBER
  );
};

/**
 * Validates international / standard phone number format
 * Accepts numbers with optional '+' prefix, country code, and at least 10 digits
 */
const validatePhoneNumber = (phone) => {
  if (!phone || typeof phone !== 'string') return false;
  // Clean whitespace, hyphens, and brackets
  const cleaned = phone.trim().replace(/[\s\-\(\)]/g, '');
  // Must match standard E.164-compatible phone number (10 to 15 digits)
  const phoneRegex = /^\+?[1-9]\d{9,14}$/;
  return phoneRegex.test(cleaned);
};

/**
 * Sends an SMS message to a recipient phone number
 * @param {Object} options { to, message, eventType, metadata }
 * @returns {Promise<{ success: boolean, messageId?: string, error?: string, simulated: boolean, configured: boolean, note?: string }>}
 */
const sendSms = async ({ to, message, eventType = 'OTP', metadata = {} }) => {
  if (!to) {
    throw new Error('Recipient phone number is required.');
  }

  // Strict Phone Number Validation
  if (!validatePhoneNumber(to)) {
    return {
      success: false,
      error: 'Invalid phone number format. Please provide a valid phone number with country code (e.g., +91 9876543210).',
      simulated: false,
      configured: isSmsConfigured()
    };
  }

  const configured = isSmsConfigured();

  // If Twilio is configured, attempt real delivery
  if (configured) {
    try {
      // Dynamic require so twilio package is optional when not installed
      const twilio = require('twilio');
      const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
      const res = await client.messages.create({
        body: message,
        from: process.env.TWILIO_PHONE_NUMBER,
        to: to.trim()
      });

      logger.info(`[SMS Sent] To: ${to} | SID: ${res.sid}`);
      return {
        success: true,
        messageId: res.sid,
        simulated: false,
        configured: true,
        note: 'SMS successfully dispatched via Twilio'
      };
    } catch (err) {
      logger.error(`[SMS Delivery Failure] To: ${to} | Error: ${err.message}`);
      return {
        success: false,
        error: `Twilio delivery failed: ${err.message}`,
        simulated: false,
        configured: true
      };
    }
  }

  // Not configured in production: truthfully reject and do not pretend success
  if (process.env.NODE_ENV === 'production') {
    logger.warn(`[SMS Not Configured] Attempted to send SMS to ${to} in production without provider credentials.`);
    return {
      success: false,
      error: 'SMS service is not configured. Please use Email verification or contact platform support.',
      simulated: false,
      configured: false
    };
  }

  // Local development / testing mode with explicit dev outbox
  const simulatedId = `sms_sim_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
  const smsRecord = {
    to: to.trim(),
    message,
    eventType,
    metadata,
    sentAt: new Date(),
    messageId: simulatedId,
    status: 'DELIVERED_DEV_OUTBOX'
  };

  smsOutbox.push(smsRecord);
  logger.info(`[SMS Dev Outbox] To: ${to} | Content: ${message} | ID: ${simulatedId}`);

  return {
    success: true,
    messageId: simulatedId,
    simulated: true,
    configured: false,
    note: 'Twilio SMS credentials are not configured in this environment. The SMS was SIMULATED in the local development outbox and was NOT sent to your physical phone.'
  };
};

/**
 * Access outbox for testing / inspection in development
 */
const getSmsOutbox = () => [...smsOutbox];
const clearSmsOutbox = () => { smsOutbox.length = 0; };

/**
 * Get the latest simulated SMS for a given phone number (Development only)
 */
const getLatestSmsForPhone = (phone) => {
  if (!phone) return null;
  const cleanPhone = phone.trim().replace(/[\s\-\(\)]/g, '');
  const matches = smsOutbox.filter(item => item.to.replace(/[\s\-\(\)]/g, '') === cleanPhone);
  return matches.length > 0 ? matches[matches.length - 1] : null;
};

module.exports = {
  isSmsConfigured,
  validatePhoneNumber,
  sendSms,
  getSmsOutbox,
  clearSmsOutbox,
  getLatestSmsForPhone
};
