import { database } from "../../config/db.js";
import { getSenderSocketId } from "../../service/socketChatService.js";
import { io } from "../../config/socket.js";
import cloudinary from "../../config/cloundinary.js";
import { fetchAndMergeWithStream, handleNewMessage } from "../redis/stream/friendMessage.js";
import FriendRealTimeChat from "../../service/socketChatService.js"
async function uploadToCloudinary(fileString) {
    try {
        const result = await cloudinary.uploader.upload(fileString, {
            folder: "main",
            resource_type: "auto"
        });
        return result.secure_url
    } catch (error) {
        console.error("Upload Error:", error);
        return "Fail"
    }
}
/**
 * Create a new private chat message
 * @route POST /api/chat/create/:id
 */
export const CreateChat = async (req, res, next) => {
    const senderId = req.params.id;
    try {
        const { content, file, receiverId } = req.body;
        if (!content || !senderId || !receiverId) {
            return res.status(400).json("missing content")
        }
        const createdAt = new Date();

        if (file) {
            const uploadResponse = await uploadToCloudinary(file);
            if (uploadResponse === "Fail") return res.status(500).json("server error");
            
            // Insert into database with RETURNING to get messageId
            const dbResult = await database.query(`
                INSERT INTO 
                chatblocks (content, file, likenum, createdat, senderid, receiverid, isread)
                VALUES ($1, $2, 0, $3, $4, $5, FALSE)
                RETURNING id
            `, [content, uploadResponse, createdAt, senderId, receiverId]);

            const messageId = dbResult.rows?.[0]?.id;

            // Emit to connected user in real-time
            await FriendRealTimeChat.SendChatToFriend({
                    id: messageId,
                    content: content,
                    file: uploadResponse,
                    createdAt: createdAt,
                    senderId: parseInt(senderId),
                    receiverId: parseInt(receiverId),
                    likenum: 0
                },receiverId);
            

            // Cache to Redis stream asynchronously (non-blocking)
            if (messageId) {
                handleNewMessage(messageId, parseInt(senderId), parseInt(receiverId), content, uploadResponse, createdAt)
                    .catch(err => console.warn("Failed to cache message in Redis:", err.message));
            }

            return res.status(201).json("send successfully!")
        }

        const safeFile = file ? file : "";
        
        // Insert into database with RETURNING to get messageId
        const dbResult = await database.query(`
            INSERT INTO 
            chatblocks (content, file, likenum, createdat, senderid, receiverid, isread)
            VALUES ($1, $2, 0, $3, $4, $5, FALSE)
            RETURNING id
        `, [content, safeFile, createdAt, senderId, receiverId]);

        const messageId = dbResult.rows?.[0]?.id;

        // Emit to connected user in real-time

        await FriendRealTimeChat.SendChatToFriend(receiverId,{
                id: messageId,
                content: content,
                file: safeFile,
                createdAt: createdAt,
                senderId: parseInt(senderId),
                receiverId: parseInt(receiverId),
                likenum: 0
            });
        

        // Cache to Redis stream asynchronously (non-blocking)
        if (messageId) {
            handleNewMessage(messageId, parseInt(senderId), parseInt(receiverId), content, safeFile, createdAt)
                .catch(err => console.warn("Failed to cache message in Redis:", err.message));
        }

        return res.status(201).json("send successfully!")
    } catch (e) {
        next(e);
    }
}

/**
 * Get all private chat messages between two users
 * @route POST /api/chat/:id
 */
export const GetAllChat = async (req, res, next) => {
    const senderId = req.params.id;
    try {
        const { receiverId, limit = 20, offset = 0 } = req.body;
        //redis cache
        
        //const result1= await fetchAndMergeWithStream(senderId, receiverId, limit, offset)

         const result1 = await database.query(`
            SELECT *
            FROM chatblocks
            WHERE (senderid=$1 AND receiverid=$2) 
            OR (senderid=$3 AND receiverid=$4) 
            ORDER BY createdat
            LIMIT $5 OFFSET $6
        `, [senderId, receiverId, receiverId, senderId, limit, offset ]);

        const result2 = await database.query(`
            SELECT name, profilepic
            FROM users
            WHERE id=$1
            `, [senderId]
        )

        const messages = result1.rows.map((item) => {
            return {
                id: parseInt(item.id),
                content: item.content,
                file: item.file,
                likeNum: parseInt(item.likenum),
                createdAt: item.createdat,
                senderId: parseInt(item.senderid),
                receiverId: parseInt(item.receiverid),
                isRead: item.isread,
                name: result2.rows[0].name,
                profilePic: result2.rows[0].profilepic || "",
            }
        })
        
        
        return res.status(200).json(messages)
    } catch (e) {
        next(e);
    }
}

/**
 * Like a private chat message
 * @route PUT /api/chat/like/:id
 */
export const LikeChat = async (req, res, next) => {
    try {
        const chatblockId = req.params.id;
        console.log(chatblockId);
        if (!chatblockId) {
            return res.status(400).json("missing the chat block which you want to send a like");
        }

        const senderInfo = await database.query(`
            SELECT senderid, receiverid
            FROM chatblocks
            WHERE id=$1
            `, [chatblockId])

        await FriendRealTimeChat.LikeFriendMessage(
            senderInfo.rows[0].receiverid,
            {
                chatblockId: chatblockId,
                senderId: senderInfo.rows[0].senderid,
                receiverId: senderInfo.rows[0].receiverid
            }
        )


        await database.query(`
            UPDATE chatblocks 
            SET likenum= likenum+1
            WHERE id=$1`, [chatblockId]);
        return res.status(200).json("liked")
    } catch (e) {
        next(e);
    }
}

/**
 * Recall (delete) a private chat message
 * @route DELETE /api/chat/recall/:id
 */
export const RecallChat = async (req, res, next) => {
    try {
        const userId = req.params.id;
        const { chatblockId } = req.body

        if (!userId || !chatblockId) {
            return res.status(400).json("missing required value");
        }

        const result = await database.query(`
            SELECT receiverid
            FROM chatblocks
            WHERE id=$1 AND senderid=$2
            `, [chatblockId, userId])
        
        const receiverId = result.rows[0].receiverid;
        
        await FriendRealTimeChat.RecallMessage(
            receiverId,
            {
                chatblockId: chatblockId,
                senderId: userId
            }
        )        

        await database.query(`
            DELETE FROM chatblocks
            WHERE id= $1 AND senderid=$2
            `, [chatblockId, userId])

        return res.status(200).json("delete successfully");
    } catch (e) {
        next(e);
    }
}
