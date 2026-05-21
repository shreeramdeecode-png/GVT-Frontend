import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import PayoutFilterBar, { PayAllConfirmModal } from '../common/PayoutFilterBar';
import PayoutPagination from '../common/PayoutPagination';
import { getAllOrders } from '../../../api/orderApi';
import { getOrderAssignment } from '../../../api/orderAssignmentApi';
import { getAllLabours } from '../../../api/labourApi';
import { getAllLabourRates } from '../../../api/labourRateApi';
import { getAllLabourExcessPay } from '../../../api/labourExcessPayApi';
import { getAllAttendance } from '../../../api/labourAttendanceApi';
import { getPaidRecords, markAsPaid, markPartialPaid, unmarkAsPaid } from '../../../api/payoutApi';
import {
  getPaidRecords as getDailyPaidRecords,
  markAsPaid as markDailyAsPaid,
  unmarkAsPaid as unmarkDailyAsPaid
} from '../../../api/dailyPayoutsApi';
import * as XLSX from 'xlsx-js-style';
import jsPDF from 'jspdf';
import { usePayoutPayAll, payoutTh, payoutTd, payoutTdNum, payoutTdCenter, payoutBtn, payoutTableWrap, payoutTableScroll, payoutTableBase, payoutThead, payoutTbody, payoutRow, payoutEmptyCell, payoutActionRow, getPayoutStatusClassName } from '../../../components/admin/common/PayoutFilterBar';
import { DEFAULT_PAYOUT_PAGE_SIZE, calcPayoutTotalPages, getPayoutPageSlice } from '../../../components/admin/common/PayoutPagination';
import 'jspdf-autotable';

const ITEMS_PER_PAGE = DEFAULT_PAYOUT_PAGE_SIZE;
const DAYS_BACK = 60;
const STORAGE_KEY_ALL = 'labour-daily-paid';

const toDateStr = (val) => {
  if (!val) return '';
  try {
    return new Date(val).toISOString().split('T')[0];
  } catch {
    return String(val).substring(0, 10);
  }
};

const LabourPayoutManagement = () => {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [selectedLabourId, setSelectedLabourId] = useState('');
  const [labourOptions, setLabourOptions] = useState([]);
  const [currentPage, setCurrentPage] = useState(1);

  const [loading, setLoading] = useState(true);
  const [payoutData, setPayoutData] = useState([]);
  const [processingKey, setProcessingKey] = useState('');
  const [partialModal, setPartialModal] = useState({ open: false, payout: null });
  const [partialAmount, setPartialAmount] = useState('');
  const [partialNote, setPartialNote] = useState('');
  const [paidKeys, setPaidKeys] = useState(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY_ALL);
      return stored ? new Set(JSON.parse(stored)) : new Set();
    } catch {
      return new Set();
    }
  });

  useEffect(() => {
    fetchLabourDailyPayouts();
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY_ALL, JSON.stringify([...paidKeys]));
    } catch {
      // ignore
    }
  }, [paidKeys]);

  const fetchLabourDailyPayouts = async () => {
    try {
      setLoading(true);

      const [ordersRes, laboursRes, ratesRes, excessRes, paidRes, dailyPaidRes] = await Promise.all([
        getAllOrders().catch(() => ({ data: [] })),
        getAllLabours(1, 1000).catch(() => ({ data: [] })),
        getAllLabourRates().catch(() => []),
        getAllLabourExcessPay().catch(() => ({ data: [] })),
        getPaidRecords('labour').catch(() => ({ data: [] })),
        getDailyPaidRecords('labour').catch(() => ({ data: [] }))
      ]);

      const orders = Array.isArray(ordersRes) ? ordersRes : (ordersRes?.data || []);
      const labours = Array.isArray(laboursRes) ? laboursRes : (laboursRes?.data || laboursRes?.labours || []);
      setLabourOptions(labours);
      const labourRates = Array.isArray(ratesRes) ? ratesRes : (ratesRes?.data || []);
      const excessPays = Array.isArray(excessRes) ? excessRes : (excessRes?.data || []);

      const labourMap = new Map(labours.map((l) => [String(l.lid), l]));
      const ratesMap = {};
      labourRates.forEach((rate) => {
        if (rate.status === 'Active' && rate.labourType) {
          ratesMap[rate.labourType] = parseFloat(rate.amount) || 0;
        }
      });

      const excessByDateAndLabour = {};
      excessPays.forEach((pay) => {
        const id = String(pay.labour_id ?? pay.labourId ?? '');
        const dateStr = toDateStr(pay.date ?? pay.pay_date);
        if (id && dateStr) {
          const key = `${dateStr}_${id}`;
          excessByDateAndLabour[key] = (excessByDateAndLabour[key] || 0) + (parseFloat(pay.amount) || 0);
        }
      });

      const rowKeyToWage = {};
      const rowKeyToLabourId = {};
      const rowKeyToLabourName = {};

      const assignmentPromises = orders.map(async (order) => {
        try {
          const assignmentRes = await getOrderAssignment(order.oid).catch(() => null);
          if (!assignmentRes?.data?.stage2_summary_data) return;

          let summary;
          try {
            summary =
              typeof assignmentRes.data.stage2_summary_data === 'string'
                ? JSON.parse(assignmentRes.data.stage2_summary_data)
                : assignmentRes.data.stage2_summary_data;
          } catch {
            return;
          }

          const orderDate = order.order_received_date || order.createdAt;
          const dateStr = toDateStr(orderDate);
          if (!dateStr) return;

          const labourPrices = summary.labourPrices || [];
          labourPrices.forEach((lp) => {
            const labourId = lp.labourId ?? lp.labour_id;
            const labourName = lp.labourName ?? lp.labour ?? '';
            if (!labourId && !labourName) return;

            const idKey = labourId ? String(labourId) : null;
            const nameKey = (labourName || '').trim().toLowerCase();
            const labour = idKey ? labourMap.get(idKey) : labours.find((l) => (l.full_name || l.name || '').trim().toLowerCase() === nameKey);
            const resolvedId = labour ? String(labour.lid) : idKey || nameKey;
            const resolvedName = labour ? labour.full_name || labour.name : labourName || resolvedId;

            const key = `${dateStr}_${resolvedId}`;
            const wage = parseFloat(lp.totalAmount ?? lp.labourWage ?? lp.amount ?? 0) || 0;
            rowKeyToWage[key] = (rowKeyToWage[key] || 0) + wage;
            rowKeyToLabourId[key] = resolvedId;
            rowKeyToLabourName[key] = resolvedName;
          });
        } catch (err) {
          console.error('Error processing order for labour daily payout:', err);
        }
      });

      await Promise.all(assignmentPromises);

      // Fetch daily-payouts paid records per labour (backend may only return when entity_id is set)
      const dailyPaidByLabour = labours.length > 0
        ? await Promise.all(
            labours.map((l) =>
              getDailyPaidRecords('labour', { entity_id: String(l.lid ?? l.id ?? '') }).catch(() => ({ data: [] }))
            )
          )
        : [dailyPaidRes];

      let dailyPaidMerged = dailyPaidRes?.data ?? dailyPaidRes?.paidRecords ?? dailyPaidRes?.records ?? (Array.isArray(dailyPaidRes) ? dailyPaidRes : []);
      dailyPaidByLabour.forEach((res) => {
        const list = res?.data ?? res?.paidRecords ?? res?.records ?? (Array.isArray(res) ? res : []);
        dailyPaidMerged = dailyPaidMerged.concat(list);
      });

      // Add rows for all dates where labours were present (so we show all dates, not only order dates)
      const end = new Date();
      const start = new Date(end);
      start.setDate(start.getDate() - DAYS_BACK);
      const datesToFetch = [];
      for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
        datesToFetch.push(toDateStr(d));
      }
      const overviews = await Promise.all(
        datesToFetch.map((dateStr) =>
          getAllAttendance({ date: dateStr, status: 'Present' }).catch(() => ({ data: { labours: [] } }))
        )
      );
      overviews.forEach((res, i) => {
        const dateStr = datesToFetch[i];
        if (!dateStr) return;
        const list = res?.data?.labours ?? res?.data ?? [];
        const labourList = Array.isArray(list) ? list : [];
        labourList.forEach((l) => {
          const lid = String(l.lid ?? l.labour_id ?? l.id ?? '');
          if (!lid) return;
          const key = `${dateStr}_${lid}`;
          if (rowKeyToWage[key] != null) return;
          const labour = labourMap.get(lid);
          rowKeyToWage[key] = 0;
          rowKeyToLabourId[key] = lid;
          rowKeyToLabourName[key] = labour ? (labour.full_name || labour.name || '') : (l.full_name || l.name || lid);
        });
      });

      let paidSet = new Set();
      try {
        const paidList = paidRes?.data ?? paidRes?.paidRecords ?? paidRes?.records ?? (Array.isArray(paidRes) ? paidRes : []);
        paidList.forEach((item) => {
          const k = item?.reference_key ?? item?.key ?? (item?.date && item?.entity_id ? `${item.date}_${item.entity_id}` : (typeof item === 'string' ? item : null));
          if (k) paidSet.add(k);
        });
        const dailyPaidList = dailyPaidMerged;
        dailyPaidList.forEach((item) => {
          const k = item?.reference_key ?? item?.key ?? (item?.date && item?.entity_id ? `${item.date}_${item.entity_id}` : (typeof item === 'string' ? item : null));
          if (k) paidSet.add(k);
        });
        const stored = localStorage.getItem(STORAGE_KEY_ALL);
        if (stored) JSON.parse(stored).forEach((k) => paidSet.add(k));
      } catch {
        // ignore
      }

      const paidMap = new Map();
      try {
        const paidList = paidRes?.data ?? paidRes?.paidRecords ?? paidRes?.records ?? (Array.isArray(paidRes) ? paidRes : []);
        paidList.forEach((item) => {
          const k = item?.reference_key ?? item?.key ?? (item?.date && item?.entity_id ? `${item.date}_${item.entity_id}` : null);
          if (k) paidMap.set(k, item);
        });
      } catch {
        // ignore
      }

      let rows = Object.entries(rowKeyToWage).map(([key]) => {
        const labourId = rowKeyToLabourId[key] || '';
        const labourName = rowKeyToLabourName[key] || labourId;
        const labour = labourMap.get(labourId);
        const workType = (labour?.work_type || 'Normal').trim();
        const workload = workType === 'Heavy' ? 'Heavy' : workType === 'Light' ? 'Light' : 'Normal';
        const dailyWage = (ratesMap[workType] ?? ratesMap['Normal'] ?? parseFloat(labour?.daily_wage)) || 0;
        const paymentRecord = paidMap.get(key);
        const paymentStatus = String(paymentRecord?.payment_status || '').toLowerCase();
        const partialPaidAmount = parseFloat(
          paymentRecord?.row_data?.partialPaidAmount ??
          paymentRecord?.row_data?.partial_amount ??
          paymentRecord?.partial_amount ??
          0
        ) || 0;
        const status = paymentStatus === 'partial' ? 'Partial' : (paidSet.has(key) ? 'Paid' : 'Pending');
        const [date] = key.split('_');
        const excess = excessByDateAndLabour[key] ?? 0;
        return {
          key,
          date,
          labourId,
          labourName,
          workload,
          dailyWage,
          excessPay: excess,
          totalPayout: dailyWage + excess,
          status,
          partialPaidAmount
        };
      });

      rows.sort((a, b) => (b.date > a.date ? 1 : b.date < a.date ? -1 : 0));

      setPayoutData(rows);
      setCurrentPage(1);
    } catch (error) {
      console.error('Error fetching labour daily payouts:', error);
      setPayoutData([]);
    } finally {
      setLoading(false);
    }
  };

  const handlePay = async (payout) => {
    const key = payout.key;
    try {
      setProcessingKey(key);
      const rowData = {
        key: payout.key,
        entity_id: payout.labourId,
        date: payout.date,
        labourId: payout.labourId,
        labourName: payout.labourName,
        workload: payout.workload,
        dailyWage: payout.dailyWage,
        excessPay: payout.excessPay,
        totalPayout: payout.totalPayout,
        amount: Number(payout.totalPayout) || 0,
        status: 'Paid',
        ...payout
      };
      await markAsPaid('labour', rowData);
      await markDailyAsPaid('labour', rowData).catch(() => {});
      setPaidKeys((prev) => new Set([...prev, key]));
      setPayoutData((prev) => prev.map((p) => (p.key === key ? { ...p, status: 'Paid' } : p)));
      const [, lid] = key.split('_');
      if (lid) {
        try {
          const sk = `labour-daily-paid-${lid}`;
          const stored = localStorage.getItem(sk);
          const set = new Set(stored ? JSON.parse(stored) : []);
          set.add(key);
          localStorage.setItem(sk, JSON.stringify([...set]));
        } catch {
          // ignore
        }
      }
      try {
        const stored = localStorage.getItem(STORAGE_KEY_ALL);
        const list = stored ? JSON.parse(stored) : [];
        if (!list.includes(key)) list.push(key);
        localStorage.setItem(STORAGE_KEY_ALL, JSON.stringify(list));
      } catch {
        // ignore
      }
    } catch (error) {
      console.error('Error marking labour payout as paid:', error);
      alert(error?.message || error?.error || 'Failed to mark as paid');
    } finally {
      setProcessingKey('');
    }
  };

  const handleRevert = async (payout) => {
    const key = payout.key;
    try {
      setProcessingKey(key);
      const rowData = {
        key: payout.key,
        id: payout.key,
        reference_key: payout.key,
        entity_id: payout.labourId,
        date: payout.date
      };
      await unmarkAsPaid('labour', rowData);
      await unmarkDailyAsPaid('labour', rowData).catch(() => {});

      setPaidKeys((prev) => {
        const next = new Set(prev);
        next.delete(key);
        return next;
      });
      setPayoutData((prev) => prev.map((p) => (p.key === key ? { ...p, status: 'Pending' } : p)));

      try {
        const [, lid] = key.split('_');
        if (lid) {
          const sk = `labour-daily-paid-${lid}`;
          const stored = localStorage.getItem(sk);
          const list = stored ? JSON.parse(stored) : [];
          localStorage.setItem(sk, JSON.stringify(list.filter((k) => k !== key)));
        }
      } catch {
        // ignore
      }

      try {
        const stored = localStorage.getItem(STORAGE_KEY_ALL);
        const list = stored ? JSON.parse(stored) : [];
        localStorage.setItem(STORAGE_KEY_ALL, JSON.stringify(list.filter((k) => k !== key)));
      } catch {
        // ignore
      }
    } catch (error) {
      console.error('Error reverting labour payout:', error);
      alert(error?.message || error?.error || 'Failed to revert paid status');
    } finally {
      setProcessingKey('');
    }
  };

  const filteredPayouts = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    return payoutData.filter((p) => {
      // date range filter (dates are in YYYY-MM-DD format so string compare works)
      if (fromDate && (p.date || '') < fromDate) return false;
      if (toDate && (p.date || '') > toDate) return false;
      // labour filter
      if (selectedLabourId && String(p.labourId) !== selectedLabourId) return false;
      // search by name or date
      if (!query) return true;
      return (
        (p.labourName || '').toLowerCase().includes(query) ||
        (p.date || '').toLowerCase().includes(query)
      );
    });
  }, [payoutData, searchQuery, fromDate, toDate, selectedLabourId]);

  const {
    payAllModalOpen,
    payAllSelected,
    payAllTargets,
    openPayAllModal,
    closePayAllModal,
    removeFromPayAll,
    getBalanceAmount,
    resolveKey,
  } = usePayoutPayAll(filteredPayouts, { totalField: 'totalPayout' });

  const totalPages = calcPayoutTotalPages(filteredPayouts.length, ITEMS_PER_PAGE);
  const paginatedPayouts = getPayoutPageSlice(filteredPayouts, currentPage, ITEMS_PER_PAGE);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, fromDate, toDate, selectedLabourId]);

  const summaryStats = useMemo(() => {
    const totalPayouts = payoutData.length;
    const totalAmount = payoutData.reduce((sum, p) => sum + p.totalPayout, 0);
    const averageDailyWage =
      payoutData.length > 0
        ? payoutData.reduce((sum, p) => sum + p.dailyWage, 0) / payoutData.length
        : 0;
    const uniqueLabourIds = new Set(payoutData.map((p) => p.labourId)).size;
    return {
      totalPayouts,
      averageDailyWage,
      paidThisPeriod: totalAmount,
      activeLabour: uniqueLabourIds
    };
  }, [payoutData]);

  const stats = [
    { label: 'Total Payouts', value: summaryStats.totalPayouts.toString(), change: '' },
    { label: 'Average Daily Wage', value: `₹${Number(summaryStats.averageDailyWage).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`, change: '' },
    { label: 'Total Wages (This Period)', value: `₹${summaryStats.paidThisPeriod.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`, change: '' },
    { label: 'Total Active Labour', value: summaryStats.activeLabour.toString(), change: '' }
  ];

  const getWorkloadColor = (workload) => {
    if (workload === 'Light') return 'bg-blue-100 text-blue-700';
    if (workload === 'Normal') return 'bg-green-100 text-green-700';
    return 'bg-orange-100 text-orange-700';
  };

  const formatNum = (n) =>
    Number.isFinite(n) ? n.toLocaleString('en-IN', { maximumFractionDigits: 0 }) : '0';

  // Total pending should respect current filters (date range, labour, search)
  const totalPending = filteredPayouts
    .filter((p) => p.status !== 'Paid')
    .reduce((sum, p) => sum + p.totalPayout, 0);

  const openPartialPaymentModal = (payout) => {
    setPartialAmount('');
    setPartialNote('');
    setPartialModal({ open: true, payout });
  };

  const closePartialPaymentModal = () => {
    setPartialModal({ open: false, payout: null });
    setPartialAmount('');
    setPartialNote('');
  };

  const handlePartialPay = async () => {
    if (!partialModal.payout) return;
    const payout = partialModal.payout;
    const entered = Number(partialAmount);
    const alreadyPaid = Number(payout.partialPaidAmount || 0);
    const total = Number(payout.totalPayout || 0);
    if (!Number.isFinite(entered) || entered <= 0) return alert('Enter a valid partial amount');
    const cumulative = alreadyPaid + entered;
    if (total > 0 && cumulative >= total) return alert('Total partial paid must be less than total payout');
    try {
      setProcessingKey(payout.key);
      await markPartialPaid('labour', {
        key: payout.key,
        id: payout.key,
        entity_id: payout.labourId,
        date: payout.date,
        amount: total,
        partial_amount: entered,
        partial_paid_total: cumulative,
        note: partialNote
      });
      setPayoutData((prev) =>
        prev.map((p) =>
          p.key === payout.key
            ? { ...p, status: 'Partial', partialPaidAmount: cumulative }
            : p
        )
      );
      closePartialPaymentModal();
    } catch (error) {
      alert(error?.message || error?.error || 'Failed to save partial payment');
    } finally {
      setProcessingKey('');
    }
  };

  const confirmPayAll = async () => {
    const pending = payAllSelected;
    if (pending.length === 0) return;
    try {
      setProcessingKey('pay-all');
      for (const payout of pending) {
        const rowData = {
          key: payout.key,
          entity_id: payout.labourId,
          date: payout.date,
          labourId: payout.labourId,
          labourName: payout.labourName,
          workload: payout.workload,
          dailyWage: payout.dailyWage,
          excessPay: payout.excessPay,
          totalPayout: payout.totalPayout,
          amount: Number(payout.totalPayout) || 0,
          status: 'Paid',
          ...payout
        };
        await markAsPaid('labour', rowData);
        await markDailyAsPaid('labour', rowData).catch(() => {});
      }
      setPayoutData((prev) => prev.map((p) => (pending.some((x) => x.key === p.key) ? { ...p, status: 'Paid', partialPaidAmount: 0 } : p)));
      closePayAllModal(false);
    } catch (error) {
      alert(error?.message || error?.error || 'Failed to pay all');
    } finally {
      setProcessingKey('');
    }
  };

  const handleExportExcel = () => {
    if (filteredPayouts.length === 0) {
      alert('No payout data to export.');
      return;
    }

    const data = filteredPayouts.map((p) => ({
      Date: new Date(p.date + 'T12:00:00').toLocaleDateString('en-GB'),
      'Labour Name': p.labourName,
      Workload: p.workload,
      'Daily Wage': p.dailyWage,
      'Excess Pay': p.excessPay,
      'Total Payout': p.totalPayout,
      Status: p.status
    }));

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(data);
    XLSX.utils.book_append_sheet(wb, ws, 'Labour Payouts');

    const fileName = `Labour_Payouts_${new Date().toISOString().split('T')[0]}.xlsx`;
    XLSX.writeFile(wb, fileName, { bookType: 'xlsx', cellStyles: true });
  };

  const handleExportPDF = () => {
    if (filteredPayouts.length === 0) {
      alert('No payout data to export.');
      return;
    }

    const doc = new jsPDF('p', 'pt', 'a4');

    // Header
    doc.setFillColor(13, 92, 77);
    doc.rect(0, 0, 595, 50, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(18);
    doc.setFont(undefined, 'bold');
    doc.text('Labour Payouts', 297.5, 30, { align: 'center' });

    // Subheader
    doc.setFontSize(10);
    doc.setFont(undefined, 'normal');
    doc.setTextColor(255, 255, 255);
    let subtitle = `Generated on: ${new Date().toLocaleDateString('en-GB')}`;
    if (fromDate) subtitle += ` | From: ${fromDate}`;
    if (toDate) subtitle += ` | To: ${toDate}`;
    if (selectedLabourId) {
      const lab = labourOptions.find((l) => String(l.lid) === selectedLabourId);
      if (lab) subtitle += ` | Labour: ${lab.full_name || lab.name}`;
    }
    doc.text(subtitle, 297.5, 42, { align: 'center' });

    // Use "Rs." instead of ₹ so jsPDF renders numbers correctly (default font often mangles Unicode ₹)
    const tableBody = filteredPayouts.map((p) => [
      new Date(p.date + 'T12:00:00').toLocaleDateString('en-GB'),
      p.labourName,
      p.workload,
      `Rs. ${formatNum(p.dailyWage)}`,
      `Rs. ${formatNum(p.excessPay)}`,
      `Rs. ${formatNum(p.totalPayout)}`,
      p.status
    ]);

    const tableHeaders = [['Date', 'Labour', 'Workload', 'Daily Wage', 'Excess Pay', 'Total Payout', 'Status']];

    doc.autoTable({
      startY: 60,
      head: tableHeaders,
      body: tableBody,
      theme: 'grid',
      headStyles: { fillColor: [13, 92, 77], textColor: 255, fontStyle: 'bold', halign: 'center' },
      bodyStyles: { fontSize: 9, halign: 'center' },
      alternateRowStyles: { fillColor: [240, 253, 244] },
      columnStyles: {
        0: { halign: 'center' },
        1: { halign: 'left' },
        3: { halign: 'right' },
        4: { halign: 'right' },
        5: { halign: 'right' }
      }
    });

    doc.save(`Labour_Payouts_${new Date().toISOString().split('T')[0]}.pdf`);
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      {/* Tabs */}
      <div className="flex flex-wrap gap-2 mb-6">
        <button
          onClick={() => navigate('/payouts')}
          className="px-5 py-2.5 rounded-lg font-medium transition-all text-sm bg-white text-gray-600 hover:bg-gray-50 border border-gray-200"
        >
          Farmer Payout
        </button>
        <button
          onClick={() => navigate('/payout-supplier')}
          className="px-5 py-2.5 rounded-lg font-medium transition-all text-sm bg-white text-gray-600 hover:bg-gray-50 border border-gray-200"
        >
          Supplier Payout
        </button>
        <button
          onClick={() => navigate('/payout-thirdparty')}
          className="px-5 py-2.5 rounded-lg font-medium transition-all text-sm bg-white text-gray-600 hover:bg-gray-50 border border-gray-200"
        >
          Third Party Payout
        </button>
        <button
          className="px-5 py-2.5 rounded-lg font-medium transition-all text-sm bg-[#0D7C66] text-white shadow-md"
        >
          Labour Payout
        </button>
        <button
          onClick={() => navigate('/payout-driver')}
          className="px-5 py-2.5 rounded-lg font-medium transition-all text-sm bg-white text-gray-600 hover:bg-gray-50 border border-gray-200"
        >
          Driver Payout
        </button>
      </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        {stats.map((stat, index) => (
          <div
            key={index}
            className={`${
              index === 0 ? 'bg-gradient-to-r from-[#D1FAE5] to-[#A7F3D0]' :
              index === 1 ? 'bg-gradient-to-r from-[#6EE7B7] to-[#34D399]' :
              index === 2 ? 'bg-gradient-to-r from-[#10B981] to-[#059669]' :
              'bg-gradient-to-r from-[#047857] to-[#065F46]'
            } rounded-2xl p-6 ${
              index === 2 || index === 3 ? 'text-white' : 'text-[#0D5C4D]'
            }`}
          >
            <div className="text-sm font-medium mb-2 opacity-90">{stat.label}</div>
            <div className="text-4xl font-bold mb-2">{stat.value}</div>
            <div className={`inline-block px-3 py-1 rounded-full text-xs font-medium ${
              index === 2 || index === 3 ? 'bg-white/20 text-white' : 'bg-white/60 text-[#0D5C4D]'
            }`}>
              {stat.change}
            </div>
          </div>
        ))}
      </div>

      <PayoutFilterBar
        idPrefix="labour-payout"
        searchValue={searchQuery}
        onSearchChange={setSearchQuery}
        searchPlaceholder="Labour name or date..."
        fromDate={fromDate}
        onFromDateChange={setFromDate}
        toDate={toDate}
        onToDateChange={setToDate}
        entityFilter={{
          label: 'Labour',
          value: selectedLabourId,
          onChange: setSelectedLabourId,
          options: [
            { value: '', label: 'All labours' },
            ...labourOptions.map((l) => ({
              value: String(l.lid),
              label: l.full_name || l.name || `Labour ${l.lid}`,
            })),
          ],
        }}
        onClear={() => {
          setFromDate('');
          setToDate('');
          setSelectedLabourId('');
          setSearchQuery('');
        }}
        onPayAll={openPayAllModal}
        payAllDisabled={payAllTargets.length === 0}
        payAllLoading={processingKey === 'pay-all'}
        onExportPDF={handleExportPDF}
        onExportExcel={handleExportExcel}
      />

      {/* Labour Daily Payouts Table - same format as Labour Daily Payout page, for all labours */}
      <div className={payoutTableWrap}>
        <div className={payoutTableScroll}>
          <table className={`${payoutTableBase} min-w-[1050px]`}>
            <colgroup>
              <col style={{ width: '10%' }} />
              <col style={{ width: '18%' }} />
              <col style={{ width: '10%' }} />
              <col style={{ width: '12%' }} />
              <col style={{ width: '12%' }} />
              <col style={{ width: '12%' }} />
              <col style={{ width: '12%' }} />
              <col style={{ width: '14%' }} />
            </colgroup>
            <thead className={payoutThead}>
              <tr>
                <th className={`${payoutTh} text-left`}>Date</th>
                <th className={`${payoutTh} text-left`}>Labour Name</th>
                <th className={`${payoutTh} text-center`}>Workload</th>
                <th className={`${payoutTh} text-right`}>Daily Wage</th>
                <th className={`${payoutTh} text-right`}>Excess Pay</th>
                <th className={`${payoutTh} text-right`}>Total Payout</th>
                <th className={`${payoutTh} text-center`}>Status</th>
                <th className={`${payoutTh} text-center`}>Action</th>
              </tr>
            </thead>
            <tbody className={payoutTbody}>
              {loading ? (
                <tr><td colSpan={8} className={payoutEmptyCell}>Loading labour payouts...</td></tr>
              ) : paginatedPayouts.length === 0 ? (
                <tr><td colSpan={8} className={payoutEmptyCell}>No labour payouts found</td></tr>
              ) : (
                paginatedPayouts.map((payout, index) => (
                  <tr key={payout.key} className={payoutRow(index)}>
                    <td className={`${payoutTd} whitespace-nowrap font-semibold`}>
                      {new Date(payout.date + 'T12:00:00').toLocaleDateString('en-GB')}
                    </td>
                    <td className={`${payoutTd} font-medium`}>{payout.labourName}</td>
                    <td className={payoutTdCenter}>
                      <span className={`inline-flex px-2.5 py-1 rounded-full text-xs font-semibold ${getWorkloadColor(payout.workload)}`}>
                        {payout.workload}
                      </span>
                    </td>
                    <td className={payoutTdNum}>₹{formatNum(payout.dailyWage)}</td>
                    <td className={`${payoutTdNum} text-green-600`}>+₹{formatNum(payout.excessPay)}</td>
                    <td className={`${payoutTdNum} font-bold`}>₹{formatNum(payout.totalPayout)}</td>
                    <td className={payoutTdCenter}>
                      <span className={`inline-flex px-2.5 py-1 rounded-full text-xs font-semibold ${getPayoutStatusClassName(payout.status)}`}>{payout.status}</span>
                      {payout.status === 'Partial' && (
                        <div className="mt-1 text-[10px] text-[#6B8782] leading-tight">
                          Paid ₹{formatNum(payout.partialPaidAmount || 0)}<br />Bal ₹{formatNum(getBalanceAmount(payout))}
                        </div>
                      )}
                    </td>
                    <td className={`${payoutTdCenter} whitespace-nowrap`}>
                      <div className={payoutActionRow}>
                        {payout.status === 'Paid' ? (
                          <button type="button" onClick={() => handleRevert(payout)} disabled={processingKey === payout.key} className={payoutBtn.revert}>
                            {processingKey === payout.key ? '…' : 'Revert'}
                          </button>
                        ) : (
                          <>
                            <button type="button" onClick={() => openPartialPaymentModal(payout)} disabled={processingKey === payout.key} className={payoutBtn.partial}>Partial</button>
                            <button type="button" onClick={() => handlePay(payout)} disabled={processingKey === payout.key} className={payoutBtn.pay}>
                              {processingKey === payout.key ? '…' : payout.status === 'Partial' ? `Pay Bal ₹${formatNum(getBalanceAmount(payout))}` : 'Pay'}
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <PayoutPagination
          currentPage={currentPage}
          totalPages={totalPages}
          totalItems={filteredPayouts.length}
          itemsPerPage={ITEMS_PER_PAGE}
          onPageChange={setCurrentPage}
          onClampPage={setCurrentPage}
          itemLabel="payouts"
        >
          <span className="font-semibold text-[#0D5C4D]">
            Total Pending: <span className="text-[#0D7C66]">₹{formatNum(totalPending)}</span>
          </span>
        </PayoutPagination>
      </div>
      <PayAllConfirmModal
        open={payAllModalOpen}
        fromDate={fromDate}
        toDate={toDate}
        rows={payAllSelected}
        entityColumnLabel="Labour"
        getEntityPrimary={(p) => p.labourName}
        getRowDate={(p) => p.date}
        getRowKey={resolveKey}
        getBalanceAmount={getBalanceAmount}
        onRemove={removeFromPayAll}
        onClose={() => closePayAllModal(processingKey === 'pay-all')}
        onConfirm={confirmPayAll}
        loading={processingKey === 'pay-all'}
      />
      {partialModal.open && partialModal.payout && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
          <div className="w-full max-w-md bg-white rounded-xl shadow-xl p-5">
            <h3 className="text-lg font-semibold text-[#0D5C4D] mb-1">Partial Payment</h3>
            <p className="text-sm text-[#6B8782] mb-4">
              {partialModal.payout.labourName} — Total ₹{formatNum(partialModal.payout.totalPayout)}
            </p>
            {Number(partialModal.payout.partialPaidAmount || 0) > 0 && (
              <p className="text-xs text-[#0D5C4D] mb-3">
                Paid: ₹{formatNum(partialModal.payout.partialPaidAmount || 0)} | Balance: ₹{formatNum(getBalanceAmount(partialModal.payout))}
              </p>
            )}
            <div className="space-y-3">
              <input type="number" min="0" step="0.01" value={partialAmount} onChange={(e) => setPartialAmount(e.target.value)} placeholder="Partial amount" className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
              <textarea value={partialNote} onChange={(e) => setPartialNote(e.target.value)} placeholder="Note (optional)" className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm min-h-[84px]" />
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <button type="button" onClick={closePartialPaymentModal} className="px-4 py-2 border rounded-lg text-sm">Cancel</button>
              <button type="button" onClick={handlePartialPay} disabled={processingKey === partialModal.payout.key} className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm disabled:opacity-50">
                {processingKey === partialModal.payout.key ? 'Saving...' : 'Save Partial'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default LabourPayoutManagement;