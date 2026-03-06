import {io} from "../config/socket.js"
import redis from "../config/redis.js";

export const getSenderSocketId = async (id) => {
    return await redis.get(`user:${id}:online`);
  };


class RealTimeChat{
  //FRIEND CHAT
  SendChatToFriend=async(receiverId, data)=>{
    if(!receiverId){
      console.log("can emit the socket event: missing required value");
    }
    const friendSocketId= await getSenderSocketId(receiverId.toString());
    if(friendSocketId){
      io.to(friendSocketId).emit("receiveMessage", data);
    }
    return;

  }
  LikeFriendMessage= async(receiverId, data)=>{
    if(!receiverId){
      console.log("can emit the like event: missing receiverId");
    }
    const friendSocketId= await getSenderSocketId(receiverId.toString());
    if(friendSocketId){
      io.to(friendSocketId).emit("likeMessage", data);
    }
    return;
  }
  RecallMessage = async(receiverId, data)=>{
    if(!receiverId){
      console.log("can emit the recall event: missing receiverId");
    }
    const friendSocketId= await getSenderSocketId(receiverId.toString());
    if(friendSocketId){
      io.to(friendSocketId).emit("recallMessage", data);
    }
    return;
  }

  //GROUP CHAT
  SendChatToGroup=(groupId, data)=>{
      if(!groupId){
        console.log("can emit the socket event: missing required value");
      }
      io.to(groupId.toString()).emit("receiveGroupMessage", data);
      return
  }
  LikeGroupMessage= (groupId, data)=>{
    if(!groupId){
      console.log("can emit the like event: missing groupId");
    }
    io.to(groupId.toString()).emit("likeGroupMessage", data);
    return
  }
  RecallGroupMessage= async(groupId, data)=>{
    if(!groupId){
      console.log("can emit the recall event: missing groupId");
    }
    io.to(groupId.toString()).emit("recallGroupMessage", data);
    return
  }
}

export default new RealTimeChat();

