import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { authAPI, productsAPI, salesAPI, dashboardAPI, adminAPI } from '../services/api';
import LocalStorageService from '../services/localStorageService';
import { 
  Package, ShoppingCart, Users, DollarSign, AlertCircle, LogOut, Lock, Mail, 
  Shield, TrendingUp, Receipt, BarChart3, RefreshCw, Cloud, CloudOff,
  Database, CheckCircle, Clock, Home, Eye, Download, Upload, 
  HardDrive, X, Activity, Layers, EyeOff, Globe, Filter
} from 'lucide-react';
import ProductManagementTab from '../components/AdminTabs/ProductManagementTab';
import CreateSaleTab from '../components/AdminTabs/CreateSaleTab';
import SalesTab from '../components/AdminTabs/SalesTab';
import AnalyticsTab from '../components/AdminTabs/AnalyticsTab';

const Admin = () => {
  const { user, login, logout, isAdmin } = useAuth();
  const navigate = useNavigate();
  
  // State management
  const [activeTab, setActiveTab] = useState('products');
  const [adminLogin, setAdminLogin] = useState({ email: '', password: '' });
  const [loginLoading, setLoginLoading] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [error, setError] = useState('');
  const [products, setProducts] = useState([]);
  const [productsLoading, setProductsLoading] = useState(false);
  const [salesStats, setSalesStats] = useState({
    totalSales: 0,
    totalRevenue: 0,
    totalProfit: 0,
    totalItemsSold: 0,
    averageSale: 0,
    todaySales: 0,
    todayRevenue: 0,
    todayProfit: 0
  });
  
  // Network & sync states
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [syncing, setSyncing] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [offlineSalesCount, setOfflineSalesCount] = useState(0);
  const [pendingSyncCount, setPendingSyncCount] = useState(0);
  const [lastSyncTime, setLastSyncTime] = useState(null);
  const [autoSyncStatus, setAutoSyncStatus] = useState('');
  const [storageInfo, setStorageInfo] = useState(null);
  const [recentlyUpdatedProducts, setRecentlyUpdatedProducts] = useState(new Set());
  
  // View mode for admins (personal vs system-wide)
  const [viewMode, setViewMode] = useState('personal'); // 'personal' or 'system'
  
  // Refs
  const hasFetchedRef = useRef(false);
  const isMountedRef = useRef(false);
  const syncIntervalRef = useRef(null);
  const statsIntervalRef = useRef(null);
  const refreshTimeoutRef = useRef(null);

  // ==================== NETWORK MONITORING ====================
  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      setAutoSyncStatus('Internet connection restored');
      setTimeout(() => setAutoSyncStatus(''), 3000);
    };

    const handleOffline = () => {
      setIsOnline(false);
      setError('You are currently offline. Changes will be saved locally.');
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // ==================== UTILITY FUNCTIONS ====================
  const loadStorageInfo = useCallback(() => {
    try {
      const info = LocalStorageService.getStorageInfo();
      setStorageInfo(info);
    } catch (error) {
      console.error('Error loading storage info:', error);
    }
  }, []);

  const formatTimeAgo = (date) => {
    if (!date) return 'Never';
    
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);
    
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    return `${diffDays}d ago`;
  };

  // Helper function to get API parameters based on view mode
  const getApiParams = useCallback((params = {}) => {
    if (isAdmin && viewMode === 'personal' && user && user._id) {
      return {
        ...params,
        view: 'my', // Explicitly request personal view
        createdBy: user._id // Filter by creator
      };
    }
    return params;
  }, [isAdmin, viewMode, user]);

  // Filter products by view mode
  const filterProductsByViewMode = useCallback((productsList) => {
    if (!productsList || !Array.isArray(productsList)) return productsList;
    
    // Only apply view mode filtering for admin users in personal view
    if (!isAdmin || viewMode !== 'personal' || !user || !user._id) {
      return productsList;
    }
    
    // In personal view, show only products created by the current admin
    const filtered = productsList.filter(product => {
      // For online products, check createdBy field
      if (product.createdBy) {
        // Handle both string and object formats
        const createdById = typeof product.createdBy === 'object' 
          ? product.createdBy._id || product.createdBy 
          : product.createdBy;
        
        return createdById === user._id;
      }
      
      // For local products, check if they have isLocal flag or createdBy
      if (product.isLocal) {
        return product.createdBy === user._id || product.createdBy?._id === user._id;
      }
      
      // If no creator info, include it (shouldn't happen for admin's personal view)
      return false;
    });
    
    console.log(`🔍 Filtered products: ${productsList.length} → ${filtered.length} (personal view)`);
    return filtered;
  }, [isAdmin, viewMode, user]);

  // ==================== DATA FETCHING WITH PROPER VIEW MODE HANDLING ====================
  const fetchSalesStats = useCallback(async () => {
    try {
      if (isOnline) {
        let response;
        
        if (isAdmin && viewMode === 'personal') {
          // Try to get admin-specific sales stats first
          try {
            if (salesAPI.getAdminSalesStats) {
              response = await salesAPI.getAdminSalesStats(getApiParams({ period: 'today' }));
            } else {
              // Fallback to regular stats with view param
              response = await salesAPI.getSalesStats({ 
                ...getApiParams({ period: 'today' }),
                view: 'my' 
              });
            }
          } catch (error) {
            console.warn('Admin sales stats endpoint not available, falling back:', error);
            response = await salesAPI.getSalesStats({ 
              ...getApiParams({ period: 'today' }),
              view: viewMode === 'personal' ? 'my' : undefined 
            });
          }
        } else {
          // System-wide or non-admin stats
          response = await salesAPI.getSalesStats({ period: 'today' });
        }
        
        if (response.data && response.data.stats) {
          setSalesStats(prev => ({
            ...prev,
            ...response.data.stats,
            todaySales: response.data.stats.totalSales || 0,
            todayRevenue: response.data.stats.totalRevenue || 0,
            todayProfit: response.data.stats.totalProfit || 0
          }));
        }
      } else {
        // Offline fallback - filter local sales by view mode
        const localStats = LocalStorageService.getSalesStats('today');
        let filteredStats = localStats;
        
        if (isAdmin && viewMode === 'personal' && user && user._id) {
          // Filter sales by creator for personal view
          const allSales = LocalStorageService.getSales();
          const personalSales = allSales.filter(sale => 
            sale.createdBy === user._id || 
            sale.createdBy?._id === user._id ||
            sale.isLocal
          );
          
          // Recalculate stats for personal sales
          const personalStats = calculateSalesStats(personalSales);
          filteredStats = { ...localStats, ...personalStats };
        }
        
        if (filteredStats) {
          setSalesStats(prev => ({
            ...prev,
            totalSales: filteredStats.totalSales || 0,
            totalRevenue: filteredStats.totalRevenue || 0,
            totalProfit: filteredStats.totalProfit || 0,
            totalItemsSold: filteredStats.totalItemsSold || 0,
            averageSale: filteredStats.averageSale || 0,
            todaySales: filteredStats.totalSales || 0,
            todayRevenue: filteredStats.totalRevenue || 0,
            todayProfit: filteredStats.totalProfit || 0
          }));
        }
      }
    } catch (error) {
      console.error('Error fetching sales stats:', error);
      const localStats = LocalStorageService.getSalesStats('today');
      if (localStats) {
        setSalesStats(prev => ({
          ...prev,
          totalSales: localStats.totalSales || 0,
          totalRevenue: localStats.totalRevenue || 0,
          totalProfit: localStats.totalProfit || 0
        }));
      }
    }
  }, [isOnline, isAdmin, viewMode, user, getApiParams]);

  // Helper function to calculate sales stats from sales array
  const calculateSalesStats = (sales) => {
    const totalSales = sales.length;
    const totalRevenue = sales.reduce((sum, sale) => sum + (sale.totalAmount || 0), 0);
    const totalProfit = sales.reduce((sum, sale) => sum + (sale.totalProfit || 0), 0);
    const totalItemsSold = sales.reduce((sum, sale) => 
      sum + (sale.items?.reduce((itemSum, item) => itemSum + (item.quantity || 0), 0) || 0), 0);
    const averageSale = totalSales > 0 ? totalRevenue / totalSales : 0;
    
    return {
      totalSales,
      totalRevenue,
      totalProfit,
      totalItemsSold,
      averageSale
    };
  };

  const fetchProducts = useCallback(async (force = false) => {
    if (!force && hasFetchedRef.current && !productsLoading) return;

    hasFetchedRef.current = true;
    setProductsLoading(true);
    setError('');
    
    try {
      if (isOnline) {
        let response;
        
        if (isAdmin && viewMode === 'personal') {
          console.log('📦 Fetching admin personal products');
          try {
            // Try admin-specific endpoint first
            if (productsAPI.getAdminProducts) {
              response = await productsAPI.getAdminProducts(getApiParams({ limit: 200 }));
            } else {
              // Fallback to regular endpoint with view param
              response = await productsAPI.getProducts({ 
                ...getApiParams({ limit: 200 }),
                view: 'my'
              });
            }
          } catch (adminError) {
            console.warn('Admin products endpoint not available, falling back:', adminError);
            response = await productsAPI.getProducts({ 
              ...getApiParams({ limit: 200 }),
              view: viewMode === 'personal' ? 'my' : undefined
            });
          }
        } else {
          console.log('📦 Fetching all products (system view)');
          response = await productsAPI.getProducts({ limit: 200 });
        }
        
        if (!isMountedRef.current) return;
        
        if (response.data && response.data.products) {
          let backendProducts = response.data.products;
          
          // Apply view mode filtering on the client side as well
          if (isAdmin && viewMode === 'personal') {
            backendProducts = filterProductsByViewMode(backendProducts);
          }
          
          console.log(`✅ Loaded ${backendProducts.length} products from backend`);
          
          // Merge with local products
          const localProducts = LocalStorageService.getProducts();
          
          // Filter local products by view mode
          let filteredLocalProducts = localProducts;
          if (isAdmin && viewMode === 'personal') {
            filteredLocalProducts = localProducts.filter(p => 
              p.createdBy === user._id || 
              p.createdBy?._id === user._id || 
              p.isLocal
            );
          }
          
          const mergedProducts = backendProducts.map(backendProduct => {
            const localProduct = filteredLocalProducts.find(p => 
              !p.isLocal && p._id === backendProduct._id
            );
            
            if (localProduct) {
              return {
                ...backendProduct,
                stock: localProduct.stock,
                totalSold: localProduct.totalSold,
                lowStockAlert: localProduct.lowStockAlert || backendProduct.lowStockAlert,
                stockHistory: [
                  ...(backendProduct.stockHistory || []),
                  ...(localProduct.stockHistory || [])
                ].sort((a, b) => new Date(b.date) - new Date(a.date))
              };
            }
            
            return backendProduct;
          });
          
          // Add filtered local-only products
          const localOnlyProducts = filteredLocalProducts.filter(p => p.isLocal);
          const allProducts = [...mergedProducts, ...localOnlyProducts];
          
          setProducts(allProducts);
          LocalStorageService.saveProducts(allProducts);
          
          window.dispatchEvent(new CustomEvent('productsLoaded', {
            detail: { 
              products: allProducts, 
              timestamp: new Date().toISOString(),
              viewMode,
              isAdmin
            }
          }));
        }
      } else {
        // Offline mode - load from local storage with view mode filtering
        console.log('📱 Offline mode: loading products from local storage');
        const localProducts = LocalStorageService.getProducts();
        
        let filteredLocalProducts = localProducts;
        if (isAdmin && viewMode === 'personal' && user && user._id) {
          filteredLocalProducts = localProducts.filter(p => 
            p.createdBy === user._id || 
            p.createdBy?._id === user._id || 
            p.isLocal
          );
          console.log(`📱 Filtered to ${filteredLocalProducts.length} personal products`);
        }
        
        setProducts(filteredLocalProducts);
        
        window.dispatchEvent(new CustomEvent('productsLoaded', {
          detail: { 
            products: filteredLocalProducts, 
            timestamp: new Date().toISOString(),
            viewMode: 'offline'
          }
        }));
      }
      
    } catch (error) {
      hasFetchedRef.current = false;
      
      if (!isMountedRef.current) return;
      
      // Fallback to local storage with view mode filtering
      const localProducts = LocalStorageService.getProducts();
      
      let filteredLocalProducts = localProducts;
      if (isAdmin && viewMode === 'personal' && user && user._id) {
        filteredLocalProducts = localProducts.filter(p => 
          p.createdBy === user._id || 
          p.createdBy?._id === user._id || 
          p.isLocal
        );
      }
      
      setProducts(filteredLocalProducts);
      
      if (error.code === 'ECONNABORTED') {
        setError('Backend server is not responding. Working in offline mode.');
      } else if (!error.response) {
        setError('Cannot connect to backend server. Working in offline mode.');
      } else {
        setError(`Failed to load products. Using local data (${filteredLocalProducts.length} products).`);
      }
      
      window.dispatchEvent(new CustomEvent('productsLoaded', {
        detail: { 
          products: filteredLocalProducts, 
          timestamp: new Date().toISOString(),
          viewMode: 'offline'
        }
      }));
    } finally {
      if (isMountedRef.current) {
        setProductsLoading(false);
      }
    }
  }, [isOnline, isAdmin, viewMode, user, getApiParams, filterProductsByViewMode]);

  // ==================== OFFLINE SYNC MANAGEMENT ====================
  const loadOfflineStats = useCallback(() => {
    if (!isLoggedIn || !isAdmin) return;
    
    try {
      const sales = LocalStorageService.getSales();
      
      // Filter sales by view mode
      let filteredSales = sales;
      if (viewMode === 'personal' && user && user._id) {
        filteredSales = sales.filter(sale => 
          sale.createdBy === user._id || 
          sale.createdBy?._id === user._id ||
          sale.isLocal
        );
      }
      
      const offlineSales = filteredSales.filter(s => s.isLocal && !s.synced);
      setOfflineSalesCount(offlineSales.length);
      
      const syncQueue = LocalStorageService.getSyncQueue();
      setPendingSyncCount(syncQueue.length);
      
      const lastSync = localStorage.getItem('electroshop_last_sync');
      if (lastSync) {
        setLastSyncTime(new Date(lastSync));
      }
      
      loadStorageInfo();
    } catch (error) {
      console.error('Error loading offline stats:', error);
    }
  }, [isLoggedIn, isAdmin, viewMode, user, loadStorageInfo]);

  const handleSyncWithBackend = async () => {
    if (!isOnline) {
      setError('Cannot sync while offline');
      return;
    }
    
    setSyncing(true);
    setError('');
    setSuccessMessage('');
    setAutoSyncStatus('Syncing with backend...');
    
    try {
      // Pass view mode context to sync function
      const syncContext = {
        userId: user?._id,
        isAdmin,
        viewMode
      };
      
      const syncResult = await LocalStorageService.syncWithBackend(productsAPI, syncContext);
      
      if (syncResult.success) {
        setOfflineSalesCount(prev => prev - syncResult.sales.synced);
        setPendingSyncCount(prev => prev - syncResult.totalSynced);
        
        const now = new Date();
        setLastSyncTime(now);
        localStorage.setItem('electroshop_last_sync', now.toISOString());
        
        hasFetchedRef.current = false;
        await fetchProducts();
        await fetchSalesStats();
        
        setSuccessMessage(`✅ Sync completed: ${syncResult.totalSynced} items synced`);
        setAutoSyncStatus('');
        setTimeout(() => setSuccessMessage(''), 5000);
        
        window.dispatchEvent(new CustomEvent('syncCompleted', {
          detail: { ...syncResult, timestamp: now.toISOString() }
        }));
        
      } else {
        setError(`❌ Sync failed: ${syncResult.message}`);
        setAutoSyncStatus('Sync failed');
      }
    } catch (error) {
      setError(`Sync error: ${error.message}`);
      setAutoSyncStatus('Auto-sync failed');
    } finally {
      setSyncing(false);
      loadOfflineStats();
    }
  };

  // ==================== EVENT LISTENERS ====================
  useEffect(() => {
    const handleProductsStockUpdated = (event) => {
      if (event.detail && event.detail.updatedProductIds) {
        setRecentlyUpdatedProducts(new Set(event.detail.updatedProductIds));
        
        if (refreshTimeoutRef.current) {
          clearTimeout(refreshTimeoutRef.current);
        }
        
        refreshTimeoutRef.current = setTimeout(() => {
          hasFetchedRef.current = false;
          fetchProducts(true);
        }, 500);
      }
    };

    const handleProductUpdated = (event) => {
      if (event.detail && event.detail.productId) {
        setRecentlyUpdatedProducts(prev => new Set(prev).add(event.detail.productId));
      }
    };

    const handleForceProductRefresh = () => {
      hasFetchedRef.current = false;
      fetchProducts(true);
    };

    const handleProductsSavedToLocalStorage = (event) => {
      if (event.detail && event.detail.products) {
        // Apply view mode filtering to saved products
        const filteredProducts = filterProductsByViewMode(event.detail.products);
        setProducts(filteredProducts);
      }
    };

    const handleOfflineSaleCreated = (event) => {
      fetchSalesStats();
      loadOfflineStats();
      
      setTimeout(() => {
        hasFetchedRef.current = false;
        fetchProducts(true);
      }, 300);
    };

    const handleViewModeChanged = (event) => {
      if (event.detail && event.detail.viewMode) {
        console.log('🔄 Admin: View mode changed to', event.detail.viewMode);
        setViewMode(event.detail.viewMode);
        hasFetchedRef.current = false;
        setProducts([]);
        setProductsLoading(true);
        
        setTimeout(() => {
          fetchProducts(true);
          fetchSalesStats();
        }, 100);
      }
    };

    window.addEventListener('productsStockUpdated', handleProductsStockUpdated);
    window.addEventListener('productUpdated', handleProductUpdated);
    window.addEventListener('forceProductRefresh', handleForceProductRefresh);
    window.addEventListener('productsSavedToLocalStorage', handleProductsSavedToLocalStorage);
    window.addEventListener('offlineSaleCreated', handleOfflineSaleCreated);
    window.addEventListener('viewModeChanged', handleViewModeChanged);
    
    return () => {
      window.removeEventListener('productsStockUpdated', handleProductsStockUpdated);
      window.removeEventListener('productUpdated', handleProductUpdated);
      window.removeEventListener('forceProductRefresh', handleForceProductRefresh);
      window.removeEventListener('productsSavedToLocalStorage', handleProductsSavedToLocalStorage);
      window.removeEventListener('offlineSaleCreated', handleOfflineSaleCreated);
      window.removeEventListener('viewModeChanged', handleViewModeChanged);
    };
  }, [fetchProducts, fetchSalesStats, loadOfflineStats, filterProductsByViewMode]);

  useEffect(() => {
    const handleSaleCreated = () => {
      fetchSalesStats();
      loadOfflineStats();
    };

    const handleSyncCompleted = () => {
      hasFetchedRef.current = false;
      fetchProducts(true);
      fetchSalesStats();
    };

    window.addEventListener('saleCreated', handleSaleCreated);
    window.addEventListener('syncCompleted', handleSyncCompleted);
    
    return () => {
      window.removeEventListener('saleCreated', handleSaleCreated);
      window.removeEventListener('syncCompleted', handleSyncCompleted);
    };
  }, [fetchSalesStats, fetchProducts, loadOfflineStats]);

  // ==================== AUTO-SYNC & REFRESH ====================
  useEffect(() => {
    if (isLoggedIn && isAdmin) {
      loadOfflineStats();
      
      const interval = setInterval(loadOfflineStats, 30000);
      
      const handleOnlineSync = () => {
        if (offlineSalesCount > 0 || pendingSyncCount > 0) {
          setAutoSyncStatus('Network restored, syncing pending data...');
          setTimeout(() => handleSyncWithBackend(), 2000);
        }
      };
      
      window.addEventListener('online', handleOnlineSync);
      
      return () => {
        clearInterval(interval);
        window.removeEventListener('online', handleOnlineSync);
      };
    }
  }, [isLoggedIn, isAdmin, offlineSalesCount, pendingSyncCount, loadOfflineStats]);

  useEffect(() => {
    if (isOnline && isLoggedIn && isAdmin) {
      if (syncIntervalRef.current) clearInterval(syncIntervalRef.current);
      
      syncIntervalRef.current = setInterval(() => {
        const sales = LocalStorageService.getSales();
        const pendingSales = sales.filter(s => s.isLocal && !s.synced);
        const products = LocalStorageService.getProducts();
        const pendingProducts = products.filter(p => p.isLocal && !p.synced);
        
        if (pendingSales.length > 0 || pendingProducts.length > 0) {
          setAutoSyncStatus('Auto-syncing pending data...');
          handleSyncWithBackend();
        }
      }, 5 * 60 * 1000);
      
      return () => {
        if (syncIntervalRef.current) clearInterval(syncIntervalRef.current);
      };
    }
  }, [isOnline, isLoggedIn, isAdmin]);

  useEffect(() => {
    if (isLoggedIn && isAdmin) {
      if (statsIntervalRef.current) clearInterval(statsIntervalRef.current);
      
      statsIntervalRef.current = setInterval(() => {
        fetchSalesStats();
        loadOfflineStats();
      }, 60000);
      
      return () => {
        if (statsIntervalRef.current) clearInterval(statsIntervalRef.current);
      };
    }
  }, [isLoggedIn, isAdmin, fetchSalesStats, loadOfflineStats]);

  // ==================== INITIALIZATION ====================
  const initializeFromLocal = useCallback(async () => {
    try {
      const localProducts = LocalStorageService.getProducts();
      
      let filteredProducts = localProducts;
      if (isAdmin && viewMode === 'personal' && user && user._id) {
        filteredProducts = localProducts.filter(p => 
          p.createdBy === user._id || 
          p.createdBy?._id === user._id || 
          p.isLocal
        );
      }
      
      if (filteredProducts.length > 0) {
        setProducts(filteredProducts);
      }
      
      const localStats = LocalStorageService.getSalesStats('today');
      let filteredStats = localStats;
      
      if (isAdmin && viewMode === 'personal' && user && user._id) {
        const allSales = LocalStorageService.getSales();
        const personalSales = allSales.filter(sale => 
          sale.createdBy === user._id || 
          sale.createdBy?._id === user._id ||
          sale.isLocal
        );
        
        const personalStats = calculateSalesStats(personalSales);
        filteredStats = { ...localStats, ...personalStats };
      }
      
      if (filteredStats) {
        setSalesStats(prev => ({
          ...prev,
          totalSales: filteredStats.totalSales || 0,
          totalRevenue: filteredStats.totalRevenue || 0,
          totalProfit: filteredStats.totalProfit || 0,
          totalItemsSold: filteredStats.totalItemsSold || 0,
          averageSale: filteredStats.averageSale || 0,
          todaySales: filteredStats.totalSales || 0,
          todayRevenue: filteredStats.totalRevenue || 0,
          todayProfit: filteredStats.totalProfit || 0
        }));
      }
      
      loadOfflineStats();
      
      return { success: true, products: filteredProducts.length };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }, [isAdmin, viewMode, user, loadOfflineStats]);

  useEffect(() => {
    isMountedRef.current = true;
    
    return () => {
      isMountedRef.current = false;
      if (syncIntervalRef.current) clearInterval(syncIntervalRef.current);
      if (statsIntervalRef.current) clearInterval(statsIntervalRef.current);
      if (refreshTimeoutRef.current) clearTimeout(refreshTimeoutRef.current);
    };
  }, []);

  useEffect(() => {
    if (user && isAdmin) {
      setIsLoggedIn(true);
      
      initializeFromLocal();
      
      if (!hasFetchedRef.current && products.length === 0) {
        fetchProducts();
      }

      fetchSalesStats();
    } else {
      setIsLoggedIn(false);
      setProducts([]);
      hasFetchedRef.current = false;
    }
  }, [user, isAdmin, products.length, fetchProducts, fetchSalesStats, initializeFromLocal]);

  // ==================== HELPER FUNCTIONS ====================
  const refreshProducts = useCallback(async () => {
    hasFetchedRef.current = false;
    await fetchProducts(true);
  }, [fetchProducts]);

  const refreshSalesStats = useCallback(async () => {
    await fetchSalesStats();
  }, [fetchSalesStats]);

  const handleSaleCreated = useCallback(async () => {
    await fetchSalesStats();
    loadOfflineStats();
    
    hasFetchedRef.current = false;
    await fetchProducts(true);
    
    window.dispatchEvent(new CustomEvent('globalSaleCreated', {
      detail: { timestamp: new Date().toISOString() }
    }));
  }, [fetchSalesStats, loadOfflineStats, fetchProducts]);

  const handleRetryProducts = () => {
    refreshProducts();
  };

  // ==================== CALCULATIONS WITH VIEW MODE ====================
  // These calculations use the already filtered products array
  const totalProducts = products.length;
  const totalStock = products.reduce((sum, product) => sum + (product.stock || 0), 0);
  const totalInventoryValue = products.reduce((sum, product) => sum + ((product.purchasePrice || 0) * (product.stock || 0)), 0);
  const lowStockProducts = products.filter(p => p.stock > 0 && p.stock <= (p.lowStockAlert || 5)).length;
  const outOfStockProducts = products.filter(p => (p.stock || 0) <= 0).length;

  // ==================== AUTH HANDLERS ====================
  const handleAdminLogin = async (e) => {
    e.preventDefault();
    setLoginLoading(true);
    setError('');

    try {
      const response = await authAPI.login(adminLogin);
      const { user: adminUser, token } = response.data;
      
      if (adminUser.role !== 'admin') {
        setError('Access denied. Admin privileges required.');
        return;
      }

      login(adminUser, token);
      setIsLoggedIn(true);
      hasFetchedRef.current = false;
      setProducts([]);
      setViewMode('personal'); // Reset to personal view on login
      
      await initializeFromLocal();
      await fetchProducts();
      await fetchSalesStats();
      
    } catch (err) {
      const offlineAdmin = {
        _id: 'offline_admin',
        name: 'Offline Admin',
        email: 'admin@offline.com',
        role: 'admin'
      };
      
      login(offlineAdmin, 'offline_token');
      setIsLoggedIn(true);
      setViewMode('personal');
      
      await initializeFromLocal();
      
      setError('Using offline mode. Some features may be limited.');
    } finally {
      setLoginLoading(false);
    }
  };

  const handleAdminLogout = () => {
    logout();
    setIsLoggedIn(false);
    setProducts([]);
    hasFetchedRef.current = false;
    setAdminLogin({ email: '', password: '' });
    setViewMode('personal'); // Reset view mode on logout
    navigate('/');
  };

  // ==================== VIEW MODE TOGGLE ====================
  const toggleViewMode = () => {
    const newViewMode = viewMode === 'personal' ? 'system' : 'personal';
    setViewMode(newViewMode);
    
    // Clear and refetch data with new view mode
    hasFetchedRef.current = false;
    setProducts([]);
    setSalesStats({
      totalSales: 0,
      totalRevenue: 0,
      totalProfit: 0,
      totalItemsSold: 0,
      averageSale: 0,
      todaySales: 0,
      todayRevenue: 0,
      todayProfit: 0
    });
    
    // Dispatch event for child components
    window.dispatchEvent(new CustomEvent('viewModeChanged', {
      detail: { viewMode: newViewMode }
    }));
    
    // Fetch data with new view mode
    setTimeout(() => {
      fetchProducts(true);
      fetchSalesStats();
    }, 100);
  };

  // ==================== LOGIN SCREEN ====================
  if (!isLoggedIn) {
    return (
      <div className="min-h-screen theme-bg flex items-center justify-center p-3">
        <div className="w-full max-w-sm space-y-4">
          <div className="text-center">
            <div className="mx-auto h-10 w-10 bg-red-600 rounded-lg flex items-center justify-center">
              <Shield className="h-5 w-5 text-white" />
            </div>
            <h2 className="mt-3 text-lg font-bold theme-text">
              Admin Login
            </h2>
            <p className="mt-1 text-xs theme-text-muted">
              {!isOnline && '⚠️ You are currently offline'}
            </p>
          </div>

          <form onSubmit={handleAdminLogin} className="space-y-2">
            {error && (
              <div className={`px-2 py-1.5 rounded text-xs ${
                error.includes('offline') || error.includes('Using offline')
                  ? 'bg-yellow-50 border border-yellow-200 text-yellow-600'
                  : 'bg-red-50 border border-red-200 text-red-600'
              }`}>
                {error}
              </div>
            )}

            <div className="space-y-1.5">
              <div>
                <div className="relative">
                  <Mail className="absolute left-2 top-2 h-3.5 w-3.5 theme-text-muted" />
                  <input
                    type="email"
                    required
                    value={adminLogin.email}
                    onChange={(e) => setAdminLogin(prev => ({ ...prev, email: e.target.value }))}
                    className="pl-8 w-full px-2 py-1.5 theme-border border rounded text-xs focus:outline-none focus:ring-1 focus:ring-red-500 theme-surface theme-text placeholder-theme-text-muted"
                    placeholder="Admin email"
                  />
                </div>
              </div>

              <div>
                <div className="relative">
                  <Lock className="absolute left-2 top-2 h-3.5 w-3.5 theme-text-muted" />
                  <input
                    type="password"
                    required
                    value={adminLogin.password}
                    onChange={(e) => setAdminLogin(prev => ({ ...prev, password: e.target.value }))}
                    className="pl-8 w-full px-2 py-1.5 theme-border border rounded text-xs focus:outline-none focus:ring-1 focus:ring-red-500 theme-surface theme-text placeholder-theme-text-muted"
                    placeholder="Password"
                  />
                </div>
              </div>
            </div>

            <button
              type="submit"
              disabled={loginLoading}
              className="w-full py-1.5 px-3 text-xs rounded text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-1 focus:ring-red-500 disabled:opacity-50 transition-colors"
            >
              {loginLoading ? 'Signing in...' : 'Sign in'}
            </button>

            <button
              type="button"
              onClick={() => navigate('/')}
              className="w-full flex items-center justify-center gap-1 text-xs theme-primary-text hover:opacity-80 transition-colors"
            >
              <Home className="h-3 w-3" />
              Back to Store
            </button>
          </form>

          <div className="p-2 bg-yellow-50 border border-yellow-200 rounded text-xs">
            <h3 className="font-medium text-yellow-800 mb-1 flex items-center gap-1">
              <Eye className="h-3 w-3" />
              Demo Admin Credentials
            </h3>
            <div className="text-yellow-700 space-y-0.5">
              <div className="flex items-center justify-between">
                <span className="font-medium">Email:</span>
                <span className="font-mono text-[10px]">admin@electronics.com</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="font-medium">Password:</span>
                <span className="font-mono text-[10px]">admin123</span>
              </div>
            </div>
          </div>
          
          {!isOnline && (
            <div className="p-2 bg-blue-50 border border-blue-200 rounded text-xs">
              <div className="flex items-center gap-1.5 mb-1">
                <CloudOff className="h-3.5 w-3.5 text-blue-600" />
                <h3 className="font-medium text-blue-800">Offline Mode</h3>
              </div>
              <p className="text-blue-700">You can still login and work with locally stored data.</p>
            </div>
          )}
        </div>
      </div>
    );
  }

  // ==================== MAIN ADMIN DASHBOARD ====================
  return (
    <div className="min-h-screen theme-bg">
      <div className="max-w-7xl mx-auto px-2 sm:px-4 lg:px-6 py-3">
  
        {/* Header */}
        <div className="mb-3 theme-surface rounded-lg shadow border theme-border p-2">
          <div className="flex items-center justify-between gap-1.5">
            {/* Left side */}
            <div className="flex items-center gap-1.5 min-w-0 flex-1">
              <div className="p-1 bg-red-600 rounded flex-shrink-0">
                <Shield className="h-3.5 w-3.5 text-white" />
              </div>
              
              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <h1 className="text-xs font-bold theme-text truncate">
                    Admin Dashboard
                  </h1>
                  
                  {/* View Mode Toggle */}
                  {isAdmin && (
                    <button
                      onClick={toggleViewMode}
                      className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[10px] font-medium transition-all ${
                        viewMode === 'personal'
                          ? 'bg-blue-100 text-blue-800 hover:bg-blue-200'
                          : 'bg-purple-100 text-purple-800 hover:bg-purple-200'
                      }`}
                      title={`Viewing: ${viewMode === 'personal' ? 'My Data' : 'All System Data'}`}
                    >
                      {viewMode === 'personal' ? (
                        <>
                          <EyeOff className="h-2 w-2" />
                          <span className="hidden xs:inline">My Data</span>
                        </>
                      ) : (
                        <>
                          <Globe className="h-2 w-2" />
                          <span className="hidden xs:inline">All Data</span>
                        </>
                      )}
                    </button>
                  )}
                  
                  {/* Status Indicators */}
                  <div className="flex items-center gap-1 flex-shrink-0">
                    {isOnline ? (
                      <span className="inline-flex items-center gap-0.5 px-1 py-0.5 rounded-full bg-green-100 text-green-800 text-[10px] whitespace-nowrap">
                        <Cloud className="h-2 w-2" />
                        <span className="hidden xs:inline">Online</span>
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-0.5 px-1 py-0.5 rounded-full bg-yellow-100 text-yellow-800 text-[10px] whitespace-nowrap">
                        <CloudOff className="h-2 w-2" />
                        <span className="hidden xs:inline">Offline</span>
                      </span>
                    )}
                    
                    {storageInfo && (
                      <span className="inline-flex items-center gap-0.5 px-1 py-0.5 rounded-full bg-gray-100 text-gray-800 text-[10px] whitespace-nowrap">
                        <HardDrive className="h-2 w-2" />
                        {storageInfo.localStorage.usagePercent?.toFixed(1)}%
                      </span>
                    )}
                  </div>
                </div>
                
                <p className="hidden sm:block text-[10px] theme-text-muted truncate">
                  {viewMode === 'personal' 
                    ? `Managing your products, sales, analytics • ${user.name}` 
                    : `Managing all system data • ${user.name} (System View)`
                  }
                </p>
                
                {/* Mobile status */}
                <div className="sm:hidden flex items-center gap-1 mt-0.5">
                  {lastSyncTime && (
                    <span className="inline-flex items-center gap-0.5 text-[10px] theme-text-muted whitespace-nowrap">
                      <Clock className="h-2 w-2" />
                      {formatTimeAgo(lastSyncTime)}
                    </span>
                  )}
                  {recentlyUpdatedProducts.size > 0 && (
                    <span className="inline-flex items-center gap-0.5 px-1 py-0.5 rounded-full bg-blue-100 text-blue-800 text-[10px] animate-pulse whitespace-nowrap">
                      <Activity className="h-2 w-2" />
                      {recentlyUpdatedProducts.size}
                    </span>
                  )}
                </div>
              </div>
            </div>
            
            {/* Right side - Actions */}
            <div className="flex items-center gap-1.5 flex-shrink-0">
              {/* Sync Button */}
              {isOnline && (
                <button
                  onClick={handleSyncWithBackend}
                  disabled={syncing || (offlineSalesCount === 0 && pendingSyncCount === 0)}
                  className="flex items-center gap-1 bg-green-600 hover:bg-green-700 text-white px-2 py-1 rounded text-xs font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex-shrink-0"
                >
                  <RefreshCw className={`h-3 w-3 ${syncing ? 'animate-spin' : ''}`} />
                  <span className="hidden xs:inline">{syncing ? 'Syncing' : 'Sync'}</span>
                  {(offlineSalesCount > 0 || pendingSyncCount > 0) && (
                    <span className="bg-white/20 px-0.5 py-0.25 rounded text-[10px]">
                      {offlineSalesCount + pendingSyncCount}
                    </span>
                  )}
                </button>
              )}
              
              {/* User Info */}
              <div className="hidden md:block text-right border-l theme-border pl-1.5 ml-1.5">
                <p className="text-xs font-medium theme-text">{user.name}</p>
                <p className="text-[10px] theme-text-muted flex items-center gap-0.5">
                  <Shield className="h-2 w-2 text-red-600" />
                  {viewMode === 'personal' ? 'Admin' : 'System Admin'}
                </p>
              </div>
              
              {/* Logout Button */}
              <button
                onClick={handleAdminLogout}
                className="flex items-center gap-1 bg-red-600 hover:bg-red-700 text-white px-2 py-1 rounded text-xs font-medium transition-colors flex-shrink-0"
                title="Logout"
              >
                <LogOut className="h-3 w-3" />
                <span className="hidden sm:inline">Logout</span>
              </button>
            </div>
          </div>
          
          {/* Desktop Status Row */}
          <div className="hidden sm:flex items-center gap-1.5 mt-1.5 overflow-x-auto pb-1 scrollbar-hide">
            <span className="text-[10px] theme-text-muted flex-shrink-0">
              Viewing: <span className="font-medium">{viewMode === 'personal' ? 'Your Data' : 'All Data'}</span>
            </span>
            {lastSyncTime && (
              <span className="inline-flex items-center gap-0.5 text-[10px] theme-text-muted whitespace-nowrap flex-shrink-0">
                <Clock className="h-2 w-2" />
                Last sync: {formatTimeAgo(lastSyncTime)}
              </span>
            )}
            {recentlyUpdatedProducts.size > 0 && (
              <span className="inline-flex items-center gap-0.5 px-1 py-0.5 rounded-full bg-blue-100 text-blue-800 text-[10px] whitespace-nowrap flex-shrink-0">
                <Activity className="h-2 w-2" />
                {recentlyUpdatedProducts.size} products updated
              </span>
            )}
          </div>
        </div>

        {/* Status Alerts */}
        <div className="mb-3 space-y-1.5">
          {!isOnline && (
            <div className="p-1.5 bg-yellow-50 border border-yellow-200 rounded-lg">
              <div className="flex items-center gap-1.5">
                <CloudOff className="h-3.5 w-3.5 text-yellow-600 flex-shrink-0" />
                <div className="min-w-0">
                  <p className="font-medium text-yellow-800 text-xs truncate">
                    Offline Mode Active
                  </p>
                  <p className="text-yellow-700 text-[10px] truncate">
                    Changes saved locally, will sync when online
                  </p>
                </div>
              </div>
            </div>
          )}
          
          {(offlineSalesCount > 0 || pendingSyncCount > 0) && (
            <div className="p-1.5 bg-blue-50 border border-blue-200 rounded-lg">
              <div className="flex items-center gap-1.5">
                <Database className="h-3.5 w-3.5 text-blue-600 flex-shrink-0" />
                <div className="min-w-0">
                  <p className="font-medium text-blue-800 text-xs truncate">
                    Pending Sync: {offlineSalesCount} sales, {pendingSyncCount} items
                  </p>
                </div>
              </div>
            </div>
          )}

          {autoSyncStatus && (
            <div className="p-1.5 bg-purple-50 border border-purple-200 rounded-lg">
              <div className="flex items-center gap-1.5">
                <RefreshCw className="h-3.5 w-3.5 text-purple-600 animate-spin flex-shrink-0" />
                <p className="text-xs text-purple-800 truncate">{autoSyncStatus}</p>
              </div>
            </div>
          )}
          
          {successMessage && (
            <div className="p-1.5 bg-green-50 border border-green-200 rounded-lg">
              <div className="flex items-center justify-between gap-1.5">
                <div className="flex items-center gap-1.5 min-w-0">
                  <CheckCircle className="h-3.5 w-3.5 text-green-600 flex-shrink-0" />
                  <p className="text-xs text-green-800 truncate">{successMessage}</p>
                </div>
                <button
                  onClick={() => setSuccessMessage('')}
                  className="text-green-600 hover:text-green-800 flex-shrink-0"
                  aria-label="Close"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            </div>
          )}
          
          {error && !error.includes('Sync completed') && (
            <div className="p-1.5 bg-red-50 border border-red-200 rounded-lg">
              <div className="flex items-center justify-between gap-1.5">
                <div className="flex items-center gap-1.5 min-w-0">
                  <AlertCircle className="h-3.5 w-3.5 text-red-600 flex-shrink-0" />
                  <p className="text-xs text-red-800 truncate">{error}</p>
                </div>
                <button
                  onClick={handleRetryProducts}
                  className="flex items-center gap-1 bg-red-600 hover:bg-red-700 text-white px-1.5 py-0.5 rounded text-xs font-medium flex-shrink-0"
                >
                  <RefreshCw className="h-2.5 w-2.5" />
                  <span className="hidden xs:inline">Retry</span>
                </button>
              </div>
            </div>
          )}
        </div>
  
        {/* Stats Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-1.5 mb-3">
          <div className="theme-surface rounded-lg shadow-xs border theme-border p-1.5">
            <div className="flex items-center">
              <div className="p-0.5 bg-blue-100 rounded mr-1.5">
                <Package className="h-3 w-3 text-blue-600" />
              </div>
              <div>
                <p className="text-[10px] font-medium theme-text-muted">Products</p>
                <p className="text-xs font-bold theme-text">{totalProducts}</p>
                {viewMode === 'system' && (
                  <p className="text-[8px] theme-text-muted">All System</p>
                )}
              </div>
            </div>
          </div>

          <div className="theme-surface rounded-lg shadow-xs border theme-border p-1.5">
            <div className="flex items-center">
              <div className="p-0.5 bg-green-100 rounded mr-1.5">
                <Layers className="h-3 w-3 text-green-600" />
              </div>
              <div>
                <p className="text-[10px] font-medium theme-text-muted">Stock</p>
                <p className="text-xs font-bold theme-text">{totalStock.toLocaleString()}</p>
              </div>
            </div>
          </div>

          <div className="theme-surface rounded-lg shadow-xs border theme-border p-1.5">
            <div className="flex items-center">
              <div className="p-0.5 bg-purple-100 rounded mr-1.5">
                <DollarSign className="h-3 w-3 text-purple-600" />
              </div>
              <div>
                <p className="text-[10px] font-medium theme-text-muted">Inv. Value</p>
                <p className="text-xs font-bold theme-text">UGX {totalInventoryValue.toLocaleString()}</p>
              </div>
            </div>
          </div>

          <div className="theme-surface rounded-lg shadow-xs border theme-border p-1.5">
            <div className="flex items-center">
              <div className="p-0.5 bg-orange-100 rounded mr-1.5">
                <Receipt className="h-3 w-3 text-orange-600" />
              </div>
              <div>
                <p className="text-[10px] font-medium theme-text-muted">Today Sales</p>
                <p className="text-xs font-bold theme-text">{salesStats.todaySales}</p>
                {viewMode === 'system' && (
                  <p className="text-[8px] theme-text-muted">All System</p>
                )}
              </div>
            </div>
          </div>

          <div className="theme-surface rounded-lg shadow-xs border theme-border p-1.5">
            <div className="flex items-center">
              <div className="p-0.5 bg-red-100 rounded mr-1.5">
                <TrendingUp className="h-3 w-3 text-red-600" />
              </div>
              <div>
                <p className="text-[10px] font-medium theme-text-muted">Revenue</p>
                <p className="text-xs font-bold theme-text">UGX {salesStats.todayRevenue.toLocaleString()}</p>
              </div>
            </div>
          </div>

          <div className="theme-surface rounded-lg shadow-xs border theme-border p-1.5">
            <div className="flex items-center">
              <div className="p-0.5 bg-green-100 rounded mr-1.5">
                <DollarSign className="h-3 w-3 text-green-600" />
              </div>
              <div>
                <p className="text-[10px] font-medium theme-text-muted">Profit</p>
                <p className="text-xs font-bold theme-text">UGX {salesStats.todayProfit.toLocaleString()}</p>
              </div>
            </div>
          </div>

          <div className="theme-surface rounded-lg shadow-xs border theme-border p-1.5">
            <div className="flex items-center">
              <div className="p-0.5 bg-yellow-100 rounded mr-1.5">
                <AlertCircle className="h-3 w-3 text-yellow-600" />
              </div>
              <div>
                <p className="text-[10px] font-medium theme-text-muted">Low Stock</p>
                <p className="text-xs font-bold theme-text">{lowStockProducts}</p>
              </div>
            </div>
          </div>

          <div className="theme-surface rounded-lg shadow-xs border theme-border p-1.5">
            <div className="flex items-center">
              <div className="p-0.5 bg-red-100 rounded mr-1.5">
                <TrendingUp className="h-3 w-3 text-red-600" />
              </div>
              <div>
                <p className="text-[10px] font-medium theme-text-muted">Out of Stock</p>
                <p className="text-xs font-bold theme-text">{outOfStockProducts}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Tabs Navigation */}
        <div className="mb-3 theme-surface rounded-lg shadow-xs border theme-border overflow-hidden">
          <div className="grid grid-cols-4 gap-0">
            <button
              onClick={() => setActiveTab('products')}
              className={`flex flex-col items-center justify-center p-1.5 text-xs font-medium transition-all border-r theme-border last:border-r-0 ${
                activeTab === 'products'
                  ? 'bg-blue-50 text-blue-700'
                  : 'theme-text-muted hover:theme-text hover:theme-secondary'
              }`}
            >
              <Package className="h-3 w-3 mb-0.5" />
              <span>Products</span>
              <span className="text-[9px] theme-text-muted mt-0.25">
                {totalProducts} {viewMode === 'personal' ? '(Yours)' : '(All)'}
              </span>
            </button>
            
            <button
              onClick={() => setActiveTab('create-sale')}
              className={`flex flex-col items-center justify-center p-1.5 text-xs font-medium transition-all border-r theme-border last:border-r-0 ${
                activeTab === 'create-sale'
                  ? 'bg-green-50 text-green-700'
                  : 'theme-text-muted hover:theme-text hover:theme-secondary'
              }`}
            >
              <ShoppingCart className="h-3 w-3 mb-0.5" />
              <span>Create Sale</span>
              <span className="text-[9px] theme-text-muted mt-0.25">
                New
              </span>
            </button>
            
            <button
              onClick={() => setActiveTab('sales')}
              className={`flex flex-col items-center justify-center p-1.5 text-xs font-medium transition-all border-r theme-border last:border-r-0 ${
                activeTab === 'sales'
                  ? 'bg-orange-50 text-orange-700'
                  : 'theme-text-muted hover:theme-text hover:theme-secondary'
              }`}
            >
              <Receipt className="h-3 w-3 mb-0.5" />
              <span>Sales</span>
              <span className="text-[9px] theme-text-muted mt-0.25">
                {salesStats.totalSales} {viewMode === 'personal' ? '(Yours)' : '(All)'}
              </span>
            </button>
            
            <button
              onClick={() => setActiveTab('analytics')}
              className={`flex flex-col items-center justify-center p-1.5 text-xs font-medium transition-all border-r theme-border last:border-r-0 ${
                activeTab === 'analytics'
                  ? 'bg-purple-50 text-purple-700'
                  : 'theme-text-muted hover:theme-text hover:theme-secondary'
              }`}
            >
              <BarChart3 className="h-3 w-3 mb-0.5" />
              <span>Analytics</span>
              <span className="text-[9px] theme-text-muted mt-0.25">
                {viewMode === 'personal' ? 'My' : 'System'}
              </span>
            </button>
          </div>
        </div>

        {/* Tab Content */}
        <div>
          {activeTab === 'products' && (
            <ProductManagementTab 
              user={user} 
              onLogout={handleAdminLogout} 
              initialProducts={products}
              onProductsUpdate={fetchProducts}
              productsLoading={productsLoading}
              isOnline={isOnline}
              onSync={handleSyncWithBackend}
              recentlyUpdatedProducts={recentlyUpdatedProducts}
              viewMode={viewMode}
              isAdmin={isAdmin}
            />
          )}
          {activeTab === 'create-sale' && (
            <CreateSaleTab 
              products={products}
              productsLoading={productsLoading}
              onProductsRefresh={fetchProducts}
              onSaleCreated={handleSaleCreated}
              isOnline={isOnline}
              user={user}
              recentlyUpdatedProducts={recentlyUpdatedProducts}
              viewMode={viewMode}
            />
          )}
          {activeTab === 'sales' && (
            <SalesTab 
              user={user}
              onSalesUpdate={() => {
                refreshSalesStats();
                loadOfflineStats();
              }}
              isOnline={isOnline}
              viewMode={viewMode}
              isAdmin={isAdmin}
            />
          )}
          {activeTab === 'analytics' && (
            <AnalyticsTab 
              user={user}
              onDataRefresh={() => {
                fetchProducts(true);
                refreshSalesStats();
                loadOfflineStats();
              }}
              isOnline={isOnline}
              viewMode={viewMode}
              isAdmin={isAdmin}
            />
          )}
        </div>
      </div>
    </div>
  );
};

export default Admin;