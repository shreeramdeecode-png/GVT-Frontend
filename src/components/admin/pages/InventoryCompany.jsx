import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import * as inventoryCompanyApi from '../../../api/inventoryCompanyApi';
import { getAllInventoryStocks } from '../../../api/inventoryStockApi';

const InventoryCompany = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const [companies, setCompanies] = useState([]);
    const [currentPage, setCurrentPage] = useState(1);
    const [isAddModalOpen, setIsAddModalOpen] = useState(false);
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [selectedCompany, setSelectedCompany] = useState(null);
    const [formData, setFormData] = useState({ name: '', paid_amount: '', payment_status: 'unpaid' });
    const [searchTerm, setSearchTerm] = useState('');
    const [editingPaidAmount, setEditingPaidAmount] = useState(null);
    const [paidAmountValue, setPaidAmountValue] = useState('');
    const [viewingHistory, setViewingHistory] = useState(null);
    const [purchaseHistory, setPurchaseHistory] = useState([]);
    const [loadingHistory, setLoadingHistory] = useState(false);

    useEffect(() => {
        fetchCompanies();
    }, []);

    const fetchCompanies = async () => {
        try {
            const response = await inventoryCompanyApi.getAllCompanies();
            setCompanies(response.data || []);
        } catch (error) {
            console.error('Error fetching companies:', error);
            alert('Failed to fetch companies');
        }
    };

    const handleAdd = async (e) => {
        e.preventDefault();
        if (formData.name.trim()) {
            try {
                await inventoryCompanyApi.createCompany({ name: formData.name.trim() });
                fetchCompanies();
                setFormData({ name: '' });
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
            paid_amount: company.paid_amount || 0,
            payment_status: company.payment_status || 'unpaid'
        });
        setIsEditModalOpen(true);
    };

    const handleUpdate = async (e) => {
        e.preventDefault();
        if (formData.name.trim()) {
            try {
                await inventoryCompanyApi.updateCompany(selectedCompany.id, {
                    name: formData.name.trim(),
                    paid_amount: parseFloat(formData.paid_amount) || 0,
                    payment_status: formData.payment_status
                });
                fetchCompanies();
                setFormData({ name: '', paid_amount: '', payment_status: 'unpaid' });
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

    const handlePaidAmountClick = (companyId, currentAmount) => {
        setEditingPaidAmount(companyId);
        setPaidAmountValue(currentAmount || 0);
    };

    const handlePaidAmountSave = async (companyId) => {
        try {
            await inventoryCompanyApi.updateCompany(companyId, { paid_amount: parseFloat(paidAmountValue) || 0 });
            setEditingPaidAmount(null);
            fetchCompanies();
        } catch (error) {
            console.error('Error updating paid amount:', error);
            alert('Failed to update paid amount');
        }
    };

    const handlePaidAmountCancel = () => {
        setEditingPaidAmount(null);
        setPaidAmountValue('');
    };

    const handleViewHistory = async (company) => {
        setViewingHistory(company);
        setLoadingHistory(true);
        try {
            const response = await getAllInventoryStocks();
            const filtered = response.data.filter(item => item.company_id === company.id);
            setPurchaseHistory(filtered);
        } catch (error) {
            console.error('Error fetching purchase history:', error);
            alert('Failed to fetch purchase history');
        } finally {
            setLoadingHistory(false);
        }
    };

    const handleBackToList = () => {
        setViewingHistory(null);
        setPurchaseHistory([]);
    };

    const filteredCompanies = companies.filter(company =>
        company.name.toLowerCase().includes(searchTerm.toLowerCase())
    );

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
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm">
                            <div>
                                <span className="text-gray-600">Total Amount: </span>
                                <span className="font-semibold text-gray-900">₹{viewingHistory.total_amount || 0}</span>
                            </div>
                            <div>
                                <span className="text-gray-600">Paid Amount: </span>
                                <span className="font-semibold text-green-600">₹{viewingHistory.paid_amount || 0}</span>
                            </div>
                            <div>
                                <span className="text-gray-600">Pending Amount: </span>
                                <span className="font-semibold text-red-600">₹{viewingHistory.pending_amount || 0}</span>
                            </div>
                        </div>
                    </div>

                    <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
                        <div className="overflow-x-auto">
                            <table className="w-full">
                                <thead className="bg-gray-50 border-b border-gray-200">
                                    <tr>
                                        <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Invoice No</th>
                                        <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Product Name</th>
                                        <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">HSN Code</th>
                                        <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Quantity</th>
                                        <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Price/Unit</th>
                                        <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Total Amount with GST</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-200">
                                    {loadingHistory ? (
                                        <tr>
                                            <td colSpan="6" className="px-6 py-8 text-center text-gray-500">
                                                Loading purchase history...
                                            </td>
                                        </tr>
                                    ) : purchaseHistory.length === 0 ? (
                                        <tr>
                                            <td colSpan="6" className="px-6 py-8 text-center text-gray-500">
                                                No purchase history found
                                            </td>
                                        </tr>
                                    ) : (
                                        purchaseHistory.map((item) => (
                                            <tr key={item.id} className="hover:bg-gray-50 transition-colors">
                                                <td className="px-6 py-4 text-sm text-gray-900">{item.invoice_no || '-'}</td>
                                                <td className="px-6 py-4 text-sm text-gray-900">{item.item_name}</td>
                                                <td className="px-6 py-4 text-sm text-gray-600">{item.hsn_code || '-'}</td>
                                                <td className="px-6 py-4 text-sm text-gray-600">{item.quantity || '-'}</td>
                                                <td className="px-6 py-4 text-sm text-gray-600">₹{item.price_per_unit}</td>
                                                <td className="px-6 py-4 text-sm text-gray-600">₹{item.total_with_gst}</td>
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
                                        Payment Status
                                    </th>
                                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                                        Action
                                    </th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-200">
                                {filteredCompanies.length === 0 ? (
                                    <tr>
                                        <td colSpan="6" className="px-6 py-8 text-center text-gray-500">
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
                                                {editingPaidAmount === company.id ? (
                                                    <div className="flex items-center gap-2">
                                                        <input
                                                            type="number"
                                                            step="0.01"
                                                            value={paidAmountValue}
                                                            onChange={(e) => setPaidAmountValue(e.target.value)}
                                                            className="w-24 px-2 py-1 border border-green-500 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 text-sm"
                                                            autoFocus
                                                            onKeyDown={(e) => {
                                                                if (e.key === 'Enter') handlePaidAmountSave(company.id);
                                                                if (e.key === 'Escape') handlePaidAmountCancel();
                                                            }}
                                                        />
                                                        <button
                                                            onClick={() => handlePaidAmountSave(company.id)}
                                                            className="px-2 py-1 bg-green-500 text-white rounded text-xs hover:bg-green-600"
                                                        >
                                                            ✓
                                                        </button>
                                                        <button
                                                            onClick={handlePaidAmountCancel}
                                                            className="px-2 py-1 bg-gray-300 text-gray-700 rounded text-xs hover:bg-gray-400"
                                                        >
                                                            ✕
                                                        </button>
                                                    </div>
                                                ) : (
                                                    <input
                                                        type="number"
                                                        step="0.01"
                                                        value={company.paid_amount || 0}
                                                        onClick={() => handlePaidAmountClick(company.id, company.paid_amount)}
                                                        readOnly
                                                        className="w-24 px-2 py-1 border border-gray-200 rounded-lg text-sm cursor-pointer hover:border-green-500 focus:outline-none"
                                                        title="Click to edit paid amount"
                                                    />
                                                )}
                                            </td>
                                            <td className="px-6 py-4 text-sm text-red-600">
                                                ₹{company.pending_amount || 0}
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
                                            <td className="px-6 py-4 text-sm">
                                                <div className="flex items-center gap-2">
                                                    <button
                                                        onClick={() => handleViewHistory(company)}
                                                        className="px-3 py-1.5 bg-emerald-500 text-white rounded-lg text-xs font-medium hover:bg-emerald-600 transition-colors"
                                                    >
                                                        View Purchase History
                                                    </button>
                                                    <button
                                                        onClick={() => handleEdit(company)}
                                                        className="px-3 py-1.5 border border-gray-300 text-gray-700 rounded-lg text-xs font-medium hover:bg-gray-50 transition-colors"
                                                    >
                                                        Edit
                                                    </button>
                                                    <button
                                                        onClick={() => handleDelete(company.id)}
                                                        className="px-3 py-1.5 bg-red-100 text-red-700 rounded-lg text-xs font-medium hover:bg-red-200 transition-colors"
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
                                <div className="mb-6">
                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                        Company Name <span className="text-red-500">*</span>
                                    </label>
                                    <input
                                        type="text"
                                        value={formData.name}
                                        onChange={(e) => setFormData({ name: e.target.value })}
                                        placeholder="Enter company name"
                                        className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 text-sm"
                                        required
                                    />
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
                                        setFormData({ name: '' });
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
                                        placeholder="Enter paid amount"
                                        className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 text-sm"
                                        required
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
                                            setFormData({ name: '' });
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
