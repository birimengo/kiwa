// src/components/RootRedirect.jsx
import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const RootRedirect = () => {
  const { user } = useAuth();
  
  if (!user) {
    return <Navigate to="/products" replace />;
  }
  
  if (user.role === 'admin') {
    return <Navigate to="/admin" replace />;
  }
  
  return <Navigate to="/products" replace />;
};

export default RootRedirect;