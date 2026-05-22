import api from './axiosConfig';

const API_BASE_URL = '/inventory-company';

export const createCompany = async (data) => {
  try {
    const response = await api.post(`${API_BASE_URL}/`, data);
    return response.data;
  } catch (error) {
    throw error.response?.data || error.message;
  }
};

export const getAllCompanies = async () => {
  try {
    const response = await api.get(`${API_BASE_URL}/`);
    return response.data;
  } catch (error) {
    throw error.response?.data || error.message;
  }
};

export const getCompanyById = async (id) => {
  try {
    const response = await api.get(`${API_BASE_URL}/${id}`);
    return response.data;
  } catch (error) {
    throw error.response?.data || error.message;
  }
};

export const getCompanyPurchaseHistory = async (id) => {
  try {
    const response = await api.get(`${API_BASE_URL}/${id}/purchase-history`);
    return response.data;
  } catch (error) {
    const msg = error.response?.data?.message || error.message;
    throw new Error(msg);
  }
};

export const updateCompany = async (id, data) => {
  try {
    const response = await api.put(`${API_BASE_URL}/${id}`, data);
    return response.data;
  } catch (error) {
    const msg = error.response?.data?.message || error.message;
    throw new Error(msg);
  }
};

export const deleteCompany = async (id) => {
  try {
    const response = await api.delete(`${API_BASE_URL}/${id}`);
    return response.data;
  } catch (error) {
    throw error.response?.data || error.message;
  }
};
