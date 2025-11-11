import React, { useState, useEffect } from 'react';
import { Search, Plus, Minus, Trash2, User, Phone, Mail, Receipt, Calculator, ShoppingCart, RefreshCw, AlertCircle, CreditCard, Smartphone, Building, Edit3, Save } from 'lucide-react';
import { salesAPI } from '../../services/api';

const CreateSaleTab = ({ products = [], productsLoading = false, onProductsRefresh }) => {
  const [filteredProducts, setFilteredProducts] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedProducts, setSelectedProducts] = useState([]);
  const [customer, setCustomer] = useState({
    name: '',
    phone: '',
    email: ''
  });
  const [saleDetails, setSaleDetails] = useState({
    paymentMethod: 'cash',
    amountPaid: 0,
    notes: ''
  });
  const [creatingSale, setCreatingSale] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [editingPrice, setEditingPrice] = useState(null); // Track which product is being edited
  const [customPrice, setCustomPrice] = useState(''); // Temporary custom price input

  // Initialize filtered products when products prop changes
  useEffect(() => {
    setFilteredProducts(products);
  }, [products]);

  // Filter products based on search term
  useEffect(() => {
    if (searchTerm.trim() === '') {
      setFilteredProducts(products);
    } else {
      const filtered = products.filter(product =>
        product.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        product.brand?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        product.category?.toLowerCase().includes(searchTerm.toLowerCase())
      );
      setFilteredProducts(filtered);
    }
  }, [searchTerm, products]);

  const addProductToSale = (product) => {
    if (product.stock === 0) {
      setError(`"${product.name}" is out of stock`);
      return;
    }

    const existingItem = selectedProducts.find(item => item.productId === product._id);
    
    if (existingItem) {
      if (existingItem.quantity >= product.stock) {
        setError(`Only ${product.stock} units of ${product.name} available`);
        return;
      }
      
      setSelectedProducts(prev =>
        prev.map(item =>
          item.productId === product._id
            ? { ...item, quantity: item.quantity + 1 }
            : item
        )
      );
    } else {
      setSelectedProducts(prev => [
        ...prev,
        {
          productId: product._id,
          name: product.name,
          brand: product.brand,
          unitPrice: product.sellingPrice, // Original selling price
          originalPrice: product.sellingPrice, // Store original price for reference
          unitCost: product.purchasePrice,
          quantity: 1,
          stock: product.stock,
          maxQuantity: product.stock,
          useCustomPrice: false, // Default to original price
          customPrice: product.sellingPrice // Initialize with original price
        }
      ]);
    }
    setError('');
  };

  const updateProductQuantity = (productId, newQuantity) => {
    if (newQuantity < 1) {
      removeProductFromSale(productId);
      return;
    }
    
    const product = selectedProducts.find(item => item.productId === productId);
    if (product && newQuantity > product.maxQuantity) {
      setError(`Only ${product.maxQuantity} units of ${product.name} available`);
      return;
    }

    setSelectedProducts(prev =>
      prev.map(item =>
        item.productId === productId
          ? { ...item, quantity: newQuantity }
          : item
      )
    );
    setError('');
  };

  const removeProductFromSale = (productId) => {
    setSelectedProducts(prev => prev.filter(item => item.productId !== productId));
    setError('');
    // Clear editing state if the product being edited is removed
    if (editingPrice === productId) {
      setEditingPrice(null);
      setCustomPrice('');
    }
  };

  // Toggle between original price and custom price
  const togglePriceType = (productId, useCustom) => {
    setSelectedProducts(prev =>
      prev.map(item => {
        if (item.productId === productId) {
          const newUnitPrice = useCustom ? item.customPrice : item.originalPrice;
          return {
            ...item,
            useCustomPrice: useCustom,
            unitPrice: newUnitPrice
          };
        }
        return item;
      })
    );
  };

  // Start editing custom price
  const startEditingPrice = (productId, currentCustomPrice) => {
    setEditingPrice(productId);
    setCustomPrice(currentCustomPrice.toString());
  };

  // Save custom price
  const saveCustomPrice = (productId) => {
    const priceValue = parseFloat(customPrice);
    if (isNaN(priceValue) || priceValue < 0) {
      setError('Please enter a valid price');
      return;
    }

    setSelectedProducts(prev =>
      prev.map(item => {
        if (item.productId === productId) {
          const updatedItem = {
            ...item,
            customPrice: priceValue
          };
          // If custom price is currently being used, update the unit price as well
          if (item.useCustomPrice) {
            updatedItem.unitPrice = priceValue;
          }
          return updatedItem;
        }
        return item;
      })
    );

    setEditingPrice(null);
    setCustomPrice('');
    setError('');
  };

  // Cancel editing custom price
  const cancelEditingPrice = () => {
    setEditingPrice(null);
    setCustomPrice('');
    setError('');
  };

  // Calculate sale totals
  const calculateTotals = () => {
    const subtotal = selectedProducts.reduce((sum, item) => sum + (item.unitPrice * item.quantity), 0);
    const totalCost = selectedProducts.reduce((sum, item) => sum + (item.unitCost * item.quantity), 0);
    const totalAmount = subtotal;
    const totalProfit = totalAmount - totalCost;
    const balance = totalAmount - saleDetails.amountPaid;

    return {
      subtotal,
      totalCost,
      totalAmount,
      totalProfit,
      balance: Math.max(balance, 0)
    };
  };

  const totals = calculateTotals();

  // Auto-set amount paid to total amount when selected products change
  useEffect(() => {
    if (totals.totalAmount > 0) {
      setSaleDetails(prev => ({ 
        ...prev, 
        amountPaid: totals.totalAmount 
      }));
    } else {
      setSaleDetails(prev => ({ 
        ...prev, 
        amountPaid: 0 
      }));
    }
  }, [totals.totalAmount]);

  const handleCreateSale = async () => {
    if (selectedProducts.length === 0) {
      setError('Add at least one product to the sale');
      return;
    }

    // Validate stock availability
    for (const item of selectedProducts) {
      const product = products.find(p => p._id === item.productId);
      if (!product) {
        setError(`"${item.name}" not found in inventory`);
        return;
      }
      if (product.stock < item.quantity) {
        setError(`Only ${product.stock} "${item.name}" available`);
        return;
      }
    }

    setCreatingSale(true);
    setError('');

    try {
      const customerData = {
        name: customer.name.trim() || 'Walk-in Customer',
        phone: customer.phone.trim() || '',
        email: customer.email.trim() || ''
      };

      const saleData = {
        customer: customerData,
        items: selectedProducts.map(item => ({
          productId: item.productId,
          quantity: item.quantity,
          unitPrice: item.unitPrice, // This will be either original or custom price
          originalPrice: item.originalPrice, // Send original price for reference
          usedCustomPrice: item.useCustomPrice // Flag to indicate if custom price was used
        })),
        discountAmount: 0,
        taxAmount: 0,
        paymentMethod: saleDetails.paymentMethod,
        amountPaid: saleDetails.amountPaid,
        notes: saleDetails.notes
      };

      const response = await salesAPI.createSale(saleData);
      
      setSuccess('Sale created successfully!');
      alert(`Sale ${response.data.sale.saleNumber} created!`);
      
      if (onProductsRefresh) {
        onProductsRefresh();
      }
      
      resetForm();
      
    } catch (error) {
      console.error('Error creating sale:', error);
      if (error.code === 'ECONNABORTED') {
        setError('Backend server not responding');
      } else if (!error.response) {
        setError('Cannot connect to backend server');
      } else {
        setError(error.response?.data?.message || 'Failed to create sale');
      }
    } finally {
      setCreatingSale(false);
    }
  };

  const resetForm = () => {
    setSelectedProducts([]);
    setCustomer({ name: '', phone: '', email: '' });
    setSaleDetails({
      paymentMethod: 'cash',
      amountPaid: 0,
      notes: ''
    });
    setSearchTerm('');
    setError('');
    setSuccess('');
    setEditingPrice(null);
    setCustomPrice('');
  };

  const handleRetryProducts = () => {
    if (onProductsRefresh) {
      onProductsRefresh();
    }
  };

  return (
    <div className="space-y-4 p-2">
      {/* Error and Success Messages */}
      {error && (
        <div className="p-2 bg-red-50 border border-red-200 rounded flex items-center justify-between text-xs">
          <div className="flex items-center gap-1">
            <AlertCircle className="h-3 w-3 text-red-600" />
            <p className="text-red-700">{error}</p>
          </div>
          {error.includes('backend') && onProductsRefresh && (
            <button
              onClick={handleRetryProducts}
              className="ml-2 bg-red-600 hover:bg-red-700 text-white px-2 py-1 rounded flex items-center gap-1 text-xs"
            >
              <RefreshCw className="h-3 w-3" />
              Retry
            </button>
          )}
        </div>
      )}
      
      {success && (
        <div className="p-2 bg-green-50 border border-green-200 rounded text-xs">
          <p className="text-green-700">{success}</p>
        </div>
      )}

      {/* THREE COLUMN LAYOUT */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        
        {/* COLUMN 1: Products & Customer */}
        <div className="space-y-4">
          {/* Product Search */}
          <div className="theme-surface rounded-lg p-3">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-semibold theme-text">Products</h3>
              {onProductsRefresh && (
                <button
                  onClick={handleRetryProducts}
                  disabled={productsLoading}
                  className="flex items-center gap-1 theme-border border theme-text-muted hover:theme-secondary px-2 py-1 rounded text-xs"
                >
                  <RefreshCw className={`h-3 w-3 ${productsLoading ? 'animate-spin' : ''}`} />
                  Refresh
                </button>
              )}
            </div>
            
            <div className="relative mb-2">
              <Search className="absolute left-2 top-2 h-3 w-3 theme-text-muted" />
              <input
                type="text"
                placeholder="Search products..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-7 pr-2 py-1 theme-border border rounded text-xs focus:outline-none focus:ring-1 focus:ring-blue-500 theme-surface theme-text"
              />
            </div>

            {/* Products List */}
            <div className="max-h-80 overflow-y-auto">
              {productsLoading ? (
                <div className="text-center py-4">
                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600 mx-auto"></div>
                  <p className="theme-text-muted text-xs mt-1">Loading...</p>
                </div>
              ) : filteredProducts.length === 0 ? (
                <div className="text-center py-4 theme-text-muted">
                  <ShoppingCart className="h-8 w-8 mx-auto mb-1 opacity-50" />
                  <p className="text-xs">No products found</p>
                </div>
              ) : (
                <div className="space-y-1">
                  {filteredProducts.map((product) => (
                    <div
                      key={product._id}
                      className="flex items-center justify-between p-2 theme-border border rounded hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                    >
                      <div className="flex-1 min-w-0">
                        <h4 className="font-medium theme-text text-xs truncate">{product.name}</h4>
                        <p className="theme-text-muted text-xs truncate">{product.brand}</p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="font-semibold theme-primary-text text-xs">
                            UGX {product.sellingPrice?.toLocaleString()}
                          </span>
                          <span className={`text-xs px-1 py-0.5 rounded ${
                            product.stock > 10 
                              ? 'bg-green-100 text-green-800'
                              : product.stock > 0
                              ? 'bg-yellow-100 text-yellow-800'
                              : 'bg-red-100 text-red-800'
                          }`}>
                            {product.stock}
                          </span>
                        </div>
                      </div>
                      <button
                        onClick={() => addProductToSale(product)}
                        disabled={product.stock === 0}
                        className="ml-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white p-1 rounded transition-colors text-xs"
                      >
                        <Plus className="h-3 w-3" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Customer Information */}
          <div className="theme-surface rounded-lg p-3">
            <h3 className="text-sm font-semibold theme-text mb-2 flex items-center gap-1">
              <User className="h-3 w-3" />
              Customer (Optional)
            </h3>
            
            <div className="space-y-2">
              <div>
                <label className="block text-xs font-medium theme-text mb-1">Name</label>
                <input
                  type="text"
                  value={customer.name}
                  onChange={(e) => setCustomer(prev => ({ ...prev, name: e.target.value }))}
                  className="w-full px-2 py-1 theme-border border rounded text-xs focus:outline-none focus:ring-1 focus:ring-blue-500 theme-surface theme-text"
                  placeholder="Walk-in Customer"
                />
              </div>
              
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-medium theme-text mb-1 flex items-center gap-1">
                    <Phone className="h-3 w-3" />
                    Phone
                  </label>
                  <input
                    type="tel"
                    value={customer.phone}
                    onChange={(e) => setCustomer(prev => ({ ...prev, phone: e.target.value }))}
                    className="w-full px-2 py-1 theme-border border rounded text-xs focus:outline-none focus:ring-1 focus:ring-blue-500 theme-surface theme-text"
                  />
                </div>
                
                <div>
                  <label className="block text-xs font-medium theme-text mb-1 flex items-center gap-1">
                    <Mail className="h-3 w-3" />
                    Email
                  </label>
                  <input
                    type="email"
                    value={customer.email}
                    onChange={(e) => setCustomer(prev => ({ ...prev, email: e.target.value }))}
                    className="w-full px-2 py-1 theme-border border rounded text-xs focus:outline-none focus:ring-1 focus:ring-blue-500 theme-surface theme-text"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* COLUMN 2: Sale Items */}
        <div className="space-y-4">
          <div className="theme-surface rounded-lg p-3 h-fit">
            <h3 className="text-sm font-semibold theme-text mb-2">
              Sale Items ({selectedProducts.length})
            </h3>
            
            {selectedProducts.length === 0 ? (
              <div className="text-center py-4 theme-text-muted">
                <ShoppingCart className="h-8 w-8 mx-auto mb-1 opacity-50" />
                <p className="text-xs">No products selected</p>
              </div>
            ) : (
              <div className="space-y-3 max-h-96 overflow-y-auto">
                {selectedProducts.map((item) => (
                  <div key={item.productId} className="p-2 theme-border border rounded">
                    {/* Product Header */}
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex-1 min-w-0">
                        <h4 className="font-medium theme-text text-xs truncate">{item.name}</h4>
                        <p className="theme-text-muted text-xs truncate">{item.brand}</p>
                      </div>
                      <button
                        onClick={() => removeProductFromSale(item.productId)}
                        className="p-0.5 text-red-600 hover:bg-red-50 dark:hover:bg-red-900 rounded transition-colors ml-2"
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </div>

                    {/* Price Selection */}
                    <div className="space-y-2 mb-2">
                      <div className="flex items-center justify-between text-xs">
                        <span className="theme-text-muted">Cost Price:</span>
                        <span className="font-medium theme-text">
                          UGX {item.unitCost?.toLocaleString()}
                        </span>
                      </div>
                      
                      <div className="flex items-center gap-2">
                        <label className="flex items-center gap-1 text-xs">
                          <input
                            type="radio"
                            checked={!item.useCustomPrice}
                            onChange={() => togglePriceType(item.productId, false)}
                            className="h-3 w-3 text-blue-600"
                          />
                          <span>Original Price:</span>
                        </label>
                        <span className="font-semibold theme-primary-text text-xs">
                          UGX {item.originalPrice?.toLocaleString()}
                        </span>
                      </div>

                      <div className="flex items-center gap-2">
                        <label className="flex items-center gap-1 text-xs">
                          <input
                            type="radio"
                            checked={item.useCustomPrice}
                            onChange={() => togglePriceType(item.productId, true)}
                            className="h-3 w-3 text-blue-600"
                          />
                          <span>Custom Price:</span>
                        </label>
                        
                        {editingPrice === item.productId ? (
                          <div className="flex items-center gap-1">
                            <input
                              type="number"
                              value={customPrice}
                              onChange={(e) => setCustomPrice(e.target.value)}
                              className="w-20 px-1 py-0.5 border rounded text-xs"
                              placeholder="Price"
                              min="0"
                              step="100"
                            />
                            <button
                              onClick={() => saveCustomPrice(item.productId)}
                              className="p-0.5 text-green-600 hover:bg-green-50 rounded"
                            >
                              <Save className="h-3 w-3" />
                            </button>
                            <button
                              onClick={cancelEditingPrice}
                              className="p-0.5 text-red-600 hover:bg-red-50 rounded"
                            >
                              <Minus className="h-3 w-3" />
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center gap-1">
                            <span className="font-semibold theme-primary-text text-xs">
                              UGX {item.customPrice?.toLocaleString()}
                            </span>
                            <button
                              onClick={() => startEditingPrice(item.productId, item.customPrice)}
                              className="p-0.5 text-blue-600 hover:bg-blue-50 rounded"
                            >
                              <Edit3 className="h-3 w-3" />
                            </button>
                          </div>
                        )}
                      </div>

                      {/* Current Selling Price */}
                      <div className="flex items-center justify-between pt-1 border-t theme-border">
                        <span className="theme-text font-medium text-xs">Selling Price:</span>
                        <span className={`font-bold text-xs ${
                          item.useCustomPrice && item.customPrice !== item.originalPrice
                            ? 'text-orange-600'
                            : 'theme-primary-text'
                        }`}>
                          UGX {item.unitPrice?.toLocaleString()}
                          {item.useCustomPrice && item.customPrice !== item.originalPrice && (
                            <span className="ml-1 text-xs text-orange-600">
                              ({item.customPrice < item.originalPrice ? 'Discounted' : 'Increased'})
                            </span>
                          )}
                        </span>
                      </div>
                    </div>

                    {/* Quantity Controls */}
                    <div className="flex items-center justify-between pt-2 border-t theme-border">
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => updateProductQuantity(item.productId, item.quantity - 1)}
                          className="p-0.5 theme-border border rounded hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                        >
                          <Minus className="h-2.5 w-2.5" />
                        </button>
                        <span className="w-6 text-center text-xs font-medium theme-text">
                          {item.quantity}
                        </span>
                        <button
                          onClick={() => updateProductQuantity(item.productId, item.quantity + 1)}
                          disabled={item.quantity >= item.maxQuantity}
                          className="p-0.5 theme-border border rounded hover:bg-gray-50 dark:hover:bg-gray-800 disabled:opacity-50 transition-colors"
                        >
                          <Plus className="h-2.5 w-2.5" />
                        </button>
                      </div>
                      
                      <span className="font-semibold theme-text text-xs">
                        Total: UGX {(item.unitPrice * item.quantity).toLocaleString()}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* COLUMN 3: Sale Details & Summary */}
        <div className="space-y-4">
          {/* Sale Details */}
          <div className="theme-surface rounded-lg p-3">
            <h3 className="text-sm font-semibold theme-text mb-2 flex items-center gap-1">
              <Calculator className="h-3 w-3" />
              Sale Details
            </h3>
            
            <div className="space-y-2">
              <div>
                <label className="block text-xs font-medium theme-text mb-1">Payment Method</label>
                <div className="grid grid-cols-2 gap-1">
                  {[
                    { value: 'cash', label: 'Cash', icon: <Receipt className="h-3 w-3" /> },
                    { value: 'card', label: 'Card', icon: <CreditCard className="h-3 w-3" /> },
                    { value: 'mobile_money', label: 'M-Pesa', icon: <Smartphone className="h-3 w-3" /> },
                    { value: 'bank_transfer', label: 'Bank', icon: <Building className="h-3 w-3" /> }
                  ].map((method) => (
                    <button
                      key={method.value}
                      onClick={() => setSaleDetails(prev => ({ ...prev, paymentMethod: method.value }))}
                      className={`flex items-center gap-1 p-1 border rounded text-xs transition-colors ${
                        saleDetails.paymentMethod === method.value
                          ? 'bg-blue-600 text-white border-blue-600'
                          : 'theme-border theme-text hover:bg-gray-50 dark:hover:bg-gray-800'
                      }`}
                    >
                      {method.icon}
                      {method.label}
                    </button>
                  ))}
                </div>
              </div>
              
              <div>
                <label className="block text-xs font-medium theme-text mb-1">Total Amount</label>
                <div className="p-2 bg-gray-50 dark:bg-gray-800 rounded border text-xs font-semibold theme-text text-center">
                  UGX {totals.totalAmount.toLocaleString()}
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium theme-text mb-1">Amount Paid</label>
                <input
                  type="number"
                  min="0"
                  step="1000"
                  max={totals.totalAmount * 2}
                  value={saleDetails.amountPaid}
                  onChange={(e) => setSaleDetails(prev => ({ ...prev, amountPaid: parseFloat(e.target.value) || 0 }))}
                  className="w-full px-2 py-1 theme-border border rounded text-xs focus:outline-none focus:ring-1 focus:ring-blue-500 theme-surface theme-text"
                />
                <p className="text-xs theme-text-muted mt-1">
                  Auto-filled with total amount. Adjust if needed.
                </p>
              </div>
              
              <div>
                <label className="block text-xs font-medium theme-text mb-1">Notes</label>
                <textarea
                  value={saleDetails.notes}
                  onChange={(e) => setSaleDetails(prev => ({ ...prev, notes: e.target.value }))}
                  rows="2"
                  className="w-full px-2 py-1 theme-border border rounded text-xs focus:outline-none focus:ring-1 focus:ring-blue-500 theme-surface theme-text"
                  placeholder="Sale notes..."
                />
              </div>
            </div>
          </div>

          {/* Order Summary */}
          <div className="theme-surface rounded-lg p-3">
            <h3 className="text-sm font-semibold theme-text mb-2 flex items-center gap-1">
              <Receipt className="h-3 w-3" />
              Order Summary
            </h3>
            
            <div className="space-y-1 text-xs">
              <div className="flex justify-between">
                <span className="theme-text-muted">Subtotal:</span>
                <span className="font-medium theme-text">UGX {totals.subtotal.toLocaleString()}</span>
              </div>
              
              <div className="border-t theme-border pt-1 flex justify-between font-semibold">
                <span className="theme-text">Total:</span>
                <span className="theme-primary-text">UGX {totals.totalAmount.toLocaleString()}</span>
              </div>
              
              <div className="flex justify-between">
                <span className="theme-text-muted">Paid:</span>
                <span className="font-medium theme-text">UGX {saleDetails.amountPaid.toLocaleString()}</span>
              </div>
              
              <div className="flex justify-between">
                <span className="theme-text-muted">Balance:</span>
                <span className={`font-medium ${
                  totals.balance === 0 ? 'text-green-600' : 
                  totals.balance > 0 ? 'text-yellow-600' : 'text-red-600'
                }`}>
                  UGX {totals.balance.toLocaleString()}
                </span>
              </div>
              
              <div className="flex justify-between border-t theme-border pt-1">
                <span className="theme-text-muted">Profit:</span>
                <span className="font-medium text-green-600">UGX {totals.totalProfit.toLocaleString()}</span>
              </div>
            </div>
            
            <div className="mt-3 flex gap-2">
              <button
                onClick={resetForm}
                disabled={creatingSale}
                className="flex-1 theme-border border theme-text-muted hover:theme-secondary py-1.5 rounded text-xs font-medium transition-colors disabled:opacity-50"
              >
                Clear
              </button>
              
              <button
                onClick={handleCreateSale}
                disabled={creatingSale || selectedProducts.length === 0}
                className="flex-1 bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white py-1.5 rounded text-xs font-medium transition-colors flex items-center justify-center gap-1 disabled:cursor-not-allowed"
              >
                {creatingSale ? (
                  <>
                    <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-white"></div>
                    Processing...
                  </>
                ) : (
                  <>
                    <Receipt className="h-3 w-3" />
                    Create Sale
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CreateSaleTab;