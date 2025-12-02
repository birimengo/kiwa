const LOCAL_STORAGE_KEYS = {
  PRODUCTS: 'electroshop_products',
  SALES: 'electroshop_sales',
  SYNC_QUEUE: 'electroshop_sync_queue',
  LAST_SYNC: 'electroshop_last_sync',
  PRODUCT_STATS: 'electroshop_product_stats',
  SETTINGS: 'electroshop_settings'
};

class LocalStorageService {
  // ============ INITIALIZATION ============
  static initialize() {
    try {
      // Initialize empty arrays if not exists
      if (!localStorage.getItem(LOCAL_STORAGE_KEYS.PRODUCTS)) {
        localStorage.setItem(LOCAL_STORAGE_KEYS.PRODUCTS, JSON.stringify([]));
      }
      if (!localStorage.getItem(LOCAL_STORAGE_KEYS.SALES)) {
        localStorage.setItem(LOCAL_STORAGE_KEYS.SALES, JSON.stringify([]));
      }
      if (!localStorage.getItem(LOCAL_STORAGE_KEYS.SYNC_QUEUE)) {
        localStorage.setItem(LOCAL_STORAGE_KEYS.SYNC_QUEUE, JSON.stringify([]));
      }
      console.log('✅ Local storage initialized');
      return true;
    } catch (error) {
      console.error('❌ Error initializing local storage:', error);
      return false;
    }
  }

  // ============ PRODUCTS ============
  static getProducts() {
    try {
      const products = localStorage.getItem(LOCAL_STORAGE_KEYS.PRODUCTS);
      return products ? JSON.parse(products) : [];
    } catch (error) {
      console.error('❌ Error getting products from localStorage:', error);
      return [];
    }
  }

  static saveProducts(products) {
    try {
      localStorage.setItem(LOCAL_STORAGE_KEYS.PRODUCTS, JSON.stringify(products));
      return true;
    } catch (error) {
      console.error('❌ Error saving products to localStorage:', error);
      return false;
    }
  }

  static getProduct(productId) {
    try {
      const products = this.getProducts();
      return products.find(p => p._id === productId);
    } catch (error) {
      console.error('❌ Error getting product:', error);
      return null;
    }
  }

  static updateProduct(productId, updates) {
    try {
      const products = this.getProducts();
      const index = products.findIndex(p => p._id === productId);
      
      if (index !== -1) {
        const existingProduct = products[index];
        const updatedProduct = {
          ...existingProduct,
          ...updates,
          updatedAt: new Date().toISOString(),
          // Preserve local status
          isLocal: existingProduct.isLocal || updates.isLocal || false
        };
        
        products[index] = updatedProduct;
        this.saveProducts(products);
        this.updateProductStats();
        
        console.log(`✅ Product updated: ${updatedProduct.name}`);
        return updatedProduct;
      }
      return null;
    } catch (error) {
      console.error('❌ Error updating product in localStorage:', error);
      return null;
    }
  }

  static addProduct(productData) {
    try {
      const products = this.getProducts();
      const newProduct = {
        ...productData,
        _id: productData._id || `local_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        isLocal: !productData._id,
        totalSold: productData.totalSold || 0,
        totalRevenue: productData.totalRevenue || 0,
        restockedQuantity: productData.restockedQuantity || 0,
        stockHistory: productData.stockHistory || [],
        synced: false,
        syncAttempts: 0
      };
      
      products.push(newProduct);
      this.saveProducts(products);
      this.updateProductStats();
      
      console.log(`✅ Product added: ${newProduct.name}`);
      return newProduct;
    } catch (error) {
      console.error('❌ Error adding product to localStorage:', error);
      return null;
    }
  }

  static deleteProduct(productId) {
    try {
      const products = this.getProducts();
      const filteredProducts = products.filter(p => p._id !== productId);
      this.saveProducts(filteredProducts);
      this.updateProductStats();
      
      console.log(`✅ Product deleted: ${productId}`);
      return true;
    } catch (error) {
      console.error('❌ Error deleting product from localStorage:', error);
      return false;
    }
  }

  // ============ SALES ============
  static getSales() {
    try {
      const sales = localStorage.getItem(LOCAL_STORAGE_KEYS.SALES);
      return sales ? JSON.parse(sales) : [];
    } catch (error) {
      console.error('❌ Error getting sales from localStorage:', error);
      return [];
    }
  }

  static saveSales(sales) {
    try {
      localStorage.setItem(LOCAL_STORAGE_KEYS.SALES, JSON.stringify(sales));
      return true;
    } catch (error) {
      console.error('❌ Error saving sales to localStorage:', error);
      return false;
    }
  }

  static getSale(saleId) {
    try {
      const sales = this.getSales();
      return sales.find(s => s._id === saleId);
    } catch (error) {
      console.error('❌ Error getting sale:', error);
      return null;
    }
  }

  static addOfflineSale(saleData) {
    try {
      console.log('💾 Starting offline sale creation...', saleData);
      
      const sales = this.getSales();
      const products = this.getProducts();
      
      // Generate sale number for offline sale
      const date = new Date();
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      
      // Find today's sales for sequence
      const todaySales = sales.filter(s => {
        const saleDate = new Date(s.createdAt);
        return saleDate.getFullYear() === year &&
               saleDate.getMonth() === date.getMonth() &&
               saleDate.getDate() === date.getDate();
      });
      
      const sequence = todaySales.length + 1;
      const saleNumber = `OFFLINE-${year}${month}${day}-${String(sequence).padStart(4, '0')}`;
      
      // Process sale items
      const processedItems = saleData.items.map(item => {
        const product = products.find(p => p._id === item.productId || p._id === item.product);
        const unitCost = item.unitCost || (product ? product.purchasePrice : 0);
        const unitPrice = item.unitPrice;
        const quantity = item.quantity;
        const totalPrice = unitPrice * quantity;
        const totalCost = unitCost * quantity;
        const profit = totalPrice - totalCost;
        
        return {
          product: item.productId,
          productName: item.productName || item.name,
          productBrand: item.productBrand || item.brand,
          quantity,
          unitPrice,
          unitCost,
          totalPrice,
          totalCost,
          profit,
          images: item.images || []
        };
      });
      
      // Calculate totals
      const subtotal = processedItems.reduce((sum, item) => sum + item.totalPrice, 0);
      const totalCost = processedItems.reduce((sum, item) => sum + item.totalCost, 0);
      const totalProfit = subtotal - totalCost;
      const amountPaid = saleData.amountPaid || subtotal;
      const balance = Math.max(0, subtotal - amountPaid);
      const paymentStatus = amountPaid >= subtotal ? 'paid' : amountPaid > 0 ? 'partially_paid' : 'pending';
      
      const offlineSale = {
        ...saleData,
        _id: `offline_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        saleNumber,
        items: processedItems,
        subtotal,
        discountAmount: saleData.discountAmount || 0,
        taxAmount: saleData.taxAmount || 0,
        totalAmount: subtotal - (saleData.discountAmount || 0) + (saleData.taxAmount || 0),
        totalCost,
        totalProfit,
        amountPaid,
        balance,
        paymentStatus,
        status: 'completed',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        isLocal: true,
        synced: false,
        syncAttempts: 0,
        // Customer info
        customer: {
          name: saleData.customer?.name || 'Walk-in Customer',
          phone: saleData.customer?.phone || '',
          email: saleData.customer?.email || '',
          location: saleData.customer?.location || ''
        },
        soldBy: saleData.soldBy || 'local_admin',
        paymentMethod: saleData.paymentMethod || 'cash',
        notes: saleData.notes || ''
      };
      
      // Add to sales
      sales.push(offlineSale);
      this.saveSales(sales);
      
      // Update product stock
      const stockUpdated = this.updateProductStockAfterSale(offlineSale);
      
      if (!stockUpdated) {
        console.error('❌ Failed to update product stock for offline sale');
        // Remove the sale if stock update failed
        const filteredSales = sales.filter(s => s._id !== offlineSale._id);
        this.saveSales(filteredSales);
        return null;
      }
      
      // Add to sync queue
      this.addToSyncQueue({
        type: 'SALE',
        action: 'CREATE',
        data: offlineSale,
        timestamp: new Date().toISOString()
      });
      
      console.log(`✅ Offline sale created: ${offlineSale.saleNumber}`);
      return offlineSale;
      
    } catch (error) {
      console.error('❌ Error creating offline sale:', error);
      return null;
    }
  }

  // ============ PRODUCT STOCK MANAGEMENT ============
  static updateProductStockAfterSale(sale) {
    try {
      const products = this.getProducts();
      let allStockUpdated = true;
      
      sale.items.forEach(saleItem => {
        const productIndex = products.findIndex(p => 
          p._id === saleItem.product || p._id === saleItem.productId
        );
        
        if (productIndex === -1) {
          console.error(`❌ Product not found for sale item: ${saleItem.productName}`);
          allStockUpdated = false;
          return;
        }
        
        const product = products[productIndex];
        const previousStock = product.stock || 0;
        
        if (previousStock < saleItem.quantity) {
          console.error(`❌ Insufficient stock for ${product.name}: ${previousStock} available, ${saleItem.quantity} requested`);
          allStockUpdated = false;
          return;
        }
        
        const newStock = previousStock - saleItem.quantity;
        
        // Update product
        products[productIndex] = {
          ...product,
          stock: newStock,
          totalSold: (product.totalSold || 0) + saleItem.quantity,
          totalRevenue: (product.totalRevenue || 0) + saleItem.totalPrice,
          lastSold: new Date().toISOString(),
          stockHistory: [
            ...(product.stockHistory || []),
            {
              previousStock,
              newStock,
              unitsChanged: -saleItem.quantity,
              type: 'sale',
              reference: sale._id,
              referenceModel: 'Sale',
              date: new Date().toISOString(),
              notes: `Sale: ${saleItem.quantity} units (${sale.saleNumber})`
            }
          ]
        };
      });
      
      if (allStockUpdated) {
        this.saveProducts(products);
        this.updateProductStats();
        console.log('✅ Product stock updated for sale');
        return true;
      } else {
        console.error('❌ Some products could not be updated');
        return false;
      }
      
    } catch (error) {
      console.error('❌ Error updating product stock after sale:', error);
      return false;
    }
  }

  static restockProduct(productId, quantity, notes = '') {
    try {
      const products = this.getProducts();
      const productIndex = products.findIndex(p => p._id === productId);
      
      if (productIndex === -1) {
        console.error(`❌ Product not found: ${productId}`);
        return null;
      }
      
      const product = products[productIndex];
      const previousStock = product.stock || 0;
      const newStock = previousStock + quantity;
      
      products[productIndex] = {
        ...product,
        stock: newStock,
        restockedQuantity: (product.restockedQuantity || 0) + quantity,
        lastRestocked: new Date().toISOString(),
        stockHistory: [
          ...(product.stockHistory || []),
          {
            previousStock,
            newStock,
            unitsChanged: quantity,
            type: 'restock',
            reference: null,
            referenceModel: 'Restock',
            date: new Date().toISOString(),
            notes: notes || `Restocked ${quantity} units`
          }
        ]
      };
      
      this.saveProducts(products);
      this.updateProductStats();
      
      // Add to sync queue
      this.addToSyncQueue({
        type: 'RESTOCK',
        action: 'UPDATE',
        data: {
          productId,
          quantity,
          notes,
          timestamp: new Date().toISOString()
        }
      });
      
      console.log(`✅ Product restocked: ${product.name} (+${quantity})`);
      return products[productIndex];
      
    } catch (error) {
      console.error('❌ Error restocking product:', error);
      return null;
    }
  }

  // ============ SYNC MANAGEMENT ============
  static getSyncQueue() {
    try {
      const queue = localStorage.getItem(LOCAL_STORAGE_KEYS.SYNC_QUEUE);
      return queue ? JSON.parse(queue) : [];
    } catch (error) {
      console.error('❌ Error getting sync queue:', error);
      return [];
    }
  }

  static addToSyncQueue(syncItem) {
    try {
      const queue = this.getSyncQueue();
      const itemWithId = {
        id: `sync_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        ...syncItem,
        createdAt: new Date().toISOString(),
        attempts: 0,
        lastAttempt: null,
        status: 'pending'
      };
      
      queue.push(itemWithId);
      localStorage.setItem(LOCAL_STORAGE_KEYS.SYNC_QUEUE, JSON.stringify(queue));
      
      console.log(`✅ Added to sync queue: ${syncItem.type} ${syncItem.action}`);
      return itemWithId.id;
    } catch (error) {
      console.error('❌ Error adding to sync queue:', error);
      return null;
    }
  }

  static updateSyncItem(syncId, updates) {
    try {
      const queue = this.getSyncQueue();
      const itemIndex = queue.findIndex(item => item.id === syncId);
      
      if (itemIndex !== -1) {
        queue[itemIndex] = {
          ...queue[itemIndex],
          ...updates,
          lastUpdated: new Date().toISOString()
        };
        localStorage.setItem(LOCAL_STORAGE_KEYS.SYNC_QUEUE, JSON.stringify(queue));
        return true;
      }
      return false;
    } catch (error) {
      console.error('❌ Error updating sync item:', error);
      return false;
    }
  }

  static removeFromSyncQueue(syncId) {
    try {
      const queue = this.getSyncQueue();
      const filteredQueue = queue.filter(item => item.id !== syncId);
      localStorage.setItem(LOCAL_STORAGE_KEYS.SYNC_QUEUE, JSON.stringify(filteredQueue));
      return true;
    } catch (error) {
      console.error('❌ Error removing from sync queue:', error);
      return false;
    }
  }

  // ============ SYNC WITH BACKEND ============
  static async syncOfflineSales(api) {
    if (!navigator.onLine) {
      console.log('📵 Device is offline - cannot sync sales');
      return { 
        success: false, 
        message: 'No internet connection',
        synced: 0,
        pending: 0,
        errors: []
      };
    }

    try {
      const sales = this.getSales().filter(sale => sale.isLocal && !sale.synced);
      const syncQueue = this.getSyncQueue().filter(item => 
        item.type === 'SALE' && item.status === 'pending'
      );
      
      console.log(`🔄 Starting sync: ${sales.length} sales, ${syncQueue.length} sync items`);
      
      let syncedCount = 0;
      const errors = [];
      
      // Process sales
      for (const sale of sales) {
        try {
          // Prepare sale data for backend
          const saleData = {
            customer: sale.customer,
            items: sale.items.map(item => ({
              productId: item.product,
              quantity: item.quantity,
              unitPrice: item.unitPrice
            })),
            paymentMethod: sale.paymentMethod,
            amountPaid: sale.amountPaid,
            notes: sale.notes,
            soldBy: sale.soldBy
          };
          
          // Send to backend
          const response = await api.createSale(saleData);
          
          if (response.data && response.data.success) {
            // Update local sale with backend data
            const allSales = this.getSales();
            const saleIndex = allSales.findIndex(s => s._id === sale._id);
            
            if (saleIndex !== -1) {
              allSales[saleIndex] = {
                ...allSales[saleIndex],
                _id: response.data.sale._id,
                saleNumber: response.data.sale.saleNumber,
                isLocal: false,
                synced: true,
                syncedAt: new Date().toISOString(),
                syncAttempts: (allSales[saleIndex].syncAttempts || 0) + 1
              };
              this.saveSales(allSales);
            }
            
            // Remove from sync queue
            const syncItem = syncQueue.find(item => 
              item.data && item.data._id === sale._id
            );
            if (syncItem) {
              this.removeFromSyncQueue(syncItem.id);
            }
            
            syncedCount++;
            console.log(`✅ Sale synced: ${response.data.sale.saleNumber}`);
          }
        } catch (error) {
          const errorMsg = `Sale ${sale.saleNumber}: ${error.response?.data?.message || error.message}`;
          errors.push(errorMsg);
          
          // Update sale with error info
          const allSales = this.getSales();
          const saleIndex = allSales.findIndex(s => s._id === sale._id);
          if (saleIndex !== -1) {
            allSales[saleIndex] = {
              ...allSales[saleIndex],
              syncAttempts: (allSales[saleIndex].syncAttempts || 0) + 1,
              lastSyncError: errorMsg,
              lastSyncAttempt: new Date().toISOString()
            };
            this.saveSales(allSales);
          }
          
          console.error(`❌ Failed to sync sale ${sale.saleNumber}:`, error);
        }
      }
      
      // Update last sync time
      localStorage.setItem(LOCAL_STORAGE_KEYS.LAST_SYNC, new Date().toISOString());
      
      const result = {
        success: errors.length === 0,
        synced: syncedCount,
        pending: sales.length - syncedCount,
        errors: errors,
        timestamp: new Date().toISOString()
      };
      
      console.log(`🔄 Sale sync completed: ${syncedCount}/${sales.length} synced`);
      return result;
      
    } catch (error) {
      console.error('❌ Sale sync failed:', error);
      return {
        success: false,
        synced: 0,
        pending: 0,
        errors: [error.message],
        timestamp: new Date().toISOString()
      };
    }
  }

  static async syncWithBackend(api) {
    if (!navigator.onLine) {
      console.log('📵 Device is offline - skipping sync');
      return { 
        success: false, 
        message: 'Device is offline',
        timestamp: new Date().toISOString()
      };
    }

    try {
      console.log('🔄 Starting full sync with backend...');
      
      const results = {
        sales: { synced: 0, errors: [] },
        products: { synced: 0, errors: [] },
        restocks: { synced: 0, errors: [] },
        timestamp: new Date().toISOString()
      };
      
      // 1. Sync offline sales
      const salesResult = await this.syncOfflineSales(api);
      results.sales = salesResult;
      
      // 2. Sync local products
      const localProducts = this.getProducts().filter(p => p.isLocal && !p.synced);
      for (const product of localProducts) {
        try {
          const productData = {
            name: product.name,
            brand: product.brand,
            purchasePrice: product.purchasePrice,
            sellingPrice: product.sellingPrice,
            category: product.category,
            description: product.description,
            stock: product.stock,
            lowStockAlert: product.lowStockAlert,
            images: product.images || []
          };
          
          const response = await api.createProduct(productData);
          
          if (response.data && response.data.success) {
            // Update local product with backend ID
            const products = this.getProducts();
            const productIndex = products.findIndex(p => p._id === product._id);
            if (productIndex !== -1) {
              products[productIndex] = {
                ...products[productIndex],
                _id: response.data.product._id,
                isLocal: false,
                synced: true,
                syncedAt: new Date().toISOString()
              };
              this.saveProducts(products);
            }
            
            results.products.synced++;
            console.log(`✅ Product synced: ${product.name}`);
          }
        } catch (error) {
          const errorMsg = `Product ${product.name}: ${error.message}`;
          results.products.errors.push(errorMsg);
          console.error(`❌ Error syncing product ${product.name}:`, error);
        }
      }
      
      // 3. Process other sync items (restocks, etc.)
      const syncQueue = this.getSyncQueue();
      for (const item of syncQueue) {
        try {
          if (item.type === 'RESTOCK') {
            const { productId, quantity, notes } = item.data;
            
            // Find product
            const product = this.getProducts().find(p => p._id === productId);
            if (product && !product.isLocal) {
              await api.restockProduct(product._id, { quantity, notes });
              this.removeFromSyncQueue(item.id);
              results.restocks.synced++;
              console.log(`✅ Restock synced for: ${product.name}`);
            }
          }
        } catch (error) {
          const errorMsg = `Sync item ${item.id}: ${error.message}`;
          results.restocks.errors.push(errorMsg);
          console.error(`❌ Error syncing item ${item.id}:`, error);
        }
      }
      
      // Update stats
      this.updateProductStats();
      
      const totalSynced = results.sales.synced + results.products.synced + results.restocks.synced;
      const totalErrors = [
        ...results.sales.errors,
        ...results.products.errors,
        ...results.restocks.errors
      ].length;
      
      const finalResult = {
        success: totalErrors === 0,
        ...results,
        totalSynced,
        totalErrors,
        message: totalErrors === 0 
          ? `Sync completed successfully: ${totalSynced} items synced`
          : `Sync completed with ${totalErrors} errors: ${totalSynced} items synced`
      };
      
      console.log(`🔄 Full sync completed: ${totalSynced} items synced, ${totalErrors} errors`);
      return finalResult;
      
    } catch (error) {
      console.error('❌ Full sync failed:', error);
      return {
        success: false,
        message: 'Sync failed',
        error: error.message,
        timestamp: new Date().toISOString()
      };
    }
  }

  // ============ STATISTICS ============
  static updateProductStats() {
    try {
      const products = this.getProducts();
      
      const stats = {
        totalProducts: products.length,
        totalStock: products.reduce((sum, product) => sum + (product.stock || 0), 0),
        totalValue: products.reduce((sum, product) => 
          sum + ((product.purchasePrice || 0) * (product.stock || 0)), 0),
        totalRevenue: products.reduce((sum, product) => sum + (product.totalRevenue || 0), 0),
        totalSold: products.reduce((sum, product) => sum + (product.totalSold || 0), 0),
        lowStockProducts: products.filter(p => 
          p.stock > 0 && p.stock <= (p.lowStockAlert || 10)
        ).length,
        outOfStockProducts: products.filter(p => p.stock === 0).length,
        localProducts: products.filter(p => p.isLocal).length,
        categories: products.reduce((acc, product) => {
          const category = product.category || 'Uncategorized';
          acc[category] = (acc[category] || 0) + 1;
          return acc;
        }, {}),
        lastUpdated: new Date().toISOString()
      };
      
      localStorage.setItem(LOCAL_STORAGE_KEYS.PRODUCT_STATS, JSON.stringify(stats));
      return stats;
    } catch (error) {
      console.error('❌ Error updating product stats:', error);
      return null;
    }
  }

  static getProductStats() {
    try {
      const stats = localStorage.getItem(LOCAL_STORAGE_KEYS.PRODUCT_STATS);
      return stats ? JSON.parse(stats) : this.updateProductStats();
    } catch (error) {
      console.error('❌ Error getting product stats:', error);
      return null;
    }
  }

  static getSalesStats(period = 'all') {
    try {
      const sales = this.getSales();
      const now = new Date();
      let filteredSales = sales;
      
      if (period !== 'all') {
        const cutoff = new Date();
        switch (period) {
          case 'today':
            cutoff.setHours(0, 0, 0, 0);
            break;
          case 'week':
            cutoff.setDate(cutoff.getDate() - 7);
            break;
          case 'month':
            cutoff.setMonth(cutoff.getMonth() - 1);
            break;
          case 'year':
            cutoff.setFullYear(cutoff.getFullYear() - 1);
            break;
        }
        
        filteredSales = sales.filter(sale => new Date(sale.createdAt) >= cutoff);
      }
      
      const stats = {
        totalSales: filteredSales.length,
        totalRevenue: filteredSales.reduce((sum, sale) => sum + (sale.totalAmount || 0), 0),
        totalProfit: filteredSales.reduce((sum, sale) => sum + (sale.totalProfit || 0), 0),
        totalItemsSold: filteredSales.reduce((sum, sale) => 
          sum + sale.items.reduce((itemSum, item) => itemSum + (item.quantity || 0), 0), 0),
        offlineSales: filteredSales.filter(s => s.isLocal).length,
        averageSale: filteredSales.length > 0 
          ? filteredSales.reduce((sum, sale) => sum + (sale.totalAmount || 0), 0) / filteredSales.length 
          : 0,
        period: period,
        lastUpdated: new Date().toISOString()
      };
      
      return stats;
    } catch (error) {
      console.error('❌ Error getting sales stats:', error);
      return null;
    }
  }

  // ============ DATA INTEGRITY CHECKS ============
  static checkDataIntegrity() {
    try {
      const products = this.getProducts();
      const sales = this.getSales();
      
      const issues = [];
      
      // Check for products with negative stock
      const negativeStockProducts = products.filter(p => p.stock < 0);
      if (negativeStockProducts.length > 0) {
        issues.push(`${negativeStockProducts.length} products have negative stock`);
      }
      
      // Check for sales referencing non-existent products
      const missingProductSales = sales.filter(sale => 
        sale.items.some(item => !products.find(p => p._id === item.product))
      );
      if (missingProductSales.length > 0) {
        issues.push(`${missingProductSales.length} sales reference missing products`);
      }
      
      // Check for duplicate sale numbers
      const saleNumbers = sales.map(s => s.saleNumber);
      const duplicates = saleNumbers.filter((num, index) => saleNumbers.indexOf(num) !== index);
      if (duplicates.length > 0) {
        issues.push(`${duplicates.length} duplicate sale numbers found`);
      }
      
      return {
        valid: issues.length === 0,
        issues: issues,
        summary: {
          products: products.length,
          sales: sales.length,
          localProducts: products.filter(p => p.isLocal).length,
          localSales: sales.filter(s => s.isLocal).length,
          pendingSync: this.getSyncQueue().length
        }
      };
    } catch (error) {
      console.error('❌ Error checking data integrity:', error);
      return { valid: false, issues: ['Data integrity check failed'], error: error.message };
    }
  }

  // ============ BACKUP & RESTORE ============
  static createBackup() {
    try {
      const backup = {
        version: '2.0',
        timestamp: new Date().toISOString(),
        data: {
          products: this.getProducts(),
          sales: this.getSales(),
          syncQueue: this.getSyncQueue(),
          stats: this.getProductStats(),
          salesStats: this.getSalesStats('all')
        },
        info: this.checkDataIntegrity()
      };
      
      return {
        success: true,
        backup: JSON.stringify(backup, null, 2),
        filename: `electroshop_backup_${new Date().toISOString().split('T')[0]}.json`
      };
    } catch (error) {
      console.error('❌ Error creating backup:', error);
      return { success: false, error: error.message };
    }
  }

  static restoreFromBackup(backupData) {
    try {
      const backup = JSON.parse(backupData);
      
      if (!backup.version || !backup.data) {
        throw new Error('Invalid backup format');
      }
      
      // Clear existing data
      this.clearAllData();
      
      // Restore data
      if (backup.data.products) {
        this.saveProducts(backup.data.products);
      }
      
      if (backup.data.sales) {
        this.saveSales(backup.data.sales);
      }
      
      if (backup.data.syncQueue) {
        localStorage.setItem(LOCAL_STORAGE_KEYS.SYNC_QUEUE, JSON.stringify(backup.data.syncQueue));
      }
      
      if (backup.data.stats) {
        localStorage.setItem(LOCAL_STORAGE_KEYS.PRODUCT_STATS, JSON.stringify(backup.data.stats));
      }
      
      console.log('✅ Backup restored successfully');
      return { 
        success: true, 
        message: 'Backup restored successfully',
        restoredItems: {
          products: backup.data.products?.length || 0,
          sales: backup.data.sales?.length || 0
        }
      };
    } catch (error) {
      console.error('❌ Error restoring from backup:', error);
      return { success: false, error: error.message };
    }
  }

  // ============ UTILITY METHODS ============
  static clearAllData() {
    try {
      Object.values(LOCAL_STORAGE_KEYS).forEach(key => {
        localStorage.removeItem(key);
      });
      console.log('🧹 All local storage data cleared');
      return true;
    } catch (error) {
      console.error('❌ Error clearing local storage:', error);
      return false;
    }
  }

  static getStorageInfo() {
    try {
      const info = {
        localStorage: {
          totalKeys: Object.keys(localStorage).length,
          totalSize: new Blob(Object.values(localStorage)).size,
          limit: 5 * 1024 * 1024, // 5MB typical limit
          usagePercent: 0
        },
        appData: {}
      };
      
      // Calculate app data sizes
      Object.values(LOCAL_STORAGE_KEYS).forEach(key => {
        const data = localStorage.getItem(key);
        if (data) {
          info.appData[key] = {
            size: new Blob([data]).size,
            items: data ? JSON.parse(data).length : 0,
            type: Array.isArray(JSON.parse(data)) ? 'array' : 'object'
          };
        }
      });
      
      // Calculate usage percentage
      info.localStorage.usagePercent = (info.localStorage.totalSize / info.localStorage.limit) * 100;
      
      return info;
    } catch (error) {
      console.error('❌ Error getting storage info:', error);
      return null;
    }
  }

  // ============ AUTO-SYNC MANAGEMENT ============
  static enableAutoSync(intervalMinutes = 5) {
    try {
      localStorage.setItem('auto_sync_enabled', 'true');
      localStorage.setItem('auto_sync_interval', intervalMinutes.toString());
      console.log(`✅ Auto-sync enabled (every ${intervalMinutes} minutes)`);
      return true;
    } catch (error) {
      console.error('❌ Error enabling auto-sync:', error);
      return false;
    }
  }

  static disableAutoSync() {
    try {
      localStorage.removeItem('auto_sync_enabled');
      localStorage.removeItem('auto_sync_interval');
      console.log('✅ Auto-sync disabled');
      return true;
    } catch (error) {
      console.error('❌ Error disabling auto-sync:', error);
      return false;
    }
  }

  static isAutoSyncEnabled() {
    return localStorage.getItem('auto_sync_enabled') === 'true';
  }

  static getAutoSyncInterval() {
    const interval = localStorage.getItem('auto_sync_interval');
    return interval ? parseInt(interval) : 5;
  }
}

// Initialize on import
LocalStorageService.initialize();

export default LocalStorageService;