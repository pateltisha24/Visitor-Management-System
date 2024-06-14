// const express=require("express");
// const router=express.Router();
// const authControllers = require("../controllers/auth-controller");
// const {home,register,login}= require("../controllers/auth-controller");
// const {signupSchema,loginSchema}=require("../validators/auth-validator");
// const validate=require("../middlewares/validate-middleware");
// const authMiddleware = require("../middlewares/auth-middleware");

// router.route("/").get(authControllers.home);
// router
//     .route('/register')
//     .post(validate(signupSchema),authControllers.register);
// router.route("/login").post(validate(loginSchema),authControllers.login);

// router.get('/user', authMiddleware, (req, res) => {
//     res.json({ userData: req.user });
//   });
// // router.route('/user').get(authMiddleware,authControllers.user);

// module.exports=router;
const express = require('express');
const router = express.Router();
const authControllers = require('../controllers/auth-controller');
const { home, register, login } = require('../controllers/auth-controller');
const { signupSchema, loginSchema } = require('../validators/auth-validator');
const validate = require('../middlewares/validate-middleware');
const authMiddleware = require('../middlewares/auth-middleware');

router.get('/', authControllers.home);

router.post('/register', validate(signupSchema), authControllers.register);

router.post('/login', validate(loginSchema), authControllers.login);

router.get('/user', authMiddleware, (req, res) => {
    res.json({ userData: req.user });
});

module.exports = router;
