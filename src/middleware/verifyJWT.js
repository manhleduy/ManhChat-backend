import jwt from "jsonwebtoken";

export const verifyJWT = async (req, res, next) => {
  try {
    const token = req.cookies?.jwt;
    if (!token) {
      return res.status(401).json({ message: "Unauthorized - No token provided" });
    }

    try {
      const decoded = jwt.verify(token, process.env.SECRET_KEY);
      req.user = decoded;
      return next();
    } catch (err) {
      // Token expired
      if (err && err.name === "TokenExpiredError") {
        return res.status(401).json({ message: "Unauthorized - Token expired" });
      }
      // Invalid token
      if (err && err.name === "JsonWebTokenError") {
        return res.status(401).json({ message: "Unauthorized - Invalid token" });
      }
      // Fallback
      return res.status(401).json({ message: "Unauthorized - Invalid token" });
    }
  } catch (e) {
    console.error(e);
    return res.status(500).json({ message: "Server error" });
  }
};


