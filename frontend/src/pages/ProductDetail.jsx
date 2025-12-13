import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useCartStore } from '../stores/cartStore';
import { productsAPI } from '../services/api';
import { Star, Heart, MessageCircle, Phone, ShoppingCart, ArrowLeft, ChevronLeft, ChevronRight } from 'lucide-react';
import SEO from '../components/SEO';

const ProductDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user, isLoggedIn, requireAuth } = useAuth();
  const { addItem } = useCartStore();
  
  const [product, setProduct] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedImage, setSelectedImage] = useState(0);
  const [comment, setComment] = useState('');
  const [rating, setRating] = useState(5);
  const [isLiked, setIsLiked] = useState(false);
  const [likeCount, setLikeCount] = useState(0);
  const [error, setError] = useState('');
  const [currentImageIndex, setCurrentImageIndex] = useState(0);

  useEffect(() => {
    fetchProduct();
  }, [id]);

  const fetchProduct = async () => {
    setLoading(true);
    setError('');
    try {
      const response = await productsAPI.getProduct(id);
      const productData = response.data.product;
      setProduct(productData);
      
      // Initialize like state
      if (user && productData.likes) {
        const userLiked = productData.likes.some(like => 
          typeof like === 'object' ? like._id === user.id : like === user.id
        );
        setIsLiked(userLiked);
      }
      setLikeCount(productData.likes?.length || 0);
    } catch (error) {
      console.error('Error fetching product:', error);
      setError('Failed to load product. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleAddToCart = () => {
    if (!requireAuth({ type: 'add_to_cart', productId: id })) {
      navigate('/login', { 
        state: { from: { pathname: `/products/${id}` } } 
      });
      return;
    }
    
    addItem(product, 1);
    
    // Dispatch custom event for cart notification
    const event = new CustomEvent('cart-notification', { 
      detail: { 
        message: `${product.name} added to cart!`,
        product: product,
        action: 'add'
      }
    });
    window.dispatchEvent(event);
  };

  const handleLike = async () => {
    if (!isLoggedIn) {
      navigate('/login', { 
        state: { from: { pathname: `/products/${id}` } } 
      });
      return;
    }

    try {
      const response = await productsAPI.likeProduct(id);
      setIsLiked(response.data.isLiked);
      setLikeCount(response.data.likes);
    } catch (error) {
      console.error('Error liking product:', error);
    }
  };

  const handleCommentSubmit = async (e) => {
    e.preventDefault();
    if (!comment.trim()) return;

    if (!isLoggedIn) {
      requireAuth({ type: 'add_review', productId: id });
      return;
    }

    try {
      await productsAPI.addComment(id, { text: comment, rating });
      setComment('');
      setRating(5);
      fetchProduct(); // Refresh to get updated comments and average rating
    } catch (error) {
      console.error('Error adding comment:', error);
      alert('Failed to add comment. Please try again.');
    }
  };

  const handleWhatsApp = () => {
    const message = `Hi, I'm interested in ${product.name}. Price: UGX ${product.sellingPrice?.toLocaleString()}. Can you provide more details?`;
    const phoneNumber = '+256751808507';
    const url = `https://wa.me/${phoneNumber}?text=${encodeURIComponent(message)}`;
    window.open(url, '_blank');
  };

  const handleCall = () => {
    window.open('tel:+256751808507');
  };

  const nextImage = () => {
    if (product.images && product.images.length > 0) {
      setCurrentImageIndex((prev) => (prev + 1) % product.images.length);
      setSelectedImage((prev) => (prev + 1) % product.images.length);
    }
  };

  const prevImage = () => {
    if (product.images && product.images.length > 0) {
      setCurrentImageIndex((prev) => prev === 0 ? product.images.length - 1 : prev - 1);
      setSelectedImage((prev) => prev === 0 ? product.images.length - 1 : prev - 1);
    }
  };

  const hasMultipleImages = product?.images && product.images.length > 1;

  if (loading) {
    return (
      <div className="min-h-screen theme-bg flex items-center justify-center p-2">
        <div className="text-center">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-2 theme-text-muted text-xs">Loading...</p>
        </div>
      </div>
    );
  }

  if (error || !product) {
    return (
      <div className="min-h-screen theme-bg flex items-center justify-center p-2">
        <div className="text-center">
          <div className="text-4xl mb-2">😕</div>
          <h2 className="text-base font-bold theme-text mb-1">Product Not Found</h2>
          <p className="theme-text-muted text-xs mb-2">{error || 'Product does not exist.'}</p>
          <button
            onClick={() => navigate('/products')}
            className="theme-primary theme-primary-hover text-white px-3 py-1 text-xs rounded transition-colors"
          >
            Back to Products
          </button>
        </div>
      </div>
    );
  }

  // Calculate average rating
  const averageRating = product.averageRating || 0;
  const reviewCount = product.comments?.length || 0;

  return (
    <>
      <SEO
        title={`${product.name} - Electrical Product Uganda | ${product.brand}`}
        description={`Buy ${product.name} at wholesale price UGX ${product.sellingPrice?.toLocaleString()} in Uganda. ${product.description.substring(0, 150)}... ☎️ Call 0751808507 for bulk orders.`}
        keywords={`${product.name} Uganda, ${product.brand}, ${product.category} Uganda, wholesale electrical products`}
        pageType="product"
        productData={product}
      />
      
      <div className="min-h-screen theme-bg">
        {/* Compact Back Button */}
        <div className="sticky top-0 z-10 theme-surface/90 backdrop-blur-sm py-1 border-b theme-border">
          <div className="max-w-7xl mx-auto px-2">
            <button
              onClick={() => navigate('/products')}
              className="flex items-center theme-text-muted hover:theme-primary-text text-xs transition-colors"
            >
              <ArrowLeft className="h-3 w-3 mr-1" />
              Back to Products
            </button>
          </div>
        </div>

        <div className="max-w-7xl mx-auto px-2 sm:px-3 lg:px-4 py-2">
          {/* Main Product Card */}
          <div className="theme-surface rounded-lg shadow theme-border border overflow-hidden">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 p-3">
              {/* Product Images */}
              <div>
                <div className="relative mb-2">
                  <img
                    src={product.images?.[currentImageIndex] || 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=600'}
                    alt={product.name}
                    className="w-full h-48 sm:h-56 object-contain rounded theme-surface"
                    onError={(e) => {
                      e.target.onerror = null;
                      e.target.src = 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=600';
                    }}
                  />
                  
                  {/* Navigation Arrows */}
                  {hasMultipleImages && (
                    <>
                      <button
                        onClick={prevImage}
                        className="absolute left-1 top-1/2 transform -translate-y-1/2 bg-black/70 text-white p-1 rounded-full hover:bg-black/90 transition-all backdrop-blur-sm"
                      >
                        <ChevronLeft className="h-3 w-3" />
                      </button>
                      
                      <button
                        onClick={nextImage}
                        className="absolute right-1 top-1/2 transform -translate-y-1/2 bg-black/70 text-white p-1 rounded-full hover:bg-black/90 transition-all backdrop-blur-sm"
                      >
                        <ChevronRight className="h-3 w-3" />
                      </button>
                      
                      {/* Image Counter */}
                      <div className="absolute top-1 left-1 bg-black/70 text-white text-xs px-1.5 py-0.5 rounded-full font-medium backdrop-blur-sm">
                        {currentImageIndex + 1}/{product.images.length}
                      </div>
                    </>
                  )}
                </div>
                
                {/* Thumbnails */}
                <div className="flex gap-1 overflow-x-auto pb-1">
                  {product.images?.map((image, index) => (
                    <button
                      key={index}
                      onClick={() => {
                        setSelectedImage(index);
                        setCurrentImageIndex(index);
                      }}
                      className={`flex-shrink-0 w-12 h-12 border rounded overflow-hidden transition-all ${
                        selectedImage === index 
                          ? 'border-blue-600 dark:border-blue-400 ring-1 ring-blue-600 dark:ring-blue-400' 
                          : 'theme-border hover:border-blue-400 dark:hover:border-blue-300'
                      }`}
                    >
                      <img
                        src={image}
                        alt={`${product.name} ${index + 1}`}
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          e.target.onerror = null;
                          e.target.src = 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=200';
                        }}
                      />
                    </button>
                  ))}
                </div>
              </div>

              {/* Product Info */}
              <div>
                {/* Header with like button */}
                <div className="flex items-start justify-between mb-2">
                  <div className="flex-1">
                    <h1 className="text-base sm:text-lg font-bold theme-text mb-0.5">{product.name}</h1>
                    <p className="text-xs theme-text-muted mb-1">{product.brand}</p>
                  </div>
                  <div className="flex flex-col items-center ml-2">
                    <button
                      onClick={handleLike}
                      className={`p-1.5 rounded-full transition-all hover:scale-110 ${
                        isLiked 
                          ? 'bg-red-500 text-white' 
                          : 'theme-surface theme-text-muted hover:bg-red-50 dark:hover:bg-red-900/20 hover:text-red-500'
                      }`}
                    >
                      <Heart className={`h-4 w-4 ${isLiked ? 'fill-current' : ''}`} />
                    </button>
                    <span className="text-[10px] theme-text-muted mt-0.5">{likeCount}</span>
                  </div>
                </div>

                {/* Rating */}
                <div className="flex items-center gap-1 mb-2">
                  <div className="flex">
                    {[...Array(5)].map((_, i) => (
                      <Star
                        key={i}
                        className={`h-3 w-3 ${
                          i < Math.floor(averageRating)
                            ? 'text-yellow-400 dark:text-yellow-500 fill-yellow-400 dark:fill-yellow-500'
                            : 'text-gray-300 dark:text-gray-600'
                        }`}
                      />
                    ))}
                  </div>
                  <span className="text-xs theme-text-muted">
                    {averageRating.toFixed(1)} • {reviewCount} review{reviewCount !== 1 ? 's' : ''}
                  </span>
                </div>

                {/* Pricing Information */}
                <div className="mb-3">
                  <p className="text-xl font-bold theme-text mb-0.5">
                    UGX {product.sellingPrice?.toLocaleString()}
                  </p>
                  {product.purchasePrice && (
                    <p className="text-[10px] theme-text-muted">
                      Cost: UGX {product.purchasePrice?.toLocaleString()}
                    </p>
                  )}
                </div>

                {/* Description */}
                <div className="mb-3">
                  <h3 className="text-xs font-semibold theme-text mb-1">Description</h3>
                  <p className="theme-text text-xs leading-relaxed line-clamp-4">{product.description}</p>
                </div>

                {/* Stock Status */}
                <div className="mb-3">
                  <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                    product.stock > 10 
                      ? 'bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-300'
                      : product.stock > 0
                      ? 'bg-yellow-100 dark:bg-yellow-900 text-yellow-800 dark:text-yellow-300'
                      : 'bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-300'
                  }`}>
                    {product.stock > 10 ? 'In Stock' : product.stock > 0 ? 'Low Stock' : 'Out of Stock'} • {product.stock} units
                  </span>
                </div>

                {/* Action Buttons */}
                <div className="flex flex-wrap gap-1.5 mb-3">
                  <button
                    onClick={handleAddToCart}
                    disabled={!product.stock || product.stock === 0}
                    className="flex-1 theme-primary hover:theme-primary-hover disabled:bg-gray-400 dark:disabled:bg-gray-600 disabled:cursor-not-allowed text-white px-2 py-1.5 rounded text-xs font-semibold transition-colors flex items-center justify-center gap-1"
                  >
                    <ShoppingCart className="h-3.5 w-3.5" />
                    Add to Cart
                  </button>

                  <button
                    onClick={handleWhatsApp}
                    className="flex-1 bg-green-600 hover:bg-green-700 text-white px-2 py-1.5 rounded text-xs font-semibold transition-colors flex items-center justify-center gap-1"
                  >
                    <MessageCircle className="h-3.5 w-3.5" />
                    WhatsApp
                  </button>

                  <button
                    onClick={handleCall}
                    className="flex-1 bg-blue-500 hover:bg-blue-600 text-white px-2 py-1.5 rounded text-xs font-semibold transition-colors flex items-center justify-center gap-1"
                  >
                    <Phone className="h-3.5 w-3.5" />
                    Call Now
                  </button>
                </div>

                {/* Product Details */}
                <div className="border-t theme-border pt-2">
                  <h3 className="text-xs font-semibold theme-text mb-1">Product Details</h3>
                  <div className="flex flex-wrap gap-1">
                    <span className="inline-block px-2 py-0.5 bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 rounded-full text-xs capitalize">
                      {product.category || 'Electrical'}
                    </span>
                    {product.createdBy?.name && (
                      <span className="inline-block px-2 py-0.5 bg-purple-100 dark:bg-purple-900 text-purple-800 dark:text-purple-200 rounded-full text-xs">
                        Seller: {product.createdBy.name}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Reviews Section */}
          <div id="reviews" className="theme-surface rounded-lg shadow theme-border border mt-3 p-3">
            <h3 className="text-base font-bold theme-text mb-2">
              Customer Reviews ({reviewCount})
            </h3>

            {/* Review Form */}
            <div className="mb-3 p-3 theme-secondary rounded-lg">
              <h4 className="font-semibold theme-text text-xs mb-2">Add Your Review</h4>
              
              {isLoggedIn ? (
                <form onSubmit={handleCommentSubmit}>
                  {/* Rating Selection */}
                  <div className="flex items-center mb-2">
                    <span className="mr-2 theme-text text-xs">Rating:</span>
                    <div className="flex items-center gap-1">
                      {[1, 2, 3, 4, 5].map(star => (
                        <button
                          key={star}
                          type="button"
                          onClick={() => setRating(star)}
                          className="p-0.5 hover:scale-110 transition-transform"
                        >
                          <Star
                            className={`h-4 w-4 ${
                              star <= rating
                                ? 'text-yellow-400 dark:text-yellow-500 fill-yellow-400 dark:fill-yellow-500'
                                : 'text-gray-300 dark:text-gray-600'
                            }`}
                          />
                        </button>
                      ))}
                      <span className="ml-1 text-xs theme-text">{rating}.0 ★</span>
                    </div>
                  </div>
                  
                  {/* Comment Input */}
                  <div className="mb-2">
                    <textarea
                      value={comment}
                      onChange={(e) => setComment(e.target.value)}
                      placeholder="Share your thoughts about this product..."
                      className="w-full px-3 py-2 text-xs theme-border border rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-transparent theme-surface theme-text placeholder-theme-text-muted"
                      rows="3"
                      required
                    />
                  </div>
                  
                  {/* Submit Button */}
                  <button
                    type="submit"
                    disabled={!comment.trim()}
                    className="theme-primary hover:theme-primary-hover disabled:bg-gray-400 dark:disabled:bg-gray-600 disabled:cursor-not-allowed text-white px-3 py-1.5 text-xs rounded-lg transition-colors"
                  >
                    Submit Review
                  </button>
                </form>
              ) : (
                <div className="text-center p-3 theme-surface rounded-lg">
                  <p className="theme-text-muted text-xs mb-2">Please login to add a review</p>
                  <button
                    onClick={() => navigate('/login', { state: { from: { pathname: `/products/${id}#reviews` } } })}
                    className="theme-primary hover:theme-primary-hover text-white px-3 py-1.5 text-xs rounded-lg transition-colors"
                  >
                    Login to Review
                  </button>
                </div>
              )}
            </div>

            {/* Reviews List */}
            <div className="space-y-3">
              {product.comments?.map((review) => (
                <div key={review._id} className="pb-3 border-b theme-border last:border-b-0 last:pb-0">
                  <div className="flex items-start justify-between mb-1">
                    <div className="flex items-center">
                      <div className="h-6 w-6 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center mr-2">
                        <span className="text-xs font-medium theme-text">
                          {review.user?.name?.charAt(0) || 'U'}
                        </span>
                      </div>
                      <div>
                        <h4 className="font-semibold theme-text text-xs">{review.user?.name || 'Anonymous'}</h4>
                        <div className="flex items-center">
                          <div className="flex mr-1">
                            {[...Array(5)].map((_, i) => (
                              <Star
                                key={i}
                                className={`h-2.5 w-2.5 ${
                                  i < review.rating
                                    ? 'text-yellow-400 dark:text-yellow-500 fill-yellow-400 dark:fill-yellow-500'
                                    : 'text-gray-300 dark:text-gray-600'
                                }`}
                              />
                            ))}
                          </div>
                          <span className="text-[10px] theme-text-muted">
                            {review.rating}.0
                          </span>
                        </div>
                      </div>
                    </div>
                    <span className="text-[10px] theme-text-muted">
                      {new Date(review.createdAt).toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric'
                      })}
                    </span>
                  </div>
                  <p className="theme-text text-xs pl-8">{review.text}</p>
                </div>
              ))}

              {reviewCount === 0 && (
                <div className="text-center py-4">
                  <div className="text-4xl theme-text-muted mb-2">💬</div>
                  <h4 className="text-sm font-medium theme-text mb-1">No Reviews Yet</h4>
                  <p className="theme-text-muted text-xs">
                    Be the first to share your thoughts about this product!
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Related Info Section */}
          <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* Shipping Info */}
            <div className="theme-surface rounded-lg shadow theme-border border p-3">
              <h3 className="text-sm font-semibold theme-text mb-2">Shipping & Delivery</h3>
              <ul className="space-y-1 text-xs theme-text-muted">
                <li className="flex items-center">
                  <div className="w-1 h-1 bg-green-500 rounded-full mr-2"></div>
                  Free delivery in Kampala
                </li>
                <li className="flex items-center">
                  <div className="w-1 h-1 bg-blue-500 rounded-full mr-2"></div>
                  Nationwide delivery available
                </li>
                <li className="flex items-center">
                  <div className="w-1 h-1 bg-purple-500 rounded-full mr-2"></div>
                  Same-day delivery for orders before 3 PM
                </li>
                <li className="flex items-center">
                  <div className="w-1 h-1 bg-yellow-500 rounded-full mr-2"></div>
                  Contact us for bulk order discounts
                </li>
              </ul>
            </div>

            {/* Contact Info */}
            <div className="theme-surface rounded-lg shadow theme-border border p-3">
              <h3 className="text-sm font-semibold theme-text mb-2">Need Help?</h3>
              <div className="space-y-2 text-xs">
                <a 
                  href="tel:+256751808507" 
                  className="flex items-center gap-2 theme-text hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
                >
                  <Phone className="h-3 w-3" />
                  Call: +256 751 808 507
                </a>
                <button
                  onClick={handleWhatsApp}
                  className="flex items-center gap-2 theme-text hover:text-green-600 dark:hover:text-green-400 transition-colors w-full text-left"
                >
                  <MessageCircle className="h-3 w-3" />
                  WhatsApp Chat
                </button>
                <p className="theme-text-muted mt-1">
                  Our team is available 24/7 to assist you with any questions.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Hidden SEO content for crawlers */}
        <div className="hidden" aria-hidden="true">
          <h1>{product.name} - Electrical Product Uganda | {product.brand}</h1>
          <h2>Wholesale Price: UGX {product.sellingPrice?.toLocaleString()} | Category: {product.category}</h2>
          <p>{product.description}</p>
          <p>Call ☎️ 0751808507 to order {product.name} in Uganda. Free delivery in Kampala. Wholesale prices available for bulk orders. Email: gogreenuganda70@gmail.com</p>
          <h3>Product Details:</h3>
          <ul>
            <li>Brand: {product.brand}</li>
            <li>Price: UGX {product.sellingPrice?.toLocaleString()}</li>
            <li>Stock: {product.stock} units available</li>
            <li>Category: {product.category}</li>
            <li>Rating: {averageRating.toFixed(1)} stars</li>
            <li>Reviews: {reviewCount} customer reviews</li>
          </ul>
        </div>
      </div>
    </>
  );
};

export default ProductDetail;