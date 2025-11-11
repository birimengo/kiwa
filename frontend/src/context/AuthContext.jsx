import React, { createContext, useState, useContext, useEffect } from 'react';

const AuthContext = createContext();

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [guest, setGuest] = useState({ id: 'guest', name: 'Guest', role: 'guest' });

  useEffect(() => {
    const token = localStorage.getItem('token');
    const userData = localStorage.getItem('user');
    
    if (token && userData) {
      setUser(JSON.parse(userData));
    }
    setLoading(false);
  }, []);

  const login = (userData, token) => {
    localStorage.setItem('token', token);
    localStorage.setItem('user', JSON.stringify(userData));
    setUser(userData);
  };

  const logout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setUser(null);
  };

  const requireAuth = (action) => {
    if (!user) {
      // Store the intended action to perform after login
      const redirectAction = {
        type: action.type,
        productId: action.productId,
        quantity: action.quantity
      };
      localStorage.setItem('pendingAction', JSON.stringify(redirectAction));
      return false;
    }
    return true;
  };

  const value = {
    user: user || guest, // Always return user or guest
    isLoggedIn: !!user,
    isGuest: !user,
    isAdmin: user?.role === 'admin',
    login,
    logout,
    requireAuth
  };

  return (
    <AuthContext.Provider value={value}>
      {!loading && children}
    </AuthContext.Provider>
  );
};