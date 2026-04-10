import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import ConfirmDeleteModal from '../../common/ConfirmDeleteModal';
import { createCustomer, getAllCustomers, updateCustomer, deleteCustomer as deleteCustomerApi } from '../../../api/customerApi';

const AddCustomers = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [deleteModal, setDeleteModal] = useState({ isOpen: false, id: null, name: '' });
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [pagination, setPagination] = useState(null);
  const itemsPerPage = 7;
  const [formData, setFormData] = useState({ name: '', category: '' });

  useEffect(() => {
    fetchCustomers();
  }, [currentPage]);

  const fetchCustomers = async () => {
    try {
      setLoading(true);
      const response = await getAllCustomers(currentPage, itemsPerPage);
      setCustomers(response.data);
      setPagination(response.pagination);
    } catch (error) {
      console.error('Failed to fetch customers:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (customer) => {
    setSelectedCustomer(customer);
    setFormData({
      name: customer.customer_name,
      category: customer.customer_category || '',
    });
    setIsEditModalOpen(true);
  };

  const handleDelete = (id, name) => {
    setDeleteModal({ isOpen: true, id, name });
  };

  const confirmDelete = async () => {
    try {
      await deleteCustomerApi(deleteModal.id);
      fetchCustomers();
      setDeleteModal({ isOpen: false, id: null, name: '' });
    } catch (error) {
      console.error('Failed to delete customer:', error);
    }
  };

  const handleAddSubmit = async (e) => {
    e.preventDefault();
    try {
      await createCustomer({
        customer_name: formData.name,
        customer_category: formData.category,
      });
      fetchCustomers();
      setIsAddModalOpen(false);
      setFormData({ name: '', category: '' });
    } catch (error) {
      console.error('Failed to create customer:', error);
    }
  };

  const handleEditSubmit = async (e) => {
    e.preventDefault();
    try {
      await updateCustomer(selectedCustomer.customer_id, {
        customer_name: formData.name,
        customer_category: formData.category,
      });
      fetchCustomers();
      setIsEditModalOpen(false);
      setFormData({ name: '', category: '' });
    } catch (error) {
      console.error('Failed to update customer:', error);
    }
  };

  const filteredCustomers = customers.filter(customer =>
    customer.customer_name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Tabs */}
      <div className="px-6 sm:px-8 py-4">
        <div className="flex flex-wrap gap-2">
          <button onClick={() => navigate('/settings')} className={`px-6 py-2.5 rounded-lg font-medium text-sm transition-colors ${location.pathname === '/settings' ? 'bg-[#0D7C66] text-white' : 'bg-[#D4F4E8] text-[#0D5C4D] hover:bg-[#B8F4D8]'}`}>Inventory Management</button>
          <button onClick={() => navigate('/settings/inventory-company')} className={`px-6 py-2.5 rounded-lg font-medium text-sm transition-colors ${location.pathname === '/settings/inventory-company' ? 'bg-[#0D7C66] text-white' : 'bg-[#D4F4E8] text-[#0D5C4D] hover:bg-[#B8F4D8]'}`}>Inventory Company</button>
          <button onClick={() => navigate('/settings/airport')} className={`px-6 py-2.5 rounded-lg font-medium text-sm transition-colors ${location.pathname === '/settings/airport' ? 'bg-[#0D7C66] text-white' : 'bg-[#D4F4E8] text-[#0D5C4D] hover:bg-[#B8F4D8]'}`}>Airport Locations</button>
          <button onClick={() => navigate('/settings/petroleum')} className={`px-6 py-2.5 rounded-lg font-medium text-sm transition-colors ${location.pathname === '/settings/petroleum' ? 'bg-[#0D7C66] text-white' : 'bg-[#D4F4E8] text-[#0D5C4D] hover:bg-[#B8F4D8]'}`}>Petroleum Management</button>
          <button onClick={() => navigate('/settings/labour-rate')} className={`px-6 py-2.5 rounded-lg font-medium text-sm transition-colors ${location.pathname === '/settings/labour-rate' ? 'bg-[#0D7C66] text-white' : 'bg-[#D4F4E8] text-[#0D5C4D] hover:bg-[#B8F4D8]'}`}>Labour Rate</button>
          <button onClick={() => navigate('/settings/driver-rate')} className={`px-6 py-2.5 rounded-lg font-medium text-sm transition-colors ${location.pathname === '/settings/driver-rate' ? 'bg-[#0D7C66] text-white' : 'bg-[#D4F4E8] text-[#0D5C4D] hover:bg-[#B8F4D8]'}`}>Driver Rate</button>
          <button onClick={() => navigate('/settings/customers')} className={`px-6 py-2.5 rounded-lg font-medium text-sm transition-colors ${location.pathname === '/settings/customers' ? 'bg-[#0D7C66] text-white' : 'bg-[#D4F4E8] text-[#0D5C4D] hover:bg-[#B8F4D8]'}`}>Customers</button>
        </div>
      </div>

      <div className="px-4 sm:px-6 lg:px-8 py-6">
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 mb-6">
          <div className="p-4 sm:p-6">
            <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
              <div className="relative w-full sm:max-w-md">
                <svg className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                <input type="text" placeholder="Search customers..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 text-sm" />
              </div>
              <button onClick={() => setIsAddModalOpen(true)} className="w-full sm:w-auto px-5 py-2.5 bg-emerald-500 text-white rounded-lg font-medium text-sm hover:bg-emerald-600 transition-colors flex items-center justify-center gap-2"><span className="text-lg">+</span>Add Customer</button>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Customer Name</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Category</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {loading ? (
                  <tr><td colSpan="3" className="px-6 py-4 text-center text-gray-500">Loading...</td></tr>
                ) : filteredCustomers.length === 0 ? (
                  <tr><td colSpan="3" className="px-6 py-4 text-center text-gray-500">No customers found</td></tr>
                ) : (
                  filteredCustomers.map((customer) => (
                    <tr key={customer.customer_id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-6 py-4 text-sm text-gray-900">{customer.customer_name}</td>
                      <td className="px-6 py-4 text-sm text-gray-900">
                        {customer.customer_category || '-'}
                      </td>
                      <td className="px-6 py-4 text-sm">
                        <div className="flex gap-2">
                          <button onClick={() => handleEdit(customer)} className="px-4 py-1.5 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors text-sm font-medium">Edit</button>
                          <button onClick={() => handleDelete(customer.customer_id, customer.customer_name)} className="px-4 py-1.5 text-red-600 bg-red-50 rounded-lg hover:bg-red-100 transition-colors text-sm font-medium">Delete</button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Add Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md">
            <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
              <h2 className="text-xl font-semibold text-gray-900">Add Customer</h2>
              <button onClick={() => setIsAddModalOpen(false)} className="text-gray-400 hover:text-gray-600"><svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg></button>
            </div>
            <form onSubmit={handleAddSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Customer Name</label>
                <input type="text" required value={formData.name} onChange={(e) => setFormData({ name: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500" placeholder="Enter customer name" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
                <select
                  required
                  value={formData.category}
                  onChange={(e) =>
                    setFormData({ ...formData, category: e.target.value })
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 bg-white"
                >
                  <option value="">Select category</option>
                  <option value="BOX ORDER">BOX ORDER</option>
                  <option value="FLOWER ORDER">FLOWER ORDER</option>
                  <option value="LOCAL GRADE ORDER">LOCAL GRADE ORDER</option>
                </select>
              </div>
              <div className="flex gap-3 pt-4">
                <button type="button" onClick={() => setIsAddModalOpen(false)} className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 font-medium">Cancel</button>
                <button type="submit" className="flex-1 px-4 py-2 bg-emerald-500 text-white rounded-lg hover:bg-emerald-600 font-medium">Add Customer</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      <ConfirmDeleteModal
        isOpen={deleteModal.isOpen}
        onClose={() => setDeleteModal({ isOpen: false, id: null, name: '' })}
        onConfirm={confirmDelete}
        title="Delete Customer"
        message={`Are you sure you want to delete "${deleteModal.name}"? This action cannot be undone.`}
      />

      {/* Edit Modal */}
      {isEditModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md">
            <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
              <h2 className="text-xl font-semibold text-gray-900">Edit Customer</h2>
              <button onClick={() => setIsEditModalOpen(false)} className="text-gray-400 hover:text-gray-600"><svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg></button>
            </div>
            <form onSubmit={handleEditSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Customer Name</label>
                <input type="text" required value={formData.name} onChange={(e) => setFormData({ name: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
                <select
                  required
                  value={formData.category}
                  onChange={(e) =>
                    setFormData({ ...formData, category: e.target.value })
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 bg-white"
                >
                  <option value="">Select category</option>
                  <option value="BOX ORDER">BOX ORDER</option>
                  <option value="FLOWER ORDER">FLOWER ORDER</option>
                  <option value="LOCAL GRADE ORDER">LOCAL GRADE ORDER</option>
                </select>
              </div>
              <div className="flex gap-3 pt-4">
                <button type="button" onClick={() => setIsEditModalOpen(false)} className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 font-medium">Cancel</button>
                <button type="submit" className="flex-1 px-4 py-2 bg-emerald-500 text-white rounded-lg hover:bg-emerald-600 font-medium">Update Customer</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default AddCustomers;