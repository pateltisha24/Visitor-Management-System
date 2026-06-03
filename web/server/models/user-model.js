const mongoose = require("mongoose");
const jwt=require("jsonwebtoken");

//blue print of registration form
const userSchema=new mongoose.Schema({
    organisation:{
        type:String,
        required: true,
    },

    email:{
        type:String,
        required: true,
        unique: true,
    },

    password:{
        type:String,
        required: true,
    },

    timezone:{
        type:String,
        default: "UTC",
    },

    // Bring-your-own-key AI config. The key is stored encrypted (never returned).
    ai:{
        provider:{ type:String, default:"" },
        model:{ type:String, default:"" },
        keyEnc:{ type:String, default:"" },
    },

    isAdmin:{
        type:Boolean,
        default: false,
    },
});

//json web token-cookies
userSchema.methods.generateToken = async function(){
    try{
        return jwt.sign({
            userId: this._id.toString(),
            email: this.email,
            isAdmin: this.isAdmin,
        },
        process.env.JWT_SECRET_KEY,{
            expiresIn: "30d",
        }
    );
    }
    catch(error){
        console.error(error);
    }
};

//define the model or the collection name
const User=new mongoose.model("org_users",userSchema);
module.exports=User;