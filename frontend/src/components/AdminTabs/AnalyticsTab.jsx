import React, { useState, useEffect, useCallback } from 'react';
import { 
  BarChart3, 
  DollarSign, 
  Package, 
  ShoppingCart, 
  TrendingUp, 
  RefreshCw, 
  PieChart,
  BarChart,
  Eye,
  Activity,
  Search,
  Info,
  Calendar,
  Shield,
  User,
  PlusCircle,
  AlertCircle,
  Filter
} from 'lucide-react';
import { analyticsAPI, productsAPI, salesAPI } from '../../services/api';

const AnalyticsTab = ({ user, onDataRefresh }) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [timeRange, setTimeRange] = useState('week');
  const [analyticsData, setAnalyticsData] = useState(null);
  const [hasUserData, setHasUserData] = useState(false);
  const [isPersonalView, setIsPersonalView] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [stockFilter, setStockFilter] = useState('all');
  const [selectedProductDetails, setSelectedProductDetails] = useState(null);
  const [productSalesHistory, setProductSalesHistory] = useState([]);

  // Check if user has any data
  const checkUserData = useCallback(async () => {
    try {
      if (!user) return false;
      
      // For admin users in system view, we consider they have data
      const isAdminSystemView = user.role === 'admin' && !isPersonalView;
      if (isAdminSystemView) return true;
      
      // Check if user has any products
      const productsResponse = await productsAPI.getProducts({ 
        limit: 1, 
        createdBy: user._id 
      });
      const hasProducts = productsResponse.data.products && productsResponse.data.products.length > 0;
      
      // Check if user has any sales
      const salesResponse = await salesAPI.getSales({ 
        limit: 1, 
        soldBy: user._id 
      });
      const hasSales = salesResponse.data.sales && salesResponse.data.sales.length > 0;
      
      const hasData = hasProducts || hasSales;
      setHasUserData(hasData);
      return hasData;
      
    } catch (error) {
      console.error('Error checking user data:', error);
      return false;
    }
  }, [user, isPersonalView]);

  // Determine if user should see personal or system view
  const determineViewType = useCallback(() => {
    if (!user) return 'personal';
    
    // Non-admin users always see personal view
    if (user.role !== 'admin') {
      return 'personal';
    }
    
    // Admin users: check localStorage preference or default to personal
    const preferredView = localStorage.getItem('analyticsView') || 'personal';
    return preferredView;
  }, [user]);

  // Fetch analytics data
  const fetchAnalyticsData = useCallback(async () => {
    setLoading(true);
    setError('');
    
    try {
      const viewType = determineViewType();
      setIsPersonalView(viewType === 'personal');
      
      // For new users without data in personal view, show empty state
      const hasData = await checkUserData();
      
      if (!hasData && viewType === 'personal') {
        // Use empty analytics data structure
        setAnalyticsData({
          salesOverview: {
            totalSales: 0,
            totalRevenue: 0,
            totalProfit: 0,
            totalItemsSold: 0,
            averageSale: 0
          },
          productAnalytics: {
            totalProducts: 0,
            totalValue: 0,
            totalRevenue: 0,
            totalCost: 0,
            totalProfit: 0,
            outOfStock: 0,
            lowStock: 0
          },
          topProducts: [],
          inventoryAnalytics: {
            totalProducts: 0,
            totalStockValue: 0,
            originalStockValue: 0,
            restockedValue: 0,
            averageStock: 0,
            totalItems: 0
          },
          performanceMetrics: {
            sales: {
              totalRevenue: 0,
              totalProfit: 0,
              totalSales: 0,
              averageSaleValue: 0,
              averageProfitPerSale: 0
            },
            products: {
              averageProfitMargin: 0
            }
          },
          dailyPerformance: {
            performance: {
              totalRevenue: 0,
              totalProfit: 0,
              totalSales: 0,
              totalItemsSold: 0,
              averageSaleValue: 0
            }
          },
          productTracking: []
        });
        setLoading(false);
        return;
      }
      
      // Fetch analytics data with the correct view type
      const data = await analyticsAPI.getMyAnalytics({
        period: timeRange,
        limit: 8
      });
      
      setAnalyticsData(data);
      
    } catch (error) {
      console.error('Error fetching analytics data:', error);
      setError('Unable to load analytics data. Please try again.');
      
      // Fallback to empty data
      setAnalyticsData({
        salesOverview: {
          totalSales: 0,
          totalRevenue: 0,
          totalProfit: 0,
          totalItemsSold: 0,
          averageSale: 0
        },
        productAnalytics: {
          totalProducts: 0,
          totalValue: 0,
          totalRevenue: 0,
          totalCost: 0,
          totalProfit: 0,
          outOfStock: 0,
          lowStock: 0
        },
        topProducts: [],
        inventoryAnalytics: {
          totalProducts: 0,
          totalStockValue: 0,
          originalStockValue: 0,
          restockedValue: 0,
          averageStock: 0,
          totalItems: 0
        },
        performanceMetrics: {
          sales: {
            totalRevenue: 0,
            totalProfit: 0,
            totalSales: 0,
            averageSaleValue: 0,
            averageProfitPerSale: 0
          },
          products: {
            averageProfitMargin: 0
          }
        },
        dailyPerformance: {
          performance: {
            totalRevenue: 0,
            totalProfit: 0,
            totalSales: 0,
            totalItemsSold: 0,
            averageSaleValue: 0
          }
        },
        productTracking: []
      });
    } finally {
      setLoading(false);
    }
  }, [user, timeRange, checkUserData, determineViewType]);

  // Toggle view for admin users
  const toggleView = () => {
    if (user?.role !== 'admin') return;
    
    const newView = isPersonalView ? 'system' : 'personal';
    analyticsAPI.setAnalyticsView(newView);
    setIsPersonalView(!isPersonalView);
    fetchAnalyticsData();
  };

  const fetchProductDetails = async (productId) => {
    try {
      const response = await productsAPI.getProduct(productId);
      const product = response.data.product;
      
      // Verify product belongs to user in personal view
      if (isPersonalView && product.createdBy?._id !== user?._id) {
        alert('You do not have permission to view this product');
        return;
      }
      
      setSelectedProductDetails(product);
      
      // Fetch sales history for this product
      const salesResponse = await salesAPI.getSales({ 
        productId: productId,
        limit: 20 
      });
      setProductSalesHistory(salesResponse.data.sales || []);
    } catch (error) {
      console.error('Error fetching product details:', error);
      alert('Failed to load product details');
    }
  };

  // Helper functions
  const formatCurrency = (amount) => {
    return `UGX ${amount?.toLocaleString() || '0'}`;
  };

  const formatNumber = (number) => {
    return number?.toLocaleString() || '0';
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    });
  };

  const formatTime = (dateString) => {
    return new Date(dateString).toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getTimeRangeLabel = () => {
    switch (timeRange) {
      case 'today': return 'Today';
      case 'week': return 'Week';
      case 'month': return 'Month';
      case 'year': return 'Year';
      default: return 'Week';
    }
  };

  const calculateProductProfit = (product) => {
    const totalRevenue = (product.sellingPrice || 0) * (product.totalSold || 0);
    const totalCost = (product.purchasePrice || 0) * (product.totalSold || 0);
    return totalRevenue - totalCost;
  };

  const calculateOriginalQuantity = (product) => {
    return (product.originalQuantity || (product.stock + (product.totalSold || 0)));
  };

  // Filter product tracking
  const filteredProductTracking = (analyticsData?.productTracking || []).filter(product => {
    // Filter by owner in personal view
    if (isPersonalView && user) {
      const productOwnerId = product.creator?._id || product.createdBy?._id || product.createdBy;
      if (productOwnerId !== user._id) {
        return false;
      }
    }
    
    const matchesSearch = product.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         product.brand?.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesFilter = stockFilter === 'all' ? true :
                         stockFilter === 'low-stock' ? product.inventory?.status === 'low-stock' :
                         stockFilter === 'out-of-stock' ? product.inventory?.status === 'out-of-stock' :
                         stockFilter === 'healthy' ? product.inventory?.status === 'healthy' : true;
    
    return matchesSearch && matchesFilter;
  });

  useEffect(() => {
    if (user) {
      fetchAnalyticsData();
    }
  }, [user, timeRange, fetchAnalyticsData]);

  if (loading) {
    return (
      <div className="space-y-3">
        <div className="flex justify-between items-center">
          <h2 className="text-lg font-bold theme-text">Analytics</h2>
          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="theme-surface rounded p-2 animate-pulse">
              <div className="bg-gray-300 dark:bg-gray-600 h-2 rounded w-3/4 mb-1"></div>
              <div className="bg-gray-300 dark:bg-gray-600 h-4 rounded w-1/2"></div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // Show empty state for users without data in personal view
  if (!hasUserData && isPersonalView) {
    return (
      <div className="space-y-3">
        <div className="flex justify-between items-center">
          <h2 className="text-lg font-bold theme-text">Analytics</h2>
          {user?.role === 'admin' && (
            <button
              onClick={toggleView}
              className="flex items-center gap-1 theme-border border theme-text-muted hover:theme-secondary px-2 py-1 rounded text-xs transition-colors"
            >
              <Shield className="h-3 w-3" />
              Switch to System View
            </button>
          )}
        </div>
        
        <div className="theme-surface rounded p-4 text-center">
          <div className="flex flex-col items-center justify-center py-8">
            <BarChart3 className="h-12 w-12 text-gray-400 mb-4" />
            <h3 className="text-lg font-semibold theme-text mb-2">No Analytics Data Yet</h3>
            <p className="theme-text-muted text-sm mb-4">
              Start by creating products and making sales to see your analytics here.
            </p>
            <div className="flex flex-col sm:flex-row gap-2 justify-center">
              <button
                onClick={() => window.location.href = '/admin/products?action=create'}
                className="flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
              >
                <PlusCircle className="h-4 w-4" />
                Create First Product
              </button>
              <button
                onClick={() => window.location.href = '/sales'}
                className="flex items-center justify-center gap-2 px-4 py-2 border theme-border theme-text hover:theme-secondary rounded transition-colors"
              >
                <ShoppingCart className="h-4 w-4" />
                Make First Sale
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-bold theme-text">Analytics</h2>
            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs ${
              isPersonalView 
                ? 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300'
                : 'bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300'
            }`}>
              {isPersonalView ? (
                <>
                  <User className="h-3 w-3" />
                  Personal View
                </>
              ) : (
                <>
                  <Shield className="h-3 w-3" />
                  System View
                </>
              )}
            </span>
          </div>
          <p className="theme-text-muted text-xs">
            {isPersonalView 
              ? 'Your personal business insights' 
              : 'All business insights (Admin View)'}
          </p>
        </div>
        
        <div className="flex flex-wrap gap-1">
          {user?.role === 'admin' && (
            <button
              onClick={toggleView}
              className="flex items-center gap-1 theme-border border theme-text-muted hover:theme-secondary px-2 py-1 rounded text-xs transition-colors"
            >
              {isPersonalView ? <Shield className="h-3 w-3" /> : <User className="h-3 w-3" />}
              {isPersonalView ? 'System View' : 'Personal View'}
            </button>
          )}
          
          <select
            value={timeRange}
            onChange={(e) => setTimeRange(e.target.value)}
            className="theme-border border rounded px-2 py-1 theme-surface theme-text text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
          >
            <option value="today">Today</option>
            <option value="week">Week</option>
            <option value="month">Month</option>
            <option value="year">Year</option>
          </select>
          
          <button
            onClick={fetchAnalyticsData}
            disabled={loading}
            className="flex items-center gap-1 theme-border border theme-text-muted hover:theme-secondary px-2 py-1 rounded text-xs transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`h-3 w-3 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </div>

      {error && (
        <div className="p-2 bg-red-50 border border-red-200 rounded text-xs">
          <div className="flex items-center gap-1 text-red-700">
            <AlertCircle className="h-3 w-3" />
            <p>{error}</p>
          </div>
        </div>
      )}

      {/* Sales Overview Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        <div className="theme-surface rounded p-2 border-l-2 border-blue-500">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium theme-text-muted">Revenue</p>
              <p className="text-sm font-bold theme-text">
                {formatCurrency(analyticsData?.salesOverview?.totalRevenue || 0)}
              </p>
            </div>
            <div className="p-1 bg-blue-100 dark:bg-blue-900 rounded-full">
              <DollarSign className="h-3 w-3 text-blue-600 dark:text-blue-400" />
            </div>
          </div>
          <p className="text-xs theme-text-muted mt-1">{getTimeRangeLabel()}</p>
        </div>

        <div className="theme-surface rounded p-2 border-l-2 border-green-500">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium theme-text-muted">Sales</p>
              <p className="text-sm font-bold theme-text">
                {formatNumber(analyticsData?.salesOverview?.totalSales || 0)}
              </p>
            </div>
            <div className="p-1 bg-green-100 dark:bg-green-900 rounded-full">
              <ShoppingCart className="h-3 w-3 text-green-600 dark:text-green-400" />
            </div>
          </div>
          <p className="text-xs theme-text-muted mt-1">{getTimeRangeLabel()}</p>
        </div>

        <div className="theme-surface rounded p-2 border-l-2 border-purple-500">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium theme-text-muted">Profit</p>
              <p className="text-sm font-bold theme-text">
                {formatCurrency(analyticsData?.salesOverview?.totalProfit || 0)}
              </p>
            </div>
            <div className="p-1 bg-purple-100 dark:bg-purple-900 rounded-full">
              <TrendingUp className="h-3 w-3 text-purple-600 dark:text-purple-400" />
            </div>
          </div>
          <p className="text-xs theme-text-muted mt-1">{getTimeRangeLabel()}</p>
        </div>

        <div className="theme-surface rounded p-2 border-l-2 border-orange-500">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium theme-text-muted">Items Sold</p>
              <p className="text-sm font-bold theme-text">
                {formatNumber(analyticsData?.salesOverview?.totalItemsSold || 0)}
              </p>
            </div>
            <div className="p-1 bg-orange-100 dark:bg-orange-900 rounded-full">
              <Package className="h-3 w-3 text-orange-600 dark:text-orange-400" />
            </div>
          </div>
          <p className="text-xs theme-text-muted mt-1">{getTimeRangeLabel()}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
        {/* Product Statistics */}
        <div className="theme-surface rounded p-3">
          <h3 className="text-sm font-semibold theme-text mb-2 flex items-center gap-1">
            <PieChart className="h-3 w-3" />
            {isPersonalView ? 'Your Products' : 'Product Stats'}
          </h3>
          
          <div className="space-y-2 text-xs">
            <div className="flex justify-between items-center py-1 border-b theme-border">
              <span className="theme-text-muted">Total Products</span>
              <span className="font-semibold theme-text">
                {formatNumber(analyticsData?.productAnalytics?.totalProducts || 0)}
              </span>
            </div>
            
            <div className="flex justify-between items-center py-1 border-b theme-border">
              <span className="theme-text-muted">Out of Stock</span>
              <span className="font-semibold text-red-600">
                {formatNumber(analyticsData?.productAnalytics?.outOfStock || 0)}
              </span>
            </div>
            
            <div className="flex justify-between items-center py-1 border-b theme-border">
              <span className="theme-text-muted">Low Stock</span>
              <span className="font-semibold text-yellow-600">
                {formatNumber(analyticsData?.productAnalytics?.lowStock || 0)}
              </span>
            </div>
            
            <div className="flex justify-between items-center py-1 border-b theme-border">
              <span className="theme-text-muted">Current Value</span>
              <span className="font-semibold theme-text">
                {formatCurrency(analyticsData?.inventoryAnalytics?.totalStockValue || 0)}
              </span>
            </div>

            <div className="flex justify-between items-center py-1">
              <span className="theme-text-muted">Restocked Value</span>
              <span className="font-semibold text-green-600">
                {formatCurrency(analyticsData?.inventoryAnalytics?.restockedValue || 0)}
              </span>
            </div>
          </div>
        </div>

        {/* Top Selling Products */}
        <div className="theme-surface rounded p-3">
          <h3 className="text-sm font-semibold theme-text mb-2 flex items-center gap-1">
            <BarChart className="h-3 w-3" />
            {isPersonalView ? 'Your Top Products' : 'Top Products'}
          </h3>
          
          <div className="space-y-1 max-h-48 overflow-y-auto">
            {analyticsData?.topProducts?.slice(0, 5).length === 0 ? (
              <p className="theme-text-muted text-center py-2 text-xs">No products found</p>
            ) : (
              analyticsData.topProducts.slice(0, 5).map((product, index) => (
                <div 
                  key={product._id} 
                  className="flex items-center justify-between p-1 theme-border border rounded hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors text-xs"
                >
                  <div className="flex items-center gap-1">
                    <span className="flex items-center justify-center w-4 h-4 bg-blue-100 text-blue-600 rounded text-xs font-semibold">
                      {index + 1}
                    </span>
                    <div className="max-w-[100px]">
                      <p className="font-medium theme-text truncate text-xs">{product.name}</p>
                      <p className="theme-text-muted truncate text-xs">{product.brand}</p>
                      {isPersonalView && product.createdBy && (
                        <p className="text-xs text-gray-500 truncate">
                          {product.createdBy.name || 'You'}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold theme-text text-xs">
                      {formatNumber(product.totalSold || 0)}
                    </p>
                    <p className="theme-text-muted text-xs">
                      {formatCurrency((product.sellingPrice || 0) * (product.totalSold || 0))}
                    </p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Product Tracking */}
        <div className="theme-surface rounded p-3">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-semibold theme-text flex items-center gap-1">
              <Eye className="h-3 w-3" />
              {isPersonalView ? 'Your Product Tracking' : 'Product Tracking'}
            </h3>
            <button
              onClick={fetchAnalyticsData}
              className="text-xs theme-text-muted hover:theme-text"
              title="Refresh"
            >
              <RefreshCw className="h-3 w-3" />
            </button>
          </div>

          {/* Search and Filter */}
          <div className="space-y-1 mb-2">
            <div className="relative">
              <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 h-3 w-3 theme-text-muted" />
              <input
                type="text"
                placeholder="Search products..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-7 pr-2 py-1 theme-border border rounded text-xs theme-surface theme-text focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
            <div className="flex items-center gap-1">
              <Filter className="h-3 w-3 theme-text-muted" />
              <select
                value={stockFilter}
                onChange={(e) => setStockFilter(e.target.value)}
                className="w-full px-2 py-1 theme-border border rounded text-xs theme-surface theme-text focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                <option value="all">All Stock</option>
                <option value="healthy">Healthy Stock</option>
                <option value="low-stock">Low Stock</option>
                <option value="out-of-stock">Out of Stock</option>
              </select>
            </div>
          </div>

          {/* Product Tracking List */}
          <div className="space-y-1 max-h-48 overflow-y-auto">
            {filteredProductTracking.length === 0 ? (
              <p className="theme-text-muted text-center py-3 text-xs">
                {isPersonalView ? 'No products found in your inventory' : 'No products found'}
              </p>
            ) : (
              filteredProductTracking.slice(0, 8).map((product) => (
                <div key={product._id} className="p-1 theme-border border rounded text-xs">
                  <div className="flex justify-between items-start mb-1">
                    <div className="flex-1 min-w-0">
                      <p className="font-medium theme-text truncate">{product.name}</p>
                      <p className="theme-text-muted truncate">{product.brand}</p>
                      {isPersonalView && product.creator && (
                        <p className="text-xs text-gray-500 truncate">
                          {product.creator.name || 'You'}
                        </p>
                      )}
                    </div>
                    <button
                      onClick={() => fetchProductDetails(product._id)}
                      className="ml-1 p-0.5 theme-text-muted hover:theme-text rounded"
                      title="View Details"
                    >
                      <Info className="h-3 w-3" />
                    </button>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-1 mb-1">
                    <div>
                      <span className="theme-text-muted">Cost:</span>
                      <p className="font-semibold">{formatCurrency(product.pricing?.cost || 0)}</p>
                    </div>
                    <div>
                      <span className="theme-text-muted">Price:</span>
                      <p className="font-semibold">{formatCurrency(product.pricing?.price || 0)}</p>
                    </div>
                    <div>
                      <span className="theme-text-muted">Stock:</span>
                      <p className={
                        product.inventory?.status === 'out-of-stock' ? 'text-red-600 font-semibold' :
                        product.inventory?.status === 'low-stock' ? 'text-yellow-600 font-semibold' :
                        'font-semibold'
                      }>
                        {formatNumber(product.inventory?.currentStock || 0)}
                      </p>
                    </div>
                    <div>
                      <span className="theme-text-muted">Sold:</span>
                      <p className="font-semibold">{formatNumber(product.sales?.totalSold || 0)}</p>
                    </div>
                  </div>

                  <div className="pt-1 border-t theme-border">
                    <div className="flex justify-between">
                      <span className="theme-text-muted">Profit:</span>
                      <span className="font-semibold text-green-600">
                        {formatCurrency(product.sales?.totalProfit || 0)}
                      </span>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Performance Metrics */}
      <div className="theme-surface rounded p-3">
        <h3 className="text-sm font-semibold theme-text mb-2 flex items-center gap-1">
          <BarChart3 className="h-3 w-3" />
          {isPersonalView ? 'Your Performance' : 'Performance Metrics'}
        </h3>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
          <div className="text-center p-2 theme-border border rounded">
            <p className="text-sm font-bold theme-text">
              {formatCurrency(analyticsData?.salesOverview?.averageSale || 0)}
            </p>
            <p className="theme-text-muted text-xs mt-1">Avg Sale</p>
          </div>
          
          <div className="text-center p-2 theme-border border rounded">
            <p className="text-sm font-bold theme-text">
              {analyticsData?.salesOverview?.totalSales && analyticsData?.salesOverview?.totalItemsSold 
                ? Math.round((analyticsData.salesOverview.totalItemsSold || 0) / analyticsData.salesOverview.totalSales)
                : 0
              }
            </p>
            <p className="theme-text-muted text-xs mt-1">Items/Sale</p>
          </div>
          
          <div className="text-center p-2 theme-border border rounded">
            <p className="text-sm font-bold theme-text">
              {analyticsData?.salesOverview?.totalRevenue && analyticsData?.salesOverview.totalProfit 
                ? `${((analyticsData.salesOverview.totalProfit / analyticsData.salesOverview.totalRevenue) * 100).toFixed(1)}%`
                : '0%'
              }
            </p>
            <p className="theme-text-muted text-xs mt-1">Profit Margin</p>
          </div>
        </div>
      </div>

      {/* Product Details Modal */}
      {selectedProductDetails && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-2">
          <div className="theme-surface rounded-lg p-3 max-w-md w-full max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-2">
              <h3 className="text-sm font-semibold theme-text">Product Details</h3>
              <button
                onClick={() => {
                  setSelectedProductDetails(null);
                  setProductSalesHistory([]);
                }}
                className="theme-text-muted hover:theme-text text-lg"
              >
                ×
              </button>
            </div>
            
            <div className="space-y-3 text-xs">
              <div>
                <p className="font-semibold theme-text text-sm">{selectedProductDetails.name}</p>
                <p className="theme-text-muted">{selectedProductDetails.brand}</p>
                {selectedProductDetails.createdBy && (
                  <p className="text-xs text-gray-500 mt-1">
                    Owner: {selectedProductDetails.createdBy.name || 'You'}
                  </p>
                )}
              </div>
              
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <span className="theme-text-muted">Purchase Price:</span>
                  <p className="font-semibold">{formatCurrency(selectedProductDetails.purchasePrice || 0)}</p>
                </div>
                <div>
                  <span className="theme-text-muted">Selling Price:</span>
                  <p className="font-semibold">{formatCurrency(selectedProductDetails.sellingPrice || 0)}</p>
                </div>
                <div>
                  <span className="theme-text-muted">Current Stock:</span>
                  <p className="font-semibold">{formatNumber(selectedProductDetails.stock || 0)}</p>
                </div>
                <div>
                  <span className="theme-text-muted">Total Sold:</span>
                  <p className="font-semibold">{formatNumber(selectedProductDetails.totalSold || 0)}</p>
                </div>
                <div>
                  <span className="theme-text-muted">Category:</span>
                  <p className="font-semibold">{selectedProductDetails.category}</p>
                </div>
              </div>

              {/* Sales History Section */}
              <div className="mt-3">
                <h4 className="font-semibold theme-text mb-2 flex items-center gap-1">
                  <Calendar className="h-3 w-3" />
                  Sales History
                </h4>
                {productSalesHistory.length > 0 ? (
                  <div className="space-y-1 max-h-40 overflow-y-auto">
                    {productSalesHistory.map((sale) => {
                      const productSale = sale.items.find(item => 
                        item.product === selectedProductDetails._id || 
                        item.productName === selectedProductDetails.name
                      );
                      
                      if (!productSale) return null;
                      
                      return (
                        <div key={sale._id} className="p-1 theme-border border rounded">
                          <div className="flex justify-between items-start">
                            <div>
                              <p className="font-medium theme-text">Sale: {sale.saleNumber}</p>
                              <p className="theme-text-muted text-xs">
                                {formatDate(sale.createdAt)} at {formatTime(sale.createdAt)}
                              </p>
                              {isPersonalView && sale.soldBy && (
                                <p className="text-xs text-gray-500">
                                  Sold by: {sale.soldBy.name || 'You'}
                                </p>
                              )}
                            </div>
                            <div className="text-right">
                              <p className="font-semibold text-green-600">
                                {formatCurrency(productSale.totalPrice)}
                              </p>
                              <p className="theme-text-muted text-xs">
                                {formatNumber(productSale.quantity)} units
                              </p>
                            </div>
                          </div>
                          {sale.customer?.name && (
                            <p className="theme-text-muted text-xs mt-1">
                              Customer: {sale.customer.name}
                            </p>
                          )}
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p className="theme-text-muted text-center py-2">No sales history found</p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AnalyticsTab;