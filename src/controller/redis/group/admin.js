import redis from "../../../config/redis.js";

// Cache expiration duration in seconds (12 hours for member admin data)
const ADMIN_GROUP_MEMBER_TTL = 43200;

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
    console.error(`JSON parse error in admin cache:`, parseError.message);
    return null;
  }
};

/**
 * Validate user ID and group ID
 * @param {*} userId
 * @returns {boolean} True if userId is valid
 */
const isValidUserId = (userId) => {
  return userId && (typeof userId === 'number' || typeof userId === 'string') && userId !== '';
};

/**
 * Get cached admin group members from redis
 * @param {number|string} userId
 * @returns {Array|null} Cached admin data or null if not found
 */
export const getCachedAdminGroupMembers = async (userId) => {
  try {
    if (!isValidUserId(userId)) {
      console.error(`Redis getCachedAdminGroupMembers error: Invalid userId provided: ${userId}`);
      return null;
    }

    const cacheKey = `user:${userId}:groupMember:admin`;
    const cachedData = await redis.get(cacheKey);
    
    if (cachedData) {
      const parsed = safeJsonParse(cachedData);
      return parsed;
    }
    return null;
  } catch (error) {
    console.error(`Redis getCachedAdminGroupMembers error for user ${userId}:`, error.message || error);
    return null;
  }
};

/**
 * Set admin group members in cache
 * @param {number|string} userId
 * @param {Array} adminGroupMembers - Array of groups where user is admin
 * @returns {boolean} True if cache was set successfully
 */
export const setCachedAdminGroupMembers = async (userId, adminGroupMembers) => {
  try {
    if (!isValidUserId(userId)) {
      console.error(`Redis setCachedAdminGroupMembers error: Invalid userId provided: ${userId}`);
      return false;
    }

    if (!Array.isArray(adminGroupMembers)) {
      console.error(`Redis setCachedAdminGroupMembers error: adminGroupMembers must be an array`);
      return false;
    }

    const cacheKey = `user:${userId}:groupMember:admin`;
    const serialized = JSON.stringify(adminGroupMembers);
    
    if (serialized.length > 1048576) { // 1MB limit
      console.warn(`Redis setCachedAdminGroupMembers warning: Admin groups for user ${userId} exceeds size limit`);
      return false;
    }

    await redis.set(cacheKey, serialized, {
      EX: ADMIN_GROUP_MEMBER_TTL
    });
    return true;
  } catch (error) {
    console.error(`Redis setCachedAdminGroupMembers error for user ${userId}:`, error.message || error);
    return false;
  }
};

/**
 * Invalidate admin group members cache
 * @param {number|string} userId
 * @returns {boolean} True if invalidation was successful
 */
export const invalidateAdminGroupMembersCache = async (userId) => {
  try {
    if (!isValidUserId(userId)) {
      console.error(`Redis invalidateAdminGroupMembersCache error: Invalid userId provided: ${userId}`);
      return false;
    }

    const cacheKey = `user:${userId}:groupMember:admin`;
    const result = await redis.del(cacheKey);
    return result > 0;
  } catch (error) {
    console.error(`Redis invalidateAdminGroupMembersCache error for user ${userId}:`, error.message || error);
    return false;
  }
};

/**
 * Update single admin group in cache (for last message or member count updates)
 * @param {number|string} userId
 * @param {number|string} groupId
 * @param {Object} updatedGroupData
 * @returns {boolean} True if update was successful
 */
export const updateCachedAdminGroup = async (userId, groupId, updatedGroupData) => {
  try {
    if (!isValidUserId(userId) || !isValidUserId(groupId)) {
      console.error(`Redis updateCachedAdminGroup error: Invalid userId or groupId provided`);
      return false;
    }

    if (!updatedGroupData || typeof updatedGroupData !== 'object') {
      console.error(`Redis updateCachedAdminGroup error: Invalid updatedGroupData provided`);
      return false;
    }

    const cacheKey = `user:${userId}:groupMember:admin`;
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
      EX: ADMIN_GROUP_MEMBER_TTL
    });
    return true;
  } catch (error) {
    console.error(`Redis updateCachedAdminGroup error for user ${userId}:`, error.message || error);
    return false;
  }
};

/**
 * Add member to cached admin group
 * @param {number|string} userId
 * @param {number|string} groupId
 * @param {Object} memberData
 * @returns {boolean} True if member was added
 */
export const addMemberToAdminGroup = async (userId, groupId, memberData) => {
  try {
    if (!isValidUserId(userId) || !isValidUserId(groupId)) {
      console.error(`Redis addMemberToAdminGroup error: Invalid userId or groupId provided`);
      return false;
    }

    if (!memberData || typeof memberData !== 'object' || !memberData.id) {
      console.error(`Redis addMemberToAdminGroup error: Invalid memberData provided`);
      return false;
    }

    const cacheKey = `user:${userId}:groupMember:admin`;
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

    // Check if member already exists
    const memberExists = groupList[groupIndex].members.some(m => m && m.id === memberData.id);
    if (memberExists) {
      return false; // Member already exists
    }

    groupList[groupIndex].members.push(memberData);
    await redis.set(cacheKey, JSON.stringify(groupList), {
      EX: ADMIN_GROUP_MEMBER_TTL
    });
    return true;
  } catch (error) {
    console.error(`Redis addMemberToAdminGroup error for user ${userId}:`, error.message || error);
    return false;
  }
};

/**
 * Remove member from cached admin group
 * @param {number} userId
 * @param {number} groupId
 * @param {number} memberId
 */
export const removeMemberFromAdminGroup = async (userId, groupId, memberId) => {
  try {
    const cacheKey = `user:${userId}:groupMember:admin`;
    const cachedList = await redis.get(cacheKey);
    
    if (cachedList) {
      const groupList = JSON.parse(cachedList);
      const groupIndex = groupList.findIndex(g => g.id === groupId);
      
      if (groupIndex !== -1 && groupList[groupIndex].members) {
        groupList[groupIndex].members = groupList[groupIndex].members.filter(
          m => m.id !== memberId
        );
        await redis.set(cacheKey, JSON.stringify(groupList), {
          EX: ADMIN_GROUP_MEMBER_TTL
        });
      }
    }
  } catch (error) {
    console.error(`Redis removeMemberFromAdminGroup error for user ${userId}:`, error);
    // Don't throw error, just log it to not affect workflow
  }
};

/**
 * Clear all admin group member caches
 */
export const clearAllAdminGroupCaches = async () => {
  try {
    let cursor = "0";
    const keys = [];

    do {
      const reply = await redis.scan(cursor, {
        MATCH: "user:*:groupMember:admin",
        COUNT: 100
      });

      cursor = reply.cursor;
      keys.push(...reply.keys);
    } while (cursor !== "0");

    if (keys.length > 0) {
      await redis.del(keys);
    }
  } catch (error) {
    console.error(`Redis clearAllAdminGroupCaches error:`, error);
    // Don't throw error, just log it
  }
};
