import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import PayoutFilterBar, { PayAllConfirmModal } from '../common/PayoutFilterBar';
import { getAllOrders } from '../../../api/orderApi';
import { getOrderAssignment } from '../../../api/orderAssignmentApi';
import { getAllSuppliers } from '../../../api/supplierApi';
import { getPaidRecords, markAsPaid, markPartialPaid, unmarkAsPaid } from '../../../api/payoutApi';
import PayoutPagination from '../common/PayoutPagination';

import { filterPayoutsByDateRange, buildEntityFilterOptions, usePayoutPayAll, buildPayoutExportSubtitle, exportPayoutExcel, exportPayoutPdf, payoutExportDate, payoutTh, payoutTd, payoutTdNum, payoutTdCenter, payoutBtn, payoutTableWrap, payoutTableScroll, payoutTableBase, payoutThead, payoutTbody, payoutRow, payoutEmptyCell, payoutActionRow, getPayoutStatusClassName } from '../../../components/admin/common/PayoutFilterBar';
import { DEFAULT_PAYOUT_PAGE_SIZE, calcPayoutTotalPages, getPayoutPageSlice } from '../../../components/admin/common/PayoutPagination';
const PayoutSupplier = () => {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSupplierId, setSelectedSupplierId] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = DEFAULT_PAYOUT_PAGE_SIZE;

  const [loading, setLoading] = useState(true);
  const [payouts, setPayouts] = useState([]);
  const [markingPaid, setMarkingPaid] = useState(false);
  const [partialModal, setPartialModal] = useState({ open: false, payout: null });
  const [partialAmount, setPartialAmount] = useState('');
  const [partialNote, setPartialNote] = useState('');

  const formatCurrency = (amount) =>
    `₹${(Number.isFinite(amount) ? amount : 0).toLocaleString('en-IN', {
      maximumFractionDigits: 0,
    })}`;

  const cleanForMatching = (name) =>
    name ? name.replace(/^\d+\s*-\s*/, '').trim() : '';

  useEffect(() => {
    fetchSupplierPayouts();
  }, []);

  const fetchSupplierPayouts = async () => {
    try {
      setLoading(true);
      const [ordersRes, suppliersRes, paidRes] = await Promise.all([
        getAllOrders(),
        getAllSuppliers(),
        getPaidRecords('supplier').catch(() => ({ data: [] })),
      ]);

      const orders = ordersRes?.data || [];
      const suppliers = suppliersRes?.data || [];
      const paidList = paidRes?.data ?? paidRes?.paidRecords ?? paidRes?.records ?? (Array.isArray(paidRes) ? paidRes : []);
      const paidSet = new Set();
      const paidMap = new Map();
      paidList.forEach((item) => {
        const k = item?.reference_key ?? item?.key ?? item?.id ?? (item?.orderId != null && item?.entity_id != null ? `${item.orderId}_${item.entity_id}` : (typeof item === 'string' ? item : null));
        if (k) {
          paidSet.add(k);
          paidMap.set(k, item);
        }
      });
      try {
        const stored = localStorage.getItem('payout-supplier-paid');
        if (stored) {
          const parsed = JSON.parse(stored);
          (Array.isArray(parsed) ? parsed : []).forEach((k) => paidSet.add(k));
        }
      } catch {
        // ignore
      }

      const supplierMap = new Map(suppliers.map((s) => [String(s.sid), s]));

      const processed = [];

      const assignmentPromises = orders.map(async (order) => {
        const assignmentRes = await getOrderAssignment(order.oid).catch(() => null);
        if (!assignmentRes?.data?.product_assignments) return;

        let assignments = [];
        try {
          assignments =
            typeof assignmentRes.data.product_assignments === 'string'
              ? JSON.parse(assignmentRes.data.product_assignments)
              : assignmentRes.data.product_assignments;
        } catch {
          return;
        }

        // Stage 4 data for final pricing
        let stage4Rows = [];
        try {
          if (assignmentRes.data?.stage4_data) {
            const s4 =
              typeof assignmentRes.data.stage4_data === 'string'
                ? JSON.parse(assignmentRes.data.stage4_data)
                : assignmentRes.data.stage4_data;
            stage4Rows = s4.reviewData?.productRows || [];
          }
        } catch {
          // ignore parsing errors
        }

        const groups = {};
        assignments.forEach((a) => {
          if (a.entityType !== 'supplier' || !a.entityId) return;
          const key = String(a.entityId);
          if (!groups[key]) groups[key] = { supplierId: key, assignments: [] };
          groups[key].assignments.push(a);
        });

        Object.values(groups).forEach((group) => {
          const enriched = group.assignments.map((a) => {
            const cleanProd = cleanForMatching(a.product);

            // qty
            let qty = parseFloat(a.assignedQty) || 0;
            if (!qty && order.items) {
              const item = order.items.find(
                (it) =>
                  cleanForMatching(it.product_name || it.product || '') === cleanProd
              );
              if (item) {
                qty =
                  parseFloat(item.net_weight) ||
                  parseFloat(item.quantity) ||
                  0;
              }
            }

            // price
            let price = parseFloat(a.price) || 0;
            if (!price && stage4Rows.length) {
              const s4 = stage4Rows.find((row) => {
                const rowProd = cleanForMatching(row.product || row.product_name || '');
                const assignedTo = row.assignedTo || row.assigned_to || '';
                return (
                  rowProd === cleanProd &&
                  (assignedTo === a.assignedTo || !a.assignedTo)
                );
              });
              if (s4) {
                price = parseFloat(s4.price) || 0;
                if (!qty) {
                  qty =
                    parseFloat(s4.net_weight) ||
                    parseFloat(s4.quantity) ||
                    0;
                }
              }
            }

            return { ...a, assignedQty: qty, price };
          });

          const totalQty = enriched.reduce(
            (sum, a) => sum + (parseFloat(a.assignedQty) || 0),
            0
          );
          const totalAmount = enriched.reduce(
            (sum, a) =>
              sum +
              (parseFloat(a.assignedQty) || 0) * (parseFloat(a.price) || 0),
            0
          );

          if (totalAmount > 0) {
            const supplier = supplierMap.get(group.supplierId);
            const rowId = `${order.oid}_${group.supplierId}`;
            const statusFromOrder = order.payment_status === 'paid' || order.payment_status === 'completed';
            const paymentRecord = paidMap.get(rowId);
            const paymentStatus = String(paymentRecord?.payment_status || '').toLowerCase();
            const partialPaidAmount = parseFloat(
              paymentRecord?.row_data?.partialPaidAmount ??
              paymentRecord?.row_data?.partial_amount ??
              paymentRecord?.partialPaidAmount ??
              paymentRecord?.partial_amount ??
              0
            ) || 0;
            const status = paymentStatus === 'partial'
              ? 'Partial'
              : paidSet.has(rowId)
                ? 'Paid'
                : (statusFromOrder ? 'Paid' : 'Pending');
            processed.push({
              id: rowId,
              orderId: order.oid,
              entity_id: group.supplierId,
              supplierName: supplier?.supplier_name || 'Unknown Supplier',
              supplierCode: supplier?.supplier_id || `SID-${group.supplierId}`,
              lastSupplied: order.order_received_date || order.createdAt,
              quantityKg: totalQty,
              amount: totalAmount,
              status,
              partialPaidAmount,
              remainingAmount: status === 'Partial' ? Math.max(totalAmount - partialPaidAmount, 0) : 0,
            });
          }
        });
      });

      await Promise.all(assignmentPromises);
      const statusOrder = { Pending: 0, Partial: 1, Paid: 2 };
      processed.sort((a, b) => {
        const sa = statusOrder[a.status] ?? 0;
        const sb = statusOrder[b.status] ?? 0;
        if (sa !== sb) return sa - sb;
        return new Date(b.lastSupplied) - new Date(a.lastSupplied);
      });
      setPayouts(processed);
    } catch (e) {
      console.error('Error fetching supplier payouts:', e);
    } finally {
      setLoading(false);
    }
  };

  const supplierFilterOptions = useMemo(
    () =>
      buildEntityFilterOptions(payouts, {
        idField: 'entity_id',
        nameField: 'supplierName',
        codeField: 'supplierCode',
        allLabel: 'All suppliers',
      }),
    [payouts]
  );

  const filteredPayouts = useMemo(() => {
    let list = [...payouts];
    if (fromDate || toDate) {
      list = filterPayoutsByDateRange(list, fromDate, toDate, (p) => p.lastSupplied);
    }
    if (selectedSupplierId) {
      list = list.filter((p) => String(p.entity_id) === selectedSupplierId);
    }
    const q = searchQuery.trim().toLowerCase();
    if (q) {
      list = list.filter(
        (p) =>
          p.supplierName.toLowerCase().includes(q) ||
          p.supplierCode.toLowerCase().includes(q) ||
          String(p.orderId ?? '').toLowerCase().includes(q)
      );
    }
    const statusOrder = { Pending: 0, Partial: 1, Paid: 2 };
    list.sort((a, b) => {
      const sa = statusOrder[a.status] ?? 0;
      const sb = statusOrder[b.status] ?? 0;
      if (sa !== sb) return sa - sb;
      return new Date(b.lastSupplied) - new Date(a.lastSupplied);
    });
    return list;
  }, [payouts, searchQuery, fromDate, toDate, selectedSupplierId]);

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

  const handleExportExcel = () => {
    exportPayoutExcel(
      filteredPayouts.map((p) => ({
        'Supplier Name': p.supplierName,
        'Supplier ID': p.supplierCode,
        'Last Supplied': payoutExportDate(p.lastSupplied),
        'Quantity (kg)': p.quantityKg,
        Amount: p.amount,
        Status: p.status,
      })),
      { sheetName: 'Supplier Payouts', filePrefix: 'Supplier_Payouts' }
    );
  };

  const handleExportPDF = () => {
    exportPayoutPdf({
      title: 'Supplier Payouts',
      subtitle: buildPayoutExportSubtitle({ fromDate, toDate }),
      headers: ['Supplier', 'ID', 'Last Supplied', 'Qty (kg)', 'Amount', 'Status'],
      body: filteredPayouts.map((p) => [
        p.supplierName,
        p.supplierCode,
        payoutExportDate(p.lastSupplied),
        String(p.quantityKg ?? '—'),
        `Rs. ${Number(p.amount || 0).toLocaleString('en-IN')}`,
        p.status,
      ]),
      filePrefix: 'Supplier_Payouts',
    });
  };

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, fromDate, toDate, selectedSupplierId]);

  const totalPages = calcPayoutTotalPages(filteredPayouts.length, itemsPerPage);
  const paginated = getPayoutPageSlice(filteredPayouts, currentPage, itemsPerPage);

  const summary = useMemo(() => {
    const totalPayouts = payouts.length;
    const pending = payouts.filter((p) => p.status === 'Pending').length;

    const now = new Date();
    const from = new Date(now.getFullYear(), now.getMonth(), 1);
    const to = new Date(now.getFullYear(), now.getMonth() + 1, 0);

    let paidThisMonth = 0;
    payouts.forEach((p) => {
      if (p.status === 'Paid') {
        const d = new Date(p.lastSupplied);
        if (d >= from && d <= to) paidThisMonth += p.amount;
      }
    });

    const totalAmount = payouts.reduce((sum, p) => sum + p.amount, 0);
    const averagePayout = totalPayouts ? totalAmount / totalPayouts : 0;

    return { totalPayouts, pending, paidThisMonth, averagePayout };
  }, [payouts]);

  const stats = [
    { label: 'Total Payouts', value: summary.totalPayouts.toString() },
    { label: 'Pending Payouts', value: summary.pending.toString() },
    { label: 'Paid This Month', value: formatCurrency(summary.paidThisMonth) },
    { label: 'Average Payout', value: formatCurrency(summary.averagePayout) },
  ];

  const handleRevert = async (payout) => {
    try {
      setMarkingPaid(true);
      await unmarkAsPaid('supplier', { key: payout.id, id: payout.id, reference_key: payout.id });
      setPayouts((prev) => prev.map((p) => (p.id === payout.id ? { ...p, status: 'Pending', partialPaidAmount: 0, remainingAmount: p.amount } : p)));
    } catch (error) {
      alert(error?.message || error?.error || 'Failed to revert payout');
    } finally {
      setMarkingPaid(false);
    }
  };

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
        supplierName: payout.supplierName,
        supplierCode: payout.supplierCode,
        quantityKg: payout.quantityKg,
        lastSupplied: payout.lastSupplied,
        status: 'Paid',
        ...payout
      };
      await markAsPaid('supplier', rowData);
      setPayouts((prev) => prev.map((p) => (p.id === payout.id ? { ...p, status: 'Paid', partialPaidAmount: 0, remainingAmount: 0 } : p)));
      try {
        const stored = localStorage.getItem('payout-supplier-paid');
        const list = stored ? JSON.parse(stored) : [];
        if (!list.includes(payout.id)) list.push(payout.id);
        localStorage.setItem('payout-supplier-paid', JSON.stringify(list));
      } catch {
        // ignore
      }
    } catch (error) {
      console.error('Error marking supplier payout as paid:', error);
      alert(error?.message || error?.error || 'Failed to mark as paid');
    } finally {
      setMarkingPaid(false);
    }
  };

  const openPartialPaymentModal = (payout) => {
    setPartialAmount('');
    setPartialNote('');
    setPartialModal({ open: true, payout });
  };

  const closePartialPaymentModal = () => {
    setPartialModal({ open: false, payout: null });
    setPartialAmount('');
    setPartialNote('');
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
      await markPartialPaid('supplier', {
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
      closePartialPaymentModal();
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
          supplierName: payout.supplierName,
          supplierCode: payout.supplierCode,
          quantityKg: payout.quantityKg,
          lastSupplied: payout.lastSupplied,
          ...payout
        };
        await markAsPaid('supplier', rowData);
      }
      setPayouts((prev) =>
        prev.map((p) => (pending.some((x) => x.id === p.id) ? { ...p, status: 'Paid', partialPaidAmount: 0, remainingAmount: 0 } : p))
      );
      closePayAllModal(false);
    } catch (error) {
      alert(error?.message || error?.error || 'Failed to pay all');
    } finally {
      setMarkingPaid(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-50 to-teal-50 p-4 sm:p-6 lg:p-8">
      <div className="max-w-7xl mx-auto">
        {/* Tabs */}
        <div className="flex flex-wrap gap-2 mb-6">
          <button
            onClick={() => navigate('/payouts')}
            className="px-5 py-2.5 rounded-lg font-medium transition-all text-sm bg-white text-gray-600 hover:bg-gray-50 border border-gray-200"
          >
            Farmer Payout
          </button>
          <button
            onClick={() => navigate('/payout-supplier')}
            className="px-5 py-2.5 rounded-lg font-medium transition-all text-sm bg-[#0D7C66] text-white shadow-md"
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
                index === 0
                  ? 'bg-gradient-to-r from-[#D1FAE5] to-[#A7F3D0]'
                  : index === 1
                  ? 'bg-gradient-to-r from-[#6EE7B7] to-[#34D399]'
                  : index === 2
                  ? 'bg-gradient-to-r from-[#10B981] to-[#059669]'
                  : 'bg-gradient-to-r from-[#047857] to-[#065F46]'
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
          idPrefix="supplier-payout"
          searchValue={searchQuery}
          onSearchChange={setSearchQuery}
          searchPlaceholder="Supplier name or ID..."
          fromDate={fromDate}
          onFromDateChange={setFromDate}
          toDate={toDate}
          onToDateChange={setToDate}
          entityFilter={{
            label: 'Supplier',
            value: selectedSupplierId,
            onChange: setSelectedSupplierId,
            options: supplierFilterOptions,
          }}
          onClear={() => {
            setSearchQuery('');
            setFromDate('');
            setToDate('');
            setSelectedSupplierId('');
          }}
          onPayAll={openPayAllModal}
          payAllDisabled={payAllTargets.length === 0}
          payAllLoading={markingPaid}
          onExportPDF={handleExportPDF}
          onExportExcel={handleExportExcel}
        />

        <div className={payoutTableWrap}>
          <div className={payoutTableScroll}>
            <table className={`${payoutTableBase} min-w-[900px]`}>
              <colgroup>
                <col style={{ width: '28%' }} />
                <col style={{ width: '10%' }} />
                <col style={{ width: '12%' }} />
                <col style={{ width: '12%' }} />
                <col style={{ width: '14%' }} />
                <col style={{ width: '24%' }} />
              </colgroup>
              <thead className={payoutThead}>
                <tr>
                  <th className={`${payoutTh} text-left`}>Supplier</th>
                  <th className={`${payoutTh} text-left`}>ID</th>
                  <th className={`${payoutTh} text-right`}>Qty (kg)</th>
                  <th className={`${payoutTh} text-right`}>Amount</th>
                  <th className={`${payoutTh} text-center`}>Status</th>
                  <th className={`${payoutTh} text-center`}>Action</th>
                </tr>
              </thead>
              <tbody className={payoutTbody}>
                {loading ? (
                  <tr><td colSpan={6} className={payoutEmptyCell}>Loading supplier payouts...</td></tr>
                ) : !paginated.length ? (
                  <tr><td colSpan={6} className={payoutEmptyCell}>No supplier payouts found</td></tr>
                ) : (
                  paginated.map((payout, index) => (
                    <tr key={payout.id} className={payoutRow(index)}>
                      <td className={payoutTd}>
                        <div className="font-semibold leading-snug">{payout.supplierName}</div>
                        <div className="text-xs text-[#6B8782] mt-0.5">
                          Last: {payout.lastSupplied ? new Date(payout.lastSupplied).toLocaleDateString('en-IN') : '—'}
                        </div>
                      </td>
                      <td className={`${payoutTd} font-medium`}>{payout.supplierCode}</td>
                      <td className={payoutTdNum}>{payout.quantityKg.toFixed(2)}</td>
                      <td className={`${payoutTdNum} font-bold`}>{formatCurrency(payout.amount)}</td>
                      <td className={payoutTdCenter}>
                        <span className={`inline-flex px-2.5 py-1 rounded-full text-xs font-semibold ${getPayoutStatusClassName(payout.status)}`}>{payout.status}</span>
                        {payout.status === 'Partial' && (
                          <div className="mt-1 text-[10px] text-[#6B8782] leading-tight">
                            Paid {formatCurrency(payout.partialPaidAmount || 0)}<br />Bal {formatCurrency(payout.remainingAmount || getBalanceAmount(payout))}
                          </div>
                        )}
                      </td>
                      <td className={`${payoutTdCenter} whitespace-nowrap`}>
                        <div className={payoutActionRow}>
                          {payout.status === 'Paid' ? (
                            <button type="button" onClick={() => handleRevert(payout)} disabled={markingPaid} className={payoutBtn.revert}>Revert</button>
                          ) : (
                            <>
                              <button type="button" onClick={() => openPartialPaymentModal(payout)} disabled={markingPaid} className={payoutBtn.partial}>Partial</button>
                              <button type="button" onClick={() => handlePay(payout)} disabled={markingPaid} className={payoutBtn.pay}>
                                {markingPaid ? '…' : payout.status === 'Partial' ? `Pay Bal ${formatCurrency(getBalanceAmount(payout))}` : 'Pay'}
                              </button>
                            </>
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
            onPageChange={setCurrentPage}
            onClampPage={setCurrentPage}
            itemLabel="suppliers"
          />
        </div>
        <PayAllConfirmModal
          open={payAllModalOpen}
          fromDate={fromDate}
          toDate={toDate}
          rows={payAllSelected}
          entityColumnLabel="Supplier"
          getEntityPrimary={(p) => p.supplierName}
          getEntitySecondary={(p) => p.supplierCode}
          getRowDate={(p) => p.lastSupplied}
          getRowKey={resolveKey}
          getBalanceAmount={getBalanceAmount}
          onRemove={removeFromPayAll}
          onClose={() => closePayAllModal(markingPaid)}
          onConfirm={confirmPayAll}
          loading={markingPaid}
        />
        {partialModal.open && partialModal.payout && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
            <div className="w-full max-w-md bg-white rounded-xl shadow-xl p-5">
              <h3 className="text-lg font-semibold text-[#0D5C4D] mb-1">Partial Payment</h3>
              <p className="text-sm text-[#6B8782] mb-4">
                {partialModal.payout.supplierName} — Total {formatCurrency(partialModal.payout.amount)}
              </p>
              {Number(partialModal.payout.partialPaidAmount || 0) > 0 && (
                <p className="text-xs text-[#0D5C4D] mb-3">
                  Paid: {formatCurrency(partialModal.payout.partialPaidAmount || 0)} | Balance: {formatCurrency(getBalanceAmount(partialModal.payout))}
                </p>
              )}
              <div className="space-y-3">
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={partialAmount}
                  onChange={(e) => setPartialAmount(e.target.value)}
                  placeholder="Partial amount"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                />
                <textarea
                  value={partialNote}
                  onChange={(e) => setPartialNote(e.target.value)}
                  placeholder="Note (optional)"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm min-h-[84px]"
                />
              </div>
              <div className="mt-4 flex justify-end gap-2">
                <button type="button" onClick={closePartialPaymentModal} className="px-4 py-2 border rounded-lg text-sm">Cancel</button>
                <button type="button" onClick={handlePartialPay} disabled={markingPaid} className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm disabled:opacity-50">
                  {markingPaid ? 'Saving...' : 'Save Partial'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default PayoutSupplier;