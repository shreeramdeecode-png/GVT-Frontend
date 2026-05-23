import React from 'react';

/**
 * Shared date filter + Pay Now / Revert Payment bar for company/bunk history views.
 */
const HistoryPaymentFilterBar = ({
  fromDate,
  toDate,
  onFromDateChange,
  onToDateChange,
  onApplyFilter,
  onClear,
  loading = false,
  dateFilterActive = false,
  filteredTotal = '0.00',
  paying = false,
  reverting = false,
  unpaidCount = 0,
  paidCount = 0,
  onPayNow,
  onRevertPayment
}) => (
  <div className="flex flex-col lg:flex-row lg:items-end gap-4 pt-4 border-t border-gray-200">
    <div className="flex flex-col sm:flex-row gap-3 flex-1">
      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">From Date</label>
        <input
          type="date"
          value={fromDate}
          onChange={(e) => onFromDateChange(e.target.value)}
          className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
        />
      </div>
      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">End Date</label>
        <input
          type="date"
          value={toDate}
          onChange={(e) => onToDateChange(e.target.value)}
          className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
        />
      </div>
      <div className="flex items-end gap-2">
        <button
          type="button"
          onClick={onApplyFilter}
          disabled={loading}
          className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50 disabled:opacity-60"
        >
          Apply Filter
        </button>
        <button
          type="button"
          onClick={onClear}
          disabled={loading}
          className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50 disabled:opacity-60"
        >
          Clear
        </button>
      </div>
    </div>
    <div className="flex flex-wrap items-center justify-end gap-3 lg:ml-auto">
      {dateFilterActive && (
        <p className="text-sm text-gray-600 mr-1">
          Filtered Total:{' '}
          <span className="font-semibold text-gray-900">₹{filteredTotal}</span>
        </p>
      )}
      <button
        type="button"
        onClick={onPayNow}
        disabled={paying || reverting || loading || unpaidCount === 0}
        className="px-5 py-2 bg-emerald-600 text-white rounded-lg text-sm font-medium hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
      >
        {paying ? 'Processing...' : 'Pay Now'}
      </button>
      <button
        type="button"
        onClick={onRevertPayment}
        disabled={paying || reverting || loading || paidCount === 0}
        className="px-5 py-2 border border-amber-500 text-amber-700 bg-amber-50 rounded-lg text-sm font-medium hover:bg-amber-100 disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
      >
        {reverting ? 'Reverting...' : 'Revert Payment'}
      </button>
    </div>
  </div>
);

export const PaymentStatusBadge = ({ paid }) => (
  <span
    className={`inline-flex px-3 py-1 rounded-full text-xs font-medium ${
      paid ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
    }`}
  >
    {paid ? 'Paid' : 'Unpaid'}
  </span>
);

export default HistoryPaymentFilterBar;
