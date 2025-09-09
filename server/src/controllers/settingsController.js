const Setting = require('@src/models/Setting');
const { BotService } = require('@src/services/botService');

function isUppercaseCurrency(str) {
  if (!str || typeof str !== 'string') return false;
  if (str.length !== 3) return false;
  for (let i = 0; i < 3; i += 1) {
    const c = str.charCodeAt(i);
    if (c < 65 || c > 90) return false; // A-Z only
  }
  return true;
}

async function getSettings(req, res) {
  try {
    const doc = await Setting.findOne({});
    res.json({ data: doc });
  } catch (err) {
    res.status(500).json({ error: { message: err && err.message ? err.message : 'Failed to get settings' } });
  }
}

async function updateSettings(req, res) {
  try {
    const body = req.body || {};

    const update = {};

    // Trim string fields before saving
    if (typeof body.telegramBotToken === 'string') update.telegramBotToken = body.telegramBotToken.trim();
    if (typeof body.telegramProviderToken === 'string') update.telegramProviderToken = body.telegramProviderToken.trim();
    if (typeof body.title === 'string') update.title = body.title.trim();
    if (typeof body.description === 'string') update.description = body.description.trim();
    if (typeof body.currency === 'string') {
      const cur = body.currency.trim().toUpperCase();
      if (!isUppercaseCurrency(cur)) {
        return res.status(400).json({ error: { message: 'currency must be 3 uppercase letters (e.g., RUB, USD, EUR)' } });
      }
      update.currency = cur;
    }
    if (typeof body.successMessage === 'string') update.successMessage = body.successMessage.trim();

    if (body.amount !== undefined) {
      const num = Number(body.amount);
      if (!Number.isFinite(num) || num <= 0) {
        return res.status(400).json({ error: { message: 'amount must be a positive number of minor currency units' } });
      }
      const rounded = Math.round(num);
      if (rounded <= 0) {
        return res.status(400).json({ error: { message: 'amount must be > 0 after rounding' } });
      }
      update.amount = rounded; // store as integer minor units
    }

    const saved = await Setting.findOneAndUpdate({}, { $set: update }, { new: true, upsert: true, setDefaultsOnInsert: true });

    try {
      await BotService.reconfigure(saved.toObject());
    } catch (e) {
      // Do not crash on reconfigure, but report exact error to logs
      console.error('[settingsController] reconfigure error:', e && e.message ? e.message : e);
    }

    res.json({ data: saved });
  } catch (err) {
    res.status(500).json({ error: { message: err && err.message ? err.message : 'Failed to update settings' } });
  }
}

module.exports = { getSettings, updateSettings };
