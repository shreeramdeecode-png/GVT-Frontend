import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, FileText, FileSpreadsheet } from 'lucide-react';
import { getAllOrders } from '../../../api/orderApi';
import { getFlowerOrderAssignment } from '../../../api/flowerOrderAssignmentApi';
import { getAllDrivers } from '../../../api/driverApi';
import { getAllInventory } from '../../../api/inventoryApi';
import { getAllLabourRates } from '../../../api/labourRateApi';
import { getAllDriverRates } from '../../../api/driverRateApi';
import { getAllFuelExpenses } from '../../../api/fuelExpenseApi';
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import * as XLSX from 'xlsx-js-style';

const ReportFlowerOrderView = () => {
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

    const processedReportData = React.useMemo(() => {
        if (!assignment || !assignment.stage3_data) return null;

        let stage3Data = typeof assignment.stage3_data === 'string' ? JSON.parse(assignment.stage3_data) : assignment.stage3_data;
        let deliveryData = stage3Data.products || [];
        const airportGroups = stage3Data.summaryData?.airportGroups || {};
        const airportTapeData = stage3Data.airportTapeData || {};

        // Prefer tape quantities from backend stage3_summary_data (airportGroups),
        // fallback to airportTapeData saved in stage3_data if needed.
        let summaryAirportGroups = airportGroups;
        if (assignment.stage3_summary_data) {
            try {
                const s3Summary = typeof assignment.stage3_summary_data === 'string'
                    ? JSON.parse(assignment.stage3_summary_data)
                    : assignment.stage3_summary_data;
                if (s3Summary && s3Summary.airportGroups) {
                    summaryAirportGroups = s3Summary.airportGroups;
                }
            } catch (e) {
                console.error('Error parsing stage3_summary_data in processedReportData', e);
            }
        }

        let stage4ProductRows = [];
        if (assignment.stage4_data) {
            let stage4Data = typeof assignment.stage4_data === 'string' ? JSON.parse(assignment.stage4_data) : assignment.stage4_data;
            stage4ProductRows = stage4Data.reviewData?.productRows || stage4Data.productRows || [];
        }

        // Prepare Stage 2 Labour Map from stage2_data (PRIMARY SOURCE)
        let stage2LabourMap = {};

        // Parse stage2_data first
        if (assignment.stage2_data) {
            try {
                let s2Data = typeof assignment.stage2_data === 'string' ? JSON.parse(assignment.stage2_data) : assignment.stage2_data;
                let s2Assignments = s2Data.productAssignments || s2Data.stage2Assignments || s2Data.assignments || [];
                s2Assignments.forEach(s2Item => {
                    const pName = s2Item.product || s2Item.productName;
                    const pLabour = s2Item.labourName || s2Item.labourNames || s2Item.labour;
                    if (pName && pLabour) {
                        stage2LabourMap[pName] = pLabour;
                    }
                });
                console.log('Stage 2 Labour Map from stage2_data:', stage2LabourMap);
            } catch (e) {
                console.error("Error parsing stage2_data in processedReportData", e);
            }
        }

        // Fallback to stage2_summary_data if stage2_data didn't provide data
        if (assignment.stage2_summary_data && Object.keys(stage2LabourMap).length === 0) {
            try {
                let s2SummaryData = typeof assignment.stage2_summary_data === 'string'
                    ? JSON.parse(assignment.stage2_summary_data)
                    : assignment.stage2_summary_data;

                const labourAssignments = s2SummaryData.labourAssignments || [];

                labourAssignments.forEach(labourGroup => {
                    const labourName = labourGroup.labour;
                    const assignments = labourGroup.assignments || [];

                    assignments.forEach(assignment => {
                        const productId = assignment.oiid;
                        const productName = assignment.product;

                        if (productId && labourName) {
                            if (!stage2LabourMap[productId]) {
                                stage2LabourMap[productId] = [];
                            }
                            if (!stage2LabourMap[productId].includes(labourName)) {
                                stage2LabourMap[productId].push(labourName);
                            }
                        }

                        // Also map by product name for fallback
                        if (productName && labourName) {
                            if (!stage2LabourMap[productName]) {
                                stage2LabourMap[productName] = [];
                            }
                            if (!stage2LabourMap[productName].includes(labourName)) {
                                stage2LabourMap[productName].push(labourName);
                            }
                        }
                    });
                });

                // Convert arrays to comma-separated strings
                Object.keys(stage2LabourMap).forEach(key => {
                    if (Array.isArray(stage2LabourMap[key])) {
                        stage2LabourMap[key] = stage2LabourMap[key].join(', ');
                    }
                });

                console.log('Stage 2 Labour Map from summary (fallback):', stage2LabourMap);
            } catch (e) {
                console.error("Error parsing stage2_summary_data in processedReportData", e);
            }
        }

        let productsByDriver = {};

        deliveryData.forEach((item) => {
            const product = item.product || item.productName || '-';
            let driverName = '';
            let driverInfo = null;

            if (item.selectedDriver) {
                driverInfo = drivers.find(d => d.did == item.selectedDriver || d.driver_id == item.selectedDriver);
                if (driverInfo) driverName = driverInfo.driver_name;
            }

            if (!driverName && (item.driver || item.driverName)) {
                driverName = item.driver || item.driverName;
            }

            if (!driverName) {
                for (const [airportCode, airportData] of Object.entries(airportGroups)) {
                    const productInGroup = airportData.products?.find(p => (p.product || p.productName) === product);
                    if (productInGroup) {
                        driverName = productInGroup.driver || '';
                        break;
                    }
                }
            }

            if (!driverName) driverName = 'Unassigned';

            if (!productsByDriver[driverName]) {
                productsByDriver[driverName] = {
                    products: [],
                    totalAmount: 0,
                    totalWeight: 0,
                    totalBoxes: 0,
                    airportName: '-',
                    driverInfo: driverInfo,
                    tapeQuantity: 0
                };
            }

            if (!productsByDriver[driverName].driverInfo && driverName !== 'Unassigned') {
                productsByDriver[driverName].driverInfo = drivers.find(d => d.driver_name === driverName) || { mobile_number: '', vehicle_number: '' };
            }

            const grossWeightStr = item.grossWeight || item.gross_weight || '0';
            const grossWeight = parseFloat(grossWeightStr.toString().replace(/[^0-9.]/g, '')) || 0;

            const stage4Product = stage4ProductRows.find(p4 => (p4.product_name || p4.product || p4.productName) === product);
            const pricePerKg = stage4Product ? parseFloat(stage4Product.price || stage4Product.final_price || 0) : 0;
            const netWeight = stage4Product ? parseFloat(stage4Product.net_weight || stage4Product.quantity || 0) : grossWeight;
            const productTotal = pricePerKg * netWeight;
            const noOfPkgs = parseInt(item.noOfPkgs || item.no_of_pkgs || 0);

            if (productsByDriver[driverName].airportName === '-') {
                productsByDriver[driverName].airportName = item.airportName || item.airport_name || '-';
            }

            productsByDriver[driverName].products.push({
                product: product,
                grossWeight: grossWeight,
                netWeight,
                rate: pricePerKg,
                amount: productTotal,
                box: noOfPkgs,
                ct: item.ct || item.CT,
                labour: item.labour || item.labourName || stage2LabourMap[product],
                packingType: item.packingType || item.packing_type || '',
                sNo: productsByDriver[driverName].products.length + 1
            });

            productsByDriver[driverName].totalAmount += productTotal;
            productsByDriver[driverName].totalWeight += grossWeight;
            productsByDriver[driverName].totalBoxes += noOfPkgs;
        });

        // Attach airportCode from Airport Delivery Summary (prefer stage3_summary_data.airportGroups so backend-saved codes show)
        const groupsForCode = Object.keys(summaryAirportGroups || {}).length ? summaryAirportGroups : airportGroups;
        Object.values(productsByDriver).forEach(driverData => {
            const airportName = driverData.airportName || '';
            for (const [code, ag] of Object.entries(groupsForCode)) {
                if (ag && (ag.airportName || '').toLowerCase() === airportName.toLowerCase()) {
                    driverData.airportCode = code;
                    break;
                }
            }
        });

        // Helper: get total tape quantity from airport group (supports single tape or tapes array)
        const getTapeQtyFromAirportGroup = (ag) => {
            if (Array.isArray(ag.tapes) && ag.tapes.length > 0) {
                return ag.tapes.reduce((sum, t) => sum + (parseFloat(t.tapeQuantity || t.tapeQty || 0) || 0), 0);
            }
            return parseFloat(ag.tapeQuantity || ag.tapeQty || 0) || 0;
        };
        // Helper: get total tape quantity from airportTapeData (value can be array of tapes or single object)
        const getTapeQtyFromTapeData = (tapeInfo) => {
            if (Array.isArray(tapeInfo)) {
                return tapeInfo.reduce((sum, t) => sum + (parseFloat(t.tapeQuantity || t.tapeQty || 0) || 0), 0);
            }
            if (tapeInfo && typeof tapeInfo === 'object') {
                return parseFloat(tapeInfo.tapeQuantity || tapeInfo.tapeQty || 0) || 0;
            }
            return 0;
        };

        // Attach tape quantity per driver based on airport groups (stage3_summary_data)
        Object.values(productsByDriver).forEach(driverData => {
            const airportName = driverData.airportName;
            let qty = 0;

            // 1) Try to read from stage3_summary_data.airportGroups (supports multiple tapes per airport)
            if (summaryAirportGroups && typeof summaryAirportGroups === 'object') {
                for (const ag of Object.values(summaryAirportGroups)) {
                    if (!ag) continue;
                    if ((ag.airportName || '').toLowerCase() === (airportName || '').toLowerCase()) {
                        qty = getTapeQtyFromAirportGroup(ag);
                        break;
                    }
                }
            }

            // 2) Fallback to stage3_data.airportTapeData by airport name (can be array of tapes)
            if (!qty && airportTapeData && typeof airportTapeData === 'object') {
                qty = getTapeQtyFromTapeData(airportTapeData[airportName]);
            }

            driverData.tapeQuantity = qty;
        });

        return productsByDriver;
    }, [assignment, drivers, assignment?.stage2_data, assignment?.stage2_summary_data, assignment?.stage3_data, assignment?.stage4_data, fuelExpenses, order]);

    const handleExportPDF = () => {
        if (!processedReportData || !order || !assignment) return;
        const doc = new jsPDF();

        const cleanText = (str) => {
            if (str === null || str === undefined) return '';
            let s = String(str);
            s = s.replace(/₹/g, 'Rs. ');
            return s.replace(/[^\x00-\x7F]/g, '').trim();
        };

        const orderDate = new Date(order.order_received_date);
        const dayName = orderDate.toLocaleDateString('en-US', { weekday: 'long' }).toUpperCase();
        const fullDate = orderDate.toLocaleDateString('en-GB');

        // Attractive Header with Background
        doc.setFillColor(13, 92, 77);
        doc.rect(0, 0, 210, 30, 'F');
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(24);
        doc.setFont(undefined, 'bold');
        doc.text('ORDER REPORT', 105, 12, { align: 'center' });
        doc.setFontSize(12);
        doc.setFont(undefined, 'normal');
        doc.text(cleanText(order.oid), 105, 22, { align: 'center' });

        // Order Info Card
        doc.setTextColor(0, 0, 0);
        doc.autoTable({
            startY: 35,
            head: [['Customer Name', 'Order Date', 'Total Amount']],
            body: [[cleanText(order.customer_name), fullDate, cleanText(`Rs. ${getGrandTotalAmount().toFixed(2)}`)]],
            theme: 'grid',
            headStyles: { fillColor: [16, 185, 129], textColor: 255, fontStyle: 'bold', halign: 'center', fontSize: 10 },
            bodyStyles: { halign: 'center', fontSize: 10, cellPadding: 3 },
        });

        let finalY = doc.lastAutoTable.finalY + 12;
        const stage1Source = assignment.product_assignments || assignment.stage1_data;
        if (stage1Source) {
            let s1Data = typeof stage1Source === 'string' ? JSON.parse(stage1Source) : stage1Source;
            let s1List = s1Data.productAssignments || s1Data.assignments || (Array.isArray(s1Data) ? s1Data : []);

            // Get Stage 1 summary data for driver/labour info
            let stage1SummaryData = null;
            if (assignment.stage1_summary_data || assignment.summary_data) {
                try {
                    const summarySource = assignment.stage1_summary_data || assignment.summary_data;
                    stage1SummaryData = typeof summarySource === 'string' ? JSON.parse(summarySource) : summarySource;
                } catch (e) {
                    console.error('Error parsing stage1_summary_data in PDF:', e);
                }
            }

            doc.setFillColor(236, 253, 245);
            doc.rect(14, finalY - 2, 182, 8, 'F');
            doc.setTextColor(5, 150, 105);
            doc.setFontSize(13);
            doc.setFont(undefined, 'bold');
            doc.text("Stage 1: Product Collection", 16, finalY + 4);
            doc.setFont(undefined, 'normal');

            const s1Body = s1List.map(item => {
                let labourName = '-';
                let driverName = '-';

                const productKey = item.product || item.productName;
                if (stage1SummaryData?.driverAssignments) {
                    stage1SummaryData.driverAssignments.forEach(driverGroup => {
                        const assignment = driverGroup.assignments.find(a =>
                            a.product === productKey &&
                            a.entityName === (item.assignedTo || item.entityName) &&
                            a.entityType === item.entityType
                        );
                        if (assignment) {
                            if (assignment.labour) {
                                labourName = Array.isArray(assignment.labour)
                                    ? assignment.labour.join(', ')
                                    : assignment.labour;
                            }
                            if (driverGroup.driver) {
                                // Remove driver ID
                                driverName = driverGroup.driver.split(' - ')[0];
                            }
                        }
                    });
                }

                return [
                    cleanText(item.product || item.productName || '-'),
                    cleanText(item.entityType || item.entity_type || '-'),
                    cleanText(item.assignedTo || item.entityName || '-'),
                    cleanText(item.assignedQty || item.assigned_qty || 0),
                    cleanText(item.assignedBoxes || item.assigned_boxes || 0),
                    cleanText(labourName),
                    cleanText(driverName),
                    cleanText(item.place || (item.entityType === 'farmer' ? 'Farmer place' : '-'))
                ];
            });

            doc.autoTable({
                startY: finalY + 7,
                head: [['Product', 'Entity Type', 'Entity Name', 'Qty', 'Boxes', 'Labour', 'Driver', 'Place']],
                body: s1Body,
                theme: 'striped',
                headStyles: { fillColor: [16, 185, 129], textColor: 255, fontStyle: 'bold', fontSize: 9 },
                styles: { fontSize: 8, cellPadding: 2 },
                alternateRowStyles: { fillColor: [240, 253, 244] }
            });
            finalY = doc.lastAutoTable.finalY + 12;
        }

        if (assignment.stage2_data) {
            let stage2Data = typeof assignment.stage2_data === 'string' ? JSON.parse(assignment.stage2_data) : assignment.stage2_data;
            let stage2List = stage2Data.productAssignments || stage2Data.stage2Assignments || stage2Data.assignments || [];

            doc.setFillColor(236, 253, 245);
            doc.rect(14, finalY - 2, 182, 8, 'F');
            doc.setTextColor(5, 150, 105);
            doc.setFontSize(13);
            doc.setFont(undefined, 'bold');
            doc.text("Stage 2: Packaging & Quality", 16, finalY + 4);
            doc.setFont(undefined, 'normal');

            const s2Body = stage2List.map(item => [
                cleanText(item.product || item.productName || '-'),
                parseFloat(item.wastage || 0).toFixed(2),
                parseFloat(item.reuse || 0).toFixed(2),
                cleanText(item.tapeColor || item.tape_color || '-'),
                cleanText(item.tapeQuantity || item.tape_quantity || '-'),
                cleanText(item.labourName || item.labourNames || item.labour || '-')
            ]);

            doc.autoTable({
                startY: finalY + 7,
                head: [['Product', 'Wastage (kg)', 'Reuse (kg)', 'Tape Type', 'Tape Qty', 'Labour']],
                body: s2Body,
                theme: 'striped',
                headStyles: { fillColor: [16, 185, 129], textColor: 255, fontStyle: 'bold', fontSize: 9 },
                styles: { fontSize: 8, cellPadding: 2 },
                alternateRowStyles: { fillColor: [240, 253, 244] }
            });
            finalY = doc.lastAutoTable.finalY + 12;
        }

        if (finalY > 250) { doc.addPage(); finalY = 20; }
        doc.setFillColor(236, 253, 245);
        doc.rect(14, finalY - 2, 182, 8, 'F');
        doc.setTextColor(5, 150, 105);
        doc.setFontSize(13);
        doc.setFont(undefined, 'bold');
        doc.text("Stage 3: Delivery Routes", 16, finalY + 4);
        doc.setFont(undefined, 'normal');
        finalY += 10;

        const getStockPrice = (query) => {
            const item = stockItems.find(i =>
                (i.product_name || i.item_name || i.name || '').toLowerCase().includes(query.toLowerCase())
            );
            if (!item) return 0;
            const raw =
                item.price !== undefined ? item.price :
                item.average_price !== undefined ? item.average_price :
                item.unit_price !== undefined ? item.unit_price :
                0;
            const num = parseFloat(raw);
            return isNaN(num) ? 0 : num;
        };

        Object.entries(processedReportData).forEach(([driverName, data], index) => {
            if (finalY > 235) { doc.addPage(); finalY = 20; }

            doc.setFillColor(236, 253, 245);
            doc.rect(14, finalY, 182, 16, 'F');
            doc.setTextColor(5, 150, 105);
            doc.setFontSize(10);
            doc.text(`${dayName} | ${fullDate}`, 18, finalY + 7);
            doc.setFontSize(14);
            doc.setFont(undefined, 'bold');
            doc.text(data.airportCode || `GVT ${String(index + 1).padStart(3, '0')}`, 105, finalY + 10, { align: 'center' });
            doc.setFont(undefined, 'normal');
            doc.setFontSize(9);
            doc.text(cleanText(data.airportName || 'Airport'), 190, finalY + 6, { align: 'right' });
            let drvTxt = cleanText(driverName);
            if (data.driverInfo?.vehicle_number) drvTxt += ` ${cleanText(data.driverInfo.vehicle_number)}`;
            doc.setFontSize(8);
            doc.text(drvTxt, 190, finalY + 12, { align: 'right' });

            let _ct = 1;
            const pBody = data.products.map(p => {
                const n = parseInt(p.box) || 0;
                const sn = n === 0 ? '-' : (n === 1 ? `${_ct}` : `${_ct}-${_ct + n - 1}`);
                if (n > 0) _ct += n;
                return [sn, p.box, cleanText(p.product), (p.netWeight ?? p.grossWeight).toFixed(0), p.rate, p.amount.toFixed(0)];
            });

            doc.autoTable({
                startY: finalY + 16,
                head: [['S.N', 'Box', 'Product', 'Kgs', 'Rate', 'Amount']],
                body: pBody,
                theme: 'striped',
                headStyles: { fillColor: [16, 185, 129], textColor: 255, fontStyle: 'bold', fontSize: 9 },
                styles: { fontSize: 8, cellPadding: 2 },
                columnStyles: { 0: { cellWidth: 10 }, 1: { cellWidth: 10 }, 3: { cellWidth: 15 }, 4: { cellWidth: 15 }, 5: { cellWidth: 20, halign: 'right' } },
                alternateRowStyles: { fillColor: [240, 253, 244] },
                margin: { left: 14, right: 14 }
            });

            let count10kg = 0, count5kg = 0, countThermo = 0, countNetBag = 0;
            data.products.forEach(p => {
                const lt = (p.packingType || '').toLowerCase(); const lp = (p.product || '').toLowerCase(); const b = p.box || 0;
                if (lt.includes('5kg') || lp.includes('5kg')) count5kg += b; else if (lt.includes('thermo') || lp.includes('thermo')) countThermo += b; else if (lt.includes('bag') || lp.includes('bag')) countNetBag += b; else count10kg += b;
            });
            const price10kg = getStockPrice('10 kg box') || 80; const price5kg = getStockPrice('5 kg box') || 45; const priceThermo = getStockPrice('thermo') || 145; const priceNetBag = getStockPrice('net bag') || 0;
            const cost10kg = count10kg * price10kg; const cost5kg = count5kg * price5kg; const costThermo = countThermo * priceThermo; const costNetBag = countNetBag * priceNetBag;
            const totalBoxCost = cost10kg + cost5kg + costThermo + costNetBag;

            const uniqueLabours = [...new Set(data.products.map(p => p.labour).filter(l => l).flatMap(l => l.split(',').map(n => n.trim())))];
            const labourCount = uniqueLabours.length;
            const normalRateObj = labourRates.find(r => r.labourType?.toLowerCase() === 'normal' && r.status === 'Active');
            const labourRate = normalRateObj ? parseFloat(normalRateObj.amount) : 0;
            const labourCost = labourCount * labourRate;
            const labourNamesStr = uniqueLabours.length > 0 ? `(${cleanText(uniqueLabours.join(', '))})` : '';

            const pickupCost = getStockPrice('pickup') || 0;
            const tapeUnitPrice = getStockPrice('tape') || 0;
            const tapeQuantity = parseFloat(data.tapeQuantity || 0) || 0;
            const paperPrice = 0;
            const tapeCost = tapeUnitPrice * tapeQuantity + paperPrice;
            const driverRateObj = driverRates.find(r => r.deliveryType?.toLowerCase().includes('airport') && r.status === 'Active') || driverRates.find(r => r.status === 'Active');
            const driverWage = driverRateObj ? parseFloat(driverRateObj.amount) : 0;
            const totalOverhead = labourCost + pickupCost + tapeCost + driverWage; const totalExpenses = totalBoxCost + totalOverhead;
            const vegTotal = data.totalAmount; const grandTotal = vegTotal + totalExpenses; const grandTotalPerKg = Math.round(grandTotal / (data.totalWeight > 0 ? data.totalWeight : 1));

            const pkgBody = [];
            pkgBody.push([{ content: 'Expenses', styles: { fontStyle: 'bold', fillColor: [229, 231, 235] } }, { content: 'Count', styles: { halign: 'center', fillColor: [229, 231, 235] } }, { content: 'Rate', styles: { halign: 'center', fillColor: [229, 231, 235] } }, { content: 'Total', styles: { halign: 'right', fillColor: [229, 231, 235] } }]);
            if (count10kg > 0) pkgBody.push(['10 KG BOX', count10kg, price10kg, cost10kg]);
            if (count5kg > 0) pkgBody.push(['05 KG BOX', count5kg, price5kg, cost5kg]);
            if (countThermo > 0) pkgBody.push(['THERMO BOX', countThermo, priceThermo, costThermo]);
            if (countNetBag > 0) pkgBody.push(['NET BAG', countNetBag, priceNetBag, costNetBag]);
            pkgBody.push([`LABOUR ${cleanText(labourNamesStr)}`, labourCount, labourRate, labourCost]);
            pkgBody.push([{ content: 'PICKUP', colSpan: 3 }, pickupCost]);
            if (tapeCost > 0) pkgBody.push([{ content: 'TAPE & PAPER', colSpan: 3 }, tapeCost]);
            pkgBody.push([{ content: 'DRIVER WAGE', colSpan: 3 }, driverWage]);
            const pdfTareWeight = (count10kg * 1.5) + (count5kg * 1.0) + (countThermo * 0.5);
            const pdfNetWeight = data.totalWeight - pdfTareWeight;
            pkgBody.push([{ content: 'Shipment Summary', styles: { fontStyle: 'bold', fillColor: [229, 231, 235] } }, { content: '', styles: { fillColor: [229, 231, 235] } }, { content: '', styles: { fillColor: [229, 231, 235] } }, { content: '', styles: { fillColor: [229, 231, 235] } }]);
            pkgBody.push(['Total Net Weight', { content: `${pdfNetWeight.toFixed(0)} kg`, colSpan: 3, styles: { halign: 'right' } }]);
            pkgBody.push(['Gross Weight', { content: `${data.totalWeight.toFixed(0)} kg`, colSpan: 3, styles: { halign: 'right' } }]);
            if (count10kg > 0) pkgBody.push(['10 KG Boxes', { content: `${count10kg}`, colSpan: 3, styles: { halign: 'right' } }]);
            if (count5kg > 0) pkgBody.push(['05 KG Boxes', { content: `${count5kg}`, colSpan: 3, styles: { halign: 'right' } }]);
            if (countThermo > 0) pkgBody.push(['Thermo Boxes', { content: `${countThermo}`, colSpan: 3, styles: { halign: 'right' } }]);
            if (countNetBag > 0) pkgBody.push(['Bags', { content: `${countNetBag}`, colSpan: 3, styles: { halign: 'right' } }]);
            pkgBody.push(['Products Used', { content: `${data.products.length}`, colSpan: 3, styles: { halign: 'right' } }]);
            pkgBody.push([{ content: 'TOTAL EXPENSES:', colSpan: 3, styles: { halign: 'right', fontStyle: 'bold', fillColor: [209, 250, 229] } }, { content: totalExpenses.toFixed(0), styles: { fontStyle: 'bold', fillColor: [209, 250, 229] } }]);
            pkgBody.push([{ content: 'VEG TOTAL:', colSpan: 3, styles: { halign: 'right', fontStyle: 'bold', fillColor: [209, 250, 229] } }, { content: vegTotal.toFixed(0), styles: { fontStyle: 'bold', fillColor: [209, 250, 229] } }]);
            pkgBody.push([{ content: `GRAND TOTAL (${data.totalWeight.toFixed(0)}kg):`, colSpan: 3, styles: { halign: 'right', fontStyle: 'bold', fillColor: [167, 243, 208] } }, { content: grandTotalPerKg.toFixed(0), styles: { fontStyle: 'bold', fillColor: [167, 243, 208] } }]);

            doc.autoTable({
                startY: doc.lastAutoTable.finalY,
                head: [],
                body: pkgBody,
                theme: 'grid',
                styles: { fontSize: 8, cellPadding: 2 },
                columnStyles: { 0: { cellWidth: 73 }, 1: { cellWidth: 18, halign: 'center' }, 2: { cellWidth: 18, halign: 'center' }, 3: { cellWidth: 73, halign: 'right' } },
                margin: { left: 14, right: 14 }
            });
            finalY = doc.lastAutoTable.finalY + 12;
        });

        if (assignment.stage4_data) {
            if (finalY > 250) { doc.addPage(); finalY = 20; }
            let s4Data = typeof assignment.stage4_data === 'string' ? JSON.parse(assignment.stage4_data) : assignment.stage4_data;
            let productRows = s4Data.reviewData?.productRows || s4Data.productRows || [];
            let s4Total = 0;

            doc.setFillColor(236, 253, 245);
            doc.rect(14, finalY - 2, 182, 8, 'F');
            doc.setTextColor(5, 150, 105);
            doc.setFontSize(13);
            doc.setFont(undefined, 'bold');
            doc.text("Stage 4: Final Pricing", 16, finalY + 4);
            doc.setFont(undefined, 'normal');

            const s4Body = productRows.map(item => {
                const net = parseFloat(item.net_weight || item.quantity || 0);
                const price = parseFloat(item.price || item.final_price || 0);
                const total = net * price;
                s4Total += total;
                return [cleanText(item.product_name || item.product), net.toFixed(2), `Rs. ${price.toFixed(2)}`, `Rs. ${total.toFixed(2)}`];
            });
            s4Body.push([{ content: 'Grand Total:', colSpan: 3, styles: { halign: 'right', fontStyle: 'bold', fillColor: [167, 243, 208] } }, { content: `Rs. ${s4Total.toFixed(2)}`, styles: { fontStyle: 'bold', fillColor: [167, 243, 208] } }]);

            doc.autoTable({
                startY: finalY + 7,
                head: [['Product', 'Net Weight (kg)', 'Price/kg', 'Total']],
                body: s4Body,
                theme: 'striped',
                headStyles: { fillColor: [16, 185, 129], textColor: 255, fontStyle: 'bold', fontSize: 9 },
                styles: { fontSize: 8, cellPadding: 2 },
                alternateRowStyles: { fillColor: [240, 253, 244] }
            });
        }

        doc.save(`Order_Report_${orderId}.pdf`);
    };

    const handleExportExcel = () => {
        if (!processedReportData || !order || !assignment) return;

        const wb = XLSX.utils.book_new();
        const allRows = [];
        const merges = [];
        let currentRow = 0;

        // Helper for cleaner Text
        const cleanText = (str) => {
            if (str === null || str === undefined) return '';
            let s = String(str);
            s = s.replace(/₹/g, 'Rs. ');
            return s.replace(/[^\x00-\x7F]/g, '').trim();
        };

        // Helper for Styled Cells (Using xlsx-js-style)
        const cell = (v, style = 'normal') => {
            const styles = {
                title: { font: { bold: true, sz: 16, color: { rgb: "FFFFFF" } }, fill: { fgColor: { rgb: "0D5C4D" } }, alignment: { horizontal: "center", vertical: "center" } },
                header: { font: { bold: true, color: { rgb: "FFFFFF" } }, fill: { fgColor: { rgb: "10B981" } }, alignment: { horizontal: "center", vertical: "center" } },
                sectionGreen: { font: { bold: true, sz: 12, color: { rgb: "059669" } }, fill: { fgColor: { rgb: "ECFDF5" } }, alignment: { vertical: "center" } },
                sectionOrange: { font: { bold: true, sz: 12, color: { rgb: "B45309" } }, fill: { fgColor: { rgb: "FEF3C7" } }, alignment: { vertical: "center" } },
                sectionBlue: { font: { bold: true, sz: 12, color: { rgb: "1D4ED8" } }, fill: { fgColor: { rgb: "DBEAFE" } }, alignment: { vertical: "center" } },
                sectionPurple: { font: { bold: true, sz: 12, color: { rgb: "6D28D9" } }, fill: { fgColor: { rgb: "E9D5FF" } }, alignment: { vertical: "center" } },
                subHeader: { font: { bold: true }, fill: { fgColor: { rgb: "F3F4F6" } }, alignment: { horizontal: "center" } },
                bold: { font: { bold: true } },
                highlight: { fill: { fgColor: { rgb: "FEF9C3" } }, font: { bold: true } },
                normal: { alignment: { wrapText: true } }
            };
            return { v: cleanText(v), t: typeof v === 'number' ? 'n' : 's', s: styles[style] || styles.normal };
        };

        const orderDate = new Date(order.order_received_date);
        const dayName = orderDate.toLocaleDateString('en-US', { weekday: 'long' }).toUpperCase();
        const fullDate = orderDate.toLocaleDateString('en-GB');

        // Title
        allRows.push([cell('ORDER REPORT', 'title'), '', '', '', '', '']); merges.push({ s: { r: currentRow, c: 0 }, e: { r: currentRow, c: 5 } }); currentRow++;
        allRows.push([cell(order.oid, 'title'), '', '', '', '', '']); merges.push({ s: { r: currentRow, c: 0 }, e: { r: currentRow, c: 5 } }); currentRow++;
        allRows.push([]); currentRow++;

        // Order Info
        allRows.push([cell('Customer:', 'bold'), cell(order.customer_name), cell('Date:', 'bold'), cell(fullDate), cell('Total:', 'bold'), cell(getGrandTotalAmount().toFixed(2))]); currentRow++;
        allRows.push([]); currentRow++;

        // Stage 1
        allRows.push([cell('STAGE 1: PRODUCT COLLECTION', 'sectionGreen'), '', '', '', '', '', '', '']); merges.push({ s: { r: currentRow, c: 0 }, e: { r: currentRow, c: 7 } }); currentRow++;
        allRows.push([cell('Product', 'header'), cell('Entity Type', 'header'), cell('Entity Name', 'header'), cell('Qty', 'header'), cell('Boxes', 'header'), cell('Labour', 'header'), cell('Driver', 'header'), cell('Place', 'header')]); currentRow++;
        const s1Source = assignment.product_assignments || assignment.stage1_data;
        if (s1Source) {
            let s1Data = typeof s1Source === 'string' ? JSON.parse(s1Source) : s1Source;
            let s1List = s1Data.productAssignments || s1Data.assignments || (Array.isArray(s1Data) ? s1Data : []);

            // Get Stage 1 summary data for driver/labour info
            let stage1SummaryData = null;
            if (assignment.stage1_summary_data || assignment.summary_data) {
                try {
                    const summarySource = assignment.stage1_summary_data || assignment.summary_data;
                    stage1SummaryData = typeof summarySource === 'string' ? JSON.parse(summarySource) : summarySource;
                } catch (e) {
                    console.error('Error parsing stage1_summary_data in Excel:', e);
                }
            }

            s1List.forEach(item => {
                let labourName = '-';
                let driverName = '-';

                const productKey = item.product || item.productName;
                if (stage1SummaryData?.driverAssignments) {
                    stage1SummaryData.driverAssignments.forEach(driverGroup => {
                        const assignment = driverGroup.assignments.find(a =>
                            a.product === productKey &&
                            a.entityName === (item.assignedTo || item.entityName) &&
                            a.entityType === item.entityType
                        );
                        if (assignment) {
                            if (assignment.labour) {
                                labourName = Array.isArray(assignment.labour)
                                    ? assignment.labour.join(', ')
                                    : assignment.labour;
                            }
                            if (driverGroup.driver) {
                                // Remove driver ID
                                driverName = driverGroup.driver.split(' - ')[0];
                            }
                        }
                    });
                }

                allRows.push([cell(item.product || item.productName), cell(item.entityType), cell(item.assignedTo || item.entityName), cell(item.assignedQty), cell(item.assignedBoxes), cell(labourName), cell(driverName), cell(item.place || (item.entityType === 'farmer' ? 'Farmer place' : '-'))]);
                currentRow++;
            });
        }
        allRows.push([]); currentRow++;

        // Stage 2
        allRows.push([cell('STAGE 2: PACKAGING & QUALITY', 'sectionOrange'), '', '', '', '', '', '', '']); merges.push({ s: { r: currentRow, c: 0 }, e: { r: currentRow, c: 7 } }); currentRow++;
        allRows.push([cell('Product', 'header'), cell('Wastage (kg)', 'header'), cell('Reuse (kg)', 'header'), cell('Tape Type', 'header'), cell('Tape Qty', 'header'), cell('Labour', 'header'), '', '']); currentRow++;
        if (assignment.stage2_data) {
            let s2Data = typeof assignment.stage2_data === 'string' ? JSON.parse(assignment.stage2_data) : assignment.stage2_data;
            let s2List = s2Data.productAssignments || s2Data.stage2Assignments || s2Data.assignments || [];
            s2List.forEach(item => {
                allRows.push([cell(item.product || item.productName), cell(parseFloat(item.wastage || 0).toFixed(2)), cell(parseFloat(item.reuse || 0).toFixed(2)), cell(item.tapeColor || item.tape_color || '-'), cell(item.tapeQuantity || item.tape_quantity || '-'), cell(item.labourName || item.labourNames || item.labour)]);
                currentRow++;
            });
        }
        allRows.push([]); currentRow++;

        // Stage 3
        allRows.push([cell('STAGE 3: DELIVERY ROUTES', 'sectionBlue'), '', '', '', '', '']); merges.push({ s: { r: currentRow, c: 0 }, e: { r: currentRow, c: 5 } }); currentRow++;

        const getStockPrice = (query) => {
            const item = stockItems.find(i =>
                (i.product_name || i.item_name || i.name || '').toLowerCase().includes(query.toLowerCase())
            );
            if (!item) return 0;
            const raw =
                item.price !== undefined ? item.price :
                item.average_price !== undefined ? item.average_price :
                item.unit_price !== undefined ? item.unit_price :
                0;
            const num = parseFloat(raw);
            return isNaN(num) ? 0 : num;
        };

        Object.entries(processedReportData).forEach(([driverName, data], index) => {
            // Calculations
            let count10kg = 0, count5kg = 0, countThermo = 0, countNetBag = 0;
            data.products.forEach(p => {
                const lt = (p.packingType || '').toLowerCase(); const lp = (p.product || '').toLowerCase(); const b = p.box || 0;
                if (lt.includes('5kg') || lp.includes('5kg')) count5kg += b; else if (lt.includes('thermo') || lp.includes('thermo')) countThermo += b; else if (lt.includes('bag') || lp.includes('bag')) countNetBag += b; else count10kg += b;
            });
            const price10kg = getStockPrice('10 kg box') || 80; const price5kg = getStockPrice('5 kg box') || 45; const priceThermo = getStockPrice('thermo') || 145; const priceNetBag = getStockPrice('net bag') || 0;
            const cost10kg = count10kg * price10kg; const cost5kg = count5kg * price5kg; const costThermo = countThermo * priceThermo; const costNetBag = countNetBag * priceNetBag;
            const totalBoxCost = cost10kg + cost5kg + costThermo + costNetBag;

            const uniqueLabours = [...new Set(data.products.map(p => p.labour).filter(l => l).flatMap(l => l.split(',').map(n => n.trim())))];
            const labourCount = uniqueLabours.length; const normalRateObj = labourRates.find(r => r.labourType?.toLowerCase() === 'normal' && r.status === 'Active');
            const labourRate = normalRateObj ? parseFloat(normalRateObj.amount) : 0; const labourCost = labourCount * labourRate;
            const labourNamesStr = uniqueLabours.length > 0 ? `(${uniqueLabours.join(', ')})` : '';

            const pickupCost = getStockPrice('pickup') || 0;
            const tapeUnitPrice = getStockPrice('tape') || 0;
            const tapeQuantity = parseFloat(data.tapeQuantity || 0) || 0;
            const paperPrice = 0;
            const tapeCost = tapeUnitPrice * tapeQuantity + paperPrice;
            const driverRateObj = driverRates.find(r => r.deliveryType?.toLowerCase().includes('airport') && r.status === 'Active') || driverRates.find(r => r.status === 'Active');
            const driverWage = driverRateObj ? parseFloat(driverRateObj.amount) : 0;
            const totalOverhead = labourCost + pickupCost + tapeCost + driverWage; const totalExpenses = totalBoxCost + totalOverhead;
            const vegTotal = data.totalAmount; const grandTotal = vegTotal + totalExpenses; const grandTotalPerKg = Math.round(grandTotal / (data.totalWeight > 0 ? data.totalWeight : 1));

            // Rows
            allRows.push([{ v: `${dayName} | ${fullDate}`, s: { fill: { fgColor: { rgb: "F9FAFB" } }, font: { bold: true } } }, cell(data.airportCode || 'GVT'), cell(data.airportName || 'Airport'), '', '', '']); currentRow++;
            allRows.push([cell(dayName), cell(`00${index + 1}`), cell(`${driverName} ${data.driverInfo?.vehicle_number ? '(' + data.driverInfo.vehicle_number + ')' : ''}`), '', '', '']); currentRow++;
            allRows.push([]); currentRow++;

            allRows.push([cell('S.N', 'header'), cell('Box', 'header'), cell('Product', 'header'), cell('Kgs', 'header'), cell('Rate', 'header'), cell('Amount', 'header')]); currentRow++;
            let _xct = 1;
            data.products.forEach(p => {
                const n = parseInt(p.box) || 0;
                const sn = n === 0 ? '-' : (n === 1 ? `${_xct}` : `${_xct}-${_xct + n - 1}`);
                if (n > 0) _xct += n;
                allRows.push([cell(sn), cell(p.box), cell(p.product), cell((p.netWeight ?? p.grossWeight).toFixed(0)), cell(p.rate), cell(p.amount.toFixed(0))]);
                currentRow++;
            });
            allRows.push([]); currentRow++;

            allRows.push([cell('Expenses', 'subHeader'), cell('Count', 'subHeader'), cell('Rate', 'subHeader'), cell('Total', 'subHeader'), '', '']); currentRow++;
            if (count10kg > 0) { allRows.push([cell('10 KG BOX'), cell(count10kg), cell(price10kg), cell(cost10kg)]); currentRow++; }
            if (count5kg > 0) { allRows.push([cell('05 KG BOX'), cell(count5kg), cell(price5kg), cell(cost5kg)]); currentRow++; }
            if (countThermo > 0) { allRows.push([cell('THERMO BOX'), cell(countThermo), cell(priceThermo), cell(costThermo)]); currentRow++; }
            if (countNetBag > 0) { allRows.push([cell('NET BAG'), cell(countNetBag), cell(priceNetBag), cell(costNetBag)]); currentRow++; }

            allRows.push([cell(`LABOUR ${labourNamesStr}`), cell(labourCount), cell(labourRate), cell(labourCost)]); currentRow++;

            allRows.push([cell('PICKUP'), '', '', cell(pickupCost)]); merges.push({ s: { r: currentRow, c: 0 }, e: { r: currentRow, c: 2 } }); currentRow++;
            if (tapeCost > 0) { allRows.push([cell('TAPE & PAPER'), '', '', cell(tapeCost)]); merges.push({ s: { r: currentRow, c: 0 }, e: { r: currentRow, c: 2 } }); currentRow++; }
            allRows.push([cell('DRIVER WAGE'), '', '', cell(driverWage)]); merges.push({ s: { r: currentRow, c: 0 }, e: { r: currentRow, c: 2 } }); currentRow++;

            const xlTareWeight = (count10kg * 1.5) + (count5kg * 1.0) + (countThermo * 0.5);
            const xlNetWeight = data.totalWeight - xlTareWeight;
            allRows.push([cell('Shipment Summary', 'sectionGreen'), '', '', '', '', '']); merges.push({ s: { r: currentRow, c: 0 }, e: { r: currentRow, c: 5 } }); currentRow++;
            allRows.push([cell('Total Net Weight'), '', '', '', '', cell(`${xlNetWeight.toFixed(0)} kg`)]); merges.push({ s: { r: currentRow, c: 0 }, e: { r: currentRow, c: 4 } }); currentRow++;
            allRows.push([cell('Gross Weight'), '', '', '', '', cell(`${data.totalWeight.toFixed(0)} kg`)]); merges.push({ s: { r: currentRow, c: 0 }, e: { r: currentRow, c: 4 } }); currentRow++;
            if (count10kg > 0) { allRows.push([cell('10 KG Boxes'), '', '', '', '', cell(`${count10kg}`)]); merges.push({ s: { r: currentRow, c: 0 }, e: { r: currentRow, c: 4 } }); currentRow++; }
            if (count5kg > 0) { allRows.push([cell('05 KG Boxes'), '', '', '', '', cell(`${count5kg}`)]); merges.push({ s: { r: currentRow, c: 0 }, e: { r: currentRow, c: 4 } }); currentRow++; }
            if (countThermo > 0) { allRows.push([cell('Thermo Boxes'), '', '', '', '', cell(`${countThermo}`)]); merges.push({ s: { r: currentRow, c: 0 }, e: { r: currentRow, c: 4 } }); currentRow++; }
            if (countNetBag > 0) { allRows.push([cell('Bags'), '', '', '', '', cell(`${countNetBag}`)]); merges.push({ s: { r: currentRow, c: 0 }, e: { r: currentRow, c: 4 } }); currentRow++; }
            allRows.push([cell('Products Used'), '', '', '', '', cell(`${data.products.length}`)]); merges.push({ s: { r: currentRow, c: 0 }, e: { r: currentRow, c: 4 } }); currentRow++;

            allRows.push([cell('TOTAL EXPENSES:', 'highlight'), '', '', '', '', cell(totalExpenses.toFixed(0), 'highlight')]); merges.push({ s: { r: currentRow, c: 0 }, e: { r: currentRow, c: 4 } }); currentRow++;
            allRows.push([cell('VEG TOTAL:', 'highlight'), '', '', '', '', cell(vegTotal.toFixed(0), 'highlight')]); merges.push({ s: { r: currentRow, c: 0 }, e: { r: currentRow, c: 4 } }); currentRow++;
            allRows.push([cell('GRAND TOTAL:', 'highlight'), '', '', '', '', cell(grandTotal.toFixed(0), 'highlight')]); merges.push({ s: { r: currentRow, c: 0 }, e: { r: currentRow, c: 4 } }); currentRow++;
            allRows.push([cell(`GRAND TOTAL PER KG (${data.totalWeight.toFixed(0)}kg):`, 'bold'), '', '', '', '', cell(grandTotalPerKg.toFixed(0), 'bold')]); merges.push({ s: { r: currentRow, c: 0 }, e: { r: currentRow, c: 4 } }); currentRow++;

            allRows.push([]); currentRow++;
            allRows.push([]); currentRow++;
        });

        // Stage 4
        allRows.push([cell('STAGE 4: FINAL PRICING', 'sectionPurple'), '', '', '', '', '']); merges.push({ s: { r: currentRow, c: 0 }, e: { r: currentRow, c: 5 } }); currentRow++;
        allRows.push([cell('Product', 'header'), cell('Net Weight (kg)', 'header'), cell('Price/kg', 'header'), cell('Total', 'header'), '', '']); currentRow++;
        if (assignment.stage4_data) {
            let s4Data = typeof assignment.stage4_data === 'string' ? JSON.parse(assignment.stage4_data) : assignment.stage4_data;
            let productRows = s4Data.reviewData?.productRows || s4Data.productRows || [];
            let s4Total = 0;
            productRows.forEach(item => {
                const net = parseFloat(item.net_weight || item.quantity || 0);
                const price = parseFloat(item.price || item.final_price || 0);
                const total = net * price;
                s4Total += total;
                allRows.push([cell(item.product_name || item.product), cell(net.toFixed(2)), cell(price.toFixed(2)), cell(total.toFixed(2))]);
                currentRow++;
            });
            allRows.push([cell('Grand Total:', 'highlight'), '', '', cell(s4Total.toFixed(2), 'highlight'), '', '']); merges.push({ s: { r: currentRow, c: 0 }, e: { r: currentRow, c: 2 } }); currentRow++;
        }

        const ws = XLSX.utils.aoa_to_sheet(allRows);
        ws['!cols'] = [{ wch: 25 }, { wch: 15 }, { wch: 25 }, { wch: 12 }, { wch: 12 }, { wch: 20 }, { wch: 20 }, { wch: 18 }];
        ws['!merges'] = merges;
        ws['!rows'] = [{ hpt: 25 }, { hpt: 20 }];
        XLSX.utils.book_append_sheet(wb, ws, "Order Report");
        XLSX.writeFile(wb, `Order_Report_${orderId}.xlsx`);
    };
    const fetchOrderDetails = async () => {
        try {
            setLoading(true);

            // Fetch drivers, inventory, labour rates, driver rates, and fuel expenses concurrently
            const [driversResponse, stockResponse, ratesResponse, driverRatesResponse, fuelExpensesResponse] = await Promise.all([
                getAllDrivers(),
                getAllInventory(1, 1000),
                getAllLabourRates(),
                getAllDriverRates(),
                getAllFuelExpenses()
            ]);

            if (driversResponse.success && driversResponse.data) {
                setDrivers(driversResponse.data);
            }

            // Handle inventory response from getAllInventory
            if (stockResponse) {
                if (Array.isArray(stockResponse.data)) {
                    setStockItems(stockResponse.data);
                } else if (Array.isArray(stockResponse.data?.data)) {
                    setStockItems(stockResponse.data.data);
                } else if (Array.isArray(stockResponse)) {
                    setStockItems(stockResponse);
                }
            }

            if (ratesResponse) {
                if (Array.isArray(ratesResponse)) {
                    setLabourRates(ratesResponse);
                } else if (ratesResponse.success && ratesResponse.data) {
                    setLabourRates(ratesResponse.data);
                }
            }

            if (driverRatesResponse) {
                if (Array.isArray(driverRatesResponse)) {
                    setDriverRates(driverRatesResponse);
                } else if (driverRatesResponse.success && driverRatesResponse.data) {
                    setDriverRates(driverRatesResponse.data);
                }
            }

            if (fuelExpensesResponse) {
                if (Array.isArray(fuelExpensesResponse)) {
                    setFuelExpenses(fuelExpensesResponse);
                } else if (fuelExpensesResponse.success && fuelExpensesResponse.data) {
                    setFuelExpenses(fuelExpensesResponse.data);
                } else if (Array.isArray(fuelExpensesResponse.data)) {
                    setFuelExpenses(fuelExpensesResponse.data);
                }
            }

            // Fetch all orders
            const ordersResponse = await getAllOrders();

            if (ordersResponse.success && ordersResponse.data) {
                const foundOrder = ordersResponse.data.find(o => {
                    const matchOid = o.oid === orderId;
                    const matchAutoId = o.order_auto_id === orderId;
                    return matchOid || matchAutoId;
                });

                if (foundOrder) {
                    setOrder(foundOrder);

                    // Fetch assignment data (flower order API only)
                    try {
                        const assignmentResponse = await getFlowerOrderAssignment(foundOrder.oid);
                        setAssignment(assignmentResponse.data);
                    } catch (err) {
                        console.error('Error fetching assignment:', err);
                    }
                } else {
                    console.error('Order not found with ID:', orderId);
                }
            }
        } catch (error) {
            console.error('Error fetching order details:', error);
        } finally {
            setLoading(false);
        }
    };

    const formatCurrency = (value) => {
        return `₹${parseFloat(value || 0).toFixed(2)}`;
    };

    // Grand Total used across the page (Order Information card, tables, exports)
    const getGrandTotalAmount = () => {
        if (!assignment || !assignment.stage4_data) return 0;

        try {
            const stage4Data = typeof assignment.stage4_data === 'string'
                ? JSON.parse(assignment.stage4_data)
                : assignment.stage4_data;

            const productRows = stage4Data.reviewData?.productRows || stage4Data.productRows || [];

            let grandTotal = 0;
            productRows.forEach((item) => {
                const netWeight = parseFloat(item.net_weight || item.quantity || 0);
                const price = parseFloat(item.price || item.final_price || 0);
                grandTotal += netWeight * price;
            });

            return grandTotal;
        } catch (e) {
            console.error('Error calculating grand total from stage4_data', e);
            return 0;
        }
    };

    const formatDate = (dateString) => {
        if (!dateString) return '-';
        const date = new Date(dateString);
        return date.toLocaleDateString('en-IN', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric'
        });
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-screen">
                <div className="text-[#0D8568] text-xl">Loading order details...</div>
            </div>
        );
    }

    if (!order) {
        return (
            <div className="flex items-center justify-center min-h-screen">
                <div className="text-red-600 text-xl">Order not found</div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-[#E6F7F4] to-[#D0E9E4] p-6">
            <div className="max-w-7xl mx-auto">
                {/* Header */}
                <div className="mb-6 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <button
                            onClick={() => navigate('/reports/flower-order')}
                            className="p-2 bg-white rounded-lg hover:bg-[#F0F4F3] transition-colors shadow-md"
                        >
                            <ArrowLeft className="text-[#0D8568]" size={24} />
                        </button>
                        <div>
                            <h1 className="text-2xl font-bold text-[#0D5C4D]">Flower Order Details</h1>
                            <p className="text-[#6B8782]">View detailed information about this flower order</p>
                        </div>
                    </div>
                    <div className="flex gap-3">
                        <button
                            onClick={() => handleExportPDF()}
                            className="flex items-center gap-2 px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors"
                        >
                            <FileText size={18} />
                            Export PDF
                        </button>
                        <button
                            onClick={() => handleExportExcel()}
                            className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                        >
                            <FileSpreadsheet size={18} />
                            Export Excel
                        </button>
                    </div>
                </div>

                {/* Order Information Card */}
                <div className="bg-white rounded-2xl shadow-lg p-6 mb-6">
                    <h2 className="text-2xl font-bold text-[#0D5C4D] mb-4">Order Information</h2>
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                        <div>
                            <p className="text-sm text-[#6B8782] mb-1">Order ID</p>
                            <p className="text-lg font-semibold text-[#0D5C4D]">{order.oid || '-'}</p>
                        </div>
                        <div>
                            <p className="text-sm text-[#6B8782] mb-1">Customer Name</p>
                            <p className="text-lg font-semibold text-[#0D5C4D]">{order.customer_name || '-'}</p>
                        </div>
                        <div>
                            <p className="text-sm text-[#6B8782] mb-1">Order Date</p>
                            <p className="text-lg font-semibold text-[#0D5C4D]">{formatDate(order.order_received_date)}</p>
                        </div>
                        <div>
                            <p className="text-sm text-[#6B8782] mb-1">Total Amount</p>
                            <p className="text-lg font-semibold text-[#0D8568]">{formatCurrency(getGrandTotalAmount())}</p>
                        </div>
                    </div>
                </div>

                {/* All Stages Displayed Vertically */}
                <div className="space-y-6">
                    {/* Stage 1: Product Collection */}
                    <div className="bg-white rounded-2xl shadow-lg overflow-hidden">
                        <div className="bg-[#0D8568] text-white px-6 py-4">
                            <h2 className="text-xl font-bold">Stage 1: Product Collection</h2>
                        </div>
                        <div className="p-6">
                            {assignment && (assignment.product_assignments || assignment.stage1_data) ? (
                                <div>
                                    <div className="overflow-x-auto mb-8">
                                        <table className="w-full">
                                            <thead className="bg-[#0D8568] text-white">
                                                <tr>
                                                    <th className="px-4 py-3 text-left whitespace-nowrap">Product</th>
                                                    <th className="px-4 py-3 text-left whitespace-nowrap">Entity Type</th>
                                                    <th className="px-4 py-3 text-left whitespace-nowrap">Entity Name</th>
                                                    <th className="px-4 py-3 text-left whitespace-nowrap">Assigned Qty (kg)</th>
                                                    <th className="px-4 py-3 text-left whitespace-nowrap">Assigned Boxes</th>
                                                    <th className="px-4 py-3 text-left whitespace-nowrap">Labour</th>
                                                    <th className="px-4 py-3 text-left whitespace-nowrap">Driver</th>
                                                    <th className="px-4 py-3 text-left whitespace-nowrap">Address</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {(() => {
                                                    const stage1Source = assignment.product_assignments || assignment.stage1_data;
                                                    let stage1Data = typeof stage1Source === 'string' ? JSON.parse(stage1Source) : stage1Source;
                                                    let stage1Assignments = stage1Data.productAssignments || stage1Data.assignments || (Array.isArray(stage1Data) ? stage1Data : []);

                                                    // Get Stage 4/3/2 data for Assigned Qty fallback
                                                    let stage4ProductRows = [];
                                                    if (assignment.stage4_data) {
                                                        try {
                                                            let stage4Data = typeof assignment.stage4_data === 'string' ? JSON.parse(assignment.stage4_data) : assignment.stage4_data;
                                                            stage4ProductRows = stage4Data.reviewData?.productRows || stage4Data.productRows || [];
                                                        } catch (e) { /* ignore */ }
                                                    }
                                                    let stage3Products = [];
                                                    let stage2Assignments = [];
                                                    if (assignment.stage3_data) {
                                                        try {
                                                            let stage3Data = typeof assignment.stage3_data === 'string' ? JSON.parse(assignment.stage3_data) : assignment.stage3_data;
                                                            stage3Products = stage3Data.products || [];
                                                        } catch (e) { /* ignore */ }
                                                    }
                                                    if (assignment.stage2_data) {
                                                        try {
                                                            let stage2Data = typeof assignment.stage2_data === 'string' ? JSON.parse(assignment.stage2_data) : assignment.stage2_data;
                                                            stage2Assignments = stage2Data.productAssignments || stage2Data.stage2Assignments || stage2Data.assignments || [];
                                                        } catch (e) { /* ignore */ }
                                                    }

                                                    // Get Stage 1 summary data which has driver/labour assignments
                                                    let stage1SummaryData = null;
                                                    if (assignment.stage1_summary_data || assignment.summary_data) {
                                                        try {
                                                            const summarySource = assignment.stage1_summary_data || assignment.summary_data;
                                                            stage1SummaryData = typeof summarySource === 'string' ? JSON.parse(summarySource) : summarySource;
                                                        } catch (e) {
                                                            console.error('Error parsing stage1_summary_data:', e);
                                                        }
                                                    }

                                                    // If Stage 1 doesn't have delivery/summary data, try Stage 3
                                                    let stage3DriverMap = {};
                                                    if (assignment.stage3_data) {
                                                        try {
                                                            let stage3Data = typeof assignment.stage3_data === 'string' ? JSON.parse(assignment.stage3_data) : assignment.stage3_data;
                                                            let deliveryData = stage3Data.products || [];
                                                            const airportGroups = stage3Data.summaryData?.airportGroups || {};

                                                            // Create a map of product -> driver/labour from Stage 3
                                                            deliveryData.forEach(item => {
                                                                const productKey = `${item.product || item.productName}`;
                                                                let driverName = item.driver || item.driverName || '-';

                                                                // If driver not in product, check airportGroups
                                                                if (driverName === '-') {
                                                                    for (const [airportCode, airportData] of Object.entries(airportGroups)) {
                                                                        const productInGroup = airportData.products?.find(p =>
                                                                            (p.product || p.productName) === productKey
                                                                        );
                                                                        if (productInGroup && productInGroup.driver) {
                                                                            driverName = productInGroup.driver;
                                                                            break;
                                                                        }
                                                                    }
                                                                }

                                                                if (!stage3DriverMap[productKey]) {
                                                                    stage3DriverMap[productKey] = {
                                                                        driver: driverName,
                                                                        labour: item.labour || item.labourName || '-'
                                                                    };
                                                                }
                                                            });
                                                        } catch (e) {
                                                            console.error('Error parsing stage3_data:', e);
                                                        }
                                                    }

                                                    return stage1Assignments.map((item, idx) => {
                                                        let labourName = '-';
                                                        let driverName = '-';
                                                        let matchedAddress = null;

                                                        // First: Try to get from Stage 1 Summary Data (Assignment Summary)
                                                        const productKey = item.product || item.productName;
                                                        if (stage1SummaryData?.driverAssignments) {
                                                            stage1SummaryData.driverAssignments.forEach(driverGroup => {
                                                                const assignment = driverGroup.assignments.find(a =>
                                                                    a.product === productKey &&
                                                                    a.entityName === (item.assignedTo || item.entityName) &&
                                                                    a.entityType === item.entityType
                                                                );
                                                                if (assignment) {
                                                                    if (assignment.labour) {
                                                                        labourName = Array.isArray(assignment.labour)
                                                                            ? assignment.labour.join(', ')
                                                                            : assignment.labour;
                                                                    }
                                                                    if (driverGroup.driver) {
                                                                        driverName = driverGroup.driver.split(' - ')[0];
                                                                    }
                                                                    if (assignment.address) matchedAddress = assignment.address;
                                                                }
                                                            });
                                                        }

                                                        // Fallback: Try Stage 3 data if Stage 1 summary doesn't have it
                                                        if ((labourName === '-' || driverName === '-') && stage3DriverMap[productKey]) {
                                                            if (labourName === '-') labourName = stage3DriverMap[productKey].labour;
                                                            if (driverName === '-') {
                                                                const stage3Driver = stage3DriverMap[productKey].driver;
                                                                driverName = stage3Driver.includes(' - ') ? stage3Driver.split(' - ')[0] : stage3Driver;
                                                            }
                                                        }

                                                        // Assigned Qty: try Stage 1 first, then fallback to Stage 4, 3, 2
                                                        const normalizeProductName = (s) => (s || '').replace(/^W\.\s*/i, '').trim();
                                                        let qtyValue = parseFloat(item.assignedQty || item.assigned_qty || item.pickedQuantity || 0);
                                                        if (qtyValue === 0 && stage4ProductRows.length > 0) {
                                                            const stage4Product = stage4ProductRows.find(p4 => {
                                                                const p = normalizeProductName(p4.product_name || p4.product || p4.productName);
                                                                return p === productKey || p === normalizeProductName(productKey);
                                                            });
                                                            if (stage4Product) {
                                                                qtyValue = parseFloat(stage4Product.net_weight || stage4Product.quantity || stage4Product.assignedQty || 0);
                                                            }
                                                        }
                                                        if (qtyValue === 0 && stage3Products.length > 0) {
                                                            const stage3Product = stage3Products.find(p3 => {
                                                                const p = normalizeProductName(p3.product || p3.productName || p3.product_name);
                                                                return p === productKey || p === normalizeProductName(productKey);
                                                            });
                                                            if (stage3Product) {
                                                                const grossWeightStr = stage3Product.grossWeight || stage3Product.gross_weight || '0';
                                                                qtyValue = parseFloat(grossWeightStr.toString().replace(/[^0-9.]/g, '')) || 0;
                                                            }
                                                        }
                                                        if (qtyValue === 0 && stage2Assignments.length > 0) {
                                                            const stage2Product = stage2Assignments.find(p2 => {
                                                                const p = normalizeProductName(p2.product || p2.productName || p2.product_name);
                                                                return p === productKey || p === normalizeProductName(productKey);
                                                            });
                                                            if (stage2Product) {
                                                                qtyValue = parseFloat(stage2Product.pickedQuantity || stage2Product.picked_quantity || 0);
                                                            }
                                                        }

                                                        // Address: show full address from item or matched summary assignment
                                                        const addressValue = (item.address || item.addressInfo || matchedAddress || '').trim();
                                                        const displayAddress = addressValue || '-';

                                                        return (
                                                            <tr key={idx} className="border-b border-[#D0E0DB] hover:bg-[#F0F4F3]">
                                                                <td className="px-4 py-3">{item.product || item.productName || '-'}</td>
                                                                <td className="px-4 py-3">{item.entityType || item.entity_type || '-'}</td>
                                                                <td className="px-4 py-3">{item.assignedTo || item.entityName || '-'}</td>
                                                                <td className="px-4 py-3">{qtyValue > 0 ? qtyValue.toFixed(2) : qtyValue}</td>
                                                                <td className="px-4 py-3">{item.assignedBoxes || item.assigned_boxes || 0}</td>
                                                                <td className="px-4 py-3">{labourName}</td>
                                                                <td className="px-4 py-3">{driverName}</td>
                                                                <td className="px-4 py-3 text-sm text-gray-600 max-w-md break-words">{displayAddress}</td>
                                                            </tr>
                                                        );
                                                    });
                                                })()}
                                            </tbody>
                                        </table>
                                    </div>

                                    {/* Assignment Summary - Grouped by Driver */}
                                    {assignment.stage3_data && (() => {
                                        let stage3Data = typeof assignment.stage3_data === 'string' ? JSON.parse(assignment.stage3_data) : assignment.stage3_data;
                                        let deliveryData = stage3Data.products || [];
                                        const airportGroups = stage3Data.summaryData?.airportGroups || {};

                                        // Group products by driver
                                        let driverProductMap = {};
                                        deliveryData.forEach((item) => {
                                            const product = item.product || item.productName || '-';
                                            let driverName = '';

                                            // Find driver from airportGroups
                                            for (const [airportCode, airportData] of Object.entries(airportGroups)) {
                                                const productInGroup = airportData.products?.find(p =>
                                                    (p.product || p.productName) === product
                                                );
                                                if (productInGroup) {
                                                    driverName = productInGroup.driver || '';
                                                    break;
                                                }
                                            }

                                            if (!driverName) driverName = 'Unassigned';

                                            if (!driverProductMap[driverName]) {
                                                driverProductMap[driverName] = [];
                                            }

                                            const grossWeightStr = item.grossWeight || item.gross_weight || '0';
                                            const grossWeight = parseFloat(grossWeightStr.toString().replace(/[^0-9.]/g, '')) || 0;

                                            driverProductMap[driverName].push({
                                                product: product,
                                                labour: item.labour || item.labourNames || '-',
                                                weight: grossWeight,
                                                boxes: parseInt(item.noOfPkgs || item.no_of_pkgs || 0)
                                            });
                                        });

                                        if (Object.keys(driverProductMap).length > 0) {
                                            return (
                                                <div className="mt-8">
                                                    <h3 className="text-lg font-bold text-[#0D5C4D] mb-2">Assignment Summary</h3>
                                                    <p className="text-sm text-[#6B8782] mb-4 italic">Product collections grouped by driver</p>

                                                    {Object.entries(driverProductMap).map(([, products], driverIdx) => (
                                                        <div key={driverIdx} className="mb-6">
                                                            <div className="bg-[#0D8568] text-white px-4 py-2 rounded-t-lg">
                                                                <p className="text-sm">{products.length} Collections</p>
                                                            </div>
                                                            <table className="w-full border border-gray-200">
                                                                <thead className="bg-gray-100">
                                                                    <tr>
                                                                        <th className="px-4 py-2 text-left text-sm border">Product</th>
                                                                        <th className="px-4 py-2 text-left text-sm border">Labour Assigned</th>
                                                                        <th className="px-4 py-2 text-left text-sm border">Weight (kg)</th>
                                                                        <th className="px-4 py-2 text-left text-sm border">Boxes/Bags</th>
                                                                    </tr>
                                                                </thead>
                                                                <tbody>
                                                                    {products.map((p, idx) => (
                                                                        <tr key={idx} className="border-b hover:bg-[#F0F4F3]">
                                                                            <td className="px-4 py-2 text-sm border">{p.product}</td>
                                                                            <td className="px-4 py-2 text-sm border">{p.labour}</td>
                                                                            <td className="px-4 py-2 text-sm border">{p.weight.toFixed(2)}</td>
                                                                            <td className="px-4 py-2 text-sm border">{p.boxes}</td>
                                                                        </tr>
                                                                    ))}
                                                                </tbody>
                                                            </table>
                                                        </div>
                                                    ))}
                                                </div>
                                            );
                                        }
                                        return null;
                                    })()}
                                </div>
                            ) : (
                                <p className="text-[#6B8782]">No Stage 1 data available</p>
                            )}
                        </div>
                    </div>

                    {/* Stage 2: Packaging & Quality */}
                    <div className="bg-white rounded-2xl shadow-lg overflow-hidden">
                        <div className="bg-[#0D8568] text-white px-6 py-4">
                            <h2 className="text-xl font-bold">Stage 2: Packaging & Quality</h2>
                        </div>
                        <div className="p-6">
                            {assignment && assignment.stage2_data ? (
                                <div className="overflow-x-auto">
                                    <table className="w-full">
                                        <thead className="bg-[#0D8568] text-white">
                                            <tr>
                                                <th className="px-4 py-3 text-left">Product</th>
                                                <th className="px-4 py-3 text-left">Wastage (kg)</th>
                                                <th className="px-4 py-3 text-left">Reuse (kg)</th>
                                                <th className="px-4 py-3 text-left">Labour Assigned</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {(() => {
                                                let stage2Data = typeof assignment.stage2_data === 'string' ? JSON.parse(assignment.stage2_data) : assignment.stage2_data;
                                                let stage2Assignments = stage2Data.productAssignments || stage2Data.stage2Assignments || stage2Data.assignments || [];

                                                return stage2Assignments.map((item, idx) => (
                                                    <tr key={idx} className="border-b border-[#D0E0DB] hover:bg-[#F0F4F3]">
                                                        <td className="px-4 py-3">{item.product || item.productName || '-'}</td>
                                                        <td className="px-4 py-3">{parseFloat(item.wastage || 0).toFixed(2)}</td>
                                                        <td className="px-4 py-3">{parseFloat(item.reuse || 0).toFixed(2)}</td>
                                                        <td className="px-4 py-3">{item.labourName || item.labourNames || item.labour || '-'}</td>
                                                    </tr>
                                                ));
                                            })()}
                                        </tbody>
                                    </table>
                                </div>
                            ) : (
                                <p className="text-[#6B8782]">No Stage 2 data available</p>
                            )}
                        </div>
                    </div>

                    {/* Stage 3: Delivery Routes (GVT Bill Format) */}
                    <div className="bg-white rounded-2xl shadow-lg overflow-hidden">
                        <div className="bg-[#0D8568] text-white px-6 py-4">
                            <h2 className="text-xl font-bold">Stage 3: Delivery Routes</h2>
                        </div>
                        <div className="p-4 bg-gray-50">
                            {assignment && assignment.stage3_data ? (
                                <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
                                    {(() => {
                                        let stage3Data = typeof assignment.stage3_data === 'string' ? JSON.parse(assignment.stage3_data) : assignment.stage3_data;
                                        let deliveryData = stage3Data.products || [];
                                        const airportGroups = stage3Data.summaryData?.airportGroups || {};
                                        // Prefer stage3_summary_data.airportGroups (backend may save codes there)
                                        let summaryAirportGroupsHtml = airportGroups;
                                        if (assignment.stage3_summary_data) {
                                            try {
                                                const s3 = typeof assignment.stage3_summary_data === 'string' ? JSON.parse(assignment.stage3_summary_data) : assignment.stage3_summary_data;
                                                if (s3?.airportGroups && Object.keys(s3.airportGroups).length) summaryAirportGroupsHtml = s3.airportGroups;
                                            } catch (e) { /* ignore */ }
                                        }

                                        // Get Stage 4 pricing data
                                        let stage4ProductRows = [];
                                        if (assignment.stage4_data) {
                                            let stage4Data = typeof assignment.stage4_data === 'string' ? JSON.parse(assignment.stage4_data) : assignment.stage4_data;
                                            stage4ProductRows = stage4Data.reviewData?.productRows || stage4Data.productRows || [];
                                        }

                                        // Prepare Stage 2 Labour Map from stage2_data (PRIMARY SOURCE)
                                        let stage2LabourMap = {};
                                        // Map of labour name -> wage/totalAmount from Stage 2 summary
                                        let stage2LabourWageMap = {};

                                        // Parse stage2_data first
                                        if (assignment.stage2_data) {
                                            try {
                                                let s2Data = typeof assignment.stage2_data === 'string' ? JSON.parse(assignment.stage2_data) : assignment.stage2_data;
                                                let s2Assignments = s2Data.productAssignments || s2Data.stage2Assignments || s2Data.assignments || [];
                                                s2Assignments.forEach(s2Item => {
                                                    const pName = s2Item.product || s2Item.productName;
                                                    const pLabour = s2Item.labourName || s2Item.labourNames || s2Item.labour;
                                                    if (pName && pLabour) {
                                                        stage2LabourMap[pName] = pLabour;
                                                    }
                                                });
                                                console.log('Stage 2 Labour Map from stage2_data (HTML):', stage2LabourMap);
                                            } catch (e) {
                                                console.error("Error parsing stage2_data in HTML view", e);
                                            }
                                        }

                                        // Use stage2_summary_data to (a) backfill labour names if needed and
                                        // (b) ALWAYS load individual labour wages that were saved in Stage 2.
                                        if (assignment.stage2_summary_data) {
                                            try {
                                                let s2SummaryData = typeof assignment.stage2_summary_data === 'string'
                                                    ? JSON.parse(assignment.stage2_summary_data)
                                                    : assignment.stage2_summary_data;

                                                const labourAssignments = s2SummaryData.labourAssignments || [];
                                                const labourPrices = s2SummaryData.labourPrices || [];

                                                // 1) If we DID NOT get product→labour mapping from stage2_data,
                                                //    backfill it from summary_data (same logic as before)
                                                if (Object.keys(stage2LabourMap).length === 0 && labourAssignments.length > 0) {
                                                    labourAssignments.forEach(labourGroup => {
                                                        const labourName = labourGroup.labour;
                                                        const assignments = labourGroup.assignments || [];

                                                        assignments.forEach(assignment => {
                                                            const productId = assignment.oiid;
                                                            const productName = assignment.product;

                                                            if (productId && labourName) {
                                                                if (!stage2LabourMap[productId]) {
                                                                    stage2LabourMap[productId] = [];
                                                                }
                                                                if (!stage2LabourMap[productId].includes(labourName)) {
                                                                    stage2LabourMap[productId].push(labourName);
                                                                }
                                                            }

                                                            // Also map by product name for fallback
                                                            if (productName && labourName) {
                                                                if (!stage2LabourMap[productName]) {
                                                                    stage2LabourMap[productName] = [];
                                                                }
                                                                if (!stage2LabourMap[productName].includes(labourName)) {
                                                                    stage2LabourMap[productName].push(labourName);
                                                                }
                                                            }
                                                        });
                                                    });

                                                    // Convert arrays to comma-separated strings
                                                    Object.keys(stage2LabourMap).forEach(key => {
                                                        if (Array.isArray(stage2LabourMap[key])) {
                                                            stage2LabourMap[key] = stage2LabourMap[key].join(', ');
                                                        }
                                                    });

                                                    console.log('Stage 2 Labour Map from summary (HTML fallback):', stage2LabourMap);
                                                }

                                                // 2) Always build a labour → wage map from summary_data.labourPrices
                                                labourPrices.forEach(lp => {
                                                    const labourName = lp.labourName || lp.labour;
                                                    if (!labourName) return;

                                                    // Prefer totalAmount (includes excess etc.) then labourWage
                                                    const wage =
                                                        parseFloat(lp.totalAmount ?? lp.labourWage ?? 0) || 0;
                                                    stage2LabourWageMap[labourName] = wage;
                                                });

                                            } catch (e) {
                                                console.error("Error parsing stage2_summary_data in HTML view", e);
                                            }
                                        }

                                        // Group products by driver
                                        let productsByDriver = {};
                                        deliveryData.forEach((item) => {
                                            const product = item.product || item.productName || '-';
                                            let driverName = '';
                                            let driverInfo = null;

                                            // 1. Try to get driver from direct ID (most reliable)
                                            if (item.selectedDriver) {
                                                // items.selectedDriver is likely a string or number ID
                                                driverInfo = drivers.find(d => d.did == item.selectedDriver || d.driver_id == item.selectedDriver);
                                                if (driverInfo) {
                                                    driverName = driverInfo.driver_name;
                                                }
                                            }

                                            // 2. Fallback: Check if item has driver name directly
                                            if (!driverName && (item.driver || item.driverName)) {
                                                driverName = item.driver || item.driverName;
                                            }

                                            // 3. Fallback: Find driver from airportGroups
                                            if (!driverName) {
                                                for (const [airportCode, airportData] of Object.entries(airportGroups)) {
                                                    const productInGroup = airportData.products?.find(p =>
                                                        (p.product || p.productName) === product
                                                    );
                                                    if (productInGroup) {
                                                        driverName = productInGroup.driver || '';
                                                        break;
                                                    }
                                                }
                                            }

                                            if (!driverName) driverName = 'Unassigned';

                                            if (!productsByDriver[driverName]) {
                                                productsByDriver[driverName] = {
                                                    products: [],
                                                    totalAmount: 0,
                                                    totalWeight: 0,
                                                    totalBoxes: 0,
                                                    airportName: '-',
                                                    driverInfo: driverInfo
                                                };
                                            }

                                            // Ensure driverInfo is populated if we found the name but not the object yet
                                            if (!productsByDriver[driverName].driverInfo && driverName !== 'Unassigned') {
                                                productsByDriver[driverName].driverInfo = drivers.find(d => d.driver_name === driverName) || { mobile_number: '', vehicle_number: '' };
                                            }

                                            const grossWeightStr = item.grossWeight || item.gross_weight || '0';
                                            const grossWeight = parseFloat(grossWeightStr.toString().replace(/[^0-9.]/g, '')) || 0;

                                            // Get pricing from Stage 4
                                            const stage4Product = stage4ProductRows.find(p4 =>
                                                (p4.product_name || p4.product || p4.productName) === product
                                            );
                                            const pricePerKg = stage4Product ? parseFloat(stage4Product.price || stage4Product.final_price || 0) : 0;
                                            const netWeight = stage4Product ? parseFloat(stage4Product.net_weight || stage4Product.quantity || 0) : grossWeight;
                                            const productTotal = pricePerKg * netWeight;
                                            const noOfPkgs = parseInt(item.noOfPkgs || item.no_of_pkgs || 0);

                                            if (productsByDriver[driverName].airportName === '-') {
                                                productsByDriver[driverName].airportName = item.airportName || item.airport_name || '-';
                                            }

                                            productsByDriver[driverName].products.push({
                                                product: product,
                                                grossWeight: grossWeight, // Displayed as KGS
                                                rate: pricePerKg,
                                                amount: productTotal,
                                                box: noOfPkgs,
                                                ct: item.ct || item.CT,
                                                labour: item.labour || item.labourName || stage2LabourMap[product],
                                                packingType: item.packingType || item.packing_type || '', // Capture Packing Type
                                                sNo: productsByDriver[driverName].products.length + 1
                                            });

                                            productsByDriver[driverName].totalAmount += productTotal;
                                            productsByDriver[driverName].totalWeight += grossWeight;
                                            productsByDriver[driverName].totalBoxes += noOfPkgs;
                                        });

                                        const orderDate = new Date(order.order_received_date);
                                        const dayName = orderDate.toLocaleDateString('en-US', { weekday: 'long' }).toUpperCase();
                                        const shortDate = orderDate.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: '2-digit' }).replace(/ /g, '/'); // 1/Oct/24
                                        const fullDate = orderDate.toLocaleDateString('en-GB'); // 01/10/2024
                                        
                                        // Helper function to get fuel expense for a driver on a specific date
                                        const getFuelExpenseForDriver = (driverId, date) => {
                                            if (!driverId || !date || !fuelExpenses || fuelExpenses.length === 0) return 0;
                                            
                                            const expenseDate = new Date(date).toISOString().split('T')[0];
                                            const matchingExpenses = fuelExpenses.filter(expense => {
                                                const expenseDriverId = expense.driver_id || expense.did || expense.driver?.did || expense.driver?.driver_id;
                                                const expenseDateStr = expense.date ? new Date(expense.date).toISOString().split('T')[0] : '';
                                                return expenseDriverId == driverId && expenseDateStr === expenseDate;
                                            });
                                            
                                            // Sum all fuel expenses for this driver on this date
                                            return matchingExpenses.reduce((sum, expense) => {
                                                // Calculate total from unit_price and litre if total_amount is not available
                                                let total = parseFloat(expense.total_amount || expense.total || 0);
                                                if (!total || isNaN(total)) {
                                                    const unitPrice = parseFloat(expense.unit_price || 0);
                                                    const litre = parseFloat(expense.litre || 0);
                                                    total = unitPrice * litre;
                                                }
                                                return sum + (isNaN(total) ? 0 : total);
                                            }, 0);
                                        };

                                        // Attach airportCode from Airport Delivery Summary (prefer stage3_summary_data so backend-saved codes show)
                                        const groupsForCodeHtml = Object.keys(summaryAirportGroupsHtml).length ? summaryAirportGroupsHtml : airportGroups;
                                        Object.values(productsByDriver).forEach(driverData => {
                                            const airportName = driverData.airportName || '';
                                            for (const [code, ag] of Object.entries(groupsForCodeHtml)) {
                                                if (ag && (ag.airportName || '').toLowerCase() === airportName.toLowerCase()) {
                                                    driverData.airportCode = code;
                                                    break;
                                                }
                                            }
                                        });

                                        return Object.entries(productsByDriver).map(([driverName, data], index) => {
                                            // 1. Calculations & Prep
                                            const getStockPrice = (query) => {
                                                const item = stockItems.find(i =>
                                                    (i.product_name || i.item_name || i.name || '').toLowerCase().includes(query.toLowerCase())
                                                );
                                                if (!item) return 0;
                                                const raw =
                                                    item.price !== undefined ? item.price :
                                                    item.average_price !== undefined ? item.average_price :
                                                    item.unit_price !== undefined ? item.unit_price :
                                                    0;
                                                const num = parseFloat(raw);
                                                return isNaN(num) ? 0 : num;
                                            };

                                            // Breakdown of Packaging
                                            let count10kg = 0;
                                            let count5kg = 0;
                                            let countThermo = 0;
                                            let countNetBag = 0;

                                            data.products.forEach(p => {
                                                const lowerProd = (p.product || '').toLowerCase();
                                                const lowerType = (p.packingType || '').toLowerCase();
                                                const boxQty = p.box || 0;

                                                if (lowerType.includes('5kg') || lowerType.includes('5 kg') || lowerProd.includes('5kg') || lowerProd.includes('5 kg')) {
                                                    count5kg += boxQty;
                                                } else if (lowerType.includes('thermo') || lowerProd.includes('thermo')) {
                                                    countThermo += boxQty;
                                                } else if (lowerType.includes('bag') || lowerProd.includes('bag') || lowerProd.includes('net bag')) {
                                                    countNetBag += boxQty;
                                                } else {
                                                    // Default to 10kg for standard veg boxes
                                                    count10kg += boxQty;
                                                }
                                            });
                                            // Fallback: If no breakdown found but totalBoxes exists (and loop didn't capture properly due to data sync), use totalBoxes
                                            // But for now, calculation summation is safer.
                                            // Check if summation matches totalBoxes partiallly? 
                                            // We'll trust the loop.

                                            const price10kg = getStockPrice('10 kg box') || getStockPrice('10kg box') || 80;
                                            const price5kg = getStockPrice('5 kg box') || 45;
                                            const priceThermo = getStockPrice('thermo') || 145;
                                            const priceNetBag = getStockPrice('net bag') || 0;

                                            const cost10kg = count10kg * price10kg;
                                            const cost5kg = count5kg * price5kg;
                                            const costThermo = countThermo * priceThermo;
                                            const costNetBag = countNetBag * priceNetBag;
                                            const totalBoxCost = cost10kg + cost5kg + costThermo + costNetBag;

                                            // Overheads
                                            const uniqueLabours = [...new Set(
                                                data.products
                                                    .map(p => p.labour)
                                                    .filter(l => l && l !== '-' && l !== '')
                                                    .flatMap(l => l.split(',').map(name => name.trim()))
                                            )];
                                            const labourCount = uniqueLabours.length;

                                            // Base (fallback) labour rate from master rates
                                            const normalRateObj = labourRates.find(
                                                r => r.labourType?.toLowerCase() === 'normal' && r.status === 'Active'
                                            );
                                            const defaultLabourRate = normalRateObj
                                                ? parseFloat(normalRateObj.amount)
                                                : 0;

                                            // Use per‑labour wages saved in Stage 2 summary when available
                                            let labourCost = 0;
                                            uniqueLabours.forEach(name => {
                                                const wageFromStage2 = stage2LabourWageMap[name];
                                                const wage = (typeof wageFromStage2 === 'number' && !isNaN(wageFromStage2))
                                                    ? wageFromStage2
                                                    : defaultLabourRate;
                                                labourCost += wage;
                                            });

                                            // For display in the "Rate" column, show average wage per labour
                                            const labourRate = labourCount > 0
                                                ? Math.round(labourCost / labourCount)
                                                : defaultLabourRate;
                                            const labourNamesStr = uniqueLabours.length > 0 ? `(${uniqueLabours.join(', ')})` : '';

                                            const pickupCost = getStockPrice('pickup') || 0;
                                            const tapeUnitPrice = getStockPrice('tape') || 0;
                                            const tapeQuantity = (() => {
                                                const airportName = data.airportName;
                                                const getTapeQtyFromAg = (ag) => {
                                                    if (Array.isArray(ag.tapes) && ag.tapes.length > 0) {
                                                        return ag.tapes.reduce((sum, t) => sum + (parseFloat(t.tapeQuantity || t.tapeQty || 0) || 0), 0);
                                                    }
                                                    return parseFloat(ag.tapeQuantity || ag.tapeQty || 0) || 0;
                                                };
                                                const getTapeQtyFromTapeData = (info) => {
                                                    if (Array.isArray(info)) {
                                                        return info.reduce((sum, t) => sum + (parseFloat(t.tapeQuantity || t.tapeQty || 0) || 0), 0);
                                                    }
                                                    if (info && typeof info === 'object') {
                                                        return parseFloat(info.tapeQuantity || info.tapeQty || 0) || 0;
                                                    }
                                                    return 0;
                                                };

                                                // 1) Try to read from stage3_summary_data.airportGroups (supports multiple tapes)
                                                if (assignment.stage3_summary_data) {
                                                    try {
                                                        const s3Summary = typeof assignment.stage3_summary_data === 'string'
                                                            ? JSON.parse(assignment.stage3_summary_data)
                                                            : assignment.stage3_summary_data;
                                                        const ags = s3Summary?.airportGroups || {};
                                                        for (const ag of Object.values(ags)) {
                                                            if (!ag) continue;
                                                            if ((ag.airportName || '').toLowerCase() === (airportName || '').toLowerCase()) {
                                                                const q = getTapeQtyFromAg(ag);
                                                                if (q) return q;
                                                            }
                                                        }
                                                    } catch (e) {
                                                        console.error('Error parsing stage3_summary_data in HTML view (tapeQuantity)', e);
                                                    }
                                                }

                                                // 2) Fallback to stage3_data.airportTapeData by airport name (can be array of tapes)
                                                return getTapeQtyFromTapeData((stage3Data.airportTapeData || {})[airportName]);
                                            })();
                                            const paperPrice = 0;
                                            const tapeCost = tapeUnitPrice * tapeQuantity + paperPrice;

                                            // Dynamic Driver Wage (Relaxed Match)
                                            const driverRateObj = driverRates.find(r => r.deliveryType?.toLowerCase().includes('airport') && r.status === 'Active')
                                                || driverRates.find(r => r.status === 'Active');
                                            const driverWage = driverRateObj ? parseFloat(driverRateObj.amount) : 0;

                                            // Get fuel expense for this driver on the order date
                                            const driverId = data.driverInfo?.did || data.driverInfo?.driver_id || null;
                                            const fuelExpense = driverId ? getFuelExpenseForDriver(driverId, order.order_received_date) : 0;

                                            const totalOverhead = labourCost + pickupCost + tapeCost + driverWage + fuelExpense;

                                            // Totals
                                            const totalExpenses = totalBoxCost + totalOverhead;
                                            const vegExpenses = data.totalAmount;

                                            // Weight Logic
                                            const grossWeight = data.totalWeight;
                                            const tareWeight = (count10kg * 1.5) + (count5kg * 1.0) + (countThermo * 0.5); // Estimate tare based on mix
                                            const netWeight = grossWeight - tareWeight;

                                            const totalExpPerKg = netWeight > 0 ? ((vegExpenses + totalExpenses) / netWeight).toFixed(0) : 0;
                                            const driverNameWithNum = `${(driverName || '').toString().toUpperCase()}`.trim();

                                            // Simple Table UI (1st PDF Style)
                                            return (
                                                <div key={index} className="bg-white border text-xs font-mono mb-8 page-break-inside-avoid w-full">
                                                    {/* Header */}
                                                    <div className="border-b border-black p-2 flex justify-between items-center bg-gray-50">
                                                        <div className="font-bold">{dayName} | {shortDate}</div>
                                                        <div className="text-lg font-bold">{data.airportCode || `GVT ${(index + 1).toString().padStart(3, '0')}`}</div>
                                                        <div className="text-right">
                                                            <div>{data.airportName}</div>
                                                            <div className="text-[10px]">{driverNameWithNum}</div>
                                                        </div>
                                                    </div>

                                                    {/* Main Table */}
                                                    <table className="w-full border-collapse border border-black text-[10px]">
                                                        <thead>
                                                            <tr className="bg-gray-100 border-b border-black">
                                                                <th className="border-r border-black p-1 w-8">S.N</th>
                                                                <th className="border-r border-black p-1 w-8">Box</th>
                                                                <th className="border-r border-black p-1 text-left pl-2">Product</th>
                                                                <th className="border-r border-black p-1 w-12">Kgs</th>
                                                                <th className="border-r border-black p-1 w-12">Rate</th>
                                                                <th className="border-r border-black p-1 w-16 text-right pr-2">Amount</th>
                                                            </tr>
                                                        </thead>
                                                        <tbody>
                                                            {(() => { let _c = 1; return data.products.map((p, i) => {
                                                                const n = parseInt(p.box) || 0;
                                                                const sn = n === 0 ? '-' : (n === 1 ? `${_c}` : `${_c}-${_c + n - 1}`);
                                                                if (n > 0) _c += n;
                                                                return (
                                                                <tr key={i} className="border-b border-gray-300">
                                                                    <td className="border-r border-gray-300 p-1 text-center">{sn}</td>
                                                                    <td className="border-r border-gray-300 p-1 text-center">{p.box}</td>
                                                                    <td className="border-r border-gray-300 p-1 pl-2 font-medium">{p.product}</td>
                                                                    <td className="border-r border-gray-300 p-1 text-center">{(p.netWeight ?? p.grossWeight).toFixed(0)}</td>
                                                                    <td className="border-r border-gray-300 p-1 text-center">{p.rate}</td>
                                                                    <td className="border-r border-gray-300 p-1 text-right pr-2">{p.amount.toFixed(0)}</td>
                                                                </tr>
                                                                ); }); })()}

                                                            {/* Empty Spacer Row if needed */}
                                                            {data.products.length < 3 && <tr className="h-4"><td colSpan="6"></td></tr>}
                                                        </tbody>
                                                    </table>

                                                    {/* Expenses / Packaging Section */}
                                                    <div className="border-t border-black p-0">
                                                        <table className="w-full text-[10px]">
                                                            <tbody>
                                                                <tr className="border-b border-gray-300">
                                                                    <td className="p-1 font-bold w-[40%]">Packaging Costs:</td>
                                                                    <td className="p-1 text-center w-[10%]">Count</td>
                                                                    <td className="p-1 text-center w-[10%]">Rate</td>
                                                                    <td className="p-1 text-right w-[40%] pr-2">Total</td>
                                                                </tr>
                                                                {count10kg > 0 && (
                                                                    <tr className="border-b border-gray-200">
                                                                        <td className="p-1 pl-4">10 KG BOX</td>
                                                                        <td className="p-1 text-center">{count10kg}</td>
                                                                        <td className="p-1 text-center">{price10kg}</td>
                                                                        <td className="p-1 text-right pr-2">{cost10kg}</td>
                                                                    </tr>
                                                                )}
                                                                {count5kg > 0 && (
                                                                    <tr className="border-b border-gray-200">
                                                                        <td className="p-1 pl-4">05 KG BOX</td>
                                                                        <td className="p-1 text-center">{count5kg}</td>
                                                                        <td className="p-1 text-center">{price5kg}</td>
                                                                        <td className="p-1 text-right pr-2">{cost5kg}</td>
                                                                    </tr>
                                                                )}
                                                                {countThermo > 0 && (
                                                                    <tr className="border-b border-gray-200">
                                                                        <td className="p-1 pl-4">THERMO BOX</td>
                                                                        <td className="p-1 text-center">{countThermo}</td>
                                                                        <td className="p-1 text-center">{priceThermo}</td>
                                                                        <td className="p-1 text-right pr-2">{costThermo}</td>
                                                                    </tr>
                                                                )}
                                                                {countNetBag > 0 && (
                                                                    <tr className="border-b border-gray-200">
                                                                        <td className="p-1 pl-4">NET BAG</td>
                                                                        <td className="p-1 text-center">{countNetBag}</td>
                                                                        <td className="p-1 text-center">{priceNetBag}</td>
                                                                        <td className="p-1 text-right pr-2">{costNetBag}</td>
                                                                    </tr>
                                                                )}

                                                                {/* Other Expenses */}
                                                                {/* Show each labour's wage individually using Stage 2 summary data */}
                                                                {uniqueLabours.map((name, idx) => {
                                                                    const wageFromStage2 = stage2LabourWageMap[name];
                                                                    const wage = (typeof wageFromStage2 === 'number' && !isNaN(wageFromStage2))
                                                                        ? wageFromStage2
                                                                        : labourRate; // fallback to avg/default rate
                                                                    return (
                                                                        <tr key={`labour-row-${idx}`} className="border-b border-gray-200">
                                                                            <td className="p-1 pl-4">LABOUR ({name})</td>
                                                                            <td className="p-1 text-center">1</td>
                                                                            <td className="p-1 text-center">{wage}</td>
                                                                            <td className="p-1 text-right pr-2">{wage}</td>
                                                                        </tr>
                                                                    );
                                                                })}
                                                                {/* Driver wage shown as "Driver Name + PICKUP" */}
                                                                <tr className="border-b border-gray-200">
                                                                    <td className="p-1 pl-4" colSpan="3">{driverNameWithNum} PICKUP</td>
                                                                    <td className="p-1 text-right pr-2">{driverWage}</td>
                                                                </tr>
                                                                <tr className="border-b border-gray-200">
                                                                    <td className="p-1 pl-4" colSpan="3">TAPE & PAPER</td>
                                                                    <td className="p-1 text-right pr-2">{tapeCost}</td>
                                                                </tr>
                                                                {fuelExpense > 0 && (
                                                                    <tr className="border-b border-gray-200">
                                                                        <td className="p-1 pl-4" colSpan="3">FUEL EXPENSE</td>
                                                                        <td className="p-1 text-right pr-2">{fuelExpense.toFixed(2)}</td>
                                                                    </tr>
                                                                )}

                                                                {/* Shipment Summary */}
                                                                <tr className="border-t border-gray-400 bg-gray-50">
                                                                    <td className="p-1 font-bold" colSpan="4">Shipment Summary</td>
                                                                </tr>
                                                                <tr className="border-b border-gray-200">
                                                                    <td className="p-1 pl-4" colSpan="3">Total Net Weight</td>
                                                                    <td className="p-1 text-right pr-2">{netWeight.toFixed(0)} kg</td>
                                                                </tr>
                                                                <tr className="border-b border-gray-200">
                                                                    <td className="p-1 pl-4" colSpan="3">Gross Weight</td>
                                                                    <td className="p-1 text-right pr-2">{grossWeight.toFixed(0)} kg</td>
                                                                </tr>
                                                                {count10kg > 0 && (
                                                                    <tr className="border-b border-gray-200">
                                                                        <td className="p-1 pl-4" colSpan="3">10 KG Boxes</td>
                                                                        <td className="p-1 text-right pr-2">{count10kg}</td>
                                                                    </tr>
                                                                )}
                                                                {count5kg > 0 && (
                                                                    <tr className="border-b border-gray-200">
                                                                        <td className="p-1 pl-4" colSpan="3">05 KG Boxes</td>
                                                                        <td className="p-1 text-right pr-2">{count5kg}</td>
                                                                    </tr>
                                                                )}
                                                                {countThermo > 0 && (
                                                                    <tr className="border-b border-gray-200">
                                                                        <td className="p-1 pl-4" colSpan="3">Thermo Boxes</td>
                                                                        <td className="p-1 text-right pr-2">{countThermo}</td>
                                                                    </tr>
                                                                )}
                                                                {countNetBag > 0 && (
                                                                    <tr className="border-b border-gray-200">
                                                                        <td className="p-1 pl-4" colSpan="3">Bags</td>
                                                                        <td className="p-1 text-right pr-2">{countNetBag}</td>
                                                                    </tr>
                                                                )}
                                                                <tr className="border-b border-gray-200">
                                                                    <td className="p-1 pl-4" colSpan="3">Products Used</td>
                                                                    <td className="p-1 text-right pr-2">{data.products.length}</td>
                                                                </tr>

                                                                {/* Grand Totals */}
                                                                <tr className="font-bold bg-gray-100">
                                                                    <td className="p-1 text-right" colSpan="3">TOTAL EXPENSES:</td>
                                                                    <td className="p-1 text-right pr-2">{totalExpenses.toFixed(0)}</td>
                                                                </tr>
                                                                <tr className="font-bold bg-gray-100">
                                                                    <td className="p-1 text-right" colSpan="3">VEG TOTAL:</td>
                                                                    <td className="p-1 text-right pr-2">{vegExpenses.toFixed(0)}</td>
                                                                </tr>
                                                                <tr className="font-black border-t-2 border-black">
                                                                    <td className="p-1 text-right" colSpan="3">GRAND TOTAL PER KG (NET {netWeight.toFixed(0)}kg):</td>
                                                                    <td className="p-1 text-right pr-2 text-lg">{totalExpPerKg}</td>
                                                                </tr>
                                                            </tbody>
                                                        </table>
                                                    </div>
                                                </div>
                                            );
                                        });
                                    })()}
                                </div>
                            ) : (
                                <p className="text-[#6B8782]">No Stage 3 data available</p>
                            )}
                        </div>
                    </div>

                    {/* Stage 4: Final Review & Pricing */}
                    <div className="bg-white rounded-2xl shadow-lg overflow-hidden">
                        <div className="bg-[#0D8568] text-white px-6 py-4">
                            <h2 className="text-xl font-bold">Stage 4: Final Review & Pricing</h2>
                        </div>
                        <div className="p-6">
                            {assignment && assignment.stage4_data ? (
                                <div className="overflow-x-auto">
                                    <table className="w-full">
                                        <thead className="bg-[#0D8568] text-white">
                                            <tr>
                                                <th className="px-4 py-3 text-left">Product</th>
                                                <th className="px-4 py-3 text-left">Net Weight (kg)</th>
                                                <th className="px-4 py-3 text-left">Price/kg (₹)</th>
                                                <th className="px-4 py-3 text-left">Total Amount (₹)</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {(() => {
                                                let stage4Data = typeof assignment.stage4_data === 'string' ? JSON.parse(assignment.stage4_data) : assignment.stage4_data;
                                                let productRows = stage4Data.reviewData?.productRows || stage4Data.productRows || [];
                                                let grandTotal = 0;

                                                const rows = productRows.map((item, idx) => {
                                                    const netWeight = parseFloat(item.net_weight || item.quantity || 0);
                                                    const price = parseFloat(item.price || item.final_price || 0);
                                                    const total = netWeight * price;
                                                    grandTotal += total;

                                                    return (
                                                        <tr key={idx} className="border-b border-[#D0E0DB] hover:bg-[#F0F4F3]">
                                                            <td className="px-4 py-3">{item.product_name || item.product || '-'}</td>
                                                            <td className="px-4 py-3">{netWeight.toFixed(2)}</td>
                                                            <td className="px-4 py-3">{formatCurrency(price)}</td>
                                                            <td className="px-4 py-3 font-semibold">{formatCurrency(total)}</td>
                                                        </tr>
                                                    );
                                                });

                                                rows.push(
                                                    <tr key="total" className="bg-[#D1FAE5] font-bold text-lg">
                                                        <td colSpan="3" className="px-4 py-4 text-right">Grand Total:</td>
                                                        <td className="px-4 py-4 text-[#0D8568]">{formatCurrency(grandTotal)}</td>
                                                    </tr>
                                                );

                                                return rows;
                                            })()}
                                        </tbody>
                                    </table>
                                </div>
                            ) : (
                                <p className="text-[#6B8782]">No Stage 4 data available</p>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ReportFlowerOrderView;