import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { ShoppingCart, Menu, X, Package, Users, User, Download } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useCartStore } from '../../stores/cartStore';
import { useTheme } from '../../context/ThemeContext';
import ThemeSelector from './ThemeSelector';

const Navbar = () => {
  const { user, logout } = useAuth();
  const { getTotalItems } = useCartStore();
  const { currentTheme } = useTheme();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isProfileDropdownOpen, setIsProfileDropdownOpen] = useState(false);
  const [adminInput, setAdminInput] = useState('');
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  // Install PWA functionality
  useEffect(() => {
    const handleBeforeInstallPrompt = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };

    const handleAppInstalled = () => {
      setIsInstalled(true);
      setDeferredPrompt(null);
    };

    // Check if app is already installed
    if (window.matchMedia('(display-mode: standalone)').matches) {
      setIsInstalled(true);
    }

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;
    
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    
    if (outcome === 'accepted') {
      setDeferredPrompt(null);
      setIsInstalled(true);
    }
    setIsMenuOpen(false);
  };

  const handleLogout = () => {
    logout();
    navigate('/');
    setIsMenuOpen(false);
    setIsProfileDropdownOpen(false);
  };

  const closeMobileMenu = () => {
    setIsMenuOpen(false);
  };

  const toggleProfileDropdown = () => {
    setIsProfileDropdownOpen(!isProfileDropdownOpen);
    setAdminInput('');
  };

  const closeProfileDropdown = () => {
    setIsProfileDropdownOpen(false);
    setAdminInput('');
  };

  const handleAdminInputChange = (e) => {
    setAdminInput(e.target.value);
  };

  const handleAdminInputKeyPress = (e) => {
    if (e.key === 'Enter') {
      if (adminInput.trim().toLowerCase() === 'admin') {
        navigate('/admin');
        setIsProfileDropdownOpen(false);
        setAdminInput('');
        setIsMenuOpen(false);
      }
    }
  };

  // Double click handler for profile icon
  const handleProfileDoubleClick = () => {
    setIsProfileDropdownOpen(true);
    setAdminInput('');
  };

  return (
    <nav className="theme-surface shadow-lg sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-14">
          {/* Logo */}
          <Link 
            to="/products" 
            className="flex items-center space-x-2 flex-shrink-0"
            onClick={closeMobileMenu}
          >
            {/* SVG Logo */}
            <div className="w-8 h-8 flex items-center justify-center">
              <img 
                src="/trade-svgrepo-com.svg" 
                alt="ElectroShop Logo" 
                className="w-6 h-6 theme-primary-filter"
              />
            </div>
            <span className="text-lg font-bold theme-text">
              ElectroShop
            </span>
          </Link>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center space-x-6">
            <Link 
              to="/products" 
              className={`transition-colors font-medium text-sm ${
                location.pathname === '/products' 
                  ? 'theme-primary-text font-semibold' 
                  : 'theme-text-muted hover:theme-primary-text'
              }`}
            >
              Products
            </Link>
            
            {/* My Orders Link - Only show for regular users (not admin) */}
            {user && user.role !== 'admin' && (
              <Link 
                to="/my-orders" 
                className={`transition-colors font-medium text-sm ${
                  location.pathname === '/my-orders' 
                    ? 'theme-primary-text font-semibold' 
                    : 'theme-text-muted hover:theme-primary-text'
                }`}
              >
                My Orders
              </Link>
            )}
            
            {/* Admin Orders Link - Only show for admin users */}
            {user?.role === 'admin' && (
              <Link 
                to="/admin/orders" 
                className={`transition-colors font-medium text-sm ${
                  location.pathname === '/admin/orders' 
                    ? 'theme-primary-text font-semibold' 
                    : 'theme-text-muted hover:theme-primary-text'
                }`}
              >
                Manage Orders
              </Link>
            )}
            
            {user?.role === 'admin' && (
              <Link 
                to="/admin" 
                className={`transition-colors font-medium text-sm ${
                  location.pathname.startsWith('/admin') && location.pathname !== '/admin/orders'
                    ? 'theme-primary-text font-semibold' 
                    : 'theme-text-muted hover:theme-primary-text'
                }`}
              >
                Admin Dashboard
              </Link>
            )}

            <ThemeSelector />
            
            {/* Install App Button - Desktop */}
            {deferredPrompt && !isInstalled && (
              <button
                onClick={handleInstall}
                className="flex items-center space-x-2 bg-green-600 text-white px-3 py-1.5 rounded-lg text-sm font-medium hover:bg-green-700 transition-colors"
                title="Install ElectroShop App"
              >
                <Download className="h-4 w-4" />
                <span>Install App</span>
              </button>
            )}
            
            {/* Cart - Only show for regular users (not admin) */}
            {user?.role !== 'admin' && (
              <Link 
                to="/cart" 
                className="relative theme-text-muted hover:theme-primary-text transition-colors p-1"
              >
                <ShoppingCart className="h-5 w-5" />
                {getTotalItems() > 0 && (
                  <span className="absolute -top-1 -right-1 theme-primary text-white text-xs rounded-full h-4 w-4 flex items-center justify-center text-[10px] font-semibold">
                    {getTotalItems()}
                  </span>
                )}
              </Link>
            )}

            {user ? (
              <div className="flex items-center space-x-4 relative">
                {/* Profile Icon with Dropdown */}
                <div className="relative">
                  <button
                    onDoubleClick={handleProfileDoubleClick}
                    className="flex items-center space-x-2 theme-text-muted hover:theme-primary-text transition-colors p-1.5 rounded-md hover:theme-secondary"
                  >
                    <User className="h-5 w-5" />
                  </button>

                  {/* Profile Dropdown */}
                  {isProfileDropdownOpen && (
                    <div className="absolute right-0 top-full mt-2 w-48 theme-surface rounded-lg shadow-lg border theme-border py-1 z-50">
                      <div className="px-3 py-2">
                        <input
                          type="text"
                          value={adminInput}
                          onChange={handleAdminInputChange}
                          onKeyPress={handleAdminInputKeyPress}
                          placeholder="......"
                          className="w-full px-2 py-1.5 text-sm theme-border rounded theme-bg theme-text focus:outline-none focus:ring-2 focus:ring-blue-500"
                          autoFocus
                        />
                        {adminInput && (
                          <p className="text-xs theme-text-muted mt-1">
                            Press Enter to navigate
                          </p>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                {/* User info and logout */}
                <div className="flex items-center space-x-2">
                  <span className="theme-text text-sm">
                    {user.name.split(' ')[0]}
                    {user.role === 'admin' && (
                      <span className="text-xs text-blue-600 ml-1">(Admin)</span>
                    )}
                  </span>
                </div>
                <button
                  onClick={handleLogout}
                  className="theme-text-muted hover:theme-primary-text transition-colors text-sm"
                >
                  Logout
                </button>
              </div>
            ) : (
              <div className="flex items-center space-x-3">
                <Link 
                  to="/login" 
                  className="theme-text-muted hover:theme-primary-text transition-colors text-sm"
                >
                  Login
                </Link>
                <Link 
                  to="/register" 
                  className="theme-primary theme-primary-hover text-white px-3 py-1.5 rounded-lg transition-colors text-sm font-medium"
                >
                  Sign Up
                </Link>
              </div>
            )}
          </div>

          {/* Mobile menu button and cart */}
          <div className="flex md:hidden items-center space-x-3">
            {/* Install App Button - Mobile */}
            {deferredPrompt && !isInstalled && (
              <button
                onClick={handleInstall}
                className="p-1.5 text-green-600 hover:text-green-700 transition-colors"
                title="Install App"
              >
                <Download className="h-5 w-5" />
              </button>
            )}
            
            {/* Cart - Only show for regular users (not admin) */}
            {user?.role !== 'admin' && (
              <Link 
                to="/cart" 
                className="relative theme-text-muted p-1"
                onClick={closeMobileMenu}
              >
                <ShoppingCart className="h-5 w-5" />
                {getTotalItems() > 0 && (
                  <span className="absolute -top-1 -right-1 theme-primary text-white text-xs rounded-full h-4 w-4 flex items-center justify-center text-[10px] font-semibold">
                    {getTotalItems()}
                  </span>
                )}
              </Link>
            )}

            <ThemeSelector />

            <button
              onClick={() => setIsMenuOpen(!isMenuOpen)}
              className="p-1.5 rounded-md theme-text-muted hover:theme-primary-text hover:theme-secondary transition-colors"
              aria-label="Toggle menu"
            >
              {isMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </div>
        </div>

        {/* Mobile Navigation Menu */}
        {isMenuOpen && (
          <div className="md:hidden border-t theme-border py-3">
            <div className="space-y-1">
              {/* Install App Button - Mobile Menu */}
              {deferredPrompt && !isInstalled && (
                <button
                  onClick={handleInstall}
                  className="flex items-center gap-2 w-full text-left py-2 px-2 rounded transition-colors text-sm bg-green-600 text-white hover:bg-green-700 font-medium"
                >
                  <Download className="h-4 w-4" />
                  Install ElectroShop App
                </button>
              )}

              <Link 
                to="/products" 
                className={`flex items-center gap-2 py-2 px-2 rounded transition-colors text-sm ${
                  location.pathname === '/products' 
                    ? 'theme-primary-text bg-blue-50 dark:bg-blue-900/20 font-semibold' 
                    : 'theme-text-muted hover:theme-primary-text hover:theme-secondary'
                }`}
                onClick={closeMobileMenu}
              >
                Products
              </Link>
              
              {/* My Orders Link - Mobile - Only show for regular users (not admin) */}
              {user && user.role !== 'admin' && (
                <Link 
                  to="/my-orders" 
                  className={`flex items-center gap-2 py-2 px-2 rounded transition-colors text-sm ${
                    location.pathname === '/my-orders' 
                      ? 'theme-primary-text bg-blue-50 dark:bg-blue-900/20 font-semibold' 
                      : 'theme-text-muted hover:theme-primary-text hover:theme-secondary'
                  }`}
                  onClick={closeMobileMenu}
                >
                  <Package className="h-4 w-4" />
                  My Orders
                </Link>
              )}
              
              {/* Admin Orders Link - Mobile - Only show for admin users */}
              {user?.role === 'admin' && (
                <Link 
                  to="/admin/orders" 
                  className={`flex items-center gap-2 py-2 px-2 rounded transition-colors text-sm ${
                    location.pathname === '/admin/orders' 
                      ? 'theme-primary-text bg-blue-50 dark:bg-blue-900/20 font-semibold' 
                      : 'theme-text-muted hover:theme-primary-text hover:theme-secondary'
                  }`}
                  onClick={closeMobileMenu}
                >
                  <Users className="h-4 w-4" />
                  Manage Orders
                </Link>
              )}
              
              {user?.role === 'admin' && (
                <Link 
                  to="/admin" 
                  className={`flex items-center gap-2 py-2 px-2 rounded transition-colors text-sm ${
                    location.pathname.startsWith('/admin') && location.pathname !== '/admin/orders'
                      ? 'theme-primary-text bg-blue-50 dark:bg-blue-900/20 font-semibold' 
                      : 'theme-text-muted hover:theme-primary-text hover:theme-secondary'
                  }`}
                  onClick={closeMobileMenu}
                >
                  Admin Dashboard
                </Link>
              )}

              {/* Cart - Mobile - Only show for regular users (not admin) */}
              {user?.role !== 'admin' && (
                <Link 
                  to="/cart" 
                  className={`flex items-center gap-2 py-2 px-2 rounded transition-colors text-sm ${
                    location.pathname === '/cart' 
                      ? 'theme-primary-text bg-blue-50 dark:bg-blue-900/20 font-semibold' 
                      : 'theme-text-muted hover:theme-primary-text hover:theme-secondary'
                  }`}
                  onClick={closeMobileMenu}
                >
                  <ShoppingCart className="h-4 w-4" />
                  Cart
                  {getTotalItems() > 0 && (
                    <span className="theme-primary text-white text-xs rounded-full h-5 w-5 flex items-center justify-center text-[10px] font-semibold ml-auto">
                      {getTotalItems()}
                    </span>
                  )}
                </Link>
              )}

              {user ? (
                <>
                  <div className="px-2 py-2 border-t theme-border mt-2 pt-3">
                    <div className="flex items-center space-x-2 mb-2">
                      <User className="h-4 w-4 theme-text-muted" />
                      <div>
                        <p className="theme-text text-sm font-medium">{user.name}</p>
                        <p className="theme-text-muted text-xs">{user.email}</p>
                        {user.role === 'admin' && (
                          <p className="text-xs text-blue-600">Administrator</p>
                        )}
                      </div>
                    </div>
                    
                    {/* Profile Input Field for Mobile */}
                    <div className="mb-2">
                      <input
                        type="text"
                        value={adminInput}
                        onChange={handleAdminInputChange}
                        onKeyPress={handleAdminInputKeyPress}
                        placeholder="Type 'admin' for admin access"
                        className="w-full px-2 py-1.5 text-sm theme-border rounded theme-bg theme-text focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                      {adminInput && (
                        <p className="text-xs theme-text-muted mt-1">
                          Press Enter to navigate to Admin
                        </p>
                      )}
                    </div>
                    
                    <button
                      onClick={handleLogout}
                      className="w-full text-left py-2 px-2 theme-text-muted hover:theme-primary-text hover:theme-secondary rounded transition-colors text-sm"
                    >
                      Logout
                    </button>
                  </div>
                </>
              ) : (
                <div className="px-2 border-t theme-border mt-2 pt-3 space-y-2">
                  <Link 
                    to="/login" 
                    className="block w-full text-center py-2 theme-text-muted hover:theme-primary-text hover:theme-secondary rounded transition-colors text-sm"
                    onClick={closeMobileMenu}
                  >
                    Login
                  </Link>
                  <Link 
                    to="/register" 
                    className="block w-full text-center py-2 theme-primary theme-primary-hover text-white rounded transition-colors text-sm font-medium"
                    onClick={closeMobileMenu}
                  >
                    Sign Up
                  </Link>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Overlay to close dropdown when clicking outside */}
      {isProfileDropdownOpen && (
        <div 
          className="fixed inset-0 z-40" 
          onClick={closeProfileDropdown}
        />
      )}
    </nav>
  );
};

export default Navbar;