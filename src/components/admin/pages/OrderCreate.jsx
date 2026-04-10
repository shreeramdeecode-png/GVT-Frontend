import React, { useState, useRef, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { createPortal } from 'react-dom';
import { X, GripVertical } from 'lucide-react';
import { createOrder, createDraft, getDraftById, updateDraft, deleteDraft, getOrderById, updateOrder } from '../../../api/orderApi';
import { getAllProducts } from '../../../api/productApi';
import { getBoxesAndBags } from '../../../api/inventoryApi';
import { getAllCustomers, getCustomersByCategory } from '../../../api/customerApi';
import { getPreferencesByCustomer } from '../../../api/customerProductPreferenceApi';
import { createNotification } from '../../../api/notificationApi';
import InsufficientStockModal from '../../../components/common/InsufficientStockModal';

const NewOrder = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [formData, setFormData] = useState({
    customerName: '',
    customerId: '',
    order_id: '',
    orderReceivedDate: '',
    packingDate: '',
    packingDay: '',
    orderType: 'flight', // 'flight', 'local', or 'flower'
    detailsComment: ''
  });

  const [products, setProducts] = useState([
    {
      id: 1,
      productId: '',
      productName: '',
      numBoxes: '',
      packingType: '',
      netWeight: '',
      grossWeight: '',
      boxWeight: '',
      boxCapacity: '',
      showMoreDetails: false,
      allowedPackingTypes: [],
      error: '' // Add error field for each product
    },
  ]);

  const [allProducts, setAllProducts] = useState([]);
  const [packingOptions, setPackingOptions] = useState([]);
  const [errors, setErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [allCustomers, setAllCustomers] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState({});
  const [suggestionValue, setSuggestionValue] = useState({});
  const suggestionsRef = useRef(null);
  const [showProductSuggestions, setShowProductSuggestions] = useState({});
  const [productSuggestionValue, setProductSuggestionValue] = useState({});
  const productSuggestionsRef = useRef(null);
  const [suggestionPosition, setSuggestionPosition] = useState({});
  const inputRefs = useRef({});
  const [draftId, setDraftId] = useState(null);
  const [orderId, setOrderId] = useState(null);
  const [draggedIndex, setDraggedIndex] = useState(null);
  const prevOrderTypeRef = useRef(formData.orderType);
  const [stockModalOpen, setStockModalOpen] = useState(false);
  const [stockModalMessage, setStockModalMessage] = useState('');

  // Refs for keyboard navigation
  const inputGridRefs = useRef({});

  // Map internal orderType to API display name
  const getOrderTypeForAPI = (orderType) => {
    if (orderType === 'local') return 'LOCAL GRADE ORDER';
    if (orderType === 'flight') return 'BOX ORDER';
    if (orderType === 'flower') return 'FLOWER ORDER';
    return orderType || 'LOCAL GRADE ORDER';
  };

  // Normalize API order_type (any casing/key) to internal form value: 'local' | 'flight' | 'flower'
  const getOrderTypeFromApi = (apiOrderType) => {
    const raw = apiOrderType != null ? String(apiOrderType).trim() : '';
    if (!raw) return 'local';
    const upper = raw.toUpperCase();
    if (upper === 'LOCAL GRADE ORDER' || upper === 'LOCAL' || raw.toLowerCase() === 'local') return 'local';
    if (upper === 'BOX ORDER' || upper === 'BOX' || raw.toLowerCase() === 'flight') return 'flight';
    if (upper === 'FLOWER ORDER' || upper === 'FLOWER' || raw.toLowerCase() === 'flower') return 'flower';
    if (upper.includes('LOCAL') || upper.includes('GRADE')) return 'local';
    if (upper.includes('FLOWER')) return 'flower';
    if (upper.includes('BOX')) return 'flight';
    return 'local';
  };

  // Keep only digits and a single decimal point for numeric inputs.
  const sanitizeDecimalInput = (value) => {
    const raw = String(value ?? '');
    const digitsAndDot = raw.replace(/[^0-9.]/g, '');
    const firstDotIndex = digitsAndDot.indexOf('.');
    if (firstDotIndex === -1) return digitsAndDot;
    const beforeDot = digitsAndDot.slice(0, firstDotIndex + 1);
    const afterDot = digitsAndDot.slice(firstDotIndex + 1).replace(/\./g, '');
    return beforeDot + afterDot;
  };

  const toggleMoreDetails = (id) => {
    setProducts(prev =>
      prev.map(product =>
        product.id === id
          ? { ...product, showMoreDetails: !product.showMoreDetails }
          : product
      )
    );
  };

  // Handle arrow key navigation between inputs
  const handleKeyDown = (e, rowIndex, colIndex) => {
    const arrowKeys = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'];
    if (!arrowKeys.includes(e.key)) return;

    e.preventDefault();

    const isLocal = formData.orderType === 'local';
    let nextRow = rowIndex;
    let nextCol = colIndex;

    // Determine column count and mapping based on order type
    // For non-local: 0=Product, 1=Packing, 2=Boxes, 3=Box Weight, 4=Net Weight, 5=Gross Weight
    // For local: 0=Product, 1=Net Weight
    const columnCount = isLocal ? 2 : 6;

    switch (e.key) {
      case 'ArrowRight':
        nextCol = colIndex + 1;
        if (nextCol >= columnCount) {
          nextCol = 0;
          nextRow = Math.min(nextRow + 1, products.length - 1);
        }
        break;
      case 'ArrowLeft':
        nextCol = colIndex - 1;
        if (nextCol < 0) {
          nextCol = columnCount - 1;
          nextRow = Math.max(nextRow - 1, 0);
        }
        break;
      case 'ArrowDown':
        nextRow = Math.min(nextRow + 1, products.length - 1);
        break;
      case 'ArrowUp':
        nextRow = Math.max(nextRow - 1, 0);
        break;
    }

    // Get the next input element
    const nextInputKey = `${nextRow}-${nextCol}`;
    const nextInput = inputGridRefs.current[nextInputKey];

    if (nextInput) {
      nextInput.focus();
      // Select all text for easy editing (only for input elements, not selects)
      if (nextInput.select && nextInput.tagName === 'INPUT') {
        setTimeout(() => nextInput.select(), 0);
      }
    }
  };

  // Helper function to format number of boxes/bags for API
  const formatNumBoxesForAPI = (value, packingType) => {
    if (value === null || value === undefined || value === "") return "";

    const num = parseFloat(value);
    if (isNaN(num)) return "";

    const cleanNum = num % 1 === 0 ? parseInt(num) : num;

    if (packingType) {
      const lowerPacking = packingType.toLowerCase();

      if (lowerPacking.includes("box")) {
        return cleanNum === 1 ? `${cleanNum}box` : `${cleanNum}boxes`;
      }

      if (lowerPacking.includes("bag")) {
        return cleanNum === 1 ? `${cleanNum}bag` : `${cleanNum}bags`;
      }
    }

    return cleanNum.toString();
  };

  // Load draft or order from backend on component mount
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const draftIdFromUrl = urlParams.get('draftId');
    const orderIdFromUrl = urlParams.get('orderId');

    if (draftIdFromUrl) {
      const loadDraft = async () => {
        try {
          const response = await getDraftById(draftIdFromUrl);
          if (response.success && response.data) {
            const draft = response.data;
            setDraftId(draft.did);
            const draftOrderType = draft.order_type || 'local';
            const mappedDraftOrderType = (draftOrderType === 'LOCAL GRADE ORDER' || draftOrderType === 'BOX ORDER' || draftOrderType === 'FLOWER ORDER')
              ? (draftOrderType === 'LOCAL GRADE ORDER' ? 'local' : draftOrderType === 'BOX ORDER' ? 'flight' : 'flower')
              : draftOrderType;
            setFormData({
              customerName: draft.customer_name || '',
              customerId: draft.customer_id || '',
              order_id: '',
              orderReceivedDate: draft.order_received_date || '',
              packingDate: draft.packing_date || '',
              packingDay: draft.packing_day || '',
              orderType: mappedDraftOrderType,
              detailsComment: draft.details_comment || ''
            });

            // draft_data may be JSON string or object (API can return string)
            let draftDataParsed = draft.draft_data;
            if (typeof draftDataParsed === 'string') {
              try {
                draftDataParsed = JSON.parse(draftDataParsed);
              } catch {
                draftDataParsed = {};
              }
            }
            const draftProducts = draftDataParsed?.products || [];
            const formattedProducts = draftProducts.map((product, index) => ({
              id: index + 1,
              productId: product.productId ?? '',
              productName: product.productName ?? '',
              numBoxes: product.numBoxes ?? '',
              packingType: product.packingType ?? '',
              netWeight: product.netWeight ?? '',
              grossWeight: product.grossWeight ?? '',
              boxWeight: product.boxWeight ?? '',
              boxCapacity: '',
              showMoreDetails: false,
              allowedPackingTypes: product.allowedPackingTypes || []
            }));

            setProducts(formattedProducts.length > 0 ? formattedProducts : [{
              id: 1,
              productId: '',
              productName: '',
              numBoxes: '',
              packingType: '',
              netWeight: '',
              grossWeight: '',
              boxWeight: '',
              boxCapacity: '',
              showMoreDetails: false
            }]);
          }
        } catch (error) {
          console.error('Error loading draft:', error);
        }
      };

      loadDraft();
    } else if (orderIdFromUrl) {
      // Use order_type from navigation state (from list) so edit shows correct type immediately
      const stateOrderType = location.state?.orderType;
      if (stateOrderType != null && stateOrderType !== '') {
        setFormData(prev => ({ ...prev, orderType: getOrderTypeFromApi(stateOrderType) }));
      }
      const loadOrder = async () => {
        try {
          const response = await getOrderById(orderIdFromUrl);
          if (response.success && response.data) {
            // Backend may return single order as object or as array (same as list)
            const raw = response.data;
            const order = Array.isArray(raw) ? raw[0] : raw;
            if (!order) return;
            setOrderId(order.oid);
            const apiOrderType = order.order_type ?? order.orderType ?? stateOrderType ?? '';
            setFormData({
              customerName: order.customer_name || '',
              customerId: order.customer_id || '',
              order_id: order.oid || '',
              orderReceivedDate: order.order_received_date || '',
              packingDate: order.packing_date || '',
              packingDay: order.packing_day || '',
              orderType: getOrderTypeFromApi(apiOrderType),
              detailsComment: order.details_comment || ''
            });

            const orderItems = order.items || [];
            const formattedProducts = orderItems.map((item, index) => {
              // Extract numeric value from num_boxes (e.g., "4boxes" -> "4")
              let numBoxes = item.num_boxes || '';
              if (typeof numBoxes === 'string') {
                const match = numBoxes.match(/^(\d+(?:\.\d+)?)/);
                numBoxes = match ? match[1] : '';
              }

              return {
                id: index + 1,
                productId: item.product_id || item.product?.split(' - ')[0] || '',
                productName: item.product || `${item.product_id} - ${item.product_name}` || '',
                numBoxes: numBoxes,
                packingType: item.packing_type || '',
                netWeight: item.net_weight || '',
                grossWeight: item.gross_weight || '',
                boxWeight: item.box_weight || '',
                boxCapacity: '',
                showMoreDetails: false
              };
            });

            setProducts(formattedProducts.length > 0 ? formattedProducts : [{
              id: 1,
              productId: '',
              productName: '',
              numBoxes: '',
              packingType: '',
              netWeight: '',
              grossWeight: '',
              boxWeight: '',
              boxCapacity: '',
              showMoreDetails: false
            }]);
          }
        } catch (error) {
          console.error('Error loading order:', error);
        }
      };

      loadOrder();
    }
  }, []);

  useEffect(() => {
    const fetchData = async () => {
      try {
        // First fetch packing options
        const items = await getBoxesAndBags();
        setPackingOptions(items);

        // Then fetch products
        const response = await getAllProducts(1, 1000);
        const activeProducts = (response.data || []).filter(p => p.product_status === 'active');
        setAllProducts(activeProducts);

        // Pre-populate products with default_status true only if not loading draft/order
        const urlParams = new URLSearchParams(window.location.search);
        const draftIdFromUrl = urlParams.get('draftId');
        const orderIdFromUrl = urlParams.get('orderId');

        if (!draftIdFromUrl && !orderIdFromUrl) {
          // Don't pre-populate products - wait for customer selection
        }
      } catch (error) {
        console.error('Error fetching data:', error);
      }
    };

    fetchData();
  }, []);

  // Fetch customers by category based on orderType
  useEffect(() => {
    const fetchCustomersByCategory = async () => {
      try {
        // Map orderType to category
        const category = formData.orderType === 'local'
          ? 'LOCAL GRADE ORDER'
          : formData.orderType === 'flower'
            ? 'FLOWER ORDER'
            : 'BOX ORDER';

        // Fetch customers by category
        const customersResponse = await getCustomersByCategory(category);
        const customers = customersResponse.data || [];
        // Sort customers by customer_id in ascending order (oldest first)
        let sortedCustomers = customers.sort((a, b) => (a.customer_id || 0) - (b.customer_id || 0));

        // When editing an order/draft, ensure the current customer exists in the dropdown
        if ((orderId || draftId) && (formData.customerId || formData.customerName)) {
          const exists = sortedCustomers.some(
            c => (c.customer_id || c.cust_id)?.toString() === formData.customerId?.toString()
          );

          if (!exists) {
            sortedCustomers = [
              ...sortedCustomers,
              {
                customer_id: formData.customerId,
                customer_name: formData.customerName,
              },
            ];
          }
        }

        setAllCustomers(sortedCustomers);
      } catch (error) {
        console.error('Error fetching customers by category:', error);
        setAllCustomers([]);
      }
    };

    fetchCustomersByCategory();
  }, [formData.orderType, orderId, draftId]);

  // Reset customer selection when order type changes (only in create mode)
  useEffect(() => {
    // Only reset if orderType actually changed (not on initial mount)
    if (prevOrderTypeRef.current !== formData.orderType && !orderId && !draftId) {
      setFormData(prev => ({
        ...prev,
        customerName: '',
        customerId: ''
      }));
    }
    // Update the ref for next comparison
    prevOrderTypeRef.current = formData.orderType;
  }, [formData.orderType, orderId, draftId]);

  // Update allowedPackingTypes for existing products when allProducts is loaded
  useEffect(() => {
    if (allProducts.length > 0 && packingOptions.length > 0) {
      setProducts(prev =>
        prev.map(product => {
          if (product.productId && !product.allowedPackingTypes) {
            // Extract numeric ID from productName or use productId
            const numericId = product.productId.toString();
            const fullProduct = allProducts.find(p => p.pid.toString() === numericId);

            if (fullProduct && fullProduct.packing_type) {
              const allowedPackingTypes = fullProduct.packing_type.split(',').map(p => p.trim());

              // Determine default packing type and box weight
              let defaultPackingType = product.packingType || '';
              let defaultBoxWeight = product.boxWeight || '';

              if (allowedPackingTypes.length > 0 && !defaultPackingType) {
                // Use first packing type as default if not already set
                defaultPackingType = allowedPackingTypes[0];

                // Find the corresponding packing option to get box weight
                const selectedPacking = packingOptions.find(item => item.name === defaultPackingType);
                if (selectedPacking) {
                  defaultBoxWeight = (parseFloat(selectedPacking.weight) || 0).toFixed(2);
                }
              }

              // Use product's net_weight from product table
              const productNetWeight = (parseFloat(fullProduct.net_weight) || 0).toString();

              return {
                ...product,
                allowedPackingTypes: allowedPackingTypes,
                packingType: defaultPackingType,
                boxWeight: defaultBoxWeight,
                boxCapacity: productNetWeight
              };
            }
          }
          return product;
        })
      );
    }
  }, [allProducts, packingOptions]);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (suggestionsRef.current && !suggestionsRef.current.contains(event.target)) {
        setShowSuggestions({});
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (productSuggestionsRef.current && !productSuggestionsRef.current.contains(event.target)) {
        setShowProductSuggestions({});
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));

    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: '' }));
    }
  };

  const handleCustomerChange = async (e) => {
    const customerId = e.target.value;

    // Reset products when customer changes or is deselected
    if (!customerId) {
      setFormData(prev => ({
        ...prev,
        customerName: '',
        customerId: ''
      }));
      setProducts([{
        id: 1,
        productId: '',
        productName: '',
        numBoxes: '',
        packingType: '',
        netWeight: '',
        grossWeight: '',
        boxWeight: '',
        boxCapacity: '',
        showMoreDetails: false,
        allowedPackingTypes: []
      }]);
      return;
    }

    const customer = allCustomers.find(c => (c.customer_id || c.cust_id).toString() === customerId);

    if (customer) {
      setFormData(prev => ({
        ...prev,
        customerName: customer.customer_name,
        customerId: customer.customer_id || customer.cust_id
      }));

      try {
        const customerId = customer.customer_id || customer.cust_id;
        const preferences = await getPreferencesByCustomer(customerId);
        if (preferences.success && preferences.data && preferences.data.length > 0) {
          const preferredProducts = preferences.data.map((pref, index) => {
            const product = allProducts.find(p => p.pid === pref.product_id);
            if (!product) return null;

            const allowedPackingTypes = product.packing_type
              ? product.packing_type.split(',').map(p => p.trim())
              : [];

            let defaultPackingType = '';
            let defaultBoxWeight = '';
            let defaultBoxCapacity = '';

            if (allowedPackingTypes.length > 0) {
              defaultPackingType = allowedPackingTypes[0];
              const selectedPacking = packingOptions.find(item => item.name === defaultPackingType);
              if (selectedPacking) {
                defaultBoxWeight = (parseFloat(selectedPacking.weight) || 0).toFixed(2);
              }
              defaultBoxCapacity = (parseFloat(product.net_weight) || 0).toString();
            }

            return {
              id: index + 1,
              productId: product.pid.toString(),
              productName: product.product_name,
              numBoxes: '',
              packingType: defaultPackingType,
              netWeight: '',
              grossWeight: '',
              boxWeight: defaultBoxWeight,
              boxCapacity: defaultBoxCapacity,
              showMoreDetails: false,
              allowedPackingTypes: allowedPackingTypes
            };
          }).filter(p => p !== null);

          if (preferredProducts.length > 0) {
            setProducts(preferredProducts);
          } else {
            setProducts([{
              id: 1,
              productId: '',
              productName: '',
              numBoxes: '',
              packingType: '',
              netWeight: '',
              grossWeight: '',
              boxWeight: '',
              boxCapacity: '',
              showMoreDetails: false,
              allowedPackingTypes: []
            }]);
          }
        } else {
          setProducts([{
            id: 1,
            productId: '',
            productName: '',
            numBoxes: '',
            packingType: '',
            netWeight: '',
            grossWeight: '',
            boxWeight: '',
            boxCapacity: '',
            showMoreDetails: false,
            allowedPackingTypes: []
          }]);
        }
      } catch (error) {
        console.error('Error fetching customer preferences:', error);
        setProducts([{
          id: 1,
          productId: '',
          productName: '',
          numBoxes: '',
          packingType: '',
          netWeight: '',
          grossWeight: '',
          boxWeight: '',
          boxCapacity: '',
          showMoreDetails: false,
          allowedPackingTypes: []
        }]);
      }
    }
  };

  // Extract box capacity from packing type name (e.g., "5kg Box" -> 5)
  const getBoxCapacity = (packingType) => {
    if (!packingType) return 0;
    const match = packingType.match(/(\d+(?:\.\d+)?)\s*kg/i);
    return match ? parseFloat(match[1]) : 0;
  };

  const handleProductChange = (id, field, value) => {
    setProducts((prev) =>
      prev.map((product) => {
        if (product.id === id) {
          const updatedProduct = { ...product, [field]: value };

          // When product ID changes, populate product name
          if (field === 'productId') {
            const selectedProduct = allProducts.find(p => p.pid === parseInt(value));
            if (selectedProduct) {
              updatedProduct.productName = `${selectedProduct.pid} - ${selectedProduct.product_name}`;
            } else {
              updatedProduct.productName = '';
            }
          }

          // Handle product name suggestions
          if (field === 'productName') {
            const matchingProduct = allProducts.find(p =>
              p.product_name.toLowerCase() === value.toLowerCase()
            );

            if (matchingProduct) {
              updatedProduct.productId = matchingProduct.pid.toString();
              updatedProduct.productName = matchingProduct.product_name;
              updatedProduct.error = '';
            } else {
              updatedProduct.productId = '';
              if (value.trim() !== '') {
                updatedProduct.error = 'Please select a product from the dropdown list';
              } else {
                updatedProduct.error = '';
              }
            }

            if (value.length > 0) {
              const inputEl = inputRefs.current[id];
              if (inputEl) {
                const rect = inputEl.getBoundingClientRect();
                setSuggestionPosition(prev => ({
                  ...prev,
                  [id]: {
                    top: rect.bottom + window.scrollY,
                    left: rect.left + window.scrollX,
                    width: rect.width
                  }
                }));
              }
              setShowProductSuggestions(prev => ({ ...prev, [id]: true }));
              setProductSuggestionValue(prev => ({ ...prev, [id]: value }));
            } else {
              setShowProductSuggestions(prev => ({ ...prev, [id]: false }));
            }
          }

          // When packing type changes, get actual box weight from inventory and calculate net weight
          if (field === 'packingType') {
            const selectedPacking = packingOptions.find(item => item.name === value);

            if (selectedPacking) {
              const actualBoxWeight = parseFloat(selectedPacking.weight) || 0;

              // Get product's net_weight from product table
              const selectedProduct = allProducts.find(p => p.pid === parseInt(updatedProduct.productId));
              const productNetWeight = selectedProduct?.net_weight ? parseFloat(selectedProduct.net_weight) : 0;

              updatedProduct.boxWeight = actualBoxWeight.toFixed(2);
              updatedProduct.boxCapacity = productNetWeight.toString();

              const numBoxes = parseFloat(updatedProduct.numBoxes) || 0;

              // Calculate net weight from number of boxes if available
              if (productNetWeight > 0 && numBoxes > 0) {
                const calculatedNetWeight = numBoxes * productNetWeight;
                updatedProduct.netWeight = calculatedNetWeight.toFixed(2);
                updatedProduct.grossWeight = (calculatedNetWeight + (numBoxes * actualBoxWeight)).toFixed(2);
              }
            }

            // For Local Grade orders, when "Others" is selected, show all products
            if (formData.orderType === 'local' && value === 'Others') {
              const inputEl = inputRefs.current[id];
              if (inputEl) {
                const rect = inputEl.getBoundingClientRect();
                setSuggestionPosition(prev => ({
                  ...prev,
                  [id]: {
                    top: rect.bottom + window.scrollY,
                    left: rect.left + window.scrollX,
                    width: rect.width
                  }
                }));
              }
              setShowProductSuggestions(prev => ({ ...prev, [id]: true }));
              setProductSuggestionValue(prev => ({ ...prev, [id]: '' }));
            }
          }

          // When net weight changes, calculate numBoxes based on box capacity
          if (field === 'netWeight') {
            const netWeight = parseFloat(updatedProduct.netWeight) || 0;
            const boxWeight = parseFloat(updatedProduct.boxWeight) || 0;
            const boxCapacity = parseFloat(updatedProduct.boxCapacity) || 0;

            if (boxCapacity > 0 && netWeight > 0) {
              const numBoxes = netWeight / boxCapacity;
              updatedProduct.numBoxes = numBoxes.toFixed(2);
              updatedProduct.grossWeight = (netWeight + (numBoxes * boxWeight)).toFixed(2);
            }
          }

          // When number of boxes changes, recalculate net weight based on box capacity
          if (field === 'numBoxes') {
            updatedProduct.numBoxes = value;
            const numBoxes = parseFloat(value) || 0;
            const boxWeight = parseFloat(updatedProduct.boxWeight) || 0;
            const boxCapacity = parseFloat(updatedProduct.boxCapacity) || 0;

            // Calculate net weight from number of boxes and box capacity
            if (numBoxes > 0 && boxCapacity > 0) {
              const calculatedNetWeight = numBoxes * boxCapacity;
              updatedProduct.netWeight = calculatedNetWeight.toFixed(2);
              updatedProduct.grossWeight = (calculatedNetWeight + (numBoxes * boxWeight)).toFixed(2);
            } else if (numBoxes > 0 && boxWeight > 0) {
              // If no box capacity, just update gross weight
              const netWeight = parseFloat(updatedProduct.netWeight) || 0;
              updatedProduct.grossWeight = (netWeight + (numBoxes * boxWeight)).toFixed(2);
            }
          }

          // When gross weight changes, recalculate net weight
          if (field === 'grossWeight') {
            const grossWeight = parseFloat(updatedProduct.grossWeight) || 0;
            const boxWeight = parseFloat(updatedProduct.boxWeight) || 0;
            const numBoxes = parseFloat(updatedProduct.numBoxes) || 0;

            // Total Box Weight = Number of Boxes * Box Weight
            const totalBoxWeight = numBoxes * boxWeight;

            // Net Weight = Gross Weight - Total Box Weight
            const netWeight = (grossWeight - totalBoxWeight);
            updatedProduct.netWeight = netWeight.toFixed(2);
          }



          return updatedProduct;
        }
        return product;
      })
    );
  };

  const selectSuggestion = (id, value) => {
    handleProductChange(id, 'packingType', value);
    setShowSuggestions(prev => ({ ...prev, [id]: false }));
  };

  const selectProductSuggestion = (id, product) => {
    // Check if product is already selected in other rows
    const isDuplicate = products.some(p => p.id !== id && p.productId === product.pid.toString());
    
    if (isDuplicate) {
      const confirmAdd = window.confirm(
        `"${product.product_name}" is already added to this order.\n\nDo you want to add it again?`
      );
      
      if (!confirmAdd) {
        setShowProductSuggestions(prev => ({ ...prev, [id]: false }));
        return;
      }
    }

    // Parse the product's packing_type field to get allowed packing types
    const allowedPackingTypes = product.packing_type
      ? product.packing_type.split(',').map(p => p.trim())
      : [];

    // Determine default packing type and box weight
    let defaultPackingType = '';
    let defaultBoxWeight = '';

    if (allowedPackingTypes.length > 0) {
      // Use first packing type as default (for both single and multiple)
      defaultPackingType = allowedPackingTypes[0];

      // Find the corresponding packing option to get box weight
      const selectedPacking = packingOptions.find(item => item.name === defaultPackingType);
      if (selectedPacking) {
        defaultBoxWeight = parseFloat(selectedPacking.weight) || 0;
      }
    }

    setProducts(prev =>
      prev.map(p => {
        if (p.id === id) {
          const updatedProduct = {
            ...p,
            productId: product.pid.toString(),
            productName: product.product_name,
            allowedPackingTypes: allowedPackingTypes,
            packingType: defaultPackingType,
            boxWeight: defaultBoxWeight ? defaultBoxWeight.toFixed(2) : '',
            error: ''
          };

          // If we have a default packing type, calculate box capacity and weights
          if (defaultPackingType) {
            // Use product's net_weight from product table
            const productNetWeight = parseFloat(product.net_weight) || 0;
            updatedProduct.boxCapacity = productNetWeight.toString();

            // If we have numBoxes, calculate net and gross weight
            const numBoxes = parseFloat(updatedProduct.numBoxes) || 0;
            if (productNetWeight > 0 && numBoxes > 0) {
              const calculatedNetWeight = numBoxes * productNetWeight;
              updatedProduct.netWeight = calculatedNetWeight.toFixed(2);
              updatedProduct.grossWeight = (calculatedNetWeight + (numBoxes * defaultBoxWeight)).toFixed(2);
            }
          }

          return updatedProduct;
        }
        return p;
      })
    );
    setShowProductSuggestions(prev => ({ ...prev, [id]: false }));
  };

  const addProduct = () => {
    const newProduct = {
      id: products.length + 1,
      productId: '',
      productName: '',
      numBoxes: '',
      packingType: '',
      netWeight: '',
      grossWeight: '',
      boxWeight: '',
      boxCapacity: '',
      showMoreDetails: false
    };
    setProducts([...products, newProduct]);
  };

  const removeProduct = (id) => {
    if (products.length > 1) {
      setProducts(products.filter((product) => product.id !== id));
    }
  };

  const handleDragStart = (index) => {
    setDraggedIndex(index);
  };

  const handleDragOver = (e, index) => {
    e.preventDefault();
    if (draggedIndex === null || draggedIndex === index) return;

    const newProducts = [...products];
    const draggedItem = newProducts[draggedIndex];
    newProducts.splice(draggedIndex, 1);
    newProducts.splice(index, 0, draggedItem);

    setProducts(newProducts);
    setDraggedIndex(index);
  };

  const handleDragEnd = () => {
    setDraggedIndex(null);
  };

  const validateForm = () => {
    const newErrors = {};

    if (!formData.customerName.trim()) {
      newErrors.customerName = 'Customer name is required';
    }

    const productsWithErrors = products.filter(product => product.error);
    if (productsWithErrors.length > 0) {
      alert('Please select valid products from the dropdown list. Invalid product names are not allowed.');
      return false;
    }

    const invalidProducts = products.filter(product => {
      return (
        !product.productId ||
        !product.productName ||
        product.netWeight === '' || product.netWeight === null || product.netWeight === undefined
      );
    });

    if (invalidProducts.length > 0) {
      newErrors.products = 'Please select products from the dropdown. Type the product name and click on a suggestion.';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Draft payload matches backend: customerName, customerId, orderReceivedDate, packingDate, packingDay, orderType, detailsComment, products
  const saveDraft = async () => {
    try {
      const draftData = {
        customerName: formData.customerName || '',
        customerId: formData.customerId !== undefined && formData.customerId !== null ? formData.customerId : null,
        orderReceivedDate: formData.orderReceivedDate || null,
        packingDate: formData.packingDate || null,
        packingDay: formData.packingDay || null,
        orderType: getOrderTypeForAPI(formData.orderType) || null,
        detailsComment: formData.detailsComment || null,
        products: products.map(product => {
          let numBoxesValue = product.numBoxes;

          if (typeof numBoxesValue === 'string') {
            const match = numBoxesValue.match(/^(\d+(?:\.\d+)?)/);
            numBoxesValue = match ? match[1] : '0';
          }

          const numBoxesNumeric = parseFloat(numBoxesValue) || 0;

          return {
            productId: product.productId ? parseInt(product.productId) : null,
            productName: product.productName || '',
            netWeight: product.netWeight != null && product.netWeight !== '' ? String(product.netWeight) : null,
            numBoxes: product.numBoxes ? formatNumBoxesForAPI(numBoxesNumeric, product.packingType) : null,
            packingType: product.packingType || null,
            grossWeight: product.grossWeight != null && product.grossWeight !== '' ? String(product.grossWeight) : null,
            boxWeight: product.boxWeight != null && product.boxWeight !== '' ? String(product.boxWeight) : null
          };
        })
      };

      let response;
      if (draftId) {
        response = await updateDraft(draftId, draftData);
      } else {
        response = await createDraft(draftData);
      }

      if (response.success) {
        setDraftId(response.data.did);

        const userChoice = window.confirm(
          "Draft saved successfully!"
        );

        if (userChoice) {
          navigate('/orders?tab=drafts');
        }
      } else {
        alert("Failed to save draft: " + response.message);
      }
    } catch (error) {
      console.error("Error saving draft:", error);
      alert("Failed to save draft. Please try again.");
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    setIsSubmitting(true);

    try {
      // Calculate totals to send in order payload
      const totalNetWeight = products
        .reduce((sum, p) => sum + (parseFloat(p.netWeight) || 0), 0)
        .toFixed(2);

      const totalNumBoxes = products
        .reduce((sum, p) => sum + (parseFloat(p.numBoxes) || 0), 0)
        .toFixed(2);

      const totalGrossWeight = products
        .reduce((sum, p) => sum + (parseFloat(p.grossWeight) || 0), 0)
        .toFixed(2);

      const isBoxOrFlowerOrder = formData.orderType === 'flight' || formData.orderType === 'flower';

      const orderData = {
        customerName: formData.customerName,
        customerId: formData.customerId || undefined,
        orderReceivedDate: formData.orderReceivedDate || undefined,
        packingDate: formData.packingDate || undefined,
        packingDay: formData.packingDay || undefined,
        orderType: getOrderTypeForAPI(formData.orderType),
        detailsComment: formData.detailsComment || undefined,
        // Totals for entire order (used by backend orders table)
        totalNetWeight,
        totalNumBoxes: isBoxOrFlowerOrder ? totalNumBoxes : undefined,
        totalGrossWeight: isBoxOrFlowerOrder ? totalGrossWeight : undefined,
        products: products.map(product => {
          let numBoxesValue = product.numBoxes;

          if (typeof numBoxesValue === 'string') {
            const match = numBoxesValue.match(/^(\d+(?:\.\d+)?)/);
            numBoxesValue = match ? match[1] : '0';
          }

          const numBoxesNumeric = parseFloat(numBoxesValue) || 0;

          return {
            productId: parseInt(product.productId),
            netWeight: product.netWeight.toString(),
            numBoxes: product.numBoxes ? formatNumBoxesForAPI(numBoxesNumeric, product.packingType) : undefined,
            packingType: product.packingType || undefined,
            grossWeight: product.grossWeight ? product.grossWeight.toString() : undefined,
            boxWeight: product.boxWeight ? product.boxWeight.toString() : undefined
          };
        })
      };

      let response;
      if (orderId) {
        response = await updateOrder(orderId, orderData);
      } else {
        response = await createOrder(orderData);
      }

      if (response.success) {
        if (draftId) {
          try {
            await deleteDraft(draftId);
          } catch (error) {
            console.error("Error deleting draft:", error);
          }
        }

        // Create notification for new order (only when creating, not updating)
        if (!orderId && response.data) {
          try {
            const orderIdFromResponse = response.data.oid || response.data.order_id || response.data.id;
            await createNotification({
              title: `New order ${orderIdFromResponse ? `#${orderIdFromResponse}` : ''} created`,
              message: `Customer: ${formData.customerName || 'N/A'}`,
              type: 'info',
              category: 'Orders',
              isRead: false  // Explicitly set as unread
            });

            // Refresh notifications in Navbar after a short delay to ensure backend has processed it
            setTimeout(() => {
              window.dispatchEvent(new CustomEvent('refreshNotifications'));
            }, 1000);
          } catch (notifyErr) {
            console.error('Failed to create order notification:', notifyErr);
          }
        }

        setFormData({
          customerName: "",
          customerId: "",
          order_id: "",
          orderReceivedDate: "",
          packingDate: "",
          packingDay: "",
          orderType: "local",
          detailsComment: ""
        });

        setProducts([
          {
            id: 1,
            productId: "",
            productName: "",
            numBoxes: "",
            packingType: "",
            netWeight: "",
            grossWeight: "",
            boxWeight: "",
            boxCapacity: "",
            showMoreDetails: false
          },
        ]);

        setDraftId(null);
        setOrderId(null);

        const userChoice = window.confirm(
          orderId
            ? "Order updated successfully!\n\nGo to Orders page?"
            : "Order created successfully!\n\nGo to Orders page?"
        );

        if (userChoice) {
          navigate("/orders");
        }
      } else {
        // Check if the error is related to insufficient inventory
        const detailedError = response.error || '';
        const generalMessage = response.message || '';
        const combinedError = detailedError + ' ' + generalMessage;

        const isStockError = combinedError.toLowerCase().includes('insufficient') &&
          combinedError.toLowerCase().includes('inventory');

        if (isStockError) {
          setStockModalMessage(detailedError || generalMessage);
          setStockModalOpen(true);
        } else {
          // Show regular alert for other errors
          alert(
            (orderId ? "Failed to update order: " : "Failed to create order: ") +
            (response.error || response.message || 'Unknown error')
          );
        }
      }
    } catch (error) {
      console.error("Error saving order:", error);

      // Extract error message from API response if available
      let errorMessage = error.message || String(error);

      if (error.response && error.response.data) {
        // The detailed error is often in error.response.data.error based on the screenshot
        // Or in error.response.data.message
        const serverError = error.response.data.error || error.response.data.message;
        if (serverError) {
          errorMessage = serverError;
        }
      }

      // Check if the error is related to insufficient inventory
      const isStockError = errorMessage.toLowerCase().includes('insufficient') &&
        errorMessage.toLowerCase().includes('inventory');

      if (isStockError) {
        setStockModalMessage(errorMessage);
        setStockModalOpen(true);
      } else {
        // Show regular alert for other errors
        alert(
          (orderId ? "Error updating order: " : "Error creating order: ") +
          errorMessage
        );
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancel = () => {
    if (window.confirm('Are you sure you want to cancel? All unsaved changes will be lost.')) {
      navigate('/orders');
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-6 lg:p-8">
      <div className="max-w-7xl mx-auto">
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Customer Information */}
          <div className="bg-white rounded-xl shadow-sm p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-6">
              {orderId ? 'Edit Order' : 'Customer Information'}
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Customer Name <span className="text-red-500">*</span>
                </label>
                <select
                  name="customerId"
                  value={formData.customerId}
                  onChange={handleCustomerChange}
                  className={`w-full px-4 py-2.5 border rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0D7C66] focus:border-transparent ${errors.customerName ? 'border-red-500' : 'border-gray-300'
                    }`}
                  required
                >
                  <option value="">Select a customer</option>
                  {allCustomers.map(customer => (
                    <option key={customer.customer_id || customer.cust_id} value={customer.customer_id || customer.cust_id}>
                      {customer.customer_name}
                    </option>
                  ))}
                </select>
                {errors.customerName && (
                  <p className="mt-1 text-sm text-red-500">{errors.customerName}</p>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Order Received Date
                </label>
                <input
                  type="date"
                  name="orderReceivedDate"
                  value={formData.orderReceivedDate}
                  onChange={handleInputChange}
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0D7C66] focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Packing Date
                </label>
                <input
                  type="date"
                  name="packingDate"
                  value={formData.packingDate}
                  onChange={(e) => {
                    handleInputChange(e);
                    // Auto-calculate day of week
                    if (e.target.value) {
                      const date = new Date(e.target.value);
                      const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
                      const dayName = days[date.getDay()];
                      setFormData(prev => ({ ...prev, packingDay: dayName }));
                    }
                  }}
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0D7C66] focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Day
                </label>
                <input
                  type="text"
                  name="packingDay"
                  value={formData.packingDay}
                  readOnly
                  placeholder="Auto-filled from packing date"
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg bg-gray-50 cursor-not-allowed"
                />
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-3">
                  Order Type
                </label>
                <div className="flex gap-6">
                  <label className="flex items-center cursor-pointer">
                    <input
                      type="radio"
                      name="orderType"
                      value="flight"
                      checked={formData.orderType === 'flight'}
                      onChange={handleInputChange}
                      className="w-4 h-4 text-[#0D7C66] border-gray-300 focus:ring-[#0D7C66]"
                    />
                    <span className="ml-2 text-sm text-gray-700">BOX ORDER</span>
                  </label>
                  <label className="flex items-center cursor-pointer">
                    <input
                      type="radio"
                      name="orderType"
                      value="local"
                      checked={formData.orderType === 'local'}
                      onChange={handleInputChange}
                      className="w-4 h-4 text-[#0D7C66] border-gray-300 focus:ring-[#0D7C66]"
                    />
                    <span className="ml-2 text-sm text-gray-700">LOCAL GRADE ORDER</span>
                  </label>
                  <label className="flex items-center cursor-pointer">
                    <input
                      type="radio"
                      name="orderType"
                      value="flower"
                      checked={formData.orderType === 'flower'}
                      onChange={handleInputChange}
                      className="w-4 h-4 text-[#0D7C66] border-gray-300 focus:ring-[#0D7C66]"
                    />
                    <span className="ml-2 text-sm text-gray-700">FLOWER ORDER</span>
                  </label>
                </div>
              </div>
            </div>
          </div>

          {/* Details/Comment */}
          <div className="bg-white rounded-xl shadow-sm p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-6">
              Details/Comment
            </h2>
            <div className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Additional Details or Comments
                </label>
                <textarea
                  name="detailsComment"
                  value={formData.detailsComment}
                  onChange={handleInputChange}
                  placeholder="Enter any additional details or comments (optional)"
                  rows="3"
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0D7C66] focus:border-transparent resize-none"
                />
              </div>
            </div>
          </div>

          {/* Products */}
          <div className="bg-white rounded-xl shadow-sm p-6">
            <h2 className="text-lg font-semibold text-gray-900">
              Products
            </h2>
            {errors.products && (
              <p className="mt-2 text-sm text-red-500">{errors.products}</p>
            )}

            {/* Totals Summary */}
            <div className="mt-4 mb-6 grid grid-cols-1 sm:grid-cols-3 gap-4">
              {/* Total Net Weight - Always visible */}
              <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-lg p-4 border border-blue-200">
                <p className="text-xs font-semibold text-gray-600 uppercase mb-1">Total Net Weight</p>
                <p className="text-2xl font-bold text-blue-700">
                  {products.reduce((sum, p) => sum + (parseFloat(p.netWeight) || 0), 0).toFixed(2)} kg
                </p>
              </div>

              {/* Total No. of Boxes - Show for flight and flower orders */}
              {(formData.orderType === 'flight' || formData.orderType === 'flower') && (
                <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-lg p-4 border border-green-200">
                  <p className="text-xs font-semibold text-gray-600 uppercase mb-1">Total No. of Boxes</p>
                  <p className="text-2xl font-bold text-green-700">
                    {products.reduce((sum, p) => sum + (parseFloat(p.numBoxes) || 0), 0).toFixed(2)}
                  </p>
                </div>
              )}

              {/* Total Gross Weight - Show for flight and flower orders */}
              {(formData.orderType === 'flight' || formData.orderType === 'flower') && (
                <div className="bg-gradient-to-br from-purple-50 to-purple-100 rounded-lg p-4 border border-purple-200">
                  <p className="text-xs font-semibold text-gray-600 uppercase mb-1">Total Gross Weight</p>
                  <p className="text-2xl font-bold text-purple-700">
                    {products.reduce((sum, p) => sum + (parseFloat(p.grossWeight) || 0), 0).toFixed(2)} kg
                  </p>
                </div>
              )}
            </div>
            <div className="overflow-x-auto overflow-y-visible">
              <table className="w-full min-w-[1000px]">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                      Product
                    </th>
                    {formData.orderType !== 'local' && (
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                        Type of Packing
                      </th>
                    )}
                    {formData.orderType !== 'local' && (
                      <>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                          No of Boxes/Bags
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                          Box Weight (kg)
                        </th>
                      </>
                    )}
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                      Net Weight (kg)
                    </th>
                    {formData.orderType !== 'local' && (
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                        Gross Weight (kg)
                      </th>
                    )}
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                      Action
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {products.map((product, index) => (
                    <React.Fragment key={product.id}>
                      <tr
                        className={`border-b border-gray-100 ${draggedIndex === index ? 'opacity-50' : ''}`}
                        draggable
                        onDragStart={() => handleDragStart(index)}
                        onDragOver={(e) => handleDragOver(e, index)}
                        onDragEnd={handleDragEnd}
                      >
                        <td className="px-2 py-3">
                          <div className="flex items-center gap-2">
                            <GripVertical className="w-5 h-5 text-gray-400 cursor-move" />
                            <input
                              ref={(el) => {
                                if (el) {
                                  inputRefs.current[product.id] = el;
                                  inputGridRefs.current[`${index}-0`] = el;
                                }
                              }}
                              type="text"
                              value={product.productName}
                              onChange={(e) => handleProductChange(product.id, 'productName', e.target.value)}
                              onKeyDown={(e) => handleKeyDown(e, index, 0)}
                              placeholder="Type product name"
                              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0D7C66] focus:border-transparent"
                            />
                          </div>
                          {product.error && (
                            <p className="mt-1 text-xs text-red-500">{product.error}</p>
                          )}
                          {showProductSuggestions[product.id] && allProducts.length > 0 && suggestionPosition[product.id] && createPortal(
                            <div
                              ref={productSuggestionsRef}
                              style={{
                                position: 'absolute',
                                top: `${suggestionPosition[product.id].top}px`,
                                left: `${suggestionPosition[product.id].left}px`,
                                width: `${suggestionPosition[product.id].width}px`,
                                minWidth: '250px',
                                zIndex: 9999
                              }}
                              className="mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-40 overflow-y-auto"
                            >
                              {allProducts
                                .filter(prod => {
                                  const searchValue = (productSuggestionValue[product.id] || '').toLowerCase();
                                  const productName = (prod.product_name || '').toLowerCase();
                                  return productName.includes(searchValue);
                                })
                                .map((prod) => (
                                  <button
                                    key={prod.pid}
                                    type="button"
                                    className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 whitespace-nowrap"
                                    onClick={() => selectProductSuggestion(product.id, prod)}
                                  >
                                    {prod.product_name}
                                  </button>
                                ))}
                            </div>,
                            document.body
                          )}
                        </td>
                        {formData.orderType !== 'local' && (
                          <td className="px-4 py-3">
                            <select
                              ref={(el) => {
                                if (el) inputGridRefs.current[`${index}-1`] = el;
                              }}
                              value={product.packingType}
                              onChange={(e) => handleProductChange(product.id, 'packingType', e.target.value)}
                              onKeyDown={(e) => handleKeyDown(e, index, 1)}
                              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0D7C66] focus:border-transparent"
                            >
                              <option value="">Select packing</option>
                              {/* Filter packing options based on product's allowed types */}
                              {packingOptions
                                .filter(item =>
                                  !product.allowedPackingTypes ||
                                  product.allowedPackingTypes.length === 0 ||
                                  product.allowedPackingTypes.includes(item.name)
                                )
                                .map((item) => (
                                  <option key={item.id} value={item.name}>
                                    {item.name}
                                  </option>
                                ))}
                            </select>
                          </td>
                        )}
                        {formData.orderType !== 'local' && (
                          <>
                            <td className="px-4 py-3">
                              <input
                                ref={(el) => {
                                  if (el) inputGridRefs.current[`${index}-2`] = el;
                                }}
                                type="text"
                                value={product.numBoxes}
                                onChange={(e) => handleProductChange(product.id, 'numBoxes', e.target.value)}
                                onKeyDown={(e) => handleKeyDown(e, index, 2)}
                                placeholder="0"
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0D7C66] focus:border-transparent"
                              />
                            </td>
                            <td className="px-4 py-3">
                              <input
                                ref={(el) => {
                                  if (el) inputGridRefs.current[`${index}-3`] = el;
                                }}
                                type="text"
                                value={product.boxWeight}
                                onChange={(e) =>
                                  handleProductChange(product.id, 'boxWeight', e.target.value)
                                }
                                onKeyDown={(e) => handleKeyDown(e, index, 3)}
                                placeholder="0.00"
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0D7C66] focus:border-transparent"
                              />
                            </td>
                          </>
                        )}
                        <td className="px-4 py-3">
                          <input
                            ref={(el) => {
                              if (el) {
                                const colIndex = formData.orderType === 'local' ? 1 : 4;
                                inputGridRefs.current[`${index}-${colIndex}`] = el;
                              }
                            }}
                            type="text"
                            value={product.netWeight}
                            onChange={(e) =>
                              handleProductChange(
                                product.id,
                                'netWeight',
                                formData.orderType === 'local'
                                  ? sanitizeDecimalInput(e.target.value)
                                  : e.target.value
                              )
                            }
                            onKeyDown={(e) => {
                              const colIndex = formData.orderType === 'local' ? 1 : 4;
                              handleKeyDown(e, index, colIndex);
                            }}
                            placeholder="0.00"
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0D7C66] focus:border-transparent"
                          />
                        </td>
                        {formData.orderType !== 'local' && (
                          <td className="px-4 py-3">
                            <input
                              ref={(el) => {
                                if (el) inputGridRefs.current[`${index}-5`] = el;
                              }}
                              type="text"
                              value={product.grossWeight}
                              onChange={(e) =>
                                handleProductChange(product.id, 'grossWeight', e.target.value)
                              }
                              onKeyDown={(e) => handleKeyDown(e, index, 5)}
                              placeholder="0.00"
                              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0D7C66] focus:border-transparent"
                            />
                          </td>
                        )}
                        <td className="px-4 py-3">
                          <button
                            type="button"
                            onClick={() => removeProduct(product.id)}
                            className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors duration-150"
                            disabled={products.length === 1}
                          >
                            <X className="w-5 h-5" />
                          </button>
                        </td>
                      </tr>
                    </React.Fragment>
                  ))}
                </tbody>
              </table>

            </div>
            <button
              type="button"
              onClick={addProduct}
              className="mt-4 px-6 py-2.5 border-2 border-[#0D7C66] text-[#0D7C66] rounded-lg hover:bg-[#0D7C66] hover:text-white transition-colors duration-200 font-medium"
            >
              + Add Product
            </button>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row justify-end gap-4">
            <button
              type="button"
              onClick={saveDraft}
              className="px-8 py-2.5 bg-gray-500 text-white rounded-lg hover:bg-gray-600 transition-colors duration-200 font-medium"
              disabled={isSubmitting}
            >
              Save Draft
            </button>
            <button
              type="button"
              onClick={handleCancel}
              className="px-8 py-2.5 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors duration-200 font-medium"
              disabled={isSubmitting}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-8 py-2.5 bg-[#0D7C66] text-white rounded-lg hover:bg-[#0a6252] transition-colors duration-200 font-medium disabled:opacity-50"
              disabled={isSubmitting}
            >
              {isSubmitting ? (orderId ? 'Updating...' : 'Creating...') : (orderId ? 'Update Order' : 'Create Order')}
            </button>
          </div>
        </form>
      </div>

      {/* Insufficient Stock Modal */}
      <InsufficientStockModal
        isOpen={stockModalOpen}
        onClose={() => setStockModalOpen(false)}
        onNavigateToInventory={() => navigate('/stock')}
        message={stockModalMessage}
      />
    </div>
  );
};

export default NewOrder;