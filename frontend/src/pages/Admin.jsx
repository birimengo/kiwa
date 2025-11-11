import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { authAPI, productsAPI, salesAPI } from '../services/api';
import { 
  Package, ShoppingCart, Users, DollarSign, AlertCircle, LogOut, Lock, Mail, 
  Shield, TrendingUp, Receipt, BarChart3
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
  
  const hasFetchedRef = React.useRef(false);
  const isMountedRef = React.useRef(false);

  const fetchProducts = useCallback(async () => {
    if (hasFetchedRef.current) return;

    hasFetchedRef.current = true;
    setProductsLoading(true);
    setError('');
    
    try {
      const response = await productsAPI.getProducts();
      
      if (!isMountedRef.current) return;
      
      if (response.data && response.data.products) {
        setProducts(response.data.products);
      } else if (response.data && Array.isArray(response.data)) {
        setProducts(response.data);
      } else {
        setProducts([]);
      }
    } catch (error) {
      hasFetchedRef.current = false;
      
      if (!isMountedRef.current) return;
      
      if (error.code === 'ECONNABORTED') {
        setError('Backend server is not responding');
      } else if (!error.response) {
        setError('Cannot connect to backend server');
      } else {
        setError('Failed to load products');
      }
      setProducts([]);
    } finally {
      if (isMountedRef.current) {
        setProductsLoading(false);
      }
    }
  }, []);

  const fetchSalesStats = useCallback(async () => {
    try {
      const response = await salesAPI.getSalesStats({ period: 'today' });
      
      if (response.data && response.data.stats) {
        setSalesStats(response.data.stats);
      }
    } catch (error) {
      console.error('Error fetching sales stats:', error.message);
    }
  }, []);

  useEffect(() => {
    isMountedRef.current = true;
    
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    if (user && user.role === 'admin') {
      setIsLoggedIn(true);
      
      if (!hasFetchedRef.current && products.length === 0) {
        fetchProducts();
      }

      fetchSalesStats();
    } else {
      setIsLoggedIn(false);
      setProducts([]);
      hasFetchedRef.current = false;
    }
  }, [user, products.length, fetchProducts, fetchSalesStats]);

  const refreshProducts = useCallback(async () => {
    hasFetchedRef.current = false;
    await fetchProducts();
  }, [fetchProducts]);

  const refreshSalesStats = useCallback(async () => {
    await fetchSalesStats();
  }, [fetchSalesStats]);

  const totalProducts = products.length;
  const totalStock = products.reduce((sum, product) => sum + (product.stock || 0), 0);
  const totalInventoryValue = products.reduce((sum, product) => sum + ((product.purchasePrice || 0) * (product.stock || 0)), 0);
  
  const calculateProfitAmount = (purchasePrice, sellingPrice) => {
    if (!purchasePrice || !sellingPrice) return 0;
    return sellingPrice - purchasePrice;
  };

  const totalPotentialProfit = products.reduce((sum, product) => sum + (calculateProfitAmount(product.purchasePrice, product.sellingPrice) * (product.stock || 0)), 0);

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
      await fetchProducts();
      await fetchSalesStats();
      
    } catch (err) {
      setError(err.response?.data?.message || 'Login failed');
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
              Restricted access
            </p>
          </div>

          <form className="mt-6 space-y-4" onSubmit={handleAdminLogin}>
            {error && (
              <div className="bg-red-50 border border-red-200 text-red-600 px-3 py-2 rounded text-xs">
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
          </div>
          <div className="flex items-center gap-2">
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

        {/* Error Alert */}
        {error && (
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
            />
          )}
          {activeTab === 'create-sale' && (
            <CreateSaleTab 
              products={products}
              productsLoading={productsLoading}
              onProductsRefresh={refreshProducts}
              onSaleCreated={refreshSalesStats}
            />
          )}
          {activeTab === 'sales' && (
            <SalesTab 
              user={user}
              onSalesUpdate={refreshSalesStats}
            />
          )}
          {activeTab === 'analytics' && (
            <AnalyticsTab 
              user={user}
              onDataRefresh={() => {
                refreshProducts();
                refreshSalesStats();
              }}
            />
          )}
        </div>
      </div>
    </div>
  );
};

export default Admin;