import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { getAllOrders } from '../../../api/orderApi';
import { getOrderAssignment } from '../../../api/orderAssignmentApi';
import { getAllLabours } from '../../../api/labourApi';
import { getAllLabourRates } from '../../../api/labourRateApi';
import { getAllLabourExcessPay } from '../../../api/labourExcessPayApi';
import { getAllAttendance, getAttendanceByLabourId } from '../../../api/labourAttendanceApi';
import { getPaidRecords, markAsPaid } from '../../../api/dailyPayoutsApi';
import PayoutPagination from '../common/PayoutPagination';

import { payoutTh, payoutTd, payoutTdNum, payoutTdCenter, payoutBtn, payoutTableWrap, payoutTableScroll, payoutTableBase, payoutThead, payoutTbody, payoutRow, payoutEmptyCell, payoutActionRow, getPayoutStatusClassName } from '../../../components/admin/common/PayoutFilterBar';
import { DEFAULT_PAYOUT_PAGE_SIZE, calcPayoutTotalPages, getPayoutPageSlice } from '../../../components/admin/common/PayoutPagination';
const ITEMS_PER_PAGE = DEFAULT_PAYOUT_PAGE_SIZE;

const toDateStr = (val) => {
  if (!val) return '';
  try {
    return new Date(val).toISOString().split('T')[0];
  } catch {
    return String(val).substring(0, 10);
  }
};

const getStorageKey = (labourId) => (labourId ? `labour-daily-paid-${labourId}` : 'labour-daily-paid');

const LabourDailyPayout = () => {
  const navigate = useNavigate();
  const { id: labourIdParam } = useParams();
  const labourId = labourIdParam ? String(labourIdParam) : '';

  const [loading, setLoading] = useState(true);
  const [labourName, setLabourName] = useState('');
  const [payoutData, setPayoutData] = useState([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [, setPaidKeys] = useState(new Set());
  const [markingPaid, setMarkingPaid] = useState(false);

  useEffect(() => {
    fetchLabourDailyPayouts();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- fetch when labourId is set
  }, [labourId]);

  const fetchLabourDailyPayouts = async () => {
    try {
      setLoading(true);

      const [ordersRes, laboursRes, ratesRes, excessRes, attendanceForLabourRes, paidRes] = await Promise.all([
        getAllOrders().catch(() => ({ data: [] })),
        getAllLabours(1, 1000).catch(() => ({ data: [] })),
        getAllLabourRates().catch(() => []),
        getAllLabourExcessPay().catch(() => ({ data: [] })),
        labourId ? getAttendanceByLabourId(labourId).catch(() => null) : Promise.resolve(null),
        labourId ? getPaidRecords('labour', { entity_id: labourId }).catch(() => ({ data: [] })) : Promise.resolve({ data: [] })
      ]);

      const orders = Array.isArray(ordersRes) ? ordersRes : (ordersRes?.data || []);
      const labours = Array.isArray(laboursRes) ? laboursRes : (laboursRes?.data || laboursRes?.labours || []);
      const labourRates = Array.isArray(ratesRes) ? ratesRes : (ratesRes?.data || []);
      const excessPays = Array.isArray(excessRes) ? excessRes : (excessRes?.data || []);

      const labourMap = new Map(labours.map((l) => [String(l.lid), l]));
      const ratesMap = {};
      labourRates.forEach((rate) => {
        if (rate.status === 'Active' && rate.labourType) {
          ratesMap[rate.labourType] = parseFloat(rate.amount) || 0;
        }
      });
      // Excess pay is per labour AND per date – key by date_labourId so we only show it on the matching day
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

      const presentDatesSet = new Set();
      if (labourId) {
        const list = Array.isArray(attendanceForLabourRes?.data) ? attendanceForLabourRes.data : (attendanceForLabourRes?.records || []);
        list.forEach((rec) => {
          const status = (rec.status ?? rec.attendance_status ?? rec.attendanceStatus ?? '').toString().toLowerCase();
          const dateStr = toDateStr(rec.date ?? rec.attendance_date ?? rec.attendanceDate);
          if (dateStr && (status === 'present' || status === 'Present')) {
            presentDatesSet.add(dateStr);
          }
        });
        if (presentDatesSet.size === 0 && list.length === 0) {
          const end = new Date();
          const start = new Date(end);
          start.setDate(start.getDate() - 60);
          const datesToFetch = [];
          for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
            datesToFetch.push(toDateStr(d));
          }
          const overviews = await Promise.all(
            datesToFetch.map((dateStr) => getAllAttendance({ date: dateStr, status: 'Present' }).catch(() => ({ data: { labours: [] } })))
          );
          overviews.forEach((res, i) => {
            const labours = res?.data?.labours || [];
            const hasThisLabour = labours.some((l) => String(l.lid ?? l.labour_id ?? l.id ?? '') === String(labourId));
            if (hasThisLabour && datesToFetch[i]) presentDatesSet.add(datesToFetch[i]);
          });
        }
      }

      let paidSet = new Set();
      try {
        const paidList = paidRes?.data ?? paidRes?.paidRecords ?? paidRes?.records ?? (Array.isArray(paidRes) ? paidRes : []);
        paidList.forEach((item) => {
          const key = item?.reference_key ?? item?.key ?? (item?.date && (item?.entity_id ?? labourId) ? `${item.date}_${item.entity_id ?? labourId}` : (typeof item === 'string' ? item : null));
          if (key) paidSet.add(key);
        });
        // Fallback: merge with localStorage so paid status persists if backend doesn't return records
        const storageKey = getStorageKey(labourId);
        const stored = localStorage.getItem(storageKey);
        if (stored) {
          try {
            const parsed = JSON.parse(stored);
            (Array.isArray(parsed) ? parsed : []).forEach((k) => paidSet.add(k));
          } catch {
            // ignore
          }
        }
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
        return {
          key,
          date,
          labourId,
          labourName,
          workload,
          dailyWage,
          excessPay: 0,
          totalPayout: dailyWage,
          status
        };
      });

      rows.sort((a, b) => (b.date > a.date ? 1 : b.date < a.date ? -1 : 0));

      // Assign excess pay only to the row whose date matches the excess pay record
      rows.forEach((r) => {
        const key = `${r.date}_${r.labourId}`;
        const excess = excessByDateAndLabour[key] ?? 0;
        r.excessPay = excess;
        r.totalPayout = r.dailyWage + excess;
      });

      if (labourId) {
        rows = rows.filter((r) => String(r.labourId) === labourId);
        if (presentDatesSet.size > 0) {
          rows = rows.filter((r) => presentDatesSet.has(r.date));
          const labour = labourMap.get(labourId);
          const resolvedName = labour ? (labour.full_name || labour.name || '') : '';
          const workType = (labour?.work_type || 'Normal').trim();
          const workload = workType === 'Heavy' ? 'Heavy' : workType === 'Light' ? 'Light' : 'Normal';
          const dailyWageFromRate = (ratesMap[workType] ?? ratesMap['Normal'] ?? parseFloat(labour?.daily_wage)) || 0;
          presentDatesSet.forEach((dateStr) => {
            if (!rows.some((r) => r.date === dateStr)) {
              const key = `${dateStr}_${labourId}`;
              const excess = excessByDateAndLabour[key] ?? 0;
              rows.push({
                key,
                date: dateStr,
                labourId,
                labourName: resolvedName,
                workload,
                dailyWage: dailyWageFromRate,
                excessPay: excess,
                totalPayout: dailyWageFromRate + excess,
                status: paidSet.has(key) ? 'Paid' : 'Pending'
              });
            }
          });
          rows.sort((a, b) => (b.date > a.date ? 1 : b.date < a.date ? -1 : 0));
        }
        if (rows.length > 0) {
          setLabourName(rows[0].labourName || '');
        } else {
          const labour = labourMap.get(labourId);
          setLabourName(labour ? (labour.full_name || labour.name || '') : '');
        }
      }

      setPayoutData(rows);
      setPaidKeys(paidSet);
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
      setMarkingPaid(true);
      const rowData = {
        entity_id: labourId,
        key: payout.key,
        date: payout.date,
        labourId: payout.labourId,
        labourName: payout.labourName,
        workload: payout.workload,
        dailyWage: payout.dailyWage,
        excessPay: payout.excessPay,
        totalPayout: payout.totalPayout,
        amount: Number(payout.totalPayout) || 0, // for DB amount column
        status: 'Paid',
        ...payout
      };
      await markAsPaid('labour', rowData);
      setPaidKeys((prev) => new Set([...prev, key]));
      setPayoutData((prev) => prev.map((p) => (p.key === key ? { ...p, status: 'Paid' } : p)));
      // Persist to localStorage so status survives refresh (in case backend doesn't return paid records)
      try {
        const storageKey = getStorageKey(labourId);
        const stored = localStorage.getItem(storageKey);
        const list = stored ? JSON.parse(stored) : [];
        if (!list.includes(key)) list.push(key);
        localStorage.setItem(storageKey, JSON.stringify(list));
      } catch {
        // ignore
      }
    } catch (error) {
      console.error('Error marking labour payout as paid:', error);
      // Still persist locally so status survives refresh even if backend fails
      setPaidKeys((prev) => new Set([...prev, key]));
      setPayoutData((prev) => prev.map((p) => (p.key === key ? { ...p, status: 'Paid' } : p)));
      try {
        const storageKey = getStorageKey(labourId);
        const stored = localStorage.getItem(storageKey);
        const list = stored ? JSON.parse(stored) : [];
        if (!list.includes(key)) list.push(key);
        localStorage.setItem(storageKey, JSON.stringify(list));
      } catch {
        // ignore
      }
      alert(error?.message || error?.error || 'Could not save to server. Status saved locally and will persist after refresh.');
    } finally {
      setMarkingPaid(false);
    }
  };

  const getWorkloadColor = (workload) => {
    if (workload === 'Light') return 'bg-blue-100 text-blue-700';
    if (workload === 'Normal') return 'bg-green-100 text-green-700';
    return 'bg-orange-100 text-orange-700';
  };

  const formatNum = (n) =>
    Number.isFinite(n) ? n.toLocaleString('en-IN', { maximumFractionDigits: 0 }) : '0';

  const totalPending = payoutData
    .filter((p) => p.status === 'Pending')
    .reduce((sum, p) => sum + p.totalPayout, 0);

  const totalPages = calcPayoutTotalPages(payoutData.length, ITEMS_PER_PAGE);
  const paginatedData = getPayoutPageSlice(payoutData, currentPage, ITEMS_PER_PAGE);

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-emerald-50 p-4 sm:p-6 lg:p-8">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center gap-4 mb-6">
          <button
            onClick={() => navigate(labourId ? `/labour/${labourId}` : '/labour')}
            className="flex items-center gap-2 text-[#0D5C4D] hover:text-[#0a6354] transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
            <span className="font-medium">{labourId ? 'Back to Labour Details' : 'Back to Labour'}</span>
          </button>
        </div>

        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900">
            Labour Daily Payout{labourName ? ` – ${labourName}` : ''}
          </h1>
          <p className="text-gray-600 mt-1">
            {labourId ? `Daily payout for this labour` : 'Manage daily payouts for all labour'}
          </p>
        </div>

        <div className={payoutTableWrap}>
          <div className={payoutTableScroll}>
            <table className={`${payoutTableBase} min-w-[950px]`}>
              <colgroup>
                <col style={{ width: '10%' }} />
                <col style={{ width: '20%' }} />
                <col style={{ width: '10%' }} />
                <col style={{ width: '12%' }} />
                <col style={{ width: '12%' }} />
                <col style={{ width: '12%' }} />
                <col style={{ width: '10%' }} />
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
                  <tr><td colSpan={8} className={payoutEmptyCell}>Loading daily payouts...</td></tr>
                ) : payoutData.length === 0 ? (
                  <tr><td colSpan={8} className={payoutEmptyCell}>No payout data yet.</td></tr>
                ) : (
                  paginatedData.map((payout, index) => (
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
                      </td>
                      <td className={payoutTdCenter}>
                        <div className={payoutActionRow}>
                          {payout.status === 'Pending' ? (
                            <button type="button" onClick={() => handlePay(payout)} disabled={markingPaid} className={payoutBtn.pay}>
                              {markingPaid ? '…' : 'Pay'}
                            </button>
                          ) : (
                            <span className="text-xs text-[#6B8782] font-medium">Paid</span>
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
            totalItems={payoutData.length}
            itemsPerPage={ITEMS_PER_PAGE}
            onPageChange={setCurrentPage}
            onClampPage={setCurrentPage}
            itemLabel="days"
          >
            <span className="font-semibold text-[#0D5C4D]">
              Total Pending: <span className="text-[#0D7C66]">₹{formatNum(totalPending)}</span>
            </span>
          </PayoutPagination>
        </div>
      </div>
    </div>
  );
};

export default LabourDailyPayout;