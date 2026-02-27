import { Server } from "socket.io";
import http from "http"
import express from 'express'
import { refreshOnlineUser, addOnlineUser, getAllOnlineUsers, removeOnlineUser } from "../controller/redis/onlineUser.js";

export const app= express();
export const server= http.createServer(app)

export const io= new Server(server, {
    cors:{
        origin: "http://localhost:5173",
    }
    
})

const MapRedisKeyToUserId= (redisKey)=>{
  return parseInt(redisKey.split(":")[1]);
}


io.on("connection",async (socket) => {
  //data
  const userId= socket.handshake.query.userId;

  //online user handle
  addOnlineUser(userId, socket.id);

  const interval = setInterval(async () => {
    await refreshOnlineUser(userId);
  }, 30000);

  const onlineUsers= await getAllOnlineUsers();
  
  socket.emit("getAllOnlineUsers",onlineUsers.map(element=>MapRedisKeyToUserId(element)) );
  io.emit("getOnlineUsers", parseInt(userId));

  //join group
  socket.on("joinGroup", (data)=>{
    if(data.length===0)return;
    data.forEach(item => {
      socket.join(item.groupId.toString())
    });
  })
  
  //handle disconnect event
  socket.on("disconnect",async () => {
    clearInterval(interval); 
    await removeOnlineUser(userId);
    io.emit("getOfflineUsers", parseInt(userId));
    
  });
});
