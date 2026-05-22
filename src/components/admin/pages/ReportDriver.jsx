import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Search, Download, Eye } from 'lucide-react';
import { getAllDrivers } from '../../../api/driverApi';
import { getAllExcessKMs } from '../../../api/excessKmApi';
import { getAllFuelExpenses } from '../../../api/fuelExpenseApi';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import 'jspdf-autotable';

const ReportDriver = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [drivers, setDrivers] = useState([]);
  const [excessKMs, setExcessKMs] = useState([]);
  const [fuelExpenses, setFuelExpenses] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      
      const [driversRes, excessKMsRes, fuelExpensesRes] = await Promise.all([
        getAllDrivers().catch(() => ({ data: [] })),
        getAllExcessKMs().catch(() => ({ data: [] })),
        getAllFuelExpenses().catch(() => ({ data: [] }))
      ]);

      const driversData = driversRes?.data || (Array.isArray(driversRes) ? driversRes : []);
      const excessKMData = excessKMsRes?.data || (Array.isArray(excessKMsRes) ? excessKMsRes : []);
      const fuelExpenseData = fuelExpensesRes?.data || (Array.isArray(fuelExpensesRes) ? fuelExpensesRes : []);

      setDrivers(driversData);
      setExcessKMs(excessKMData);
      setFuelExpenses(fuelExpenseData);
    } catch (error) {
      console.error('Error fetching driver report data:', error);
    } finally {
      setLoading(false);
    }
  };

  // Combine driver data with excess KM and fuel expenses
  const driverReportData = useMemo(() => {
    return drivers.map(driver => {
      const driverId = String(driver.did);
      
      // Get all excess KM records for this driver
      const driverExcessKMs = excessKMs.filter(km => 
        String(km.driver_id || km.did || km.driver?.did || '') === driverId
      );

      // Get all fuel expenses for this driver
      const driverFuelExpenses = fuelExpenses.filter(expense =>
        String(expense.driver_id || expense.did || expense.driver?.did || '') === driverId &&
        (expense.payment_status || 'unpaid') !== 'paid'
      );

      // Calculate totals
      const totalStartKM = driverExcessKMs.reduce((sum, km) => sum + (parseFloat(km.start_km) || 0), 0);
      const totalEndKM = driverExcessKMs.reduce((sum, km) => sum + (parseFloat(km.end_km) || 0), 0);
      const totalKilometers = driverExcessKMs.reduce((sum, km) => sum + (parseFloat(km.kilometers) || 0), 0);
      
      // Calculate fuel expenses and litres (same logic as PayoutDriver.jsx)
      let totalFuelExpenses = 0;
      let totalFuelLitres = 0;
      
      driverFuelExpenses.forEach(expense => {
        // Try to get amount from total_amount, total, or amount field
        const total = parseFloat(expense.total_amount || expense.total || expense.amount || 0);
        
        // If total is available, use it
        if (total > 0) {
          totalFuelExpenses += total;
        } else {
          // Otherwise calculate from unit_price * litre
          const unitPrice = parseFloat(expense.unit_price || expense.unitPrice || 0);
          const litre = parseFloat(expense.litre || expense.liter || 0);
          if (unitPrice > 0 && litre > 0) {
            totalFuelExpenses += (unitPrice * litre);
          }
        }
        
        // Sum up litres
        const litre = parseFloat(expense.litre || expense.liter || 0);
        totalFuelLitres += litre;
      });

      return {
        id: driverId,
        driverName: driver.driver_name || 'Unknown Driver',
        driverCode: driver.driver_id || `DRV-${driverId}`,
        vehicleNumber: driver.vehicle_number || 'N/A',
        startKM: totalStartKM,
        endKM: totalEndKM,
        totalKilometers: totalKilometers,
        fuelLitres: totalFuelLitres,
        fuelExpenses: totalFuelExpenses,
        excessKMRecords: driverExcessKMs,
        fuelExpenseRecords: driverFuelExpenses,
        driverData: driver
      };
    });
  }, [drivers, excessKMs, fuelExpenses]);

  const filteredData = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return driverReportData;
    
    return driverReportData.filter(driver => 
      driver.driverName.toLowerCase().includes(query) ||
      driver.driverCode.toLowerCase().includes(query) ||
      driver.vehicleNumber.toLowerCase().includes(query)
    );
  }, [driverReportData, searchQuery]);

  const totalPages = Math.ceil(filteredData.length / itemsPerPage) || 1;
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedData = filteredData.slice(startIndex, startIndex + itemsPerPage);

  const formatCurrency = (amount) => {
    return `₹${parseFloat(amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const formatNumber = (num) => {
    return parseFloat(num || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  const exportToExcel = () => {
    const data = filteredData.map(driver => ({
      'Driver Name': driver.driverName,
      'Driver ID': driver.driverCode,
      'Vehicle Number': driver.vehicleNumber,
      'Start KM': formatNumber(driver.startKM),
      'End KM': formatNumber(driver.endKM),
      'Total Kilometers': formatNumber(driver.totalKilometers),
      'Fuel Litres': formatNumber(driver.fuelLitres),
      'Fuel Expenses': formatCurrency(driver.fuelExpenses),
      'KM Records': driver.excessKMRecords,
      'Fuel Records': driver.fuelExpenseRecords
    }));

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(data);
    XLSX.utils.book_append_sheet(wb, ws, 'Driver Report');
    XLSX.writeFile(wb, `Driver_Report_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  const handleExportPDF = () => {
    const doc = new jsPDF();

    // Header
    doc.setFillColor(13, 92, 77);
    doc.rect(0, 0, 210, 40, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(22);
    doc.setFont(undefined, 'bold');
    doc.text('DRIVER REPORT', 105, 20, { align: 'center' });

    doc.setFontSize(10);
    doc.setFont(undefined, 'normal');
    doc.text(`Generated on: ${new Date().toLocaleDateString('en-GB')}`, 105, 30, { align: 'center' });

    // Table
    const tableData = filteredData.map(driver => [
      driver.driverName,
      driver.driverCode,
      driver.vehicleNumber,
      formatNumber(driver.startKM),
      formatNumber(driver.endKM),
      formatNumber(driver.totalKilometers),
      formatNumber(driver.fuelLitres),
      formatNumber(driver.fuelExpenses) // Use formatNumber instead of formatCurrency for PDF compatibility
    ]);

    doc.autoTable({
      startY: 50,
      head: [['Driver Name', 'Driver ID', 'Vehicle', 'Start KM', 'End KM', 'Total KM', 'Fuel Litres', 'Fuel Expenses']],
      body: tableData,
      theme: 'grid',
      headStyles: { fillColor: [13, 92, 77], textColor: 255, fontStyle: 'bold', halign: 'center' },
      bodyStyles: { fontSize: 9, halign: 'center' },
      alternateRowStyles: { fillColor: [240, 253, 244] }
    });

    doc.save(`Driver_Report_${new Date().toISOString().split('T')[0]}.pdf`);
  };

  const stats = useMemo(() => {
    const totalDrivers = filteredData.length;
    const totalKM = filteredData.reduce((sum, d) => sum + d.totalKilometers, 0);
    const totalFuelLitres = filteredData.reduce((sum, d) => sum + d.fuelLitres, 0);
    const totalFuel = filteredData.reduce((sum, d) => sum + d.fuelExpenses, 0);

    return {
      totalDrivers,
      totalKM,
      totalFuelLitres,
      totalFuel
    };
  }, [filteredData]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-emerald-50 p-4 sm:p-6 lg:p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center gap-4 mb-6">
          <button
            onClick={() => navigate('/reports')}
            className="flex items-center gap-2 text-[#0D5C4D] hover:text-[#0a6354] transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
            <span className="font-medium">Back to Reports</span>
          </button>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6 sm:p-8 mb-6">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Driver Report</h1>
          <p className="text-gray-600">View driver details, KM records, and fuel expenses</p>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200">
            <div className="text-2xl font-bold text-[#0D5C4D] mb-1">{stats.totalDrivers}</div>
            <div className="text-sm text-gray-600">Total Drivers</div>
          </div>
          <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200">
            <div className="text-2xl font-bold text-[#0D5C4D] mb-1">{formatNumber(stats.totalKM)}</div>
            <div className="text-sm text-gray-600">Total Kilometers</div>
          </div>
          <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200">
            <div className="text-2xl font-bold text-[#0D5C4D] mb-1">{formatNumber(stats.totalFuelLitres)}</div>
            <div className="text-sm text-gray-600">Total Fuel Litres</div>
          </div>
          <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200">
            <div className="text-2xl font-bold text-[#0D5C4D] mb-1">{formatCurrency(stats.totalFuel)}</div>
            <div className="text-sm text-gray-600">Total Fuel Expenses</div>
          </div>
        </div>

        {/* Search and Export */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-4 mb-6">
          <div className="flex flex-col sm:flex-row gap-4 items-center">
            <div className="flex-1 w-full relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
              <input
                type="text"
                placeholder="Search by driver name, ID, or vehicle number..."
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setCurrentPage(1);
                }}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
            <div className="flex gap-2">
              <button
                onClick={exportToExcel}
                className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors flex items-center gap-2"
              >
                <Download className="w-4 h-4" />
                Excel
              </button>
              <button
                onClick={handleExportPDF}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors flex items-center gap-2"
              >
                <Download className="w-4 h-4" />
                PDF
              </button>
            </div>
          </div>
        </div>

        {/* Table */}
        <div className="bg-white rounded-2xl overflow-hidden border border-gray-200 shadow-lg">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-[#0D8568] text-white">
                  <th className="px-6 py-4 text-left text-sm font-semibold">Driver Name</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold">Driver ID</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold">Vehicle Number</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold">Start KM</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold">End KM</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold">Total KM</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold">Fuel Litres</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold">Fuel Expenses</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold">Action</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan="9" className="px-6 py-8 text-center text-[#6B8782]">
                      Loading driver report...
                    </td>
                  </tr>
                ) : paginatedData.length === 0 ? (
                  <tr>
                    <td colSpan="9" className="px-6 py-8 text-center text-[#6B8782]">
                      No drivers found
                    </td>
                  </tr>
                ) : (
                  paginatedData.map((driver, index) => (
                    <tr
                      key={driver.id}
                      className={`border-b border-[#D0E0DB] hover:bg-[#F0F4F3] transition-colors ${
                        index % 2 === 0 ? 'bg-white' : 'bg-[#F0F4F3]/30'
                      }`}
                    >
                      <td className="px-6 py-4">
                        <div className="font-semibold text-[#0D5C4D] text-sm">{driver.driverName}</div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-sm font-medium text-[#0D5C4D]">{driver.driverCode}</div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-sm font-medium text-[#0D5C4D]">{driver.vehicleNumber}</div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-sm font-medium text-[#0D5C4D]">{formatNumber(driver.startKM)}</div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-sm font-medium text-[#0D5C4D]">{formatNumber(driver.endKM)}</div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-sm font-bold text-[#0D5C4D]">{formatNumber(driver.totalKilometers)}</div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-sm font-medium text-[#0D5C4D]">{formatNumber(driver.fuelLitres)}</div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-sm font-bold text-[#0D5C4D]">{formatCurrency(driver.fuelExpenses)}</div>
                      </td>
                      <td className="px-6 py-4">
                        <button
                          onClick={() => navigate(`/reports/driver/${driver.id}`)}
                          className="px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition-colors flex items-center gap-2 text-sm"
                        >
                          <Eye className="w-4 h-4" />
                          View
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="flex flex-col sm:flex-row items-center justify-between px-6 py-4 bg-[#F0F4F3] border-t border-[#D0E0DB] gap-4">
            <div className="text-sm text-[#6B8782]">
              Showing {startIndex + 1} to {Math.min(startIndex + itemsPerPage, filteredData.length)} of {filteredData.length} drivers
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                disabled={currentPage === 1}
                className="px-4 py-2 border border-[#D0E0DB] rounded-lg text-[#0D5C4D] hover:bg-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                Previous
              </button>
              <div className="flex gap-1">
                {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
                  <button
                    key={page}
                    onClick={() => setCurrentPage(page)}
                    className={`px-4 py-2 border rounded-lg transition-colors ${
                      currentPage === page
                        ? 'bg-[#0D8568] text-white border-[#0D8568]'
                        : 'border-[#D0E0DB] text-[#0D5C4D] hover:bg-white'
                    }`}
                  >
                    {page}
                  </button>
                ))}
              </div>
              <button
                onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                disabled={currentPage === totalPages}
                className="px-4 py-2 border border-[#D0E0DB] rounded-lg text-[#0D5C4D] hover:bg-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                Next
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ReportDriver;
