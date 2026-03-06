import { getSenderSocketId } from "./socketChatService.js"
import { io } from "../config/socket.js";
class RealTimeRequest{
    SendRequest=async(receiverId, data)=>{
        if(!receiverId){
          console.log("can emit the socket event: missing required value");
          return;
        }
        const friendSocketId= await getSenderSocketId(receiverId.toString());
        if(friendSocketId){
          io.to(friendSocketId).emit("receiveFriendRequest", data);
        }
        return;

    }
    RejectRequest= async(receiverId, data)=>{
        if(!receiverId){
          console.log("can emit the reject event: missing receiverId");
          return;
        }
        const friendSocketId= await getSenderSocketId(receiverId.toString());
        if(friendSocketId){
          io.to(friendSocketId).emit("rejectFriendRequest", data);
        }
        return;
    }
    AcceptRequest= async(receiverId, data)=>{
        if(!receiverId){
          console.log("can emit the accept event: missing receiverId");
          return;
        }
        const friendSocketId= await getSenderSocketId(receiverId.toString());
        if(friendSocketId){
          io.to(friendSocketId).emit("acceptFriendRequest", data);
        }
        return;
    }

    SendGroupRequest= async(adminId, data)=>{
        if(!adminId){
            console.log("can emit the socket event: missing required value");
            return;
        }
        const adminSocketId=await  getSenderSocketId(adminId.toString());
        if(adminSocketId){
          io.to(adminSocketId).emit("receiveGroupRequest", data);
        }
        return;
    }
    RejectGroupRequest= async(memeberId, data)=>{
        if(!memeberId){
            console.log("can emit the reject event: missing memeberId");
            return;
        }
        const memeberSocketId= await getSenderSocketId(memeberId.toString());
        if(memeberSocketId){
            io.to(memeberSocketId).emit("rejectGroupRequest", data);
        }
    }
    AcceptGroupRequest= async(memberId, data)=>{
        if(!memberId){
            console.log("can emit the accept event: missing memberId");
            return;
        }
        const memeberSocketId= await getSenderSocketId(memberId.toString());
        if(memeberSocketId){
            io.to(memeberSocketId).emit("acceptGroupRequest", data);
        }
        return;
    }

}
export default new RealTimeRequest();