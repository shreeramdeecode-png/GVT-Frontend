import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Camera, Calendar, ArrowLeft } from 'lucide-react';
import { createLabour } from '../../../api/labourApi';
import { createNotification } from '../../../api/notificationApi';

const AddLabour = () => {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    fullName: '',
    labourId: 'LAB-2024-008 (Auto-generated)',
    mobileNumber: '',
    aadhaarNumber: '',
    dateOfBirth: '',
    gender: '',
    bloodGroup: '',
    address: '',
    workType: '',
    department: '',
    joiningDate: '',
    accountHolderName: '',
    bankName: '',
    branchName: '',
    accountNumber: '',
    ifscCode: '',
    status: 'Live'
  });

  const [photoPreview, setPhotoPreview] = useState(null);
  const [profileImage, setProfileImage] = useState(null);
  const [loading, setLoading] = useState(false);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handlePhotoUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      setProfileImage(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setPhotoPreview(reader.result);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    
    try {
      const formDataToSend = new FormData();
      formDataToSend.append('full_name', formData.fullName);
      formDataToSend.append('mobile_number', formData.mobileNumber);
      formDataToSend.append('aadhaar_number', formData.aadhaarNumber);
      formDataToSend.append('date_of_birth', formData.dateOfBirth);
      formDataToSend.append('gender', formData.gender.charAt(0).toUpperCase() + formData.gender.slice(1));
      formDataToSend.append('blood_group', formData.bloodGroup);
      formDataToSend.append('address', formData.address);
      formDataToSend.append('work_type', formData.workType);
      formDataToSend.append('department', formData.department);
      formDataToSend.append('joining_date', formData.joiningDate);
      if (formData.accountHolderName) formDataToSend.append('account_holder_name', formData.accountHolderName);
      if (formData.bankName) formDataToSend.append('bank_name', formData.bankName);
      if (formData.branchName) formDataToSend.append('branch_name', formData.branchName);
      if (formData.accountNumber) formDataToSend.append('account_number', formData.accountNumber);
      if (formData.ifscCode) formDataToSend.append('IFSC_code', formData.ifscCode);
      formDataToSend.append('status', formData.status);
      
      if (profileImage) formDataToSend.append('profile_image', profileImage);
      
      await createLabour(formDataToSend);

      try {
        await createNotification({
          title: 'New labour added',
          message: `Labour ${formData.fullName} has been registered.`,
          type: 'success',
          category: 'Labour'
        });
      } catch (notifyErr) {
        console.error('Failed to create labour notification:', notifyErr);
      }

      navigate('/labour');
    } catch (error) {
      console.error('Error creating labour:', error);
      alert(error.message || 'Failed to create labour. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    navigate('/labours');
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      {/* Header */}
       <div className="flex items-center gap-4 mb-6">
                <button
                  onClick={() => navigate('/labour')}
                  className="flex items-center gap-2 text-gray-600 hover:text-gray-800 transition-colors"
                >
                  <ArrowLeft className="w-5 h-5" />
                  <span className="font-medium">Back to Labour Management</span>
                </button>
              </div>

      {/* Form Container */}
      <div className="bg-white rounded-2xl border border-[#D0E0DB] p-6 sm:p-8">
        <form onSubmit={handleSubmit}>
          {/* Personal Information Section */}
          <div className="mb-8">
            <h2 className="text-xl font-bold text-[#0D5C4D] mb-6 italic">Personal Information</h2>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              {/* Photo Upload */}
              <div className="lg:col-span-12 xl:col-span-2 flex justify-center lg:justify-start">
                <div className="relative">
                  <input
                    type="file"
                    id="photo-upload"
                    className="hidden"
                    accept="image/*"
                    onChange={handlePhotoUpload}
                  />
                  <label
                    htmlFor="photo-upload"
                    className="w-32 h-32 rounded-full border-4 border-dashed border-[#D0E0DB] bg-[#F0F4F3] flex flex-col items-center justify-center cursor-pointer hover:bg-[#E5EBE9] transition-colors"
                  >
                    {photoPreview ? (
                      <img
                        src={photoPreview}
                        alt="Preview"
                        className="w-full h-full rounded-full object-cover"
                      />
                    ) : (
                      <>
                        <Camera className="w-8 h-8 text-[#6B8782] mb-2" />
                        <span className="text-xs text-[#6B8782] font-medium">Upload Photo</span>
                      </>
                    )}
                  </label>
                </div>
              </div>

              {/* Form Fields */}
              <div className="lg:col-span-12 xl:col-span-10">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Full Name */}
                  <div>
                    <label className="block text-sm font-medium text-[#0D5C4D] mb-2">
                      Full Name <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      name="fullName"
                      value={formData.fullName}
                      onChange={handleInputChange}
                      placeholder="Enter full name"
                      className="w-full px-4 py-2.5 bg-white border border-[#D0E0DB] rounded-lg text-[#0D5C4D] placeholder-[#9CA3AF] focus:outline-none focus:ring-2 focus:ring-[#0D8568] focus:border-transparent"
                      required
                    />
                  </div>

                  {/* Labour ID */}
                  <div>
                    <label className="block text-sm font-medium text-[#0D5C4D] mb-2">
                      Labour ID <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      name="labourId"
                      value={formData.labourId}
                      className="w-full px-4 py-2.5 bg-[#F0F4F3] border border-[#D0E0DB] rounded-lg text-[#6B8782] cursor-not-allowed"
                      disabled
                    />
                  </div>

                  {/* Mobile Number */}
                  <div>
                    <label className="block text-sm font-medium text-[#0D5C4D] mb-2">
                      Mobile Number <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="tel"
                      name="mobileNumber"
                      value={formData.mobileNumber}
                      onChange={handleInputChange}
                      placeholder="Enter 10-digit mobile number"
                      maxLength="10"
                      pattern="[0-9]{10}"
                      className="w-full px-4 py-2.5 bg-white border border-[#D0E0DB] rounded-lg text-[#0D5C4D] placeholder-[#9CA3AF] focus:outline-none focus:ring-2 focus:ring-[#0D8568] focus:border-transparent"
                      required
                    />
                  </div>

                  {/* Aadhaar Number */}
                  <div>
                    <label className="block text-sm font-medium text-[#0D5C4D] mb-2">
                      Aadhaar Number
                    </label>
                    <input
                      type="text"
                      name="aadhaarNumber"
                      value={formData.aadhaarNumber}
                      onChange={handleInputChange}
                      placeholder="Enter 12-digit Aadhaar number"
                      maxLength="12"
                      pattern="[0-9]{12}"
                      className="w-full px-4 py-2.5 bg-white border border-[#D0E0DB] rounded-lg text-[#0D5C4D] placeholder-[#9CA3AF] focus:outline-none focus:ring-2 focus:ring-[#0D8568] focus:border-transparent"
                    />
                  </div>

                  {/* Date of Birth */}
                  <div>
                    <label className="block text-sm font-medium text-[#0D5C4D] mb-2">
                      Date of Birth <span className="text-red-500">*</span>
                    </label>
                    <div className="relative">
                      <input
                        type="date"
                        name="dateOfBirth"
                        value={formData.dateOfBirth}
                        onChange={handleInputChange}
                        placeholder="DD/MM/YYYY"
                        className="w-full px-4 py-2.5 bg-white border border-[#D0E0DB] rounded-lg text-[#0D5C4D] placeholder-[#9CA3AF] focus:outline-none focus:ring-2 focus:ring-[#0D8568] focus:border-transparent"
                        required
                      />
                      <Calendar className="absolute right-3 top-1/2 transform -translate-y-1/2 text-[#6B8782] pointer-events-none" size={18} />
                    </div>
                  </div>

                  {/* Gender */}
                  <div>
                    <label className="block text-sm font-medium text-[#0D5C4D] mb-2">
                      Gender <span className="text-red-500">*</span>
                    </label>
                    <div className="relative">
                      <select
                        name="gender"
                        value={formData.gender}
                        onChange={handleInputChange}
                        className="w-full px-4 py-2.5 bg-white border border-[#D0E0DB] rounded-lg text-[#0D5C4D] focus:outline-none focus:ring-2 focus:ring-[#0D8568] focus:border-transparent appearance-none cursor-pointer"
                        required
                      >
                        <option value="">Select gender</option>
                        <option value="male">Male</option>
                        <option value="female">Female</option>
                        <option value="other">Other</option>
                      </select>
                      <div className="absolute right-3 top-1/2 transform -translate-y-1/2 pointer-events-none">
                        <svg className="w-4 h-4 text-[#6B8782]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                        </svg>
                      </div>
                    </div>
                  </div>

                  {/* Blood Group */}
                  <div>
                    <label className="block text-sm font-medium text-[#0D5C4D] mb-2">
                      Blood Group
                    </label>
                    <div className="relative">
                      <select
                        name="bloodGroup"
                        value={formData.bloodGroup}
                        onChange={handleInputChange}
                        className="w-full px-4 py-2.5 bg-white border border-[#D0E0DB] rounded-lg text-[#0D5C4D] focus:outline-none focus:ring-2 focus:ring-[#0D8568] focus:border-transparent appearance-none cursor-pointer"
                      >
                        <option value="">Select blood group</option>
                        <option value="A+">A+</option>
                        <option value="A-">A-</option>
                        <option value="B+">B+</option>
                        <option value="B-">B-</option>
                        <option value="AB+">AB+</option>
                        <option value="AB-">AB-</option>
                        <option value="O+">O+</option>
                        <option value="O-">O-</option>
                      </select>
                      <div className="absolute right-3 top-1/2 transform -translate-y-1/2 pointer-events-none">
                        <svg className="w-4 h-4 text-[#6B8782]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                        </svg>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Address */}
                <div className="mt-6">
                  <label className="block text-sm font-medium text-[#0D5C4D] mb-2">
                    Address <span className="text-red-500">*</span>
                  </label>
                  <textarea
                    name="address"
                    value={formData.address}
                    onChange={handleInputChange}
                    placeholder="Enter complete address"
                    rows="4"
                    className="w-full px-4 py-2.5 bg-white border border-[#D0E0DB] rounded-lg text-[#0D5C4D] placeholder-[#9CA3AF] focus:outline-none focus:ring-2 focus:ring-[#0D8568] focus:border-transparent resize-none"
                    required
                  ></textarea>
                </div>
              </div>
            </div>
          </div>

          {/* Work Details Section */}
          <div className="mb-8">
            <h2 className="text-xl font-bold text-[#0D5C4D] mb-6 italic">Work Details</h2>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Work Type */}
              <div>
                <label className="block text-sm font-medium text-[#0D5C4D] mb-2">
                  Work Type <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <select
                    name="workType"
                    value={formData.workType}
                    onChange={handleInputChange}
                    className="w-full px-4 py-2.5 bg-white border border-[#D0E0DB] rounded-lg text-[#0D5C4D] focus:outline-none focus:ring-2 focus:ring-[#0D8568] focus:border-transparent appearance-none cursor-pointer"
                    required
                  >
                    <option value="">Select work type</option>
                    <option value="Normal">Normal</option>
                    <option value="Medium">Medium</option>
                    <option value="Heavy">Heavy</option>
                  </select>
                  <div className="absolute right-3 top-1/2 transform -translate-y-1/2 pointer-events-none">
                    <svg className="w-4 h-4 text-[#6B8782]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                    </svg>
                  </div>
                </div>
              </div>

              {/* Department */}
              <div>
                <label className="block text-sm font-medium text-[#0D5C4D] mb-2">
                  Department <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <select
                    name="department"
                    value={formData.department}
                    onChange={handleInputChange}
                    className="w-full px-4 py-2.5 bg-white border border-[#D0E0DB] rounded-lg text-[#0D5C4D] focus:outline-none focus:ring-2 focus:ring-[#0D8568] focus:border-transparent appearance-none cursor-pointer"
                    required
                  >
                    <option value="">Select department</option>
                    <option value="Packing">Packing</option>
                    <option value="Loading">Loading</option>
                    <option value="Unloading">Unloading</option>
                  </select>
                  <div className="absolute right-3 top-1/2 transform -translate-y-1/2 pointer-events-none">
                    <svg className="w-4 h-4 text-[#6B8782]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                    </svg>
                  </div>
                </div>

              </div>

              {/* Joining Date */}
              <div>
                <label className="block text-sm font-medium text-[#0D5C4D] mb-2">
                  Joining Date <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <input
                    type="date"
                    name="joiningDate"
                    value={formData.joiningDate}
                    onChange={handleInputChange}
                    placeholder="DD/MM/YYYY"
                    className="w-full px-4 py-2.5 bg-white border border-[#D0E0DB] rounded-lg text-[#0D5C4D] placeholder-[#9CA3AF] focus:outline-none focus:ring-2 focus:ring-[#0D8568] focus:border-transparent"
                    required
                  />
                  <Calendar className="absolute right-3 top-1/2 transform -translate-y-1/2 text-[#6B8782] pointer-events-none" size={18} />
                </div>
              </div>

              {/* Status */}
              <div>
                <label className="block text-sm font-medium text-[#0D5C4D] mb-2">
                  Status <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <select
                    name="status"
                    value={formData.status}
                    onChange={handleInputChange}
                    className="w-full px-4 py-2.5 bg-white border border-[#D0E0DB] rounded-lg text-[#0D5C4D] focus:outline-none focus:ring-2 focus:ring-[#0D8568] focus:border-transparent appearance-none cursor-pointer"
                    required
                  >
                    <option value="Live">Live</option>
                    <option value="Terminated">Terminated</option>
                    <option value="Relieved">Relieved</option>
                  </select>
                  <div className="absolute right-3 top-1/2 transform -translate-y-1/2 pointer-events-none">
                    <svg className="w-4 h-4 text-[#6B8782]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                    </svg>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Bank Account Details Section */}
          <div className="mb-8">
            <h2 className="text-xl font-bold text-[#0D5C4D] mb-6 italic">Bank Account Details</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-[#0D5C4D] mb-2">Account Holder Name</label>
                <input
                  type="text"
                  name="accountHolderName"
                  value={formData.accountHolderName}
                  onChange={handleInputChange}
                  placeholder="As per bank account"
                  className="w-full px-4 py-2.5 bg-white border border-[#D0E0DB] rounded-lg text-[#0D5C4D] placeholder-[#9CA3AF] focus:outline-none focus:ring-2 focus:ring-[#0D8568] focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-[#0D5C4D] mb-2">Bank Name</label>
                <input
                  type="text"
                  name="bankName"
                  value={formData.bankName}
                  onChange={handleInputChange}
                  placeholder="Enter bank name"
                  className="w-full px-4 py-2.5 bg-white border border-[#D0E0DB] rounded-lg text-[#0D5C4D] placeholder-[#9CA3AF] focus:outline-none focus:ring-2 focus:ring-[#0D8568] focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-[#0D5C4D] mb-2">Branch Name</label>
                <input
                  type="text"
                  name="branchName"
                  value={formData.branchName}
                  onChange={handleInputChange}
                  placeholder="Enter branch name"
                  className="w-full px-4 py-2.5 bg-white border border-[#D0E0DB] rounded-lg text-[#0D5C4D] placeholder-[#9CA3AF] focus:outline-none focus:ring-2 focus:ring-[#0D8568] focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-[#0D5C4D] mb-2">Account Number</label>
                <input
                  type="text"
                  name="accountNumber"
                  value={formData.accountNumber}
                  onChange={handleInputChange}
                  placeholder="Enter account number"
                  className="w-full px-4 py-2.5 bg-white border border-[#D0E0DB] rounded-lg text-[#0D5C4D] placeholder-[#9CA3AF] focus:outline-none focus:ring-2 focus:ring-[#0D8568] focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-[#0D5C4D] mb-2">IFSC Code</label>
                <input
                  type="text"
                  name="ifscCode"
                  value={formData.ifscCode}
                  onChange={handleInputChange}
                  placeholder="Enter IFSC code"
                  maxLength="11"
                  className="w-full px-4 py-2.5 bg-white border border-[#D0E0DB] rounded-lg text-[#0D5C4D] placeholder-[#9CA3AF] focus:outline-none focus:ring-2 focus:ring-[#0D8568] focus:border-transparent uppercase"
                />
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row items-center justify-end gap-4 pt-6">
            <button
              type="button"
              onClick={handleCancel}
              className="w-full sm:w-auto px-8 py-2 bg-white border border-[#D0E0DB] text-[#0D5C4D] rounded-lg font-medium hover:bg-[#F0F4F3] transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="bg-[#0D7C66] hover:bg-[#0a6354] text-white px-4 sm:px-6 py-2.5 rounded-lg font-medium text-sm flex items-center gap-2 transition-colors shadow-sm disabled:opacity-50"
            >
              {loading ? 'Registering...' : 'Register Labour'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AddLabour;