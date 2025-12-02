import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { authAPI, productsAPI, salesAPI } from '../services/api';
import LocalStorageService from '../services/localStorageService';
import { 
  Package, ShoppingCart, Users, DollarSign, AlertCircle, LogOut, Lock, Mail, 
  Shield, TrendingUp, Receipt, BarChart3, RefreshCw, Cloud, CloudOff,
  Database, WifiOff, CheckCircle, Clock
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
    averageSale: 0
  });
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [syncing, setSyncing] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  
  // New offline tracking states
  const [offlineSalesCount, setOfflineSalesCount] = useState(0);
  const [pendingSyncCount, setPendingSyncCount] = useState(0);
  const [lastSyncTime, setLastSyncTime] = useState(null);
  const [autoSyncStatus, setAutoSyncStatus] = useState('');
  
  const hasFetchedRef = useRef(false);
  const isMountedRef = useRef(false);

  // Network status monitoring
  useEffect(() => {
    const handleOnline = () => {
      console.log('🌐 Device is online');
      setIsOnline(true);
    };

    const handleOffline = () => {
      console.log('📵 Device is offline');
      setIsOnline(false);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
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
    } catch (error) {
      console.error('Error loading offline stats:', error);
    }
  }, [isLoggedIn, user]);

  // Auto-refresh offline stats
  useEffect(() => {
    if (isLoggedIn && user?.role === 'admin') {
      loadOfflineStats();
      
      // Auto-refresh every 30 seconds
      const interval = setInterval(loadOfflineStats, 30000);
      
      // Auto-sync when online
      const handleOnlineSync = () => {
        console.log('🌐 Internet restored - checking for pending sync');
        if (offlineSalesCount > 0 || pendingSyncCount > 0) {
          setAutoSyncStatus('Network restored, syncing...');
          handleSyncWithBackend();
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
      const interval = setInterval(() => {
        const sales = LocalStorageService.getSales();
        const pendingSales = sales.filter(s => s.isLocal && !s.synced);
        
        if (pendingSales.length > 0) {
          console.log('🔄 Auto-sync triggered');
          setAutoSyncStatus('Auto-syncing pending sales...');
          handleSyncWithBackend();
        }
      }, 5 * 60 * 1000); // 5 minutes
      
      return () => clearInterval(interval);
    }
  }, [isOnline, isLoggedIn, user]);

  // Initialize from local storage
  const initializeFromLocal = useCallback(async () => {
    console.log('📱 Initializing from local storage...');
    
    try {
      // Load products from local storage
      const localProducts = LocalStorageService.getProducts();
      console.log(`📦 Loaded ${localProducts.length} products from local storage`);
      
      if (localProducts.length > 0) {
        setProducts(localProducts);
      }
      
      // Load sales stats from local storage
      const localStats = LocalStorageService.getProductStats();
      if (localStats) {
        setSalesStats(prev => ({
          ...prev,
          totalSales: localStats.totalSold || 0,
          totalRevenue: localStats.totalRevenue || 0,
          totalProfit: (localStats.totalRevenue - (localStats.totalValue || 0)) || 0,
          totalItemsSold: localStats.totalSold || 0,
          averageSale: localStats.totalRevenue > 0 && localStats.totalSold > 0 
            ? localStats.totalRevenue / localStats.totalSold 
            : 0
        }));
      }
      
      // Load offline stats
      loadOfflineStats();
      
      return { success: true, products: localProducts.length };
    } catch (error) {
      console.error('❌ Failed to initialize from local storage:', error);
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
    setAutoSyncStatus('');
    
    try {
      const syncResult = await LocalStorageService.syncWithBackend(productsAPI);
      
      if (syncResult.success) {
        console.log('✅ Sync successful:', syncResult);
        
        // Update states
        setOfflineSalesCount(prev => prev - syncResult.sales.synced);
        setPendingSyncCount(prev => prev - syncResult.totalSynced);
        
        const now = new Date();
        setLastSyncTime(now);
        localStorage.setItem('electroshop_last_sync', now.toISOString());
        
        // Refresh data
        hasFetchedRef.current = false;
        await fetchProducts();
        await fetchSalesStats();
        
        // Show success message
        setSuccessMessage(`✅ Sync completed: ${syncResult.totalSynced} items synced`);
        setTimeout(() => setSuccessMessage(''), 5000);
        
      } else {
        setError(`❌ Sync failed: ${syncResult.message}`);
      }
    } catch (error) {
      console.error('❌ Sync error:', error);
      setError(`Sync error: ${error.message}`);
      setAutoSyncStatus('Auto-sync failed');
    } finally {
      setSyncing(false);
      setAutoSyncStatus('');
      // Refresh offline stats after sync
      loadOfflineStats();
    }
  };

  // Fetch products with offline fallback
  const fetchProducts = useCallback(async () => {
    if (hasFetchedRef.current) return;

    hasFetchedRef.current = true;
    setProductsLoading(true);
    setError('');
    
    try {
      if (isOnline) {
        // Try to fetch from backend
        console.log('🌐 Fetching products from backend...');
        const response = await productsAPI.getProducts({ limit: 100 });
        
        if (!isMountedRef.current) return;
        
        if (response.data && response.data.products) {
          const backendProducts = response.data.products;
          
          // Merge with local products
          const localProducts = LocalStorageService.getProducts();
          const mergedProducts = backendProducts.map(backendProduct => {
            const localProduct = localProducts.find(p => 
              !p.isLocal && p._id === backendProduct._id
            );
            
            if (localProduct) {
              // Merge with local data
              return {
                ...backendProduct,
                stock: localProduct.stock, // Prefer local stock
                totalSold: localProduct.totalSold,
                stockHistory: [
                  ...backendProduct.stockHistory || [],
                  ...localProduct.stockHistory || []
                ].sort((a, b) => new Date(b.date) - new Date(a.date))
              };
            }
            
            return backendProduct;
          });
          
          // Add local-only products
          const localOnlyProducts = localProducts.filter(p => p.isLocal);
          const allProducts = [...mergedProducts, ...localOnlyProducts];
          
          setProducts(allProducts);
          LocalStorageService.saveProducts(allProducts);
          console.log(`✅ Loaded ${allProducts.length} products`);
        }
      } else {
        // Offline mode: load from local storage
        console.log('📱 Offline mode: loading products from local storage');
        const localProducts = LocalStorageService.getProducts();
        setProducts(localProducts);
        console.log(`✅ Loaded ${localProducts.length} products from local storage`);
      }
      
    } catch (error) {
      hasFetchedRef.current = false;
      
      if (!isMountedRef.current) return;
      
      // Fallback to local storage on error
      console.log('🔄 Falling back to local storage due to error:', error.message);
      const localProducts = LocalStorageService.getProducts();
      setProducts(localProducts);
      
      if (error.code === 'ECONNABORTED') {
        setError('Backend server is not responding. Working in offline mode.');
      } else if (!error.response) {
        setError('Cannot connect to backend server. Working in offline mode.');
      } else {
        setError(`Failed to load products. Using local data (${localProducts.length} products).`);
      }
    } finally {
      if (isMountedRef.current) {
        setProductsLoading(false);
      }
    }
  }, [isOnline]);

  const fetchSalesStats = useCallback(async () => {
    try {
      if (isOnline) {
        const response = await salesAPI.getSalesStats({ period: 'today' });
        if (response.data && response.data.stats) {
          setSalesStats(response.data.stats);
        }
      } else {
        // Calculate from local data
        const localStats = LocalStorageService.getProductStats();
        if (localStats) {
          setSalesStats(prev => ({
            ...prev,
            totalSales: localStats.totalSold || 0,
            totalRevenue: localStats.totalRevenue || 0,
            totalProfit: (localStats.totalRevenue - (localStats.totalValue || 0)) || 0,
            totalItemsSold: localStats.totalSold || 0,
            averageSale: localStats.totalRevenue > 0 && localStats.totalSold > 0 
              ? localStats.totalRevenue / localStats.totalSold 
              : 0
          }));
        }
      }
    } catch (error) {
      console.error('Error fetching sales stats:', error.message);
      // Fallback to local calculation
      const localStats = LocalStorageService.getProductStats();
      if (localStats) {
        setSalesStats(prev => ({
          ...prev,
          totalSales: localStats.totalSold || 0,
          totalRevenue: localStats.totalRevenue || 0
        }));
      }
    }
  }, [isOnline]);

  useEffect(() => {
    isMountedRef.current = true;
    
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    if (user && user.role === 'admin') {
      setIsLoggedIn(true);
      
      // Initialize from local storage first (fast)
      initializeFromLocal();
      
      // Then try to fetch from backend if online
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
    await fetchProducts();
  }, [fetchProducts]);

  const refreshSalesStats = useCallback(async () => {
    await fetchSalesStats();
  }, [fetchSalesStats]);

  // Calculate totals from products
  const totalProducts = products.length;
  const totalStock = products.reduce((sum, product) => sum + (product.stock || 0), 0);
  const totalInventoryValue = products.reduce((sum, product) => sum + ((product.purchasePrice || 0) * (product.stock || 0)), 0);

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
      
      // Initialize data after login
      await initializeFromLocal();
      await fetchProducts();
      await fetchSalesStats();
      
    } catch (err) {
      // Even if login fails, allow offline admin access for demo
      console.log('Login failed, using offline mode:', err.message);
      
      // For demo purposes, create a mock admin user for offline access
      const offlineAdmin = {
        _id: 'offline_admin',
        name: 'Offline Admin',
        email: 'admin@offline.com',
        role: 'admin'
      };
      
      login(offlineAdmin, 'offline_token');
      setIsLoggedIn(true);
      
      // Initialize from local storage
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

  if (!isLoggedIn) {
    return (
      <div className="min-h-screen theme-bg flex items-center justify-center py-8 px-4">
        <div className="max-w-md w-full space-y-6">
          <div>
            <div className="mx-auto h-10 w-10 bg-red-600 rounded-lg flex items-center justify-center">
              <Shield className="h-5 w-5 text-white" />
            </div>
            <h2 className="mt-4 text-center text-2xl font-bold theme-text">
              Admin Login
            </h2>
            <p className="mt-1 text-center text-xs theme-text-muted">
              {!isOnline && '⚠️ You are currently offline'}
            </p>
          </div>

          <form className="mt-6 space-y-4" onSubmit={handleAdminLogin}>
            {error && (
              <div className={`px-3 py-2 rounded text-xs ${
                error.includes('offline') 
                  ? 'bg-yellow-50 border border-yellow-200 text-yellow-600'
                  : 'bg-red-50 border border-red-200 text-red-600'
              }`}>
                {error}
              </div>
            )}

            <div className="space-y-3">
              <div>
                <div className="relative">
                  <Mail className="absolute left-2 top-2 h-4 w-4 theme-text-muted" />
                  <input
                    type="email"
                    required
                    value={adminLogin.email}
                    onChange={(e) => setAdminLogin(prev => ({ ...prev, email: e.target.value }))}
                    className="pl-8 w-full px-2 py-1.5 theme-border border rounded text-sm focus:outline-none focus:ring-1 focus:ring-red-500 theme-surface theme-text placeholder-theme-text-muted"
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
                    className="pl-8 w-full px-2 py-1.5 theme-border border rounded text-sm focus:outline-none focus:ring-1 focus:ring-red-500 theme-surface theme-text placeholder-theme-text-muted"
                    placeholder="Password"
                  />
                </div>
              </div>
            </div>

            <div>
              <button
                type="submit"
                disabled={loginLoading}
                className="w-full py-1.5 px-4 border border-transparent text-sm rounded text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-1 focus:ring-red-500 disabled:opacity-50"
              >
                {loginLoading ? 'Signing in...' : 'Sign in'}
              </button>
            </div>

            <div className="text-center">
              <button
                type="button"
                onClick={() => navigate('/')}
                className="text-xs theme-primary-text hover:opacity-80"
              >
                ← Back to Store
              </button>
            </div>
          </form>

          <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded text-xs">
            <h3 className="font-medium text-yellow-800 mb-1">Demo Admin:</h3>
            <div className="text-yellow-700 space-y-0.5">
              <p><strong>Email:</strong> admin@electronics.com</p>
              <p><strong>Password:</strong> admin123</p>
            </div>
          </div>
          
          {!isOnline && (
            <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded text-xs">
              <div className="flex items-center gap-2 mb-1">
                <CloudOff className="h-4 w-4 text-blue-600" />
                <h3 className="font-medium text-blue-800">Offline Mode</h3>
              </div>
              <p className="text-blue-700">You are currently offline. You can still login and work with locally stored data.</p>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen theme-bg">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
        {/* Header */}
        <div className="mb-4 flex justify-between items-center">
          <div>
            <h1 className="text-xl font-bold theme-text">Admin Dashboard</h1>
            <p className="theme-text-muted text-xs">Manage products, sales, and analytics</p>
            <div className="flex items-center gap-2 mt-1">
              {isOnline ? (
                <span className="flex items-center gap-1 text-xs text-green-600">
                  <Cloud className="h-3 w-3" />
                  Online
                </span>
              ) : (
                <span className="flex items-center gap-1 text-xs text-yellow-600">
                  <CloudOff className="h-3 w-3" />
                  Offline
                </span>
              )}
              {lastSyncTime && (
                <span className="flex items-center gap-1 text-xs theme-text-muted">
                  <Clock className="h-3 w-3" />
                  Last sync: {lastSyncTime.toLocaleTimeString()}
                </span>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            {isOnline && (
              <button
                onClick={handleSyncWithBackend}
                disabled={syncing}
                className="flex items-center gap-1 bg-green-600 hover:bg-green-700 text-white px-2 py-1 rounded text-xs disabled:opacity-50"
              >
                <RefreshCw className={`h-3 w-3 ${syncing ? 'animate-spin' : ''}`} />
                {syncing ? 'Syncing...' : 'Sync Now'}
              </button>
            )}
            <div className="text-right">
              <p className="theme-text font-medium text-xs">{user.name}</p>
              <p className="text-xs theme-text-muted flex items-center gap-1">
                <Shield className="h-3 w-3 text-red-600" />
                Admin
              </p>
            </div>
            <button
              onClick={handleAdminLogout}
              className="flex items-center gap-1 bg-red-600 hover:bg-red-700 text-white px-2 py-1 rounded text-xs"
            >
              <LogOut className="h-3 w-3" />
              Logout
            </button>
          </div>
        </div>

        {/* Sync Status Bar */}
        <div className="mb-3 flex flex-wrap gap-2">
          {!isOnline && (
            <div className="flex-1 min-w-[200px] p-2 bg-yellow-50 border border-yellow-200 rounded flex items-center justify-between text-xs">
              <div className="flex items-center gap-1">
                <CloudOff className="h-3 w-3 text-yellow-600" />
                <p className="text-yellow-700">You are offline. Changes will be saved locally and synced when back online.</p>
              </div>
              <span className="text-yellow-600 font-medium">Offline Mode</span>
            </div>
          )}
          
          {/* Offline Sales Indicator */}
          {(offlineSalesCount > 0 || pendingSyncCount > 0) && (
            <div className="flex items-center gap-2 p-2 bg-blue-50 border border-blue-200 rounded text-xs">
              <Database className="h-3 w-3 text-blue-600" />
              <div>
                <span className="font-medium text-blue-700">{offlineSalesCount} offline sales</span>
                <span className="text-blue-600 mx-1">•</span>
                <span className="text-blue-600">{pendingSyncCount} pending sync</span>
                {isOnline && (
                  <span className="ml-2 text-xs text-blue-500">
                    (Auto-syncs every 5 minutes)
                  </span>
                )}
              </div>
              {isOnline && !syncing && (
                <button
                  onClick={handleSyncWithBackend}
                  className="ml-2 bg-blue-600 hover:bg-blue-700 text-white px-2 py-0.5 rounded text-xs"
                >
                  Sync Now
                </button>
              )}
            </div>
          )}

          {/* Auto-sync Status */}
          {autoSyncStatus && (
            <div className="flex items-center gap-2 p-2 bg-purple-50 border border-purple-200 rounded text-xs">
              <RefreshCw className="h-3 w-3 text-purple-600 animate-spin" />
              <span className="text-purple-700">{autoSyncStatus}</span>
            </div>
          )}
        </div>

        {/* Error Alert */}
        {error && !error.includes('Sync completed') && (
          <div className="mb-3 p-2 bg-red-50 border border-red-200 rounded flex items-center justify-between text-xs">
            <div className="flex items-center gap-1">
              <AlertCircle className="h-3 w-3 text-red-600" />
              <p className="text-red-700">{error}</p>
            </div>
            <button
              onClick={handleRetryProducts}
              className="bg-red-600 hover:bg-red-700 text-white px-2 py-0.5 rounded flex items-center gap-1"
            >
              <TrendingUp className="h-3 w-3" />
              Retry
            </button>
          </div>
        )}

        {/* Sync Success Message */}
        {successMessage && (
          <div className="mb-3 p-2 bg-green-50 border border-green-200 rounded flex items-center justify-between text-xs">
            <div className="flex items-center gap-1">
              <CheckCircle className="h-3 w-3 text-green-600" />
              <p className="text-green-700">{successMessage}</p>
            </div>
            <button
              onClick={() => setSuccessMessage('')}
              className="text-green-600 hover:text-green-800"
            >
              ×
            </button>
          </div>
        )}

        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2 mb-4">
          <div className="theme-surface rounded p-2 shadow-sm">
            <div className="flex items-center">
              <div className="p-1 bg-blue-100 rounded mr-2">
                <Package className="h-3 w-3 text-blue-600" />
              </div>
              <div>
                <p className="text-xs theme-text-muted">Products</p>
                <p className="text-sm font-bold theme-text">{totalProducts}</p>
              </div>
            </div>
          </div>

          <div className="theme-surface rounded p-2 shadow-sm">
            <div className="flex items-center">
              <div className="p-1 bg-green-100 rounded mr-2">
                <Users className="h-3 w-3 text-green-600" />
              </div>
              <div>
                <p className="text-xs theme-text-muted">Stock</p>
                <p className="text-sm font-bold theme-text">{totalStock}</p>
              </div>
            </div>
          </div>

          <div className="theme-surface rounded p-2 shadow-sm">
            <div className="flex items-center">
              <div className="p-1 bg-purple-100 rounded mr-2">
                <DollarSign className="h-3 w-3 text-purple-600" />
              </div>
              <div>
                <p className="text-xs theme-text-muted">Inv. Value</p>
                <p className="text-sm font-bold theme-text">UGX {totalInventoryValue.toLocaleString()}</p>
              </div>
            </div>
          </div>

          <div className="theme-surface rounded p-2 shadow-sm">
            <div className="flex items-center">
              <div className="p-1 bg-orange-100 rounded mr-2">
                <Receipt className="h-3 w-3 text-orange-600" />
              </div>
              <div>
                <p className="text-xs theme-text-muted">Today Sales</p>
                <p className="text-sm font-bold theme-text">{salesStats.totalSales}</p>
              </div>
            </div>
          </div>

          <div className="theme-surface rounded p-2 shadow-sm">
            <div className="flex items-center">
              <div className="p-1 bg-red-100 rounded mr-2">
                <TrendingUp className="h-3 w-3 text-red-600" />
              </div>
              <div>
                <p className="text-xs theme-text-muted">Revenue</p>
                <p className="text-sm font-bold theme-text">UGX {salesStats.totalRevenue.toLocaleString()}</p>
              </div>
            </div>
          </div>

          <div className="theme-surface rounded p-2 shadow-sm">
            <div className="flex items-center">
              <div className="p-1 bg-green-100 rounded mr-2">
                <DollarSign className="h-3 w-3 text-green-600" />
              </div>
              <div>
                <p className="text-xs theme-text-muted">Profit</p>
                <p className="text-sm font-bold theme-text">UGX {salesStats.totalProfit.toLocaleString()}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Tabs Navigation */}
        <div className="mb-4">
          <div className="flex border-b theme-border text-xs">
            <button
              onClick={() => setActiveTab('products')}
              className={`flex items-center gap-1 px-3 py-1.5 border-b-2 font-medium ${
                activeTab === 'products'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent theme-text-muted hover:theme-text'
              }`}
            >
              <Package className="h-3 w-3" />
              Products
            </button>
            <button
              onClick={() => setActiveTab('create-sale')}
              className={`flex items-center gap-1 px-3 py-1.5 border-b-2 font-medium ${
                activeTab === 'create-sale'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent theme-text-muted hover:theme-text'
              }`}
            >
              <ShoppingCart className="h-3 w-3" />
              Create Sale
            </button>
            <button
              onClick={() => setActiveTab('sales')}
              className={`flex items-center gap-1 px-3 py-1.5 border-b-2 font-medium ${
                activeTab === 'sales'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent theme-text-muted hover:theme-text'
              }`}
            >
              <Receipt className="h-3 w-3" />
              Sales
            </button>
            <button
              onClick={() => setActiveTab('analytics')}
              className={`flex items-center gap-1 px-3 py-1.5 border-b-2 font-medium ${
                activeTab === 'analytics'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent theme-text-muted hover:theme-text'
              }`}
            >
              <BarChart3 className="h-3 w-3" />
              Analytics
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
              onProductsUpdate={refreshProducts}
              productsLoading={productsLoading}
              isOnline={isOnline}
              onSync={handleSyncWithBackend}
            />
          )}
          {activeTab === 'create-sale' && (
            <CreateSaleTab 
              products={products}
              productsLoading={productsLoading}
              onProductsRefresh={refreshProducts}
              onSaleCreated={() => {
                refreshSalesStats();
                loadOfflineStats(); // Update offline stats
              }}
              isOnline={isOnline}
              user={user} // Pass user to CreateSaleTab
            />
          )}
          {activeTab === 'sales' && (
            <SalesTab 
              user={user}
              onSalesUpdate={() => {
                refreshSalesStats();
                loadOfflineStats(); // Update offline stats
              }}
              isOnline={isOnline}
            />
          )}
          {activeTab === 'analytics' && (
            <AnalyticsTab 
              user={user}
              onDataRefresh={() => {
                refreshProducts();
                refreshSalesStats();
                loadOfflineStats(); // Update offline stats
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