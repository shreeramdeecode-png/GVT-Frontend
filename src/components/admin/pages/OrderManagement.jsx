import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, ChevronDown, MoreVertical, ChevronLeft, ChevronRight, Eye, Edit, Trash2 } from 'lucide-react';
import { getAllOrders, deleteOrder, getAllDrafts, deleteDraft } from '../../../api/orderApi'; // Import the order and draft APIs
import ConfirmDeleteModal from '../../common/ConfirmDeleteModal'; // Import the confirm delete modal

const filterByDateRange = (items, timeFilter, getItemDate) => {
  if (timeFilter === 'All Time') return items;

  const now = new Date();

  const inRange = (d, start, end) => d >= start && d <= end;

  let startDate;
  let endDate;

  switch (timeFilter) {
    case 'Today':
      startDate = new Date(now);
      startDate.setHours(0, 0, 0, 0);
      endDate = new Date(now);
      endDate.setHours(23, 59, 59, 999);
      break;
    case 'Yesterday':
      startDate = new Date(now);
      startDate.setDate(now.getDate() - 1);
      startDate.setHours(0, 0, 0, 0);
      endDate = new Date(now);
      endDate.setDate(now.getDate() - 1);
      endDate.setHours(23, 59, 59, 999);
      break;
    case 'Last 7 Days':
      startDate = new Date(now);
      startDate.setDate(now.getDate() - 7);
      startDate.setHours(0, 0, 0, 0);
      endDate = new Date(now);
      endDate.setHours(23, 59, 59, 999);
      break;
    case 'Last 30 Days':
      startDate = new Date(now);
      startDate.setDate(now.getDate() - 30);
      startDate.setHours(0, 0, 0, 0);
      endDate = new Date(now);
      endDate.setHours(23, 59, 59, 999);
      break;
    case 'This Month':
      startDate = new Date(now.getFullYear(), now.getMonth(), 1);
      startDate.setHours(0, 0, 0, 0);
      endDate = new Date(now);
      endDate.setHours(23, 59, 59, 999);
      break;
    case 'Last Month':
      startDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      startDate.setHours(0, 0, 0, 0);
      endDate = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);
      break;
    default:
      return items;
  }

  return items.filter(item => {
    const raw = getItemDate(item);
    if (raw == null || raw === '') return false;
    const itemDate = new Date(raw);
    if (Number.isNaN(itemDate.getTime())) return false;
    return inRange(itemDate, startDate, endDate);
  });
};

const escapeCsvCell = (val) => {
  const s = String(val ?? '');
  if (/[",\n\r]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
};

/** First usable date for filtering (API may use camelCase or snake_case). Prefer business received date. */
const getOrderFilterDate = (o) =>
  o.orderReceivedDate ?? o.createdAt ?? o.updatedAt ?? o.created_at ?? o.updated_at ?? null;

const getDraftFilterDate = (d) =>
  d.createdAt ?? d.updatedAt ?? d.created_at ?? d.updated_at ?? null;

const normalizeStatusKey = (s) =>
  String(s ?? '')
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '')
    .replace(/_/g, '');

const OrderManagement = () => {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [timeFilter, setTimeFilter] = useState('All Time');
  const [statusFilter, setStatusFilter] = useState('All Status');
  const [showTimeFilter, setShowTimeFilter] = useState(false);
  const [showStatusFilter, setShowStatusFilter] = useState(false);

  // Filter options
  const timeFilterOptions = ['All Time', 'Today', 'Yesterday', 'Last 7 Days', 'Last 30 Days', 'This Month', 'Last Month'];
  const statusFilterOptions = ['All Status', 'Pending', 'Confirmed', 'Processing', 'Shipped', 'Delivered', 'Cancelled'];
  const [orders, setOrders] = useState([]); // State for orders
  const [drafts, setDrafts] = useState([]); // State for drafts
  const [activeTab, setActiveTab] = useState(() => {
    // Check URL parameters to determine initial tab
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get('tab') === 'drafts' ? 'drafts' : 'orders';
  }); // Tab state for orders/drafts
  const [loading, setLoading] = useState(true); // Loading state
  const [error, setError] = useState(null); // Error state
  const [openDropdown, setOpenDropdown] = useState(null);
  const [dropdownPosition, setDropdownPosition] = useState({ top: 0, left: 0 });
  const dropdownRef = useRef(null);
  const timeFilterRef = useRef(null);
  const statusFilterRef = useRef(null);
  const [deleteModal, setDeleteModal] = useState({ isOpen: false, orderId: null });
  const [deleteDraftModal, setDeleteDraftModal] = useState({ isOpen: false, draftId: null });

  // Fetch orders when component mounts
  useEffect(() => {
    const fetchOrders = async () => {
      try {
        setLoading(true);
        const response = await getAllOrders();
        if (response.success) {
          // Transform the data to match the existing structure
          const transformedOrders = response.data.map(order => ({
            id: order.oid,
            orderId: order.order_id,
            orderReceivedDate: order.order_received_date,
            customer: order.customer_name,
            boxes: order.items.reduce((sum, item) => {
              const numBoxes = parseInt(item.num_boxes) || 0;
              return sum + numBoxes;
            }, 0),
            packing: order.items.map(item => item.packing_type).filter(Boolean)[0] || 'N/A',
            netWeight: order.items.reduce((sum, item) => sum + (parseFloat(item.net_weight) || 0), 0) + ' kg',
            grossWeight: order.items.reduce((sum, item) => sum + (parseFloat(item.gross_weight) || 0), 0) + ' kg',
            order_type: order.order_type,
            status: order.order_status || 'pending',
            products: order.items.map(item => item.product).filter(Boolean),
            createdAt: order.createdAt ?? order.created_at ?? null,
            updatedAt: order.updatedAt ?? order.updated_at ?? null
          }));

          // Sort by createdAt descending (newest first)
          const sortedOrders = [...transformedOrders].sort((a, b) => {
            const dateA = new Date(a.createdAt || 0);
            const dateB = new Date(b.createdAt || 0);
            return dateB - dateA;
          });

          setOrders(sortedOrders);
        } else {
          setError('Failed to fetch orders');
        }
      } catch (err) {
        setError('Error fetching orders: ' + err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchOrders();
  }, []);

  // Fetch drafts from backend
  const fetchDrafts = async () => {
    try {
      const response = await getAllDrafts();
      if (response.success) {
        const draftData = response.data.map(draft => {
          // draft_data may be JSON string or object
          let draftDataParsed = draft.draft_data;
          if (typeof draftDataParsed === 'string') {
            try {
              draftDataParsed = JSON.parse(draftDataParsed);
            } catch {
              draftDataParsed = {};
            }
          }
          const products = draftDataParsed?.products || [];
          const productList = products.map(p => p.productName || p.product_name).filter(Boolean);

          return {
            id: draft.did,
            customer: draft.customer_name || 'Unnamed Customer',
            productList: productList.length > 0 ? productList.join(', ') : '—',
            orderType: draft.order_type || '—',
            packingDate: draft.packing_date || '—',
            total: '₹' + (parseFloat(draft.total_amount) || 0).toLocaleString(),
            products,
            createdAt: draft.createdAt ?? draft.created_at ?? null,
            updatedAt: draft.updatedAt ?? draft.updated_at ?? null
          };
        });
        setDrafts(draftData);
      }
    } catch (err) {
      console.error('Error fetching drafts:', err);
    }
  };

  useEffect(() => {
    fetchDrafts();
  }, []);

  useEffect(() => {
    if (activeTab === 'drafts') {
      fetchDrafts();
    }
  }, [activeTab]);

  // Periodically refresh drafts when on the drafts tab
  useEffect(() => {
    let intervalId;
    if (activeTab === 'drafts') {
      intervalId = setInterval(() => {
        fetchDrafts();
      }, 5000); // Refresh every 5 seconds
    }
    return () => {
      if (intervalId) {
        clearInterval(intervalId);
      }
    };
  }, [activeTab]);

  // Refresh drafts when window gains focus
  useEffect(() => {
    const handleWindowFocus = () => {
      if (activeTab === 'drafts') {
        fetchDrafts();
      }
    };

    window.addEventListener('focus', handleWindowFocus);
    return () => {
      window.removeEventListener('focus', handleWindowFocus);
    };
  }, [activeTab]);

  const filteredOrders = useMemo(() => {
    let filtered = [...orders];
    filtered = filterByDateRange(filtered, timeFilter, (o) => getOrderFilterDate(o));

    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(order =>
        String(order.id).toLowerCase().includes(query) ||
        String(order.orderId || '').toLowerCase().includes(query) ||
        (order.customer && order.customer.toLowerCase().includes(query))
      );
    }

    if (statusFilter !== 'All Status') {
      const wanted = normalizeStatusKey(statusFilter);
      filtered = filtered.filter(order => normalizeStatusKey(order.status) === wanted);
    }

    return filtered;
  }, [orders, searchQuery, statusFilter, timeFilter]);

  const filteredDrafts = useMemo(() => {
    let filtered = [...drafts];
    filtered = filterByDateRange(filtered, timeFilter, (d) => getDraftFilterDate(d));

    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(draft =>
        String(draft.id).toLowerCase().includes(query) ||
        (draft.customer && draft.customer.toLowerCase().includes(query)) ||
        (draft.productList && draft.productList.toLowerCase().includes(query))
      );
    }

    return filtered;
  }, [drafts, searchQuery, timeFilter]);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, statusFilter, timeFilter, activeTab]);

  const handleExport = () => {
    const rows = [];
    let filename = 'export';

    if (activeTab === 'orders') {
      filename = `orders-${new Date().toISOString().slice(0, 10)}`;
      rows.push(['Order ID', 'Order Received Date', 'Customer', 'No of Boxes/Bag', 'Type of Packing', 'Net Weight', 'Gross Weight', 'Status'].map(escapeCsvCell).join(','));
      filteredOrders.forEach((order) => {
        const received = order.orderReceivedDate
          ? new Date(order.orderReceivedDate).toLocaleDateString()
          : '';
        rows.push([
          order.orderId || order.id,
          received,
          order.customer,
          order.boxes,
          order.packing,
          order.netWeight,
          order.grossWeight,
          order.status || ''
        ].map(escapeCsvCell).join(','));
      });
    } else {
      filename = `drafts-${new Date().toISOString().slice(0, 10)}`;
      rows.push(['Draft ID', 'Customer', 'Product list', 'Order type', 'Packing date', 'Total'].map(escapeCsvCell).join(','));
      filteredDrafts.forEach((draft) => {
        rows.push([
          draft.id,
          draft.customer,
          draft.productList,
          draft.orderType,
          draft.packingDate,
          draft.total
        ].map(escapeCsvCell).join(','));
      });
    }

    const csv = rows.join('\r\n');
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `${filename}.csv`;
    link.click();
    URL.revokeObjectURL(link.href);
  };

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setOpenDropdown(null);
      }

      // Close filter dropdowns when clicking outside (menu is sibling of toggle, not inside [data-filter])
      if (showTimeFilter || showStatusFilter) {
        const insideTime = timeFilterRef.current?.contains(event.target);
        const insideStatus = statusFilterRef.current?.contains(event.target);
        if (!insideTime && !insideStatus) {
          setShowTimeFilter(false);
          setShowStatusFilter(false);
        }
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showTimeFilter, showStatusFilter]);

  const toggleDropdown = (orderId, event) => {
    if (openDropdown === orderId) {
      setOpenDropdown(null);
    } else {
      const rect = event.currentTarget.getBoundingClientRect();
      setDropdownPosition({
        top: rect.bottom + window.scrollY + 8,
        left: rect.right + window.scrollX - 128 // 128px is dropdown width (w-32)
      });
      setOpenDropdown(orderId);
    }
  };

  const handleDeleteOrder = async (orderId) => {
    try {
      await deleteOrder(orderId);
      // Refresh the orders list after deletion
      const response = await getAllOrders();
      if (response.success) {
        const transformedOrders = response.data.map(order => ({
          id: order.oid,
          orderId: order.order_id,
          orderReceivedDate: order.order_received_date,
          customer: order.customer_name,
          boxes: order.items.reduce((sum, item) => {
            const numBoxes = parseInt(item.num_boxes) || 0;
            return sum + numBoxes;
          }, 0),
          packing: order.items.map(item => item.packing_type).filter(Boolean)[0] || 'N/A',
          netWeight: order.items.reduce((sum, item) => sum + (parseFloat(item.net_weight) || 0), 0) + ' kg',
          grossWeight: order.items.reduce((sum, item) => sum + (parseFloat(item.gross_weight) || 0), 0) + ' kg',
          order_type: order.order_type,
          status: order.order_status || 'pending',
          products: order.items.map(item => item.product).filter(Boolean),
          createdAt: order.createdAt ?? order.created_at ?? null,
          updatedAt: order.updatedAt ?? order.updated_at ?? null
        }));
        setOrders(transformedOrders);
      }
    } catch (err) {
      console.error('Error deleting order:', err);
      setError('Error deleting order: ' + err.message);
    }
    setOpenDropdown(null);
  };

  const handleDeleteDraft = async (draftId) => {
    try {
      await deleteDraft(draftId);
      // Refresh the drafts list after deletion
      await fetchDrafts();
      alert('Draft deleted successfully!');
    } catch (err) {
      console.error('Error deleting draft:', err);
      alert('Error deleting draft: ' + err.message);
    }
    setOpenDropdown(null);
  };

  const handleAction = (action, orderId, orderType) => {
    if (action === 'view') {
      navigate(`/orders/${orderId}`);
    } else if (action === 'edit') {
      // Navigate to the order creation page with order ID and order_type for editing
      navigate(`/orders/create?orderId=${orderId}`, { state: { orderType: orderType ?? null } });
    } else if (action === 'delete') {
      // Open delete confirmation modal
      setDeleteModal({ isOpen: true, orderId });
    }
    setOpenDropdown(null);
  };

  const handleDraftAction = (action, draftId) => {
    if (action === 'view') {
      navigate(`/drafts/${draftId}`);
    } else if (action === 'edit') {
      // Navigate to the order creation page with draft ID
      navigate(`/orders/create?draftId=${draftId}`);
    } else if (action === 'delete') {
      // Open delete confirmation modal for draft
      setDeleteDraftModal({ isOpen: true, draftId });
    }
    setOpenDropdown(null);
  };

  const statsCards = [
    { title: 'Total Orders', value: filteredOrders.length, bgColor: 'bg-[#D4F4E8]', textColor: 'text-[#0D7C66]' },
    { title: 'Created', value: '28', bgColor: 'bg-[#B8F3DC]', textColor: 'text-[#0D7C66]' },
    { title: 'Assigned', value: '45', bgColor: 'bg-[#7FE5B8]', textColor: 'text-[#0D7C66]' },
    { title: 'In Transit', value: '51', bgColor: 'bg-[#1CB68B]', textColor: 'text-white' },
    { title: 'Delivered', value: '18', bgColor: 'bg-[#0D7C66]', textColor: 'text-white' },
  ];

  // Show loading state
  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 p-4 md:p-6 lg:p-8 flex items-center justify-center">
        <div className="text-xl">Loading orders...</div>
      </div>
    );
  }

  // Show error state
  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 p-4 md:p-6 lg:p-8 flex items-center justify-center">
        <div className="text-xl text-red-500">Error: {error}</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-6 lg:p-8">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center justify-end mb-6">
          <button
            onClick={() => navigate('/orders/create')}
            className="bg-[#0D7C66] hover:bg-[#0a6252] text-white px-6 py-2.5 rounded-lg font-medium transition-colors duration-200 flex items-center justify-center gap-2 w-full sm:w-auto"
          >
            <span className="text-xl">+</span> New Order
          </button>
        </div>

        {/* Tabs for Orders and Drafts */}
        <div className="flex border-b border-gray-200 mb-6">
          <button
            className={`py-2 px-4 font-medium text-sm ${activeTab === 'orders' ? 'text-[#0D7C66] border-b-2 border-[#0D7C66]' : 'text-gray-500 hover:text-gray-700'}`}
            onClick={() => setActiveTab('orders')}
          >
            Orders
          </button>
          <button
            className={`py-2 px-4 font-medium text-sm ${activeTab === 'drafts' ? 'text-[#0D7C66] border-b-2 border-[#0D7C66]' : 'text-gray-500 hover:text-gray-700'}`}
            onClick={() => setActiveTab('drafts')}
          >
            Drafts ({drafts.length})
          </button>
        </div>

        {/* Search and Filters */}
        <div className="flex flex-col lg:flex-row gap-4 mb-6">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input
              type="text"
              placeholder="Search by order ID, customer..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0D7C66] focus:border-transparent"
            />
          </div>
          <div className="flex flex-wrap gap-3">
            {/* Time Filter Dropdown */}
            <div className="relative" ref={timeFilterRef}>
              <button
                type="button"
                data-filter="time"
                onClick={() => {
                  setShowTimeFilter(!showTimeFilter);
                  setShowStatusFilter(false);
                }}
                className="flex items-center gap-2 px-4 py-2.5 border border-gray-300 rounded-lg bg-white hover:bg-gray-50 transition-colors duration-200"
              >
                <span className="text-gray-700">{timeFilter}</span>
                <ChevronDown className="w-4 h-4 text-gray-500" />
              </button>

              {showTimeFilter && (
                <div className="absolute top-full left-0 mt-1 w-48 bg-white rounded-lg shadow-lg border border-gray-200 z-50">
                  {timeFilterOptions.map((option) => (
                    <button
                      key={option}
                      onClick={() => {
                        setTimeFilter(option);
                        setShowTimeFilter(false);
                      }}
                      className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 first:rounded-t-lg last:rounded-b-lg"
                    >
                      {option}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Status Filter Dropdown */}
            <div className="relative" ref={statusFilterRef}>
              <button
                type="button"
                data-filter="status"
                onClick={() => {
                  setShowStatusFilter(!showStatusFilter);
                  setShowTimeFilter(false);
                }}
                className="flex items-center gap-2 px-4 py-2.5 border border-gray-300 rounded-lg bg-white hover:bg-gray-50 transition-colors duration-200"
              >
                <span className="text-gray-700">{statusFilter}</span>
                <ChevronDown className="w-4 h-4 text-gray-500" />
              </button>

              {showStatusFilter && (
                <div className="absolute top-full left-0 mt-1 w-48 bg-white rounded-lg shadow-lg border border-gray-200 z-50">
                  {statusFilterOptions.map((option) => (
                    <button
                      key={option}
                      onClick={() => {
                        setStatusFilter(option);
                        setShowStatusFilter(false);
                      }}
                      className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 first:rounded-t-lg last:rounded-b-lg"
                    >
                      {option}
                    </button>
                  ))}
                </div>
              )}
            </div>



            <button
              type="button"
              onClick={handleExport}
              className="px-6 py-2.5 border border-[#0D7C66] text-[#0D7C66] rounded-lg hover:bg-[#0D7C66] hover:text-white transition-colors duration-200 font-medium"
            >
              Export
            </button>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
          {statsCards.map((card, index) => (
            <div
              key={index}
              className={`${card.bgColor} rounded-xl p-6 shadow-sm`}
            >
              <p className={`text-sm font-medium ${card.textColor} opacity-90 mb-2`}>
                {card.title}
              </p>
              <p className={`text-4xl font-bold ${card.textColor}`}>{card.value}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Orders Table */}
      {activeTab === 'orders' && (
        <div className="bg-white rounded-xl shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="px-6 py-4 text-left text-xs font-semibold text-[#0D7C66] uppercase tracking-wider">
                    Order ID
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-[#0D7C66] uppercase tracking-wider">
                    Order Received Date
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-[#0D7C66] uppercase tracking-wider">
                    Customer
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-[#0D7C66] uppercase tracking-wider">
                    No of Boxes/Bag
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-[#0D7C66] uppercase tracking-wider">
                    Type of Packing
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-[#0D7C66] uppercase tracking-wider">
                    Net Weight
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-[#0D7C66] uppercase tracking-wider">
                    Gross Weight
                  </th>

                  <th className="px-6 py-4 text-left text-xs font-semibold text-[#0D7C66] uppercase tracking-wider">
                    Action
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {(() => {
                  const itemsPerPage = 7;
                  const startIndex = (currentPage - 1) * itemsPerPage;
                  const endIndex = startIndex + itemsPerPage;
                  const currentOrders = filteredOrders.slice(startIndex, endIndex);

                  if (filteredOrders.length === 0) {
                    return (
                      <tr>
                        <td colSpan="8" className="px-6 py-8 text-center text-sm text-gray-500">
                          {orders.length === 0 ? 'No orders yet' : 'No orders match your filters'}
                        </td>
                      </tr>
                    );
                  }

                  return currentOrders.map((order) => (
                    <tr
                      key={order.id}
                      className="hover:bg-gray-50 transition-colors duration-150"
                    >
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        {order.orderId || order.id}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                        {order.orderReceivedDate ? new Date(order.orderReceivedDate).toLocaleDateString() : '-'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                        {order.customer}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                        {order.boxes}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                        {order.packing}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                        {order.netWeight}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                        {order.grossWeight}
                      </td>

                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleDropdown(order.id, e);
                          }}
                          className="text-[#6B8782] hover:text-[#0D5C4D] transition-colors p-1 hover:bg-[#F0F4F3] rounded"
                        >
                          <MoreVertical size={20} />
                        </button>
                      </td>
                    </tr>
                  ));
                })()}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="px-6 py-4 bg-white border-t border-gray-200 flex flex-col sm:flex-row items-center justify-between gap-4">
            <p className="text-sm text-gray-600">
              {(() => {
                const itemsPerPage = 7;
                const totalItems = filteredOrders.length;
                const startItem = totalItems === 0 ? 0 : (currentPage - 1) * itemsPerPage + 1;
                const endItem = Math.min(currentPage * itemsPerPage, totalItems);
                return `Showing ${startItem}-${endItem} of ${totalItems} Orders`;
              })()}
            </p>
            <div className="flex items-center gap-2">
              {(() => {
                const itemsPerPage = 7;
                const totalPages = Math.ceil(filteredOrders.length / itemsPerPage);

                return (
                  <>
                    <button
                      onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                      className="p-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors duration-150 disabled:opacity-50"
                      disabled={currentPage === 1}
                    >
                      <ChevronLeft className="w-4 h-4 text-gray-600" />
                    </button>

                    {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => {
                      const showPage = page === 1 ||
                        page === totalPages ||
                        (page >= currentPage - 1 && page <= currentPage + 1);

                      const showEllipsis = (page === currentPage - 2 && currentPage > 3) ||
                        (page === currentPage + 2 && currentPage < totalPages - 2);

                      if (showEllipsis) {
                        return <span key={page} className="px-2 text-gray-400">...</span>;
                      }

                      if (!showPage) return null;

                      return (
                        <button
                          key={page}
                          className={`px-3 py-1.5 rounded-lg font-medium transition-colors duration-150 ${currentPage === page
                            ? 'bg-[#0D7C66] text-white'
                            : 'border border-gray-300 text-gray-700 hover:bg-gray-50'
                            }`}
                          onClick={() => setCurrentPage(page)}
                        >
                          {page}
                        </button>
                      );
                    })}

                    <button
                      onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                      className="p-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors duration-150 disabled:opacity-50"
                      disabled={currentPage === totalPages || totalPages === 0}
                    >
                      <ChevronRight className="w-4 h-4 text-gray-600" />
                    </button>
                  </>
                );
              })()}
            </div>
          </div>
        </div>
      )}

      {/* Drafts Table */}
      {activeTab === 'drafts' && (
        <div className="bg-white rounded-xl shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="px-6 py-4 text-left text-xs font-semibold text-[#0D7C66] uppercase tracking-wider">
                    Draft ID
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-[#0D7C66] uppercase tracking-wider">
                    Customer
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-[#0D7C66] uppercase tracking-wider">
                    Product list
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-[#0D7C66] uppercase tracking-wider">
                    Order type
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-[#0D7C66] uppercase tracking-wider">
                    Packing date
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-[#0D7C66] uppercase tracking-wider">
                    Action
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {filteredDrafts.length > 0 ? (
                  filteredDrafts.map((draft, index) => (
                    <tr
                      key={index}
                      className="hover:bg-gray-50 transition-colors duration-150"
                    >
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        {draft.id}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                        {draft.customer}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-700 max-w-[200px]" title={draft.productList}>
                        <span className="line-clamp-2">{draft.productList}</span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                        {draft.orderType}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                        {draft.packingDate}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleDropdown(draft.id, e);
                          }}
                          className="text-[#6B8782] hover:text-[#0D5C4D] transition-colors p-1 hover:bg-[#F0F4F3] rounded"
                        >
                          <MoreVertical size={20} />
                        </button>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan="6" className="px-6 py-4 text-center text-sm text-gray-500">
                      {drafts.length === 0 ? 'No drafts yet' : 'No drafts match your filters'}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

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
          {activeTab === 'orders' ? (
            <>
              <button
                onClick={() => handleAction('view', openDropdown)}
                className="w-full text-left px-4 py-2 text-sm text-[#0D5C4D] hover:bg-[#F0F4F3] transition-colors flex items-center gap-2"
              >
                <Eye size={14} />
                View
              </button>
              <button
                onClick={() => {
                  const order = filteredOrders.find(o => o.id === openDropdown);
                  handleAction('edit', openDropdown, order?.order_type);
                }}
                className="w-full text-left px-4 py-2 text-sm text-[#0D5C4D] hover:bg-[#F0F4F3] transition-colors flex items-center gap-2"
              >
                <Edit size={14} />
                Edit
              </button>
              <button
                onClick={() => handleAction('delete', openDropdown)}
                className="w-full text-left px-4 py-2 text-sm text-red-500 hover:bg-[#F0F4F3] transition-colors flex items-center gap-2"
              >
                <Trash2 size={14} />
                Delete
              </button>
            </>
          ) : (
            <>
              <button
                onClick={() => handleDraftAction('view', openDropdown)}
                className="w-full text-left px-4 py-2 text-sm text-[#0D5C4D] hover:bg-[#F0F4F3] transition-colors flex items-center gap-2"
              >
                <Eye size={14} />
                View
              </button>
              <button
                onClick={() => handleDraftAction('edit', openDropdown)}
                className="w-full text-left px-4 py-2 text-sm text-[#0D5C4D] hover:bg-[#F0F4F3] transition-colors flex items-center gap-2"
              >
                <Edit size={14} />
                Edit
              </button>
              <button
                onClick={() => handleDraftAction('delete', openDropdown)}
                className="w-full text-left px-4 py-2 text-sm text-red-500 hover:bg-[#F0F4F3] transition-colors flex items-center gap-2"
              >
                <Trash2 size={14} />
                Delete
              </button>
            </>
          )}
        </div>
      )}

      {/* Delete Order Confirmation Modal */}
      <ConfirmDeleteModal
        isOpen={deleteModal.isOpen}
        onClose={() => setDeleteModal({ isOpen: false, orderId: null })}
        onConfirm={async () => {
          try {
            await handleDeleteOrder(deleteModal.orderId);
            setDeleteModal({ isOpen: false, orderId: null });
          } catch (error) {
            console.error('Failed to delete order:', error);
          }
        }}
        title="Delete Order"
        message="Are you sure you want to delete this order? This action cannot be undone."
      />

      {/* Delete Draft Confirmation Modal */}
      <ConfirmDeleteModal
        isOpen={deleteDraftModal.isOpen}
        onClose={() => setDeleteDraftModal({ isOpen: false, draftId: null })}
        onConfirm={async () => {
          try {
            await handleDeleteDraft(deleteDraftModal.draftId);
            setDeleteDraftModal({ isOpen: false, draftId: null });
          } catch (error) {
            console.error('Failed to delete draft:', error);
          }
        }}
        title="Delete Draft"
        message="Are you sure you want to delete this draft? This action cannot be undone."
      />
    </div>
  );
};

export default OrderManagement;