import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Plus, ArrowLeft, MoreVertical, Eye, Edit, Trash2 } from 'lucide-react';
import { getExcessKMsByDriverId, deleteExcessKM } from '../../../api/excessKmApi';
import { getDriverById } from '../../../api/driverApi';
import toast from 'react-hot-toast';

const StartEndKMManagement = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const queryDriverId = new URLSearchParams(location.search).get('driverId');

  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [selectedKM, setSelectedKM] = useState(null);
  const [openDropdown, setOpenDropdown] = useState(null);
  const [dropdownPosition, setDropdownPosition] = useState({ top: 0, left: 0 });
  const dropdownRef = useRef(null);

  const [kmData, setKmData] = useState([]);
  const [selectedDriverId] = useState(location.state?.driverId || queryDriverId || '');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setOpenDropdown(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    fetchKMs();
  }, [selectedDriverId]);

  const fetchKMs = async () => {
    try {
      setLoading(true);
      if (!selectedDriverId) {
        setKmData([]);
        toast.error('No driver selected for Start / End KM');
        return;
      }

      let effectiveDriverId = selectedDriverId;
      // Some screens pass route ID/driver_id, while KM API expects did.
      try {
        const driverRes = await getDriverById(selectedDriverId);
        const driver = driverRes?.data || driverRes;
        if (driver?.did != null && driver.did !== '') {
          effectiveDriverId = String(driver.did);
        }
      } catch {
        // Fallback to incoming ID if resolving did fails
      }

      const response = await getExcessKMsByDriverId(effectiveDriverId);
      const data = response.data || response || [];
      setKmData(Array.isArray(data) ? data : []);
    } catch (error) {
      toast.error(error.message || 'Failed to fetch KM records');
      setKmData([]);
    } finally {
      setLoading(false);
    }
  };

  const toggleDropdown = (kmId, event) => {
    if (openDropdown === kmId) {
      setOpenDropdown(null);
    } else {
      const rect = event.currentTarget.getBoundingClientRect();
      setDropdownPosition({
        top: rect.bottom + window.scrollY + 8,
        left: rect.right + window.scrollX - 128
      });
      setOpenDropdown(kmId);
    }
  };

  const handleAction = (action, km) => {
    const recordId = km?.id ?? km?.ekmid ?? km?.excess_km_id;
    if (action === 'view') {
      navigate(`/excess-km/view/${recordId}`, { state: { driverId: selectedDriverId } });
    } else if (action === 'edit') {
      navigate(`/excess-km/edit/${recordId}`, { state: { driverId: selectedDriverId } });
    } else if (action === 'delete') {
      setSelectedKM(km);
      setShowDeleteModal(true);
    }
    setOpenDropdown(null);
  };

  const handleDelete = async () => {
    try {
      await deleteExcessKM(selectedKM.id ?? selectedKM.ekmid ?? selectedKM.excess_km_id);
      toast.success('KM record deleted successfully');
      await fetchKMs();
      setShowDeleteModal(false);
      setSelectedKM(null);
    } catch (error) {
      toast.error(error.message || 'Failed to delete KM record');
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-emerald-50 p-4 sm:p-6 lg:p-8">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center gap-4 mb-6">
          <button
            onClick={() =>
              navigate(selectedDriverId ? `/drivers/${selectedDriverId}` : '/drivers')
            }
            className="flex items-center gap-2 text-[#0D5C4D] hover:text-[#0a6354] transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
            <span className="font-medium">Back to Driver Details</span>
          </button>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">
              Start KM / End KM Management
            </h1>
            <p className="mt-1 text-sm text-gray-600">
              View and manage Start / End KM records for drivers.
            </p>
          </div>

          {/* Add Button */}
          <div className="flex items-center gap-3">
            <button
              onClick={() =>
                navigate(
                  selectedDriverId
                    ? `/drivers/${selectedDriverId}/excess-km`
                    : '/drivers'
                )
              }
              className="flex items-center gap-2 px-6 py-3 bg-teal-600 text-white rounded-lg font-medium hover:bg-teal-700 transition-colors"
            >
              <Plus className="w-5 h-5" />
              Start KM / End KM
            </button>
          </div>
        </div>

        {/* Table */}
        <div className="bg-white rounded-2xl overflow-hidden border border-gray-200">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-[#D4F4E8]">
                  <th className="px-6 py-4 text-left text-sm font-semibold text-[#0D5C4D]">
                    Date
                  </th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-[#0D5C4D]">
                    Driver Name
                  </th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-[#0D5C4D]">
                    Vehicle Number
                  </th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-[#0D5C4D]">
                    Start KM
                  </th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-[#0D5C4D]">
                    End KM
                  </th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-[#0D5C4D]">
                    Kilometers (KM)
                  </th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-[#0D5C4D]">
                    Amount (₹)
                  </th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-[#0D5C4D]">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td
                      colSpan="8"
                      className="px-6 py-8 text-center text-gray-500"
                    >
                      Loading...
                    </td>
                  </tr>
                ) : kmData.length === 0 ? (
                  <tr>
                    <td
                      colSpan="8"
                      className="px-6 py-8 text-center text-gray-500"
                    >
                      {selectedDriverId
                        ? 'No Start / End KM records found for this driver'
                        : 'No Start / End KM records found'}
                    </td>
                  </tr>
                ) : (
                  kmData.map((data, index) => {
                    const rowId = data.id ?? data.ekmid ?? data.excess_km_id;
                    return (
                    <tr
                      key={rowId}
                      className={`border-b border-gray-200 hover:bg-gray-50 transition-colors ${
                        index % 2 === 0 ? 'bg-white' : 'bg-gray-50/30'
                      }`}
                    >
                      <td className="px-6 py-4 text-sm text-gray-900">{data.date}</td>
                      <td className="px-6 py-4 text-sm font-medium text-gray-900">
                        {data.driver?.driver_name || 'N/A'}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-900">
                        {data.vehicle_number ||
                          data.driver?.vehicle_number ||
                          'N/A'}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-900">
                        {data.start_km} km
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-900">
                        {data.end_km} km
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-900">
                        {data.kilometers} km
                      </td>
                      <td className="px-6 py-4 text-sm font-semibold text-gray-900">
                        ₹{parseFloat(data.amount).toFixed(2)}
                      </td>
                      <td className="px-6 py-4">
                        <div className="relative">
                          <button
                            onClick={(event) => toggleDropdown(rowId, event)}
                            className="text-[#6B8782] hover:text-[#0D5C4D] transition-colors p-1 hover:bg-[#F0F4F3] rounded"
                          >
                            <MoreVertical size={20} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Dropdown Menu */}
      {openDropdown && (
        <div
          ref={dropdownRef}
          className="fixed w-32 bg-white rounded-lg shadow-lg border border-[#D0E0DB] py-1 z-[100]"
          style={{
            top: `${dropdownPosition.top}px`,
            left: `${dropdownPosition.left}px`
          }}
        >
          <button
            onClick={() =>
              handleAction(
                'view',
                kmData.find((k) => (k.id ?? k.ekmid ?? k.excess_km_id) === openDropdown)
              )
            }
            className="w-full text-left px-4 py-2 text-sm text-[#0D5C4D] hover:bg-[#F0F4F3] transition-colors flex items-center gap-2"
          >
            <Eye size={14} />
            View
          </button>
          <button
            onClick={() =>
              handleAction(
                'edit',
                kmData.find((k) => (k.id ?? k.ekmid ?? k.excess_km_id) === openDropdown)
              )
            }
            className="w-full text-left px-4 py-2 text-sm text-[#0D5C4D] hover:bg-[#F0F4F3] transition-colors flex items-center gap-2"
          >
            <Edit size={14} />
            Edit
          </button>
          <button
            onClick={() =>
              handleAction(
                'delete',
                kmData.find((k) => (k.id ?? k.ekmid ?? k.excess_km_id) === openDropdown)
              )
            }
            className="w-full text-left px-4 py-2 text-sm text-red-500 hover:bg-[#F0F4F3] transition-colors flex items-center gap-2"
          >
            <Trash2 size={14} />
            Delete
          </button>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteModal && (
        <div
          className="fixed inset-0 flex items-center justify-center z-50"
          style={{ backgroundColor: 'rgba(0, 0, 0, 0.5)' }}
        >
          <div className="bg-white rounded-lg p-6 w-96">
            <h3 className="text-lg font-bold text-gray-900 mb-4">
              Delete Start / End KM Record
            </h3>
            <p className="text-sm text-gray-600 mb-6">
              Are you sure you want to delete this Start / End KM record for{' '}
              {selectedKM?.driver?.driver_name || 'this driver'}?
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => {
                  setShowDeleteModal(false);
                  setSelectedKM(null);
                }}
                className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default StartEndKMManagement;
