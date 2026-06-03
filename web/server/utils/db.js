// const mongoose=require("mongoose");

// const URI="mongodb://localhost:27017/vsr";

// //const URI=process.env.MONGODB_URI;

// const connectDb=async() => {
//     try{
//         await mongoose.connect(URI);
//         console.log("Connection successful to DB");
//     }
//     catch(error){
//         console.error("Database connection failed");
//         process.exit(0);
//     }
// };

// module.exports=connectDb;

const mongoose = require('mongoose');

const connectDb = async () => {
    const URI = process.env.MONGODB_URI;
    if (!URI) {
        console.error("MONGODB_URI is not set. Copy .env.example to .env and fill it in.");
        return;
    }
    try {
        await mongoose.connect(URI);
        console.log("Connection successful to DB");
    } catch (error) {
        // Don't kill the process: on serverless (Vercel) and during local dev we
        // still want the server to boot; Mongoose will retry on the next request.
        console.error("Database connection failed:", error.message);
    }
};

module.exports = connectDb;
