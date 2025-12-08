import React, { useState, useEffect, useRef, useCallback } from 'react';
import { 
  Bell, X, Eye, ExternalLink, Check, Trash2, Package, 
  User, Phone, MapPin, DollarSign, ShoppingBag, ChevronRight, 
  AlertCircle, Volume2, Settings,
  Shield, Loader2, Activity
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { notificationsAPI } from '../services/api';
import { ordersAPI } from '../services/api';

const NotificationBell = () => {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [orderDetails, setOrderDetails] = useState(null);
  const [loadingOrderDetails, setLoadingOrderDetails] = useState(false);
  const [showOrderModal, setShowOrderModal] = useState(false);
  const [toasts, setToasts] = useState([]);
  const [notificationSettings, setNotificationSettings] = useState({
    desktop: true,
    sound: true,
    toast: true,
    vibration: true
  });
  const [showSettings, setShowSettings] = useState(false);
  const [lastNotificationId, setLastNotificationId] = useState(null);
  const [notificationPermission, setNotificationPermission] = useState('default');
  const [originalTitle, setOriginalTitle] = useState('');
  const dropdownRef = useRef(null);
  const audioRef = useRef(null);
  const activeNotifications = useRef([]);

  // Initialize audio for notification sound
  useEffect(() => {
    const createNotificationSound = () => {
      try {
        const audioContext = new (window.AudioContext || window.webkitAudioContext)();
        
        return () => {
          try {
            const oscillator = audioContext.createOscillator();
            const gainNode = audioContext.createGain();
            
            oscillator.connect(gainNode);
            gainNode.connect(audioContext.destination);
            
            oscillator.frequency.value = 800;
            oscillator.type = 'sine';
            gainNode.gain.setValueAtTime(0.1, audioContext.currentTime);
            
            oscillator.start();
            setTimeout(() => oscillator.stop(), 200);
          } catch (e) {
            console.log('Audio play error:', e);
          }
        };
      } catch (e) {
        console.log('Audio context not supported');
        return () => {};
      }
    };
    
    audioRef.current = { play: createNotificationSound() };
    setOriginalTitle(document.title);
  }, []);

  // Request browser notification permission
  useEffect(() => {
    if ('Notification' in window) {
      setNotificationPermission(Notification.permission);
      
      const savedSettings = localStorage.getItem('notificationSettings');
      if (savedSettings) {
        setNotificationSettings(JSON.parse(savedSettings));
      }
    }
  }, []);

  // Save settings to localStorage when they change
  useEffect(() => {
    localStorage.setItem('notificationSettings', JSON.stringify(notificationSettings));
  }, [notificationSettings]);

  // Polling function to check for new notifications every 10 seconds
  const pollNotifications = useCallback(async () => {
    if (!user || user.role !== 'admin') return;
    
    try {
      const response = await notificationsAPI.getUnreadCount();
      if (response.data.success) {
        const newUnreadCount = response.data.unreadCount;
        
        if (newUnreadCount > unreadCount) {
          const notificationsResponse = await notificationsAPI.getNotifications({ limit: 1 });
          if (notificationsResponse.data.success && notificationsResponse.data.notifications.length > 0) {
            const latestNotification = notificationsResponse.data.notifications[0];
            
            if (latestNotification._id !== lastNotificationId) {
              setLastNotificationId(latestNotification._id);
              
              triggerNotificationAlerts(latestNotification);
              
              if (notificationSettings.toast) {
                addToast({
                  id: `${latestNotification._id}_${Date.now()}`,
                  type: 'order',
                  title: 'New Order Received',
                  message: latestNotification.message,
                  orderNumber: latestNotification.orderNumber,
                  customerName: latestNotification.customerName,
                  amount: latestNotification.totalAmount,
                  timestamp: new Date()
                });
              }
            }
          }
        }
        
        setUnreadCount(newUnreadCount);
        
        if (isOpen) {
          fetchNotifications();
        }
      }
    } catch (error) {
      console.error('Polling error:', error);
    }
  }, [user, unreadCount, lastNotificationId, isOpen, notificationSettings]);

  // Function to trigger all notification alerts
  const triggerNotificationAlerts = (notification) => {
    if (notificationSettings.sound && audioRef.current && audioRef.current.play) {
      audioRef.current.play();
    }
    
    if (notificationSettings.desktop && notificationPermission === 'granted') {
      showDesktopNotification(notification);
    }
    
    if (notificationSettings.vibration && 'vibrate' in navigator) {
      navigator.vibrate([200, 100, 200]);
    }
    
    blinkTabTitle(notification);
  };

  // Play notification sound
  const playNotificationSound = () => {
    if (audioRef.current && audioRef.current.play) {
      audioRef.current.play();
    }
  };

  // Show desktop browser notification
  const showDesktopNotification = (notification) => {
    if (!('Notification' in window) || Notification.permission !== 'granted') return;
    
    const options = {
      body: `${notification.customerName} - ${notification.message}`,
      icon: '/trade-svgrepo-com.svg',
      badge: '/trade-svgrepo-com.svg',
      tag: notification._id,
      requireInteraction: true,
      silent: false,
      data: {
        orderNumber: notification.orderNumber
      }
    };
    
    let desktopNotification;
    try {
      desktopNotification = new Notification(`📦 ${notification.orderNumber}`, options);
      activeNotifications.current.push(desktopNotification);
    } catch (error) {
      console.error('Failed to create notification:', error);
      return;
    }
    
    desktopNotification.onclick = () => {
      window.focus();
      window.open(`/admin/orders?order=${notification.orderNumber}`, '_blank');
      desktopNotification.close();
      activeNotifications.current = activeNotifications.current.filter(n => n !== desktopNotification);
    };
    
    const timeoutId = setTimeout(() => {
      try {
        desktopNotification.close();
        activeNotifications.current = activeNotifications.current.filter(n => n !== desktopNotification);
      } catch (error) {
        console.log('Error closing notification:', error);
      }
    }, 15000);
    
    desktopNotification._timeoutId = timeoutId;
  };

  // Clean up all active desktop notifications
  const cleanupDesktopNotifications = () => {
    activeNotifications.current.forEach(notification => {
      try {
        if (notification.close && typeof notification.close === 'function') {
          notification.close();
        }
        if (notification._timeoutId) {
          clearTimeout(notification._timeoutId);
        }
      } catch (error) {
        console.log('Error cleaning up notification:', error);
      }
    });
    activeNotifications.current = [];
  };

  // Blink tab title
  const blinkTabTitle = (notification) => {
    let blinkCount = 0;
    const maxBlinks = 10;
    
    const blinkInterval = setInterval(() => {
      if (blinkCount >= maxBlinks) {
        clearInterval(blinkInterval);
        document.title = originalTitle;
        return;
      }
      
      document.title = blinkCount % 2 === 0 
        ? `🔔 ${notification.orderNumber} - ElectroShop` 
        : originalTitle;
      
      blinkCount++;
    }, 500);
    
    const handleFocus = () => {
      clearInterval(blinkInterval);
      document.title = originalTitle;
    };
    
    window.addEventListener('focus', handleFocus);
    
    return () => {
      clearInterval(blinkInterval);
      window.removeEventListener('focus', handleFocus);
    };
  };

  // Request notification permission
  const requestNotificationPermission = () => {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission().then((permission) => {
        setNotificationPermission(permission);
        if (permission === 'granted') {
          addToast({
            id: 'permission-granted',
            type: 'success',
            title: 'Notifications Enabled',
            message: 'You will now receive desktop alerts for new orders',
            duration: 5000
          });
        }
      }).catch(error => {
        console.error('Error requesting notification permission:', error);
      });
    }
  };

  // Add toast notification
  const addToast = (toast) => {
    const toastId = toast.id || Date.now().toString();
    
    if (toasts.some(t => t.id === toastId)) {
      return;
    }
    
    const toastWithId = {
      ...toast,
      id: toastId,
      timestamp: toast.timestamp || new Date()
    };
    
    setToasts(prev => {
      const newToasts = [toastWithId, ...prev];
      return newToasts.slice(0, 3);
    });
    
    const duration = toast.duration || 8000;
    const timeoutId = setTimeout(() => {
      removeToast(toastId);
    }, duration);
    
    toastWithId._timeoutId = timeoutId;
  };

  // Remove toast
  const removeToast = (id) => {
    setToasts(prev => {
      const toast = prev.find(t => t.id === id);
      if (toast && toast._timeoutId) {
        clearTimeout(toast._timeoutId);
      }
      return prev.filter(toast => toast.id !== id);
    });
  };

  // Clean up all toast timeouts
  const cleanupToasts = () => {
    toasts.forEach(toast => {
      if (toast._timeoutId) {
        clearTimeout(toast._timeoutId);
      }
    });
  };

  const fetchNotifications = async () => {
    try {
      setLoading(true);
      const response = await notificationsAPI.getNotifications({ limit: 10 });
      if (response.data.success) {
        const uniqueNotifications = response.data.notifications.filter(
          (notification, index, self) =>
            index === self.findIndex(n => n._id === notification._id)
        );
        setNotifications(uniqueNotifications);
        setUnreadCount(response.data.unreadCount);
      }
    } catch (error) {
      console.error('Fetch notifications error:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchOrderDetails = async (orderId) => {
    if (!orderId || typeof orderId !== 'string') {
      console.error('Invalid order ID:', orderId);
      addToast({
        id: `order-error-${Date.now()}`,
        type: 'error',
        title: 'Error',
        message: 'Invalid order reference',
        duration: 3000
      });
      return;
    }
    
    try {
      setLoadingOrderDetails(true);
      const response = await ordersAPI.getOrder(orderId);
      if (response.data.success) {
        setOrderDetails(response.data.order);
        setShowOrderModal(true);
      }
    } catch (error) {
      console.error('Fetch order details error:', error);
      addToast({
        id: `order-error-${Date.now()}`,
        type: 'error',
        title: 'Error',
        message: 'Failed to load order details',
        duration: 3000
      });
    } finally {
      setLoadingOrderDetails(false);
    }
  };

  const handleViewOrderDetails = async (notification) => {
    setSelectedOrder(notification);
    
    let orderId;
    if (typeof notification.order === 'string') {
      orderId = notification.order;
    } else if (notification.order && notification.order._id) {
      orderId = notification.order._id;
    } else if (notification.order && typeof notification.order === 'object') {
      orderId = notification.order._id || notification.order.id;
    } else {
      console.error('Unable to extract order ID from notification:', notification);
      addToast({
        id: `order-id-error-${Date.now()}`,
        type: 'error',
        title: 'Error',
        message: 'Unable to load order details',
        duration: 3000
      });
      return;
    }
    
    if (!orderId) {
      console.error('Order ID is undefined or null');
      return;
    }
    
    await fetchOrderDetails(orderId);
  };

  const markAsRead = async (notificationId) => {
    try {
      await notificationsAPI.markAsRead(notificationId);
      setNotifications(prev =>
        prev.map(notif =>
          notif._id === notificationId
            ? { ...notif, isRead: true, readAt: new Date() }
            : notif
        )
      );
      setUnreadCount(prev => Math.max(0, prev - 1));
    } catch (error) {
      console.error('Mark as read error:', error);
    }
  };

  const markAllAsRead = async () => {
    try {
      await notificationsAPI.markAllAsRead();
      setNotifications(prev =>
        prev.map(notif => ({ ...notif, isRead: true, readAt: new Date() }))
      );
      setUnreadCount(0);
    } catch (error) {
      console.error('Mark all as read error:', error);
    }
  };

  const deleteNotification = async (notificationId) => {
    try {
      await notificationsAPI.deleteNotification(notificationId);
      setNotifications(prev =>
        prev.filter(notif => notif._id !== notificationId)
      );
      const deletedNotif = notifications.find(n => n._id === notificationId);
      if (deletedNotif && !deletedNotif.isRead) {
        setUnreadCount(prev => Math.max(0, prev - 1));
      }
    } catch (error) {
      console.error('Delete notification error:', error);
    }
  };

  const handleBellClick = () => {
    const newIsOpen = !isOpen;
    setIsOpen(newIsOpen);
    
    // Close settings when toggling the main bell
    if (showSettings) setShowSettings(false);
    
    if (newIsOpen) {
      fetchNotifications();
    }
  };

  const handleSettingsClick = (e) => {
    e.stopPropagation();
    setShowSettings(!showSettings);
  };

  const formatTime = (date) => {
    const now = new Date();
    const notificationDate = new Date(date);
    const diffMs = now - notificationDate;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m`;
    if (diffHours < 24) return `${diffHours}h`;
    if (diffDays < 7) return `${diffDays}d`;
    return notificationDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  const formatCurrency = (amount) => {
    if (!amount && amount !== 0) return 'UGX 0';
    if (amount < 1000) return `UGX ${amount}`;
    if (amount < 1000000) return `UGX ${(amount/1000).toFixed(0)}K`;
    return `UGX ${(amount/1000000).toFixed(1)}M`;
  };

  const formatDate = (date) => {
    if (!date) return 'N/A';
    return new Date(date).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const handleToastClick = (toast) => {
    if (toast.type === 'order' && toast.orderNumber) {
      window.open(`/admin/orders?order=${toast.orderNumber}`, '_blank');
    }
    removeToast(toast.id);
  };

  const toggleSetting = (setting) => {
    setNotificationSettings(prev => ({
      ...prev,
      [setting]: !prev[setting]
    }));
    
    if (setting === 'desktop' && !notificationSettings.desktop && notificationPermission === 'default') {
      requestNotificationPermission();
    }
  };

  // Setup polling interval
  useEffect(() => {
    let interval;
    if (user?.role === 'admin') {
      pollNotifications();
      interval = setInterval(pollNotifications, 10000);
    }
    
    return () => {
      if (interval) clearInterval(interval);
      cleanupDesktopNotifications();
      cleanupToasts();
      document.title = originalTitle;
    };
  }, [user, pollNotifications, originalTitle]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
        setShowSettings(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Only show for admin users
  if (!user || user.role !== 'admin') return null;

  return (
    <>
      <div className="relative" ref={dropdownRef}>
        {/* Bell Icon */}
        <button
          onClick={handleBellClick}
          className="relative p-1.5 sm:p-2 theme-text-muted hover:theme-primary-text transition-colors rounded-lg hover:theme-secondary flex items-center"
          aria-label={`Notifications ${unreadCount > 0 ? `(${unreadCount} new)` : ''}`}
        >
          <div className="relative">
            <Bell className="h-4 w-4 sm:h-5 sm:w-5" />
          </div>
          
          {/* Notification Badge */}
          {unreadCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 flex items-center justify-center h-3 w-3 sm:h-4 sm:w-4 text-[8px] sm:text-xs font-bold rounded-full bg-red-500 text-white animate-pulse">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </button>

        {/* Settings Dropdown */}
        {showSettings && (
          <div className="absolute right-0 mt-2 w-56 theme-surface rounded-lg shadow-xl border theme-border z-50 p-3">
            <div className="space-y-3">
              <h4 className="font-medium theme-text text-sm mb-2">Notification Settings</h4>
              
              <div className="space-y-3">
                <label className="flex items-center justify-between cursor-pointer">
                  <div className="flex items-center gap-2">
                    <Bell className="h-3.5 w-3.5" />
                    <span className="text-xs sm:text-sm theme-text">Desktop Alerts</span>
                  </div>
                  <button
                    onClick={() => toggleSetting('desktop')}
                    className={`relative inline-flex h-5 w-9 items-center rounded-full ${
                      notificationSettings.desktop ? 'theme-primary' : 'bg-gray-300 dark:bg-gray-700'
                    }`}
                  >
                    <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition ${
                      notificationSettings.desktop ? 'translate-x-5' : 'translate-x-0.5'
                    }`} />
                  </button>
                </label>
                
                <label className="flex items-center justify-between cursor-pointer">
                  <div className="flex items-center gap-2">
                    <Volume2 className="h-3.5 w-3.5" />
                    <span className="text-xs sm:text-sm theme-text">Sound</span>
                  </div>
                  <button
                    onClick={() => toggleSetting('sound')}
                    className={`relative inline-flex h-5 w-9 items-center rounded-full ${
                      notificationSettings.sound ? 'theme-primary' : 'bg-gray-300 dark:bg-gray-700'
                    }`}
                  >
                    <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition ${
                      notificationSettings.sound ? 'translate-x-5' : 'translate-x-0.5'
                    }`} />
                  </button>
                </label>
                
                <label className="flex items-center justify-between cursor-pointer">
                  <div className="flex items-center gap-2">
                    <AlertCircle className="h-3.5 w-3.5" />
                    <span className="text-xs sm:text-sm theme-text">Toast Popups</span>
                  </div>
                  <button
                    onClick={() => toggleSetting('toast')}
                    className={`relative inline-flex h-5 w-9 items-center rounded-full ${
                      notificationSettings.toast ? 'theme-primary' : 'bg-gray-300 dark:bg-gray-700'
                    }`}
                  >
                    <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition ${
                      notificationSettings.toast ? 'translate-x-5' : 'translate-x-0.5'
                    }`} />
                  </button>
                </label>
                
                {notificationPermission === 'default' && (
                  <button
                    onClick={requestNotificationPermission}
                    className="w-full mt-1 theme-primary text-white text-xs py-2 px-3 rounded-lg transition-colors font-medium"
                  >
                    Enable Browser Notifications
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Main Notifications Dropdown */}
        {isOpen && (
          <div className="fixed sm:absolute inset-x-0 sm:inset-x-auto top-16 sm:top-auto sm:right-0 sm:mt-2 w-full sm:w-72 md:w-80 lg:w-96 max-h-[70vh] sm:max-h-96 theme-surface rounded-lg sm:rounded-lg shadow-xl border theme-border z-50 overflow-hidden flex flex-col mx-auto sm:mx-0 max-w-sm sm:max-w-none">
            {/* Header */}
            <div className="p-2 sm:p-3 border-b theme-border flex justify-between items-center">
              <div className="flex items-center gap-1.5 sm:gap-2">
                <Bell className="h-3.5 w-3.5 sm:h-4 sm:w-4 theme-text" />
                <h3 className="font-semibold theme-text text-sm sm:text-base">Notifications</h3>
                {unreadCount > 0 && (
                  <span className="bg-red-500 text-white text-[10px] sm:text-xs px-1.5 sm:px-2 py-0.5 rounded-full">
                    {unreadCount} new
                  </span>
                )}
              </div>
              <div className="flex items-center gap-1 sm:gap-2">
                <button
                  onClick={handleSettingsClick}
                  className="p-0.5 sm:p-1 text-[10px] sm:text-xs theme-text-muted hover:theme-primary-text transition-colors"
                  title="Settings"
                >
                  <Settings className="h-2.5 w-2.5 sm:h-3 sm:w-3" />
                </button>
                {unreadCount > 0 && (
                  <button
                    onClick={markAllAsRead}
                    className="p-0.5 sm:p-1 text-[10px] sm:text-xs theme-text-muted hover:theme-primary-text transition-colors"
                    title="Mark all as read"
                  >
                    <Check className="h-2.5 w-2.5 sm:h-3 sm:w-3" />
                  </button>
                )}
                <button
                  onClick={() => setIsOpen(false)}
                  className="p-0.5 sm:p-1 theme-text-muted hover:theme-primary-text transition-colors"
                >
                  <X className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                </button>
              </div>
            </div>

            {/* Notifications List */}
            <div className="flex-1 overflow-y-auto max-h-[60vh] sm:max-h-80">
              {loading ? (
                <div className="p-3 sm:p-4 text-center theme-text-muted text-xs sm:text-sm">
                  <Loader2 className="h-4 w-4 animate-spin mx-auto mb-2" />
                  Loading notifications...
                </div>
              ) : notifications.length === 0 ? (
                <div className="p-4 sm:p-6 text-center theme-text-muted">
                  <Bell className="h-6 w-6 sm:h-8 sm:w-8 mx-auto mb-1.5 sm:mb-2 opacity-50" />
                  <p className="text-xs sm:text-sm">No notifications</p>
                  <p className="text-[10px] sm:text-xs mt-0.5 sm:mt-1">New orders appear here</p>
                </div>
              ) : (
                <div className="divide-y theme-divide">
                  {notifications.map((notification, index) => {
                    const uniqueKey = `${notification._id}_${index}`;
                    
                    return (
                      <div
                        key={uniqueKey}
                        className={`p-2 sm:p-3 hover:theme-secondary transition-colors ${
                          !notification.isRead ? 'theme-highlight' : ''
                        }`}
                      >
                        <div className="flex justify-between items-start gap-1 sm:gap-2">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-start gap-1.5 sm:gap-2">
                              <div className="flex-1 min-w-0">
                                <p className="text-xs sm:text-sm font-medium theme-text truncate">
                                  {notification.message}
                                </p>
                                <div className="mt-0.5 sm:mt-1 text-[10px] sm:text-xs theme-text-muted space-y-0.5 sm:space-y-1">
                                  <div className="flex items-center gap-0.5 sm:gap-1">
                                    <Package className="h-2.5 w-2.5 sm:h-3 sm:w-3 flex-shrink-0" />
                                    <span className="truncate">Order: {notification.orderNumber}</span>
                                  </div>
                                  <div className="flex items-center gap-0.5 sm:gap-1">
                                    <User className="h-2.5 w-2.5 sm:h-3 sm:w-3 flex-shrink-0" />
                                    <span className="truncate">Customer: {notification.customerName}</span>
                                  </div>
                                  <div className="flex items-center gap-0.5 sm:gap-1">
                                    <DollarSign className="h-2.5 w-2.5 sm:h-3 sm:w-3 flex-shrink-0" />
                                    <span>Amount: {formatCurrency(notification.totalAmount)}</span>
                                  </div>
                                </div>
                              </div>
                              {!notification.isRead && (
                                <span className="h-1.5 w-1.5 sm:h-2 sm:w-2 theme-primary rounded-full mt-0.5 sm:mt-1 flex-shrink-0 animate-pulse"></span>
                              )}
                            </div>
                            <p className="text-[10px] sm:text-xs theme-text-muted mt-1 sm:mt-2">
                              {formatTime(notification.createdAt)}
                            </p>
                          </div>
                        </div>
                        
                        <div className="flex items-center justify-between mt-1 sm:mt-2 pt-1 sm:pt-2 border-t theme-border">
                          <div className="flex items-center gap-1 sm:gap-2">
                            <button
                              onClick={() => handleViewOrderDetails(notification)}
                              className="flex items-center gap-0.5 sm:gap-1 text-[10px] sm:text-xs theme-primary-text hover:underline"
                            >
                              <ChevronRight className="h-2.5 w-2.5 sm:h-3 sm:w-3" />
                              Details
                            </button>
                            <a
                              href={`/admin/orders?order=${notification.orderNumber}`}
                              className="flex items-center gap-0.5 sm:gap-1 text-[10px] sm:text-xs theme-text-muted hover:theme-primary-text hover:underline"
                              onClick={() => setIsOpen(false)}
                            >
                              <ExternalLink className="h-2.5 w-2.5 sm:h-3 sm:w-3" />
                              Order
                            </a>
                          </div>
                          <div className="flex items-center gap-0.5 sm:gap-1">
                            {!notification.isRead && (
                              <button
                                onClick={() => markAsRead(notification._id)}
                                className="p-0.5 text-[10px] sm:text-xs theme-text-muted hover:theme-primary-text transition-colors"
                                title="Mark as read"
                              >
                                <Eye className="h-2.5 w-2.5 sm:h-3 sm:w-3" />
                              </button>
                            )}
                            <button
                              onClick={() => deleteNotification(notification._id)}
                              className="p-0.5 text-[10px] sm:text-xs theme-text-muted hover:text-red-500 transition-colors"
                              title="Delete"
                            >
                              <Trash2 className="h-2.5 w-2.5 sm:h-3 sm:w-3" />
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="p-2 sm:p-3 border-t theme-border flex items-center justify-between">
              <a
                href="/admin/orders?filter=pending"
                className="text-xs sm:text-sm theme-primary-text hover:underline"
                onClick={() => setIsOpen(false)}
              >
                View all orders
              </a>
              <div className="flex items-center gap-2 text-[10px] sm:text-xs theme-text-muted">
                <Activity className="h-3 w-3" />
                Real-time updates
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Toast Notifications Container */}
      <div className="fixed top-4 right-4 z-[1000] space-y-2 max-w-sm">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className="bg-white dark:bg-gray-800 rounded-lg shadow-xl border border-gray-200 dark:border-gray-700 p-3 animate-slideInRight cursor-pointer hover:shadow-2xl transition-all duration-200"
            onClick={() => handleToastClick(toast)}
          >
            <div className="flex items-start gap-3">
              <div className={`p-2 rounded-full ${
                toast.type === 'order' 
                  ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400'
                  : toast.type === 'success'
                  ? 'bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400'
                  : 'bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400'
              }`}>
                {toast.type === 'order' ? (
                  <ShoppingBag className="h-4 w-4" />
                ) : toast.type === 'success' ? (
                  <Check className="h-4 w-4" />
                ) : (
                  <AlertCircle className="h-4 w-4" />
                )}
              </div>
              
              <div className="flex-1">
                <div className="flex justify-between items-start">
                  <h4 className="font-semibold text-sm text-gray-900 dark:text-gray-100">
                    {toast.title}
                  </h4>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      removeToast(toast.id);
                    }}
                    className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
                
                <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                  {toast.message}
                </p>
                
                {toast.orderNumber && (
                  <div className="mt-2 text-xs space-y-1">
                    <p className="text-gray-500 dark:text-gray-400">
                      Order: <span className="font-medium">{toast.orderNumber}</span>
                    </p>
                    <p className="text-gray-500 dark:text-gray-400">
                      Customer: <span className="font-medium">{toast.customerName}</span>
                    </p>
                    <p className="text-gray-500 dark:text-gray-400">
                      Amount: <span className="font-medium">{formatCurrency(toast.amount)}</span>
                    </p>
                  </div>
                )}
                
                <div className="mt-2 flex items-center justify-between">
                  <span className="text-[10px] text-gray-400">
                    {formatTime(toast.timestamp)}
                  </span>
                  <button className="text-xs text-blue-600 dark:text-blue-400 hover:underline font-medium">
                    View Details →
                  </button>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Order Details Modal */}
      {showOrderModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-[100] flex items-center justify-center p-2 sm:p-4">
          <div className="theme-surface rounded-lg sm:rounded-xl w-full max-w-full sm:max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
            {/* Modal Header */}
            <div className="p-2 sm:p-3 md:p-4 border-b theme-border flex justify-between items-center gap-2">
              <div className="flex items-center gap-1.5 sm:gap-2 md:gap-3 min-w-0">
                <ShoppingBag className="h-4 w-4 sm:h-5 sm:w-5 theme-primary-text flex-shrink-0" />
                <div className="min-w-0">
                  <h3 className="font-semibold theme-text text-sm sm:text-base truncate">
                    Order: {orderDetails?.orderNumber || 'N/A'}
                  </h3>
                  <p className="text-[10px] sm:text-xs theme-text-muted truncate">
                    {formatDate(orderDetails?.createdAt)}
                  </p>
                </div>
              </div>
              <button
                onClick={() => {
                  setShowOrderModal(false);
                  setOrderDetails(null);
                }}
                className="p-1 sm:p-1.5 hover:theme-secondary rounded-lg theme-text-muted hover:theme-primary-text flex-shrink-0"
              >
                <X className="h-4 w-4 sm:h-5 sm:w-5" />
              </button>
            </div>

            {/* Modal Content */}
            <div className="flex-1 overflow-y-auto p-2 sm:p-3 md:p-4">
              {loadingOrderDetails ? (
                <div className="flex flex-col items-center justify-center py-4 sm:py-6 md:py-8">
                  <div className="animate-spin rounded-full h-6 w-6 sm:h-8 sm:w-8 border-b-2 theme-primary"></div>
                  <span className="ml-2 theme-text text-xs sm:text-sm mt-2">Loading details...</span>
                </div>
              ) : orderDetails ? (
                <div className="space-y-3 sm:space-y-4 md:space-y-6">
                  {/* Customer Information */}
                  <div className="theme-panel rounded p-2 sm:p-3 md:p-4">
                    <h4 className="font-medium theme-text mb-1.5 sm:mb-2 md:mb-3 flex items-center gap-1 sm:gap-1.5 md:gap-2 text-xs sm:text-sm">
                      <User className="h-3 w-3 sm:h-3.5 sm:w-3.5 md:h-4 md:w-4" />
                      Customer Info
                    </h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 sm:gap-2 md:gap-3">
                      <div className="flex items-center gap-1 sm:gap-1.5 md:gap-2">
                        <div className="w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full theme-primary flex-shrink-0"></div>
                        <div className="min-w-0">
                          <p className="text-[10px] sm:text-xs theme-text-muted">Name</p>
                          <p className="font-medium theme-text text-xs sm:text-sm truncate">{orderDetails.customer?.name || 'N/A'}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-1 sm:gap-1.5 md:gap-2">
                        <Phone className="h-3 w-3 sm:h-3.5 sm:w-3.5 theme-text-muted flex-shrink-0" />
                        <div className="min-w-0">
                          <p className="text-[10px] sm:text-xs theme-text-muted">Phone</p>
                          <p className="font-medium theme-text text-xs sm:text-sm truncate">{orderDetails.customer?.phone || 'N/A'}</p>
                        </div>
                      </div>
                      {orderDetails.customer?.email && (
                        <div className="flex items-center gap-1 sm:gap-1.5 md:gap-2">
                          <div className="w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full bg-green-500 flex-shrink-0"></div>
                          <div className="min-w-0">
                            <p className="text-[10px] sm:text-xs theme-text-muted">Email</p>
                            <p className="font-medium theme-text text-xs sm:text-sm truncate">{orderDetails.customer.email}</p>
                          </div>
                        </div>
                      )}
                      <div className="flex items-center gap-1 sm:gap-1.5 md:gap-2">
                        <MapPin className="h-3 w-3 sm:h-3.5 sm:w-3.5 theme-text-muted flex-shrink-0" />
                        <div className="min-w-0">
                          <p className="text-[10px] sm:text-xs theme-text-muted">Location</p>
                          <p className="font-medium theme-text text-xs sm:text-sm truncate">{orderDetails.customer?.location || 'N/A'}</p>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Shipping Information */}
                  {orderDetails.shippingAddress && (
                    <div className="theme-panel rounded p-2 sm:p-3 md:p-4">
                      <h4 className="font-medium theme-text mb-1.5 sm:mb-2 md:mb-3 flex items-center gap-1 sm:gap-1.5 md:gap-2 text-xs sm:text-sm">
                        <MapPin className="h-3 w-3 sm:h-3.5 sm:w-3.5 md:h-4 md:w-4" />
                        Shipping
                      </h4>
                      <div className="space-y-1 sm:space-y-1.5 md:space-y-2">
                        <p className="text-xs sm:text-sm theme-text truncate">
                          {orderDetails.shippingAddress.street || orderDetails.customer?.location || 'N/A'}
                        </p>
                        <div className="flex gap-2 sm:gap-3 md:gap-4 text-xs sm:text-sm">
                          <span className="theme-text-muted">
                            {orderDetails.shippingAddress.city || 'N/A'}
                          </span>
                          <span className="theme-text-muted">
                            {orderDetails.shippingAddress.country || 'UG'}
                          </span>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Order Items */}
                  {orderDetails.items && orderDetails.items.length > 0 ? (
                    <div className="theme-panel rounded p-2 sm:p-3 md:p-4">
                      <h4 className="font-medium theme-text mb-1.5 sm:mb-2 md:mb-3 flex items-center gap-1 sm:gap-1.5 md:gap-2 text-xs sm:text-sm">
                        <Package className="h-3 w-3 sm:h-3.5 sm:w-3.5 md:h-4 md:w-4" />
                        Items ({orderDetails.items.length})
                      </h4>
                      <div className="space-y-1.5 sm:space-y-2 md:space-y-3">
                        {orderDetails.items.map((item, index) => (
                          <div key={`${item.productId || index}_${index}`} className="flex items-center justify-between p-1.5 sm:p-2 md:p-3 theme-surface rounded border theme-border">
                            <div className="flex items-center gap-1.5 sm:gap-2 md:gap-3 min-w-0">
                              {item.images?.[0] && (
                                <img
                                  src={item.images[0]}
                                  alt={item.productName}
                                  className="w-8 h-8 sm:w-10 sm:h-10 md:w-12 md:h-12 object-cover rounded flex-shrink-0"
                                />
                              )}
                              <div className="min-w-0">
                                <p className="font-medium theme-text text-xs sm:text-sm truncate">{item.productName || `Product ${index + 1}`}</p>
                                <p className="text-[10px] sm:text-xs theme-text-muted truncate">{item.productBrand || 'No brand'}</p>
                              </div>
                            </div>
                            <div className="text-right flex-shrink-0">
                              <p className="font-medium theme-text text-xs sm:text-sm">{formatCurrency(item.totalPrice)}</p>
                              <p className="text-[10px] sm:text-xs theme-text-muted">
                                {item.quantity || 0} × {formatCurrency(item.unitPrice || 0)}
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div className="theme-panel rounded p-2 sm:p-3 md:p-4">
                      <p className="theme-text-muted text-xs sm:text-sm">No items found</p>
                    </div>
                  )}

                  {/* Order Summary */}
                  <div className="theme-panel rounded p-2 sm:p-3 md:p-4">
                    <h4 className="font-medium theme-text mb-1.5 sm:mb-2 md:mb-3 flex items-center gap-1 sm:gap-1.5 md:gap-2 text-xs sm:text-sm">
                      <DollarSign className="h-3 w-3 sm:h-3.5 sm:w-3.5 md:h-4 md:w-4" />
                      Summary
                    </h4>
                    <div className="space-y-1 sm:space-y-1.5 md:space-y-2">
                      <div className="flex justify-between text-xs sm:text-sm">
                        <span className="theme-text-muted">Subtotal</span>
                        <span className="font-medium theme-text">{formatCurrency(orderDetails.subtotal || 0)}</span>
                      </div>
                      <div className="flex justify-between text-xs sm:text-sm">
                        <span className="theme-text-muted">Shipping</span>
                        <span className="font-medium theme-text">{formatCurrency(orderDetails.shippingFee || 0)}</span>
                      </div>
                      <div className="flex justify-between text-xs sm:text-sm">
                        <span className="theme-text-muted">Tax</span>
                        <span className="font-medium theme-text">{formatCurrency(orderDetails.taxAmount || 0)}</span>
                      </div>
                      {orderDetails.discountAmount > 0 && (
                        <div className="flex justify-between text-xs sm:text-sm">
                          <span className="theme-text-muted">Discount</span>
                          <span className="font-medium text-red-500">-{formatCurrency(orderDetails.discountAmount)}</span>
                        </div>
                      )}
                      <div className="border-t pt-1.5 sm:pt-2 md:pt-3 mt-1.5 sm:mt-2 md:mt-3 theme-border">
                        <div className="flex justify-between font-bold text-sm sm:text-base md:text-lg">
                          <span className="theme-text">Total</span>
                          <span className="theme-primary-text">
                            {formatCurrency(orderDetails.totalAmount || 0)}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Order Status & Payment */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-3 md:gap-4">
                    <div className="theme-panel rounded p-2 sm:p-3 md:p-4">
                      <h4 className="font-medium theme-text mb-1 sm:mb-1.5 md:mb-2 text-xs sm:text-sm">Status</h4>
                      <div className="flex items-center gap-1 sm:gap-1.5 md:gap-2">
                        <div className={`w-2 h-2 sm:w-2.5 sm:h-2.5 md:w-3 md:h-3 rounded-full ${
                          orderDetails.orderStatus === 'pending' ? 'bg-yellow-500' :
                          orderDetails.orderStatus === 'processing' ? 'theme-primary' :
                          orderDetails.orderStatus === 'delivered' ? 'bg-green-500' :
                          orderDetails.orderStatus === 'cancelled' ? 'bg-red-500' : 'bg-gray-500'
                        }`}></div>
                        <span className="font-medium theme-text text-xs sm:text-sm capitalize truncate">{orderDetails.orderStatus || 'unknown'}</span>
                      </div>
                      {orderDetails.deliveredAt && (
                        <p className="text-[10px] sm:text-xs theme-text-muted mt-1 sm:mt-1.5 md:mt-2">
                          Delivered: {formatDate(orderDetails.deliveredAt)}
                        </p>
                      )}
                    </div>
                    <div className="theme-panel rounded p-2 sm:p-3 md:p-4">
                      <h4 className="font-medium theme-text mb-1 sm:mb-1.5 md:mb-2 text-xs sm:text-sm">Payment</h4>
                      <div className="space-y-0.5 sm:space-y-1">
                        <div className="flex justify-between text-xs sm:text-sm">
                          <span className="theme-text-muted">Method:</span>
                          <span className="font-medium theme-text capitalize truncate">{orderDetails.paymentMethod || 'unknown'}</span>
                        </div>
                        <div className="flex justify-between text-xs sm:text-sm">
                          <span className="theme-text-muted">Status:</span>
                          <span className={`font-medium ${
                            orderDetails.paymentStatus === 'paid' ? 'text-green-500' :
                            orderDetails.paymentStatus === 'pending' ? 'text-yellow-500' :
                            'text-red-500'
                          }`}>
                            {orderDetails.paymentStatus || 'unknown'}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Notes */}
                  {orderDetails.notes && (
                    <div className="theme-panel rounded p-2 sm:p-3 md:p-4">
                      <h4 className="font-medium theme-text mb-1 sm:mb-1.5 md:mb-2 text-xs sm:text-sm">Notes</h4>
                      <p className="text-xs sm:text-sm theme-text">{orderDetails.notes}</p>
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-center py-4 sm:py-6 md:py-8">
                  <p className="theme-text-muted text-xs sm:text-sm">Unable to load details</p>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-2 sm:p-3 md:p-4 border-t theme-border flex justify-between gap-2">
              <button
                onClick={() => {
                  setShowOrderModal(false);
                  setOrderDetails(null);
                }}
                className="px-2 sm:px-3 md:px-4 py-1.5 sm:py-2 theme-text hover:theme-secondary rounded-lg transition-colors text-xs sm:text-sm"
              >
                Close
              </button>
              {orderDetails?.orderNumber && (
                <a
                  href={`/admin/orders?order=${orderDetails.orderNumber}`}
                  className="px-2 sm:px-3 md:px-4 py-1.5 sm:py-2 theme-primary theme-primary-hover text-white rounded-lg transition-colors text-xs sm:text-sm"
                  onClick={() => setShowOrderModal(false)}
                >
                  View Order
                </a>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default NotificationBell;