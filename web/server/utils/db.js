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

// const URI = "mongodb://localhost:27017/vsr";


 const URI = process.env.MONGODB_URI;

const connectDb = async () => {
    try {
        await mongoose.connect(URI); 
            console.log("Connection successful to DB");
        
        
    } catch (error) {
        console.error("Database connection failed:", error.message);
        process.exit(1); // Exit the process with a failure
    }
};

module.exports = connectDb;