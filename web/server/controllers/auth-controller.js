const User = require("../models/user-model");
const bcrypt = require('bcryptjs');

// The shared, read-only demo account (seeded). Changes to it are blocked so the
// public "Live demo" can't be broken for everyone.
const DEMO_EMAIL = "demo@facesense.app";
const isDemoAccount = (req) => req.user?.email === DEMO_EMAIL;

const home = async (req, res) => {
    try {
        res.status(200).send('Welcome to VSR using Router');
    } 
    
    catch (error) {
        console.log(error);
        res.status(500).json({ message: "Internal server error" });
    }
};

const register = async (req, res) => {
    try {
        const { organisation, email, password } = req.body;

        // checking if email id exists or not
        const userExist = await User.findOne({ email });
        if (userExist) {
            return res.status(400).json({ message: "Email already exists" });
        }

        // Hash the password before saving
        const hash_password = await bcrypt.hash(password, 10);

        const userCreated = await User.create({ organisation, email, password: hash_password });

        res.status(201).json({
            message: "User registered successfully",
            // Never return the password hash to the client.
            user: { id: userCreated._id, organisation, email },
            token: await userCreated.generateToken(),
            userID: userCreated._id.toString(),
        });

    }

    catch (error) {
        res.status(500).json({ message: "Internal server error" });
    }
};

//user login logic
const login = async (req, res) => {
    try {
        const { email, password } = req.body;
        const userExist = await User.findOne({ email });

        if (!userExist) {
            return res.status(400).json({ message: "Invalid credentials" });
        }

        //compare password
        const isMatch = await bcrypt.compare(password, userExist.password);
        if (isMatch) {
            res.status(200).json({
                message: "Login successfully",
                token: await userExist.generateToken(),
                userID: userExist._id.toString(),
            });
        }
        else {
            res.status(401).json({ message: "Invalid credentials" });
        }

    }
    catch (error) {
        res.status(500).json({ message: "Internal server error" });
    }
};

const user = async(req,res) =>{
        try {
            const userData =req.user;
            return res.status(200).json({userData});
        } catch (error) {
            console.log(`error from the user route ${error}`);
            return res.status(500).json({ message: "Internal server error" });
        }
    };

// Update editable profile fields (organisation, timezone). Auth required.
const updateProfile = async (req, res) => {
    try {
        if (isDemoAccount(req)) return res.status(403).json({ message: "The demo account is read-only" });
        const { organisation, timezone } = req.body;
        const updates = {};
        if (organisation !== undefined) updates.organisation = organisation;
        if (timezone !== undefined) updates.timezone = timezone;
        const updated = await User.findByIdAndUpdate(req.userID, updates, { new: true }).select({ password: 0 });
        return res.status(200).json({ message: "Profile updated", userData: updated });
    } catch (error) {
        return res.status(500).json({ message: "Internal server error" });
    }
};

// Change password: verify the current one, then store the bcrypt hash of the new.
const changePassword = async (req, res) => {
    try {
        if (isDemoAccount(req)) return res.status(403).json({ message: "The demo account is read-only" });
        const { currentPassword, newPassword } = req.body;
        if (!currentPassword || !newPassword) {
            return res.status(400).json({ message: "Current and new password are required" });
        }
        if (String(newPassword).length < 6) {
            return res.status(422).json({ message: "New password must be at least 6 characters" });
        }
        const fullUser = await User.findById(req.userID);
        if (!fullUser) return res.status(404).json({ message: "User not found" });

        const matches = await bcrypt.compare(currentPassword, fullUser.password);
        if (!matches) return res.status(401).json({ message: "Current password is incorrect" });

        fullUser.password = await bcrypt.hash(newPassword, 10);
        await fullUser.save();
        return res.status(200).json({ message: "Password updated successfully" });
    } catch (error) {
        return res.status(500).json({ message: "Internal server error" });
    }
};

module.exports = { home, register, login, user, updateProfile, changePassword };
