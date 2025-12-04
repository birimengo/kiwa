import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { Filter, Grid, List, ChevronDown, AlertCircle, RefreshCw, Search, X } from 'lucide-react';
import ProductCard from '../components/products/ProductCard';
import { productsAPI } from '../services/api';

const Products = () => {
  const [products, setProducts] = useState([]);
  const [allProducts, setAllProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState('');
  const [minPrice, setMinPrice] = useState('');
  const [maxPrice, setMaxPrice] = useState('');
  const [sortBy, setSortBy] = useState('newest');
  const [viewMode, setViewMode] = useState('grid');
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [error, setError] = useState('');
  const [backendConnected, setBackendConnected] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);
  
  const location = useLocation();
  const abortControllerRef = useRef(null);
  const searchTimeoutRef = useRef(null);
  
  // Get search query from URL parameters
  const getSearchQueryFromURL = useCallback(() => {
    const searchParams = new URLSearchParams(location.search);
    return searchParams.get('search') || '';
  }, [location.search]);

  // Single fetch function with abort controller
  const fetchProducts = useCallback(async (searchQuery = '', category = '', min = '', max = '', sortOption = 'newest') => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    
    abortControllerRef.current = new AbortController();
    
    setLoading(true);
    setError('');
    
    try {
      const params = {
        page: 1,
        limit: 100
      };
      
      if (category && category !== 'All') params.category = category.toLowerCase();
      
      const response = await productsAPI.getProducts(params, {
        signal: abortControllerRef.current.signal
      });
      
      let productsData = response.data.products || response.data;
      
      if (!Array.isArray(productsData)) {
        productsData = [];
      }
      
      setAllProducts(productsData);
      
      // Apply client-side filters
      productsData = applySearchFilter(productsData, searchQuery);
      productsData = applyPriceFilter(productsData, min, max);
      productsData = applySorting(productsData, sortOption);
      
      setProducts(productsData);
      setBackendConnected(true);
      
    } catch (error) {
      if (error.name === 'AbortError' || error.code === 'ERR_CANCELED') {
        return;
      }
      
      console.error('Error fetching products:', error.message);
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
      if (product.name?.toLowerCase().startsWith(query)) return true;
      if (product.brand?.toLowerCase().startsWith(query)) return true;
      if (product.category?.toLowerCase().startsWith(query)) return true;
      return false;
    });
  };

  // Apply price filter with min and max inputs
  const applyPriceFilter = (productsList, minPrice, maxPrice) => {
    const min = minPrice ? parseInt(minPrice) : null;
    const max = maxPrice ? parseInt(maxPrice) : null;
    
    if (min === null && max === null) return productsList;
    
    return productsList.filter(product => {
      const price = product.sellingPrice || 0;
      let isValid = true;
      
      if (min !== null && min > 0) {
        isValid = isValid && price >= min;
      }
      
      if (max !== null && max > 0) {
        isValid = isValid && price <= max;
      }
      
      return isValid;
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

  // Handle real-time search with debouncing
  const handleSearchChange = (e) => {
    const value = e.target.value;
    setSearchTerm(value);
    
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }
    
    searchTimeoutRef.current = setTimeout(() => {
      applyFiltersAndSearch(value);
    }, 200);
  };

  // Apply all filters including search
  const applyFiltersAndSearch = (searchQuery = '') => {
    let filteredProducts = [...allProducts];
    
    filteredProducts = applySearchFilter(filteredProducts, searchQuery);
    
    if (selectedCategory && selectedCategory !== 'All') {
      filteredProducts = filteredProducts.filter(product => 
        product.category?.toLowerCase() === selectedCategory.toLowerCase()
      );
    }
    
    filteredProducts = applyPriceFilter(filteredProducts, minPrice, maxPrice);
    filteredProducts = applySorting(filteredProducts, sortBy);
    
    setProducts(filteredProducts);
  };

  // Handle manual search submission
  const handleSearchSubmit = (e) => {
    e.preventDefault();
    
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }
    
    applyFiltersAndSearch(searchTerm);
  };

  // Clear search
  const handleClearSearch = () => {
    setSearchTerm('');
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }
    applyFiltersAndSearch('');
  };

  // Handle price range changes
  const handleMinPriceChange = (e) => {
    const value = e.target.value.replace(/\D/g, '');
    setMinPrice(value);
  };

  const handleMaxPriceChange = (e) => {
    const value = e.target.value.replace(/\D/g, '');
    setMaxPrice(value);
  };

  // Apply price filter when min or max changes
  useEffect(() => {
    if (allProducts.length > 0) {
      applyFiltersAndSearch(searchTerm);
    }
  }, [minPrice, maxPrice, selectedCategory, sortBy, allProducts]);

  // Single useEffect for initial load
  useEffect(() => {
    const urlSearchQuery = getSearchQueryFromURL();
    if (urlSearchQuery) {
      setSearchTerm(urlSearchQuery);
    }
    
    const timeoutId = setTimeout(() => {
      fetchProducts(urlSearchQuery, selectedCategory, minPrice, maxPrice, sortBy);
    }, 300);

    return () => {
      clearTimeout(timeoutId);
    };
  }, [getSearchQueryFromURL, selectedCategory, minPrice, maxPrice, sortBy, fetchProducts]);

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

  // Get unique categories
  const categories = ['All', ...new Set(
    allProducts
      .map(product => {
        if (!product.category) return null;
        return product.category.charAt(0).toUpperCase() + product.category.slice(1);
      })
      .filter(Boolean)
  )];

  const sortOptions = [
    { label: 'Newest', value: 'newest' },
    { label: 'Price: Low to High', value: 'price-low' },
    { label: 'Price: High to Low', value: 'price-high' },
    { label: 'Most Popular', value: 'popular' },
    { label: 'Best Rated', value: 'rating' }
  ];

  const clearFilters = () => {
    setSelectedCategory('');
    setMinPrice('');
    setMaxPrice('');
    setSortBy('newest');
    handleClearSearch();
    setFiltersOpen(false);
    setMobileFiltersOpen(false);
  };

  const getActiveFiltersCount = () => {
    let count = 0;
    if (selectedCategory && selectedCategory !== 'All') count++;
    if (minPrice || maxPrice) count++;
    return count;
  };

  const retryBackendConnection = () => {
    setError('');
    const urlSearchQuery = getSearchQueryFromURL();
    fetchProducts(urlSearchQuery, selectedCategory, minPrice, maxPrice, sortBy);
  };

  const urlSearchQuery = getSearchQueryFromURL();
  const currentSearchTerm = urlSearchQuery || searchTerm;

  // Format price for display
  const formatPrice = (price) => {
    if (!price) return '';
    return `UGX ${parseInt(price).toLocaleString()}`;
  };

  // Filter chips component
  const FilterChips = () => (
    <div className="flex flex-wrap gap-2 mb-4">
      {selectedCategory && selectedCategory !== 'All' && (
        <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 text-sm">
          Category: {selectedCategory}
          <button
            onClick={() => setSelectedCategory('')}
            className="ml-1 hover:text-blue-600 dark:hover:text-blue-300"
          >
            <X className="h-3 w-3" />
          </button>
        </span>
      )}
      {(minPrice || maxPrice) && (
        <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200 text-sm">
          Price: {minPrice ? `${formatPrice(minPrice)}` : 'Any'} - {maxPrice ? `${formatPrice(maxPrice)}` : 'Any'}
          <button
            onClick={() => {
              setMinPrice('');
              setMaxPrice('');
            }}
            className="ml-1 hover:text-green-600 dark:hover:text-green-300"
          >
            <X className="h-3 w-3" />
          </button>
        </span>
      )}
    </div>
  );

  // Price range inputs component
  const PriceRangeInputs = () => (
    <div className="space-y-3">
      <div>
        <label className="block text-sm font-medium theme-text mb-1">
          Minimum Price (UGX)
        </label>
        <input
          type="text"
          value={minPrice}
          onChange={handleMinPriceChange}
          placeholder="0"
          className="w-full px-3 py-2 theme-border border rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 theme-surface theme-text text-sm"
        />
      </div>
      <div>
        <label className="block text-sm font-medium theme-text mb-1">
          Maximum Price (UGX)
        </label>
        <input
          type="text"
          value={maxPrice}
          onChange={handleMaxPriceChange}
          placeholder="10000000"
          className="w-full px-3 py-2 theme-border border rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 theme-surface theme-text text-sm"
        />
      </div>
      <div className="text-xs theme-text-muted">
        Enter amounts in UGX (numbers only)
      </div>
    </div>
  );

  return (
    <div className="min-h-screen theme-bg">
      {/* Header Section */}
      <div className="theme-surface shadow-sm theme-border border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
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
          <div className="mb-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg flex flex-col sm:flex-row sm:items-center justify-between gap-3">
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
              className="bg-yellow-600 hover:bg-yellow-700 text-white px-4 py-2 rounded text-sm transition-colors flex items-center gap-1 self-start sm:self-auto"
            >
              <RefreshCw className="h-4 w-4" />
              Retry
            </button>
          </div>
        )}

        {/* Search Bar - Always visible */}
        <div className="mb-6">
          <form onSubmit={handleSearchSubmit}>
            <div className="relative max-w-2xl mx-auto">
              <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 h-5 w-5 theme-text-muted" />
              <input
                type="text"
                value={searchTerm}
                onChange={handleSearchChange}
                placeholder="Search products by name, brand, or category..."
                className="w-full pl-12 pr-24 py-3 theme-border border-2 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 theme-surface theme-text text-base"
              />
              <div className="absolute right-2 top-1/2 transform -translate-y-1/2 flex items-center gap-2">
                {searchTerm && (
                  <button
                    type="button"
                    onClick={handleClearSearch}
                    className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors p-2"
                    title="Clear search"
                  >
                    <X className="h-5 w-5" />
                  </button>
                )}
                <button
                  type="submit"
                  className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm transition-colors font-medium"
                >
                  Search
                </button>
              </div>
            </div>
          </form>
        </div>

        {/* Mobile Filter Toggle Button */}
        <div className="lg:hidden mb-4">
          <div className="flex items-center justify-between">
            <div className="text-sm theme-text-muted">
              {products.length} products found
            </div>
            <button
              onClick={() => setMobileFiltersOpen(true)}
              className="flex items-center gap-2 px-4 py-2 theme-border border rounded-lg theme-surface theme-text hover:theme-secondary transition-colors"
            >
              <Filter className="h-4 w-4" />
              Filters
              {getActiveFiltersCount() > 0 && (
                <span className="bg-blue-600 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center">
                  {getActiveFiltersCount()}
                </span>
              )}
            </button>
          </div>
        </div>

        {/* Mobile Filter Drawer */}
        {mobileFiltersOpen && (
          <div className="fixed inset-0 z-50 lg:hidden">
            {/* Overlay */}
            <div 
              className="absolute inset-0 bg-black/50 backdrop-blur-sm"
              onClick={() => setMobileFiltersOpen(false)}
            />
            
            {/* Drawer */}
            <div className="absolute right-0 top-0 h-full w-full max-w-sm bg-white dark:bg-gray-900 shadow-xl overflow-y-auto">
              <div className="p-4">
                {/* Header */}
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-lg font-semibold theme-text">Filters</h2>
                  <button
                    onClick={() => setMobileFiltersOpen(false)}
                    className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg"
                  >
                    <X className="h-5 w-5 theme-text" />
                  </button>
                </div>

                {/* Active Filters */}
                <div className="mb-6">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="font-medium theme-text">Active Filters</h3>
                    <button
                      onClick={clearFilters}
                      className="text-sm text-blue-600 hover:opacity-80"
                    >
                      Clear All
                    </button>
                  </div>
                  <FilterChips />
                </div>

                {/* Category Filter */}
                <div className="mb-6">
                  <h3 className="font-medium theme-text mb-3">Category</h3>
                  <select
                    value={selectedCategory}
                    onChange={(e) => setSelectedCategory(e.target.value)}
                    className="w-full px-3 py-2 theme-border border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 theme-surface theme-text"
                  >
                    {categories.map(category => (
                      <option key={category} value={category}>
                        {category}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Price Filter - Input Fields */}
                <div className="mb-6">
                  <h3 className="font-medium theme-text mb-3">Price Range</h3>
                  <PriceRangeInputs />
                </div>

                {/* Sort Options */}
                <div className="mb-6">
                  <h3 className="font-medium theme-text mb-3">Sort By</h3>
                  <select
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value)}
                    className="w-full px-3 py-2 theme-border border rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 theme-surface theme-text"
                  >
                    {sortOptions.map(option => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Apply Button */}
                <button
                  onClick={() => setMobileFiltersOpen(false)}
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-lg font-medium transition-colors"
                >
                  Apply Filters
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Desktop Controls */}
        <div className="hidden lg:flex flex-col">
          <div className="flex items-center justify-between mb-6">
            <div className="text-sm theme-text-muted">
              Showing {products.length} products
              {currentSearchTerm && ` for "${currentSearchTerm}"`}
            </div>
            
            <div className="flex items-center gap-3">
              {/* Filters Dropdown */}
              <div className="relative">
                <button
                  onClick={() => setFiltersOpen(!filtersOpen)}
                  className="flex items-center gap-2 px-4 py-2 theme-border border rounded-lg theme-surface theme-text text-sm hover:theme-secondary transition-colors"
                >
                  <Filter className="h-4 w-4" />
                  Filters
                  {getActiveFiltersCount() > 0 && (
                    <span className="bg-blue-600 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center">
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
                    <div className="absolute right-0 top-12 z-50 w-80 theme-surface rounded-lg shadow-lg theme-border border p-4">
                      <div className="flex items-center justify-between mb-3">
                        <h3 className="font-semibold theme-text text-sm">Filters</h3>
                        <button
                          onClick={clearFilters}
                          className="text-xs text-blue-600 hover:opacity-80"
                        >
                          Clear All
                        </button>
                      </div>

                      {/* Category Filter */}
                      <div className="mb-4">
                        <h4 className="font-medium theme-text text-sm mb-2">Category</h4>
                        <select
                          value={selectedCategory}
                          onChange={(e) => setSelectedCategory(e.target.value)}
                          className="w-full px-3 py-2 theme-border border rounded text-sm theme-surface theme-text"
                        >
                          {categories.map(category => (
                            <option key={category} value={category}>
                              {category}
                            </option>
                          ))}
                        </select>
                      </div>

                      {/* Price Filter - Input Fields */}
                      <div className="mb-4">
                        <h4 className="font-medium theme-text text-sm mb-2">Price Range (UGX)</h4>
                        <PriceRangeInputs />
                      </div>
                    </div>
                  </>
                )}
              </div>

              {/* Sort Options */}
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="theme-border border rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 theme-surface theme-text text-sm"
              >
                {sortOptions.map(option => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>

              {/* View Mode Toggle */}
              <div className="theme-border border rounded-lg overflow-hidden">
                <button
                  onClick={() => setViewMode('grid')}
                  className={`p-2 ${
                    viewMode === 'grid' 
                      ? 'bg-blue-600 text-white' 
                      : 'theme-surface theme-text-muted hover:theme-secondary'
                  }`}
                >
                  <Grid className="h-4 w-4" />
                </button>
                <button
                  onClick={() => setViewMode('list')}
                  className={`p-2 ${
                    viewMode === 'list' 
                      ? 'bg-blue-600 text-white' 
                      : 'theme-surface theme-text-muted hover:theme-secondary'
                  }`}
                >
                  <List className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>

          {/* Active Filter Chips - Desktop */}
          <FilterChips />
        </div>

        {/* Active Filter Chips - Mobile (outside drawer) */}
        <div className="lg:hidden mb-4">
          <FilterChips />
        </div>

        {/* Products Grid */}
        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
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
              ? 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3' 
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