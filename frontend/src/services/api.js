import axios from 'axios';

// Configuration - UPDATED WITH CORRECT URLS
const isDevelopment = import.meta.env.DEV;
const API_BASE_URL = isDevelopment 
  ? 'http://localhost:5000/api' // Direct connection in development
  : 'https://kiwa-8lrz.onrender.com/api'; // Direct in production

const DEFAULT_TIMEOUT = 30000;
const HEALTH_CHECK_TIMEOUT = 10000;

console.log('🚀 Using API URL:', API_BASE_URL);
console.log('🌍 Environment:', import.meta.env.MODE);
console.log('🔧 Development mode:', isDevelopment);

// Axios instance configuration
const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: DEFAULT_TIMEOUT,
  headers: {
    'Content-Type': 'application/json',
  },
  withCredentials: true, // Important for CORS
});

// Request interceptor
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    
    const fullUrl = config.baseURL + config.url;
    console.log(`🔄 API Request: ${config.method?.toUpperCase()} ${fullUrl}`);
    
    return config;
  },
  (error) => {
    console.error('❌ Request Interceptor Error:', error);
    return Promise.reject(error);
  }
);

// Response interceptor - IMPROVED ERROR HANDLING
api.interceptors.response.use(
  (response) => {
    console.log(`✅ API Response: ${response.config.url} ${response.status}`);
    return response;
  },
  (error) => {
    const errorDetails = {
      url: error.config?.url,
      status: error.response?.status,
      message: error.response?.data?.message || error.message,
      code: error.code,
      baseURL: error.config?.baseURL
    };
    
    console.error('❌ API Error:', errorDetails);
    
    let userMessage = error.message;
    
    switch (true) {
      case error.code === 'ECONNABORTED':
        userMessage = 'Request timeout. Please try again.';
        break;
      case !error.response:
        userMessage = 'Cannot connect to server. Please check your internet connection.';
        break;
      case error.response.status === 401:
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        if (window.location.pathname !== '/login') {
          window.location.href = '/login';
        }
        userMessage = 'Session expired. Please login again.';
        break;
      case error.response.status === 403:
        userMessage = 'You do not have permission to perform this action.';
        break;
      case error.response.status === 404:
        userMessage = 'Requested resource not found.';
        break;
      case error.response.status >= 500:
        userMessage = 'Server error. Please try again later.';
        break;
      default:
        userMessage = error.response?.data?.message || error.message;
    }
    
    error.userMessage = userMessage;
    return Promise.reject(error);
  }
);

// Utility Functions (keep the same as your original)
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
    
    const response = await api.get('/health', { timeout: HEALTH_CHECK_TIMEOUT });
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

// Your existing API methods remain the same...
export const productsAPI = {
  getProducts: (params = {}) => {
    const queryString = createQueryString(params);
    return api.get(`/products${queryString}`);
  },
  getProduct: (id) => {
    validateId(id, 'Product');
    return api.get(`/products/${id}`);
  },
  createProduct: (data) => {
    validateRequiredFields(data, ['name', 'brand', 'sellingPrice']);
    return api.post('/products', data);
  },
  updateProduct: (id, data) => {
    validateId(id, 'Product');
    return api.put(`/products/${id}`, data);
  },
  deleteProduct: (id) => {
    validateId(id, 'Product');
    return api.delete(`/products/${id}`);
  }
};

// Export other API modules as in your original code...
export const salesAPI = { /* ... */ };
export const authAPI = { /* ... */ };
export const cartAPI = { /* ... */ };
export const ordersAPI = { /* ... */ };
export const analyticsAPI = { /* ... */ };
export const dashboardAPI = { /* ... */ };

export default api;