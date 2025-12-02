import React, { useState, useEffect } from 'react';
import { 
  Search, Plus, Minus, Trash2, User, Phone, Mail, Receipt, Calculator, 
  ShoppingCart, RefreshCw, AlertCircle, CreditCard, Smartphone, Building, 
  Edit3, Save, Cloud, CloudOff, CheckCircle, Printer, Database 
} from 'lucide-react';
import { salesAPI } from '../../services/api';
import LocalStorageService from '../../services/localStorageService';

const CreateSaleTab = ({ 
  products = [], 
  productsLoading = false, 
  onProductsRefresh,
  onSaleCreated,
  isOnline = true,
  user // Add user prop for tracking who made the sale
}) => {
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
  const [success, setSuccess] = useState(null);
  const [editingPrice, setEditingPrice] = useState(null);
  const [customPrice, setCustomPrice] = useState('');
  const [offlineReceipt, setOfflineReceipt] = useState(null);
  const [offlineSalesCount, setOfflineSalesCount] = useState(0);

  // Initialize filtered products
  useEffect(() => {
    setFilteredProducts(products);
  }, [products]);

  // Load offline sales count
  useEffect(() => {
    const loadOfflineStats = () => {
      try {
        const sales = LocalStorageService.getSales();
        const offlineSales = sales.filter(s => s.isLocal && !s.synced);
        setOfflineSalesCount(offlineSales.length);
      } catch (error) {
        console.error('Error loading offline stats:', error);
      }
    };
    
    loadOfflineStats();
    const interval = setInterval(loadOfflineStats, 30000); // Refresh every 30 seconds
    
    return () => clearInterval(interval);
  }, []);

  // Auto-clear success messages after timeout
  useEffect(() => {
    if (success) {
      const timer = setTimeout(() => {
        setSuccess(null);
        setOfflineReceipt(null);
      }, 10000); // Clear after 10 seconds
      
      return () => clearTimeout(timer);
    }
  }, [success]);

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
          unitPrice: product.sellingPrice,
          originalPrice: product.sellingPrice,
          unitCost: product.purchasePrice,
          quantity: 1,
          stock: product.stock,
          maxQuantity: product.stock,
          useCustomPrice: false,
          customPrice: product.sellingPrice
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
    if (editingPrice === productId) {
      setEditingPrice(null);
      setCustomPrice('');
    }
  };

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

  const startEditingPrice = (productId, currentCustomPrice) => {
    setEditingPrice(productId);
    setCustomPrice(currentCustomPrice.toString());
  };

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

  const cancelEditingPrice = () => {
    setEditingPrice(null);
    setCustomPrice('');
    setError('');
  };

  const calculateTotals = () => {
    const subtotal = selectedProducts.reduce((sum, item) => sum + (item.unitPrice * item.quantity), 0);
    const totalCost = selectedProducts.reduce((sum, item) => sum + (item.unitCost * item.quantity), 0);
    const totalAmount = subtotal;
    const totalProfit = totalAmount - totalCost;
    const balance = Math.max(totalAmount - saleDetails.amountPaid, 0);

    return {
      subtotal,
      totalCost,
      totalAmount,
      totalProfit,
      balance
    };
  };

  const totals = calculateTotals();

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

  // Generate offline receipt
  const generateOfflineReceipt = (sale) => {
    const items = sale.items.map(item => ({
      name: item.productName,
      brand: item.productBrand,
      quantity: item.quantity,
      price: item.unitPrice,
      total: item.unitPrice * item.quantity
    }));

    return {
      title: 'ELECTROSHOP - OFFLINE RECEIPT',
      saleNumber: sale.saleNumber,
      date: new Date(sale.createdAt).toLocaleDateString(),
      time: new Date(sale.createdAt).toLocaleTimeString(),
      note: '⚠️ LOCAL COPY - Will sync when online',
      customer: sale.customer,
      items,
      totals: {
        subtotal: sale.subtotal,
        discount: 0,
        tax: 0,
        total: sale.totalAmount,
        paid: sale.amountPaid,
        balance: Math.max(sale.totalAmount - sale.amountPaid, 0)
      },
      paymentMethod: sale.paymentMethod,
      cashier: sale.soldBy || 'Local Admin'
    };
  };

  // Print offline receipt
  const printOfflineReceipt = () => {
    if (!offlineReceipt) return;
    
    const printWindow = window.open('', '_blank');
    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Receipt - ${offlineReceipt.saleNumber}</title>
        <style>
          body { font-family: 'Courier New', monospace; margin: 20px; }
          .receipt { width: 300px; margin: 0 auto; }
          .header { text-align: center; border-bottom: 2px dashed #000; padding-bottom: 10px; margin-bottom: 15px; }
          .header h1 { margin: 0; font-size: 20px; }
          .warning { background: #fff3cd; border: 1px solid #ffc107; padding: 10px; margin: 10px 0; text-align: center; }
          table { width: 100%; border-collapse: collapse; margin: 15px 0; }
          th, td { padding: 5px; text-align: left; border-bottom: 1px dashed #ddd; }
          .total-row { font-weight: bold; border-top: 2px dashed #000; }
          .footer { text-align: center; margin-top: 20px; font-size: 12px; color: #666; }
        </style>
      </head>
      <body>
        <div class="receipt">
          <div class="header">
            <h1>ELECTROSHOP</h1>
            <p>Your Electronics Store</p>
            <p>Tel: +256 712 345 678</p>
          </div>
          
          <div class="warning">
            ⚠️ OFFLINE RECEIPT - LOCAL COPY<br>
            Will sync when internet is restored
          </div>
          
          <div class="sale-info">
            <p><strong>Receipt No:</strong> ${offlineReceipt.saleNumber}</p>
            <p><strong>Date:</strong> ${offlineReceipt.date}</p>
            <p><strong>Time:</strong> ${offlineReceipt.time}</p>
            <p><strong>Customer:</strong> ${offlineReceipt.customer.name}</p>
          </div>
          
          <table>
            <thead>
              <tr>
                <th>Item</th>
                <th>Qty</th>
                <th>Price</th>
                <th>Total</th>
              </tr>
            </thead>
            <tbody>
              ${offlineReceipt.items.map(item => `
                <tr>
                  <td>${item.name}<br><small>${item.brand}</small></td>
                  <td>${item.quantity}</td>
                  <td>UGX ${item.price.toLocaleString()}</td>
                  <td>UGX ${(item.price * item.quantity).toLocaleString()}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
          
          <div class="totals">
            <p><strong>Subtotal:</strong> UGX ${offlineReceipt.totals.subtotal.toLocaleString()}</p>
            <p><strong>Discount:</strong> UGX ${offlineReceipt.totals.discount.toLocaleString()}</p>
            <p><strong>Tax:</strong> UGX ${offlineReceipt.totals.tax.toLocaleString()}</p>
            <p class="total-row">Total: UGX ${offlineReceipt.totals.total.toLocaleString()}</p>
            <p>Paid: UGX ${offlineReceipt.totals.paid.toLocaleString()}</p>
            <p>Balance: UGX ${offlineReceipt.totals.balance.toLocaleString()}</p>
            <p>Payment: ${offlineReceipt.paymentMethod}</p>
          </div>
          
          <div class="footer">
            <p>Thank you for your business!</p>
            <p>Items sold are not returnable</p>
            <p>Warranty according to manufacturer policy</p>
            <p>*** www.electroshop.com ***</p>
          </div>
        </div>
        <script>
          window.onload = () => {
            window.print();
            setTimeout(() => window.close(), 1000);
          };
        </script>
      </body>
      </html>
    `);
    printWindow.document.close();
  };

  const createOnlineSale = async (saleData) => {
    const response = await salesAPI.createSale(saleData);
    return response.data;
  };

  // Enhanced handleCreateSale for offline
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
    setSuccess(null);

    try {
      const customerData = {
        name: customer.name.trim() || 'Walk-in Customer',
        phone: customer.phone.trim() || '',
        email: customer.email.trim() || '',
        location: ''
      };

      const saleData = {
        customer: customerData,
        items: selectedProducts.map(item => ({
          productId: item.productId,
          productName: item.name,
          productBrand: item.brand,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          unitCost: item.unitCost,
          originalPrice: item.originalPrice,
          usedCustomPrice: item.useCustomPrice
        })),
        subtotal: totals.subtotal,
        totalCost: totals.totalCost,
        totalProfit: totals.totalProfit,
        totalAmount: totals.totalAmount,
        paymentMethod: saleDetails.paymentMethod,
        amountPaid: saleDetails.amountPaid,
        notes: saleDetails.notes,
        soldBy: user?.id || user?.name || 'local_admin'
      };

      if (!isOnline) {
        // Create comprehensive sale data for offline
        console.log('📱 Creating offline sale...', saleData);
        const offlineSale = LocalStorageService.addOfflineSale(saleData);
        
        if (offlineSale) {
          // Generate receipt
          const receipt = generateOfflineReceipt(offlineSale);
          setOfflineReceipt(receipt);
          
          // Show success
          setSuccess({
            saleNumber: offlineSale.saleNumber,
            message: '✅ Sale saved locally!',
            showPrint: true
          });
          
          // Update offline sales count
          const sales = LocalStorageService.getSales();
          const offlineSales = sales.filter(s => s.isLocal && !s.synced);
          setOfflineSalesCount(offlineSales.length);
          
          // Reset form immediately
          resetForm();
          
          // Refresh products if callback exists (do this after reset)
          if (onProductsRefresh) {
            console.log('🔄 Refreshing products...');
            onProductsRefresh();
          }
          
          // Notify parent component
          if (onSaleCreated) {
            console.log('📢 Notifying parent of sale created');
            onSaleCreated();
          }
          
          console.log(`✅ Offline sale created: ${offlineSale.saleNumber}`);
        } else {
          setError('Failed to save sale locally. Please try again.');
        }
      } else {
        // Create sale online
        const result = await createOnlineSale(saleData);
        
        if (result.success) {
          setSuccess({
            saleNumber: result.sale.saleNumber,
            message: '✅ Sale created successfully!',
            showPrint: false
          });
          
          // Reset form
          resetForm();
          
          // Refresh products if callback exists
          if (onProductsRefresh) {
            onProductsRefresh();
          }
          
          // Notify parent component
          if (onSaleCreated) {
            onSaleCreated();
          }
        } else {
          setError(result.message || 'Failed to create sale');
          
          // Try offline save if online failed
          try {
            setError('Online creation failed. Saving locally...');
            const offlineSale = LocalStorageService.addOfflineSale({
              ...saleData,
              syncError: true,
              errorMessage: result.message
            });
            
            if (offlineSale) {
              setSuccess({
                saleNumber: offlineSale.saleNumber,
                message: 'Sale saved locally due to connection error.',
                showPrint: true
              });
              
              const receipt = generateOfflineReceipt(offlineSale);
              setOfflineReceipt(receipt);
              
              if (onProductsRefresh) {
                onProductsRefresh();
              }
              
              // Update offline sales count
              const sales = LocalStorageService.getSales();
              const offlineSales = sales.filter(s => s.isLocal && !s.synced);
              setOfflineSalesCount(offlineSales.length);
            }
          } catch (offlineError) {
            setError(`Failed to save sale: ${offlineError.message}`);
          }
        }
      }
      
    } catch (error) {
      console.error('Error creating sale:', error);
      
      // Try offline save if online failed
      if (isOnline && error.response?.status !== 401) {
        try {
          setError('Connection error. Saving locally...');
          const customerData = {
            name: customer.name.trim() || 'Walk-in Customer',
            phone: customer.phone.trim() || '',
            email: customer.email.trim() || '',
            location: ''
          };

          const saleData = {
            customer: customerData,
            items: selectedProducts.map(item => ({
              productId: item.productId,
              productName: item.name,
              productBrand: item.brand,
              quantity: item.quantity,
              unitPrice: item.unitPrice,
              unitCost: item.unitCost,
              originalPrice: item.originalPrice,
              usedCustomPrice: item.useCustomPrice
            })),
            subtotal: totals.subtotal,
            totalCost: totals.totalCost,
            totalProfit: totals.totalProfit,
            totalAmount: totals.totalAmount,
            paymentMethod: saleDetails.paymentMethod,
            amountPaid: saleDetails.amountPaid,
            notes: saleDetails.notes,
            soldBy: user?.id || user?.name || 'local_admin'
          };

          const offlineSale = LocalStorageService.addOfflineSale({
            ...saleData,
            syncError: true,
            errorMessage: error.message
          });
          
          if (offlineSale) {
            setSuccess({
              saleNumber: offlineSale.saleNumber,
              message: 'Sale saved locally due to connection error.',
              showPrint: true
            });
            
            const receipt = generateOfflineReceipt(offlineSale);
            setOfflineReceipt(receipt);
            
            if (onProductsRefresh) {
              onProductsRefresh();
            }
            
            // Update offline sales count
            const sales = LocalStorageService.getSales();
            const offlineSales = sales.filter(s => s.isLocal && !s.synced);
            setOfflineSalesCount(offlineSales.length);
          }
        } catch (offlineError) {
          setError(`Failed to save sale: ${offlineError.message}`);
        }
      } else {
        if (error.code === 'ECONNABORTED') {
          setError('Backend server not responding');
        } else if (!error.response) {
          setError('Cannot connect to backend server');
        } else {
          setError(error.response?.data?.message || 'Failed to create sale');
        }
      }
    } finally {
      setCreatingSale(false);
    }
  };

  const resetForm = () => {
    console.log('🔄 Resetting form...');
    setSelectedProducts([]);
    setCustomer({ name: '', phone: '', email: '' });
    setSaleDetails({
      paymentMethod: 'cash',
      amountPaid: 0,
      notes: ''
    });
    setSearchTerm('');
    setError('');
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
      {/* Network Status */}
      {!isOnline && (
        <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CloudOff className="h-4 w-4 text-yellow-600" />
              <div>
                <p className="text-sm font-semibold text-yellow-800">Offline Mode</p>
                <p className="text-xs text-yellow-700">
                  Sales will be saved locally and synced when internet returns
                </p>
              </div>
            </div>
            <div className="text-xs text-yellow-800">
              {offlineSalesCount > 0 && (
                <span className="bg-yellow-100 px-2 py-1 rounded">
                  {offlineSalesCount} pending sales
                </span>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Success Message */}
      {success && (
        <div className={`p-3 ${success.showPrint ? 'bg-green-50 border border-green-200 rounded-lg' : 'bg-green-50 border border-green-200 rounded text-xs'}`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CheckCircle className="h-4 w-4 text-green-600" />
              <div>
                <p className="text-sm font-semibold text-green-800">{success.message}</p>
                <p className="text-xs text-green-700">Sale #{success.saleNumber}</p>
              </div>
            </div>
            {success.showPrint && (
              <button
                onClick={printOfflineReceipt}
                className="flex items-center gap-1 bg-green-600 hover:bg-green-700 text-white px-3 py-1 rounded text-sm"
              >
                <Printer className="h-3 w-3" />
                Print Receipt
              </button>
            )}
          </div>
        </div>
      )}

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
                          {product.isLocal && (
                            <span className="text-xs px-1 py-0.5 rounded bg-blue-100 text-blue-800">
                              Local
                            </span>
                          )}
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
                    {isOnline ? 'Processing...' : 'Saving locally...'}
                  </>
                ) : (
                  <>
                    <Receipt className="h-3 w-3" />
                    {isOnline ? 'Create Sale' : 'Save Locally'}
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