import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { getFuelExpenseById, updateFuelExpense } from '../../../api/fuelExpenseApi';
import { getAllDrivers, getDriverById } from '../../../api/driverApi';
import { sortDropdownStrings } from '../../../utils/dropdownSort';

const EditFuelExpense = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const [driver, setDriver] = useState(null);
  const [vehicles, setVehicles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    date: '',
    driver_id: '',
    vehicle_number: '',
    fuel_type: 'Diesel',
    petrol_bunk_name: '',
    unit_price: '',
    litre: ''
  });

  useEffect(() => {
    fetchFuelExpense();
    fetchVehicles();
  }, [id]);

  const fetchVehicles = async () => {
    try {
      const response = await getAllDrivers();
      const vehicleNumbers = response.data.map(d => d.vehicle_number).filter(Boolean);
      setVehicles([...new Set(vehicleNumbers)]);
    } catch (error) {
      console.error('Error fetching vehicles:', error);
    }
  };

  const fetchFuelExpense = async () => {
    try {
      setLoading(true);
      const response = await getFuelExpenseById(id);
      const expense = response.data;
      setFormData({
        date: expense.date,
        driver_id: expense.driver_id,
        vehicle_number: expense.vehicle_number || '',
        fuel_type: expense.fuel_type,
        petrol_bunk_name: expense.petrol_bunk_name,
        unit_price: expense.unit_price,
        litre: expense.litre
      });
      if (expense.driver_id) {
        const driverResponse = await getDriverById(expense.driver_id);
        setDriver(driverResponse.data);
      }
    } catch (error) {
      console.error('Error fetching fuel expense:', error);
      alert('Failed to load fuel expense');
    } finally {
      setLoading(false);
    }
  };

  const calculateTotal = () => {
    return (parseFloat(formData.unit_price) || 0) * (parseFloat(formData.litre) || 0);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      setSubmitting(true);
      await updateFuelExpense(id, formData);
      navigate('/fuel-expense-management');
    } catch (error) {
      console.error('Error updating fuel expense:', error);
      alert('Failed to update fuel expense');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-emerald-50 p-4 sm:p-6 lg:p-8">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center gap-4 mb-6">
          <button
            onClick={() => navigate('/fuel-expense-management')}
            className="flex items-center gap-2 text-[#0D5C4D] hover:text-[#0a6354] transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
            <span className="font-medium">Back to Fuel Expenses</span>
          </button>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6 sm:p-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">Edit Fuel Expense</h2>
          
          {loading ? (
            <div className="text-center py-8">Loading...</div>
          ) : (
            <form onSubmit={handleSubmit}>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Date</label>
                  <input
                    type="date"
                    value={formData.date}
                    onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Driver Name</label>
                  <input
                    type="text"
                    value={driver?.driver_name || ''}
                    readOnly
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg bg-gray-50 text-gray-700"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Vehicle Number</label>
                  <select
                    value={formData.vehicle_number}
                    onChange={(e) => setFormData({ ...formData, vehicle_number: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
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
                    value={formData.fuel_type}
                    onChange={(e) => setFormData({ ...formData, fuel_type: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
                  >
                    <option value="Diesel">Diesel</option>
                    <option value="Petrol">Petrol</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Petrol Bunk Name</label>
                  <input
                    type="text"
                    value={formData.petrol_bunk_name}
                    onChange={(e) => setFormData({ ...formData, petrol_bunk_name: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Unit Price (₹)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={formData.unit_price}
                    onChange={(e) => setFormData({ ...formData, unit_price: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Litre</label>
                  <input
                    type="number"
                    step="0.01"
                    value={formData.litre}
                    onChange={(e) => setFormData({ ...formData, litre: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Total Amount (₹)</label>
                  <input
                    type="text"
                    value={calculateTotal().toFixed(2)}
                    readOnly
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg bg-gray-50 text-gray-700"
                  />
                </div>
              </div>

              <div className="flex gap-3 justify-end mt-6">
                <button
                  type="button"
                  onClick={() => navigate('/fuel-expense-management')}
                  className="px-6 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-6 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 disabled:opacity-50"
                >
                  {submitting ? 'Updating...' : 'Update'}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};

export default EditFuelExpense;