import React from 'react';
import { CheckCircle, XCircle, AlertCircle, Info } from 'lucide-react';

export type ToastType = 'success' | 'error' | 'warning' | 'info';

interface ToastProps {
  message: string;
  type?: ToastType;
  duration?: number;
  persistent?: boolean;
  onClose: () => void;
}

const Toast: React.FC<ToastProps> = ({ message, type = 'info', onClose }) => {
  const getIcon = () => {
    switch (type) {
      case 'success':
        return <CheckCircle className="w-8 h-8 text-green-500" />;
      case 'error':
        return <XCircle className="w-8 h-8 text-red-500" />;
      case 'warning':
        return <AlertCircle className="w-8 h-8 text-yellow-500" />;
      default:
        return <Info className="w-8 h-8 text-blue-500" />;
    }
  };

  const getButtonColor = () => {
    switch (type) {
      case 'success':
        return 'bg-green-500 hover:bg-green-600 active:bg-green-700';
      case 'error':
        return 'bg-red-500 hover:bg-red-600 active:bg-red-700';
      case 'warning':
        return 'bg-yellow-500 hover:bg-yellow-600 active:bg-yellow-700';
      default:
        return 'bg-blue-500 hover:bg-blue-600 active:bg-blue-700';
    }
  };

  const getTitle = () => {
    switch (type) {
      case 'success': return '완료';
      case 'error': return '오류';
      case 'warning': return '주의';
      default: return '알림';
    }
  };

  return (
    <div className="fixed inset-0 flex items-center justify-center" style={{ zIndex: 9999 }}>
      <div className="fixed inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-[85vw] max-w-[320px] overflow-hidden">
        <div className="flex flex-col items-center px-6 pt-6 pb-4">
          {getIcon()}
          <h3 className="mt-3 text-base font-bold text-gray-900">{getTitle()}</h3>
          <p className="mt-2 text-sm text-gray-600 text-center leading-relaxed whitespace-pre-line">{message}</p>
        </div>
        <div className="px-6 pb-6">
          <button
            onClick={onClose}
            className={`w-full py-3 text-sm font-semibold text-white rounded-xl transition-colors ${getButtonColor()}`}
          >
            확인
          </button>
        </div>
      </div>
    </div>
  );
};

export default Toast;
