import React, { useState, useEffect, useCallback } from 'react';
import { 
  Search, Filter, Calendar, Eye, X, Receipt, 
  User, DollarSign, Package, TrendingUp, RefreshCw, AlertCircle,
  Printer, CreditCard, Smartphone, Building, Trash2, RotateCcw
} from 'lucide-react';
import { salesAPI } from '../../services/api';

const SalesTab = ({ user, onSalesUpdate }) => {
  const [sales, setSales] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [selectedSale, setSelectedSale] = useState(null);
  const [showSaleDetails, setShowSaleDetails] = useState(false);
  const [filters, setFilters] = useState({
    search: '',
    startDate: '',
    endDate: '',
    status: '',
    paymentStatus: ''
  });
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 12,
    total: 0,
    totalPages: 1
  });

  // Fetch sales data
  const fetchSales = useCallback(async (page = 1) => {
    setLoading(true);
    setError('');
    
    try {
      const params = {
        page,
        limit: pagination.limit
      };

      // Add filters to params
      if (filters.search) {
        params.customer = filters.search;
      }
      if (filters.startDate) {
        params.startDate = filters.startDate;
      }
      if (filters.endDate) {
        params.endDate = filters.endDate;
      }
      if (filters.status) {
        params.status = filters.status;
      }
      if (filters.paymentStatus) {
        params.paymentStatus = filters.paymentStatus;
      }

      console.log('📊 SalesTab: Fetching sales with params:', params);
      const response = await salesAPI.getSales(params);
      
      if (response.data && response.data.sales) {
        setSales(response.data.sales);
        setPagination(prev => ({
          ...prev,
          page,
          total: response.data.total,
          totalPages: response.data.pagination?.totalPages || 1
        }));
        console.log(`✅ SalesTab: Loaded ${response.data.sales.length} sales`);
      } else {
        setSales([]);
      }
    } catch (error) {
      console.error('❌ SalesTab: Error fetching sales:', error);
      if (error.code === 'ECONNABORTED') {
        setError('Backend server is not responding. Please ensure the server is running.');
      } else if (!error.response) {
        setError('Cannot connect to backend server. Please check if the server is running.');
      } else {
        setError('Failed to load sales: ' + (error.userMessage || error.message));
      }
      setSales([]);
    } finally {
      setLoading(false);
    }
  }, [filters, pagination.limit]);

  // Initial fetch
  useEffect(() => {
    fetchSales(1);
  }, [fetchSales]);

  // Handle filter changes
  const handleFilterChange = (key, value) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  };

  // Apply filters
  const applyFilters = () => {
    fetchSales(1);
  };

  // Clear filters
  const clearFilters = () => {
    setFilters({
      search: '',
      startDate: '',
      endDate: '',
      status: '',
      paymentStatus: ''
    });
  };

  // View sale details
  const handleViewSale = async (sale) => {
    try {
      const response = await salesAPI.getSale(sale._id);
      setSelectedSale(response.data.sale);
      setShowSaleDetails(true);
    } catch (error) {
      console.error('Error fetching sale details:', error);
      setError('Failed to load sale details');
    }
  };

  // Cancel sale
  const handleCancelSale = async (saleId) => {
    if (!window.confirm('Are you sure you want to cancel this sale? This action will restore product stock and cannot be undone.')) {
      return;
    }

    try {
      await salesAPI.cancelSale(saleId);
      alert('Sale cancelled successfully!');
      fetchSales(pagination.page); // Refresh current page
      if (onSalesUpdate) {
        onSalesUpdate(); // Refresh stats
      }
    } catch (error) {
      console.error('Error cancelling sale:', error);
      alert(error.response?.data?.message || 'Failed to cancel sale');
    }
  };

  // Delete sale permanently
  const handleDeleteSale = async (saleId) => {
    if (!window.confirm('Are you sure you want to permanently delete this sale? This action cannot be undone and all sale data will be lost.')) {
      return;
    }

    try {
      await salesAPI.deleteSale(saleId);
      alert('Sale deleted successfully!');
      fetchSales(pagination.page); // Refresh current page
      if (onSalesUpdate) {
        onSalesUpdate(); // Refresh stats
      }
    } catch (error) {
      console.error('Error deleting sale:', error);
      alert(error.response?.data?.message || 'Failed to delete sale');
    }
  };

  // Resume sale (change status from cancelled to completed)
  const handleResumeSale = async (saleId) => {
    if (!window.confirm('Are you sure you want to resume this sale? This will change the status back to completed and deduct product stock again.')) {
      return;
    }

    try {
      // You'll need to add this API endpoint in your backend
      await salesAPI.resumeSale(saleId);
      alert('Sale resumed successfully!');
      fetchSales(pagination.page); // Refresh current page
      if (onSalesUpdate) {
        onSalesUpdate(); // Refresh stats
      }
    } catch (error) {
      console.error('Error resuming sale:', error);
      alert(error.response?.data?.message || 'Failed to resume sale');
    }
  };

  // Update payment
  const handleUpdatePayment = async (saleId, amountPaid) => {
    const newAmount = parseFloat(prompt('Enter amount paid:', amountPaid.toString()));
    
    if (isNaN(newAmount) || newAmount < 0) {
      alert('Please enter a valid amount');
      return;
    }

    try {
      await salesAPI.updatePayment(saleId, { amountPaid: newAmount });
      alert('Payment updated successfully!');
      fetchSales(pagination.page); // Refresh current page
    } catch (error) {
      console.error('Error updating payment:', error);
      alert(error.response?.data?.message || 'Failed to update payment');
    }
  };

  // Print receipt - SIMPLIFIED VERSION
  const handlePrintReceipt = (sale) => {
    const formatReceiptCurrency = (amount) => {
      return `UGX ${amount?.toLocaleString() || '0'}`;
    };

    const formatReceiptDate = (dateString) => {
      return new Date(dateString).toLocaleDateString();
    };

    const formatReceiptTime = (dateString) => {
      return new Date(dateString).toLocaleTimeString();
    };

    // Create receipt HTML content
    const receiptContent = `
      <div style="font-family: 'Courier New', monospace; max-width: 300px; margin: 0 auto; padding: 15px; font-size: 12px;">
        <!-- Header -->
        <div style="text-align: center; border-bottom: 1px dashed #000; padding-bottom: 10px; margin-bottom: 15px;">
          <div style="font-size: 18px; font-weight: bold; margin-bottom: 5px;">ELECTRONIC STORE</div>
          <div style="font-size: 11px;">123 Tech Street, Kampala</div>
          <div style="font-size: 11px;">Tel: +256 712 345 678</div>
          <div style="font-size: 11px;">Email: info@electronicstore.com</div>
        </div>

        <!-- Sale Information -->
        <div style="margin-bottom: 10px;">
          <div><strong>Receipt No:</strong> ${sale.saleNumber}</div>
          <div><strong>Date:</strong> ${formatReceiptDate(sale.createdAt)}</div>
          <div><strong>Time:</strong> ${formatReceiptTime(sale.createdAt)}</div>
          <div><strong>Cashier:</strong> ${sale.soldBy?.name || 'System'}</div>
        </div>

        <!-- Customer Information -->
        <div style="border: 1px dashed #000; padding: 8px; margin-bottom: 15px;">
          <div><strong>Customer:</strong> ${sale.customer.name}</div>
          ${sale.customer.phone ? `<div><strong>Phone:</strong> ${sale.customer.phone}</div>` : ''}
          ${sale.customer.email ? `<div><strong>Email:</strong> ${sale.customer.email}</div>` : ''}
        </div>

        <!-- Items Table -->
        <table style="width: 100%; border-collapse: collapse; margin-bottom: 15px;">
          <thead>
            <tr>
              <th style="text-align: left; border-bottom: 1px dashed #000; padding: 5px 0;">Item</th>
              <th style="text-align: left; border-bottom: 1px dashed #000; padding: 5px 0;">Qty</th>
              <th style="text-align: left; border-bottom: 1px dashed #000; padding: 5px 0;">Price</th>
              <th style="text-align: left; border-bottom: 1px dashed #000; padding: 5px 0;">Total</th>
            </tr>
          </thead>
          <tbody>
            ${sale.items.map(item => `
              <tr>
                <td style="padding: 4px 0;">
                  <div style="font-weight: bold;">${item.productName}</div>
                  <div style="font-size: 10px;">${item.productBrand}</div>
                </td>
                <td style="padding: 4px 0;">${item.quantity}</td>
                <td style="padding: 4px 0;">${formatReceiptCurrency(item.unitPrice)}</td>
                <td style="padding: 4px 0;">${formatReceiptCurrency(item.totalPrice)}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>

        <!-- Summary -->
        <div style="margin-bottom: 10px; font-size: 11px;">
          <div>Total Items: ${sale.items.length}</div>
          <div>Total Units: ${sale.items.reduce((sum, item) => sum + item.quantity, 0)}</div>
        </div>

        <div style="border-top: 1px dashed #000; margin: 10px 0;"></div>

        <!-- Totals -->
        <div style="border-top: 1px dashed #000; padding-top: 10px;">
          <div style="display: flex; justify-content: space-between; margin-bottom: 3px;">
            <span>Subtotal:</span>
            <span>${formatReceiptCurrency(sale.subtotal)}</span>
          </div>
          ${sale.discountAmount > 0 ? `
            <div style="display: flex; justify-content: space-between; margin-bottom: 3px;">
              <span>Discount:</span>
              <span>-${formatReceiptCurrency(sale.discountAmount)}</span>
            </div>
          ` : ''}
          ${sale.taxAmount > 0 ? `
            <div style="display: flex; justify-content: space-between; margin-bottom: 3px;">
              <span>Tax:</span>
              <span>${formatReceiptCurrency(sale.taxAmount)}</span>
            </div>
          ` : ''}
          <div style="display: flex; justify-content: space-between; font-weight: bold; border-top: 1px dashed #000; padding-top: 5px; margin-top: 5px;">
            <span>TOTAL AMOUNT:</span>
            <span>${formatReceiptCurrency(sale.totalAmount)}</span>
          </div>
          <div style="display: flex; justify-content: space-between; margin-bottom: 3px;">
            <span>Payment Method:</span>
            <span style="text-transform: uppercase;">${sale.paymentMethod}</span>
          </div>
          <div style="display: flex; justify-content: space-between; margin-bottom: 3px;">
            <span>Amount Paid:</span>
            <span>${formatReceiptCurrency(sale.amountPaid)}</span>
          </div>
          <div style="display: flex; justify-content: space-between; font-weight: bold;">
            <span>Balance:</span>
            <span style="color: ${sale.balance === 0 ? '#000000' : '#ff0000'}">
              ${formatReceiptCurrency(sale.balance)}
            </span>
          </div>
          <div style="display: flex; justify-content: space-between; margin-top: 3px;">
            <span>Payment Status:</span>
            <span style="font-weight: bold; color: ${
              sale.paymentStatus === 'paid' ? '#008000' : 
              sale.paymentStatus === 'partially_paid' ? '#ffa500' : '#ff0000'
            }">
              ${sale.paymentStatus.toUpperCase()}
            </span>
          </div>
        </div>

        <!-- Footer -->
        <div style="text-align: center; margin-top: 20px; padding-top: 10px; border-top: 1px dashed #000; font-size: 10px;">
          <div style="font-weight: bold; margin: 8px 0;">THANK YOU FOR YOUR BUSINESS!</div>
          <div>Items sold are not returnable</div>
          <div>Warranty according to manufacturer policy</div>
          <div>*** www.electronicstore.com ***</div>
          <div style="margin-top: 8px; font-style: italic;">
            Printed on: ${new Date().toLocaleDateString()} ${new Date().toLocaleTimeString()}
          </div>
        </div>
      </div>
    `;

    // Create print window
    const printWindow = window.open('', '_blank', 'width=400,height=700');
    
    if (printWindow) {
      printWindow.document.write(`
        <!DOCTYPE html>
        <html>
          <head>
            <title>Receipt - ${sale.saleNumber}</title>
            <style>
              @media print {
                body { 
                  margin: 0; 
                  padding: 10px; 
                  background: white;
                }
                @page {
                  margin: 0;
                  size: auto;
                }
              }
            </style>
          </head>
          <body>
            ${receiptContent}
            <script>
              window.onload = function() {
                setTimeout(() => {
                  window.print();
                  // Optional: close window after printing
                  // setTimeout(() => window.close(), 500);
                }, 500);
              };
            </script>
          </body>
        </html>
      `);
      printWindow.document.close();
    } else {
      alert('Please allow popups to print receipts');
    }
  };

  // Format currency for display
  const formatCurrency = (amount) => {
    return `UGX ${amount?.toLocaleString() || '0'}`;
  };

  // Format date for display
  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString();
  };

  // Format time for display
  const formatTime = (dateString) => {
    return new Date(dateString).toLocaleTimeString();
  };

  // Get status badge color
  const getStatusColor = (status) => {
    switch (status) {
      case 'completed': return 'bg-green-100 text-green-800';
      case 'cancelled': return 'bg-red-100 text-red-800';
      case 'refunded': return 'bg-yellow-100 text-yellow-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  // Get payment status badge color
  const getPaymentStatusColor = (status) => {
    switch (status) {
      case 'paid': return 'bg-green-100 text-green-800';
      case 'partially_paid': return 'bg-yellow-100 text-yellow-800';
      case 'pending': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  // Get payment method icon
  const getPaymentMethodIcon = (method) => {
    switch (method) {
      case 'cash': return <DollarSign className="h-4 w-4" />;
      case 'card': return <CreditCard className="h-4 w-4" />;
      case 'mobile_money': return <Smartphone className="h-4 w-4" />;
      case 'bank_transfer': return <Building className="h-4 w-4" />;
      default: return <DollarSign className="h-4 w-4" />;
    }
  };

  // Pagination handlers
  const handlePreviousPage = () => {
    if (pagination.page > 1) {
      fetchSales(pagination.page - 1);
    }
  };

  const handleNextPage = () => {
    if (pagination.page < pagination.totalPages) {
      fetchSales(pagination.page + 1);
    }
  };

  return (
    <div className="space-y-6">
      {/* Error Alert */}
      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertCircle className="h-4 w-4 text-red-600" />
            <p className="text-red-700 text-sm">{error}</p>
          </div>
          <button
            onClick={() => fetchSales(1)}
            className="ml-4 bg-red-600 hover:bg-red-700 text-white px-3 py-1 rounded text-sm transition-colors flex items-center gap-1"
          >
            <RefreshCw className="h-3 w-3" />
            Retry
          </button>
        </div>
      )}

      {/* Filters Section */}
      <div className="theme-surface rounded-lg p-4">
        <div className="flex flex-col lg:flex-row gap-4 items-start lg:items-center justify-between mb-4">
          <h2 className="text-lg font-semibold theme-text">Sales History</h2>
          <div className="flex gap-2">
            <button
              onClick={() => fetchSales(pagination.page)}
              disabled={loading}
              className="flex items-center gap-1 theme-border border theme-text-muted hover:theme-secondary px-3 py-2 rounded text-sm transition-colors disabled:opacity-50"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-3 mb-4">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-3 h-4 w-4 theme-text-muted" />
            <input
              type="text"
              placeholder="Search customer..."
              value={filters.search}
              onChange={(e) => handleFilterChange('search', e.target.value)}
              className="w-full pl-10 pr-3 py-2 theme-border border rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 theme-surface theme-text text-sm"
            />
          </div>

          {/* Start Date */}
          <div className="relative">
            <Calendar className="absolute left-3 top-3 h-4 w-4 theme-text-muted" />
            <input
              type="date"
              value={filters.startDate}
              onChange={(e) => handleFilterChange('startDate', e.target.value)}
              className="w-full pl-10 pr-3 py-2 theme-border border rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 theme-surface theme-text text-sm"
            />
          </div>

          {/* End Date */}
          <div className="relative">
            <Calendar className="absolute left-3 top-3 h-4 w-4 theme-text-muted" />
            <input
              type="date"
              value={filters.endDate}
              onChange={(e) => handleFilterChange('endDate', e.target.value)}
              className="w-full pl-10 pr-3 py-2 theme-border border rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 theme-surface theme-text text-sm"
            />
          </div>

          {/* Status Filter */}
          <select
            value={filters.status}
            onChange={(e) => handleFilterChange('status', e.target.value)}
            className="w-full px-3 py-2 theme-border border rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 theme-surface theme-text text-sm"
          >
            <option value="">All Status</option>
            <option value="completed">Completed</option>
            <option value="cancelled">Cancelled</option>
            <option value="refunded">Refunded</option>
          </select>

          {/* Payment Status Filter */}
          <select
            value={filters.paymentStatus}
            onChange={(e) => handleFilterChange('paymentStatus', e.target.value)}
            className="w-full px-3 py-2 theme-border border rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 theme-surface theme-text text-sm"
          >
            <option value="">All Payments</option>
            <option value="paid">Paid</option>
            <option value="partially_paid">Partially Paid</option>
            <option value="pending">Pending</option>
          </select>
        </div>

        <div className="flex gap-2">
          <button
            onClick={applyFilters}
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded text-sm transition-colors flex items-center gap-1"
          >
            <Filter className="h-4 w-4" />
            Apply Filters
          </button>
          <button
            onClick={clearFilters}
            className="theme-border border theme-text-muted hover:theme-secondary px-4 py-2 rounded text-sm transition-colors flex items-center gap-1"
          >
            <X className="h-4 w-4" />
            Clear
          </button>
        </div>
      </div>

      {/* Sales Cards */}
      <div className="theme-surface rounded-lg p-4">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-md font-semibold theme-text">
            Sales Records ({pagination.total})
          </h3>
        </div>

        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="theme-surface rounded shadow-sm theme-border border p-4 animate-pulse">
                <div className="bg-gray-300 dark:bg-gray-600 h-4 rounded mb-2 w-3/4"></div>
                <div className="bg-gray-300 dark:bg-gray-600 h-3 rounded mb-1 w-1/2"></div>
                <div className="bg-gray-300 dark:bg-gray-600 h-3 rounded mb-3 w-2/3"></div>
                <div className="bg-gray-300 dark:bg-gray-600 h-8 rounded"></div>
              </div>
            ))}
          </div>
        ) : sales.length === 0 ? (
          <div className="text-center py-8">
            <Receipt className="h-12 w-12 mx-auto mb-3 theme-text-muted opacity-50" />
            <h3 className="text-base font-semibold theme-text mb-1">No Sales Found</h3>
            <p className="theme-text-muted text-sm">
              {pagination.total === 0 ? 'No sales have been recorded yet' : 'Try adjusting your filters'}
            </p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {sales.map((sale) => (
                <div key={sale._id} className="theme-surface rounded shadow-sm theme-border border p-4 hover:shadow-md transition-shadow">
                  {/* Header */}
                  <div className="flex justify-between items-start mb-3">
                    <div>
                      <h3 className="font-semibold theme-text text-sm">{sale.saleNumber}</h3>
                      <p className="theme-text-muted text-xs">{formatDate(sale.createdAt)} • {formatTime(sale.createdAt)}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-bold theme-primary-text text-sm">{formatCurrency(sale.totalAmount)}</p>
                      <div className="flex gap-1 mt-1">
                        <span className={`inline-flex px-2 py-0.5 text-xs font-medium rounded-full ${getStatusColor(sale.status)}`}>
                          {sale.status}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Customer Info */}
                  <div className="mb-3">
                    <div className="flex items-center gap-1 mb-1">
                      <User className="h-3 w-3 theme-text-muted" />
                      <span className="font-medium theme-text text-sm">{sale.customer.name}</span>
                    </div>
                    {sale.customer.phone && (
                      <p className="theme-text-muted text-xs">📞 {sale.customer.phone}</p>
                    )}
                  </div>

                  {/* Sale Details */}
                  <div className="grid grid-cols-2 gap-2 mb-3 text-xs">
                    <div>
                      <p className="theme-text-muted">Items:</p>
                      <p className="font-medium theme-text">{sale.items.length} products</p>
                    </div>
                    <div>
                      <p className="theme-text-muted">Units:</p>
                      <p className="font-medium theme-text">
                        {sale.items.reduce((sum, item) => sum + item.quantity, 0)}
                      </p>
                    </div>
                    <div>
                      <p className="theme-text-muted">Profit:</p>
                      <p className="font-medium text-green-600">{formatCurrency(sale.totalProfit)}</p>
                    </div>
                    <div>
                      <p className="theme-text-muted">Payment:</p>
                      <div className="flex items-center gap-1">
                        {getPaymentMethodIcon(sale.paymentMethod)}
                        <span className={`font-medium ${
                          sale.paymentStatus === 'paid' ? 'text-green-600' :
                          sale.paymentStatus === 'partially_paid' ? 'text-yellow-600' : 'text-red-600'
                        }`}>
                          {sale.paymentStatus}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="flex gap-1 pt-3 border-t theme-border">
                    {sale.status === 'cancelled' ? (
                      <>
                        {/* For cancelled sales: Delete and Resume buttons */}
                        <button
                          onClick={() => handleDeleteSale(sale._id)}
                          className="flex-1 bg-red-600 hover:bg-red-700 text-white py-1.5 px-2 rounded text-xs font-medium transition-colors flex items-center justify-center gap-1"
                          title="Delete Sale Permanently"
                        >
                          <Trash2 className="h-3 w-3" />
                          Delete
                        </button>
                        <button
                          onClick={() => handleResumeSale(sale._id)}
                          className="flex-1 bg-green-600 hover:bg-green-700 text-white py-1.5 px-2 rounded text-xs font-medium transition-colors flex items-center justify-center gap-1"
                          title="Resume Sale"
                        >
                          <RotateCcw className="h-3 w-3" />
                          Resume
                        </button>
                      </>
                    ) : (
                      <>
                        {/* For active sales: Print, View, and Cancel buttons */}
                        <button
                          onClick={() => handlePrintReceipt(sale)}
                          className="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-1.5 px-2 rounded text-xs font-medium transition-colors flex items-center justify-center gap-1"
                          title="Print Receipt"
                        >
                          <Printer className="h-3 w-3" />
                          Print
                        </button>
                        <button
                          onClick={() => handleViewSale(sale)}
                          className="flex-1 bg-green-600 hover:bg-green-700 text-white py-1.5 px-2 rounded text-xs font-medium transition-colors flex items-center justify-center gap-1"
                          title="View Details"
                        >
                          <Eye className="h-3 w-3" />
                          View
                        </button>
                        {sale.status === 'completed' && (
                          <button
                            onClick={() => handleCancelSale(sale._id)}
                            className="flex-1 bg-red-600 hover:bg-red-700 text-white py-1.5 px-2 rounded text-xs font-medium transition-colors flex items-center justify-center gap-1"
                            title="Cancel Sale"
                          >
                            <X className="h-3 w-3" />
                            Cancel
                          </button>
                        )}
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {/* Pagination */}
            {pagination.totalPages > 1 && (
              <div className="mt-6 flex items-center justify-between">
                <div className="flex-1 flex justify-between items-center">
                  <button
                    onClick={handlePreviousPage}
                    disabled={pagination.page === 1}
                    className="theme-border border theme-text-muted hover:theme-secondary px-4 py-2 rounded text-sm transition-colors disabled:opacity-50"
                  >
                    Previous
                  </button>
                  <span className="theme-text text-sm">
                    Page {pagination.page} of {pagination.totalPages}
                  </span>
                  <button
                    onClick={handleNextPage}
                    disabled={pagination.page === pagination.totalPages}
                    className="theme-border border theme-text-muted hover:theme-secondary px-4 py-2 rounded text-sm transition-colors disabled:opacity-50"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Sale Details Modal */}
      {showSaleDetails && selectedSale && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="theme-surface rounded shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-4 border-b theme-border flex justify-between items-center">
              <h2 className="text-lg font-semibold theme-text">Sale Details - {selectedSale.saleNumber}</h2>
              <button
                onClick={() => setShowSaleDetails(false)}
                className="theme-text-muted hover:theme-text transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="p-4 space-y-4">
              {/* Sale Information */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <h3 className="font-semibold theme-text mb-2">Sale Information</h3>
                  <div className="space-y-1 text-sm">
                    <p><span className="theme-text-muted">Date:</span> {formatDate(selectedSale.createdAt)}</p>
                    <p><span className="theme-text-muted">Time:</span> {formatTime(selectedSale.createdAt)}</p>
                    <p><span className="theme-text-muted">Sold By:</span> {selectedSale.soldBy?.name || 'System'}</p>
                    <p><span className="theme-text-muted">Payment Method:</span> {selectedSale.paymentMethod}</p>
                  </div>
                </div>

                <div>
                  <h3 className="font-semibold theme-text mb-2">Customer Information</h3>
                  <div className="space-y-1 text-sm">
                    <p><span className="theme-text-muted">Name:</span> {selectedSale.customer.name}</p>
                    {selectedSale.customer.phone && (
                      <p><span className="theme-text-muted">Phone:</span> {selectedSale.customer.phone}</p>
                    )}
                    {selectedSale.customer.email && (
                      <p><span className="theme-text-muted">Email:</span> {selectedSale.customer.email}</p>
                    )}
                  </div>
                </div>
              </div>

              {/* Items Table */}
              <div>
                <h3 className="font-semibold theme-text mb-2">Items Sold</h3>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="theme-bg-secondary">
                      <tr>
                        <th className="px-3 py-2 text-left text-xs font-medium theme-text-muted">Product</th>
                        <th className="px-3 py-2 text-left text-xs font-medium theme-text-muted">Qty</th>
                        <th className="px-3 py-2 text-left text-xs font-medium theme-text-muted">Unit Price</th>
                        <th className="px-3 py-2 text-left text-xs font-medium theme-text-muted">Total Price</th>
                        <th className="px-3 py-2 text-left text-xs font-medium theme-text-muted">Profit</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y theme-divide">
                      {selectedSale.items.map((item, index) => (
                        <tr key={index}>
                          <td className="px-3 py-2">
                            <div>
                              <p className="font-medium theme-text text-sm">{item.productName}</p>
                              <p className="theme-text-muted text-xs">{item.productBrand}</p>
                            </div>
                          </td>
                          <td className="px-3 py-2 theme-text text-sm">{item.quantity}</td>
                          <td className="px-3 py-2 theme-text text-sm">{formatCurrency(item.unitPrice)}</td>
                          <td className="px-3 py-2 theme-text text-sm">{formatCurrency(item.totalPrice)}</td>
                          <td className="px-3 py-2 text-green-600 text-sm">{formatCurrency(item.profit)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Totals */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <h3 className="font-semibold theme-text mb-2">Payment Summary</h3>
                  <div className="space-y-1 text-sm">
                    <div className="flex justify-between">
                      <span className="theme-text-muted">Subtotal:</span>
                      <span className="theme-text">{formatCurrency(selectedSale.subtotal)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="theme-text-muted">Discount:</span>
                      <span className="theme-text">{formatCurrency(selectedSale.discountAmount)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="theme-text-muted">Tax:</span>
                      <span className="theme-text">{formatCurrency(selectedSale.taxAmount)}</span>
                    </div>
                    <div className="flex justify-between font-semibold border-t theme-border pt-1">
                      <span className="theme-text">Total Amount:</span>
                      <span className="theme-primary-text">{formatCurrency(selectedSale.totalAmount)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="theme-text-muted">Amount Paid:</span>
                      <span className="theme-text">{formatCurrency(selectedSale.amountPaid)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="theme-text-muted">Balance:</span>
                      <span className={`font-medium ${
                        selectedSale.balance === 0 ? 'text-green-600' : 'text-yellow-600'
                      }`}>
                        {formatCurrency(selectedSale.balance)}
                      </span>
                    </div>
                  </div>
                </div>

                <div>
                  <h3 className="font-semibold theme-text mb-2">Profit Analysis</h3>
                  <div className="space-y-1 text-sm">
                    <div className="flex justify-between">
                      <span className="theme-text-muted">Total Cost:</span>
                      <span className="theme-text">{formatCurrency(selectedSale.totalCost)}</span>
                    </div>
                    <div className="flex justify-between font-semibold">
                      <span className="theme-text">Total Profit:</span>
                      <span className="text-green-600">{formatCurrency(selectedSale.totalProfit)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="theme-text-muted">Profit Margin:</span>
                      <span className="text-green-600">
                        {((selectedSale.totalProfit / selectedSale.totalAmount) * 100).toFixed(2)}%
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Notes */}
              {selectedSale.notes && (
                <div>
                  <h3 className="font-semibold theme-text mb-2">Notes</h3>
                  <p className="theme-text text-sm p-2 theme-border border rounded">{selectedSale.notes}</p>
                </div>
              )}
            </div>

            <div className="p-4 border-t theme-border flex justify-end gap-2">
              {selectedSale.status === 'cancelled' ? (
                <>
                  <button
                    onClick={() => handleDeleteSale(selectedSale._id)}
                    className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded text-sm transition-colors flex items-center gap-1"
                  >
                    <Trash2 className="h-4 w-4" />
                    Delete Sale
                  </button>
                  <button
                    onClick={() => handleResumeSale(selectedSale._id)}
                    className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded text-sm transition-colors flex items-center gap-1"
                  >
                    <RotateCcw className="h-4 w-4" />
                    Resume Sale
                  </button>
                </>
              ) : (
                <button
                  onClick={() => handlePrintReceipt(selectedSale)}
                  className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded text-sm transition-colors flex items-center gap-1"
                >
                  <Printer className="h-4 w-4" />
                  Print Receipt
                </button>
              )}
              <button
                onClick={() => setShowSaleDetails(false)}
                className="theme-border border theme-text-muted hover:theme-secondary px-4 py-2 rounded text-sm transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SalesTab;