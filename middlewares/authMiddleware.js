const jwt = require("jsonwebtoken");
const User = require("../models/user");

const auth = async(req, res, next) => {
  const token = req.headers.authorization?.split(" ")[1];
  if (!token) return res.status(401).json({ message: "No token" });

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    if (!decoded) return res.status(403).json({ message: "Invalid token" });
    let user = await User.findById(decoded.id);
    if (!user) return res.status(404).json({ message: "User not found" });
    req.user = user;
    next();
  } catch {
    return res.status(403).json({ message: "Invalid token" });
  }
};

module.exports = auth;
