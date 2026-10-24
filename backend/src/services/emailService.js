const path = require('path');
const dotenv = require('dotenv');
const nodemailer = require('nodemailer');
const logger = require('../utils/logger');

// Ensure environment variables from backend/.env are loaded even if required standalone
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

let transporter = null;
let testMockTransport = null;

/**
 * Mask an email address safely for diagnostic logs (e.g. ab***cd@domain.com)
 */
const maskEmail = (email) => {
  if (!email || typeof email !== 'string' || !email.includes('@')) return email ? 'configured' : 'missing';
  const [local, domain] = email.split('@');
  if (local.length <= 2) return `${local[0]}*@${domain}`;
  return `${local.slice(0, 2)}${'*'.repeat(Math.max(1, local.length - 4))}${local.slice(-2)}@${domain}`;
};

/**
 * Safe diagnostic that checks presence of each required environment variable
 * and verifies that SMTP_USER matches the email in SMTP_FROM without exposing secrets.
 */
const getSmtpDiagnostics = () => {
  // Reload .env from disk to capture any recent updates
  dotenv.config({ path: path.resolve(__dirname, '../../.env') });

  const host = process.env.SMTP_HOST;
  const port = process.env.SMTP_PORT;
  const secure = process.env.SMTP_SECURE;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  const from = process.env.SMTP_FROM;

  let fromEmail = null;
  if (from) {
    const match = from.match(/<([^>]+)>/);
    fromEmail = (match ? match[1] : from).trim().toLowerCase();
  }

  const userEmail = user ? user.trim().toLowerCase().replace(/['"]/g, '') : null;
  const cleanFromEmail = fromEmail ? fromEmail.replace(/['"]/g, '') : null;
  const userMatchesFrom = Boolean(userEmail && cleanFromEmail && userEmail === cleanFromEmail);

  const cleanPass = pass ? pass.replace(/\s+/g, '').replace(/['"]/g, '') : '';

  return {
    SMTP_HOST: { present: Boolean(host), value: host ? host.trim().replace(/['"]/g, '') : null },
    SMTP_PORT: { present: Boolean(port), value: port ? parseInt(port, 10) : 587 },
    SMTP_SECURE: { present: Boolean(secure), value: secure === 'true' },
    SMTP_USER: { present: Boolean(user), masked: maskEmail(userEmail) },
    SMTP_PASS: { present: Boolean(pass), length: cleanPass.length },
    SMTP_FROM: { present: Boolean(from), masked: maskEmail(cleanFromEmail) },
    userMatchesFrom,
    isComplete: Boolean(host && user && pass)
  };
};

/**
 * Configure Nodemailer SMTP transporter from environment variables
 * @param {boolean} forceRefresh Recreate transport instance with fresh configuration
 */
const getTransporter = (forceRefresh = false) => {
  if (transporter && !forceRefresh) return transporter;

  // Reload .env if refreshing
  if (forceRefresh) {
    dotenv.config({ path: path.resolve(__dirname, '../../.env') });
  }

  const host = process.env.SMTP_HOST;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  if (!host || !user || !pass) {
    return null;
  }

  try {
    const port = parseInt(process.env.SMTP_PORT || '587', 10);
    const secure = process.env.SMTP_SECURE === 'true' || port === 465;

    // Clean up any extraneous quotes, spaces, or carriage returns
    const cleanPass = pass.replace(/\s+/g, '').replace(/['"\r\n]/g, '');
    const cleanUser = user.trim().replace(/['"\r\n]/g, '');
    const cleanHost = host.trim().replace(/['"\r\n]/g, '');

    transporter = nodemailer.createTransport({
      host: cleanHost,
      port,
      secure,
      auth: {
        user: cleanUser,
        pass: cleanPass
      },
      tls: {
        rejectUnauthorized: process.env.NODE_ENV === 'production'
      }
    });

    logger.info(`[Email Service] Initialized SMTP transporter (${cleanHost}:${port}, secure=${secure}, user=${maskEmail(cleanUser)})`);
    return transporter;
  } catch (err) {
    logger.error(`[Email Service] Failed to initialize SMTP transporter: ${err.message}`);
    transporter = null;
    return null;
  }
};

/**
 * Test SMTP connectivity without exposing credentials
 */
const verifyConnection = async () => {
  const diagnostics = getSmtpDiagnostics();
  if (!diagnostics.isComplete) {
    return {
      success: false,
      error: 'SMTP credentials not configured. Please set SMTP_HOST, SMTP_PORT, SMTP_USER, and SMTP_PASS in backend/.env.',
      diagnostics
    };
  }

  // Re-instantiate transporter to ensure latest environment values are active
  const currentTransporter = getTransporter(true);
  if (!currentTransporter) {
    return {
      success: false,
      error: 'Failed to create SMTP transporter with current environment configuration.',
      diagnostics
    };
  }

  try {
    await currentTransporter.verify();
    logger.info(`[Email Service] SMTP connection verified successfully (Host: ${diagnostics.SMTP_HOST.value}:${diagnostics.SMTP_PORT.value}, User: ${diagnostics.SMTP_USER.masked}, MatchesFrom: ${diagnostics.userMatchesFrom}).`);
    return {
      success: true,
      diagnostics
    };
  } catch (err) {
    logger.error(`[Email Service] SMTP verification failed: ${err.message}`);
    return {
      success: false,
      error: `SMTP connection failed: ${err.message}`,
      diagnostics
    };
  }
};

/**
 * Format date for Asia/Kolkata timezone
 */
const formatKolkataDateTime = (dateVal) => {
  if (!dateVal) return 'N/A';
  const d = new Date(dateVal);
  if (isNaN(d.getTime())) return 'N/A';
  return d.toLocaleString('en-IN', {
    timeZone: 'Asia/Kolkata',
    dateStyle: 'medium',
    timeStyle: 'short'
  });
};

/**
 * Sends a real email via Nodemailer SMTP with automatic retry
 * @param {Object} mailOptions { to, subject, html, text, eventType, metadata }
 * @returns {Promise<{ success: boolean, messageId?: string, error?: string }>}
 */
const sendMail = async ({ to, subject, html, text, eventType = 'GENERAL', metadata = {} }) => {
  if (!to || typeof to !== 'string') {
    throw new Error('Recipient email is required.');
  }

  const from = process.env.SMTP_FROM || process.env.EMAIL_FROM || '"MentorConnect" <notifications@mentorconnect.edu>';

  // Check if test-only mock transport is active (for automated tests only)
  if (testMockTransport && process.env.NODE_ENV !== 'production') {
    return testMockTransport.sendMail({
      from,
      to,
      subject,
      html,
      text: text || (html ? html.replace(/<[^>]*>?/gm, '') : ''),
      eventType,
      metadata
    });
  }

  const activeTransporter = getTransporter();
  if (!activeTransporter) {
    const configError = 'SMTP is not configured. Please set SMTP_HOST, SMTP_PORT, SMTP_USER, and SMTP_PASS in backend/.env to send real emails.';
    logger.error(`[Email Service] Delivery aborted: ${configError}`);
    throw new Error(configError);
  }

  const mailOptions = {
    from,
    to: to.trim(),
    subject,
    text: text || (html ? html.replace(/<[^>]*>?/gm, '') : ''),
    html
  };

  const MAX_RETRIES = 2;
  let lastError = null;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const info = await activeTransporter.sendMail(mailOptions);
      logger.info(`[Email Sent] To: ${to} | Subject: ${subject} | MessageId: ${info.messageId}`);
      return {
        success: true,
        messageId: info.messageId
      };
    } catch (err) {
      lastError = err;
      logger.warn(`[Email Attempt ${attempt + 1} Failed] To: ${to} | Error: ${err.message}`);
      if (attempt < MAX_RETRIES) {
        // Wait briefly before retry
        await new Promise(resolve => setTimeout(resolve, 300 * (attempt + 1)));
      }
    }
  }

  logger.error(`[Email Delivery Failure] To: ${to} | Final Error: ${lastError?.message}`);
  return {
    success: false,
    error: lastError?.message || 'SMTP delivery failure'
  };
};

/**
 * Test-only mock support: strictly disabled if NODE_ENV === 'production'
 */
const __setTestMockTransport = (mock) => {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('Cannot set test mock transport in production mode.');
  }
  testMockTransport = mock;
};

const __clearTestMockTransport = () => {
  testMockTransport = null;
};

// Reset cached transporter (e.g. if environment variables change)
const __resetTransporter = () => {
  transporter = null;
};

module.exports = {
  sendMail,
  verifyConnection,
  getSmtpDiagnostics,
  formatKolkataDateTime,
  __setTestMockTransport,
  __clearTestMockTransport,
  __resetTransporter
};
