import React, { useState, useEffect } from 'react';
import { Search, Plus, X, ChevronDown, Pencil, Trash2 } from 'lucide-react';
import { createCategory, getAllCategories, updateCategory, deleteCategory } from '../../../api/categoryApi';
import { createProduct, getAllProducts, updateProduct, deleteProduct } from '../../../api/productApi';
import { createMultipleProductBox, getAllMultipleProductBoxes, updateMultipleProductBox, deleteMultipleProductBox } from '../../../api/multipleProductBoxApi';
import { getBoxesAndBags } from '../../../api/inventoryApi';
import { getAllCustomers } from '../../../api/customerApi';
import { getPreferencesByCustomer, createPreference, updatePreference, deletePreference } from '../../../api/customerProductPreferenceApi';
import { getAllProductCounts, updateProductCountStatus } from '../../../api/productCountApi';
import { BASE_URL } from '../../../config/config';
import { sortDropdownObjects } from '../../../utils/dropdownSort';
import { fetchAllProducts as fetchAllProductsForPrefs } from '../../../api/productApi';

const AddProduct = () => {
  const [activeTab, setActiveTab] = useState('product');
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalProducts, setTotalProducts] = useState(0);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [editingIndex, setEditingIndex] = useState(null);
  const [deletingIndex, setDeletingIndex] = useState(null);
  const [editFormData, setEditFormData] = useState({});
  const [loading, setLoading] = useState(false);
  const [editingPriceId, setEditingPriceId] = useState(null);
  const [editingPrice, setEditingPrice] = useState('');
  const [priceHistory, setPriceHistory] = useState([]);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [historyPage, setHistoryPage] = useState(1);
  const [detailPage, setDetailPage] = useState(1);
  const itemsPerPage = 10;
  const [customerOrderPage, setCustomerOrderPage] = useState(1);
  const customerOrderItemsPerPage = 20;
  const [customerOrderSearchQuery, setCustomerOrderSearchQuery] = useState('');
  const [productCountPage, setProductCountPage] = useState(1);
  const productCountItemsPerPage = 20;
  const [productCountSearchQuery, setProductCountSearchQuery] = useState('');
  const [productCountList, setProductCountList] = useState([]);
  const [productCountTotal, setProductCountTotal] = useState(0);
  const [productCountToggleLoading, setProductCountToggleLoading] = useState(null);

  const [categories, setCategories] = useState([]);
  const [vegetables, setVegetables] = useState([]);
  const [packingOptions, setPackingOptions] = useState([]);
  const [selectedPackings, setSelectedPackings] = useState([]);
  const [editSelectedPackings, setEditSelectedPackings] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [selectedCustomerId, setSelectedCustomerId] = useState(null);
  const [productPreferences, setProductPreferences] = useState([]);
  const [customerPreferences, setCustomerPreferences] = useState({});
  const [editingPreference, setEditingPreference] = useState(null);

  // Multiple Product Box state
  const [multiBoxProducts, setMultiBoxProducts] = useState([]);
  const [multiBoxSelectedProducts, setMultiBoxSelectedProducts] = useState([]);
  const [multiBoxProductNetWeights, setMultiBoxProductNetWeights] = useState({});
  const [multiBoxSelectedPackings, setMultiBoxSelectedPackings] = useState([]);
  const [multiBoxFormData, setMultiBoxFormData] = useState({
    name: '',
    short: '',
    status: 'active'
  });
  const [multipleProductBoxes, setMultipleProductBoxes] = useState([]);
  const [openMultiBoxDropdown, setOpenMultiBoxDropdown] = useState(false);
  const [editingMultiBoxId, setEditingMultiBoxId] = useState(null);
  const [showEditMultiBoxModal, setShowEditMultiBoxModal] = useState(false);
  const [showDeleteMultiBoxModal, setShowDeleteMultiBoxModal] = useState(false);
  const [deletingMultiBoxId, setDeletingMultiBoxId] = useState(null);

  const getStatusColor = (status) => {
    return status === 'Active'
      ? 'bg-[#4ED39A] text-white'
      : 'bg-yellow-500 text-white';
  };

  const handleEdit = (index) => {
    setEditingIndex(index);
    setEditFormData({ ...vegetables[index] });
    const packingType = vegetables[index].packing_type;
    setEditSelectedPackings(packingType ? packingType.split(',').map(p => p.trim()) : []);

    // Ensure categories are loaded before opening modal
    if (categories.length === 0) {
      fetchAllCategories().then(() => {
        setShowEditModal(true);
      });
    } else {
      setShowEditModal(true);
    }
  };

  const handleEditSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const formData = new FormData(e.target);
      formData.set('packing_type', editSelectedPackings.join(', '));

      await updateProduct(vegetables[editingIndex].pid, formData);
      alert('Product updated successfully!');
      setShowEditModal(false);
      setCurrentPage(1); // Reset to first page
      fetchProducts();
    } catch (error) {
      alert(error.response?.data?.message || 'Failed to update product');
    } finally {
      setLoading(false);
    }
  };

  const handleEditChange = (e) => {
    const { name, value } = e.target;
    setEditFormData(prev => ({ ...prev, [name]: value }));
  };

  const handlePriceEdit = (pid, currentPrice) => {
    setEditingPriceId(pid);
    setEditingPrice(currentPrice);
  };

  const handlePriceSave = async (pid) => {
    try {
      // Get the old price before updating
      const oldProduct = vegetables.find(v => v.pid === pid);
      const oldPrice = oldProduct?.current_price;

      // Store price change in localStorage
      if (oldPrice && oldPrice !== editingPrice) {
        const priceChanges = JSON.parse(localStorage.getItem('priceHistory') || '[]');
        priceChanges.push({
          pid: pid,
          productName: oldProduct.product_name,
          categoryName: oldProduct.categoryName,
          unit: oldProduct.unit,
          productImage: oldProduct.product_image,
          oldPrice: oldPrice,
          newPrice: editingPrice,
          updatedAt: new Date().toISOString()
        });
        localStorage.setItem('priceHistory', JSON.stringify(priceChanges));
      }

      const formData = new FormData();
      formData.append('current_price', editingPrice);
      await updateProduct(pid, formData);
      setEditingPriceId(null);
      setEditingPrice('');
      fetchProducts();

      // Refresh history if on history tab
      if (activeTab === 'history') {
        fetchPriceHistory();
      }
    } catch (error) {
      alert(error.response?.data?.message || 'Failed to update price');
    }
  };

  const handlePriceHistory = async (product) => {
    // Get price changes from localStorage for this product
    const priceChanges = JSON.parse(localStorage.getItem('priceHistory') || '[]');
    const productChanges = priceChanges.filter(change => change.pid === product.pid);

    setSelectedProduct({
      ...product,
      categoryName: product.categoryName,
      priceChanges: productChanges
    });
    setDetailPage(1);
  };

  const handlePriceCancel = () => {
    setEditingPriceId(null);
    setEditingPrice('');
  };

  const handleCategoryEdit = (index) => {
    setEditingIndex(index);
    setEditFormData({ ...categories[index] });
    setShowEditModal(true);
  };

  const handleCategoryEditSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const formData = new FormData(e.target);
      await updateCategory(categories[editingIndex].cid, formData);
      alert('Category updated successfully!');
      setShowEditModal(false);
      fetchCategories();
    } catch (error) {
      alert(error.response?.data?.message || 'Failed to update category');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = (index) => {
    setDeletingIndex(index);
    setShowDeleteModal(true);
  };

  const confirmDelete = async () => {
    if (activeTab === 'product') {
      try {
        await deleteProduct(vegetables[deletingIndex].pid);
        alert('Product deleted successfully!');
        setShowDeleteModal(false);
        setDeletingIndex(null);
        setCurrentPage(1); // Reset to first page
        fetchProducts();
      } catch (error) {
        alert(error.response?.data?.message || 'Failed to delete product');
        setShowDeleteModal(false);
      }
    } else {
      try {
        await deleteCategory(categories[deletingIndex].cid);
        alert('Category deleted successfully!');
        setShowDeleteModal(false);
        setDeletingIndex(null);
        fetchCategories();
      } catch (error) {
        alert(error.response?.data?.message || 'Failed to delete category');
        setShowDeleteModal(false);
      }
    }
  };

  const fetchAllCategories = async () => {
    try {
      const response = await getAllCategories(1, 100);
      const allCategories = response.data || [];
      setCategories(allCategories);
      return allCategories;
    } catch (error) {
      console.error('Failed to fetch all categories:', error);
      return [];
    }
  };

  const fetchCategories = async () => {
    try {
      const response = await getAllCategories(1, 100);
      let allCategories = response.data || [];

      // Filter categories based on search query
      if (searchQuery.trim() && activeTab === 'category') {
        allCategories = allCategories.filter(category =>
          category.categoryname.toLowerCase().includes(searchQuery.toLowerCase()) ||
          category.categorydescription?.toLowerCase().includes(searchQuery.toLowerCase())
        );
      }

      setCategories(allCategories);
    } catch (error) {
      console.error('Failed to fetch categories:', error);
    }
  };

  const fetchProducts = async () => {
    try {
      // First, try to get all products to know the total count
      const allProductsResponse = await getAllProducts(1, 1000); // Get a large number to get all
      const allProducts = allProductsResponse.data || [];

      // Filter products based on search query
      let filteredProducts = allProducts;
      if (searchQuery.trim()) {
        filteredProducts = allProducts.filter(product =>
          product.product_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          product.category?.categoryname?.toLowerCase().includes(searchQuery.toLowerCase())
        );
      }

      // Calculate pagination
      const totalCount = filteredProducts.length;
      const totalPagesCount = Math.ceil(totalCount / itemsPerPage);
      const startIndex = (currentPage - 1) * itemsPerPage;
      const endIndex = startIndex + itemsPerPage;
      const paginatedProducts = filteredProducts.slice(startIndex, endIndex);

      const productsWithCategory = paginatedProducts.map(product => {
        return { ...product, categoryName: product.category?.categoryname || 'N/A' };
      });

      setVegetables(productsWithCategory);
      setTotalProducts(totalCount);
      setTotalPages(totalPagesCount);
    } catch (error) {
      console.error('Failed to fetch products:', error);
    }
  };

  useEffect(() => {
    // Always fetch all categories for dropdowns
    fetchAllCategories();
    fetchPackingOptions();

    if (activeTab === 'category') {
      fetchCategories();
    }
    if (activeTab === 'product') {
      fetchProducts();
    } else if (activeTab === 'productCount') {
      fetchProductCountList();
    } else if (activeTab === 'history') {
      fetchPriceHistory();
    } else if (activeTab === 'multipleProductBox') {
      fetchMultiBoxProducts();
      fetchMultipleProductBoxes();
    } else if (activeTab === 'customerOrder') {
      fetchCustomers();
    }
  }, [activeTab, currentPage, searchQuery, productCountPage, productCountSearchQuery]);

  const fetchProductCountList = async () => {
    try {
      const res = await getAllProductCounts(productCountPage, productCountItemsPerPage, productCountSearchQuery);
      setProductCountList(res.data || []);
      setProductCountTotal(res.pagination?.totalItems ?? res.data?.length ?? 0);
    } catch (error) {
      console.error('Failed to fetch product count list:', error);
    }
  };

  const getProductCountTotalPages = () => {
    return Math.ceil(productCountTotal / productCountItemsPerPage) || 1;
  };

  const handleProductCountStatusToggle = async (pid) => {
    const record = productCountList.find(r => r.pid === pid);
    if (!record) return;
    const newStatus = (record.product_status || 'inactive') === 'active' ? 'inactive' : 'active';
    setProductCountToggleLoading(pid);
    try {
      await updateProductCountStatus(pid, newStatus);
      setProductCountList(prev => prev.map(r => (r.pid === pid ? { ...r, product_status: newStatus } : r)));
    } catch (error) {
      alert(error.response?.data?.message || 'Failed to update product count status');
    } finally {
      setProductCountToggleLoading(null);
    }
  };

  const fetchPackingOptions = async () => {
    try {
      const items = await getBoxesAndBags();
      const formattedItems = items.map(item => ({
        id: item.id,
        name: item.name
      }));
      setPackingOptions(formattedItems);
    } catch (error) {
      console.error('Failed to fetch packing options:', error);
    }
  };

  const fetchPriceHistory = async () => {
    try {
      const response = await getAllProducts(1, 1000);
      const products = response.data || [];

      // Get price changes from localStorage
      const priceChanges = JSON.parse(localStorage.getItem('priceHistory') || '[]');

      // Group price changes by product ID
      const changesByProduct = priceChanges.reduce((acc, change) => {
        if (!acc[change.pid]) {
          acc[change.pid] = [];
        }
        acc[change.pid].push(change);
        return acc;
      }, {});

      // Create product list with their price histories
      const productsWithHistory = products.map(product => ({
        ...product,
        categoryName: product.category?.categoryname || 'N/A',
        priceChanges: changesByProduct[product.pid] || [],
        lastUpdated: changesByProduct[product.pid]?.[changesByProduct[product.pid].length - 1]?.updatedAt || product.updatedAt
      }));

      // Sort by last updated (newest first)
      productsWithHistory.sort((a, b) => new Date(b.lastUpdated) - new Date(a.lastUpdated));

      setPriceHistory(productsWithHistory);
    } catch (error) {
      console.error('Failed to fetch price history:', error);
    }
  };

  const fetchMultiBoxProducts = async () => {
    try {
      const response = await getAllProducts(1, 1000);
      const products = response.data || [];
      setMultiBoxProducts(products);
    } catch (error) {
      console.error('Failed to fetch products for multiple product box:', error);
    }
  };

  const parseJsonField = (field) => {
    if (Array.isArray(field)) return field;
    if (typeof field === 'string') {
      try {
        const parsed = JSON.parse(field);
        return Array.isArray(parsed) ? parsed : [];
      } catch {
        return [];
      }
    }
    return [];
  };

  const fetchMultipleProductBoxes = async () => {
    try {
      const response = await getAllMultipleProductBoxes();
      const boxes = response.data || [];

      const normalizedBoxes = boxes.map((box) => {
        const productIds = parseJsonField(box.product_ids);
        const packingTypes = parseJsonField(box.packing_types);
        let netWeights = {};
        if (box.net_weights) {
          try {
            const parsed = typeof box.net_weights === 'string' ? JSON.parse(box.net_weights) : box.net_weights;
            if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
              netWeights = parsed;
            }
          } catch {
            netWeights = {};
          }
        }
        return {
          id: box.id,
          name: box.name,
          short: box.short || '',
          productIds: productIds.map((pid) => String(pid)),
          packingTypes: packingTypes.map((pt) => String(pt)),
          netWeights,
          status: box.status || 'active'
        };
      });

      setMultipleProductBoxes(normalizedBoxes);
    } catch (error) {
      console.error('Failed to fetch multiple product boxes:', error);
    }
  };

  const handleMultiBoxSubmit = async (e) => {
    e.preventDefault();

    const name = multiBoxFormData.name.trim();
    const short = multiBoxFormData.short.trim();

    if (!name || multiBoxSelectedProducts.length === 0) {
      alert('Please enter a name and select at least one product.');
      return;
    }

    setLoading(true);
    try {
      const payload = {
        name,
        short: short || null,
        product_ids: multiBoxSelectedProducts,
        net_weights: multiBoxProductNetWeights,
        packing_types: multiBoxSelectedPackings,
        status: multiBoxFormData.status
      };

      await createMultipleProductBox(payload);
      alert('Multiple product box created successfully!');
      await fetchMultipleProductBoxes();

      setMultiBoxFormData({ name: '', short: '', status: 'active' });
      setMultiBoxSelectedProducts([]);
      setMultiBoxProductNetWeights({});
      setMultiBoxSelectedPackings([]);
      setShowAddModal(false);
    } catch (error) {
      alert(error.response?.data?.message || 'Failed to create multiple product box');
    } finally {
      setLoading(false);
    }
  };

  const handleEditMultiBox = (box) => {
    setEditingMultiBoxId(box.id);
    setMultiBoxFormData({ name: box.name, short: box.short || '', status: box.status || 'active' });
    setMultiBoxSelectedProducts([...box.productIds]);
    setMultiBoxProductNetWeights(box.netWeights || {});
    setMultiBoxSelectedPackings([...box.packingTypes]);
    setShowEditMultiBoxModal(true);
  };

  const handleEditMultiBoxSubmit = async (e) => {
    e.preventDefault();
    const name = multiBoxFormData.name.trim();
    const short = multiBoxFormData.short.trim();

    if (!name || multiBoxSelectedProducts.length === 0) {
      alert('Please enter a name and select at least one product.');
      return;
    }

    setLoading(true);
    try {
      const payload = {
        name,
        short: short || null,
        product_ids: multiBoxSelectedProducts,
        net_weights: multiBoxProductNetWeights,
        packing_types: multiBoxSelectedPackings,
        status: multiBoxFormData.status
      };
      await updateMultipleProductBox(editingMultiBoxId, payload);
      alert('Multiple product box updated successfully!');
      await fetchMultipleProductBoxes();
      setShowEditMultiBoxModal(false);
      setEditingMultiBoxId(null);
      setMultiBoxFormData({ name: '', short: '', status: 'active' });
      setMultiBoxSelectedProducts([]);
      setMultiBoxProductNetWeights({});
      setMultiBoxSelectedPackings([]);
    } catch (error) {
      alert(error.response?.data?.message || 'Failed to update multiple product box');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteMultiBox = (box) => {
    setDeletingMultiBoxId(box.id);
    setShowDeleteMultiBoxModal(true);
  };

  const confirmDeleteMultiBox = async () => {
    if (!deletingMultiBoxId) return;
    setLoading(true);
    try {
      await deleteMultipleProductBox(deletingMultiBoxId);
      alert('Multiple product box deleted successfully!');
      await fetchMultipleProductBoxes();
      setShowDeleteMultiBoxModal(false);
      setDeletingMultiBoxId(null);
    } catch (error) {
      alert(error.response?.data?.message || 'Failed to delete multiple product box');
    } finally {
      setLoading(false);
    }
  };

  const handleAddSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const formData = new FormData(e.target);
      if (activeTab === 'product') {
        formData.set('packing_type', selectedPackings.join(', '));
      }

      if (activeTab === 'category') {
        await createCategory(formData);
        alert('Category created successfully!');
        fetchCategories();
      } else {
        await createProduct(formData);
        alert('Product created successfully!');
        setCurrentPage(1); // Reset to first page
        fetchProducts();
      }
      setShowAddModal(false);
      e.target.reset();
      setSelectedPackings([]);
    } catch (error) {
      alert(error.response?.data?.message || `Failed to create ${activeTab}`);
    } finally {
      setLoading(false);
    }
  };

  const fetchCustomers = async () => {
    try {
      const response = await getAllCustomers(1, 1000);
      const allCustomers = response?.data ?? response?.customers ?? (Array.isArray(response) ? response : []);
      const reversedCustomers = [...allCustomers].reverse();
      setCustomers(reversedCustomers);
      if (reversedCustomers.length > 0) {
        const firstCustomer = reversedCustomers[0];
        const firstCustomerId = firstCustomer.customer_id ?? firstCustomer.id ?? firstCustomer.cust_id;
        setSelectedCustomerId(firstCustomerId);
        await fetchCustomerPreferences(firstCustomerId);
      }
      await fetchAllProducts();
    } catch (error) {
      console.error('Failed to fetch customers:', error);
      await fetchAllProducts();
    }
  };

  const fetchAllProducts = async () => {
    try {
      const allProducts = await fetchAllProductsForPrefs();
      
      const productPrefs = allProducts.map(product => ({
        product_id: product.pid,
        product_name: product.product_name,
        enabled: false,
        display_order: ''
      }));
      
      setProductPreferences(productPrefs);
    } catch (error) {
      console.error('Failed to fetch products:', error);
    }
  };

  const fetchCustomerPreferences = async (customerId) => {
    try {
      const response = await getPreferencesByCustomer(customerId);
      const items = Array.isArray(response?.data) ? response.data : [];

      // Base list: all products, so every product can get a display order entry
      let baseProducts = productPreferences;

      // If base list not yet loaded, fetch it now
      if (!baseProducts || baseProducts.length === 0) {
        try {
          const allProducts = await fetchAllProductsForPrefs();
          baseProducts = allProducts.map(product => ({
            product_id: product.pid,
            product_name: product.product_name,
            enabled: false,
            display_order: ''
          }));
        } catch (prodError) {
          console.error('Failed to fetch products for customer preferences:', prodError);
          baseProducts = [];
        }
      }

      // Merge customer's saved prefs onto the full product list
      const merged = baseProducts.map(base => {
        const pref = items.find(it => it.product_id === base.product_id);
        if (pref) {
          return {
            ...base,
            enabled: !!pref.enabled,
            display_order: pref.display_order ?? ''
          };
        }
        return base;
      });

      setCustomerPreferences(prev => ({
        ...prev,
        [customerId]: merged
      }));
    } catch (error) {
      console.error('Failed to fetch customer preferences:', error);
      setCustomerPreferences(prev => ({
        ...prev,
        [customerId]: []
      }));
    }
  };

  const handlePreferenceToggle = (itemKey) => {
    const currentPrefs = customerPreferences[selectedCustomerId] || productPreferences;
    const item = currentPrefs.find(p => `product_${p.product_id}` === itemKey);

    setCustomerPreferences(prev => ({
      ...prev,
      [selectedCustomerId]: (prev[selectedCustomerId] || productPreferences).map(p =>
        `product_${p.product_id}` === itemKey ? { ...p, enabled: !p.enabled, display_order: !p.enabled ? p.display_order : '' } : p
      )
    }));

    if (item && !item.enabled) {
      setEditingPreference(itemKey);
    }
  };

  const handleDisplayOrderChange = (itemKey, value) => {
    setCustomerPreferences(prev => ({
      ...prev,
      [selectedCustomerId]: (prev[selectedCustomerId] || productPreferences).map(p =>
        `product_${p.product_id}` === itemKey ? { ...p, display_order: value } : p
      )
    }));
  };

  const handleSaveSingleProduct = async (itemKey) => {
    try {
      setLoading(true);
      const currentPrefs = customerPreferences[selectedCustomerId] || productPreferences;
      const pref = currentPrefs.find(p => `product_${p.product_id}` === itemKey);

      if (!pref) return;

      const existingPrefsRes = await getPreferencesByCustomer(selectedCustomerId);
      const existingPrefs = Array.isArray(existingPrefsRes?.data) ? existingPrefsRes.data : [];
      const existingPref = existingPrefs.find(p => p.product_id === pref.product_id);

      if (pref.enabled) {
        if (existingPref) {
          await updatePreference(selectedCustomerId, pref.product_id, { enabled: true, display_order: pref.display_order || null });
        } else {
          await createPreference({
            customer_id: selectedCustomerId,
            product_id: pref.product_id,
            enabled: true,
            display_order: pref.display_order || null
          });
        }
      } else {
        if (existingPref) {
          await deletePreference(selectedCustomerId, pref.product_id);
        }
      }

      alert('Preference saved successfully!');
      await fetchCustomerPreferences(selectedCustomerId);
    } catch (error) {
      alert('Failed to save preference');
    } finally {
      setLoading(false);
    }
  };

  const handleEditProduct = (itemKey) => {
    setEditingPreference(itemKey);
  };

  const handleCancelEdit = () => {
    setEditingPreference(null);
    fetchCustomerPreferences(selectedCustomerId);
  };

  const handleDeleteProduct = async (itemKey) => {
    try {
      setLoading(true);
      const currentPrefs = customerPreferences[selectedCustomerId] || productPreferences;
      const pref = currentPrefs.find(p => `product_${p.product_id}` === itemKey);
      if (!pref) return;

      await deletePreference(selectedCustomerId, pref.product_id);
      await fetchCustomerPreferences(selectedCustomerId);
      alert('Preference deleted successfully!');
    } catch (error) {
      alert('Failed to delete preference');
    } finally {
      setLoading(false);
    }
  };

  const getCurrentCustomerPreferences = () => {
    const baseList = customerPreferences[selectedCustomerId] || productPreferences;

    // Apply search filter first
    let allPrefs = baseList;
    if (customerOrderSearchQuery.trim()) {
      const search = customerOrderSearchQuery.toLowerCase();
      allPrefs = allPrefs.filter(p =>
        (p.product_name || '').toLowerCase().includes(search)
      );
    }

    // Sort so items with a display_order appear first (1,2,3,...) then the rest
    const sorted = [...allPrefs].sort((a, b) => {
      const aHasOrder = a.display_order !== '' && a.display_order !== null && a.display_order !== undefined;
      const bHasOrder = b.display_order !== '' && b.display_order !== null && b.display_order !== undefined;

      if (aHasOrder && !bHasOrder) return -1;
      if (!aHasOrder && bHasOrder) return 1;

      if (aHasOrder && bHasOrder) {
        const aNum = parseFloat(a.display_order) || 0;
        const bNum = parseFloat(b.display_order) || 0;
        if (aNum !== bNum) return aNum - bNum;
      }

      // Fallback: sort by product name
      const nameA = (a.product_name || '').toLowerCase();
      const nameB = (b.product_name || '').toLowerCase();
      if (nameA < nameB) return -1;
      if (nameA > nameB) return 1;
      return 0;
    });

    return sorted;
  };

  const getPaginatedCustomerPreferences = () => {
    const allPrefs = getCurrentCustomerPreferences();
    const startIndex = (customerOrderPage - 1) * customerOrderItemsPerPage;
    const endIndex = startIndex + customerOrderItemsPerPage;
    return allPrefs.slice(startIndex, endIndex);
  };

  const getCustomerOrderTotalPages = () => {
    const allPrefs = getCurrentCustomerPreferences();
    return Math.ceil(allPrefs.length / customerOrderItemsPerPage);
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <div className="max-w-7xl mx-auto">

        {/* Tabs */}
        {!selectedProduct && (
          <div className="flex items-center gap-2 mb-6">
            <button
              onClick={() => {
                setActiveTab('product');
                setCurrentPage(1);
                setSearchQuery('');
              }}
              className={`px-5 py-2.5 rounded-lg font-medium transition-all text-sm ${activeTab === 'product' ? 'bg-[#0D7C66] text-white shadow-md' : 'bg-white text-gray-600 hover:bg-gray-50 border border-gray-200'}`}
            >
              All Products
            </button>
            <button
              onClick={() => {
                setActiveTab('multipleProductBox');
                setCurrentPage(1);
                setSearchQuery('');
              }}
              className={`px-5 py-2.5 rounded-lg font-medium transition-all text-sm ${activeTab === 'multipleProductBox' ? 'bg-[#0D7C66] text-white shadow-md' : 'bg-white text-gray-600 hover:bg-gray-50 border border-gray-200'}`}
            >
              Multiple Product Box
            </button>
            <button
              onClick={() => {
                setActiveTab('category');
                setCurrentPage(1);
                setSearchQuery('');
              }}
              className={`px-5 py-2.5 rounded-lg font-medium transition-all text-sm ${activeTab === 'category' ? 'bg-[#0D7C66] text-white shadow-md' : 'bg-white text-gray-600 hover:bg-gray-50 border border-gray-200'}`}
            >
              All Category
            </button>
            <button
              onClick={() => {
                setActiveTab('customerOrder');
                setCurrentPage(1);
                setSearchQuery('');
                fetchCustomers();
              }}
              className={`px-5 py-2.5 rounded-lg font-medium transition-all text-sm ${activeTab === 'customerOrder' ? 'bg-[#0D7C66] text-white shadow-md' : 'bg-white text-gray-600 hover:bg-gray-50 border border-gray-200'}`}
            >
              Customer Product Order
            </button>
            <button
              onClick={() => {
                setActiveTab('productCount');
                setProductCountPage(1);
                setProductCountSearchQuery('');
                fetchProductCountList();
              }}
              className={`px-5 py-2.5 rounded-lg font-medium transition-all text-sm ${activeTab === 'productCount' ? 'bg-[#0D7C66] text-white shadow-md' : 'bg-white text-gray-600 hover:bg-gray-50 border border-gray-200'}`}
            >
              Product Count
            </button>
          </div>
        )}

        {/* Header */}
        {!selectedProduct && (activeTab === 'product' || activeTab === 'category' || activeTab === 'multipleProductBox') && (
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 mb-6">
            {/* Search */}
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-[#6B8782]" />
              <input
                type="text"
                placeholder={`Search ${
                  activeTab === 'product'
                    ? 'products'
                    : activeTab === 'category'
                    ? 'categories'
                    : 'multiple product boxes'
                }...`}
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setCurrentPage(1); // Reset to first page when searching
                }}
                className="w-full pl-12 pr-4 py-3 bg-[#F0F4F3] border-none rounded-xl text-[#0D5C4D] placeholder-[#6B8782] focus:outline-none focus:ring-2 focus:ring-[#0D8568] text-sm"
              />
            </div>

            {/* Add Button */}
            <button
              onClick={() => setShowAddModal(true)}
              className="px-5 py-2.5 bg-[#0D7C66] hover:bg-[#0a6354] text-white rounded-lg font-medium transition-colors flex items-center justify-center gap-2 shadow-sm text-sm whitespace-nowrap"
            >
              <Plus className="w-4 h-4" />
              {activeTab === 'product'
                ? 'Add Product'
                : activeTab === 'category'
                ? 'Add Category'
                : 'Add Multiple Product Box'}
            </button>
          </div>
        )}

        {/* Product Table */}
        {activeTab === 'product' && !selectedProduct && (
          <div className="bg-white rounded-2xl overflow-hidden border border-[#D0E0DB]">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-[#D4F4E8]">
                    <th className="px-6 py-4 text-left text-sm font-semibold text-[#0D5C4D]">
                      Image
                    </th>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-[#0D5C4D]">
                      Vegetable Name
                    </th>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-[#0D5C4D]">
                      Category
                    </th>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-[#0D5C4D]">
                      Unit
                    </th>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-[#0D5C4D]">
                      Type of Packing
                    </th>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-[#0D5C4D]">
                      Last Updated
                    </th>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-[#0D5C4D]">
                      Status
                    </th>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-[#0D5C4D]">
                      Action
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {vegetables.map((vegetable, index) => (
                    <tr key={vegetable.pid} className={`border-b border-[#D0E0DB] hover:bg-[#F0F4F3] transition-colors ${index % 2 === 0 ? 'bg-white' : 'bg-[#F0F4F3]/30'}`}>
                      <td className="px-6 py-4">
                        {vegetable.product_image ? (
                          <img src={`${BASE_URL}${vegetable.product_image}`} alt={vegetable.product_name} className="w-12 h-12 rounded-lg object-cover" />
                        ) : (
                          <div className="w-12 h-12 bg-gray-200 rounded-lg flex items-center justify-center text-gray-400 text-xs">No Image</div>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-sm font-semibold text-[#0D5C4D]">{vegetable.product_name}</div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-sm text-[#0D5C4D]">{vegetable.categoryName}</div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-sm text-[#0D5C4D]">{vegetable.unit}</div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-sm text-[#0D5C4D]">{vegetable.packing_type || 'N/A'}</div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-sm font-medium text-gray-500">
                          {new Date(vegetable.updatedAt).toLocaleDateString()}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`px-3 py-1.5 rounded-full text-xs font-medium flex items-center gap-1 w-fit ${vegetable.product_status === 'active' ? 'bg-[#4ED39A]' : 'bg-yellow-500'} text-white`}>
                          <div className="w-2 h-2 rounded-full bg-white"></div>
                          {vegetable.product_status}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => handleEdit(index)}
                            className="px-4 py-1.5 border border-gray-300 text-gray-700 rounded-lg text-xs font-medium hover:bg-gray-50 transition-colors"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => handlePriceHistory(vegetable)}
                            className="px-4 py-1.5 bg-[#0D7C66] text-white rounded-lg text-xs font-medium hover:bg-[#0a6354] transition-colors"
                          >
                            Price History
                          </button>
                          <button
                            onClick={() => handleDelete(index)}
                            className="px-4 py-1.5 bg-red-100 text-red-700 rounded-lg text-xs font-medium hover:bg-red-200 transition-colors"
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            <div className="flex items-center justify-between px-6 py-4 bg-[#F0F4F3] border-t border-[#D0E0DB]">
              <div className="text-sm text-[#6B8782]">
                {totalProducts > 0 ? (
                  `Showing ${((currentPage - 1) * itemsPerPage) + 1} to ${Math.min(currentPage * itemsPerPage, totalProducts)} of ${totalProducts} products`
                ) : (
                  'No products found'
                )}
              </div>

              {totalPages > 1 && (
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                    disabled={currentPage === 1}
                    className="px-3 py-2 text-[#6B8782] hover:bg-[#D0E0DB] rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    &lt;
                  </button>

                  {[...Array(totalPages)].map((_, index) => {
                    const pageNum = index + 1;
                    if (totalPages <= 7) {
                      // Show all pages if 7 or fewer
                      return (
                        <button
                          key={pageNum}
                          onClick={() => setCurrentPage(pageNum)}
                          className={`px-4 py-2 rounded-lg font-medium ${currentPage === pageNum
                              ? 'bg-[#0D8568] text-white'
                              : 'text-[#6B8782] hover:bg-[#D0E0DB]'
                            }`}
                        >
                          {pageNum}
                        </button>
                      );
                    } else {
                      // Show condensed pagination for more than 7 pages
                      if (pageNum === 1 || pageNum === totalPages || (pageNum >= currentPage - 1 && pageNum <= currentPage + 1)) {
                        return (
                          <button
                            key={pageNum}
                            onClick={() => setCurrentPage(pageNum)}
                            className={`px-4 py-2 rounded-lg font-medium ${currentPage === pageNum
                                ? 'bg-[#0D8568] text-white'
                                : 'text-[#6B8782] hover:bg-[#D0E0DB]'
                              }`}
                          >
                            {pageNum}
                          </button>
                        );
                      } else if (pageNum === currentPage - 2 || pageNum === currentPage + 2) {
                        return (
                          <span key={pageNum} className="px-2 py-2 text-[#6B8782]">
                            ...
                          </span>
                        );
                      }
                    }
                    return null;
                  })}

                  <button
                    onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                    disabled={currentPage === totalPages}
                    className="px-3 py-2 text-[#6B8782] hover:bg-[#D0E0DB] rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    &gt;
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Category Table */}
        {activeTab === 'category' && (
          <div className="bg-white rounded-2xl overflow-hidden border border-[#D0E0DB]">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-[#D4F4E8]">
                    <th className="px-6 py-4 text-left text-sm font-semibold text-[#0D5C4D]">Image</th>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-[#0D5C4D]">Category Name</th>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-[#0D5C4D]">Description</th>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-[#0D5C4D]">Status</th>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-[#0D5C4D]">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {categories.map((category, index) => (
                    <tr key={category.cid} className={`border-b border-[#D0E0DB] hover:bg-[#F0F4F3] transition-colors ${index % 2 === 0 ? 'bg-white' : 'bg-[#F0F4F3]/30'}`}>
                      <td className="px-6 py-4">
                        {category.category_image ? (
                          <img src={`${BASE_URL}${category.category_image}`} alt={category.categoryname} className="w-12 h-12 rounded-lg object-cover" />
                        ) : (
                          <div className="w-12 h-12 bg-gray-200 rounded-lg flex items-center justify-center text-gray-400 text-xs">No Image</div>
                        )}
                      </td>
                      <td className="px-6 py-4 font-semibold text-[#0D5C4D]">{category.categoryname}</td>
                      <td className="px-6 py-4 text-sm text-[#0D5C4D]">{category.categorydescription}</td>
                      <td className="px-6 py-4">
                        <span className={`px-3 py-1.5 rounded-full text-xs font-medium ${category.category_status === 'active' ? 'bg-[#4ED39A]' : 'bg-yellow-500'} text-white flex items-center gap-1 w-fit`}>
                          <div className="w-2 h-2 rounded-full bg-white"></div>
                          {category.category_status}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => handleCategoryEdit(index)}
                            className="px-4 py-1.5 border border-gray-300 text-gray-700 rounded-lg text-xs font-medium hover:bg-gray-50 transition-colors"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => handleDelete(index)}
                            className="px-4 py-1.5 bg-red-100 text-red-700 rounded-lg text-xs font-medium hover:bg-red-200 transition-colors"
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex items-center justify-between px-6 py-4 bg-[#F0F4F3] border-t border-[#D0E0DB]">
              <div className="text-sm text-[#6B8782]">Showing {categories.length} categories</div>
              <div className="flex items-center gap-2">
                <button className="px-3 py-2 text-[#6B8782] hover:bg-[#D0E0DB] rounded-lg transition-colors">&lt;</button>
                <button className="px-4 py-2 rounded-lg font-medium bg-[#0D8568] text-white">1</button>
                <button className="px-3 py-2 text-[#6B8782] hover:bg-[#D0E0DB] rounded-lg transition-colors">&gt;</button>
              </div>
            </div>
          </div>
        )}

        {/* Multiple Product Box */}
        {activeTab === 'multipleProductBox' && (
          <div className="bg-white rounded-2xl overflow-hidden border border-[#D0E0DB]">
            <div className="p-6">
              <h2 className="text-lg font-semibold text-[#0D5C4D] mb-4">Multiple Product Box</h2>

              {multipleProductBoxes.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="bg-[#D4F4E8]">
                        <th className="px-6 py-4 text-left text-sm font-semibold text-[#0D5C4D]">
                          Multiple Product Name
                        </th>
                        <th className="px-6 py-4 text-left text-sm font-semibold text-[#0D5C4D]">
                          Product Short
                        </th>
                        <th className="px-6 py-4 text-left text-sm font-semibold text-[#0D5C4D]">
                          Products
                        </th>
                        <th className="px-6 py-4 text-left text-sm font-semibold text-[#0D5C4D]">
                          Type of Packing
                        </th>
                        <th className="px-6 py-4 text-left text-sm font-semibold text-[#0D5C4D]">
                          Status
                        </th>
                        <th className="px-6 py-4 text-left text-sm font-semibold text-[#0D5C4D]">
                          Actions
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {multipleProductBoxes.map((box, index) => (
                        <tr
                          key={box.id}
                          className={`border-b border-[#D0E0DB] hover:bg-[#F0F4F3] transition-colors ${
                            index % 2 === 0 ? 'bg-white' : 'bg-[#F0F4F3]/30'
                          }`}
                        >
                          <td className="px-6 py-4 text-sm font-semibold text-[#0D5C4D]">
                            {box.name}
                          </td>
                          <td className="px-6 py-4 text-sm text-[#0D5C4D]">
                            {box.short || '-'}
                          </td>
                          <td className="px-6 py-4 text-sm text-[#0D5C4D]">
                            {box.productIds.length > 0 ? (
                              <div className="flex flex-col gap-1.5 min-w-[200px]">
                                {box.productIds.map((id) => {
                                  const product = multiBoxProducts.find((p) => String(p.pid) === String(id));
                                  const netWeight = box.netWeights?.[id];
                                  return product ? (
                                    <div key={id} className="flex items-center justify-between gap-4">
                                      <span className="whitespace-nowrap">{product.product_name}</span>
                                      <span className={`flex-shrink-0 px-2 py-0.5 text-xs rounded font-medium ${netWeight ? 'bg-[#D4F4E8] text-[#0D5C4D]' : 'bg-gray-100 text-gray-400'}`}>
                                        {netWeight ? `${netWeight} kg` : '— kg'}
                                      </span>
                                    </div>
                                  ) : null;
                                })}
                              </div>
                            ) : '-'}
                          </td>
                          <td className="px-6 py-4 text-sm text-[#0D5C4D]">
                            {box.packingTypes.length > 0
                              ? box.packingTypes.join(', ')
                              : '-'}
                          </td>
                          <td className="px-6 py-4">
                            <span
                              className={`px-3 py-1.5 rounded-full text-xs font-medium flex items-center gap-1 w-fit ${
                                box.status === 'active' ? 'bg-[#4ED39A]' : 'bg-yellow-500'
                              } text-white`}
                            >
                              <div className="w-2 h-2 rounded-full bg-white"></div>
                              {box.status === 'active' ? 'Active' : 'Inactive'}
                            </span>
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                onClick={() => handleEditMultiBox(box)}
                                className="p-2 text-[#0D7C66] hover:bg-[#D4F4E8] rounded-lg transition-colors"
                                title="Edit"
                              >
                                <Pencil className="w-4 h-4" />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDeleteMultiBox(box)}
                                className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                title="Delete"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="text-sm text-gray-500">
                  No multiple product boxes found. Click "Add Multiple Product Box" to create one.
                </div>
              )}
            </div>
          </div>
        )}

        {/* Price History View */}
        {activeTab === 'product' && selectedProduct && (
          <div className="bg-white rounded-2xl overflow-hidden border border-[#D0E0DB]">
            <div className="p-6">
              <button
                onClick={() => {
                  setSelectedProduct(null);
                  setDetailPage(1);
                }}
                className="mb-4 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors flex items-center gap-2"
              >
                ← Back to Products
              </button>

              <div className="mb-6">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="bg-[#D4F4E8]">
                        <th className="px-6 py-4 text-left text-sm font-semibold text-[#0D5C4D]">Image</th>
                        <th className="px-6 py-4 text-left text-sm font-semibold text-[#0D5C4D]">Vegetable Name</th>
                        <th className="px-6 py-4 text-left text-sm font-semibold text-[#0D5C4D]">Category</th>
                        <th className="px-6 py-4 text-left text-sm font-semibold text-[#0D5C4D]">Unit</th>
                        <th className="px-6 py-4 text-left text-sm font-semibold text-[#0D5C4D]">Current Rate (₹/KG)</th>
                        <th className="px-6 py-4 text-left text-sm font-semibold text-[#0D5C4D]">Last Updated</th>
                        <th className="px-6 py-4 text-left text-sm font-semibold text-[#0D5C4D]">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr className="border-b border-[#D0E0DB] hover:bg-[#F0F4F3] transition-colors bg-white">
                        <td className="px-6 py-4">
                          {selectedProduct.product_image ? (
                            <img src={`${BASE_URL}${selectedProduct.product_image}`} alt={selectedProduct.product_name} className="w-12 h-12 rounded-lg object-cover" />
                          ) : (
                            <div className="w-12 h-12 bg-gray-200 rounded-lg flex items-center justify-center text-gray-400 text-xs">No Image</div>
                          )}
                        </td>
                        <td className="px-6 py-4">
                          <div className="text-sm font-semibold text-[#0D5C4D]">{selectedProduct.product_name}</div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="text-sm text-[#0D5C4D]">{selectedProduct.categoryName}</div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="text-sm text-[#0D5C4D]">{selectedProduct.unit}</div>
                        </td>
                        <td className="px-6 py-4">
                          {editingPriceId === selectedProduct.pid ? (
                            <div className="flex items-center gap-2">
                              <input
                                type="number"
                                step="0.01"
                                value={editingPrice}
                                onChange={(e) => setEditingPrice(e.target.value)}
                                className="w-24 px-2 py-1 border border-[#0D7C66] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0D7C66] text-sm"
                                autoFocus
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') handlePriceSave(selectedProduct.pid);
                                  if (e.key === 'Escape') handlePriceCancel();
                                }}
                              />
                              <button
                                onClick={() => handlePriceSave(selectedProduct.pid)}
                                className="px-2 py-1 bg-[#0D7C66] text-white rounded text-xs hover:bg-[#0a6354]"
                              >
                                ✓
                              </button>
                              <button
                                onClick={handlePriceCancel}
                                className="px-2 py-1 bg-gray-300 text-gray-700 rounded text-xs hover:bg-gray-400"
                              >
                                ✕
                              </button>
                            </div>
                          ) : (
                            <input
                              type="number"
                              step="0.01"
                              value={selectedProduct.current_price}
                              onClick={() => handlePriceEdit(selectedProduct.pid, selectedProduct.current_price)}
                              readOnly
                              className="w-24 px-2 py-1 border border-gray-200 rounded-lg text-sm cursor-pointer hover:border-[#0D7C66] focus:outline-none"
                              title="Click to edit price"
                            />
                          )}
                        </td>
                        <td className="px-6 py-4">
                          <div className="text-sm font-medium text-gray-500">
                            {new Date(selectedProduct.updatedAt).toLocaleDateString()}
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <span className={`px-3 py-1.5 rounded-full text-xs font-medium flex items-center gap-1 w-fit ${selectedProduct.product_status === 'active' ? 'bg-[#4ED39A]' : 'bg-yellow-500'} text-white`}>
                            <div className="w-2 h-2 rounded-full bg-white"></div>
                            {selectedProduct.product_status}
                          </span>
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>

              {selectedProduct.priceChanges.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  No price update history for this product
                </div>
              ) : (
                <>
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="bg-[#D4F4E8]">
                          <th className="px-6 py-4 text-left text-sm font-semibold text-[#0D5C4D]">Price (₹/{selectedProduct.unit})</th>
                          <th className="px-6 py-4 text-left text-sm font-semibold text-[#0D5C4D]">Date</th>
                        </tr>
                      </thead>
                      <tbody>
                        {selectedProduct.priceChanges
                          .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt))
                          .slice((detailPage - 1) * itemsPerPage, detailPage * itemsPerPage)
                          .map((change, idx) => {
                            const date = new Date(change.updatedAt).toLocaleDateString();

                            return (
                              <tr key={idx} className={`border-b border-[#D0E0DB] hover:bg-[#F0F4F3] transition-colors ${idx % 2 === 0 ? 'bg-white' : 'bg-[#F0F4F3]/30'}`}>
                                <td className="px-6 py-4">
                                  <div className="text-sm font-semibold text-[#0D5C4D]">₹{change.newPrice}</div>
                                </td>
                                <td className="px-6 py-4">
                                  <div className="text-sm font-medium text-gray-500">{date}</div>
                                </td>
                              </tr>
                            );
                          })}
                      </tbody>
                    </table>
                  </div>

                  {/* Pagination */}
                  <div className="flex items-center justify-between px-6 py-4 bg-[#F0F4F3] border-t border-[#D0E0DB]">
                    <div className="text-sm text-[#6B8782]">
                      Showing {selectedProduct.priceChanges.length} price updates
                    </div>

                    <div className="flex items-center gap-2">
                      <button className="px-3 py-2 text-[#6B8782] hover:bg-[#D0E0DB] rounded-lg transition-colors">
                        &lt;
                      </button>

                      <button className="px-4 py-2 rounded-lg font-medium bg-[#0D8568] text-white">
                        1
                      </button>

                      <button className="px-4 py-2 rounded-lg font-medium text-[#6B8782] hover:bg-[#D0E0DB]">
                        2
                      </button>

                      <button className="px-3 py-2 text-[#6B8782] hover:bg-[#D0E0DB] rounded-lg transition-colors">
                        ...
                      </button>

                      <button className="px-3 py-2 text-[#6B8782] hover:bg-[#D0E0DB] rounded-lg transition-colors">
                        &gt;
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        )}

        {/* Customer Product Order */}
        {activeTab === 'customerOrder' && (
          <div>
            {/* Customer Tabs */}
            <div className="flex items-center gap-2 mb-6 overflow-x-auto pb-2">
              {customers.map((customer) => {
                const custId = customer.customer_id ?? customer.id ?? customer.cust_id;
                return (
                  <button
                    key={custId}
                    onClick={() => {
                      setSelectedCustomerId(custId);
                      setCustomerOrderPage(1);
                      fetchCustomerPreferences(custId);
                    }}
                    className={`px-4 py-2 rounded-lg font-medium transition-all text-sm whitespace-nowrap ${
                      selectedCustomerId === custId
                        ? 'bg-[#0D7C66] text-white shadow-md'
                        : 'bg-white text-gray-600 hover:bg-gray-50 border border-gray-200'
                    }`}
                  >
                    {customer.customer_name ?? customer.name ?? 'Customer'}
                  </button>
                );
              })}
            </div>

            {/* Search Bar */}
            <div className="mb-6">
              <div className="relative max-w-md">
                <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-[#6B8782]" />
                <input
                  type="text"
                  placeholder="Search products..."
                  value={customerOrderSearchQuery}
                  onChange={(e) => {
                    setCustomerOrderSearchQuery(e.target.value);
                    setCustomerOrderPage(1);
                  }}
                  className="w-full pl-12 pr-4 py-3 bg-[#F0F4F3] border-none rounded-xl text-[#0D5C4D] placeholder-[#6B8782] focus:outline-none focus:ring-2 focus:ring-[#0D8568] text-sm"
                />
              </div>
            </div>

            {/* Product Table */}
            <div className="bg-white rounded-2xl overflow-hidden border border-[#D0E0DB]">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="bg-[#D4F4E8]">
                      <th className="px-6 py-4 text-left text-sm font-semibold text-[#0D5C4D]">Name</th>
                      <th className="px-6 py-4 text-left text-sm font-semibold text-[#0D5C4D]">Status</th>
                      <th className="px-6 py-4 text-left text-sm font-semibold text-[#0D5C4D]">Display Order</th>
                      <th className="px-6 py-4 text-left text-sm font-semibold text-[#0D5C4D]">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {getPaginatedCustomerPreferences().map((product, index) => {
                      const itemKey = `product_${product.product_id}`;
                      return (
                        <tr key={itemKey} className={`border-b border-[#D0E0DB] hover:bg-[#F0F4F3] transition-colors ${index % 2 === 0 ? 'bg-white' : 'bg-[#F0F4F3]/30'}`}>
                          <td className="px-6 py-4">
                            <div className="text-sm font-semibold text-[#0D5C4D]">{product.product_name}</div>
                          </td>
                          <td className="px-6 py-4">
                            <label className="relative inline-flex items-center cursor-pointer">
                              <input
                                type="checkbox"
                                checked={product.enabled}
                                onChange={() => handlePreferenceToggle(itemKey)}
                                disabled={product.enabled && editingPreference !== itemKey}
                                className="sr-only peer"
                              />
                              <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-[#0D7C66]/20 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#0D7C66] peer-disabled:opacity-50 peer-disabled:cursor-not-allowed"></div>
                            </label>
                          </td>
                          <td className="px-6 py-4">
                            <input
                              type="number"
                              value={product.display_order}
                              onChange={(e) => handleDisplayOrderChange(itemKey, e.target.value)}
                              disabled={!product.enabled || (product.enabled && editingPreference !== itemKey)}
                              placeholder=""
                              className="w-24 px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0D7C66] text-sm disabled:bg-gray-100 disabled:cursor-not-allowed"
                              min="0"
                            />
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-2">
                              {editingPreference === itemKey ? (
                                <>
                                  <button
                                    onClick={() => {
                                      handleSaveSingleProduct(itemKey);
                                      setEditingPreference(null);
                                    }}
                                    disabled={loading}
                                    className="px-3 py-1.5 bg-[#0D7C66] text-white rounded-lg text-xs font-medium hover:bg-[#0a6354] transition-colors disabled:opacity-50"
                                  >
                                    Save
                                  </button>
                                  <button
                                    onClick={handleCancelEdit}
                                    className="px-3 py-1.5 border border-gray-300 text-gray-700 rounded-lg text-xs font-medium hover:bg-gray-50 transition-colors"
                                  >
                                    Cancel
                                  </button>
                                </>
                              ) : (
                                <>
                                  {!product.enabled && (
                                    <button
                                      onClick={() => handleSaveSingleProduct(itemKey)}
                                      disabled={loading}
                                      className="px-3 py-1.5 bg-[#0D7C66] text-white rounded-lg text-xs font-medium hover:bg-[#0a6354] transition-colors disabled:opacity-50"
                                    >
                                      Save
                                    </button>
                                  )}
                                  {product.enabled && (
                                    <button
                                      onClick={() => handleEditProduct(itemKey)}
                                      className="px-3 py-1.5 border border-gray-300 text-gray-700 rounded-lg text-xs font-medium hover:bg-gray-50 transition-colors"
                                    >
                                      Edit
                                    </button>
                                  )}
                                  {product.enabled && (
                                    <button
                                      onClick={() => handleDeleteProduct(itemKey)}
                                      className="px-3 py-1.5 bg-red-100 text-red-700 rounded-lg text-xs font-medium hover:bg-red-200 transition-colors"
                                    >
                                      Delete
                                    </button>
                                  )}
                                </>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              {getCustomerOrderTotalPages() > 1 && (
                <div className="flex items-center justify-between px-6 py-4 bg-[#F0F4F3] border-t border-[#D0E0DB]">
                  <div className="text-sm text-[#6B8782]">
                    Showing {((customerOrderPage - 1) * customerOrderItemsPerPage) + 1} to {Math.min(customerOrderPage * customerOrderItemsPerPage, getCurrentCustomerPreferences().length)} of {getCurrentCustomerPreferences().length} items
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setCustomerOrderPage(prev => Math.max(prev - 1, 1))}
                      disabled={customerOrderPage === 1}
                      className="px-3 py-2 text-[#6B8782] hover:bg-[#D0E0DB] rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      &lt;
                    </button>

                    {[...Array(getCustomerOrderTotalPages())].map((_, index) => {
                      const pageNum = index + 1;
                      const totalPages = getCustomerOrderTotalPages();
                      if (totalPages <= 7) {
                        return (
                          <button
                            key={pageNum}
                            onClick={() => setCustomerOrderPage(pageNum)}
                            className={`px-4 py-2 rounded-lg font-medium ${customerOrderPage === pageNum
                                ? 'bg-[#0D8568] text-white'
                                : 'text-[#6B8782] hover:bg-[#D0E0DB]'
                              }`}
                          >
                            {pageNum}
                          </button>
                        );
                      } else {
                        if (pageNum === 1 || pageNum === totalPages || (pageNum >= customerOrderPage - 1 && pageNum <= customerOrderPage + 1)) {
                          return (
                            <button
                              key={pageNum}
                              onClick={() => setCustomerOrderPage(pageNum)}
                              className={`px-4 py-2 rounded-lg font-medium ${customerOrderPage === pageNum
                                  ? 'bg-[#0D8568] text-white'
                                  : 'text-[#6B8782] hover:bg-[#D0E0DB]'
                                }`}
                            >
                              {pageNum}
                            </button>
                          );
                        } else if (pageNum === customerOrderPage - 2 || pageNum === customerOrderPage + 2) {
                          return (
                            <span key={pageNum} className="px-2 py-2 text-[#6B8782]">
                              ...
                            </span>
                          );
                        }
                      }
                      return null;
                    })}

                    <button
                      onClick={() => setCustomerOrderPage(prev => Math.min(prev + 1, getCustomerOrderTotalPages()))}
                      disabled={customerOrderPage === getCustomerOrderTotalPages()}
                      className="px-3 py-2 text-[#6B8782] hover:bg-[#D0E0DB] rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      &gt;
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Product Count */}
        {activeTab === 'productCount' && (
          <div>
            {/* Search Bar */}
            <div className="mb-6">
              <div className="relative max-w-md">
                <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-[#6B8782]" />
                <input
                  type="text"
                  placeholder="Search products..."
                  value={productCountSearchQuery}
                  onChange={(e) => {
                    setProductCountSearchQuery(e.target.value);
                    setProductCountPage(1);
                  }}
                  className="w-full pl-12 pr-4 py-3 bg-[#F0F4F3] border-none rounded-xl text-[#0D5C4D] placeholder-[#6B8782] focus:outline-none focus:ring-2 focus:ring-[#0D8568] text-sm"
                />
              </div>
            </div>

            {/* Product Table */}
            <div className="bg-white rounded-2xl overflow-hidden border border-[#D0E0DB]">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="bg-[#D4F4E8]">
                      <th className="px-6 py-4 text-left text-sm font-semibold text-[#0D5C4D]">Product Name</th>
                      <th className="px-6 py-4 text-left text-sm font-semibold text-[#0D5C4D]">Category</th>
                      <th className="px-6 py-4 text-left text-sm font-semibold text-[#0D5C4D]">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {productCountList.map((record, index) => {
                      const status = record.product_status || 'inactive';
                      return (
                        <tr key={record.pid} className={`border-b border-[#D0E0DB] hover:bg-[#F0F4F3] transition-colors ${index % 2 === 0 ? 'bg-white' : 'bg-[#F0F4F3]/30'}`}>
                          <td className="px-6 py-4">
                            <div className="text-sm font-semibold text-[#0D5C4D]">{record.product_name}</div>
                          </td>
                          <td className="px-6 py-4">
                            <div className="text-sm text-[#0D5C4D]">{record.categoryName || 'N/A'}</div>
                          </td>
                          <td className="px-6 py-4">
                            <label className="relative inline-flex items-center cursor-pointer">
                              <input
                                type="checkbox"
                                checked={status === 'active'}
                                onChange={() => handleProductCountStatusToggle(record.pid)}
                                disabled={productCountToggleLoading === record.pid}
                                className="sr-only peer"
                              />
                              <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-[#0D7C66]/20 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#0D7C66] peer-disabled:opacity-50 peer-disabled:cursor-not-allowed"></div>
                            </label>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              {getProductCountTotalPages() > 1 && (
                <div className="flex items-center justify-between px-6 py-4 bg-[#F0F4F3] border-t border-[#D0E0DB]">
                  <div className="text-sm text-[#6B8782]">
                    Showing {((productCountPage - 1) * productCountItemsPerPage) + 1} to {Math.min(productCountPage * productCountItemsPerPage, productCountTotal)} of {productCountTotal} products
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setProductCountPage(prev => Math.max(prev - 1, 1))}
                      disabled={productCountPage === 1}
                      className="px-3 py-2 text-[#6B8782] hover:bg-[#D0E0DB] rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      &lt;
                    </button>

                    {[...Array(getProductCountTotalPages())].map((_, index) => {
                      const pageNum = index + 1;
                      const totalPages = getProductCountTotalPages();
                      if (totalPages <= 7) {
                        return (
                          <button
                            key={pageNum}
                            onClick={() => setProductCountPage(pageNum)}
                            className={`px-4 py-2 rounded-lg font-medium ${productCountPage === pageNum
                                ? 'bg-[#0D8568] text-white'
                                : 'text-[#6B8782] hover:bg-[#D0E0DB]'
                              }`}
                          >
                            {pageNum}
                          </button>
                        );
                      } else {
                        if (pageNum === 1 || pageNum === totalPages || (pageNum >= productCountPage - 1 && pageNum <= productCountPage + 1)) {
                          return (
                            <button
                              key={pageNum}
                              onClick={() => setProductCountPage(pageNum)}
                              className={`px-4 py-2 rounded-lg font-medium ${productCountPage === pageNum
                                  ? 'bg-[#0D8568] text-white'
                                  : 'text-[#6B8782] hover:bg-[#D0E0DB]'
                                }`}
                            >
                              {pageNum}
                            </button>
                          );
                        } else if (pageNum === productCountPage - 2 || pageNum === productCountPage + 2) {
                          return (
                            <span key={pageNum} className="px-2 py-2 text-[#6B8782]">
                              ...
                            </span>
                          );
                        }
                      }
                      return null;
                    })}

                    <button
                      onClick={() => setProductCountPage(prev => Math.min(prev + 1, getProductCountTotalPages()))}
                      disabled={productCountPage === getProductCountTotalPages()}
                      className="px-3 py-2 text-[#6B8782] hover:bg-[#D0E0DB] rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      &gt;
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Add Modal */}
        {showAddModal && (
          <div className="fixed inset-0 bg-black/50 flex items-start justify-center z-50 p-4 overflow-y-auto">
            <div className="bg-white rounded-2xl p-6 max-w-md w-full my-8 max-h-[calc(100vh-4rem)]">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-[#0D5C4D]">
                  {activeTab === 'product'
                    ? 'Add Product'
                    : activeTab === 'category'
                    ? 'Add Category'
                    : 'Add Multiple Product Box'}
                </h3>
                <button onClick={() => setShowAddModal(false)} className="text-gray-400 hover:text-gray-600">
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="overflow-y-auto max-h-[calc(100vh-12rem)] pr-2">
                <form
                  onSubmit={activeTab === 'multipleProductBox' ? handleMultiBoxSubmit : handleAddSubmit}
                  className="space-y-4"
                >
                  {activeTab === 'category' ? (
                    <>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Category Name</label>
                        <input type="text" name="categoryname" className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0D7C66] text-sm" required />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Description</label>
                        <textarea name="categorydescription" className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0D7C66] text-sm" rows="3"></textarea>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Image</label>
                        <input type="file" name="category_image" accept="image/*" className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0D7C66] text-sm" />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Status</label>
                        <select name="category_status" className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0D7C66] text-sm">
                          <option value="active">Active</option>
                          <option value="inactive">Inactive</option>
                        </select>
                      </div>
                    </>
                  ) : activeTab === 'product' ? (
                    <>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Product Name</label>
                        <input type="text" name="product_name" className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0D7C66] text-sm" required />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Product Short</label>
                        <input type="text" name="product_short" className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0D7C66] text-sm" />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Net Weight/Kgs</label>
                        <input type="number" step="0.01" name="net_weight" className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0D7C66] text-sm" />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Category</label>
                        <select name="category_id" className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0D7C66] text-sm" required>
                          <option value="">Select Category</option>
                          {sortDropdownObjects(categories, (cat) => cat.categoryname).map(cat => (
                            <option key={cat.cid} value={cat.cid}>{cat.categoryname}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Image</label>
                        <input type="file" name="product_image" accept="image/*" className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0D7C66] text-sm" />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Unit</label>
                        <input
                          type="text"
                          name="unit"
                          defaultValue="kg"
                          className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0D7C66] text-sm"
                          required
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Current Price</label>
                        <input type="number" step="0.01" name="current_price" className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0D7C66] text-sm" required />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Status</label>
                        <select name="product_status" className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0D7C66] text-sm">
                          <option value="active">Active</option>
                          <option value="inactive">Inactive</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Type of Packing</label>
                        <div className="border border-gray-200 rounded-lg p-2 max-h-40 overflow-y-auto">
                          {sortDropdownObjects(packingOptions, (item) => item.name).map((item) => (
                            <label key={item.id} className="flex items-center gap-2 p-2 hover:bg-gray-50 rounded cursor-pointer">
                              <input
                                type="checkbox"
                                checked={selectedPackings.includes(item.name)}
                                onChange={(e) => {
                                  if (e.target.checked) {
                                    setSelectedPackings([...selectedPackings, item.name]);
                                  } else {
                                    setSelectedPackings(selectedPackings.filter(p => p !== item.name));
                                  }
                                }}
                                className="w-4 h-4 text-[#0D7C66] border-gray-300 rounded focus:ring-[#0D7C66]"
                              />
                              <span className="text-sm text-gray-700">{item.name}</span>
                            </label>
                          ))}
                        </div>
                      </div>
                    </>
                  ) : (
                    <>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Multiple Product Name
                        </label>
                        <input
                          type="text"
                          value={multiBoxFormData.name}
                          onChange={(e) =>
                            setMultiBoxFormData((prev) => ({ ...prev, name: e.target.value }))
                          }
                          className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0D7C66] text-sm"
                          required
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Product Short
                        </label>
                        <input
                          type="text"
                          value={multiBoxFormData.short}
                          onChange={(e) =>
                            setMultiBoxFormData((prev) => ({ ...prev, short: e.target.value }))
                          }
                          className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0D7C66] text-sm"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Select Products
                        </label>
                        <div className="sell-dropdown">
                          <div className="relative">
                            <button
                              type="button"
                              onClick={() => setOpenMultiBoxDropdown(prev => !prev)}
                              className="w-full px-4 py-2.5 bg-[#F0F4F3] border border-[#D0E0DB] rounded-xl text-[#0D5C4D] focus:outline-none focus:ring-2 focus:ring-[#0D8568] flex items-center justify-between"
                            >
                              <span className="text-left truncate">
                                {multiBoxSelectedProducts.length > 0
                                  ? `${multiBoxSelectedProducts.length} product(s) selected`
                                  : 'Select product(s)'}
                              </span>
                              <ChevronDown className="w-4 h-4 text-[#6B8782] flex-shrink-0 ml-2" />
                            </button>

                            {openMultiBoxDropdown && (
                              <div className="absolute z-50 mt-1 w-full bg-white border border-[#D0E0DB] rounded-xl shadow-lg max-h-60 overflow-y-auto">
                                {multiBoxProducts.length === 0 ? (
                                  <div className="px-4 py-3 text-sm text-[#6B8782]">
                                    No products available
                                  </div>
                                ) : (
                                  multiBoxProducts.map((product) => {
                                    const id = String(product.pid);
                                    const isSelected = multiBoxSelectedProducts.includes(id);

                                    return (
                                      <label
                                        key={product.pid}
                                        onClick={(e) => e.stopPropagation()}
                                        className={`w-full cursor-pointer px-4 py-2.5 text-sm hover:bg-[#F0F4F3] flex items-center gap-3 ${
                                          isSelected ? 'bg-[#D4F4E8] text-[#0D5C4D]' : 'text-[#0D5C4D]'
                                        }`}
                                      >
                                        <input
                                          type="checkbox"
                                          checked={isSelected}
                                          onChange={() => {
                                            setMultiBoxSelectedProducts((prev) =>
                                              isSelected
                                                ? prev.filter((pid) => pid !== id)
                                                : [...prev, id]
                                            );
                                          }}
                                          className="w-4 h-4 text-[#0D8568] focus:ring-[#0D8568] rounded flex-shrink-0"
                                        />
                                        <span>{product.product_name}</span>
                                      </label>
                                    );
                                  })
                                )}
                              </div>
                            )}
                          </div>
                          {multiBoxSelectedProducts.length > 0 && (
                            <p className="mt-1 text-xs text-[#6B8782]">
                              {multiBoxSelectedProducts.length} product(s) selected
                            </p>
                          )}
                        </div>
                      </div>
                      {multiBoxSelectedProducts.length > 0 && (
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            Net Weight per Product
                          </label>
                          <div className="space-y-2">
                            {multiBoxSelectedProducts.map((pid) => {
                              const product = multiBoxProducts.find((p) => String(p.pid) === String(pid));
                              return (
                                <div key={pid} className="flex items-center gap-3">
                                  <span className="text-sm text-[#0D5C4D] flex-1 truncate">
                                    {product?.product_name || pid}
                                  </span>
                                  <input
                                    type="number"
                                    min="0"
                                    step="any"
                                    placeholder="e.g. 1"
                                    value={multiBoxProductNetWeights[pid] || ''}
                                    onChange={(e) =>
                                      setMultiBoxProductNetWeights((prev) => ({
                                        ...prev,
                                        [pid]: e.target.value
                                      }))
                                    }
                                    className="w-32 px-3 py-1.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0D7C66] text-sm"
                                  />
                                  <span className="text-xs text-gray-500 w-6">Kg</span>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Type of Packing
                        </label>
                        <div className="border border-gray-200 rounded-lg p-2 max-h-40 overflow-y-auto">
                          {sortDropdownObjects(packingOptions, (item) => item.name).map((item) => (
                            <label
                              key={item.id}
                              className="flex items-center gap-2 p-2 hover:bg-gray-50 rounded cursor-pointer"
                            >
                              <input
                                type="checkbox"
                                checked={multiBoxSelectedPackings.includes(item.name)}
                                onChange={(e) => {
                                  if (e.target.checked) {
                                    setMultiBoxSelectedPackings((prev) => [...prev, item.name]);
                                  } else {
                                    setMultiBoxSelectedPackings((prev) =>
                                      prev.filter((p) => p !== item.name)
                                    );
                                  }
                                }}
                                className="w-4 h-4 text-[#0D7C66] border-gray-300 rounded focus:ring-[#0D7C66]"
                              />
                              <span className="text-sm text-gray-700">{item.name}</span>
                            </label>
                          ))}
                        </div>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Status
                        </label>
                        <select
                          value={multiBoxFormData.status}
                          onChange={(e) =>
                            setMultiBoxFormData((prev) => ({ ...prev, status: e.target.value }))
                          }
                          className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0D7C66] text-sm"
                        >
                          <option value="active">Active</option>
                          <option value="inactive">Inactive</option>
                        </select>
                      </div>
                    </>
                  )}
                  <div className="flex gap-3 pt-4 sticky bottom-0 bg-white">
                    <button type="submit" disabled={loading} className="flex-1 px-6 py-2.5 bg-[#0D7C66] hover:bg-[#0a6354] text-white font-semibold rounded-lg transition-colors disabled:opacity-50">
                      {loading ? 'Adding...' : 'Add'}
                    </button>
                    <button type="button" onClick={() => setShowAddModal(false)} className="flex-1 px-6 py-2.5 border border-gray-300 text-gray-700 font-semibold rounded-lg hover:bg-gray-50 transition-colors">Cancel</button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        )}

        {/* Edit Multiple Product Box Modal */}
        {showEditMultiBoxModal && (
          <div className="fixed inset-0 bg-black/50 flex items-start justify-center z-50 p-4 overflow-y-auto">
            <div className="bg-white rounded-2xl p-6 max-w-md w-full my-8 max-h-[calc(100vh-4rem)]">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-[#0D5C4D]">Edit Multiple Product Box</h3>
                <button
                  onClick={() => {
                    setShowEditMultiBoxModal(false);
                    setEditingMultiBoxId(null);
                    setMultiBoxFormData({ name: '', short: '', status: 'active' });
                    setMultiBoxSelectedProducts([]);
                    setMultiBoxProductNetWeights({});
                    setMultiBoxSelectedPackings([]);
                  }}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="overflow-y-auto max-h-[calc(100vh-12rem)] pr-2">
                <form onSubmit={handleEditMultiBoxSubmit} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Multiple Product Name
                    </label>
                    <input
                      type="text"
                      value={multiBoxFormData.name}
                      onChange={(e) =>
                        setMultiBoxFormData((prev) => ({ ...prev, name: e.target.value }))
                      }
                      className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0D7C66] text-sm"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Product Short
                    </label>
                    <input
                      type="text"
                      value={multiBoxFormData.short}
                      onChange={(e) =>
                        setMultiBoxFormData((prev) => ({ ...prev, short: e.target.value }))
                      }
                      className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0D7C66] text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Select Products
                    </label>
                    <div className="sell-dropdown">
                      <div className="relative">
                        <button
                          type="button"
                          onClick={() => setOpenMultiBoxDropdown((prev) => !prev)}
                          className="w-full px-4 py-2.5 bg-[#F0F4F3] border border-[#D0E0DB] rounded-xl text-[#0D5C4D] focus:outline-none focus:ring-2 focus:ring-[#0D8568] flex items-center justify-between"
                        >
                          <span className="text-left truncate">
                            {multiBoxSelectedProducts.length > 0
                              ? `${multiBoxSelectedProducts.length} product(s) selected`
                              : 'Select product(s)'}
                          </span>
                          <ChevronDown className="w-4 h-4 text-[#6B8782] flex-shrink-0 ml-2" />
                        </button>
                        {openMultiBoxDropdown && (
                          <div className="absolute z-50 mt-1 w-full bg-white border border-[#D0E0DB] rounded-xl shadow-lg max-h-60 overflow-y-auto">
                            {multiBoxProducts.length === 0 ? (
                              <div className="px-4 py-3 text-sm text-[#6B8782]">
                                No products available
                              </div>
                            ) : (
                              multiBoxProducts.map((product) => {
                                const id = String(product.pid);
                                const isSelected = multiBoxSelectedProducts.includes(id);
                                return (
                                  <label
                                    key={product.pid}
                                    onClick={(e) => e.stopPropagation()}
                                    className={`w-full cursor-pointer px-4 py-2.5 text-sm hover:bg-[#F0F4F3] flex items-center gap-3 ${
                                      isSelected ? 'bg-[#D4F4E8] text-[#0D5C4D]' : 'text-[#0D5C4D]'
                                    }`}
                                  >
                                    <input
                                      type="checkbox"
                                      checked={isSelected}
                                      onChange={() => {
                                        setMultiBoxSelectedProducts((prev) =>
                                          isSelected
                                            ? prev.filter((pid) => pid !== id)
                                            : [...prev, id]
                                        );
                                      }}
                                      className="w-4 h-4 text-[#0D8568] focus:ring-[#0D8568] rounded flex-shrink-0"
                                    />
                                    <span>{product.product_name}</span>
                                  </label>
                                );
                              })
                            )}
                          </div>
                        )}
                      </div>
                      {multiBoxSelectedProducts.length > 0 && (
                        <p className="mt-1 text-xs text-[#6B8782]">
                          {multiBoxSelectedProducts.length} product(s) selected
                        </p>
                      )}
                    </div>
                  </div>
                  {multiBoxSelectedProducts.length > 0 && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Net Weight per Product
                      </label>
                      <div className="space-y-2">
                        {multiBoxSelectedProducts.map((pid) => {
                          const product = multiBoxProducts.find((p) => String(p.pid) === String(pid));
                          return (
                            <div key={pid} className="flex items-center gap-3">
                              <span className="text-sm text-[#0D5C4D] flex-1 truncate">
                                {product?.product_name || pid}
                              </span>
                              <input
                                type="text"
                                min="0"
                                step="any"
                                placeholder="e.g. 1"
                                value={multiBoxProductNetWeights[pid] || ''}
                                onChange={(e) =>
                                  setMultiBoxProductNetWeights((prev) => ({
                                    ...prev,
                                    [pid]: e.target.value
                                  }))
                                }
                                className="w-32 px-3 py-1.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0D7C66] text-sm"
                              />
                              <span className="text-xs text-gray-500 w-6">kg</span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Type of Packing
                    </label>
                    <div className="border border-gray-200 rounded-lg p-2 max-h-40 overflow-y-auto">
                      {sortDropdownObjects(packingOptions, (item) => item.name).map((item) => (
                        <label
                          key={item.id}
                          className="flex items-center gap-2 p-2 hover:bg-gray-50 rounded cursor-pointer"
                        >
                          <input
                            type="checkbox"
                            checked={multiBoxSelectedPackings.includes(item.name)}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setMultiBoxSelectedPackings((prev) => [...prev, item.name]);
                              } else {
                                setMultiBoxSelectedPackings((prev) =>
                                  prev.filter((p) => p !== item.name)
                                );
                              }
                            }}
                            className="w-4 h-4 text-[#0D7C66] border-gray-300 rounded focus:ring-[#0D7C66]"
                          />
                          <span className="text-sm text-gray-700">{item.name}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Status
                    </label>
                    <select
                      value={multiBoxFormData.status}
                      onChange={(e) =>
                        setMultiBoxFormData((prev) => ({ ...prev, status: e.target.value }))
                      }
                      className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0D7C66] text-sm"
                    >
                      <option value="active">Active</option>
                      <option value="inactive">Inactive</option>
                    </select>
                  </div>
                  <div className="flex gap-3 pt-4 sticky bottom-0 bg-white">
                    <button
                      type="submit"
                      disabled={loading}
                      className="flex-1 px-6 py-2.5 bg-[#0D7C66] hover:bg-[#0a6354] text-white font-semibold rounded-lg transition-colors disabled:opacity-50"
                    >
                      {loading ? 'Updating...' : 'Update'}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setShowEditMultiBoxModal(false);
                        setEditingMultiBoxId(null);
                        setMultiBoxFormData({ name: '', short: '', status: 'active' });
                        setMultiBoxSelectedProducts([]);
                        setMultiBoxProductNetWeights({});
                        setMultiBoxSelectedPackings([]);
                      }}
                      className="flex-1 px-6 py-2.5 border border-gray-300 text-gray-700 font-semibold rounded-lg hover:bg-gray-50 transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        )}

        {/* Edit Modal */}
        {showEditModal && (
          <div className="fixed inset-0 bg-black/50 flex items-start justify-center z-50 p-4 overflow-y-auto">
            <div className="bg-white rounded-2xl p-6 max-w-md w-full my-8 max-h-[calc(100vh-4rem)]">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-[#0D5C4D]">Edit {activeTab === 'product' ? 'Product' : 'Category'}</h3>
                <button onClick={() => setShowEditModal(false)} className="text-gray-400 hover:text-gray-600">
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="overflow-y-auto max-h-[calc(100vh-12rem)] pr-2">
                <form onSubmit={activeTab === 'product' ? handleEditSubmit : handleCategoryEditSubmit} className="space-y-4">
                  {activeTab === 'category' ? (
                    <>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Category Name</label>
                        <input
                          type="text"
                          name="categoryname"
                          value={editFormData.categoryname || ''}
                          onChange={handleEditChange}
                          className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0D7C66] text-sm"
                          required
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Description</label>
                        <input
                          type="text"
                          name="categorydescription"
                          value={editFormData.categorydescription || ''}
                          onChange={handleEditChange}
                          className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0D7C66] text-sm"
                          required
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Image</label>
                        <input type="file" name="category_image" accept="image/*" className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0D7C66] text-sm" />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Status</label>
                        <select
                          name="category_status"
                          value={editFormData.category_status || 'active'}
                          onChange={handleEditChange}
                          className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0D7C66] text-sm"
                        >
                          <option value="active">Active</option>
                          <option value="inactive">Inactive</option>
                        </select>
                      </div>
                    </>
                  ) : (
                    <>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Product Name</label>
                        <input
                          type="text"
                          name="product_name"
                          value={editFormData.product_name || ''}
                          onChange={handleEditChange}
                          className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0D7C66] text-sm"
                          required
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Product Short</label>
                        <input
                          type="text"
                          name="product_short"
                          value={editFormData.product_short || ''}
                          onChange={handleEditChange}
                          className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0D7C66] text-sm"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Net Weight/Kgs</label>
                        <input
                          type="number"
                          step="0.01"
                          name="net_weight"
                          value={editFormData.net_weight || ''}
                          onChange={handleEditChange}
                          className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0D7C66] text-sm"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Category</label>
                        <select
                          name="category_id"
                          value={editFormData.category_id || ''}
                          onChange={handleEditChange}
                          className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0D7C66] text-sm"
                          required
                        >
                          <option value="">Select Category</option>
                          {sortDropdownObjects(categories, (cat) => cat.categoryname).map(cat => (
                            <option key={cat.cid} value={cat.cid}>{cat.categoryname}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Image</label>
                        <input type="file" name="product_image" accept="image/*" className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0D7C66] text-sm" />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Unit</label>
                        <input
                          type="text"
                          name="unit"
                          value={editFormData.unit || 'kg'}
                          onChange={handleEditChange}
                          className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0D7C66] text-sm"
                          required
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Current Price</label>
                        <input
                          type="number"
                          step="0.01"
                          name="current_price"
                          value={editFormData.current_price || ''}
                          onChange={handleEditChange}
                          className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0D7C66] text-sm"
                          required
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Status</label>
                        <select
                          name="product_status"
                          value={editFormData.product_status || 'active'}
                          onChange={handleEditChange}
                          className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0D7C66] text-sm"
                        >
                          <option value="active">Active</option>
                          <option value="inactive">Inactive</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Type of Packing</label>
                        <div className="border border-gray-200 rounded-lg p-2 max-h-40 overflow-y-auto">
                          {sortDropdownObjects(packingOptions, (item) => item.name).map((item) => (
                            <label key={item.id} className="flex items-center gap-2 p-2 hover:bg-gray-50 rounded cursor-pointer">
                              <input
                                type="checkbox"
                                checked={editSelectedPackings.includes(item.name)}
                                onChange={(e) => {
                                  if (e.target.checked) {
                                    setEditSelectedPackings([...editSelectedPackings, item.name]);
                                  } else {
                                    setEditSelectedPackings(editSelectedPackings.filter(p => p !== item.name));
                                  }
                                }}
                                className="w-4 h-4 text-[#0D7C66] border-gray-300 rounded focus:ring-[#0D7C66]"
                              />
                              <span className="text-sm text-gray-700">{item.name}</span>
                            </label>
                          ))}
                        </div>
                      </div>
                    </>
                  )}
                  <div className="flex gap-3 pt-4 sticky bottom-0 bg-white">
                    <button
                      type="submit"
                      disabled={loading}
                      className="flex-1 px-6 py-2.5 bg-[#0D7C66] hover:bg-[#0a6354] text-white font-semibold rounded-lg transition-colors disabled:opacity-50"
                    >
                      {loading ? 'Saving...' : 'Save Changes'}
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowEditModal(false)}
                      className="flex-1 px-6 py-2.5 border border-gray-300 text-gray-700 font-semibold rounded-lg hover:bg-gray-50 transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        )}

        {/* Delete Confirmation Modal */}
        {showDeleteModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl p-6 max-w-sm w-full">
              <h3 className="text-lg font-semibold text-[#0D5C4D] mb-3">Confirm Delete</h3>
              <p className="text-sm text-gray-600 mb-6">
                Are you sure you want to delete this {activeTab === 'product' ? 'product' : 'category'}? This action cannot be undone.
              </p>
              <div className="flex gap-3">
                <button
                  onClick={confirmDelete}
                  className="flex-1 px-6 py-2.5 bg-red-600 hover:bg-red-700 text-white font-semibold rounded-lg transition-colors"
                >
                  Delete
                </button>
                <button
                  onClick={() => setShowDeleteModal(false)}
                  className="flex-1 px-6 py-2.5 border border-gray-300 text-gray-700 font-semibold rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Delete Multiple Product Box Modal */}
        {showDeleteMultiBoxModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl p-6 max-w-sm w-full">
              <h3 className="text-lg font-semibold text-[#0D5C4D] mb-3">Confirm Delete</h3>
              <p className="text-sm text-gray-600 mb-6">
                Are you sure you want to delete this multiple product box? This action cannot be undone.
              </p>
              <div className="flex gap-3">
                <button
                  onClick={confirmDeleteMultiBox}
                  disabled={loading}
                  className="flex-1 px-6 py-2.5 bg-red-600 hover:bg-red-700 text-white font-semibold rounded-lg transition-colors disabled:opacity-50"
                >
                  {loading ? 'Deleting...' : 'Delete'}
                </button>
                <button
                  onClick={() => {
                    setShowDeleteMultiBoxModal(false);
                    setDeletingMultiBoxId(null);
                  }}
                  className="flex-1 px-6 py-2.5 border border-gray-300 text-gray-700 font-semibold rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default AddProduct;