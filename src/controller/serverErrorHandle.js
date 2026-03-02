import { app } from "../config/socket.js";

/**
 * Global error handler middleware for catching unhandled errors from route handlers
 * Logs errors to Sentry and returns appropriate JSON response
 * @param {Error} err - The error object
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next function
 */
const handleServerErrors = (err, req, res, next) => {
    const statusCode = 500;
    
    // Log error to console for debugging
    console.error('Server Error:', err);
    
    // The error will be captured by Sentry through the instrument.js
    // No need to manually call Sentry here, it's handled by the instrumentation
    
    return res.status(statusCode).json("An unexpected server error occurred. Please try again later.");
}

export default handleServerErrors;