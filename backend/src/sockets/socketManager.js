/**
 * Socket.IO Manager
 * Handles real-time mentorship chat with JWT authentication.
 */

const jwt = require('jsonwebtoken');
const prisma = require('../config/db');

let io = null;

/**
 * Authenticate a socket using the JWT sent in handshake auth or query.
 */
const authenticateSocket = async (socket) => {
  const token =
    socket.handshake.auth?.token ||
    socket.handshake.query?.token;

  if (!token) throw new Error('No token provided.');

  const secret = process.env.JWT_SECRET || 'mentorconnect_super_secret_jwt_key';
  const decoded = jwt.verify(token, secret);

  const user = await prisma.user.findUnique({
    where: { id: decoded.id },
    select: {
      id: true,
      name: true,
      role: true,
      studentProfile: { select: { id: true } },
      mentorProfile: { select: { id: true, status: true } }
    }
  });

  if (!user) throw new Error('User not found.');
  if (user.role === 'MENTOR' && user.mentorProfile?.status !== 'APPROVED') {
    throw new Error('Mentor application is pending or rejected.');
  }
  return user;
};

/**
 * Verify the user (from socket) belongs to the given mentorship.
 */
const verifySocketMentorshipAccess = async (mentorshipId, user) => {
  const mentorship = await prisma.mentorship.findUnique({
    where: { id: mentorshipId },
    include: {
      student: { select: { userId: true } },
      mentor: { select: { userId: true } }
    }
  });

  if (!mentorship || mentorship.status !== 'ACTIVE') return false;

  const studentUserId = mentorship.student?.userId;
  const mentorUserId = mentorship.mentor?.userId;

  return user.id === studentUserId || user.id === mentorUserId;
};

const initializeSocket = (server) => {
  const { Server } = require('socket.io');

  io = new Server(server, {
    cors: {
      origin: process.env.CLIENT_URL || 'http://localhost:5173',
      methods: ['GET', 'POST'],
      credentials: true
    }
  });

  // Authentication middleware — runs before any socket event
  io.use(async (socket, next) => {
    try {
      socket.user = await authenticateSocket(socket);
      next();
    } catch (err) {
      next(new Error(`Authentication failed: ${err.message}`));
    }
  });

  io.on('connection', (socket) => {
    console.log(`[Socket.IO] ${socket.user.name} connected (${socket.id})`);

    /**
     * joinMentorship — join a mentorship room.
     * Payload: { mentorshipId }
     */
    socket.on('joinMentorship', async ({ mentorshipId }) => {
      try {
        if (!mentorshipId) return;

        const hasAccess = await verifySocketMentorshipAccess(mentorshipId, socket.user);
        if (!hasAccess) {
          socket.emit('error', { message: 'Access denied to this mentorship.' });
          return;
        }

        const room = `mentorship:${mentorshipId}`;
        // Leave any previously joined mentorship rooms
        socket.rooms.forEach((r) => {
          if (r.startsWith('mentorship:') && r !== room) {
            socket.leave(r);
          }
        });

        socket.join(room);
        console.log(`[Socket.IO] ${socket.user.name} joined room ${room}`);
      } catch (err) {
        socket.emit('error', { message: 'Failed to join mentorship.' });
      }
    });

    /**
     * sendMessage — save to DB and broadcast to the room.
     * Payload: { mentorshipId, content }
     */
    socket.on('sendMessage', async ({ mentorshipId, content }) => {
      try {
        if (!mentorshipId || !content || content.trim() === '') {
          socket.emit('error', { message: 'Invalid message.' });
          return;
        }

        const hasAccess = await verifySocketMentorshipAccess(mentorshipId, socket.user);
        if (!hasAccess) {
          socket.emit('error', { message: 'Access denied.' });
          return;
        }

        const room = `mentorship:${mentorshipId}`;
        if (!socket.rooms.has(room)) {
          socket.emit('error', { message: 'You must join the mentorship room first.' });
          return;
        }

        // Persist to database
        const message = await prisma.message.create({
          data: {
            senderId: socket.user.id,
            mentorshipId,
            content: content.trim()
          },
          include: {
            sender: { select: { id: true, name: true } }
          }
        });

        // Broadcast to everyone in the room (including sender)
        io.to(room).emit('newMessage', message);
      } catch (err) {
        socket.emit('error', { message: 'Failed to send message.' });
      }
    });

    socket.on('disconnect', () => {
      console.log(`[Socket.IO] ${socket.user?.name} disconnected (${socket.id})`);
    });
  });

  return io;
};

const getIO = () => {
  if (!io) throw new Error('Socket.IO has not been initialized yet.');
  return io;
};

module.exports = { initializeSocket, getIO };
