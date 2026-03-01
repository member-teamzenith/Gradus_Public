const express = require('express');
const cors = require('cors');
const { admin, db } = require("./firebase.js");
const { YouTube } = require('youtube-sr');
const { router } = require('./useRouter/useRouter.js');
require('dotenv').config();
//testing git user name and email change

const app = express();
const PORT = process.env.PORT || 4000;

// Use CORS middleware
app.use(cors({
  origin: [
    'https://gradus-frontend.vercel.app',
    'http://localhost:3000',
    'https://www.gradus-zenith.tech',
    `chrome-extension://${process.env.CHROME_EXTENSION_ID}`
  ],
  methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
  credentials: true,
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// Increase body size limits to handle large transcripts/summaries
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

const { uploadRouter } = require('./Routes/upload.js');

app.use('/', router);
app.use('/', uploadRouter);

app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Cache for storing video results
const cache = new Map();
const CACHE_DURATION = 1000 * 60 * 60;

app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({
    error: process.env.NODE_ENV === 'production'
      ? 'Internal server error'
      : err.message
  });
});

app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});