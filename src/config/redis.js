import { createClient } from 'redis';
import dotenv from 'dotenv';
dotenv.config();


const redis = createClient({
  
  socket: {
    host: process.env.REDIS_HOST,   
    port: process.env.REDIS_PORT       
  }
});

// 1. Setup Listeners
redis.on('error', (err) => console.log(err));
redis.on('connect', () => console.log('Redis: Attempting to connect...'));
redis.on('ready', () => console.log('Redis: Connection established and ready!'));

// 2. Trigger Connection
const connectToRedis = async () => {
    try {
        await redis.connect();
    } catch (error) {
        console.error('Redis: Failed to connect on startup', error);
    }
};

connectToRedis();

export default redis;