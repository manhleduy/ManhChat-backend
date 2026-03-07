import redis from "../config/redis.js";

export const getReceiverSocketId = async (id) => {
    return await redis.get(`user:${id}:online`);
};
