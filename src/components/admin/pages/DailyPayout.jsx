import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { getAllOrders } from '../../../api/orderApi';
import { getOrderAssignment } from '../../../api/orderAssignmentApi';
import { getDriverById, getAllDrivers } from '../../../api/driverApi';
import { getFuelExpensesByDriverId } from '../../../api/fuelExpenseApi';
import { getExcessKMsByDriverId, updateExcessKM, createExcessKM } from '../../../api/excessKmApi';
import { getAdvancePaysByDriverId } from '../../../api/advancePayApi';
import { getAllDriverRates } from '../../../api/driverRateApi';
import { getDriverAttendanceHistory, getAttendanceOverview } from '../../../api/driverAttendanceApi';
import { getPaidRecords, markAsPaid } from '../../../api/dailyPayoutsApi';
import PayoutPagination from '../common/PayoutPagination';

import { payoutTh, payoutTd, payoutTdNum, payoutTdKm, payoutTdCenter, payoutBtn, payoutTableWrap, payoutTableScroll, payoutTableBase, payoutThead, payoutTbody, payoutRow, payoutEmptyCell, payoutActionRow, getPayoutStatusClassName } from '../../../components/admin/common/PayoutFilterBar';
import { DEFAULT_PAYOUT_PAGE_SIZE, calcPayoutTotalPages, getPayoutPageSlice } from '../../../components/admin/common/PayoutPagination';
const getTotalDrivenKM = (startKM, endKM) => {
  if (startKM == null || endKM == null) return null;
  const start = Number(startKM);
  const end = Number(endKM);
  if (!Number.isFinite(start) || !Number.isFinite(end)) return null;
  return Math.max(end - start, 0);
};

const getStorageKey = (driverId) => (driverId ? `driver-daily-paid-${driverId}` : 'driver-daily-paid');

const DailyPayout = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const driverId = String(id || '');

  const [loading, setLoading] = useState(true);
  const [driver, setDriver] = useState(null);
  const [payoutData, setPayoutData] = useState([]);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = DEFAULT_PAYOUT_PAGE_SIZE;
  const [paidDates, setPaidDates] = useState(new Set());
  const [markingPaid, setMarkingPaid] = useState(false);
  const [editExcessModal, setEditExcessModal] = useState({
    open: false,
    date: null,
    amount: '',
    recordId: null
  });
  const [savingExcess, setSavingExcess] = useState(false);

  useEffect(() => {
    if (driverId) fetchDailyPayouts();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- fetch depends on driverId only
  }, [driverId]);

  const fetchDailyPayouts = async () => {
    if (!driverId) {
      setLoading(false);
      return;
    }
    try {
      setLoading(true);

      const [driverRes, ordersRes, fuelRes, excessRes, advanceRes, driversRes, driverRatesRes, attendanceRes, paidRes] = await Promise.all([
        getDriverById(driverId).catch(() => null),
        getAllOrders().catch(() => ({ data: [] })),
        getFuelExpensesByDriverId(driverId).catch(() => ({ data: [] })),
        getExcessKMsByDriverId(driverId).catch(() => ({ data: [] })),
        getAdvancePaysByDriverId(driverId).catch(() => ({ data: [] })),
        getAllDrivers().catch(() => ({ data: [] })),
        getAllDriverRates().catch(() => ({ data: [], success: false })),
        getDriverAttendanceHistory(driverId, {}).catch(() => null),
        getPaidRecords('driver', { entity_id: driverId }).catch(() => ({ data: [] }))
      ]);

      const driverData = driverRes?.data ?? driverRes;
      const drivers = Array.isArray(driversRes) ? driversRes : (driversRes?.data || driversRes || []);
      const resolvedDriver = driverData || drivers.find(d => String(d.did) === driverId) || null;
      setDriver(resolvedDriver);

      const driverRates = Array.isArray(driverRatesRes) ? driverRatesRes : (driverRatesRes?.data || []);
      const ratesMap = {};
      const kmLimitMap = {};
      driverRates.forEach((rate) => {
        if (rate.status === 'Active') {
          const deliveryType = (rate.deliveryType || rate.delivery_type || '').toLowerCase();
          if (deliveryType) {
            ratesMap[deliveryType] = parseFloat(rate.amount || rate.rate || 0) || 0;
            kmLimitMap[deliveryType] =
              parseFloat(
                rate.kilometers ??
                  rate.kilometer ??
                  rate.km ??
                  0
              ) || 0;
          }
        }
      });
      const deliveryType = (resolvedDriver?.deliveryType || resolvedDriver?.delivery_type || 'collection').toLowerCase();
      let driverRate = ratesMap[deliveryType] || ratesMap['airport'] || ratesMap['collection'] || 0;
      if (!driverRate && driverRates.length > 0) {
        const activeRate = driverRates.find((r) => r.status === 'Active');
        if (activeRate) driverRate = parseFloat(activeRate.amount || activeRate.rate || 0) || 0;
      }
      if (!driverRate && resolvedDriver) {
        driverRate = parseFloat(resolvedDriver.daily_wage || resolvedDriver.dailyWage || 0) || 0;
      }
      if (!driverRate) driverRate = 0;

      let driverKmLimit =
        kmLimitMap[deliveryType] ||
        kmLimitMap['airport'] ||
        kmLimitMap['collection'] ||
        0;
      if (!driverKmLimit && driverRates.length > 0) {
        const activeRate = driverRates.find((r) => r.status === 'Active');
        if (activeRate) {
          driverKmLimit =
            parseFloat(
              activeRate.kilometers ??
                activeRate.kilometer ??
                activeRate.km ??
                0
            ) || 0;
        }
      }

      const orders = Array.isArray(ordersRes) ? ordersRes : (ordersRes?.data || []);
      const fuelList = Array.isArray(fuelRes) ? fuelRes : (fuelRes?.data || []);
      const excessList = Array.isArray(excessRes) ? excessRes : (excessRes?.data || []);
      const advanceList = Array.isArray(advanceRes) ? advanceRes : (advanceRes?.data || []);

      const basePayByDate = {};
      const orderCountByDate = {};
      const fuelByDate = {};
      const fuelUnitPriceByDate = {};
      const excessKMByDate = {};
      const excessKMRecordByDate = {};
      const advanceByDate = {};
      const startKMByDate = {};
      const endKMByDate = {};

      const toDateStr = (val) => {
        if (!val) return '';
        try {
          return new Date(val).toISOString().split('T')[0];
        } catch {
          return String(val).substring(0, 10);
        }
      };

      fuelList.forEach((expense) => {
        if ((expense.payment_status || 'unpaid') === 'paid') return;

        const dateStr = toDateStr(expense.date || expense.expense_date);
        if (!dateStr) return;
        const unitPrice = parseFloat(expense.unit_price ?? expense.unitPrice ?? 0) || 0;
        let amt = parseFloat(expense.total_amount || expense.total || 0) || 0;
        if (!amt && unitPrice && expense.litre != null) {
          amt = unitPrice * parseFloat(expense.litre);
        }
        fuelByDate[dateStr] = (fuelByDate[dateStr] || 0) + amt;
        if (unitPrice) {
          fuelUnitPriceByDate[dateStr] = unitPrice;
        }
      });

      excessList.forEach((km) => {
        const dateStr = toDateStr(km.date);
        if (!dateStr) return;

        const startKm = Math.max(parseFloat(km.start_km ?? km.startKm ?? 0) || 0, 0);
        const endKm = Math.max(parseFloat(km.end_km ?? km.endKm ?? 0) || 0, 0);
        const amt = parseFloat(km.amount || 0) || 0;
        const recordId = km.id ?? km.ekmid ?? km.excess_km_id;

        if (startKm) {
          startKMByDate[dateStr] =
            startKMByDate[dateStr] != null
              ? Math.min(startKMByDate[dateStr], startKm)
              : startKm;
        }

        if (endKm) {
          endKMByDate[dateStr] =
            endKMByDate[dateStr] != null
              ? Math.max(endKMByDate[dateStr], endKm)
              : endKm;
        }

        excessKMByDate[dateStr] = (excessKMByDate[dateStr] || 0) + amt;
        if (recordId && !excessKMRecordByDate[dateStr]) {
          excessKMRecordByDate[dateStr] = recordId;
        }
      });

      advanceList.forEach((adv) => {
        const dateStr = toDateStr(adv.date || adv.pay_date || adv.createdAt);
        if (!dateStr) return;
        const amt = parseFloat(adv.advance_amount ?? adv.amount ?? 0) || 0;
        advanceByDate[dateStr] = (advanceByDate[dateStr] || 0) + amt;
      });

      const isThisDriver = (d) => d && String(d.did) === driverId;

      const assignmentPromises = orders.map(async (order) => {
        try {
          const assignmentRes = await getOrderAssignment(order.oid).catch(() => null);
          if (!assignmentRes?.data) return;

          const orderDate = order.order_received_date || order.createdAt;
          const dateStr = toDateStr(orderDate);
          if (!dateStr) return;

          let orderCountAdded = false;
          const addOrderCount = () => {
            if (!orderCountAdded) {
              orderCountByDate[dateStr] = (orderCountByDate[dateStr] || 0) + 1;
              orderCountAdded = true;
            }
          };

          let stage1Data = null;
          try {
            if (assignmentRes.data.stage1_data) {
              stage1Data = typeof assignmentRes.data.stage1_data === 'string'
                ? JSON.parse(assignmentRes.data.stage1_data)
                : assignmentRes.data.stage1_data;
            }
          } catch {
            // ignore parse errors
          }

          if (stage1Data?.deliveryRoutes) {
            stage1Data.deliveryRoutes.forEach((route) => {
              const driverName = route.driver || '';
              if (!driverName) return;
              const nameParts = driverName.split(' - ');
              const cleanName = nameParts[0].trim();
              const d = drivers.find(
                (x) =>
                  (x.driver_name || '').toLowerCase() === cleanName.toLowerCase() ||
                  (x.driver_id || '').toLowerCase() === (nameParts[1] || '').toLowerCase()
              );
              if (!isThisDriver(d)) return;
              const wage = parseFloat(route.driverWage || route.amount || 0) || 0;
              basePayByDate[dateStr] = (basePayByDate[dateStr] || 0) + wage;
              addOrderCount();
            });
          }

          let stage3Data = null;
          try {
            if (assignmentRes.data.stage3_summary_data) {
              stage3Data = typeof assignmentRes.data.stage3_summary_data === 'string'
                ? JSON.parse(assignmentRes.data.stage3_summary_data)
                : assignmentRes.data.stage3_summary_data;
            } else if (assignmentRes.data.stage3_data) {
              stage3Data = typeof assignmentRes.data.stage3_data === 'string'
                ? JSON.parse(assignmentRes.data.stage3_data)
                : assignmentRes.data.stage3_data;
            }
          } catch {
            // ignore parse errors
          }

          if (!stage3Data) return;

          const airportGroups = stage3Data.summaryData?.airportGroups || stage3Data.airportGroups || {};
          const products = stage3Data.products || [];
          const driverAssignments = stage3Data.summaryData?.driverAssignments || [];

          driverAssignments.forEach((assignment) => {
            const driverName = assignment.driver || '';
            if (!driverName) return;
            const nameParts = driverName.split(' - ');
            const cleanName = nameParts[0].trim();
            const d = drivers.find(
              (x) =>
                (x.driver_name || '').toLowerCase() === cleanName.toLowerCase() ||
                (x.driver_id || '').toLowerCase() === (nameParts[1] || '').toLowerCase() ||
                String(x.did) === String(assignment.driverId || '')
            );
            if (!isThisDriver(d)) return;
            addOrderCount();
          });

          Object.values(airportGroups).forEach((group) => {
            let driverName = group.driver || group.driverName || '';
            if (!driverName && group.products?.length) {
              const p = group.products.find((x) => x.driver || x.selectedDriver || x.driverName);
              if (p) driverName = p.driver || p.selectedDriver || p.driverName;
            }
            if (!driverName) return;
            const d = drivers.find(
              (x) =>
                (x.driver_name || '').toLowerCase() === driverName.toLowerCase() ||
                (driverName.includes(' - ') &&
                  (x.driver_name || '').toLowerCase() === driverName.split(' - ')[0].trim().toLowerCase()) ||
                (x.driver_id || '').toLowerCase() === (driverName.split(' - ')[1] || '').trim().toLowerCase()
            );
            if (!isThisDriver(d)) return;
            const wage = parseFloat(group.driverWage || group.pickupCost || 0) || 0;
            basePayByDate[dateStr] = (basePayByDate[dateStr] || 0) + wage;
            addOrderCount();
          });

          products.forEach((product) => {
            let driverName = product.selectedDriver || product.driver || product.driverName || '';
            if (!driverName && product.selectedDriver) {
              const dById = drivers.find((x) => String(x.did) === String(product.selectedDriver));
              if (dById) driverName = dById.driver_name;
            }
            if (!driverName) return;
            const d =
              drivers.find((x) => String(x.did) === String(driverName)) ||
              drivers.find((x) => (x.driver_id || '').toLowerCase() === String(driverName).toLowerCase()) ||
              drivers.find((x) => (x.driver_name || '').toLowerCase() === driverName.toLowerCase()) ||
              (driverName.includes(' - ')
                ? drivers.find(
                    (x) =>
                      (x.driver_name || '').toLowerCase() === driverName.split(' - ')[0].trim().toLowerCase() ||
                      (x.driver_id || '').toLowerCase() === (driverName.split(' - ')[1] || '').trim().toLowerCase()
                  )
                : null);
            if (!isThisDriver(d)) return;
            const wage = parseFloat(product.driverWage || product.pickupCost || 0) || 0;
            basePayByDate[dateStr] = (basePayByDate[dateStr] || 0) + wage;
            addOrderCount();
          });
        } catch (err) {
          console.error('Error processing order for daily payout:', err);
        }
      });

      await Promise.all(assignmentPromises);

      const presentDatesSet = new Set();
      const attendanceList = Array.isArray(attendanceRes?.data) ? attendanceRes.data : (attendanceRes?.records || attendanceRes?.attendance || []);
      attendanceList.forEach((rec) => {
        const status = (rec.status ?? rec.attendance_status ?? rec.attendanceStatus ?? '').toString().toLowerCase();
        const dateStr = toDateStr(rec.date ?? rec.attendance_date ?? rec.attendanceDate ?? rec.check_in_date);
        if (dateStr && (status === 'present' || status === 'Present')) {
          presentDatesSet.add(dateStr);
        }
      });
      if (presentDatesSet.size === 0 && attendanceList.length === 0) {
        const end = new Date();
        const start = new Date(end);
        start.setDate(start.getDate() - 60);
        const datesToFetch = [];
        for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
          datesToFetch.push(toDateStr(d));
        }
        const overviews = await Promise.all(
          datesToFetch.map((dateStr) =>
            getAttendanceOverview({ date: dateStr, status: 'Present' }).catch(() => ({ success: false, data: { drivers: [] } }))
          )
        );
        overviews.forEach((res, i) => {
          const drivers = res?.data?.drivers || [];
          const hasThisDriver = drivers.some(
            (d) => String(d.did ?? d.driver_id ?? d.id ?? '') === String(driverId)
          );
          if (hasThisDriver && datesToFetch[i]) presentDatesSet.add(datesToFetch[i]);
        });
      }

      const allDates = new Set([
        ...Object.keys(basePayByDate),
        ...Object.keys(fuelByDate),
        ...Object.keys(excessKMByDate),
        ...Object.keys(advanceByDate),
        ...Object.keys(startKMByDate),
        ...Object.keys(endKMByDate)
      ]);

      let paidSet = new Set();
      try {
        const paidList = paidRes?.data ?? paidRes?.paidDates ?? paidRes?.records ?? (Array.isArray(paidRes) ? paidRes : []);
        paidList.forEach((item) => {
          const refKey = item?.reference_key ?? item?.key;
          const date = typeof item === 'string' ? item : (refKey ? (refKey.includes('_') ? refKey.split('_')[0] : refKey) : (item?.date ?? item?.reference_date ?? item?.payout_date));
          if (date) paidSet.add(date);
        });
        // Fallback: merge with localStorage so paid status persists if backend doesn't return records
        const storageKey = getStorageKey(driverId);
        const stored = localStorage.getItem(storageKey);
        if (stored) {
          try {
            const parsed = JSON.parse(stored);
            (Array.isArray(parsed) ? parsed : []).forEach((d) => paidSet.add(d));
          } catch {
            // ignore
          }
        }
      } catch {
        // ignore
      }

      let rows = Array.from(allDates)
        .sort()
        .reverse()
        .map((dateStr) => {
          const basePay = driverRate;
          const fuel = fuelByDate[dateStr] || 0;
          const advancePay = advanceByDate[dateStr] || 0;
          const startKM = startKMByDate[dateStr];
          const endKM = endKMByDate[dateStr];

          // distance-based excess in KM: show travelled when we have start/end; apply limit if set
          let excessDistanceKM = 0;
          if (startKM != null && endKM != null) {
            const travelled = Math.max(endKM - startKM, 0);
            if (driverKmLimit && driverKmLimit > 0) {
              excessDistanceKM = Math.max(travelled - driverKmLimit, 0);
            } else {
              excessDistanceKM = travelled;
            }
          }

          // price for excess KM: prefer saved manual amount, else calculated from unit price
          const unitPrice = fuelUnitPriceByDate[dateStr] || 0;
          const savedAmount = excessKMByDate[dateStr];
          const hasManualAmount = savedAmount != null && Number(savedAmount) > 0;
          let excessKMPrice = 0;
          if (hasManualAmount) {
            excessKMPrice = Number(savedAmount);
          } else if (unitPrice && excessDistanceKM > 0) {
            excessKMPrice = excessDistanceKM * unitPrice;
          }

          const excessKMRecordId = excessKMRecordByDate[dateStr] ?? null;

          const totalPayout = basePay - fuel - advancePay + excessKMPrice;
          const status = paidSet.has(dateStr) ? 'Paid' : 'Pending';
          return {
            date: dateStr,
            basePay,
            fuelExpenses: fuel,
            startKM,
            endKM,
            excessKM: excessDistanceKM,
            unitPrice,
            excessKMPrice,
            excessKMRecordId,
            advancePay,
            totalPayout,
            status
          };
        });

      if (presentDatesSet.size > 0) {
        rows = rows.filter((r) => presentDatesSet.has(r.date));
        presentDatesSet.forEach((dateStr) => {
          if (!rows.some((r) => r.date === dateStr)) {
            const fuel = fuelByDate[dateStr] || 0;
            const advancePay = advanceByDate[dateStr] || 0;
            const startKM = startKMByDate[dateStr];
            const endKM = endKMByDate[dateStr];
            let excessDistanceKM = 0;
            if (startKM != null && endKM != null) {
              const travelled = Math.max(endKM - startKM, 0);
              if (driverKmLimit && driverKmLimit > 0) {
                excessDistanceKM = Math.max(travelled - driverKmLimit, 0);
              } else {
                excessDistanceKM = travelled;
              }
            }
            const unitPrice = fuelUnitPriceByDate[dateStr] || 0;
            const savedAmount = excessKMByDate[dateStr];
            const hasManualAmount = savedAmount != null && Number(savedAmount) > 0;
            let excessKMPrice = 0;
            if (hasManualAmount) {
              excessKMPrice = Number(savedAmount);
            } else if (unitPrice && excessDistanceKM > 0) {
              excessKMPrice = excessDistanceKM * unitPrice;
            }
            rows.push({
              date: dateStr,
              basePay: driverRate,
              fuelExpenses: fuel,
              startKM,
              endKM,
              excessKM: excessDistanceKM,
              unitPrice,
              excessKMPrice,
              excessKMRecordId: excessKMRecordByDate[dateStr] ?? null,
              advancePay,
              totalPayout: driverRate - fuel - advancePay + excessKMPrice,
              status: paidSet.has(dateStr) ? 'Paid' : 'Pending'
            });
          }
        });
        rows.sort((a, b) => (b.date > a.date ? 1 : b.date < a.date ? -1 : 0));
      }

      setPayoutData(rows);
      setPaidDates(paidSet);
      setCurrentPage(1);
    } catch (error) {
      console.error('Error fetching daily payouts:', error);
      setPayoutData([]);
    } finally {
      setLoading(false);
    }
  };

  const handlePay = async (payout) => {
    const date = payout.date;
    try {
      setMarkingPaid(true);
      const rowData = {
        key: payout.date,
        entity_id: driverId,
        date: payout.date,
        basePay: payout.basePay,
        fuelExpenses: payout.fuelExpenses,
        startKM: payout.startKM,
        endKM: payout.endKM,
        excessKM: payout.excessKM,
        unitPrice: payout.unitPrice,
        excessKMPrice: payout.excessKMPrice,
        excessKMRecordId: payout.excessKMRecordId,
        advancePay: payout.advancePay,
        totalPayout: payout.totalPayout,
        amount: Number(payout.totalPayout) || 0, // for DB amount column
        status: 'Paid',
        ...payout
      };
      await markAsPaid('driver', rowData);
      setPaidDates((prev) => new Set([...prev, date]));
      setPayoutData((prev) =>
        prev.map((p) => (p.date === date ? { ...p, status: 'Paid' } : p))
      );
      // Persist to localStorage so status survives refresh (in case backend doesn't return paid records)
      try {
        const storageKey = getStorageKey(driverId);
        const stored = localStorage.getItem(storageKey);
        const list = stored ? JSON.parse(stored) : [];
        if (!list.includes(date)) list.push(date);
        localStorage.setItem(storageKey, JSON.stringify(list));
      } catch {
        // ignore
      }
    } catch (error) {
      console.error('Error marking payout as paid:', error);
      // Still persist locally so status survives refresh even if backend fails
      setPaidDates((prev) => new Set([...prev, date]));
      setPayoutData((prev) =>
        prev.map((p) => (p.date === date ? { ...p, status: 'Paid' } : p))
      );
      try {
        const storageKey = getStorageKey(driverId);
        const stored = localStorage.getItem(storageKey);
        const list = stored ? JSON.parse(stored) : [];
        if (!list.includes(date)) list.push(date);
        localStorage.setItem(storageKey, JSON.stringify(list));
      } catch {
        // ignore
      }
      alert(error?.message || error?.error || 'Could not save to server. Status saved locally and will persist after refresh.');
    } finally {
      setMarkingPaid(false);
    }
  };

  const openEditExcessPrice = (payout) => {
    setEditExcessModal({
      open: true,
      date: payout.date,
      amount: String(payout.excessKMPrice ?? ''),
      recordId: payout.excessKMRecordId ?? null
    });
  };

  const closeEditExcessModal = () => {
    setEditExcessModal({ open: false, date: null, amount: '', recordId: null });
  };

  const handleSaveExcessPrice = async () => {
    const { date, amount, recordId } = editExcessModal;
    const numAmount = parseFloat(amount);
    if (date == null || (amount !== '' && isNaN(numAmount))) return;
    try {
      setSavingExcess(true);
      if (recordId) {
        await updateExcessKM(recordId, { amount: amount === '' ? 0 : numAmount });
      } else {
        await createExcessKM({
          driver_id: parseInt(driverId, 10),
          date,
          amount: amount === '' ? 0 : numAmount,
          start_km: 0,
          end_km: 0,
          kilometers: 0,
          vehicle_number: driver?.vehicle_number ?? driver?.vehicleNumber ?? 'N/A'
        });
      }
      closeEditExcessModal();
      await fetchDailyPayouts();
    } catch (error) {
      console.error('Error saving excess KM price:', error);
      alert(error?.message || error?.error || 'Failed to save excess KM price');
    } finally {
      setSavingExcess(false);
    }
  };

  const formatNum = (n) =>
    Number.isFinite(n) ? n.toLocaleString('en-IN', { maximumFractionDigits: 0 }) : '0';

  const totalPending = payoutData
    .filter((p) => p.status === 'Pending')
    .reduce((sum, p) => sum + p.totalPayout, 0);

  const totalPages = calcPayoutTotalPages(payoutData.length, itemsPerPage);
  const paginatedData = getPayoutPageSlice(payoutData, currentPage, itemsPerPage);

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-emerald-50 p-4 sm:p-6 lg:p-8">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center gap-4 mb-6">
          <button
            onClick={() => navigate(`/drivers/${id}`)}
            className="flex items-center gap-2 text-[#0D5C4D] hover:text-[#0a6354] transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
            <span className="font-medium">Back to Driver Details</span>
          </button>
        </div>

        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Daily Payout</h1>
          <p className="text-gray-600 mt-1">
            Manage daily payouts for driver
            {driver && (
              <span className="text-[#0D5C4D] font-medium ml-1">
                {driver.driver_name || driver.name || `#${driverId}`}
              </span>
            )}
          </p>
        </div>

        <div className={payoutTableWrap}>
          <div className={payoutTableScroll}>
            <table className={`${payoutTableBase} min-w-[1200px]`}>
              <colgroup>
                <col style={{ width: '8rem' }} />
                <col style={{ width: '5.5rem' }} />
                <col style={{ width: '5.5rem' }} />
                <col style={{ width: '4.5rem' }} />
                <col style={{ width: '4.5rem' }} />
                <col style={{ width: '4.5rem' }} />
                <col style={{ width: '4.5rem' }} />
                <col style={{ width: '9rem' }} />
                <col style={{ width: '5.5rem' }} />
                <col style={{ width: '5.5rem' }} />
                <col style={{ width: '5.5rem' }} />
                <col style={{ width: '6rem' }} />
              </colgroup>
              <thead className={payoutThead}>
                <tr>
                  <th className={`${payoutTh} text-left`}>Date</th>
                  <th className={`${payoutTh} text-right`}>Base Pay</th>
                  <th className={`${payoutTh} text-right`}>Fuel</th>
                  <th className={`${payoutTh} text-center`}>Start KM</th>
                  <th className={`${payoutTh} text-center`}>End KM</th>
                  <th className={`${payoutTh} text-center`}>Total KM</th>
                  <th className={`${payoutTh} text-center`}>Excess KM</th>
                  <th className={`${payoutTh} text-right`}>Excess Price</th>
                  <th className={`${payoutTh} text-right`}>Advance</th>
                  <th className={`${payoutTh} text-right`}>Total</th>
                  <th className={`${payoutTh} text-center`}>Status</th>
                  <th className={`${payoutTh} text-center`}>Action</th>
                </tr>
              </thead>
              <tbody className={payoutTbody}>
                {loading ? (
                  <tr><td colSpan={12} className={payoutEmptyCell}>Loading daily payouts...</td></tr>
                ) : payoutData.length === 0 ? (
                  <tr><td colSpan={12} className={payoutEmptyCell}>No payout data for this driver yet.</td></tr>
                ) : (
                  paginatedData.map((payout, index) => (
                    <tr key={payout.date} className={payoutRow(index)}>
                      <td className={`${payoutTd} whitespace-nowrap font-semibold`}>
                        {new Date(payout.date + 'T12:00:00').toLocaleDateString('en-GB')}
                      </td>
                      <td className={payoutTdNum}>₹{formatNum(payout.basePay)}</td>
                      <td className={`${payoutTdNum} text-red-600`}>-₹{formatNum(payout.fuelExpenses)}</td>
                      <td className={payoutTdKm}>
                        {payout.startKM != null ? formatNum(payout.startKM) : '—'}
                      </td>
                      <td className={payoutTdKm}>
                        {payout.endKM != null ? formatNum(payout.endKM) : '—'}
                      </td>
                      <td className={payoutTdKm}>
                        {getTotalDrivenKM(payout.startKM, payout.endKM) != null
                          ? formatNum(getTotalDrivenKM(payout.startKM, payout.endKM))
                          : '—'}
                      </td>
                      <td className={payoutTdKm}>
                        {payout.excessKM != null && payout.excessKM > 0 ? formatNum(payout.excessKM) : '—'}
                      </td>
                      <td className={payoutTd}>
                        <div className="flex items-center justify-end gap-1.5">
                          <span className="text-sm text-green-600 tabular-nums whitespace-nowrap">
                            {payout.excessKM && payout.unitPrice && !payout.excessKMRecordId
                              ? `+₹${formatNum(payout.excessKMPrice || 0)}`
                              : `+₹${formatNum(payout.excessKMPrice || 0)}`}
                          </span>
                          <button type="button" onClick={() => openEditExcessPrice(payout)} className={payoutBtn.ghost}>Edit</button>
                        </div>
                      </td>
                      <td className={`${payoutTdNum} text-red-600`}>-₹{formatNum(payout.advancePay)}</td>
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
            itemsPerPage={itemsPerPage}
            onPageChange={setCurrentPage}
            onClampPage={setCurrentPage}
            itemLabel="days"
          >
            <span className="font-semibold text-[#0D5C4D]">
              Total Pending: <span className="text-[#0D7C66]">₹{formatNum(totalPending)}</span>
            </span>
          </PayoutPagination>
        </div>

        {/* Edit Excess KM Price Modal */}
        {editExcessModal.open && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl shadow-xl w-full max-w-sm">
              <div className="px-5 py-3.5 border-b border-gray-200 flex items-center justify-between">
                <h2 className="text-lg font-semibold text-gray-900">
                  {editExcessModal.recordId ? 'Edit' : 'Set'} Excess KM Price
                </h2>
                <button
                  type="button"
                  onClick={closeEditExcessModal}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              <div className="p-6 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Date</label>
                  <div className="text-sm text-gray-900">
                    {editExcessModal.date
                      ? new Date(editExcessModal.date + 'T12:00:00').toLocaleDateString('en-GB')
                      : '—'}
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Excess KM Price (₹)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={editExcessModal.amount}
                    onChange={(e) =>
                      setEditExcessModal((prev) => ({ ...prev, amount: e.target.value }))
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                    placeholder="Enter amount"
                  />
                </div>
              </div>
              <div className="px-5 py-3.5 border-t border-gray-200 flex gap-3 justify-end">
                <button
                  type="button"
                  onClick={closeEditExcessModal}
                  className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg font-medium hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSaveExcessPrice}
                  disabled={savingExcess}
                  className="px-4 py-2 bg-teal-600 text-white rounded-lg font-medium hover:bg-teal-700 disabled:opacity-50"
                >
                  {savingExcess ? 'Saving...' : 'Save'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default DailyPayout;