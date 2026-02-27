import redis from "../../config/redis.js";

// Cache expiration duration in seconds (24 hours)
const GROUP_LIST_TTL = 86400;

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
      console.warn(`Warning: Cached group list is not an array`);
      return null;
    }
    return parsed;
  } catch (parseError) {
    console.error(`JSON parse error in getCachedGroupList:`, parseError.message);
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
 * Get group list from cache
 * @param {number|string} userId
 * @returns {Array|null} Cached group list or null if not found
 */
export const getCachedGroupList = async (userId) => {
  try {
    // Validate userId
    if (!isValidUserId(userId)) {
      console.error(`Redis getCachedGroupList error: Invalid userId provided: ${userId}`);
      return null;
    }

    const cacheKey = `user:${userId}:groupList`;
    const cachedData = await redis.get(cacheKey);
    
    if (cachedData) {
      const parsed = safeJsonParse(cachedData);
      return parsed; // Could be null if parsing failed, that's OK
    }
    return null;
  } catch (error) {
    console.error(`Redis getCachedGroupList error for user ${userId}:`, error.message || error);
    return null; // Return null on any error, don't break the workflow
  }
};

/**
 * Set group list in cache
 * @param {number|string} userId
 * @param {Array} groupList
 * @returns {boolean} True if cache was set successfully
 */
export const setCachedGroupList = async (userId, groupList) => {
  try {
    // Validate inputs
    if (!isValidUserId(userId)) {
      console.error(`Redis setCachedGroupList error: Invalid userId provided: ${userId}`);
      return false;
    }

    if (!Array.isArray(groupList)) {
      console.error(`Redis setCachedGroupList error: groupList must be an array`);
      return false;
    }

    const cacheKey = `user:${userId}:groupList`;
    
    // Check data size before storing
    const serialized = JSON.stringify(groupList);
    if (serialized.length > 1048576) { // 1MB limit
      console.warn(`Redis setCachedGroupList warning: Group list for user ${userId} exceeds size limit`);
      return false;
    }

    await redis.set(cacheKey, serialized, {
      EX: GROUP_LIST_TTL
    });
    return true;
  } catch (error) {
    console.error(`Redis setCachedGroupList error for user ${userId}:`, error.message || error);
    return false;
  }
};

/**
 * Invalidate group list cache (when group is created/updated/deleted or user joins/leaves)
 * @param {number|string|Array} userIds - Single userId or array of userIds to invalidate
 * @returns {boolean} True if invalidation was successful
 */
export const invalidateGroupListCache = async (userIds) => {
  try {
    // Validate inputs
    const ids = Array.isArray(userIds) ? userIds : [userIds];
    
    // Filter out invalid IDs
    const validIds = ids.filter(id => isValidUserId(id));
    if (validIds.length === 0) {
      console.error(`Redis invalidateGroupListCache error: No valid userIds provided`);
      return false;
    }

    const keys = validIds.map(id => `user:${id}:groupList`);
    
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
    console.error(`Redis invalidateGroupListCache error:`, error.message || error);
    return false;
  }
};

/**
 * Update single group in cache (for last message updates)
 * @param {number|string} userId
 * @param {number|string} groupId
 * @param {Object} updatedGroupData
 * @returns {boolean} True if update was successful
 */
export const updateCachedGroup = async (userId, groupId, updatedGroupData) => {
  try {
    // Validate inputs
    if (!isValidUserId(userId)) {
      console.error(`Redis updateCachedGroup error: Invalid userId provided: ${userId}`);
      return false;
    }

    if (!isValidUserId(groupId)) {
      console.error(`Redis updateCachedGroup error: Invalid groupId provided: ${groupId}`);
      return false;
    }

    if (!updatedGroupData || typeof updatedGroupData !== 'object') {
      console.error(`Redis updateCachedGroup error: Invalid updatedGroupData provided`);
      return false;
    }

    const cacheKey = `user:${userId}:groupList`;
    const cachedList = await redis.get(cacheKey);
    
    if (!cachedList) {
      // Cache doesn't exist, nothing to update
      return false;
    }

    const groupList = safeJsonParse(cachedList);
    if (!groupList) {
      return false;
    }

    const groupIndex = groupList.findIndex(g => g && g.id === groupId);
    
    if (groupIndex === -1) {
      // Group not found in cache, nothing to update
      return false;
    }

    groupList[groupIndex] = { ...groupList[groupIndex], ...updatedGroupData };
    await redis.set(cacheKey, JSON.stringify(groupList), {
      EX: GROUP_LIST_TTL
    });
    return true;
  } catch (error) {
    console.error(`Redis updateCachedGroup error for user ${userId}:`, error.message || error);
    return false;
  }
};

/**
 * Clear all group list caches (use sparingly)
 * @returns {number} Number of keys deleted
 */
export const clearAllGroupCaches = async () => {
  try {
    let cursor = "0";
    const keys = [];
    let iterations = 0;
    const maxIterations = 1000; // Prevent infinite loops

    do {
      // Safety check for infinite loops
      if (iterations >= maxIterations) {
        console.warn(`Redis clearAllGroupCaches warning: Max iterations reached, breaking scan loop`);
        break;
      }

      const reply = await redis.scan(cursor, {
        MATCH: "user:*:groupList",
        COUNT: 100
      });

      // Validate scan response
      if (!reply) {
        console.error(`Redis clearAllGroupCaches error: Invalid scan response`);
        break;
      }

      // Ensure cursor exists and is a string
      if (typeof reply.cursor === 'undefined' || reply.cursor === null) {
        console.error(`Redis clearAllGroupCaches error: Invalid cursor in response`);
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
        console.error(`Redis clearAllGroupCaches error deleting keys:`, deleteError.message || deleteError);
        return 0;
      }
    }
    return 0;
  } catch (error) {
    console.error(`Redis clearAllGroupCaches error:`, error.message || error);
    return 0;
  }
};
