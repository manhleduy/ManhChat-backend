import { getReceiverSocketId } from "./socketReceiverConfig.js"
import { io } from "../config/socket.js";

class RealTimeRequest{
    SendRequest=async(receiverId, data)=>{
        if(!receiverId){
          console.log("can emit the socket event: missing required value");
          return;
        }
        const friendSocketId= await getReceiverSocketId(receiverId.toString());
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
        const friendSocketId= await getReceiverSocketId(receiverId.toString());
        if(friendSocketId){
          io.to(friendSocketId).emit("rejectFriendRequest", data);
        }
        return;
    }
    AcceptRequest= async(receiverId)=>{
        if(!receiverId){
          console.log("can emit the accept event: missing receiverId");
          return;
        }
        const friendSocketId= await getReceiverSocketId(receiverId.toString());
        if(friendSocketId){
          io.to(friendSocketId).emit("acceptFriendRequest");
        }
        return;
    }

    SendGroupRequest= async(adminId, data)=>{
        if(!adminId){
            console.log("can emit the socket event: missing required value");
            return;
        }
        const adminSocketId=await  getReceiverSocketId(adminId.toString());
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
        const memeberSocketId= await getReceiverSocketId(memeberId.toString());
        if(memeberSocketId){
            io.to(memeberSocketId).emit("rejectGroupRequest", data);
        }
    }
    AcceptGroupRequest= async(memberId, data)=>{
        if(!memberId){
            console.log("can emit the accept event: missing memberId");
            return;
        }
        const memeberSocketId= await getReceiverSocketId(memberId.toString());
        if(memeberSocketId){
            io.to(memeberSocketId).emit("acceptGroupRequest", data);
        }
        return;
    }

}
export default new RealTimeRequest();