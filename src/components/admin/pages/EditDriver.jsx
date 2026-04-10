import React, { useState, useEffect } from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { Upload, Eye, EyeOff, ChevronRight, ArrowLeft } from 'lucide-react';
import { getDriverById, updateDriver } from '../../../api/driverApi';
import { createNotification } from '../../../api/notificationApi';

const normalizePhoneWithCountryCode = (value) => {
  const raw = String(value ?? '').trim();
  if (!raw) return '';
  if (raw.startsWith('+')) return raw;
  const digits = raw.replace(/\D/g, '');
  if (digits.length === 10) return `+91 ${digits}`;
  return raw;
};

const EXPIRY_REMINDER_DAYS = 30;

const toYMD = (value) => {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  return d.toISOString().slice(0, 10);
};

const daysUntil = (value) => {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  d.setHours(0, 0, 0, 0);
  return Math.ceil((d - now) / (1000 * 60 * 60 * 24));
};

const EditDriver = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const location = useLocation();
  const returnTo = location.state?.returnTo;
  const returnPage = location.state?.returnPage || 1;
  const backPath = returnTo === 'drivers' ? `/drivers${returnPage > 1 ? `?page=${returnPage}` : ''}` : '/drivers';
  const [formData, setFormData] = useState({
    driver_id: '',
    driver_name: '',
    phone_number: '',
    email: '',
    address: '',
    city: '',
    state: '',
    pin_code: '',
    password: '',
    license_number: '',
    vehicle_ownership: '',
    available_vehicle: '',
    vehicle_type: '',
    vehicle_number: '',
    capacity: '',
    insurance_number: '',
    insurance_expiry_date: '',
    fitness_certificate_doc: '',
    fitness_certificate: '',
    fitness_certificate_expiry_date: '',
    vehicle_condition: 'Good',
    pollution_certificate: '',
    ka_permit: '',
    account_holder_name: '',
    bank_name: '',
    branch_name: '',
    account_number: '',
    IFSC_code: '',
    delivery_type: 'Local Pickups',
    status: 'Available'
  });
  
  const [showPassword, setShowPassword] = useState(false);
  const [profileImage, setProfileImage] = useState(null);
  const [profileImagePreview, setProfileImagePreview] = useState(null);
  const [driverImage, setDriverImage] = useState(null);
  const [driverImagePreview, setDriverImagePreview] = useState(null);
  const [driverIdProof, setDriverIdProof] = useState(null);
  const [driverIdProofPreview, setDriverIdProofPreview] = useState(null);
  const [insuranceDoc, setInsuranceDoc] = useState(null);
  const [insuranceDocPreview, setInsuranceDocPreview] = useState(null);
  const [fitnessCertificateDoc, setFitnessCertificateDoc] = useState(null);
  const [fitnessCertificateDocPreview, setFitnessCertificateDocPreview] = useState(null);
  const [pollutionDoc, setPollutionDoc] = useState(null);
  const [pollutionDocPreview, setPollutionDocPreview] = useState(null);
  const [kaPermitDoc, setKaPermitDoc] = useState(null);
  const [kaPermitDocPreview, setKaPermitDocPreview] = useState(null);
  const [vehicleTypes] = useState([
    'tata-ace',
    'mahindra-bolero', 
    'ashok-leyland',
    'eicher-pro',
    'tata-407'
  ]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const createExpiryNotifications = async () => {
    const vehicleNumber = (formData.vehicle_number || 'N/A').trim();
    const docs = [
      { label: 'Insurance', date: formData.insurance_expiry_date },
      { label: 'Fitness Certificate', date: formData.fitness_certificate_expiry_date },
      { label: 'Pollution Certificate', date: formData.pollution_certificate_expiry_date },
      { label: 'Other State Permit', date: formData.ka_permit_expiry_date }
    ];

    for (const doc of docs) {
      const ymd = toYMD(doc.date);
      if (!ymd) continue;
      const remaining = daysUntil(ymd);
      if (remaining == null || remaining > EXPIRY_REMINDER_DAYS) continue;
      const isOverdue = remaining < 0;
      const absDays = Math.abs(remaining);
      const timingText = isOverdue
        ? `expired ${absDays} day${absDays === 1 ? '' : 's'} ago`
        : `expires in ${remaining} day${remaining === 1 ? '' : 's'}`;

      try {
        await createNotification({
          title: `${doc.label} renewal reminder - ${vehicleNumber}`,
          message: `${doc.label} for vehicle ${vehicleNumber} (${formData.driver_name || 'Driver'}) ${timingText}. Due date: ${ymd}.`,
          type: isOverdue ? 'error' : 'warning',
          category: 'Drivers'
        });
      } catch (notifyError) {
        console.error(`Failed to create ${doc.label} reminder notification:`, notifyError);
      }
    }
  };

  useEffect(() => {
    const fetchDriverData = async () => {
      try {
        setLoading(true);
        setError(null);
        // console.log('Fetching driver with ID:', id);
        
        if (!id) {
          throw new Error('No driver ID provided');
        }
        
        // Log the actual ID being used
        // console.log('Actual driver ID being fetched:', id);
        
        const response = await getDriverById(id);
        // console.log('API Response:', response);
        
        // Handle different response structures
        const driver = response.data || response;
        
        // Check if we got valid driver data
        if (!driver || (typeof driver === 'object' && Object.keys(driver).length === 0)) {
          throw new Error('No driver data found');
        }
        
        // Map API response to form data structure with comprehensive field mapping
        setFormData({
          driver_id: driver.driver_id || driver.id || driver.did || driver._id || id || '',
          driver_name: driver.driver_name || driver.name || '',
          phone_number: normalizePhoneWithCountryCode(driver.phone_number || driver.phone || ''),
          email: driver.email || '',
          address: driver.address || '',
          city: driver.city || '',
          state: driver.state || '',
          pin_code: driver.pin_code || driver.pincode || '',
          password: '',
          license_number: driver.license_number || driver.license || '',
          license_expiry_date: driver.license_expiry_date || '',
          vehicle_ownership: driver.vehicle_type || driver.vehicle_ownership || '',
          available_vehicle: driver.available_vehicle || driver.vehicle_type || driver.vehicleType || '',
          vehicle_type: driver.vehicle_type || driver.vehicleType || '',
          vehicle_number: driver.vehicle_number || driver.vehicleNumber || '',
          capacity: driver.capacity || '',
          insurance_number: driver.insurance_number || driver.insuranceNumber || '',
          insurance_expiry_date: driver.insurance_expiry_date || driver.insuranceExpiryDate || '',
          fitness_certificate_doc: driver.fitness_certificate_doc || '',
          fitness_certificate: driver.fitness_certificate || driver.fitnessCertificate || '',
          fitness_certificate_expiry_date: driver.fitness_certificate_expiry_date || '',
          vehicle_condition: driver.vehicle_condition || driver.vehicleCondition || 'Good',
          pollution_certificate: driver.pollution_certificate || driver.pollutionCertificate || '',
          pollution_certificate_expiry_date: driver.pollution_certificate_expiry_date || '',
          ka_permit: driver.ka_permit || driver.kaPermit || '',
          ka_permit_expiry_date: driver.ka_permit_expiry_date || '',
          account_holder_name: driver.account_holder_name || '',
          bank_name: driver.bank_name || '',
          branch_name: driver.branch_name || '',
          account_number: driver.account_number || '',
          IFSC_code: driver.IFSC_code || driver.ifsc_code || '',
          delivery_type: driver.delivery_type || driver.deliveryType || 'LOCAL GRADE ORDER',
          status: driver.status || 'Available',
          driver_image: driver.driver_image || '',
          license_image: driver.license_image || '',
          driver_id_proof: driver.driver_id_proof || ''
        });
      } catch (error) {
        console.error('Error fetching driver data:', error);
        setError(error.message || 'Failed to load driver data. Please try again.');
        // If it's a 404 error, provide more specific guidance
        if (error.message && error.message.includes('404')) {
          setError(`Driver with ID "${id}" not found. This may be due to an ID format mismatch between frontend and backend.`);
        }
      } finally {
        setLoading(false);
      }
    };

    if (id) {
      fetchDriverData();
    } else {
      // If no ID provided, redirect to drivers list
      navigate(backPath);
    }
  }, [id, navigate]);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleFileUpload = (type, event) => {
    const file = event.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        if (type === 'profile') {
          setProfileImage(file);
          setProfileImagePreview(reader.result);
        } else if (type === 'driver_image') {
          setDriverImage(file);
          setDriverImagePreview(reader.result);
        } else if (type === 'driver_id_proof') {
          setDriverIdProof(file);
          setDriverIdProofPreview(reader.result);
        } else if (type === 'insurance') {
          setInsuranceDoc(file);
          setInsuranceDocPreview(reader.result);
        } else if (type === 'fitnessCertificate') {
          setFitnessCertificateDoc(file);
          setFitnessCertificateDocPreview(reader.result);
        } else if (type === 'pollution') {
          setPollutionDoc(file);
          setPollutionDocPreview(reader.result);
        } else if (type === 'kaPermit') {
          setKaPermitDoc(file);
          setKaPermitDocPreview(reader.result);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const formDataToSend = new FormData();
      
      Object.keys(formData).forEach(key => {
        if (formData[key] && (key !== 'password' || formData[key])) {
          formDataToSend.append(key, formData[key]);
        }
      });
      
      if (profileImage) formDataToSend.append('driver_image', profileImage);
      if (driverImage) formDataToSend.append('license_image', driverImage);
      if (driverIdProof) formDataToSend.append('driver_id_proof', driverIdProof);
      if (insuranceDoc) formDataToSend.append('insurance_doc', insuranceDoc);
      if (fitnessCertificateDoc) formDataToSend.append('fitness_certificate_doc', fitnessCertificateDoc);
      if (pollutionDoc) formDataToSend.append('pollution_doc', pollutionDoc);
      if (kaPermitDoc) formDataToSend.append('ka_permit_doc', kaPermitDoc);
      
      await updateDriver(id, formDataToSend);
      await createExpiryNotifications();
      navigate(backPath);
    } catch (error) {
      console.error('Error updating driver:', error);
      setError(error.message || 'Failed to update driver. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-emerald-50 p-4 sm:p-6 lg:p-8">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex items-center gap-4 mb-6">
          <button
            onClick={() => navigate(backPath)}
            className="flex items-center gap-2 text-gray-600 hover:text-gray-800 transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
            <span className="font-medium">Back to Driver Management</span>
          </button>
        </div>

        {loading ? (
          <div className="flex justify-center items-center h-64">
            <div className="text-lg text-gray-600">Loading driver data...</div>
          </div>
        ) : error ? (
          <div className="bg-red-50 border border-red-200 rounded-lg p-6 mb-6">
            <div className="text-red-700 font-medium">{error}</div>
            <button
              onClick={() => navigate(backPath)}
              className="mt-4 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
            >
              Back to Drivers
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6 sm:p-8">
            
            {/* Error message */}
            {error && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
                <div className="text-red-700">{error}</div>
              </div>
            )}
            
            {/* Personal Information Section */}
            <div className="mb-8">
              <h2 className="text-xl font-bold text-gray-900 mb-6">Personal Information</h2>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
                {/* Driver Name */}
                <div>
                  <label className="block text-sm text-gray-700 mb-2">
                    Driver Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    name="driver_name"
                    value={formData.driver_name}
                    onChange={handleInputChange}
                    placeholder="Enter driver full name"
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent text-sm"
                    required
                  />
                </div>

                {/* Phone Number */}
                <div>
                  <label className="block text-sm text-gray-700 mb-2">
                    Phone Number <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="tel"
                    name="phone_number"
                    value={formData.phone_number}
                    onChange={handleInputChange}
                    placeholder="+91"
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent text-sm"
                    required
                  />
                </div>

                {/* Email Address */}
                <div>
                  <label className="block text-sm text-gray-700 mb-2">
                    Email Address
                  </label>
                  <input
                    type="email"
                    name="email"
                    value={formData.email}
                    onChange={handleInputChange}
                    placeholder="driver@email.com"
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent text-sm"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
                {/* Address */}
                <div>
                  <label className="block text-sm text-gray-700 mb-2">
                    Address
                  </label>
                  <input
                    type="text"
                    name="address"
                    value={formData.address}
                    onChange={handleInputChange}
                    placeholder="Enter complete address"
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent text-sm"
                  />
                </div>

                {/* City */}
                <div>
                  <label className="block text-sm text-gray-700 mb-2">
                    City
                  </label>
                  <input
                    type="text"
                    name="city"
                    value={formData.city}
                    onChange={handleInputChange}
                    placeholder="Enter city"
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent text-sm"
                  />
                </div>

                {/* State */}
                <div>
                  <label className="block text-sm text-gray-700 mb-2">
                    State
                  </label>
                  <input
                    type="text"
                    name="state"
                    value={formData.state}
                    onChange={handleInputChange}
                    placeholder="Enter state"
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent text-sm"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
                {/* Pin Code */}
                <div>
                  <label className="block text-sm text-gray-700 mb-2">
                    Pin Code
                  </label>
                  <input
                    type="text"
                    name="pin_code"
                    value={formData.pin_code}
                    onChange={handleInputChange}
                    placeholder="Enter pin code"
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent text-sm"
                  />
                </div>

                {/* Password */}
                <div>
                  <label className="block text-sm text-gray-700 mb-2">
                    Password
                  </label>
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      name="password"
                      value={formData.password}
                      onChange={handleInputChange}
                      placeholder="Enter Password"
                      className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent text-sm pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-500 hover:text-gray-700"
                    >
                      {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                    </button>
                  </div>
                </div>

                {/* License Number */}
                <div>
                  <label className="block text-sm text-gray-700 mb-2">
                    License Number <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    name="license_number"
                    value={formData.license_number}
                    onChange={handleInputChange}
                    placeholder="Enter license number"
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent text-sm"
                    required
                  />
                </div>
              </div>

              {/* File Uploads */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* Upload Profile Image */}
                <div>
                  <label className="block text-sm text-gray-700 mb-2">
                    Upload Profile Image
                  </label>
                  <div className="flex items-center gap-4">
                    <div className="relative">
                      <input
                        type="file"
                        id="profileUpload"
                        onChange={(e) => handleFileUpload('profile', e)}
                        accept=".jpg,.jpeg,.png,.gif"
                        className="hidden"
                      />
                      <label
                        htmlFor="profileUpload"
                        className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center cursor-pointer hover:bg-gray-200 transition-colors overflow-hidden"
                      >
                        {profileImagePreview ? (
                          <img src={profileImagePreview} alt="Profile" className="w-full h-full object-cover" />
                        ) : formData.driver_image ? (
                          <img 
                            src={`${import.meta.env.VITE_API_BASE_URL.replace('/api/v1', '')}${formData.driver_image}`}
                            alt="Profile"
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <Upload className="w-6 h-6 text-gray-600" />
                        )}
                      </label>
                    </div>
                    <div>
                      <button
                        type="button"
                        onClick={() => document.getElementById('profileUpload').click()}
                        className="px-6 py-2.5 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
                      >
                        Upload Image
                      </button>
                      {profileImage ? (
                        <p className="text-xs text-green-600 mt-2 font-medium">
                          ✓ {profileImage.name}
                        </p>
                      ) : (
                        <p className="text-xs text-gray-500 mt-2">
                          Upload profile image: JPG, PNG or GIF. Max 2MB.
                        </p>
                      )}
                    </div>
                  </div>
                </div>

                {/* Upload License Image */}
                <div>
                  <label className="block text-sm text-gray-700 mb-2">
                    Upload License Image
                  </label>
                  <div className="flex items-center gap-4">
                    <div className="relative">
                      <input
                        type="file"
                        id="licenseUpload"
                        onChange={(e) => handleFileUpload('driver_image', e)}
                        accept=".jpg,.jpeg,.png,.gif"
                        className="hidden"
                      />
                      <label
                        htmlFor="licenseUpload"
                        className="w-16 h-16 bg-gray-100 rounded-lg flex items-center justify-center cursor-pointer hover:bg-gray-200 transition-colors overflow-hidden"
                      >
                        {driverImagePreview ? (
                          <img src={driverImagePreview} alt="License" className="w-full h-full object-cover" />
                        ) : formData.license_image ? (
                          <img 
                            src={`${import.meta.env.VITE_API_BASE_URL.replace('/api/v1', '')}${formData.license_image}`}
                            alt="License"
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <Upload className="w-6 h-6 text-gray-600" />
                        )}
                      </label>
                    </div>
                    <div>
                      <button
                        type="button"
                        onClick={() => document.getElementById('licenseUpload').click()}
                        className="px-6 py-2.5 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
                      >
                        Upload File
                      </button>
                      {driverImage ? (
                        <p className="text-xs text-green-600 mt-2 font-medium">
                          ✓ {driverImage.name}
                        </p>
                      ) : (
                        <p className="text-xs text-gray-500 mt-2">
                          Upload a license image: JPG, PNG or GIF. Max 2MB.
                        </p>
                      )}
                    </div>
                  </div>
                </div>

                {/* Upload ID Proof */}
                <div>
                  <label className="block text-sm text-gray-700 mb-2">
                    Upload Id Proof
                  </label>
                  <div className="flex items-center gap-4">
                    <div className="relative">
                      <input
                        type="file"
                        id="idProofUpload"
                        onChange={(e) => handleFileUpload('driver_id_proof', e)}
                        accept=".jpg,.jpeg,.png,.gif"
                        className="hidden"
                      />
                      <label
                        htmlFor="idProofUpload"
                        className="w-16 h-16 bg-gray-100 rounded-lg flex items-center justify-center cursor-pointer hover:bg-gray-200 transition-colors overflow-hidden"
                      >
                        {driverIdProofPreview ? (
                          <img src={driverIdProofPreview} alt="ID Proof" className="w-full h-full object-cover" />
                        ) : formData.driver_id_proof ? (
                          <img 
                            src={`${import.meta.env.VITE_API_BASE_URL.replace('/api/v1', '')}${formData.driver_id_proof}`}
                            alt="ID Proof"
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <Upload className="w-6 h-6 text-gray-600" />
                        )}
                      </label>
                    </div>
                    <div>
                      <button
                        type="button"
                        onClick={() => document.getElementById('idProofUpload').click()}
                        className="px-6 py-2.5 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
                      >
                        Upload Image
                      </button>
                      {driverIdProof ? (
                        <p className="text-xs text-green-600 mt-2 font-medium">
                          ✓ {driverIdProof.name}
                        </p>
                      ) : (
                        <p className="text-xs text-gray-500 mt-2">
                          Upload an ID proof: JPG, PNG or GIF. Max 2MB.
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Additional Document Uploads */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-6">
                {/* Upload Insurance Document */}
                <div>
                  <label className="block text-sm text-gray-700 mb-2">
                    Upload Insurance Document
                  </label>
                  <div className="flex items-center gap-4">
                    <div className="relative">
                      <input
                        type="file"
                        id="insuranceDocUpload"
                        onChange={(e) => handleFileUpload('insurance', e)}
                        accept=".jpg,.jpeg,.png,.gif,.pdf"
                        className="hidden"
                      />
                      <label
                        htmlFor="insuranceDocUpload"
                        className="w-16 h-16 bg-gray-100 rounded-lg flex items-center justify-center cursor-pointer hover:bg-gray-200 transition-colors overflow-hidden"
                      >
                        {insuranceDocPreview ? (
                          <img src={insuranceDocPreview} alt="Insurance" className="w-full h-full object-cover" />
                        ) : formData.insurance_doc ? (
                          <img 
                            src={`${import.meta.env.VITE_API_BASE_URL.replace('/api/v1', '')}${formData.insurance_doc}`}
                            alt="Insurance"
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <Upload className="w-6 h-6 text-gray-600" />
                        )}
                      </label>
                    </div>
                    <div>
                      <button
                        type="button"
                        onClick={() => document.getElementById('insuranceDocUpload').click()}
                        className="px-6 py-2.5 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
                      >
                        Upload File
                      </button>
                      {insuranceDoc ? (
                        <p className="text-xs text-green-600 mt-2 font-medium">
                          ✓ {insuranceDoc.name}
                        </p>
                      ) : (
                        <p className="text-xs text-gray-500 mt-2">
                          Upload insurance doc: JPG, PNG, GIF or PDF. Max 5MB.
                        </p>
                      )}
                    </div>
                  </div>
                </div>

                {/* Upload Pollution Certificate Document */}
                <div>
                  <label className="block text-sm text-gray-700 mb-2">
                    Upload Fitness Certificate
                  </label>
                  <div className="flex items-center gap-4">
                    <div className="relative">
                      <input
                        type="file"
                        id="fitnessCertificateDocUpload"
                        onChange={(e) => handleFileUpload('fitnessCertificate', e)}
                        accept=".jpg,.jpeg,.png,.gif,.pdf"
                        className="hidden"
                      />
                      <label
                        htmlFor="fitnessCertificateDocUpload"
                        className="w-16 h-16 bg-gray-100 rounded-lg flex items-center justify-center cursor-pointer hover:bg-gray-200 transition-colors overflow-hidden"
                      >
                        {fitnessCertificateDocPreview ? (
                          <img src={fitnessCertificateDocPreview} alt="Fitness Certificate" className="w-full h-full object-cover" />
                        ) : formData.fitness_certificate_doc ? (
                          <img
                            src={`${import.meta.env.VITE_API_BASE_URL.replace('/api/v1', '')}${formData.fitness_certificate_doc}`}
                            alt="Fitness Certificate"
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <Upload className="w-6 h-6 text-gray-600" />
                        )}
                      </label>
                    </div>
                    <div>
                      <button
                        type="button"
                        onClick={() => document.getElementById('fitnessCertificateDocUpload').click()}
                        className="px-6 py-2.5 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
                      >
                        Upload File
                      </button>
                      {fitnessCertificateDoc ? (
                        <p className="text-xs text-green-600 mt-2 font-medium">
                          ✓ {fitnessCertificateDoc.name}
                        </p>
                      ) : (
                        <p className="text-xs text-gray-500 mt-2">
                          Upload fitness certificate: JPG, PNG, GIF or PDF. Max 5MB.
                        </p>
                      )}
                    </div>
                  </div>
                </div>

                {/* Upload Pollution Certificate Document */}
                <div>
                  <label className="block text-sm text-gray-700 mb-2">
                    Upload Pollution Certificate
                  </label>
                  <div className="flex items-center gap-4">
                    <div className="relative">
                      <input
                        type="file"
                        id="pollutionDocUpload"
                        onChange={(e) => handleFileUpload('pollution', e)}
                        accept=".jpg,.jpeg,.png,.gif,.pdf"
                        className="hidden"
                      />
                      <label
                        htmlFor="pollutionDocUpload"
                        className="w-16 h-16 bg-gray-100 rounded-lg flex items-center justify-center cursor-pointer hover:bg-gray-200 transition-colors overflow-hidden"
                      >
                        {pollutionDocPreview ? (
                          <img src={pollutionDocPreview} alt="Pollution" className="w-full h-full object-cover" />
                        ) : formData.pollution_doc ? (
                          <img 
                            src={`${import.meta.env.VITE_API_BASE_URL.replace('/api/v1', '')}${formData.pollution_doc}`}
                            alt="Pollution"
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <Upload className="w-6 h-6 text-gray-600" />
                        )}
                      </label>
                    </div>
                    <div>
                      <button
                        type="button"
                        onClick={() => document.getElementById('pollutionDocUpload').click()}
                        className="px-6 py-2.5 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
                      >
                        Upload File
                      </button>
                      {pollutionDoc ? (
                        <p className="text-xs text-green-600 mt-2 font-medium">
                          ✓ {pollutionDoc.name}
                        </p>
                      ) : (
                        <p className="text-xs text-gray-500 mt-2">
                          Upload pollution cert: JPG, PNG, GIF or PDF. Max 5MB.
                        </p>
                      )}
                    </div>
                  </div>
                </div>

                {/* Upload KA Permit Document */}
                <div>
                  <label className="block text-sm text-gray-700 mb-2">
                    Upload KA Permit Document
                  </label>
                  <div className="flex items-center gap-4">
                    <div className="relative">
                      <input
                        type="file"
                        id="kaPermitDocUpload"
                        onChange={(e) => handleFileUpload('kaPermit', e)}
                        accept=".jpg,.jpeg,.png,.gif,.pdf"
                        className="hidden"
                      />
                      <label
                        htmlFor="kaPermitDocUpload"
                        className="w-16 h-16 bg-gray-100 rounded-lg flex items-center justify-center cursor-pointer hover:bg-gray-200 transition-colors overflow-hidden"
                      >
                        {kaPermitDocPreview ? (
                          <img src={kaPermitDocPreview} alt="KA Permit" className="w-full h-full object-cover" />
                        ) : formData.ka_permit_doc ? (
                          <img 
                            src={`${import.meta.env.VITE_API_BASE_URL.replace('/api/v1', '')}${formData.ka_permit_doc}`}
                            alt="KA Permit"
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <Upload className="w-6 h-6 text-gray-600" />
                        )}
                      </label>
                    </div>
                    <div>
                      <button
                        type="button"
                        onClick={() => document.getElementById('kaPermitDocUpload').click()}
                        className="px-6 py-2.5 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
                      >
                        Upload File
                      </button>
                      {kaPermitDoc ? (
                        <p className="text-xs text-green-600 mt-2 font-medium">
                          ✓ {kaPermitDoc.name}
                        </p>
                      ) : (
                        <p className="text-xs text-gray-500 mt-2">
                          Upload KA permit: JPG, PNG, GIF or PDF. Max 5MB.
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Vehicle Information Section */}
            <div className="mb-8">
              <h2 className="text-xl font-bold text-gray-900 mb-6">Vehicle Information</h2>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
                {/* Vehicle Type */}
                <div>
                  <label className="block text-sm text-gray-700 mb-2">
                    Vehicle Type <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <select
                      name="vehicle_ownership"
                      value={formData.vehicle_ownership}
                      onChange={handleInputChange}
                      className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent appearance-none text-sm cursor-pointer"
                      required
                    >
                      <option value="">Select vehicle type</option>
                      <option value="r1">R1 Vehicle</option>
                      <option value="rental">Rental Vehicle</option>
                      <option value="third-party">Third Party Vehicle</option>
                    </select>
                    <ChevronRight className="absolute right-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400 pointer-events-none rotate-90" />
                  </div>
                </div>

                {/* Available Vehicle */}
                <div>
                  <label className="block text-sm text-gray-700 mb-2">
                    Available Vehicle <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <select
                      name="available_vehicle"
                      value={formData.available_vehicle}
                      onChange={handleInputChange}
                      className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent appearance-none text-sm text-gray-500 cursor-pointer"
                      required
                    >
                      <option value="">Select available vehicle</option>
                      {vehicleTypes.map(type => (
                        <option key={type} value={type}>
                          {type.split('-').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ')}
                        </option>
                      ))}
                    </select>
                    <ChevronRight className="absolute right-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400 pointer-events-none rotate-90" />
                  </div>
                </div>

                {/* Vehicle Number */}
                <div>
                  <label className="block text-sm text-gray-700 mb-2">
                    Vehicle Number <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    name="vehicle_number"
                    value={formData.vehicle_number}
                    onChange={handleInputChange}
                    placeholder="TN 00 AA 0000"
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent text-sm"
                    required
                  />
                </div>

                {/* Capacity */}
                <div>
                  <label className="block text-sm text-gray-700 mb-2">
                    Capacity (Tons) <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    name="capacity"
                    value={formData.capacity}
                    onChange={handleInputChange}
                    placeholder="Enter capacity"
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent text-sm"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
                {/* Insurance Number */}
                <div>
                  <label className="block text-sm text-gray-700 mb-2">
                    Insurance Number
                  </label>
                  <input
                    type="text"
                    name="insurance_number"
                    value={formData.insurance_number}
                    onChange={handleInputChange}
                    placeholder="Enter insurance number"
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent text-sm"
                  />
                </div>

                {/* Insurance Expiry Date */}
                <div>
                  <label className="block text-sm text-gray-700 mb-2">
                    Insurance Expiry Date
                  </label>
                  <input
                    type="date"
                    name="insurance_expiry_date"
                    value={formData.insurance_expiry_date}
                    onChange={handleInputChange}
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent text-sm"
                  />
                </div>

                {/* Vehicle Condition */}
                <div>
                  <label className="block text-sm text-gray-700 mb-2">
                    Vehicle Condition
                  </label>
                  <div className="relative">
                    <select
                      name="vehicle_condition"
                      value={formData.vehicle_condition}
                      onChange={handleInputChange}
                      className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent appearance-none text-sm cursor-pointer"
                    >
                      <option value="Excellent">Excellent</option>
                      <option value="Good">Good</option>
                      <option value="Fair">Fair</option>
                      <option value="Poor">Poor</option>
                    </select>
                    <ChevronRight className="absolute right-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400 pointer-events-none rotate-90" />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
                <div>
                  <label className="block text-sm text-gray-700 mb-2">
                    Fitness Certificate 
                  </label>
                  <input
                    type="text"
                    name="fitness_certificate"
                    value={formData.fitness_certificate}
                    onChange={handleInputChange}
                    placeholder="Enter fitness certificate number"
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-700 mb-2">
                    Fitness Certificate Expiry Date 
                  </label>
                  <input
                    type="date"
                    name="fitness_certificate_expiry_date"
                    value={formData.fitness_certificate_expiry_date}
                    onChange={handleInputChange}
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent text-sm"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
                {/* License Expiry Date */}
                <div>
                  <label className="block text-sm text-gray-700 mb-2">
                    License Expiry Date
                  </label>
                  <input
                    type="date"
                    name="license_expiry_date"
                    value={formData.license_expiry_date}
                    onChange={handleInputChange}
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent text-sm"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* Pollution Certificate */}
                <div>
                  <label className="block text-sm text-gray-700 mb-2">
                    Pollution Certificate
                  </label>
                  <input
                    type="text"
                    name="pollution_certificate"
                    value={formData.pollution_certificate}
                    onChange={handleInputChange}
                    placeholder="Enter pollution certificate number"
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent text-sm"
                  />
                </div>

                {/* Pollution Certificate Expiry Date */}
                <div>
                  <label className="block text-sm text-gray-700 mb-2">
                    Pollution Certificate Expiry Date
                  </label>
                  <input
                    type="date"
                    name="pollution_certificate_expiry_date"
                    value={formData.pollution_certificate_expiry_date}
                    onChange={handleInputChange}
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent text-sm"
                  />
                </div>

                {/* KA Permit */}
                <div>
                  <label className="block text-sm text-gray-700 mb-2">
                    KA Permit
                  </label>
                  <input
                    type="text"
                    name="ka_permit"
                    value={formData.ka_permit}
                    onChange={handleInputChange}
                    placeholder="Enter KA permit number"
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent text-sm"
                  />
                </div>

                {/* KA Permit Expiry Date */}
                <div>
                  <label className="block text-sm text-gray-700 mb-2">
                    KA Permit Expiry Date
                  </label>
                  <input
                    type="date"
                    name="ka_permit_expiry_date"
                    value={formData.ka_permit_expiry_date}
                    onChange={handleInputChange}
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent text-sm"
                  />
                </div>
              </div>
            </div>

            {/* Bank Account Details Section */}
            <div className="mb-8">
              <h2 className="text-xl font-bold text-gray-900 mb-6">Bank Account Details</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm text-gray-700 mb-2">Account Holder Name</label>
                  <input
                    type="text"
                    name="account_holder_name"
                    value={formData.account_holder_name}
                    onChange={handleInputChange}
                    placeholder="As per bank account"
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-700 mb-2">Bank Name</label>
                  <input
                    type="text"
                    name="bank_name"
                    value={formData.bank_name}
                    onChange={handleInputChange}
                    placeholder="Enter bank name"
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-700 mb-2">Branch Name</label>
                  <input
                    type="text"
                    name="branch_name"
                    value={formData.branch_name}
                    onChange={handleInputChange}
                    placeholder="Enter branch name"
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-700 mb-2">Account Number</label>
                  <input
                    type="text"
                    name="account_number"
                    value={formData.account_number}
                    onChange={handleInputChange}
                    placeholder="Enter account number"
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-700 mb-2">IFSC Code</label>
                  <input
                    type="text"
                    name="IFSC_code"
                    value={formData.IFSC_code}
                    onChange={handleInputChange}
                    placeholder="Enter IFSC code"
                    maxLength="11"
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent text-sm uppercase"
                  />
                </div>
              </div>
            </div>

            {/* Delivery Assignment Section */}
            <div className="mb-8">
              <h2 className="text-xl font-bold text-gray-900 mb-2">
                Delivery Assignment <span className="text-red-500">*</span>
              </h2>
              <p className="text-sm text-gray-600 mb-6">
                Select the type of deliveries this driver will handle
              </p>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Collection Delivery */}
                <label className={`relative flex items-start p-4 border-2 rounded-xl cursor-pointer transition-all ${
                  formData.delivery_type === 'LOCAL GRADE ORDER' 
                    ? 'border-teal-600 bg-teal-50' 
                    : 'border-gray-300 hover:border-gray-400'
                }`}>
                  <input
                    type="radio"
                    name="delivery_type"
                    value="LOCAL GRADE ORDER"
                    checked={formData.delivery_type === 'LOCAL GRADE ORDER'}
                    onChange={handleInputChange}
                    className="mt-1 w-5 h-5 text-teal-600 focus:ring-2 focus:ring-teal-500"
                  />
                  <div className="ml-3">
                    <div className="font-semibold text-gray-900">LOCAL GRADE ORDER</div>
                    <div className="text-sm text-gray-600 mt-1">
                      Collect vegetables from farmers, suppliers and deliver to packing centers
                    </div>
                  </div>
                </label>

                {/* Airport Delivery */}
                <label className={`relative flex items-start p-4 border-2 rounded-xl cursor-pointer transition-all ${
                  formData.delivery_type === 'BOX ORDER' 
                    ? 'border-teal-600 bg-teal-50' 
                    : 'border-gray-300 hover:border-gray-400'
                }`}>
                  <input
                    type="radio"
                    name="delivery_type"
                    value="BOX ORDER"
                    checked={formData.delivery_type === 'BOX ORDER'}
                    onChange={handleInputChange}
                    className="mt-1 w-5 h-5 text-teal-600 focus:ring-2 focus:ring-teal-500"
                  />
                  <div className="ml-3">
                    <div className="font-semibold text-gray-900">BOX ORDER</div>
                    <div className="text-sm text-gray-600 mt-1">
                      Pick up from packing centers and deliver to airports for shipment
                    </div>
                  </div>
                </label>

                {/* Both Types */}
                <label className={`relative flex items-start p-4 border-2 rounded-xl cursor-pointer transition-all ${
                  formData.delivery_type === 'Both Types' 
                    ? 'border-teal-600 bg-teal-50' 
                    : 'border-gray-300 hover:border-gray-400'
                }`}>
                  <input
                    type="radio"
                    name="delivery_type"
                    value="Both Types"
                    checked={formData.delivery_type === 'Both Types'}
                    onChange={handleInputChange}
                    className="mt-1 w-5 h-5 text-teal-600 focus:ring-2 focus:ring-teal-500"
                  />
                  <div className="ml-3">
                    <div className="font-semibold text-gray-900">Both Types</div>
                    <div className="text-sm text-gray-600 mt-1">
                      Handle both local pickups and line airport deliveries as needed
                    </div>
                  </div>
                </label>
              </div>
            </div>

            {/* Footer Actions */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-6 border-t border-gray-200">
              {/* Driver Status */}
              <div className="flex items-center gap-3">
                <span className="text-sm text-gray-700 font-medium">Driver Status</span>
                <select
                  name="status"
                  value={formData.status}
                  onChange={handleInputChange}
                  className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 text-sm"
                >
                  <option value="Available">Available</option>
                  <option value="On Trip">On Trip</option>
                  <option value="Break">Break</option>
                  <option value="Inactive">Inactive</option>
                </select>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => navigate(backPath)}
                  className="px-6 py-2.5 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-6 py-2.5 bg-teal-700 hover:bg-teal-800 text-white rounded-lg text-sm font-medium transition-colors shadow-sm disabled:opacity-50"
                >
                  {loading ? 'Updating Driver...' : 'Update Driver'}
                </button>
              </div>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};

export default EditDriver;