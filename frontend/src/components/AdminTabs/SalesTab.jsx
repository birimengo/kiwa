import React, { useState, useEffect, useCallback, useRef } from 'react';
import { 
  Search, Filter, Calendar, Eye, X, Receipt, 
  User, DollarSign, Package, TrendingUp, RefreshCw, AlertCircle,
  Printer, CreditCard, Smartphone, Building, Trash2, RotateCcw, 
  Cloud, CloudOff, CheckCircle, Upload, Download, Clock, Shield,
  BarChart3, History, Database, Wifi, WifiOff, ChevronDown, ChevronUp,
  Info, ExternalLink, Lock, Unlock, AlertTriangle
} from 'lucide-react';
import { salesAPI, productsAPI } from '../../services/api';
import LocalStorageService from '../../services/localStorageService';

const SalesTab = ({ user, onSalesUpdate, isOnline = true }) => {
  // Existing states
  const [sales, setSales] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [selectedSale, setSelectedSale] = useState(null);
  const [showSaleDetails, setShowSaleDetails] = useState(false);
  const [filters, setFilters] = useState({
    search: '',
    startDate: '',
    endDate: '',
    status: '',
    paymentStatus: '',
    saleType: 'all' // 'all', 'online', 'offline'
  });
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 12,
    total: 0,
    totalPages: 1
  });

  // NEW: Offline Sales Management States
  const [syncingSaleId, setSyncingSaleId] = useState(null);
  const [bulkSyncing, setBulkSyncing] = useState(false);
  const [syncStats, setSyncStats] = useState({
    totalOffline: 0,
    pendingSync: 0,
    failedSyncs: 0,
    lastSync: null
  });
  const [offlineActionMenu, setOfflineActionMenu] = useState(null);
  const [exportingData, setExportingData] = useState(false);
  const [showSyncProgress, setShowSyncProgress] = useState(false);
  const [syncProgress, setSyncProgress] = useState({
    current: 0,
    total: 0,
    message: '',
    errors: []
  });
  const [showOfflineStats, setShowOfflineStats] = useState(false);

  // Use refs to prevent infinite loops
  const hasFetchedRef = useRef(false);
  const isMountedRef = useRef(false);
  const prevFiltersRef = useRef(JSON.stringify(filters));

  // Helper: Apply filters to local data
  const applyFiltersToLocal = useCallback((localSales) => {
    let filtered = localSales;
    
    if (filters.saleType === 'online') {
      filtered = filtered.filter(sale => !sale.isLocal || sale.synced);
    } else if (filters.saleType === 'offline') {
      filtered = filtered.filter(sale => sale.isLocal && !sale.synced);
    }
    
    if (filters.search) {
      const searchTerm = filters.search.toLowerCase();
      filtered = filtered.filter(sale =>
        sale.customer?.name?.toLowerCase().includes(searchTerm) ||
        sale.saleNumber?.toLowerCase().includes(searchTerm) ||
        sale.customer?.phone?.includes(searchTerm)
      );
    }
    
    if (filters.status && filters.status !== 'all' && filters.status !== 'offline') {
      filtered = filtered.filter(sale => sale.status === filters.status);
    }
    
    if (filters.paymentStatus) {
      filtered = filtered.filter(sale => sale.paymentStatus === filters.paymentStatus);
    }
    
    if (filters.startDate) {
      filtered = filtered.filter(sale => 
        new Date(sale.createdAt) >= new Date(filters.startDate)
      );
    }
    
    if (filters.endDate) {
      filtered = filtered.filter(sale => 
        new Date(sale.createdAt) <= new Date(filters.endDate + 'T23:59:59')
      );
    }
    
    return filtered;
  }, [filters]);

  // Helper: Update sync statistics
  const updateSyncStats = useCallback(() => {
    try {
      const localSales = LocalStorageService.getSales();
      const offlineSales = localSales.filter(s => s.isLocal && !s.synced);
      const failedSyncs = localSales.filter(s => s.lastSyncError);
      
      setSyncStats({
        totalOffline: offlineSales.length,
        pendingSync: offlineSales.filter(s => !s.lastSyncError).length,
        failedSyncs: failedSyncs.length,
        lastSync: localStorage.getItem('electroshop_last_sync')
      });
    } catch (error) {
      console.error('Error updating sync stats:', error);
    }
  }, []);

  // Enhanced fetchSales function - FETCH ALL SALES
  const fetchSales = useCallback(async (page = 1, forceRefresh = false) => {
    // Prevent multiple simultaneous fetches
    if (loading && !forceRefresh) return;
    // Prevent refetching on every render
    if (hasFetchedRef.current && !forceRefresh) return;
    
    hasFetchedRef.current = true;
    setLoading(true);
    setError('');
    
    try {
      console.log(`📊 Fetching sales, page ${page}, online: ${isOnline}`);
      
      // Always load local sales first
      const localSales = LocalStorageService.getSales();
      console.log(`📦 Loaded ${localSales.length} sales from local storage`);
      
      let allSales = [];
      let totalCount = 0;
      let fetchedFromBackend = false;
      
      // 1. Fetch from backend if online - FETCH ALL SALES WITHOUT PAGINATION FROM BACKEND
      if (isOnline) {
        try {
          const params = {};
          
          // Add filters to params for backend
          if (filters.search) params.customer = filters.search;
          if (filters.startDate) params.startDate = filters.startDate;
          if (filters.endDate) params.endDate = filters.endDate;
          if (filters.status && filters.status !== 'all' && filters.status !== 'offline') {
            params.status = filters.status;
          }
          if (filters.paymentStatus) {
            params.paymentStatus = filters.paymentStatus;
          }

          // Set limit to a large number to fetch all sales
          params.limit = 1000; // Adjust this based on your needs
          params.page = 1; // Always fetch first page for all results
          
          console.log('🌐 Fetching ALL sales from backend...', params);
          const response = await salesAPI.getSales(params);
          
          if (response.data && response.data.sales) {
            const backendSales = response.data.sales;
            totalCount = response.data.total || backendSales.length;
            
            // Mark as synced sales
            const syncedSales = backendSales.map(sale => ({
              ...sale,
              isLocal: false,
              synced: true,
              source: 'backend'
            }));
            
            allSales = syncedSales;
            fetchedFromBackend = true;
            console.log(`✅ Loaded ${backendSales.length} sales from backend, total in DB: ${totalCount}`);
          }
        } catch (apiError) {
          console.warn('⚠️ Backend fetch failed, using local data:', apiError.message);
          // Continue with local data
        }
      }
      
      // 2. If we didn't fetch from backend or want to combine with local
      if (!fetchedFromBackend || filters.saleType === 'all') {
        // Filter local sales to remove duplicates with backend data
        const localOnlySales = localSales.filter(localSale => {
          // Skip if sale is already in backend data
          if (!localSale.isLocal) {
            const inBackend = allSales.find(s => s._id === localSale._id);
            return !inBackend;
          }
          // Always include local-only sales
          return true;
        });
        
        // Combine sales
        allSales = [...allSales, ...localOnlySales];
        console.log(`🔄 Combined sales: ${allSales.length} total (${allSales.length - localOnlySales.length} from backend, ${localOnlySales.length} local)`);
      }
      
      // 3. Apply filters to combined data
      let filteredSales = applyFiltersToLocal(allSales);
      totalCount = filteredSales.length;
      
      // 4. Sort: Offline sales first, then by date (newest first)
      filteredSales.sort((a, b) => {
        // Offline unsynced sales first
        if (a.isLocal && !a.synced && !(b.isLocal && !b.synced)) return -1;
        if (!(a.isLocal && !a.synced) && b.isLocal && !b.synced) return 1;
        
        // Then by date (newest first)
        return new Date(b.createdAt) - new Date(a.createdAt);
      });
      
      // 5. Apply client-side pagination
      const startIndex = (page - 1) * pagination.limit;
      const endIndex = startIndex + pagination.limit;
      const paginatedSales = filteredSales.slice(startIndex, endIndex);
      
      // 6. Update state
      setSales(paginatedSales);
      setPagination(prev => ({
        ...prev,
        page,
        total: totalCount,
        totalPages: Math.ceil(totalCount / pagination.limit)
      }));
      
      // 7. Update sync stats
      updateSyncStats();
      
      console.log(`✅ Displaying ${paginatedSales.length} sales (${totalCount} total, page ${page}/${Math.ceil(totalCount / pagination.limit)})`);
      
    } catch (error) {
      console.error('❌ Error fetching sales:', error);
      setError('Failed to load sales data. Using local storage.');
      
      // Fallback to local data
      const localSales = LocalStorageService.getSales();
      const filtered = applyFiltersToLocal(localSales);
      const totalCount = filtered.length;
      
      // Apply pagination
      const startIndex = (pagination.page - 1) * pagination.limit;
      const endIndex = startIndex + pagination.limit;
      const paginated = filtered.slice(startIndex, endIndex);
      
      setSales(paginated);
      setPagination(prev => ({
        ...prev,
        page,
        total: totalCount,
        totalPages: Math.ceil(totalCount / pagination.limit)
      }));
      
      updateSyncStats();
    } finally {
      if (isMountedRef.current) {
        setLoading(false);
      }
    }
  }, [filters, pagination.limit, isOnline, loading, applyFiltersToLocal, updateSyncStats]);

  // Initial fetch and filter effect
  useEffect(() => {
    isMountedRef.current = true;
    
    // Fetch sales when component mounts or when filters change
    const shouldFetch = !hasFetchedRef.current || 
                       JSON.stringify(filters) !== JSON.stringify(prevFiltersRef.current);
    
    if (shouldFetch) {
      prevFiltersRef.current = JSON.stringify(filters);
      fetchSales(1);
    }
    
    return () => {
      isMountedRef.current = false;
    };
  }, [fetchSales]);

  // Debug effect
  useEffect(() => {
    console.log('🔍 Sales Tab Debug:', {
      totalSalesInState: sales.length,
      pagination,
      filters,
      isOnline,
      syncStats
    });
  }, [sales, pagination, filters, isOnline, syncStats]);

  // Sync single offline sale
  const syncSingleSale = async (saleId) => {
    if (!isOnline) {
      alert('🔌 Please connect to internet to sync sales');
      return;
    }

    setSyncingSaleId(saleId);
    
    try {
      const sale = sales.find(s => s._id === saleId);
      if (!sale) {
        throw new Error('Sale not found');
      }

      // Validate sale data
      if (!sale.items || sale.items.length === 0) {
        throw new Error('Sale has no items');
      }

      // Prepare sale data for backend
      const saleData = {
        customer: sale.customer,
        items: sale.items.map(item => ({
          productId: item.productId || item.product,
          quantity: item.quantity,
          unitPrice: item.unitPrice
        })),
        paymentMethod: sale.paymentMethod,
        amountPaid: sale.amountPaid,
        notes: sale.notes || `Synced from offline sale ${sale.saleNumber}`,
        soldBy: sale.soldBy || user?.id
      };

      console.log(`🔄 Syncing sale: ${sale.saleNumber}`);
      
      const response = await salesAPI.createSale(saleData);
      
      if (response.data && response.data.success) {
        // Update local sale with backend data
        const updatedSale = {
          ...sale,
          _id: response.data.sale._id,
          saleNumber: response.data.sale.saleNumber,
          isLocal: false,
          synced: true,
          syncedAt: new Date().toISOString(),
          syncAttempts: (sale.syncAttempts || 0) + 1
        };
        
        // Update in localStorage
        const allSales = LocalStorageService.getSales();
        const saleIndex = allSales.findIndex(s => s._id === saleId);
        if (saleIndex !== -1) {
          allSales[saleIndex] = updatedSale;
          LocalStorageService.saveSales(allSales);
        }
        
        // Remove from sync queue
        LocalStorageService.removeFromSyncQueue(saleId);
        
        // Show success
        alert(`✅ Sale synced successfully!\nNew Sale Number: ${response.data.sale.saleNumber}`);
        
        // Refresh data
        hasFetchedRef.current = false;
        await fetchSales(pagination.page, true);
        if (onSalesUpdate) onSalesUpdate();
        
      } else {
        throw new Error(response.data.message || 'Sync failed');
      }
      
    } catch (error) {
      console.error('❌ Sync error:', error);
      
      // Update sale with error
      const allSales = LocalStorageService.getSales();
      const saleIndex = allSales.findIndex(s => s._id === saleId);
      if (saleIndex !== -1) {
        allSales[saleIndex] = {
          ...allSales[saleIndex],
          lastSyncError: error.response?.data?.message || error.message,
          lastSyncAttempt: new Date().toISOString(),
          syncAttempts: (allSales[saleIndex].syncAttempts || 0) + 1
        };
        LocalStorageService.saveSales(allSales);
      }
      
      alert(`❌ Sync failed: ${error.response?.data?.message || error.message}`);
    } finally {
      setSyncingSaleId(null);
    }
  };

  // Bulk sync all offline sales
  const bulkSyncOfflineSales = async () => {
    if (!isOnline) {
      alert('🔌 Please connect to internet to sync sales');
      return;
    }

    const offlineSales = LocalStorageService.getSales()
      .filter(s => s.isLocal && !s.synced);
    
    if (offlineSales.length === 0) {
      alert('✅ No offline sales to sync');
      return;
    }

    if (!window.confirm(`Sync ${offlineSales.length} offline sales?`)) {
      return;
    }

    setBulkSyncing(true);
    setShowSyncProgress(true);
    setSyncProgress({
      current: 0,
      total: offlineSales.length,
      message: 'Starting bulk sync...',
      errors: []
    });

    const errors = [];
    let successful = 0;

    try {
      for (let i = 0; i < offlineSales.length; i++) {
        const sale = offlineSales[i];
        
        setSyncProgress(prev => ({
          ...prev,
          current: i + 1,
          message: `Syncing ${sale.saleNumber}...`
        }));

        try {
          const saleData = {
            customer: sale.customer,
            items: sale.items.map(item => ({
              productId: item.productId || item.product,
              quantity: item.quantity,
              unitPrice: item.unitPrice
            })),
            paymentMethod: sale.paymentMethod,
            amountPaid: sale.amountPaid,
            notes: sale.notes || 'Bulk sync from offline',
            soldBy: sale.soldBy || user?.id
          };

          const response = await salesAPI.createSale(saleData);
          
          if (response.data && response.data.success) {
            // Update local sale
            const allSales = LocalStorageService.getSales();
            const saleIndex = allSales.findIndex(s => s._id === sale._id);
            if (saleIndex !== -1) {
              allSales[saleIndex] = {
                ...allSales[saleIndex],
                _id: response.data.sale._id,
                saleNumber: response.data.sale.saleNumber,
                isLocal: false,
                synced: true,
                syncedAt: new Date().toISOString()
              };
              LocalStorageService.saveSales(allSales);
            }
            
            successful++;
            console.log(`✅ Synced: ${sale.saleNumber} → ${response.data.sale.saleNumber}`);
          }
        } catch (error) {
          errors.push({
            saleNumber: sale.saleNumber,
            error: error.response?.data?.message || error.message
          });
          console.error(`❌ Failed: ${sale.saleNumber}`, error);
        }

        // Small delay to prevent overwhelming server
        await new Promise(resolve => setTimeout(resolve, 500));
      }

      // Update last sync time
      localStorage.setItem('electroshop_last_sync', new Date().toISOString());

      // Show results
      setSyncProgress(prev => ({
        ...prev,
        message: `Completed: ${successful} synced, ${errors.length} failed`
      }));

      // Refresh data after a delay
      setTimeout(async () => {
        setShowSyncProgress(false);
        if (errors.length === 0) {
          alert(`✅ All ${successful} sales synced successfully!`);
        } else {
          alert(`⚠️ Sync completed with ${errors.length} errors:\n\n` +
            errors.slice(0, 3).map(e => `• ${e.saleNumber}: ${e.error}`).join('\n') +
            (errors.length > 3 ? `\n... and ${errors.length - 3} more` : ''));
        }
        
        // Refresh data
        hasFetchedRef.current = false;
        await fetchSales(pagination.page, true);
        if (onSalesUpdate) onSalesUpdate();
      }, 2000);

    } catch (error) {
      console.error('❌ Bulk sync error:', error);
      setSyncProgress(prev => ({
        ...prev,
        message: `Error: ${error.message}`
      }));
    } finally {
      setTimeout(() => {
        setBulkSyncing(false);
        setShowSyncProgress(false);
      }, 3000);
    }
  };

  // Export offline data
  const exportOfflineData = async () => {
    setExportingData(true);
    
    try {
      const backup = LocalStorageService.createBackup();
      
      if (backup.success) {
        // Download file
        const blob = new Blob([backup.backup], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = backup.filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        
        alert('✅ Data exported successfully!');
      } else {
        throw new Error(backup.error);
      }
    } catch (error) {
      console.error('❌ Export error:', error);
      alert(`❌ Export failed: ${error.message}`);
    } finally {
      setExportingData(false);
    }
  };

  // Clear failed syncs
  const clearFailedSyncs = () => {
    if (!window.confirm('Clear all failed sync attempts?')) return;
    
    const allSales = LocalStorageService.getSales();
    const cleanedSales = allSales.map(sale => ({
      ...sale,
      lastSyncError: undefined,
      syncAttempts: 0
    }));
    
    LocalStorageService.saveSales(cleanedSales);
    hasFetchedRef.current = false;
    fetchSales(pagination.page, true);
    alert('✅ Failed syncs cleared!');
  };

  // Handle filter changes
  const handleFilterChange = (key, value) => {
    setFilters(prev => ({ ...prev, [key]: value }));
    // Reset to first page when filter changes
    setPagination(prev => ({ ...prev, page: 1 }));
  };

  // Apply filters
  const applyFilters = () => {
    hasFetchedRef.current = false;
    fetchSales(1);
  };

  // Clear filters
  const clearFilters = () => {
    setFilters({
      search: '',
      startDate: '',
      endDate: '',
      status: '',
      paymentStatus: '',
      saleType: 'all'
    });
  };

  // View sale details
  const handleViewSale = async (sale) => {
    try {
      if (isOnline && !sale.isLocal) {
        const response = await salesAPI.getSale(sale._id);
        setSelectedSale(response.data.sale);
      } else {
        // Use local sale data
        setSelectedSale(sale);
      }
      setShowSaleDetails(true);
    } catch (error) {
      console.error('Error fetching sale details:', error);
      // Use local data as fallback
      setSelectedSale(sale);
      setShowSaleDetails(true);
      setError('Using local sale data.');
    }
  };

  // Cancel sale
  const handleCancelSale = async (saleId) => {
    if (!window.confirm('Are you sure you want to cancel this sale? This action will restore product stock and cannot be undone.')) {
      return;
    }

    try {
      const sale = sales.find(s => s._id === saleId);
      
      if (isOnline && sale && !sale.isLocal) {
        await salesAPI.cancelSale(saleId);
      }
      
      // Update locally
      const localSales = LocalStorageService.getSales();
      const saleIndex = localSales.findIndex(s => s._id === saleId);
      
      if (saleIndex !== -1) {
        // Restore product stock locally
        const saleToCancel = localSales[saleIndex];
        
        // Update product stock
        saleToCancel.items.forEach(item => {
          LocalStorageService.restockProduct(
            item.productId || item.product,
            item.quantity,
            `Sale cancellation - stock restored`
          );
        });
        
        // Update sale status
        localSales[saleIndex] = {
          ...localSales[saleIndex],
          status: 'cancelled',
          updatedAt: new Date().toISOString()
        };
        
        LocalStorageService.saveSales(localSales);
      }
      
      alert('Sale cancelled successfully!');
      hasFetchedRef.current = false;
      fetchSales(pagination.page); // Refresh current page
      if (onSalesUpdate) {
        onSalesUpdate(); // Refresh stats
      }
    } catch (error) {
      console.error('Error cancelling sale:', error);
      alert(error.response?.data?.message || 'Failed to cancel sale');
    }
  };

  // Delete sale permanently
  const handleDeleteSale = async (saleId) => {
    if (!window.confirm('Are you sure you want to permanently delete this sale? This action cannot be undone and all sale data will be lost.')) {
      return;
    }

    try {
      if (isOnline) {
        await salesAPI.deleteSale(saleId);
      }
      
      // Delete locally
      const localSales = LocalStorageService.getSales();
      const filteredSales = localSales.filter(s => s._id !== saleId);
      LocalStorageService.saveSales(filteredSales);
      
      alert('Sale deleted successfully!');
      hasFetchedRef.current = false;
      fetchSales(pagination.page); // Refresh current page
      if (onSalesUpdate) {
        onSalesUpdate(); // Refresh stats
      }
    } catch (error) {
      console.error('Error deleting sale:', error);
      alert(error.response?.data?.message || 'Failed to delete sale');
    }
  };

  // Resume sale (change status from cancelled to completed)
  const handleResumeSale = async (saleId) => {
    if (!window.confirm('Are you sure you want to resume this sale? This will change the status back to completed and deduct product stock again.')) {
      return;
    }

    try {
      const sale = sales.find(s => s._id === saleId);
      
      if (isOnline && sale && !sale.isLocal) {
        await salesAPI.resumeSale(saleId);
      }
      
      // Update locally
      const localSales = LocalStorageService.getSales();
      const saleIndex = localSales.findIndex(s => s._id === saleId);
      
      if (saleIndex !== -1) {
        // Deduct product stock again
        const saleToResume = localSales[saleIndex];
        
        saleToResume.items.forEach(item => {
          // Find product and update stock
          const products = LocalStorageService.getProducts();
          const productIndex = products.findIndex(p => p._id === (item.productId || item.product));
          
          if (productIndex !== -1) {
            const previousStock = products[productIndex].stock;
            const newStock = previousStock - item.quantity;
            
            if (newStock >= 0) {
              products[productIndex] = {
                ...products[productIndex],
                stock: newStock,
                totalSold: (products[productIndex].totalSold || 0) + item.quantity,
                stockHistory: [
                  ...(products[productIndex].stockHistory || []),
                  {
                    previousStock,
                    newStock,
                    unitsChanged: -item.quantity,
                    type: 'sale',
                    reference: saleId,
                    referenceModel: 'Sale',
                    date: new Date().toISOString(),
                    notes: `Sale resumed - deducted ${item.quantity} units`
                  }
                ]
              };
            }
          }
        });
        
        LocalStorageService.saveProducts(products);
        
        // Update sale status
        localSales[saleIndex] = {
          ...localSales[saleIndex],
          status: 'completed',
          updatedAt: new Date().toISOString()
        };
        
        LocalStorageService.saveSales(localSales);
      }
      
      alert('Sale resumed successfully!');
      hasFetchedRef.current = false;
      fetchSales(pagination.page); // Refresh current page
      if (onSalesUpdate) {
        onSalesUpdate(); // Refresh stats
      }
    } catch (error) {
      console.error('Error resuming sale:', error);
      alert(error.response?.data?.message || 'Failed to resume sale');
    }
  };

  // Update payment
  const handleUpdatePayment = async (saleId, amountPaid) => {
    const newAmount = parseFloat(prompt('Enter amount paid:', amountPaid.toString()));
    
    if (isNaN(newAmount) || newAmount < 0) {
      alert('Please enter a valid amount');
      return;
    }

    try {
      const sale = sales.find(s => s._id === saleId);
      
      if (isOnline && sale && !sale.isLocal) {
        await salesAPI.updatePayment(saleId, { amountPaid: newAmount });
      }
      
      // Update locally
      const localSales = LocalStorageService.getSales();
      const saleIndex = localSales.findIndex(s => s._id === saleId);
      
      if (saleIndex !== -1) {
        const saleToUpdate = localSales[saleIndex];
        const totalAmount = saleToUpdate.totalAmount;
        const balance = totalAmount - newAmount;
        const paymentStatus = newAmount >= totalAmount ? 'paid' : newAmount > 0 ? 'partially_paid' : 'pending';
        
        localSales[saleIndex] = {
          ...saleToUpdate,
          amountPaid: newAmount,
          balance,
          paymentStatus,
          updatedAt: new Date().toISOString()
        };
        
        LocalStorageService.saveSales(localSales);
      }
      
      alert('Payment updated successfully!');
      hasFetchedRef.current = false;
      fetchSales(pagination.page); // Refresh current page
    } catch (error) {
      console.error('Error updating payment:', error);
      alert(error.response?.data?.message || 'Failed to update payment');
    }
  };

  // Print receipt
  const handlePrintReceipt = (sale) => {
    const formatReceiptCurrency = (amount) => {
      return `UGX ${amount?.toLocaleString() || '0'}`;
    };

    const formatReceiptDate = (dateString) => {
      return new Date(dateString).toLocaleDateString();
    };

    const formatReceiptTime = (dateString) => {
      return new Date(dateString).toLocaleTimeString();
    };

    // Create receipt HTML content
    const receiptContent = `
      <div style="font-family: 'Courier New', monospace; max-width: 300px; margin: 0 auto; padding: 15px; font-size: 12px;">
        <!-- Header -->
        <div style="text-align: center; border-bottom: 1px dashed #000; padding-bottom: 10px; margin-bottom: 15px;">
          <div style="font-size: 18px; font-weight: bold; margin-bottom: 5px;">ELECTRONIC STORE</div>
          <div style="font-size: 11px;">123 Tech Street, Kampala</div>
          <div style="font-size: 11px;">Tel: +256 712 345 678</div>
          <div style="font-size: 11px;">Email: info@electronicstore.com</div>
        </div>

        <!-- Sale Information -->
        <div style="margin-bottom: 10px;">
          <div><strong>Receipt No:</strong> ${sale.saleNumber}</div>
          <div><strong>Date:</strong> ${formatReceiptDate(sale.createdAt)}</div>
          <div><strong>Time:</strong> ${formatReceiptTime(sale.createdAt)}</div>
          <div><strong>Cashier:</strong> ${sale.soldBy?.name || 'System'}</div>
          ${sale.isLocal && !sale.synced ? '<div style="background: #fff3cd; padding: 5px; margin: 5px 0; text-align: center; border: 1px solid #ffc107;"><strong>⚠️ LOCAL COPY - WILL SYNC WHEN ONLINE</strong></div>' : ''}
        </div>

        <!-- Customer Information -->
        <div style="border: 1px dashed #000; padding: 8px; margin-bottom: 15px;">
          <div><strong>Customer:</strong> ${sale.customer?.name || 'Walk-in Customer'}</div>
          ${sale.customer?.phone ? `<div><strong>Phone:</strong> ${sale.customer.phone}</div>` : ''}
          ${sale.customer?.email ? `<div><strong>Email:</strong> ${sale.customer.email}</div>` : ''}
        </div>

        <!-- Items Table -->
        <table style="width: 100%; border-collapse: collapse; margin-bottom: 15px;">
          <thead>
            <tr>
              <th style="text-align: left; border-bottom: 1px dashed #000; padding: 5px 0;">Item</th>
              <th style="text-align: left; border-bottom: 1px dashed #000; padding: 5px 0;">Qty</th>
              <th style="text-align: left; border-bottom: 1px dashed #000; padding: 5px 0;">Price</th>
              <th style="text-align: left; border-bottom: 1px dashed #000; padding: 5px 0;">Total</th>
            </tr>
          </thead>
          <tbody>
            ${sale.items.map(item => `
              <tr>
                <td style="padding: 4px 0;">
                  <div style="font-weight: bold;">${item.productName || item.name}</div>
                  <div style="font-size: 10px;">${item.productBrand || ''}</div>
                </td>
                <td style="padding: 4px 0;">${item.quantity}</td>
                <td style="padding: 4px 0;">${formatReceiptCurrency(item.unitPrice)}</td>
                <td style="padding: 4px 0;">${formatReceiptCurrency(item.totalPrice)}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>

        <!-- Summary -->
        <div style="margin-bottom: 10px; font-size: 11px;">
          <div>Total Items: ${sale.items.length}</div>
          <div>Total Units: ${sale.items.reduce((sum, item) => sum + (item.quantity || 0), 0)}</div>
        </div>

        <div style="border-top: 1px dashed #000; margin: 10px 0;"></div>

        <!-- Totals -->
        <div style="border-top: 1px dashed #000; padding-top: 10px;">
          <div style="display: flex; justify-content: space-between; margin-bottom: 3px;">
            <span>Subtotal:</span>
            <span>${formatReceiptCurrency(sale.subtotal)}</span>
          </div>
          ${sale.discountAmount > 0 ? `
            <div style="display: flex; justify-content: space-between; margin-bottom: 3px;">
              <span>Discount:</span>
              <span>-${formatReceiptCurrency(sale.discountAmount)}</span>
            </div>
          ` : ''}
          ${sale.taxAmount > 0 ? `
            <div style="display: flex; justify-content: space-between; margin-bottom: 3px;">
              <span>Tax:</span>
              <span>${formatReceiptCurrency(sale.taxAmount)}</span>
            </div>
          ` : ''}
          <div style="display: flex; justify-content: space-between; font-weight: bold; border-top: 1px dashed #000; padding-top: 5px; margin-top: 5px;">
            <span>TOTAL AMOUNT:</span>
            <span>${formatReceiptCurrency(sale.totalAmount)}</span>
          </div>
          <div style="display: flex; justify-content: space-between; margin-bottom: 3px;">
            <span>Payment Method:</span>
            <span style="text-transform: uppercase;">${sale.paymentMethod}</span>
          </div>
          <div style="display: flex; justify-content: space-between; margin-bottom: 3px;">
            <span>Amount Paid:</span>
            <span>${formatReceiptCurrency(sale.amountPaid || 0)}</span>
          </div>
          <div style="display: flex; justify-content: space-between; font-weight: bold;">
            <span>Balance:</span>
            <span style="color: ${(sale.balance || 0) === 0 ? '#000000' : '#ff0000'}">
              ${formatReceiptCurrency(sale.balance || 0)}
            </span>
          </div>
          <div style="display: flex; justify-content: space-between; margin-top: 3px;">
            <span>Payment Status:</span>
            <span style="font-weight: bold; color: ${
              sale.paymentStatus === 'paid' ? '#008000' : 
              sale.paymentStatus === 'partially_paid' ? '#ffa500' : '#ff0000'
            }">
              ${(sale.paymentStatus || 'pending').toUpperCase()}
            </span>
          </div>
        </div>

        <!-- Footer -->
        <div style="text-align: center; margin-top: 20px; padding-top: 10px; border-top: 1px dashed #000; font-size: 10px;">
          <div style="font-weight: bold; margin: 8px 0;">THANK YOU FOR YOUR BUSINESS!</div>
          <div>Items sold are not returnable</div>
          <div>Warranty according to manufacturer policy</div>
          <div>*** www.electronicstore.com ***</div>
          <div style="margin-top: 8px; font-style: italic;">
            Printed on: ${new Date().toLocaleDateString()} ${new Date().toLocaleTimeString()}
          </div>
        </div>
      </div>
    `;

    // Create print window
    const printWindow = window.open('', '_blank', 'width=400,height=700');
    
    if (printWindow) {
      printWindow.document.write(`
        <!DOCTYPE html>
        <html>
          <head>
            <title>Receipt - ${sale.saleNumber}</title>
            <style>
              @media print {
                body { 
                  margin: 0; 
                  padding: 10px; 
                  background: white;
                }
                @page {
                  margin: 0;
                  size: auto;
                }
              }
            </style>
          </head>
          <body>
            ${receiptContent}
            <script>
              window.onload = function() {
                setTimeout(() => {
                  window.print();
                }, 500);
              };
            </script>
          </body>
        </html>
      `);
      printWindow.document.close();
    } else {
      alert('Please allow popups to print receipts');
    }
  };

  // Format currency for display
  const formatCurrency = (amount) => {
    return `UGX ${amount?.toLocaleString() || '0'}`;
  };

  // Format date for display
  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString();
  };

  // Format time for display
  const formatTime = (dateString) => {
    return new Date(dateString).toLocaleTimeString();
  };

  // Get status badge color
  const getStatusColor = (status) => {
    switch (status) {
      case 'completed': return 'bg-green-100 text-green-800';
      case 'cancelled': return 'bg-red-100 text-red-800';
      case 'refunded': return 'bg-yellow-100 text-yellow-800';
      case 'pending': return 'bg-blue-100 text-blue-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  // Get payment status badge color
  const getPaymentStatusColor = (status) => {
    switch (status) {
      case 'paid': return 'bg-green-100 text-green-800';
      case 'partially_paid': return 'bg-yellow-100 text-yellow-800';
      case 'pending': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  // Get payment method icon
  const getPaymentMethodIcon = (method) => {
    switch (method) {
      case 'cash': return <DollarSign className="h-4 w-4" />;
      case 'card': return <CreditCard className="h-4 w-4" />;
      case 'mobile_money': return <Smartphone className="h-4 w-4" />;
      case 'bank_transfer': return <Building className="h-4 w-4" />;
      default: return <DollarSign className="h-4 w-4" />;
    }
  };

  // Pagination handlers
  const handlePreviousPage = () => {
    if (pagination.page > 1) {
      hasFetchedRef.current = false;
      fetchSales(pagination.page - 1);
    }
  };

  const handleNextPage = () => {
    if (pagination.page < pagination.totalPages) {
      hasFetchedRef.current = false;
      fetchSales(pagination.page + 1);
    }
  };

  // Manual refresh
  const handleRefresh = () => {
    hasFetchedRef.current = false;
    fetchSales(1, true);
  };

  return (
    <div className="space-y-6">
      {/* Sync Status Banner */}
      <div className="mb-4 space-y-2">
        {/* Network Status */}
        {!isOnline ? (
          <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <WifiOff className="h-4 w-4 text-yellow-600" />
                <div>
                  <p className="text-sm font-semibold text-yellow-800">Offline Mode</p>
                  <p className="text-xs text-yellow-700">
                    Working with local data. {syncStats.totalOffline} offline sales pending sync.
                  </p>
                </div>
              </div>
              <div className="text-xs">
                <span className="bg-yellow-100 text-yellow-800 px-2 py-1 rounded">
                  {syncStats.totalOffline} pending
                </span>
              </div>
            </div>
          </div>
        ) : syncStats.totalOffline > 0 && (
          <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Database className="h-4 w-4 text-blue-600" />
                <div>
                  <p className="text-sm font-semibold text-blue-800">Offline Sales Ready to Sync</p>
                  <p className="text-xs text-blue-700">
                    {syncStats.pendingSync} sales waiting to sync to server
                    {syncStats.failedSyncs > 0 && `, ${syncStats.failedSyncs} failed attempts`}
                  </p>
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={bulkSyncOfflineSales}
                  disabled={bulkSyncing}
                  className="flex items-center gap-1 bg-green-600 hover:bg-green-700 text-white px-3 py-1 rounded text-sm disabled:opacity-50"
                >
                  {bulkSyncing ? (
                    <>
                      <RefreshCw className="h-3 w-3 animate-spin" />
                      Syncing...
                    </>
                  ) : (
                    <>
                      <Upload className="h-3 w-3" />
                      Sync All ({syncStats.totalOffline})
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Offline Stats Panel */}
        {showOfflineStats && (
          <div className="p-3 bg-gray-50 border border-gray-200 rounded-lg">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-semibold text-gray-800">Offline Sales Statistics</h3>
              <button
                onClick={() => setShowOfflineStats(false)}
                className="text-gray-500 hover:text-gray-700"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="text-center p-2 bg-white border rounded">
                <p className="text-xs text-gray-600">Total Offline</p>
                <p className="text-lg font-bold text-gray-800">{syncStats.totalOffline}</p>
              </div>
              <div className="text-center p-2 bg-white border rounded">
                <p className="text-xs text-gray-600">Pending Sync</p>
                <p className="text-lg font-bold text-blue-600">{syncStats.pendingSync}</p>
              </div>
              <div className="text-center p-2 bg-white border rounded">
                <p className="text-xs text-gray-600">Failed Syncs</p>
                <p className="text-lg font-bold text-red-600">{syncStats.failedSyncs}</p>
              </div>
              <div className="text-center p-2 bg-white border rounded">
                <p className="text-xs text-gray-600">Last Sync</p>
                <p className="text-sm font-medium text-gray-800">
                  {syncStats.lastSync ? new Date(syncStats.lastSync).toLocaleTimeString() : 'Never'}
                </p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Error Alert */}
      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertCircle className="h-4 w-4 text-red-600" />
            <p className="text-red-700 text-sm">{error}</p>
          </div>
          <button
            onClick={handleRefresh}
            disabled={loading}
            className="ml-4 bg-red-600 hover:bg-red-700 text-white px-3 py-1 rounded text-sm transition-colors flex items-center gap-1 disabled:opacity-50"
          >
            <RefreshCw className={`h-3 w-3 ${loading ? 'animate-spin' : ''}`} />
            Retry
          </button>
        </div>
      )}

      {/* Filters Section */}
      <div className="theme-surface rounded-lg p-4">
        <div className="flex flex-col lg:flex-row gap-4 items-start lg:items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-semibold theme-text">Sales History</h2>
            {!isOnline && (
              <span className="text-xs px-2 py-1 rounded bg-yellow-100 text-yellow-800">
                Local Data
              </span>
            )}
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleRefresh}
              disabled={loading}
              className="flex items-center gap-1 theme-border border theme-text-muted hover:theme-secondary px-3 py-2 rounded text-sm transition-colors disabled:opacity-50"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </button>
            <button
              onClick={() => setShowOfflineStats(!showOfflineStats)}
              className="flex items-center gap-1 theme-border border theme-text-muted hover:theme-secondary px-3 py-2 rounded text-sm transition-colors"
            >
              <Database className="h-4 w-4" />
              Offline Stats
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-3 mb-4">
          {/* Sale Type Filter */}
          <select
            value={filters.saleType}
            onChange={(e) => handleFilterChange('saleType', e.target.value)}
            className="w-full px-3 py-2 theme-border border rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 theme-surface theme-text text-sm"
          >
            <option value="all">All Sales</option>
            <option value="online">Online Only</option>
            <option value="offline">Offline Only</option>
          </select>

          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-3 h-4 w-4 theme-text-muted" />
            <input
              type="text"
              placeholder="Search customer/sale..."
              value={filters.search}
              onChange={(e) => handleFilterChange('search', e.target.value)}
              className="w-full pl-10 pr-3 py-2 theme-border border rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 theme-surface theme-text text-sm"
            />
          </div>

          {/* Start Date */}
          <div className="relative">
            <Calendar className="absolute left-3 top-3 h-4 w-4 theme-text-muted" />
            <input
              type="date"
              value={filters.startDate}
              onChange={(e) => handleFilterChange('startDate', e.target.value)}
              className="w-full pl-10 pr-3 py-2 theme-border border rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 theme-surface theme-text text-sm"
            />
          </div>

          {/* End Date */}
          <div className="relative">
            <Calendar className="absolute left-3 top-3 h-4 w-4 theme-text-muted" />
            <input
              type="date"
              value={filters.endDate}
              onChange={(e) => handleFilterChange('endDate', e.target.value)}
              className="w-full pl-10 pr-3 py-2 theme-border border rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 theme-surface theme-text text-sm"
            />
          </div>

          {/* Status Filter */}
          <select
            value={filters.status}
            onChange={(e) => handleFilterChange('status', e.target.value)}
            className="w-full px-3 py-2 theme-border border rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 theme-surface theme-text text-sm"
          >
            <option value="">All Status</option>
            <option value="completed">Completed</option>
            <option value="cancelled">Cancelled</option>
            <option value="refunded">Refunded</option>
            <option value="pending">Pending</option>
          </select>

          {/* Payment Status Filter */}
          <select
            value={filters.paymentStatus}
            onChange={(e) => handleFilterChange('paymentStatus', e.target.value)}
            className="w-full px-3 py-2 theme-border border rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 theme-surface theme-text text-sm"
          >
            <option value="">All Payments</option>
            <option value="paid">Paid</option>
            <option value="partially_paid">Partially Paid</option>
            <option value="pending">Pending</option>
          </select>
        </div>

        <div className="flex gap-2">
          <button
            onClick={applyFilters}
            disabled={loading}
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded text-sm transition-colors flex items-center gap-1 disabled:opacity-50"
          >
            <Filter className="h-4 w-4" />
            Apply Filters
          </button>
          <button
            onClick={clearFilters}
            disabled={loading}
            className="theme-border border theme-text-muted hover:theme-secondary px-4 py-2 rounded text-sm transition-colors flex items-center gap-1 disabled:opacity-50"
          >
            <X className="h-4 w-4" />
            Clear
          </button>
        </div>
      </div>

      {/* Sales Cards */}
      <div className="theme-surface rounded-lg p-4">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-md font-semibold theme-text">
            Sales Records ({pagination.total})
            {!isOnline && ' (Local Data)'}
          </h3>
          <div className="flex gap-2">
            {syncStats.totalOffline > 0 && isOnline && (
              <button
                onClick={exportOfflineData}
                disabled={exportingData}
                className="flex items-center gap-1 theme-border border theme-text-muted hover:theme-secondary px-3 py-1.5 rounded text-xs transition-colors disabled:opacity-50"
              >
                {exportingData ? (
                  <>
                    <RefreshCw className="h-3 w-3 animate-spin" />
                    Exporting...
                  </>
                ) : (
                  <>
                    <Download className="h-3 w-3" />
                    Export Data
                  </>
                )}
              </button>
            )}
            {syncStats.failedSyncs > 0 && (
              <button
                onClick={clearFailedSyncs}
                className="flex items-center gap-1 bg-red-600 hover:bg-red-700 text-white px-3 py-1.5 rounded text-xs transition-colors"
              >
                <Trash2 className="h-3 w-3" />
                Clear Failed ({syncStats.failedSyncs})
              </button>
            )}
          </div>
        </div>

        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="theme-surface rounded shadow-sm theme-border border p-4 animate-pulse">
                <div className="bg-gray-300 dark:bg-gray-600 h-4 rounded mb-2 w-3/4"></div>
                <div className="bg-gray-300 dark:bg-gray-600 h-3 rounded mb-1 w-1/2"></div>
                <div className="bg-gray-300 dark:bg-gray-600 h-3 rounded mb-3 w-2/3"></div>
                <div className="bg-gray-300 dark:bg-gray-600 h-8 rounded"></div>
              </div>
            ))}
          </div>
        ) : sales.length === 0 ? (
          <div className="text-center py-8">
            <Receipt className="h-12 w-12 mx-auto mb-3 theme-text-muted opacity-50" />
            <h3 className="text-base font-semibold theme-text mb-1">No Sales Found</h3>
            <p className="theme-text-muted text-sm">
              {pagination.total === 0 ? 'No sales have been recorded yet' : 'Try adjusting your filters'}
            </p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {sales.map((sale) => {
                const isOffline = sale.isLocal && !sale.synced;
                const hasSyncError = sale.lastSyncError;
                
                return (
                  <div key={sale._id} className="theme-surface rounded shadow-sm theme-border border p-4 hover:shadow-md transition-shadow relative">
                    
                    {/* Offline Status Badge */}
                    {isOffline && (
                      <div className="absolute -top-2 -right-2 flex gap-1">
                        <span className={`inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-full ${
                          hasSyncError 
                            ? 'bg-red-100 text-red-800' 
                            : 'bg-yellow-100 text-yellow-800'
                        }`}>
                          {hasSyncError ? (
                            <>
                              <AlertCircle className="h-3 w-3" />
                              Sync Failed
                            </>
                          ) : (
                            <>
                              <CloudOff className="h-3 w-3" />
                              Offline
                            </>
                          )}
                        </span>
                      </div>
                    )}

                    {/* Sale Header */}
                    <div className="flex justify-between items-start mb-3">
                      <div>
                        <div className="flex items-center gap-1 mb-1">
                          <h3 className="font-semibold theme-text text-sm">{sale.saleNumber}</h3>
                          {sale.synced && sale.isLocal && (
                            <span className="text-xs px-1 py-0.5 rounded bg-green-100 text-green-800">
                              Synced
                            </span>
                          )}
                        </div>
                        <p className="theme-text-muted text-xs">
                          {formatDate(sale.createdAt)} • {formatTime(sale.createdAt)}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="font-bold theme-primary-text text-sm">
                          {formatCurrency(sale.totalAmount)}
                        </p>
                        <div className="flex gap-1 mt-1">
                          <span className={`inline-flex px-2 py-0.5 text-xs font-medium rounded-full ${
                            sale.status === 'completed' ? 'bg-green-100 text-green-800' :
                            sale.status === 'cancelled' ? 'bg-red-100 text-red-800' :
                            'bg-blue-100 text-blue-800'
                          }`}>
                            {sale.status}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Customer Info */}
                    <div className="mb-3">
                      <div className="flex items-center gap-1 mb-1">
                        <User className="h-3 w-3 theme-text-muted" />
                        <span className="font-medium theme-text text-sm">
                          {sale.customer?.name || 'Walk-in Customer'}
                        </span>
                      </div>
                      {sale.customer?.phone && (
                        <p className="theme-text-muted text-xs">📞 {sale.customer.phone}</p>
                      )}
                    </div>

                    {/* Sale Summary */}
                    <div className="grid grid-cols-2 gap-2 mb-3 text-xs">
                      <div>
                        <p className="theme-text-muted">Items:</p>
                        <p className="font-medium theme-text">{sale.items?.length || 0} products</p>
                      </div>
                      <div>
                        <p className="theme-text-muted">Units:</p>
                        <p className="font-medium theme-text">
                          {sale.items?.reduce((sum, item) => sum + (item.quantity || 0), 0) || 0}
                        </p>
                      </div>
                      <div>
                        <p className="theme-text-muted">Profit:</p>
                        <p className="font-medium text-green-600">{formatCurrency(sale.totalProfit || 0)}</p>
                      </div>
                      <div>
                        <p className="theme-text-muted">Payment:</p>
                        <div className="flex items-center gap-1">
                          {getPaymentMethodIcon(sale.paymentMethod)}
                          <span className={`font-medium ${
                            sale.paymentStatus === 'paid' ? 'text-green-600' :
                            sale.paymentStatus === 'partially_paid' ? 'text-yellow-600' : 'text-red-600'
                          }`}>
                            {sale.paymentStatus || 'pending'}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex gap-1 pt-3 border-t theme-border">
                      {/* Offline Sale Actions */}
                      {isOffline && isOnline && (
                        <>
                          <button
                            onClick={() => syncSingleSale(sale._id)}
                            disabled={syncingSaleId === sale._id}
                            className="flex-1 bg-green-600 hover:bg-green-700 text-white py-1.5 px-2 rounded text-xs font-medium transition-colors flex items-center justify-center gap-1 disabled:opacity-50"
                            title="Sync to server"
                          >
                            {syncingSaleId === sale._id ? (
                              <>
                                <RefreshCw className="h-3 w-3 animate-spin" />
                                Syncing...
                              </>
                            ) : (
                              <>
                                <Upload className="h-3 w-3" />
                                Sync
                              </>
                            )}
                          </button>
                        </>
                      )}

                      {/* Common Actions */}
                      <button
                        onClick={() => handlePrintReceipt(sale)}
                        className="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-1.5 px-2 rounded text-xs font-medium transition-colors flex items-center justify-center gap-1"
                        title="Print Receipt"
                      >
                        <Printer className="h-3 w-3" />
                        Print
                      </button>
                      
                      <button
                        onClick={() => handleViewSale(sale)}
                        className="flex-1 bg-purple-600 hover:bg-purple-700 text-white py-1.5 px-2 rounded text-xs font-medium transition-colors flex items-center justify-center gap-1"
                        title="View Details"
                      >
                        <Eye className="h-3 w-3" />
                        View
                      </button>

                      {/* Cancel/Delete based on status */}
                      {sale.status === 'completed' && !isOffline && (
                        <button
                          onClick={() => handleCancelSale(sale._id)}
                          className="flex-1 bg-red-600 hover:bg-red-700 text-white py-1.5 px-2 rounded text-xs font-medium transition-colors flex items-center justify-center gap-1"
                          title="Cancel Sale"
                        >
                          <X className="h-3 w-3" />
                          Cancel
                        </button>
                      )}
                    </div>

                    {/* Sync Error Display */}
                    {hasSyncError && (
                      <div className="mt-2 p-2 bg-red-50 border border-red-200 rounded text-xs">
                        <div className="flex items-start gap-1">
                          <AlertCircle className="h-3 w-3 text-red-600 mt-0.5 flex-shrink-0" />
                          <div>
                            <p className="font-medium text-red-800">Sync Error</p>
                            <p className="text-red-700 truncate">{sale.lastSyncError}</p>
                            <p className="text-red-600 text-xs mt-1">
                              Attempts: {sale.syncAttempts || 1}
                            </p>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Pagination */}
            {pagination.totalPages > 1 && (
              <div className="mt-6 flex items-center justify-between">
                <div className="flex-1 flex justify-between items-center">
                  <button
                    onClick={handlePreviousPage}
                    disabled={pagination.page === 1 || loading}
                    className="theme-border border theme-text-muted hover:theme-secondary px-4 py-2 rounded text-sm transition-colors disabled:opacity-50"
                  >
                    Previous
                  </button>
                  <div className="text-center">
                    <span className="theme-text text-sm block">
                      Page {pagination.page} of {pagination.totalPages}
                    </span>
                    <span className="theme-text-muted text-xs block">
                      Showing {sales.length} of {pagination.total} sales
                    </span>
                  </div>
                  <button
                    onClick={handleNextPage}
                    disabled={pagination.page === pagination.totalPages || loading}
                    className="theme-border border theme-text-muted hover:theme-secondary px-4 py-2 rounded text-sm transition-colors disabled:opacity-50"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Sale Details Modal */}
      {showSaleDetails && selectedSale && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="theme-surface rounded shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-4 border-b theme-border flex justify-between items-center">
              <h2 className="text-lg font-semibold theme-text">Sale Details - {selectedSale.saleNumber}</h2>
              <button
                onClick={() => setShowSaleDetails(false)}
                className="theme-text-muted hover:theme-text transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="p-4 space-y-4">
              {/* Sale Information */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <h3 className="font-semibold theme-text mb-2">Sale Information</h3>
                  <div className="space-y-1 text-sm">
                    <p><span className="theme-text-muted">Date:</span> {formatDate(selectedSale.createdAt)}</p>
                    <p><span className="theme-text-muted">Time:</span> {formatTime(selectedSale.createdAt)}</p>
                    <p><span className="theme-text-muted">Sold By:</span> {selectedSale.soldBy?.name || 'System'}</p>
                    <p><span className="theme-text-muted">Payment Method:</span> {selectedSale.paymentMethod}</p>
                    {selectedSale.isLocal && !selectedSale.synced && (
                      <p><span className="theme-text-muted">Status:</span> <span className="text-yellow-600 font-medium">Local Sale (Pending Sync)</span></p>
                    )}
                    {selectedSale.isLocal && selectedSale.synced && (
                      <p><span className="theme-text-muted">Status:</span> <span className="text-green-600 font-medium">Local Sale (Synced)</span></p>
                    )}
                  </div>
                </div>

                <div>
                  <h3 className="font-semibold theme-text mb-2">Customer Information</h3>
                  <div className="space-y-1 text-sm">
                    <p><span className="theme-text-muted">Name:</span> {selectedSale.customer?.name || 'Walk-in Customer'}</p>
                    {selectedSale.customer?.phone && (
                      <p><span className="theme-text-muted">Phone:</span> {selectedSale.customer.phone}</p>
                    )}
                    {selectedSale.customer?.email && (
                      <p><span className="theme-text-muted">Email:</span> {selectedSale.customer.email}</p>
                    )}
                  </div>
                </div>
              </div>

              {/* Items Table */}
              <div>
                <h3 className="font-semibold theme-text mb-2">Items Sold</h3>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="theme-bg-secondary">
                      <tr>
                        <th className="px-3 py-2 text-left text-xs font-medium theme-text-muted">Product</th>
                        <th className="px-3 py-2 text-left text-xs font-medium theme-text-muted">Qty</th>
                        <th className="px-3 py-2 text-left text-xs font-medium theme-text-muted">Unit Price</th>
                        <th className="px-3 py-2 text-left text-xs font-medium theme-text-muted">Total Price</th>
                        <th className="px-3 py-2 text-left text-xs font-medium theme-text-muted">Profit</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y theme-divide">
                      {selectedSale.items.map((item, index) => (
                        <tr key={index}>
                          <td className="px-3 py-2">
                            <div>
                              <p className="font-medium theme-text text-sm">{item.productName || item.name}</p>
                              <p className="theme-text-muted text-xs">{item.productBrand || ''}</p>
                            </div>
                          </td>
                          <td className="px-3 py-2 theme-text text-sm">{item.quantity}</td>
                          <td className="px-3 py-2 theme-text text-sm">{formatCurrency(item.unitPrice)}</td>
                          <td className="px-3 py-2 theme-text text-sm">{formatCurrency(item.totalPrice)}</td>
                          <td className="px-3 py-2 text-green-600 text-sm">{formatCurrency(item.profit || 0)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Totals */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <h3 className="font-semibold theme-text mb-2">Payment Summary</h3>
                  <div className="space-y-1 text-sm">
                    <div className="flex justify-between">
                      <span className="theme-text-muted">Subtotal:</span>
                      <span className="theme-text">{formatCurrency(selectedSale.subtotal)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="theme-text-muted">Discount:</span>
                      <span className="theme-text">{formatCurrency(selectedSale.discountAmount || 0)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="theme-text-muted">Tax:</span>
                      <span className="theme-text">{formatCurrency(selectedSale.taxAmount || 0)}</span>
                    </div>
                    <div className="flex justify-between font-semibold border-t theme-border pt-1">
                      <span className="theme-text">Total Amount:</span>
                      <span className="theme-primary-text">{formatCurrency(selectedSale.totalAmount)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="theme-text-muted">Amount Paid:</span>
                      <span className="theme-text">{formatCurrency(selectedSale.amountPaid || 0)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="theme-text-muted">Balance:</span>
                      <span className={`font-medium ${
                        (selectedSale.balance || 0) === 0 ? 'text-green-600' : 'text-yellow-600'
                      }`}>
                        {formatCurrency(selectedSale.balance || 0)}
                      </span>
                    </div>
                  </div>
                </div>

                <div>
                  <h3 className="font-semibold theme-text mb-2">Profit Analysis</h3>
                  <div className="space-y-1 text-sm">
                    <div className="flex justify-between">
                      <span className="theme-text-muted">Total Cost:</span>
                      <span className="theme-text">{formatCurrency(selectedSale.totalCost || 0)}</span>
                    </div>
                    <div className="flex justify-between font-semibold">
                      <span className="theme-text">Total Profit:</span>
                      <span className="text-green-600">{formatCurrency(selectedSale.totalProfit || 0)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="theme-text-muted">Profit Margin:</span>
                      <span className="text-green-600">
                        {((selectedSale.totalProfit || 0) / selectedSale.totalAmount * 100).toFixed(2)}%
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Notes */}
              {selectedSale.notes && (
                <div>
                  <h3 className="font-semibold theme-text mb-2">Notes</h3>
                  <p className="theme-text text-sm p-2 theme-border border rounded">{selectedSale.notes}</p>
                </div>
              )}
            </div>

            <div className="p-4 border-t theme-border flex justify-end gap-2">
              {/* Sync button for offline sales */}
              {selectedSale.isLocal && !selectedSale.synced && isOnline && (
                <button
                  onClick={() => {
                    syncSingleSale(selectedSale._id);
                    setShowSaleDetails(false);
                  }}
                  disabled={syncingSaleId === selectedSale._id}
                  className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded text-sm transition-colors flex items-center gap-1 disabled:opacity-50"
                >
                  {syncingSaleId === selectedSale._id ? (
                    <>
                      <RefreshCw className="h-4 w-4 animate-spin" />
                      Syncing...
                    </>
                  ) : (
                    <>
                      <Upload className="h-4 w-4" />
                      Sync Sale
                    </>
                  )}
                </button>
              )}

              {selectedSale.status === 'cancelled' ? (
                <>
                  <button
                    onClick={() => handleDeleteSale(selectedSale._id)}
                    className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded text-sm transition-colors flex items-center gap-1"
                  >
                    <Trash2 className="h-4 w-4" />
                    Delete Sale
                  </button>
                  <button
                    onClick={() => handleResumeSale(selectedSale._id)}
                    className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded text-sm transition-colors flex items-center gap-1"
                  >
                    <RotateCcw className="h-4 w-4" />
                    Resume Sale
                  </button>
                </>
              ) : (
                <button
                  onClick={() => handlePrintReceipt(selectedSale)}
                  className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded text-sm transition-colors flex items-center gap-1"
                >
                  <Printer className="h-4 w-4" />
                  Print Receipt
                </button>
              )}
              <button
                onClick={() => setShowSaleDetails(false)}
                className="theme-border border theme-text-muted hover:theme-secondary px-4 py-2 rounded text-sm transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Sync Progress Modal */}
      {showSyncProgress && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="theme-surface rounded shadow-xl max-w-md w-full p-4">
            <div className="flex items-center gap-2 mb-4">
              <RefreshCw className="h-5 w-5 text-blue-600 animate-spin" />
              <h3 className="text-lg font-semibold theme-text">Syncing Offline Sales</h3>
            </div>
            
            <div className="mb-4">
              <div className="flex justify-between text-sm mb-1">
                <span className="theme-text">Progress</span>
                <span className="theme-primary-text">
                  {syncProgress.current} / {syncProgress.total}
                </span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div 
                  className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${(syncProgress.current / syncProgress.total) * 100}%` }}
                ></div>
              </div>
            </div>
            
            <p className="theme-text text-sm mb-2">{syncProgress.message}</p>
            
            {syncProgress.errors.length > 0 && (
              <div className="mt-3 p-2 bg-red-50 border border-red-200 rounded text-xs">
                <p className="font-medium text-red-800 mb-1">Errors ({syncProgress.errors.length}):</p>
                <div className="space-y-1 max-h-32 overflow-y-auto">
                  {syncProgress.errors.map((error, index) => (
                    <p key={index} className="text-red-700 truncate">
                      • {error.saleNumber}: {error.error}
                    </p>
                  ))}
                </div>
              </div>
            )}
            
            <button
              onClick={() => setShowSyncProgress(false)}
              className="w-full mt-4 theme-border border theme-text-muted hover:theme-secondary py-2 rounded text-sm transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default SalesTab;