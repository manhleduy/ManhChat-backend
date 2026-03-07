import { io } from "../config/socket.js";
import { getReceiverSocketId } from "./socketReceiverConfig.js";

class RealTimeGroupMember{
    socketEvent= ["kickMember", "userLeaverGroup", "newUserJoined"];
    KickMember = async (memberId, data) => {
        if (!memberId) {
            console.log("can emit the kick event: missing memberId");
            return;
        }
        const memberSocketId = await getReceiverSocketId(memberId.toString());
        if (memberSocketId) {
            io.to(memberSocketId).emit("kickMember", data);
        }
        return;
    }

    LeaveGroup =async(groupId, data)=>{
        if(!groupId){
            console.log("can't emit the leave group event, missing groupId");
            
        }
        io.to(groupId.toString()).emit("userLeaverGroup", data);
        return;
    }
    JoinGroup= async(groupId, data)=>{
        if(!groupId){
            console.log("can't emit the join group evnet: missing required value");
        }
        io.to(groupId.toString()).emit("newUserJoined", data);
        return;
    }


}
export default new RealTimeGroupMember();