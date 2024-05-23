const express=require("express");
const router=express.Router();
const {home,register,login}= require("../controllers/auth-controller");
const signupSchema=require("../validators/auth-validator");
const validate=require("../middlewares/validate-middleware");

router.route("/").get(home);
router
    .route('/register')
    .post(validate(signupSchema),register);
router.route("/login").post(login);

module.exports=router;