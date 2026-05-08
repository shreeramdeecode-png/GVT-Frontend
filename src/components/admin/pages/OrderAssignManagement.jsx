import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, ChevronDown, ChevronRight, ChevronLeft } from 'lucide-react';
import { getAllOrders } from '../../../api/orderApi';
import { getOrderAssignment } from '../../../api/orderAssignmentApi';
import { getFlowerOrderAssignment } from '../../../api/flowerOrderAssignmentApi';
import { getLocalOrder } from '../../../api/localOrderApi';

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

  return items.filter((item) => {
    const raw = getItemDate(item);
    if (raw == null || raw === '') return false;
    const itemDate = new Date(raw);
    if (Number.isNaN(itemDate.getTime())) return false;
    return inRange(itemDate, startDate, endDate);
  });
};

const getAssignOrderFilterDate = (o) =>
  o.order_received_date ?? o.orderReceivedDate ?? o.createdAt ?? o.updatedAt ?? o.created_at ?? o.updated_at ?? null;

const escapeCsvCell = (val) => {
  const s = String(val ?? '');
  if (/[",\n\r]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
};

const OrderAssignManagement = () => {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [timeFilter, setTimeFilter] = useState('All Time');
  const [showTimeFilter, setShowTimeFilter] = useState(false);
  const timeFilterRef = useRef(null);
  const timeFilterOptions = ['All Time', 'Today', 'Yesterday', 'Last 7 Days', 'Last 30 Days', 'This Month', 'Last Month'];
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [assignments, setAssignments] = useState({});
  const [localOrders, setLocalOrders] = useState({}); // Track local order assignments

  // Fetch orders from API
  const fetchOrderData = async () => {
    try {
      setLoading(true);
      const response = await getAllOrders();
      const ordersData = (response.data || []).sort((a, b) => {
        const dateA = new Date(a.createdAt || a.order_received_date || 0);
        const dateB = new Date(b.createdAt || b.order_received_date || 0);
        return dateB - dateA;
      });
      setOrders(ordersData);

      // Fetch assignment data for each order
      const assignmentsData = {};
      const localOrdersData = {};

      for (const order of ordersData) {
        try {
          const isFlowerOrder = order.order_type === 'flower' || order.order_type === 'FLOWER ORDER';
          const assignmentResponse = isFlowerOrder
            ? await getFlowerOrderAssignment(order.oid)
            : await getOrderAssignment(order.oid);
          assignmentsData[order.oid] = assignmentResponse.data;
        } catch (err) {
          // If assignment doesn't exist, that's fine
          assignmentsData[order.oid] = null;
        }

        // Fetch local order data for local orders (check both 'local' and 'LOCAL GRADE ORDER')
        if (order.order_type === 'local' || order.order_type === 'LOCAL GRADE ORDER') {
          try {
            const localOrderResponse = await getLocalOrder(order.oid);
            // Handle different response structures
            if (localOrderResponse.success && localOrderResponse.data) {
              localOrdersData[order.oid] = localOrderResponse.data;
            } else if (localOrderResponse.data) {
              localOrdersData[order.oid] = localOrderResponse.data;
            } else {
              localOrdersData[order.oid] = localOrderResponse;
            }
          } catch (err) {
            // If local order doesn't exist, that's fine
            localOrdersData[order.oid] = null;
          }
        }
      }

      setAssignments(assignmentsData);
      setLocalOrders(localOrdersData);

      setError(null);
    } catch (err) {
      console.error('Error fetching orders:', err);
      setError('Failed to load orders');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrderData();
  }, []);

  const stats = [
    { label: 'Total Orders', value: orders.length.toString(), bgColor: 'bg-emerald-50', textColor: 'text-emerald-900' },
    { label: 'Created', value: orders.filter(o => o.order_status === 'pending').length.toString(), bgColor: 'bg-emerald-100', textColor: 'text-emerald-900' },
    { label: 'Assigned', value: Object.values(assignments).filter(a => a !== null).length.toString(), bgColor: 'bg-emerald-200', textColor: 'text-emerald-900' },
    { label: 'In Transit', value: orders.filter(o => o.order_status === 'processing').length.toString(), bgColor: 'bg-emerald-500', textColor: 'text-white' },
    { label: 'Delivered', value: orders.filter(o => o.order_status === 'delivered').length.toString(), bgColor: 'bg-[#0D7C66]', textColor: 'text-white' },
  ];

  const filteredOrders = useMemo(() => {
    let filtered = filterByDateRange([...orders], timeFilter, (o) => getAssignOrderFilterDate(o));
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (order) =>
          String(order.order_id || '').toLowerCase().includes(query) ||
          String(order.customer_name || '').toLowerCase().includes(query)
      );
    }
    return filtered;
  }, [orders, searchQuery, timeFilter]);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, timeFilter]);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (showTimeFilter && !timeFilterRef.current?.contains(event.target)) {
        setShowTimeFilter(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showTimeFilter]);

  const handleExport = () => {
    const rows = [];
    rows.push(
      ['Order ID', 'Customer', 'Order Type', 'Order Received Date', 'Status'].map(escapeCsvCell).join(',')
    );
    filteredOrders.forEach((order) => {
      rows.push(
        [
          order.order_id,
          order.customer_name,
          order.order_type || '',
          order.order_received_date || '',
          order.order_status || ''
        ].map(escapeCsvCell).join(',')
      );
    });
    const csv = rows.join('\r\n');
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `order-assign-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(link.href);
  };

  const itemsPerPage = 7;
  const totalPages = Math.max(1, Math.ceil(filteredOrders.length / itemsPerPage));
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedOrders = filteredOrders.slice(startIndex, startIndex + itemsPerPage);

  const setPage = (page) => {
    const safePage = Math.max(1, Math.min(totalPages, page));
    setCurrentPage(safePage);
  };

  useEffect(() => {
    if (!loading && totalPages > 0 && currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [loading, totalPages, currentPage]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 p-4 sm:p-6 lg:p-8 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading orders...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 p-4 sm:p-6 lg:p-8 flex items-center justify-center">
        <div className="text-center">
          <div className="text-red-500 text-xl mb-4">Error</div>
          <p className="text-gray-600 mb-4">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4 sm:p-6 lg:p-8">

      {/* Search and Filters — aligned with Order Management */}
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
          <div className="relative" ref={timeFilterRef}>
            <button
              type="button"
              onClick={() => setShowTimeFilter(!showTimeFilter)}
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
                    type="button"
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
        {stats.map((stat, index) => (
          <div key={index} className={`${stat.bgColor} rounded-xl p-6`}>
            <p className={`text-sm font-medium ${stat.textColor} opacity-80 mb-2`}>{stat.label}</p>
            <p className={`text-4xl font-bold ${stat.textColor}`}>{stat.value}</p>
          </div>
        ))}
      </div>

      {/* Orders Table */}
      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                  Order ID
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                  Customer
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                  Order Type
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                  Order Received Date
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                  Products
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                  Action
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {paginatedOrders.map((order, index) => (
                <tr key={order.oid} className="hover:bg-gray-50 transition-colors">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className="text-sm font-medium text-gray-900">{order.order_id}</span>
                  </td>
                  <td className="px-6 py-4">
                    <div>
                      <p className="text-sm font-medium text-gray-900">{order.customer_name}</p>
                      <p className="text-xs text-gray-500">{order.customer_id || 'N/A'}</p>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`px-3 py-1.5 rounded-full text-xs font-medium ${
                      order.order_type === 'flight' || order.order_type === 'BOX ORDER' ? 'bg-blue-100 text-blue-700' :
                      order.order_type === 'flower' || order.order_type === 'FLOWER ORDER' ? 'bg-pink-100 text-pink-700' :
                      'bg-green-100 text-green-700'
                    }`}>
                      {order.order_type === 'flight' || order.order_type === 'BOX ORDER' ? 'BOX ORDER' : order.order_type === 'flower' || order.order_type === 'FLOWER ORDER' ? 'FLOWER ORDER' : order.order_type === 'local' || order.order_type === 'LOCAL GRADE ORDER' ? 'LOCAL GRADE ORDER' : order.order_type || 'N/A'}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className="text-sm text-gray-900">{order.order_received_date || 'N/A'}</span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex flex-wrap gap-2">
                      {order.items && order.items.slice(0, 2).map((item, idx) => (
                        <span
                          key={idx}
                          className="px-2.5 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800"
                        >
                          {item.product || 'Unknown Product'}
                        </span>
                      ))}
                      {order.items && order.items.length > 2 && (
                        <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-700">
                          +{order.items.length - 2}
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {(() => {
                      const isLocalOrder = order.order_type === 'local' || order.order_type === 'LOCAL GRADE ORDER' || order.order_type === 'LOCAL BOX ORDER';
                      const assignment = assignments[order.oid];

                      // Box / flight / flower orders: completed when all 4 stages are completed
                      const allStagesCompleted = !isLocalOrder && assignment &&
                        assignment.stage1_status === 'completed' &&
                        assignment.stage2_status === 'completed' &&
                        assignment.stage3_status === 'completed' &&
                        assignment.stage4_status === 'completed';

                      // Local orders: completed when all driver assignments have status "completed"
                      let localOrderCompleted = false;
                      if (isLocalOrder) {
                        const rawLocal = localOrders[order.oid];
                        if (rawLocal) {
                          const summarySource = rawLocal.summary_data ?? rawLocal.summaryData;
                          let summary = summarySource;

                          if (typeof summary === 'string') {
                            try {
                              summary = JSON.parse(summary);
                            } catch {
                              summary = null;
                            }
                          }

                          const driverGroups = summary?.driverAssignments || [];
                          const allAssignments = driverGroups.flatMap(g => g.assignments || []);

                          if (allAssignments.length > 0) {
                            localOrderCompleted = allAssignments.every(a =>
                              (a.status || '').toString().toLowerCase() === 'completed'
                            );
                          }
                        }
                      }

                      if (allStagesCompleted || localOrderCompleted) {
                        return (
                          <span className="px-3 py-1.5 rounded-full text-xs font-medium bg-emerald-600 text-white">
                            Completed
                          </span>
                        );
                      }

                      // Fallback to base order_status styling
                      const statusKey = (order.order_status || '').toLowerCase();
                      const statusClass = {
                        pending: 'bg-purple-100 text-purple-700',
                        confirmed: 'bg-emerald-100 text-emerald-700',
                        processing: 'bg-yellow-100 text-yellow-700',
                        shipped: 'bg-blue-100 text-blue-700',
                        delivered: 'bg-emerald-600 text-white',
                        cancelled: 'bg-red-100 text-red-700'
                      }[statusKey] || 'bg-gray-100 text-gray-700';

                      return (
                        <span className={`px-3 py-1.5 rounded-full text-xs font-medium ${statusClass}`}>
                          {statusKey
                            ? statusKey.charAt(0).toUpperCase() + statusKey.slice(1)
                            : 'N/A'}
                        </span>
                      );
                    })()}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {(() => {
                      // Check for both 'local' and 'LOCAL GRADE ORDER' order types
                      const isLocalOrder = order.order_type === 'local' || order.order_type === 'LOCAL GRADE ORDER';
                      const isFlowerOrder = order.order_type === 'flower' || order.order_type === 'FLOWER ORDER';
                      const assignment = assignments[order.oid];
                      const isStage1Completed = assignment?.stage1_status === 'completed';

                      // Check if all 4 stages are completed (box / flower / flight orders)
                      const allStagesCompleted = !isLocalOrder && assignment &&
                        assignment.stage1_status === 'completed' &&
                        assignment.stage2_status === 'completed' &&
                        assignment.stage3_status === 'completed' &&
                        assignment.stage4_status === 'completed';

                      // For local orders, check if all driver assignments are completed in local order summary
                      let localOrderCompleted = false;
                      if (isLocalOrder) {
                        const rawLocal = localOrders[order.oid];
                        if (rawLocal) {
                          const summarySource = rawLocal.summary_data ?? rawLocal.summaryData;
                          let summary = summarySource;

                          if (typeof summary === 'string') {
                            try {
                              summary = JSON.parse(summary);
                            } catch {
                              summary = null;
                            }
                          }

                          const driverGroups = summary?.driverAssignments || [];
                          const allAssignments = driverGroups.flatMap(g => g.assignments || []);

                          if (allAssignments.length > 0) {
                            localOrderCompleted = allAssignments.every(a =>
                              (a.status || '').toString().toLowerCase() === 'completed'
                            );
                          }
                        }
                      }

                      // For local orders, check if local order data actually exists
                      const localOrderData = localOrders[order.oid];
                      const hasLocalOrderData = isLocalOrder && localOrderData && (
                        localOrderData.product_assignments ||
                        localOrderData.productAssignments ||
                        localOrderData.delivery_routes ||
                        localOrderData.deliveryRoutes ||
                        localOrderData.local_order_id
                      );

                      // For box/flower orders, also consider stage 2 / stage 3 data as "already assigned"
                      const hasStage2Or3Data = !isLocalOrder && assignment && (
                        assignment.stage2_data ||
                        assignment.stage2_summary_data ||
                        assignment.stage3_data ||
                        assignment.stage3_summary_data
                      );

                      const shouldShowEdit = isLocalOrder ? hasLocalOrderData : (isStage1Completed || hasStage2Or3Data);

                      const getAssignPath = (forEdit) => {
                        if (isLocalOrder) return { path: `/order-assign/local/${order.oid}`, state: forEdit ? { orderData: order, localOrderData: localOrderData, isEdit: true } : { orderData: order } };
                        if (isFlowerOrder) return { path: `/order-assign/flower/stage1/${order.oid}`, state: forEdit ? { orderData: order, isEdit: true } : { orderData: order } };
                        return { path: `/order-assign/stage1/${order.oid}`, state: forEdit ? { orderData: order, isEdit: true } : { orderData: order } };
                      };

                      const assignNav = getAssignPath(shouldShowEdit);
                      const isFullyAssigned =
                        allStagesCompleted || localOrderCompleted;

                      if (isFullyAssigned) {
                        const editNav = getAssignPath(true);
                        return (
                          <button
                            type="button"
                            onClick={() =>
                              navigate(editNav.path, { state: editNav.state })
                            }
                            className="px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 transition-colors"
                          >
                            Edit Assign
                          </button>
                        );
                      } else if (shouldShowEdit) {
                        return (
                          <button
                            onClick={() => navigate(assignNav.path, { state: assignNav.state })}
                            className="px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 transition-colors"
                          >
                            Edit Assign
                          </button>
                        );
                      } else {
                        return (
                          <button
                            onClick={() => navigate(assignNav.path, { state: assignNav.state })}
                            className="px-4 py-2 bg-emerald-600 text-white text-sm font-medium rounded-lg hover:bg-emerald-700 transition-colors"
                          >
                            Assign
                          </button>
                        );
                      }
                    })()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pagination - 7 items per page */}
        <div className="border-t border-gray-200 px-4 py-4 sm:px-6">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <p className="text-sm text-gray-600">
              Showing {filteredOrders.length === 0 ? 0 : startIndex + 1} to {Math.min(startIndex + itemsPerPage, filteredOrders.length)} of <span className="font-medium">{filteredOrders.length}</span> Orders
            </p>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPage(currentPage - 1)}
                disabled={currentPage === 1}
                className="p-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <ChevronLeft className="w-4 h-4 text-gray-600" />
              </button>
              {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                <button
                  key={page}
                  onClick={() => setPage(page)}
                  className={`w-10 h-10 rounded-lg font-medium transition-colors ${
                    currentPage === page ? 'bg-emerald-600 text-white hover:bg-emerald-700' : 'border border-gray-300 hover:bg-gray-50'
                  }`}
                >
                  {page}
                </button>
              ))}
              <button
                onClick={() => setPage(currentPage + 1)}
                disabled={currentPage === totalPages || totalPages === 0}
                className="p-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <ChevronRight className="w-4 h-4 text-gray-600" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default OrderAssignManagement;