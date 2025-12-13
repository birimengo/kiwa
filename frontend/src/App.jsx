// src/App.jsx
import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import Navbar from './components/layout/Navbar';
import InstallPrompt from './components/InstallPrompt';
import ManualInstall from './components/ManualInstall';
import Products from './pages/Products';
import ProductDetail from './pages/ProductDetail';
import Cart from './pages/Cart';
import Login from './pages/Login';
import Register from './pages/Register';
import Admin from './pages/Admin';
import OrderSuccess from './pages/OrderSuccess';
import MyOrders from './pages/MyOrders';
import AdminOrders from './pages/AdminOrders';
import Wholesalers from './pages/Wholesalers';
// IMPORTANT: Use the correct filename - either rename file or update import
import WholesalerProducts from './pages/WhalesalerProducts'; // If file is named WhalesalerProducts.jsx
// OR if you rename the file to WholesalerProducts.jsx, use:
// import WholesalerProducts from './pages/WholesalerProducts';
import SEO from './components/SEO';
import PrivateRoute from './components/PrivateRoute';

// SIMPLE ROOT REDIRECT WITHOUT useAuth
const RootRedirect = () => {
  const userData = localStorage.getItem('user');
  
  if (userData) {
    try {
      const user = JSON.parse(userData);
      if (user.role === 'admin') {
        return <Navigate to="/admin" replace />;
      }
    } catch (error) {
      console.error('Error parsing user data:', error);
    }
  }
  
  return <Navigate to="/products" replace />;
};

function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <Router>
          {/* GLOBAL DEFAULT SEO - WORKS FOR ALL PAGES */}
          <SEO
            title="Kiwa General Electricals - Electrical & Electronics Uganda"
            description="Uganda's leading electrical wholesale & retail store. ☎️ 0751808507 | gogreenuganda70@gmail.com"
            keywords="electrical Uganda, electronics Kampala, wholesale electricals, generators, solar systems"
          />
          
          <div className="min-h-screen theme-bg flex flex-col">
            <Navbar />
            <main className="flex-grow">
              <Routes>
                {/* ROOT PATH - INITIAL REDIRECT */}
                <Route path="/" element={<RootRedirect />} />
                
                {/* PUBLIC ROUTES */}
                <Route path="/products" element={<Products />} />
                <Route path="/products/:id" element={<ProductDetail />} />
                <Route path="/login" element={<Login />} />
                <Route path="/register" element={<Register />} />
                
                {/* PROTECTED ROUTES FOR ALL LOGGED-IN USERS */}
                <Route 
                  path="/cart" 
                  element={
                    <PrivateRoute>
                      <Cart />
                    </PrivateRoute>
                  } 
                />
                <Route 
                  path="/my-orders" 
                  element={
                    <PrivateRoute>
                      <MyOrders />
                    </PrivateRoute>
                  } 
                />
                <Route 
                  path="/order-success" 
                  element={
                    <PrivateRoute>
                      <OrderSuccess />
                    </PrivateRoute>
                  } 
                />
                
                {/* WHOLESALERS ROUTES */}
                <Route 
                  path="/wholesalers" 
                  element={
                    <PrivateRoute>
                      <Wholesalers />
                    </PrivateRoute>
                  } 
                />
                
                {/* WHOLESALER PRODUCTS ROUTE - FIXED PATH */}
                <Route 
                  path="/wholesaler/:id/products" 
                  element={
                    <PrivateRoute>
                      <WholesalerProducts />
                    </PrivateRoute>
                  } 
                />
                
                {/* ADMIN ROUTES */}
                <Route 
                  path="/admin" 
                  element={
                    <PrivateRoute requireAdmin>
                      <Admin />
                    </PrivateRoute>
                  } 
                />
                <Route 
                  path="/admin/orders" 
                  element={
                    <PrivateRoute requireAdmin>
                      <AdminOrders />
                    </PrivateRoute>
                  } 
                />
                
                {/* 404 NOT FOUND ROUTE - OPTIONAL */}
                <Route 
                  path="*" 
                  element={
                    <div className="min-h-screen theme-bg flex items-center justify-center">
                      <div className="text-center">
                        <h1 className="text-4xl font-bold theme-text mb-4">404</h1>
                        <p className="theme-text-muted mb-6">Page not found</p>
                        <a 
                          href="/products" 
                          className="theme-primary theme-primary-hover text-white px-6 py-3 rounded-lg text-sm font-medium transition-colors"
                        >
                          Go to Products
                        </a>
                      </div>
                    </div>
                  } 
                />
              </Routes>
            </main>
            {/* INSTALL PROMPT COMPONENTS */}
            <InstallPrompt />
            <ManualInstall />
          </div>
        </Router>
      </AuthProvider>
    </ThemeProvider>
  );
}

export default App;