import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Star, ChevronDown, ChevronRight, ArrowLeft, FileDown } from 'lucide-react';
import { getAllOrders } from '../../../api/orderApi';
import { getOrderAssignment } from '../../../api/orderAssignmentApi';
import { getDriverById } from '../../../api/driverApi';
import * as XLSX from 'xlsx';

const DriverAirportDeliveryPage = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const [showStartModal, setShowStartModal] = useState(false);
  const [showExpensesModal, setShowExpensesModal] = useState(false);
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
  const [expenseData, setExpenseData] = useState({
    fuelType: 'Petrol',
    petrolBunkName: 'Indian Oil Petroleum',
    unitPrice: '',
    litre: ''
  });

  const [driverInfo, setDriverInfo] = useState(null);
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);

  // Fetch driver info and airport delivery assignments
  useEffect(() => {
    const fetchDriverAirportDeliveries = async () => {
      if (!id) return;

      try {
        setLoading(true);

        // Fetch driver information
        const driverResponse = await getDriverById(id);
        if (driverResponse.success && driverResponse.data) {
          setDriverInfo(driverResponse.data);
        }

        // Fetch all orders
        const ordersResponse = await getAllOrders();

        if (!ordersResponse.success || !ordersResponse.data) {
          setOrders([]);
          return;
        }

        const transformedOrders = [];

        for (const order of ordersResponse.data) {
          try {
            const assignmentResponse = await getOrderAssignment(order.oid);

            if (!assignmentResponse.success || !assignmentResponse.data) continue;

            const assignmentData = assignmentResponse.data;

            // Parse stage3_summary_data
            let stage3Data = null;
            if (assignmentData.stage3_summary_data) {
              try {
                stage3Data = typeof assignmentData.stage3_summary_data === 'string'
                  ? JSON.parse(assignmentData.stage3_summary_data)
                  : assignmentData.stage3_summary_data;
              } catch (e) {
                console.error('Error parsing stage3_summary_data:', e);
                continue;
              }
            }

            if (!stage3Data || !stage3Data.driverAssignments) continue;

            // Find assignments for this specific driver
            const driverAssignment = stage3Data.driverAssignments.find(
              da => {
                const driverStr = String(da.driver);
                const idStr = String(id);

                // Try multiple matching strategies
                if (driverStr === idStr) return true;
                if (driverStr.includes(' - ')) {
                  const parts = driverStr.split(' - ');
                  const extractedId = parts[parts.length - 1];
                  if (extractedId === idStr) return true;
                }
                if (driverStr.includes(idStr)) return true;

                return false;
              }
            );

            if (!driverAssignment || !driverAssignment.assignments) continue;

            // Create order entries for each airport assignment
            driverAssignment.assignments.forEach((assignment, index) => {
              // Only include airport deliveries
              if (assignment.airportName && assignment.airportLocation) {
                // Find the original order item to get totalBoxes
                const orderItem = order.items?.find(item => item.oiid === assignment.oiid);
                const parseNumBoxes = (numBoxesStr) => {
                  if (!numBoxesStr) return 0;
                  const match = String(numBoxesStr).match(/^(\d+(?:\.\d+)?)/);
                  return match ? parseFloat(match[1]) : 0;
                };
                const totalBoxes = orderItem ? parseNumBoxes(orderItem.num_boxes) : 0;

                transformedOrders.push({
                  id: `${order.oid}-${index}`,
                  orderId: order.oid,
                  type: 'Line Airport',
                  pickup: {
                    name: 'Warehouse',
                    location: 'Packing Center'
                  },
                  airport: {
                    name: assignment.airportName,
                    terminal: assignment.airportLocation || 'Cargo Terminal'
                  },
                  flightTime: 'N/A',
                  timeInfo: order.createdAt ? getTimeAgo(order.createdAt) : 'N/A',
                  status: assignment.status || 'Assigned',
                  weight: `${assignment.noOfPkgs || 0} pkgs`,
                  product: assignment.product,
                  ct: assignment.ct,
                  grossWeight: assignment.grossWeight,
                  labour: assignment.labour,
                  totalBoxes: totalBoxes,
                  noOfPkgs: assignment.noOfPkgs,
                  vehicleNumber: driverAssignment.vehicleNumber || '',
                  phoneNumber: driverAssignment.phoneNumber || '',
                  assignmentData: assignment,
                  orderData: order,
                  driverData: driverAssignment
                });
              }
            });
          } catch (orderError) {
            console.error(`Error processing order ${order.oid}:`, orderError);
          }
        }

        setOrders(transformedOrders);
      } catch (error) {
        console.error('Error fetching driver airport deliveries:', error);
        setOrders([]);
      } finally {
        setLoading(false);
      }
    };

    fetchDriverAirportDeliveries();
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

  const handleExpensesClick = (order) => {
    setSelectedOrder(order);
    setShowExpensesModal(true);
  };

  const handleExpensesSubmit = () => {
    if (!expenseData.petrolBunkName || !expenseData.unitPrice || !expenseData.litre) return;
    handleStatusChange(selectedOrder.id, 'Expenses');
    setShowExpensesModal(false);
    setExpenseData({ fuelType: 'Petrol', petrolBunkName: '', unitPrice: '', litre: '' });
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

  const calculateTotal = () => {
    const total = (parseFloat(expenseData.unitPrice) || 0) * (parseFloat(expenseData.litre) || 0);
    return total.toFixed(2);
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
            onClick={() => handleExpensesClick(order)}
            className="px-4 py-2 bg-orange-600 text-white rounded-lg text-xs font-medium hover:bg-orange-700 transition-colors"
          >
            Expenses
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

  const totalWeight = orders.reduce((sum, order) => {
    return sum + parseInt(order.weight);
  }, 0);

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
      'Product': order.product || 'N/A',
      'Gross Weight': order.grossWeight || 'N/A',
      'Assigned Labour': order.labour || 'N/A',
      'Total Boxes/Bags': order.totalBoxes || 0,
      'CT': order.ct || 'N/A',
      'No of Pkgs': order.noOfPkgs || 0,
      'Airport Name': order.airport.name,
      'Airport Location': order.airport.terminal,
      'Vehicle Number': order.vehicleNumber || 'N/A',
      'Status': order.status
    }));

    // Add summary row
    const totalPkgs = orders.reduce((sum, order) => sum + (order.noOfPkgs || 0), 0);
    const totalBoxes = orders.reduce((sum, order) => sum + (order.totalBoxes || 0), 0);

    exportData.push({
      'S.No': '',
      'Order ID': '',
      'Product': '',
      'Gross Weight': '',
      'Assigned Labour': 'TOTAL',
      'Total Boxes/Bags': totalBoxes,
      'CT': '',
      'No of Pkgs': totalPkgs,
      'Airport Name': '',
      'Airport Location': '',
      'Vehicle Number': '',
      'Status': ''
    });

    // Create worksheet
    const worksheet = XLSX.utils.json_to_sheet(exportData);

    // Auto-size columns
    worksheet['!cols'] = [
      { wch: 6 },  // S.No
      { wch: 15 }, // Order ID
      { wch: 20 }, // Product
      { wch: 15 }, // Gross Weight
      { wch: 20 }, // Assigned Labour
      { wch: 18 }, // Total Boxes/Bags
      { wch: 12 }, // CT
      { wch: 12 }, // No of Pkgs
      { wch: 25 }, // Airport Name
      { wch: 25 }, // Airport Location
      { wch: 18 }, // Vehicle Number
      { wch: 12 }  // Status
    ];

    // Create workbook
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Airport Deliveries');

    // Generate filename
    const fileName = `Driver_${id}_Airport_Deliveries_${new Date().toISOString().split('T')[0]}.xlsx`;

    // Download file
    XLSX.writeFile(workbook, fileName);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-50 via-teal-50 to-cyan-50 p-4 sm:p-6 lg:p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
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
            className="px-6 py-2.5 rounded-lg font-medium transition-all text-sm whitespace-nowrap bg-white text-gray-600 hover:bg-gray-50 border border-gray-200"
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
            onClick={() => navigate(`/drivers/${id}/local-pickups`)}
            className="px-6 py-2.5 rounded-lg font-medium transition-all text-sm whitespace-nowrap bg-white text-gray-600 hover:bg-gray-50 border border-gray-200"
          >
            LOCAL GRADE ORDER
          </button>
          <button
            className="px-6 py-2.5 rounded-lg font-medium transition-all text-sm whitespace-nowrap bg-[#0D7C66] text-white shadow-md"
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
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-[#D4F4E8]">
                  <th className="px-6 py-4 text-left text-sm font-semibold text-[#0D5C4D]">Order ID</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-[#0D5C4D]">Product</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-[#0D5C4D]">Gross Weight</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-[#0D5C4D]">Assigned Labour</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-[#0D5C4D]">Total Boxes/Bags</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-[#0D5C4D]">CT</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-[#0D5C4D]">No of Pkgs</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-[#0D5C4D]">Airport Name</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-[#0D5C4D]">Vehicle Number</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-[#0D5C4D]">Status</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan="10" className="px-6 py-12 text-center">
                      <div className="flex items-center justify-center gap-2">
                        <div className="w-5 h-5 border-2 border-emerald-600 border-t-transparent rounded-full animate-spin"></div>
                        <span className="text-sm text-gray-600">Loading airport deliveries...</span>
                      </div>
                    </td>
                  </tr>
                ) : orders.length === 0 ? (
                  <tr>
                    <td colSpan="10" className="px-6 py-12 text-center text-sm text-gray-600">
                      No airport delivery assignments found for this driver.
                    </td>
                  </tr>
                ) : (
                  orders.map((order, index) => (
                    <tr key={index} className={`border-b border-[#D0E0DB] hover:bg-[#F0F4F3] transition-colors ${index % 2 === 0 ? 'bg-white' : 'bg-[#F0F4F3]/30'}`}>
                      <td className="px-6 py-4">
                        <div className="font-semibold text-[#0D5C4D] text-sm">{order.orderId}</div>
                        <div className="text-xs text-[#6B8782]">{order.type}</div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="font-medium text-[#0D5C4D] text-sm">{order.product || 'N/A'}</div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="font-semibold text-[#0D5C4D] text-sm">
                          {order.grossWeight || order.assignmentData?.grossWeight || 'N/A'}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="font-medium text-[#0D5C4D] text-sm">
                          {order.labour || order.assignmentData?.labour || 'N/A'}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="font-semibold text-[#0D5C4D] text-sm">
                          {order.totalBoxes || 0}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="font-medium text-[#0D5C4D] text-sm">
                          {order.ct || order.assignmentData?.ct || 'N/A'}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="font-semibold text-[#0D5C4D] text-sm">
                          {order.noOfPkgs || order.assignmentData?.noOfPkgs || 0}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="font-medium text-[#0D5C4D] text-sm">{order.airport.name}</div>
                        <div className="text-xs text-[#6B8782]">{order.airport.terminal}</div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="font-medium text-[#0D5C4D] text-sm">
                          {order.vehicleNumber || 'N/A'}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`px-3 py-1.5 rounded-full text-xs font-medium ${getStatusColor(order.status)}`}>
                          {order.status}
                        </span>
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
              Showing {orders.length} airport delivery orders for today
            </div>
            <div className="text-sm font-semibold text-[#0D5C4D]">
              Total Cargo: <span className="text-[#0D7C66]">{totalWeight.toLocaleString()} kg</span>
            </div>
          </div>
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

      {/* Expenses Modal */}
      {showExpensesModal && (
        <div className="fixed inset-0 flex items-center justify-center z-50" style={{ backgroundColor: 'rgba(0, 0, 0, 0.5)' }}>
          <div className="bg-white rounded-lg p-6 w-96">
            <h3 className="text-lg font-bold text-gray-900 mb-4">Add Expenses</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm text-gray-700 mb-2">Fuel Type</label>
                <select
                  value={expenseData.fuelType}
                  onChange={(e) => setExpenseData({ ...expenseData, fuelType: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
                >
                  <option value="Diesel">Diesel</option>
                  <option value="Petrol">Petrol</option>
                </select>
              </div>
              <div>
                <label className="block text-sm text-gray-700 mb-2">Petrol Bunk Name</label>
                <select
                  value={expenseData.petrolBunkName}
                  onChange={(e) => setExpenseData({ ...expenseData, petrolBunkName: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
                >
                  <option value="Bharat Petroleum">Bharat Petroleum</option>
                  <option value="Indian Oil Petroleum">Indian Oil Petroleum</option>
                </select>
              </div>
              <div>
                <label className="block text-sm text-gray-700 mb-2">Unit Price</label>
                <input
                  type="number"
                  value={expenseData.unitPrice}
                  onChange={(e) => setExpenseData({ ...expenseData, unitPrice: e.target.value })}
                  placeholder="Enter unit price"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-700 mb-2">Litre</label>
                <input
                  type="number"
                  value={expenseData.litre}
                  onChange={(e) => setExpenseData({ ...expenseData, litre: e.target.value })}
                  placeholder="Enter litres"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-700 mb-2">Total Amount</label>
                <input
                  type="text"
                  value={calculateTotal()}
                  readOnly
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg bg-gray-50 text-gray-700"
                />
              </div>
            </div>
            <div className="flex gap-3 justify-end mt-6">
              <button
                onClick={() => {
                  setShowExpensesModal(false);
                  setExpenseData({ fuelType: 'Petrol', petrolBunkName: 'Indian Oil Petroleum', unitPrice: '', litre: '' });
                  setSelectedOrder(null);
                }}
                className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleExpensesSubmit}
                disabled={!expenseData.petrolBunkName || !expenseData.unitPrice || !expenseData.litre}
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

export default DriverAirportDeliveryPage;