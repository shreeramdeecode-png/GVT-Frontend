import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Search, ChevronDown, ArrowLeft, FileText, X } from 'lucide-react';
import { getAllOrders, getOrderById } from '../../../api/orderApi';
import { getOrderAssignment } from '../../../api/orderAssignmentApi';
import { getAllFarmers } from '../../../api/farmerApi';
import { getAllSuppliers } from '../../../api/supplierApi';
import { getAllThirdParties } from '../../../api/thirdPartyApi';
import { getAllDrivers } from '../../../api/driverApi';
import * as XLSX from 'xlsx';

const OrdersList = () => {
  const navigate = useNavigate();
  const { id } = useParams(); // Get farmer ID from URL (route is /farmers/:id/orders)
  const farmerId = id; // Use id from route params
  const [searchTerm, setSearchTerm] = useState('');
  const [timeFilter, setTimeFilter] = useState('All Time');
  const [statusFilter, setStatusFilter] = useState('All Status');
  const [currentPage, setCurrentPage] = useState(1);

  // Real data states
  const [allOrders, setAllOrders] = useState([]); // All orders from backend
  const [filteredOrders, setFilteredOrders] = useState([]); // Orders filtered by farmer
  const [loading, setLoading] = useState(true);
  const [farmers, setFarmers] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [thirdParties, setThirdParties] = useState([]);
  const [drivers, setDrivers] = useState([]);
  const [currentFarmer, setCurrentFarmer] = useState(null);
  const [farmerAmounts, setFarmerAmounts] = useState({}); // Store farmer-specific amounts per order

  // Fetch all orders and entities on component mount
  useEffect(() => {
    const fetchOrders = async () => {
      try {
        setLoading(true);
        const [ordersRes, farmersRes, suppliersRes, thirdPartiesRes, driversRes] = await Promise.all([
          getAllOrders(),
          getAllFarmers(),
          getAllSuppliers(),
          getAllThirdParties(),
          getAllDrivers()
        ]);

        const fetchedFarmers = farmersRes?.data || [];
        setFarmers(fetchedFarmers);
        setSuppliers(suppliersRes?.data || []);
        setThirdParties(thirdPartiesRes?.data || []);
        setDrivers(driversRes?.data || []);

        // Find current farmer
        const farmer = fetchedFarmers.find(f => f.fid == farmerId);
        setCurrentFarmer(farmer);

        if (ordersRes?.data) {
          const orders = ordersRes.data;

          // Sort orders by createdAt descending (newest first)
          const sortedOrders = [...orders].sort((a, b) => {
            const dateA = new Date(a.createdAt || 0);
            const dateB = new Date(b.createdAt || 0);
            return dateB - dateA; // Descending order
          });

          setAllOrders(sortedOrders);

          // Filter orders by farmer assignments and fetch amounts
          await filterOrdersByFarmer(sortedOrders);
        }
      } catch (error) {
        console.error('Error fetching orders:', error);
      } finally {
        setLoading(false);
      }
    };

    if (farmerId) {
      fetchOrders();
    } else {
      setLoading(false);
    }
  }, [farmerId]);

  // Function to filter orders by farmer assignments and fetch farmer-specific amounts
  const filterOrdersByFarmer = async (orders) => {
    const amounts = {};
    const farmerOrders = [];

    for (const order of orders) {
      try {
        const assignmentRes = await getOrderAssignment(order.oid).catch(() => null);

        if (assignmentRes?.data?.product_assignments) {
          let assignments = [];
          try {
            assignments = typeof assignmentRes.data.product_assignments === 'string'
              ? JSON.parse(assignmentRes.data.product_assignments)
              : assignmentRes.data.product_assignments;
          } catch (e) {
            assignments = [];
          }

          // Filter farmer's assignments
          const farmerAssignments = assignments.filter(
            a => a.entityType === 'farmer' && a.entityId == farmerId
          );

          // Only include order if farmer has assignments
          if (farmerAssignments.length > 0) {
            // Calculate total amount for this farmer
            const total = farmerAssignments.reduce((sum, assignment) => {
              const qty = parseFloat(assignment.assignedQty) || 0;
              const price = parseFloat(assignment.price) || 0;
              return sum + (qty * price);
            }, 0);

            amounts[order.oid] = total;
            farmerOrders.push(order);
          }
        }
      } catch (error) {
        console.error(`Error fetching assignment for order ${order.oid}:`, error);
      }
    }

    setFarmerAmounts(amounts);
    setFilteredOrders(farmerOrders);
  };

  // Get entity name by type and ID
  const getEntityName = (entityType, entityId) => {
    if (entityType === 'farmer') {
      const farmer = farmers.find(f => f.fid == entityId);
      return farmer?.farmer_name || 'Unknown';
    } else if (entityType === 'supplier') {
      const supplier = suppliers.find(s => s.sid == entityId);
      return supplier?.supplier_name || 'Unknown';
    } else if (entityType === 'thirdParty') {
      const thirdParty = thirdParties.find(tp => tp.tpid == entityId);
      return thirdParty?.third_party_name || 'Unknown';
    }
    return 'Unknown';
  };

  // Get driver name by driver code
  const getDriverName = (driverCode) => {
    const driver = drivers.find(d => d.driver_code === driverCode);
    return driver ? `${driver.driver_name} - ${driver.driver_code}` : driverCode || 'Not Assigned';
  };

  // Export to Excel function
  const handleExport = () => {
    if (filteredOrders.length === 0) {
      alert('No data to export');
      return;
    }

    // Prepare data for export
    const exportData = [];
    filteredOrders.forEach(order => {
      const orderDate = order.createdAt ? new Date(order.createdAt).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: '2-digit' }) : 'N/A';
      const products = order.items || [];
      const productNames = products.map(p => p.product_name || p.product).join(', ');
      const paymentStatus = order.payment_status === 'paid' || order.payment_status === 'completed' ? 'Paid' : 'Unpaid';
      const farmerAmount = farmerAmounts[order.oid] || 0;

      exportData.push({
        'Order ID': order.oid,
        'Customer Name': order.customer_name || 'N/A',
        'Phone Number': order.phone_number || 'N/A',
        'Products': productNames,
        'Created Date': orderDate,
        'Farmer Amount': farmerAmount,
        'Total Order Amount': parseFloat(order.total_amount) || 0,
        'Payment Status': paymentStatus,
        'Order Status': order.order_status || 'N/A'
      });
    });

    // Create worksheet from data
    const worksheet = XLSX.utils.json_to_sheet(exportData);

    // Auto-size columns
    const columnWidths = [];
    const headers = Object.keys(exportData[0]);

    headers.forEach((header) => {
      let maxWidth = header.length;
      exportData.forEach(row => {
        const value = String(row[header] || '');
        maxWidth = Math.max(maxWidth, value.length);
      });
      // Add some padding and cap at 50 characters
      columnWidths.push({ wch: Math.min(maxWidth + 2, 50) });
    });

    worksheet['!cols'] = columnWidths;

    // Create workbook and add worksheet
    const workbook = XLSX.utils.book_new();
    const farmerName = currentFarmer?.farmer_name || 'Farmer';
    XLSX.utils.book_append_sheet(workbook, worksheet, `${farmerName} Orders`);

    // Generate Excel file and trigger download
    const fileName = `${farmerName.replace(/\s+/g, '_')}_order_history_${new Date().toISOString().split('T')[0]}.xlsx`;
    XLSX.writeFile(workbook, fileName);
  };

  const statsCards = [
    { label: 'Total Orders', value: filteredOrders.length.toString(), color: 'bg-gradient-to-r from-[#D1FAE5] to-[#A7F3D0]', textColor: 'text-[#0D5C4D]' },
    { label: 'Pending Orders', value: filteredOrders.filter(o => o.order_status === 'pending').length.toString(), color: 'bg-gradient-to-r from-[#6EE7B7] to-[#34D399]', textColor: 'text-[#0D5C4D]' },
    { label: 'Completed Orders', value: filteredOrders.filter(o => o.order_status === 'delivered').length.toString(), color: 'bg-gradient-to-r from-[#10B981] to-[#059669]', textColor: 'text-white' },
    { label: 'Total Order Value', value: '₹' + (filteredOrders.reduce((sum, o) => sum + (parseFloat(o.total_amount) || 0), 0) / 100000).toFixed(1) + ' L', color: 'bg-gradient-to-r from-[#047857] to-[#065F46]', textColor: 'text-white' }
  ];

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

        {/* Farmer Info Header */}
        {currentFarmer && (
          <div className="bg-gradient-to-r from-[#0D7C66] to-[#10B981] rounded-xl p-6 mb-6 text-white">
            <h1 className="text-2xl font-bold mb-2">{currentFarmer.farmer_name}</h1>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
              <div>
                <span className="opacity-80">Farmer ID:</span>
                <span className="ml-2 font-semibold">{currentFarmer.fid}</span>
              </div>
              <div>
                <span className="opacity-80">Phone:</span>
                <span className="ml-2 font-semibold">{currentFarmer.phone_number || 'N/A'}</span>
              </div>
              <div>
                <span className="opacity-80">Location:</span>
                <span className="ml-2 font-semibold">{currentFarmer.city || 'N/A'}, {currentFarmer.state || 'N/A'}</span>
              </div>
            </div>
          </div>
        )}

        {/* Search Bar and Filters */}
        <div className="flex flex-col sm:flex-row gap-4 mb-6">
          {/* Search Input */}
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input
              type="text"
              placeholder="Search by order ID, farmer name..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-white border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#0D7C66] focus:border-transparent"
            />
          </div>

          {/* Time Filter */}
          <div className="relative">
            <select
              value={timeFilter}
              onChange={(e) => setTimeFilter(e.target.value)}
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

          {/* Status Filter */}
          <div className="relative">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="appearance-none px-4 py-2.5 pr-10 bg-white border border-gray-200 rounded-lg text-sm font-medium text-gray-700 focus:outline-none focus:ring-2 focus:ring-[#0D7C66] focus:border-transparent cursor-pointer min-w-[140px]"
            >
              <option>All Status</option>
              <option>Cancelled</option>
              <option>Delivered</option>
              <option>In Transit</option>
              <option>Processing</option>
            </select>
            <ChevronDown className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4 pointer-events-none" />
          </div>

          {/* Export Button */}
          <button onClick={handleExport} className="px-6 py-2.5 bg-[#1DB890] hover:bg-[#19a57e] text-white font-semibold rounded-lg text-sm transition-colors whitespace-nowrap">
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
                  <th className="px-6 py-4 text-left text-sm font-semibold text-[#0D5C4D]">Farmer Name</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-[#0D5C4D]">Products</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-[#0D5C4D]">Created Date</th>
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
                ) : filteredOrders.length === 0 ? (
                  <tr>
                    <td colSpan="7" className="px-6 py-12 text-center text-sm text-gray-600">
                      No orders found
                    </td>
                  </tr>
                ) : (() => {
                  // Pagination logic
                  const itemsPerPage = 7;
                  const totalPages = Math.ceil(filteredOrders.length / itemsPerPage);
                  const startIndex = (currentPage - 1) * itemsPerPage;
                  const endIndex = startIndex + itemsPerPage;
                  const currentOrders = filteredOrders.slice(startIndex, endIndex);

                  return currentOrders.map((order, index) => {
                    const orderDate = order.createdAt ? new Date(order.createdAt).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: '2-digit' }) : 'N/A';
                    const products = order.items || [];
                    const displayProducts = products.slice(0, 2);
                    const remainingCount = products.length - displayProducts.length;

                    return (
                      <tr
                        key={order.oid}
                        className={`border-b border-[#D0E0DB] hover:bg-[#F0F4F3] transition-colors ${index % 2 === 0 ? 'bg-white' : 'bg-[#F0F4F3]/30'
                          }`}
                      >
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-[#B8F4D8] flex items-center justify-center text-[#0D5C4D] font-semibold text-sm">
                              {order.customer_name?.substring(0, 2).toUpperCase() || 'OR'}
                            </div>
                            <span className="text-sm font-semibold text-[#0D5C4D]">{order.oid}</span>
                          </div>
                        </td>

                        <td className="px-6 py-4">
                          <div className="text-sm text-[#0D5C4D]">{order.customer_name || 'N/A'}</div>
                          <div className="text-xs text-[#6B8782]">{order.phone_number || 'N/A'}</div>
                        </td>

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

                        <td className="px-6 py-4">
                          <div className="text-sm text-[#0D5C4D]">{orderDate}</div>
                        </td>

                        <td className="px-6 py-4">
                          <div className="text-sm font-semibold text-[#0D5C4D]">₹{(farmerAmounts[order.oid] || 0).toLocaleString()}</div>
                        </td>

                        <td className="px-6 py-4">
                          <span className={`px-3 py-1.5 rounded-full text-xs font-medium flex items-center gap-1 w-fit ${order.payment_status === 'paid' || order.payment_status === 'completed'
                            ? 'bg-[#4ED39A] text-white'
                            : 'bg-[#FFE0E0] text-[#CC0000]'
                            }`}>
                            <div className={`w-2 h-2 rounded-full ${order.payment_status === 'paid' || order.payment_status === 'completed'
                              ? 'bg-white'
                              : 'bg-[#CC0000]'
                              }`}></div>
                            {order.payment_status === 'paid' || order.payment_status === 'completed' ? 'Paid' : 'Unpaid'}
                          </span>
                        </td>

                        <td className="px-6 py-4">
                          <div className="flex gap-2">
                            <button
                              onClick={() => navigate(`/farmers/${farmerId}/orders/${order.oid}`)}
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
                  });
                })()}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="flex items-center justify-between px-6 py-4 bg-[#F0F4F3] border-t border-[#D0E0DB]">
            <div className="text-sm text-[#6B8782]">
              {(() => {
                const itemsPerPage = 7;
                const totalItems = filteredOrders.length;
                const startItem = totalItems === 0 ? 0 : (currentPage - 1) * itemsPerPage + 1;
                const endItem = Math.min(currentPage * itemsPerPage, totalItems);
                return `Showing ${startItem}-${endItem} of ${totalItems} orders`;
              })()}
            </div>
            <div className="flex items-center gap-2">
              {(() => {
                const itemsPerPage = 7;
                const totalPages = Math.ceil(filteredOrders.length / itemsPerPage);

                return (
                  <>
                    {/* Previous Button */}
                    <button
                      onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                      disabled={currentPage === 1}
                      className={`px-3 py-2 rounded-lg transition-colors ${currentPage === 1
                        ? 'text-gray-400 cursor-not-allowed'
                        : 'text-[#6B8782] hover:bg-[#D0E0DB]'
                        }`}
                    >
                      &lt;
                    </button>

                    {/* Page Numbers */}
                    {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => {
                      // Show first page, last page, current page, and pages around current
                      const showPage = page === 1 ||
                        page === totalPages ||
                        (page >= currentPage - 1 && page <= currentPage + 1);

                      const showEllipsis = (page === currentPage - 2 && currentPage > 3) ||
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

                    {/* Next Button */}
                    <button
                      onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                      disabled={currentPage === totalPages}
                      className={`px-3 py-2 rounded-lg transition-colors ${currentPage === totalPages
                        ? 'text-gray-400 cursor-not-allowed'
                        : 'text-[#6B8782] hover:bg-[#D0E0DB]'
                        }`}
                    >
                      &gt;
                    </button>
                  </>
                );
              })()}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default OrdersList;
