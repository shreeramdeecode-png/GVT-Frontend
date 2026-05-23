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
  try {
    const response = await api.put(`${API_BASE_URL}/${id}`, data);
    return response.data;
  } catch (error) {
    const message =
      error.response?.data?.message ||
      error.response?.data?.error ||
      error.message;
    throw new Error(message);
  }
};

/** Mark purchase paid/unpaid without sending full stock items payload */
export const updateInventoryStockPaymentStatus = async (id, payment_status) => {
  const payload = { payment_status };
  const numericId = Number(id);
  if (Number.isNaN(numericId)) {
    throw new Error('Invalid purchase id');
  }

  const tryPatch = () =>
    api.patch(`${API_BASE_URL}/${numericId}/payment-status`, payload);
  const tryPost = () =>
    api.post(`${API_BASE_URL}/${numericId}/payment-status`, payload);
  const tryPut = () => api.put(`${API_BASE_URL}/${numericId}`, payload);

  try {
    const response = await tryPatch();
    return response.data;
  } catch (error) {
    const status = error.response?.status;
    if (status === 404 || status === 405) {
      try {
        const response = await tryPost();
        return response.data;
      } catch (postError) {
        const postStatus = postError.response?.status;
        if (postStatus === 404 || postStatus === 405) {
          try {
            const response = await tryPut();
            return response.data;
          } catch (putError) {
            const message =
              putError.response?.data?.message ||
              putError.response?.data?.error ||
              putError.message;
            throw new Error(message);
          }
        }
        const message =
          postError.response?.data?.message ||
          postError.response?.data?.error ||
          postError.message;
        throw new Error(message);
      }
    }
    const message =
      error.response?.data?.message ||
      error.response?.data?.error ||
      error.message;
    throw new Error(message);
  }
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
