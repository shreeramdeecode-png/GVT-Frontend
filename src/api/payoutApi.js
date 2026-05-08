import api from './axiosConfig';

const BASE = '/payout';

/**
 * Get list of payouts (optional filter by type).
 * @param {Object} params - { type: 'farmer'|'supplier'|'third_party'|'labour'|'driver', entity_id?: string }
 */
export const getPayoutList = async (params = {}) => {
  try {
    const response = await api.get(`${BASE}/list`, { params });
    return response.data;
  } catch (error) {
    throw error.response?.data || error.message;
  }
};

/**
 * Get paid records for a type (for frontend to merge status).
 * @param {string} type - 'farmer' | 'supplier' | 'third_party' | 'labour' | 'driver'
 * @param {Object} params - optional { entity_id: string } for labour/driver
 */
export const getPaidRecords = async (type, params = {}) => {
  try {
    const response = await api.get(`${BASE}/${type}/paid`, { params });
    return response.data;
  } catch (error) {
    throw error.response?.data || error.message;
  }
};

/**
 * Mark a payout row as paid and store full row.
 * @param {string} type - 'farmer' | 'supplier' | 'third_party' | 'labour' | 'driver'
 * @param {Object} rowData - full payout row (key, entity_id, amount, etc.)
 */
export const markAsPaid = async (type, rowData) => {
  try {
    const response = await api.post(`${BASE}/${type}/mark-paid`, rowData);
    return response.data;
  } catch (error) {
    throw error.response?.data || error.message;
  }
};

/**
 * Mark a payout row as partially paid.
 * @param {string} type
 * @param {Object} rowData - must include id/key/reference_key and partial_amount
 */
export const markPartialPaid = async (type, rowData) => {
  try {
    const response = await api.post(`${BASE}/${type}/partial-pay`, rowData);
    return response.data;
  } catch (error) {
    throw error.response?.data || error.message;
  }
};

/**
 * Revert a previously paid payout row back to pending state.
 * @param {string} type - 'farmer' | 'supplier' | 'third_party' | 'labour' | 'driver'
 * @param {Object} rowData - must include id/key/reference_key
 */
export const unmarkAsPaid = async (type, rowData) => {
  try {
    const response = await api.post(`${BASE}/${type}/unmark-paid`, rowData);
    return response.data;
  } catch (error) {
    throw error.response?.data || error.message;
  }
};
