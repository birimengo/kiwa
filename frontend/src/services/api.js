// api.js - Enhanced API Configuration and Utilities
import axios from 'axios';

// ==================== ENVIRONMENT CONFIGURATION ====================
// USE ENVIRONMENT VARIABLE - This will work for both dev and production
const API_BASE_URL = import.meta.env.VITE_API_URL || 'https://kiwa-8lrz.onrender.com/api';

console.log('🚀 Using API URL:', API_BASE_URL);
console.log('🌍 Environment:', import.meta.env.MODE);
console.log('🔧 VITE_API_URL:', import.meta.env.VITE_API_URL);

const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 90000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// ==================== PRODUCT FILTERING HELPER ====================
// Filter products by wholesaler ID (client-side filtering)
export const filterProductsByWholesaler = (products, wholesalerId) => {
  if (!wholesalerId || !products || !Array.isArray(products)) return [];
  
  console.log(`🔍 Filtering ${products.length} products for wholesaler: ${wholesalerId}`);
  
  return products.filter(product => {
    // Log product structure for debugging
    console.log(`Product: ${product.name}`, {
      createdBy: product.createdBy,
      createdById: product.createdBy?._id || product.createdBy,
      createdByString: JSON.stringify(product.createdBy)
    });
    
    // Try different ways to get creator ID
    let creatorId;
    
    if (typeof product.createdBy === 'string') {
      creatorId = product.createdBy;
    } else if (product.createdBy && typeof product.createdBy === 'object') {
      creatorId = product.createdBy._id || product.createdBy.id || product.createdBy;
    } else {
      creatorId = product.createdBy;
    }
    
    const matches = creatorId === wholesalerId;
    
    if (matches) {
      console.log(`✅ Product "${product.name}" matches wholesaler ${wholesalerId}`);
    }
    
    return matches;
  });
};

// ==================== USER CONTEXT HELPER ====================
const getUserContext = () => {
  try {
    const userStr = localStorage.getItem('user');
    if (!userStr) return null;
    
    const user = JSON.parse(userStr);
    return {
      _id: user._id,
      role: user.role || 'user',
      name: user.name,
      email: user.email
    };
  } catch (error) {
    console.error('Error parsing user from localStorage:', error);
    return null;
  }
};

// ==================== ENHANCED QUERY STRING HELPER ====================
const createQueryString = (params = {}) => {
  const queryParams = new URLSearchParams();
  
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      queryParams.append(key, value);
    }
  });
  
  const queryString = queryParams.toString();
  return queryString ? `?${queryString}` : '';
};

// ==================== ENHANCED HELPER FUNCTION ====================
// This adds automatic user filtering to any params object
const addUserFilterToParams = (params = {}, endpointType = 'products') => {
  const user = getUserContext();
  if (!user) return params;
  
  // Map endpoint types to their respective user fields
  const userFieldMap = {
    'products': 'createdBy',
    'sales': 'soldBy',
    'orders': 'customer.user',
    'analytics': 'soldBy',
    'dashboard': 'user',
    'wholesalers': 'createdBy'
  };
  
  const userField = userFieldMap[endpointType] || 'createdBy';
  let finalParams = { ...params };
  
  // For regular users: ALWAYS filter by their own data
  if (user.role !== 'admin') {
    finalParams[userField] = user._id;
  }
  // For admin users: only filter if personal view is requested
  else if (user.role === 'admin') {
    // Check if it's a personal view request
    const isPersonalView = (
      params.view === 'my-products' ||
      params.view === 'my-processed' ||
      params.soldBy === 'me' ||
      params.createdBy === 'me' ||
      params.filter === 'my' ||
      (endpointType === 'products' && params.createdBy) ||
      (endpointType === 'sales' && params.soldBy) ||
      (endpointType === 'wholesalers' && params.view === 'my')
    );
    
    if (isPersonalView) {
      finalParams[userField] = user._id;
    }
  }
  
  return finalParams;
};

// ==================== ANALYTICS HELPER FUNCTIONS ====================
// Determine which analytics endpoint to use based on user role and view preference
const getAnalyticsEndpoint = (viewType = 'auto') => {
  const user = getUserContext();
  
  if (!user) return 'user'; // Default to personal view
  
  // If view type is specified, use it
  if (viewType === 'system' && user.role === 'admin') {
    return ''; // System view uses base endpoints
  }
  
  if (viewType === 'personal') {
    return 'user'; // Personal view uses user endpoints
  }
  
  // Auto-detect: non-admin users always get personal view
  if (user.role !== 'admin') {
    return 'user';
  }
  
  // Admin users default to system view unless specified otherwise
  const preferredView = localStorage.getItem('analyticsView') || 'system';
  return preferredView === 'personal' ? 'user' : '';
};

// Build analytics endpoint URL
const buildAnalyticsEndpoint = (basePath, viewType = 'auto') => {
  const endpointPrefix = getAnalyticsEndpoint(viewType);
  
  if (endpointPrefix === 'user') {
    return `/analytics/user/${basePath}`;
  }
  
  // System view or admin endpoints
  return `/analytics/${basePath}`;
};

// Request interceptor
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    console.log(`🔄 API Request: ${config.method?.toUpperCase()} ${config.baseURL}${config.url}`);
    return config;
  },
  (error) => {
    console.error('❌ Request Interceptor Error:', error);
    return Promise.reject(error);
  }
);

// Response interceptor
api.interceptors.response.use(
  (response) => {
    console.log(`✅ API Response: ${response.config.url} ${response.status}`);
    return response;
  },
  (error) => {
    console.error('❌ API Error:', {
      url: error.config?.url,
      status: error.response?.status,
      message: error.message,
      code: error.code
    });
    
    let userMessage = error.message;
    if (error.code === 'ECONNABORTED') {
      userMessage = 'Request timeout - Backend server might be spinning up.';
    } else if (!error.response) {
      userMessage = `Cannot connect to backend at ${API_BASE_URL}`;
    } else if (error.response.status === 401) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      if (window.location.pathname !== '/login') {
        window.location.href = '/login';
      }
      userMessage = 'Session expired. Please login again.';
    } else if (error.response.status === 403) {
      userMessage = 'Access forbidden. You do not have permission to access this resource.';
    } else if (error.response.status === 404) {
      userMessage = 'Requested resource not found.';
    } else if (error.response.status >= 500) {
      userMessage = 'Server error. Please try again later.';
    }
    
    error.userMessage = userMessage;
    return Promise.reject(error);
  }
);

// Utility Functions
const validateRequiredFields = (data, requiredFields) => {
  const missingFields = requiredFields.filter(field => !data[field]);
  if (missingFields.length > 0) {
    throw new Error(`Missing required fields: ${missingFields.join(', ')}`);
  }
};

const validateId = (id, entityName = 'Resource') => {
  if (!id) {
    throw new Error(`${entityName} ID is required`);
  }
};

// Enhanced Connection Testing
export const testBackendConnection = async () => {
  try {
    console.log('🔌 Testing connection to:', API_BASE_URL);
    
    const response = await api.get('/health', { timeout: 10000 });
    console.log('✅ Backend connection successful');
    return {
      connected: true,
      status: response.status,
      data: response.data,
      environment: import.meta.env.MODE,
      baseURL: API_BASE_URL
    };
  } catch (error) {
    console.error('❌ Backend connection test failed:', error.message);
    return {
      connected: false,
      error: error.message,
      status: error.response?.status,
      environment: import.meta.env.MODE,
      baseURL: API_BASE_URL
    };
  }
};

// ==================== ENHANCED GENERIC API FACTORY ====================
const createApiMethods = (endpoint, config = {}) => {
  const { 
    requiredFields = [], 
    idRequired = true,
    customValidations = {},
    endpointType = endpoint // Default to endpoint name
  } = config;

  const methods = {
    // Get all with automatic user filtering
    getAll: (params = {}) => {
      // Add user filtering to params
      const filteredParams = addUserFilterToParams(params, endpointType);
      const queryString = createQueryString(filteredParams);
      const cleanEndpoint = endpoint.replace(/^\//, '');
      return api.get(`/${cleanEndpoint}${queryString}`);
    },

    // Get single by ID
    get: (id) => {
      if (idRequired) validateId(id, endpoint);
      const cleanEndpoint = endpoint.replace(/^\//, '');
      return api.get(`/${cleanEndpoint}/${id}`);
    },

    // Create new
    create: (data) => {
      validateRequiredFields(data, requiredFields);
      
      Object.entries(customValidations).forEach(([field, validation]) => {
        if (data[field] !== undefined && !validation(data[field])) {
          throw new Error(`Invalid ${field}`);
        }
      });
      
      const cleanEndpoint = endpoint.replace(/^\//, '');
      return api.post(`/${cleanEndpoint}`, data);
    },

    // Update by ID
    update: (id, data) => {
      if (idRequired) validateId(id, endpoint);
      const cleanEndpoint = endpoint.replace(/^\//, '');
      return api.put(`/${cleanEndpoint}/${id}`, data);
    },

    // Delete by ID
    delete: (id) => {
      if (idRequired) validateId(id, endpoint);
      const cleanEndpoint = endpoint.replace(/^\//, '');
      return api.delete(`/${cleanEndpoint}/${id}`);
    }
  };

  return methods;
};

// ==================== ENHANCED API CONFIGURATIONS ====================

// Products API Configuration
const productsConfig = {
  requiredFields: ['name', 'brand', 'sellingPrice'],
  customValidations: {
    sellingPrice: (price) => price >= 0,
    purchasePrice: (price) => price === undefined || price >= 0,
    stock: (stock) => stock === undefined || stock >= 0
  },
  endpointType: 'products'
};

const baseProductsAPI = createApiMethods('products', productsConfig);

export const productsAPI = {
  // Keep original method names for backward compatibility
  getProducts: baseProductsAPI.getAll,
  getProduct: baseProductsAPI.get,
  createProduct: baseProductsAPI.create,
  updateProduct: baseProductsAPI.update,
  deleteProduct: baseProductsAPI.delete,
  
  // ADMIN-SPECIFIC ENDPOINTS (already filtered by backend)
  getAdminProducts: (params = {}) => {
    const queryString = createQueryString(params);
    return api.get(`/products/admin/my-products${queryString}`);
  },
  
  // ================ NEW WHOLESALER PRODUCTS ENDPOINTS ================
  // Get products by specific wholesaler ID (public endpoint)
  getProductsByWholesaler: (wholesalerId, params = {}) => {
    validateId(wholesalerId, 'Wholesaler');
    const queryString = createQueryString(params);
    return api.get(`/products/wholesaler/${wholesalerId}${queryString}`);
  },
  
  // Fallback method: Get products with createdBy filter
  getProductsByCreator: (creatorId, params = {}) => {
    validateId(creatorId, 'Creator');
    const queryParams = { ...params, createdBy: creatorId };
    const queryString = createQueryString(queryParams);
    return api.get(`/products${queryString}`);
  },
  
  // Product-specific methods
  likeProduct: (id) => {
    validateId(id, 'Product');
    return api.post(`/products/${id}/like`);
  },
  
  addComment: (id, comment) => {
    validateId(id, 'Product');
    validateRequiredFields(comment, ['text', 'rating']);
    
    if (comment.rating < 1 || comment.rating > 5) {
      throw new Error('Rating must be between 1 and 5');
    }
    
    return api.post(`/products/${id}/comments`, comment);
  },
  
  getFeaturedProducts: () => api.get('/products/featured'),
  
  getProductsByCategory: (category) => {
    if (!category) throw new Error('Category is required');
    return api.get(`/products/category/${category}`);
  },
  
  restockProduct: (id, restockData) => {
    validateId(id, 'Product');
    validateRequiredFields(restockData, ['quantity']);
    
    if (restockData.quantity <= 0) {
      throw new Error('Valid quantity is required');
    }
    
    return api.post(`/products/${id}/restock`, restockData);
  },
  
  getStockHistory: (id) => {
    validateId(id, 'Product');
    return api.get(`/products/${id}/stock-history`);
  },

  // Product performance for analytics
  getProductPerformance: (productId, period = 'week') => {
    validateId(productId, 'Product');
    const queryString = createQueryString({ period });
    return api.get(`/products/${productId}/performance${queryString}`);
  },

  // Product statistics for analytics
  getProductStats: () => {
    return api.get('/products/admin/stats');
  },

  // Get top products analytics
  getTopProductsAnalytics: (params = {}) => {
    const filteredParams = addUserFilterToParams(params, 'products');
    const queryString = createQueryString(filteredParams);
    return api.get(`/products/analytics/top-products${queryString}`);
  },

  // Get product tracking data
  getProductTracking: (params = {}) => {
    const filteredParams = addUserFilterToParams(params, 'products');
    const queryString = createQueryString(filteredParams);
    return api.get(`/products/analytics/tracking${queryString}`);
  }
};

// Sales API Configuration
const salesConfig = {
  requiredFields: ['items'],
  customValidations: {
    items: (items) => Array.isArray(items) && items.length > 0
  },
  endpointType: 'sales'
};

const baseSalesAPI = createApiMethods('sales', salesConfig);

export const salesAPI = {
  // ==================== GET SALES METHODS ====================
  
  // Get sales with automatic user filtering
  getSales: (params = {}) => {
    const user = getUserContext();
    const queryParams = { ...params };
    
    // For non-admin users: Always use personal endpoint
    if (user?.role !== 'admin') {
      queryParams.view = 'my';
      console.log(`👤 [salesAPI.getSales] Non-admin user - using personal view`);
    } 
    // For admin users: Check if they want personal view
    else if (user?.role === 'admin') {
      // Check if personal view is requested
      const isPersonalView = queryParams.view === 'my' || params.view === 'my';
      if (isPersonalView) {
        console.log(`👑 [salesAPI.getSales] Admin personal view requested`);
      } else {
        console.log(`👑 [salesAPI.getSales] Admin system view - seeing all sales`);
      }
    }
    
    const queryString = createQueryString(queryParams);
    return api.get(`/sales${queryString}`);
  },
  
  // Get user's personal sales (explicit personal endpoint)
  getMySales: (params = {}) => {
    const queryParams = { ...params, view: 'my' };
    const queryString = createQueryString(queryParams);
    console.log(`👤 [salesAPI.getMySales] Getting personal sales`);
    return api.get(`/sales${queryString}`);
  },
  
  // Get admin's personal sales (admin-specific personal endpoint)
  getAdminSales: (params = {}) => {
    const queryString = createQueryString(params);
    console.log(`👑 [salesAPI.getAdminSales] Admin getting personal sales`);
    return api.get(`/sales/admin/my-sales${queryString}`);
  },
  
  // ==================== SINGLE SALE METHODS ====================
  getSale: baseSalesAPI.get,
  createSale: baseSalesAPI.create,
  updateSale: baseSalesAPI.update,
  deleteSale: baseSalesAPI.delete,
  
  // ==================== SALES-SPECIFIC METHODS ====================
  updatePayment: (id, paymentData) => {
    validateId(id, 'Sale');
    return api.put(`/sales/${id}/payment`, paymentData);
  },
  
  cancelSale: (id) => {
    validateId(id, 'Sale');
    return api.put(`/sales/${id}/cancel`);
  },
  
  // Resume cancelled sale
  resumeSale: (id) => {
    validateId(id, 'Sale');
    return api.put(`/sales/${id}/resume`);
  },
  
  // ==================== STATISTICS METHODS ====================
  getSalesStats: (params = {}) => {
    const user = getUserContext();
    const queryParams = { ...params };
    
    // For non-admin users: Always use personal stats
    if (user?.role !== 'admin') {
      queryParams.view = 'my';
    }
    // For admin users: Only use personal stats if explicitly requested
    else if (user?.role === 'admin') {
      // Map view parameters for admin
      if (queryParams.view === 'my-products' || queryParams.view === 'my-processed') {
        // Keep the view as is
      } else if (queryParams.view === 'my') {
        queryParams.view = 'system';
      } else {
        queryParams.view = queryParams.view || 'system';
      }
    }
    
    const queryString = createQueryString(queryParams);
    return api.get(`/sales/stats${queryString}`);
  },
  
  // Get personal sales stats
  getMySalesStats: (params = {}) => {
    const queryParams = { ...params, view: 'my' };
    const queryString = createQueryString(queryParams);
    return api.get(`/sales/stats${queryString}`);
  },

  // Get detailed sales analytics
  getSalesAnalytics: (params = {}) => {
    const filteredParams = addUserFilterToParams(params, 'analytics');
    const queryString = createQueryString(filteredParams);
    return api.get(`/sales/analytics${queryString}`);
  }
};

// Auth API Configuration
const authConfig = {
  requiredFields: ['email', 'password'],
  idRequired: false,
  endpointType: 'auth'
};

const baseAuthAPI = createApiMethods('auth', authConfig);

export const authAPI = {
  // Keep original method names
  getProfile: baseAuthAPI.get,
  updateProfile: baseAuthAPI.update,
  
  // Auth-specific methods
  login: (credentials) => {
    validateRequiredFields(credentials, ['email', 'password']);
    return api.post('/auth/login', credentials);
  },
  
  register: (userData) => {
    validateRequiredFields(userData, ['name', 'email', 'password']);
    return api.post('/auth/register', userData);
  },
  
  changePassword: (passwordData) => api.put('/auth/password', passwordData),
  
  logout: () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    return Promise.resolve();
  }
};

// Orders API Configuration
const ordersConfig = {
  requiredFields: ['items', 'customerInfo'],
  idRequired: true,
  customValidations: {
    items: (items) => Array.isArray(items) && items.length > 0,
    paymentMethod: (method) => ['onDelivery', 'mtn', 'airtel', 'card'].includes(method)
  },
  endpointType: 'orders'
};

const baseOrdersAPI = createApiMethods('orders', ordersConfig);

export const ordersAPI = {
  // ==================== GET ORDERS METHODS ====================
  getOrders: (params = {}) => {
    const user = getUserContext();
    const queryParams = { ...params };
    
    // For non-admin users: Always filter by their own orders
    if (user?.role !== 'admin') {
      return ordersAPI.getMyOrders(params);
    }
    // For admin users: Handle different view modes
    else {
      // Determine which endpoint to use based on view parameter
      const view = queryParams.view || 'system';
      
      if (view === 'my-products') {
        return ordersAPI.getAdminProductOrders(queryParams);
      } else if (view === 'my-processed') {
        return ordersAPI.getAdminProcessedOrders(queryParams); // ✅ FIXED
      } else {
        // System view - get all orders
        const queryString = createQueryString(queryParams);
        return api.get(`/orders${queryString}`);
      }
    }
  },
  
  // ✅ ADDED: Admin processed orders endpoint
  getAdminProcessedOrders: (params = {}) => {
    const queryString = createQueryString(params);
    console.log(`👑 [ordersAPI.getAdminProcessedOrders] Admin fetching processed orders`);
    return api.get(`/orders/admin/my-processed${queryString}`);
  },
  
  // Get single order
  getOrder: baseOrdersAPI.get,
  
  // Create new order
  createOrder: baseOrdersAPI.create,
  
  // Update order
  updateOrder: baseOrdersAPI.update,
  
  // Delete order
  deleteOrder: baseOrdersAPI.delete,
  
  // ADMIN-SPECIFIC ENDPOINTS
  getAdminOrders: (params = {}) => {
    const queryString = createQueryString(params);
    return api.get(`/orders/admin/my-processed${queryString}`);
  },
  
  // Get admin's product-specific orders
  getAdminProductOrders: (params = {}) => {
    const queryString = createQueryString(params);
    return api.get(`/orders/admin/my-products${queryString}`);
  },
  
  // Order-specific methods
  updateOrderStatus: (id, statusData) => {
    validateId(id, 'Order');
    return api.put(`/orders/${id}/status`, statusData);
  },
  
  cancelOrder: (id, reason = '') => {
    validateId(id, 'Order');
    return api.put(`/orders/${id}/cancel`, { reason });
  },
  
  // Order workflow methods
  processOrder: (id) => {
    validateId(id, 'Order');
    return api.put(`/orders/${id}/process`);
  },
  
  deliverOrder: (id) => {
    validateId(id, 'Order');
    return api.put(`/orders/${id}/deliver`);
  },
  
  rejectOrder: (id, reason = '') => {
    validateId(id, 'Order');
    return api.put(`/orders/${id}/reject`, { reason });
  },
  
  confirmDelivery: (id, confirmationNote = '') => {
    validateId(id, 'Order');
    return api.put(`/orders/${id}/confirm-delivery`, { confirmationNote });
  },
  
  // User orders
  getMyOrders: (params = {}) => {
    // User orders are already filtered by backend
    const queryString = createQueryString(params);
    return api.get(`/orders/my-orders${queryString}`);
  },
  
  // Order statistics
  getOrderStats: (params = {}) => {
    const user = getUserContext();
    const queryParams = { ...params };
    
    // For non-admin users: Always get personal stats
    if (user?.role !== 'admin') {
      queryParams.view = 'my';
    }
    // For admin users: Map view parameters correctly
    else {
      const view = queryParams.view || 'system';
      
      if (view === 'my-products' || view === 'my-processed') {
        queryParams.view = view;
      } else if (view === 'my') {
        queryParams.view = 'system';
      } else {
        queryParams.view = 'system';
      }
    }
    
    // Remove any customer.user filter that might have been added automatically
    delete queryParams['customer.user'];
    
    const queryString = createQueryString(queryParams);
    return api.get(`/orders/stats${queryString}`);
  },
  
  // Dashboard statistics
  getDashboardStats: () => {
    return api.get('/orders/dashboard/stats');
  },
  
  // Helper method to get stats for specific view
  getStatsForView: (view = 'system', period = 'month') => {
    return ordersAPI.getOrderStats({ view, period });
  }
};

// ==================== CONSOLIDATED ANALYTICS API ====================
// Helper function for analytics fallback
const fetchAnalyticsFallback = async (params) => {
  const { period = 'week', limit = 8 } = params;
  
  try {
    const [salesOverview, productAnalytics, inventoryAnalytics, performanceMetrics, productTracking] = await Promise.all([
      api.get(`/analytics/user/sales-overview?period=${period}`),
      api.get(`/analytics/user/product-analytics?period=${period}`),
      api.get(`/analytics/user/inventory?period=${period}`),
      api.get(`/analytics/user/performance?period=${period}`),
      api.get(`/analytics/user/product-tracking?limit=${limit}`)
    ]);
    
    const today = new Date().toISOString().split('T')[0];
    let dailyPerformance;
    try {
      const response = await api.get(`/analytics/user/daily-performance?date=${today}`);
      dailyPerformance = response.data;
    } catch (error) {
      dailyPerformance = {
        performance: {
          totalRevenue: 0,
          totalProfit: 0,
          totalSales: 0,
          totalItemsSold: 0,
          averageSaleValue: 0
        }
      };
    }
    
    return {
      success: true,
      period,
      salesOverview: salesOverview.data.overview || {
        totalSales: 0,
        totalRevenue: 0,
        totalProfit: 0,
        totalItemsSold: 0,
        averageSale: 0
      },
      productAnalytics: productAnalytics.data.stats || {
        totalProducts: 0,
        totalValue: 0,
        totalRevenue: 0,
        totalCost: 0,
        totalProfit: 0,
        outOfStock: 0,
        lowStock: 0
      },
      topProducts: productAnalytics.data.topProducts || [],
      inventoryAnalytics: inventoryAnalytics.data.stats || {
        totalProducts: 0,
        totalStockValue: 0,
        originalStockValue: 0,
        restockedValue: 0,
        averageStock: 0,
        totalItems: 0
      },
      performanceMetrics: performanceMetrics.data.metrics || {
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
      dailyPerformance,
      productTracking: productTracking.data.products || []
    };
  } catch (error) {
    console.error('Fallback analytics fetch failed:', error);
    throw error;
  }
};

// ==================== ENHANCED ANALYTICS API ====================
export const analyticsAPI = {
  getMyAnalytics: async (params = {}) => {
    try {
      const { period = 'week', limit = 8 } = params;
      const user = getUserContext();
      
      let endpoint;
      const queryString = createQueryString({ period, limit });
      
      if (user?.role === 'admin') {
        const preferredView = localStorage.getItem('analyticsView') || 'system';
        if (preferredView === 'personal') {
          endpoint = `/analytics/user/my-analytics${queryString}`;
        } else {
          endpoint = `/analytics/my-analytics${queryString}`;
        }
      } else {
        endpoint = `/analytics/user/my-analytics${queryString}`;
      }
      
      console.log(`📊 Fetching analytics from: ${endpoint}`);
      const response = await api.get(endpoint);
      return response.data;
    } catch (error) {
      console.error('Error fetching consolidated analytics:', error);
      
      try {
        console.log('🔄 Falling back to individual endpoints...');
        return await fetchAnalyticsFallback(params);
      } catch (fallbackError) {
        console.error('Fallback also failed:', fallbackError);
        throw error;
      }
    }
  },

  getSalesOverview: (params = {}, viewType = 'auto') => {
    const filteredParams = addUserFilterToParams(params, 'analytics');
    const queryString = createQueryString(filteredParams);
    const endpoint = buildAnalyticsEndpoint('sales-overview', viewType);
    return api.get(`${endpoint}${queryString}`);
  },
  
  getProductAnalytics: (params = {}, viewType = 'auto') => {
    const filteredParams = addUserFilterToParams(params, 'products');
    const queryString = createQueryString(filteredParams);
    const endpoint = buildAnalyticsEndpoint('product-analytics', viewType);
    return api.get(`${endpoint}${queryString}`);
  },
  
  getInventoryAnalytics: (params = {}, viewType = 'auto') => {
    const filteredParams = addUserFilterToParams(params, 'products');
    const queryString = createQueryString(filteredParams);
    const endpoint = buildAnalyticsEndpoint('inventory', viewType);
    return api.get(`${endpoint}${queryString}`);
  },
  
  getPerformanceMetrics: (params = {}, viewType = 'auto') => {
    const filteredParams = addUserFilterToParams(params, 'analytics');
    const queryString = createQueryString(filteredParams);
    const endpoint = buildAnalyticsEndpoint('performance', viewType);
    return api.get(`${endpoint}${queryString}`);
  },
  
  getDailyPerformance: (params = {}, viewType = 'auto') => {
    const filteredParams = addUserFilterToParams(params, 'analytics');
    const queryString = createQueryString(filteredParams);
    const endpoint = buildAnalyticsEndpoint('daily-performance', viewType);
    return api.get(`${endpoint}${queryString}`);
  },
  
  getProductTracking: (params = {}, viewType = 'auto') => {
    const filteredParams = addUserFilterToParams(params, 'products');
    const queryString = createQueryString(filteredParams);
    const endpoint = buildAnalyticsEndpoint('product-tracking', viewType);
    return api.get(`${endpoint}${queryString}`);
  },
  
  setAnalyticsView: (viewType) => {
    if (viewType !== 'personal' && viewType !== 'system') {
      throw new Error('View type must be "personal" or "system"');
    }
    localStorage.setItem('analyticsView', viewType);
  },
  
  getAnalyticsView: () => {
    return localStorage.getItem('analyticsView') || 'system';
  },
  
  isAdminUser: () => {
    const user = getUserContext();
    return user?.role === 'admin';
  },
  
  getCurrentUser: () => {
    return getUserContext();
  }
};

// ==================== NOTIFICATION API ====================
export const notificationsAPI = {
  getNotifications: (params = {}) => {
    const queryString = createQueryString(params);
    return api.get(`/notifications${queryString}`);
  },
  
  getNotification: (id) => {
    validateId(id, 'Notification');
    return api.get(`/notifications/${id}`);
  },
  
  deleteNotification: (id) => {
    validateId(id, 'Notification');
    return api.delete(`/notifications/${id}`);
  },
  
  getUnreadCount: () => {
    return api.get('/notifications/unread-count');
  },
  
  markAsRead: (id) => {
    validateId(id, 'Notification');
    return api.put(`/notifications/${id}/read`);
  },
  
  markAllAsRead: () => {
    return api.put('/notifications/read-all');
  },
  
  clearAllNotifications: () => {
    return api.delete('/notifications');
  },
  
  pollNotifications: async (onNewNotifications, interval = 10000) => {
    const poll = async () => {
      try {
        const response = await api.get('/notifications/unread-count');
        if (response.data.success && response.data.unreadCount > 0) {
          const notificationsResponse = await api.get('/notifications?limit=10');
          if (notificationsResponse.data.success) {
            onNewNotifications(notificationsResponse.data.notifications);
          }
        }
      } catch (error) {
        console.error('Polling error:', error);
      }
    };
    
    await poll();
    const pollInterval = setInterval(poll, interval);
    return () => clearInterval(pollInterval);
  }
};

// ==================== ENHANCED DASHBOARD API ====================
export const dashboardAPI = {
  getDashboardOverview: () => {
    return api.get('/dashboard/overview');
  },
  
  getQuickStats: () => {
    return api.get('/dashboard/quick-stats');
  },
  
  getRecentActivity: (params = {}) => {
    const filteredParams = addUserFilterToParams(params, 'dashboard');
    const queryString = createQueryString(filteredParams);
    return api.get(`/dashboard/recent-activity${queryString}`);
  },
  
  getAdminDashboardOverview: () => {
    return api.get('/dashboard/admin/overview');
  },
  
  getAdminQuickStats: () => {
    return api.get('/dashboard/admin/quick-stats');
  },
  
  getAdminRecentActivity: (params = {}) => {
    const filteredParams = addUserFilterToParams(params, 'dashboard');
    const queryString = createQueryString(filteredParams);
    return api.get(`/dashboard/admin/recent-activity${queryString}`);
  }
};

// ==================== ADMIN API ====================
export const adminAPI = {
  createAdmin: (adminData) => {
    validateRequiredFields(adminData, ['name', 'email', 'password']);
    return api.post('/admin/create-admin', adminData);
  },
  
  registerAdmin: (adminData) => {
    validateRequiredFields(adminData, ['name', 'email', 'password']);
    return api.post('/admin/register', adminData);
  },
  
  getAdmins: () => {
    return api.get('/admin/admins');
  },
  
  getUsers: (params = {}) => {
    const queryString = createQueryString(params);
    return api.get(`/admin/users${queryString}`);
  },
  
  searchUsers: (query) => {
    if (!query || query.trim().length < 2) {
      throw new Error('Search query must be at least 2 characters long');
    }
    return api.get(`/admin/users/search?q=${encodeURIComponent(query)}`);
  },
  
  getUserById: (id) => {
    validateId(id, 'User');
    return api.get(`/admin/users/${id}`);
  },
  
  getUserActivity: (id) => {
    validateId(id, 'User');
    return api.get(`/admin/users/${id}/activity`);
  },
  
  updateUserRole: (id, roleData) => {
    validateId(id, 'User');
    validateRequiredFields(roleData, ['role']);
    return api.put(`/admin/users/${id}/role`, roleData);
  },
  
  toggleUserStatus: (id, statusData) => {
    validateId(id, 'User');
    validateRequiredFields(statusData, ['isActive']);
    return api.put(`/admin/users/${id}/status`, statusData);
  },
  
  resetUserPassword: (id, passwordData) => {
    validateId(id, 'User');
    validateRequiredFields(passwordData, ['newPassword']);
    return api.put(`/admin/users/${id}/reset-password`, passwordData);
  },
  
  deleteUser: (id) => {
    validateId(id, 'User');
    return api.delete(`/admin/users/${id}`);
  },
  
  getDashboardStats: () => {
    return api.get('/admin/dashboard');
  },
  
  getMyDashboardStats: () => {
    return api.get('/admin/my-dashboard');
  }
};

// ==================== WHOLESALERS API ====================
export const wholesalersAPI = {
  // Get all wholesalers (admins) - Public endpoint for customers
  getWholesalers: (params = {}) => {
    const queryString = createQueryString(params);
    return api.get(`/wholesalers${queryString}`);
  },
  
  // Get wholesaler by ID
  getWholesalerById: (id) => {
    validateId(id, 'Wholesaler');
    return api.get(`/wholesalers/${id}`);
  },
  
  // Search wholesalers by name or email
  searchWholesalers: (query) => {
    if (!query || query.trim().length < 2) {
      throw new Error('Search query must be at least 2 characters long');
    }
    return api.get(`/wholesalers/search?q=${encodeURIComponent(query)}`);
  },
  
  // Get wholesaler statistics
  getWholesalerStats: () => {
    return api.get('/wholesalers/stats');
  },
  
  // Contact wholesaler (send message)
  contactWholesaler: (wholesalerId, messageData) => {
    validateId(wholesalerId, 'Wholesaler');
    validateRequiredFields(messageData, ['subject', 'message']);
    return api.post(`/wholesalers/${wholesalerId}/contact`, messageData);
  }
};

// ==================== MOCK WHOLESALERS DATA (Fallback if API fails) ====================
export const mockWholesalers = [
  {
    _id: '1',
    name: 'Kiwa General Electricals',
    email: 'gogreenuganda70@gmail.com',
    phone: '+256 751 808 507',
    role: 'admin',
    isActive: true,
    createdAt: '2024-01-01T00:00:00.000Z',
    lastLogin: '2024-01-15T10:30:00.000Z',
    avatar: '',
    status: 'active'
  },
  {
    _id: '2',
    name: 'ElectroTech Supplies',
    email: 'info@electrotech.ug',
    phone: '+256 772 456 789',
    role: 'admin',
    isActive: true,
    createdAt: '2024-01-05T00:00:00.000Z',
    lastLogin: '2024-01-14T14:20:00.000Z',
    avatar: '',
    status: 'active'
  },
  {
    _id: '3',
    name: 'Power Solutions Ltd',
    email: 'sales@powersolutions.ug',
    phone: '+256 701 234 567',
    role: 'admin',
    isActive: true,
    createdAt: '2024-01-10T00:00:00.000Z',
    lastLogin: '2024-01-13T09:15:00.000Z',
    avatar: '',
    status: 'active'
  },
  {
    _id: '4',
    name: 'Sunshine Solar Systems',
    email: 'contact@sunsol.ug',
    phone: '+256 788 345 678',
    role: 'admin',
    isActive: true,
    createdAt: '2024-01-08T00:00:00.000Z',
    lastLogin: '2024-01-12T16:45:00.000Z',
    avatar: '',
    status: 'active'
  }
];

// ==================== ENHANCED WHOLESALERS API WITH FALLBACK ====================
export const enhancedWholesalersAPI = {
  // Get wholesalers with automatic fallback to mock data
  getWholesalers: async (params = {}) => {
    try {
      console.log('🔄 Fetching wholesalers from API...');
      const response = await wholesalersAPI.getWholesalers(params);
      return response;
    } catch (error) {
      console.warn('⚠️ API failed, using mock wholesalers data:', error.message);
      
      // Simulate API response with mock data
      const mockResponse = {
        data: {
          success: true,
          count: mockWholesalers.length,
          wholesalers: mockWholesalers.filter(wholesaler => {
            // Apply basic filtering on mock data
            if (params.search) {
              const searchTerm = params.search.toLowerCase();
              return (
                wholesaler.name.toLowerCase().includes(searchTerm) ||
                wholesaler.email.toLowerCase().includes(searchTerm) ||
                (wholesaler.phone && wholesaler.phone.includes(searchTerm))
              );
            }
            return true;
          })
        }
      };
      
      return mockResponse;
    }
  },
  
  // Get wholesaler by ID with fallback
  getWholesalerById: async (id) => {
    try {
      const response = await wholesalersAPI.getWholesalerById(id);
      return response;
    } catch (error) {
      console.warn('⚠️ API failed, searching in mock data...');
      
      const wholesaler = mockWholesalers.find(w => w._id === id);
      if (wholesaler) {
        return {
          data: {
            success: true,
            wholesaler
          }
        };
      }
      
      throw new Error(`Wholesaler with ID ${id} not found`);
    }
  },
  
  // Get wholesalers statistics
  getStatistics: async () => {
    try {
      const response = await wholesalersAPI.getWholesalerStats();
      return response;
    } catch (error) {
      console.warn('⚠️ API failed, generating mock statistics...');
      
      const activeWholesalers = mockWholesalers.filter(w => w.isActive);
      const today = new Date();
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(today.getDate() - 30);
      
      const recentlyActive = mockWholesalers.filter(w => {
        if (!w.lastLogin) return false;
        const lastLogin = new Date(w.lastLogin);
        return lastLogin > thirtyDaysAgo;
      });
      
      return {
        data: {
          success: true,
          stats: {
            total: mockWholesalers.length,
            active: activeWholesalers.length,
            recentlyActive: recentlyActive.length,
            inactive: mockWholesalers.length - activeWholesalers.length
          }
        }
      };
    }
  }
};

// ==================== ADDITIONAL UTILITY FUNCTIONS ====================
export const checkBackendHealth = async () => {
  try {
    const response = await api.get('/health');
    return response.data;
  } catch (error) {
    console.error('Backend health check failed:', error);
    throw error;
  }
};

export const handleApiError = (error) => {
  return error.userMessage || error.message || 'An unexpected error occurred';
};

export const isBackendConnected = async () => {
  try {
    const connection = await testBackendConnection();
    return connection.connected;
  } catch {
    return false;
  }
};

export const getApiStatus = async () => {
  const connection = await testBackendConnection();
  return {
    baseURL: API_BASE_URL,
    connected: connection.connected,
    status: connection.status,
    error: connection.error,
    timestamp: new Date().toISOString(),
    environment: import.meta.env.MODE
  };
};

export const createUserFilteredParams = (params = {}, endpointType = 'products') => {
  return addUserFilterToParams(params, endpointType);
};

// ==================== NEW UTILITY FUNCTION ====================
// Check if a specific product belongs to a specific wholesaler
export const isProductFromWholesaler = (product, wholesalerId) => {
  if (!product || !wholesalerId) return false;
  
  const productCreatorId = product.createdBy?._id || product.createdBy;
  return productCreatorId === wholesalerId;
};

// Export configured axios instance
export default api;