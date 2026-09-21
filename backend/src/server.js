const http = require('http');
const app = require('./app');
const { initializeSocket } = require('./sockets/socketManager');
const logger = require('./utils/logger');

const PORT = process.env.PORT || 5000;

// Create HTTP server wrapping Express app
const server = http.createServer(app);

// Initialize Socket.IO
initializeSocket(server);

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
