import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { createExcessKM } from '../../../api/excessKmApi';
import { getDriverById, getAllDrivers } from '../../../api/driverApi';
import toast from 'react-hot-toast';

const AddExcessKM = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const [driver, setDriver] = useState(null);
  const [vehicles, setVehicles] = useState([]);
  const [loading, setLoading] = useState(false);
  const [kmData, setKmData] = useState({
    date: new Date().toISOString().split('T')[0],
    driver_id: id,
    vehicle_number: '',
    start_km: '',
    end_km: '',
    amount: ''
  });

  useEffect(() => {
    if (id) {
      fetchDriver();
      fetchVehicles();
    }
  }, [id]);

  const fetchDriver = async () => {
    try {
      const response = await getDriverById(id);
      const driverData = response.data;
      setDriver(driverData);
      setKmData(prev => ({
        ...prev,
        driver_id: driverData.did,
        vehicle_number: driverData.vehicle_number || ''
      }));
    } catch (error) {
      console.error('Error fetching driver:', error);
      toast.error('Failed to fetch driver details');
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

  const calculateKilometers = () => {
    const start = parseFloat(kmData.start_km) || 0;
    const end = parseFloat(kmData.end_km) || 0;
    if (end > start) {
      return (end - start).toFixed(2);
    }
    return '0.00';
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    let nextValue = value;
    if (name === 'start_km' || name === 'end_km') {
      if (value === '') {
        nextValue = '';
      } else {
        const n = parseFloat(value);
        nextValue = Number.isNaN(n) ? '' : String(Math.max(n, 0));
      }
    }
    setKmData(prev => ({
      ...prev,
      [name]: nextValue
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!kmData.date || !kmData.driver_id || !kmData.vehicle_number || !kmData.start_km || !kmData.end_km) {
      toast.error('Please fill in all required fields');
      return;
    }

    const startKm = parseFloat(kmData.start_km);
    const endKm = parseFloat(kmData.end_km);
    if (startKm < 0 || endKm < 0) {
      toast.error('Start KM and End KM cannot be negative');
      return;
    }

    if (endKm <= startKm) {
      toast.error('End KM must be greater than Start KM');
      return;
    }

    try {
      setLoading(true);
      const kilometers = calculateKilometers();
      const submitData = {
        date: kmData.date,
        driver_id: parseInt(kmData.driver_id),
        vehicle_number: kmData.vehicle_number,
        start_km: startKm,
        end_km: endKm,
        kilometers: parseFloat(kilometers),
        amount: parseFloat(kmData.amount) || 0
      };

      await createExcessKM(submitData);
      toast.success('Start / End KM record created successfully');
      navigate('/start-end-km-management', { state: { driverId: kmData.driver_id } });
    } catch (error) {
      console.error('Error creating KM record:', error);
      toast.error(error.message || 'Failed to create Start / End KM record');
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
            onClick={() => navigate('/start-end-km-management', { state: { driverId: id } })}
            className="flex items-center gap-2 text-[#0D5C4D] hover:text-[#0a6354] transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
            <span className="font-medium">Back to Start KM / End KM Management</span>
          </button>
        </div>

        {/* Form */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6 sm:p-8">
          <h1 className="text-2xl font-bold text-gray-900 mb-6">Add Start KM / End KM</h1>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Date <span className="text-red-500">*</span>
              </label>
              <input
                type="date"
                name="date"
                value={kmData.date}
                onChange={handleInputChange}
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
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Vehicle Number <span className="text-red-500">*</span>
              </label>
              <select
                name="vehicle_number"
                value={kmData.vehicle_number}
                onChange={handleInputChange}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                required
              >
                <option value="">Select Vehicle</option>
                {vehicles.map((vehicle, index) => (
                  <option key={index} value={vehicle}>
                    {vehicle}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Start KM <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                min="0"
                name="start_km"
                value={kmData.start_km}
                onChange={handleInputChange}
                placeholder="Enter start kilometer"
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                End KM <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                min="0"
                name="end_km"
                value={kmData.end_km}
                onChange={handleInputChange}
                placeholder="Enter end kilometer"
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Kilometers (KM)</label>
              <input
                type="text"
                value={calculateKilometers()}
                readOnly
                className="w-full px-4 py-3 border border-gray-300 rounded-lg bg-gray-50 text-gray-700"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Amount (₹)</label>
              <input
                type="text"
                name="amount"
                value={kmData.amount}
                onChange={handleInputChange}
                placeholder="Enter amount"
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent"
              />
            </div>

            <div className="flex gap-4 pt-4">
              <button
                type="button"
                onClick={() => navigate('/start-end-km-management', { state: { driverId: id } })}
                className="flex-1 px-6 py-3 border border-gray-300 rounded-lg text-gray-700 font-medium hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading || !kmData.date || !kmData.vehicle_number || !kmData.start_km || !kmData.end_km}
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

export default AddExcessKM;
