const mongoose = require('mongoose');

const SettingSchema = new mongoose.Schema(
  {
    telegramBotToken: { type: String, default: '' },
    telegramProviderToken: { type: String, default: '' },
    currency: { type: String, default: 'RUB' },
    priceAmount: { type: Number, default: 100 }, // minimal units
    paymentTitle: { type: String, default: 'Оплата' },
    paymentDescription: { type: String, default: 'Оплата через Telegram' },
    successMessage: { type: String, default: 'Оплата успешно получена!' },
    updatedAt: { type: Date },
  },
  { collection: 'settings' }
);

SettingSchema.pre('save', function (next) {
  this.updatedAt = new Date();
  next();
});

module.exports = mongoose.model('Setting', SettingSchema);
