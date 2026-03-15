const express = require('express');
const dotenv = require('dotenv');
const cors = require('cors');
const helmet = require('helmet');
const cookieParser = require('cookie-parser');
const connectDB = require('./config/db');
const { startBroadcastScheduler } = require('./utils/broadcastScheduler');

// Load env vars
dotenv.config();

// Connect to database
connectDB();

const app = express();
app.disable('x-powered-by');

// Body parser middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginEmbedderPolicy: false,
  hsts: process.env.NODE_ENV === 'production',
}));

const normalizeOrigin = (value) => String(value || '').trim().replace(/\/+$/, '');
const getHostname = (value) => {
  try {
    return new URL(value).hostname.toLowerCase();
  } catch {
    return '';
  }
};

const configuredOrigins = [
  process.env.FRONTEND_URL,
  ...(process.env.CORS_ORIGINS || '').split(','),
  'https://nounpaddi.vercel.app',
  'https://www.nounpaddi.vercel.app',
  'https://paddi.com.ng',
  'https://www.paddi.com.ng',
].filter(Boolean).map(normalizeOrigin);

const allowedOrigins = new Set(configuredOrigins);
const allowedHostnames = new Set(
  configuredOrigins
    .map((origin) => getHostname(origin))
    .filter(Boolean)
);
const allowVercelPreviews = String(process.env.ALLOW_VERCEL_PREVIEWS || '').toLowerCase() === 'true';
const trustedVercelHostPatterns = [
  /^nounpaddi(?:-[a-z0-9-]+)?\.vercel\.app$/i,
  /^noun-paddi(?:-[a-z0-9-]+)?\.vercel\.app$/i,
];

// Enable CORS - Allow all Vercel deployments and localhost
const corsOptions = {
  origin: function(origin, callback) {
    const normalizedOrigin = normalizeOrigin(origin);
    const hostname = getHostname(origin);

    // Allow requests with no origin (like mobile apps, curl, or Postman)
    if (!origin) return callback(null, true);

    // Allow localhost origins
    if (hostname === 'localhost' || hostname === '127.0.0.1') {
      return callback(null, true);
    }

    // Allow Vercel preview deployments only when explicitly enabled.
    if (allowVercelPreviews && (hostname === 'vercel.app' || hostname.endsWith('.vercel.app'))) {
      return callback(null, true);
    }

    // Allow this project's Vercel production/preview frontends even if env vars are missing.
    if (trustedVercelHostPatterns.some((pattern) => pattern.test(hostname))) {
      return callback(null, true);
    }

    // Allow exact custom frontend URL from env
    if (allowedOrigins.has(normalizedOrigin)) {
      return callback(null, true);
    }

    // Also allow by hostname to handle apex/www origin variations.
    if (allowedHostnames.has(hostname)) {
      return callback(null, true);
    }

    // Allow local network IPs (192.168.x.x, 10.x.x.x, 172.16-31.x.x)
    const localNetworkPattern = /^https?:\/\/(192\.168\.\d{1,3}\.\d{1,3}|10\.\d{1,3}\.\d{1,3}\.\d{1,3}|172\.(1[6-9]|2\d|3[01])\.\d{1,3}\.\d{1,3})(:\d+)?$/;
    if (localNetworkPattern.test(origin)) {
      return callback(null, true);
    }

    const msg = 'The CORS policy for this site does not allow access from the specified Origin: ' + origin;
    return callback(new Error(msg), false);
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept'],
  exposedHeaders: ['Content-Length', 'X-Request-Id'],
  maxAge: 86400, // 24 hours
  preflightContinue: false,
  optionsSuccessStatus: 204
};

app.use(cors(corsOptions));

// Handle preflight OPTIONS requests
app.options('*', cors(corsOptions));


// Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/users', require('./routes/user'));
app.use('/api/faculties', require('./routes/faculty'));
app.use('/api/departments', require('./routes/department'));
app.use('/api/courses', require('./routes/course'));
app.use('/api/admin', require('./routes/admin'));
app.use('/api/materials', require('./routes/material'));
app.use('/api/questions', require('./routes/question'));
app.use('/api/stats', require('./routes/stats'));
app.use('/api/it-placement', require('./routes/itPlacement'));
app.use('/api/leaderboard', require('./routes/leaderboard'));
app.use('/api/gamification', require('./routes/gamification'));
app.use('/api/reminders', require('./routes/readingReminder'));
app.use('/api/plagiarism', require('./routes/plagiarism'));
app.use('/api/projects', require('./routes/project'));
app.use('/api/reviews', require('./routes/review'));
app.use('/api/share', require('./routes/share'));
app.use('/api/analytics', require('./routes/analytics'));
app.use('/api/push', require('./routes/push'));
app.use('/api/ask', require('./routes/ask'));

// Root route
app.get('/', (req, res) => {
  res.json({
    success: true,
    message: 'NounPaddi API is running',
  });
});

const PORT = process.env.PORT || 5001;

// Only start server if not in Vercel serverless environment
if (process.env.NODE_ENV !== 'production' || !process.env.VERCEL) {
  startBroadcastScheduler();
  app.listen(PORT, () => {
    console.log(`Server running in ${process.env.NODE_ENV} mode on port ${PORT}`);
  });
} else {
  console.warn('[broadcast-scheduler] Not started in Vercel serverless production runtime.');
}

// Export for Vercel serverless functions
module.exports = app;
