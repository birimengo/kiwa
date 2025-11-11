import React from 'react';
import { Link } from 'react-router-dom';
import { Smartphone, Laptop, Camera, Headphones } from 'lucide-react';

const Home = () => {
  const categories = [
    { name: 'Smartphones', icon: Smartphone, count: 120 },
    { name: 'Laptops', icon: Laptop, count: 85 },
    { name: 'Cameras', icon: Camera, count: 45 },
    { name: 'Audio', icon: Headphones, count: 67 },
  ];

  return (
    <div className="min-h-screen theme-bg">
      {/* Hero Section */}
      <section className="bg-gradient-to-r from-blue-600 to-blue-800 text-white py-20">
        <div className="max-w-7xl mx-auto px-4 text-center">
          <h1 className="text-5xl font-bold mb-6">Welcome to ElectroShop</h1>
          <p className="text-xl mb-8 max-w-2xl mx-auto">
            Discover the latest electronics with amazing deals. From smartphones to laptops, we have everything you need.
          </p>
          <Link to="/products" className="bg-white text-blue-600 hover:bg-gray-100 text-lg px-8 py-3 rounded-lg font-semibold inline-block">
            Browse All Products →
          </Link>
        </div>
      </section>

      {/* Categories Section */}
      <section className="py-16">
        <div className="max-w-7xl mx-auto px-4">
          <h2 className="text-3xl font-bold text-center mb-12 theme-text">Shop by Category</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {categories.map((category) => (
              <Link
                key={category.name}
                to={`/products?category=${category.name.toLowerCase()}`}
                className="theme-surface rounded-lg shadow-md theme-border border p-6 text-center hover:shadow-lg transition-shadow"
              >
                <category.icon className="h-12 w-12 mx-auto mb-4 theme-primary-text" />
                <h3 className="text-xl font-semibold mb-2 theme-text">{category.name}</h3>
                <p className="theme-text-muted">{category.count} products</p>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="theme-secondary py-16">
        <div className="max-w-7xl mx-auto px-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="text-center">
              <div className="bg-blue-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-2xl">🚚</span>
              </div>
              <h3 className="text-xl font-semibold mb-2 theme-text">Free Shipping</h3>
              <p className="theme-text-muted">Free shipping on orders over $50</p>
            </div>
            <div className="text-center">
              <div className="bg-blue-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-2xl">🔒</span>
              </div>
              <h3 className="text-xl font-semibold mb-2 theme-text">Secure Payment</h3>
              <p className="theme-text-muted">100% secure payment processing</p>
            </div>
            <div className="text-center">
              <div className="bg-blue-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-2xl">📞</span>
              </div>
              <h3 className="text-xl font-semibold mb-2 theme-text">24/7 Support</h3>
              <p className="theme-text-muted">Round the clock customer support</p>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};

export default Home;