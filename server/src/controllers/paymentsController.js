const Payment = require('@src/models/Payment');

async function listPayments(req, res) {
  try {
    const { status, limit, skip } = req.query || {};
    const filter = {};
    if (status && typeof status === 'string') {
      filter.status = status;
    }
    const lim = Math.min(Number(limit) || 50, 200);
    const sk = Number(skip) || 0;

    const items = await Payment.find(filter).sort({ createdAt: -1 }).skip(sk).limit(lim).lean();
    res.json({ data: items });
  } catch (err) {
    res.status(500).json({ error: { message: err && err.message ? err.message : 'Failed to list payments' } });
  }
}

async function getStats(req, res) {
  try {
    const statuses = ['pending', 'succeeded', 'expired', 'failed'];
    const counts = {};
    for (const s of statuses) {
      counts[s] = await Payment.countDocuments({ status: s });
    }
    const total = await Payment.countDocuments({});

    res.json({
      data: {
        total,
        byStatus: counts,
        generatedAt: new Date().toISOString(),
      },
    });
  } catch (err) {
    res.status(500).json({ error: { message: err && err.message ? err.message : 'Failed to get stats' } });
  }
}

module.exports = { listPayments, getStats };
