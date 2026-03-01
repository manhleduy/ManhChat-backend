import { database } from "../../config/db.js";

/**
 * Mark a single chat message as read
 * @route PUT /api/chat/read/:id
 */
export const handleIsRead = async (req, res, next) => {
    try {
        const chatblockId = req.body.id
        const { userId } = req.body
        await database.query(`
            UPDATE chatblocks
            SET isread=TRUE
            WHERE id=$1 AND NOT senderid=$2
            `, [chatblockId, userId])
        return res.status(200).json("readed")
    } catch (e) {
        next(e);
    }
}

/**
 * Mark all chats between two users as read
 * @route PUT /api/chat/read
 */
export const MarkAsRead = async (req, res, next) => {
    try {
        const { receiverId, senderId } = req.body
        await database.query(`
            UPDATE chatblocks
            SET isread=TRUE
            WHERE receiverid=$1 AND senderid=$2
             `, [receiverId, senderId])
        return res.status(200).json("readed")
    } catch (e) {
        next(e);
    }
}
