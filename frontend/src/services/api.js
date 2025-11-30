import axios from 'axios';

// USE ENVIRONMENT VARIABLE - This will work for both dev and production
const API_BASE_URL = import.meta.env.VITE_API_URL || 'https://kiwa-8lrz.onrender.com/api';

console.log('🚀 Using API URL:', API_BASE_URL);
console.log('🌍 Environment:', import.meta.env.MODE);
console.log('🔧 VITE_API_URL:', import.meta.env.VITE_API_URL);

const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
});

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

// Generic API Factory
const createApiMethods = (endpoint, config = {}) => {
  const { 
    requiredFields = [], 
    idRequired = true,
    customValidations = {}
  } = config;

  const methods = {
    // Get all with optional filtering
    getAll: (params = {}) => {
      const queryString = createQueryString(params);
      return api.get(`/${endpoint}${queryString}`);
    },

    // Get single by ID
    get: (id) => {
      if (idRequired) validateId(id, endpoint);
      return api.get(`/${endpoint}/${id}`);
    },

    // Create new
    create: (data) => {
      validateRequiredFields(data, requiredFields);
      
      Object.entries(customValidations).forEach(([field, validation]) => {
        if (data[field] !== undefined && !validation(data[field])) {
          throw new Error(`Invalid ${field}`);
        }
      });
      
      return api.post(`/${endpoint}`, data);
    },

    // Update by ID
    update: (id, data) => {
      if (idRequired) validateId(id, endpoint);
      return api.put(`/${endpoint}/${id}`, data);
    },

    // Delete by ID
    delete: (id) => {
      if (idRequired) validateId(id, endpoint);
      return api.delete(`/${endpoint}/${id}`);
    }
  };

  return methods;
};

// Products API Configuration
const productsConfig = {
  requiredFields: ['name', 'brand', 'sellingPrice'],
  customValidations: {
    sellingPrice: (price) => price >= 0,
    purchasePrice: (price) => price === undefined || price >= 0,
    stock: (stock) => stock === undefined || stock >= 0
  }
};

const baseProductsAPI = createApiMethods('products', productsConfig);

export const productsAPI = {
  // Keep original method names for backward compatibility
  getProducts: baseProductsAPI.getAll,
  getProduct: baseProductsAPI.get,
  createProduct: baseProductsAPI.create,
  updateProduct: baseProductsAPI.update,
  deleteProduct: baseProductsAPI.delete,
  
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

  // NEW: Get product performance for analytics
  getProductPerformance: (productId, period = 'week') => {
    validateId(productId, 'Product');
    const queryString = createQueryString({ period });
    return api.get(`/products/${productId}/performance${queryString}`);
  },

  // NEW: Get product statistics for analytics
  getProductStats: () => {
    return api.get('/products/admin/stats');
  }
};

// Sales API Configuration
const salesConfig = {
  requiredFields: ['items'],
  customValidations: {
    items: (items) => Array.isArray(items) && items.length > 0
  }
};

const baseSalesAPI = createApiMethods('sales', salesConfig);

export const salesAPI = {
  // Keep original method names
  getSales: baseSalesAPI.getAll,
  getSale: baseSalesAPI.get,
  createSale: baseSalesAPI.create,
  updateSale: baseSalesAPI.update,
  deleteSale: baseSalesAPI.delete,
  
  // Sales-specific methods
  updatePayment: (id, paymentData) => {
    validateId(id, 'Sale');
    return api.put(`/sales/${id}/payment`, paymentData);
  },
  
  cancelSale: (id) => {
    validateId(id, 'Sale');
    return api.put(`/sales/${id}/cancel`);
  },
  
  // NEW METHOD: Resume cancelled sale
  resumeSale: (id) => {
    validateId(id, 'Sale');
    return api.put(`/sales/${id}/resume`);
  },
  
  getSalesStats: (params = {}) => {
    const queryString = createQueryString(params);
    return api.get(`/sales/stats${queryString}`);
  },

  // NEW: Get detailed sales analytics
  getSalesAnalytics: (params = {}) => {
    const queryString = createQueryString(params);
    return api.get(`/sales/analytics${queryString}`);
  }
};

// Auth API Configuration
const authConfig = {
  requiredFields: ['email', 'password'],
  idRequired: false
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

// Cart API Configuration
const cartConfig = {
  idRequired: false
};

const baseCartAPI = createApiMethods('cart', cartConfig);

export const cartAPI = {
  // Keep original method names
  getCart: baseCartAPI.getAll,
  clearCart: baseCartAPI.delete,
  
  // Cart-specific methods
  addToCart: (productId, quantity = 1) => {
    validateId(productId, 'Product');
    return api.post('/cart', { productId, quantity });
  },
  
  updateCartItem: (productId, quantity) => {
    validateId(productId, 'Product');
    return api.put(`/cart/${productId}`, { quantity });
  },
  
  removeFromCart: (productId) => {
    validateId(productId, 'Product');
    return api.delete(`/cart/${productId}`);
  }
};

// Orders API
const baseOrdersAPI = createApiMethods('orders');

export const ordersAPI = {
  getOrders: baseOrdersAPI.getAll,
  getOrder: baseOrdersAPI.get,
  createOrder: baseOrdersAPI.create,
  updateOrder: baseOrdersAPI.update,
  deleteOrder: baseOrdersAPI.delete,
  
  updateOrderStatus: (id, status) => {
    validateId(id, 'Order');
    return api.put(`/orders/${id}/status`, { status });
  }
};

// Analytics API - NEW: Dedicated analytics endpoints
export const analyticsAPI = {
  // Sales analytics
  getSalesOverview: (params = {}) => {
    const queryString = createQueryString(params);
    return api.get(`/analytics/sales/overview${queryString}`);
  },

  // Product analytics
  getProductAnalytics: (params = {}) => {
    const queryString = createQueryString(params);
    return api.get(`/analytics/products${queryString}`);
  },

  // Inventory analytics
  getInventoryAnalytics: () => {
    return api.get('/analytics/inventory');
  },

  // Performance metrics
  getPerformanceMetrics: (params = {}) => {
    const queryString = createQueryString(params);
    return api.get(`/analytics/performance${queryString}`);
  },

  // Daily business performance
  getDailyPerformance: (date) => {
    const queryString = createQueryString({ date });
    return api.get(`/analytics/daily-performance${queryString}`);
  },

  // Product tracking data
  getProductTracking: (limit = 10) => {
    const queryString = createQueryString({ limit });
    return api.get(`/analytics/product-tracking${queryString}`);
  }
};

// Dashboard API - NEW: Consolidated dashboard data
export const dashboardAPI = {
  getOverview: () => {
    return api.get('/dashboard/overview');
  },

  getQuickStats: () => {
    return api.get('/dashboard/quick-stats');
  },

  getRecentActivity: (limit = 10) => {
    const queryString = createQueryString({ limit });
    return api.get(`/dashboard/recent-activity${queryString}`);
  }
};

// Enhanced utility functions
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

// Export configured axios instance
export default api;