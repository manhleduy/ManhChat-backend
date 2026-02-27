import { database } from "../../config/db.js";
import { getSenderSocketId } from "../redis/onlineUser.js";
import { io } from "../../config/socket.js";
import cloudinary from "../../config/cloundinary.js";
import { handleNewGroupMessage, fetchAndMergeWithGroupStream } from "../redis/stream/groupMessage.js";

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
 * Create a new group chat message
 * @route POST /api/chat/group/create/:id
 */
export const CreateGroupChat = async (req, res) => {
    try {
        const groupId = req.params.id;
        const { senderId, content, file } = req.body;
        const createdAt = new Date()

        if (file) {
            const uploadResponse = await uploadToCloudinary(file);
            if (uploadResponse === "Fail") return res.status(500).json("server error");
            if (groupId) {
                io.to(groupId.toString()).emit("receiveGroupMessage", {
                    content: content,
                    file: uploadResponse || "",
                    createdAt: createdAt,
                    senderId: senderId,
                    groupId: parseInt(groupId)
                });
            }
            const insertResult = await database.query(`
            INSERT INTO 
            groupchatblocks(groupid, content, file, senderid, createdat, likenum)
            VALUES ($1,$2,$3,$4,$5,0)
            RETURNING id
            `, [groupId, content, uploadResponse, senderId, createdAt]);

            const messageId = insertResult.rows?.[0]?.id;
            // gather sender info for caching
            const userInfo = await database.query(`SELECT name, profilepic FROM users WHERE id=$1`, [senderId]);
            const name = userInfo.rows?.[0]?.name || "";
            const profilePic = userInfo.rows?.[0]?.profilepic || "";
            // cache to stream asynchronously
            if (messageId) {
                handleNewGroupMessage(messageId, groupId, content, uploadResponse, senderId, createdAt, name, profilePic)
                    .catch(e=>console.warn("Failed to cache group message:", e.message));
            }
            return res.status(201).json({
                id: messageId,
                content,
                file: uploadResponse || "",
                createdAt,
                senderId,
                groupId: parseInt(groupId),
                likeNum:0
            });
        }
        if (groupId) {
            io.to(groupId.toString()).emit("receiveGroupMessage", {
                content: content,
                file: file || "",
                createdAt: createdAt,
                senderId: senderId,
                groupId: parseInt(groupId)
            });
        }

        if (!groupId || !content || !senderId) {
            return res.status(400).json("missing required value")
        }

        const insertResult2 = await database.query(`
            INSERT INTO 
            groupchatblocks(groupid, content, file, senderid, createdat, likenum)
            VALUES ($1,$2,$3,$4,$5,0)
            RETURNING id
            `, [groupId, content, file, senderId, createdAt]);
        const messageId2 = insertResult2.rows?.[0]?.id;
        // cache entry
        const userInfo2 = await database.query(`SELECT name, profilepic FROM users WHERE id=$1`, [senderId]);
        const name2 = userInfo2.rows?.[0]?.name || "";
        const profilePic2 = userInfo2.rows?.[0]?.profilepic || "";
        if (messageId2) {
            handleNewGroupMessage(messageId2, groupId, content, file, senderId, createdAt, name2, profilePic2)
                .catch(e=>console.warn("Failed to cache group message:", e.message));
        }
        return res.status(201).json({
            id: messageId2,
            content,
            file: file || "",
            createdAt,
            senderId,
            groupId: parseInt(groupId),
            likeNum: 0
        })
    } catch (e) {
        console.log(e);
        return res.status(500).json("server error");
    }
}

/**
 * Get all group chat messages for a group
 * @route POST /api/chat/group/:id
 */
export const GetAllGroupChat = async (req, res) => {
    try {
        const groupId = req.params.id;
        const { memberId, limit = 20, offset = 0 } = req.body;
        if (!memberId || !groupId) {
            return res.status(400).json("missing required value")
        }

        // first attempt to merge with stream cache; ensures output shape remains same
        let merged = await fetchAndMergeWithGroupStream(groupId, limit, offset);
        let rows = [];
        if (merged && merged.length > 0) {
            rows = merged;
        } else {
            // fallback to DB query if stream empty or error
            const result = await database.query(`
                SELECT a.id, a.content, a.file, a.createdat,
                 a.likenum, a.senderid, b.profilepic,
                 b.name
                FROM groupchatblocks a
                INNER JOIN users b
                ON a.senderid= b.id
                WHERE a.groupid=$1
                ORDER BY a.createdat DESC
                LIMIT $2 OFFSET $3
                `,
                [groupId, limit, offset]
            );
            rows = result.rows;
        }
        const messages = rows.map((item) => {
            return {
                id: item.id,
                content: item.content,
                file: item.file,
                createdAt: item.createdat,
                senderId: item.senderid,
                likeNum: item.likenum,
                groupId: parseInt(groupId),
                name: item.name,
                profilePic: item.profilepic,
            }
        });
        return res.status(200).json(messages.reverse());
    } catch (e) {
        console.log(e);
        return res.status(500).json("server error");
    }
}

/**
 * Like a group chat message
 * @route PUT /api/chat/group/like/:id
 */
export const LikeGroupChat = async (req, res) => {
    try {
        const groupId = req.params.id;
        const { chatblockId } = req.body;
        if (!chatblockId || !groupId) {
            return res.status(400).json("missing the required value");
        }

        if (groupId) {
            io.to(groupId.toString()).emit("likeGroupMessage", {
                chatblockId: chatblockId,
                groupId: groupId
            });
        }

        await database.query(`
            UPDATE groupchatblocks
            SET likenum= likenum+1
            WHERE id=$1 AND groupid=$2`
            , [chatblockId, groupId]);
        return res.status(200).json("liked")
    } catch (e) {
        console.log(e);
        return res.status(500).json('server error');
    }
}

/**
 * Recall (delete) a group chat message
 * @route DELETE /api/chat/group/recall/:id
 */
export const RecallGroupChat = async (req, res) => {
    try {
        const groupId = req.params.id;
        const { userId, chatblockId } = req.body

        if (!userId || !chatblockId || !groupId) {
            return res.status(400).json("missing required value");
        }
        io.to(groupId.toString()).emit("recallGroupMessage", {
            chatblockId: chatblockId,
            groupId: groupId
        });

        if (groupId) {
            io.to(groupId.toString()).emit("recallGroupMessage", {
                chatblockId: chatblockId,
                groupId: groupId
            });
        }

        await database.query(`
            DELETE FROM groupchatblocks
            WHERE id= $1 AND senderid=$2 AND groupid=$3
            `, [chatblockId, userId, groupId])

        return res.status(200).json("delete successfully");
    } catch (e) {
        console.log(e);
        return res.status(500).json("server error");
    }
}
