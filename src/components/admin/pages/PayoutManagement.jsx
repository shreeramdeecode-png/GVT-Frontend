import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Search, ChevronDown, Download } from 'lucide-react';
import { getAllOrders } from '../../../api/orderApi';
import { getOrderAssignment } from '../../../api/orderAssignmentApi';
import { getAllFarmers } from '../../../api/farmerApi';
import { getPaidRecords, markAsPaid } from '../../../api/payoutApi';
import { filterByDateRange, TIME_FILTER_OPTIONS } from '../../../utils/dateRangeFilter';

const PayoutManagement = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const pageFromUrl = Math.max(1, parseInt(searchParams.get('page') || '1', 10) || 1);
  const [activeTab, setActiveTab] = useState('farmer');
  const [searchQuery, setSearchQuery] = useState('');
  const [timeFilter, setTimeFilter] = useState('All Time');
  const [showTimeFilter, setShowTimeFilter] = useState(false);
  const timeFilterRef = useRef(null);
  const skipFilterPageReset = useRef(true);
  const [currentPage, setCurrentPage] = useState(pageFromUrl);
  const itemsPerPage = 7;

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

  const filteredPayouts = useMemo(() => {
    let list = filterByDateRange([...payouts], timeFilter, (p) => p.lastSupplied);
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
    return list;
  }, [payouts, searchQuery, timeFilter]);

  useEffect(() => {
    if (skipFilterPageReset.current) {
      skipFilterPageReset.current = false;
      return;
    }
    setPage(1);
  }, [searchQuery, timeFilter, setPage]);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (showTimeFilter && !timeFilterRef.current?.contains(event.target)) {
        setShowTimeFilter(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showTimeFilter]);

  const totalPages = Math.ceil(filteredPayouts.length / itemsPerPage) || 1;
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedPayouts = filteredPayouts.slice(startIndex, startIndex + itemsPerPage);

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
      setPayouts((prev) => prev.map((p) => (p.id === payout.id ? { ...p, status: 'Paid' } : p)));
    } catch (error) {
      console.error('Error marking farmer payout as paid:', error);
      alert(error?.message || error?.error || 'Failed to mark as paid');
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

        {/* Search and Controls */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 mb-6">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
              {/* Search */}
            <div className="flex-1 relative">
              <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                placeholder="Search by order ID, farmer name..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-12 pr-4 py-3 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent text-sm bg-gray-50"
              />
            </div>

            <div className="relative" ref={timeFilterRef}>
              <button
                type="button"
                onClick={() => setShowTimeFilter(!showTimeFilter)}
                className="flex items-center gap-2 px-4 py-3 border border-gray-300 rounded-lg bg-white hover:bg-gray-50 transition-colors w-full sm:w-auto justify-center"
              >
                <span className="text-gray-700 text-sm">{timeFilter}</span>
                <ChevronDown className="w-4 h-4 text-gray-500" />
              </button>
              {showTimeFilter && (
                <div className="absolute top-full left-0 mt-1 w-48 bg-white rounded-lg shadow-lg border border-gray-200 z-50">
                  {TIME_FILTER_OPTIONS.map((option) => (
                    <button
                      key={option}
                      type="button"
                      onClick={() => {
                        setTimeFilter(option);
                        setShowTimeFilter(false);
                      }}
                      className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 first:rounded-t-lg last:rounded-b-lg"
                    >
                      {option}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Export Button */}
            <button className="px-6 py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-medium transition-colors flex items-center justify-center gap-2 shadow-sm text-sm">
              <Download className="w-4 h-4" />
              Export
            </button>
          </div>
        </div>

        {/* Payouts Table */}
        <div className="bg-white rounded-2xl overflow-hidden border border-[#D0E0DB]">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-[#D4F4E8]">
                  <th className="px-6 py-4 text-left text-sm font-semibold text-[#0D5C4D]">
                    Farmer Name
                  </th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-[#0D5C4D]">
                    Quantity Supplied
                  </th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-[#0D5C4D]">
                    Amount
                  </th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-[#0D5C4D]">
                    Action
                  </th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan="4" className="px-6 py-8 text-center text-[#6B8782]">
                      Loading farmer payouts...
                    </td>
                  </tr>
                ) : paginatedPayouts.length === 0 ? (
                  <tr>
                    <td colSpan="4" className="px-6 py-8 text-center text-[#6B8782]">
                      No farmer payouts found
                    </td>
                  </tr>
                ) : (
                  paginatedPayouts.map((payout, index) => (
                    <tr
                      key={payout.id}
                      className={`border-b border-[#D0E0DB] hover:bg-[#F0F4F3] transition-colors ${
                        index % 2 === 0 ? 'bg-white' : 'bg-[#F0F4F3]/30'
                      }`}
                    >
                      <td className="px-6 py-4">
                        <div className="font-semibold text-[#0D5C4D] text-sm">{payout.farmerName}</div>
                        <div className="text-xs text-[#6B8782]">
                          Last supplied: {payout.lastSupplied ? new Date(payout.lastSupplied).toLocaleDateString('en-IN') : '-'}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-sm font-medium text-[#0D5C4D]">
                          {payout.quantityKg.toFixed(2)} kg
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-sm font-bold text-[#0D5C4D]">
                          {formatCurrency(payout.amount)}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        {payout.status === 'Paid' ? (
                          <span className="inline-block px-4 py-1.5 rounded-full text-xs font-medium bg-[#D4F4E8] text-[#047857]">
                            Paid
                          </span>
                        ) : (
                          <button
                            onClick={() => handlePay(payout)}
                            disabled={markingPaid}
                            className="px-6 py-2 rounded-lg text-xs font-semibold transition-colors bg-emerald-600 hover:bg-emerald-700 text-white disabled:opacity-60"
                          >
                            {markingPaid ? 'Saving...' : 'Pay'}
                          </button>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>



          {/* Pagination */}
          <div className="flex items-center justify-between px-6 py-4 bg-[#F0F4F3] border-t border-[#D0E0DB]">
            <div className="text-sm text-[#6B8782]">
              Showing {filteredPayouts.length === 0 ? 0 : startIndex + 1} to{' '}
              {Math.min(startIndex + itemsPerPage, filteredPayouts.length)} of {filteredPayouts.length} Farmers
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPage(Math.max(1, currentPage - 1))}
                disabled={currentPage === 1}
                className={`px-3 py-2 rounded-lg transition-colors ${
                  currentPage === 1
                    ? 'text-gray-400 cursor-not-allowed'
                    : 'text-[#6B8782] hover:bg-[#D0E0DB]'
                }`}
              >
                &lt;
              </button>
              {Array.from({ length: totalPages }).map((_, idx) => {
                const page = idx + 1;
                return (
                  <button
                    key={page}
                    onClick={() => setPage(page)}
                    className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                      currentPage === page
                        ? 'bg-[#0D8568] text-white'
                        : 'text-[#6B8782] hover:bg-[#D0E0DB]'
                    }`}
                  >
                    {page}
                  </button>
                );
              })}
              <button
                onClick={() => setPage(Math.min(totalPages, currentPage + 1))}
                disabled={currentPage === totalPages}
                className={`px-3 py-2 rounded-lg transition-colors ${
                  currentPage === totalPages
                    ? 'text-gray-400 cursor-not-allowed'
                    : 'text-[#6B8782] hover:bg-[#D0E0DB]'
                }`}
              >
                &gt;
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PayoutManagement;