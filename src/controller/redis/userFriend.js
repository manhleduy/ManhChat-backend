import redis from "../../config/redis.js";

// Cache expiration duration in seconds (24 hours)
const FRIEND_LIST_TTL = 86400;

/**
 * Safe JSON parse with error handling
 * @param {string} data
 * @returns {Array|null} Parsed array or null if parsing fails
 */
const safeJsonParse = (data) => {
  try {
    if (!data || typeof data !== 'string') {
      return null;
    }
    const parsed = JSON.parse(data);
    if (!Array.isArray(parsed)) {
      console.warn(`Warning: Cached friend list is not an array`);
      return null;
    }
    return parsed;
  } catch (parseError) {
    console.error(`JSON parse error in getCachedFriendList:`, parseError.message);
    return null;
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
 * Get friend list from cache
 * @param {number|string} userId
 * @returns {Array|null} Cached friend list or null if not found
 */
export const getCachedFriendList = async (userId) => {
  try {
    // Validate userId
    if (!isValidUserId(userId)) {
      console.error(`Redis getCachedFriendList error: Invalid userId provided: ${userId}`);
      return null;
    }

    const cacheKey = `user:${userId}:friendList`;
    const cachedData = await redis.get(cacheKey);
    
    if (cachedData) {
      const parsed = safeJsonParse(cachedData);
      return parsed; // Could be null if parsing failed, that's OK
    }
    return null;
  } catch (error) {
    // Redis connection errors, timeout, etc.
    console.error(`Redis getCachedFriendList error for user ${userId}:`, error.message || error);
    return null; // Return null on any error, don't break the workflow
  }
};

/**
 * Set friend list in cache
 * @param {number|string} userId
 * @param {Array} friendList
 * @returns {boolean} True if cache was set successfully
 */
export const setCachedFriendList = async (userId, friendList) => {
  try {
    // Validate inputs
    if (!isValidUserId(userId)) {
      console.error(`Redis setCachedFriendList error: Invalid userId provided: ${userId}`);
      return false;
    }

    if (!Array.isArray(friendList)) {
      console.error(`Redis setCachedFriendList error: friendList must be an array`);
      return false;
    }

    const cacheKey = `user:${userId}:friendList`;
    
    // Check data size before storing
    const serialized = JSON.stringify(friendList);
    if (serialized.length > 1048576) { // 1MB limit
      console.warn(`Redis setCachedFriendList warning: Friend list for user ${userId} exceeds size limit`);
      return false;
    }

    await redis.set(cacheKey, serialized, {
      EX: FRIEND_LIST_TTL
    });
    return true;
  } catch (error) {
    console.error(`Redis setCachedFriendList error for user ${userId}:`, error.message || error);
    return false;
  }
};

/**
 * Invalidate friend list cache (when friend is added/removed)
 * @param {number|string} userId
 * @param {number|string} friendId
 * @returns {boolean} True if invalidation was successful
 */
export const invalidateFriendListCache = async (userId, friendId) => {
  try {
    // Validate inputs
    if (!isValidUserId(userId)) {
      console.error(`Redis invalidateFriendListCache error: Invalid userId provided: ${userId}`);
      return false;
    }

    if (!isValidUserId(friendId)) {
      console.error(`Redis invalidateFriendListCache error: Invalid friendId provided: ${friendId}`);
      return false;
    }

    // Invalidate cache for both users since friendship is bidirectional
    const keys = [
      `user:${userId}:friendList`,
      `user:${friendId}:friendList`
    ];
    
    let deletedCount = 0;
    for (const key of keys) {
      try {
        const result = await redis.del(key);
        deletedCount += result;
      } catch (keyError) {
        console.error(`Error deleting cache key ${key}:`, keyError.message || keyError);
      }
    }
    return deletedCount > 0;
  } catch (error) {
    console.error(`Redis invalidateFriendListCache error:`, error.message || error);
    return false;
  }
};

/**
 * Update single friend in cache (for last message updates)
 * @param {number|string} userId
 * @param {number|string} friendId
 * @param {Object} updatedFriendData
 * @returns {boolean} True if update was successful
 */
export const updateCachedFriend = async (userId, friendId, updatedFriendData) => {
  try {
    // Validate inputs
    if (!isValidUserId(userId)) {
      console.error(`Redis updateCachedFriend error: Invalid userId provided: ${userId}`);
      return false;
    }

    if (!isValidUserId(friendId)) {
      console.error(`Redis updateCachedFriend error: Invalid friendId provided: ${friendId}`);
      return false;
    }

    if (!updatedFriendData || typeof updatedFriendData !== 'object') {
      console.error(`Redis updateCachedFriend error: Invalid updatedFriendData provided`);
      return false;
    }

    const cacheKey = `user:${userId}:friendList`;
    const cachedList = await redis.get(cacheKey);
    
    if (!cachedList) {
      // Cache doesn't exist, nothing to update
      return false;
    }

    const friendList = safeJsonParse(cachedList);
    if (!friendList) {
      return false;
    }

    const friendIndex = friendList.findIndex(f => f && f.id === friendId);
    
    if (friendIndex === -1) {
      // Friend not found in cache, nothing to update
      return false;
    }

    friendList[friendIndex] = { ...friendList[friendIndex], ...updatedFriendData };
    await redis.set(cacheKey, JSON.stringify(friendList), {
      EX: FRIEND_LIST_TTL
    });
    return true;
  } catch (error) {
    console.error(`Redis updateCachedFriend error for user ${userId}:`, error.message || error);
    return false;
  }
};

/**
 * Clear all friend list caches (use sparingly)
 * @returns {number} Number of keys deleted
 */
export const clearAllFriendCaches = async () => {
  try {
    let cursor = "0";
    const keys = [];
    let iterations = 0;
    const maxIterations = 1000; // Prevent infinite loops

    do {
      // Safety check for infinite loops
      if (iterations >= maxIterations) {
        console.warn(`Redis clearAllFriendCaches warning: Max iterations reached, breaking scan loop`);
        break;
      }

      const reply = await redis.scan(cursor, {
        MATCH: "user:*:friendList",
        COUNT: 100
      });

      // Validate scan response
      if (!reply) {
        console.error(`Redis clearAllFriendCaches error: Invalid scan response`);
        break;
      }

      // Ensure cursor exists and is a string
      if (typeof reply.cursor === 'undefined' || reply.cursor === null) {
        console.error(`Redis clearAllFriendCaches error: Invalid cursor in response`);
        break;
      }

      cursor = reply.cursor;

      // Ensure keys is an array
      if (Array.isArray(reply.keys)) {
        keys.push(...reply.keys);
      }

      iterations++;
    } while (cursor !== "0");

    if (keys.length > 0) {
      try {
        const deletedCount = await redis.del(keys);
        return deletedCount;
      } catch (deleteError) {
        console.error(`Redis clearAllFriendCaches error deleting keys:`, deleteError.message || deleteError);
        return 0;
      }
    }
    return 0;
  } catch (error) {
    console.error(`Redis clearAllFriendCaches error:`, error.message || error);
    return 0;
  }
};
