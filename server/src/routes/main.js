const express = require('express');
const { getSettings, updateSettings } = require('@src/controllers/settingsController');
const { listPayments, getStats } = require('@src/controllers/paymentsController');

const router = express.Router();

// Example routes
router.get('/hello', (req, res) => {
  res.json({ message: 'Hello from API!' });
});

router.get('/status', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Settings
router.get('/settings', getSettings);
router.put('/settings', updateSettings);

// Payments
router.get('/payments', listPayments);

// Stats
router.get('/stats', getStats);

module.exports = router;
