import instance from './axios';

export async function getPayments(params = {}) {
  const res = await instance.get('/api/payments', { params });
  return res?.data?.data || [];
}

export async function getStats() {
  const res = await instance.get('/api/stats');
  return res?.data?.data || { total: 0, byStatus: { pending: 0, succeeded: 0, expired: 0, failed: 0 }, generatedAt: null };
}
