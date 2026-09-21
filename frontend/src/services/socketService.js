import { io } from 'socket.io-client';

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || 'http://localhost:5000';

let socket = null;

/**
 * Connect to the Socket.IO server with the JWT token.
 */
export function connectSocket() {
  if (socket?.connected) return socket;

  const token = localStorage.getItem('mentorconnect_token');

  socket = io(SOCKET_URL, {
    auth: { token },
    autoConnect: true,
    reconnectionAttempts: 5
  });

  socket.on('connect', () => {
    console.log('[Socket] Connected:', socket.id);
  });

  socket.on('connect_error', (err) => {
    console.error('[Socket] Connection error:', err.message);
  });

  socket.on('disconnect', (reason) => {
    console.log('[Socket] Disconnected:', reason);
  });

  return socket;
}

/**
 * Join a mentorship chat room.
 */
export function joinMentorshipRoom(mentorshipId) {
  if (!socket) connectSocket();
  socket.emit('joinMentorship', { mentorshipId });
}

/**
 * Send a message via socket (persisted on server).
 */
export function emitMessage(mentorshipId, content) {
  if (!socket) connectSocket();
  socket.emit('sendMessage', { mentorshipId, content });
}

/**
 * Listen for new messages.
 */
export function onNewMessage(callback) {
  if (!socket) connectSocket();
  socket.on('newMessage', callback);
}

/**
 * Remove new message listener.
 */
export function offNewMessage(callback) {
  socket?.off('newMessage', callback);
}

/**
 * Disconnect from socket.
 */
export function disconnectSocket() {
  socket?.disconnect();
  socket = null;
}

export function getSocket() {
  return socket;
}
