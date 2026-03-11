import { database } from "../../config/db.js";
import { io } from "../../config/socket.js";
import RealTimeGroupManage from "../../service/socketGroupMember.js"
/**
 * Admin kick a member from group
 * @route DELETE /api/group/admin/kick/:id
 */
export const kickMember = async (req, res, next) => {
    try {
        const adminId = req.params.id;
        const { memberId, groupId } = req.body;

        // Get member name for announcement
        const user = await database.query(`
            SELECT name
            FROM users
            WHERE id=$1
        `, [memberId]);

        const memberName = user.rows[0]?.name || "A member";

        await RealTimeGroupManage.KickMember(memberId, {
            memberId: memberId,
            adminId: adminId,
            groupId: groupId,
            memberName: memberName
        })

       

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
