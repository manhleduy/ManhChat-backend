import { database } from "../../config/db.js";
import { verifyUser } from "../../middleware/verifyUser.js";
import cloudinary from "../../config/cloundinary.js";
import bcrypt from "bcryptjs"

/**
 * Get user information by ID
 * @route GET /api/user/:id
 */
export const GetUserInfo = async (req, res, next) => {
    try {
        const id = req.params.id;
        if (!id) {
            res.status(400).json("missing email!")
        }

        const data = await database.query(`SELECT 
            name, address, email, profilePic, phonenumber, birthday, createdat
            FROM users
            WHERE id=$1`, [id])

        if (!data.rows[0]) {
            res.status(400).json("cannot find this user, haven't you signed up yet?")
        }
        res.status(200).json(
            data.rows.map(item => {
                return {
                    name: item.name,
                    address: item.address,
                    email: item.email,
                    profilePic: item.profilePic,
                    phonenumber: item.phonenumber,
                    birthday: new Date(item.birthday).toISOString().split('T')[0],
                    createdAt: item.createdat
                }
            })[0]
        )
    } catch (e) {
        next(e);
    }
}

/**
 * Update user profile information
 * @route PUT /api/user/profile/:id
 */
export const UpdateUserInfo = async (req, res, next) => {
    try {
        const id = req.params.id;

        const { name, address, phonenumber, birthday } = req.body
        const updatedat = new Date();
        const checkExist = await verifyUser(id);
        if (!checkExist.isExist) {
            return res.status(400).json(checkExist.message);
        }
        if (!id) {
            return res.status(400).json("missing id!")
        }
        if (!name || !address || !phonenumber || !birthday) {
            return res.status(400).json("missing required data!")
        }

        await database.query(`UPDATE users 
            SET name=$1, address=$2, phonenumber=$3, birthday=$4, updatedat=$5
            WHERE id=$6`,
            [name, address, phonenumber, birthday, updatedat, id])

        return res.status(200).json("update your information")
    } catch (e) {
        next(e);
    }
}

/**
 * Update user avatar/profile picture
 * @route PUT /api/user/avatar/:id
 */
export const UpdateUserAvatar = async (req, res, next) => {
    try {
        const id = req.params.id;
        const avatar = req.body.avatar;
        if (!id || !avatar) {
            return res.status(400).json("missing required value")
        }
        const uploadResponse = await cloudinary.uploader.upload(avatar);

        await database.query(`
            UPDATE users
            SET profilePic=$1
            WHERE id=$2
            `, [uploadResponse.secure_url, id])
        return res.status(200).json("update your avatar");
    } catch (e) {
        next(e);
    }
}

/**
 * Update user password
 * @route PUT /api/user/password
 */
export const UpdateUserPassword = async (req, res, next) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json("missing required value");
        }
        const salt = await bcrypt.genSalt(10);
        const safePassword = await bcrypt.hash(password, salt);
        await database.query("UPDATE users SET password=$1 WHERE email=$2",
            [safePassword, email])
        return res.status(200).json("update your password");
    }
    catch (e) {
        next(e);
    }
}
