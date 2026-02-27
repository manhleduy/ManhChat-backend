import redis from "../../../config/redis.js";
import{ database } from "../../../config/db.js";

/**
 * Build stream key for a group chat room
 * @param {number|string} groupId
 * @returns {string}
 */
export const groupStreamPath = (groupId) => {
    if (!groupId) return "";
    return `groupChat:room:${groupId}`;
}

/**
 * Push a message record to group chat stream (non-blocking)
 * @param {number|string} groupId
 * @param {object} messageData
 * @returns {string|null} stream entry id or null on failure
 */
export const pushGroupToStream = async (groupId, messageData) => {
    try {
        if (!groupId || !messageData) return null;
        const key = groupStreamPath(groupId);
        if (!key) return null;
        const id = await redis.xAdd(key, "*", messageData);
        return id;
    } catch (err) {
        console.error("Error pushing group message to stream:", err.message);
        return null;
    }
};

/**
 * Delete an entry from a group chat stream
 * @param {number|string} groupId
 * @param {string} streamId
 * @returns {boolean} success
 */
export const popGroupFromStream = async (groupId, streamId) => {
    try {
        if (!groupId || !streamId) return false;
        const key = groupStreamPath(groupId);
        if (!key) return false;
        const res = await redis.xDel(key, streamId);
        return res > 0;
    } catch (err) {
        console.error("Error popping group stream entry:", err.message);
        return false;
    }
};

/**
 * Cache a new group message asynchronously; failures don't block
 * @param {number} messageId
 * @param {number|string} groupId
 * @param {string} content
 * @param {string|null} file
 * @param {number|string} senderId
 * @param {Date|string} createdAt
 * @param {string} senderName
 * @param {string} senderPic
 * @returns {Promise<string|null>}
 */
export const handleNewGroupMessage = async (messageId, groupId, content, file = null, senderId, createdAt = new Date(), senderName = "", senderPic = "") => {
    try {
        if (!messageId || !groupId || !content || !senderId) {
            console.debug("Invalid parameters for handleNewGroupMessage");
            return null;
        }
        const payload = {
            id: messageId.toString(),
            content,
            file: file || "",
            createdAt: createdAt instanceof Date ? createdAt.toISOString() : createdAt,
            senderId: senderId.toString(),
            groupId: groupId.toString(),
            likeNum: "0",
            name: senderName,
            profilePic: senderPic
        };
        return await pushGroupToStream(groupId, payload);
    } catch (err) {
        console.warn("Redis caching of group message failed:", err.message);
        return null;
    }
};

/**
 * Retrieve and merge group chat messages from DB and stream
 * @param {number|string} groupId
 * @param {number} limit
 * @param {number} offset
 * @returns {Array} merged messages
 */
export const fetchAndMergeWithGroupStream = async (groupId, limit = 20, offset = 0) => {
    try {
        if (!groupId) return [];
        const key = groupStreamPath(groupId);
        if (!key) return [];
        let streamMessages = [];
        try {
            const msgs = await redis.xRange(key, "-", "+");
            streamMessages = (msgs || []).map(e => e.message);
        } catch (redisErr) {
            console.warn("Failed to read group stream:", redisErr.message);
        }
        const streamLen = streamMessages.length;
        // if offset=0 and enough stream messages to satisfy limit, return them directly
        if (offset === 0 && streamLen > 0 && streamLen >= limit) {
            return streamMessages.slice(0, limit);
        }
        // fetch DB messages
        const queryResult = await database.query(`
            SELECT a.id, a.content, a.file, a.createdat,
             a.likenum, a.senderid, b.profilepic,
             b.name
            FROM groupchatblocks a
            INNER JOIN users b
            ON a.senderid= b.id
            WHERE a.groupid=$1
            ORDER BY a.createdat DESC
            LIMIT $2 OFFSET $3
        `, [groupId, limit, offset + streamLen]);
        const dbMessages = queryResult.rows || [];
        if (offset === 0 && streamLen > 0) {
            return [...dbMessages, ...streamMessages];
        }
        return dbMessages;
    } catch (error) {
        console.error("Error fetching/merging group stream:", error.message);
        return [];
    }
};

/**
 * Delete entire group stream (maintenance)
 */
export const cleanupOldGroupStream = async (groupId) => {
    try {
        const key = groupStreamPath(groupId);
        if (!key) return false;
        const r = await redis.del(key);
        return r > 0;
    } catch (error) {
        console.error("Error cleaning up group stream:", error.message);
        return false;
    }
};

