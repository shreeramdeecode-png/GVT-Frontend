import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation, useParams } from 'react-router-dom';
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
import { sortDropdownObjects } from '../../../utils/dropdownSort';
import { getVegetableAvailabilityByFarmer } from '../../../api/vegetableAvailabilityApi';

const OrderAssignCreateStage1 = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { id } = useParams();
  const orderData = location.state?.orderData;
  const hasLoadedData = useRef(false); // Track if data has been loaded to prevent infinite loop
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
  const [orderType, setOrderType] = useState('Local Grade');
  const [assignmentStatuses, setAssignmentStatuses] = useState({});
  const [availableStock, setAvailableStock] = useState({});
  const [farmerAvailability, setFarmerAvailability] = useState({});
  const [isBoxBasedOrder, setIsBoxBasedOrder] = useState(false); // Track if order was created with boxes
  const [stage1Status, setStage1Status] = useState(null); // Store stage1_status from assignment data
  
  // Refs for keyboard navigation
  const inputGridRefs = useRef({});

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
      if (assignmentOptions.farmers.length === 0) return;

      const availabilityMap = {};
      const today = new Date().toISOString().split('T')[0];

      for (const farmer of assignmentOptions.farmers) {
        try {
          const response = await getVegetableAvailabilityByFarmer(farmer.fid);
          if (response.success && response.data) {
            availabilityMap[farmer.fid] = response.data.filter(item => {
              const fromDate = item.from_date;
              const toDate = item.to_date;
              return item.status === 'Available' && fromDate <= today && toDate >= today;
            });
          }
        } catch (error) {
          console.error(`Error fetching availability for farmer ${farmer.fid}:`, error);
        }
      }

      setFarmerAvailability(availabilityMap);
    };

    fetchFarmerAvailability();
  }, [assignmentOptions.farmers]);

  // Update isBoxBasedOrder when orderDetails changes
  useEffect(() => {
    if (orderDetails?.items?.length > 0) {
      // Determine if order was created with boxes or net weight
      const firstItem = orderDetails.items[0];
      const hasBoxes = firstItem.num_boxes && parseInt(firstItem.num_boxes) > 0;
      setIsBoxBasedOrder(hasBoxes);
    }
  }, [orderDetails]);

  // Reset hasLoadedData when order ID changes
  useEffect(() => {
    hasLoadedData.current = false;
  }, [id]);

  // Handle arrow key navigation between inputs
  const handleKeyDown = (e, rowIndex, colIndex, totalRows) => {
    const arrowKeys = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'];
    if (!arrowKeys.includes(e.key)) return;

    e.preventDefault();
    
    // Column mapping: 0=Entity Type, 1=Name, 2=Place, 3=Picked Qty/Boxes
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

  // Update product count for a main row (used when Product Count toggle is ON)
  const handleProductCountChange = (rowIndex, value) => {
    setProductRows(prev => {
      const updated = [...prev];
      if (!updated[rowIndex]) return prev;
      updated[rowIndex] = { ...updated[rowIndex], productCount: value };
      return updated;
    });
  };

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
      assignedBoxes: parseInt(row.assignedBoxes) || 0,
      net_weight: parseFloat(row.net_weight) || 0,
      oiid: row.id,
      entityType,
      entityId,
      driver: '',
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
    // Prevent infinite loop by checking if data has already been loaded for this order
    if (hasLoadedData.current) {
      return;
    }

    const loadAssignmentData = async () => {
      try {
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

        // Extract labours from nested structure
        let labours = [];
        let allAttendance = [];
        if (laboursRes.data?.data) {
          allAttendance = laboursRes.data.data;
        } else if (Array.isArray(laboursRes.data)) {
          allAttendance = laboursRes.data;
        } else if (laboursRes.data) {
          allAttendance = [laboursRes.data];
        }

        if (allAttendance.length > 0 && allAttendance[0].labours) {
          labours = allAttendance[0].labours.filter(labour =>
            labour.attendance_status && labour.attendance_status.toLowerCase() === 'present'
          );
        }

        const drivers = driversRes.data?.map(record => record.driver).filter(d => d) || [];

        setAssignmentOptions({
          farmers: sortDropdownObjects(farmers, (f) => f.farmer_name),
          suppliers: sortDropdownObjects(suppliers, (s) => s.supplier_name),
          thirdParties: sortDropdownObjects(thirdParties, (tp) => tp.third_party_name),
          labours: sortDropdownObjects(labours, (l) => l.full_name),
          drivers: sortDropdownObjects(drivers, (d) => d.driver_name)
        });

        try {
          const assignmentResponse = await getOrderAssignment(id);
          const assignmentData = assignmentResponse.data;

          if (assignmentData.order_auto_id) {
            setOrderDetails(prev => ({ ...prev, order_auto_id: assignmentData.order_auto_id }));
          }

          if (assignmentData.order_type) {
            setOrderType(assignmentData.order_type);
          }

          // Store stage1_status from assignment data
          if (assignmentData.stage1_status) {
            setStage1Status(assignmentData.stage1_status);
          }

          // Load delivery routes if they exist
          let savedDeliveryRoutes = [];
          if (assignmentData.delivery_routes) {
            try {
              savedDeliveryRoutes = typeof assignmentData.delivery_routes === 'string'
                ? JSON.parse(assignmentData.delivery_routes)
                : assignmentData.delivery_routes;
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
            hasLoadedData.current = true; // Mark as loaded even if no items
            return;
          }

          if (items.length > 0) {
            const rows = items.map((item) => {
              let currentPrice = 0;
              const rawProductName = (item.product_name || item.product || '').replace(/^\d+\s*-\s*/, '').trim();
              const matchedProduct = allProductsList.find(p =>
                p.product_name?.toLowerCase() === rawProductName.toLowerCase()
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
                place: '',
                hasProductCount,
                productCount: ''
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
                row.assignedBoxes = parseInt(firstAssignment.assignedBoxes) || 0;
                row.price = parseFloat(firstAssignment.price) || 0;
                row.place = firstAssignment.place || '';
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
                  route.labour = savedRoute?.labour || '';
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
                      assignedBoxes: parseInt(assignment.assignedBoxes) || 0,
                      price: parseFloat(assignment.price) || 0,
                      marketPrice: row.marketPrice,
                      tapeColor: assignment.tapeColor || entity?.tape_color || '',
                      place: assignment.place || '',
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
                      route.assignedBoxes = parseInt(assignment.assignedBoxes) || 0;
                      // Find matching saved route to get driver and labour info
                      const savedRoute = savedDeliveryRoutes.find(sr => {
                        const srRouteId = sr.routeId || '';
                        return srRouteId.includes(`${route.entityId}-${row.id}-remaining`);
                      });
                      route.driver = savedRoute?.driver || assignment.driver || '';
                      route.labour = savedRoute?.labour || assignment.labour || '';
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

            // Load assignment statuses from summaryData
            const loadedStatuses = {};
            const summaryDataField = assignmentData.summary_data || assignmentData.summaryData || assignmentData.stage1_summary_data;

            if (summaryDataField) {
              try {
                const summaryData = typeof summaryDataField === 'string'
                  ? JSON.parse(summaryDataField)
                  : summaryDataField;

                if (summaryData?.driverAssignments) {
                  summaryData.driverAssignments.forEach(driverGroup => {
                    driverGroup.assignments.forEach(assignment => {
                      const assignmentOiid = String(assignment.oiid).split('-remaining')[0];

                      const matchingRoute = loadedDeliveryRoutes.find(route => {
                        const entityMatches = route.entityType === assignment.entityType && route.location === assignment.entityName;
                        const oiidMatches = String(route.oiid) === assignmentOiid;
                        const remainingMatches = route.isRemaining === (assignment.isRemaining || false);
                        return entityMatches && oiidMatches && remainingMatches;
                      });

                      if (matchingRoute) {
                        if (assignment.status) loadedStatuses[matchingRoute.routeId] = assignment.status;
                        if (assignment.dropDriver) loadedStatuses[`${matchingRoute.routeId}-dropDriver`] = assignment.dropDriver;
                        if (assignment.collectionStatus) loadedStatuses[`${matchingRoute.routeId}-collection`] = assignment.collectionStatus;
                      }
                    });
                  });
                }
              } catch (e) {
                console.error('Error parsing summary_data:', e);
              }
            }
            setAssignmentStatuses(loadedStatuses);
          }

          // Mark as loaded after successful data load
          hasLoadedData.current = true;
        } catch (assignmentError) {
          console.error('Error loading assignment data:', assignmentError);
          await initializeFromOrderItems();
          hasLoadedData.current = true; // Mark as loaded even on error
        }
      } catch (error) {
        console.error('Error loading assignment data:', error);
        await initializeFromOrderItems();
        hasLoadedData.current = true; // Mark as loaded even on error
      }
    };

    loadAssignmentData();
  }, [id]); // Only depend on 'id', not 'orderDetails'


  const initializeFromOrderItems = async () => {
    let items = [];
    if (orderDetails && orderDetails.items) {
      items = orderDetails.items;
    }

    let allProductsList = [];
    try {
      const productsRes = await getAllProducts(1, 1000);
      allProductsList = productsRes.success ? productsRes.data || [] : [];
    } catch (error) {
      console.error('Error fetching products:', error);
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
          place: ''
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

      grouped[route.driver].assignments.push(route);
    });

    return Object.values(grouped);
  };

  const handleSaveStage1 = async () => {
    try {
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

      // Merge main assignments and remaining assignments
      const mergedAssignments = productRows.map(row => ({
        ...row,
        entityId: getEntityId(row.entityType, row.assignedTo),
        address: row.addressInfo || ''
      }));

      Object.entries(remainingRowAssignments).forEach(([key, remainingData]) => {
        if (remainingData.assignedTo && (remainingData.assignedQty || remainingData.assignedBoxes)) {
          const originalId = key.split('-remaining')[0];
          const originalIndex = mergedAssignments.findIndex(row => row.id == originalId);

          if (originalIndex !== -1) {
            mergedAssignments.push({
              ...mergedAssignments[originalIndex],
              id: originalId,
              assignedTo: remainingData.assignedTo,
              entityType: remainingData.entityType,
              entityId: getEntityId(remainingData.entityType, remainingData.assignedTo),
              assignedQty: remainingData.assignedQty || 0,
              assignedBoxes: remainingData.assignedBoxes || 0,
              price: remainingData.price || 0,
              tapeColor: remainingData.tapeColor || '',
              place: remainingData.place || '',
              address: remainingData.addressInfo || ''
            });
          }
        }
      });

      // Add driver, labour, and status information to delivery routes
      const routesWithDrivers = deliveryRoutes.map(route => {
        const status = assignmentStatuses[route.routeId] || '';
        const dropDriver = assignmentStatuses[`${route.routeId}-dropDriver`] || '';
        const collectionStatus = assignmentStatuses[`${route.routeId}-collection`] || '';

        return {
          ...route,
          driver: route.driver || '',
          labour: route.labour || '',
          status: status,
          dropDriver: dropDriver,
          collectionStatus: collectionStatus
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
            const status = assignmentStatuses[a.routeId] || 'pending';
            const dropDriver = assignmentStatuses[`${a.routeId}-dropDriver`] || '';
            const collectionStatus = assignmentStatuses[`${a.routeId}-collection`] || '';

            // For remaining assignments, include the full oiid with -remaining-X suffix
            let summaryOiid = a.oiid;
            if (a.isRemaining) {
              // Extract the index from routeId (e.g., 'supplier-1-3-remaining-0' -> '0')
              const routeIdParts = a.routeId.split('-remaining-');
              if (routeIdParts.length > 1) {
                summaryOiid = `${a.oiid}-remaining-${routeIdParts[1]}`;
              }
            }

            return {
              product: a.product,
              entityType: a.entityType,
              entityName: a.location,
              address: a.address,
              quantity: parseFloat(a.quantity),
              labour: a.labour || '',
              isRemaining: a.isRemaining || false,
              oiid: summaryOiid,
              status: status,
              dropDriver: dropDriver,
              collectionStatus: collectionStatus
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

      const stage1Data = {
        orderType: orderType,
        productAssignments: mergedAssignments,
        deliveryRoutes: routesWithDrivers,
        summaryData: summaryData
      };

      // console.log('Saving Stage 1 with data:', JSON.stringify(stage1Data, null, 2));

      const response = await updateStage1Assignment(id, stage1Data);
      // console.log('Stage 1 saved:', response);

      // Check if excess stock was created
      const hasExcessStock = mergedAssignments.some(assignment => {
        const originalId = String(assignment.id).split('-remaining')[0];
        const orderItem = orderDetails?.items?.find(item => item.oiid == originalId);
        if (orderItem) {
          const quantityNeeded = parseFloat(orderItem.net_weight) || 0;
          const pickedQty = parseFloat(assignment.assignedQty) || 0;
          return pickedQty > quantityNeeded;
        }
        return false;
      });
      alert('Stage 1 saved successfully!');
      navigate(`/order-assign/stage2/${id}`, { state: { orderData: orderDetails } });
    } catch (error) {
      console.error('Error saving stage 1:', error);
      alert('Failed to save stage 1 assignment. Please try again.');
    }
  };

  // Create display rows with remaining quantities as separate rows
  const getDisplayRows = () => {
    const displayRows = [];

    productRows.forEach((row, index) => {
      displayRows.push({
        ...row,
        displayIndex: index,
        isRemaining: false
      });

      // Calculate total remaining quantity and boxes
      const assignedQty = parseFloat(row.assignedQty) || 0;
      const assignedBoxes = parseInt(row.assignedBoxes) || 0;
      const totalBoxes = parseInt(row.num_boxes) || 0;
      const hasRemainingQty = assignedQty > 0 && assignedQty < row.net_weight;
      const hasRemainingBoxes = assignedBoxes > 0 && assignedBoxes < totalBoxes;

      if (hasRemainingQty || hasRemainingBoxes) {
        // For box-based orders, calculate remaining weight based on remaining boxes
        let remainingQty = 0;
        let remainingBoxes = 0;

        if (isBoxBasedOrder && hasRemainingBoxes) {
          remainingBoxes = totalBoxes - assignedBoxes;
          // Calculate remaining weight proportionally based on remaining boxes
          remainingQty = totalBoxes > 0 ? (remainingBoxes / totalBoxes) * row.net_weight : 0;
        } else if (hasRemainingQty) {
          remainingQty = row.net_weight - assignedQty;
        }

        // Collect all remaining assignments for this product
        const remainingKeys = Object.keys(remainingRowAssignments)
          .filter(k => k.startsWith(`${row.id}-remaining`))
          .sort();

        // Display existing remaining assignments
        remainingKeys.forEach(key => {
          const data = remainingRowAssignments[key];
          const assignedQty = parseFloat(data.assignedQty) || 0;
          const assignedBoxes = parseFloat(data.assignedBoxes) || 0;

          // Show the actual remaining needed, not the picked quantity
          const displayQty = remainingQty > 0 ? remainingQty : 0;
          const displayBoxes = remainingBoxes > 0 ? remainingBoxes : 0;

          displayRows.push({
            id: key,
            product: row.product,
            product_name: row.product_name,
            quantity: `${displayQty} kg`,
            net_weight: displayQty,
            num_boxes: displayBoxes,
            assignedTo: data.assignedTo || '',
            entityType: data.entityType || '',
            marketPrice: data.marketPrice || row.marketPrice || 0,
            assignedQty: assignedQty,
            assignedBoxes: assignedBoxes,
            price: parseFloat(data.price) || 0,
            place: data.place || '',
            canEdit: true,
            displayIndex: index,
            isRemaining: true,
            originalRowIndex: index
          });

          // Deduct only up to the remaining quantity (excess goes to stock)
          if (assignedQty > 0) {
            remainingQty = Math.max(0, remainingQty - assignedQty);
          }
          if (assignedBoxes > 0) {
            remainingBoxes = Math.max(0, remainingBoxes - assignedBoxes);
            // Recalculate remaining weight proportionally for box-based orders
            if (isBoxBasedOrder && totalBoxes > 0) {
              remainingQty = (remainingBoxes / totalBoxes) * row.net_weight;
            }
          }
        });

        // Add a new row for unassigned remaining quantity if there's still quantity left
        const allRemainingHaveData = remainingKeys.length === 0 ||
          remainingKeys.every(k => {
            const data = remainingRowAssignments[k];
            return (parseFloat(data?.assignedQty) || 0) > 0 || (parseFloat(data?.assignedBoxes) || 0) > 0;
          });

        if (((remainingQty > 0 || remainingBoxes > 0) && allRemainingHaveData)) {
          const newRemainingKey = `${row.id}-remaining-${remainingKeys.length}`;
          const remainingData = remainingRowAssignments[newRemainingKey] || {};

          displayRows.push({
            id: newRemainingKey,
            product: row.product,
            product_name: row.product_name,
            quantity: `${remainingQty} kg`,
            net_weight: remainingQty,
            num_boxes: remainingBoxes,
            assignedTo: remainingData.assignedTo || '',
            entityType: remainingData.entityType || '',
            marketPrice: remainingData.marketPrice || row.marketPrice || 0,
            assignedQty: parseFloat(remainingData.assignedQty) || 0,
            assignedBoxes: parseFloat(remainingData.assignedBoxes) || 0,
            price: parseFloat(remainingData.price) || 0,
            place: remainingData.place || '',
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
                <td className="px-4 py-3 text-sm text-left text-gray-900">{orderDetails?.order_auto_id || id}</td>
                <td className="px-4 py-3 text-sm text-left text-gray-900">{orderDetails?.customer_name || 'N/A'}</td>
                <td className="px-4 py-3 text-sm text-left text-gray-900">{orderDetails?.items?.length || 0} Items</td>
                <td className="px-4 py-3">
                  <span className={`inline-block px-3 py-1 rounded-full text-xs font-medium ${
                    stage1Status === 'pending' ? 'bg-purple-100 text-purple-700' :
                    stage1Status === 'processing' ? 'bg-yellow-100 text-yellow-700' :
                    stage1Status === 'completed' ? 'bg-emerald-600 text-white' :
                    stage1Status === 'in_progress' ? 'bg-blue-100 text-blue-700' :
                    'bg-gray-100 text-gray-700'
                  }`}>
                    {stage1Status ? stage1Status.charAt(0).toUpperCase() + stage1Status.slice(1).replace('_', ' ') : (orderDetails?.order_status ? orderDetails.order_status.charAt(0).toUpperCase() + orderDetails.order_status.slice(1) : 'N/A')}
                  </span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Stage Tabs */}
      <div className="mb-6 flex flex-col sm:flex-row gap-3">
        <button className="px-6 py-3 bg-emerald-600 text-white rounded-lg font-medium shadow-sm hover:bg-emerald-700 transition-colors">
          Stage 1: Product Collection
        </button>
        <button
          onClick={() => navigate(`/order-assign/stage2/${id}`, { state: { orderData: orderDetails } })}
          className="px-6 py-3 bg-gray-100 text-gray-600 rounded-lg font-medium hover:bg-gray-200 transition-colors"
        >
          Stage 2: Packaging
        </button>
        <button
          onClick={() => navigate(`/order-assign/stage3/${id}`, { state: { orderData: orderDetails } })}
          className="px-6 py-3 bg-gray-100 text-gray-600 rounded-lg font-medium hover:bg-gray-200 transition-colors"
        >
          Stage 3: Delivery
        </button>
        <button
          onClick={() => navigate(`/order-assign/stage4/${id}`, { state: { orderData: orderDetails } })}
          className="px-6 py-3 bg-gray-100 text-gray-600 rounded-lg font-medium hover:bg-gray-200 transition-colors"
        >
          Stage 4: Review
        </button>
      </div>

      {/* Stage 1 Section */}
      <div className="bg-white rounded-xl shadow-sm p-6 mb-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-2">Stage 1: Product Collection from Sources</h2>
        <p className="text-sm text-gray-600 mb-6">Assign order products to farmers, suppliers, and third parties for collection and delivery to packaging location</p>

        {/* Product Table - Desktop */}
        <div className="hidden lg:block overflow-x-auto">
          {(() => {
            const displayRows = getDisplayRows();
            return (
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Product</th>
                    {isBoxBasedOrder && <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Needed No of Boxes/Bags</th>}
                    {isBoxBasedOrder && <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Needed Weight (kg)</th>}
                    {!isBoxBasedOrder && <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Quantity Needed</th>}
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Count</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Entity Type <span className="text-red-500">*</span></th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Name <span className="text-red-500">*</span></th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Address</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Entity Stock</th>
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
                    {isBoxBasedOrder && (
                      <td className="px-4 py-4">
                        <span className="text-sm text-gray-900">{row.net_weight !== undefined && row.net_weight !== null ? `${row.net_weight} kg` : '-'}</span>
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
                                assignedQty: prev[row.id]?.assignedQty || 0,
                                place: prev[row.id]?.place || ''
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

                            if (selectedEntity && (updatedRows[targetIndex].assignedQty > 0 || updatedRows[targetIndex].assignedBoxes > 0)) {
                              const route = createDeliveryRoute(selectedEntity, row.entityType, updatedRows[targetIndex], updatedRows[targetIndex].assignedQty, false);
                              updateDeliveryRoute(route);
                            }
                          }
                        }}
                      >
                        <option value="">Select name...</option>
                        {row.entityType === 'farmer' && sortDropdownObjects(assignmentOptions.farmers, (farmer) => farmer.farmer_name).filter(farmer => {
                          const availability = farmerAvailability[farmer.fid] || [];
                          return availability.some(item => item.vegetable_name === productName);
                        }).map(farmer => (
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
                    <td className="px-4 py-4">
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
                                <div className="px-2 py-1 bg-emerald-100 text-emerald-700 rounded-full text-xs font-medium">
                                  Available
                                </div>
                              )}
                            </>
                          );
                        })()}
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
                          placeholder="0"
                          onKeyDown={(e) => handleKeyDown(e, index, 3, displayRows.length)}
                          onChange={(e) => {
                            const newBoxes = e.target.value;
                            if (row.isRemaining) {
                              setRemainingRowAssignments(prev => ({
                                ...prev,
                                [row.id]: { ...prev[row.id], assignedBoxes: newBoxes }
                              }));

                              if (row.assignedTo && row.entityType) {
                                const entity = row.entityType === 'farmer'
                                  ? assignmentOptions.farmers.find(f => f.farmer_name === row.assignedTo)
                                  : row.entityType === 'supplier'
                                    ? assignmentOptions.suppliers.find(s => s.supplier_name === row.assignedTo)
                                    : assignmentOptions.thirdParties.find(tp => tp.third_party_name === row.assignedTo);

                                if (entity) {
                                  // Create updated row with new assignedBoxes value
                                  const updatedRow = { ...row, assignedBoxes: newBoxes };
                                  const route = createDeliveryRoute(entity, row.entityType, updatedRow, row.assignedQty, true);
                                  route.routeId = `${row.entityType}-${entity.fid || entity.sid || entity.tpid}-${row.id}`;
                                  updateDeliveryRoute(route);
                                }
                              }
                            } else {
                              const updatedRows = [...productRows];
                              updatedRows[row.displayIndex].assignedBoxes = newBoxes;
                              setProductRows(updatedRows);

                              if (row.assignedTo && row.entityType) {
                                const entity = row.entityType === 'farmer'
                                  ? assignmentOptions.farmers.find(f => f.farmer_name === row.assignedTo)
                                  : row.entityType === 'supplier'
                                    ? assignmentOptions.suppliers.find(s => s.supplier_name === row.assignedTo)
                                    : assignmentOptions.thirdParties.find(tp => tp.third_party_name === row.assignedTo);

                                if (entity) {
                                  const route = createDeliveryRoute(entity, row.entityType, updatedRows[row.displayIndex], updatedRows[row.displayIndex].assignedQty, false);
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
                          placeholder="0"
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
            );
          })()}
        </div>

        {/* Product Cards - Mobile */}
        <div className="lg:hidden space-y-4">
          {(() => {
            const displayRows = getDisplayRows();
            return displayRows.map((row, index) => {
            const productName = (row.product_name || row.product)?.replace(/^\d+\s*-\s*/, '');
            const stockQty = availableStock[productName] || 0;

            return (
              <div key={row.id} className={`border rounded-lg p-4 ${row.isRemaining ? 'bg-yellow-50 border-yellow-200' : 'bg-white border-gray-200'}`}>
                <div className="flex justify-between items-start mb-3">
                  <div className="flex-1">
                    <h3 className="font-semibold text-gray-900">{productName}</h3>
                    {row.isRemaining && (
                      <span className="text-xs text-yellow-700 italic">Remaining Quantity</span>
                    )}
                    <p className="text-sm text-gray-600">{row.quantity}</p>
                    <p className="text-xs text-gray-500 mt-1">Boxes/Bags: {row.num_boxes || '-'}</p>
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
                              price: prev[row.id]?.price || 0,
                              place: prev[row.id]?.place || ''
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
                      {row.entityType === 'farmer' && sortDropdownObjects(assignmentOptions.farmers, (farmer) => farmer.farmer_name).filter(farmer => {
                        const availability = farmerAvailability[farmer.fid] || [];
                        return availability.some(item => item.vegetable_name === productName);
                      }).map(farmer => (
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
                        ref={(el) => {
                          if (el) inputGridRefs.current[`mobile-${index}-3`] = el;
                        }}
                        type="text"
                        value={row.assignedQty || ''}
                        placeholder="0"
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
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-gray-700 mb-1">
                        Picked Boxes/Bags
                      </label>
                      <input
                        ref={(el) => {
                          if (el) inputGridRefs.current[`mobile-${index}-3`] = el;
                        }}
                        type="text"
                        value={row.assignedBoxes || ''}
                        placeholder="0"
                        onKeyDown={(e) => handleKeyDown(e, index, 3, displayRows.length)}
                        onChange={(e) => {
                          const newBoxes = e.target.value;
                          if (row.isRemaining) {
                            setRemainingRowAssignments(prev => ({
                              ...prev,
                              [row.id]: { ...prev[row.id], assignedBoxes: newBoxes }
                            }));

                            if (row.assignedTo && row.entityType) {
                              const entity = row.entityType === 'farmer'
                                ? assignmentOptions.farmers.find(f => f.farmer_name === row.assignedTo)
                                : row.entityType === 'supplier'
                                  ? assignmentOptions.suppliers.find(s => s.supplier_name === row.assignedTo)
                                  : assignmentOptions.thirdParties.find(tp => tp.third_party_name === row.assignedTo);

                              if (entity) {
                                const route = createDeliveryRoute(entity, row.entityType, row, row.assignedQty, true);
                                route.routeId = `${row.entityType}-${entity.fid || entity.sid || entity.tpid}-${row.id}`;
                                updateDeliveryRoute(route);
                              }
                            }
                          } else {
                            const updatedRows = [...productRows];
                            updatedRows[row.displayIndex].assignedBoxes = newBoxes;
                            setProductRows(updatedRows);

                            if (row.assignedTo && row.entityType) {
                              const entity = row.entityType === 'farmer'
                                ? assignmentOptions.farmers.find(f => f.farmer_name === row.assignedTo)
                                : row.entityType === 'supplier'
                                  ? assignmentOptions.suppliers.find(s => s.supplier_name === row.assignedTo)
                                  : assignmentOptions.thirdParties.find(tp => tp.third_party_name === row.assignedTo);

                              if (entity) {
                                const route = createDeliveryRoute(entity, row.entityType, updatedRows[row.displayIndex], updatedRows[row.displayIndex].assignedQty, false);
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
          });
          })()}
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
                {isBoxBasedOrder && <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Weight (kg)</th>}
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
                      <span className="text-sm text-gray-900">{route.assignedBoxes !== undefined && route.assignedBoxes !== null ? route.assignedBoxes : '-'}</span>
                    </td>
                  )}
                  {isBoxBasedOrder && (
                    <td className="px-4 py-4">
                      <span className="text-sm text-gray-900">
                        {route.net_weight !== undefined && route.net_weight !== null
                          ? `${route.net_weight} kg`
                          : (route.quantity !== undefined && route.quantity !== null ? `${route.quantity} kg` : '-')}
                      </span>
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
                    <div className="relative">
                      <button
                        type="button"
                        onClick={() => {
                          const updatedRoutes = [...deliveryRoutes];
                          updatedRoutes[index].labourDropdownOpen = !updatedRoutes[index].labourDropdownOpen;
                          setDeliveryRoutes(updatedRoutes);
                        }}
                        className="min-w-[140px] w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none text-left flex items-center justify-between bg-white hover:bg-gray-50"
                      >
                        <span className="truncate">
                          {route.labour && (Array.isArray(route.labour) && route.labour.length > 0)
                            ? `${route.labour.length} labour${route.labour.length > 1 ? 's' : ''} selected`
                            : 'Select labour...'}
                        </span>
                        <ChevronDown className="w-4 h-4 text-gray-400 flex-shrink-0 ml-2" />
                      </button>

                      {route.labourDropdownOpen && (
                        <>
                          <div
                            className="fixed inset-0 z-10"
                            onClick={() => {
                              const updatedRoutes = [...deliveryRoutes];
                              updatedRoutes[index].labourDropdownOpen = false;
                              setDeliveryRoutes(updatedRoutes);
                            }}
                          />
                          <div className={`absolute z-20 w-full bg-white border border-gray-300 rounded-lg shadow-lg max-h-60 overflow-y-auto ${index >= deliveryRoutes.length - 2 ? 'bottom-full mb-1' : 'top-full mt-1'}`}>
                            {assignmentOptions.labours && Array.isArray(assignmentOptions.labours) && sortDropdownObjects(assignmentOptions.labours, (labour) => labour.full_name).map(labour => {
                              const isSelected = route.labour && (Array.isArray(route.labour) ? route.labour.includes(labour.full_name) : route.labour === labour.full_name);
                              return (
                                <label
                                  key={`labour-${labour.lid}`}
                                  className="flex items-center px-3 py-2 hover:bg-gray-50 cursor-pointer"
                                >
                                  <input
                                    type="checkbox"
                                    checked={isSelected}
                                    onChange={(e) => {
                                      const updatedRoutes = [...deliveryRoutes];
                                      let currentLabours = route.labour ? (Array.isArray(route.labour) ? [...route.labour] : [route.labour]) : [];

                                      if (e.target.checked) {
                                        if (!currentLabours.includes(labour.full_name)) {
                                          currentLabours.push(labour.full_name);
                                        }
                                      } else {
                                        currentLabours = currentLabours.filter(l => l !== labour.full_name);
                                      }

                                      updatedRoutes[index].labour = currentLabours;
                                      setDeliveryRoutes(updatedRoutes);
                                    }}
                                    className="w-4 h-4 text-emerald-600 border-gray-300 rounded focus:ring-emerald-500"
                                  />
                                  <span className="ml-2 text-sm text-gray-700">{labour.full_name}</span>
                                </label>
                              );
                            })}
                          </div>
                        </>
                      )}
                    </div>
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
                  <div className="relative">
                    <button
                      type="button"
                      onClick={() => {
                        const updatedRoutes = [...deliveryRoutes];
                        updatedRoutes[index].labourDropdownOpen = !updatedRoutes[index].labourDropdownOpen;
                        setDeliveryRoutes(updatedRoutes);
                      }}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none text-left flex items-center justify-between bg-white hover:bg-gray-50"
                    >
                      <span className="truncate">
                        {route.labour && (Array.isArray(route.labour) && route.labour.length > 0)
                          ? `${route.labour.length} labour${route.labour.length > 1 ? 's' : ''} selected`
                          : 'Select labour...'}
                      </span>
                      <ChevronDown className="w-4 h-4 text-gray-400 flex-shrink-0 ml-2" />
                    </button>

                    {route.labourDropdownOpen && (
                      <>
                        <div
                          className="fixed inset-0 z-10"
                          onClick={() => {
                            const updatedRoutes = [...deliveryRoutes];
                            updatedRoutes[index].labourDropdownOpen = false;
                            setDeliveryRoutes(updatedRoutes);
                          }}
                        />
                        <div className={`absolute z-20 w-full bg-white border border-gray-300 rounded-lg shadow-lg max-h-60 overflow-y-auto ${index >= deliveryRoutes.length - 2 ? 'bottom-full mb-1' : 'top-full mt-1'}`}>
                          {assignmentOptions.labours && Array.isArray(assignmentOptions.labours) && sortDropdownObjects(assignmentOptions.labours, (labour) => labour.full_name).map(labour => {
                            const isSelected = route.labour && (Array.isArray(route.labour) ? route.labour.includes(labour.full_name) : route.labour === labour.full_name);
                            return (
                              <label
                                key={`labour-mobile-${labour.lid}`}
                                className="flex items-center px-3 py-2 hover:bg-gray-50 cursor-pointer"
                              >
                                <input
                                  type="checkbox"
                                  checked={isSelected}
                                  onChange={(e) => {
                                    const updatedRoutes = [...deliveryRoutes];
                                    let currentLabours = route.labour ? (Array.isArray(route.labour) ? [...route.labour] : [route.labour]) : [];

                                    if (e.target.checked) {
                                      if (!currentLabours.includes(labour.full_name)) {
                                        currentLabours.push(labour.full_name);
                                      }
                                    } else {
                                      currentLabours = currentLabours.filter(l => l !== labour.full_name);
                                    }

                                    updatedRoutes[index].labour = currentLabours;
                                    setDeliveryRoutes(updatedRoutes);
                                  }}
                                  className="w-4 h-4 text-emerald-600 border-gray-300 rounded focus:ring-emerald-500"
                                />
                                <span className="ml-2 text-sm text-gray-700">{labour.full_name}</span>
                              </label>
                            );
                          })}
                        </div>
                      </>
                    )}
                  </div>
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
                <div key={groupIndex} className="bg-white rounded-lg shadow-sm overflow-visible border-2 border-emerald-300">
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
                          {isBoxBasedOrder && <th className="px-4 py-3 text-left text-xs font-bold text-gray-700 uppercase">Boxes/Bags</th>}
                          {isBoxBasedOrder && <th className="px-4 py-3 text-left text-xs font-bold text-gray-700 uppercase">Weight (kg)</th>}
                          {!isBoxBasedOrder && <th className="px-4 py-3 text-left text-xs font-bold text-gray-700 uppercase">Quantity</th>}
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
                            {isBoxBasedOrder && (
                              <td className="px-4 py-3">
                                <span className="text-sm font-semibold text-gray-900">{assignment.assignedBoxes !== undefined && assignment.assignedBoxes !== null ? assignment.assignedBoxes : '-'}</span>
                              </td>
                            )}
                            {isBoxBasedOrder && (
                              <td className="px-4 py-3">
                                <span className="text-sm font-semibold text-gray-900">
                                  {(() => {
                                    // Calculate weight based on picked boxes
                                    const assignedBoxes = assignment.assignedBoxes || 0;
                                    const totalWeight = assignment.net_weight || 0;
                                    // Find the original product row to get total boxes
                                    const productRow = productRows.find(r => r.product === assignment.product || r.product_name === assignment.product);
                                    const totalBoxes = productRow ? (productRow.num_boxes || 0) : 0;
                                    const calculatedWeight = totalBoxes > 0 ? (assignedBoxes / totalBoxes) * totalWeight : totalWeight;
                                    return calculatedWeight > 0 ? `${calculatedWeight.toFixed(2)} kg` : '-';
                                  })()}
                                </span>
                              </td>
                            )}
                            {!isBoxBasedOrder && (
                              <td className="px-4 py-3">
                                <span className="text-sm font-semibold text-gray-900">{assignment.quantity} kg</span>
                              </td>
                            )}
                            <td className="px-4 py-3">
                              <select
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
                                value={assignmentStatuses[assignment.routeId] || ''}
                                onChange={(e) => setAssignmentStatuses(prev => ({ ...prev, [assignment.routeId]: e.target.value }))}
                              >
                                <option value="">Select...</option>
                                <option value="Completed">Completed</option>
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
                                  {assignmentStatuses[`${assignment.routeId}-collection`] === 'Collection' && (
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
                                  )}
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
                <div key={groupIndex} className="bg-white rounded-lg shadow-sm overflow-visible border-2 border-emerald-300">
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
                            {isBoxBasedOrder && <span className="text-gray-700">{assignment.assignedBoxes || '-'} Boxes/Bags</span>}
                            {!isBoxBasedOrder && <span className="text-gray-700">{assignment.quantity} kg</span>}
                          </div>
                          <div className="pt-2">
                            <label className="block text-xs font-semibold text-gray-700 mb-1">Status</label>
                            <select
                              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
                              value={assignmentStatuses[assignment.routeId] || ''}
                              onChange={(e) => setAssignmentStatuses(prev => ({ ...prev, [assignment.routeId]: e.target.value }))}
                            >
                              <option value="">Select...</option>
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
                                {assignmentStatuses[`${assignment.routeId}-collection`] === 'Collection' && (
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
                                )}
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
                    <p className="text-xs text-gray-600">{isBoxBasedOrder ? 'Total Boxes/Bags' : 'Total Weight'}</p>
                    <p className="text-lg font-bold text-gray-900">
                      {isBoxBasedOrder
                        ? deliveryRoutes
                          .filter(route => route.driver)
                          .reduce((total, route) => total + (parseInt(route.assignedBoxes) || 0), 0)
                        : `${deliveryRoutes
                          .filter(route => route.driver)
                          .reduce((total, route) => total + (parseFloat(route.quantity) || 0), 0)
                          .toFixed(2)} kg`}
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
          Save Stage 1
        </button>
      </div>
    </div>
  );
};

export default OrderAssignCreateStage1;