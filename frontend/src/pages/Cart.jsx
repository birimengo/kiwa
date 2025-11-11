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
          
          return { product: productId, quantity: item.quantity };
        }),
        paymentMethod: checkoutData.paymentMethod,
        customerInfo: {
          name: user?.name || 'Customer',
          email: user?.email || '',
          phone: cleanPhone,
          location: checkoutData.location
        },
        notes: checkoutData.notes,
        shippingAddress: { street: checkoutData.location, city: 'Kampala', country: 'Uganda' }
      };

      const response = await fetch('http://localhost:5000/api/orders', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify(orderData)
      });

      if (!response.ok) throw new Error(`Server error: ${response.status}`);
      
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
            className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg font-medium text-sm transition-colors"
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
            className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg font-medium text-sm inline-block transition-colors"
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
          <button onClick={() => navigate(-1)} className="p-2 theme-text hover:theme-secondary rounded-lg">
            <ArrowLeft className="h-5 w-5" />
          </button>
          <h1 className="text-lg font-bold theme-text">Cart ({getTotalItems()})</h1>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 lg:gap-6">
          {/* Cart Items - Mobile optimized */}
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
                    <div key={item.product._id || item.product.id} className="flex items-center gap-3 p-3 theme-border border rounded-lg">
                      <img
                        src={item.product.images?.[0] || '/api/placeholder/80/80'}
                        alt={item.product.name}
                        className="w-16 h-16 lg:w-20 lg:h-20 object-cover rounded-lg flex-shrink-0"
                      />
                      
                      <div className="flex-1 min-w-0">
                        <h3 className="font-medium theme-text text-sm lg:text-base truncate">{item.product.name}</h3>
                        <p className="theme-text-muted text-xs lg:text-sm">{item.product.brand}</p>
                        <p className="text-sm lg:text-base font-semibold theme-text">
                          {formatCurrency(productPrice)}
                        </p>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => updateQuantity(item.product._id || item.product.id, item.quantity - 1)}
                          disabled={item.quantity <= 1}
                          className="p-1 lg:p-2 rounded-full hover:theme-secondary disabled:opacity-30 transition-colors"
                        >
                          <Minus className="h-3 w-3 lg:h-4 lg:w-4 theme-text" />
                        </button>
                        <span className="w-6 text-center font-medium theme-text text-sm">{item.quantity}</span>
                        <button
                          onClick={() => updateQuantity(item.product._id || item.product.id, item.quantity + 1)}
                          className="p-1 lg:p-2 rounded-full hover:theme-secondary transition-colors"
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
                  <span className="theme-text font-semibold">{formatCurrency(getTotalPrice())}</span>
                </div>
                <button
                  onClick={clearCart}
                  className="w-full bg-gray-500 hover:bg-gray-600 text-white py-2 rounded-lg font-medium text-sm transition-colors"
                >
                  Clear Cart
                </button>
              </div>
            </div>
          </div>

          {/* Checkout Section - Sticky on desktop */}
          <div className="lg:col-span-1">
            <div className="theme-surface rounded-xl theme-border border overflow-hidden lg:sticky lg:top-4">
              <div className="p-4 border-b theme-border">
                <h2 className="font-bold theme-text text-lg">Checkout</h2>
              </div>

              <div className="p-4">
                {error && (
                  <div className="mb-3 p-2 bg-red-100 border border-red-400 text-red-700 rounded-lg text-xs">
                    {error}
                  </div>
                )}

                {/* Payment Method - Compact */}
                <div className="mb-4">
                  <label className="block text-sm font-medium theme-text mb-2">Payment</label>
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      { value: 'onDelivery', label: 'Cash on Delivery' },
                      { value: 'mtn', label: 'MTN Mobile' },
                      { value: 'airtel', label: 'Airtel Money' },
                      { value: 'card', label: 'Credit Card' }
                    ].map((method) => (
                      <button
                        key={method.value}
                        onClick={() => handleInputChange('paymentMethod', method.value)}
                        className={`p-2 border rounded-lg text-xs transition-colors ${
                          checkoutData.paymentMethod === method.value 
                            ? 'bg-blue-600 text-white border-blue-600' 
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
                      Phone *
                    </label>
                    <input
                      type="tel"
                      value={checkoutData.phoneNumber}
                      onChange={(e) => handlePhoneChange(e.target.value)}
                      className="w-full p-2 text-sm border theme-border rounded-lg focus:ring-1 focus:ring-blue-500 transition-colors"
                      placeholder="0751234567"
                      required
                    />
                  </div>
                  
                  <div>
                    <label className="block text-xs font-medium theme-text mb-1">
                      <MapPin className="h-3 w-3 inline mr-1" />
                      Location *
                    </label>
                    <input
                      type="text"
                      value={checkoutData.location}
                      onChange={(e) => handleInputChange('location', e.target.value)}
                      className="w-full p-2 text-sm border theme-border rounded-lg focus:ring-1 focus:ring-blue-500 transition-colors"
                      placeholder="Delivery address"
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
                    rows="2"
                    className="w-full p-2 text-sm border theme-border rounded-lg focus:ring-1 focus:ring-blue-500 transition-colors"
                    placeholder="Special instructions..."
                  />
                </div>

                {/* Order Summary */}
                <div className="theme-secondary p-3 rounded-lg mb-4">
                  <div className="space-y-1 text-sm">
                    <div className="flex justify-between">
                      <span className="theme-text">Subtotal:</span>
                      <span className="theme-text">{formatCurrency(getTotalPrice())}</span>
                    </div>
                    <div className="border-t theme-border pt-2">
                      <div className="flex justify-between items-center">
                        <span className="font-bold theme-text">Total:</span>
                        <span className="font-bold theme-text text-lg">
                          {formatCurrency(getTotalPrice())}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Checkout Button - Fixed theme issue */}
                <button 
                  onClick={handleCheckout}
                  disabled={isProcessing || !checkoutData.phoneNumber || !checkoutData.location}
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-lg font-semibold text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
                >
                  {isProcessing ? (
                    <>
                      <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-white mr-2"></div>
                      Processing...
                    </>
                  ) : (
                    `Place Order - ${formatCurrency(getTotalPrice())}`
                  )}
                </button>

                <Link
                  to="/products"
                  className="block text-center text-blue-600 hover:text-blue-700 mt-3 text-sm transition-colors"
                >
                  Continue Shopping
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Cart;