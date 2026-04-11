import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Search, Plus, MoreVertical, Eye, Edit, Trash2, Download } from 'lucide-react';
import ConfirmDeleteModal from '../../common/ConfirmDeleteModal';
import { getAllThirdParties } from '../../../api/thirdPartyApi';
import { getAllProducts } from '../../../api/productApi';
import { BASE_URL } from '../../../config/config';
import { getOrderEntityPayoutAmounts, formatInrPayout } from '../../../utils/managementPayoutStats';
import * as XLSX from 'xlsx-js-style';

const ThirdPartyManagement = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const pageFromUrl = Math.max(1, parseInt(searchParams.get('page') || '1', 10) || 1);
  const [openDropdown, setOpenDropdown] = useState(null);
  const [dropdownPosition, setDropdownPosition] = useState({ top: 0, left: 0 });
  const dropdownRef = useRef(null);
  const [deleteModal, setDeleteModal] = useState({ isOpen: false, thirdPartyId: null, thirdPartyName: '' });
  const [thirdParties, setThirdParties] = useState([]);
  const [allProducts, setAllProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [currentPage, setCurrentPage] = useState(pageFromUrl);
  const [searchQuery, setSearchQuery] = useState('');
  const itemsPerPage = 7;
  const [payoutStats, setPayoutStats] = useState(null);

  useEffect(() => {
    let cancelled = false;
    getOrderEntityPayoutAmounts('third_party')
      .then((s) => {
        if (!cancelled) setPayoutStats(s);
      })
      .catch(() => {
        if (!cancelled) setPayoutStats({ pendingAmount: 0, paidThisMonthAmount: 0 });
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    setCurrentPage(pageFromUrl);
  }, [pageFromUrl]);

  const setPage = useCallback((page) => {
    const safePage = Math.max(1, page);
    setCurrentPage(safePage);
    setSearchParams(prev => {
      const next = new URLSearchParams(prev);
      if (safePage === 1) next.delete('page');
      else next.set('page', String(safePage));
      return next;
    });
  }, [setSearchParams]);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setOpenDropdown(null);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Fetch third parties and products data from API
  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const [thirdPartiesResponse, productsResponse] = await Promise.all([
          getAllThirdParties(),
          getAllProducts(1, 100)
        ]);

        if (thirdPartiesResponse.success) {
          setThirdParties(thirdPartiesResponse.data);
        } else {
          setError(thirdPartiesResponse.message || 'Failed to fetch third parties');
        }
        setAllProducts(productsResponse.data || []);
      } catch (err) {
        console.error('Error fetching data:', err);
        setError(err.message || 'An error occurred while fetching data');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  const toggleDropdown = (thirdPartyId, event) => {
    if (openDropdown === thirdPartyId) {
      setOpenDropdown(null);
    } else {
      const rect = event.currentTarget.getBoundingClientRect();
      setDropdownPosition({
        top: rect.bottom + window.scrollY + 8,
        left: rect.right + window.scrollX - 128 // 128px is dropdown width (w-32)
      });
      setOpenDropdown(thirdPartyId);
    }
  };

  const handleAction = (action, thirdPartyId, thirdPartyName) => {
    setOpenDropdown(null);
    if (action === 'view') {
      navigate(`/third-party/${thirdPartyId}`);
    } else if (action === 'edit') {
      navigate(`/third-party/${thirdPartyId}/edit`, { state: { returnTo: 'third-party', returnPage: currentPage } });
    } else if (action === 'delete') {
      setDeleteModal({ isOpen: true, thirdPartyId, thirdPartyName });
    }
  };

  // Export third parties to Excel
  const handleExportThirdParties = () => {
    if (thirdParties.length === 0) {
      alert('No third parties to export');
      return;
    }

    // Prepare data for export
    const exportData = thirdParties.map(thirdParty => ({
      'NAME': thirdParty.third_party_name || 'N/A',
      'FARM PLACE': thirdParty.city || 'N/A',
      'CONTACT#': thirdParty.phone || 'N/A',
      'ACC NAME': thirdParty.account_holder_name || 'N/A',
      'ACC NUMBER': thirdParty.account_number || 'N/A',
      'IFS CODE': thirdParty.IFSC_code || thirdParty.ifsc_code || 'N/A',
      'BRANCH': thirdParty.branch_name || 'N/A'
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
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Third Parties');
    const fileName = `third_parties_list_${new Date().toISOString().split('T')[0]}.xlsx`;
    XLSX.writeFile(workbook, fileName, { bookType: 'xlsx', cellStyles: true });
  };

  // Transform API data to match component structure
  const transformThirdPartiesData = (apiData) => {
    return apiData.map(thirdParty => ({
      id: thirdParty.tpid,
      name: thirdParty.third_party_name,
      thirdPartyId: `ID: TP-${String(thirdParty.tpid).padStart(3, '0')}`,
      // Use profile image if available, otherwise generate avatar
      profileImage: thirdParty.profile_image,
      avatar: thirdParty.third_party_name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase(),
      products: (() => {
        let productIds = [];
        if (thirdParty.product_list) {
          try {
            const parsed = JSON.parse(thirdParty.product_list);
            productIds = Array.isArray(parsed) ? parsed : [];
          } catch (e) {
            productIds = [];
          }
        }
        return productIds.map(id => {
          const product = allProducts.find(p => p.pid === id);
          return {
            name: product ? product.product_name : `Product ${id}`,
            color: 'bg-[#D4F4E8] text-[#047857]'
          };
        });
      })(),
      contact: `+91 ${thirdParty.phone}`,
      email: thirdParty.email,
      location: thirdParty.place || '',
      status: thirdParty.status.charAt(0).toUpperCase() + thirdParty.status.slice(1)
    }));
  };

  const stats = useMemo(() => {
    const data = thirdParties;
    if (!data || data.length === 0) {
      return [
        { label: 'Total Third Party', value: '0', change: '', color: 'bg-gradient-to-r from-[#D1FAE5] to-[#A7F3D0]' },
        { label: 'Active Third Party', value: '0', change: '', color: 'bg-gradient-to-r from-[#6EE7B7] to-[#34D399]' },
        {
          label: 'Pending Payouts',
          value: payoutStats == null ? '…' : formatInrPayout(payoutStats.pendingAmount),
          color: 'bg-gradient-to-r from-[#10B981] to-[#059669]'
        },
        {
          label: 'Total Paid (Month)',
          value: payoutStats == null ? '…' : formatInrPayout(payoutStats.paidThisMonthAmount),
          color: 'bg-gradient-to-r from-[#047857] to-[#065F46]'
        }
      ];
    }

    const activeCount = data.filter((tp) => tp.status === 'active').length;
    const totalCount = data.length;

    return [
      { label: 'Total Third Party', value: totalCount.toString(), change: '', color: 'bg-gradient-to-r from-[#D1FAE5] to-[#A7F3D0]' },
      { label: 'Active Third Party', value: activeCount.toString(), change: '', color: 'bg-gradient-to-r from-[#6EE7B7] to-[#34D399]' },
      {
        label: 'Pending Payouts',
        value: payoutStats == null ? '…' : formatInrPayout(payoutStats.pendingAmount),
        color: 'bg-gradient-to-r from-[#10B981] to-[#059669]'
      },
      {
        label: 'Total Paid (Month)',
        value: payoutStats == null ? '…' : formatInrPayout(payoutStats.paidThisMonthAmount),
        color: 'bg-gradient-to-r from-[#047857] to-[#065F46]'
      }
    ];
  }, [thirdParties, payoutStats]);

  const transformedThirdParties = transformThirdPartiesData(thirdParties);

  // Filter and paginate data
  const filteredThirdParties = transformedThirdParties.filter(tp =>
    tp.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    tp.contact.includes(searchQuery) ||
    tp.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
    tp.location.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const totalPages = Math.max(1, Math.ceil(filteredThirdParties.length / itemsPerPage));
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedThirdParties = filteredThirdParties.slice(startIndex, startIndex + itemsPerPage);

  useEffect(() => {
    if (!loading && !error && currentPage > totalPages) {
      setPage(totalPages);
    }
  }, [loading, error, currentPage, totalPages, setPage]);

  // Show loading state
  if (loading) {
    return (
      <div className="p-4 sm:p-6 lg:p-8">
        <div className="flex justify-center items-center h-64">
          <div className="text-lg text-[#0D5C4D]">Loading third parties...</div>
        </div>
      </div>
    );
  }

  // Show error state
  if (error) {
    return (
      <div className="p-4 sm:p-6 lg:p-8">
        <div className="bg-red-50 border border-red-200 rounded-lg p-6">
          <div className="text-red-800 text-center">
            <h3 className="font-bold text-lg mb-2">Error Loading Data</h3>
            <p>{error}</p>
            <button
              onClick={() => window.location.reload()}
              className="mt-4 bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 transition-colors"
            >
              Retry
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <div className="flex items-center justify-end gap-3 mb-6">
        <button
          onClick={handleExportThirdParties}
          className="bg-[#1DB890] hover:bg-[#19a57e] text-white px-4 sm:px-6 py-2.5 rounded-lg font-medium text-sm flex items-center gap-2 transition-colors shadow-sm"
        >
          <Download className="w-4 h-4" />
          Export Excel
        </button>
        <button
          onClick={() => navigate('/third-party/add')}
          className="bg-[#0D7C66] hover:bg-[#0a6354] text-white px-4 sm:px-6 py-2.5 rounded-lg font-medium text-sm flex items-center gap-2 transition-colors shadow-sm"
        >
          <Plus className="w-4 h-4" />
          Add Third Party
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        {stats.map((stat, index) => (
          <div
            key={index}
            className={`${stat.color} rounded-2xl p-6 ${index === 2 || index === 3 ? 'text-white' : 'text-[#0D5C4D]'}`}
          >
            <div className="text-sm font-medium mb-2 opacity-90">{stat.label}</div>
            <div className="text-4xl font-bold">{stat.value}</div>
            {stat.change && (
              <div className={`inline-block px-3 py-1 rounded-full text-xs font-medium mt-2 ${index === 2 || index === 3 ? 'bg-white/20 text-white' : 'bg-white/60 text-[#0D5C4D]'}`}>
                {stat.change}
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="relative mb-6">
        <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-[#6B8782]" size={20} />
        <input
          type="text"
          placeholder="Search third party by name, contact, or location..."
          value={searchQuery}
          onChange={(e) => {
            setSearchQuery(e.target.value);
            setPage(1);
          }}
          className="w-full pl-12 pr-4 py-3 bg-[#F0F4F3] border-none rounded-xl text-[#0D5C4D] placeholder-[#6B8782] focus:outline-none focus:ring-2 focus:ring-[#0D8568]"
        />
      </div>

      <div className="bg-white rounded-2xl overflow-hidden border border-[#D0E0DB]">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-[#D4F4E8]">
                <th className="px-6 py-4 text-left text-sm font-semibold text-[#0D5C4D]">Third Party Name</th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-[#0D5C4D]">Product List</th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-[#0D5C4D]">Contact</th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-[#0D5C4D]">Place</th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-[#0D5C4D]">Status</th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-[#0D5C4D]">Action</th>
              </tr>
            </thead>
            <tbody>
              {paginatedThirdParties.map((thirdParty, index) => (
                <tr
                  key={thirdParty.id}
                  className={`border-b border-[#D0E0DB] hover:bg-[#F0F4F3] transition-colors ${index % 2 === 0 ? 'bg-white' : 'bg-[#F0F4F3]/30'}`}
                >
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      {thirdParty.profileImage ? (
                        <img
                          src={`${BASE_URL}${thirdParty.profileImage}`}
                          alt={thirdParty.name}
                          className="w-10 h-10 rounded-full object-cover"
                          onError={(e) => {
                            e.target.outerHTML = `<div class="w-10 h-10 rounded-full bg-[#B8F4D8] flex items-center justify-center text-[#0D5C4D] font-semibold text-sm">${thirdParty.avatar}</div>`;
                          }}
                        />
                      ) : (
                        <div className="w-10 h-10 rounded-full bg-[#B8F4D8] flex items-center justify-center text-[#0D5C4D] font-semibold text-sm">
                          {thirdParty.avatar}
                        </div>
                      )}
                      <div>
                        <div className="font-semibold text-[#0D5C4D]">{thirdParty.name}</div>
                        <div className="text-xs text-[#6B8782]">{thirdParty.thirdPartyId}</div>
                      </div>
                    </div>
                  </td>

                  <td className="px-6 py-4">
                    <div className="flex flex-wrap gap-1.5">
                      {thirdParty.products.length > 0 ? (
                        <>
                          {thirdParty.products.slice(0, 2).map((product, idx) => (
                            <span
                              key={idx}
                              className="px-3 py-1.5 rounded-full text-xs font-medium bg-[#D4F4E8] text-[#047857]"
                            >
                              {product.name}
                            </span>
                          ))}
                          {thirdParty.products.length > 2 && (
                            <span className="px-3 py-1.5 rounded-full text-xs font-medium bg-[#0D7C66] text-white">
                              +{thirdParty.products.length - 2}
                            </span>
                          )}
                        </>
                      ) : (
                        <span className="text-xs text-[#6B8782]">No products</span>
                      )}
                    </div>
                  </td>

                  <td className="px-6 py-4">
                    <div className="text-sm text-[#0D5C4D]">{thirdParty.contact}</div>
                    <div className="text-xs text-[#6B8782]">{thirdParty.email}</div>
                  </td>

                  <td className="px-6 py-4">
                    <div className="text-sm text-[#0D5C4D]">{thirdParty.location}</div>
                  </td>

                  <td className="px-6 py-4">
                    <span className={`px-3 py-1.5 rounded-full text-xs font-medium flex items-center gap-1 w-fit ${thirdParty.status === 'Active' ? 'bg-[#4ED39A] text-white' : 'bg-red-500 text-white'}`}>
                      <div className="w-2 h-2 rounded-full bg-white"></div>
                      {thirdParty.status}
                    </span>
                  </td>

                  <td className="px-6 py-4">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleDropdown(thirdParty.id, e);
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

        <div className="flex items-center justify-between px-6 py-4 bg-[#F0F4F3] border-t border-[#D0E0DB]">
          <div className="text-sm text-[#6B8782]">
            Showing {startIndex + 1}-{Math.min(startIndex + itemsPerPage, filteredThirdParties.length)} of {filteredThirdParties.length} third parties
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage(Math.max(1, currentPage - 1))}
              disabled={currentPage === 1}
              className="px-3 py-2 text-[#6B8782] hover:bg-[#D0E0DB] rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              &lt;
            </button>
            {[...Array(totalPages)].map((_, i) => (
              <button
                key={i + 1}
                onClick={() => setPage(i + 1)}
                className={`px-4 py-2 rounded-lg font-medium transition-colors ${currentPage === i + 1 ? 'bg-[#0D8568] text-white' : 'text-[#6B8782] hover:bg-[#D0E0DB]'
                  }`}
              >
                {i + 1}
              </button>
            ))}
            <button
              onClick={() => setPage(Math.min(totalPages, currentPage + 1))}
              disabled={currentPage === totalPages}
              className="px-3 py-2 text-[#6B8782] hover:bg-[#D0E0DB] rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
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
              transformedThirdParties.find(tp => tp.id === openDropdown)?.name)}
            className="w-full text-left px-4 py-2 text-sm text-red-500 hover:bg-[#F0F4F3] transition-colors flex items-center gap-2"
          >
            <Trash2 size={14} />
            Delete
          </button>
        </div>
      )}

      <ConfirmDeleteModal
        isOpen={deleteModal.isOpen}
        onClose={() => setDeleteModal({ isOpen: false, thirdPartyId: null, thirdPartyName: '' })}
        onConfirm={() => {
          //console.log('Deleting third party:', deleteModal.thirdPartyId);
          setDeleteModal({ isOpen: false, thirdPartyId: null, thirdPartyName: '' });
        }}
        title="Delete Third Party"
        message={`Are you sure you want to delete ${deleteModal.thirdPartyName}? This action cannot be undone.`}
      />
    </div>
  );
};

export default ThirdPartyManagement;