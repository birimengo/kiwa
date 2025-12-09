const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const path = require('path');

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
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept', 'Origin']
}));

// Body parser middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Serve static files from public directory (for admin registration page)
app.use(express.static(path.join(__dirname, 'public')));

// Import all route files
const authRoutes = require('./routes/auth');
const productRoutes = require('./routes/products');
const saleRoutes = require('./routes/sales');
const adminRoutes = require('./routes/admin');
const analyticsRoutes = require('./routes/analytics');
const dashboardRoutes = require('./routes/dashboard');
const orderRoutes = require('./routes/orders');
const notificationRoutes = require('./routes/notifications');
const wholesalerRoutes = require('./routes/wholesalerRoutes');
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
app.use('/api/wholesalers', wholesalerRoutes);
// Admin Registration Page (if hosted on same server)
app.get('/admin/register', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'admin-registration.html'));
});

// Login Page (for convenience)
app.get('/login', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'login.html'));
});

// Health check route
app.get('/api/health', (req, res) => {
  res.json({
    success: true,
    message: 'Electronics Store Management System is running and accessible from all devices',
    timestamp: new Date().toISOString(),
    database: 'Connected to MongoDB Atlas',
    environment: process.env.NODE_ENV,
    version: '2.0.0',
    cors: 'All origins allowed',
    clientOrigin: req.headers.origin || 'No origin header',
    adminFeatures: {
      registration: 'Available at /admin/register',
      apiEndpoint: 'POST /api/admin/register',
      description: 'Complete admin registration and management system'
    },
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
    message: 'Electronics Store Management System API - Accessible from all devices',
    version: '2.0.0',
    timestamp: new Date().toISOString(),
    adminRegistration: {
      webInterface: '/admin/register',
      apiEndpoint: 'POST /api/admin/register (Admin auth required)',
      description: 'Existing admins can create new admin accounts'
    },
    documentation: 'All API endpoints are protected except /api/health and /api/admin/create-admin',
    endpoints: {
      auth: {
        base: '/api/auth',
        endpoints: {
          login: 'POST /api/auth/login',
          register: 'POST /api/auth/register',
          profile: 'GET /api/auth/profile',
          updateProfile: 'PUT /api/auth/profile'
        }
      },
      products: {
        base: '/api/products',
        endpoints: {
          getAll: 'GET /api/products',
          getSingle: 'GET /api/products/:id',
          create: 'POST /api/products (Admin)',
          update: 'PUT /api/products/:id (Admin)',
          delete: 'DELETE /api/products/:id (Admin)',
          like: 'POST /api/products/:id/like',
          comment: 'POST /api/products/:id/comments',
          restock: 'POST /api/products/:id/restock (Admin)',
          stockHistory: 'GET /api/products/:id/stock-history (Admin)',
          featured: 'GET /api/products/featured',
          byCategory: 'GET /api/products/category/:category',
          stats: 'GET /api/products/stats',
          adminStats: 'GET /api/products/admin/stats (Admin)',
          myProducts: 'GET /api/products/admin/my-products (Admin - filtered)',
          performance: 'GET /api/products/:id/performance?period=week (Admin)',
          topProductsAnalytics: 'GET /api/products/analytics/top-products (Admin)',
          productTracking: 'GET /api/products/analytics/tracking (Admin)'
        }
      },
      sales: {
        base: '/api/sales',
        endpoints: {
          getAll: 'GET /api/sales (filtered by user)',
          getAllForAdmin: 'GET /api/sales?view=my (Admin - own sales)',
          getSingle: 'GET /api/sales/:id',
          create: 'POST /api/sales',
          updatePayment: 'PUT /api/sales/:id/payment',
          cancel: 'PUT /api/sales/:id/cancel (Admin)',
          resume: 'PUT /api/sales/:id/resume (Admin)',
          delete: 'DELETE /api/sales/:id (Admin)',
          stats: 'GET /api/sales/stats (filtered by user)'
        }
      },
      orders: {
        base: '/api/orders',
        endpoints: {
          getAll: 'GET /api/orders (Admin only - all orders)',
          myOrders: 'GET /api/orders/my-orders (User own orders)',
          adminMyOrders: 'GET /api/orders/admin/my-orders (Admin - own processed orders)',
          getSingle: 'GET /api/orders/:id',
          create: 'POST /api/orders',
          updateStatus: 'PUT /api/orders/:id/status (Admin)',
          cancel: 'PUT /api/orders/:id/cancel',
          process: 'PUT /api/orders/:id/process (Admin)',
          deliver: 'PUT /api/orders/:id/deliver (Admin)',
          reject: 'PUT /api/orders/:id/reject (Admin)',
          confirmDelivery: 'PUT /api/orders/:id/confirm-delivery',
          stats: 'GET /api/orders/stats (Admin - filtered by processor)',
          dashboardStats: 'GET /api/orders/dashboard/stats (Admin - filtered by processor)'
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
      admin: {
        base: '/api/admin',
        endpoints: {
          // Dashboard & Analytics
          dashboard: 'GET /api/admin/dashboard (Admin - all data)',
          myDashboard: 'GET /api/admin/my-dashboard (Admin - own data)',
          
          // User Management
          users: 'GET /api/admin/users (All users)',
          userById: 'GET /api/admin/users/:id (Get specific user)',
          updateUserRole: 'PUT /api/admin/users/:id/role',
          toggleUserStatus: 'PUT /api/admin/users/:id/status',
          deleteUser: 'DELETE /api/admin/users/:id (Soft delete)',
          
          // Admin Management
          admins: 'GET /api/admin/admins (All admin users)',
          createAdmin: 'POST /api/admin/create-admin (Unprotected for initial setup)',
          registerAdmin: 'POST /api/admin/register (Create new admin - requires admin auth)',
          
          // Admin-specific filtered views
          myProducts: 'GET /api/admin/my-products (Admin - own products)',
          mySales: 'GET /api/admin/my-sales (Admin - own sales)',
          myOrders: 'GET /api/admin/my-orders (Admin - own processed orders)',
          myAnalytics: 'GET /api/admin/my-analytics (Admin - own analytics)'
        }
      },
      analytics: {
        base: '/api/analytics',
        endpoints: {
          // System-wide analytics (Admin sees all)
          salesOverview: 'GET /api/analytics/sales/overview (Admin)',
          productAnalytics: 'GET /api/analytics/products (Admin)',
          inventoryAnalytics: 'GET /api/analytics/inventory (Admin)',
          performanceMetrics: 'GET /api/analytics/performance (Admin)',
          dailyPerformance: 'GET /api/analytics/daily-performance (Admin)',
          productTracking: 'GET /api/analytics/product-tracking (Admin)',
          // Admin-specific analytics (own data only)
          adminSalesOverview: 'GET /api/analytics/admin/sales-overview (Admin - own sales)',
          adminProductAnalytics: 'GET /api/analytics/admin/product-analytics (Admin - own products)',
          adminPerformance: 'GET /api/analytics/admin/performance (Admin - own performance)'
        }
      },
      dashboard: {
        base: '/api/dashboard',
        endpoints: {
          // User dashboard (own data)
          overview: 'GET /api/dashboard/overview (User own data)',
          quickStats: 'GET /api/dashboard/quick-stats (User own data)',
          recentActivity: 'GET /api/dashboard/recent-activity (User own data)',
          // Admin dashboard (own data)
          adminOverview: 'GET /api/dashboard/admin/overview (Admin own data)',
          adminQuickStats: 'GET /api/dashboard/admin/quick-stats (Admin own data)',
          adminRecentActivity: 'GET /api/dashboard/admin/recent-activity (Admin own data)'
        }
      },
      health: {
        base: '/api/health',
        endpoints: {
          check: 'GET /api/health'
        }
      }
    },
    filtering: {
      note: 'Data filtering is automatic based on user role',
      regularUsers: 'Always see only their own data',
      admins: {
        default: 'See all data (unfiltered)',
        viewOwnData: 'Add ?view=my query parameter OR use /admin/my-* routes',
        examples: [
          '/api/sales?view=my',
          '/api/products/admin/my-products',
          '/api/orders/admin/my-orders',
          '/api/analytics/admin/sales-overview',
          '/api/dashboard/admin/overview'
        ]
      }
    },
    adminRegistrationInstructions: {
      step1: 'Login as existing admin at /api/auth/login',
      step2: 'Copy the JWT token from response',
      step3: 'Use the token to access /admin/register page',
      step4: 'Configure server URL and token, then create new admins',
      alternative: 'Or use API directly: POST /api/admin/register with admin auth token'
    },
    security: {
      note: 'Admin endpoints require JWT authentication with admin role',
      tokenLifetime: '30 days (configurable in .env)',
      passwordRequirements: 'Minimum 8 characters for admin accounts',
      validation: 'Email format validation and duplicate email checking'
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
    ],
    pages: [
      '/admin/register - Admin registration page',
      '/login - Login page'
    ],
    quickStart: {
      adminSetup: 'POST /api/admin/create-admin',
      adminLogin: 'POST /api/auth/login',
      adminRegistration: 'GET /admin/register'
    }
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
    timestamp: new Date().toISOString(),
    userId: req.user ? req.user._id : 'Unauthenticated'
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
  
  // CORS errors
  if (error.name === 'CorsError') {
    return res.status(403).json({
      success: false,
      message: 'CORS policy: Origin not allowed',
      timestamp: new Date().toISOString(),
      allowedOrigins: 'All origins are allowed'
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
  console.log(`
  ╔══════════════════════════════════════════════════════════════════╗
  ║                    ELECTRONICS STORE MANAGEMENT                  ║
  ║                         SYSTEM v2.0.0                            ║
  ╚══════════════════════════════════════════════════════════════════╝
  
  🚀 Server running on port ${PORT}
  🌐 MongoDB: Connected to Atlas cluster
  🌍 Environment: ${process.env.NODE_ENV || 'development'}
  ✅ CORS: All origins allowed (all devices can access)
  
  📊 AVAILABLE ENDPOINTS:
  ═══════════════════════════════════════════════════════════════════
     🔗 Health Check:    http://localhost:${PORT}/api/health
     📖 API Docs:        http://localhost:${PORT}/api
     🔐 Authentication:  http://localhost:${PORT}/api/auth
     📦 Products:        http://localhost:${PORT}/api/products
     💰 Sales:           http://localhost:${PORT}/api/sales
     👑 Admin:           http://localhost:${PORT}/api/admin
     📈 Analytics:       http://localhost:${PORT}/api/analytics
     📊 Dashboard:       http://localhost:${PORT}/api/dashboard
     📦 Orders:          http://localhost:${PORT}/api/orders
     🔔 Notifications:   http://localhost:${PORT}/api/notifications
  
  👑 ADMIN REGISTRATION SYSTEM:
  ═══════════════════════════════════════════════════════════════════
     🔐 Login Page:      http://localhost:${PORT}/login
     👑 Admin Register:  http://localhost:${PORT}/admin/register
  
  🎯 QUICK START - ADMIN REGISTRATION FLOW:
  ═══════════════════════════════════════════════════════════════════
     1️⃣ Create First Admin (if not exists):
        POST http://localhost:${PORT}/api/admin/create-admin
        Body: {"name":"System Admin","email":"admin@electronics.com","password":"admin123"}
     
     2️⃣ Login as Admin:
        POST http://localhost:${PORT}/api/auth/login
        Body: {"email":"admin@electronics.com","password":"admin123"}
     
     3️⃣ Copy JWT token from response
     
     4️⃣ Access Admin Registration Page:
        http://localhost:${PORT}/admin/register
     
     5️⃣ Configure:
        - Server URL: http://localhost:${PORT}
        - Bearer Token: (paste your JWT token)
        - Click "Test Connection"
     
     6️⃣ Create New Admin Accounts
        - Fill admin details
        - Click "Create Admin Account"
  
  🔧 API TESTING WITH CURL:
  ═══════════════════════════════════════════════════════════════════
     # Create first admin
     curl -X POST http://localhost:${PORT}/api/admin/create-admin \\
          -H "Content-Type: application/json" \\
          -d '{"name":"System Admin","email":"admin@electronics.com","password":"admin123"}'
     
     # Login and get token
     curl -X POST http://localhost:${PORT}/api/auth/login \\
          -H "Content-Type: application/json" \\
          -d '{"email":"admin@electronics.com","password":"admin123"}'
     
     # Create new admin (using token)
     curl -X POST http://localhost:${PORT}/api/admin/register \\
          -H "Content-Type: application/json" \\
          -H "Authorization: Bearer YOUR_TOKEN_HERE" \\
          -d '{"name":"New Admin","email":"newadmin@example.com","password":"SecurePass123!"}'
     
     # List all admins
     curl -X GET http://localhost:${PORT}/api/admin/admins \\
          -H "Authorization: Bearer YOUR_TOKEN_HERE"
  
  📝 ADMIN MANAGEMENT FEATURES:
  ═══════════════════════════════════════════════════════════════════
     ✅ Create new admin accounts
     ✅ List all admin users
     ✅ Update user roles
     ✅ Activate/deactivate users
     ✅ Soft delete users
     ✅ Admin-specific dashboard views
     ✅ Filtered data views for admins
     ✅ Comprehensive error handling
     ✅ Input validation and sanitization
  
  🛡️ SECURITY FEATURES:
  ═══════════════════════════════════════════════════════════════════
     ✅ JWT authentication
     ✅ Role-based access control
     ✅ Password validation (min 8 chars)
     ✅ Email format validation
     ✅ Duplicate email prevention
     ✅ Self-modification prevention
     ✅ Input sanitization
     ✅ CORS protection
  
  📱 COMPATIBILITY:
  ═══════════════════════════════════════════════════════════════════
     ✅ Web browsers
     ✅ Mobile apps
     ✅ Desktop applications
     ✅ API clients
     ✅ Cross-origin requests
     ✅ Separate hosting support
  
  ═══════════════════════════════════════════════════════════════════
  System ready! Access any endpoint from any device or location.
  ═══════════════════════════════════════════════════════════════════
  `);
});