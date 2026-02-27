import { database } from "../config/db.js";

export const verifyUser=async (checkId)=>{
    try{
        if(checkId===0 || !checkId|| checkId==='undefined'){
            return {
                isExist:false,
                message:"missing required value"
            }
        }
        const check=await database.query(`
            SELECT name
            FROM users
            WHERE id=$1
            `, [checkId]);
        if(check.rows.length===0){
            return {
                isExist:false,
                message:"user not found"
            }
        }
        return{
            isExist:true,
            message:"ok"
        }
    }catch(e){
        
        return{
            isExist:false,
            message: "server error"
        }
    }
}
export const verifyAdmin= async( req, res, next)=>{
    try{
        
        const checkId= req.params.id;
        if(checkId===0 || !checkId|| checkId==='undefined'){
            return res.status(400).json("missing id to verify admin");
        }
        const check=await database.query(`
            SELECT * FROM groups WHERE adminid=$1`,[checkId])
        if(check.rows.length===0){
            return res.status(404).json("you are not the admin of any group")
        }
        next();
    }catch(e){
        console.log(e);
        return res.status(500).json("server error");
    }
}

export const isGroupMember= async(req, res, next)=>{
    try{
        let groupId = 0;
        if(req.params.id){
            groupId=req.params.id;
        }
        const {memberId}= req.body;
        if(checkId===0 || !checkId|| checkId==="undefined"){
            res.status(400).json("missing id to verify member");

        }
        const check = await database.query(`
            SELECT * 
            FROM groups a
            INNER JOIN groupconnects b
            ON b.groupid= a.id
            WHERE a.id=$1 AND b.userid=$2
            `,[groupId, memberId]);
        
        next();
        
    }
    catch(e){
        console.log(e);
        return res.status(500).json("server error");
    }

}

