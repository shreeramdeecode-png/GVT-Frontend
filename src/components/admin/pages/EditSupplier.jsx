import React, { useState, useEffect } from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { ArrowLeft, Plus, X } from 'lucide-react';
import { getSupplierById, updateSupplier } from '../../../api/supplierApi';
import { getAllProducts } from '../../../api/productApi';
import { BASE_URL } from '../../../config/config';

const normalizePhoneWithCountryCode = (value) => {
  const raw = String(value ?? '').trim();
  if (!raw) return '';
  if (raw.startsWith('+')) return raw;
  const digits = raw.replace(/\D/g, '');
  if (digits.length === 10) return `+91 ${digits}`;
  return raw;
};

const EditSupplier = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const location = useLocation();
  const returnTo = location.state?.returnTo;
  const returnPage = location.state?.returnPage || 1;
  const backPath = returnTo === 'vendors'
    ? `/vendors${returnPage > 1 ? `?page=${returnPage}` : ''}`
    : returnTo === 'suppliers'
      ? `/suppliers${returnPage > 1 ? `?page=${returnPage}` : ''}`
      : '/suppliers';
  const returnToVendors = returnTo === 'vendors';
  
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
    supplierName: '',
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
    ifscCode: '',
    status: 'active',
    performance: 'average'
  });

  const [selectedProducts, setSelectedProducts] = useState([]);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [supplierResponse, productsResponse] = await Promise.all([
          getSupplierById(id),
          getAllProducts(1, 100)
        ]);
        
        const supplier = supplierResponse.data;
        setFormData({
          supplierName: supplier.supplier_name || '',
          place: supplier.place || '',
          address: supplier.address || '',
          city: supplier.city || '',
          state: supplier.state || '',
          pincode: supplier.pin_code || '',
          contactPerson: supplier.contact_person || '',
          tapeColor: supplier.tape_color || '',
          dealingPerson: supplier.dealing_person || '',
          primaryPhone: normalizePhoneWithCountryCode(supplier.phone || ''),
          secondaryPhone: normalizePhoneWithCountryCode(supplier.secondary_phone || ''),
          email: supplier.email || '',
          accountHolderName: supplier.account_holder_name || '',
          bankName: supplier.bank_name || '',
          branchName: supplier.branch_name || '',
          accountNumber: supplier.account_number || '',
          ifscCode: supplier.IFSC_code || supplier.ifsc_code || '',
          status: supplier.status || 'active',
          performance: supplier.performance || 'average'
        });

        if (supplier.profile_image) {
          setProfileImagePreview(`${BASE_URL}${supplier.profile_image}`);
        }

        const allProducts = productsResponse.data || [];
        setProducts(allProducts);

        let productIds = [];
        if (typeof supplier.product_list === 'string') {
          try {
            productIds = JSON.parse(supplier.product_list);
          } catch (e) {
            productIds = [];
          }
        } else if (Array.isArray(supplier.product_list)) {
          productIds = supplier.product_list;
        }
        setSelectedProducts(productIds);
      } catch (error) {
        console.error('Failed to fetch data:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [id]);



  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const removeProduct = (index) => {
    setSelectedProducts(prev => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const supplierPayload = {
        supplier_name: formData.supplierName,
        place: formData.place,
        phone: formData.primaryPhone,
        secondary_phone: formData.secondaryPhone,
        email: formData.email,
        address: formData.address,
        city: formData.city,
        state: formData.state,
        pin_code: formData.pincode,
        contact_person: formData.contactPerson,
        tape_color: formData.tapeColor,
        dealing_person: formData.dealingPerson,
        product_list: selectedProducts,
        account_holder_name: formData.accountHolderName,
        bank_name: formData.bankName,
        branch_name: formData.branchName,
        account_number: formData.accountNumber,
        ifsc_code: formData.ifscCode,
        status: formData.status,
        performance: formData.performance
      };

      await updateSupplier(id, supplierPayload);
      navigate(backPath);
    } catch (error) {
      console.error('Failed to update supplier:', error);
    }
  };

  if (loading) {
    return (
      <div className="p-4 sm:p-6 lg:p-8">
        <div className="text-center text-[#6B8782]">Loading...</div>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <div className="max-w-5xl mx-auto">
        <div className="flex items-center gap-4 mb-6">
          <button
            onClick={() => navigate(backPath)}
            className="flex items-center gap-2 text-[#0D5C4D] hover:text-[#0a6354] transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
            <span className="font-medium">{returnTo === 'vendors' ? 'Back to Vendors' : returnTo === 'suppliers' ? 'Back to Suppliers' : 'Back to Suppliers'}</span>
          </button>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-[#D0E0DB] p-6">
        <form onSubmit={handleSubmit} className="space-y-8">
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
                  Supplier Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  name="supplierName"
                  placeholder="Enter Supplier Name"
                  value={formData.supplierName}
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

          <div>
            <h3 className="text-lg font-semibold text-gray-800 mb-4">Product List</h3>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Products Supplied <span className="text-red-500">*</span>
              </label>
              <select
                onChange={(e) => {
                  const value = parseInt(e.target.value);
                  if (value && !selectedProducts.includes(value)) {
                    setSelectedProducts([...selectedProducts, value]);
                  }
                  e.target.value = '';
                }}
                className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0D7C66] focus:border-transparent text-sm appearance-none bg-white mb-3"
              >
                <option value="">Select items (Multiple selection)</option>
                {products.filter(p => !selectedProducts.includes(p.pid)).map(product => (
                  <option key={product.pid} value={product.pid}>{product.product_name}</option>
                ))}
              </select>

              {selectedProducts.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {selectedProducts.map((productId, index) => {
                    const product = products.find(p => p.pid === productId);
                    return (
                      <span
                        key={index}
                        className="px-3 py-1.5 rounded-lg text-sm font-medium bg-blue-100 text-blue-700 flex items-center gap-2"
                      >
                        {product?.product_name}
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

          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-6 border-t border-gray-200">
            <div className="flex items-center gap-3">
              <span className="text-sm text-gray-700 font-medium">Supplier Status</span>
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

            <div className="flex gap-3">
              <button
                type="submit"
                className="px-8 py-3 bg-[#0D7C66] hover:bg-[#0a6354] text-white font-semibold rounded-lg transition-colors shadow-sm"
              >
                Update Supplier
              </button>
              <button
                type="button"
                onClick={() => navigate(backPath)}
                className="px-8 py-3 bg-red-600 hover:bg-red-700 text-white font-semibold rounded-lg transition-colors shadow-sm"
              >
                Cancel
              </button>
            </div>
          </div>
        </form>
        </div>
      </div>
    </div>
  );
};

export default EditSupplier;