const Setting = require('@src/models/Setting');

// Helper: apply updates with basic type checks
function applySettingUpdates(setting, payload) {
  if (!payload || typeof payload !== 'object') return setting;

  const {
    telegramBotToken,
    telegramProviderToken,
    currency,
    priceAmount,
    paymentTitle,
    paymentDescription,
    successMessage,
  } = payload;

  if (typeof telegramBotToken === 'string') setting.telegramBotToken = telegramBotToken;
  if (typeof telegramProviderToken === 'string') setting.telegramProviderToken = telegramProviderToken;
  if (typeof currency === 'string' && currency.trim()) setting.currency = currency.trim().toUpperCase();

  if (priceAmount !== undefined) {
    if (typeof priceAmount !== 'number' || !Number.isInteger(priceAmount) || priceAmount < 1) {
      const err = new Error('priceAmount must be a positive integer (minimal currency units).');
      err.status = 400;
      throw err;
    }
    setting.priceAmount = priceAmount;
  }

  if (typeof paymentTitle === 'string') setting.paymentTitle = paymentTitle;
  if (typeof paymentDescription === 'string') setting.paymentDescription = paymentDescription;
  if (typeof successMessage === 'string') setting.successMessage = successMessage;

  return setting;
}

async function getSettings(req, res) {
  try {
    let setting = await Setting.findOne();
    if (!setting) {
      setting = new Setting({});
      await setting.save();
    }
    return res.json({ data: setting });
  } catch (err) {
    return res.status(err.status || 500).json({ error: { message: err.message, stack: err.stack } });
  }
}

async function updateSettings(req, res) {
  try {
    let setting = await Setting.findOne();
    if (!setting) setting = new Setting({});

    applySettingUpdates(setting, req.body);
    await setting.save();

    return res.json({ data: setting });
  } catch (err) {
    return res.status(err.status || 500).json({ error: { message: err.message, stack: err.stack } });
  }
}

module.exports = {
  getSettings,
  updateSettings,
};
