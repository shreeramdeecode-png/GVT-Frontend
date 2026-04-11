import { getAllOrders } from '../api/orderApi';
import { getOrderAssignment } from '../api/orderAssignmentApi';
import { getAllFarmers } from '../api/farmerApi';
import { getAllSuppliers } from '../api/supplierApi';
import { getAllThirdParties } from '../api/thirdPartyApi';
import { getAllLabours } from '../api/labourApi';
import { getAllLabourRates } from '../api/labourRateApi';
import { getAllLabourExcessPay } from '../api/labourExcessPayApi';
import { getAllAttendance } from '../api/labourAttendanceApi';
import { getPaidRecords } from '../api/payoutApi';
import { getPaidRecords as getDailyPaidRecords } from '../api/dailyPayoutsApi';

const cleanForMatching = (name) => {
  if (!name) return '';
  return name.replace(/^\d+\s*-\s*/, '').trim();
};

export const formatInrPayout = (amount) => {
  const value = Number.isFinite(amount) ? amount : 0;
  return `₹${value.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;
};

const mergePaidSet = (paidRes, storageKey) => {
  const paidSet = new Set();
  try {
    const paidList =
      paidRes?.data ?? paidRes?.paidRecords ?? paidRes?.records ?? (Array.isArray(paidRes) ? paidRes : []);
    paidList.forEach((item) => {
      const k =
        item?.reference_key ??
        item?.key ??
        item?.id ??
        (item?.orderId != null && item?.entity_id != null ? `${item.orderId}_${item.entity_id}` : typeof item === 'string' ? item : null);
      if (k) paidSet.add(k);
    });
    if (storageKey) {
      const stored = localStorage.getItem(storageKey);
      if (stored) {
        try {
          JSON.parse(stored).forEach((k) => paidSet.add(k));
        } catch {
          // ignore
        }
      }
    }
  } catch {
    // ignore
  }
  return paidSet;
};

/**
 * Same order/assignment payout rows as PayoutManagement / PayoutSupplier / PayoutThirdParty.
 * @param {'farmer'|'supplier'|'third_party'} kind
 * @returns {{ pendingAmount: number, paidThisMonthAmount: number }}
 */
export async function getOrderEntityPayoutAmounts(kind) {
  const config = {
    farmer: {
      assignmentEntityType: 'farmer',
      paidType: 'farmer',
      storageKey: 'payout-farmer-paid',
      buildMap: (list) => new Map(list.map((e) => [String(e.fid), e]))
    },
    supplier: {
      assignmentEntityType: 'supplier',
      paidType: 'supplier',
      storageKey: 'payout-supplier-paid',
      buildMap: (list) => new Map(list.map((e) => [String(e.sid), e]))
    },
    third_party: {
      assignmentEntityType: 'thirdParty',
      paidType: 'third_party',
      storageKey: null,
      buildMap: (list) => new Map(list.map((e) => [String(e.tpid), e]))
    }
  }[kind];

  if (!config) return { pendingAmount: 0, paidThisMonthAmount: 0 };

  const [ordersRes, entitiesRes, paidRes] = await Promise.all([
    getAllOrders().catch(() => ({ data: [] })),
    (async () => {
      if (kind === 'farmer') {
        const r = await getAllFarmers().catch(() => ({}));
        return r?.data ?? r ?? [];
      }
      if (kind === 'supplier') {
        const r = await getAllSuppliers().catch(() => ({}));
        return r?.data ?? r ?? [];
      }
      const r = await getAllThirdParties().catch(() => ({}));
      return r?.data ?? r ?? [];
    })(),
    getPaidRecords(config.paidType).catch(() => ({ data: [] }))
  ]);

  const orders = ordersRes?.data || [];
  const entities = Array.isArray(entitiesRes) ? entitiesRes : [];
  const entityMap = config.buildMap(entities);
  const paidSet = mergePaidSet(paidRes, config.storageKey);

  const processedPayouts = [];

  const assignmentPromises = orders.map(async (order) => {
    try {
      const assignmentRes = await getOrderAssignment(order.oid).catch(() => null);
      if (!assignmentRes?.data?.product_assignments) return;

      let assignments = [];
      try {
        assignments =
          typeof assignmentRes.data.product_assignments === 'string'
            ? JSON.parse(assignmentRes.data.product_assignments)
            : assignmentRes.data.product_assignments;
      } catch {
        return;
      }

      let stage4ProductRows = [];
      try {
        if (assignmentRes.data?.stage4_data) {
          const stage4Data =
            typeof assignmentRes.data.stage4_data === 'string'
              ? JSON.parse(assignmentRes.data.stage4_data)
              : assignmentRes.data.stage4_data;
          if (stage4Data?.reviewData?.productRows) {
            stage4ProductRows = stage4Data.reviewData.productRows;
          }
        }
      } catch {
        // ignore
      }

      const groups = {};
      assignments.forEach((a) => {
        if (a.entityType !== config.assignmentEntityType || !a.entityId) return;
        const key = String(a.entityId);
        if (!groups[key]) groups[key] = { id: key, assignments: [] };
        groups[key].assignments.push(a);
      });

      Object.values(groups).forEach((group) => {
        const enrichedAssignments = group.assignments.map((a) => {
          const cleanAssignmentProduct = cleanForMatching(a.product);
          let qty = parseFloat(a.assignedQty) || 0;
          if (!qty) {
            const matchingItem = order.items?.find((item) => {
              const itemProduct = item.product_name || item.product || '';
              return cleanForMatching(itemProduct) === cleanAssignmentProduct;
            });
            if (matchingItem) {
              qty = parseFloat(matchingItem.net_weight) || parseFloat(matchingItem.quantity) || 0;
            }
          }
          let price = parseFloat(a.price) || 0;
          if (!price && stage4ProductRows.length > 0) {
            const stage4Entry = stage4ProductRows.find((s4) => {
              const s4Product = cleanForMatching(s4.product || s4.product_name || '');
              const s4AssignedTo = s4.assignedTo || s4.assigned_to || '';
              return s4Product === cleanAssignmentProduct && (s4AssignedTo === a.assignedTo || !a.assignedTo);
            });
            if (stage4Entry) {
              price = parseFloat(stage4Entry.price) || 0;
              if (!qty) {
                qty = parseFloat(stage4Entry.net_weight) || parseFloat(stage4Entry.quantity) || 0;
              }
            }
          }
          return { ...a, assignedQty: qty, price };
        });

        const totalAmount = enrichedAssignments.reduce(
          (sum, a) => sum + (parseFloat(a.assignedQty) || 0) * (parseFloat(a.price) || 0),
          0
        );

        if (totalAmount > 0) {
          const rowId = `${order.oid}_${group.id}`;
          const statusFromOrder = order.payment_status === 'paid' || order.payment_status === 'completed';
          processedPayouts.push({
            amount: totalAmount,
            status: paidSet.has(rowId) ? 'Paid' : statusFromOrder ? 'Paid' : 'Pending',
            lastSupplied: order.order_received_date || order.createdAt
          });
        }
      });
    } catch (err) {
      console.error(`managementPayoutStats order ${order.oid}:`, err);
    }
  });

  await Promise.all(assignmentPromises);

  const now = new Date();
  const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  currentMonthStart.setHours(0, 0, 0, 0);
  const currentMonthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);

  let pendingAmount = 0;
  let paidThisMonthAmount = 0;
  processedPayouts.forEach((p) => {
    if (p.status === 'Pending') pendingAmount += p.amount;
    if (p.status === 'Paid') {
      const d = new Date(p.lastSupplied);
      if (!Number.isNaN(d.getTime()) && d >= currentMonthStart && d <= currentMonthEnd) {
        paidThisMonthAmount += p.amount;
      }
    }
  });

  return { pendingAmount, paidThisMonthAmount };
}

const toDateStr = (val) => {
  if (!val) return '';
  try {
    return new Date(val).toISOString().split('T')[0];
  } catch {
    return String(val).substring(0, 10);
  }
};

const LABOUR_DAYS_BACK = 60;
const STORAGE_KEY_ALL = 'labour-daily-paid';

/**
 * Aligns with PayoutLabour daily rows: pending vs paid this calendar month.
 */
export async function getLabourManagementPayoutAmounts() {
  try {
    const [ordersRes, laboursRes, ratesRes, excessRes, paidRes, dailyPaidRes] = await Promise.all([
      getAllOrders().catch(() => ({ data: [] })),
      getAllLabours(1, 5000).catch(() => ({ data: [] })),
      getAllLabourRates().catch(() => []),
      getAllLabourExcessPay().catch(() => ({ data: [] })),
      getPaidRecords('labour').catch(() => ({ data: [] })),
      getDailyPaidRecords('labour').catch(() => ({ data: [] }))
    ]);

    const orders = Array.isArray(ordersRes) ? ordersRes : ordersRes?.data || [];
    const labours = Array.isArray(laboursRes) ? laboursRes : laboursRes?.data || laboursRes?.labours || [];
    const labourRates = Array.isArray(ratesRes) ? ratesRes : ratesRes?.data || [];
    const excessPays = Array.isArray(excessRes) ? excessRes : excessRes?.data || [];

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
        console.error('managementPayoutStats labour order:', err);
      }
    });

    await Promise.all(assignmentPromises);

    const dailyPaidByLabour =
      labours.length > 0
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

    const end = new Date();
    const start = new Date(end);
    start.setDate(start.getDate() - LABOUR_DAYS_BACK);
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
        rowKeyToLabourName[key] = labour ? labour.full_name || labour.name || '' : l.full_name || l.name || lid;
      });
    });

    const paidSet = new Set();
    try {
      const paidList = paidRes?.data ?? paidRes?.paidRecords ?? paidRes?.records ?? (Array.isArray(paidRes) ? paidRes : []);
      paidList.forEach((item) => {
        const k =
          item?.reference_key ??
          item?.key ??
          (item?.date && item?.entity_id ? `${item.date}_${item.entity_id}` : typeof item === 'string' ? item : null);
        if (k) paidSet.add(k);
      });
      dailyPaidMerged.forEach((item) => {
        const k =
          item?.reference_key ??
          item?.key ??
          (item?.date && item?.entity_id ? `${item.date}_${item.entity_id}` : typeof item === 'string' ? item : null);
        if (k) paidSet.add(k);
      });
      const stored = localStorage.getItem(STORAGE_KEY_ALL);
      if (stored) JSON.parse(stored).forEach((k) => paidSet.add(k));
    } catch {
      // ignore
    }

    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    monthStart.setHours(0, 0, 0, 0);
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);

    let pendingAmount = 0;
    let paidThisMonthAmount = 0;

    Object.keys(rowKeyToWage).forEach((key) => {
      const labourId = rowKeyToLabourId[key] || '';
      const labour = labourMap.get(labourId);
      const workType = (labour?.work_type || 'Normal').trim();
      const dailyWage = (ratesMap[workType] ?? ratesMap['Normal'] ?? parseFloat(labour?.daily_wage)) || 0;
      const [date] = key.split('_');
      const excess = excessByDateAndLabour[key] ?? 0;
      const totalPayout = dailyWage + excess;
      const status = paidSet.has(key) ? 'Paid' : 'Pending';
      const d = new Date(date + 'T12:00:00');
      if (status === 'Pending') pendingAmount += totalPayout;
      if (status === 'Paid' && !Number.isNaN(d.getTime()) && d >= monthStart && d <= monthEnd) {
        paidThisMonthAmount += totalPayout;
      }
    });

    return { pendingAmount, paidThisMonthAmount };
  } catch (e) {
    console.error('getLabourManagementPayoutAmounts:', e);
    return { pendingAmount: 0, paidThisMonthAmount: 0 };
  }
}