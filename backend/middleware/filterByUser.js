const mongoose = require('mongoose');

/**
 * Middleware to automatically filter queries by the logged-in user
 * Can filter by different fields (soldBy, createdBy, processedBy, etc.)
 */
module.exports = function(filterField = 'user') {
  return function(req, res, next) {
    // Skip if not a GET request
    if (req.method !== 'GET') {
      return next();
    }
    
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
    
    // For non-admin users, always filter by their own data
    if (req.user.role !== 'admin') {
      req.query[filterField] = userId;
      return next();
    }
    
    // For admin users:
    // 1. If query param 'view=my' is present, show only their data
    // 2. Otherwise, don't filter (admin sees all)
    if (req.query.view === 'my') {
      req.query[filterField] = userId;
      delete req.query.view; // Remove the view param from query
    }
    
    next();
  };
};

/**
 * Strict middleware - always filters by user, even for admins
 */
module.exports.strict = function(filterField = 'user') {
  return function(req, res, next) {
    // Skip if not a GET request
    if (req.method !== 'GET') {
      return next();
    }
    
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
    
    // Always filter by user ID
    req.query[filterField] = userId;
    
    next();
  };
};