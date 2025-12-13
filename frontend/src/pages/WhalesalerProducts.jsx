// WholesalerProducts.jsx - Complete with Detailed Product Cards and Full Theme Support
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { 
  Filter, Grid, List, ChevronDown, AlertCircle, RefreshCw, Search, X, 
  Building, User, ArrowLeft, Package, Phone, ShoppingCart, Star, 
  MessageCircle, Heart, TrendingUp, Tag, Award, Shield, Truck, 
  Clock, Eye, Share2, CheckCircle, ChevronRight, Info, Battery,
  Wifi, Zap, Settings, Home, MapPin, Mail, Calendar, BarChart
} from 'lucide-react';
import { productsAPI, enhancedWholesalersAPI, filterProductsByWholesaler } from '../services/api';
import SEO from '../components/SEO';
import { useAuth } from '../context/AuthContext';
import { useCartStore } from '../stores/cartStore';

// ProductCard Component - Expanded with all details
const ProductCard = ({ product, showWholesalerInfo = true, compact = false }) => {
  const [isLiked, setIsLiked] = useState(false);
  const [likeCount, setLikeCount] = useState(product.likes?.length || 0);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [showShareMenu, setShowShareMenu] = useState(false);
  const [addedToCart, setAddedToCart] = useState(false);
  
  const { user, isLoggedIn, requireAuth } = useAuth();
  const { addItem, items } = useCartStore();
  const navigate = useNavigate();

  // Get wholesaler info
  const getWholesalerInfo = () => {
    return {
      phone: product.createdBy?.phone || product.soldBy?.phone || '+256751808507',
      name: product.createdBy?.name || product.soldBy?.name || 'Kiwa General Electricals',
      email: product.createdBy?.email || product.soldBy?.email || 'gogreenuganda70@gmail.com',
      location: product.createdBy?.location || product.soldBy?.location || 'Kampala, Uganda'
    };
  };

  // Check if product is already in cart
  useEffect(() => {
    const inCart = items.some(item => item.product._id === product._id);
    setAddedToCart(inCart);
  }, [items, product._id]);

  // Initialize like status
  useEffect(() => {
    if (user && product.likes) {
      const userLiked = product.likes.some(like => 
        typeof like === 'object' ? like._id === user._id : like === user._id
      );
      setIsLiked(userLiked);
    }
    setLikeCount(product.likes?.length || 0);
  }, [product.likes, user]);

  const handleLike = async (e) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (!isLoggedIn) {
      navigate('/login', { 
        state: { from: { pathname: `/wholesaler/${product.createdBy?._id || product.createdBy}/products` } } 
      });
      return;
    }

    try {
      const response = await productsAPI.likeProduct(product._id);
      setIsLiked(response.data.isLiked);
      setLikeCount(response.data.likes);
    } catch (error) {
      console.error('Error liking product:', error);
      // Rollback UI update
      setIsLiked(!isLiked);
    }
  };

  const handleAddToCart = (e) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (!requireAuth({ type: 'add_to_cart', productId: product._id })) {
      navigate('/login', { 
        state: { from: { pathname: `/wholesaler/${product.createdBy?._id || product.createdBy}/products` } } 
      });
      return;
    }
    
    addItem(product, 1);
    setAddedToCart(true);
    
    const event = new CustomEvent('cart-notification', { 
      detail: { 
        message: `${product.name} added to cart!`,
        product: product,
        action: 'add'
      }
    });
    window.dispatchEvent(event);
    
    // Reset added state after 3 seconds
    setTimeout(() => setAddedToCart(false), 3000);
  };

  const handleWhatsApp = (e) => {
    e.preventDefault();
    e.stopPropagation();
    
    const { phone, name } = getWholesalerInfo();
    const message = `Hi ${name}, I'm interested in your product:\n\n*${product.name}*\nPrice: UGX ${product.sellingPrice?.toLocaleString()}\nBrand: ${product.brand || 'Not specified'}\nCategory: ${product.category || 'General'}\n\nCan you provide more details about availability, delivery, and any discounts for bulk orders?`;
    const url = `https://wa.me/${phone.replace(/\D/g, '')}?text=${encodeURIComponent(message)}`;
    window.open(url, '_blank');
  };

  const handleCall = (e) => {
    e.preventDefault();
    e.stopPropagation();
    
    const { phone } = getWholesalerInfo();
    window.location.href = `tel:${phone}`;
  };

  const handleEmail = (e) => {
    e.preventDefault();
    e.stopPropagation();
    
    const { email, name } = getWholesalerInfo();
    const subject = `Inquiry about ${product.name}`;
    const body = `Dear ${name},\n\nI am interested in your product: ${product.name}\nPrice: UGX ${product.sellingPrice?.toLocaleString()}\n\nPlease provide more information about:\n- Availability\n- Delivery options\n- Bulk order discounts\n- Product specifications\n\nThank you.`;
    window.location.href = `mailto:${email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  };

  const handleCardClick = () => {
    navigate(`/products/${product._id}`);
  };

  const handleShare = async (e) => {
    e.preventDefault();
    e.stopPropagation();
    
    const shareData = {
      title: product.name,
      text: `Check out ${product.name} - UGX ${product.sellingPrice?.toLocaleString()} at Kiwa General Electricals`,
      url: `${window.location.origin}/products/${product._id}`
    };

    try {
      if (navigator.share) {
        await navigator.share(shareData);
      } else {
        setShowShareMenu(!showShareMenu);
      }
    } catch (error) {
      console.log('Sharing cancelled or failed:', error);
    }
  };

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}/products/${product._id}`);
      alert('Link copied to clipboard!');
      setShowShareMenu(false);
    } catch (error) {
      console.error('Failed to copy:', error);
    }
  };

  const handleImageError = (e) => {
    e.target.onerror = null;
    e.target.src = 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=600&h=400&fit=crop';
  };

  const currentImage = product.images?.[currentImageIndex] || 
                      product.image || 
                      'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=600&h=400&fit=crop';

  // Calculate average rating
  const calculateAverageRating = () => {
    if (!product.comments || product.comments.length === 0) return 0;
    const sum = product.comments.reduce((acc, comment) => acc + (comment.rating || 0), 0);
    return (sum / product.comments.length).toFixed(1);
  };

  const averageRating = calculateAverageRating();
  const ratingCount = product.comments?.length || 0;

  // Stock status
  const stockStatus = product.stock > 10 ? 'high' : 
                     product.stock > 0 ? 'low' : 'out';

  // Calculate discount percentage
  const discountPercentage = product.originalPrice && product.originalPrice > product.sellingPrice
    ? Math.round(((product.originalPrice - product.sellingPrice) / product.originalPrice) * 100)
    : 0;

  // Format date
  const formatDate = (dateString) => {
    if (!dateString) return 'Recently added';
    const date = new Date(dateString);
    const now = new Date();
    const diffTime = Math.abs(now - date);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays} days ago`;
    if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  // Get product specifications (simplified)
  const getProductSpecs = () => {
    const specs = [];
    if (product.brand) specs.push({ label: 'Brand', value: product.brand, icon: Award });
    if (product.model) specs.push({ label: 'Model', value: product.model, icon: Settings });
    if (product.power) specs.push({ label: 'Power', value: product.power, icon: Zap });
    if (product.voltage) specs.push({ label: 'Voltage', value: product.voltage, icon: Battery });
    if (product.warranty) specs.push({ label: 'Warranty', value: product.warranty, icon: Shield });
    return specs.slice(0, 3); // Show only first 3 specs
  };

  const productSpecs = getProductSpecs();

  if (compact) {
    return (
      <div 
        className="relative theme-surface rounded-lg overflow-hidden cursor-pointer h-85 transition-all duration-300 hover:shadow-lg hover:scale-[1.02] border border-gray-200 dark:border-gray-700 hover:border-blue-500 dark:hover:border-blue-600 group"
        onClick={handleCardClick}
      >
        {/* Product Image */}
        <div className="h-40 bg-gray-100 dark:bg-gray-700 flex items-center justify-center overflow-hidden relative">
          <img 
            src={currentImage} 
            alt={product.name}
            className="w-full h-full object-contain transition-transform duration-300 group-hover:scale-110"
            onError={handleImageError}
          />
          
          {/* Discount Badge */}
          {discountPercentage > 0 && (
            <div className="absolute top-2 left-2">
              <span className="inline-flex items-center px-2 py-1 rounded-md bg-red-500 text-white text-xs font-bold shadow-lg">
                -{discountPercentage}%
              </span>
            </div>
          )}
          
          {/* Stock Badge */}
          <div className="absolute top-2 right-2">
            <span className={`inline-flex items-center px-2 py-1 rounded-md text-xs font-semibold backdrop-blur-xs ${
              stockStatus === 'high' ? 'bg-green-500/90 text-white' : 
              stockStatus === 'low' ? 'bg-yellow-500/90 text-white' : 
              'bg-red-500/90 text-white'
            }`}>
              {stockStatus === 'high' ? 'In Stock' : 
               stockStatus === 'low' ? 'Low Stock' : 'Out of Stock'}
            </span>
          </div>
          
          {/* Like Button */}
          <button
            onClick={handleLike}
            className={`absolute bottom-2 right-2 p-2 rounded-full transition-all shadow-lg ${
              isLiked 
                ? 'bg-red-500 text-white' 
                : 'bg-white/90 dark:bg-gray-800/90 text-gray-600 dark:text-gray-300 hover:bg-red-50 dark:hover:bg-red-900/30'
            } hover:scale-110`}
          >
            <Heart className={`h-4 w-4 ${isLiked ? 'fill-current' : ''}`} />
          </button>
        </div>

        {/* Product Info */}
        <div className="p-3">
          <div className="mb-2">
            <h3 className="font-semibold text-sm mb-1 line-clamp-2 theme-text group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
              {product.name}
            </h3>
            <p className="text-xs theme-text-muted truncate">
              {product.brand || 'General Electrical'}
            </p>
          </div>

          {/* Rating */}
          <div className="flex items-center gap-1 mb-2">
            <div className="flex">
              {[...Array(5)].map((_, i) => (
                <Star
                  key={i}
                  className={`w-3 h-3 ${
                    i < Math.floor(averageRating) 
                      ? 'text-yellow-400 fill-yellow-400' 
                      : 'text-gray-300 dark:text-gray-600'
                  }`}
                />
              ))}
            </div>
            <span className="text-xs theme-text-muted ml-0.5">
              {averageRating} ({ratingCount})
            </span>
            {likeCount > 0 && (
              <span className="text-xs theme-text-muted ml-2 flex items-center gap-0.5">
                <Heart className="h-3 w-3" />
                {likeCount}
              </span>
            )}
          </div>

          {/* Price */}
          <div className="mb-3">
            <div className="flex items-center gap-2">
              <p className="text-lg font-bold theme-text">
                UGX {product.sellingPrice?.toLocaleString()}
              </p>
              {product.originalPrice && product.originalPrice > product.sellingPrice && (
                <span className="text-xs line-through theme-text-muted">
                  UGX {product.originalPrice.toLocaleString()}
                </span>
              )}
            </div>
            
            <div className="flex items-center justify-between mt-1">
              <span className="text-xs theme-text-muted">
                {product.stock || 0} in stock
              </span>
              {product.sold > 0 && (
                <span className="text-xs theme-text-muted flex items-center gap-0.5">
                  <TrendingUp className="h-3 w-3" />
                  {product.sold} sold
                </span>
              )}
            </div>
          </div>

          {/* Action Buttons */}
          <div className="grid grid-cols-2 gap-1.5">
            <button
              onClick={handleAddToCart}
              disabled={!product.stock || product.stock === 0 || addedToCart}
              className={`px-2 py-1.5 rounded text-xs font-semibold transition-colors flex items-center justify-center gap-1.5 ${
                addedToCart
                  ? 'bg-green-600 text-white'
                  : !product.stock || product.stock === 0
                  ? 'bg-gray-300 dark:bg-gray-600 text-gray-500 dark:text-gray-400 cursor-not-allowed'
                  : 'bg-blue-600 hover:bg-blue-700 text-white'
              }`}
            >
              <ShoppingCart className="w-3.5 h-3.5" />
              <span>{addedToCart ? 'Added ✓' : 'Add to Cart'}</span>
            </button>

            <button
              onClick={handleWhatsApp}
              className="bg-green-600 hover:bg-green-700 text-white px-2 py-1.5 rounded text-xs font-semibold transition-colors flex items-center justify-center gap-1.5"
            >
              <MessageCircle className="w-3.5 h-3.5" />
              <span>Chat</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Full detailed card
  return (
    <div 
      className="theme-surface rounded-lg overflow-hidden cursor-pointer transition-all duration-300 hover:shadow-xl border border-gray-200 dark:border-gray-700 hover:border-blue-500 dark:hover:border-blue-600 group"
      onClick={handleCardClick}
    >
      <div className="md:flex">
        {/* Product Image Section */}
        <div className="md:w-2/5 bg-gray-50 dark:bg-gray-800 p-4 flex items-center justify-center relative">
          <div className="relative w-full h-64 md:h-full">
            <img 
              src={currentImage} 
              alt={product.name}
              className="w-full h-full object-contain transition-transform duration-300 group-hover:scale-105"
              onError={handleImageError}
            />
            
            {/* Image Navigation */}
            {product.images && product.images.length > 1 && (
              <div className="absolute bottom-2 left-1/2 transform -translate-x-1/2 flex gap-1">
                {product.images.map((_, index) => (
                  <button
                    key={index}
                    onClick={(e) => {
                      e.stopPropagation();
                      setCurrentImageIndex(index);
                    }}
                    className={`w-2 h-2 rounded-full transition-all ${
                      index === currentImageIndex 
                        ? 'bg-blue-600 w-4' 
                        : 'bg-gray-300 dark:bg-gray-600 hover:bg-gray-400 dark:hover:bg-gray-500'
                    }`}
                  />
                ))}
              </div>
            )}
            
            {/* Badges */}
            <div className="absolute top-3 left-3 flex flex-col gap-2">
              {discountPercentage > 0 && (
                <span className="inline-flex items-center px-3 py-1 rounded-full bg-red-500 text-white text-sm font-bold shadow-lg">
                  -{discountPercentage}% OFF
                </span>
              )}
              
              <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-semibold shadow-lg ${
                stockStatus === 'high' ? 'bg-green-500 text-white' : 
                stockStatus === 'low' ? 'bg-yellow-500 text-white' : 
                'bg-red-500 text-white'
              }`}>
                {stockStatus === 'high' ? 'In Stock' : 
                 stockStatus === 'low' ? 'Low Stock' : 'Out of Stock'}
              </span>
            </div>
            
            {/* Action Buttons */}
            <div className="absolute top-3 right-3 flex flex-col gap-2">
              <button
                onClick={handleLike}
                className={`p-2 rounded-full transition-all shadow-lg ${
                  isLiked 
                    ? 'bg-red-500 text-white' 
                    : 'bg-white/90 dark:bg-gray-800/90 text-gray-600 dark:text-gray-300 hover:bg-red-50 dark:hover:bg-red-900/30'
                } hover:scale-110`}
              >
                <Heart className={`h-5 w-5 ${isLiked ? 'fill-current' : ''}`} />
              </button>
              
              <button
                onClick={handleShare}
                className="p-2 rounded-full bg-white/90 dark:bg-gray-800/90 text-gray-600 dark:text-gray-300 hover:bg-blue-50 dark:hover:bg-blue-900/30 hover:text-blue-600 dark:hover:text-blue-400 shadow-lg hover:scale-110 transition-all"
              >
                <Share2 className="h-5 w-5" />
              </button>
            </div>
          </div>
        </div>

        {/* Product Details Section */}
        <div className="md:w-3/5 p-6">
          {/* Header */}
          <div className="mb-4">
            <div className="flex items-start justify-between mb-2">
              <div>
                <h2 className="text-xl font-bold theme-text group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                  {product.name}
                </h2>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-sm theme-text-muted">{product.brand || 'General Brand'}</span>
                  <span className="text-xs px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200">
                    {product.category || 'Electrical'}
                  </span>
                </div>
              </div>
              
              {/* Wholesaler Info */}
              {showWholesalerInfo && (
                <div className="text-right">
                  <div className="flex items-center gap-2 justify-end">
                    <User className="h-4 w-4 theme-text-muted" />
                    <span className="text-sm font-medium theme-text">{getWholesalerInfo().name}</span>
                  </div>
                  <div className="text-xs theme-text-muted mt-1 flex items-center gap-1 justify-end">
                    <MapPin className="h-3 w-3" />
                    {getWholesalerInfo().location}
                  </div>
                </div>
              )}
            </div>

            {/* Description */}
            {product.description && (
              <p className="theme-text-muted text-sm mb-4 line-clamp-2">
                {product.description}
              </p>
            )}
          </div>

          {/* Rating and Stats */}
          <div className="flex items-center gap-4 mb-6">
            <div className="flex items-center gap-2">
              <div className="flex">
                {[...Array(5)].map((_, i) => (
                  <Star
                    key={i}
                    className={`w-4 h-4 ${
                      i < Math.floor(averageRating) 
                        ? 'text-yellow-400 fill-yellow-400' 
                        : 'text-gray-300 dark:text-gray-600'
                    }`}
                  />
                ))}
              </div>
              <div>
                <span className="font-semibold theme-text">{averageRating}</span>
                <span className="text-xs theme-text-muted ml-1">({ratingCount} reviews)</span>
              </div>
            </div>
            
            <div className="flex items-center gap-4">
              {likeCount > 0 && (
                <div className="flex items-center gap-1">
                  <Heart className="h-4 w-4 text-red-500" />
                  <span className="text-sm theme-text">{likeCount} likes</span>
                </div>
              )}
              
              {product.viewCount > 0 && (
                <div className="flex items-center gap-1">
                  <Eye className="h-4 w-4 theme-text-muted" />
                  <span className="text-sm theme-text-muted">{product.viewCount} views</span>
                </div>
              )}
              
              {product.sold > 0 && (
                <div className="flex items-center gap-1">
                  <TrendingUp className="h-4 w-4 text-green-500" />
                  <span className="text-sm theme-text">{product.sold} sold</span>
                </div>
              )}
            </div>
          </div>

          {/* Specifications */}
          {productSpecs.length > 0 && (
            <div className="mb-6">
              <h4 className="font-semibold theme-text mb-3 flex items-center gap-2">
                <Settings className="h-4 w-4" />
                Key Specifications
              </h4>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {productSpecs.map((spec, index) => {
                  const Icon = spec.icon;
                  return (
                    <div key={index} className="bg-gray-50 dark:bg-gray-800 rounded-lg p-3">
                      <div className="flex items-center gap-2 mb-1">
                        <Icon className="h-3 w-3 theme-text-muted" />
                        <span className="text-xs theme-text-muted">{spec.label}</span>
                      </div>
                      <span className="text-sm font-medium theme-text">{spec.value}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Price Section */}
          <div className="mb-6">
            <div className="flex items-center gap-4 mb-3">
              <div>
                <div className="flex items-baseline gap-2">
                  <span className="text-2xl font-bold theme-text">
                    UGX {product.sellingPrice?.toLocaleString()}
                  </span>
                  {product.originalPrice && product.originalPrice > product.sellingPrice && (
                    <span className="text-lg line-through theme-text-muted">
                      UGX {product.originalPrice.toLocaleString()}
                    </span>
                  )}
                </div>
                <div className="text-sm theme-text-muted mt-1">
                  Price includes VAT • Free delivery in Kampala
                </div>
              </div>
              
              {/* Stock Info */}
              <div className="bg-gray-50 dark:bg-gray-800 rounded-lg px-4 py-2">
                <div className="text-sm font-medium theme-text">{product.stock || 0} units available</div>
                <div className="text-xs theme-text-muted">Order now for quick delivery</div>
              </div>
            </div>
            
            {/* Delivery Info */}
            <div className="flex items-center gap-4 text-sm">
              <div className="flex items-center gap-2 theme-text">
                <Truck className="h-4 w-4 text-green-600" />
                <span>Free delivery in Kampala</span>
              </div>
              <div className="flex items-center gap-2 theme-text">
                <Clock className="h-4 w-4 text-blue-600" />
                <span>Delivery in 2-4 hours</span>
              </div>
              <div className="flex items-center gap-2 theme-text">
                <Shield className="h-4 w-4 text-purple-600" />
                <span>1-year warranty</span>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-wrap gap-3">
            <button
              onClick={handleAddToCart}
              disabled={!product.stock || product.stock === 0 || addedToCart}
              className={`flex-1 min-w-[140px] py-3 px-4 rounded-lg font-semibold transition-all flex items-center justify-center gap-3 ${
                addedToCart
                  ? 'bg-green-600 text-white'
                  : !product.stock || product.stock === 0
                  ? 'bg-gray-300 dark:bg-gray-600 text-gray-500 dark:text-gray-400 cursor-not-allowed'
                  : 'bg-blue-600 hover:bg-blue-700 text-white hover:shadow-lg'
              }`}
            >
              <ShoppingCart className="h-5 w-5" />
              <span>{addedToCart ? 'Added to Cart ✓' : 'Add to Cart'}</span>
            </button>
            
            <button
              onClick={handleWhatsApp}
              className="flex-1 min-w-[140px] py-3 px-4 rounded-lg font-semibold bg-green-600 hover:bg-green-700 text-white transition-all hover:shadow-lg flex items-center justify-center gap-3"
            >
              <MessageCircle className="h-5 w-5" />
              <span>Chat on WhatsApp</span>
            </button>
            
            <button
              onClick={handleCall}
              className="flex-1 min-w-[140px] py-3 px-4 rounded-lg font-semibold bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 theme-text transition-all flex items-center justify-center gap-3"
            >
              <Phone className="h-5 w-5" />
              <span>Call Now</span>
            </button>
          </div>
          
          {/* Quick Actions */}
          <div className="flex items-center justify-between mt-6 pt-6 border-t border-gray-200 dark:border-gray-700">
            <button
              onClick={handleEmail}
              className="text-sm theme-text-muted hover:theme-text flex items-center gap-2"
            >
              <Mail className="h-4 w-4" />
              Send inquiry email
            </button>
            
            <div className="text-xs theme-text-muted flex items-center gap-2">
              <Calendar className="h-3 w-3" />
              Added {formatDate(product.createdAt)}
            </div>
          </div>
        </div>
      </div>

      {/* Share Menu */}
      {showShareMenu && (
        <div className="absolute right-3 top-16 bg-white dark:bg-gray-800 rounded-lg shadow-xl border border-gray-200 dark:border-gray-700 p-3 z-50">
          <button
            onClick={copyLink}
            className="w-full text-left px-3 py-2 rounded hover:bg-gray-100 dark:hover:bg-gray-700 theme-text flex items-center gap-2"
          >
            <Share2 className="h-4 w-4" />
            Copy link
          </button>
        </div>
      )}
    </div>
  );
};

// Main WholesalerProducts Component
const WholesalerProducts = () => {
  const { id: wholesalerId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  
  // State management
  const [allProducts, setAllProducts] = useState([]);
  const [filteredProducts, setFilteredProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [wholesaler, setWholesaler] = useState(null);
  const [error, setError] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [backendConnected, setBackendConnected] = useState(true);
  const [viewMode, setViewMode] = useState('grid');
  const [sortBy, setSortBy] = useState('newest');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [priceRange, setPriceRange] = useState({ min: '', max: '' });
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);
  const [stats, setStats] = useState({ total: 0, inStock: 0, outOfStock: 0 });
  
  const abortControllerRef = useRef(null);
  const searchTimeoutRef = useRef(null);

  // Fetch wholesaler info
  useEffect(() => {
    const fetchWholesaler = async () => {
      try {
        if (location.state?.wholesalerName) {
          setWholesaler({
            _id: wholesalerId,
            name: location.state.wholesalerName,
            fromState: true,
            ...location.state
          });
        } else {
          const response = await enhancedWholesalersAPI.getWholesalerById(wholesalerId);
          if (response.data.success && response.data.wholesaler) {
            setWholesaler(response.data.wholesaler);
          } else {
            throw new Error('Wholesaler not found');
          }
        }
      } catch (error) {
        console.error('Error fetching wholesaler:', error);
        setWholesaler({
          _id: wholesalerId,
          name: 'Wholesaler',
          fromState: false
        });
      }
    };

    if (wholesalerId) {
      fetchWholesaler();
    }
  }, [wholesalerId, location.state]);

  // Calculate statistics
  useEffect(() => {
    if (allProducts.length > 0) {
      const total = allProducts.length;
      const inStock = allProducts.filter(p => p.stock > 0).length;
      const outOfStock = total - inStock;
      setStats({ total, inStock, outOfStock });
    }
  }, [allProducts]);

  // Fetch products
  const fetchProducts = useCallback(async () => {
    if (!wholesalerId) return;
    
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    
    abortControllerRef.current = new AbortController();
    
    setLoading(true);
    setError('');
    
    try {
      const response = await productsAPI.getProductsByCreator(wholesalerId, {
        page: 1,
        limit: 100
      }, {
        signal: abortControllerRef.current.signal
      });
      
      let productsData = response.data.products || [];
      
      // Client-side filtering for safety
      const filteredForWholesaler = productsData.filter(product => {
        const creatorId = product.createdBy?._id || product.createdBy;
        return creatorId === wholesalerId;
      });
      
      setAllProducts(filteredForWholesaler);
      applyFiltersAndSearch(filteredForWholesaler, searchTerm);
      setBackendConnected(true);
      
    } catch (error) {
      if (error.name === 'AbortError' || error.code === 'ERR_CANCELED') {
        return;
      }
      
      console.error('❌ Error fetching products:', error.message);
      
      // Fallback method
      try {
        const fallbackResponse = await productsAPI.getProducts({
          page: 1,
          limit: 100
        }, {
          signal: abortControllerRef.current.signal
        });
        
        let allProductsData = fallbackResponse.data.products || [];
        const filteredProductsData = filterProductsByWholesaler(allProductsData, wholesalerId);
        
        setAllProducts(filteredProductsData);
        applyFiltersAndSearch(filteredProductsData, searchTerm);
        setBackendConnected(true);
        
      } catch (fallbackError) {
        console.error('❌ Fallback also failed:', fallbackError.message);
        setError('Failed to load products. Please check your connection and try again.');
        setBackendConnected(false);
        setAllProducts([]);
        setFilteredProducts([]);
      }
    } finally {
      setLoading(false);
    }
  }, [wholesalerId]);

  // Apply all filters
  const applyFiltersAndSearch = (productsData, searchQuery = '') => {
    let filtered = [...productsData];
    
    // Search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim();
      filtered = filtered.filter(product => {
        return (
          product.name?.toLowerCase().includes(query) ||
          product.brand?.toLowerCase().includes(query) ||
          product.category?.toLowerCase().includes(query) ||
          product.description?.toLowerCase().includes(query) ||
          product.model?.toLowerCase().includes(query)
        );
      });
    }
    
    // Category filter
    if (selectedCategory && selectedCategory !== 'All') {
      filtered = filtered.filter(product => 
        product.category?.toLowerCase() === selectedCategory.toLowerCase()
      );
    }
    
    // Price range filter
    if (priceRange.min || priceRange.max) {
      filtered = filtered.filter(product => {
        const price = product.sellingPrice || 0;
        const min = priceRange.min ? parseInt(priceRange.min) : 0;
        const max = priceRange.max ? parseInt(priceRange.max) : Infinity;
        return price >= min && price <= max;
      });
    }
    
    // Apply sorting
    filtered = applySorting(filtered, sortBy);
    
    setFilteredProducts(filtered);
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
        return sorted.sort((a, b) => {
          const ratingA = b.comments?.length || 0;
          const ratingB = a.comments?.length || 0;
          return ratingA - ratingB;
        });
      case 'popular':
        return sorted.sort((a, b) => (b.likes?.length || 0) - (a.likes?.length || 0));
      case 'stock':
        return sorted.sort((a, b) => (b.stock || 0) - (a.stock || 0));
      case 'newest':
      default:
        return sorted.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
    }
  };

  // Handle search with debounce
  const handleSearchChange = (e) => {
    const value = e.target.value;
    setSearchTerm(value);
    
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }
    
    searchTimeoutRef.current = setTimeout(() => {
      applyFiltersAndSearch(allProducts, value);
    }, 300);
  };

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }
    
    applyFiltersAndSearch(allProducts, searchTerm);
  };

  const handleClearSearch = () => {
    setSearchTerm('');
    setPriceRange({ min: '', max: '' });
    setSelectedCategory('All');
    applyFiltersAndSearch(allProducts, '');
  };

  // Handle price range change
  const handlePriceChange = (type, value) => {
    const numValue = value.replace(/\D/g, '');
    setPriceRange(prev => ({
      ...prev,
      [type]: numValue
    }));
    
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }
    
    searchTimeoutRef.current = setTimeout(() => {
      applyFiltersAndSearch(allProducts, searchTerm);
    }, 500);
  };

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
    { label: 'Newest Arrivals', value: 'newest', icon: Calendar },
    { label: 'Price: Low to High', value: 'price-low', icon: TrendingUp },
    { label: 'Price: High to Low', value: 'price-high', icon: TrendingUp },
    { label: 'Most Popular', value: 'popular', icon: Heart },
    { label: 'Best Rated', value: 'rating', icon: Star },
    { label: 'In Stock First', value: 'stock', icon: Package }
  ];

  // Initial fetch
  useEffect(() => {
    if (!wholesalerId) return;
    
    fetchProducts();
  }, [wholesalerId, fetchProducts]);

  // Cleanup
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

  const handleBackToWholesalers = () => {
    navigate('/wholesalers');
  };

  const handleViewAllProducts = () => {
    navigate('/products');
  };

  const retryBackendConnection = () => {
    setError('');
    fetchProducts();
  };

  // Loading state
  if (loading && !wholesaler) {
    return (
      <div className="min-h-screen theme-bg flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 theme-text">Loading wholesaler information...</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <SEO
        title={`${wholesaler?.name ? `${wholesaler.name}'s Products - ` : ''}Electrical Products Uganda`}
        description={`Browse ${filteredProducts.length} electrical products ${wholesaler?.name ? `from ${wholesaler.name}` : ''} at wholesale prices in Uganda. ☎️ Call 0751808507 for bulk orders.`}
        keywords={`${wholesaler?.name ? `${wholesaler.name}, ` : ''}electrical products Uganda, wholesale electrical goods, ${categories.slice(1).join(', ')}`}
        pageType="collection"
        productData={filteredProducts}
      />
      
      <div className="min-h-screen theme-bg">
        {/* Header Section */}
        <div className="theme-surface shadow-xs theme-border border-b">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-center">
                <button
                  onClick={handleBackToWholesalers}
                  className="mr-3 p-2 hover:theme-secondary rounded-lg transition-colors"
                  title="Back to Wholesalers"
                >
                  <ArrowLeft className="h-5 w-5 theme-text" />
                </button>
                <div>
                  <h1 className="text-2xl font-bold theme-text">
                    {wholesaler?.name ? `${wholesaler.name}'s Products` : 'Loading...'}
                  </h1>
                  <p className="text-sm theme-text-muted mt-1">
                    {wholesaler?.email && (
                      <span className="flex items-center gap-1">
                        <Mail className="h-3 w-3" />
                        {wholesaler.email}
                      </span>
                    )}
                  </p>
                </div>
                {wholesaler && (
                  <div className="ml-4 flex items-center gap-2">
                    <span className="px-3 py-1 rounded-full bg-purple-100 dark:bg-purple-900 text-purple-800 dark:text-purple-200 text-sm font-medium flex items-center gap-1">
                      <Shield className="h-3 w-3" />
                      Verified Wholesaler
                    </span>
                    {wholesaler.phone && (
                      <a 
                        href={`tel:${wholesaler.phone}`}
                        className="px-3 py-1 rounded-full bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200 text-sm font-medium flex items-center gap-1 hover:bg-green-200 dark:hover:bg-green-800 transition-colors"
                      >
                        <Phone className="h-3 w-3" />
                        {wholesaler.phone}
                      </a>
                    )}
                  </div>
                )}
              </div>
              <div className="text-sm theme-text-muted flex items-center gap-2">
                <Truck className="h-4 w-4 text-green-600" />
                <span>Free Kampala delivery •</span>
                <Phone className="h-4 w-4 text-blue-600" />
                <span>0751808507</span>
              </div>
            </div>
            
            {/* Stats Bar */}
            <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="theme-surface rounded-lg p-3 border theme-border">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm theme-text-muted">Total Products</p>
                    <p className="text-2xl font-bold theme-text">{stats.total}</p>
                  </div>
                  <Package className="h-8 w-8 text-blue-600 dark:text-blue-400" />
                </div>
              </div>
              
              <div className="theme-surface rounded-lg p-3 border theme-border">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm theme-text-muted">In Stock</p>
                    <p className="text-2xl font-bold theme-text">{stats.inStock}</p>
                  </div>
                  <CheckCircle className="h-8 w-8 text-green-600 dark:text-green-400" />
                </div>
              </div>
              
              <div className="theme-surface rounded-lg p-3 border theme-border">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm theme-text-muted">Showing</p>
                    <p className="text-2xl font-bold theme-text">{filteredProducts.length}</p>
                  </div>
                  <Eye className="h-8 w-8 text-purple-600 dark:text-purple-400" />
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          {/* Connection Warning */}
          {error && !backendConnected && (
            <div className="mb-6 p-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <AlertCircle className="h-5 w-5 text-yellow-600 dark:text-yellow-400" />
                <div>
                  <p className="text-yellow-800 dark:text-yellow-300 font-medium">Connection Issue</p>
                  <p className="text-yellow-700 dark:text-yellow-400 text-sm">
                    {error}
                  </p>
                </div>
              </div>
              <button
                onClick={retryBackendConnection}
                className="bg-yellow-600 hover:bg-yellow-700 text-white px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2"
              >
                <RefreshCw className="h-4 w-4" />
                Retry Connection
              </button>
            </div>
          )}

          {/* Search and Filter Bar */}
          <div className="mb-8">
            <form onSubmit={handleSearchSubmit} className="mb-6">
              <div className="relative">
                <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 h-5 w-5 theme-text-muted" />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={handleSearchChange}
                  placeholder={wholesaler?.name ? `Search ${wholesaler.name}'s products...` : "Search electrical products by name, brand, or category..."}
                  className="w-full pl-12 pr-24 py-3 text-base theme-border border-2 rounded-xl focus:outline-none focus:border-blue-500 theme-surface theme-text"
                />
                <div className="absolute right-2 top-1/2 transform -translate-y-1/2 flex items-center gap-2">
                  {searchTerm && (
                    <button
                      type="button"
                      onClick={handleClearSearch}
                      className="p-2 theme-text-muted hover:theme-text hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
                      title="Clear search"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  )}
                  <button
                    type="submit"
                    className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-lg font-medium flex items-center gap-2 transition-all hover:shadow-lg"
                  >
                    <Search className="h-4 w-4" />
                    Search
                  </button>
                </div>
              </div>
            </form>
            
            {/* Filters Row */}
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
              <div className="flex flex-wrap items-center gap-3">
                {/* Mobile Filter Button */}
                <button
                  onClick={() => setMobileFiltersOpen(true)}
                  className="lg:hidden flex items-center gap-2 px-4 py-2 theme-border border rounded-lg theme-surface theme-text hover:theme-secondary transition-colors"
                >
                  <Filter className="h-4 w-4" />
                  Filters
                  <ChevronDown className="h-4 w-4" />
                </button>
                
                {/* Category Filter */}
                <div className="hidden lg:block">
                  <label className="block text-sm font-medium theme-text mb-1">Category</label>
                  <select
                    value={selectedCategory}
                    onChange={(e) => {
                      setSelectedCategory(e.target.value);
                      applyFiltersAndSearch(allProducts, searchTerm);
                    }}
                    className="theme-surface theme-border border rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500 theme-text min-w-[180px]"
                  >
                    {categories.map(category => (
                      <option key={category} value={category}>
                        {category}
                      </option>
                    ))}
                  </select>
                </div>
                
                {/* Price Range */}
                <div className="hidden lg:block">
                  <label className="block text-sm font-medium theme-text mb-1">Price Range (UGX)</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={priceRange.min}
                      onChange={(e) => handlePriceChange('min', e.target.value)}
                      placeholder="Min"
                      className="theme-surface theme-border border rounded-lg px-3 py-2 w-24 focus:outline-none focus:ring-1 focus:ring-blue-500 theme-text"
                    />
                    <span className="theme-text-muted">to</span>
                    <input
                      type="text"
                      value={priceRange.max}
                      onChange={(e) => handlePriceChange('max', e.target.value)}
                      placeholder="Max"
                      className="theme-surface theme-border border rounded-lg px-3 py-2 w-24 focus:outline-none focus:ring-1 focus:ring-blue-500 theme-text"
                    />
                  </div>
                </div>
                
                {/* Clear Filters Button */}
                {(selectedCategory !== 'All' || priceRange.min || priceRange.max || searchTerm) && (
                  <button
                    onClick={handleClearSearch}
                    className="px-4 py-2.5 text-sm theme-text-muted hover:theme-text hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors flex items-center gap-2"
                  >
                    <X className="h-4 w-4" />
                    Clear Filters
                  </button>
                )}
              </div>
              
              <div className="flex items-center gap-4">
                {/* Sort Options */}
                <div>
                  <label className="block text-sm font-medium theme-text mb-1">Sort By</label>
                  <select
                    value={sortBy}
                    onChange={(e) => {
                      setSortBy(e.target.value);
                      applyFiltersAndSearch(allProducts, searchTerm);
                    }}
                    className="theme-surface theme-border border rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-purple-500 theme-text min-w-[180px]"
                  >
                    {sortOptions.map(option => {
                      const Icon = option.icon;
                      return (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      );
                    })}
                  </select>
                </div>
                
                {/* View Mode Toggle */}
                <div>
                  <label className="block text-sm font-medium theme-text mb-1">View</label>
                  <div className="theme-border border rounded-lg overflow-hidden flex">
                    <button
                      onClick={() => setViewMode('grid')}
                      className={`px-4 py-2.5 transition-all ${
                        viewMode === 'grid' 
                          ? 'bg-blue-600 text-white' 
                          : 'theme-surface theme-text-muted hover:theme-secondary'
                      }`}
                      title="Grid View"
                    >
                      <Grid className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => setViewMode('list')}
                      className={`px-4 py-2.5 transition-all ${
                        viewMode === 'list' 
                          ? 'bg-blue-600 text-white' 
                          : 'theme-surface theme-text-muted hover:theme-secondary'
                      }`}
                      title="List View"
                    >
                      <List className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </div>
            </div>
            
            {/* Active Filters Display */}
            {(selectedCategory !== 'All' || priceRange.min || priceRange.max || searchTerm) && (
              <div className="mt-4 flex flex-wrap items-center gap-2">
                <span className="text-sm theme-text-muted">Active filters:</span>
                {searchTerm && (
                  <span className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 text-sm">
                    Search: "{searchTerm}"
                    <button onClick={() => setSearchTerm('')} className="ml-1 hover:text-blue-600">
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                )}
                {selectedCategory !== 'All' && (
                  <span className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200 text-sm">
                    Category: {selectedCategory}
                    <button onClick={() => setSelectedCategory('All')} className="ml-1 hover:text-green-600">
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                )}
                {(priceRange.min || priceRange.max) && (
                  <span className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full bg-purple-100 dark:bg-purple-900 text-purple-800 dark:text-purple-200 text-sm">
                    Price: {priceRange.min ? `UGX ${parseInt(priceRange.min).toLocaleString()}` : 'Any'} - {priceRange.max ? `UGX ${parseInt(priceRange.max).toLocaleString()}` : 'Any'}
                    <button onClick={() => setPriceRange({ min: '', max: '' })} className="ml-1 hover:text-purple-600">
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                )}
              </div>
            )}
          </div>

          {/* Products Count */}
          <div className="mb-6">
            <h2 className="text-xl font-bold theme-text">
              Products ({filteredProducts.length})
            </h2>
            {searchTerm && (
              <p className="text-sm theme-text-muted mt-1">
                Showing results for "{searchTerm}"
                {selectedCategory !== 'All' && ` in ${selectedCategory}`}
              </p>
            )}
          </div>

          {/* Products Grid/List */}
          {loading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {[...Array(6)].map((_, i) => (
                <div key={i} className="theme-surface rounded-xl shadow theme-border border p-6 animate-pulse">
                  <div className="bg-gray-300 dark:bg-gray-600 h-48 rounded-lg mb-4"></div>
                  <div className="bg-gray-300 dark:bg-gray-600 h-4 rounded mb-3 w-3/4"></div>
                  <div className="bg-gray-300 dark:bg-gray-600 h-3 rounded mb-2 w-1/2"></div>
                  <div className="bg-gray-300 dark:bg-gray-600 h-6 rounded mb-4 w-1/3"></div>
                  <div className="bg-gray-300 dark:bg-gray-600 h-10 rounded"></div>
                </div>
              ))}
            </div>
          ) : filteredProducts.length > 0 ? (
            <div className={`${viewMode === 'grid' ? 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6' : 'space-y-6'}`}>
              {filteredProducts.map(product => (
                <ProductCard 
                  key={product._id} 
                  product={product} 
                  showWholesalerInfo={false} // Already showing wholesaler in header
                  compact={viewMode === 'grid'}
                />
              ))}
            </div>
          ) : (
            <div className="text-center py-16">
              <div className="theme-text-muted text-7xl mb-6">🔍</div>
              <h3 className="text-2xl font-bold theme-text mb-3">
                {wholesaler?.name 
                  ? `No products from ${wholesaler.name}${searchTerm ? ` for "${searchTerm}"` : ''}`
                  : 'No products found'}
              </h3>
              <p className="theme-text-muted text-lg mb-8 max-w-2xl mx-auto">
                {wholesaler?.name 
                  ? `${wholesaler.name} doesn't have any products listed yet. Check back later or contact them directly for custom orders.`
                  : 'Try adjusting your search terms or filters to find what you\'re looking for.'}
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <button
                  onClick={handleBackToWholesalers}
                  className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg font-medium transition-all hover:shadow-lg flex items-center justify-center gap-2"
                >
                  <ArrowLeft className="h-4 w-4" />
                  Back to Wholesalers
                </button>
                <button
                  onClick={handleViewAllProducts}
                  className="bg-purple-600 hover:bg-purple-700 text-white px-6 py-3 rounded-lg font-medium transition-all hover:shadow-lg flex items-center justify-center gap-2"
                >
                  <Package className="h-4 w-4" />
                  View All Products
                </button>
                <a 
                  href="tel:+256751808507" 
                  className="bg-green-600 hover:bg-green-700 text-white px-6 py-3 rounded-lg font-medium transition-all hover:shadow-lg flex items-center justify-center gap-2"
                >
                  <Phone className="h-4 w-4" />
                  Call Support
                </a>
              </div>
            </div>
          )}
        </div>

        {/* Mobile Filter Drawer */}
        {mobileFiltersOpen && (
          <div className="fixed inset-0 z-50 lg:hidden">
            <div 
              className="absolute inset-0 bg-black/50 backdrop-blur-sm"
              onClick={() => setMobileFiltersOpen(false)}
            />
            <div className="absolute right-0 top-0 h-full w-full max-w-sm bg-white dark:bg-gray-900 shadow-2xl overflow-y-auto">
              <div className="p-6">
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-xl font-bold theme-text">Filters</h2>
                  <button
                    onClick={() => setMobileFiltersOpen(false)}
                    className="p-2 hover:theme-secondary rounded-lg"
                  >
                    <X className="h-5 w-5 theme-text" />
                  </button>
                </div>
                
                <div className="space-y-6">
                  {/* Category Filter */}
                  <div>
                    <h3 className="font-semibold theme-text mb-3 flex items-center gap-2">
                      <Tag className="h-4 w-4" />
                      Category
                    </h3>
                    <select
                      value={selectedCategory}
                      onChange={(e) => setSelectedCategory(e.target.value)}
                      className="w-full theme-surface theme-border border rounded-lg px-4 py-3 theme-text"
                    >
                      {categories.map(category => (
                        <option key={category} value={category}>
                          {category}
                        </option>
                      ))}
                    </select>
                  </div>
                  
                  {/* Price Range */}
                  <div>
                    <h3 className="font-semibold theme-text mb-3 flex items-center gap-2">
                      <Tag className="h-4 w-4" />
                      Price Range (UGX)
                    </h3>
                    <div className="space-y-3">
                      <div>
                        <label className="block text-sm theme-text-muted mb-1">Minimum Price</label>
                        <input
                          type="text"
                          value={priceRange.min}
                          onChange={(e) => handlePriceChange('min', e.target.value)}
                          placeholder="0"
                          className="w-full theme-surface theme-border border rounded-lg px-4 py-2.5 theme-text"
                        />
                      </div>
                      <div>
                        <label className="block text-sm theme-text-muted mb-1">Maximum Price</label>
                        <input
                          type="text"
                          value={priceRange.max}
                          onChange={(e) => handlePriceChange('max', e.target.value)}
                          placeholder="10000000"
                          className="w-full theme-surface theme-border border rounded-lg px-4 py-2.5 theme-text"
                        />
                      </div>
                    </div>
                  </div>
                  
                  {/* Sort Options */}
                  <div>
                    <h3 className="font-semibold theme-text mb-3 flex items-center gap-2">
                      <Filter className="h-4 w-4" />
                      Sort By
                    </h3>
                    <select
                      value={sortBy}
                      onChange={(e) => setSortBy(e.target.value)}
                      className="w-full theme-surface theme-border border rounded-lg px-4 py-3 theme-text"
                    >
                      {sortOptions.map(option => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  
                  {/* Action Buttons */}
                  <div className="pt-4 border-t theme-border">
                    <div className="grid grid-cols-2 gap-3">
                      <button
                        onClick={handleClearSearch}
                        className="px-4 py-3 theme-border border rounded-lg theme-text hover:theme-secondary transition-colors"
                      >
                        Clear All
                      </button>
                      <button
                        onClick={() => {
                          applyFiltersAndSearch(allProducts, searchTerm);
                          setMobileFiltersOpen(false);
                        }}
                        className="px-4 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors"
                      >
                        Apply Filters
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Contact Section */}
        <div className="mt-12 border-t theme-border pt-12">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="theme-surface rounded-2xl p-8 shadow-lg theme-border">
              <div className="grid md:grid-cols-2 gap-8">
                <div>
                  <h3 className="text-2xl font-bold theme-text mb-4">
                    Contact {wholesaler?.name || 'Wholesaler'}
                  </h3>
                  <p className="theme-text-muted mb-6">
                    For bulk orders, custom requirements, or wholesale pricing inquiries, please contact us directly. 
                    We offer competitive prices and free delivery within Kampala for orders above UGX 500,000.
                  </p>
                  
                  <div className="space-y-4">
                    {wholesaler?.phone && (
                      <a 
                        href={`tel:${wholesaler.phone}`}
                        className="flex items-center gap-3 p-3 theme-border border rounded-lg hover:theme-secondary transition-colors group"
                      >
                        <div className="p-2 bg-blue-100 dark:bg-blue-900 rounded-lg group-hover:bg-blue-200 dark:group-hover:bg-blue-800 transition-colors">
                          <Phone className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                        </div>
                        <div>
                          <p className="text-sm theme-text-muted">Phone Number</p>
                          <p className="font-medium theme-text">{wholesaler.phone}</p>
                        </div>
                      </a>
                    )}
                    
                    {wholesaler?.email && (
                      <a 
                        href={`mailto:${wholesaler.email}`}
                        className="flex items-center gap-3 p-3 theme-border border rounded-lg hover:theme-secondary transition-colors group"
                      >
                        <div className="p-2 bg-purple-100 dark:bg-purple-900 rounded-lg group-hover:bg-purple-200 dark:group-hover:bg-purple-800 transition-colors">
                          <Mail className="h-5 w-5 text-purple-600 dark:text-purple-400" />
                        </div>
                        <div>
                          <p className="text-sm theme-text-muted">Email Address</p>
                          <p className="font-medium theme-text">{wholesaler.email}</p>
                        </div>
                      </a>
                    )}
                    
                    <a 
                      href="https://wa.me/256751808507"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-3 p-3 theme-border border rounded-lg hover:bg-green-50 dark:hover:bg-green-900/20 transition-colors group"
                    >
                      <div className="p-2 bg-green-100 dark:bg-green-900 rounded-lg group-hover:bg-green-200 dark:group-hover:bg-green-800 transition-colors">
                        <MessageCircle className="h-5 w-5 text-green-600 dark:text-green-400" />
                      </div>
                      <div>
                        <p className="text-sm theme-text-muted">WhatsApp Business</p>
                        <p className="font-medium theme-text">+256 751 808 507</p>
                      </div>
                    </a>
                  </div>
                </div>
                
                <div>
                  <h4 className="text-xl font-semibold theme-text mb-4">Why Choose Us?</h4>
                  <div className="space-y-4">
                    <div className="flex items-start gap-3">
                      <div className="p-2 bg-blue-100 dark:bg-blue-900 rounded-lg mt-0.5">
                        <Truck className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                      </div>
                      <div>
                        <h5 className="font-medium theme-text mb-1">Fast Delivery</h5>
                        <p className="text-sm theme-text-muted">
                          Same-day delivery in Kampala for orders placed before 3 PM. Nationwide delivery available.
                        </p>
                      </div>
                    </div>
                    
                    <div className="flex items-start gap-3">
                      <div className="p-2 bg-green-100 dark:bg-green-900 rounded-lg mt-0.5">
                        <Shield className="h-5 w-5 text-green-600 dark:text-green-400" />
                      </div>
                      <div>
                        <h5 className="font-medium theme-text mb-1">Quality Assurance</h5>
                        <p className="text-sm theme-text-muted">
                          All products come with manufacturer warranty and quality guarantees.
                        </p>
                      </div>
                    </div>
                    
                    <div className="flex items-start gap-3">
                      <div className="p-2 bg-purple-100 dark:bg-purple-900 rounded-lg mt-0.5">
                        <Award className="h-5 w-5 text-purple-600 dark:text-purple-400" />
                      </div>
                      <div>
                        <h5 className="font-medium theme-text mb-1">Bulk Order Discounts</h5>
                        <p className="text-sm theme-text-muted">
                          Special discounts available for bulk orders and repeat customers.
                        </p>
                      </div>
                    </div>
                    
                    <div className="flex items-start gap-3">
                      <div className="p-2 bg-yellow-100 dark:bg-yellow-900 rounded-lg mt-0.5">
                        <Clock className="h-5 w-5 text-yellow-600 dark:text-yellow-400" />
                      </div>
                      <div>
                        <h5 className="font-medium theme-text mb-1">24/7 Support</h5>
                        <p className="text-sm theme-text-muted">
                          Customer support available round the clock for inquiries and assistance.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default WholesalerProducts;