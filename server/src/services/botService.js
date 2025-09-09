const dayjs = require('dayjs');
const TelegramBot = require('node-telegram-bot-api');
const Setting = require('@src/models/Setting');
const Payment = require('@src/models/Payment');

let bot = null;
let isRunning = false;
let isStarting = false;
let cachedSettings = null;

function hasValidTokens(settings) {
  if (!settings) return false;
  const a = settings.telegramBotToken && typeof settings.telegramBotToken === 'string' && settings.telegramBotToken.trim().length > 0;
  const b = settings.telegramProviderToken && typeof settings.telegramProviderToken === 'string' && settings.telegramProviderToken.trim().length > 0;
  return !!(a && b);
}

function applyPlaceholders(template, amountMinor, currency) {
  try {
    if (!template || typeof template !== 'string') return '';
    const amountHuman = (Math.round(Number(amountMinor)) / 100).toFixed(2);
    let out = template;
    if (out.indexOf('{amount}') !== -1) {
      out = out.split('{amount}').join(String(amountHuman));
    }
    if (out.indexOf('{currency}') !== -1) {
      out = out.split('{currency}').join(String(currency || ''));
    }
    return out;
  } catch (e) {
    return template;
  }
}

async function loadSettings() {
  const doc = await Setting.findOne({}).lean();
  cachedSettings = doc || null;
  return cachedSettings;
}

async function handleStartCommand(msg) {
  try {
    const chatId = msg.chat && msg.chat.id ? msg.chat.id : null;
    if (!chatId) return;
    const text = 'Welcome!\nUse /pay to get an invoice and complete the payment.';
    await bot.sendMessage(chatId, text);
  } catch (err) {
    console.error('[BotService] /start error:', err && err.message ? err.message : err);
  }
}

async function handlePayCommand(msg) {
  try {
    const settings = cachedSettings || (await loadSettings());
    const chatId = msg.chat && msg.chat.id ? msg.chat.id : null;
    const userId = msg.from && msg.from.id ? msg.from.id : null;

    if (!chatId) return;

    if (!hasValidTokens(settings)) {
      await bot.sendMessage(chatId, 'Bot is not configured. Please set tokens in settings.');
      return;
    }

    const now = dayjs();
    const activePending = await Payment.findOne({ chatId, status: 'pending', expiresAt: { $gt: now.toDate() } }).lean();
    if (activePending) {
      await bot.sendMessage(chatId, 'You already have an active pending payment. Please complete it or wait until it expires.');
      return;
    }

    const payload = `${Date.now()}_${Math.random().toString(36).slice(2)}`;
    const expiresAt = now.add(10, 'minute').toDate();

    const payment = await Payment.create({
      chatId,
      userId,
      payload,
      status: 'pending',
      expiresAt,
      title: settings.title,
      description: settings.description,
      currency: settings.currency,
      amount: settings.amount,
    });

    const prices = [{ label: settings.title || 'Payment', amount: settings.amount }];

    const message = await bot.sendInvoice(
      chatId,
      settings.title || 'Payment',
      settings.description || 'Pay for the service',
      payment.payload,
      settings.telegramProviderToken,
      'pay',
      settings.currency || 'RUB',
      prices,
      {
        need_name: false,
        need_phone_number: false,
      }
    );

    if (message && message.message_id) {
      await Payment.updateOne({ _id: payment._id }, { $set: { invoiceMessageId: message.message_id, updatedAt: new Date() } });
    }
  } catch (err) {
    console.error('[BotService] /pay error:', err && err.message ? err.message : err);
  }
}

async function handleSuccessfulPayment(msg) {
  try {
    const sp = msg.successful_payment;
    if (!sp) return;

    const payload = sp.invoice_payload;
    const chatId = msg.chat && msg.chat.id ? msg.chat.id : null;

    if (!payload || !chatId) return;

    const payment = await Payment.findOne({ payload });
    if (!payment) {
      await bot.sendMessage(chatId, 'Payment record was not found.');
      return;
    }

    if (String(payment.chatId) !== String(chatId)) {
      await bot.sendMessage(chatId, 'Payment does not belong to this chat.');
      return;
    }

    if (payment.status === 'expired') {
      await bot.sendMessage(chatId, 'Payment expired. Please create a new one with /pay.');
      return;
    }

    if (payment.status === 'succeeded') {
      await bot.sendMessage(chatId, 'Payment already confirmed.');
      return;
    }

    const settings = cachedSettings || (await loadSettings());

    payment.status = 'succeeded';
    payment.providerPaymentChargeId = sp.provider_payment_charge_id || '';
    payment.telegramPaymentChargeId = sp.telegram_payment_charge_id || '';
    payment.updatedAt = new Date();
    await payment.save();

    const template = settings && settings.successMessage ? settings.successMessage : 'Payment received: {amount} {currency}. Thank you!';
    const text = applyPlaceholders(template, payment.amount || (settings && settings.amount) || 0, payment.currency || (settings && settings.currency) || '');
    await bot.sendMessage(chatId, text);
  } catch (err) {
    console.error('[BotService] successful_payment error:', err && err.message ? err.message : err);
  }
}

async function start() {
  if (isRunning || isStarting) return;
  try {
    isStarting = true;
    const settings = cachedSettings || (await loadSettings());
    if (!hasValidTokens(settings)) {
      console.log('[BotService] Bot not started: invalid or missing tokens');
      isStarting = false;
      return;
    }

    bot = new TelegramBot(settings.telegramBotToken, { polling: true });

    bot.on('message', async (msg) => {
      try {
        if (!msg || !msg.text) {
          if (msg && msg.successful_payment) {
            await handleSuccessfulPayment(msg);
          }
          return;
        }

        const text = msg.text.trim();
        if (text === '/start') {
          await handleStartCommand(msg);
          return;
        }
        if (text === '/pay') {
          await handlePayCommand(msg);
          return;
        }

        if (msg.successful_payment) {
          await handleSuccessfulPayment(msg);
        }
      } catch (error) {
        console.error('[BotService] message handler error:', error && error.message ? error.message : error);
      }
    });

    bot.on('pre_checkout_query', async (query) => {
      try {
        await bot.answerPreCheckoutQuery(query.id, true);
      } catch (error) {
        console.error('[BotService] pre_checkout_query error:', error && error.message ? error.message : error);
      }
    });

    isRunning = true;
    console.log('[BotService] Bot started with polling');
  } catch (err) {
    console.error('[BotService] start error:', err && err.message ? err.message : err);
  } finally {
    isStarting = false;
  }
}

async function stop() {
  try {
    if (bot) {
      await bot.stopPolling();
      bot = null;
    }
    isRunning = false;
    console.log('[BotService] Bot stopped');
  } catch (err) {
    console.error('[BotService] stop error:', err && err.message ? err.message : err);
  }
}

async function init() {
  try {
    await loadSettings();
    if (hasValidTokens(cachedSettings)) {
      await start();
    } else {
      console.log('[BotService] Bot not initialized: tokens not configured');
    }
  } catch (err) {
    console.error('[BotService] init error:', err && err.message ? err.message : err);
  }
}

async function reconfigure(newSettings) {
  try {
    cachedSettings = newSettings || (await loadSettings());
    if (!hasValidTokens(cachedSettings)) {
      if (isRunning) {
        await stop();
      }
      console.log('[BotService] Reconfigure: tokens missing, bot is not running');
      return;
    }
    if (isRunning) {
      await stop();
    }
    await start();
  } catch (err) {
    console.error('[BotService] reconfigure error:', err && err.message ? err.message : err);
  }
}

module.exports = {
  BotService: {
    init,
    start,
    stop,
    reconfigure,
  },
};
