import express from "express";
import {
    createGroup,
    getGroupInfo,
    updateGroup,
    deleteGroup,
} from "../controller/group/group.js";
import {
    createGroupConnect,
    deleteGroupConnect,
    getAllGroup,
} from "../controller/group/members.js";
import { findGroups } from "../controller/group/search.js";
import { kickMember } from "../controller/group/admin.js";

const groupRoutes = express.Router();

// ============ GROUP BASIC ROUTES ============
groupRoutes.post('/create', createGroup);             // Create a new group
groupRoutes.get('/info/:id', getGroupInfo);           // Get group information and members
groupRoutes.put('/update/:id', updateGroup);          // Update group details
groupRoutes.delete('/:id', deleteGroup);              // Delete group

// ============ GROUP MEMBER ROUTES ============
groupRoutes.get('/:id', getAllGroup);                 // Get all groups for a user
groupRoutes.post('/members/add/:id', createGroupConnect);     // Add member to group
groupRoutes.delete('/members/:id', deleteGroupConnect);       // Remove member from group

// ============ GROUP SEARCH & ADMIN ROUTES ============
groupRoutes.post('/search', findGroups);              // Search for groups
groupRoutes.delete('/admin/kick/:id', kickMember);    // Admin kick member from group

export default groupRoutes;
