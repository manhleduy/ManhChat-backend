import redis from "../../../config/redis.js";
import {database} from "../../../config/db.js";


/**
 * Generate a consistent stream path for a friend chat room
 * Format: friendChat:room:{smaller_id}<=>{larger_id}
 * This ensures same room regardless of message direction
 * @param {number} senderId - ID of the sender
 * @param {number} receiverId - ID of the receiver
 * @returns {string} - Stream key path
 */
export const streamPath = (senderId, receiverId) => {
    if (senderId > receiverId) {
        return `friendChat:room:${senderId}<=>${receiverId}`;
    } else if (senderId < receiverId) {
        return `friendChat:room:${receiverId}<=>${senderId}`;
    }
    return ""; // Invalid: sender and receiver are the same
}

/**
 * Push a message to Redis Stream
 * @param {number} senderId - ID of the sender
 * @param {number} receiverId - ID of the receiver
 * @param {object} messageData - Message object with content, file, createdAt, etc.
 * @returns {string} - Stream entry ID or null on error
 */
export const pushToStream = async (senderId, receiverId, messageData) => {
    try {
        // Validate inputs
        if (!senderId || !receiverId || senderId === receiverId) {
            console.error("Invalid senderId or receiverId");
            return null;
        }

        const streamKey = streamPath(senderId, receiverId);
        if (!streamKey) {
            console.error("Failed to generate stream path");
            return null;
        }

        const streamId = await redis.xAdd(
            streamKey,
            "*",
            messageData
        );

        return streamId;
    } catch (error) {
        console.error("Error pushing to stream:", error.message);
        return null;
    }
}

/**
 * Remove a message from Redis Stream
 * @param {number} senderId - ID of the sender
 * @param {number} receiverId - ID of the receiver
 * @param {string} streamId - The Redis stream entry ID
 * @returns {boolean} - Success status
 */
export const popFromStream = async (senderId, receiverId, streamId) => {
    try {
        if (!streamId || !senderId || !receiverId) {
            console.error("Invalid parameters for popFromStream");
            return false;
        }

        const streamKey = streamPath(senderId, receiverId);
        if (!streamKey) {
            console.error("Failed to generate stream path");
            return false;
        }

        const result = await redis.xDel(streamKey, streamId);
        return result > 0;
    } catch (error) {
        console.error("Error popping from stream:", error.message);
        return false;
    }
}

/**
 * Handle new message caching in Redis stream
 * Non-critical operation: failures do not affect main workflow
 * This function is called asynchronously after DB insert
 * @param {number} messageId - ID of the message from database
 * @param {number} senderId - ID of the sender
 * @param {number} receiverId - ID of the receiver
 * @param {string} content - Message content
 * @param {string|null} file - File URL (optional)
 * @param {Date} createdAt - Timestamp of message
 * @returns {Promise<string|null>} - Stream entry ID or null (non-blocking)
 */
export const handleNewMessage = async (messageId, senderId, receiverId, content, file = null, createdAt = new Date()) => {
    // Non-blocking async operation - silently fail if Redis is down
    try {
        // Validate inputs
        if (!messageId || !senderId || !receiverId || !content) {
            console.debug("Invalid parameters for caching message to stream");
            return null;
        }

        if (senderId === receiverId) {
            console.debug("Invalid: sender and receiver are the same");
            return null;
        }

        // Push to Redis stream for caching
        const streamEntryId = await pushToStream(senderId, receiverId, {
            id: messageId.toString(),
            content: content,
            file: file || "",
            createdAt: createdAt instanceof Date ? createdAt.toISOString() : createdAt,
            senderId: senderId.toString(),
            receiverId: receiverId.toString(),
            likenum: "0"
        });

        return streamEntryId;
    } catch (error) {
        // Redis stream caching failure should not break main workflow
        console.warn(`Redis stream caching failed for message ${messageId}:`, error.message);
        return null;
    }
}

/**
 * Fetch and merge messages from both database and Redis stream
 * Stream messages are newer and take precedence
 * @param {number} senderId - ID of the sender
 * @param {number} receiverId - ID of the receiver
 * @param {number} limit - Maximum number of messages to fetch (default 20)
 * @param {number} offset - Offset for pagination (default 0)
 * @returns {array} - Array of messages or empty array on error
 */
export const fetchAndMergeWithStream = async (senderId, receiverId, limit = 20, offset = 0) => {
    try {
        // Validate inputs
        if (!senderId || !receiverId || senderId === receiverId) {
            console.error("Invalid senderId or receiverId");
            return [];
        }

        // Get stream key
        const streamKey = streamPath(senderId, receiverId);
        if (!streamKey) {
            console.error("Failed to generate stream path");
            return [];
        }

        // Fetch from Redis stream
        let streamMessages = [];
        try {
            const messages = await redis.xRange(streamKey, "-", "+");
            streamMessages = messages.map(element=>element.message) || [];
        } catch (redisError) {
            console.warn("Warning: Failed to fetch from Redis stream:", redisError.message);
            // Continue without stream messages
        }

        const streamLen = streamMessages.length;

        // If no messages needed from DB (all from stream)
       

        // Fetch from database
        const queryResult = await database.query(`
            SELECT *
            FROM chatblocks
            WHERE (senderid=$1 AND receiverid=$2) 
            OR (senderid=$3 AND receiverid=$4) 
            ORDER BY createdat DESC
            LIMIT $5 OFFSET $6
        `, [senderId, receiverId, receiverId, senderId, limit, offset + streamLen]);
        
        if (queryResult.rows.length===0) {
            return streamMessages;
        }

        const dbMessages = queryResult.rows;
        console.log([...streamMessages, ...dbMessages])

        // Merge stream and DB messages
        if (offset === 0 && streamLen > 0) {
            // Send stream messages first (most recent), then DB messages
            return [...streamMessages, ...dbMessages];
        }

        return dbMessages;
    } catch (error) {
        console.error("Error fetching and merging stream:", error.message);
        return [];
    }
}

/**
 * Cleanup old messages from Redis stream (for maintenance)
 * @param {number} senderId - ID of the sender
 * @param {number} receiverId - ID of the receiver
 * @returns {boolean} - Success status
 */
export const cleanupOldStreamMessages = async (senderId, receiverId) => {
    try {
        const streamKey = streamPath(senderId, receiverId);
        if (!streamKey) {
            console.error("Failed to generate stream path");
            return false;
        }

        // Delete the entire stream (or could trim based on time)
        const result = await redis.del(streamKey);
        return result > 0;
    } catch (error) {
        console.error("Error cleaning up stream:", error.message);
        return false;
    }
}