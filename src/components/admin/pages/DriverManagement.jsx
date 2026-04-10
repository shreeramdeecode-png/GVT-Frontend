import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate, useSearchParams, useLocation } from 'react-router-dom';
import {
  Search,
  ChevronDown,
  Plus,
  ChevronLeft,
  ChevronRight,
  MoreVertical,
  Eye,
  Edit,
  Trash2,
  Download
} from 'lucide-react';
import ConfirmDeleteModal from '../../common/ConfirmDeleteModal';
import { getAllDrivers, deleteDriver } from '../../../api/driverApi';
import * as XLSX from 'xlsx-js-style';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

const DriverManagement = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const currentPage = Math.max(1, parseInt(searchParams.get('page') || '1', 10) || 1);
  const [activeTab, setActiveTab] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [openDropdown, setOpenDropdown] = useState(null);
  const [dropdownPosition, setDropdownPosition] = useState({ top: 0, left: 0 });
  const dropdownRef = useRef(null);
  const [deleteModal, setDeleteModal] = useState({ isOpen: false, driverId: null, driverName: '' });
  const [drivers, setDrivers] = useState([]);
  const [exportDropdownOpen, setExportDropdownOpen] = useState(false);
  const exportDropdownRef = useRef(null);
  const itemsPerPage = 7;
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const setPage = useCallback((page) => {
    const safePage = Math.max(1, page);
    const search = safePage === 1 ? '' : `?page=${safePage}`;
    navigate({ pathname: location.pathname, search }, { replace: true });
  }, [navigate, location.pathname]);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setOpenDropdown(null);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // Close export dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (exportDropdownRef.current && !exportDropdownRef.current.contains(event.target)) {
        setExportDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Fetch drivers from API
  const fetchDrivers = async () => {
    try {
      setLoading(true);
      const response = await getAllDrivers();
      // console.log('Driver list response:', response);

      // Check if response has data property
      const driversData = response.data || response;
      // console.log('Drivers data:', driversData);

      // Log the raw driver data to understand ID formats
      // console.log('Raw driver data:', driversData);

      // Transform API response to match existing data structure
      const transformedDrivers = driversData.map(driver => {
        // console.log('Processing driver:', driver);
        // Log all possible ID fields
        // console.log('Possible ID fields:', {
        //   driver_id: driver.driver_id,
        //   id: driver.id,
        //   did: driver.did,
        //   _id: driver._id
        // });

        return {
          id: driver.did || driver.driver_id || driver.id || driver._id,
          name: driver.driver_name || driver.name,
          phone: driver.phone_number || driver.phone,
          initial: (driver.driver_name || driver.name) ? (driver.driver_name || driver.name).split(' ').map(n => n[0]).join('').toUpperCase() : 'D',
          color: 'bg-teal-700',
          profileImage: driver.driver_image,
          vehicle: {
            name: driver.vehicle_type || driver.vehicleType,
            number: driver.vehicle_number || driver.vehicleNumber,
            capacity: driver.capacity
          },
          deliveryType: driver.delivery_type || driver.deliveryType,
          status: (() => {
            const s = (driver.status || '').toLowerCase();
            if (['inactive', 'absent'].includes(s)) return 'Absent';
            return 'Present';
          })(),
          workingHours: driver.working_hours ? `${driver.working_hours} hrs` : '0 hrs'
        };
      });
      // console.log('Transformed drivers:', transformedDrivers);
      setDrivers(transformedDrivers);
      setError(null);
    } catch (err) {
      console.error('Error fetching drivers:', err);
      setError('Failed to load drivers');
      // Fallback to hardcoded data if API fails
      setDrivers([
        {
          id: 'DRV-001',
          name: 'Rajesh Pandey',
          phone: '+91 98765 43210',
          initial: 'RP',
          color: 'bg-teal-700',
          vehicle: { name: 'Tata Ace', number: 'TN 01 AB 1234', capacity: '1 Ton' },
          deliveryType: 'LOCAL GRADE ORDER',
          status: 'Available',
          workingHours: '8.5 hrs'
        },
        {
          id: 'DRV-002',
          name: 'Suresh Kumar',
          phone: '+91 98765 43211',
          initial: 'SK',
          color: 'bg-teal-700',
          vehicle: { name: 'Mahindra Bolero', number: 'TN 02 CD 9876', capacity: '1.5 Ton' },
          deliveryType: 'BOX ORDER',
          status: 'On Trip',
          workingHours: '6.0 hrs'
        }
      ]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDrivers();
  }, []);

  const toggleDropdown = (driverId, event) => {
    if (openDropdown === driverId) {
      setOpenDropdown(null);
    } else {
      const rect = event.currentTarget.getBoundingClientRect();
      setDropdownPosition({
        top: rect.bottom + window.scrollY + 8,
        left: rect.right + window.scrollX - 128 // 128px is dropdown width (w-32)
      });
      setOpenDropdown(driverId);
    }
  };

  const handleAction = (action, driverId, driverName) => {
    // console.log('Handle action:', action, 'Driver ID:', driverId, 'Driver Name:', driverName);
    if (action === 'view') {
      navigate(`/drivers/${driverId}`);
    } else if (action === 'edit') {
      // console.log('Navigating to edit driver with ID:', driverId);
      // Check if driverId is valid
      if (!driverId) {
        console.error('Invalid driver ID:', driverId);
        return;
      }
      navigate(`/drivers/${driverId}/edit`, { state: { returnTo: 'drivers', returnPage: currentPage } });
    } else if (action === 'delete') {
      setDeleteModal({ isOpen: true, driverId, driverName });
    }
    setOpenDropdown(null);
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'Present':
        return 'bg-emerald-100 text-emerald-700';
      case 'Absent':
        return 'bg-red-100 text-red-700';
      default:
        return 'bg-gray-100 text-gray-700';
    }
  };

  const getStatusDot = (status) => {
    switch (status) {
      case 'Present':
        return 'bg-emerald-500';
      case 'Absent':
        return 'bg-red-500';
      default:
        return 'bg-gray-500';
    }
  };

  const getDeliveryTypeColor = (type) => {
    switch (type) {
      case 'LOCAL GRADE ORDER':
        return 'bg-blue-100 text-blue-700';
      case 'BOX ORDER':
        return 'bg-orange-100 text-orange-700';
      default:
        return 'bg-gray-100 text-gray-700';
    }
  };

  // Filter and pagination logic
  const filteredDrivers = drivers.filter(driver => {
    const matchesSearch = searchQuery === '' ||
      (driver.name && driver.name.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (driver.id && String(driver.id).toLowerCase().includes(searchQuery.toLowerCase()));
    const matchesStatus = statusFilter === 'All' || driver.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const totalPages = Math.max(1, Math.ceil(filteredDrivers.length / itemsPerPage));
  const startIndex = (currentPage - 1) * itemsPerPage;
  const currentDrivers = filteredDrivers.slice(startIndex, startIndex + itemsPerPage);

  useEffect(() => {
    if (!loading && currentPage > totalPages) {
      setPage(totalPages);
    }
  }, [loading, currentPage, totalPages, setPage]);

  // Reset page to 1 only when user changes search or filter (not on initial mount)
  const prevSearchRef = useRef(searchQuery);
  const prevStatusRef = useRef(statusFilter);
  useEffect(() => {
    if (prevSearchRef.current !== searchQuery || prevStatusRef.current !== statusFilter) {
      prevSearchRef.current = searchQuery;
      prevStatusRef.current = statusFilter;
      setPage(1);
    }
  }, [searchQuery, statusFilter, setPage]);

  // Export drivers to Excel with all details
  const handleExportDrivers = async () => {
    if (drivers.length === 0) {
      alert('No drivers to export');
      return;
    }

    try {
      // Fetch detailed data for all drivers
      const { getDriverById } = await import('../../../api/driverApi');
      const detailedDrivers = await Promise.all(
        drivers.map(async (driver) => {
          try {
            const response = await getDriverById(driver.id);
            return response.data || response;
          } catch (error) {
            console.error(`Error fetching driver ${driver.id}:`, error);
            return null;
          }
        })
      );

      // Filter out any failed fetches and prepare data for export
      const exportData = detailedDrivers
        .filter(driver => driver !== null)
        .map(driver => ({
          // Personal Information
          'NAME': driver.driver_name || driver.name || 'N/A',
          'PHONE': driver.phone_number || driver.phone || 'N/A',
          'EMAIL': driver.email || 'N/A',
          'ADDRESS': driver.address || 'N/A',
          'CITY': driver.city || 'N/A',
          'STATE': driver.state || 'N/A',
          'PIN CODE': driver.pin_code || 'N/A',
          'LICENSE NUMBER': driver.license_number || 'N/A',
          'LICENSE EXPIRY': driver.license_expiry_date || 'N/A',
          'STATUS': driver.status || 'N/A',

          // Vehicle Information
          'VEHICLE OWNERSHIP': driver.vehicle_ownership || 'N/A',
          'VEHICLE NAME': driver.available_vehicle || 'N/A',
          'VEHICLE NUMBER': driver.vehicle_number || 'N/A',
          'CAPACITY (TONS)': driver.capacity || 'N/A',
          'VEHICLE CONDITION': driver.vehicle_condition || 'N/A',
          'INSURANCE NUMBER': driver.insurance_number || 'N/A',
          'INSURANCE EXPIRY': driver.insurance_expiry_date || 'N/A',
          'FITNESS CERTIFICATE': driver.fitness_certificate || 'N/A',
          'FITNESS CERTIFICATE EXPIRY': driver.fitness_certificate_expiry_date || 'N/A',
          'POLLUTION CERT': driver.pollution_certificate || 'N/A',
          'POLLUTION CERT EXPIRY': driver.pollution_certificate_expiry_date || 'N/A',
          'KA PERMIT': driver.ka_permit || 'N/A',
          'KA PERMIT EXPIRY': driver.ka_permit_expiry_date || 'N/A',

          // Statistics & Other Info
          'DELIVERY TYPE': driver.delivery_type || 'N/A',
          'WORKING HOURS': driver.working_hours ? `${driver.working_hours} hrs` : 'N/A',
          'TOTAL DELIVERIES': driver.total_deliveries || '0',
          'RATING': driver.rating || '0'
        }));

      if (exportData.length === 0) {
        alert('No driver data available to export');
        return;
      }

      // Create worksheet
      const worksheet = XLSX.utils.json_to_sheet(exportData);

      // Set column widths
      worksheet['!cols'] = [
        { wch: 20 }, // NAME
        { wch: 15 }, // PHONE
        { wch: 25 }, // EMAIL
        { wch: 30 }, // ADDRESS
        { wch: 15 }, // CITY
        { wch: 15 }, // STATE
        { wch: 10 }, // PIN CODE
        { wch: 18 }, // LICENSE NUMBER
        { wch: 15 }, // LICENSE EXPIRY
        { wch: 12 }, // STATUS
        { wch: 18 }, // VEHICLE OWNERSHIP
        { wch: 18 }, // VEHICLE NAME
        { wch: 18 }, // VEHICLE NUMBER
        { wch: 15 }, // CAPACITY
        { wch: 18 }, // VEHICLE CONDITION
        { wch: 20 }, // INSURANCE NUMBER
        { wch: 18 }, // INSURANCE EXPIRY
        { wch: 22 }, // FITNESS CERTIFICATE
        { wch: 26 }, // FITNESS CERTIFICATE EXPIRY
        { wch: 18 }, // POLLUTION CERT
        { wch: 22 }, // POLLUTION CERT EXPIRY
        { wch: 15 }, // KA PERMIT
        { wch: 18 }, // KA PERMIT EXPIRY
        { wch: 15 }, // DELIVERY TYPE
        { wch: 15 }, // WORKING HOURS
        { wch: 18 }, // TOTAL DELIVERIES
        { wch: 10 }  // RATING
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
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Drivers');

      // Generate Excel file and trigger download
      const fileName = `drivers_detailed_${new Date().toISOString().split('T')[0]}.xlsx`;
      XLSX.writeFile(workbook, fileName, { bookType: 'xlsx', cellStyles: true });
    } catch (error) {
      console.error('Error exporting drivers:', error);
      alert('Failed to export driver data. Please try again.');
    }
  };

  // Export drivers to PDF
  const handleExportPDF = async () => {
    if (drivers.length === 0) {
      alert('No drivers to export');
      return;
    }
    setExportDropdownOpen(false);
    try {
      const { getDriverById } = await import('../../../api/driverApi');
      const detailedDrivers = await Promise.all(
        drivers.map(async (driver) => {
          try {
            const response = await getDriverById(driver.id);
            return response.data || response;
          } catch {
            return null;
          }
        })
      );

      const validDrivers = detailedDrivers.filter(Boolean);

      const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });

      // Title
      doc.setFontSize(18);
      doc.setTextColor(13, 92, 77);
      doc.text('Driver Management Report', 14, 18);

      // Date
      doc.setFontSize(10);
      doc.setTextColor(100, 100, 100);
      doc.text(`Generated: ${new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}`, 14, 26);
      doc.text(`Total Drivers: ${validDrivers.length}`, 14, 32);

      const head = [[
        'Name', 'Phone', 'Email', 'Delivery Type', 'Vehicle', 'Veh. No.', 'Capacity', 'Status', 'Working Hrs'
      ]];

      const body = validDrivers.map(driver => [
        driver.driver_name || driver.name || 'N/A',
        driver.phone_number || driver.phone || 'N/A',
        driver.email || 'N/A',
        driver.delivery_type || 'N/A',
        driver.available_vehicle || driver.vehicle_type || 'N/A',
        driver.vehicle_number || 'N/A',
        driver.capacity ? `${driver.capacity} T` : 'N/A',
        driver.status || 'N/A',
        driver.working_hours ? `${driver.working_hours} hrs` : 'N/A',
      ]);

      autoTable(doc, {
        head,
        body,
        startY: 38,
        styles: { fontSize: 8, cellPadding: 3, valign: 'middle' },
        headStyles: {
          fillColor: [13, 133, 104],
          textColor: 255,
          fontStyle: 'bold',
          halign: 'center'
        },
        alternateRowStyles: { fillColor: [240, 244, 243] },
        columnStyles: { 0: { fontStyle: 'bold' } },
        margin: { left: 14, right: 14 },
        tableLineColor: [208, 224, 219],
        tableLineWidth: 0.3,
      });

      doc.save(`drivers_report_${new Date().toISOString().split('T')[0]}.pdf`);
    } catch (error) {
      console.error('Error exporting PDF:', error);
      alert('Failed to export PDF. Please try again.');
    }
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      {/* Header Tabs */}
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setActiveTab('all')}
            className={`px-5 py-2.5 rounded-lg font-medium transition-all text-sm ${activeTab === 'all' ? 'bg-[#0D7C66] text-white shadow-md' : 'bg-white text-gray-600 hover:bg-gray-50 border border-gray-200'}`}
          >
            All Drivers
          </button>
          <button
            onClick={() => navigate('/drivers/attendance')}
            className="px-5 py-2.5 rounded-lg font-medium transition-all text-sm bg-white text-gray-600 hover:bg-gray-50 border border-gray-200"
          >
            Attendance
          </button>
        </div>

        <div className="flex gap-3">
          {/* Export Dropdown */}
          <div className="relative" ref={exportDropdownRef}>
            <button
              onClick={() => setExportDropdownOpen(prev => !prev)}
              className="px-5 py-2.5 bg-[#1DB890] hover:bg-[#19a57e] text-white rounded-lg font-medium transition-colors flex items-center gap-2 shadow-sm text-sm"
            >
              <Download className="w-4 h-4" />
              Export
              <ChevronDown className="w-4 h-4" />
            </button>
            {exportDropdownOpen && (
              <div className="absolute right-0 mt-2 w-44 bg-white rounded-xl shadow-lg border border-[#D0E0DB] z-50 overflow-hidden">
                <button
                  onClick={() => { handleExportDrivers(); setExportDropdownOpen(false); }}
                  className="w-full text-left px-4 py-3 text-sm text-[#0D5C4D] hover:bg-[#F0F4F3] transition-colors flex items-center gap-2 font-medium"
                >
                  <Download className="w-4 h-4 text-emerald-600" />
                  Export Excel
                </button>
                <div className="border-t border-[#D0E0DB]" />
                <button
                  onClick={handleExportPDF}
                  className="w-full text-left px-4 py-3 text-sm text-[#0D5C4D] hover:bg-[#F0F4F3] transition-colors flex items-center gap-2 font-medium"
                >
                  <Download className="w-4 h-4 text-red-500" />
                  Export PDF
                </button>
              </div>
            )}
          </div>
          <button
            onClick={() => navigate('/drivers/add')}
            className="px-5 py-2.5 bg-[#0D7C66] hover:bg-[#0a6354] text-white rounded-lg font-medium transition-colors flex items-center gap-2 shadow-sm text-sm"
          >
            <Plus className="w-4 h-4" />
            Add Driver
          </button>
        </div>
      </div>

      {/* Loading indicator */}
      {loading && (
        <div className="flex justify-center items-center py-8">
          <div className="text-lg text-gray-600">Loading drivers...</div>
        </div>
      )}

      {/* Error message */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
          <div className="text-red-700">{error}</div>
        </div>
      )}

      {/* Search and Filters */}
      {!loading && (
        <>
          <div className="bg-white rounded-xl shadow-sm border border-[#D0E0DB] p-4 mb-6">
            <div className="flex flex-col gap-4">
              <div className="w-full relative">
                <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-[#6B8782]" />
                <input
                  type="text"
                  placeholder="Search driver by name or ID..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-12 pr-4 py-3 border border-[#D0E0DB] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0D8568] focus:border-transparent text-sm bg-[#F0F4F3]"
                />
              </div>

              <div className="flex flex-col sm:flex-row gap-4">
                <div className="relative flex-1 min-w-0">
                  <div className="text-xs text-[#6B8782] mb-1 font-medium">Status: {statusFilter}</div>
                  <div className="relative">
                    <select
                      value={statusFilter}
                      onChange={(e) => setStatusFilter(e.target.value)}
                      className="w-full px-4 py-3 border border-[#D0E0DB] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0D8568] focus:border-transparent appearance-none bg-white text-sm font-medium text-[#0D5C4D] cursor-pointer"
                    >
                      <option>All</option>
                      <option>Absent</option>
                      <option>Present</option>
                    </select>
                    <ChevronDown className="absolute right-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-[#6B8782] pointer-events-none" />
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Drivers Table */}
          <div className="bg-white rounded-2xl overflow-hidden border border-[#D0E0DB]">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-[#D4F4E8]">
                    <th className="px-6 py-4 text-left text-sm font-semibold text-[#0D5C4D]">Driver Info</th>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-[#0D5C4D]">Contact Number</th>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-[#0D5C4D]">Vehicle Details</th>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-[#0D5C4D]">Delivery Type</th>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-[#0D5C4D]">Status</th>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-[#0D5C4D]">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {currentDrivers.length > 0 ? (
                    currentDrivers.map((driver, index) => (
                      <tr key={index} className={`border-b border-[#D0E0DB] hover:bg-[#F0F4F3] transition-colors ${index % 2 === 0 ? 'bg-white' : 'bg-[#F0F4F3]/30'}`}>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            {driver.profileImage ? (
                              <img
                                src={`${import.meta.env.VITE_API_BASE_URL.replace('/api/v1', '')}${driver.profileImage}`}
                                alt={driver.name}
                                className="w-10 h-10 rounded-full object-cover"
                                onError={(e) => {
                                  e.target.style.display = 'none';
                                  e.target.nextSibling.style.display = 'flex';
                                }}
                              />
                            ) : null}
                            <div className="w-10 h-10 rounded-full bg-[#B8F4D8] flex items-center justify-center text-[#0D5C4D] font-semibold text-sm" style={{ display: driver.profileImage ? 'none' : 'flex' }}>
                              {driver.initial}
                            </div>
                            <div>
                              <div className="font-semibold text-[#0D5C4D]">{driver.name}</div>
                              {/* <div className="text-xs text-[#6B8782]">{driver.id}</div> */}
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="text-sm text-[#0D5C4D]">{driver.phone}</div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="text-sm text-[#0D5C4D]">{driver.vehicle.name}</div>
                          <div className="text-xs text-[#6B8782]">{driver.vehicle.number} • {driver.vehicle.capacity}</div>
                        </td>
                        <td className="px-6 py-4">
                          <span className={`px-3 py-1.5 rounded-full text-xs font-medium ${getDeliveryTypeColor(driver.deliveryType)}`}>
                            {driver.deliveryType}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <span className={`px-3 py-1.5 rounded-full text-xs font-medium flex items-center gap-1 w-fit ${getStatusColor(driver.status)}`}>
                            <div className={`w-2 h-2 rounded-full ${getStatusDot(driver.status)}`}></div>
                            {driver.status}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <div className="relative dropdown-container">
                            <button
                              onClick={(event) => toggleDropdown(driver.id, event)}
                              className="text-[#6B8782] hover:text-[#0D5C4D] transition-colors p-1 hover:bg-[#F0F4F3] rounded"
                            >
                              <MoreVertical size={20} />
                            </button>
                          </div>
                        </td>

                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan="6" className="px-6 py-8 text-center text-gray-500">
                        No drivers found matching your criteria
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            <div className="flex items-center justify-between px-6 py-4 bg-[#F0F4F3] border-t border-[#D0E0DB]">
              <div className="text-sm text-[#6B8782]">
                Showing {filteredDrivers.length === 0 ? 0 : startIndex + 1} to {Math.min(startIndex + itemsPerPage, filteredDrivers.length)} of {filteredDrivers.length} drivers
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setPage(Math.max(1, currentPage - 1))}
                  disabled={currentPage === 1}
                  className={`px-3 py-2 rounded-lg transition-colors ${currentPage === 1 ? 'text-gray-400 cursor-not-allowed' : 'text-[#6B8782] hover:bg-[#D0E0DB]'}`}
                >
                  &lt;
                </button>

                {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => {
                  const showPage = page === 1 || page === totalPages || (page >= currentPage - 1 && page <= currentPage + 1);
                  const showEllipsis = (page === currentPage - 2 && currentPage > 3) || (page === currentPage + 2 && currentPage < totalPages - 2);

                  if (showEllipsis) return <span key={page} className="px-2 text-gray-500">...</span>;
                  if (!showPage) return null;

                  return (
                    <button
                      key={page}
                      onClick={() => setPage(page)}
                      className={`px-4 py-2 rounded-lg font-medium transition-colors ${currentPage === page ? 'bg-[#0D8568] text-white' : 'text-[#6B8782] hover:bg-[#D0E0DB]'}`}
                    >
                      {page}
                    </button>
                  );
                })}

                <button
                  onClick={() => setPage(Math.min(totalPages, currentPage + 1))}
                  disabled={currentPage === totalPages || totalPages === 0}
                  className={`px-3 py-2 rounded-lg transition-colors ${currentPage === totalPages || totalPages === 0 ? 'text-gray-400 cursor-not-allowed' : 'text-[#6B8782] hover:bg-[#D0E0DB]'}`}
                >
                  &gt;
                </button>
              </div>
            </div>
          </div>
        </>
      )}

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
              drivers.find(d => d.id === openDropdown)?.name)}
            className="w-full text-left px-4 py-2 text-sm text-red-500 hover:bg-[#F0F4F3] transition-colors flex items-center gap-2"
          >
            <Trash2 size={14} />
            Delete
          </button>
        </div>
      )}

      <ConfirmDeleteModal
        isOpen={deleteModal.isOpen}
        onClose={() => setDeleteModal({ isOpen: false, driverId: null, driverName: '' })}
        onConfirm={async () => {
          try {
            await deleteDriver(deleteModal.driverId);
            // Refresh the drivers list after deletion
            await fetchDrivers();
            setDeleteModal({ isOpen: false, driverId: null, driverName: '' });
          } catch (error) {
            console.error('Failed to delete driver:', error);
            setDeleteModal({ isOpen: false, driverId: null, driverName: '' });
          }
        }}
        title="Delete Driver"
        message={`Are you sure you want to delete ${deleteModal.driverName}? This action cannot be undone.`}
      />
    </div>
  );
};

export default DriverManagement;