import React, { useState } from 'react';
import { useNavigate, useLocation, useParams } from 'react-router-dom';
import { ArrowLeft, Calendar, ChevronDown, AlertCircle, User } from 'lucide-react';

const StockReassignmentForm = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { id } = useParams();
  const stockData = location.state?.stockData;
  
  const [sourceType, setSourceType] = useState('Farmer');
  const [selectedFarmer, setSelectedFarmer] = useState('');
  const [quantity, setQuantity] = useState(stockData?.quantity?.replace(' kg', '') || '');
  const [pickupDate, setPickupDate] = useState('');
  const [distance, setDistance] = useState('');
  const [selectedDriver, setSelectedDriver] = useState('');
  const [tapeType, setTapeType] = useState('SINGLE FARMER');
  const [labourAssignment, setLabourAssignment] = useState('');
  const [additionalLabour, setAdditionalLabour] = useState('');
  const [notes, setNotes] = useState('');

  const originalStockData = stockData ? {
    product: stockData.product,
    availableQuantity: stockData.quantity,
    sourceOrder: stockData.orderId,
    sourceOrderName: 'N/A',
    orderType: stockData.orderType,
    stockDuration: stockData.daysInStock,
    neededByDate: stockData.dateAdded,
    urgency: stockData.status === 'Critical' ? 'Critical - Immediate action required!' : 
             stockData.status === 'Aging' ? 'Aging - Reassign soon!' : 
             'Pending reassignment',
    status: stockData.status.toUpperCase(),
    statusLabel: stockData.status
  } : null;

  const remainingQuantity = parseInt(stockData?.quantity?.replace(' kg', '') || 0) - parseInt(quantity || 0);

  const handleSubmit = (e) => {
    e.preventDefault();
    //console.log('Form submitted');
  };

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-6 lg:p-8">

      {/* Original Stock Information */}
      {originalStockData && (
        <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Original Stock Information</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
            {/* Product */}
            <div>
              <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Product</p>
              <p className="text-sm font-semibold text-gray-900">{originalStockData.product}</p>
              <p className="text-xs text-gray-600 mt-0.5">Available Quantity: {originalStockData.availableQuantity}</p>
            </div>

            {/* Source Order */}
            <div>
              <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Source Order</p>
              <p className="text-sm font-semibold text-blue-600 cursor-pointer hover:text-blue-800">
                {originalStockData.sourceOrder}
              </p>
              <p className="text-xs text-gray-600 mt-0.5">{originalStockData.sourceOrderName}</p>
            </div>

            {/* Order Type */}
            <div>
              <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Order Type</p>
              <span className="inline-block px-3 py-1 text-xs font-medium bg-emerald-100 text-emerald-700 rounded-md">
                {originalStockData.orderType}
              </span>
              <p className="text-xs text-blue-600 mt-0.5">In Stock: {originalStockData.stockDuration}</p>
            </div>

            {/* Needed By Date */}
            <div>
              <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Date Added</p>
              <p className="text-sm font-semibold text-gray-900">{originalStockData.neededByDate}</p>
              <p className="text-xs text-amber-600 mt-0.5 flex items-start gap-1">
                <AlertCircle className="w-3 h-3 mt-0.5 flex-shrink-0" />
                <span>{originalStockData.urgency}</span>
              </p>
            </div>

            {/* Status */}
            <div>
              <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Status</p>
              <span className="inline-block px-3 py-1 text-xs font-medium bg-pink-100 text-pink-700 rounded-md">
                {originalStockData.status}
              </span>
              <p className="text-xs text-gray-600 mt-0.5">{originalStockData.statusLabel}</p>
            </div>
          </div>
        </div>
      )}

      {/* Reassignment Form */}
      <form onSubmit={handleSubmit} className="bg-white rounded-lg shadow-sm p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-2">Reassignment Details</h2>
        <p className="text-sm text-gray-500 mb-6">Assign this stock item to a farmer, supplier, or third-party vendor</p>

        {/* Source Type Selection */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-900 mb-3">Source Type</label>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <button
              type="button"
              onClick={() => setSourceType('Farmer')}
              className={`px-6 py-3 rounded-md font-medium transition-colors ${
                sourceType === 'Farmer'
                  ? 'bg-emerald-600 text-white'
                  : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
              }`}
            >
              Farmer
            </button>
            <button
              type="button"
              onClick={() => setSourceType('Supplier')}
              className={`px-6 py-3 rounded-md font-medium transition-colors ${
                sourceType === 'Supplier'
                  ? 'bg-emerald-600 text-white'
                  : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
              }`}
            >
              Supplier
            </button>
            <button
              type="button"
              onClick={() => setSourceType('Third Party')}
              className={`px-6 py-3 rounded-md font-medium transition-colors ${
                sourceType === 'Third Party'
                  ? 'bg-emerald-600 text-white'
                  : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
              }`}
            >
              Third Party
            </button>
          </div>
        </div>

        {/* Farmer Selection and Quantity */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
          {/* Select Farmer */}
          <div className="lg:col-span-2">
            <label className="block text-sm font-medium text-gray-900 mb-2">
              Select Farmer
            </label>
            <div className="relative">
              <select
                value={selectedFarmer}
                onChange={(e) => setSelectedFarmer(e.target.value)}
                className="appearance-none w-full px-4 py-3 pr-10 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent bg-white cursor-pointer"
              >
                <option value="">Select farmer from list...</option>
                <option value="farmer3">Gopal Agriculture - Rural Area</option>
                <option value="farmer2">Krishna Farms - Highway 45</option>
                <option value="farmer1">Raju Farms - Village Road, Dist-40km</option>
              </select>
              <ChevronDown className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5 pointer-events-none" />
            </div>
          </div>

          {/* Quantity and Remaining */}
          <div className="grid grid-cols-2 gap-4">
            {/* Quantity to Assign */}
            <div>
              <label className="block text-sm font-medium text-gray-900 mb-2">
                Quantity to Assign
              </label>
              <div className="relative">
                <input
                  type="number"
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                  className="w-full px-4 py-3 pr-12 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                  min="0"
                  max="20"
                />
                <span className="absolute right-4 top-1/2 transform -translate-y-1/2 text-gray-500 text-sm">
                  kg
                </span>
              </div>
            </div>

            {/* Remaining */}
            <div>
              <label className="block text-sm font-medium text-gray-900 mb-2">
                Remaining
              </label>
              <div className="px-4 py-3 bg-emerald-50 border-2 border-emerald-500 rounded-md">
                <p className="text-lg font-bold text-emerald-700 text-center">
                  {remainingQuantity} kg
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Delivery & Collection Details */}
        <div className="mb-6">
          <h3 className="text-base font-semibold text-gray-900 mb-4">Delivery & Collection Details</h3>
          
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
            {/* Collection/Pickup Point */}
            <div>
              <label className="block text-sm font-medium text-gray-900 mb-2">
                Collection/Pickup Point
              </label>
              <div className="relative">
                <select
                  className="appearance-none w-full px-4 py-3 pr-10 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent bg-white cursor-pointer"
                >
                  <option>Central Collection Point</option>
                  <option>Highway Junction</option>
                  <option>Raju Farms - Village Road, Dist-40km</option>
                </select>
                <ChevronDown className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5 pointer-events-none" />
              </div>
            </div>

            {/* Packaging Destination */}
            <div>
              <label className="block text-sm font-medium text-gray-900 mb-2">
                Packaging Destination
              </label>
              <div className="px-4 py-3 bg-white border-2 border-emerald-500 rounded-md flex items-center gap-2">
                <div className="w-2 h-2 bg-emerald-500 rounded-full"></div>
                <span className="text-sm font-medium text-gray-900">Central Packaging Warehouse</span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Pickup Date */}
            <div>
              <label className="block text-sm font-medium text-gray-900 mb-2">
                Pickup Date
              </label>
              <div className="relative">
                <input
                  type="text"
                  placeholder="dd/mm/yyyy"
                  value={pickupDate}
                  onChange={(e) => setPickupDate(e.target.value)}
                  className="w-full px-4 py-3 pr-10 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                />
                <Calendar className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5 pointer-events-none" />
              </div>
            </div>

            {/* Distance */}
            <div>
              <label className="block text-sm font-medium text-gray-900 mb-2">
                Distance
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={distance}
                  onChange={(e) => setDistance(e.target.value)}
                  className="w-full px-4 py-3 pr-12 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent bg-gray-50"
                  readOnly
                />
                <span className="absolute right-4 top-1/2 transform -translate-y-1/2 text-gray-500 text-sm">
                  km
                </span>
              </div>
            </div>

            {/* Assign Driver */}
            <div>
              <label className="block text-sm font-medium text-gray-900 mb-2">
                Assign Driver
              </label>
              <div className="relative">
                <select
                  value={selectedDriver}
                  onChange={(e) => setSelectedDriver(e.target.value)}
                  className="appearance-none w-full px-4 py-3 pr-10 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent bg-white cursor-pointer"
                >
                  <option value="">Select driver...</option>
                  <option value="driver1">Driver 1 - Available</option>
                  <option value="driver2">Driver 2 - Available</option>
                  <option value="driver3">Driver 3 - Busy</option>
                </select>
                <ChevronDown className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5 pointer-events-none" />
              </div>
            </div>
          </div>
        </div>

        {/* Box Type Settings */}
        <div className="mb-6">
          <h3 className="text-base font-semibold text-gray-900 mb-1">Box Type Settings</h3>
          <p className="text-sm text-gray-500 mb-4">These settings apply only for Box type orders</p>
          
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Tape Type */}
            <div>
              <label className="block text-sm font-medium text-gray-900 mb-2">
                Tape Type
              </label>
              <div className="relative">
                <select
                  value={tapeType}
                  onChange={(e) => setTapeType(e.target.value)}
                  className="appearance-none w-full px-4 py-3 pr-10 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent bg-white cursor-pointer"
                >
                  <option>MIXED SOURCE</option>
                  <option>MULTI FARMER</option>
                  <option>SINGLE FARMER</option>
                </select>
                <ChevronDown className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5 pointer-events-none" />
              </div>
            </div>

            {/* Labour Assignment */}
            <div>
              <label className="block text-sm font-medium text-gray-900 mb-2">
                Labour Assignment
              </label>
              <div className="relative">
                <select
                  value={labourAssignment}
                  onChange={(e) => setLabourAssignment(e.target.value)}
                  className="appearance-none w-full px-4 py-3 pr-10 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent bg-white cursor-pointer"
                >
                  <option>Kumar 👤</option>
                  <option>Mahes 👤</option>
                  <option>Ravi 👤</option>
                </select>
                <ChevronDown className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5 pointer-events-none" />
              </div>
            </div>

            {/* Additional Labour */}
            <div>
              <label className="block text-sm font-medium text-gray-900 mb-2">
                Additional Labour
              </label>
              <input
                type="text"
                placeholder="Type labour name..."
                value={additionalLabour}
                onChange={(e) => setAdditionalLabour(e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
              />
            </div>
          </div>
        </div>

        {/* Notes / Special Instructions */}
        <div className="mb-8">
          <label className="block text-sm font-medium text-gray-900 mb-2">
            Notes / Special Instructions (Optional)
          </label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={4}
            placeholder="Add any special handling instructions, quality requirements, or notes..."
            className="w-full px-4 py-3 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent resize-none"
          />
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row gap-3 justify-between items-center pt-6 border-t border-gray-200">
          <button
            type="button"
            onClick={() => navigate('/stock')}
            className="w-full sm:w-auto px-6 py-3 text-gray-700 hover:text-gray-900 font-medium flex items-center justify-center gap-2 transition-colors order-2 sm:order-1"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Stock
          </button>
          
          <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto order-1 sm:order-2">
            <button
              type="button"
              className="w-full sm:w-auto px-8 py-3 border-2 border-emerald-600 text-emerald-600 rounded-md hover:bg-emerald-50 transition-colors font-medium"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="w-full sm:w-auto px-8 py-3 bg-emerald-600 text-white rounded-md hover:bg-emerald-700 transition-colors font-medium"
            >
              Assign
            </button>
          </div>
        </div>
      </form>
    </div>
  );
};

export default StockReassignmentForm;