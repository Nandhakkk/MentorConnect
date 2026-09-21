/**
 * Health check controller
 * Checks API server status and returns diagnostic information
 */
const getHealthStatus = (req, res) => {
  res.status(200).json({
    status: 'ok',
    message: 'MentorConnect API is running successfully',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV || 'development'
  });
};

module.exports = {
  getHealthStatus
};
