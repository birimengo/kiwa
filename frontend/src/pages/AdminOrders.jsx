import React, { useState, useEffect } from 'react';
import { Package, Clock, Truck, CheckCircle, XCircle, AlertCircle, RefreshCw } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

const AdminOrders = () => {
  const { user } = useAuth();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [rejectReason, setRejectReason] = useState('');
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState('');

  // Fetch all orders for admin
  const fetchOrders = async () => {
    try {
      setLoading(true);
      const response = await fetch('http://localhost:5000/api/orders', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      
      if (!response.ok) {
        throw new Error('Failed to fetch orders');
      }
      
      const result = await response.json();
      if (result.success) {
        setOrders(result.orders);
      } else {
        setError(result.message || 'Failed to fetch orders');
      }
    } catch (error) {
      console.error('Error fetching orders:', error);
      setError('Failed to load orders');
    } finally {
      setLoading(false);
    }
  };

  const processOrder = async (orderId) => {
    setActionLoading(true);
    try {
      const response = await fetch(`http://localhost:5000/api/orders/${orderId}/process`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      
      const result = await response.json();
      if (result.success) {
        fetchOrders(); // Refresh orders
      } else {
        setError(result.message || 'Failed to process order');
      }
    } catch (error) {
      console.error('Error processing order:', error);
      setError('Failed to process order');
    } finally {
      setActionLoading(false);
    }
  };

  const deliverOrder = async (orderId) => {
    setActionLoading(true);
    try {
      const response = await fetch(`http://localhost:5000/api/orders/${orderId}/deliver`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      
      const result = await response.json();
      if (result.success) {
        fetchOrders(); // Refresh orders
      } else {
        setError(result.message || 'Failed to deliver order');
      }
    } catch (error) {
      console.error('Error delivering order:', error);
      setError('Failed to deliver order');
    } finally {
      setActionLoading(false);
    }
  };

  const rejectOrder = async () => {
    if (!selectedOrder || !rejectReason.trim()) return;
    
    setActionLoading(true);
    try {
      const response = await fetch(`http://localhost:5000/api/orders/${selectedOrder._id}/reject`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({ reason: rejectReason })
      });
      
      const result = await response.json();
      if (result.success) {
        setSelectedOrder(null);
        setRejectReason('');
        fetchOrders(); // Refresh orders
      } else {
        setError(result.message || 'Failed to reject order');
      }
    } catch (error) {
      console.error('Error rejecting order:', error);
      setError('Failed to reject order');
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
      case 'pending': return 'bg-yellow-100 text-yellow-800';
      case 'processing': return 'bg-blue-100 text-blue-800';
      case 'delivered': return 'bg-purple-100 text-purple-800';
      case 'confirmed': return 'bg-green-100 text-green-800';
      case 'cancelled': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
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

  useEffect(() => {
    if (user?.role === 'admin') {
      fetchOrders();
    }
  }, [user]);

  if (loading) {
    return (
      <div className="min-h-screen theme-bg flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p className="theme-text">Loading orders...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen theme-bg py-8">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="theme-surface rounded-lg shadow-lg theme-border border overflow-hidden mb-6">
          <div className="p-6 border-b theme-border">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Package className="h-6 w-6 theme-text" />
                <h1 className="text-2xl font-bold theme-text">Orders Management</h1>
              </div>
              <button
                onClick={fetchOrders}
                className="flex items-center gap-2 px-4 py-2 theme-primary theme-primary-hover text-white rounded-lg transition-colors"
              >
                <RefreshCw className="h-4 w-4" />
                Refresh
              </button>
            </div>
            <p className="theme-text-muted mt-2">Manage and process customer orders</p>
          </div>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-100 border border-red-400 text-red-700 rounded-lg">
            {error}
          </div>
        )}

        {/* Orders List */}
        <div className="space-y-4">
          {orders.length === 0 ? (
            <div className="text-center py-12 theme-surface rounded-lg">
              <Package className="h-16 w-16 theme-text-muted mx-auto mb-4" />
              <h2 className="text-xl font-bold theme-text mb-2">No orders found</h2>
              <p className="theme-text-muted">There are no orders to manage at the moment.</p>
            </div>
          ) : (
            orders.map(order => (
              <div key={order._id} className="theme-surface rounded-lg shadow theme-border border p-6">
                <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 mb-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="text-lg font-semibold theme-text">{order.orderNumber}</h3>
                      <span className={`px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(order.orderStatus)} flex items-center gap-1`}>
                        {getStatusIcon(order.orderStatus)}
                        {order.orderStatus.charAt(0).toUpperCase() + order.orderStatus.slice(1)}
                      </span>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
                      <div>
                        <p className="font-medium theme-text">{order.customer.name}</p>
                        <p className="theme-text-muted">{order.customer.phone}</p>
                        <p className="theme-text-muted">{order.customer.location}</p>
                      </div>
                      <div className="text-right md:text-left">
                        <p className="theme-text-muted">Order Date: {new Date(order.createdAt).toLocaleDateString()}</p>
                        <p className="text-lg font-bold theme-text">{formatCurrency(order.totalAmount)}</p>
                      </div>
                    </div>
                  </div>
                  
                  {/* Admin Actions */}
                  <div className="flex flex-wrap gap-2">
                    {order.orderStatus === 'pending' && (
                      <>
                        <button
                          onClick={() => processOrder(order._id)}
                          disabled={actionLoading}
                          className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors disabled:opacity-50"
                        >
                          {actionLoading ? (
                            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                          ) : (
                            <Truck className="h-4 w-4" />
                          )}
                          Process Order
                        </button>
                        <button
                          onClick={() => setSelectedOrder(order)}
                          className="flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors"
                        >
                          <XCircle className="h-4 w-4" />
                          Reject
                        </button>
                      </>
                    )}
                    
                    {order.orderStatus === 'processing' && (
                      <button
                        onClick={() => deliverOrder(order._id)}
                        disabled={actionLoading}
                        className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors disabled:opacity-50"
                      >
                        {actionLoading ? (
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                        ) : (
                          <CheckCircle className="h-4 w-4" />
                        )}
                        Mark Delivered
                      </button>
                    )}
                    
                    {order.orderStatus === 'confirmed' && (
                      <span className="flex items-center gap-2 px-4 py-2 bg-green-100 text-green-800 rounded-lg">
                        <CheckCircle className="h-4 w-4" />
                        Sale Created
                      </span>
                    )}
                  </div>
                </div>

                {/* Order Items */}
                <div className="border-t theme-border pt-4">
                  <h4 className="font-semibold theme-text mb-2">Order Items:</h4>
                  <div className="space-y-2">
                    {order.items.map((item, index) => (
                      <div key={index} className="flex justify-between items-center text-sm">
                        <div>
                          <p className="font-medium theme-text">{item.productName}</p>
                          <p className="theme-text-muted">Qty: {item.quantity} × {formatCurrency(item.unitPrice)}</p>
                        </div>
                        <p className="font-medium theme-text">{formatCurrency(item.totalPrice)}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Reject Order Modal */}
        {selectedOrder && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="theme-surface rounded-lg shadow-lg theme-border border max-w-md w-full p-6">
              <div className="flex items-center gap-2 mb-4">
                <AlertCircle className="h-5 w-5 text-red-600" />
                <h3 className="text-lg font-semibold theme-text">Reject Order</h3>
              </div>
              
              <div className="mb-4">
                <p className="theme-text mb-2">
                  Are you sure you want to reject order <strong>{selectedOrder.orderNumber}</strong>?
                </p>
                <p className="theme-text-muted text-sm mb-3">
                  This will cancel the order and restore product stock.
                </p>
                
                <label className="block theme-text text-sm font-medium mb-2">
                  Reason for Rejection *
                </label>
                <textarea
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                  placeholder="Please provide a reason for rejecting this order..."
                  className="w-full p-3 theme-border border rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent theme-surface theme-text"
                  rows="3"
                  required
                />
              </div>

              <div className="flex gap-3 justify-end">
                <button
                  onClick={() => {
                    setSelectedOrder(null);
                    setRejectReason('');
                  }}
                  className="px-4 py-2 theme-border border rounded-lg theme-text hover:theme-secondary transition-colors"
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

export default AdminOrders;