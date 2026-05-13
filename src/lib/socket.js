const { Server } = require('socket.io');
const { z } = require('zod');
const { verifyAuthToken } = require('../server/auth');
const { prepareSyncedRound, resolveSyncedRound, joinRoom, leaveRoom, getRoomRound } = require('../rooms/liveRooms');

let io;
const joinSchema = z.object({ roomId: z.string().min(1), playerId: z.string().min(1) });
const leaveSchema = joinSchema;
const prepareSchema = z.object({
  roomId: z.string().min(1),
  players: z.array(z.string().min(1)).min(1),
  betSol: z.number().positive(),
  commitPayloadByPlayer: z.record(
    z.object({
      serverSeed: z.string().min(1),
      clientSeed: z.string().min(1),
      nonce: z.number().int().nonnegative(),
    })
  ),
  rtpTarget: z.number().min(90).max(98).optional(),
});
const resolveSchema = z.object({ roomId: z.string().min(1), roundId: z.string().min(1) });

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

  io.use((socket, next) => {
    try {
      const token = socket.handshake.auth?.token;
      if (!token) return next(new Error('unauthorized'));
      socket.data.auth = verifyAuthToken(token);
      return next();
    } catch {
      return next(new Error('unauthorized'));
    }
  });

  io.on('connection', (socket) => {
    socket.on('room:join', (payload) => {
      try {
        const { roomId, playerId } = joinSchema.parse(payload);
        if (playerId !== socket.data.auth.sub) throw new Error('forbidden');
        socket.join(roomId);
        joinRoom(roomId, playerId);
        io.to(roomId).emit('room:state', { roomId, playerId, event: 'join' });
      } catch (error) {
        socket.emit('room:error', { message: error.message || 'invalid room join request' });
      }
    });

    socket.on('room:leave', (payload) => {
      try {
        const { roomId, playerId } = leaveSchema.parse(payload);
        if (playerId !== socket.data.auth.sub) throw new Error('forbidden');
        leaveRoom(roomId, playerId);
        socket.leave(roomId);
        io.to(roomId).emit('room:state', { roomId, playerId, event: 'leave' });
      } catch (error) {
        socket.emit('room:error', { message: error.message || 'invalid room leave request' });
      }
    });

    socket.on('room:spin:prepare', (payload) => {
      try {
        const parsed = prepareSchema.parse(payload);
        if (!parsed.players.includes(socket.data.auth.sub)) throw new Error('forbidden');
        const round = prepareSyncedRound(parsed);
        io.to(parsed.roomId).emit('room:spin:prepared', round);
      } catch (error) {
        socket.emit('room:error', { message: error.message || 'invalid round preparation request' });
      }
    });

    socket.on('room:spin:resolve', (payload) => {
      try {
        const { roomId, roundId } = resolveSchema.parse(payload);
        const round = getRoomRound({ roomId, roundId });
        if (!round) throw new Error('round not found');
        if (!round.players.includes(socket.data.auth.sub)) throw new Error('forbidden');
        const result = resolveSyncedRound({ roomId, roundId });
        io.to(roomId).emit('room:spin:resolved', result);
      } catch (error) {
        socket.emit('room:error', { message: error.message || 'invalid round resolution request' });
      }
    });
  });

  return io;
}

module.exports = { initSocket };
