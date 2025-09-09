const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const morgan = require('morgan');
const helmet = require('helmet');
const mongoose = require('mongoose');

const apiRoutes = require('@src/routes/main');

const app = express();

// Middlewares
app.use(helmet());
app.use(cors());
app.use(bodyParser.json({ limit: '1mb' }));
app.use(morgan('dev'));

// MongoDB connection
(async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    // Connected successfully
    console.log('[MongoDB] Connected successfully');
  } catch (err) {
    console.error('[MongoDB] Connection error:', err && err.message ? err.message : err);
  }
})();

// Routes
app.use('/api', apiRoutes);

// 404 handler
app.use((req, res, next) => {
  res.status(404).json({
    error: {
      message: 'Route not found',
      path: req.originalUrl,
    },
  });
});

// Error handler
app.use((err, req, res, next) => {
  const status = err && err.status ? err.status : 500;
  res.status(status).json({
    error: {
      message: err && err.message ? err.message : 'Internal Server Error',
      stack: err && err.stack ? err.stack : undefined,
    },
  });
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`[Server] Listening on port ${PORT}`);
});

module.exports = app;
