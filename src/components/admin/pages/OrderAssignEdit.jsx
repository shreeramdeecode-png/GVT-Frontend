import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ChevronDown, Edit2, X, MapPin, Truck } from 'lucide-react';
import { getOrderAssignment, updateOrderAssignment } from '../../../api/orderAssignmentApi';
import { getOrderById } from '../../../api/orderApi';
import { getAllFarmers } from '../../../api/farmerApi';
import { getAllSuppliers } from '../../../api/supplierApi';
import { getAllThirdParties } from '../../../api/thirdPartyApi';
import { getAllLabours } from '../../../api/labourApi';
import { getAllDrivers } from '../../../api/driverApi';
import { sortDropdownObjects } from '../../../utils/dropdownSort';

const OrderAssignEdit = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const [loading, setLoading] = useState(true);
  const [orderDetails, setOrderDetails] = useState(null);
  const [selectedType, setSelectedType] = useState('Box');
  
  // Stage 1 states
  const [productRows, setProductRows] = useState([]);
  const [deliveryRoutes, setDeliveryRoutes] = useState([]);
  const [assignmentOptions, setAssignmentOptions] = useState({
    farmers: [],
    suppliers: [],
    thirdParties: [],
    labours: [],
    drivers: []
  });

  // Stage 2 states
  const [packagingStatus, setPackagingStatus] = useState('Quality Check Completed');
  const [netWeight, setNetWeight] = useState('');
  const [grossWeight, setGrossWeight] = useState('');
  const [packageCount, setPackageCount] = useState('');
  const [selectedLabour, setSelectedLabour] = useState('');
  const [specialInstructions, setSpecialInstructions] = useState('');

  // Stage 3 states
  const [selectedDriver, setSelectedDriver] = useState('');

  useEffect(() => {
    loadAllData();
  }, [id]);

  const loadAllData = async () => {
    try {
      setLoading(true);
      
      // Load order details
      const orderResponse = await getOrderById(id);
      setOrderDetails(orderResponse.data);

      // Load dropdown options
      const [farmersRes, suppliersRes, thirdPartiesRes, laboursRes, driversRes] = await Promise.all([
        getAllFarmers(),
        getAllSuppliers(),
        getAllThirdParties(),
        getAllLabours(),
        getAllDrivers()
      ]);

      setAssignmentOptions({
        farmers: farmersRes.data || [],
        suppliers: suppliersRes.data || [],
        thirdParties: thirdPartiesRes.data || [],
        labours: laboursRes.data || [],
        drivers: driversRes.data || []
      });

      // Load existing assignment data
      const assignmentResponse = await getOrderAssignment(id);
      const assignmentData = assignmentResponse.data;

      // Populate Stage 1 data
      if (assignmentData.collection_type) {
        setSelectedType(assignmentData.collection_type);
      }

      if (assignmentData.order?.items) {
        const rows = assignmentData.order.items.map((item) => ({
          id: item.oiid,
          product: item.product_name?.replace(/^\d+\s*-\s*/, '') || '',
          product_name: item.product_name || '',
          quantity: `${item.net_weight || 0} kg`,
          net_weight: parseFloat(item.net_weight) || 0,
          assignedTo: '',
          entityType: '',
          assignedQty: 0,
          tapeType: '',
          status: 'Unassigned',
          statusColor: 'bg-red-100 text-red-700',
          canEdit: true,
        }));

        // Populate with existing assignments
        if (assignmentData.item_assignments) {
          Object.entries(assignmentData.item_assignments).forEach(([oiid, assignments]) => {
            const assignmentArray = Array.isArray(assignments) ? assignments : [assignments];
            const rowIndex = rows.findIndex(row => row.id == oiid);
            
            if (rowIndex !== -1 && assignmentArray.length > 0) {
              const firstAssignment = assignmentArray[0];
              rows[rowIndex].entityType = firstAssignment.entityType || '';
              rows[rowIndex].assignedQty = assignmentArray.reduce((sum, a) => sum + parseFloat(a.quantity || 0), 0);
              rows[rowIndex].tapeType = firstAssignment.tapeType || '';
              rows[rowIndex].status = 'Assigned';
              rows[rowIndex].statusColor = 'bg-emerald-100 text-emerald-700';

              // Find entity name
              if (firstAssignment.entityType === 'farmer') {
                const farmer = assignmentOptions.farmers.find(f => f.fid == firstAssignment.entityId);
                rows[rowIndex].assignedTo = farmer?.farmer_name || '';
              } else if (firstAssignment.entityType === 'supplier') {
                const supplier = assignmentOptions.suppliers.find(s => s.sid == firstAssignment.entityId);
                rows[rowIndex].assignedTo = supplier?.supplier_name || '';
              } else if (firstAssignment.entityType === 'thirdParty') {
                const thirdParty = assignmentOptions.thirdParties.find(tp => tp.tpid == firstAssignment.entityId);
                rows[rowIndex].assignedTo = thirdParty?.third_party_name || '';
              }
            }
          });
        }

        setProductRows(rows);
      }

      if (assignmentData.delivery_routes && Array.isArray(assignmentData.delivery_routes)) {
        setDeliveryRoutes(assignmentData.delivery_routes);
      }

      // Populate Stage 2 data
      setPackagingStatus(assignmentData.packaging_status || 'Quality Check Completed');
      setNetWeight(assignmentData.net_weight || '');
      setGrossWeight(assignmentData.gross_weight || '');
      setPackageCount(assignmentData.package_count || '');
      setSelectedLabour(assignmentData.labour_id || '');
      setSpecialInstructions(assignmentData.special_instructions || '');

      // Populate Stage 3 data
      setSelectedDriver(assignmentData.driver_id || '');

    } catch (error) {
      console.error('Error loading data:', error);
      alert('Failed to load assignment data');
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateAssignment = async () => {
    try {
      const updateData = {
        collectionType: selectedType,
        productAssignments: productRows,
        deliveryRoutes: deliveryRoutes,
        packagingStatus,
        netWeight,
        grossWeight,
        packageCount,
        labourId: selectedLabour,
        specialInstructions,
        driverId: selectedDriver
      };

      await updateOrderAssignment(id, updateData);
      alert('Assignment updated successfully!');
      navigate('/order-assign');
    } catch (error) {
      console.error('Error updating assignment:', error);
      alert('Failed to update assignment. Please try again.');
    }
  };

  const selectedDriverInfo = assignmentOptions.drivers.find(d => d.did === parseInt(selectedDriver));

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 p-4 sm:p-6 lg:p-8 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading assignment data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4 sm:p-6 lg:p-8">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Edit Order Assignment</h1>
        <p className="text-sm text-gray-600 mt-1">Update all stages of order assignment</p>
      </div>

      {/* Order Information Card */}
      <div className="bg-white rounded-xl shadow-sm p-6 mb-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Order Information</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div>
            <p className="text-xs text-gray-500 mb-1">Order ID</p>
            <p className="text-sm font-semibold text-gray-900">{orderDetails?.oid || id}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500 mb-1">Customer Name</p>
            <p className="text-sm font-medium text-gray-900">{orderDetails?.customer_name || 'N/A'}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500 mb-1">Total Products</p>
            <p className="text-sm font-medium text-gray-900">{orderDetails?.items?.length || 0} Items</p>
          </div>
          <div>
            <p className="text-xs text-gray-500 mb-1">Status</p>
            <span className={`inline-block px-3 py-1 rounded-full text-xs font-medium ${
              orderDetails?.order_status === 'pending' ? 'bg-purple-100 text-purple-700' :
              orderDetails?.order_status === 'processing' ? 'bg-yellow-100 text-yellow-700' :
              orderDetails?.order_status === 'delivered' ? 'bg-emerald-600 text-white' :
              'bg-gray-100 text-gray-700'
            }`}>
              {orderDetails?.order_status ? orderDetails.order_status.charAt(0).toUpperCase() + orderDetails.order_status.slice(1) : 'N/A'}
            </span>
          </div>
        </div>
      </div>

      {/* Stage 1: Product Collection */}
      <div className="bg-white rounded-xl shadow-sm p-6 mb-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-8 h-8 bg-emerald-600 text-white rounded-full flex items-center justify-center font-semibold">1</div>
          <h2 className="text-lg font-semibold text-gray-900">Product Collection from Sources</h2>
          <div className="relative ml-auto">
            <select
              value={selectedType}
              onChange={(e) => setSelectedType(e.target.value)}
              className="appearance-none px-4 py-2 pr-10 bg-white border-2 border-emerald-600 text-emerald-700 rounded-lg font-medium cursor-pointer hover:bg-emerald-50 transition-colors outline-none"
            >
              <option value="Bag">Bag</option>
              <option value="Box">Box</option>
            </select>
            <ChevronDown className="absolute right-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-emerald-700 pointer-events-none" />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Product</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Quantity</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Assigned To</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Assigned Qty</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Tape Type</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {productRows.map((row, index) => (
                <tr key={row.id} className="hover:bg-gray-50">
                  <td className="px-4 py-4">
                    <span className="text-sm font-medium text-gray-900">{row.product_name?.replace(/^\d+\s*-\s*/, '')}</span>
                  </td>
                  <td className="px-4 py-4">
                    <span className="text-sm text-gray-900">{row.quantity}</span>
                  </td>
                  <td className="px-4 py-4">
                    <div className="space-y-2">
                      <select
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                        value={row.entityType || ''}
                        onChange={(e) => {
                          const updatedRows = [...productRows];
                          updatedRows[index].entityType = e.target.value;
                          updatedRows[index].assignedTo = '';
                          setProductRows(updatedRows);
                        }}
                      >
                        <option value="">Select type...</option>
                        <option value="farmer">Farmer</option>
                        <option value="supplier">Supplier</option>
                        <option value="thirdParty">Third Party</option>
                      </select>
                      {row.entityType && (
                        <select
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                          value={row.assignedTo}
                          onChange={(e) => {
                            const updatedRows = [...productRows];
                            updatedRows[index].assignedTo = e.target.value;
                            setProductRows(updatedRows);
                          }}
                        >
                          <option value="">Select {row.entityType}...</option>
                          {row.entityType === 'farmer' && sortDropdownObjects(assignmentOptions.farmers, (f) => f.farmer_name).map(f => (
                            <option key={f.fid} value={f.farmer_name}>{f.farmer_name}</option>
                          ))}
                          {row.entityType === 'supplier' && sortDropdownObjects(assignmentOptions.suppliers, (s) => s.supplier_name).map(s => (
                            <option key={s.sid} value={s.supplier_name}>{s.supplier_name}</option>
                          ))}
                          {row.entityType === 'thirdParty' && sortDropdownObjects(assignmentOptions.thirdParties, (tp) => tp.third_party_name).map(tp => (
                            <option key={tp.tpid} value={tp.third_party_name}>{tp.third_party_name}</option>
                          ))}
                        </select>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-4">
                    <input
                      type="number"
                      value={row.assignedQty || ''}
                      onChange={(e) => {
                        const updatedRows = [...productRows];
                        updatedRows[index].assignedQty = e.target.value;
                        setProductRows(updatedRows);
                      }}
                      className="w-20 px-3 py-2 border border-gray-300 rounded-lg text-sm"
                    />
                  </td>
                  <td className="px-4 py-4">
                    <input
                      type="text"
                      value={row.tapeType}
                      onChange={(e) => {
                        const updatedRows = [...productRows];
                        updatedRows[index].tapeType = e.target.value;
                        setProductRows(updatedRows);
                      }}
                      className="w-32 px-3 py-2 border border-gray-300 rounded-lg text-sm"
                    />
                  </td>
                  <td className="px-4 py-4">
                    <span className={`px-3 py-1.5 rounded-full text-xs font-medium ${row.statusColor}`}>
                      {row.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Stage 2: Packaging */}
      <div className="bg-white rounded-xl shadow-sm p-6 mb-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-8 h-8 bg-emerald-600 text-white rounded-full flex items-center justify-center font-semibold">2</div>
          <h2 className="text-lg font-semibold text-gray-900">Packaging & Quality Check</h2>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-4">
          <div>
            <label className="text-sm font-medium text-gray-700 mb-2 block">Packaging Status</label>
            <select
              value={packagingStatus}
              onChange={(e) => setPackagingStatus(e.target.value)}
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm"
            >
              <option>In Progress</option>
              <option>Pending</option>
              <option>Quality Check Completed</option>
            </select>
          </div>
          <div>
            <label className="text-sm font-medium text-gray-700 mb-2 block">Labour Name</label>
            <select
              value={selectedLabour}
              onChange={(e) => setSelectedLabour(e.target.value)}
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm"
            >
              <option value="">Select Labour</option>
              {sortDropdownObjects(assignmentOptions.labours, (labour) => labour.full_name).map(labour => (
                <option key={labour.lid} value={labour.lid}>{labour.full_name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-sm font-medium text-gray-700 mb-2 block">Net Weight</label>
            <input
              type="text"
              value={netWeight}
              onChange={(e) => setNetWeight(e.target.value)}
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm"
            />
          </div>
          <div>
            <label className="text-sm font-medium text-gray-700 mb-2 block">Gross Weight</label>
            <input
              type="text"
              value={grossWeight}
              onChange={(e) => setGrossWeight(e.target.value)}
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm"
            />
          </div>
          <div>
            <label className="text-sm font-medium text-gray-700 mb-2 block">Package Count</label>
            <input
              type="text"
              value={packageCount}
              onChange={(e) => setPackageCount(e.target.value)}
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm"
            />
          </div>
        </div>

        <div>
          <label className="text-sm font-medium text-gray-700 mb-2 block">Special Instructions</label>
          <textarea
            rows="3"
            value={specialInstructions}
            onChange={(e) => setSpecialInstructions(e.target.value)}
            className="w-full px-4 py-3 border border-gray-300 rounded-lg text-sm"
          />
        </div>
      </div>

      {/* Stage 3: Driver Assignment */}
      <div className="bg-white rounded-xl shadow-sm p-6 mb-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-8 h-8 bg-emerald-600 text-white rounded-full flex items-center justify-center font-semibold">3</div>
          <h2 className="text-lg font-semibold text-gray-900">Driver Assignment for Airport Delivery</h2>
        </div>

        <div className="mb-6">
          <label className="text-sm font-medium text-gray-700 mb-2 block">Select Driver</label>
          <select
            value={selectedDriver}
            onChange={(e) => setSelectedDriver(e.target.value)}
            className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm"
          >
            <option value="">Select a driver</option>
            {sortDropdownObjects(assignmentOptions.drivers, (driver) => driver.driver_name).map(driver => (
              <option key={driver.did} value={driver.did}>
                {driver.driver_name} - {driver.driver_id}
              </option>
            ))}
          </select>
        </div>

        {selectedDriverInfo && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
            <div className="flex items-center gap-3 mb-4">
              <Truck className="w-6 h-6 text-blue-600" />
              <h3 className="text-base font-semibold text-gray-900">Driver & Vehicle Information</h3>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <p className="text-xs text-gray-600 mb-1">Driver Name</p>
                <p className="text-sm font-medium text-gray-900">{selectedDriverInfo.driver_name}</p>
              </div>
              <div>
                <p className="text-xs text-gray-600 mb-1">Phone Number</p>
                <p className="text-sm font-medium text-gray-900">{selectedDriverInfo.phone_number || 'N/A'}</p>
              </div>
              <div>
                <p className="text-xs text-gray-600 mb-1">Vehicle Number</p>
                <p className="text-sm font-medium text-gray-900">{selectedDriverInfo.vehicle_number || 'N/A'}</p>
              </div>
              <div>
                <p className="text-xs text-gray-600 mb-1">Vehicle Type</p>
                <p className="text-sm font-medium text-gray-900">{selectedDriverInfo.available_vehicle || 'N/A'}</p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Action Buttons */}
      <div className="flex flex-col sm:flex-row justify-end gap-3">
        <button
          onClick={() => navigate('/order-assign')}
          className="px-6 py-3 border-2 border-gray-300 text-gray-700 rounded-lg font-medium hover:bg-gray-50 transition-colors"
        >
          Cancel
        </button>
        <button
          onClick={handleUpdateAssignment}
          className="px-6 py-3 bg-emerald-600 text-white rounded-lg font-medium shadow-sm hover:bg-emerald-700 transition-colors"
        >
          Update Assignment
        </button>
      </div>
    </div>
  );
};

export default OrderAssignEdit;
