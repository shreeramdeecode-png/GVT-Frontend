import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useNavigate, useSearchParams, useLocation } from 'react-router-dom';
import { Search, Plus, MoreVertical, Download } from 'lucide-react';
import ConfirmDeleteModal from '../../common/ConfirmDeleteModal';
import { getAllSuppliers, deleteSupplier } from '../../../api/supplierApi';
import { getAllProducts } from '../../../api/productApi';
import { BASE_URL } from '../../../config/config';
import * as XLSX from 'xlsx-js-style';

const SupplierDashboard = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const currentPage = Math.max(1, parseInt(searchParams.get('page') || '1', 10) || 1);
  const [openDropdown, setOpenDropdown] = useState(null);
  const [dropdownPosition, setDropdownPosition] = useState({ top: 0, left: 0 });
  const dropdownRef = useRef(null);
  const [deleteModal, setDeleteModal] = useState({ isOpen: false, supplierId: null, supplierName: '' });
  const [suppliers, setSuppliers] = useState([]);
  const [allSuppliers, setAllSuppliers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [totalPages, setTotalPages] = useState(1);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortOrder, setSortOrder] = useState('recent');
  const itemsPerPage = 7;

  const setPage = useCallback((page) => {
    const safePage = Math.max(1, page);
    const search = safePage === 1 ? '' : `?page=${safePage}`;
    navigate({ pathname: location.pathname, search }, { replace: true });
  }, [navigate, location.pathname]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [suppliersResponse, productsResponse] = await Promise.all([
          getAllSuppliers(),
          getAllProducts(1, 100)
        ]);

        const products = productsResponse.data || [];
        const productMap = {};
        products.forEach(p => {
          productMap[p.pid] = p.product_name;
        });

        const suppliersData = (suppliersResponse.data || []).map(supplier => {
          let productIds = [];
          if (typeof supplier.product_list === 'string') {
            try {
              productIds = JSON.parse(supplier.product_list);
            } catch (e) {
              productIds = [];
            }
          } else if (Array.isArray(supplier.product_list)) {
            productIds = supplier.product_list;
          }



          return {
            ...supplier,
            product_list: productIds.map(id => ({
              product_id: id,
              product_name: productMap[id] || `Product ${id}`
            }))
          };
        });

        setAllSuppliers(suppliersData);
      } catch (error) {
        console.error('Failed to fetch data:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  useEffect(() => {
    let filtered = [...allSuppliers];

    if (searchQuery) {
      filtered = filtered.filter(supplier =>
        supplier.supplier_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        supplier.phone?.includes(searchQuery) ||
        supplier.email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        supplier.city?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        supplier.state?.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    if (sortOrder === 'early') {
      filtered.sort((a, b) => a.sid - b.sid);
    } else {
      filtered.sort((a, b) => b.sid - a.sid);
    }

    setTotalPages(Math.ceil(filtered.length / itemsPerPage));
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    setSuppliers(filtered.slice(startIndex, endIndex));
  }, [allSuppliers, searchQuery, sortOrder, currentPage]);

  useEffect(() => {
    if (!loading && totalPages > 0 && currentPage > totalPages) {
      setPage(totalPages);
    }
  }, [loading, totalPages, currentPage, setPage]);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setOpenDropdown(null);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const toggleDropdown = (supplierId, event) => {
    if (openDropdown === supplierId) {
      setOpenDropdown(null);
    } else {
      const rect = event.currentTarget.getBoundingClientRect();
      setDropdownPosition({
        top: rect.bottom + window.scrollY + 8,
        left: rect.right + window.scrollX - 128
      });
      setOpenDropdown(supplierId);
    }
  };

  const handleAction = (action, supplierId, supplierName) => {
    setOpenDropdown(null);
    if (action === 'view') {
      navigate(`/suppliers/${supplierId}`);
    } else if (action === 'edit') {
      navigate(`/suppliers/${supplierId}/edit`, { state: { returnTo: 'suppliers', returnPage: currentPage } });
    } else if (action === 'delete') {
      setDeleteModal({ isOpen: true, supplierId, supplierName });
    }
  };

  // Export suppliers to Excel
  const handleExportSuppliers = () => {
    if (allSuppliers.length === 0) {
      alert('No suppliers to export');
      return;
    }

    // Prepare data for export
    const exportData = allSuppliers.map(supplier => ({
      'NAME': supplier.supplier_name || 'N/A',
      'FARM PLACE': supplier.city || 'N/A',
      'CONTACT#': supplier.phone || 'N/A',
      'ACC NAME': supplier.account_holder_name || 'N/A',
      'ACC NUMBER': supplier.account_number || 'N/A',
      'IFS CODE': supplier.IFSC_code || supplier.ifsc_code || 'N/A',
      'BRANCH': supplier.branch_name || 'N/A'
    }));

    // Create worksheet
    const worksheet = XLSX.utils.json_to_sheet(exportData);

    // Set column widths
    worksheet['!cols'] = [
      { wch: 20 }, // NAME
      { wch: 15 }, // FARM PLACE
      { wch: 15 }, // CONTACT#
      { wch: 25 }, // ACC NAME
      { wch: 20 }, // ACC NUMBER
      { wch: 15 }, // IFS CODE
      { wch: 20 }  // BRANCH
    ];

    // Style header row
    const headerCells = ['A1', 'B1', 'C1', 'D1', 'E1', 'F1', 'G1'];
    headerCells.forEach(cell => {
      if (worksheet[cell]) {
        worksheet[cell].s = {
          font: { bold: true, sz: 11, name: "Calibri", color: { rgb: "FFFFFF" } },
          fill: { fgColor: { rgb: "4472C4" } },
          alignment: { horizontal: "center", vertical: "center" },
          border: {
            top: { style: "thin", color: { rgb: "000000" } },
            bottom: { style: "thin", color: { rgb: "000000" } },
            left: { style: "thin", color: { rgb: "000000" } },
            right: { style: "thin", color: { rgb: "000000" } }
          }
        };
      }
    });

    // Style data rows
    const range = XLSX.utils.decode_range(worksheet['!ref']);
    for (let R = 1; R <= range.e.r; ++R) {
      for (let C = 0; C <= 6; ++C) {
        const cellAddress = XLSX.utils.encode_cell({ r: R, c: C });
        if (worksheet[cellAddress]) {
          worksheet[cellAddress].s = {
            font: { sz: 10, name: "Calibri" },
            alignment: { horizontal: "left", vertical: "center" },
            border: {
              top: { style: "thin", color: { rgb: "000000" } },
              bottom: { style: "thin", color: { rgb: "000000" } },
              left: { style: "thin", color: { rgb: "000000" } },
              right: { style: "thin", color: { rgb: "000000" } }
            }
          };
        }
      }
    }

    // Create workbook and export
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Suppliers');
    const fileName = `suppliers_list_${new Date().toISOString().split('T')[0]}.xlsx`;
    XLSX.writeFile(workbook, fileName, { bookType: 'xlsx', cellStyles: true });
  };

  const totalSuppliers = allSuppliers.length;
  const activeSuppliers = allSuppliers.filter(s => s.status === 'active').length;

  const stats = [
    { label: 'Total Suppliers', value: totalSuppliers.toString(), color: 'bg-gradient-to-r from-[#D1FAE5] to-[#A7F3D0]' },
    { label: 'Active Suppliers', value: activeSuppliers.toString(), color: 'bg-gradient-to-r from-[#6EE7B7] to-[#34D399]' },
    { label: 'Pending Payouts', value: '₹12.4 L', color: 'bg-gradient-to-r from-[#10B981] to-[#059669]' },
    { label: 'Total Paid (Month)', value: '₹2.8 L', color: 'bg-gradient-to-r from-[#047857] to-[#065F46]' }
  ];



  return (
    <div className="p-4 sm:p-6 lg:p-8">
      {/* Header with Add Button and Export */}
      <div className="flex items-center justify-end gap-3 mb-6">
        <button
          onClick={handleExportSuppliers}
          className="bg-[#1DB890] hover:bg-[#19a57e] text-white px-4 sm:px-6 py-2.5 rounded-lg font-medium text-sm flex items-center gap-2 transition-colors shadow-sm"
        >
          <Download className="w-4 h-4" />
          Export Excel
        </button>
        <button
          onClick={() => navigate('/suppliers/add')}
          className="bg-[#0D7C66] hover:bg-[#0a6354] text-white px-4 sm:px-6 py-2.5 rounded-lg font-medium text-sm flex items-center gap-2 transition-colors shadow-sm"
        >
          <Plus className="w-4 h-4" />
          Add Supplier
        </button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        {stats.map((stat, index) => (
          <div
            key={index}
            className={`${stat.color} rounded-2xl p-6 ${index === 2 || index === 3 ? 'text-white' : 'text-[#0D5C4D]'
              }`}
          >
            <div className="text-sm font-medium mb-2 opacity-90">{stat.label}</div>
            <div className="text-4xl font-bold">{stat.value}</div>
          </div>
        ))}
      </div>

      {/* Search Bar and Filter */}
      <div className="flex flex-col sm:flex-row gap-4 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-[#6B8782]" size={20} />
          <input
            type="text"
            placeholder="Search suppliers by name, contact, or location..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-12 pr-4 py-3 bg-[#F0F4F3] border-none rounded-xl text-[#0D5C4D] placeholder-[#6B8782] focus:outline-none focus:ring-2 focus:ring-[#0D8568]"
          />
        </div>
        <select
          value={sortOrder}
          onChange={(e) => setSortOrder(e.target.value)}
          className="px-4 py-3 bg-[#F0F4F3] border-none rounded-xl text-[#0D5C4D] focus:outline-none focus:ring-2 focus:ring-[#0D8568] cursor-pointer"
        >
          <option value="early">Early Added</option>
          <option value="recent">Recently Added</option>
        </select>
      </div>

      {/* Suppliers Table */}
      <div className="bg-white rounded-2xl overflow-hidden border border-[#D0E0DB]">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-[#D4F4E8]">
                <th className="px-6 py-4 text-left text-sm font-semibold text-[#0D5C4D]">Supplier Name</th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-[#0D5C4D]">Product List</th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-[#0D5C4D]">Contact</th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-[#0D5C4D]">Place</th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-[#0D5C4D]">Status</th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-[#0D5C4D]">Action</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan="6" className="px-6 py-8 text-center text-[#6B8782]">
                    Loading suppliers...
                  </td>
                </tr>
              ) : suppliers.length === 0 ? (
                <tr>
                  <td colSpan="6" className="px-6 py-8 text-center text-[#6B8782]">
                    No suppliers found
                  </td>
                </tr>
              ) : suppliers.map((supplier, index) => (
                <tr
                  key={supplier.sid}
                  className={`border-b border-[#D0E0DB] hover:bg-[#F0F4F3] transition-colors ${index % 2 === 0 ? 'bg-white' : 'bg-[#F0F4F3]/30'
                    }`}
                >
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-[#B8F4D8] flex items-center justify-center text-[#0D5C4D] font-semibold text-sm overflow-hidden">
                        {supplier.profile_image ? (
                          <img
                            src={`${BASE_URL}${supplier.profile_image}`}
                            alt={supplier.supplier_name}
                            className="w-full h-full object-cover"
                            onError={(e) => {
                              //console.log('Image failed to load:', e.target.src);
                              e.target.style.display = 'none';
                            }}
                          />
                        ) : null}
                        {!supplier.profile_image && supplier.supplier_name?.substring(0, 2).toUpperCase()}
                      </div>
                      <div>
                        <div className="font-semibold text-[#0D5C4D]">{supplier.supplier_name}</div>
                        <div className="text-xs text-[#6B8782]">ID: {supplier.registration_number || 'N/A'}</div>
                      </div>
                    </div>
                  </td>

                  <td className="px-6 py-4">
                    <div className="flex flex-wrap gap-1.5">
                      {Array.isArray(supplier.product_list) && supplier.product_list.length > 0 ? (
                        <>
                          {supplier.product_list.slice(0, 2).map((product, idx) => (
                            <span
                              key={idx}
                              className="px-3 py-1.5 rounded-full text-xs font-medium bg-[#D4F4E8] text-[#047857]"
                            >
                              {product.product_name}
                            </span>
                          ))}
                          {supplier.product_list.length > 2 && (
                            <span className="px-3 py-1.5 rounded-full text-xs font-medium bg-[#0D7C66] text-white">
                              +{supplier.product_list.length - 2}
                            </span>
                          )}
                        </>
                      ) : <span className="text-xs text-[#6B8782]">No products</span>}
                    </div>
                  </td>

                  <td className="px-6 py-4">
                    <div className="text-sm text-[#0D5C4D]">{supplier.phone}</div>
                    <div className="text-xs text-[#6B8782]">{supplier.email}</div>
                  </td>

                  <td className="px-6 py-4">
                    <div className="text-sm text-[#0D5C4D]">{supplier.place}</div>
                  </td>

                  <td className="px-6 py-4">
                    <span className={`px-3 py-1.5 rounded-full text-xs font-medium flex items-center gap-1 w-fit ${supplier.status === 'active' ? 'bg-[#4ED39A] text-white' : 'bg-red-500 text-white'
                      }`}>
                      <div className="w-2 h-2 rounded-full bg-white"></div>
                      {supplier.status === 'active' ? 'Active' : 'Inactive'}
                    </span>
                  </td>

                  <td className="px-6 py-4">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleDropdown(supplier.sid, e);
                      }}
                      className="text-[#6B8782] hover:text-[#0D5C4D] transition-colors p-1 hover:bg-[#F0F4F3] rounded"
                    >
                      <MoreVertical size={20} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="flex items-center justify-between px-6 py-4 bg-[#F0F4F3] border-t border-[#D0E0DB]">
          <div className="text-sm text-[#6B8782]">
            Showing page {currentPage} of {totalPages}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage(Math.max(1, currentPage - 1))}
              disabled={currentPage === 1}
              className="px-3 py-2 text-[#6B8782] hover:bg-[#D0E0DB] rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
              &lt;
            </button>
            {[...Array(totalPages)].map((_, i) => (
              <button
                key={i + 1}
                onClick={() => setPage(i + 1)}
                className={`px-4 py-2 rounded-lg font-medium transition-colors ${currentPage === i + 1 ? 'bg-[#0D8568] text-white' : 'text-[#6B8782] hover:bg-[#D0E0DB]'
                  }`}>
                {i + 1}
              </button>
            ))}
            <button
              onClick={() => setPage(Math.min(totalPages, currentPage + 1))}
              disabled={currentPage === totalPages}
              className="px-3 py-2 text-[#6B8782] hover:bg-[#D0E0DB] rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
              &gt;
            </button>
          </div>
        </div>
      </div>

      {/* Dropdown Menu - Fixed Position Outside Table */}
      {openDropdown && (
        <div
          ref={dropdownRef}
          className="fixed w-32 bg-white rounded-lg shadow-lg border border-[#D0E0DB] py-1 z-[100]"
          style={{
            top: `${dropdownPosition.top}px`,
            left: `${dropdownPosition.left}px`
          }}
        >
          <button
            onClick={() => handleAction('view', openDropdown)}
            className="w-full text-left px-4 py-2 text-sm text-[#0D5C4D] hover:bg-[#F0F4F3] transition-colors"
          >
            View
          </button>
          <button
            onClick={() => handleAction('edit', openDropdown)}
            className="w-full text-left px-4 py-2 text-sm text-[#0D5C4D] hover:bg-[#F0F4F3] transition-colors"
          >
            Edit
          </button>
          <button
            onClick={() => handleAction('delete', openDropdown,
              suppliers.find(s => s.sid === openDropdown)?.supplier_name)}
            className="w-full text-left px-4 py-2 text-sm text-red-500 hover:bg-[#F0F4F3] transition-colors"
          >
            Delete
          </button>
        </div>
      )}

      <ConfirmDeleteModal
        isOpen={deleteModal.isOpen}
        onClose={() => setDeleteModal({ isOpen: false, supplierId: null, supplierName: '' })}
        onConfirm={async () => {
          try {
            await deleteSupplier(deleteModal.supplierId);
            setAllSuppliers(prev => prev.filter(s => s.sid !== deleteModal.supplierId));
            setDeleteModal({ isOpen: false, supplierId: null, supplierName: '' });
          } catch (error) {
            console.error('Failed to delete supplier:', error);
            alert('Failed to delete supplier');
          }
        }}
        title="Delete Supplier"
        message={`Are you sure you want to delete ${deleteModal.supplierName}? This action cannot be undone.`}
      />
    </div>
  );
};

export default SupplierDashboard;