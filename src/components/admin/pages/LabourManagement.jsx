import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  Plus,
  MoreVertical,
  ChevronDown,
  Download
} from 'lucide-react';
import { getAllLabours, deleteLabour, getLabourById } from '../../../api/labourApi';
import { getAllLabourRates } from '../../../api/labourRateApi';
import ConfirmDeleteModal from '../../common/ConfirmDeleteModal';
import { BASE_URL } from '../../../config/config';
import { getLabourManagementPayoutAmounts, formatInrPayout } from '../../../api/payoutApi';
import * as XLSX from 'xlsx-js-style';

const mapLabourStatus = (status) => {
  const raw = String(status || '').trim().toLowerCase();
  if (raw === 'live' || raw === 'active' || raw === 'present') {
    return { label: 'Live', color: 'bg-[#10B981]' };
  }
  if (raw === 'terminated') {
    return { label: 'Terminated', color: 'bg-red-500' };
  }
  if (raw === 'relieved' || raw === 'relived' || raw === 'inactive' || raw === 'absent') {
    return { label: 'Relieved', color: 'bg-orange-500' };
  }
  return { label: status || 'Unknown', color: 'bg-orange-500' };
};

const LabourManagement = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const pageFromUrl = Math.max(1, parseInt(searchParams.get('page') || '1', 10) || 1);
  const [activeTab, setActiveTab] = useState('labourList');
  const [openDropdown, setOpenDropdown] = useState(null);
  const [dropdownPosition, setDropdownPosition] = useState({ top: 0, left: 0 });
  const [filters, setFilters] = useState({
    status: 'All',
    workType: 'All'
  });
  const dropdownRef = useRef(null);
  const [labours, setLabours] = useState([]);
  const [loading, setLoading] = useState(true);
  const [labourRates, setLabourRates] = useState({});
  const [deleteModal, setDeleteModal] = useState({ isOpen: false, labourId: null, labourName: '' });
  const [currentPage, setCurrentPage] = useState(pageFromUrl);
  const itemsPerPage = 7;
  const [payoutStats, setPayoutStats] = useState(null);

  useEffect(() => {
    let cancelled = false;
    getLabourManagementPayoutAmounts()
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

  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);
        // Fetch both rates and labours in parallel
        const [ratesResponse, laboursResponse] = await Promise.all([
          getAllLabourRates().catch(() => []),
          getAllLabours().catch(() => ({ data: [] }))
        ]);
        
        // Process rates
        const rates = Array.isArray(ratesResponse) ? ratesResponse : (ratesResponse?.data || []);
        const ratesMap = {};
        rates.forEach(rate => {
          if (rate.status === 'Active') {
            ratesMap[rate.labourType] = parseFloat(rate.amount) || 0;
          }
        });
        
        setLabourRates(ratesMap);
        
        // Process labours with rates
        const laboursData = laboursResponse.data || [];
        const transformedLabours = laboursData.map(labour => {
          // Get wage from labour rates based on work type
          const workType = labour.work_type || 'Normal';
          // Use wage from settings, show 0 if not available
          const wageFromSettings = ratesMap[workType];
          const dailyWage = wageFromSettings !== undefined 
            ? wageFromSettings 
            : 0;
          
          const statusMeta = mapLabourStatus(labour.status);
          return {
            id: labour.lid,
            labourId: labour.labour_id,
            name: labour.full_name,
            avatar: labour.full_name.split(' ').map(n => n[0]).join('').toUpperCase(),
            avatarBg: 'bg-teal-700',
            profileImage: labour.profile_image,
            phone: labour.mobile_number,
            workType: labour.work_type,
            status: statusMeta.label,
            statusColor: statusMeta.color,
            dailyWage: `₹${dailyWage.toFixed(2)}`,
            location: labour.city || labour.address || ''
          };
        });
        setLabours(transformedLabours);
      } catch (error) {
        console.error('Error loading data:', error);
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, []);


  const toggleDropdown = (labourId, event) => {
    if (openDropdown === labourId) {
      setOpenDropdown(null);
    } else {
      const rect = event.currentTarget.getBoundingClientRect();
      setDropdownPosition({
        top: rect.bottom + window.scrollY + 8,
        left: rect.right + window.scrollX - 128
      });
      setOpenDropdown(labourId);
    }
  };

  const fetchLabours = async () => {
    try {
      setLoading(true);
      const response = await getAllLabours();
      const laboursData = response.data || [];
      const transformedLabours = laboursData.map(labour => {
        // Get wage from labour rates based on work type
        const workType = labour.work_type || 'Normal';
        // Use wage from settings (labourRates state), show 0 if not available
        const wageFromSettings = labourRates[workType];
        const dailyWage = wageFromSettings !== undefined 
          ? wageFromSettings 
          : 0;
        
        const statusMeta = mapLabourStatus(labour.status);
        return {
          id: labour.lid,
          labourId: labour.labour_id,
          name: labour.full_name,
          avatar: labour.full_name.split(' ').map(n => n[0]).join('').toUpperCase(),
          avatarBg: 'bg-teal-700',
          profileImage: labour.profile_image,
          phone: labour.mobile_number,
          workType: labour.work_type,
          status: statusMeta.label,
          statusColor: statusMeta.color,
          dailyWage: `₹${dailyWage.toFixed(2)}`,
          location: labour.city || labour.address || ''
        };
      });
      setLabours(transformedLabours);
    } catch (error) {
      console.error('Error fetching labours:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAction = (action, labourId, labourName) => {
    if (action === 'view') {
      navigate(`/labour/${labourId}`);
    } else if (action === 'edit') {
      navigate(`/labour/${labourId}/edit`, { state: { returnTo: 'labour', returnPage: currentPage } });
    } else if (action === 'delete') {
      setDeleteModal({ isOpen: true, labourId, labourName });
    }
    setOpenDropdown(null);
  };

  const totalLabours = labours.length;
  const activeLabours = labours.filter((l) => {
    const raw = String(l.status || '').trim().toLowerCase();
    return raw === 'live' || raw === 'active';
  }).length;

  const stats = [
    {
      label: 'Total Labours',
      value: totalLabours.toString(),
      color: 'bg-gradient-to-r from-[#D1FAE5] to-[#A7F3D0]',
      textColor: 'text-[#0D5C4D]'
    },
    {
      label: 'Active Labours',
      value: activeLabours.toString(),
      color: 'bg-gradient-to-r from-[#6EE7B7] to-[#34D399]',
      textColor: 'text-[#0D5C4D]'
    },
    {
      label: 'Pending Payouts',
      value: payoutStats == null ? '…' : formatInrPayout(payoutStats.pendingAmount),
      color: 'bg-gradient-to-r from-[#10B981] to-[#059669]',
      textColor: 'text-white'
    },
    {
      label: 'Totally Paid(Month)',
      value: payoutStats == null ? '…' : formatInrPayout(payoutStats.paidThisMonthAmount),
      color: 'bg-gradient-to-r from-[#047857] to-[#065F46]',
      textColor: 'text-white'
    }
  ];



  const handleTabChange = (tab) => {
    setActiveTab(tab);
  };

  // Filter and Pagination Logic
  const filteredLabours = labours.filter(labour => {
    const statusMatch = filters.status === 'All' || labour.status === filters.status;
    const workTypeMatch = filters.workType === 'All' || labour.workType === filters.workType;
    return statusMatch && workTypeMatch;
  });

  const totalPages = Math.max(1, Math.ceil(filteredLabours.length / itemsPerPage));
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedLabours = filteredLabours.slice(startIndex, startIndex + itemsPerPage);

  useEffect(() => {
    if (!loading && currentPage > totalPages) {
      setPage(totalPages);
    }
  }, [loading, currentPage, totalPages, setPage]);

  const handleFilterChange = (key, value) => {
    setFilters(prev => ({ ...prev, [key]: value }));
    setPage(1);
  };

  // Export labours to Excel with all details
  const handleExportLabours = async () => {
    if (labours.length === 0) {
      alert('No labours to export');
      return;
    }

    try {
      // Fetch detailed data for all labours
      const detailedLabours = await Promise.all(
        labours.map(async (labour) => {
          try {
            const response = await getLabourById(labour.id);
            return response.data || response;
          } catch (error) {
            console.error(`Error fetching labour ${labour.id}:`, error);
            return null;
          }
        })
      );

      // Filter out any failed fetches and prepare data for export
      const exportData = detailedLabours
        .filter(labour => labour !== null)
        .map(labour => ({
          // Personal Information
          'NAME': labour.full_name || 'N/A',
          'PHONE': labour.mobile_number || 'N/A',
          'AADHAAR NUMBER': labour.aadhaar_number || 'N/A',
          'DATE OF BIRTH': labour.date_of_birth || 'N/A',
          'GENDER': labour.gender || 'N/A',
          'BLOOD GROUP': labour.blood_group || 'N/A',
          'ADDRESS': labour.address || 'N/A',

          // Work Details
          'WORK TYPE': labour.work_type || 'N/A',
          'DEPARTMENT': labour.department || 'N/A',
          'DAILY WAGE': (() => {
            const workType = labour.work_type || 'Normal';
            const wageFromSettings = labourRates[workType];
            const dailyWage = wageFromSettings !== undefined 
              ? wageFromSettings 
              : 0;
            return `₹${dailyWage.toFixed(2)}`;
          })(),
          'JOINING DATE': labour.joining_date || 'N/A',
          'STATUS': labour.status || 'N/A'
        }));

      if (exportData.length === 0) {
        alert('No labour data available to export');
        return;
      }

      // Create worksheet
      const worksheet = XLSX.utils.json_to_sheet(exportData);

      // Set column widths
      worksheet['!cols'] = [
        { wch: 25 }, // NAME
        { wch: 15 }, // PHONE
        { wch: 18 }, // AADHAAR NUMBER
        { wch: 15 }, // DATE OF BIRTH
        { wch: 10 }, // GENDER
        { wch: 12 }, // BLOOD GROUP
        { wch: 35 }, // ADDRESS
        { wch: 15 }, // WORK TYPE
        { wch: 15 }, // DEPARTMENT
        { wch: 12 }, // DAILY WAGE
        { wch: 15 }, // JOINING DATE
        { wch: 12 }  // STATUS
      ];

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
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Labours');

      // Generate Excel file and trigger download
      const fileName = `labours_detailed_${new Date().toISOString().split('T')[0]}.xlsx`;
      XLSX.writeFile(workbook, fileName, { bookType: 'xlsx', cellStyles: true });
    } catch (error) {
      console.error('Error exporting labours:', error);
      alert('Failed to export labour data. Please try again.');
    }
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8">

      {/* Tabs and Add Button */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => handleTabChange('labourList')}
            className={`px-6 py-2.5 rounded-lg font-medium text-sm transition-colors ${activeTab === 'labourList'
              ? 'bg-[#0D7C66] text-white'
              : 'bg-[#D4F4E8] text-[#0D5C4D] hover:bg-[#B8F4D8]'
              }`}
          >
            Labour List
          </button>
          <button
            onClick={() => navigate('/labour/attendance')}
            className="px-6 py-2.5 rounded-lg font-medium text-sm transition-colors bg-[#D4F4E8] text-[#0D5C4D] hover:bg-[#B8F4D8]"
          >
            Attendance
          </button>
          <button
            onClick={() => navigate('/labour/excess-pay')}
            className="px-6 py-2.5 rounded-lg font-medium text-sm transition-colors bg-[#D4F4E8] text-[#0D5C4D] hover:bg-[#B8F4D8]"
          >
            Excess Pay
          </button>
          <button
            onClick={() => navigate('/labour/daily-payout')}
            className="px-6 py-2.5 rounded-lg font-medium text-sm transition-colors bg-[#D4F4E8] text-[#0D5C4D] hover:bg-[#B8F4D8]"
          >
            Labour Daily Payout
          </button>
        </div>

        <div className="flex gap-3">
          <button
            onClick={handleExportLabours}
            className="bg-[#1DB890] hover:bg-[#19a57e] text-white px-4 sm:px-6 py-2.5 rounded-lg font-medium text-sm flex items-center gap-2 transition-colors shadow-sm"
          >
            <Download className="w-4 h-4" />
            Export Excel
          </button>
          <button
            onClick={() => navigate('/labour/add')}
            className="bg-[#0D7C66] hover:bg-[#0a6354] text-white px-4 sm:px-6 py-2.5 rounded-lg font-medium text-sm flex items-center gap-2 transition-colors shadow-sm"
          >
            <Plus className="w-4 h-4" />
            Add Labour
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        {stats.map((stat, index) => (
          <div
            key={index}
            className={`${stat.color} rounded-2xl p-6 ${stat.textColor}`}
          >
            <div className="text-sm font-medium mb-2 opacity-90">{stat.label}</div>
            <div className="text-4xl font-bold">{stat.value}</div>
          </div>
        ))}
      </div>

      {/* Filter Section */}
      <div className="bg-white rounded-xl p-4 mb-6 border border-[#D0E0DB]">
        <div className="flex flex-wrap items-center gap-4">
          <span className="text-sm text-[#6B8782] font-medium">Filter by:</span>

          <div className="flex flex-wrap gap-3">
            {/* Status Filter */}
            <div className="relative">
              <select
                value={filters.status}
                onChange={(e) => handleFilterChange('status', e.target.value)}
                className="appearance-none bg-white border border-[#D0E0DB] rounded-lg px-4 py-2 pr-10 text-sm text-[#0D5C4D] focus:outline-none focus:ring-2 focus:ring-[#0D8568] cursor-pointer min-w-[150px]"
              >
                <option value="All">Status: All</option>
                <option value="Live">Live</option>
                <option value="Terminated">Terminated</option>
                <option value="Relieved">Relieved</option>
              </select>
              <ChevronDown className="absolute right-3 top-1/2 transform -translate-y-1/2 text-[#6B8782] pointer-events-none" size={16} />
            </div>

            {/* Work Type Filter */}
            <div className="relative">
              <select
                value={filters.workType}
                onChange={(e) => handleFilterChange('workType', e.target.value)}
                className="appearance-none bg-white border border-[#D0E0DB] rounded-lg px-4 py-2 pr-10 text-sm text-[#0D5C4D] focus:outline-none focus:ring-2 focus:ring-[#0D8568] cursor-pointer min-w-[150px]"
              >
                <option value="All">Work Type: All</option>
                <option value="Normal">Normal</option>
                <option value="Medium">Medium</option>
                <option value="Heavy">Heavy</option>
              </select>
              <ChevronDown className="absolute right-3 top-1/2 transform -translate-y-1/2 text-[#6B8782] pointer-events-none" size={16} />
            </div>
          </div>
        </div>
      </div>

      {/* Labour Table */}
      <div className="bg-white rounded-2xl overflow-hidden border border-[#D0E0DB]">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[800px]">
            <thead>
              <tr className="bg-[#D4F4E8]">
                <th className="px-4 sm:px-6 py-4 text-left text-xs sm:text-sm font-semibold text-[#0D5C4D]">Name</th>
                <th className="px-4 sm:px-6 py-4 text-left text-xs sm:text-sm font-semibold text-[#0D5C4D]">Phone</th>
                <th className="px-4 sm:px-6 py-4 text-left text-xs sm:text-sm font-semibold text-[#0D5C4D]">Work Type</th>
                <th className="px-4 sm:px-6 py-4 text-left text-xs sm:text-sm font-semibold text-[#0D5C4D]">Status</th>
                <th className="px-4 sm:px-6 py-4 text-left text-xs sm:text-sm font-semibold text-[#0D5C4D]">Daily Wage</th>
                <th className="px-4 sm:px-6 py-4 text-left text-xs sm:text-sm font-semibold text-[#0D5C4D]">Action</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan="6" className="px-6 py-8 text-center text-[#6B8782]">
                    Loading labours...
                  </td>
                </tr>
              ) : labours.length === 0 ? (
                <tr>
                  <td colSpan="6" className="px-6 py-8 text-center text-[#6B8782]">
                    No labours found
                  </td>
                </tr>
              ) : paginatedLabours.map((labour, index) => (
                <tr
                  key={labour.id}
                  className={`border-b border-[#D0E0DB] hover:bg-[#F0F4F3] transition-colors ${index % 2 === 0 ? 'bg-white' : 'bg-[#F0F4F3]/30'
                    }`}
                >
                  <td className="px-4 sm:px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-full ${labour.avatarBg} flex items-center justify-center text-white font-semibold text-sm flex-shrink-0 overflow-hidden`}>
                        {labour.profileImage ? (
                          <img
                            src={`${BASE_URL}${labour.profileImage}`}
                            alt={labour.name}
                            className="w-full h-full object-cover"
                            onError={(e) => {
                              e.target.style.display = 'none';
                              e.target.nextSibling.style.display = 'flex';
                            }}
                          />
                        ) : null}
                        <span className={labour.profileImage ? 'hidden' : ''}>{labour.avatar}</span>
                      </div>
                      <div className="text-sm font-medium text-[#0D5C4D]">{labour.name}</div>
                    </div>
                  </td>

                  <td className="px-4 sm:px-6 py-4">
                    <div className="text-sm text-[#6B8782]">{labour.phone}</div>
                  </td>

                  <td className="px-4 sm:px-6 py-4">
                    <div className="text-sm text-[#0D5C4D]">{labour.workType || 'N/A'}</div>
                  </td>

                  <td className="px-4 sm:px-6 py-4">
                    <span className={`px-3 py-1.5 rounded-full text-xs font-medium flex items-center gap-1.5 w-fit text-white ${labour.statusColor}`}>
                      <div className="w-2 h-2 rounded-full bg-white"></div>
                      {labour.status}
                    </span>
                  </td>

                  <td className="px-4 sm:px-6 py-4">
                    <div className="text-sm font-semibold text-[#0D5C4D]">
                      {labour.dailyWage}
                    </div>
                  </td>

                  <td className="px-4 sm:px-6 py-4">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleDropdown(labour.id, e);
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
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 px-4 sm:px-6 py-4 bg-[#F0F4F3] border-t border-[#D0E0DB]">
          <div className="text-sm text-[#6B8782]">
            Showing {filteredLabours.length === 0 ? 0 : startIndex + 1} to {Math.min(startIndex + itemsPerPage, filteredLabours.length)} of {filteredLabours.length} Labours
          </div>
          <div className="flex items-center gap-1 sm:gap-2 flex-wrap justify-center">
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
                    className={`px-3 sm:px-4 py-2 rounded-lg font-medium transition-colors ${currentPage === pageNumber
                      ? 'bg-[#10B981] text-white'
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
          <button
            onClick={() => {
              const labour = labours.find(l => l.id === openDropdown);
              if (labour) handleAction('view', labour.id);
            }}
            className="w-full text-left px-4 py-2 text-sm text-[#0D5C4D] hover:bg-[#F0F4F3] transition-colors"
          >
            View
          </button>
          <button
            onClick={() => {
              const labour = labours.find(l => l.id === openDropdown);
              if (labour) handleAction('edit', labour.id);
            }}
            className="w-full text-left px-4 py-2 text-sm text-[#0D5C4D] hover:bg-[#F0F4F3] transition-colors"
          >
            Edit
          </button>
          <button
            onClick={() => {
              const labour = labours.find(l => l.id === openDropdown);
              if (labour) handleAction('delete', labour.id, labour.name);
            }}
            className="w-full text-left px-4 py-2 text-sm text-red-500 hover:bg-[#F0F4F3] transition-colors"
          >
            Delete
          </button>
        </div>
      )}

      <ConfirmDeleteModal
        isOpen={deleteModal.isOpen}
        onClose={() => setDeleteModal({ isOpen: false, labourId: null, labourName: '' })}
        onConfirm={async () => {
          try {
            await deleteLabour(deleteModal.labourId);
            await fetchLabours();
            setDeleteModal({ isOpen: false, labourId: null, labourName: '' });
          } catch (error) {
            console.error('Failed to delete labour:', error);
            setDeleteModal({ isOpen: false, labourId: null, labourName: '' });
          }
        }}
        title="Delete Labour"
        message={`Are you sure you want to delete ${deleteModal.labourName}? This action cannot be undone.`}
      />
    </div>
  );
};

export default LabourManagement;