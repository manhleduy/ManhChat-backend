import { database } from "../../config/db.js";
import { io } from "../../config/socket.js";
import RealTimeFriendRequest from "../../service/requestService.js"
import RealTimeFriend from "../../service/socketFriendService.js"
/**
 * Send a friend request to another user
 * @route POST /api/invitation/friend/create/:id
 */
export const SendInvitation = async (req, res, next) => {
    try {
        const senderId = req.params.id;
        const { name, email, phonenumber, content } = req.body;
        const createdAt = new Date()
        if (!senderId || !name || !email || !phonenumber) {
            return res.status(400).json("missing required value")
        }

        const senderInfo = await database.query(`
            SELECT * FROM users
            WHERE id=$1
            `, [senderId])
        const result = await database.query(`
            SELECT * FROM users
            WHERE name= $1 AND email= $2 AND phonenumber= $3`,
            [name, email, phonenumber]
        )

        const receiverId = result.rows[0].id

        await RealTimeFriendRequest.SendRequest(
            receiverId,
            {
                content: content,
                createdAt: createdAt,
                id: parseInt(senderId),
                profilePic: senderInfo.rows[0].profilepic,
                name: senderInfo.rows[0].name
            })

        
        await database.query(
            `INSERT INTO userconnects (userid, friendid, createdat, isvalid, content)
            VALUES ($1, $2, $3, FALSE, $4)`,
            [senderId, receiverId, createdAt, content]
        );

        return res.status(200).json("send invitation successfully");
    } catch (e) {
        next(e);
    }
}

/**
 * Get all friend requests (sent and received)
 * @route GET /api/invitation/friend/:id
 */
export const GetAllRequest = async (req, res, next) => {
    try {
        const id = req.params.id;
        if (!id) {
            return res.status(400).json("missing id")
        }
        const result1 = await database.query(`
            SELECT a.id, a.name, a.profilePic ,b.createdat, b.content
            FROM users a
            INNER JOIN userconnects b
            ON a.id= b.userid
            WHERE b.friendid= $1 AND b.isvalid=FALSE
        `, [id])
        const result2 = await database.query(`
            SELECT a.id, a.name, a.profilePic ,b.createdat, b.content
            FROM users a
            INNER JOIN userconnects b
            ON a.id= b.friendid
            WHERE b.userid= $1 AND b.isvalid=FALSE
        `, [id])
        return res.status(200).json({
            receivedRequests: result1.rows.map((item) => {
                return {
                    id: item.id,
                    name: item.name,
                    phoneNumber: item.phonenumber,
                    profilePic: item.profilepic,
                    createdAt: item.createdat,
                    content: item.content
                }
            }),
            sentRequests: result2.rows.map((item) => {
                return {
                    id: item.id,
                    name: item.name,
                    phoneNumber: item.phonenumber,
                    profilePic: item.profilepic,
                    createdAt: item.createdat,
                    content: item.content
                }
            })
        })
    } catch (e) {
        next(e);
    }
}

/**
 * Accept/Reject/Withdraw a friend request
 * @route DELETE /api/invitation/friend/:id
 */
export const DeleteInvitation = async (req, res, next) => {
    try {
        const userId = req.params.id;
        const { friendId, action } = req.body;

        if (!userId || !friendId) {
            return res.status(400).json("missing required value")
        }

        const myInfo = await database.query(`
            SELECT profilepic, name, address, email, phonenumber, birthday
            FROM users
            WHERE id=$1
        `, [userId])
        const { name, address, email, profilepic, phonenumber, birthday } = myInfo.rows[0];
        
        if (action === "reject") {
                
            await RealTimeFriendRequest.RejectRequest(
                userId,
                {
                    senderId: userId,
                    receiverId: friendId
                }
            )              
        } else if (action === "accept") {
            if (myInfo.rows[0]) {
                
                await RealTimeFriendRequest.AcceptRequest(userId,{
                        name: name,
                    })

                await RealTimeFriend.NewFriend(userId,
                    {
                        id: userId,
                        name: name,
                        address: address,
                        email: email,
                        profilePic: profilepic,
                        phonenumber: phonenumber,
                        birthday: birthday,
                    })
                }
                
            }
        

        await database.query(`
            DELETE 
            FROM userconnects
            WHERE userid=$1 AND friendid=$2
            AND isvalid=FALSE
            `, [userId, friendId])

        return res.status(200).json("delete successfully")
    } catch (e) {
        next(e);
    }
}

