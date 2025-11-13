import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { Filter, Grid, List, ChevronDown, AlertCircle, RefreshCw, Search } from 'lucide-react';
import ProductCard from '../components/products/ProductCard';
import { productsAPI } from '../services/api';

const Products = () => {
  const [products, setProducts] = useState([]);
  const [allProducts, setAllProducts] = useState([]); // Store all products for client-side filtering
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState('');
  const [priceRange, setPriceRange] = useState('');
  const [sortBy, setSortBy] = useState('newest');
  const [viewMode, setViewMode] = useState('grid');
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [error, setError] = useState('');
  const [backendConnected, setBackendConnected] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  
  const location = useLocation();
  const abortControllerRef = useRef(null);
  const searchTimeoutRef = useRef(null);
  
  // Get search query from URL parameters
  const getSearchQueryFromURL = useCallback(() => {
    const searchParams = new URLSearchParams(location.search);
    return searchParams.get('search') || '';
  }, [location.search]);

  // Single fetch function with abort controller
  const fetchProducts = useCallback(async (searchQuery = '', category = '', priceFilter = '', sortOption = 'newest') => {
    // Cancel previous request if it exists
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    
    // Create new abort controller
    abortControllerRef.current = new AbortController();
    
    setLoading(true);
    setError('');
    
    try {
      const params = {
        page: 1,
        limit: 100 // Get more products for client-side filtering
      };
      
      if (category && category !== 'All') params.category = category.toLowerCase();
      
      console.log('🔄 Fetching products with params:', params);
      
      // Pass signal to axios for cancellation
      const response = await productsAPI.getProducts(params, {
        signal: abortControllerRef.current.signal
      });
      
      let productsData = response.data.products || response.data;
      
      if (!Array.isArray(productsData)) {
        productsData = [];
      }
      
      // Store all products for client-side search
      setAllProducts(productsData);
      
      // Apply client-side filters
      productsData = applySearchFilter(productsData, searchQuery);
      productsData = applyPriceFilter(productsData, priceFilter);
      productsData = applySorting(productsData, sortOption);
      
      setProducts(productsData);
      setBackendConnected(true);
      console.log(`✅ Successfully loaded ${productsData.length} products`);
      
    } catch (error) {
      // Don't set error if the request was aborted
      if (error.name === 'AbortError' || error.code === 'ERR_CANCELED') {
        console.log('🛑 Request was cancelled');
        return;
      }
      
      console.error('❌ Error fetching products:', error.message);
      setError('Failed to load products. Please try again.');
      setBackendConnected(false);
      setProducts([]);
      setAllProducts([]);
    } finally {
      setLoading(false);
    }
  }, []);

  // Apply prefix-based search filter
  const applySearchFilter = (productsList, searchQuery) => {
    if (!searchQuery || searchQuery.trim() === '') return productsList;
    
    const query = searchQuery.toLowerCase().trim();
    
    return productsList.filter(product => {
      // Search in product name (starts with)
      if (product.name?.toLowerCase().startsWith(query)) {
        return true;
      }
      
      // Search in brand name (starts with)
      if (product.brand?.toLowerCase().startsWith(query)) {
        return true;
      }
      
      // Search in category (starts with)
      if (product.category?.toLowerCase().startsWith(query)) {
        return true;
      }
      
      return false;
    });
  };

  // Apply price filter
  const applyPriceFilter = (productsList, currentPriceRange) => {
    if (!currentPriceRange) return productsList;
    
    const [min, max] = currentPriceRange.split('-').map(Number);
    return productsList.filter(product => {
      const price = product.sellingPrice || 0;
      if (min === 0 && max === 100000) return price < 100000;
      if (min === 100000 && max === 500000) return price >= 100000 && price <= 500000;
      if (min === 500000 && max === 1000000) return price >= 500000 && price <= 1000000;
      if (min === 1000000 && max === 10000000) return price >= 1000000;
      return true;
    });
  };

  // Apply sorting
  const applySorting = (productsList, currentSortBy) => {
    const sorted = [...productsList];
    switch (currentSortBy) {
      case 'price-low':
        return sorted.sort((a, b) => (a.sellingPrice || 0) - (b.sellingPrice || 0));
      case 'price-high':
        return sorted.sort((a, b) => (b.sellingPrice || 0) - (a.sellingPrice || 0));
      case 'rating':
        return sorted.sort((a, b) => (b.averageRating || 0) - (a.averageRating || 0));
      case 'popular':
        return sorted.sort((a, b) => (b.comments?.length || 0) - (a.comments?.length || 0));
      case 'newest':
      default:
        return sorted.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
    }
  };

  // Handle real-time search with debouncing (client-side only)
  const handleSearchChange = (e) => {
    const value = e.target.value;
    setSearchTerm(value);
    
    // Clear previous timeout
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }
    
    // Set new timeout for debouncing (200ms - faster for client-side)
    searchTimeoutRef.current = setTimeout(() => {
      applyFiltersAndSearch(value);
    }, 200);
  };

  // Apply all filters including search
  const applyFiltersAndSearch = (searchQuery = '') => {
    let filteredProducts = [...allProducts];
    
    // Apply search filter (prefix-based)
    filteredProducts = applySearchFilter(filteredProducts, searchQuery);
    
    // Apply category filter
    if (selectedCategory && selectedCategory !== 'All') {
      filteredProducts = filteredProducts.filter(product => 
        product.category?.toLowerCase() === selectedCategory.toLowerCase()
      );
    }
    
    // Apply price filter
    filteredProducts = applyPriceFilter(filteredProducts, priceRange);
    
    // Apply sorting
    filteredProducts = applySorting(filteredProducts, sortBy);
    
    setProducts(filteredProducts);
  };

  // Handle manual search submission
  const handleSearchSubmit = (e) => {
    e.preventDefault();
    
    // Clear any pending timeout
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }
    
    // Apply filters immediately
    applyFiltersAndSearch(searchTerm);
  };

  // Clear search
  const handleClearSearch = () => {
    setSearchTerm('');
    // Clear any pending timeout
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }
    // Apply filters without search term
    applyFiltersAndSearch('');
  };

  // Single useEffect for initial load and when filters change
  useEffect(() => {
    const urlSearchQuery = getSearchQueryFromURL();
    if (urlSearchQuery) {
      setSearchTerm(urlSearchQuery);
    }
    
    const timeoutId = setTimeout(() => {
      console.log('🎯 Fetching initial products');
      fetchProducts(urlSearchQuery, selectedCategory, priceRange, sortBy);
    }, 300);

    return () => {
      clearTimeout(timeoutId);
    };
  }, [getSearchQueryFromURL, selectedCategory, priceRange, sortBy, fetchProducts]);

  // Apply filters when category, price range, or sort changes
  useEffect(() => {
    if (allProducts.length > 0) {
      applyFiltersAndSearch(searchTerm);
    }
  }, [selectedCategory, priceRange, sortBy, allProducts]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, []);

  // Get unique categories from all products
  const categories = ['All', ...new Set(
    allProducts
      .map(product => {
        if (!product.category) return null;
        return product.category.charAt(0).toUpperCase() + product.category.slice(1);
      })
      .filter(Boolean)
  )];

  const priceRanges = [
    { label: 'All Prices', value: '' },
    { label: 'Under UGX 100,000', value: '0-100000' },
    { label: 'UGX 100,000 - 500,000', value: '100000-500000' },
    { label: 'UGX 500,000 - 1,000,000', value: '500000-1000000' },
    { label: 'Over UGX 1,000,000', value: '1000000-10000000' }
  ];

  const sortOptions = [
    { label: 'Newest', value: 'newest' },
    { label: 'Price: Low to High', value: 'price-low' },
    { label: 'Price: High to Low', value: 'price-high' },
    { label: 'Most Popular', value: 'popular' },
    { label: 'Best Rated', value: 'rating' }
  ];

  const clearFilters = () => {
    setSelectedCategory('');
    setPriceRange('');
    setSortBy('newest');
    handleClearSearch();
    setFiltersOpen(false);
  };

  const getActiveFiltersCount = () => {
    let count = 0;
    if (selectedCategory && selectedCategory !== 'All') count++;
    if (priceRange) count++;
    if (searchTerm) count++;
    return count;
  };

  const retryBackendConnection = () => {
    setError('');
    const urlSearchQuery = getSearchQueryFromURL();
    fetchProducts(urlSearchQuery, selectedCategory, priceRange, sortBy);
  };

  const urlSearchQuery = getSearchQueryFromURL();
  const currentSearchTerm = urlSearchQuery || searchTerm;

  return (
    <div className="min-h-screen theme-bg">
      {/* Header Section - Compact */}
      <div className="theme-surface shadow-sm theme-border border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <h1 className="text-xl font-bold theme-text">
                Products
                {currentSearchTerm && (
                  <span className="text-sm font-normal theme-text-muted ml-2">
                    - Search: "{currentSearchTerm}"
                  </span>
                )}
              </h1>
              {error && backendConnected && (
                <span className="text-red-600 text-xs ml-2 bg-red-100 px-2 py-1 rounded">Error Loading</span>
              )}
            </div>
            <div className="text-sm theme-text-muted">
              {products.length} products
              {currentSearchTerm && ' found'}
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Connection Warning */}
        {error && !backendConnected && (
          <div className="mb-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-yellow-600" />
              <div>
                <p className="text-yellow-800 font-medium">Connection Issue</p>
                <p className="text-yellow-700 text-sm">
                  {error}
                </p>
              </div>
            </div>
            <button
              onClick={retryBackendConnection}
              className="bg-yellow-600 hover:bg-yellow-700 text-white px-4 py-2 rounded text-sm transition-colors flex items-center gap-1"
            >
              <RefreshCw className="h-4 w-4" />
              Retry
            </button>
          </div>
        )}

        {/* Compact Toolbar with Search Bar */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between mb-6 gap-3">
          <div className="text-sm theme-text-muted">
            Showing {products.length} products
            {currentSearchTerm && ` for "${currentSearchTerm}"`}
          </div>
          
          <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
            {/* Compact Search Bar with Real-time Prefix Search */}
            <form 
              onSubmit={handleSearchSubmit}
              className="relative w-full sm:w-64"
            >
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 theme-text-muted" />
              <input
                type="text"
                value={searchTerm}
                onChange={handleSearchChange}
                placeholder="Search products..."
                className="w-full pl-10 pr-20 py-2 theme-border border rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 theme-surface theme-text text-sm"
              />
              <div className="absolute right-2 top-1/2 transform -translate-y-1/2 flex items-center gap-1">
                {searchTerm && (
                  <button
                    type="button"
                    onClick={handleClearSearch}
                    className="text-gray-400 hover:text-gray-600 transition-colors p-1"
                    title="Clear search"
                  >
                    ✕
                  </button>
                )}
                <button
                  type="submit"
                  className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1 rounded text-xs transition-colors"
                >
                  Search
                </button>
              </div>
            </form>

            <div className="flex items-center gap-2">
              {/* Filters Dropdown */}
              <div className="relative">
                <button
                  onClick={() => setFiltersOpen(!filtersOpen)}
                  className="flex items-center gap-2 px-3 py-2 theme-border border rounded-lg theme-surface theme-text text-sm hover:theme-secondary transition-colors"
                >
                  <Filter className="h-4 w-4" />
                  Filters
                  {getActiveFiltersCount() > 0 && (
                    <span className="bg-blue-600 text-white text-xs rounded-full h-4 w-4 flex items-center justify-center">
                      {getActiveFiltersCount()}
                    </span>
                  )}
                  <ChevronDown className={`h-4 w-4 transition-transform ${filtersOpen ? 'rotate-180' : ''}`} />
                </button>

                {filtersOpen && (
                  <>
                    <div 
                      className="fixed inset-0 z-40" 
                      onClick={() => setFiltersOpen(false)}
                    />
                    <div className="absolute right-0 top-12 z-50 w-64 theme-surface rounded-lg shadow-lg theme-border border p-4">
                      <div className="flex items-center justify-between mb-3">
                        <h3 className="font-semibold theme-text text-sm">Filters</h3>
                        <button
                          onClick={clearFilters}
                          className="text-xs text-blue-600 hover:opacity-80"
                        >
                          Clear All
                        </button>
                      </div>

                      {/* Search Info */}
                      {currentSearchTerm && (
                        <div className="mb-3 p-2 bg-blue-50 dark:bg-blue-900/20 rounded text-sm">
                          <p className="theme-text text-xs">Searching for: <strong>"{currentSearchTerm}"</strong></p>
                        </div>
                      )}

                      {/* Category Filter */}
                      <div className="mb-4">
                        <h4 className="font-medium theme-text text-sm mb-2">Category</h4>
                        <select
                          value={selectedCategory}
                          onChange={(e) => setSelectedCategory(e.target.value)}
                          className="w-full px-2 py-1.5 theme-border border rounded text-sm theme-surface theme-text"
                        >
                          {categories.map(category => (
                            <option key={category} value={category}>
                              {category}
                            </option>
                          ))}
                        </select>
                      </div>

                      {/* Price Filter */}
                      <div className="mb-4">
                        <h4 className="font-medium theme-text text-sm mb-2">Price Range</h4>
                        <select
                          value={priceRange}
                          onChange={(e) => setPriceRange(e.target.value)}
                          className="w-full px-2 py-1.5 theme-border border rounded text-sm theme-surface theme-text"
                        >
                          {priceRanges.map(range => (
                            <option key={range.value} value={range.value}>
                              {range.label}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                  </>
                )}
              </div>

              {/* Sort Options */}
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="theme-border border rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-blue-500 theme-surface theme-text text-sm"
              >
                {sortOptions.map(option => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>

              {/* View Mode Toggle - Hidden on mobile */}
              <div className="hidden sm:flex theme-border border rounded-lg overflow-hidden">
                <button
                  onClick={() => setViewMode('grid')}
                  className={`p-2 ${
                    viewMode === 'grid' 
                      ? 'bg-blue-600 text-white' 
                      : 'theme-surface theme-text-muted'
                  }`}
                >
                  <Grid className="h-4 w-4" />
                </button>
                <button
                  onClick={() => setViewMode('list')}
                  className={`p-2 ${
                    viewMode === 'list' 
                      ? 'bg-blue-600 text-white' 
                      : 'theme-surface theme-text-muted'
                  }`}
                >
                  <List className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Products Grid */}
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="theme-surface rounded-lg shadow-sm theme-border border p-4 animate-pulse">
                <div className="bg-gray-300 dark:bg-gray-600 h-40 rounded-lg mb-3"></div>
                <div className="bg-gray-300 dark:bg-gray-600 h-4 rounded mb-2"></div>
                <div className="bg-gray-300 dark:bg-gray-600 h-4 rounded w-2/3"></div>
              </div>
            ))}
          </div>
        ) : products.length > 0 ? (
          <div className={`grid gap-4 ${
            viewMode === 'grid' 
              ? 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3' 
              : 'grid-cols-1'
          }`}>
            {products.map(product => (
              <ProductCard key={product._id} product={product} />
            ))}
          </div>
        ) : (
          <div className="text-center py-12">
            <div className="text-gray-400 text-6xl mb-4">🔍</div>
            <h3 className="text-lg font-semibold theme-text mb-2">
              {currentSearchTerm ? `No products found for "${currentSearchTerm}"` : 'No products found'}
            </h3>
            <p className="theme-text-muted mb-4">
              {currentSearchTerm ? 'Try a different search term or adjust your filters' : 'Try adjusting your filters'}
            </p>
            <button
              onClick={clearFilters}
              className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition-colors text-sm"
            >
              {currentSearchTerm ? 'Clear Search & Filters' : 'Clear Filters'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default Products;