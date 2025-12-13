// MyOrders.jsx - COMPACT RESPONSIVE VERSION with Theme Integration
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { 
  ShoppingBag, Clock, Truck, CheckCircle, XCircle, 
  ArrowLeft, X, Check, AlertCircle, Package, Calendar,
  Mail, Phone, MapPin, MessageCircle, User,
  Eye, Download, Copy, CheckCheck,
  CreditCard, Wallet, Receipt, DollarSign,
  ChevronDown, ChevronUp, Star,
  ShoppingCart, Share2, RefreshCw,
  Image as ImageIcon, ChevronRight, ChevronLeft,
  Filter, Search, MoreVertical
} from 'lucide-react';
import { ordersAPI } from '../services/api';

const MyOrders = () => {
  const { user, token, isLoggedIn } = useAuth();
  const { currentTheme } = useTheme();
  const navigate = useNavigate();
  
  const [orders, setOrders] = useState([]);
  const [filteredOrders, setFilteredOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  
  // Filters and search
  const [statusFilter, setStatusFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [dateRange, setDateRange] = useState('all');
  const [sortBy, setSortBy] = useState('newest');
  const [expandedOrder, setExpandedOrder] = useState(null);
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);
  
  // Modals
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [showOrderDetails, setShowOrderDetails] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [showImageModal, setShowImageModal] = useState(false);
  const [selectedProductImages, setSelectedProductImages] = useState([]);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  
  // Form states
  const [confirmationNote, setConfirmationNote] = useState('');
  const [cancellationReason, setCancellationReason] = useState('');
  const [actionLoading, setActionLoading] = useState(false);
  
  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(10);
  const [totalOrders, setTotalOrders] = useState(0);

  // Theme-aware CSS classes using same pattern as Products.jsx
  const themeClasses = {
    bg: 'theme-bg',
    surface: 'theme-surface',
    text: 'theme-text',
    'text-muted': 'theme-text-muted',
    border: 'theme-border',
    'border-light': 'theme-border-light',
    hover: 'hover:theme-hover',
    card: 'theme-card',
    input: 'theme-input'
  };

  // Status configurations - COMPACT VERSION
  const STATUS_CONFIG = {
    pending: { 
      icon: Clock, 
      color: 'bg-yellow-100 text-yellow-800 border-yellow-200',
      iconColor: 'text-yellow-500',
      bg: 'bg-yellow-50',
      label: 'Pending',
      description: 'Awaiting confirmation'
    },
    confirmed: { 
      icon: CheckCircle, 
      color: 'bg-blue-100 text-blue-800 border-blue-200',
      iconColor: 'text-blue-500',
      bg: 'bg-blue-50',
      label: 'Confirmed',
      description: 'Order confirmed'
    },
    processing: { 
      icon: Truck, 
      color: 'bg-purple-100 text-purple-800 border-purple-200',
      iconColor: 'text-purple-500',
      bg: 'bg-purple-50',
      label: 'Processing',
      description: 'Being prepared'
    },
    shipped: { 
      icon: Truck, 
      color: 'bg-indigo-100 text-indigo-800 border-indigo-200',
      iconColor: 'text-indigo-500',
      bg: 'bg-indigo-50',
      label: 'Shipped',
      description: 'On the way'
    },
    delivered: { 
      icon: Package, 
      color: 'bg-green-100 text-green-800 border-green-200',
      iconColor: 'text-green-500',
      bg: 'bg-green-50',
      label: 'Delivered',
      description: 'Delivered to you'
    },
    completed: { 
      icon: CheckCheck, 
      color: 'bg-emerald-100 text-emerald-800 border-emerald-200',
      iconColor: 'text-emerald-500',
      bg: 'bg-emerald-50',
      label: 'Completed',
      description: 'Order completed'
    },
    cancelled: { 
      icon: XCircle, 
      color: 'bg-red-100 text-red-800 border-red-200',
      iconColor: 'text-red-500',
      bg: 'bg-red-50',
      label: 'Cancelled',
      description: 'Order cancelled'
    }
  };

  const STATUS_FILTERS = [
    { value: 'all', label: 'All', icon: Package, count: 0 },
    { value: 'pending', label: 'Pending', icon: Clock, count: 0 },
    { value: 'confirmed', label: 'Confirmed', icon: CheckCircle, count: 0 },
    { value: 'processing', label: 'Processing', icon: Truck, count: 0 },
    { value: 'shipped', label: 'Shipped', icon: Truck, count: 0 },
    { value: 'delivered', label: 'Delivered', icon: Package, count: 0 },
    { value: 'completed', label: 'Completed', icon: CheckCheck, count: 0 }
  ];

  const DATE_RANGES = [
    { value: 'all', label: 'All Time' },
    { value: 'today', label: 'Today' },
    { value: 'week', label: '7 Days' },
    { value: 'month', label: '30 Days' },
    { value: 'quarter', label: '3 Months' }
  ];

  const SORT_OPTIONS = [
    { value: 'newest', label: 'Newest' },
    { value: 'oldest', label: 'Oldest' },
    { value: 'price-high', label: 'Price: High' },
    { value: 'price-low', label: 'Price: Low' }
  ];

  // Utility functions - COMPACT VERSIONS
  const formatCurrency = (amount) => {
    if (!amount && amount !== 0) return 'UGX 0';
    
    if (amount >= 1000000) {
      return `UGX ${(amount / 1000000).toFixed(1)}M`;
    }
    if (amount >= 1000) {
      return `UGX ${(amount / 1000).toFixed(0)}K`;
    }
    
    return `UGX ${amount.toLocaleString('en-UG', { minimumFractionDigits: 0 })}`;
  };

  const formatDate = (dateString, format = 'short') => {
    if (!dateString) return 'N/A';
    
    try {
      const date = new Date(dateString);
      if (isNaN(date.getTime())) return 'N/A';
      
      const now = new Date();
      const diffTime = Math.abs(now - date);
      const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
      
      if (format === 'relative') {
        if (diffDays === 0) return 'Today';
        if (diffDays === 1) return 'Yesterday';
        if (diffDays < 7) return `${diffDays}d ago`;
        if (diffDays < 30) return `${Math.floor(diffDays / 7)}w ago`;
        if (diffDays < 365) return `${Math.floor(diffDays / 30)}m ago`;
        return `${Math.floor(diffDays / 365)}y ago`;
      }
      
      return date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined
      });
    } catch (error) {
      return 'N/A';
    }
  };

  const getStatusConfig = (status) => {
    return STATUS_CONFIG[status] || STATUS_CONFIG.pending;
  };

  const getPaymentMethodIcon = (method) => {
    if (!method) return CreditCard;
    const methodLower = method.toLowerCase();
    if (methodLower.includes('mobile') || methodLower === 'mtn' || methodLower === 'airtel') return Wallet;
    if (methodLower.includes('cash')) return DollarSign;
    return CreditCard;
  };

  const getPaymentMethodLabel = (method) => {
    if (!method) return 'Unknown';
    const methodLower = method.toLowerCase();
    if (methodLower === 'card') return 'Card';
    if (methodLower === 'mobile_money') return 'Mobile Money';
    if (methodLower === 'mtn') return 'MTN';
    if (methodLower === 'airtel') return 'Airtel';
    if (methodLower.includes('cash')) return 'Cash';
    if (methodLower.includes('bank')) return 'Bank';
    return method;
  };

  // IMAGE HANDLING FUNCTIONS - COMPACT
  const getProductImage = (item) => {
    if (item.images && item.images.length > 0) return item.images[0];
    if (item.image) return item.image;
    if (item.productImage) return item.productImage;
    if (item.product?.images?.length > 0) return item.product.images[0];
    
    // Fallback to initials-based image
    const colors = ['ef4444', 'f59e0b', '10b981', '3b82f6', '8b5cf6', 'ec4899'];
    const color = colors[Math.floor(Math.random() * colors.length)];
    const productName = item.productName || item.name || 'Product';
    const initials = productName.substring(0, 2).toUpperCase();
    
    return `https://ui-avatars.com/api/?name=${encodeURIComponent(initials)}&background=${color}&color=fff&size=300`;
  };

  const getAllProductImages = (item) => {
    const images = [];
    
    if (item.images && Array.isArray(item.images)) {
      item.images.forEach(img => img && typeof img === 'string' && img.trim() && images.push(img.trim()));
    }
    
    if (item.image && typeof item.image === 'string' && item.image.trim()) images.push(item.image.trim());
    if (item.productImage && typeof item.productImage === 'string' && item.productImage.trim()) images.push(item.productImage.trim());
    
    if (item.product?.images && Array.isArray(item.product.images)) {
      item.product.images.forEach(img => img && typeof img === 'string' && img.trim() && images.push(img.trim()));
    }
    
    const uniqueImages = [...new Set(images.filter(img => img && img.length > 0))];
    return uniqueImages.length > 0 ? uniqueImages : [getProductImage(item)];
  };

  const handleImageError = (e, item = null) => {
    e.target.onerror = null;
    const colors = ['ef4444', 'f59e0b', '10b981', '3b82f6', '8b5cf6', 'ec4899'];
    const color = colors[Math.floor(Math.random() * colors.length)];
    const productName = item?.productName || item?.name || 'PD';
    const initials = productName.substring(0, 2).toUpperCase();
    e.target.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(initials)}&background=${color}&color=fff&size=300`;
  };

  const openImageGallery = (item) => {
    const images = getAllProductImages(item);
    setSelectedProductImages(images);
    setCurrentImageIndex(0);
    setShowImageModal(true);
  };

  const nextImage = () => setCurrentImageIndex(prev => prev < selectedProductImages.length - 1 ? prev + 1 : 0);
  const prevImage = () => setCurrentImageIndex(prev => prev > 0 ? prev - 1 : selectedProductImages.length - 1);

  const fetchOrders = async () => {
    if (!isLoggedIn || !token) {
      setError('Please login to view your orders');
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError('');
      
      const params = {
        page: currentPage,
        limit: itemsPerPage,
        status: statusFilter !== 'all' ? statusFilter : undefined,
        search: searchQuery || undefined
      };

      const response = await ordersAPI.getMyOrders(params);
      
      if (response.data.success) {
        const ordersData = response.data.orders || [];
        
        // Process orders with image handling
        const enrichedOrders = ordersData.map(order => ({
          ...order,
          items: order.items?.map(item => ({
            ...item,
            productImage: getProductImage(item),
            productImages: getAllProductImages(item),
            productName: item.productName || item.name || 'Product',
            quantity: item.quantity || 1,
            unitPrice: item.unitPrice || item.price || 0,
            totalPrice: item.totalPrice || (item.unitPrice || 0) * (item.quantity || 1)
          })) || []
        }));
        
        setOrders(enrichedOrders);
        setFilteredOrders(enrichedOrders);
        setTotalOrders(response.data.total || enrichedOrders.length);
        
        // Update status counts
        updateStatusCounts(enrichedOrders);
      } else {
        setError(response.data.message || 'Failed to fetch orders');
      }
    } catch (error) {
      console.error('Error fetching orders:', error);
      setError(error.userMessage || error.message || 'Failed to load orders. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const updateStatusCounts = (orders) => {
    STATUS_FILTERS.forEach(filter => {
      if (filter.value === 'all') {
        filter.count = orders.length;
      } else {
        filter.count = orders.filter(order => order.orderStatus === filter.value).length;
      }
    });
  };

  // Apply filters
  useEffect(() => {
    let result = [...orders];

    if (statusFilter !== 'all') {
      result = result.filter(order => order.orderStatus === statusFilter);
    }

    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      result = result.filter(order => {
        if (order.orderNumber?.toLowerCase().includes(query)) return true;
        if (order.items?.some(item => item.productName?.toLowerCase().includes(query))) return true;
        return false;
      });
    }

    if (dateRange !== 'all') {
      const now = new Date();
      const filterDate = new Date();
      
      switch (dateRange) {
        case 'today': filterDate.setHours(0, 0, 0, 0); break;
        case 'week': filterDate.setDate(now.getDate() - 7); break;
        case 'month': filterDate.setMonth(now.getMonth() - 1); break;
        case 'quarter': filterDate.setMonth(now.getMonth() - 3); break;
        default: filterDate.setHours(0, 0, 0, 0);
      }

      result = result.filter(order => {
        if (!order.createdAt) return true;
        try {
          return new Date(order.createdAt) >= filterDate;
        } catch {
          return true;
        }
      });
    }

    // Apply sorting
    result.sort((a, b) => {
      switch (sortBy) {
        case 'price-high': return (b.totalAmount || 0) - (a.totalAmount || 0);
        case 'price-low': return (a.totalAmount || 0) - (b.totalAmount || 0);
        case 'oldest': 
          try {
            return new Date(a.createdAt || 0) - new Date(b.createdAt || 0);
          } catch { return 0; }
        default: // newest
          try {
            return new Date(b.createdAt || 0) - new Date(a.createdAt || 0);
          } catch { return 0; }
      }
    });

    setFilteredOrders(result);
  }, [orders, statusFilter, searchQuery, dateRange, sortBy]);

  const handleConfirmDelivery = async () => {
    if (!selectedOrder || !confirmationNote.trim()) return;
    
    setActionLoading(true);
    try {
      const response = await ordersAPI.confirmDelivery(selectedOrder._id, confirmationNote);
      
      if (response.data.success) {
        setOrders(prev => prev.map(order => 
          order._id === selectedOrder._id 
            ? { ...order, orderStatus: 'completed', updatedAt: new Date().toISOString() }
            : order
        ));
        
        setSuccess('Order delivery confirmed successfully!');
        closeModals();
        setTimeout(() => setSuccess(''), 3000);
      } else {
        setError(response.data.message || 'Failed to confirm delivery');
      }
    } catch (error) {
      console.error('Error confirming delivery:', error);
      setError(error.userMessage || 'Failed to confirm delivery');
    } finally {
      setActionLoading(false);
    }
  };

  const handleCancelOrder = async () => {
    if (!selectedOrder || !cancellationReason.trim()) return;
    
    setActionLoading(true);
    try {
      const response = await ordersAPI.cancelOrder(selectedOrder._id, cancellationReason);
      
      if (response.data.success) {
        setOrders(prev => prev.map(order => 
          order._id === selectedOrder._id 
            ? { 
                ...order, 
                orderStatus: 'cancelled', 
                updatedAt: new Date().toISOString(),
                cancellationReason 
              }
            : order
        ));
        
        setSuccess('Order cancelled successfully!');
        closeModals();
        setTimeout(() => setSuccess(''), 3000);
      } else {
        setError(response.data.message || 'Failed to cancel order');
      }
    } catch (error) {
      console.error('Error cancelling order:', error);
      setError(error.userMessage || 'Failed to cancel order');
    } finally {
      setActionLoading(false);
    }
  };

  const openConfirmModal = (order) => {
    setSelectedOrder(order);
    setConfirmationNote('');
    setShowConfirmModal(true);
    setError('');
  };

  const openCancelModal = (order) => {
    setSelectedOrder(order);
    setCancellationReason('');
    setShowCancelModal(true);
    setError('');
  };

  const openOrderDetails = (order) => {
    setSelectedOrder(order);
    setShowOrderDetails(true);
  };

  const closeModals = () => {
    setShowConfirmModal(false);
    setShowCancelModal(false);
    setShowOrderDetails(false);
    setShowImageModal(false);
    setMobileFiltersOpen(false);
    setSelectedOrder(null);
    setSelectedProductImages([]);
    setConfirmationNote('');
    setCancellationReason('');
    setError('');
  };

  const copyOrderNumber = (orderNumber) => {
    navigator.clipboard.writeText(orderNumber);
    setSuccess(`Order #${orderNumber} copied!`);
    setTimeout(() => setSuccess(''), 2000);
  };

  const shareOrder = async (order) => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: `Order ${order.orderNumber}`,
          text: `Check out my order from Kiwa Electricals`,
          url: window.location.href
        });
      } catch (error) {
        copyOrderNumber(order.orderNumber);
      }
    } else {
      copyOrderNumber(order.orderNumber);
    }
  };

  const toggleOrderExpansion = (orderId) => {
    setExpandedOrder(expandedOrder === orderId ? null : orderId);
  };

  const clearFilters = () => {
    setStatusFilter('all');
    setSearchQuery('');
    setDateRange('all');
    setSortBy('newest');
    setMobileFiltersOpen(false);
  };

  const getActiveFiltersCount = () => {
    let count = 0;
    if (statusFilter !== 'all') count++;
    if (searchQuery) count++;
    if (dateRange !== 'all') count++;
    return count;
  };

  useEffect(() => {
    fetchOrders();
  }, [currentPage, itemsPerPage]);

  if (!isLoggedIn) {
    return (
      <div className={`min-h-screen ${themeClasses.bg} flex items-center justify-center p-4`}>
        <div className="text-center max-w-md">
          <ShoppingBag className={`h-16 w-16 ${themeClasses['text-muted']} mx-auto mb-4`} />
          <h2 className={`text-2xl font-bold ${themeClasses.text} mb-3`}>Access Your Orders</h2>
          <p className={`${themeClasses['text-muted']} mb-6`}>
            Please login to view your order history and manage purchases.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <button
              onClick={() => navigate('/login', { state: { from: '/my-orders' } })}
              className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg font-medium transition-colors"
            >
              Login to View Orders
            </button>
            <button
              onClick={() => navigate('/products')}
              className="border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 px-6 py-3 rounded-lg font-medium transition-colors"
            >
              Continue Shopping
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (loading && orders.length === 0) {
    return (
      <div className={`min-h-screen ${themeClasses.bg} py-8`}>
        <div className="max-w-7xl mx-auto px-3 sm:px-4">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
            <h2 className={`text-lg font-semibold ${themeClasses.text} mb-2`}>Loading Your Orders</h2>
            <p className={themeClasses['text-muted']}>Fetching your order history...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`min-h-screen ${themeClasses.bg} py-2 md:py-4`}>
      <div className="max-w-7xl mx-auto px-3 sm:px-4 lg:px-6">
        
        {/* Success/Error Messages - COMPACT */}
        {success && (
          <div className="mb-3 p-2 bg-green-100 border border-green-400 text-green-700 rounded-lg">
            <div className="flex items-center gap-1.5">
              <CheckCircle className="h-3.5 w-3.5" />
              <span className="text-sm">{success}</span>
              <button 
                onClick={() => setSuccess('')}
                className="ml-auto text-green-700 hover:text-green-800"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        )}

        {error && (
          <div className="mb-3 p-2 bg-red-100 border border-red-400 text-red-700 rounded-lg">
            <div className="flex items-center gap-1.5">
              <AlertCircle className="h-3.5 w-3.5" />
              <span className="text-sm">{error}</span>
              <button 
                onClick={() => setError('')}
                className="ml-auto text-red-700 hover:text-red-800"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        )}

        {/* Header Section - ULTRA COMPACT */}
        <div className={`${themeClasses.surface} shadow-xs ${themeClasses.border} border-b`}>
          <div className="max-w-7xl mx-auto px-3 sm:px-4 lg:px-6 py-1.5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
              <div className="flex items-center">
                <button
                  onClick={() => navigate('/products')}
                  className="flex items-center gap-1 text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 mr-2"
                >
                  <ArrowLeft className="h-3.5 w-3.5" />
                  <span className="text-xs hidden sm:inline">Back</span>
                </button>
                
                <div className="p-1.5 bg-blue-100 dark:bg-blue-900 rounded">
                  <ShoppingBag className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                </div>
                
                <div className="ml-2">
                  <h1 className="text-base font-bold theme-text">
                    My Orders
                    <span className="text-xs font-normal theme-text-muted ml-1.5">
                      {orders.length} orders
                    </span>
                  </h1>
                </div>
              </div>

              <div className="flex items-center gap-1.5">
                <div className="text-xs theme-text-muted">
                  <span className="font-medium">{orders.length}</span> total
                </div>
                <button
                  onClick={fetchOrders}
                  className="flex items-center gap-1 px-2 py-1 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 rounded text-xs transition-colors"
                >
                  <RefreshCw className="h-3 w-3" />
                  <span className="hidden sm:inline">Refresh</span>
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Search Bar - COMPACT */}
        <div className="mb-3">
          <div className="relative max-w-2xl mx-auto">
            <Search className="absolute left-2.5 top-1/2 transform -translate-y-1/2 h-3.5 w-3.5 theme-text-muted" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search orders or products..."
              className="w-full pl-9 pr-4 py-1.5 text-sm theme-border border rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 theme-surface theme-text"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Mobile Filter Toggle - COMPACT */}
        <div className="lg:hidden mb-2">
          <div className="flex items-center justify-between">
            <div className="text-xs theme-text-muted">
              {filteredOrders.length} orders
              {searchQuery && ` for "${searchQuery}"`}
            </div>
            <button
              onClick={() => setMobileFiltersOpen(true)}
              className="flex items-center gap-1 px-2 py-1 text-xs theme-border border rounded theme-surface theme-text hover:theme-hover transition-colors"
            >
              <Filter className="h-3 w-3" />
              Filters
              {getActiveFiltersCount() > 0 && (
                <span className="bg-blue-600 text-white text-[10px] rounded-full h-3.5 w-3.5 flex items-center justify-center">
                  {getActiveFiltersCount()}
                </span>
              )}
            </button>
          </div>
        </div>

        {/* Mobile Filter Drawer - COMPACT */}
        {mobileFiltersOpen && (
          <div className="fixed inset-0 z-50 lg:hidden">
            {/* Overlay */}
            <div 
              className="absolute inset-0 bg-black/50 backdrop-blur-xs"
              onClick={() => setMobileFiltersOpen(false)}
            />
            
            {/* Drawer */}
            <div className="absolute right-0 top-0 h-full w-full max-w-xs theme-surface shadow-lg overflow-y-auto">
              <div className="p-3">
                {/* Header */}
                <div className="flex items-center justify-between mb-3">
                  <h2 className="text-base font-semibold theme-text">Filters</h2>
                  <button
                    onClick={() => setMobileFiltersOpen(false)}
                    className="p-1 hover:bg-gray-100 dark:hover:bg-gray-800 rounded"
                  >
                    <X className="h-4 w-4 theme-text" />
                  </button>
                </div>

                {/* Clear All Button */}
                <div className="flex justify-between items-center mb-3">
                  <h3 className="font-medium theme-text text-sm">Active Filters</h3>
                  <button
                    onClick={clearFilters}
                    className="text-xs text-blue-600 hover:opacity-80"
                  >
                    Clear All
                  </button>
                </div>

                {/* Status Filter */}
                <div className="mb-3">
                  <h4 className="font-medium theme-text text-xs mb-1.5">Status</h4>
                  <div className="flex flex-wrap gap-1">
                    {STATUS_FILTERS.map((filter) => {
                      const Icon = filter.icon;
                      const isActive = statusFilter === filter.value;
                      return (
                        <button
                          key={filter.value}
                          onClick={() => setStatusFilter(filter.value)}
                          className={`flex items-center gap-1 px-2 py-1 rounded text-xs font-medium transition-all ${
                            isActive
                              ? 'bg-blue-600 text-white'
                              : 'theme-border border theme-surface theme-text hover:theme-hover'
                          }`}
                        >
                          <Icon className={`h-3 w-3 ${isActive ? 'text-white' : ''}`} />
                          <span>{filter.label}</span>
                          {filter.count > 0 && (
                            <span className={`px-1 py-0.5 text-[10px] rounded ${
                              isActive ? 'bg-white/20' : 'bg-gray-200 dark:bg-gray-700'
                            }`}>
                              {filter.count}
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Date Range Filter */}
                <div className="mb-3">
                  <h4 className="font-medium theme-text text-xs mb-1.5">Date Range</h4>
                  <select
                    value={dateRange}
                    onChange={(e) => setDateRange(e.target.value)}
                    className="w-full px-2 py-1 text-sm theme-border border rounded focus:outline-none focus:ring-1 focus:ring-blue-500 theme-surface theme-text"
                  >
                    {DATE_RANGES.map(range => (
                      <option key={range.value} value={range.value}>{range.label}</option>
                    ))}
                  </select>
                </div>

                {/* Sort Options */}
                <div className="mb-3">
                  <h4 className="font-medium theme-text text-xs mb-1.5">Sort By</h4>
                  <select
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value)}
                    className="w-full px-2 py-1 text-sm theme-border border rounded focus:outline-none focus:ring-1 focus:ring-purple-500 theme-surface theme-text"
                  >
                    {SORT_OPTIONS.map(option => (
                      <option key={option.value} value={option.value}>{option.label}</option>
                    ))}
                  </select>
                </div>

                {/* Apply Button */}
                <button
                  onClick={() => setMobileFiltersOpen(false)}
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white py-2 rounded font-medium text-sm"
                >
                  Apply Filters
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Desktop Filters - COMPACT */}
        <div className="hidden lg:block mb-3">
          <div className="flex items-center justify-between">
            {/* Status Filter Chips */}
            <div className="flex flex-wrap gap-1">
              {STATUS_FILTERS.map((filter) => {
                const Icon = filter.icon;
                const isActive = statusFilter === filter.value;
                return (
                  <button
                    key={filter.value}
                    onClick={() => setStatusFilter(filter.value)}
                    className={`flex items-center gap-1 px-2 py-1 rounded text-xs font-medium transition-all ${
                      isActive
                        ? 'bg-blue-600 text-white'
                        : 'theme-border border theme-surface theme-text hover:theme-hover'
                    }`}
                  >
                    <Icon className={`h-3 w-3 ${isActive ? 'text-white' : ''}`} />
                    <span>{filter.label}</span>
                    {filter.count > 0 && (
                      <span className={`px-1 py-0.5 text-[10px] rounded ${
                        isActive ? 'bg-white/20' : 'bg-gray-200 dark:bg-gray-700'
                      }`}>
                        {filter.count}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            {/* Right Side Controls */}
            <div className="flex items-center gap-2">
              {/* Date Range */}
              <select
                value={dateRange}
                onChange={(e) => setDateRange(e.target.value)}
                className="px-2 py-1 text-xs theme-border border rounded theme-surface theme-text focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                {DATE_RANGES.map(range => (
                  <option key={range.value} value={range.value}>{range.label}</option>
                ))}
              </select>

              {/* Sort Options */}
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="px-2 py-1 text-xs theme-border border rounded theme-surface theme-text focus:outline-none focus:ring-1 focus:ring-purple-500"
              >
                {SORT_OPTIONS.map(option => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Orders List */}
        <div className="space-y-2">
          {filteredOrders.length === 0 ? (
            <EmptyState 
              statusFilter={statusFilter}
              searchQuery={searchQuery}
              onClearFilters={clearFilters}
            />
          ) : (
            filteredOrders.map((order) => (
              <OrderCard
                key={order._id}
                order={order}
                isExpanded={expandedOrder === order._id}
                onToggleExpand={() => toggleOrderExpansion(order._id)}
                onViewDetails={() => openOrderDetails(order)}
                onConfirmDelivery={() => openConfirmModal(order)}
                onCancelOrder={() => openCancelModal(order)}
                onCopyOrderNumber={copyOrderNumber}
                onShareOrder={shareOrder}
                onViewImages={openImageGallery}
                formatCurrency={formatCurrency}
                formatDate={formatDate}
                getStatusConfig={getStatusConfig}
                getPaymentMethodIcon={getPaymentMethodIcon}
                getPaymentMethodLabel={getPaymentMethodLabel}
                handleImageError={handleImageError}
                getProductImage={getProductImage}
                getAllProductImages={getAllProductImages}
              />
            ))
          )}
        </div>

        {/* No Orders State */}
        {orders.length === 0 && !loading && (
          <div className={`${themeClasses.card} rounded-lg border ${themeClasses.border} p-6 text-center mt-4`}>
            <ShoppingCart className={`h-12 w-12 ${themeClasses['text-muted']} mx-auto mb-3`} />
            <h3 className={`text-lg font-bold ${themeClasses.text} mb-1`}>No Orders Yet</h3>
            <p className={`${themeClasses['text-muted']} text-sm mb-4`}>
              You haven't placed any orders yet. Browse our products and make your first purchase!
            </p>
            <button
              onClick={() => navigate('/products')}
              className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium text-sm transition-colors"
            >
              Start Shopping Now
            </button>
          </div>
        )}
      </div>

      {/* Modals */}
      {showConfirmModal && (
        <ConfirmDeliveryModal
          order={selectedOrder}
          confirmationNote={confirmationNote}
          onConfirmationNoteChange={setConfirmationNote}
          onConfirm={handleConfirmDelivery}
          onClose={closeModals}
          isLoading={actionLoading}
          formatCurrency={formatCurrency}
        />
      )}

      {showCancelModal && (
        <CancelOrderModal
          order={selectedOrder}
          cancellationReason={cancellationReason}
          onCancellationReasonChange={setCancellationReason}
          onConfirm={handleCancelOrder}
          onClose={closeModals}
          isLoading={actionLoading}
        />
      )}

      {showOrderDetails && (
        <OrderDetailsModal
          order={selectedOrder}
          onClose={closeModals}
          onViewImages={openImageGallery}
          formatCurrency={formatCurrency}
          formatDate={formatDate}
          getStatusConfig={getStatusConfig}
          getPaymentMethodIcon={getPaymentMethodIcon}
          getPaymentMethodLabel={getPaymentMethodLabel}
          handleImageError={handleImageError}
          getProductImage={getProductImage}
          getAllProductImages={getAllProductImages}
          onCopyOrderNumber={copyOrderNumber}
        />
      )}

      {showImageModal && (
        <ImageGalleryModal
          images={selectedProductImages}
          currentIndex={currentImageIndex}
          onNext={nextImage}
          onPrev={prevImage}
          onClose={() => setShowImageModal(false)}
          handleImageError={handleImageError}
        />
      )}
    </div>
  );
};

// Sub-Components with Compact Design

const EmptyState = ({ statusFilter, searchQuery, onClearFilters }) => {
  const hasFilters = statusFilter !== 'all' || searchQuery;
  
  return (
    <div className="theme-card rounded-lg border theme-border p-6 text-center">
      <Package className="h-12 w-12 theme-text-muted mx-auto mb-3" />
      <h3 className="text-lg font-bold theme-text mb-1">
        {hasFilters ? 'No Matching Orders' : 'No Orders Found'}
      </h3>
      <p className="theme-text-muted text-sm mb-4">
        {hasFilters 
          ? 'No orders match your current filters.'
          : 'You have not placed any orders yet.'
        }
      </p>
      {hasFilters && (
        <button
          onClick={onClearFilters}
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium text-sm transition-colors"
        >
          Clear Filters
        </button>
      )}
    </div>
  );
};

const OrderCard = ({ 
  order, 
  isExpanded, 
  onToggleExpand, 
  onViewDetails, 
  onConfirmDelivery, 
  onCancelOrder,
  onCopyOrderNumber,
  onShareOrder,
  onViewImages,
  formatCurrency, 
  formatDate,
  getStatusConfig,
  getPaymentMethodIcon,
  getPaymentMethodLabel,
  handleImageError,
  getProductImage,
  getAllProductImages
}) => {
  const statusConfig = getStatusConfig(order.orderStatus);
  const StatusIcon = statusConfig.icon;
  const PaymentIcon = getPaymentMethodIcon(order.paymentMethod);
  const totalItems = order.items?.reduce((sum, item) => sum + (item.quantity || 1), 0) || 0;

  return (
    <div className="theme-card rounded-lg border theme-border overflow-hidden transition-all hover:shadow-sm">
      {/* Order Header - COMPACT */}
      <div className="p-3 border-b theme-border">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <div className={`p-1 rounded ${statusConfig.bg}`}>
                <StatusIcon className={`h-3.5 w-3.5 ${statusConfig.iconColor}`} />
              </div>
              <h3 className="text-sm font-semibold theme-text truncate">
                #{order.orderNumber || 'N/A'}
              </h3>
              <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-medium ${statusConfig.color}`}>
                {statusConfig.label}
              </span>
            </div>
            
            <div className="flex items-center gap-2 text-xs theme-text-muted">
              <span>{totalItems} item{totalItems !== 1 ? 's' : ''}</span>
              <span>•</span>
              <span>{formatDate(order.createdAt)}</span>
              <span>•</span>
              <PaymentIcon className="h-3 w-3" />
              <span className="text-xs">{getPaymentMethodLabel(order.paymentMethod)}</span>
            </div>
          </div>

          <div className="flex flex-col items-end gap-1">
            <div className="text-right">
              <p className="text-sm font-bold theme-text">
                {formatCurrency(order.totalAmount)}
              </p>
            </div>
            
            <div className="flex items-center gap-1">
              <button
                onClick={onViewDetails}
                className="p-1 hover:bg-blue-700 dark:hover:bg-blue-600 rounded transition-colors"
                title="View Details"
              >
                <Eye className="h-3.5 w-3.5" />
              </button>
              <button
                onClick={onToggleExpand}
                className="p-1 hover:bg-gray-100 dark:hover:bg-gray-800 rounded transition-colors"
                title={isExpanded ? "Hide Items" : "Show Items"}
              >
                {isExpanded ? (
                  <ChevronUp className="h-3.5 w-3.5" />
                ) : (
                  <ChevronDown className="h-3.5 w-3.5" />
                )}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Expanded Items - COMPACT */}
      {isExpanded && (
        <div className="p-3 border-b border-border bg-surface">
  <h4 className="text-xs font-medium text-text mb-2">Order Items</h4>
  <div className="space-y-2">
            {order.items?.map((item, index) => {
              const productImages = getAllProductImages(item);
              const mainImage = getProductImage(item);
              const hasMultipleImages = productImages.length > 1;
              
              return (
                <div key={index} className="flex items-center gap-2 p-2 bg-white dark:bg-gray-800 rounded">
                  {/* Product Image with Gallery Button */}
                  <div className="relative">
                    <button
                      onClick={() => onViewImages(item)}
                      className="relative w-12 h-12 rounded border theme-border bg-white dark:bg-gray-700 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    >
                      <img
                        src={mainImage}
                        alt={item.productName}
                        className="w-full h-full object-contain p-0.5"
                        onError={(e) => handleImageError(e, item)}
                      />
                      
                      {hasMultipleImages && (
                        <div className="absolute bottom-0 right-0 bg-black/70 text-white text-[10px] px-1 py-0.5 rounded-tl">
                          {productImages.length}
                        </div>
                      )}
                    </button>
                  </div>
                  
                  {/* Product Info */}
                  <div className="flex-1 min-w-0">
                    <h5 className="text-sm font-medium theme-text truncate">{item.productName}</h5>
                    <div className="flex items-center gap-2 text-xs theme-text-muted">
                      <span>Qty: {item.quantity}</span>
                      <span>×</span>
                      <span>{formatCurrency(item.unitPrice)}</span>
                    </div>
                  </div>
                  
                  {/* Total Price */}
                  <div className="text-right">
                    <p className="text-sm font-semibold theme-text">{formatCurrency(item.totalPrice)}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Action Buttons - COMPACT */}
      <div className="p-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1">
            <button
              onClick={() => onCopyOrderNumber(order.orderNumber)}
              className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-800 rounded text-xs transition-colors"
              title="Copy Order Number"
            >
              <Copy className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={() => onShareOrder(order)}
              className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-800 rounded text-xs transition-colors"
              title="Share Order"
            >
              <Share2 className="h-3.5 w-3.5" />
            </button>
          </div>

          <div className="flex items-center gap-1">
            {order.orderStatus === 'delivered' && (
              <button
                onClick={onConfirmDelivery}
                className="flex items-center gap-1 px-2 py-1 bg-green-600 hover:bg-green-700 text-white rounded text-xs transition-colors"
              >
                <Check className="h-3 w-3" />
                <span className="hidden sm:inline">Confirm</span>
              </button>
            )}
            
            {['pending', 'confirmed'].includes(order.orderStatus) && (
              <button
                onClick={onCancelOrder}
                className="flex items-center gap-1 px-2 py-1 bg-red-600 hover:bg-red-700 text-white rounded text-xs transition-colors"
              >
                <X className="h-3 w-3" />
                <span className="hidden sm:inline">Cancel</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

const ConfirmDeliveryModal = ({ 
  order, 
  confirmationNote, 
  onConfirmationNoteChange, 
  onConfirm, 
  onClose, 
  isLoading,
  formatCurrency
}) => {
  return (
    <ModalWrapper onClose={onClose} size="sm">
      <div className="p-4">
        <div className="flex items-center gap-2 mb-4">
          <div className="p-2 bg-green-100 dark:bg-green-900 rounded">
            <CheckCircle className="h-5 w-5 text-green-600 dark:text-green-400" />
          </div>
          <div>
            <h3 className="text-base font-semibold theme-text">Confirm Delivery</h3>
            <p className="text-xs theme-text-muted">Order #{order?.orderNumber}</p>
          </div>
        </div>
        
        <div className="mb-4">
          <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded p-3 mb-3">
            <p className="text-sm text-green-600 dark:text-green-300">
              Please confirm that you have received all items in good condition.
            </p>
          </div>
          
          <label className="block text-sm font-medium theme-text mb-1">
            Confirmation Note *
          </label>
          <textarea
            value={confirmationNote}
            onChange={(e) => onConfirmationNoteChange(e.target.value)}
            placeholder="Confirm receipt of all items..."
            className="w-full p-2 theme-border border rounded theme-surface theme-text focus:outline-none focus:ring-1 focus:ring-blue-500 text-sm"
            rows="2"
            required
          />
        </div>

        <div className="flex gap-2 justify-end">
          <button
            onClick={onClose}
            className="px-3 py-1.5 theme-border border rounded text-sm hover:theme-hover transition-colors"
            disabled={isLoading}
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={!confirmationNote.trim() || isLoading}
            className="px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white rounded text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1"
          >
            {isLoading ? (
              <>
                <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-white"></div>
                Confirming...
              </>
            ) : (
              <>
                <Check className="h-3.5 w-3.5" />
                Confirm
              </>
            )}
          </button>
        </div>
      </div>
    </ModalWrapper>
  );
};

const CancelOrderModal = ({ 
  order, 
  cancellationReason, 
  onCancellationReasonChange, 
  onConfirm, 
  onClose, 
  isLoading
}) => {
  return (
    <ModalWrapper onClose={onClose} size="sm">
      <div className="p-4">
        <div className="flex items-center gap-2 mb-4">
          <div className="p-2 bg-red-100 dark:bg-red-900 rounded">
            <AlertCircle className="h-5 w-5 text-red-600 dark:text-red-400" />
          </div>
          <div>
            <h3 className="text-base font-semibold theme-text">Cancel Order</h3>
            <p className="text-xs theme-text-muted">Order #{order?.orderNumber}</p>
          </div>
        </div>
        
        <div className="mb-4">
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded p-3 mb-3">
            <p className="text-sm text-red-600 dark:text-red-300">
              Are you sure? This cannot be undone.
            </p>
          </div>
          
          <label className="block text-sm font-medium theme-text mb-1">
            Reason *
          </label>
          <textarea
            value={cancellationReason}
            onChange={(e) => onCancellationReasonChange(e.target.value)}
            placeholder="Why are you cancelling this order?"
            className="w-full p-2 theme-border border rounded theme-surface theme-text focus:outline-none focus:ring-1 focus:ring-blue-500 text-sm"
            rows="2"
            required
          />
        </div>

        <div className="flex gap-2 justify-end">
          <button
            onClick={onClose}
            className="px-3 py-1.5 theme-border border rounded text-sm hover:theme-hover transition-colors"
            disabled={isLoading}
          >
            Keep Order
          </button>
          <button
            onClick={onConfirm}
            disabled={!cancellationReason.trim() || isLoading}
            className="px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1"
          >
            {isLoading ? (
              <>
                <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-white"></div>
                Cancelling...
              </>
            ) : (
              <>
                <X className="h-3.5 w-3.5" />
                Cancel
              </>
            )}
          </button>
        </div>
      </div>
    </ModalWrapper>
  );
};

const OrderDetailsModal = ({ 
  order, 
  onClose, 
  onViewImages,
  formatCurrency, 
  formatDate,
  getStatusConfig,
  getPaymentMethodIcon,
  getPaymentMethodLabel,
  handleImageError,
  getProductImage,
  getAllProductImages,
  onCopyOrderNumber
}) => {
  const statusConfig = getStatusConfig(order.orderStatus);
  const StatusIcon = statusConfig.icon;
  const PaymentIcon = getPaymentMethodIcon(order.paymentMethod);
  const totalItems = order.items?.reduce((sum, item) => sum + (item.quantity || 1), 0) || 0;

  return (
    <ModalWrapper onClose={onClose} size="xl">
      <div className="p-4">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-blue-100 dark:bg-blue-900 rounded">
              <Receipt className="h-4 w-4 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <h3 className="text-base font-semibold theme-text">Order Details</h3>
              <p className="text-xs theme-text-muted">#{order.orderNumber || 'N/A'}</p>
            </div>
          </div>
          <div className="flex gap-1">
            <button
              onClick={() => onCopyOrderNumber(order.orderNumber)}
              className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-800 rounded"
              title="Copy Order Number"
            >
              <Copy className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>

        {/* Status Banner */}
        <div className={`${statusConfig.bg} border ${statusConfig.color.split(' ')[2]} rounded p-3 mb-4`}>
          <div className="flex items-center gap-2">
            <StatusIcon className={`h-4 w-4 ${statusConfig.iconColor}`} />
            <div className="flex-1">
              <h4 className="text-sm font-medium theme-text">{statusConfig.label}</h4>
              <p className="text-xs theme-text-muted">{statusConfig.description}</p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Order Items */}
          <div className="lg:col-span-2">
            <h4 className="text-sm font-semibold theme-text mb-2">Items ({totalItems})</h4>
            <div className="space-y-2 mb-4">
              {order.items?.map((item, index) => {
                const productImages = getAllProductImages(item);
                const mainImage = getProductImage(item);
                
                return (
                  <div key={index} className="flex items-center gap-2 p-2 bg-gray-50 dark:bg-gray-800 rounded">
                    <button
                      onClick={() => onViewImages(item)}
                      className="relative w-10 h-10 rounded border theme-border bg-white dark:bg-gray-700"
                    >
                      <img
                        src={mainImage}
                        alt={item.productName}
                        className="w-full h-full object-contain p-0.5"
                        onError={(e) => handleImageError(e, item)}
                      />
                      {productImages.length > 1 && (
                        <div className="absolute -top-1 -right-1 bg-blue-600 text-white text-[10px] rounded-full h-4 w-4 flex items-center justify-center">
                          {productImages.length}
                        </div>
                      )}
                    </button>
                    <div className="flex-1 min-w-0">
                      <h5 className="text-sm font-medium theme-text truncate">{item.productName}</h5>
                      <div className="flex items-center gap-1 text-xs theme-text-muted">
                        <span>Qty: {item.quantity}</span>
                        <span>×</span>
                        <span>{formatCurrency(item.unitPrice)}</span>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-semibold theme-text">{formatCurrency(item.totalPrice)}</p>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Order Timeline */}
            <h4 className="text-sm font-semibold theme-text mb-2">Timeline</h4>
            <div className="space-y-2">
              {[
                { label: 'Order Placed', date: order.createdAt, active: true },
                { label: 'Confirmed', date: order.confirmedAt || order.updatedAt, active: order.orderStatus !== 'pending' },
                { label: 'Processing', date: order.processingAt || order.updatedAt, active: ['processing', 'shipped', 'delivered', 'completed'].includes(order.orderStatus) },
                { label: 'Delivered', date: order.deliveredAt || order.updatedAt, active: ['delivered', 'completed'].includes(order.orderStatus) }
              ].map((step, index) => (
                step.date && (
                  <div key={index} className="flex items-center gap-2">
                    <div className={`w-2 h-2 rounded-full ${step.active ? 'bg-blue-500' : 'bg-gray-300 dark:bg-gray-600'}`}></div>
                    <span className={`text-sm ${step.active ? 'theme-text font-medium' : 'theme-text-muted'}`}>
                      {step.label}
                    </span>
                    <span className="text-xs theme-text-muted ml-auto">
                      {formatDate(step.date)}
                    </span>
                  </div>
                )
              ))}
            </div>
          </div>

          {/* Order Summary */}
          <div>
            <div className="theme-card border theme-border rounded p-3 mb-3">
              <h4 className="text-sm font-semibold theme-text mb-2">Order Summary</h4>
              <div className="space-y-1.5 text-sm">
                <div className="flex justify-between">
                  <span className="theme-text-muted">Subtotal</span>
                  <span className="theme-text">{formatCurrency(order.subtotal || order.totalAmount)}</span>
                </div>
                {order.shippingFee > 0 && (
                  <div className="flex justify-between">
                    <span className="theme-text-muted">Shipping</span>
                    <span className="theme-text">{formatCurrency(order.shippingFee)}</span>
                  </div>
                )}
                <div className="border-t theme-border pt-1.5 mt-1.5">
                  <div className="flex justify-between font-semibold">
                    <span className="theme-text">Total</span>
                    <span className="theme-text">{formatCurrency(order.totalAmount)}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Payment Info */}
            <div className="theme-card border theme-border rounded p-3 mb-3">
              <h4 className="text-sm font-semibold theme-text mb-2">Payment</h4>
              <div className="flex items-center gap-2">
                <PaymentIcon className="h-4 w-4 theme-text-muted" />
                <div>
                  <p className="text-sm font-medium theme-text">
                    {getPaymentMethodLabel(order.paymentMethod)}
                  </p>
                  <p className="text-xs theme-text-muted">
                    Paid {formatDate(order.paidAt || order.createdAt, 'relative')}
                  </p>
                </div>
              </div>
            </div>

            {/* Support */}
            <div className="text-center">
              <button
                onClick={() => window.open(`https://wa.me/256751808507?text=Hi, I need help with order ${order.orderNumber}`, '_blank')}
                className="w-full flex items-center justify-center gap-1.5 px-3 py-2 bg-green-600 hover:bg-green-700 text-white rounded text-sm transition-colors"
              >
                <MessageCircle className="h-3.5 w-3.5" />
                Contact Support
              </button>
            </div>
          </div>
        </div>

        {/* Close Button */}
        <div className="flex justify-end mt-4">
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-800 dark:text-gray-200 rounded text-sm transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </ModalWrapper>
  );
};

const ImageGalleryModal = ({ 
  images, 
  currentIndex, 
  onNext, 
  onPrev, 
  onClose,
  handleImageError
}) => {
  const currentImage = images[currentIndex] || '';
  
  return (
    <div 
      className="fixed inset-0 bg-black/90 flex items-center justify-center p-4 z-50"
      onClick={onClose}
    >
      <div 
        className="relative w-full max-w-2xl max-h-[80vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 z-10 p-2 bg-black/50 text-white rounded-full hover:bg-black/70"
        >
          <X className="h-5 w-5" />
        </button>
        
        {/* Navigation buttons */}
        {images.length > 1 && (
          <>
            <button
              onClick={onPrev}
              className="absolute left-4 top-1/2 transform -translate-y-1/2 z-10 p-2 bg-black/50 text-white rounded-full hover:bg-black/70"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
            <button
              onClick={onNext}
              className="absolute right-4 top-1/2 transform -translate-y-1/2 z-10 p-2 bg-black/50 text-white rounded-full hover:bg-black/70"
            >
              <ChevronRight className="h-5 w-5" />
            </button>
          </>
        )}
        
        {/* Main image */}
        <div className="w-full h-[60vh] flex items-center justify-center">
          <img
            src={currentImage}
            alt={`Product image ${currentIndex + 1}`}
            className="max-w-full max-h-full object-contain"
            onError={(e) => handleImageError(e)}
          />
        </div>
        
        {/* Image counter */}
        <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 bg-black/50 text-white px-3 py-1 rounded-full text-sm">
          {currentIndex + 1} / {images.length}
        </div>
      </div>
    </div>
  );
};

const ModalWrapper = ({ children, onClose, size = 'md' }) => {
  const sizeClasses = {
    sm: 'max-w-sm',
    md: 'max-w-md',
    lg: 'max-w-lg',
    xl: 'max-w-2xl'
  };

  return (
    <div 
      className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50"
      onClick={onClose}
    >
      <div 
        className={`theme-surface rounded-lg shadow-xl border theme-border ${sizeClasses[size]} w-full max-h-[90vh] overflow-y-auto`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 z-10 p-2 border-b theme-border bg-white dark:bg-gray-900 flex justify-end">
          <button
            onClick={onClose}
            className="p-1 hover:bg-gray-100 dark:hover:bg-gray-800 rounded"
          >
            <X className="h-4 w-4 theme-text" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
};

export default MyOrders;