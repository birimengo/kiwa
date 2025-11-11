import React, { useState } from 'react';
import { HelpCircle } from 'lucide-react';

const ManualInstall = () => {
  const [showInstructions, setShowInstructions] = useState(false);

  return (
    <div className="fixed bottom-4 left-4 z-40">
      {showInstructions && (
        <div className="bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg shadow-lg p-4 max-w-sm mb-2">
          <h3 className="font-semibold text-sm mb-2 text-gray-900 dark:text-white">
            How to Install ElectroShop:
          </h3>
          <ul className="text-xs text-gray-600 dark:text-gray-300 space-y-2">
            <li className="flex items-start">
              <span className="font-semibold text-blue-600 mr-2">• Chrome:</span>
              <span>Click "⋮" → "Install ElectroShop"</span>
            </li>
            <li className="flex items-start">
              <span className="font-semibold text-blue-600 mr-2">• Safari:</span>
              <span>Click "↗" → "Add to Home Screen"</span>
            </li>
            <li className="flex items-start">
              <span className="font-semibold text-blue-600 mr-2">• Android:</span>
              <span>"⋮" → "Add to Home screen"</span>
            </li>
            <li className="flex items-start">
              <span className="font-semibold text-blue-600 mr-2">• Edge:</span>
              <span>"⋯" → "Apps" → "Install this site as an app"</span>
            </li>
          </ul>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
            Install for quick access and offline use!
          </p>
        </div>
      )}
      
      <button
        onClick={() => setShowInstructions(!showInstructions)}
        className="bg-blue-600 text-white p-3 rounded-full shadow-lg hover:bg-blue-700 transition-colors flex items-center justify-center"
        title="Installation Help"
      >
        <HelpCircle className="w-5 h-5" />
      </button>
    </div>
  );
};

export default ManualInstall;