import { database } from "../../config/db.js";

/**
 * Search for groups
 * @route POST /api/group/search
 */
export const findGroups = async (req, res, next) => {
    try {
        const { groupName, groupId, adminName } = req.body;
        if (!groupName && !groupId && !adminName) {
            return res.status(400).json("missing required value")
        }
        const result = await database.query(
            `
            SELECT u.id AS adminid, g.id AS id, g.detail,
            g.groupname, g.createdat, g.isrestricted,
            u.name AS adminname
            FROM groups g
            INNER JOIN users u
            ON g.adminid= u.id
            WHERE 
            (
            u.name LIKE '%' || $1 || '%' 
            OR g.id= $3
            ) AND(
            g.groupname LIKE '%' || $2 || '%' 
            OR g.id= $3
            )

            `,
            [adminName, groupName, groupId]
        )
        return res.status(200).json({
            message: "successfully",
            groups: result.rows.map(item => {
                return {
                    id: item.id,
                    adminId: item.adminid,
                    adminName: item.adminname,
                    groupName: item.groupname,
                    detail: item.detail,
                    createdAt: item.createdat,
                    isRestricted: item.isrestricted
                }
            })
        })
    } catch (e) {
        next(e);
    }
}
