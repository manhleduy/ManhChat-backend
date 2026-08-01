import { Server } from "socket.io";
import http from "http";
import express from "express";
import { refreshOnlineUser, addOnlineUser, getAllOnlineUsers, removeOnlineUser } from "../controller/redis/onlineUser.js";
import {
  initChatSubscriber,
  subscribeUserChannel,
  unsubscribeUserChannel,
  subscribeGroupChannel,
  unsubscribeGroupChannelsForSocket,
} from "../service/chatPubSubSubscriber.js";

export const app    = express();
export const server = http.createServer(app);

export const io = new Server(server, {
  cors: {
    origin: "http://localhost:5173",
  }
});

const MapRedisKeyToUserId = (redisKey) => {
  return parseInt(redisKey.split(":")[1]);
};

// Initialise the Pub/Sub subscriber once — must happen before any socket connects
// so the Redis message handler is registered before the first subscription is issued.
initChatSubscriber(io);

io.on("connection", async (socket) => {
  const userId = socket.handshake.query.userId;

  // Online presence
  addOnlineUser(userId, socket.id);

  // Subscribe to this user's private chat channel
  await subscribeUserChannel(userId, socket.id);

  const interval = setInterval(async () => {
    await refreshOnlineUser(userId);
  }, 30000);

  const onlineUsers = await getAllOnlineUsers();
  socket.emit("getAllOnlineUsers", onlineUsers.map(element => MapRedisKeyToUserId(element)));
  io.emit("getOnlineUsers", parseInt(userId));

  // Join Socket.io rooms for each group and subscribe to their Pub/Sub channels
  socket.on("joinGroup", (data) => {
    if (data.length === 0) return;
    data.forEach(item => {
      socket.join(item.groupId.toString());
      subscribeGroupChannel(item.groupId, socket.id);
    });
  });

  // Handle disconnect
  socket.on("disconnect", async () => {
    clearInterval(interval);
    await removeOnlineUser(userId);
    io.emit("getOfflineUsers", parseInt(userId));

    // Unsubscribe from Pub/Sub channels for this socket
    await unsubscribeUserChannel(userId, socket.id);
    await unsubscribeGroupChannelsForSocket(socket.id);
  });
});
