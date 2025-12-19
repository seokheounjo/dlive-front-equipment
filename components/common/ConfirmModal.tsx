import React from 'react';
import { AlertTriangle, CheckCircle, Info, XCircle } from 'lucide-react';

/**
 * ConfirmModal - 공통 확인 모달
 *
 * 레거시 cfn_SetMsg 스타일 구현
 * - type: 'confirm' | 'warning' | 'info' | 'error'
 * - 확인/취소 버튼
 */

export type ConfirmModalType = 'confirm' | 'warning' | 'info' | 'error';

interface ConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title?: string;
  message: string;
  type?: ConfirmModalType;
  confirmText?: string;
  cancelText?: string;
  showCancel?: boolean;
}

const ConfirmModal: React.FC<ConfirmModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  type = 'confirm',
  confirmText = '확인',
  cancelText = '취소',
  showCancel = true
}) => {
  if (!isOpen) return null;

  const getIcon = () => {
    switch (type) {
      case 'warning':
        return <AlertTriangle className="w-12 h-12 text-yellow-500" />;
      case 'error':
        return <XCircle className="w-12 h-12 text-red-500" />;
      case 'info':
        return <Info className="w-12 h-12 text-blue-500" />;
      case 'confirm':
      default:
        return <CheckCircle className="w-12 h-12 text-green-500" />;
    }
  };

  const getHeaderColor = () => {
    switch (type) {
      case 'warning':
        return 'bg-yellow-50 border-yellow-200';
      case 'error':
        return 'bg-red-50 border-red-200';
      case 'info':
        return 'bg-blue-50 border-blue-200';
      case 'confirm':
      default:
        return 'bg-green-50 border-green-200';
    }
  };

  const getConfirmButtonColor = () => {
    switch (type) {
      case 'warning':
        return 'bg-yellow-500 hover:bg-yellow-600';
      case 'error':
        return 'bg-red-500 hover:bg-red-600';
      case 'info':
        return 'bg-blue-500 hover:bg-blue-600';
      case 'confirm':
      default:
        return 'bg-blue-500 hover:bg-blue-600';
    }
  };

  const handleConfirm = () => {
    onConfirm();
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative bg-white rounded-xl shadow-2xl w-[90%] max-w-sm mx-4 overflow-hidden animate-in fade-in zoom-in duration-200">
        {/* Header with Icon */}
        <div className={`px-4 sm:px-6 py-4 sm:py-5 flex flex-col items-center border-b ${getHeaderColor()}`}>
          {getIcon()}
          {title && (
            <h3 className="mt-2 sm:mt-3 text-base sm:text-lg font-bold text-gray-900 text-center">
              {title}
            </h3>
          )}
        </div>

        {/* Message */}
        <div className="px-4 sm:px-6 py-4 sm:py-5">
          <p className="text-center text-gray-700 whitespace-pre-line text-sm sm:text-base">
            {message}
          </p>
        </div>

        {/* Buttons */}
        <div className="px-3 sm:px-4 py-3 sm:py-4 bg-gray-50 flex gap-2 sm:gap-3">
          {showCancel && (
            <button
              onClick={onClose}
              className="flex-1 px-3 sm:px-4 py-2 sm:py-3 bg-gray-200 text-gray-700 rounded-lg font-semibold hover:bg-gray-300 transition-colors text-sm sm:text-base"
            >
              {cancelText}
            </button>
          )}
          <button
            onClick={handleConfirm}
            className={`flex-1 px-3 sm:px-4 py-2 sm:py-3 text-white rounded-lg font-semibold transition-colors text-sm sm:text-base ${getConfirmButtonColor()}`}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ConfirmModal;

// useConfirm 훅 - 컴포넌트에서 쉽게 사용하기 위한 상태 관리
export interface UseConfirmState {
  isOpen: boolean;
  message: string;
  title?: string;
  type: ConfirmModalType;
  onConfirm: () => void;
}

export const useConfirmInitialState: UseConfirmState = {
  isOpen: false,
  message: '',
  title: undefined,
  type: 'confirm',
  onConfirm: () => {}
};
