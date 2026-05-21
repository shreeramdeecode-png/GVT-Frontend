import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Search, Plus, MoreVertical, Eye, Edit, Trash2, Download } from 'lucide-react';
import ConfirmDeleteModal from '../../common/ConfirmDeleteModal';
import { getAllVendors } from '../../../api/vendorApi';
import { fetchAllProducts } from '../../../api/productApi';
import { BASE_URL } from '../../../config/config';
import * as XLSX from 'xlsx-js-style';
import { usePermissions } from '../../../context/PermissionsContext';

const VendorDashboard = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { loading: permLoading, hasPermission } = usePermissions();
  const pageFromUrl = Math.max(1, parseInt(searchParams.get('page') || '1', 10) || 1);
  const [searchQuery, setSearchQuery] = useState('');
  const [openDropdown, setOpenDropdown] = useState(null);
  const [dropdownPosition, setDropdownPosition] = useState({ top: 0, left: 0 });
  const dropdownRef = useRef(null);
  const [deleteModal, setDeleteModal] = useState({ isOpen: false, vendorId: null, vendorName: '' });
  const [vendors, setVendors] = useState([]);
  const [allProducts, setAllProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [currentPage, setCurrentPage] = useState(pageFromUrl);
  const itemsPerPage = 7;

  // Sync currentPage with URL on load and when URL changes (e.g. after refresh)
  useEffect(() => {
    setCurrentPage(pageFromUrl);
  }, [pageFromUrl]);

  // Fetch vendors and products from API
  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const [vendorsResponse, productsResponse] = await Promise.all([
          getAllVendors(1, 100),
          fetchAllProducts()
        ]);

        const products = Array.isArray(productsResponse) ? productsResponse : (productsResponse?.data || []);
        const productMap = {};
        products.forEach(p => {
          productMap[p.pid] = p.product_name;
        });

        const vendorsData = (vendorsResponse.data || []).map(vendor => {
          let productList = [];
          if (typeof vendor.product_list === 'string') {
            try {
              const parsed = JSON.parse(vendor.product_list);
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
          return { ...vendor, product_list: productList };
        });

        setVendors(vendorsData);
        setAllProducts(products);
      } catch (err) {
        console.error('Error fetching data:', err);
        setError('Failed to load data');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setOpenDropdown(null);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

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

  const toggleDropdown = (vendorKey, event) => {
    if (openDropdown === vendorKey) {
      setOpenDropdown(null);
    } else {
      const rect = event.currentTarget.getBoundingClientRect();
      setDropdownPosition({
        top: rect.bottom + window.scrollY + 8,
        left: rect.right + window.scrollX - 128 // 128px is dropdown width (w-32)
      });
      setOpenDropdown(vendorKey);
    }
  };

  const handleAction = (action, vendor) => {
    if (action === 'view') {
      // Navigate based on vendor type
      if (vendor.vendor_type === 'farmer') {
        navigate(`/farmers/${vendor.fid}`);
      } else if (vendor.vendor_type === 'supplier') {
        navigate(`/suppliers/${vendor.sid}`);
      } else if (vendor.vendor_type === 'third party') {
        navigate(`/third-party/${vendor.tpid}`);
      }
    } else if (action === 'edit') {
      // Navigate to edit based on vendor type; pass current page so we can return to it
      const state = { returnTo: 'vendors', returnPage: currentPage };
      if (vendor.vendor_type === 'farmer') {
        navigate(`/farmers/${vendor.fid}/edit`, { state });
      } else if (vendor.vendor_type === 'supplier') {
        navigate(`/suppliers/${vendor.sid}/edit`, { state });
      } else if (vendor.vendor_type === 'third party') {
        navigate(`/third-party/${vendor.tpid}/edit`, { state });
      }
    } else if (action === 'delete') {
      setDeleteModal({ isOpen: true, vendor, vendorName: vendor.name || vendor.farmer_name || vendor.supplier_name || vendor.third_party_name });
    }
    setOpenDropdown(null);
  };

  // Transform vendor data for display
  const transformVendorData = (vendor) => {
    let vendorType = vendor.vendor_type || 'Unknown';
    let vendorId = '';
    let vendorName = '';
    let contact = '';
    let email = '';
    let location = '';
    let products = [];

    // Use already parsed product_list from useEffect
    if (Array.isArray(vendor.product_list) && vendor.product_list.length > 0) {
      products = vendor.product_list.map(product => ({
        name: product.product_name,
        color: 'bg-[#D4F4E8] text-[#047857]'
      }));
    }

    if (vendor.vendor_type === 'farmer') {
      vendorType = 'Farmer';
      vendorId = vendor.fid || '';
      vendorName = vendor.farmer_name || vendor.name || 'Unknown Farmer';
      contact = vendor.phone || vendor.primary_phone || '';
      email = vendor.email || '';
      location = vendor.place || '';
    } else if (vendor.vendor_type === 'supplier') {
      vendorType = 'Supplier';
      vendorId = vendor.sid || '';
      vendorName = vendor.supplier_name || vendor.name || 'Unknown Supplier';
      contact = vendor.phone || vendor.primary_phone || '';
      email = vendor.email || '';
      location = vendor.place || '';
    } else if (vendor.vendor_type === 'third party') {
      vendorType = 'Third Party';
      vendorId = vendor.tpid || '';
      vendorName = vendor.third_party_name || vendor.name || 'Unknown Third Party';
      contact = vendor.phone || vendor.primary_phone || '';
      email = vendor.email || '';
      location = vendor.place || '';
    }

    return {
      ...vendor,
      vendorType,
      vendorId: `ID: ${vendorId}`,
      name: vendorName,
      contact,
      email,
      location,
      products,
      status: vendor.status || 'Active'
    };
  };

  // Transform all vendors
  const transformedVendors = vendors.map(transformVendorData);

  // Filter vendors based on search query
  const filteredVendors = transformedVendors.filter(vendor => {
    const searchLower = searchQuery.toLowerCase();
    return (
      vendor.name.toLowerCase().includes(searchLower) ||
      vendor.contact.toLowerCase().includes(searchLower) ||
      vendor.email.toLowerCase().includes(searchLower) ||
      vendor.location.toLowerCase().includes(searchLower) ||
      vendor.vendorType.toLowerCase().includes(searchLower)
    );
  });

  // Calculate stats
  const farmerCount = vendors.filter(v => v.vendor_type === 'farmer').length;
  const supplierCount = vendors.filter(v => v.vendor_type === 'supplier').length;
  const thirdPartyCount = vendors.filter(v => v.vendor_type === 'third party').length;
  const totalCount = vendors.length;

  const stats = [
    { label: 'Total Vendors', value: totalCount.toString(), change: '', color: 'bg-gradient-to-r from-[#D1FAE5] to-[#A7F3D0]' },
    { label: 'Farmers', value: farmerCount.toString(), change: '', color: 'bg-gradient-to-r from-[#6EE7B7] to-[#34D399]' },
    { label: 'Suppliers', value: supplierCount.toString(), change: '', color: 'bg-gradient-to-r from-[#10B981] to-[#059669]' },
    { label: 'Third Party', value: thirdPartyCount.toString(), change: '', color: 'bg-gradient-to-r from-[#047857] to-[#065F46]' }
  ];

  // Pagination calculations (before early returns so hooks are always called)
  const totalPages = Math.max(1, Math.ceil(filteredVendors.length / itemsPerPage));
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedVendors = filteredVendors.slice(startIndex, startIndex + itemsPerPage);

  // Clamp current page to valid range when totalPages shrinks (e.g. after search)
  useEffect(() => {
    if (!loading && !permLoading && currentPage > totalPages) {
      setPage(totalPages);
    }
  }, [loading, permLoading, currentPage, totalPages, setPage]);

  // Export vendors to Excel with all details
  const handleExportVendors = async () => {
    if (transformedVendors.length === 0) {
      alert('No vendors to export');
      return;
    }

    try {
      // Import the necessary APIs
      const { getFarmerById } = await import('../../../api/farmerApi');
      const { getSupplierById } = await import('../../../api/supplierApi');
      const { getThirdPartyById } = await import('../../../api/thirdPartyApi');

      // Fetch detailed data for all vendors
      const detailedVendors = await Promise.all(
        vendors.map(async (vendor) => {
          try {
            let response = null;
            if (vendor.vendor_type === 'farmer') {
              response = await getFarmerById(vendor.fid);
            } else if (vendor.vendor_type === 'supplier') {
              response = await getSupplierById(vendor.sid);
            } else if (vendor.vendor_type === 'third party') {
              response = await getThirdPartyById(vendor.tpid);
            }

            // Debug: Log the response to see the structure
            console.log(`Vendor ${vendor.vendor_type} response:`, response);

            return {
              ...vendor,
              details: response?.data || response,
              rawResponse: response
            };
          } catch (error) {
            console.error(`Error fetching vendor details:`, error);
            return { ...vendor, details: null };
          }
        })
      );

      // Debug: Log all detailed vendors
      console.log('All detailed vendors:', detailedVendors);

      // Prepare data for export with all fields
      const exportData = detailedVendors.map(vendor => {
        const details = vendor.details || vendor;
        const vendorType = vendor.vendor_type;

        console.log(`Processing ${vendorType}:`, details);

        // Common fields for all vendor types
        const commonData = {
          'VENDOR TYPE': vendorType === 'farmer' ? 'Farmer' : vendorType === 'supplier' ? 'Supplier' : 'Third Party',
          'NAME': details.farmer_name || details.supplier_name || details.third_party_name || vendor.name || 'N/A',
          'PHONE': details.phone || details.phone_number || details.primary_phone || vendor.phone || 'N/A',
          'EMAIL': details.email || vendor.email || 'N/A',
          'ADDRESS': details.address || vendor.address || 'N/A',
          'CITY': details.city || vendor.city || 'N/A',
          'STATE': details.state || vendor.state || 'N/A',
          'PIN CODE': details.pin_code || details.pincode || vendor.pin_code || 'N/A',
          'STATUS': details.status || vendor.status || 'N/A'
        };

        // Type-specific fields
        if (vendorType === 'farmer') {
          return {
            ...commonData,
            'FARMER ID': details.fid || vendor.fid || 'N/A',
            'ALTERNATE PHONE': details.alternate_phone || details.secondary_phone || 'N/A',
            'FARM SIZE': details.farm_size || details.farmSize || 'N/A',
            'FARMING TYPE': details.farming_type || details.farmingType || 'N/A',
            'BANK NAME': details.bank_name || details.bankName || 'N/A',
            'ACCOUNT NUMBER': details.account_number || details.accountNumber || 'N/A',
            'IFSC CODE': details.ifsc_code || details.ifscCode || 'N/A',
            'BRANCH': details.branch || 'N/A',
            'REGISTRATION NUMBER': details.registration_number || details.registrationNumber || vendor.registration_number || 'N/A',
            'GST NUMBER': details.gst_number || details.gstNumber || 'N/A'
          };
        } else if (vendorType === 'supplier') {
          return {
            ...commonData,
            'SUPPLIER ID': details.sid || vendor.sid || 'N/A',
            'ALTERNATE PHONE': details.alternate_phone || details.secondary_phone || 'N/A',
            'COMPANY NAME': details.company_name || details.companyName || 'N/A',
            'BUSINESS TYPE': details.business_type || details.businessType || 'N/A',
            'BANK NAME': details.bank_name || details.bankName || 'N/A',
            'ACCOUNT NUMBER': details.account_number || details.accountNumber || 'N/A',
            'IFSC CODE': details.ifsc_code || details.ifscCode || 'N/A',
            'BRANCH': details.branch || 'N/A',
            'REGISTRATION NUMBER': details.registration_number || details.registrationNumber || vendor.registration_number || 'N/A',
            'GST NUMBER': details.gst_number || details.gstNumber || 'N/A'
          };
        } else {
          // Third Party
          return {
            ...commonData,
            'THIRD PARTY ID': details.tpid || vendor.tpid || 'N/A',
            'ALTERNATE PHONE': details.alternate_phone || details.secondary_phone || 'N/A',
            'COMPANY NAME': details.company_name || details.companyName || 'N/A',
            'BUSINESS TYPE': details.business_type || details.businessType || 'N/A',
            'BANK NAME': details.bank_name || details.bankName || 'N/A',
            'ACCOUNT NUMBER': details.account_number || details.accountNumber || 'N/A',
            'IFSC CODE': details.ifsc_code || details.ifscCode || 'N/A',
            'BRANCH': details.branch || 'N/A',
            'REGISTRATION NUMBER': details.registration_number || details.registrationNumber || vendor.registration_number || 'N/A',
            'GST NUMBER': details.gst_number || details.gstNumber || 'N/A'
          };
        }
      });

      console.log('Export data:', exportData);

      if (exportData.length === 0) {
        alert('No vendor data available to export');
        return;
      }

      // Create worksheet
      const worksheet = XLSX.utils.json_to_sheet(exportData);

      // Set column widths (adjust based on number of columns)
      const headers = Object.keys(exportData[0]);
      worksheet['!cols'] = headers.map(() => ({ wch: 20 }));

      // Get the range of cells
      const range = XLSX.utils.decode_range(worksheet['!ref']);
      const numCols = range.e.c + 1;

      // Style header row
      const headerCells = [];
      for (let C = 0; C < numCols; C++) {
        headerCells.push(XLSX.utils.encode_cell({ r: 0, c: C }));
      }

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
      for (let R = 1; R <= range.e.r; ++R) {
        for (let C = 0; C < numCols; ++C) {
          const cellAddress = XLSX.utils.encode_cell({ r: R, c: C });
          if (worksheet[cellAddress]) {
            worksheet[cellAddress].s = {
              font: { sz: 11, name: "Calibri" },
              alignment: { horizontal: "center", vertical: "center" },
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

      // Create workbook and add worksheet
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Vendors');

      // Generate Excel file and trigger download
      const fileName = `vendors_detailed_${new Date().toISOString().split('T')[0]}.xlsx`;
      XLSX.writeFile(workbook, fileName, { bookType: 'xlsx', cellStyles: true });
    } catch (error) {
      console.error('Error exporting vendors:', error);
      alert('Failed to export vendor data. Please try again.');
    }
  };

  if (loading || permLoading) {
    return (
      <div className="p-4 sm:p-6 lg:p-8">
        <div className="flex justify-center items-center h-64">
          <div className="text-lg text-[#0D5C4D]">Loading vendors...</div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 sm:p-6 lg:p-8">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="text-red-800 text-sm">{error}</div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      {/* Header with Add Button */}
      <div className="flex items-center justify-end gap-3 mb-6">
        {hasPermission('Vendors', 'view') && (
          <button
            onClick={handleExportVendors}
            className="bg-[#1DB890] hover:bg-[#19a57e] text-white px-4 sm:px-6 py-2.5 rounded-lg font-medium text-sm flex items-center gap-2 transition-colors shadow-sm"
          >
            <Download className="w-4 h-4" />
            Export Excel
          </button>
        )}
        {hasPermission('Vendors', 'add') && (
          <button
            onClick={() => navigate('/vendors/add')}
            className="bg-[#0D7C66] hover:bg-[#0a6354] text-white px-4 sm:px-6 py-2.5 rounded-lg font-medium text-sm flex items-center gap-2 transition-colors shadow-sm"
          >
            <Plus className="w-4 h-4" />
            Add Vendor
          </button>
        )}
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
            <div className="text-4xl font-bold mb-2">{stat.value}</div>
            {stat.change && (
              <div className={`inline-block px-3 py-1 rounded-full text-xs font-medium ${index === 2 || index === 3
                ? 'bg-white/20 text-white'
                : 'bg-white/60 text-[#0D5C4D]'
                }`}>
                {stat.change}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Search Bar */}
      <div className="relative mb-6">
        <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-[#6B8782]" size={20} />
        <input
          type="text"
          placeholder="Search vendors by name, contact, or location..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full pl-12 pr-4 py-3 bg-[#F0F4F3] border-none rounded-xl text-[#0D5C4D] placeholder-[#6B8782] focus:outline-none focus:ring-2 focus:ring-[#0D8568]"
        />
      </div>

      {/* Vendors Table */}
      <div className="bg-white rounded-2xl overflow-hidden border border-[#D0E0DB]">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-[#D4F4E8]">
                <th className="px-6 py-4 text-left text-sm font-semibold text-[#0D5C4D]">Vendor Name</th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-[#0D5C4D]">Type</th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-[#0D5C4D]">Product List</th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-[#0D5C4D]">Contact</th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-[#0D5C4D]">Place</th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-[#0D5C4D]">Status</th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-[#0D5C4D]">Action</th>
              </tr>
            </thead>
            <tbody>
              {paginatedVendors.map((vendor, index) => (
                <tr
                  key={`${vendor.vendor_type}-${vendor.vendorId}`}
                  className={`border-b border-[#D0E0DB] hover:bg-[#F0F4F3] transition-colors ${index % 2 === 0 ? 'bg-white' : 'bg-[#F0F4F3]/30'
                    }`}
                >
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-[#B8F4D8] flex items-center justify-center text-[#0D5C4D] font-semibold text-sm">
                        {vendor.profile_image ? (
                          <img
                            src={`${BASE_URL}${vendor.profile_image}`}
                            alt={vendor.name}
                            className="w-10 h-10 rounded-full object-cover"
                            onError={(e) => {
                              e.target.style.display = 'none';
                              e.target.nextSibling.style.display = 'flex';
                            }}
                          />
                        ) : (
                          <span>{vendor.name.substring(0, 2).toUpperCase()}</span>
                        )}
                        <span className="hidden">{vendor.name.substring(0, 2).toUpperCase()}</span>
                      </div>
                      <div>
                        <div className="font-semibold text-[#0D5C4D]">{vendor.name}</div>
                        <div className="text-xs text-[#6B8782]">{vendor.registration_number || vendor.vendorId}</div>
                      </div>
                    </div>
                  </td>

                  <td className="px-6 py-4">
                    <span className="px-3 py-1.5 rounded-full text-xs font-medium bg-[#D4F4E8] text-[#047857] whitespace-nowrap overflow-hidden text-ellipsis max-w-[150px]">
                      {vendor.vendorType}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex flex-wrap gap-1.5">
                      {vendor.products && vendor.products.length > 0 ? (
                        <>
                          {vendor.products.slice(0, 2).map((product, idx) => (
                            <span
                              key={idx}
                              className="px-3 py-1.5 rounded-full text-xs font-medium bg-[#D4F4E8] text-[#047857]"
                            >
                              {product.name}
                            </span>
                          ))}
                          {vendor.products.length > 2 && (
                            <span className="px-3 py-1.5 rounded-full text-xs font-medium bg-[#0D7C66] text-white">
                              +{vendor.products.length - 2}
                            </span>
                          )}
                        </>
                      ) : (
                        <span className="text-xs text-[#6B8782]">No products</span>
                      )}
                    </div>
                  </td>

                  <td className="px-6 py-4">
                    <div className="text-sm text-[#0D5C4D]">{vendor.contact}</div>
                    <div className="text-xs text-[#6B8782]">{vendor.email}</div>
                  </td>

                  <td className="px-6 py-4">
                    <div className="text-sm text-[#0D5C4D]">{vendor.location}</div>
                  </td>

                  <td className="px-6 py-4">
                    <span className={`px-3 py-1.5 rounded-full text-xs font-medium flex items-center gap-1 w-fit ${vendor.status?.toLowerCase() === 'active' ? 'bg-green-500 text-white' : 'bg-red-500 text-white'
                      }`}>
                      <div className="w-2 h-2 rounded-full bg-white"></div>
                      {vendor.status}
                    </span>
                  </td>

                  <td className="px-6 py-4">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleDropdown(`${vendor.vendor_type}-${vendor.vendorId}`, e);
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

        {filteredVendors.length === 0 && (
          <div className="text-center py-12">
            <div className="text-[#6B8782]">No vendors found matching your search criteria.</div>
          </div>
        )}

        {/* Pagination */}
        <div className="flex items-center justify-between px-6 py-4 bg-[#F0F4F3] border-t border-[#D0E0DB]">
          <div className="text-sm text-[#6B8782]">
            Showing {filteredVendors.length === 0 ? 0 : startIndex + 1} to {Math.min(startIndex + itemsPerPage, filteredVendors.length)} of {filteredVendors.length} vendors
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage(Math.max(1, currentPage - 1))}
              disabled={currentPage === 1}
              className={`px-3 py-2 rounded-lg transition-colors ${currentPage === 1 ? 'text-gray-400 cursor-not-allowed' : 'text-[#6B8782] hover:bg-[#D0E0DB]'}`}
            >
              &lt;
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
                    onClick={() => setPage(pageNumber)}
                    className={`px-4 py-2 rounded-lg font-medium transition-colors ${currentPage === pageNumber
                      ? 'bg-[#0D8568] text-white'
                      : 'text-[#6B8782] hover:bg-[#D0E0DB]'
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
                  <span key={pageNumber} className="px-2 text-[#6B8782]">
                    ...
                  </span>
                );
              }
              return null;
            })}

            <button
              onClick={() => setPage(Math.min(totalPages, currentPage + 1))}
              disabled={currentPage === totalPages}
              className={`px-3 py-2 rounded-lg transition-colors ${currentPage === totalPages ? 'text-gray-400 cursor-not-allowed' : 'text-[#6B8782] hover:bg-[#D0E0DB]'}`}
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
          {hasPermission('Vendors', 'view') && (
            <button
              onClick={() => {
                const vendor = transformedVendors.find(v => `${v.vendor_type}-${v.vendorId}` === openDropdown);
                if (vendor) handleAction('view', vendor);
              }}
              className="w-full text-left px-4 py-2 text-sm text-[#0D5C4D] hover:bg-[#F0F4F3] transition-colors flex items-center gap-2"
            >
              <Eye size={14} />
              View
            </button>
          )}
          {hasPermission('Vendors', 'edit') && (
            <button
              onClick={() => {
                const vendor = transformedVendors.find(v => `${v.vendor_type}-${v.vendorId}` === openDropdown);
                if (vendor) handleAction('edit', vendor);
              }}
              className="w-full text-left px-4 py-2 text-sm text-[#0D5C4D] hover:bg-[#F0F4F3] transition-colors flex items-center gap-2"
            >
              <Edit size={14} />
              Edit
            </button>
          )}
          {hasPermission('Vendors', 'delete') && (
            <button
              onClick={() => {
                const vendor = transformedVendors.find(v => `${v.vendor_type}-${v.vendorId}` === openDropdown);
                if (vendor) handleAction('delete', vendor);
              }}
              className="w-full text-left px-4 py-2 text-sm text-red-500 hover:bg-[#F0F4F3] transition-colors flex items-center gap-2"
            >
              <Trash2 size={14} />
              Delete
            </button>
          )}
        </div>
      )}

      <ConfirmDeleteModal
        isOpen={deleteModal.isOpen}
        onClose={() => setDeleteModal({ isOpen: false, vendor: null, vendorName: '' })}
        onConfirm={() => {
          //console.log('Deleting vendor:', deleteModal.vendor);
          setDeleteModal({ isOpen: false, vendor: null, vendorName: '' });
        }}
        title="Delete Vendor"
        message={`Are you sure you want to delete ${deleteModal.vendorName}? This action cannot be undone.`}
      />
    </div>
  );
};

export default VendorDashboard;