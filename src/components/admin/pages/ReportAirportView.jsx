import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, FileDown, Download } from 'lucide-react';
import { getAllOrders } from '../../../api/orderApi';
import { getOrderAssignment } from '../../../api/orderAssignmentApi';
import { getFlowerOrderAssignment } from '../../../api/flowerOrderAssignmentApi';
import { getAllDrivers } from '../../../api/driverApi';
import { getAllInventory } from '../../../api/inventoryApi';
import { getAllLabourRates } from '../../../api/labourRateApi';
import { getAllDriverRates } from '../../../api/driverRateApi';
import { getAllFuelExpenses } from '../../../api/fuelExpenseApi';
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import * as XLSX from 'xlsx-js-style';

const ReportAirportView = () => {
  const { orderId } = useParams();
  const navigate = useNavigate();
  const [order, setOrder] = useState(null);
  const [assignment, setAssignment] = useState(null);
  const [drivers, setDrivers] = useState([]);
  const [stockItems, setStockItems] = useState([]);
  const [labourRates, setLabourRates] = useState([]);
  const [driverRates, setDriverRates] = useState([]);
  const [fuelExpenses, setFuelExpenses] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchOrderDetails();
  }, [orderId]);

  const fetchOrderDetails = async () => {
    try {
      setLoading(true);
      const [driversResponse, stockResponse, ratesResponse, driverRatesResponse, fuelExpensesResponse] = await Promise.all([
        getAllDrivers(),
        getAllInventory(1, 1000),
        getAllLabourRates(),
        getAllDriverRates(),
        getAllFuelExpenses()
      ]);

      if (driversResponse?.success && driversResponse?.data) setDrivers(driversResponse.data);
      if (stockResponse) {
        const data = stockResponse?.data?.data ?? stockResponse?.data ?? stockResponse;
        setStockItems(Array.isArray(data) ? data : []);
      }
      if (ratesResponse) {
        const data = Array.isArray(ratesResponse) ? ratesResponse : ratesResponse?.data ?? [];
        setLabourRates(data);
      }
      if (driverRatesResponse) {
        const data = Array.isArray(driverRatesResponse) ? driverRatesResponse : driverRatesResponse?.data ?? [];
        setDriverRates(data);
      }
      if (fuelExpensesResponse) {
        const data = fuelExpensesResponse?.data ?? (Array.isArray(fuelExpensesResponse) ? fuelExpensesResponse : []);
        setFuelExpenses(data);
      }

      const ordersRes = await getAllOrders();
      const orders = ordersRes?.data ?? [];
      const foundOrder = orders.find(o => o.oid == orderId || o.order_auto_id === orderId);

      if (!foundOrder) {
        setOrder(null);
        setAssignment(null);
        return;
      }

      setOrder(foundOrder);
      const isFlower = foundOrder.order_type === 'flower' || foundOrder.order_type === 'FLOWER ORDER';
      try {
        const res = isFlower ? await getFlowerOrderAssignment(foundOrder.oid) : await getOrderAssignment(foundOrder.oid);
        setAssignment(res?.data ?? null);
      } catch {
        setAssignment(null);
      }
    } catch (err) {
      console.error('Error fetching airport report:', err);
    } finally {
      setLoading(false);
    }
  };

  const stage3Cards = useMemo(() => {
    if (!order || !assignment?.stage3_data || !drivers) return [];

    let stage3Data = typeof assignment.stage3_data === 'string' ? JSON.parse(assignment.stage3_data) : assignment.stage3_data;
    const deliveryData = stage3Data.products || [];
    const airportGroups = stage3Data.summaryData?.airportGroups || {};

    const parseNumBoxesLocal = (numBoxesStr) => {
      if (!numBoxesStr) return 0;
      const match = String(numBoxesStr).match(/^(\d+(?:\.\d+)?)/);
      return match ? parseFloat(match[1]) : 0;
    };
    const orderItemsByOiid = {};
    (order.items || []).forEach((oi) => {
      if (oi.oiid != null) orderItemsByOiid[oi.oiid] = oi;
    });
    let summaryAirportGroups = airportGroups;
    if (assignment.stage3_summary_data) {
      try {
        const s3 = typeof assignment.stage3_summary_data === 'string' ? JSON.parse(assignment.stage3_summary_data) : assignment.stage3_summary_data;
        if (s3?.airportGroups && Object.keys(s3.airportGroups).length) summaryAirportGroups = s3.airportGroups;
      } catch {}
    }

    let stage4ProductRows = [];
    if (assignment.stage4_data) {
      const s4 = typeof assignment.stage4_data === 'string' ? JSON.parse(assignment.stage4_data) : assignment.stage4_data;
      stage4ProductRows = s4.reviewData?.productRows || s4.productRows || [];
    }

    let stage2LabourMap = {};
    if (assignment.stage2_data) {
      try {
        const s2 = typeof assignment.stage2_data === 'string' ? JSON.parse(assignment.stage2_data) : assignment.stage2_data;
        const s2Assignments = s2.productAssignments || s2.stage2Assignments || s2.assignments || [];
        s2Assignments.forEach(s2Item => {
          const pName = s2Item.product || s2Item.productName;
          const pLabour = s2Item.labourName || s2Item.labourNames || s2Item.labour;
          if (pName && pLabour) stage2LabourMap[pName] = pLabour;
        });
      } catch {}
    }
    if (assignment.stage2_summary_data) {
      try {
        const s2Summary = typeof assignment.stage2_summary_data === 'string' ? JSON.parse(assignment.stage2_summary_data) : assignment.stage2_summary_data;
        const labourAssignments = s2Summary.labourAssignments || [];
        if (Object.keys(stage2LabourMap).length === 0 && labourAssignments.length > 0) {
          labourAssignments.forEach(lg => {
            (lg.assignments || []).forEach(a => {
              const pid = a.oiid, pn = a.product;
              if (pid && lg.labour) {
                if (!stage2LabourMap[pid]) stage2LabourMap[pid] = [];
                if (!stage2LabourMap[pid].includes(lg.labour)) stage2LabourMap[pid].push(lg.labour);
              }
              if (pn && lg.labour) {
                if (!stage2LabourMap[pn]) stage2LabourMap[pn] = [];
                if (!stage2LabourMap[pn].includes(lg.labour)) stage2LabourMap[pn].push(lg.labour);
              }
            });
          });
          Object.keys(stage2LabourMap).forEach(k => {
            if (Array.isArray(stage2LabourMap[k])) stage2LabourMap[k] = stage2LabourMap[k].join(', ');
          });
        }
      } catch {}
    }

    const getFuelExpenseForDriver = (driverId, date) => {
      if (!driverId || !date || !fuelExpenses?.length) return 0;
      const expenseDate = new Date(date).toISOString().split('T')[0];
      return fuelExpenses.filter(e => {
        const did = e.driver_id || e.did || e.driver?.did;
        const d = e.date ? new Date(e.date).toISOString().split('T')[0] : '';
        return did == driverId && d === expenseDate;
      }).reduce((sum, e) => {
        let t = parseFloat(e.total_amount || e.total || 0);
        if (!t) t = (parseFloat(e.unit_price || 0) || 0) * (parseFloat(e.litre || 0) || 0);
        return sum + (isNaN(t) ? 0 : t);
      }, 0);
    };

    const getStockPrice = (query) => {
      const item = stockItems.find(i => (i.product_name || i.item_name || i.name || '').toLowerCase().includes(query.toLowerCase()));
      const raw = item?.price ?? item?.average_price ?? item?.unit_price ?? 0;
      const num = parseFloat(raw);
      return isNaN(num) ? 0 : num;
    };

    const getTapeQtyFromAg = (ag) => {
      if (Array.isArray(ag?.tapes) && ag.tapes.length) return ag.tapes.reduce((s, t) => s + (parseFloat(t.tapeQuantity || t.tapeQty || 0) || 0), 0);
      return parseFloat(ag?.tapeQuantity || ag?.tapeQty || 0) || 0;
    };
    const getTapeQtyFromTapeData = (info) => {
      if (Array.isArray(info)) return info.reduce((s, t) => s + (parseFloat(t.tapeQuantity || t.tapeQty || 0) || 0), 0);
      return parseFloat(info?.tapeQuantity || info?.tapeQty || 0) || 0;
    };

    let productsByDriver = {};
    deliveryData.forEach(item => {
      const product = item.product || item.productName || '-';
      let driverName = '';
      let driverInfo = null;
      if (item.selectedDriver) {
        driverInfo = drivers.find(d => d.did == item.selectedDriver || d.driver_id == item.selectedDriver);
        if (driverInfo) driverName = driverInfo.driver_name;
      }
      if (!driverName) driverName = item.driver || item.driverName || '';
      if (!driverName) {
        for (const [, ag] of Object.entries(airportGroups)) {
          const pIn = ag?.products?.find(p => (p.product || p.productName) === product);
          if (pIn) { driverName = pIn.driver || ''; break; }
        }
      }
      if (!driverName) driverName = 'Unassigned';

      if (!productsByDriver[driverName]) {
        productsByDriver[driverName] = { products: [], totalAmount: 0, totalWeight: 0, totalBoxes: 0, airportName: '-', driverInfo };
      }
      if (!productsByDriver[driverName].driverInfo && driverName !== 'Unassigned') {
        productsByDriver[driverName].driverInfo = drivers.find(d => d.driver_name === driverName) || {};
      }

      let grossWeight = parseFloat(String(item.grossWeight || item.gross_weight || '0').replace(/[^0-9.]/g, '')) || 0;
      const lineOiid = item.oiid;
      const orderLine = lineOiid != null ? orderItemsByOiid[lineOiid] : null;
      if (orderLine) {
        const lineGross = parseFloat(orderLine.gross_weight ?? orderLine.grossWeight);
        const lineBoxes = parseNumBoxesLocal(orderLine.num_boxes ?? orderLine.numBoxes);
        const rowPkgs = parseInt(item.noOfPkgs || item.no_of_pkgs || 0, 10) || 0;
        if (!isNaN(lineGross) && lineGross > 0 && lineBoxes > 0) {
          grossWeight = rowPkgs > 0 ? (lineGross * rowPkgs) / lineBoxes : lineGross;
        } else {
          const lineNet = parseFloat(orderLine.net_weight ?? orderLine.netWeight) || 0;
          const boxPerBox = parseFloat(orderLine.box_weight ?? orderLine.boxWeight) || 0;
          if (lineBoxes > 0 && boxPerBox > 0) {
            const pkgs = rowPkgs > 0 ? rowPkgs : lineBoxes;
            grossWeight = (lineNet * pkgs) / lineBoxes + pkgs * boxPerBox;
          }
        }
      }
      const stage4Product = stage4ProductRows.find(p4 => (p4.product_name || p4.product || p4.productName) === product);
      const pricePerKg = stage4Product ? parseFloat(stage4Product.price || stage4Product.final_price || 0) : 0;
      const netWeight = stage4Product ? parseFloat(stage4Product.net_weight || stage4Product.quantity || 0) : grossWeight;
      const productTotal = pricePerKg * netWeight;
      const noOfPkgs = parseInt(item.noOfPkgs || item.no_of_pkgs || 0) || 0;

      if (productsByDriver[driverName].airportName === '-') productsByDriver[driverName].airportName = item.airportName || item.airport_name || '-';

      productsByDriver[driverName].products.push({
        product, grossWeight, netWeight, rate: pricePerKg, amount: productTotal, box: noOfPkgs,
        ct: item.ct || item.CT, labour: item.labour || item.labourName || stage2LabourMap[product],
        packingType: item.packingType || item.packing_type || '', sNo: productsByDriver[driverName].products.length + 1
      });
      productsByDriver[driverName].totalAmount += productTotal;
      productsByDriver[driverName].totalWeight += grossWeight;
      productsByDriver[driverName].totalBoxes += noOfPkgs;
    });

    Object.values(productsByDriver).forEach(dd => {
      for (const [code, ag] of Object.entries(summaryAirportGroups)) {
        if (ag && (ag.airportName || '').toLowerCase() === (dd.airportName || '').toLowerCase()) {
          dd.airportCode = code;
          break;
        }
      }
      let qty = 0;
      for (const ag of Object.values(summaryAirportGroups || {})) {
        if (ag && (ag.airportName || '').toLowerCase() === (dd.airportName || '').toLowerCase()) {
          qty = getTapeQtyFromAg(ag);
          break;
        }
      }
      if (!qty && stage3Data.airportTapeData?.[dd.airportName]) qty = getTapeQtyFromTapeData(stage3Data.airportTapeData[dd.airportName]);
      dd.tapeQuantity = qty;
    });

    const orderDate = new Date(order.order_received_date || order.createdAt);
    const dayName = orderDate.toLocaleDateString('en-US', { weekday: 'long' }).toUpperCase();
    const shortDate = orderDate.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: '2-digit' }).replace(/ /g, '/');

    const driverRateObj = driverRates.find(r => r.deliveryType?.toLowerCase().includes('airport') && r.status === 'Active') || driverRates.find(r => r.status === 'Active');
    const driverWageDefault = driverRateObj ? parseFloat(driverRateObj.amount) : 0;

    return Object.entries(productsByDriver).map(([driverName, data], index) => {
      let count10kg = 0, count5kg = 0, countThermo = 0, countNetBag = 0;
      data.products.forEach(p => {
        const lower = (p.product || '').toLowerCase(), lowerType = (p.packingType || '').toLowerCase(), q = p.box || 0;
        if (lowerType.includes('5kg') || lower.includes('5kg')) count5kg += q;
        else if (lowerType.includes('thermo') || lower.includes('thermo')) countThermo += q;
        else if (lowerType.includes('bag') || lower.includes('bag')) countNetBag += q;
        else count10kg += q;
      });

      const price10kg = getStockPrice('10 kg box') || getStockPrice('10kg box') || 80;
      const price5kg = getStockPrice('5 kg box') || 45;
      const priceThermo = getStockPrice('thermo') || 145;
      const priceNetBag = getStockPrice('net bag') || 0;
      const cost10kg = count10kg * price10kg, cost5kg = count5kg * price5kg, costThermo = countThermo * priceThermo, costNetBag = countNetBag * priceNetBag;
      const totalBoxCost = cost10kg + cost5kg + costThermo + costNetBag;

      const pickupCost = getStockPrice('pickup') || 0;
      const tapeUnitPrice = getStockPrice('tape') || 0;
      const tapeCost = tapeUnitPrice * data.tapeQuantity + 0;
      const driverWage = driverWageDefault;
      const fuelExpense = getFuelExpenseForDriver(data.driverInfo?.did || data.driverInfo?.driver_id, order.order_received_date || order.createdAt);
      const totalOverhead = pickupCost + tapeCost + driverWage + fuelExpense;
      const totalExpenses = totalBoxCost + totalOverhead;
      const vegExpenses = data.totalAmount;
      const grossWeight = data.totalWeight;
      const tareWeight = (count10kg * 1.5) + (count5kg * 1.0) + (countThermo * 0.5);
      const netWeight = grossWeight - tareWeight;
      const totalExpPerKg = netWeight > 0 ? ((vegExpenses + totalExpenses) / netWeight).toFixed(0) : 0;
      const driverNameWithNum = String(driverName || '').toUpperCase().trim();

      const packagingRows = [];
      if (count10kg > 0) packagingRows.push({ label: '10 KG BOX', count: count10kg, rate: price10kg, total: cost10kg });
      if (count5kg > 0) packagingRows.push({ label: '05 KG BOX', count: count5kg, rate: price5kg, total: cost5kg });
      if (countThermo > 0) packagingRows.push({ label: 'THERMO BOX', count: countThermo, rate: priceThermo, total: costThermo });
      if (countNetBag > 0) packagingRows.push({ label: 'NET BAG', count: countNetBag, rate: priceNetBag, total: costNetBag });
      packagingRows.push({ label: `${driverNameWithNum} PICKUP`, count: null, rate: null, total: driverWage, hideCost: true });
      packagingRows.push({ label: 'TAPE & PAPER', count: data.tapeQuantity ?? 0, rate: null, total: null });
      if (fuelExpense > 0) packagingRows.push({ label: 'FUEL EXPENSE', count: null, rate: null, total: fuelExpense });

      return {
        dayName, shortDate, airportCode: data.airportCode || `GVT${(index + 1).toString().padStart(3, '0')}`,
        airportName: data.airportName, driverNameWithNum, products: data.products,
        packagingRows, totalExpenses, vegExpenses, netWeight, grossWeight,
        boxes10kg: count10kg, boxes5kg: count5kg, boxesThermo: countThermo,
        bags: countNetBag, totalProducts: data.products.length, totalExpPerKg
      };
    });
  }, [order, assignment, drivers, stockItems, labourRates, driverRates, fuelExpenses]);

  const handleExportPDF = () => {
    if (!stage3Cards.length || !order) return;
    const doc = new jsPDF(); // Portrait, same as Order/Flower report
    const cleanText = (s) => (s == null ? '' : String(s).replace(/₹/g, 'Rs. ').replace(/[^\x00-\x7F]/g, '').trim());

    const orderDate = new Date(order.order_received_date || order.createdAt);
    const dayName = orderDate.toLocaleDateString('en-US', { weekday: 'long' }).toUpperCase();
    const fullDate = orderDate.toLocaleDateString('en-GB');

    // Header - same as Order Report
    doc.setFillColor(13, 92, 77);
    doc.rect(0, 0, 210, 30, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(24);
    doc.setFont(undefined, 'bold');
    doc.text('AIRPORT REPORT', 105, 12, { align: 'center' });
    doc.setFontSize(12);
    doc.setFont(undefined, 'normal');
    doc.text(cleanText(order.order_auto_id || order.oid), 105, 22, { align: 'center' });

    doc.setTextColor(0, 0, 0);
    doc.autoTable({
      startY: 35,
      head: [['Order', 'Date', 'Stage']],
      body: [[cleanText(order.order_auto_id || order.oid), fullDate, 'Stage 3: Delivery Routes']],
      theme: 'grid',
      headStyles: { fillColor: [16, 185, 129], textColor: 255, fontStyle: 'bold', halign: 'center', fontSize: 10 },
      bodyStyles: { halign: 'center', fontSize: 10, cellPadding: 3 },
    });

    let finalY = doc.lastAutoTable.finalY + 12;

    // Stage 3 section header - same as Order Report
    if (finalY > 250) { doc.addPage(); finalY = 20; }
    doc.setFillColor(236, 253, 245);
    doc.rect(14, finalY - 2, 182, 8, 'F');
    doc.setTextColor(5, 150, 105);
    doc.setFontSize(13);
    doc.setFont(undefined, 'bold');
    doc.text('Stage 3: Delivery Routes', 16, finalY + 4);
    doc.setFont(undefined, 'normal');
    finalY += 10;

    stage3Cards.forEach((card, index) => {
      if (finalY > 235) { doc.addPage(); finalY = 20; }

      // Card header - green bar, same as Order Report
      doc.setFillColor(236, 253, 245);
      doc.rect(14, finalY, 182, 16, 'F');
      doc.setTextColor(5, 150, 105);
      doc.setFontSize(10);
      doc.text(`${card.dayName} | ${fullDate}`, 18, finalY + 7);
      doc.setFontSize(14);
      doc.setFont(undefined, 'bold');
      doc.text(card.airportCode, 105, finalY + 10, { align: 'center' });
      doc.setFont(undefined, 'normal');
      doc.setFontSize(9);
      doc.text(cleanText(card.airportName), 190, finalY + 6, { align: 'right' });
      doc.setFontSize(8);
      doc.text(cleanText(card.driverNameWithNum), 190, finalY + 12, { align: 'right' });

      // Product table - same as Order Report (without Rate/Amount)
      let _ct = 1;
      const pBody = card.products.map(p => {
        const n = parseInt(p.box) || 1; const s = _ct; const e = _ct + n - 1; _ct += n;
        return [s === e ? `${s}` : `${s}-${e}`, p.box, cleanText(p.product), (p.netWeight ?? p.grossWeight).toFixed(0)];
      });

      doc.autoTable({
        startY: finalY + 16,
        head: [['S.N', 'Box', 'Product', 'Kgs']],
        body: pBody.length ? pBody : [['-', '-', '-', '-']],
        theme: 'striped',
        headStyles: { fillColor: [16, 185, 129], textColor: 255, fontStyle: 'bold', fontSize: 9 },
        styles: { fontSize: 8, cellPadding: 2 },
        columnStyles: { 0: { cellWidth: 10 }, 1: { cellWidth: 10 }, 3: { cellWidth: 20 } },
        alternateRowStyles: { fillColor: [240, 253, 244] },
        margin: { left: 14, right: 14 }
      });

      // Expenses table - Count only (no Total column); TAPE & PAPER shows count
      const pkgBody = [];
      pkgBody.push([{ content: 'Expenses', styles: { fontStyle: 'bold', fillColor: [229, 231, 235] } }, { content: 'Count', styles: { halign: 'center', fillColor: [229, 231, 235] } }]);
      card.packagingRows.forEach(r => {
        const displayCount = r.count ?? '';
        pkgBody.push([r.label, displayCount]);
      });
      pkgBody.push([{ content: 'Shipment Summary', styles: { fontStyle: 'bold', fillColor: [229, 231, 235] } }, { content: '', styles: { fillColor: [229, 231, 235] } }]);
      pkgBody.push([`Total Net Weight`, `${card.netWeight.toFixed(0)} kg`]);
      pkgBody.push([`Gross Weight`, `${card.grossWeight.toFixed(0)} kg`]);
      if (card.boxes10kg > 0) pkgBody.push([`10 KG Boxes`, `${card.boxes10kg}`]);
      if (card.boxes5kg > 0) pkgBody.push([`05 KG Boxes`, `${card.boxes5kg}`]);
      if (card.boxesThermo > 0) pkgBody.push([`Thermo Boxes`, `${card.boxesThermo}`]);
      if (card.bags > 0) pkgBody.push([`Bags`, `${card.bags}`]);
      pkgBody.push([`Products Used`, `${card.totalProducts}`]);
      pkgBody.push([{ content: `GRAND TOTAL PER KG (NET ${card.netWeight.toFixed(0)}kg):`, colSpan: 1, styles: { halign: 'right', fontStyle: 'bold', fillColor: [167, 243, 208] } }, { content: card.totalExpPerKg, styles: { fontStyle: 'bold', fillColor: [167, 243, 208] } }]);

      doc.autoTable({
        startY: doc.lastAutoTable.finalY,
        head: [],
        body: pkgBody,
        theme: 'grid',
        styles: { fontSize: 8, cellPadding: 2 },
        columnStyles: { 0: { cellWidth: 120 }, 1: { cellWidth: 72, halign: 'center' } },
        margin: { left: 14, right: 14 }
      });
      finalY = doc.lastAutoTable.finalY + 12;
    });

    doc.save(`Airport_Report_${order.order_auto_id || order.oid}.pdf`);
  };

  const handleExportExcel = () => {
    if (!stage3Cards.length || !order) return;
    const wb = XLSX.utils.book_new();
    const thinBorder = { top: { style: 'thin' }, bottom: { style: 'thin' }, left: { style: 'thin' }, right: { style: 'thin' } };
    const cell = (v, style = 'normal', border = false) => {
      const styles = {
        title: { font: { bold: true, sz: 16 }, alignment: { horizontal: 'left' } },
        subtitle: { font: { sz: 11 }, alignment: { horizontal: 'left' } },
        greenHeader: { font: { bold: true, sz: 14, color: { rgb: 'FFFFFF' } }, fill: { fgColor: { rgb: '0D8568' } }, alignment: { horizontal: 'left' } },
        cardHeader: { font: { bold: true, sz: 10 }, fill: { fgColor: { rgb: 'F9FAFB' } } },
        cardCode: { font: { bold: true, sz: 14 } },
        tableHeader: { font: { bold: true }, fill: { fgColor: { rgb: 'F3F4F6' } } },
        bold: { font: { bold: true }, fill: { fgColor: { rgb: 'F3F4F6' } } },
        grandTotal: { font: { bold: true, sz: 12 } },
        normal: {}
      };
      const s = { ...(styles[style] || styles.normal), ...(border ? { border: thinBorder } : {}) };
      const val = v ?? '';
      return { v: val, t: typeof val === 'number' ? 'n' : 's', s };
    };

    const COLS_PER_CARD = 4;
    const GAP_COLS = 1;
    const CARD_START = (idx) => idx * (COLS_PER_CARD + GAP_COLS);

    const allRows = [];
    const merges = [];
    let rowIdx = 0;

    const totalCols = stage3Cards.length * (COLS_PER_CARD + GAP_COLS) - 1;

    // Page header - same as image
    const titleRow = [cell('Airport Report', 'title')];
    for (let c = 1; c <= totalCols; c++) titleRow.push('');
    allRows.push(titleRow);
    merges.push({ s: { r: rowIdx, c: 0 }, e: { r: rowIdx, c: totalCols } });
    rowIdx++;

    const subRow = [cell(`Order: ${order.order_auto_id || order.oid} • Stage 3: Delivery Routes`, 'subtitle')];
    for (let c = 1; c <= totalCols; c++) subRow.push('');
    allRows.push(subRow);
    merges.push({ s: { r: rowIdx, c: 0 }, e: { r: rowIdx, c: totalCols } });
    rowIdx++;

    const greenRow = [cell('Stage 3: Delivery Routes', 'greenHeader')];
    for (let c = 1; c <= totalCols; c++) greenRow.push('');
    allRows.push(greenRow);
    merges.push({ s: { r: rowIdx, c: 0 }, e: { r: rowIdx, c: totalCols } });
    rowIdx++;

    allRows.push([]); rowIdx++;

    const maxProducts = Math.max(...stage3Cards.map(c => c.products.length), 1);
    const maxPackaging = Math.max(...stage3Cards.map(c => c.packagingRows.length), 1);

    // Card headers row - gray bg like web UI
    const headerRow = [];
    stage3Cards.forEach((card, idx) => {
      const start = CARD_START(idx);
      headerRow[start] = cell(`${card.dayName} | ${card.shortDate}`, 'cardHeader', true);
      headerRow[start + 1] = cell(card.airportCode, 'cardCode', true);
      headerRow[start + 2] = cell(card.airportName, 'cardHeader', true);
      headerRow[start + 3] = cell(card.driverNameWithNum, 'cardHeader', true);
      for (let k = 4; k < COLS_PER_CARD; k++) headerRow[start + k] = cell('', 'normal', true);
    });
    allRows.push(headerRow);
    rowIdx++;

    // Product table headers (without Rate/Amount)
    const prodHeaderRow = [];
    stage3Cards.forEach((_, idx) => {
      const start = CARD_START(idx);
      prodHeaderRow[start] = cell('S.N', 'tableHeader', true);
      prodHeaderRow[start + 1] = cell('Box', 'tableHeader', true);
      prodHeaderRow[start + 2] = cell('Product', 'tableHeader', true);
      prodHeaderRow[start + 3] = cell('Kgs', 'tableHeader', true);
    });
    allRows.push(prodHeaderRow);
    rowIdx++;

    // Precompute carton ranges per card
    const _cardRanges = stage3Cards.map(card => {
      let ct = 1;
      return card.products.map(p => {
        const n = parseInt(p.box) || 1; const s = ct; const e = ct + n - 1; ct += n;
        return s === e ? `${s}` : `${s}-${e}`;
      });
    });

    // Product rows (without Rate/Amount)
    for (let r = 0; r < maxProducts; r++) {
      const prodRow = [];
      stage3Cards.forEach((card, idx) => {
        const start = CARD_START(idx);
        const p = card.products[r];
        for (let k = 0; k < COLS_PER_CARD; k++) {
          const val = p ? [_cardRanges[idx][r], p.box, p.product, (p.netWeight ?? p.grossWeight)][k] : '';
          prodRow[start + k] = cell(val, 'normal', true);
        }
      });
      allRows.push(prodRow);
      rowIdx++;
    }

    allRows.push([]); rowIdx++;

    // Packaging Costs header (Count only, no Total)
    const packHeaderRow = [];
    stage3Cards.forEach((_, idx) => {
      const start = CARD_START(idx);
      packHeaderRow[start] = cell('Packaging Costs:', 'tableHeader', true);
      packHeaderRow[start + 1] = cell('Count', 'tableHeader', true);
      packHeaderRow[start + 2] = cell('', 'normal', true);
      packHeaderRow[start + 3] = cell('', 'normal', true);
    });
    allRows.push(packHeaderRow);
    rowIdx++;

    // Packaging rows (Count only, no Total)
    for (let r = 0; r < maxPackaging; r++) {
      const packRow = [];
      stage3Cards.forEach((card, idx) => {
        const start = CARD_START(idx);
        const row = card.packagingRows[r];
        packRow[start] = cell(row?.label ?? '', 'normal', true);
        packRow[start + 1] = cell(row?.count ?? '', 'normal', true);
        packRow[start + 2] = cell('', 'normal', true);
        packRow[start + 3] = cell('', 'normal', true);
      });
      allRows.push(packRow);
      rowIdx++;
    }

    // Shipment Summary rows
    const summaryHeaderRow = [];
    stage3Cards.forEach((_, idx) => {
      const start = CARD_START(idx);
      summaryHeaderRow[start] = cell('Shipment Summary', 'tableHeader', true);
      summaryHeaderRow[start + 1] = cell('', 'tableHeader', true);
      summaryHeaderRow[start + 2] = cell('', 'normal', true);
      summaryHeaderRow[start + 3] = cell('', 'normal', true);
    });
    allRows.push(summaryHeaderRow); rowIdx++;

    const summaryFields = [
      (card) => ['Total Net Weight', `${card.netWeight.toFixed(0)} kg`],
      (card) => ['Gross Weight', `${card.grossWeight.toFixed(0)} kg`],
    ];
    if (stage3Cards.some(c => c.boxes10kg > 0)) summaryFields.push((card) => ['10 KG Boxes', card.boxes10kg > 0 ? `${card.boxes10kg}` : '-']);
    if (stage3Cards.some(c => c.boxes5kg > 0)) summaryFields.push((card) => ['05 KG Boxes', card.boxes5kg > 0 ? `${card.boxes5kg}` : '-']);
    if (stage3Cards.some(c => c.boxesThermo > 0)) summaryFields.push((card) => ['Thermo Boxes', card.boxesThermo > 0 ? `${card.boxesThermo}` : '-']);
    if (stage3Cards.some(c => c.bags > 0)) summaryFields.push((card) => ['Bags', card.bags > 0 ? `${card.bags}` : '-']);
    summaryFields.push((card) => ['Products Used', `${card.totalProducts}`]);

    summaryFields.forEach(fn => {
      const sRow = [];
      stage3Cards.forEach((card, idx) => {
        const start = CARD_START(idx);
        const [label, val] = fn(card);
        sRow[start] = cell(label, 'normal', true);
        sRow[start + 1] = cell(val, 'normal', true);
        sRow[start + 2] = cell('', 'normal', true);
        sRow[start + 3] = cell('', 'normal', true);
      });
      allRows.push(sRow); rowIdx++;
    });

    // Grand Total row only (TOTAL EXPENSES and VEG TOTAL removed)
    const r3 = [];
    stage3Cards.forEach((card, idx) => {
      const start = CARD_START(idx);
      r3[start] = cell(`GRAND TOTAL PER KG (NET ${card.netWeight.toFixed(0)}kg):`, 'grandTotal', true);
      r3[start + 1] = cell('', 'grandTotal', true);
      r3[start + 2] = cell('', 'grandTotal', true);
      r3[start + 3] = cell(card.totalExpPerKg, 'grandTotal', true);
    });
    allRows.push(r3); rowIdx++;

    const ws = XLSX.utils.aoa_to_sheet(allRows);
    ws['!cols'] = Array(totalCols + 1).fill(null).map((_, i) => ({ wch: i % (COLS_PER_CARD + GAP_COLS) === COLS_PER_CARD ? 2 : 14 }));
    ws['!merges'] = merges;
    XLSX.utils.book_append_sheet(wb, ws, 'Airport Report');
    XLSX.writeFile(wb, `Airport_Report_${order.order_auto_id || order.oid}.xlsx`);
  };

  if (loading) {
    return (
      <div className="p-4 sm:p-6 lg:p-8 flex justify-center items-center min-h-[400px]">
        <div className="text-lg text-gray-600">Loading airport report...</div>
      </div>
    );
  }

  if (!order || !assignment) {
    return (
      <div className="p-4 sm:p-6 lg:p-8">
        <button onClick={() => navigate('/reports/airport')} className="flex items-center gap-2 text-[#0D5C4D] hover:text-[#0a6354] mb-6">
          <ArrowLeft size={20} /> Back to Airport Report
        </button>
        <p className="text-gray-600">Order not found or no assignment data.</p>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <button
          onClick={() => navigate('/reports/airport')}
          className="flex items-center gap-2 text-[#0D5C4D] hover:text-[#0a6354]"
        >
          <ArrowLeft size={20} />
          <span className="font-medium">Back to Airport Report</span>
        </button>
        <div className="flex items-center gap-3">
          <button
            onClick={handleExportPDF}
            disabled={!stage3Cards.length}
            className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <FileDown size={18} />
            Export PDF
          </button>
          <button
            onClick={handleExportExcel}
            disabled={!stage3Cards.length}
            className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Download size={18} />
            Export Excel
          </button>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-lg overflow-hidden">
        <div className="mb-4 px-6 pt-6">
          <h1 className="text-2xl font-bold text-[#0D5C4D]">Airport Report</h1>
          <p className="text-[#6B8782]">Order: {order.order_auto_id || order.oid} • Stage 3: Delivery Routes</p>
        </div>
        <div className="bg-[#0D8568] text-white px-6 py-4">
          <h2 className="text-xl font-bold">Stage 3: Delivery Routes</h2>
        </div>
        <div className="p-4 bg-gray-50">
          {stage3Cards.length > 0 ? (
            <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
              {stage3Cards.map((card, index) => (
                <div key={index} className="bg-white border text-xs font-mono shadow-sm rounded-lg overflow-hidden">
                  <div className="border-b border-gray-300 bg-gray-50">
                    <div className="px-2 py-1.5 flex justify-between items-center">
                      <span className="font-bold">{card.dayName} | {card.shortDate}</span>
                      <span className="text-lg font-bold">{card.airportCode}</span>
                    </div>
                    <div className="px-2 pb-2 pt-0">
                      <div>{card.airportName}</div>
                      <div className="text-[10px]">{card.driverNameWithNum}</div>
                    </div>
                  </div>
                  {card.products.length > 0 && (
                    <>
                      <table className="w-full border-collapse border border-gray-300 text-[10px]">
                        <thead>
                          <tr className="bg-gray-100 border-b border-gray-300">
                            <th className="border-r border-gray-300 p-1 w-8">S.N</th>
                            <th className="border-r border-gray-300 p-1 w-8">Box</th>
                            <th className="border-r border-gray-300 p-1 text-left pl-2">Product</th>
                            <th className="border-r border-gray-300 p-1 w-12">Kgs</th>
                          </tr>
                        </thead>
                        <tbody>
                          {(() => { let _c = 1; return card.products.map((p, i) => {
                            const n = parseInt(p.box) || 1; const s = _c; const e = _c + n - 1; _c += n;
                            const sn = s === e ? `${s}` : `${s}-${e}`;
                            return (
                            <tr key={i} className="border-b border-gray-200">
                              <td className="border-r border-gray-200 p-1 text-center">{sn}</td>
                              <td className="border-r border-gray-200 p-1 text-center">{p.box}</td>
                              <td className="border-r border-gray-200 p-1 pl-2 font-medium">{p.product}</td>
                              <td className="border-r border-gray-200 p-1 text-center">{(p.netWeight ?? p.grossWeight).toFixed(0)}</td>
                            </tr>
                            ); }); })()}
                        </tbody>
                      </table>
                      <div className="border-t border-gray-300 p-2">
                        <table className="w-full text-[10px]">
                          <tbody>
                            <tr className="border-b border-gray-200">
                              <td className="p-1 font-bold w-[70%]">Packaging Costs:</td>
                              <td className="p-1 text-center w-[30%]">Count</td>
                            </tr>
                            {card.packagingRows.map((row, ri) => (
                              <tr key={ri} className="border-b border-gray-200">
                                <td className="p-1 pl-4">{row.label}</td>
                                <td className="p-1 text-center">{row.count ?? ''}</td>
                              </tr>
                            ))}
                            <tr className="border-t border-gray-400 bg-gray-50">
                              <td className="p-1 font-bold" colSpan="2">Shipment Summary</td>
                            </tr>
                            <tr className="border-b border-gray-200">
                              <td className="p-1 pl-4">Total Net Weight</td>
                              <td className="p-1 text-center">{card.netWeight.toFixed(0)} kg</td>
                            </tr>
                            <tr className="border-b border-gray-200">
                              <td className="p-1 pl-4">Gross Weight</td>
                              <td className="p-1 text-center">{card.grossWeight.toFixed(0)} kg</td>
                            </tr>
                            {card.boxes10kg > 0 && (
                              <tr className="border-b border-gray-200">
                                <td className="p-1 pl-4">10 KG Boxes</td>
                                <td className="p-1 text-center">{card.boxes10kg}</td>
                              </tr>
                            )}
                            {card.boxes5kg > 0 && (
                              <tr className="border-b border-gray-200">
                                <td className="p-1 pl-4">05 KG Boxes</td>
                                <td className="p-1 text-center">{card.boxes5kg}</td>
                              </tr>
                            )}
                            {card.boxesThermo > 0 && (
                              <tr className="border-b border-gray-200">
                                <td className="p-1 pl-4">Thermo Boxes</td>
                                <td className="p-1 text-center">{card.boxesThermo}</td>
                              </tr>
                            )}
                            {card.bags > 0 && (
                              <tr className="border-b border-gray-200">
                                <td className="p-1 pl-4">Bags</td>
                                <td className="p-1 text-center">{card.bags}</td>
                              </tr>
                            )}
                            <tr className="border-b border-gray-200">
                              <td className="p-1 pl-4">Products Used</td>
                              <td className="p-1 text-center">{card.totalProducts}</td>
                            </tr>
                          </tbody>
                        </table>
                      </div>
                    </>
                  )}
                  <div className="border-t border-gray-300 p-2">
                    <table className="w-full text-[10px]">
                      <tbody>
                        <tr className="font-black border-t-2 border-gray-400">
                          <td className="p-1 text-right">GRAND TOTAL PER KG (NET {card.netWeight.toFixed(0)}kg):</td>
                          <td className="p-1 text-right pr-2 text-lg">{card.totalExpPerKg}</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-[#6B8782]">No Stage 3 data available for this order.</p>
          )}
        </div>
      </div>
    </div>
  );
};

export default ReportAirportView;
