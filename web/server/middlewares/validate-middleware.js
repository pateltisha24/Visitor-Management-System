const validate=(schema)=> async (req,res,next)=>{
    try{
        const parseBody= await schema.parseAsync(req.body);
        req.body=parseBody;
        next();
    }
    catch (err) {
        const status=422;
        const message="Fill the input details properly";
        const extraDetails=err?.errors?.[0]?.message || err.message || "Invalid input";

        next({ status, message, extraDetails });
    }

};

module.exports=validate;