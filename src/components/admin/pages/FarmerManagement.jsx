import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Search,
  Plus,
  MoreVertical,
  ChevronLeft,
  ChevronRight,
  Eye,
  Edit,
  Trash2,
  Download
} from 'lucide-react';
import ConfirmDeleteModal from '../../common/ConfirmDeleteModal';
import { getAllFarmers, deleteFarmer } from '../../../api/farmerApi';
import { getAllProducts } from '../../../api/productApi';
import { BASE_URL } from '../../../config/config';
import * as XLSX from 'xlsx-js-style';

const Farmers = () => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('all'); // all or orderList
  const [openDropdown, setOpenDropdown] = useState(null);
  const [dropdownPosition, setDropdownPosition] = useState({ top: 0, left: 0 });
  const dropdownRef = useRef(null);
  const [deleteModal, setDeleteModal] = useState({ isOpen: false, farmerId: null, farmerName: '' });
  const [farmers, setFarmers] = useState([]);
  const [allFarmers, setAllFarmers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortOrder, setSortOrder] = useState('recent');
  const itemsPerPage = 7;

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [farmersResponse, productsResponse] = await Promise.all([
          getAllFarmers(),
          getAllProducts(1, 100)
        ]);

        const products = productsResponse.data || [];
        const productMap = {};
        products.forEach(p => {
          productMap[p.pid] = p.product_name;
        });

        const farmersData = (farmersResponse.data || []).map(farmer => {
          let productList = [];
          if (typeof farmer.product_list === 'string') {
            try {
              const parsed = JSON.parse(farmer.product_list);
              if (Array.isArray(parsed)) {
                productList = parsed.map(item =>
                  typeof item === 'object' && item.pid
                    ? { product_id: item.pid, product_name: item.product_name }
                    : { product_id: item, product_name: productMap[item] || `Product ${item}` }
                );
              }
            } catch (e) {
              productList = [];
            }
          }
          return { ...farmer, product_list: productList };
        });

        setAllFarmers(farmersData);
      } catch (error) {
        console.error('Failed to fetch data:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  useEffect(() => {
    let filtered = [...allFarmers];

    if (searchQuery) {
      filtered = filtered.filter(farmer =>
        farmer.farmer_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        farmer.phone?.includes(searchQuery) ||
        farmer.email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        farmer.city?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        farmer.state?.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    if (sortOrder === 'early') {
      filtered.sort((a, b) => a.fid - b.fid);
    } else {
      filtered.sort((a, b) => b.fid - a.fid);
    }

    setTotalPages(Math.ceil(filtered.length / itemsPerPage));
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    setFarmers(filtered.slice(startIndex, endIndex));
  }, [allFarmers, searchQuery, sortOrder, currentPage]);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setOpenDropdown(null);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const toggleDropdown = (farmerId, event) => {
    if (openDropdown === farmerId) {
      setOpenDropdown(null);
    } else {
      const rect = event.currentTarget.getBoundingClientRect();
      setDropdownPosition({
        top: rect.bottom + window.scrollY + 8,
        left: rect.right + window.scrollX - 128 // 128px is dropdown width (w-32)
      });
      setOpenDropdown(farmerId);
    }
  };

  const handleAction = (action, farmerId, farmerName) => {
    if (action === 'view') {
      navigate(`/farmers/${farmerId}`);
    } else if (action === 'edit') {
      navigate(`/farmers/${farmerId}/edit`);
    } else if (action === 'delete') {
      setDeleteModal({ isOpen: true, farmerId, farmerName });
    }
    setOpenDropdown(null);
  };

  // Export farmers to Excel
  const handleExportFarmers = () => {
    if (allFarmers.length === 0) {
      alert('No farmers to export');
      return;
    }

    // Prepare data for export
    const exportData = allFarmers.map(farmer => ({
      'NAME': farmer.farmer_name || 'N/A',
      'FARM PLACE': farmer.city || 'N/A',
      'CONTACT#': farmer.phone || 'N/A',
      'ACC NAME': farmer.account_holder_name || 'N/A',
      'ACC NUMBER': farmer.account_number || 'N/A',
      'IFS CODE': farmer.IFSC_code || 'N/A',
      'BRANCH': farmer.branch_name || 'N/A'
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
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Farmers');
    const fileName = `farmers_list_${new Date().toISOString().split('T')[0]}.xlsx`;
    XLSX.writeFile(workbook, fileName, { bookType: 'xlsx', cellStyles: true });
  };

  const totalFarmers = allFarmers.length;
  const activeFarmers = allFarmers.filter(f => f.status === 'active').length;

  // Pagination: truncated range with ellipsis (e.g. 1 2 ... 9)
  const getPaginationPages = () => {
    if (totalPages <= 5) {
      return Array.from({ length: totalPages }, (_, i) => i + 1);
    }
    const pages = new Set([1, totalPages]);
    for (let i = Math.max(1, currentPage - 1); i <= Math.min(totalPages, currentPage + 1); i++) {
      pages.add(i);
    }
    const sorted = Array.from(pages).sort((a, b) => a - b);
    const result = [];
    for (let i = 0; i < sorted.length; i++) {
      result.push(sorted[i]);
      if (i < sorted.length - 1 && sorted[i + 1] - sorted[i] > 1) {
        result.push('...');
      }
    }
    return result;
  };
  const paginationPages = getPaginationPages();

  const stats = [
    { label: 'Total Farmers', value: totalFarmers.toString(), color: 'bg-gradient-to-r from-[#D1FAE5] to-[#A7F3D0]' },
    { label: 'Active Farmers', value: activeFarmers.toString(), color: 'bg-gradient-to-r from-[#6EE7B7] to-[#34D399]' },
    { label: 'Pending Payouts', value: '309,847', color: 'bg-gradient-to-r from-[#10B981] to-[#059669]' },
    { label: 'Total Paid (Month)', value: '156', color: 'bg-gradient-to-r from-[#047857] to-[#065F46]' }
  ];

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      {/* Header with Add Button and Export */}
      <div className="flex items-center justify-end gap-3 mb-6">
        <button
          onClick={handleExportFarmers}
          className="bg-[#1DB890] hover:bg-[#19a57e] text-white px-4 sm:px-6 py-2.5 rounded-lg font-medium text-sm flex items-center gap-2 transition-colors shadow-sm"
        >
          <Download className="w-4 h-4" />
          Export Excel
        </button>
        <button
          onClick={() => navigate('/farmers/add')}
          className="bg-[#0D7C66] hover:bg-[#0a6354] text-white px-4 sm:px-6 py-2.5 rounded-lg font-medium text-sm flex items-center gap-2 transition-colors shadow-sm"
        >
          <Plus className="w-4 h-4" />
          Add Farmer
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
            placeholder="Search farmers by name, contact, or location..."
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

      {/* Farmers Table */}
      <div className="bg-white rounded-2xl overflow-hidden border border-[#D0E0DB]">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-[#D4F4E8]">
                <th className="px-6 py-4 text-left text-sm font-semibold text-[#0D5C4D]">Farmer Name</th>
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
                    Loading farmers...
                  </td>
                </tr>
              ) : farmers.length === 0 ? (
                <tr>
                  <td colSpan="6" className="px-6 py-8 text-center text-[#6B8782]">
                    No farmers found
                  </td>
                </tr>
              ) : farmers.map((farmer, index) => (
                <tr
                  key={farmer.fid}
                  className={`border-b border-[#D0E0DB] hover:bg-[#F0F4F3] transition-colors ${index % 2 === 0 ? 'bg-white' : 'bg-[#F0F4F3]/30'
                    }`}
                >
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-[#B8F4D8] flex items-center justify-center text-[#0D5C4D] font-semibold text-sm overflow-hidden">
                        {farmer.profile_image ? (
                          <img
                            src={`${BASE_URL}${farmer.profile_image}`}
                            alt={farmer.farmer_name}
                            className="w-full h-full object-cover"
                            onError={(e) => {
                              e.target.style.display = 'none';
                            }}
                          />
                        ) : null}
                        {!farmer.profile_image && farmer.farmer_name?.substring(0, 2).toUpperCase()}
                      </div>
                      <div>
                        <div className="font-semibold text-[#0D5C4D]">{farmer.farmer_name}</div>
                        <div className="text-xs text-[#6B8782]">ID: {farmer.registration_number || 'N/A'}</div>
                      </div>
                    </div>
                  </td>

                  <td className="px-6 py-4">
                    <div className="flex flex-wrap gap-1.5">
                      {Array.isArray(farmer.product_list) && farmer.product_list.length > 0 ? (
                        <>
                          {farmer.product_list.slice(0, 2).map((product, idx) => (
                            <span
                              key={idx}
                              className="px-3 py-1.5 rounded-full text-xs font-medium bg-[#D4F4E8] text-[#047857]"
                            >
                              {product.product_name}
                            </span>
                          ))}
                          {farmer.product_list.length > 2 && (
                            <span className="px-3 py-1.5 rounded-full text-xs font-medium bg-[#0D7C66] text-white">
                              +{farmer.product_list.length - 2}
                            </span>
                          )}
                        </>
                      ) : <span className="text-xs text-[#6B8782]">No products</span>}
                    </div>
                  </td>

                  <td className="px-6 py-4">
                    <div className="text-sm text-[#0D5C4D]">{farmer.phone}</div>
                    <div className="text-xs text-[#6B8782]">{farmer.email}</div>
                  </td>

                  <td className="px-6 py-4">
                    <div className="text-sm text-[#0D5C4D]">{farmer.place}</div>
                  </td>

                  <td className="px-6 py-4">
                    <span className={`px-3 py-1.5 rounded-full text-xs font-medium flex items-center gap-1 w-fit ${farmer.status === 'active' ? 'bg-[#4ED39A] text-white' : 'bg-red-500 text-white'
                      }`}>
                      <div className="w-2 h-2 rounded-full bg-white"></div>
                      {farmer.status === 'active' ? 'Active' : 'Inactive'}
                    </span>
                  </td>

                  <td className="px-6 py-4">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleDropdown(farmer.fid, e);
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

        {/* Pagination - truncated with ellipsis */}
        <div className="flex items-center justify-between px-6 py-4 bg-[#F0F4F3] border-t border-[#D0E0DB]">
          <div className="text-sm text-[#6B8782]">
            Showing page {currentPage} of {totalPages}
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
              disabled={currentPage === 1}
              className="p-2 text-[#6B8782] hover:bg-[#D0E0DB] rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              aria-label="Previous page"
            >
              <ChevronLeft size={20} />
            </button>
            {paginationPages.map((page, idx) =>
              page === '...' ? (
                <span key={`ellipsis-${idx}`} className="px-2 py-2 text-[#6B8782]">
                  ...
                </span>
              ) : (
                <button
                  key={page}
                  onClick={() => setCurrentPage(page)}
                  className={`min-w-[2.25rem] px-3 py-2 rounded-lg font-medium transition-colors ${
                    currentPage === page
                      ? 'bg-[#0D8568] text-white'
                      : 'text-[#6B8782] hover:bg-[#D0E0DB]'
                  }`}
                >
                  {page}
                </button>
              )
            )}
            <button
              onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
              disabled={currentPage === totalPages}
              className="p-2 text-[#6B8782] hover:bg-[#D0E0DB] rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              aria-label="Next page"
            >
              <ChevronRight size={20} />
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
            className="w-full text-left px-4 py-2 text-sm text-[#0D5C4D] hover:bg-[#F0F4F3] transition-colors flex items-center gap-2"
          >
            <Eye size={14} />
            View
          </button>
          <button
            onClick={() => handleAction('edit', openDropdown)}
            className="w-full text-left px-4 py-2 text-sm text-[#0D5C4D] hover:bg-[#F0F4F3] transition-colors flex items-center gap-2"
          >
            <Edit size={14} />
            Edit
          </button>
          <button
            onClick={() => handleAction('delete', openDropdown,
              farmers.find(f => f.fid === openDropdown)?.farmer_name)}
            className="w-full text-left px-4 py-2 text-sm text-red-500 hover:bg-[#F0F4F3] transition-colors flex items-center gap-2"
          >
            <Trash2 size={14} />
            Delete
          </button>
        </div>
      )}

      <ConfirmDeleteModal
        isOpen={deleteModal.isOpen}
        onClose={() => setDeleteModal({ isOpen: false, farmerId: null, farmerName: '' })}
        onConfirm={async () => {
          try {
            await deleteFarmer(deleteModal.farmerId);
            const response = await getAllFarmers();
            setAllFarmers(response.data || []);
            setDeleteModal({ isOpen: false, farmerId: null, farmerName: '' });
          } catch (error) {
            console.error('Failed to delete farmer:', error);
          }
        }}
        title="Delete Farmer"
        message={`Are you sure you want to delete ${deleteModal.farmerName}? This action cannot be undone.`}
      />
    </div>
  );
};

export default Farmers;