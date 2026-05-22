import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import PayoutFilterBar, { PayAllConfirmModal } from '../common/PayoutFilterBar';
import PayoutPagination from '../common/PayoutPagination';
import { getAllOrders } from '../../../api/orderApi';
import { getOrderAssignment } from '../../../api/orderAssignmentApi';
import { getAllDrivers } from '../../../api/driverApi';
import { getAllDriverRates } from '../../../api/driverRateApi';
import { getAllFuelExpenses } from '../../../api/fuelExpenseApi';
import { getAllExcessKMs } from '../../../api/excessKmApi';
import {
  buildExcessKmMapsFromRecords,
  computeDriverDayKmPayout,
  getTotalDrivenKM,
  toPayoutDateStr,
} from '../../../api/driverApi';
import { getAllAdvancePays } from '../../../api/advancePayApi';
import { getAttendanceOverview } from '../../../api/driverAttendanceApi';
import { getPaidRecords, markAsPaid, markPartialPaid, unmarkAsPaid } from '../../../api/payoutApi';
import {
  getPaidRecords as getDailyPaidRecords,
  markAsPaid as markDailyAsPaid
} from '../../../api/dailyPayoutsApi';
import * as XLSX from 'xlsx-js-style';
import jsPDF from 'jspdf';
import { sortPayoutsByStatus, usePayoutPayAll, driverTh, driverTd, driverTdNum, driverTdKm, driverBtn, payoutTableWrap, payoutTableScroll, payoutTableBase, payoutThead, payoutTbody, payoutRow, payoutEmptyCell, getPayoutStatusClassName, payoutActionRow } from '../../../components/admin/common/PayoutFilterBar';
import { DEFAULT_PAYOUT_PAGE_SIZE, calcPayoutTotalPages, getPayoutPageSlice } from '../../../components/admin/common/PayoutPagination';
import 'jspdf-autotable';

const ITEMS_PER_PAGE = DEFAULT_PAYOUT_PAGE_SIZE;
const DAYS_BACK = 60;
const STORAGE_KEY_ALL = 'driver-daily-paid';
const DEFAULT_FREE_KM = 100;

const toDateStr = toPayoutDateStr;

const parseRowData = (paymentRecord) => {
  const raw = paymentRecord?.row_data;
  if (!raw) return {};
  if (typeof raw === 'string') {
    try {
      return JSON.parse(raw);
    } catch {
      return {};
    }
  }
  return raw;
};

const getPartialPaidAmount = (paymentRecord) => {
  const rowData = parseRowData(paymentRecord);
  const paymentStatus = String(
    rowData?.paymentStatus ||
    rowData?.status ||
    paymentRecord?.payment_status ||
    paymentRecord?.status ||
    ''
  ).toLowerCase();
  const isPartialByStatus = paymentStatus === 'partial';
  return Number(
    rowData?.partialPaidAmount ??
    rowData?.partial_amount ??
    paymentRecord?.partialPaidAmount ??
    paymentRecord?.partial_amount ??
    paymentRecord?.paid_amount ??
    (isPartialByStatus ? rowData?.amount : 0) ??
    (isPartialByStatus ? paymentRecord?.amount : 0) ??
    0
  ) || 0;
};

const getPayoutStatus = ({ paymentRecord, key, paidSet, totalPayout }) => {
  const rowData = parseRowData(paymentRecord);
  const paymentStatus = String(
    rowData?.paymentStatus ||
    rowData?.status ||
    paymentRecord?.payment_status ||
    paymentRecord?.status ||
    ''
  ).toLowerCase();
  const partialPaidAmount = getPartialPaidAmount(paymentRecord);
  const hasPartialAmount = partialPaidAmount > 0 && partialPaidAmount < (Number(totalPayout) || 0);
  if (paymentStatus === 'paid') return 'Paid';
  if (paymentStatus === 'partial') return 'Partial';
  if (!paymentStatus && hasPartialAmount) return 'Partial';
  return paidSet.has(key) ? 'Paid' : 'Pending';
};

const DriverPayoutManagement = () => {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [selectedDriverId, setSelectedDriverId] = useState('');
  const [driverOptions, setDriverOptions] = useState([]);
  const [currentPage, setCurrentPage] = useState(1);

  const [loading, setLoading] = useState(true);
  const [payouts, setPayouts] = useState([]);
  const [markingPaid, setMarkingPaid] = useState(false);
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

  const formatCurrency = (amount) => {
    const value = Number.isFinite(amount) ? amount : 0;
    return `₹${value.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;
  };

  useEffect(() => {
    fetchDriverPayouts();
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY_ALL, JSON.stringify([...paidKeys]));
    } catch {
      // ignore
    }
  }, [paidKeys]);

  const fetchDriverPayouts = async () => {
    try {
      setLoading(true);

      const [ordersRes, driversRes, driverRatesRes, fuelExpensesRes, excessKMsRes, advancePaysRes, paidRes, dailyPaidRes] = await Promise.all([
        getAllOrders().catch(() => ({ data: [], success: false })),
        getAllDrivers().catch(() => ({ data: [], success: false })),
        getAllDriverRates().catch(() => ({ data: [], success: false })),
        getAllFuelExpenses().catch(() => ({ data: [], success: false })),
        getAllExcessKMs().catch(() => ({ data: [], success: false })),
        getAllAdvancePays().catch(() => ({ data: [], success: false })),
        getPaidRecords('driver').catch(() => ({ data: [] })),
        getDailyPaidRecords('driver').catch(() => ({ data: [] }))
      ]);

      const orders = ordersRes?.data || ordersRes || [];
      const drivers = driversRes?.data || driversRes || [];
      setDriverOptions(drivers);
      const driverRates = Array.isArray(driverRatesRes) ? driverRatesRes : (driverRatesRes?.data || []);
      const fuelExpenses = Array.isArray(fuelExpensesRes) ? fuelExpensesRes : (fuelExpensesRes?.data || []);
      const excessKMs = Array.isArray(excessKMsRes) ? excessKMsRes : (excessKMsRes?.data || []);
      const advancePays = Array.isArray(advancePaysRes) ? advancePaysRes : (advancePaysRes?.data || []);

      const driverMap = new Map(
        drivers.map(d => [String(d.did), d])
      );

      const ratesMap = {};
      const kmLimitMap = {};
      driverRates.forEach(rate => {
        if (rate.status === 'Active') {
          const deliveryType = (rate.deliveryType || rate.delivery_type || '').toLowerCase();
          if (deliveryType) {
            ratesMap[deliveryType] = parseFloat(rate.amount || rate.rate || 0) || 0;
            kmLimitMap[deliveryType] = parseFloat(rate.kilometers ?? rate.kilometer ?? rate.km ?? 0) || 0;
          }
        }
      });

      const fuelByDriverByDate = {};
      const fuelUnitPriceByDriverByDate = {};
      fuelExpenses.forEach(expense => {
        if ((expense.payment_status || 'unpaid') === 'paid') return;

        const driverId = String(expense.driver_id ?? expense.did ?? expense.driver?.did ?? '');
        if (!driverId) return;
        const dateStr = toDateStr(expense.date || expense.expense_date);
        if (!dateStr) return;
        if (!fuelByDriverByDate[driverId]) {
          fuelByDriverByDate[driverId] = {};
          fuelUnitPriceByDriverByDate[driverId] = {};
        }
        const unitPrice = parseFloat(expense.unit_price ?? expense.unitPrice ?? 0) || 0;
        let amt = parseFloat(expense.total_amount || expense.total || 0) || 0;
        if (!amt && unitPrice && expense.litre != null) amt = unitPrice * parseFloat(expense.litre);
        fuelByDriverByDate[driverId][dateStr] = (fuelByDriverByDate[driverId][dateStr] || 0) + amt;
        if (unitPrice) fuelUnitPriceByDriverByDate[driverId][dateStr] = unitPrice;
      });

      const advanceByDriverByDate = {};
      advancePays.forEach(adv => {
        const driverId = String(adv.driver_id ?? adv.did ?? adv.driver?.did ?? '');
        if (!driverId) return;
        const dateStr = toDateStr(adv.date || adv.pay_date || adv.createdAt);
        if (!dateStr) return;
        if (!advanceByDriverByDate[driverId]) advanceByDriverByDate[driverId] = {};
        const amt = parseFloat(adv.advance_amount ?? adv.amount ?? 0) || 0;
        advanceByDriverByDate[driverId][dateStr] = (advanceByDriverByDate[driverId][dateStr] || 0) + amt;
      });

      const {
        amountByDriverByDate: excessKMByDriverByDate,
        recordIdByDriverByDate: excessKMRecordByDriverByDate,
        startKMByDriverByDate,
        endKMByDriverByDate,
        explicitExcessKmByDriverByDate: excessDistanceByDriverByDate,
        kilometersFieldByDriverByDate,
      } = buildExcessKmMapsFromRecords(excessKMs);

      // Driver attendance: which (date, driver) were present (for showing daily wages only on present days)
      const presentSet = new Set();
      const end = new Date();
      const start = new Date(end);
      start.setDate(start.getDate() - DAYS_BACK);
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
        const dateStr = datesToFetch[i];
        if (!dateStr) return;
        const list = res?.data?.drivers ?? res?.data ?? [];
        const driverList = Array.isArray(list) ? list : [];
        driverList.forEach((d) => {
          const did = String(d.did ?? d.driver_id ?? d.id ?? '');
          if (did) presentSet.add(`${dateStr}_${did}`);
        });
      });

      // Aggregate driver wages and work days from Stage 3
      const wagesByDriverId = {};
      const workDaysByDriverId = {};

      const assignmentPromises = orders.map(async (order) => {
        try {
          const assignmentRes = await getOrderAssignment(order.oid).catch(() => null);
          if (!assignmentRes?.data) return;

          const orderDate = order.order_received_date || order.createdAt;
          const dateStr = toDateStr(orderDate);

          // Check Stage 1 for driver assignments in delivery routes
          let stage1Data = null;
          try {
            if (assignmentRes.data.stage1_data) {
              stage1Data = typeof assignmentRes.data.stage1_data === 'string'
                ? JSON.parse(assignmentRes.data.stage1_data)
                : assignmentRes.data.stage1_data;
            } else if (assignmentRes.data.product_assignments) {
              // Sometimes stage1 data is stored in product_assignments
              const assignments = typeof assignmentRes.data.product_assignments === 'string'
                ? JSON.parse(assignmentRes.data.product_assignments)
                : assignmentRes.data.product_assignments;
              if (Array.isArray(assignments) && assignments.length > 0) {
                stage1Data = { deliveryRoutes: [] };
              }
            }
          } catch (e) {
            console.error('Error parsing stage1 data:', e);
          }

          // Process Stage 1 delivery routes
          if (stage1Data?.deliveryRoutes) {
            stage1Data.deliveryRoutes.forEach(route => {
              const driverName = route.driver || '';
              if (!driverName) return;

              // Extract driver name (format might be "Name - DRV-001")
              const nameParts = driverName.split(' - ');
              const cleanDriverName = nameParts[0].trim();

              const driver = drivers.find(d => 
                (d.driver_name || '').toLowerCase() === cleanDriverName.toLowerCase() ||
                (d.driver_id || '').toLowerCase() === (nameParts[1] || '').toLowerCase()
              );

              if (!driver) return;

              const driverId = String(driver.did);
              if (!wagesByDriverId[driverId]) {
                wagesByDriverId[driverId] = 0;
                workDaysByDriverId[driverId] = new Set();
              }
              // Add a base wage for the route (can be calculated from distance or use default)
              const routeWage = parseFloat(route.driverWage || route.amount || 0) || 0;
              wagesByDriverId[driverId] += routeWage;
              if (dateStr) {
                workDaysByDriverId[driverId].add(dateStr);
              }
            });
          }

          // Check Stage 3 for driver assignments
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
          } catch (e) {
            console.error('Error parsing stage3 data:', e);
          }

          if (!stage3Data) return;

          // Check both stage3Data.airportGroups and stage3Data.summaryData.airportGroups
          const airportGroups = stage3Data.summaryData?.airportGroups || stage3Data.airportGroups || {};
          const products = stage3Data.products || [];

          // Also check driverAssignments from summaryData
          const driverAssignments = stage3Data.summaryData?.driverAssignments || [];
          
          // Process driverAssignments if available
          driverAssignments.forEach(assignment => {
            const driverName = assignment.driver || '';
            if (!driverName) return;

            // Extract driver name (format might be "Name - DRV-001")
            const nameParts = driverName.split(' - ');
            const cleanDriverName = nameParts[0].trim();

            const driver = drivers.find(d => 
              (d.driver_name || '').toLowerCase() === cleanDriverName.toLowerCase() ||
              (d.driver_id || '').toLowerCase() === (nameParts[1] || '').toLowerCase() ||
              String(d.did) === String(assignment.driverId || '')
            );

            if (!driver) return;

            const driverId = String(driver.did);
            if (!wagesByDriverId[driverId]) {
              wagesByDriverId[driverId] = 0;
              workDaysByDriverId[driverId] = new Set();
            }
            // Count this as a work day
            if (dateStr) {
              workDaysByDriverId[driverId].add(dateStr);
            }
          });

          // Process airport groups
          Object.values(airportGroups).forEach(group => {
            // Check driver at group level
            let driverName = group.driver || group.driverName || '';
            
            // Also check products within the group for driver assignments
            if (!driverName && group.products && Array.isArray(group.products)) {
              for (const product of group.products) {
                const productDriver = product.driver || product.selectedDriver || product.driverName || '';
                if (productDriver) {
                  driverName = productDriver;
                  break; // Use first driver found in products
                }
              }
            }
            
            if (!driverName) return;

            // Find driver by name - try multiple matching strategies
            let driver = null;
            
            // Try exact name match
            driver = drivers.find(d => 
              (d.driver_name || '').toLowerCase() === driverName.toLowerCase()
            );
            
            // If not found, try matching with driver ID format "Name - DRV-001"
            if (!driver && driverName.includes(' - ')) {
              const nameParts = driverName.split(' - ');
              const cleanName = nameParts[0].trim();
              const driverIdPart = nameParts[1]?.trim();
              
              driver = drivers.find(d => 
                (d.driver_name || '').toLowerCase() === cleanName.toLowerCase() ||
                (d.driver_id || '').toLowerCase() === driverIdPart?.toLowerCase()
              );
            }
            
            // If still not found, try partial name match
            if (!driver) {
              driver = drivers.find(d => 
                (d.driver_name || '').toLowerCase().includes(driverName.toLowerCase()) ||
                driverName.toLowerCase().includes((d.driver_name || '').toLowerCase())
              );
            }

            if (!driver) {
              console.warn(`Driver not found for name: ${driverName}`);
              return;
            }

            const driverId = String(driver.did);
            const driverWage = parseFloat(group.driverWage || group.pickupCost || 0) || 0;

            if (!wagesByDriverId[driverId]) {
              wagesByDriverId[driverId] = 0;
              workDaysByDriverId[driverId] = new Set();
            }

            wagesByDriverId[driverId] += driverWage;
            if (dateStr) {
              workDaysByDriverId[driverId].add(dateStr);
            }
          });

          // Also check products array for driver assignments
          products.forEach(product => {
            let driverName = product.selectedDriver || product.driver || product.driverName || '';
            
            // If selectedDriver is a number/ID, try to find driver by did
            if (!driverName && product.selectedDriver) {
              const driverById = drivers.find(d => String(d.did) === String(product.selectedDriver));
              if (driverById) {
                driverName = driverById.driver_name;
              }
            }
            
            if (!driverName) return;

            // Find driver by name or ID - try multiple strategies
            let driver = null;
            
            // If it's a number, try to find by did
            if (!isNaN(driverName)) {
              driver = drivers.find(d => String(d.did) === String(driverName));
            }
            
            // Try by driver_id if it contains DRV-
            if (!driver && typeof driverName === 'string' && driverName.includes('DRV-')) {
              driver = drivers.find(d => 
                (d.driver_id || '').toLowerCase() === driverName.toLowerCase()
              );
            }
            
            // Try exact name match
            if (!driver) {
              driver = drivers.find(d => 
                (d.driver_name || '').toLowerCase() === driverName.toLowerCase()
              );
            }
            
            // Try matching with "Name - DRV-001" format
            if (!driver && driverName.includes(' - ')) {
              const nameParts = driverName.split(' - ');
              const cleanName = nameParts[0].trim();
              const driverIdPart = nameParts[1]?.trim();
              
              driver = drivers.find(d => 
                (d.driver_name || '').toLowerCase() === cleanName.toLowerCase() ||
                (d.driver_id || '').toLowerCase() === driverIdPart?.toLowerCase()
              );
            }
            
            // Try partial match as last resort
            if (!driver) {
              driver = drivers.find(d => 
                (d.driver_name || '').toLowerCase().includes(driverName.toLowerCase()) ||
                driverName.toLowerCase().includes((d.driver_name || '').toLowerCase())
              );
            }

            if (!driver) {
              console.warn(`Driver not found for product assignment: ${driverName}`);
              return;
            }

            const driverId = String(driver.did);
            const driverWage = parseFloat(product.driverWage || product.pickupCost || 0) || 0;

            if (!wagesByDriverId[driverId]) {
              wagesByDriverId[driverId] = 0;
              workDaysByDriverId[driverId] = new Set();
            }

            wagesByDriverId[driverId] += driverWage;
            if (dateStr) {
              workDaysByDriverId[driverId].add(dateStr);
            }
          });
        } catch (error) {
          console.error(`Error processing order ${order.oid} for driver payouts:`, error);
        }
      });

      await Promise.all(assignmentPromises);

      // Fetch daily-payouts paid records per driver (backend may only return when entity_id is set)
      const dailyPaidByDriver = drivers.length > 0
        ? await Promise.all(
            drivers.map((d) =>
              getDailyPaidRecords('driver', { entity_id: String(d.did ?? d.id ?? '') }).catch(() => ({ data: [] }))
            )
          )
        : [dailyPaidRes];

      let dailyPaidMerged = dailyPaidRes?.data ?? dailyPaidRes?.paidRecords ?? dailyPaidRes?.records ?? (Array.isArray(dailyPaidRes) ? dailyPaidRes : []);
      dailyPaidByDriver.forEach((res) => {
        const list = res?.data ?? res?.paidRecords ?? res?.records ?? (Array.isArray(res) ? res : []);
        dailyPaidMerged = dailyPaidMerged.concat(list);
      });

      const toDriverPaidKey = (item) => {
        const rowData = parseRowData(item);
        const refKey = item?.reference_key ?? item?.key ?? rowData?.key ?? (typeof item === 'string' ? item : null);
        const datePart = item?.date ?? item?.reference_date ?? rowData?.date ?? refKey;
        const entityId = item?.entity_id ?? rowData?.entity_id ?? rowData?.driverId;
        if (refKey && refKey.includes('_')) return refKey;
        if (datePart && entityId != null && entityId !== '') return `${datePart}_${entityId}`;
        if (refKey) return refKey;
        if (datePart && entityId != null) return `${datePart}_${entityId}`;
        return null;
      };

      let paidSet = new Set();
      const paidRecordMap = {};
      try {
        const paidList = paidRes?.data ?? paidRes?.paidRecords ?? paidRes?.records ?? (Array.isArray(paidRes) ? paidRes : []);
        paidList.forEach((item) => {
          const k = toDriverPaidKey(item);
          if (k) {
            paidSet.add(k);
            paidRecordMap[k] = item;
          }
        });
        const dailyPaidList = dailyPaidMerged;
        dailyPaidList.forEach((item) => {
          const k = toDriverPaidKey(item);
          if (k) {
            paidSet.add(k);
            if (!paidRecordMap[k]) paidRecordMap[k] = item;
          }
        });
        const stored = localStorage.getItem(STORAGE_KEY_ALL);
        if (stored) JSON.parse(stored).forEach((k) => paidSet.add(k));
      } catch {
        // ignore
      }

      // All driver IDs that have any activity (work days, fuel, excess, advance)
      const allDriverIds = new Set([
        ...Object.keys(wagesByDriverId),
        ...Object.keys(workDaysByDriverId),
        ...Object.keys(fuelByDriverByDate),
        ...Object.keys(advanceByDriverByDate),
        ...Object.keys(excessKMByDriverByDate)
      ]);

      let allRows = [];

      Array.from(allDriverIds).forEach((driverId) => {
        const driver = driverMap.get(driverId);
        if (!driver) return;

        const deliveryType = (driver.deliveryType || driver.delivery_type || 'collection').toLowerCase();
        let driverRate = ratesMap[deliveryType] || ratesMap['airport'] || ratesMap['collection'] || 0;
        if (!driverRate && driverRates.length > 0) {
          const activeRate = driverRates.find(r => r.status === 'Active');
          if (activeRate) driverRate = parseFloat(activeRate.amount || activeRate.rate || 0) || 0;
        }
        if (!driverRate && driver.daily_wage) driverRate = parseFloat(driver.daily_wage || driver.dailyWage || 0) || 0;
        if (!driverRate) driverRate = 0;

        let driverKmLimit = kmLimitMap[deliveryType] || kmLimitMap['airport'] || kmLimitMap['collection'] || 0;
        if (!driverKmLimit && driverRates.length > 0) {
          const activeRate = driverRates.find(r => r.status === 'Active');
          if (activeRate) driverKmLimit = parseFloat(activeRate.kilometers ?? activeRate.kilometer ?? activeRate.km ?? 0) || 0;
        }

        const orderWorkDays = workDaysByDriverId[driverId] || new Set();
        const fuelDates = Object.keys(fuelByDriverByDate[driverId] || {});
        const advanceDates = Object.keys(advanceByDriverByDate[driverId] || {});
        const excessDates = Object.keys(excessKMByDriverByDate[driverId] || {});
        const excessDistanceDates = Object.keys(excessDistanceByDriverByDate[driverId] || {});
        const startKMDates = Object.keys(startKMByDriverByDate[driverId] || {});
        const endKMDates = Object.keys(endKMByDriverByDate[driverId] || {});

        const allDates = new Set([
          ...orderWorkDays,
          ...fuelDates,
          ...advanceDates,
          ...excessDates,
          ...excessDistanceDates,
          ...startKMDates,
          ...endKMDates
        ]);

        Array.from(allDates)
          .sort()
          .reverse()
          .forEach((dateStr) => {
            const basePay = driverRate;
            const fuel = (fuelByDriverByDate[driverId] || {})[dateStr] || 0;
            const advancePay = (advanceByDriverByDate[driverId] || {})[dateStr] || 0;
            const startKM = (startKMByDriverByDate[driverId] || {})[dateStr];
            const endKM = (endKMByDriverByDate[driverId] || {})[dateStr];
            const unitPrice = (fuelUnitPriceByDriverByDate[driverId] || {})[dateStr] || 0;
            const savedAmount = (excessKMByDriverByDate[driverId] || {})[dateStr] || 0;
            const kmPay = computeDriverDayKmPayout({
              startKM,
              endKM,
              savedAmount,
              explicitExcessKm: (excessDistanceByDriverByDate[driverId] || {})[dateStr] || 0,
              kilometersFromRecord: (kilometersFieldByDriverByDate[driverId] || {})[dateStr] || 0,
              kmLimit: driverKmLimit,
              fuelUnitPrice: unitPrice,
              freeKmFallback: DEFAULT_FREE_KM,
            });

            const key = `${dateStr}_${driverId}`;
            const paymentRecord = paidRecordMap[key];
            const totalPayout = basePay - fuel - advancePay + kmPay.excessKMPrice;
            const status = getPayoutStatus({ paymentRecord, key, paidSet, totalPayout });
            const partialPaidAmount = getPartialPaidAmount(paymentRecord);
            const remainingAmount = status === 'Partial' ? Math.max(totalPayout - partialPaidAmount, 0) : 0;

            allRows.push({
              key,
              driverId,
              driverName: driver.driver_name || 'Unknown Driver',
              driverCode: driver.driver_id || `DRV-${driverId}`,
              vehicle: driver.vehicle_number || 'N/A',
              date: dateStr,
              basePay,
              fuelExpenses: fuel,
              startKM,
              endKM,
              totalKM: kmPay.totalKM,
              excessKM: kmPay.excessKM,
              excessKMPrice: kmPay.excessKMPrice,
              hasKmRecord: kmPay.hasKmRecord,
              excessKMRecordId: (excessKMRecordByDriverByDate[driverId] || {})[dateStr] || null,
              advancePay,
              totalPayout,
              status,
              partialPaidAmount,
              remainingAmount,
              paymentNote: paymentRecord?.row_data?.paymentNote || ''
            });
          });
      });

      if (presentSet.size > 0) {
        allRows = allRows.filter((r) => presentSet.has(r.key) || r.hasKmRecord);
        presentSet.forEach((key) => {
          if (allRows.some((r) => r.key === key)) return;
          const idx = key.indexOf('_');
          const dateStr = key.substring(0, idx);
          const driverId = key.substring(idx + 1);
          const driver = driverMap.get(driverId);
          if (!driver) return;
          const deliveryType = (driver.deliveryType || driver.delivery_type || 'collection').toLowerCase();
          let driverRate = ratesMap[deliveryType] || ratesMap['airport'] || ratesMap['collection'] || 0;
          if (!driverRate && driverRates.length > 0) {
            const activeRate = driverRates.find((r) => r.status === 'Active');
            if (activeRate) driverRate = parseFloat(activeRate.amount || activeRate.rate || 0) || 0;
          }
          if (!driverRate && driver.daily_wage) driverRate = parseFloat(driver.daily_wage || driver.dailyWage || 0) || 0;
          if (!driverRate) driverRate = 0;
          let driverKmLimit = kmLimitMap[deliveryType] || kmLimitMap['airport'] || kmLimitMap['collection'] || 0;
          if (!driverKmLimit && driverRates.length > 0) {
            const activeRate = driverRates.find((r) => r.status === 'Active');
            if (activeRate) driverKmLimit = parseFloat(activeRate.kilometers ?? activeRate.kilometer ?? activeRate.km ?? 0) || 0;
          }
          const fuel = (fuelByDriverByDate[driverId] || {})[dateStr] || 0;
          const advancePay = (advanceByDriverByDate[driverId] || {})[dateStr] || 0;
          const startKM = (startKMByDriverByDate[driverId] || {})[dateStr];
          const endKM = (endKMByDriverByDate[driverId] || {})[dateStr];
          const unitPrice = (fuelUnitPriceByDriverByDate[driverId] || {})[dateStr] || 0;
          const savedAmount = (excessKMByDriverByDate[driverId] || {})[dateStr] || 0;
          const kmPay = computeDriverDayKmPayout({
            startKM,
            endKM,
            savedAmount,
            explicitExcessKm: (excessDistanceByDriverByDate[driverId] || {})[dateStr] || 0,
            kilometersFromRecord: (kilometersFieldByDriverByDate[driverId] || {})[dateStr] || 0,
            kmLimit: driverKmLimit,
            fuelUnitPrice: unitPrice,
            freeKmFallback: DEFAULT_FREE_KM,
          });
          const totalPayout = driverRate - fuel - advancePay + kmPay.excessKMPrice;
          const paymentRecord = paidRecordMap[key];
          const status = getPayoutStatus({ paymentRecord, key, paidSet, totalPayout });
          const partialPaidAmount = getPartialPaidAmount(paymentRecord);
          const remainingAmount = status === 'Partial' ? Math.max(totalPayout - partialPaidAmount, 0) : 0;
          allRows.push({
            key,
            driverId,
            driverName: driver.driver_name || 'Unknown Driver',
            driverCode: driver.driver_id || `DRV-${driverId}`,
            vehicle: driver.vehicle_number || 'N/A',
            date: dateStr,
            basePay: driverRate,
            fuelExpenses: fuel,
            startKM,
            endKM,
            totalKM: kmPay.totalKM,
            excessKM: kmPay.excessKM,
            excessKMPrice: kmPay.excessKMPrice,
            hasKmRecord: kmPay.hasKmRecord,
            excessKMRecordId: (excessKMRecordByDriverByDate[driverId] || {})[dateStr] || null,
            advancePay,
            totalPayout,
            status,
            partialPaidAmount,
            remainingAmount,
            paymentNote: paymentRecord?.row_data?.paymentNote || ''
          });
        });
      }

      allRows.sort((a, b) => {
        const order = { Pending: 0, Partial: 1, Paid: 2 };
        const sa = order[a.status] ?? 0;
        const sb = order[b.status] ?? 0;
        if (sa !== sb) return sa - sb;
        const dateCmp = (b.date || '').localeCompare(a.date || '');
        if (dateCmp !== 0) return dateCmp;
        return (a.driverName || '').localeCompare(b.driverName || '');
      });

      setPayouts(allRows);
    } catch (error) {
      console.error('Error fetching driver payouts:', error);
    } finally {
      setLoading(false);
    }
  };

  const handlePay = async (payout) => {
    const key = payout.key;
    try {
      setMarkingPaid(true);
      const rowData = {
        ...payout,
        key: payout.key,
        id: payout.key,
        reference_key: payout.key,
        entity_id: payout.driverId,
        date: payout.date,
        driverId: payout.driverId,
        driverName: payout.driverName,
        driverCode: payout.driverCode,
        basePay: payout.basePay,
        fuelExpenses: payout.fuelExpenses,
        advancePay: payout.advancePay,
        excessKMPrice: payout.excessKMPrice,
        totalPayout: payout.totalPayout,
        amount: Number(payout.totalPayout) || 0,
        partial_amount: 0,
        partialPaidAmount: 0,
        remainingAmount: 0,
        paymentNote: '',
        paymentStatus: 'Paid',
        status: 'Paid',
      };
      await markAsPaid('driver', rowData);
      await markDailyAsPaid('driver', rowData).catch(() => {});
      setPaidKeys((prev) => new Set([...prev, key]));
      setPayouts((prev) =>
        prev.map((p) =>
          p.key === key
            ? { ...p, status: 'Paid', partialPaidAmount: 0, remainingAmount: 0, paymentNote: '' }
            : p
        )
      );
      const idx = key.indexOf('_');
      const driverId = key.substring(idx + 1);
      if (driverId) {
        try {
          const sk = `driver-daily-paid-${driverId}`;
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
      console.error('Error marking driver payout as paid:', error);
      alert(error?.message || error?.error || 'Failed to mark as paid');
    } finally {
      setMarkingPaid(false);
    }
  };

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
    const alreadyPaid = Number(payout.partialPaidAmount || 0);
    const totalPayout = Number(payout.totalPayout || 0);
    const entered = Number(partialAmount);
    if (!Number.isFinite(entered) || entered <= 0) {
      alert('Enter a valid partial amount');
      return;
    }
    const cumulativePaid = alreadyPaid + entered;
    if (totalPayout > 0 && cumulativePaid >= totalPayout) {
      alert('Total partial paid amount should be less than total payout');
      return;
    }
    try {
      setMarkingPaid(true);
      const rowData = {
        key: payout.key,
        id: payout.key,
        reference_key: payout.key,
        entity_id: payout.driverId,
        date: payout.date,
        driverId: payout.driverId,
        driverName: payout.driverName,
        driverCode: payout.driverCode,
        totalPayout,
        amount: totalPayout,
        partial_amount: entered,
        partial_paid_total: cumulativePaid,
        previous_partial_amount: alreadyPaid,
        note: partialNote
      };
      await markPartialPaid('driver', rowData);
      setPayouts((prev) =>
        prev.map((p) =>
          p.key === payout.key
            ? {
                ...p,
                status: 'Partial',
                partialPaidAmount: cumulativePaid,
                remainingAmount: Math.max((Number(p.totalPayout) || 0) - cumulativePaid, 0),
                paymentNote: partialNote
              }
            : p
        )
      );
      closePartialPaymentModal();
    } catch (error) {
      console.error('Error marking driver payout as partial:', error);
      alert(error?.message || error?.error || 'Failed to save partial payment');
    } finally {
      setMarkingPaid(false);
    }
  };

  const formatNum = (n) =>
    Number.isFinite(n) ? n.toLocaleString('en-IN', { maximumFractionDigits: 0 }) : '0';

  const handleRevert = async (payout) => {
    try {
      setMarkingPaid(true);
      await unmarkAsPaid('driver', { key: payout.key, id: payout.key, reference_key: payout.key });
      setPayouts((prev) => prev.map((p) => (p.key === payout.key ? { ...p, status: 'Pending', partialPaidAmount: 0, remainingAmount: p.totalPayout } : p)));
    } catch (error) {
      alert(error?.message || error?.error || 'Failed to revert payout');
    } finally {
      setMarkingPaid(false);
    }
  };

  const filteredPayouts = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    return sortPayoutsByStatus(payouts.filter((p) => {
      if (fromDate && (p.date || '') < fromDate) return false;
      if (toDate && (p.date || '') > toDate) return false;
      if (selectedDriverId && String(p.driverId) !== selectedDriverId) return false;
      if (!query) return true;
      return (
        (p.driverName || '').toLowerCase().includes(query) ||
        (p.driverCode || '').toLowerCase().includes(query) ||
        (p.vehicle || '').toLowerCase().includes(query) ||
        (p.date || '').toLowerCase().includes(query)
      );
    }));
  }, [payouts, searchQuery, fromDate, toDate, selectedDriverId]);

  const totalPending = useMemo(
    () => filteredPayouts.filter((p) => p.status === 'Pending').reduce((sum, p) => sum + (p.totalPayout || 0), 0),
    [filteredPayouts]
  );

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

  const confirmPayAll = async () => {
    const pending = payAllSelected;
    if (pending.length === 0) return;
    try {
      setMarkingPaid(true);
      const paidKeyList = [];
      for (const payout of pending) {
        const key = payout.key;
        const rowData = {
          ...payout,
          key,
          id: key,
          reference_key: key,
          entity_id: payout.driverId,
          date: payout.date,
          driverId: payout.driverId,
          driverName: payout.driverName,
          driverCode: payout.driverCode,
          basePay: payout.basePay,
          fuelExpenses: payout.fuelExpenses,
          advancePay: payout.advancePay,
          excessKMPrice: payout.excessKMPrice,
          totalPayout: payout.totalPayout,
          amount: Number(payout.totalPayout) || 0,
          partial_amount: 0,
          partialPaidAmount: 0,
          remainingAmount: 0,
          paymentNote: '',
          paymentStatus: 'Paid',
          status: 'Paid',
        };
        await markAsPaid('driver', rowData);
        await markDailyAsPaid('driver', rowData).catch(() => {});
        paidKeyList.push(key);
        const idx = key.indexOf('_');
        const driverId = key.substring(idx + 1);
        if (driverId) {
          try {
            const sk = `driver-daily-paid-${driverId}`;
            const stored = localStorage.getItem(sk);
            const set = new Set(stored ? JSON.parse(stored) : []);
            set.add(key);
            localStorage.setItem(sk, JSON.stringify([...set]));
          } catch {
            // ignore
          }
        }
      }
      try {
        const stored = localStorage.getItem(STORAGE_KEY_ALL);
        const list = stored ? JSON.parse(stored) : [];
        paidKeyList.forEach((key) => {
          if (!list.includes(key)) list.push(key);
        });
        localStorage.setItem(STORAGE_KEY_ALL, JSON.stringify(list));
      } catch {
        // ignore
      }
      setPaidKeys((prev) => {
        const next = new Set(prev);
        paidKeyList.forEach((key) => next.add(key));
        return next;
      });
      setPayouts((prev) =>
        prev.map((p) =>
          pending.some((x) => x.key === p.key)
            ? { ...p, status: 'Paid', partialPaidAmount: 0, remainingAmount: 0, paymentNote: '' }
            : p
        )
      );
      closePayAllModal(false);
    } catch (error) {
      alert(error?.message || error?.error || 'Failed to pay all');
    } finally {
      setMarkingPaid(false);
    }
  };

  const handleExportExcel = () => {
    if (filteredPayouts.length === 0) {
      alert('No payout data to export.');
      return;
    }
    const data = filteredPayouts.map((p) => ({
      Date: new Date((p.date || '') + 'T12:00:00').toLocaleDateString('en-GB'),
      'Driver Name': p.driverName,
      'Driver ID': p.driverCode,
      Vehicle: p.vehicle,
      'Base Pay': p.basePay,
      'Fuel Expenses': p.fuelExpenses,
      'Start KM': p.startKM,
      'End KM': p.endKM,
      'Total KM': p.totalKM ?? getTotalDrivenKM(p.startKM, p.endKM),
      'Excess KM': p.excessKM,
      'Excess KM Price': p.excessKMPrice,
      'Advance Pay': p.advancePay,
      'Total Payout': p.totalPayout,
      Status: p.status
    }));
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(data);
    XLSX.utils.book_append_sheet(wb, ws, 'Driver Payouts');
    XLSX.writeFile(wb, `Driver_Payouts_${new Date().toISOString().split('T')[0]}.xlsx`, { bookType: 'xlsx', cellStyles: true });
  };

  const handleExportPDF = () => {
    if (filteredPayouts.length === 0) {
      alert('No payout data to export.');
      return;
    }
    const doc = new jsPDF('p', 'pt', 'a4');
    doc.setFillColor(13, 92, 77);
    doc.rect(0, 0, 595, 50, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(18);
    doc.setFont(undefined, 'bold');
    doc.text('Driver Payouts', 297.5, 30, { align: 'center' });
    doc.setFontSize(10);
    doc.setFont(undefined, 'normal');
    let subtitle = `Generated on: ${new Date().toLocaleDateString('en-GB')}`;
    if (fromDate) subtitle += ` | From: ${fromDate}`;
    if (toDate) subtitle += ` | To: ${toDate}`;
    if (selectedDriverId) {
      const d = driverOptions.find((x) => String(x.did) === selectedDriverId);
      if (d) subtitle += ` | Driver: ${d.driver_name || d.driver_id}`;
    }
    doc.text(subtitle, 297.5, 42, { align: 'center' });
    const tableBody = filteredPayouts.map((p) => [
      new Date((p.date || '') + 'T12:00:00').toLocaleDateString('en-GB'),
      p.driverName,
      p.driverCode,
      `Rs. ${formatNum(p.basePay)}`,
      `Rs. ${formatNum(p.fuelExpenses)}`,
      `Rs. ${formatNum(p.totalPayout)}`,
      p.status
    ]);
    const tableHeaders = [['Date', 'Driver', 'ID', 'Base Pay', 'Fuel', 'Total Payout', 'Status']];
    doc.autoTable({
      startY: 60,
      head: tableHeaders,
      body: tableBody,
      theme: 'grid',
      headStyles: { fillColor: [13, 92, 77], textColor: 255, fontStyle: 'bold', halign: 'center' },
      bodyStyles: { fontSize: 9, halign: 'center' },
      alternateRowStyles: { fillColor: [240, 253, 244] }
    });
    doc.save(`Driver_Payouts_${new Date().toISOString().split('T')[0]}.pdf`);
  };

  const totalPages = calcPayoutTotalPages(filteredPayouts.length, ITEMS_PER_PAGE);
  const paginatedPayouts = getPayoutPageSlice(filteredPayouts, currentPage, ITEMS_PER_PAGE);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, fromDate, toDate, selectedDriverId]);

  const summaryStats = useMemo(() => {
    const totalPayouts = payouts.length;
    const totalAmount = payouts.reduce((sum, p) => sum + (p.totalPayout || 0), 0);
    const uniqueDrivers = new Set(payouts.map((p) => p.driverId)).size;
    return { totalPayouts, totalAmount, activeDrivers: uniqueDrivers };
  }, [payouts]);

  const stats = [
    { label: 'Total Payouts', value: summaryStats.totalPayouts.toString(), change: '' },
    { label: 'Active Drivers', value: summaryStats.activeDrivers.toString(), change: '' },
    { label: 'Total Amount', value: formatCurrency(summaryStats.totalAmount), change: '' },
    { label: 'Total Pending (filtered)', value: formatCurrency(totalPending), change: '' }
  ];

  const getStatusColor = (status) => {
    if (status === 'Paid') {
      return 'bg-emerald-100 text-emerald-700';
    }
    if (status === 'Partial') {
      return 'bg-blue-100 text-blue-700';
    }
    return 'bg-yellow-100 text-yellow-700';
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
            onClick={() => navigate('/payout-labour')}
            className="px-5 py-2.5 rounded-lg font-medium transition-all text-sm bg-white text-gray-600 hover:bg-gray-50 border border-gray-200"
          >
            Labour Payout
          </button>
          <button
            className="px-5 py-2.5 rounded-lg font-medium transition-all text-sm bg-[#0D7C66] text-white shadow-md"
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
                index === 2 || index === 3 
                  ? 'bg-white/20 text-white' 
                  : 'bg-white/60 text-[#0D5C4D]'
              }`}>
                {stat.change}
              </div>
            </div>
          ))}
        </div>

        <p className="text-sm text-[#6B8782] mb-3">
          Start KM, End KM, and Excess Price are loaded from each driver&apos;s{' '}
          <strong className="text-[#0D5C4D]">Start KM / End KM</strong> records for that date
          (Driver Details → Start KM/End KM). Update KM there, then refresh this list.
        </p>

        <div className="flex flex-wrap items-center gap-2 mb-3">
          <button
            type="button"
            onClick={() => fetchDriverPayouts()}
            disabled={loading}
            className="px-4 py-2 text-sm font-medium rounded-lg border border-[#D0E0DB] bg-white text-[#0D5C4D] hover:bg-[#F0F4F3] disabled:opacity-50"
          >
            {loading ? 'Refreshing…' : 'Refresh payouts'}
          </button>
        </div>

        <PayoutFilterBar
          idPrefix="driver-payout"
          searchValue={searchQuery}
          onSearchChange={setSearchQuery}
          searchPlaceholder="Name, ID, vehicle..."
          fromDate={fromDate}
          onFromDateChange={setFromDate}
          toDate={toDate}
          onToDateChange={setToDate}
          entityFilter={{
            label: 'Driver',
            value: selectedDriverId,
            onChange: setSelectedDriverId,
            options: [
              { value: '', label: 'All drivers' },
              ...driverOptions.map((d) => ({
                value: String(d.did),
                label: d.driver_name || d.driver_id || `Driver ${d.did}`,
              })),
            ],
          }}
          onClear={() => {
            setFromDate('');
            setToDate('');
            setSelectedDriverId('');
            setSearchQuery('');
          }}
          onPayAll={openPayAllModal}
          payAllDisabled={payAllTargets.length === 0}
          payAllLoading={markingPaid}
          onExportPDF={handleExportPDF}
          onExportExcel={handleExportExcel}
        />

        {/* Driver Payouts Table */}
        <div className={payoutTableWrap}>
          <div className={payoutTableScroll}>
            <table className={`${payoutTableBase} min-w-[1480px]`}>
              <colgroup>
                <col style={{ width: '11rem' }} />
                <col style={{ width: '6.5rem' }} />
                <col style={{ width: '5.5rem' }} />
                <col style={{ width: '5.5rem' }} />
                <col style={{ width: '5.5rem' }} />
                <col style={{ width: '5rem' }} />
                <col style={{ width: '5rem' }} />
                <col style={{ width: '5.5rem' }} />
                <col style={{ width: '5.5rem' }} />
                <col style={{ width: '6.5rem' }} />
                <col style={{ width: '5.5rem' }} />
                <col style={{ width: '6rem' }} />
                <col style={{ width: '7.5rem' }} />
                <col style={{ width: '18.5rem' }} />
              </colgroup>
              <thead className={payoutThead}>
                <tr>
                  <th className={`${driverTh} text-left`}>Driver</th>
                  <th className={`${driverTh} text-left`}>ID</th>
                  <th className={`${driverTh} text-left`}>Date</th>
                  <th className={`${driverTh} text-right`}>Base Pay</th>
                  <th className={`${driverTh} text-right`}>Fuel</th>
                  <th className={`${driverTh} text-center`}>Start KM</th>
                  <th className={`${driverTh} text-center`}>End KM</th>
                  <th className={`${driverTh} text-center`}>Total KM</th>
                  <th className={`${driverTh} text-center`}>Excess KM</th>
                  <th className={`${driverTh} text-right`}>Excess Price</th>
                  <th className={`${driverTh} text-right`}>Advance</th>
                  <th className={`${driverTh} text-right`}>Total</th>
                  <th className={`${driverTh} text-center`}>Status</th>
                  <th className={`${driverTh} text-center`}>Action</th>
                </tr>
              </thead>
              <tbody className={payoutTbody}>
                {loading ? (
                  <tr>
                    <td colSpan={14} className={payoutEmptyCell}>
                      Loading driver payouts...
                    </td>
                  </tr>
                ) : paginatedPayouts.length === 0 ? (
                  <tr>
                    <td colSpan={14} className={payoutEmptyCell}>
                      No driver payouts found
                    </td>
                  </tr>
                ) : (
                  paginatedPayouts.map((payout, index) => (
                    <tr
                      key={payout.key}
                      className={payoutRow(index)}
                    >
                      <td className={driverTd}>
                        <div className="font-semibold leading-snug">{payout.driverName}</div>
                        <div className="text-xs text-[#6B8782] mt-0.5 truncate max-w-[10rem]">
                          {payout.vehicle || '—'}
                        </div>
                      </td>
                      <td className={`${driverTd} font-medium whitespace-nowrap`}>{payout.driverCode}</td>
                      <td className={`${driverTd} whitespace-nowrap`}>
                        {payout.date ? new Date(payout.date + 'T12:00:00').toLocaleDateString('en-GB') : '—'}
                      </td>
                      <td className={driverTdNum}>₹{formatNum(payout.basePay)}</td>
                      <td className={`${driverTdNum} text-red-600`}>-₹{formatNum(payout.fuelExpenses)}</td>
                      <td className={driverTdKm}>
                        {payout.startKM != null ? `${formatNum(payout.startKM)}` : '—'}
                      </td>
                      <td className={driverTdKm}>
                        {payout.endKM != null ? `${formatNum(payout.endKM)}` : '—'}
                      </td>
                      <td className={driverTdKm}>
                        {(payout.totalKM ?? getTotalDrivenKM(payout.startKM, payout.endKM)) != null
                          ? formatNum(payout.totalKM ?? getTotalDrivenKM(payout.startKM, payout.endKM))
                          : '—'}
                      </td>
                      <td className={driverTdKm}>
                        {payout.excessKM != null && payout.excessKM > 0 ? formatNum(payout.excessKM) : '—'}
                      </td>
                      <td className={driverTdNum}>
                        {payout.hasKmRecord ? (
                          <span className="font-semibold text-[#047857]">
                            ₹{formatNum(payout.excessKMPrice)}
                          </span>
                        ) : (
                          <span className="text-[#6B8782]">—</span>
                        )}
                      </td>
                      <td className={`${driverTdNum} text-red-600`}>-₹{formatNum(payout.advancePay)}</td>
                      <td className={`${driverTdNum} font-bold`}>₹{formatNum(payout.totalPayout)}</td>
                      <td className={`${driverTd} text-center`}>
                        <span
                          className={`inline-flex px-2.5 py-1 rounded-full text-xs font-semibold ${getPayoutStatusClassName(payout.status)}`}
                        >
                          {payout.status}
                        </span>
                        {payout.status === 'Partial' && (
                          <div className="mt-1 text-[10px] text-[#6B8782] leading-tight">
                            Paid ₹{formatNum(payout.partialPaidAmount || 0)}
                            <br />
                            Bal ₹{formatNum(payout.remainingAmount || 0)}
                          </div>
                        )}
                      </td>
                      <td className={`${driverTd} text-center whitespace-nowrap`}>
                        <div className={payoutActionRow}>
                          <button
                            type="button"
                            onClick={() => navigate(`/drivers/${payout.driverId}/daily-payout`)}
                            className={driverBtn.ghost}
                          >
                            View
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              navigate('/start-end-km-management', {
                                state: { driverId: payout.driverId },
                              })
                            }
                            className={driverBtn.ghost}
                            title="Edit Start/End KM for this driver"
                          >
                            KM
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              navigate('/advance-pay-management', {
                                state: { driverId: payout.driverId, date: payout.date },
                              })
                            }
                            className={driverBtn.advance}
                          >
                            Advance
                          </button>
                          {payout.status === 'Pending' ? (
                            <>
                              <button
                                type="button"
                                onClick={() => openPartialPaymentModal(payout)}
                                disabled={markingPaid}
                                className={driverBtn.partial}
                              >
                                Partial
                              </button>
                              <button
                                type="button"
                                onClick={() => handlePay(payout)}
                                disabled={markingPaid}
                                className={driverBtn.pay}
                              >
                                {markingPaid ? '…' : 'Pay'}
                              </button>
                            </>
                          ) : (
                            <>
                              {payout.status === 'Partial' && (
                                <button
                                  type="button"
                                  onClick={() => handlePay(payout)}
                                  disabled={markingPaid}
                                  className={driverBtn.pay}
                                >
                                  {markingPaid ? '…' : 'Pay'}
                                </button>
                              )}
                              <button
                                type="button"
                                onClick={() => handleRevert(payout)}
                                disabled={markingPaid}
                                className={driverBtn.revert}
                              >
                                Revert
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
          entityColumnLabel="Driver"
          getEntityPrimary={(p) => p.driverName}
          getEntitySecondary={(p) => p.driverCode}
          getRowDate={(p) => p.date}
          getRowKey={resolveKey}
          getBalanceAmount={getBalanceAmount}
          onRemove={removeFromPayAll}
          onClose={() => closePayAllModal(markingPaid)}
          onConfirm={confirmPayAll}
          loading={markingPaid}
        />
        {partialModal.open && partialModal.payout && (
          <div className="fixed inset-0 z-[120] bg-black/40 flex items-center justify-center p-4">
            <div className="w-full max-w-md bg-white rounded-xl border border-[#D0E0DB] shadow-xl p-5">
              <h3 className="text-lg font-semibold text-[#0D5C4D] mb-1">Partial Payment</h3>
              <p className="text-sm text-[#6B8782] mb-4">
                {partialModal.payout.driverName} ({partialModal.payout.driverCode}) - Total: ₹{formatNum(partialModal.payout.totalPayout)}
              </p>
              {Number(partialModal.payout.partialPaidAmount || 0) > 0 && (
                <p className="text-xs text-[#0D5C4D] mb-3">
                  Paid: ₹{formatNum(partialModal.payout.partialPaidAmount || 0)} | Balance: ₹{formatNum(getBalanceAmount(partialModal.payout))}
                </p>
              )}
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-medium text-[#6B8782] mb-1">Partial Amount</label>
                  <input
                    type="number"
                    min="1"
                    step="0.01"
                    value={partialAmount}
                    onChange={(e) => setPartialAmount(e.target.value)}
                    placeholder="Enter amount"
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-[#6B8782] mb-1">Note (optional)</label>
                  <textarea
                    rows={3}
                    value={partialNote}
                    onChange={(e) => setPartialNote(e.target.value)}
                    placeholder="Reason / remark"
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 resize-none"
                  />
                </div>
              </div>
              <div className="flex justify-end gap-2 mt-5">
                <button
                  type="button"
                  onClick={closePartialPaymentModal}
                  className="px-4 py-2 text-sm rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handlePartialPay}
                  disabled={markingPaid}
                  className="px-4 py-2 text-sm rounded-lg bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-50"
                >
                  {markingPaid ? 'Saving...' : 'Save Partial'}
                </button>
              </div>
            </div>
          </div>
        )}
    </div>
  );
};

export default DriverPayoutManagement;