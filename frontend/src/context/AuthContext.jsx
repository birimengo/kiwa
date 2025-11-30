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
  const [token, setToken] = useState(null);

  useEffect(() => {
    const storedToken = localStorage.getItem('token');
    const userData = localStorage.getItem('user');
    
    if (storedToken && userData) {
      setToken(storedToken);
      setUser(JSON.parse(userData));
    }
    setLoading(false);
  }, []);

  const login = (userData, authToken) => {
    localStorage.setItem('token', authToken);
    localStorage.setItem('user', JSON.stringify(userData));
    setToken(authToken);
    setUser(userData);
  };

  const logout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setToken(null);
    setUser(null);
  };

  const requireAuth = (action) => {
    if (!user || !token) {
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

  // Check if token is valid (not expired)
  const isTokenValid = () => {
    if (!token) return false;
    
    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      return payload.exp * 1000 > Date.now();
    } catch (error) {
      console.error('Token validation error:', error);
      return false;
    }
  };

  const value = {
    user: user,
    token: token,
    isLoggedIn: !!user && !!token && isTokenValid(),
    isGuest: !user || !token,
    isAdmin: user?.role === 'admin',
    login,
    logout,
    requireAuth,
    isTokenValid
  };

  return (
    <AuthContext.Provider value={value}>
      {!loading && children}
    </AuthContext.Provider>
  );
};