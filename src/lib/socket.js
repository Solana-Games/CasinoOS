const { Server } = require('socket.io');
const { prepareSyncedRound, resolveSyncedRound, joinRoom, leaveRoom } = require('../rooms/liveRooms');

let io;

function initSocket(server) {
  if (io) return io;
  const allowedOrigins = (process.env.ALLOWED_ORIGINS || 'http://localhost:3000')
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean);
  io = new Server(server, {
    cors: {
      origin: allowedOrigins,
      methods: ['GET', 'POST'],
    },
  });

  io.on('connection', (socket) => {
    socket.on('room:join', ({ roomId, playerId }) => {
      socket.join(roomId);
      joinRoom(roomId, playerId);
      io.to(roomId).emit('room:state', { roomId, playerId, event: 'join' });
    });

    socket.on('room:leave', ({ roomId, playerId }) => {
      leaveRoom(roomId, playerId);
      socket.leave(roomId);
      io.to(roomId).emit('room:state', { roomId, playerId, event: 'leave' });
    });

    socket.on('room:spin:prepare', (payload) => {
      const round = prepareSyncedRound(payload);
      io.to(payload.roomId).emit('room:spin:prepared', round);
    });

    socket.on('room:spin:resolve', ({ roomId, roundId }) => {
      const result = resolveSyncedRound({ roomId, roundId });
      io.to(roomId).emit('room:spin:resolved', result);
    });
  });

  return io;
}

module.exports = { initSocket };
