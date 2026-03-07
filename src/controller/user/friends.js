import { database } from "../../config/db.js";
import { getCachedFriendList, setCachedFriendList, invalidateFriendListCache } from "../redis/userFriend.js";
import { io } from "../../config/socket.js";
import RealTimeFriend from "../../service/socketFriendService.js"

/**
 * Get all friends of a user
 * @route GET /api/user/friends/:id
 */
export const GetAllFriend = async (req, res, next) => {
    try {
        const id = req.params.id;
        if (!id) {
            return res.status(400).json("missing required data")
        }

        // Try to get cached friend list first
        const cachedFriendList = await getCachedFriendList(id);
        if (cachedFriendList) {
            return res.status(200).json({
                message: "Here is your friendlist (cached)",
                friendList: cachedFriendList
            });
        }

        const data = await database.query(`
            SELECT DISTINCT ON (friends.id) friends.id, friends.name,
            friends.address, friends.email, friends.profilePic, 
            friends.phonenumber, friends.birthday, chats.lastmessage,
            chats.isread, chats.createdat
            FROM(
                SELECT a.id, a.name,
                a.address, a.email, a.profilePic, 
                a.phonenumber, a.birthday
                FROM users a
                INNER JOIN userconnects b
                ON a.id= b.friendid
                WHERE b.userid= $1 AND b.isvalid=TRUE
            ) AS friends
            LEFT JOIN(
                SELECT senderid, content AS lastmessage, isread, createdat
                FROM chatblocks
                WHERE receiverid=$1
                ORDER BY createdat DESC
            
            ) AS chats
            ON friends.id= chats.senderid
            `, [id])

        const friendList = data.rows.map(
            item => {
                return {
                    id: item.id,
                    name: item.name,
                    address: item.name,
                    email: item.email,
                    profilePic: item.profilepic,
                    phonenumber: item.phonenumber,
                    birthday: item.birthday,
                    lastMessage: item.lastmessage,
                    isRead: item.isread,
                    senderId: item.senderid,
                    createdAt: item.createdat

                }
            }
        ) || [];

        // Cache the friend list
        await setCachedFriendList(id, friendList);

        res.status(200).json({
            message: "Here is your friendlist",
            friendList: friendList
        })
    } catch (e) {
        next(e);
    }
}

/**
 * Create user friend connection (send friend request)
 * @route POST /api/user/friends/add/:id
 */
export const createUserConnect = async (req, res, next) => {
    try {
        const userId = req.params.id;
        const { friendId } = req.body
        if (!userId || !friendId) {
            return res.status(400).json("missing reqired value")
        }
        const createdAt = new Date();

        await database.query(`
            INSERT INTO userconnects(userId, friendId,isvalid, createdat)
            VALUES ($1,$2,TRUE,$3)
            `, [userId, friendId, createdAt]);
        await database.query(`
            INSERT INTO userconnects( userId, friendId,isvalid, createdat)
            VALUES ($1,$2,TRUE,$3);
            `, [friendId, userId, createdAt])
        
        // Invalidate friend list caches for both users
        await invalidateFriendListCache(userId, friendId);
        
        res.status(201).json("created successful");
    } catch (e) {
        next(e);
    }
}

/**
 * Delete/remove friend
 * @route DELETE /api/user/friends/:id
 */
export const DeleteFriend = async (req, res, next) => {
    try {
        const userId = req.params.id;
        const { friendId } = req.body;
        
        RealTimeFriend.UnFriend(friendId,{
            userId: userId,
            friendId: friendId
        })
        await database.query(`
            DELETE FROM userconnects 
            WHERE userid=$1 AND friendid=$2
            `, [userId, friendId])
        await database.query(`
            DELETE FROM userconnects
            WHERE userid=$1 AND friendid=$2
            `, [friendId, userId])
        
        // Invalidate friend list caches for both users
        await invalidateFriendListCache(userId, friendId);
        
        return res.status(200).json("delete successfully")
    } catch (e) {
        next(e);
    }
}
