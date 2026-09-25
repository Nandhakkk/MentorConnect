const prisma = require('../config/db');

/**
 * Create a new notification for a user
 */
const createNotification = async (userId, type, title, message, referenceId = null, referenceType = null) => {
  try {
    return await prisma.notification.create({
      data: {
        userId,
        type,
        title,
        message,
        referenceId,
        referenceType
      }
    });
  } catch (err) {
    console.error('Error creating notification:', err);
    throw err;
  }
};

/**
 * Fetch notifications for a user
 */
const getUserNotifications = async (userId, limit = 20) => {
  try {
    const notifications = await prisma.notification.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: limit
    });
    
    const unreadCount = await prisma.notification.count({
      where: { userId, isRead: false }
    });
    
    return { notifications, unreadCount };
  } catch (err) {
    console.error('Error fetching notifications:', err);
    throw err;
  }
};

/**
 * Mark a single notification as read
 */
const markNotificationRead = async (notificationId, userId) => {
  try {
    const notification = await prisma.notification.findUnique({ where: { id: notificationId } });
    if (!notification || notification.userId !== userId) {
      throw new Error('Notification not found or access denied');
    }
    
    return await prisma.notification.update({
      where: { id: notificationId },
      data: { isRead: true }
    });
  } catch (err) {
    console.error('Error marking notification read:', err);
    throw err;
  }
};

/**
 * Mark all user notifications as read
 */
const markAllNotificationsRead = async (userId) => {
  try {
    return await prisma.notification.updateMany({
      where: { userId, isRead: false },
      data: { isRead: true }
    });
  } catch (err) {
    console.error('Error marking all notifications read:', err);
    throw err;
  }
};

module.exports = {
  createNotification,
  getUserNotifications,
  markNotificationRead,
  markAllNotificationsRead
};
