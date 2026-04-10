import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Upload, Eye, EyeOff, ChevronRight, ArrowLeft } from 'lucide-react';
import { createDriver } from '../../../api/driverApi';
import { createNotification } from '../../../api/notificationApi';
import { sortDropdownStrings } from '../../../utils/dropdownSort';

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

const AddDriver = () => {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    driverName: '',
    phoneNumber: '',
    email: '',
    address: '',
    city: '',
    state: '',
    pinCode: '',
    password: '',
    licenseNumber: '',
    licenseExpiry: '',
    availableVehicle: '',
    vehicleType: '',
    vehicleNumber: '',
    capacity: '',
    insuranceNumber: '',
    insuranceExpiry: '',
    fitnessCertificate: '',
    fitnessCertificateExpiry: '',
    vehicleCondition: 'Good',
    pollutionCertificate: '',
    pollutionCertificateExpiry: '',
    kaPermit: '',
    kaPermitExpiry: '',
    accountHolderName: '',
    bankName: '',
    branchName: '',
    accountNumber: '',
    ifscCode: '',
    deliveryType: 'collection',
    isActive: true
  });

  const [showPassword, setShowPassword] = useState(false);
  const [driverImage, setDriverImage] = useState(null);
  const [licenseImage, setLicenseImage] = useState(null);
  const [idProof, setIdProof] = useState(null);
  const [insuranceDoc, setInsuranceDoc] = useState(null);
  const [fitnessCertificateDoc, setFitnessCertificateDoc] = useState(null);
  const [pollutionDoc, setPollutionDoc] = useState(null);
  const [kaPermitDoc, setKaPermitDoc] = useState(null);
  const [vehicleTypes, setVehicleTypes] = useState([
    'tata-ace',
    'mahindra-bolero', 
    'ashok-leyland',
    'eicher-pro',
    'tata-407'
  ]);
  const [showNewVehicleInput, setShowNewVehicleInput] = useState(false);
  const [newVehicleType, setNewVehicleType] = useState('');
  const [loading, setLoading] = useState(false);

  const createExpiryNotifications = async () => {
    const vehicleNumber = (formData.vehicleNumber || 'N/A').trim();
    const docs = [
      { label: 'Insurance', date: formData.insuranceExpiry },
      { label: 'Fitness Certificate', date: formData.fitnessCertificateExpiry },
      { label: 'Pollution Certificate', date: formData.pollutionCertificateExpiry },
      { label: 'Other State Permit', date: formData.kaPermitExpiry }
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
          message: `${doc.label} for vehicle ${vehicleNumber} (${formData.driverName || 'Driver'}) ${timingText}. Due date: ${ymd}.`,
          type: isOverdue ? 'error' : 'warning',
          category: 'Drivers'
        });
      } catch (error) {
        console.error(`Failed to create ${doc.label} reminder notification:`, error);
      }
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    if (name === 'availableVehicle' && value === 'add-new') {
      setShowNewVehicleInput(true);
      setFormData(prev => ({ ...prev, [name]: '' }));
    } else {
      setFormData(prev => ({ ...prev, [name]: value }));
      if (name === 'availableVehicle') {
        setShowNewVehicleInput(false);
      }
    }
  };

  const handleAddNewVehicleType = () => {
    if (newVehicleType.trim()) {
      const newType = newVehicleType.trim().toLowerCase().replace(/\s+/g, '-');
      setVehicleTypes(prev => [...prev, newType]);
      setFormData(prev => ({ ...prev, availableVehicle: newType }));
      setShowNewVehicleInput(false);
      setNewVehicleType('');
    }
  };

  const handleFileUpload = (type, event) => {
    const file = event.target.files[0];
    if (file) {
      if (type === 'profile') {
        setDriverImage(file);
      } else if (type === 'license') {
        setLicenseImage(file);
      } else if (type === 'idProof') {
        setIdProof(file);
      } else if (type === 'insurance') {
        setInsuranceDoc(file);
      } else if (type === 'fitnessCertificate') {
        setFitnessCertificateDoc(file);
      } else if (type === 'pollution') {
        setPollutionDoc(file);
      } else if (type === 'kaPermit') {
        setKaPermitDoc(file);
      }
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    
    try {
      const formDataToSend = new FormData();
      
      formDataToSend.append('driver_name', formData.driverName);
      formDataToSend.append('phone_number', formData.phoneNumber);
      if (formData.email) formDataToSend.append('email', formData.email);
      if (formData.address) formDataToSend.append('address', formData.address);
      if (formData.city) formDataToSend.append('city', formData.city);
      if (formData.state) formDataToSend.append('state', formData.state);
      if (formData.pinCode) formDataToSend.append('pin_code', formData.pinCode);
      if (formData.password) formDataToSend.append('password', formData.password);
      formDataToSend.append('license_number', formData.licenseNumber);
      if (formData.licenseExpiry) formDataToSend.append('license_expiry_date', formData.licenseExpiry);
      if (formData.vehicleType) formDataToSend.append('vehicle_type', formData.vehicleType);
      formDataToSend.append('available_vehicle', formData.availableVehicle);
      formDataToSend.append('vehicle_number', formData.vehicleNumber);
      formDataToSend.append('capacity', formData.capacity);
      if (formData.insuranceNumber) formDataToSend.append('insurance_number', formData.insuranceNumber);
      if (formData.insuranceExpiry) formDataToSend.append('insurance_expiry_date', formData.insuranceExpiry);
      formDataToSend.append('fitness_certificate', formData.fitnessCertificate);
      formDataToSend.append('fitness_certificate_expiry_date', formData.fitnessCertificateExpiry);
      formDataToSend.append('vehicle_condition', formData.vehicleCondition);
      if (formData.pollutionCertificate) formDataToSend.append('pollution_certificate', formData.pollutionCertificate);
      if (formData.pollutionCertificateExpiry) formDataToSend.append('pollution_certificate_expiry_date', formData.pollutionCertificateExpiry);
      if (formData.kaPermit) formDataToSend.append('ka_permit', formData.kaPermit);
      if (formData.kaPermitExpiry) formDataToSend.append('ka_permit_expiry_date', formData.kaPermitExpiry);
      if (formData.accountHolderName) formDataToSend.append('account_holder_name', formData.accountHolderName);
      if (formData.bankName) formDataToSend.append('bank_name', formData.bankName);
      if (formData.branchName) formDataToSend.append('branch_name', formData.branchName);
      if (formData.accountNumber) formDataToSend.append('account_number', formData.accountNumber);
      if (formData.ifscCode) formDataToSend.append('IFSC_code', formData.ifscCode);

      formDataToSend.append('delivery_type', formData.deliveryType === 'collection' ? 'LOCAL GRADE ORDER' : 
                           formData.deliveryType === 'airport' ? 'BOX ORDER' : 'Both Types');
      formDataToSend.append('status', formData.isActive ? 'Available' : 'Inactive');
      
      if (driverImage) formDataToSend.append('driver_image', driverImage);
      if (licenseImage) formDataToSend.append('license_image', licenseImage);
      if (idProof) formDataToSend.append('driver_id_proof', idProof);
      if (insuranceDoc) formDataToSend.append('insurance_doc', insuranceDoc);
      if (fitnessCertificateDoc) formDataToSend.append('fitness_certificate_doc', fitnessCertificateDoc);
      if (pollutionDoc) formDataToSend.append('pollution_doc', pollutionDoc);
      if (kaPermitDoc) formDataToSend.append('ka_permit_doc', kaPermitDoc);
      
      await createDriver(formDataToSend);
      await createExpiryNotifications();

      try {
        await createNotification({
          title: 'New driver added',
          message: `Driver ${formData.driverName} has been registered.`,
          type: 'success',
          category: 'Drivers'
        });
      } catch (notifyErr) {
        console.error('Failed to create driver notification:', notifyErr);
      }

      navigate('/drivers');
    } catch (error) {
      console.error('Error creating driver:', error);
      alert(error.message || 'Failed to create driver. Please try again.');
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
            onClick={() => navigate('/drivers')}
            className="flex items-center gap-2 text-gray-600 hover:text-gray-800 transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
            <span className="font-medium">Back to Driver Management</span>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6 sm:p-8">
          
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
                  name="driverName"
                  value={formData.driverName}
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
                  name="phoneNumber"
                  value={formData.phoneNumber}
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
                  name="pinCode"
                  value={formData.pinCode}
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
                  name="licenseNumber"
                  value={formData.licenseNumber}
                  onChange={handleInputChange}
                  placeholder="Enter license number"
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent text-sm"
                  required
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
                  name="licenseExpiry"
                  value={formData.licenseExpiry}
                  onChange={handleInputChange}
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent text-sm"
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
                      className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center cursor-pointer hover:bg-gray-200 transition-colors"
                    >
                      <Upload className="w-6 h-6 text-gray-600" />
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
                    {driverImage ? (
                      <p className="text-xs text-green-600 mt-2 font-medium">
                        ✓ {driverImage.name}
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
                      onChange={(e) => handleFileUpload('license', e)}
                      className="hidden"
                    />
                    <label
                      htmlFor="licenseUpload"
                      className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center cursor-pointer hover:bg-gray-200 transition-colors"
                    >
                      <Upload className="w-6 h-6 text-gray-600" />
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
                    {licenseImage ? (
                      <p className="text-xs text-green-600 mt-2 font-medium">
                        ✓ {licenseImage.name}
                      </p>
                    ) : (
                      <p className="text-xs text-gray-500 mt-2">
                        Upload license document: All formats. Max 20MB.
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
                      onChange={(e) => handleFileUpload('idProof', e)}
                      className="hidden"
                    />
                    <label
                      htmlFor="idProofUpload"
                      className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center cursor-pointer hover:bg-gray-200 transition-colors"
                    >
                      <Upload className="w-6 h-6 text-gray-600" />
                    </label>
                  </div>
                  <div>
                    <button
                      type="button"
                      onClick={() => document.getElementById('idProofUpload').click()}
                      className="px-6 py-2.5 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
                    >
                      Upload File
                    </button>
                    {idProof ? (
                      <p className="text-xs text-green-600 mt-2 font-medium">
                        ✓ {idProof.name}
                      </p>
                    ) : (
                      <p className="text-xs text-gray-500 mt-2">
                        Upload ID proof: All formats. Max 20MB.
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
                      className="w-16 h-16 bg-gray-100 rounded-lg flex items-center justify-center cursor-pointer hover:bg-gray-200 transition-colors"
                    >
                      <Upload className="w-6 h-6 text-gray-600" />
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
                      className="w-16 h-16 bg-gray-100 rounded-lg flex items-center justify-center cursor-pointer hover:bg-gray-200 transition-colors"
                    >
                      <Upload className="w-6 h-6 text-gray-600" />
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
                      className="w-16 h-16 bg-gray-100 rounded-lg flex items-center justify-center cursor-pointer hover:bg-gray-200 transition-colors"
                    >
                      <Upload className="w-6 h-6 text-gray-600" />
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
                      className="w-16 h-16 bg-gray-100 rounded-lg flex items-center justify-center cursor-pointer hover:bg-gray-200 transition-colors"
                    >
                      <Upload className="w-6 h-6 text-gray-600" />
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
                    name="vehicleType"
                    value={formData.vehicleType}
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
                {!showNewVehicleInput ? (
                  <div className="relative">
                    <select
                      name="availableVehicle"
                      value={formData.availableVehicle}
                      onChange={handleInputChange}
                      className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent appearance-none text-sm text-gray-500 cursor-pointer"
                      required
                    >
                      <option value="">Select available vehicle</option>
                      {sortDropdownStrings(vehicleTypes).map(type => (
                        <option key={type} value={type}>
                          {type.split('-').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ')}
                        </option>
                      ))}
                      <option value="add-new">+ Add New Vehicle</option>
                    </select>
                    <ChevronRight className="absolute right-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400 pointer-events-none rotate-90" />
                  </div>
                ) : (
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={newVehicleType}
                      onChange={(e) => setNewVehicleType(e.target.value)}
                      placeholder="Enter new vehicle"
                      className="flex-1 px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent text-sm"
                      onKeyPress={(e) => e.key === 'Enter' && handleAddNewVehicleType()}
                    />
                    <button
                      type="button"
                      onClick={handleAddNewVehicleType}
                      className="px-4 py-2.5 bg-teal-600 text-white rounded-lg text-sm hover:bg-teal-700 transition-colors"
                    >
                      Add
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setShowNewVehicleInput(false);
                        setNewVehicleType('');
                      }}
                      className="px-4 py-2.5 border border-gray-300 text-gray-700 rounded-lg text-sm hover:bg-gray-50 transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                )}
              </div>

              {/* Vehicle Number */}
              <div>
                <label className="block text-sm text-gray-700 mb-2">
                  Vehicle Number <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  name="vehicleNumber"
                  value={formData.vehicleNumber}
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
                  name="insuranceNumber"
                  value={formData.insuranceNumber}
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
                  name="insuranceExpiry"
                  value={formData.insuranceExpiry}
                  onChange={handleInputChange}
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent text-sm"
                />
              </div>

              {/* Fitness Certificate */}
              <div>
                <label className="block text-sm text-gray-700 mb-2">
                  Fitness Certificate
                </label>
                <input
                  type="text"
                  name="fitnessCertificate"
                  value={formData.fitnessCertificate}
                  onChange={handleInputChange}
                  placeholder="Enter fitness certificate number"
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent text-sm"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
              {/* Fitness Certificate Expiry Date */}
              <div>
                <label className="block text-sm text-gray-700 mb-2">
                  Fitness Certificate Expiry Date 
                </label>
                <input
                  type="date"
                  name="fitnessCertificateExpiry"
                  value={formData.fitnessCertificateExpiry}
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
                    name="vehicleCondition"
                    value={formData.vehicleCondition}
                    onChange={handleInputChange}
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent appearance-none text-sm cursor-pointer"
                  >
                    <option value="Excellent">Excellent</option>
                    <option value="Fair">Fair</option>
                    <option value="Good">Good</option>
                    <option value="Poor">Poor</option>
                  </select>
                  <ChevronRight className="absolute right-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400 pointer-events-none rotate-90" />
                </div>
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
                  name="pollutionCertificate"
                  value={formData.pollutionCertificate}
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
                  name="pollutionCertificateExpiry"
                  value={formData.pollutionCertificateExpiry}
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
                  name="kaPermit"
                  value={formData.kaPermit}
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
                  name="kaPermitExpiry"
                  value={formData.kaPermitExpiry}
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
                  name="accountHolderName"
                  value={formData.accountHolderName}
                  onChange={handleInputChange}
                  placeholder="As per bank account"
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent text-sm"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-700 mb-2">Bank Name</label>
                <input
                  type="text"
                  name="bankName"
                  value={formData.bankName}
                  onChange={handleInputChange}
                  placeholder="Enter bank name"
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent text-sm"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-700 mb-2">Branch Name</label>
                <input
                  type="text"
                  name="branchName"
                  value={formData.branchName}
                  onChange={handleInputChange}
                  placeholder="Enter branch name"
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent text-sm"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-700 mb-2">Account Number</label>
                <input
                  type="text"
                  name="accountNumber"
                  value={formData.accountNumber}
                  onChange={handleInputChange}
                  placeholder="Enter account number"
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent text-sm"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-700 mb-2">IFSC Code</label>
                <input
                  type="text"
                  name="ifscCode"
                  value={formData.ifscCode}
                  onChange={handleInputChange}
                  placeholder="Enter IFSC code"
                  maxLength="11"
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent text-sm uppercase"
                />
              </div>
            </div>
          </div>

          {/* Driver Wage Section */}
          <div className="mb-8">
            <h2 className="text-xl font-bold text-gray-900 mb-6">Driver Wage</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div>
                <label className="block text-sm text-gray-700 mb-2">Local Grade Order Wage (₹)</label>
                <input
                  type="number"
                  step="0.01"
                  name="localGradeWage"
                  value={formData.localGradeWage}
                  onChange={handleInputChange}
                  placeholder="Enter wage amount"
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent text-sm"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-700 mb-2">Box Order Wage (₹)</label>
                <input
                  type="number"
                  step="0.01"
                  name="boxOrderWage"
                  value={formData.boxOrderWage}
                  onChange={handleInputChange}
                  placeholder="Enter wage amount"
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent text-sm"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-700 mb-2">Both Types Wage (₹)</label>
                <input
                  type="number"
                  step="0.01"
                  name="bothTypesWage"
                  value={formData.bothTypesWage}
                  onChange={handleInputChange}
                  placeholder="Enter wage amount"
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent text-sm"
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
                formData.deliveryType === 'collection' 
                  ? 'border-teal-600 bg-teal-50' 
                  : 'border-gray-300 hover:border-gray-400'
              }`}>
                <input
                  type="radio"
                  name="deliveryType"
                  value="collection"
                  checked={formData.deliveryType === 'collection'}
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
                formData.deliveryType === 'airport' 
                  ? 'border-teal-600 bg-teal-50' 
                  : 'border-gray-300 hover:border-gray-400'
              }`}>
                <input
                  type="radio"
                  name="deliveryType"
                  value="airport"
                  checked={formData.deliveryType === 'airport'}
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
                formData.deliveryType === 'both' 
                  ? 'border-teal-600 bg-teal-50' 
                  : 'border-gray-300 hover:border-gray-400'
              }`}>
                <input
                  type="radio"
                  name="deliveryType"
                  value="both"
                  checked={formData.deliveryType === 'both'}
                  onChange={handleInputChange}
                  className="mt-1 w-5 h-5 text-teal-600 focus:ring-2 focus:ring-teal-500"
                />
                <div className="ml-3">
                  <div className="font-semibold text-gray-900">Both Types</div>
                  <div className="text-sm text-gray-600 mt-1">
                    Handle both LOCAL GRADE ORDER and line airport deliveries as needed
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
                value={formData.isActive ? 'Available' : 'Inactive'}
                onChange={(e) => setFormData(prev => ({ ...prev, isActive: e.target.value === 'Available' }))}
                className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 text-sm"
              >
                <option value="Available">Available</option>
                <option value="Break">Break</option>
                <option value="Inactive">Inactive</option>
                <option value="On Trip">On Trip</option>
              </select>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => navigate('/drivers')}
                className="px-6 py-2.5 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading}
                className="px-6 py-2.5 bg-teal-700 hover:bg-teal-800 text-white rounded-lg text-sm font-medium transition-colors shadow-sm disabled:opacity-50"
              >
                {loading ? 'Adding Driver...' : 'Add Driver'}
              </button>

            </div>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AddDriver;