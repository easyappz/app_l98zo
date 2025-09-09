const Setting = require('@src/models/Setting');
const { BotService } = require('@src/services/botService');

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
    if (typeof body.telegramBotToken === 'string') update.telegramBotToken = body.telegramBotToken;
    if (typeof body.telegramProviderToken === 'string') update.telegramProviderToken = body.telegramProviderToken;
    if (typeof body.title === 'string') update.title = body.title;
    if (typeof body.description === 'string') update.description = body.description;
    if (typeof body.currency === 'string') update.currency = body.currency;
    if (typeof body.successMessage === 'string') update.successMessage = body.successMessage;
    if (body.amount !== undefined) {
      const num = Number(body.amount);
      if (!Number.isFinite(num) || num <= 0) {
        return res.status(400).json({ error: { message: 'amount must be a positive number of minor currency units' } });
      }
      update.amount = Math.round(num);
    }

    const saved = await Setting.findOneAndUpdate({}, { $set: update }, { new: true, upsert: true, setDefaultsOnInsert: true });

    try {
      await BotService.reconfigure(saved.toObject());
    } catch (e) {
      // Do not crash on reconfigure
      console.error('[settingsController] reconfigure error:', e && e.message ? e.message : e);
    }

    res.json({ data: saved });
  } catch (err) {
    res.status(500).json({ error: { message: err && err.message ? err.message : 'Failed to update settings' } });
  }
}

module.exports = { getSettings, updateSettings };
