const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const dotenv = require('dotenv');
const path = require('path');
const connectDB = require('./config/Db');
// const leetcodeRoutes = require("./routes/leetcode");
// const Leetcode from 'leetcode-api';

const Leetcode = require('./routes/leetcode');

// Load environment variables
dotenv.config({ path: './.env' });

const app = express();
// Connect to MongoDB
connectDB();

// CORS Configuration
const configuredOrigins = [
  process.env.FRONTEND_URL,
  process.env.FRONTEND_URLS,
  process.env.CLIENT_URL,
  process.env.FRONTEND_ORIGIN,
]
  .filter(Boolean)
  .flatMap((value) => value.split(','))
  .map((value) => value.trim().replace(/\/$/, ''))
  .filter(Boolean);

const corsOptions = {
  origin: function (origin, callback) {
    const allowedOrigins = [
      ...configuredOrigins,
      'https://dsa.shushantku.me',
      'https://dsa-tracker-frontend-6lun.onrender.com',
      'http://localhost:5173',
    'https://dsa-tracker-frontend-tau.vercel.app',
    'https://dsa.shushantku.me'
    ].filter((value, index, origins) => origins.indexOf(value) === index);
    
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);
    
    if (allowedOrigins.includes(origin.replace(/\/$/, ''))) {
      callback(null, true);
    } else {
      console.log('Blocked by CORS:', origin);
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept'],
  exposedHeaders: ['Content-Length', 'X-JSON'],
  preflightContinue: false,
  optionsSuccessStatus: 204
};

// Apply CORS middleware BEFORE other middleware
app.use(cors(corsOptions));



app.use(express.json());

// Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/questions', require('./routes/questions'));
app.use('/api/user', require('./routes/user'));
app.use("/api/leetcode",Leetcode);
app.use("/api/codeforce",require('./routes/codeforces'));

//start version2 


// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ message: 'DSA Tracker API is running!' });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ message: 'Something went wrong!' });
});



const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
