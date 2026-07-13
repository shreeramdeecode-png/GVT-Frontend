import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation, useParams } from 'react-router-dom';
import { ChevronDown, Edit2, X, MapPin, Check, Package, Truck, User } from 'lucide-react';
import { getAssignmentOptions, updateStage1Assignment, getOrderAssignment, updateStage4Assignment } from '../../../api/orderAssignmentApi';
import { getOrderById } from '../../../api/orderApi';
import { getAllFarmers } from '../../../api/farmerApi';
import { getAllSuppliers } from '../../../api/supplierApi';
import { getAllThirdParties } from '../../../api/thirdPartyApi';
import { getAllLabours } from '../../../api/labourApi';
import { getPresentLaboursToday } from '../../../api/labourAttendanceApi';
import { getAllDrivers } from '../../../api/driverApi';
import { getAllProducts } from '../../../api/productApi';
import { getAvailableStock } from '../../../api/orderAssignmentApi';
import { getVegetableAvailabilityByFarmer } from '../../../api/vegetableAvailabilityApi';
import { sortDropdownObjects } from '../../../utils/dropdownSort';
import {
    filterFarmersByProductAvailability,
    filterActiveAvailabilityItems,
    getFarmerId,
} from './FlowerOrderAssignStage1';

const OrderAssignCreateStage4 = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const { id } = useParams();
    const orderData = location.state?.orderData;
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
    const [selectedType, setSelectedType] = useState('Box');
    const [assignmentStatuses, setAssignmentStatuses] = useState({});
    const [availableStock, setAvailableStock] = useState({});
    const [farmerAvailability, setFarmerAvailability] = useState({});
    const [farmerAvailabilityLoaded, setFarmerAvailabilityLoaded] = useState(false);
    const [isBoxBasedOrder, setIsBoxBasedOrder] = useState(false); // Track if order was created with boxes
    const [stage4Status, setStage4Status] = useState(null); // Store stage4_status from assignment data

    // Simple vertical navigation for Price inputs only
    const priceInputRefs = useRef({});

    const handlePriceArrowKey = (e, rowIndex, totalRows) => {
        const arrowKeys = ['ArrowUp', 'ArrowDown'];
        if (!arrowKeys.includes(e.key)) return;

        e.preventDefault();

        let nextRow = rowIndex;
        if (e.key === 'ArrowDown') {
            nextRow = Math.min(rowIndex + 1, totalRows - 1);
        } else if (e.key === 'ArrowUp') {
            nextRow = Math.max(rowIndex - 1, 0);
        }

        const refEntry = priceInputRefs.current[nextRow];
        // Support both single element and array of elements (desktop + mobile)
        const candidates = Array.isArray(refEntry) ? refEntry : [refEntry].filter(Boolean);
        const nextInput = candidates.find(el => el && el.offsetParent !== null) || candidates[0];

        if (nextInput) {
            nextInput.focus();
            if (nextInput.tagName === 'INPUT' && nextInput.select) {
                setTimeout(() => nextInput.select(), 0);
            }
        }
    };

    // Helper function to check if price was updated today
    const getTodaysMarketPrice = (product) => {
        if (!product?.price_date) return null;

        try {
            const priceData = typeof product.price_date === 'string'
                ? JSON.parse(product.price_date)
                : product.price_date;

            if (!Array.isArray(priceData)) return null;

            const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD format

            // Find today's price entry
            const todaysPrice = priceData.find(entry => {
                if (!entry.date) return false;
                const entryDate = new Date(entry.date).toISOString().split('T')[0];
                return entryDate === today;
            });

            return todaysPrice ? parseFloat(todaysPrice.price) : null;
        } catch (error) {
            console.error('Error parsing price_date:', error);
            return null;
        }
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

    // Update selectedType and isBoxBasedOrder when orderDetails changes
    useEffect(() => {
        if (orderDetails?.items?.length > 0) {
            const packing = orderDetails.items[0].packing_type || "";
            const hasWeight = /\d+\s*kg/i.test(packing);

            // Determine if order was created with boxes or net weight
            const firstItem = orderDetails.items[0];
            const hasBoxes = firstItem.num_boxes && parseInt(firstItem.num_boxes) > 0;
            setIsBoxBasedOrder(hasBoxes);

            if (hasWeight) {
                if (/box/i.test(packing)) {
                    setSelectedType("Box");
                    return;
                }
                if (/bag/i.test(packing)) {
                    setSelectedType("Bag");
                    return;
                }
            }
        }
        setSelectedType("Box");
    }, [orderDetails]);

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

                const rawDate = orderData?.order_received_date || orderData?.createdAt;
                const orderDate = rawDate ? new Date(rawDate).toISOString().split('T')[0] : undefined;

                const [farmersRes, suppliersRes, thirdPartiesRes, laboursRes, driversRes, productsRes] = await Promise.all([
                    getAllFarmers(),
                    getAllSuppliers(),
                    getAllThirdParties(),
                    getPresentLaboursToday(orderDate),
                    getAllDrivers(),
                    getAllProducts(1, 1000)
                ]);

                const allProductsList = productsRes.success ? productsRes.data || [] : [];

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

                const drivers = driversRes.data || [];

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

                    // Store stage4_status from assignment data
                    if (assignmentData.stage4_status) {
                        setStage4Status(assignmentData.stage4_status);
                    }

                    // Update orderDetails with order_auto_id from assignment data
                    if (assignmentData.order_auto_id && orderDetails) {
                        setOrderDetails(prev => ({
                            ...prev,
                            order_auto_id: assignmentData.order_auto_id
                        }));
                    }

                    if (assignmentData.collection_type) {
                        setSelectedType(assignmentData.collection_type);
                    }

                    if (assignmentData.order_type) {
                        setOrderType(assignmentData.order_type);
                    }

                    // Check if stage4_data exists and load from it
                    if (assignmentData.stage4_data) {
                        try {
                            const stage4Data = typeof assignmentData.stage4_data === 'string'
                                ? JSON.parse(assignmentData.stage4_data)
                                : assignmentData.stage4_data;

                            if (stage4Data.reviewData?.productRows) {
                                setProductRows(stage4Data.reviewData.productRows);
                            }

                            if (stage4Data.reviewData?.remainingRowAssignments) {
                                setRemainingRowAssignments(stage4Data.reviewData.remainingRowAssignments);
                            }

                            if (stage4Data.reviewData?.availableStock) {
                                setAvailableStock(stage4Data.reviewData.availableStock);
                            }

                            //console.log('Loaded from stage4_data');
                            return; // Exit early if stage4_data exists
                        } catch (e) {
                            console.error('Error parsing stage4_data:', e);
                        }
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
                        return;
                    }

                    if (items.length > 0) {
                        // Strip Tamil/non-ASCII parenthetical suffixes before name matching
                        // e.g. "BIG YAM (SATTI KARUNAI) (கருணைக்கிழங்கு)" → "BIG YAM (SATTI KARUNAI)"
                        const normalizeProductName = (s) =>
                            s.replace(/\s*\([^a-zA-Z0-9\s()]*\)\s*/g, ' ').toLowerCase().replace(/\s+/g, ' ').trim();

                        const rows = items.map((item) => {
                            let currentPrice = 0;
                            const productName = (item.product_name || item.product || '').replace(/^\d+\s*-\s*/, '').trim();
                            const matchedProduct = allProductsList.find(p =>
                                p.product_name?.toLowerCase() === productName.toLowerCase() ||
                                normalizeProductName(p.product_name || '') === normalizeProductName(productName)
                            );

                            if (matchedProduct) {
                                const todaysPrice = getTodaysMarketPrice(matchedProduct);
                                currentPrice = todaysPrice || 0;
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
                                place: '',
                                noOfPkgs: 0,
                                airportName: ''
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
                                row.price = firstAssignment.price ?? 0;
                                row.place = firstAssignment.place || '';

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
                                            price: assignment.price ?? 0,
                                            marketPrice: row.marketPrice,
                                            tapeColor: assignment.tapeColor || entity?.tape_color || '',
                                            place: assignment.place || ''
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

                        // Pull noOfPkgs and airportName from stage3_data so the price
                        // calculation only fires when airport and packages are both assigned.
                        if (assignmentData.stage3_data) {
                            try {
                                const stage3Data = typeof assignmentData.stage3_data === 'string'
                                    ? JSON.parse(assignmentData.stage3_data)
                                    : assignmentData.stage3_data;
                                const s3Map = {};
                                (stage3Data.products || []).forEach(p => {
                                    const key = String(p.oiid);
                                    if (!s3Map[key]) s3Map[key] = p;
                                });
                                rows.forEach(row => {
                                    const s3 = s3Map[String(row.id)];
                                    if (s3) {
                                        const pkgs = parseInt(s3.noOfPkgs) || 0;
                                        row.noOfPkgs = pkgs;
                                        row.assignedBoxes = String(pkgs);
                                        row.airportName = s3.airportName || '';
                                    }
                                });
                            } catch (e) {
                                console.error('Error reading stage3_data in stage4:', e);
                            }
                        }

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
                } catch (assignmentError) {
                    console.error('Error loading assignment data:', assignmentError);
                    await initializeFromOrderItems();
                }
            } catch (error) {
                console.error('Error loading assignment data:', error);
                await initializeFromOrderItems();
            }
        };

        loadAssignmentData();
    }, [id]); // eslint-disable-line react-hooks/exhaustive-deps

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
            const normalizeProductName = (s) =>
                s.replace(/\s*\([^a-zA-Z0-9\s()]*\)\s*/g, ' ').toLowerCase().replace(/\s+/g, ' ').trim();

            const rows = items.map((item) => {
                let currentPrice = 0;
                const productName = (item.product_name || item.product || '').replace(/^\d+\s*-\s*/, '').trim();
                const matchedProduct = allProductsList.find(p =>
                    p.product_name?.toLowerCase() === productName.toLowerCase() ||
                    normalizeProductName(p.product_name || '') === normalizeProductName(productName)
                );

                if (matchedProduct) {
                    const todaysPrice = getTodaysMarketPrice(matchedProduct);
                    currentPrice = todaysPrice || 0;
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

            // Merge main assignments and remaining assignments
            const mergedAssignments = productRows.map(row => ({
                ...row,
                entityId: getEntityId(row.entityType, row.assignedTo)
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
                            place: remainingData.place || ''
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
                driverAssignments: groupedDriverAssignments.map(group => ({
                    driver: group.driver,
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
                })),
                totalCollections: deliveryRoutes.filter(route => route.driver).length,
                totalDrivers: groupedDriverAssignments.length,
                totalWeight: parseFloat(deliveryRoutes
                    .filter(route => route.driver)
                    .reduce((total, route) => total + (parseFloat(route.quantity) || 0), 0)
                    .toFixed(2))
            } : null;

            const stage1Data = {
                orderType: orderType,
                collectionType: selectedType,
                productAssignments: mergedAssignments,
                deliveryRoutes: routesWithDrivers,
                summaryData: summaryData
            };

            //console.log('Saving Stage 1 with data:', JSON.stringify(stage1Data, null, 2));

            const response = await updateStage1Assignment(id, stage1Data);
            //console.log('Stage 1 saved:', response);

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

    // Save Stage 4 review data
    const handleSaveStage4 = async () => {
        try {
            // Validate market prices on frontend
            const invalidPrices = productRows.filter(row => !row.marketPrice || row.marketPrice === 0);

            if (invalidPrices.length > 0) {
                const productNames = invalidPrices.map(p => p.product_name || p.product).join(', ');
                alert(`Cannot submit Stage 4: Market prices are not updated for: ${productNames}. Please update product prices before proceeding.`);
                return;
            }

            const stage4Data = {
                reviewData: {
                    productRows,
                    remainingRowAssignments,
                    orderType,
                    selectedType,
                    availableStock,
                    reviewedAt: new Date().toISOString()
                },
                status: 'completed'
            };

            const response = await updateStage4Assignment(id, stage4Data);
            console.log('Stage 4 saved:', response);
            

            alert('Stage 4 review completed successfully!');
            navigate('/order-assign');
        } catch (error) {
            console.error('Error saving stage 4:', error);

            // Handle backend validation error
            if (error.message && error.message.includes('Market prices')) {
                alert(error.message);
            } else {
                alert('Failed to save stage 4 review. Please try again.');
            }
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
                        price: data.price ?? 0,
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
                        price: remainingData.price ?? 0,
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

    const displayRows = React.useMemo(() => getDisplayRows(), [productRows, remainingRowAssignments, isBoxBasedOrder]);

    const getEffectiveWeightForAmount = (row) => {
        // Only calculate when airport and packaged quantity are assigned from Stage 3
        if (!row.airportName || !row.noOfPkgs) return 0;

        const pickedQty = parseFloat(row.assignedQty) || 0;
        if (pickedQty > 0) return pickedQty;

        // Use noOfPkgs from Stage 3 — only packed boxes, excludes pending boxes
        const noOfPkgs = parseInt(row.noOfPkgs) || 0;
        const totalBoxes = parseFloat(row.num_boxes) || 0;
        const totalWeight = parseFloat(row.net_weight) || 0;
        if (noOfPkgs > 0 && totalBoxes > 0 && totalWeight > 0) {
            return (noOfPkgs / totalBoxes) * totalWeight;
        }

        return totalWeight;
    };

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
                                        stage4Status === 'pending' ? 'bg-purple-100 text-purple-700' :
                                        stage4Status === 'processing' ? 'bg-yellow-100 text-yellow-700' :
                                        stage4Status === 'completed' ? 'bg-emerald-600 text-white' :
                                        stage4Status === 'in_progress' ? 'bg-blue-100 text-blue-700' :
                                        'bg-gray-100 text-gray-700'
                                    }`}>
                                        {stage4Status ? stage4Status.charAt(0).toUpperCase() + stage4Status.slice(1).replace('_', ' ') : (orderDetails?.order_status ? orderDetails.order_status.charAt(0).toUpperCase() + orderDetails.order_status.slice(1) : 'N/A')}
                                    </span>
                                </td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Stage Tabs */}
            <div className="mb-6 flex flex-col sm:flex-row gap-3">
                <button
                    onClick={() => navigate(`/order-assign/stage1/${id}`, { state: { orderData: orderDetails } })}
                    className="px-6 py-3 bg-white border-2 border-emerald-600 text-emerald-600 rounded-lg font-medium hover:bg-emerald-50 transition-colors flex items-center gap-2"
                >
                    <Check className="w-5 h-5" />
                    Stage 1: Product Collection
                </button>
                <button
                    onClick={() => navigate(`/order-assign/stage2/${id}`, { state: { orderData: orderDetails } })}
                    className="px-6 py-3 bg-white border-2 border-emerald-600 text-emerald-600 rounded-lg font-medium hover:bg-emerald-50 transition-colors flex items-center gap-2"
                >
                    <Check className="w-5 h-5" />
                    Stage 2: Packaging
                </button>
                <button
                    onClick={() => navigate(`/order-assign/stage3/${id}`, { state: { orderData: orderDetails } })}
                    className="px-6 py-3 bg-white border-2 border-emerald-600 text-emerald-600 rounded-lg font-medium hover:bg-emerald-50 transition-colors flex items-center gap-2"
                >
                    <Check className="w-5 h-5" />
                    Stage 3: Delivery
                </button>
                <button className="px-6 py-3 bg-emerald-600 text-white rounded-lg font-medium shadow-sm">
                    Stage 4: Price
                </button>
            </div>

            {/* Stage 1 Section */}
            <div className="bg-white rounded-xl shadow-sm p-6 mb-6">
                <div className="flex flex-col gap-4 mb-2">
                    <h2 className="text-lg font-semibold text-gray-900">Stage 4: Review - Product Collection from Sources</h2>

                    {/* Collection Type Dropdown */}
                    {/* <div className="flex items-center gap-3">
                        <label className="text-sm font-medium text-gray-700">Collection Type:</label>
                        <div className="relative">
                            <select
                                value={selectedType}
                                onChange={(e) => setSelectedType(e.target.value)}
                                disabled
                                className="appearance-none px-4 py-2 pr-10 bg-gray-100 border-2 border-gray-300 text-gray-600 rounded-lg font-medium cursor-not-allowed outline-none"
                            >
                                <option value="Bag">Bag</option>
                                <option value="Box">Box</option>
                            </select>
                            <ChevronDown className="absolute right-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-emerald-700 pointer-events-none" />
                        </div>
                    </div> */}
                </div>
                <p className="text-sm text-gray-600 mb-6">Assign order products to farmers, suppliers, and third parties for collection and delivery to packaging location</p>

                {/* Product Table - Desktop */}
                <div className="hidden lg:block overflow-x-auto">
                    <table className="w-full">
                        <thead className="bg-gray-50 border-b border-gray-200">
                            <tr>
                                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Product</th>
                                {isBoxBasedOrder && <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Needed No of Boxes/Bags</th>}
                                {isBoxBasedOrder && <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Needed Weight (kg)</th>}
                                {!isBoxBasedOrder && <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Quantity Needed</th>}
                                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Entity Type <span className="text-red-500">*</span></th>
                                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Name <span className="text-red-500">*</span></th>
                                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Place</th>
                                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Entity Stock</th>
                                {isBoxBasedOrder && <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Picked No of Boxes/Bags</th>}
                                {!isBoxBasedOrder && <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Picked Qty</th>}
                                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Market Price</th>
                                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Price</th>
                                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Total Amount</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200">
                            {displayRows.filter(row => !row.isRemaining).map((row, index) => {
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
                                            <select
                                                disabled
                                                className="min-w-[130px] w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-gray-100 cursor-not-allowed outline-none"
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
                                                disabled
                                                className="min-w-[150px] w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-gray-100 cursor-not-allowed outline-none"
                                                value={row.assignedTo}
                                                onChange={(e) => {
                                                    const selectedEntityName = e.target.value;
                                                    let selectedEntity = null;

                                                    if (row.entityType === 'farmer') {
                                                        selectedEntity = assignmentOptions.farmers.find(f => f.farmer_name === selectedEntityName);
                                                    } else if (row.entityType === 'supplier') {
                                                        selectedEntity = assignmentOptions.suppliers.find(s => s.supplier_name === selectedEntityName);
                                                    } else if (row.entityType === 'thirdParty') {
                                                        selectedEntity = assignmentOptions.thirdParties.find(tp => tp.third_party_name === selectedEntityName);
                                                    }

                                                    if (row.isRemaining) {
                                                        removeRoutesForRow(row.id.split('-remaining')[0], true, row.id);
                                                        setRemainingRowAssignments(prev => ({
                                                            ...prev,
                                                            [row.id]: {
                                                                ...prev[row.id],
                                                                assignedTo: selectedEntityName,
                                                                tapeColor: selectedEntity?.tape_color || ''
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
                                                        setProductRows(updatedRows);

                                                        if (selectedEntity && (updatedRows[targetIndex].assignedQty > 0 || updatedRows[targetIndex].assignedBoxes > 0)) {
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
                                                {row.entityType === 'farmer' && filterFarmersByProductAvailability(
                                                    assignmentOptions.farmers,
                                                    farmerAvailability,
                                                    productName,
                                                    getFarmerFilterOptions(row)
                                                ).map(farmer => (
                                                    <option key={`farmer-${farmer.fid}`} value={farmer.farmer_name}>{farmer.farmer_name}</option>
                                                ))}
                                                {row.entityType === 'supplier' && assignmentOptions.suppliers.map(supplier => (
                                                    <option key={`supplier-${supplier.sid}`} value={supplier.supplier_name}>{supplier.supplier_name}</option>
                                                ))}
                                                {row.entityType === 'thirdParty' && assignmentOptions.thirdParties.map(thirdParty => (
                                                    <option key={`thirdParty-${thirdParty.tpid}`} value={thirdParty.third_party_name}>{thirdParty.third_party_name}</option>
                                                ))}
                                            </select>
                                        </td>
                                        <td className="px-4 py-4">
                                            <select
                                                disabled
                                                className="min-w-[140px] w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-gray-100 cursor-not-allowed outline-none"
                                                value={row.place || ''}
                                                onChange={(e) => {
                                                    if (row.isRemaining) {
                                                        setRemainingRowAssignments(prev => ({
                                                            ...prev,
                                                            [row.id]: { ...prev[row.id], place: e.target.value }
                                                        }));
                                                    } else {
                                                        const updatedRows = [...productRows];
                                                        updatedRows[row.displayIndex].place = e.target.value;
                                                        setProductRows(updatedRows);
                                                    }
                                                }}
                                            >
                                                <option value="">Select place...</option>
                                                <option value="Farmer place">Farmer place</option>
                                                <option value="Own place">Own place</option>
                                            </select>
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
                                                    type="text"
                                                    value={row.assignedBoxes || ''}
                                                    placeholder=""
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
                                                    disabled
                                                    className="w-24 px-3 py-2 border border-gray-300 rounded-lg text-sm bg-gray-100 cursor-not-allowed outline-none"
                                                />
                                            </td>
                                        )}
                                        {!isBoxBasedOrder && (
                                            <td className="px-4 py-4">
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
                                                    disabled
                                                    className="w-24 px-3 py-2 border border-gray-300 rounded-lg text-sm bg-gray-100 cursor-not-allowed outline-none"
                                                />
                                            </td>
                                        )}
                                        <td className="px-4 py-4">
                                            <div className="flex items-center gap-2">
                                                <span className="text-sm font-semibold text-gray-900">
                                                    {row.marketPrice > 0 ? `₹${row.marketPrice.toFixed(2)}` : '-'}
                                                </span>
                                                {row.marketPrice === 0 && (
                                                    <span className="text-xs text-red-600 bg-red-50 px-2 py-1 rounded-full">
                                                        Update price
                                                    </span>
                                                )}
                                            </div>
                                        </td>
                                        <td className="px-4 py-4">
                                            <input
                                                ref={(el) => {
                                                    if (el) {
                                                        const existing = priceInputRefs.current[index] || [];
                                                        priceInputRefs.current[index] = Array.isArray(existing)
                                                            ? [...existing.filter(Boolean), el]
                                                            : [existing, el].filter(Boolean);
                                                    }
                                                }}
                                                type="text"
                                                value={row.price ? row.price : ''}
                                                placeholder=""
                                                onKeyDown={(e) => handlePriceArrowKey(e, index, displayRows.length)}
                                                onChange={(e) => {
                                                    const newPrice = e.target.value;
                                                    if (row.isRemaining) {
                                                        setRemainingRowAssignments(prev => ({
                                                            ...prev,
                                                            [row.id]: { ...prev[row.id], price: newPrice }
                                                        }));
                                                    } else {
                                                        setProductRows(prevRows => {
                                                            const updatedRows = [...prevRows];
                                                            const rowIndex = updatedRows.findIndex(r => r.id === row.id);
                                                            if (rowIndex !== -1) {
                                                                updatedRows[rowIndex] = {
                                                                    ...updatedRows[rowIndex],
                                                                    price: newPrice
                                                                };
                                                            }
                                                            return updatedRows;
                                                        });
                                                    }
                                                }}
                                                className="w-28 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
                                            />
                                        </td>
                                        <td className="px-4 py-4">
                                            <div className="flex items-center">
                                                <span className="text-sm font-bold text-emerald-600">
                                                    ₹{(() => {
                                                        const price = parseFloat(row.price) || 0;
                                                        const weight = getEffectiveWeightForAmount(row);
                                                        return (price * weight).toFixed(2);
                                                    })()}
                                                </span>
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>

                {/* Product Cards - Mobile */}
                <div className="lg:hidden space-y-4">
                    {displayRows.filter(row => !row.isRemaining).map((row, index) => {
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
                                    </div>
                                </div>

                                <div className="space-y-3">
                                    <div>
                                        <label className="block text-xs font-semibold text-gray-700 mb-1">
                                            Entity Type <span className="text-red-500">*</span>
                                        </label>
                                        <select
                                            disabled
                                            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-gray-100 cursor-not-allowed outline-none"
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
                                            disabled
                                            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-gray-100 cursor-not-allowed outline-none"
                                            onChange={(e) => {
                                                const selectedEntityName = e.target.value;
                                                let selectedEntity = null;

                                                if (row.entityType === 'farmer') {
                                                    selectedEntity = assignmentOptions.farmers.find(f => f.farmer_name === selectedEntityName);
                                                } else if (row.entityType === 'supplier') {
                                                    selectedEntity = assignmentOptions.suppliers.find(s => s.supplier_name === selectedEntityName);
                                                } else if (row.entityType === 'thirdParty') {
                                                    selectedEntity = assignmentOptions.thirdParties.find(tp => tp.third_party_name === selectedEntityName);
                                                }

                                                if (row.isRemaining) {
                                                    removeRoutesForRow(row.id.split('-remaining')[0], true, row.id);
                                                    setRemainingRowAssignments(prev => ({
                                                        ...prev,
                                                        [row.id]: {
                                                            ...prev[row.id],
                                                            assignedTo: selectedEntityName,
                                                            tapeColor: selectedEntity?.tape_color || ''
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
                                            {row.entityType === 'farmer' && filterFarmersByProductAvailability(
                                                assignmentOptions.farmers,
                                                farmerAvailability,
                                                productName,
                                                getFarmerFilterOptions(row)
                                            ).map(farmer => (
                                                <option key={`farmer-${farmer.fid}`} value={farmer.farmer_name}>{farmer.farmer_name}</option>
                                            ))}
                                            {row.entityType === 'supplier' && assignmentOptions.suppliers.map(supplier => (
                                                <option key={`supplier-${supplier.sid}`} value={supplier.supplier_name}>{supplier.supplier_name}</option>
                                            ))}
                                            {row.entityType === 'thirdParty' && assignmentOptions.thirdParties.map(thirdParty => (
                                                <option key={`thirdParty-${thirdParty.tpid}`} value={thirdParty.third_party_name}>{thirdParty.third_party_name}</option>
                                            ))}
                                        </select>
                                    </div>

                                    <div>
                                        <label className="block text-xs font-semibold text-gray-700 mb-1">Place</label>
                                        <select
                                            disabled
                                            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-gray-100 cursor-not-allowed outline-none"
                                            value={row.place || ''}
                                            onChange={(e) => {
                                                if (row.isRemaining) {
                                                    setRemainingRowAssignments(prev => ({
                                                        ...prev,
                                                        [row.id]: { ...prev[row.id], place: e.target.value }
                                                    }));
                                                } else {
                                                    const updatedRows = [...productRows];
                                                    updatedRows[row.displayIndex].place = e.target.value;
                                                    setProductRows(updatedRows);
                                                }
                                            }}
                                        >
                                            <option value="">Select place...</option>
                                            <option value="Farmer place">Farmer place</option>
                                            <option value="Own place">Own place</option>
                                        </select>
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

                                        <div>
                                            <label className="block text-xs font-semibold text-gray-700 mb-1">
                                                Picked Boxes/Bags
                                            </label>
                                            <input
                                                type="text"
                                                value={row.assignedBoxes || ''}
                                                placeholder=""
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

                                    <div className="grid grid-cols-2 gap-3">
                                        <div>
                                            <label className="block text-xs font-semibold text-gray-700 mb-1">Market Price</label>
                                            <div className="flex items-center gap-2">
                                                <span className="text-sm font-semibold text-gray-900">
                                                    {row.marketPrice > 0 ? `₹${row.marketPrice.toFixed(2)}` : '-'}
                                                </span>
                                                {row.marketPrice === 0 && (
                                                    <span className="text-xs text-red-600 bg-red-50 px-2 py-1 rounded-full">
                                                        Update price
                                                    </span>
                                                )}
                                            </div>
                                        </div>

                                        <div>
                                            <label className="block text-xs font-semibold text-gray-700 mb-1">Price</label>
                                            <input
                                                ref={(el) => {
                                                    if (el) {
                                                        const existing = priceInputRefs.current[index] || [];
                                                        priceInputRefs.current[index] = Array.isArray(existing)
                                                            ? [...existing.filter(Boolean), el]
                                                            : [existing, el].filter(Boolean);
                                                    }
                                                }}
                                                type="text"
                                                value={row.price ? row.price : ''}
                                                placeholder=""
                                                onKeyDown={(e) => handlePriceArrowKey(e, index, displayRows.length)}
                                                onChange={(e) => {
                                                    const newPrice = e.target.value;
                                                    if (row.isRemaining) {
                                                        setRemainingRowAssignments(prev => ({
                                                            ...prev,
                                                            [row.id]: { ...prev[row.id], price: newPrice }
                                                        }));
                                                    } else {
                                                        setProductRows(prevRows => {
                                                            const updatedRows = [...prevRows];
                                                            const rowIndex = updatedRows.findIndex(r => r.id === row.id);
                                                            if (rowIndex !== -1) {
                                                                updatedRows[rowIndex] = {
                                                                    ...updatedRows[rowIndex],
                                                                    price: newPrice
                                                                };
                                                            }
                                                            return updatedRows;
                                                        });
                                                    }
                                                }}
                                                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
                                            />
                                        </div>
                                    </div>

                                    {/* Total Amount Display */}
                                    <div className="mt-3 pt-3 border-t border-gray-200">
                                        <div className="flex items-center justify-between">
                                            <span className="text-sm font-medium text-gray-700">Total Amount:</span>
                                            <span className="text-lg font-bold text-emerald-600">
                                                ₹{(() => {
                                                    const price = parseFloat(row.price) || 0;
                                                    const weight = getEffectiveWeightForAmount(row);
                                                    return (price * weight).toFixed(2);
                                                })()}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>


            </div>







            {/* Total Amount Section */}
            <div className="bg-gradient-to-r from-emerald-50 to-teal-50 rounded-xl shadow-sm p-6 mb-6 border-2 border-emerald-200">
                <div className="flex items-center justify-between">
                    <div>
                        <h3 className="text-lg font-semibold text-gray-900 mb-1">Order Total Amount</h3>
                        <p className="text-sm text-gray-600">Based on assigned prices and quantities</p>
                    </div>
                    <div className="text-right">
                        <p className="text-sm text-gray-600 mb-1">Total Amount</p>
                        <p className="text-3xl font-bold text-emerald-600">
                            ₹{(() => {
                                let total = 0;
                                displayRows.forEach(row => {
                                    const price = parseFloat(row.price) || 0;
                                    // Use net_weight which contains the actual kg for both box and weight-based orders
                                    const weight = getEffectiveWeightForAmount(row);
                                    total += price * weight;
                                });
                                return total.toFixed(2);
                            })()}
                        </p>
                    </div>
                </div>

                {/* Breakdown */}
                <div className="mt-4 pt-4 border-t border-emerald-200">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="bg-white rounded-lg p-3">
                            <p className="text-xs text-gray-500 mb-1">Total Items</p>
                            <p className="text-lg font-semibold text-gray-900">{displayRows.length}</p>
                        </div>
                        <div className="bg-white rounded-lg p-3">
                            <p className="text-xs text-gray-500 mb-1">Total Quantity</p>
                            <p className="text-lg font-semibold text-gray-900">
                                {(() => {
                                    const totalKg = displayRows.reduce((sum, row) => {
                                        const weight = getEffectiveWeightForAmount(row);
                                        return sum + weight;
                                    }, 0);
                                    return `${totalKg.toFixed(2)} kg`;
                                })()}
                            </p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-col sm:flex-row justify-between gap-3">
                <button
                    onClick={() => navigate(`/order-assign/stage3/${id}`)}
                    className="px-6 py-3 border-2 border-gray-300 text-gray-700 rounded-lg font-medium hover:bg-gray-50 transition-colors"
                >
                    ← Back to Stage 3
                </button>
                <div className="flex gap-3">
                    <button
                        onClick={handleSaveStage4}
                        className="px-6 py-3 bg-emerald-600 text-white rounded-lg font-medium shadow-sm hover:bg-emerald-700 transition-colors"
                    >
                        Submit Stage4
                    </button>
                    {/* <button
                        onClick={() => navigate('/order-assign')}
                        className="px-6 py-3 bg-emerald-600 text-white rounded-lg font-medium shadow-sm hover:bg-emerald-700 transition-colors"
                    >
                        Complete & Return to Orders
                    </button> */}
                </div>
            </div>
        </div>
    );
};

export default OrderAssignCreateStage4;