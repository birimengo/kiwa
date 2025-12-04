import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { Filter, Grid, List, ChevronDown, AlertCircle, RefreshCw, Search, X } from 'lucide-react';
import ProductCard from '../components/products/ProductCard';
import { productsAPI } from '../services/api';
import SEO from '../components/SEO';

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
    <div className="flex flex-wrap gap-1.5 mb-2">
      {selectedCategory && selectedCategory !== 'All' && (
        <span className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 text-xs">
          {selectedCategory}
          <button
            onClick={() => setSelectedCategory('')}
            className="ml-0.5 hover:text-blue-600 dark:hover:text-blue-300"
          >
            <X className="h-2.5 w-2.5" />
          </button>
        </span>
      )}
      {(minPrice || maxPrice) && (
        <span className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200 text-xs">
          Price: {minPrice ? `${formatPrice(minPrice)}` : 'Any'} - {maxPrice ? `${formatPrice(maxPrice)}` : 'Any'}
          <button
            onClick={() => {
              setMinPrice('');
              setMaxPrice('');
            }}
            className="ml-0.5 hover:text-green-600 dark:hover:text-green-300"
          >
            <X className="h-2.5 w-2.5" />
          </button>
        </span>
      )}
    </div>
  );

  // Price range inputs component
  const PriceRangeInputs = () => (
    <div className="space-y-2">
      <div>
        <label className="block text-xs font-medium theme-text mb-0.5">
          Min Price (UGX)
        </label>
        <input
          type="text"
          value={minPrice}
          onChange={handleMinPriceChange}
          placeholder="0"
          className="w-full px-2 py-1 text-sm theme-border border rounded focus:outline-none focus:ring-1 focus:ring-green-500 theme-surface theme-text"
        />
      </div>
      <div>
        <label className="block text-xs font-medium theme-text mb-0.5">
          Max Price (UGX)
        </label>
        <input
          type="text"
          value={maxPrice}
          onChange={handleMaxPriceChange}
          placeholder="10000000"
          className="w-full px-2 py-1 text-sm theme-border border rounded focus:outline-none focus:ring-1 focus:ring-green-500 theme-surface theme-text"
        />
      </div>
      <div className="text-[10px] theme-text-muted">
        Enter amounts in UGX (numbers only)
      </div>
    </div>
  );

  // Get category names for SEO
  const getCategoryNames = () => {
    const categoriesList = categories.filter(cat => cat !== 'All');
    return categoriesList.join(', ');
  };

  return (
    <>
      {/* SEO COMPONENT */}
      <SEO
        title="Electrical Products Uganda | Wholesale & Retail Prices | Kampala"
        description={`Browse ${products.length} electrical products at wholesale prices in Uganda. Categories: ${getCategoryNames()}. ☎️ Call 0751808507 for bulk orders.`}
        keywords="electrical products Uganda, wholesale electrical goods, generators Kampala, solar systems Uganda, wires cables, switches sockets"
        pageType="collection"
        productData={products}
      />
      
      <div className="min-h-screen theme-bg">
        {/* Header Section - COMPACT */}
        <div className="theme-surface shadow-xs theme-border border-b">
          <div className="max-w-7xl mx-auto px-3 sm:px-4 lg:px-6 py-1.5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
              <div className="flex items-center">
                <h1 className="text-lg font-bold theme-text">
                  Electrical Products
                  <span className="text-xs font-normal theme-text-muted ml-1.5">
                    {products.length} items
                  </span>
                </h1>
                {error && backendConnected && (
                  <span className="text-red-600 text-[10px] ml-1.5 bg-red-100 px-1 py-0.5 rounded">Error</span>
                )}
              </div>
              <div className="text-xs theme-text-muted flex items-center gap-1.5">
                <span>☎️ 0751808507</span>
                <span className="hidden sm:inline">•</span>
                <span className="hidden sm:inline">Free Kampala delivery</span>
              </div>
            </div>
            {/* Ultra-compact subheader */}
            <div className="mt-0.5 text-[10px] theme-text-muted truncate">
              <span className="hidden sm:inline">Wholesale electrical supplies | Best prices Uganda | Call 0751808507</span>
              <span className="sm:hidden">Wholesale | Free delivery | ☎️ 0751808507</span>
            </div>
          </div>
        </div>

        <div className="max-w-7xl mx-auto px-3 sm:px-4 lg:px-6 py-2">
          {/* Connection Warning - COMPACT */}
          {error && !backendConnected && (
            <div className="mb-3 p-2 bg-yellow-50 border border-yellow-200 rounded flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5">
                <AlertCircle className="h-3.5 w-3.5 text-yellow-600" />
                <div>
                  <p className="text-yellow-800 font-medium text-xs">Connection Issue</p>
                  <p className="text-yellow-700 text-[10px]">
                    {error}
                  </p>
                </div>
              </div>
              <button
                onClick={retryBackendConnection}
                className="bg-yellow-600 hover:bg-yellow-700 text-white px-2 py-1 rounded text-xs flex items-center gap-0.5"
              >
                <RefreshCw className="h-2.5 w-2.5" />
                Retry
              </button>
            </div>
          )}

          {/* Search Bar - COMPACT */}
          <div className="mb-3">
            <form onSubmit={handleSearchSubmit}>
              <div className="relative max-w-2xl mx-auto">
                <Search className="absolute left-2.5 top-1/2 transform -translate-y-1/2 h-3.5 w-3.5 theme-text-muted" />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={handleSearchChange}
                  placeholder="Search electrical products..."
                  className="w-full pl-9 pr-16 py-1.5 text-sm theme-border border rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 theme-surface theme-text"
                />
                <div className="absolute right-1 top-1/2 transform -translate-y-1/2 flex items-center gap-1">
                  {searchTerm && (
                    <button
                      type="button"
                      onClick={handleClearSearch}
                      className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors p-1"
                      title="Clear search"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  )}
                  <button
                    type="submit"
                    className="bg-blue-600 hover:bg-blue-700 text-white px-2 py-1 rounded text-xs font-medium"
                  >
                    Search
                  </button>
                </div>
              </div>
            </form>
            {/* Compact search description */}
            <p className="text-center text-[10px] theme-text-muted mt-0.5">
              Search generators, solar, wires, switches, appliances
            </p>
          </div>

          {/* Mobile Filter Toggle Button - COMPACT */}
          <div className="lg:hidden mb-2">
            <div className="flex items-center justify-between">
              <div className="text-xs theme-text-muted">
                {products.length} products
                {currentSearchTerm && ` for "${currentSearchTerm}"`}
              </div>
              <button
                onClick={() => setMobileFiltersOpen(true)}
                className="flex items-center gap-1 px-2 py-1 text-xs theme-border border rounded theme-surface theme-text hover:theme-secondary transition-colors"
              >
                <Filter className="h-3 w-3" />
                Filters
                {getActiveFiltersCount() > 0 && (
                  <span className="bg-blue-600 text-white text-[10px] rounded-full h-3.5 w-3.5 flex items-center justify-center">
                    {getActiveFiltersCount()}
                  </span>
                )}
              </button>
            </div>
          </div>

          {/* Mobile Filter Drawer - COMPACT */}
          {mobileFiltersOpen && (
            <div className="fixed inset-0 z-50 lg:hidden">
              {/* Overlay */}
              <div 
                className="absolute inset-0 bg-black/50 backdrop-blur-xs"
                onClick={() => setMobileFiltersOpen(false)}
              />
              
              {/* Drawer */}
              <div className="absolute right-0 top-0 h-full w-full max-w-xs bg-white dark:bg-gray-900 shadow-lg overflow-y-auto">
                <div className="p-3">
                  {/* Header */}
                  <div className="flex items-center justify-between mb-3">
                    <h2 className="text-base font-semibold theme-text">Filters</h2>
                    <button
                      onClick={() => setMobileFiltersOpen(false)}
                      className="p-1 hover:bg-gray-100 dark:hover:bg-gray-800 rounded"
                    >
                      <X className="h-4 w-4 theme-text" />
                    </button>
                  </div>

                  {/* Active Filters */}
                  <div className="mb-3">
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="font-medium theme-text text-sm">Active Filters</h3>
                      <button
                        onClick={clearFilters}
                        className="text-xs text-blue-600 hover:opacity-80"
                      >
                        Clear All
                      </button>
                    </div>
                    <FilterChips />
                  </div>

                  {/* Category Filter */}
                  <div className="mb-3">
                    <h3 className="font-medium theme-text text-xs mb-1.5">Category</h3>
                    <select
                      value={selectedCategory}
                      onChange={(e) => setSelectedCategory(e.target.value)}
                      className="w-full px-2 py-1 text-sm theme-border border rounded focus:outline-none focus:ring-1 focus:ring-blue-500 theme-surface theme-text"
                    >
                      {categories.map(category => (
                        <option key={category} value={category}>
                          {category}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Price Filter */}
                  <div className="mb-3">
                    <h3 className="font-medium theme-text text-xs mb-1.5">Price Range</h3>
                    <PriceRangeInputs />
                  </div>

                  {/* Sort Options */}
                  <div className="mb-3">
                    <h3 className="font-medium theme-text text-xs mb-1.5">Sort By</h3>
                    <select
                      value={sortBy}
                      onChange={(e) => setSortBy(e.target.value)}
                      className="w-full px-2 py-1 text-sm theme-border border rounded focus:outline-none focus:ring-1 focus:ring-purple-500 theme-surface theme-text"
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
                    className="w-full bg-blue-600 hover:bg-blue-700 text-white py-2 rounded font-medium text-sm"
                  >
                    Apply Filters
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Desktop Controls - COMPACT */}
          <div className="hidden lg:flex flex-col">
            <div className="flex items-center justify-between mb-2">
              <div className="text-xs theme-text-muted flex items-center gap-1.5">
                <span>Showing {products.length} products</span>
                {currentSearchTerm && <span>for "{currentSearchTerm}"</span>}
                <span className="text-blue-600 font-medium">☎️ 0751808507</span>
              </div>
              
              <div className="flex items-center gap-2">
                {/* Filters Dropdown */}
                <div className="relative">
                  <button
                    onClick={() => setFiltersOpen(!filtersOpen)}
                    className="flex items-center gap-1 px-2 py-1 text-xs theme-border border rounded theme-surface theme-text hover:theme-secondary transition-colors"
                  >
                    <Filter className="h-3 w-3" />
                    Filters
                    {getActiveFiltersCount() > 0 && (
                      <span className="bg-blue-600 text-white text-[10px] rounded-full h-3.5 w-3.5 flex items-center justify-center">
                        {getActiveFiltersCount()}
                      </span>
                    )}
                    <ChevronDown className={`h-2.5 w-2.5 transition-transform ${filtersOpen ? 'rotate-180' : ''}`} />
                  </button>

                  {filtersOpen && (
                    <>
                      <div 
                        className="fixed inset-0 z-40" 
                        onClick={() => setFiltersOpen(false)}
                      />
                      <div className="absolute right-0 top-8 z-50 w-64 theme-surface rounded shadow theme-border border p-2">
                        <div className="flex items-center justify-between mb-2">
                          <h3 className="font-semibold theme-text text-xs">Filters</h3>
                          <button
                            onClick={clearFilters}
                            className="text-[10px] text-blue-600 hover:opacity-80"
                          >
                            Clear All
                          </button>
                        </div>

                        {/* Category Filter */}
                        <div className="mb-2">
                          <h4 className="font-medium theme-text text-xs mb-1">Category</h4>
                          <select
                            value={selectedCategory}
                            onChange={(e) => setSelectedCategory(e.target.value)}
                            className="w-full px-2 py-1 text-xs theme-border border rounded theme-surface theme-text"
                          >
                            {categories.map(category => (
                              <option key={category} value={category}>
                                {category}
                              </option>
                            ))}
                          </select>
                        </div>

                        {/* Price Filter */}
                        <div className="mb-2">
                          <h4 className="font-medium theme-text text-xs mb-1">Price Range (UGX)</h4>
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
                  className="theme-border border rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500 theme-surface theme-text"
                >
                  {sortOptions.map(option => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>

                {/* View Mode Toggle */}
                <div className="theme-border border rounded overflow-hidden">
                  <button
                    onClick={() => setViewMode('grid')}
                    className={`p-1 ${
                      viewMode === 'grid' 
                        ? 'bg-blue-600 text-white' 
                        : 'theme-surface theme-text-muted hover:theme-secondary'
                    }`}
                  >
                    <Grid className="h-3 w-3" />
                  </button>
                  <button
                    onClick={() => setViewMode('list')}
                    className={`p-1 ${
                      viewMode === 'list' 
                        ? 'bg-blue-600 text-white' 
                        : 'theme-surface theme-text-muted hover:theme-secondary'
                    }`}
                  >
                    <List className="h-3 w-3" />
                  </button>
                </div>
              </div>
            </div>

            {/* Active Filter Chips - Desktop */}
            <FilterChips />
          </div>

          {/* Active Filter Chips - Mobile */}
          <div className="lg:hidden mb-2">
            <FilterChips />
          </div>

          {/* Products Grid - COMPACT */}
          {loading ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
              {[...Array(8)].map((_, i) => (
                <div key={i} className="theme-surface rounded shadow-xs theme-border border p-2 animate-pulse">
                  <div className="bg-gray-300 dark:bg-gray-600 h-24 rounded mb-2"></div>
                  <div className="bg-gray-300 dark:bg-gray-600 h-2.5 rounded mb-1.5"></div>
                  <div className="bg-gray-300 dark:bg-gray-600 h-2.5 rounded w-3/4"></div>
                </div>
              ))}
            </div>
          ) : products.length > 0 ? (
            <div className={`grid gap-2 ${
              viewMode === 'grid' 
                ? 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-4' 
                : 'grid-cols-1'
            }`}>
              {products.map(product => (
                <ProductCard key={product._id} product={product} compact />
              ))}
            </div>
          ) : (
            <div className="text-center py-6">
              <div className="text-gray-400 text-4xl mb-2">🔍</div>
              <h3 className="text-base font-semibold theme-text mb-1">
                {currentSearchTerm ? `No products for "${currentSearchTerm}"` : 'No products found'}
              </h3>
              <p className="theme-text-muted text-xs mb-2">
                {currentSearchTerm ? 'Try different search' : 'Adjust filters or'}
              </p>
              <div className="flex justify-center gap-1">
                <button
                  onClick={clearFilters}
                  className="bg-blue-600 hover:bg-blue-700 text-white px-2 py-1 rounded text-xs"
                >
                  {currentSearchTerm ? 'Clear Search' : 'Clear Filters'}
                </button>
                <a 
                  href="tel:+256751808507" 
                  className="bg-green-600 hover:bg-green-700 text-white px-2 py-1 rounded text-xs flex items-center gap-0.5"
                >
                  ☎️ Call
                </a>
              </div>
            </div>
          )}
        </div>

        {/* Hidden SEO content for crawlers - KEPT UNCHANGED */}
        <div className="hidden" aria-hidden="true">
          <h1>Electrical Products Uganda - Wholesale & Retail Prices</h1>
          <h2>Kiwa General Electricals - Uganda's Electrical Superstore</h2>
          <p>Browse our complete range of electrical and electronics products at wholesale prices. We supply generators, solar systems, wires, cables, switches, sockets, home appliances, industrial equipment, and all electrical supplies across Uganda. Call 0751808507 for bulk orders and free delivery in Kampala. Email: gogreenuganda70@gmail.com</p>
          <h3>Categories Available:</h3>
          <ul>
            <li>Generators Uganda</li>
            <li>Solar Systems Uganda</li>
            <li>Electrical Wires & Cables</li>
            <li>Switches & Sockets</li>
            <li>Home Appliances</li>
            <li>Industrial Equipment</li>
            <li>Lighting Solutions</li>
            <li>Tools & Safety Equipment</li>
          </ul>
          <p>Location: Serving Kampala and all of Uganda. Wholesale prices available for bulk orders. Free delivery within Kampala. Call 0751808507 today.</p>
        </div>
      </div>
    </>
  );
};

export default Products;