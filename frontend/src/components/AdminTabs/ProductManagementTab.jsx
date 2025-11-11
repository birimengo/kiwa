import React, { useState, useEffect, useCallback } from 'react';
import { 
  Plus, 
  Edit, 
  Trash2, 
  Package, 
  ChevronLeft, 
  ChevronRight, 
  Upload, 
  X, 
  RefreshCw, 
  AlertCircle,
  Search,
  Filter,
  AlertTriangle,
  History,
  PackagePlus,
  DollarSign,
  Tag,
  Menu,
  MoreVertical
} from 'lucide-react';
import { productsAPI } from '../../services/api';

const ProductManagementTab = ({ 
  user, 
  onLogout, 
  initialProducts = [], 
  onProductsUpdate,
  productsLoading = false 
}) => {
  const [products, setProducts] = useState(initialProducts);
  const [filteredProducts, setFilteredProducts] = useState(initialProducts);
  const [loading, setLoading] = useState(productsLoading);
  const [showProductForm, setShowProductForm] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [activeImageIndexes, setActiveImageIndexes] = useState({});
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [hasInitialized, setHasInitialized] = useState(false);
  const [lowStockFilter, setLowStockFilter] = useState(false);
  const [showStockHistory, setShowStockHistory] = useState(false);
  const [selectedProductHistory, setSelectedProductHistory] = useState(null);
  const [showRestockForm, setShowRestockForm] = useState(false);
  const [restockingProduct, setRestockingProduct] = useState(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [productActionMenu, setProductActionMenu] = useState(null);

  const [restockFormData, setRestockFormData] = useState({
    quantity: '',
    purchasePrice: '',
    sellingPrice: '',
    notes: ''
  });

  const [formData, setFormData] = useState({
    name: '',
    brand: '',
    purchasePrice: '',
    sellingPrice: '',
    category: '',
    description: '',
    stock: '',
    lowStockAlert: '5'
  });

  const [imageFiles, setImageFiles] = useState([]);
  const [imagePreviews, setImagePreviews] = useState([]);

  const categories = [
    'smartphones', 'laptops', 'tablets', 'cameras', 'audio', 
    'gaming', 'accessories', 'watches', 'headphones', 'speakers'
  ];

  // Initialize products and image indexes
  useEffect(() => {
    setProducts(initialProducts);
    setFilteredProducts(initialProducts);
    
    const initialIndexes = {};
    initialProducts.forEach(product => {
      initialIndexes[product._id] = 0;
    });
    setActiveImageIndexes(initialIndexes);
    
    if (!productsLoading) {
      setLoading(false);
    }
  }, [initialProducts, productsLoading]);

  // Fetch products if not provided
  const fetchProducts = useCallback(async () => {
    if (initialProducts.length > 0 || loading) return;

    setLoading(true);
    setError('');
    
    try {
      const response = await productsAPI.getProducts({
        page: 1,
        limit: 50
      });
      
      if (response.data && response.data.products) {
        const productsData = response.data.products;
        setProducts(productsData);
        setFilteredProducts(productsData);
        
        const initialIndexes = {};
        productsData.forEach(product => {
          initialIndexes[product._id] = 0;
        });
        setActiveImageIndexes(initialIndexes);
      } else {
        setProducts([]);
        setFilteredProducts([]);
      }
    } catch (error) {
      const errorMessage = handleApiError(error);
      setError(errorMessage);
      
      if (error.response?.status === 401) {
        setError('Your session has expired. Please login again.');
        onLogout();
      }
      setProducts([]);
      setFilteredProducts([]);
    } finally {
      setLoading(false);
    }
  }, [initialProducts.length, loading, onLogout]);

  // Filter products based on search, category, and low stock
  useEffect(() => {
    if (products.length === 0) return;
    
    let filtered = products;
    
    if (searchTerm) {
      filtered = filtered.filter(product =>
        product.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        product.brand?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        product.category?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }
    
    if (selectedCategory !== 'all') {
      filtered = filtered.filter(product =>
        product.category?.toLowerCase() === selectedCategory.toLowerCase()
      );
    }
    
    if (lowStockFilter) {
      filtered = filtered.filter(product => 
        product.stock <= (product.lowStockAlert || 5)
      );
    }
    
    setFilteredProducts(filtered);
  }, [products, searchTerm, selectedCategory, lowStockFilter]);

  // Initialize component
  useEffect(() => {
    if (hasInitialized) return;
    
    if (initialProducts.length === 0 && !productsLoading) {
      fetchProducts();
    } else if (initialProducts.length > 0) {
      setLoading(false);
    } else if (productsLoading) {
      setLoading(true);
    } else {
      setLoading(false);
    }
    
    setHasInitialized(true);
  }, [initialProducts.length, productsLoading, fetchProducts, hasInitialized]);

  // Enhanced restock function with price updates
  const handleRestock = async (product) => {
    setRestockingProduct(product);
    setRestockFormData({
      quantity: '',
      purchasePrice: product.purchasePrice?.toString() || '',
      sellingPrice: product.sellingPrice?.toString() || '',
      notes: `Restocked ${product.name}`
    });
    setShowRestockForm(true);
    setProductActionMenu(null);
  };

  // Enhanced restock submit with price updates
  const handleRestockSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setError('');

    try {
      if (!restockFormData.quantity || parseInt(restockFormData.quantity) <= 0) {
        throw new Error('Valid quantity is required');
      }

      if (!restockFormData.purchasePrice || parseFloat(restockFormData.purchasePrice) < 0) {
        throw new Error('Valid purchase price is required');
      }

      if (!restockFormData.sellingPrice || parseFloat(restockFormData.sellingPrice) < 0) {
        throw new Error('Valid selling price is required');
      }

      if (parseFloat(restockFormData.sellingPrice) <= parseFloat(restockFormData.purchasePrice)) {
        throw new Error('Selling price must be greater than purchase price');
      }

      // First update prices if changed
      const priceUpdates = {};
      if (parseFloat(restockFormData.purchasePrice) !== restockingProduct.purchasePrice) {
        priceUpdates.purchasePrice = parseFloat(restockFormData.purchasePrice);
      }
      if (parseFloat(restockFormData.sellingPrice) !== restockingProduct.sellingPrice) {
        priceUpdates.sellingPrice = parseFloat(restockFormData.sellingPrice);
      }

      if (Object.keys(priceUpdates).length > 0) {
        await productsAPI.updateProduct(restockingProduct._id, priceUpdates);
      }

      // Then restock
      await productsAPI.restockProduct(restockingProduct._id, {
        quantity: parseInt(restockFormData.quantity),
        notes: restockFormData.notes
      });

      setShowRestockForm(false);
      setRestockingProduct(null);
      setRestockFormData({ quantity: '', purchasePrice: '', sellingPrice: '', notes: '' });
      
      if (onProductsUpdate) {
        await onProductsUpdate();
      } else {
        await fetchProducts();
      }
      
      alert('Product restocked and prices updated successfully!');
      
    } catch (error) {
      if (error.response?.status === 401) {
        setError('Your session has expired. Please login again.');
        onLogout();
      } else {
        const errorMessage = error.response?.data?.message || 
                            error.message ||
                            'Error restocking product. Please try again.';
        setError(errorMessage);
      }
    } finally {
      setSubmitting(false);
    }
  };

  // View stock history
  const handleViewStockHistory = async (product) => {
    try {
      const response = await productsAPI.getStockHistory(product._id);
      setSelectedProductHistory({
        product: product,
        history: response.data.history || []
      });
      setShowStockHistory(true);
      setProductActionMenu(null);
    } catch (error) {
      const errorMessage = error.response?.data?.message || 'Error fetching stock history';
      setError(errorMessage);
    }
  };

  // Image handling functions
  const handleImageUpload = (e) => {
    const files = Array.from(e.target.files);
    
    if (imageFiles.length + files.length > 5) {
      alert(`Maximum 5 images allowed. You currently have ${imageFiles.length} images selected.`);
      return;
    }

    const validFiles = files.filter(file => file.type.startsWith('image/'));
    const newPreviews = validFiles.map(file => URL.createObjectURL(file));
    
    setImageFiles(prev => [...prev, ...validFiles]);
    setImagePreviews(prev => [...prev, ...newPreviews]);
    
    e.target.value = '';
  };

  const removeImage = (index) => {
    setImageFiles(prev => prev.filter((_, i) => i !== index));
    setImagePreviews(prev => {
      URL.revokeObjectURL(prev[index]);
      return prev.filter((_, i) => i !== index);
    });
  };

  const convertImagesToBase64 = (files) => {
    return new Promise((resolve) => {
      const base64Images = [];
      let processed = 0;

      if (files.length === 0) {
        resolve([]);
        return;
      }

      files.forEach((file) => {
        const reader = new FileReader();
        reader.onload = (e) => {
          base64Images.push(e.target.result);
          processed++;
          if (processed === files.length) {
            resolve(base64Images);
          }
        };
        reader.onerror = () => {
          processed++;
          if (processed === files.length) {
            resolve(base64Images);
          }
        };
        reader.readAsDataURL(file);
      });
    });
  };

  // Image navigation
  const nextImage = (productId) => {
    const product = products.find(p => p._id === productId);
    if (!product || !product.images) return;
    
    setActiveImageIndexes(prev => ({
      ...prev,
      [productId]: (prev[productId] + 1) % product.images.length
    }));
  };

  const prevImage = (productId) => {
    const product = products.find(p => p._id === productId);
    if (!product || !product.images) return;
    
    setActiveImageIndexes(prev => ({
      ...prev,
      [productId]: prev[productId] === 0 ? product.images.length - 1 : prev[productId] - 1
    }));
  };

  // Utility functions
  const calculateProfitMargin = (purchasePrice, sellingPrice) => {
    if (!purchasePrice || !sellingPrice || purchasePrice <= 0) return 0;
    return ((sellingPrice - purchasePrice) / purchasePrice * 100).toFixed(2);
  };

  const calculateProfitAmount = (purchasePrice, sellingPrice) => {
    if (!purchasePrice || !sellingPrice) return 0;
    return sellingPrice - purchasePrice;
  };

  const isLowStock = (product) => {
    return product.stock <= (product.lowStockAlert || 5);
  };

  const isOutOfStock = (product) => {
    return product.stock <= 0;
  };

  // Form submission
  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setError('');

    try {
      if (!formData.name.trim()) throw new Error('Product name is required');
      if (!formData.brand.trim()) throw new Error('Brand is required');
      if (!formData.purchasePrice || parseFloat(formData.purchasePrice) < 0) throw new Error('Valid purchase price is required');
      if (!formData.sellingPrice || parseFloat(formData.sellingPrice) < 0) throw new Error('Valid selling price is required');
      if (parseFloat(formData.sellingPrice) <= parseFloat(formData.purchasePrice)) throw new Error('Selling price must be greater than purchase price');
      if (!formData.category.trim()) throw new Error('Category is required');
      if (!formData.description.trim()) throw new Error('Description is required');
      if (!formData.stock || parseInt(formData.stock) < 0) throw new Error('Valid stock quantity is required');
      if (!formData.lowStockAlert || parseInt(formData.lowStockAlert) < 0) throw new Error('Valid low stock alert level is required');
      if (imageFiles.length === 0 && (!editingProduct || !editingProduct.images || editingProduct.images.length === 0)) throw new Error('At least one image is required');

      let imageUrls = [];
      if (imageFiles.length > 0) {
        imageUrls = await convertImagesToBase64(imageFiles);
      } else if (editingProduct && editingProduct.images) {
        imageUrls = editingProduct.images;
      }

      const productData = {
        name: formData.name.trim(),
        brand: formData.brand.trim(),
        purchasePrice: parseFloat(formData.purchasePrice),
        sellingPrice: parseFloat(formData.sellingPrice),
        category: formData.category.trim(),
        description: formData.description.trim(),
        stock: parseInt(formData.stock),
        lowStockAlert: parseInt(formData.lowStockAlert),
        images: imageUrls
      };
      
      if (editingProduct) {
        await productsAPI.updateProduct(editingProduct._id, productData);
      } else {
        await productsAPI.createProduct(productData);
      }

      setShowProductForm(false);
      setEditingProduct(null);
      resetForm();
      
      if (onProductsUpdate) {
        await onProductsUpdate();
      } else {
        await fetchProducts();
      }
      
      alert(editingProduct ? 'Product updated successfully!' : 'Product created successfully!');
      
    } catch (error) {
      if (error.response?.status === 401) {
        setError('Your session has expired. Please login again.');
        onLogout();
      } else {
        const errorMessage = error.response?.data?.message || 
                            error.response?.data?.errors?.[0]?.msg || 
                            error.message ||
                            'Error saving product. Please try again.';
        setError(errorMessage);
      }
    } finally {
      setSubmitting(false);
    }
  };

  // Edit product
  const handleEdit = (product) => {
    setEditingProduct(product);
    setFormData({
      name: product.name || '',
      brand: product.brand || '',
      purchasePrice: '', // Empty for edit - prices can only be changed in restock
      sellingPrice: '', // Empty for edit - prices can only be changed in restock
      category: product.category || '',
      description: product.description || '',
      stock: '', // Empty for edit - stock can only be changed in restock
      lowStockAlert: product.lowStockAlert?.toString() || '5'
    });
    
    if (product.images && product.images.length > 0) {
      setImagePreviews(product.images);
    } else {
      setImagePreviews([]);
    }
    setImageFiles([]);
    
    setShowProductForm(true);
    setError('');
    setProductActionMenu(null);
  };

  // Delete product
  const handleDelete = async (productId) => {
    if (window.confirm('Are you sure you want to delete this product? This action cannot be undone.')) {
      try {
        await productsAPI.deleteProduct(productId);
        
        if (onProductsUpdate) {
          await onProductsUpdate();
        } else {
          await fetchProducts();
        }
        
        alert('Product deleted successfully!');
      } catch (error) {
        if (error.response?.status === 401) {
          setError('Your session has expired. Please login again.');
          onLogout();
        } else {
          const errorMessage = error.response?.data?.message || 'Error deleting product. Please try again.';
          alert(errorMessage);
        }
      }
    }
    setProductActionMenu(null);
  };

  // Reset form
  const resetForm = () => {
    setFormData({
      name: '',
      brand: '',
      purchasePrice: '',
      sellingPrice: '',
      category: '',
      description: '',
      stock: '',
      lowStockAlert: '5'
    });
    setImageFiles([]);
    imagePreviews.forEach(preview => URL.revokeObjectURL(preview));
    setImagePreviews([]);
    setError('');
  };

  // Retry loading products
  const handleRetry = () => {
    if (onProductsUpdate) {
      onProductsUpdate();
    } else {
      fetchProducts();
    }
  };

  // Handle API errors
  const handleApiError = (error) => {
    if (error.code === 'ECONNABORTED') {
      return 'Request timeout. Please check if the backend server is running.';
    } else if (!error.response) {
      return 'Cannot connect to server. Please check your internet connection and ensure the backend is running.';
    } else if (error.response?.status >= 500) {
      return 'Server error. Please try again later.';
    } else {
      return error.response?.data?.message || error.message || 'An unexpected error occurred';
    }
  };

  // Statistics
  const uniqueCategories = ['all', ...new Set(products.map(product => product.category).filter(Boolean))];
  const lowStockProductsCount = products.filter(product => isLowStock(product) && !isOutOfStock(product)).length;
  const outOfStockProductsCount = products.filter(product => isOutOfStock(product)).length;

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-2 sm:p-4">
      {/* Error Alert */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-4">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <AlertCircle className="h-4 w-4 text-red-600" />
                <h3 className="text-red-800 font-semibold text-sm">Error</h3>
              </div>
              <p className="text-red-700 text-sm">{error}</p>
            </div>
            <button
              onClick={handleRetry}
              className="ml-3 bg-red-600 hover:bg-red-700 text-white px-3 py-1.5 rounded text-sm transition-colors flex items-center gap-1"
            >
              <RefreshCw className="h-3 w-3" />
              Retry
            </button>
          </div>
        </div>
      )}

      {/* Stock Alerts */}
      {(lowStockProductsCount > 0 || outOfStockProductsCount > 0) && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 mb-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-yellow-600" />
              <span className="text-yellow-800 font-medium text-sm">
                {lowStockProductsCount > 0 && `${lowStockProductsCount} low stock`}
                {lowStockProductsCount > 0 && outOfStockProductsCount > 0 && ', '}
                {outOfStockProductsCount > 0 && `${outOfStockProductsCount} out of stock`}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Header Section */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4 mb-4 shadow-sm">
        <div className="flex flex-col lg:flex-row gap-4 items-start lg:items-center justify-between">
          <div className="flex-1 w-full">
            <div className="flex items-center justify-between lg:justify-start lg:gap-3">
              <div>
                <h2 className="text-lg font-bold text-gray-900 dark:text-white">Products Management</h2>
                <p className="text-gray-600 dark:text-gray-400 text-sm">
                  {loading ? 'Loading...' : `${filteredProducts.length} of ${products.length} product${products.length !== 1 ? 's' : ''}`}
                </p>
              </div>
              
              {/* Mobile Menu Button */}
              <button
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className="lg:hidden p-2 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700"
              >
                <Menu className="h-5 w-5 text-gray-600 dark:text-gray-400" />
              </button>
            </div>
          </div>
          
          {/* Desktop Controls */}
          <div className="hidden lg:flex flex-col lg:flex-row gap-3 w-full lg:w-auto">
            <div className="relative flex-1 lg:w-48">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search products..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-3 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
              />
            </div>

            <div className="relative flex-1 lg:w-40">
              <Filter className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="w-full pl-10 pr-3 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm appearance-none"
              >
                <option value="all">All Categories</option>
                {uniqueCategories.filter(cat => cat !== 'all').map(category => (
                  <option key={category} value={category}>
                    {category.charAt(0).toUpperCase() + category.slice(1)}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-center">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={lowStockFilter}
                  onChange={(e) => setLowStockFilter(e.target.checked)}
                  className="rounded border-gray-300 dark:border-gray-600 text-blue-600 focus:ring-blue-500"
                />
                <span className="text-sm text-gray-700 dark:text-gray-300">Low Stock</span>
              </label>
            </div>

            <div className="flex gap-2">
              <button
                onClick={handleRetry}
                disabled={loading}
                className="flex items-center gap-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-600 px-3 py-2.5 rounded-lg text-sm transition-colors disabled:opacity-50"
              >
                <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                Refresh
              </button>
              <button
                onClick={() => {
                  setShowProductForm(true);
                  setEditingProduct(null);
                  resetForm();
                }}
                className="flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white px-4 py-2.5 rounded-lg text-sm transition-colors shadow-sm hover:shadow-md"
              >
                <Plus className="h-4 w-4" />
                Add Product
              </button>
            </div>
          </div>

          {/* Mobile Controls */}
          {mobileMenuOpen && (
            <div className="lg:hidden w-full space-y-3 pt-4 border-t border-gray-200 dark:border-gray-600">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search products..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-3 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="relative">
                  <Filter className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <select
                    value={selectedCategory}
                    onChange={(e) => setSelectedCategory(e.target.value)}
                    className="w-full pl-10 pr-3 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm appearance-none"
                  >
                    <option value="all">All Categories</option>
                    {uniqueCategories.filter(cat => cat !== 'all').map(category => (
                      <option key={category} value={category}>
                        {category.charAt(0).toUpperCase() + category.slice(1)}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex items-center justify-center">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={lowStockFilter}
                      onChange={(e) => setLowStockFilter(e.target.checked)}
                      className="rounded border-gray-300 dark:border-gray-600 text-blue-600 focus:ring-blue-500"
                    />
                    <span className="text-sm text-gray-700 dark:text-gray-300">Low Stock</span>
                  </label>
                </div>
              </div>

              <div className="flex gap-2">
                <button
                  onClick={handleRetry}
                  disabled={loading}
                  className="flex-1 flex items-center justify-center gap-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-600 px-3 py-2.5 rounded-lg text-sm transition-colors disabled:opacity-50"
                >
                  <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                  Refresh
                </button>
                <button
                  onClick={() => {
                    setShowProductForm(true);
                    setEditingProduct(null);
                    resetForm();
                    setMobileMenuOpen(false);
                  }}
                  className="flex-1 flex items-center justify-center gap-2 bg-green-600 hover:bg-green-700 text-white px-3 py-2.5 rounded-lg text-sm transition-colors"
                >
                  <Plus className="h-4 w-4" />
                  Add Product
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Products Grid */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm">
        <div className="p-4 border-b border-gray-200 dark:border-gray-700">
          <h3 className="text-base font-semibold text-gray-900 dark:text-white">Product Inventory</h3>
        </div>

        <div className="p-3 sm:p-4">
          {loading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {[...Array(8)].map((_, i) => (
                <div key={i} className="bg-gray-100 dark:bg-gray-700 rounded-xl border border-gray-200 dark:border-gray-600 p-3 animate-pulse">
                  <div className="bg-gray-300 dark:bg-gray-600 h-48 rounded-lg mb-3"></div>
                  <div className="bg-gray-300 dark:bg-gray-600 h-3 rounded mb-2"></div>
                  <div className="bg-gray-300 dark:bg-gray-600 h-3 rounded w-2/3"></div>
                </div>
              ))}
            </div>
          ) : filteredProducts.length === 0 ? (
            <div className="text-center py-8">
              <Package className="h-12 w-12 mx-auto mb-3 text-gray-400 opacity-50" />
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                {products.length === 0 ? 'No Products Found' : 'No Products Match Your Search'}
              </h3>
              <p className="text-gray-600 dark:text-gray-400 text-sm mb-4">
                {products.length === 0 
                  ? 'Get started by adding your first product' 
                  : 'Try adjusting your search or filter criteria'
                }
              </p>
              {products.length === 0 && (
                <button
                  onClick={() => {
                    setShowProductForm(true);
                    setEditingProduct(null);
                    resetForm();
                  }}
                  className="bg-green-600 hover:bg-green-700 text-white px-4 py-2.5 rounded-lg text-sm transition-colors shadow-sm hover:shadow-md"
                >
                  Add First Product
                </button>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {filteredProducts.map((product) => {
                const profitMargin = calculateProfitMargin(product.purchasePrice, product.sellingPrice);
                const profitAmount = calculateProfitAmount(product.purchasePrice, product.sellingPrice);
                const currentImageIndex = activeImageIndexes[product._id] || 0;
                const lowStock = isLowStock(product);
                const outOfStock = isOutOfStock(product);
                
                return (
                  <div key={product._id} className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm hover:shadow-md transition-all duration-200 overflow-hidden flex flex-col h-full group">
                    {/* Stock Status Badges */}
                    {lowStock && !outOfStock && (
                      <div className="absolute top-3 left-3 z-10">
                        <span className="bg-yellow-500 text-white text-xs px-2 py-1 rounded-full font-medium flex items-center gap-1 shadow-lg">
                          <AlertTriangle className="h-3 w-3" />
                          Low Stock
                        </span>
                      </div>
                    )}
                    
                    {outOfStock && (
                      <div className="absolute top-3 left-3 z-10">
                        <span className="bg-red-500 text-white text-xs px-2 py-1 rounded-full font-medium flex items-center gap-1 shadow-lg">
                          <X className="h-3 w-3" />
                          Out of Stock
                        </span>
                      </div>
                    )}

                    {/* Action Menu */}
                    <div className="absolute top-3 right-3 z-10">
                      <button
                        onClick={() => setProductActionMenu(productActionMenu === product._id ? null : product._id)}
                        className="p-1.5 bg-white dark:bg-gray-700 rounded-lg shadow-lg opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <MoreVertical className="h-4 w-4 text-gray-600 dark:text-gray-400" />
                      </button>
                      
                      {productActionMenu === product._id && (
                        <div className="absolute right-0 top-8 mt-1 w-48 bg-white dark:bg-gray-700 rounded-lg shadow-xl border border-gray-200 dark:border-gray-600 py-1 z-20">
                          <button
                            onClick={() => handleRestock(product)}
                            className="w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-600 flex items-center gap-2"
                          >
                            <PackagePlus className="h-4 w-4" />
                            Restock
                          </button>
                          <button
                            onClick={() => handleEdit(product)}
                            className="w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-600 flex items-center gap-2"
                          >
                            <Edit className="h-4 w-4" />
                            Edit
                          </button>
                          <button
                            onClick={() => handleViewStockHistory(product)}
                            className="w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-600 flex items-center gap-2"
                          >
                            <History className="h-4 w-4" />
                            History
                          </button>
                          <button
                            onClick={() => handleDelete(product._id)}
                            className="w-full text-left px-4 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-gray-50 dark:hover:bg-gray-600 flex items-center gap-2"
                          >
                            <Trash2 className="h-4 w-4" />
                            Delete
                          </button>
                        </div>
                      )}
                    </div>

                    {/* Image Section - Full width and height */}
                    <div className="relative h-56 bg-gray-100 dark:bg-gray-700 flex-shrink-0 w-full">
                      {product.images && product.images.length > 0 ? (
                        <>
                          <img
                            src={product.images[currentImageIndex]}
                            alt={product.name}
                            className="w-full h-full object-cover"
                            onError={(e) => {
                              e.target.src = 'https://via.placeholder.com/300x200?text=Image+Error';
                            }}
                          />
                          
                          {product.images.length > 1 && (
                            <>
                              <button
                                onClick={() => prevImage(product._id)}
                                className="absolute left-2 top-1/2 transform -translate-y-1/2 bg-black bg-opacity-60 text-white p-1.5 rounded-full hover:bg-opacity-80 transition-all shadow-lg"
                              >
                                <ChevronLeft className="h-4 w-4" />
                              </button>
                              <button
                                onClick={() => nextImage(product._id)}
                                className="absolute right-2 top-1/2 transform -translate-y-1/2 bg-black bg-opacity-60 text-white p-1.5 rounded-full hover:bg-opacity-80 transition-all shadow-lg"
                              >
                                <ChevronRight className="h-4 w-4" />
                              </button>
                            </>
                          )}
                          
                          {product.images.length > 1 && (
                            <div className="absolute bottom-2 left-1/2 transform -translate-x-1/2 flex gap-1.5">
                              {product.images.map((_, index) => (
                                <div
                                  key={index}
                                  className={`w-2 h-2 rounded-full transition-all ${
                                    index === currentImageIndex
                                      ? 'bg-white shadow-lg'
                                      : 'bg-white bg-opacity-50'
                                  }`}
                                />
                              ))}
                            </div>
                          )}
                          
                          <div className="absolute top-2 right-2 bg-black bg-opacity-60 text-white text-xs px-2 py-1 rounded-full shadow-lg">
                            {currentImageIndex + 1}/{product.images.length}
                          </div>
                        </>
                      ) : (
                        <div className="w-full h-full flex flex-col items-center justify-center text-gray-400 bg-gray-200 dark:bg-gray-600">
                          <Package className="h-12 w-12 opacity-50 mb-2" />
                          <span className="text-sm">No Image</span>
                        </div>
                      )}
                    </div>

                    {/* Product Info */}
                    <div className="p-4 flex-1 flex flex-col">
                      <div className="flex justify-between items-start mb-2">
                        <h3 className="font-semibold text-gray-900 dark:text-white line-clamp-1 flex-1 mr-2 text-sm">{product.name}</h3>
                        <span className="font-bold text-blue-600 dark:text-blue-400 whitespace-nowrap text-sm">
                          UGX {product.sellingPrice?.toLocaleString()}
                        </span>
                      </div>
                      
                      <p className="text-gray-600 dark:text-gray-400 mb-3 text-xs">{product.brand}</p>
                      
                      <div className="flex items-center justify-between mb-3">
                        <span className="inline-block px-2.5 py-1 bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 rounded-full capitalize text-xs font-medium">
                          {product.category}
                        </span>
                        <span className={`inline-flex items-center px-2.5 py-1 rounded-full font-medium text-xs ${
                          outOfStock ? 'bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-200' :
                          lowStock ? 'bg-yellow-100 dark:bg-yellow-900 text-yellow-800 dark:text-yellow-200' : 
                          'bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200'
                        }`}>
                          {product.stock} in stock
                          {lowStock && !outOfStock && (
                            <AlertTriangle className="h-3 w-3 ml-1" />
                          )}
                        </span>
                      </div>

                      <div className="grid grid-cols-2 gap-2 mb-3">
                        <div className="text-center p-2 bg-gray-50 dark:bg-gray-700 rounded-lg">
                          <p className="text-gray-600 dark:text-gray-400 text-xs">Cost</p>
                          <p className="font-semibold text-gray-900 dark:text-white text-sm">UGX {product.purchasePrice?.toLocaleString()}</p>
                        </div>
                        <div className="text-center p-2 bg-green-50 dark:bg-green-900/20 rounded-lg">
                          <p className="text-gray-600 dark:text-gray-400 text-xs">Profit</p>
                          <p className="font-semibold text-green-600 text-sm">
                            UGX {profitAmount.toLocaleString()}
                          </p>
                          <p className="text-green-600 text-xs">({profitMargin}%)</p>
                        </div>
                      </div>

                      <p className="text-gray-700 dark:text-gray-300 line-clamp-2 mb-4 text-xs leading-relaxed flex-1">
                        {product.description}
                      </p>

                      {/* Mobile Action Buttons - Hidden on desktop */}
                      <div className="lg:hidden grid grid-cols-2 gap-2 mt-auto">
                        <button
                          onClick={() => handleRestock(product)}
                          className="bg-blue-600 hover:bg-blue-700 text-white py-2 px-2 rounded-lg font-semibold transition-all duration-200 flex items-center justify-center gap-1 text-xs shadow-sm hover:shadow-md"
                        >
                          <PackagePlus className="h-3 w-3" />
                          Restock
                        </button>
                        <button
                          onClick={() => handleEdit(product)}
                          className="bg-green-600 hover:bg-green-700 text-white py-2 px-2 rounded-lg font-semibold transition-all duration-200 flex items-center justify-center gap-1 text-xs shadow-sm hover:shadow-md"
                        >
                          <Edit className="h-3 w-3" />
                          Edit
                        </button>
                        <button
                          onClick={() => handleViewStockHistory(product)}
                          className="bg-purple-600 hover:bg-purple-700 text-white py-2 px-2 rounded-lg font-semibold transition-all duration-200 flex items-center justify-center gap-1 text-xs shadow-sm hover:shadow-md"
                        >
                          <History className="h-3 w-3" />
                          History
                        </button>
                        <button
                          onClick={() => handleDelete(product._id)}
                          className="bg-red-600 hover:bg-red-700 text-white py-2 px-2 rounded-lg font-semibold transition-all duration-200 flex items-center justify-center gap-1 text-xs shadow-sm hover:shadow-md"
                        >
                          <Trash2 className="h-3 w-3" />
                          Delete
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Enhanced Restock Form Modal */}
      {showRestockForm && restockingProduct && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-3 z-50">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl max-w-md w-full max-h-[95vh] overflow-y-auto">
            <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                Restock & Update Prices
              </h2>
              <button
                onClick={() => {
                  setShowRestockForm(false);
                  setRestockingProduct(null);
                  setRestockFormData({ quantity: '', purchasePrice: '', sellingPrice: '', notes: '' });
                }}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleRestockSubmit} className="p-4 space-y-4">
              <div className="bg-blue-50 dark:bg-blue-900/20 p-3 rounded-lg">
                <p className="font-semibold text-gray-900 dark:text-white">{restockingProduct.name}</p>
                <p className="text-gray-600 dark:text-gray-400 text-sm">Current Stock: {restockingProduct.stock}</p>
              </div>

              <div>
                <label className="block font-medium text-gray-900 dark:text-white mb-2">Quantity to Add *</label>
                <input
                  type="number"
                  required
                  min="1"
                  value={restockFormData.quantity}
                  onChange={(e) => setRestockFormData(prev => ({ ...prev, quantity: e.target.value }))}
                  className="w-full px-3 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
                  placeholder="Enter quantity"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block font-medium text-gray-900 dark:text-white mb-2">Purchase Price *</label>
                  <div className="relative">
                    <DollarSign className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <input
                      type="number"
                      required
                      step="0.01"
                      min="0"
                      value={restockFormData.purchasePrice}
                      onChange={(e) => setRestockFormData(prev => ({ ...prev, purchasePrice: e.target.value }))}
                      className="w-full pl-10 pr-3 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
                      placeholder="Cost price"
                    />
                  </div>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    Current: UGX {restockingProduct.purchasePrice?.toLocaleString()}
                  </p>
                </div>

                <div>
                  <label className="block font-medium text-gray-900 dark:text-white mb-2">Selling Price *</label>
                  <div className="relative">
                    <Tag className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <input
                      type="number"
                      required
                      step="0.01"
                      min="0"
                      value={restockFormData.sellingPrice}
                      onChange={(e) => setRestockFormData(prev => ({ ...prev, sellingPrice: e.target.value }))}
                      className="w-full pl-10 pr-3 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
                      placeholder="Selling price"
                    />
                  </div>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    Current: UGX {restockingProduct.sellingPrice?.toLocaleString()}
                  </p>
                </div>
              </div>

              {restockFormData.purchasePrice && restockFormData.sellingPrice && (
                <div className="bg-green-50 dark:bg-green-900/20 p-3 rounded-lg">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-700 dark:text-gray-300">Profit Margin:</span>
                    <span className="font-semibold text-green-600">
                      {calculateProfitMargin(parseFloat(restockFormData.purchasePrice), parseFloat(restockFormData.sellingPrice))}%
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-700 dark:text-gray-300">Profit per Unit:</span>
                    <span className="font-semibold text-green-600">
                      UGX {calculateProfitAmount(parseFloat(restockFormData.purchasePrice), parseFloat(restockFormData.sellingPrice)).toLocaleString()}
                    </span>
                  </div>
                </div>
              )}

              <div>
                <label className="block font-medium text-gray-900 dark:text-white mb-2">Notes</label>
                <textarea
                  rows="3"
                  value={restockFormData.notes}
                  onChange={(e) => setRestockFormData(prev => ({ ...prev, notes: e.target.value }))}
                  className="w-full px-3 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
                  placeholder="Add any notes about this restock and price update..."
                />
              </div>

              <div className="flex gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-2.5 rounded-lg font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-sm hover:shadow-md"
                >
                  {submitting ? (
                    <div className="flex items-center justify-center gap-2">
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                      Updating...
                    </div>
                  ) : (
                    'Update Product'
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowRestockForm(false);
                    setRestockingProduct(null);
                    setRestockFormData({ quantity: '', purchasePrice: '', sellingPrice: '', notes: '' });
                  }}
                  className="flex-1 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-600 py-2.5 rounded-lg font-semibold transition-colors"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Stock History Modal */}
      {showStockHistory && selectedProductHistory && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-3 z-50">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl max-w-2xl w-full max-h-[95vh] overflow-y-auto">
            <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                Stock History - {selectedProductHistory.product.name}
              </h2>
              <button
                onClick={() => {
                  setShowStockHistory(false);
                  setSelectedProductHistory(null);
                }}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="p-4">
              <div className="mb-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-gray-600 dark:text-gray-400">Current Stock:</span>
                    <p className="font-semibold text-lg text-gray-900 dark:text-white">{selectedProductHistory.product.stock}</p>
                  </div>
                  <div>
                    <span className="text-gray-600 dark:text-gray-400">Total Restocked:</span>
                    <p className="font-semibold text-lg text-gray-900 dark:text-white">{selectedProductHistory.product.restockedQuantity || 0}</p>
                  </div>
                </div>
              </div>

              {selectedProductHistory.history.length === 0 ? (
                <div className="text-center py-8">
                  <Package className="h-12 w-12 mx-auto mb-3 text-gray-400 opacity-50" />
                  <p className="text-gray-600 dark:text-gray-400">No stock history available</p>
                </div>
              ) : (
                <div className="space-y-3 max-h-96 overflow-y-auto">
                  {selectedProductHistory.history.map((record, index) => (
                    <div key={index} className="p-3 border border-gray-200 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
                      <div className="flex justify-between items-start mb-2">
                        <div>
                          <p className="font-semibold text-gray-900 dark:text-white capitalize flex items-center gap-2">
                            {record.type === 'restock' ? '📦 Restock' : 
                             record.type === 'sale' ? '💰 Sale' : 
                             '📊 Adjustment'}
                          </p>
                          <p className="text-gray-600 dark:text-gray-400 text-sm">
                            {new Date(record.createdAt).toLocaleDateString()} at {new Date(record.createdAt).toLocaleTimeString()}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className={`font-semibold text-sm ${
                            record.unitsChanged > 0 ? 'text-green-600' : 'text-red-600'
                          }`}>
                            {record.unitsChanged > 0 ? '+' : ''}{record.unitsChanged} units
                          </p>
                          <p className="text-gray-600 dark:text-gray-400 text-sm">
                            {record.previousStock} → {record.newStock}
                          </p>
                        </div>
                      </div>
                      {record.notes && (
                        <p className="text-gray-600 dark:text-gray-400 text-sm mt-2 p-2 bg-gray-50 dark:bg-gray-800 rounded">{record.notes}</p>
                      )}
                      {record.user && (
                        <p className="text-gray-600 dark:text-gray-400 text-sm mt-1">
                          By: {record.user.name}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Enhanced Product Form Modal */}
      {showProductForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-3 z-50">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl max-w-2xl w-full max-h-[95vh] overflow-y-auto">
            <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                {editingProduct ? 'Edit Product' : 'Add New Product'}
              </h2>
              <button
                onClick={() => {
                  setShowProductForm(false);
                  setEditingProduct(null);
                  resetForm();
                }}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-4 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block font-medium text-gray-900 dark:text-white mb-2">Product Name *</label>
                  <input
                    type="text"
                    required
                    value={formData.name}
                    onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                    className="w-full px-3 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
                    placeholder="Enter product name"
                  />
                </div>

                <div>
                  <label className="block font-medium text-gray-900 dark:text-white mb-2">Brand *</label>
                  <input
                    type="text"
                    required
                    value={formData.brand}
                    onChange={(e) => setFormData(prev => ({ ...prev, brand: e.target.value }))}
                    className="w-full px-3 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
                    placeholder="Enter brand name"
                  />
                </div>
              </div>

              {!editingProduct && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block font-medium text-gray-900 dark:text-white mb-2">Purchase Price *</label>
                    <div className="relative">
                      <DollarSign className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                      <input
                        type="number"
                        required
                        step="0.01"
                        min="0"
                        value={formData.purchasePrice}
                        onChange={(e) => setFormData(prev => ({ ...prev, purchasePrice: e.target.value }))}
                        className="w-full pl-10 pr-3 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
                        placeholder="Cost price"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block font-medium text-gray-900 dark:text-white mb-2">Selling Price *</label>
                    <div className="relative">
                      <Tag className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                      <input
                        type="number"
                        required
                        step="0.01"
                        min="0"
                        value={formData.sellingPrice}
                        onChange={(e) => setFormData(prev => ({ ...prev, sellingPrice: e.target.value }))}
                        className="w-full pl-10 pr-3 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
                        placeholder="Selling price"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block font-medium text-gray-900 dark:text-white mb-2">Initial Stock *</label>
                    <input
                      type="number"
                      required
                      min="0"
                      value={formData.stock}
                      onChange={(e) => setFormData(prev => ({ ...prev, stock: e.target.value }))}
                      className="w-full px-3 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
                      placeholder="Initial quantity"
                    />
                  </div>
                </div>
              )}

              {!editingProduct && formData.purchasePrice && formData.sellingPrice && (
                <div className="bg-green-50 dark:bg-green-900/20 p-4 rounded-lg">
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-gray-600 dark:text-gray-400">Profit Margin:</span>
                      <p className="font-semibold text-green-600">
                        {calculateProfitMargin(parseFloat(formData.purchasePrice), parseFloat(formData.sellingPrice))}%
                      </p>
                    </div>
                    <div>
                      <span className="text-gray-600 dark:text-gray-400">Profit per Unit:</span>
                      <p className="font-semibold text-green-600">
                        UGX {calculateProfitAmount(parseFloat(formData.purchasePrice), parseFloat(formData.sellingPrice)).toLocaleString()}
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {editingProduct && (
                <div className="bg-yellow-50 dark:bg-yellow-900/20 p-4 rounded-lg">
                  <div className="flex items-center gap-3 text-yellow-800 dark:text-yellow-200">
                    <AlertTriangle className="h-5 w-5" />
                    <p className="text-sm font-medium">
                      Note: Stock and prices can only be modified through the Restock function to maintain inventory accuracy.
                    </p>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block font-medium text-gray-900 dark:text-white mb-2">Category *</label>
                  <select
                    required
                    value={formData.category}
                    onChange={(e) => setFormData(prev => ({ ...prev, category: e.target.value }))}
                    className="w-full px-3 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
                  >
                    <option value="">Select Category</option>
                    {categories.map(category => (
                      <option key={category} value={category}>
                        {category.charAt(0).toUpperCase() + category.slice(1)}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-medium text-gray-900 dark:text-white mb-2">Low Stock Alert *</label>
                  <input
                    type="number"
                    required
                    min="0"
                    value={formData.lowStockAlert}
                    onChange={(e) => setFormData(prev => ({ ...prev, lowStockAlert: e.target.value }))}
                    className="w-full px-3 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
                    placeholder="Alert level"
                  />
                </div>
              </div>

              <div>
                <label className="block font-medium text-gray-900 dark:text-white mb-2">Description *</label>
                <textarea
                  rows="3"
                  required
                  value={formData.description}
                  onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                  className="w-full px-3 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
                  placeholder="Enter product description"
                />
              </div>

              <div>
                <label className="block font-medium text-gray-900 dark:text-white mb-2">
                  Product Images {!editingProduct && '*'}
                  <span className="text-sm text-gray-500 dark:text-gray-400 ml-2">(Max 5 images)</span>
                </label>
                <div className="border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg p-6">
                  <div className="flex flex-col items-center justify-center gap-3">
                    <Upload className="h-8 w-8 text-gray-400" />
                    <p className="text-gray-600 dark:text-gray-400 text-sm text-center">
                      Drag & drop images here or click to browse
                    </p>
                    <input
                      type="file"
                      multiple
                      accept="image/*"
                      onChange={handleImageUpload}
                      className="hidden"
                      id="image-upload"
                    />
                    <label
                      htmlFor="image-upload"
                      className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2.5 rounded-lg text-sm transition-colors cursor-pointer shadow-sm hover:shadow-md"
                    >
                      Browse Images
                    </label>
                  </div>
                </div>

                {imagePreviews.length > 0 && (
                  <div className="mt-4">
                    <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">Selected Images:</p>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                      {imagePreviews.map((preview, index) => (
                        <div key={index} className="relative group">
                          <img
                            src={preview}
                            alt={`Preview ${index + 1}`}
                            className="w-full h-24 object-cover rounded-lg"
                          />
                          <button
                            type="button"
                            onClick={() => removeImage(index)}
                            className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity shadow-lg"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <div className="flex gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex-1 bg-green-600 hover:bg-green-700 text-white py-2.5 rounded-lg font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-sm hover:shadow-md"
                >
                  {submitting ? (
                    <div className="flex items-center justify-center gap-2">
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                      {editingProduct ? 'Updating...' : 'Creating...'}
                    </div>
                  ) : (
                    editingProduct ? 'Update Product' : 'Create Product'
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowProductForm(false);
                    setEditingProduct(null);
                    resetForm();
                  }}
                  className="flex-1 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-600 py-2.5 rounded-lg font-semibold transition-colors"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default ProductManagementTab;