import axiosClient from './axiosClient';

const profileApi = {
  getMe: () => axiosClient.get('/api/profile/me'),
  save: (payload) => axiosClient.post('/api/profile', payload),
};

export default profileApi;
