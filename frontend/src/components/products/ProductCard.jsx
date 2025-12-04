import React, { useState } from 'react';
import { Filter, ChevronDown, ChevronUp } from 'lucide-react';

const HorizontalFilterBar = () => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [selectedSort, setSelectedSort] = useState('newest');

  return (
    <div className="w-full">
      {/* Compact Filter Bar (for small screens) */}
      <div className="md:hidden bg-white p-4 rounded-lg shadow">
        <div className="flex justify-between items-center">
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="flex items-center space-x-2 text-gray-700 font-medium"
          >
            <Filter className="h-5 w-5" />
            <span>Filters & Sort</span>
            {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </button>
          
          {/* Quick Sort Dropdown */}
          <select
            value={selectedSort}
            onChange={(e) => setSelectedSort(e.target.value)}
            className="text-sm p-2 border rounded"
          >
            <option value="newest">Newest</option>
            <option value="price-low">Price: Low to High</option>
            <option value="price-high">Price: High to Low</option>
          </select>
        </div>

        {/* Expanded Filters */}
        {isExpanded && (
          <div className="mt-4 pt-4 border-t space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <button className="py-2 px-3 bg-blue-50 text-blue-600 rounded-lg text-sm font-medium">
                Electronics
              </button>
              <button className="py-2 px-3 bg-gray-100 text-gray-700 rounded-lg text-sm font-medium">
                Clothing
              </button>
              <button className="py-2 px-3 bg-gray-100 text-gray-700 rounded-lg text-sm font-medium">
                Home & Garden
              </button>
              <button className="py-2 px-3 bg-gray-100 text-gray-700 rounded-lg text-sm font-medium">
                Books
              </button>
            </div>
            
            <div>
              <label className="block text-sm font-medium mb-2">Price Range</label>
              <div className="flex items-center space-x-2">
                <input
                  type="number"
                  placeholder="Min"
                  className="flex-1 p-2 border rounded text-sm"
                />
                <span className="text-gray-500">-</span>
                <input
                  type="number"
                  placeholder="Max"
                  className="flex-1 p-2 border rounded text-sm"
                />
              </div>
            </div>
            
            <button className="w-full py-2 bg-blue-600 text-white rounded-lg font-medium">
              Apply Filters
            </button>
          </div>
        )}
      </div>

      {/* Desktop Filter Bar */}
      <div className="hidden md:flex items-center justify-between bg-white p-4 rounded-lg shadow">
        <div className="flex items-center space-x-4">
          <span className="font-medium">Filter by:</span>
          <select className="p-2 border rounded">
            <option>Category</option>
            <option>Electronics</option>
            <option>Clothing</option>
            <option>Home & Garden</option>
          </select>
          <select className="p-2 border rounded">
            <option>Price Range</option>
            <option>Under UGX 50,000</option>
            <option>UGX 50,000 - 100,000</option>
            <option>Over UGX 100,000</option>
          </select>
          <select className="p-2 border rounded">
            <option>Brand</option>
            <option>Samsung</option>
            <option>Apple</option>
            <option>Nike</option>
          </select>
        </div>
        
        <div className="flex items-center space-x-4">
          <span className="font-medium">Sort by:</span>
          <select
            value={selectedSort}
            onChange={(e) => setSelectedSort(e.target.value)}
            className="p-2 border rounded"
          >
            <option value="newest">Newest First</option>
            <option value="price-low">Price: Low to High</option>
            <option value="price-high">Price: High to Low</option>
            <option value="popular">Most Popular</option>
          </select>
        </div>
      </div>
    </div>
  );
};

export default HorizontalFilterBar;