import React, { useEffect } from 'react';
import { CheckCircle, XCircle, AlertCircle, Info } from 'lucide-react';

export type ToastType = 'success' | 'error' | 'warning' | 'info';

interface ToastProps {
  message: string;
  type?: ToastType;
  duration?: number;
  persistent?: boolean; // true면 확인 버튼 눌러야 닫힘
  onClose: () => void;
}

const Toast: React.FC<ToastProps> = ({ message, type = 'info', duration = 3000, persistent = false, onClose }) => {
  // error 타입은 항상 persistent (사용자가 X 눌러야 닫힘)
  const isPersistent = persistent || type === 'error';

  useEffect(() => {
    if (isPersistent) return;

    const timer = setTimeout(() => {
      onClose();
    }, duration);

    return () => clearTimeout(timer);
  }, [duration, onClose, isPersistent]);

  const getIcon = () => {
    switch (type) {
      case 'success':
        return <CheckCircle className="w-5 h-5 text-green-500" />;
      case 'error':
        return <XCircle className="w-5 h-5 text-red-500" />;
      case 'warning':
        return <AlertCircle className="w-5 h-5 text-yellow-500" />;
      default:
        return <Info className="w-5 h-5 text-blue-500" />;
    }
  };

  const getBackgroundColor = () => {
    switch (type) {
      case 'success':
        return 'bg-green-50 border-green-200';
      case 'error':
        return 'bg-red-50 border-red-200';
      case 'warning':
        return 'bg-yellow-50 border-yellow-200';
      default:
        return 'bg-blue-50 border-blue-200';
    }
  };

  return (
    <div className="fixed top-20 left-1/2 transform -translate-x-1/2 animate-slide-down" style={{ zIndex: 9999 }}>
      <div className={`flex items-center gap-3 px-4 py-3 rounded-lg shadow-lg border ${getBackgroundColor()} min-w-[300px] max-w-[90vw]`}>
        {getIcon()}
        <p className="text-sm font-medium text-gray-900 flex-1">{message}</p>
        {persistent && type !== 'error' ? (
          <button
            onClick={onClose}
            className="px-3 py-1 bg-gray-800 text-white text-xs font-semibold rounded hover:bg-gray-700 transition-colors"
          >
            확인
          </button>
        ) : (
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <XCircle className="w-4 h-4" />
          </button>
        )}
      </div>
    </div>
  );
};

export default Toast;

