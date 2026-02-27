import { database } from "../../config/db.js";
import bcrypt from "bcryptjs"
import jwt from "jsonwebtoken"
import dotenv from "dotenv"
import { io } from "../../config/socket.js";

dotenv.config()

export const Logout = async (res, req) => {
    try {
        const cookies = req.cookies;
        if (!cookies?.secretToken) return res.sendStatus(204);
        res.clearCookie('jwt', { httpOnly: true });
        return res.status(200).json({
            message: "logged out successfully",
            status: 204
        })
    } catch (e) {
        console.log(e);
        return res.status(500).json("server error")
    }
}

export const SignUp = async (req, res) => {
    try {
        const { address, name, email, profilePic, phonenumber, birthday, password } = req.body;
        if (!name || !address || !email || !phonenumber || !password) {
            return res.status(400).json("missing required data!")
        }
        const createdAt = new Date();
        const updatedAt = new Date();

        const salt = await bcrypt.genSalt(10);
        const safePassword = await bcrypt.hash(password, salt);

        await database.query(
            `
                INSERT INTO users (
                    name, address, email, profilepic, phonenumber, birthday, 
                    password, createdat, updatedat
                )
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
            `,
            [
                name,
                address,
                email,
                profilePic,
                phonenumber,
                birthday,
                safePassword,
                createdAt,
                updatedAt
            ]
        );
        res.status(201).json("you sign in successful")
    } catch (e) {
        console.log(e);
        return res.status(500).json("server error")
    }
}

export const Login = async (req, res) => {
    try {
        const { email, password } = req.body;
        if (!email || !password) {
            return res.status(400).json("missing required data!")
        }

        const result = await database.query(
            `SELECT password
             FROM users
             WHERE email=$1`,
            [email]
        )
        const { rows } = result;
        const data = await database.query(
            `SELECT id, name, email, profilepic
            FROM users
            WHERE email=$1`,
            [email]
        )
        const { id, name, profilepic } = data.rows[0];
        const currentUser = {
            id: id,
            name: name,
            email: email,
            profilePic: profilepic
        }
        if (data.rows[0]) {
            const checkPassword = await bcrypt.compareSync(password, rows[0].password)
            if (checkPassword) {
                const secretToken = jwt.sign(
                    { "id": currentUser.id },
                    process.env.SECRET_KEY,
                    { expiresIn: "7d" }
                )
                res.cookie(
                    'jwt',
                    secretToken,
                    {
                        httpOnly: true,
                        maxAge: 7 * 24 * 60 * 60 * 1000
                    }
                )
                return res.status(200).json({
                    message: "login successfully",
                    userInfo: currentUser
                })
            } else {
                return res.status(400).json('wrong password');
            }
        } else {
            return res.status(400).json("cannot find user with email ?.Sign up with your email first", [email])
        }
    } catch (e) {
        console.log(e);
        return res.status(500).json("server error");
    }
}
