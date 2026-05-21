import React, { useState, useMemo, useCallback } from 'react';
import { Search, ChevronDown, Download, FileText, X } from 'lucide-react';
import * as XLSX from 'xlsx-js-style';
import jsPDF from 'jspdf';
import 'jspdf-autotable';

export const PAYOUT_STATUS_ORDER = { Pending: 0, Partial: 1, Paid: 2 };

export function sortPayoutsByStatus(list) {
  return [...list].sort((a, b) => {
    const sa = PAYOUT_STATUS_ORDER[a.status] ?? 0;
    const sb = PAYOUT_STATUS_ORDER[b.status] ?? 0;
    if (sa !== sb) return sa - sb;
    const da = new Date(a.date || a.lastSupplied || 0).getTime();
    const db = new Date(b.date || b.lastSupplied || 0).getTime();
    return db - da;
  });
}

export function filterPayoutsByDateRange(list, fromDate, toDate, getDate) {
  return list.filter((p) => {
    const raw = getDate(p);
    const d = raw ? String(raw).substring(0, 10) : '';
    if (!d) return !fromDate && !toDate;
    if (fromDate && d < fromDate) return false;
    if (toDate && d > toDate) return false;
    return true;
  });
}

export function getPartialPaidAmount(paymentRecord) {
  if (!paymentRecord) return 0;
  const rowData = paymentRecord.row_data || paymentRecord;
  const amt =
    rowData?.partialPaidAmount ??
    rowData?.partial_amount ??
    paymentRecord?.partialPaidAmount ??
    paymentRecord?.partial_amount;
  return parseFloat(amt) || 0;
}

export function formatPayoutDisplayDate(date) {
  if (!date) return '—';
  const s = String(date).substring(0, 10);
  if (!s) return '—';
  return new Date(`${s}T12:00:00`).toLocaleDateString('en-GB');
}

export function formatPayoutCurrency(amount) {
  const value = Number.isFinite(Number(amount)) ? Number(amount) : 0;
  return `₹${value.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;
}

export function getPayoutBalanceAmount(payout, totalField = 'amount') {
  const total = Number(
    payout?.[totalField] ?? payout?.amount ?? payout?.totalPayout ?? 0
  );
  const partial = Number(payout?.partialPaidAmount || 0);
  return Math.max(total - partial, 0);
}

export function buildEntityFilterOptions(
  payouts,
  { idField = 'entity_id', nameField, codeField, allLabel = 'All' }
) {
  const seen = new Map();
  payouts.forEach((p) => {
    const id = String(p[idField] ?? '');
    if (!id || seen.has(id)) return;
    const code = codeField && p[codeField] ? ` (${p[codeField]})` : '';
    seen.set(id, { value: id, label: `${p[nameField] || 'Unknown'}${code}` });
  });
  return [
    { value: '', label: allLabel },
    ...[...seen.values()].sort((a, b) => a.label.localeCompare(b.label)),
  ];
}

export function usePayoutPayAll(filteredPayouts, options = {}) {
  const { totalField = 'amount', getRowKey } = options;
  const [payAllModalOpen, setPayAllModalOpen] = useState(false);
  const [payAllSelected, setPayAllSelected] = useState([]);

  const resolveKey = useCallback(
    (p) => (getRowKey ? getRowKey(p) : p.key ?? p.id),
    [getRowKey]
  );

  const getBalanceAmount = useCallback(
    (payout) => getPayoutBalanceAmount(payout, totalField),
    [totalField]
  );

  const payAllTargets = useMemo(
    () => filteredPayouts.filter((p) => p.status !== 'Paid'),
    [filteredPayouts]
  );

  const openPayAllModal = useCallback(() => {
    if (payAllTargets.length === 0) {
      alert('No pending payouts in current filter');
      return;
    }
    setPayAllSelected([...payAllTargets]);
    setPayAllModalOpen(true);
  }, [payAllTargets]);

  const closePayAllModal = useCallback((busy = false) => {
    if (busy) return;
    setPayAllModalOpen(false);
    setPayAllSelected([]);
  }, []);

  const removeFromPayAll = useCallback(
    (key) => {
      setPayAllSelected((prev) => prev.filter((p) => resolveKey(p) !== key));
    },
    [resolveKey]
  );

  return {
    payAllModalOpen,
    payAllSelected,
    payAllTargets,
    openPayAllModal,
    closePayAllModal,
    removeFromPayAll,
    getBalanceAmount,
    resolveKey,
  };
}

export const payoutExportDate = (val) => {
  if (!val) return '—';
  const s = String(val).substring(0, 10);
  if (!s) return '—';
  const d = new Date(`${s}T12:00:00`);
  return Number.isNaN(d.getTime()) ? s : d.toLocaleDateString('en-GB');
};

export const buildPayoutExportSubtitle = ({ fromDate, toDate, timeFilter, extra = '' }) => {
  let subtitle = `Generated on: ${new Date().toLocaleDateString('en-GB')}`;
  if (fromDate) subtitle += ` | From: ${fromDate}`;
  if (toDate) subtitle += ` | To: ${toDate}`;
  if (timeFilter && timeFilter !== 'All Time') subtitle += ` | Period: ${timeFilter}`;
  if (extra) subtitle += ` | ${extra}`;
  return subtitle;
};

export const exportPayoutExcel = (rows, { sheetName, filePrefix }) => {
  if (!rows?.length) {
    alert('No payout data to export.');
    return;
  }
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.json_to_sheet(rows);
  XLSX.utils.book_append_sheet(wb, ws, sheetName);
  XLSX.writeFile(
    wb,
    `${filePrefix}_${new Date().toISOString().split('T')[0]}.xlsx`,
    { bookType: 'xlsx', cellStyles: true }
  );
};

export const exportPayoutPdf = ({ title, subtitle, headers, body, filePrefix }) => {
  if (!body?.length) {
    alert('No payout data to export.');
    return;
  }
  const doc = new jsPDF('p', 'pt', 'a4');
  doc.setFillColor(13, 92, 77);
  doc.rect(0, 0, 595, 50, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(18);
  doc.setFont(undefined, 'bold');
  doc.text(title, 297.5, 30, { align: 'center' });
  doc.setFontSize(10);
  doc.setFont(undefined, 'normal');
  doc.text(subtitle, 297.5, 42, { align: 'center' });
  doc.autoTable({
    startY: 60,
    head: [headers],
    body,
    theme: 'grid',
    headStyles: { fillColor: [13, 92, 77], textColor: 255, fontStyle: 'bold', halign: 'center' },
    bodyStyles: { fontSize: 9, halign: 'center' },
    alternateRowStyles: { fillColor: [240, 253, 244] },
  });
  doc.save(`${filePrefix}_${new Date().toISOString().split('T')[0]}.pdf`);
};

export const payoutTh =
  'px-4 py-3 text-xs font-semibold uppercase tracking-wide text-[#0D5C4D] whitespace-nowrap';
export const payoutTd = 'px-4 py-3 align-middle text-sm text-[#0D5C4D]';
export const payoutTdNum = `${payoutTd} text-right tabular-nums whitespace-nowrap`;
export const payoutTdKm = `${payoutTd} text-center tabular-nums whitespace-nowrap`;
export const payoutTdCenter = `${payoutTd} text-center whitespace-nowrap`;
export const payoutEmptyCell = 'px-4 py-10 text-center text-sm text-[#6B8782]';
export const payoutTableWrap = 'bg-white rounded-2xl overflow-hidden border border-[#D0E0DB] shadow-sm';
export const payoutTableScroll = 'overflow-x-auto';
export const payoutTableBase = 'w-full border-collapse text-sm';
export const payoutThead = 'bg-[#D4F4E8] border-b border-[#B8E6D3]';
export const payoutTbody = 'divide-y divide-[#D0E0DB]';
export const payoutRow = (index) =>
  `transition-colors hover:bg-[#E8F5F0] ${index % 2 === 0 ? 'bg-white' : 'bg-[#FAFCFB]'}`;
export const payoutBtn = {
  ghost:
    'shrink-0 px-2.5 py-1.5 text-xs font-semibold text-[#0D5C4D] border border-[#0D5C4D] rounded-lg hover:bg-[#D4F4E8] whitespace-nowrap',
  advance:
    'shrink-0 px-2.5 py-1.5 text-xs font-semibold text-amber-800 border border-amber-400 rounded-lg hover:bg-amber-50 whitespace-nowrap',
  partial:
    'shrink-0 px-2.5 py-1.5 text-xs font-semibold bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 whitespace-nowrap',
  pay: 'shrink-0 px-2.5 py-1.5 text-xs font-semibold bg-[#0D8568] text-white rounded-lg hover:bg-[#0a6b54] disabled:opacity-50 whitespace-nowrap',
  revert:
    'shrink-0 px-2.5 py-1.5 text-xs font-semibold border border-red-300 text-red-600 rounded-lg hover:bg-red-50 disabled:opacity-50 whitespace-nowrap',
};
export const payoutActionRow = 'inline-flex flex-nowrap items-center justify-center gap-1.5';
export const driverTh = payoutTh;
export const driverTd = payoutTd;
export const driverTdNum = payoutTdNum;
export const driverTdKm = payoutTdKm;
export const driverBtn = payoutBtn;

export function getPayoutStatusClassName(status) {
  const s = String(status || '').toLowerCase();
  if (s === 'paid') return 'bg-[#D4F4E8] text-[#047857]';
  if (s === 'partial') return 'bg-blue-100 text-blue-700';
  return 'bg-amber-100 text-amber-800';
}

const labelClass = 'block text-xs font-medium text-[#6B8782] mb-1';
const fieldClass =
  'w-full h-10 text-sm border border-[#D0E0DB] rounded-md bg-[#F8FBFA] text-[#0D5C4D] focus:outline-none focus:ring-1 focus:ring-[#0D7C66]/40 focus:border-[#0D7C66]';

/**
 * Shared payout filter row — single horizontal row on md+ (matches Driver Payout).
 */
export default function PayoutFilterBar({
  idPrefix = 'payout',
  searchValue = '',
  onSearchChange,
  searchPlaceholder = 'Search...',
  fromDate = '',
  onFromDateChange,
  toDate = '',
  onToDateChange,
  entityFilter,
  extraFilter,
  onClear,
  onPayAll,
  payAllDisabled = false,
  payAllLoading = false,
  onExportPDF,
  onExportExcel,
  onExport,
}) {
  const hasDateFilter = Boolean(fromDate || toDate);
  const hasEntity = Boolean(entityFilter);
  const hasExtra = Boolean(extraFilter);

  const btnBase =
    'inline-flex shrink-0 items-center justify-center h-10 min-w-[5.5rem] px-5 text-sm font-medium rounded-md transition-colors whitespace-nowrap';

  const fieldBase = 'min-w-0 w-full md:w-auto';
  const searchWrap = hasEntity || hasExtra
    ? `${fieldBase} md:flex-[2] md:min-w-[12rem]`
    : `${fieldBase} md:flex-[2.5] md:min-w-[14rem]`;
  const dateWrap = `${fieldBase} md:flex-1 md:min-w-[11rem] md:max-w-[13.5rem]`;
  const entityWrap = `${fieldBase} md:flex-[1.25] md:min-w-[12rem] md:max-w-[16rem]`;
  const extraWrap = `${fieldBase} md:flex-1 md:min-w-[10.5rem] md:max-w-[13rem]`;

  return (
    <div className="bg-white rounded-lg border border-[#D0E0DB] mb-4 px-3 py-3 shadow-sm w-full overflow-x-auto">
      <div className="flex flex-col gap-3 md:flex-row md:flex-nowrap md:items-end md:gap-3 w-full">
          <div className={searchWrap}>
            <label htmlFor={`${idPrefix}-search`} className={labelClass}>
              Search
            </label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#6B8782] pointer-events-none" />
              <input
                id={`${idPrefix}-search`}
                type="text"
                placeholder={searchPlaceholder}
                value={searchValue}
                onChange={(e) => onSearchChange?.(e.target.value)}
                className={`${fieldClass} pl-9 pr-3 placeholder:text-[#9BB5B0]`}
              />
            </div>
          </div>

          {extraFilter && <div className={extraWrap}>{extraFilter}</div>}

          <div className={dateWrap}>
            <label htmlFor={`${idPrefix}-from`} className={labelClass}>
              From
            </label>
            <input
              id={`${idPrefix}-from`}
              type="date"
              value={fromDate}
              onChange={(e) => onFromDateChange?.(e.target.value)}
              className={`${fieldClass} px-2.5`}
            />
          </div>

          <div className={dateWrap}>
            <label htmlFor={`${idPrefix}-to`} className={labelClass}>
              To
            </label>
            <input
              id={`${idPrefix}-to`}
              type="date"
              value={toDate}
              onChange={(e) => onToDateChange?.(e.target.value)}
              className={`${fieldClass} px-2.5`}
            />
          </div>

          {entityFilter && (
            <div className={entityWrap}>
              <label htmlFor={`${idPrefix}-entity`} className={labelClass}>
                {entityFilter.label}
              </label>
              <div className="relative">
                <select
                  id={`${idPrefix}-entity`}
                  value={entityFilter.value}
                  onChange={(e) => entityFilter.onChange?.(e.target.value)}
                  className={`${fieldClass} appearance-none pl-2.5 pr-8`}
                >
                  {entityFilter.options?.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
                <ChevronDown className="w-4 h-4 text-[#6B8782] absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>
            </div>
          )}

        <div className="flex items-center gap-2 flex-nowrap shrink-0 w-full md:w-auto md:pb-0 pb-0">
          {hasDateFilter && onPayAll && (
            <button
              type="button"
              onClick={onPayAll}
              disabled={payAllDisabled || payAllLoading}
              className={`${btnBase} font-semibold bg-[#0D7C66] hover:bg-[#0b6a57] text-white disabled:opacity-50`}
            >
              {payAllLoading ? 'Paying...' : 'Pay All'}
            </button>
          )}
          {onClear && (
            <button
              type="button"
              onClick={onClear}
              className={`${btnBase} border border-[#D0E0DB] bg-white text-[#0D5C4D] hover:bg-[#F0F4F3]`}
            >
              Clear
            </button>
          )}
          {onExportPDF && (
            <button
              type="button"
              onClick={onExportPDF}
              className={`${btnBase} gap-1.5 border border-red-200 bg-red-50 text-red-700 hover:bg-red-100`}
            >
              <FileText className="w-4 h-4 shrink-0" />
              PDF
            </button>
          )}
          {onExportExcel && (
            <button
              type="button"
              onClick={onExportExcel}
              className={`${btnBase} gap-1.5 border border-[#0D7C66]/30 bg-[#D4F4E8] text-[#0D5C4D] hover:bg-[#c5ebd9]`}
            >
              <Download className="w-4 h-4 shrink-0" />
              Excel
            </button>
          )}
          {onExport && !onExportPDF && !onExportExcel && (
            <button
              type="button"
              onClick={onExport}
              className={`${btnBase} gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white border-0`}
            >
              <Download className="w-4 h-4 shrink-0" />
              Export
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

/** Native select matching PayoutFilterBar field styles */
export function PayoutSelectField({ id, label, value, onChange, options = [] }) {
  return (
    <div>
      <label htmlFor={id} className={labelClass}>
        {label}
      </label>
      <div className="relative">
        <select
          id={id}
          value={value}
          onChange={(e) => onChange?.(e.target.value)}
          className={`${fieldClass} appearance-none pl-2.5 pr-8`}
        >
          {options.map((opt) => (
            <option key={opt.value ?? opt} value={opt.value ?? opt}>
              {opt.label ?? opt}
            </option>
          ))}
        </select>
        <ChevronDown className="w-4 h-4 text-[#6B8782] absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
      </div>
    </div>
  );
}

/** Pay-all confirmation dialog (used with PayoutFilterBar date filter + Pay All). */
export function PayAllConfirmModal({
  open,
  fromDate = '',
  toDate = '',
  rows = [],
  entityColumnLabel = 'Entity',
  getEntityPrimary,
  getEntitySecondary,
  getRowDate,
  getRowKey,
  getBalanceAmount,
  onRemove,
  onClose,
  onConfirm,
  loading = false,
}) {
  if (!open) return null;

  const totalBalance = rows.reduce(
    (sum, p) => sum + (getBalanceAmount ? getBalanceAmount(p) : 0),
    0
  );

  return (
    <div className="fixed inset-0 z-[120] bg-black/40 flex items-center justify-center p-4">
      <div className="w-full max-w-lg bg-white rounded-xl border border-[#D0E0DB] shadow-xl p-5 max-h-[90vh] flex flex-col">
        <h3 className="text-lg font-semibold text-[#0D5C4D] mb-1">Pay All — Confirm</h3>
        <p className="text-sm text-[#6B8782] mb-3">
          {fromDate || toDate
            ? `Date range: ${fromDate ? formatPayoutDisplayDate(fromDate) : '…'} to ${toDate ? formatPayoutDisplayDate(toDate) : '…'}`
            : 'Filtered payouts'}
          {' · '}
          {rows.length} payout{rows.length !== 1 ? 's' : ''} selected
        </p>
        <div className="rounded-lg bg-[#D4F4E8]/60 border border-[#D0E0DB] px-4 py-3 mb-4">
          <div className="text-xs font-medium text-[#6B8782] uppercase tracking-wide">
            Total balance to pay
          </div>
          <div className="text-2xl font-bold text-[#0D7C66] mt-1">
            {formatPayoutCurrency(totalBalance)}
          </div>
        </div>
        <div className="flex-1 min-h-0 overflow-y-auto border border-[#D0E0DB] rounded-lg mb-4">
          {rows.length === 0 ? (
            <p className="px-4 py-8 text-center text-sm text-[#6B8782]">
              No payouts selected. Close and reopen Pay All, or cancel.
            </p>
          ) : (
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-[#F0F4F3]">
                <tr>
                  <th className="px-3 py-2 text-left text-xs font-semibold text-[#0D5C4D]">
                    {entityColumnLabel}
                  </th>
                  <th className="px-3 py-2 text-left text-xs font-semibold text-[#0D5C4D]">
                    Date
                  </th>
                  <th className="px-3 py-2 text-left text-xs font-semibold text-[#0D5C4D]">
                    Status
                  </th>
                  <th className="px-3 py-2 text-right text-xs font-semibold text-[#0D5C4D]">
                    Balance
                  </th>
                  <th className="px-2 py-2 w-10" aria-label="Remove" />
                </tr>
              </thead>
              <tbody>
                {rows.map((payout, idx) => {
                  const key = getRowKey(payout);
                  const balance = getBalanceAmount(payout);
                  const paidSoFar = Number(payout.partialPaidAmount || 0);
                  return (
                    <tr
                      key={key}
                      className={`border-t border-[#D0E0DB] ${idx % 2 === 0 ? 'bg-white' : 'bg-[#F0F4F3]/40'}`}
                    >
                      <td className="px-3 py-2 text-[#0D5C4D]">
                        <div className="font-medium">{getEntityPrimary(payout)}</div>
                        {getEntitySecondary?.(payout) && (
                          <div className="text-[11px] text-[#6B8782]">
                            {getEntitySecondary(payout)}
                          </div>
                        )}
                      </td>
                      <td className="px-3 py-2 text-[#0D5C4D] whitespace-nowrap">
                        {formatPayoutDisplayDate(getRowDate(payout))}
                      </td>
                      <td className="px-3 py-2">
                        <span
                          className={`inline-block px-2 py-0.5 rounded-full text-[11px] font-medium ${getPayoutStatusClassName(payout.status)}`}
                        >
                          {payout.status}
                        </span>
                        {paidSoFar > 0 && (
                          <div className="text-[10px] text-[#6B8782] mt-0.5">
                            Paid {formatPayoutCurrency(paidSoFar)}
                          </div>
                        )}
                      </td>
                      <td className="px-3 py-2 text-right font-semibold text-[#0D5C4D] whitespace-nowrap">
                        {formatPayoutCurrency(balance)}
                      </td>
                      <td className="px-2 py-2 text-center">
                        <button
                          type="button"
                          onClick={() => onRemove(key)}
                          disabled={loading}
                          title="Remove from this payment"
                          aria-label="Remove from pay all"
                          className="p-1 rounded-md text-gray-400 hover:text-red-600 hover:bg-red-50 disabled:opacity-50 transition-colors"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="px-4 py-2 text-sm rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={loading || rows.length === 0}
            className="px-4 py-2 text-sm rounded-lg bg-[#0D7C66] hover:bg-[#0b6a57] text-white font-medium disabled:opacity-50"
          >
            {loading ? 'Paying...' : 'Pay Now'}
          </button>
        </div>
      </div>
    </div>
  );
}
