const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const dotenv = require('dotenv');
const path = require('path');
// const leetcodeRoutes = require("./routes/leetcode");
// const Leetcode from 'leetcode-api';

const Leetcode = require('./routes/leetcode');

// Load environment variables
dotenv.config({ path: './.env' });

const app = express();

// CORS Configuration
const corsOptions = {
  origin: [
    'https://dsa-tracker-frontemd.onrender.com',
    // 'https://dsa-tracker-frontend.onrender.com',
    'http://localhost:5173',
    'http://localhost:3000'
  ],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept'],
  optionsSuccessStatus: 200
};

// Apply CORS middleware
app.use(cors(corsOptions));

// Handle preflight for all routes
app.options('*', cors(corsOptions));

app.use(express.json());

// Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/questions', require('./routes/questions'));
app.use('/api/user', require('./routes/user'));
app.use("/api/leetcode",Leetcode);
app.use("/api/codeforce",require('./routes/codeforces'));

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ message: 'DSA Tracker API is running!' });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ message: 'Something went wrong!' });
});

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/dsa-tracker')
  .then(() => {
    console.log('Connected to MongoDB');
  })
  .catch((error) => {
    console.error('MongoDB connection error:', error);
  });

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
