import api from './axiosConfig';

const BASE = '/daily-payouts';

/**
 * Get list of daily payouts.
 * @param {Object} params - { type: 'driver'|'labour', entity_id: number|string }
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
 * Get paid records for a type (driver or labour).
 * @param {string} type - 'driver' | 'labour'
 * @param {Object} params - { entity_id: number|string } for driver/labour id
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
 * Mark a daily payout row as paid and store full row data.
 * @param {string} type - 'driver' | 'labour'
 * @param {Object} rowData - full payout row to store (date, amounts, etc.)
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
 * Mark a daily payout row as partially paid.
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
 * Revert a previously paid daily payout row back to pending state.
 * @param {string} type - 'driver' | 'labour'
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
