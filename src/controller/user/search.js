import { database } from "../../config/db.js";

/**
 * Search for users by name, email, or phone number
 * @route POST /api/user/search
 */
export const findUsers = async (req, res, next) => {
    try {
        const { name, email, phonenumber } = req.body;
        const result = await database.query(`
            SELECT id, name, email, phonenumber, profilepic,
            birthday, address
            FROM users
            WHERE name LIKE '%' || $1 || '%' 
            AND email LIKE '%' || $2 || '%'
            AND phonenumber LIKE '%' || $3 || '%'
            ORDER BY id
            `, [name, email, phonenumber])
        return res.status(200).json({
            message: "successfully",
            users: result.rows.map((item) => {
                return {
                    id: item.id,
                    name: item.name,
                    email: item.email,
                    phonenumber: item.phonenumber,
                    profilePic: item.profilepic,
                    birthday: item.birthday,
                    address: item.address
                }
            })
        })
    } catch (e) {
        next(e);
    }
}
