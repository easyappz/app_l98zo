import instance from './axios';

export async function getSettings() {
  const res = await instance.get('/api/settings');
  return res?.data?.data || null;
}

export async function updateSettings(data) {
  const res = await instance.put('/api/settings', data);
  return res?.data?.data || null;
}

export async function restartBot() {
  const res = await instance.post('/api/bot/restart', {});
  return res?.data?.data || null;
}
