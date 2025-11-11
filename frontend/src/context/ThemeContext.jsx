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
    const saved = localStorage.getItem('theme');
    return saved ? JSON.parse(saved) : 'light';
  });

  useEffect(() => {
    localStorage.setItem('theme', JSON.stringify(currentTheme));
    
    // Remove all theme classes
    const themes = ['light', 'dark', 'ocean'];
    themes.forEach(theme => {
      if (theme !== 'light') { // Don't remove 'light' as it's the default
        document.documentElement.classList.remove(theme);
      }
    });
    
    // Add current theme class (only if it's not light)
    if (currentTheme !== 'light') {
      document.documentElement.classList.add(currentTheme);
    } else {
      // Ensure light theme is active by removing others
      document.documentElement.classList.remove('dark', 'ocean');
    }
  }, [currentTheme]);

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