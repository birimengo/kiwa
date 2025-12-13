import React, { useState } from 'react';
import { Palette, Check, ChevronDown } from 'lucide-react';
import { useTheme } from '../../context/ThemeContext';

const ThemeSelector = () => {
  const { currentTheme, setTheme } = useTheme();
  const [isOpen, setIsOpen] = useState(false);

  const themeOptions = [
    {
      id: 'ocean',
      name: 'Ocean Theme',
      description: 'Fresh and calm (Default)',
      icon: '🌊',
      preview: 'bg-gradient-to-br from-blue-50 to-teal-50 border border-blue-200'
    },
    {
      id: 'light',
      name: 'Light Mode',
      description: 'Clean and bright',
      icon: '☀️',
      preview: 'bg-gradient-to-br from-white to-gray-50 border border-gray-200'
    },
    {
      id: 'dark',
      name: 'Dark Mode',
      description: 'Easy on the eyes',
      icon: '🌙',
      preview: 'bg-gradient-to-br from-gray-800 to-gray-900 border border-gray-700'
    }
  ];

  const currentThemeOption = themeOptions.find(theme => theme.id === currentTheme);

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center space-x-2 p-2 rounded-lg theme-secondary hover:theme-secondary-hover transition-colors theme-text"
        aria-label="Select theme"
        aria-expanded={isOpen}
      >
        <Palette className="h-5 w-5" />
        <ChevronDown className={`h-4 w-4 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <>
          {/* Backdrop */}
          <div 
            className="fixed inset-0 z-40" 
            onClick={() => setIsOpen(false)}
            aria-hidden="true"
          />
          
          {/* Dropdown */}
          <div className="absolute right-0 top-12 z-50 w-72 theme-surface rounded-lg shadow-lg theme-border border py-2">
            <div className="px-4 py-2 border-b theme-border">
              <h3 className="font-semibold theme-text">Select Theme</h3>
              <p className="text-sm theme-text-muted">
                Choose your preferred appearance
              </p>
            </div>
            
            <div className="py-2">
              {themeOptions.map((theme) => (
                <button
                  key={theme.id}
                  onClick={() => {
                    setTheme(theme.id);
                    setIsOpen(false);
                  }}
                  className={`w-full flex items-center justify-between px-4 py-3 text-left hover:theme-secondary transition-colors ${
                    currentTheme === theme.id ? 'bg-blue-50 dark:bg-blue-900/20' : ''
                  }`}
                  aria-label={`Select ${theme.name} theme`}
                >
                  <div className="flex items-center space-x-3">
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-lg ${theme.preview}`}>
                      {theme.icon}
                    </div>
                    <div>
                      <div className="font-medium theme-text">
                        {theme.name}
                        {theme.id === 'ocean' && (
                          <span className="ml-2 text-xs px-1.5 py-0.5 bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200 rounded-full">
                            Default
                          </span>
                        )}
                      </div>
                      <div className="text-sm theme-text-muted">
                        {theme.description}
                      </div>
                    </div>
                  </div>
                  
                  {currentTheme === theme.id && (
                    <Check className="h-5 w-5 theme-primary-text" />
                  )}
                </button>
              ))}
            </div>
            
            <div className="px-4 py-2 border-t theme-border">
              <div className="flex items-center justify-between text-sm">
                <span className="theme-text-muted">Current:</span>
                <span className="font-medium theme-text">
                  {currentThemeOption?.name}
                </span>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default ThemeSelector;