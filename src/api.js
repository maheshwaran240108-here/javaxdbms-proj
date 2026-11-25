import axios from 'axios';

const client = axios.create({ baseURL: '/api', timeout: 120000 });

async function request(config) {
  try {
    const response = await client.request(config);
    return response.data;
  } catch (error) {
    throw new Error(error.response?.data?.error || error.message || 'The request could not be completed.');
  }
}

export const api = {
  health: () => request({ url: '/health' }),
  dashboard: () => request({ url: '/dashboard' }),
  alerts: () => request({ url: '/alerts' }),
  model: () => request({ url: '/model' }),
  dataset: () => request({ url: '/dataset' }),
  settings: () => request({ url: '/settings' }),
  reports: () => request({ url: '/reports' }),
  lookupMachine: (id) => request({ url: `/machines/lookup?id=${encodeURIComponent(id)}` }),
  predict: (reading) => request({ url: '/predictions', method: 'POST', data: reading }),
  importDataset: async (file) => request({
    url: '/dataset/import',
    method: 'POST',
    data: await file.text(),
    headers: { 'Content-Type': 'text/csv' },
  }),
  train: () => request({ url: '/model/train', method: 'POST' }),
  evaluate: () => request({ url: '/model/evaluate', method: 'POST' }),
};