import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { 
  ShoppingBag, Clock, Truck, CheckCircle, XCircle, 
  ArrowLeft, X, Check, AlertCircle,
  Package, Calendar, ChevronLeft, ChevronRight
} from 'lucide-react';

const MyOrders = () => {
  const { user, token, isLoggedIn, logout } = useAuth();
  const { currentTheme } = useTheme();
  const navigate = useNavigate();
  const [orders, setOrders] = useState([]);
  const [filteredOrders, setFilteredOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [confirmationNote, setConfirmationNote] = useState('');
  const [cancellationReason, setCancellationReason] = useState('');
  const [actionLoading, setActionLoading] = useState(false);
  const [imageIndices, setImageIndices] = useState({});

  // Get API base URL from environment variables
  const API_BASE_URL = import.meta.env.VITE_API_URL || 'https://kiwa-8lrz.onrender.com/api';

  // Theme-aware styling functions
  const getThemeClasses = () => {
    switch (currentTheme) {
      case 'dark':
        return {
          bg: {
            primary: 'bg-gray-900',
            secondary: 'bg-gray-800',
            tertiary: 'bg-gray-700',
            light: 'bg-gray-50'
          },
          text: {
            primary: 'text-white',
            secondary: 'text-gray-300',
            muted: 'text-gray-400'
          },
          border: 'border-gray-700',
          surface: 'bg-gray-800',
          hover: 'hover:bg-gray-700'
        };
      case 'ocean':
        return {
          bg: {
            primary: 'bg-gradient-to-br from-cyan-50 to-blue-100',
            secondary: 'bg-white',
            tertiary: 'bg-blue-50',
            light: 'bg-blue-50'
          },
          text: {
            primary: 'text-gray-900',
            secondary: 'text-gray-700',
            muted: 'text-gray-500'
          },
          border: 'border-blue-200',
          surface: 'bg-white',
          hover: 'hover:bg-blue-50'
        };
      default: // light
        return {
          bg: {
            primary: 'bg-gray-50',
            secondary: 'bg-white',
            tertiary: 'bg-gray-100',
            light: 'bg-gray-50'
          },
          text: {
            primary: 'text-gray-900',
            secondary: 'text-gray-700',
            muted: 'text-gray-500'
          },
          border: 'border-gray-200',
          surface: 'bg-white',
          hover: 'hover:bg-gray-50'
        };
    }
  };

  const themeClasses = getThemeClasses();

  // Constants
  const STATUS_FILTERS = [
    { value: 'all', label: 'All', icon: Package, color: 'text-gray-600', bgColor: 'bg-gray-500' },
    { value: 'pending', label: 'Pending', icon: Clock, color: 'text-yellow-600', bgColor: 'bg-yellow-500' },
    { value: 'processing', label: 'Processing', icon: Truck, color: 'text-blue-600', bgColor: 'bg-blue-500' },
    { value: 'delivered', label: 'Delivered', icon: Truck, color: 'text-purple-600', bgColor: 'bg-purple-500' },
    { value: 'confirmed', label: 'Confirmed', icon: CheckCircle, color: 'text-green-600', bgColor: 'bg-green-500' },
    { value: 'cancelled', label: 'Cancelled', icon: XCircle, color: 'text-red-600', bgColor: 'bg-red-500' }
  ];

  const STATUS_CONFIG = {
    pending: { 
      icon: Clock, 
      color: 'bg-yellow-100 text-yellow-800 border-yellow-200',
      iconColor: 'text-yellow-500'
    },
    processing: { 
      icon: Truck, 
      color: 'bg-blue-100 text-blue-800 border-blue-200',
      iconColor: 'text-blue-500'
    },
    delivered: { 
      icon: Truck, 
      color: 'bg-purple-100 text-purple-800 border-purple-200',
      iconColor: 'text-purple-500'
    },
    confirmed: { 
      icon: CheckCircle, 
      color: 'bg-green-100 text-green-800 border-green-200',
      iconColor: 'text-green-500'
    },
    cancelled: { 
      icon: XCircle, 
      color: 'bg-red-100 text-red-800 border-red-200',
      iconColor: 'text-red-500'
    }
  };

  // Utility functions
  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-UG', {
      style: 'currency',
      currency: 'UGX',
      minimumFractionDigits: 0,
    }).format(amount);
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  const getStatusConfig = (status) => {
    return STATUS_CONFIG[status] || { 
      icon: Clock, 
      color: 'bg-gray-100 text-gray-800 border-gray-200',
      iconColor: 'text-gray-500'
    };
  };

  const getCurrentFilter = () => {
    return STATUS_FILTERS.find(filter => filter.value === statusFilter) || STATUS_FILTERS[0];
  };

  // Image navigation functions
  const navigateImage = (orderId, direction) => {
    setImageIndices(prev => {
      const order = orders.find(o => o._id === orderId);
      if (!order || !order.items || order.items.length === 0) return prev;
      
      const currentIndex = prev[orderId] || 0;
      const totalImages = order.items.reduce((total, item) => total + (item.images?.length || 0), 0);
      
      let newIndex;
      if (direction === 'next') {
        newIndex = (currentIndex + 1) % totalImages;
      } else {
        newIndex = (currentIndex - 1 + totalImages) % totalImages;
      }
      
      return { ...prev, [orderId]: newIndex };
    });
  };

  const getCurrentImage = (order) => {
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
  };

  // Filter orders based on status
  useEffect(() => {
    if (statusFilter === 'all') {
      setFilteredOrders(orders);
    } else {
      setFilteredOrders(orders.filter(order => order.orderStatus === statusFilter));
    }
  }, [orders, statusFilter]);

  // Data fetching with proper authentication
  const fetchOrders = async () => {
    // Check if user is properly authenticated
    if (!isLoggedIn || !token) {
      setError('Please login to view your orders');
      setLoading(false);
      return;
    }

    try {
      const response = await fetch(`${API_BASE_URL}/orders/my-orders`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (!response.ok) {
        if (response.status === 401) {
          // Token is invalid, logout user
          logout();
          navigate('/login', { state: { from: '/my-orders' } });
          throw new Error('Session expired. Please login again.');
        }
        throw new Error(`Failed to fetch orders: ${response.status}`);
      }
      
      const result = await response.json();
      if (result.success) {
        setOrders(result.orders);
        setError('');
      } else {
        setError(result.message || 'Failed to fetch orders');
      }
    } catch (error) {
      console.error('Error fetching orders:', error);
      setError(error.message || 'Failed to load orders. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isLoggedIn) {
      fetchOrders();
    } else {
      setLoading(false);
      setError('Please login to view your orders');
    }
  }, [isLoggedIn]);

  // Order actions with proper authentication
  const handleConfirmDelivery = async () => {
    if (!selectedOrder || !confirmationNote.trim()) return;
    
    setActionLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/orders/${selectedOrder._id}/confirm-delivery`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ confirmationNote: confirmationNote.trim() })
      });

      if (!response.ok) {
        if (response.status === 401) {
          logout();
          navigate('/login', { state: { from: '/my-orders' } });
          throw new Error('Session expired. Please login again.');
        }
        throw new Error(`Failed to confirm delivery: ${response.status}`);
      }
      
      const result = await response.json();
      if (result.success) {
        setOrders(prev => prev.map(order => 
          order._id === selectedOrder._id 
            ? { ...order, orderStatus: 'confirmed' }
            : order
        ));
        closeModals();
        setError('');
      } else {
        setError(result.message || 'Failed to confirm delivery');
      }
    } catch (error) {
      console.error('Error confirming delivery:', error);
      setError(error.message || 'Failed to confirm delivery');
    } finally {
      setActionLoading(false);
    }
  };

  const handleCancelOrder = async () => {
    if (!selectedOrder || !cancellationReason.trim()) return;
    
    setActionLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/orders/${selectedOrder._id}/cancel`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ reason: cancellationReason.trim() })
      });

      if (!response.ok) {
        if (response.status === 401) {
          logout();
          navigate('/login', { state: { from: '/my-orders' } });
          throw new Error('Session expired. Please login again.');
        }
        throw new Error(`Failed to cancel order: ${response.status}`);
      }
      
      const result = await response.json();
      if (result.success) {
        setOrders(prev => prev.map(order => 
          order._id === selectedOrder._id 
            ? { ...order, orderStatus: 'cancelled' }
            : order
        ));
        closeModals();
        setError('');
      } else {
        setError(result.message || 'Failed to cancel order');
      }
    } catch (error) {
      console.error('Error cancelling order:', error);
      setError(error.message || 'Failed to cancel order');
    } finally {
      setActionLoading(false);
    }
  };

  // Modal management
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

  const closeModals = () => {
    setShowConfirmModal(false);
    setShowCancelModal(false);
    setSelectedOrder(null);
    setConfirmationNote('');
    setCancellationReason('');
    setError('');
  };

  // Quick stats
  const orderStats = {
    total: orders.length,
    pending: orders.filter(o => o.orderStatus === 'pending').length,
    processing: orders.filter(o => o.orderStatus === 'processing').length,
    delivered: orders.filter(o => o.orderStatus === 'delivered').length,
    confirmed: orders.filter(o => o.orderStatus === 'confirmed').length,
    cancelled: orders.filter(o => o.orderStatus === 'cancelled').length
  };

  // Redirect to login if not authenticated
  if (!isLoggedIn) {
    return (
      <div className={`min-h-screen ${themeClasses.bg.primary} flex items-center justify-center p-4`}>
        <div className="text-center max-w-md">
          <ShoppingBag className={`h-12 w-12 ${themeClasses.text.muted} mx-auto mb-3`} />
          <h2 className={`text-xl font-bold ${themeClasses.text.primary} mb-2`}>Please Login</h2>
          <p className={`${themeClasses.text.muted} mb-4 text-sm`}>You need to be logged in to view your orders.</p>
          <button
            onClick={() => navigate('/login', { state: { from: '/my-orders' } })}
            className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg font-medium text-sm transition-colors"
          >
            Login Now
          </button>
        </div>
      </div>
    );
  }

  // Loading state
  if (loading) {
    return (
      <div className={`min-h-screen ${themeClasses.bg.primary} flex items-center justify-center p-4`}>
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto mb-3"></div>
          <p className={`${themeClasses.text.secondary} text-sm`}>Loading your orders...</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`min-h-screen ${themeClasses.bg.primary} py-4`}>
      <div className="max-w-7xl mx-auto px-3 sm:px-4">
        
        {/* Header Section */}
        <div className={`${themeClasses.surface} rounded-xl shadow border ${themeClasses.border} overflow-hidden mb-4`}>
          <div className={`p-4 border-b ${themeClasses.border}`}>
            {/* Navigation */}
            <div className="flex items-center justify-between mb-3">
              <Link
                to="/products"
                className="flex items-center gap-2 text-blue-600 hover:text-blue-700 text-sm transition-colors"
              >
                <ArrowLeft className="h-4 w-4" />
                <span className="hidden sm:inline">Back to Shopping</span>
                <span className="sm:hidden">Back</span>
              </Link>
              
              <div className={`text-xs ${themeClasses.text.muted}`}>
                {filteredOrders.length} of {orders.length} orders
              </div>
            </div>

            {/* Title and Filter Buttons */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-100 rounded-lg">
                  <ShoppingBag className="h-5 w-5 text-blue-600" />
                </div>
                <div>
                  <h1 className={`text-xl font-bold ${themeClasses.text.primary}`}>My Orders</h1>
                  <p className={`${themeClasses.text.muted} text-sm`}>Manage and track your purchases</p>
                </div>
              </div>

              {/* Filter Buttons */}
              <div className="flex flex-wrap gap-2">
                {STATUS_FILTERS.map((filter) => {
                  const Icon = filter.icon;
                  const isActive = statusFilter === filter.value;
                  return (
                    <button
                      key={filter.value}
                      onClick={() => setStatusFilter(filter.value)}
                      className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                        isActive
                          ? `${filter.bgColor} text-white shadow-md`
                          : `${themeClasses.text.secondary} ${themeClasses.hover} border ${themeClasses.border}`
                      }`}
                    >
                      <Icon className={`h-3 w-3 ${isActive ? 'text-white' : filter.color}`} />
                      <span>{filter.label}</span>
                      {isActive && (
                        <div className="ml-1 w-2 h-2 bg-white rounded-full"></div>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Current Filter Display */}
          <div className={`px-4 py-2 border-b ${themeClasses.border} ${themeClasses.bg.tertiary}`}>
            <div className="flex items-center gap-2">
              <span className={`text-xs ${themeClasses.text.muted} font-medium`}>Showing:</span>
              <div className={`flex items-center gap-1 px-2 py-1 ${themeClasses.bg.secondary} rounded border ${themeClasses.border}`}>
                {(() => {
                  const currentFilter = getCurrentFilter();
                  const Icon = currentFilter.icon;
                  return (
                    <>
                      <Icon className={`h-3 w-3 ${currentFilter.color}`} />
                      <span className={`text-xs ${themeClasses.text.secondary} font-medium`}>{currentFilter.label}</span>
                    </>
                  );
                })()}
              </div>
              <span className={`text-xs ${themeClasses.text.muted}`}>
                • {filteredOrders.length} order{filteredOrders.length !== 1 ? 's' : ''}
              </span>
            </div>
          </div>
        </div>

        {/* Error Display */}
        {error && (
          <div className="mb-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded-lg text-sm">
            <div className="flex items-center gap-2">
              <AlertCircle className="h-4 w-4" />
              {error}
              <button 
                onClick={() => setError('')}
                className="ml-auto text-red-700 hover:text-red-800"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}

        {/* Orders Grid */}
        <div className={`${themeClasses.surface} rounded-xl shadow border ${themeClasses.border} overflow-hidden`}>
          <div className="p-4">
            {filteredOrders.length === 0 ? (
              <EmptyState 
                statusFilter={statusFilter} 
                ordersCount={orders.length}
                currentFilter={getCurrentFilter()}
                themeClasses={themeClasses}
              />
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredOrders.map((order) => (
                  <OrderCard
                    key={order._id}
                    order={order}
                    onConfirmDelivery={openConfirmModal}
                    onCancelOrder={openCancelModal}
                    formatCurrency={formatCurrency}
                    formatDate={formatDate}
                    getStatusConfig={getStatusConfig}
                    themeClasses={themeClasses}
                    getCurrentImage={getCurrentImage}
                    navigateImage={navigateImage}
                    imageIndex={imageIndices[order._id] || 0}
                  />
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Quick Stats */}
        {orders.length > 0 && (
          <div className="mt-4 text-center">
            <div className={`inline-flex flex-wrap items-center justify-center gap-3 ${themeClasses.text.muted} text-xs`}>
              <span className="flex items-center gap-1">
                <Package className="h-3 w-3" />
                Total: {orderStats.total}
              </span>
              {Object.entries(orderStats).map(([key, count]) => 
                key !== 'total' && count > 0 && (
                  <span key={key} className="flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-current"></span>
                    {key}: {count}
                  </span>
                )
              )}
            </div>
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
          themeClasses={themeClasses}
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
          themeClasses={themeClasses}
        />
      )}
    </div>
  );
};

// Sub-components for better composition
const EmptyState = ({ statusFilter, ordersCount, currentFilter, themeClasses }) => {
  const Icon = currentFilter.icon;
  
  return (
    <div className="text-center py-8">
      <Icon className={`h-16 w-16 ${themeClasses.text.muted} mx-auto mb-4`} />
      <h2 className={`text-lg font-bold ${themeClasses.text.primary} mb-2`}>
        {ordersCount === 0 ? "No orders yet" : `No ${statusFilter} orders`}
      </h2>
      <p className={`${themeClasses.text.muted} text-sm mb-4 max-w-sm mx-auto`}>
        {ordersCount === 0 
          ? "You haven't placed any orders yet. Start shopping to see your orders here."
          : `No orders match the "${currentFilter.label}" filter. Try selecting a different filter.`
        }
      </p>
      <Link
        to="/products"
        className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg font-medium text-sm inline-block transition-colors"
      >
        Start Shopping
      </Link>
    </div>
  );
};

const OrderCard = ({ 
  order, 
  onConfirmDelivery, 
  onCancelOrder, 
  formatCurrency, 
  formatDate, 
  getStatusConfig, 
  themeClasses,
  getCurrentImage,
  navigateImage,
  imageIndex
}) => {
  const statusConfig = getStatusConfig(order.orderStatus);
  const StatusIcon = statusConfig.icon;
  const currentImage = getCurrentImage(order);

  // Calculate total images count
  const totalImages = order.items?.reduce((total, item) => total + (item.images?.length || 0), 0) || 0;

  return (
    <div className={`${themeClasses.bg.secondary} rounded-lg border ${themeClasses.border} overflow-hidden transition-all hover:shadow-lg hover:border-blue-300 dark:hover:border-blue-400 ocean:hover:border-blue-300`}>
      
      {/* Image Gallery Section */}
      {totalImages > 0 && (
        <div className="relative aspect-video bg-gray-100 overflow-hidden">
          {currentImage ? (
            <>
              <img 
                src={currentImage.url} 
                alt={currentImage.productName}
                className="w-full h-full object-cover"
              />
              
              {/* Navigation Arrows */}
              {totalImages > 1 && (
                <>
                  <button
                    onClick={() => navigateImage(order._id, 'prev')}
                    className="absolute left-2 top-1/2 transform -translate-y-1/2 bg-black bg-opacity-50 hover:bg-opacity-70 text-white p-2 rounded-full transition-all"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => navigateImage(order._id, 'next')}
                    className="absolute right-2 top-1/2 transform -translate-y-1/2 bg-black bg-opacity-50 hover:bg-opacity-70 text-white p-2 rounded-full transition-all"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </>
              )}
              
              {/* Image Counter */}
              <div className="absolute bottom-2 left-1/2 transform -translate-x-1/2 bg-black bg-opacity-50 text-white px-2 py-1 rounded-full text-xs">
                {imageIndex + 1} / {totalImages}
              </div>
            </>
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-gray-200">
              <Package className="h-12 w-12 text-gray-400" />
            </div>
          )}
        </div>
      )}

      {/* Order Details */}
      <div className="p-4">
        {/* Order Header */}
        <div className="flex flex-col gap-2 mb-3">
          <div className="flex items-center justify-between">
            <h3 className={`font-semibold ${themeClasses.text.primary} text-sm truncate`}>{order.orderNumber}</h3>
            <span className={`px-2 py-1 rounded-full border text-xs font-medium ${statusConfig.color}`}>
              <span className="flex items-center gap-1">
                <StatusIcon className="h-3 w-3" />
                {order.orderStatus.charAt(0).toUpperCase() + order.orderStatus.slice(1)}
              </span>
            </span>
          </div>
          <div className={`flex items-center gap-2 text-xs ${themeClasses.text.muted}`}>
            <Calendar className="h-3 w-3" />
            {formatDate(order.createdAt)}
          </div>
        </div>

        {/* Order Items */}
        <div className={`border-t ${themeClasses.border} pt-3 mb-3`}>
          <div className="space-y-2">
            {order.items.map((item, index) => (
              <div key={index} className="flex justify-between items-start text-sm">
                <div className="flex-1 min-w-0">
                  <p className={`font-medium ${themeClasses.text.primary} truncate`}>{item.productName}</p>
                  <p className={`${themeClasses.text.muted} text-xs`}>
                    Qty: {item.quantity} × {formatCurrency(item.unitPrice)}
                  </p>
                </div>
                <p className={`font-medium ${themeClasses.text.primary} whitespace-nowrap ml-2`}>
                  {formatCurrency(item.totalPrice)}
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* Order Summary */}
        <div className="space-y-2 text-sm">
          <div className="flex justify-between items-center">
            <span className={themeClasses.text.muted}>Subtotal:</span>
            <span className={themeClasses.text.primary}>{formatCurrency(order.totalAmount)}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className={themeClasses.text.muted}>Payment method:</span>
            <span className={`${themeClasses.text.primary} font-medium capitalize`}>
              {order.paymentMethod?.replace(/([A-Z])/g, ' $1').trim() || 'Cash on Delivery'}
            </span>
          </div>
          <div className="flex justify-between items-center font-semibold border-t pt-2">
            <span className={themeClasses.text.primary}>Total:</span>
            <span className={`text-lg ${themeClasses.text.primary}`}>{formatCurrency(order.totalAmount)}</span>
          </div>
        </div>

        {/* Action Buttons */}
        <OrderActions 
          order={order}
          onConfirmDelivery={onConfirmDelivery}
          onCancelOrder={onCancelOrder}
          themeClasses={themeClasses}
        />
      </div>
    </div>
  );
};

const OrderActions = ({ order, onConfirmDelivery, onCancelOrder, themeClasses }) => {
  if (order.orderStatus === 'pending') {
    return (
      <div className={`border-t ${themeClasses.border} pt-3 mt-3`}>
        <button
          onClick={() => onCancelOrder(order)}
          className="flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm transition-colors w-full justify-center"
        >
          <X className="h-4 w-4" />
          Cancel Order
        </button>
      </div>
    );
  }

  if (order.orderStatus === 'delivered') {
    return (
      <div className={`border-t ${themeClasses.border} pt-3 mt-3`}>
        <button
          onClick={() => onConfirmDelivery(order)}
          className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm transition-colors w-full justify-center"
        >
          <Check className="h-4 w-4" />
          Confirm Receipt
        </button>
      </div>
    );
  }

  if (order.orderStatus === 'processing') {
    return (
      <div className={`border-t ${themeClasses.border} pt-3 mt-3`}>
        <p className={`text-xs ${themeClasses.text.muted} text-center italic`}>
          Your order is being processed by our team
        </p>
      </div>
    );
  }

  if (order.orderStatus === 'confirmed') {
    return (
      <div className={`border-t ${themeClasses.border} pt-3 mt-3`}>
        <p className="text-xs text-green-600 text-center italic flex items-center justify-center gap-2">
          <CheckCircle className="h-4 w-4" />
          Order completed - Thank you for your purchase!
        </p>
      </div>
    );
  }

  return null;
};

const ConfirmDeliveryModal = ({ 
  order, 
  confirmationNote, 
  onConfirmationNoteChange, 
  onConfirm, 
  onClose, 
  isLoading,
  themeClasses
}) => {
  return (
    <ModalWrapper onClose={onClose} themeClasses={themeClasses}>
      <div className="flex items-center gap-3 mb-4">
        <div className="p-2 bg-green-100 rounded-lg">
          <CheckCircle className="h-5 w-5 text-green-600" />
        </div>
        <h3 className={`text-lg font-semibold ${themeClasses.text.primary}`}>Confirm Delivery</h3>
      </div>
      
      <div className="mb-4">
        <p className={`${themeClasses.text.secondary} text-sm mb-3`}>
          Please confirm that you have received order <strong>{order?.orderNumber}</strong> and the products are as expected.
        </p>
        
        <label className={`block ${themeClasses.text.secondary} text-sm font-medium mb-2`}>
          Confirmation Note *
        </label>
        <textarea
          value={confirmationNote}
          onChange={(e) => onConfirmationNoteChange(e.target.value)}
          placeholder="Please confirm that you have received the products in good condition..."
          className={`w-full p-3 border ${themeClasses.border} rounded-lg text-sm ${themeClasses.surface} ${themeClasses.text.primary} focus:ring-2 focus:ring-blue-500 focus:border-transparent`}
          rows="3"
          required
        />
      </div>

      <div className="flex gap-3 justify-end">
        <button
          onClick={onClose}
          className={`px-4 py-2 border ${themeClasses.border} rounded-lg ${themeClasses.text.secondary} ${themeClasses.hover} transition-colors text-sm`}
          disabled={isLoading}
        >
          Cancel
        </button>
        <button
          onClick={onConfirm}
          disabled={!confirmationNote.trim() || isLoading}
          className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
        >
          {isLoading ? (
            <>
              <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-white"></div>
              Confirming...
            </>
          ) : (
            <>
              <Check className="h-4 w-4" />
              Confirm Receipt
            </>
          )}
        </button>
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
  isLoading,
  themeClasses
}) => {
  return (
    <ModalWrapper onClose={onClose} themeClasses={themeClasses}>
      <div className="flex items-center gap-3 mb-4">
        <div className="p-2 bg-red-100 rounded-lg">
          <AlertCircle className="h-5 w-5 text-red-600" />
        </div>
        <h3 className={`text-lg font-semibold ${themeClasses.text.primary}`}>Cancel Order</h3>
      </div>
      
      <div className="mb-4">
        <p className={`${themeClasses.text.secondary} text-sm mb-3`}>
          Are you sure you want to cancel order <strong>{order?.orderNumber}</strong>?
        </p>
        
        <label className={`block ${themeClasses.text.secondary} text-sm font-medium mb-2`}>
          Reason for Cancellation *
        </label>
        <textarea
          value={cancellationReason}
          onChange={(e) => onCancellationReasonChange(e.target.value)}
          placeholder="Please provide a reason for cancelling this order..."
          className={`w-full p-3 border ${themeClasses.border} rounded-lg text-sm ${themeClasses.surface} ${themeClasses.text.primary} focus:ring-2 focus:ring-blue-500 focus:border-transparent`}
          rows="3"
          required
        />
      </div>

      <div className="flex gap-3 justify-end">
        <button
          onClick={onClose}
          className={`px-4 py-2 border ${themeClasses.border} rounded-lg ${themeClasses.text.secondary} ${themeClasses.hover} transition-colors text-sm`}
          disabled={isLoading}
        >
          Keep Order
        </button>
        <button
          onClick={onConfirm}
          disabled={!cancellationReason.trim() || isLoading}
          className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
        >
          {isLoading ? (
            <>
              <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-white"></div>
              Cancelling...
            </>
          ) : (
            <>
              <X className="h-4 w-4" />
              Cancel Order
            </>
          )}
        </button>
      </div>
    </ModalWrapper>
  );
};

const ModalWrapper = ({ children, onClose, themeClasses }) => (
  <div 
    className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50"
    onClick={onClose}
  >
    <div 
      className={`${themeClasses.surface} rounded-xl shadow-2xl border ${themeClasses.border} max-w-md w-full p-4 sm:p-6 mx-auto`}
      onClick={(e) => e.stopPropagation()}
    >
      {children}
    </div>
  </div>
);

export default MyOrders;