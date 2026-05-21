import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import PayoutFilterBar, { PayAllConfirmModal } from '../common/PayoutFilterBar';
import { getAllOrders } from '../../../api/orderApi';
import { getOrderAssignment } from '../../../api/orderAssignmentApi';
import { getAllFarmers } from '../../../api/farmerApi';
import { getPaidRecords, markAsPaid, unmarkAsPaid, markPartialPaid } from '../../../api/payoutApi';
import PayoutPagination from '../common/PayoutPagination';

import { sortPayoutsByStatus, filterPayoutsByDateRange, buildEntityFilterOptions, usePayoutPayAll, buildPayoutExportSubtitle, exportPayoutExcel, exportPayoutPdf, payoutExportDate, payoutTh, payoutTd, payoutTdNum, payoutTdCenter, payoutBtn, payoutTableWrap, payoutTableScroll, payoutTableBase, payoutThead, payoutTbody, payoutRow, payoutEmptyCell, payoutActionRow, getPayoutStatusClassName } from '../../../components/admin/common/PayoutFilterBar';
import { DEFAULT_PAYOUT_PAGE_SIZE, calcPayoutTotalPages, getPayoutPageSlice } from '../../../components/admin/common/PayoutPagination';
const PayoutManagement = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const pageFromUrl = Math.max(1, parseInt(searchParams.get('page') || '1', 10) || 1);
  const [activeTab, setActiveTab] = useState('farmer');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFarmerId, setSelectedFarmerId] = useState('');
  const skipFilterPageReset = useRef(true);
  const [currentPage, setCurrentPage] = useState(pageFromUrl);
  const itemsPerPage = DEFAULT_PAYOUT_PAGE_SIZE;

  useEffect(() => {
    setCurrentPage(pageFromUrl);
  }, [pageFromUrl]);

  const setPage = useCallback((page) => {
    const safePage = Math.max(1, page);
    setCurrentPage(safePage);
    setSearchParams(prev => {
      const next = new URLSearchParams(prev);
      if (safePage === 1) next.delete('page');
      else next.set('page', String(safePage));
      return next;
    });
  }, [setSearchParams]);

  const [loading, setLoading] = useState(true);
  const [payouts, setPayouts] = useState([]); // farmer payouts only
  const [markingPaid, setMarkingPaid] = useState(false);
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [partialModal, setPartialModal] = useState({ open: false, payout: null });
  const [partialAmount, setPartialAmount] = useState('');
  const [partialNote, setPartialNote] = useState('');

  const formatCurrency = (amount) => {
    const value = Number.isFinite(amount) ? amount : 0;
    return `₹${value.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;
  };

  const cleanForMatching = (name) => {
    if (!name) return '';
    // Remove any numeric prefix like "1 - " used in some product names
    return name.replace(/^\d+\s*-\s*/, '').trim();
  };

  useEffect(() => {
    fetchFarmerPayouts();
  }, []);

  const fetchFarmerPayouts = async () => {
    try {
      setLoading(true);
      const [ordersRes, farmersRes, paidRes] = await Promise.all([
        getAllOrders(),
        getAllFarmers(),
        getPaidRecords('farmer').catch(() => ({ data: [] }))
      ]);

      const orders = ordersRes?.data || [];
      const farmers = farmersRes?.data || [];

      const paidSet = new Set();
      try {
        const paidList = paidRes?.data ?? paidRes?.paidRecords ?? paidRes?.records ?? (Array.isArray(paidRes) ? paidRes : []);
        paidList.forEach((item) => {
          const k = item?.reference_key ?? item?.key ?? item?.id ?? (item?.orderId != null && item?.entity_id != null ? `${item.orderId}_${item.entity_id}` : (typeof item === 'string' ? item : null));
          if (k) paidSet.add(k);
        });
        const stored = localStorage.getItem('payout-farmer-paid');
        if (stored) {
          try {
            JSON.parse(stored).forEach((k) => paidSet.add(k));
          } catch {
            // ignore
          }
        }
      } catch {
        // ignore
      }

      const farmerMap = new Map(
        farmers.map(f => [String(f.fid), f])
      );

      const processedPayouts = [];

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

          // Get Stage 4 data for final pricing (net weight × price)
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
            console.error('Error parsing stage4_data for payouts:', e);
          }

          // Group by farmer only
          const farmerGroups = {};
          assignments.forEach(assignment => {
            if (assignment.entityType !== 'farmer' || !assignment.entityId) return;

            const key = String(assignment.entityId);
            if (!farmerGroups[key]) {
              farmerGroups[key] = {
                farmerId: key,
                assignments: []
              };
            }
            farmerGroups[key].assignments.push(assignment);
          });

          Object.values(farmerGroups).forEach(group => {
            // Enrich assignments with final quantity and price using Stage 4 where needed
            const enrichedAssignments = group.assignments.map(a => {
              const cleanAssignmentProduct = cleanForMatching(a.product);

              // Quantity: prefer assignedQty; if missing, fallback to order items/net weight
              let qty = parseFloat(a.assignedQty) || 0;
              if (!qty) {
                const matchingItem = order.items?.find(item => {
                  const itemProduct = item.product_name || item.product || '';
                  return cleanForMatching(itemProduct) === cleanAssignmentProduct;
                });
                if (matchingItem) {
                  qty = parseFloat(matchingItem.net_weight) || parseFloat(matchingItem.quantity) || 0;
                }
              }

              // Price: prefer assignment.price; if missing, fallback to Stage 4 final price
              let price = parseFloat(a.price) || 0;
              if (!price && stage4ProductRows.length > 0) {
                const stage4Entry = stage4ProductRows.find(s4 => {
                  const s4Product = cleanForMatching(s4.product || s4.product_name || '');
                  const s4AssignedTo = s4.assignedTo || s4.assigned_to || '';
                  return (
                    s4Product === cleanAssignmentProduct &&
                    (s4AssignedTo === a.assignedTo || !a.assignedTo)
                  );
                });
                if (stage4Entry) {
                  price = parseFloat(stage4Entry.price) || 0;
                  // If qty still zero, use Stage 4 net weight
                  if (!qty) {
                    qty =
                      parseFloat(stage4Entry.net_weight) ||
                      parseFloat(stage4Entry.quantity) ||
                      0;
                  }
                }
              }

              return { ...a, assignedQty: qty, price };
            });

            const totalQty = enrichedAssignments.reduce(
              (sum, a) => sum + (parseFloat(a.assignedQty) || 0),
              0
            );
            const totalAmount = enrichedAssignments.reduce(
              (sum, a) => sum + (parseFloat(a.assignedQty) || 0) * (parseFloat(a.price) || 0),
              0
            );

            if (totalAmount > 0) {
              const farmer = farmerMap.get(group.farmerId);
              const rowId = `${order.oid}_${group.farmerId}`;
              const statusFromOrder = order.payment_status === 'paid' || order.payment_status === 'completed';
              processedPayouts.push({
                id: rowId,
                orderId: order.oid,
                entity_id: group.farmerId,
                farmerName: farmer?.farmer_name || 'Unknown Farmer',
                farmerCode: farmer?.farmer_id || `FID-${group.farmerId}`,
                lastSupplied: order.order_received_date || order.createdAt,
                quantityKg: totalQty,
                amount: totalAmount,
                status: paidSet.has(rowId) ? 'Paid' : (statusFromOrder ? 'Paid' : 'Pending')
              });
            }
          });
        } catch (error) {
          console.error(`Error processing order ${order.oid} for farmer payouts:`, error);
        }
      });

      await Promise.all(assignmentPromises);

      // Sort by date newest first
      processedPayouts.sort((a, b) => new Date(b.lastSupplied) - new Date(a.lastSupplied));

      setPayouts(processedPayouts);
    } catch (error) {
      console.error('Error fetching farmer payouts:', error);
    } finally {
      setLoading(false);
    }
  };

  const farmerFilterOptions = useMemo(
    () =>
      buildEntityFilterOptions(payouts, {
        idField: 'entity_id',
        nameField: 'farmerName',
        codeField: 'farmerCode',
        allLabel: 'All farmers',
      }),
    [payouts]
  );

  const filteredPayouts = useMemo(() => {
    let list = [...payouts];
    if (fromDate || toDate) {
      list = filterPayoutsByDateRange(list, fromDate, toDate, (p) => p.lastSupplied);
    }
    if (selectedFarmerId) {
      list = list.filter((p) => String(p.entity_id) === selectedFarmerId);
    }
    const query = searchQuery.trim().toLowerCase();
    if (query) {
      list = list.filter(
        (p) =>
          p.farmerName.toLowerCase().includes(query) ||
          p.farmerCode.toLowerCase().includes(query) ||
          String(p.id).toLowerCase().includes(query) ||
          String(p.orderId ?? '').toLowerCase().includes(query)
      );
    }
    return sortPayoutsByStatus(list);
  }, [payouts, searchQuery, fromDate, toDate, selectedFarmerId]);

  const {
    payAllModalOpen,
    payAllSelected,
    payAllTargets,
    openPayAllModal,
    closePayAllModal,
    removeFromPayAll,
    getBalanceAmount,
    resolveKey,
  } = usePayoutPayAll(filteredPayouts, { totalField: 'amount' });

  useEffect(() => {
    if (skipFilterPageReset.current) {
      skipFilterPageReset.current = false;
      return;
    }
    setPage(1);
  }, [searchQuery, fromDate, toDate, selectedFarmerId, setPage]);

  const totalPages = calcPayoutTotalPages(filteredPayouts.length, itemsPerPage);
  const paginatedPayouts = getPayoutPageSlice(filteredPayouts, currentPage, itemsPerPage);

  const summaryStats = useMemo(() => {
    const totalPayouts = payouts.length;
    const pending = payouts.filter(p => p.status === 'Pending').length;

    const now = new Date();
    const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const currentMonthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);

    let paidThisMonthAmount = 0;
    payouts.forEach(p => {
      if (p.status === 'Paid') {
        const d = new Date(p.lastSupplied);
        if (d >= currentMonthStart && d <= currentMonthEnd) {
          paidThisMonthAmount += p.amount;
        }
      }
    });

    const totalAmount = payouts.reduce((sum, p) => sum + p.amount, 0);
    const averagePayout = totalPayouts > 0 ? totalAmount / totalPayouts : 0;

    return {
      totalPayouts,
      pending,
      paidThisMonthAmount,
      averagePayout
    };
  }, [payouts]);

  const stats = [
    { label: 'Total Payouts', value: summaryStats.totalPayouts.toString() },
    { label: 'Pending Payouts', value: summaryStats.pending.toString() },
    { label: 'Paid This Month', value: formatCurrency(summaryStats.paidThisMonthAmount) },
    { label: 'Average Payout', value: formatCurrency(summaryStats.averagePayout) }
  ];

  const handlePay = async (payout) => {
    if (payout.status === 'Paid') return;
    try {
      setMarkingPaid(true);
      const rowData = {
        key: payout.id,
        id: payout.id,
        entity_id: payout.entity_id ?? payout.id.split('_')[1],
        orderId: payout.orderId ?? payout.id.split('_')[0],
        amount: Number(payout.amount) || 0,
        farmerName: payout.farmerName,
        farmerCode: payout.farmerCode,
        quantityKg: payout.quantityKg,
        lastSupplied: payout.lastSupplied,
        status: 'Paid',
        ...payout
      };
      await markAsPaid('farmer', rowData);
      setPayouts((prev) => prev.map((p) => (p.id === payout.id ? { ...p, status: 'Paid', partialPaidAmount: 0, remainingAmount: 0 } : p)));
    } catch (error) {
      console.error('Error marking farmer payout as paid:', error);
      alert(error?.message || error?.error || 'Failed to mark as paid');
    } finally {
      setMarkingPaid(false);
    }
  };

  const handleRevert = async (payout) => {
    try {
      setMarkingPaid(true);
      await unmarkAsPaid('farmer', { key: payout.id, id: payout.id, reference_key: payout.id });
      setPayouts((prev) => prev.map((p) => (p.id === payout.id ? { ...p, status: 'Pending', partialPaidAmount: 0, remainingAmount: p.amount } : p)));
    } catch (error) {
      alert(error?.message || error?.error || 'Failed to revert payout');
    } finally {
      setMarkingPaid(false);
    }
  };

  const handlePartialPay = async () => {
    if (!partialModal.payout) return;
    const payout = partialModal.payout;
    const entered = Number(partialAmount);
    const alreadyPaid = Number(payout.partialPaidAmount || 0);
    const total = Number(payout.amount || 0);
    if (!Number.isFinite(entered) || entered <= 0) {
      alert('Enter a valid partial amount');
      return;
    }
    const cumulative = alreadyPaid + entered;
    if (total > 0 && cumulative >= total) {
      alert('Total partial paid must be less than total payout');
      return;
    }
    try {
      setMarkingPaid(true);
      await markPartialPaid('farmer', {
        key: payout.id,
        id: payout.id,
        entity_id: payout.entity_id,
        amount: total,
        partial_amount: entered,
        partial_paid_total: cumulative,
        note: partialNote
      });
      setPayouts((prev) =>
        prev.map((p) =>
          p.id === payout.id
            ? { ...p, status: 'Partial', partialPaidAmount: cumulative, remainingAmount: Math.max(total - cumulative, 0) }
            : p
        )
      );
      setPartialModal({ open: false, payout: null });
      setPartialAmount('');
      setPartialNote('');
    } catch (error) {
      alert(error?.message || error?.error || 'Failed to save partial payment');
    } finally {
      setMarkingPaid(false);
    }
  };

  const confirmPayAll = async () => {
    const pending = payAllSelected;
    if (pending.length === 0) return;
    setMarkingPaid(true);
    try {
      for (const payout of pending) {
        const rowData = {
          key: payout.id,
          id: payout.id,
          entity_id: payout.entity_id ?? payout.id.split('_')[1],
          orderId: payout.orderId ?? payout.id.split('_')[0],
          amount: Number(payout.amount) || 0,
          farmerName: payout.farmerName,
          farmerCode: payout.farmerCode,
          quantityKg: payout.quantityKg,
          lastSupplied: payout.lastSupplied,
          ...payout
        };
        await markAsPaid('farmer', rowData);
      }
      setPayouts((prev) =>
        prev.map((p) => {
          const inList = pending.some((x) => x.id === p.id);
          return inList ? { ...p, status: 'Paid', partialPaidAmount: 0, remainingAmount: 0 } : p;
        })
      );
      closePayAllModal(false);
    } catch (error) {
      alert(error?.message || error?.error || 'Failed to pay all');
    } finally {
      setMarkingPaid(false);
    }
  };

  const handleExportExcel = () => {
    exportPayoutExcel(
      filteredPayouts.map((p) => ({
        'Farmer Name': p.farmerName,
        'Farmer ID': p.farmerCode,
        'Last Supplied': payoutExportDate(p.lastSupplied),
        'Quantity (kg)': p.quantityKg,
        Amount: p.amount,
        Status: p.status,
      })),
      { sheetName: 'Farmer Payouts', filePrefix: 'Farmer_Payouts' }
    );
  };

  const handleExportPDF = () => {
    exportPayoutPdf({
      title: 'Farmer Payouts',
      subtitle: buildPayoutExportSubtitle({ fromDate, toDate }),
      headers: ['Farmer', 'ID', 'Last Supplied', 'Qty (kg)', 'Amount', 'Status'],
      body: filteredPayouts.map((p) => [
        p.farmerName,
        p.farmerCode,
        payoutExportDate(p.lastSupplied),
        String(p.quantityKg ?? '—'),
        `Rs. ${Number(p.amount || 0).toLocaleString('en-IN')}`,
        p.status,
      ]),
      filePrefix: 'Farmer_Payouts',
    });
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-50 to-teal-50 p-4 sm:p-6 lg:p-8">
      <div className="max-w-7xl mx-auto">
        
        {/* Tabs */}
        <div className="flex flex-wrap gap-2 mb-6">
          <button
            onClick={() => setActiveTab('farmer')}
            className={`px-5 py-2.5 rounded-lg font-medium transition-all text-sm ${
              activeTab === 'farmer'
                ? 'bg-[#0D7C66] text-white shadow-md'
                : 'bg-white text-gray-600 hover:bg-gray-50 border border-gray-200'
            }`}
          >
            Farmer Payout
          </button>
          <button
            onClick={() => navigate('/payout-supplier')}
            className="px-5 py-2.5 rounded-lg font-medium transition-all text-sm bg-white text-gray-600 hover:bg-gray-50 border border-gray-200"
          >
            Supplier Payout
          </button>
          <button
            onClick={() => navigate('/payout-thirdparty')}
            className="px-5 py-2.5 rounded-lg font-medium transition-all text-sm bg-white text-gray-600 hover:bg-gray-50 border border-gray-200"
          >
            Third Party Payout
          </button>
          <button
            onClick={() => navigate('/payout-labour')}
            className="px-5 py-2.5 rounded-lg font-medium transition-all text-sm bg-white text-gray-600 hover:bg-gray-50 border border-gray-200"
          >
            Labour Payout
          </button>
          <button
            onClick={() => navigate('/payout-driver')}
            className="px-5 py-2.5 rounded-lg font-medium transition-all text-sm bg-white text-gray-600 hover:bg-gray-50 border border-gray-200"
          >
            Driver Payout
          </button>
        </div>

        {/* Statistics Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          {stats.map((stat, index) => (
            <div 
              key={index} 
              className={`${
                index === 0 ? 'bg-gradient-to-r from-[#D1FAE5] to-[#A7F3D0]' :
                index === 1 ? 'bg-gradient-to-r from-[#6EE7B7] to-[#34D399]' :
                index === 2 ? 'bg-gradient-to-r from-[#10B981] to-[#059669]' :
                'bg-gradient-to-r from-[#047857] to-[#065F46]'
              } rounded-2xl p-6 ${
                index === 2 || index === 3 ? 'text-white' : 'text-[#0D5C4D]'
              }`}
            >
              <div className="text-sm font-medium mb-2 opacity-90">{stat.label}</div>
              <div className="text-4xl font-bold">{stat.value}</div>
            </div>
          ))}
        </div>

        <PayoutFilterBar
          idPrefix="farmer-payout"
          searchValue={searchQuery}
          onSearchChange={setSearchQuery}
          searchPlaceholder="Order ID, farmer name..."
          fromDate={fromDate}
          onFromDateChange={setFromDate}
          toDate={toDate}
          onToDateChange={setToDate}
          entityFilter={{
            label: 'Farmer',
            value: selectedFarmerId,
            onChange: setSelectedFarmerId,
            options: farmerFilterOptions,
          }}
          onClear={() => {
            setSearchQuery('');
            setFromDate('');
            setToDate('');
            setSelectedFarmerId('');
          }}
          onPayAll={openPayAllModal}
          payAllDisabled={payAllTargets.length === 0}
          payAllLoading={markingPaid}
          onExportPDF={handleExportPDF}
          onExportExcel={handleExportExcel}
        />

        <div className={payoutTableWrap}>
          <div className={payoutTableScroll}>
            <table className={`${payoutTableBase} table-fixed w-full min-w-[720px]`}>
              <colgroup>
                <col style={{ width: '20%' }} />
                <col style={{ width: '20%' }} />
                <col style={{ width: '20%' }} />
                <col style={{ width: '20%' }} />
                <col style={{ width: '20%' }} />
              </colgroup>
              <thead className={payoutThead}>
                <tr>
                  <th className={`${payoutTh} text-left`}>Farmer</th>
                  <th className={`${payoutTh} text-right`}>Qty (kg)</th>
                  <th className={`${payoutTh} text-right`}>Amount</th>
                  <th className={`${payoutTh} text-center`}>Status</th>
                  <th className={`${payoutTh} text-center`}>Action</th>
                </tr>
              </thead>
              <tbody className={payoutTbody}>
                {loading ? (
                  <tr>
                    <td colSpan={5} className={payoutEmptyCell}>Loading farmer payouts...</td>
                  </tr>
                ) : paginatedPayouts.length === 0 ? (
                  <tr>
                    <td colSpan={5} className={payoutEmptyCell}>No farmer payouts found</td>
                  </tr>
                ) : (
                  paginatedPayouts.map((payout, index) => (
                    <tr key={payout.id} className={payoutRow(index)}>
                      <td className={payoutTd}>
                        <div className="font-semibold leading-snug">{payout.farmerName}</div>
                        <div className="text-xs text-[#6B8782] mt-0.5">
                          Last: {payout.lastSupplied ? new Date(payout.lastSupplied).toLocaleDateString('en-IN') : '—'}
                        </div>
                      </td>
                      <td className={payoutTdNum}>{payout.quantityKg.toFixed(2)}</td>
                      <td className={`${payoutTdNum} font-bold`}>{formatCurrency(payout.amount)}</td>
                      <td className={payoutTdCenter}>
                        <span className={`inline-flex px-2.5 py-1 rounded-full text-xs font-semibold ${getPayoutStatusClassName(payout.status)}`}>
                          {payout.status}
                        </span>
                        {payout.status === 'Partial' && (
                          <div className="mt-1 text-[10px] text-[#6B8782] leading-tight">
                            Paid {formatCurrency(payout.partialPaidAmount || 0)}
                            <br />
                            Bal {formatCurrency(payout.remainingAmount || getBalanceAmount(payout))}
                          </div>
                        )}
                      </td>
                      <td className={`${payoutTdCenter} whitespace-nowrap`}>
                        <div className={payoutActionRow}>
                          {payout.status !== 'Paid' && (
                            <>
                              <button type="button" onClick={() => { setPartialModal({ open: true, payout }); setPartialAmount(''); setPartialNote(''); }} disabled={markingPaid} className={payoutBtn.partial}>Partial</button>
                              <button type="button" onClick={() => handlePay(payout)} disabled={markingPaid} className={payoutBtn.pay}>
                                {payout.status === 'Partial' ? `Pay Bal ${formatCurrency(getBalanceAmount(payout))}` : 'Pay'}
                              </button>
                            </>
                          )}
                          {(payout.status === 'Paid' || payout.status === 'Partial') && (
                            <button type="button" onClick={() => handleRevert(payout)} disabled={markingPaid} className={payoutBtn.revert}>Revert</button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>



          <PayoutPagination
            currentPage={currentPage}
            totalPages={totalPages}
            totalItems={filteredPayouts.length}
            itemsPerPage={itemsPerPage}
            onPageChange={setPage}
            onClampPage={setPage}
            itemLabel="farmers"
          />
        </div>
      </div>

      <PayAllConfirmModal
        open={payAllModalOpen}
        fromDate={fromDate}
        toDate={toDate}
        rows={payAllSelected}
        entityColumnLabel="Farmer"
        getEntityPrimary={(p) => p.farmerName}
        getEntitySecondary={(p) => p.farmerCode}
        getRowDate={(p) => p.lastSupplied}
        getRowKey={resolveKey}
        getBalanceAmount={getBalanceAmount}
        onRemove={removeFromPayAll}
        onClose={() => closePayAllModal(markingPaid)}
        onConfirm={confirmPayAll}
        loading={markingPaid}
      />
      {partialModal.open && partialModal.payout && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-md">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Partial payment</h3>
            <p className="text-sm text-gray-600 mb-4">
              {partialModal.payout.farmerName} — Total {formatCurrency(partialModal.payout.amount)}
            </p>
            {Number(partialModal.payout.partialPaidAmount || 0) > 0 && (
              <p className="text-xs text-[#0D5C4D] mb-3">
                Paid: {formatCurrency(partialModal.payout.partialPaidAmount || 0)} | Balance: {formatCurrency(getBalanceAmount(partialModal.payout))}
              </p>
            )}
            <input
              type="number"
              min="0"
              value={partialAmount}
              onChange={(e) => setPartialAmount(e.target.value)}
              placeholder="Amount"
              className="w-full mb-3 px-3 py-2 border border-gray-300 rounded-lg"
            />
            <input
              type="text"
              value={partialNote}
              onChange={(e) => setPartialNote(e.target.value)}
              placeholder="Note (optional)"
              className="w-full mb-4 px-3 py-2 border border-gray-300 rounded-lg"
            />
            <div className="flex gap-2 justify-end">
              <button type="button" onClick={() => setPartialModal({ open: false, payout: null })} className="px-4 py-2 border rounded-lg">
                Cancel
              </button>
              <button type="button" onClick={handlePartialPay} disabled={markingPaid} className="px-4 py-2 bg-blue-600 text-white rounded-lg disabled:opacity-50">
                Save
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PayoutManagement;