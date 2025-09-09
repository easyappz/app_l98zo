const dayjs = require('dayjs');
const Payment = require('@src/models/Payment');

let timer = null;
let running = false;

async function tick() {
  if (running) return;
  running = true;
  try {
    const now = dayjs().toDate();
    const res = await Payment.updateMany(
      { status: 'pending', expiresAt: { $lt: now } },
      { $set: { status: 'expired', updatedAt: new Date() } }
    );
    if (res && res.modifiedCount) {
      console.log(`[PaymentExpiryService] Expired payments updated: ${res.modifiedCount}`);
    }
  } catch (err) {
    console.error('[PaymentExpiryService] tick error:', err && err.message ? err.message : err);
  } finally {
    running = false;
  }
}

function start() {
  try {
    if (timer) return;
    timer = setInterval(tick, 45000);
    console.log('[PaymentExpiryService] Started');
  } catch (err) {
    console.error('[PaymentExpiryService] start error:', err && err.message ? err.message : err);
  }
}

function stop() {
  try {
    if (timer) {
      clearInterval(timer);
      timer = null;
    }
    console.log('[PaymentExpiryService] Stopped');
  } catch (err) {
    console.error('[PaymentExpiryService] stop error:', err && err.message ? err.message : err);
  }
}

module.exports = { start, stop };
