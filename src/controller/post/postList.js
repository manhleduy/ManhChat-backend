import { database } from "../../config/db.js";

/**
 * Get all posts for a user
 * @route GET /api/post/:id
 */
export const getAllPost = async (req, res) => {
    try {
        const senderId = req.params.id
        if (!senderId) {
            return res.status(400).json("have you sign up yet")
        }
        const result = await database.query(`
            SELECT p.id, p.content, p.file, p.createdat, p.likenumber, u.name, u.profilepic, p.senderid
            FROM posts p
            INNER JOIN users u
            ON p.senderid= u.id
            WHERE u.id= $1
            `, [senderId])
        return res.status(200).json(result.rows.map((item) => {
            return {
                postId: item.id,
                content: item.content,
                image: item.file,
                createdAt: item.createdat,
                likeNum: item.likenumber,
                name: item.name,
                profilePic: item.profilepic,
                userId: item.senderid
            }
        })
        )
    } catch (e) {
        console.log(e);
        return res.status(500).json("server error")
    }
}

/**
 * Get all posts from user's friends
 * @route GET /api/post/friends/:id
 */
export const getAllFriendPost = async (req, res) => {
    try {
        const userId = req.params.id;
        if (!userId) {
            return res.status(400).json("have you sign up yet")
        }
        const result = await database.query(
            `
                SELECT friendposts.profilepic, friendposts.name,
                friendposts.id AS postid, friendposts.createdat,
                friendposts.content, friendposts.file, friendposts.likenumber,
                friendposts.senderid
                FROM  
                (
                    SELECT a.friendid
                    FROM userconnects a
                    INNER JOIN users b
                    ON b.id = a.userid
                    WHERE b.id = $1 AND isvalid=TRUE
                ) AS friends
                INNER JOIN
                (
                    SELECT c.profilepic, c.name, d.id, d.createdat,
                    d.likenumber, d.content, d.file, d.senderid
                    FROM users c
                    INNER JOIN posts d
                    ON c.id= d.senderid 
                ) AS friendposts
                ON friends.friendid = friendposts.senderid
            `, [userId])

        return res.status(200).json(
            result.rows.map(item => {
                return {
                    postId: item.postid,
                    userId: item.senderid,
                    content: item.content,
                    image: item.file,
                    createdAt: item.createdat,
                    likeNum: item.likenumber,
                    name: item.name,
                    profilePic: item.profilepic
                }
            })
        )
    } catch (e) {
        console.log(e);
        return res.status(500).json("server error");
    }
}
