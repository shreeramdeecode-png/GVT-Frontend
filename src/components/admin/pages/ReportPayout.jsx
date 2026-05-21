import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Filter, Download, Calendar } from 'lucide-react';
import { getAllOrders } from '../../../api/orderApi';
import { getOrderAssignment } from '../../../api/orderAssignmentApi';
import { getAllFarmers } from '../../../api/farmerApi';
import { getAllSuppliers } from '../../../api/supplierApi';
import { getAllThirdParties } from '../../../api/thirdPartyApi';
import { getAllDrivers } from '../../../api/driverApi';
import { getAllLabours } from '../../../api/labourApi';
import { getAllDriverRates } from '../../../api/driverRateApi';
import { getAllExcessKMs } from '../../../api/excessKmApi';
import { getAllLabourRates } from '../../../api/labourRateApi';
import { getAllLabourExcessPay } from '../../../api/labourExcessPayApi';
import * as XLSX from 'xlsx-js-style';
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import { FileText, FileSpreadsheet } from 'lucide-react';
import PayoutPagination from '../common/PayoutPagination';

import { payoutTh, payoutTd, payoutTdNum, payoutTdCenter, payoutTableWrap, payoutTableScroll, payoutTableBase, payoutThead, payoutTbody, payoutRow, payoutEmptyCell, getPayoutStatusClassName } from '../../../components/admin/common/PayoutFilterBar';
import { DEFAULT_PAYOUT_PAGE_SIZE, calcPayoutTotalPages, getPayoutPageSlice } from '../../../components/admin/common/PayoutPagination';
const ReportPayout = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [allPayouts, setAllPayouts] = useState([]);
  const [filters, setFilters] = useState({
    type: 'all', // 'all', 'farmer', 'supplier', 'thirdParty', 'driver', 'labour'
    status: 'all', // 'all', 'paid', 'unpaid'
    dateFrom: '',
    dateTo: ''
  });
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = DEFAULT_PAYOUT_PAGE_SIZE;

  useEffect(() => {
    fetchAllData();
  }, []);

  const fetchAllData = async () => {
    try {
      setLoading(true);
      const [ordersRes, farmersRes, suppliersRes, thirdPartiesRes, driversRes, laboursRes] = await Promise.all([
        getAllOrders(),
        getAllFarmers(),
        getAllSuppliers(),
        getAllThirdParties(),
        getAllDrivers().catch(() => ({ data: [] })),
        getAllLabours(1, 1000).catch(() => ({ data: [] }))
      ]);

      const orders = ordersRes?.data || [];
      const farmers = farmersRes?.data || [];
      const suppliers = suppliersRes?.data || [];
      const thirdParties = thirdPartiesRes?.data || [];
      const drivers = driversRes?.data || driversRes || [];
      const labours = laboursRes?.data || laboursRes?.labours || [];

      // Helper to lookup names
      const getEntityName = (type, id) => {
        if (type === 'farmer') return farmers.find(f => f.fid == id)?.farmer_name || 'Unknown Farmer';
        if (type === 'supplier') return suppliers.find(s => s.sid == id)?.supplier_name || 'Unknown Supplier';
        if (type === 'thirdParty') return thirdParties.find(t => t.tpid == id)?.third_party_name || 'Unknown Third Party';
        if (type === 'driver') return drivers.find(d => d.did == id)?.driver_name || 'Unknown Driver';
        if (type === 'labour') return labours.find(l => l.lid == id)?.full_name || labours.find(l => l.lid == id)?.name || 'Unknown Labour';
        return 'Unknown';
      };

      const cleanForMatching = (name) => {
        if (!name) return '';
        return name.replace(/^\d+\s*-\s*/, '').trim();
      };

      // Process all orders to build payout records
      const processedPayouts = [];

      // Fetch assignments for all orders
      // Note: In a large system, we might want to paginate this or fetch on demand.
      // For now, we process all to get accurate totals.
      const assignmentPromises = orders.map(async (order) => {
        try {
          const assignmentRes = await getOrderAssignment(order.oid).catch(() => null);
          if (!assignmentRes?.data?.product_assignments) return;

          let assignments = [];
          try {
            assignments = typeof assignmentRes.data.product_assignments === 'string'
              ? JSON.parse(assignmentRes.data.product_assignments)
              : assignmentRes.data.product_assignments;
          } catch {
            return;
          }

          // Get Stage 4 data for pricing
          let stage4ProductRows = [];
          try {
            if (assignmentRes.data?.stage4_data) {
              const stage4Data = typeof assignmentRes.data.stage4_data === 'string'
                ? JSON.parse(assignmentRes.data.stage4_data)
                : assignmentRes.data.stage4_data;
              if (stage4Data?.reviewData?.productRows) {
                stage4ProductRows = stage4Data.reviewData.productRows;
              }
            }
          } catch (e) {
            console.error('Error parsing stage4_data:', e);
          }

          // Group by entity
          const entityGroups = {};
          assignments.forEach(assignment => {
            // Skip if no entity type or id (shouldn't happen for valid assignments)
            if (!assignment.entityType || !assignment.entityId) return;

            // Normalize entity type names to match our filter keys
            let type = assignment.entityType;
            if (type === 'thirdParty') type = 'thirdParty'; // keep as is

            const key = `${type}_${assignment.entityId}`;
            if (!entityGroups[key]) {
              entityGroups[key] = {
                type: type,
                id: assignment.entityId,
                assignments: []
              };
            }
            entityGroups[key].assignments.push(assignment);
          });

          // Calculate totals for each entity in this order
          Object.values(entityGroups).forEach(group => {

            const enrichedAssignments = group.assignments.map(assignment => {
              const cleanAssignmentProduct = cleanForMatching(assignment.product);

              // Get quantity
              let qty = parseFloat(assignment.assignedQty) || 0;
              if (!qty) {
                const matchingItem = order.items?.find(item => {
                  const itemProduct = item.product_name || item.product || '';
                  return cleanForMatching(itemProduct) === cleanAssignmentProduct;
                });
                if (matchingItem) {
                  qty = parseFloat(matchingItem.net_weight) || parseFloat(matchingItem.quantity) || 0;
                }
              }

              // Get price
              let price = parseFloat(assignment.price) || 0;
              if (!price) {
                const stage4Entry = stage4ProductRows.find(s4 => {
                  const s4Product = cleanForMatching(s4.product || s4.product_name || '');
                  const s4AssignedTo = s4.assignedTo || s4.assigned_to || '';
                  return s4Product === cleanAssignmentProduct && (s4AssignedTo === assignment.assignedTo || !assignment.assignedTo);
                });
                if (stage4Entry) {
                  price = parseFloat(stage4Entry.price) || 0;
                }
              }

              return { ...assignment, assignedQty: qty, price: price };
            });

            const totalAmount = enrichedAssignments.reduce((sum, a) => sum + (a.assignedQty * a.price), 0);

            if (totalAmount > 0) {
              processedPayouts.push({
                id: `${order.oid}_${group.type}_${group.id}`,
                orderId: order.oid,
                orderDate: order.order_received_date || order.createdAt,
                entityId: group.id,
                entityType: group.type,
                recipient: getEntityName(group.type, group.id),
                amount: totalAmount,
                status: (order.payment_status === 'paid' || order.payment_status === 'completed') ? 'Paid' : 'Unpaid'
              });
            }
          });

        } catch (error) {
          console.error(`Error processing order ${order.oid}:`, error);
        }
      });

      await Promise.all(assignmentPromises);

      // Fetch and process Driver Payouts
      try {
        const [driverRatesRes, excessKMsRes] = await Promise.all([
          getAllDriverRates().catch(() => []),
          getAllExcessKMs().catch(() => ({ data: [] }))
        ]);

        const driverRates = Array.isArray(driverRatesRes) ? driverRatesRes : (driverRatesRes?.data || []);
        const excessKMs = Array.isArray(excessKMsRes) ? excessKMsRes : (excessKMsRes?.data || []);

        const ratesMap = {};
        driverRates.forEach(rate => {
          if (rate.status === 'Active') {
            const deliveryType = (rate.deliveryType || rate.delivery_type || '').toLowerCase();
            if (deliveryType) {
              ratesMap[deliveryType] = parseFloat(rate.amount || rate.rate || 0) || 0;
            }
          }
        });

        // Map excess KM by driver ID (including dates)
        const excessKMMap = {};
        excessKMs.forEach(km => {
          const driverId = String(km.driver_id || km.did || km.driver?.did || '');
          if (driverId) {
            if (!excessKMMap[driverId]) {
              excessKMMap[driverId] = { totalKM: 0, amount: 0, days: new Set() };
            }
            excessKMMap[driverId].totalKM += parseFloat(km.kilometers || 0);
            excessKMMap[driverId].amount += parseFloat(km.amount || 0);
            if (km.date) {
              try {
                const dateStr = new Date(km.date).toISOString().split('T')[0];
                excessKMMap[driverId].days.add(dateStr);
              } catch {
                excessKMMap[driverId].days.add(String(km.date));
              }
            }
          }
        });

        // Aggregate driver wages from Stage 3
        const wagesByDriverId = {};
        const workDaysByDriverId = {};

        const driverAssignmentPromises = orders.map(async (order) => {
          try {
            const assignmentRes = await getOrderAssignment(order.oid).catch(() => null);
            if (!assignmentRes?.data) return;

            const orderDate = order.order_received_date || order.createdAt;
            const dateStr = orderDate ? new Date(orderDate).toISOString().split('T')[0] : '';

            // Check Stage 1 for driver assignments in delivery routes
            let stage1Data = null;
            try {
              if (assignmentRes.data.stage1_data) {
                stage1Data = typeof assignmentRes.data.stage1_data === 'string'
                  ? JSON.parse(assignmentRes.data.stage1_data)
                  : assignmentRes.data.stage1_data;
              } else if (assignmentRes.data.product_assignments) {
                // Sometimes stage1 data is stored in product_assignments
                const assignments = typeof assignmentRes.data.product_assignments === 'string'
                  ? JSON.parse(assignmentRes.data.product_assignments)
                  : assignmentRes.data.product_assignments;
                if (Array.isArray(assignments) && assignments.length > 0) {
                  stage1Data = { deliveryRoutes: [] };
                }
              }
            } catch {
              // Ignore stage1 parsing errors
            }

            // Process Stage 1 delivery routes
            if (stage1Data?.deliveryRoutes) {
              stage1Data.deliveryRoutes.forEach(route => {
                const driverName = route.driver || '';
                if (!driverName) return;

                // Extract driver name (format might be "Name - DRV-001")
                const nameParts = driverName.split(' - ');
                const cleanDriverName = nameParts[0].trim();

                const driver = drivers.find(d => 
                  (d.driver_name || '').toLowerCase() === cleanDriverName.toLowerCase() ||
                  (d.driver_id || '').toLowerCase() === (nameParts[1] || '').toLowerCase()
                );

                if (!driver) return;

                const driverId = String(driver.did);
                if (!wagesByDriverId[driverId]) {
                  wagesByDriverId[driverId] = 0;
                  workDaysByDriverId[driverId] = new Set();
                }
                // Add a base wage for the route (can be calculated from distance or use default)
                const routeWage = parseFloat(route.driverWage || route.amount || 0) || 0;
                wagesByDriverId[driverId] += routeWage;
                if (dateStr) {
                  workDaysByDriverId[driverId].add(dateStr);
                }
              });
            }

            // Check Stage 3 for driver assignments
            let stage3Data = null;
            try {
              if (assignmentRes.data.stage3_summary_data) {
                stage3Data = typeof assignmentRes.data.stage3_summary_data === 'string'
                  ? JSON.parse(assignmentRes.data.stage3_summary_data)
                  : assignmentRes.data.stage3_summary_data;
              } else if (assignmentRes.data.stage3_data) {
                stage3Data = typeof assignmentRes.data.stage3_data === 'string'
                  ? JSON.parse(assignmentRes.data.stage3_data)
                  : assignmentRes.data.stage3_data;
              }
            } catch (e) {
              console.error('Error parsing stage3 data:', e);
            }

            // Only process Stage 3 if we have stage3Data
            // If we don't have stage3Data but have stage1Data, we've already processed it above
            if (!stage3Data) return;
            
            const airportGroups = stage3Data.summaryData?.airportGroups || stage3Data.airportGroups || {};
            const driverAssignments = stage3Data.summaryData?.driverAssignments || [];
            const products = stage3Data.products || [];

            // Process driverAssignments (for work days tracking)
            driverAssignments.forEach(assignment => {
              const driverName = assignment.driver || '';
              if (!driverName) return;

              const nameParts = driverName.split(' - ');
              const cleanDriverName = nameParts[0].trim();

              const driver = drivers.find(d => 
                (d.driver_name || '').toLowerCase() === cleanDriverName.toLowerCase() ||
                (d.driver_id || '').toLowerCase() === (nameParts[1] || '').toLowerCase() ||
                String(d.did) === String(assignment.driverId || '')
              );

              if (!driver) return;

              const driverId = String(driver.did);
              if (!wagesByDriverId[driverId]) {
                wagesByDriverId[driverId] = 0;
                workDaysByDriverId[driverId] = new Set();
              }
              if (dateStr) {
                workDaysByDriverId[driverId].add(dateStr);
              }
            });

            // Process airport groups
            Object.values(airportGroups).forEach(group => {
              let driverName = group.driver || group.driverName || '';
              
              // Also check products within the group for driver assignments
              if (!driverName && group.products && Array.isArray(group.products)) {
                for (const product of group.products) {
                  const productDriver = product.driver || product.selectedDriver || product.driverName || '';
                  if (productDriver) {
                    driverName = productDriver;
                    break; // Use first driver found in products
                  }
                }
              }
              
              if (!driverName) return;

              // Find driver by name - try multiple matching strategies
              let driver = null;
              
              // Try exact name match
              driver = drivers.find(d => 
                (d.driver_name || '').toLowerCase() === driverName.toLowerCase()
              );
              
              // If not found, try matching with driver ID format "Name - DRV-001"
              if (!driver && driverName.includes(' - ')) {
                const nameParts = driverName.split(' - ');
                const cleanName = nameParts[0].trim();
                const driverIdPart = nameParts[1]?.trim();
                
                driver = drivers.find(d => 
                  (d.driver_name || '').toLowerCase() === cleanName.toLowerCase() ||
                  (d.driver_id || '').toLowerCase() === driverIdPart?.toLowerCase()
                );
              }
              
              // If still not found, try partial name match
              if (!driver) {
                driver = drivers.find(d => 
                  (d.driver_name || '').toLowerCase().includes(driverName.toLowerCase()) ||
                  driverName.toLowerCase().includes((d.driver_name || '').toLowerCase())
                );
              }

              if (!driver) return;

              const driverId = String(driver.did);
              const driverWage = parseFloat(group.driverWage || group.pickupCost || 0) || 0;

              if (!wagesByDriverId[driverId]) {
                wagesByDriverId[driverId] = 0;
                workDaysByDriverId[driverId] = new Set();
              }

              wagesByDriverId[driverId] += driverWage;
              if (dateStr) {
                workDaysByDriverId[driverId].add(dateStr);
              }
            });

            // Process products array for driver assignments
            products.forEach(product => {
              let driverName = product.selectedDriver || product.driver || product.driverName || '';
              
              // If selectedDriver is a number/ID, try to find driver by did
              if (!driverName && product.selectedDriver) {
                const driverById = drivers.find(d => String(d.did) === String(product.selectedDriver));
                if (driverById) {
                  driverName = driverById.driver_name;
                }
              }
              
              if (!driverName) return;

              // Find driver by name or ID - try multiple strategies
              let driver = null;
              
              // If it's a number, try to find by did
              if (!isNaN(driverName)) {
                driver = drivers.find(d => String(d.did) === String(driverName));
              }
              
              // Try by driver_id if it contains DRV-
              if (!driver && typeof driverName === 'string' && driverName.includes('DRV-')) {
                driver = drivers.find(d => 
                  (d.driver_id || '').toLowerCase() === driverName.toLowerCase()
                );
              }
              
              // Try exact name match
              if (!driver) {
                driver = drivers.find(d => 
                  (d.driver_name || '').toLowerCase() === driverName.toLowerCase()
                );
              }
              
              // Try matching with "Name - DRV-001" format
              if (!driver && driverName.includes(' - ')) {
                const nameParts = driverName.split(' - ');
                const cleanName = nameParts[0].trim();
                const driverIdPart = nameParts[1]?.trim();
                
                driver = drivers.find(d => 
                  (d.driver_name || '').toLowerCase() === cleanName.toLowerCase() ||
                  (d.driver_id || '').toLowerCase() === driverIdPart?.toLowerCase()
                );
              }
              
              // Try partial match as last resort
              if (!driver) {
                driver = drivers.find(d => 
                  (d.driver_name || '').toLowerCase().includes(driverName.toLowerCase()) ||
                  driverName.toLowerCase().includes((d.driver_name || '').toLowerCase())
                );
              }

              if (!driver) return;

              const driverId = String(driver.did);
              const driverWage = parseFloat(product.driverWage || product.pickupCost || 0) || 0;

              if (!wagesByDriverId[driverId]) {
                wagesByDriverId[driverId] = 0;
                workDaysByDriverId[driverId] = new Set();
              }

              wagesByDriverId[driverId] += driverWage;
              if (dateStr) {
                workDaysByDriverId[driverId].add(dateStr);
              }
            });
          } catch (error) {
            console.error(`Error processing order ${order.oid} for driver payouts:`, error);
          }
        });

        await Promise.all(driverAssignmentPromises);

        // Get all unique driver IDs from all sources (wages, work days, excess KM)
        // Only include drivers who have actual work records
        const allDriverIds = new Set([
          ...Object.keys(wagesByDriverId),
          ...Object.keys(workDaysByDriverId),
          ...Object.keys(excessKMMap)
        ]);

        // Create driver payout records - include all drivers with any work
        allDriverIds.forEach(driverId => {
          const driver = drivers.find(d => String(d.did) === driverId);
          if (!driver) return;

          const totalWage = wagesByDriverId[driverId] || 0;
          const excessKMData = excessKMMap[driverId] || { amount: 0, days: new Set() };
          const workDays = workDaysByDriverId[driverId];
          
          // Get driver rate - try multiple ways (same as PayoutDriver.jsx)
          const deliveryType = (driver.deliveryType || driver.delivery_type || 'collection').toLowerCase();
          let rate = ratesMap[deliveryType] || ratesMap['airport'] || ratesMap['collection'] || 0;
          
          // If still no rate, try to get from any active rate
          if (!rate && driverRates.length > 0) {
            const activeRate = driverRates.find(r => r.status === 'Active');
            if (activeRate) {
              rate = parseFloat(activeRate.amount || activeRate.rate || 0) || 0;
            }
          }
          
          // Final fallback to driver's daily_wage
          if (!rate) {
            rate = parseFloat(driver.daily_wage || driver.dailyWage || 0) || 0;
          }
          
          // If still no rate, use a default
          if (!rate) {
            rate = 2000; // Default daily wage
          }
          
          // Collect all work dates for display (same as PayoutDriver.jsx)
          const orderWorkDays = workDays ? workDays : new Set();
          const allWorkDays = new Set([...orderWorkDays]);
          
          // Add excess KM days
          if (excessKMData.days && excessKMData.days.size > 0) {
            excessKMData.days.forEach(date => {
              if (date) {
                try {
                  const normalizedDate = new Date(date).toISOString().split('T')[0];
                  allWorkDays.add(normalizedDate);
                } catch {
                  allWorkDays.add(String(date));
                }
              }
            });
          }
          
          // Calculate days worked the same way as PayoutDriver: totalWage / rate, rounded
          // If no wage from assignments, calculate from work days if available
          let calculatedWage = totalWage;
          let daysWorked = 0;
          
          if (calculatedWage > 0 && rate > 0) {
            // Calculate days worked from wage (same as PayoutDriver)
            daysWorked = Math.round(calculatedWage / rate);
          } else {
            daysWorked = allWorkDays.size;
            
            // If we have work days but no wage, calculate wage from days
            if (daysWorked > 0 && rate > 0) {
              calculatedWage = daysWorked * rate;
            }
            
            // Fallback: if driver has excess KM, count as at least 1 day
            if (daysWorked === 0) {
              if (excessKMData.amount > 0) {
                daysWorked = 1;
                if (rate > 0) {
                  calculatedWage = rate;
                }
              }
            }
          }
          
          const excessKMAmount = excessKMData.amount || 0;
          
          // Net Amount = Total Wage + Excess KM Amount (same as PayoutDriver)
          const netAmount = calculatedWage + excessKMAmount;

          // Only include drivers who have actual work (wages, excess KM, or work days)
          const hasWork = totalWage > 0 || excessKMData.amount > 0 || allWorkDays.size > 0;
          
          if (!hasWork) {
            return; // Skip drivers with no work
          }

          // Format dates for display (same as PayoutDriver.jsx)
          // If still no dates but driver has wages, try to get dates from orders
          if (allWorkDays.size === 0 && (totalWage > 0 || excessKMData.amount > 0)) {
            // Look through all orders to find dates for this driver
            const orderDates = [];
            orders.forEach(order => {
              const orderDateValue = order.order_received_date || order.createdAt;
              if (orderDateValue) {
                try {
                  const dateStr = new Date(orderDateValue).toISOString().split('T')[0];
                  orderDates.push(dateStr);
                } catch {
                  // Ignore invalid dates
                }
              }
            });
            // If we found order dates, use the most recent one
            if (orderDates.length > 0) {
              const sortedOrderDates = orderDates.sort().reverse();
              allWorkDays.add(sortedOrderDates[0]); // Use most recent order date
            }
          }
          
          // Format dates for display (same as PayoutDriver.jsx)
          let orderDate = null;
          if (allWorkDays.size > 0) {
            const sortedDates = Array.from(allWorkDays).sort();
            if (sortedDates.length === 1) {
              // Single date - format as YYYY-MM-DD for storage
              orderDate = sortedDates[0];
            } else {
              // Multiple dates - use the most recent one for the report
              orderDate = sortedDates[sortedDates.length - 1];
            }
          }
          
          // Final fallback to current date if no dates found
          if (!orderDate) {
            orderDate = new Date().toISOString().split('T')[0];
          }
          
          // Ensure date is in proper format (YYYY-MM-DD string)
          if (orderDate) {
            try {
              // If it's already a YYYY-MM-DD string, use it directly
              if (typeof orderDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(orderDate)) {
                // Already in correct format, use as-is
              } else {
                // Convert to YYYY-MM-DD format
                const dateObj = new Date(orderDate);
                if (!isNaN(dateObj.getTime())) {
                  orderDate = dateObj.toISOString().split('T')[0];
                } else {
                  orderDate = new Date().toISOString().split('T')[0];
                }
              }
            } catch {
              // If parsing fails, use current date
              orderDate = new Date().toISOString().split('T')[0];
            }
          }

          processedPayouts.push({
            id: `driver_${driverId}`,
            orderId: '-', // Drivers don't have specific order IDs
            orderDate: orderDate,
            entityId: driverId,
            entityType: 'driver',
            recipient: driver.driver_name || 'Unknown Driver',
            amount: netAmount || 0,
            status: 'Unpaid'
          });
        });
      } catch (error) {
        console.error('Error processing driver payouts:', error);
      }

      // Fetch and process Labour Payouts
      try {
        const [labourRatesRes, excessPayRes] = await Promise.all([
          getAllLabourRates().catch(() => []),
          getAllLabourExcessPay().catch(() => ({ data: [] }))
        ]);

        const labourRates = Array.isArray(labourRatesRes) ? labourRatesRes : (labourRatesRes?.data || []);
        const excessPays = excessPayRes?.data || [];

        const ratesMap = {};
        labourRates.forEach(rate => {
          if (rate.status === 'Active') {
            ratesMap[rate.labourType] = parseFloat(rate.amount) || 0;
          }
        });

        const excessPayMap = {};
        excessPays.forEach(pay => {
          excessPayMap[String(pay.labour_id)] = parseFloat(pay.amount) || 0;
        });

        // Aggregate wages per labour from Stage 2 summary
        const wagesByLabourId = {};
        const workDatesByLabourId = {};

        const labourAssignmentPromises = orders.map(async (order) => {
          try {
            const assignmentRes = await getOrderAssignment(order.oid).catch(() => null);
            if (!assignmentRes?.data?.stage2_summary_data) return;

            const orderDate = order.order_received_date || order.createdAt;
            const dateStr = orderDate ? new Date(orderDate).toISOString().split('T')[0] : '';

            let summary;
            try {
              summary = typeof assignmentRes.data.stage2_summary_data === 'string'
                ? JSON.parse(assignmentRes.data.stage2_summary_data)
                : assignmentRes.data.stage2_summary_data;
            } catch {
              return;
            }

            const labourPrices = summary.labourPrices || [];
            labourPrices.forEach(lp => {
              const labourId = lp.labourId;
              const labourName = lp.labourName || lp.labour;
              if (!labourId && !labourName) return;

              const idKey = labourId ? String(labourId) : null;
              const wage = parseFloat(lp.totalAmount ?? lp.labourWage ?? 0) || 0;

              if (!wage) return;

              const key = idKey || labourName;
              if (!wagesByLabourId[key]) {
                wagesByLabourId[key] = 0;
                workDatesByLabourId[key] = new Set();
              }
              wagesByLabourId[key] += wage;
              if (dateStr) {
                workDatesByLabourId[key].add(dateStr);
              }
            });
          } catch (error) {
            console.error(`Error processing order ${order.oid} for labour payouts:`, error);
          }
        });

        await Promise.all(labourAssignmentPromises);

        // Create labour payout records
        Object.entries(wagesByLabourId).forEach(([key, totalWage]) => {
          let labour = labours.find(l => String(l.lid) === key);
          if (!labour) {
            const normalizedName = key.toLowerCase();
            labour = labours.find(l =>
              (l.full_name || l.name || '').trim().toLowerCase() === normalizedName
            );
          }

          if (!labour) return;

          const labourId = String(labour.lid);
          const excessPay = excessPayMap[labourId] || 0;
          const netAmount = totalWage + excessPay;

          if (netAmount > 0) {
            // Get the most recent work date for this labour
            const workDates = workDatesByLabourId[key];
            let latestDate = null;
            if (workDates && workDates.size > 0) {
              // Use the most recent work date
              const sortedDates = Array.from(workDates).sort().reverse();
              latestDate = sortedDates[0];
              // Ensure date is in proper format
              try {
                latestDate = new Date(latestDate).toISOString();
              } catch {
                // Keep as-is if parsing fails
              }
            } else {
              // Use most recent order date as fallback
              latestDate = orders.length > 0 ? (orders[0].order_received_date || orders[0].createdAt) : new Date().toISOString();
            }

            processedPayouts.push({
              id: `labour_${labourId}`,
              orderId: '-', // Labour don't have specific order IDs
              orderDate: latestDate,
              entityId: labourId,
              entityType: 'labour',
              recipient: labour.full_name || labour.name || 'Unknown Labour',
              amount: netAmount,
              status: 'Unpaid'
            });
          }
        });
      } catch (error) {
        console.error('Error processing labour payouts:', error);
      }

      // Sort by date newest first
      processedPayouts.sort((a, b) => new Date(b.orderDate) - new Date(a.orderDate));

      setAllPayouts(processedPayouts);

    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredPayouts = useMemo(() => {
    return allPayouts.filter(payout => {
      // Type Filter
      if (filters.type !== 'all' && payout.entityType !== filters.type) return false;

      // Status Filter
      if (filters.status !== 'all') {
        if (filters.status === 'paid' && payout.status !== 'Paid') return false;
        if (filters.status === 'unpaid' && payout.status !== 'Unpaid') return false;
      }

      // Date Filter
      if (filters.dateFrom) {
        const payoutDate = new Date(payout.orderDate);
        const fromDate = new Date(filters.dateFrom);
        fromDate.setHours(0, 0, 0, 0);
        if (payoutDate < fromDate) return false;
      }
      if (filters.dateTo) {
        const payoutDate = new Date(payout.orderDate);
        const toDate = new Date(filters.dateTo);
        toDate.setHours(23, 59, 59, 999);
        if (payoutDate > toDate) return false;
      }

      return true;
    });
  }, [allPayouts, filters]);


  // Stats Calculations
  const stats = useMemo(() => {
    const total = filteredPayouts.reduce((sum, p) => sum + p.amount, 0);
    const paid = filteredPayouts.filter(p => p.status === 'Paid').reduce((sum, p) => sum + p.amount, 0);
    const pending = filteredPayouts.filter(p => p.status === 'Unpaid').reduce((sum, p) => sum + p.amount, 0);

    return [
      { label: 'Total Payouts', value: filteredPayouts.length.toString(), sub: 'Transactions', color: 'bg-gradient-to-r from-[#10B981] to-[#059669]' },
      { label: 'Total Amount', value: `₹${(total / 1000).toFixed(1)}K`, sub: 'Value', color: 'bg-gradient-to-r from-[#3B82F6] to-[#2563EB]' },
      { label: 'Paid Amount', value: `₹${(paid / 1000).toFixed(1)}K`, sub: `${((paid / total || 0) * 100).toFixed(0)}%`, color: 'bg-gradient-to-r from-[#4ED39A] to-[#34D399]' },
      { label: 'Pending Amount', value: `₹${(pending / 1000).toFixed(1)}K`, sub: `${((pending / total || 0) * 100).toFixed(0)}%`, color: 'bg-gradient-to-r from-[#F59E0B] to-[#D97706]' }
    ];
  }, [filteredPayouts]);

  const totalPages = calcPayoutTotalPages(filteredPayouts.length, itemsPerPage);
  const paginatedPayouts = getPayoutPageSlice(filteredPayouts, currentPage, itemsPerPage);

  const exportToExcel = () => {
    const wb = XLSX.utils.book_new();
    const data = filteredPayouts.map(p => {
      const baseData = {
        'Payout ID': p.id,
        'Recipient': p.recipient,
        'Type': p.entityType === 'thirdParty' ? 'Third Party' : p.entityType.charAt(0).toUpperCase() + p.entityType.slice(1),
        'Amount': p.amount,
        'Date': new Date(p.orderDate).toLocaleDateString('en-GB'),
        'Status': p.status
      };
      // Only include Order ID if not driver or labour
      if (p.entityType !== 'driver' && p.entityType !== 'labour') {
        baseData['Order ID'] = p.orderId;
      }
      return baseData;
    });

    const ws = XLSX.utils.json_to_sheet(data);
    XLSX.utils.book_append_sheet(wb, ws, "Payouts");
    XLSX.writeFile(wb, `Payouts_Report_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  const handleExportPDF = () => {
    const doc = new jsPDF();

    // Attractive Header
    doc.setFillColor(13, 92, 77);
    doc.rect(0, 0, 210, 40, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(22);
    doc.setFont(undefined, 'bold');
    doc.text('PAYOUT REPORT', 105, 20, { align: 'center' });

    // Subheader with Filter Details
    doc.setFontSize(10);
    doc.setFont(undefined, 'normal');
    let filterText = `Generated on: ${new Date().toLocaleDateString('en-GB')}`;
    if (filters.type !== 'all') filterText += ` | Type: ${filters.type.charAt(0).toUpperCase() + filters.type.slice(1)}`;
    if (filters.status !== 'all') filterText += ` | Status: ${filters.status.charAt(0).toUpperCase() + filters.status.slice(1)}`;
    doc.text(filterText, 105, 30, { align: 'center' });

    // Table Data - always include Order ID
    const tableBody = filteredPayouts.map(p => {
      return [
        p.orderId,
        p.recipient,
        p.entityType === 'thirdParty' ? 'Third Party' : p.entityType.charAt(0).toUpperCase() + p.entityType.slice(1),
        `Rs. ${p.amount.toFixed(2)}`,
        new Date(p.orderDate).toLocaleDateString('en-GB'),
        p.status
      ];
    });

    const tableHeaders = [['Order ID', 'Recipient', 'Type', 'Amount', 'Date', 'Status']];

    doc.autoTable({
      startY: 50,
      head: tableHeaders,
      body: tableBody,
      theme: 'grid',
      headStyles: { fillColor: [13, 92, 77], textColor: 255, fontStyle: 'bold', halign: 'center' },
      bodyStyles: { fontSize: 9, halign: 'center' },
      alternateRowStyles: { fillColor: [240, 253, 244] },
      columnStyles: {
        0: { halign: 'center' },
        1: { halign: 'left' },
        3: { halign: 'right' }
      }
    });

    const finalY = doc.lastAutoTable.finalY + 10;

    // Summary Section
    doc.setFillColor(236, 253, 245);
    doc.rect(14, finalY, 182, 25, 'F');

    const totalAmount = filteredPayouts.reduce((sum, p) => sum + p.amount, 0);
    const paidAmount = filteredPayouts.filter(p => p.status === 'Paid').reduce((sum, p) => sum + p.amount, 0);
    const pendingAmount = filteredPayouts.filter(p => p.status === 'Unpaid').reduce((sum, p) => sum + p.amount, 0);

    doc.setTextColor(13, 92, 77);
    doc.setFontSize(10);
    doc.setFont(undefined, 'bold');
    doc.text(`Total Payouts: ${filteredPayouts.length}`, 20, finalY + 8);
    doc.text(`Total Amount: Rs. ${totalAmount.toFixed(2)}`, 20, finalY + 16);

    doc.text(`Paid: Rs. ${paidAmount.toFixed(2)}`, 100, finalY + 8);
    doc.text(`Pending: Rs. ${pendingAmount.toFixed(2)}`, 100, finalY + 16);

    doc.save(`Payout_Report_${new Date().toISOString().split('T')[0]}.pdf`);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-[#0D8568] text-xl animate-pulse">Loading payout details...</div>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8 bg-gradient-to-br from-[#E6F7F4] to-[#D0E9E4] min-h-screen">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <button onClick={() => navigate('/reports')} className="flex items-center gap-2 text-[#0D5C4D] hover:text-[#0a6354] transition-colors w-fit">
          <ArrowLeft size={20} />
          <span className="font-medium">Back to Reports</span>
        </button>
        <div className="flex gap-2">
          <button
            onClick={handleExportPDF}
            className="flex items-center gap-2 px-4 py-2 bg-red-500 text-white rounded-lg shadow hover:bg-red-600 transition-colors"
          >
            <FileText size={18} />
            Export PDF
          </button>
          <button
            onClick={exportToExcel}
            className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg shadow hover:bg-green-700 transition-colors"
          >
            <FileSpreadsheet size={18} />
            Export Excel
          </button>
        </div>
      </div>

      <h1 className="text-2xl font-bold text-[#0D5C4D] mb-6">Payout Management</h1>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        {stats.map((stat, index) => (
          <div key={index} className={`${stat.color} rounded-2xl p-6 text-white shadow-lg transform hover:scale-105 transition-transform`}>
            <div className="text-sm font-medium mb-2 opacity-90">{stat.label}</div>
            <div className="text-4xl font-bold mb-2">{stat.value}</div>
            <div className="inline-block px-3 py-1 rounded-full text-xs font-medium bg-white/20 text-white">
              {stat.sub}
            </div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="bg-white rounded-2xl shadow-md p-4 mb-6">
        <div className="flex flex-col md:flex-row gap-4 items-end">
          <div className="flex-1 w-full">
            <label className="block text-sm font-medium text-[#6B8782] mb-1">Entity Type</label>
            <select
              value={filters.type}
              onChange={(e) => { setFilters({ ...filters, type: e.target.value }); setCurrentPage(1); }}
              className="w-full px-4 py-2 border border-[#D0E0DB] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0D8568]"
            >
              <option value="all">All Entities</option>
              <option value="farmer">Farmer</option>
              <option value="supplier">Supplier</option>
              <option value="thirdParty">Third Party</option>
              <option value="driver">Driver</option>
              <option value="labour">Labour</option>
            </select>
          </div>
          <div className="flex-1 w-full">
            <label className="block text-sm font-medium text-[#6B8782] mb-1">Payment Status</label>
            <select
              value={filters.status}
              onChange={(e) => { setFilters({ ...filters, status: e.target.value }); setCurrentPage(1); }}
              className="w-full px-4 py-2 border border-[#D0E0DB] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0D8568]"
            >
              <option value="all">All Status</option>
              <option value="paid">Paid</option>
              <option value="unpaid">Unpaid</option>
            </select>
          </div>
          <div className="flex-1 w-full">
            <label className="block text-sm font-medium text-[#6B8782] mb-1">From Date</label>
            <input
              type="date"
              value={filters.dateFrom}
              onChange={(e) => { setFilters({ ...filters, dateFrom: e.target.value }); setCurrentPage(1); }}
              className="w-full px-4 py-2 border border-[#D0E0DB] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0D8568]"
            />
          </div>
          <div className="flex-1 w-full">
            <label className="block text-sm font-medium text-[#6B8782] mb-1">To Date</label>
            <input
              type="date"
              value={filters.dateTo}
              onChange={(e) => { setFilters({ ...filters, dateTo: e.target.value }); setCurrentPage(1); }}
              className="w-full px-4 py-2 border border-[#D0E0DB] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0D8568]"
            />
          </div>
          <button
            onClick={() => setFilters({ type: 'all', status: 'all', dateFrom: '', dateTo: '' })}
            className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-600 rounded-lg transition-colors h-[42px]"
          >
            Clear
          </button>
        </div>
      </div>

      {/* Table */}
      <div className={payoutTableWrap}>
        <div className={payoutTableScroll}>
          <table className={`${payoutTableBase} min-w-[900px]`}>
            <colgroup>
              <col style={{ width: '14%' }} />
              <col style={{ width: '24%' }} />
              <col style={{ width: '14%' }} />
              <col style={{ width: '14%' }} />
              <col style={{ width: '14%' }} />
              <col style={{ width: '20%' }} />
            </colgroup>
            <thead className={payoutThead}>
              <tr>
                <th className={`${payoutTh} text-left`}>Order ID</th>
                <th className={`${payoutTh} text-left`}>Recipient</th>
                <th className={`${payoutTh} text-center`}>Type</th>
                <th className={`${payoutTh} text-right`}>Amount</th>
                <th className={`${payoutTh} text-left`}>Date</th>
                <th className={`${payoutTh} text-center`}>Status</th>
              </tr>
            </thead>
            <tbody className={payoutTbody}>
              {paginatedPayouts.length > 0 ? (
                paginatedPayouts.map((payout, index) => (
                  <tr key={index} className={payoutRow(index)}>
                    <td className={`${payoutTd} font-medium`}>{payout.orderId}</td>
                    <td className={`${payoutTd} font-semibold`}>{payout.recipient}</td>
                    <td className={payoutTdCenter}>
                      <span className={`inline-flex px-2.5 py-1 rounded-full text-xs font-semibold
                        ${payout.entityType === 'farmer' ? 'bg-[#D1FAE5] text-[#065F46]' :
                          payout.entityType === 'supplier' ? 'bg-[#DBEAFE] text-[#1E40AF]' :
                          payout.entityType === 'thirdParty' ? 'bg-[#FEF3C7] text-[#92400E]' :
                          payout.entityType === 'driver' ? 'bg-[#E0E7FF] text-[#3730A3]' :
                          payout.entityType === 'labour' ? 'bg-[#FCE7F3] text-[#831843]' :
                          'bg-gray-200 text-gray-700'}`}>
                        {payout.entityType === 'thirdParty' ? 'Third Party' : payout.entityType.charAt(0).toUpperCase() + payout.entityType.slice(1)}
                      </span>
                    </td>
                    <td className={`${payoutTdNum} font-bold`}>₹{payout.amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                    <td className={`${payoutTd} whitespace-nowrap`}>{new Date(payout.orderDate).toLocaleDateString('en-GB')}</td>
                    <td className={payoutTdCenter}>
                      <span className={`inline-flex px-2.5 py-1 rounded-full text-xs font-semibold ${getPayoutStatusClassName(payout.status)}`}>
                        {payout.status}
                      </span>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={6} className={payoutEmptyCell}>
                    No payouts found matching your filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <PayoutPagination
          currentPage={currentPage}
          totalPages={totalPages}
          totalItems={filteredPayouts.length}
          itemsPerPage={itemsPerPage}
          onPageChange={setCurrentPage}
          onClampPage={setCurrentPage}
          itemLabel="payouts"
        />
      </div>
    </div>
  );
};

export default ReportPayout;
