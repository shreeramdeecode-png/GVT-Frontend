import api from './axiosConfig';

export const getLocalOrder = async (orderId) => {
  try {
    const response = await api.get(`/local-order/${orderId}`);
    return response.data;
  } catch (error) {
    console.error('Error fetching local order:', error);
    throw error;
  }
};

export const saveLocalOrder = async (orderId, data) => {
  try {
    const response = await api.post(`/local-order/${orderId}`, data);
    return response.data;
  } catch (error) {
    console.error('Error saving local order:', error);
    throw error;
  }
};

export const getAllLocalOrders = async () => {
  try {
    const response = await api.get('/local-order');
    return response.data;
  } catch (error) {
    console.error('Error fetching all local orders:', error);
    throw error;
  }
};
