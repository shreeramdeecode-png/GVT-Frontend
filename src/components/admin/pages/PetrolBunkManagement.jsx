import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import ConfirmDeleteModal from '../../common/ConfirmDeleteModal';
import { petrolBulkApi } from '../../../api/petrolBulkApi';
import { getAllFuelExpenses, updateFuelExpensePaymentStatus } from '../../../api/fuelExpenseApi';
import HistoryPaymentFilterBar, { PaymentStatusBadge } from '../common/HistoryPaymentFilterBar';

const isFuelPaid = (row) =>
  String(row?.payment_status || 'unpaid').toLowerCase() === 'paid';

const getExpenseRowId = (row) =>
  Number(row?.id ?? row?.fuel_expense_id ?? row?.fuelexpense_id);

const filterExpensesByDate = (expenses, fromDate, toDate) => {
  return expenses.filter((expense) => {
    const expenseDate = expense.date || '';
    if (fromDate && expenseDate < fromDate) return false;
    if (toDate && expenseDate > toDate) return false;
    return true;
  });
};

const summarizeExpenses = (expenses) => {
  const totalAmount = expenses.reduce(
    (sum, row) => sum + parseFloat(row.total_amount || 0),
    0
  );
  const totalLitres = expenses.reduce(
    (sum, row) => sum + parseFloat(row.litre || 0),
    0
  );
  const unpaidExpenses = expenses.filter((row) => !isFuelPaid(row));
  const paidExpenses = expenses.filter((row) => isFuelPaid(row));
  const unpaidAmount = unpaidExpenses.reduce(
    (sum, row) => sum + parseFloat(row.total_amount || 0),
    0
  );
  const paidAmount = paidExpenses.reduce(
    (sum, row) => sum + parseFloat(row.total_amount || 0),
    0
  );

  return {
    total_amount: totalAmount.toFixed(2),
    total_litres: totalLitres.toFixed(2),
    transaction_count: expenses.length,
    unpaid_amount: unpaidAmount.toFixed(2),
    unpaid_count: unpaidExpenses.length,
    paid_amount: paidAmount.toFixed(2),
    paid_count: paidExpenses.length
  };
};

const loadFuelHistoryForBunk = async (bunk, fromDate = '', toDate = '') => {
  const params = {};
  if (fromDate) params.from_date = fromDate;
  if (toDate) params.to_date = toDate;

  try {
    const response = await petrolBulkApi.getFuelHistory(bunk.pbid, params);
    const payload = response.data?.data;
    if (payload) return payload;
  } catch {
    // fallback when fuel-history route is unavailable
  }

  const allResponse = await getAllFuelExpenses();
  const allExpenses = allResponse?.data || [];
  const bunkName = (bunk.name || '').trim().toLowerCase();
  const matched = allExpenses.filter(
    (expense) =>
      Number(expense.pbid) === Number(bunk.pbid) ||
      (expense.petrol_bunk_name || '').trim().toLowerCase() === bunkName
  );
  const fuelExpenses = filterExpensesByDate(matched, fromDate, toDate);

  return {
    bunk,
    fuelExpenses,
    summary: summarizeExpenses(fuelExpenses)
  };
};

const PetrolBunkManagement = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [selectedBunk, setSelectedBunk] = useState(null);
  const [deleteModal, setDeleteModal] = useState({ isOpen: false, id: null, name: '' });

  const [petrolBunks, setPetrolBunks] = useState([]);
  const [totalItems, setTotalItems] = useState(0);
  const [loading, setLoading] = useState(false);
  const itemsPerPage = 7;
  const [formData, setFormData] = useState({ name: '', location: '', status: 'Active' });
  const [viewingHistory, setViewingHistory] = useState(null);
  const [fuelHistory, setFuelHistory] = useState([]);
  const [historySummary, setHistorySummary] = useState(null);
  const [allTimeSummary, setAllTimeSummary] = useState(null);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [dateFilterActive, setDateFilterActive] = useState(false);
  const [payingFuel, setPayingFuel] = useState(false);
  const [revertingFuel, setRevertingFuel] = useState(false);

  useEffect(() => {
    fetchPetrolBunks();
  }, [currentPage, searchTerm]);

  const fetchPetrolBunks = async () => {
    try {
      setLoading(true);
      const response = await petrolBulkApi.getAll(currentPage, itemsPerPage, searchTerm);
      setPetrolBunks(response.data.data);
      setTotalItems(response.data.pagination.totalItems);
    } catch (error) {
      console.error('Error fetching petrol bunks:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (bunk) => {
    setSelectedBunk(bunk);
    setFormData({ name: bunk.name, location: bunk.location, status: bunk.status });
    setIsEditModalOpen(true);
  };

  const handleDelete = (id, name) => {
    setDeleteModal({ isOpen: true, id, name });
  };

  const confirmDelete = async () => {
    try {
      await petrolBulkApi.delete(deleteModal.id);
      fetchPetrolBunks();
      setDeleteModal({ isOpen: false, id: null, name: '' });
    } catch (error) {
      console.error('Error deleting petrol bunk:', error);
      alert('Failed to delete: ' + (error.response?.data?.message || error.message));
    }
  };

  const handleAddSubmit = async (e) => {
    e.preventDefault();
    try {
      await petrolBulkApi.create(formData);
      fetchPetrolBunks();
      setIsAddModalOpen(false);
      setFormData({ name: '', location: '', status: 'Active' });
    } catch (error) {
      console.error('Error creating petrol bunk:', error);
    }
  };

  const handleEditSubmit = async (e) => {
    e.preventDefault();
    try {
      await petrolBulkApi.update(selectedBunk.pbid, formData);
      fetchPetrolBunks();
      setIsEditModalOpen(false);
      setFormData({ name: '', location: '', status: 'Active' });
    } catch (error) {
      console.error('Error updating petrol bunk:', error);
      alert('Failed to update: ' + (error.response?.data?.message || error.message));
    }
  };

  const refreshFuelHistory = useCallback(async (bunk, startDate, endDate) => {
    const result = await loadFuelHistoryForBunk(bunk, startDate, endDate);
    if (result?.bunk) setViewingHistory(result.bunk);
    setFuelHistory(result?.fuelExpenses || []);
    setHistorySummary(result?.summary || null);
    if (!startDate && !endDate) {
      setAllTimeSummary(result?.summary || null);
    }
    return result;
  }, []);

  const handleViewHistory = async (bunk) => {
    setViewingHistory(bunk);
    setFromDate('');
    setToDate('');
    setDateFilterActive(false);
    setLoadingHistory(true);
    setFuelHistory([]);
    setHistorySummary(null);

    try {
      await refreshFuelHistory(bunk, '', '');
    } catch (error) {
      console.error('Error fetching fuel history:', error);
      alert(error?.message || 'Failed to fetch fuel history');
    } finally {
      setLoadingHistory(false);
    }
  };

  const handleApplyDateFilter = async () => {
    if (!viewingHistory) return;
    if (fromDate && toDate && fromDate > toDate) {
      alert('From date cannot be after end date');
      return;
    }

    setLoadingHistory(true);
    try {
      await refreshFuelHistory(viewingHistory, fromDate, toDate);
      setDateFilterActive(Boolean(fromDate || toDate));
    } catch (error) {
      console.error('Error filtering fuel history:', error);
      alert(error?.message || 'Failed to filter fuel history');
    } finally {
      setLoadingHistory(false);
    }
  };

  const applyFuelPaymentUpdate = async ({ mode, rowsInView, fallbackStatus, setBusy }) => {
    if (!viewingHistory) return;

    const count = rowsInView.length;
    const amount = rowsInView
      .reduce((sum, row) => sum + parseFloat(row.total_amount || 0), 0)
      .toFixed(2);

    if (count === 0) {
      alert(
        mode === 'pay'
          ? 'No unpaid fuel expenses in the selected date range'
          : 'No paid fuel expenses to revert in the selected date range'
      );
      return;
    }

    const dateLabel =
      fromDate || toDate
        ? ` from ${fromDate || 'start'} to ${toDate || 'end'}`
        : '';

    const confirmMsg =
      mode === 'pay'
        ? `Mark ${count} transaction(s) as paid for ₹${amount}${dateLabel}?`
        : `Revert ${count} paid transaction(s) (₹${amount}) back to unpaid${dateLabel}?`;

    if (!window.confirm(confirmMsg)) return;

    setBusy(true);
    try {
      const updates = rowsInView.map((expense) => {
        const id = getExpenseRowId(expense);
        if (Number.isNaN(id)) {
          return Promise.reject(new Error('Missing fuel expense id on a row'));
        }
        return updateFuelExpensePaymentStatus(id, fallbackStatus);
      });

      await Promise.all(updates);
      await refreshFuelHistory(viewingHistory, fromDate, toDate);
      alert(`${count} transaction(s) updated`);
    } catch (error) {
      console.error(`Error updating fuel payment (${mode}):`, error);
      const msg = error.message || 'Failed to update payment status';
      alert(
        msg.includes('404')
          ? `${msg}\n\nRestart the backend (vsd_backend) and try again.`
          : msg
      );
    } finally {
      setBusy(false);
    }
  };

  const handlePayNow = () => {
    const unpaidInView = fuelHistory.filter((row) => !isFuelPaid(row));
    return applyFuelPaymentUpdate({
      mode: 'pay',
      rowsInView: unpaidInView,
      fallbackStatus: 'paid',
      setBusy: setPayingFuel
    });
  };

  const handleRevertPayment = () => {
    const paidInView = fuelHistory.filter((row) => isFuelPaid(row));
    return applyFuelPaymentUpdate({
      mode: 'revert',
      rowsInView: paidInView,
      fallbackStatus: 'unpaid',
      setBusy: setRevertingFuel
    });
  };

  const handleBackToList = () => {
    setViewingHistory(null);
    setFuelHistory([]);
    setHistorySummary(null);
    setAllTimeSummary(null);
    setFromDate('');
    setToDate('');
    setDateFilterActive(false);
  };

  const filteredDisplaySummary = useMemo(() => {
    const rowStats = summarizeExpenses(fuelHistory);
    if (!historySummary) return rowStats;
    return {
      ...historySummary,
      total_amount: rowStats.total_amount,
      total_litres: rowStats.total_litres,
      transaction_count: rowStats.transaction_count,
      unpaid_amount: rowStats.unpaid_amount,
      unpaid_count: rowStats.unpaid_count,
      paid_amount: rowStats.paid_amount,
      paid_count: rowStats.paid_count
    };
  }, [historySummary, fuelHistory]);

  const paidInViewCount = useMemo(
    () => fuelHistory.filter((row) => isFuelPaid(row)).length,
    [fuelHistory]
  );
  const unpaidInViewCount = useMemo(
    () => fuelHistory.filter((row) => !isFuelPaid(row)).length,
    [fuelHistory]
  );

  const totalPages = Math.ceil(totalItems / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;

  const settingsTabs = (
    <div className="px-6 sm:px-8 py-4">
      <div className="flex flex-wrap gap-2">
          <button 
            onClick={() => navigate('/settings')}
            className={`px-6 py-2.5 rounded-lg font-medium text-sm transition-colors ${
              location.pathname === '/settings' 
                ? 'bg-[#0D7C66] text-white' 
                : 'bg-[#D4F4E8] text-[#0D5C4D] hover:bg-[#B8F4D8]'
            }`}
          >
            Inventory Management
          </button>
          <button 
            onClick={() => navigate('/settings/inventory-company')}
            className={`px-6 py-2.5 rounded-lg font-medium text-sm transition-colors ${
              location.pathname === '/settings/inventory-company' 
                ? 'bg-[#0D7C66] text-white' 
                : 'bg-[#D4F4E8] text-[#0D5C4D] hover:bg-[#B8F4D8]'
            }`}
          >
            Inventory Company
          </button>
          <button 
            onClick={() => navigate('/settings/airport')}
            className={`px-6 py-2.5 rounded-lg font-medium text-sm transition-colors ${
              location.pathname === '/settings/airport' 
                ? 'bg-[#0D7C66] text-white' 
                : 'bg-[#D4F4E8] text-[#0D5C4D] hover:bg-[#B8F4D8]'
            }`}
          >
            Airport Locations
          </button>
          <button 
            onClick={() => navigate('/settings/petroleum')}
            className={`px-6 py-2.5 rounded-lg font-medium text-sm transition-colors ${
              location.pathname === '/settings/petroleum' 
                ? 'bg-[#0D7C66] text-white' 
                : 'bg-[#D4F4E8] text-[#0D5C4D] hover:bg-[#B8F4D8]'
            }`}
          >
            Petroleum Management
          </button>
          <button 
            onClick={() => navigate('/settings/labour-rate')}
            className={`px-6 py-2.5 rounded-lg font-medium text-sm transition-colors ${
              location.pathname === '/settings/labour-rate' 
                ? 'bg-[#0D7C66] text-white' 
                : 'bg-[#D4F4E8] text-[#0D5C4D] hover:bg-[#B8F4D8]'
            }`}
          >
            Labour Rate
          </button>
          <button 
            onClick={() => navigate('/settings/driver-rate')}
            className={`px-6 py-2.5 rounded-lg font-medium text-sm transition-colors ${
              location.pathname === '/settings/driver-rate' 
                ? 'bg-[#0D7C66] text-white' 
                : 'bg-[#D4F4E8] text-[#0D5C4D] hover:bg-[#B8F4D8]'
            }`}
          >
            Driver Rate
          </button>
          <button 
            onClick={() => navigate('/settings/customers')}
            className={`px-6 py-2.5 rounded-lg font-medium text-sm transition-colors ${
              location.pathname === '/settings/customers' 
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
  );

  if (viewingHistory) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="px-4 sm:px-6 lg:px-8 py-6">
          <button
            onClick={handleBackToList}
            className="mb-4 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors flex items-center gap-2"
          >
            ← Back to Petrol Bunks
          </button>

          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-1">{viewingHistory.name}</h2>
            <p className="text-sm text-gray-600 mb-4">{viewingHistory.location}</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-sm">
              <div>
                <span className="text-gray-600">All-Time Fuel Amount: </span>
                <span className="font-semibold text-gray-900">
                  ₹{allTimeSummary?.total_amount || historySummary?.total_amount || '0.00'}
                </span>
              </div>
              <div>
                <span className="text-gray-600">Total Litres: </span>
                <span className="font-semibold text-emerald-700">
                  {allTimeSummary?.total_litres || historySummary?.total_litres || '0.00'} L
                </span>
              </div>
              <div>
                <span className="text-gray-600">Transactions: </span>
                <span className="font-semibold text-gray-900">
                  {allTimeSummary?.transaction_count ?? historySummary?.transaction_count ?? 0}
                </span>
              </div>
              <div>
                <span className="text-gray-600">Unpaid Fuel: </span>
                <span className="font-semibold text-red-600">
                  ₹{allTimeSummary?.unpaid_amount ?? historySummary?.unpaid_amount ?? '0.00'}
                </span>
              </div>
            </div>

            <HistoryPaymentFilterBar
              fromDate={fromDate}
              toDate={toDate}
              onFromDateChange={setFromDate}
              onToDateChange={setToDate}
              onApplyFilter={handleApplyDateFilter}
              onClear={() => {
                setFromDate('');
                setToDate('');
                setDateFilterActive(false);
                if (viewingHistory) {
                  setLoadingHistory(true);
                  refreshFuelHistory(viewingHistory, '', '').finally(() =>
                    setLoadingHistory(false)
                  );
                }
              }}
              loading={loadingHistory}
              dateFilterActive={dateFilterActive}
              filteredTotal={filteredDisplaySummary?.total_amount || '0.00'}
              paying={payingFuel}
              reverting={revertingFuel}
              unpaidCount={unpaidInViewCount}
              paidCount={paidInViewCount}
              onPayNow={handlePayNow}
              onRevertPayment={handleRevertPayment}
            />
          </div>

          <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Date</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Driver</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Vehicle No</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Fuel Type</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Unit Price</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Litres</th>
                    <th className="px-6 py-3 text-center text-xs font-semibold text-gray-700 uppercase tracking-wider">Total Amount</th>
                    <th className="px-6 py-3 text-center text-xs font-semibold text-gray-700 uppercase tracking-wider">Payment</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {loadingHistory ? (
                    <tr>
                      <td colSpan="8" className="px-6 py-8 text-center text-gray-500">
                        Loading fuel history...
                      </td>
                    </tr>
                  ) : fuelHistory.length === 0 ? (
                    <tr>
                      <td colSpan="8" className="px-6 py-8 text-center text-gray-500">
                        No fuel history found
                      </td>
                    </tr>
                  ) : (
                    fuelHistory.map((expense) => (
                        <tr key={getExpenseRowId(expense) || expense.date} className="hover:bg-gray-50 transition-colors">
                          <td className="px-6 py-4 text-sm text-gray-600">{expense.date || '-'}</td>
                          <td className="px-6 py-4 text-sm text-gray-900">
                            {expense.driver?.driver_name || '-'}
                          </td>
                          <td className="px-6 py-4 text-sm text-gray-600">
                            {expense.vehicle_number || expense.driver?.vehicle_number || '-'}
                          </td>
                          <td className="px-6 py-4 text-sm text-gray-600">{expense.fuel_type || '-'}</td>
                          <td className="px-6 py-4 text-sm text-gray-600">₹{expense.unit_price}</td>
                          <td className="px-6 py-4 text-sm text-gray-600">{expense.litre} L</td>
                          <td className="px-6 py-4 text-sm text-gray-600 text-center">₹{expense.total_amount}</td>
                          <td className="px-6 py-4 text-sm text-center">
                            <PaymentStatusBadge paid={isFuelPaid(expense)} />
                          </td>
                        </tr>
                      ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {settingsTabs}

      {/* Main Content */}
      <div className="px-4 sm:px-6 lg:px-8 py-6">
        {/* Search and Add Button */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 mb-6">
          <div className="p-4 sm:p-6">
            <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
              {/* Search */}
              <div className="relative w-full sm:max-w-md">
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
                  placeholder="Search petrol bunks..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 text-sm"
                />
              </div>

              {/* Add Button */}
              <button
                onClick={() => setIsAddModalOpen(true)}
                className="w-full sm:w-auto px-5 py-2.5 bg-emerald-500 text-white rounded-lg font-medium text-sm hover:bg-emerald-600 transition-colors flex items-center justify-center gap-2"
              >
                <span className="text-lg">+</span>
                Add Petrol Bunk
              </button>
            </div>
          </div>
        </div>

        {/* Table */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full table-fixed">
              <colgroup>
                <col className="w-[28%]" />
                <col className="w-[24%]" />
                <col className="w-[18%]" />
                <col className="w-[30%]" />
              </colgroup>
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider align-middle">
                    Petrol Bunk Name
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider align-middle">
                    Location
                  </th>
                  <th className="px-6 py-3 text-center text-xs font-semibold text-gray-700 uppercase tracking-wider align-middle">
                    Status
                  </th>
                  <th className="px-6 py-3 text-center text-xs font-semibold text-gray-700 uppercase tracking-wider align-middle">
                    Action
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {loading ? (
                  <tr>
                    <td colSpan="4" className="px-6 py-8 text-center text-gray-500">Loading...</td>
                  </tr>
                ) : petrolBunks.length === 0 ? (
                  <tr>
                    <td colSpan="4" className="px-6 py-8 text-center text-gray-500">No petrol bunks found</td>
                  </tr>
                ) : petrolBunks.map((bunk) => (
                  <tr key={bunk.pbid} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4 text-sm text-gray-900 align-middle">{bunk.name}</td>
                    <td className="px-6 py-4 text-sm text-gray-900 align-middle">{bunk.location}</td>
                    <td className="px-6 py-4 text-sm text-center align-middle">
                      <div className="flex justify-center">
                        <span
                          className={`inline-flex px-3 py-1 rounded-full text-xs font-medium ${
                            bunk.status === 'Active'
                              ? 'bg-emerald-100 text-emerald-700'
                              : 'bg-yellow-100 text-yellow-700'
                          }`}
                        >
                          {bunk.status}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm text-center align-middle">
                      <div className="flex items-center justify-center gap-2 flex-nowrap">
                        <button
                          type="button"
                          onClick={() => handleViewHistory(bunk)}
                          className="px-2.5 py-1 h-7 bg-emerald-500 text-white rounded-lg text-xs font-medium hover:bg-emerald-600 transition-colors whitespace-nowrap leading-none"
                        >
                          View History
                        </button>
                        <button
                          type="button"
                          onClick={() => handleEdit(bunk)}
                          className="px-2.5 py-1 h-7 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors text-xs font-medium whitespace-nowrap leading-none"
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDelete(bunk.pbid, bunk.name)}
                          className="px-2.5 py-1 h-7 text-red-600 bg-red-50 rounded-lg hover:bg-red-100 transition-colors text-xs font-medium whitespace-nowrap leading-none"
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="px-6 py-4 border-t border-gray-200 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="text-sm text-gray-600">
              Showing {startIndex + 1} to {Math.min(startIndex + itemsPerPage, totalItems)} of {totalItems} petrol bunks
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
                return (
                  <button
                    key={pageNumber}
                    onClick={() => setCurrentPage(pageNumber)}
                    className={`min-w-[40px] px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                      currentPage === pageNumber
                        ? 'bg-emerald-500 text-white'
                        : 'border border-gray-300 text-gray-700 hover:bg-gray-50'
                    }`}
                  >
                    {pageNumber}
                  </button>
                );
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

      {/* Add Petrol Bunk Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md">
            <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
              <h2 className="text-xl font-semibold text-gray-900">Add Petrol Bunk</h2>
              <button onClick={() => setIsAddModalOpen(false)} className="text-gray-400 hover:text-gray-600">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <form onSubmit={handleAddSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Petrol Bunk Name</label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                  placeholder="Enter petrol bunk name"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Location</label>
                <input
                  type="text"
                  required
                  value={formData.location}
                  onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                  placeholder="Enter location"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                <select
                  value={formData.status}
                  onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                >
                  <option value="Active">Active</option>
                  <option value="Inactive">Inactive</option>
                </select>
              </div>
              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 bg-emerald-500 text-white rounded-lg hover:bg-emerald-600 font-medium"
                >
                  Add Petrol Bunk
                </button>
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
        title="Delete Petrol Bunk"
        message={`Are you sure you want to delete "${deleteModal.name}"? This action cannot be undone.`}
      />

      {/* Edit Petrol Bunk Modal */}
      {isEditModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md">
            <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
              <h2 className="text-xl font-semibold text-gray-900">Edit Petrol Bunk</h2>
              <button onClick={() => setIsEditModalOpen(false)} className="text-gray-400 hover:text-gray-600">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <form onSubmit={handleEditSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Petrol Bunk Name</label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Location</label>
                <input
                  type="text"
                  required
                  value={formData.location}
                  onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                  placeholder="Enter location"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                <select
                  value={formData.status}
                  onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                >
                  <option value="Active">Active</option>
                  <option value="Inactive">Inactive</option>
                </select>
              </div>
              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setIsEditModalOpen(false)}
                  className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 bg-emerald-500 text-white rounded-lg hover:bg-emerald-600 font-medium"
                >
                  Update Petrol Bunk
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default PetrolBunkManagement;
