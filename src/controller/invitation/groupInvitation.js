import { database } from "../../config/db.js";
import { io } from "../../config/socket.js";
import RealTimeGroupRequest from "../../service/requestService.js"
import RealTimeGroupMember from "../../service/socketGroupMember.js"
import { invalidateGroupListCache } from "../redis/userGroup.js";
import { invalidateAdminGroupMembersCache } from "../redis/group/admin.js";
import { invalidateMemberGroupMembersForUsers } from "../redis/group/member.js";
import { getReceiverSocketId } from "../../service/socketReceiverConfig.js";

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

        if (isRestricted) {
            await RealTimeGroupRequest.SendGroupRequest(
                    adminId,
                    {
                        content: content,
                        createdAt: createdAt,
                        profilePic: profilePic,
                        name: adminName,
                        groupId: groupId,
                        adminId: adminId,
                        id: parseInt(userId)
                    })
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

        

        await database.query(`
            DELETE 
            FROM groupconnects
            WHERE memberid= $1 AND groupid=$2 AND adminid=$3
            AND isvalid=FALSE
            `, [memberId, groupId, adminId]
        )

        if (memberId) {
        
                if (action === "reject") {
                    await RealTimeGroupRequest.RejectGroupRequest(memberId,
                        {
                            groupId: groupId,
                            adminId: adminId
                        }
                    )
                } else if(action === "accept") {
                    await RealTimeGroupRequest.AcceptGroupRequest(memberId, 
                        {
                            groupId:groupId,
                            adminId: adminId
                        }
                    )
                    // Add member to group
                    const createdAt = new Date();
                    const user = await database.query(`
                        SELECT profilepic, name
                        FROM users
                        WHERE id=$1
                    `, [memberId]);

                    await database.query(`
                        INSERT INTO 
                        groupconnects (groupid, adminid, memberid, createdat, isvalid)
                        VALUES ($1,$2, $3, $4, TRUE)
                        `, [groupId, adminId, memberId, createdAt]);

                    // Emit join to group room
                    RealTimeGroupMember.JoinGroup(groupId,{
                        member: {
                            id: memberId,
                            name: user.rows[0].name,
                            profilePic: user.rows[0].profilepic
                        },
                        adminId: adminId,
                        groupId: groupId
                    });

                    // Emit group list update to member
                    const memberSocketId = await getReceiverSocketId(memberId.toString());
                    if (memberSocketId) {
                        io.to(memberSocketId).emit("groupListUpdate");
                    }

                    // Invalidate caches
                    await invalidateGroupListCache(memberId); // New member's group list
                    await invalidateAdminGroupMembersCache(adminId); // Admin's member cache
                    await invalidateMemberGroupMembersForUsers(memberId); // New member's member cache
                }else if(action==="withdraw"){
                    await RealTimeGroupMember.WithdrawGroupRequest(memberId,
                        {
                            memberId: memberId,
                            groupId: groupId,
                            adminId: adminId
                        }
                    )
                }
        }
        return res.status(200).json("delete successfully")
    } catch (e) {
        next(e);
    }
}
