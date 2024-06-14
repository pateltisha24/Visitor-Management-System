// const express=require("express");
// const router=express.Router();
// const contactForm = require("../controllers/contact-controller");

// router.route("/contact").post(contactForm);

// module.exports=router;
// contact-router.js

const express = require('express');
const router = express.Router();
const contactForm = require('../controllers/contact-controller');

// Route to handle POST request to /contact
router.post('/contact', contactForm);

module.exports = router;
