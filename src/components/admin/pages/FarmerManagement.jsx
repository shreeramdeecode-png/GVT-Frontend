import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Search,
  Plus,
  MoreVertical,
  ChevronLeft,
  ChevronRight,
  Eye,
  Edit,
  Trash2,
  Download,
  Phone,
  Mail,
  MapPin,
  Loader2
} from 'lucide-react';
import ConfirmDeleteModal from '../../common/ConfirmDeleteModal';
import { getAllFarmers, deleteFarmer } from '../../../api/farmerApi';
import { getVegetableAvailabilityByFarmer } from '../../../api/vegetableAvailabilityApi';
import { fetchAllProducts } from '../../../api/productApi';
import { BASE_URL } from '../../../config/config';
import { getOrderEntityPayoutAmounts, formatInrPayout } from '../../../api/payoutApi';
import * as XLSX from 'xlsx-js-style';

const normalizeProductLabel = (name) => {
  if (!name) return '';
  let s = String(name).replace(/^\d+\s*-\s*/, '').trim();
  const paren = s.indexOf('(');
  if (paren > 0) s = s.slice(0, paren).trim();
  return s.toLowerCase();
};

const productsMatchForFarmerFilter = (orderProduct, availabilityName) => {
  const a = normalizeProductLabel(orderProduct);
  const b = normalizeProductLabel(availabilityName);
  if (!a || !b) return false;
  return a === b || a.includes(b) || b.includes(a);
};

/** YYYY-MM-DD in local calendar (avoids UTC shift on date-only strings). */
export const toLocalDateString = (date) => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

const normalizeDateStr = (value) => {
  if (!value) return '';
  return String(value).split('T')[0].trim();
};

const parseDateOnly = (value) => {
  const str = normalizeDateStr(value);
  if (!str) return null;
  const [y, m, d] = str.split('-').map(Number);
  if (!y || !m || !d) return null;
  const date = new Date(y, m - 1, d);
  return Number.isNaN(date.getTime()) ? null : date;
};

/** Product net weight (kg) from catalog or name e.g. "GINGER 5kg". */
export const parseProductWeightKg = (productName, netWeight) => {
  const fromField = parseFloat(netWeight);
  if (Number.isFinite(fromField) && fromField > 0) return fromField;
  const match = String(productName || '').match(/(\d+(?:\.\d+)?)\s*kg/i);
  return match ? parseFloat(match[1]) : 0;
};

const MS_PER_DAY = 86400000;
const BASE_WEIGHT_KG = 5;

/**
 * Calendar days until availability starts (0 = in range today).
 * Scales lead time by package weight vs 5 kg baseline (heavier → more days).
 */
export const getAvailabilityDaysFromRecord = (item, weightKg = BASE_WEIGHT_KG) => {
  if (!item || item.status !== 'Available') return null;

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const from = parseDateOnly(item.from_date);
  const to = parseDateOnly(item.to_date);
  if (!from || !to) return null;
  if (today > to) return null;

  let calendarDays = 0;
  if (today < from) {
    calendarDays = Math.ceil((from - today) / MS_PER_DAY);
  }

  const w = weightKg > 0 ? weightKg : BASE_WEIGHT_KG;
  if (calendarDays === 0) return 0;
  return Math.max(1, Math.ceil(calendarDays * (w / BASE_WEIGHT_KG)));
};

export const formatAvailabilityDaysLabel = (days) => {
  if (days === null || days === undefined) return 'Not available';
  if (days === 0) return 'Available now';
  if (days === 1) return 'Available in 1 day';
  return `Available in ${days} days`;
};

/** 0 = avail now, 1 = upcoming, 2 = not available */
export const getAvailabilityTier = (days) => {
  if (days === null || days === undefined) return 2;
  if (days === 0) return 0;
  if (days > 0) return 1;
  return 2;
};

/** Available first, then upcoming, then not available at the bottom */
export const sortAvailabilityLines = (lines) => {
  const now = [];
  const upcoming = [];
  const unavailable = [];

  (lines || []).forEach((line) => {
    const tier = line.tier ?? getAvailabilityTier(line.days);
    if (tier === 0) now.push(line);
    else if (tier === 1) upcoming.push(line);
    else unavailable.push(line);
  });

  const byName = (a, b) =>
    String(a.productName || '').localeCompare(String(b.productName || ''));

  now.sort(byName);
  upcoming.sort((a, b) => Number(a.days) - Number(b.days) || byName(a, b));
  unavailable.sort(byName);

  return [...now, ...upcoming, ...unavailable];
};

/** Short badge text for table UI */
export const formatAvailabilityBadge = (days) => {
  if (days === null || days === undefined) return 'Not available';
  if (days === 0) return 'Avail now';
  if (days === 1) return 'Avail in 1 day';
  return `Avail in ${days} days`;
};

/**
 * One line per farmer product: days until available (weight-adjusted), no product name.
 */
export const buildFarmerAvailabilityLines = (items, productList = [], productById = {}) => {
  const availabilityItems = Array.isArray(items) ? items : [];
  const products = Array.isArray(productList) ? productList : [];

  if (!products.length) {
    const dayValues = [];
    availabilityItems.forEach((item) => {
      const weightKg = parseProductWeightKg(item.vegetable_name, null);
      const days = getAvailabilityDaysFromRecord(item, weightKg);
      if (days !== null) dayValues.push(days);
    });
    if (!dayValues.length) return { lines: [], searchTerms: [] };
    const minDays = Math.min(...dayValues);
    const vegName = availabilityItems[0]?.vegetable_name || 'Vegetable';
    const fallbackLines = [
      {
        productName: vegName,
        days: minDays,
        tier: getAvailabilityTier(minDays),
        label: formatAvailabilityDaysLabel(minDays),
        badge: formatAvailabilityBadge(minDays),
      },
    ];
    return {
      lines: sortAvailabilityLines(fallbackLines),
      searchTerms: availabilityItems.map((i) => i.vegetable_name).filter(Boolean),
    };
  }

  const lines = [];
  const searchTerms = [];

  products.forEach((product) => {
    const name = product.product_name || '';
    const catalog = productById[product.product_id] || productById[product.pid];
    const weightKg = parseProductWeightKg(name, catalog?.net_weight);

    const matches = availabilityItems.filter(
      (item) =>
        item.status === 'Available' &&
        productsMatchForFarmerFilter(name, item.vegetable_name)
    );

    matches.forEach((m) => searchTerms.push(m.vegetable_name));

    if (!matches.length) {
      lines.push({
        productName: name,
        days: null,
        tier: 2,
        label: 'Not available',
        badge: 'Not available',
        weightKg,
      });
      return;
    }

    let bestDays = null;
    matches.forEach((item) => {
      const days = getAvailabilityDaysFromRecord(item, weightKg);
      if (days === null) return;
      if (bestDays === null || days < bestDays) bestDays = days;
    });

    const days = bestDays === null ? null : bestDays;
    lines.push({
      productName: name,
      days,
      tier: getAvailabilityTier(days),
      label: formatAvailabilityDaysLabel(days),
      badge: formatAvailabilityBadge(days),
      weightKg,
    });
  });

  return {
    lines: sortAvailabilityLines(lines),
    searchTerms: [...new Set(searchTerms)],
  };
};

/** @deprecated Use buildFarmerAvailabilityLines — kept for any external imports */
export const getAvailabilityInNextDays = (items, days = 5) => {
  if (!items?.length || days < 1) return [];

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const end = new Date(today);
  end.setDate(end.getDate() + days - 1);

  const todayStr = toLocalDateString(today);
  const endStr = toLocalDateString(end);

  const names = new Set();
  items.forEach((item) => {
    if (item.status !== 'Available') return;
    const from = normalizeDateStr(item.from_date);
    const to = normalizeDateStr(item.to_date);
    if (!from || !to) return;
    if (from <= endStr && to >= todayStr) {
      names.add(item.vegetable_name);
    }
  });

  return Array.from(names).sort((a, b) => a.localeCompare(b));
};

const toTitleCase = (value) => {
  if (!value || typeof value !== 'string') return '—';
  const trimmed = value.trim();
  if (!trimmed) return '—';
  return trimmed
    .toLowerCase()
    .split(/\s+/)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
};

const truncateLabel = (text, max = 22) => {
  if (!text) return '';
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
};

const availabilityBadgeClass = (days) => {
  if (days === 0) return 'bg-emerald-100 text-emerald-800 border-emerald-300';
  if (days === null || days === undefined) return 'bg-slate-100 text-slate-500 border-slate-200';
  return 'bg-amber-50 text-amber-900 border-amber-200';
};

const normalizeForSearch = (value) =>
  String(value ?? '')
    .trim()
    .toLowerCase();

const fieldContainsQuery = (fieldValue, queryNorm) => {
  const fieldNorm = normalizeForSearch(fieldValue);
  return fieldNorm.length > 0 && fieldNorm.includes(queryNorm);
};

const farmerMatchesSearch = (farmer, query, availabilityMeta = {}) => {
  const q = normalizeForSearch(query);
  if (!q) return true;

  const productList = Array.isArray(farmer.product_list) ? farmer.product_list : [];
  const productHit = productList.some((p) => fieldContainsQuery(p.product_name, q));
  const searchTerms = availabilityMeta.searchTerms || [];
  const lineLabels = (availabilityMeta.lines || []).map((line) => line.label);
  const lineProducts = (availabilityMeta.lines || []).map((line) => line.productName);
  const availabilityHit =
    searchTerms.some((name) => fieldContainsQuery(name, q)) ||
    lineLabels.some((label) => fieldContainsQuery(label, q)) ||
    lineProducts.some((name) => fieldContainsQuery(name, q));

  return (
    fieldContainsQuery(farmer.farmer_name, q) ||
    fieldContainsQuery(farmer.registration_number, q) ||
    fieldContainsQuery(farmer.phone, q) ||
    fieldContainsQuery(farmer.email, q) ||
    fieldContainsQuery(farmer.city, q) ||
    fieldContainsQuery(farmer.state, q) ||
    fieldContainsQuery(farmer.place, q) ||
    productHit ||
    availabilityHit
  );
};

const Farmers = () => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('all'); // all or orderList
  const [openDropdown, setOpenDropdown] = useState(null);
  const [dropdownPosition, setDropdownPosition] = useState({ top: 0, left: 0 });
  const dropdownRef = useRef(null);
  const [deleteModal, setDeleteModal] = useState({ isOpen: false, farmerId: null, farmerName: '' });
  const [farmers, setFarmers] = useState([]);
  const [allFarmers, setAllFarmers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortOrder, setSortOrder] = useState('recent');
  const itemsPerPage = 7;
  const [payoutStats, setPayoutStats] = useState(null);
  const [availabilityByFarmer, setAvailabilityByFarmer] = useState({});
  const [availabilityLoading, setAvailabilityLoading] = useState(false);
  const [productById, setProductById] = useState({});

  useEffect(() => {
    let cancelled = false;
    getOrderEntityPayoutAmounts('farmer')
      .then((s) => {
        if (!cancelled) setPayoutStats(s);
      })
      .catch(() => {
        if (!cancelled) setPayoutStats({ pendingAmount: 0, paidThisMonthAmount: 0 });
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [farmersResponse, productsResponse] = await Promise.all([
          getAllFarmers(),
          fetchAllProducts()
        ]);

        const products = Array.isArray(productsResponse) ? productsResponse : (productsResponse?.data || []);
        const productMap = {};
        const byId = {};
        products.forEach((p) => {
          productMap[p.pid] = p.product_name;
          byId[p.pid] = p;
        });
        setProductById(byId);

        const farmersData = (farmersResponse.data || []).map(farmer => {
          let productList = [];
          if (typeof farmer.product_list === 'string') {
            try {
              const parsed = JSON.parse(farmer.product_list);
              if (Array.isArray(parsed)) {
                productList = parsed.map(item =>
                  typeof item === 'object' && item.pid
                    ? { product_id: item.pid, product_name: item.product_name }
                    : { product_id: item, product_name: productMap[item] || `Product ${item}` }
                );
              }
            } catch (e) {
              productList = [];
            }
          }
          return { ...farmer, product_list: productList };
        });

        setAllFarmers(farmersData);
      } catch (error) {
        console.error('Failed to fetch data:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  useEffect(() => {
    if (!allFarmers.length) {
      setAvailabilityByFarmer({});
      return undefined;
    }

    let cancelled = false;
    const loadAvailability = async () => {
      setAvailabilityLoading(true);
      const map = {};
      const batchSize = 15;

      for (let i = 0; i < allFarmers.length; i += batchSize) {
        if (cancelled) return;
        const batch = allFarmers.slice(i, i + batchSize);
        await Promise.all(
          batch.map(async (farmer) => {
            try {
              const response = await getVegetableAvailabilityByFarmer(farmer.fid);
              const items = Array.isArray(response?.data) ? response.data : [];
              map[farmer.fid] = buildFarmerAvailabilityLines(
                items,
                farmer.product_list,
                productById
              );
            } catch {
              map[farmer.fid] = { lines: [], searchTerms: [] };
            }
          })
        );
      }

      if (!cancelled) {
        setAvailabilityByFarmer(map);
        setAvailabilityLoading(false);
      }
    };

    loadAvailability();
    return () => {
      cancelled = true;
    };
  }, [allFarmers, productById]);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, sortOrder]);

  useEffect(() => {
    let filtered = [...allFarmers];

    if (searchQuery.trim()) {
      filtered = filtered.filter((farmer) =>
        farmerMatchesSearch(farmer, searchQuery, availabilityByFarmer[farmer.fid] || {})
      );
    }

    if (sortOrder === 'early') {
      filtered.sort((a, b) => a.fid - b.fid);
    } else {
      filtered.sort((a, b) => b.fid - a.fid);
    }

    setTotalPages(Math.ceil(filtered.length / itemsPerPage));
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    setFarmers(filtered.slice(startIndex, endIndex));
  }, [allFarmers, searchQuery, sortOrder, currentPage, availabilityByFarmer]);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setOpenDropdown(null);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const toggleDropdown = (farmerId, event) => {
    if (openDropdown === farmerId) {
      setOpenDropdown(null);
    } else {
      const rect = event.currentTarget.getBoundingClientRect();
      setDropdownPosition({
        top: rect.bottom + window.scrollY + 8,
        left: rect.right + window.scrollX - 128 // 128px is dropdown width (w-32)
      });
      setOpenDropdown(farmerId);
    }
  };

  const handleAction = (action, farmerId, farmerName) => {
    if (action === 'view') {
      navigate(`/farmers/${farmerId}`);
    } else if (action === 'edit') {
      navigate(`/farmers/${farmerId}/edit`);
    } else if (action === 'delete') {
      setDeleteModal({ isOpen: true, farmerId, farmerName });
    }
    setOpenDropdown(null);
  };

  // Export farmers to Excel
  const handleExportFarmers = () => {
    if (allFarmers.length === 0) {
      alert('No farmers to export');
      return;
    }

    // Prepare data for export
    const exportData = allFarmers.map(farmer => ({
      'NAME': farmer.farmer_name || 'N/A',
      'FARM PLACE': farmer.city || 'N/A',
      'CONTACT#': farmer.phone || 'N/A',
      'ACC NAME': farmer.account_holder_name || 'N/A',
      'ACC NUMBER': farmer.account_number || 'N/A',
      'IFS CODE': farmer.IFSC_code || 'N/A',
      'BRANCH': farmer.branch_name || 'N/A'
    }));

    // Create worksheet
    const worksheet = XLSX.utils.json_to_sheet(exportData);

    // Set column widths
    worksheet['!cols'] = [
      { wch: 20 }, // NAME
      { wch: 15 }, // FARM PLACE
      { wch: 15 }, // CONTACT#
      { wch: 25 }, // ACC NAME
      { wch: 20 }, // ACC NUMBER
      { wch: 15 }, // IFS CODE
      { wch: 20 }  // BRANCH
    ];

    // Style header row
    const headerCells = ['A1', 'B1', 'C1', 'D1', 'E1', 'F1', 'G1'];
    headerCells.forEach(cell => {
      if (worksheet[cell]) {
        worksheet[cell].s = {
          font: { bold: true, sz: 11, name: "Calibri", color: { rgb: "FFFFFF" } },
          fill: { fgColor: { rgb: "4472C4" } },
          alignment: { horizontal: "center", vertical: "center" },
          border: {
            top: { style: "thin", color: { rgb: "000000" } },
            bottom: { style: "thin", color: { rgb: "000000" } },
            left: { style: "thin", color: { rgb: "000000" } },
            right: { style: "thin", color: { rgb: "000000" } }
          }
        };
      }
    });

    // Style data rows
    const range = XLSX.utils.decode_range(worksheet['!ref']);
    for (let R = 1; R <= range.e.r; ++R) {
      for (let C = 0; C <= 6; ++C) {
        const cellAddress = XLSX.utils.encode_cell({ r: R, c: C });
        if (worksheet[cellAddress]) {
          worksheet[cellAddress].s = {
            font: { sz: 10, name: "Calibri" },
            alignment: { horizontal: "left", vertical: "center" },
            border: {
              top: { style: "thin", color: { rgb: "000000" } },
              bottom: { style: "thin", color: { rgb: "000000" } },
              left: { style: "thin", color: { rgb: "000000" } },
              right: { style: "thin", color: { rgb: "000000" } }
            }
          };
        }
      }
    }

    // Create workbook and export
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Farmers');
    const fileName = `farmers_list_${new Date().toISOString().split('T')[0]}.xlsx`;
    XLSX.writeFile(workbook, fileName, { bookType: 'xlsx', cellStyles: true });
  };

  const totalFarmers = allFarmers.length;
  const activeFarmers = allFarmers.filter(f => f.status === 'active').length;

  // Pagination: truncated range with ellipsis (e.g. 1 2 ... 9)
  const getPaginationPages = () => {
    if (totalPages <= 5) {
      return Array.from({ length: totalPages }, (_, i) => i + 1);
    }
    const pages = new Set([1, totalPages]);
    for (let i = Math.max(1, currentPage - 1); i <= Math.min(totalPages, currentPage + 1); i++) {
      pages.add(i);
    }
    const sorted = Array.from(pages).sort((a, b) => a - b);
    const result = [];
    for (let i = 0; i < sorted.length; i++) {
      result.push(sorted[i]);
      if (i < sorted.length - 1 && sorted[i + 1] - sorted[i] > 1) {
        result.push('...');
      }
    }
    return result;
  };
  const paginationPages = getPaginationPages();

  const stats = [
    { label: 'Total Farmers', value: totalFarmers.toString(), color: 'bg-gradient-to-r from-[#D1FAE5] to-[#A7F3D0]' },
    { label: 'Active Farmers', value: activeFarmers.toString(), color: 'bg-gradient-to-r from-[#6EE7B7] to-[#34D399]' },
    {
      label: 'Pending Payouts',
      value: payoutStats == null ? '…' : formatInrPayout(payoutStats.pendingAmount),
      color: 'bg-gradient-to-r from-[#10B981] to-[#059669]'
    },
    {
      label: 'Total Paid (Month)',
      value: payoutStats == null ? '…' : formatInrPayout(payoutStats.paidThisMonthAmount),
      color: 'bg-gradient-to-r from-[#047857] to-[#065F46]'
    }
  ];

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      {/* Header with Add Button and Export */}
      <div className="flex items-center justify-end gap-3 mb-6">
        <button
          onClick={handleExportFarmers}
          className="bg-[#1DB890] hover:bg-[#19a57e] text-white px-4 sm:px-6 py-2.5 rounded-lg font-medium text-sm flex items-center gap-2 transition-colors shadow-sm"
        >
          <Download className="w-4 h-4" />
          Export Excel
        </button>
        <button
          onClick={() => navigate('/farmers/add')}
          className="bg-[#0D7C66] hover:bg-[#0a6354] text-white px-4 sm:px-6 py-2.5 rounded-lg font-medium text-sm flex items-center gap-2 transition-colors shadow-sm"
        >
          <Plus className="w-4 h-4" />
          Add Farmer
        </button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        {stats.map((stat, index) => (
          <div
            key={index}
            className={`${stat.color} rounded-2xl p-6 ${index === 2 || index === 3 ? 'text-white' : 'text-[#0D5C4D]'
              }`}
          >
            <div className="text-sm font-medium mb-2 opacity-90">{stat.label}</div>
            <div className="text-4xl font-bold">{stat.value}</div>
          </div>
        ))}
      </div>

      {/* Search Bar and Filter */}
      <div className="flex flex-col sm:flex-row gap-4 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-[#6B8782]" size={20} />
          <input
            type="text"
            placeholder="Search by farmer, product, vegetable, contact, or location..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-12 pr-4 py-3 bg-[#F0F4F3] border-none rounded-xl text-[#0D5C4D] placeholder-[#6B8782] focus:outline-none focus:ring-2 focus:ring-[#0D8568]"
          />
        </div>
        <select
          value={sortOrder}
          onChange={(e) => setSortOrder(e.target.value)}
          className="px-4 py-3 bg-[#F0F4F3] border-none rounded-xl text-[#0D5C4D] focus:outline-none focus:ring-2 focus:ring-[#0D8568] cursor-pointer"
        >
          <option value="early">Early Added</option>
          <option value="recent">Recently Added</option>
        </select>
      </div>

      {/* Farmers Table */}
      <div className="bg-white rounded-2xl overflow-hidden border border-[#D0E0DB] shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 px-6 py-4 border-b border-[#D0E0DB] bg-[#FAFCFB]">
          <div>
            <h2 className="text-base font-semibold text-[#0D5C4D]">Farmer directory</h2>
            <p className="text-xs text-[#6B8782] mt-0.5">
              {loading ? 'Loading…' : `${allFarmers.length} farmers · vegetable availability`}
            </p>
            <p className="text-[10px] text-[#6B8782] mt-1 flex flex-wrap gap-x-3 gap-y-0.5">
              <span className="inline-flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-emerald-500" aria-hidden />
                Avail now = available today
              </span>
              <span className="inline-flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-amber-400" aria-hidden />
                Avail in X days = available after
              </span>
              <span className="inline-flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-slate-300" aria-hidden />
                Not available
              </span>
            </p>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[960px] border-collapse">
            <thead>
              <tr className="bg-[#E8F5F0] border-b border-[#C5DDD4]">
                <th className="px-5 py-3.5 text-left text-[11px] font-semibold uppercase tracking-wider text-[#3D6B5F]">
                  Farmer
                </th>
                <th className="px-5 py-3.5 text-left text-[11px] font-semibold uppercase tracking-wider text-[#3D6B5F] min-w-[280px]">
                  Products &amp; availability
                </th>
                <th className="px-5 py-3.5 text-left text-[11px] font-semibold uppercase tracking-wider text-[#3D6B5F]">
                  Contact
                </th>
                <th className="px-5 py-3.5 text-left text-[11px] font-semibold uppercase tracking-wider text-[#3D6B5F]">
                  Location
                </th>
                <th className="px-5 py-3.5 text-left text-[11px] font-semibold uppercase tracking-wider text-[#3D6B5F]">
                  Status
                </th>
                <th className="px-5 py-3.5 text-right text-[11px] font-semibold uppercase tracking-wider text-[#3D6B5F] w-16">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E8EFEC]">
              {loading ? (
                <tr>
                  <td colSpan="6" className="px-6 py-16 text-center">
                    <Loader2 className="w-8 h-8 text-[#0D7C66] animate-spin mx-auto mb-3" />
                    <p className="text-sm text-[#6B8782]">Loading farmers…</p>
                  </td>
                </tr>
              ) : farmers.length === 0 ? (
                <tr>
                  <td colSpan="6" className="px-6 py-16 text-center text-sm text-[#6B8782]">
                    No farmers match your search.
                  </td>
                </tr>
              ) : farmers.map((farmer) => {
                const availSummary = availabilityByFarmer[farmer.fid] || { lines: [], searchTerms: [] };
                const availLines = sortAvailabilityLines(availSummary.lines || []);
                const isActive = farmer.status === 'active';

                return (
                <tr
                  key={farmer.fid}
                  className="bg-white hover:bg-[#F7FAF9] transition-colors"
                >
                  <td className="px-5 py-4 align-middle">
                    <div className="flex items-center gap-3 min-w-[200px]">
                      <div className="w-11 h-11 rounded-full bg-gradient-to-br from-[#B8F4D8] to-[#7DD3AE] flex items-center justify-center text-[#0D5C4D] font-semibold text-sm overflow-hidden ring-2 ring-white shadow-sm shrink-0">
                        {farmer.profile_image ? (
                          <img
                            src={`${BASE_URL}${farmer.profile_image}`}
                            alt={farmer.farmer_name}
                            className="w-full h-full object-cover"
                            onError={(e) => {
                              e.target.style.display = 'none';
                            }}
                          />
                        ) : (
                          <span>{farmer.farmer_name?.substring(0, 2).toUpperCase()}</span>
                        )}
                      </div>
                      <div className="min-w-0">
                        <div className="font-semibold text-[#0D5C4D] text-sm leading-snug">
                          {toTitleCase(farmer.farmer_name)}
                        </div>
                        <div className="text-[11px] text-[#6B8782] font-mono mt-0.5">
                          {farmer.registration_number || '—'}
                        </div>
                      </div>
                    </div>
                  </td>

                  <td className="px-5 py-4 align-middle">
                    {availabilityLoading ? (
                      <div className="flex items-center gap-2 text-xs text-[#6B8782] min-w-[240px]">
                        <Loader2 className="w-3.5 h-3.5 animate-spin text-[#0D7C66]" />
                        Loading…
                      </div>
                    ) : availLines.length > 0 ? (
                      <div className="min-w-[240px] max-w-[320px]">
                        <div className="hide-scrollbar flex flex-col gap-1.5 mb-2 max-h-[calc(2.5*2.25rem+0.5625rem)] overflow-y-auto overscroll-contain">
                          {availLines.map((line, idx) => (
                            <div
                              key={`${line.productName || 'p'}-${idx}`}
                              className="flex h-9 shrink-0 items-center gap-2 rounded-md bg-[#FAFCFB] border border-[#E8EFEC] px-2"
                              title={`${line.productName || 'Product'} — ${line.label}`}
                            >
                              <span className="flex-1 min-w-0 text-[11px] font-medium text-[#065F46] truncate">
                                {truncateLabel(line.productName || 'Product', 28)}
                              </span>
                              <span
                                className={`shrink-0 px-2 py-0.5 rounded text-[10px] font-semibold whitespace-nowrap border ${availabilityBadgeClass(line.days)}`}
                              >
                                {line.badge ??
                                  (line.days === 0
                                    ? 'Avail now'
                                    : line.days == null
                                      ? 'Not available'
                                      : `Avail in ${line.days} days`)}
                              </span>
                            </div>
                          ))}
                        </div>
                        <button
                          type="button"
                          onClick={() => navigate(`/farmers/${farmer.fid}/vegetable-availability`)}
                          className="text-[11px] font-semibold text-[#0D7C66] hover:text-[#0a6354] hover:underline transition-colors"
                        >
                          Manage availability
                        </button>
                      </div>
                    ) : Array.isArray(farmer.product_list) && farmer.product_list.length > 0 ? (
                      <div className="min-w-[200px]">
                        <p className="text-xs text-[#6B8782] mb-2">
                          {farmer.product_list.length} product{farmer.product_list.length !== 1 ? 's' : ''} — no
                          availability set
                        </p>
                        <button
                          type="button"
                          onClick={() => navigate(`/farmers/${farmer.fid}/vegetable-availability`)}
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-semibold text-[#0D7C66] bg-[#EEF7F3] border border-[#C5E8D8] hover:bg-[#D4F4E8] transition-colors"
                        >
                          Add availability
                        </button>
                      </div>
                    ) : (
                      <div className="min-w-[160px]">
                        <span className="text-xs text-[#9CA3AF] italic">No products assigned</span>
                      </div>
                    )}
                  </td>

                  <td className="px-5 py-4 align-middle">
                    <div className="space-y-1.5 text-sm min-w-[140px]">
                      {farmer.phone ? (
                        <div className="flex items-center gap-2 text-[#0D5C4D]">
                          <Phone className="w-3.5 h-3.5 text-[#6B8782] shrink-0" />
                          <span>{farmer.phone}</span>
                        </div>
                      ) : (
                        <span className="text-xs text-[#9CA3AF]">—</span>
                      )}
                      {farmer.email ? (
                        <div className="flex items-center gap-2 text-[#6B8782] text-xs">
                          <Mail className="w-3.5 h-3.5 shrink-0" />
                          <span className="truncate max-w-[180px]" title={farmer.email}>
                            {farmer.email}
                          </span>
                        </div>
                      ) : null}
                    </div>
                  </td>

                  <td className="px-5 py-4 align-middle">
                    <div className="flex items-center gap-2 text-sm text-[#0D5C4D] min-w-[100px]">
                      <MapPin className="w-3.5 h-3.5 text-[#6B8782] shrink-0" />
                      <span>{toTitleCase(farmer.place || farmer.city)}</span>
                    </div>
                  </td>

                  <td className="px-5 py-4 align-middle">
                    <span
                      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold ${
                        isActive
                          ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                          : 'bg-red-50 text-red-700 border border-red-200'
                      }`}
                    >
                      <span
                        className={`w-1.5 h-1.5 rounded-full ${isActive ? 'bg-emerald-500' : 'bg-red-500'}`}
                      />
                      {isActive ? 'Active' : 'Inactive'}
                    </span>
                  </td>

                  <td className="px-5 py-4 align-middle text-right">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleDropdown(farmer.fid, e);
                      }}
                      className="inline-flex items-center justify-center w-9 h-9 text-[#6B8782] hover:text-[#0D5C4D] hover:bg-[#EEF7F3] border border-transparent hover:border-[#D0E0DB] rounded-lg transition-colors"
                      aria-label="Open actions menu"
                    >
                      <MoreVertical size={18} />
                    </button>
                  </td>
                </tr>
              );
              })}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 px-6 py-4 bg-[#FAFCFB] border-t border-[#D0E0DB]">
          <div className="text-sm text-[#6B8782]">
            Page <span className="font-medium text-[#0D5C4D]">{currentPage}</span> of{' '}
            <span className="font-medium text-[#0D5C4D]">{totalPages}</span>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
              disabled={currentPage === 1}
              className="p-2 text-[#6B8782] hover:bg-[#D0E0DB] rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              aria-label="Previous page"
            >
              <ChevronLeft size={20} />
            </button>
            {paginationPages.map((page, idx) =>
              page === '...' ? (
                <span key={`ellipsis-${idx}`} className="px-2 py-2 text-[#6B8782]">
                  ...
                </span>
              ) : (
                <button
                  key={page}
                  onClick={() => setCurrentPage(page)}
                  className={`min-w-[2.25rem] px-3 py-2 rounded-lg font-medium transition-colors ${
                    currentPage === page
                      ? 'bg-[#0D8568] text-white'
                      : 'text-[#6B8782] hover:bg-[#D0E0DB]'
                  }`}
                >
                  {page}
                </button>
              )
            )}
            <button
              onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
              disabled={currentPage === totalPages}
              className="p-2 text-[#6B8782] hover:bg-[#D0E0DB] rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              aria-label="Next page"
            >
              <ChevronRight size={20} />
            </button>
          </div>
        </div>
      </div>

      {/* Dropdown Menu - Fixed Position Outside Table */}
      {openDropdown && (
        <div
          ref={dropdownRef}
          className="fixed w-32 bg-white rounded-lg shadow-lg border border-[#D0E0DB] py-1 z-[100]"
          style={{
            top: `${dropdownPosition.top}px`,
            left: `${dropdownPosition.left}px`
          }}
        >
          <button
            onClick={() => handleAction('view', openDropdown)}
            className="w-full text-left px-4 py-2 text-sm text-[#0D5C4D] hover:bg-[#F0F4F3] transition-colors flex items-center gap-2"
          >
            <Eye size={14} />
            View
          </button>
          <button
            onClick={() => handleAction('edit', openDropdown)}
            className="w-full text-left px-4 py-2 text-sm text-[#0D5C4D] hover:bg-[#F0F4F3] transition-colors flex items-center gap-2"
          >
            <Edit size={14} />
            Edit
          </button>
          <button
            onClick={() => handleAction('delete', openDropdown,
              farmers.find(f => f.fid === openDropdown)?.farmer_name)}
            className="w-full text-left px-4 py-2 text-sm text-red-500 hover:bg-[#F0F4F3] transition-colors flex items-center gap-2"
          >
            <Trash2 size={14} />
            Delete
          </button>
        </div>
      )}

      <ConfirmDeleteModal
        isOpen={deleteModal.isOpen}
        onClose={() => setDeleteModal({ isOpen: false, farmerId: null, farmerName: '' })}
        onConfirm={async () => {
          try {
            await deleteFarmer(deleteModal.farmerId);
            const response = await getAllFarmers();
            setAllFarmers(response.data || []);
            setDeleteModal({ isOpen: false, farmerId: null, farmerName: '' });
          } catch (error) {
            console.error('Failed to delete farmer:', error);
          }
        }}
        title="Delete Farmer"
        message={`Are you sure you want to delete ${deleteModal.farmerName}? This action cannot be undone.`}
      />
    </div>
  );
};

export default Farmers;