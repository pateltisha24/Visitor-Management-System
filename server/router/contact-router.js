// const express=require("express");
// const router=express.Router();
// const contactForm = require("../controllers/contact-controller");

// router.route("/contact").post(contactForm);

// module.exports=router;
// contact-router.js

const express = require('express');
const router = express.Router();
const contactForm = require('../controllers/contact-controller');
const validate = require('../middlewares/validate-middleware');
const { contactSchema } = require('../validators/contact-validator');

// Route to handle POST request to /contact
router.post('/contact', validate(contactSchema), contactForm);

module.exports = router;
