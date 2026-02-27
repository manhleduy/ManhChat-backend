import express from "express";
import { getAllPost, getAllFriendPost } from "../controller/post/postList.js";
import { createPost, deletePost, likePost } from "../controller/post/postActions.js";

const postRoutes = express.Router();

// Post management routes
postRoutes.post('/create/:id', createPost);         // Create a new post
postRoutes.get('/:id', getAllPost);             // Get all posts for user
postRoutes.get('/friends/:id', getAllFriendPost); // Get posts from friends
postRoutes.delete("/:id", deletePost);
postRoutes.put('/:id', likePost);

export default postRoutes;
