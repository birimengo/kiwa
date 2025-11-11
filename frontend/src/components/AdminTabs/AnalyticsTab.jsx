import React, { useState, useEffect } from 'react';
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
  FileText,
  Activity,
  Search,
  Info,
  Calendar,
  Users
} from 'lucide-react';
import { salesAPI, productsAPI } from '../../services/api';

const AnalyticsTab = ({ user, onDataRefresh }) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [timeRange, setTimeRange] = useState('week');
  const [salesStats, setSalesStats] = useState(null);
  const [productStats, setProductStats] = useState(null);
  const [topProducts, setTopProducts] = useState([]);
  const [productTracking, setProductTracking] = useState([]);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [productPerformance, setProductPerformance] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [stockFilter, setStockFilter] = useState('all');
  const [selectedProductDetails, setSelectedProductDetails] = useState(null);
  const [productSalesHistory, setProductSalesHistory] = useState([]);

  const fetchAnalyticsData = async () => {
    setLoading(true);
    setError('');
    
    try {
      // Fetch sales statistics
      const salesResponse = await salesAPI.getSalesStats({ period: timeRange });
      setSalesStats(salesResponse.data.stats);

      // Fetch product statistics
      const productsResponse = await productsAPI.getProducts({
        limit: 100,
        sortBy: 'totalSold'
      });
      
      if (productsResponse.data.products) {
        const topProductsData = productsResponse.data.products.slice(0, 10);
        setTopProducts(topProductsData);
        
        // For product tracking, get detailed product performance
        const trackingData = await Promise.all(
          topProductsData.slice(0, 8).map(async (product) => {
            try {
              const performanceResponse = await productsAPI.getProductPerformance(product._id, timeRange);
              return {
                ...product,
                performance: performanceResponse.data.performance || {},
                productDetails: performanceResponse.data.product || product
              };
            } catch (error) {
              console.error(`Error fetching performance for ${product.name}:`, error);
              return {
                ...product,
                performance: {},
                productDetails: product
              };
            }
          })
        );
        setProductTracking(trackingData);
      }

      // Calculate product stats from the products data
      const productStatsData = calculateProductStats(productsResponse.data.products);
      setProductStats(productStatsData);

    } catch (error) {
      console.error('Error fetching analytics data:', error);
      setError('Failed to load analytics data');
    } finally {
      setLoading(false);
    }
  };

  const fetchProductPerformance = async (productId) => {
    try {
      const response = await productsAPI.getProductPerformance(productId, timeRange);
      setProductPerformance(response.data);
      setSelectedProduct(productId);
    } catch (error) {
      console.error('Error fetching product performance:', error);
    }
  };

  const fetchProductDetails = async (productId) => {
    try {
      const response = await productsAPI.getProduct(productId);
      setSelectedProductDetails(response.data.product);
      
      // Fetch sales history for this product
      const salesResponse = await salesAPI.getSales({ 
        productId: productId,
        limit: 50 
      });
      setProductSalesHistory(salesResponse.data.sales || []);
    } catch (error) {
      console.error('Error fetching product details:', error);
    }
  };

  const calculateProductStats = (products) => {
    if (!products || products.length === 0) {
      return {
        totalProducts: 0,
        outOfStock: 0,
        lowStock: 0,
        totalValue: 0,
        originalValue: 0,
        restockedValue: 0,
        averagePrice: 0
      };
    }

    const totalProducts = products.length;
    const outOfStock = products.filter(p => p.stock === 0).length;
    const lowStock = products.filter(p => p.stock > 0 && p.stock <= (p.lowStockAlert || 10)).length;
    
    // Calculate inventory values
    const totalValue = products.reduce((sum, product) => sum + ((product.purchasePrice || 0) * (product.stock || 0)), 0);
    const originalValue = products.reduce((sum, product) => {
      const originalQty = (product.originalQuantity || (product.stock + (product.totalSold || 0)));
      return sum + ((product.purchasePrice || 0) * originalQty);
    }, 0);
    const restockedValue = products.reduce((sum, product) => sum + ((product.purchasePrice || 0) * (product.restockedQuantity || 0)), 0);
    
    const averagePrice = products.reduce((sum, product) => sum + (product.sellingPrice || 0), 0) / totalProducts;

    return {
      totalProducts,
      outOfStock,
      lowStock,
      totalValue,
      originalValue,
      restockedValue,
      averagePrice
    };
  };

  useEffect(() => {
    fetchAnalyticsData();
  }, [timeRange]);

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

  // Filter product tracking based on search and stock filter
  const filteredProductTracking = productTracking.filter(product => {
    const matchesSearch = product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         product.brand.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesFilter = stockFilter === 'all' ? true :
                         stockFilter === 'low-stock' ? product.stock <= (product.lowStockAlert || 10) && product.stock > 0 :
                         stockFilter === 'out-of-stock' ? product.stock === 0 :
                         stockFilter === 'healthy' ? product.stock > (product.lowStockAlert || 10) : true;
    
    return matchesSearch && matchesFilter;
  });

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

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
        <div>
          <h2 className="text-lg font-bold theme-text">Analytics</h2>
          <p className="theme-text-muted text-xs">Business insights</p>
        </div>
        
        <div className="flex gap-1">
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
            onClick={() => {
              fetchAnalyticsData();
              if (onDataRefresh) onDataRefresh();
            }}
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
          <p className="text-red-700">{error}</p>
        </div>
      )}

      {/* Sales Overview Cards - Reduced Size */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        {/* Total Revenue */}
        <div className="theme-surface rounded p-2 border-l-2 border-blue-500">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium theme-text-muted">Revenue</p>
              <p className="text-sm font-bold theme-text">
                {formatCurrency(salesStats?.totalRevenue || 0)}
              </p>
            </div>
            <div className="p-1 bg-blue-100 dark:bg-blue-900 rounded-full">
              <DollarSign className="h-3 w-3 text-blue-600 dark:text-blue-400" />
            </div>
          </div>
          <p className="text-xs theme-text-muted mt-1">{getTimeRangeLabel()}</p>
        </div>

        {/* Total Sales */}
        <div className="theme-surface rounded p-2 border-l-2 border-green-500">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium theme-text-muted">Sales</p>
              <p className="text-sm font-bold theme-text">
                {formatNumber(salesStats?.totalSales || 0)}
              </p>
            </div>
            <div className="p-1 bg-green-100 dark:bg-green-900 rounded-full">
              <ShoppingCart className="h-3 w-3 text-green-600 dark:text-green-400" />
            </div>
          </div>
          <p className="text-xs theme-text-muted mt-1">{getTimeRangeLabel()}</p>
        </div>

        {/* Total Profit */}
        <div className="theme-surface rounded p-2 border-l-2 border-purple-500">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium theme-text-muted">Profit</p>
              <p className="text-sm font-bold theme-text">
                {formatCurrency(salesStats?.totalProfit || 0)}
              </p>
            </div>
            <div className="p-1 bg-purple-100 dark:bg-purple-900 rounded-full">
              <TrendingUp className="h-3 w-3 text-purple-600 dark:text-purple-400" />
            </div>
          </div>
          <p className="text-xs theme-text-muted mt-1">{getTimeRangeLabel()}</p>
        </div>

        {/* Items Sold */}
        <div className="theme-surface rounded p-2 border-l-2 border-orange-500">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium theme-text-muted">Items</p>
              <p className="text-sm font-bold theme-text">
                {formatNumber(salesStats?.totalItemsSold || 0)}
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
            Product Stats
          </h3>
          
          <div className="space-y-2 text-xs">
            <div className="flex justify-between items-center py-1 border-b theme-border">
              <span className="theme-text-muted">Total Products</span>
              <span className="font-semibold theme-text">{formatNumber(productStats?.totalProducts || 0)}</span>
            </div>
            
            <div className="flex justify-between items-center py-1 border-b theme-border">
              <span className="theme-text-muted">Out of Stock</span>
              <span className="font-semibold text-red-600">{formatNumber(productStats?.outOfStock || 0)}</span>
            </div>
            
            <div className="flex justify-between items-center py-1 border-b theme-border">
              <span className="theme-text-muted">Low Stock</span>
              <span className="font-semibold text-yellow-600">{formatNumber(productStats?.lowStock || 0)}</span>
            </div>
            
            <div className="flex justify-between items-center py-1 border-b theme-border">
              <span className="theme-text-muted">Current Value</span>
              <span className="font-semibold theme-text">{formatCurrency(productStats?.totalValue || 0)}</span>
            </div>

            <div className="flex justify-between items-center py-1">
              <span className="theme-text-muted">Restocked Value</span>
              <span className="font-semibold text-green-600">{formatCurrency(productStats?.restockedValue || 0)}</span>
            </div>
          </div>
        </div>

        {/* Top Selling Products */}
        <div className="theme-surface rounded p-3">
          <h3 className="text-sm font-semibold theme-text mb-2 flex items-center gap-1">
            <BarChart className="h-3 w-3" />
            Top Products
          </h3>
          
          <div className="space-y-1 max-h-48 overflow-y-auto">
            {topProducts.slice(0, 5).length === 0 ? (
              <p className="theme-text-muted text-center py-2 text-xs">No sales data</p>
            ) : (
              topProducts.slice(0, 5).map((product, index) => (
                <div 
                  key={product._id} 
                  className={`flex items-center justify-between p-1 theme-border border rounded cursor-pointer transition-colors text-xs ${
                    selectedProduct === product._id ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-300' : 'hover:bg-gray-50 dark:hover:bg-gray-800'
                  }`}
                  onClick={() => fetchProductPerformance(product._id)}
                >
                  <div className="flex items-center gap-1">
                    <span className="flex items-center justify-center w-4 h-4 bg-blue-100 text-blue-600 rounded text-xs font-semibold">
                      {index + 1}
                    </span>
                    <div className="max-w-[100px]">
                      <p className="font-medium theme-text truncate text-xs">{product.name}</p>
                      <p className="theme-text-muted truncate text-xs">{product.brand}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold theme-text text-xs">{formatNumber(product.totalSold || 0)}</p>
                    <p className="theme-text-muted text-xs">
                      {formatCurrency((product.sellingPrice || 0) * (product.totalSold || 0))}
                    </p>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Product Performance Details */}
          {selectedProduct && productPerformance && (
            <div className="mt-2 p-2 bg-gray-50 dark:bg-gray-800 rounded text-xs">
              <h4 className="font-semibold theme-text mb-1 flex items-center gap-1">
                <Activity className="h-3 w-3" />
                Performance
              </h4>
              <div className="space-y-1">
                <div className="flex justify-between">
                  <span className="theme-text-muted">Profit:</span>
                  <span className="font-semibold text-green-600">
                    {formatCurrency(calculateProductProfit(productPerformance.product))}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="theme-text-muted">Margin:</span>
                  <span className="font-semibold">
                    {productPerformance.product && productPerformance.product.sellingPrice > 0 
                      ? `${(((productPerformance.product.sellingPrice - productPerformance.product.purchasePrice) / productPerformance.product.sellingPrice) * 100).toFixed(1)}%`
                      : '0%'
                    }
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="theme-text-muted">Stock:</span>
                  <span className="font-semibold">{formatNumber(productPerformance.product?.stock || 0)}</span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Product Tracking */}
        <div className="theme-surface rounded p-3">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-semibold theme-text flex items-center gap-1">
              <Eye className="h-3 w-3" />
              Product Tracking
            </h3>
            <button
              onClick={() => fetchAnalyticsData()}
              className="text-xs theme-text-muted hover:theme-text"
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

          {/* Product Tracking List */}
          <div className="space-y-1 max-h-48 overflow-y-auto">
            {filteredProductTracking.length === 0 ? (
              <p className="theme-text-muted text-center py-3 text-xs">No products found</p>
            ) : (
              filteredProductTracking.map((product, index) => (
                <div key={product._id} className="p-1 theme-border border rounded text-xs">
                  <div className="flex justify-between items-start mb-1">
                    <div className="flex-1 min-w-0">
                      <p className="font-medium theme-text truncate">{product.name}</p>
                      <p className="theme-text-muted truncate">{product.brand}</p>
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
                      <p className="font-semibold">{formatCurrency(product.purchasePrice || 0)}</p>
                    </div>
                    <div>
                      <span className="theme-text-muted">Price:</span>
                      <p className="font-semibold">{formatCurrency(product.sellingPrice || 0)}</p>
                    </div>
                    <div>
                      <span className="theme-text-muted">Stock:</span>
                      <p className={product.stock <= (product.lowStockAlert || 10) ? 'text-red-600 font-semibold' : 'font-semibold'}>
                        {formatNumber(product.stock || 0)}
                      </p>
                    </div>
                    <div>
                      <span className="theme-text-muted">Original:</span>
                      <p className="font-semibold">{formatNumber(calculateOriginalQuantity(product))}</p>
                    </div>
                  </div>

                  <div className="pt-1 border-t theme-border">
                    <div className="flex justify-between">
                      <span className="theme-text-muted">Sold:</span>
                      <span className="font-semibold">{formatNumber(product.totalSold || 0)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="theme-text-muted">Profit:</span>
                      <span className="font-semibold text-green-600">
                        {formatCurrency(calculateProductProfit(product))}
                      </span>
                    </div>
                  </div>
                </div>
              ))
            )}
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
                      <span className="theme-text-muted">Original Quantity:</span>
                      <p className="font-semibold">{formatNumber(calculateOriginalQuantity(selectedProductDetails))}</p>
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
                        {productSalesHistory.map((sale, index) => {
                          // Find this product in the sale items
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
                              <div className="flex justify-between text-xs mt-1">
                                <span className="theme-text-muted">Amount Paid:</span>
                                <span className="font-semibold">{formatCurrency(sale.amountPaid)}</span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <p className="theme-text-muted text-center py-2">No sales history found</p>
                    )}
                  </div>

                  {selectedProductDetails.description && (
                    <div>
                      <span className="theme-text-muted">Description:</span>
                      <p className="theme-text mt-1">{selectedProductDetails.description}</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Performance Metrics - Reduced Size */}
      <div className="theme-surface rounded p-3">
        <h3 className="text-sm font-semibold theme-text mb-2 flex items-center gap-1">
          <BarChart3 className="h-3 w-3" />
          Performance
        </h3>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
          <div className="text-center p-2 theme-border border rounded">
            <p className="text-sm font-bold theme-text">{formatCurrency(salesStats?.averageSale || 0)}</p>
            <p className="theme-text-muted text-xs mt-1">Avg Sale</p>
          </div>
          
          <div className="text-center p-2 theme-border border rounded">
            <p className="text-sm font-bold theme-text">
              {salesStats?.totalSales ? Math.round((salesStats.totalItemsSold || 0) / salesStats.totalSales) : 0}
            </p>
            <p className="theme-text-muted text-xs mt-1">Items/Sale</p>
          </div>
          
          <div className="text-center p-2 theme-border border rounded">
            <p className="text-sm font-bold theme-text">
              {salesStats?.totalRevenue && salesStats.totalProfit 
                ? `${((salesStats.totalProfit / salesStats.totalRevenue) * 100).toFixed(1)}%`
                : '0%'
              }
            </p>
            <p className="theme-text-muted text-xs mt-1">Profit Margin</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AnalyticsTab;