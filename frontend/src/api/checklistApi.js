import axiosClient from './axiosClient';

const checklistApi = {
  listByDate: (date) => axiosClient.get('/api/checklist', { params: { date } }),
  upsert: (payload) => axiosClient.post('/api/checklist', payload),
};

export default checklistApi;
