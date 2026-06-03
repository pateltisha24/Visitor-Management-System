const { z } = require("zod");

// Login is by email + password.
const loginSchema = z.object({
    email: z
        .string({ required_error: "Email is required" })
        .trim()
        .email({ message: "Invalid email address" })
        .max(255, { message: "Email must not be more than 255 characters." }),

    password: z
        .string({ required_error: "Password is required" })
        .min(6, { message: "Password must be atleast 6 characters." })
        .max(1024, { message: "Password can't be greater than 1024 characters." }),
});

// Signup additionally collects an organisation name.
const signupSchema = loginSchema.extend({
    organisation: z
        .string({ required_error: "Organisation name is required" })
        .trim()
        .min(2, { message: "Organisation name must be atleast 2 characters." })
        .max(255, { message: "Organisation name must not be more than 255 characters." }),
});

module.exports = { signupSchema, loginSchema };
