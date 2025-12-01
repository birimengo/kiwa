import React, { useState, useEffect } from 'react';
import { Package, Clock, Truck, CheckCircle, XCircle, AlertCircle, RefreshCw, X, ChevronLeft, ChevronRight } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';

const AdminOrders = () => {
  const { user } = useAuth();
  const { currentTheme } = useTheme();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [rejectReason, setRejectReason] = useState('');
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState('');
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

  // Fetch all orders for admin - FIXED API URL
  const fetchOrders = async () => {
    try {
      setLoading(true);
      const response = await fetch(`${API_BASE_URL}/orders`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      
      if (!response.ok) {
        if (response.status === 401) {
          throw new Error('Authentication failed. Please login again.');
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
      setError(error.message || 'Failed to load orders');
    } finally {
      setLoading(false);
    }
  };

  // Order actions - FIXED API URLs
  const processOrder = async (orderId) => {
    setActionLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/orders/${orderId}/process`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      
      if (!response.ok) {
        if (response.status === 401) {
          throw new Error('Authentication failed. Please login again.');
        }
        throw new Error(`Failed to process order: ${response.status}`);
      }
      
      const result = await response.json();
      if (result.success) {
        fetchOrders(); // Refresh orders
        setError('');
      } else {
        setError(result.message || 'Failed to process order');
      }
    } catch (error) {
      console.error('Error processing order:', error);
      setError(error.message || 'Failed to process order');
    } finally {
      setActionLoading(false);
    }
  };

  const deliverOrder = async (orderId) => {
    setActionLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/orders/${orderId}/deliver`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      
      if (!response.ok) {
        if (response.status === 401) {
          throw new Error('Authentication failed. Please login again.');
        }
        throw new Error(`Failed to deliver order: ${response.status}`);
      }
      
      const result = await response.json();
      if (result.success) {
        fetchOrders(); // Refresh orders
        setError('');
      } else {
        setError(result.message || 'Failed to deliver order');
      }
    } catch (error) {
      console.error('Error delivering order:', error);
      setError(error.message || 'Failed to deliver order');
    } finally {
      setActionLoading(false);
    }
  };

  const rejectOrder = async () => {
    if (!selectedOrder || !rejectReason.trim()) return;
    
    setActionLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/orders/${selectedOrder._id}/reject`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({ reason: rejectReason })
      });
      
      if (!response.ok) {
        if (response.status === 401) {
          throw new Error('Authentication failed. Please login again.');
        }
        throw new Error(`Failed to reject order: ${response.status}`);
      }
      
      const result = await response.json();
      if (result.success) {
        setSelectedOrder(null);
        setRejectReason('');
        fetchOrders(); // Refresh orders
        setError('');
      } else {
        setError(result.message || 'Failed to reject order');
      }
    } catch (error) {
      console.error('Error rejecting order:', error);
      setError(error.message || 'Failed to reject order');
    } finally {
      setActionLoading(false);
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'pending': return <Clock className="h-4 w-4 text-yellow-500" />;
      case 'processing': return <Truck className="h-4 w-4 text-blue-500" />;
      case 'delivered': return <Truck className="h-4 w-4 text-purple-500" />;
      case 'confirmed': return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'cancelled': return <XCircle className="h-4 w-4 text-red-500" />;
      default: return <Clock className="h-4 w-4 text-gray-500" />;
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'pending': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'processing': return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'delivered': return 'bg-purple-100 text-purple-800 border-purple-200';
      case 'confirmed': return 'bg-green-100 text-green-800 border-green-200';
      case 'cancelled': return 'bg-red-100 text-red-800 border-red-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
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
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const closeRejectModal = () => {
    setSelectedOrder(null);
    setRejectReason('');
    setError('');
  };

  useEffect(() => {
    if (user?.role === 'admin') {
      fetchOrders();
    }
  }, [user]);

  if (loading) {
    return (
      <div className={`min-h-screen ${themeClasses.bg.primary} flex items-center justify-center p-4`}>
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p className={`${themeClasses.text.secondary}`}>Loading orders...</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`min-h-screen ${themeClasses.bg.primary} py-8`}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className={`${themeClasses.surface} rounded-lg shadow-lg ${themeClasses.border} border overflow-hidden mb-6`}>
          <div className={`p-6 border-b ${themeClasses.border}`}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Package className={`h-6 w-6 ${themeClasses.text.primary}`} />
                <h1 className={`text-2xl font-bold ${themeClasses.text.primary}`}>Orders Management</h1>
              </div>
              <button
                onClick={fetchOrders}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
              >
                <RefreshCw className="h-4 w-4" />
                Refresh
              </button>
            </div>
            <p className={`${themeClasses.text.muted} mt-2`}>Manage and process customer orders</p>
          </div>
        </div>

        {/* Error Display */}
        {error && (
          <div className="mb-6 p-4 bg-red-100 border border-red-400 text-red-700 rounded-lg">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <AlertCircle className="h-4 w-4" />
                {error}
              </div>
              <button 
                onClick={() => setError('')}
                className="text-red-700 hover:text-red-800"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}

        {/* Orders Stats */}
        {orders.length > 0 && (
          <div className="mb-6">
            <div className={`${themeClasses.surface} rounded-lg ${themeClasses.border} border p-4`}>
              <div className="grid grid-cols-2 md:grid-cols-5 gap-4 text-center">
                <div>
                  <p className={`text-2xl font-bold ${themeClasses.text.primary}`}>{orders.length}</p>
                  <p className={`text-sm ${themeClasses.text.muted}`}>Total</p>
                </div>
                <div>
                  <p className="text-2xl font-bold text-yellow-600">{orders.filter(o => o.orderStatus === 'pending').length}</p>
                  <p className="text-sm text-yellow-600">Pending</p>
                </div>
                <div>
                  <p className="text-2xl font-bold text-blue-600">{orders.filter(o => o.orderStatus === 'processing').length}</p>
                  <p className="text-sm text-blue-600">Processing</p>
                </div>
                <div>
                  <p className="text-2xl font-bold text-purple-600">{orders.filter(o => o.orderStatus === 'delivered').length}</p>
                  <p className="text-sm text-purple-600">Delivered</p>
                </div>
                <div>
                  <p className="text-2xl font-bold text-green-600">{orders.filter(o => o.orderStatus === 'confirmed').length}</p>
                  <p className="text-sm text-green-600">Completed</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Orders Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
          {orders.length === 0 ? (
            <div className={`text-center py-12 ${themeClasses.surface} rounded-lg col-span-full`}>
              <Package className={`h-16 w-16 ${themeClasses.text.muted} mx-auto mb-4`} />
              <h2 className={`text-xl font-bold ${themeClasses.text.primary} mb-2`}>No orders found</h2>
              <p className={themeClasses.text.muted}>There are no orders to manage at the moment.</p>
            </div>
          ) : (
            orders.map(order => (
              <OrderCard
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
              />
            ))
          )}
        </div>

        {/* Reject Order Modal */}
        {selectedOrder && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className={`${themeClasses.surface} rounded-lg shadow-lg ${themeClasses.border} border max-w-md w-full p-6`}>
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <AlertCircle className="h-5 w-5 text-red-600" />
                  <h3 className={`text-lg font-semibold ${themeClasses.text.primary}`}>Reject Order</h3>
                </div>
                <button
                  onClick={closeRejectModal}
                  className={`p-1 ${themeClasses.text.muted} hover:${themeClasses.text.secondary}`}
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
              
              <div className="mb-4">
                <p className={`${themeClasses.text.secondary} mb-2`}>
                  Are you sure you want to reject order <strong>{selectedOrder.orderNumber}</strong>?
                </p>
                <p className={`${themeClasses.text.muted} text-sm mb-3`}>
                  This will cancel the order and restore product stock.
                </p>
                
                <label className={`block ${themeClasses.text.secondary} text-sm font-medium mb-2`}>
                  Reason for Rejection *
                </label>
                <textarea
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                  placeholder="Please provide a reason for rejecting this order..."
                  className={`w-full p-3 ${themeClasses.border} border rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent ${themeClasses.surface} ${themeClasses.text.primary}`}
                  rows="3"
                  required
                />
              </div>

              <div className="flex gap-3 justify-end">
                <button
                  onClick={closeRejectModal}
                  className={`px-4 py-2 ${themeClasses.border} border rounded-lg ${themeClasses.text.secondary} ${themeClasses.hover} transition-colors`}
                  disabled={actionLoading}
                >
                  Cancel
                </button>
                <button
                  onClick={rejectOrder}
                  disabled={!rejectReason.trim() || actionLoading}
                  className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  {actionLoading ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                      Rejecting...
                    </>
                  ) : (
                    <>
                      <XCircle className="h-4 w-4" />
                      Reject Order
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

// Order Card Component
const OrderCard = ({ 
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
  imageIndex
}) => {
  const currentImage = getCurrentImage(order);
  const totalImages = order.items?.reduce((total, item) => total + (item.images?.length || 0), 0) || 0;

  return (
    <div className={`${themeClasses.surface} rounded-lg shadow ${themeClasses.border} border overflow-hidden transition-all hover:shadow-lg`}>
      
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

      <div className="p-4">
        {/* Order Header */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex-1 min-w-0">
            <h3 className={`text-lg font-semibold ${themeClasses.text.primary} truncate`}>{order.orderNumber}</h3>
            <div className="flex items-center gap-2 mt-1">
              <span className={`px-2 py-1 rounded-full text-xs font-medium border ${getStatusColor(order.orderStatus)} flex items-center gap-1`}>
                {getStatusIcon(order.orderStatus)}
                {order.orderStatus.charAt(0).toUpperCase() + order.orderStatus.slice(1)}
              </span>
              <span className={`text-xs ${themeClasses.text.muted}`}>
                {formatDate(order.createdAt)}
              </span>
            </div>
          </div>
        </div>

        {/* Customer Info */}
        <div className="mb-3">
          <p className={`font-medium ${themeClasses.text.primary} text-sm`}>
            {order.customer?.name || 'N/A'}
          </p>
          <p className={`text-xs ${themeClasses.text.muted}`}>
            {order.customer?.phone || 'No phone'}
          </p>
          <p className={`text-xs ${themeClasses.text.muted} truncate`}>
            {order.customer?.location || 'No location'}
          </p>
        </div>

        {/* Order Summary */}
        <div className="mb-3">
          <div className="flex justify-between items-center">
            <span className={`text-sm ${themeClasses.text.muted}`}>Total Amount:</span>
            <span className={`text-lg font-bold ${themeClasses.text.primary}`}>
              {formatCurrency(order.totalAmount)}
            </span>
          </div>
          <div className="flex justify-between items-center text-xs">
            <span className={themeClasses.text.muted}>Payment:</span>
            <span className={`${themeClasses.text.primary} capitalize`}>
              {order.paymentMethod || 'Cash on Delivery'}
            </span>
          </div>
        </div>

        {/* Order Items Preview */}
        <div className={`border-t ${themeClasses.border} pt-3 mb-3`}>
          <h4 className={`font-semibold ${themeClasses.text.primary} text-sm mb-2`}>Items:</h4>
          <div className="space-y-1 max-h-20 overflow-y-auto">
            {order.items.slice(0, 3).map((item, index) => (
              <div key={index} className="flex justify-between items-center text-xs">
                <span className={`${themeClasses.text.primary} truncate flex-1`}>
                  {item.productName}
                </span>
                <span className={`${themeClasses.text.primary} whitespace-nowrap ml-2`}>
                  {formatCurrency(item.totalPrice)}
                </span>
              </div>
            ))}
            {order.items.length > 3 && (
              <p className={`text-xs ${themeClasses.text.muted}`}>
                +{order.items.length - 3} more items
              </p>
            )}
          </div>
        </div>

        {/* Admin Actions */}
        <div className="flex flex-wrap gap-2">
          {order.orderStatus === 'pending' && (
            <>
              <button
                onClick={() => processOrder(order._id)}
                disabled={actionLoading}
                className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors disabled:opacity-50 text-sm"
              >
                {actionLoading ? (
                  <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-white"></div>
                ) : (
                  <Truck className="h-3 w-3" />
                )}
                Process
              </button>
              <button
                onClick={() => setSelectedOrder(order)}
                className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors text-sm"
              >
                <XCircle className="h-3 w-3" />
                Reject
              </button>
            </>
          )}
          
          {order.orderStatus === 'processing' && (
            <button
              onClick={() => deliverOrder(order._id)}
              disabled={actionLoading}
              className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors disabled:opacity-50 text-sm"
            >
              {actionLoading ? (
                <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-white"></div>
              ) : (
                <CheckCircle className="h-3 w-3" />
              )}
              Mark Delivered
            </button>
          )}
          
          {order.orderStatus === 'delivered' && (
            <span className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-purple-100 text-purple-800 rounded-lg border border-purple-200 text-sm">
              <Truck className="h-3 w-3" />
              Awaiting Confirmation
            </span>
          )}
          
          {order.orderStatus === 'confirmed' && (
            <span className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-green-100 text-green-800 rounded-lg border border-green-200 text-sm">
              <CheckCircle className="h-3 w-3" />
              Sale Completed
            </span>
          )}

          {order.orderStatus === 'cancelled' && (
            <span className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-red-100 text-red-800 rounded-lg border border-red-200 text-sm">
              <XCircle className="h-3 w-3" />
              Order Cancelled
            </span>
          )}
        </div>

        {/* Customer Notes */}
        {order.customerNotes && (
          <div className={`border-t ${themeClasses.border} pt-3 mt-3`}>
            <h4 className={`font-semibold ${themeClasses.text.primary} text-sm mb-1`}>Customer Notes:</h4>
            <p className={`text-xs ${themeClasses.text.secondary} bg-yellow-50 border border-yellow-200 rounded p-2`}>
              {order.customerNotes}
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminOrders;