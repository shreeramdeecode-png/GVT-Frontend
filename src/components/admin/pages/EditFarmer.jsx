import React, { useState, useEffect } from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { ArrowLeft, Plus, X } from 'lucide-react';
import { getFarmerById, updateFarmer } from '../../../api/farmerApi';
import { fetchAllProducts, mapProductsForDropdown } from '../../../api/productApi';
import { BASE_URL } from '../../../config/config';

const normalizePhoneWithCountryCode = (value) => {
  const raw = String(value ?? '').trim();
  if (!raw) return '';
  if (raw.startsWith('+')) return raw;
  const digits = raw.replace(/\D/g, '');
  if (digits.length === 10) return `+91 ${digits}`;
  return raw;
};

const EditFarmer = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const location = useLocation();
  const returnTo = location.state?.returnTo;
  const returnPage = location.state?.returnPage || 1;
  const backPath = returnTo === 'vendors'
    ? `/vendors${returnPage > 1 ? `?page=${returnPage}` : ''}`
    : returnTo === 'farmers'
      ? `/farmers${returnPage > 1 ? `?page=${returnPage}` : ''}`
      : '/farmers';
  const returnToVendors = returnTo === 'vendors';
  
  const [formData, setFormData] = useState({
    farmer_name: '',
    place: '',
    address: '',
    city: '',
    state: '',
    pin_code: '',
    contact_person: '',
    tape_color: '',
    dialing_person: '',
    primary_phone: '',
    secondary_phone: '',
    email: '',
    account_holder_name: '',
    bank_name: '',
    branch_name: '',
    account_number: '',
    IFSC_code: '',
    status: 'active'
  });

  const [selectedVegetables, setSelectedVegetables] = useState([]);
  const [availableVegetables, setAvailableVegetables] = useState([]);
  const [profileImage, setProfileImage] = useState(null);
  const [profileImagePreview, setProfileImagePreview] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);

  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setProfileImage(file);
      setProfileImagePreview(URL.createObjectURL(file));
    }
  };

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [farmerResponse, productsResponse] = await Promise.all([
          getFarmerById(id),
          fetchAllProducts()
        ]);
        
        const products = Array.isArray(productsResponse) ? productsResponse : (productsResponse?.data || []);
        const productMap = {};
        products.forEach(p => {
          productMap[p.pid] = p.product_name;
        });
        
        const data = farmerResponse.data || farmerResponse;
        setFormData({
          farmer_name: data.farmer_name || '',
          place: data.place || '',
          address: data.address || '',
          city: data.city || '',
          state: data.state || '',
          pin_code: data.pin_code || '',
          contact_person: data.contact_person || '',
          tape_color: data.tape_color || '',
          dialing_person: data.dealing_person || '',
          primary_phone: normalizePhoneWithCountryCode(data.phone || ''),
          secondary_phone: normalizePhoneWithCountryCode(data.secondary_phone || ''),
          email: data.email || '',
          account_holder_name: data.account_holder_name || '',
          bank_name: data.bank_name || '',
          branch_name: data.branch_name || '',
          account_number: data.account_number || '',
          IFSC_code: data.IFSC_code || '',
          status: data.status || 'active'
        });
        
        if (data.profile_image) {
          setProfileImagePreview(`${BASE_URL}${data.profile_image}`);
        }
        
        // Parse product_list - handle both JSON string and array
        let productIds = [];
        if (typeof data.product_list === 'string') {
          try {
            const parsed = JSON.parse(data.product_list);
            if (Array.isArray(parsed)) {
              productIds = parsed.map(item => 
                typeof item === 'object' && item.pid 
                  ? item.pid 
                  : parseInt(item)
              );
            }
          } catch (e) {
            productIds = [];
          }
        } else if (Array.isArray(data.product_list)) {
          productIds = data.product_list.map(item => 
            typeof item === 'object' && item.pid 
              ? item.pid 
              : parseInt(item)
          );
        }
        setSelectedVegetables(productIds);
        
        setAvailableVegetables(mapProductsForDropdown(products));
      } catch (err) {
        console.error('Error fetching data:', err);
        setError('Failed to load data');
      }
    };
    fetchData();
  }, [id]);


  const handleInputChange = (e) => {
    const { name, value } = e.target;
    const fieldMap = {
      farmerName: 'farmer_name',
      place: 'place',
      contactPerson: 'contact_person',
      tapeColor: 'tape_color',
      dialingPerson: 'dialing_person',
      primaryPhone: 'primary_phone',
      secondaryPhone: 'secondary_phone',
      pincode: 'pin_code',
      accountHolderName: 'account_holder_name',
      bankName: 'bank_name',
      branchName: 'branch_name',
      accountNumber: 'account_number',
      ifscCode: 'IFSC_code'
    };
    const fieldName = fieldMap[name] || name;
    setFormData(prev => ({ ...prev, [fieldName]: value }));
  };

  const removeVegetable = (index) => {
    setSelectedVegetables(prev => Array.isArray(prev) ? prev.filter((_, i) => i !== index) : []);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);
    setSuccess(false);

    try {
      const farmerPayload = {
        farmer_name: formData.farmer_name,
        place: formData.place,
        phone: formData.primary_phone,
        secondary_phone: formData.secondary_phone,
        email: formData.email,
        address: formData.address,
        city: formData.city,
        state: formData.state,
        pin_code: formData.pin_code,
        contact_person: formData.contact_person,
        tape_color: formData.tape_color,
        dealing_person: formData.dialing_person,
        product_list: JSON.stringify(selectedVegetables),
        status: formData.status,
        account_holder_name: formData.account_holder_name,
        bank_name: formData.bank_name,
        branch_name: formData.branch_name,
        account_number: formData.account_number,
        IFSC_code: formData.IFSC_code
      };

      await updateFarmer(id, farmerPayload);
      setSuccess(true);
      setTimeout(() => navigate(backPath), 1500);
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Failed to update farmer');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="flex items-center gap-4 mb-6">
          <button
            onClick={() => navigate(backPath)}
            className="flex items-center gap-2 text-[#0D5C4D] hover:text-[#0a6354] transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
            <span className="font-medium">{returnTo === 'vendors' ? 'Back to Vendors' : returnTo === 'farmers' ? 'Back to Farmers' : 'Back to Farmers'}</span>
          </button>
        </div>

        {/* Form Content */}
        <div className="bg-white rounded-2xl shadow-sm border border-[#D0E0DB] p-6">
        {success && (
          <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg">
            <p className="text-green-800 text-sm font-medium">✓ Farmer updated successfully! Redirecting...</p>
          </div>
        )}
        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-red-800 text-sm font-medium">✗ {error}</p>
          </div>
        )}
        <form onSubmit={handleSubmit} className="space-y-8">
          {/* Personal Information */}
          <div>
            <h3 className="text-lg font-semibold text-gray-800 mb-4">Personal Information</h3>
            
            {/* Profile Image Upload */}
            <div className="mb-6 flex items-center gap-6">
              <div className="w-24 h-24 rounded-full bg-gray-100 flex items-center justify-center overflow-hidden">
                {profileImagePreview ? (
                  <img src={profileImagePreview} alt="Profile" className="w-full h-full object-cover" />
                ) : (
                  <span className="text-gray-400 text-3xl">👤</span>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Profile Image</label>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleImageChange}
                  className="text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-[#0D7C66] file:text-white hover:file:bg-[#0a6354] file:cursor-pointer"
                />
                <p className="text-xs text-gray-500 mt-1">JPG, PNG or GIF. Max 2MB.</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Farmer Name */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Farmer Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  name="farmerName"
                  placeholder="Enter Farmer Name"
                  value={formData.farmer_name}
                  onChange={handleInputChange}
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0D7C66] focus:border-transparent text-sm"
                  required
                />
              </div>

              {/* Place */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Place <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  name="place"
                  placeholder="Enter Place"
                  value={formData.place}
                  onChange={handleInputChange}
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0D7C66] focus:border-transparent text-sm"
                  required
                />
              </div>

              {/* Address */}
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Address
                </label>
                <textarea
                  name="address"
                  placeholder="Enter complete address&#10;Street, Landmark"
                  value={formData.address}
                  onChange={handleInputChange}
                  rows="3"
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0D7C66] focus:border-transparent text-sm resize-none"
                />
              </div>

              {/* City */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  City
                </label>
                <input
                  type="text"
                  name="city"
                  placeholder="Enter city"
                  value={formData.city}
                  onChange={handleInputChange}
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0D7C66] focus:border-transparent text-sm"
                />
              </div>

              {/* State */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  State
                </label>
                <input
                  type="text"
                  name="state"
                  placeholder="Enter state"
                  value={formData.state}
                  onChange={handleInputChange}
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0D7C66] focus:border-transparent text-sm"
                />
              </div>

              {/* Pincode */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Pincode
                </label>
                <input
                  type="text"
                  name="pincode"
                  placeholder="Enter 6-digit pincode"
                  value={formData.pin_code}
                  onChange={handleInputChange}
                  maxLength="6"
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0D7C66] focus:border-transparent text-sm"
                />
              </div>

              {/* Contact Person */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Contact Person <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  name="contactPerson"
                  placeholder="Full name of contact person"
                  value={formData.contact_person}
                  onChange={handleInputChange}
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0D7C66] focus:border-transparent text-sm"
                  required
                />
              </div>

              {/* Tape Color */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Tape Color
                </label>
                <input
                  type="text"
                  name="tapeColor"
                  placeholder="Enter Tape Color"
                  value={formData.tape_color}
                  onChange={handleInputChange}
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0D7C66] focus:border-transparent text-sm"
                />
              </div>

              {/* Dealing Person */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Dealing Person
                </label>
                <input
                  type="text"
                  name="dialingPerson"
                  placeholder="Enter Dealing Person"
                  value={formData.dialing_person}
                  onChange={handleInputChange}
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0D7C66] focus:border-transparent text-sm"
                />
              </div>
            </div>
          </div>

          {/* Contact Information */}
          <div>
            <h3 className="text-lg font-semibold text-gray-800 mb-4">Contact Information</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Primary Phone */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Primary Phone <span className="text-red-500">*</span> <span className="text-gray-500 text-xs">(10 digits, +91 optional, spaces allowed)</span>
                </label>
                <input
                  type="tel"
                  name="primaryPhone"
                  placeholder="9876543210 or +91 9876543210"
                  value={formData.primary_phone}
                  onChange={handleInputChange}
                  pattern="^(\+91\s?)?[6-9]\d{4}\s?\d{5}$"
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0D7C66] focus:border-transparent text-sm"
                  required
                />
              </div>

              {/* Email Address */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Email Address
                </label>
                <input
                  type="email"
                  name="email"
                  placeholder="email@example.com"
                  value={formData.email}
                  onChange={handleInputChange}
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0D7C66] focus:border-transparent text-sm"
                />
              </div>

              {/* Secondary Phone */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Secondary Phone
                </label>
                <input
                  type="tel"
                  name="secondaryPhone"
                  placeholder="Optional"
                  value={formData.secondary_phone}
                  onChange={handleInputChange}
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0D7C66] focus:border-transparent text-sm"
                />
              </div>
            </div>
          </div>

          {/* Product List */}
          <div>
            <h3 className="text-lg font-semibold text-gray-800 mb-4">Product List</h3>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Vegetables Supplied <span className="text-red-500">*</span>
              </label>
              <select
                onChange={(e) => {
                  const value = parseInt(e.target.value);
                  const currentVegetables = Array.isArray(selectedVegetables) ? selectedVegetables : [];
                  if (value && !currentVegetables.includes(value)) {
                    setSelectedVegetables([...currentVegetables, value]);
                  }
                  e.target.value = '';
                }}
                className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0D7C66] focus:border-transparent text-sm appearance-none bg-white mb-3"
              >
                <option value="">Select items (Multiple selection)</option>
                {availableVegetables.filter(veg => !Array.isArray(selectedVegetables) || !selectedVegetables.includes(veg.id)).map(veg => (
                  <option key={veg.id} value={veg.id}>{veg.name}</option>
                ))}
              </select>

              {/* Selected Vegetables */}
              {Array.isArray(selectedVegetables) && selectedVegetables.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {selectedVegetables.map((vegId, index) => {
                    const veg = availableVegetables.find(v => v.id === vegId);
                    return (
                      <span
                        key={index}
                        className="px-3 py-1.5 rounded-lg text-sm font-medium bg-blue-100 text-blue-700 flex items-center gap-2"
                      >
                        {veg?.name}
                        <button
                          type="button"
                          onClick={() => removeVegetable(index)}
                          className="hover:opacity-70"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </span>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Bank Account Details */}
          <div>
            <h3 className="text-lg font-semibold text-gray-800 mb-4">Bank Account Details</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Account Holder Name */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Account Holder Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  name="accountHolderName"
                  placeholder="As per bank account"
                  value={formData.account_holder_name}
                  onChange={handleInputChange}
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0D7C66] focus:border-transparent text-sm"
                  required
                />
              </div>

              {/* Bank Name */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Bank Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  name="bankName"
                  placeholder="Enter bank name"
                  value={formData.bank_name}
                  onChange={handleInputChange}
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0D7C66] focus:border-transparent text-sm"
                  required
                />
              </div>

              {/* Branch Name */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Branch Name
                </label>
                <input
                  type="text"
                  name="branchName"
                  placeholder="Enter branch name"
                  value={formData.branch_name}
                  onChange={handleInputChange}
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0D7C66] focus:border-transparent text-sm"
                />
              </div>

              {/* Account Number */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Account Number <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  name="accountNumber"
                  placeholder="Enter account number"
                  value={formData.account_number}
                  onChange={handleInputChange}
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0D7C66] focus:border-transparent text-sm"
                  required
                />
              </div>

              {/* IFSC Code */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  IFSC Code <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  name="ifscCode"
                  placeholder="Enter IFSC code"
                  value={formData.IFSC_code}
                  onChange={handleInputChange}
                  maxLength="11"
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0D7C66] focus:border-transparent text-sm uppercase"
                  required
                />
              </div>
            </div>
          </div>

          {/* Form Actions */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-6 border-t border-gray-200">
            {/* Farmer Status Toggle */}
            <div className="flex items-center gap-3">
              <span className="text-sm text-gray-700 font-medium">Farmer Status</span>
              <button
                type="button"
                onClick={() => setFormData(prev => ({ ...prev, status: prev.status === 'active' ? 'inactive' : 'active' }))}
                className={`relative inline-flex h-7 w-12 items-center rounded-full transition-colors ${
                  formData.status === 'active' ? 'bg-[#0D7C66]' : 'bg-gray-300'
                }`}
              >
                <span
                  className={`inline-block h-5 w-5 transform rounded-full bg-white transition-transform ${
                    formData.status === 'active' ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
              <span className={`text-sm font-medium ${formData.status === 'active' ? 'text-[#0D7C66]' : 'text-gray-500'}`}>
                {formData.status === 'active' ? 'Active' : 'Inactive'}
              </span>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => navigate(backPath)}
                disabled={isLoading}
                className="px-8 py-3 bg-red-600 hover:bg-red-700 text-white font-semibold rounded-lg transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isLoading}
                className="px-8 py-3 bg-[#0D7C66] hover:bg-[#0a6354] text-white font-semibold rounded-lg transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isLoading ? 'Updating...' : 'Update Farmer'}
              </button>
            </div>
          </div>
        </form>
        </div>
      </div>
    </div>
  );
};

export default EditFarmer;