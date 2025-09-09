const mongoose = require('mongoose');

const PaymentSchema = new mongoose.Schema(
  {
    chatId: { type: String, required: true },
    status: {
      type: String,
      enum: ['pending', 'succeeded', 'canceled', 'expired'],
      default: 'pending',
    },
    currency: { type: String },
    amount: { type: Number },
    payload: { type: String },
    title: { type: String },
    description: { type: String },
    providerPaymentChargeId: { type: String },
    telegramPaymentChargeId: { type: String },
    invoiceMessageId: { type: Number },
    createdAt: { type: Date, default: Date.now },
    expiresAt: { type: Date, default: () => new Date(Date.now() + 10 * 60 * 1000) },
    updatedAt: { type: Date },
  },
  { collection: 'payments' }
);

PaymentSchema.index({ createdAt: -1 });
PaymentSchema.index({ status: 1 });

PaymentSchema.pre('save', function (next) {
  this.updatedAt = new Date();
  next();
});

module.exports = mongoose.model('Payment', PaymentSchema);
