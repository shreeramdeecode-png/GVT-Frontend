import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { getExcessKMById, updateExcessKM } from '../../../api/excessKmApi';
import { getDriverById } from '../../../api/driverApi';
import toast from 'react-hot-toast';

const EditExcessKM = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const [driver, setDriver] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [kmData, setKmData] = useState({
    date: '',
    driver_id: '',
    vehicle_number: '',
    start_km: '',
    end_km: '',
    amount: ''
  });

  useEffect(() => {
    if (id) {
      fetchRecord();
    } else {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- run on id change only
  }, [id]);

  const fetchRecord = async () => {
    try {
      setLoading(true);
      const response = await getExcessKMById(id);
      const data = response?.data ?? response;
      if (!data) {
        toast.error('Record not found');
        setLoading(false);
        return;
      }
      const driverId = String(data.driver_id ?? data.driver?.did ?? data.driver?.id ?? '');
      const vehicleNumber =
        data.vehicle_number ??
        data.vehicleNumber ??
        data.driver?.vehicle_number ??
        data.driver?.vehicleNumber ??
        '';
      const vehicleStr = vehicleNumber ? String(vehicleNumber).trim() : '';
      setKmData({
        date: (data.date || '').toString().substring(0, 10),
        driver_id: driverId,
        vehicle_number: vehicleStr,
        start_km: data.start_km ?? data.startKm ?? '',
        end_km: data.end_km ?? data.endKm ?? '',
        amount: data.amount != null ? String(data.amount) : ''
      });
      if (driverId) {
        try {
          const driverRes = await getDriverById(driverId);
          const driverData = driverRes?.data ?? driverRes;
          setDriver(driverData);
          if (!vehicleStr && driverData?.vehicle_number) {
            setKmData((prev) => ({ ...prev, vehicle_number: String(driverData.vehicle_number).trim() }));
          }
        } catch {
          setDriver(null);
        }
      }
    } catch (error) {
      console.error('Error fetching excess KM record:', error);
      toast.error(error?.message || error?.error || 'Failed to load record');
    } finally {
      setLoading(false);
    }
  };

  const calculateKilometers = () => {
    const start = parseFloat(kmData.start_km) || 0;
    const end = parseFloat(kmData.end_km) || 0;
    if (end > start) return (end - start).toFixed(2);
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
    setKmData((prev) => ({ ...prev, [name]: nextValue }));
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
      setSubmitting(true);
      const kilometers = parseFloat(calculateKilometers()) || 0;
      const payload = {
        date: kmData.date,
        driver_id: parseInt(kmData.driver_id, 10),
        vehicle_number: kmData.vehicle_number,
        start_km: startKm,
        end_km: endKm,
        kilometers,
        amount: parseFloat(kmData.amount) || 0
      };
      await updateExcessKM(id, payload);
      toast.success('Start / End KM record updated successfully');
      navigate('/start-end-km-management', { state: { driverId: kmData.driver_id } });
    } catch (error) {
      console.error('Error updating excess KM:', error);
      toast.error(error?.message || error?.error || 'Failed to update record');
    } finally {
      setSubmitting(false);
    }
  };

  const driverIdForBack = kmData.driver_id || '';

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-emerald-50 p-4 sm:p-6 lg:p-8">
      <div className="max-w-2xl mx-auto">
        <div className="flex items-center gap-4 mb-6">
          <button
            onClick={() =>
              navigate('/start-end-km-management', driverIdForBack ? { state: { driverId: driverIdForBack } } : undefined)
            }
            className="flex items-center gap-2 text-[#0D5C4D] hover:text-[#0a6354] transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
            <span className="font-medium">Back to Start KM / End KM Management</span>
          </button>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6 sm:p-8">
          <h1 className="text-2xl font-bold text-gray-900 mb-6">Edit Start KM / End KM</h1>

          {loading ? (
            <div className="py-8 text-center text-gray-500">Loading...</div>
          ) : (
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
                  value={driver?.driver_name ?? ''}
                  readOnly
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg bg-gray-50 text-gray-700"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Vehicle Number
                </label>
                <input
                  type="text"
                  value={kmData.vehicle_number}
                  readOnly
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg bg-gray-50 text-gray-700"
                />
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
                  onClick={() =>
                    navigate('/start-end-km-management', driverIdForBack ? { state: { driverId: driverIdForBack } } : undefined)
                  }
                  className="flex-1 px-6 py-3 border border-gray-300 rounded-lg text-gray-700 font-medium hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex-1 px-6 py-3 bg-teal-600 text-white rounded-lg font-medium hover:bg-teal-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
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

export default EditExcessKM;