const jwt = require('jsonwebtoken');
const User = require('../models/user-model');

// Reads the JWT from the "Authorization: Bearer <token>" header.
// (The client stores the token in localStorage and sends it on each request.)
const authMiddleware = async (req, res, next) => {
  const token = req.header('Authorization');

  if (!token) {
    return res.status(401).json({ message: "Unauthorized HTTP, Token not provided" });
  }

  try {
    const jwtToken = token.replace("Bearer ", "").trim();
    const isVerified = jwt.verify(jwtToken, process.env.JWT_SECRET_KEY);

    const userData = await User.findOne({ email: isVerified.email }).select({ password: 0 });

    if (!userData) {
      return res.status(401).json({ message: "Unauthorized HTTP, User not found" });
    }

    req.user = userData;
    req.token = jwtToken;
    req.userID = userData._id;

    next();
  } catch (error) {
    console.error("Error in authentication middleware:", error);
    return res.status(401).json({ message: "Unauthorized HTTP, Invalid token" });
  }
};

module.exports = authMiddleware;
