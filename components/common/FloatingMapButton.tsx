import React from 'react';
import { Map } from 'lucide-react';

interface FloatingMapButtonProps {
  onClick: () => void;
  workCount?: number;
}

const FloatingMapButton: React.FC<FloatingMapButtonProps> = ({ onClick, workCount }) => {
  return (
    <button
      onClick={onClick}
      className="fixed bottom-24 right-4 z-40 w-14 h-14 bg-blue-500 hover:bg-blue-600 active:bg-blue-700 text-white rounded-full shadow-lg flex items-center justify-center transition-all duration-200 hover:scale-105 active:scale-95"
      style={{
        boxShadow: '0 4px 14px rgba(59, 130, 246, 0.4)'
      }}
      title="지도에서 보기"
    >
      <Map className="w-6 h-6" />
      {workCount !== undefined && workCount > 0 && (
        <span className="absolute -top-1 -right-1 min-w-5 h-5 px-1.5 bg-red-500 text-white text-xs font-bold rounded-full flex items-center justify-center">
          {workCount > 99 ? '99+' : workCount}
        </span>
      )}
    </button>
  );
};

export default FloatingMapButton;
