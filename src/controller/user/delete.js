import { database } from "../../config/db.js";

/**
 * Delete user account
 * @route DELETE /api/user/account/:id
 */
export const DeleteUser = async (req, res) => {
    try {
        const id = req.params.id;
        await database.query(`
            DELETE FROM users
            WHERE id=$1
            `, [id])
        return res.status(200).json("delete successfully")
    } catch (e) {
        console.log(e);
        return res.status(500).json("server error");
    }
}
