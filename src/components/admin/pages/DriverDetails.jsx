import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ChevronDown, ArrowLeft } from 'lucide-react';
import { getDriverById } from '../../../api/driverApi';

const DriverDetailsPage = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const [driverInfo, setDriverInfo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('details');

  useEffect(() => {
    const fetchDriver = async () => {
      try {
        setLoading(true);
        const response = await getDriverById(id);
        const driver = response.data || response;
        setDriverInfo({
          name: driver.driver_name || driver.name,
          id: driver.driver_id || driver.id,
          phone: driver.phone_number || driver.phone,
          email: driver.email,
          address: driver.address,
          city: driver.city,
          state: driver.state,
          pinCode: driver.pin_code,
          licenseNumber: driver.license_number,
          status: driver.status,
          profileImage: driver.driver_image,
          licenseImage: driver.license_image,
          idProofImage: driver.driver_id_proof,
          vehicle: {
            type: driver.vehicle_ownership,
            name: driver.available_vehicle,
            number: driver.vehicle_number,
            capacity: driver.capacity,
            condition: driver.vehicle_condition,
            insuranceNumber: driver.insurance_number,
            insuranceExpiry: driver.insurance_expiry_date,
            fitnessCertificate: driver.fitness_certificate,
            fitnessCertificateExpiry: driver.fitness_certificate_expiry_date,
            pollutionCert: driver.pollution_certificate,
            pollutionCertExpiry: driver.pollution_certificate_expiry_date,
            kaPermit: driver.ka_permit,
            kaPermitExpiry: driver.ka_permit_expiry_date
          },
          licenseExpiry: driver.license_expiry_date,
          deliveryType: driver.delivery_type,
          stats: {
            todayHours: driver.working_hours || '0',
            totalDeliveries: driver.total_deliveries || '0',
            rating: driver.rating || '0'
          }
        });
      } catch (err) {
        setError('Failed to load driver details');
      } finally {
        setLoading(false);
      }
    };
    if (id) fetchDriver();
  }, [id]);





  if (loading) return <div className="flex justify-center items-center h-screen">Loading...</div>;
  if (error) return <div className="flex justify-center items-center h-screen text-red-600">{error}</div>;
  if (!driverInfo) return null;

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-emerald-50 p-4 sm:p-6 lg:p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center gap-4 mb-6">
          <button
            onClick={() => navigate('/drivers')}
            className="flex items-center gap-2 text-[#0D5C4D] hover:text-[#0a6354] transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
            <span className="font-medium">Back to Driver Management</span>
          </button>
        </div>



        {/* Tabs */}
        <div className="flex gap-2 mb-6 overflow-x-auto">
          <button
            onClick={() => setActiveTab('details')}
            className={`px-6 py-2.5 rounded-lg font-medium transition-all text-sm whitespace-nowrap ${activeTab === 'details'
              ? 'bg-[#0D7C66] text-white shadow-md'
              : 'bg-white text-gray-600 hover:bg-gray-50 border border-gray-200'
              }`}
          >
            Driver Details
          </button>
          <button
            onClick={() => navigate(`/start-end-km-management?driverId=${id}`, { state: { driverId: id } })}
            className="px-6 py-2.5 rounded-lg font-medium transition-all text-sm whitespace-nowrap bg-white text-gray-600 hover:bg-gray-50 border border-gray-200"
          >
            Start KM/End KM
          </button>
          <button
            onClick={() => navigate(`/drivers/${id}/local-pickups`)}
            className="px-6 py-2.5 rounded-lg font-medium transition-all text-sm whitespace-nowrap bg-white text-gray-600 hover:bg-gray-50 border border-gray-200"
          >
            LOCAL GRADE ORDER
          </button>
          <button
            onClick={() => navigate(`/drivers/${id}/airport`)}
            className="px-6 py-2.5 rounded-lg font-medium transition-all text-sm bg-white text-gray-600 hover:bg-gray-50 border border-gray-200 whitespace-nowrap"
          >
            BOX ORDER
          </button>
          <button
            onClick={() => navigate(`/drivers/${id}/flower-orders`)}
            className="px-6 py-2.5 rounded-lg font-medium transition-all text-sm bg-white text-gray-600 hover:bg-gray-50 border border-gray-200 whitespace-nowrap"
          >
            FLOWER ORDER
          </button>
          <button
            onClick={() => navigate('/fuel-expense-management', { state: { driverId: id } })}
            className="px-6 py-2.5 rounded-lg font-medium transition-all text-sm bg-white text-gray-600 hover:bg-gray-50 border border-gray-200 whitespace-nowrap"
          >
            Fuel Expenses
          </button>
          <button
            onClick={() => navigate('/advance-pay-management', { state: { driverId: id } })}
            className="px-6 py-2.5 rounded-lg font-medium transition-all text-sm bg-white text-gray-600 hover:bg-gray-50 border border-gray-200 whitespace-nowrap"
          >
            Advance Pay
          </button>
          <button
            onClick={() => navigate('/remarks-management')}
            className="px-6 py-2.5 rounded-lg font-medium transition-all text-sm bg-white text-gray-600 hover:bg-gray-50 border border-gray-200 whitespace-nowrap"
          >
            Remarks
          </button>
          <button
            onClick={() => navigate(`/drivers/${id}/daily-payout`)}
            className="px-6 py-2.5 rounded-lg font-medium transition-all text-sm bg-white text-gray-600 hover:bg-gray-50 border border-gray-200 whitespace-nowrap"
          >
            Daily Payout
          </button>
        </div>

        {/* Content Area */}
        {activeTab === 'details' && (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6 sm:p-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-6">Driver Information</h2>

            {/* Personal Information */}
            <div className="mb-8">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Personal Information</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div>
                  <label className="block text-sm text-gray-500 mb-1">Driver Name</label>
                  <div className="text-sm font-medium text-gray-900">{driverInfo.name}</div>
                </div>
                <div>
                  <label className="block text-sm text-gray-500 mb-1">Phone Number</label>
                  <div className="text-sm font-medium text-gray-900">{driverInfo.phone}</div>
                </div>
                <div>
                  <label className="block text-sm text-gray-500 mb-1">Email Address</label>
                  <div className="text-sm font-medium text-gray-900">{driverInfo.email}</div>
                </div>
                <div>
                  <label className="block text-sm text-gray-500 mb-1">Address</label>
                  <div className="text-sm font-medium text-gray-900">{driverInfo.address || 'N/A'}</div>
                </div>
                <div>
                  <label className="block text-sm text-gray-500 mb-1">City</label>
                  <div className="text-sm font-medium text-gray-900">{driverInfo.city || 'N/A'}</div>
                </div>
                <div>
                  <label className="block text-sm text-gray-500 mb-1">State</label>
                  <div className="text-sm font-medium text-gray-900">{driverInfo.state || 'N/A'}</div>
                </div>
                <div>
                  <label className="block text-sm text-gray-500 mb-1">Pin Code</label>
                  <div className="text-sm font-medium text-gray-900">{driverInfo.pinCode || 'N/A'}</div>
                </div>
                <div>
                  <label className="block text-sm text-gray-500 mb-1">License Number</label>
                  <div className="text-sm font-medium text-gray-900">{driverInfo.licenseNumber || 'N/A'}</div>
                </div>
                <div>
                  <label className="block text-sm text-gray-500 mb-1">License Expiry Date</label>
                  <div className="text-sm font-medium text-gray-900">{driverInfo.licenseExpiry || 'N/A'}</div>
                </div>
                <div>
                  <label className="block text-sm text-gray-500 mb-1">Status</label>
                  <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium ${driverInfo.status === 'Available' ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'
                    }`}>
                    <span className={`w-2 h-2 rounded-full ${driverInfo.status === 'Available' ? 'bg-emerald-500' : 'bg-red-500'
                      }`}></span>
                    {driverInfo.status}
                  </span>
                </div>
              </div>
            </div>

            {/* Document Images */}
            <div className="mb-8">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Document Images</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* Profile Image */}
                <div>
                  <label className="block text-sm text-gray-500 mb-2">Profile Image</label>
                  <div className="flex items-center gap-4">
                    {driverInfo.profileImage ? (
                      <img
                        src={`${import.meta.env.VITE_API_BASE_URL.replace('/api/v1', '')}${driverInfo.profileImage}`}
                        alt="Profile"
                        className="w-16 h-16 rounded-full object-cover"
                        onError={(e) => {
                          e.target.style.display = 'none';
                          e.target.nextSibling.style.display = 'flex';
                        }}
                      />
                    ) : null}
                    <div className="w-16 h-16 bg-teal-700 rounded-full flex items-center justify-center text-white text-xl font-bold flex-shrink-0" style={{ display: driverInfo.profileImage ? 'none' : 'flex' }}>
                      {driverInfo.name.split(' ').map(n => n[0]).join('').toUpperCase()}
                    </div>
                  </div>
                </div>

                {/* License Image */}
                <div>
                  <label className="block text-sm text-gray-500 mb-2">License Image</label>
                  <div className="flex items-center gap-4">
                    {driverInfo.licenseImage ? (
                      <img
                        src={`${import.meta.env.VITE_API_BASE_URL.replace('/api/v1', '')}${driverInfo.licenseImage}`}
                        alt="License"
                        className="w-16 h-16 rounded-lg object-cover"
                        onError={(e) => {
                          e.target.style.display = 'none';
                          e.target.nextSibling.style.display = 'flex';
                        }}
                      />
                    ) : null}
                    <div className="w-16 h-16 bg-gray-100 rounded-lg flex items-center justify-center border border-gray-300" style={{ display: driverInfo.licenseImage ? 'none' : 'flex' }}>
                      <span className="text-xs text-gray-500">License</span>
                    </div>
                  </div>
                </div>

                {/* ID Proof Image */}
                <div>
                  <label className="block text-sm text-gray-500 mb-2">ID Proof Image</label>
                  <div className="flex items-center gap-4">
                    {driverInfo.idProofImage ? (
                      <img
                        src={`${import.meta.env.VITE_API_BASE_URL.replace('/api/v1', '')}${driverInfo.idProofImage}`}
                        alt="ID Proof"
                        className="w-16 h-16 rounded-lg object-cover"
                        onError={(e) => {
                          e.target.style.display = 'none';
                          e.target.nextSibling.style.display = 'flex';
                        }}
                      />
                    ) : null}
                    <div className="w-16 h-16 bg-gray-100 rounded-lg flex items-center justify-center border border-gray-300" style={{ display: driverInfo.idProofImage ? 'none' : 'flex' }}>
                      <span className="text-xs text-gray-500">ID Proof</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Vehicle Information */}
            <div className="mb-8">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Vehicle Information</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div>
                  <label className="block text-sm text-gray-500 mb-1">Vehicle Type</label>
                  <div className="text-sm font-medium text-gray-900">{driverInfo.vehicle.type || 'N/A'}</div>
                </div>
                <div>
                  <label className="block text-sm text-gray-500 mb-1">Available Vehicle</label>
                  <div className="text-sm font-medium text-gray-900">{driverInfo.vehicle.name || 'N/A'}</div>
                </div>
                <div>
                  <label className="block text-sm text-gray-500 mb-1">Vehicle Number</label>
                  <div className="text-sm font-medium text-gray-900">{driverInfo.vehicle.number || 'N/A'}</div>
                </div>
                <div>
                  <label className="block text-sm text-gray-500 mb-1">Capacity (Tons)</label>
                  <div className="text-sm font-medium text-gray-900">{driverInfo.vehicle.capacity || 'N/A'}</div>
                </div>
                <div>
                  <label className="block text-sm text-gray-500 mb-1">Insurance Number</label>
                  <div className="text-sm font-medium text-gray-900">{driverInfo.vehicle.insuranceNumber || 'N/A'}</div>
                </div>
                <div>
                  <label className="block text-sm text-gray-500 mb-1">Insurance Expiry Date</label>
                  <div className="text-sm font-medium text-gray-900">{driverInfo.vehicle.insuranceExpiry || 'N/A'}</div>
                </div>
                <div>
                  <label className="block text-sm text-gray-500 mb-1">Vehicle Condition</label>
                  <div className="text-sm font-medium text-gray-900">{driverInfo.vehicle.condition || 'N/A'}</div>
                </div>
                <div>
                  <label className="block text-sm text-gray-500 mb-1">Fitness Certificate</label>
                  <div className="text-sm font-medium text-gray-900">{driverInfo.vehicle.fitnessCertificate || 'N/A'}</div>
                </div>
                <div>
                  <label className="block text-sm text-gray-500 mb-1">Fitness Certificate Expiry</label>
                  <div className="text-sm font-medium text-gray-900">{driverInfo.vehicle.fitnessCertificateExpiry || 'N/A'}</div>
                </div>
                <div>
                  <label className="block text-sm text-gray-500 mb-1">Pollution Certificate</label>
                  <div className="text-sm font-medium text-gray-900">{driverInfo.vehicle.pollutionCert || 'N/A'}</div>
                </div>
                <div>
                  <label className="block text-sm text-gray-500 mb-1">Pollution Certificate Expiry</label>
                  <div className="text-sm font-medium text-gray-900">{driverInfo.vehicle.pollutionCertExpiry || 'N/A'}</div>
                </div>
                <div>
                  <label className="block text-sm text-gray-500 mb-1">KA Permit</label>
                  <div className="text-sm font-medium text-gray-900">{driverInfo.vehicle.kaPermit || 'N/A'}</div>
                </div>
                <div>
                  <label className="block text-sm text-gray-500 mb-1">KA Permit Expiry Date</label>
                  <div className="text-sm font-medium text-gray-900">{driverInfo.vehicle.kaPermitExpiry || 'N/A'}</div>
                </div>
              </div>
            </div>

            {/* Statistics */}
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Statistics</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div>
                  <label className="block text-sm text-gray-500 mb-1">Today's Hours</label>
                  <div className="text-sm font-medium text-gray-900">{driverInfo.stats.todayHours}</div>
                </div>
                <div>
                  <label className="block text-sm text-gray-500 mb-1">Total Deliveries</label>
                  <div className="text-sm font-medium text-gray-900">{driverInfo.stats.totalDeliveries}</div>
                </div>
                <div>
                  <label className="block text-sm text-gray-500 mb-1">Delivery Type</label>
                  <div className="text-sm font-medium text-gray-900">{driverInfo.deliveryType || 'N/A'}</div>
                </div>
              </div>
            </div>
          </div>
        )}

      </div>
    </div >
  );
};

export default DriverDetailsPage;