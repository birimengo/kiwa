import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { authAPI, productsAPI, salesAPI } from '../services/api';
import LocalStorageService from '../services/localStorageService';
import { 
  Package, ShoppingCart, Users, DollarSign, AlertCircle, LogOut, Lock, Mail, 
  Shield, TrendingUp, Receipt, BarChart3, RefreshCw, Cloud, CloudOff,
  Database, CheckCircle, Clock, Home, Eye, Download, Upload, 
  HardDrive, X, Activity, Layers
} from 'lucide-react';
import ProductManagementTab from '../components/AdminTabs/ProductManagementTab';
import CreateSaleTab from '../components/AdminTabs/CreateSaleTab';
import SalesTab from '../components/AdminTabs/SalesTab';
import AnalyticsTab from '../components/AdminTabs/AnalyticsTab';

const Admin = () => {
  const { user, login, logout } = useAuth();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('products');
  const [adminLogin, setAdminLogin] = useState({
    email: '',
    password: ''
  });
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
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [syncing, setSyncing] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [showSyncDetails, setShowSyncDetails] = useState(false);
  const [offlineSalesCount, setOfflineSalesCount] = useState(0);
  const [pendingSyncCount, setPendingSyncCount] = useState(0);
  const [lastSyncTime, setLastSyncTime] = useState(null);
  const [autoSyncStatus, setAutoSyncStatus] = useState('');
  const [storageInfo, setStorageInfo] = useState(null);
  const [recentlyUpdatedProducts, setRecentlyUpdatedProducts] = useState(new Set());
  
  const hasFetchedRef = useRef(false);
  const isMountedRef = useRef(false);
  const syncIntervalRef = useRef(null);
  const statsIntervalRef = useRef(null);
  const refreshTimeoutRef = useRef(null);

  // Network status monitoring
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

  // Load storage info
  const loadStorageInfo = useCallback(() => {
    try {
      const info = LocalStorageService.getStorageInfo();
      setStorageInfo(info);
    } catch (error) {
      console.error('Error loading storage info:', error);
    }
  }, []);

  // Load offline sales tracking
  const loadOfflineStats = useCallback(() => {
    if (!isLoggedIn || user?.role !== 'admin') return;
    
    try {
      const sales = LocalStorageService.getSales();
      const offlineSales = sales.filter(s => s.isLocal && !s.synced);
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
  }, [isLoggedIn, user, loadStorageInfo]);

  // Fetch sales stats
  const fetchSalesStats = useCallback(async () => {
    try {
      if (isOnline) {
        const response = await salesAPI.getSalesStats({ period: 'today' });
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
        const localStats = LocalStorageService.getSalesStats('today');
        if (localStats) {
          setSalesStats(prev => ({
            ...prev,
            totalSales: localStats.totalSales || 0,
            totalRevenue: localStats.totalRevenue || 0,
            totalProfit: localStats.totalProfit || 0,
            totalItemsSold: localStats.totalItemsSold || 0,
            averageSale: localStats.averageSale || 0,
            todaySales: localStats.totalSales || 0,
            todayRevenue: localStats.totalRevenue || 0,
            todayProfit: localStats.totalProfit || 0
          }));
        }
      }
    } catch (error) {
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
  }, [isOnline]);

  // Fetch products with offline fallback
  const fetchProducts = useCallback(async (force = false) => {
    if (!force && hasFetchedRef.current && !productsLoading) return;

    hasFetchedRef.current = true;
    setProductsLoading(true);
    setError('');
    
    try {
      if (isOnline) {
        const response = await productsAPI.getProducts({ limit: 200 });
        
        if (!isMountedRef.current) return;
        
        if (response.data && response.data.products) {
          const backendProducts = response.data.products;
          
          const localProducts = LocalStorageService.getProducts();
          const mergedProducts = backendProducts.map(backendProduct => {
            const localProduct = localProducts.find(p => 
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
          
          const localOnlyProducts = localProducts.filter(p => p.isLocal);
          const allProducts = [...mergedProducts, ...localOnlyProducts];
          
          setProducts(allProducts);
          LocalStorageService.saveProducts(allProducts);
          
          window.dispatchEvent(new CustomEvent('productsLoaded', {
            detail: { products: allProducts, timestamp: new Date().toISOString() }
          }));
        }
      } else {
        const localProducts = LocalStorageService.getProducts();
        setProducts(localProducts);
        
        window.dispatchEvent(new CustomEvent('productsLoaded', {
          detail: { products: localProducts, timestamp: new Date().toISOString() }
        }));
      }
      
    } catch (error) {
      hasFetchedRef.current = false;
      
      if (!isMountedRef.current) return;
      
      const localProducts = LocalStorageService.getProducts();
      setProducts(localProducts);
      
      if (error.code === 'ECONNABORTED') {
        setError('Backend server is not responding. Working in offline mode.');
      } else if (!error.response) {
        setError('Cannot connect to backend server. Working in offline mode.');
      } else {
        setError(`Failed to load products. Using local data (${localProducts.length} products).`);
      }
      
      window.dispatchEvent(new CustomEvent('productsLoaded', {
        detail: { products: localProducts, timestamp: new Date().toISOString() }
      }));
    } finally {
      if (isMountedRef.current) {
        setProductsLoading(false);
      }
    }
  }, [isOnline]);

  // Clear recently updated products after 3 seconds
  useEffect(() => {
    if (recentlyUpdatedProducts.size > 0) {
      const timer = setTimeout(() => {
        setRecentlyUpdatedProducts(new Set());
      }, 3000);
      
      return () => clearTimeout(timer);
    }
  }, [recentlyUpdatedProducts]);

  // Listen for product updates
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
        setProducts(event.detail.products);
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

    window.addEventListener('productsStockUpdated', handleProductsStockUpdated);
    window.addEventListener('productUpdated', handleProductUpdated);
    window.addEventListener('forceProductRefresh', handleForceProductRefresh);
    window.addEventListener('productsSavedToLocalStorage', handleProductsSavedToLocalStorage);
    window.addEventListener('offlineSaleCreated', handleOfflineSaleCreated);
    
    return () => {
      window.removeEventListener('productsStockUpdated', handleProductsStockUpdated);
      window.removeEventListener('productUpdated', handleProductUpdated);
      window.removeEventListener('forceProductRefresh', handleForceProductRefresh);
      window.removeEventListener('productsSavedToLocalStorage', handleProductsSavedToLocalStorage);
      window.removeEventListener('offlineSaleCreated', handleOfflineSaleCreated);
    };
  }, [fetchProducts, fetchSalesStats, loadOfflineStats]);

  // Auto-refresh offline stats
  useEffect(() => {
    if (isLoggedIn && user?.role === 'admin') {
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
  }, [isLoggedIn, user, offlineSalesCount, pendingSyncCount, loadOfflineStats]);

  // Auto-sync every 5 minutes when online
  useEffect(() => {
    if (isOnline && isLoggedIn && user?.role === 'admin') {
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
  }, [isOnline, isLoggedIn, user]);

  // Auto-refresh stats every minute
  useEffect(() => {
    if (isLoggedIn && user?.role === 'admin') {
      if (statsIntervalRef.current) clearInterval(statsIntervalRef.current);
      
      statsIntervalRef.current = setInterval(() => {
        fetchSalesStats();
        loadOfflineStats();
      }, 60000);
      
      return () => {
        if (statsIntervalRef.current) clearInterval(statsIntervalRef.current);
      };
    }
  }, [isLoggedIn, user, fetchSalesStats, loadOfflineStats]);

  // Initialize from local storage
  const initializeFromLocal = useCallback(async () => {
    try {
      const localProducts = LocalStorageService.getProducts();
      
      if (localProducts.length > 0) {
        setProducts(localProducts);
      }
      
      const localStats = LocalStorageService.getSalesStats('today');
      if (localStats) {
        setSalesStats(prev => ({
          ...prev,
          totalSales: localStats.totalSales || 0,
          totalRevenue: localStats.totalRevenue || 0,
          totalProfit: localStats.totalProfit || 0,
          totalItemsSold: localStats.totalItemsSold || 0,
          averageSale: localStats.averageSale || 0,
          todaySales: localStats.totalSales || 0,
          todayRevenue: localStats.totalRevenue || 0,
          todayProfit: localStats.totalProfit || 0
        }));
      }
      
      loadOfflineStats();
      
      return { success: true, products: localProducts.length };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }, [loadOfflineStats]);

  // Enhanced sync function
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
      const syncResult = await LocalStorageService.syncWithBackend(productsAPI);
      
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

  // Listen for sale created events
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
    if (user && user.role === 'admin') {
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
  }, [user, products.length, fetchProducts, fetchSalesStats, initializeFromLocal]);

  const refreshProducts = useCallback(async () => {
    hasFetchedRef.current = false;
    await fetchProducts(true);
  }, [fetchProducts]);

  const refreshSalesStats = useCallback(async () => {
    await fetchSalesStats();
  }, [fetchSalesStats]);

  // Enhanced sale creation handler
  const handleSaleCreated = useCallback(async () => {
    await fetchSalesStats();
    loadOfflineStats();
    
    hasFetchedRef.current = false;
    await fetchProducts(true);
    
    window.dispatchEvent(new CustomEvent('globalSaleCreated', {
      detail: { timestamp: new Date().toISOString() }
    }));
  }, [fetchSalesStats, loadOfflineStats, fetchProducts]);

  // Calculate totals
  const totalProducts = products.length;
  const totalStock = products.reduce((sum, product) => sum + (product.stock || 0), 0);
  const totalInventoryValue = products.reduce((sum, product) => sum + ((product.purchasePrice || 0) * (product.stock || 0)), 0);
  const lowStockProducts = products.filter(p => p.stock > 0 && p.stock <= (p.lowStockAlert || 5)).length;
  const outOfStockProducts = products.filter(p => (p.stock || 0) <= 0).length;

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
    navigate('/');
  };

  const handleRetryProducts = () => {
    refreshProducts();
  };

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

  // Login screen
  if (!isLoggedIn) {
    return (
      <div className="min-h-screen theme-bg flex items-center justify-center p-4">
        <div className="w-full max-w-sm space-y-5">
          <div className="text-center">
            <div className="mx-auto h-12 w-12 bg-red-600 rounded-lg flex items-center justify-center">
              <Shield className="h-6 w-6 text-white" />
            </div>
            <h2 className="mt-4 text-xl font-bold theme-text">
              Admin Login
            </h2>
            <p className="mt-1 text-xs theme-text-muted">
              {!isOnline && '⚠️ You are currently offline'}
            </p>
          </div>

          <form onSubmit={handleAdminLogin} className="space-y-3">
            {error && (
              <div className={`px-3 py-2 rounded text-xs ${
                error.includes('offline') || error.includes('Using offline')
                  ? 'bg-yellow-50 border border-yellow-200 text-yellow-600'
                  : 'bg-red-50 border border-red-200 text-red-600'
              }`}>
                {error}
              </div>
            )}

            <div className="space-y-2">
              <div>
                <div className="relative">
                  <Mail className="absolute left-2 top-2 h-4 w-4 theme-text-muted" />
                  <input
                    type="email"
                    required
                    value={adminLogin.email}
                    onChange={(e) => setAdminLogin(prev => ({ ...prev, email: e.target.value }))}
                    className="pl-8 w-full px-2 py-2 theme-border border rounded text-sm focus:outline-none focus:ring-1 focus:ring-red-500 theme-surface theme-text placeholder-theme-text-muted"
                    placeholder="Admin email"
                  />
                </div>
              </div>

              <div>
                <div className="relative">
                  <Lock className="absolute left-2 top-2 h-4 w-4 theme-text-muted" />
                  <input
                    type="password"
                    required
                    value={adminLogin.password}
                    onChange={(e) => setAdminLogin(prev => ({ ...prev, password: e.target.value }))}
                    className="pl-8 w-full px-2 py-2 theme-border border rounded text-sm focus:outline-none focus:ring-1 focus:ring-red-500 theme-surface theme-text placeholder-theme-text-muted"
                    placeholder="Password"
                  />
                </div>
              </div>
            </div>

            <button
              type="submit"
              disabled={loginLoading}
              className="w-full py-2 px-4 text-sm rounded text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-1 focus:ring-red-500 disabled:opacity-50 transition-colors"
            >
              {loginLoading ? 'Signing in...' : 'Sign in'}
            </button>

            <button
              type="button"
              onClick={() => navigate('/')}
              className="w-full flex items-center justify-center gap-1.5 text-xs theme-primary-text hover:opacity-80 transition-colors"
            >
              <Home className="h-3.5 w-3.5" />
              Back to Store
            </button>
          </form>

          <div className="p-3 bg-yellow-50 border border-yellow-200 rounded text-xs">
            <h3 className="font-medium text-yellow-800 mb-1 flex items-center gap-1.5">
              <Eye className="h-3.5 w-3.5" />
              Demo Admin Credentials
            </h3>
            <div className="text-yellow-700 space-y-0.5">
              <div className="flex items-center justify-between">
                <span className="font-medium">Email:</span>
                <span className="font-mono">admin@electronics.com</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="font-medium">Password:</span>
                <span className="font-mono">admin123</span>
              </div>
            </div>
          </div>
          
          {!isOnline && (
            <div className="p-3 bg-blue-50 border border-blue-200 rounded text-xs">
              <div className="flex items-center gap-2 mb-1">
                <CloudOff className="h-4 w-4 text-blue-600" />
                <h3 className="font-medium text-blue-800">Offline Mode</h3>
              </div>
              <p className="text-blue-700">You can still login and work with locally stored data.</p>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen theme-bg">
      <div className="max-w-7xl mx-auto px-3 sm:px-4 lg:px-6 py-4">
        {/* Header - COMPACT */}
        <div className="mb-4 theme-surface rounded-lg shadow border theme-border p-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <div className="p-1.5 bg-red-600 rounded">
                <Shield className="h-4 w-4 text-white" />
              </div>
              <div>
                <h1 className="text-sm font-bold theme-text">
                  Admin Dashboard
                </h1>
                <p className="text-xs theme-text-muted">
                  Manage products, sales, and analytics • {user.name}
                </p>
              </div>
            </div>
            
            <div className="flex items-center gap-2">
              {isOnline && (
                <button
                  onClick={handleSyncWithBackend}
                  disabled={syncing || (offlineSalesCount === 0 && pendingSyncCount === 0)}
                  className="flex items-center gap-1 bg-green-600 hover:bg-green-700 text-white px-2.5 py-1.5 rounded text-xs font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <RefreshCw className={`h-3.5 w-3.5 ${syncing ? 'animate-spin' : ''}`} />
                  {syncing ? 'Syncing...' : 'Sync'}
                  {(offlineSalesCount > 0 || pendingSyncCount > 0) && (
                    <span className="bg-white/20 px-1 py-0.5 rounded text-[10px]">
                      {offlineSalesCount + pendingSyncCount}
                    </span>
                  )}
                </button>
              )}
              
              <div className="hidden sm:block text-right border-l theme-border pl-2 ml-2">
                <p className="text-xs font-medium theme-text">{user.name}</p>
                <p className="text-[10px] theme-text-muted flex items-center gap-0.5">
                  <Shield className="h-2.5 w-2.5 text-red-600" />
                  Admin
                </p>
              </div>
              
              <button
                onClick={handleAdminLogout}
                className="flex items-center gap-1 bg-red-600 hover:bg-red-700 text-white px-2.5 py-1.5 rounded text-xs font-medium transition-colors"
              >
                <LogOut className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Logout</span>
              </button>
            </div>
          </div>
          
          {/* Status Row */}
          <div className="flex flex-wrap items-center gap-1.5 mt-2">
            {isOnline ? (
              <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-green-100 text-green-800 text-[10px]">
                <Cloud className="h-2.5 w-2.5" />
                Online
              </span>
            ) : (
              <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-yellow-100 text-yellow-800 text-[10px]">
                <CloudOff className="h-2.5 w-2.5" />
                Offline
              </span>
            )}
            {lastSyncTime && (
              <span className="inline-flex items-center gap-0.5 text-[10px] theme-text-muted">
                <Clock className="h-2.5 w-2.5" />
                Sync: {formatTimeAgo(lastSyncTime)}
              </span>
            )}
            {recentlyUpdatedProducts.size > 0 && (
              <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-blue-100 text-blue-800 text-[10px] animate-pulse">
                <Activity className="h-2.5 w-2.5" />
                {recentlyUpdatedProducts.size} updated
              </span>
            )}
            {storageInfo && (
              <button
                onClick={() => setShowSyncDetails(!showSyncDetails)}
                className="inline-flex items-center gap-0.5 text-[10px] theme-text-muted hover:theme-text"
              >
                <HardDrive className="h-2.5 w-2.5" />
                {storageInfo.localStorage.usagePercent?.toFixed(1)}% used
              </button>
            )}
          </div>
        </div>

        {/* Status Alerts */}
        <div className="mb-4 space-y-2">
          {!isOnline && (
            <div className="p-2 bg-yellow-50 border border-yellow-200 rounded-lg">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <CloudOff className="h-4 w-4 text-yellow-600" />
                  <div>
                    <p className="font-medium text-yellow-800 text-xs">
                      Offline Mode Active
                    </p>
                    <p className="text-yellow-700 text-[10px]">
                      Changes saved locally, will sync when online
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}
          
          {(offlineSalesCount > 0 || pendingSyncCount > 0) && (
            <div className="p-2 bg-blue-50 border border-blue-200 rounded-lg">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Database className="h-4 w-4 text-blue-600" />
                  <div>
                    <p className="font-medium text-blue-800 text-xs">
                      Pending Sync: {offlineSalesCount} sales, {pendingSyncCount} items
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {autoSyncStatus && (
            <div className="p-2 bg-purple-50 border border-purple-200 rounded-lg">
              <div className="flex items-center gap-2">
                <RefreshCw className="h-4 w-4 text-purple-600 animate-spin" />
                <p className="text-xs text-purple-800">{autoSyncStatus}</p>
              </div>
            </div>
          )}
          
          {successMessage && (
            <div className="p-2 bg-green-50 border border-green-200 rounded-lg">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-green-600" />
                  <p className="text-xs text-green-800">{successMessage}</p>
                </div>
                <button
                  onClick={() => setSuccessMessage('')}
                  className="text-green-600 hover:text-green-800"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          )}
          
          {error && !error.includes('Sync completed') && (
            <div className="p-2 bg-red-50 border border-red-200 rounded-lg">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <AlertCircle className="h-4 w-4 text-red-600" />
                  <p className="text-xs text-red-800">{error}</p>
                </div>
                <button
                  onClick={handleRetryProducts}
                  className="flex items-center gap-1 bg-red-600 hover:bg-red-700 text-white px-2 py-1 rounded text-xs font-medium"
                >
                  <RefreshCw className="h-3 w-3" />
                  Retry
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Stats Cards - COMPACT */}
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2 mb-4">
          <div className="theme-surface rounded-lg shadow-xs border theme-border p-2">
            <div className="flex items-center">
              <div className="p-1 bg-blue-100 rounded mr-2">
                <Package className="h-3.5 w-3.5 text-blue-600" />
              </div>
              <div>
                <p className="text-[10px] font-medium theme-text-muted">Products</p>
                <p className="text-sm font-bold theme-text">{totalProducts}</p>
              </div>
            </div>
          </div>

          <div className="theme-surface rounded-lg shadow-xs border theme-border p-2">
            <div className="flex items-center">
              <div className="p-1 bg-green-100 rounded mr-2">
                <Layers className="h-3.5 w-3.5 text-green-600" />
              </div>
              <div>
                <p className="text-[10px] font-medium theme-text-muted">Stock</p>
                <p className="text-sm font-bold theme-text">{totalStock.toLocaleString()}</p>
              </div>
            </div>
          </div>

          <div className="theme-surface rounded-lg shadow-xs border theme-border p-2">
            <div className="flex items-center">
              <div className="p-1 bg-purple-100 rounded mr-2">
                <DollarSign className="h-3.5 w-3.5 text-purple-600" />
              </div>
              <div>
                <p className="text-[10px] font-medium theme-text-muted">Inv. Value</p>
                <p className="text-sm font-bold theme-text">UGX {totalInventoryValue.toLocaleString()}</p>
              </div>
            </div>
          </div>

          <div className="theme-surface rounded-lg shadow-xs border theme-border p-2">
            <div className="flex items-center">
              <div className="p-1 bg-orange-100 rounded mr-2">
                <Receipt className="h-3.5 w-3.5 text-orange-600" />
              </div>
              <div>
                <p className="text-[10px] font-medium theme-text-muted">Today Sales</p>
                <p className="text-sm font-bold theme-text">{salesStats.todaySales}</p>
              </div>
            </div>
          </div>

          <div className="theme-surface rounded-lg shadow-xs border theme-border p-2">
            <div className="flex items-center">
              <div className="p-1 bg-red-100 rounded mr-2">
                <TrendingUp className="h-3.5 w-3.5 text-red-600" />
              </div>
              <div>
                <p className="text-[10px] font-medium theme-text-muted">Revenue</p>
                <p className="text-sm font-bold theme-text">UGX {salesStats.todayRevenue.toLocaleString()}</p>
              </div>
            </div>
          </div>

          <div className="theme-surface rounded-lg shadow-xs border theme-border p-2">
            <div className="flex items-center">
              <div className="p-1 bg-green-100 rounded mr-2">
                <DollarSign className="h-3.5 w-3.5 text-green-600" />
              </div>
              <div>
                <p className="text-[10px] font-medium theme-text-muted">Profit</p>
                <p className="text-sm font-bold theme-text">UGX {salesStats.todayProfit.toLocaleString()}</p>
              </div>
            </div>
          </div>

          <div className="theme-surface rounded-lg shadow-xs border theme-border p-2">
            <div className="flex items-center">
              <div className="p-1 bg-yellow-100 rounded mr-2">
                <AlertCircle className="h-3.5 w-3.5 text-yellow-600" />
              </div>
              <div>
                <p className="text-[10px] font-medium theme-text-muted">Low Stock</p>
                <p className="text-sm font-bold theme-text">{lowStockProducts}</p>
              </div>
            </div>
          </div>

          <div className="theme-surface rounded-lg shadow-xs border theme-border p-2">
            <div className="flex items-center">
              <div className="p-1 bg-red-100 rounded mr-2">
                <TrendingUp className="h-3.5 w-3.5 text-red-600" />
              </div>
              <div>
                <p className="text-[10px] font-medium theme-text-muted">Out of Stock</p>
                <p className="text-sm font-bold theme-text">{outOfStockProducts}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Tabs Navigation - EQUALLY SPACED */}
        <div className="mb-4 theme-surface rounded-lg shadow-xs border theme-border overflow-hidden">
          <div className="grid grid-cols-2 sm:grid-cols-4">
            <button
              onClick={() => setActiveTab('products')}
              className={`flex flex-col items-center justify-center p-2 text-xs font-medium transition-all ${
                activeTab === 'products'
                  ? 'bg-blue-50 text-blue-700 border-b-2 border-blue-500'
                  : 'theme-text-muted hover:theme-text hover:theme-secondary'
              }`}
            >
              <Package className="h-3.5 w-3.5 mb-0.5" />
              Products
              <span className="text-[10px] theme-text-muted mt-0.5">
                {totalProducts}
              </span>
            </button>
            
            <button
              onClick={() => setActiveTab('create-sale')}
              className={`flex flex-col items-center justify-center p-2 text-xs font-medium transition-all ${
                activeTab === 'create-sale'
                  ? 'bg-green-50 text-green-700 border-b-2 border-green-500'
                  : 'theme-text-muted hover:theme-text hover:theme-secondary'
              }`}
            >
              <ShoppingCart className="h-3.5 w-3.5 mb-0.5" />
              Create Sale
              <span className="text-[10px] theme-text-muted mt-0.5">
                New
              </span>
            </button>
            
            <button
              onClick={() => setActiveTab('sales')}
              className={`flex flex-col items-center justify-center p-2 text-xs font-medium transition-all ${
                activeTab === 'sales'
                  ? 'bg-orange-50 text-orange-700 border-b-2 border-orange-500'
                  : 'theme-text-muted hover:theme-text hover:theme-secondary'
              }`}
            >
              <Receipt className="h-3.5 w-3.5 mb-0.5" />
              Sales
              <span className="text-[10px] theme-text-muted mt-0.5">
                {salesStats.totalSales}
              </span>
            </button>
            
            <button
              onClick={() => setActiveTab('analytics')}
              className={`flex flex-col items-center justify-center p-2 text-xs font-medium transition-all ${
                activeTab === 'analytics'
                  ? 'bg-purple-50 text-purple-700 border-b-2 border-purple-500'
                  : 'theme-text-muted hover:theme-text hover:theme-secondary'
              }`}
            >
              <BarChart3 className="h-3.5 w-3.5 mb-0.5" />
              Analytics
              <span className="text-[10px] theme-text-muted mt-0.5">
                Insights
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
            />
          )}
        </div>
      </div>
    </div>
  );
};

export default Admin;