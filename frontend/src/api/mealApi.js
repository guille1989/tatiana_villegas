import axiosClient from './axiosClient';

const mealApi = {
  list: (planId) => axiosClient.get('/api/meals', { params: { planId } }),
  create: (data) => axiosClient.post('/api/meals', data),
  detail: (id) => axiosClient.get(`/api/meals/${id}`),
  updateIngredients: (id, ingredients) => axiosClient.put(`/api/meals/${id}/ingredients`, { ingredients }),
  saveTemplate: (data) => axiosClient.post('/api/meals/template', data),
};

export default mealApi;
