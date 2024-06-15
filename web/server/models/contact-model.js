const { Schema, model } = require("mongoose");

const contactSchema = new Schema({
    username: { type: String, required: true },
    email: { type: String, required: true },
    phone :{type:Number,reqiure :true},
    message: { type: String, required: true },
});

// create a model or a collection
const Contact = new model("Contact", contactSchema);
module.exports = Contact;
