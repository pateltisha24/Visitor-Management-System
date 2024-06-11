require('dotenv').config();
const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const cookieParser = require('cookie-parser');
const bodyParser = require('body-parser');

const authRoute = require('./router/auth-router');
const contactRoute = require('./router/contact-router');
const Client1 = require('./models/client1');
const connectDb = require('./utils/db');
const errorMiddleware = require('./middlewares/error-middleware');

const app = express();
const port = process.env.PORT || 5000;

// CORS configuration
const corOptions = {
    origin: 'http://localhost:5173',
    methods: 'GET, POST, PUT, DELETE, PATCH, HEAD',
    credentials: true,
};

// Middleware setup
app.use(bodyParser.json());
app.use(cors(corOptions));
app.use(express.json());
app.use(cookieParser());

// Routes
app.use('/api/auth', authRoute);
app.use('/api/form', contactRoute);

// Charts data endpoint
app.get('/api/data', async (req, res) => {
    try {
        const { date } = req.query;
        let filter = {};
        if (date) {
            filter = { Date: date };
        }
        const data = await Client1.find(filter);
        res.json(data);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// Error handling middleware
app.use(errorMiddleware);

// Connect to the database and start the server
connectDb().then(() => {
    app.listen(port, () => {
        console.log(`Server is running at port: ${port}`);
    });
}).catch((error) => {
    console.error('Failed to connect to the database:', error.message);
});

// Additional MongoDB connection error handling
mongoose.connection.on('connected', () => {
    console.log('MongoDB connected successfully');
});
mongoose.connection.on('error', (err) => {
    console.error(`MongoDB connection error: ${err.message}`);
});
module.exports = app;