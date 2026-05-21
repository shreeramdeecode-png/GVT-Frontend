import api from './axiosConfig';

export const createProduct = async (formData) => {
  const token = localStorage.getItem('token');
  const response = await api.post('/product/create', formData, {
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'multipart/form-data'
    }
  });
  return response.data;
};

export const getAllProducts = async (page = 1, limit = 10) => {
  const response = await api.get(`/product/list?page=${page}&limit=${limit}`);
  return response.data;
};

export const updateProduct = async (id, formData) => {
  const token = localStorage.getItem('token');
  const response = await api.put(`/product/${id}`, formData, {
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'multipart/form-data'
    }
  });
  return response.data;
};

export const deleteProduct = async (id) => {
  const response = await api.delete(`/product/${id}`);
  return response.data;
};

/** Load all products (paginated API) for dropdowns. */
export async function fetchAllProducts() {
  const limit = 100;
  let page = 1;
  let allRows = [];

  while (true) {
    const res = await getAllProducts(page, limit);
    const rows = res?.data || [];
    allRows.push(...rows);

    const totalPages = res?.pagination?.totalPages;
    if ((totalPages && page >= totalPages) || rows.length < limit) break;
    page += 1;
  }

  const byId = new Map();
  allRows.forEach((row) => {
    if (row?.pid != null) byId.set(row.pid, row);
  });
  return Array.from(byId.values());
}

export function mapProductsForDropdown(products) {
  return (products || []).map((p) => ({
    id: p.pid,
    name: p.product_name,
  }));
}