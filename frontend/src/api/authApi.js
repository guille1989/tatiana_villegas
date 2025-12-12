import axiosClient from './axiosClient';

const authApi = {
  register: (data) => axiosClient.post('/api/auth/register', data),
  login: (data) => axiosClient.post('/api/auth/login', data),
};

export default authApi;
