import React, { useState, useEffect, useCallback, useRef } from 'react';
import { 
  Plus, Edit, Trash2, Package, ChevronLeft, ChevronRight, Upload, X, RefreshCw, AlertCircle,
  Search, Filter, AlertTriangle, History, PackagePlus, DollarSign, Tag, Cloud, CloudOff,
  TrendingDown, Database, Eye, Save, Image as ImageIcon, Info, Star, TrendingUp,
  ArrowUpDown, BarChart3, Layers, Shield, CheckCircle, Clock
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
  const [productStockUpdates, setProductStockUpdates] = useState([]);
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [minPrice, setMinPrice] = useState('');
  const [maxPrice, setMaxPrice] = useState('');
  const [minStock, setMinStock] = useState('');
  const [sortBy, setSortBy] = useState('name');
  const [sortOrder, setSortOrder] = useState('asc');
  const [recentlyUpdated, setRecentlyUpdated] = useState(new Set());
  const [stats, setStats] = useState({
    totalProducts: 0,
    totalStock: 0,
    totalValue: 0,
    lowStockCount: 0,
    outOfStockCount: 0
  });

  const [formData, setFormData] = useState({
    name: '',
    brand: '',
    purchasePrice: '',
    sellingPrice: '',
    category: '',
    description: '',
    stock: '',
    lowStockAlert: '5',
    sku: '',
    weight: '',
    dimensions: ''
  });

  const [imageFiles, setImageFiles] = useState([]);
  const [imagePreviews, setImagePreviews] = useState([]);

  const categories = [
    'smartphones', 'laptops', 'tablets', 'cameras', 'audio', 
    'gaming', 'accessories', 'watches', 'headphones', 'speakers',
    'tvs', 'home_appliances', 'wearables', 'networking', 'storage'
  ];

  const hasInitializedRef = useRef(false);
  const statsRef = useRef({ lastUpdate: null });

  // Initialize products
  useEffect(() => {
    console.log('🔄 ProductManagementTab initializing with', initialProducts.length, 'products');
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
    
    // Calculate initial stats
    calculateStats(initialProducts);
  }, [initialProducts, productsLoading]);

  // Calculate statistics
  const calculateStats = useCallback((productList) => {
    const totalProducts = productList.length;
    const totalStock = productList.reduce((sum, product) => sum + (product.stock || 0), 0);
    const totalValue = productList.reduce((sum, product) => 
      sum + ((product.purchasePrice || 0) * (product.stock || 0)), 0);
    const lowStockCount = productList.filter(p => 
      (p.stock || 0) > 0 && (p.stock || 0) <= (p.lowStockAlert || 5)
    ).length;
    const outOfStockCount = productList.filter(p => (p.stock || 0) <= 0).length;
    
    setStats({
      totalProducts,
      totalStock,
      totalValue,
      lowStockCount,
      outOfStockCount
    });
  }, []);

  // Listen for product updates from CreateSaleTab and other components
  useEffect(() => {
    const handleSaleCompleted = (event) => {
      console.log('🎯 ProductManagementTab received saleCompleted event:', event.detail);
      
      if (event.detail && event.detail.stockUpdates) {
        // Immediately update local state
        setProducts(prevProducts => 
          prevProducts.map(product => {
            const update = event.detail.stockUpdates.find(u => u.productId === product._id);
            if (update) {
              const oldStock = product.stock;
              const newStock = Math.max(0, oldStock - update.quantity);
              
              console.log(`📊 Immediate stock update for ${product.name}: ${oldStock} → ${newStock}`);
              
              // Add to recently updated set
              setRecentlyUpdated(prev => new Set([...prev, product._id]));
              
              // Log the update
              setProductStockUpdates(prev => [...prev, {
                productId: product._id,
                productName: product.name,
                oldStock,
                newStock,
                quantitySold: update.quantity,
                timestamp: new Date().toLocaleTimeString(),
                saleNumber: event.detail.saleNumber
              }].slice(-10));
              
              return {
                ...product,
                stock: newStock
              };
            }
            return product;
          })
        );
        
        // Force refresh from parent after a short delay
        setTimeout(() => {
          if (onProductsUpdate) {
            console.log('🔄 Calling parent onProductsUpdate after sale...');
            onProductsUpdate();
          } else {
            console.log('🔄 Calling fetchProducts after sale...');
            fetchProducts(true);
          }
        }, 200);
      }
    };

    const handleProductsUpdated = () => {
      console.log('🔄 ProductManagementTab received productsUpdated event');
      if (onProductsUpdate) {
        onProductsUpdate();
      } else {
        fetchProducts();
      }
    };

    const handleStockUpdated = (event) => {
      console.log('📉 ProductManagementTab received stockUpdated event:', event.detail);
      if (event.detail && event.detail.updates) {
        const updatedIds = new Set();
        
        setProducts(prevProducts => 
          prevProducts.map(product => {
            const update = event.detail.updates.find(u => u.productId === product._id);
            if (update) {
              const newStock = Math.max(0, product.stock - update.quantity);
              updatedIds.add(product._id);
              
              return {
                ...product,
                stock: newStock
              };
            }
            return product;
          })
        );
        
        // Highlight recently updated products
        setRecentlyUpdated(updatedIds);
        setTimeout(() => {
          setRecentlyUpdated(prev => {
            const newSet = new Set(prev);
            updatedIds.forEach(id => newSet.delete(id));
            return newSet;
          });
        }, 3000);
      }
    };

    // Listen for clear cache events
    const handleClearCache = () => {
      console.log('🧹 Clearing product cache and forcing refresh...');
      setProducts([]);
      setFilteredProducts([]);
      hasInitializedRef.current = false;
      
      if (onProductsUpdate) {
        setTimeout(() => onProductsUpdate(), 100);
      }
    };

    window.addEventListener('saleCompleted', handleSaleCompleted);
    window.addEventListener('productsUpdated', handleProductsUpdated);
    window.addEventListener('stockUpdated', handleStockUpdated);
    window.addEventListener('clearProductCache', handleClearCache);
    
    return () => {
      window.removeEventListener('saleCompleted', handleSaleCompleted);
      window.removeEventListener('productsUpdated', handleProductsUpdated);
      window.removeEventListener('stockUpdated', handleStockUpdated);
      window.removeEventListener('clearProductCache', handleClearCache);
    };
  }, [onProductsUpdate]);

  // Optimized fetch function
  const fetchProducts = useCallback(async (force = false) => {
    if (!force && (initialProducts.length > 0 || loading)) return;

    console.log('🔄 ProductManagementTab fetching products...');
    setLoading(true);
    setError('');
    
    try {
      if (isOnline) {
        console.log('🌐 Fetching products from API...');
        const response = await productsAPI.getProducts({ page: 1, limit: 100 });
        
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
                stock: localProduct.stock || backendProduct.stock,
                totalSold: localProduct.totalSold || backendProduct.totalSold,
                lowStockAlert: localProduct.lowStockAlert || backendProduct.lowStockAlert,
                stockHistory: [
                  ...(backendProduct.stockHistory || []),
                  ...(localProduct.stockHistory || [])
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
          calculateStats(allProducts);
          
          const initialIndexes = {};
          allProducts.forEach(product => {
            initialIndexes[product._id] = 0;
          });
          setActiveImageIndexes(initialIndexes);
          
          // Trigger event for other components
          window.dispatchEvent(new CustomEvent('productsLoaded'));
        }
      } else {
        // Offline mode: load from local storage
        console.log('📱 Offline mode: loading products from local storage');
        const localProducts = LocalStorageService.getProducts();
        setProducts(localProducts);
        setFilteredProducts(localProducts);
        calculateStats(localProducts);
        
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
      calculateStats(localProducts);
      
      if (error.response?.status === 401) {
        setError('Your session has expired. Using local data.');
      }
    } finally {
      setLoading(false);
    }
  }, [initialProducts.length, loading, isOnline, calculateStats]);

  // Filter and sort products
  useEffect(() => {
    if (products.length === 0) return;
    
    let filtered = [...products];
    
    // Search filter
    if (searchTerm) {
      filtered = filtered.filter(product =>
        product.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        product.brand?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        product.category?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        product.sku?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        product.description?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }
    
    // Category filter
    if (selectedCategory !== 'all') {
      filtered = filtered.filter(product =>
        product.category?.toLowerCase() === selectedCategory.toLowerCase()
      );
    }
    
    // Low stock filter
    if (lowStockFilter) {
      filtered = filtered.filter(product => 
        product.stock <= (product.lowStockAlert || 5)
      );
    }
    
    // Price range filter
    if (minPrice) {
      filtered = filtered.filter(product => 
        product.sellingPrice >= parseFloat(minPrice)
      );
    }
    
    if (maxPrice) {
      filtered = filtered.filter(product => 
        product.sellingPrice <= parseFloat(maxPrice)
      );
    }
    
    // Stock range filter
    if (minStock) {
      filtered = filtered.filter(product => 
        product.stock >= parseInt(minStock)
      );
    }
    
    // Sorting
    filtered.sort((a, b) => {
      let aValue, bValue;
      
      switch (sortBy) {
        case 'name':
          aValue = a.name?.toLowerCase() || '';
          bValue = b.name?.toLowerCase() || '';
          break;
        case 'price':
          aValue = a.sellingPrice || 0;
          bValue = b.sellingPrice || 0;
          break;
        case 'stock':
          aValue = a.stock || 0;
          bValue = b.stock || 0;
          break;
        case 'profit':
          aValue = (a.sellingPrice || 0) - (a.purchasePrice || 0);
          bValue = (b.sellingPrice || 0) - (b.purchasePrice || 0);
          break;
        case 'date':
          aValue = new Date(a.createdAt || 0).getTime();
          bValue = new Date(b.createdAt || 0).getTime();
          break;
        default:
          aValue = a.name?.toLowerCase() || '';
          bValue = b.name?.toLowerCase() || '';
      }
      
      if (sortOrder === 'asc') {
        return aValue > bValue ? 1 : -1;
      } else {
        return aValue < bValue ? 1 : -1;
      }
    });
    
    setFilteredProducts(filtered);
    calculateStats(filtered);
  }, [products, searchTerm, selectedCategory, lowStockFilter, minPrice, maxPrice, minStock, sortBy, sortOrder, calculateStats]);

  // Initialize component
  useEffect(() => {
    if (hasInitializedRef.current) return;
    
    if (initialProducts.length === 0 && !productsLoading) {
      fetchProducts();
    } else if (initialProducts.length > 0) {
      setLoading(false);
    } else if (productsLoading) {
      setLoading(true);
    } else {
      setLoading(false);
    }
    
    hasInitializedRef.current = true;
    setHasInitialized(true);
  }, [initialProducts.length, productsLoading, fetchProducts]);

  // Enhanced refresh function that forces update
  const handleRefreshProducts = useCallback(async () => {
    console.log('🔄 Manually refreshing products...');
    setLoading(true);
    setError('');
    
    try {
      // Clear the products first to force re-fetch
      setProducts([]);
      setFilteredProducts([]);
      
      if (onProductsUpdate) {
        // Use parent's update function
        await onProductsUpdate();
      } else {
        // Fetch fresh data
        await fetchProducts(true);
      }
      
      // Also trigger an event for other components
      window.dispatchEvent(new CustomEvent('productsRefreshed'));
      
      console.log('✅ Products refreshed manually');
    } catch (error) {
      console.error('❌ Error refreshing products:', error);
      setError('Failed to refresh products');
    } finally {
      setLoading(false);
    }
  }, [onProductsUpdate, fetchProducts]);

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

        // Update local state immediately
        setProducts(prevProducts => 
          prevProducts.map(p => 
            p._id === restockingProduct._id 
              ? { 
                  ...p, 
                  stock: updatedProduct.stock,
                  purchasePrice: parseFloat(restockFormData.purchasePrice),
                  sellingPrice: parseFloat(restockFormData.sellingPrice),
                  restockedQuantity: (p.restockedQuantity || 0) + parseInt(restockFormData.quantity)
                }
              : p
          )
        );

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
        
        // Highlight recently updated product
        setRecentlyUpdated(new Set([restockingProduct._id]));
        setTimeout(() => {
          setRecentlyUpdated(prev => {
            const newSet = new Set(prev);
            newSet.delete(restockingProduct._id);
            return newSet;
          });
        }, 3000);
        
        // Refresh products
        if (onProductsUpdate) {
          await onProductsUpdate();
        }
        
        // Trigger event for other components
        window.dispatchEvent(new CustomEvent('productsRefreshed'));
        
        setError('');
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
      setError(`Maximum 5 images allowed. You currently have ${imageFiles.length} images selected.`);
      return;
    }

    const validFiles = files.filter(file => file.type.startsWith('image/'));
    const newPreviews = validFiles.map(file => URL.createObjectURL(file));
    
    setImageFiles(prev => [...prev, ...validFiles]);
    setImagePreviews(prev => [...prev, ...newPreviews]);
    
    e.target.value = '';
    setError('');
  };

  const removeImage = (index) => {
    setImageFiles(prev => prev.filter((_, i) => i !== index));
    setImagePreviews(prev => {
      URL.revokeObjectURL(prev[index]);
      return prev.filter((_, i) => i !== index);
    });
    setError('');
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
        images: imageUrls,
        sku: formData.sku.trim() || `SKU-${Date.now()}`,
        weight: formData.weight.trim() || '',
        dimensions: formData.dimensions.trim() || ''
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
        
        // Highlight recently updated/created product
        if (result.product?._id) {
          setRecentlyUpdated(new Set([result.product._id]));
          setTimeout(() => {
            setRecentlyUpdated(prev => {
              const newSet = new Set(prev);
              newSet.delete(result.product._id);
              return newSet;
            });
          }, 3000);
        }
        
        if (onProductsUpdate) {
          await onProductsUpdate();
        } else {
          await fetchProducts(true);
        }
        
        // Trigger event for other components
        window.dispatchEvent(new CustomEvent('productsRefreshed'));
        
        setError('');
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
      lowStockAlert: product.lowStockAlert?.toString() || '5',
      sku: product.sku || '',
      weight: product.weight || '',
      dimensions: product.dimensions || ''
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

  // Quick view product
  const handleQuickView = (product) => {
    const profitMargin = calculateProfitMargin(product.purchasePrice, product.sellingPrice);
    const profitAmount = calculateProfitAmount(product.purchasePrice, product.sellingPrice);
    
    const productInfo = `
Product: ${product.name}
Brand: ${product.brand}
Category: ${product.category}
Stock: ${product.stock} units
Price: UGX ${product.sellingPrice?.toLocaleString()}
Cost: UGX ${product.purchasePrice?.toLocaleString()}
Profit: UGX ${profitAmount.toLocaleString()} (${profitMargin}%)
Status: ${isOutOfStock(product) ? 'Out of Stock' : isLowStock(product) ? 'Low Stock' : 'In Stock'}
${product.sku ? `SKU: ${product.sku}` : ''}
${product.description ? `Description: ${product.description.substring(0, 100)}...` : ''}
    `;
    
    alert(productInfo);
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
        
        // Update local state immediately
        setProducts(prev => prev.filter(p => p._id !== productId));
        setFilteredProducts(prev => prev.filter(p => p._id !== productId));
        
        if (onProductsUpdate) {
          await onProductsUpdate();
        }
        
        // Trigger event for other components
        window.dispatchEvent(new CustomEvent('productsRefreshed'));
        
        setError('');
      } catch (error) {
        // Delete locally even if online delete fails
        LocalStorageService.deleteProduct(productId);
        
        // Update local state
        setProducts(prev => prev.filter(p => p._id !== productId));
        setFilteredProducts(prev => prev.filter(p => p._id !== productId));
        
        setError('Product deleted locally. Could not delete from server.');
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
      lowStockAlert: '5',
      sku: '',
      weight: '',
      dimensions: ''
    });
    setImageFiles([]);
    imagePreviews.forEach(preview => URL.revokeObjectURL(preview));
    setImagePreviews([]);
    setError('');
  };

  // Retry function
  const handleRetry = () => {
    setError('');
    handleRefreshProducts();
  };

  // Clear filters
  const clearFilters = () => {
    setSearchTerm('');
    setSelectedCategory('all');
    setLowStockFilter(false);
    setMinPrice('');
    setMaxPrice('');
    setMinStock('');
    setSortBy('name');
    setSortOrder('asc');
    setShowAdvancedFilters(false);
  };

  // Toggle sort order
  const toggleSortOrder = () => {
    setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc');
  };

  // Statistics
  const uniqueCategories = ['all', ...new Set(products.map(product => product.category).filter(Boolean))];
  const lowStockProductsCount = products.filter(product => isLowStock(product) && !isOutOfStock(product)).length;
  const outOfStockProductsCount = products.filter(product => isOutOfStock(product)).length;

  return (
    <div className="space-y-4">
      {/* Network Status */}
      {!isOnline && (
        <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CloudOff className="h-4 w-4 text-yellow-600" />
              <div>
                <p className="text-sm font-semibold text-yellow-800">Offline Mode</p>
                <p className="text-xs text-yellow-700">
                  Changes will be saved locally and synced when internet returns
                </p>
              </div>
            </div>
            {onSync && (
              <button
                onClick={onSync}
                className="flex items-center gap-2 bg-yellow-600 hover:bg-yellow-700 text-white px-3 py-1.5 rounded text-sm transition-colors"
              >
                <Cloud className="h-3 w-3" />
                Sync when Online
              </button>
            )}
          </div>
        </div>
      )}

      {/* Error Display */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3">
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
              className="ml-3 bg-red-600 hover:bg-red-700 text-white px-3 py-1.5 rounded text-sm transition-colors flex items-center gap-2"
            >
              <RefreshCw className="h-3 w-3" />
              Retry
            </button>
          </div>
        </div>
      )}

      {/* Stock Update Debug Panel */}
      {process.env.NODE_ENV === 'development' && productStockUpdates.length > 0 && (
        <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
          <div className="flex items-center gap-2 mb-2">
            <Database className="h-4 w-4 text-blue-600" />
            <span className="font-medium text-blue-800 text-sm">Recent Stock Updates:</span>
            <button 
              onClick={() => setProductStockUpdates([])}
              className="ml-auto text-sm text-blue-600 hover:text-blue-800"
            >
              Clear
            </button>
          </div>
          <div className="space-y-1 max-h-24 overflow-y-auto">
            {productStockUpdates.map((update, index) => (
              <div key={index} className="flex items-center gap-3 text-blue-700 p-1.5 hover:bg-blue-100 rounded">
                <span className="text-xs font-mono theme-text-muted">{update.timestamp}</span>
                <span className="font-medium">{update.productName}:</span>
                <span className="font-mono">
                  {update.oldStock} → <span className="text-red-600">{update.newStock}</span>
                </span>
                <span className="text-red-600 text-sm font-medium">
                  (-{update.quantitySold})
                </span>
                {update.saleNumber && (
                  <span className="text-xs theme-text-muted ml-auto">
                    Sale: {update.saleNumber}
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Statistics Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <div className="theme-surface rounded-lg shadow-sm border theme-border p-3">
          <div className="flex items-center gap-2">
            <Package className="h-4 w-4 text-blue-600" />
            <div>
              <p className="text-xs theme-text-muted">Total Products</p>
              <p className="text-lg font-bold theme-text">{stats.totalProducts}</p>
            </div>
          </div>
        </div>
        
        <div className="theme-surface rounded-lg shadow-sm border theme-border p-3">
          <div className="flex items-center gap-2">
            <Layers className="h-4 w-4 text-green-600" />
            <div>
              <p className="text-xs theme-text-muted">Total Stock</p>
              <p className="text-lg font-bold theme-text">{stats.totalStock.toLocaleString()}</p>
            </div>
          </div>
        </div>
        
        <div className="theme-surface rounded-lg shadow-sm border theme-border p-3">
          <div className="flex items-center gap-2">
            <DollarSign className="h-4 w-4 text-purple-600" />
            <div>
              <p className="text-xs theme-text-muted">Total Value</p>
              <p className="text-lg font-bold theme-text">UGX {stats.totalValue.toLocaleString()}</p>
            </div>
          </div>
        </div>
        
        <div className="theme-surface rounded-lg shadow-sm border theme-border p-3">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-yellow-600" />
            <div>
              <p className="text-xs theme-text-muted">Low Stock</p>
              <p className="text-lg font-bold theme-text">{stats.lowStockCount}</p>
            </div>
          </div>
        </div>
        
        <div className="theme-surface rounded-lg shadow-sm border theme-border p-3">
          <div className="flex items-center gap-2">
            <X className="h-4 w-4 text-red-600" />
            <div>
              <p className="text-xs theme-text-muted">Out of Stock</p>
              <p className="text-lg font-bold theme-text">{stats.outOfStockCount}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Header Section */}
      <div className="theme-surface rounded-lg shadow-sm border theme-border p-4">
        <div className="flex flex-col lg:flex-row gap-4 items-start lg:items-center justify-between">
          <div className="flex-1">
            <h2 className="text-lg font-semibold theme-text flex items-center gap-2">
              <Package className="h-5 w-5" />
              Products Management
            </h2>
            <p className="text-sm theme-text-muted mt-1">
              {loading ? 'Loading products...' : `Showing ${filteredProducts.length} of ${products.length} product${products.length !== 1 ? 's' : ''}`}
              {!isOnline && ' (Offline Mode)'}
            </p>
          </div>
          
          <div className="flex flex-col sm:flex-row gap-3 w-full lg:w-auto">
            {/* Search */}
            <div className="relative flex-1 lg:w-64">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 theme-text-muted" />
              <input
                type="text"
                placeholder="Search products..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-3 py-2.5 theme-border border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 theme-surface theme-text text-sm placeholder-theme-text-muted"
              />
            </div>

            {/* Category Filter */}
            <div className="relative flex-1 lg:w-48">
              <Filter className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 theme-text-muted" />
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="w-full pl-10 pr-3 py-2.5 theme-border border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 theme-surface theme-text text-sm appearance-none"
              >
                <option value="all">All Categories</option>
                {uniqueCategories.filter(cat => cat !== 'all').map(category => (
                  <option key={category} value={category}>
                    {category.charAt(0).toUpperCase() + category.slice(1)}
                  </option>
                ))}
              </select>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-2">
              <button
                onClick={handleRefreshProducts}
                disabled={loading}
                className="flex items-center gap-2 theme-border border theme-text-muted hover:theme-secondary px-3 py-2.5 rounded-lg text-sm transition-colors disabled:opacity-50"
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
                className="flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white px-3 py-2.5 rounded-lg text-sm transition-colors shadow-sm hover:shadow"
              >
                <Plus className="h-4 w-4" />
                Add Product
              </button>
            </div>
          </div>
        </div>

        {/* Advanced Filters */}
        <div className="mt-4 pt-4 border-t theme-border">
          <div className="flex items-center justify-between mb-3">
            <button
              onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
              className="flex items-center gap-2 text-sm theme-text-muted hover:theme-text"
            >
              <Filter className="h-4 w-4" />
              {showAdvancedFilters ? 'Hide Filters' : 'Show Filters'}
              <span className="text-xs theme-text-muted">({lowStockProductsCount} low stock, {outOfStockProductsCount} out of stock)</span>
            </button>
            
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2">
                <label className="flex items-center gap-2 cursor-pointer text-sm theme-text-muted">
                  <input
                    type="checkbox"
                    checked={lowStockFilter}
                    onChange={(e) => setLowStockFilter(e.target.checked)}
                    className="rounded theme-border text-blue-600 focus:ring-blue-500 bg-gray-100"
                  />
                  Low Stock Only
                </label>
              </div>
              
              <button
                onClick={clearFilters}
                className="text-sm text-red-600 hover:text-red-800"
              >
                Clear Filters
              </button>
            </div>
          </div>
          
          {showAdvancedFilters && (
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 p-3 theme-secondary rounded-lg">
              <div>
                <label className="block text-xs font-medium theme-text mb-1">Min Price</label>
                <input
                  type="number"
                  value={minPrice}
                  onChange={(e) => setMinPrice(e.target.value)}
                  className="w-full px-3 py-2 theme-border border rounded text-sm theme-surface theme-text"
                  placeholder="UGX"
                />
              </div>
              
              <div>
                <label className="block text-xs font-medium theme-text mb-1">Max Price</label>
                <input
                  type="number"
                  value={maxPrice}
                  onChange={(e) => setMaxPrice(e.target.value)}
                  className="w-full px-3 py-2 theme-border border rounded text-sm theme-surface theme-text"
                  placeholder="UGX"
                />
              </div>
              
              <div>
                <label className="block text-xs font-medium theme-text mb-1">Min Stock</label>
                <input
                  type="number"
                  value={minStock}
                  onChange={(e) => setMinStock(e.target.value)}
                  className="w-full px-3 py-2 theme-border border rounded text-sm theme-surface theme-text"
                  placeholder="Units"
                />
              </div>
              
              <div>
                <label className="block text-xs font-medium theme-text mb-1">Sort By</label>
                <div className="flex gap-2">
                  <select
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value)}
                    className="flex-1 px-3 py-2 theme-border border rounded text-sm theme-surface theme-text"
                  >
                    <option value="name">Name</option>
                    <option value="price">Price</option>
                    <option value="stock">Stock</option>
                    <option value="profit">Profit</option>
                    <option value="date">Date Added</option>
                  </select>
                  <button
                    onClick={toggleSortOrder}
                    className="px-3 py-2 theme-border border rounded text-sm theme-surface theme-text-muted hover:theme-secondary"
                  >
                    <ArrowUpDown className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Products Grid */}
      <div className="theme-surface rounded-lg shadow-sm border theme-border">
        <div className="p-4 border-b theme-border">
          <h3 className="text-sm font-semibold theme-text flex items-center gap-2">
            <Package className="h-4 w-4" />
            Product Inventory
            {recentlyUpdated.size > 0 && (
              <span className="text-xs px-2 py-1 rounded-full bg-blue-100 text-blue-800 animate-pulse">
                {recentlyUpdated.size} updated
              </span>
            )}
          </h3>
        </div>

        <div className="p-4">
          {loading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {[...Array(6)].map((_, i) => (
                <div key={i} className="theme-surface rounded-lg border theme-border p-4 animate-pulse">
                  <div className="bg-gray-300 h-48 rounded-lg mb-3"></div>
                  <div className="space-y-2">
                    <div className="bg-gray-300 h-4 rounded"></div>
                    <div className="bg-gray-300 h-3 rounded w-3/4"></div>
                    <div className="bg-gray-300 h-3 rounded w-1/2"></div>
                  </div>
                </div>
              ))}
            </div>
          ) : filteredProducts.length === 0 ? (
            <div className="text-center py-8">
              <Package className="h-12 w-12 mx-auto mb-3 theme-text-muted opacity-60" />
              <h3 className="text-lg font-semibold theme-text mb-1">
                {products.length === 0 ? 'No Products Found' : 'No Products Match Your Search'}
              </h3>
              <p className="theme-text-muted text-sm mb-4">
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
                  className="bg-green-600 hover:bg-green-700 text-white px-4 py-2.5 rounded-lg text-sm transition-colors shadow-sm hover:shadow"
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
                const isRecentlyUpdated = recentlyUpdated.has(product._id);
                
                return (
                  <div 
                    key={product._id} 
                    className={`theme-surface rounded-lg border overflow-hidden hover:shadow-lg transition-all duration-200 flex flex-col h-full ${
                      isRecentlyUpdated 
                        ? 'border-blue-500 shadow-blue-100' 
                        : 'theme-border'
                    }`}
                  >
                    {/* Stock Status Badges */}
                    <div className="absolute top-3 left-3 z-10 flex flex-col gap-1">
                      {lowStock && !outOfStock && (
                        <span className="bg-yellow-500 text-white text-xs px-2 py-1 rounded-full font-medium flex items-center gap-1 shadow-sm">
                          <AlertTriangle className="h-3 w-3" />
                          Low Stock
                        </span>
                      )}
                      
                      {outOfStock && (
                        <span className="bg-red-500 text-white text-xs px-2 py-1 rounded-full font-medium flex items-center gap-1 shadow-sm">
                          <X className="h-3 w-3" />
                          Out of Stock
                        </span>
                      )}
                    </div>
                    
                    <div className="absolute top-3 right-3 z-10 flex flex-col gap-1">
                      {product.isLocal && (
                        <span className="bg-blue-500 text-white text-xs px-2 py-1 rounded-full font-medium flex items-center gap-1 shadow-sm">
                          <Shield className="h-3 w-3" />
                          Local
                        </span>
                      )}
                      
                      {isRecentlyUpdated && (
                        <span className="bg-green-500 text-white text-xs px-2 py-1 rounded-full font-medium flex items-center gap-1 shadow-sm animate-pulse">
                          <ArrowUpDown className="h-3 w-3" />
                          Updated
                        </span>
                      )}
                    </div>

                    {/* Image Section */}
                    <div className="relative h-56 bg-gray-100 flex-shrink-0">
                      {product.images && product.images.length > 0 ? (
                        <>
                          <img
                            src={product.images[currentImageIndex]}
                            alt={product.name}
                            className="w-full h-full object-contain p-3"
                            onError={(e) => {
                              e.target.src = 'https://via.placeholder.com/300x200?text=No+Image';
                            }}
                          />
                          
                          {product.images.length > 1 && (
                            <>
                              <button
                                onClick={() => prevImage(product._id)}
                                className="absolute left-2 top-1/2 transform -translate-y-1/2 bg-black/70 hover:bg-black/90 text-white p-1.5 rounded-full transition-all shadow-lg"
                              >
                                <ChevronLeft className="h-4 w-4" />
                              </button>
                              <button
                                onClick={() => nextImage(product._id)}
                                className="absolute right-2 top-1/2 transform -translate-y-1/2 bg-black/70 hover:bg-black/90 text-white p-1.5 rounded-full transition-all shadow-lg"
                              >
                                <ChevronRight className="h-4 w-4" />
                              </button>
                            </>
                          )}
                          
                          {product.images.length > 1 && (
                            <div className="absolute bottom-3 left-1/2 transform -translate-x-1/2 flex gap-1.5">
                              {product.images.map((_, index) => (
                                <div
                                  key={index}
                                  className={`w-2 h-2 rounded-full transition-all ${
                                    index === currentImageIndex
                                      ? 'bg-white shadow-lg'
                                      : 'bg-white/50'
                                  }`}
                                />
                              ))}
                            </div>
                          )}
                          
                          <div className="absolute top-2 right-2 bg-black/70 text-white text-xs px-2 py-1 rounded-full shadow-sm">
                            {currentImageIndex + 1}/{product.images.length}
                          </div>
                        </>
                      ) : (
                        <div className="w-full h-full flex flex-col items-center justify-center theme-text-muted bg-gray-200">
                          <ImageIcon className="h-12 w-12 opacity-50 mb-2" />
                          <span className="text-sm">No Image</span>
                        </div>
                      )}
                    </div>

                    {/* Product Info */}
                    <div className="p-4 flex-1 flex flex-col">
                      <div className="flex justify-between items-start mb-2">
                        <h3 className="font-semibold theme-text text-sm line-clamp-1 flex-1 mr-2">
                          {product.name}
                        </h3>
                        <span className="font-bold text-blue-600 whitespace-nowrap text-sm">
                          UGX {product.sellingPrice?.toLocaleString()}
                        </span>
                      </div>
                      
                      <div className="flex items-center gap-2 mb-2">
                        <p className="theme-text-muted text-xs">{product.brand}</p>
                        {product.sku && (
                          <span className="text-xs px-1.5 py-0.5 bg-gray-100 theme-text rounded">
                            {product.sku}
                          </span>
                        )}
                      </div>
                      
                      <div className="flex items-center justify-between mb-3">
                        <span className="inline-block px-2.5 py-1 bg-blue-100 text-blue-800 rounded-full capitalize text-xs font-medium">
                          {product.category}
                        </span>
                        <span className={`inline-flex items-center px-2.5 py-1 rounded-full font-medium text-xs ${
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
                      <div className="grid grid-cols-2 gap-3 mb-3">
                        <div className="text-center p-2.5 theme-secondary rounded-lg">
                          <p className="theme-text-muted text-xs mb-1">Cost</p>
                          <p className="font-semibold theme-text text-sm">
                            UGX {product.purchasePrice?.toLocaleString()}
                          </p>
                        </div>
                        <div className="text-center p-2.5 bg-green-50 rounded-lg">
                          <p className="theme-text-muted text-xs mb-1">Profit</p>
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
                          className="bg-blue-600 hover:bg-blue-700 text-white py-2 px-2 rounded-lg font-medium transition-all duration-200 flex items-center justify-center gap-1.5 text-xs shadow-sm hover:shadow"
                        >
                          <PackagePlus className="h-3.5 w-3.5" />
                          Restock
                        </button>
                        <button
                          onClick={() => handleEdit(product)}
                          className="bg-green-600 hover:bg-green-700 text-white py-2 px-2 rounded-lg font-medium transition-all duration-200 flex items-center justify-center gap-1.5 text-xs shadow-sm hover:shadow"
                        >
                          <Edit className="h-3.5 w-3.5" />
                          Edit
                        </button>
                        <button
                          onClick={() => handleViewStockHistory(product)}
                          className="bg-purple-600 hover:bg-purple-700 text-white py-2 px-2 rounded-lg font-medium transition-all duration-200 flex items-center justify-center gap-1.5 text-xs shadow-sm hover:shadow"
                        >
                          <History className="h-3.5 w-3.5" />
                          History
                        </button>
                        <button
                          onClick={() => handleQuickView(product)}
                          className="bg-gray-600 hover:bg-gray-700 text-white py-2 px-2 rounded-lg font-medium transition-all duration-200 flex items-center justify-center gap-1.5 text-xs shadow-sm hover:shadow"
                        >
                          <Eye className="h-3.5 w-3.5" />
                          Quick View
                        </button>
                        <button
                          onClick={() => handleDelete(product._id)}
                          className="bg-red-600 hover:bg-red-700 text-white py-2 px-2 rounded-lg font-medium transition-all duration-200 flex items-center justify-center gap-1.5 text-xs shadow-sm hover:shadow col-span-2"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                          Delete Product
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
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center p-4 z-50">
          <div className="theme-surface rounded-xl shadow-2xl max-w-lg w-full max-h-[95vh] overflow-y-auto">
            <div className="p-4 border-b theme-border flex justify-between items-center">
              <h2 className="text-lg font-semibold theme-text flex items-center gap-2">
                <PackagePlus className="h-5 w-5" />
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
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleRestockSubmit} className="p-5 space-y-4">
              <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                <p className="font-semibold theme-text text-sm">{restockingProduct.name}</p>
                <p className="theme-text-muted text-xs mt-1">Current Stock: {restockingProduct.stock}</p>
                {restockingProduct.isLocal && (
                  <p className="text-xs text-blue-600 mt-1">
                    ⚠️ Local product - will sync when online
                  </p>
                )}
              </div>

              <div>
                <label className="block font-medium theme-text text-sm mb-2">
                  Quantity to Add *
                </label>
                <input
                  type="number"
                  required
                  min="1"
                  value={restockFormData.quantity}
                  onChange={(e) => setRestockFormData(prev => ({ ...prev, quantity: e.target.value }))}
                  className="w-full px-4 py-3 theme-border border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 theme-surface theme-text text-sm"
                  placeholder="Enter quantity"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block font-medium theme-text text-sm mb-2">
                    Purchase Price *
                  </label>
                  <div className="relative">
                    <DollarSign className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 theme-text-muted" />
                    <input
                      type="number"
                      required
                      step="0.01"
                      min="0"
                      value={restockFormData.purchasePrice}
                      onChange={(e) => setRestockFormData(prev => ({ ...prev, purchasePrice: e.target.value }))}
                      className="w-full pl-10 pr-3 py-3 theme-border border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 theme-surface theme-text text-sm"
                      placeholder="Cost price"
                    />
                  </div>
                  <p className="text-xs theme-text-muted mt-2">
                    Current: UGX {restockingProduct.purchasePrice?.toLocaleString()}
                  </p>
                </div>

                <div>
                  <label className="block font-medium theme-text text-sm mb-2">
                    Selling Price *
                  </label>
                  <div className="relative">
                    <Tag className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 theme-text-muted" />
                    <input
                      type="number"
                      required
                      step="0.01"
                      min="0"
                      value={restockFormData.sellingPrice}
                      onChange={(e) => setRestockFormData(prev => ({ ...prev, sellingPrice: e.target.value }))}
                      className="w-full pl-10 pr-3 py-3 theme-border border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 theme-surface theme-text text-sm"
                      placeholder="Selling price"
                    />
                  </div>
                  <p className="text-xs theme-text-muted mt-2">
                    Current: UGX {restockingProduct.sellingPrice?.toLocaleString()}
                  </p>
                </div>
              </div>

              {restockFormData.purchasePrice && restockFormData.sellingPrice && (
                <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
                  <div className="flex justify-between text-sm mb-2">
                    <span className="theme-text">Profit Margin:</span>
                    <span className="font-semibold text-green-600">
                      {calculateProfitMargin(parseFloat(restockFormData.purchasePrice), parseFloat(restockFormData.sellingPrice))}%
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="theme-text">Profit per Unit:</span>
                    <span className="font-semibold text-green-600">
                      UGX {calculateProfitAmount(parseFloat(restockFormData.purchasePrice), parseFloat(restockFormData.sellingPrice)).toLocaleString()}
                    </span>
                  </div>
                </div>
              )}

              <div>
                <label className="block font-medium theme-text text-sm mb-2">Notes</label>
                <textarea
                  rows="3"
                  value={restockFormData.notes}
                  onChange={(e) => setRestockFormData(prev => ({ ...prev, notes: e.target.value }))}
                  className="w-full px-4 py-3 theme-border border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 theme-surface theme-text text-sm"
                  placeholder="Add any notes about this restock and price update..."
                />
              </div>

              <div className="flex gap-3 pt-4 border-t theme-border">
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-lg font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-sm hover:shadow"
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
                  className="flex-1 theme-border border theme-text-muted hover:theme-secondary py-3 rounded-lg font-semibold transition-colors"
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
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center p-4 z-50">
          <div className="theme-surface rounded-xl shadow-2xl max-w-3xl w-full max-h-[95vh] overflow-y-auto">
            <div className="p-4 border-b theme-border flex justify-between items-center">
              <h2 className="text-lg font-semibold theme-text">
                Stock History - {selectedProductHistory.product.name}
                {selectedProductHistory.product.isLocal && (
                  <span className="ml-2 text-sm text-blue-600">(Local Product)</span>
                )}
              </h2>
              <button
                onClick={() => {
                  setShowStockHistory(false);
                  setSelectedProductHistory(null);
                }}
                className="theme-text-muted hover:theme-text transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="p-5">
              <div className="mb-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                  <div>
                    <span className="theme-text-muted">Current Stock:</span>
                    <p className="font-semibold text-xl theme-text">
                      {selectedProductHistory.product.stock}
                    </p>
                  </div>
                  <div>
                    <span className="theme-text-muted">Total Restocked:</span>
                    <p className="font-semibold text-xl text-green-600">
                      {selectedProductHistory.product.restockedQuantity || 0}
                    </p>
                  </div>
                  <div>
                    <span className="theme-text-muted">Total Sold:</span>
                    <p className="font-semibold text-xl text-red-600">
                      {selectedProductHistory.product.totalSold || 0}
                    </p>
                  </div>
                  <div>
                    <span className="theme-text-muted">Status:</span>
                    <p className={`font-semibold text-xl ${
                      isOutOfStock(selectedProductHistory.product) 
                        ? 'text-red-600' 
                        : isLowStock(selectedProductHistory.product)
                        ? 'text-yellow-600'
                        : 'text-green-600'
                    }`}>
                      {isOutOfStock(selectedProductHistory.product) 
                        ? 'Out of Stock' 
                        : isLowStock(selectedProductHistory.product)
                        ? 'Low Stock'
                        : 'In Stock'}
                    </p>
                  </div>
                </div>
              </div>

              {selectedProductHistory.history.length === 0 ? (
                <div className="text-center py-8">
                  <History className="h-12 w-12 mx-auto mb-3 theme-text-muted opacity-60" />
                  <p className="theme-text-muted text-sm">No stock history available</p>
                </div>
              ) : (
                <div className="space-y-3 max-h-96 overflow-y-auto">
                  {selectedProductHistory.history.map((record, index) => (
                    <div key={index} className="p-4 border theme-border rounded-lg hover:theme-secondary transition-colors">
                      <div className="flex justify-between items-start mb-3">
                        <div>
                          <p className="font-semibold theme-text text-sm flex items-center gap-2">
                            {record.type === 'restock' ? (
                              <>
                                <PackagePlus className="h-4 w-4 text-green-600" />
                                Restock
                              </>
                            ) : record.type === 'sale' ? (
                              <>
                                <TrendingDown className="h-4 w-4 text-red-600" />
                                Sale
                              </>
                            ) : (
                              <>
                                <RefreshCw className="h-4 w-4 text-blue-600" />
                                Adjustment
                              </>
                            )}
                          </p>
                          <p className="theme-text-muted text-xs mt-1">
                            <Clock className="h-3 w-3 inline mr-1" />
                            {new Date(record.date || record.createdAt).toLocaleDateString()} at{' '}
                            {new Date(record.date || record.createdAt).toLocaleTimeString()}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className={`font-semibold text-sm ${
                            record.unitsChanged > 0 ? 'text-green-600' : 'text-red-600'
                          }`}>
                            {record.unitsChanged > 0 ? '+' : ''}{record.unitsChanged} units
                          </p>
                          <p className="theme-text-muted text-xs mt-1">
                            {record.previousStock} → {record.newStock}
                          </p>
                        </div>
                      </div>
                      {record.notes && (
                        <p className="theme-text text-sm mt-2 p-2 theme-secondary rounded">
                          {record.notes}
                        </p>
                      )}
                      {record.user && (
                        <p className="theme-text-muted text-xs mt-2">
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
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center p-4 z-50">
          <div className="theme-surface rounded-xl shadow-2xl max-w-3xl w-full max-h-[95vh] overflow-y-auto">
            <div className="p-4 border-b theme-border flex justify-between items-center">
              <h2 className="text-lg font-semibold theme-text flex items-center gap-2">
                {editingProduct ? (
                  <>
                    <Edit className="h-5 w-5" />
                    Edit Product
                  </>
                ) : (
                  <>
                    <Plus className="h-5 w-5" />
                    Add New Product
                  </>
                )}
                {!isOnline && editingProduct?.isLocal && (
                  <span className="ml-2 text-sm text-yellow-600">
                    (Local - will sync when online)
                  </span>
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
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-5 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block font-medium theme-text text-sm mb-2">
                    Product Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.name}
                    onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                    className="w-full px-4 py-3 theme-border border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 theme-surface theme-text text-sm"
                    placeholder="Enter product name"
                  />
                </div>

                <div>
                  <label className="block font-medium theme-text text-sm mb-2">
                    Brand *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.brand}
                    onChange={(e) => setFormData(prev => ({ ...prev, brand: e.target.value }))}
                    className="w-full px-4 py-3 theme-border border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 theme-surface theme-text text-sm"
                    placeholder="Enter brand name"
                  />
                </div>

                <div>
                  <label className="block font-medium theme-text text-sm mb-2">
                    Purchase Price *
                  </label>
                  <input
                    type="number"
                    required
                    step="0.01"
                    min="0"
                    value={formData.purchasePrice}
                    onChange={(e) => setFormData(prev => ({ ...prev, purchasePrice: e.target.value }))}
                    className="w-full px-4 py-3 theme-border border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 theme-surface theme-text text-sm"
                    placeholder="Cost price"
                  />
                </div>

                <div>
                  <label className="block font-medium theme-text text-sm mb-2">
                    Selling Price *
                  </label>
                  <input
                    type="number"
                    required
                    step="0.01"
                    min="0"
                    value={formData.sellingPrice}
                    onChange={(e) => setFormData(prev => ({ ...prev, sellingPrice: e.target.value }))}
                    className="w-full px-4 py-3 theme-border border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 theme-surface theme-text text-sm"
                    placeholder="Selling price"
                  />
                </div>

                <div>
                  <label className="block font-medium theme-text text-sm mb-2">
                    Category *
                  </label>
                  <select
                    required
                    value={formData.category}
                    onChange={(e) => setFormData(prev => ({ ...prev, category: e.target.value }))}
                    className="w-full px-4 py-3 theme-border border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 theme-surface theme-text text-sm"
                  >
                    <option value="">Select category</option>
                    {categories.map(category => (
                      <option key={category} value={category}>
                        {category.charAt(0).toUpperCase() + category.slice(1)}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-medium theme-text text-sm mb-2">
                    Initial Stock *
                  </label>
                  <input
                    type="number"
                    required
                    min="0"
                    value={formData.stock}
                    onChange={(e) => setFormData(prev => ({ ...prev, stock: e.target.value }))}
                    className="w-full px-4 py-3 theme-border border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 theme-surface theme-text text-sm"
                    placeholder="Initial stock quantity"
                  />
                </div>

                <div>
                  <label className="block font-medium theme-text text-sm mb-2">
                    Low Stock Alert
                  </label>
                  <input
                    type="number"
                    required
                    min="0"
                    value={formData.lowStockAlert}
                    onChange={(e) => setFormData(prev => ({ ...prev, lowStockAlert: e.target.value }))}
                    className="w-full px-4 py-3 theme-border border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 theme-surface theme-text text-sm"
                    placeholder="Alert when stock reaches"
                  />
                </div>

                <div>
                  <label className="block font-medium theme-text text-sm mb-2">
                    SKU (Optional)
                  </label>
                  <input
                    type="text"
                    value={formData.sku}
                    onChange={(e) => setFormData(prev => ({ ...prev, sku: e.target.value }))}
                    className="w-full px-4 py-3 theme-border border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 theme-surface theme-text text-sm"
                    placeholder="Stock Keeping Unit"
                  />
                </div>
              </div>

              <div>
                <label className="block font-medium theme-text text-sm mb-2">
                  Description *
                </label>
                <textarea
                  required
                  rows="3"
                  value={formData.description}
                  onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                  className="w-full px-4 py-3 theme-border border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 theme-surface theme-text text-sm"
                  placeholder="Product description..."
                />
              </div>

              {/* Image Upload Section */}
              <div>
                <label className="block font-medium theme-text text-sm mb-2">
                  Product Images *
                </label>
                <div className="border-2 border-dashed theme-border rounded-lg p-6 text-center">
                  <ImageIcon className="h-12 w-12 theme-text-muted mx-auto mb-3" />
                  <p className="theme-text-muted text-sm mb-3">
                    Upload up to 5 images (JPG, PNG, GIF)
                  </p>
                  <label className="cursor-pointer">
                    <input
                      type="file"
                      multiple
                      accept="image/*"
                      onChange={handleImageUpload}
                      className="hidden"
                    />
                    <span className="inline-block bg-blue-600 hover:bg-blue-700 text-white px-4 py-2.5 rounded-lg text-sm font-medium transition-colors">
                      Choose Images
                    </span>
                  </label>
                </div>
                
                {/* Image Previews */}
                {imagePreviews.length > 0 && (
                  <div className="mt-4">
                    <p className="theme-text-muted text-sm mb-2">
                      Selected images ({imagePreviews.length}/5):
                    </p>
                    <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                      {imagePreviews.map((preview, index) => (
                        <div key={index} className="relative">
                          <img
                            src={preview}
                            alt={`Preview ${index + 1}`}
                            className="w-full h-24 object-cover rounded-lg"
                          />
                          <button
                            type="button"
                            onClick={() => removeImage(index)}
                            className="absolute -top-2 -right-2 bg-red-600 text-white p-1 rounded-full"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <div className="flex gap-3 pt-4 border-t theme-border">
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex-1 bg-green-600 hover:bg-green-700 text-white py-3 rounded-lg font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-sm hover:shadow"
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
                  className="flex-1 theme-border border theme-text-muted hover:theme-secondary py-3 rounded-lg font-semibold transition-colors"
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