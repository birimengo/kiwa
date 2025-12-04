import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useCartStore } from '../stores/cartStore';
import { productsAPI } from '../services/api';
import { Star, Heart, MessageCircle, Phone, ShoppingCart, ArrowLeft, ChevronLeft, ChevronRight } from 'lucide-react';
import SEO from '../components/SEO'; // ADD SEO IMPORT

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
    alert('Product added to cart!');
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
      alert('Please login to comment');
      navigate('/login', { 
        state: { from: { pathname: `/products/${id}` } } 
      });
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
            className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1 text-xs rounded transition-colors"
          >
            Back to Products
          </button>
        </div>
      </div>
    );
  }

  return (
    <>
      {/* SEO COMPONENT */}
      <SEO
        title={`${product.name} - Electrical Product Uganda | ${product.brand}`}
        description={`Buy ${product.name} at wholesale price UGX ${product.sellingPrice?.toLocaleString()} in Uganda. ${product.description.substring(0, 150)}... ☎️ Call 0751808507 for bulk orders.`}
        keywords={`${product.name} Uganda, ${product.brand}, ${product.category} Uganda, wholesale electrical products`}
        pageType="product"
        productData={product}
      />
      
      <div className="min-h-screen theme-bg">
        {/* Compact Back Button */}
        <div className="sticky top-0 z-10 bg-white/90 dark:bg-gray-900/90 backdrop-blur-sm py-1 border-b theme-border">
          <div className="max-w-7xl mx-auto px-2">
            <button
              onClick={() => navigate('/products')}
              className="flex items-center theme-text-muted hover:theme-primary-text text-xs transition-colors"
            >
              <ArrowLeft className="h-3 w-3 mr-1" />
              Back
            </button>
          </div>
        </div>

        <div className="max-w-7xl mx-auto px-2 sm:px-3 lg:px-4 py-2">
          <div className="theme-surface rounded-lg shadow theme-border border overflow-hidden">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 p-3">
              {/* Product Images - Compact */}
              <div>
                <div className="relative mb-2">
                  <img
                    src={product.images?.[currentImageIndex] || 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=600'}
                    alt={product.name}
                    className="w-full h-48 sm:h-56 object-contain rounded bg-white"
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
                <div className="flex gap-1 overflow-x-auto">
                  {product.images?.map((image, index) => (
                    <button
                      key={index}
                      onClick={() => {
                        setSelectedImage(index);
                        setCurrentImageIndex(index);
                      }}
                      className={`flex-shrink-0 w-12 h-12 border rounded overflow-hidden ${
                        selectedImage === index ? 'border-blue-600' : 'theme-border'
                      }`}
                    >
                      <img
                        src={image}
                        alt={`${product.name} ${index + 1}`}
                        className="w-full h-full object-cover"
                      />
                    </button>
                  ))}
                </div>
              </div>

              {/* Product Info - Compact */}
              <div>
                {/* Header with like button */}
                <div className="flex items-start justify-between mb-2">
                  <div className="flex-1">
                    <h1 className="text-base sm:text-lg font-bold theme-text mb-0.5">{product.name}</h1>
                    <p className="text-xs theme-text-muted mb-1">{product.brand}</p>
                  </div>
                  <div className="flex flex-col items-center">
                    <button
                      onClick={handleLike}
                      className={`p-1 rounded-full ${
                        isLiked ? 'bg-red-500 text-white' : 'theme-surface theme-text-muted'
                      } hover:scale-110 transition-transform`}
                    >
                      <Heart className={`h-4 w-4 ${isLiked ? 'fill-current' : ''}`} />
                    </button>
                    <span className="text-[10px] theme-text-muted mt-0.5">{likeCount}</span>
                  </div>
                </div>

                {/* Rating - Compact */}
                <div className="flex items-center mb-2">
                  <div className="flex text-yellow-400 mr-1">
                    {[...Array(5)].map((_, i) => (
                      <Star
                        key={i}
                        className={`h-3 w-3 ${
                          i < Math.floor(product.averageRating || 0) ? 'fill-current' : ''
                        }`}
                      />
                    ))}
                  </div>
                  <span className="text-xs theme-text-muted">
                    {product.averageRating?.toFixed(1) || 0} • {product.comments?.length || 0} reviews
                  </span>
                </div>

                {/* Pricing Information - Compact */}
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

                {/* Description - Compact */}
                <p className="theme-text text-xs leading-relaxed mb-3 line-clamp-4">{product.description}</p>

                {/* Stock Status - Compact */}
                <div className="mb-3">
                  <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                    product.stock > 0 ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                  }`}>
                    {product.stock > 0 ? `${product.stock} in stock` : 'Out of stock'}
                  </span>
                </div>

                {/* Action Buttons - Compact */}
                <div className="flex flex-wrap gap-1.5 mb-3">
                  <button
                    onClick={handleAddToCart}
                    disabled={!product.stock || product.stock === 0}
                    className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white px-2 py-1.5 rounded text-xs font-semibold transition-colors flex items-center justify-center gap-1"
                  >
                    <ShoppingCart className="h-3.5 w-3.5" />
                    Add to Cart
                  </button>

                  <button
                    onClick={handleWhatsApp}
                    className="flex-1 bg-green-500 hover:bg-green-600 text-white px-2 py-1.5 rounded text-xs font-semibold transition-colors flex items-center justify-center gap-1"
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

                {/* Category - Compact */}
                <div className="border-t theme-border pt-2">
                  <h3 className="text-xs font-semibold theme-text mb-1">Category</h3>
                  <span className="inline-block px-2 py-0.5 bg-blue-100 text-blue-800 rounded-full text-xs capitalize">
                    {product.category}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Comments Section - Compact */}
          <div id="comments" className="theme-surface rounded-lg shadow theme-border border mt-3 p-3">
            <h3 className="text-base font-bold theme-text mb-2">
              Reviews ({product.comments?.length || 0})
            </h3>

            {/* Comment Form - Compact */}
            {isLoggedIn ? (
              <form onSubmit={handleCommentSubmit} className="mb-3 p-2 bg-gray-50 dark:bg-gray-800 rounded">
                <h4 className="font-semibold theme-text text-xs mb-1">Add Review</h4>
                <div className="flex items-center mb-1.5">
                  <span className="mr-2 theme-text text-xs">Rating:</span>
                  <select
                    value={rating}
                    onChange={(e) => setRating(parseInt(e.target.value))}
                    className="theme-border border rounded px-1.5 py-0.5 text-xs theme-surface theme-text"
                  >
                    {[1, 2, 3, 4, 5].map(num => (
                      <option key={num} value={num}>{num} ★</option>
                    ))}
                  </select>
                </div>
                <textarea
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  placeholder="Share your thoughts..."
                  className="w-full px-2 py-1 text-xs theme-border border rounded focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-transparent theme-surface theme-text placeholder-theme-text-muted mb-2"
                  rows="3"
                  required
                />
                <button
                  type="submit"
                  disabled={!comment.trim()}
                  className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white px-3 py-1 text-xs rounded transition-colors"
                >
                  Submit Review
                </button>
              </form>
            ) : (
              <div className="text-center p-2 bg-gray-50 dark:bg-gray-800 rounded mb-2">
                <p className="theme-text-muted text-xs mb-1">Login to add review</p>
                <button
                  onClick={() => navigate('/login', { state: { from: { pathname: `/products/${id}` } } })}
                  className="bg-blue-600 hover:bg-blue-700 text-white px-2 py-0.5 text-xs rounded transition-colors"
                >
                  Login
                </button>
              </div>
            )}

            {/* Comments List - Compact */}
            <div className="space-y-2">
              {product.comments?.map((comment) => (
                <div key={comment._id} className="border-b theme-border pb-2 last:border-b-0">
                  <div className="flex items-center justify-between mb-0.5">
                    <div className="flex items-center">
                      <span className="font-semibold theme-text text-xs">{comment.user?.name}</span>
                      <div className="flex text-yellow-400 ml-1.5">
                        {[...Array(5)].map((_, i) => (
                          <Star
                            key={i}
                            className={`h-2.5 w-2.5 ${
                              i < comment.rating ? 'fill-current' : ''
                            }`}
                          />
                        ))}
                      </div>
                    </div>
                    <span className="text-[10px] theme-text-muted">
                      {new Date(comment.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                  <p className="theme-text text-xs">{comment.text}</p>
                </div>
              ))}

              {(!product.comments || product.comments.length === 0) && (
                <div className="text-center py-3 theme-text-muted text-xs">
                  No reviews yet. Be the first!
                </div>
              )}
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
            <li>Rating: {product.averageRating?.toFixed(1) || 0} stars</li>
            <li>Reviews: {product.comments?.length || 0} customer reviews</li>
          </ul>
        </div>
      </div>
    </>
  );
};

export default ProductDetail;