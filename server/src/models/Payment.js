const mongoose = require('mongoose');

const PaymentSchema = new mongoose.Schema(
  {
    chatId: { type: Number, required: true },
    userId: { type: Number },
    payload: { type: String, required: true, unique: true },
    status: { type: String, enum: ['pending', 'succeeded', 'expired', 'failed'], default: 'pending' },
    title: { type: String },
    description: { type: String },
    currency: { type: String },
    amount: { type: Number },
    invoiceMessageId: { type: Number },
    providerPaymentChargeId: { type: String },
    telegramPaymentChargeId: { type: String },
    expiresAt: { type: Date, required: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Payment', PaymentSchema);
