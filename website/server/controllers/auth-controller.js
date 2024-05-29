const User = require("../models/user-model");
const bcrypt = require('bcrypt');

const home = async (req, res) => {
    try {
        res.status(200).send('Welcome to VSR using Router');
    } 
    
    catch (error) {
        console.log(error);
    }
};

const register = async (req, res) => {
    try {
        const { organisation, username, email, password } = req.body;

        // checking if email id exists or not
        const userExist = await User.findOne({ email });
        if (userExist) {
            return res.status(400).json({ message: "Email already exists" });
        }

        // Hash the password before saving
        const hash_password = await bcrypt.hash(password, 10);

        const userCreated = await User.create({ organisation, username, email, password: hash_password });

        res.status(201).json({ 
            message: "User registered successfully", 
            user: userCreated,
            token:await userCreated.generateToken(),
            userID: userCreated._id.toString(), 
        });

    } 
    
    catch (error) {
        res.status(500).json({ message: "Internal server error" });
    }
};

//user login logic
const login=async(req,res)=>{
    try{
        const {username,password}=req.body;
        const userExist=await User.findOne({username});
        console.log(userExist);

        if(!userExist){
            return res.status(400).json({message: "Invalid credentials"});
        }

        //compare password
        const user= await bcrypt.compare(password,userExist.password);
        if(user){
            res.status(200).json({ 
                message: "Login successfully", 
                token:await userExist.generateToken(),
                userID: userExist._id.toString(), 
            });
        }
        else{
            res.status(401).json({message: "Invalid  password"});
        }
    
    }
    catch(error){
        //res.status(500).json({ message: "Internal server error" });
        next(error);
    }
};

const user = async(req,res) =>{
        try {
            const userData =req.user;
            console.log(userData);
            return res.status(200).json({userData});
        } catch (error) {
            console.log(`error from the user route ${error}`);
        }
    };

module.exports = { home, register,login ,user};
