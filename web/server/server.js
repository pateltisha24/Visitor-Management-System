require('dotenv').config();
const path = require('path');
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const mongoose = require('mongoose');
const cookieParser = require('cookie-parser');

const authRoute = require('./router/auth-router');
const contactRoute = require('./router/contact-router');
const analyticsRoute = require('./router/analytics-router');
const ingestRoute = require('./router/ingest-router');
const insightsRoute = require('./router/insights-router');
const cronRoute = require('./router/cron-router');
const connectDb = require('./utils/db');
const errorMiddleware = require('./middlewares/error-middleware');

const app = express();
const port = process.env.PORT || 5000;

// Behind Vercel's proxy, trust X-Forwarded-* so rate-limiting sees real IPs.
app.set('trust proxy', 1);

// Secure HTTP headers. Allow cross-origin resource use since the client is on a
// different origin and this is a JSON API.
app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));

// CORS: allow the configured client origin(s) plus local dev. Auth is sent via
// the Authorization header (not cookies), so credentials are not required.
// Set CLIENT_URL to a comma-separated list of allowed origins in production.
const allowedOrigins = (process.env.CLIENT_URL || '')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean)
    .concat(['http://localhost:5173', 'http://localhost:5174']);

const isLocalhost = (origin) => /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin);

const corsOptions = {
    origin: (origin, callback) => {
        // Allow non-browser clients (no origin), any whitelisted origin, and any
        // localhost port (dev convenience, regardless of which port Vite picks).
        if (!origin || allowedOrigins.includes(origin) || isLocalhost(origin)) return callback(null, true);
        // If no CLIENT_URL is configured, fall back to allowing all.
        if (!process.env.CLIENT_URL) return callback(null, true);
        // Reject without throwing (no 500 on preflight; browser just blocks it).
        return callback(null, false);
    },
    methods: 'GET,POST,PUT,DELETE,PATCH,HEAD,OPTIONS',
    allowedHeaders: ['Content-Type', 'Authorization', 'x-api-key'],
};

app.use(cors(corsOptions));
app.use(express.json({ limit: '256kb' }));
app.use(cookieParser());

// Rate limiting. Note: on serverless the in-memory store is per-instance; a
// shared store (e.g. Mongo/Upstash) would be needed for strict global limits.
const apiLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 300, standardHeaders: true, legacyHeaders: false });
const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 50, standardHeaders: true, legacyHeaders: false, message: { message: "Too many attempts, please try again later." } });

app.use('/api', apiLimiter);

// Routes (stricter limiter on auth to slow brute-force).
app.use('/api/auth', authLimiter, authRoute);
app.use('/api/form', contactRoute);
app.use('/api', analyticsRoute);
app.use('/api', ingestRoute);
app.use('/api', insightsRoute);
app.use('/api', cronRoute);

// Serve the built React client (copied into ./public at build time) so the API
// and the SPA are one deployment on a single origin.
const publicDir = path.join(__dirname, 'public');
app.use(express.static(publicDir));

// SPA fallback: any non-/api GET that isn't a static file returns index.html.
app.get(/^(?!\/api).*/, (req, res, next) => {
    res.sendFile(path.join(publicDir, 'index.html'), (err) => {
        if (err) next();
    });
});

// Error handling middleware (must be last)
app.use(errorMiddleware);

// MongoDB connection logging
mongoose.connection.on('connected', () => console.log('MongoDB connected successfully'));
mongoose.connection.on('error', (err) => console.error(`MongoDB connection error: ${err.message}`));

// Start the server locally. On Vercel the exported app is used instead.
if (require.main === module) {
    connectDb().then(() => {
        app.listen(port, () => console.log(`Server is running at port: ${port}`));
    });
} else {
    // Serverless (Vercel): establish the DB connection on cold start.
    connectDb();
}

module.exports = app;
