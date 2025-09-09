const dayjs = require('dayjs');
const Payment = require('@src/models/Payment');

const ALLOWED_STATUSES = ['pending', 'succeeded', 'canceled', 'expired'];

async function listPayments(req, res) {
  try {
    const { status } = req.query;
    const page = Number.parseInt(req.query.page, 10) > 0 ? Number.parseInt(req.query.page, 10) : 1;
    const limit = Number.parseInt(req.query.limit, 10) > 0 ? Math.min(Number.parseInt(req.query.limit, 10), 100) : 20;

    const filter = {};
    if (status) {
      if (!ALLOWED_STATUSES.includes(status)) {
        return res.status(400).json({ error: { message: `Invalid status. Allowed: ${ALLOWED_STATUSES.join(', ')}`, stack: null } });
      }
      filter.status = status;
    }

    const [items, total] = await Promise.all([
      Payment.find(filter).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
      Payment.countDocuments(filter),
    ]);

    const pages = Math.ceil(total / limit) || 1;

    return res.json({ data: items, page, limit, total, pages });
  } catch (err) {
    return res.status(err.status || 500).json({ error: { message: err.message, stack: err.stack } });
  }
}

async function getStats(req, res) {
  try {
    const now = dayjs();
    const since24h = now.subtract(24, 'hour').toDate();
    const since7d = now.subtract(7, 'day').toDate();

    const [total, byStatusAgg, last24hCount, last7dCount, sumSucceededAgg] = await Promise.all([
      Payment.countDocuments({}),
      Payment.aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }]),
      Payment.countDocuments({ createdAt: { $gte: since24h } }),
      Payment.countDocuments({ createdAt: { $gte: since7d } }),
      Payment.aggregate([
        { $match: { status: 'succeeded' } },
        { $group: { _id: null, totalAmount: { $sum: '$amount' } } },
      ]),
    ]);

    const byStatus = ALLOWED_STATUSES.reduce((acc, s) => ({ ...acc, [s]: 0 }), {});
    byStatusAgg.forEach((r) => { byStatus[r._id] = r.count; });

    const sumSucceeded = sumSucceededAgg && sumSucceededAgg[0] ? sumSucceededAgg[0].totalAmount : 0;

    return res.json({
      data: {
        total,
        byStatus,
        last24hCount,
        last7dCount,
        sumSucceeded,
      },
    });
  } catch (err) {
    return res.status(err.status || 500).json({ error: { message: err.message, stack: err.stack } });
  }
}

module.exports = {
  listPayments,
  getStats,
};
