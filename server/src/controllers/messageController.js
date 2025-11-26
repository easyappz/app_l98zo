const { BotService } = require('@src/services/botService');
const Payment = require('@src/models/Payment');
const Setting = require('@src/models/Setting');

async function resendSuccessMessage(req, res) {
  try {
    const { chatId } = req.query;
    
    if (!chatId) {
      return res.status(400).json({ 
        error: { message: 'chatId parameter is required' } 
      });
    }

    // Находим последний успешный платеж для этого chatId
    const payment = await Payment.findOne({ 
      chatId: Number(chatId), 
      status: 'succeeded' 
    }).sort({ createdAt: -1 });

    if (!payment) {
      return res.status(404).json({ 
        error: { message: 'No successful payment found for this chatId' } 
      });
    }

    // Загружаем настройки для шаблона сообщения
    const settings = await Setting.findOne({}).lean();
    
    // Функция для применения плейсхолдеров (взята из botService)
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

    // Формируем текст сообщения
    const template = settings && settings.successMessage 
      ? settings.successMessage 
      : 'Payment received: {amount} {currency}. Thank you!';
    
    const messageText = applyPlaceholders(
      template, 
      payment.amount || (settings && settings.amount) || 0, 
      (payment.currency || (settings && settings.currency) || '')
    );

    // Отправляем сообщение через бота
    const TelegramBot = require('node-telegram-bot-api');
    const botSettings = await Setting.findOne({}).lean();
    
    if (!botSettings || !botSettings.telegramBotToken) {
      return res.status(500).json({ 
        error: { message: 'Bot token not configured' } 
      });
    }

    const bot = new TelegramBot(botSettings.telegramBotToken);
    
    try {
      await bot.sendMessage(chatId, messageText);
      
      res.json({ 
        data: { 
          success: true, 
          message: 'Success message resent successfully',
          chatId: chatId,
          paymentId: payment._id
        } 
      });
    } catch (botError) {
      console.error('[MessageController] Bot send message error:', botError && botError.message ? botError.message : botError);
      
      let errorMessage = 'Failed to send message';
      if (botError.response && botError.response.body) {
        const errorDesc = botError.response.body.description || '';
        errorMessage += `: ${errorDesc}`;
      }
      
      res.status(500).json({ 
        error: { message: errorMessage } 
      });
    }

  } catch (err) {
    console.error('[MessageController] resendSuccessMessage error:', err && err.message ? err.message : err);
    res.status(500).json({ 
      error: { message: err && err.message ? err.message : 'Failed to resend success message' } 
    });
  }
}

module.exports = { resendSuccessMessage };
