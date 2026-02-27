import express from "express";
import {
    SignUp,
    Login,
    Logout,
} from "../controller/auth/authenticate.js";
import {
    SendOTPEmail,
    VerifyOTP,
} from "../controller/auth/otp.js";
import {
    GetUserInfo,
    UpdateUserInfo,
    UpdateUserAvatar,
    UpdateUserPassword,
} from "../controller/user/profile.js";
import {
    GetAllFriend,
    DeleteFriend,
    createUserConnect,
} from "../controller/user/friends.js";
import { findUsers } from "../controller/user/search.js";
import { DeleteUser } from "../controller/user/delete.js";
import { verifyJWT } from "../middleware/verifyJWT.js";

const userRoutes = express.Router();

// ============ AUTHENTICATION ROUTES ============
userRoutes.post('/signup', SignUp);           // User registration
userRoutes.post('/login', Login);             // User login
userRoutes.post('/logout', Logout);           // User logout
userRoutes.post('/otp/send', SendOTPEmail);   // Send OTP email
userRoutes.post('/otp/verify', VerifyOTP);    // Verify OTP

// ============ USER PROFILE ROUTES ============
userRoutes.get('/:id', verifyJWT, GetUserInfo);              // Get user info
userRoutes.put('/profile/:id', verifyJWT, UpdateUserInfo);   // Update user profile
userRoutes.put('/avatar/:id', verifyJWT, UpdateUserAvatar);  // Update user avatar
userRoutes.put('/password', verifyJWT, UpdateUserPassword);  // Update password

// ============ FRIEND ROUTES ============
userRoutes.get('/friends/:id', verifyJWT, GetAllFriend);     // Get all friends
userRoutes.post('/friends/add/:id', verifyJWT, createUserConnect);  // Add friend (send request)
userRoutes.delete('/friends/:id', verifyJWT, DeleteFriend);  // Remove friend

// ============ SEARCH ROUTES ============
userRoutes.post('/search', findUsers);  // Search for users

// ============ ACCOUNT ROUTES ============
userRoutes.get('/groups/:id', verifyJWT, GetAllFriend);  // Get user groups (keeping for backward compatibility)
userRoutes.delete('/account/:id', verifyJWT, DeleteUser); // Delete user account

export default userRoutes;