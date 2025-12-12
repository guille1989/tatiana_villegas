import axiosClient from './axiosClient';

const restrictionApi = {
  list: (category) => axiosClient.get('/api/restrictions', { params: category ? { category } : {} }),
};

export default restrictionApi;
