import React from 'react';

interface LoadingSpinnerProps {
  size?: 'small' | 'medium' | 'large';
  color?: 'blue' | 'cyan' | 'gray' | 'white';
  message?: string;
  fullScreen?: boolean;
  className?: string;
}

const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({
  size = 'medium',
  color = 'cyan',
  message,
  fullScreen = false,
  className = ''
}) => {
  // 크기별 클래스
  const sizeClasses = {
    small: 'h-4 w-4 border-2',
    medium: 'h-8 w-8 border-2',
    large: 'h-12 w-12 border-3'
  };

  // 색상별 클래스
  const colorClasses = {
    blue: 'border-blue-500 border-t-transparent',
    cyan: 'border-cyan-500 border-t-transparent',
    gray: 'border-gray-500 border-t-transparent',
    white: 'border-white border-t-transparent'
  };

  // 메시지 텍스트 크기
  const textSizeClasses = {
    small: 'text-xs',
    medium: 'text-sm',
    large: 'text-base'
  };

  const spinnerElement = (
    <div className="flex flex-col items-center justify-center gap-2 sm:gap-3">
      {/* 스피너 */}
      <div
        className={`
          ${sizeClasses[size]}
          ${colorClasses[color]}
          rounded-full animate-spin
        `}
      />

      {/* 메시지 */}
      {message && (
        <p className={`${textSizeClasses[size]} text-gray-600 text-center`}>
          {message}
        </p>
      )}
    </div>
  );

  if (fullScreen) {
    return (
      <div className={`fixed inset-0 bg-white/80 backdrop-blur-sm flex items-center justify-center z-50 ${className}`}>
        {spinnerElement}
      </div>
    );
  }

  return (
    <div className={`flex items-center justify-center p-8 ${className}`}>
      {spinnerElement}
    </div>
  );
};

export default LoadingSpinner;
