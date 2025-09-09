const { BotService } = require('@src/services/botService');
const Setting = require('@src/models/Setting');

async function restartBot(req, res) {
  try {
    const settings = await Setting.findOne({}).lean();
    await BotService.reconfigure(settings || null);
    res.json({ data: { restarted: true, hasTokens: !!(settings && settings.telegramBotToken && settings.telegramProviderToken) } });
  } catch (err) {
    res.status(500).json({ error: { message: err && err.message ? err.message : 'Failed to restart bot' } });
  }
}

module.exports = { restartBot };
