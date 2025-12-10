import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown, Check } from 'lucide-react';

interface SelectOption {
  value: string;
  label: string;
}

interface SelectProps {
  value: string;
  onValueChange: (value: string) => void;
  options: SelectOption[];
  placeholder?: string;
  className?: string;
  required?: boolean;
  disabled?: boolean;
}

const Select: React.FC<SelectProps> = ({
  value,
  onValueChange,
  options = [],
  placeholder = "선택하세요",
  className = "",
  required = false,
  disabled = false
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [mounted, setMounted] = useState(false);

  // 클라이언트 마운트 확인
  useEffect(() => {
    setMounted(true);
  }, []);

  // 선택된 옵션 찾기
  const selectedOption = options?.find(option => option.value === value);

  // ESC 키 감지
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
      return () => document.removeEventListener('keydown', handleKeyDown);
    }
  }, [isOpen]);

  const handleSelect = (optionValue: string) => {
    onValueChange(optionValue);
    setIsOpen(false);
  };

  return (
    <div className={`relative ${className}`} style={{ zIndex: 'auto' }}>
      {/* 트리거 버튼 */}
      <button
        type="button"
        onClick={() => !disabled && setIsOpen(!isOpen)}
        disabled={disabled}
        className={`
          w-full p-3 text-left border border-gray-300 rounded-lg
          transition-colors duration-200 flex items-center justify-between
          ${disabled
            ? 'bg-gray-100 cursor-not-allowed opacity-60'
            : 'bg-white hover:border-gray-400 focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500'
          }
          ${isOpen && !disabled ? 'ring-2 ring-cyan-500 border-cyan-500' : ''}
        `}
        aria-expanded={isOpen}
        aria-haspopup="listbox"
        required={required}
      >
        <span className={`text-base ${selectedOption ? 'text-gray-900' : 'text-gray-500'}`}>
          {selectedOption ? selectedOption.label : placeholder}
        </span>
        <ChevronDown
          className={`w-4 h-4 text-gray-400 transition-transform duration-200 ${
            isOpen ? 'rotate-180' : ''
          }`}
        />
      </button>

      {/* 드롭다운 메뉴 - Portal로 document.body에 렌더링 */}
      {isOpen && mounted && typeof window !== 'undefined' && createPortal(
        <>
          {/* 오버레이 - 전체 화면 가리기 */}
          <div
            className="fixed inset-0 bg-black/50"
            style={{ zIndex: 99999 }}
            onClick={() => setIsOpen(false)}
          />

          {/* 옵션 리스트 - 하단 시트 스타일 (모든 화면 크기) */}
          <div
            className="fixed bottom-0 left-0 right-0 bg-white rounded-t-xl shadow-2xl"
            style={{
              zIndex: 100000,
              maxHeight: '60vh',
              display: 'flex',
              flexDirection: 'column',
            }}
          >
            {/* 핸들 */}
            <div className="flex justify-center py-3 bg-white rounded-t-xl" style={{ flexShrink: 0 }}>
              <div className="w-8 h-1 bg-gray-300 rounded-full"></div>
            </div>

            {/* 스크롤 가능한 옵션 영역 */}
            <div
              style={{
                flex: 1,
                overflowY: 'auto',
                minHeight: 0,
                WebkitOverflowScrolling: 'touch',
              }}
            >
              <div className="py-1">
                {options?.length > 0 ? options.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => handleSelect(option.value)}
                    className={`
                      w-full px-4 py-3 text-left text-base hover:bg-gray-50
                      transition-colors duration-150 flex items-center justify-between
                      ${value === option.value ? 'bg-cyan-50 text-cyan-700' : 'text-gray-900'}
                    `}
                    role="option"
                    aria-selected={value === option.value}
                  >
                    <span className="font-medium">{option.label}</span>
                    {value === option.value && (
                      <Check className="w-5 h-5 text-cyan-600" />
                    )}
                  </button>
                )) : (
                  <div className="px-4 py-3 text-center text-gray-500 text-sm">
                    옵션이 없습니다
                  </div>
                )}
              </div>
            </div>

            {/* 취소 버튼 - 항상 하단 고정 */}
            <div
              className="p-4 border-t border-gray-200 bg-white"
              style={{
                flexShrink: 0,
                paddingBottom: 'calc(1rem + env(safe-area-inset-bottom))',
              }}
            >
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="w-full py-3 text-center text-gray-600 font-medium"
              >
                취소
              </button>
            </div>
          </div>
        </>,
        document.body
      )}
    </div>
  );
};

export default Select;
