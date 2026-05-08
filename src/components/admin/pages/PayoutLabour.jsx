import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Filter, Download } from 'lucide-react';
import { getAllOrders } from '../../../api/orderApi';
import { getOrderAssignment } from '../../../api/orderAssignmentApi';
import { getAllLabours } from '../../../api/labourApi';
import { getAllLabourRates } from '../../../api/labourRateApi';
import { getAllLabourExcessPay } from '../../../api/labourExcessPayApi';
import { getAllAttendance } from '../../../api/labourAttendanceApi';
import { getPaidRecords, markAsPaid, unmarkAsPaid } from '../../../api/payoutApi';
import {
  getPaidRecords as getDailyPaidRecords,
  markAsPaid as markDailyAsPaid,
  unmarkAsPaid as unmarkDailyAsPaid
} from '../../../api/dailyPayoutsApi';
import * as XLSX from 'xlsx-js-style';
import jsPDF from 'jspdf';
import 'jspdf-autotable';

const ITEMS_PER_PAGE = 7;
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

      let rows = Object.entries(rowKeyToWage).map(([key]) => {
        const labourId = rowKeyToLabourId[key] || '';
        const labourName = rowKeyToLabourName[key] || labourId;
        const labour = labourMap.get(labourId);
        const workType = (labour?.work_type || 'Normal').trim();
        const workload = workType === 'Heavy' ? 'Heavy' : workType === 'Light' ? 'Light' : 'Normal';
        const dailyWage = (ratesMap[workType] ?? ratesMap['Normal'] ?? parseFloat(labour?.daily_wage)) || 0;
        const status = paidSet.has(key) ? 'Paid' : 'Pending';
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
          status
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

  const totalPages = Math.max(1, Math.ceil(filteredPayouts.length / ITEMS_PER_PAGE));
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const paginatedPayouts = filteredPayouts.slice(startIndex, startIndex + ITEMS_PER_PAGE);

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

  const getStatusColor = (status) =>
    status === 'Paid' ? 'bg-emerald-100 text-emerald-700' : 'bg-yellow-100 text-yellow-700';

  const getWorkloadColor = (workload) => {
    if (workload === 'Light') return 'bg-blue-100 text-blue-700';
    if (workload === 'Normal') return 'bg-green-100 text-green-700';
    return 'bg-orange-100 text-orange-700';
  };

  const formatNum = (n) =>
    Number.isFinite(n) ? n.toLocaleString('en-IN', { maximumFractionDigits: 0 }) : '0';

  // Total pending should respect current filters (date range, labour, search)
  const totalPending = filteredPayouts
    .filter((p) => p.status === 'Pending')
    .reduce((sum, p) => sum + p.totalPayout, 0);

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

      {/* Search and Controls */}
      <div className="bg-white rounded-xl shadow-sm border border-[#D0E0DB] p-4 mb-6">
        <div className="flex flex-col lg:flex-row items-stretch lg:items-center gap-3">
          {/* Search */}
          <div className="flex-1 relative">
            <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="Search by labour name or date..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-12 pr-4 py-3 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent text-sm bg-gray-50"
            />
          </div>

          {/* Date range filters */}
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="flex flex-col">
              <label className="text-xs font-medium text-[#6B8782] mb-1">From date</label>
              <input
                type="date"
                value={fromDate}
                onChange={(e) => setFromDate(e.target.value)}
                className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent bg-gray-50"
              />
            </div>
            <div className="flex flex-col">
              <label className="text-xs font-medium text-[#6B8782] mb-1">To date</label>
              <input
                type="date"
                value={toDate}
                onChange={(e) => setToDate(e.target.value)}
                className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent bg-gray-50"
              />
            </div>
          </div>

          {/* Labour dropdown */}
          <div className="flex flex-col min-w-[180px]">
            <label className="text-xs font-medium text-[#6B8782] mb-1">Labour</label>
            <div className="relative">
              <select
                value={selectedLabourId}
                onChange={(e) => setSelectedLabourId(e.target.value)}
                className="w-full appearance-none px-3 py-2 border border-gray-200 rounded-lg text-sm bg-gray-50 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent pr-8"
              >
                <option value="">All labours</option>
                {labourOptions.map((l) => (
                  <option key={l.lid} value={String(l.lid)}>
                    {l.full_name || l.name}
                  </option>
                ))}
              </select>
              <Filter className="w-4 h-4 text-gray-400 absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>
          </div>

          {/* Clear + Export */}
          <div className="flex items-stretch sm:items-center gap-3">
            <button
              type="button"
              onClick={() => {
                setFromDate('');
                setToDate('');
                setSelectedLabourId('');
              }}
              className="px-4 py-2 border border-gray-300 rounded-lg font-medium transition-colors flex items-center justify-center gap-2 hover:bg-gray-50 text-gray-700 text-sm"
            >
              Clear filters
            </button>
            <button
              type="button"
              onClick={handleExportPDF}
              className="px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg font-medium transition-colors flex items-center justify-center gap-2 shadow-sm text-sm"
            >
              Export PDF
            </button>
            <button
              type="button"
              onClick={handleExportExcel}
              className="px-6 py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-medium transition-colors flex items-center justify-center gap-2 shadow-sm text-sm"
            >
              <Download className="w-4 h-4" />
              Export Excel
            </button>
          </div>
        </div>
      </div>

      {/* Labour Daily Payouts Table - same format as Labour Daily Payout page, for all labours */}
      <div className="bg-white rounded-2xl overflow-hidden border border-[#D0E0DB]">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-[#D4F4E8]">
                <th className="px-6 py-4 text-left text-sm font-semibold text-[#0D5C4D]">Date</th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-[#0D5C4D]">Labour Name</th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-[#0D5C4D]">Workload</th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-[#0D5C4D]">Daily Wage</th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-[#0D5C4D]">Excess Pay</th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-[#0D5C4D]">Total Payout</th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-[#0D5C4D]">Status</th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-[#0D5C4D]">Action</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan="8" className="px-6 py-8 text-center text-[#6B8782]">
                    Loading labour payouts...
                  </td>
                </tr>
              ) : paginatedPayouts.length === 0 ? (
                <tr>
                  <td colSpan="8" className="px-6 py-8 text-center text-[#6B8782]">
                    No labour payouts found
                  </td>
                </tr>
              ) : (
                paginatedPayouts.map((payout, index) => (
                  <tr
                    key={payout.key}
                    className={`border-b border-[#D0E0DB] hover:bg-[#F0F4F3] transition-colors ${
                      index % 2 === 0 ? 'bg-white' : 'bg-[#F0F4F3]/30'
                    }`}
                  >
                    <td className="px-6 py-4">
                      <div className="font-semibold text-[#0D5C4D] text-sm">
                        {new Date(payout.date + 'T12:00:00').toLocaleDateString('en-GB')}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="font-medium text-[#0D5C4D] text-sm">{payout.labourName}</div>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`px-3 py-1.5 rounded-full text-xs font-medium ${getWorkloadColor(payout.workload)}`}>
                        {payout.workload}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="font-medium text-[#0D5C4D] text-sm">₹{formatNum(payout.dailyWage)}</div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="font-medium text-green-600 text-sm">+₹{formatNum(payout.excessPay)}</div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="font-bold text-[#0D5C4D] text-sm">₹{formatNum(payout.totalPayout)}</div>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`px-3 py-1.5 rounded-full text-xs font-medium ${getStatusColor(payout.status)}`}>
                        {payout.status}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      {payout.status === 'Pending' ? (
                        <button
                          onClick={() => payout.status === 'Pending' ? handlePay(payout) : undefined}
                          disabled={processingKey === payout.key}
                          className="px-4 py-2 bg-teal-600 text-white rounded-lg text-xs font-medium hover:bg-teal-700 transition-colors disabled:opacity-50"
                        >
                          {processingKey === payout.key ? 'Saving...' : 'Pay'}
                        </button>
                      ) : (
                        <button
                          onClick={() => handleRevert(payout)}
                          disabled={processingKey === payout.key}
                          className="px-4 py-2 bg-amber-500 text-white rounded-lg text-xs font-medium hover:bg-amber-600 transition-colors disabled:opacity-50"
                        >
                          {processingKey === payout.key ? 'Saving...' : 'Revert'}
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-4 px-6 py-4 bg-[#F0F4F3] border-t border-[#D0E0DB]">
          <div className="text-sm text-[#6B8782]">
            Showing {filteredPayouts.length === 0 ? 0 : startIndex + 1}–{Math.min(startIndex + ITEMS_PER_PAGE, filteredPayouts.length)} of {filteredPayouts.length} payouts
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage <= 1}
              className="px-3 py-1.5 rounded-lg text-sm font-medium text-[#0D5C4D] bg-white border border-[#D0E0DB] hover:bg-[#D4F4E8] disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Previous
            </button>
            <span className="text-sm text-[#6B8782] px-2">
              Page {currentPage} of {totalPages}
            </span>
            <button
              type="button"
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage >= totalPages}
              className="px-3 py-1.5 rounded-lg text-sm font-medium text-[#0D5C4D] bg-white border border-[#D0E0DB] hover:bg-[#D4F4E8] disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Next
            </button>
          </div>
          <div className="text-sm font-semibold text-[#0D5C4D]">
            Total Pending: <span className="text-[#0D7C66]">₹{formatNum(totalPending)}</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LabourPayoutManagement;