import redis from "../../../config/redis.js";

// Cache expiration duration in seconds (12 hours for member data)
const MEMBER_GROUP_MEMBER_TTL = 43200;

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
    console.error(`JSON parse error in member cache:`, parseError.message);
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
 * Get cached member group members from redis
 * @param {number|string} userId
 * @returns {Array|null} Cached member data or null if not found
 */
export const getCachedMemberGroupMembers = async (userId) => {
  try {
    if (!isValidUserId(userId)) {
      console.error(`Redis getCachedMemberGroupMembers error: Invalid userId provided: ${userId}`);
      return null;
    }

    const cacheKey = `user:${userId}:groupMember:member`;
    const cachedData = await redis.get(cacheKey);
    
    if (cachedData) {
      const parsed = safeJsonParse(cachedData);
      return parsed;
    }
    return null;
  } catch (error) {
    console.error(`Redis getCachedMemberGroupMembers error for user ${userId}:`, error.message || error);
    return null; // Return null on error, don't break the workflow
  }
};

/**
 * Set member group members in cache
 * @param {number|string} userId
 * @param {Array} memberGroupMembers - Array of groups where user is a regular member
 * @returns {boolean} True if cache was set successfully
 */
export const setCachedMemberGroupMembers = async (userId, memberGroupMembers) => {
  try {
    if (!isValidUserId(userId)) {
      console.error(`Redis setCachedMemberGroupMembers error: Invalid userId provided: ${userId}`);
      return false;
    }

    if (!Array.isArray(memberGroupMembers)) {
      console.error(`Redis setCachedMemberGroupMembers error: memberGroupMembers must be an array`);
      return false;
    }

    const cacheKey = `user:${userId}:groupMember:member`;
    const serialized = JSON.stringify(memberGroupMembers);
    
    if (serialized.length > 1048576) {
      console.warn(`Redis setCachedMemberGroupMembers warning: Member groups for user ${userId} exceeds size limit`);
      return false;
    }

    await redis.set(cacheKey, serialized, {
      EX: MEMBER_GROUP_MEMBER_TTL
    });
    return true;
  } catch (error) {
    console.error(`Redis setCachedMemberGroupMembers error for user ${userId}:`, error.message || error);
    return false;
  }
};

/**
 * Invalidate member group members cache
 * @param {number|string} userId
 * @returns {boolean} True if invalidation was successful
 */
export const invalidateMemberGroupMembersCache = async (userId) => {
  try {
    if (!isValidUserId(userId)) {
      console.error(`Redis invalidateMemberGroupMembersCache error: Invalid userId provided: ${userId}`);
      return false;
    }

    const cacheKey = `user:${userId}:groupMember:member`;
    const result = await redis.del(cacheKey);
    return result > 0;
  } catch (error) {
    console.error(`Redis invalidateMemberGroupMembersCache error for user ${userId}:`, error.message || error);
    return false;
  }
};

/**
 * Invalidate all member group caches for a group (when member joins/leaves)
 * @param {number|string|Array} userIds - Single userId or array of userIds
 * @returns {boolean} True if at least one cache was invalidated
 */
export const invalidateMemberGroupMembersForUsers = async (userIds) => {
  try {
    const ids = Array.isArray(userIds) ? userIds : [userIds];
    const validIds = ids.filter(id => isValidUserId(id));
    if (validIds.length === 0) {
      console.error(`Redis invalidateMemberGroupMembersForUsers error: No valid userIds provided`);
      return false;
    }
    const keys = validIds.map(id => `user:${id}:groupMember:member`);
    
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
    console.error(`Redis invalidateMemberGroupMembersForUsers error:`, error.message || error);
    return false;
  }
};

/**
 * Update single member group in cache
 * @param {number|string} userId
 * @param {number|string} groupId
 * @param {Object} updatedGroupData
 * @returns {boolean} True if update successful
 */
export const updateCachedMemberGroup = async (userId, groupId, updatedGroupData) => {
  try {
    if (!isValidUserId(userId) || !isValidUserId(groupId)) {
      console.error(`Redis updateCachedMemberGroup error: Invalid userId or groupId provided`);
      return false;
    }

    if (!updatedGroupData || typeof updatedGroupData !== 'object') {
      console.error(`Redis updateCachedMemberGroup error: Invalid updatedGroupData provided`);
      return false;
    }

    const cacheKey = `user:${userId}:groupMember:member`;
    const cachedList = await redis.get(cacheKey);
    
    if (!cachedList) {
      return false;
    }

    const groupList = safeJsonParse(cachedList);
    if (!groupList) {
      return false;
    }

    const groupIndex = groupList.findIndex(g => g && g.id === groupId);
    
    if (groupIndex === -1) {
      return false;
    }

    groupList[groupIndex] = { ...groupList[groupIndex], ...updatedGroupData };
    await redis.set(cacheKey, JSON.stringify(groupList), {
      EX: MEMBER_GROUP_MEMBER_TTL
    });
    return true;
  } catch (error) {
    console.error(`Redis updateCachedMemberGroup error for user ${userId}:`, error.message || error);
    return false;
  }
};

/**
 * Add member to cached member group
 * @param {number|string} userId
 * @param {number|string} groupId
 * @param {Object} memberData
 * @returns {boolean} True if member added
 */
export const addMemberToMemberGroup = async (userId, groupId, memberData) => {
  try {
    if (!isValidUserId(userId) || !isValidUserId(groupId)) {
      console.error(`Redis addMemberToMemberGroup error: Invalid userId or groupId provided`);
      return false;
    }

    if (!memberData || typeof memberData !== 'object' || !memberData.id) {
      console.error(`Redis addMemberToMemberGroup error: Invalid memberData provided`);
      return false;
    }

    const cacheKey = `user:${userId}:groupMember:member`;
    const cachedList = await redis.get(cacheKey);
    
    if (!cachedList) {
      return false;
    }

    const groupList = safeJsonParse(cachedList);
    if (!groupList) {
      return false;
    }

    const groupIndex = groupList.findIndex(g => g && g.id === groupId);
    
    if (groupIndex === -1 || !Array.isArray(groupList[groupIndex].members)) {
      return false;
    }

    const memberExists = groupList[groupIndex].members.some(m => m && m.id === memberData.id);
    if (memberExists) {
      return false;
    }

    groupList[groupIndex].members.push(memberData);
    await redis.set(cacheKey, JSON.stringify(groupList), {
      EX: MEMBER_GROUP_MEMBER_TTL
    });
    return true;
  } catch (error) {
    console.error(`Redis addMemberToMemberGroup error for user ${userId}:`, error.message || error);
    return false;
  }
};

/**
 * Remove member from cached member group
 * @param {number|string} userId
 * @param {number|string} groupId
 * @param {number|string} memberId
 * @returns {boolean} True if member removed
 */
export const removeMemberFromMemberGroup = async (userId, groupId, memberId) => {
  try {
    if (!isValidUserId(userId) || !isValidUserId(groupId) || !isValidUserId(memberId)) {
      console.error(`Redis removeMemberFromMemberGroup error: Invalid ids provided`);
      return false;
    }

    const cacheKey = `user:${userId}:groupMember:member`;
    const cachedList = await redis.get(cacheKey);
    
    if (!cachedList) {
      return false;
    }

    const groupList = safeJsonParse(cachedList);
    if (!groupList) {
      return false;
    }

    const groupIndex = groupList.findIndex(g => g && g.id === groupId);
    
    if (groupIndex === -1 || !Array.isArray(groupList[groupIndex].members)) {
      return false;
    }

    const originalLength = groupList[groupIndex].members.length;
    groupList[groupIndex].members = groupList[groupIndex].members.filter(
      m => m && m.id !== memberId
    );

    if (groupList[groupIndex].members.length === originalLength) {
      return false; // No change
    }

    await redis.set(cacheKey, JSON.stringify(groupList), {
      EX: MEMBER_GROUP_MEMBER_TTL
    });
    return true;
  } catch (error) {
    console.error(`Redis removeMemberFromMemberGroup error for user ${userId}:`, error.message || error);
    return false;
  }
};

/**
 * Clear all member group member caches
 * @returns {number} Number of keys deleted
 */
export const clearAllMemberGroupCaches = async () => {
  try {
    let cursor = "0";
    const keys = [];
    let iterations = 0;
    const maxIterations = 1000;

    do {
      if (iterations >= maxIterations) {
        console.warn(`Redis clearAllMemberGroupCaches warning: Max iterations reached`);
        break;
      }

      const reply = await redis.scan(cursor, {
        MATCH: "user:*:groupMember:member",
        COUNT: 100
      });

      if (!reply || typeof reply.cursor === 'undefined') {
        console.error(`Redis clearAllMemberGroupCaches error: Invalid scan response`);
        break;
      }

      cursor = reply.cursor;
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
        console.error(`Redis clearAllMemberGroupCaches error deleting keys:`, deleteError.message || deleteError);
        return 0;
      }
    }
    return 0;
  } catch (error) {
    console.error(`Redis clearAllMemberGroupCaches error:`, error.message || error);
    return 0;
  }
};
