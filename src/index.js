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
import { streamPath } from "./controller/redis/stream/friendMessage.js";
import redis from "./config/redis.js";
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

app.get("/testing", async(req, res)=>{
    try{
        const {senderId, receiverId, content}= req.body;
        const streamPath = `friendChat:${senderId}<=>${receiverId}`;
        const redisId=await redis.xAdd(streamPath,"*", content);
        
        return res.status(200).json(redisId);
    }catch(e){
        console.log(e);
        return res.status(500).json("server error");
    }
})

app.post("/testing", async(req, res)=>{
    try{    
        const {senderId, receiverId, content}= req.body;
        const streamPath = `friendChat:${senderId}<=>${receiverId}`;
        const redisInstance= await redis.xRange(streamPath, "-", "+");
        return res.status(200).json(redisInstance);
    }catch(e){
        console.log(e);
        return res.status(500).json("server errror");
    }
})
app.delete("/testing", async(req, res)=>{
    try{
        const {senderId, receiverId, content}= req.body;
        const streamPath = `friendChat:${senderId}<=>${receiverId}`;
        const redisDelete= await redis.xDel(streamPath, )
    }catch(e){
        console.log(e);
        return res.status(500).json("server error");
    }
})


server.listen(PORT, () => {
    console.log(`server is running on port ${PORT}`);
});


