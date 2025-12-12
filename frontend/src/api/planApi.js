import axiosClient from './axiosClient';

const planApi = {
  generate: (profile) => axiosClient.post('/api/plan/generate', { profile }),
  update: (id, data) => axiosClient.put(`/api/plan/${id}`, data),
};

export default planApi;
