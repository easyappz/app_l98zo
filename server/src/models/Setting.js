const mongoose = require('mongoose');

const SettingSchema = new mongoose.Schema(
  {
    telegramBotToken: { type: String, default: '' },
    telegramProviderToken: { type: String, default: '' },
    title: { type: String, default: 'Payment' },
    description: { type: String, default: 'Pay for the service' },
    currency: { type: String, default: 'RUB' },
    amount: { type: Number, default: 10000 }, // in minor units (e.g., kopeks)
    successMessage: { type: String, default: 'Payment received: {amount} {currency}. Thank you!' },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Setting', SettingSchema);
