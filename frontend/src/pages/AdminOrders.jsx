// AdminOrders.jsx - MOBILE OPTIMIZED VERSION
import React, { useState, useEffect, useCallback } from 'react';
import { 
  Package, Clock, Truck, CheckCircle, XCircle, AlertCircle, 
  RefreshCw, X, ChevronLeft, ChevronRight, Eye, EyeOff, 
  Filter, User, ShoppingCart, Briefcase,
  Calendar, Search, MoreVertical,
  ShoppingBag, Users, DollarSign, TrendingUp,
  Layers, Loader2
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { ordersAPI } from '../services/api';

const AdminOrders = () => {
  const { user } = useAuth();
  const { currentTheme } = useTheme();
  
  // State Management
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [rejectReason, setRejectReason] = useState('');
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [imageIndices, setImageIndices] = useState({});
  
  // Filter & View State
  const [activeView, setActiveView] = useState('my-products'); // Default to my-products
  const [statusFilter, setStatusFilter] = useState('all');
  const [dateRange, setDateRange] = useState({ start: '', end: '' });
  const [searchTerm, setSearchTerm] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalOrders, setTotalOrders] = useState(0);
  const [stats, setStats] = useState({
    totalOrders: 0,
    totalRevenue: 0,
    pendingOrders: 0,
    processingOrders: 0,
    deliveredOrders: 0,
    confirmedOrders: 0,
    cancelledOrders: 0,
    averageOrderValue: 0
  });
  const [showFilters, setShowFilters] = useState(false);
  
  // Constants
  const limit = 12;
  
  // ONLY TWO PERSONAL VIEWS
  const viewModes = [
    { 
      id: 'my-products', 
      label: 'My Products', 
      icon: ShoppingCart, 
      description: 'Orders with my products',
      color: 'bg-blue-500'
    },
    { 
      id: 'my-processed', 
      label: 'My Processed', 
      icon: Briefcase, 
      description: 'Orders I processed',
      color: 'bg-green-500'
    }
  ];

  // Compact theme-aware styling
  const getThemeClasses = () => {
    const baseClasses = {
      dark: {
        bg: {
          primary: 'bg-gray-900',
          secondary: 'bg-gray-800',
          tertiary: 'bg-gray-700',
          light: 'bg-gray-800'
        },
        text: {
          primary: 'text-white',
          secondary: 'text-gray-300',
          muted: 'text-gray-400',
          accent: 'text-blue-400'
        },
        border: 'border-gray-700',
        surface: 'bg-gray-800',
        hover: 'hover:bg-gray-700',
        card: 'bg-gray-800 border-gray-700',
        input: 'bg-gray-700 border-gray-600 text-white placeholder-gray-400 text-sm',
        button: {
          primary: 'bg-blue-600 hover:bg-blue-700 text-white text-sm',
          secondary: 'bg-gray-700 hover:bg-gray-600 text-white text-sm',
          danger: 'bg-red-600 hover:bg-red-700 text-white text-sm',
          success: 'bg-green-600 hover:bg-green-700 text-white text-sm',
          ghost: 'bg-transparent hover:bg-gray-700 text-gray-300 text-sm'
        },
        customerInfo: 'bg-gray-800 border-gray-700'
      },
      ocean: {
        bg: {
          primary: 'bg-gradient-to-br from-blue-50 to-cyan-50',
          secondary: 'bg-white',
          tertiary: 'bg-blue-50',
          light: 'bg-white'
        },
        text: {
          primary: 'text-gray-900',
          secondary: 'text-gray-700',
          muted: 'text-gray-500',
          accent: 'text-blue-600'
        },
        border: 'border-blue-200',
        surface: 'bg-white',
        hover: 'hover:bg-blue-50',
        card: 'bg-white border-blue-200',
        input: 'bg-white border-blue-300 text-gray-900 placeholder-gray-500 text-sm',
        button: {
          primary: 'bg-blue-600 hover:bg-blue-700 text-white text-sm',
          secondary: 'bg-blue-100 hover:bg-blue-200 text-blue-700 text-sm',
          danger: 'bg-red-600 hover:bg-red-700 text-white text-sm',
          success: 'bg-green-600 hover:bg-green-700 text-white text-sm',
          ghost: 'bg-transparent hover:bg-blue-50 text-blue-600 text-sm'
        },
        customerInfo: 'bg-blue-50 border-blue-200'
      },
      light: {
        bg: {
          primary: 'bg-gray-50',
          secondary: 'bg-white',
          tertiary: 'bg-gray-100',
          light: 'bg-white'
        },
        text: {
          primary: 'text-gray-900',
          secondary: 'text-gray-700',
          muted: 'text-gray-500',
          accent: 'text-blue-600'
        },
        border: 'border-gray-200',
        surface: 'bg-white',
        hover: 'hover:bg-gray-50',
        card: 'bg-white border-gray-200',
        input: 'bg-white border-gray-300 text-gray-900 placeholder-gray-500 text-sm',
        button: {
          primary: 'bg-blue-600 hover:bg-blue-700 text-white text-sm',
          secondary: 'bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm',
          danger: 'bg-red-600 hover:bg-red-700 text-white text-sm',
          success: 'bg-green-600 hover:bg-green-700 text-white text-sm',
          ghost: 'bg-transparent hover:bg-gray-100 text-gray-600 text-sm'
        },
        customerInfo: 'bg-gray-50 border-gray-200'
      }
    };
    
    return baseClasses[currentTheme] || baseClasses.light;
  };

  const themeClasses = getThemeClasses();

  // Debug logging
  useEffect(() => {
    console.log('🔍 ADMIN ORDERS:', {
      activeView,
      userId: user?._id,
    });
  }, [activeView, user]);

  // Image navigation
  const navigateImage = useCallback((orderId, direction) => {
    setImageIndices(prev => {
      const order = orders.find(o => o._id === orderId);
      if (!order || !order.items || order.items.length === 0) return prev;
      
      const currentIndex = prev[orderId] || 0;
      const totalImages = order.items.reduce((total, item) => total + (item.images?.length || 0), 0);
      
      if (totalImages === 0) return prev;
      
      let newIndex;
      if (direction === 'next') {
        newIndex = (currentIndex + 1) % totalImages;
      } else {
        newIndex = (currentIndex - 1 + totalImages) % totalImages;
      }
      
      return { ...prev, [orderId]: newIndex };
    });
  }, [orders]);

  const getCurrentImage = useCallback((order) => {
    if (!order || !order.items || order.items.length === 0) return null;
    
    const currentIndex = imageIndices[order._id] || 0;
    let imageCount = 0;
    
    for (const item of order.items) {
      if (!item.images || item.images.length === 0) continue;
      
      for (let i = 0; i < item.images.length; i++) {
        if (imageCount === currentIndex) {
          return {
            url: item.images[i],
            productName: item.productName,
            itemIndex: order.items.indexOf(item),
            imageIndex: i
          };
        }
        imageCount++;
      }
    }
    
    return null;
  }, [imageIndices]);

  // Fetch orders
  const fetchOrders = useCallback(async () => {
    if (!user || user.role !== 'admin') return;
    
    try {
      setLoading(true);
      setError('');
      
      // Build query params
      const params = {
        page,
        limit,
        status: statusFilter !== 'all' ? statusFilter : undefined,
        startDate: dateRange.start || undefined,
        endDate: dateRange.end || undefined,
        search: searchTerm || undefined
      };
      
      let response;
      
      // Determine which personal API endpoint to call
      if (activeView === 'my-products') {
        response = await ordersAPI.getAdminProductOrders(params);
      } else {
        response = await ordersAPI.getAdminProcessedOrders(params);
      }
      
      if (response.data.success) {
        setOrders(response.data.orders || []);
        setTotalOrders(response.data.total || 0);
        setTotalPages(response.data.pagination?.totalPages || 1);
        
        if (response.data.orders.length > 0) {
          const viewLabel = viewModes.find(v => v.id === activeView)?.label || 'View';
          setSuccess(`Showing ${response.data.orders.length} orders`);
          setTimeout(() => setSuccess(''), 2000);
        }
      } else {
        setError(response.data.message || 'Failed to fetch orders');
      }
    } catch (error) {
      console.error('Error fetching orders:', error);
      setError(error.userMessage || error.message || 'Failed to load orders');
      setOrders([]);
      setTotalOrders(0);
    } finally {
      setLoading(false);
    }
  }, [user, activeView, page, statusFilter, dateRange, searchTerm]);

  // Fetch order statistics
  const fetchStats = useCallback(async () => {
    if (!user || user.role !== 'admin') return;
    
    try {
      const statsView = activeView === 'my-products' ? 'my-products' : 'my-processed';
      
      const response = await ordersAPI.getOrderStats({ 
        view: statsView,
        period: 'month'
      });
      
      if (response.data.success) {
        setStats(response.data.stats);
      } else {
        setStats({
          totalOrders: 0,
          totalRevenue: 0,
          pendingOrders: 0,
          processingOrders: 0,
          deliveredOrders: 0,
          confirmedOrders: 0,
          cancelledOrders: 0,
          averageOrderValue: 0
        });
      }
    } catch (error) {
      console.error('Error fetching stats:', error.message);
      setStats({
        totalOrders: 0,
        totalRevenue: 0,
        pendingOrders: 0,
        processingOrders: 0,
        deliveredOrders: 0,
        confirmedOrders: 0,
        cancelledOrders: 0,
        averageOrderValue: 0
      });
    }
  }, [user, activeView]);

  // Order actions
  const processOrder = async (orderId) => {
    if (!user || user.role !== 'admin') {
      setError('Only admin users can process orders');
      return;
    }
    
    setActionLoading(true);
    try {
      const response = await ordersAPI.processOrder(orderId);
      if (response.data.success) {
        setSuccess('Order processed');
        setTimeout(() => setSuccess(''), 2000);
        fetchOrders();
        fetchStats();
      } else {
        setError(response.data.message || 'Failed to process order');
      }
    } catch (error) {
      console.error('Error processing order:', error);
      setError(error.userMessage || error.message || 'Failed to process order');
    } finally {
      setActionLoading(false);
    }
  };

  const deliverOrder = async (orderId) => {
    if (!user || user.role !== 'admin') {
      setError('Only admin users can deliver orders');
      return;
    }
    
    setActionLoading(true);
    try {
      const response = await ordersAPI.deliverOrder(orderId);
      if (response.data.success) {
        setSuccess('Order delivered');
        setTimeout(() => setSuccess(''), 2000);
        fetchOrders();
        fetchStats();
      } else {
        setError(response.data.message || 'Failed to deliver order');
      }
    } catch (error) {
      console.error('Error delivering order:', error);
      setError(error.userMessage || error.message || 'Failed to deliver order');
    } finally {
      setActionLoading(false);
    }
  };

  const rejectOrder = async () => {
    if (!selectedOrder || !rejectReason.trim()) return;
    
    if (!user || user.role !== 'admin') {
      setError('Only admin users can reject orders');
      return;
    }
    
    setActionLoading(true);
    try {
      const response = await ordersAPI.rejectOrder(selectedOrder._id, rejectReason);
      if (response.data.success) {
        setSuccess('Order rejected');
        setTimeout(() => setSuccess(''), 2000);
        setSelectedOrder(null);
        setRejectReason('');
        fetchOrders();
        fetchStats();
      } else {
        setError(response.data.message || 'Failed to reject order');
      }
    } catch (error) {
      console.error('Error rejecting order:', error);
      setError(error.userMessage || error.message || 'Failed to reject order');
    } finally {
      setActionLoading(false);
    }
  };

  // Helper functions
  const getStatusIcon = (status) => {
    switch (status) {
      case 'pending': return <Clock className="h-3 w-3 text-yellow-500" />;
      case 'processing': return <Truck className="h-3 w-3 text-blue-500" />;
      case 'delivered': return <Truck className="h-3 w-3 text-purple-500" />;
      case 'confirmed': return <CheckCircle className="h-3 w-3 text-green-500" />;
      case 'cancelled': return <XCircle className="h-3 w-3 text-red-500" />;
      default: return <Clock className="h-3 w-3 text-gray-500" />;
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'pending': return 'bg-yellow-100 text-yellow-800 border-yellow-200 dark:bg-yellow-900/20 dark:text-yellow-300 dark:border-yellow-800 text-xs';
      case 'processing': return 'bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-900/20 dark:text-blue-300 dark:border-blue-800 text-xs';
      case 'delivered': return 'bg-purple-100 text-purple-800 border-purple-200 dark:bg-purple-900/20 dark:text-purple-300 dark:border-purple-800 text-xs';
      case 'confirmed': return 'bg-green-100 text-green-800 border-green-200 dark:bg-green-900/20 dark:text-green-300 dark:border-green-800 text-xs';
      case 'cancelled': return 'bg-red-100 text-red-800 border-red-200 dark:bg-red-900/20 dark:text-red-300 dark:border-red-800 text-xs';
      default: return 'bg-gray-100 text-gray-800 border-gray-200 dark:bg-gray-900/20 dark:text-gray-300 dark:border-gray-800 text-xs';
    }
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-UG', {
      style: 'currency',
      currency: 'UGX',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  const closeRejectModal = () => {
    setSelectedOrder(null);
    setRejectReason('');
  };

  const clearFilters = () => {
    setStatusFilter('all');
    setDateRange({ start: '', end: '' });
    setSearchTerm('');
    setPage(1);
  };

  // Effects
  useEffect(() => {
    if (user && user.role === 'admin') {
      fetchOrders();
      fetchStats();
    }
  }, [user, fetchOrders, fetchStats]);

  useEffect(() => {
    setPage(1);
  }, [activeView, statusFilter, dateRange.start, dateRange.end, searchTerm]);

  // If user is not admin
  if (!user || user.role !== 'admin') {
    return (
      <div className={`min-h-screen ${themeClasses.bg.primary} flex items-center justify-center p-4`}>
        <div className="text-center">
          <Layers className="h-12 w-12 text-red-500 mx-auto mb-3" />
          <h2 className={`text-lg font-bold ${themeClasses.text.primary} mb-2`}>Access Restricted</h2>
          <p className={`${themeClasses.text.muted} text-sm`}>
            Admin access required.
          </p>
        </div>
      </div>
    );
  }

  if (loading && orders.length === 0) {
    return (
      <div className={`min-h-screen ${themeClasses.bg.primary} flex items-center justify-center p-4`}>
        <div className="text-center">
          <Loader2 className="h-8 w-8 text-blue-500 animate-spin mx-auto mb-3" />
          <p className={`${themeClasses.text.secondary} text-sm`}>Loading orders...</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`min-h-screen ${themeClasses.bg.primary} py-3 md:py-6`}>
      <div className="max-w-7xl mx-auto px-3 sm:px-4 lg:px-6">
        {/* Header Section - Mobile Optimized */}
        <div className={`${themeClasses.card} rounded-lg border overflow-hidden mb-3 md:mb-6`}>
          <div className={`p-3 md:p-4 border-b ${themeClasses.border}`}>
            {/* Mobile: Single row with title and refresh button inline */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="p-1.5 bg-blue-100 dark:bg-blue-900 rounded-lg">
                  <ShoppingBag className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                </div>
                <div>
                  <h1 className={`text-base md:text-xl font-bold ${themeClasses.text.primary}`}>
                    My Orders
                  </h1>
                  <p className={`${themeClasses.text.muted} text-xs hidden sm:block`}>
                    {activeView === 'my-products' 
                      ? 'Orders with your products'
                      : 'Orders you processed'}
                  </p>
                </div>
              </div>
              
              <button
                onClick={fetchOrders}
                disabled={loading}
                className="flex items-center gap-1 px-2.5 py-1.5 md:px-3 md:py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs md:text-sm transition-colors disabled:opacity-50"
              >
                <RefreshCw className={`h-3 w-3 md:h-3 md:w-3 ${loading ? 'animate-spin' : ''}`} />
                <span className="hidden xs:inline">Refresh</span>
              </button>
            </div>
          </div>
          
          {/* View Mode Selector - Compact */}
          <div className="p-2 md:p-3 border-b ${themeClasses.border}">
            <div className="flex flex-col xs:flex-row xs:items-center justify-between gap-2">
              <div className="flex items-center gap-1">
                <Filter className={`h-3 w-3 md:h-4 md:w-4 ${themeClasses.text.muted}`} />
                <span className={`font-medium ${themeClasses.text.primary} text-xs md:text-sm`}>View:</span>
              </div>
              
              <div className="flex gap-1">
                {viewModes.map((mode) => {
                  const Icon = mode.icon;
                  return (
                    <button
                      key={mode.id}
                      onClick={() => {
                        setActiveView(mode.id);
                        setPage(1);
                      }}
                      className={`flex items-center gap-1 px-2 py-1 md:px-3 md:py-1.5 rounded-lg text-xs transition-all ${
                        activeView === mode.id 
                          ? 'bg-blue-600 text-white' 
                          : `${themeClasses.button.secondary}`
                      }`}
                    >
                      <Icon className="h-3 w-3" />
                      <span>{mode.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
          
          {/* Filter Controls - Compact */}
          <div className={`p-2 md:p-3 ${showFilters ? 'block' : 'hidden'} md:block`}>
            <div className="grid grid-cols-1 xs:grid-cols-2 md:grid-cols-4 gap-2 md:gap-3">
              {/* Search */}
              <div>
                <label className={`block ${themeClasses.text.secondary} text-xs font-medium mb-1`}>
                  Search
                </label>
                <div className="relative">
                  <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 h-3 w-3 text-gray-400" />
                  <input
                    type="text"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="Order, customer..."
                    className={`w-full pl-7 pr-2 py-1.5 ${themeClasses.input} border rounded-lg text-sm focus:ring-1 focus:ring-blue-500 focus:border-transparent`}
                  />
                </div>
              </div>
              
              {/* Status Filter */}
              <div>
                <label className={`block ${themeClasses.text.secondary} text-xs font-medium mb-1`}>
                  Status
                </label>
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className={`w-full px-2 py-1.5 ${themeClasses.input} border rounded-lg text-sm focus:ring-1 focus:ring-blue-500 focus:border-transparent`}
                >
                  <option value="all">All Status</option>
                  <option value="pending">Pending</option>
                  <option value="processing">Processing</option>
                  <option value="delivered">Delivered</option>
                  <option value="confirmed">Confirmed</option>
                  <option value="cancelled">Cancelled</option>
                </select>
              </div>
              
              {/* Date Range */}
              <div>
                <label className={`block ${themeClasses.text.secondary} text-xs font-medium mb-1`}>
                  From
                </label>
                <input
                  type="date"
                  value={dateRange.start}
                  onChange={(e) => setDateRange(prev => ({ ...prev, start: e.target.value }))}
                  className={`w-full px-2 py-1.5 ${themeClasses.input} border rounded-lg text-sm focus:ring-1 focus:ring-blue-500 focus:border-transparent`}
                />
              </div>
              
              <div>
                <label className={`block ${themeClasses.text.secondary} text-xs font-medium mb-1`}>
                  To
                </label>
                <input
                  type="date"
                  value={dateRange.end}
                  onChange={(e) => setDateRange(prev => ({ ...prev, end: e.target.value }))}
                  className={`w-full px-2 py-1.5 ${themeClasses.input} border rounded-lg text-sm focus:ring-1 focus:ring-blue-500 focus:border-transparent`}
                />
              </div>
            </div>
            
            {/* Filter Actions */}
            <div className="flex justify-between items-center mt-2 md:mt-3">
              <button
                onClick={() => setShowFilters(!showFilters)}
                className={`flex items-center gap-1 text-xs ${themeClasses.text.muted} hover:${themeClasses.text.secondary}`}
              >
                {showFilters ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                {showFilters ? 'Hide' : 'Show'}
              </button>
              
              <div className="flex gap-2">
                <button
                  onClick={clearFilters}
                  className={`px-2 py-1 md:px-3 md:py-1.5 text-xs rounded-lg ${themeClasses.button.secondary}`}
                >
                  Clear
                </button>
                <button
                  onClick={fetchOrders}
                  className="px-2 py-1 md:px-3 md:py-1.5 text-xs rounded-lg bg-blue-600 hover:bg-blue-700 text-white transition-colors"
                >
                  Apply
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Compact Stats Overview - Mobile Optimized */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 md:gap-3 mb-3 md:mb-6">
          <CompactStatCard
            title="Orders"
            value={stats.totalOrders || 0}
            icon={ShoppingBag}
            color="bg-blue-500"
            themeClasses={themeClasses}
          />
          <CompactStatCard
            title="Revenue"
            value={formatCurrency(stats.totalRevenue || 0)}
            icon={DollarSign}
            color="bg-green-500"
            themeClasses={themeClasses}
            isCurrency={true}
          />
          <CompactStatCard
            title="Avg Order"
            value={formatCurrency(stats.averageOrderValue || 0)}
            icon={TrendingUp}
            color="bg-purple-500"
            themeClasses={themeClasses}
            isCurrency={true}
          />
          <CompactStatCard
            title={activeView === 'my-processed' ? "Processing" : "Pending"}
            value={activeView === 'my-processed' ? stats.processingOrders || 0 : stats.pendingOrders || 0}
            icon={activeView === 'my-processed' ? Clock : Package}
            color={activeView === 'my-processed' ? "bg-yellow-500" : "bg-orange-500"}
            themeClasses={themeClasses}
          />
        </div>

        {/* Messages - Compact */}
        {error && (
          <div className="mb-2 md:mb-3 p-2 bg-red-100 dark:bg-red-900/20 border border-red-400 dark:border-red-700 text-red-700 dark:text-red-400 rounded-lg text-xs">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1">
                <AlertCircle className="h-3 w-3" />
                <span className="truncate">{error}</span>
              </div>
              <button 
                onClick={() => setError('')}
                className="text-red-700 dark:text-red-400 hover:text-red-800 dark:hover:text-red-300 ml-2"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          </div>
        )}

        {success && (
          <div className="mb-2 md:mb-3 p-2 bg-green-100 dark:bg-green-900/20 border border-green-400 dark:border-green-700 text-green-700 dark:text-green-400 rounded-lg text-xs">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1">
                <CheckCircle className="h-3 w-3" />
                <span className="truncate">{success}</span>
              </div>
              <button 
                onClick={() => setSuccess('')}
                className="text-green-700 dark:text-green-400 hover:text-green-800 dark:hover:text-green-300 ml-2"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          </div>
        )}

        {/* Compact Orders Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 md:gap-4">
          {orders.length === 0 ? (
            <div className={`text-center py-6 md:py-8 ${themeClasses.card} rounded-lg col-span-full`}>
              <Package className={`h-10 w-10 md:h-12 md:w-12 ${themeClasses.text.muted} mx-auto mb-2 md:mb-3`} />
              <h2 className={`text-base md:text-lg font-bold ${themeClasses.text.primary} mb-1 md:mb-2`}>
                {activeView === 'my-processed' 
                  ? 'No processed orders'
                  : 'No product orders'}
              </h2>
              <p className={`${themeClasses.text.muted} text-xs md:text-sm px-4`}>
                {searchTerm || statusFilter !== 'all' || dateRange.start || dateRange.end 
                  ? 'No matching orders.' 
                  : activeView === 'my-processed'
                    ? 'Process pending orders to see them here.'
                    : 'Create products for customers to order.'}
              </p>
              {(searchTerm || statusFilter !== 'all' || dateRange.start || dateRange.end) && (
                <button
                  onClick={clearFilters}
                  className="mt-2 md:mt-3 px-2 py-1 md:px-3 md:py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors text-xs md:text-sm"
                >
                  Clear Filters
                </button>
              )}
            </div>
          ) : (
            orders.map(order => (
              <CompactOrderCard
                key={order._id}
                order={order}
                themeClasses={themeClasses}
                getStatusIcon={getStatusIcon}
                getStatusColor={getStatusColor}
                formatCurrency={formatCurrency}
                formatDate={formatDate}
                processOrder={processOrder}
                deliverOrder={deliverOrder}
                setSelectedOrder={setSelectedOrder}
                actionLoading={actionLoading}
                getCurrentImage={getCurrentImage}
                navigateImage={navigateImage}
                imageIndex={imageIndices[order._id] || 0}
                activeView={activeView}
                userRole={user.role}
              />
            ))
          )}
        </div>

        {/* Compact Pagination */}
        {totalPages > 1 && (
          <div className={`mt-3 md:mt-4 ${themeClasses.card} rounded-lg border p-2 md:p-3`}>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 md:gap-3">
              <div className={`${themeClasses.text.muted} text-xs`}>
                Page {page} of {totalPages} • {totalOrders} orders
              </div>
              <div className="flex gap-1">
                <button
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className={`px-2 py-1 md:px-3 md:py-1.5 rounded-lg text-xs ${themeClasses.button.secondary} disabled:opacity-50 disabled:cursor-not-allowed`}
                >
                  Prev
                </button>
                <div className="flex items-center gap-1">
                  {Array.from({ length: Math.min(3, totalPages) }, (_, i) => {
                    let pageNum;
                    if (totalPages <= 3) {
                      pageNum = i + 1;
                    } else if (page <= 2) {
                      pageNum = i + 1;
                    } else if (page >= totalPages - 1) {
                      pageNum = totalPages - 2 + i;
                    } else {
                      pageNum = page - 1 + i;
                    }
                    
                    return (
                      <button
                        key={pageNum}
                        onClick={() => setPage(pageNum)}
                        className={`px-1.5 py-0.5 md:px-2 md:py-1 rounded text-xs ${page === pageNum ? 'bg-blue-600 text-white' : themeClasses.button.secondary}`}
                      >
                        {pageNum}
                      </button>
                    );
                  })}
                  {totalPages > 3 && (
                    <span className={`px-1 ${themeClasses.text.muted}`}>...</span>
                  )}
                </div>
                <button
                  onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                  className={`px-2 py-1 md:px-3 md:py-1.5 rounded-lg text-xs ${themeClasses.button.secondary} disabled:opacity-50 disabled:cursor-not-allowed`}
                >
                  Next
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Reject Order Modal - Compact */}
        {selectedOrder && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className={`${themeClasses.surface} rounded-lg shadow-lg ${themeClasses.border} border max-w-sm w-full p-4`}>
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <AlertCircle className="h-4 w-4 text-red-600" />
                  <h3 className={`font-semibold ${themeClasses.text.primary} text-sm`}>Reject Order</h3>
                </div>
                <button
                  onClick={closeRejectModal}
                  className={`p-1 ${themeClasses.text.muted} hover:${themeClasses.text.secondary}`}
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              
              <div className="mb-3">
                <p className={`${themeClasses.text.secondary} text-xs mb-2`}>
                  Reject order <strong>{selectedOrder.orderNumber}</strong>?
                </p>
                
                <label className={`block ${themeClasses.text.secondary} text-xs font-medium mb-1`}>
                  Reason *
                </label>
                <textarea
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                  placeholder="Reason for rejection..."
                  className={`w-full p-2 ${themeClasses.input} rounded-lg text-sm focus:ring-1 focus:ring-red-500 focus:border-transparent`}
                  rows="2"
                  required
                />
              </div>

              <div className="flex gap-2 justify-end">
                <button
                  onClick={closeRejectModal}
                  className={`px-3 py-1.5 text-xs ${themeClasses.button.secondary} rounded-lg`}
                  disabled={actionLoading}
                >
                  Cancel
                </button>
                <button
                  onClick={rejectOrder}
                  disabled={!rejectReason.trim() || actionLoading}
                  className={`px-3 py-1.5 text-xs ${themeClasses.button.danger} rounded-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1`}
                >
                  {actionLoading ? (
                    <>
                      <Loader2 className="h-3 w-3 animate-spin" />
                      Rejecting...
                    </>
                  ) : (
                    <>
                      <XCircle className="h-3 w-3" />
                      Reject
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

// Compact Stat Card Component - Mobile Optimized
const CompactStatCard = ({ title, value, icon: Icon, color, themeClasses, isCurrency = false }) => (
  <div className={`${themeClasses.card} rounded-lg border p-2 md:p-3`}>
    <div className="flex items-center justify-between">
      <div>
        <p className={`text-[10px] md:text-xs ${themeClasses.text.muted} mb-0.5 md:mb-1`}>{title}</p>
        <p className={`text-sm md:text-base font-bold ${themeClasses.text.primary} ${isCurrency ? 'text-xs md:text-sm' : ''}`}>
          {value}
        </p>
      </div>
      <div className={`p-1.5 md:p-2 ${color} bg-opacity-10 rounded-lg`}>
        <Icon className={`h-3 w-3 md:h-4 md:w-4 ${color.replace('bg-', 'text-')}`} />
      </div>
    </div>
  </div>
);

// Compact Order Card Component - Mobile Optimized
const CompactOrderCard = ({ 
  order, 
  themeClasses, 
  getStatusIcon, 
  getStatusColor, 
  formatCurrency, 
  formatDate, 
  processOrder, 
  deliverOrder, 
  setSelectedOrder, 
  actionLoading,
  getCurrentImage,
  navigateImage,
  imageIndex,
  activeView,
  userRole
}) => {
  const currentImage = getCurrentImage(order);
  const totalImages = order.items?.reduce((total, item) => total + (item.images?.length || 0), 0) || 0;
  
  const productOwners = Array.from(new Set(
    order.items
      ?.filter(item => item.product?.createdBy?.name)
      .map(item => item.product.createdBy.name)
  )) || [];

  return (
    <div className={`${themeClasses.card} rounded-lg border overflow-hidden transition-all hover:shadow-md`}>
      
      {/* Image Gallery Section - Compact */}
      {totalImages > 0 && (
        <div className="relative aspect-square bg-gray-100 dark:bg-gray-900 overflow-hidden">
          {currentImage ? (
            <>
              <img 
                src={currentImage.url} 
                alt={currentImage.productName}
                className="w-full h-full object-cover"
                onError={(e) => {
                  e.target.onerror = null;
                  e.target.src = `https://ui-avatars.com/api/?name=${order.orderNumber}&background=random`;
                }}
              />
              
              {/* Navigation Arrows - Compact */}
              {totalImages > 1 && (
                <>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      navigateImage(order._id, 'prev');
                    }}
                    className="absolute left-1 top-1/2 transform -translate-y-1/2 bg-black bg-opacity-50 hover:bg-opacity-70 text-white p-1 rounded-full transition-all"
                  >
                    <ChevronLeft className="h-2.5 w-2.5" />
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      navigateImage(order._id, 'next');
                    }}
                    className="absolute right-1 top-1/2 transform -translate-y-1/2 bg-black bg-opacity-50 hover:bg-opacity-70 text-white p-1 rounded-full transition-all"
                  >
                    <ChevronRight className="h-2.5 w-2.5" />
                  </button>
                </>
              )}
              
              {/* Image Counter - Compact */}
              <div className="absolute bottom-1 left-1/2 transform -translate-x-1/2 bg-black bg-opacity-50 text-white px-1.5 py-0.5 rounded-full text-[9px] md:text-[10px]">
                {imageIndex + 1} / {totalImages}
              </div>
            </>
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-gray-200 dark:bg-gray-800">
              <Package className="h-6 w-6 md:h-8 md:w-8 text-gray-400 dark:text-gray-600" />
            </div>
          )}
        </div>
      )}

      <div className="p-2 md:p-3">
        {/* Order Header - Compact */}
        <div className="flex items-start justify-between mb-1.5 md:mb-2">
          <div className="flex-1 min-w-0 pr-2">
            <div className="flex items-center gap-1 mb-0.5 md:mb-1">
              <h3 className={`font-semibold ${themeClasses.text.primary} text-sm truncate`}>
                {order.orderNumber}
              </h3>
              <span className={`px-1 py-0.5 md:px-1.5 md:py-0.5 rounded-full font-medium border ${getStatusColor(order.orderStatus)} flex items-center gap-0.5 md:gap-1`}>
                {getStatusIcon(order.orderStatus)}
                <span className="truncate max-w-[50px] md:max-w-[60px] text-[10px] md:text-xs">
                  {order.orderStatus.charAt(0).toUpperCase() + order.orderStatus.slice(1)}
                </span>
              </span>
            </div>
            <div className="flex items-center gap-1 text-[10px] md:text-[11px]">
              <Calendar className="h-2 w-2 md:h-2.5 md:w-2.5 text-gray-400" />
              <span className={themeClasses.text.muted}>
                {formatDate(order.createdAt)}
              </span>
            </div>
          </div>
          
          <button className="p-0.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded">
            <MoreVertical className="h-3 w-3 text-gray-400" />
          </button>
        </div>

        {/* Customer Info - Compact - NOW THEME RESPONSIVE */}
        <div className={`mb-1.5 md:mb-2 p-1.5 md:p-2 ${themeClasses.customerInfo} border rounded text-[10px] md:text-[11px]`}>
          <div className="flex items-center gap-0.5 md:gap-1 mb-0.5 md:mb-1">
            <Users className="h-2 w-2 md:h-2.5 md:w-2.5 text-gray-400" />
            <p className={`font-medium ${themeClasses.text.primary} truncate`}>
              {order.customer?.name || 'N/A'}
            </p>
          </div>
          <div className="space-y-0.5">
            <p className={`${themeClasses.text.muted} truncate flex items-center gap-0.5 md:gap-1`}>
              <span>📞</span> {order.customer?.phone || 'No phone'}
            </p>
            <p className={`${themeClasses.text.muted} truncate flex items-center gap-0.5 md:gap-1`}>
              <span>📍</span> {order.customer?.location || 'No location'}
            </p>
          </div>
        </div>

        {/* Product Owners - Compact */}
        {userRole === 'admin' && activeView === 'my-products' && productOwners.length > 0 && (
          <div className="mb-1.5 md:mb-2 p-1 md:p-1.5 bg-blue-50 dark:bg-blue-900/20 rounded-lg text-[9px] md:text-[10px]">
            <p className={`${themeClasses.text.accent} font-medium truncate`}>
              {productOwners.join(', ')}
            </p>
          </div>
        )}

        {/* Order Summary - Compact */}
        <div className="mb-1.5 md:mb-2 space-y-0.5 md:space-y-1">
          <div className="flex justify-between items-center">
            <span className={`${themeClasses.text.muted} text-xs`}>Total:</span>
            <span className={`font-bold ${themeClasses.text.primary} text-sm`}>
              {formatCurrency(order.totalAmount || 0)}
            </span>
          </div>
          <div className="flex justify-between items-center text-[10px] md:text-[11px]">
            <span className={themeClasses.text.muted}>Items:</span>
            <span className={`${themeClasses.text.primary} font-medium`}>
              {order.items?.length || 0} {order.items?.length === 1 ? 'item' : 'items'}
            </span>
          </div>
        </div>

        {/* Admin Actions - Compact */}
        {userRole === 'admin' && (
          <div className="flex flex-wrap gap-1 md:gap-1.5 mt-2 md:mt-3">
            {order.orderStatus === 'pending' && (
              <>
                <button
                  onClick={() => processOrder(order._id)}
                  disabled={actionLoading}
                  className="flex-1 flex items-center justify-center gap-0.5 md:gap-1 px-1.5 py-1 md:px-2 md:py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded text-xs transition-colors disabled:opacity-50"
                >
                  {actionLoading ? (
                    <Loader2 className="h-2 w-2 md:h-2.5 md:w-2.5 animate-spin" />
                  ) : (
                    <Truck className="h-2 w-2 md:h-2.5 md:w-2.5" />
                  )}
                  <span className="text-[10px] md:text-xs">Process</span>
                </button>
                <button
                  onClick={() => setSelectedOrder(order)}
                  className="flex-1 flex items-center justify-center gap-0.5 md:gap-1 px-1.5 py-1 md:px-2 md:py-1.5 bg-red-600 hover:bg-red-700 text-white rounded text-xs"
                >
                  <XCircle className="h-2 w-2 md:h-2.5 md:w-2.5" />
                  <span className="text-[10px] md:text-xs">Reject</span>
                </button>
              </>
            )}
            
            {order.orderStatus === 'processing' && (
              <button
                onClick={() => deliverOrder(order._id)}
                disabled={actionLoading}
                className="w-full flex items-center justify-center gap-0.5 md:gap-1 px-1.5 py-1 md:px-2 md:py-1.5 bg-green-600 hover:bg-green-700 text-white rounded text-xs disabled:opacity-50"
              >
                {actionLoading ? (
                  <Loader2 className="h-2 w-2 md:h-2.5 md:w-2.5 animate-spin" />
                ) : (
                  <CheckCircle className="h-2 w-2 md:h-2.5 md:w-2.5" />
                )}
                <span className="text-[10px] md:text-xs">Deliver</span>
              </button>
            )}
            
            {order.orderStatus === 'delivered' && (
              <div className="w-full flex items-center justify-center gap-0.5 md:gap-1 px-1.5 py-1 md:px-2 md:py-1.5 bg-purple-100 dark:bg-purple-900/20 text-purple-800 dark:text-purple-400 rounded border border-purple-200 dark:border-purple-800 text-xs">
                <Truck className="h-2 w-2 md:h-2.5 md:w-2.5" />
                <span className="text-[10px] md:text-xs">Awaiting Confirm</span>
              </div>
            )}
            
            {order.orderStatus === 'confirmed' && (
              <div className="w-full flex items-center justify-center gap-0.5 md:gap-1 px-1.5 py-1 md:px-2 md:py-1.5 bg-green-100 dark:bg-green-900/20 text-green-800 dark:text-green-400 rounded border border-green-200 dark:border-green-800 text-xs">
                <CheckCircle className="h-2 w-2 md:h-2.5 md:w-2.5" />
                <span className="text-[10px] md:text-xs">Completed</span>
              </div>
            )}

            {order.orderStatus === 'cancelled' && (
              <div className="w-full flex items-center justify-center gap-0.5 md:gap-1 px-1.5 py-1 md:px-2 md:py-1.5 bg-red-100 dark:bg-red-900/20 text-red-800 dark:text-red-400 rounded border border-red-200 dark:border-red-800 text-xs">
                <XCircle className="h-2 w-2 md:h-2.5 md:w-2.5" />
                <span className="text-[10px] md:text-xs">Cancelled</span>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminOrders;