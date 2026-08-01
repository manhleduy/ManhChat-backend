import "./instrument.js";
import * as Sentry from "@sentry/node";
import express from "express";
import dotenv from "dotenv";
import cookieParser from "cookie-parser";
import cors from "cors";
import setupRoutes from "./route/index.js";
import { app, server } from "./config/socket.js";
import { connectToRedis, connectToRedisSubscriber } from "./config/redis.js";
import redis from "./config/redis.js";

dotenv.config();

const PORT = 8085;

const boot = async () => {
  // 1. Connect both Redis clients before accepting any connections.
  //    connectToRedisSubscriber must be ready before the first socket connect
  //    triggers subscribeUserChannel.
  await connectToRedis();
  await connectToRedisSubscriber();

  // 2. Express middleware
  app.use(express.json({ limit: "20mb" }));
  app.use(cookieParser());
  app.use(cors({
    origin: "http://localhost:5173",
    credentials: true
  }));

  // 3. Routes
  setupRoutes(app);
  Sentry.setupExpressErrorHandler(app);

  // 4. Test / debug routes (kept from original)
  app.get("/testing", async (req, res) => {
    try {
      const { senderId, receiverId, content } = req.body;
      const streamPath = `friendChat:${senderId}<=>${receiverId}`;
      const redisId = await redis.xAdd(streamPath, "*", content);
      return res.status(200).json(redisId);
    } catch (e) {
      console.log(e);
      return res.status(500).json("server error");
    }
  });

  app.post("/testing", async (req, res) => {
    try {
      const { senderId, receiverId } = req.body;
      const streamPath = `friendChat:${senderId}<=>${receiverId}`;
      const redisInstance = await redis.xRange(streamPath, "-", "+");
      return res.status(200).json(redisInstance);
    } catch (e) {
      console.log(e);
      return res.status(500).json("server error");
    }
  });

  app.delete("/testing", async (req, res) => {
    try {
      const { senderId, receiverId } = req.body;
      const streamPath = `friendChat:${senderId}<=>${receiverId}`;
      await redis.xDel(streamPath);
      return res.status(200).json("deleted");
    } catch (e) {
      console.log(e);
      return res.status(500).json("server error");
    }
  });

  // 5. Start HTTP + Socket.io server
  server.listen(PORT, () => {
    console.log(`server is running on port ${PORT}`);
  });
};

boot().catch((err) => {
  console.error("Fatal boot error:", err);
  process.exit(1);
});
