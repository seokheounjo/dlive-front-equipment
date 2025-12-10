import React from 'react';

interface ErrorMessageProps {
  type?: 'error' | 'warning' | 'info';
  message: string;
  onRetry?: () => void;
  onClose?: () => void;
  className?: string;
}

const ErrorMessage: React.FC<ErrorMessageProps> = ({
  type = 'error',
  message,
  onRetry,
  onClose,
  className = ''
}) => {
  // 타입별 색상 및 아이콘 클래스
  const typeStyles = {
    error: {
      bg: 'bg-red-50',
      border: 'border-red-200',
      text: 'text-red-800',
      iconBg: 'bg-red-100',
      iconColor: 'text-red-500',
      buttonBg: 'bg-red-500 hover:bg-red-600'
    },
    warning: {
      bg: 'bg-yellow-50',
      border: 'border-yellow-200',
      text: 'text-yellow-800',
      iconBg: 'bg-yellow-100',
      iconColor: 'text-yellow-500',
      buttonBg: 'bg-yellow-500 hover:bg-yellow-600'
    },
    info: {
      bg: 'bg-blue-50',
      border: 'border-blue-200',
      text: 'text-blue-800',
      iconBg: 'bg-blue-100',
      iconColor: 'text-blue-500',
      buttonBg: 'bg-blue-500 hover:bg-blue-600'
    }
  };

  const styles = typeStyles[type];

  // 타입별 아이콘
  const renderIcon = () => {
    switch (type) {
      case 'error':
        return (
          <svg
            className="w-6 h-6"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
        );
      case 'warning':
        return (
          <svg
            className="w-6 h-6"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
            />
          </svg>
        );
      case 'info':
        return (
          <svg
            className="w-6 h-6"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
        );
    }
  };

  return (
    <div
      className={`
        ${styles.bg}
        ${styles.border}
        border rounded-lg p-4
        ${className}
      `}
    >
      <div className="flex items-start gap-3">
        {/* 아이콘 */}
        <div className={`${styles.iconBg} ${styles.iconColor} rounded-full p-2 flex-shrink-0`}>
          {renderIcon()}
        </div>

        {/* 메시지 영역 */}
        <div className="flex-1 min-w-0">
          <p className={`${styles.text} text-sm font-medium`}>
            {message}
          </p>

          {/* 재시도 버튼 */}
          {onRetry && (
            <button
              onClick={onRetry}
              className={`
                mt-3
                ${styles.buttonBg}
                text-white
                px-4 py-2
                rounded-lg
                text-sm
                font-medium
                transition-colors
                duration-200
                flex
                items-center
                gap-2
              `}
            >
              <svg
                className="w-4 h-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                />
              </svg>
              다시 시도
            </button>
          )}
        </div>

        {/* 닫기 버튼 */}
        {onClose && (
          <button
            onClick={onClose}
            className={`${styles.text} hover:opacity-70 transition-opacity flex-shrink-0`}
            aria-label="닫기"
          >
            <svg
              className="w-5 h-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        )}
      </div>
    </div>
  );
};

export default ErrorMessage;
