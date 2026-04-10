import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Calendar, ChevronDown, Pencil, Trash2, X } from 'lucide-react';
import {
  getAttendanceOverview,
  markPresent,
  markAbsent,
  deleteAttendanceRecord
} from '../../../api/driverAttendanceApi';
import { BASE_URL } from '../../../config/config';

const getCurrentTimeHHMM = () => {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
};

const parseTimeToHHMM = (str) => {
  if (!str || str === '--:-- --') return '';
  const trimmed = String(str).trim();
  const match = trimmed.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(AM|PM)?$/i);
  if (match) {
    let h = parseInt(match[1], 10);
    const m = match[2];
    if (match[4]) {
      if (match[4].toUpperCase() === 'PM' && h < 12) h += 12;
      if (match[4].toUpperCase() === 'AM' && h === 12) h = 0;
    }
    return `${String(h).padStart(2, '0')}:${m}`;
  }
  if (/^\d{1,2}:\d{2}$/.test(trimmed)) return trimmed.length === 4 ? `0${trimmed}` : trimmed;
  return '';
};

const ABSENT_STATUSES = ['informed leave', 'uninformed leave', 'leave', 'voluntary leave', 'normal absent', 'Absent'];

const STATUS_OPTIONS = [
  { value: 'Present', label: 'Present' },
  { value: 'Absent', label: 'Absent' },
  { value: 'informed leave', label: 'Informed Leave' },
  { value: 'uninformed leave', label: 'Uninformed Leave' },
  { value: 'leave', label: 'Leave' },
  { value: 'voluntary leave', label: 'Voluntary Leave' },
  { value: 'normal absent', label: 'Normal Absent' }
];

const getTodayYYYYMMDD = () => new Date().toISOString().split('T')[0];

const AttendanceEdit = () => {
  const navigate = useNavigate();
  const [attendanceDate, setAttendanceDate] = useState(getTodayYYYYMMDD);
  const [activeTab, setActiveTab] = useState('attendanceEdit');
  const [filters, setFilters] = useState({
    status: 'All',
    deliveryType: 'All'
  });
  const [searchQuery, setSearchQuery] = useState('');
  const [drivers, setDrivers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState([
    { label: 'Total Registered', value: '0', color: 'bg-gradient-to-r from-[#D1FAE5] to-[#A7F3D0]', textColor: 'text-[#0D5C4D]' },
    { label: 'Present', value: '0', color: 'bg-gradient-to-r from-[#6EE7B7] to-[#34D399]', textColor: 'text-[#0D5C4D]' },
    { label: 'Absent', value: '0', color: 'bg-gradient-to-r from-[#6EE7B7] to-[#34D399]', textColor: 'text-[#0D5C4D]' },
    { label: 'Not Marked Yet', value: '0', color: 'bg-gradient-to-r from-[#047857] to-[#065F46]', textColor: 'text-white' }
  ]);
  const [editModal, setEditModal] = useState(null);
  const [editStatus, setEditStatus] = useState('Present');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchAttendanceData();
  }, [filters, attendanceDate]);

  const fetchAttendanceData = async () => {
    try {
      setLoading(true);
      const params = {
        date: attendanceDate,
        status: filters.status !== 'All' ? filters.status : undefined,
        delivery_type: filters.deliveryType !== 'All' ? filters.deliveryType : undefined
      };
      const response = await getAttendanceOverview(params);

      if (response.success) {
        const { drivers: driverData, stats: statsData } = response.data;
        setStats([
          { label: 'Total Registered', value: statsData.totalRegistered?.toString() || '0', color: 'bg-gradient-to-r from-[#D1FAE5] to-[#A7F3D0]', textColor: 'text-[#0D5C4D]' },
          { label: 'Present', value: statsData.present?.toString() || '0', color: 'bg-gradient-to-r from-[#6EE7B7] to-[#34D399]', textColor: 'text-[#0D5C4D]' },
          { label: 'Absent', value: statsData.absent?.toString() || '0', color: 'bg-gradient-to-r from-[#6EE7B7] to-[#34D399]', textColor: 'text-[#0D5C4D]' },
          { label: 'Not Marked Yet', value: statsData.notMarked?.toString() || '0', color: 'bg-gradient-to-r from-[#047857] to-[#065F46]', textColor: 'text-white' }
        ]);

        const transformedDrivers = driverData.map(driver => {
          const status = driver.attendance_status || 'Not Marked';
          let statusColor = 'bg-orange-500';
          if (status === 'Present') statusColor = 'bg-[#10B981]';
          else if (ABSENT_STATUSES.includes(status)) statusColor = 'bg-red-500';

          return {
            id: driver.did,
            attendanceId: driver.attendance_id || null,
            name: driver.driver_name,
            driverId: driver.driver_id,
            phone: driver.phone_number,
            avatar: driver.driver_name.split(' ').map(n => n[0]).join('').toUpperCase(),
            avatarBg: 'bg-teal-700',
            profileImage: driver.profile_image,
            deliveryType: driver.delivery_type || 'N/A',
            deliveryTypeBg: driver.delivery_type === 'LOCAL GRADE ORDER' ? 'bg-blue-100' : driver.delivery_type === 'BOX ORDER' ? 'bg-orange-100' : 'bg-purple-100',
            deliveryTypeText: driver.delivery_type === 'LOCAL GRADE ORDER' ? 'text-blue-700' : driver.delivery_type === 'BOX ORDER' ? 'text-orange-700' : 'text-purple-700',
            checkIn: parseTimeToHHMM(driver.check_in_time) || '',
            checkOut: parseTimeToHHMM(driver.check_out_time) || '',
            status,
            statusColor
          };
        });
        setDrivers(transformedDrivers);
      }
    } catch (error) {
      console.error('Error fetching attendance data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleTabChange = (tab) => {
    setActiveTab(tab);
    if (tab === 'driverList') navigate('/drivers');
    else if (tab === 'attendance') navigate('/drivers/attendance');
    else if (tab === 'localPickup') navigate('/drivers/local-pickup');
    else if (tab === 'lineAirport') navigate('/drivers/line-airport');
  };

  const openEditModal = (driver) => {
    setEditModal(driver);
    setEditStatus(driver.status === 'Present' ? 'Present' : ABSENT_STATUSES.includes(driver.status) ? driver.status : 'Absent');
  };

  const closeEditModal = () => {
    setEditModal(null);
    setEditStatus('Present');
  };

  const handleSaveEdit = async () => {
    if (!editModal) return;
    setSaving(true);
    try {
      const time = editModal.checkIn ? `${editModal.checkIn}:00` : getCurrentTimeHHMM() + ':00';
      if (editStatus === 'Present') {
        await markPresent(editModal.id, { date: attendanceDate, time });
      } else {
        await markAbsent(editModal.id, { date: attendanceDate, type: editStatus });
      }
      closeEditModal();
      await fetchAttendanceData();
    } catch (error) {
      console.error('Error updating attendance:', error);
      alert('Failed to update attendance. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (driver) => {
    if (!driver.attendanceId) {
      alert('No attendance record to delete.');
      return;
    }
    if (!window.confirm(`Delete attendance record for ${driver.name} on ${attendanceDate}?`)) return;
    try {
      await deleteAttendanceRecord(driver.attendanceId);
      await fetchAttendanceData();
    } catch (error) {
      console.error('Error deleting attendance:', error);
      alert('Failed to delete attendance record.');
    }
  };

  const filteredDrivers = drivers.filter(driver => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return driver.name.toLowerCase().includes(q) || driver.driverId.toLowerCase().includes(q) || (driver.phone && driver.phone.toLowerCase().includes(q));
  });

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      {/* Tabs */}
      <div className="flex flex-wrap gap-2 mb-6">
        <button
          onClick={() => handleTabChange('driverList')}
          className={`px-6 py-2.5 rounded-lg font-medium text-sm transition-colors ${activeTab === 'driverList' ? 'bg-[#10B981] text-white' : 'bg-[#D4F4E8] text-[#0D5C4D] hover:bg-[#B8F4D8]'}`}
        >
          All Drivers
        </button>
        <button
          onClick={() => handleTabChange('attendance')}
          className={`px-6 py-2.5 rounded-lg font-medium text-sm transition-colors ${activeTab === 'attendance' ? 'bg-[#0D7C66] text-white' : 'bg-[#D4F4E8] text-[#0D5C4D] hover:bg-[#B8F4D8]'}`}
        >
          Attendance
        </button>
        <button
          onClick={() => handleTabChange('attendanceEdit')}
          className={`px-6 py-2.5 rounded-lg font-medium text-sm transition-colors ${activeTab === 'attendanceEdit' ? 'bg-[#0D7C66] text-white' : 'bg-[#D4F4E8] text-[#0D5C4D] hover:bg-[#B8F4D8]'}`}
        >
          Attendance Edit
        </button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6 mb-6">
        {stats.map((stat, index) => (
          <div key={index} className={`${stat.color} rounded-2xl p-6 ${stat.textColor}`}>
            <div className="text-sm font-medium mb-2 opacity-90">{stat.label}</div>
            <div className="text-3xl sm:text-4xl font-bold">{stat.value}</div>
          </div>
        ))}
      </div>

      {/* Filters and Search */}
      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-[#6B8782]" size={20} />
          <input
            type="text"
            placeholder="Search driver..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-12 pr-4 py-2.5 bg-white border border-[#D0E0DB] rounded-lg text-[#0D5C4D] placeholder-[#9CA3AF] focus:outline-none focus:ring-2 focus:ring-[#0D8568]"
          />
        </div>
        <div className="relative">
          <select
            value={filters.status}
            onChange={(e) => setFilters({ ...filters, status: e.target.value })}
            className="appearance-none bg-white border border-[#D0E0DB] rounded-lg px-4 py-2.5 pr-10 text-sm text-[#0D5C4D] focus:outline-none focus:ring-2 focus:ring-[#0D8568] cursor-pointer min-w-[140px]"
          >
            <option value="All">Status: All</option>
            <option value="Absent">Absent</option>
            <option value="Present">Present</option>
          </select>
          <ChevronDown className="absolute right-3 top-1/2 transform -translate-y-1/2 text-[#6B8782] pointer-events-none" size={16} />
        </div>
        <div className="relative">
          <select
            value={filters.deliveryType}
            onChange={(e) => setFilters({ ...filters, deliveryType: e.target.value })}
            className="appearance-none bg-white border border-[#D0E0DB] rounded-lg px-4 py-2.5 pr-10 text-sm text-[#0D5C4D] focus:outline-none focus:ring-2 focus:ring-[#0D8568] cursor-pointer min-w-[160px]"
          >
            <option value="All">Delivery Type: All</option>
            <option value="BOX ORDER">BOX ORDER</option>
            <option value="Both Types">Both Types</option>
            <option value="LOCAL GRADE ORDER">LOCAL GRADE ORDER</option>
          </select>
          <ChevronDown className="absolute right-3 top-1/2 transform -translate-y-1/2 text-[#6B8782] pointer-events-none" size={16} />
        </div>
        <div className="flex items-center gap-2 min-w-[160px]">
          <Calendar size={16} className="text-[#6B8782] flex-shrink-0" />
          <input
            type="date"
            value={attendanceDate}
            onChange={(e) => setAttendanceDate(e.target.value)}
            className="flex-1 bg-white border border-[#D0E0DB] rounded-lg px-3 py-2.5 text-sm text-[#0D5C4D] focus:outline-none focus:ring-2 focus:ring-[#0D8568]"
          />
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl overflow-hidden border border-[#D0E0DB]">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1000px]">
            <thead>
              <tr className="bg-[#D4F4E8]">
                <th className="px-4 sm:px-6 py-4 text-left text-xs sm:text-sm font-semibold text-[#0D5C4D]">Driver Info</th>
                <th className="px-4 sm:px-6 py-4 text-left text-xs sm:text-sm font-semibold text-[#0D5C4D]">Delivery Type</th>
                <th className="px-4 sm:px-6 py-4 text-left text-xs sm:text-sm font-semibold text-[#0D5C4D]">Check-in Time</th>
                <th className="px-4 sm:px-6 py-4 text-left text-xs sm:text-sm font-semibold text-[#0D5C4D]">Check-out Time</th>
                <th className="px-4 sm:px-6 py-4 text-left text-xs sm:text-sm font-semibold text-[#0D5C4D]">Status</th>
                <th className="px-4 sm:px-6 py-4 text-left text-xs sm:text-sm font-semibold text-[#0D5C4D]">Action</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan="6" className="px-6 py-8 text-center text-[#6B8782]">Loading attendance data...</td>
                </tr>
              ) : filteredDrivers.length === 0 ? (
                <tr>
                  <td colSpan="6" className="px-6 py-8 text-center text-[#6B8782]">No drivers found</td>
                </tr>
              ) : (
                filteredDrivers.map((driver, index) => (
                  <tr
                    key={driver.id}
                    className={`border-b border-[#D0E0DB] hover:bg-[#F0F4F3] transition-colors ${index % 2 === 0 ? 'bg-white' : 'bg-[#F0F4F3]/30'}`}
                  >
                    <td className="px-4 sm:px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-full ${driver.avatarBg} flex items-center justify-center text-white font-semibold text-sm flex-shrink-0 overflow-hidden`}>
                          {driver.profileImage ? (
                            <img
                              src={`${BASE_URL}${driver.profileImage}`}
                              alt={driver.name}
                              className="w-full h-full object-cover"
                              onError={(e) => {
                                e.target.style.display = 'none';
                                if (e.target.nextSibling) e.target.nextSibling.style.display = 'flex';
                              }}
                            />
                          ) : null}
                          <span className={driver.profileImage ? 'hidden' : ''}>{driver.avatar}</span>
                        </div>
                        <div>
                          <div className="text-sm font-semibold text-[#0D5C4D]">{driver.name}</div>
                          <div className="text-xs text-[#6B8782]">{driver.driverId} • {driver.phone}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 sm:px-6 py-4">
                      <span className={`px-3 py-1.5 rounded-full text-xs font-medium ${driver.deliveryTypeBg} ${driver.deliveryTypeText}`}>
                        {driver.deliveryType}
                      </span>
                    </td>
                    <td className="px-4 sm:px-6 py-4 text-sm text-[#0D5C4D]">{driver.checkIn || '--'}</td>
                    <td className="px-4 sm:px-6 py-4 text-sm text-[#0D5C4D]">{driver.checkOut || '--'}</td>
                    <td className="px-4 sm:px-6 py-4">
                      <span className={`px-3 py-1.5 rounded-full text-xs font-medium flex items-center gap-1.5 w-fit text-white ${driver.statusColor}`}>
                        <span className="w-2 h-2 rounded-full bg-white" />
                        {driver.status}
                      </span>
                    </td>
                    <td className="px-4 sm:px-6 py-4">
                      <div className="flex gap-2">
                        <button
                          onClick={() => openEditModal(driver)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-[#0D7C66] hover:bg-[#0a6354] text-white"
                          title="Edit attendance"
                        >
                          <Pencil size={14} />
                          Edit
                        </button>
                        <button
                          onClick={() => handleDelete(driver)}
                          disabled={!driver.attendanceId}
                          className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium ${driver.attendanceId ? 'bg-red-500 hover:bg-red-600 text-white' : 'bg-gray-200 text-gray-400 cursor-not-allowed'}`}
                          title="Delete attendance record"
                        >
                          <Trash2 size={14} />
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 px-4 sm:px-6 py-4 bg-[#F0F4F3] border-t border-[#D0E0DB]">
          <div className="text-sm text-[#6B8782]">
            Showing {filteredDrivers.length} of {drivers.length} drivers
          </div>
        </div>
      </div>

      {/* Edit Modal */}
      {editModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={closeEditModal}>
          <div
            className="bg-white rounded-2xl shadow-xl max-w-md w-full mx-4 p-6"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-[#0D5C4D]">Edit Attendance</h3>
              <button onClick={closeEditModal} className="p-1 rounded hover:bg-gray-100 text-[#6B8782]">
                <X size={20} />
              </button>
            </div>
            <p className="text-sm text-[#6B8782] mb-4">{editModal.name} • {attendanceDate}</p>
            <label className="block text-sm font-medium text-[#0D5C4D] mb-2">Status</label>
            <select
              value={editStatus}
              onChange={(e) => setEditStatus(e.target.value)}
              className="w-full bg-white border border-[#D0E0DB] rounded-lg px-4 py-2.5 text-sm text-[#0D5C4D] focus:outline-none focus:ring-2 focus:ring-[#0D8568] mb-6"
            >
              {STATUS_OPTIONS.map(opt => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
            <div className="flex gap-2 justify-end">
              <button
                onClick={closeEditModal}
                className="px-4 py-2 rounded-lg text-sm font-medium text-[#0D5C4D] bg-[#D4F4E8] hover:bg-[#B8F4D8]"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveEdit}
                disabled={saving}
                className="px-4 py-2 rounded-lg text-sm font-medium text-white bg-[#0D7C66] hover:bg-[#0a6354] disabled:opacity-50"
              >
                {saving ? 'Saving...' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AttendanceEdit;
