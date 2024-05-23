const{z}=require("zod");

//creating an object schema
const signupSchema=z.object({
    organisation: z
    .string({required_error: "Organisation name is reuired"})
    .trim()
    .min(3,{message: "Organisation name must be atleast 3 characters."})
    .max(255,{message: "Organisation name must not be more than 255 characters."}),

    username: z
    .string({required_error: "Username is reuired"})
    .trim()
    .min(3,{message: "Username must be atleast 3 characters."})
    .max(255,{message: "Username must not be more than 255 characters."}),

    email: z
    .string({required_error: "Email is reuired"})
    .trim()
    .email({message: "Invalid email address"})
    .min(3,{message: "Email must be atleast 3 characters."})
    .max(255,{message: "Email must not be more than 255 characters."}),

    password: z
    .string({required_error: "Password is reuired"})
    .min(7,{message: "Password must be atleast of 6 characters."})
    .max(1024,{message: "Password can't be greater than 1024 characters."}),

});

module.exports=signupSchema;