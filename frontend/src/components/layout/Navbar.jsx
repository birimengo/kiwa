import React, { useState, useEffect, useRef } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { 
  ShoppingCart, Menu, X, Package, User, Download, 
  LayoutDashboard, ShoppingBag, LogOut,
  ChevronRight, Briefcase, Warehouse
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useCartStore } from '../../stores/cartStore';
import { useTheme } from '../../context/ThemeContext';
import ThemeSelector from './ThemeSelector';
import NotificationBell from '../NotificationBell';

const Navbar = () => {
  const { user, logout } = useAuth();
  const { getTotalItems } = useCartStore();
  const { currentTheme } = useTheme();
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const drawerRef = useRef(null);

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

  // Close drawer when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (drawerRef.current && !drawerRef.current.contains(event.target)) {
        setIsDrawerOpen(false);
      }
    };

    if (isDrawerOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'auto';
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.body.style.overflow = 'auto';
    };
  }, [isDrawerOpen]);

  const handleInstall = async () => {
    if (!deferredPrompt) return;
    
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    
    if (outcome === 'accepted') {
      setDeferredPrompt(null);
      setIsInstalled(true);
    }
    setIsDrawerOpen(false);
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
    setIsDrawerOpen(false);
  };

  const closeDrawer = () => {
    setIsDrawerOpen(false);
  };

  const toggleDrawer = () => {
    setIsDrawerOpen(!isDrawerOpen);
  };

  // Navigation items - ADMIN ONLY
  const adminNavItems = [
    { 
      path: '/admin', 
      label: 'Dashboard', 
      icon: <LayoutDashboard className="h-4 w-4" />,
      description: 'Admin overview'
    },
    { 
      path: '/admin/orders', 
      label: 'Manage Orders', 
      icon: <Briefcase className="h-4 w-4" />,
      description: 'View and process orders'
    },
  ];

  // Navigation items - REGULAR USERS & GUESTS
  const userNavItems = [
    { 
      path: '/products', 
      label: 'Products', 
      icon: <ShoppingBag className="h-4 w-4" />,
      description: 'Browse all products'
    },
  ];

  // Add My Orders only if user is logged in and not admin
  if (user && user.role !== 'admin') {
    userNavItems.push({
      path: '/my-orders', 
      label: 'My Orders', 
      icon: <Package className="h-4 w-4" />,
      description: 'View your orders'
    });
    
    // Add Wholesalers for logged-in customers only
    userNavItems.push({
      path: '/wholesalers', 
      label: 'Wholesalers', 
      icon: <Warehouse className="h-4 w-4" />,
      description: 'Find wholesalers'
    });
  }

  // Cart item - Only for regular users (not admins)
  const cartItem = {
    path: '/cart', 
    label: 'Cart', 
    icon: <ShoppingCart className="h-4 w-4" />,
    description: 'Your shopping cart',
    showBadge: true
  };

  // Current nav items based on user role
  const navItems = user?.role === 'admin' ? adminNavItems : userNavItems;

  // Home/Logo redirect path based on user role
  const getHomePath = () => {
    if (user?.role === 'admin') {
      return '/admin';
    }
    return '/products';
  };

  // Brand name based on user role
  const getBrandName = () => {
    if (user?.role === 'admin') {
      return 'Admin Panel';
    }
    return 'ElectroShop';
  };

  // Check if user can access cart (only regular users)
  const canAccessCart = user?.role !== 'admin';

  return (
    <nav className="theme-surface shadow-lg sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-14">
          {/* Logo */}
          <Link 
            to={getHomePath()}
            className="flex items-center space-x-2 flex-shrink-0"
          >
            <div className="w-7 h-7 flex items-center justify-center">
              <img 
                src="/trade-svgrepo-com.svg" 
                alt="ElectroShop Logo" 
                className="w-5 h-5 theme-primary-filter"
              />
            </div>
            <span className="text-base font-bold theme-text">
              {getBrandName()}
            </span>
          </Link>

          {/* Desktop Navigation - ADMIN ONLY */}
          {user?.role === 'admin' && (
            <div className="hidden md:flex items-center space-x-5">
              {adminNavItems.map((item) => (
                <Link 
                  key={item.path}
                  to={item.path} 
                  className={`flex items-center gap-2 transition-colors font-medium text-sm px-3 py-1.5 rounded-lg ${
                    location.pathname === item.path 
                      ? 'theme-primary-text bg-blue-50 dark:bg-blue-900/20 font-semibold' 
                      : 'theme-text-muted hover:theme-primary-text hover:bg-gray-100 dark:hover:bg-gray-700'
                  }`}
                >
                  {item.icon}
                  {item.label}
                </Link>
              ))}
              
              <ThemeSelector />
              
              {/* Install App Button - Desktop */}
              {deferredPrompt && !isInstalled && (
                <button
                  onClick={handleInstall}
                  className="flex items-center space-x-2 bg-green-600 text-white px-3 py-1.5 rounded-lg text-sm font-medium hover:bg-green-700 transition-colors"
                  title="Install Admin Panel App"
                >
                  <Download className="h-3.5 w-3.5" />
                  <span className="text-xs">Install App</span>
                </button>
              )}
              
              {/* NOTIFICATION BELL - ADMIN ONLY */}
              <NotificationBell />

              {/* User info and logout */}
              {user && (
                <div className="flex items-center space-x-3">
                  <div className="flex items-center space-x-2">
                    <div className="h-7 w-7 rounded-full bg-blue-100 dark:bg-blue-900 flex items-center justify-center">
                      <User className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />
                    </div>
                    <div className="flex flex-col">
                      <span className="theme-text text-xs font-medium">
                        {user.name.split(' ')[0]}
                      </span>
                      <span className="theme-text-muted text-[10px]">
                        Admin
                      </span>
                    </div>
                  </div>
                  <button
                    onClick={handleLogout}
                    className="theme-text-muted hover:theme-primary-text hover:theme-secondary px-2.5 py-1.5 rounded-lg transition-colors text-xs font-medium"
                  >
                    Logout
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Desktop Navigation - REGULAR USERS & GUESTS */}
          {user?.role !== 'admin' && (
            <div className="hidden md:flex items-center space-x-5">
              {userNavItems.map((item) => (
                <Link 
                  key={item.path}
                  to={item.path} 
                  className={`flex items-center gap-2 transition-colors font-medium text-sm px-3 py-1.5 rounded-lg ${
                    location.pathname === item.path 
                      ? 'theme-primary-text bg-blue-50 dark:bg-blue-900/20 font-semibold' 
                      : 'theme-text-muted hover:theme-primary-text hover:bg-gray-100 dark:hover:bg-gray-700'
                  }`}
                >
                  {item.icon}
                  {item.label}
                </Link>
              ))}
              
              <ThemeSelector />
              
              {/* Install App Button - Desktop */}
              {deferredPrompt && !isInstalled && (
                <button
                  onClick={handleInstall}
                  className="flex items-center space-x-2 bg-green-600 text-white px-3 py-1.5 rounded-lg text-sm font-medium hover:bg-green-700 transition-colors"
                  title="Install ElectroShop App"
                >
                  <Download className="h-3.5 w-3.5" />
                  <span className="text-xs">Install App</span>
                </button>
              )}
              
              {/* Cart - Only show for regular users */}
              {canAccessCart && (
                <Link 
                  to="/cart" 
                  className="relative theme-text-muted hover:theme-primary-text transition-colors p-1"
                >
                  <ShoppingCart className="h-5 w-5" />
                  {getTotalItems() > 0 && (
                    <span className="absolute -top-1 -right-1 theme-primary text-blue-700 text-xs rounded-full h-4 w-4 flex items-center justify-center text-[15px] font-semibold">
                      {getTotalItems()}
                    </span>
                  )}
                </Link>
              )}

              {user ? (
                <div className="flex items-center space-x-3">
                  <div className="flex items-center space-x-2">
                    <div className="h-7 w-7 rounded-full bg-blue-100 dark:bg-blue-900 flex items-center justify-center">
                      <User className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />
                    </div>
                    <div className="flex flex-col">
                      <span className="theme-text text-xs font-medium">
                        {user.name.split(' ')[0]}
                      </span>
                      <span className="theme-text-muted text-[10px]">
                        Customer
                      </span>
                    </div>
                  </div>
                  <button
                    onClick={handleLogout}
                    className="theme-text-muted hover:theme-primary-text hover:theme-secondary px-2.5 py-1.5 rounded-lg transition-colors text-xs font-medium"
                  >
                    Logout
                  </button>
                </div>
              ) : (
                <div className="flex items-center space-x-2">
                  <Link 
                    to="/login" 
                    className="theme-text-muted hover:theme-primary-text transition-colors text-xs font-medium px-2.5 py-1.5"
                  >
                    Login
                  </Link>
                  <Link 
                    to="/register" 
                    className="theme-primary theme-primary-hover text-white px-2.5 py-1.5 rounded-lg transition-colors text-xs font-medium"
                  >
                    Sign Up
                  </Link>
                </div>
              )}
            </div>
          )}

          {/* Mobile menu button */}
          <div className="flex md:hidden items-center space-x-2">
            {/* Install App Button - Mobile Icon */}
            {deferredPrompt && !isInstalled && (
              <button
                onClick={handleInstall}
                className="p-1 text-green-600 hover:text-green-700 transition-colors"
                title="Install App"
              >
                <Download className="h-4.5 w-4.5" />
              </button>
            )}
            
            {/* Notification Bell - Mobile - Only for admin users */}
            {user?.role === 'admin' && (
              <div className="relative">
                <NotificationBell />
              </div>
            )}
            
            {/* Cart - Only show for regular users (not admin) */}
            {canAccessCart && (
              <Link 
                to="/cart" 
                className="relative theme-text-muted p-1"
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
              onClick={toggleDrawer}
              className="p-1.5 rounded-md theme-text-muted hover:theme-primary-text hover:theme-secondary transition-colors"
              aria-label="Toggle menu"
            >
              {isDrawerOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Side Drawer - COMPACT VERSION */}
      <div 
        ref={drawerRef}
        className={`fixed inset-y-0 left-0 z-50 w-64 transform ${
          isDrawerOpen ? 'translate-x-0' : '-translate-x-full'
        } transition-transform duration-250 ease-in-out`}
      >
        <div className="h-full theme-surface shadow-xl flex flex-col overflow-y-auto">
          {/* Drawer Header */}
          <div className="p-3 border-b theme-border">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center space-x-2">
                <div className="w-6 h-6 flex items-center justify-center">
                  <img 
                    src="/trade-svgrepo-com.svg" 
                    alt="Logo" 
                    className="w-5 h-5 theme-primary-filter"
                  />
                </div>
                <span className="text-sm font-bold theme-text">
                  {getBrandName()}
                </span>
              </div>
              <button
                onClick={closeDrawer}
                className="p-1 rounded-md theme-text-muted hover:theme-primary-text hover:theme-secondary transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* User Info */}
            {user && (
              <div className="flex items-center space-x-2 p-2 rounded-lg bg-gray-50 dark:bg-gray-800">
                <div className="h-8 w-8 rounded-full bg-blue-100 dark:bg-blue-900 flex items-center justify-center flex-shrink-0">
                  <User className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="theme-text text-xs font-medium truncate">
                    {user.name}
                  </p>
                  <div className="mt-0.5">
                    <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300">
                      {user.role === 'admin' ? 'Administrator' : 'Customer'}
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Drawer Navigation - Compact */}
          <div className="flex-1 p-2">
            {/* Navigation Links */}
            <div className="space-y-0.5 mb-4">
              {navItems.map((item) => (
                <Link
                  key={item.path}
                  to={item.path}
                  onClick={closeDrawer}
                  className={`flex items-center gap-2 py-2 px-2 rounded-md transition-colors ${
                    location.pathname === item.path
                      ? 'theme-primary-text bg-blue-50 dark:bg-blue-900/20 font-semibold'
                      : 'theme-text-muted hover:theme-primary-text hover:bg-gray-100 dark:hover:bg-gray-700'
                  }`}
                >
                  <div className={`p-1 rounded ${
                    location.pathname === item.path
                      ? 'bg-blue-100 dark:bg-blue-800 text-blue-600 dark:text-blue-400'
                      : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400'
                  }`}>
                    {item.icon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium truncate">{item.label}</p>
                    <p className="text-[10px] theme-text-muted truncate">{item.description}</p>
                  </div>
                  <ChevronRight className="h-3 w-3 theme-text-muted flex-shrink-0" />
                </Link>
              ))}

              {/* Cart in drawer for regular users only */}
              {canAccessCart && (
                <Link
                  to="/cart"
                  onClick={closeDrawer}
                  className={`flex items-center gap-2 py-2 px-2 rounded-md transition-colors ${
                    location.pathname === '/cart'
                      ? 'theme-primary-text bg-blue-50 dark:bg-blue-900/20 font-semibold'
                      : 'theme-text-muted hover:theme-primary-text hover:bg-gray-100 dark:hover:bg-gray-700'
                  }`}
                >
                  <div className={`p-1 rounded ${
                    location.pathname === '/cart'
                      ? 'bg-blue-100 dark:bg-blue-800 text-blue-600 dark:text-blue-400'
                      : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400'
                  }`}>
                    <ShoppingCart className="h-3.5 w-3.5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium">Cart</p>
                    {getTotalItems() > 0 && (
                      <p className="text-[10px]">
                        {getTotalItems()} item{getTotalItems() !== 1 ? 's' : ''}
                      </p>
                    )}
                  </div>
                  {getTotalItems() > 0 && (
                    <span className="theme-primary text-white text-[10px] rounded-full h-4 w-4 flex items-center justify-center font-semibold flex-shrink-0">
                      {getTotalItems()}
                    </span>
                  )}
                </Link>
              )}
            </div>

            {/* Install App Button - Drawer */}
            {deferredPrompt && !isInstalled && (
              <button
                onClick={handleInstall}
                className="w-full flex items-center gap-2 py-2 px-2 rounded-md bg-green-600 hover:bg-green-700 text-white transition-colors mb-3"
              >
                <div className="p-1 rounded bg-green-500">
                  <Download className="h-3.5 w-3.5" />
                </div>
                <div className="flex-1 text-left">
                  <p className="text-xs font-medium">Install App</p>
                  <p className="text-[10px] opacity-90">Better experience</p>
                </div>
              </button>
            )}

            {/* Login/Register for non-logged in users */}
            {!user && (
              <div className="space-y-1.5 mb-3">
                <Link
                  to="/login"
                  onClick={closeDrawer}
                  className="flex items-center gap-2 py-2 px-2 rounded-md theme-text-muted hover:theme-primary-text hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                >
                  <div className="p-1 rounded bg-gray-100 dark:bg-gray-700">
                    <User className="h-3.5 w-3.5" />
                  </div>
                  <p className="text-xs font-medium">Login</p>
                </Link>
                <Link
                  to="/register"
                  onClick={closeDrawer}
                  className="flex items-center gap-2 py-2 px-2 rounded-md theme-primary theme-primary-hover text-white transition-colors"
                >
                  <div className="p-1 rounded bg-white/20">
                    <User className="h-3.5 w-3.5" />
                  </div>
                  <p className="text-xs font-medium">Sign Up</p>
                </Link>
              </div>
            )}
          </div>

          {/* Drawer Footer */}
          <div className="p-2 border-t theme-border">
            {user ? (
              <button
                onClick={handleLogout}
                className="w-full flex items-center gap-2 py-2 px-2 rounded-md theme-text-muted hover:theme-primary-text hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
              >
                <div className="p-1 rounded bg-gray-100 dark:bg-gray-700">
                  <LogOut className="h-3.5 w-3.5" />
                </div>
                <p className="text-xs font-medium">Logout</p>
              </button>
            ) : (
              <p className="text-center theme-text-muted text-[10px] p-1">
                Sign in for all features
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Overlay when drawer is open */}
      {isDrawerOpen && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 z-40"
          onClick={closeDrawer}
        />
      )}
    </nav>
  );
};

export default Navbar;