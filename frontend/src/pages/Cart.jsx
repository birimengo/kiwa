import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useCartStore } from '../stores/cartStore';
import { Minus, Plus, Trash2, ShoppingBag, MapPin, Phone, ArrowLeft } from 'lucide-react';

const Cart = () => {
  const { isLoggedIn, user } = useAuth();
  const { items, removeItem, updateQuantity, clearCart, getTotalPrice, getTotalItems } = useCartStore();
  const navigate = useNavigate();
  
  const [checkoutData, setCheckoutData] = useState({
    paymentMethod: 'onDelivery',
    phoneNumber: user?.phone || '',
    location: '',
    notes: ''
  });
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState('');

  // Get API base URL from environment variables
  const API_BASE_URL = import.meta.env.VITE_API_URL || 'https://kiwa-8lrz.onrender.com/api';

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-UG', {
      style: 'currency',
      currency: 'UGX',
      minimumFractionDigits: 0,
    }).format(amount);
  };

  const handleCheckout = async () => {
    setError('');
    
    if (!checkoutData.phoneNumber || !checkoutData.location) {
      setError('Please fill in phone number and location');
      return;
    }

    const phoneRegex = /^(\+256|0)[17]\d{8}$/;
    const cleanPhone = checkoutData.phoneNumber.replace(/\s/g, '');
    if (!phoneRegex.test(cleanPhone)) {
      setError('Please enter a valid Ugandan phone number');
      return;
    }

    setIsProcessing(true);
    try {
      const orderData = {
        items: items.map(item => {
          const productId = item.product._id || item.product.id;
          if (!productId) throw new Error(`Invalid product ID for: ${item.product.name}`);
          
          return { 
            product: productId, 
            quantity: item.quantity,
            productName: item.product.name,
            unitPrice: item.product.sellingPrice || item.product.price || 0,
            totalPrice: (item.product.sellingPrice || item.product.price || 0) * item.quantity
          };
        }),
        paymentMethod: checkoutData.paymentMethod,
        customerInfo: {
          name: user?.name || 'Customer',
          email: user?.email || '',
          phone: cleanPhone,
          location: checkoutData.location
        },
        notes: checkoutData.notes,
        shippingAddress: { 
          street: checkoutData.location, 
          city: 'Kampala', 
          country: 'Uganda' 
        },
        totalAmount: getTotalPrice()
      };

      const response = await fetch(`${API_BASE_URL}/orders`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify(orderData)
      });

      if (!response.ok) {
        if (response.status === 401) {
          throw new Error('Authentication failed. Please login again.');
        }
        throw new Error(`Server error: ${response.status}`);
      }
      
      const result = await response.json();
      if (result.success) {
        clearCart();
        navigate('/order-success', { 
          state: { 
            orderId: result.order._id,
            orderNumber: result.order.orderNumber,
            totalAmount: result.order.totalAmount
          } 
        });
      } else {
        setError(result.message || 'Failed to place order');
      }
    } catch (error) {
      console.error('Checkout error:', error);
      setError(error.message || 'Failed to place order. Please try again.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleInputChange = (field, value) => {
    setCheckoutData(prev => ({ ...prev, [field]: value }));
    if (error) setError('');
  };

  const handlePhoneChange = (value) => {
    let formattedPhone = value.replace(/\D/g, '');
    if (formattedPhone.startsWith('256') && formattedPhone.length === 12) {
      formattedPhone = '+' + formattedPhone;
    } else if (formattedPhone.startsWith('0') && formattedPhone.length === 10) {
      formattedPhone = '+256' + formattedPhone.substring(1);
    }
    handleInputChange('phoneNumber', formattedPhone);
  };

  // Empty state for non-logged in users
  if (!isLoggedIn) {
    return (
      <div className="min-h-screen theme-bg flex items-center justify-center p-4">
        <div className="text-center max-w-md">
          <ShoppingBag className="h-12 w-12 theme-text-muted mx-auto mb-3" />
          <h2 className="text-xl font-bold theme-text mb-2">Please Login</h2>
          <p className="theme-text-muted mb-4 text-sm">You need to be logged in to view your cart.</p>
          <button
            onClick={() => navigate('/login', { state: { from: '/cart' } })}
            className="theme-primary theme-primary-hover text-white px-6 py-2 rounded-lg font-medium text-sm transition-colors"
          >
            Login Now
          </button>
        </div>
      </div>
    );
  }

  // Empty cart state
  if (items.length === 0) {
    return (
      <div className="min-h-screen theme-bg flex items-center justify-center p-4">
        <div className="text-center max-w-md">
          <ShoppingBag className="h-12 w-12 theme-text-muted mx-auto mb-3" />
          <h2 className="text-xl font-bold theme-text mb-2">Your cart is empty</h2>
          <p className="theme-text-muted mb-4 text-sm">Add some products to your cart to see them here.</p>
          <Link
            to="/products"
            className="theme-primary theme-primary-hover text-white px-6 py-2 rounded-lg font-medium text-sm inline-block transition-colors"
          >
            Continue Shopping
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen theme-bg py-4">
      <div className="max-w-6xl mx-auto px-3 sm:px-4">
        {/* Mobile Header */}
        <div className="lg:hidden flex items-center gap-3 mb-4">
          <button 
            onClick={() => navigate(-1)} 
            className="p-2 theme-text hover:theme-secondary rounded-lg transition-colors"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <h1 className="text-lg font-bold theme-text">Cart ({getTotalItems()})</h1>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 lg:gap-6">
          {/* Cart Items */}
          <div className="lg:col-span-2">
            <div className="theme-surface rounded-xl theme-border border overflow-hidden">
              {/* Desktop Header */}
              <div className="hidden lg:block p-4 border-b theme-border">
                <h1 className="text-lg font-bold theme-text">Shopping Cart</h1>
                <p className="theme-text-muted text-sm">{getTotalItems()} items</p>
              </div>

              <div className="p-3 lg:p-4 space-y-3">
                {items.map((item) => {
                  const productPrice = item.product.sellingPrice || item.product.price || 0;
                  const itemTotal = productPrice * item.quantity;
                  
                  return (
                    <div 
                      key={item.product._id || item.product.id} 
                      className="flex items-center gap-3 p-3 theme-border border rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 ocean:hover:bg-blue-900/20 transition-colors"
                    >
                      <img
                        src={item.product.images?.[0] || 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=80&h=80&fit=crop'}
                        alt={item.product.name}
                        className="w-16 h-16 lg:w-20 lg:h-20 object-cover rounded-lg flex-shrink-0"
                        onError={(e) => {
                          e.target.onerror = null;
                          e.target.src = 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=80&h=80&fit=crop';
                        }}
                      />
                      
                      <div className="flex-1 min-w-0">
                        <h3 className="font-medium theme-text text-sm lg:text-base truncate">
                          {item.product.name}
                        </h3>
                        <p className="theme-text-muted text-xs lg:text-sm">
                          {item.product.brand}
                        </p>
                        <p className="text-sm lg:text-base font-semibold theme-text">
                          {formatCurrency(productPrice)}
                        </p>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => updateQuantity(item.product._id || item.product.id, item.quantity - 1)}
                          disabled={item.quantity <= 1}
                          className="p-1 lg:p-2 rounded-full theme-secondary hover:bg-gray-100 dark:hover:bg-gray-700 ocean:hover:bg-blue-700 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                        >
                          <Minus className="h-3 w-3 lg:h-4 lg:w-4 theme-text" />
                        </button>
                        <span className="w-6 text-center font-medium theme-text text-sm">
                          {item.quantity}
                        </span>
                        <button
                          onClick={() => updateQuantity(item.product._id || item.product.id, item.quantity + 1)}
                          className="p-1 lg:p-2 rounded-full theme-secondary hover:bg-gray-100 dark:hover:bg-gray-700 ocean:hover:bg-blue-700 transition-colors"
                        >
                          <Plus className="h-3 w-3 lg:h-4 lg:w-4 theme-text" />
                        </button>
                      </div>

                      <div className="text-right">
                        <p className="font-semibold theme-text text-sm lg:text-base">
                          {formatCurrency(itemTotal)}
                        </p>
                        <button
                          onClick={() => removeItem(item.product._id || item.product.id)}
                          className="text-red-500 hover:text-red-600 p-1 transition-colors mt-1"
                          title="Remove item"
                        >
                          <Trash2 className="h-3 w-3 lg:h-4 lg:w-4" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Cart Summary */}
              <div className="p-3 lg:p-4 border-t theme-border">
                <div className="flex justify-between items-center mb-3">
                  <span className="theme-text font-medium text-sm">Subtotal:</span>
                  <span className="theme-text font-semibold">
                    {formatCurrency(getTotalPrice())}
                  </span>
                </div>
                <button
                  onClick={clearCart}
                  className="w-full bg-gray-600 hover:bg-gray-700 text-white py-2 rounded-lg font-medium text-sm transition-colors"
                >
                  Clear Cart
                </button>
              </div>
            </div>
          </div>

          {/* Checkout Section */}
          <div className="lg:col-span-1">
            <div className="theme-surface rounded-xl theme-border border overflow-hidden lg:sticky lg:top-4">
              <div className="p-4 border-b theme-border">
                <h2 className="font-bold theme-text text-lg">Checkout</h2>
              </div>

              <div className="p-4">
                {error && (
                  <div className="mb-3 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 rounded-lg text-xs">
                    {error}
                  </div>
                )}

                {/* Payment Method */}
                <div className="mb-4">
                  <label className="block text-sm font-medium theme-text mb-2">Payment Method</label>
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      { value: 'onDelivery', label: 'Cash on Delivery' },
                      { value: 'mtn', label: 'MTN Mobile' },
                      { value: 'airtel', label: 'Airtel Money' },
                      { value: 'card', label: 'Credit Card' }
                    ].map((method) => (
                      <button
                        key={method.value}
                        type="button"
                        onClick={() => handleInputChange('paymentMethod', method.value)}
                       className={`p-2 border rounded-lg text-xs transition-colors ${
  checkoutData.paymentMethod === method.value 
    ? 'theme-primary border-blue-600 text-blue-500 dark:text-white font-semibold' 
    : 'theme-border theme-text hover:theme-secondary'
}`}
                      >
                        {method.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Contact Information */}
                <div className="space-y-3 mb-4">
                  <div>
                    <label className="block text-xs font-medium theme-text mb-1">
                      <Phone className="h-3 w-3 inline mr-1" />
                      Phone Number *
                    </label>
                    <input
                      type="tel"
                      value={checkoutData.phoneNumber}
                      onChange={(e) => handlePhoneChange(e.target.value)}
                      className="w-full p-2 text-sm theme-border border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 theme-surface theme-text"
                      placeholder="0751234567"
                      required
                    />
                  </div>
                  
                  <div>
                    <label className="block text-xs font-medium theme-text mb-1">
                      <MapPin className="h-3 w-3 inline mr-1" />
                      Delivery Location *
                    </label>
                    <input
                      type="text"
                      value={checkoutData.location}
                      onChange={(e) => handleInputChange('location', e.target.value)}
                      className="w-full p-2 text-sm theme-border border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 theme-surface theme-text"
                      placeholder="Enter delivery address"
                      required
                    />
                  </div>
                </div>

                {/* Additional Notes */}
                <div className="mb-4">
                  <label className="block text-xs font-medium theme-text mb-1">
                    Notes (Optional)
                  </label>
                  <textarea
                    value={checkoutData.notes}
                    onChange={(e) => handleInputChange('notes', e.target.value)}
                    rows="3"
                    className="w-full p-2 text-sm theme-border border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 theme-surface theme-text"
                    placeholder="Special instructions, delivery notes, or additional requests..."
                  />
                </div>

{/* Order Summary */}
<div className="theme-secondary rounded-lg p-3 mb-4">
  <div className="space-y-2 text-sm">
    <div className="flex justify-between">
      <span className="theme-text">Subtotal:</span>
      <span className="theme-text font-medium">{formatCurrency(getTotalPrice())}</span>
    </div>
    <div className="flex justify-between">
      <span className="theme-text">Delivery:</span>
      <span className="text-green-600 dark:text-green-400 ocean:text-green-300 font-medium">
        Free in Kampala
      </span>
    </div>
    <div className="border-t theme-border pt-2 mt-2">
      <div className="flex justify-between items-center">
        <span className="font-bold theme-text">Total Amount:</span>
        <span className="font-bold theme-text text-lg">
          {formatCurrency(getTotalPrice())}
        </span>
      </div>
      <p className="text-xs theme-text-muted mt-1">
        VAT included • Free delivery within Kampala
      </p>
    </div>
  </div>
</div>

                {/* Checkout Button */}
                <button 
                  onClick={handleCheckout}
                  disabled={isProcessing || !checkoutData.phoneNumber || !checkoutData.location}
                  className="w-full theme-primary hover:theme-primary-hover text-white py-3 rounded-lg font-semibold text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {isProcessing ? (
                    <>
                      <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-white"></div>
                      Processing Order...
                    </>
                  ) : (
                    <>
                      <span>Place Order</span>
                      <span className="font-bold">• {formatCurrency(getTotalPrice())}</span>
                    </>
                  )}
                </button>

                <div className="mt-3 text-center">
                  <Link
                    to="/products"
                    className="inline-block text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 text-sm transition-colors"
                  >
                    ← Continue Shopping
                  </Link>
                  <p className="theme-text-muted text-xs mt-2">
                    By placing your order, you agree to our Terms & Conditions
                  </p>
                </div>
              </div>
            </div>

            {/* Additional Info */}
            <div className="mt-4 theme-surface rounded-xl theme-border border p-4">
              <h3 className="font-medium theme-text text-sm mb-2">Delivery Information</h3>
              <ul className="space-y-1.5 text-xs theme-text-muted">
                <li className="flex items-start gap-2">
                  <div className="w-1.5 h-1.5 bg-green-500 rounded-full mt-1 flex-shrink-0"></div>
                  <span>Free delivery within Kampala for orders above UGX 50,000</span>
                </li>
                <li className="flex items-start gap-2">
                  <div className="w-1.5 h-1.5 bg-blue-500 rounded-full mt-1 flex-shrink-0"></div>
                  <span>Same-day delivery for orders placed before 3 PM</span>
                </li>
                <li className="flex items-start gap-2">
                  <div className="w-1.5 h-1.5 bg-purple-500 rounded-full mt-1 flex-shrink-0"></div>
                  <span>Nationwide delivery available (charges apply)</span>
                </li>
                <li className="flex items-start gap-2">
                  <div className="w-1.5 h-1.5 bg-yellow-500 rounded-full mt-1 flex-shrink-0"></div>
                  <span>Contact us for bulk order discounts</span>
                </li>
              </ul>
              
              <div className="mt-3 pt-3 border-t theme-border">
                <h4 className="font-medium theme-text text-xs mb-1">Need Help?</h4>
                <div className="text-xs theme-text-muted space-y-0.5">
                  <p>☎️ Call: +256 751 808 507</p>
                  <p>📧 Email: gogreenuganda70@gmail.com</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Cart;