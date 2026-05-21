import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Plus, X } from 'lucide-react';
import { createVendor } from '../../../api/vendorApi';
import { fetchAllProducts, mapProductsForDropdown } from '../../../api/productApi';
import { createNotification } from '../../../api/notificationApi';
import { sortDropdownObjects } from '../../../utils/dropdownSort';

const AddVendorForm = () => {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    vendor_name: '',
    place: '',
    address: '',
    city: '',
    state: '',
    pin_code: '',
    contact_person: '',
    tape_color: '',
    dealing_person: '',
    phone: '',
    secondary_phone: '',
    email: '',
    vendor_type: '',
    account_holder_name: '',
    bank_name: '',
    branch_name: '',
    account_number: '',
    IFSC_code: ''
  });

  const [selectedProducts, setSelectedProducts] = useState([]);
  const [availableProducts, setAvailableProducts] = useState([]);
  const [profileImage, setProfileImage] = useState(null);
  const [profileImagePreview, setProfileImagePreview] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [formErrors, setFormErrors] = useState({});

  // Fetch products from API
  useEffect(() => {
    const fetchProducts = async () => {
      try {
        const products = await fetchAllProducts();
        setAvailableProducts(mapProductsForDropdown(products));
      } catch (error) {
        console.error('Failed to fetch products:', error);
      }
    };
    fetchProducts();
  }, []);

  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setProfileImage(file);
      setProfileImagePreview(URL.createObjectURL(file));
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ 
      ...prev, 
      [name]: value 
    }));
    
    // Clear error for this field when user starts typing
    if (formErrors[name]) {
      setFormErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[name];
        return newErrors;
      });
    }
  };

  const removeProduct = (index) => {
    setSelectedProducts(prev => prev.filter((_, i) => i !== index));
  };

  const validateField = (name, value) => {
    switch (name) {
      case 'vendor_name':
        if (!value || value.trim().length < 2) {
          return 'Vendor name is required and must be at least 2 characters long';
        }
        break;
      case 'vendor_type':
        if (!value) {
          return 'Vendor type is required';
        }
        if (!['farmer', 'supplier', 'thirdparty'].includes(value)) {
          return 'Vendor type must be farmer, supplier, or thirdparty';
        }
        break;
      case 'place':
        if (!value || value.trim().length < 2) {
          return 'Place is required and must be at least 2 characters long';
        }
        break;
      case 'phone':
        if (!value) {
          return 'Phone number is required';
        }
        const phoneRegex = /^(\+91\s?)?[6-9]\d{4}\s?\d{5}$/;
        if (!phoneRegex.test(value)) {
          return 'Phone must be 10 digits starting with 6-9 (+91 optional, spaces allowed)';
        }
        break;
      default:
        return null;
    }
    return null;
  };

  const validateForm = () => {
    const errors = {};
    const requiredFields = [
      'vendor_name', 'vendor_type', 'place', 'phone'
    ];
    
    // Validate all required fields
    requiredFields.forEach(field => {
      const error = validateField(field, formData[field]);
      if (error) {
        errors[field] = error;
      }
    });
    
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    
    // Validate form
    if (!validateForm()) {
      setLoading(false);
      // Set a general error message
      setError('Please fix the errors in the form');
      return;
    }
    
    try {
      // Prepare vendor data - ensure all required fields are included
      const vendorData = {
        vendor_name: formData.vendor_name.trim(),
        vendor_type: formData.vendor_type,
        place: formData.place.trim(),
        phone: formData.phone.replace(/\s/g, ''),
        address: formData.address ? formData.address.trim() : null,
        city: formData.city ? formData.city.trim() : null,
        state: formData.state ? formData.state.trim() : null,
        pin_code: formData.pin_code ? formData.pin_code.trim() : null,
        // Optional fields
        contact_person: formData.contact_person ? formData.contact_person.trim() : null,
        tape_color: formData.tape_color ? formData.tape_color.trim() : null,
        dealing_person: formData.dealing_person ? formData.dealing_person.trim() : null,
        secondary_phone: formData.secondary_phone ? formData.secondary_phone.replace(/\s/g, '').replace('+91', '') : null,
        email: formData.email ? formData.email.trim() : null,
        account_holder_name: formData.account_holder_name ? formData.account_holder_name.trim() : null,
        bank_name: formData.bank_name ? formData.bank_name.trim() : null,
        branch_name: formData.branch_name ? formData.branch_name.trim() : null,
        account_number: formData.account_number ? formData.account_number.trim() : null,
        IFSC_code: formData.IFSC_code ? formData.IFSC_code.trim().toUpperCase() : null,
        product_list: selectedProducts && selectedProducts.length > 0 ? selectedProducts : [] // Ensure it's always an array
      };
      
      // Log the data being sent for debugging
      // console.log('Form data being sent:', vendorData);
      
      // Create vendor
      const response = await createVendor(vendorData, profileImage);
      
      if (response.success) {
        try {
          await createNotification({
            title: 'New vendor added',
            message: `Vendor ${vendorData.vendor_name} has been registered as ${vendorData.vendor_type}.`,
            type: 'success',
            category: 'Vendors'
          });
        } catch (notifyErr) {
          console.error('Failed to create vendor notification:', notifyErr);
        }
        navigate('/vendors');
      } else {
        setError(response.message || 'Failed to create vendor');
      }
    } catch (err) {
      console.error('Error creating vendor:', err);
      
      // Handle different types of errors
      if (err.response && err.response.data && err.response.data.errors) {
        // Sequelize validation errors
        const errors = err.response.data.errors;
        const errorMessages = errors.map(e => {
          // Include both message and path if available
          return e.path ? `${e.path}: ${e.message}` : e.message;
        }).join(', ');
        setError(`Validation failed: ${errorMessages}`);
        
        // Set individual field errors
        const fieldErrors = {};
        errors.forEach(error => {
          if (error.path) {
            fieldErrors[error.path] = error.message;
          }
        });
        setFormErrors(fieldErrors);
      } else if (err.response && err.response.data && err.response.data.message) {
        // Other backend errors
        setError(err.response.data.message);
      } else {
        // Generic errors
        setError(err.message || 'Failed to create vendor');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSaveDraft = () => {
    console.log('Saved as draft:', formData);
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="flex items-center gap-4 mb-6">
          <button
            onClick={() => navigate('/vendors')}
            className="flex items-center gap-2 text-[#0D5C4D] hover:text-[#0a6354] transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
            <span className="font-medium">Back to Vendors</span>
          </button>
        </div>

        {/* Error Message */}
        {error && (
          <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4">
            <div className="text-red-800 text-sm">{error}</div>
          </div>
        )}

        {/* Form Content */}
        <div className="bg-white rounded-2xl shadow-sm border border-[#D0E0DB] p-6">
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
                {/* Vendor Name */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Vendor Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    name="vendor_name"
                    placeholder="Enter Vendor Name"
                    value={formData.vendor_name}
                    onChange={handleInputChange}
                    className={`w-full px-4 py-2.5 border rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0D7C66] focus:border-transparent text-sm ${
                      formErrors.vendor_name ? 'border-red-500' : 'border-gray-200'
                    }`}
                    required
                  />
                  {formErrors.vendor_name && (
                    <p className="mt-1 text-sm text-red-600">{formErrors.vendor_name}</p>
                  )}
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
                    className={`w-full px-4 py-2.5 border rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0D7C66] focus:border-transparent text-sm ${
                      formErrors.place ? 'border-red-500' : 'border-gray-200'
                    }`}
                    required
                  />
                  {formErrors.place && (
                    <p className="mt-1 text-sm text-red-600">{formErrors.place}</p>
                  )}
                </div>
                  
                {/* Vendor Type */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Vendor Type <span className="text-red-500">*</span>
                  </label>
                  <select
                    name="vendor_type"
                    value={formData.vendor_type}
                    onChange={handleInputChange}
                    className={`w-full px-4 py-2.5 border rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0D7C66] focus:border-transparent text-sm ${
                      formErrors.vendor_type ? 'border-red-500' : 'border-gray-200'
                    }`}
                    required
                  >
                    <option value="">Select Vendor Type</option>
                    <option value="farmer">Farmer</option>
                    <option value="supplier">Supplier</option>
                    <option value="thirdparty">Third Party</option>
                  </select>
                  {formErrors.vendor_type && (
                    <p className="mt-1 text-sm text-red-600">{formErrors.vendor_type}</p>
                  )}
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

                {/* Pin Code */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Pin Code
                  </label>
                  <input
                    type="text"
                    name="pin_code"
                    placeholder="Enter 6-digit pin code"
                    value={formData.pin_code}
                    onChange={handleInputChange}
                    maxLength="6"
                    className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0D7C66] focus:border-transparent text-sm"
                  />
                </div>

                {/* Contact Person */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Contact Person
                  </label>
                  <input
                    type="text"
                    name="contact_person"
                    placeholder="Full name of contact person"
                    value={formData.contact_person}
                    onChange={handleInputChange}
                    className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0D7C66] focus:border-transparent text-sm"
                  />
                </div>

                {/* Tape Color */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Tape Color
                  </label>
                  <input
                    type="text"
                    name="tape_color"
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
                    name="dealing_person"
                    placeholder="Enter Dealing Person"
                    value={formData.dealing_person}
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
                {/* Phone */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Phone <span className="text-red-500">*</span> <span className="text-gray-500 text-xs">(10 digits, +91 optional, spaces allowed)</span>
                  </label>
                  <input
                    type="tel"
                    name="phone"
                    placeholder="9876543210 or +91 9876543210"
                    value={formData.phone}
                    onChange={handleInputChange}
                    pattern="^(\+91\s?)?[6-9]\d{4}\s?\d{5}$"
                    className={`w-full px-4 py-2.5 border rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0D7C66] focus:border-transparent text-sm ${
                      formErrors.phone ? 'border-red-500' : 'border-gray-200'
                    }`}
                    required
                  />
                  {formErrors.phone && (
                    <p className="mt-1 text-sm text-red-600">{formErrors.phone}</p>
                  )}
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
                    name="secondary_phone"
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
                  Products Supplied
                </label>
                <select
                  onChange={(e) => {
                    const value = parseInt(e.target.value);
                    if (value && !selectedProducts.includes(value)) {
                      setSelectedProducts([...selectedProducts, value]);
                    }
                    e.target.value = '';
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Tab' || e.key === 'ArrowRight' || e.key === 'ArrowLeft' || e.key === 'ArrowDown' || e.key === 'ArrowUp') {
                      e.preventDefault();
                    }
                  }}
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0D7C66] focus:border-transparent text-sm appearance-none bg-white mb-3"
                >
                  <option value="">Select items (Multiple selection)</option>
                  {sortDropdownObjects(
                    availableProducts.filter(product => !selectedProducts.includes(product.id)),
                    (product) => product.name
                  ).map(product => (
                    <option key={product.id} value={product.id}>{product.name}</option>
                  ))}
                </select>

                {/* Selected Products */}
                {selectedProducts.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {selectedProducts.map((productId, index) => {
                      const product = availableProducts.find(p => p.id === productId);
                      return (
                        <span
                          key={index}
                          className="px-3 py-1.5 rounded-lg text-sm font-medium bg-blue-100 text-blue-700 flex items-center gap-2"
                        >
                          {product?.name}
                          <button
                            type="button"
                            onClick={() => removeProduct(index)}
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
                    Account Holder Name
                  </label>
                  <input
                    type="text"
                    name="account_holder_name"
                    placeholder="As per bank account"
                    value={formData.account_holder_name}
                    onChange={handleInputChange}
                    className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0D7C66] focus:border-transparent text-sm"
                  />
                </div>

                {/* Bank Name */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Bank Name
                  </label>
                  <input
                    type="text"
                    name="bank_name"
                    placeholder="Enter bank name"
                    value={formData.bank_name}
                    onChange={handleInputChange}
                    className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0D7C66] focus:border-transparent text-sm"
                  />
                </div>

                {/* Branch Name */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Branch Name
                  </label>
                  <input
                    type="text"
                    name="branch_name"
                    placeholder="Enter branch name"
                    value={formData.branch_name}
                    onChange={handleInputChange}
                    className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0D7C66] focus:border-transparent text-sm"
                  />
                </div>

                {/* Account Number */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Account Number
                  </label>
                  <input
                    type="text"
                    name="account_number"
                    placeholder="Enter account number"
                    value={formData.account_number}
                    onChange={handleInputChange}
                    className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0D7C66] focus:border-transparent text-sm"
                  />
                </div>

                {/* IFSC Code */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    IFSC Code
                  </label>
                  <input
                    type="text"
                    name="IFSC_code"
                    placeholder="Enter IFSC code"
                    value={formData.IFSC_code}
                    onChange={handleInputChange}
                    maxLength="11"
                    className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0D7C66] focus:border-transparent text-sm uppercase"
                  />
                </div>
              </div>
            </div>

            {/* Form Actions */}
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-6 border-t border-gray-200">
              <button
                type="submit"
                disabled={loading}
                className={`w-full sm:w-auto px-8 py-3 bg-[#0D7C66] hover:bg-[#0a6354] text-white font-semibold rounded-lg transition-colors shadow-sm ${loading ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                {loading ? 'Adding Vendor...' : 'Add Vendor'}
              </button>
              <button
                type="button"
                onClick={() => navigate('/vendors')}
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

export default AddVendorForm;