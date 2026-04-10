import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Search, ChevronDown, ArrowLeft } from 'lucide-react';
import { getAllOrders } from '../../../api/orderApi';
import { getOrderAssignment } from '../../../api/orderAssignmentApi';
import { getAllThirdParties } from '../../../api/thirdPartyApi';
import * as XLSX from 'xlsx';

const ThirdPartyIndividualOrderHistory = () => {
  const navigate = useNavigate();
  const { id } = useParams(); // thirdParty ID from URL (/third-party/:id/orders)
  const thirdPartyId = id;

  const [searchTerm, setSearchTerm] = useState('');
  const [timeFilter, setTimeFilter] = useState('All Time');
  const [statusFilter, setStatusFilter] = useState('All Status');
  const [currentPage, setCurrentPage] = useState(1);

  const [allOrders, setAllOrders] = useState([]);
  const [filteredOrders, setFilteredOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [currentThirdParty, setCurrentThirdParty] = useState(null);
  const [thirdPartyAmounts, setThirdPartyAmounts] = useState({});

  // Fetch orders and third party info on mount
  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const [ordersRes, thirdPartiesRes] = await Promise.all([
          getAllOrders(),
          getAllThirdParties(),
        ]);

        const fetchedThirdParties = thirdPartiesRes?.data || [];
        const tp = fetchedThirdParties.find(t => String(t.tpid) === String(thirdPartyId));
        setCurrentThirdParty(tp);

        if (ordersRes?.data) {
          const orders = ordersRes.data;

          // Sort newest first
          const sortedOrders = [...orders].sort((a, b) => {
            return new Date(b.createdAt || 0) - new Date(a.createdAt || 0);
          });

          setAllOrders(sortedOrders);
          await filterOrdersByThirdParty(sortedOrders);
        }
      } catch (error) {
        console.error('Error fetching data:', error);
      } finally {
        setLoading(false);
      }
    };

    if (thirdPartyId) {
      fetchData();
    } else {
      setLoading(false);
    }
  }, [thirdPartyId]);

  // Filter orders that include an assignment for this third party
  const filterOrdersByThirdParty = async (orders) => {
    const amounts = {};
    const tpOrders = [];

    for (const order of orders) {
      try {
        const assignmentRes = await getOrderAssignment(order.oid).catch(() => null);

        if (assignmentRes?.data?.product_assignments) {
          let assignments = [];
          try {
            assignments =
              typeof assignmentRes.data.product_assignments === 'string'
                ? JSON.parse(assignmentRes.data.product_assignments)
                : assignmentRes.data.product_assignments;
          } catch {
            assignments = [];
          }

          const tpAssignments = assignments.filter(
            a => a.entityType === 'thirdParty' && String(a.entityId) === String(thirdPartyId)
          );

          if (tpAssignments.length > 0) {
            const total = tpAssignments.reduce((sum, a) => {
              const qty = parseFloat(a.assignedQty) || 0;
              const price = parseFloat(a.price) || 0;
              return sum + qty * price;
            }, 0);

            amounts[order.oid] = total;
            tpOrders.push(order);
          }
        }
      } catch (err) {
        console.error(`Error fetching assignment for order ${order.oid}:`, err);
      }
    }

    setThirdPartyAmounts(amounts);
    setFilteredOrders(tpOrders);
  };

  // Apply search + status + time filters
  const getDisplayOrders = () => {
    let result = [...filteredOrders];

    // Search filter
    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      result = result.filter(
        o =>
          (o.oid || '').toLowerCase().includes(term) ||
          (o.customer_name || '').toLowerCase().includes(term)
      );
    }

    // Status filter
    if (statusFilter !== 'All Status') {
      const statusMap = {
        Delivered: 'delivered',
        Pending: 'pending',
        Processing: 'processing',
        Cancelled: 'cancelled',
        'In Transit': 'in_transit',
      };
      const statusValue = statusMap[statusFilter] || statusFilter.toLowerCase();
      result = result.filter(o => (o.order_status || '').toLowerCase() === statusValue);
    }

    // Time filter
    if (timeFilter !== 'All Time') {
      const now = new Date();
      result = result.filter(o => {
        const date = new Date(o.createdAt);
        if (timeFilter === 'Today') {
          return date.toDateString() === now.toDateString();
        } else if (timeFilter === 'This Week') {
          const weekAgo = new Date(now);
          weekAgo.setDate(now.getDate() - 7);
          return date >= weekAgo;
        } else if (timeFilter === 'This Month') {
          return date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear();
        } else if (timeFilter === 'Last Month') {
          const lastMonth = new Date(now);
          lastMonth.setMonth(now.getMonth() - 1);
          return (
            date.getMonth() === lastMonth.getMonth() &&
            date.getFullYear() === lastMonth.getFullYear()
          );
        }
        return true;
      });
    }

    return result;
  };

  // Export to Excel
  const handleExport = () => {
    const displayOrders = getDisplayOrders();
    if (displayOrders.length === 0) {
      alert('No data to export');
      return;
    }

    const exportData = displayOrders.map(order => {
      const orderDate = order.createdAt
        ? new Date(order.createdAt).toLocaleDateString('en-US', {
          year: 'numeric',
          month: 'short',
          day: '2-digit',
        })
        : 'N/A';
      const products = (order.items || []).map(p => p.product_name || p.product).join(', ');
      const amount = thirdPartyAmounts[order.oid] || 0;

      return {
        'Order ID': order.oid,
        'Customer Name': order.customer_name || 'N/A',
        'Phone Number': order.phone_number || 'N/A',
        Products: products,
        'Created Date': orderDate,
        'Third Party Amount': amount,
        'Total Order Amount': parseFloat(order.total_amount) || 0,
        'Order Status': order.order_status || 'N/A',
      };
    });

    const worksheet = XLSX.utils.json_to_sheet(exportData);
    const headers = Object.keys(exportData[0]);
    worksheet['!cols'] = headers.map(h => {
      let maxW = h.length;
      exportData.forEach(r => { maxW = Math.max(maxW, String(r[h] || '').length); });
      return { wch: Math.min(maxW + 2, 50) };
    });

    const workbook = XLSX.utils.book_new();
    const tpName = currentThirdParty?.third_party_name || 'ThirdParty';
    XLSX.utils.book_append_sheet(workbook, worksheet, `${tpName} Orders`);
    const fileName = `${tpName.replace(/\s+/g, '_')}_order_history_${new Date().toISOString().split('T')[0]}.xlsx`;
    XLSX.writeFile(workbook, fileName);
  };

  const displayOrders = getDisplayOrders();
  const itemsPerPage = 7;
  const totalPages = Math.ceil(displayOrders.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const currentOrders = displayOrders.slice(startIndex, startIndex + itemsPerPage);

  const totalOrderValue = filteredOrders.reduce(
    (sum, o) => sum + (thirdPartyAmounts[o.oid] || 0),
    0
  );

  const statsCards = [
    {
      label: 'Total Orders',
      value: filteredOrders.length.toString(),
      color: 'bg-gradient-to-r from-[#D1FAE5] to-[#A7F3D0]',
      textColor: 'text-[#0D5C4D]',
    },
    {
      label: 'Pending Orders',
      value: filteredOrders.filter(o => o.order_status === 'pending').length.toString(),
      color: 'bg-gradient-to-r from-[#6EE7B7] to-[#34D399]',
      textColor: 'text-[#0D5C4D]',
    },
    {
      label: 'Completed Orders',
      value: filteredOrders.filter(o => o.order_status === 'delivered').length.toString(),
      color: 'bg-gradient-to-r from-[#10B981] to-[#059669]',
      textColor: 'text-white',
    },
    {
      label: 'Total Order Value',
      value: totalOrderValue >= 100000
        ? '₹' + (totalOrderValue / 100000).toFixed(1) + ' L'
        : '₹' + totalOrderValue.toLocaleString(),
      color: 'bg-gradient-to-r from-[#047857] to-[#065F46]',
      textColor: 'text-white',
    },
  ];

  const getStatusStyle = (status) => {
    switch ((status || '').toLowerCase()) {
      case 'delivered':
        return 'bg-[#4ED39A] text-white';
      case 'pending':
        return 'bg-[#FFF4CC] text-[#CC9900]';
      case 'processing':
        return 'bg-[#E0E8FF] text-[#0066CC]';
      case 'cancelled':
        return 'bg-[#FFE0E0] text-[#CC0000]';
      case 'in_transit':
      case 'in transit':
        return 'bg-[#FFF4CC] text-[#CC9900]';
      default:
        return 'bg-gray-100 text-gray-600';
    }
  };

  const getStatusDotStyle = (status) => {
    switch ((status || '').toLowerCase()) {
      case 'delivered':
        return 'bg-white';
      case 'pending':
      case 'in_transit':
      case 'in transit':
        return 'bg-[#CC9900]';
      case 'processing':
        return 'bg-[#0066CC]';
      case 'cancelled':
        return 'bg-[#CC0000]';
      default:
        return 'bg-gray-400';
    }
  };

  const formatStatus = (status) => {
    if (!status) return 'N/A';
    return status
      .replace(/_/g, ' ')
      .replace(/\b\w/g, c => c.toUpperCase());
  };

  return (
    <div className="min-h-screen bg-[#F5FBF9] p-4 sm:p-6 lg:p-8">
      <div className="max-w-7xl mx-auto">
        {/* Back Button */}
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-2 mb-6 text-gray-600 hover:text-gray-800 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span className="text-sm font-medium">Back</span>
        </button>

        {/* Third Party Info Header */}
        {currentThirdParty && (
          <div className="bg-gradient-to-r from-[#0D7C66] to-[#10B981] rounded-xl p-6 mb-6 text-white">
            <h1 className="text-2xl font-bold mb-2">{currentThirdParty.third_party_name}</h1>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
              <div>
                <span className="opacity-80">Third Party ID:</span>
                <span className="ml-2 font-semibold">{currentThirdParty.tpid}</span>
              </div>
              <div>
                <span className="opacity-80">Phone:</span>
                <span className="ml-2 font-semibold">{currentThirdParty.phone || 'N/A'}</span>
              </div>
              <div>
                <span className="opacity-80">Location:</span>
                <span className="ml-2 font-semibold">
                  {currentThirdParty.city || 'N/A'}, {currentThirdParty.state || 'N/A'}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Search + Filters */}
        <div className="flex flex-col sm:flex-row gap-4 mb-6">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input
              type="text"
              placeholder="Search by order ID, customer name..."
              value={searchTerm}
              onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }}
              className="w-full pl-10 pr-4 py-2.5 bg-white border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#0D7C66] focus:border-transparent"
            />
          </div>

          <div className="relative">
            <select
              value={timeFilter}
              onChange={(e) => { setTimeFilter(e.target.value); setCurrentPage(1); }}
              className="appearance-none px-4 py-2.5 pr-10 bg-white border border-gray-200 rounded-lg text-sm font-medium text-gray-700 focus:outline-none focus:ring-2 focus:ring-[#0D7C66] focus:border-transparent cursor-pointer min-w-[140px]"
            >
              <option>All Time</option>
              <option>Last Month</option>
              <option>This Month</option>
              <option>This Week</option>
              <option>Today</option>
            </select>
            <ChevronDown className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4 pointer-events-none" />
          </div>

          <div className="relative">
            <select
              value={statusFilter}
              onChange={(e) => { setStatusFilter(e.target.value); setCurrentPage(1); }}
              className="appearance-none px-4 py-2.5 pr-10 bg-white border border-gray-200 rounded-lg text-sm font-medium text-gray-700 focus:outline-none focus:ring-2 focus:ring-[#0D7C66] focus:border-transparent cursor-pointer min-w-[140px]"
            >
              <option>All Status</option>
              <option>Cancelled</option>
              <option>Delivered</option>
              <option>In Transit</option>
              <option>Pending</option>
              <option>Processing</option>
            </select>
            <ChevronDown className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4 pointer-events-none" />
          </div>

          <button
            onClick={handleExport}
            className="px-6 py-2.5 bg-[#1DB890] hover:bg-[#19a57e] text-white font-semibold rounded-lg text-sm transition-colors whitespace-nowrap"
          >
            Export
          </button>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          {statsCards.map((stat, index) => (
            <div key={index} className={`${stat.color} rounded-2xl p-6`}>
              <div className={`text-sm font-medium mb-2 opacity-90 ${stat.textColor}`}>{stat.label}</div>
              <div className={`text-4xl font-bold mb-2 ${stat.textColor}`}>{stat.value}</div>
            </div>
          ))}
        </div>

        {/* Orders Table */}
        <div className="bg-white rounded-2xl overflow-hidden border border-[#D0E0DB]">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-[#D4F4E8]">
                  <th className="px-6 py-4 text-left text-sm font-semibold text-[#0D5C4D]">Order ID</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-[#0D5C4D]">Customer Name</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-[#0D5C4D]">Products</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-[#0D5C4D]">Order Date</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-[#0D5C4D]">Amount</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-[#0D5C4D]">Status</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-[#0D5C4D]">Action</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan="7" className="px-6 py-12 text-center">
                      <div className="flex items-center justify-center gap-2">
                        <div className="w-5 h-5 border-2 border-emerald-600 border-t-transparent rounded-full animate-spin"></div>
                        <span className="text-sm text-gray-600">Loading orders...</span>
                      </div>
                    </td>
                  </tr>
                ) : currentOrders.length === 0 ? (
                  <tr>
                    <td colSpan="7" className="px-6 py-12 text-center text-sm text-gray-600">
                      No orders found for this third party.
                    </td>
                  </tr>
                ) : (
                  currentOrders.map((order, index) => {
                    const orderDate = order.createdAt
                      ? new Date(order.createdAt).toLocaleDateString('en-US', {
                        year: 'numeric',
                        month: 'short',
                        day: '2-digit',
                      })
                      : 'N/A';
                    const products = order.items || [];
                    const displayProducts = products.slice(0, 2);
                    const remainingCount = products.length - displayProducts.length;
                    const amount = thirdPartyAmounts[order.oid] || 0;

                    return (
                      <tr
                        key={order.oid}
                        className={`border-b border-[#D0E0DB] hover:bg-[#F0F4F3] transition-colors ${index % 2 === 0 ? 'bg-white' : 'bg-[#F0F4F3]/30'
                          }`}
                      >
                        {/* Order ID */}
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-[#B8F4D8] flex items-center justify-center text-[#0D5C4D] font-semibold text-sm">
                              {(order.customer_name || 'OR').substring(0, 2).toUpperCase()}
                            </div>
                            <span className="text-sm font-semibold text-[#0D5C4D]">{order.oid}</span>
                          </div>
                        </td>

                        {/* Customer Name */}
                        <td className="px-6 py-4">
                          <div className="text-sm text-[#0D5C4D]">{order.customer_name || 'N/A'}</div>
                          <div className="text-xs text-[#6B8782]">{order.phone_number || 'N/A'}</div>
                        </td>

                        {/* Products */}
                        <td className="px-6 py-4">
                          <div className="flex flex-wrap gap-1.5">
                            {displayProducts.map((product, idx) => (
                              <span
                                key={idx}
                                className="px-3 py-1.5 rounded-full text-xs font-medium bg-[#D4F4E8] text-[#047857]"
                              >
                                {product.product_name || product.product}
                              </span>
                            ))}
                            {remainingCount > 0 && (
                              <span className="px-3 py-1.5 rounded-full text-xs font-medium bg-[#D4E8FF] text-[#0066CC]">
                                +{remainingCount} more
                              </span>
                            )}
                          </div>
                        </td>

                        {/* Order Date */}
                        <td className="px-6 py-4">
                          <div className="text-sm text-[#0D5C4D]">{orderDate}</div>
                        </td>

                        {/* Amount */}
                        <td className="px-6 py-4">
                          <div className="text-sm font-semibold text-[#0D5C4D]">
                            ₹{amount.toLocaleString()}
                          </div>
                        </td>

                        {/* Status */}
                        <td className="px-6 py-4">
                          <span
                            className={`px-3 py-1.5 rounded-full text-xs font-medium flex items-center gap-1 w-fit ${getStatusStyle(order.order_status)}`}
                          >
                            <div className={`w-2 h-2 rounded-full ${getStatusDotStyle(order.order_status)}`}></div>
                            {formatStatus(order.order_status)}
                          </span>
                        </td>

                        {/* Actions */}
                        <td className="px-6 py-4">
                          <div className="flex gap-2">
                            <button
                              onClick={() => navigate(`/third-party/${thirdPartyId}/orders/${order.oid}`)}
                              className="px-4 py-2 bg-[#0D8568] hover:bg-[#0a6354] text-white font-semibold rounded-lg text-xs transition-colors"
                            >
                              View
                            </button>
                            <button className="px-4 py-2 bg-[#047857] hover:bg-[#065F46] text-white font-semibold rounded-lg text-xs transition-colors">
                              Invoice
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

          {/* Pagination */}
          <div className="flex items-center justify-between px-6 py-4 bg-[#F0F4F3] border-t border-[#D0E0DB]">
            <div className="text-sm text-[#6B8782]">
              {displayOrders.length === 0
                ? 'No orders'
                : `Showing ${startIndex + 1}-${Math.min(startIndex + itemsPerPage, displayOrders.length)} of ${displayOrders.length} orders`}
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                disabled={currentPage === 1}
                className={`px-3 py-2 rounded-lg transition-colors ${currentPage === 1 ? 'text-gray-400 cursor-not-allowed' : 'text-[#6B8782] hover:bg-[#D0E0DB]'
                  }`}
              >
                &lt;
              </button>

              {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => {
                const showPage =
                  page === 1 ||
                  page === totalPages ||
                  (page >= currentPage - 1 && page <= currentPage + 1);
                const showEllipsis =
                  (page === currentPage - 2 && currentPage > 3) ||
                  (page === currentPage + 2 && currentPage < totalPages - 2);

                if (showEllipsis) {
                  return (
                    <button key={page} className="px-3 py-2 text-[#6B8782]">
                      ...
                    </button>
                  );
                }
                if (!showPage) return null;
                return (
                  <button
                    key={page}
                    onClick={() => setCurrentPage(page)}
                    className={`px-4 py-2 rounded-lg font-medium transition-colors ${currentPage === page
                        ? 'bg-[#0D8568] text-white'
                        : 'text-[#6B8782] hover:bg-[#D0E0DB]'
                      }`}
                  >
                    {page}
                  </button>
                );
              })}

              <button
                onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                disabled={currentPage === totalPages || totalPages === 0}
                className={`px-3 py-2 rounded-lg transition-colors ${currentPage === totalPages || totalPages === 0
                    ? 'text-gray-400 cursor-not-allowed'
                    : 'text-[#6B8782] hover:bg-[#D0E0DB]'
                  }`}
              >
                &gt;
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ThirdPartyIndividualOrderHistory;
