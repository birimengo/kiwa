import React, { createContext, useContext, useEffect, useState } from 'react';

const ThemeContext = createContext();

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};

export const ThemeProvider = ({ children }) => {
  const [currentTheme, setCurrentTheme] = useState(() => {
    // Check localStorage first, then system preference, default to dark
    const saved = localStorage.getItem('theme');
    if (saved) return JSON.parse(saved);
    
    // Check system preference
    if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
      return 'dark';
    }
    
    return 'dark'; // Final fallback to dark
  });

  useEffect(() => {
    // Save to localStorage
    localStorage.setItem('theme', JSON.stringify(currentTheme));
    
    // Apply theme to document element
    const root = document.documentElement;
    
    // Remove all theme classes
    root.classList.remove('light', 'dark', 'ocean');
    
    // Add current theme class
    root.classList.add(currentTheme);
    
    // Also set data-theme attribute for additional CSS targeting
    root.setAttribute('data-theme', currentTheme);
    
  }, [currentTheme]);

  // Optional: Listen for system theme changes
  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    
    const handleChange = (e) => {
      // Only auto-switch if user hasn't explicitly chosen a theme
      const saved = localStorage.getItem('theme');
      if (!saved) {
        setCurrentTheme(e.matches ? 'dark' : 'light');
      }
    };
    
    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, []);

  const setTheme = (themeName) => {
    if (['light', 'dark', 'ocean'].includes(themeName)) {
      setCurrentTheme(themeName);
    }
  };

  const value = {
    currentTheme,
    setTheme,
  };

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
};