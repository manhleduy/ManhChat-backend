import { database } from "../../config/db.js";
import { getCachedGroupList, setCachedGroupList, invalidateGroupListCache } from "../redis/userGroup.js";
import { invalidateMemberGroupMembersForUsers } from "../redis/group/member.js";
import { invalidateAdminGroupMembersCache } from "../redis/group/admin.js";
import { io } from "../../config/socket.js";

/**
 * Add a member to a group
 * @route POST /api/group/members/add/:id
 */
export const createGroupConnect = async (req, res) => {
    try {
        const groupId = req.params.id;
        const { adminId, memberId } = req.body
        if (!groupId || !adminId || !memberId) return res.status(400).json("missing required value")

        const createdAt = new Date()
        const check = await database.query(`
            SELECT * 
            FROM groups 
            WHERE id=$1 AND adminid=$2`,
            [groupId, adminId])
        if (check.rows.length === 0) return res.status(404).json("this group is no longer exist");

        const user = await database.query(`
            SELECT profilepic, name
            FROM users
            WHERE id=$1
            `, [memberId])

        io.to(groupId.toString()).emit("newUserJoined", {
            member: {
                id: memberId,
                name: user.rows[0].name,
                profilePic: user.rows[0].profilepic
            },
            adminId: adminId,
            groupId: groupId
        })

        await database.query(`
            INSERT INTO 
            groupconnects (groupid, adminid, memberid, createdat, isvalid)
            VALUES ($1,$2, $3, $4, TRUE)
            `, [groupId, adminId, memberId, createdAt])
        
        // Invalidate caches
        await invalidateGroupListCache(memberId); // New member's group list
        await invalidateAdminGroupMembersCache(adminId); // Admin's member cache
        await invalidateMemberGroupMembersForUsers(memberId); // New member's member cache
        
        return res.status(201).json(' a member join in group')
    } catch (e) {
        console.log(e);
        return res.status(500).json("server error or you have been on this group");
    }
}

/**
 * Remove a member from a group
 * @route DELETE /api/group/members/:id
 */
export const deleteGroupConnect = async (req, res) => {
    try {
        const groupId = req.params.id;
        const { memberId } = req.body;
        if (!groupId || !memberId) {
            return res.status(400).json("missing required value");
        }
        console.log(groupId, memberId);

        io.to(groupId.toString()).emit("userLeaveGroup", {
            memberId: memberId,
            groupId: groupId
        })

        // Get admin ID before deleting
        const adminQuery = await database.query(`
            SELECT DISTINCT adminid
            FROM groupconnects
            WHERE groupid=$1
            LIMIT 1
        `, [groupId]);

        await database.query(`
            DELETE FROM groupconnects
            WHERE groupid=$1 AND memberid=$2
            `, [groupId, memberId])
        
        // Invalidate caches
        await invalidateGroupListCache(memberId); // Leaving member's group list
        
        if (adminQuery.rows.length > 0) {
            const adminId = adminQuery.rows[0].adminid;
            await invalidateAdminGroupMembersCache(adminId); // Admin's member cache
        }
        await invalidateMemberGroupMembersForUsers(memberId); // Leaving member's member cache
        
        return res.status(200).json("you leave this group")

    } catch (e) {
        console.log(e);
        return res.status(500).json("server error or you have been on this group");
    }
}

/**
 * Get all groups for a user
 * @route GET /api/group/:id
 */
export const getAllGroup = async (req, res) => {
    try {
        const userId = req.params.id;
        if (!userId) {
            return res.status(400).json("missing user id")
        }

        // Try to get cached group list first
        const cachedGroupList = await getCachedGroupList(userId);
        if (cachedGroupList) {
            return res.status(200).json({
                message: "successfully (cached)",
                groupList: cachedGroupList
            });
        }

        const result = await database.query(`
            SELECT DISTINCT ON (groupselected.id) groupselected.id,
            groupselected.detail, groupselected.adminid, 
            groupselected.groupname, groupselected.createdat,
            groupselected.isrestricted, groupchats.content AS lastmessage
            FROM(
                SELECT b.id, b.detail, b.adminid, b.groupname, b.createdat, b.isrestricted
                FROM groupconnects a
                RIGHT JOIN groups b
                ON a.groupid= b.id 
                WHERE a.memberid= $1
            ) AS groupselected
            LEFT JOIN (
                SELECT content, groupid
                FROM groupchatblocks
                ORDER BY createdat DESC
            ) AS groupchats
            ON groupselected.id= groupchats.groupid

            `, [userId]
        )
        const groupList = result.rows.map((item) => {
            return {
                id: item.id,
                detail: item.detail,
                adminId: item.adminid,
                groupName: item.groupname,
                createdAt: item.createdat,
                isRestricted: item.isrestricted,
                lastMessage: item.lastmessage
            }
        })

        // Cache the group list
        await setCachedGroupList(userId, groupList);

        return res.status(200).json({
            message: "successfully",
            groupList: groupList
        })
    } catch (e) {
        console.log(e);
        return res.status(500).json("server error");
    }
}
