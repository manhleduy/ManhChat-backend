import redis from "../../config/redis.js";

const ONLINE_TTL = 60;

// Get socketId
export const getSenderSocketId = async (id) => {
  return await redis.get(`user:${id}:online`);
};

// Add or update online user
export const addOnlineUser = async (id, socketId) => {
  try {
  
    await redis.set(`user:${id}:online`, socketId, {
      EX: ONLINE_TTL
    });
  } catch (e) {
    console.error("Redis addOnlineUser error:", e);
  }
};

// Refresh TTL (heartbeat)
export const refreshOnlineUser = async (id) => {
  try {
    await redis.expire(`user:${id}:online`, ONLINE_TTL);
  } catch (e) {
    console.error("Redis refreshOnlineUser error:", e);
  }
};

// Remove user
export const removeOnlineUser = async (id) => {
  try {
    await redis.del(`user:${id}:online`);
  } catch (e) {
    console.error("Redis removeOnlineUser error:", e);
  }
};

// Safe scan instead of KEYS
export const getAllOnlineUsers = async () => {
  const keys = [];
  let cursor = "0";

  do {
    const reply = await redis.scan(cursor, {
      MATCH: "user:*:online",
      COUNT: 100
    });

    cursor = reply.cursor;
    keys.push(...reply.keys);

  } while (cursor !== "0");

  return keys;
};