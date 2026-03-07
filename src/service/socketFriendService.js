
import { getReceiverSocketId } from "./socketReceiverConfig.js"
import { io } from "../config/socket.js";
class RealTimeFriend{
    UnFriend = async (friendId, data) => {
        if (!friendId) {
            console.log("can't emit the unfriend event: missing friendId");
            return;
        }
        const friendSocketId = await getReceiverSocketId(friendId.toString());
        if (friendSocketId) {
            io.to(friendSocketId).emit("unfriend", data);
        }
        return;
    }
    NewFriend = async(friendId, data)=>{
        if(!friendId){
            console.log("can't emit the new friend event: missing friendId");
            return;
        }
        const friendSocketId= await getReceiverSocketId(friendId.toString());
        if(friendSocketId){
            io.to(friendSocketId).emit("newFriend", data);
        }
        return;
    }

}
export default new RealTimeFriend();