import { database } from "../../config/db.js";
import { getSenderSocketId } from "../../service/socketChatService.js";
import { io } from "../../config/socket.js";

/**
 * Send a group join request
 * @route POST /api/invitation/group/create/:id
 */
export const SendGroupProposal = async (req, res, next) => {
    try {
        const userId = req.params.id;
        const { adminName, content, groupId } = req.body;
        const createdAt = new Date()
        if (!userId || !adminName || !groupId) {
            return res.status(400).json("missing required value")
        }
        const data = await database.query(`
            SELECT u.id AS admindid, g.isrestricted, u.profilepic
            FROM users u
            INNER JOIN groups g
            ON u.id= g.adminid
            WHERE u.name=$1 AND g.id=$2`,
            [adminName, groupId])

        const adminId = data.rows[0].admindid;
        const profilePic = data.rows[0].profilepic;
        const isRestricted = data.rows[0].isrestricted;

        const connectedAdmin =await getSenderSocketId(`user:${adminId.toString()}:online`);

        if (connectedAdmin && isRestricted) {
            io.to(connectedAdmin.toString()).emit("receiveGroupRequest", {
                content: content,
                createdAt: createdAt,
                profilePic: profilePic,
                name: adminName,
                groupId: groupId,
                adminId: adminId,
                id: parseInt(userId)
            });
        }

        await database.query(`
            INSERT INTO
            groupconnects(memberid, adminid, groupid, content, createdat, isvalid)
            VALUES ($1,$2,$3,$4,$5,$6)`,
            [userId, adminId, groupId, content, createdAt, !isRestricted])

        return res.status(201).json("successfully")
    } catch (e) {
        next(e);
    }
}

/**
 * Get all group requests (sent and received)
 * @route GET /api/invitation/group/:id
 */
export const GetAllGroupRequest = async (req, res, next) => {
    try {
        const userId = req.params.id;
        if (!userId) {
            return res.status(400).json("missing required value");
        }
        const result1 = await database.query(`
            SELECT b.groupname, b.id AS groupid , a.createdat,
            a.content , b.detail, a.adminid, a.id
            FROM (
                SELECT u.id, g.groupid , g.createdat, g.content, g.adminid
                FROM groupconnects g
                INNER JOIN users u
                ON g.memberid= u.id
                WHERE g.adminid=$1 AND g.isvalid=FALSE 
            ) AS a
            INNER JOIN groups b
            ON a.groupid= b.id
            `, [userId])
        const result2 = await database.query(`
            SELECT b.groupname, b.id AS groupid ,a.createdat,
            a.content , b.detail, a.adminid, a.id
            FROM (
                SELECT u.id, g.groupid, g.createdat, g.content, g.adminid
                FROM groupconnects g
                INNER JOIN users u
                ON g.memberid= u.id
                WHERE g.memberid=$1 AND g.isvalid=FALSE 
            ) AS a
            INNER JOIN groups b
            ON a.groupid= b.id
            `, [userId])
        return res.status(200).json({
            receivedRequests: result1.rows.map((item) => {
                return {
                    id: item.id,
                    name: item.groupname,
                    detail: item.detail,
                    content: item.content,
                    createdAt: item.createdat,
                    adminId: item.adminid,
                    groupId: item.groupid
                }
            }),
            sentRequests: result2.rows.map((item) => {
                return {
                    id: item.id,
                    name: item.groupname,
                    detail: item.detail,
                    content: item.content,
                    createdAt: item.createdat,
                    adminId: item.adminid,
                    groupId: item.groupid
                }
            })
        })
    } catch (e) {
        next(e);
    }
}

/**
 * Accept/Reject a group request
 * @route DELETE /api/invitation/group/:id
 */
export const DeleteGroupInvitation = async (req, res, next) => {
    try {
        const memberId = req.params.id;
        const { groupId, adminId, action } = req.body;
        if (!memberId || !groupId || !adminId) {
            return res.status(400).json("missing required value")
        }

        if (memberId) {
            const connectedUser =await getSenderSocketId(`user:${memberId.toString()}:online`);
            if (connectedUser) {
                if (action === "reject") {
                    io.to(connectedUser).emit("rejectGroupRequest", {
                        groupId: groupId,
                        adminId: adminId
                    })
                } else if (action === "accept") {
                    io.to(connectedUser).emit("acceptGroupRequest", {
                        groupId: groupId,
                        adminId: adminId
                    })
                }
            }
        }

        await database.query(`
            DELETE 
            FROM groupconnects
            WHERE memberid= $1 AND groupid=$2 AND adminid=$3
            AND isvalid=FALSE
            `, [memberId, groupId, adminId]
        )
        return res.status(200).json("delete successfully")
    } catch (e) {
        next(e);
    }
}
