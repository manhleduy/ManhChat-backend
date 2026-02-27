import express from "express";
import {
    CreateChat,
    GetAllChat,
    LikeChat,
    RecallChat,
} from "../controller/chat/privateChat.js";
import {
    handleIsRead,
    MarkAsRead
} from "../controller/chat/privateChatRead.js";
import {
    CreateGroupChat,
    GetAllGroupChat,
    LikeGroupChat,
    RecallGroupChat,
} from "../controller/chat/groupChat.js";

const chatRoutes = express.Router();

// ============ PRIVATE CHAT ROUTES ============
chatRoutes.post('/create/:id', CreateChat);           // Create a new private chat message
chatRoutes.post('/:id', GetAllChat);                  // Get all private chats between users
chatRoutes.put('/like/:id', LikeChat);                // Like a private chat message
chatRoutes.delete('/recall/:id', RecallChat);         // Recall (delete) a private chat message

// ============ PRIVATE CHAT READ STATUS ROUTES ============
chatRoutes.put('/read/:id', handleIsRead);            // Mark single chat as read
chatRoutes.put('/read', MarkAsRead);                  // Mark chats with user as read

// ============ GROUP CHAT ROUTES ============
chatRoutes.post('/group/create/:id', CreateGroupChat);     // Create a new group chat message
chatRoutes.post('/group/:id', GetAllGroupChat);            // Get all group chat messages
chatRoutes.put('/group/like/:id', LikeGroupChat);          // Like a group chat message
chatRoutes.delete('/group/recall/:id', RecallGroupChat);   // Recall (delete) a group chat message

export default chatRoutes;
