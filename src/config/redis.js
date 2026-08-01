import { createClient } from 'redis';
import dotenv from 'dotenv';
dotenv.config();


// ── General-purpose client (GET, SET, XADD, PUBLISH, etc.) ───────────────────
const redis = createClient({
  socket: {
    host: process.env.REDIS_HOST,
    port: process.env.REDIS_PORT
  }
});

redis.on('error',   (err) => console.log('Redis error:', err));
redis.on('connect', ()    => console.log('Redis: Attempting to connect...'));
redis.on('ready',   ()    => console.log('Redis: Connection established and ready!'));


// ── Subscriber client (SUBSCRIBE / UNSUBSCRIBE only) ─────────────────────────
// Redis protocol: a subscribed client cannot run any other commands.
export const redisSubscriber = createClient({
  socket: {
    host: process.env.REDIS_HOST,
    port: process.env.REDIS_PORT
  }
});

redisSubscriber.on('error',   (err) => console.log('RedisSubscriber error:', err));
redisSubscriber.on('connect', ()    => console.log('RedisSubscriber: Attempting to connect...'));
redisSubscriber.on('ready',   ()    => console.log('RedisSubscriber: Connection established and ready!'));


// ── Explicit connect functions (called in src/index.js before server.listen) ──
export const connectToRedis = async () => {
  try {
    await redis.connect();
  } catch (error) {
    console.error('Redis: Failed to connect on startup', error);
  }
};

export const connectToRedisSubscriber = async () => {
  try {
    await redisSubscriber.connect();
  } catch (error) {
    console.error('RedisSubscriber: Failed to connect on startup', error);
  }
};


// ── Channel name helpers ──────────────────────────────────────────────────────
// Always use these helpers — never hand-craft channel strings in callers.
export const userChatChannel  = (userId)  => `chat:user:${userId}`;
export const groupChatChannel = (groupId) => `chat:group:${groupId}`;


export default redis;
