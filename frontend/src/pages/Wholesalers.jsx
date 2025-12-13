// src/pages/Wholesalers.jsx
import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { enhancedWholesalersAPI } from '../services/api';
import { Link } from 'react-router-dom';
import { Building, Phone, Mail, Calendar, CheckCircle, XCircle, User, Search, Package, RefreshCw, X, MessageCircle, ChevronDown, Filter } from 'lucide-react';
import SEO from '../components/SEO';

const Wholesalers = () => {
  const { user } = useAuth();
  const [wholesalers, setWholesalers] = useState([]);
  const [filteredWholesalers, setFilteredWholesalers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState('name');
  const [showSortDropdown, setShowSortDropdown] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  useEffect(() => {
    fetchWholesalers();
  }, []);

  useEffect(() => {
    filterAndSortWholesalers();
  }, [wholesalers, searchTerm, sortBy]);

  const fetchWholesalers = async () => {
    try {
      setIsRefreshing(true);
      setError('');
      
      const response = await enhancedWholesalersAPI.getWholesalers();
      
      if (response.data.success) {
        let wholesalersData = response.data.wholesalers || [];
        
        wholesalersData = wholesalersData.map(wholesaler => ({
          ...wholesaler,
          isActive: wholesaler.isActive !== undefined ? wholesaler.isActive : true
        }));
        
        setWholesalers(wholesalersData);
      } else {
        setError('Failed to fetch wholesalers');
      }
    } catch (err) {
      console.error('Error fetching wholesalers:', err);
      setError(err.userMessage || 'Failed to load wholesalers. Please try again.');
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  };

  const filterAndSortWholesalers = () => {
    let filtered = [...wholesalers];

    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase().trim();
      filtered = filtered.filter(wholesaler =>
        wholesaler.name?.toLowerCase().includes(term) ||
        wholesaler.email?.toLowerCase().includes(term) ||
        (wholesaler.phone && wholesaler.phone.toLowerCase().includes(term))
      );
    }

    filtered.sort((a, b) => {
      switch (sortBy) {
        case 'recent':
          const dateA = a.lastLogin || a.updatedAt || a.createdAt;
          const dateB = b.lastLogin || b.updatedAt || b.createdAt;
          return new Date(dateB || 0) - new Date(dateA || 0);
        case 'oldest':
          return new Date(a.createdAt || 0) - new Date(b.createdAt || 0);
        case 'name':
        default:
          return (a.name || '').localeCompare(b.name || '');
      }
    });

    setFilteredWholesalers(filtered);
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'Unknown';
    
    try {
      const date = new Date(dateString);
      if (isNaN(date.getTime())) return 'Unknown';
      
      return date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric'
      });
    } catch (error) {
      return 'Unknown';
    }
  };

  const formatLastLogin = (dateString) => {
    if (!dateString) return 'Never';
    
    try {
      const date = new Date(dateString);
      if (isNaN(date.getTime())) return 'Never';
      
      const now = new Date();
      const diffMs = now - date;
      const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
      const diffHours = Math.floor((diffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      const diffMinutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
      
      if (diffDays > 0) {
        return `${diffDays}d ago`;
      } else if (diffHours > 0) {
        return `${diffHours}h ago`;
      } else if (diffMinutes > 0) {
        return `${diffMinutes}m ago`;
      } else {
        return 'Just now';
      }
    } catch (error) {
      return 'Never';
    }
  };

  const getActivityStatus = (lastLogin) => {
    if (!lastLogin) return 'text-gray-500 bg-gray-100 dark:bg-gray-800 dark:text-gray-400';
    
    try {
      const date = new Date(lastLogin);
      if (isNaN(date.getTime())) return 'text-gray-500 bg-gray-100 dark:bg-gray-800 dark:text-gray-400';
      
      const now = new Date();
      const diffHours = Math.floor((now - date) / (1000 * 60 * 60));
      
      if (diffHours <= 24) return 'text-green-600 bg-green-100 dark:bg-green-900/20 dark:text-green-400';
      if (diffHours <= 168) return 'text-yellow-600 bg-yellow-100 dark:bg-yellow-900/20 dark:text-yellow-400';
      return 'text-gray-500 bg-gray-100 dark:bg-gray-800 dark:text-gray-400';
    } catch (error) {
      return 'text-gray-500 bg-gray-100 dark:bg-gray-800 dark:text-gray-400';
    }
  };

  const handleRefresh = () => {
    fetchWholesalers();
  };

  const handleClearSearch = () => {
    setSearchTerm('');
  };

  const getSortLabel = (value) => {
    switch (value) {
      case 'recent': return 'Recently Active';
      case 'oldest': return 'Oldest Member';
      default: return 'Sort by Name';
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen theme-bg py-4 sm:py-8 px-3 sm:px-4">
        <div className="max-w-7xl mx-auto">
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-10 w-10 sm:h-12 sm:w-12 border-b-2 border-blue-600 mx-auto"></div>
            <p className="mt-4 theme-text text-sm sm:text-base">Loading wholesalers...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen theme-bg py-4 sm:py-8 px-3 sm:px-4">
      <SEO
        title="Wholesalers - ElectroShop"
        description="Find all wholesalers and their contact information at Kiwa General Electricals. Connect with suppliers for bulk orders."
        keywords="wholesalers, suppliers, contacts, electrical wholesalers, Uganda, Kiwa General Electricals"
      />
      
      <div className="max-w-7xl mx-auto">
        {/* Header - Mobile Compact */}
        <div className="mb-6">
          <div className="flex flex-col space-y-4 sm:space-y-0 sm:flex-row sm:items-center sm:justify-between mb-4">
            <div className="flex-1 min-w-0">
              <h1 className="text-2xl sm:text-3xl font-bold theme-text truncate">Wholesalers</h1>
              <p className="theme-text-muted text-sm sm:text-base truncate">
                Connect with authorized wholesalers
              </p>
            </div>
            <div className="flex items-center justify-between sm:justify-end gap-2">
              <div className="text-xs sm:text-sm theme-text-muted whitespace-nowrap">
                {wholesalers.length} total
              </div>
              <button
                onClick={handleRefresh}
                disabled={isRefreshing}
                className="bg-blue-600 hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600 text-white px-3 py-1.5 sm:px-4 sm:py-2 rounded-lg text-xs sm:text-sm font-medium transition-colors flex items-center gap-1.5 sm:gap-2 disabled:opacity-50"
              >
                <RefreshCw className={`h-3.5 w-3.5 sm:h-4 sm:w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
                <span className="hidden sm:inline">Refresh</span>
                <span className="sm:hidden">Ref</span>
              </button>
            </div>
          </div>

          {/* Search and Filter Bar - Mobile Optimized */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-6">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-3.5 w-3.5 sm:h-4 sm:w-4 theme-text-muted" />
              <input
                type="text"
                placeholder="Search wholesalers..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-9 sm:pl-10 pr-8 sm:pr-10 py-2 text-sm theme-surface border theme-border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              {searchTerm && (
                <button
                  onClick={handleClearSearch}
                  className="absolute right-2.5 sm:right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                >
                  <X className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                </button>
              )}
            </div>

            {/* Mobile Dropdown for Sort */}
            <div className="relative sm:hidden">
              <button
                onClick={() => setShowSortDropdown(!showSortDropdown)}
                className="w-full theme-surface border theme-border rounded-lg px-3 py-2 text-sm flex items-center justify-between"
              >
                <span className="flex items-center gap-2">
                  <Filter className="h-3.5 w-3.5" />
                  {getSortLabel(sortBy)}
                </span>
                <ChevronDown className={`h-4 w-4 transition-transform ${showSortDropdown ? 'rotate-180' : ''}`} />
              </button>
              
              {showSortDropdown && (
                <div className="absolute z-10 mt-1 w-full theme-surface border theme-border rounded-lg shadow-lg">
                  {['name', 'recent', 'oldest'].map((option) => (
                    <button
                      key={option}
                      onClick={() => {
                        setSortBy(option);
                        setShowSortDropdown(false);
                      }}
                      className={`w-full text-left px-4 py-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-700 ${
                        sortBy === option 
                          ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400' 
                          : 'theme-text'
                      }`}
                    >
                      {getSortLabel(option)}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Desktop Select */}
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="hidden sm:block theme-surface border theme-border rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="name">Sort by Name</option>
              <option value="recent">Recently Active</option>
              <option value="oldest">Oldest Member</option>
            </select>
          </div>
        </div>

        {error && (
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-3 mb-6">
            <div className="flex items-start">
              <XCircle className="h-4 w-4 sm:h-5 sm:w-5 text-red-600 dark:text-red-400 mr-2 mt-0.5 flex-shrink-0" />
              <p className="text-red-700 dark:text-red-300 text-sm sm:text-base">{error}</p>
            </div>
          </div>
        )}

        {/* Stats Summary - Compact Mobile */}
        <div className="grid grid-cols-3 gap-2 sm:gap-4 mb-6">
          <div className="theme-surface rounded-lg p-3">
            <div className="flex items-center">
              <div className="p-1.5 sm:p-2 rounded-lg bg-blue-100 dark:bg-blue-900 mr-2 sm:mr-3">
                <Building className="h-3.5 w-3.5 sm:h-5 sm:w-5 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <p className="text-xs theme-text-muted">Total</p>
                <p className="text-lg sm:text-2xl font-bold theme-text">{wholesalers.length}</p>
              </div>
            </div>
          </div>

          <div className="theme-surface rounded-lg p-3">
            <div className="flex items-center">
              <div className="p-1.5 sm:p-2 rounded-lg bg-green-100 dark:bg-green-900 mr-2 sm:mr-3">
                <CheckCircle className="h-3.5 w-3.5 sm:h-5 sm:w-5 text-green-600 dark:text-green-400" />
              </div>
              <div>
                <p className="text-xs theme-text-muted">Active</p>
                <p className="text-lg sm:text-2xl font-bold theme-text">
                  {wholesalers.filter(w => w.isActive !== false).length}
                </p>
              </div>
            </div>
          </div>

          <div className="theme-surface rounded-lg p-3">
            <div className="flex items-center">
              <div className="p-1.5 sm:p-2 rounded-lg bg-purple-100 dark:bg-purple-900 mr-2 sm:mr-3">
                <Package className="h-3.5 w-3.5 sm:h-5 sm:w-5 text-purple-600 dark:text-purple-400" />
              </div>
              <div>
                <p className="text-xs theme-text-muted">Showing</p>
                <p className="text-lg sm:text-2xl font-bold theme-text">{filteredWholesalers.length}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Search Results Info */}
        {searchTerm && (
          <div className="mb-4 sm:mb-6 p-2 sm:p-3 theme-surface rounded-lg">
            <p className="theme-text text-xs sm:text-sm">
              Found {filteredWholesalers.length} wholesalers matching "{searchTerm}"
            </p>
          </div>
        )}

        {/* Wholesalers Grid - Responsive */}
        {filteredWholesalers.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
            {filteredWholesalers.map((wholesaler) => (
              <div key={wholesaler._id} className="theme-surface rounded-lg overflow-hidden shadow-sm hover:shadow-md transition-shadow duration-300">
                <div className="p-4 sm:p-6">
                  {/* Wholesaler Header - Compact */}
                  <div className="flex items-start mb-3 sm:mb-4">
                    <div className="h-10 w-10 sm:h-12 sm:w-12 rounded-full bg-blue-100 dark:bg-blue-900 flex items-center justify-center mr-3 flex-shrink-0">
                      <User className="h-5 w-5 sm:h-6 sm:w-6 text-blue-600 dark:text-blue-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="text-base sm:text-lg font-semibold theme-text truncate">
                        {wholesaler.name || 'Unknown Name'}
                      </h3>
                      <div className="flex flex-wrap gap-1 mt-1">
                        <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-xs ${
                          wholesaler.isActive !== false
                            ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300'
                            : 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-300'
                        }`}>
                          {wholesaler.isActive !== false ? 'Verified' : 'Wholesaler'}
                        </span>
                        <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-xs ${getActivityStatus(wholesaler.lastLogin)}`}>
                          {formatLastLogin(wholesaler.lastLogin)}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Contact Information - Compact */}
                  <div className="space-y-2 mb-3 sm:mb-4">
                    {wholesaler.email ? (
                      <div className="flex items-center">
                        <Mail className="h-3.5 w-3.5 theme-text-muted mr-2 flex-shrink-0" />
                        <div className="theme-text text-xs sm:text-sm truncate" title={wholesaler.email}>
                          {wholesaler.email}
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center opacity-60">
                        <Mail className="h-3.5 w-3.5 theme-text-muted mr-2 flex-shrink-0" />
                        <span className="theme-text-muted text-xs sm:text-sm">No email</span>
                      </div>
                    )}

                    {wholesaler.phone ? (
                      <div className="flex items-center">
                        <Phone className="h-3.5 w-3.5 theme-text-muted mr-2 flex-shrink-0" />
                        <div className="theme-text text-xs sm:text-sm">
                          {wholesaler.phone}
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center opacity-60">
                        <Phone className="h-3.5 w-3.5 theme-text-muted mr-2 flex-shrink-0" />
                        <span className="theme-text-muted text-xs sm:text-sm">No phone</span>
                      </div>
                    )}

                    <div className="flex items-start">
                      <Calendar className="h-3.5 w-3.5 theme-text-muted mr-2 flex-shrink-0 mt-0.5" />
                      <div>
                        <p className="text-xs theme-text-muted">Member since</p>
                        <p className="theme-text text-xs sm:text-sm">{formatDate(wholesaler.createdAt)}</p>
                      </div>
                    </div>
                  </div>

                  {/* Actions - Responsive with Fixed Contrast */}
                  <div className="flex space-x-2 pt-3 sm:pt-4 border-t theme-border">
                    <Link
                      to={`/wholesaler/${wholesaler._id}/products`}
                      state={{ 
                        wholesalerName: wholesaler.name,
                        wholesalerId: wholesaler._id
                      }}
                      className="flex-1 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 dark:from-blue-500 dark:to-blue-600 dark:hover:from-blue-600 dark:hover:to-blue-700 text-white text-center py-1.5 sm:py-2 px-2 sm:px-3 rounded-lg text-xs sm:text-sm font-medium transition-all duration-200 flex items-center justify-center gap-1 sm:gap-2 shadow-sm"
                      title={`View products from ${wholesaler.name}`}
                    >
                      <Package className="h-3 w-3 sm:h-4 sm:w-4" />
                      <span className="truncate">Products</span>
                    </Link>
                    
                    {wholesaler.phone && (
                      <>
                        <a 
                          href={`tel:${wholesaler.phone}`}
                          className="flex-1 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 text-center py-1.5 sm:py-2 px-2 rounded-lg text-xs sm:text-sm font-medium transition-colors flex items-center justify-center"
                          title="Call"
                        >
                          <Phone className="h-3 w-3 sm:h-4 sm:w-4" />
                          <span className="hidden sm:inline ml-1">Call</span>
                        </a>
                        <a 
                          href={`https://wa.me/${wholesaler.phone.replace(/\D/g, '')}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex-1 border border-green-200 dark:border-green-800 bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200 hover:bg-green-50 hover:text-green-700 dark:hover:bg-green-900/20 dark:hover:text-green-400 text-center py-1.5 sm:py-2 px-2 rounded-lg text-xs sm:text-sm font-medium transition-colors flex items-center justify-center"
                          title="WhatsApp"
                        >
                          <MessageCircle className="h-3 w-3 sm:h-4 sm:w-4" />
                          <span className="hidden sm:inline ml-1">WhatsApp</span>
                        </a>
                      </>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-8 sm:py-12">
            <Building className="h-12 w-12 sm:h-16 sm:w-16 theme-text-muted mx-auto mb-3 sm:mb-4" />
            <h3 className="text-base sm:text-lg font-medium theme-text mb-1 sm:mb-2">
              {searchTerm ? 'No wholesalers found' : 'No wholesalers available'}
            </h3>
            <p className="theme-text-muted text-sm max-w-md mx-auto mb-4 sm:mb-6 px-4">
              {searchTerm 
                ? `No results for "${searchTerm}". Try different keywords.`
                : 'No wholesalers are currently registered in the system.'}
            </p>
            {searchTerm && (
              <button
                onClick={handleClearSearch}
                className="bg-blue-600 hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
              >
                Clear Search
              </button>
            )}
          </div>
        )}

        {/* Help Section - Responsive */}
        <div className="mt-8 sm:mt-12 p-4 sm:p-6 theme-surface rounded-lg">
          <h3 className="text-base sm:text-lg font-semibold theme-text mb-2 sm:mb-3">
            Need help connecting with wholesalers?
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
            <div>
              <p className="theme-text-muted text-sm mb-3 sm:mb-4">
                Contact our support team for assistance with bulk orders or finding specific products.
              </p>
              <div className="space-y-1.5 sm:space-y-2">
                <div className="flex items-center">
                  <Phone className="h-3.5 w-3.5 sm:h-4 sm:w-4 theme-text-muted mr-2 flex-shrink-0" />
                  <span className="theme-text text-xs sm:text-sm">+256 754 535 493</span>
                </div>
                <div className="flex items-center">
                  <Mail className="h-3.5 w-3.5 sm:h-4 sm:w-4 theme-text-muted mr-2 flex-shrink-0" />
                  <span className="theme-text text-xs sm:text-sm truncate">gogreenuganda70@gmail.com</span>
                </div>
              </div>
            </div>
            <div>
              <h4 className="font-medium theme-text text-sm sm:text-base mb-1.5 sm:mb-2">Contact Tips:</h4>
              <ul className="space-y-1 text-xs sm:text-sm theme-text-muted">
                <li className="flex items-start">
                  <span className="mr-2">•</span>
                  <span>Specify quantities for bulk orders</span>
                </li>
                <li className="flex items-start">
                  <span className="mr-2">•</span>
                  <span>Ask about minimum order requirements</span>
                </li>
                <li className="flex items-start">
                  <span className="mr-2">•</span>
                  <span>Inquire about delivery terms</span>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Wholesalers;