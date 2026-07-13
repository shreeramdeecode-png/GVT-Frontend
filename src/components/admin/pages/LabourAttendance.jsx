import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Calendar, ChevronDown } from 'lucide-react';
import { getAllAttendance, markPresent, markCheckOut, markAbsent, updateCheckInTime, updateCheckOutTime } from '../../../api/labourAttendanceApi';
import { getAllLabours } from '../../../api/labourApi';

// Get current time as HH:MM for input type="time"
const getCurrentTimeHHMM = () => {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
};
// Parse API time string to HH:MM for input (e.g. "09:30:00" or "09:30 AM" -> "09:30")
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

const LabourAttendance = () => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('attendance');
  const [selectedDate, setSelectedDate] = useState(getTodayYYYYMMDD());
  const [filters, setFilters] = useState({ status: 'All' });
  const [searchQuery, setSearchQuery] = useState('');
  const [stats, setStats] = useState({
    totalRegistered: 0,
    present: 0,
    absent: 0,
    halfDay: 0,
    notMarked: 0
  });
  const [labours, setLabours] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchData();
  }, [selectedDate, filters]);

  const fetchData = async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const attendanceRes = await getAllAttendance({ date: selectedDate, status: filters.status });

      setStats(attendanceRes.data.stats);

      const mergedData = attendanceRes.data.labours.map(labour => ({
        id: labour.lid,
        name: labour.full_name,
        labourId: labour.labour_id,
        phone: labour.mobile_number,
        department: labour.department,
        checkIn: parseTimeToHHMM(labour.check_in_time) || '',
        checkOut: parseTimeToHHMM(labour.check_out_time) || '',
        status: labour.attendance_status,
        attendanceId: labour.attendance_id
      }));

      setLabours(mergedData);
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      if (!silent) setLoading(false);
    }
  };

  const handleTabChange = (tab) => {
    setActiveTab(tab);
    if (tab === 'labourList') {
      navigate('/labour');
    } else if (tab === 'excessPay') {
      navigate('/labour/excess-pay');
    } else if (tab === 'dailyPayout') {
      navigate('/labour/daily-payout');
    } else if (tab === 'attendanceEdit') {
      navigate('/labour/attendance/edit');
    }
  };

  const handleAction = async (action, labourId, absenceType = null) => {
    try {
      const labour = labours.find(l => l.id === labourId);
      const timeForApi = (hhmm) => (hhmm && hhmm.includes(':')) ? `${hhmm}:00` : (hhmm || new Date().toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' }));
      if (action === 'checkout') {
        const time = labour?.checkOut ? timeForApi(labour.checkOut) : new Date().toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });
        await markCheckOut(labourId, { time, date: selectedDate });
      } else if (action === 'markPresent') {
        const time = labour?.checkIn ? timeForApi(labour.checkIn) : getCurrentTimeHHMM() + ':00';
        await markPresent(labourId, { date: selectedDate, time });
      } else if (action === 'markAbsent') {
        await markAbsent(labourId, { date: selectedDate, type: absenceType || 'normal absent' });
      }
      await fetchData(true);
    } catch (error) {
      console.error('Error marking attendance:', error);
      alert('Failed to mark attendance. Please try again.');
    }
  };

  const updateLabourTime = (labourId, field, value) => {
    setLabours(prev => prev.map(l => l.id === labourId ? { ...l, [field]: value } : l));
  };
  // (fixed: was returning `l` in else - correct as is)

  const fillCurrentTime = (labourId, field) => {
    setLabours(prev => prev.map(l => l.id === labourId ? { ...l, [field]: getCurrentTimeHHMM() } : l));
  };

  const timeForApi = (hhmm) => {
    if (!hhmm || !String(hhmm).includes(':')) return null;
    const parts = String(hhmm).trim().split(':');
    const h = parts[0].padStart(2, '0');
    const m = (parts[1] || '00').padStart(2, '0');
    const s = (parts[2] || '00').padStart(2, '0');
    return `${h}:${m}:${s}`;
  };

  const handleSaveCheckIn = async (labourId) => {
    const labour = labours.find(l => l.id === labourId);
    const time = timeForApi(labour?.checkIn) || getCurrentTimeHHMM() + ':00';
    try {
      if (labour?.status !== 'Present' && !labour?.checkIn) {
        await markPresent(labourId, { date: selectedDate, time });
      } else {
        await updateCheckInTime(labourId, { date: selectedDate, time });
      }
      await fetchData(true);
    } catch (err) {
      console.error('Error saving check-in time:', err);
      alert('Failed to save check-in time. Please try again.');
    }
  };

  const handleSaveCheckOut = async (labourId) => {
    const labour = labours.find(l => l.id === labourId);
    const time = timeForApi(labour?.checkOut) || new Date().toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });
    try {
      if (labour?.checkIn && !labour?.checkOut) {
        await markCheckOut(labourId, { date: selectedDate, time });
      } else if (labour?.checkOut) {
        await updateCheckOutTime(labourId, { date: selectedDate, time });
      }
      await fetchData(true);
    } catch (err) {
      console.error('Error saving check-out time:', err);
      alert('Failed to save check-out time. Please try again.');
    }
  };

  const getInitials = (name) => {
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'Present': return 'bg-[#10B981]';
      case 'informed leave':
      case 'uninformed leave':
      case 'leave':
      case 'voluntary leave':
      case 'normal absent':
      case 'Absent': return 'bg-red-500';
      case 'Half Day': return 'bg-orange-500';
      default: return 'bg-gray-400';
    }
  };

  const filteredLabours = labours.filter(labour =>
    labour.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    labour.labourId.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="p-4 sm:p-6 lg:p-8">

      {/* Tabs */}
      <div className="flex flex-wrap gap-2 mb-6">
        <button
          onClick={() => handleTabChange('labourList')}
          className={`px-6 py-2.5 rounded-lg font-medium text-sm transition-colors ${activeTab === 'labourList'
            ? 'bg-[#10B981] text-white'
            : 'bg-[#D4F4E8] text-[#0D5C4D] hover:bg-[#B8F4D8]'
            }`}
        >
          Labour List
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
        <button
          onClick={() => handleTabChange('excessPay')}
          className={`px-6 py-2.5 rounded-lg font-medium text-sm transition-colors ${activeTab === 'excessPay'
            ? 'bg-[#10B981] text-white'
            : 'bg-[#D4F4E8] text-[#0D5C4D] hover:bg-[#B8F4D8]'
            }`}
        >
          Excess Pay
        </button>
        <button
          onClick={() => handleTabChange('dailyPayout')}
          className={`px-6 py-2.5 rounded-lg font-medium text-sm transition-colors ${activeTab === 'dailyPayout'
            ? 'bg-[#10B981] text-white'
            : 'bg-[#D4F4E8] text-[#0D5C4D] hover:bg-[#B8F4D8]'
            }`}
        >
          Labour Daily Payout
        </button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6 mb-6">
        <div className="bg-gradient-to-r from-[#D1FAE5] to-[#A7F3D0] rounded-2xl p-6 text-[#0D5C4D]">
          <div className="text-sm font-medium mb-2 opacity-90">Total Registered</div>
          <div className="text-3xl sm:text-4xl font-bold">{stats.totalRegistered}</div>
        </div>
        <div className="bg-gradient-to-r from-[#6EE7B7] to-[#34D399] rounded-2xl p-6 text-[#0D5C4D]">
          <div className="text-sm font-medium mb-2 opacity-90">Present</div>
          <div className="text-3xl sm:text-4xl font-bold">{stats.present}</div>
        </div>
        <div className="bg-gradient-to-r from-[#6EE7B7] to-[#34D399] rounded-2xl p-6 text-[#0D5C4D]">
          <div className="text-sm font-medium mb-2 opacity-90">Absent</div>
          <div className="text-3xl sm:text-4xl font-bold">{stats.absent}</div>
        </div>
        <div className="bg-gradient-to-r from-[#047857] to-[#065F46] rounded-2xl p-6 text-white">
          <div className="text-sm font-medium mb-2 opacity-90">Not Marked Yet</div>
          <div className="text-3xl sm:text-4xl font-bold">{stats.notMarked}</div>
        </div>
      </div>

      {/* Filters and Search */}
      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        {/* Search Bar */}
        <div className="relative flex-1">
          <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-[#6B8782]" size={20} />
          <input
            type="text"
            placeholder="Search labour..."
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
            <option value="Absent">Absent</option>
            <option value="Present">Present</option>
          </select>
          <ChevronDown className="absolute right-3 top-1/2 transform -translate-y-1/2 text-[#6B8782] pointer-events-none" size={16} />
        </div>

        {/* Date Select (today or future) */}
        <div className="flex items-center gap-2 min-w-[160px]">
          <Calendar size={16} className="text-[#6B8782] flex-shrink-0" />
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
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
                <th className="px-4 sm:px-6 py-4 text-left text-xs sm:text-sm font-semibold text-[#0D5C4D]">LABOUR INFO</th>
                <th className="px-4 sm:px-6 py-4 text-left text-xs sm:text-sm font-semibold text-[#0D5C4D]">CHECK-IN TIME</th>
                <th className="px-4 sm:px-6 py-4 text-left text-xs sm:text-sm font-semibold text-[#0D5C4D]">CHECK-OUT TIME</th>
                <th className="px-4 sm:px-6 py-4 text-left text-xs sm:text-sm font-semibold text-[#0D5C4D]">STATUS</th>
                <th className="px-4 sm:px-6 py-4 text-left text-xs sm:text-sm font-semibold text-[#0D5C4D]">ACTION</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan="5" className="px-6 py-8 text-center text-[#6B8782]">
                    Loading...
                  </td>
                </tr>
              ) : filteredLabours.length === 0 ? (
                <tr>
                  <td colSpan="5" className="px-6 py-8 text-center text-[#6B8782]">
                    No labours found
                  </td>
                </tr>
              ) : filteredLabours.map((labour, index) => (
                <tr
                  key={labour.id}
                  className={`border-b border-[#D0E0DB] hover:bg-[#F0F4F3] transition-colors ${index % 2 === 0 ? 'bg-white' : 'bg-[#F0F4F3]/30'
                    }`}
                >
                  <td className="px-4 sm:px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-teal-700 flex items-center justify-center text-white font-semibold text-sm flex-shrink-0">
                        {getInitials(labour.name)}
                      </div>
                      <div>
                        <div className="text-sm font-semibold text-[#0D5C4D]">{labour.name}</div>
                        <div className="text-xs text-[#6B8782]">{labour.labourId} • {labour.phone}</div>
                      </div>
                    </div>
                  </td>

                  <td className="px-4 sm:px-6 py-4">
                    <div className="flex items-center gap-2">
                      <input
                        type="time"
                        value={labour.checkIn || ''}
                        onFocus={() => fillCurrentTime(labour.id, 'checkIn')}
                        onChange={(e) => updateLabourTime(labour.id, 'checkIn', e.target.value)}
                        className={`w-24 px-2 py-1 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#0D7C66] ${labour.checkIn ? 'text-[#10B981] border-[#10B981]/50' : 'text-[#6B8782] border-[#D0E0DB]'}`}
                      />
                      <button
                        type="button"
                        onClick={() => handleSaveCheckIn(labour.id)}
                        disabled={ABSENT_STATUSES.includes(labour.status) || !!labour.checkOut}
                        className={`px-2 py-1 rounded text-xs font-medium ${!(ABSENT_STATUSES.includes(labour.status) || labour.checkOut) ? 'bg-[#0D7C66] text-white hover:bg-[#0a6354]' : 'bg-gray-200 text-gray-400 cursor-not-allowed'}`}
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
                        value={labour.checkOut || ''}
                        onFocus={() => fillCurrentTime(labour.id, 'checkOut')}
                        onChange={(e) => updateLabourTime(labour.id, 'checkOut', e.target.value)}
                        className={`w-24 px-2 py-1 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#0D7C66] ${labour.checkOut ? 'text-red-600 border-red-300' : 'text-[#6B8782] border-[#D0E0DB]'}`}
                      />
                      <button
                        type="button"
                        onClick={() => handleSaveCheckOut(labour.id)}
                        disabled={!labour.checkIn}
                        className={`px-2 py-1 rounded text-xs font-medium ${labour.checkIn ? 'bg-[#0D7C66] text-white hover:bg-[#0a6354]' : 'bg-gray-200 text-gray-400 cursor-not-allowed'}`}
                        title="Save check-out time"
                      >
                        ✓
                      </button>
                    </div>
                  </td>

                  <td className="px-4 sm:px-6 py-4">
                    <span className={`px-3 py-1.5 rounded-full text-xs font-medium flex items-center gap-1.5 w-fit text-white ${getStatusColor(labour.status)}`}>
                      <div className="w-2 h-2 rounded-full bg-white"></div>
                      {labour.status}
                    </span>
                  </td>

                  <td className="px-4 sm:px-6 py-4">
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleAction('markPresent', labour.id)}
                        disabled={labour.status === 'Present' || ABSENT_STATUSES.includes(labour.status) || !!labour.checkOut}
                        className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${labour.status === 'Present' || ABSENT_STATUSES.includes(labour.status) || !!labour.checkOut
                          ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                          : 'bg-[#10B981] hover:bg-[#059669] text-white'
                          }`}
                      >
                        Present
                      </button>
                      <button
                        onClick={() => handleAction('checkout', labour.id)}
                        disabled={!labour.checkIn || labour.checkOut}
                        className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${!labour.checkIn || labour.checkOut
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
                              handleAction('markAbsent', labour.id, e.target.value);
                              e.target.value = ""; // Reset dropdown after selection
                            }
                          }}
                          disabled={labour.status === 'Present' || ABSENT_STATUSES.includes(labour.status) || !!labour.checkOut}
                          className={`appearance-none px-3 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer min-w-[100px] pr-8 ${labour.status === 'Present' || ABSENT_STATUSES.includes(labour.status) || !!labour.checkOut
                            ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                            : 'bg-orange-500 hover:bg-orange-600 text-white'
                            }`}
                          value=""
                        >
                          <option value="" disabled>Absent</option>
                          <option value="informed leave">Informed Leave</option>
                          <option value="leave">Leave</option>
                          <option value="normal absent">Normal Absent</option>
                          <option value="uninformed leave">Uninformed Leave</option>
                          <option value="voluntary leave">Voluntary Leave</option>
                        </select>
                        <ChevronDown className={`absolute right-2 top-1/2 transform -translate-y-1/2 pointer-events-none ${labour.status === 'Present' || ABSENT_STATUSES.includes(labour.status) || !!labour.checkOut
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
            Showing {filteredLabours.length} of {labours.length} labours
          </div>
        </div>
      </div>
    </div>
  );
};

export default LabourAttendance;