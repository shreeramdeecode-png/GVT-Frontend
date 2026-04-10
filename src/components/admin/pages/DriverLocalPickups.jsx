import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, FileDown } from 'lucide-react';
import { getAllOrders } from '../../../api/orderApi';
import { getOrderAssignment } from '../../../api/orderAssignmentApi';
import * as XLSX from 'xlsx';
const DriverLocalPickups = () => {
  const navigate = useNavigate();
  const { id } = useParams(); // Driver ID from URL
  const [showStartModal, setShowStartModal] = useState(false);
  const [showEndKmModal, setShowEndKmModal] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [startKm, setStartKm] = useState('');
  const [endKm, setEndKm] = useState('');

  const sanitizeNonNegativeKm = (value) => {
    if (value === '') return '';
    const num = parseFloat(value);
    if (Number.isNaN(num)) return '';
    return num < 0 ? '0' : value;
  };
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);

  // Fetch driver assignments from stage1_summary_data
  useEffect(() => {
    const fetchDriverAssignments = async () => {
      if (!id) {
        return;
      }

      try {
        setLoading(true);
        // Fetch all orders
        const ordersResponse = await getAllOrders();

        if (!ordersResponse.success || !ordersResponse.data) {
          setOrders([]);
          return;
        }

        const transformedOrders = [];

        // Process each order to find driver assignments
        for (const order of ordersResponse.data) {
          try {
            // Fetch order assignment data
            const assignmentResponse = await getOrderAssignment(order.oid);

            if (!assignmentResponse.success || !assignmentResponse.data) continue;

            const assignmentData = assignmentResponse.data;

            // Parse stage1_summary_data
            let summaryData = null;
            if (assignmentData.stage1_summary_data) {
              try {
                summaryData = typeof assignmentData.stage1_summary_data === 'string'
                  ? JSON.parse(assignmentData.stage1_summary_data)
                  : assignmentData.stage1_summary_data;
              } catch (e) {
                console.error('Error parsing stage1_summary_data:', e);
                continue;
              }
            }

            if (!summaryData || !summaryData.driverAssignments) {
              continue;
            }


            // Find assignments for this specific driver
            // The driver field in stage1_summary_data stores the full driver string "Name - DID"
            // But we need to match against the actual driver ID (did) from the URL
            const driverData = summaryData.driverAssignments.find(
              da => {
                const driverStr = String(da.driver);
                const idStr = String(id);

                // Try multiple matching strategies:
                // 1. Exact match with full string
                if (driverStr === idStr) {
                  return true;
                }

                // 2. Extract and match driver ID from "Name - DRV-ID" format
                if (driverStr.includes(' - ')) {
                  const parts = driverStr.split(' - ');
                  const extractedId = parts[parts.length - 1];
                  if (extractedId === idStr) {
                    return true;
                  }
                }

                // 3. Check if driver string contains the ID anywhere
                if (driverStr.includes(idStr)) {
                  return true;
                }

                return false;
              }
            );

            if (!driverData || !driverData.assignments) {
              continue;
            }

            // Create order entries for each assignment
            driverData.assignments.forEach((assignment, index) => {
              transformedOrders.push({
                id: `${order.oid}-${index}`,
                orderId: order.oid,
                type: 'LOCAL GRADE ORDER',
                product: assignment.product,
                entityType: assignment.entityType === 'farmer' ? 'Farmer' :
                  assignment.entityType === 'supplier' ? 'Supplier' :
                    assignment.entityType === 'thirdParty' ? 'Third Party' :
                      assignment.entityType || 'N/A',
                pickup: {
                  name: assignment.entityName,
                  location: assignment.address || 'Address not available'
                },
                dropoff: {
                  name: 'Warehouse',
                  location: 'Packing Center'
                },
                time: order.created_at ? new Date(order.created_at).toLocaleTimeString('en-US', {
                  hour: '2-digit',
                  minute: '2-digit',
                  hour12: true
                }) : 'N/A',
                timeAgo: order.created_at ? getTimeAgo(order.created_at) : 'N/A',
                status: assignment.status || 'Assigned',
                weight: `${assignment.quantity} kg`,
                quantity: parseFloat(assignment.quantity) || 0,
                price: parseFloat(assignment.price) || 0,
                totalAmount: parseFloat(assignment.totalAmount) || 0,
                assignmentData: assignment,
                orderData: order
              });
            });
          } catch (orderError) {
            console.error(`Error processing order ${order.oid}:`, orderError);
          }
        }

        setOrders(transformedOrders);
      } catch (error) {
        console.error('Error fetching driver assignments:', error);
        setOrders([]);
      } finally {
        setLoading(false);
      }
    };

    fetchDriverAssignments();
  }, [id]);

  // Helper function to calculate time ago
  const getTimeAgo = (dateString) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 60) return `${diffMins} mins ago`;
    if (diffHours < 24) return `${diffHours} hrs ago`;
    if (diffDays === 0) return 'Today';
    return `${diffDays} days ago`;
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'Delivered':
      case 'Completed':
        return 'bg-emerald-100 text-emerald-700';
      case 'In Transit':
        return 'bg-blue-100 text-blue-700';
      case 'Collected':
        return 'bg-purple-100 text-purple-700';
      case 'Expenses':
        return 'bg-orange-100 text-orange-700';
      case 'Assigned':
        return 'bg-yellow-100 text-yellow-700';
      default:
        return 'bg-gray-100 text-gray-700';
    }
  };

  const handleStatusChange = (orderId, newStatus) => {
    setOrders(orders.map(order =>
      order.id === orderId ? { ...order, status: newStatus } : order
    ));
  };

  const handleStartClick = (order) => {
    setSelectedOrder(order);
    setShowStartModal(true);
  };

  const handleStartSubmit = () => {
    if (!startKm || (parseFloat(startKm) || 0) < 0) return;
    handleStatusChange(selectedOrder.id, 'In Transit');
    setShowStartModal(false);
    setStartKm('');
    setSelectedOrder(null);
  };

  const handleEndKmClick = (order) => {
    setSelectedOrder(order);
    setShowEndKmModal(true);
  };

  const handleEndKmSubmit = () => {
    if (!endKm || (parseFloat(endKm) || 0) < 0) return;
    handleStatusChange(selectedOrder.id, 'Completed');
    setShowEndKmModal(false);
    setEndKm('');
    setSelectedOrder(null);
  };

  const getActionButton = (order) => {
    switch (order.status) {
      case 'Assigned':
        return (
          <button
            onClick={() => handleStartClick(order)}
            className="px-4 py-2 bg-teal-600 text-white rounded-lg text-xs font-medium hover:bg-teal-700 transition-colors"
          >
            Start
          </button>
        );
      case 'In Transit':
        return (
          <button
            onClick={() => handleStatusChange(order.id, 'Collected')}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg text-xs font-medium hover:bg-blue-700 transition-colors"
          >
            Mark Collected
          </button>
        );
      case 'Collected':
        return (
          <button
            onClick={() => handleStatusChange(order.id, 'Delivered')}
            className="px-4 py-2 bg-purple-600 text-white rounded-lg text-xs font-medium hover:bg-purple-700 transition-colors"
          >
            Mark Delivered
          </button>
        );
      case 'Delivered':
        return (
          <button
            onClick={() => handleEndKmClick(order)}
            className="px-4 py-2 bg-green-600 text-white rounded-lg text-xs font-medium hover:bg-green-700 transition-colors"
          >
            Complete
          </button>
        );
      case 'Expenses':
        return (
          <button
            onClick={() => handleEndKmClick(order)}
            className="px-4 py-2 bg-green-600 text-white rounded-lg text-xs font-medium hover:bg-green-700 transition-colors"
          >
            Complete
          </button>
        );
      case 'Completed':
        return (
          <span className="text-xs text-gray-500 font-medium">Completed</span>
        );
      default:
        return null;
    }
  };

  // Export to Excel function
  const handleExportToExcel = () => {
    if (orders.length === 0) {
      alert('No data to export');
      return;
    }

    // Prepare data for export
    const exportData = orders.map((order, index) => ({
      'S.No': index + 1,
      'Order ID': order.orderId,
      'Type': order.type,
      'Product': order.product,
      'Entity Type': order.entityType,
      'Pickup From - Name': order.pickup.name,
      'Pickup From - Address': order.pickup.location,
      'Date': order.orderData?.createdAt
        ? new Date(order.orderData.createdAt).toLocaleDateString('en-US', {
          year: 'numeric',
          month: 'short',
          day: '2-digit'
        })
        : 'N/A',
      'Status': order.status,
      'Quantity': order.weight,
      'Price/kg': `₹${order.price}`,
      'Total Amount': `₹${order.totalAmount}`
    }));

    // Add summary row
    const totalWeight = orders.reduce((sum, order) => sum + order.quantity, 0);
    const totalAmount = orders.reduce((sum, order) => sum + order.totalAmount, 0);

    exportData.push({
      'S.No': '',
      'Order ID': '',
      'Type': '',
      'Product': '',
      'Entity Type': '',
      'Pickup From - Name': '',
      'Pickup From - Address': 'TOTAL',
      'Date': '',
      'Status': '',
      'Quantity': `${totalWeight} kg`,
      'Price/kg': '',
      'Total Amount': `₹${totalAmount.toFixed(2)}`
    });

    // Create worksheet
    const worksheet = XLSX.utils.json_to_sheet(exportData);

    // Auto-size columns
    worksheet['!cols'] = [
      { wch: 6 },  // S.No
      { wch: 12 }, // Order ID
      { wch: 15 }, // Type
      { wch: 20 }, // Product
      { wch: 15 }, // Entity Type
      { wch: 25 }, // Pickup From - Name
      { wch: 40 }, // Pickup From - Address
      { wch: 15 }, // Date
      { wch: 12 }, // Status
      { wch: 12 }, // Quantity
      { wch: 12 }, // Price/kg
      { wch: 15 }  // Total Amount
    ];

    // Create workbook
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Driver Assignments');

    // Generate filename
    const fileName = `Driver_${id}_Local_Pickups_${new Date().toISOString().split('T')[0]}.xlsx`;

    // Download file
    XLSX.writeFile(workbook, fileName);
  };

  const totalWeight = orders.reduce((sum, order) => {
    return sum + parseInt(order.weight);
  }, 0);

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-emerald-50 p-4 sm:p-6 lg:p-8">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <button
            onClick={() => navigate('/drivers')}
            className="flex items-center gap-2 text-[#0D5C4D] hover:text-[#0a6354] transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
            <span className="font-medium">Back to Driver Management</span>
          </button>

          <button
            onClick={handleExportToExcel}
            className="px-6 py-2.5 bg-[#10B981] text-white rounded-lg hover:bg-[#059669] transition-colors duration-200 font-medium flex items-center gap-2"
          >
            <FileDown className="w-4 h-4" />
            Export to Excel
          </button>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-6 overflow-x-auto">
          <button
            onClick={() => navigate(`/drivers/${id}`)}
            className="px-6 py-2.5 rounded-lg font-medium transition-all text-sm bg-white text-gray-600 hover:bg-gray-50 border border-gray-200 whitespace-nowrap"
          >
            Driver Details
          </button>
          <button
            onClick={() => navigate('/start-end-km-management', { state: { driverId: id } })}
            className="px-6 py-2.5 rounded-lg font-medium transition-all text-sm whitespace-nowrap bg-white text-gray-600 hover:bg-gray-50 border border-gray-200"
          >
            Start KM/End KM
          </button>
          <button
            className="px-6 py-2.5 rounded-lg font-medium transition-all text-sm whitespace-nowrap bg-[#0D7C66] text-white shadow-md"
          >
            LOCAL GRADE ORDER
          </button>
          <button
            onClick={() => navigate(`/drivers/${id}/airport`)}
            className="px-6 py-2.5 rounded-lg font-medium transition-all text-sm bg-white text-gray-600 hover:bg-gray-50 border border-gray-200 whitespace-nowrap"
          >
            BOX ORDER
          </button>
          <button
            onClick={() => navigate('/fuel-expense-management', { state: { driverId: id } })}
            className="px-6 py-2.5 rounded-lg font-medium transition-all text-sm bg-white text-gray-600 hover:bg-gray-50 border border-gray-200 whitespace-nowrap"
          >
            Fuel Expenses
          </button>
          <button
            onClick={() => navigate('/advance-pay-management')}
            className="px-6 py-2.5 rounded-lg font-medium transition-all text-sm bg-white text-gray-600 hover:bg-gray-50 border border-gray-200 whitespace-nowrap"
          >
            Advance Pay
          </button>
          <button
            onClick={() => navigate('/remarks-management')}
            className="px-6 py-2.5 rounded-lg font-medium transition-all text-sm bg-white text-gray-600 hover:bg-gray-50 border border-gray-200 whitespace-nowrap"
          >
            Remarks
          </button>
          <button
            onClick={() => navigate(`/drivers/${id}/daily-payout`)}
            className="px-6 py-2.5 rounded-lg font-medium transition-all text-sm bg-white text-gray-600 hover:bg-gray-50 border border-gray-200 whitespace-nowrap"
          >
            Daily Payout
          </button>
        </div>

        {/* Content Area */}
        <div className="bg-white rounded-2xl overflow-hidden border border-[#D0E0DB]">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-teal-600"></div>
              <p className="ml-4 text-gray-600">Loading driver assignments...</p>
            </div>
          ) : orders.length === 0 ? (
            <div className="flex items-center justify-center py-12">
              <p className="text-gray-500">No assignments found for this driver.</p>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="bg-[#D4F4E8]">
                      <th className="px-6 py-4 text-left text-sm font-semibold text-[#0D5C4D]">Order ID</th>
                      <th className="px-6 py-4 text-left text-sm font-semibold text-[#0D5C4D]">Product</th>
                      <th className="px-6 py-4 text-left text-sm font-semibold text-[#0D5C4D]">Entity Type</th>
                      <th className="px-6 py-4 text-left text-sm font-semibold text-[#0D5C4D]">Pickup From</th>
                      <th className="px-6 py-4 text-left text-sm font-semibold text-[#0D5C4D]">Date</th>
                      <th className="px-6 py-4 text-left text-sm font-semibold text-[#0D5C4D]">Status</th>
                      <th className="px-6 py-4 text-left text-sm font-semibold text-[#0D5C4D]">Quantity</th>
                      <th className="px-6 py-4 text-left text-sm font-semibold text-[#0D5C4D]">Price/kg</th>
                      <th className="px-6 py-4 text-left text-sm font-semibold text-[#0D5C4D]">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {orders.map((order, index) => (
                      <tr key={index} className={`border-b border-[#D0E0DB] hover:bg-[#F0F4F3] transition-colors ${index % 2 === 0 ? 'bg-white' : 'bg-[#F0F4F3]/30'}`}>
                        <td className="px-6 py-4">
                          <div className="font-semibold text-[#0D5C4D] text-sm">{order.orderId}</div>
                          <div className="text-xs text-[#6B8782]">{order.type}</div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="font-medium text-[#0D5C4D] text-sm">{order.product}</div>
                        </td>
                        <td className="px-6 py-4">
                          <span className="inline-block px-3 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-700">
                            {order.entityType}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <div className="font-medium text-[#0D5C4D] text-sm">{order.pickup.name}</div>
                          <div className="text-xs text-[#6B8782] max-w-xs truncate" title={order.pickup.location}>
                            {order.pickup.location}
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="font-semibold text-[#0D5C4D] text-sm">
                            {order.orderData?.createdAt
                              ? new Date(order.orderData.createdAt).toLocaleDateString('en-US', {
                                year: 'numeric',
                                month: 'short',
                                day: '2-digit'
                              })
                              : 'N/A'}
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <span className={`px-3 py-1.5 rounded-full text-xs font-medium ${getStatusColor(order.status)}`}>
                            {order.status}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <div className="font-semibold text-[#0D5C4D] text-sm">{order.weight}</div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="font-semibold text-[#0D5C4D] text-sm">₹{order.price}</div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="font-bold text-[#0D7C66] text-sm">₹{order.totalAmount}</div>
                        </td>

                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="flex items-center justify-between px-6 py-4 bg-[#F0F4F3] border-t border-[#D0E0DB]">
                <div className="text-sm text-[#6B8782]">
                  Showing {orders.length} {orders.length === 1 ? 'assignment' : 'assignments'}
                </div>
                <div className="flex gap-6">
                  <div className="text-sm font-semibold text-[#0D5C4D]">
                    Total Weight: <span className="text-[#0D7C66]">{totalWeight.toLocaleString()} kg</span>
                  </div>
                  <div className="text-sm font-semibold text-[#0D5C4D]">
                    Total Amount: <span className="text-[#0D7C66]">₹{orders.reduce((sum, order) => sum + parseFloat(order.totalAmount || 0), 0).toFixed(2)}</span>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Start Kilometer Modal */}
      {showStartModal && (
        <div className="fixed inset-0 flex items-center justify-center z-50" style={{ backgroundColor: 'rgba(0, 0, 0, 0.5)' }}>
          <div className="bg-white rounded-lg p-6 w-96">
            <h3 className="text-lg font-bold text-gray-900 mb-4">Start Journey</h3>
            <div className="mb-4">
              <label className="block text-sm text-gray-700 mb-2">Start Kilometer</label>
              <div className="flex gap-2">
                <input
                  type="number"
                  min="0"
                  value={startKm}
                  onChange={(e) => setStartKm(sanitizeNonNegativeKm(e.target.value))}
                  placeholder="Enter kilometer"
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
                />
                <span className="px-4 py-2 bg-gray-100 border border-gray-300 rounded-lg text-gray-700">km</span>
              </div>
            </div>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => {
                  setShowStartModal(false);
                  setStartKm('');
                  setSelectedOrder(null);
                }}
                className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleStartSubmit}
                disabled={!startKm}
                className="px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 disabled:opacity-50"
              >
                OK
              </button>
            </div>
          </div>
        </div>
      )}

      {/* End Kilometer Modal */}
      {showEndKmModal && (
        <div className="fixed inset-0 flex items-center justify-center z-50" style={{ backgroundColor: 'rgba(0, 0, 0, 0.5)' }}>
          <div className="bg-white rounded-lg p-6 w-96">
            <h3 className="text-lg font-bold text-gray-900 mb-4">End Journey</h3>
            <div className="mb-4">
              <label className="block text-sm text-gray-700 mb-2">End Kilometer</label>
              <div className="flex gap-2">
                <input
                  type="number"
                  min="0"
                  value={endKm}
                  onChange={(e) => setEndKm(sanitizeNonNegativeKm(e.target.value))}
                  placeholder="Enter kilometer"
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
                />
                <span className="px-4 py-2 bg-gray-100 border border-gray-300 rounded-lg text-gray-700">km</span>
              </div>
            </div>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => {
                  setShowEndKmModal(false);
                  setEndKm('');
                  setSelectedOrder(null);
                }}
                className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleEndKmSubmit}
                disabled={!endKm}
                className="px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 disabled:opacity-50"
              >
                OK
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DriverLocalPickups;