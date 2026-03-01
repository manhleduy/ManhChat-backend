import { database } from "../../config/db.js";
import { getSenderSocketId } from "../redis/onlineUser.js";
import { io } from "../../config/socket.js";

/**
 * Admin kick a member from group
 * @route DELETE /api/group/admin/kick/:id
 */
export const kickMember = async (req, res, next) => {
    try {
        const adminId = req.params.id;
        const { memberId, groupId } = req.body;
        const connectedUser =await getSenderSocketId(`user:${memberId.toString()}:online`);
        if (connectedUser) {
            io.to(connectedUser).emit("kickMember", {
                memberId: memberId,
                adminId: adminId,
                groupId: groupId
            })
        }

        await database.query(
            `DELETE FROM groupconnects
            WHERE adminid=$1 AND memberid= $2 AND groupid=$3
            `,
            [adminId, memberId, groupId]
        )
        return res.status(200).json("delete successfully");
    } catch (e) {
        next(e);
    }
}
