import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useCartStore } from '../../stores/cartStore';
import { productsAPI } from '../../services/api';
import { 
  Heart, 
  MessageCircle, 
  Phone, 
  ShoppingCart, 
  Star, 
  ChevronLeft, 
  ChevronRight,
  Filter,
  X,
  SlidersHorizontal
} from 'lucide-react';

const ProductCard = ({ product }) => {
  const [isLiked, setIsLiked] = useState(false);
  const [likeCount, setLikeCount] = useState(product.likes?.length || 0);
  const [loading, setLoading] = useState(false);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [showFilters, setShowFilters] = useState(false);
  const [selectedFilters, setSelectedFilters] = useState({
    category: '',
    brand: '',
    priceRange: '',
    inStock: false
  });
  
  const filterRef = useRef(null);
  const { user, isLoggedIn, requireAuth } = useAuth();
  const { addItem } = useCartStore();
  const navigate = useNavigate();

  // Initialize like state based on current user
  useEffect(() => {
    if (user && product.likes) {
      const userLiked = product.likes.some(like => 
        typeof like === 'object' ? like._id === user.id : like === user.id
      );
      setIsLiked(userLiked);
    }
    setLikeCount(product.likes?.length || 0);
  }, [product.likes, user]);

  // Close filters when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (filterRef.current && !filterRef.current.contains(event.target)) {
        setShowFilters(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleLike = async (e) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (!isLoggedIn) {
      navigate('/login', { 
        state: { from: { pathname: '/products' } } 
      });
      return;
    }

    setLoading(true);
    try {
      const response = await productsAPI.likeProduct(product._id);
      setIsLiked(response.data.isLiked);
      setLikeCount(response.data.likes);
    } catch (error) {
      console.error('Error liking product:', error);
      setIsLiked(!isLiked);
    } finally {
      setLoading(false);
    }
  };

  const handleAddToCart = (e) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (!requireAuth({ type: 'add_to_cart', productId: product._id })) {
      navigate('/login', { 
        state: { from: { pathname: '/products' } } 
      });
      return;
    }
    
    addItem(product, 1);
    alert(`${product.name} added to cart!`);
  };

  const handleWhatsApp = (e) => {
    e.preventDefault();
    e.stopPropagation();
    
    const message = `Hi, I'm interested in ${product.name}. Price: UGX ${product.sellingPrice?.toLocaleString()}. Can you provide more details?`;
    const phoneNumber = '+256751808507';
    const url = `https://wa.me/${phoneNumber}?text=${encodeURIComponent(message)}`;
    window.open(url, '_blank');
  };

  const handleCall = (e) => {
    e.preventDefault();
    e.stopPropagation();
    
    const phoneNumber = 'tel:+256751808507';
    window.location.href = phoneNumber;
  };

  const handleCommentClick = (e) => {
    e.preventDefault();
    e.stopPropagation();
    navigate(`/products/${product._id}#comments`);
  };

  const nextImage = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (product.images && product.images.length > 0) {
      setCurrentImageIndex((prev) => (prev + 1) % product.images.length);
    }
  };

  const prevImage = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (product.images && product.images.length > 0) {
      setCurrentImageIndex((prev) => prev === 0 ? product.images.length - 1 : prev - 1);
    }
  };

  const handleCardClick = () => {
    navigate(`/products/${product._id}`);
  };

  const toggleFilters = (e) => {
    e.stopPropagation();
    setShowFilters(!showFilters);
  };

  const handleFilterChange = (filterType, value) => {
    setSelectedFilters(prev => ({
      ...prev,
      [filterType]: value
    }));
  };

  const clearFilters = () => {
    setSelectedFilters({
      category: '',
      brand: '',
      priceRange: '',
      inStock: false
    });
  };

  const applyFilters = () => {
    // Here you would typically trigger a filter action or API call
    console.log('Applying filters:', selectedFilters);
    setShowFilters(false);
  };

  const hasMultipleImages = product.images && product.images.length > 1;
  const currentImage = product.images?.[currentImageIndex] || 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=400&h=300&fit=crop';

  return (
    <div className="relative">
      {/* Filter Button - Mobile & Desktop */}
      <div className="mb-4 flex justify-between items-center">
        <h2 className="text-lg font-semibold text-gray-800">Products</h2>
        <button
          onClick={toggleFilters}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors shadow-md"
        >
          <Filter className="h-4 w-4" />
          <span className="hidden sm:inline">Filters</span>
          <SlidersHorizontal className="h-4 w-4 sm:hidden" />
        </button>
      </div>

      {/* Filter Dropdown */}
      {showFilters && (
        <div 
          ref={filterRef}
          className="absolute top-12 right-0 z-50 w-full sm:w-80 bg-white rounded-xl shadow-2xl border border-gray-200 p-4 animate-slideDown"
        >
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-bold text-gray-800">Filter Products</h3>
            <button
              onClick={() => setShowFilters(false)}
              className="p-1 hover:bg-gray-100 rounded-full transition-colors"
            >
              <X className="h-5 w-5 text-gray-600" />
            </button>
          </div>

          {/* Category Filter */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Category
            </label>
            <select
              value={selectedFilters.category}
              onChange={(e) => handleFilterChange('category', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
            >
              <option value="">All Categories</option>
              <option value="electronics">Electronics</option>
              <option value="clothing">Clothing</option>
              <option value="home">Home & Garden</option>
              <option value="sports">Sports</option>
            </select>
          </div>

          {/* Brand Filter */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Brand
            </label>
            <select
              value={selectedFilters.brand}
              onChange={(e) => handleFilterChange('brand', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
            >
              <option value="">All Brands</option>
              <option value="apple">Apple</option>
              <option value="samsung">Samsung</option>
              <option value="nike">Nike</option>
              <option value="adidas">Adidas</option>
            </select>
          </div>

          {/* Price Range Filter */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Price Range
            </label>
            <select
              value={selectedFilters.priceRange}
              onChange={(e) => handleFilterChange('priceRange', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
            >
              <option value="">All Prices</option>
              <option value="0-10000">Under UGX 10,000</option>
              <option value="10000-50000">UGX 10,000 - 50,000</option>
              <option value="50000-100000">UGX 50,000 - 100,000</option>
              <option value="100000+">Over UGX 100,000</option>
            </select>
          </div>

          {/* In Stock Filter */}
          <div className="flex items-center mb-6">
            <input
              type="checkbox"
              id="inStock"
              checked={selectedFilters.inStock}
              onChange={(e) => handleFilterChange('inStock', e.target.checked)}
              className="h-4 w-4 text-blue-600 rounded focus:ring-blue-500 border-gray-300"
            />
            <label htmlFor="inStock" className="ml-2 text-sm text-gray-700">
              In Stock Only
            </label>
          </div>

          {/* Filter Actions */}
          <div className="flex gap-2">
            <button
              onClick={clearFilters}
              className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors text-sm font-medium"
            >
              Clear All
            </button>
            <button
              onClick={applyFilters}
              className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
            >
              Apply Filters
            </button>
          </div>
        </div>
      )}

      {/* Product Card */}
      <div 
        className="relative rounded-xl overflow-hidden cursor-pointer h-80 transition-all duration-300 hover:shadow-2xl shadow-lg group bg-gray-100"
        onClick={handleCardClick}
      >
        {/* Image Container */}
        <div className="absolute inset-0 flex items-center justify-center">
          <img 
            src={currentImage} 
            alt={product.name}
            className="w-full h-full object-contain bg-white"
            onError={(e) => {
              e.target.onerror = null;
              e.target.src = 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=400&h=300&fit=crop';
            }}
          />
        </div>

        <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent pointer-events-none"></div>

        {/* Content Container */}
        <div className="relative z-10 h-full flex flex-col justify-between p-4">
          
          {/* Top Section */}
          <div className="flex justify-between items-start">
            <div className="flex-1">
              <h3 className="font-bold text-lg mb-1 line-clamp-2 text-white [text-shadow:_0_1px_2px_rgb(0_0_0_/_80%)]">
                {product.name}
              </h3>
              <p className="text-white [text-shadow:_0_1px_2px_rgb(0_0_0_/_80%)] text-sm font-medium">
                {product.brand}
              </p>
            </div>

            <button
              onClick={handleLike}
              disabled={loading}
              className={`p-1.5 rounded-full backdrop-blur-sm transition-all ${
                isLiked 
                  ? 'bg-red-500 text-white shadow-lg' 
                  : 'bg-black/30 text-white hover:bg-black/50'
              } hover:scale-110 shadow-lg`}
            >
              <Heart className={`h-3.5 w-3.5 ${isLiked ? 'fill-current' : ''}`} />
            </button>
          </div>

          {/* Rating and Likes */}
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-1">
              <div className="flex [&_svg]:[filter:drop-shadow(0_1px_2px_rgb(0_0_0_/_80%))]">
                {[...Array(5)].map((_, i) => (
                  <Star
                    key={i}
                    className={`h-3 w-3 text-yellow-400 ${
                      i < Math.floor(product.averageRating || 0) ? 'fill-current' : ''
                    }`}
                  />
                ))}
              </div>
              <span className="text-white [text-shadow:_0_1px_2px_rgb(0_0_0_/_80%)] text-xs font-medium">
                ({product.comments?.length || 0})
              </span>
            </div>
            
            {likeCount > 0 && (
              <span className="bg-blue-600 text-white text-xs px-1.5 py-0.5 rounded-full font-medium shadow-lg [text-shadow:_0_1px_1px_rgb(0_0_0_/_50%)]">
                {likeCount} likes
              </span>
            )}
          </div>

          {/* Middle Section */}
          <div className="text-center mb-3">
            <p className="text-2xl font-bold mb-1 text-white [text-shadow:_0_2px_4px_rgb(0_0_0_/_90%)]">
              UGX {product.sellingPrice?.toLocaleString()}
            </p>
            
            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold backdrop-blur-sm shadow-lg [text-shadow:_0_1px_1px_rgb(0_0_0_/_50%)] ${
              product.stock > 10 ? 'bg-green-600 text-white' : 
              product.stock > 0 ? 'bg-yellow-600 text-white' : 
              'bg-red-600 text-white'
            }`}>
              {product.stock || 0} in stock
            </span>
          </div>

          {/* Bottom Section */}
          <div className="space-y-1.5">
            <div className="grid grid-cols-3 gap-1.5">
              <button
                onClick={handleAddToCart}
                disabled={!product.stock || product.stock === 0}
                className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 text-white px-1.5 py-1.5 rounded-lg text-xs font-semibold transition-all hover:scale-105 backdrop-blur-sm flex items-center justify-center gap-0.5 shadow-lg [text-shadow:_0_1px_1px_rgb(0_0_0_/_50%)]"
              >
                <ShoppingCart className="h-3.5 w-3.5" />
                <span>Cart</span>
              </button>

              <button
                onClick={handleWhatsApp}
                className="bg-green-600 hover:bg-green-700 text-white px-1.5 py-1.5 rounded-lg text-xs font-semibold transition-all hover:scale-105 backdrop-blur-sm flex items-center justify-center gap-0.5 shadow-lg [text-shadow:_0_1px_1px_rgb(0_0_0_/_50%)]"
              >
                <MessageCircle className="h-3.5 w-3.5" />
                <span>Chat</span>
              </button>

              <button
                onClick={handleCall}
                className="bg-purple-600 hover:bg-purple-700 text-white px-1.5 py-1.5 rounded-lg text-xs font-semibold transition-all hover:scale-105 backdrop-blur-sm flex items-center justify-center gap-0.5 shadow-lg [text-shadow:_0_1px_1px_rgb(0_0_0_/_50%)]"
              >
                <Phone className="h-3.5 w-3.5" />
                <span>Call</span>
              </button>
            </div>

            {product.comments && product.comments.length > 0 && (
              <button
                onClick={handleCommentClick}
                className="w-full bg-black/30 hover:bg-black/50 text-white text-xs font-medium py-1.5 rounded-lg transition-all backdrop-blur-sm flex items-center justify-center gap-1 shadow-lg hover:scale-105 [text-shadow:_0_1px_1px_rgb(0_0_0_/_50%)]"
              >
                <MessageCircle className="h-3 w-3" />
                <span>View {product.comments.length} Comments</span>
              </button>
            )}
          </div>
        </div>

        {/* Image Navigation */}
        {hasMultipleImages && (
          <>
            <button
              onClick={prevImage}
              className="absolute left-1 top-1/2 transform -translate-y-1/2 bg-black/70 text-white p-1 rounded-full hover:bg-black/90 transition-all z-20 
                         backdrop-blur-sm shadow-lg opacity-100 md:opacity-0 md:group-hover:opacity-100"
            >
              <ChevronLeft className="h-3 w-3" />
            </button>
            
            <button
              onClick={nextImage}
              className="absolute right-1 top-1/2 transform -translate-y-1/2 bg-black/70 text-white p-1 rounded-full hover:bg-black/90 transition-all z-20 
                         backdrop-blur-sm shadow-lg opacity-100 md:opacity-0 md:group-hover:opacity-100"
            >
              <ChevronRight className="h-3 w-3" />
            </button>
            
            <div className="absolute bottom-16 left-1/2 transform -translate-x-1/2 flex gap-1 z-20 opacity-100 md:opacity-0 md:group-hover:opacity-100">
              {product.images.map((_, index) => (
                <button
                  key={index}
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setCurrentImageIndex(index);
                  }}
                  className={`w-1.5 h-1.5 rounded-full transition-all shadow-lg ${
                    index === currentImageIndex
                      ? 'bg-white scale-125'
                      : 'bg-white/70 hover:bg-white'
                  }`}
                />
              ))}
            </div>

            <div className="absolute top-2 left-2 bg-black/70 text-white text-xs px-1.5 py-0.5 rounded-full font-medium z-20 backdrop-blur-sm shadow-lg opacity-100 md:opacity-0 md:group-hover:opacity-100">
              {currentImageIndex + 1} / {product.images.length}
            </div>
          </>
        )}
      </div>

      {/* Add CSS for animation */}
      <style jsx>{`
        @keyframes slideDown {
          from {
            opacity: 0;
            transform: translateY(-10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        .animate-slideDown {
          animation: slideDown 0.2s ease-out;
        }
      `}</style>
    </div>
  );
};

export default ProductCard;