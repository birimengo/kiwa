const mongoose = require('mongoose');

/**
 * Middleware to automatically filter queries by the logged-in user
 * Can filter by different fields (soldBy, createdBy, processedBy, etc.)
 */
module.exports = function(filterField = 'user') {
  return function(req, res, next) {
    // ✅ CRITICAL FIX: REMOVED GET-ONLY CHECK - Now works for ALL methods
    
    // Skip if no user in request
    if (!req.user || !req.user._id) {
      return next();
    }
    
    // Create or modify the query object
    if (!req.query) {
      req.query = {};
    }
    
    // Convert string ID to ObjectId if needed
    const userId = mongoose.Types.ObjectId.isValid(req.user._id) 
      ? req.user._id 
      : new mongoose.Types.ObjectId(req.user._id);
    
    // ============================================
    // CRITICAL SECURITY FIX: Handle different request methods
    // ============================================
    
    // For GET requests: Filter query results
    if (req.method === 'GET') {
      // For non-admin users, always filter by their own data
      if (req.user.role !== 'admin') {
        req.query[filterField] = userId;
        console.log(`🔒 [filterByUser] GET - Non-admin filtered by ${filterField}: ${userId}`);
        return next();
      }
      
      // For admin users:
      // 1. If query param 'view=my' is present, show only their data
      // 2. Otherwise, don't filter (admin sees all)
      if (req.query.view === 'my') {
        req.query[filterField] = userId;
        delete req.query.view; // Remove the view param from query
        console.log(`🔒 [filterByUser] GET - Admin personal view filtered by ${filterField}: ${userId}`);
      } else {
        console.log(`🔒 [filterByUser] GET - Admin system view, no filter applied`);
      }
    }
    
    // For POST/PUT/PATCH/DELETE requests: Ensure data security
    else if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) {
      // For non-admin users: Prevent them from affecting other users' data
      if (req.user.role !== 'admin') {
        // For POST: Force current user as the owner
        if (req.method === 'POST' && req.body) {
          req.body[filterField] = userId;
          console.log(`🔒 [filterByUser] POST - Non-admin forced ${filterField} to: ${userId}`);
        }
        
        // For PUT/PATCH: Prevent changing ownership
        else if ((req.method === 'PUT' || req.method === 'PATCH') && req.body) {
          if (req.body[filterField] && req.body[filterField] !== userId.toString()) {
            console.log(`🚨 [filterByUser] SECURITY: Non-admin user ${userId} tried to change ${filterField} to ${req.body[filterField]}`);
            delete req.body[filterField]; // Remove unauthorized change
          }
        }
        
        // For DELETE: Add user filter to ensure they can only delete their own data
        else if (req.method === 'DELETE') {
          req.query[filterField] = userId;
          console.log(`🔒 [filterByUser] DELETE - Non-admin can only delete their own ${filterField} data`);
        }
      }
      
      // For admin users in personal view
      else if (req.user.role === 'admin' && (req.query.view === 'my' || req.path.includes('/admin/') || req.path.includes('/my/'))) {
        // For POST in personal view: Set admin as owner
        if (req.method === 'POST' && req.body) {
          req.body[filterField] = userId;
          console.log(`🔒 [filterByUser] POST - Admin personal view set ${filterField} to: ${userId}`);
        }
        
        // For other methods in personal view: Filter by admin
        else if (req.method !== 'POST') {
          req.query[filterField] = userId;
          console.log(`🔒 [filterByUser] ${req.method} - Admin personal view filtered by ${filterField}: ${userId}`);
        }
      }
    }
    
    next();
  };
};

/**
 * Strict middleware - always filters by user, even for admins
 */
module.exports.strict = function(filterField = 'user') {
  return function(req, res, next) {
    // ✅ CRITICAL FIX: REMOVED GET-ONLY CHECK - Now works for ALL methods
    
    // Skip if no user in request
    if (!req.user || !req.user._id) {
      return next();
    }
    
    // Create or modify the query object
    if (!req.query) {
      req.query = {};
    }
    
    // Convert string ID to ObjectId if needed
    const userId = mongoose.Types.ObjectId.isValid(req.user._id) 
      ? req.user._id 
      : new mongoose.Types.ObjectId(req.user._id);
    
    // ============================================
    // STRICT FILTERING FOR ALL METHODS
    // ============================================
    
    // For GET requests: Always filter by user ID
    if (req.method === 'GET') {
      req.query[filterField] = userId;
      console.log(`🔒 [filterByUser.strict] GET - Strict filtered by ${filterField}: ${userId}`);
    }
    
    // For POST/PUT/PATCH/DELETE requests: Strict security checks
    else if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) {
      // For POST: Always set current user as owner
      if (req.method === 'POST' && req.body) {
        req.body[filterField] = userId;
        console.log(`🔒 [filterByUser.strict] POST - Strict set ${filterField} to: ${userId}`);
      }
      
      // For PUT/PATCH: Prevent ownership changes and filter query
      else if ((req.method === 'PUT' || req.method === 'PATCH') && req.body) {
        req.query[filterField] = userId; // Filter query
        if (req.body[filterField] && req.body[filterField] !== userId.toString()) {
          console.log(`🚨 [filterByUser.strict] SECURITY: Strict mode - user tried to change ${filterField}`);
          delete req.body[filterField]; // Remove ownership change attempt
        }
        console.log(`🔒 [filterByUser.strict] ${req.method} - Strict update filtered by ${filterField}: ${userId}`);
      }
      
      // For DELETE: Only allow deleting own data
      else if (req.method === 'DELETE') {
        req.query[filterField] = userId;
        console.log(`🔒 [filterByUser.strict] DELETE - Strict delete filtered by ${filterField}: ${userId}`);
      }
    }
    
    next();
  };
};