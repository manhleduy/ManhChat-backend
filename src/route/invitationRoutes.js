import express from "express";
import {
    SendInvitation,
    GetAllRequest,
    DeleteInvitation,
} from "../controller/invitation/friendInvitation.js";
import {
    SendGroupProposal,
    GetAllGroupRequest,
    DeleteGroupInvitation,
} from "../controller/invitation/groupInvitation.js";

const invitationRoutes = express.Router();

// ============ FRIEND INVITATION ROUTES ============
invitationRoutes.post('/create/:id', SendInvitation);    // Send friend request
invitationRoutes.get('/:id', GetAllRequest);             // Get friend requests (sent & received)
invitationRoutes.delete('/:id', DeleteInvitation);       // Accept/Reject/Withdraw friend request

// ============ GROUP INVITATION ROUTES ============
invitationRoutes.post('/group/create/:id', SendGroupProposal);      // Send group join request
invitationRoutes.get('/group/:id', GetAllGroupRequest);             // Get group requests (sent & received)
invitationRoutes.delete('/group/:id', DeleteGroupInvitation);       // Accept/Reject group request

export default invitationRoutes;
