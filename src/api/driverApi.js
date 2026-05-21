import api from './axiosConfig';

// Create a new driver with file upload
export const createDriver = async (driverData) => {
  try {
    const response = await api.post('/driver/create', driverData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data;
  } catch (error) {
    throw error.response?.data || error.message;
  }
};

// Get all drivers
export const getAllDrivers = async () => {
  try {
    const response = await api.get('/driver/list');
    return response.data;
  } catch (error) {
    throw error.response?.data || error.message;
  }
};

// Get driver by ID
export const getDriverById = async (id) => {
  try {
    const response = await api.get(`/driver/${id}`);
    return response.data;
  } catch (error) {
    throw error.response?.data || error.message;
  }
};

// Update driver
export const updateDriver = async (id, driverData) => {
  try {
    const response = await api.put(`/driver/${id}`, driverData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return response.data;
  } catch (error) {
    throw error.response?.data || error.message;
  }
};

// Delete driver
export const deleteDriver = async (id) => {
  try {
    const response = await api.delete(`/driver/${id}`);
    return response.data;
  } catch (error) {
    throw error.response?.data || error.message;
  }
};

// Get driver statistics
export const getDriverStats = async () => {
  try {
    const response = await api.get('/driver/stats');
    return response.data;
  } catch (error) {
    throw error.response?.data || error.message;
  }
};

// Get present drivers today
export const getPresentDriversToday = async () => {
  try {
    const response = await api.get('/driver-attendance/present-today');
    return response.data;
  } catch (error) {
    throw error.response?.data || error.message;
  }
};

// --- Driver payout / report KM helpers (from utils) ---

/**
 * Resolve driver did from name, code, or "Name - DRV-xxx" string.
 */
export function resolveDriverDid(drivers, ref) {
  if (ref == null || ref === '') return null;
  const list = drivers || [];
  const str = String(ref).trim();
  if (!str) return null;

  const byDid = list.find((d) => String(d.did) === str);
  if (byDid) return byDid.did;

  const byCode = list.find(
    (d) => String(d.driver_id || '').toLowerCase() === str.toLowerCase()
  );
  if (byCode) return byCode.did;

  const lower = str.toLowerCase();
  const byName = list.find((d) => (d.driver_name || '').toLowerCase() === lower);
  if (byName) return byName.did;

  if (str.includes(' - ')) {
    const parts = str.split(' - ');
    const code = parts[parts.length - 1].trim();
    const name = parts[0].trim().toLowerCase();
    const match = list.find(
      (d) =>
        (d.driver_id || '').toLowerCase() === code.toLowerCase() ||
        (d.driver_name || '').toLowerCase() === name
    );
    if (match) return match.did;
  }

  const partial = list.find(
    (d) =>
      (d.driver_name || '').toLowerCase().includes(lower) ||
      lower.includes((d.driver_name || '').toLowerCase())
  );
  return partial?.did ?? null;
}

/** Calendar date YYYY-MM-DD (avoids UTC off-by-one). */
export function toPayoutDateStr(value) {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) {
    const s = String(value);
    return s.length >= 10 ? s.substring(0, 10) : '';
  }
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

const parseJson = (raw) => {
  if (!raw) return null;
  if (typeof raw === 'object') return raw;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
};

const driverInSummaryGroup = (group, targetDid, drivers) => {
  if (!group || targetDid == null) return false;
  const refs = [group.did, group.driverId, group.driver].filter(Boolean);
  return refs.some((r) => String(resolveDriverDid(drivers, r)) === String(targetDid));
};

const lineAmount = (row) => {
  const price = parseFloat(row.price ?? row.rate ?? 0) || 0;
  const qty =
    parseFloat(row.assignedQty ?? row.pickedQuantity ?? row.quantity ?? row.qty ?? 0) || 0;
  const explicit = parseFloat(row.totalAmount ?? row.total_amount ?? 0) || 0;
  if (explicit > 0) return explicit;
  return price * qty;
};

/**
 * Sum LOCAL GRADE / LOCAL BOX order pay per driver per calendar date.
 * @returns {Record<string, Record<string, { total: number, items: Array<{ orderId: string, amount: number }> }>>}
 */
export function buildLocalOrderPayByDriverByDate(orders, localOrders, drivers) {
  const orderDateByOid = {};
  (orders || []).forEach((o) => {
    const oid = o.oid || o.order_id;
    if (!oid) return;
    orderDateByOid[oid] = toPayoutDateStr(o.order_received_date || o.createdAt || o.created_at);
  });

  const map = {};

  (localOrders || []).forEach((lo) => {
    const oid = lo.order_id || lo.orderId;
    const dateStr = orderDateByOid[oid] || toPayoutDateStr(lo.order?.order_received_date);
    if (!dateStr || !oid) return;

    const summary = parseJson(lo.summary_data);
    const assignments = parseJson(lo.product_assignments) || [];
    const routes = parseJson(lo.delivery_routes) || [];

    const driverGroups = summary?.driverAssignments || [];
    if (!driverGroups.length) return;

    driverGroups.forEach((group) => {
      const did = resolveDriverDid(drivers, group.did || group.driverId || group.driver);
      if (did == null) return;

      const driverKey = String(did);
      let amount = 0;

      const groupOiids = new Set(
        (group.assignments || []).map((a) => String(a.oiid ?? a.id ?? '')).filter(Boolean)
      );

      assignments.forEach((pa) => {
        const paOiid = String(pa.id ?? pa.oiid ?? '');
        if (groupOiids.size && paOiid && !groupOiids.has(paOiid)) return;
        amount += lineAmount(pa);
      });

      if (amount <= 0 && group.assignments?.length) {
        group.assignments.forEach((a) => {
          amount += lineAmount(a);
        });
      }

      if (amount <= 0) {
        routes.forEach((route) => {
          const routeDriver = route.driver || '';
          if (!routeDriver) return;
          if (String(resolveDriverDid(drivers, routeDriver)) !== driverKey) return;
          amount += lineAmount(route);
        });
      }

      if (amount <= 0) return;

      if (!map[driverKey]) map[driverKey] = {};
      if (!map[driverKey][dateStr]) {
        map[driverKey][dateStr] = { total: 0, items: [] };
      }
      map[driverKey][dateStr].total += amount;
      map[driverKey][dateStr].items.push({ orderId: oid, amount });
    });
  });

  return map;
}

export const getTotalDrivenKM = (startKM, endKM) => {
  if (startKM == null || endKM == null) return null;
  const start = Number(startKM);
  const end = Number(endKM);
  if (!Number.isFinite(start) || !Number.isFinite(end)) return null;
  return Math.max(end - start, 0);
};

/**
 * Build per-driver-per-date maps from driver_excess_km (Start/End KM Management).
 */
export function buildExcessKmMapsFromRecords(excessKMs) {
  const amountByDriverByDate = {};
  const recordIdByDriverByDate = {};
  const startKMByDriverByDate = {};
  const endKMByDriverByDate = {};
  const explicitExcessKmByDriverByDate = {};
  const kilometersFieldByDriverByDate = {};

  (excessKMs || []).forEach((km) => {
    const driverId = String(km.driver_id ?? km.did ?? km.driver?.did ?? '');
    const dateStr = toPayoutDateStr(km.date);
    if (!driverId || !dateStr) return;

    const ensure = (map) => {
      if (!map[driverId]) map[driverId] = {};
      return map[driverId];
    };

    const startKm = parseFloat(km.start_km ?? km.startKm ?? 0) || 0;
    const endKm = parseFloat(km.end_km ?? km.endKm ?? 0) || 0;
    const amt = parseFloat(km.amount ?? 0) || 0;
    const explicitExcess = parseFloat(
      km.excess_km ?? km.excessKM ?? km.excess_distance_km ?? km.kilometers ?? 0
    ) || 0;
    const recordId = km.id ?? km.ekmid ?? km.excess_km_id;

    const startMap = ensure(startKMByDriverByDate);
    const endMap = ensure(endKMByDriverByDate);
    const amtMap = ensure(amountByDriverByDate);
    const exMap = ensure(explicitExcessKmByDriverByDate);
    const kmMap = ensure(kilometersFieldByDriverByDate);
    const recMap = ensure(recordIdByDriverByDate);

    if (startKm > 0) {
      startMap[dateStr] =
        startMap[dateStr] != null ? Math.min(startMap[dateStr], startKm) : startKm;
    }
    if (endKm > 0) {
      endMap[dateStr] = endMap[dateStr] != null ? Math.max(endMap[dateStr], endKm) : endKm;
    }
    if (explicitExcess > 0) {
      exMap[dateStr] = (exMap[dateStr] || 0) + explicitExcess;
    }
    const kmField = parseFloat(km.kilometers ?? 0) || 0;
    if (kmField > 0) {
      kmMap[dateStr] = (kmMap[dateStr] || 0) + kmField;
    }
    amtMap[dateStr] = (amtMap[dateStr] || 0) + amt;
    if (recordId && !recMap[dateStr]) {
      recMap[dateStr] = recordId;
    }
  });

  return {
    amountByDriverByDate,
    recordIdByDriverByDate,
    startKMByDriverByDate,
    endKMByDriverByDate,
    explicitExcessKmByDriverByDate,
    kilometersFieldByDriverByDate,
  };
};

/**
 * Excess KM count and pay for one driver-day from profile KM record.
 */
export function computeDriverDayKmPayout({
  startKM,
  endKM,
  savedAmount = 0,
  explicitExcessKm = 0,
  kilometersFromRecord = 0,
  kmLimit = 0,
  fuelUnitPrice = 0,
  freeKmFallback = 100,
}) {
  const totalKM = getTotalDrivenKM(startKM, endKM);
  let excessKM = 0;

  if (explicitExcessKm > 0) {
    excessKM = explicitExcessKm;
  } else if (kilometersFromRecord > 0) {
    excessKM = kilometersFromRecord;
  } else if (totalKM != null) {
    const limit = kmLimit > 0 ? kmLimit : freeKmFallback;
    excessKM = Math.max(totalKM - limit, 0);
  }

  let excessKMPrice = parseFloat(savedAmount) || 0;
  if (excessKMPrice <= 0.01 && fuelUnitPrice > 0 && excessKM > 0) {
    excessKMPrice = excessKM * fuelUnitPrice;
  }

  return {
    totalKM,
    excessKM,
    excessKMPrice: Math.round(excessKMPrice * 100) / 100,
    hasKmRecord: startKM != null && endKM != null,
  };
}

/** Same free-km fallback as Driver Payout (PayoutDriver.jsx). */
const DEFAULT_FREE_KM = 100;

const getFuelUnitPriceForDriverDate = (driverId, dateStr, fuelExpenses) => {
  if (!driverId || !dateStr) return 0;
  let unitPrice = 0;
  (fuelExpenses || []).forEach((expense) => {
    const expenseDriverId =
      expense.driver_id ?? expense.did ?? expense.driver?.did ?? expense.driver?.driver_id;
    if (String(expenseDriverId) !== String(driverId)) return;
    if (toPayoutDateStr(expense.date || expense.expense_date) !== dateStr) return;
    const up = parseFloat(expense.unit_price ?? expense.unitPrice ?? 0) || 0;
    if (up > 0) unitPrice = up;
  });
  return unitPrice;
};

const getDriverKmLimit = (driver, driverRates) => {
  const deliveryType = (driver?.deliveryType || driver?.delivery_type || 'collection').toLowerCase();
  const rates = driverRates || [];
  const match = rates.find(
    (r) => String(r.deliveryType || '').toLowerCase() === deliveryType && r.status === 'Active'
  );
  const airport = rates.find(
    (r) => String(r.deliveryType || '').toLowerCase().includes('airport') && r.status === 'Active'
  );
  const collection = rates.find(
    (r) => String(r.deliveryType || '').toLowerCase().includes('collection') && r.status === 'Active'
  );
  const active = match || airport || collection || rates.find((r) => r.status === 'Active');
  return (
    parseFloat(match?.kilometer ?? match?.kilometers ?? match?.km ?? 0) ||
    parseFloat(airport?.kilometer ?? airport?.kilometers ?? 0) ||
    parseFloat(collection?.kilometer ?? collection?.kilometers ?? 0) ||
    parseFloat(active?.kilometer ?? active?.kilometers ?? active?.km ?? 0) ||
    0
  );
};

/**
 * LOCAL ORDER line for order report — same numbers as Driver Payout for that driver + order date
 * (Start/End KM profile → excessKMPrice on payout screen).
 */
export function getDriverPayoutExcessForReport(
  driverRef,
  orderDate,
  excessKmRecords,
  driverRates,
  fuelExpenses = [],
  drivers = []
) {
  const empty = {
    totalKmDriven: 0,
    excessKm: 0,
    amount: 0,
    startKM: null,
    endKM: null,
  };
  if (!orderDate) return empty;

  const dateStr = toPayoutDateStr(orderDate);
  const did = resolveDriverDid(drivers, driverRef);
  if (did == null || !dateStr) return empty;

  const driverKey = String(did);
  const {
    amountByDriverByDate,
    startKMByDriverByDate,
    endKMByDriverByDate,
    explicitExcessKmByDriverByDate,
    kilometersFieldByDriverByDate,
  } = buildExcessKmMapsFromRecords(excessKmRecords);

  const startKM = startKMByDriverByDate[driverKey]?.[dateStr] ?? null;
  const endKM = endKMByDriverByDate[driverKey]?.[dateStr] ?? null;
  const savedAmount = amountByDriverByDate[driverKey]?.[dateStr] || 0;

  const driver = (drivers || []).find((d) => String(d.did) === driverKey);
  const kmLimit = getDriverKmLimit(driver, driverRates);
  const fuelUnitPrice = getFuelUnitPriceForDriverDate(did, dateStr, fuelExpenses);

  const kmPay = computeDriverDayKmPayout({
    startKM,
    endKM,
    savedAmount,
    explicitExcessKm: explicitExcessKmByDriverByDate[driverKey]?.[dateStr] || 0,
    kilometersFromRecord: kilometersFieldByDriverByDate[driverKey]?.[dateStr] || 0,
    kmLimit,
    fuelUnitPrice,
    freeKmFallback: DEFAULT_FREE_KM,
  });

  return {
    totalKmDriven: kmPay.totalKM != null ? Math.round(kmPay.totalKM * 10) / 10 : 0,
    excessKm: Math.round(kmPay.excessKM * 10) / 10,
    amount: kmPay.excessKMPrice,
    startKM,
    endKM,
  };
}

/** @deprecated Use getDriverPayoutExcessForReport — kept for imports that still reference the old name */
export function getLocalOrderKmExpense(
  driverId,
  orderDate,
  excessKmRecords,
  driverRates,
  fuelExpenses = [],
  drivers = []
) {
  return getDriverPayoutExcessForReport(
    driverId,
    orderDate,
    excessKmRecords,
    driverRates,
    fuelExpenses,
    drivers
  );
}

/** Label for LOCAL ORDER row on order report (amount only; no km subtitle). */
export function formatLocalOrderReportLabel() {
  return 'LOCAL ORDER';
}

export function getLocalOrderReportExpense(
  driverRef,
  orderDate,
  excessKmRecords,
  driverRates,
  fuelExpenses,
  drivers
) {
  return getDriverPayoutExcessForReport(
    driverRef,
    orderDate,
    excessKmRecords,
    driverRates,
    fuelExpenses,
    drivers
  );
}
