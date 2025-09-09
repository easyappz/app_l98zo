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
      out = out.split('{currency}').join(String((currency || '').toString().toUpperCase()));
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

// Sanitization helpers for Telegram invoice fields.
// We do not use RegExp. We only allow: latin/cyrillic letters, digits, space, hyphen, dot, comma, colon, underscore.
function isUppercaseCurrency(str) {
  if (!str || typeof str !== 'string') return false;
  if (str.length !== 3) return false;
  for (let i = 0; i < 3; i += 1) {
    const c = str.charCodeAt(i);
    if (c < 65 || c > 90) return false; // A-Z only
  }
  return true;
}

function isAllowedChar(ch) {
  if (!ch) return false;
  const code = ch.charCodeAt(0);
  // space
  if (code === 0x20) return true;
  // digits 0-9
  if (code >= 0x30 && code <= 0x39) return true;
  // latin A-Z a-z
  if ((code >= 0x41 && code <= 0x5a) || (code >= 0x61 && code <= 0x7a)) return true;
  // punctuation: hyphen, dot, comma, colon, underscore
  if (code === 0x2d || code === 0x2e || code === 0x2c || code === 0x3a || code === 0x5f) return true;
  // cyrillic ranges (basic + extended)
  if ((code >= 0x0400 && code <= 0x04ff) || (code >= 0x0500 && code <= 0x052f)) return true;
  return false;
}

function sanitizeInvoiceText(input, fallback) {
  try {
    const src = typeof input === 'string' ? input : '';
    const maxLen = 32;
    let out = '';
    for (let i = 0; i < src.length && out.length < maxLen; i += 1) {
      const ch = src[i];
      const code = ch.charCodeAt(0);
      // Convert new lines to space; skip other control chars
      if (code === 0x0a || code === 0x0d) { // \n or \r
        if (out.length === 0 || out[out.length - 1] !== ' ') out += ' ';
        continue;
      }
      if (code < 0x20) continue; // skip other control characters
      if (isAllowedChar(ch)) {
        out += ch;
      }
      // other characters are skipped
    }
    out = out.trim();
    if (!out) return fallback;
    return out;
  } catch (e) {
    return fallback;
  }
}

function buildTelegramPriceData(settings) {
  // Validate currency strictly: 3 uppercase letters
  const currencyRaw = settings && settings.currency ? String(settings.currency) : '';
  const currency3 = currencyRaw.trim().toUpperCase();
  if (!isUppercaseCurrency(currency3)) {
    const err = new Error('Invalid currency. Must be 3 uppercase letters.');
    err.code = 'VALIDATION_CURRENCY';
    throw err;
  }

  // Validate amount: positive integer in minor units
  const amountNum = Number(settings && settings.amount);
  const amountInt = Math.trunc(amountNum);
  if (!Number.isFinite(amountNum) || amountInt <= 0 || amountNum !== amountInt) {
    const err = new Error('Invalid amount. Must be a positive integer in minor units.');
    err.code = 'VALIDATION_AMOUNT';
    throw err;
  }

  // Sanitize title and label according to Telegram requirements
  const titleSrc = settings && settings.title ? settings.title : 'Payment';
  const title = sanitizeInvoiceText(titleSrc, 'Payment');
  const label = sanitizeInvoiceText(titleSrc, 'Item');

  return { amountInt, currency3, title, label };
}

async function handleStartCommand(msg) {
  try {
    const chatId = msg.chat && msg.chat.id ? msg.chat.id : null;
    if (!chatId) return;
    const text = 'Добро пожаловать!\nНажмите «Оплатить» или отправьте команду /pay, чтобы получить счёт и завершить оплату.';
    const options = { reply_markup: { inline_keyboard: [[{ text: 'Оплатить', callback_data: 'CMD_PAY' }]] } };
    await bot.sendMessage(chatId, text, options);
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

    let amountInt, currency3, label, title;
    try {
      const validated = buildTelegramPriceData(settings);
      amountInt = validated.amountInt;
      currency3 = validated.currency3;
      label = validated.label;
      title = validated.title;
    } catch (valErr) {
      const code = valErr && valErr.code ? valErr.code : '';
      if (code === 'VALIDATION_AMOUNT') {
        await bot.sendMessage(chatId, 'Некорректная сумма. Укажите целое число в минорных единицах (например, копейках) больше 0.');
      } else if (code === 'VALIDATION_CURRENCY') {
        await bot.sendMessage(chatId, 'Некорректная валюта. Используйте 3 заглавные буквы (например, RUB, USD, EUR).');
      } else {
        await bot.sendMessage(chatId, 'Настройки оплаты некорректны. Обратитесь к администратору.');
      }
      return;
    }

    const now = dayjs();
    const activePending = await Payment.findOne({ chatId, status: 'pending', expiresAt: { $gt: now.toDate() } }).lean();
    if (activePending) {
      const text = 'У вас уже есть активная ожидающая оплата. Пожалуйста, завершите её или дождитесь, пока срок действия истечёт.\nЧтобы отменить текущую оплату, нажмите «Отменить» ниже или отправьте /cancel, затем используйте /pay для создания новой оплаты.';
      const options = { reply_markup: { inline_keyboard: [[{ text: 'Отменить', callback_data: 'CMD_CANCEL' }]] } };
      await bot.sendMessage(chatId, text, options);
      return;
    }

    const payload = `${Date.now()}_${Math.random().toString(36).slice(2)}`;
    const expiresAt = now.add(10, 'minute').toDate();

    const invoiceTitle = title; // sanitized and <= 32 chars

    const payment = await Payment.create({
      chatId,
      userId,
      payload,
      status: 'pending',
      expiresAt,
      title: invoiceTitle,
      description: (settings.description || 'Pay for the service'),
      currency: currency3,
      amount: amountInt,
    });

    const prices = [{ label: label, amount: amountInt }];

    // Extended context logging BEFORE sending invoice
    console.log('[BotService] sendInvoice context', {
      chatIdType: typeof chatId,
      currency: currency3,
      currencyType: typeof currency3,
      currencyLen: currency3.length,
      amountInt,
      amountType: typeof amountInt,
      title,
      titleLen: title.length,
      label,
      labelLen: label.length,
      pricesIsArray: Array.isArray(prices),
      pricesLength: prices.length,
      price0Type: typeof prices[0],
      price0AmountType: typeof prices[0].amount,
    });

    try {
      const message = await bot.sendInvoice(
        chatId,
        invoiceTitle,
        (settings.description || 'Pay for the service'),
        payment.payload,
        settings.telegramProviderToken,
        currency3,
        prices,
        {
          start_parameter: 'pay',
          need_name: false,
          need_phone_number: false,
        }
      );

      if (message && message.message_id) {
        await Payment.updateOne({ _id: payment._id }, { $set: { invoiceMessageId: message.message_id, updatedAt: new Date() } });
      }
    } catch (errSend) {
      const context = {
        currency: currency3,
        currencyType: typeof currency3,
        amountInt,
        amountType: typeof amountInt,
        title,
        titleLen: title.length,
        label,
        labelLen: label.length,
        prices: JSON.stringify(prices),
        pricesIsArray: Array.isArray(prices),
      };
      console.error('[BotService] sendInvoice error:', errSend && errSend.message ? errSend.message : errSend, context);
      await bot.sendMessage(
        chatId,
        'Не удалось создать счёт. Проверьте валюту (3 заглавные буквы), сумму (целое число в минорных единицах) и название (до 32 символов, без переводов строк). Администратору: проверьте логи сервера.'
      );
    }
  } catch (err) {
    console.error('[BotService] /pay error:', err && err.message ? err.message : err);
  }
}

async function handleCancelCommand(msg) {
  try {
    const chatId = msg.chat && msg.chat.id ? msg.chat.id : null;
    if (!chatId) return;

    const now = dayjs();
    const activePayments = await Payment.find({ chatId, status: 'pending', expiresAt: { $gt: now.toDate() } }).lean();

    if (!activePayments || activePayments.length === 0) {
      await bot.sendMessage(chatId, 'Активной ожидающей оплаты не найдено.');
      return;
    }

    for (const p of activePayments) {
      if (p && p.invoiceMessageId) {
        try {
          await bot.deleteMessage(chatId, p.invoiceMessageId);
        } catch (delErr) {
          console.error('[BotService] /cancel delete invoice error:', delErr && delErr.message ? delErr.message : delErr);
        }
      }
      try {
        await Payment.updateOne({ _id: p._id }, { $set: { status: 'failed', updatedAt: new Date() } });
      } catch (updErr) {
        console.error('[BotService] /cancel update payment error:', updErr && updErr.message ? updErr.message : updErr);
      }
    }

    await bot.sendMessage(chatId, 'Текущая оплата отменена. Вы можете вызвать /pay для новой оплаты.');
  } catch (err) {
    console.error('[BotService] /cancel error:', err && err.message ? err.message : err);
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
    const text = applyPlaceholders(template, payment.amount || (settings && settings.amount) || 0, (payment.currency || (settings && settings.currency) || ''));
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
        if (text === '/cancel') {
          await handleCancelCommand(msg);
          return;
        }

        if (msg.successful_payment) {
          await handleSuccessfulPayment(msg);
        }
      } catch (error) {
        console.error('[BotService] message handler error:', error && error.message ? error.message : error);
      }
    });

    // Handle inline button presses
    bot.on('callback_query', async (query) => {
      try {
        if (!query) return;
        const data = query.data;
        if (data === 'CMD_PAY' && query.message && query.message.chat) {
          await handlePayCommand({ chat: query.message.chat, from: query.from });
        } else if (data === 'CMD_CANCEL' && query.message && query.message.chat) {
          await handleCancelCommand({ chat: query.message.chat, from: query.from });
        }
        try {
          await bot.answerCallbackQuery(query.id);
        } catch (ackErr) {
          console.error('[BotService] answerCallbackQuery error:', ackErr && ackErr.message ? ackErr.message : ackErr);
        }
      } catch (error) {
        console.error('[BotService] callback_query error:', error && error.message ? error.message : error);
        try {
          await bot.answerCallbackQuery(query.id);
        } catch (ackErr) {
          console.error('[BotService] answerCallbackQuery error:', ackErr && ackErr.message ? ackErr.message : ackErr);
        }
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
