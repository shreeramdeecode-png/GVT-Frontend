import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { createFuelExpense } from '../../../api/fuelExpenseApi';
import { getDriverById, getAllDrivers } from '../../../api/driverApi';
import { petrolBulkApi } from '../../../api/petrolBulkApi';
import { sortDropdownObjects, sortDropdownStrings } from '../../../utils/dropdownSort';

const AddFuelExpenses = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const [driver, setDriver] = useState(null);
  const [vehicles, setVehicles] = useState([]);
  const [petrolBunks, setPetrolBunks] = useState([]);
  const [loading, setLoading] = useState(false);
  const [expenseData, setExpenseData] = useState({
    date: new Date().toISOString().split('T')[0],
    driver_id: id,
    vehicle_number: '',
    fuel_type: 'Petrol',
    petrol_bunk_name: '',
    unit_price: '',
    litre: ''
  });

  useEffect(() => {
    if (id) {
      fetchDriver();
      fetchVehicles();
      fetchPetrolBunks();
    }
  }, [id]);

  const fetchDriver = async () => {
    try {
      const response = await getDriverById(id);
      const driverData = response.data;
      setDriver(driverData);
      setExpenseData(prev => ({
        ...prev,
        driver_id: driverData.did,
        vehicle_number: driverData.vehicle_number
      }));
    } catch (error) {
      console.error('Error fetching driver:', error);
    }
  };

  const fetchVehicles = async () => {
    try {
      const response = await getAllDrivers();
      const vehicleNumbers = response.data.map(d => d.vehicle_number).filter(Boolean);
      setVehicles([...new Set(vehicleNumbers)]);
    } catch (error) {
      console.error('Error fetching vehicles:', error);
    }
  };

  const fetchPetrolBunks = async () => {
    try {
      const response = await petrolBulkApi.getAll(1, 100); // Get all petrol bunks
      if (response.data && response.data.data) {
        setPetrolBunks(response.data.data);
      }
    } catch (error) {
      console.error('Error fetching petrol bunks:', error);
    }
  };

  const calculateTotal = () => {
    const total = (parseFloat(expenseData.unit_price) || 0) * (parseFloat(expenseData.litre) || 0);
    return total.toFixed(2);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!expenseData.date || !expenseData.driver_id || !expenseData.petrol_bunk_name || !expenseData.unit_price || !expenseData.litre) return;

    try {
      setLoading(true);
      await createFuelExpense(expenseData);
      navigate('/fuel-expense-management', { state: { driverId: expenseData.driver_id } });
    } catch (error) {
      console.error('Error creating fuel expense:', error);
      alert('Failed to create fuel expense');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-emerald-50 p-4 sm:p-6 lg:p-8">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="flex items-center gap-4 mb-6">
          <button
            onClick={() => navigate(`/fuel-expense-management`)}
            className="flex items-center gap-2 text-[#0D5C4D] hover:text-[#0a6354] transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
            <span className="font-medium">Back to Fuel Expeneses</span>
          </button>
        </div>

        {/* Form */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6 sm:p-8">
          <h1 className="text-2xl font-bold text-gray-900 mb-6">Add Fuel Expenses</h1>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Date</label>
              <input
                type="date"
                value={expenseData.date}
                onChange={(e) => setExpenseData({ ...expenseData, date: e.target.value })}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Driver Name</label>
              <input
                type="text"
                value={driver?.driver_name || ''}
                readOnly
                className="w-full px-4 py-3 border border-gray-300 rounded-lg bg-gray-50 text-gray-700"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Vehicle Number</label>
              <select
                value={expenseData.vehicle_number}
                onChange={(e) => setExpenseData({ ...expenseData, vehicle_number: e.target.value })}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                required
              >
                <option value="">Select Vehicle</option>
                {sortDropdownStrings(vehicles).map((vehicle, index) => (
                  <option key={index} value={vehicle}>
                    {vehicle}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Fuel Type</label>
              <select
                value={expenseData.fuel_type}
                onChange={(e) => setExpenseData({ ...expenseData, fuel_type: e.target.value })}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent"
              >
                <option value="Diesel">Diesel</option>
                <option value="Petrol">Petrol</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Petrol Bunk Name</label>
              <select
                value={expenseData.petrol_bunk_name}
                onChange={(e) => setExpenseData({ ...expenseData, petrol_bunk_name: e.target.value })}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                required
              >
                <option value="">Select Petrol Bunk</option>
                {sortDropdownObjects(petrolBunks, (bunk) => bunk.name).map((bunk) => (
                  <option key={bunk.pbid || bunk.id} value={bunk.name}>
                    {bunk.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Unit Price (₹)</label>
              <input
                type="number"
                step="0.01"
                value={expenseData.unit_price}
                onChange={(e) => setExpenseData({ ...expenseData, unit_price: e.target.value })}
                placeholder="Enter unit price"
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Litre</label>
              <input
                type="number"
                step="0.01"
                value={expenseData.litre}
                onChange={(e) => setExpenseData({ ...expenseData, litre: e.target.value })}
                placeholder="Enter litres"
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Total Amount (₹)</label>
              <input
                type="text"
                value={calculateTotal()}
                readOnly
                className="w-full px-4 py-3 border border-gray-300 rounded-lg bg-gray-50 text-gray-700"
              />
            </div>

            <div className="flex gap-4 pt-4">
              <button
                type="button"
                onClick={() => navigate(`/drivers/${id}`)}
                className="flex-1 px-6 py-3 border border-gray-300 rounded-lg text-gray-700 font-medium hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading || !expenseData.date || !expenseData.vehicle_number || !expenseData.petrol_bunk_name || !expenseData.unit_price || !expenseData.litre}
                className="flex-1 px-6 py-3 bg-teal-600 text-white rounded-lg font-medium hover:bg-teal-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {loading ? 'Submitting...' : 'Submit'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default AddFuelExpenses;