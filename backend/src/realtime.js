const { Server } = require('socket.io');
const { createClient } = require('redis');
const { createAdapter } = require('@socket.io/redis-adapter');

let io = null;

/**
 * @param {import('http').Server} httpServer
 * @returns {Promise<import('socket.io').Server>}
 */
async function initRealtime(httpServer) {
  io = new Server(httpServer, {
    cors: { origin: process.env.FRONTEND_ORIGIN || '*' },
  });

  const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
  const pubClient = createClient({ url: redisUrl });
  const subClient = pubClient.duplicate();

  pubClient.on('error', (err) => console.error('[realtime] redis pub client error:', err.message));
  subClient.on('error', (err) => console.error('[realtime] redis sub client error:', err.message));

  await Promise.all([pubClient.connect(), subClient.connect()]);
  io.adapter(createAdapter(pubClient, subClient));

  io.on('connection', (socket) => {
    socket.on('validation:join', (jobId) => {
      if (typeof jobId === 'string' && jobId) {
        socket.join(jobId);
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

module.exports = { initRealtime, getIO };
