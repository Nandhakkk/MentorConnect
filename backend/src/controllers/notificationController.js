const notificationService = require('../services/notificationService');

const getNotifications = async (req, res) => {
  try {
    const userId = req.user.id;
    const { notifications, unreadCount } = await notificationService.getUserNotifications(userId);
    res.status(200).json({ status: 'success', data: { notifications, unreadCount } });
  } catch (err) {
    res.status(500).json({ status: 'error', message: 'Failed to fetch notifications', details: err.message });
  }
};

const markRead = async (req, res) => {
  try {
    const userId = req.user.id;
    const { id } = req.params;
    const notification = await notificationService.markNotificationRead(id, userId);
    res.status(200).json({ status: 'success', data: notification });
  } catch (err) {
    res.status(500).json({ status: 'error', message: err.message });
  }
};

const markAllRead = async (req, res) => {
  try {
    const userId = req.user.id;
    await notificationService.markAllNotificationsRead(userId);
    res.status(200).json({ status: 'success', message: 'All notifications marked as read' });
  } catch (err) {
    res.status(500).json({ status: 'error', message: 'Failed to mark all as read', details: err.message });
  }
};

module.exports = {
  getNotifications,
  markRead,
  markAllRead
};
