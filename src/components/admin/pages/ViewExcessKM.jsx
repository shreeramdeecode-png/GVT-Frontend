import React, { useState, useEffect } from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { getExcessKMById } from '../../../api/excessKmApi';

const ViewExcessKM = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const location = useLocation();
  const driverIdFromState = location.state?.driverId || '';
  const [record, setRecord] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchRecord = async () => {
      try {
        setLoading(true);
        const response = await getExcessKMById(id);
        setRecord(response?.data ?? response ?? null);
      } catch (error) {
        console.error('Error fetching Start/End KM record:', error);
        alert('Failed to load Start / End KM record');
      } finally {
        setLoading(false);
      }
    };
    if (id) fetchRecord();
  }, [id]);

  const backStateDriverId = driverIdFromState || record?.driver_id || record?.driver?.did || '';

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-emerald-50 p-4 sm:p-6 lg:p-8">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center gap-4 mb-6">
          <button
            onClick={() =>
              navigate(
                '/start-end-km-management',
                backStateDriverId ? { state: { driverId: String(backStateDriverId) } } : undefined
              )
            }
            className="flex items-center gap-2 text-[#0D5C4D] hover:text-[#0a6354] transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
            <span className="font-medium">Back to Start KM / End KM</span>
          </button>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6 sm:p-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">Start KM / End KM Details</h2>

          {loading ? (
            <div className="text-center py-8">Loading...</div>
          ) : record ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm text-gray-500 mb-1">Date</label>
                <div className="text-sm font-medium text-gray-900">{record.date || 'N/A'}</div>
              </div>
              <div>
                <label className="block text-sm text-gray-500 mb-1">Driver Name</label>
                <div className="text-sm font-medium text-gray-900">{record.driver?.driver_name || 'N/A'}</div>
              </div>
              <div>
                <label className="block text-sm text-gray-500 mb-1">Vehicle Number</label>
                <div className="text-sm font-medium text-gray-900">
                  {record.vehicle_number || record.driver?.vehicle_number || 'N/A'}
                </div>
              </div>
              <div>
                <label className="block text-sm text-gray-500 mb-1">Start KM</label>
                <div className="text-sm font-medium text-gray-900">{record.start_km ?? record.startKm ?? 'N/A'}</div>
              </div>
              <div>
                <label className="block text-sm text-gray-500 mb-1">End KM</label>
                <div className="text-sm font-medium text-gray-900">{record.end_km ?? record.endKm ?? 'N/A'}</div>
              </div>
              <div>
                <label className="block text-sm text-gray-500 mb-1">Kilometers (KM)</label>
                <div className="text-sm font-medium text-gray-900">{record.kilometers ?? 'N/A'}</div>
              </div>
              <div>
                <label className="block text-sm text-gray-500 mb-1">Amount (Rs)</label>
                <div className="text-lg font-bold text-[#0D7C66]">
                  Rs {Number(record.amount || 0).toFixed(2)}
                </div>
              </div>
            </div>
          ) : (
            <div className="text-center py-8 text-gray-500">Record not found</div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ViewExcessKM;
