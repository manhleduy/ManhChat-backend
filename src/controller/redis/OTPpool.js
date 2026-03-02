import redis from "../../config/redis.js";
import crypto from "crypto";

const DEFAULT_OTP_TTL = parseInt(process.env.OTP_TTL, 10) || 300; // seconds

// Generate a secure 6-digit OTP, store its SHA-256 hash in Redis with TTL.
export const generateOTPForEmail = async (email, ttl = DEFAULT_OTP_TTL) => {
  const otp = crypto.randomInt(100000, 999999).toString();
  const hash = crypto.createHash('sha256').update(otp).digest('hex');
  try {
    await redis.set(`otp:${email}`, hash, { EX: ttl });
    // Keep a latest fallback for compatibility with older verify flow
    await redis.set(`otp:latest`, JSON.stringify({ email, hash }), { EX: ttl });
    return otp;
  } catch (e) {
    console.error('Redis generateOTPForEmail error:', e);
    throw e;
  }
};

export const getHashedOTPForEmail = async (email) => {
  try {
    return await redis.get(`otp:${email}`);
  } catch (e) {
    console.error('Redis getHashedOTPForEmail error:', e);
    throw e;
  }
};

export const verifyOTPForEmail = async (email, inputOTP) => {
  try {
    const storedHash = await redis.get(`otp:${email}`);
    if (!storedHash) return false;
    const inputHash = crypto.createHash('sha256').update(String(inputOTP)).digest('hex');
    const ok = storedHash === inputHash;
    if (ok) {
      await redis.del(`otp:${email}`);
      await redis.del(`otp:latest`);
    }
    return ok;
  } catch (e) {
    console.error('Redis verifyOTPForEmail error:', e);
    throw e;
  }
};

// Compatibility: verify against the latest OTP (no email provided)
export const verifyOTPLatest = async (inputOTP) => {
  try {
    const latest = await redis.get('otp:latest');
    if (!latest) return false;
    const { email, hash } = JSON.parse(latest);
    const inputHash = crypto.createHash('sha256').update(String(inputOTP)).digest('hex');
    const ok = hash === inputHash;
    if (ok) {
      await redis.del(`otp:${email}`);
      await redis.del('otp:latest');
    }
    return ok;
  } catch (e) {
    console.error('Redis verifyOTPLatest error:', e);
    throw e;
  }
};

export const removeOTPForEmail = async (email) => {
  try {
    await redis.del(`otp:${email}`);
    await redis.del('otp:latest');
  } catch (e) {
    console.error('Redis removeOTPForEmail error:', e);
    throw e;
  }
};

