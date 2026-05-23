import api from './axiosConfig';

export const createFuelExpense = async (expenseData) => {
  try {
    const response = await api.post('/fuel-expense/create', expenseData);
    return response.data;
  } catch (error) {
    throw error.response?.data || error.message;
  }
};

export const getAllFuelExpenses = async () => {
  try {
    const response = await api.get('/fuel-expense/list');
    return response.data;
  } catch (error) {
    throw error.response?.data || error.message;
  }
};

export const getFuelExpenseById = async (id) => {
  try {
    const response = await api.get(`/fuel-expense/${id}`);
    return response.data;
  } catch (error) {
    throw error.response?.data || error.message;
  }
};

export const updateFuelExpense = async (id, expenseData) => {
  try {
    const response = await api.put(`/fuel-expense/${id}`, expenseData);
    return response.data;
  } catch (error) {
    throw error.response?.data || error.message;
  }
};

export const updateFuelExpensePaymentStatus = async (id, payment_status) => {
  const payload = { payment_status };
  const numericId = Number(id);
  if (Number.isNaN(numericId)) {
    throw new Error('Invalid fuel expense id');
  }

  const tryPatch = () =>
    api.patch(`/fuel-expense/${numericId}/payment-status`, payload);
  const tryPost = () =>
    api.post(`/fuel-expense/${numericId}/payment-status`, payload);
  const tryPut = () => api.put(`/fuel-expense/${numericId}`, payload);

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

export const deleteFuelExpense = async (id) => {
  try {
    const response = await api.delete(`/fuel-expense/${id}`);
    return response.data;
  } catch (error) {
    throw error.response?.data || error.message;
  }
};

export const getFuelExpensesByDriverId = async (driverId) => {
  try {
    const response = await api.get(`/fuel-expense/driver/${driverId}`);
    return response.data;
  } catch (error) {
    throw error.response?.data || error.message;
  }
};
