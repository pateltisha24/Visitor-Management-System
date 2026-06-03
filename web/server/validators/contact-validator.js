const { z } = require("zod");

const contactSchema = z.object({
    username: z.string({ required_error: "Name is required" }).trim().min(1, { message: "Name is required" }).max(120),
    email: z.string({ required_error: "Email is required" }).trim().email({ message: "Invalid email address" }),
    phone: z.string({ required_error: "Phone is required" }).trim().min(3, { message: "Phone is required" }).max(40),
    message: z.string({ required_error: "Message is required" }).trim().min(1, { message: "Message is required" }).max(2000),
});

module.exports = { contactSchema };
