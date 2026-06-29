import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation, useParams } from 'react-router-dom';
import { createPortal } from 'react-dom';
import { ChevronDown, Edit2, X, MapPin, Check, Package, Truck, User } from 'lucide-react';
import { getAssignmentOptions, updateStage1Assignment, getOrderAssignment } from '../../../api/orderAssignmentApi';
import { getOrderById } from '../../../api/orderApi';
import { getAllFarmers } from '../../../api/farmerApi';
import { getAllSuppliers } from '../../../api/supplierApi';
import { getAllThirdParties } from '../../../api/thirdPartyApi';
import { getAllLabours } from '../../../api/labourApi';
import { getPresentLaboursToday } from '../../../api/labourAttendanceApi';
import { getPresentDriversToday } from '../../../api/driverApi';
import { getAllProducts } from '../../../api/productApi';
import { getAllProductCounts } from '../../../api/productCountApi';
import { getAvailableStock } from '../../../api/orderAssignmentApi';
import { getVegetableAvailabilityByFarmer } from '../../../api/vegetableAvailabilityApi';
import { sortDropdownObjects } from '../../../utils/dropdownSort';
import {
  filterFarmersByProductAvailability,
  filterActiveAvailabilityItems,
  getFarmerId,
} from './FlowerOrderAssignStage1';
import { getLocalOrder, saveLocalOrder } from '../../../api/localOrderApi';

const LocalOrderAssign = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { id } = useParams();
  const orderData = location.state?.orderData;
  const localOrderDataFromState = location.state?.localOrderData;
  const [assignmentOptions, setAssignmentOptions] = useState({
    farmers: [],
    suppliers: [],
    thirdParties: [],
    labours: [],
    drivers: []
  });
  const [productRows, setProductRows] = useState([]);
  const [remainingRowAssignments, setRemainingRowAssignments] = useState({});
  const [deliveryRoutes, setDeliveryRoutes] = useState([]);
  const [orderDetails, setOrderDetails] = useState(orderData || null);
  const [assignmentStatuses, setAssignmentStatuses] = useState({});
  const [availableStock, setAvailableStock] = useState({});
  const [farmerAvailability, setFarmerAvailability] = useState({});
  const [farmerAvailabilityLoaded, setFarmerAvailabilityLoaded] = useState(false);
  const [isBoxBasedOrder, setIsBoxBasedOrder] = useState(false); // Track if order was created with boxes
  const [labourDropdownOpen, setLabourDropdownOpen] = useState({});
  const [labourDropdownPosition, setLabourDropdownPosition] = useState({});
  const labourButtonRefs = useRef({});
  const labourDropdownRef = useRef(null);

  // Keyboard navigation for main product table (Local Order Assign)
  // Column mapping: 0=Entity Type, 1=Name, 2=Place, 3=Picked Qty/Boxes
  const inputGridRefs = useRef({});

  const handleKeyDown = (e, rowIndex, colIndex, totalRows) => {
    const arrowKeys = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'];
    if (!arrowKeys.includes(e.key)) return;

    e.preventDefault();

    const columnCount = 4;
    let nextRow = rowIndex;
    let nextCol = colIndex;

    switch (e.key) {
      case 'ArrowRight':
        nextCol = colIndex + 1;
        if (nextCol >= columnCount) {
          nextCol = 0;
          nextRow = Math.min(nextRow + 1, totalRows - 1);
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
        nextRow = Math.min(nextRow + 1, totalRows - 1);
        break;
      case 'ArrowUp':
        nextRow = Math.max(nextRow - 1, 0);
        break;
      default:
        break;
    }

    const nextKey = `${nextRow}-${nextCol}`;
    const nextInput = inputGridRefs.current[nextKey];
    if (nextInput) {
      nextInput.focus();
      if (nextInput.tagName === 'INPUT' && nextInput.select) {
        setTimeout(() => nextInput.select(), 0);
      }
    }
  };

  // Update product count for a main row (used when Product Count toggle is ON)
  const handleProductCountChange = (rowIndex, value) => {
    setProductRows(prev => {
      const updated = [...prev];
      if (!updated[rowIndex]) return prev;
      updated[rowIndex] = { ...updated[rowIndex], productCount: value };
      return updated;
    });
  };

  // Fetch available stock and farmer availability on component mount
  useEffect(() => {
    const fetchData = async () => {
      try {
        const stockResponse = await getAvailableStock();
        if (stockResponse.success) {
          setAvailableStock(stockResponse.data);
        }
      } catch (error) {
        console.error('Error fetching available stock:', error);
      }
    };

    fetchData();
  }, []);

  // Fetch farmer availability when farmers are loaded
  useEffect(() => {
    const fetchFarmerAvailability = async () => {
      if (assignmentOptions.farmers.length === 0) {
        setFarmerAvailability({});
        setFarmerAvailabilityLoaded(true);
        return;
      }

      setFarmerAvailabilityLoaded(false);
      const availabilityMap = {};

      await Promise.all(
        assignmentOptions.farmers.map(async (farmer) => {
          const fid = getFarmerId(farmer);
          if (!fid) return;
          try {
            const response = await getVegetableAvailabilityByFarmer(fid);
            if (response.success && response.data) {
              availabilityMap[fid] = filterActiveAvailabilityItems(response.data);
            } else {
              availabilityMap[fid] = [];
            }
          } catch (error) {
            console.error(`Error fetching availability for farmer ${fid}:`, error);
            availabilityMap[fid] = [];
          }
        })
      );

      setFarmerAvailability(availabilityMap);
      setFarmerAvailabilityLoaded(true);
    };

    fetchFarmerAvailability();
  }, [assignmentOptions.farmers]);

  const getFarmerFilterOptions = (row) => {
    const assignedName = row.isRemaining
      ? remainingRowAssignments[row.id]?.assignedTo
      : row.assignedTo;
    const assignedFarmer = assignedName
      ? assignmentOptions.farmers.find((f) => f.farmer_name === assignedName)
      : null;
    return {
      availabilityLoaded: farmerAvailabilityLoaded,
      includeFarmerIds: assignedFarmer ? [getFarmerId(assignedFarmer)] : [],
    };
  };

  // Local Order Assign is always net-weight based (no box-based UI)
  useEffect(() => {
    setIsBoxBasedOrder(false);
  }, [orderDetails]);

  // Close labour dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      const openDropdowns = Object.keys(labourDropdownOpen).filter(key => labourDropdownOpen[key]);
      if (openDropdowns.length === 0) return;

      // Check if click is on any button
      const clickedButton = openDropdowns.some(routeId => {
        const button = labourButtonRefs.current[routeId];
        return button && button.contains(event.target);
      });

      // Check if click is inside any dropdown
      const clickedDropdown = event.target.closest('.absolute.z-10.mt-1');

      if (!clickedButton && !clickedDropdown) {
        const updatedState = {};
        openDropdowns.forEach(routeId => {
          updatedState[routeId] = false;
        });
        setLabourDropdownOpen(prev => ({ ...prev, ...updatedState }));
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [labourDropdownOpen]);

  // Helper function to create delivery route for an assignment
  const createDeliveryRoute = (entity, entityType, row, assignedQty, isRemaining = false) => {
    const routeId = isRemaining
      ? `${entityType}-${entity.fid || entity.sid || entity.tpid}-${row.id}-remaining`
      : `${entityType}-${entity.fid || entity.sid || entity.tpid}-${row.id}`;

    let entityName = '';
    let entityId = '';
    let address = '';

    if (entityType === 'farmer') {
      entityName = entity.farmer_name;
      entityId = entity.fid;
      address = `${entity.address || ''}, ${entity.city || ''}, ${entity.state || ''} - ${entity.pin_code || ''}`;
    } else if (entityType === 'supplier') {
      entityName = entity.supplier_name;
      entityId = entity.sid;
      address = `${entity.address || ''}, ${entity.city || ''}, ${entity.state || ''} - ${entity.pin_code || ''}`;
    } else if (entityType === 'thirdParty') {
      entityName = entity.third_party_name;
      entityId = entity.tpid;
      address = `${entity.address || ''}, ${entity.city || ''}, ${entity.state || ''} - ${entity.pin_code || ''}`;
    }

    return {
      routeId,
      sourceId: `${entityType}-${entityId}-${row.id}${isRemaining ? '-remaining' : ''}`,
      location: entityName,
      address: address.trim(),
      product: row.product_name || row.product,
      quantity: assignedQty || 0,
      oiid: row.id,
      entityType,
      entityId,
      driver: '',
      labours: [],
      isRemaining
    };
  };

  // Helper function to update or add delivery route
  const updateDeliveryRoute = (newRoute) => {
    setDeliveryRoutes(prev => {
      const existingIndex = prev.findIndex(r => r.routeId === newRoute.routeId);
      if (existingIndex >= 0) {
        const updated = [...prev];
        updated[existingIndex] = { ...updated[existingIndex], ...newRoute };
        return updated;
      } else {
        return [...prev, newRoute];
      }
    });
  };

  // Helper function to remove delivery route
  const removeDeliveryRoute = (routeId) => {
    setDeliveryRoutes(prev => prev.filter(r => r.routeId !== routeId));
  };

  // Helper function to remove all routes for a specific row
  const removeRoutesForRow = (oiid, isRemaining = false, specificKey = null) => {
    setDeliveryRoutes(prev => prev.filter(route => {
      // For remaining rows with specific key
      if (specificKey) {
        return !route.routeId.includes(specificKey);
      }
      // For main rows
      if (!isRemaining) {
        return route.oiid !== oiid || route.isRemaining;
      }
      // For remaining rows (remove all remaining for this oiid)
      return route.oiid !== oiid || !route.isRemaining;
    }));
  };

  // Load assignment options and existing assignment data
  useEffect(() => {
    const loadAssignmentData = async () => {
      try {
        // Load order details if not provided
        if (!orderDetails) {
          try {
            const orderResponse = await getOrderById(id);
            setOrderDetails(orderResponse.data);
          } catch (error) {
            console.error('Error loading order details:', error);
          }
        }

        const [farmersRes, suppliersRes, thirdPartiesRes, laboursRes, driversRes, productsRes, productCountsRes] = await Promise.all([
          getAllFarmers(),
          getAllSuppliers(),
          getAllThirdParties(),
          getPresentLaboursToday(),
          getPresentDriversToday(),
          getAllProducts(1, 1000),
          getAllProductCounts(1, 1000, '').catch(() => ({ data: [] }))
        ]);

        const allProductsList = productsRes.success ? productsRes.data || [] : [];
        const productCountRecords = productCountsRes?.data || [];
        const productCountEnabledIds = new Set(
          productCountRecords
            .filter(r => (r.product_status || '').toLowerCase() === 'active')
            .map(r => String(r.pid))
        );

        // Store data in local variables for immediate use
        const farmers = farmersRes.data || [];
        const suppliers = suppliersRes.data || [];
        const thirdParties = thirdPartiesRes.data || [];

        // Extract labours using the same logic as Stage 1 (present labours only)
        // console.log('Full labour response (LocalOrderAssign):', laboursRes);

        let labours = [];
        // Handle different response structures
        let allAttendance = [];
        if (laboursRes.data?.data) {
          allAttendance = laboursRes.data.data;
        } else if (Array.isArray(laboursRes.data)) {
          allAttendance = laboursRes.data;
        } else if (laboursRes.data) {
          allAttendance = [laboursRes.data];
        }

        // console.log('All attendance records (LocalOrderAssign):', allAttendance);

        // Extract labours from nested structure
        if (allAttendance.length > 0 && allAttendance[0].labours) {
          labours = allAttendance[0].labours.filter(labour =>
            labour.attendance_status && labour.attendance_status.toLowerCase() === 'present'
          );
        }

        // console.log('Present labours (LocalOrderAssign):', labours);

        // Extract present drivers using the same logic as Stage 1
        const drivers = driversRes.data?.map(record => record.driver).filter(d => d) || [];

        setAssignmentOptions({
          farmers: sortDropdownObjects(farmers, (f) => f.farmer_name),
          suppliers: sortDropdownObjects(suppliers, (s) => s.supplier_name),
          thirdParties: sortDropdownObjects(thirdParties, (tp) => tp.third_party_name),
          labours: sortDropdownObjects(labours, (l) => l.full_name),
          drivers: sortDropdownObjects(drivers, (d) => d.driver_name)
        });

        // Always fetch fresh local order data from the API to get the latest status from the database
        let localOrderData = null;

        try {
          const localOrderResponse = await getLocalOrder(id);

          // Handle different response structures
          if (localOrderResponse) {
            // Case 1: Response has success and data properties (most common)
            if (localOrderResponse.success && localOrderResponse.data) {
              const rawData = localOrderResponse.data;

              localOrderData = {
                collectionType: rawData.collection_type || rawData.collectionType,
                productAssignments: null,
                deliveryRoutes: null,
                summaryData: null
              };

              // Parse product_assignments (stored as JSON string in DB)
              if (rawData.product_assignments) {
                try {
                  localOrderData.productAssignments = typeof rawData.product_assignments === 'string'
                    ? JSON.parse(rawData.product_assignments)
                    : rawData.product_assignments;
                } catch (e) {
                  console.error('Error parsing product_assignments:', e);
                }
              }

              // Parse delivery_routes (stored as JSON string in DB)
              if (rawData.delivery_routes) {
                try {
                  localOrderData.deliveryRoutes = typeof rawData.delivery_routes === 'string'
                    ? JSON.parse(rawData.delivery_routes)
                    : rawData.delivery_routes;
                } catch (e) {
                  console.error('Error parsing delivery_routes:', e);
                }
              }

              // Parse summary_data (stored as JSON string in DB) — contains statuses
              if (rawData.summary_data) {
                try {
                  localOrderData.summaryData = typeof rawData.summary_data === 'string'
                    ? JSON.parse(rawData.summary_data)
                    : rawData.summary_data;
                } catch (e) {
                  console.error('Error parsing summary_data:', e);
                }
              }
            }
            // Case 2: Response has data property (no success field)
            else if (localOrderResponse.data && !localOrderResponse.success) {
              const rawData = localOrderResponse.data;
              localOrderData = {
                collectionType: rawData.collection_type || rawData.collectionType,
                productAssignments: rawData.product_assignments
                  ? (typeof rawData.product_assignments === 'string' ? JSON.parse(rawData.product_assignments) : rawData.product_assignments)
                  : null,
                deliveryRoutes: rawData.delivery_routes
                  ? (typeof rawData.delivery_routes === 'string' ? JSON.parse(rawData.delivery_routes) : rawData.delivery_routes)
                  : null,
                summaryData: rawData.summary_data
                  ? (typeof rawData.summary_data === 'string' ? JSON.parse(rawData.summary_data) : rawData.summary_data)
                  : null,
              };
            }
            // Case 3: Response is the data itself
            else if (localOrderResponse.collectionType || localOrderResponse.productAssignments) {
              localOrderData = localOrderResponse;
            }
          }
        } catch (error) {
          // API fetch failed — fall back to navigation state data if available
          console.warn('Could not fetch fresh local order from API, falling back to navigation state:', error.message);
          if (localOrderDataFromState) {
            localOrderData = { ...localOrderDataFromState };
            // Parse JSON strings from navigation state
            if (localOrderData.product_assignments && typeof localOrderData.product_assignments === 'string') {
              try { localOrderData.productAssignments = JSON.parse(localOrderData.product_assignments); } catch (e) { /* ignore */ }
            }
            if (localOrderData.delivery_routes && typeof localOrderData.delivery_routes === 'string') {
              try { localOrderData.deliveryRoutes = JSON.parse(localOrderData.delivery_routes); } catch (e) { /* ignore */ }
            }
            if (localOrderData.summary_data && typeof localOrderData.summary_data === 'string') {
              try { localOrderData.summaryData = JSON.parse(localOrderData.summary_data); } catch (e) { /* ignore */ }
            }
          }
        }

        // If we have local order data, use it
        // Handle both camelCase and snake_case property names
        const productAssignments = localOrderData?.productAssignments || localOrderData?.product_assignments;
        const deliveryRoutesData = localOrderData?.deliveryRoutes || localOrderData?.delivery_routes;
        const summaryDataFromLocal = localOrderData?.summaryData || localOrderData?.summary_data;

          if (localOrderData && productAssignments) {
          // console.log('Loading from local order data');

          // Get order items
          let items = [];
          if (orderDetails && orderDetails.items) {
            items = orderDetails.items;
          } else {
            console.warn('No order items found');
            return;
          }

          if (items.length > 0) {
            const rows = items.map((item) => {
              let currentPrice = 0;
              const productName = (item.product_name || item.product || '').replace(/^\d+\s*-\s*/, '').trim();
              const matchedProduct = allProductsList.find(p =>
                p.product_name?.toLowerCase() === productName.toLowerCase()
              );

              if (matchedProduct?.current_price) {
                currentPrice = parseFloat(matchedProduct.current_price);
              }

              const hasProductCount = matchedProduct && productCountEnabledIds.has(String(matchedProduct.pid));

              return {
                id: item.oiid,
                product: (item.product || item.product_name || '')?.replace(/^\d+\s*-\s*/, ''),
                product_name: (item.product_name || item.product || '')?.replace(/^\d+\s*-\s*/, ''),
                quantity: `${item.net_weight || 0} kg`,
                net_weight: parseFloat(item.net_weight) || 0,
                num_boxes: parseInt(item.num_boxes) || 0,
                assignedTo: '',
                entityType: '',
                marketPrice: currentPrice,
                assignedQty: 0,
                assignedBoxes: 0,
                price: 0,
                canEdit: true,
                hasProductCount,
                productCount: '',
                multiple_box_id: item.multiple_box_id || null,
                multiple_box_name: item.multiple_box_name || null
              };
            });

            // Apply saved assignments to rows
            const assignments = Array.isArray(productAssignments) ? productAssignments : [];
            const assignmentsByOiid = {};

            assignments.forEach(assignment => {
              const oiid = String(assignment.id); // Convert to string for consistent comparison
              if (!assignmentsByOiid[oiid]) {
                assignmentsByOiid[oiid] = [];
              }
              assignmentsByOiid[oiid].push(assignment);
            });

            // console.log('Assignments grouped by OIID:', assignmentsByOiid);

            // Apply assignments to rows
            rows.forEach(row => {
              const itemAssignments = assignmentsByOiid[String(row.id)] || []; // Convert to string for lookup

              // console.log(`Row ${row.id} (${row.product}): Found ${itemAssignments.length} assignments`);

              if (itemAssignments.length > 0) {
                // Handle first assignment (main row)
                const firstAssignment = itemAssignments[0];
                row.entityType = firstAssignment.entityType || '';
                row.assignedQty = parseFloat(firstAssignment.assignedQty) || 0;
                row.assignedBoxes = parseFloat(firstAssignment.assignedBoxes) || 0; // Add assignedBoxes field
                row.assignedTo = firstAssignment.assignedTo || '';
                row.addressInfo = firstAssignment.address || '';
                row.productCount = firstAssignment.productCount || firstAssignment.product_count || row.productCount || '';

                // console.log(`  Main assignment:`, {
                //   entityType: row.entityType,
                //   assignedTo: row.assignedTo,
                //   assignedQty: row.assignedQty,
                //   assignedBoxes: row.assignedBoxes,
                //   place: row.place
                // });

                // Handle remaining assignments
                if (itemAssignments.length > 1) {
                  const remainingAssignmentsData = {};

                  //console.log(`  Found ${itemAssignments.length - 1} remaining assignments`);

                  itemAssignments.slice(1).forEach((assignment, idx) => {
                    const remainingKey = `${row.id}-remaining-${idx}`;
                    remainingAssignmentsData[remainingKey] = {
                      assignedTo: assignment.assignedTo || '',
                      entityType: assignment.entityType || '',
                      assignedQty: parseFloat(assignment.assignedQty) || 0,
                      assignedBoxes: parseFloat(assignment.assignedBoxes) || 0, // Add assignedBoxes field
                      price: parseFloat(assignment.price) || 0,
                      marketPrice: row.marketPrice,
                      tapeColor: assignment.tapeColor || '',
                      place: assignment.place || '', // Add place field
                      addressInfo: assignment.address || ''
                    };

                    // console.log(`  Remaining assignment ${idx} (${remainingKey}):`, remainingAssignmentsData[remainingKey]);
                  });

                  setRemainingRowAssignments(prev => {
                    const updated = {
                      ...prev,
                      ...remainingAssignmentsData
                    };
                    //console.log('Updated remainingRowAssignments:', updated);
                    return updated;
                  });
                }
              }
            });

            setProductRows(rows);

            // Also restore remaining assignments from deliveryRoutes (since they might not be in productAssignments)
            if (localOrderData.deliveryRoutes) {
              const remainingRoutesData = {};

              localOrderData.deliveryRoutes.forEach(route => {
                if (route.isRemaining && route.oiid && typeof route.oiid === 'string' && route.oiid.includes('-remaining-')) {
                  // Extract the base ID and remaining index from oiid like "8-remaining-0"
                  const parts = route.oiid.split('-remaining-');
                  const baseId = parts[0];
                  const remainingIndex = parts[1] || '0';
                  const remainingKey = `${baseId}-remaining-${remainingIndex}`;

                  // Find the corresponding row to get marketPrice
                  const correspondingRow = rows.find(r => String(r.id) === String(baseId));

                  // Determine place based on entity type if not saved
                  let place = route.place || '';
                  // Normalize old place values to new options
                  if (place === 'Supplier place' || place === 'Third Party place') {
                    place = 'Farmer place';
                  }
                  if (!place && route.entityType) {
                    place = 'Farmer place';
                  }

                  remainingRoutesData[remainingKey] = {
                    assignedTo: route.location || '', // location is the entity name
                    entityType: route.entityType || '',
                    assignedQty: parseFloat(route.quantity) || 0,
                    assignedBoxes: parseFloat(route.assignedBoxes) || 0,
                    price: 0,
                    marketPrice: correspondingRow?.marketPrice || 0,
                    tapeColor: '',
                    place: place // Extract place from route or determine from entity type
                  };

                  //console.log(`Restored remaining assignment from route: ${remainingKey}`, remainingRoutesData[remainingKey]);
                }
              });

              if (Object.keys(remainingRoutesData).length > 0) {
                setRemainingRowAssignments(prev => {
                  const updated = {
                    ...prev,
                    ...remainingRoutesData
                  };
                  //console.log('Updated remainingRowAssignments from routes:', updated);
                  return updated;
                });
              }
            }

            // Build status map FIRST from summaryData before setting any state
            // This ensures both states are applied in the same React batch
            const statusMap = {};

            // Resolve summaryData from all possible locations (handles string, object, or pre-parsed)
            let resolvedSummaryData = summaryDataFromLocal;
            if (!resolvedSummaryData && localOrderData?.summary_data) {
              if (typeof localOrderData.summary_data === 'object') {
                resolvedSummaryData = localOrderData.summary_data;
              } else if (typeof localOrderData.summary_data === 'string') {
                try {
                  resolvedSummaryData = JSON.parse(localOrderData.summary_data);
                } catch (e) {
                  console.error('Error parsing summary_data for status restore:', e);
                }
              }
            }

            if (resolvedSummaryData?.driverAssignments) {
              resolvedSummaryData.driverAssignments.forEach(assignment => {
                assignment.assignments?.forEach(item => {
                  // Prefer the saved routeId; fall back to reconstructing it for backward compatibility
                  let routeId = item.routeId;
                  if (!routeId) {
                    routeId = `${item.entityType}-${item.entityId}-${item.oiid}`;
                  }

                  // Normalize status (only lowercase 'completed', keep others as-is)
                  let normalizedStatus = item.status || '';
                  if (normalizedStatus && typeof normalizedStatus === 'string') {
                    normalizedStatus = normalizedStatus.toLowerCase() === 'completed' ? 'completed' : normalizedStatus;
                  }
                  statusMap[routeId] = normalizedStatus;
                  if (item.dropDriver) {
                    statusMap[`${routeId}-dropDriver`] = item.dropDriver;
                  }
                  if (item.collectionStatus) {
                    statusMap[`${routeId}-collection`] = item.collectionStatus;
                  }
                });
              });
            }

            // Restore delivery routes
            if (deliveryRoutesData) {
              // Transform the routes to ensure labours is an array
              const transformedRoutes = (Array.isArray(deliveryRoutesData) ? deliveryRoutesData : []).map(route => {
                let labours = [];

                // Check if labours already exists as an array
                if (Array.isArray(route.labours)) {
                  labours = route.labours;
                }
                // Check if labour exists as a string (old format)
                else if (route.labour && typeof route.labour === 'string' && route.labour.trim() !== '') {
                  labours = [route.labour];
                }
                // Check if labours exists as a string (needs parsing)
                else if (route.labours && typeof route.labours === 'string' && route.labours.trim() !== '') {
                  try {
                    labours = JSON.parse(route.labours);
                  } catch (e) {
                    labours = [route.labours];
                  }
                }

                return {
                  ...route,
                  labours
                };
              });

              // Set both states together so they apply in the same render
              setDeliveryRoutes(transformedRoutes);
            }

            // Apply statuses (set after routes so both are in the same batch)
            if (Object.keys(statusMap).length > 0) {
              setAssignmentStatuses(statusMap);
            }
          }
        } else {
          // No local order data, try flight assignment or initialize fresh
          try {
            const assignmentResponse = await getOrderAssignment(id);
            const assignmentData = assignmentResponse.data;

            // Load delivery routes if they exist
            let savedDeliveryRoutes = [];
            if (assignmentData.delivery_routes) {
              try {
                savedDeliveryRoutes = typeof assignmentData.delivery_routes === 'string'
                  ? JSON.parse(assignmentData.delivery_routes)
                  : assignmentData.delivery_routes;
                //console.log('Loaded saved delivery routes:', savedDeliveryRoutes);
              } catch (e) {
                console.error('Error parsing delivery_routes:', e);
              }
            }

            let items = [];
            if (assignmentData.order && assignmentData.order.items) {
              items = assignmentData.order.items;
            } else if (orderDetails && orderDetails.items) {
              items = orderDetails.items;
            } else {
              console.warn('No order items found for assignment');
              return;
            }

            if (items.length > 0) {
              const rows = items.map((item) => {
                let currentPrice = 0;
                const productName = (item.product_name || item.product || '').replace(/^\d+\s*-\s*/, '').trim();
                const matchedProduct = allProductsList.find(p =>
                  p.product_name?.toLowerCase() === productName.toLowerCase()
                );

                if (matchedProduct?.current_price) {
                  currentPrice = parseFloat(matchedProduct.current_price);
                }

                const hasProductCount = matchedProduct && productCountEnabledIds.has(String(matchedProduct.pid));

                return {
                  id: item.oiid,
                  product: (item.product || item.product_name || '')?.replace(/^\d+\s*-\s*/, ''),
                  product_name: (item.product_name || item.product || '')?.replace(/^\d+\s*-\s*/, ''),
                  quantity: `${item.net_weight || 0} kg`,
                  net_weight: parseFloat(item.net_weight) || 0,
                  num_boxes: parseInt(item.num_boxes) || 0,
                  assignedTo: '',
                  entityType: '',
                  marketPrice: currentPrice,
                  assignedQty: 0,
                  assignedBoxes: 0,
                  price: 0,
                  canEdit: true,
                  hasProductCount,
                  productCount: '',
                  multiple_box_id: item.multiple_box_id || null,
                  multiple_box_name: item.multiple_box_name || null
                };
              });

              // Load existing assignments and create delivery routes
              const loadedDeliveryRoutes = [];

              // Parse product_assignments
              let assignments = [];
              if (assignmentData.product_assignments) {
                try {
                  assignments = typeof assignmentData.product_assignments === 'string'
                    ? JSON.parse(assignmentData.product_assignments)
                    : assignmentData.product_assignments;
                } catch (e) {
                  console.error('Error parsing product_assignments:', e);
                }
              }

              //console.log('Parsed product assignments:', assignments);

              // Group assignments by order item ID
              const assignmentsByOiid = {};
              assignments.forEach(assignment => {
                const oiid = assignment.id;
                if (!assignmentsByOiid[oiid]) {
                  assignmentsByOiid[oiid] = [];
                }
                assignmentsByOiid[oiid].push(assignment);
              });

              // Apply assignments to rows
              rows.forEach(row => {
                const itemAssignments = assignmentsByOiid[row.id] || [];

                if (itemAssignments.length > 0) {
                  // Handle first assignment (main row)
                  const firstAssignment = itemAssignments[0];
                  row.entityType = firstAssignment.entityType || '';
                  row.assignedQty = parseFloat(firstAssignment.assignedQty) || 0;
                  row.price = parseFloat(firstAssignment.price) || 0;
                  row.addressInfo = firstAssignment.address || '';
                  row.productCount = firstAssignment.productCount || firstAssignment.product_count || row.productCount || '';

                  // Find entity and set name using freshly fetched data
                  let entity = null;
                  let entityName = '';
                  if (firstAssignment.entityType === 'farmer') {
                    entity = farmers.find(f => f.fid == firstAssignment.entityId);
                    entityName = entity?.farmer_name || '';
                  } else if (firstAssignment.entityType === 'supplier') {
                    entity = suppliers.find(s => s.sid == firstAssignment.entityId);
                    entityName = entity?.supplier_name || '';
                  } else if (firstAssignment.entityType === 'thirdParty') {
                    entity = thirdParties.find(tp => tp.tpid == firstAssignment.entityId);
                    entityName = entity?.third_party_name || '';
                  }
                  row.assignedTo = entityName;
                  row.tapeColor = firstAssignment.tapeColor || entity?.tape_color || '';

                  // Create delivery route for first assignment
                  if (entity) {
                    const route = createDeliveryRoute(
                      entity,
                      firstAssignment.entityType,
                      row,
                      firstAssignment.assignedQty,
                      false
                    );
                    // Find matching saved route to get driver info
                    const savedRoute = savedDeliveryRoutes.find(sr =>
                      sr.entityId == route.entityId &&
                      sr.oiid == route.oiid &&
                      !sr.isRemaining
                    );
                    route.driver = savedRoute?.driver || firstAssignment.driver || '';
                    loadedDeliveryRoutes.push(route);
                  }

                  // Handle remaining assignments (for multiple drivers/entities)
                  if (itemAssignments.length > 1) {
                    const remainingAssignmentsData = {};

                    itemAssignments.slice(1).forEach((assignment, idx) => {
                      const remainingKey = `${row.id}-remaining-${idx}`;

                      // Find entity using freshly fetched data
                      let entity = null;
                      let entityName = '';
                      if (assignment.entityType === 'farmer') {
                        entity = farmers.find(f => f.fid == assignment.entityId);
                        entityName = entity?.farmer_name || '';
                      } else if (assignment.entityType === 'supplier') {
                        entity = suppliers.find(s => s.sid == assignment.entityId);
                        entityName = entity?.supplier_name || '';
                      } else if (assignment.entityType === 'thirdParty') {
                        entity = thirdParties.find(tp => tp.tpid == assignment.entityId);
                        entityName = entity?.third_party_name || '';
                      }

                      remainingAssignmentsData[remainingKey] = {
                        assignedTo: entityName,
                        entityType: assignment.entityType || '',
                        assignedQty: parseFloat(assignment.assignedQty) || 0,
                        price: parseFloat(assignment.price) || 0,
                        marketPrice: row.marketPrice,
                        tapeColor: assignment.tapeColor || entity?.tape_color || '',
                        addressInfo: assignment.address || ''
                      };

                      // Create delivery route for remaining assignment
                      if (entity) {
                        const route = createDeliveryRoute(
                          entity,
                          assignment.entityType,
                          row,
                          assignment.assignedQty,
                          true
                        );
                        route.routeId = `${route.entityType}-${route.entityId}-${row.id}-remaining-${idx}`;
                        // Find matching saved route to get driver info
                        const savedRoute = savedDeliveryRoutes.find(sr =>
                          sr.entityId == route.entityId &&
                          sr.oiid == route.oiid &&
                          sr.isRemaining
                        );
                        route.driver = savedRoute?.driver || assignment.driver || '';
                        loadedDeliveryRoutes.push(route);
                      }
                    });

                    setRemainingRowAssignments(prev => ({
                      ...prev,
                      ...remainingAssignmentsData
                    }));
                  }
                }
              });

              setProductRows(rows);
              setDeliveryRoutes(loadedDeliveryRoutes);
            }
          } catch (assignmentError) {
            console.error('Error loading assignment data:', assignmentError);
            await initializeFromOrderItems();
          }
        }
      } catch (error) {
        console.error('Error loading assignment data:', error);
        await initializeFromOrderItems();
      }
    };

    loadAssignmentData();
  }, [id, orderDetails]);

  const initializeFromOrderItems = async () => {
    let items = [];
    if (orderDetails && orderDetails.items) {
      items = orderDetails.items;
    }

    let allProductsList = [];
    let productCountRecords = [];
    try {
      const [productsRes, productCountsRes] = await Promise.all([
        getAllProducts(1, 1000),
        getAllProductCounts(1, 1000, '').catch(() => ({ data: [] }))
      ]);
      allProductsList = productsRes.success ? productsRes.data || [] : [];
      productCountRecords = productCountsRes?.data || [];
    } catch (error) {
      console.error('Error fetching products/product counts:', error);
    }

    const productCountEnabledIds = new Set(
      productCountRecords
        .filter(r => (r.product_status || '').toLowerCase() === 'active')
        .map(r => String(r.pid))
    );

    if (items.length > 0) {
      const rows = items.map((item) => {
        let currentPrice = 0;
        const productName = (item.product_name || item.product || '').replace(/^\d+\s*-\s*/, '').trim();
        const matchedProduct = allProductsList.find(p =>
          p.product_name?.toLowerCase() === productName.toLowerCase()
        );

        if (matchedProduct?.current_price) {
          currentPrice = parseFloat(matchedProduct.current_price);
        }

        const hasProductCount = matchedProduct && productCountEnabledIds.has(String(matchedProduct.pid));

        return {
          id: item.oiid,
          product: (item.product || item.product_name || '')?.replace(/^\d+\s*-\s*/, ''),
          product_name: (item.product_name || item.product || '')?.replace(/^\d+\s*-\s*/, ''),
          quantity: `${item.net_weight || 0} kg`,
          net_weight: parseFloat(item.net_weight) || 0,
          num_boxes: parseInt(item.num_boxes) || 0,
          assignedTo: '',
          entityType: '',
          marketPrice: currentPrice,
          assignedQty: 0,
          assignedBoxes: 0,
          price: 0,
          canEdit: true,
          hasProductCount,
          productCount: '',
          multiple_box_id: item.multiple_box_id || null,
          multiple_box_name: item.multiple_box_name || null
        };
      });
      setProductRows(rows);
    }

    setDeliveryRoutes([]);
  };


  // Group delivery routes by driver for combined summary
  const getGroupedDriverAssignments = () => {
    const routesWithDrivers = deliveryRoutes.filter(route => route.driver);
    const grouped = {};

    routesWithDrivers.forEach(route => {
      if (!grouped[route.driver]) {
        grouped[route.driver] = {
          driver: route.driver,
          assignments: []
        };
      }

      grouped[route.driver].assignments.push({
        ...route,
        status: assignmentStatuses[route.routeId] || 'pending'
      });
    });

    return Object.values(grouped);
  };

  const handleSaveStage1 = async () => {
    try {
      // Validate all product rows have required fields filled
      const invalidRows = productRows.filter(row =>
        !row.entityType || !row.assignedTo
      );

      if (invalidRows.length > 0) {
        alert('Please fill all mandatory fields (Entity Type and Name) for all products.');
        return;
      }

      // Helper function to get entity ID
      const getEntityId = (entityType, entityName) => {
        if (entityType === 'farmer') {
          const farmer = assignmentOptions.farmers.find(f => f.farmer_name === entityName);
          return farmer?.fid;
        } else if (entityType === 'supplier') {
          const supplier = assignmentOptions.suppliers.find(s => s.supplier_name === entityName);
          return supplier?.sid;
        } else if (entityType === 'thirdParty') {
          const thirdParty = assignmentOptions.thirdParties.find(tp => tp.third_party_name === entityName);
          return thirdParty?.tpid;
        }
        return null;
      };

      // Process product assignments according to backend structure
      const processedAssignments = productRows.map(row => ({
        id: row.id,
        product: row.product_name || row.product || '',
        product_name: row.product_name || row.product || '',
        entityType: row.entityType || '',
        entityId: getEntityId(row.entityType, row.assignedTo),
        assignedTo: row.assignedTo || '',
        assignedQty: parseFloat(row.assignedQty) || 0,
        assignedBoxes: parseInt(row.assignedBoxes) || 0,
        price: parseFloat(row.price) || 0,
        place: row.place || '',
        tapeColor: row.tapeColor || '',
        address: row.addressInfo || '',
        productCount: row.productCount ?? ''
      }));

      // Add remaining assignments
      Object.entries(remainingRowAssignments).forEach(([key, remainingData]) => {
        if (remainingData.assignedTo && remainingData.assignedQty) {
          const originalId = key.split('-remaining')[0];
          const originalRow = productRows.find(row => String(row.id) === String(originalId));

          if (originalRow) {
            processedAssignments.push({
              id: originalId,
              product: originalRow.product_name || originalRow.product || '',
              product_name: originalRow.product_name || originalRow.product || '',
              entityType: remainingData.entityType || '',
              entityId: getEntityId(remainingData.entityType, remainingData.assignedTo),
              assignedTo: remainingData.assignedTo || '',
              assignedQty: parseFloat(remainingData.assignedQty) || 0,
              assignedBoxes: parseInt(remainingData.assignedBoxes) || 0,
              price: parseFloat(remainingData.price) || 0,
              place: remainingData.place || '',
              tapeColor: remainingData.tapeColor || '',
              address: remainingData.addressInfo || '',
              productCount: originalRow.productCount ?? ''
            });
          }
        }
      });

      // Process delivery routes according to backend structure
      // For LOCAL BOX ORDER, allow routes without labour assignment
      const processedRoutes = deliveryRoutes.map(route => {
        const laboursArray = route.labours || [];
        return {
          routeId: route.routeId || '',
          sourceId: route.sourceId || '',
          location: route.location || '',
          address: route.address || '',
          product: route.product || '',
          quantity: parseFloat(route.quantity) || 0,
          assignedBoxes: parseInt(route.assignedBoxes) || 0,
          oiid: route.oiid || '',
          entityType: route.entityType || '',
          entityId: route.entityId || '',
          driver: route.driver || '',
          labour: laboursArray.length > 0 ? laboursArray.join(', ') : '',
          labours: laboursArray,
          isRemaining: route.isRemaining || false
        };
      });

      // Generate summary data (same as what's displayed in the UI)
      const groupedDriverAssignments = getGroupedDriverAssignments();
      const summaryData = groupedDriverAssignments.length > 0 ? {
        driverAssignments: groupedDriverAssignments.map(group => {
          const driverInfo = assignmentOptions.drivers?.find(
            d => `${d.driver_name} - ${d.driver_id}` === group.driver
          );
          return {
            driver: group.driver,
            did: driverInfo?.did ?? null,
            driverId: driverInfo?.driver_id ?? null,
            totalWeight: parseFloat(group.assignments.reduce((sum, a) => sum + parseFloat(a.quantity), 0).toFixed(2)),
            assignments: group.assignments.map(a => {
              let status = assignmentStatuses[a.routeId] || '';
              // Normalize status to lowercase for consistency (handle both "Completed" and "completed")
              if (status && typeof status === 'string') {
                status = status.toLowerCase() === 'completed' ? 'completed' : status;
              }
              return {
                product: a.product,
                entityType: a.entityType,
                entityName: a.location,
                entityId: a.entityId,
                address: a.address,
                quantity: parseFloat(a.quantity),
                isRemaining: a.isRemaining || false,
                oiid: a.oiid,
                routeId: a.routeId,
                status: status,
                dropDriver: status === 'Drop' ? assignmentStatuses[`${a.routeId}-dropDriver`] || '' : '',
                collectionStatus: status === 'Drop' ? assignmentStatuses[`${a.routeId}-collection`] || '' : ''
              };
            })
          };
        }),
        totalCollections: deliveryRoutes.filter(route => route.driver).length,
        totalDrivers: groupedDriverAssignments.length,
        totalWeight: parseFloat(deliveryRoutes
          .filter(route => route.driver)
          .reduce((total, route) => total + (parseFloat(route.quantity) || 0), 0)
          .toFixed(2))
      } : null;

      // Determine order type based on whether it's a box-based order
      const orderType = isBoxBasedOrder ? 'LOCAL BOX ORDER' : 'LOCAL GRADE ORDER';

      const localOrderData = {
        orderType: orderType,
        productAssignments: processedAssignments,
        deliveryRoutes: processedRoutes,
        summaryData: summaryData
      };

      // console.log('Saving local order with data:', JSON.stringify(localOrderData, null, 2));
      // console.log('=== DELIVERY ROUTES WITH LABOURS ===');
      localOrderData.deliveryRoutes.forEach((route, idx) => {
        // console.log(`Route ${idx + 1}:`, {
        //   routeId: route.routeId,
        //   location: route.location,
        //   labours: route.labours,
        //   laboursType: Array.isArray(route.labours) ? 'array' : typeof route.labours,
        //   laboursCount: route.labours?.length || 0
        // });
      });

      const response = await saveLocalOrder(id, localOrderData);
      // console.log('Local order saved:', response);

      if (response && response.success) {
        alert(response.message || 'Local order assignment saved successfully!');
        navigate('/order-assign');
      } else {
        alert('Failed to save local order assignment. Please try again.');
      }
    } catch (error) {
      console.error('Error saving local order:', error);
      alert('Failed to save local order assignment. Please try again.');
    }
  };

  // Create display rows with remaining quantities as separate rows
  // Local orders are net-weight based only; box fields are ignored here
  const getDisplayRows = () => {
    const displayRows = [];

    productRows.forEach((row, index) => {
      // Main row
      displayRows.push({
        ...row,
        displayIndex: index,
        isRemaining: false
      });

      // Remaining quantity based on net weight (kg) only
      const hasRemainingQty =
        parseFloat(row.assignedQty) > 0 &&
        parseFloat(row.assignedQty) < parseFloat(row.net_weight || 0);

      if (hasRemainingQty) {
        let remainingQty =
          (parseFloat(row.net_weight) || 0) - (parseFloat(row.assignedQty) || 0);

        // Collect all remaining assignments for this product
        const remainingKeys = Object.keys(remainingRowAssignments)
          .filter(k => k.startsWith(`${row.id}-remaining`))
          .sort();

        // Existing remaining assignments
        remainingKeys.forEach(key => {
          const data = remainingRowAssignments[key] || {};
          const assignedQty = parseFloat(data.assignedQty) || 0;

          const displayQty = remainingQty > 0 ? remainingQty : 0;

          displayRows.push({
            id: key,
            product: row.product,
            product_name: row.product_name,
            quantity: `${displayQty} kg`,
            net_weight: displayQty,
            assignedTo: data.assignedTo || '',
            entityType: data.entityType || '',
            marketPrice: data.marketPrice || row.marketPrice || 0,
            assignedQty,
            price: parseFloat(data.price) || 0,
            canEdit: true,
            displayIndex: index,
            isRemaining: true,
            originalRowIndex: index
          });

          if (assignedQty > 0) {
            remainingQty = Math.max(0, remainingQty - assignedQty);
          }
        });

        // New remaining row if there is still quantity left
        const allRemainingHaveQty =
          remainingKeys.length === 0 ||
          remainingKeys.every(
            k => (parseFloat(remainingRowAssignments[k].assignedQty) || 0) > 0
          );

        if (remainingQty > 0 && allRemainingHaveQty) {
          const newRemainingKey = `${row.id}-remaining-${remainingKeys.length}`;
          const remainingData = remainingRowAssignments[newRemainingKey] || {};

          displayRows.push({
            id: newRemainingKey,
            product: row.product,
            product_name: row.product_name,
            quantity: `${remainingQty} kg`,
            net_weight: remainingQty,
            assignedTo: remainingData.assignedTo || '',
            entityType: remainingData.entityType || '',
            marketPrice: remainingData.marketPrice || row.marketPrice || 0,
            assignedQty: parseFloat(remainingData.assignedQty) || 0,
            price: parseFloat(remainingData.price) || 0,
            canEdit: true,
            displayIndex: index,
            isRemaining: true,
            originalRowIndex: index
          });
        }
      }
    });

    return displayRows;
  };

  const displayRows = getDisplayRows();

  // Check if we have any routes with drivers assigned
  const hasAssignedDrivers = deliveryRoutes.some(route => route.driver);
  const groupedDriverAssignments = getGroupedDriverAssignments();

  return (
    <div className="min-h-screen bg-gray-50 p-4 sm:p-6 lg:p-8">

      {/* Order Information Table */}
      <div className="bg-white rounded-xl shadow-sm p-6 mb-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900">Order Information</h2>
          <button className="p-2 text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors">
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Order ID</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Customer Name</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Total Products</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Status</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="px-4 py-3 text-sm text-left text-gray-900">{orderDetails?.oid || id}</td>
                <td className="px-4 py-3 text-sm text-left text-gray-900">{orderDetails?.customer_name || 'N/A'}</td>
                <td className="px-4 py-3 text-sm text-left text-gray-900">{orderDetails?.items?.length || 0} Items</td>
                <td className="px-4 py-3">
                  <span className={`inline-block px-3 py-1 rounded-full text-xs font-medium ${orderDetails?.order_status === 'pending' ? 'bg-purple-100 text-purple-700' :
                    orderDetails?.order_status === 'processing' ? 'bg-yellow-100 text-yellow-700' :
                      orderDetails?.order_status === 'delivered' ? 'bg-emerald-600 text-white' :
                        'bg-gray-100 text-gray-700'
                    }`}>
                    {orderDetails?.order_status ? orderDetails.order_status.charAt(0).toUpperCase() + orderDetails.order_status.slice(1) : 'N/A'}
                  </span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>



      {/* Stage 1 Section */}
      <div className="bg-white rounded-xl shadow-sm p-6 mb-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 mb-2">
          <h2 className="text-lg font-semibold text-gray-900">Stage 1: Product Collection from Sources</h2>
        </div>
        <p className="text-sm text-gray-600 mb-6">Assign order products to farmers, suppliers, and third parties for collection and delivery to packaging location</p>

        {/* Totals Summary - Local orders are based on net weight (kg) only */}
        <div className="mb-6 grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Total Net Weight */}
          <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-lg p-4 border border-blue-200">
            <p className="text-xs font-semibold text-gray-600 uppercase mb-1">Total Net Weight</p>
            <p className="text-2xl font-bold text-blue-700">
              {productRows
                .reduce((sum, p) => sum + (parseFloat(p.net_weight) || 0), 0)
                .toFixed(2)}{' '}
              kg
            </p>
          </div>

          {/* Total Gross Weight (same as net for local orders) */}
          <div className="bg-gradient-to-br from-purple-50 to-purple-100 rounded-lg p-4 border border-purple-200">
            <p className="text-xs font-semibold text-gray-600 uppercase mb-1">Total Gross Weight</p>
            <p className="text-2xl font-bold text-purple-700">
              {productRows
                .reduce((sum, p) => sum + (parseFloat(p.net_weight) || 0), 0)
                .toFixed(2)}{' '}
              kg
            </p>
          </div>
        </div>

        {/* Product Table - Desktop */}
        <div className="hidden lg:block overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Product</th>
                {isBoxBasedOrder && <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase">No of Boxes/Bags</th>}
                {!isBoxBasedOrder && <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Quantity Needed</th>}
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Count</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Entity Type <span className="text-red-500">*</span></th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Name <span className="text-red-500">*</span></th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Address</th>
                {/* <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Entity Stock</th> */}
                {isBoxBasedOrder && <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Picked No of Boxes/Bags</th>}
                {!isBoxBasedOrder && <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Picked Qty</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {displayRows.map((row, index) => {
                const productName = (row.product_name || row.product)?.replace(/^\d+\s*-\s*/, '');
                const stockQty = availableStock[productName] || 0;

                return (
                  <tr key={row.id} className={`hover:bg-gray-50 transition-colors ${row.isRemaining ? 'bg-yellow-50' : ''}`}>
                    <td className="px-4 py-4">
                      <span className="text-sm font-medium text-gray-900">
                        {productName}
                      </span>
                      {row.multiple_box_name && (
                        <span className="block mt-1">
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-violet-100 text-violet-700 border border-violet-200">
                            📦 {row.multiple_box_name}
                          </span>
                        </span>
                      )}
                      {row.isRemaining && (
                        <span className="block text-xs text-yellow-700 italic mt-1">
                          Remaining Quantity
                        </span>
                      )}
                    </td>
                    {isBoxBasedOrder && (
                      <td className="px-4 py-4">
                        <span className="text-sm text-gray-600">{row.num_boxes || '-'}</span>
                      </td>
                    )}
                {!isBoxBasedOrder && (
                  <td className="px-4 py-4">
                    <span className="text-sm text-gray-900">{row.quantity}</span>
                  </td>
                )}
                <td className="px-4 py-4">
                  {row.hasProductCount && !row.isRemaining ? (
                    <input
                      type="text"
                      value={row.productCount ?? ''}
                      onChange={(e) => handleProductCountChange(row.displayIndex, e.target.value)}
                      className="w-24 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
                    />
                  ) : (
                    <span className="text-sm text-gray-400">-</span>
                  )}
                </td>
                <td className="px-4 py-4">
                      <select
                        ref={(el) => {
                          if (el) inputGridRefs.current[`${index}-0`] = el;
                        }}
                        onKeyDown={(e) => handleKeyDown(e, index, 0, displayRows.length)}
                        className="min-w-[130px] w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
                        value={row.entityType || ''}
                        onChange={(e) => {
                          if (row.isRemaining) {
                            removeRoutesForRow(row.id.split('-remaining')[0], true, row.id);
                            setRemainingRowAssignments(prev => ({
                              ...prev,
                              [row.id]: {
                                ...prev[row.id],
                                entityType: e.target.value,
                                assignedTo: '',
                                assignedQty: prev[row.id]?.assignedQty || 0
                              }
                            }));
                          } else {
                            removeRoutesForRow(row.id, false);
                            const updatedRows = [...productRows];
                            updatedRows[row.displayIndex].entityType = e.target.value;
                            updatedRows[row.displayIndex].assignedTo = '';
                            setProductRows(updatedRows);
                          }
                        }}
                      >
                        <option value="">Select type...</option>
                        <option value="farmer">Farmer</option>
                        <option value="supplier">Supplier</option>
                        <option value="thirdParty">Third Party</option>
                      </select>
                    </td>
                    <td className="px-4 py-4">
                      <select
                        ref={(el) => {
                          if (el) inputGridRefs.current[`${index}-1`] = el;
                        }}
                        onKeyDown={(e) => handleKeyDown(e, index, 1, displayRows.length)}
                        className="min-w-[150px] w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
                        value={row.assignedTo}
                        disabled={!row.entityType}
                        onChange={(e) => {
                          const selectedEntityName = e.target.value;
                          let selectedEntity = null;
                          let addressInfo = '';

                          if (row.entityType === 'farmer') {
                            selectedEntity = assignmentOptions.farmers.find(f => f.farmer_name === selectedEntityName);
                            if (selectedEntity) {
                              addressInfo = `${selectedEntity.address || ''}, ${selectedEntity.city || ''}, ${selectedEntity.state || ''} - ${selectedEntity.pin_code || ''}`;
                            }
                          } else if (row.entityType === 'supplier') {
                            selectedEntity = assignmentOptions.suppliers.find(s => s.supplier_name === selectedEntityName);
                            if (selectedEntity) {
                              addressInfo = `${selectedEntity.address || ''}, ${selectedEntity.city || ''}, ${selectedEntity.state || ''} - ${selectedEntity.pin_code || ''}`;
                            }
                          } else if (row.entityType === 'thirdParty') {
                            selectedEntity = assignmentOptions.thirdParties.find(tp => tp.third_party_name === selectedEntityName);
                            if (selectedEntity) {
                              addressInfo = `${selectedEntity.address || ''}, ${selectedEntity.city || ''}, ${selectedEntity.state || ''} - ${selectedEntity.pin_code || ''}`;
                            }
                          }

                          if (row.isRemaining) {
                            removeRoutesForRow(row.id.split('-remaining')[0], true, row.id);
                            setRemainingRowAssignments(prev => ({
                              ...prev,
                              [row.id]: {
                                ...prev[row.id],
                                assignedTo: selectedEntityName,
                                tapeColor: selectedEntity?.tape_color || '',
                                addressInfo: addressInfo
                              }
                            }));

                            if (selectedEntity && (row.assignedQty > 0 || row.assignedBoxes > 0)) {
                              const qtyForRoute = row.assignedQty > 0 ? row.assignedQty : row.net_weight;
                              const route = createDeliveryRoute(selectedEntity, row.entityType, row, qtyForRoute, true);
                              route.routeId = `${row.entityType}-${selectedEntity.fid || selectedEntity.sid || selectedEntity.tpid}-${row.id}`;
                              route.assignedBoxes = row.assignedBoxes || 0;
                              updateDeliveryRoute(route);
                            }
                          } else {
                            removeRoutesForRow(row.id, false);
                            const updatedRows = [...productRows];
                            const targetIndex = row.displayIndex;
                            updatedRows[targetIndex].assignedTo = selectedEntityName;
                            updatedRows[targetIndex].tapeColor = selectedEntity?.tape_color || '';
                            updatedRows[targetIndex].addressInfo = addressInfo;
                            setProductRows(updatedRows);

                            if (selectedEntity && (updatedRows[targetIndex].assignedQty > 0 || updatedRows[targetIndex].assignedBoxes > 0)) {
                              const qtyForRoute = updatedRows[targetIndex].assignedQty > 0 ? updatedRows[targetIndex].assignedQty : updatedRows[targetIndex].net_weight;
                              const route = createDeliveryRoute(selectedEntity, row.entityType, updatedRows[targetIndex], qtyForRoute, false);
                              route.assignedBoxes = updatedRows[targetIndex].assignedBoxes || 0;
                              updateDeliveryRoute(route);
                            }
                          }
                        }}
                      >
                        <option value="">Select name...</option>
                        {row.entityType === 'farmer' && !farmerAvailabilityLoaded && (
                          <option value="" disabled>Loading farmers...</option>
                        )}
                        {row.entityType === 'farmer' && sortDropdownObjects(
                          filterFarmersByProductAvailability(
                            assignmentOptions.farmers,
                            farmerAvailability,
                            productName,
                            getFarmerFilterOptions(row)
                          ),
                          (farmer) => farmer.farmer_name
                        ).map(farmer => (
                          <option key={`farmer-${farmer.fid}`} value={farmer.farmer_name}>{farmer.farmer_name}</option>
                        ))}
                        {row.entityType === 'supplier' && sortDropdownObjects(assignmentOptions.suppliers, (supplier) => supplier.supplier_name).map(supplier => (
                          <option key={`supplier-${supplier.sid}`} value={supplier.supplier_name}>{supplier.supplier_name}</option>
                        ))}
                        {row.entityType === 'thirdParty' && sortDropdownObjects(assignmentOptions.thirdParties, (thirdParty) => thirdParty.third_party_name).map(thirdParty => (
                          <option key={`thirdParty-${thirdParty.tpid}`} value={thirdParty.third_party_name}>{thirdParty.third_party_name}</option>
                        ))}
                      </select>
                    </td>
                    <td className="px-4 py-4">
                      <div className="text-sm text-gray-600">
                        {row.isRemaining
                          ? (remainingRowAssignments[row.id]?.addressInfo || '-')
                          : (row.addressInfo || '-')
                        }
                      </div>
                    </td>
                    {isBoxBasedOrder && (
                      <td className="px-4 py-4">
                        <input
                          ref={(el) => {
                            if (el) inputGridRefs.current[`${index}-3`] = el;
                          }}
                          type="text"
                          value={row.assignedBoxes || ''}
                          placeholder=""
                          onKeyDown={(e) => handleKeyDown(e, index, 3, displayRows.length)}
                          onChange={(e) => {
                            const newBoxes = e.target.value;
                            if (row.isRemaining) {
                              setRemainingRowAssignments(prev => ({
                                ...prev,
                                [row.id]: { ...prev[row.id], assignedBoxes: newBoxes }
                              }));

                              if (row.assignedTo && row.entityType && newBoxes > 0) {
                                const entity = row.entityType === 'farmer'
                                  ? assignmentOptions.farmers.find(f => f.farmer_name === row.assignedTo)
                                  : row.entityType === 'supplier'
                                    ? assignmentOptions.suppliers.find(s => s.supplier_name === row.assignedTo)
                                    : assignmentOptions.thirdParties.find(tp => tp.third_party_name === row.assignedTo);

                                if (entity) {
                                  const qtyForRoute = row.assignedQty > 0 ? row.assignedQty : row.net_weight;
                                  const route = createDeliveryRoute(entity, row.entityType, row, qtyForRoute, true);
                                  route.routeId = `${row.entityType}-${entity.fid || entity.sid || entity.tpid}-${row.id}`;
                                  route.assignedBoxes = newBoxes;
                                  updateDeliveryRoute(route);
                                }
                              }
                            } else {
                              const updatedRows = [...productRows];
                              updatedRows[row.displayIndex].assignedBoxes = newBoxes;
                              setProductRows(updatedRows);

                              if (row.assignedTo && row.entityType && newBoxes > 0) {
                                const entity = row.entityType === 'farmer'
                                  ? assignmentOptions.farmers.find(f => f.farmer_name === row.assignedTo)
                                  : row.entityType === 'supplier'
                                    ? assignmentOptions.suppliers.find(s => s.supplier_name === row.assignedTo)
                                    : assignmentOptions.thirdParties.find(tp => tp.third_party_name === row.assignedTo);

                                if (entity) {
                                  const qtyForRoute = updatedRows[row.displayIndex].assignedQty > 0 ? updatedRows[row.displayIndex].assignedQty : updatedRows[row.displayIndex].net_weight;
                                  const route = createDeliveryRoute(entity, row.entityType, updatedRows[row.displayIndex], qtyForRoute, false);
                                  route.assignedBoxes = newBoxes;
                                  updateDeliveryRoute(route);
                                }
                              }
                            }
                          }}
                          className="w-24 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
                        />
                      </td>
                    )}
                    {!isBoxBasedOrder && (
                      <td className="px-4 py-4">
                        <input
                          ref={(el) => {
                            if (el) inputGridRefs.current[`${index}-3`] = el;
                          }}
                          type="text"
                          value={row.assignedQty || ''}
                          placeholder=""
                          onKeyDown={(e) => handleKeyDown(e, index, 3, displayRows.length)}
                          onChange={(e) => {
                            const newQty = e.target.value;
                            if (row.isRemaining) {
                              setRemainingRowAssignments(prev => ({
                                ...prev,
                                [row.id]: { ...prev[row.id], assignedQty: newQty }
                              }));

                              if (row.assignedTo && row.entityType) {
                                const entity = row.entityType === 'farmer'
                                  ? assignmentOptions.farmers.find(f => f.farmer_name === row.assignedTo)
                                  : row.entityType === 'supplier'
                                    ? assignmentOptions.suppliers.find(s => s.supplier_name === row.assignedTo)
                                    : assignmentOptions.thirdParties.find(tp => tp.third_party_name === row.assignedTo);

                                if (entity) {
                                  const route = createDeliveryRoute(entity, row.entityType, row, newQty, true);
                                  route.routeId = `${row.entityType}-${entity.fid || entity.sid || entity.tpid}-${row.id}`;
                                  updateDeliveryRoute(route);
                                }
                              }
                            } else {
                              const updatedRows = [...productRows];
                              updatedRows[row.displayIndex].assignedQty = newQty;
                              setProductRows(updatedRows);

                              if (row.assignedTo && row.entityType) {
                                const entity = row.entityType === 'farmer'
                                  ? assignmentOptions.farmers.find(f => f.farmer_name === row.assignedTo)
                                  : row.entityType === 'supplier'
                                    ? assignmentOptions.suppliers.find(s => s.supplier_name === row.assignedTo)
                                    : assignmentOptions.thirdParties.find(tp => tp.third_party_name === row.assignedTo);

                                if (entity) {
                                  const route = createDeliveryRoute(entity, row.entityType, updatedRows[row.displayIndex], newQty, false);
                                  updateDeliveryRoute(route);
                                }
                              }
                            }
                          }}
                          className="w-24 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
                        />
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Product Cards - Mobile */}
        <div className="lg:hidden space-y-4">
          {displayRows.map((row, index) => {
            const productName = (row.product_name || row.product)?.replace(/^\d+\s*-\s*/, '');
            const stockQty = availableStock[productName] || 0;

            return (
              <div key={row.id} className={`border rounded-lg p-4 ${row.isRemaining ? 'bg-yellow-50 border-yellow-200' : 'bg-white border-gray-200'}`}>
                <div className="flex justify-between items-start mb-3">
                  <div className="flex-1">
                    <h3 className="font-semibold text-gray-900">{productName}</h3>
                    {row.multiple_box_name && (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-violet-100 text-violet-700 border border-violet-200 mt-1">
                        📦 {row.multiple_box_name}
                      </span>
                    )}
                    {row.isRemaining && (
                      <span className="text-xs text-yellow-700 italic">Remaining Quantity</span>
                    )}
                    <p className="text-sm text-gray-600">{row.quantity}</p>
                    {row.hasProductCount && !row.isRemaining && (
                      <div className="mt-1 flex items-center gap-2">
                        <span className="text-xs font-semibold text-gray-700">Count:</span>
                        <input
                          type="text"
                          value={row.productCount ?? ''}
                          onChange={(e) => handleProductCountChange(row.displayIndex, e.target.value)}
                          className="w-20 px-2 py-1 border border-gray-300 rounded-md text-xs focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
                        />
                      </div>
                    )}
                  </div>
                </div>

                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">
                      Entity Type <span className="text-red-500">*</span>
                    </label>
                    <select
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
                      value={row.entityType || ''}
                      onChange={(e) => {
                        if (row.isRemaining) {
                          removeRoutesForRow(row.id.split('-remaining')[0], true, row.id);
                          setRemainingRowAssignments(prev => ({
                            ...prev,
                            [row.id]: {
                              ...prev[row.id],
                              entityType: e.target.value,
                              assignedTo: '',
                              marketPrice: prev[row.id]?.marketPrice || row.marketPrice || 0,
                              assignedQty: prev[row.id]?.assignedQty || 0,
                              price: prev[row.id]?.price || 0
                            }
                          }));
                        } else {
                          removeRoutesForRow(row.id, false);
                          const updatedRows = [...productRows];
                          updatedRows[row.displayIndex].entityType = e.target.value;
                          updatedRows[row.displayIndex].assignedTo = '';
                          setProductRows(updatedRows);
                        }
                      }}
                    >
                      <option value="">Select type...</option>
                      <option value="farmer">Farmer</option>
                      <option value="supplier">Supplier</option>
                      <option value="thirdParty">Third Party</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">
                      Name <span className="text-red-500">*</span>
                    </label>
                    <select
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
                      value={row.assignedTo}
                      disabled={!row.entityType}
                      onChange={(e) => {
                        const selectedEntityName = e.target.value;
                        let selectedEntity = null;
                        let addressInfo = '';

                        if (row.entityType === 'farmer') {
                          selectedEntity = assignmentOptions.farmers.find(f => f.farmer_name === selectedEntityName);
                          if (selectedEntity) {
                            addressInfo = `${selectedEntity.address || ''}, ${selectedEntity.city || ''}, ${selectedEntity.state || ''} - ${selectedEntity.pin_code || ''}`;
                          }
                        } else if (row.entityType === 'supplier') {
                          selectedEntity = assignmentOptions.suppliers.find(s => s.supplier_name === selectedEntityName);
                          if (selectedEntity) {
                            addressInfo = `${selectedEntity.address || ''}, ${selectedEntity.city || ''}, ${selectedEntity.state || ''} - ${selectedEntity.pin_code || ''}`;
                          }
                        } else if (row.entityType === 'thirdParty') {
                          selectedEntity = assignmentOptions.thirdParties.find(tp => tp.third_party_name === selectedEntityName);
                          if (selectedEntity) {
                            addressInfo = `${selectedEntity.address || ''}, ${selectedEntity.city || ''}, ${selectedEntity.state || ''} - ${selectedEntity.pin_code || ''}`;
                          }
                        }

                        if (row.isRemaining) {
                          removeRoutesForRow(row.id.split('-remaining')[0], true, row.id);
                          setRemainingRowAssignments(prev => ({
                            ...prev,
                            [row.id]: {
                              ...prev[row.id],
                              assignedTo: selectedEntityName,
                              tapeColor: selectedEntity?.tape_color || '',
                              addressInfo: addressInfo
                            }
                          }));

                          if (selectedEntity && row.assignedQty > 0) {
                            const route = createDeliveryRoute(selectedEntity, row.entityType, row, row.assignedQty, true);
                            route.routeId = `${row.entityType}-${selectedEntity.fid || selectedEntity.sid || selectedEntity.tpid}-${row.id}`;
                            updateDeliveryRoute(route);
                          }
                        } else {
                          removeRoutesForRow(row.id, false);
                          const updatedRows = [...productRows];
                          const targetIndex = row.displayIndex;
                          updatedRows[targetIndex].assignedTo = selectedEntityName;
                          updatedRows[targetIndex].tapeColor = selectedEntity?.tape_color || '';
                          updatedRows[targetIndex].addressInfo = addressInfo;
                          setProductRows(updatedRows);

                          if (selectedEntity && updatedRows[targetIndex].assignedQty > 0) {
                            const route = createDeliveryRoute(selectedEntity, row.entityType, updatedRows[targetIndex], updatedRows[targetIndex].assignedQty, false);
                            updateDeliveryRoute(route);
                          }
                        }
                      }}
                    >
                      <option value="">Select name...</option>
                      {row.entityType === 'farmer' && !farmerAvailabilityLoaded && (
                        <option value="" disabled>Loading farmers...</option>
                      )}
                      {row.entityType === 'farmer' && sortDropdownObjects(
                        filterFarmersByProductAvailability(
                          assignmentOptions.farmers,
                          farmerAvailability,
                          productName,
                          getFarmerFilterOptions(row)
                        ),
                        (farmer) => farmer.farmer_name
                      ).map(farmer => (
                        <option key={`farmer-${farmer.fid}`} value={farmer.farmer_name}>{farmer.farmer_name}</option>
                      ))}
                      {row.entityType === 'supplier' && sortDropdownObjects(assignmentOptions.suppliers, (supplier) => supplier.supplier_name).map(supplier => (
                        <option key={`supplier-${supplier.sid}`} value={supplier.supplier_name}>{supplier.supplier_name}</option>
                      ))}
                      {row.entityType === 'thirdParty' && sortDropdownObjects(assignmentOptions.thirdParties, (thirdParty) => thirdParty.third_party_name).map(thirdParty => (
                        <option key={`thirdParty-${thirdParty.tpid}`} value={thirdParty.third_party_name}>{thirdParty.third_party_name}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">Address</label>
                    <div className="text-sm text-gray-600 p-2 bg-gray-50 rounded-lg">
                      {row.isRemaining
                        ? (remainingRowAssignments[row.id]?.addressInfo || '-')
                        : (row.addressInfo || '-')
                      }
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">Entity Stock</label>
                    <div className="flex items-center gap-2">
                      {(() => {
                        const productName = (row.product_name || row.product)?.replace(/^\d+\s*-\s*/, '');
                        const entityStock = availableStock[productName] || 0;
                        return (
                          <>
                            <span className={`text-sm font-semibold ${entityStock > 0 ? 'text-emerald-600' : 'text-gray-400'}`}>
                              {entityStock > 0 ? `${entityStock.toFixed(2)} kg` : 'No stock'}
                            </span>
                            {entityStock > 0 && (
                              <div className="px-2 py-0.5 bg-emerald-100 text-emerald-700 rounded-full text-xs font-medium">
                                Available
                              </div>
                            )}
                          </>
                        );
                      })()}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-gray-700 mb-1">
                        Picked Qty <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        value={row.assignedQty || ''}
                        placeholder=""
                        onChange={(e) => {
                          const newQty = e.target.value;
                          if (row.isRemaining) {
                            setRemainingRowAssignments(prev => ({
                              ...prev,
                              [row.id]: { ...prev[row.id], assignedQty: newQty }
                            }));

                            if (row.assignedTo && row.entityType) {
                              const entity = row.entityType === 'farmer'
                                ? assignmentOptions.farmers.find(f => f.farmer_name === row.assignedTo)
                                : row.entityType === 'supplier'
                                  ? assignmentOptions.suppliers.find(s => s.supplier_name === row.assignedTo)
                                  : assignmentOptions.thirdParties.find(tp => tp.third_party_name === row.assignedTo);

                              if (entity) {
                                const route = createDeliveryRoute(entity, row.entityType, row, newQty, true);
                                route.routeId = `${row.entityType}-${entity.fid || entity.sid || entity.tpid}-${row.id}`;
                                updateDeliveryRoute(route);
                              }
                            }
                          } else {
                            const updatedRows = [...productRows];
                            updatedRows[row.displayIndex].assignedQty = newQty;
                            setProductRows(updatedRows);

                            if (row.assignedTo && row.entityType) {
                              const entity = row.entityType === 'farmer'
                                ? assignmentOptions.farmers.find(f => f.farmer_name === row.assignedTo)
                                : row.entityType === 'supplier'
                                  ? assignmentOptions.suppliers.find(s => s.supplier_name === row.assignedTo)
                                  : assignmentOptions.thirdParties.find(tp => tp.third_party_name === row.assignedTo);

                              if (entity) {
                                const route = createDeliveryRoute(entity, row.entityType, updatedRows[row.displayIndex], newQty, false);
                                updateDeliveryRoute(route);
                              }
                            }
                          }
                        }}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
                      />
                    </div>

                  </div>
                </div>
              </div>
            );
          })}
        </div>


      </div>

      {/* Delivery Routes Section */}
      <div className="bg-white rounded-xl shadow-sm p-6 mb-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-2">Assigned Drivers</h2>
        <p className="text-sm text-gray-600 mb-4">Individual drivers can be assigned for each product allocation</p>

        {/* Desktop Table */}
        <div className="hidden lg:block overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Source</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Address</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Product Name</th>
                {isBoxBasedOrder && <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Picked No of Boxes/Bags</th>}
                {!isBoxBasedOrder && <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Picked Qty</th>}
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Entity Type</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Assigned Labour</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Assigned Driver</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {deliveryRoutes.map((route, index) => (
                <tr key={route.routeId || index} className={`hover:bg-gray-50 transition-colors ${route.isRemaining ? 'bg-yellow-50' : ''}`}>
                  <td className="px-4 py-4">
                    <span className="text-sm text-gray-900">{route.location || '-'}</span>
                    {route.isRemaining && (
                      <span className="block text-xs text-yellow-700 italic mt-1">Remaining Qty</span>
                    )}
                  </td>
                  <td className="px-4 py-4">
                    <span className="text-sm text-gray-600">{route.address || '-'}</span>
                  </td>
                  <td className="px-4 py-4">
                    <span className="text-sm text-gray-900">{route.product || '-'}</span>
                  </td>
                  {isBoxBasedOrder && (
                    <td className="px-4 py-4">
                      <span className="text-sm text-gray-900">{route.assignedBoxes || '-'}</span>
                    </td>
                  )}
                  {!isBoxBasedOrder && (
                    <td className="px-4 py-4">
                      <span className="text-sm text-gray-900">{route.quantity ? `${route.quantity} kg` : '-'}</span>
                    </td>
                  )}
                  <td className="px-4 py-4">
                    <span className="text-sm text-gray-600 capitalize">{route.entityType || '-'}</span>
                  </td>
                  <td className="px-4 py-4">
                    <select
                      className="min-w-[150px] w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
                      value={route.labours?.[0] || ''}
                      onChange={(e) => {
                        const updatedRoutes = [...deliveryRoutes];
                        updatedRoutes[index].labours = e.target.value ? [e.target.value] : [];
                        setDeliveryRoutes(updatedRoutes);
                      }}
                    >
                      <option value="">Select labours...</option>
                      {assignmentOptions.labours && sortDropdownObjects(assignmentOptions.labours, (l) => l.full_name).map(labour => (
                        <option key={`labour-${labour.lid}`} value={labour.full_name}>
                          {labour.full_name}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="px-4 py-4">
                    <select
                      className="min-w-[150px] w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
                      value={route.driver || ''}
                      onChange={(e) => {
                        const updatedRoutes = [...deliveryRoutes];
                        updatedRoutes[index].driver = e.target.value;
                        setDeliveryRoutes(updatedRoutes);
                      }}
                    >
                      <option value="">Select driver...</option>
                      {assignmentOptions.drivers && sortDropdownObjects(assignmentOptions.drivers, (driver) => driver.driver_name).map(driver => (
                        <option key={`driver-${driver.did}`} value={`${driver.driver_name} - ${driver.driver_id}`}>
                          {driver.driver_name} - {driver.driver_id}
                        </option>
                      ))}
                    </select>
                  </td>
                </tr>
              ))}
              {deliveryRoutes.length === 0 && (
                <tr>
                  <td colSpan="8" className="px-4 py-8 text-center text-gray-500">
                    No delivery routes created yet. Assign products to entities to create routes.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Mobile Cards */}
        <div className="lg:hidden space-y-4">
          {deliveryRoutes.map((route, index) => (
            <div key={route.routeId || index} className={`border rounded-lg p-4 ${route.isRemaining ? 'bg-yellow-50 border-yellow-200' : 'bg-white border-gray-200'}`}>
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Source</label>
                  <div className="text-sm text-gray-900">{route.location || '-'}</div>
                  {route.isRemaining && (
                    <span className="text-xs text-yellow-700 italic">Remaining Qty</span>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Address</label>
                  <div className="text-sm text-gray-600">{route.address || '-'}</div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">Product</label>
                    <div className="text-sm text-gray-900">{route.product || '-'}</div>
                  </div>
                  {isBoxBasedOrder && (
                    <div>
                      <label className="block text-xs font-semibold text-gray-700 mb-1">Picked Boxes/Bags</label>
                      <div className="text-sm text-gray-900">{route.assignedBoxes || '-'}</div>
                    </div>
                  )}
                </div>

                {!isBoxBasedOrder && (
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">Picked Qty</label>
                    <div className="text-sm text-gray-900">{route.quantity ? `${route.quantity} kg` : '-'}</div>
                  </div>
                )}

                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Entity Type</label>
                  <div className="text-sm text-gray-600 capitalize">{route.entityType || '-'}</div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Assigned Labour</label>
                  <select
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
                    value={route.labours?.[0] || ''}
                    onChange={(e) => {
                      const updatedRoutes = [...deliveryRoutes];
                      updatedRoutes[index].labours = e.target.value ? [e.target.value] : [];
                      setDeliveryRoutes(updatedRoutes);
                    }}
                  >
                    <option value="">Select labours...</option>
                    {assignmentOptions.labours && sortDropdownObjects(assignmentOptions.labours, (l) => l.full_name).map(labour => (
                      <option key={`labour-${labour.lid}`} value={labour.full_name}>
                        {labour.full_name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Assigned Driver</label>
                  <select
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
                    value={route.driver || ''}
                    onChange={(e) => {
                      const updatedRoutes = [...deliveryRoutes];
                      updatedRoutes[index].driver = e.target.value;
                      setDeliveryRoutes(updatedRoutes);
                    }}
                  >
                    <option value="">Select driver...</option>
                    {assignmentOptions.drivers && sortDropdownObjects(assignmentOptions.drivers, (driver) => driver.driver_name).map(driver => (
                      <option key={`driver-${driver.did}`} value={`${driver.driver_name} - ${driver.driver_id}`}>
                        {driver.driver_name} - {driver.driver_id}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          ))}
          {deliveryRoutes.length === 0 && (
            <div className="text-center py-8 text-gray-500">
              No delivery routes created yet. Assign products to entities to create routes.
            </div>
          )}
        </div>
      </div>

      {/* Summary Section - Combined by Driver */}
      {hasAssignedDrivers && (
        <div className="bg-gradient-to-br from-emerald-50 to-teal-50 rounded-xl shadow-sm p-6 mb-6 border-2 border-emerald-200">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 bg-emerald-600 rounded-lg">
              <Package className="w-6 h-6 text-white" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-gray-900">Assignment Summary</h2>
              <p className="text-sm text-gray-600">Product collections grouped by driver</p>
            </div>
          </div>

          {/* Desktop Summary - Grouped by Driver */}
          <div className="hidden lg:block space-y-6">
            {groupedDriverAssignments.map((driverGroup, groupIndex) => {
              const totalWeight = driverGroup.assignments.reduce((sum, a) => sum + parseFloat(a.quantity), 0);

              return (
                <div key={groupIndex} className="bg-white rounded-lg shadow-sm overflow-hidden border-2 border-emerald-300">
                  {/* Driver Header */}
                  <div className="bg-gradient-to-r from-emerald-600 to-teal-600 px-6 py-4">
                    <div className="flex items-center gap-3 text-white">
                      <Truck className="w-6 h-6" />
                      <div>
                        <h3 className="text-lg font-bold">{driverGroup.driver}</h3>
                        <p className="text-sm text-emerald-100">{driverGroup.assignments.length} Collections</p>
                      </div>
                    </div>
                  </div>

                  {/* Assignments Table */}
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead className="bg-emerald-50">
                        <tr>
                          <th className="px-4 py-3 text-left text-xs font-bold text-gray-700 uppercase">Product</th>
                          <th className="px-4 py-3 text-left text-xs font-bold text-gray-700 uppercase">Source Type</th>
                          <th className="px-4 py-3 text-left text-xs font-bold text-gray-700 uppercase">Source Name</th>
                          <th className="px-4 py-3 text-left text-xs font-bold text-gray-700 uppercase">Address</th>
                          <th className="px-4 py-3 text-left text-xs font-bold text-gray-700 uppercase">Quantity</th>
                          <th className="px-4 py-3 text-left text-xs font-bold text-gray-700 uppercase">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200">
                        {driverGroup.assignments.map((assignment, idx) => (
                          <tr key={idx} className={`hover:bg-emerald-50 transition-colors ${assignment.isRemaining ? 'bg-yellow-50' : ''}`}>
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-2">
                                <div className="w-2 h-2 bg-emerald-500 rounded-full"></div>
                                <span className="text-sm font-medium text-gray-900">{assignment.product || '-'}</span>
                              </div>
                              {assignment.isRemaining && (
                                <span className="block text-xs text-yellow-700 italic mt-1 ml-4">Remaining Allocation</span>
                              )}
                            </td>
                            <td className="px-4 py-3">
                              <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-100 text-emerald-800 capitalize">
                                {assignment.entityType || '-'}
                              </span>
                            </td>
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-2">
                                <User className="w-4 h-4 text-gray-400" />
                                <span className="text-sm text-gray-900">{assignment.location || '-'}</span>
                              </div>
                            </td>
                            <td className="px-4 py-3">
                              <div className="flex items-start gap-2">
                                <MapPin className="w-4 h-4 text-gray-400 mt-0.5 flex-shrink-0" />
                                <span className="text-sm text-gray-600">{assignment.address || '-'}</span>
                              </div>
                            </td>
                            <td className="px-4 py-3">
                              <span className="text-sm font-semibold text-gray-900">{assignment.quantity} kg</span>
                            </td>
                            <td className="px-4 py-3">
                              <select
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
                                value={assignmentStatuses[assignment.routeId] || ''}
                                onChange={(e) => setAssignmentStatuses(prev => ({ ...prev, [assignment.routeId]: e.target.value }))}
                              >
                                <option value="">Select...</option>
                                <option value="completed">Completed</option>
                                <option value="Drop">Drop</option>
                                <option value="Picked and Packed">Picked and Packed</option>
                              </select>
                              {assignmentStatuses[assignment.routeId] === 'Drop' && (
                                <div className="mt-2 space-y-2">
                                  <select
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
                                    value={assignmentStatuses[`${assignment.routeId}-collection`] || ''}
                                    onChange={(e) => setAssignmentStatuses(prev => ({ ...prev, [`${assignment.routeId}-collection`]: e.target.value }))}
                                  >
                                    <option value="">Collection status...</option>
                                    <option value="Collection">Collection</option>
                                  </select>
                                  <select
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
                                    value={assignmentStatuses[`${assignment.routeId}-dropDriver`] || ''}
                                    onChange={(e) => setAssignmentStatuses(prev => ({ ...prev, [`${assignment.routeId}-dropDriver`]: e.target.value }))}
                                  >
                                    <option value="">Select driver...</option>
                                      {assignmentOptions.drivers && sortDropdownObjects(assignmentOptions.drivers, (driver) => driver.driver_name).map(driver => (
                                      <option key={`driver-${driver.did}`} value={`${driver.driver_name} - ${driver.driver_id}`}>
                                        {driver.driver_name} - {driver.driver_id}
                                      </option>
                                    ))}
                                  </select>
                                </div>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Mobile Summary - Grouped by Driver */}
          <div className="lg:hidden space-y-6">
            {groupedDriverAssignments.map((driverGroup, groupIndex) => {
              const totalWeight = driverGroup.assignments.reduce((sum, a) => sum + parseFloat(a.quantity), 0);

              return (
                <div key={groupIndex} className="bg-white rounded-lg shadow-sm overflow-hidden border-2 border-emerald-300">
                  {/* Driver Header */}
                  <div className="bg-gradient-to-r from-emerald-600 to-teal-600 px-4 py-3">
                    <div className="flex items-center gap-2 text-white">
                      <Truck className="w-5 h-5" />
                      <div>
                        <h3 className="text-base font-bold">{driverGroup.driver}</h3>
                        <p className="text-xs text-emerald-100">{driverGroup.assignments.length} Collections</p>
                      </div>
                    </div>
                  </div>

                  {/* Assignments */}
                  <div className="p-4 space-y-3">
                    {driverGroup.assignments.map((assignment, idx) => (
                      <div key={idx} className={`border rounded-lg p-3 ${assignment.isRemaining ? 'bg-yellow-50 border-yellow-200' : 'border-gray-200'}`}>
                        <div className="flex items-start justify-between mb-2">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <div className="w-2 h-2 bg-emerald-500 rounded-full"></div>
                              <span className="text-sm font-semibold text-gray-900">{assignment.product}</span>
                            </div>
                            {assignment.isRemaining && (
                              <span className="text-xs text-yellow-700 italic">Remaining Allocation</span>
                            )}
                          </div>
                          <span className="text-xs font-medium px-2 py-1 rounded-full bg-emerald-100 text-emerald-800 capitalize">
                            {assignment.entityType}
                          </span>
                        </div>

                        <div className="space-y-2 text-sm">
                          <div className="flex items-center gap-2">
                            <User className="w-4 h-4 text-gray-400 flex-shrink-0" />
                            <span className="text-gray-900">{assignment.location}</span>
                          </div>
                          <div className="flex items-start gap-2">
                            <MapPin className="w-4 h-4 text-gray-400 flex-shrink-0 mt-0.5" />
                            <span className="text-gray-600 text-xs">{assignment.address}</span>
                          </div>
                          <div className="flex justify-between items-center pt-2 border-t border-gray-200">
                            <span className="text-gray-700">{assignment.quantity} kg</span>
                          </div>
                          <div className="pt-2">
                            <label className="block text-xs font-semibold text-gray-700 mb-1">Status</label>
                            <select
                              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
                              value={assignmentStatuses[assignment.routeId] || ''}
                              onChange={(e) => setAssignmentStatuses(prev => ({ ...prev, [assignment.routeId]: e.target.value }))}
                            >
                              <option value="">Select...</option>
                              <option value="completed">Completed</option>
                              <option value="Drop">Drop</option>
                              <option value="Picked and Packed">Picked and Packed</option>
                            </select>
                            {assignmentStatuses[assignment.routeId] === 'Drop' && (
                              <div className="mt-2 space-y-2">
                                <select
                                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
                                  value={assignmentStatuses[`${assignment.routeId}-collection`] || ''}
                                  onChange={(e) => setAssignmentStatuses(prev => ({ ...prev, [`${assignment.routeId}-collection`]: e.target.value }))}
                                >
                                  <option value="">Collection status...</option>
                                  <option value="Collection">Collection</option>
                                </select>
                                <select
                                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
                                  value={assignmentStatuses[`${assignment.routeId}-dropDriver`] || ''}
                                  onChange={(e) => setAssignmentStatuses(prev => ({ ...prev, [`${assignment.routeId}-dropDriver`]: e.target.value }))}
                                >
                                  <option value="">Select driver...</option>
                                    {assignmentOptions.drivers && sortDropdownObjects(assignmentOptions.drivers, (driver) => driver.driver_name).map(driver => (
                                    <option key={`driver-${driver.did}`} value={`${driver.driver_name} - ${driver.driver_id}`}>
                                      {driver.driver_name} - {driver.driver_id}
                                    </option>
                                  ))}
                                </select>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Summary Stats */}
          <div className="bg-white rounded-xl shadow-sm p-6 mt-6">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-lg p-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-blue-600 rounded-lg">
                    <Package className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <p className="text-xs text-gray-600">Total Collections</p>
                    <p className="text-lg font-bold text-gray-900">
                      {deliveryRoutes.filter(route => route.driver).length}
                    </p>
                  </div>
                </div>
              </div>
              <div className="bg-gradient-to-br from-purple-50 to-purple-100 rounded-lg p-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-purple-600 rounded-lg">
                    <Truck className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <p className="text-xs text-gray-600">Drivers Assigned</p>
                    <p className="text-lg font-bold text-gray-900">{groupedDriverAssignments.length}</p>
                  </div>
                </div>
              </div>
              <div className="bg-gradient-to-br from-emerald-50 to-emerald-100 rounded-lg p-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-emerald-600 rounded-lg">
                    <Check className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <p className="text-xs text-gray-600">Total Weight</p>
                    <p className="text-lg font-bold text-gray-900">
                      {deliveryRoutes
                        .filter(route => route.driver)
                        .reduce((total, route) => total + (parseFloat(route.quantity) || 0), 0)
                        .toFixed(2)} kg
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex flex-col sm:flex-row justify-end gap-3">
        <button
          onClick={() => navigate('/order-assign')}
          className="px-6 py-3 border-2 border-gray-300 text-gray-700 rounded-lg font-medium hover:bg-gray-50 transition-colors"
        >
          Cancel
        </button>
        <button onClick={handleSaveStage1} className="px-6 py-3 bg-emerald-600 text-white rounded-lg font-medium shadow-sm hover:bg-emerald-700 transition-colors">
          Save Assignment
        </button>
      </div>
    </div>
  );
};

export default LocalOrderAssign;