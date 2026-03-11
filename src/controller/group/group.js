import { database } from "../../config/db.js";
import { invalidateGroupListCache } from "../redis/userGroup.js";
import { io } from "../../config/socket.js";
import { getReceiverSocketId } from "../../service/socketReceiverConfig.js";

/**
 * Create a new group
 * @route POST /api/group/create
 */
export const createGroup = async (req, res, next) => {
    try {
        const { detail, adminId, groupName, isRestricted } = req.body;
        const createdAt = new Date();
        const safeRestrict = isRestricted ? isRestricted : false;
        if (!adminId || !groupName) {
            return res.status(400).json("missing required value")
        }

        await database.query(`
            INSERT INTO groups (detail, adminid, groupname, createdat, isrestricted)
            VALUES ($1,$2,$3,$4,$5)`,
            [detail, adminId, groupName, createdAt, safeRestrict])
        const group = await database.query(`
            SELECT id 
            FROM groups
            WHERE adminid=$1 AND groupname=$2  AND createdat=$3 AND isrestricted=$4 AND detail=$5
            `, [adminId, groupName, createdAt, safeRestrict, detail])
        await database.query(`
            INSERT INTO 
            groupconnects (groupid, adminid, memberid, createdat, isvalid)
            VALUES ($1,$2, $3, $4, TRUE)
            `, [group.rows[0].id, adminId, adminId, createdAt])
        
        // Invalidate group list cache for the admin
        await invalidateGroupListCache(adminId);
        
        return res.status(201).json("successfully");
    } catch (e) {
        next(e);
    }
}

/**
 * Get group information and members
 * @route GET /api/group/info/:id
 */
export const getGroupInfo = async (req, res, next) => {
    try {
        const groupId = req.params.id;
        if (!groupId) {
            return res.status(401).json("cannot find this group")
        }
        const groupInfo = await database.query(
            `
            SELECT u.name , u.profilepic, g.groupname, 
            g.detail, u.phonenumber, u.email, g.id as groupid,
            g.adminid as adminid, g.isrestricted
            FROM groups g
            INNER JOIN users u
            ON g.adminid = u.id
            WHERE g.id= $1
            `,
            [groupId]
        )
        const users = await database.query(`
            SELECT u.name,u.id, u.profilepic
            FROM groupconnects g
            INNER JOIN users u
            ON g.memberid= u.id
            WHERE g.groupid= $1
            `, [groupId])
        return res.status(200).json({
            groupMembers: users.rows.map(item => {
                return {
                    id: item.id,
                    name: item.name,
                    profilePic: item.profilepic
                }
            }),
            groupInfo: groupInfo.rows.map(item => {
                return {
                    adminName: item.name,
                    adminProfilePic: item.profilepic,
                    groupName: item.groupname,
                    detail: item.detail,
                    phonenumber: item.phonenumber,
                    email: item.email,
                    groupId: item.groupid,
                    adminId: item.adminid,
                    isRestricted: item.isrestricted
                }
            })[0]
        })
    } catch (e) {
        next(e);
    }
}

/**
 * Update group details
 * @route PUT /api/group/update/:id
 */
export const updateGroup = async (req, res, next) => {
    try {
        const groupId = req.params.id;
        if (!groupId) {
            return res.status(400).json("missing group id")
        }
        const { detail, groupName, adminId, isRestricted } = req.body;
        if (!detail || !groupName || !isRestricted) {
            return res.status(400).json("missing required value")
        }
        await database.query(`
            UPDATE groups
            SET groupname=$1, detail=$2, isrestricted=$3
            WHERE id=$4 AND adminid=$5
            `, [groupName, detail, isRestricted, groupId, adminId]);
        
        // Get all members of the group to invalidate their caches
        const members = await database.query(`
            SELECT DISTINCT memberid
            FROM groupconnects
            WHERE groupid=$1
        `, [groupId]);
        
        const memberIds = members.rows.map(row => row.memberid);
        if (memberIds.length > 0) {
            await invalidateGroupListCache(memberIds);
        }
        
        return res.status(200).json("update successfully")
    } catch (e) {
        next(e);
    }
}

/**
 * Delete a group
 * @route DELETE /api/group/:id
 */
export const deleteGroup = async (req, res, next) => {
    try {
        const { adminId, groupId } = req.body;
        if (!adminId || !groupId) {
            return res.status(400).json("missing required value")
        }
        
        // Get all members of the group before deleting to invalidate their caches
        const members = await database.query(`
            SELECT DISTINCT memberid
            FROM groupconnects
            WHERE groupid=$1
        `, [groupId]);
        
        await database.query(`
            DELETE FROM groups
            WHERE adminid= $1 AND id=$2
            `, [adminId, groupId]);
        
        // Invalidate caches for all group members
        const memberIds = members.rows.map(row => row.memberid);
        if (memberIds.length > 0) {
            await invalidateGroupListCache(memberIds);
            
            // Emit group list update to all members
            for (const memberId of memberIds) {
                const memberSocketId = await getReceiverSocketId(memberId.toString());
                if (memberSocketId) {
                    io.to(memberSocketId).emit("groupListUpdate");
                }
            }
            
            // Emit group deleted to group room
            io.to(groupId.toString()).emit("groupDeleted", { groupId });
        }
        
        return res.status(200).json("delete successfully");
    } catch (e) {
        next(e);
    }
}
