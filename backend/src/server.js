const http = require('http');
const app = require('./app');
const { initializeSocket } = require('./sockets/socketManager');
const logger = require('./utils/logger');
const schedulerService = require('./services/schedulerService');

const PORT = process.env.PORT || 5000;

// Create HTTP server wrapping Express app
const server = http.createServer(app);

// Initialize Socket.IO
initializeSocket(server);

// Start background jobs
schedulerService.startScheduler();

const { syncMissingRegistrationGoals } = require('./controllers/goalController');
syncMissingRegistrationGoals().then((count) => {
  if (count > 0) logger.info(`[Goal Sync] Backfilled ${count} missing registration goals for existing students.`);
}).catch((err) => {
  logger.warn(`[Goal Sync] Startup sync error: ${err.message}`);
});

const emailService = require('./services/emailService');

// Verify SMTP connectivity at startup without blocking server launch
emailService.verifyConnection().then((diag) => {
  if (diag.success) {
    logger.info('[Email Service] SMTP connection diagnostic passed.');
  } else {
    logger.warn(`[Email Service] SMTP connection diagnostic: ${diag.error}`);
  }
}).catch((err) => {
  logger.warn(`[Email Service] SMTP diagnostic error: ${err.message}`);
});

// Start listening
server.listen(PORT, () => {
  logger.info(`MentorConnect Backend running on port ${PORT}`);
  logger.info(`Health check available at http://localhost:${PORT}/api/health`);
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (err) => {
  logger.error(`Unhandled Rejection: ${err.message}`);
  server.close(() => process.exit(1));
});
