

// const jwt = require("jsonwebtoken");
// const User = require("../models/user-model");
 
// const authMiddleware = async(req,res,next) =>{
//     const token = req.header("Authorization");

//     if(!token){
//         return res
//           .status(401)
//           .json({message : " Unauthorized HTTP , Token not provided"});
//     }
//     console.log("token of middle-ware",token);


//     const jwtToken = token.replace("Bearer ","").trim();
//     console.log("token of middle-ware",jwtToken);
//     try {
//         const isVerified = jwt.verify(jwtToken,process.env.JWT_SECRET_KEY);
        

//         const userData = await User.findOne({email:isVerified.email}).
//        select({
//             password : 0,
//         });
//         if (!userData) {
//             return res.status(401).json({ message: "Unauthorized HTTP, User not found" });
//           }
      
//         console.log(userData);
//         req.user = userData;
//         req.token = token;
//         req.userID = userData._id;


//         next();
        
//     } catch (error) {
//         console.error("Error in authentication middleware:", error);
//         return res.status(401).json({ message: "Unauthorized HTTP, Invalid token" });
//     }
    
    
// };


// module.exports = authMiddleware;
const jwt = require('jsonwebtoken');
const User = require('../models/user-model');
const cookieParser = require('cookie-parser');

const authMiddleware = async (req, res, next) => {
  const token = req.cookies['auth-token']; // Using cookie for token storage

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
    req.token = token;
    req.userID = userData._id;

    next();
  } catch (error) {
    console.error("Error in authentication middleware:", error);
    return res.status(401).json({ message: "Unauthorized HTTP, Invalid token" });
  }
};

module.exports = authMiddleware;



