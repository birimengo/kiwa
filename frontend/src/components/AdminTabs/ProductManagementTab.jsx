import React, { useState, useEffect, useCallback } from 'react';
import { 
  Plus, Edit, Trash2, Package, ChevronLeft, ChevronRight, Upload, X, RefreshCw, AlertCircle,
  Search, Filter, AlertTriangle, History, PackagePlus, DollarSign, Tag, Cloud, CloudOff
} from 'lucide-react';
import { productsAPI } from '../../services/api';
import LocalStorageService from '../../services/localStorageService';

const ProductManagementTab = ({ 
  user, onLogout, initialProducts = [], onProductsUpdate, productsLoading = false,
  isOnline = true, onSync
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

  // Initialize products
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

  // Optimized fetch function
  const fetchProducts = useCallback(async () => {
    if (initialProducts.length > 0 || loading) return;

    setLoading(true);
    setError('');
    
    try {
      if (isOnline) {
        console.log('🔄 Fetching products from API...');
        const response = await productsAPI.getProducts({ page: 1, limit: 50 });
        
        if (response.data && response.data.products) {
          const productsData = response.data.products;
          console.log(`✅ Loaded ${productsData.length} products from backend`);
          
          // Merge with local products
          const localProducts = LocalStorageService.getProducts();
          const mergedProducts = productsData.map(backendProduct => {
            const localProduct = localProducts.find(p => 
              !p.isLocal && p._id === backendProduct._id
            );
            
            if (localProduct) {
              // Merge with local data
              return {
                ...backendProduct,
                stock: localProduct.stock,
                totalSold: localProduct.totalSold,
                stockHistory: [
                  ...backendProduct.stockHistory || [],
                  ...localProduct.stockHistory || []
                ].sort((a, b) => new Date(b.date) - new Date(a.date))
              };
            }
            
            return backendProduct;
          });
          
          // Add local-only products
          const localOnlyProducts = localProducts.filter(p => p.isLocal);
          const allProducts = [...mergedProducts, ...localOnlyProducts];
          
          setProducts(allProducts);
          setFilteredProducts(allProducts);
          LocalStorageService.saveProducts(allProducts);
          
          const initialIndexes = {};
          allProducts.forEach(product => {
            initialIndexes[product._id] = 0;
          });
          setActiveImageIndexes(initialIndexes);
        }
      } else {
        // Offline mode: load from local storage
        console.log('📱 Offline mode: loading products from local storage');
        const localProducts = LocalStorageService.getProducts();
        setProducts(localProducts);
        setFilteredProducts(localProducts);
        
        const initialIndexes = {};
        localProducts.forEach(product => {
          initialIndexes[product._id] = 0;
        });
        setActiveImageIndexes(initialIndexes);
        
        console.log(`✅ Loaded ${localProducts.length} products from local storage`);
      }
    } catch (error) {
      console.error('❌ Error fetching products:', error);
      const errorMessage = handleApiError(error);
      setError(errorMessage);
      
      // Fallback to local storage
      const localProducts = LocalStorageService.getProducts();
      setProducts(localProducts);
      setFilteredProducts(localProducts);
      
      if (error.response?.status === 401) {
        setError('Your session has expired. Using local data.');
      }
    } finally {
      setLoading(false);
    }
  }, [initialProducts.length, loading, isOnline]);

  // Filter products
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

  const handleApiError = (error) => {
    console.error('API Error:', error);
    
    if (error.code === 'ECONNABORTED') {
      return 'Request timeout. Working in offline mode.';
    } else if (!error.response) {
      return 'Cannot connect to server. Using local data.';
    } else if (error.response?.status === 401) {
      return 'Your session has expired. Please login again.';
    } else if (error.response?.status >= 500) {
      return 'Server error. Using local data.';
    } else {
      return error.response?.data?.message || error.message || 'An unexpected error occurred';
    }
  };

  // Enhanced restock function
  const handleRestock = async (product) => {
    setRestockingProduct(product);
    setRestockFormData({
      quantity: '',
      purchasePrice: product.purchasePrice?.toString() || '',
      sellingPrice: product.sellingPrice?.toString() || '',
      notes: `Restocked ${product.name}`
    });
    setShowRestockForm(true);
  };

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

      // Update product locally
      const updatedProduct = LocalStorageService.restockProduct(
        restockingProduct._id,
        parseInt(restockFormData.quantity),
        restockFormData.notes
      );

      if (updatedProduct) {
        // Update prices if changed
        if (parseFloat(restockFormData.purchasePrice) !== restockingProduct.purchasePrice ||
            parseFloat(restockFormData.sellingPrice) !== restockingProduct.sellingPrice) {
          
          LocalStorageService.updateProduct(restockingProduct._id, {
            purchasePrice: parseFloat(restockFormData.purchasePrice),
            sellingPrice: parseFloat(restockFormData.sellingPrice)
          });
        }

        // Try to sync online if connected
        if (isOnline && !restockingProduct.isLocal) {
          try {
            // Update prices on backend
            if (parseFloat(restockFormData.purchasePrice) !== restockingProduct.purchasePrice ||
                parseFloat(restockFormData.sellingPrice) !== restockingProduct.sellingPrice) {
              await productsAPI.updateProduct(restockingProduct._id, {
                purchasePrice: parseFloat(restockFormData.purchasePrice),
                sellingPrice: parseFloat(restockFormData.sellingPrice)
              });
            }

            // Restock on backend
            await productsAPI.restockProduct(restockingProduct._id, {
              quantity: parseInt(restockFormData.quantity),
              notes: restockFormData.notes
            });
          } catch (syncError) {
            console.warn('⚠️ Could not sync restock with backend:', syncError.message);
            // Continue with local update
          }
        }

        setShowRestockForm(false);
        setRestockingProduct(null);
        setRestockFormData({ quantity: '', purchasePrice: '', sellingPrice: '', notes: '' });
        
        // Refresh products
        if (onProductsUpdate) {
          await onProductsUpdate();
        } else {
          await fetchProducts();
        }
        
        alert('Product restocked successfully!');
      }
      
    } catch (error) {
      console.error('Restock error:', error);
      setError(error.message);
    } finally {
      setSubmitting(false);
    }
  };

  // View stock history
  const handleViewStockHistory = async (product) => {
    try {
      if (isOnline && !product.isLocal) {
        const response = await productsAPI.getStockHistory(product._id);
        setSelectedProductHistory({
          product: product,
          history: response.data.history || []
        });
      } else {
        // Get history from local storage
        const localProducts = LocalStorageService.getProducts();
        const localProduct = localProducts.find(p => p._id === product._id);
        setSelectedProductHistory({
          product: product,
          history: localProduct?.stockHistory || []
        });
      }
      setShowStockHistory(true);
    } catch (error) {
      // Fallback to local history
      const localProducts = LocalStorageService.getProducts();
      const localProduct = localProducts.find(p => p._id === product._id);
      setSelectedProductHistory({
        product: product,
        history: localProduct?.stockHistory || []
      });
      setShowStockHistory(true);
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

  const createProductOnline = async (productData) => {
    const response = await productsAPI.createProduct(productData);
    return response.data;
  };

  const createProductOffline = async (productData) => {
    const localProduct = LocalStorageService.addProduct(productData);
    return {
      success: true,
      message: 'Product saved locally. Will sync when back online.',
      product: localProduct
    };
  };

  const updateProductOnline = async (productId, updates) => {
    const response = await productsAPI.updateProduct(productId, updates);
    return response.data;
  };

  const deleteProductOnline = async (productId) => {
    const response = await productsAPI.deleteProduct(productId);
    return response.data;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setError('');

    try {
      // Validation
      if (!formData.name.trim()) throw new Error('Product name is required');
      if (!formData.brand.trim()) throw new Error('Brand is required');
      
      if (!editingProduct) {
        if (!formData.purchasePrice || parseFloat(formData.purchasePrice) < 0) throw new Error('Valid purchase price is required');
        if (!formData.sellingPrice || parseFloat(formData.sellingPrice) < 0) throw new Error('Valid selling price is required');
        if (parseFloat(formData.sellingPrice) <= parseFloat(formData.purchasePrice)) throw new Error('Selling price must be greater than purchase price');
        if (!formData.stock || parseInt(formData.stock) < 0) throw new Error('Valid stock quantity is required');
      }
      
      if (!formData.category.trim()) throw new Error('Category is required');
      if (!formData.description.trim()) throw new Error('Description is required');
      if (!formData.lowStockAlert || parseInt(formData.lowStockAlert) < 0) throw new Error('Valid low stock alert level is required');
      if (imageFiles.length === 0 && (!editingProduct || !editingProduct.images || editingProduct.images.length === 0)) throw new Error('At least one image is required');

      // Prepare image data
      let imageUrls = [];
      if (imageFiles.length > 0) {
        imageUrls = await convertImagesToBase64(imageFiles);
      } else if (editingProduct && editingProduct.images) {
        imageUrls = editingProduct.images;
      }

      // Prepare product data
      const productData = {
        name: formData.name.trim(),
        brand: formData.brand.trim(),
        category: formData.category.trim(),
        description: formData.description.trim(),
        lowStockAlert: parseInt(formData.lowStockAlert),
        images: imageUrls
      };
      
      if (!editingProduct) {
        productData.purchasePrice = parseFloat(formData.purchasePrice);
        productData.sellingPrice = parseFloat(formData.sellingPrice);
        productData.stock = parseInt(formData.stock);
      }
      
      let result;
      
      if (editingProduct) {
        // Update product
        if (isOnline && !editingProduct.isLocal) {
          result = await updateProductOnline(editingProduct._id, productData);
        } else {
          // Update locally
          const updated = LocalStorageService.updateProduct(editingProduct._id, productData);
          result = {
            success: !!updated,
            message: 'Product updated locally.',
            product: updated
          };
        }
      } else {
        // Create new product
        if (isOnline) {
          result = await createProductOnline(productData);
        } else {
          result = await createProductOffline(productData);
        }
      }

      if (result.success) {
        setShowProductForm(false);
        setEditingProduct(null);
        resetForm();
        
        if (onProductsUpdate) {
          await onProductsUpdate();
        } else {
          await fetchProducts();
        }
        
        alert(editingProduct ? 'Product updated successfully!' : 'Product created successfully!');
      } else {
        setError(result.message);
      }
      
    } catch (error) {
      console.error('Product form error:', error);
      setError(error.message);
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
      purchasePrice: product.purchasePrice?.toString() || '',
      sellingPrice: product.sellingPrice?.toString() || '',
      category: product.category || '',
      description: product.description || '',
      stock: product.stock?.toString() || '',
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
  };

  // Delete product
  const handleDelete = async (productId) => {
    if (window.confirm('Are you sure you want to delete this product? This action cannot be undone.')) {
      try {
        const product = products.find(p => p._id === productId);
        
        if (isOnline && product && !product.isLocal) {
          await deleteProductOnline(productId);
        }
        
        // Always delete locally
        LocalStorageService.deleteProduct(productId);
        
        if (onProductsUpdate) {
          await onProductsUpdate();
        } else {
          await fetchProducts();
        }
        
        alert('Product deleted successfully!');
      } catch (error) {
        // Delete locally even if online delete fails
        LocalStorageService.deleteProduct(productId);
        
        if (onProductsUpdate) {
          await onProductsUpdate();
        }
        
        alert('Product deleted locally. Could not delete from server.');
      }
    }
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

  // Retry function
  const handleRetry = () => {
    setError('');
    if (onProductsUpdate) {
      onProductsUpdate();
    } else {
      fetchProducts();
    }
  };

  // Statistics
  const uniqueCategories = ['all', ...new Set(products.map(product => product.category).filter(Boolean))];
  const lowStockProductsCount = products.filter(product => isLowStock(product) && !isOutOfStock(product)).length;
  const outOfStockProductsCount = products.filter(product => isOutOfStock(product)).length;

  return (
    <div className="space-y-4">
      {/* Network Status */}
      {!isOnline && (
        <div className="p-2 bg-yellow-50 border border-yellow-200 rounded flex items-center justify-between text-xs">
          <div className="flex items-center gap-1">
            <CloudOff className="h-3 w-3 text-yellow-600" />
            <p className="text-yellow-700">You are offline. Changes will be saved locally.</p>
          </div>
          {onSync && (
            <button
              onClick={onSync}
              className="ml-2 bg-yellow-600 hover:bg-yellow-700 text-white px-2 py-1 rounded flex items-center gap-1 text-xs"
            >
              <Cloud className="h-3 w-3" />
              Sync when Online
            </button>
          )}
        </div>
      )}

      {/* Error Display */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded p-3 text-xs">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <div className="flex items-center gap-1 mb-1">
                <AlertCircle className="h-4 w-4 text-red-600" />
                <h3 className="text-red-800 font-semibold text-xs">Error</h3>
              </div>
              <p className="text-red-700 text-xs">{error}</p>
            </div>
            <button
              onClick={handleRetry}
              className="ml-3 bg-red-600 hover:bg-red-700 text-white px-3 py-1.5 rounded text-xs transition-colors flex items-center gap-1"
            >
              <RefreshCw className="h-3 w-3" />
              Retry
            </button>
          </div>
        </div>
      )}

      {/* Stock Alerts */}
      {(lowStockProductsCount > 0 || outOfStockProductsCount > 0) && (
        <div className="bg-yellow-50 border border-yellow-200 rounded p-2 text-xs">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-3 w-3 text-yellow-600" />
              <span className="text-yellow-800 font-medium">
                {lowStockProductsCount > 0 && `${lowStockProductsCount} low stock`}
                {lowStockProductsCount > 0 && outOfStockProductsCount > 0 && ', '}
                {outOfStockProductsCount > 0 && `${outOfStockProductsCount} out of stock`}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Header Section */}
      <div className="theme-surface rounded theme-border border p-3">
        <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
          <div className="flex-1 w-full">
            <h2 className="text-sm font-semibold theme-text">Products Management</h2>
            <p className="text-xs theme-text-muted">
              {loading ? 'Loading...' : `${filteredProducts.length} of ${products.length} product${products.length !== 1 ? 's' : ''}`}
              {!isOnline && ' (Offline Mode)'}
            </p>
          </div>
          
          <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
            {/* Search */}
            <div className="relative flex-1 sm:w-48">
              <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 h-3 w-3 theme-text-muted" />
              <input
                type="text"
                placeholder="Search products..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-7 pr-3 py-1.5 theme-border border rounded focus:outline-none focus:ring-1 focus:ring-blue-500 theme-surface theme-text text-xs"
              />
            </div>

            {/* Category Filter */}
            <div className="relative flex-1 sm:w-40">
              <Filter className="absolute left-2 top-1/2 transform -translate-y-1/2 h-3 w-3 theme-text-muted" />
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="w-full pl-7 pr-3 py-1.5 theme-border border rounded focus:outline-none focus:ring-1 focus:ring-blue-500 theme-surface theme-text text-xs appearance-none"
              >
                <option value="all">All Categories</option>
                {uniqueCategories.filter(cat => cat !== 'all').map(category => (
                  <option key={category} value={category}>
                    {category.charAt(0).toUpperCase() + category.slice(1)}
                  </option>
                ))}
              </select>
            </div>

            {/* Low Stock Filter */}
            <div className="flex items-center">
              <label className="flex items-center gap-1 cursor-pointer">
                <input
                  type="checkbox"
                  checked={lowStockFilter}
                  onChange={(e) => setLowStockFilter(e.target.checked)}
                  className="rounded theme-border border-gray-300 text-blue-600 focus:ring-blue-500 scale-90"
                />
                <span className="text-xs theme-text">Low Stock</span>
              </label>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-1">
              <button
                onClick={handleRetry}
                disabled={loading}
                className="flex items-center gap-1 theme-border border theme-text-muted hover:theme-secondary px-2 py-1.5 rounded text-xs transition-colors disabled:opacity-50"
              >
                <RefreshCw className={`h-3 w-3 ${loading ? 'animate-spin' : ''}`} />
                Refresh
              </button>
              <button
                onClick={() => {
                  setShowProductForm(true);
                  setEditingProduct(null);
                  resetForm();
                }}
                className="flex items-center gap-1 bg-green-600 hover:bg-green-700 text-white px-2 py-1.5 rounded text-xs transition-colors"
              >
                <Plus className="h-3 w-3" />
                Add Product
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Products Grid */}
      <div className="theme-surface rounded theme-border border">
        <div className="p-3 border-b theme-border">
          <h3 className="text-xs font-semibold theme-text">Product Inventory</h3>
        </div>

        <div className="p-3">
          {loading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {[...Array(6)].map((_, i) => (
                <div key={i} className="theme-surface rounded theme-border border p-2 animate-pulse">
                  <div className="bg-gray-300 dark:bg-gray-600 h-32 rounded mb-2"></div>
                  <div className="bg-gray-300 dark:bg-gray-600 h-2 rounded mb-1"></div>
                  <div className="bg-gray-300 dark:bg-gray-600 h-2 rounded w-2/3"></div>
                </div>
              ))}
            </div>
          ) : filteredProducts.length === 0 ? (
            <div className="text-center py-6">
              <Package className="h-8 w-8 mx-auto mb-2 theme-text-muted opacity-50" />
              <h3 className="text-sm font-semibold theme-text mb-1">
                {products.length === 0 ? 'No Products Found' : 'No Products Match Your Search'}
              </h3>
              <p className="theme-text-muted text-xs mb-2">
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
                  className="bg-green-600 hover:bg-green-700 text-white px-3 py-1.5 rounded text-xs transition-colors"
                >
                  Add First Product
                </button>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredProducts.map((product) => {
                const profitMargin = calculateProfitMargin(product.purchasePrice, product.sellingPrice);
                const profitAmount = calculateProfitAmount(product.purchasePrice, product.sellingPrice);
                const currentImageIndex = activeImageIndexes[product._id] || 0;
                const lowStock = isLowStock(product);
                const outOfStock = isOutOfStock(product);
                
                return (
                  <div key={product._id} className="theme-surface rounded-lg theme-border border overflow-hidden hover:shadow-lg transition-all duration-200 text-xs flex flex-col h-full">
                    {/* Stock Status Badges */}
                    {lowStock && !outOfStock && (
                      <div className="absolute top-2 left-2 z-10">
                        <span className="bg-yellow-500 text-white text-xs px-2 py-1 rounded-full font-medium flex items-center gap-1 shadow-sm">
                          <AlertTriangle className="h-3 w-3" />
                          Low Stock
                        </span>
                      </div>
                    )}
                    
                    {outOfStock && (
                      <div className="absolute top-2 left-2 z-10">
                        <span className="bg-red-500 text-white text-xs px-2 py-1 rounded-full font-medium flex items-center gap-1 shadow-sm">
                          <X className="h-3 w-3" />
                          Out of Stock
                        </span>
                      </div>
                    )}
                    
                    {product.isLocal && (
                      <div className="absolute top-2 right-2 z-10">
                        <span className="bg-blue-500 text-white text-xs px-2 py-1 rounded-full font-medium flex items-center gap-1 shadow-sm">
                          <CloudOff className="h-3 w-3" />
                          Local
                        </span>
                      </div>
                    )}

                    {/* Image Section */}
                    <div className="relative h-48 bg-gray-100 dark:bg-gray-800 flex-shrink-0">
                      {product.images && product.images.length > 0 ? (
                        <>
                          <img
                            src={product.images[currentImageIndex]}
                            alt={product.name}
                            className="w-full h-full object-contain p-2"
                            onError={(e) => {
                              e.target.src = 'https://via.placeholder.com/300x200?text=Image+Error';
                            }}
                          />
                          
                          {product.images.length > 1 && (
                            <>
                              <button
                                onClick={() => prevImage(product._id)}
                                className="absolute left-2 top-1/2 transform -translate-y-1/2 bg-black bg-opacity-60 text-white p-1 rounded-full hover:bg-opacity-80 transition-all shadow-lg"
                              >
                                <ChevronLeft className="h-4 w-4" />
                              </button>
                              <button
                                onClick={() => nextImage(product._id)}
                                className="absolute right-2 top-1/2 transform -translate-y-1/2 bg-black bg-opacity-60 text-white p-1 rounded-full hover:bg-opacity-80 transition-all shadow-lg"
                              >
                                <ChevronRight className="h-4 w-4" />
                              </button>
                            </>
                          )}
                          
                          {product.images.length > 1 && (
                            <div className="absolute bottom-2 left-1/2 transform -translate-x-1/2 flex gap-1">
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
                          
                          <div className="absolute top-2 right-2 bg-black bg-opacity-60 text-white text-xs px-2 py-1 rounded-full shadow-sm">
                            {currentImageIndex + 1}/{product.images.length}
                          </div>
                        </>
                      ) : (
                        <div className="w-full h-full flex flex-col items-center justify-center theme-text-muted bg-gray-200 dark:bg-gray-700">
                          <Package className="h-8 w-8 opacity-50 mb-1" />
                          <span className="text-xs">No Image</span>
                        </div>
                      )}
                    </div>

                    {/* Product Info */}
                    <div className="p-3 flex-1 flex flex-col">
                      <div className="flex justify-between items-start mb-2">
                        <h3 className="font-semibold theme-text line-clamp-1 flex-1 mr-2 text-sm">{product.name}</h3>
                        <span className="font-bold theme-primary-text whitespace-nowrap text-sm">
                          UGX {product.sellingPrice?.toLocaleString()}
                        </span>
                      </div>
                      
                      <p className="theme-text-muted mb-2 text-xs">{product.brand}</p>
                      
                      <div className="flex items-center justify-between mb-2">
                        <span className="inline-block px-2 py-1 bg-blue-100 text-blue-800 rounded-full capitalize text-xs font-medium">
                          {product.category}
                        </span>
                        <span className={`inline-flex items-center px-2 py-1 rounded-full font-medium text-xs ${
                          outOfStock ? 'bg-red-100 text-red-800' :
                          lowStock ? 'bg-yellow-100 text-yellow-800' : 
                          'bg-green-100 text-green-800'
                        }`}>
                          {product.stock} in stock
                          {lowStock && !outOfStock && (
                            <AlertTriangle className="h-3 w-3 ml-1" />
                          )}
                        </span>
                      </div>

                      {/* Profit Information */}
                      <div className="grid grid-cols-2 gap-2 mb-3">
                        <div className="text-center p-2 bg-gray-50 dark:bg-gray-800 rounded">
                          <p className="theme-text-muted text-xs">Cost</p>
                          <p className="font-semibold text-sm">UGX {product.purchasePrice?.toLocaleString()}</p>
                        </div>
                        <div className="text-center p-2 bg-green-50 dark:bg-green-900/20 rounded">
                          <p className="theme-text-muted text-xs">Profit</p>
                          <p className="font-semibold text-green-600 text-sm">
                            UGX {profitAmount.toLocaleString()}
                          </p>
                          <p className="text-green-600 text-xs">({profitMargin}%)</p>
                        </div>
                      </div>

                      <p className="theme-text line-clamp-2 mb-3 text-xs leading-relaxed flex-1">
                        {product.description}
                      </p>

                      {/* Action Buttons */}
                      <div className="grid grid-cols-2 gap-2 mt-auto">
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

      {/* Restock Form Modal */}
      {showRestockForm && restockingProduct && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-3 z-50">
          <div className="theme-surface rounded shadow-xl max-w-md w-full max-h-[95vh] overflow-y-auto text-xs">
            <div className="p-3 border-b theme-border flex justify-between items-center">
              <h2 className="text-sm font-semibold theme-text">
                Restock & Update Prices
              </h2>
              <button
                onClick={() => {
                  setShowRestockForm(false);
                  setRestockingProduct(null);
                  setRestockFormData({ quantity: '', purchasePrice: '', sellingPrice: '', notes: '' });
                }}
                className="theme-text-muted hover:theme-text transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleRestockSubmit} className="p-3 space-y-3">
              <div className="bg-blue-50 dark:bg-blue-900/20 p-2 rounded">
                <p className="font-semibold theme-text">{restockingProduct.name}</p>
                <p className="theme-text-muted text-xs">Current Stock: {restockingProduct.stock}</p>
                {restockingProduct.isLocal && (
                  <p className="text-xs text-blue-600">⚠️ Local product - will sync when online</p>
                )}
              </div>

              <div>
                <label className="block font-medium theme-text mb-1">Quantity to Add *</label>
                <input
                  type="number"
                  required
                  min="1"
                  value={restockFormData.quantity}
                  onChange={(e) => setRestockFormData(prev => ({ ...prev, quantity: e.target.value }))}
                  className="w-full px-3 py-2 theme-border border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 theme-surface theme-text"
                  placeholder="Enter quantity"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-medium theme-text mb-1">Purchase Price *</label>
                  <div className="relative">
                    <DollarSign className="absolute left-2 top-1/2 transform -translate-y-1/2 h-3 w-3 theme-text-muted" />
                    <input
                      type="number"
                      required
                      step="0.01"
                      min="0"
                      value={restockFormData.purchasePrice}
                      onChange={(e) => setRestockFormData(prev => ({ ...prev, purchasePrice: e.target.value }))}
                      className="w-full pl-7 pr-3 py-2 theme-border border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 theme-surface theme-text"
                      placeholder="Cost price"
                    />
                  </div>
                  <p className="text-xs theme-text-muted mt-1">
                    Current: UGX {restockingProduct.purchasePrice?.toLocaleString()}
                  </p>
                </div>

                <div>
                  <label className="block font-medium theme-text mb-1">Selling Price *</label>
                  <div className="relative">
                    <Tag className="absolute left-2 top-1/2 transform -translate-y-1/2 h-3 w-3 theme-text-muted" />
                    <input
                      type="number"
                      required
                      step="0.01"
                      min="0"
                      value={restockFormData.sellingPrice}
                      onChange={(e) => setRestockFormData(prev => ({ ...prev, sellingPrice: e.target.value }))}
                      className="w-full pl-7 pr-3 py-2 theme-border border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 theme-surface theme-text"
                      placeholder="Selling price"
                    />
                  </div>
                  <p className="text-xs theme-text-muted mt-1">
                    Current: UGX {restockingProduct.sellingPrice?.toLocaleString()}
                  </p>
                </div>
              </div>

              {restockFormData.purchasePrice && restockFormData.sellingPrice && (
                <div className="bg-green-50 dark:bg-green-900/20 p-2 rounded">
                  <div className="flex justify-between text-xs">
                    <span>Profit Margin:</span>
                    <span className="font-semibold text-green-600">
                      {calculateProfitMargin(parseFloat(restockFormData.purchasePrice), parseFloat(restockFormData.sellingPrice))}%
                    </span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span>Profit per Unit:</span>
                    <span className="font-semibold text-green-600">
                      UGX {calculateProfitAmount(parseFloat(restockFormData.purchasePrice), parseFloat(restockFormData.sellingPrice)).toLocaleString()}
                    </span>
                  </div>
                </div>
              )}

              <div>
                <label className="block font-medium theme-text mb-1">Notes</label>
                <textarea
                  rows="3"
                  value={restockFormData.notes}
                  onChange={(e) => setRestockFormData(prev => ({ ...prev, notes: e.target.value }))}
                  className="w-full px-3 py-2 theme-border border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 theme-surface theme-text"
                  placeholder="Add any notes about this restock and price update..."
                />
              </div>

              <div className="flex gap-2 pt-3 border-t theme-border">
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-2 rounded-lg font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-sm hover:shadow-md"
                >
                  {submitting ? (
                    <div className="flex items-center justify-center gap-2">
                      <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-white"></div>
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
                  className="flex-1 theme-border border theme-text-muted hover:theme-secondary py-2 rounded-lg font-semibold transition-colors"
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
          <div className="theme-surface rounded shadow-xl max-w-2xl w-full max-h-[95vh] overflow-y-auto text-xs">
            <div className="p-3 border-b theme-border flex justify-between items-center">
              <h2 className="text-sm font-semibold theme-text">
                Stock History - {selectedProductHistory.product.name}
                {selectedProductHistory.product.isLocal && (
                  <span className="ml-2 text-xs text-blue-600">(Local Product)</span>
                )}
              </h2>
              <button
                onClick={() => {
                  setShowStockHistory(false);
                  setSelectedProductHistory(null);
                }}
                className="theme-text-muted hover:theme-text transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="p-3">
              <div className="mb-3 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div>
                    <span className="theme-text-muted">Current Stock:</span>
                    <p className="font-semibold text-lg">{selectedProductHistory.product.stock}</p>
                  </div>
                  <div>
                    <span className="theme-text-muted">Total Restocked:</span>
                    <p className="font-semibold text-lg">{selectedProductHistory.product.restockedQuantity || 0}</p>
                  </div>
                </div>
              </div>

              {selectedProductHistory.history.length === 0 ? (
                <div className="text-center py-6">
                  <Package className="h-8 w-8 mx-auto mb-2 theme-text-muted opacity-50" />
                  <p className="theme-text-muted">No stock history available</p>
                </div>
              ) : (
                <div className="space-y-2 max-h-96 overflow-y-auto">
                  {selectedProductHistory.history.map((record, index) => (
                    <div key={index} className="p-3 theme-border border rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
                      <div className="flex justify-between items-start mb-2">
                        <div>
                          <p className="font-semibold theme-text capitalize flex items-center gap-1">
                            {record.type === 'restock' ? '📦 Restock' : 
                             record.type === 'sale' ? '💰 Sale' : 
                             '📊 Adjustment'}
                          </p>
                          <p className="theme-text-muted text-xs">
                            {new Date(record.date || record.createdAt).toLocaleDateString()} at {new Date(record.date || record.createdAt).toLocaleTimeString()}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className={`font-semibold text-sm ${
                            record.unitsChanged > 0 ? 'text-green-600' : 'text-red-600'
                          }`}>
                            {record.unitsChanged > 0 ? '+' : ''}{record.unitsChanged} units
                          </p>
                          <p className="theme-text-muted text-xs">
                            {record.previousStock} → {record.newStock}
                          </p>
                        </div>
                      </div>
                      {record.notes && (
                        <p className="theme-text-muted text-xs mt-2 p-2 bg-gray-50 dark:bg-gray-800 rounded">{record.notes}</p>
                      )}
                      {record.user && (
                        <p className="theme-text-muted text-xs mt-1">
                          By: {record.user.name || 'System'}
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

      {/* Product Form Modal */}
      {showProductForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-3 z-50">
          <div className="theme-surface rounded shadow-xl max-w-2xl w-full max-h-[95vh] overflow-y-auto text-xs">
            <div className="p-3 border-b theme-border flex justify-between items-center">
              <h2 className="text-sm font-semibold theme-text">
                {editingProduct ? 'Edit Product' : 'Add New Product'}
                {!isOnline && editingProduct?.isLocal && (
                  <span className="ml-2 text-xs text-yellow-600">(Local - will sync when online)</span>
                )}
              </h2>
              <button
                onClick={() => {
                  setShowProductForm(false);
                  setEditingProduct(null);
                  resetForm();
                }}
                className="theme-text-muted hover:theme-text transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-3 space-y-3">
              {/* Form fields remain similar to your original */}
              {/* ... (keep your existing form fields) */}

              <div className="flex gap-2 pt-3 border-t theme-border">
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex-1 bg-green-600 hover:bg-green-700 text-white py-2 rounded-lg font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {submitting ? (
                    <div className="flex items-center justify-center gap-2">
                      <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-white"></div>
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
                  className="flex-1 theme-border border theme-text-muted hover:theme-secondary py-2 rounded-lg font-semibold transition-colors"
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