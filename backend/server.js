const express = require('express');
const dotenv = require('dotenv');
const cors = require('cors');
const connectDB = require('./config/db');

// Load env vars
dotenv.config();

// Connect to database
connectDB();

const app = express();

// Body parser middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const normalizeOrigin = (value) => String(value || '').trim().replace(/\/+$/, '');

const configuredOrigins = [
  process.env.FRONTEND_URL,
  ...(process.env.CORS_ORIGINS || '').split(','),
  'https://paddi.com.ng',
  'https://www.paddi.com.ng',
].filter(Boolean).map(normalizeOrigin);

const allowedOrigins = new Set(configuredOrigins);

// Enable CORS - Allow all Vercel deployments and localhost
const corsOptions = {
  origin: function(origin, callback) {
    const normalizedOrigin = normalizeOrigin(origin);

    // Allow requests with no origin (like mobile apps, curl, or Postman)
    if (!origin) return callback(null, true);

    // Allow localhost origins
    if (origin.includes('localhost') || origin.includes('127.0.0.1')) {
      return callback(null, true);
    }

    // Allow all Vercel deployments (*.vercel.app)
    if (origin.includes('vercel.app')) {
      return callback(null, true);
    }

    // Allow custom frontend URL from env
    if (allowedOrigins.has(normalizedOrigin)) {
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
app.use('/api/reminders', require('./routes/readingReminder'));
app.use('/api/plagiarism', require('./routes/plagiarism'));
app.use('/api/projects', require('./routes/project'));
app.use('/api/reviews', require('./routes/review'));
app.use('/api/share', require('./routes/share'));
app.use('/api/analytics', require('./routes/analytics'));

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
  app.listen(PORT, () => {
    console.log(`Server running in ${process.env.NODE_ENV} mode on port ${PORT}`);
  });
}

// Export for Vercel serverless functions
module.exports = app;
