import React, { useState, useEffect, useCallback, useRef } from 'react';
import { 
  Search, Plus, Minus, Trash2, User, Phone, Mail, Receipt, Calculator, 
  ShoppingCart, RefreshCw, AlertCircle, CreditCard, Smartphone, Building, 
  Edit3, Save, Cloud, CloudOff, CheckCircle, Printer, Database, TrendingDown,
  Package, ArrowUpDown, Shield, Check, ChevronRight, ChevronLeft, X
} from 'lucide-react';
import { salesAPI } from '../../services/api';
import LocalStorageService from '../../services/localStorageService';

const CreateSaleTab = ({ 
  products = [], 
  productsLoading = false, 
  onProductsRefresh,
  onSaleCreated,
  isOnline = true,
  user
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
  const [productStockUpdates, setProductStockUpdates] = useState([]);
  const [recentlyUpdatedProducts, setRecentlyUpdatedProducts] = useState(new Set());
  const [activeDiscounts, setActiveDiscounts] = useState({});
  
  // New state for mobile workflow
  const [markedProducts, setMarkedProducts] = useState(new Set());
  const [workflowStep, setWorkflowStep] = useState('select'); // 'select', 'review', 'details'
  const [mobileView, setMobileView] = useState(false);
  const saleItemsRef = useRef(null);
  const saleDetailsRef = useRef(null);

  // Refs for tracking
  const hasInitializedRef = useRef(false);
  const productCacheRef = useRef(products);
  const isProcessingRef = useRef(false);

  // Check if mobile
  useEffect(() => {
    const checkMobile = () => {
      setMobileView(window.innerWidth < 768);
    };
    
    checkMobile();
    window.addEventListener('resize', checkMobile);
    
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Initialize filtered products
  useEffect(() => {
    if (!hasInitializedRef.current && products.length > 0) {
      setFilteredProducts(products);
      productCacheRef.current = products;
      hasInitializedRef.current = true;
    }
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
    const interval = setInterval(loadOfflineStats, 30000);
    
    return () => clearInterval(interval);
  }, []);

  // Auto-clear success messages after timeout
  useEffect(() => {
    if (success) {
      const timer = setTimeout(() => {
        setSuccess(null);
        setOfflineReceipt(null);
      }, 10000);
      
      return () => clearTimeout(timer);
    }
  }, [success]);

  // Listen for product updates from other components
  useEffect(() => {
    const handleProductsUpdated = () => {
      console.log('📢 Received productsUpdated event - refreshing products');
      if (onProductsRefresh) {
        onProductsRefresh();
      }
    };

    const handleStockUpdated = (event) => {
      console.log('📉 Received stockUpdated event:', event.detail);
      if (event.detail && event.detail.updates) {
        // Highlight recently updated products
        const updatedIds = event.detail.updates.map(u => u.productId);
        setRecentlyUpdatedProducts(new Set(updatedIds));
        
        // Clear highlights after 3 seconds
        setTimeout(() => {
          setRecentlyUpdatedProducts(new Set());
        }, 3000);
        
        // Update local state if needed
        if (onProductsRefresh) {
          setTimeout(() => onProductsRefresh(), 500);
        }
      }
    };

    const handleClearProductCache = () => {
      console.log('🗑️ Received clearProductCache event - forcing refresh');
      
      // Add a guard to prevent re-entrancy
      if (isProcessingRef.current) {
        console.log('⚠️ Already processing clearProductCache, skipping');
        return;
      }
      
      isProcessingRef.current = true;
      
      try {
        clearProductCache();
        
        // Use setTimeout to break the synchronous call chain
        setTimeout(() => {
          if (onProductsRefresh) {
            console.log('🔄 Calling onProductsRefresh after cache clear...');
            onProductsRefresh();
          }
          isProcessingRef.current = false;
        }, 100);
      } catch (error) {
        isProcessingRef.current = false;
        console.error('Error in clearProductCache:', error);
      }
    };

    const handleSaleCompleted = (event) => {
      console.log('💰 Received saleCompleted event:', event.detail);
      // Force refresh of products after sale
      setTimeout(() => {
        forceProductRefresh();
      }, 300);
    };

    window.addEventListener('productsUpdated', handleProductsUpdated);
    window.addEventListener('stockUpdated', handleStockUpdated);
    window.addEventListener('clearProductCache', handleClearProductCache);
    window.addEventListener('saleCompleted', handleSaleCompleted);
    
    return () => {
      window.removeEventListener('productsUpdated', handleProductsUpdated);
      window.removeEventListener('stockUpdated', handleStockUpdated);
      window.removeEventListener('clearProductCache', handleClearProductCache);
      window.removeEventListener('saleCompleted', handleSaleCompleted);
    };
  }, [onProductsRefresh]);

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

  // Debug: Show stock updates
  const debugStockUpdate = useCallback((productId, oldStock, newStock) => {
    console.log(`📊 Stock update for ${productId}: ${oldStock} → ${newStock}`);
    setProductStockUpdates(prev => [...prev, {
      productId,
      oldStock,
      newStock,
      timestamp: new Date().toLocaleTimeString()
    }].slice(-5));
  }, []);

  // Fixed cache clearing function - removed infinite recursion
  const clearProductCache = useCallback(() => {
    console.log('🗑️ Clearing product cache...');
    
    // Clear localStorage cache timestamps
    localStorage.removeItem('products_cache_timestamp');
    localStorage.removeItem('products_last_fetched');
    localStorage.removeItem('product_list_cache');
    
    // Clear any cached product data
    const cacheKeys = Object.keys(localStorage).filter(key => 
      key.startsWith('products_') || 
      key.startsWith('product_') ||
      key.includes('product_cache')
    );
    
    cacheKeys.forEach(key => {
      localStorage.removeItem(key);
    });
    
    console.log(`🗑️ Cleared ${cacheKeys.length} cache entries`);
    
    // ⚠️ FIXED: Dispatch a DIFFERENT event to avoid infinite recursion
    window.dispatchEvent(new CustomEvent('cacheCleared'));
    
    return cacheKeys.length;
  }, []);

  // Fixed force product refresh function
  const forceProductRefresh = useCallback(() => {
    console.log('🔄 Force refreshing products...');
    
    // Add guard
    if (isProcessingRef.current) {
      console.log('⚠️ Already processing forceProductRefresh, skipping');
      return;
    }
    
    isProcessingRef.current = true;
    
    try {
      // Clear cache first
      clearProductCache();
      
      // Refresh from source with delay
      if (onProductsRefresh) {
        console.log('🔄 Calling onProductsRefresh...');
        setTimeout(() => {
          onProductsRefresh();
        }, 150); // Increase delay
      }
      
      // Dispatch a different event name
      window.dispatchEvent(new CustomEvent('forceProductsRefresh'));
    } finally {
      // Reset processing flag with delay
      setTimeout(() => {
        isProcessingRef.current = false;
      }, 200);
    }
  }, [onProductsRefresh, clearProductCache]);

  // Validate stock availability before adding to sale
  const validateStockAvailability = useCallback((productId, quantity) => {
    const product = products.find(p => p._id === productId);
    if (!product) {
      return { valid: false, message: 'Product not found' };
    }
    
    const existingItem = selectedProducts.find(item => item.productId === productId);
    const totalQuantity = existingItem ? existingItem.quantity + quantity : quantity;
    
    if (totalQuantity > product.stock) {
      return { 
        valid: false, 
        message: `Only ${product.stock} units of ${product.name} available. You have ${existingItem?.quantity || 0} in cart.`
      };
    }
    
    return { valid: true };
  }, [products, selectedProducts]);

  // Toggle product mark
  const toggleProductMark = (product) => {
    const newMarkedProducts = new Set(markedProducts);
    if (newMarkedProducts.has(product._id)) {
      newMarkedProducts.delete(product._id);
    } else {
      // Validate stock
      const validation = validateStockAvailability(product._id, 1);
      if (!validation.valid) {
        setError(validation.message);
        return;
      }
      newMarkedProducts.add(product._id);
    }
    setMarkedProducts(newMarkedProducts);
    setError('');
  };

  // Add marked products to sale
  const addMarkedProductsToSale = () => {
    const markedArray = Array.from(markedProducts);
    if (markedArray.length === 0) {
      setError('Select at least one product');
      return;
    }

    const newSelectedProducts = [];
    markedArray.forEach(productId => {
      const product = products.find(p => p._id === productId);
      if (product) {
        const existingItem = selectedProducts.find(item => item.productId === productId);
        if (existingItem) {
          newSelectedProducts.push({
            ...existingItem,
            quantity: existingItem.quantity + 1
          });
        } else {
          newSelectedProducts.push({
            productId: product._id,
            name: product.name,
            brand: product.brand,
            category: product.category,
            unitPrice: product.sellingPrice,
            originalPrice: product.sellingPrice,
            unitCost: product.purchasePrice || 0,
            quantity: 1,
            stock: product.stock,
            maxQuantity: product.stock,
            useCustomPrice: false,
            customPrice: product.sellingPrice,
            discountPercent: 0,
            isLocal: product.isLocal || false
          });
        }
      }
    });

    setSelectedProducts(prev => {
      const updatedProducts = [...prev];
      newSelectedProducts.forEach(newItem => {
        const existingIndex = updatedProducts.findIndex(item => item.productId === newItem.productId);
        if (existingIndex >= 0) {
          updatedProducts[existingIndex] = newItem;
        } else {
          updatedProducts.push(newItem);
        }
      });
      return updatedProducts;
    });

    // Clear marks and move to next step
    setMarkedProducts(new Set());
    if (mobileView) {
      setWorkflowStep('review');
      setTimeout(() => {
        saleItemsRef.current?.scrollIntoView({ behavior: 'smooth' });
      }, 100);
    }
    setError('');
  };

  const addProductToSale = (product) => {
    if (mobileView && workflowStep === 'select') {
      toggleProductMark(product);
      return;
    }

    // Validate stock
    const validation = validateStockAvailability(product._id, 1);
    if (!validation.valid) {
      setError(validation.message);
      return;
    }

    const existingItem = selectedProducts.find(item => item.productId === product._id);
    
    if (existingItem) {
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
          category: product.category,
          unitPrice: product.sellingPrice,
          originalPrice: product.sellingPrice,
          unitCost: product.purchasePrice || 0,
          quantity: 1,
          stock: product.stock,
          maxQuantity: product.stock,
          useCustomPrice: false,
          customPrice: product.sellingPrice,
          discountPercent: 0,
          isLocal: product.isLocal || false
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
    
    // Validate stock
    const validation = validateStockAvailability(productId, newQuantity);
    if (!validation.valid) {
      setError(validation.message);
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

    const originalItem = selectedProducts.find(item => item.productId === productId);
    if (!originalItem) return;

    const discountPercent = originalItem.originalPrice > 0 
      ? ((originalItem.originalPrice - priceValue) / originalItem.originalPrice * 100).toFixed(1)
      : 0;

    setSelectedProducts(prev =>
      prev.map(item => {
        if (item.productId === productId) {
          const updatedItem = {
            ...item,
            customPrice: priceValue,
            discountPercent: parseFloat(discountPercent)
          };
          if (item.useCustomPrice) {
            updatedItem.unitPrice = priceValue;
          }
          return updatedItem;
        }
        return item;
      })
    );

    setActiveDiscounts(prev => ({
      ...prev,
      [productId]: parseFloat(discountPercent)
    }));

    setEditingPrice(null);
    setCustomPrice('');
    setError('');
  };

  const cancelEditingPrice = () => {
    setEditingPrice(null);
    setCustomPrice('');
    setError('');
  };

  // Apply discount percentage
  const applyDiscount = (productId, percent) => {
    const item = selectedProducts.find(p => p.productId === productId);
    if (!item) return;

    const discountAmount = (item.originalPrice * percent) / 100;
    const discountedPrice = item.originalPrice - discountAmount;
    
    if (discountedPrice < 0) {
      setError('Discount cannot make price negative');
      return;
    }

    setSelectedProducts(prev =>
      prev.map(p => {
        if (p.productId === productId) {
          return {
            ...p,
            useCustomPrice: true,
            customPrice: discountedPrice,
            unitPrice: discountedPrice,
            discountPercent: percent
          };
        }
        return p;
      })
    );

    setActiveDiscounts(prev => ({
      ...prev,
      [productId]: percent
    }));
  };

  const calculateTotals = () => {
    const subtotal = selectedProducts.reduce((sum, item) => sum + (item.unitPrice * item.quantity), 0);
    const totalCost = selectedProducts.reduce((sum, item) => sum + (item.unitCost * item.quantity), 0);
    const totalAmount = subtotal;
    const totalProfit = totalAmount - totalCost;
    const balance = Math.max(totalAmount - saleDetails.amountPaid, 0);
    
    // Calculate total discount
    const totalOriginalPrice = selectedProducts.reduce((sum, item) => 
      sum + (item.originalPrice * item.quantity), 0);
    const totalDiscount = totalOriginalPrice - subtotal;

    return {
      subtotal,
      totalCost,
      totalAmount,
      totalProfit,
      balance,
      totalOriginalPrice,
      totalDiscount
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

  // Update product stock immediately in CreateSaleTab's state
  const updateProductStockLocally = useCallback((soldItems) => {
    const updates = soldItems.map(item => ({
      productId: item.productId,
      quantity: item.quantity,
      productName: item.name
    }));
    
    // Dispatch event for other components
    window.dispatchEvent(new CustomEvent('stockUpdated', {
      detail: { 
        updates: updates,
        timestamp: new Date().toISOString()
      }
    }));
    
    return updates;
  }, []);

  // Function to refresh product cache comprehensively
  const refreshProductCache = useCallback(() => {
    console.log('🗑️ Refreshing product cache...');
    
    // Clear any cached product data
    const clearedCount = clearProductCache();
    
    // Update local state with immediate stock reduction
    if (selectedProducts.length > 0) {
      const updatedProducts = productCacheRef.current.map(product => {
        const soldItem = selectedProducts.find(item => item.productId === product._id);
        if (soldItem) {
          const newStock = Math.max(0, product.stock - soldItem.quantity);
          debugStockUpdate(product._id, product.stock, newStock);
          return {
            ...product,
            stock: newStock
          };
        }
        return product;
      });
      
      // Update local state immediately
      setFilteredProducts(prev => updatedProducts);
      productCacheRef.current = updatedProducts;
      
      // Save to localStorage for other tabs
      try {
        LocalStorageService.saveProducts(updatedProducts);
      } catch (error) {
        console.error('Error saving products to localStorage:', error);
      }
    }
    
    // Refresh from source
    if (onProductsRefresh) {
      console.log('🔄 Calling onProductsRefresh after cache clear...');
      setTimeout(() => {
        onProductsRefresh();
      }, 50);
    }
    
    console.log(`✅ Cache refresh completed. Cleared ${clearedCount} entries.`);
  }, [selectedProducts, onProductsRefresh, clearProductCache, debugStockUpdate]);

  // Enhanced handleCreateSale for real-time updates - FIXED infinite loops
  const handleCreateSale = async () => {
    if (selectedProducts.length === 0) {
      setError('Add at least one product to the sale');
      return;
    }

    // Validate stock availability one more time
    for (const item of selectedProducts) {
      const product = products.find(p => p._id === item.productId);
      if (!product) {
        setError(`"${item.name}" not found in inventory`);
        return;
      }
      if (product.stock < item.quantity) {
        setError(`Only ${product.stock} "${item.name}" available. You selected ${item.quantity}`);
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
          productCategory: item.category,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          unitCost: item.unitCost,
          originalPrice: item.originalPrice,
          usedCustomPrice: item.useCustomPrice,
          discountPercent: item.discountPercent || 0,
          isLocalProduct: item.isLocal || false
        })),
        subtotal: totals.subtotal,
        totalCost: totals.totalCost,
        totalProfit: totals.totalProfit,
        totalAmount: totals.totalAmount,
        totalDiscount: totals.totalDiscount,
        paymentMethod: saleDetails.paymentMethod,
        amountPaid: saleDetails.amountPaid,
        notes: saleDetails.notes,
        soldBy: user?.id || user?.name || 'local_admin'
      };

      console.log('🛒 Creating sale with data:', {
        items: selectedProducts.map(p => `${p.name} x${p.quantity}`),
        totalAmount: totals.totalAmount,
        totalProfit: totals.totalProfit
      });

      if (!isOnline) {
        console.log('📱 Creating offline sale...');
        const offlineSale = LocalStorageService.addOfflineSale(saleData);
        
        if (offlineSale) {
          console.log('✅ Offline sale created:', offlineSale.saleNumber);
          
          // Update product stock locally and trigger events
          const stockUpdates = updateProductStockLocally(selectedProducts);
          
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
          
          // 🔥 CRITICAL: Refresh product cache and force refresh
          console.log('✅ Sale created successfully, refreshing products...');
          
          // Dispatch comprehensive event (DIFFERENT event name to avoid loops)
          window.dispatchEvent(new CustomEvent('saleCreated', {
            detail: {
              saleId: offlineSale._id,
              saleNumber: offlineSale.saleNumber,
              items: selectedProducts,
              stockUpdates: stockUpdates,
              timestamp: new Date().toISOString(),
              type: 'sale_created'
            }
          }));
          
          // Force immediate refresh of products with guard
          if (onProductsRefresh && !isProcessingRef.current) {
            console.log('🔄 Calling onProductsRefresh...');
            // Use setTimeout to ensure UI updates
            setTimeout(() => {
              onProductsRefresh();
            }, 300);
          }
          
          // Also update local storage cache
          const updatedProducts = products.map(product => {
            const soldItem = selectedProducts.find(item => item.productId === product._id);
            if (soldItem) {
              const newStock = Math.max(0, product.stock - soldItem.quantity);
              return {
                ...product,
                stock: newStock
              };
            }
            return product;
          });

          // Update local state immediately
          setFilteredProducts(prev => updatedProducts);

          // Save to localStorage for other tabs
          LocalStorageService.saveProducts(updatedProducts);
          
          // Call comprehensive cache refresh
          refreshProductCache();
          
          // Notify parent component
          if (onSaleCreated) {
            console.log('📢 Notifying parent of sale created');
            onSaleCreated();
          }
        } else {
          setError('Failed to save sale locally. Please try again.');
        }
      } else {
        // Create sale online
        console.log('🌐 Creating online sale...');
        const result = await createOnlineSale(saleData);
        
        if (result.success) {
          console.log('✅ Online sale created:', result.sale.saleNumber);
          
          // Update product stock locally
          const stockUpdates = updateProductStockLocally(selectedProducts);
          
          setSuccess({
            saleNumber: result.sale.saleNumber,
            message: '✅ Sale created successfully!',
            showPrint: false
          });
          
          // Reset form
          resetForm();
          
          // 🔥 CRITICAL: Refresh product cache and force refresh
          console.log('✅ Sale created successfully, refreshing products...');
          
          // Dispatch comprehensive event (DIFFERENT event name)
          window.dispatchEvent(new CustomEvent('saleCreated', {
            detail: {
              saleId: result.sale._id,
              saleNumber: result.sale.saleNumber,
              items: selectedProducts,
              stockUpdates: stockUpdates,
              timestamp: new Date().toISOString(),
              type: 'sale_created'
            }
          }));
          
          // Force immediate refresh of products with guard
          if (onProductsRefresh && !isProcessingRef.current) {
            console.log('🔄 Calling onProductsRefresh...');
            // Use setTimeout to ensure UI updates
            setTimeout(() => {
              onProductsRefresh();
            }, 300);
          }
          
          // Also update local storage cache
          const updatedProducts = products.map(product => {
            const soldItem = selectedProducts.find(item => item.productId === product._id);
            if (soldItem) {
              const newStock = Math.max(0, product.stock - soldItem.quantity);
              return {
                ...product,
                stock: newStock
              };
            }
            return product;
          });

          // Update local state immediately
          setFilteredProducts(prev => updatedProducts);

          // Save to localStorage for other tabs
          LocalStorageService.saveProducts(updatedProducts);
          
          // Call comprehensive cache refresh
          refreshProductCache();
          
          // Notify parent component
          if (onSaleCreated) {
            console.log('📢 Notifying parent of sale created');
            onSaleCreated();
          }
        } else {
          setError(result.message || 'Failed to create sale');
          
          // Try offline save if online failed
          try {
            console.log('⚠️ Online creation failed. Trying offline save...');
            const offlineSale = LocalStorageService.addOfflineSale({
              ...saleData,
              syncError: true,
              errorMessage: result.message
            });
            
            if (offlineSale) {
              // Update product stock locally
              const stockUpdates = updateProductStockLocally(selectedProducts);
              
              setSuccess({
                saleNumber: offlineSale.saleNumber,
                message: 'Sale saved locally due to connection error.',
                showPrint: true
              });
              
              const receipt = generateOfflineReceipt(offlineSale);
              setOfflineReceipt(receipt);
              
              // Force refresh products with cache clearing
              refreshProductCache();
              
              // Update offline sales count
              const sales = LocalStorageService.getSales();
              const offlineSales = sales.filter(s => s.isLocal && !s.synced);
              setOfflineSalesCount(offlineSales.length);
              
              // Trigger event (DIFFERENT event name)
              window.dispatchEvent(new CustomEvent('saleCreated', {
                detail: { 
                  saleId: offlineSale._id,
                  saleNumber: offlineSale.saleNumber,
                  items: selectedProducts,
                  stockUpdates: stockUpdates,
                  timestamp: new Date().toISOString(),
                  type: 'sale_created_offline'
                }
              }));
            }
          } catch (offlineError) {
            setError(`Failed to save sale: ${offlineError.message}`);
          }
        }
      }
      
    } catch (error) {
      console.error('❌ Error creating sale:', error);
      
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
            // Update product stock locally
            const stockUpdates = updateProductStockLocally(selectedProducts);
            
            setSuccess({
              saleNumber: offlineSale.saleNumber,
              message: 'Sale saved locally due to connection error.',
              showPrint: true
            });
            
            const receipt = generateOfflineReceipt(offlineSale);
            setOfflineReceipt(receipt);
            
            // Force refresh products with cache clearing
            refreshProductCache();
            
            // Update offline sales count
            const sales = LocalStorageService.getSales();
            const offlineSales = sales.filter(s => s.isLocal && !s.synced);
            setOfflineSalesCount(offlineSales.length);
            
            // Trigger event (DIFFERENT event name)
            window.dispatchEvent(new CustomEvent('saleCreated', {
              detail: { 
                saleId: offlineSale._id,
                saleNumber: offlineSale.saleNumber,
                items: selectedProducts,
                stockUpdates: stockUpdates,
                timestamp: new Date().toISOString(),
                type: 'sale_created_offline_fallback'
              }
            }));
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
    setActiveDiscounts({});
    setRecentlyUpdatedProducts(new Set());
    setMarkedProducts(new Set());
    if (mobileView) {
      setWorkflowStep('select');
    }
  };

  const handleRetryProducts = () => {
    if (onProductsRefresh) {
      onProductsRefresh();
    }
  };

  const handleQuickDiscount = (productId, percent) => {
    applyDiscount(productId, percent);
  };

  const clearDiscount = (productId) => {
    setSelectedProducts(prev =>
      prev.map(item => {
        if (item.productId === productId) {
          return {
            ...item,
            useCustomPrice: false,
            customPrice: item.originalPrice,
            unitPrice: item.originalPrice,
            discountPercent: 0
          };
        }
        return item;
      })
    );

    setActiveDiscounts(prev => {
      const newDiscounts = { ...prev };
      delete newDiscounts[productId];
      return newDiscounts;
    });
  };

  // Add manual cache refresh button handler
  const handleForceCacheRefresh = () => {
    console.log('🔄 Manual cache refresh triggered');
    forceProductRefresh();
    setSuccess({
      saleNumber: 'CACHE',
      message: 'Product cache refreshed!',
      showPrint: false
    });
  };

  // Mobile workflow navigation
  const goToSelectProducts = () => {
    setWorkflowStep('select');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const goToReviewItems = () => {
    setWorkflowStep('review');
    setTimeout(() => {
      saleItemsRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, 100);
  };

  const goToSaleDetails = () => {
    setWorkflowStep('details');
    setTimeout(() => {
      saleDetailsRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, 100);
  };

  // Mobile workflow header
  const MobileWorkflowHeader = () => (
    <div className="md:hidden theme-surface border-b theme-border sticky top-0 z-10">
      <div className="flex items-center justify-between p-3">
        <button
          onClick={() => {
            if (workflowStep === 'review') goToSelectProducts();
            else if (workflowStep === 'details') goToReviewItems();
          }}
          className="flex items-center gap-2 theme-text"
        >
          {workflowStep !== 'select' && <ChevronLeft className="h-5 w-5" />}
          <span className="font-medium">
            {workflowStep === 'select' ? 'Select Products' :
             workflowStep === 'review' ? 'Review Items' :
             'Sale Details'}
          </span>
        </button>
        
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1">
            <div className={`w-3 h-3 rounded-full ${workflowStep === 'select' ? 'bg-blue-600' : 'bg-gray-300'}`} />
            <div className={`w-3 h-3 rounded-full ${workflowStep === 'review' ? 'bg-blue-600' : 'bg-gray-300'}`} />
            <div className={`w-3 h-3 rounded-full ${workflowStep === 'details' ? 'bg-blue-600' : 'bg-gray-300'}`} />
          </div>
        </div>
      </div>
      
      {/* Step indicator */}
      <div className="px-3 pb-3">
        <div className="flex items-center justify-between text-xs theme-text-muted">
          <div className={`text-center ${workflowStep === 'select' ? 'text-blue-600 font-semibold' : ''}`}>
            <div className="mx-auto mb-1">1</div>
            <div>Select</div>
          </div>
          <div className="flex-1 h-px bg-gray-300 mx-2"></div>
          <div className={`text-center ${workflowStep === 'review' ? 'text-blue-600 font-semibold' : ''}`}>
            <div className="mx-auto mb-1">2</div>
            <div>Review</div>
          </div>
          <div className="flex-1 h-px bg-gray-300 mx-2"></div>
          <div className={`text-center ${workflowStep === 'details' ? 'text-blue-600 font-semibold' : ''}`}>
            <div className="mx-auto mb-1">3</div>
            <div>Details</div>
          </div>
        </div>
      </div>
    </div>
  );

  // Mobile action buttons
  const MobileActionButtons = () => {
    if (workflowStep === 'select') {
      return (
        <div className="md:hidden fixed bottom-0 left-0 right-0 theme-surface border-t theme-border p-4 z-20 shadow-lg">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm theme-text">
              {markedProducts.size} product{markedProducts.size !== 1 ? 's' : ''} selected
            </span>
            <button
              onClick={() => setMarkedProducts(new Set())}
              className="text-xs text-red-600 hover:text-red-800"
            >
              Clear All
            </button>
          </div>
          <button
            onClick={addMarkedProductsToSale}
            disabled={markedProducts.size === 0}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            <Check className="h-5 w-5" />
            Add {markedProducts.size} Item{markedProducts.size !== 1 ? 's' : ''} to Sale
          </button>
        </div>
      );
    }
    
    if (workflowStep === 'review') {
      return (
        <div className="md:hidden fixed bottom-0 left-0 right-0 theme-surface border-t theme-border p-4 z-20 shadow-lg">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm theme-text">
              {selectedProducts.length} item{selectedProducts.length !== 1 ? 's' : ''} in sale
            </span>
            <button
              onClick={resetForm}
              className="text-xs text-red-600 hover:text-red-800"
            >
              Clear All
            </button>
          </div>
          <button
            onClick={goToSaleDetails}
            disabled={selectedProducts.length === 0}
            className="w-full bg-green-600 hover:bg-green-700 text-white py-3 rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            <ChevronRight className="h-5 w-5" />
            Proceed to Sale Details
          </button>
        </div>
      );
    }
    
    return null;
  };

  return (
    <div className="space-y-4 p-2">
      {/* Mobile Workflow Header */}
      {mobileView && <MobileWorkflowHeader />}

      {/* Network Status */}
      {!isOnline && (
        <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg dark:bg-yellow-900/20 dark:border-yellow-800">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CloudOff className="h-4 w-4 text-yellow-600 dark:text-yellow-500" />
              <div>
                <p className="text-sm font-semibold text-yellow-800 dark:text-yellow-200">Offline Mode</p>
                <p className="text-xs text-yellow-700 dark:text-yellow-300">
                  Sales will be saved locally and synced when internet returns
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {offlineSalesCount > 0 && (
                <span className="bg-yellow-100 dark:bg-yellow-800 px-2 py-1 rounded text-xs text-yellow-800 dark:text-yellow-200">
                  {offlineSalesCount} pending sales
                </span>
              )}
              <button
                onClick={handleForceCacheRefresh}
                className="flex items-center gap-1.5 border border-yellow-300 dark:border-yellow-700 text-yellow-700 dark:text-yellow-300 hover:bg-yellow-50 dark:hover:bg-yellow-900/50 px-2.5 py-1 rounded text-xs transition-colors"
                title="Force refresh product cache"
              >
                <RefreshCw className="h-3 w-3" />
                Refresh Cache
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Success Message */}
      {success && (
        <div className={`p-3 ${
          success.showPrint 
            ? 'bg-green-50 border border-green-200 rounded-lg dark:bg-green-900/20 dark:border-green-800' 
            : 'bg-green-50 border border-green-200 rounded text-xs dark:bg-green-900/20 dark:border-green-800'
        }`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CheckCircle className="h-4 w-4 text-green-600 dark:text-green-500" />
              <div>
                <p className="text-sm font-semibold text-green-800 dark:text-green-200">{success.message}</p>
                <p className="text-xs text-green-700 dark:text-green-300">
                  {success.saleNumber !== 'CACHE' ? `Sale #${success.saleNumber}` : 'Cache refreshed'}
                </p>
              </div>
            </div>
            {success.showPrint && (
              <button
                onClick={printOfflineReceipt}
                className="flex items-center gap-1 bg-green-600 hover:bg-green-700 dark:bg-green-700 dark:hover:bg-green-600 text-white px-3 py-1 rounded text-sm transition-colors"
              >
                <Printer className="h-3 w-3" />
                Print Receipt
              </button>
            )}
          </div>
        </div>
      )}

      {/* Error Message */}
      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded flex items-center justify-between dark:bg-red-900/20 dark:border-red-800">
          <div className="flex items-center gap-2">
            <AlertCircle className="h-4 w-4 text-red-600 dark:text-red-500" />
            <p className="text-sm text-red-700 dark:text-red-300">{error}</p>
          </div>
          {error.includes('backend') && onProductsRefresh && (
            <button
              onClick={handleRetryProducts}
              className="ml-2 bg-red-600 hover:bg-red-700 dark:bg-red-700 dark:hover:bg-red-600 text-white px-3 py-1.5 rounded flex items-center gap-1 text-sm transition-colors"
            >
              <RefreshCw className="h-3 w-3" />
              Retry
            </button>
          )}
        </div>
      )}

      {/* Stock Update Debug Panel (only in development) */}
      {process.env.NODE_ENV === 'development' && productStockUpdates.length > 0 && (
        <div className="p-3 bg-gray-100 border border-gray-300 rounded text-xs dark:bg-gray-900 dark:border-gray-700">
          <div className="flex items-center gap-2 mb-2">
            <Database className="h-4 w-4 text-gray-600 dark:text-gray-400" />
            <span className="font-medium text-gray-700 dark:text-gray-300">Recent Stock Updates:</span>
            <button 
              onClick={() => setProductStockUpdates([])}
              className="ml-auto text-xs text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
            >
              Clear
            </button>
          </div>
          <div className="space-y-1 max-h-24 overflow-y-auto">
            {productStockUpdates.map((update, index) => (
              <div key={index} className="flex items-center gap-3 text-gray-600 dark:text-gray-400 p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded">
                <span className="text-xs font-mono">{update.timestamp}</span>
                <span>ID: {update.productId?.substring(0, 8)}...</span>
                <span className="font-medium">
                  {update.oldStock} → <span className="text-red-600 dark:text-red-400">{update.newStock}</span>
                </span>
                <span className="text-red-600 dark:text-red-400 text-xs">
                  (Δ {update.newStock - update.oldStock})
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* THREE COLUMN LAYOUT */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        
        {/* COLUMN 1: Products & Customer */}
        <div className={`space-y-4 ${mobileView && workflowStep !== 'select' ? 'hidden md:block' : ''}`}>
          {/* Product Search */}
          <div className="theme-surface rounded-lg shadow-sm border theme-border p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold theme-text flex items-center gap-2">
                <Package className="h-4 w-4" />
                Products
                <span className="text-xs font-normal theme-text-muted">
                  ({products.length} available)
                </span>
              </h3>
              <div className="flex items-center gap-2">
                {onProductsRefresh && (
                  <button
                    onClick={handleRetryProducts}
                    disabled={productsLoading}
                    className="flex items-center gap-1.5 border theme-border theme-text-muted hover:theme-secondary px-2.5 py-1.5 rounded text-xs transition-colors disabled:opacity-50"
                  >
                    <RefreshCw className={`h-3 w-3 ${productsLoading ? 'animate-spin' : ''}`} />
                    Refresh Stock
                  </button>
                )}
                <button
                  onClick={handleForceCacheRefresh}
                  className="flex items-center gap-1.5 border border-blue-300 dark:border-blue-700 text-blue-700 dark:text-blue-300 hover:bg-blue-50 dark:hover:bg-blue-900/50 px-2.5 py-1.5 rounded text-xs transition-colors"
                  title="Clear cache and refresh"
                >
                  <Database className="h-3 w-3" />
                  Clear Cache
                </button>
              </div>
            </div>
            
            <div className="relative mb-3">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-3.5 w-3.5 theme-text-muted" />
              <input
                type="text"
                placeholder="Search products by name, brand, or category..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-3 py-2.5 border theme-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 theme-surface theme-text placeholder-theme-text-muted"
              />
            </div>

            {/* Products List */}
            <div className="max-h-[28rem] overflow-y-auto">
              {productsLoading ? (
                <div className="text-center py-6">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
                  <p className="theme-text-muted text-xs mt-2">Loading products...</p>
                </div>
              ) : filteredProducts.length === 0 ? (
                <div className="text-center py-6">
                  <ShoppingCart className="h-10 w-10 mx-auto mb-2 theme-text-muted opacity-60" />
                  <p className="theme-text-muted text-sm">No products found</p>
                  {searchTerm && (
                    <p className="theme-text-muted text-xs mt-1">
                      Try a different search term
                    </p>
                  )}
                </div>
              ) : (
                <div className="space-y-2">
                  {filteredProducts.map((product) => {
                    const selectedItem = selectedProducts.find(item => item.productId === product._id);
                    const usedQuantity = selectedItem?.quantity || 0;
                    const availableStock = product.stock - usedQuantity;
                    const isRecentlyUpdated = recentlyUpdatedProducts.has(product._id);
                    const isLowStock = product.stock <= (product.lowStockAlert || 5);
                    const isOutOfStock = product.stock === 0;
                    const isMarked = markedProducts.has(product._id);
                    
                    return (
                      <div
                        key={product._id}
                        className={`flex items-center justify-between p-3 border rounded-lg transition-all duration-200 ${
                          isRecentlyUpdated 
                            ? 'border-blue-500 bg-blue-50 shadow-sm dark:border-blue-400 dark:bg-blue-900/20' 
                            : isMarked
                            ? 'border-green-500 bg-green-50 dark:border-green-400 dark:bg-green-900/20'
                            : 'theme-border hover:border-gray-300 dark:hover:border-gray-600'
                        } ${availableStock === 0 ? 'opacity-70' : 'hover:shadow-sm'}`}
                      >
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <h4 className="font-medium theme-text text-sm truncate">
                              {product.name}
                            </h4>
                            {product.isLocal && (
                              <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200">
                                <CloudOff className="h-2.5 w-2.5 mr-1" />
                                Local
                              </span>
                            )}
                            {isRecentlyUpdated && (
                              <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200 animate-pulse">
                                <ArrowUpDown className="h-2.5 w-2.5 mr-1" />
                                Updated
                              </span>
                            )}
                            {isMarked && (
                              <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
                                <Check className="h-2.5 w-2.5 mr-1" />
                                Selected
                              </span>
                            )}
                          </div>
                          <p className="theme-text-muted text-xs truncate mt-0.5">{product.brand}</p>
                          <div className="flex items-center gap-2 mt-2">
                            <span className="font-semibold text-blue-600 dark:text-blue-400 text-sm">
                              UGX {product.sellingPrice?.toLocaleString()}
                            </span>
                            <div className="flex items-center gap-1.5">
                              <span className={`text-xs px-2 py-1 rounded-full font-medium ${
                                isOutOfStock
                                  ? 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
                                  : isLowStock
                                  ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200'
                                  : 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                              }`}>
                                {isOutOfStock ? 'Out of stock' : `Stock: ${product.stock}`}
                              </span>
                              {usedQuantity > 0 && (
                                <span className="text-xs px-2 py-1 rounded-full font-medium bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">
                                  In cart: {usedQuantity}
                                </span>
                              )}
                            </div>
                          </div>
                          {availableStock < product.stock && (
                            <p className="text-xs text-blue-600 dark:text-blue-400 mt-1 font-medium">
                              Available for sale: {availableStock}
                            </p>
                          )}
                        </div>
                        <button
                          onClick={() => mobileView && workflowStep === 'select' ? toggleProductMark(product) : addProductToSale(product)}
                          disabled={availableStock === 0}
                          className={`ml-3 p-2 rounded-lg transition-all duration-200 ${
                            availableStock === 0 
                              ? 'bg-gray-300 text-gray-500 cursor-not-allowed dark:bg-gray-700 dark:text-gray-400' 
                              : isMarked
                              ? 'bg-green-600 hover:bg-green-700 text-white shadow-sm hover:shadow dark:bg-green-700 dark:hover:bg-green-600'
                              : 'bg-blue-600 hover:bg-blue-700 text-white shadow-sm hover:shadow dark:bg-blue-700 dark:hover:bg-blue-600'
                          }`}
                          title={availableStock === 0 ? 'Out of stock' : isMarked ? 'Remove from selection' : 'Add to sale'}
                        >
                          {isMarked ? <Check className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
            
            {/* Mobile Done Button for Product Selection */}
            {mobileView && workflowStep === 'select' && markedProducts.size > 0 && (
              <div className="mt-4 pt-4 border-t theme-border md:hidden">
                <button
                  onClick={addMarkedProductsToSale}
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-lg font-medium transition-colors flex items-center justify-center gap-2"
                >
                  <Check className="h-5 w-5" />
                  Add {markedProducts.size} Selected Item{markedProducts.size !== 1 ? 's' : ''} to Sale
                </button>
              </div>
            )}
          </div>

          {/* Customer Information */}
          <div className="theme-surface rounded-lg shadow-sm border theme-border p-4">
            <h3 className="text-sm font-semibold theme-text mb-3 flex items-center gap-2">
              <User className="h-4 w-4" />
              Customer Information (Optional)
            </h3>
            
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium theme-text mb-1.5">
                  Customer Name
                </label>
                <input
                  type="text"
                  value={customer.name}
                  onChange={(e) => setCustomer(prev => ({ ...prev, name: e.target.value }))}
                  className="w-full px-3 py-2.5 border theme-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 theme-surface theme-text placeholder-theme-text-muted"
                  placeholder="Walk-in Customer"
                />
              </div>
              
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium theme-text mb-1.5 flex items-center gap-1.5">
                    <Phone className="h-3.5 w-3.5" />
                    Phone Number
                  </label>
                  <input
                    type="tel"
                    value={customer.phone}
                    onChange={(e) => setCustomer(prev => ({ ...prev, phone: e.target.value }))}
                    className="w-full px-3 py-2.5 border theme-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 theme-surface theme-text placeholder-theme-text-muted"
                    placeholder="+256 XXX XXX XXX"
                  />
                </div>
                
                <div>
                  <label className="block text-xs font-medium theme-text mb-1.5 flex items-center gap-1.5">
                    <Mail className="h-3.5 w-3.5" />
                    Email Address
                  </label>
                  <input
                    type="email"
                    value={customer.email}
                    onChange={(e) => setCustomer(prev => ({ ...prev, email: e.target.value }))}
                    className="w-full px-3 py-2.5 border theme-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 theme-surface theme-text placeholder-theme-text-muted"
                    placeholder="customer@example.com"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* COLUMN 2: Sale Items */}
        <div 
          ref={saleItemsRef}
          className={`space-y-4 ${mobileView && workflowStep !== 'review' ? 'hidden md:block' : ''}`}
        >
          <div className="theme-surface rounded-lg shadow-sm border theme-border p-4 h-fit">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold theme-text flex items-center gap-2">
                <ShoppingCart className="h-4 w-4" />
                Sale Items
                <span className="text-xs font-normal theme-text-muted">
                  ({selectedProducts.length} items)
                </span>
              </h3>
              <div className="flex items-center gap-2">
                {selectedProducts.length > 0 && (
                  <button
                    onClick={resetForm}
                    className="text-xs text-red-600 hover:text-red-800 flex items-center gap-1.5 transition-colors dark:text-red-400 dark:hover:text-red-300"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    Clear All
                  </button>
                )}
                {mobileView && workflowStep === 'review' && (
                  <button
                    onClick={goToSelectProducts}
                    className="text-xs text-blue-600 hover:text-blue-800 flex items-center gap-1.5 transition-colors"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    Add More
                  </button>
                )}
              </div>
            </div>
            
            {selectedProducts.length === 0 ? (
              <div className="text-center py-6">
                <ShoppingCart className="h-10 w-10 mx-auto mb-2 theme-text-muted opacity-60" />
                <p className="theme-text-muted text-sm">No products selected</p>
                <p className="theme-text-muted text-xs mt-1">
                  Add products from the left panel
                </p>
                {mobileView && (
                  <button
                    onClick={goToSelectProducts}
                    className="mt-4 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2.5 rounded-lg text-sm transition-colors"
                  >
                    Select Products
                  </button>
                )}
              </div>
            ) : (
              <>
                <div className="space-y-3 max-h-[28rem] overflow-y-auto pr-1">
                  {selectedProducts.map((item) => {
                    const product = products.find(p => p._id === item.productId);
                    const stockAfterSale = product ? product.stock - item.quantity : item.stock;
                    const hasDiscount = activeDiscounts[item.productId] > 0;
                    
                    return (
                      <div key={item.productId} className="p-3 border theme-border rounded-lg theme-secondary">
                        {/* Product Header */}
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <h4 className="font-medium theme-text text-sm truncate">
                                {item.name}
                              </h4>
                              {item.isLocal && (
                                <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200">
                                  <Shield className="h-2.5 w-2.5 mr-1" />
                                  Local
                                </span>
                              )}
                            </div>
                            <p className="theme-text-muted text-xs truncate mt-0.5">
                              {item.brand} • {item.category}
                            </p>
                          </div>
                          <button
                            onClick={() => removeProductFromSale(item.productId)}
                            className="ml-3 p-1.5 text-red-600 hover:bg-red-50 rounded-lg transition-colors dark:text-red-400 dark:hover:bg-red-900/30"
                            title="Remove from sale"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>

                        {/* Stock Warning */}
                        {product && stockAfterSale <= (product.lowStockAlert || 5) && stockAfterSale > 0 && (
                          <div className="mb-3 p-2 bg-yellow-50 border border-yellow-200 rounded text-xs text-yellow-700 dark:bg-yellow-900/30 dark:border-yellow-800 dark:text-yellow-300">
                            ⚠️ After sale: {stockAfterSale} units left (low stock)
                          </div>
                        )}

                        {/* Price Selection */}
                        <div className="space-y-2.5 mb-3">
                          <div className="flex items-center justify-between text-xs">
                            <span className="theme-text-muted">Cost Price:</span>
                            <span className="font-medium theme-text">
                              UGX {item.unitCost?.toLocaleString()}
                            </span>
                          </div>
                          
                          <div className="flex items-center gap-2">
                            <label className="flex items-center gap-1.5 text-xs">
                              <input
                                type="radio"
                                checked={!item.useCustomPrice}
                                onChange={() => togglePriceType(item.productId, false)}
                                className="h-3.5 w-3.5 text-blue-600 focus:ring-blue-500 dark:text-blue-400 dark:focus:ring-blue-400"
                              />
                              <span className="theme-text">Original Price:</span>
                            </label>
                            <span className="font-semibold text-blue-600 dark:text-blue-400 text-sm">
                              UGX {item.originalPrice?.toLocaleString()}
                            </span>
                          </div>

                          <div className="flex items-center gap-2">
                            <label className="flex items-center gap-1.5 text-xs">
                              <input
                                type="radio"
                                checked={item.useCustomPrice}
                                onChange={() => togglePriceType(item.productId, true)}
                                className="h-3.5 w-3.5 text-blue-600 focus:ring-blue-500 dark:text-blue-400 dark:focus:ring-blue-400"
                              />
                              <span className="theme-text">Custom Price:</span>
                            </label>
                            
                            {editingPrice === item.productId ? (
                              <div className="flex items-center gap-2">
                                <input
                                  type="number"
                                  value={customPrice}
                                  onChange={(e) => setCustomPrice(e.target.value)}
                                  className="w-24 px-2 py-1.5 border theme-border rounded text-sm theme-surface theme-text"
                                  placeholder="Price"
                                  min="0"
                                  step="100"
                                  autoFocus
                                />
                                <button
                                  onClick={() => saveCustomPrice(item.productId)}
                                  className="p-1.5 text-green-600 hover:bg-green-50 rounded-lg transition-colors dark:text-green-400 dark:hover:bg-green-900/30"
                                  title="Save price"
                                >
                                  <Save className="h-4 w-4" />
                                </button>
                                <button
                                  onClick={cancelEditingPrice}
                                  className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg transition-colors dark:text-red-400 dark:hover:bg-red-900/30"
                                  title="Cancel"
                                >
                                  <X className="h-4 w-4" />
                                </button>
                              </div>
                            ) : (
                              <div className="flex items-center gap-2">
                                <span className="font-semibold text-blue-600 dark:text-blue-400 text-sm">
                                  UGX {item.customPrice?.toLocaleString()}
                                </span>
                                <button
                                  onClick={() => startEditingPrice(item.productId, item.customPrice)}
                                  className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors dark:text-blue-400 dark:hover:bg-blue-900/30"
                                  title="Edit price"
                                >
                                  <Edit3 className="h-4 w-4" />
                                </button>
                              </div>
                            )}
                          </div>

                          {/* Quick Discount Buttons */}
                          <div className="flex items-center gap-1.5 pt-1">
                            <span className="text-xs theme-text-muted mr-1">Quick Discount:</span>
                            {[5, 10, 15, 20].map(percent => (
                              <button
                                key={percent}
                                onClick={() => handleQuickDiscount(item.productId, percent)}
                                className={`px-2 py-1 rounded text-xs transition-colors ${
                                  activeDiscounts[item.productId] === percent
                                    ? 'bg-blue-600 text-white dark:bg-blue-500'
                                    : 'theme-secondary theme-text hover:theme-secondary'
                                }`}
                              >
                                {percent}%
                              </button>
                            ))}
                            {hasDiscount && (
                              <button
                                onClick={() => clearDiscount(item.productId)}
                                className="px-2 py-1 rounded text-xs bg-red-100 text-red-700 hover:bg-red-200 transition-colors dark:bg-red-900 dark:text-red-300 dark:hover:bg-red-800"
                              >
                                Clear
                              </button>
                            )}
                          </div>

                          {/* Current Selling Price */}
                          <div className="flex items-center justify-between pt-2 border-t theme-border">
                            <span className="font-medium theme-text text-sm">Selling Price:</span>
                            <span className={`font-bold text-sm ${
                              item.useCustomPrice && item.customPrice !== item.originalPrice
                                ? 'text-orange-600 dark:text-orange-400'
                                : 'text-blue-600 dark:text-blue-400'
                            }`}>
                              UGX {item.unitPrice?.toLocaleString()}
                              {item.useCustomPrice && item.customPrice !== item.originalPrice && (
                                <span className="ml-1.5 text-xs font-normal">
                                  ({item.discountPercent > 0 ? `-${item.discountPercent}%` : 'Custom'})
                                </span>
                              )}
                            </span>
                          </div>
                        </div>

                        {/* Quantity Controls */}
                        <div className="flex items-center justify-between pt-3 border-t theme-border">
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => updateProductQuantity(item.productId, item.quantity - 1)}
                              className="p-1.5 border theme-border rounded-lg hover:theme-secondary transition-colors"
                              title="Decrease quantity"
                            >
                              <Minus className="h-3.5 w-3.5" />
                            </button>
                            <span className="w-10 text-center text-sm font-bold theme-text theme-surface py-1.5 rounded-lg border theme-border">
                              {item.quantity}
                            </span>
                            <button
                              onClick={() => updateProductQuantity(item.productId, item.quantity + 1)}
                              disabled={item.quantity >= item.maxQuantity}
                              className="p-1.5 border theme-border rounded-lg hover:theme-secondary disabled:opacity-50 transition-colors"
                              title="Increase quantity"
                            >
                              <Plus className="h-3.5 w-3.5" />
                            </button>
                            <span className="ml-2 text-xs theme-text-muted">
                              of {item.maxQuantity}
                            </span>
                          </div>
                          
                          <div className="text-right">
                            <span className="font-bold text-blue-600 dark:text-blue-400 text-sm">
                              UGX {(item.unitPrice * item.quantity).toLocaleString()}
                            </span>
                            <div className="text-xs theme-text-muted mt-0.5">
                              Profit: UGX {((item.unitPrice - item.unitCost) * item.quantity).toLocaleString()}
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
                
                {/* Mobile Done Button for Review */}
                {mobileView && workflowStep === 'review' && (
                  <div className="mt-4 pt-4 border-t theme-border">
                    <button
                      onClick={goToSaleDetails}
                      className="w-full bg-green-600 hover:bg-green-700 text-white py-3 rounded-lg font-medium transition-colors flex items-center justify-center gap-2"
                    >
                      <ChevronRight className="h-5 w-5" />
                      Proceed to Sale Details
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        </div>

        {/* COLUMN 3: Sale Details & Summary */}
        <div 
          ref={saleDetailsRef}
          className={`space-y-4 ${mobileView && workflowStep !== 'details' ? 'hidden md:block' : ''}`}
        >
          {/* Sale Details */}
          <div className="theme-surface rounded-lg shadow-sm border theme-border p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold theme-text mb-3 flex items-center gap-2">
                <Calculator className="h-4 w-4" />
                Sale Details
              </h3>
              {mobileView && workflowStep === 'details' && (
                <button
                  onClick={goToReviewItems}
                  className="text-xs text-blue-600 hover:text-blue-800 flex items-center gap-1.5 transition-colors"
                >
                  <ChevronLeft className="h-3.5 w-3.5" />
                  Back to Items
                </button>
              )}
            </div>
            
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium theme-text mb-2">
                  Payment Method
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { value: 'cash', label: 'Cash', icon: <Receipt className="h-4 w-4" /> },
                    { value: 'card', label: 'Card', icon: <CreditCard className="h-4 w-4" /> },
                    { value: 'mobile_money', label: 'M-Pesa', icon: <Smartphone className="h-4 w-4" /> },
                    { value: 'bank_transfer', label: 'Bank', icon: <Building className="h-4 w-4" /> }
                  ].map((method) => (
                    <button
                      key={method.value}
                      onClick={() => setSaleDetails(prev => ({ ...prev, paymentMethod: method.value }))}
                      className={`flex items-center gap-2 p-3 border rounded-lg text-xs font-medium transition-all duration-200 ${
                        saleDetails.paymentMethod === method.value
                          ? 'bg-blue-600 text-white border-blue-600 shadow-sm dark:bg-blue-500 dark:border-blue-500'
                          : 'theme-border theme-text hover:theme-secondary'
                      }`}
                      title={`Pay with ${method.label}`}
                    >
                      {method.icon}
                      {method.label}
                    </button>
                  ))}
                </div>
              </div>
              
              <div>
                <label className="block text-xs font-medium theme-text mb-2">
                  Total Amount
                </label>
                <div className="p-3 theme-secondary rounded-lg border theme-border text-center">
                  <span className="text-lg font-bold text-blue-600 dark:text-blue-400">
                    UGX {totals.totalAmount.toLocaleString()}
                  </span>
                  {totals.totalDiscount > 0 && (
                    <p className="text-xs text-green-600 dark:text-green-400 mt-1">
                      You saved UGX {totals.totalDiscount.toLocaleString()}
                    </p>
                  )}
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium theme-text mb-2">
                  Amount Paid
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-sm theme-text-muted">UGX</span>
                  <input
                    type="number"
                    min="0"
                    step="1000"
                    max={totals.totalAmount * 2}
                    value={saleDetails.amountPaid}
                    onChange={(e) => setSaleDetails(prev => ({ ...prev, amountPaid: parseFloat(e.target.value) || 0 }))}
                    className="w-full pl-12 pr-3 py-2.5 border theme-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 theme-surface theme-text"
                  />
                </div>
                <div className="flex gap-2 mt-2">
                  <button
                    onClick={() => setSaleDetails(prev => ({ ...prev, amountPaid: totals.totalAmount }))}
                    className="flex-1 text-xs border theme-border rounded px-2 py-1.5 theme-text hover:theme-secondary transition-colors"
                  >
                    Full Amount
                  </button>
                  <button
                    onClick={() => setSaleDetails(prev => ({ ...prev, amountPaid: totals.totalAmount / 2 }))}
                    className="flex-1 text-xs border theme-border rounded px-2 py-1.5 theme-text hover:theme-secondary transition-colors"
                  >
                    Half
                  </button>
                  <button
                    onClick={() => setSaleDetails(prev => ({ ...prev, amountPaid: 0 }))}
                    className="flex-1 text-xs border theme-border rounded px-2 py-1.5 theme-text hover:theme-secondary transition-colors"
                  >
                    Zero
                  </button>
                </div>
              </div>
              
              <div>
                <label className="block text-xs font-medium theme-text mb-2">
                  Sale Notes
                </label>
                <textarea
                  value={saleDetails.notes}
                  onChange={(e) => setSaleDetails(prev => ({ ...prev, notes: e.target.value }))}
                  rows="3"
                  className="w-full px-3 py-2.5 border theme-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 theme-surface theme-text placeholder-theme-text-muted"
                  placeholder="Sale notes, customer remarks, special instructions..."
                />
              </div>
            </div>
          </div>

          {/* Order Summary */}
          <div className="theme-surface rounded-lg shadow-sm border theme-border p-4">
            <h3 className="text-sm font-semibold theme-text mb-3 flex items-center gap-2">
              <Receipt className="h-4 w-4" />
              Order Summary
            </h3>
            
            <div className="space-y-2 text-sm">
              <div className="flex justify-between items-center py-1.5">
                <span className="theme-text-muted">Subtotal:</span>
                <span className="font-medium theme-text">UGX {totals.subtotal.toLocaleString()}</span>
              </div>
              
              {totals.totalDiscount > 0 && (
                <div className="flex justify-between items-center py-1.5 border-t theme-border pt-2">
                  <span className="theme-text-muted">Discount:</span>
                  <span className="font-medium text-green-600 dark:text-green-400">-UGX {totals.totalDiscount.toLocaleString()}</span>
                </div>
              )}
              
              <div className="flex justify-between items-center py-1.5 border-t theme-border pt-2">
                <span className="theme-text font-medium">Total:</span>
                <span className="font-bold text-blue-600 dark:text-blue-400 text-lg">UGX {totals.totalAmount.toLocaleString()}</span>
              </div>
              
              <div className="flex justify-between items-center py-1.5">
                <span className="theme-text-muted">Paid:</span>
                <span className="font-medium theme-text">UGX {saleDetails.amountPaid.toLocaleString()}</span>
              </div>
              
              <div className="flex justify-between items-center py-1.5 border-t theme-border pt-2">
                <span className="theme-text-muted">Balance:</span>
                <span className={`font-bold ${
                  totals.balance === 0 ? 'text-green-600 dark:text-green-400' : 
                  totals.balance > 0 ? 'text-yellow-600 dark:text-yellow-400' : 'text-red-600 dark:text-red-400'
                }`}>
                  UGX {totals.balance.toLocaleString()}
                </span>
              </div>
              
              <div className="flex justify-between items-center py-1.5">
                <span className="theme-text-muted">Total Cost:</span>
                <span className="font-medium theme-text">UGX {totals.totalCost.toLocaleString()}</span>
              </div>
              
              <div className="flex justify-between items-center py-1.5 border-t theme-border pt-2">
                <span className="theme-text font-bold">Total Profit:</span>
                <span className="font-bold text-green-600 dark:text-green-400 text-lg">UGX {totals.totalProfit.toLocaleString()}</span>
              </div>

              {/* Items Summary */}
              <div className="mt-3 pt-3 border-t theme-border">
                <div className="flex justify-between text-xs theme-text-muted mb-1">
                  <span>Items:</span>
                  <span>{selectedProducts.reduce((sum, item) => sum + item.quantity, 0)} units</span>
                </div>
                <div className="flex justify-between text-xs theme-text-muted">
                  <span>Products:</span>
                  <span>{selectedProducts.length} items</span>
                </div>
              </div>
            </div>
            
            <div className="mt-4 flex gap-3">
              <button
                onClick={resetForm}
                disabled={creatingSale}
                className="flex-1 border theme-border theme-text hover:theme-secondary py-2.5 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
              >
                Clear All
              </button>
              
              <button
                onClick={handleCreateSale}
                disabled={creatingSale || selectedProducts.length === 0}
                className="flex-1 bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white py-2.5 rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2 disabled:cursor-not-allowed shadow-sm hover:shadow dark:bg-green-700 dark:hover:bg-green-600 dark:disabled:bg-gray-700"
              >
                {creatingSale ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                    {isOnline ? 'Processing...' : 'Saving locally...'}
                  </>
                ) : (
                  <>
                    <Receipt className="h-4 w-4" />
                    {isOnline ? 'Create Sale' : 'Save Locally'}
                  </>
                )}
              </button>
            </div>
            
            <div className="mt-3 pt-3 border-t theme-border">
              <p className="text-xs theme-text-muted text-center">
                {selectedProducts.length} item{selectedProducts.length !== 1 ? 's' : ''} • 
                {selectedProducts.reduce((sum, item) => sum + item.quantity, 0)} units • 
                UGX {totals.totalAmount.toLocaleString()}
              </p>
              {user && (
                <p className="text-xs theme-text-muted text-center mt-1">
                  Cashier: {user.name || 'Admin'}
                </p>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Mobile Action Buttons */}
      {mobileView && <MobileActionButtons />}
    </div>
  );
};

export default CreateSaleTab;