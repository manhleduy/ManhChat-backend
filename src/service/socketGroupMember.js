import { io } from "../config/socket.js";
import { getReceiverSocketId } from "./socketReceiverConfig.js";

class RealTimeGroupMember{
    socketEvent= ["kickMember", "userLeaveGroup", "newGroupMember"];
    KickMember = async (memberId, data) => {
        if (!memberId) {
            console.log("can emit the kick event: missing memberId");
            return;
        }
        const memberSocketId = await getReceiverSocketId(memberId.toString());
        if (memberSocketId) {
            io.to(memberSocketId).emit("kickMember", data);
        }
        // Announce to group members that user left
        if (data.groupId) {
            io.to(data.groupId.toString()).emit("userLeaveGroup", {
                memberId: memberId,
                groupId: data.groupId,
                memberName: data.memberName || "A member"
            });
        }
        return;
    }

    LeaveGroup =async(groupId, data)=>{
        if(!groupId){
            console.log("can't emit the leave group event, missing groupId");
            return;
        }
        io.to(groupId.toString()).emit("userLeaveGroup", data);
        return;
    }
    JoinGroup= async(groupId, data)=>{
        if(!groupId){
            console.log("can't emit the join group event: missing required value");
            return;
        }
        io.to(groupId.toString()).emit("newGroupMember", data);
        return;
    }


}
export default new RealTimeGroupMember();