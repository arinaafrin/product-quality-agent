const { Server } = require('socket.io');
const { createClient } = require('redis');
const { createAdapter } = require('@socket.io/redis-adapter');
const { verifyToken } = require('./auth');
const { getAllowedOrigins } = require('./corsConfig');

let io = null;

function roomName(tenantId, jobId) {
  return `${tenantId}:${jobId}`;
}

/**
 * @param {import('http').Server} httpServer
 * @returns {Promise<import('socket.io').Server>}
 */
async function initRealtime(httpServer) {
  io = new Server(httpServer, {
    cors: { origin: getAllowedOrigins() },
  });

  const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
  const pubClient = createClient({ url: redisUrl });
  const subClient = pubClient.duplicate();

  pubClient.on('error', (err) => console.error('[realtime] redis pub client error:', err.message));
  subClient.on('error', (err) => console.error('[realtime] redis sub client error:', err.message));

  await Promise.all([pubClient.connect(), subClient.connect()]);
  io.adapter(createAdapter(pubClient, subClient));

  io.use((socket, next) => {
    const token = socket.handshake.auth?.token;
    if (!token) return next(new Error('Authentication required.'));
    try {
      const payload = verifyToken(token);
      if (!payload.tenantId) return next(new Error('Token is missing a tenant claim.'));
      socket.tenantId = payload.tenantId;
      next();
    } catch (err) {
      next(new Error('Invalid or expired token.'));
    }
  });

  io.on('connection', (socket) => {
    socket.on('validation:join', (jobId) => {
      if (typeof jobId === 'string' && jobId) {
        socket.join(roomName(socket.tenantId, jobId));
      }
    });
  });

  console.log(`[realtime] Socket.IO attached, Redis adapter connected to ${redisUrl}`);
  return io;
}

/** @returns {import('socket.io').Server | null} */
function getIO() {
  return io;
}

module.exports = { initRealtime, getIO, roomName };
