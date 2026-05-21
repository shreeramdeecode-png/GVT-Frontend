import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import PayoutFilterBar, { PayAllConfirmModal } from '../common/PayoutFilterBar';
import { getAllOrders } from '../../../api/orderApi';
import { getOrderAssignment } from '../../../api/orderAssignmentApi';
import { getAllSuppliers, getSupplierById } from '../../../api/supplierApi';
import { getPaidRecords, markAsPaid, markPartialPaid, unmarkAsPaid } from '../../../api/payoutApi';
import PayoutPagination from '../common/PayoutPagination';

import { sortPayoutsByStatus, filterPayoutsByDateRange, usePayoutPayAll, buildPayoutExportSubtitle, exportPayoutExcel, exportPayoutPdf, payoutExportDate, payoutTh, payoutTd, payoutTdNum, payoutTdCenter, payoutBtn, payoutTableWrap, payoutTableScroll, payoutTableBase, payoutThead, payoutTbody, payoutRow, payoutEmptyCell, payoutActionRow, getPayoutStatusClassName } from '../../../components/admin/common/PayoutFilterBar';
import { DEFAULT_PAYOUT_PAGE_SIZE, calcPayoutTotalPages, getPayoutPageSlice } from '../../../components/admin/common/PayoutPagination';
const cleanForMatching = (name) => {
  if (!name) return '';
  return name.replace(/^\d+\s*-\s*/, '').trim();
};

const ITEMS_PER_PAGE = DEFAULT_PAYOUT_PAGE_SIZE;

const SupplierPayout = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const supplierId = String(id || '');

  const [supplier, setSupplier] = useState(null);
  const [payouts, setPayouts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [markingPaid, setMarkingPaid] = useState(false);
  const [partialModal, setPartialModal] = useState({ open: false, payout: null });
  const [partialAmount, setPartialAmount] = useState('');
  const [partialNote, setPartialNote] = useState('');

  useEffect(() => {
    if (!supplierId) {
      setLoading(false);
      return;
    }
    fetchSupplierPayouts();
  }, [supplierId]);

  const fetchSupplierPayouts = async () => {
    if (!supplierId) return;
    try {
      setLoading(true);
      const [ordersRes, suppliersRes, supplierRes, paidRes] = await Promise.all([
        getAllOrders().catch(() => ({ data: [] })),
        getAllSuppliers().catch(() => ({ data: [] })),
        getSupplierById(supplierId).catch(() => null),
        getPaidRecords('supplier', { entity_id: supplierId }).catch(() => ({ data: [] }))
      ]);

      const orders = ordersRes?.data || ordersRes || [];
      const suppliers = suppliersRes?.data || suppliersRes || [];
      const supplierData = supplierRes?.data ?? supplierRes ?? suppliers.find((s) => String(s.sid) === supplierId);
      setSupplier(supplierData || null);

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
      const processedPayouts = [];

      const assignmentPromises = orders.map(async (order) => {
        try {
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

          let stage4ProductRows = [];
          try {
            if (assignmentRes.data?.stage4_data) {
              const stage4Data =
                typeof assignmentRes.data.stage4_data === 'string'
                  ? JSON.parse(assignmentRes.data.stage4_data)
                  : assignmentRes.data.stage4_data;
              if (stage4Data?.reviewData?.productRows) {
                stage4ProductRows = stage4Data.reviewData.productRows;
              }
            }
          } catch {
            // ignore
          }

          const supplierGroups = {};
          assignments.forEach((assignment) => {
            if (assignment.entityType !== 'supplier' || !assignment.entityId) return;
            const key = String(assignment.entityId);
            if (!supplierGroups[key]) {
              supplierGroups[key] = { supplierId: key, assignments: [] };
            }
            supplierGroups[key].assignments.push(assignment);
          });

          const group = supplierGroups[supplierId];
          if (!group) return;

          const enrichedAssignments = group.assignments.map((a) => {
            const cleanAssignmentProduct = cleanForMatching(a.product);
            let qty = parseFloat(a.assignedQty) || 0;
            if (!qty && order.items) {
              const matchingItem = order.items.find((item) => {
                const itemProduct = item.product_name || item.product || '';
                return cleanForMatching(itemProduct) === cleanAssignmentProduct;
              });
              if (matchingItem) {
                qty = parseFloat(matchingItem.net_weight) || parseFloat(matchingItem.quantity) || 0;
              }
            }
            let price = parseFloat(a.price) || 0;
            if (!price && stage4ProductRows.length > 0) {
              const stage4Entry = stage4ProductRows.find((s4) => {
                const s4Product = cleanForMatching(s4.product || s4.product_name || '');
                const s4AssignedTo = s4.assignedTo || s4.assigned_to || '';
                return (
                  s4Product === cleanAssignmentProduct &&
                  (s4AssignedTo === a.assignedTo || !a.assignedTo)
                );
              });
              if (stage4Entry) {
                price = parseFloat(stage4Entry.price) || 0;
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

          const totalAmount = enrichedAssignments.reduce(
            (sum, a) => sum + (parseFloat(a.assignedQty) || 0) * (parseFloat(a.price) || 0),
            0
          );
          if (totalAmount > 0) {
            const supplierInfo = supplierMap.get(group.supplierId);
            const orderDate = order.order_received_date || order.createdAt;
            const orderDateStr = orderDate
              ? new Date(orderDate).toISOString().split('T')[0]
              : '';
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
              : (paidSet.has(rowId) ? 'Paid' : (statusFromOrder ? 'Paid' : 'Pending'));
            processedPayouts.push({
              id: rowId,
              orderId: order.oid,
              supplierName: supplierInfo?.supplier_name || 'Unknown Supplier',
              supplierCode: supplierInfo?.supplier_id || `SID-${group.supplierId}`,
              orderDate: orderDateStr,
              orderDateRaw: orderDate,
              amount: totalAmount,
              orderStatus: order.order_status || order.status || order.delivery_status || '—',
              paymentStatus: status,
              partialPaidAmount,
              remainingAmount: status === 'Partial' ? Math.max(totalAmount - partialPaidAmount, 0) : 0
            });
          }
        } catch (err) {
          console.error('Error processing order for supplier payout:', err);
        }
      });

      await Promise.all(assignmentPromises);
      processedPayouts.sort((a, b) => new Date(b.orderDateRaw) - new Date(a.orderDateRaw));
      setPayouts(processedPayouts);
      setCurrentPage(1);
    } catch (error) {
      console.error('Error fetching supplier payouts:', error);
      setPayouts([]);
    } finally {
      setLoading(false);
    }
  };

  const handlePay = async (payout) => {
    if (markingPaid || payout.paymentStatus === 'Paid') return;
    const rowData = {
      key: payout.id,
      entity_id: supplierId,
      orderId: payout.orderId,
      amount: payout.amount
    };
    try {
      setMarkingPaid(true);
      await markAsPaid('supplier', rowData);
      setPayouts((prev) =>
        prev.map((p) => (p.id === payout.id ? { ...p, paymentStatus: 'Paid', partialPaidAmount: 0, remainingAmount: 0 } : p))
      );
      try {
        const stored = localStorage.getItem('payout-supplier-paid');
        const list = stored ? JSON.parse(stored) : [];
        if (!list.includes(payout.id)) list.push(payout.id);
        localStorage.setItem('payout-supplier-paid', JSON.stringify(list));
      } catch {
        // ignore
      }
    } catch (err) {
      console.error('Error marking supplier payout as paid:', err);
    } finally {
      setMarkingPaid(false);
    }
  };

  const filteredPayouts = useMemo(() => {
    let list = [...payouts];
    if (fromDate || toDate) {
      list = filterPayoutsByDateRange(list, fromDate, toDate, (p) => p.orderDate);
    }
    const query = searchTerm.trim().toLowerCase();
    if (query) {
      list = list.filter(
        (p) =>
          String(p.orderId || '').toLowerCase().includes(query) ||
          (p.supplierName || '').toLowerCase().includes(query) ||
          (p.supplierCode || '').toLowerCase().includes(query)
      );
    }
    return sortPayoutsByStatus(list.map((p) => ({ ...p, status: p.paymentStatus || p.status })));
  }, [payouts, searchTerm, fromDate, toDate]);

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

  const confirmPayAll = async () => {
    const pending = payAllSelected;
    if (pending.length === 0) return;
    setMarkingPaid(true);
    try {
      for (const payout of pending) {
        const rowData = {
          key: payout.id,
          entity_id: supplierId,
          orderId: payout.orderId,
          amount: payout.amount,
        };
        await markAsPaid('supplier', rowData);
        try {
          const stored = localStorage.getItem('payout-supplier-paid');
          const list = stored ? JSON.parse(stored) : [];
          if (!list.includes(payout.id)) list.push(payout.id);
          localStorage.setItem('payout-supplier-paid', JSON.stringify(list));
        } catch {
          // ignore
        }
      }
      setPayouts((prev) =>
        prev.map((p) =>
          pending.some((x) => x.id === p.id)
            ? { ...p, paymentStatus: 'Paid', partialPaidAmount: 0, remainingAmount: 0 }
            : p
        )
      );
      closePayAllModal(false);
    } catch (err) {
      alert(err?.message || err?.error || 'Failed to pay all');
    } finally {
      setMarkingPaid(false);
    }
  };

  const handleRevert = async (payout) => {
    try {
      setMarkingPaid(true);
      await unmarkAsPaid('supplier', { key: payout.id, id: payout.id, reference_key: payout.id });
      setPayouts((prev) => prev.map((p) => (p.id === payout.id ? { ...p, paymentStatus: 'Pending', partialPaidAmount: 0, remainingAmount: p.amount } : p)));
    } catch (err) {
      alert(err?.message || 'Failed to revert');
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
    if (!Number.isFinite(entered) || entered <= 0) return alert('Enter a valid partial amount');
    const cumulative = alreadyPaid + entered;
    if (total > 0 && cumulative >= total) return alert('Total partial paid must be less than total payout');
    try {
      setMarkingPaid(true);
      await markPartialPaid('supplier', {
        key: payout.id,
        id: payout.id,
        entity_id: supplierId,
        orderId: payout.orderId,
        amount: total,
        partial_amount: entered,
        partial_paid_total: cumulative,
        note: partialNote
      });
      setPayouts((prev) =>
        prev.map((p) =>
          p.id === payout.id
            ? { ...p, paymentStatus: 'Partial', partialPaidAmount: cumulative, remainingAmount: Math.max(total - cumulative, 0) }
            : p
        )
      );
      setPartialModal({ open: false, payout: null });
      setPartialAmount('');
      setPartialNote('');
    } catch (err) {
      alert(err?.message || 'Failed to save partial payment');
    } finally {
      setMarkingPaid(false);
    }
  };

  const totalPages = calcPayoutTotalPages(filteredPayouts.length, ITEMS_PER_PAGE);
  const paginatedPayouts = getPayoutPageSlice(filteredPayouts, currentPage, ITEMS_PER_PAGE);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, fromDate, toDate]);

  const supplierExportLabel = supplier?.supplier_name || payouts[0]?.supplierName || '';

  const handleExportExcel = () => {
    exportPayoutExcel(
      filteredPayouts.map((p) => ({
        'Order ID': p.orderId || p.id?.split('_')[0] || '—',
        'Supplier Name': p.supplierName,
        'Supplier ID': p.supplierCode,
        'Order Date': payoutExportDate(p.orderDate),
        Amount: p.amount,
        Status: p.paymentStatus || p.status,
      })),
      { sheetName: 'Supplier Payouts', filePrefix: 'Supplier_Payout_Detail' }
    );
  };

  const handleExportPDF = () => {
    exportPayoutPdf({
      title: 'Supplier Payouts',
      subtitle: buildPayoutExportSubtitle({
        fromDate,
        toDate,
        extra: supplierExportLabel ? `Supplier: ${supplierExportLabel}` : '',
      }),
      headers: ['Order ID', 'Supplier Name', 'Order Date', 'Amount', 'Status'],
      body: filteredPayouts.map((p) => [
        p.orderId || p.id?.split('_')[0] || '—',
        p.supplierName,
        payoutExportDate(p.orderDate),
        `Rs. ${Number(p.amount || 0).toLocaleString('en-IN')}`,
        p.paymentStatus || p.status,
      ]),
      filePrefix: 'Supplier_Payout_Detail',
    });
  };

  const statsCards = useMemo(() => {
    const total = payouts.length;
    const pending = payouts.filter((p) => p.paymentStatus === 'Pending').length;
    const completed = payouts.filter((p) => p.paymentStatus === 'Paid').length;
    const totalValue = payouts.reduce((sum, p) => sum + (p.amount || 0), 0);
    const valueStr =
      totalValue >= 100000
        ? `₹${(totalValue / 100000).toFixed(1)} L`
        : `₹${Number(totalValue).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;
    return [
      { label: 'Total Payouts', value: String(total), color: 'bg-gradient-to-r from-[#D1FAE5] to-[#A7F3D0]', textColor: 'text-[#0D5C4D]' },
      { label: 'Pending Payouts', value: String(pending), color: 'bg-gradient-to-r from-[#6EE7B7] to-[#34D399]', textColor: 'text-[#0D5C4D]' },
      { label: 'Completed Payouts', value: String(completed), color: 'bg-gradient-to-r from-[#10B981] to-[#059669]', textColor: 'text-white' },
      { label: 'Total Payout Value', value: valueStr, color: 'bg-gradient-to-r from-[#047857] to-[#065F46]', textColor: 'text-white' }
    ];
  }, [payouts]);

  const formatAmount = (amount) =>
    `₹${Number(amount || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;
  const formatOrderDate = (dateStr) =>
    dateStr ? new Date(dateStr + 'T12:00:00').toLocaleDateString('en-GB') : '—';

  return (
    <div className="min-h-screen bg-[#E8F5F1] p-4 sm:p-6 lg:p-8">
      <div className="max-w-7xl mx-auto">
        <button
          onClick={() => navigate(`/suppliers/${id}`)}
          className="flex items-center gap-2 mb-6 px-4 py-2 bg-white rounded-lg text-gray-600 hover:text-gray-800 transition-colors shadow-sm"
        >
          <ArrowLeft className="w-4 h-4" />
          <span className="text-sm font-medium">Back to Supplier Details</span>
        </button>

        <div className="flex flex-wrap gap-3 mb-6">
          <button
            onClick={() => navigate(`/suppliers/${id}`)}
            className="px-6 py-2.5 bg-white text-gray-700 border border-gray-300 rounded-lg font-medium hover:bg-gray-50 transition-colors"
          >
            Personal Info
          </button>
          <button
            onClick={() => navigate(`/suppliers/${id}/orders`)}
            className="px-6 py-2.5 bg-white text-gray-700 border border-gray-300 rounded-lg font-medium hover:bg-gray-50 transition-colors"
          >
            Order List
          </button>
          <button className="px-6 py-2.5 bg-[#0D7C66] text-white rounded-lg font-medium transition-colors shadow-sm">
            Payout
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
          {statsCards.map((stat, index) => (
            <div key={index} className={`${stat.color} rounded-2xl p-6`}>
              <div className={`text-sm font-medium mb-2 opacity-90 ${stat.textColor}`}>{stat.label}</div>
              <div className={`text-4xl font-bold mb-2 ${stat.textColor}`}>{stat.value}</div>
            </div>
          ))}
        </div>

        <PayoutFilterBar
          idPrefix="supplier-detail-payout"
          searchValue={searchTerm}
          onSearchChange={setSearchTerm}
          searchPlaceholder="Order ID..."
          fromDate={fromDate}
          onFromDateChange={setFromDate}
          toDate={toDate}
          onToDateChange={setToDate}
          onClear={() => {
            setSearchTerm('');
            setFromDate('');
            setToDate('');
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
                <col style={{ width: '16%' }} />
                <col style={{ width: '22%' }} />
                <col style={{ width: '14%' }} />
                <col style={{ width: '12%' }} />
                <col style={{ width: '14%' }} />
                <col style={{ width: '22%' }} />
              </colgroup>
              <thead className={payoutThead}>
                <tr>
                  <th className={`${payoutTh} text-left`}>Order ID</th>
                  <th className={`${payoutTh} text-left`}>Supplier Name</th>
                  <th className={`${payoutTh} text-left`}>Order Date</th>
                  <th className={`${payoutTh} text-right`}>Amount</th>
                  <th className={`${payoutTh} text-center`}>Status</th>
                  <th className={`${payoutTh} text-center`}>Action</th>
                </tr>
              </thead>
              <tbody className={payoutTbody}>
                {loading ? (
                  <tr><td colSpan={6} className={payoutEmptyCell}>Loading payouts...</td></tr>
                ) : paginatedPayouts.length === 0 ? (
                  <tr><td colSpan={6} className={payoutEmptyCell}>No payout records found for this supplier</td></tr>
                ) : (
                  paginatedPayouts.map((payout, index) => (
                    <tr key={payout.id} className={payoutRow(index)}>
                      <td className={payoutTd}>
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 shrink-0 rounded-full bg-[#B8F4D8] flex items-center justify-center text-[#0D5C4D] font-semibold text-xs">
                            {(payout.supplierCode || 'S').substring(0, 2).toUpperCase()}
                          </div>
                          <span className="font-semibold">{payout.orderId || payout.id?.split('_')[0] || '—'}</span>
                        </div>
                      </td>
                      <td className={payoutTd}>
                        <div className="font-medium">{payout.supplierName}</div>
                        <div className="text-xs text-[#6B8782]">{payout.supplierCode}</div>
                      </td>
                      <td className={`${payoutTd} whitespace-nowrap`}>{formatOrderDate(payout.orderDate)}</td>
                      <td className={`${payoutTdNum} font-bold`}>{formatAmount(payout.amount)}</td>
                      <td className={payoutTdCenter}>
                        <span className={`inline-flex px-2.5 py-1 rounded-full text-xs font-semibold ${getPayoutStatusClassName(payout.paymentStatus)}`}>{payout.paymentStatus}</span>
                        {payout.paymentStatus === 'Partial' && (
                          <div className="mt-1 text-[10px] text-[#6B8782] leading-tight">
                            Paid {formatAmount(payout.partialPaidAmount || 0)}<br />Bal {formatAmount(payout.remainingAmount || getBalanceAmount(payout))}
                          </div>
                        )}
                      </td>
                      <td className={`${payoutTdCenter} whitespace-nowrap`}>
                        <div className={payoutActionRow}>
                          {payout.paymentStatus === 'Paid' ? (
                            <button type="button" onClick={() => handleRevert(payout)} disabled={markingPaid} className={payoutBtn.revert}>Revert</button>
                          ) : (
                            <>
                              <button type="button" onClick={() => { setPartialModal({ open: true, payout }); setPartialAmount(''); setPartialNote(''); }} disabled={markingPaid} className={payoutBtn.partial}>Partial</button>
                              <button type="button" onClick={() => handlePay(payout)} disabled={markingPaid} className={payoutBtn.pay}>
                                {markingPaid ? '…' : payout.paymentStatus === 'Partial' ? `Pay Bal ${formatAmount(getBalanceAmount(payout))}` : 'Pay'}
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
            itemsPerPage={ITEMS_PER_PAGE}
            onPageChange={setCurrentPage}
            onClampPage={setCurrentPage}
            itemLabel="payouts"
          />
        </div>
        <PayAllConfirmModal
          open={payAllModalOpen}
          fromDate={fromDate}
          toDate={toDate}
          rows={payAllSelected}
          entityColumnLabel="Order"
          getEntityPrimary={(p) => p.orderId || p.id?.split('_')[0] || '—'}
          getEntitySecondary={(p) => p.supplierCode}
          getRowDate={(p) => p.orderDate}
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
                {partialModal.payout.supplierName} — Total {formatAmount(partialModal.payout.amount)}
              </p>
              {Number(partialModal.payout.partialPaidAmount || 0) > 0 && (
                <p className="text-xs text-[#0D5C4D] mb-3">
                  Paid: {formatAmount(partialModal.payout.partialPaidAmount || 0)} | Balance: {formatAmount(getBalanceAmount(partialModal.payout))}
                </p>
              )}
              <input type="number" min="0" value={partialAmount} onChange={(e) => setPartialAmount(e.target.value)} placeholder="Amount" className="w-full mb-3 px-3 py-2 border border-gray-300 rounded-lg" />
              <input type="text" value={partialNote} onChange={(e) => setPartialNote(e.target.value)} placeholder="Note (optional)" className="w-full mb-4 px-3 py-2 border border-gray-300 rounded-lg" />
              <div className="flex gap-2 justify-end">
                <button type="button" onClick={() => setPartialModal({ open: false, payout: null })} className="px-4 py-2 border rounded-lg">Cancel</button>
                <button type="button" onClick={handlePartialPay} disabled={markingPaid} className="px-4 py-2 bg-blue-600 text-white rounded-lg disabled:opacity-50">
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

export default SupplierPayout;