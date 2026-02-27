import redis from "../../config/redis.js";

// Cache expiration duration in seconds (12 hours for profile data)
const PROFILE_TTL = 43200;

/**
 * Safe JSON parse with error handling
 * @param {string} data
 * @returns {Object|null} Parsed object or null if parsing fails
 */
const safeJsonParse = (data) => {
  try {
    if (!data || typeof data !== 'string') {
      return null;
    }
    return JSON.parse(data);
  } catch (parseError) {
    console.error(`JSON parse error:`, parseError);
    return null; // Return null if JSON parsing fails
  }
};

/**
 * Validate user ID before using in cache key
 * @param {*} userId
 * @returns {boolean} True if userId is valid
 */
const isValidUserId = (userId) => {
  return userId && (typeof userId === 'number' || typeof userId === 'string') && userId !== '';
};

/**
 * Get user profile from cache
 * @param {number|string} userId
 * @returns {Object|null} Cached profile or null if not found
 */
export const getCachedProfile = async (userId) => {
  try {
    // Validate userId
    if (!isValidUserId(userId)) {
      console.error(`Redis getCachedProfile error: Invalid userId provided: ${userId}`);
      return null;
    }

    const cacheKey = `user:${userId}:profile`;
    const cachedData = await redis.get(cacheKey);
    
    if (cachedData) {
      const parsedData = safeJsonParse(cachedData);
      return parsedData; // Could be null if parsing failed, that's OK
    }
    return null;
  } catch (error) {
    // Redis connection errors, timeout, etc.
    console.error(`Redis getCachedProfile error for user ${userId}:`, error.message || error);
    return null; // Return null on any error, don't break the workflow
  }
};

/**
 * Set user profile in cache
 * @param {number|string} userId
 * @param {Object} profileData
 * @returns {boolean} True if cache was set successfully
 */
export const setCachedProfile = async (userId, profileData) => {
  try {
    // Validate inputs
    if (!isValidUserId(userId)) {
      console.error(`Redis setCachedProfile error: Invalid userId provided: ${userId}`);
      return false;
    }

    if (!profileData || typeof profileData !== 'object') {
      console.error(`Redis setCachedProfile error: Invalid profileData provided`);
      return false;
    }

    const cacheKey = `user:${userId}:profile`;
    
    // Check data size before storing (Redis has size limits)
    const serialized = JSON.stringify(profileData);
    if (serialized.length > 1048576) { // 1MB limit
      console.warn(`Redis setCachedProfile warning: Profile data for user ${userId} exceeds size limit`);
      return false;
    }

    await redis.set(cacheKey, serialized, {
      EX: PROFILE_TTL
    });
    return true;
  } catch (error) {
    console.error(`Redis setCachedProfile error for user ${userId}:`, error.message || error);
    // Don't throw error, just log it to not affect workflow
    return false;
  }
};

/**
 * Invalidate user profile cache
 * @param {number|string} userId
 * @returns {boolean} True if cache was invalidated
 */
export const invalidateProfileCache = async (userId) => {
  try {
    if (!isValidUserId(userId)) {
      console.error(`Redis invalidateProfileCache error: Invalid userId provided: ${userId}`);
      return false;
    }

    const cacheKey = `user:${userId}:profile`;
    const deleteResult = await redis.del(cacheKey);
    return deleteResult > 0; // Returns 1 if key was deleted, 0 if didn't exist
  } catch (error) {
    console.error(`Redis invalidateProfileCache error for user ${userId}:`, error.message || error);
    return false;
  }
};

/**
 * Update specific profile fields in cache
 * @param {number|string} userId
 * @param {Object} updatedFields - Only fields to update
 * @returns {boolean} True if update was successful
 */
export const updateCachedProfile = async (userId, updatedFields) => {
  try {
    // Validate inputs
    if (!isValidUserId(userId)) {
      console.error(`Redis updateCachedProfile error: Invalid userId provided: ${userId}`);
      return false;
    }

    if (!updatedFields || typeof updatedFields !== 'object') {
      console.error(`Redis updateCachedProfile error: Invalid updatedFields provided`);
      return false;
    }

    const cacheKey = `user:${userId}:profile`;
    const cachedData = await redis.get(cacheKey);
    
    if (!cachedData) {
      // Cache doesn't exist, nothing to update
      return false;
    }

    const currentProfile = safeJsonParse(cachedData);
    if (!currentProfile) {
      // Failed to parse existing cache
      return false;
    }

    // Merge updated fields
    const updatedProfile = { ...currentProfile, ...updatedFields };
    
    const serialized = JSON.stringify(updatedProfile);
    if (serialized.length > 1048576) {
      console.warn(`Redis updateCachedProfile warning: Updated profile for user ${userId} exceeds size limit`);
      return false;
    }

    await redis.set(cacheKey, serialized, {
      EX: PROFILE_TTL
    });
    return true;
  } catch (error) {
    console.error(`Redis updateCachedProfile error for user ${userId}:`, error.message || error);
    return false;
  }
};

/**
 * Update specific profile fields (name, address, phonenumber, birthday)
 * @param {number|string} userId
 * @param {Object} profileUpdateData
 * @returns {boolean} True if update was successful
 */
export const updateProfileInfo = async (userId, profileUpdateData) => {
  try {
    if (!isValidUserId(userId)) {
      console.error(`Redis updateProfileInfo error: Invalid userId provided: ${userId}`);
      return false;
    }

    const allowedFields = ['name', 'address', 'phonenumber', 'birthday'];
    const filteredUpdate = {};
    
    // Only allow specific fields to be updated
    for (const field of allowedFields) {
      if (field in profileUpdateData && profileUpdateData[field] !== undefined) {
        filteredUpdate[field] = profileUpdateData[field];
      }
    }

    if (Object.keys(filteredUpdate).length === 0) {
      // No valid fields to update
      return false;
    }

    return await updateCachedProfile(userId, filteredUpdate);
  } catch (error) {
    console.error(`Redis updateProfileInfo error for user ${userId}:`, error.message || error);
    return false;
  }
};

/**
 * Update profile picture only
 * @param {number|string} userId
 * @param {string} profilePicUrl
 * @returns {boolean} True if update was successful
 */
export const updateProfilePicture = async (userId, profilePicUrl) => {
  try {
    if (!isValidUserId(userId)) {
      console.error(`Redis updateProfilePicture error: Invalid userId provided: ${userId}`);
      return false;
    }

    if (!profilePicUrl || typeof profilePicUrl !== 'string') {
      console.error(`Redis updateProfilePicture error: Invalid profilePicUrl provided`);
      return false;
    }

    return await updateCachedProfile(userId, { profilePic: profilePicUrl });
  } catch (error) {
    console.error(`Redis updateProfilePicture error for user ${userId}:`, error.message || error);
    return false;
  }
};

/**
 * Clear all profile caches (use sparingly)
 * @returns {number} Number of keys deleted
 */
export const clearAllProfileCaches = async () => {
  try {
    let cursor = "0";
    const keys = [];

    do {
      const reply = await redis.scan(cursor, {
        MATCH: "user:*:profile",
        COUNT: 100
      });

      // Validate cursor response
      if (!reply || typeof reply.cursor === 'undefined') {
        console.error(`Redis clearAllProfileCaches error: Invalid scan response`);
        break;
      }

      cursor = reply.cursor;
      if (Array.isArray(reply.keys)) {
        keys.push(...reply.keys);
      }
    } while (cursor !== "0");

    if (keys.length > 0) {
      const deleteCount = await redis.del(keys);
      return deleteCount;
    }
    return 0;
  } catch (error) {
    console.error(`Redis clearAllProfileCaches error:`, error.message || error);
    return 0;
  }
};

/**
 * Get all cached profile keys (for debugging)
 * @returns {Array} Array of profile cache keys
 */
export const getAllProfileCacheKeys = async () => {
  try {
    let cursor = "0";
    const keys = [];

    do {
      const reply = await redis.scan(cursor, {
        MATCH: "user:*:profile",
        COUNT: 100
      });

      if (!reply || typeof reply.cursor === 'undefined') {
        console.error(`Redis getAllProfileCacheKeys error: Invalid scan response`);
        break;
      }

      cursor = reply.cursor;
      if (Array.isArray(reply.keys)) {
        keys.push(...reply.keys);
      }
    } while (cursor !== "0");

    return keys;
  } catch (error) {
    console.error(`Redis getAllProfileCacheKeys error:`, error.message || error);
    return [];
  }
};
