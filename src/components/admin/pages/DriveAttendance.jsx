import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Calendar, ChevronDown } from 'lucide-react';
import { getAttendanceOverview, markCheckOut, markPresent, markAbsent, updateCheckInTime, updateCheckOutTime } from '../../../api/driverAttendanceApi';
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

const getTodayYYYYMMDD = () => new Date().toISOString().split('T')[0];

const DriveAttendance = () => {
  const navigate = useNavigate();
  const [attendanceDate, setAttendanceDate] = useState(getTodayYYYYMMDD);
  const [activeTab, setActiveTab] = useState('attendance');
  const [filters, setFilters] = useState({
    status: 'All',
    deliveryType: 'All'
  });
  const [searchQuery, setSearchQuery] = useState('');
  const [drivers, setDrivers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState([
    {
      label: 'Total Registered',
      value: '48',
      color: 'bg-gradient-to-r from-[#D1FAE5] to-[#A7F3D0]',
      textColor: 'text-[#0D5C4D]'
    },
    {
      label: 'Present',
      value: '32',
      color: 'bg-gradient-to-r from-[#6EE7B7] to-[#34D399]',
      textColor: 'text-[#0D5C4D]'
    },
    {
      label: 'Absent',
      value: '8',
      color: 'bg-gradient-to-r from-[#6EE7B7] to-[#34D399]',
      textColor: 'text-[#0D5C4D]'
    },
    {
      label: 'Not Marked Yet',
      value: '8',
      color: 'bg-gradient-to-r from-[#047857] to-[#065F46]',
      textColor: 'text-white'
    }
  ]);

  useEffect(() => {
    fetchAttendanceData();
    const interval = setInterval(fetchAttendanceData, 60000);
    return () => clearInterval(interval);
  }, [filters, attendanceDate]);

  const fetchAttendanceData = async (silent = false) => {
    try {
      if (!silent) setLoading(true);
      const params = {
        date: attendanceDate,
        status: filters.status !== 'All' ? filters.status : undefined,
        delivery_type: filters.deliveryType !== 'All' ? filters.deliveryType : undefined
      };

      const response = await getAttendanceOverview(params);

      if (response.success) {
        const { drivers: driverData, stats: statsData } = response.data;

        setStats([
          {
            label: 'Total Registered',
            value: statsData.totalRegistered?.toString() || '0',
            color: 'bg-gradient-to-r from-[#D1FAE5] to-[#A7F3D0]',
            textColor: 'text-[#0D5C4D]'
          },
          {
            label: 'Present',
            value: statsData.present?.toString() || '0',
            color: 'bg-gradient-to-r from-[#6EE7B7] to-[#34D399]',
            textColor: 'text-[#0D5C4D]'
          },
          {
            label: 'Absent',
            value: statsData.absent?.toString() || '0',
            color: 'bg-gradient-to-r from-[#6EE7B7] to-[#34D399]',
            textColor: 'text-[#0D5C4D]'
          },
          {
            label: 'Not Marked Yet',
            value: statsData.notMarked?.toString() || '0',
            color: 'bg-gradient-to-r from-[#047857] to-[#065F46]',
            textColor: 'text-white'
          }
        ]);

        const transformedDrivers = driverData.map(driver => {
          const status = driver.attendance_status || 'Not Marked';
          let statusColor = 'bg-orange-500';
          if (status === 'Present') {
            statusColor = 'bg-[#10B981]';
          } else if (ABSENT_STATUSES.includes(status)) {
            statusColor = 'bg-red-500';
          }

          return {
            id: driver.did,
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
            status: status,
            statusColor: statusColor,
            action: driver.check_out_time ? 'completed' : driver.check_in_time ? 'checkout' : 'markPresent',
            isPresent: status === 'Present' && !driver.check_out_time
          };
        });

        setDrivers(transformedDrivers);
      }
    } catch (error) {
      console.error('Error fetching attendance data:', error);
    } finally {
      if (!silent) setLoading(false);
    }
  };

  const handleTabChange = (tab) => {
    setActiveTab(tab);
    if (tab === 'driverList') {
      navigate('/drivers');
    } else if (tab === 'attendanceEdit') {
      navigate('/drivers/attendance/edit');
    } else if (tab === 'localPickup') {
      navigate('/drivers/local-pickup');
    } else if (tab === 'lineAirport') {
      navigate('/drivers/line-airport');
    }
  };

  const handleAction = async (action, driverId, absenceType = null) => {
    try {
      const driver = drivers.find(d => d.id === driverId);
      const timeForApi = (hhmm) => (hhmm && hhmm.includes(':')) ? `${hhmm}:00` : (hhmm || new Date().toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' }));
      if (action === 'checkout') {
        const time = driver?.checkOut ? timeForApi(driver.checkOut) : new Date().toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });
        await markCheckOut(driverId, { date: attendanceDate, time });
      } else if (action === 'markPresent') {
        const time = driver?.checkIn ? timeForApi(driver.checkIn) : getCurrentTimeHHMM() + ':00';
        await markPresent(driverId, { date: attendanceDate, time });
      } else if (action === 'markAbsent') {
        await markAbsent(driverId, { date: attendanceDate, type: absenceType || 'normal absent' });
      }
      await fetchAttendanceData(true);
    } catch (error) {
      console.error('Error marking attendance:', error);
      alert('Failed to mark attendance. Please try again.');
    }
  };

  const updateDriverTime = (driverId, field, value) => {
    setDrivers(prev => prev.map(d => d.id === driverId ? { ...d, [field]: value } : d));
  };

  const fillCurrentTime = (driverId, field) => {
    setDrivers(prev => prev.map(d => d.id === driverId ? { ...d, [field]: getCurrentTimeHHMM() } : d));
  };

  const timeForApi = (hhmm) => {
    if (!hhmm || !String(hhmm).includes(':')) return null;
    const parts = String(hhmm).trim().split(':');
    const h = parts[0].padStart(2, '0');
    const m = (parts[1] || '00').padStart(2, '0');
    const s = (parts[2] || '00').padStart(2, '0');
    return `${h}:${m}:${s}`;
  };

  const handleSaveCheckIn = async (driverId) => {
    const driver = drivers.find(d => d.id === driverId);
    const time = timeForApi(driver?.checkIn) || getCurrentTimeHHMM() + ':00';
    try {
      if (driver?.status !== 'Present') {
        await markPresent(driverId, { date: attendanceDate, time });
      } else {
        await updateCheckInTime(driverId, { date: attendanceDate, time });
      }
      await fetchAttendanceData(true);
    } catch (err) {
      console.error('Error saving check-in time:', err);
      alert('Failed to save check-in time. Please try again.');
    }
  };

  const handleSaveCheckOut = async (driverId) => {
    const driver = drivers.find(d => d.id === driverId);
    const time = timeForApi(driver?.checkOut) || new Date().toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });
    try {
      if (driver?.checkIn && !driver?.checkOut) {
        await markCheckOut(driverId, { date: attendanceDate, time });
      } else if (driver?.checkOut) {
        await updateCheckOutTime(driverId, { date: attendanceDate, time });
      }
      await fetchAttendanceData(true);
    } catch (err) {
      console.error('Error saving check-out time:', err);
      alert('Failed to save check-out time. Please try again.');
    }
  };

  const filteredDrivers = drivers.filter(driver => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return driver.name.toLowerCase().includes(query) ||
      driver.driverId.toLowerCase().includes(query) ||
      driver.phone.toLowerCase().includes(query);
  });

  return (
    <div className="p-4 sm:p-6 lg:p-8">

      {/* Tabs */}
      <div className="flex flex-wrap gap-2 mb-6">
        <button
          onClick={() => handleTabChange('driverList')}
          className={`px-6 py-2.5 rounded-lg font-medium text-sm transition-colors ${activeTab === 'driverList'
            ? 'bg-[#10B981] text-white'
            : 'bg-[#D4F4E8] text-[#0D5C4D] hover:bg-[#B8F4D8]'
            }`}
        >
          All Drivers
        </button>
        <button
          onClick={() => handleTabChange('attendance')}
          className={`px-6 py-2.5 rounded-lg font-medium text-sm transition-colors ${activeTab === 'attendance'
            ? 'bg-[#0D7C66] text-white'
            : 'bg-[#D4F4E8] text-[#0D5C4D] hover:bg-[#B8F4D8]'
            }`}
        >
          Attendance
        </button>
        <button
          onClick={() => handleTabChange('attendanceEdit')}
          className={`px-6 py-2.5 rounded-lg font-medium text-sm transition-colors ${activeTab === 'attendanceEdit'
            ? 'bg-[#0D7C66] text-white'
            : 'bg-[#D4F4E8] text-[#0D5C4D] hover:bg-[#B8F4D8]'
            }`}
        >
          Attendance Edit
        </button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6 mb-6">
        {stats.map((stat, index) => (
          <div
            key={index}
            className={`${stat.color} rounded-2xl p-6 ${stat.textColor}`}
          >
            <div className="text-sm font-medium mb-2 opacity-90">{stat.label}</div>
            <div className="text-3xl sm:text-4xl font-bold">{stat.value}</div>
          </div>
        ))}
      </div>

      {/* Filters and Search */}
      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        {/* Search Bar */}
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

        {/* Status Filter */}
        <div className="relative">
          <select
            value={filters.status}
            onChange={(e) => setFilters({ ...filters, status: e.target.value })}
            className="appearance-none bg-white border border-[#D0E0DB] rounded-lg px-4 py-2.5 pr-10 text-sm text-[#0D5C4D] focus:outline-none focus:ring-2 focus:ring-[#0D8568] cursor-pointer min-w-[140px]"
          >
            <option value="All">Status: All</option>
            <option value="Present">Present</option>
            <option value="Absent">Absent</option>
          </select>
          <ChevronDown className="absolute right-3 top-1/2 transform -translate-y-1/2 text-[#6B8782] pointer-events-none" size={16} />
        </div>

        {/* Delivery Type Filter */}
        <div className="relative">
          <select
            value={filters.deliveryType}
            onChange={(e) => setFilters({ ...filters, deliveryType: e.target.value })}
            className="appearance-none bg-white border border-[#D0E0DB] rounded-lg px-4 py-2.5 pr-10 text-sm text-[#0D5C4D] focus:outline-none focus:ring-2 focus:ring-[#0D8568] cursor-pointer min-w-[160px]"
          >
            <option value="All">Delivery Type: All</option>
            <option value="LOCAL GRADE ORDER">LOCAL GRADE ORDER</option>
            <option value="BOX ORDER">BOX ORDER</option>
            <option value="Both Types">Both Types</option>
          </select>
          <ChevronDown className="absolute right-3 top-1/2 transform -translate-y-1/2 text-[#6B8782] pointer-events-none" size={16} />
        </div>

        {/* Date Select (today or future) */}
        <div className="flex items-center gap-2 min-w-[160px]">
          <Calendar size={16} className="text-[#6B8782] flex-shrink-0" />
          <input
            type="date"
            value={attendanceDate}
            onChange={(e) => setAttendanceDate(e.target.value)}
            min={getTodayYYYYMMDD()}
            className="flex-1 bg-white border border-[#D0E0DB] rounded-lg px-3 py-2.5 text-sm text-[#0D5C4D] focus:outline-none focus:ring-2 focus:ring-[#0D8568]"
          />
        </div>
      </div>

      {/* Attendance Table */}
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
                  <td colSpan="6" className="px-6 py-8 text-center text-[#6B8782]">
                    Loading attendance data...
                  </td>
                </tr>
              ) : filteredDrivers.length === 0 ? (
                <tr>
                  <td colSpan="6" className="px-6 py-8 text-center text-[#6B8782]">
                    No drivers found
                  </td>
                </tr>
              ) : filteredDrivers.map((driver, index) => (
                <tr
                  key={driver.id}
                  className={`border-b border-[#D0E0DB] hover:bg-[#F0F4F3] transition-colors ${index % 2 === 0 ? 'bg-white' : 'bg-[#F0F4F3]/30'
                    }`}
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
                              e.target.nextSibling.style.display = 'flex';
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

                  <td className="px-4 sm:px-6 py-4">
                    <div className="flex items-center gap-2">
                      <input
                        type="time"
                        value={driver.checkIn || ''}
                        onFocus={() => fillCurrentTime(driver.id, 'checkIn')}
                        onChange={(e) => updateDriverTime(driver.id, 'checkIn', e.target.value)}
                        className={`w-24 px-2 py-1 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#0D7C66] ${driver.checkIn ? 'text-[#10B981] border-[#10B981]/50' : 'text-[#6B8782] border-[#D0E0DB]'}`}
                      />
                      <button
                        type="button"
                        onClick={() => handleSaveCheckIn(driver.id)}
                        disabled={ABSENT_STATUSES.includes(driver.status) || !!driver.checkOut}
                        className={`px-2 py-1 rounded text-xs font-medium ${!(ABSENT_STATUSES.includes(driver.status) || driver.checkOut) ? 'bg-[#0D7C66] text-white hover:bg-[#0a6354]' : 'bg-gray-200 text-gray-400 cursor-not-allowed'}`}
                        title="Save check-in time"
                      >
                        ✓
                      </button>
                    </div>
                  </td>

                  <td className="px-4 sm:px-6 py-4">
                    <div className="flex items-center gap-2">
                      <input
                        type="time"
                        value={driver.checkOut || ''}
                        onFocus={() => fillCurrentTime(driver.id, 'checkOut')}
                        onChange={(e) => updateDriverTime(driver.id, 'checkOut', e.target.value)}
                        className={`w-24 px-2 py-1 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#0D7C66] ${driver.checkOut ? 'text-red-600 border-red-300' : 'text-[#6B8782] border-[#D0E0DB]'}`}
                      />
                      <button
                        type="button"
                        onClick={() => handleSaveCheckOut(driver.id)}
                        disabled={!driver.checkIn}
                        className={`px-2 py-1 rounded text-xs font-medium ${driver.checkIn ? 'bg-[#0D7C66] text-white hover:bg-[#0a6354]' : 'bg-gray-200 text-gray-400 cursor-not-allowed'}`}
                        title="Save check-out time"
                      >
                        ✓
                      </button>
                    </div>
                  </td>

                  <td className="px-4 sm:px-6 py-4">
                    <span className={`px-3 py-1.5 rounded-full text-xs font-medium flex items-center gap-1.5 w-fit text-white ${driver.statusColor}`}>
                      <div className="w-2 h-2 rounded-full bg-white"></div>
                      {driver.status}
                    </span>
                  </td>

                  <td className="px-4 sm:px-6 py-4">
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleAction('markPresent', driver.id)}
                        disabled={driver.status === 'Present' || ABSENT_STATUSES.includes(driver.status) || !!driver.checkOut}
                        className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${driver.status === 'Present' || ABSENT_STATUSES.includes(driver.status) || !!driver.checkOut
                          ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                          : 'bg-[#10B981] hover:bg-[#059669] text-white'
                          }`}
                      >
                        Present
                      </button>
                      <button
                        onClick={() => handleAction('checkout', driver.id)}
                        disabled={!driver.checkIn || driver.checkOut}
                        className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${!driver.checkIn || driver.checkOut
                          ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                          : 'bg-red-500 hover:bg-red-600 text-white'
                          }`}
                      >
                        Checkout
                      </button>
                      <div className="relative">
                        <select
                          onChange={(e) => {
                            if (e.target.value) {
                              handleAction('markAbsent', driver.id, e.target.value);
                              e.target.value = ""; // Reset dropdown after selection
                            }
                          }}
                          disabled={driver.status === 'Present' || ABSENT_STATUSES.includes(driver.status) || !!driver.checkOut}
                          className={`appearance-none px-3 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer min-w-[100px] pr-8 ${driver.status === 'Present' || ABSENT_STATUSES.includes(driver.status) || !!driver.checkOut
                            ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                            : 'bg-orange-500 hover:bg-orange-600 text-white'
                            }`}
                          value=""
                        >
                          <option value="" disabled>Absent</option>
                          <option value="informed leave">Informed Leave</option>
                          <option value="uninformed leave">Uninformed Leave</option>
                          <option value="leave">Leave</option>
                          <option value="voluntary leave">Voluntary Leave</option>
                          <option value="normal absent">Normal Absent</option>
                        </select>
                        <ChevronDown className={`absolute right-2 top-1/2 transform -translate-y-1/2 pointer-events-none ${driver.status === 'Present' || ABSENT_STATUSES.includes(driver.status) || !!driver.checkOut
                          ? 'text-gray-400'
                          : 'text-white'
                          }`} size={14} />
                      </div>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 px-4 sm:px-6 py-4 bg-[#F0F4F3] border-t border-[#D0E0DB]">
          <div className="text-sm text-[#6B8782]">
            Showing {filteredDrivers.length} of {drivers.length} drivers
          </div>
        </div>
      </div>
    </div>
  );
};

export default DriveAttendance;