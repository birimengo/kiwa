import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import Navbar from './components/layout/Navbar';
import InstallPrompt from './components/InstallPrompt';
import ManualInstall from './components/ManualInstall'; // ADD THIS IMPORT
import Products from './pages/Products';
import ProductDetail from './pages/ProductDetail';
import Cart from './pages/Cart';
import Login from './pages/Login';
import Register from './pages/Register';
import Admin from './pages/Admin';
import OrderSuccess from './pages/OrderSuccess';
import MyOrders from './pages/MyOrders';
import AdminOrders from './pages/AdminOrders';

function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <Router>
          <div className="min-h-screen theme-bg flex flex-col">
            <Navbar />
            <main className="flex-grow">
              <Routes>
                <Route path="/" element={<Navigate to="/products" replace />} />
                <Route path="/products" element={<Products />} />
                <Route path="/products/:id" element={<ProductDetail />} />
                <Route path="/cart" element={<Cart />} />
                <Route path="/login" element={<Login />} />
                <Route path="/register" element={<Register />} />
                <Route path="/admin" element={<Admin />} />
                <Route path="/order-success" element={<OrderSuccess />} />
                <Route path="/my-orders" element={<MyOrders />} />
                <Route path="/admin/orders" element={<AdminOrders />} />
              </Routes>
            </main>
            {/* INSTALL PROMPT COMPONENTS */}
            <InstallPrompt />
            <ManualInstall /> {/* ADD THIS COMPONENT */}
          </div>
        </Router>
      </AuthProvider>
    </ThemeProvider>
  );
}

export default App;