import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useCartStore } from '../../stores/cartStore';
import { productsAPI } from '../../services/api';
import { Heart, MessageCircle, Phone, ShoppingCart, Star, ChevronLeft, ChevronRight } from 'lucide-react';

const ProductCard = ({ product }) => {
  const [isLiked, setIsLiked] = useState(false);
  const [likeCount, setLikeCount] = useState(product.likes?.length || 0);
  const [loading, setLoading] = useState(false);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  
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
    const phoneNumber = '256700000000';
    const url = `https://wa.me/${phoneNumber}?text=${encodeURIComponent(message)}`;
    window.open(url, '_blank');
  };

  const handleCall = (e) => {
    e.preventDefault();
    e.stopPropagation();
    
    const phoneNumber = 'tel:+256700000000';
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

  const hasMultipleImages = product.images && product.images.length > 1;
  const currentImage = product.images?.[currentImageIndex] || 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=400&h=300&fit=crop';

  return (
    <div 
      className="relative rounded-xl overflow-hidden cursor-pointer h-80 transition-all duration-300 hover:shadow-2xl shadow-lg group"
      onClick={handleCardClick}
    >
      {/* Background Image - Clear and Covering Entire Card */}
      <div 
        className="absolute inset-0 bg-cover bg-center transition-transform duration-500 group-hover:scale-105"
        style={{ backgroundImage: `url(${currentImage})` }}
      >
        {/* No overlays - image is completely clear */}
      </div>

      {/* Content Container */}
      <div className="relative z-10 h-full flex flex-col justify-between p-4">
        
        {/* Top Section - Product Info */}
        <div className="flex justify-between items-start">
          {/* Product Name and Brand */}
          <div className="flex-1">
            <h3 className="font-bold text-lg mb-1 line-clamp-2 text-white [text-shadow:_0_1px_2px_rgb(0_0_0_/_80%)]">
              {product.name}
            </h3>
            <p className="text-white [text-shadow:_0_1px_2px_rgb(0_0_0_/_80%)] text-sm font-medium">
              {product.brand}
            </p>
          </div>

          {/* Like Button - Reduced size */}
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

        {/* Rating and Comments */}
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
          
          {/* Like Count */}
          {likeCount > 0 && (
            <span className="bg-blue-600 text-white text-xs px-1.5 py-0.5 rounded-full font-medium shadow-lg [text-shadow:_0_1px_1px_rgb(0_0_0_/_50%)]">
              {likeCount} likes
            </span>
          )}
        </div>

        {/* Middle Section - Price and Stock */}
        <div className="text-center mb-3">
          <p className="text-2xl font-bold mb-1 text-white [text-shadow:_0_2px_4px_rgb(0_0_0_/_90%)]">
            UGX {product.sellingPrice?.toLocaleString()}
          </p>
          
          {/* Stock Status */}
          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold backdrop-blur-sm shadow-lg [text-shadow:_0_1px_1px_rgb(0_0_0_/_50%)] ${
            product.stock > 10 ? 'bg-green-600 text-white' : 
            product.stock > 0 ? 'bg-yellow-600 text-white' : 
            'bg-red-600 text-white'
          }`}>
            {product.stock || 0} in stock
          </span>
        </div>

        {/* Bottom Section - Action Buttons */}
        <div className="space-y-1.5">
          {/* Action Buttons - Reduced size */}
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

          {/* Comments Link - Reduced size */}
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

      {/* Image Navigation Arrows - Reduced size */}
      {hasMultipleImages && (
        <>
          <button
            onClick={prevImage}
            className="absolute left-1 top-1/2 transform -translate-y-1/2 bg-black/70 text-white p-1 rounded-full hover:bg-black/90 transition-all z-20 
                       backdrop-blur-sm shadow-lg
                       /* Mobile: always visible, Desktop: show on hover */
                       opacity-100 md:opacity-0 md:group-hover:opacity-100"
          >
            <ChevronLeft className="h-3 w-3" />
          </button>
          
          <button
            onClick={nextImage}
            className="absolute right-1 top-1/2 transform -translate-y-1/2 bg-black/70 text-white p-1 rounded-full hover:bg-black/90 transition-all z-20 
                       backdrop-blur-sm shadow-lg
                       /* Mobile: always visible, Desktop: show on hover */
                       opacity-100 md:opacity-0 md:group-hover:opacity-100"
          >
            <ChevronRight className="h-3 w-3" />
          </button>
          
          {/* Image Indicators - Reduced size */}
          <div className="absolute bottom-16 left-1/2 transform -translate-x-1/2 flex gap-1 z-20
                         /* Mobile: always visible, Desktop: show on hover */
                         opacity-100 md:opacity-0 md:group-hover:opacity-100">
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

          {/* Image Counter - Reduced size */}
          <div className="absolute top-2 left-2 bg-black/70 text-white text-xs px-1.5 py-0.5 rounded-full font-medium z-20 backdrop-blur-sm shadow-lg
                         /* Mobile: always visible, Desktop: show on hover */
                         opacity-100 md:opacity-0 md:group-hover:opacity-100">
            {currentImageIndex + 1} / {product.images.length}
          </div>
        </>
      )}
    </div>
  );
};

export default ProductCard;