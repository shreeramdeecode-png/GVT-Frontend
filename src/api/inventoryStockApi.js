import api from './axiosConfig';

const API_BASE_URL = '/inventory-stock';

export const createInventoryStock = async (data) => {
  const response = await api.post(`${API_BASE_URL}/`, data);
  return response.data;
};

export const getAllInventoryStocks = async () => {
  const response = await api.get(`${API_BASE_URL}/`);
  return response.data;
};

export const getInventoryStocksByCompany = async (companyId) => {
  const response = await api.get(`${API_BASE_URL}/by-company/${companyId}`);
  return response.data;
};

export const getInventoryStockById = async (id) => {
  const response = await api.get(`${API_BASE_URL}/${id}`);
  return response.data;
};

export const updateInventoryStock = async (id, data) => {
  const response = await api.put(`${API_BASE_URL}/${id}`, data);
  return response.data;
};

export const deleteInventoryStock = async (id) => {
  const response = await api.delete(`${API_BASE_URL}/${id}`);
  return response.data;
};

export const getCompanyTotals = async (companyId) => {
  const response = await api.get(`${API_BASE_URL}/company-totals/${companyId}`);
  return response.data;
};

export const getInventoryQuantities = async () => {
  const response = await api.get(`${API_BASE_URL}/inventory-quantities`);
  return response.data;
};
