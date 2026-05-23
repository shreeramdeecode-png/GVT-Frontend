import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import * as inventoryCompanyApi from '../../../api/inventoryCompanyApi';
import {
    getAllInventoryStocks,
    getInventoryStocksByCompany,
    updateInventoryStockPaymentStatus
} from '../../../api/inventoryStockApi';
import HistoryPaymentFilterBar, { PaymentStatusBadge } from '../common/HistoryPaymentFilterBar';

const isPurchasePaid = (row) =>
    String(row?.payment_status || 'unpaid').toLowerCase() === 'paid';

const getStockRowId = (row) => Number(row?.stock_id);

const filterHistoryByDate = (rows, fromDate, toDate) =>
    (rows || []).filter((row) => {
        const rowDate = row.date || '';
        if (fromDate && rowDate < fromDate) return false;
        if (toDate && rowDate > toDate) return false;
        return true;
    });

const summarizePurchaseRows = (rows) => {
    const totalAmount = (rows || []).reduce(
        (sum, row) => sum + parseFloat(row.total_with_gst || 0),
        0
    );
    return { total_amount: totalAmount.toFixed(2) };
};

const amountForInput = (value) => {
    const num = parseFloat(value);
    if (Number.isNaN(num) || num === 0) return '';
    return Number.isInteger(num) ? String(num) : String(num);
};

const amountForDisplay = (value) => {
    const num = parseFloat(value);
    if (Number.isNaN(num) || num === 0) return '0';
    return Number.isInteger(num)
        ? num.toLocaleString('en-IN')
        : num.toLocaleString('en-IN', { maximumFractionDigits: 2 });
};

const parseAmountInput = (rawValue) => {
    if (rawValue === '' || rawValue === null || rawValue === undefined) return 0;
    const num = parseFloat(rawValue);
    return Number.isNaN(num) ? NaN : num;
};

const normalizeStockItems = (stock) => {
    let items = stock.items;
    if (typeof items === 'string') {
        try {
            items = JSON.parse(items);
        } catch {
            items = [];
        }
    }
    return {
        ...stock,
        items: Array.isArray(items) ? items : []
    };
};

const loadStocksForCompany = async (company) => {
    const companyId = company.id;
    const companyName = (company.name || '').trim().toLowerCase();

    try {
        const res = await inventoryCompanyApi.getCompanyPurchaseHistory(companyId);
        return (res?.data || []).map(normalizeStockItems);
    } catch {
        try {
            const res = await getInventoryStocksByCompany(companyId);
            return (res?.data || []).map(normalizeStockItems);
        } catch {
            const res = await getAllInventoryStocks();
            return (res?.data || [])
                .filter(
                    (stock) =>
                        Number(stock.company_id) === Number(companyId) ||
                        (stock.company_name || '').trim().toLowerCase() === companyName
                )
                .map(normalizeStockItems);
        }
    }
};

const flattenPurchaseHistory = (stocks) => {
    return (stocks || []).flatMap((stock) => {
        const normalized = normalizeStockItems(stock);
        const items = normalized.items;
        if (items.length === 0) {
            return [{
                id: `${stock.id}-0`,
                stock_id: stock.id,
                payment_status: normalized.payment_status || 'unpaid',
                invoice_no: stock.invoice_no,
                date: stock.date,
                item_name: '-',
                hsn_code: '-',
                quantity: '-',
                price_per_unit: '-',
                total_with_gst: normalized.total_with_gst
            }];
        }
        return items.map((item, index) => ({
            id: `${stock.id}-${index}`,
            stock_id: stock.id,
            payment_status: normalized.payment_status || 'unpaid',
            invoice_no: normalized.invoice_no,
            date: normalized.date,
            item_name: item.item_name,
            hsn_code: item.hsn_code,
            quantity: item.quantity,
            price_per_unit: item.price_per_unit,
            total_with_gst: item.total_with_gst ?? normalized.total_with_gst
        }));
    });
};

const applyCompanyTotals = (company, paidAmount, outstandingPermission) => {
    const total = parseFloat(company.total_amount) || 0;
    const paid = paidAmount !== undefined ? paidAmount : parseFloat(company.paid_amount) || 0;
    const outstanding = outstandingPermission !== undefined
        ? outstandingPermission
        : parseFloat(company.outstanding_permission) || 0;
    const pending = Math.max(0, total + outstanding - paid);
    return {
        ...company,
        paid_amount: paid,
        outstanding_permission: outstanding,
        pending_amount: pending.toFixed(2)
    };
};

const InventoryCompany = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const [companies, setCompanies] = useState([]);
    const [currentPage, setCurrentPage] = useState(1);
    const [isAddModalOpen, setIsAddModalOpen] = useState(false);
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [selectedCompany, setSelectedCompany] = useState(null);
    const [formData, setFormData] = useState({ name: '', paid_amount: '', outstanding_permission: '', payment_status: 'unpaid' });
    const [searchTerm, setSearchTerm] = useState('');
    const [paidInputs, setPaidInputs] = useState({});
    const [savingPaidId, setSavingPaidId] = useState(null);
    const [viewingHistory, setViewingHistory] = useState(null);
    const [allPurchaseHistory, setAllPurchaseHistory] = useState([]);
    const [purchaseHistory, setPurchaseHistory] = useState([]);
    const [fromDate, setFromDate] = useState('');
    const [toDate, setToDate] = useState('');
    const [dateFilterActive, setDateFilterActive] = useState(false);
    const [payingPurchase, setPayingPurchase] = useState(false);
    const [revertingPurchase, setRevertingPurchase] = useState(false);
    const [loadingHistory, setLoadingHistory] = useState(false);

    useEffect(() => {
        fetchCompanies();
    }, []);

    useEffect(() => {
        const paidMap = {};
        companies.forEach((c) => {
            paidMap[c.id] = amountForInput(c.paid_amount);
        });
        setPaidInputs(paidMap);
    }, [companies]);

    const fetchCompanies = async () => {
        try {
            const response = await inventoryCompanyApi.getAllCompanies();
            setCompanies(response.data || []);
        } catch (error) {
            console.error('Error fetching companies:', error);
            alert('Failed to fetch companies');
        }
    };

    const updateCompanyInList = (updatedCompany) => {
        setCompanies((prev) =>
            prev.map((c) => (c.id === updatedCompany.id ? { ...c, ...updatedCompany } : c))
        );
        if (viewingHistory?.id === updatedCompany.id) {
            setViewingHistory((prev) => ({ ...prev, ...updatedCompany }));
        }
    };

    const handleAdd = async (e) => {
        e.preventDefault();
        if (formData.name.trim()) {
            try {
                await inventoryCompanyApi.createCompany({
                    name: formData.name.trim(),
                    outstanding_permission: parseFloat(formData.outstanding_permission) || 0
                });
                fetchCompanies();
                setFormData({ name: '', paid_amount: '', outstanding_permission: '', payment_status: 'unpaid' });
                setIsAddModalOpen(false);
            } catch (error) {
                console.error('Error creating company:', error);
                alert('Failed to create company');
            }
        }
    };

    const handleEdit = (company) => {
        setSelectedCompany(company);
        setFormData({
            name: company.name,
            paid_amount: amountForInput(company.paid_amount),
            outstanding_permission: amountForInput(company.outstanding_permission),
            payment_status: company.payment_status || 'unpaid'
        });
        setIsEditModalOpen(true);
    };

    const handleUpdate = async (e) => {
        e.preventDefault();
        if (formData.name.trim()) {
            try {
                const response = await inventoryCompanyApi.updateCompany(selectedCompany.id, {
                    name: formData.name.trim(),
                    paid_amount: parseFloat(formData.paid_amount) || 0,
                    outstanding_permission: parseFloat(formData.outstanding_permission) || 0,
                    payment_status: formData.payment_status
                });
                if (response?.data) {
                    updateCompanyInList(response.data);
                } else {
                    fetchCompanies();
                }
                setFormData({ name: '', paid_amount: '', outstanding_permission: '', payment_status: 'unpaid' });
                setIsEditModalOpen(false);
                setSelectedCompany(null);
            } catch (error) {
                console.error('Error updating company:', error);
                alert('Failed to update company');
            }
        }
    };

    const handleDelete = async (id) => {
        if (window.confirm('Are you sure you want to delete this company?')) {
            try {
                await inventoryCompanyApi.deleteCompany(id);
                fetchCompanies();
            } catch (error) {
                console.error('Error deleting company:', error);
                alert('Failed to delete company');
            }
        }
    };

    const handlePaymentStatusChange = async (id, currentStatus) => {
        try {
            const newStatus = currentStatus === 'paid' ? 'unpaid' : 'paid';
            await inventoryCompanyApi.updateCompany(id, { payment_status: newStatus });
            fetchCompanies();
        } catch (error) {
            console.error('Error updating payment status:', error);
            alert('Failed to update payment status');
        }
    };

    const handlePaidAmountSave = async (companyId, rawValue, options = {}) => {
        const company = companies.find((c) => c.id === companyId);
        if (!company) return false;

        const paidAmount = parseAmountInput(rawValue);
        if (Number.isNaN(paidAmount) || paidAmount < 0) {
            if (!options.silent) alert('Please enter a valid paid amount');
            return false;
        }

        if (parseFloat(company.paid_amount || 0) === paidAmount) return company;

        setSavingPaidId(companyId);
        try {
            const response = await inventoryCompanyApi.updateCompany(companyId, { paid_amount: paidAmount });
            const updated = response?.data || applyCompanyTotals(company, paidAmount);
            updateCompanyInList(updated);
            setPaidInputs((prev) => ({ ...prev, [companyId]: amountForInput(updated.paid_amount ?? paidAmount) }));
            return updated;
        } catch (error) {
            console.error('Error updating paid amount:', error);
            if (!options.silent) alert(error?.message || 'Failed to update paid amount');
            fetchCompanies();
            return null;
        } finally {
            setSavingPaidId(null);
        }
    };

    const handleViewHistory = async (company) => {
        setViewingHistory(company);
        setLoadingHistory(true);
        setAllPurchaseHistory([]);
        setPurchaseHistory([]);
        setFromDate('');
        setToDate('');
        setDateFilterActive(false);

        let companyForHistory = companies.find((c) => c.id === company.id) || company;

        const paidDraft = paidInputs[company.id];
        if (
            paidDraft !== undefined &&
            parseFloat(paidDraft || 0) !== parseFloat(companyForHistory.paid_amount || 0)
        ) {
            const savedCompany = await handlePaidAmountSave(company.id, paidDraft, { silent: true });
            if (savedCompany) companyForHistory = savedCompany;
        }

        try {
            const companyResponse = await inventoryCompanyApi.getCompanyById(company.id);
            if (companyResponse?.data) {
                companyForHistory = companyResponse.data;
                setViewingHistory(companyResponse.data);
            }
        } catch (error) {
            console.warn('Could not refresh company totals:', error);
            setViewingHistory(companyForHistory);
        }

        try {
            const stocks = await loadStocksForCompany(companyForHistory);
            const flat = flattenPurchaseHistory(stocks);
            setAllPurchaseHistory(flat);
            setPurchaseHistory(flat);
        } catch (error) {
            console.error('Error fetching purchase history:', error);
            alert(error?.message || 'Failed to fetch purchase history');
        } finally {
            setLoadingHistory(false);
        }
    };

    const handleBackToList = () => {
        setViewingHistory(null);
        setAllPurchaseHistory([]);
        setPurchaseHistory([]);
        setFromDate('');
        setToDate('');
        setDateFilterActive(false);
    };

    const handleApplyDateFilter = () => {
        if (fromDate && toDate && fromDate > toDate) {
            alert('From date cannot be after end date');
            return;
        }
        setPurchaseHistory(filterHistoryByDate(allPurchaseHistory, fromDate, toDate));
        setDateFilterActive(Boolean(fromDate || toDate));
    };

    const handleClearDateFilter = () => {
        setFromDate('');
        setToDate('');
        setDateFilterActive(false);
        setPurchaseHistory(allPurchaseHistory);
    };

    const filteredDisplaySummary = useMemo(
        () => summarizePurchaseRows(purchaseHistory),
        [purchaseHistory]
    );

    const unpaidInViewCount = useMemo(
        () => purchaseHistory.filter((row) => !isPurchasePaid(row)).length,
        [purchaseHistory]
    );

    const paidInViewCount = useMemo(
        () => purchaseHistory.filter((row) => isPurchasePaid(row)).length,
        [purchaseHistory]
    );

    const applyPurchasePaymentUpdate = useCallback(
        async ({ mode, rowsInView, fallbackStatus, setBusy }) => {
            const uniqueStockIds = [
                ...new Set(
                    rowsInView
                        .map((row) => getStockRowId(row))
                        .filter((id) => !Number.isNaN(id))
                )
            ];

            if (uniqueStockIds.length === 0) {
                alert('No purchase records to update');
                return;
            }

            const amount = rowsInView
                .reduce((sum, row) => sum + parseFloat(row.total_with_gst || 0), 0)
                .toFixed(2);

            const dateLabel =
                fromDate || toDate
                    ? ` from ${fromDate || 'start'} to ${toDate || 'end'}`
                    : '';

            const confirmMsg =
                mode === 'pay'
                    ? `Mark ${uniqueStockIds.length} purchase(s) as paid for ₹${amount}${dateLabel}?`
                    : `Revert ${uniqueStockIds.length} paid purchase(s) (₹${amount}) back to unpaid${dateLabel}?`;

            if (!window.confirm(confirmMsg)) return;

            setBusy(true);
            try {
                await Promise.all(
                    uniqueStockIds.map((id) =>
                        updateInventoryStockPaymentStatus(id, fallbackStatus)
                    )
                );
                const stocks = await loadStocksForCompany(viewingHistory);
                const flat = flattenPurchaseHistory(stocks);
                setAllPurchaseHistory(flat);
                setPurchaseHistory(
                    dateFilterActive
                        ? filterHistoryByDate(flat, fromDate, toDate)
                        : flat
                );
                alert(`${uniqueStockIds.length} purchase(s) updated`);
            } catch (error) {
                console.error('Error updating purchase payment:', error);
                const msg = error.message || 'Failed to update payment status';
                alert(
                    msg.includes('404')
                        ? `${msg}\n\nRestart the backend (vsd_backend) and try again.`
                        : msg
                );
            } finally {
                setBusy(false);
            }
        },
        [viewingHistory, fromDate, toDate, dateFilterActive]
    );

    const handlePayNow = () => {
        const unpaidInView = purchaseHistory.filter((row) => !isPurchasePaid(row));
        applyPurchasePaymentUpdate({
            mode: 'pay',
            rowsInView: unpaidInView,
            fallbackStatus: 'paid',
            setBusy: setPayingPurchase
        });
    };

    const handleRevertPayment = () => {
        const paidInView = purchaseHistory.filter((row) => isPurchasePaid(row));
        applyPurchasePaymentUpdate({
            mode: 'revert',
            rowsInView: paidInView,
            fallbackStatus: 'unpaid',
            setBusy: setRevertingPurchase
        });
    };

    const filteredCompanies = companies.filter(company =>
        company.name.toLowerCase().includes(searchTerm.toLowerCase())
    );

    useEffect(() => {
        setCurrentPage(1);
    }, [searchTerm]);

    const itemsPerPage = 7;
    const totalPages = Math.ceil(filteredCompanies.length / itemsPerPage);
    const startIndex = (currentPage - 1) * itemsPerPage;
    const paginatedCompanies = filteredCompanies.slice(startIndex, startIndex + itemsPerPage);

    if (viewingHistory) {
        return (
            <div className="min-h-screen bg-gray-50">
                <div className="px-4 sm:px-6 lg:px-8 py-6">
                    <button
                        onClick={handleBackToList}
                        className="mb-4 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors flex items-center gap-2"
                    >
                        ← Back to Companies
                    </button>

                    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
                        <h2 className="text-xl font-semibold text-gray-900 mb-2">{viewingHistory.name}</h2>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm mb-0">
                            <div>
                                <span className="text-gray-600">Total Amount: </span>
                                <span className="font-semibold text-gray-900">₹{viewingHistory.total_amount || 0}</span>
                            </div>
                            <div>
                                <span className="text-gray-600">Paid Amount: </span>
                                <span className="font-semibold text-green-600">₹{amountForDisplay(viewingHistory.paid_amount)}</span>
                            </div>
                            <div>
                                <span className="text-gray-600">Pending Amount: </span>
                                <span className="font-semibold text-red-600">₹{viewingHistory.pending_amount || 0}</span>
                            </div>
                        </div>

                        <HistoryPaymentFilterBar
                            fromDate={fromDate}
                            toDate={toDate}
                            onFromDateChange={setFromDate}
                            onToDateChange={setToDate}
                            onApplyFilter={handleApplyDateFilter}
                            onClear={handleClearDateFilter}
                            loading={loadingHistory}
                            dateFilterActive={dateFilterActive}
                            filteredTotal={filteredDisplaySummary?.total_amount || '0.00'}
                            paying={payingPurchase}
                            reverting={revertingPurchase}
                            unpaidCount={unpaidInViewCount}
                            paidCount={paidInViewCount}
                            onPayNow={handlePayNow}
                            onRevertPayment={handleRevertPayment}
                        />
                    </div>

                    <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
                        <div className="overflow-x-auto">
                            <table className="w-full">
                                <thead className="bg-gray-50 border-b border-gray-200">
                                    <tr>
                                        <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Date</th>
                                        <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Invoice No</th>
                                        <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Product Name</th>
                                        <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">HSN Code</th>
                                        <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Quantity</th>
                                        <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Price/Unit</th>
                                        <th className="px-6 py-3 text-center text-xs font-semibold text-gray-700 uppercase tracking-wider">Total Amount with GST</th>
                                        <th className="px-6 py-3 text-center text-xs font-semibold text-gray-700 uppercase tracking-wider">Payment</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-200">
                                    {loadingHistory ? (
                                        <tr>
                                            <td colSpan="8" className="px-6 py-8 text-center text-gray-500">
                                                Loading purchase history...
                                            </td>
                                        </tr>
                                    ) : purchaseHistory.length === 0 ? (
                                        <tr>
                                            <td colSpan="8" className="px-6 py-8 text-center text-gray-500">
                                                No purchase history found
                                            </td>
                                        </tr>
                                    ) : (
                                        purchaseHistory.map((item) => (
                                            <tr key={item.id} className="hover:bg-gray-50 transition-colors">
                                                <td className="px-6 py-4 text-sm text-gray-600">{item.date || '-'}</td>
                                                <td className="px-6 py-4 text-sm text-gray-900">{item.invoice_no || '-'}</td>
                                                <td className="px-6 py-4 text-sm text-gray-900">{item.item_name}</td>
                                                <td className="px-6 py-4 text-sm text-gray-600">{item.hsn_code || '-'}</td>
                                                <td className="px-6 py-4 text-sm text-gray-600">{item.quantity || '-'}</td>
                                                <td className="px-6 py-4 text-sm text-gray-600">₹{item.price_per_unit}</td>
                                                <td className="px-6 py-4 text-sm text-gray-600 text-center">₹{item.total_with_gst}</td>
                                                <td className="px-6 py-4 text-sm text-center">
                                                    <PaymentStatusBadge paid={isPurchasePaid(item)} />
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-50">
            {/* Tabs */}
            <div className="px-6 sm:px-8 py-4">
                <div className="flex flex-wrap gap-2">
                    <button
                        onClick={() => navigate('/settings')}
                        className={`px-6 py-2.5 rounded-lg font-medium text-sm transition-colors ${location.pathname === '/settings'
                            ? 'bg-[#0D7C66] text-white'
                            : 'bg-[#D4F4E8] text-[#0D5C4D] hover:bg-[#B8F4D8]'
                            }`}
                    >
                        Inventory Management
                    </button>
                    <button
                        onClick={() => navigate('/settings/inventory-company')}
                        className={`px-6 py-2.5 rounded-lg font-medium text-sm transition-colors ${location.pathname === '/settings/inventory-company'
                            ? 'bg-[#0D7C66] text-white'
                            : 'bg-[#D4F4E8] text-[#0D5C4D] hover:bg-[#B8F4D8]'
                            }`}
                    >
                        Inventory Company
                    </button>
                    <button
                        onClick={() => navigate('/settings/airport')}
                        className={`px-6 py-2.5 rounded-lg font-medium text-sm transition-colors ${location.pathname === '/settings/airport'
                            ? 'bg-[#0D7C66] text-white'
                            : 'bg-[#D4F4E8] text-[#0D5C4D] hover:bg-[#B8F4D8]'
                            }`}
                    >
                        Airport Locations
                    </button>
                    <button
                        onClick={() => navigate('/settings/petroleum')}
                        className={`px-6 py-2.5 rounded-lg font-medium text-sm transition-colors ${location.pathname === '/settings/petroleum'
                            ? 'bg-[#0D7C66] text-white'
                            : 'bg-[#D4F4E8] text-[#0D5C4D] hover:bg-[#B8F4D8]'
                            }`}
                    >
                        Petroleum Management
                    </button>
                    <button
                        onClick={() => navigate('/settings/labour-rate')}
                        className={`px-6 py-2.5 rounded-lg font-medium text-sm transition-colors ${location.pathname === '/settings/labour-rate'
                            ? 'bg-[#0D7C66] text-white'
                            : 'bg-[#D4F4E8] text-[#0D5C4D] hover:bg-[#B8F4D8]'
                            }`}
                    >
                        Labour Rate
                    </button>
                    <button
                        onClick={() => navigate('/settings/driver-rate')}
                        className={`px-6 py-2.5 rounded-lg font-medium text-sm transition-colors ${location.pathname === '/settings/driver-rate'
                            ? 'bg-[#0D7C66] text-white'
                            : 'bg-[#D4F4E8] text-[#0D5C4D] hover:bg-[#B8F4D8]'
                            }`}
                    >
                        Driver Rate
                    </button>
                    <button
                        onClick={() => navigate('/settings/customers')}
                        className={`px-6 py-2.5 rounded-lg font-medium text-sm transition-colors ${location.pathname === '/settings/customers'
                            ? 'bg-[#0D7C66] text-white'
                            : 'bg-[#D4F4E8] text-[#0D5C4D] hover:bg-[#B8F4D8]'
                            }`}
                    >
                        Customers
                    </button>
                </div>
            </div>

            {/* Main Content */}
            <div className="px-4 sm:px-6 lg:px-8 py-6">
                {/* Search and Add Bar */}
                <div className="bg-white rounded-lg shadow-sm border border-gray-200 mb-6">
                    <div className="p-4 sm:p-6">
                        <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
                            <div className="relative flex-1 sm:max-w-xs w-full">
                                <svg
                                    className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400"
                                    fill="none"
                                    stroke="currentColor"
                                    viewBox="0 0 24 24"
                                >
                                    <path
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        strokeWidth={2}
                                        d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                                    />
                                </svg>
                                <input
                                    type="text"
                                    placeholder="Search companies..."
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 text-sm"
                                />
                            </div>

                            <button
                                onClick={() => setIsAddModalOpen(true)}
                                className="w-full sm:w-auto px-5 py-2.5 bg-emerald-500 text-white rounded-lg font-medium text-sm hover:bg-emerald-600 transition-colors flex items-center justify-center gap-2"
                            >
                                <span className="text-lg">+</span>
                                Add Company
                            </button>
                        </div>
                    </div>
                </div>

                {/* Companies Table */}
                <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead className="bg-gray-50 border-b border-gray-200">
                                <tr>
                                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                                        Company Name
                                    </th>
                                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                                        Total Amount
                                    </th>
                                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                                        Paid Amount
                                    </th>
                                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                                        Pending Amount
                                    </th>
                                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                                        Outstanding Permission
                                    </th>
                                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                                        Payment Status
                                    </th>
                                    <th className="px-4 py-3 text-center text-xs font-semibold text-gray-700 uppercase tracking-wider min-w-[340px]">
                                        Action
                                    </th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-200">
                                {filteredCompanies.length === 0 ? (
                                    <tr>
                                        <td colSpan="7" className="px-6 py-8 text-center text-gray-500">
                                            No companies found
                                        </td>
                                    </tr>
                                ) : (
                                    paginatedCompanies.map((company) => (
                                        <tr key={company.id} className="hover:bg-gray-50 transition-colors">
                                            <td className="px-6 py-4 text-sm text-gray-900">{company.name}</td>
                                            <td className="px-6 py-4 text-sm text-gray-900">
                                                ₹{company.total_amount || 0}
                                            </td>
                                            <td className="px-6 py-4 text-sm text-green-600">
                                                <div className="flex items-center gap-1">
                                                    <input
                                                        type="number"
                                                        step="0.01"
                                                        min="0"
                                                        value={paidInputs[company.id] ?? ''}
                                                        placeholder="0"
                                                        onChange={(e) =>
                                                            setPaidInputs((prev) => ({
                                                                ...prev,
                                                                [company.id]: e.target.value
                                                            }))
                                                        }
                                                        disabled={savingPaidId === company.id}
                                                        onKeyDown={(e) => {
                                                            if (e.key === 'Enter') {
                                                                e.preventDefault();
                                                                handlePaidAmountSave(company.id, paidInputs[company.id]);
                                                            }
                                                        }}
                                                        className="w-24 px-2 py-1 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500 disabled:opacity-60"
                                                        title="Enter paid amount and click Save"
                                                    />
                                                    <button
                                                        type="button"
                                                        onClick={() =>
                                                            handlePaidAmountSave(company.id, paidInputs[company.id])
                                                        }
                                                        disabled={savingPaidId === company.id}
                                                        className="px-2 py-1 bg-green-500 text-white rounded text-xs hover:bg-green-600 disabled:opacity-60"
                                                    >
                                                        Save
                                                    </button>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 text-sm text-red-600">
                                                ₹{company.pending_amount || 0}
                                            </td>
                                            <td className="px-6 py-4 text-sm text-amber-600 font-medium">
                                                ₹{amountForDisplay(company.outstanding_permission)}
                                            </td>
                                            <td className="px-6 py-4 text-sm">
                                                <button
                                                    onClick={() => handlePaymentStatusChange(company.id, company.payment_status)}
                                                    className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${company.payment_status === 'paid'
                                                        ? 'bg-green-100 text-green-700 hover:bg-green-200'
                                                        : 'bg-red-100 text-red-700 hover:bg-red-200'
                                                        }`}
                                                >
                                                    {company.payment_status === 'paid' ? 'Paid' : 'Unpaid'}
                                                </button>
                                            </td>
                                            <td className="px-4 py-4 text-sm text-center min-w-[340px]">
                                                <div className="inline-flex items-center justify-center gap-1.5 flex-nowrap">
                                                    <button
                                                        type="button"
                                                        onClick={() => handleViewHistory(company)}
                                                        className="shrink-0 px-2 py-1 h-7 bg-emerald-500 text-white rounded-lg text-xs font-medium hover:bg-emerald-600 transition-colors whitespace-nowrap leading-none"
                                                    >
                                                        View Purchase History
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={() => handleEdit(company)}
                                                        className="shrink-0 px-2 py-1 h-7 border border-gray-300 text-gray-700 rounded-lg text-xs font-medium hover:bg-gray-50 transition-colors whitespace-nowrap leading-none"
                                                    >
                                                        Edit
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={() => handleDelete(company.id)}
                                                        className="shrink-0 px-2 py-1 h-7 bg-red-100 text-red-700 rounded-lg text-xs font-medium hover:bg-red-200 transition-colors whitespace-nowrap leading-none"
                                                    >
                                                        Delete
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                    {/* Pagination */}
                    <div className="px-6 py-4 border-t border-gray-200 flex flex-col sm:flex-row items-center justify-between gap-4">
                        <div className="text-sm text-gray-600">
                            Showing {filteredCompanies.length === 0 ? 0 : startIndex + 1} to {Math.min(startIndex + itemsPerPage, filteredCompanies.length)} of {filteredCompanies.length} companies
                        </div>
                        <div className="flex items-center gap-2">
                            <button
                                onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                                disabled={currentPage === 1}
                                className="p-2 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                            >
                                <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                                </svg>
                            </button>

                            {[...Array(totalPages)].map((_, index) => {
                                const pageNumber = index + 1;
                                if (
                                    pageNumber === 1 ||
                                    pageNumber === totalPages ||
                                    (pageNumber >= currentPage - 1 && pageNumber <= currentPage + 1)
                                ) {
                                    return (
                                        <button
                                            key={pageNumber}
                                            onClick={() => setCurrentPage(pageNumber)}
                                            className={`min-w-[40px] px-3 py-2 rounded-lg text-sm font-medium transition-colors ${currentPage === pageNumber
                                                ? 'bg-emerald-500 text-white'
                                                : 'border border-gray-300 text-gray-700 hover:bg-gray-50'
                                                }`}
                                        >
                                            {pageNumber}
                                        </button>
                                    );
                                } else if (
                                    pageNumber === currentPage - 2 ||
                                    pageNumber === currentPage + 2
                                ) {
                                    return (
                                        <span key={pageNumber} className="px-2 text-gray-500">
                                            ...
                                        </span>
                                    );
                                }
                                return null;
                            })}

                            <button
                                onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                                disabled={currentPage === totalPages}
                                className="p-2 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                            >
                                <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                </svg>
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            {/* Add Modal */}
            {
                isAddModalOpen && (
                    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                        <div className="bg-white rounded-lg w-full max-w-md">
                            <div className="flex items-center justify-between p-6 border-b border-gray-200">
                                <h2 className="text-xl font-semibold text-emerald-700">Add Company</h2>
                                <button
                                    onClick={() => setIsAddModalOpen(false)}
                                    className="p-1 hover:bg-gray-100 rounded-lg transition-colors"
                                >
                                    <svg className="w-6 h-6 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                    </svg>
                                </button>
                            </div>
                            <form onSubmit={handleAdd} className="p-6">
                                <div className="mb-4">
                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                        Company Name <span className="text-red-500">*</span>
                                    </label>
                                    <input
                                        type="text"
                                        value={formData.name}
                                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                        placeholder="Enter company name"
                                        className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 text-sm"
                                        required
                                    />
                                </div>
                                <div className="mb-6">
                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                        Outstanding Permission
                                    </label>
                                    <input
                                        type="number"
                                        step="0.01"
                                        min="0"
                                        value={formData.outstanding_permission}
                                        onChange={(e) =>
                                            setFormData({ ...formData, outstanding_permission: e.target.value })
                                        }
                                        placeholder="Enter amount (added to pending)"
                                        className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 text-sm"
                                    />
                                    <p className="mt-1 text-xs text-gray-500">
                                        This amount is included in the pending total for this company.
                                    </p>
                                </div>
                                <div className="flex gap-3">
                                    <button
                                        type="button"
                                        onClick={() => setIsAddModalOpen(false)}
                                        className="flex-1 px-6 py-3 border border-gray-300 text-gray-700 rounded-lg font-medium hover:bg-gray-50 transition-colors"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        type="submit"
                                        className="flex-1 px-6 py-3 bg-emerald-500 text-white rounded-lg font-medium hover:bg-emerald-600 transition-colors"
                                    >
                                        Add Company
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                )
            }

            {/* Edit Modal */}
            {
                isEditModalOpen && (
                    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                        <div className="bg-white rounded-lg w-full max-w-md">
                            <div className="flex items-center justify-between p-6 border-b border-gray-200">
                                <h2 className="text-xl font-semibold text-emerald-700">Edit Company</h2>
                                <button
                                    onClick={() => {
                                        setIsEditModalOpen(false);
                                        setSelectedCompany(null);
                                        setFormData({ name: '', paid_amount: '', outstanding_permission: '', payment_status: 'unpaid' });
                                    }}
                                    className="p-1 hover:bg-gray-100 rounded-lg transition-colors"
                                >
                                    <svg className="w-6 h-6 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                    </svg>
                                </button>
                            </div>
                            <form onSubmit={handleUpdate} className="p-6">
                                <div className="mb-4">
                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                        Company Name <span className="text-red-500">*</span>
                                    </label>
                                    <input
                                        type="text"
                                        value={formData.name}
                                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                        placeholder="Enter company name"
                                        className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 text-sm"
                                        required
                                    />
                                </div>
                                <div className="mb-4">
                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                        Paid Amount <span className="text-red-500">*</span>
                                    </label>
                                    <input
                                        type="number"
                                        step="0.01"
                                        value={formData.paid_amount}
                                        onChange={(e) => setFormData({ ...formData, paid_amount: e.target.value })}
                                        placeholder="Enter paid amount (leave empty for 0)"
                                        className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 text-sm"
                                        required
                                    />
                                </div>
                                <div className="mb-4">
                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                        Outstanding Permission
                                    </label>
                                    <input
                                        type="number"
                                        step="0.01"
                                        value={formData.outstanding_permission}
                                        onChange={(e) => setFormData({ ...formData, outstanding_permission: e.target.value })}
                                        placeholder="Enter amount (leave empty for 0)"
                                        className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 text-sm"
                                    />
                                </div>
                                <div className="mb-6">
                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                        Payment Status <span className="text-red-500">*</span>
                                    </label>
                                    <select
                                        value={formData.payment_status}
                                        onChange={(e) => setFormData({ ...formData, payment_status: e.target.value })}
                                        className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 text-sm"
                                        required
                                    >
                                        <option value="paid">Paid</option>
                                        <option value="unpaid">Unpaid</option>
                                    </select>
                                </div>
                                <div className="flex gap-3">
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setIsEditModalOpen(false);
                                            setSelectedCompany(null);
                                            setFormData({ name: '', paid_amount: '', outstanding_permission: '', payment_status: 'unpaid' });
                                        }}
                                        className="flex-1 px-6 py-3 border border-gray-300 text-gray-700 rounded-lg font-medium hover:bg-gray-50 transition-colors"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        type="submit"
                                        className="flex-1 px-6 py-3 bg-emerald-500 text-white rounded-lg font-medium hover:bg-emerald-600 transition-colors"
                                    >
                                        Update Company
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                )
            }
        </div >
    );
};

export default InventoryCompany;
