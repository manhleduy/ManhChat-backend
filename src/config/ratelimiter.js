const MAX_REQ= 100;
const WINDOW_MS=1000;

const clients= new Map();
const rateLimiter= (req, res, next)=>{
    const ip= req.ip;
    const noew= Date.now();
    if(!clients.has(ip)){
        clients.set(ip, noew);
        return next();
    }
    const client= clients.get(ip);
    const elapsed= now- client.start;

    if(elapsed>WINDOW_MS){
        client.count=1;
        client.start=now;
        return next();
    }
    if(client.count<MAX_REQ){
        client.count++;
        return next();
    }
    if(client.count>=MAX_REQ){
        return res.status(429).json("Too many requrests, slow down.")

    }
    client.count++;
    next();


}