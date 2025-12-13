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
            name: product.name || 'Unknown Product',
            brand: product.brand || 'Unknown Brand',
            category: product.category,
            unitPrice: product.sellingPrice || 0,
            originalPrice: product.sellingPrice || 0,
            unitCost: product.purchasePrice || 0,
            quantity: 1,
            stock: product.stock,
            maxQuantity: product.stock,
            useCustomPrice: false,
            customPrice: product.sellingPrice || 0,
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
          name: product.name || 'Unknown Product',
          brand: product.brand || 'Unknown Brand',
          category: product.category,
          unitPrice: product.sellingPrice || 0,
          originalPrice: product.sellingPrice || 0,
          unitCost: product.purchasePrice || 0,
          quantity: 1,
          stock: product.stock,
          maxQuantity: product.stock,
          useCustomPrice: false,
          customPrice: product.sellingPrice || 0,
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

  // Enhanced handleCreateSale for real-time updates - FIXED
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

      // ✅ FIXED: Build sale items with correct field names for backend
      const saleItems = selectedProducts.map(item => {
        const product = products.find(p => p._id === item.productId);
        
        // Build item with EXACT field names that backend expects
        const saleItem = {
          productId: item.productId,  // Backend will map this to 'product' field
          name: item.name || product?.name || 'Unknown Product',
          brand: item.brand || product?.brand || 'Unknown Brand',
          sellingPrice: item.unitPrice || 0,
          purchasePrice: item.unitCost || 0,
          quantity: item.quantity,
          unitPrice: item.unitPrice || 0,
          unitCost: item.unitCost || 0,
          originalPrice: item.originalPrice || 0,
          discountPercent: item.discountPercent || 0
        };

        return saleItem;
      });

      // ✅ FIXED: Build sale data with correct structure
      const saleData = {
        customer: customerData,
        items: saleItems,
        subtotal: totals.subtotal,
        totalCost: totals.totalCost,
        totalProfit: totals.totalProfit,
        totalAmount: totals.totalAmount,
        discountAmount: totals.totalDiscount || 0,
        taxAmount: 0,  // Add if you have tax
        paymentMethod: saleDetails.paymentMethod,
        amountPaid: saleDetails.amountPaid,
        notes: saleDetails.notes,
        // Backend will automatically set soldBy from the authenticated user
        soldBy: user?.id || user?._id || 'local_admin'
      };

      console.log('🛒 Creating sale with data:', {
        items: saleItems.map(p => ({
          name: p.name,
          brand: p.brand,
          sellingPrice: p.sellingPrice,
          quantity: p.quantity,
          productId: p.productId
        })),
        totalAmount: totals.totalAmount,
        totalProfit: totals.totalProfit,
        soldBy: saleData.soldBy
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

          // Build sale items for offline fallback
          const fallbackSaleItems = selectedProducts.map(item => ({
            productId: item.productId,
            name: item.name || 'Unknown Product',
            brand: item.brand || 'Unknown Brand',
            sellingPrice: item.unitPrice || 0,
            purchasePrice: item.unitCost || 0,
            quantity: item.quantity,
            unitPrice: item.unitPrice || 0,
            unitCost: item.unitCost || 0,
            originalPrice: item.originalPrice || 0,
            discountPercent: item.discountPercent || 0
          }));

          const fallbackSaleData = {
            customer: customerData,
            items: fallbackSaleItems,
            subtotal: totals.subtotal,
            totalCost: totals.totalCost,
            totalProfit: totals.totalProfit,
            totalAmount: totals.totalAmount,
            discountAmount: totals.totalDiscount || 0,
            taxAmount: 0,
            paymentMethod: saleDetails.paymentMethod,
            amountPaid: saleDetails.amountPaid,
            notes: saleDetails.notes,
            soldBy: user?.id || user?._id || 'local_admin'
          };

          const offlineSale = LocalStorageService.addOfflineSale({
            ...fallbackSaleData,
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
            
            // Reset form
            resetForm();
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
  };

  const goToReviewItems = () => {
    setWorkflowStep('review');
  };

  const goToSaleDetails = () => {
    setWorkflowStep('details');
  };

  // Compact mobile header
  const MobileCompactHeader = () => (
    <div className="md:hidden theme-surface border-b theme-border sticky top-0 z-10 py-1">
      <div className="flex items-center justify-between px-2">
        <button
          onClick={() => {
            if (workflowStep === 'review') goToSelectProducts();
            else if (workflowStep === 'details') goToReviewItems();
          }}
          className="flex items-center gap-1 theme-text text-xs"
        >
          {workflowStep !== 'select' && <ChevronLeft className="h-4 w-4" />}
          <span className="font-medium">
            {workflowStep === 'select' ? 'Select' :
             workflowStep === 'review' ? 'Review' :
             'Details'}
          </span>
        </button>
        
        <div className="flex items-center gap-1">
          <div className={`w-2 h-2 rounded-full ${workflowStep === 'select' ? 'bg-blue-600' : 'bg-gray-300'}`} />
          <div className={`w-2 h-2 rounded-full ${workflowStep === 'review' ? 'bg-blue-600' : 'bg-gray-300'}`} />
          <div className={`w-2 h-2 rounded-full ${workflowStep === 'details' ? 'bg-blue-600' : 'bg-gray-300'}`} />
        </div>
      </div>
      
      {/* Selected count */}
      {workflowStep === 'select' && markedProducts.size > 0 && (
        <div className="px-2 mt-1 flex items-center justify-between">
          <span className="text-xs theme-text">
            {markedProducts.size} selected
          </span>
          <button
            onClick={() => setMarkedProducts(new Set())}
            className="text-xs text-red-600 hover:text-red-800"
          >
            Clear
          </button>
        </div>
      )}
    </div>
  );

  return (
    <div className="space-y-2 p-1 md:space-y-4 md:p-2">
      {/* Mobile Compact Header */}
      {mobileView && <MobileCompactHeader />}

      {/* Network Status - Compact on mobile */}
      {!isOnline && (
        <div className="p-2 md:p-3 bg-yellow-50 border border-yellow-200 rounded-lg dark:bg-yellow-900/20 dark:border-yellow-800">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1 md:gap-2">
              <CloudOff className="h-3 w-3 md:h-4 md:w-4 text-yellow-600 dark:text-yellow-500" />
              <div>
                <p className="text-xs md:text-sm font-semibold text-yellow-800 dark:text-yellow-200">Offline Mode</p>
                <p className="text-[10px] md:text-xs text-yellow-700 dark:text-yellow-300">
                  Sales saved locally
                </p>
              </div>
            </div>
            {offlineSalesCount > 0 && (
              <span className="bg-yellow-100 dark:bg-yellow-800 px-1.5 py-0.5 rounded text-[10px] md:text-xs text-yellow-800 dark:text-yellow-200">
                {offlineSalesCount}
              </span>
            )}
          </div>
        </div>
      )}

      {/* Success Message - Compact */}
      {success && (
        <div className={`p-2 md:p-3 ${
          success.showPrint 
            ? 'bg-green-50 border border-green-200 rounded-lg dark:bg-green-900/20 dark:border-green-800' 
            : 'bg-green-50 border border-green-200 rounded dark:bg-green-900/20 dark:border-green-800'
        }`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1 md:gap-2">
              <CheckCircle className="h-3 w-3 md:h-4 md:w-4 text-green-600 dark:text-green-500" />
              <div>
                <p className="text-xs md:text-sm font-semibold text-green-800 dark:text-green-200">{success.message}</p>
                {success.saleNumber !== 'CACHE' && (
                  <p className="text-[10px] md:text-xs text-green-700 dark:text-green-300">
                    #{success.saleNumber}
                  </p>
                )}
              </div>
            </div>
            {success.showPrint && (
              <button
                onClick={printOfflineReceipt}
                className="flex items-center gap-1 bg-green-600 hover:bg-green-700 dark:bg-green-700 dark:hover:bg-green-600 text-white px-2 py-1 rounded text-xs md:text-sm transition-colors"
              >
                <Printer className="h-3 w-3" />
                <span className="hidden sm:inline">Print</span>
              </button>
            )}
          </div>
        </div>
      )}

      {/* Error Message - Compact */}
      {error && (
        <div className="p-2 md:p-3 bg-red-50 border border-red-200 rounded flex items-center justify-between dark:bg-red-900/20 dark:border-red-800">
          <div className="flex items-center gap-1 md:gap-2 flex-1 min-w-0">
            <AlertCircle className="h-3 w-3 md:h-4 md:w-4 text-red-600 dark:text-red-500 flex-shrink-0" />
            <p className="text-xs md:text-sm text-red-700 dark:text-red-300 truncate">{error}</p>
          </div>
          {error.includes('backend') && onProductsRefresh && (
            <button
              onClick={handleRetryProducts}
              className="ml-1 bg-red-600 hover:bg-red-700 dark:bg-red-700 dark:hover:bg-red-600 text-white px-2 py-1 rounded flex items-center gap-1 text-xs transition-colors flex-shrink-0"
            >
              <RefreshCw className="h-3 w-3" />
            </button>
          )}
        </div>
      )}

      {/* THREE COLUMN LAYOUT */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2 md:gap-4">
        
        {/* COLUMN 1: Products & Customer */}
        <div className={`space-y-2 md:space-y-4 ${mobileView && workflowStep !== 'select' ? 'hidden md:block' : ''}`}>
          {/* Product Search - Compact */}
          <div className="theme-surface rounded-lg shadow-sm border theme-border p-2 md:p-4">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-xs md:text-sm font-semibold theme-text flex items-center gap-1 md:gap-2">
                <Package className="h-3 w-3 md:h-4 md:w-4" />
                Products
                <span className="text-[10px] md:text-xs font-normal theme-text-muted">
                  ({products.length})
                </span>
              </h3>
              <div className="flex items-center gap-1 md:gap-2">
                {onProductsRefresh && (
                  <button
                    onClick={handleRetryProducts}
                    disabled={productsLoading}
                    className="flex items-center gap-1 border theme-border theme-text-muted hover:theme-secondary px-1.5 py-1 md:px-2.5 md:py-1.5 rounded text-[10px] md:text-xs transition-colors disabled:opacity-50"
                  >
                    <RefreshCw className={`h-2.5 w-2.5 md:h-3 md:w-3 ${productsLoading ? 'animate-spin' : ''}`} />
                    <span className="hidden sm:inline">Refresh</span>
                  </button>
                )}
              </div>
            </div>
            
            <div className="relative mb-2">
              <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 h-3 w-3 md:h-3.5 md:w-3.5 theme-text-muted" />
              <input
                type="text"
                placeholder="Search products..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-7 pr-2 py-1.5 md:pl-9 md:pr-3 md:py-2.5 border theme-border rounded-lg text-xs md:text-sm focus:outline-none focus:ring-1 md:focus:ring-2 focus:ring-blue-500 theme-surface theme-text placeholder-theme-text-muted"
              />
            </div>

            {/* Products List - Compact */}
            <div className="max-h-[60vh] md:max-h-[28rem] overflow-y-auto">
              {productsLoading ? (
                <div className="text-center py-4 md:py-6">
                  <div className="animate-spin rounded-full h-6 w-6 md:h-8 md:w-8 border-b-2 border-blue-600 mx-auto"></div>
                  <p className="theme-text-muted text-[10px] md:text-xs mt-1">Loading...</p>
                </div>
              ) : filteredProducts.length === 0 ? (
                <div className="text-center py-4 md:py-6">
                  <ShoppingCart className="h-8 w-8 md:h-10 md:w-10 mx-auto mb-1 md:mb-2 theme-text-muted opacity-60" />
                  <p className="theme-text-muted text-xs md:text-sm">No products found</p>
                </div>
              ) : (
                <div className="space-y-1 md:space-y-2">
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
                        className={`flex items-center justify-between p-2 border rounded-lg transition-all duration-200 ${
                          isRecentlyUpdated 
                            ? 'border-blue-500 bg-blue-50 shadow-sm dark:border-blue-400 dark:bg-blue-900/20' 
                            : isMarked
                            ? 'border-green-500 bg-green-50 dark:border-green-400 dark:bg-green-900/20'
                            : 'theme-border hover:border-gray-300 dark:hover:border-gray-600'
                        } ${availableStock === 0 ? 'opacity-70' : 'hover:shadow-sm'}`}
                      >
                        <div className="flex-1 min-w-0 pr-1">
                          <div className="flex items-center gap-1">
                            <h4 className="font-medium theme-text text-xs truncate">
                              {product.name || 'Unnamed Product'}
                            </h4>
                            {product.isLocal && (
                              <span className="inline-flex items-center px-1 py-0.5 rounded-full text-[10px] font-medium bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200">
                                <CloudOff className="h-2 w-2 mr-0.5" />
                              </span>
                            )}
                          </div>
                          <div className="flex items-center justify-between mt-1">
                            <span className="font-semibold text-blue-600 dark:text-blue-400 text-xs">
                              UGX {(product.sellingPrice || 0).toLocaleString()}
                            </span>
                            <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${
                              isOutOfStock
                                ? 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
                                : isLowStock
                                ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200'
                                : 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                            }`}>
                              {product.stock}
                            </span>
                          </div>
                          {availableStock < product.stock && usedQuantity > 0 && (
                            <p className="text-[10px] text-blue-600 dark:text-blue-400 mt-0.5">
                              Available: {availableStock}
                            </p>
                          )}
                        </div>
                        <button
                          onClick={() => mobileView && workflowStep === 'select' ? toggleProductMark(product) : addProductToSale(product)}
                          disabled={availableStock === 0}
                          className={`ml-1 p-1.5 rounded-lg transition-all duration-200 ${
                            availableStock === 0 
                              ? 'bg-gray-300 text-gray-500 cursor-not-allowed dark:bg-gray-700 dark:text-gray-400' 
                              : isMarked
                              ? 'bg-green-600 hover:bg-green-700 text-white shadow-sm hover:shadow dark:bg-green-700 dark:hover:bg-green-600'
                              : 'bg-blue-600 hover:bg-blue-700 text-white shadow-sm hover:shadow dark:bg-blue-700 dark:hover:bg-blue-600'
                          }`}
                          title={availableStock === 0 ? 'Out of stock' : isMarked ? 'Remove from selection' : 'Add to sale'}
                        >
                          {isMarked ? <Check className="h-3 w-3" /> : <Plus className="h-3 w-3" />}
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Customer Information - Compact */}
          <div className="theme-surface rounded-lg shadow-sm border theme-border p-2 md:p-4">
            <h3 className="text-xs md:text-sm font-semibold theme-text mb-2 flex items-center gap-1 md:gap-2">
              <User className="h-3 w-3 md:h-4 md:w-4" />
              Customer
            </h3>
            
            <div className="space-y-2">
              <div>
                <input
                  type="text"
                  value={customer.name}
                  onChange={(e) => setCustomer(prev => ({ ...prev, name: e.target.value }))}
                  className="w-full px-2 py-1.5 md:px-3 md:py-2.5 border theme-border rounded-lg text-xs md:text-sm focus:outline-none focus:ring-1 md:focus:ring-2 focus:ring-blue-500 theme-surface theme-text placeholder-theme-text-muted"
                  placeholder="Customer name"
                />
              </div>
              
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <input
                    type="tel"
                    value={customer.phone}
                    onChange={(e) => setCustomer(prev => ({ ...prev, phone: e.target.value }))}
                    className="w-full px-2 py-1.5 border theme-border rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-blue-500 theme-surface theme-text placeholder-theme-text-muted"
                    placeholder="Phone"
                  />
                </div>
                
                <div>
                  <input
                    type="email"
                    value={customer.email}
                    onChange={(e) => setCustomer(prev => ({ ...prev, email: e.target.value }))}
                    className="w-full px-2 py-1.5 border theme-border rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-blue-500 theme-surface theme-text placeholder-theme-text-muted"
                    placeholder="Email"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* COLUMN 2: Sale Items */}
        <div 
          className={`space-y-2 md:space-y-4 ${mobileView && workflowStep !== 'review' ? 'hidden md:block' : ''}`}
        >
          <div className="theme-surface rounded-lg shadow-sm border theme-border p-2 md:p-4 h-fit">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-xs md:text-sm font-semibold theme-text flex items-center gap-1 md:gap-2">
                <ShoppingCart className="h-3 w-3 md:h-4 md:w-4" />
                Sale Items
                <span className="text-[10px] md:text-xs font-normal theme-text-muted">
                  ({selectedProducts.length})
                </span>
              </h3>
              <div className="flex items-center gap-1 md:gap-2">
                {selectedProducts.length > 0 && (
                  <button
                    onClick={resetForm}
                    className="text-xs text-red-600 hover:text-red-800 flex items-center gap-1 transition-colors dark:text-red-400 dark:hover:text-red-300"
                  >
                    <Trash2 className="h-3 w-3" />
                    <span className="hidden sm:inline">Clear</span>
                  </button>
                )}
                {mobileView && workflowStep === 'review' && selectedProducts.length === 0 && (
                  <button
                    onClick={goToSelectProducts}
                    className="text-xs text-blue-600 hover:text-blue-800 flex items-center gap-1 transition-colors"
                  >
                    <Plus className="h-3 w-3" />
                    Add
                  </button>
                )}
              </div>
            </div>
            
            {selectedProducts.length === 0 ? (
              <div className="text-center py-4 md:py-6">
                <ShoppingCart className="h-8 w-8 md:h-10 md:w-10 mx-auto mb-1 md:mb-2 theme-text-muted opacity-60" />
                <p className="theme-text-muted text-xs md:text-sm">No items</p>
                {mobileView && (
                  <button
                    onClick={goToSelectProducts}
                    className="mt-2 bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded-lg text-xs transition-colors"
                  >
                    Select Products
                  </button>
                )}
              </div>
            ) : (
              <>
                <div className="space-y-2 max-h-[60vh] md:max-h-[28rem] overflow-y-auto pr-1">
                  {selectedProducts.map((item) => {
                    const product = products.find(p => p._id === item.productId);
                    const stockAfterSale = product ? product.stock - item.quantity : item.stock;
                    const hasDiscount = activeDiscounts[item.productId] > 0;
                    
                    return (
                      <div key={item.productId} className="p-2 border theme-border rounded-lg theme-secondary">
                        {/* Product Header */}
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1">
                              <h4 className="font-medium theme-text text-xs truncate">
                                {item.name || 'Unknown Product'}
                              </h4>
                            </div>
                            <div className="flex items-center justify-between mt-1">
                              <span className="text-[10px] theme-text-muted">
                                UGX {(item.unitPrice || 0).toLocaleString()}
                              </span>
                              <button
                                onClick={() => removeProductFromSale(item.productId)}
                                className="p-1 text-red-600 hover:bg-red-50 rounded-lg transition-colors dark:text-red-400 dark:hover:bg-red-900/30"
                                title="Remove"
                              >
                                <Trash2 className="h-3 w-3" />
                              </button>
                            </div>
                          </div>
                        </div>

                        {/* Stock Warning */}
                        {product && stockAfterSale <= (product.lowStockAlert || 5) && stockAfterSale > 0 && (
                          <div className="mb-2 p-1 bg-yellow-50 border border-yellow-200 rounded text-[10px] text-yellow-700 dark:bg-yellow-900/30 dark:border-yellow-800 dark:text-yellow-300">
                            ⚠️ Low after sale: {stockAfterSale}
                          </div>
                        )}

                        {/* Price Selection */}
                        <div className="space-y-1.5 mb-2">
                          <div className="flex items-center justify-between text-[10px]">
                            <span className="theme-text-muted">Cost:</span>
                            <span className="font-medium theme-text">
                              UGX {(item.unitCost || 0).toLocaleString()}
                            </span>
                          </div>
                          
                          <div className="flex items-center gap-1">
                            <label className="flex items-center gap-1 text-[10px]">
                              <input
                                type="radio"
                                checked={!item.useCustomPrice}
                                onChange={() => togglePriceType(item.productId, false)}
                                className="h-2.5 w-2.5 text-blue-600 focus:ring-blue-500 dark:text-blue-400 dark:focus:ring-blue-400"
                              />
                              <span className="theme-text">Original:</span>
                            </label>
                            <span className="font-semibold text-blue-600 dark:text-blue-400 text-xs">
                              UGX {(item.originalPrice || 0).toLocaleString()}
                            </span>
                          </div>

                          <div className="flex items-center gap-1">
                            <label className="flex items-center gap-1 text-[10px]">
                              <input
                                type="radio"
                                checked={item.useCustomPrice}
                                onChange={() => togglePriceType(item.productId, true)}
                                className="h-2.5 w-2.5 text-blue-600 focus:ring-blue-500 dark:text-blue-400 dark:focus:ring-blue-400"
                              />
                              <span className="theme-text">Custom:</span>
                            </label>
                            
                            {editingPrice === item.productId ? (
                              <div className="flex items-center gap-1">
                                <input
                                  type="number"
                                  value={customPrice}
                                  onChange={(e) => setCustomPrice(e.target.value)}
                                  className="w-16 px-1 py-1 border theme-border rounded text-xs theme-surface theme-text"
                                  placeholder="Price"
                                  min="0"
                                  step="100"
                                  autoFocus
                                />
                                <button
                                  onClick={() => saveCustomPrice(item.productId)}
                                  className="p-1 text-green-600 hover:bg-green-50 rounded-lg transition-colors dark:text-green-400 dark:hover:bg-green-900/30"
                                  title="Save"
                                >
                                  <Save className="h-3 w-3" />
                                </button>
                                <button
                                  onClick={cancelEditingPrice}
                                  className="p-1 text-red-600 hover:bg-red-50 rounded-lg transition-colors dark:text-red-400 dark:hover:bg-red-900/30"
                                  title="Cancel"
                                >
                                  <X className="h-3 w-3" />
                                </button>
                              </div>
                            ) : (
                              <div className="flex items-center gap-1">
                                <span className="font-semibold text-blue-600 dark:text-blue-400 text-xs">
                                  UGX {(item.customPrice || 0).toLocaleString()}
                                </span>
                                <button
                                  onClick={() => startEditingPrice(item.productId, item.customPrice)}
                                  className="p-1 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors dark:text-blue-400 dark:hover:bg-blue-900/30"
                                  title="Edit"
                                >
                                  <Edit3 className="h-3 w-3" />
                                </button>
                              </div>
                            )}
                          </div>

                          {/* Quick Discount Buttons */}
                          {hasDiscount && (
                            <div className="flex items-center gap-1 pt-0.5">
                              <span className="text-[10px] theme-text-muted mr-0.5">Discount:</span>
                              {[5, 10, 15].map(percent => (
                                <button
                                  key={percent}
                                  onClick={() => handleQuickDiscount(item.productId, percent)}
                                  className={`px-1.5 py-0.5 rounded text-[10px] transition-colors ${
                                    activeDiscounts[item.productId] === percent
                                      ? 'bg-blue-600 text-white dark:bg-blue-500'
                                      : 'theme-secondary theme-text hover:theme-secondary'
                                  }`}
                                >
                                  {percent}%
                                </button>
                              ))}
                              <button
                                onClick={() => clearDiscount(item.productId)}
                                className="px-1.5 py-0.5 rounded text-[10px] bg-red-100 text-red-700 hover:bg-red-200 transition-colors dark:bg-red-900 dark:text-red-300 dark:hover:bg-red-800"
                              >
                                Clear
                              </button>
                            </div>
                          )}
                        </div>

                        {/* Quantity Controls */}
                        <div className="flex items-center justify-between pt-2 border-t theme-border">
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => updateProductQuantity(item.productId, item.quantity - 1)}
                              className="p-1 border theme-border rounded-lg hover:theme-secondary transition-colors"
                              title="Decrease"
                            >
                              <Minus className="h-2.5 w-2.5" />
                            </button>
                            <span className="w-8 text-center text-xs font-bold theme-text theme-surface py-1 rounded border theme-border">
                              {item.quantity}
                            </span>
                            <button
                              onClick={() => updateProductQuantity(item.productId, item.quantity + 1)}
                              disabled={item.quantity >= item.maxQuantity}
                              className="p-1 border theme-border rounded-lg hover:theme-secondary disabled:opacity-50 transition-colors"
                              title="Increase"
                            >
                              <Plus className="h-2.5 w-2.5" />
                            </button>
                          </div>
                          
                          <div className="text-right">
                            <span className="font-bold text-blue-600 dark:text-blue-400 text-xs">
                              UGX {((item.unitPrice || 0) * item.quantity).toLocaleString()}
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
                
                {/* Mobile Review Info */}
                {mobileView && workflowStep === 'review' && selectedProducts.length > 0 && (
                  <div className="mt-2 pt-2 border-t theme-border flex items-center justify-between text-xs">
                    <span className="theme-text">
                      Total: <span className="font-bold">UGX {totals.totalAmount.toLocaleString()}</span>
                    </span>
                    <span className="theme-text-muted">
                      {selectedProducts.reduce((sum, item) => sum + item.quantity, 0)} units
                    </span>
                  </div>
                )}
              </>
            )}
          </div>
        </div>

        {/* COLUMN 3: Sale Details & Summary */}
        <div 
          className={`space-y-2 md:space-y-4 ${mobileView && workflowStep !== 'details' ? 'hidden md:block' : ''}`}
        >
          {/* Sale Details - Compact */}
          <div className="theme-surface rounded-lg shadow-sm border theme-border p-2 md:p-4">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-xs md:text-sm font-semibold theme-text flex items-center gap-1 md:gap-2">
                <Calculator className="h-3 w-3 md:h-4 md:w-4" />
                Details
              </h3>
              {mobileView && workflowStep === 'details' && (
                <button
                  onClick={goToReviewItems}
                  className="text-xs text-blue-600 hover:text-blue-800 flex items-center gap-1 transition-colors"
                >
                  <ChevronLeft className="h-3 w-3" />
                  Back
                </button>
              )}
            </div>
            
            <div className="space-y-2">
              <div>
                <label className="block text-xs font-medium theme-text mb-1">
                  Payment
                </label>
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
                      className={`flex items-center gap-1 p-1.5 border rounded text-[10px] font-medium transition-all duration-200 ${
                        saleDetails.paymentMethod === method.value
                          ? 'bg-blue-600 text-white border-blue-600 shadow-sm dark:bg-blue-500 dark:border-blue-500'
                          : 'theme-border theme-text hover:theme-secondary'
                      }`}
                      title={method.label}
                    >
                      {method.icon}
                      <span className="hidden sm:inline">{method.label}</span>
                    </button>
                  ))}
                </div>
              </div>
              
              <div>
                <label className="block text-xs font-medium theme-text mb-1">
                  Total Amount
                </label>
                <div className="p-2 theme-secondary rounded-lg border theme-border text-center">
                  <span className="text-sm md:text-lg font-bold text-blue-600 dark:text-blue-400">
                    UGX {totals.totalAmount.toLocaleString()}
                  </span>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium theme-text mb-1">
                  Amount Paid
                </label>
                <div className="relative">
                  <span className="absolute left-2 top-1/2 transform -translate-y-1/2 text-xs theme-text-muted">UGX</span>
                  <input
                    type="number"
                    min="0"
                    step="1000"
                    max={totals.totalAmount * 2}
                    value={saleDetails.amountPaid}
                    onChange={(e) => setSaleDetails(prev => ({ ...prev, amountPaid: parseFloat(e.target.value) || 0 }))}
                    className="w-full pl-8 pr-2 py-1.5 border theme-border rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-blue-500 theme-surface theme-text"
                  />
                </div>
                <div className="flex gap-1 mt-1">
                  <button
                    onClick={() => setSaleDetails(prev => ({ ...prev, amountPaid: totals.totalAmount }))}
                    className="flex-1 text-[10px] border theme-border rounded px-1 py-1 theme-text hover:theme-secondary transition-colors"
                  >
                    Full
                  </button>
                  <button
                    onClick={() => setSaleDetails(prev => ({ ...prev, amountPaid: totals.totalAmount / 2 }))}
                    className="flex-1 text-[10px] border theme-border rounded px-1 py-1 theme-text hover:theme-secondary transition-colors"
                  >
                    Half
                  </button>
                  <button
                    onClick={() => setSaleDetails(prev => ({ ...prev, amountPaid: 0 }))}
                    className="flex-1 text-[10px] border theme-border rounded px-1 py-1 theme-text hover:theme-secondary transition-colors"
                  >
                    Zero
                  </button>
                </div>
              </div>
              
              <div>
                <label className="block text-xs font-medium theme-text mb-1">
                  Notes
                </label>
                <textarea
                  value={saleDetails.notes}
                  onChange={(e) => setSaleDetails(prev => ({ ...prev, notes: e.target.value }))}
                  rows="2"
                  className="w-full px-2 py-1.5 border theme-border rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-blue-500 theme-surface theme-text placeholder-theme-text-muted"
                  placeholder="Sale notes..."
                />
              </div>
            </div>
          </div>

          {/* Order Summary - Compact */}
          <div className="theme-surface rounded-lg shadow-sm border theme-border p-2 md:p-4">
            <h3 className="text-xs md:text-sm font-semibold theme-text mb-2 flex items-center gap-1 md:gap-2">
              <Receipt className="h-3 w-3 md:h-4 md:w-4" />
              Summary
            </h3>
            
            <div className="space-y-1 text-xs">
              <div className="flex justify-between items-center py-0.5">
                <span className="theme-text-muted">Subtotal:</span>
                <span className="font-medium theme-text">UGX {totals.subtotal.toLocaleString()}</span>
              </div>
              
              {totals.totalDiscount > 0 && (
                <div className="flex justify-between items-center py-0.5">
                  <span className="theme-text-muted">Discount:</span>
                  <span className="font-medium text-green-600 dark:text-green-400">-UGX {totals.totalDiscount.toLocaleString()}</span>
                </div>
              )}
              
              <div className="flex justify-between items-center py-0.5 border-t theme-border pt-1">
                <span className="theme-text font-medium">Total:</span>
                <span className="font-bold text-blue-600 dark:text-blue-400 text-sm md:text-lg">UGX {totals.totalAmount.toLocaleString()}</span>
              </div>
              
              <div className="flex justify-between items-center py-0.5">
                <span className="theme-text-muted">Paid:</span>
                <span className="font-medium theme-text">UGX {saleDetails.amountPaid.toLocaleString()}</span>
              </div>
              
              <div className="flex justify-between items-center py-0.5">
                <span className="theme-text-muted">Balance:</span>
                <span className={`font-bold ${
                  totals.balance === 0 ? 'text-green-600 dark:text-green-400' : 
                  totals.balance > 0 ? 'text-yellow-600 dark:text-yellow-400' : 'text-red-600 dark:text-red-400'
                }`}>
                  UGX {totals.balance.toLocaleString()}
                </span>
              </div>
              
              <div className="flex justify-between items-center py-0.5 border-t theme-border pt-1">
                <span className="theme-text font-medium">Profit:</span>
                <span className="font-bold text-green-600 dark:text-green-400">UGX {totals.totalProfit.toLocaleString()}</span>
              </div>
            </div>
            
            <div className="mt-3 flex gap-2">
              <button
                onClick={resetForm}
                disabled={creatingSale}
                className="flex-1 border theme-border theme-text hover:theme-secondary py-1.5 rounded-lg text-xs font-medium transition-colors disabled:opacity-50"
              >
                Clear
              </button>
              
              <button
                onClick={handleCreateSale}
                disabled={creatingSale || selectedProducts.length === 0}
                className="flex-1 bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white py-1.5 rounded-lg text-xs font-medium transition-colors flex items-center justify-center gap-1 disabled:cursor-not-allowed shadow-sm hover:shadow dark:bg-green-700 dark:hover:bg-green-600 dark:disabled:bg-gray-700"
              >
                {creatingSale ? (
                  <>
                    <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-white"></div>
                    <span className="hidden sm:inline">{isOnline ? 'Processing...' : 'Saving...'}</span>
                  </>
                ) : (
                  <>
                    <Receipt className="h-3 w-3" />
                    <span>{isOnline ? 'Create Sale' : 'Save Locally'}</span>
                  </>
                )}
              </button>
            </div>
            
            <div className="mt-2 pt-2 border-t theme-border">
              <p className="text-[10px] theme-text-muted text-center">
                {selectedProducts.length} item{selectedProducts.length !== 1 ? 's' : ''} • 
                {selectedProducts.reduce((sum, item) => sum + item.quantity, 0)} units
              </p>
              {user && (
                <p className="text-[10px] theme-text-muted text-center mt-0.5">
                  Cashier: {user.name || 'Admin'}
                </p>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Floating Add Button - Appears only when items are selected */}
      {mobileView && workflowStep === 'select' && markedProducts.size > 0 && (
        <button
          onClick={addMarkedProductsToSale}
          className="fixed bottom-4 right-4 bg-blue-600 hover:bg-blue-700 text-white p-2 rounded-full shadow-lg z-30 transition-all duration-200"
          title={`Add ${markedProducts.size} item${markedProducts.size !== 1 ? 's' : ''}`}
        >
          <div className="relative">
            <Check className="h-4 w-4" />
            {markedProducts.size > 0 && (
              <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] rounded-full h-4 w-4 flex items-center justify-center">
                {markedProducts.size}
              </span>
            )}
          </div>
        </button>
      )}

      {/* Floating Review Button - Appears only when in review step with items */}
      {mobileView && workflowStep === 'review' && selectedProducts.length > 0 && (
        <button
          onClick={goToSaleDetails}
          className="fixed bottom-4 right-4 bg-green-600 hover:bg-green-700 text-white p-2 rounded-full shadow-lg z-30 transition-all duration-200"
          title="Proceed to details"
        >
          <div className="relative">
            <ChevronRight className="h-4 w-4" />
            {selectedProducts.length > 0 && (
              <span className="absolute -top-1 -right-1 bg-blue-500 text-white text-[10px] rounded-full h-4 w-4 flex items-center justify-center">
                {selectedProducts.length}
              </span>
            )}
          </div>
        </button>
      )}
    </div>
  );
};

export default CreateSaleTab;