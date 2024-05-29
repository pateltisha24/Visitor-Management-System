require("dotenv").config();

const express=require("express");
const cors=require("cors");
const app=express();
const authRoute=require('./router/auth-router');
const contactRoute=require('./router/contact-router');
const connectDb=require("./utils/db");
const cookieParser = require('cookie-parser');
const errorMiddleware=require("./middlewares/error-middleware");
const bodyParser = require('body-parser');
// let's tackle cors

const  corOptions = {
    origin : "http://localhost:5173",
    methods:"GET, POST,PUT , DELETE , PATCH , HEAD ",
    credentials : true ,
};
const port = 5000;

app.use(bodyParser.json());

app.use(cors(corOptions));
app.use(express.json());
app.use(cookieParser());
app.use("/api/auth",authRoute);
app.use("/api/form",contactRoute);
app.use(errorMiddleware);

const PORT=process.env.PORT || 5000;
connectDb().then(()=>{
    app.listen(PORT,()=>{
        console.log('Server is running at port:',PORT);
    });
});
