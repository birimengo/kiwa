import axios from 'axios';

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
    'dashboard': 'user'
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
      params.view === 'my' ||
      params.soldBy === 'me' ||
      params.createdBy === 'me' ||
      params.filter === 'my' ||
      (endpointType === 'products' && params.createdBy) ||
      (endpointType === 'sales' && params.soldBy)
    );
    
    if (isPersonalView) {
      finalParams[userField] = user._id;
      if (params.view === 'my') {
        finalParams.view = 'my';
      }
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
  // You can store view preference in localStorage
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
  // Keep original method names
  getSales: baseSalesAPI.getAll,
  getSale: baseSalesAPI.get,
  createSale: baseProductsAPI.create,
  updateSale: baseSalesAPI.update,
  deleteSale: baseSalesAPI.delete,
  
  // ADMIN-SPECIFIC ENDPOINTS
  getAdminSales: (params = {}) => {
    const queryString = createQueryString({ ...params, view: 'my' });
    return api.get(`/sales${queryString}`);
  },
  
  getAdminSalesStats: (params = {}) => {
    const queryString = createQueryString({ ...params, view: 'my' });
    return api.get(`/sales/stats${queryString}`);
  },
  
  // Sales-specific methods
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
  
  getSalesStats: (params = {}) => {
    const filteredParams = addUserFilterToParams(params, 'sales');
    const queryString = createQueryString(filteredParams);
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
  // Keep original method names for backward compatibility
  getOrders: baseOrdersAPI.getAll,
  getOrder: baseOrdersAPI.get,
  createOrder: baseOrdersAPI.create,
  updateOrder: baseOrdersAPI.update,
  deleteOrder: baseOrdersAPI.delete,
  
  // ADMIN-SPECIFIC ENDPOINTS
  getAdminOrders: (params = {}) => {
    const queryString = createQueryString(params);
    return api.get(`/orders/admin/my-orders${queryString}`);
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
    const filteredParams = addUserFilterToParams({ ...params, view: 'my' }, 'orders');
    const queryString = createQueryString(filteredParams);
    return api.get(`/orders/stats${queryString}`);
  },
  
  // Dashboard statistics
  getDashboardStats: () => {
    return api.get('/orders/dashboard/stats');
  }
};

// ==================== ENHANCED ANALYTICS API ====================
export const analyticsAPI = {
  // ==================== SIMPLIFIED ANALYTICS API ====================
  // Main analytics methods with automatic view detection
  
  // Sales Overview
  getSalesOverview: (params = {}, viewType = 'auto') => {
    const filteredParams = addUserFilterToParams(params, 'analytics');
    const queryString = createQueryString(filteredParams);
    const endpoint = buildAnalyticsEndpoint('sales-overview', viewType);
    return api.get(`${endpoint}${queryString}`);
  },
  
  // Product Analytics
  getProductAnalytics: (params = {}, viewType = 'auto') => {
    const filteredParams = addUserFilterToParams(params, 'products');
    const queryString = createQueryString(filteredParams);
    const endpoint = buildAnalyticsEndpoint('product-analytics', viewType);
    return api.get(`${endpoint}${queryString}`);
  },
  
  // Inventory Analytics
  getInventoryAnalytics: (params = {}, viewType = 'auto') => {
    const filteredParams = addUserFilterToParams(params, 'products');
    const queryString = createQueryString(filteredParams);
    const endpoint = buildAnalyticsEndpoint('inventory', viewType);
    return api.get(`${endpoint}${queryString}`);
  },
  
  // Performance Metrics
  getPerformanceMetrics: (params = {}, viewType = 'auto') => {
    const filteredParams = addUserFilterToParams(params, 'analytics');
    const queryString = createQueryString(filteredParams);
    const endpoint = buildAnalyticsEndpoint('performance', viewType);
    return api.get(`${endpoint}${queryString}`);
  },
  
  // Daily Performance
  getDailyPerformance: (params = {}, viewType = 'auto') => {
    const filteredParams = addUserFilterToParams(params, 'analytics');
    const queryString = createQueryString(filteredParams);
    const endpoint = buildAnalyticsEndpoint('daily-performance', viewType);
    return api.get(`${endpoint}${queryString}`);
  },
  
  // Product Tracking
  getProductTracking: (params = {}, viewType = 'auto') => {
    const filteredParams = addUserFilterToParams(params, 'products');
    const queryString = createQueryString(filteredParams);
    const endpoint = buildAnalyticsEndpoint('product-tracking', viewType);
    return api.get(`${endpoint}${queryString}`);
  },
  
  // ==================== EXPLICIT VIEW METHODS ====================
  // For when you want to explicitly specify the view
  
  // Personal View (user's own data only)
  getPersonalSalesOverview: (params = {}) => {
    return this.getSalesOverview(params, 'personal');
  },
  
  getPersonalProductAnalytics: (params = {}) => {
    return this.getProductAnalytics(params, 'personal');
  },
  
  getPersonalInventoryAnalytics: (params = {}) => {
    return this.getInventoryAnalytics(params, 'personal');
  },
  
  getPersonalPerformanceMetrics: (params = {}) => {
    return this.getPerformanceMetrics(params, 'personal');
  },
  
  getPersonalDailyPerformance: (params = {}) => {
    return this.getDailyPerformance(params, 'personal');
  },
  
  getPersonalProductTracking: (params = {}) => {
    return this.getProductTracking(params, 'personal');
  },
  
  // System View (admin sees all data)
  getSystemSalesOverview: (params = {}) => {
    return this.getSalesOverview(params, 'system');
  },
  
  getSystemProductAnalytics: (params = {}) => {
    return this.getProductAnalytics(params, 'system');
  },
  
  getSystemInventoryAnalytics: (params = {}) => {
    return this.getInventoryAnalytics(params, 'system');
  },
  
  getSystemPerformanceMetrics: (params = {}) => {
    return this.getPerformanceMetrics(params, 'system');
  },
  
  getSystemDailyPerformance: (params = {}) => {
    return this.getDailyPerformance(params, 'system');
  },
  
  getSystemProductTracking: (params = {}) => {
    return this.getProductTracking(params, 'system');
  },
  
  // ==================== VIEW MANAGEMENT ====================
  // Helper to manage view preferences
  
  setAnalyticsView: (viewType) => {
    if (viewType !== 'personal' && viewType !== 'system') {
      throw new Error('View type must be "personal" or "system"');
    }
    localStorage.setItem('analyticsView', viewType);
  },
  
  getAnalyticsView: () => {
    return localStorage.getItem('analyticsView') || 'system';
  },
  
  // Check if user is admin
  isAdminUser: () => {
    const user = getUserContext();
    return user?.role === 'admin';
  },
  
  // Get current user info
  getCurrentUser: () => {
    return getUserContext();
  }
};

// ==================== NOTIFICATION API ====================
export const notificationsAPI = {
  // Get all notifications
  getNotifications: (params = {}) => {
    const queryString = createQueryString(params);
    return api.get(`/notifications${queryString}`);
  },
  
  // Get single notification
  getNotification: (id) => {
    validateId(id, 'Notification');
    return api.get(`/notifications/${id}`);
  },
  
  // Delete notification
  deleteNotification: (id) => {
    validateId(id, 'Notification');
    return api.delete(`/notifications/${id}`);
  },
  
  // Get unread count
  getUnreadCount: () => {
    return api.get('/notifications/unread-count');
  },
  
  // Mark as read
  markAsRead: (id) => {
    validateId(id, 'Notification');
    return api.put(`/notifications/${id}/read`);
  },
  
  // Mark all as read
  markAllAsRead: () => {
    return api.put('/notifications/read-all');
  },
  
  // Clear all notifications
  clearAllNotifications: () => {
    return api.delete('/notifications');
  },
  
  // Real-time polling helper
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
  // User dashboard (own data)
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
  
  // ADMIN-SPECIFIC DASHBOARD ENDPOINTS
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
  // Create initial admin (unprotected)
  createAdmin: (adminData) => {
    validateRequiredFields(adminData, ['name', 'email', 'password']);
    return api.post('/admin/create-admin', adminData);
  },
  
  // Register new admin (requires existing admin authentication)
  registerAdmin: (adminData) => {
    validateRequiredFields(adminData, ['name', 'email', 'password']);
    return api.post('/admin/register', adminData);
  },
  
  // Get all admin users
  getAdmins: () => {
    return api.get('/admin/admins');
  },
  
  // Get all users
  getUsers: (params = {}) => {
    const queryString = createQueryString(params);
    return api.get(`/admin/users${queryString}`);
  },
  
  // Search users
  searchUsers: (query) => {
    if (!query || query.trim().length < 2) {
      throw new Error('Search query must be at least 2 characters long');
    }
    return api.get(`/admin/users/search?q=${encodeURIComponent(query)}`);
  },
  
  // Get user by ID
  getUserById: (id) => {
    validateId(id, 'User');
    return api.get(`/admin/users/${id}`);
  },
  
  // Get user activity
  getUserActivity: (id) => {
    validateId(id, 'User');
    return api.get(`/admin/users/${id}/activity`);
  },
  
  // Update user role
  updateUserRole: (id, roleData) => {
    validateId(id, 'User');
    validateRequiredFields(roleData, ['role']);
    return api.put(`/admin/users/${id}/role`, roleData);
  },
  
  // Toggle user status
  toggleUserStatus: (id, statusData) => {
    validateId(id, 'User');
    validateRequiredFields(statusData, ['isActive']);
    return api.put(`/admin/users/${id}/status`, statusData);
  },
  
  // Reset user password
  resetUserPassword: (id, passwordData) => {
    validateId(id, 'User');
    validateRequiredFields(passwordData, ['newPassword']);
    return api.put(`/admin/users/${id}/reset-password`, passwordData);
  },
  
  // Delete user (soft delete)
  deleteUser: (id) => {
    validateId(id, 'User');
    return api.delete(`/admin/users/${id}`);
  },
  
  // Dashboard statistics
  getDashboardStats: () => {
    return api.get('/admin/dashboard');
  },
  
  // Admin's personal dashboard statistics
  getMyDashboardStats: () => {
    return api.get('/admin/my-dashboard');
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

// ==================== NEW HELPER FOR FRONTEND COMPONENTS ====================
export const createUserFilteredParams = (params = {}, endpointType = 'products') => {
  return addUserFilterToParams(params, endpointType);
};

// Export configured axios instance
export default api;