import React, { useState, useEffect } from 'react';
import { X, ChevronDown, ArrowLeft } from 'lucide-react';
import { useNavigate, useParams } from 'react-router-dom';

const EditVendorDetails = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const [profileImage, setProfileImage] = useState(null);
  const [profileImagePreview, setProfileImagePreview] = useState(null);

  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setProfileImage(file);
      setProfileImagePreview(URL.createObjectURL(file));
    }
  };

  const [formData, setFormData] = useState({
    vendorName: '',
    vendorType: 'farmer',
    place: '',
    address: '',
    city: '',
    state: '',
    pincode: '',
    contactPerson: '',
    tapeColor: '',
    dealingPerson: '',
    primaryPhone: '',
    email: '',
    secondaryPhone: '',
    accountHolderName: '',
    bankName: 'hdfc',
    branchName: '',
    accountNumber: '',
    ifscCode: '',
  });

  const [selectedVegetables, setSelectedVegetables] = useState([]);
  const [loading, setLoading] = useState(true);

  // Mock vendor data - in real app, this would come from API
  const vendorData = {
    'VEN-001': {
      vendorName: 'Green Fields Farm',
      vendorType: 'farmer',
      registrationNumber: 'GFF001234567890',
      address: '123 Farm Road\nCoimbatore District',
      city: 'coimbatore',
      state: 'tamilnadu',
      pincode: '641001',
      contactPerson: 'Ravi Kumar',
      tapeColor: 'GREEN',
      dealingPerson: 'Sachin Sharma',
      primaryPhone: '+91 98765 43210',
      email: 'contact@greenfields.in',
      secondaryPhone: '+91 98765 43211',
      accountHolderName: 'Green Fields Farm',
      bankName: 'hdfc',
      branchName: 'Coimbatore Main',
      accountNumber: '50100123456789',
      ifscCode: 'HDFC0001234',
      vegetables: [
        { name: 'Tomatoes', color: 'bg-red-100 text-red-700' },
        { name: 'Carrots', color: 'bg-orange-100 text-orange-700' },
        { name: 'Beans', color: 'bg-green-100 text-green-700' },
        { name: 'Potatoes', color: 'bg-amber-100 text-amber-700' }
      ]
    },
    'VEN-002': {
      vendorName: 'Fresh Vegetable Supply Co.',
      vendorType: 'supplier',
      registrationNumber: 'FVS002345678901',
      address: '456 Supply Street\nKochi',
      city: 'kochi',
      state: 'kerala',
      pincode: '682001',
      contactPerson: 'Priya Nair',
      tapeColor: 'BLUE',
      dealingPerson: 'Rahul Menon',
      primaryPhone: '+91 98765 43211',
      email: 'sales@freshveg.com',
      secondaryPhone: '+91 98765 43212',
      accountHolderName: 'Fresh Vegetable Supply Co.',
      bankName: 'sbi',
      branchName: 'Kochi Branch',
      accountNumber: '30123456789012',
      ifscCode: 'SBIN0001234',
      vegetables: [
        { name: 'Potatoes', color: 'bg-amber-100 text-amber-700' },
        { name: 'Onions', color: 'bg-purple-100 text-purple-700' },
        { name: 'Cabbage', color: 'bg-green-100 text-green-700' }
      ]
    }
  };

  useEffect(() => {
    // Simulate API call to fetch vendor data
    const fetchVendor = () => {
      setLoading(true);
      const vendor = vendorData[id];
      if (vendor) {
        setFormData({
          vendorName: vendor.vendorName,
          vendorType: vendor.vendorType,
          place: vendor.place,
          address: vendor.address,
          city: vendor.city,
          state: vendor.state,
          pincode: vendor.pincode,
          contactPerson: vendor.contactPerson,
          tapeColor: vendor.tapeColor,
          dealingPerson: vendor.dealingPerson,
          primaryPhone: vendor.primaryPhone,
          email: vendor.email,
          secondaryPhone: vendor.secondaryPhone,
          accountHolderName: vendor.accountHolderName,
          bankName: vendor.bankName,
          branchName: vendor.branchName,
          accountNumber: vendor.accountNumber,
          ifscCode: vendor.ifscCode,
        });
        setSelectedVegetables(vendor.vegetables || []);
      }
      setLoading(false);
    };

    fetchVendor();
  }, [id]);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const removeVegetable = (index) => {
    setSelectedVegetables((prev) => prev.filter((_, i) => i !== index));
  };

  const handleConfirm = (e) => {
    e.preventDefault();
    // console.log('Form updated:', formData);
  };

  const handleCancel = () => {
    navigate('/vendors');
  };

  const handleBackClick = () => {
    navigate('/vendors');
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 p-4 md:p-6 lg:p-8 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading vendor details...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-6 lg:p-8">
      <div className="max-w-7xl mx-auto">
        {/* Page Header with Back Button */}
        <div className="mb-6">
          <div className="flex items-center gap-4 mb-4">
            <button
              onClick={handleBackClick}
              className="flex items-center gap-2 px-4 py-2 text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
              <span>Back to Vendors</span>
            </button>
          </div>
          <h1 className="text-2xl md:text-3xl font-bold text-gray-900 mb-1">
            Edit Vendor Details
          </h1>
          <p className="text-sm text-gray-500">
            Update vendor information and performance tracking
          </p>
        </div>

        {/* Form Container */}
        <div className="bg-white rounded-xl shadow-sm p-6 md:p-8">
          <form onSubmit={handleConfirm}>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-12">
              {/* Left Column - Personal Information */}
              <div>
                <h2 className="text-lg font-bold text-gray-900 mb-6">
                  Personal Information
                </h2>

                <div className="space-y-5">
                  {/* Vendor Name */}
                  <div>
                    <label className="block text-sm font-medium text-gray-900 mb-2">
                      Vendor Name <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      name="vendorName"
                      value={formData.vendorName}
                      onChange={handleInputChange}
                      className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent text-gray-900"
                      required
                    />
                  </div>

                  {/* Vendor Type and Registration Number */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-900 mb-2">
                        Vendor Type <span className="text-red-500">*</span>
                      </label>
                      <div className="relative">
                        <select
                          name="vendorType"
                          value={formData.vendorType}
                          onChange={handleInputChange}
                          className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent text-gray-900 appearance-none bg-white capitalize"
                          required
                        >
                          <option value="farmer">Farmer</option>
                          <option value="supplier">Supplier</option>
                          <option value="third-party">Third Party</option>
                        </select>
                        <ChevronDown className="absolute right-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400 pointer-events-none" />
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-900 mb-2">
                        Place <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        name="place"
                        value={formData.place}
                        onChange={handleInputChange}
                        className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent text-gray-900"
                        required
                      />
                    </div>
                  </div>

                  {/* Address */}
                  <div>
                    <label className="block text-sm font-medium text-gray-900 mb-2">
                      Address
                    </label>
                    <textarea
                      name="address"
                      value={formData.address}
                      onChange={handleInputChange}
                      rows="3"
                      className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent text-gray-900 resize-none"
                    />
                  </div>

                  {/* City and State */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-900 mb-2">
                        City
                      </label>
                      <div className="relative">
                        <select
                          name="city"
                          value={formData.city}
                          onChange={handleInputChange}
                          className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent text-gray-900 appearance-none bg-white capitalize"
                        >
                          <option value="">Select City</option>
                          <option value="bangalore">Bangalore</option>
                          <option value="chennai">Chennai</option>
                          <option value="delhi">Delhi</option>
                          <option value="mumbai">Mumbai</option>
                        </select>
                        <ChevronDown className="absolute right-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400 pointer-events-none" />
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-900 mb-2">
                        State
                      </label>
                      <div className="relative">
                        <select
                          name="state"
                          value={formData.state}
                          onChange={handleInputChange}
                          className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent text-gray-900 appearance-none bg-white capitalize"
                        >
                          <option value="">Select State</option>
                          <option value="delhi">Delhi</option>
                          <option value="karnataka">Karnataka</option>
                          <option value="maharashtra">Maharashtra</option>
                          <option value="tamilnadu">Tamilnadu</option>
                        </select>
                        <ChevronDown className="absolute right-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400 pointer-events-none" />
                      </div>
                    </div>
                  </div>

                  {/* Pincode and Contact Person */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-900 mb-2">
                        Pincode
                      </label>
                      <input
                        type="text"
                        name="pincode"
                        value={formData.pincode}
                        onChange={handleInputChange}
                        maxLength="6"
                        className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent text-gray-900"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-900 mb-2">
                        Contact Person <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        name="contactPerson"
                        value={formData.contactPerson}
                        onChange={handleInputChange}
                        className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent text-gray-900"
                        required
                      />
                    </div>
                  </div>

                  {/* Tape Color and Dealing Person */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-900 mb-2">
                        Tape Color
                      </label>
                      <input
                        type="text"
                        name="tapeColor"
                        value={formData.tapeColor}
                        onChange={handleInputChange}
                        className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent text-gray-900"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-900 mb-2">
                        Dealing Person
                      </label>
                      <input
                        type="text"
                        name="dealingPerson"
                        value={formData.dealingPerson}
                        onChange={handleInputChange}
                        className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent text-gray-900"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Right Column - Contact Information, Product List, Bank Details */}
              <div>
                {/* Contact Information */}
                <div className="mb-8">
                  <h2 className="text-lg font-bold text-gray-900 mb-6">
                    Contact Information
                  </h2>

                  <div className="space-y-5">
                    {/* Primary Phone and Email */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-900 mb-2">
                          Primary Phone <span className="text-red-500">*</span> <span className="text-gray-500 text-xs">(10 digits, +91 optional, spaces allowed)</span>
                        </label>
                        <input
                          type="tel"
                          name="primaryPhone"
                          value={formData.primaryPhone}
                          onChange={handleInputChange}
                          pattern="^(\+91\s?)?[6-9]\d{4}\s?\d{5}$"
                          placeholder="9876543210 or +91 9876543210"
                          className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent text-gray-900"
                          required
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-900 mb-2">
                          Email Address
                        </label>
                        <input
                          type="email"
                          name="email"
                          value={formData.email}
                          onChange={handleInputChange}
                          className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent text-gray-900"
                        />
                      </div>
                    </div>

                    {/* Secondary Phone */}
                    <div>
                      <label className="block text-sm font-medium text-gray-900 mb-2">
                        Secondary Phone
                      </label>
                      <input
                        type="tel"
                        name="secondaryPhone"
                        value={formData.secondaryPhone}
                        onChange={handleInputChange}
                        className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent text-gray-900"
                      />
                    </div>
                  </div>
                </div>

                {/* Product List */}
                <div className="mb-8">
                  <h2 className="text-lg font-bold text-gray-900 mb-6">
                    Product List
                  </h2>

                  <div>
                    <label className="block text-sm font-medium text-gray-900 mb-2">
                      Vegetables Supplied <span className="text-red-500">*</span>
                    </label>
                    <div className="relative">
                      <select
                        className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent text-gray-500 appearance-none bg-white"
                        required
                      >
                        <option value="">Select vegetables (Multiple selection)</option>
                      </select>
                      <ChevronDown className="absolute right-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400 pointer-events-none" />
                    </div>

                    {/* Selected Vegetables Tags */}
                    <div className="flex flex-wrap gap-2 mt-4">
                      {selectedVegetables.map((veg, index) => (
                        <span
                          key={index}
                          className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium ${veg.color}`}
                        >
                          {veg.name}
                          <button
                            type="button"
                            onClick={() => removeVegetable(index)}
                            className="hover:opacity-70 transition-opacity"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </span>
                      ))}
                      <button
                        type="button"
                        className="inline-flex items-center px-3 py-1.5 rounded-full text-sm font-medium text-purple-700 bg-purple-100 hover:bg-purple-200 transition-colors"
                      >
                        + Add More
                      </button>
                    </div>
                  </div>
                </div>

                {/* Bank Account Details */}
                <div>
                  <h2 className="text-lg font-bold text-gray-900 mb-6">
                    Bank Account Details
                  </h2>

                  <div className="space-y-5">
                    {/* Account Holder Name and Bank Name */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-900 mb-2">
                          Account Holder Name <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="text"
                          name="accountHolderName"
                          value={formData.accountHolderName}
                          onChange={handleInputChange}
                          className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent text-gray-900"
                          required
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-900 mb-2">
                          Bank Name <span className="text-red-500">*</span>
                        </label>
                        <div className="relative">
                          <select
                            name="bankName"
                            value={formData.bankName}
                            onChange={handleInputChange}
                            className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent text-gray-900 appearance-none bg-white"
                            required
                          >
                            <option value="axis">Axis Bank</option>
                            <option value="hdfc">HDFC Bank</option>
                            <option value="icici">ICICI Bank</option>
                            <option value="sbi">State Bank of India</option>
                          </select>
                          <ChevronDown className="absolute right-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400 pointer-events-none" />
                        </div>
                      </div>
                    </div>

                    {/* Branch Name */}
                    <div>
                      <label className="block text-sm font-medium text-gray-900 mb-2">
                        Branch Name
                      </label>
                      <input
                        type="text"
                        name="branchName"
                        value={formData.branchName}
                        onChange={handleInputChange}
                        className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent text-gray-900"
                      />
                    </div>

                    {/* Account Number and IFSC Code */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-900 mb-2">
                          Account Number <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="text"
                          name="accountNumber"
                          value={formData.accountNumber}
                          onChange={handleInputChange}
                          className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent text-gray-900"
                          required
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-900 mb-2">
                          IFSC Code <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="text"
                          name="ifscCode"
                          value={formData.ifscCode}
                          onChange={handleInputChange}
                          className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent text-gray-900"
                          required
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-col sm:flex-row justify-center gap-4 mt-8 pt-6 border-t border-gray-200">
              <button
                type="submit"
                className="px-8 py-3 bg-emerald-700 hover:bg-emerald-800 text-white rounded-lg font-medium transition-colors duration-200 shadow-sm"
              >
                Update Vendor
              </button>
              <button
                type="button"
                onClick={handleCancel}
                className="px-8 py-3 bg-red-600 hover:bg-red-700 text-white rounded-lg font-medium transition-colors duration-200"
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

export default EditVendorDetails;