import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation, useParams } from 'react-router-dom';
import { Check, ChevronDown, Truck, Package, MapPin, Plus, X } from 'lucide-react';
import { getPresentDriversToday } from '../../../api/driverApi';
import { updateStage3Assignment } from '../../../api/orderAssignmentApi';
import { getAllAirports } from '../../../api/airportApi';
import InsufficientStockModal from '../../../components/common/InsufficientStockModal';
import { sortDropdownObjects } from '../../../utils/dropdownSort';

const OrderAssignCreateStage3 = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { id } = useParams();
  const orderData = location.state?.orderData;
  const stage2Data = location.state?.stage2Data;

  const [drivers, setDrivers] = useState([]);
  const [productRows, setProductRows] = useState([]);
  const [airports, setAirports] = useState([]);
  const [tapes, setTapes] = useState([]);
  const [airportTapeData, setAirportTapeData] = useState({});
  const [stage3Status, setStage3Status] = useState(null); // Store stage3_status from assignment data
  // Initial edit flag can come from navigation state (when user clicks "Edit Assign")
  // and will also be forced to true when existing stage3_data is detected.
  const [isEdit, setIsEdit] = useState(!!location.state?.isEdit); // Flag to indicate edit mode
  const [stage2BoxStatus, setStage2BoxStatus] = useState({}); // { oiid: { available: number, pending: number } }
  const [noOfPkgsWarning, setNoOfPkgsWarning] = useState({}); // { rowId: 'warning message' } when No of Pkgs > Avl Box
  const [stockModalOpen, setStockModalOpen] = useState(false);
  const [stockModalMessage, setStockModalMessage] = useState('');

  // Refs for keyboard navigation in main table (No of Pkgs, Airport, Driver)
  const inputGridRefs = useRef({});

  // airportTapeData: { [airportName]: [ { tapeName, tapeQuantity, tapeColor }, ... ] } — multiple tapes per airport
  const getTapesForAirport = (airport) => {
    const val = airportTapeData[airport];
    if (Array.isArray(val) && val.length > 0) return val;
    if (val && typeof val === 'object' && !Array.isArray(val)) return [{ tapeName: val.tapeName || '', tapeQuantity: val.tapeQuantity != null ? val.tapeQuantity : '', tapeColor: val.tapeColor || '' }];
    return [{ tapeName: '', tapeQuantity: '', tapeColor: '' }];
  };
  const addTapeForAirport = (airport) => {
    setAirportTapeData(prev => ({
      ...prev,
      [airport]: [...getTapesForAirport(airport), { tapeName: '', tapeQuantity: '', tapeColor: '' }]
    }));
  };
  const updateTapeForAirport = (airport, tapeIndex, fieldOrPatch, value) => {
    setAirportTapeData(prev => {
      const raw = prev[airport];
      const list = Array.isArray(raw) && raw.length > 0 ? raw : (raw && typeof raw === 'object' ? [{ tapeName: raw.tapeName || '', tapeQuantity: raw.tapeQuantity != null ? raw.tapeQuantity : '', tapeColor: raw.tapeColor || '' }] : [{ tapeName: '', tapeQuantity: '', tapeColor: '' }]);
      const next = [...list];
      if (!next[tapeIndex]) return prev;
      if (typeof fieldOrPatch === 'object') {
        next[tapeIndex] = { ...next[tapeIndex], ...fieldOrPatch };
      } else {
        next[tapeIndex] = { ...next[tapeIndex], [fieldOrPatch]: value };
      }
      return { ...prev, [airport]: next };
    });
  };
  const removeTapeForAirport = (airport, tapeIndex) => {
    setAirportTapeData(prev => {
      const raw = prev[airport];
      const list = Array.isArray(raw) && raw.length > 0 ? raw : (raw && typeof raw === 'object' ? [{ tapeName: raw.tapeName || '', tapeQuantity: raw.tapeQuantity != null ? raw.tapeQuantity : '', tapeColor: raw.tapeColor || '' }] : [{ tapeName: '', tapeQuantity: '', tapeColor: '' }]);
      if (list.length <= 1) return prev;
      return { ...prev, [airport]: list.filter((_, i) => i !== tapeIndex) };
    });
  };

  // Handle arrow key navigation between inputs
  const handleKeyDown = (e, rowIndex, colIndex, totalRows) => {
    const arrowKeys = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'];
    if (!arrowKeys.includes(e.key)) return;

    e.preventDefault();

    // Column mapping: 0 = No of Pkgs, 1 = Airport Name, 2 = Select Driver
    const columnCount = 3;
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

  // Helper function to parse num_boxes
  const parseNumBoxes = (numBoxesStr) => {
    if (!numBoxesStr) return 0;
    const match = String(numBoxesStr).match(/^(\d+(?:\.\d+)?)/);
    return match ? parseFloat(match[1]) : 0;
  };

  // Load available drivers and product data
  useEffect(() => {
    const loadData = async () => {
      try {
        const [driversResponse, airportsResponse, tapesResponse] = await Promise.all([
          getPresentDriversToday(),
          getAllAirports(),
          (async () => {
            const { getTapes } = await import('../../../api/inventoryApi');
            return getTapes();
          })()
        ]);

        const presentDrivers = driversResponse.data?.map(record => record.driver).filter(d => d) || [];
        setDrivers(presentDrivers);
        setAirports(airportsResponse.data || []);
        if (tapesResponse.success) {
          setTapes(tapesResponse.data || []);
        }

        // Load assignment data to get stage2 and stage3 assignments
        let stage2LabourMap = {};
        let stage2BoxStatusMap = {}; // Track packed (available) boxes from Stage 2
        let stage3Products = [];
        let productCountMap = {};
        try {
          const { getOrderAssignment } = await import('../../../api/orderAssignmentApi');
          const assignmentResponse = await getOrderAssignment(id);
          const assignmentData = assignmentResponse.data;

          // Store stage3_status from assignment data
          if (assignmentData.stage3_status) {
            setStage3Status(assignmentData.stage3_status);
          }

          console.log('=== FULL ASSIGNMENT DATA ===');
          console.log('All keys:', Object.keys(assignmentData));
          console.log('stage2_summary_data exists?', !!assignmentData.stage2_summary_data);
          console.log('stage2_summary_data type:', typeof assignmentData.stage2_summary_data);
          if (assignmentData.stage2_summary_data) {
            console.log('stage2_summary_data raw:', assignmentData.stage2_summary_data);
          }

          // Get labour data from stage1_summary_data
          if (assignmentData.stage1_summary_data) {
            try {
              const stage1Data = typeof assignmentData.stage1_summary_data === 'string'
                ? JSON.parse(assignmentData.stage1_summary_data)
                : assignmentData.stage1_summary_data;

              //console.log('Stage 1 Summary Data:', stage1Data);

              // Extract labour from driverAssignments
              if (stage1Data.driverAssignments) {
                stage1Data.driverAssignments.forEach(driverGroup => {
                  driverGroup.assignments?.forEach(assignment => {
                    const oiid = String(assignment.oiid).split('-')[0];
                    const labours = assignment.labour || [];

                    if (labours.length > 0) {
                      if (!stage2LabourMap[oiid]) {
                        stage2LabourMap[oiid] = [];
                      }
                      labours.forEach(labour => {
                        if (!stage2LabourMap[oiid].includes(labour)) {
                          stage2LabourMap[oiid].push(labour);
                        }
                      });
                    }
                  });
                });
              }

              console.log('Labour Map from stage1_summary_data (still arrays):', stage2LabourMap);
            } catch (e) {
              console.error('Error parsing stage1_summary_data:', e);
            }
          }

          // Get product count from Stage 1 detailed data
          if (assignmentData.stage1_data) {
            try {
              const stage1Data = typeof assignmentData.stage1_data === 'string'
                ? JSON.parse(assignmentData.stage1_data)
                : assignmentData.stage1_data;
              const assignments = stage1Data.productAssignments || stage1Data.assignments || [];
              assignments.forEach(a => {
                const key = a.id || a.oiid;
                if (!key) return;
                const countVal = a.productCount != null ? a.productCount : a.product_count;
                if (countVal != null && productCountMap[key] == null) {
                  productCountMap[key] = countVal;
                }
              });
            } catch (e) {
              console.error('Error parsing stage1_data for product counts:', e);
            }
          } else if (assignmentData.product_assignments) {
            try {
              const assignments = typeof assignmentData.product_assignments === 'string'
                ? JSON.parse(assignmentData.product_assignments)
                : assignmentData.product_assignments;
              assignments.forEach(a => {
                const key = a.id || a.oiid;
                if (!key) return;
                const countVal = a.productCount != null ? a.productCount : a.product_count;
                if (countVal != null && productCountMap[key] == null) {
                  productCountMap[key] = countVal;
                }
              });
            } catch (e) {
              console.error('Error parsing product_assignments for product counts:', e);
            }
          }

          // Parse stage2_summary_data to get labour data (PRIMARY SOURCE)
          if (assignmentData.stage2_summary_data) {
            try {
              const stage2SummaryData = typeof assignmentData.stage2_summary_data === 'string'
                ? JSON.parse(assignmentData.stage2_summary_data)
                : assignmentData.stage2_summary_data;

              console.log('=== STAGE 2 SUMMARY DATA ===');
              console.log('Full structure:', stage2SummaryData);

              // The structure is: labourAssignments -> each has labour name and assignments array
              const labourAssignments = stage2SummaryData.labourAssignments || [];

              console.log('Labour Assignments found:', labourAssignments.length);

              labourAssignments.forEach(labourGroup => {
                const labourName = labourGroup.labour;
                const assignments = labourGroup.assignments || [];

                console.log(`Processing labour: ${labourName}, assignments:`, assignments.length);

                assignments.forEach(assignment => {
                  const productId = assignment.oiid || assignment.id;

                  console.log(`  - Product ${productId}: adding labour "${labourName}"`);

                  if (productId && labourName) {
                    if (!stage2LabourMap[productId]) {
                      stage2LabourMap[productId] = [];
                    }

                    // Add labour if not already in the list
                    if (!stage2LabourMap[productId].includes(labourName)) {
                      stage2LabourMap[productId].push(labourName);
                    }
                  }

                  // Build box status map based on packedBoxes and status
                  // Build box status map based on packedBoxes.
                  // We only care about how many boxes are already packed
                  // (completed). Pending count will be derived later as:
                  // totalBoxes - availableBoxes.
                  if (productId) {
                    const packedBoxes = parseInt(assignment.packedBoxes) || 0;
                    const status = (assignment.status || '').toLowerCase();

                    if (!stage2BoxStatusMap[productId]) {
                      stage2BoxStatusMap[productId] = { available: 0 };
                    }

                    if (status === 'completed') {
                      stage2BoxStatusMap[productId].available += packedBoxes;
                    }
                  }
                });
              });

              console.log('Labour Map from stage2_summary_data:', stage2LabourMap);
            } catch (e) {
              console.error('Error parsing stage2_summary_data:', e);
            }
          }

          // Try multiple possible field names for stage2 data (fallback)
          let stage2DataRaw = assignmentData.stage2_data ||
            assignmentData.stage2SummaryData ||
            assignmentData.summary_data;

          // Parse stage2_data to get labour data (fallback if summary didn't have it)
          if (stage2DataRaw && Object.keys(stage2LabourMap).length === 0) {
            try {
              const stage2Data = typeof stage2DataRaw === 'string'
                ? JSON.parse(stage2DataRaw)
                : stage2DataRaw;

              console.log('Stage 2 Data (fallback):', stage2Data);
              const productAssignments = stage2Data.productAssignments ||
                stage2Data.assignments ||
                stage2Data.stage2Assignments || [];
              console.log('Product Assignments (fallback):', productAssignments);

              productAssignments.forEach(pa => {
                const productId = pa.id || pa.oiid;
                const labourName = pa.labourName || pa.labourNames || pa.labour;

                if (productId && labourName) {
                  if (!stage2LabourMap[productId]) {
                    stage2LabourMap[productId] = [];
                  }

                  // Handle both string and array labour names
                  const labourArray = Array.isArray(labourName) ? labourName : [labourName];
                  labourArray.forEach(labour => {
                    if (labour && !stage2LabourMap[productId].includes(labour)) {
                      stage2LabourMap[productId].push(labour);
                    }
                  });
                }
              });

              console.log('Labour Map from stage2_data:', stage2LabourMap);
            } catch (e) {
              console.error('Error parsing stage2_data:', e);
            }
          }

          // Convert arrays to comma-separated strings
          Object.keys(stage2LabourMap).forEach(key => {
            if (Array.isArray(stage2LabourMap[key])) {
              stage2LabourMap[key] = stage2LabourMap[key].join(', ');
            }
          });

          console.log('Final Labour Map:', stage2LabourMap);
          console.log('Stage 2 Box Status Map:', stage2BoxStatusMap);

          // Parse stage3_data to get saved stage3 data
          if (assignmentData.stage3_data) {
            setIsEdit(true);
            try {
              const stage3Data = typeof assignmentData.stage3_data === 'string'
                ? JSON.parse(assignmentData.stage3_data)
                : assignmentData.stage3_data;
              stage3Products = stage3Data.products || [];

              // Load airport tape data
              const tapeFromGroups = {};
              const ag = stage3Data.summaryData?.airportGroups || stage3Data.airportGroups || {};
              Object.values(ag).forEach((g) => {
                if (!g || !g.airportName) return;
                if (Array.isArray(g.tapes) && g.tapes.length > 0) {
                  tapeFromGroups[g.airportName] = g.tapes.map(t => ({
                    tapeName: t.tapeName || '',
                    tapeQuantity: t.tapeQuantity != null ? t.tapeQuantity : '',
                    tapeColor: t.tapeColor || ''
                  }));
                } else if (g.tapeName != null || g.tapeQuantity != null || g.tapeColor != null) {
                  tapeFromGroups[g.airportName] = [{ tapeName: g.tapeName || '', tapeQuantity: g.tapeQuantity != null ? g.tapeQuantity : '', tapeColor: g.tapeColor || '' }];
                }
              });
              if (Object.keys(tapeFromGroups).length > 0) {
                setAirportTapeData(tapeFromGroups);
              } else if (stage3Data.airportTapeData) {
                const normalized = {};
                Object.entries(stage3Data.airportTapeData).forEach(([apt, val]) => {
                  normalized[apt] = Array.isArray(val) ? val : [{ tapeName: val.tapeName || '', tapeQuantity: val.tapeQuantity != null ? val.tapeQuantity : '', tapeColor: val.tapeColor || '' }];
                });
                setAirportTapeData(normalized);
              }
            } catch (e) {
              console.error('Error parsing stage3_data:', e);
            }
          }

          // Parse stage3_summary_data to get status updates
          if (assignmentData.stage3_summary_data) {
            try {
              const stage3SummaryData = typeof assignmentData.stage3_summary_data === 'string'
                ? JSON.parse(assignmentData.stage3_summary_data)
                : assignmentData.stage3_summary_data;

              const driverAssignments = stage3SummaryData.driverAssignments || [];
              driverAssignments.forEach(driverGroup => {
                const assignments = driverGroup.assignments || [];
                assignments.forEach(assignment => {
                  const oiid = assignment.oiid;
                  let status = assignment.status;
                  if (oiid && status && stage3Products.length > 0) {
                    // Normalize status: "On Trip" -> "ontrip", "Completed" -> "completed"
                    status = status.toLowerCase().replace(/\s+/g, '');
                    const productIndex = stage3Products.findIndex(p => p.oiid === oiid && p.ct === assignment.ct);
                    if (productIndex !== -1) {
                      stage3Products[productIndex].status = status;
                    }
                  }
                });
              });
            } catch (e) {
              console.error('Error parsing stage3_summary_data:', e);
            }
          }
        } catch (error) {
          console.error('Error loading assignments:', error);
        }

        // Build quick lookup for order items by oiid
        const orderItemsByOiid = {};
        if (orderData?.items) {
          orderData.items.forEach(item => {
            if (item.oiid != null) {
              orderItemsByOiid[item.oiid] = item;
            }
          });
        }

        // Initialize product rows from order data
        if (orderData?.items) {
          let rows = [];

          // If stage3 data exists, use it
          if (stage3Products && stage3Products.length > 0) {
            rows = stage3Products.map((s3Product) => {
              const orderItem = orderItemsByOiid[s3Product.oiid] || {};
              const totalBoxes = s3Product.totalBoxes || parseNumBoxes(orderItem.num_boxes);
              const boxStatus = stage2BoxStatusMap[s3Product.oiid] || { available: 0 };
              const availableBoxes = boxStatus.available || 0;
              const pendingBoxes = Math.max(totalBoxes - availableBoxes, 0);
              const productCount = productCountMap[s3Product.oiid] ?? '';

              return {
                id: s3Product.id || `${s3Product.oiid}-${s3Product.assignmentIndex || 0}`,
                oiid: s3Product.oiid,
                product: s3Product.product,
                grossWeight: s3Product.grossWeight,
                totalBoxes: totalBoxes,
                availableBoxes: availableBoxes,
                pendingBoxes: pendingBoxes,
                labour: s3Product.labour || '-',
                ct: s3Product.ct || '',
                noOfPkgs: s3Product.noOfPkgs || '',
                selectedDriver: s3Product.selectedDriver || '',
                airportName: s3Product.airportName || '',
                airportLocation: s3Product.airportLocation || '',
                vehicleNumber: s3Product.vehicleNumber || '',
                phoneNumber: s3Product.phoneNumber || '',
                vehicleCapacity: s3Product.vehicleCapacity || '',
                status: s3Product.status || 'pending',
                assignmentIndex: s3Product.assignmentIndex || 0,
                productCount
              };
            });
          } else {
            // Initialize from order data if no stage3 data exists
            rows = orderData.items.map((item) => {
              const totalBoxes = parseNumBoxes(item.num_boxes);
              const labourNames = stage2LabourMap[item.oiid] || '-';
              const netWeight = parseFloat(item.net_weight) || 0;
              const boxWeight = totalBoxes * 0.5;
              const grossWeight = netWeight + boxWeight;
              const boxStatus = stage2BoxStatusMap[item.oiid] || { available: 0 };
              const availableBoxes = boxStatus.available || 0;
              const pendingBoxes = Math.max(totalBoxes - availableBoxes, 0);
              const productCount = productCountMap[item.oiid] ?? '';

              //console.log(`Product ${item.oiid}: Labour = ${labourNames}`);

              return {
                id: `${item.oiid}-0`,
                oiid: item.oiid,
                product: (item.product_name || item.product || '').replace(/^\d+\s*-\s*/, ''),
                grossWeight: `${grossWeight.toFixed(2)} kg`,
                totalBoxes: totalBoxes,
                availableBoxes: availableBoxes,
                pendingBoxes: pendingBoxes,
                labour: labourNames,
                ct: '',
                noOfPkgs: '',
                selectedDriver: '',
                airportName: '',
                airportLocation: '',
                vehicleNumber: '',
                phoneNumber: '',
                vehicleCapacity: '',
                status: 'pending',
                assignmentIndex: 0,
                productCount
              };
            });
          }
          //console.log('Final product rows:', rows);
          setProductRows(rows);
          setStage2BoxStatus(stage2BoxStatusMap);
        }
      } catch (error) {
        console.error('Error loading data:', error);
      }
    };

    loadData();
  }, [orderData, id]);

  // Helper function to get next available CT position for an airport
  const getNextCTPositionForAirport = (airportName, currentRowId, numPkgs, currentRows) => {
    if (!airportName) return 1;

    // Get all rows assigned to this airport (excluding current row)
    const airportRows = currentRows.filter(row =>
      row.airportName === airportName &&
      row.id !== currentRowId &&
      row.ct
    );

    if (airportRows.length === 0) return 1;

    // Extract all occupied ranges
    const occupiedRanges = [];
    airportRows.forEach(row => {
      if (row.ct && row.ct.includes('-')) {
        const parts = row.ct.split('-');
        if (parts.length === 2) {
          const start = parseInt(parts[0]);
          const end = parseInt(parts[1]);
          if (!isNaN(start) && !isNaN(end)) {
            occupiedRanges.push({ start, end });
          }
        }
      }
    });

    // Sort by start position
    occupiedRanges.sort((a, b) => a.start - b.start);

    // Find the highest end position and start after it
    if (occupiedRanges.length > 0) {
      const lastRange = occupiedRanges[occupiedRanges.length - 1];
      return lastRange.end + 1;
    }

    return 1;
  };

  // Validate CT range
  const validateCTRange = (ct, oiid, totalBoxes, currentRowId) => {
    if (!ct) return { valid: true };

    const parts = ct.split('-');
    if (parts.length !== 2) {
      return { valid: false, error: 'Invalid format. Use format: 1-3' };
    }

    const start = parseInt(parts[0]);
    const end = parseInt(parts[1]);

    if (isNaN(start) || isNaN(end)) {
      return { valid: false, error: 'Invalid numbers' };
    }
    if (start > end) {
      return { valid: false, error: 'Start must be ≤ end' };
    }
    if (start < 1) {
      return { valid: false, error: 'Start must be ≥ 1' };
    }
    if (end > totalBoxes) {
      return { valid: false, error: `End cannot exceed ${totalBoxes}` };
    }

    // Check for overlaps with other CT ranges for the same product
    const sameProductRows = productRows.filter(row => row.oiid === oiid && row.id !== currentRowId);
    for (const row of sameProductRows) {
      if (!row.ct) continue;

      const existingParts = row.ct.split('-');
      if (existingParts.length !== 2) continue;

      const existingStart = parseInt(existingParts[0]);
      const existingEnd = parseInt(existingParts[1]);

      if (isNaN(existingStart) || isNaN(existingEnd)) continue;

      // Check for overlap
      if ((start >= existingStart && start <= existingEnd) || (end >= existingStart && end <= existingEnd) ||
        (start <= existingStart && end >= existingEnd)) {
        return { valid: false, error: `Overlaps with range ${row.ct}` };
      }
    }

    return { valid: true };
  };

  const handleNoOfPkgsChange = (index, value) => {
    const updatedRows = [...productRows];
    updatedRows[index].noOfPkgs = value;
    const currentRow = updatedRows[index];
    const avlBox = currentRow.availableBoxes ?? 0;

    // Warn if value exceeds available boxes, or when there are no avl boxes (only pen box)
    if (value && !isNaN(parseInt(value))) {
      const numPkgs = parseInt(value);
      const overAvl = numPkgs > 0 && numPkgs > avlBox; // includes avlBox === 0 (only pending)
      if (overAvl) {
        const msg = avlBox === 0
          ? 'Not available for packing. Avl box: 0 (only pending boxes).'
          : `${numPkgs} is not available for packing. Avl box: ${avlBox}`;
        setNoOfPkgsWarning((prev) => ({ ...prev, [currentRow.id]: msg }));
      } else {
        setNoOfPkgsWarning((prev) => {
          const next = { ...prev };
          delete next[currentRow.id];
          return next;
        });
      }
    } else {
      setNoOfPkgsWarning((prev) => {
        const next = { ...prev };
        delete next[currentRow.id];
        return next;
      });
    }

    // Auto-generate CT from No of Pkgs
    if (value && !isNaN(parseInt(value))) {
      const numPkgs = parseInt(value);
      if (numPkgs > 0) {
        // Get next available position for this airport (continuous across all products)
        const startPosition = getNextCTPositionForAirport(
          currentRow.airportName,
          currentRow.id,
          numPkgs,
          updatedRows
        );

        const endPosition = startPosition + numPkgs - 1;

        // Check if it exceeds total boxes for THIS product
        if (endPosition - startPosition + 1 <= currentRow.totalBoxes) {
          updatedRows[index].ct = `${startPosition}-${endPosition}`;
        } else {
          updatedRows[index].ct = '';
          alert(`Cannot fit ${numPkgs} packages. Maximum available for this product: ${currentRow.totalBoxes}`);
        }
      } else {
        updatedRows[index].ct = '';
      }
    } else {
      updatedRows[index].ct = '';
    }

    // Auto-add / cleanup assignment rows while typing, based on
    // how many boxes are actually packed for this product.
    const totalBoxes = currentRow.totalBoxes || 0;

    if (totalBoxes > 0) {
      // Work only with rows for this product
      let sameProductRows = updatedRows.filter(r => r.oiid === currentRow.oiid);
      const totalPackages = sameProductRows.reduce(
        (sum, r) => sum + (parseInt(r.noOfPkgs) || 0),
        0
      );

      // Helper to detect an "auto" empty row
      const isCompletelyEmptyRow = (r) => {
        const pkgCount = parseInt(r.noOfPkgs) || 0;
        return (
          pkgCount === 0 &&
          !r.ct &&
          !r.airportName &&
          !r.selectedDriver &&
          r.assignmentIndex > 0
        );
      };

      const emptyRows = sameProductRows.filter(isCompletelyEmptyRow);

      if (totalPackages >= totalBoxes || totalPackages === 0) {
        // Product fully packed (or nothing entered): remove ALL trailing
        // empty auto-created rows for this product.
        const removedIds = [];
        for (const r of emptyRows) {
          const globalIndex = updatedRows.indexOf(r);
          if (globalIndex !== -1) {
            updatedRows.splice(globalIndex, 1);
            removedIds.push(r.id);
          }
        }
        if (removedIds.length > 0) {
          setNoOfPkgsWarning((prev) => {
            const next = { ...prev };
            removedIds.forEach((id) => delete next[id]);
            return next;
          });
        }
      } else {
        // Some boxes packed but not all: ensure exactly ONE empty row at end.
        if (emptyRows.length === 0) {
          const firstRow = sameProductRows[0];
          const maxAssignmentIndex = Math.max(...sameProductRows.map(r => r.assignmentIndex));
          const newRow = {
            id: `${firstRow.oiid}-${maxAssignmentIndex + 1}`,
            oiid: firstRow.oiid,
            product: firstRow.product,
            grossWeight: firstRow.grossWeight,
            totalBoxes: firstRow.totalBoxes,
            availableBoxes: firstRow.availableBoxes,
            pendingBoxes: firstRow.pendingBoxes,
            labour: firstRow.labour,
            ct: '',
            noOfPkgs: '',
            selectedDriver: '',
            airportName: '',
            airportLocation: '',
            vehicleNumber: '',
            phoneNumber: '',
            vehicleCapacity: '',
            status: 'pending',
            assignmentIndex: maxAssignmentIndex + 1
          };

          sameProductRows = updatedRows.filter(r => r.oiid === firstRow.oiid);
          const lastRowIndex = updatedRows.lastIndexOf(sameProductRows[sameProductRows.length - 1]);
          updatedRows.splice(lastRowIndex + 1, 0, newRow);
        } else if (emptyRows.length > 1) {
          // Keep only the last empty row, remove the others
          const lastEmpty = emptyRows[emptyRows.length - 1];
          for (const r of emptyRows) {
            if (r === lastEmpty) continue;
            const globalIndex = updatedRows.indexOf(r);
            if (globalIndex !== -1) {
              updatedRows.splice(globalIndex, 1);
            }
          }
        }
      }
    }

    setProductRows(updatedRows);
  };

  const handleNoOfPkgsBlur = (index) => {
    const row = productRows[index];
    const value = row.noOfPkgs;
    const totalBoxes = row.totalBoxes || 0;
    const avlBox = row.availableBoxes ?? 0;

    // Validate when user leaves the field
    if (value && !isNaN(parseInt(value))) {
      const numPkgs = parseInt(value);
      if (numPkgs > totalBoxes) {
        alert(`Number of packages (${numPkgs}) cannot exceed total boxes (${totalBoxes})`);
        const updatedRows = [...productRows];
        updatedRows[index].noOfPkgs = '';
        updatedRows[index].ct = '';
        setProductRows(updatedRows);
        setNoOfPkgsWarning((prev) => {
          const next = { ...prev };
          delete next[row.id];
          return next;
        });
        return;
      }
      if (numPkgs > 0 && numPkgs > avlBox) {
        const msg = avlBox === 0
          ? `${numPkgs} packages is not available for packing. No boxes available (Avl box: 0, only pending boxes).`
          : `${numPkgs} packages is not available for packing. Available boxes for this product: ${avlBox}`;
        alert(msg);
      }
    }
  };

  const handleDriverChange = (index, driverId) => {
    if (!driverId) {
      const updatedRows = [...productRows];
      updatedRows[index].selectedDriver = '';
      updatedRows[index].vehicleNumber = '';
      updatedRows[index].phoneNumber = '';
      updatedRows[index].vehicleCapacity = '';
      setProductRows(updatedRows);
      return;
    }

    const currentRow = productRows[index];
    const newAirport = currentRow.airportName || '';

    // One driver per airport: driver can only be assigned to one airport across all rows
    const otherRowsWithSameDriver = productRows.filter(
      (row, i) => i !== index && row.selectedDriver && String(row.selectedDriver) === String(driverId)
    );
    const airportAlreadyAssigned = otherRowsWithSameDriver.find((r) => r.airportName)?.airportName;
    if (airportAlreadyAssigned) {
      if (newAirport && newAirport !== airportAlreadyAssigned) {
        const driverName = drivers.find(d => d.did === parseInt(driverId))?.driver_name || 'This driver';
        alert(`${driverName} is already assigned to "${airportAlreadyAssigned}". One driver can only be assigned to one airport. Please choose another driver or assign this row to the same airport.`);
        return;
      }
      if (!newAirport) {
        const driverName = drivers.find(d => d.did === parseInt(driverId))?.driver_name || 'This driver';
        alert(`${driverName} is already assigned to "${airportAlreadyAssigned}". Assign the same airport to this row first, or choose another driver.`);
        return;
      }
    }

    const updatedRows = [...productRows];
    updatedRows[index].selectedDriver = driverId;

    const selectedDriverInfo = drivers.find(d => d.did === parseInt(driverId));
    if (selectedDriverInfo) {
      updatedRows[index].vehicleNumber = selectedDriverInfo.vehicle_number || '';
      updatedRows[index].phoneNumber = selectedDriverInfo.phone_number || '';
      updatedRows[index].vehicleCapacity = selectedDriverInfo.capacity || '';
    } else {
      updatedRows[index].vehicleNumber = '';
      updatedRows[index].phoneNumber = '';
      updatedRows[index].vehicleCapacity = '';
    }

    setProductRows(updatedRows);
  };

  const handleAirportNameChange = (index, airportName) => {
    const currentRow = productRows[index];
    const currentDriverId = currentRow.selectedDriver;

    // One driver per airport: if this row has a driver, they must stay on one airport
    if (currentDriverId && airportName) {
      const otherRowsWithSameDriver = productRows.filter(
        (row, i) => i !== index && row.selectedDriver && String(row.selectedDriver) === String(currentDriverId)
      );
      const airportAlreadyAssigned = otherRowsWithSameDriver.find((r) => r.airportName)?.airportName;
      if (airportAlreadyAssigned && airportAlreadyAssigned !== airportName) {
        const driverName = drivers.find(d => d.did === parseInt(currentDriverId))?.driver_name || 'This driver';
        alert(`${driverName} is already assigned to "${airportAlreadyAssigned}". One driver can only be assigned to one airport. Cannot assign a different airport to this row.`);
        return;
      }
    }

    const updatedRows = [...productRows];
    updatedRows[index].airportName = airportName;

    const selectedAirport = airports.find(a => a.name === airportName);
    if (selectedAirport) {
      updatedRows[index].airportLocation = selectedAirport.city || '';
    } else {
      updatedRows[index].airportLocation = '';
    }

    // Recalculate CT if packages are already assigned
    if (updatedRows[index].noOfPkgs) {
      const numPkgs = parseInt(updatedRows[index].noOfPkgs);
      if (numPkgs > 0) {
        const row = updatedRows[index];

        const startPosition = getNextCTPositionForAirport(
          airportName,
          row.id,
          numPkgs,
          updatedRows
        );

        const endPosition = startPosition + numPkgs - 1;

        if (endPosition - startPosition + 1 <= row.totalBoxes) {
          updatedRows[index].ct = `${startPosition}-${endPosition}`;
        } else {
          updatedRows[index].ct = '';
        }
      }
    }

    setProductRows(updatedRows);
  };

  const handleAddCTAssignment = (oiid) => {
    const sameProductRows = productRows.filter(row => row.oiid === oiid);
    const firstRow = sameProductRows[0];

    // Check if total packages already equals total boxes/bags
    const totalPackages = sameProductRows.reduce((sum, row) => sum + (parseInt(row.noOfPkgs) || 0), 0);
    if (totalPackages >= firstRow.totalBoxes) {
      alert(`Cannot add more assignments. Total packages (${totalPackages}) already equals or exceeds total boxes/bags (${firstRow.totalBoxes}). Product is fully packed.`);
      return;
    }

    const maxAssignmentIndex = Math.max(...sameProductRows.map(row => row.assignmentIndex), -1);

    const newRow = {
      id: `${oiid}-${maxAssignmentIndex + 1}`,
      oiid: oiid,
      product: firstRow.product,
      grossWeight: firstRow.grossWeight,
      totalBoxes: firstRow.totalBoxes,
      availableBoxes: firstRow.availableBoxes,
      pendingBoxes: firstRow.pendingBoxes,
      labour: firstRow.labour,
      ct: '',
      noOfPkgs: '',
      selectedDriver: '',
      airportName: '',
      airportLocation: '',
      vehicleNumber: '',
      phoneNumber: '',
      vehicleCapacity: '',
      status: 'pending',
      assignmentIndex: maxAssignmentIndex + 1
    };

    // Insert after the last row of the same product
    const lastRowIndex = productRows.lastIndexOf(sameProductRows[sameProductRows.length - 1]);
    const updatedRows = [...productRows];
    updatedRows.splice(lastRowIndex + 1, 0, newRow);
    setProductRows(updatedRows);
  };

  const handleRemoveCTAssignment = (rowId, oiid) => {
    // Prevent removing the last assignment for a product
    const sameProductRows = productRows.filter(row => row.oiid === oiid);
    if (sameProductRows.length <= 1) {
      alert('Cannot remove the last assignment for a product');
      return;
    }

    const updatedRows = productRows.filter(row => row.id !== rowId);
    setProductRows(updatedRows);
  };

  // Calculate counts
  const totalProducts = productRows.length;
  const totalCTs = productRows.filter(row => row.ct).length;
  const totalDriversSelected = productRows.filter(row => row.selectedDriver).length;

  const handleConfirmAssignment = async () => {
    try {
      // Group products by driver for summary
      const groupedByDriver = {};
      productRows.forEach(row => {
        if (row.selectedDriver) {
          const driverInfo = drivers.find(d => d.did === parseInt(row.selectedDriver));
          const driverKey = driverInfo ? `${driverInfo.driver_name} - ${driverInfo.driver_id}` : row.selectedDriver;

          if (!groupedByDriver[driverKey]) {
            groupedByDriver[driverKey] = {
              driverInfo,
              products: []
            };
          }
          groupedByDriver[driverKey].products.push(row);
        }
      });

      // Generate summary data matching API expectations
      const driverAssignments = Object.entries(groupedByDriver).map(([driverKey, data]) => {
        const totalPackages = data.products.reduce((sum, p) => sum + (parseInt(p.noOfPkgs) || 0), 0);
        const totalWeight = data.products.reduce((sum, p) => {
          const weightStr = String(p.grossWeight).replace(/[^0-9.]/g, '');
          const weight = parseFloat(weightStr) || 0;
          return sum + weight;
        }, 0);

        return {
          driver: driverKey,
          did: data.driverInfo?.did || null,
          driverId: data.driverInfo?.driver_id || null,
          vehicleNumber: data.driverInfo?.vehicle_number || '',
          phoneNumber: data.driverInfo?.phone_number || '',
          totalPackages,
          totalWeight: parseFloat(totalWeight.toFixed(2)),
          assignments: data.products.map(p => ({
            product: p.product,
            grossWeight: p.grossWeight,
            labour: p.labour,
            ct: p.ct || '',
            noOfPkgs: parseInt(p.noOfPkgs) || 0,
            airportName: p.airportName || '',
            airportLocation: p.airportLocation || '',
            status: p.status || 'pending',
            oiid: p.oiid
          }))
        };
      });

      // Generate airport groups for backend storage: one group per airport (order-wide).
      // Multiple drivers can deliver to different airports; one driver can have multiple airports.
      // Tape data is stored per airport inside each group to avoid duplicate/merge issues.
      const airportGroups = {};
      const customerName = orderData?.customer_name || '';
      const prefix = (customerName.replace(/\d+$/, '').trim() || customerName || 'CT').replace(/\s+/g, '');
      const allAirports = [...new Set(productRows.filter(p => p.airportName).map(p => p.airportName))];

      allAirports.forEach((airportName, index) => {
        const sequentialNumber = String(index + 1).padStart(3, '0');
        const airportCode = `${prefix}${sequentialNumber}`;
        const airportProducts = productRows.filter(p => p.airportName === airportName);
        const rawTape = airportTapeData[airportName];
        const tapesArray = Array.isArray(rawTape) && rawTape.length > 0
          ? rawTape.map(t => ({ tapeName: t.tapeName || '', tapeQuantity: t.tapeQuantity != null ? t.tapeQuantity : '', tapeColor: t.tapeColor || '' }))
          : (rawTape && typeof rawTape === 'object' ? [{ tapeName: rawTape.tapeName || '', tapeQuantity: rawTape.tapeQuantity != null ? rawTape.tapeQuantity : '', tapeColor: rawTape.tapeColor || '' }] : []);
        const firstTape = tapesArray[0] || {};

        airportGroups[airportCode] = {
          airportCode,
          airportName: airportName,
          airportLocation: airportProducts[0]?.airportLocation || '',
          tapes: tapesArray,
          tapeName: firstTape.tapeName || '',
          tapeQuantity: firstTape.tapeQuantity || '',
          tapeColor: firstTape.tapeColor || '',
          products: airportProducts.map(p => ({
            product: p.product,
            grossWeight: p.grossWeight,
            labour: p.labour,
            ct: p.ct || '',
            noOfPkgs: parseInt(p.noOfPkgs) || 0,
            driver: drivers.find(d => d.did === parseInt(p.selectedDriver))?.driver_name || '',
            vehicleNumber: p.vehicleNumber || '',
            status: p.status || 'pending',
            oiid: p.oiid
          }))
        };
      });

      // Array form: one entry per airport (for backends that treat object keys as unique per driver)
      const airportGroupsArray = allAirports.map((airportName, index) => {
        const code = `${prefix}${String(index + 1).padStart(3, '0')}`;
        const g = airportGroups[code];
        return g ? { ...g } : null;
      }).filter(Boolean);

      const summaryData = {
        driverAssignments,
        airportGroups,
        airportGroupsArray,
        totalProducts: productRows.length,
        totalDrivers: Object.keys(groupedByDriver).length,
        totalPackages: productRows.reduce((sum, p) => sum + (parseInt(p.noOfPkgs) || 0), 0),
        totalWeight: parseFloat(productRows.reduce((sum, p) => {
          const weightStr = String(p.grossWeight).replace(/[^0-9.]/g, '');
          return sum + (parseFloat(weightStr) || 0);
        }, 0).toFixed(2)),
        // When editing an existing Stage 3 assignment, mark it explicitly
        // so that the backend can avoid re‑reducing tape quantities or stock.
        isEdit: isEdit === true
      };

      // Format products array matching API expectations
      const products = productRows.map(row => ({
        id: row.id,
        oiid: row.oiid,
        product: row.product,
        grossWeight: row.grossWeight,
        totalBoxes: row.totalBoxes || 0,
        labour: row.labour || '-',
        ct: row.ct || '',
        noOfPkgs: row.noOfPkgs || '',
        selectedDriver: row.selectedDriver || '',
        airportName: row.airportName || '',
        airportLocation: row.airportLocation || '',
        vehicleNumber: row.vehicleNumber || '',
        phoneNumber: row.phoneNumber || '',
        vehicleCapacity: row.vehicleCapacity || '',
        status: row.status || 'pending',
        assignmentIndex: row.assignmentIndex || 0
      }));

      const stage3Data = {
        products,
        summaryData,
        airportTapeData,
        stage2BoxStatus: stage2BoxStatus,
        isEdit: isEdit === true
      };

      //console.log('Saving stage 3 data:', JSON.stringify(stage3Data, null, 2));
      await updateStage3Assignment(id, stage3Data);
      alert('Airport delivery assigned successfully!');
      navigate(`/order-assign/stage4/${id}`, { state: { orderData } });
    } catch (error) {
      console.error('Error assigning airport delivery:', error);
      const errorMessage = error?.message || error?.response?.data?.message || (typeof error === 'string' ? error : null);
      const displayMessage = errorMessage || 'Failed to assign airport delivery. Please try again.';

      const isInsufficientInventory = (displayMessage || '').toLowerCase().includes('insufficient') &&
        ((displayMessage || '').toLowerCase().includes('inventory') || (displayMessage || '').toLowerCase().includes('tape'));

      if (isInsufficientInventory) {
        setStockModalMessage(displayMessage);
        setStockModalOpen(true);
      } else {
        alert(displayMessage);
      }
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
                    stage3Status === 'pending' ? 'bg-purple-100 text-purple-700' :
                    stage3Status === 'processing' ? 'bg-yellow-100 text-yellow-700' :
                    stage3Status === 'completed' ? 'bg-emerald-600 text-white' :
                    stage3Status === 'in_progress' ? 'bg-blue-100 text-blue-700' :
                    'bg-gray-100 text-gray-700'
                  }`}>
                    {stage3Status ? stage3Status.charAt(0).toUpperCase() + stage3Status.slice(1).replace('_', ' ') : (orderData?.order_status ? orderData.order_status.charAt(0).toUpperCase() + orderData.order_status.slice(1) : 'N/A')}
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
        <button
          onClick={() => navigate(`/order-assign/stage2/${id}`, { state: { orderData } })}
          className="px-6 py-3 bg-white border-2 border-emerald-600 text-emerald-700 rounded-lg font-medium hover:bg-emerald-50 transition-colors flex items-center gap-2"
        >
          <Check className="w-5 h-5" />
          Stage 2: Packaging
        </button>
        <button className="px-6 py-3 bg-emerald-600 text-white rounded-lg font-medium shadow-sm hover:bg-emerald-700 transition-colors">
          Stage 3: Delivery
        </button>
        <button
          onClick={() => navigate(`/order-assign/stage4/${id}`)}
          className="px-6 py-3 bg-white border-2 border-gray-300 text-gray-700 rounded-lg font-medium hover:bg-gray-50 transition-colors"
        >
          Stage 4: Price
        </button>
      </div>

      {/* Airport Delivery Assignment Section */}
      <div className="bg-white rounded-xl shadow-sm p-6 mb-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-2">Stage 3: Airport Delivery Assignment</h2>
        <p className="text-sm text-gray-600 mb-6">Assign CT, packages, and drivers for each product (CT numbers are continuous per airport)</p>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Product</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Gross Weight</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Count</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Assigned Labour</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Total Boxes/Bags</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Avl Box</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Pen Box</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase">No of Pkgs</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Total</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Airport Name</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Airport Location</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Select Driver</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Vehicle Number</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Phone Number</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Vehicle Capacity</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {productRows.map((row, index) => {
                const selectedDriverInfo = row.selectedDriver ? drivers.find(d => d.did === parseInt(row.selectedDriver)) : null;
                const sameProductRows = productRows.filter(r => r.oiid === row.oiid);
                const isFirstOfGroup = row.assignmentIndex === 0;
                const isLastOfGroup = index === productRows.lastIndexOf(sameProductRows[sameProductRows.length - 1]);

                return (
                  <tr key={row.id} className={`hover:bg-gray-50 transition-colors ${!isLastOfGroup ? 'border-b-0' : ''}`}>
                    {isFirstOfGroup && (
                      <td className="px-4 py-4 border-r-2 border-emerald-200 bg-emerald-50" rowSpan={sameProductRows.length}>
                        <span className="text-sm font-medium text-gray-900">{row.product}</span>
                      </td>
                    )}
                    {isFirstOfGroup && (
                      <td className="px-4 py-4" rowSpan={sameProductRows.length}>
                        <span className="text-sm text-gray-900">{row.grossWeight}</span>
                      </td>
                    )}
                    {isFirstOfGroup && (
                      <td className="px-4 py-4" rowSpan={sameProductRows.length}>
                        {row.productCount != null && row.productCount !== '' ? (
                          <span className="text-sm font-semibold text-gray-900">{row.productCount}</span>
                        ) : (
                          <span className="text-sm text-gray-400">-</span>
                        )}
                      </td>
                    )}
                    {isFirstOfGroup && (
                      <td className="px-4 py-4" rowSpan={sameProductRows.length}>
                        <span className="text-sm text-gray-900">{row.labour}</span>
                      </td>
                    )}
                    {isFirstOfGroup && (
                      <td className="px-4 py-4" rowSpan={sameProductRows.length}>
                        <span className="text-sm font-semibold text-blue-600">{row.totalBoxes || 0}</span>
                      </td>
                    )}
                    {isFirstOfGroup && (
                      <td className="px-4 py-4" rowSpan={sameProductRows.length}>
                        <span className="text-sm font-semibold text-emerald-600">{row.availableBoxes || 0}</span>
                      </td>
                    )}
                    {isFirstOfGroup && (
                      <td className="px-4 py-4" rowSpan={sameProductRows.length}>
                        <span className="text-sm font-semibold text-yellow-600">{row.pendingBoxes || 0}</span>
                      </td>
                    )}
                    <td className="px-4 py-4">
                      <div className="flex flex-col gap-0.5">
                        <input
                          ref={(el) => {
                            if (el) inputGridRefs.current[`${index}-0`] = el;
                          }}
                          type="text"
                          value={row.noOfPkgs}
                          onChange={(e) => handleNoOfPkgsChange(index, e.target.value)}
                          onBlur={() => handleNoOfPkgsBlur(index)}
                          onKeyDown={(e) => handleKeyDown(e, index, 0, productRows.length)}
                          placeholder="Enter packages"
                          className={`w-28 px-3 py-2 border rounded-lg text-sm outline-none focus:ring-2 ${
                            noOfPkgsWarning[row.id]
                              ? 'border-red-500 focus:ring-red-500 focus:border-red-500 bg-red-50'
                              : 'border-gray-300 focus:ring-emerald-500 focus:border-emerald-500'
                          }`}
                        />
                        {noOfPkgsWarning[row.id] && (
                          <span className="text-xs text-red-600 font-medium">{noOfPkgsWarning[row.id]}</span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-4">
                      <span className="text-sm text-gray-900 font-medium">{row.ct || '-'}</span>
                    </td>
                    <td className="px-4 py-4">
                      <div className="relative">
                        <select
                          ref={(el) => {
                            if (el) inputGridRefs.current[`${index}-1`] = el;
                          }}
                          value={row.airportName}
                          onChange={(e) => handleAirportNameChange(index, e.target.value)}
                          onKeyDown={(e) => handleKeyDown(e, index, 1, productRows.length)}
                          className="min-w-[220px] w-64 appearance-none px-3 py-2 pr-8 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none bg-white"
                        >
                          <option value="">Select airport...</option>
                          {sortDropdownObjects(airports, (airport) => airport.name).map((airport) => (
                            <option key={airport.aid} value={airport.name}>
                              {airport.name}
                            </option>
                          ))}
                        </select>
                        <ChevronDown className="absolute right-2 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-600 pointer-events-none" />
                      </div>
                    </td>
                    <td className="px-4 py-4">
                      <span className="text-sm text-gray-900">{row.airportLocation || '-'}</span>
                    </td>
                    <td className="px-4 py-4">
                      <div className="relative">
                        <select
                          ref={(el) => {
                            if (el) inputGridRefs.current[`${index}-2`] = el;
                          }}
                          value={row.selectedDriver}
                          onChange={(e) => handleDriverChange(index, e.target.value)}
                          onKeyDown={(e) => handleKeyDown(e, index, 2, productRows.length)}
                          className="min-w-[220px] w-64 appearance-none px-3 py-2 pr-8 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none bg-white"
                        >
                          <option value="">Select driver...</option>
                          {sortDropdownObjects(drivers, (driver) => driver.driver_name).map(driver => (
                            <option key={driver.did} value={driver.did}>
                              {`${driver.driver_name} (${driver.driver_id || driver.did})`}
                            </option>
                          ))}
                        </select>
                        <ChevronDown className="absolute right-2 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-600 pointer-events-none" />
                      </div>
                    </td>
                    <td className="px-4 py-4">
                      <span className="text-sm text-gray-900">{row.vehicleNumber || selectedDriverInfo?.vehicle_number || '-'}</span>
                    </td>
                    <td className="px-4 py-4">
                      <span className="text-sm text-gray-900">{row.phoneNumber || selectedDriverInfo?.phone_number || '-'}</span>
                    </td>
                    <td className="px-4 py-4">
                      <span className="text-sm text-gray-900">{row.vehicleCapacity || selectedDriverInfo?.capacity || '-'}</span>
                    </td>

                    <td className="px-4 py-4">
                      <div className="flex gap-2 items-center">
                        {isLastOfGroup && (
                          <button
                            onClick={() => handleAddCTAssignment(row.oiid)}
                            className="flex items-center justify-center w-8 h-8 bg-emerald-600 text-white rounded-full hover:bg-emerald-700 transition-all hover:scale-105 shadow-md"
                            title="Add CT Range"
                          >
                            <Plus className="w-4 h-4" />
                          </button>
                        )}
                        {sameProductRows.length > 1 && (
                          <button
                            onClick={() => handleRemoveCTAssignment(row.id, row.oiid)}
                            className="flex items-center gap-1.5 px-2.5 py-1.5 bg-red-500 text-white rounded-md text-xs font-medium hover:bg-red-600 transition-all hover:scale-105 shadow-md"
                            title="Remove this CT range"
                          >
                            <X className="w-3.5 h-3.5" />
                            <span>Remove</span>
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Summary Section - Grouped by Driver */}
      {productRows.some(row => row.selectedDriver) && (
        <div className="bg-gradient-to-br from-emerald-50 to-teal-50 rounded-xl shadow-sm p-6 mb-6 border-2 border-emerald-200">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 bg-emerald-600 rounded-lg">
              <Package className="w-6 h-6 text-white" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-gray-900">Airport Delivery Summary</h2>
              <p className="text-sm text-gray-600">Products grouped by assigned driver</p>
            </div>
          </div>

          {/* Desktop Summary */}
          <div className="hidden lg:block space-y-6">
            {(() => {
              const groupedByDriver = {};
              productRows.forEach(row => {
                if (row.selectedDriver) {
                  const driverInfo = drivers.find(d => d.did === parseInt(row.selectedDriver));
                  const driverKey = driverInfo ? `${driverInfo.driver_name} - ${driverInfo.driver_id}` : row.selectedDriver;

                  if (!groupedByDriver[driverKey]) {
                    groupedByDriver[driverKey] = {
                      driverInfo,
                      products: []
                    };
                  }
                  groupedByDriver[driverKey].products.push(row);
                }
              });

              // Build global airport code map across all drivers
              const globalAirportCodeMap = {};
              const allAirports = [...new Set(productRows.filter(p => p.airportName).map(p => p.airportName))];
              const customerName = orderData?.customer_name || '';
              const prefix = customerName.replace(/\d+$/, '').trim() || customerName;

              allAirports.forEach((airport, index) => {
                const sequentialNumber = String(index + 1).padStart(3, '0');
                globalAirportCodeMap[airport] = `${prefix}${sequentialNumber}`;
              });

              return Object.entries(groupedByDriver).map(([driverKey, data]) => {
                const totalPackages = data.products.reduce((sum, p) => sum + (parseInt(p.noOfPkgs) || 0), 0);
                const totalWeight = data.products.reduce((sum, p) => {
                  const weight = parseFloat(p.grossWeight) || 0;
                  return sum + weight;
                }, 0);

                const productsWithSequentialNumbers = data.products.map(product => ({
                  ...product,
                  sequentialCode: globalAirportCodeMap[product.airportName] || '-'
                }));

                return (
                  <div key={driverKey} className="bg-white rounded-lg shadow-sm overflow-hidden border-2 border-emerald-300">
                    <div className="bg-gradient-to-r from-emerald-600 to-teal-600 px-6 py-4">
                      <div className="flex items-center justify-between text-white">
                        <div className="flex items-center gap-3">
                          <Truck className="w-6 h-6" />
                          <div>
                            <h3 className="text-lg font-bold">{driverKey}</h3>
                            <p className="text-sm text-emerald-100">{data.products.length} Products • {data.driverInfo?.vehicle_number || 'N/A'}</p>
                          </div>
                        </div>
                        <div className="flex gap-2">
                          {[...new Set(productsWithSequentialNumbers.map(p => p.sequentialCode).filter(c => c !== '-'))].map(code => (
                            <span key={code} className="px-3 py-1 bg-white/20 rounded-lg text-sm font-bold">{code}</span>
                          ))}
                        </div>
                      </div>
                    </div>

                    <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead className="bg-emerald-50">
                          <tr>
                            <th className="px-4 py-3 text-left text-xs font-bold text-gray-700 uppercase">Product</th>
                            <th className="px-4 py-3 text-left text-xs font-bold text-gray-700 uppercase">Gross Weight</th>
                            <th className="px-4 py-3 text-left text-xs font-bold text-gray-700 uppercase">Labour</th>
                            <th className="px-4 py-3 text-left text-xs font-bold text-gray-700 uppercase">CT</th>
                            <th className="px-4 py-3 text-left text-xs font-bold text-gray-700 uppercase">Packages</th>
                            <th className="px-4 py-3 text-left text-xs font-bold text-gray-700 uppercase">Airport</th>
                            <th className="px-4 py-3 text-left text-xs font-bold text-gray-700 uppercase">Location</th>
                            <th className="px-4 py-3 text-left text-xs font-bold text-gray-700 uppercase">Status</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200">
                          {productsWithSequentialNumbers.map((product, idx) => (
                            <tr key={idx} className="hover:bg-emerald-50 transition-colors">
                              <td className="px-4 py-3">
                                <div className="flex items-center gap-2">
                                  <div className="w-2 h-2 bg-emerald-500 rounded-full"></div>
                                  <span className="text-sm font-medium text-gray-900">{product.product}</span>
                                </div>
                              </td>
                              <td className="px-4 py-3">
                                <span className="text-sm font-semibold text-gray-900">{product.grossWeight}</span>
                              </td>
                              <td className="px-4 py-3">
                                <span className="text-sm text-gray-900">{product.labour}</span>
                              </td>
                              <td className="px-4 py-3">
                                <span className="text-sm text-gray-900">{product.ct || '-'}</span>
                              </td>
                              <td className="px-4 py-3">
                                <span className="text-sm text-gray-900">{product.noOfPkgs || '-'}</span>
                              </td>
                              <td className="px-4 py-3">
                                <div className="flex items-center gap-2">
                                  <MapPin className="w-4 h-4 text-gray-400" />
                                  <span className="text-sm text-gray-900">{product.airportName || '-'}</span>
                                </div>
                              </td>
                              <td className="px-4 py-3">
                                <span className="text-sm text-gray-600">{product.airportLocation || '-'}</span>
                              </td>

                              <td className="px-4 py-3">
                                <select
                                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
                                  value={product.status || 'pending'}
                                  onChange={(e) => {
                                    const updatedRows = [...productRows];
                                    const rowIndex = productRows.findIndex(r => r.id === product.id);
                                    if (rowIndex !== -1) {
                                      updatedRows[rowIndex].status = e.target.value;
                                      setProductRows(updatedRows);
                                    }
                                  }}
                                >
                                  <option value="completed">Completed</option>
                                  <option value="ontrip">On Trip</option>
                                  <option value="pending">Pending</option>
                                </select>
                              </td>
                            </tr>
                          ))}
                        </tbody>

                        {/* Tape Selection Section - Above Driver Total */}
                        {(() => {
                          const driverAirports = [...new Set(productsWithSequentialNumbers.map(p => p.airportName).filter(a => a))];

                          if (driverAirports.length > 0) {
                            return (
                              <tbody>
                                <tr>
                                  <td colSpan="8" className="px-4 py-4 bg-blue-50 border-t-2 border-blue-200">
                                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                                      {driverAirports.map((airport) => {
                                        const airportCode = globalAirportCodeMap[airport] || '-';

                                        return (
                                          <div key={airport} className="border-2 border-blue-200 rounded-lg p-3 bg-white">
                                            <div className="mb-2">
                                              <div className="flex items-center justify-between mb-1">
                                                <span className="text-xs font-bold text-blue-600">{airportCode}</span>
                                                <MapPin className="w-3 h-3 text-gray-400" />
                                              </div>
                                              <p className="text-xs text-gray-600 font-medium">{airport}</p>
                                            </div>

                                            <div className="space-y-3">
                                              {getTapesForAirport(airport).map((tapeEntry, tapeIndex) => (
                                                <div key={tapeIndex} className="flex gap-2 items-end border border-gray-200 rounded p-2 bg-gray-50/50">
                                                  <div className="flex-1 min-w-0 space-y-1">
                                                    <label className="block text-xs font-semibold text-gray-700">Tape Name</label>
                                                    <select
                                                      className="w-full px-2 py-1.5 border border-gray-300 rounded text-xs focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none bg-white"
                                                      value={tapeEntry.tapeName || ''}
                                                      onChange={(e) => {
                                                        const selectedName = e.target.value;
                                                        const selectedTape = tapes.find(t => t.name === selectedName);
                                                        updateTapeForAirport(airport, tapeIndex, { tapeName: selectedName, tapeColor: selectedTape?.color || '' });
                                                      }}
                                                    >
                                                      <option value="">Select tape...</option>
                                                      {sortDropdownObjects(tapes, (tape) => tape.name).map(tape => (
                                                        <option key={tape.iid} value={tape.name}>{tape.name}</option>
                                                      ))}
                                                    </select>
                                                  </div>
                                                  <div className="flex-1 min-w-0 space-y-1">
                                                    <label className="block text-xs font-semibold text-gray-700">Qty</label>
                                                    <input
                                                      type="text"
                                                      value={tapeEntry.tapeQuantity ?? ''}
                                                      placeholder="Qty"
                                                      onChange={(e) => updateTapeForAirport(airport, tapeIndex, 'tapeQuantity', e.target.value)}
                                                      className="w-full px-2 py-1.5 border border-gray-300 rounded text-xs focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                                                    />
                                                  </div>
                                                  <div className="flex items-center gap-1">
                                                    {getTapesForAirport(airport).length > 1 && (
                                                      <button
                                                        type="button"
                                                        onClick={() => removeTapeForAirport(airport, tapeIndex)}
                                                        className="p-1.5 text-red-600 hover:bg-red-50 rounded"
                                                        title="Remove tape"
                                                      >
                                                        <X className="w-4 h-4" />
                                                      </button>
                                                    )}
                                                  </div>
                                                </div>
                                              ))}
                                              <button
                                                type="button"
                                                onClick={() => addTapeForAirport(airport)}
                                                className="flex items-center gap-1.5 w-full justify-center py-2 border-2 border-dashed border-blue-300 rounded-lg text-blue-600 hover:bg-blue-50 text-xs font-medium"
                                              >
                                                <Plus className="w-4 h-4" /> Add another tape
                                              </button>
                                            </div>
                                          </div>
                                        );
                                      })}
                                    </div>
                                  </td>
                                </tr>
                              </tbody>
                            );
                          }
                          return null;
                        })()}

                        <tfoot className="bg-emerald-100 border-t-2 border-emerald-300">
                          <tr>
                            <td colSpan="4" className="px-4 py-3 text-right">
                              <span className="text-sm font-bold text-gray-900">Driver Total:</span>
                            </td>
                            <td className="px-4 py-3">
                              <span className="text-sm font-bold text-emerald-700">{totalPackages} pkgs</span>
                            </td>
                            <td colSpan="3" className="px-4 py-3">
                              <span className="text-sm font-bold text-emerald-700">{totalWeight.toFixed(2)} kg</span>
                            </td>
                          </tr>
                        </tfoot>
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
              const groupedByDriver = {};
              productRows.forEach(row => {
                if (row.selectedDriver) {
                  const driverInfo = drivers.find(d => d.did === parseInt(row.selectedDriver));
                  const driverKey = driverInfo ? `${driverInfo.driver_name} - ${driverInfo.driver_id}` : row.selectedDriver;

                  if (!groupedByDriver[driverKey]) {
                    groupedByDriver[driverKey] = {
                      driverInfo,
                      products: []
                    };
                  }
                  groupedByDriver[driverKey].products.push(row);
                }
              });

              const globalAirportCodeMap = {};
              const allAirports = [...new Set(productRows.filter(p => p.airportName).map(p => p.airportName))];
              const customerName = orderData?.customer_name || '';
              const prefix = customerName.replace(/\d+$/, '').trim() || customerName;

              allAirports.forEach((airport, index) => {
                const sequentialNumber = String(index + 1).padStart(3, '0');
                globalAirportCodeMap[airport] = `${prefix}${sequentialNumber}`;
              });

              return Object.entries(groupedByDriver).map(([driverKey, data]) => {
                const totalPackages = data.products.reduce((sum, p) => sum + (parseInt(p.noOfPkgs) || 0), 0);
                const totalWeight = data.products.reduce((sum, p) => sum + (parseFloat(p.grossWeight) || 0), 0);

                const productsWithSequentialNumbers = data.products.map(product => ({
                  ...product,
                  sequentialCode: globalAirportCodeMap[product.airportName] || '-'
                }));

                return (
                  <div key={driverKey} className="bg-white rounded-lg shadow-sm overflow-hidden border-2 border-emerald-300">
                    <div className="bg-gradient-to-r from-emerald-600 to-teal-600 px-4 py-3">
                      <div className="flex items-center justify-between text-white">
                        <div className="flex items-center gap-2">
                          <Truck className="w-5 h-5" />
                          <div>
                            <h3 className="text-base font-bold">{driverKey}</h3>
                            <p className="text-xs text-emerald-100">{data.products.length} Products • {data.driverInfo?.vehicle_number || 'N/A'}</p>
                          </div>
                        </div>
                        <div className="flex gap-2">
                          {[...new Set(productsWithSequentialNumbers.map(p => p.sequentialCode).filter(c => c !== '-'))].map(code => (
                            <span key={code} className="px-2 py-1 bg-white/20 rounded text-xs font-bold">{code}</span>
                          ))}
                        </div>
                      </div>
                    </div>

                    <div className="p-4 space-y-3">
                      {productsWithSequentialNumbers.map((product, idx) => (
                        <div key={idx} className="border border-gray-200 rounded-lg p-3">
                          <div className="flex items-start justify-between mb-2">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-1">
                                <div className="w-2 h-2 bg-emerald-500 rounded-full"></div>
                                <span className="text-sm font-semibold text-gray-900">{product.product}</span>
                              </div>
                            </div>
                          </div>

                          <div className="space-y-2 text-sm">
                            <div className="flex justify-between">
                              <span className="text-gray-600">Gross Weight:</span>
                              <span className="font-semibold text-gray-900">{product.grossWeight}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-gray-600">Labour:</span>
                              <span className="text-gray-900">{product.labour}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-gray-600">CT:</span>
                              <span className="text-gray-900">{product.ct || '-'}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-gray-600">Packages:</span>
                              <span className="text-gray-900">{product.noOfPkgs || '-'}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-gray-600">Airport:</span>
                              <span className="text-gray-900">{product.airportName || '-'}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-gray-600">Location:</span>
                              <span className="text-gray-900">{product.airportLocation || '-'}</span>
                            </div>

                            <div className="pt-2 border-t border-gray-200">
                              <label className="block text-xs font-semibold text-gray-700 mb-1">Status</label>
                              <select
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
                                value={product.status || 'pending'}
                                onChange={(e) => {
                                  const updatedRows = [...productRows];
                                  const rowIndex = productRows.findIndex(r => r.id === product.id);
                                  if (rowIndex !== -1) {
                                    updatedRows[rowIndex].status = e.target.value;
                                    setProductRows(updatedRows);
                                  }
                                }}
                              >
                                <option value="completed">Completed</option>
                                <option value="ontrip">On Trip</option>
                                <option value="pending">Pending</option>
                              </select>
                            </div>
                          </div>
                        </div>
                      ))}

                      {/* Tape Selection Section - Above Driver Total */}
                      {(() => {
                        const driverAirports = [...new Set(productsWithSequentialNumbers.map(p => p.airportName).filter(a => a))];

                        if (driverAirports.length > 0) {
                          return (
                            <div className="bg-blue-50 rounded-lg p-3 border-2 border-blue-200">
                              <div className="mb-3">
                                <h4 className="text-sm font-bold text-blue-900 mb-1">Tape Selection for Airport Groups</h4>
                                <p className="text-xs text-gray-600">Select tape color and quantity for each airport</p>
                              </div>
                              <div className="space-y-3">
                                {driverAirports.map((airport) => {
                                  const airportCode = globalAirportCodeMap[airport] || '-';

                                  return (
                                    <div key={airport} className="border-2 border-blue-200 rounded-lg p-3 bg-white">
                                      <div className="mb-2">
                                        <div className="flex items-center justify-between mb-1">
                                          <span className="text-xs font-bold text-blue-600">{airportCode}</span>
                                          <MapPin className="w-3 h-3 text-gray-400" />
                                        </div>
                                        <p className="text-xs text-gray-600 font-medium">{airport}</p>
                                      </div>

                                      <div className="space-y-3">
                                        {getTapesForAirport(airport).map((tapeEntry, tapeIndex) => (
                                          <div key={tapeIndex} className="flex gap-2 items-end border border-gray-200 rounded p-2 bg-gray-50/50">
                                            <div className="flex-1 min-w-0 space-y-1">
                                              <label className="block text-xs font-semibold text-gray-700">Tape Name</label>
                                              <select
                                                className="w-full px-2 py-1.5 border border-gray-300 rounded text-xs focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none bg-white"
                                                value={tapeEntry.tapeName || ''}
                                                onChange={(e) => {
                                                  const selectedName = e.target.value;
                                                  const selectedTape = tapes.find(t => t.name === selectedName);
                                                  updateTapeForAirport(airport, tapeIndex, { tapeName: selectedName, tapeColor: selectedTape?.color || '' });
                                                }}
                                              >
                                                <option value="">Select tape...</option>
                                                {sortDropdownObjects(tapes, (tape) => tape.name).map(tape => (
                                                  <option key={tape.iid} value={tape.name}>{tape.name}</option>
                                                ))}
                                              </select>
                                            </div>
                                            <div className="flex-1 min-w-0 space-y-1">
                                              <label className="block text-xs font-semibold text-gray-700">Qty</label>
                                              <input
                                                type="text"
                                                value={tapeEntry.tapeQuantity ?? ''}
                                                placeholder="Qty"
                                                onChange={(e) => updateTapeForAirport(airport, tapeIndex, 'tapeQuantity', e.target.value)}
                                                className="w-full px-2 py-1.5 border border-gray-300 rounded text-xs focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                                              />
                                            </div>
                                            {getTapesForAirport(airport).length > 1 && (
                                              <button
                                                type="button"
                                                onClick={() => removeTapeForAirport(airport, tapeIndex)}
                                                className="p-1.5 text-red-600 hover:bg-red-50 rounded"
                                                title="Remove tape"
                                              >
                                                <X className="w-4 h-4" />
                                              </button>
                                            )}
                                          </div>
                                        ))}
                                        <button
                                          type="button"
                                          onClick={() => addTapeForAirport(airport)}
                                          className="flex items-center gap-1.5 w-full justify-center py-2 border-2 border-dashed border-blue-300 rounded-lg text-blue-600 hover:bg-blue-50 text-xs font-medium"
                                        >
                                          <Plus className="w-4 h-4" /> Add another tape
                                        </button>
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          );
                        }
                        return null;
                      })()}

                      <div className="bg-emerald-100 rounded-lg p-3 border-2 border-emerald-300">
                        <div className="space-y-2 text-sm">
                          <div className="flex justify-between">
                            <span className="font-bold text-gray-900">Total Packages:</span>
                            <span className="font-bold text-emerald-700">{totalPackages} pkgs</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="font-bold text-gray-900">Total Weight:</span>
                            <span className="font-bold text-emerald-700">{totalWeight.toFixed(2)} kg</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              });
            })()}
          </div>

          {/* Grand Total Section */}
          <div className="mt-6 bg-white rounded-lg shadow-lg p-6 border-2 border-emerald-600">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-emerald-600 rounded-lg">
                  <Check className="w-6 h-6 text-white" />
                </div>
                <span className="text-xl font-bold text-gray-900">Overall Summary</span>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-lg p-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-blue-600 rounded-lg">
                    <Package className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <p className="text-xs text-gray-600">Total Products</p>
                    <p className="text-lg font-bold text-gray-900">{productRows.length}</p>
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
                    <p className="text-lg font-bold text-gray-900">
                      {new Set(productRows.filter(r => r.selectedDriver).map(r => r.selectedDriver)).size}
                    </p>
                  </div>
                </div>
              </div>
              <div className="bg-gradient-to-br from-emerald-50 to-emerald-100 rounded-lg p-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-emerald-600 rounded-lg">
                    <Package className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <p className="text-xs text-gray-600">Total Packages</p>
                    <p className="text-lg font-bold text-gray-900">
                      {productRows.reduce((sum, p) => sum + (parseInt(p.noOfPkgs) || 0), 0)}
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
          onClick={() => navigate(`/order-assign/stage2/${id}`, { state: { orderData } })}
          className="px-6 py-3 border-2 border-gray-300 text-gray-700 rounded-lg font-medium hover:bg-gray-50 transition-colors"
        >
          Back
        </button>
        <button
          onClick={handleConfirmAssignment}
          className="px-6 py-3 bg-emerald-600 text-white rounded-lg font-medium shadow-sm hover:bg-emerald-700 transition-colors"
        >
          {isEdit ? 'Edit Assignment' : 'Confirm Assignment'}
        </button>
      </div>

      <InsufficientStockModal
        isOpen={stockModalOpen}
        onClose={() => setStockModalOpen(false)}
        onNavigateToInventory={() => {
          setStockModalOpen(false);
          navigate('/stock');
        }}
        message={stockModalMessage}
      />
    </div>
  );
};

export default OrderAssignCreateStage3;