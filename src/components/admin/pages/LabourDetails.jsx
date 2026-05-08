import React, { useState, useEffect } from 'react';
import { Phone, Mail, MapPin, TrendingUp, Package, ArrowLeft, User, Calendar, Clock } from 'lucide-react';
import { useNavigate, useParams } from 'react-router-dom';
import { getLabourById } from '../../../api/labourApi';
import { BASE_URL } from '../../../config/config';

const getStatusMeta = (status) => {
  const raw = String(status || '').trim().toLowerCase();
  if (raw === 'live' || raw === 'active' || raw === 'present') {
    return { text: 'Live', className: 'bg-green-50 text-green-700 border-green-200', dot: 'bg-green-500' };
  }
  if (raw === 'terminated') {
    return { text: 'Terminated', className: 'bg-red-50 text-red-700 border-red-200', dot: 'bg-red-500' };
  }
  if (raw === 'relieved' || raw === 'relived' || raw === 'inactive' || raw === 'absent') {
    return { text: 'Relieved', className: 'bg-orange-50 text-orange-700 border-orange-200', dot: 'bg-orange-500' };
  }
  return { text: status || 'Unknown', className: 'bg-orange-50 text-orange-700 border-orange-200', dot: 'bg-orange-500' };
};

const LabourDetails = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const [labour, setLabour] = useState(null);
  const [loading, setLoading] = useState(true);

  const handleBackClick = () => {
    navigate('/labour');
  };

  useEffect(() => {
    const fetchLabour = async () => {
      try {
        setLoading(true);
        const response = await getLabourById(id);
        const data = response.data;
        setLabour({
          id: data.labour_id,
          name: data.full_name,
          phone: data.mobile_number,
          aadhaarNumber: data.aadhaar_number,
          dateOfBirth: data.date_of_birth,
          gender: data.gender,
          bloodGroup: data.blood_group,
          address: data.address,
          workType: data.work_type,
          department: data.department,
          joiningDate: data.joining_date,
          status: data.status,
          profileImage: data.profile_image
        });
      } catch (error) {
        console.error('Error fetching labour:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchLabour();
  }, [id]);

  if (!labour) {
    return (
      <div className="min-h-screen bg-gray-50 p-4 md:p-6 lg:p-8 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-teal-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading labour details...</p>
        </div>
      </div>
    );
  }
  const statusMeta = getStatusMeta(labour?.status);

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-6 lg:p-8">
      {/* Header Section with Back Button */}
      <div className="mb-6">
        <div className="flex items-center gap-4 mb-4">
          <button
            onClick={handleBackClick}
            className="flex items-center gap-2 px-4 py-2 text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
            <span>Back to Labours</span>
          </button>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 overflow-x-auto">
          <button
            className="px-6 py-2.5 rounded-lg font-medium transition-all text-sm whitespace-nowrap bg-teal-600 text-white shadow-md"
          >
            Labour Details
          </button>
          <button
            onClick={() => navigate(`/labour/${id}/daily-works`)}
            className="px-6 py-2.5 rounded-lg font-medium transition-all text-sm whitespace-nowrap bg-white text-gray-600 hover:bg-gray-50 border border-gray-200"
          >
            Daily Works
          </button>
          <button
            onClick={() => navigate(`/labour/${id}/daily-payout`)}
            className="px-6 py-2.5 rounded-lg font-medium transition-all text-sm whitespace-nowrap bg-white text-gray-600 hover:bg-gray-50 border border-gray-200"
          >
            Labour Daily Payout
          </button>
          <button
            onClick={() => navigate(`/labour/${id}/labour-remarks`)}
            className="px-6 py-2.5 rounded-lg font-medium transition-all text-sm whitespace-nowrap bg-white text-gray-600 hover:bg-gray-50 border border-gray-200"
          >
            Labour Remarks
          </button>
        </div>
      </div>

      {/* Labour Profile Card */}
      <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
        <div className="flex flex-col md:flex-row items-start md:items-center gap-6">
          {/* Avatar */}
          <div className="w-24 h-24 bg-teal-700 rounded-full flex items-center justify-center flex-shrink-0 overflow-hidden">
            {labour?.profileImage ? (
              <img
                src={`${BASE_URL}${labour.profileImage}`}
                alt={labour.name}
                className="w-full h-full object-cover"
                onError={(e) => {
                  e.target.style.display = 'none';
                  e.target.nextSibling.style.display = 'flex';
                }}
              />
            ) : null}
            <span className={`text-white text-3xl font-bold ${labour?.profileImage ? 'hidden' : ''}`}>{labour?.name?.substring(0, 2).toUpperCase() || 'LB'}</span>
          </div>

          {/* Labour Info */}
          <div className="flex-1">
            <h2 className="text-2xl font-bold text-gray-800 mb-2">{labour?.name || 'N/A'}</h2>
            <p className="text-gray-600 mb-2">Labour ID: {labour?.id || 'N/A'}</p>
          </div>

          {/* Status Badges */}
          <div className="flex flex-col gap-2">
            <span className="bg-teal-50 text-teal-700 px-4 py-1 rounded-full text-sm font-medium border border-teal-200">
              {labour?.department || 'Worker'}
            </span>
            <span className={`px-4 py-1 rounded-full text-sm font-medium border flex items-center gap-2 ${statusMeta.className}`}>
              <span className={`w-2 h-2 rounded-full ${statusMeta.dot}`}></span>
              {statusMeta.text}
            </span>
          </div>
        </div>
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {/* Personal Information */}
        <div className="bg-teal-50 rounded-lg shadow-sm p-6">
          <div className="flex items-center gap-2 mb-4">
            <User className="w-5 h-5 text-teal-600" />
            <h3 className="text-lg font-semibold text-gray-800">Personal Information</h3>
          </div>

          <div className="space-y-4">
            <div>
              <p className="text-xs font-medium text-gray-500 uppercase mb-1">Full Name</p>
              <p className="text-gray-800">{labour?.name || 'N/A'}</p>
            </div>

            <div>
              <p className="text-xs font-medium text-gray-500 uppercase mb-1">Mobile Number</p>
              <p className="text-gray-800">{labour?.phone || 'N/A'}</p>
            </div>

            <div>
              <p className="text-xs font-medium text-gray-500 uppercase mb-1">Aadhaar Number</p>
              <p className="text-gray-800">{labour?.aadhaarNumber || 'N/A'}</p>
            </div>

            <div>
              <p className="text-xs font-medium text-gray-500 uppercase mb-1">Date of Birth</p>
              <p className="text-gray-800">{labour?.dateOfBirth || 'N/A'}</p>
            </div>

            <div>
              <p className="text-xs font-medium text-gray-500 uppercase mb-1">Gender</p>
              <p className="text-gray-800">{labour?.gender || 'N/A'}</p>
            </div>

            <div>
              <p className="text-xs font-medium text-gray-500 uppercase mb-1">Blood Group</p>
              <p className="text-gray-800">{labour?.bloodGroup || 'N/A'}</p>
            </div>
          </div>
        </div>

        {/* Work Details */}
        <div className="bg-teal-50 rounded-lg shadow-sm p-6">
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp className="w-5 h-5 text-teal-600" />
            <h3 className="text-lg font-semibold text-gray-800">Work Details</h3>
          </div>

          <div className="space-y-4">
            <div>
              <p className="text-xs font-medium text-gray-500 uppercase mb-1">Work Type</p>
              <p className="text-gray-800">{labour?.workType || 'N/A'}</p>
            </div>

            <div>
              <p className="text-xs font-medium text-gray-500 uppercase mb-1">Department</p>
              <span className="bg-teal-100 text-teal-700 px-3 py-1 rounded-full text-sm font-medium">
                {labour?.department || 'N/A'}
              </span>
            </div>

            <div>
              <p className="text-xs font-medium text-gray-500 uppercase mb-1">Joining Date</p>
              <p className="text-gray-800">{labour?.joiningDate || 'N/A'}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Address Section */}
      <div className="bg-teal-50 rounded-lg shadow-sm p-6">
        <div className="flex items-center gap-2 mb-4">
          <MapPin className="w-5 h-5 text-red-500" />
          <h3 className="text-lg font-semibold text-gray-800">Address Details</h3>
        </div>

        <div>
          <p className="text-xs font-medium text-gray-500 uppercase mb-1">Full Address</p>
          <p className="text-gray-800">{labour?.address || 'N/A'}</p>
        </div>
      </div>
    </div>
  );
};

export default LabourDetails;