import api from './axiosConfig';

export const createLabour = async (labourData) => {
    try {
        const response = await api.post('/labour/create', labourData, {
            headers: { 'Content-Type': 'multipart/form-data' },
        });
        return response.data;
    } catch (error) {
        const data = error.response?.data;
        const message =
            data?.message ||
            data?.error ||
            error.message ||
            'Failed to create labour';
        throw new Error(message);
    }
};

export const getAllLabours = async (page = 1, limit = 10) => {
    try {
        const response = await api.get(`/labour/list?page=${page}&limit=${limit}`);
        return response.data;
    } catch (error) {
        throw error.response?.data || error.message;
    }
};

export const getLabourById = async (id) => {
    try {
        const response = await api.get(`/labour/${id}`);
        return response.data;
    } catch (error) {
        throw error.response?.data || error.message;
    }
};

export const updateLabour = async (id, labourData) => {
    try {
        const response = await api.put(`/labour/${id}`, labourData, {
            headers: { 'Content-Type': 'multipart/form-data' },
        });
        return response.data;
    } catch (error) {
        throw error.response?.data || error.message;
    }
};

export const deleteLabour = async (id) => {
    try {
        const response = await api.delete(`/labour/${id}`);
        return response.data;
    } catch (error) {
        throw error.response?.data || error.message;
    }
};
