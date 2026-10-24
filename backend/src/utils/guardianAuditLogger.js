const logger = require('./logger');

/**
 * Audit log events for Guardian operations
 * Ensures no sensitive passwords, raw auth tokens, or private secrets are logged.
 */
const auditLog = (action, { studentId, guardianId, ip, details = {}, success = true }) => {
  const timestamp = new Date().toISOString();
  const safeDetails = { ...details };

  // Sanitize any potential secret fields
  if (safeDetails.rawToken) {
    safeDetails.tokenPrefix = safeDetails.rawToken.substring(0, 6) + '...';
    delete safeDetails.rawToken;
  }
  if (safeDetails.password) delete safeDetails.password;
  if (safeDetails.jwt) delete safeDetails.jwt;

  const logPayload = {
    category: 'GUARDIAN_AUDIT',
    timestamp,
    action,
    studentId: studentId || null,
    guardianId: guardianId || null,
    ip: ip || 'unknown',
    success,
    details: safeDetails
  };

  logger.info(`[GUARDIAN_AUDIT] ${action} | Student: ${studentId || 'N/A'} | Success: ${success} | Details: ${JSON.stringify(safeDetails)}`);
  return logPayload;
};

module.exports = {
  auditLog
};
