const mongoose = require("mongoose");
const jwt=require("jsonwebtoken");

//blue print of registration form
const userSchema=new mongoose.Schema({
    organisation:{
        type:String,
        require: true,
    },

    username:{
        type:String,
        require: true,
    },

    email:{
        type:String,
        require: true,
    },

    password:{
        type:String,
        require: true,
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