import userRoutes from './userRoutes.js';
import chatRoutes from './chatRoutes.js';
import groupRoutes from './groupRoutes.js';
import invitationRoutes from './invitationRoutes.js';
import postRoutes from './postRoutes.js';
import { verifyJWT } from '../middleware/verifyJWT.js';
import rateLimit from 'express-rate-limit';
import handleServerErrors from '../controller/serverErrorHandle.js';

/**
 * @param {express.Application} app - 
 */
const limiter= rateLimit({
    max:100,
    windowMs: 60*1000,
    message: "Too many request try again in one hour"
})
const setupRoutes = (app) => {
    
    app.use('/api/user', userRoutes, handleServerErrors);

    app.use('/api/chat',chatRoutes, handleServerErrors);

    app.use('/api/group', groupRoutes, handleServerErrors);

    // Invitation-related routes
    app.use('/api/invitation', invitationRoutes, handleServerErrors);

    // Post-related routes
    app.use('/api/post', postRoutes, handleServerErrors);
};

export default setupRoutes;