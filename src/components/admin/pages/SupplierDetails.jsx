import React, { useState, useEffect } from 'react';
import { Phone, Mail, MapPin, TrendingUp, Package, ArrowLeft } from 'lucide-react';
import { useNavigate, useParams } from 'react-router-dom';
import { getSupplierById } from '../../../api/supplierApi';
import { fetchAllProducts } from '../../../api/productApi';
import { BASE_URL } from '../../../config/config';

const SupplierDetails = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const [supplier, setSupplier] = useState(null);
  const [products, setProducts] = useState([]);

  const handleBackClick = () => {
    navigate('/suppliers');
  };

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [supplierResponse, productsResponse] = await Promise.all([
          getSupplierById(id),
          fetchAllProducts()
        ]);
        
        const supplierData = supplierResponse.data;
        const allProducts = Array.isArray(productsResponse) ? productsResponse : (productsResponse?.data || []);
        
        let productIds = [];
        if (typeof supplierData.product_list === 'string') {
          try {
            productIds = JSON.parse(supplierData.product_list);
          } catch (e) {
            productIds = [];
          }
        } else if (Array.isArray(supplierData.product_list)) {
          productIds = supplierData.product_list;
        }
        
        const productMap = {};
        allProducts.forEach(p => {
          productMap[p.pid] = p.product_name;
        });
        
        const productList = productIds.map(id => ({
          product_id: id,
          product_name: productMap[id] || `Product ${id}`
        }));
        
        // console.log('Supplier data from API:', supplierData);
        // console.log('Profile image:', supplierData.profile_image);
        setSupplier({ ...supplierData, product_list: productList });
        setProducts(allProducts);
      } catch (error) {
        console.error('Failed to fetch data:', error);
      }
    };

    fetchData();
  }, [id]);

  if (!supplier) {
    return (
      <div className="min-h-screen bg-gray-50 p-4 md:p-6 lg:p-8 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-teal-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading supplier details...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-6 lg:p-8">
      <div className="mb-6">
        <div className="flex items-center gap-4 mb-4">
          <button
            onClick={handleBackClick}
            className="flex items-center gap-2 px-4 py-2 text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
            <span>Back to Suppliers</span>
          </button>
        </div>
      </div>

      {/* Tab Buttons */}
      <div className="flex flex-wrap gap-3 mb-6">
        <button className="px-6 py-2.5 bg-[#0D7C66] text-white rounded-lg font-medium transition-colors shadow-sm">
          Personal Info
        </button>
        <button 
          onClick={() => navigate(`/suppliers/${id}/orders`)}
          className="px-6 py-2.5 bg-white text-gray-700 border border-gray-300 rounded-lg font-medium hover:bg-gray-50 transition-colors"
        >
          Order List
        </button>
        <button 
          onClick={() => navigate(`/suppliers/${id}/payout`)}
          className="px-6 py-2.5 bg-white text-gray-700 border border-gray-300 rounded-lg font-medium hover:bg-gray-50 transition-colors"
        >
          Payout
        </button>
      </div>

      <div className="rounded-lg shadow-sm p-6 mb-6">
        <div className="flex flex-col md:flex-row items-start md:items-center gap-6">
          <div className="w-24 h-24 bg-teal-800 rounded-full flex items-center justify-center flex-shrink-0 overflow-hidden">
            {supplier?.profile_image ? (
              <img 
                src={`${BASE_URL}${supplier.profile_image}`}
                alt={supplier?.supplier_name || 'Supplier'}
                className="w-full h-full object-cover"
                onError={(e) => {
                  //console.log('Image failed to load:', e.target.src);
                  e.target.style.display = 'none';
                }}
              />
            ) : null}
            {!supplier?.profile_image && (
              <span className="text-white text-3xl font-bold">{supplier?.supplier_name?.substring(0, 2).toUpperCase() || 'SP'}</span>
            )}
          </div>
          
          <div className="flex-1">
            <h2 className="text-2xl font-bold text-gray-800 mb-2">{supplier?.supplier_name || 'N/A'}</h2>
            <p className="text-gray-600 mb-2">Supplier ID: {supplier?.registration_number || 'N/A'}</p>
            <div className="flex items-center gap-2 text-sm text-gray-500">
              <span className="flex items-center gap-1">
                <span className="text-red-500">🛒</span>
                Member since January 15, 2024
              </span>
              <span>•</span>
              <span>Last updated: Oct 28, 2025</span>
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <span className="bg-teal-50 text-teal-700 px-4 py-1 rounded-full text-sm font-medium border border-teal-200">
              {supplier?.type || 'Supplier'}
            </span>
            <span className={`px-4 py-1 rounded-full text-sm font-medium border flex items-center gap-2 ${
              supplier?.status === 'active' 
                ? 'bg-green-50 text-green-700 border-green-200' 
                : 'bg-red-50 text-red-700 border-red-200'
            }`}>
              <span className={`w-2 h-2 rounded-full ${
                supplier?.status === 'active' ? 'bg-green-500' : 'bg-red-500'
              }`}></span>
              {supplier?.status === 'active' ? 'Active' : 'Inactive'}
            </span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        <div className="bg-teal-50 rounded-lg shadow-sm p-6">
          <div className="flex items-center gap-2 mb-4">
            <Phone className="w-5 h-5 text-teal-600" />
            <h3 className="text-lg font-semibold text-gray-800">Contact Information</h3>
          </div>
          
          <div className="space-y-4">
            <div>
              <p className="text-xs font-medium text-gray-500 uppercase mb-1">Phone Number</p>
              <p className="text-gray-800">{supplier?.phone || 'N/A'}</p>
            </div>
            
            <div>
              <p className="text-xs font-medium text-gray-500 uppercase mb-1">Email Address</p>
              <p className="text-teal-600">{supplier?.email || 'N/A'}</p>
            </div>
            
            <div>
              <p className="text-xs font-medium text-gray-500 uppercase mb-1">Alternate Contact</p>
              <p className="text-gray-800">{supplier?.secondary_phone || 'N/A'}</p>
            </div>
          </div>
        </div>

        <div className="bg-teal-50 rounded-lg shadow-sm p-6">
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp className="w-5 h-5 text-teal-600" />
            <h3 className="text-lg font-semibold text-gray-800">Business Details</h3>
          </div>
          
          <div className="space-y-4">
            <div>
              <p className="text-xs font-medium text-gray-500 uppercase mb-2">Products Supplied</p>
              <div className="flex flex-wrap gap-2">
                {Array.isArray(supplier?.product_list) && supplier.product_list.length > 0 ? supplier.product_list.map((item, index) => (
                  <span key={index} className="bg-teal-50 text-teal-700 px-3 py-1 rounded-full text-sm">
                    {item.product_name}
                  </span>
                )) : <span className="text-gray-500">No products assigned</span>}
              </div>
            </div>
            
            <div>
              <p className="text-xs font-medium text-gray-500 uppercase mb-1">Contact Person</p>
              <p className="text-gray-800">{supplier?.contact_person || 'N/A'}</p>
            </div>
          </div>
        </div>

        <div className="bg-teal-50 rounded-lg shadow-sm p-6">
          <div className="flex items-center gap-2 mb-4">
            <MapPin className="w-5 h-5 text-red-500" />
            <h3 className="text-lg font-semibold text-gray-800">Location Details</h3>
          </div>
          
          <div className="space-y-4">
            <div>
              <p className="text-xs font-medium text-gray-500 uppercase mb-1">Region</p>
              <p className="text-gray-800">{supplier?.city}, {supplier?.state}</p>
            </div>
            
            <div>
              <p className="text-xs font-medium text-gray-500 uppercase mb-1">Full Address</p>
              <p className="text-gray-800">{supplier?.address || 'N/A'}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SupplierDetails;
