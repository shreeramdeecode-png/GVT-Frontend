import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Download, ChevronDown, ChevronLeft, ChevronRight, Plus, Check, User } from 'lucide-react';
import { getAllStock } from '../../../api/orderAssignmentApi';
import { getAllSuppliers } from '../../../api/supplierApi';
import { getAllThirdParties } from '../../../api/thirdPartyApi';
import { getAllDrivers } from '../../../api/driverApi';
import { getAllLabours } from '../../../api/labourApi';
import { getAllProducts, updateProduct } from '../../../api/productApi';
import { getAllInventory } from '../../../api/inventoryApi';
import { createInventoryStock, getAllInventoryStocks, getInventoryStockById, updateInventoryStock, deleteInventoryStock } from '../../../api/inventoryStockApi';
import { getAllCompanies } from '../../../api/inventoryCompanyApi';
import { createSellStock, getAllSellStocks, deleteSellStock } from '../../../api/sellStockApi';
import { createNotification, getNotifications } from '../../../api/notificationApi';
import { BASE_URL } from '../../../config/config';
import { sortDropdownObjects } from '../../../utils/dropdownSort';

const parseOrderIdNumber = (orderId) => {
  const match = String(orderId || '').match(/(\d+)\s*$/);
  return match ? parseInt(match[1], 10) : 0;
};

const getStockRowDateMs = (item) => {
  const raw = item.date || item.stock_creation_time || item.created_at;
  if (!raw) return 0;
  const t = new Date(raw).getTime();
  return Number.isFinite(t) ? t : 0;
};

/** Newest date first, then highest order number (ORD-041 above ORD-037). */
const compareStockManagementRows = (a, b) => {
  const dateDiff = getStockRowDateMs(b) - getStockRowDateMs(a);
  if (dateDiff !== 0) return dateDiff;
  const orderDiff = parseOrderIdNumber(b.order_id) - parseOrderIdNumber(a.order_id);
  if (orderDiff !== 0) return orderDiff;
  return Number(b.stock_id ?? b.sid ?? 0) - Number(a.stock_id ?? a.sid ?? 0);
};

const StockManagement = () => {
  const navigate = useNavigate();
  const [selectedItems, setSelectedItems] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('All Types');
  const [productFilter, setProductFilter] = useState('All Products');
  const [dateFilter, setDateFilter] = useState('Last 7 days');
  const [currentPage, setCurrentPage] = useState(1);
  const [stockData, setStockData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('stock'); // 'stock', 'market', 'sell'
  const [marketPrices, setMarketPrices] = useState({});
  const [suppliers, setSuppliers] = useState([]);
  const [thirdParties, setThirdParties] = useState([]);
  const [drivers, setDrivers] = useState([]);
  const [labours, setLabours] = useState([]);
  const [editingPriceId, setEditingPriceId] = useState(null);
  const [editingPrice, setEditingPrice] = useState('');
  const [products, setProducts] = useState([]);
  const [showSellForm, setShowSellForm] = useState(false);
  const [sellStockData, setSellStockData] = useState([]);
  const [dataFetched, setDataFetched] = useState({
    stock: false,
    products: false,
    entities: false,
    inventory: false,
    companies: false,
    sell: false,
    inventoryStocks: false
  });

  // Market price tab state
  const [marketSearchTerm, setMarketSearchTerm] = useState('');
  const [marketPriceFilter, setMarketPriceFilter] = useState('All'); // All | Pending | Updated
  const [marketCurrentPage, setMarketCurrentPage] = useState(1);
  const [marketPriceSavedPid, setMarketPriceSavedPid] = useState(null);

  // Inventory tab state
  const [inventorySearchTerm, setInventorySearchTerm] = useState('');
  const [inventoryCurrentPage, setInventoryCurrentPage] = useState(1);

  // Sell Stock Form State
  const [sellForm, setSellForm] = useState({
    selectedStockItems: [], // array of stock_id for multi-select
    entityType: 'supplier', // 'supplier' or 'thirdParty'
    selectedEntity: '',
    driverId: '',
    selectedLabours: [], // array of labour ids for multi-select
    itemDetails: {}, // { [stockId]: { pricePerKg: '', quantity: '' } } per selected item
    totalAmount: 0
  });
  // Sell form dropdown open state ('stock' | 'labour' | null)
  const [openSellDropdown, setOpenSellDropdown] = useState(null);

  // Aggregated stock options: dedupe by product name, sum quantity (for dropdown display)
  const aggregatedStockOptions = React.useMemo(() => {
    const byProduct = {};
    (stockData || []).forEach((item) => {
      const id = Number(item.stock_id ?? item.sid);
      if (Number.isNaN(id)) return;
      const productName = item.products || item.product_name || item.product || '';
      const qty = parseFloat(item.quantity) || 0;
      if (!productName) return;
      if (!byProduct[productName]) {
        byProduct[productName] = { productName, totalQuantity: 0, stockIds: [] };
      }
      byProduct[productName].totalQuantity += qty;
      byProduct[productName].stockIds.push(id);
    });
    return Object.values(byProduct);
  }, [stockData]);

  // Number of selected product groups (for display), not raw stock row count
  const selectedStockProductCount = React.useMemo(() => {
    const selected = (sellForm.selectedStockItems || []).map(id => Number(id));
    return aggregatedStockOptions.filter(opt =>
      opt.stockIds.some(id => selected.includes(Number(id)))
    ).length;
  }, [sellForm.selectedStockItems, aggregatedStockOptions]);

  // Selected products grouped like the dropdown: one entry per product with total stock kg
  const selectedProductsForSell = React.useMemo(() => {
    const selectedIds = (sellForm.selectedStockItems || []).map(id => Number(id));
    return (aggregatedStockOptions || [])
      .filter(opt => opt.stockIds.some(id => selectedIds.includes(Number(id))))
      .map(opt => {
        const selectedStockIds = opt.stockIds.filter(id => selectedIds.includes(Number(id)));
        const totalQuantity = selectedStockIds.reduce((sum, id) => {
          const row = (stockData || []).find(r => Number(r.stock_id ?? r.sid) === Number(id));
          return sum + (parseFloat(row?.quantity) || 0);
        }, 0);
        return { productName: opt.productName, stockIds: selectedStockIds, totalQuantity };
      });
  }, [sellForm.selectedStockItems, aggregatedStockOptions, stockData]);

  // Inventory Stock State
  const [inventoryData, setInventoryData] = useState([]);
  const [showInventoryForm, setShowInventoryForm] = useState(false);
  const [editingInventory, setEditingInventory] = useState(null);
  const [inventoryProducts, setInventoryProducts] = useState([]);
  const [inventoryCompanies, setInventoryCompanies] = useState([]);
  const [inventoryForm, setInventoryForm] = useState({
    invoiceNo: '',
    companyName: '',
    companyId: '',
    date: '',
    items: []
  });

  // Refs for keyboard navigation in Market Price Entry table
  const marketPriceRefs = useRef({});

  // Handle arrow key navigation between market price inputs
  const handleMarketPriceKeyDown = (e, rowIndex, totalRows) => {
    const arrowKeys = ['ArrowUp', 'ArrowDown'];
    if (!arrowKeys.includes(e.key)) return;

    e.preventDefault();

    let nextRow = rowIndex;
    if (e.key === 'ArrowDown') {
      nextRow = Math.min(rowIndex + 1, totalRows - 1);
    } else if (e.key === 'ArrowUp') {
      nextRow = Math.max(rowIndex - 1, 0);
    }

    const nextKey = `${nextRow}`;
    const nextInput = marketPriceRefs.current[nextKey];

    if (nextInput) {
      nextInput.focus();
      if (nextInput.select) {
        setTimeout(() => nextInput.select(), 0);
      }
    }
  };

  // Track which products have already triggered low stock alerts to avoid duplicates
  // Use localStorage to persist across page refreshes
  const getAlertedProducts = () => {
    try {
      const stored = localStorage.getItem('lowStockAlertedProducts');
      return stored ? new Set(JSON.parse(stored)) : new Set();
    } catch {
      return new Set();
    }
  };

  const saveAlertedProducts = (productsSet) => {
    try {
      localStorage.setItem('lowStockAlertedProducts', JSON.stringify(Array.from(productsSet)));
    } catch (error) {
      console.error('Error saving alerted products:', error);
    }
  };

  // Function to check if a low stock notification already exists in backend
  const hasExistingLowStockNotification = useCallback(async (productName) => {
    try {
      const res = await getNotifications();
      const list = Array.isArray(res?.data) ? res.data : (Array.isArray(res) ? res : res?.notifications || []);

      // Check if there's a recent low stock notification for this product (within last 24 hours)
      const now = new Date();
      const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

      return list.some(notif => {
        const notifDate = notif.createdAt ? new Date(notif.createdAt) : null;
        const title = notif.title || '';
        const isLowStockAlert = title.includes('Low Stock Alert:') && title.includes(productName);
        const isRecent = notifDate && notifDate >= oneDayAgo;
        return isLowStockAlert && isRecent;
      });
    } catch (error) {
      console.error('Error checking existing notifications:', error);
      return false;
    }
  }, []);

  // Function to check for low stock and create notifications
  const checkLowStock = useCallback(async (stockDataArray) => {
    try {
      // Aggregate stock quantities by product name
      const productQuantities = {};

      stockDataArray.forEach(item => {
        const productName = item.products || item.product_name || item.product || '';
        if (!productName) return;

        const quantity = parseFloat(item.quantity) || 0;
        if (productQuantities[productName]) {
          productQuantities[productName] += quantity;
        } else {
          productQuantities[productName] = quantity;
        }
      });

      // Check each product for low stock (< 300kg)
      const lowStockThreshold = 300;
      const currentAlertedProducts = new Set();
      const alertedProducts = getAlertedProducts();

      for (const [productName, totalQuantity] of Object.entries(productQuantities)) {
        if (totalQuantity < lowStockThreshold && totalQuantity > 0) {
          currentAlertedProducts.add(productName);

          // Check both localStorage and backend to avoid duplicates
          const alreadyAlerted = alertedProducts.has(productName);
          const hasExistingNotification = await hasExistingLowStockNotification(productName);

          // Only create notification if we haven't already alerted AND no recent notification exists
          if (!alreadyAlerted && !hasExistingNotification) {
            try {
              await createNotification({
                title: `Low Stock Alert: ${productName}`,
                message: `Stock quantity is ${totalQuantity.toFixed(2)} kg (below ${lowStockThreshold} kg threshold)`,
                type: 'warning',
                category: 'Stock'
              });

              // Mark as alerted in localStorage
              alertedProducts.add(productName);
              saveAlertedProducts(alertedProducts);

              // Trigger Navbar refresh
              window.dispatchEvent(new CustomEvent('refreshNotifications'));
            } catch (notifyErr) {
              console.error('Failed to create low stock notification:', notifyErr);
            }
          }
        } else if (totalQuantity >= lowStockThreshold) {
          // If stock is back above threshold, remove from alerted set
          alertedProducts.delete(productName);
          saveAlertedProducts(alertedProducts);
        }
      }

      // Remove products that are no longer in stock or no longer low
      alertedProducts.forEach(productName => {
        if (!currentAlertedProducts.has(productName)) {
          alertedProducts.delete(productName);
        }
      });
      saveAlertedProducts(alertedProducts);
    } catch (error) {
      console.error('Error checking low stock:', error);
    }
  }, [hasExistingLowStockNotification]);

  // Close sell form dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (openSellDropdown !== null && !event.target.closest('.sell-dropdown')) {
        setOpenSellDropdown(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [openSellDropdown]);

  useEffect(() => {
    if (activeTab !== 'stock') return;

    let cancelled = false;
    const fetchStock = async () => {
      try {
        setLoading(true);
        const response = await getAllStock();
        if (cancelled) return;
        if (response.success) {
          const stock = response.data || [];
          setStockData(stock);
          await checkLowStock(stock);
        }
      } catch (error) {
        console.error('Error fetching stock:', error.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    fetchStock();
    return () => {
      cancelled = true;
    };
  }, [activeTab, checkLowStock]);

  useEffect(() => {
    if (!dataFetched.products) {
      const fetchProducts = async () => {
        try {
          const response = await getAllProducts(1, 1000);
          if (response.success) {
            setProducts(response.data || []);
          }
        } catch (error) {
          console.error('Error fetching products:', error.message);
        } finally {
          setDataFetched(prev => ({ ...prev, products: true }));
        }
      };
      fetchProducts();
    }
  }, [dataFetched.products]);

  useEffect(() => {
    if (!dataFetched.entities) {
      const fetchEntities = async () => {
        try {
          const [suppliersRes, thirdPartiesRes, driversRes, laboursRes] = await Promise.all([
            getAllSuppliers(),
            getAllThirdParties(),
            getAllDrivers(),
            getAllLabours()
          ]);

          if (suppliersRes.success) {
            setSuppliers(suppliersRes.data || []);
          }

          if (thirdPartiesRes.success) {
            setThirdParties(thirdPartiesRes.data || []);
          }

          if (driversRes.success) {
            setDrivers(driversRes.data || []);
          }

          if (laboursRes.success) {
            setLabours(laboursRes.data || []);
          }
        } catch (error) {
          console.error('Error fetching entities:', error.message);
        } finally {
          setDataFetched(prev => ({ ...prev, entities: true }));
        }
      };
      fetchEntities();
    }
  }, [dataFetched.entities]);

  useEffect(() => {
    if (!dataFetched.inventory) {
      const fetchInventoryProducts = async () => {
        try {
          const response = await getAllInventory(1, 1000);
          setInventoryProducts(response.data || []);
        } catch (error) {
          console.error('Error fetching inventory products:', error.message);
        } finally {
          setDataFetched(prev => ({ ...prev, inventory: true }));
        }
      };
      fetchInventoryProducts();
    }
  }, [dataFetched.inventory]);

  useEffect(() => {
    if (!dataFetched.companies) {
      const fetchInventoryCompanies = async () => {
        try {
          const response = await getAllCompanies();
          setInventoryCompanies(response.data || []);
        } catch (error) {
          console.error('Error fetching inventory companies:', error.message);
        } finally {
          setDataFetched(prev => ({ ...prev, companies: true }));
        }
      };
      fetchInventoryCompanies();
    }
  }, [dataFetched.companies]);

  useEffect(() => {
    if (activeTab === 'inventory' && !dataFetched.inventoryStocks) {
      fetchInventoryStocks();
      setDataFetched(prev => ({ ...prev, inventoryStocks: true }));
    }
    if (activeTab === 'sell' && !dataFetched.sell) {
      fetchSellStocks();
      setDataFetched(prev => ({ ...prev, sell: true }));
    }
  }, [activeTab, dataFetched.inventoryStocks, dataFetched.sell]);

  const summaryCards = [
    { title: 'Total Stock Items', value: stockData.length, bgColor: 'bg-[#D4F4E8]', textColor: 'text-[#0D7C66]' },
    { title: 'Pending Reassignment', value: stockData.length, bgColor: 'bg-[#B8F3DC]', textColor: 'text-[#0D7C66]' },
    { title: 'Total Weight', value: `${stockData.reduce((sum, item) => sum + (parseFloat(item.quantity) || 0), 0).toFixed(1)} Kg`, bgColor: 'bg-[#1CB68B]', textColor: 'text-white' },
    { title: 'Average Age', value: '2.3 Days', bgColor: 'bg-[#0D7C66]', textColor: 'text-white' }
  ];

  const handleSelectAll = (e) => {
    if (e.target.checked) {
      setSelectedItems(stockData.map(item => item.id));
    } else {
      setSelectedItems([]);
    }
  };

  const handleSelectItem = (id) => {
    if (selectedItems.includes(id)) {
      setSelectedItems(selectedItems.filter(item => item !== id));
    } else {
      setSelectedItems([...selectedItems, id]);
    }
  };

  const getStatusStyle = (status) => {
    switch (status) {
      case 'Pending':
        return 'bg-amber-100 text-amber-700';
      case 'Aging':
        return 'bg-pink-100 text-pink-700';
      case 'Reassigned':
        return 'bg-blue-100 text-blue-700';
      case 'Critical':
        return 'bg-red-100 text-red-700';
      default:
        return 'bg-gray-100 text-gray-700';
    }
  };

  const getOrderTypeStyle = (type) => {
    switch (type) {
      case 'BOX':
        return 'bg-emerald-100 text-emerald-700';
      case 'BAG':
        return 'bg-amber-100 text-amber-700';
      default:
        return 'bg-gray-100 text-gray-700';
    }
  };

  const getActionButton = (status, item) => {
    if (status === 'Reassigned') {
      return (
        <button className="px-4 py-1.5 text-sm text-gray-400 border border-gray-300 rounded-md">
          Assigned
        </button>
      );
    }
    if (status === 'Critical' || status === 'Aging') {
      return (
        <button
          onClick={() => navigate(`/stock/${item.id}`, { state: { stockData: item } })}
          className="px-4 py-1.5 text-sm text-white bg-red-600 rounded-md hover:bg-red-700 transition-colors"
        >
          Urgent
        </button>
      );
    }
    return (
      <button
        onClick={() => navigate(`/stock/${item.id}`, { state: { stockData: item } })}
        className="px-4 py-1.5 text-sm text-emerald-600 border border-emerald-600 rounded-md hover:bg-emerald-50 transition-colors"
      >
        Reassign
      </button>
    );
  };

  const handleMarketPriceChange = (itemId, price) => {
    setMarketPrices(prev => ({
      ...prev,
      [itemId]: price
    }));
  };

  const handlePriceEdit = (pid, currentPrice) => {
    setEditingPriceId(pid);
    setEditingPrice(currentPrice === '' || currentPrice == null ? '' : String(currentPrice));
  };

  // Helper: today's market price from product price_date (same as OrderAssignCreateStage4)
  const getTodaysMarketPrice = (product) => {
    if (!product?.price_date) return null;
    try {
      const priceData = typeof product.price_date === 'string'
        ? JSON.parse(product.price_date)
        : product.price_date;
      if (!Array.isArray(priceData)) return null;
      const today = new Date().toISOString().split('T')[0];
      const todaysPrice = priceData.find(entry => {
        if (!entry.date) return false;
        const entryDate = new Date(entry.date).toISOString().split('T')[0];
        return entryDate === today;
      });
      return todaysPrice ? parseFloat(todaysPrice.price) : null;
    } catch (error) {
      console.error('Error parsing price_date:', error);
      return null;
    }
  };

  const isMarketPriceUpdatedToday = (product) => {
    const todaysPrice = getTodaysMarketPrice(product);
    if (todaysPrice != null && todaysPrice > 0) return true;
    const today = new Date().toISOString().split('T')[0];
    const updatedRaw = product?.updated_at || product?.updatedAt;
    if (updatedRaw && new Date(updatedRaw).toISOString().split('T')[0] === today) {
      return (parseFloat(product.current_price) || 0) > 0;
    }
    return false;
  };

  const getDisplayMarketPrice = (product) => {
    const todaysPrice = getTodaysMarketPrice(product);
    if (todaysPrice != null && todaysPrice > 0) return todaysPrice;
    const current = parseFloat(product?.current_price);
    return Number.isFinite(current) && current > 0 ? current : '';
  };

  const applyTodayPriceToProduct = (product, priceNum) => {
    const today = new Date().toISOString().split('T')[0];
    let priceHistory = product.price_date;
    try {
      priceHistory =
        typeof priceHistory === 'string' ? JSON.parse(priceHistory) : priceHistory || [];
    } catch {
      priceHistory = [];
    }
    if (!Array.isArray(priceHistory)) priceHistory = [];
    const todayIndex = priceHistory.findIndex((entry) => entry?.date === today);
    if (todayIndex >= 0) {
      priceHistory = priceHistory.map((entry, i) =>
        i === todayIndex ? { ...entry, price: priceNum } : entry
      );
    } else {
      priceHistory = [...priceHistory, { date: today, price: priceNum }];
    }
    return {
      ...product,
      current_price: priceNum,
      price_date: priceHistory,
      updatedAt: new Date().toISOString(),
    };
  };

  const handlePriceSave = async (pid) => {
    const priceNum = parseFloat(editingPrice);
    if (!editingPrice || Number.isNaN(priceNum) || priceNum <= 0) {
      alert('Please enter a valid market price');
      return;
    }
    try {
      const formData = new FormData();
      formData.append('current_price', String(priceNum));
      await updateProduct(pid, formData);

      setEditingPriceId(null);
      setEditingPrice('');
      setMarketPriceSavedPid(pid);
      setTimeout(() => setMarketPriceSavedPid(null), 2500);

      setProducts((prev) =>
        prev.map((p) => (p.pid === pid ? applyTodayPriceToProduct(p, priceNum) : p))
      );

      const response = await getAllProducts(1, 1000);
      if (response.success) {
        setProducts(response.data || []);
      }
    } catch (error) {
      console.error('Error updating price:', error);
      alert('Failed to update price. Please try again.');
    }
  };

  const handlePriceCancel = () => {
    setEditingPriceId(null);
    setEditingPrice('');
  };

  // Market price display for sell form: show price only if updated today; otherwise warning only (no old price)
  const getMarketPriceForSell = (product) => {
    const todaysPrice = product ? getTodaysMarketPrice(product) : null;
    const today = new Date().toISOString().split('T')[0];
    const updatedAtDate = product?.updatedAt ? new Date(product.updatedAt).toISOString().split('T')[0] : '';
    const updatedToday = updatedAtDate === today;
    if (todaysPrice != null && todaysPrice > 0) {
      return { price: todaysPrice, isUpdatedToday: true };
    }
    if (updatedToday && product) {
      const currentPrice = parseFloat(product.current_price) || 0;
      if (currentPrice > 0) return { price: currentPrice, isUpdatedToday: true };
    }
    return { price: null, isUpdatedToday: false };
  };

  const handleSellFormChange = (field, value) => {
    setSellForm(prev => ({ ...prev, [field]: value }));
  };

  // Update price/quantity for a product and recalc total
  const handleSellItemDetailChange = (productName, field, value) => {
    setSellForm(prev => {
      const details = prev.itemDetails || {};
      const current = details[productName] || { pricePerKg: '', quantity: '' };
      const nextDetails = { ...details, [productName]: { ...current, [field]: value } };
      const productNames = (aggregatedStockOptions || [])
        .filter(opt => (prev.selectedStockItems || []).map(i => Number(i)).some(id => opt.stockIds.includes(id)))
        .map(o => o.productName);
      let total = 0;
      productNames.forEach(pname => {
        const d = nextDetails[pname] || {};
        total += (parseFloat(d.pricePerKg) || 0) * (parseFloat(d.quantity) || 0);
      });
      return { ...prev, itemDetails: nextDetails, totalAmount: total.toFixed(2) };
    });
  };

  // Sell Stock Handlers
  const fetchSellStocks = async () => {
    try {
      const response = await getAllSellStocks();
      setSellStockData(response.data || []);
    } catch (error) {
      console.error('Error fetching sell stocks:', error);
    }
  };

  const handleSellSubmit = async (e) => {
    e.preventDefault();
    try {
      const entityId = parseInt(sellForm.selectedEntity);
      const driverId = sellForm.driverId ? parseInt(sellForm.driverId) : null;
      const labourIds = Array.isArray(sellForm.selectedLabours) ? sellForm.selectedLabours : [];
      const firstLabourId = labourIds.length > 0 ? parseInt(labourIds[0]) : null;

      const itemDetails = sellForm.itemDetails || {};
      const selectedProducts = (aggregatedStockOptions || [])
        .filter(opt => (sellForm.selectedStockItems || []).map(i => Number(i)).some(id => opt.stockIds.includes(Number(id))))
        .map(opt => {
          const selectedStockIds = opt.stockIds.filter(id => (sellForm.selectedStockItems || []).map(i => Number(i)).includes(Number(id)));
          return { productName: opt.productName, stockIds: selectedStockIds };
        });

      if (selectedProducts.length === 0) {
        alert('Please select at least one stock item.');
        return;
      }

      for (const { productName, stockIds } of selectedProducts) {
        const detail = itemDetails[productName] || {};
        const pricePerKg = parseFloat(detail.pricePerKg) || 0;
        const quantityToSell = parseFloat(detail.quantity) || 0;
        if (!quantityToSell || !pricePerKg) {
          alert(`Please enter quantity and price for "${productName}".`);
          return;
        }
        let remaining = quantityToSell;
        for (const stockId of stockIds) {
          if (remaining <= 0) break;
          const row = stockData.find(s => Number(s.stock_id ?? s.sid) === Number(stockId));
          const available = row ? (parseFloat(row.quantity) || 0) : 0;
          const qty = Math.min(available, remaining);
          if (qty <= 0) continue;
          const totalAmount = (pricePerKg * qty).toFixed(2);
          await createSellStock({
            stockId: parseInt(stockId),
            entityType: sellForm.entityType,
            entityId,
            driverId,
            labourId: firstLabourId,
            pricePerKg,
            quantity: qty,
            totalAmount: parseFloat(totalAmount)
          });
          remaining -= qty;
        }
        if (remaining > 0) {
          alert(`Not enough stock for "${productName}". Requested ${quantityToSell} kg but only ${(quantityToSell - remaining).toFixed(2)} kg available in selected rows.`);
          return;
        }
      }

      fetchSellStocks();

      const stockResponse = await getAllStock();
      if (stockResponse.success) {
        const updatedStock = stockResponse.data || [];
        setStockData(updatedStock);
        await checkLowStock(updatedStock);
      }

      setShowSellForm(false);
      setSellForm({
        selectedStockItems: [],
        entityType: 'supplier',
        selectedEntity: '',
        driverId: '',
        selectedLabours: [],
        itemDetails: {},
        totalAmount: 0
      });
      alert('Stock sold successfully!');
    } catch (error) {
      console.error('Error selling stock:', error);
      alert('Failed to sell stock');
    }
  };

  const handleDeleteSellStock = async (id) => {
    if (window.confirm('Are you sure you want to delete this sell stock record?')) {
      try {
        await deleteSellStock(id);
        fetchSellStocks();

        // Refresh stock data and check for low stock after deletion
        const stockResponse = await getAllStock();
        if (stockResponse.success) {
          const updatedStock = stockResponse.data || [];
          setStockData(updatedStock);
          await checkLowStock(updatedStock);
        }
      } catch (error) {
        console.error('Error deleting sell stock:', error);
        alert('Failed to delete sell stock');
      }
    }
  };

  // Inventory Stock Handlers
  const fetchInventoryStocks = async () => {
    try {
      const response = await getAllInventoryStocks();
      setInventoryData(response.data || []);
    } catch (error) {
      console.error('Error fetching inventory stocks:', error);
    }
  };

  const handleInventoryFormChange = (field, value) => {
    setInventoryForm(prev => ({ ...prev, [field]: value }));
  };

  const addInventoryItem = () => {
    setInventoryForm(prev => ({
      ...prev,
      items: [...prev.items, { item: '', hsnCode: '', quantity: '', pricePerUnit: '', gst: '', inventoryId: '' }]
    }));
  };

  const removeInventoryItem = (index) => {
    setInventoryForm(prev => ({
      ...prev,
      items: prev.items.filter((_, i) => i !== index)
    }));
  };

  const handleInventoryItemChange = (index, field, value) => {
    setInventoryForm(prev => {
      const items = [...prev.items];
      items[index] = { ...items[index], [field]: value };
      return { ...prev, items };
    });
  };

  const calculateItemTotal = (item) => {
    const price = parseFloat(item.pricePerUnit) || 0;
    const qty = parseFloat(item.quantity) || 0;
    const gst = parseFloat(item.gst) || 0;
    const subtotal = price * qty;
    return (subtotal + (subtotal * gst / 100)).toFixed(2);
  };

  const calculateGrandTotal = () => {
    return inventoryForm.items.reduce((sum, item) => sum + parseFloat(calculateItemTotal(item) || 0), 0).toFixed(2);
  };

  const handleInventorySubmit = async (e) => {
    e.preventDefault();
    try {
      if (inventoryForm.items.length === 0) {
        alert('Please add at least one item');
        return;
      }

      const payload = {
        invoice_no: inventoryForm.invoiceNo,
        company_name: inventoryForm.companyName,
        company_id: parseInt(inventoryForm.companyId),
        date: inventoryForm.date || null,
        items: inventoryForm.items.map(item => ({
          item_name: item.item,
          hsn_code: item.hsnCode,
          quantity: parseFloat(item.quantity),
          price_per_unit: parseFloat(item.pricePerUnit),
          gst_percentage: item.gst ? parseFloat(item.gst) : null,
          inventory_id: parseInt(item.inventoryId)
        }))
      };

      if (editingInventory) {
        await updateInventoryStock(editingInventory, payload);
      } else {
        await createInventoryStock(payload);
      }

      fetchInventoryStocks();

      const stockResponse = await getAllStock();
      if (stockResponse.success) {
        const updatedStock = stockResponse.data || [];
        setStockData(updatedStock);
        await checkLowStock(updatedStock);
      }

      setShowInventoryForm(false);
      setEditingInventory(null);
      setInventoryForm({
        invoiceNo: '',
        companyName: '',
        companyId: '',
        date: '',
        items: []
      });
      alert('Inventory stock saved successfully!');
    } catch (error) {
      console.error('Error saving inventory stock:', error);
      alert('Failed to save inventory stock');
    }
  };

  const handleEditInventory = async (item) => {
    try {
      setLoading(true);
      const response = await getInventoryStockById(item.id);

      if (response.success) {
        const stock = response.data;
        let itemsList = [];
        try {
          itemsList = typeof stock.items === 'string' ? JSON.parse(stock.items) : (Array.isArray(stock.items) ? stock.items : []);
        } catch (e) {
          itemsList = [];
        }

        // If itemsList is empty but the main record has item details (old flat format), fallback to it
        if (itemsList.length === 0 && stock.item_name) {
          itemsList = [{
            item_name: stock.item_name,
            hsn_code: stock.hsn_code,
            quantity: stock.quantity,
            price_per_unit: stock.price_per_unit,
            gst_percentage: stock.gst_percentage,
            inventory_id: stock.inventory_id
          }];
        }

        setInventoryForm({
          invoiceNo: stock.invoice_no || '',
          companyName: stock.company_name || '',
          companyId: stock.company_id || '',
          date: stock.date ? new Date(stock.date).toISOString().split('T')[0] : '',
          items: itemsList.map(i => ({
            item: i.item_name || '',
            hsnCode: i.hsn_code || '',
            quantity: i.quantity || '',
            pricePerUnit: i.price_per_unit || '',
            gst: i.gst_percentage || '',
            inventoryId: i.inventory_id || ''
          }))
        });
        setEditingInventory(stock.id);
        setShowInventoryForm(true);
      } else {
        alert(response.message || 'Failed to fetch inventory details');
      }
    } catch (error) {
      console.error('Error fetching inventory record:', error);
      alert('Failed to fetch inventory record details');
    } finally {
      setLoading(false);
    }
  };

  // Periodic check for low stock (every 5 minutes) when stock data is available
  // This is less frequent to avoid creating duplicate notifications
  useEffect(() => {
    if (stockData.length > 0 && dataFetched.stock) {
      const interval = setInterval(() => {
        checkLowStock(stockData);
      }, 300000); // Check every 5 minutes (300000 ms)

      return () => clearInterval(interval);
    }
  }, [stockData.length, dataFetched.stock, checkLowStock]);

  const handleDeleteInventory = async (id) => {
    if (window.confirm('Are you sure you want to delete this inventory record?')) {
      try {
        await deleteInventoryStock(id);
        fetchInventoryStocks();

        // Refresh stock data and check for low stock after deletion
        const stockResponse = await getAllStock();
        if (stockResponse.success) {
          const updatedStock = stockResponse.data || [];
          setStockData(updatedStock);
          await checkLowStock(updatedStock);
        }
      } catch (error) {
        console.error('Error deleting inventory stock:', error);
        alert('Failed to delete inventory stock');
      }
    }
  };

  // Derived data for Market Price tab (search + pagination)
  const marketItemsPerPage = 10;
  const marketPriceCounts = useMemo(() => {
    let pending = 0;
    let updated = 0;
    products.forEach((product) => {
      if (isMarketPriceUpdatedToday(product)) updated += 1;
      else pending += 1;
    });
    return { all: products.length, pending, updated };
  }, [products]);

  const filteredMarketProducts = useMemo(() => {
    const term = marketSearchTerm.toLowerCase();
    return products
      .filter((product) => {
        if (term && !product.product_name?.toLowerCase().includes(term)) return false;
        const isUpdated = isMarketPriceUpdatedToday(product);
        if (marketPriceFilter === 'Pending') return !isUpdated;
        if (marketPriceFilter === 'Updated') return isUpdated;
        return true;
      })
      .sort((a, b) => {
        const aDone = isMarketPriceUpdatedToday(a);
        const bDone = isMarketPriceUpdatedToday(b);
        if (aDone !== bDone) return aDone ? 1 : -1;
        return (a.product_name || '').localeCompare(b.product_name || '');
      });
  }, [products, marketSearchTerm, marketPriceFilter]);
  const totalMarketPages = Math.max(1, Math.ceil(filteredMarketProducts.length / marketItemsPerPage));
  const effectiveMarketPage = Math.min(marketCurrentPage, totalMarketPages);
  const marketStartIndex = (effectiveMarketPage - 1) * marketItemsPerPage;
  const marketPaginatedProducts = filteredMarketProducts.slice(
    marketStartIndex,
    marketStartIndex + marketItemsPerPage
  );

  // Derived data for Inventory tab (search + pagination)
  const inventoryItemsPerPage = 10;

  // Filter directly on inventoryData
  const filteredInventoryData = inventoryData.filter(stock => {
    const term = inventorySearchTerm.toLowerCase();
    if (!term) return true;

    const invoice = (stock.invoice_no || '').toString().toLowerCase();
    const company = (stock.company_name || '').toLowerCase();

    // Parse items to search within them
    let items = [];
    try {
      if (typeof stock.items === 'string') {
        items = JSON.parse(stock.items);
      } else if (Array.isArray(stock.items)) {
        items = stock.items;
      }
    } catch (e) {
      items = [];
    }

    const itemNames = items.map(i => (i.item_name || '').toLowerCase()).join(' ');
    const hsnCodes = items.map(i => (i.hsn_code || '').toString().toLowerCase()).join(' ');

    return (
      invoice.includes(term) ||
      company.includes(term) ||
      itemNames.includes(term) ||
      hsnCodes.includes(term)
    );
  });

  const totalInventoryPages = Math.max(
    1,
    Math.ceil(filteredInventoryData.length / inventoryItemsPerPage)
  );
  const effectiveInventoryPage = Math.min(inventoryCurrentPage, totalInventoryPages);
  const inventoryStartIndex = (effectiveInventoryPage - 1) * inventoryItemsPerPage;
  const inventoryPaginatedData = filteredInventoryData.slice(
    inventoryStartIndex,
    inventoryStartIndex + inventoryItemsPerPage
  );

  // Derived data for Stock Management tab (search + type filter + pagination)
  const stockItemsPerPage = 10;
  const filteredStock = useMemo(() => {
    const term = searchTerm.toLowerCase();
    return stockData
      .filter((item) => {
        const matchesSearch =
          !term ||
          (item.order_id || '').toLowerCase().includes(term) ||
          (item.name || '').toLowerCase().includes(term) ||
          (item.products || '').toLowerCase().includes(term) ||
          (item.type || '').toLowerCase().includes(term);
        const matchesType =
          statusFilter === 'All Types' ||
          (item.type || '').toLowerCase() === statusFilter.toLowerCase();
        return matchesSearch && matchesType;
      })
      .sort(compareStockManagementRows);
  }, [stockData, searchTerm, statusFilter]);
  const stockTotalPages = Math.max(1, Math.ceil(filteredStock.length / stockItemsPerPage));
  const effectiveStockPage = Math.min(currentPage, stockTotalPages);
  const stockStartIndex = (effectiveStockPage - 1) * stockItemsPerPage;
  const paginatedStock = filteredStock.slice(stockStartIndex, stockStartIndex + stockItemsPerPage);

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-6 lg:p-8">

      {/* Summary Cards */}
      {/* <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {summaryCards.map((card, index) => (
          <div key={index} className={`${card.bgColor} rounded-2xl p-6 shadow-sm`}>
            <p className={`text-sm font-medium mb-2 ${card.textColor} opacity-90`}>
              {card.title}
            </p>
            <p className={`text-4xl font-bold ${card.textColor}`}>
              {card.value}
            </p>
          </div>
        ))}
      </div> */}

      {/* Tabs */}
      <div className="mb-6">
        <div className="bg-white rounded-2xl p-2 shadow-sm border border-[#D0E0DB] inline-flex gap-2">
          <button
            onClick={() => setActiveTab('stock')}
            className={`px-6 py-3 rounded-xl font-medium transition-all ${activeTab === 'stock'
              ? 'bg-[#0D8568] text-white shadow-md'
              : 'text-[#6B8782] hover:bg-[#F0F4F3]'
              }`}
          >
            Stock Management
          </button>
          <button
            onClick={() => setActiveTab('market')}
            className={`px-6 py-3 rounded-xl font-medium transition-all ${activeTab === 'market'
              ? 'bg-[#0D8568] text-white shadow-md'
              : 'text-[#6B8782] hover:bg-[#F0F4F3]'
              }`}
          >
            Market Price Entry
          </button>
          <button
            onClick={() => setActiveTab('sell')}
            className={`px-6 py-3 rounded-xl font-medium transition-all ${activeTab === 'sell'
              ? 'bg-[#0D8568] text-white shadow-md'
              : 'text-[#6B8782] hover:bg-[#F0F4F3]'
              }`}
          >
            Sell Stock
          </button>
          <button
            onClick={() => setActiveTab('inventory')}
            className={`px-6 py-3 rounded-xl font-medium transition-all ${activeTab === 'inventory'
              ? 'bg-[#0D8568] text-white shadow-md'
              : 'text-[#6B8782] hover:bg-[#F0F4F3]'
              }`}
          >
            Inventory Stock
          </button>
        </div>
      </div>

      {/* Content based on active tab */}
      {activeTab === 'stock' && (
        <>
          {/* Search and Filters */}
          <div className="flex flex-col lg:flex-row gap-4 mb-6">
            <div className="relative flex-1">
              <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-[#6B8782]" size={20} />
              <input
                type="text"
                placeholder="Search products, orders..."
                value={searchTerm}
                onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }}
                className="w-full pl-12 pr-4 py-3 bg-[#F0F4F3] border-none rounded-xl text-[#0D5C4D] placeholder-[#6B8782] focus:outline-none focus:ring-2 focus:ring-[#0D8568]"
              />
            </div>
            <div className="flex flex-wrap gap-3">
              <div className="relative">
                <select
                  value={statusFilter}
                  onChange={(e) => { setStatusFilter(e.target.value); setCurrentPage(1); }}
                  className="appearance-none px-4 py-3 pr-10 bg-[#F0F4F3] border-none rounded-xl text-[#0D5C4D] focus:outline-none focus:ring-2 focus:ring-[#0D8568] cursor-pointer"
                >
                  <option>All Types</option>
                  <option>Farmer</option>
                  <option>Supplier</option>
                  <option>Third Party</option>
                </select>
                <ChevronDown className="absolute right-3 top-1/2 transform -translate-y-1/2 text-[#6B8782] w-4 h-4 pointer-events-none" />
              </div>
              <button className="px-6 py-3 border border-[#0D7C66] text-[#0D7C66] rounded-xl hover:bg-[#0D7C66] hover:text-white transition-colors font-medium flex items-center gap-2">
                <Download className="w-4 h-4" />
                Export
              </button>
            </div>
          </div>

          {/* Table */}
          <div className="bg-white rounded-2xl overflow-hidden border border-[#D0E0DB]">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-[#D4F4E8]">
                    <th className="px-6 py-4 text-left text-sm font-semibold text-[#0D5C4D]">
                      Order ID
                    </th>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-[#0D5C4D]">
                      Date
                    </th>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-[#0D5C4D]">
                      Type
                    </th>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-[#0D5C4D]">
                      Name
                    </th>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-[#0D5C4D]">
                      Products
                    </th>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-[#0D5C4D]">
                      Quantity
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr>
                      <td colSpan="6" className="px-6 py-8 text-center text-[#6B8782]">
                        Loading stock data...
                      </td>
                    </tr>
                  ) : filteredStock.length === 0 ? (
                    <tr>
                      <td colSpan="6" className="px-6 py-8 text-center text-[#6B8782]">
                        No stock data found
                      </td>
                    </tr>
                  ) : (
                    paginatedStock.map((item, index) => (
                      <tr key={item.sid || index} className={`border-b border-[#D0E0DB] hover:bg-[#F0F4F3] transition-colors ${index % 2 === 0 ? 'bg-white' : 'bg-[#F0F4F3]/30'
                        }`}>
                        <td className="px-6 py-4 text-sm font-medium text-[#0D5C4D]">
                          {item.order_id || 'N/A'}
                        </td>
                        <td className="px-6 py-4 text-sm text-[#6B8782]">
                          {item.date ? new Date(item.date).toLocaleDateString() : 'N/A'}
                        </td>
                        <td className="px-6 py-4">
                          <span className="px-3 py-1.5 rounded-full text-xs font-medium bg-[#D4F4E8] text-[#047857]">
                            {item.type || 'N/A'}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-sm font-semibold text-[#0D5C4D]">
                          {item.name || 'N/A'}
                        </td>
                        <td className="px-6 py-4 text-sm text-[#6B8782]">
                          {item.products || 'N/A'}
                        </td>
                        <td className="px-6 py-4 text-sm font-semibold text-[#047857]">
                          {item.quantity ? `${item.quantity} kg` : 'N/A'}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            <div className="flex items-center justify-between px-6 py-4 bg-[#F0F4F3] border-t border-[#D0E0DB]">
              <div className="text-sm text-[#6B8782]">
                {filteredStock.length === 0
                  ? 'No records'
                  : `Showing ${stockStartIndex + 1}–${Math.min(stockStartIndex + stockItemsPerPage, filteredStock.length)} of ${filteredStock.length} records`}
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                  disabled={effectiveStockPage === 1}
                  className="px-3 py-2 text-[#6B8782] hover:bg-[#D0E0DB] rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                {Array.from({ length: stockTotalPages }, (_, i) => i + 1).map(page => {
                  const showPage =
                    page === 1 ||
                    page === stockTotalPages ||
                    (page >= effectiveStockPage - 1 && page <= effectiveStockPage + 1);
                  const showEllipsis =
                    (page === effectiveStockPage - 2 && effectiveStockPage > 3) ||
                    (page === effectiveStockPage + 2 && effectiveStockPage < stockTotalPages - 2);
                  if (showEllipsis) return <button key={`ellipsis-${page}`} className="px-3 py-2 text-[#6B8782]">...</button>;
                  if (!showPage) return null;
                  return (
                    <button
                      key={page}
                      onClick={() => setCurrentPage(page)}
                      className={`px-4 py-2 rounded-lg font-medium transition-colors ${effectiveStockPage === page
                        ? 'bg-[#0D8568] text-white'
                        : 'text-[#6B8782] hover:bg-[#D0E0DB]'
                        }`}
                    >
                      {page}
                    </button>
                  );
                })}
                <button
                  onClick={() => setCurrentPage(prev => Math.min(stockTotalPages, prev + 1))}
                  disabled={effectiveStockPage === stockTotalPages}
                  className="px-3 py-2 text-[#6B8782] hover:bg-[#D0E0DB] rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Market Price Entry Tab - Show Products Table */}
      {activeTab === 'market' && (
        <div className="bg-white rounded-2xl overflow-hidden border border-[#D0E0DB]">
          {/* Search + price status filter */}
          <div className="px-6 py-4 border-b border-[#D0E0DB] flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-[#6B8782]" size={18} />
              <input
                type="text"
                placeholder="Search vegetables..."
                value={marketSearchTerm}
                onChange={(e) => {
                  setMarketSearchTerm(e.target.value);
                  setMarketCurrentPage(1);
                }}
                className="w-full pl-10 pr-4 py-2.5 bg-[#F0F4F3] border border-transparent rounded-xl text-[#0D5C4D] placeholder-[#6B8782] focus:outline-none focus:ring-2 focus:ring-[#0D8568]"
              />
            </div>
            <div className="relative">
              <select
                value={marketPriceFilter}
                onChange={(e) => {
                  setMarketPriceFilter(e.target.value);
                  setMarketCurrentPage(1);
                }}
                className="appearance-none min-w-[200px] px-4 py-2.5 pr-10 bg-[#F0F4F3] border border-transparent rounded-xl text-[#0D5C4D] focus:outline-none focus:ring-2 focus:ring-[#0D8568] cursor-pointer"
              >
                <option value="All">All ({marketPriceCounts.all})</option>
                <option value="Pending">Pending ({marketPriceCounts.pending})</option>
                <option value="Updated">Updated ({marketPriceCounts.updated})</option>
              </select>
              <ChevronDown className="absolute right-3 top-1/2 transform -translate-y-1/2 text-[#6B8782] w-4 h-4 pointer-events-none" />
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-[#D4F4E8]">
                  <th className="px-6 py-4 text-left text-sm font-semibold text-[#0D5C4D]">Image</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-[#0D5C4D]">Vegetable Name</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-[#0D5C4D]">Category</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-[#0D5C4D]">Unit</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-[#0D5C4D]">Last Updated</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-[#0D5C4D]">Price Status</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-[#0D5C4D]">Market Price (₹/KG)</th>
                </tr>
              </thead>
              <tbody>
                {marketPaginatedProducts.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-6 py-8 text-center text-[#6B8782]">
                      {marketPriceFilter === 'Pending'
                        ? 'No pending products — all prices updated for today.'
                        : marketPriceFilter === 'Updated'
                          ? 'No products updated today yet.'
                          : 'No products found'}
                    </td>
                  </tr>
                ) : marketPaginatedProducts.map((product, index) => {
                  const priceUpdatedToday = isMarketPriceUpdatedToday(product);
                  const displayPrice = getDisplayMarketPrice(product);
                  const justSaved = marketPriceSavedPid === product.pid;
                  return (
                  <tr
                    key={product.pid}
                    className={`border-b border-[#D0E0DB] hover:bg-[#F0F4F3] transition-all duration-500 ${
                      justSaved
                        ? 'bg-[#D1FAE5]'
                        : priceUpdatedToday
                          ? 'bg-[#ECFDF5]/80'
                          : index % 2 === 0
                            ? 'bg-white'
                            : 'bg-[#F0F4F3]/30'
                    }`}
                  >
                    <td className="px-6 py-4">
                      {product.product_image ? (
                        <img src={`${BASE_URL}${product.product_image}`} alt={product.product_name} className="w-12 h-12 rounded-lg object-cover" />
                      ) : (
                        <div className="w-12 h-12 bg-gray-200 rounded-lg flex items-center justify-center text-gray-400 text-xs">No Image</div>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm font-semibold text-[#0D5C4D]">{product.product_name}</div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm text-[#0D5C4D]">{product.category?.categoryname || 'N/A'}</div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm text-[#0D5C4D]">{product.unit}</div>
                    </td>
                    <td className="px-6 py-4">
                      <div className={`text-sm font-medium ${priceUpdatedToday ? 'text-[#047857]' : 'text-gray-500'}`}>
                        {priceUpdatedToday ? 'Today' : new Date(product.updatedAt || product.updated_at).toLocaleDateString()}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      {priceUpdatedToday ? (
                        <span className="px-3 py-1.5 rounded-full text-xs font-medium flex items-center gap-1 w-fit bg-[#4ED39A] text-white">
                          <Check className="w-3 h-3" />
                          Updated
                        </span>
                      ) : (
                        <span className="px-3 py-1.5 rounded-full text-xs font-medium flex items-center gap-1 w-fit bg-amber-100 text-amber-800">
                          Pending
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      {editingPriceId === product.pid ? (
                        <div className="flex items-center gap-2">
                          <input
                            ref={(el) => {
                              if (el) marketPriceRefs.current[`${index}`] = el;
                            }}
                            type="text"
                            value={editingPrice}
                            onChange={(e) => setEditingPrice(e.target.value)}
                            className="w-24 px-2 py-1 border border-[#0D7C66] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0D7C66] text-sm"
                            autoFocus
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') handlePriceSave(product.pid);
                              if (e.key === 'Escape') handlePriceCancel();
                              if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
                                handleMarketPriceKeyDown(e, index, marketPaginatedProducts.length);
                              }
                            }}
                          />
                          <button
                            onClick={() => handlePriceSave(product.pid)}
                            className="px-2 py-1 bg-[#0D7C66] text-white rounded text-xs hover:bg-[#0a6354]"
                          >
                            ✓
                          </button>
                          <button
                            onClick={handlePriceCancel}
                            className="px-2 py-1 bg-gray-300 text-gray-700 rounded text-xs hover:bg-gray-400"
                          >
                            ✕
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2">
                          <input
                            ref={(el) => {
                              if (el) marketPriceRefs.current[`${index}`] = el;
                            }}
                            type="text"
                            value={displayPrice}
                            onClick={() => handlePriceEdit(product.pid, displayPrice)}
                            readOnly
                            onKeyDown={(e) => {
                              if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
                                handleMarketPriceKeyDown(e, index, marketPaginatedProducts.length);
                              }
                            }}
                            className={`w-24 px-2 py-1 border rounded-lg text-sm font-semibold cursor-pointer focus:outline-none ${
                              priceUpdatedToday
                                ? 'border-[#4ED39A] bg-[#ECFDF5] text-[#047857]'
                                : 'border-gray-200 hover:border-[#0D7C66]'
                            }`}
                            title="Click to edit price"
                          />
                          {priceUpdatedToday && (
                            <Check className="w-4 h-4 text-[#047857] flex-shrink-0" aria-hidden />
                          )}
                        </div>
                      )}
                    </td>
                  </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="flex items-center justify-between px-6 py-4 bg-[#F0F4F3] border-t border-[#D0E0DB]">
            <div className="text-sm text-[#6B8782]">
              {filteredMarketProducts.length > 0 ? (
                `Showing ${marketStartIndex + 1} to ${Math.min(
                  marketStartIndex + marketItemsPerPage,
                  filteredMarketProducts.length
                )} of ${filteredMarketProducts.length} products`
              ) : (
                'No products found'
              )}
            </div>

            {totalMarketPages > 1 && (
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setMarketCurrentPage(prev => Math.max(prev - 1, 1))}
                  disabled={marketCurrentPage === 1}
                  className="px-3 py-2 text-[#6B8782] hover:bg-[#D0E0DB] rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  &lt;
                </button>

                {[...Array(totalMarketPages)].map((_, index) => {
                  const pageNum = index + 1;
                  if (totalMarketPages <= 7) {
                    // Show all pages if 7 or fewer
                    return (
                      <button
                        key={pageNum}
                        onClick={() => setMarketCurrentPage(pageNum)}
                        className={`px-4 py-2 rounded-lg font-medium ${marketCurrentPage === pageNum
                          ? 'bg-[#0D8568] text-white'
                          : 'text-[#6B8782] hover:bg-[#D0E0DB]'
                          }`}
                      >
                        {pageNum}
                      </button>
                    );
                  } else {
                    // Condensed pagination for many pages
                    if (
                      pageNum === 1 ||
                      pageNum === totalMarketPages ||
                      (pageNum >= marketCurrentPage - 1 && pageNum <= marketCurrentPage + 1)
                    ) {
                      return (
                        <button
                          key={pageNum}
                          onClick={() => setMarketCurrentPage(pageNum)}
                          className={`px-4 py-2 rounded-lg font-medium ${marketCurrentPage === pageNum
                            ? 'bg-[#0D8568] text-white'
                            : 'text-[#6B8782] hover:bg-[#D0E0DB]'
                            }`}
                        >
                          {pageNum}
                        </button>
                      );
                    } else if (pageNum === marketCurrentPage - 2 || pageNum === marketCurrentPage + 2) {
                      return (
                        <span key={pageNum} className="px-2 py-2 text-[#6B8782]">
                          ...
                        </span>
                      );
                    }
                  }
                  return null;
                })}

                <button
                  onClick={() => setMarketCurrentPage(prev => Math.min(prev + 1, totalMarketPages))}
                  disabled={marketCurrentPage === totalMarketPages}
                  className="px-3 py-2 text-[#6B8782] hover:bg-[#D0E0DB] rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  &gt;
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Sell Stock Tab */}
      {activeTab === 'sell' && (
        <>
          {!showSellForm ? (
            <>
              {/* Add Sell Stock Button */}
              <div className="mb-6 flex justify-end">
                <button
                  onClick={() => setShowSellForm(true)}
                  className="px-6 py-3 bg-[#0D8568] text-white rounded-xl font-semibold hover:bg-[#0D7C66] transition-colors flex items-center gap-2"
                >
                  <Plus className="w-4 h-4" />
                  Add Sell Stock
                </button>
              </div>

              {/* Sell Stock Table */}
              <div className="bg-white rounded-2xl overflow-hidden border border-[#D0E0DB]">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="bg-[#D4F4E8]">
                        <th className="px-6 py-4 text-left text-sm font-semibold text-[#0D5C4D]">Date</th>
                        <th className="px-6 py-4 text-left text-sm font-semibold text-[#0D5C4D]">Stock Item</th>
                        <th className="px-6 py-4 text-left text-sm font-semibold text-[#0D5C4D]">Sold To</th>
                        <th className="px-6 py-4 text-left text-sm font-semibold text-[#0D5C4D]">Type</th>
                        <th className="px-6 py-4 text-left text-sm font-semibold text-[#0D5C4D]">Quantity (kg)</th>
                        <th className="px-6 py-4 text-left text-sm font-semibold text-[#0D5C4D]">Price/kg (₹)</th>
                        <th className="px-6 py-4 text-left text-sm font-semibold text-[#0D5C4D]">Total Amount (₹)</th>
                        <th className="px-6 py-4 text-left text-sm font-semibold text-[#0D5C4D]">Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {sellStockData.length === 0 ? (
                        <tr>
                          <td colSpan="8" className="px-6 py-8 text-center text-[#6B8782]">
                            No sell stock records available
                          </td>
                        </tr>
                      ) : (
                        sellStockData.map((item, index) => {
                          const stockItem = stockData.find(s => s.sid === item.stock_id);
                          const entityName = item.entity_type === 'supplier'
                            ? suppliers.find(s => s.sid === item.entity_id)?.supplier_name
                            : thirdParties.find(t => t.tid === item.entity_id)?.third_party_name;

                          return (
                            <tr key={item.id} className={`border-b border-[#D0E0DB] hover:bg-[#F0F4F3] transition-colors ${index % 2 === 0 ? 'bg-white' : 'bg-[#F0F4F3]/30'}`}>
                              <td className="px-6 py-4 text-sm text-[#6B8782]">
                                {new Date(item.createdAt).toLocaleDateString()}
                              </td>
                              <td className="px-6 py-4 text-sm font-medium text-[#0D5C4D]">
                                {item.stock_item_name || 'N/A'}
                              </td>
                              <td className="px-6 py-4 text-sm text-[#0D5C4D]">
                                {entityName || 'N/A'}
                              </td>
                              <td className="px-6 py-4">
                                <span className="px-3 py-1.5 rounded-full text-xs font-medium bg-[#D4F4E8] text-[#047857]">
                                  {item.entity_type === 'supplier' ? 'Supplier' : 'Third Party'}
                                </span>
                              </td>
                              <td className="px-6 py-4 text-sm font-semibold text-[#047857]">
                                {item.quantity}
                              </td>
                              <td className="px-6 py-4 text-sm text-[#0D5C4D]">
                                {item.price_per_kg}
                              </td>
                              <td className="px-6 py-4 text-sm font-bold text-[#0D5C4D]">
                                {item.total_amount}
                              </td>
                              <td className="px-6 py-4">
                                <button
                                  onClick={() => handleDeleteSellStock(item.id)}
                                  className="px-4 py-1.5 bg-red-100 text-red-700 rounded-lg text-xs font-medium hover:bg-red-200 transition-colors"
                                >
                                  Delete
                                </button>
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>

                <div className="flex items-center justify-between px-6 py-4 bg-[#F0F4F3] border-t border-[#D0E0DB]">
                  <div className="text-sm text-[#6B8782]">
                    Showing {sellStockData.length} records
                  </div>
                </div>
              </div>
            </>
          ) : (
            <div className="bg-white rounded-2xl p-8 border border-[#D0E0DB]">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-bold text-[#0D5C4D]">Add Sell Stock</h2>
                <button
                  onClick={() => setShowSellForm(false)}
                  className="px-4 py-2 border border-[#D0E0DB] text-[#6B8782] rounded-lg font-medium hover:bg-[#F0F4F3] transition-colors"
                >
                  Back to List
                </button>
              </div>
              <form onSubmit={handleSellSubmit} className="space-y-6">
                {/* Stock Item Selection - dropdown multiselect (aggregated by product) */}
                <div className="sell-dropdown">
                  <label className="block text-sm font-semibold text-[#0D5C4D] mb-2">
                    Select Stock Item
                  </label>
                  <div className="relative">
                    <button
                      type="button"
                      onClick={() => setOpenSellDropdown(openSellDropdown === 'stock' ? null : 'stock')}
                      className="w-full px-4 py-3 bg-[#F0F4F3] border border-[#D0E0DB] rounded-xl text-[#0D5C4D] focus:outline-none focus:ring-2 focus:ring-[#0D8568] flex items-center justify-between"
                    >
                      <span className="text-left truncate">
                        {selectedStockProductCount > 0
                          ? `${selectedStockProductCount} item(s) selected`
                          : 'Select stock item(s)'}
                      </span>
                      <ChevronDown className="w-4 h-4 text-[#6B8782] flex-shrink-0 ml-2" />
                    </button>

                    {openSellDropdown === 'stock' && (
                      <div className="absolute z-50 mt-1 w-full bg-white border border-[#D0E0DB] rounded-xl shadow-lg max-h-60 overflow-y-auto">
                        {aggregatedStockOptions.length === 0 ? (
                          <div className="px-4 py-3 text-sm text-[#6B8782]">No stock items available</div>
                        ) : (
                          aggregatedStockOptions.map((opt) => {
                            const selected = (sellForm.selectedStockItems || []).map(id => Number(id));
                            const allSelected = opt.stockIds.every(id => selected.includes(Number(id)));
                            const someSelected = opt.stockIds.some(id => selected.includes(Number(id)));
                            const toggleGroup = () => {
                              setSellForm(prev => {
                                const current = prev.selectedStockItems || [];
                                const next = allSelected
                                  ? current.filter(id => !opt.stockIds.includes(id))
                                  : [...new Set([...current, ...opt.stockIds])];
                                const selectedProductGroups = (aggregatedStockOptions || []).filter(o =>
                                  o.stockIds.some(id => next.includes(Number(id)))
                                );
                                const details = {};
                                selectedProductGroups.forEach(o => {
                                  details[o.productName] = (prev.itemDetails || {})[o.productName] || {
                                    quantity: '',
                                    pricePerKg: ''
                                  };
                                });
                                let total = 0;
                                Object.values(details).forEach(d => {
                                  total += (parseFloat(d.pricePerKg) || 0) * (parseFloat(d.quantity) || 0);
                                });
                                return { ...prev, selectedStockItems: next, itemDetails: details, totalAmount: total.toFixed(2) };
                              });
                            };
                            return (
                              <label
                                key={opt.productName}
                                onClick={(e) => e.stopPropagation()}
                                className={`w-full cursor-pointer px-4 py-2.5 text-sm hover:bg-[#F0F4F3] flex items-center gap-3 ${someSelected ? 'bg-[#D4F4E8] text-[#0D5C4D]' : 'text-[#0D5C4D]'}`}
                              >
                                <input
                                  type="checkbox"
                                  checked={someSelected}
                                  ref={el => { if (el) el.indeterminate = someSelected && !allSelected; }}
                                  onChange={toggleGroup}
                                  className="w-4 h-4 text-[#0D8568] focus:ring-[#0D8568] rounded flex-shrink-0"
                                />
                                <span>{opt.productName} — <strong>{parseFloat(opt.totalQuantity).toFixed(2)} kg</strong></span>
                              </label>
                            );
                          })
                        )}
                      </div>
                    )}
                  </div>
                  {selectedStockProductCount > 0 && (
                    <p className="mt-1 text-xs text-[#6B8782]">{selectedStockProductCount} product(s) selected</p>
                  )}
                </div>

                {/* Sell To Section - Supplier/Third Party */}
                <div>
                  <label className="block text-sm font-semibold text-[#0D5C4D] mb-2">
                    Sell To
                  </label>
                  <div className="grid grid-cols-2 gap-4 mb-4">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        name="entityType"
                        value="supplier"
                        checked={sellForm.entityType === 'supplier'}
                        onChange={(e) => {
                          handleSellFormChange('entityType', e.target.value);
                          handleSellFormChange('selectedEntity', '');
                        }}
                        className="w-4 h-4 text-[#0D8568] focus:ring-[#0D8568]"
                      />
                      <span className="text-[#0D5C4D]">Supplier</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        name="entityType"
                        value="thirdParty"
                        checked={sellForm.entityType === 'thirdParty'}
                        onChange={(e) => {
                          handleSellFormChange('entityType', e.target.value);
                          handleSellFormChange('selectedEntity', '');
                        }}
                        className="w-4 h-4 text-[#0D8568] focus:ring-[#0D8568]"
                      />
                      <span className="text-[#0D5C4D]">Third Party</span>
                    </label>
                  </div>

                  {/* Supplier/Third Party Dropdown */}
                  {(sellForm.entityType === 'supplier' || sellForm.entityType === 'thirdParty') && (
                    <select
                      value={sellForm.selectedEntity}
                      onChange={(e) => handleSellFormChange('selectedEntity', e.target.value)}
                      className="w-full px-4 py-3 bg-[#F0F4F3] border border-[#D0E0DB] rounded-xl text-[#0D5C4D] focus:outline-none focus:ring-2 focus:ring-[#0D8568]"
                      required
                    >
                      <option value="">
                        Select {sellForm.entityType === 'supplier' ? 'Supplier' : 'Third Party'}
                      </option>
                      {sellForm.entityType === 'supplier' && sortDropdownObjects(suppliers, (supplier) => supplier.supplier_name).map((supplier) => (
                        <option key={supplier.sid} value={supplier.sid}>
                          {supplier.supplier_name} - {supplier.phone}
                        </option>
                      ))}
                      {sellForm.entityType === 'thirdParty' && sortDropdownObjects(thirdParties, (thirdParty) => thirdParty.third_party_name).map((thirdParty) => (
                        <option key={thirdParty.tid} value={thirdParty.tid}>
                          {thirdParty.third_party_name} - {thirdParty.phone}
                        </option>
                      ))}
                    </select>
                  )}
                </div>

                {/* Driver Section */}
                <div>
                  <label className="block text-sm font-semibold text-[#0D5C4D] mb-2">
                    Driver
                  </label>
                  <select
                    value={sellForm.driverId}
                    onChange={(e) => handleSellFormChange('driverId', e.target.value)}
                    className="w-full px-4 py-3 bg-[#F0F4F3] border border-[#D0E0DB] rounded-xl text-[#0D5C4D] focus:outline-none focus:ring-2 focus:ring-[#0D8568]"
                  >
                    <option value="">Select Driver</option>
                    {sortDropdownObjects(drivers, (driver) => driver.driver_name).map((driver) => (
                      <option key={driver.did} value={driver.did}>
                        {driver.driver_name} - {driver.phone_number}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Labour Section - dropdown multiselect (same pattern as OrderAssignCreateStage2) */}
                <div className="sell-dropdown">
                  <label className="block text-sm font-semibold text-[#0D5C4D] mb-2">
                    Labour
                  </label>
                  <div className="relative">
                    <button
                      type="button"
                      onClick={() => setOpenSellDropdown(openSellDropdown === 'labour' ? null : 'labour')}
                      className="w-full px-4 py-3 bg-[#F0F4F3] border border-[#D0E0DB] rounded-xl text-[#0D5C4D] focus:outline-none focus:ring-2 focus:ring-[#0D8568] flex items-center justify-between"
                    >
                      <span className="text-left truncate">
                        {sellForm.selectedLabours?.length > 0
                          ? `${sellForm.selectedLabours.length} labour(s) selected`
                          : 'Select Labour'}
                      </span>
                      <ChevronDown className="w-4 h-4 text-[#6B8782] flex-shrink-0 ml-2" />
                    </button>

                    {openSellDropdown === 'labour' && (
                      <div className="absolute z-50 mt-1 w-full bg-white border border-[#D0E0DB] rounded-xl shadow-lg max-h-60 overflow-y-auto">
                        {labours.length > 0 ? (
                          sortDropdownObjects(labours, (labour) => labour.full_name).map((labour) => {
                            const labourId = String(labour.lid);
                            const isSelected = (sellForm.selectedLabours || []).includes(labourId);

                            return (
                              <label
                                key={labour.lid}
                                onClick={(e) => e.stopPropagation()}
                                className={`w-full cursor-pointer px-4 py-2.5 text-sm hover:bg-[#F0F4F3] flex items-center gap-3 ${isSelected ? 'bg-[#D4F4E8] text-[#0D5C4D]' : 'text-[#0D5C4D]'}`}
                              >
                                <input
                                  type="checkbox"
                                  checked={isSelected}
                                  onChange={() => {
                                    const current = sellForm.selectedLabours || [];
                                    const next = isSelected
                                      ? current.filter(id => id !== labourId)
                                      : [...current, labourId];
                                    handleSellFormChange('selectedLabours', next);
                                  }}
                                  className="w-4 h-4 text-[#0D8568] focus:ring-[#0D8568] rounded flex-shrink-0"
                                />
                                <span>{labour.full_name} — {labour.mobile_number}</span>
                              </label>
                            );
                          })
                        ) : (
                          <div className="px-4 py-3 text-sm text-[#6B8782]">No labours available</div>
                        )}
                      </div>
                    )}
                  </div>
                  {sellForm.selectedLabours?.length > 0 && (
                    <p className="mt-1 text-xs text-[#0D5C4D]">{sellForm.selectedLabours.length} labour(s) selected</p>
                  )}
                </div>

                {/* Per-product price and quantity (grouped like the stock dropdown, with total stock kg) */}
                {selectedProductsForSell.length > 0 && (
                  <div>
                    <label className="block text-sm font-semibold text-[#0D5C4D] mb-2">
                      Price & Quantity per product
                    </label>
                    <div className="space-y-4">
                      {selectedProductsForSell.map(({ productName, totalQuantity }) => {
                        const detail = (sellForm.itemDetails || {})[productName] || { pricePerKg: '', quantity: '' };
                        const matchedProduct = (products || []).find(p =>
                          (p.product_name || '').toLowerCase().trim() === (productName || '').toLowerCase().trim()
                        );
                        const { price: marketPrice, isUpdatedToday } = matchedProduct ? getMarketPriceForSell(matchedProduct) : { price: null, isUpdatedToday: false };
                        const hasValidPrice = marketPrice != null && marketPrice > 0;
                        return (
                          <div
                            key={productName}
                            className="p-4 bg-[#F0F4F3] border border-[#D0E0DB] rounded-xl space-y-3"
                          >
                            <div className="font-medium text-[#0D5C4D]">
                              {productName}
                              <span className="ml-2 text-xs font-normal text-[#6B8782]">
                                (total stock: {totalQuantity.toFixed(2)} kg)
                              </span>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                              <div>
                                <label className="block text-xs font-medium text-[#6B8782] mb-1">Quantity (kg)</label>
                                <input
                                  type="text"
                                  value={detail.quantity}
                                  onChange={(e) => handleSellItemDetailChange(productName, 'quantity', e.target.value)}
                                  className={`w-full px-3 py-2 bg-white border rounded-lg text-[#0D5C4D] focus:outline-none focus:ring-2 text-sm ${(parseFloat(detail.quantity) || 0) > totalQuantity ? 'border-red-500 focus:ring-red-500' : 'border-[#D0E0DB] focus:ring-[#0D8568]'}`}
                                  placeholder="Qty"
                                  required
                                />
                                {(parseFloat(detail.quantity) || 0) > totalQuantity && (
                                  <p className="mt-1 text-xs font-medium text-red-600">
                                    Quantity exceeds available stock ({totalQuantity.toFixed(2)} kg)
                                  </p>
                                )}
                              </div>
                              <div>
                                <label className="block text-xs font-medium text-[#6B8782] mb-1">Market price (₹/kg)</label>
                                <div className="flex items-center gap-2 flex-wrap">
                                  {hasValidPrice && isUpdatedToday ? (
                                    <span className="text-sm font-semibold text-[#0D5C4D]">
                                      ₹{Number(marketPrice).toFixed(2)}
                                    </span>
                                  ) : (
                                    <span className="text-xs text-red-600 bg-red-50 px-2 py-1 rounded-full font-medium">
                                      Update price
                                    </span>
                                  )}
                                </div>
                                <label className="block text-xs font-medium text-[#6B8782] mb-1 mt-2">Price per Kg (₹)</label>
                                <input
                                  type="text"
                                  value={detail.pricePerKg}
                                  onChange={(e) => handleSellItemDetailChange(productName, 'pricePerKg', e.target.value)}
                                  className="w-full px-3 py-2 bg-white border border-[#D0E0DB] rounded-lg text-[#0D5C4D] focus:outline-none focus:ring-2 focus:ring-[#0D8568] text-sm"
                                  placeholder="Price"
                                  required
                                />
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Total Amount (Read-only) */}
                <div>
                  <label className="block text-sm font-semibold text-[#0D5C4D] mb-2">
                    Total Amount (₹)
                  </label>
                  <input
                    type="text"
                    value={sellForm.totalAmount}
                    readOnly
                    className="w-full px-4 py-3 bg-[#D4F4E8] border border-[#D0E0DB] rounded-xl text-[#0D5C4D] font-bold text-lg"
                    placeholder="0.00"
                  />
                </div>

                {/* Submit Button */}
                <div className="flex gap-4">
                  <button
                    type="submit"
                    className="flex-1 px-6 py-3 bg-[#0D8568] text-white rounded-xl font-semibold hover:bg-[#0D7C66] transition-colors"
                  >
                    Sell Stock
                  </button>
                  <button
                    type="button"
                    onClick={() => setSellForm({
                      selectedStockItems: [],
                      entityType: 'supplier',
                      selectedEntity: '',
                      driverId: '',
                      selectedLabours: [],
                      itemDetails: {},
                      totalAmount: 0
                    })}
                    className="px-6 py-3 border border-[#D0E0DB] text-[#6B8782] rounded-xl font-semibold hover:bg-[#F0F4F3] transition-colors"
                  >
                    Reset
                  </button>
                </div>
              </form>
            </div>
          )}
        </>
      )}

      {/* Inventory Stock Tab */}
      {activeTab === 'inventory' && (
        <>
          {!showInventoryForm ? (
            <>
              <div className="mb-6 flex flex-col md:flex-row gap-4 justify-between items-stretch md:items-center">
                {/* Inventory search */}
                <div className="relative max-w-md w-full">
                  <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-[#6B8782]" />
                  <input
                    type="text"
                    placeholder="Search invoice, company, item, HSN..."
                    value={inventorySearchTerm}
                    onChange={(e) => {
                      setInventorySearchTerm(e.target.value);
                      setInventoryCurrentPage(1);
                    }}
                    className="w-full pl-12 pr-4 py-3 bg-[#F0F4F3] border-none rounded-xl text-[#0D5C4D] placeholder-[#6B8782] focus:outline-none focus:ring-2 focus:ring-[#0D8568] text-sm"
                  />
                </div>

                {/* Add Inventory button */}
                <div className="flex justify-end">
                  <button
                    onClick={() => setShowInventoryForm(true)}
                    className="px-6 py-3 bg-[#0D8568] text-white rounded-xl font-semibold hover:bg-[#0D7C66] transition-colors flex items-center gap-2"
                  >
                    <Plus className="w-4 h-4" />
                    Add Inventory Stock
                  </button>
                </div>
              </div>

              <div className="bg-white rounded-2xl overflow-hidden border border-[#D0E0DB]">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="bg-[#D4F4E8]">
                        <th className="px-6 py-4 text-left text-sm font-semibold text-[#0D5C4D]">Date</th>
                        <th className="px-6 py-4 text-left text-sm font-semibold text-[#0D5C4D]">Invoice No</th>
                        <th className="px-6 py-4 text-left text-sm font-semibold text-[#0D5C4D]">Company Name</th>
                        <th className="px-6 py-4 text-left text-sm font-semibold text-[#0D5C4D]">Items Detail</th>
                        <th className="px-6 py-4 text-left text-sm font-semibold text-[#0D5C4D]">Total Amount (₹)</th>
                        <th className="px-6 py-4 text-left text-sm font-semibold text-[#0D5C4D]">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {inventoryPaginatedData.length === 0 ? (
                        <tr>
                          <td colSpan="6" className="px-6 py-8 text-center text-[#6B8782]">
                            No inventory records available
                          </td>
                        </tr>
                      ) : (
                        inventoryPaginatedData.map((item, index) => {
                          let itemsList = [];
                          try {
                            itemsList = typeof item.items === 'string' ? JSON.parse(item.items) : (Array.isArray(item.items) ? item.items : []);
                          } catch (e) {
                            itemsList = [];
                          }

                          return (
                            <tr key={`${item.id}-${index}`} className={`border-b border-[#D0E0DB] hover:bg-[#F0F4F3] transition-colors ${index % 2 === 0 ? 'bg-white' : 'bg-[#F0F4F3]/30'}`}>
                              <td className="px-6 py-4 text-sm text-[#6B8782]">
                                {item.date ? new Date(item.date).toLocaleDateString() : 'N/A'}
                              </td>
                              <td className="px-6 py-4 text-sm font-medium text-[#0D5C4D]">{item.invoice_no}</td>
                              <td className="px-6 py-4 text-sm text-[#0D5C4D]">{item.company_name}</td>
                              <td className="px-6 py-4 text-sm text-[#0D5C4D]">
                                <div className="space-y-1">
                                  {itemsList.map((subItem, subIdx) => (
                                    <div key={subIdx} className="text-xs border-b border-[#D0E0DB]/50 pb-1 last:border-0 last:pb-0">
                                      <span className="font-semibold">{subItem.item_name}</span>
                                      <div className="flex gap-2 text-[#6B8782]">
                                        <span>HSN: {subItem.hsn_code}</span>
                                        <span>Qty: {subItem.quantity}</span>
                                        <span>₹{subItem.price_per_unit}</span>
                                        <span>GST: {subItem.gst_percentage}%</span>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </td>
                              <td className="px-6 py-4 text-sm font-bold text-[#0D5C4D]">
                                ₹{parseFloat(item.total_with_gst || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                              </td>
                              <td className="px-6 py-4">
                                <div className="flex gap-2">
                                  <button
                                    onClick={() => handleEditInventory(item)}
                                    className="px-3 py-1.5 bg-blue-100 text-blue-700 rounded-lg text-xs font-medium hover:bg-blue-200 transition-colors"
                                  >
                                    Edit
                                  </button>
                                  <button
                                    onClick={() => handleDeleteInventory(item.id)}
                                    className="px-3 py-1.5 bg-red-100 text-red-700 rounded-lg text-xs font-medium hover:bg-red-200 transition-colors"
                                  >
                                    Delete
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>

                <div className="flex items-center justify-between px-6 py-4 bg-[#F0F4F3] border-t border-[#D0E0DB]">
                  <div className="text-sm text-[#6B8782]">
                    {filteredInventoryData.length > 0 ? (
                      `Showing ${inventoryStartIndex + 1} to ${Math.min(
                        inventoryStartIndex + inventoryItemsPerPage,
                        filteredInventoryData.length
                      )} of ${filteredInventoryData.length} records`
                    ) : (
                      'No inventory records found'
                    )}
                  </div>

                  {totalInventoryPages > 1 && (
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setInventoryCurrentPage(prev => Math.max(prev - 1, 1))}
                        disabled={inventoryCurrentPage === 1}
                        className="px-3 py-2 text-[#6B8782] hover:bg-[#D0E0DB] rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        &lt;
                      </button>

                      {[...Array(totalInventoryPages)].map((_, index) => {
                        const pageNum = index + 1;
                        if (totalInventoryPages <= 7) {
                          return (
                            <button
                              key={pageNum}
                              onClick={() => setInventoryCurrentPage(pageNum)}
                              className={`px-4 py-2 rounded-lg font-medium ${inventoryCurrentPage === pageNum
                                ? 'bg-[#0D8568] text-white'
                                : 'text-[#6B8782] hover:bg-[#D0E0DB]'
                                }`}
                            >
                              {pageNum}
                            </button>
                          );
                        } else {
                          if (
                            pageNum === 1 ||
                            pageNum === totalInventoryPages ||
                            (pageNum >= inventoryCurrentPage - 1 && pageNum <= inventoryCurrentPage + 1)
                          ) {
                            return (
                              <button
                                key={pageNum}
                                onClick={() => setInventoryCurrentPage(pageNum)}
                                className={`px-4 py-2 rounded-lg font-medium ${inventoryCurrentPage === pageNum
                                  ? 'bg-[#0D8568] text-white'
                                  : 'text-[#6B8782] hover:bg-[#D0E0DB]'
                                  }`}
                              >
                                {pageNum}
                              </button>
                            );
                          } else if (
                            pageNum === inventoryCurrentPage - 2 ||
                            pageNum === inventoryCurrentPage + 2
                          ) {
                            return (
                              <span key={pageNum} className="px-2 py-2 text-[#6B8782]">
                                ...
                              </span>
                            );
                          }
                        }
                        return null;
                      })}

                      <button
                        onClick={() =>
                          setInventoryCurrentPage(prev => Math.min(prev + 1, totalInventoryPages))
                        }
                        disabled={inventoryCurrentPage === totalInventoryPages}
                        className="px-3 py-2 text-[#6B8782] hover:bg-[#D0E0DB] rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        &gt;
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </>
          ) : (
            <div className="bg-white rounded-2xl p-8 border border-[#D0E0DB]">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-bold text-[#0D5C4D]">{editingInventory ? 'Edit' : 'Add'} Inventory Stock</h2>
                <button
                  onClick={() => {
                    setShowInventoryForm(false);
                    setEditingInventory(null);
                    setInventoryForm({
                      invoiceNo: '',
                      companyName: '',
                      companyId: '',
                      date: '',
                      items: []
                    });
                  }}
                  className="px-4 py-2 border border-[#D0E0DB] text-[#6B8782] rounded-lg font-medium hover:bg-[#F0F4F3] transition-colors"
                >
                  Back to List
                </button>
              </div>
              <form onSubmit={handleInventorySubmit} className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div>
                    <label className="block text-sm font-semibold text-[#0D5C4D] mb-2">Date</label>
                    <input
                      type="date"
                      value={inventoryForm.date}
                      onChange={(e) => handleInventoryFormChange('date', e.target.value)}
                      className="w-full px-4 py-3 bg-[#F0F4F3] border border-[#D0E0DB] rounded-xl text-[#0D5C4D] focus:outline-none focus:ring-2 focus:ring-[#0D8568]"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-[#0D5C4D] mb-2">Invoice No</label>
                    <input
                      type="text"
                      value={inventoryForm.invoiceNo}
                      onChange={(e) => handleInventoryFormChange('invoiceNo', e.target.value)}
                      className="w-full px-4 py-3 bg-[#F0F4F3] border border-[#D0E0DB] rounded-xl text-[#0D5C4D] focus:outline-none focus:ring-2 focus:ring-[#0D8568]"
                      placeholder="Enter invoice number"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-[#0D5C4D] mb-2">Company Name</label>
                    <select
                      value={inventoryForm.companyId}
                      onChange={(e) => {
                        const selectedCompany = inventoryCompanies.find(c => c.id === parseInt(e.target.value));
                        handleInventoryFormChange('companyId', e.target.value);
                        handleInventoryFormChange('companyName', selectedCompany?.name || '');
                      }}
                      className="w-full px-4 py-3 bg-[#F0F4F3] border border-[#D0E0DB] rounded-xl text-[#0D5C4D] focus:outline-none focus:ring-2 focus:ring-[#0D8568]"
                      required
                    >
                      <option value="">Select company</option>
                      {sortDropdownObjects(inventoryCompanies, (company) => company.name).map((company) => (
                        <option key={company.id} value={company.id}>
                          {company.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="border-t border-[#D0E0DB] pt-6">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-semibold text-[#0D5C4D]">Items</h3>
                    <button
                      type="button"
                      onClick={addInventoryItem}
                      className="px-4 py-2 bg-[#0D8568] text-white rounded-lg font-medium hover:bg-[#0D7C66] transition-colors flex items-center gap-2"
                    >
                      <Plus className="w-4 h-4" />
                      Add Item
                    </button>
                  </div>

                  {inventoryForm.items.length === 0 ? (
                    <div className="text-center py-8 bg-[#F0F4F3] rounded-xl text-[#6B8782]">
                      No items added. Click "Add Item" to start.
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {inventoryForm.items.map((item, index) => (
                        <div key={index} className="p-4 bg-[#F0F4F3] border border-[#D0E0DB] rounded-xl">
                          <div className="flex items-center justify-between mb-3">
                            <span className="text-sm font-semibold text-[#0D5C4D]">Item {index + 1}</span>
                            <button
                              type="button"
                              onClick={() => removeInventoryItem(index)}
                              className="px-3 py-1 bg-red-100 text-red-700 rounded-lg text-xs font-medium hover:bg-red-200 transition-colors"
                            >
                              Remove
                            </button>
                          </div>
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div>
                              <label className="block text-xs font-medium text-[#6B8782] mb-1">Item</label>
                              <select
                                value={item.inventoryId}
                                onChange={(e) => {
                                  const selectedProduct = inventoryProducts.find(p => p.id === parseInt(e.target.value));
                                  handleInventoryItemChange(index, 'inventoryId', e.target.value);
                                  handleInventoryItemChange(index, 'item', selectedProduct?.name || '');
                                }}
                                className="w-full px-3 py-2 bg-white border border-[#D0E0DB] rounded-lg text-[#0D5C4D] focus:outline-none focus:ring-2 focus:ring-[#0D8568] text-sm"
                                required
                              >
                                <option value="">Select item</option>
                                {sortDropdownObjects(inventoryProducts, (product) => product.name).map((product) => (
                                  <option key={product.id} value={product.id}>
                                    {product.name}
                                  </option>
                                ))}
                              </select>
                            </div>
                            <div>
                              <label className="block text-xs font-medium text-[#6B8782] mb-1">HSN Code</label>
                              <input
                                type="text"
                                value={item.hsnCode}
                                onChange={(e) => handleInventoryItemChange(index, 'hsnCode', e.target.value)}
                                className="w-full px-3 py-2 bg-white border border-[#D0E0DB] rounded-lg text-[#0D5C4D] focus:outline-none focus:ring-2 focus:ring-[#0D8568] text-sm"
                                placeholder="HSN code"
                                required
                              />
                            </div>
                            <div>
                              <label className="block text-xs font-medium text-[#6B8782] mb-1">Quantity</label>
                              <input
                                type="text"
                                value={item.quantity}
                                onChange={(e) => handleInventoryItemChange(index, 'quantity', e.target.value)}
                                className="w-full px-3 py-2 bg-white border border-[#D0E0DB] rounded-lg text-[#0D5C4D] focus:outline-none focus:ring-2 focus:ring-[#0D8568] text-sm"
                                placeholder="Quantity"
                                required
                              />
                            </div>
                            <div>
                              <label className="block text-xs font-medium text-[#6B8782] mb-1">Price/Unit (₹)</label>
                              <input
                                type="text"
                                value={item.pricePerUnit}
                                onChange={(e) => handleInventoryItemChange(index, 'pricePerUnit', e.target.value)}
                                className="w-full px-3 py-2 bg-white border border-[#D0E0DB] rounded-lg text-[#0D5C4D] focus:outline-none focus:ring-2 focus:ring-[#0D8568] text-sm"
                                placeholder="Price"
                                required
                              />
                            </div>
                            <div>
                              <label className="block text-xs font-medium text-[#6B8782] mb-1">GST (%)</label>
                              <input
                                type="text"
                                value={item.gst}
                                onChange={(e) => handleInventoryItemChange(index, 'gst', e.target.value)}
                                className="w-full px-3 py-2 bg-white border border-[#D0E0DB] rounded-lg text-[#0D5C4D] focus:outline-none focus:ring-2 focus:ring-[#0D8568] text-sm"
                                placeholder="GST % (optional)"
                              />
                            </div>
                            <div>
                              <label className="block text-xs font-medium text-[#6B8782] mb-1">Total with GST (₹)</label>
                              <input
                                type="text"
                                value={calculateItemTotal(item)}
                                readOnly
                                className="w-full px-3 py-2 bg-[#D4F4E8] border border-[#D0E0DB] rounded-lg text-[#0D5C4D] font-semibold text-sm"
                              />
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="border-t border-[#D0E0DB] pt-6">
                  <div className="flex items-center justify-between mb-4">
                    <span className="text-lg font-semibold text-[#0D5C4D]">Grand Total (₹)</span>
                    <span className="text-2xl font-bold text-[#0D8568]">{calculateGrandTotal()}</span>
                  </div>
                </div>

                <div className="flex gap-4">
                  <button
                    type="submit"
                    className="flex-1 px-6 py-3 bg-[#0D8568] text-white rounded-xl font-semibold hover:bg-[#0D7C66] transition-colors"
                  >
                    {editingInventory ? 'Update' : 'Add'} Inventory
                  </button>
                  <button
                    type="button"
                    onClick={() => setInventoryForm({
                      invoiceNo: '',
                      companyName: '',
                      companyId: '',
                      date: '',
                      items: []
                    })}
                    className="px-6 py-3 border border-[#D0E0DB] text-[#6B8782] rounded-xl font-semibold hover:bg-[#F0F4F3] transition-colors"
                  >
                    Reset
                  </button>
                </div>
              </form>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default StockManagement;