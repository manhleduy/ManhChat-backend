import "./instrument.js"
import * as Sentry from "@sentry/node";
import * as Tracing from "@sentry/tracing";
import express from "express";
import dotenv from "dotenv";
import cookieParser from "cookie-parser";
import cors from "cors";
import setupRoutes from "./route/index.js";
import {v2 as cloudinary} from "cloudinary";
import {io, app, server} from "./config/socket.js";

const PORT = 8085;
dotenv.config();

app.use(express.json({limit: "20mb"}));
app.use(cookieParser());

app.use(cors({
    origin: "http://localhost:5173",
    credentials: true
}));



// Setup all routes
setupRoutes(app);

Sentry.setupExpressErrorHandler(app);



server.listen(PORT, () => {
    console.log(`server is running on port ${PORT}`);
});


