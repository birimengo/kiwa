import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useCartStore } from '../stores/cartStore';
import { productsAPI } from '../services/api';
import { Star, Heart, MessageCircle, Phone, ShoppingCart, ArrowLeft } from 'lucide-react';

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
    const url = `https://wa.me/1234567890?text=${encodeURIComponent(message)}`;
    window.open(url, '_blank');
  };

  const handleCall = () => {
    window.open(`tel:1234567890`);
  };

  if (loading) {
    return (
      <div className="min-h-screen theme-bg flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 theme-text-muted">Loading product...</p>
        </div>
      </div>
    );
  }

  if (error || !product) {
    return (
      <div className="min-h-screen theme-bg flex items-center justify-center">
        <div className="text-center">
          <div className="text-6xl mb-4">😕</div>
          <h2 className="text-2xl font-bold theme-text mb-2">Product Not Found</h2>
          <p className="theme-text-muted mb-4">{error || 'The product you\'re looking for doesn\'t exist.'}</p>
          <button
            onClick={() => navigate('/products')}
            className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg transition-colors"
          >
            Back to Products
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen theme-bg">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Back Button */}
        <button
          onClick={() => navigate('/products')}
          className="flex items-center theme-text-muted hover:theme-primary-text mb-6 transition-colors"
        >
          <ArrowLeft className="h-5 w-5 mr-2" />
          Back to Products
        </button>

        <div className="theme-surface rounded-lg shadow-lg theme-border border overflow-hidden">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 p-8">
            {/* Product Images */}
            <div>
              <div className="mb-4">
                <img
                  src={product.images?.[selectedImage] || 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=600'}
                  alt={product.name}
                  className="w-full h-96 object-cover rounded-lg"
                />
              </div>
              <div className="flex gap-2 overflow-x-auto">
                {product.images?.map((image, index) => (
                  <button
                    key={index}
                    onClick={() => setSelectedImage(index)}
                    className={`flex-shrink-0 w-20 h-20 border-2 rounded-lg overflow-hidden ${
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

            {/* Product Info */}
            <div>
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h1 className="text-3xl font-bold theme-text mb-2">{product.name}</h1>
                  <p className="text-lg theme-text-muted mb-2">{product.brand}</p>
                </div>
                <div className="flex flex-col items-center">
                  <button
                    onClick={handleLike}
                    className={`p-2 rounded-full ${
                      isLiked ? 'bg-red-500 text-white' : 'theme-surface theme-text-muted'
                    } hover:scale-110 transition-transform`}
                  >
                    <Heart className={`h-6 w-6 ${isLiked ? 'fill-current' : ''}`} />
                  </button>
                  <span className="text-sm theme-text-muted mt-1">{likeCount}</span>
                </div>
              </div>

              <div className="flex items-center mb-4">
                <div className="flex text-yellow-400 mr-2">
                  {[...Array(5)].map((_, i) => (
                    <Star
                      key={i}
                      className={`h-5 w-5 ${
                        i < Math.floor(product.averageRating || 0) ? 'fill-current' : ''
                      }`}
                    />
                  ))}
                </div>
                <span className="theme-text-muted">
                  {product.averageRating?.toFixed(1) || 0} • {product.comments?.length || 0} reviews
                </span>
              </div>

              {/* Pricing Information */}
              <div className="mb-6">
                <p className="text-3xl font-bold theme-text mb-2">
                  UGX {product.sellingPrice?.toLocaleString()}
                </p>
                {product.purchasePrice && (
                  <p className="text-sm theme-text-muted">
                    Cost: UGX {product.purchasePrice?.toLocaleString()}
                  </p>
                )}
              </div>

              <p className="theme-text leading-relaxed mb-6">{product.description}</p>

              {/* Stock Status */}
              <div className="mb-6">
                <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${
                  product.stock > 0 ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                }`}>
                  {product.stock > 0 ? `${product.stock} in stock` : 'Out of stock'}
                </span>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-wrap gap-3 mb-8">
                <button
                  onClick={handleAddToCart}
                  disabled={!product.stock || product.stock === 0}
                  className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white px-6 py-3 rounded-lg font-semibold transition-colors flex items-center justify-center gap-2"
                >
                  <ShoppingCart className="h-5 w-5" />
                  Add to Cart
                </button>

                <button
                  onClick={handleWhatsApp}
                  className="flex-1 bg-green-500 hover:bg-green-600 text-white px-6 py-3 rounded-lg font-semibold transition-colors flex items-center justify-center gap-2"
                >
                  <MessageCircle className="h-5 w-5" />
                  WhatsApp
                </button>

                <button
                  onClick={handleCall}
                  className="flex-1 bg-blue-500 hover:bg-blue-600 text-white px-6 py-3 rounded-lg font-semibold transition-colors flex items-center justify-center gap-2"
                >
                  <Phone className="h-5 w-5" />
                  Call Now
                </button>
              </div>

              {/* Category */}
              <div className="border-t theme-border pt-6">
                <h3 className="text-lg font-semibold theme-text mb-2">Category</h3>
                <span className="inline-block px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm capitalize">
                  {product.category}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Comments Section */}
        <div id="comments" className="theme-surface rounded-lg shadow-lg theme-border border mt-8 p-8">
          <h3 className="text-2xl font-bold theme-text mb-6">
            Customer Reviews ({product.comments?.length || 0})
          </h3>

          {/* Comment Form */}
          {isLoggedIn ? (
            <form onSubmit={handleCommentSubmit} className="mb-8 p-6 bg-gray-50 dark:bg-gray-800 rounded-lg">
              <h4 className="font-semibold theme-text mb-4">Add Your Review</h4>
              <div className="flex items-center mb-4">
                <span className="mr-3 theme-text">Rating:</span>
                <select
                  value={rating}
                  onChange={(e) => setRating(parseInt(e.target.value))}
                  className="theme-border border rounded px-3 py-1 theme-surface theme-text"
                >
                  {[1, 2, 3, 4, 5].map(num => (
                    <option key={num} value={num}>{num} ★</option>
                  ))}
                </select>
              </div>
              <textarea
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder="Share your thoughts about this product..."
                className="w-full px-3 py-2 theme-border border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent theme-surface theme-text placeholder-theme-text-muted mb-3"
                rows="4"
                required
              />
              <button
                type="submit"
                disabled={!comment.trim()}
                className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white px-6 py-2 rounded-lg transition-colors"
              >
                Submit Review
              </button>
            </form>
          ) : (
            <div className="text-center p-6 bg-gray-50 dark:bg-gray-800 rounded-lg mb-8">
              <p className="theme-text-muted mb-3">Please login to add a review</p>
              <button
                onClick={() => navigate('/login', { state: { from: { pathname: `/products/${id}` } } })}
                className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg transition-colors"
              >
                Login to Comment
              </button>
            </div>
          )}

          {/* Comments List */}
          <div className="space-y-6">
            {product.comments?.map((comment) => (
              <div key={comment._id} className="border-b theme-border pb-6 last:border-b-0">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center">
                    <span className="font-semibold theme-text">{comment.user?.name}</span>
                    <div className="flex text-yellow-400 ml-3">
                      {[...Array(5)].map((_, i) => (
                        <Star
                          key={i}
                          className={`h-4 w-4 ${
                            i < comment.rating ? 'fill-current' : ''
                          }`}
                        />
                      ))}
                    </div>
                  </div>
                  <span className="text-sm theme-text-muted">
                    {new Date(comment.createdAt).toLocaleDateString()}
                  </span>
                </div>
                <p className="theme-text">{comment.text}</p>
              </div>
            ))}

            {(!product.comments || product.comments.length === 0) && (
              <div className="text-center py-8 theme-text-muted">
                No reviews yet. Be the first to review this product!
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProductDetail;