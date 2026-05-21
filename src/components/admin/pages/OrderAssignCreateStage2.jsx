import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useNavigate, useLocation, useParams } from 'react-router-dom';
import { Check, ChevronDown, Package, User } from 'lucide-react';
import { updateStage2Assignment, getOrderAssignment, getAvailableStock } from '../../../api/orderAssignmentApi';
import { getAllLabours } from '../../../api/labourApi';
import { getPresentLaboursToday } from '../../../api/labourAttendanceApi';
import { getAllFarmers } from '../../../api/farmerApi';
import { getAllSuppliers } from '../../../api/supplierApi';
import { getAllThirdParties } from '../../../api/thirdPartyApi';
import { getTapes } from '../../../api/inventoryApi';
import { getAllLabourExcessPay } from '../../../api/labourExcessPayApi';
import { getAllLabourRates } from '../../../api/labourRateApi';
import { sortDropdownObjects } from '../../../utils/dropdownSort';
import { computeExpectedExcessStock, formatExcessStockSaveMessage } from '../common/Stage2ExcessStockPreview';
import Stage2ExcessStockPreview from '../common/Stage2ExcessStockPreview';

const OrderAssignCreateStage2 = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { id } = useParams();
  const orderData = location.state?.orderData;
  const [productRows, setProductRows] = useState([]);
  const [labours, setLabours] = useState([]);
  const [availableStock, setAvailableStock] = useState({});
  const [packagingStatuses, setPackagingStatuses] = useState({});
  const [tapes, setTapes] = useState([]);
  const [openDropdown, setOpenDropdown] = useState(null);
  const [isBoxBasedOrder, setIsBoxBasedOrder] = useState(false);
  const [labourWages, setLabourWages] = useState({});
  const [labourExcessPay, setLabourExcessPay] = useState({});
  const [labourTotalAmounts, setLabourTotalAmounts] = useState({});
  const [labourRates, setLabourRates] = useState({});
  const [stage2Status, setStage2Status] = useState(null); // Store stage2_status from assignment data
  
  // Refs for keyboard navigation
  const inputGridRefs = useRef({});
  const excessStockPreview = useMemo(() => computeExpectedExcessStock(productRows), [productRows]);

  // Handle arrow key navigation between inputs
  const handleKeyDown = (e, rowIndex, colIndex, totalRows) => {
    const arrowKeys = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'];
    if (!arrowKeys.includes(e.key)) return;

    e.preventDefault();
    
    // Column mapping: 0=Wastage, 1=Packed Amount, 2=Reuse (only for first vendor)
    // For labour rows: column 3=Packed Boxes
    const columnCount = 3; // Main columns: Wastage, Packed Amount, Reuse
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

  // Handle arrow key navigation for Packaging Summary section
  const handleSummaryKeyDown = (e, labourName, rowIndex, colIndex, totalRows) => {
    const arrowKeys = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'];
    if (!arrowKeys.includes(e.key)) return;

    e.preventDefault();
    
    // Column mapping: 0=Start Time, 1=End Time, 2=Packed Boxes, 3=Status
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
    
    // Get the next input element (key format: summary-{labourName}-{rowIndex}-{colIndex})
    const nextInputKey = `summary-${labourName}-${nextRow}-${nextCol}`;
    const nextInput = inputGridRefs.current[nextInputKey];
    
    if (nextInput) {
      nextInput.focus();
      // Select all text for easy editing (only for input elements, not selects)
      if (nextInput.select && nextInput.tagName === 'INPUT' && nextInput.type !== 'time') {
        setTimeout(() => nextInput.select(), 0);
      }
    }
  };

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (openDropdown !== null && !event.target.closest('.labour-dropdown')) {
        setOpenDropdown(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [openDropdown]);

  // Load labours and assignment data from Stage 1
  useEffect(() => {
    const loadData = async () => {
      try {
        // Local cache for labour rates fetched from API
        let ratesMap = {};

        // Fetch available stock and tapes
        try {
          const [stockResponse, tapesResponse, excessPayResponse, labourRatesResponse] = await Promise.all([
            getAvailableStock(),
            getTapes(),
            getAllLabourExcessPay(),
            getAllLabourRates()
          ]);
          if (stockResponse.success) {
            setAvailableStock(stockResponse.data);
          }
          if (tapesResponse.success) {
            setTapes(tapesResponse.data || []);
          }
          if (excessPayResponse.success) {
            const excessPayMap = {};
            excessPayResponse.data.forEach(pay => {
              excessPayMap[pay.labour_id] = pay.amount;
            });
            setLabourExcessPay(excessPayMap);
          }
          if (labourRatesResponse) {
            // Handle both mock-array response and { success, data } API style response
            const labourRatesData = Array.isArray(labourRatesResponse)
              ? labourRatesResponse
              : (labourRatesResponse.success ? (labourRatesResponse.data || []) : []);

            if (Array.isArray(labourRatesData)) {
              labourRatesData.forEach(rate => {
                if (rate && rate.labourType) {
                  ratesMap[rate.labourType] = rate.amount;
                }
              });
              setLabourRates(ratesMap);
            }
          }
        } catch (error) {
          console.error('Error fetching data:', error);
        }

        // Load assignment data from Stage 1
        const assignmentResponse = await getOrderAssignment(id);
        const assignmentData = assignmentResponse.data;

        // Store stage2_status from assignment data
        if (assignmentData.stage2_status) {
          setStage2Status(assignmentData.stage2_status);
        }

        // Fetch order data separately if not included
        let orderItems = [];
        if (assignmentData.order && assignmentData.order.items) {
          orderItems = assignmentData.order.items;
        } else if (orderData && orderData.items) {
          orderItems = orderData.items;
        } else {
          // Fetch order data from API
          try {
            const { getOrderById } = await import('../../../api/orderApi');
            const orderResponse = await getOrderById(id);
            if (orderResponse.data && orderResponse.data.items) {
              orderItems = orderResponse.data.items;
            }
          } catch (err) {
            console.error('Error fetching order:', err);
          }
        }

        // Determine if order is box-based
        if (orderItems.length > 0) {
          const firstItem = orderItems[0];
          const hasBoxes = firstItem.num_boxes && parseInt(firstItem.num_boxes) > 0;
          setIsBoxBasedOrder(hasBoxes);
        }

        // Load present labours from attendance
        try {
          const today = new Date().toISOString().split('T')[0];
          const attendanceResponse = await getPresentLaboursToday(today);

          // Handle different response structures
          let allAttendance = [];
          if (attendanceResponse.data?.data) {
            allAttendance = attendanceResponse.data.data;
          } else if (Array.isArray(attendanceResponse.data)) {
            allAttendance = attendanceResponse.data;
          } else if (attendanceResponse.data) {
            allAttendance = [attendanceResponse.data];
          }

          // Extract labours from nested structure
          let presentLabours = [];
          if (allAttendance.length > 0 && allAttendance[0].labours) {
            presentLabours = allAttendance[0].labours.filter(labour =>
              labour.attendance_status && labour.attendance_status.toLowerCase() === 'present'
            );
          }

          setLabours(sortDropdownObjects(presentLabours, (l) => l.full_name));
          
          // Initialize labour wages and total amounts
          const wages = {};
          const totals = {};
          presentLabours.forEach(labour => {
            const workType = labour.work_type || 'Normal';
            // Use labour rates from API based on work_type only (daily_wage removed from labour table)
            const rateAmount = ratesMap[workType] || 0;
            wages[labour.full_name] = rateAmount;
            totals[labour.full_name] = rateAmount;
          });
          setLabourWages(wages);
          setLabourTotalAmounts(totals);
        } catch (err) {
          console.error('Error loading present labours:', err);
        }

        // Initialize product rows from Stage 1 data
        if (orderItems.length > 0) {
          const rows = [];

          // Parse product_assignments once
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

          // Create individual rows for each vendor assignment
          orderItems.forEach((item) => {
            const itemAssignments = assignments.filter(pa => pa.id == item.oiid || pa.id === String(item.oiid));

            if (itemAssignments.length > 0) {
              // Create separate row for each vendor
              itemAssignments.forEach((assignment, idx) => {
                // Calculate picked weight for box-based orders
                const totalBoxes = parseInt(item.num_boxes) || 0;
                const pickedBoxes = parseFloat(assignment.assignedBoxes) || 0;
                const totalWeight = parseFloat(item.net_weight) || 0;
                const calculatedPickedWeight = totalBoxes > 0
                  ? (pickedBoxes / totalBoxes) * totalWeight
                  : (parseFloat(assignment.assignedQty) || 0);
                const pickedWeightRounded = parseFloat((calculatedPickedWeight).toFixed(1));

                const row = {
                  id: `${item.oiid}-${idx}`,
                  oiid: item.oiid,
                  product: (item.product_name || item.product || '').replace(/^\d+\s*-\s*/, ''),
                  quantity: `${item.net_weight || 0} kg`,
                  num_boxes: totalBoxes,
                  net_weight: totalWeight,
                  pickedQuantity: parseFloat(assignment.assignedQty) || 0,
                  pickedBoxes: pickedBoxes,
                  pickedWeight: pickedWeightRounded,
                  entityType: assignment.entityType || '',
                  entityName: assignment.assignedTo || '',
                  wastage: '',
                  reuse: '',
                  packedAmount: '',
                  tapeColor: '',
                  tapeQuantity: '',
                  labour: [],
                  status: assignment.status || 'pending',
                  startTime: '',
                  endTime: '',
                  isFirstVendor: idx === 0,
                  vendorCount: itemAssignments.length,
                  vendorIndex: idx
                };
                rows.push(row);
              });
            } else {
              // No assignment, create default row
              rows.push({
                id: `${item.oiid}-0`,
                oiid: item.oiid,
                product: (item.product_name || item.product || '').replace(/^\d+\s*-\s*/, ''),
                quantity: `${item.net_weight || 0} kg`,
                num_boxes: parseInt(item.num_boxes) || 0,
                net_weight: parseFloat(item.net_weight) || 0,
                pickedQuantity: '',
                entityType: '',
                entityName: '',
                wastage: '',
                reuse: '',
                tapeColor: '',
                tapeQuantity: '',
                labour: [],
                status: 'pending',
                startTime: '',
                endTime: '',
                isFirstVendor: true,
                vendorCount: 0,
                vendorIndex: 0
              });
            }
          });

          // Load labours from Stage 1 delivery routes - map to vendor rows
          let deliveryRoutes = [];
          if (assignmentData.delivery_routes) {
            try {
              deliveryRoutes = typeof assignmentData.delivery_routes === 'string'
                ? JSON.parse(assignmentData.delivery_routes)
                : assignmentData.delivery_routes;
              // console.log('All delivery routes:', deliveryRoutes);
            } catch (e) {
              console.error('Error parsing delivery_routes:', e);
            }
          }

          rows.forEach(row => {
            // Match route by oiid AND entityName
            // Handle both regular oiid (3) and remaining oiid ("3-remaining-0")
            const matchingRoute = deliveryRoutes.find(route => {
              const routeOiid = String(route.oiid).split('-')[0]; // Extract base oiid
              const match = routeOiid == row.oiid && route.location === row.entityName;
              // console.log('Checking route:', route.oiid, route.location, 'vs row:', row.oiid, row.entityName, 'Match:', match);
              return match;
            });
            if (matchingRoute) {
              // Handle labour field - it can be an array or a string
              if (matchingRoute.labours && Array.isArray(matchingRoute.labours)) {
                row.labour = matchingRoute.labours;
                // console.log('Assigned labours array to row:', row.entityName, row.labour);
              } else if (matchingRoute.labour) {
                // Check if labour is already an array
                if (Array.isArray(matchingRoute.labour)) {
                  row.labour = matchingRoute.labour;
                  // console.log('Assigned labour array to row:', row.entityName, row.labour);
                } else if (typeof matchingRoute.labour === 'string' && matchingRoute.labour) {
                  row.labour = [matchingRoute.labour];
                  // console.log('Assigned labour string to row:', row.entityName, row.labour);
                }
              }
            } else {
              // console.log('No matching route for row:', row.oiid, row.entityName);
            }
          });

          // Load Stage 2 data if exists
          const stage2DataField = assignmentData.stage2_summary_data || assignmentData.stage2SummaryData || assignmentData.summary_data;

          if (stage2DataField) {
            try {
              const stage2Summary = typeof stage2DataField === 'string'
                ? JSON.parse(stage2DataField)
                : stage2DataField;

              if (stage2Summary.labourAssignments && stage2Summary.labourAssignments.length > 0) {
                // Create a map of product assignments from labour assignments
                const assignmentMap = {};
                const individualLabourDataMap = {};

                stage2Summary.labourAssignments.forEach(labourAssignment => {
                  const labourName = labourAssignment.labour;

                  labourAssignment.assignments.forEach(assignment => {
                    const key = `${assignment.oiid}-${assignment.entityName}`;

                    if (!assignmentMap[key]) {
                      assignmentMap[key] = {
                        wastage: assignment.wastage,
                        reuse: assignment.reuse,
                        packedAmount: assignment.packedAmount,
                        status: assignment.status,
                        tapeColor: assignment.tapeColor,
                        labours: []
                      };
                    }

                    // Add labour to the list if not already present
                    if (!assignmentMap[key].labours.includes(labourName)) {
                      assignmentMap[key].labours.push(labourName);
                    }

                    // Store individual labour data
                    const individualKey = `${assignment.oiid}-${labourName}`;
                    individualLabourDataMap[individualKey] = {
                      status: assignment.status || 'pending',
                      startTime: assignment.startTime || '',
                      endTime: assignment.endTime || '',
                      packedBoxes: assignment.packedBoxes || 0
                    };
                  });
                });

                // console.log('Assignment map:', assignmentMap);
                // console.log('Individual labour data map:', individualLabourDataMap);

                // Load stage2_data for tape quantity and other data
                let stage2Data = null;
                if (assignmentData.stage2_data) {
                  try {
                    stage2Data = typeof assignmentData.stage2_data === 'string'
                      ? JSON.parse(assignmentData.stage2_data)
                      : assignmentData.stage2_data;
                  } catch (e) {
                    console.error('Error parsing stage2_data:', e);
                  }
                }

                // Apply the data to rows
                rows.forEach((row) => {
                  const key = `${row.oiid}-${row.entityName}`;
                  const stage2DataRow = assignmentMap[key];

                  if (stage2DataRow) {
                    row.wastage = stage2DataRow.wastage || '';
                    row.reuse = stage2DataRow.reuse || '';
                    row.packedAmount = stage2DataRow.packedAmount || '';
                    row.status = stage2DataRow.status || 'pending';

                    if (row.isFirstVendor) {
                      row.labour = stage2DataRow.labours || [];
                      row.tapeColor = stage2DataRow.tapeColor || '';

                      // Load tape quantity from stage2_data
                      if (stage2Data && stage2Data.productAssignments) {
                        const productAssignment = stage2Data.productAssignments.find(pa => pa.id === row.oiid);
                        if (productAssignment) {
                          row.tapeQuantity = productAssignment.tapeQuantity || '';
                        }
                      }

                      // Load individual labour data for each labour assigned to this row
                      if (row.labour && Array.isArray(row.labour)) {
                        row.labour.forEach(labourName => {
                          const individualKey = `${row.oiid}-${labourName}`;
                          const individualData = individualLabourDataMap[individualKey];
                          if (individualData) {
                            const rowKey = `${row.id}-${labourName}`;
                            row[`status_${rowKey}`] = individualData.status;
                            row[`startTime_${rowKey}`] = individualData.startTime;
                            row[`endTime_${rowKey}`] = individualData.endTime;
                            row[`packedBoxes_${rowKey}`] = individualData.packedBoxes || 0;
                          }
                        });
                      }
                    }
                  }
                });
              }
            } catch (e) {
              console.error('Error parsing stage2_summary_data:', e);
            }
          }

          setProductRows(rows);
        }
      } catch (error) {
        console.error('Error loading data:', error);
      }
    };

    loadData();
  }, [id]);

  const getPackedBoxesCap = (row) => {
    const numBoxes = parseInt(row.num_boxes, 10) || 0;
    const picked = parseInt(row.pickedBoxes, 10) || 0;
    return numBoxes > 0 ? numBoxes : picked;
  };

  const updatePackedBoxesField = (rowId, labourName, value) => {
    const rowIndex = productRows.findIndex((r) => r.id === rowId);
    if (rowIndex === -1) return;
    const row = productRows[rowIndex];
    const packedCap = getPackedBoxesCap(row);
    const packed = value === '' ? '' : parseInt(value, 10);
    if (value !== '' && (Number.isNaN(packed) || packed < 0)) return;
    const labours = Array.isArray(row.labour) ? row.labour : [];
    const otherPacked = labours
      .filter((name) => name !== labourName)
      .reduce((sum, name) => {
        const key = `${row.id}-${name}`;
        return sum + (parseInt(row[`packedBoxes_${key}`], 10) || 0);
      }, 0);
    if (value !== '' && otherPacked + packed > packedCap) {
      const maxAllowed = Math.max(packedCap - otherPacked, 0);
      alert(`Total packed boxes cannot exceed No. of Boxes/Bags (${packedCap}). Max allowed for ${labourName}: ${maxAllowed}`);
      return;
    }
    const updatedRows = [...productRows];
    updatedRows[rowIndex][`packedBoxes_${rowId}-${labourName}`] = value;
    setProductRows(updatedRows);
  };

  const validatePackedBoxesBeforeSave = () => {
    for (const row of productRows) {
      if (!row.labour || !Array.isArray(row.labour)) continue;
      const packedCap = getPackedBoxesCap(row);
      let rowPackedTotal = 0;
      for (const labourName of row.labour) {
        const key = `${row.id}-${labourName}`;
        rowPackedTotal += parseInt(row[`packedBoxes_${key}`], 10) || 0;
      }
      if (rowPackedTotal > packedCap) {
        alert(`${row.product}: total packed boxes (${rowPackedTotal}) cannot exceed No. of Boxes/Bags (${packedCap})`);
        return false;
      }
    }
    const packedByProduct = {};
    productRows.forEach((row) => {
      if (!row.labour || !Array.isArray(row.labour)) return;
      const oiid = row.oiid;
      if (!packedByProduct[oiid]) packedByProduct[oiid] = { total: 0, limit: parseInt(row.num_boxes, 10) || 0, product: row.product };
      row.labour.forEach((labourName) => {
        const key = `${row.id}-${labourName}`;
        packedByProduct[oiid].total += parseInt(row[`packedBoxes_${key}`], 10) || 0;
      });
    });
    for (const entry of Object.values(packedByProduct)) {
      if (entry.limit > 0 && entry.total > entry.limit) {
        alert(`${entry.product}: total packed boxes (${entry.total}) cannot exceed order boxes (${entry.limit})`);
        return false;
      }
    }
    return true;
  };

  const handleSaveStage2 = async () => {
    try {
      if (!validatePackedBoxesBeforeSave()) return;
      // Prepare product assignments for backend
      const productAssignments = productRows.map(row => {
        const firstVendorRow = productRows.find(r => r.oiid === row.oiid && r.isFirstVendor);

        // Collect individual labour data for this row
        const labourData = {};
        if (row.labour && Array.isArray(row.labour)) {
          row.labour.forEach(labourName => {
            const key = `${row.id}-${labourName}`;
            labourData[labourName] = {
              status: row[`status_${key}`] || 'pending',
              startTime: row[`startTime_${key}`] || '',
              endTime: row[`endTime_${key}`] || ''
            };
          });
        }

        return {
          id: row.oiid,
          product: row.product,
          entityType: row.entityType,
          entityName: row.entityName,
          pickedQuantity: parseFloat(row.pickedQuantity) || 0,
          pickedWeight: parseFloat(row.pickedWeight) || 0,
          wastage: parseFloat(row.wastage) || 0,
          packedAmount: parseFloat(row.packedAmount) || 0,
          reuse: row.isFirstVendor ? (parseFloat(row.reuse) || 0) : 0,
          tapeColor: firstVendorRow?.tapeColor || '',
          tapeQuantity: firstVendorRow?.tapeQuantity || '',
          labourId: firstVendorRow?.labour?.map(l => {
            const labour = labours.find(lab => lab.labour_name === l);
            return labour?.labour_id;
          }).filter(Boolean).join(',') || '',
          labourName: firstVendorRow?.labour?.join(', ') || '',
          status: row.status || 'pending',
          startTime: row.startTime || '',
          endTime: row.endTime || '',
          labourData: labourData
        };
      });

      // Group products by labour for summary
      const groupedByLabour = {};
      productRows.forEach(row => {
        if (row.labour && row.labour.length > 0) {
          const labourNames = Array.isArray(row.labour) ? row.labour : [row.labour];
          labourNames.forEach(labourName => {
            if (!groupedByLabour[labourName]) {
              groupedByLabour[labourName] = [];
            }

            // Create a copy of the row with individual labour data
            const key = `${row.id}-${labourName}`;
            const rowWithLabourData = {
              ...row,
              individualStatus: row[`status_${key}`] || 'pending',
              individualStartTime: row[`startTime_${key}`] || '',
              individualEndTime: row[`endTime_${key}`] || '',
              individualPackedBoxes: row[`packedBoxes_${key}`] || 0
            };

            groupedByLabour[labourName].push(rowWithLabourData);
          });
        }
      });

      // Generate summary data (now including wage info per labour)
      const labourAssignments = Object.entries(groupedByLabour).map(([labourName, rows]) => {
        const selectedLabour = labours.find(l => l.full_name === labourName);
        const totalPicked = rows.reduce((sum, r) => sum + (parseFloat(r.pickedQuantity) || 0), 0);
        const totalWastage = rows.reduce((sum, r) => sum + (parseFloat(r.wastage) || 0), 0);
        const totalReuse = rows.reduce((sum, r) => sum + (parseFloat(r.reuse) || 0), 0);

        // Wage details for this labour
        const labourWage = parseFloat(labourWages[labourName]) || 0;
        const excessPay = parseFloat(labourExcessPay[selectedLabour?.lid] || 0);
        const totalAmount = labourWage + excessPay;

        return {
          labour: labourName,
          labourId: selectedLabour?.lid || null,
          totalPicked: parseFloat(totalPicked.toFixed(2)),
          totalWastage: parseFloat(totalWastage.toFixed(2)),
          totalReuse: parseFloat(totalReuse.toFixed(2)),
          labourWage,
          excessPay,
          totalAmount,
          assignments: rows.map(r => ({
            product: r.product,
            entityType: r.entityType,
            entityName: r.entityName,
            tapeColor: r.tapeColor,
            pickedQuantity: parseFloat(r.pickedQuantity) || 0,
            wastage: parseFloat(r.wastage) || 0,
            reuse: parseFloat(r.reuse) || 0,
            packedAmount: parseFloat(r.packedAmount) || 0,
            status: r.individualStatus || 'pending',
            startTime: r.individualStartTime || '',
            endTime: r.individualEndTime || '',
            packedBoxes: parseInt(r.individualPackedBoxes) || 0,
            oiid: r.oiid
          }))
        };
      });

      // Prepare labour prices data
      const labourPrices = [];
      const assignedLabours = new Set();
      productRows.forEach(row => {
        if (row.labour && Array.isArray(row.labour)) {
          row.labour.forEach(labourName => assignedLabours.add(labourName));
        }
      });

      Array.from(assignedLabours).forEach(labourName => {
        const labour = labours.find(l => l.full_name === labourName);
        const excessAmount = labour ? (parseFloat(labourExcessPay[labour.lid]) || 0) : 0;
        const labourWage = parseFloat(labourWages[labourName]) || 0;
        const totalAmount = parseFloat(labourTotalAmounts[labourName]) || (labourWage + excessAmount);
        
        labourPrices.push({
          labourName: labourName,
          labourId: labour?.lid || null,
          labourWage: labourWage,
          excessPay: excessAmount,
          totalAmount: totalAmount
        });
      });

      const summaryData = {
        labourAssignments,
        labourPrices,
        totalPicked: parseFloat(productRows.reduce((sum, r) => sum + (parseFloat(r.pickedQuantity) || 0), 0).toFixed(2)),
        totalWastage: parseFloat(productRows.reduce((sum, r) => sum + (parseFloat(r.wastage) || 0), 0).toFixed(2)),
        totalReuse: parseFloat(productRows.reduce((sum, r) => sum + (parseFloat(r.reuse) || 0), 0).toFixed(2)),
        totalLabours: Object.keys(groupedByLabour).length,
        totalProducts: productRows.length
      };

      // Format data for backend - match new backend structure
      const stage2Data = {
        productAssignments,
        summaryData
      };

      const response = await updateStage2Assignment(id, stage2Data);

      if (response.success) {
        alert(formatExcessStockSaveMessage(excessStockPreview));
        navigate(`/order-assign/stage3/${id}`, { state: { orderData } });
      } else {
        alert('Stage 2 saved but there might be issues: ' + (response.message || 'Unknown error'));
      }
    } catch (error) {
      console.error('Error saving stage 2:', error);
      const errorMsg = error.response?.data?.message || error.message || 'Failed to save stage 2 assignment';
      alert(errorMsg);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-4 sm:p-6 lg:p-8">

      {/* Order Information Table */}
      <div className="bg-white rounded-xl shadow-sm p-6 mb-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900">Order Information</h2>
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
                <td className="px-4 py-3 text-sm text-left text-gray-900">{orderData?.order_auto_id || id}</td>
                <td className="px-4 py-3 text-sm text-left text-gray-900">{orderData?.customer_name || 'N/A'}</td>
                <td className="px-4 py-3 text-sm text-left text-gray-900">{orderData?.items?.length || 0} Items</td>
                <td className="px-4 py-3">
                  <span className={`inline-block px-3 py-1 rounded-full text-xs font-medium ${
                    stage2Status === 'pending' ? 'bg-purple-100 text-purple-700' :
                    stage2Status === 'processing' ? 'bg-yellow-100 text-yellow-700' :
                    stage2Status === 'completed' ? 'bg-emerald-600 text-white' :
                    stage2Status === 'in_progress' ? 'bg-blue-100 text-blue-700' :
                    'bg-gray-100 text-gray-700'
                  }`}>
                    {stage2Status ? stage2Status.charAt(0).toUpperCase() + stage2Status.slice(1).replace('_', ' ') : (orderData?.order_status ? orderData.order_status.charAt(0).toUpperCase() + orderData.order_status.slice(1) : 'N/A')}
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
          onClick={() => navigate(`/order-assign/stage1/${id}`, { state: { orderData } })}
          className="px-6 py-3 bg-white border-2 border-emerald-600 text-emerald-700 rounded-lg font-medium hover:bg-emerald-50 transition-colors flex items-center gap-2"
        >
          <Check className="w-5 h-5" />
          Stage 1: Collected
        </button>
        <button className="px-6 py-3 bg-emerald-600 text-white rounded-lg font-medium shadow-sm hover:bg-emerald-700 transition-colors">
          Stage 2: Packaging
        </button>
        <button
          onClick={() => navigate(`/order-assign/stage3/${id}`, { state: { orderData } })}
          className="px-6 py-3 bg-white border-2 border-gray-300 text-gray-700 rounded-lg font-medium hover:bg-gray-50 transition-colors"
        >
          Stage 3: Delivery
        </button>
        <button
          onClick={() => navigate(`/order-assign/stage4/${id}`)}
          className="px-6 py-3 bg-white border-2 border-gray-300 text-gray-700 rounded-lg font-medium hover:bg-gray-50 transition-colors"
        >
          Stage 4: Price
        </button>
      </div>

      {/* Stage 2 Section */}
      <div className="bg-white rounded-xl shadow-sm p-6 mb-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-2">Stage 2: Packaging & Quality Check</h2>
        <p className="text-sm text-gray-600 mb-6">Assign labour and track wastage for each product</p>

        {/* Product Table - Desktop */}
        <div className="hidden lg:block overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Product</th>
                {isBoxBasedOrder && <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase">No of Boxes/Bags</th>}
                {!isBoxBasedOrder && <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Quantity Needed</th>}
                {isBoxBasedOrder && <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Picked Boxes/Bags</th>}
                {isBoxBasedOrder && <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Weight (kg)</th>}
                {!isBoxBasedOrder && <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Picked Quantity</th>}
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Entity Type</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Name</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Wastage</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Revised Picked</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Entity Stock</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Packed Kgs</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Total Packing</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Reuse</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Assigned Labours</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {productRows.map((row, index) => {
                const firstVendorIndex = productRows.findIndex(r => r.oiid === row.oiid);
                const sameProductRows = productRows.filter(r => r.oiid === row.oiid);
                const rowSpan = sameProductRows.length;

                return (
                  <tr key={row.id} className="hover:bg-gray-50 transition-colors">
                    {row.isFirstVendor && (
                      <td className="px-4 py-4" rowSpan={rowSpan}>
                        <span className="text-sm font-medium text-gray-900">{row.product}</span>
                      </td>
                    )}
                    {row.isFirstVendor && isBoxBasedOrder && (
                      <td className="px-4 py-4" rowSpan={rowSpan}>
                        <span className="text-sm text-gray-900">
                          {row.num_boxes || '-'} {row.net_weight ? `(${row.net_weight} kg)` : ''}
                        </span>
                      </td>
                    )}
                    {row.isFirstVendor && !isBoxBasedOrder && (
                      <td className="px-4 py-4" rowSpan={rowSpan}>
                        <span className="text-sm text-gray-900">{row.quantity}</span>
                      </td>
                    )}
                    {isBoxBasedOrder && (
                      <td className="px-4 py-4">
                        <span className="text-sm text-gray-900">{row.pickedBoxes || '-'}</span>
                      </td>
                    )}
                    {isBoxBasedOrder && (
                      <td className="px-4 py-4">
                        <span className="text-sm text-gray-900">{row.pickedWeight != null && row.pickedWeight !== '' ? `${(parseFloat(row.pickedWeight) || 0).toFixed(1)} kg` : '-'}</span>
                      </td>
                    )}
                    {!isBoxBasedOrder && (
                      <td className="px-4 py-4">
                        <span className="text-sm text-gray-900">{row.pickedQuantity || '-'}</span>
                      </td>
                    )}
                    <td className="px-4 py-4">
                      <span className="text-sm text-gray-900">{row.entityType || '-'}</span>
                    </td>
                    <td className="px-4 py-4">
                      <span className="text-sm text-gray-900">{row.entityName || '-'}</span>
                    </td>
                    <td className="px-4 py-4">
                      <input
                        ref={(el) => {
                          if (el) inputGridRefs.current[`${index}-0`] = el;
                        }}
                        type="text"
                        value={row.wastage}
                        placeholder="Enter wastage"
                        onKeyDown={(e) => handleKeyDown(e, index, 0, productRows.length)}
                        onChange={(e) => {
                          const updatedRows = [...productRows];
                          updatedRows[index].wastage = e.target.value;
                          setProductRows(updatedRows);
                        }}
                        className="w-32 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
                      />
                    </td>
                    <td className="px-4 py-4">
                      <span className="text-sm font-semibold text-blue-600">
                        {(() => {
                          const picked = parseFloat(row.pickedWeight) || 0;
                          const wastage = parseFloat(row.wastage) || 0;
                          const revised = picked - wastage;
                          return `${revised.toFixed(1)} kg`;
                        })()}
                      </span>
                    </td>
                    {row.isFirstVendor && (
                      <td className="px-4 py-4" rowSpan={rowSpan}>
                        <div className="flex items-center gap-2">
                          {(() => {
                            const productName = row.product?.replace(/^\d+\s*-\s*/, '');
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
                    )}
                    <td className="px-4 py-4">
                      <input
                        ref={(el) => {
                          if (el) inputGridRefs.current[`${index}-1`] = el;
                        }}
                        type="text"
                        value={row.packedAmount}
                        placeholder="Enter packed kgs"
                        onKeyDown={(e) => handleKeyDown(e, index, 1, productRows.length)}
                        onChange={(e) => {
                          const updatedRows = [...productRows];
                          updatedRows[index].packedAmount = e.target.value;
                          setProductRows(updatedRows);
                        }}
                        className="w-32 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
                      />
                    </td>
                    {row.isFirstVendor && (
                      <td className="px-4 py-4" rowSpan={rowSpan}>
                        {(() => {
                          const sameProductRows = productRows.filter(r => r.oiid === row.oiid);
                          const totalPacked = sameProductRows.reduce((sum, r) => sum + (parseFloat(r.packedAmount) || 0), 0);
                          const reuse = parseFloat(row.reuse) || 0;
                          const totalPacking = totalPacked + reuse;
                          const needed = parseFloat(row.quantity) || 0;
                          const exceeds = totalPacking > needed;
                          return (
                            <div>
                              <span className={`text-sm font-semibold ${exceeds ? 'text-red-600' : 'text-emerald-600'}`}>
                                {totalPacking.toFixed(2)} kg
                              </span>
                              {exceeds && (
                                <div className="text-xs text-red-600 mt-1">⚠ Exceeds needed qty</div>
                              )}
                            </div>
                          );
                        })()}
                      </td>
                    )}
                    {row.isFirstVendor && (
                      <td className="px-4 py-4" rowSpan={rowSpan}>
                        <input
                          ref={(el) => {
                            if (el) inputGridRefs.current[`${index}-2`] = el;
                          }}
                          type="text"
                          value={row.reuse}
                          placeholder="Enter reuse"
                          onKeyDown={(e) => handleKeyDown(e, index, 2, productRows.length)}
                          onChange={(e) => {
                            const updatedRows = [...productRows];
                            sameProductRows.forEach(r => {
                              const idx = productRows.findIndex(pr => pr.id === r.id);
                              updatedRows[idx].reuse = e.target.value;
                            });
                            setProductRows(updatedRows);
                          }}
                          className="w-32 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
                        />
                      </td>
                    )}
                    <td className="px-4 py-4">
                      <div>
                        {row.labour && row.labour.length > 0 ? (
                          <div className="flex flex-wrap gap-1 mb-2">
                            {row.labour.map((lab, idx) => (
                              <span key={idx} className="px-2 py-1 bg-emerald-100 text-emerald-700 rounded text-xs flex items-center gap-1">
                                {lab}
                                <button
                                  onClick={() => {
                                    const updatedRows = [...productRows];
                                    updatedRows[index].labour = row.labour.filter((_, i) => i !== idx);
                                    setProductRows(updatedRows);
                                  }}
                                  className="text-emerald-700 hover:text-emerald-900 font-bold"
                                >
                                  ×
                                </button>
                              </span>
                            ))}
                          </div>
                        ) : (
                          <div className="text-sm text-gray-400 mb-2">No labours assigned</div>
                        )}

                        {/* Present Labours Dropdown */}
                        <div className="relative labour-dropdown">
                          <button
                            onClick={() => setOpenDropdown(openDropdown === index ? null : index)}
                            className="px-3 py-1.5 bg-blue-500 hover:bg-blue-600 text-white rounded text-xs font-medium flex items-center gap-1"
                          >
                            <User className="w-3 h-3" />
                            Add Labours
                            <ChevronDown className="w-3 h-3" />
                          </button>

                          {openDropdown === index && (
                            <div className="absolute z-50 mt-1 w-48 bg-white border border-gray-200 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                              {labours.length > 0 ? (
                                labours.map((labour) => {
                                  const labourName = labour.full_name || labour.labour_name || labour.name;
                                  const isSelected = row.labour && row.labour.includes(labourName);

                                  return (
                                    <button
                                      key={labour.lid || labour.labour_id}
                                      onClick={() => {
                                        const updatedRows = [...productRows];
                                        if (isSelected) {
                                          // Remove labour
                                          updatedRows[index].labour = row.labour.filter(l => l !== labourName);
                                        } else {
                                          // Add labour
                                          updatedRows[index].labour = [...(row.labour || []), labourName];
                                        }
                                        setProductRows(updatedRows);
                                      }}
                                      className={`w-full text-left px-3 py-2 text-sm hover:bg-gray-50 flex items-center justify-between ${isSelected ? 'bg-emerald-50 text-emerald-700' : 'text-gray-700'
                                        }`}
                                    >
                                      <span>{labourName}</span>
                                      {isSelected && (
                                        <Check className="w-4 h-4 text-emerald-600" />
                                      )}
                                    </button>
                                  );
                                })
                              ) : (
                                <div className="px-3 py-2 text-sm text-gray-500">
                                  No present labours today
                                </div>
                              )}
                            </div>
                          )}
                        </div>
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
          {(() => {
            const groupedProducts = {};
            productRows.forEach(row => {
              if (!groupedProducts[row.oiid]) {
                groupedProducts[row.oiid] = [];
              }
              groupedProducts[row.oiid].push(row);
            });

            return Object.values(groupedProducts).map((vendorRows, groupIndex) => {
              const firstRow = vendorRows[0];
              return (
                <div key={firstRow.oiid} className="border-2 border-emerald-200 rounded-lg p-4 bg-emerald-50">
                  <div className="mb-3 pb-3 border-b-2 border-emerald-300">
                    <p className="text-sm font-semibold text-gray-900">{firstRow.product}</p>
                    <p className="text-xs text-gray-500 mt-1">Quantity Needed: {firstRow.quantity}</p>
                  </div>

                  {/* Vendor-specific data */}
                  <div className="space-y-3 mb-4">
                    {vendorRows.map((row, vendorIndex) => {
                      const rowIndex = productRows.findIndex(r => r.id === row.id);
                      return (
                        <div key={row.id} className="bg-white rounded-lg p-3 border border-gray-300">
                          <p className="text-xs font-semibold text-emerald-700 mb-2">Vendor {vendorIndex + 1}</p>
                          <div className="space-y-2">
                            <div>
                              <label className="text-xs text-gray-500 block mb-1">Picked Quantity</label>
                              <p className="text-sm text-gray-900">{row.pickedQuantity || '-'}</p>
                            </div>
                            <div>
                              <label className="text-xs text-gray-500 block mb-1">Entity Type</label>
                              <p className="text-sm text-gray-900">{row.entityType || '-'}</p>
                            </div>
                            <div>
                              <label className="text-xs text-gray-500 block mb-1">Name</label>
                              <p className="text-sm text-gray-900">{row.entityName || '-'}</p>
                            </div>
                            <div>
                              <label className="text-xs text-gray-500 block mb-1">Entity Stock</label>
                              <div className="flex items-center gap-2">
                                {(() => {
                                  const productName = row.product?.replace(/^\d+\s*-\s*/, '');
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
                            <div>
                              <label className="text-xs text-gray-500 block mb-1">Wastage</label>
                              <input
                                ref={(el) => {
                                  if (el) inputGridRefs.current[`mobile-${rowIndex}-0`] = el;
                                }}
                                type="text"
                                value={row.wastage}
                                placeholder="Enter wastage"
                                onKeyDown={(e) => handleKeyDown(e, rowIndex, 0, productRows.length)}
                                onChange={(e) => {
                                  const updatedRows = [...productRows];
                                  updatedRows[rowIndex].wastage = e.target.value;
                                  setProductRows(updatedRows);
                                }}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                              />
                            </div>
                            <div>
                              <label className="text-xs text-gray-500 block mb-1">Revised Picked Quantity</label>
                              <p className="text-sm font-semibold text-blue-600">
                                {(() => {
                                  const picked = parseFloat(row.pickedQuantity) || 0;
                                  const wastage = parseFloat(row.wastage) || 0;
                                  const revised = picked - wastage;
                                  return revised > 0 ? `${revised.toFixed(2)} kg` : '-';
                                })()}
                              </p>
                            </div>
                            <div>
                              <label className="text-xs text-gray-500 block mb-1">Packed Amount (kg)</label>
                              <input
                                ref={(el) => {
                                  if (el) inputGridRefs.current[`mobile-${rowIndex}-1`] = el;
                                }}
                                type="text"
                                value={row.packedAmount}
                                placeholder="Enter packed amount"
                                onKeyDown={(e) => handleKeyDown(e, rowIndex, 1, productRows.length)}
                                onChange={(e) => {
                                  const updatedRows = [...productRows];
                                  updatedRows[rowIndex].packedAmount = e.target.value;
                                  setProductRows(updatedRows);
                                }}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                              />
                            </div>
                            <div>
                              <label className="text-xs text-gray-500 block mb-1">Total Packing</label>
                              {(() => {
                                const totalPacked = vendorRows.reduce((sum, r) => sum + (parseFloat(r.packedAmount) || 0), 0);
                                const reuse = parseFloat(row.reuse) || 0;
                                const totalPacking = totalPacked + reuse;
                                const needed = parseFloat(row.quantity) || 0;
                                const exceeds = totalPacking > needed;
                                return (
                                  <div>
                                    <p className={`text-sm font-semibold ${exceeds ? 'text-red-600' : 'text-emerald-600'}`}>
                                      {totalPacking.toFixed(2)} kg
                                    </p>
                                    {exceeds && (
                                      <p className="text-xs text-red-600 mt-1">⚠ Exceeds needed quantity</p>
                                    )}
                                  </div>
                                );
                              })()}
                            </div>
                            <div>
                              <label className="text-xs text-gray-500 block mb-1">Reuse</label>
                              <input
                                ref={(el) => {
                                  if (el) inputGridRefs.current[`mobile-${rowIndex}-2`] = el;
                                }}
                                type="text"
                                value={row.reuse}
                                placeholder="Enter reuse"
                                onKeyDown={(e) => handleKeyDown(e, rowIndex, 2, productRows.length)}
                                onChange={(e) => {
                                  const updatedRows = [...productRows];
                                  updatedRows[rowIndex].reuse = e.target.value;
                                  setProductRows(updatedRows);
                                }}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                              />
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Common fields for all vendors */}
                  <div className="bg-white rounded-lg p-3 border-2 border-emerald-400">
                    <p className="text-xs font-semibold text-emerald-700 mb-3">Common for all vendors</p>
                    <div className="space-y-3">
                      <div>
                        <label className="text-xs text-gray-500 block mb-1">Select Labour (Multiple)</label>
                        <div className="relative labour-dropdown">
                          <button
                            type="button"
                            onClick={() => setOpenDropdown(openDropdown === `mobile-${groupIndex}` ? null : `mobile-${groupIndex}`)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-left bg-white flex items-center justify-between"
                          >
                            <span className="truncate">
                              {firstRow.labour && firstRow.labour.length > 0 ? `${firstRow.labour.length} selected` : 'Select labour...'}
                            </span>
                            <ChevronDown className="w-4 h-4 text-gray-600" />
                          </button>
                          {openDropdown === `mobile-${groupIndex}` && (
                            <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-60 overflow-auto">
                              {labours.map(labour => (
                                <label key={labour.lid} className="flex items-center px-3 py-2 hover:bg-gray-50 cursor-pointer">
                                  <input
                                    type="checkbox"
                                    checked={firstRow.labour.includes(labour.full_name)}
                                    onChange={(e) => {
                                      const updatedRows = [...productRows];
                                      const newLabour = e.target.checked
                                        ? [...firstRow.labour, labour.full_name]
                                        : firstRow.labour.filter(l => l !== labour.full_name);
                                      vendorRows.forEach(r => {
                                        const idx = productRows.findIndex(pr => pr.id === r.id);
                                        updatedRows[idx].labour = newLabour;
                                      });
                                      setProductRows(updatedRows);
                                    }}
                                    className="mr-2"
                                  />
                                  <span className="text-sm">{labour.full_name}</span>
                                </label>
                              ))}
                            </div>
                          )}
                        </div>
                        {firstRow.labour && firstRow.labour.length > 0 && (
                          <div className="mt-2 flex flex-wrap gap-1">
                            {firstRow.labour.map((lab, idx) => (
                              <span key={idx} className="px-2 py-1 bg-emerald-100 text-emerald-700 rounded text-xs">
                                {lab}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            });
          })()}
        </div>
      </div>

      {/* Summary Section - Grouped by Labour */}
      {productRows.some(row => row.labour) && (
        <>
        <div className="bg-gradient-to-br from-emerald-50 to-teal-50 rounded-xl shadow-sm p-6 mb-6 border-2 border-emerald-200">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 bg-emerald-600 rounded-lg">
              <Package className="w-6 h-6 text-white" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-gray-900">Packaging Summary</h2>
              <p className="text-sm text-gray-600">Products grouped by assigned labour</p>
            </div>
          </div>

          {/* Desktop Summary */}
          <div className="hidden lg:block space-y-6">
            {(() => {
              const groupedByLabour = {};
              productRows.forEach(row => {
                if (row.labour && Array.isArray(row.labour) && row.labour.length > 0) {
                  row.labour.forEach(labourName => {
                    if (!groupedByLabour[labourName]) {
                      groupedByLabour[labourName] = [];
                    }
                    groupedByLabour[labourName].push(row);
                  });
                }
              });

              return Object.entries(groupedByLabour).map(([labourName, rows]) => {
                const totalWastage = rows.reduce((sum, r) => sum + (parseFloat(r.wastage) || 0), 0);
                const totalReuse = rows.reduce((sum, r) => sum + (parseFloat(r.reuse) || 0), 0);
                const totalPicked = rows.reduce((sum, r) => sum + (parseFloat(r.pickedQuantity) || 0), 0);

                return (
                  <div key={labourName} className="bg-white rounded-lg shadow-sm overflow-hidden border-2 border-emerald-300">
                    <div className="bg-gradient-to-r from-emerald-600 to-teal-600 px-6 py-4">
                      <div className="flex items-center gap-3 text-white">
                        <User className="w-6 h-6" />
                        <div>
                          <h3 className="text-lg font-bold">{labourName}</h3>
                          <p className="text-sm text-emerald-100">{rows.length} Products</p>
                        </div>
                      </div>
                    </div>

                    <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead className="bg-emerald-50">
                          <tr>
                            <th className="px-4 py-3 text-left text-xs font-bold text-gray-700 uppercase">Product</th>
                            <th className="px-4 py-3 text-left text-xs font-bold text-gray-700 uppercase">Entity Type</th>
                            <th className="px-4 py-3 text-left text-xs font-bold text-gray-700 uppercase">Entity Name</th>
                            <th className="px-4 py-3 text-left text-xs font-bold text-gray-700 uppercase">No. of Boxes/Bags</th>
                            <th className="px-4 py-3 text-left text-xs font-bold text-gray-700 uppercase">Picked Boxes/Bags</th>
                            <th className="px-4 py-3 text-left text-xs font-bold text-gray-700 uppercase">Picked Qty</th>
                            <th className="px-4 py-3 text-left text-xs font-bold text-gray-700 uppercase">Wastage</th>
                            <th className="px-4 py-3 text-left text-xs font-bold text-gray-700 uppercase">Revised Picked</th>
                            <th className="px-4 py-3 text-left text-xs font-bold text-gray-700 uppercase">Packed Amount</th>
                            <th className="px-4 py-3 text-left text-xs font-bold text-gray-700 uppercase">Reuse</th>
                            <th className="px-4 py-3 text-left text-xs font-bold text-gray-700 uppercase">Start Time</th>
                            <th className="px-4 py-3 text-left text-xs font-bold text-gray-700 uppercase">End Time</th>
                            <th className="px-4 py-3 text-left text-xs font-bold text-gray-700 uppercase">Packed Boxes</th>
                            <th className="px-4 py-3 text-left text-xs font-bold text-gray-700 uppercase">Status</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200">
                          {rows.map((row, idx) => (
                            <tr key={idx} className="hover://bg-emerald-50 transition-colors">
                              <td className="px-4 py-3">
                                <div className="flex items-center gap-2">
                                  <div className="w-2 h-2 bg-emerald-500 rounded-full"></div>
                                  <span className="text-sm font-medium text-gray-900">{row.product}</span>
                                </div>
                              </td>
                              <td className="px-4 py-3">
                                <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-100 text-emerald-800 capitalize">
                                  {row.entityType || '-'}
                                </span>
                              </td>
                              <td className="px-4 py-3">
                                <span className="text-sm text-gray-900">{row.entityName || '-'}</span>
                              </td>
                              <td className="px-4 py-3">
                                <span className="text-sm font-semibold text-gray-900">{row.num_boxes ?? 0}</span>
                              </td>
                              <td className="px-4 py-3">
                                <span className="text-sm font-semibold text-gray-900">{row.pickedBoxes || 0}</span>
                              </td>
                              <td className="px-4 py-3">
                                <span className="text-sm font-semibold text-gray-900">{(parseFloat(row.pickedWeight) || 0).toFixed(1)} kg</span>
                              </td>
                              <td className="px-4 py-3">
                                <span className="text-sm text-gray-900">{row.wastage || 0} kg</span>
                              </td>
                              <td className="px-4 py-3">
                                <span className="text-sm font-semibold text-blue-600">
                                  {((parseFloat(row.pickedWeight) || 0) - (parseFloat(row.wastage) || 0)).toFixed(1)} kg
                                </span>
                              </td>
                              <td className="px-4 py-3">
                                <span className="text-sm text-gray-900">{row.packedAmount || 0} kg</span>
                              </td>
                              <td className="px-4 py-3">
                                <span className="text-sm text-gray-900">{row.reuse || 0} kg</span>
                              </td>
                              <td className="px-4 py-3">
                                <input
                                  ref={(el) => {
                                    if (el) {
                                      inputGridRefs.current[`summary-${labourName}-${idx}-0`] = el;
                                    }
                                  }}
                                  type="time"
                                  value={row[`startTime_${row.id}-${labourName}`] || ''}
                                  onKeyDown={(e) => handleSummaryKeyDown(e, labourName, idx, 0, rows.length)}
                                  onChange={(e) => {
                                    const updatedRows = [...productRows];
                                    const rowIndex = productRows.findIndex(r => r.id === row.id);
                                    if (rowIndex !== -1) {
                                      updatedRows[rowIndex][`startTime_${row.id}-${labourName}`] = e.target.value;
                                      setProductRows(updatedRows);
                                    }
                                  }}
                                  className="w-32 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
                                />
                              </td>
                              <td className="px-4 py-3">
                                <input
                                  ref={(el) => {
                                    if (el) {
                                      inputGridRefs.current[`summary-${labourName}-${idx}-1`] = el;
                                    }
                                  }}
                                  type="time"
                                  value={row[`endTime_${row.id}-${labourName}`] || ''}
                                  onKeyDown={(e) => handleSummaryKeyDown(e, labourName, idx, 1, rows.length)}
                                  onChange={(e) => {
                                    const updatedRows = [...productRows];
                                    const rowIndex = productRows.findIndex(r => r.id === row.id);
                                    if (rowIndex !== -1) {
                                      updatedRows[rowIndex][`endTime_${row.id}-${labourName}`] = e.target.value;
                                      setProductRows(updatedRows);
                                    }
                                  }}
                                  className="w-32 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
                                />
                              </td>
                              <td className="px-4 py-3">
                                <input
                                  ref={(el) => {
                                    if (el) {
                                      inputGridRefs.current[`summary-${labourName}-${idx}-2`] = el;
                                    }
                                  }}
                                  type="number"
                                  min="0"
                                  max={getPackedBoxesCap(row) || undefined}
                                  value={row[`packedBoxes_${row.id}-${labourName}`] || ''}
                                  placeholder={`Max ${getPackedBoxesCap(row)}`}
                                  onKeyDown={(e) => handleSummaryKeyDown(e, labourName, idx, 2, rows.length)}
                                  onChange={(e) => updatePackedBoxesField(row.id, labourName, e.target.value)}
                                  className="w-24 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
                                />
                              </td>
                              <td>
                                <select
                                  ref={(el) => {
                                    if (el) {
                                      inputGridRefs.current[`summary-${labourName}-${idx}-3`] = el;
                                    }
                                  }}
                                  onKeyDown={(e) => handleSummaryKeyDown(e, labourName, idx, 3, rows.length)}
                                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
                                  value={row[`status_${row.id}-${labourName}`] || 'pending'}
                                  onChange={(e) => {
                                    const updatedRows = [...productRows];
                                    const rowIndex = productRows.findIndex(r => r.id === row.id);
                                    if (rowIndex !== -1) {
                                      updatedRows[rowIndex][`status_${row.id}-${labourName}`] = e.target.value;
                                      setProductRows(updatedRows);
                                    }
                                  }}
                                >
                                  <option value="completed">Completed</option>
                                  <option value="packing">Packing in Process</option>
                                  <option value="pending">Pending</option>
                                </select>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                );
              });
            })()}
          </div>

          {/* Mobile Summary */}
          <div className="lg:hidden space-y-6">
            {(() => {
              const groupedByLabour = {};
              productRows.forEach(row => {
                if (row.labour && Array.isArray(row.labour) && row.labour.length > 0) {
                  row.labour.forEach(labourName => {
                    if (!groupedByLabour[labourName]) {
                      groupedByLabour[labourName] = [];
                    }
                    groupedByLabour[labourName].push(row);
                  });
                }
              });

              return Object.entries(groupedByLabour).map(([labourName, rows]) => {
                const totalWastage = rows.reduce((sum, r) => sum + (parseFloat(r.wastage) || 0), 0);
                const totalReuse = rows.reduce((sum, r) => sum + (parseFloat(r.reuse) || 0), 0);
                const totalPicked = rows.reduce((sum, r) => sum + (parseFloat(r.pickedQuantity) || 0), 0);

                return (
                  <div key={labourName} className="bg-white rounded-lg shadow-sm overflow-hidden border-2 border-emerald-300">
                    <div className="bg-gradient-to-r from-emerald-600 to-teal-600 px-4 py-3">
                      <div className="flex items-center gap-2 text-white">
                        <User className="w-5 h-5" />
                        <div>
                          <h3 className="text-base font-bold">{labourName}</h3>
                          <p className="text-xs text-emerald-100">{rows.length} Products</p>
                        </div>
                      </div>
                    </div>

                    <div className="p-4 space-y-3">
                      {rows.map((row, idx) => (
                        <div key={idx} className="border border-gray-200 rounded-lg p-3">
                          <div className="flex items-start justify-between mb-2">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-1">
                                <div className="w-2 h-2 bg-emerald-500 rounded-full"></div>
                                <span className="text-sm font-semibold text-gray-900">{row.product}</span>
                              </div>
                            </div>
                            <span className="text-xs font-medium px-2 py-1 rounded-full bg-emerald-100 text-emerald-800 capitalize">
                              {row.entityType || '-'}
                            </span>
                          </div>

                          <div className="space-y-2 text-sm">
                            <div className="flex justify-between">
                              <span className="text-gray-600">Entity Name:</span>
                              <span className="text-gray-900">{row.entityName || '-'}</span>
                            </div>
                            <div className="flex justify-between pt-2 border-t border-gray-200">
                              <span className="text-gray-700">Picked:</span>
                              <span className="font-semibold text-gray-900">{row.pickedQuantity || 0} kg</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-gray-700">Wastage:</span>
                              <span className="text-gray-900">{row.wastage || 0} kg</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-gray-700">Revised Picked:</span>
                              <span className="font-semibold text-blue-600">{((parseFloat(row.pickedQuantity) || 0) - (parseFloat(row.wastage) || 0)).toFixed(2)} kg</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-gray-700">Packed Amount:</span>
                              <span className="text-gray-900">{row.packedAmount || 0} kg</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-gray-700">Reuse:</span>
                              <span className="text-gray-900">{row.reuse || 0} kg</span>
                            </div>
                            <div className="pt-2 border-t border-gray-200">
                              <label className="block text-xs font-semibold text-gray-700 mb-1">Status</label>
                              <select
                                ref={(el) => {
                                  if (el) {
                                    inputGridRefs.current[`summary-mobile-${labourName}-${idx}-3`] = el;
                                  }
                                }}
                                onKeyDown={(e) => handleSummaryKeyDown(e, labourName, idx, 3, rows.length)}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
                                value={row[`status_${row.id}-${labourName}`] || 'pending'}
                                onChange={(e) => {
                                  const updatedRows = [...productRows];
                                  const rowIndex = productRows.findIndex(r => r.id === row.id);
                                  if (rowIndex !== -1) {
                                    updatedRows[rowIndex][`status_${row.id}-${labourName}`] = e.target.value;
                                    setProductRows(updatedRows);
                                  }
                                }}
                              >
                                <option value="completed">Completed</option>
                                <option value="packing">Packing in Process</option>
                                <option value="pending">Pending</option>
                              </select>
                            </div>
                            <div className="pt-2">
                              <label className="block text-xs font-semibold text-gray-700 mb-1">Packed Boxes</label>
                              <input
                                ref={(el) => {
                                  if (el) {
                                    inputGridRefs.current[`summary-mobile-${labourName}-${idx}-2`] = el;
                                  }
                                }}
                                type="number"
                                min="0"
                                max={getPackedBoxesCap(row) || undefined}
                                value={row[`packedBoxes_${row.id}-${labourName}`] || ''}
                                placeholder={`Max ${getPackedBoxesCap(row)}`}
                                onKeyDown={(e) => handleSummaryKeyDown(e, labourName, idx, 2, rows.length)}
                                onChange={(e) => updatePackedBoxesField(row.id, labourName, e.target.value)}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
                              />
                            </div>
                            <div className="pt-2">
                              <label className="block text-xs font-semibold text-gray-700 mb-1">Start Time</label>
                              <input
                                ref={(el) => {
                                  if (el) {
                                    inputGridRefs.current[`summary-mobile-${labourName}-${idx}-0`] = el;
                                  }
                                }}
                                type="time"
                                value={row[`startTime_${row.id}-${labourName}`] || ''}
                                onKeyDown={(e) => handleSummaryKeyDown(e, labourName, idx, 0, rows.length)}
                                onChange={(e) => {
                                  const updatedRows = [...productRows];
                                  const rowIndex = productRows.findIndex(r => r.id === row.id);
                                  if (rowIndex !== -1) {
                                    updatedRows[rowIndex][`startTime_${row.id}-${labourName}`] = e.target.value;
                                    setProductRows(updatedRows);
                                  }
                                }}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
                              />
                            </div>
                            <div className="pt-2">
                              <label className="block text-xs font-semibold text-gray-700 mb-1">End Time</label>
                              <input
                                ref={(el) => {
                                  if (el) {
                                    inputGridRefs.current[`summary-mobile-${labourName}-${idx}-1`] = el;
                                  }
                                }}
                                type="time"
                                value={row[`endTime_${row.id}-${labourName}`] || ''}
                                onKeyDown={(e) => handleSummaryKeyDown(e, labourName, idx, 1, rows.length)}
                                onChange={(e) => {
                                  const updatedRows = [...productRows];
                                  const rowIndex = productRows.findIndex(r => r.id === row.id);
                                  if (rowIndex !== -1) {
                                    updatedRows[rowIndex][`endTime_${row.id}-${labourName}`] = e.target.value;
                                    setProductRows(updatedRows);
                                  }
                                }}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
                              />
                            </div>
                          </div>
                        </div>
                      ))}

                      <div className="bg-emerald-100 rounded-lg p-3 border-2 border-emerald-300">
                        <div className="space-y-2 text-sm">
                          <div className="flex justify-between">
                            <span className="font-bold text-gray-900">Total Picked:</span>
                            <span className="font-bold text-emerald-700">{totalPicked.toFixed(2)} kg</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="font-bold text-gray-900">Total Wastage:</span>
                            <span className="font-bold text-red-700">{totalWastage.toFixed(2)} kg</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="font-bold text-gray-900">Total Revised:</span>
                            <span className="font-bold text-blue-700">{(totalPicked - totalWastage).toFixed(2)} kg</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="font-bold text-gray-900">Total Reuse:</span>
                            <span className="font-bold text-blue-700">{totalReuse.toFixed(2)} kg</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              });
            })()}
          </div>


        </div>
        </>
      )}

      <Stage2ExcessStockPreview productRows={productRows} />

      {/* Action Buttons */}
      <div className="flex flex-col sm:flex-row justify-end gap-3">
        <button
          onClick={() => navigate(`/order-assign/stage1/${id}`, { state: { orderData } })}
          className="px-6 py-3 border-2 border-gray-300 text-gray-700 rounded-lg font-medium hover:bg-gray-50 transition-colors"
        >
          Back
        </button>
        <button
          onClick={handleSaveStage2}
          className="px-6 py-3 bg-emerald-600 text-white rounded-lg font-medium shadow-sm hover:bg-emerald-700 transition-colors"
        >
          Save Stage 2
        </button>
      </div>
    </div>
  );
};

export default OrderAssignCreateStage2;