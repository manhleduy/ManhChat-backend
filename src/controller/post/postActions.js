import { database } from "../../config/db.js";
import cloudinary from "../../config/cloundinary.js";

/**
 * Create a new post
 * @route POST /api/post/create/:id
 */
export const createPost = async (req, res, next) => {
    try {
        const senderId = req.params.id;
        const { content, file } = req.body

        if (!senderId || !content) {
            return res.status(400).json("missing required value")
        }
        const uploadResponse = await cloudinary.uploader.upload(file);

        const createdAt = new Date()

        await database.query(`
            INSERT INTO posts
            (senderid, content, likenumber, file, createdat )
            VALUES ($1, $2, 0, $3, $4)
            `, [senderId, content, uploadResponse.secure_url, createdAt])
        return res.status(201).json("post successfully");
    } catch (e) {
        next(e);
    }
}

/**
 * Delete a post
 * @route DELETE /api/post/:id
 */
export const deletePost = async (req, res, next) => {
    try {
        const  postId  = req.params.id;
        if (!postId || postId <= 0) {
            return res.status(400).json("this post with value is not exist")
        }
        await database.query(`
            DELETE FROM posts
            WHERE id=$1 
            `, [postId])
        return res.status(200).json("you have delete this post")
    } catch (e) {
        next(e);
    }
}

/**
 * Like a post
 * @route PUT /api/post/:id
 */
export const likePost = async (req, res, next) => {
    try {
        const postId = req.params.id;
        if (!postId) return res.status(400).json("missing id");
        await database.query(`
            UPDATE posts 
            SET likenumber=likenumber+1
            WHERE id=$1 
            `, [postId]);
        return res.status(200).json("successful");
    } catch (e) {
        next(e);
    }
}
