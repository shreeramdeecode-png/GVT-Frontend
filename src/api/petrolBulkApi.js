import api from './axiosConfig';

const API_BASE_URL = '/petrol-bulk';

export const petrolBulkApi = {
  getAll: (page = 1, limit = 10, search = '') => 
    api.get(`${API_BASE_URL}/list`, { params: { page, limit, search } }),
  
  getById: (id) => 
    api.get(`${API_BASE_URL}/${id}`),

  getFuelHistory: async (id, params = {}) => {
    try {
      return await api.get(`${API_BASE_URL}/${id}/fuel-history`, { params });
    } catch (error) {
      if (error.response?.status === 404) {
        return await api.get(`/fuel-expense/history-by-bunk/${id}`, { params });
      }
      throw error;
    }
  },

  markFuelPaid: async (id, data) => {
    try {
      return await api.post(`${API_BASE_URL}/${id}/mark-fuel-paid`, data);
    } catch (error) {
      if (error.response?.status === 404) {
        return await api.post(`/fuel-expense/mark-paid-by-bunk/${id}`, data);
      }
      throw error;
    }
  },

  revertFuelPaid: async (id, data) => {
    try {
      return await api.post(`${API_BASE_URL}/${id}/revert-fuel-paid`, data);
    } catch (error) {
      if (error.response?.status === 404) {
        return await api.post(`/fuel-expense/revert-paid-by-bunk/${id}`, data);
      }
      throw error;
    }
  },
  
  create: (data) => 
    api.post(`${API_BASE_URL}/create`, data),
  
  update: (id, data) => 
    api.put(`${API_BASE_URL}/update/${id}`, data),
  
  delete: (id) => 
    api.delete(`${API_BASE_URL}/delete/${id}`)
};
