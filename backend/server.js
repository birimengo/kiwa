const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');

// Load env vars
dotenv.config();

// Connect to database
const connectDB = require('./config/database');
connectDB();

const app = express();

// SIMPLE CORS CONFIGURATION - ALLOW ALL ORIGINS
app.use(cors({
  origin: true, // Allow all origins in production and development
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
}));

// Body parser middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Import all route files
const authRoutes = require('./routes/auth');
const productRoutes = require('./routes/products');
const saleRoutes = require('./routes/sales');
const adminRoutes = require('./routes/admin');
const analyticsRoutes = require('./routes/analytics');
const dashboardRoutes = require('./routes/dashboard');
const orderRoutes = require('./routes/orders');
const notificationRoutes = require('./routes/notifications');
// const cartRoutes = require('./routes/cart'); // COMMENT OUT FOR NOW

// Route middleware
app.use('/api/auth', authRoutes);
app.use('/api/products', productRoutes);
app.use('/api/sales', saleRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/notifications', notificationRoutes);
// app.use('/api/cart', cartRoutes); // COMMENT OUT FOR NOW

// Health check route
app.get('/api/health', (req, res) => {
  res.json({
    success: true,
    message: 'Server is running and accessible from all devices',
    timestamp: new Date().toISOString(),
    database: 'Connected to MongoDB Atlas',
    environment: process.env.NODE_ENV,
    version: '1.0.0',
    cors: 'All origins allowed',
    clientOrigin: req.headers.origin || 'No origin header',
    endpoints: [
      '/api/auth',
      '/api/products', 
      '/api/sales',
      '/api/admin',
      '/api/analytics',
      '/api/dashboard',
      '/api/orders',
      '/api/notifications',
      // '/api/cart' // COMMENT OUT FOR NOW
    ]
  });
});

// API documentation route
app.get('/api', (req, res) => {
  res.json({
    success: true,
    message: 'Electronics Store API - Accessible from all devices',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
    documentation: 'All API endpoints are protected except /api/health',
    endpoints: {
      auth: {
        base: '/api/auth',
        endpoints: {
          login: 'POST /api/auth/login',
          register: 'POST /api/auth/register',
          profile: 'GET /api/auth/profile',
          changePassword: 'PUT /api/auth/password'
        }
      },
      products: {
        base: '/api/products',
        endpoints: {
          getAll: 'GET /api/products',
          getSingle: 'GET /api/products/:id',
          create: 'POST /api/products',
          update: 'PUT /api/products/:id',
          delete: 'DELETE /api/products/:id',
          like: 'POST /api/products/:id/like',
          comment: 'POST /api/products/:id/comments',
          restock: 'POST /api/products/:id/restock',
          stockHistory: 'GET /api/products/:id/stock-history',
          featured: 'GET /api/products/featured',
          byCategory: 'GET /api/products/category/:category',
          stats: 'GET /api/products/stats',
          adminStats: 'GET /api/products/admin/stats',
          performance: 'GET /api/products/:id/performance?period=week'
        }
      },
      sales: {
        base: '/api/sales',
        endpoints: {
          getAll: 'GET /api/sales',
          getSingle: 'GET /api/sales/:id',
          create: 'POST /api/sales',
          update: 'PUT /api/sales/:id',
          delete: 'DELETE /api/sales/:id',
          updatePayment: 'PUT /api/sales/:id/payment',
          cancel: 'PUT /api/sales/:id/cancel',
          resume: 'PUT /api/sales/:id/resume',
          stats: 'GET /api/sales/stats',
          analytics: 'GET /api/sales/analytics'
        }
      },
      orders: {
        base: '/api/orders',
        endpoints: {
          getAll: 'GET /api/orders (Admin only)',
          getSingle: 'GET /api/orders/:id',
          create: 'POST /api/orders',
          update: 'PUT /api/orders/:id',
          delete: 'DELETE /api/orders/:id',
          updateStatus: 'PUT /api/orders/:id/status (Admin only)',
          cancel: 'PUT /api/orders/:id/cancel',
          process: 'PUT /api/orders/:id/process (Admin only)',
          deliver: 'PUT /api/orders/:id/deliver (Admin only)',
          reject: 'PUT /api/orders/:id/reject (Admin only)',
          confirmDelivery: 'PUT /api/orders/:id/confirm-delivery',
          myOrders: 'GET /api/orders/my-orders',
          stats: 'GET /api/orders/stats (Admin only)',
          dashboardStats: 'GET /api/orders/dashboard/stats (Admin only)'
        }
      },
      notifications: {
        base: '/api/notifications',
        endpoints: {
          getAll: 'GET /api/notifications',
          getSingle: 'GET /api/notifications/:id',
          delete: 'DELETE /api/notifications/:id',
          clearAll: 'DELETE /api/notifications',
          markAsRead: 'PUT /api/notifications/:id/read',
          markAllAsRead: 'PUT /api/notifications/read-all',
          unreadCount: 'GET /api/notifications/unread-count'
        }
      },
      // cart: { // COMMENT OUT FOR NOW
      //   base: '/api/cart',
      //   endpoints: {
      //     getCart: 'GET /api/cart',
      //     addToCart: 'POST /api/cart',
      //     updateCartItem: 'PUT /api/cart/:productId',
      //     removeFromCart: 'DELETE /api/cart/:productId',
      //     clearCart: 'DELETE /api/cart'
      //   }
      // },
      admin: {
        base: '/api/admin',
        endpoints: {
          dashboard: 'GET /api/admin/dashboard',
          users: 'GET /api/admin/users',
          createAdmin: 'POST /api/admin/create-admin (Unprotected for setup)',
          updateUserRole: 'PUT /api/admin/users/:id/role',
          toggleUserStatus: 'PUT /api/admin/users/:id/status'
        }
      },
      analytics: {
        base: '/api/analytics',
        endpoints: {
          salesOverview: 'GET /api/analytics/sales/overview',
          productAnalytics: 'GET /api/analytics/products',
          inventoryAnalytics: 'GET /api/analytics/inventory',
          performanceMetrics: 'GET /api/analytics/performance',
          dailyPerformance: 'GET /api/analytics/daily-performance',
          productTracking: 'GET /api/analytics/product-tracking'
        }
      },
      dashboard: {
        base: '/api/dashboard',
        endpoints: {
          overview: 'GET /api/dashboard/overview',
          quickStats: 'GET /api/dashboard/quick-stats',
          recentActivity: 'GET /api/dashboard/recent-activity'
        }
      },
      health: {
        base: '/api/health',
        endpoints: {
          check: 'GET /api/health'
        }
      }
    }
  });
});

// Handle undefined routes
app.use((req, res, next) => {
  res.status(404).json({
    success: false,
    message: `Route not found: ${req.method} ${req.originalUrl}`,
    timestamp: new Date().toISOString(),
    availableEndpoints: [
      '/api',
      '/api/health',
      '/api/auth',
      '/api/products', 
      '/api/sales',
      '/api/admin',
      '/api/analytics',
      '/api/dashboard',
      '/api/orders',
      '/api/notifications',
      // '/api/cart' // COMMENT OUT FOR NOW
    ]
  });
});

// Error handling middleware
app.use((error, req, res, next) => {
  console.error('🚨 Server Error:', {
    message: error.message,
    stack: error.stack,
    method: req.method,
    url: req.originalUrl,
    ip: req.ip,
    timestamp: new Date().toISOString()
  });
  
  // Mongoose validation error
  if (error.name === 'ValidationError') {
    const errors = Object.values(error.errors).map(err => err.message);
    return res.status(400).json({
      success: false,
      message: 'Validation Error',
      errors,
      timestamp: new Date().toISOString()
    });
  }
  
  // Mongoose duplicate key error
  if (error.code === 11000) {
    const field = Object.keys(error.keyValue)[0];
    const value = error.keyValue[field];
    return res.status(400).json({
      success: false,
      message: `${field} '${value}' already exists`,
      timestamp: new Date().toISOString()
    });
  }
  
  // Mongoose cast error (invalid ObjectId)
  if (error.name === 'CastError') {
    return res.status(400).json({
      success: false,
      message: `Invalid ID format: ${error.value}`,
      timestamp: new Date().toISOString()
    });
  }
  
  // JWT errors
  if (error.name === 'JsonWebTokenError') {
    return res.status(401).json({
      success: false,
      message: 'Invalid authentication token',
      timestamp: new Date().toISOString()
    });
  }
  
  if (error.name === 'TokenExpiredError') {
    return res.status(401).json({
      success: false,
      message: 'Authentication token has expired',
      timestamp: new Date().toISOString()
    });
  }
  
  // Default error
  res.status(error.statusCode || 500).json({
    success: false,
    message: error.message || 'Internal Server Error',
    timestamp: new Date().toISOString(),
    ...(process.env.NODE_ENV === 'development' && { 
      stack: error.stack,
      errorDetails: {
        name: error.name,
        code: error.code
      }
    })
  });
});

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`🌐 MongoDB: Connected to Atlas cluster`);
  console.log(`🔗 Health check: http://localhost:${PORT}/api/health`);
  console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`✅ CORS: All origins allowed (all devices can access)`);
  console.log(`📊 Available API endpoints:`);
  console.log(`   • http://localhost:${PORT}/api`);
  console.log(`   • http://localhost:${PORT}/api/health`);
  console.log(`   • http://localhost:${PORT}/api/auth`);
  console.log(`   • http://localhost:${PORT}/api/products`);
  console.log(`   • http://localhost:${PORT}/api/sales`);
  console.log(`   • http://localhost:${PORT}/api/admin`);
  console.log(`   • http://localhost:${PORT}/api/analytics`);
  console.log(`   • http://localhost:${PORT}/api/dashboard`);
  console.log(`   • http://localhost:${PORT}/api/orders`);
  console.log(`   • http://localhost:${PORT}/api/notifications`);
  // console.log(`   • http://localhost:${PORT}/api/cart`); // COMMENT OUT FOR NOW
});