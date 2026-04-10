import React, { useState, useEffect } from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { createAdvancePay } from '../../../api/advancePayApi';
import { getAllDrivers, getDriverById } from '../../../api/driverApi';
import { sortDropdownObjects } from '../../../utils/dropdownSort';

const AddAdvancePay = () => {
  const navigate = useNavigate();
  const { id: paramId } = useParams();
  const location = useLocation();
  // Driver from URL (/drivers/:id/advance-pay) or from state (e.g. when coming from Driver Details → Advance Pay tab)
  const driverIdFromContext = paramId || location.state?.driverId || '';
  const [advanceData, setAdvanceData] = useState({
    driver_id: driverIdFromContext || '',
    date: new Date().toISOString().split('T')[0],
    advance_amount: ''
  });
  const [drivers, setDrivers] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchDrivers();
  }, []);

  // When opened for a specific driver, fetch that driver and set form default to their actual id (did)
  useEffect(() => {
    if (!driverIdFromContext) return;
    const resolveDriver = async () => {
      try {
        const response = await getDriverById(driverIdFromContext);
        const driver = response.data || response;
        const resolvedId = driver.did ?? driver.id ?? driver.driver_id ?? driverIdFromContext;
        setAdvanceData((prev) => ({ ...prev, driver_id: String(resolvedId) }));
      } catch {
        // Keep existing driver_id from URL/state if fetch fails
      }
    };
    resolveDriver();
  }, [driverIdFromContext]);

  const fetchDrivers = async () => {
    try {
      const response = await getAllDrivers();
      if (response.success) {
        const allDrivers = response.data || [];
        setDrivers(allDrivers);
      }
    } catch (error) {
      console.error('Error fetching drivers:', error);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!advanceData.driver_id || !advanceData.date || !advanceData.advance_amount) return;
    
    try {
      setLoading(true);
      await createAdvancePay(advanceData);
      const driverIdForList = String(advanceData.driver_id || '');
      navigate('/advance-pay-management', driverIdForList ? { state: { driverId: driverIdForList } } : undefined);
    } catch (error) {
      console.error('Error creating advance pay:', error);
      alert('Failed to create advance pay');
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
            onClick={() => navigate(driverIdFromContext ? `/advance-pay-management` : '/advance-pay-management', driverIdFromContext ? { state: { driverId: driverIdFromContext } } : undefined)}
            className="flex items-center gap-2 text-[#0D5C4D] hover:text-[#0a6354] transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
            <span className="font-medium">Back to Advance Pay</span>
          </button>
        </div>

        {/* Form */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6 sm:p-8">
          <h1 className="text-2xl font-bold text-gray-900 mb-6">Advance Pay</h1>
          
          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Driver</label>
              <select
                value={advanceData.driver_id}
                onChange={(e) => setAdvanceData({ ...advanceData, driver_id: e.target.value })}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                required
              >
                <option value="">Select Driver</option>
                {sortDropdownObjects(drivers, (driver) => driver.driver_name).map((driver) => {
                  const driverValue = String(driver.did ?? driver.id ?? driver.driver_id ?? '');
                  return (
                    <option key={driverValue || driver.driver_name} value={driverValue}>
                      {driver.driver_name} ({driver.driver_id || driverValue})
                    </option>
                  );
                })}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Date</label>
              <input
                type="date"
                value={advanceData.date}
                onChange={(e) => setAdvanceData({ ...advanceData, date: e.target.value })}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Advance Amount (₹)</label>
              <input
                type="number"
                step="0.01"
                value={advanceData.advance_amount}
                onChange={(e) => setAdvanceData({ ...advanceData, advance_amount: e.target.value })}
                placeholder="Enter advance amount"
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                required
              />
            </div>

            <div className="flex gap-4 pt-4">
              <button
                type="button"
                onClick={() => navigate(driverIdFromContext ? `/drivers/${driverIdFromContext}` : '/advance-pay-management')}
                className="flex-1 px-6 py-3 border border-gray-300 rounded-lg text-gray-700 font-medium hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={!advanceData.driver_id || !advanceData.date || !advanceData.advance_amount || loading}
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

export default AddAdvancePay;