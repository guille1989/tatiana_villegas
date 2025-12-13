import axiosClient from './axiosClient';

const adminApi = {
  getSummary: (params = {}) => axiosClient.get('/api/admin/dashboard/summary', { params }),
  listUsers: (params = {}) => axiosClient.get('/api/admin/users', { params }),
  exportUsers: (params = {}) => axiosClient.get('/api/admin/users/export.csv', {
    params,
    responseType: 'blob',
  }),
  getUserDetail: (id, params = {}) => axiosClient.get(`/api/admin/users/${id}`, { params }),
};

export default adminApi;
