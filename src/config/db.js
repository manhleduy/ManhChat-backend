import{ Pool} from "pg"
import dotenv from "dotenv"
dotenv.config();
export const database = new Pool({
    user: "postgres",
    password: "lem@19072006",
    host: process.env.DB_HOST,
    port : process.env.DB_PORT,
    database: "manh-chat-data"
});
