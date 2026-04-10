import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import AddInventory from './AddInventory';
import EditInventory from './EditInventory';
import ConfirmDeleteModal from '../../common/ConfirmDeleteModal';
import { getAllInventory, deleteInventory } from '../../../api/inventoryApi';
import { getInventoryQuantities } from '../../../api/inventoryStockApi';
import { sortDropdownStrings } from '../../../utils/dropdownSort';

const PackingInventory = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('Category');
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [openActionMenu, setOpenActionMenu] = useState(null);
  const [menuPosition, setMenuPosition] = useState({ top: 0, left: 0 });
  const buttonRefs = useRef({});
  const [inventoryItems, setInventoryItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [totalPages, setTotalPages] = useState(1);
  const [deleteModal, setDeleteModal] = useState({ isOpen: false, id: null, name: '' });
  const [stockQuantitiesMap, setStockQuantitiesMap] = useState({});


  const categories = ['All', 'Boxes', 'Bags', 'Tape', 'Paper', 'Plastic Covers'];
  const itemsPerPage = 7;

  useEffect(() => {
    fetchInventory();
  }, [currentPage]);

  const fetchInventory = async () => {
    try {
      setLoading(true);
      // Fetch both inventory items and stock quantities
      const [inventoryResponse, quantitiesResponse] = await Promise.all([
        getAllInventory(currentPage, itemsPerPage),
        getInventoryQuantities()
      ]);

      setInventoryItems(inventoryResponse.data);
      setTotalPages(inventoryResponse.pagination.totalPages);

      // Create a map for quick lookup by item name
      const quantitiesMap = {};
      if (quantitiesResponse.success && Array.isArray(quantitiesResponse.data)) {
        quantitiesResponse.data.forEach(item => {
          quantitiesMap[item.item] = item.totalQuantity;
        });
      }
      setStockQuantitiesMap(quantitiesMap);
    } catch (error) {
      console.error('Error fetching inventory data:', error);
    } finally {
      setLoading(false);
    }
  };


  const handleEdit = (item) => {
    setSelectedItem(item);
    setIsEditModalOpen(true);
    setOpenActionMenu(null);
  };

  const handleActionMenuToggle = (itemId) => {
    if (openActionMenu === itemId) {
      setOpenActionMenu(null);
    } else {
      const button = buttonRefs.current[itemId];
      if (button) {
        const rect = button.getBoundingClientRect();
        setMenuPosition({
          top: rect.bottom + window.scrollY,
          left: rect.right - 128 + window.scrollX
        });
      }
      setOpenActionMenu(itemId);
    }
  };

  const handleDelete = (id, name) => {
    setDeleteModal({ isOpen: true, id, name });
    setOpenActionMenu(null);
  };

  const confirmDelete = async () => {
    try {
      await deleteInventory(deleteModal.id);
      setDeleteModal({ isOpen: false, id: null, name: '' });
      fetchInventory();
    } catch (error) {
      console.error('Error deleting inventory:', error);
      alert('Failed to delete item');
    }
  };

  const handleAddItem = () => {
    fetchInventory();
    setIsAddModalOpen(false);
  };

  const handleUpdateItem = () => {
    fetchInventory();
    setIsEditModalOpen(false);
    setSelectedItem(null);
  };

  const handleExport = () => {
    // Export functionality
    //console.log('Exporting inventory...');
  };

  const filteredItems = inventoryItems.filter(item => {
    const matchesSearch = item.name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = selectedCategory === 'Category' || selectedCategory === 'All' || item.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  const startIndex = (currentPage - 1) * itemsPerPage;

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading inventory...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">

      {/* Tabs */}
      <div className="px-6 sm:px-8 py-4">
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => navigate('/settings')}
            className={`px-6 py-2.5 rounded-lg font-medium text-sm transition-colors ${location.pathname === '/settings'
              ? 'bg-[#0D7C66] text-white'
              : 'bg-[#D4F4E8] text-[#0D5C4D] hover:bg-[#B8F4D8]'
              }`}
          >
            Inventory Management
          </button>
          <button
            onClick={() => navigate('/settings/inventory-company')}
            className={`px-6 py-2.5 rounded-lg font-medium text-sm transition-colors ${location.pathname === '/settings/inventory-company'
              ? 'bg-[#0D7C66] text-white'
              : 'bg-[#D4F4E8] text-[#0D5C4D] hover:bg-[#B8F4D8]'
              }`}
          >
            Inventory Company
          </button>
          <button
            onClick={() => navigate('/settings/airport')}
            className={`px-6 py-2.5 rounded-lg font-medium text-sm transition-colors ${location.pathname === '/settings/airport'
              ? 'bg-[#0D7C66] text-white'
              : 'bg-[#D4F4E8] text-[#0D5C4D] hover:bg-[#B8F4D8]'
              }`}
          >
            Airport Locations
          </button>
          <button
            onClick={() => navigate('/settings/petroleum')}
            className={`px-6 py-2.5 rounded-lg font-medium text-sm transition-colors ${location.pathname === '/settings/petroleum'
              ? 'bg-[#0D7C66] text-white'
              : 'bg-[#D4F4E8] text-[#0D5C4D] hover:bg-[#B8F4D8]'
              }`}
          >
            Petroleum Management
          </button>
          <button
            onClick={() => navigate('/settings/labour-rate')}
            className={`px-6 py-2.5 rounded-lg font-medium text-sm transition-colors ${location.pathname === '/settings/labour-rate'
              ? 'bg-[#0D7C66] text-white'
              : 'bg-[#D4F4E8] text-[#0D5C4D] hover:bg-[#B8F4D8]'
              }`}
          >
            Labour Rate
          </button>
          <button
            onClick={() => navigate('/settings/driver-rate')}
            className={`px-6 py-2.5 rounded-lg font-medium text-sm transition-colors ${location.pathname === '/settings/driver-rate'
              ? 'bg-[#0D7C66] text-white'
              : 'bg-[#D4F4E8] text-[#0D5C4D] hover:bg-[#B8F4D8]'
              }`}
          >
            Driver Rate
          </button>
          <button
            onClick={() => navigate('/settings/customers')}
            className={`px-6 py-2.5 rounded-lg font-medium text-sm transition-colors ${location.pathname === '/settings/customers'
              ? 'bg-[#0D7C66] text-white'
              : 'bg-[#D4F4E8] text-[#0D5C4D] hover:bg-[#B8F4D8]'
              }`}
          >
            Customers
          </button>
          {/* <button 
            onClick={() => navigate('/settings/payout-formulas')}
            className={`px-6 py-2.5 rounded-lg font-medium text-sm transition-colors ${
              location.pathname === '/settings/payout-formulas' 
                ? 'bg-[#0D7C66] text-white' 
                : 'bg-[#D4F4E8] text-[#0D5C4D] hover:bg-[#B8F4D8]'
            }`}
          >
            Payout Formulas
          </button> */}
        </div>
      </div>

      {/* Main Content */}
      <div className="px-4 sm:px-6 lg:px-8 py-6">
        {/* Search and Actions Bar */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 mb-6">
          <div className="p-4 sm:p-6">
            <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
              <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto flex-1">
                {/* Search */}
                <div className="relative flex-1 sm:max-w-xs">
                  <svg
                    className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                    />
                  </svg>
                  <input
                    type="text"
                    placeholder="Search by product name..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 text-sm"
                  />
                </div>

                {/* Category Dropdown */}
                <div className="relative w-full sm:w-48">
                  <select
                    value={selectedCategory}
                    onChange={(e) => setSelectedCategory(e.target.value)}
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 text-sm appearance-none bg-white cursor-pointer"
                  >
                    <option>Category</option>
                    {sortDropdownStrings(categories).map(cat => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                  </select>
                  <svg
                    className="absolute right-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400 pointer-events-none"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </div>
              </div>

              <div className="flex gap-3 w-full sm:w-auto">
                <button
                  onClick={() => setIsAddModalOpen(true)}
                  className="flex-1 sm:flex-none px-5 py-2.5 bg-emerald-500 text-white rounded-lg font-medium text-sm hover:bg-emerald-600 transition-colors flex items-center justify-center gap-2"
                >
                  <span className="text-lg">+</span>
                  Add Inventory
                </button>
                <button
                  onClick={handleExport}
                  className="px-5 py-2.5 border border-gray-300 text-gray-700 rounded-lg font-medium text-sm hover:bg-gray-50 transition-colors"
                >
                  Export
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Table */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto overflow-y-visible">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                    Product Name
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                    Category
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                    Weight/Unit
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                    Price
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                    Total Stock Quantity
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                    Action
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {filteredItems.map((item) => (
                  <tr key={item.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4 text-sm text-gray-900">{item.name}</td>
                    <td className="px-6 py-4 text-sm text-gray-600">{item.category}</td>
                    <td className="px-6 py-4 text-sm text-gray-600">
                      {item.category === 'Tape' ? item.color : `${item.weight} ${item.unit}`}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600">
                      {item.price ? `₹${parseFloat(item.price).toFixed(2)}` : '-'}
                    </td>
                    <td className="px-6 py-4 text-sm">
                      <span className="font-semibold text-emerald-600">
                        {parseFloat(stockQuantitiesMap[item.name] || 0).toFixed(2)}
                      </span>
                    </td>

                    <td className="px-6 py-4 text-sm text-gray-600">
                      <button
                        ref={(el) => buttonRefs.current[item.id] = el}
                        onClick={() => handleActionMenuToggle(item.id)}
                        className="p-1 hover:bg-gray-100 rounded-lg transition-colors"
                      >
                        <svg className="w-5 h-5 text-gray-500" fill="currentColor" viewBox="0 0 24 24">
                          <circle cx="12" cy="5" r="2" />
                          <circle cx="12" cy="12" r="2" />
                          <circle cx="12" cy="19" r="2" />
                        </svg>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="px-6 py-4 border-t border-gray-200 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="text-sm text-gray-600">
              Showing {startIndex + 1} to {Math.min(startIndex + itemsPerPage, filteredItems.length)} of {filteredItems.length} items
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                disabled={currentPage === 1}
                className="p-2 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </button>

              {[...Array(totalPages)].map((_, index) => {
                const pageNumber = index + 1;
                if (
                  pageNumber === 1 ||
                  pageNumber === totalPages ||
                  (pageNumber >= currentPage - 1 && pageNumber <= currentPage + 1)
                ) {
                  return (
                    <button
                      key={pageNumber}
                      onClick={() => setCurrentPage(pageNumber)}
                      className={`min-w-[40px] px-3 py-2 rounded-lg text-sm font-medium transition-colors ${currentPage === pageNumber
                        ? 'bg-emerald-500 text-white'
                        : 'border border-gray-300 text-gray-700 hover:bg-gray-50'
                        }`}
                    >
                      {pageNumber}
                    </button>
                  );
                } else if (
                  pageNumber === currentPage - 2 ||
                  pageNumber === currentPage + 2
                ) {
                  return (
                    <span key={pageNumber} className="px-2 text-gray-500">
                      ...
                    </span>
                  );
                }
                return null;
              })}

              <button
                onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                disabled={currentPage === totalPages}
                className="p-2 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Action Menu Dropdown */}
      {openActionMenu && (
        <>
          <div
            className="fixed inset-0 z-10"
            onClick={() => setOpenActionMenu(null)}
          />
          <div
            className="fixed w-32 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-20"
            style={{ top: `${menuPosition.top}px`, left: `${menuPosition.left}px` }}
          >
            <button
              onClick={() => handleEdit(filteredItems.find(item => item.id === openActionMenu))}
              className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 transition-colors"
            >
              Edit
            </button>
            <button
              onClick={() => {
                const item = filteredItems.find(item => item.id === openActionMenu);
                handleDelete(item.id, item.name);
              }}
              className="w-full px-4 py-2 text-left text-sm text-red-600 hover:bg-gray-50 transition-colors"
            >
              Delete
            </button>
          </div>
        </>
      )}

      {/* Delete Confirmation Modal */}
      <ConfirmDeleteModal
        isOpen={deleteModal.isOpen}
        onClose={() => setDeleteModal({ isOpen: false, id: null, name: '' })}
        onConfirm={confirmDelete}
        title="Delete Inventory Item"
        message={`Are you sure you want to delete "${deleteModal.name}"? This action cannot be undone.`}
      />

      {/* Modals */}
      {isAddModalOpen && (
        <AddInventory
          onClose={() => setIsAddModalOpen(false)}
          onAdd={handleAddItem}
        />
      )}

      {isEditModalOpen && selectedItem && (
        <EditInventory
          item={selectedItem}
          onClose={() => {
            setIsEditModalOpen(false);
            setSelectedItem(null);
          }}
          onUpdate={handleUpdateItem}
          onDelete={handleDelete}
        />
      )}
    </div>
  );
};

export default PackingInventory;