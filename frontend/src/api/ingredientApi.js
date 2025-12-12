import axiosClient from './axiosClient';

const ingredientApi = {
  list: () => axiosClient.get('/api/ingredients'),
  listCatalog: () => axiosClient.get('/api/ingredients/catalog'),
};

export default ingredientApi;
