import React, { useState, useEffect } from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { ArrowLeft, Plus, X } from 'lucide-react';
import { getThirdPartyById, updateThirdParty } from '../../../api/thirdPartyApi';
import { getAllProducts } from '../../../api/productApi';
import { BASE_URL } from '../../../config/config';
import { sortDropdownObjects } from '../../../utils/dropdownSort';

const EditThirdParty = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const location = useLocation();
  const returnTo = location.state?.returnTo;
  const returnPage = location.state?.returnPage || 1;
  const backPath = returnTo === 'vendors'
    ? `/vendors${returnPage > 1 ? `?page=${returnPage}` : ''}`
    : returnTo === 'third-party'
      ? `/third-party${returnPage > 1 ? `?page=${returnPage}` : ''}`
      : '/third-party';
  const returnToVendors = returnTo === 'vendors';
  
  const [formData, setFormData] = useState({
    thirdPartyName: '',
    place: '',
    address: '',
    city: '',
    state: '',
    pincode: '',
    contactPerson: '',
    tapeColor: '',
    dealingPerson: '',
    primaryPhone: '',
    secondaryPhone: '',
    email: '',
    accountHolderName: '',
    bankName: '',
    branchName: '',
    accountNumber: '',
    ifscCode: ''
  });

  const [selectedVegetables, setSelectedVegetables] = useState([]);
  const [availableVegetables, setAvailableVegetables] = useState([]);
  
  // Add profile image state
  const [profileImage, setProfileImage] = useState(null);
  const [profileImagePreview, setProfileImagePreview] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Fetch products from API
  useEffect(() => {
    const fetchProducts = async () => {
      try {
        const response = await getAllProducts(1, 100);
        const products = response.data || [];
        setAvailableVegetables(products.map(p => ({ id: p.pid, name: p.product_name })));
      } catch (error) {
        console.error('Failed to fetch products:', error);
      }
    };
    fetchProducts();
  }, []);

  // Fetch third party data when component mounts
  useEffect(() => {
    const fetchThirdParty = async () => {
      if (!id) return;
      
      try {
        setLoading(true);
        const response = await getThirdPartyById(id);
        const thirdParty = response.data;
        
        // Set form data
        setFormData({
          thirdPartyName: thirdParty.third_party_name || '',
          place: thirdParty.place || '',
          address: thirdParty.address || '',
          city: thirdParty.city || '',
          state: thirdParty.state || '',
          pincode: thirdParty.pin_code || '',
          contactPerson: thirdParty.contact_person || '',
          tapeColor: thirdParty.tape_color || '',
          dealingPerson: thirdParty.dealing_person || '',
          primaryPhone: thirdParty.phone || '',
          secondaryPhone: thirdParty.secondary_phone || '',
          email: thirdParty.email || '',
          accountHolderName: thirdParty.account_holder_name || '',
          bankName: thirdParty.bank_name || '',
          branchName: thirdParty.branch_name || '',
          accountNumber: thirdParty.account_number || '',
          ifscCode: thirdParty.IFSC_code || ''
        });
        
        // Set selected vegetables
        if (thirdParty.detailed_products) {
          setSelectedVegetables(thirdParty.detailed_products.map(product => product.pid));
        }
        
        // Set profile image preview if exists
        if (thirdParty.profile_image) {
          setProfileImagePreview(`${BASE_URL}${thirdParty.profile_image}`);
        }
      } catch (err) {
        console.error('Error fetching third party:', err);
        setError('Failed to load third party data');
      } finally {
        setLoading(false);
      }
    };
    
    fetchThirdParty();
  }, [id]);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const removeVegetable = (index) => {
    setSelectedVegetables(prev => prev.filter((_, i) => i !== index));
  };

  // Add handleImageChange function
  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setProfileImage(file);
      setProfileImagePreview(URL.createObjectURL(file));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    
    try {
      // Prepare data as JSON object
      const submitData = {
        third_party_name: formData.thirdPartyName,
        place: formData.place,
        address: formData.address,
        city: formData.city,
        state: formData.state,
        pin_code: formData.pincode,
        contact_person: formData.contactPerson,
        tape_color: formData.tapeColor,
        dealing_person: formData.dealingPerson,
        phone: formData.primaryPhone,
        secondary_phone: formData.secondaryPhone,
        email: formData.email,
        product_list: selectedVegetables.map(veg => veg.id || veg), // Extract IDs
        account_holder_name: formData.accountHolderName,
        bank_name: formData.bankName,
        branch_name: formData.branchName,
        account_number: formData.accountNumber,
        IFSC_code: formData.ifscCode
      };

      // Call the API with JSON data and profile image
      const response = await updateThirdParty(id, submitData, profileImage);
      // console.log('API Response:', response);
      
      // Navigate back to third party list or vendors (with page) on success
      navigate(backPath);
    } catch (err) {
      console.error('Error updating third party:', err);
      // Log more details about the error for debugging
      if (err.response) {
        console.error('Error response data:', err.response.data);
        console.error('Error response status:', err.response.status);
        console.error('Error response headers:', err.response.headers);
      }
      
      // Handle specific error messages from the API
      if (err.response && err.response.data && err.response.data.message) {
        setError(`Error: ${err.response.data.message}`);
      } else {
        setError(err.message || 'Failed to update third party. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <div className="max-w-5xl mx-auto">
        <div className="flex items-center gap-4 mb-6">
          <button
            onClick={() => navigate(backPath)}
            className="flex items-center gap-2 text-[#0D5C4D] hover:text-[#0a6354] transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
            <span className="font-medium">{returnTo === 'vendors' ? 'Back to Vendors' : returnTo === 'third-party' ? 'Back to Third Party' : 'Back to Third Party'}</span>
          </button>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-[#D0E0DB] p-6">
        <form onSubmit={handleSubmit} className="space-y-8">
          {/* Error Message */}
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <div className="text-red-800 text-sm">{error}</div>
            </div>
          )}
          
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
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Third Party Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  name="thirdPartyName"
                  placeholder="Enter Third Party Name"
                  value={formData.thirdPartyName}
                  onChange={handleInputChange}
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0D7C66] focus:border-transparent text-sm"
                  required
                />
              </div>

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

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Pincode
                </label>
                <input
                  type="text"
                  name="pincode"
                  placeholder="Enter 6-digit pincode"
                  value={formData.pincode}
                  onChange={handleInputChange}
                  maxLength="6"
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0D7C66] focus:border-transparent text-sm"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Contact Person <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  name="contactPerson"
                  placeholder="Full name of contact person"
                  value={formData.contactPerson}
                  onChange={handleInputChange}
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0D7C66] focus:border-transparent text-sm"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Tape Color
                </label>
                <input
                  type="text"
                  name="tapeColor"
                  placeholder="Enter Tape Color"
                  value={formData.tapeColor}
                  onChange={handleInputChange}
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0D7C66] focus:border-transparent text-sm"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Dealing Person
                </label>
                <input
                  type="text"
                  name="dealingPerson"
                  placeholder="Enter Dealing Person"
                  value={formData.dealingPerson}
                  onChange={handleInputChange}
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0D7C66] focus:border-transparent text-sm"
                />
              </div>
            </div>
          </div>

          <div>
            <h3 className="text-lg font-semibold text-gray-800 mb-4">Contact Information</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Primary Phone <span className="text-red-500">*</span> <span className="text-gray-500 text-xs">(10 digits, +91 optional, spaces allowed)</span>
                </label>
                <input
                  type="tel"
                  name="primaryPhone"
                  placeholder="9876543210 or +91 9876543210"
                  value={formData.primaryPhone}
                  onChange={handleInputChange}
                  pattern="^(\+91\s?)?[6-9]\d{4}\s?\d{5}$"
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0D7C66] focus:border-transparent text-sm"
                  required
                />
              </div>

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

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Secondary Phone
                </label>
                <input
                  type="tel"
                  name="secondaryPhone"
                  placeholder="Optional"
                  value={formData.secondaryPhone}
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
                  if (value && !selectedVegetables.includes(value)) {
                    setSelectedVegetables([...selectedVegetables, value]);
                  }
                  e.target.value = '';
                }}
                className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0D7C66] focus:border-transparent text-sm appearance-none bg-white mb-3"
              >
                <option value="">Select items (Multiple selection)</option>
                {sortDropdownObjects(
                  availableVegetables.filter(veg => !selectedVegetables.includes(veg.id)),
                  (veg) => veg.name
                ).map(veg => (
                  <option key={veg.id} value={veg.id}>{veg.name}</option>
                ))}
              </select>

              {/* Selected Vegetables */}
              {selectedVegetables.length > 0 && (
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
                          onClick={() => {
                            const newSelected = [...selectedVegetables];
                            newSelected.splice(index, 1);
                            setSelectedVegetables(newSelected);
                          }}
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

          <div>
            <h3 className="text-lg font-semibold text-gray-800 mb-4">Bank Account Details</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Account Holder Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  name="accountHolderName"
                  placeholder="As per bank account"
                  value={formData.accountHolderName}
                  onChange={handleInputChange}
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0D7C66] focus:border-transparent text-sm"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Bank Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  name="bankName"
                  placeholder="Enter bank name"
                  value={formData.bankName}
                  onChange={handleInputChange}
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0D7C66] focus:border-transparent text-sm"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Branch Name
                </label>
                <input
                  type="text"
                  name="branchName"
                  placeholder="Enter branch name"
                  value={formData.branchName}
                  onChange={handleInputChange}
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0D7C66] focus:border-transparent text-sm"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Account Number <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  name="accountNumber"
                  placeholder="Enter account number"
                  value={formData.accountNumber}
                  onChange={handleInputChange}
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0D7C66] focus:border-transparent text-sm"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  IFSC Code <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  name="ifscCode"
                  placeholder="Enter IFSC code"
                  value={formData.ifscCode}
                  onChange={handleInputChange}
                  maxLength="11"
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0D7C66] focus:border-transparent text-sm uppercase"
                  required
                />
              </div>
            </div>
          </div>

          {/* Form Actions */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-6 border-t border-gray-200">
            <button
              type="submit"
              disabled={loading}
              className={`w-full sm:w-auto px-8 py-3 bg-[#0D7C66] text-white font-semibold rounded-lg transition-colors shadow-sm ${
                loading ? 'opacity-70 cursor-not-allowed' : 'hover:bg-[#0a6354]'
              }`}
            >
              {loading ? 'Updating...' : 'Update Third Party'}
            </button>
            <button
              type="button"
              onClick={() => navigate(backPath)}
              className="w-full sm:w-auto px-8 py-3 bg-red-600 hover:bg-red-700 text-white font-semibold rounded-lg transition-colors shadow-sm"
            >
              Cancel
            </button>
          </div>
        </form>
        </div>
      </div>
    </div>
  );
};

export default EditThirdParty;