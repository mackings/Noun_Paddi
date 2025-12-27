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

// Enable CORS
// Enable CORS
app.use(cors({
  origin: ['http://localhost:3000', 'http://localhost:3001', 'http://192.168.108.10:3000'],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));


// Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/faculties', require('./routes/faculty'));
app.use('/api/departments', require('./routes/department'));
app.use('/api/courses', require('./routes/course'));
app.use('/api/materials', require('./routes/material'));
app.use('/api/questions', require('./routes/question'));
app.use('/api/stats', require('./routes/stats'));

// Root route
app.get('/', (req, res) => {
  res.json({
    success: true,
    message: 'NounPaddi API is running',
  });
});

const PORT = process.env.PORT || 5001;

app.listen(PORT, () => {
  console.log(`Server running in ${process.env.NODE_ENV} mode on port ${PORT}`);
});
