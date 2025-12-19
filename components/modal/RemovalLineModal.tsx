import React, { useState, useEffect } from 'react';
import { insertWorkRemoveStat } from '../../services/apiService';

/**
 * RemovalLineModal - 인입선로 철거관리 모달
 *
 * 레거시: insertWorkRemoveStat API 호출
 * - 철거배선상태, 철거상태, 미철거 사유 입력
 */
interface RemovalLineModalProps {
  isOpen: boolean;
  onClose: () => void;
  workId: string;
  onSuccess?: () => void;
  showToast?: (message: string, type: 'success' | 'error' | 'warning' | 'info') => void;
}

const RemovalLineModal: React.FC<RemovalLineModalProps> = ({
  isOpen,
  onClose,
  workId,
  onSuccess,
  showToast
}) => {
  const [isLoading, setIsLoading] = useState(false);

  // 철거배선상태 (REMOVE_LINE_TP)
  const [removeLineType, setRemoveLineType] = useState('');
  // 철거상태 (REMOVE_GB)
  const [removeStatus, setRemoveStatus] = useState('');
  // 미철거 사유 (REMOVE_STAT) - 미철거 선택시에만
  const [removeReason, setRemoveReason] = useState('');

  // 옵션들
  const removeLineTypeOptions = [
    { value: '1', label: '간선공용' },
    { value: '2', label: '1:1배선' },
    { value: '3', label: '공동인입' },
    { value: '4', label: '단독인입' },
  ];

  const removeStatusOptions = [
    { value: '4', label: '완전철거' },
    { value: '1', label: '미철거' },
  ];

  const removeReasonOptions = [
    { value: '5', label: '출입불가' },
    { value: '6', label: '2층1인' },
    { value: '7', label: '특수지역' },
  ];

  // 모달 열릴 때 초기화
  useEffect(() => {
    if (isOpen) {
      setRemoveLineType('');
      setRemoveStatus('');
      setRemoveReason('');
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSave = async () => {
    // 검증
    if (!removeLineType) {
      showToast?.('철거배선상태를 선택해주세요.', 'error');
      return;
    }
    if (!removeStatus) {
      showToast?.('철거상태를 선택해주세요.', 'error');
      return;
    }
    if (removeStatus === '1' && !removeReason) {
      showToast?.('미철거 사유를 선택해주세요.', 'error');
      return;
    }

    setIsLoading(true);
    try {
      const result = await insertWorkRemoveStat({
        WRK_ID: workId,
        REMOVE_LINE_TP: removeLineType,
        REMOVE_GB: removeStatus,
        REMOVE_STAT: removeStatus === '1' ? removeReason : '',
      });

      if (result.code === 'SUCCESS') {
        showToast?.('철거상태가 저장되었습니다.', 'success');
        onSuccess?.();
        onClose();
      } else {
        showToast?.(result.message || '저장에 실패했습니다.', 'error');
      }
    } catch (error: any) {
      showToast?.(error.message || '저장 중 오류가 발생했습니다.', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative bg-white rounded-xl shadow-2xl w-[95%] max-w-md mx-4 max-h-[85vh] overflow-hidden">
        {/* Header */}
        <div className="px-3 sm:px-4 py-2.5 sm:py-3 border-b border-gray-200 bg-gray-50">
          <div className="flex items-center justify-between">
            <h2 className="text-base sm:text-lg font-bold text-gray-900">인입선로 철거관리</h2>
            <button
              onClick={onClose}
              className="p-1 hover:bg-gray-200 rounded-full transition-colors"
            >
              <svg className="w-6 h-6 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-3 sm:p-4 overflow-y-auto max-h-[60vh]">
          <div className="space-y-3 sm:space-y-4">
            {/* 철거배선상태 */}
            <div>
              <label className="block text-xs sm:text-sm font-semibold text-gray-700 mb-1.5 sm:mb-2">
                철거배선상태 <span className="text-red-500">*</span>
              </label>
              <div className="grid grid-cols-2 gap-1.5 sm:gap-2">
                {removeLineTypeOptions.map(opt => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setRemoveLineType(opt.value)}
                    className={`px-2 sm:px-3 py-2 sm:py-3 rounded-lg text-xs sm:text-sm font-medium transition-colors ${
                      removeLineType === opt.value
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {/* 철거상태 */}
            <div>
              <label className="block text-xs sm:text-sm font-semibold text-gray-700 mb-1.5 sm:mb-2">
                철거상태 <span className="text-red-500">*</span>
              </label>
              <div className="grid grid-cols-2 gap-1.5 sm:gap-2">
                {removeStatusOptions.map(opt => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => {
                      setRemoveStatus(opt.value);
                      if (opt.value !== '1') {
                        setRemoveReason('');
                      }
                    }}
                    className={`px-2 sm:px-3 py-2 sm:py-3 rounded-lg text-xs sm:text-sm font-medium transition-colors ${
                      removeStatus === opt.value
                        ? opt.value === '4' ? 'bg-green-600 text-white' : 'bg-orange-600 text-white'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {/* 미철거 사유 - 미철거 선택시에만 표시 */}
            {removeStatus === '1' && (
              <div>
                <label className="block text-xs sm:text-sm font-semibold text-gray-700 mb-1.5 sm:mb-2">
                  미철거 사유 <span className="text-red-500">*</span>
                </label>
                <div className="grid grid-cols-3 gap-1.5 sm:gap-2">
                  {removeReasonOptions.map(opt => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setRemoveReason(opt.value)}
                      className={`px-2 sm:px-3 py-2 sm:py-3 rounded-lg text-xs sm:text-sm font-medium transition-colors ${
                        removeReason === opt.value
                          ? 'bg-orange-600 text-white'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
                <p className="mt-1.5 sm:mt-2 text-xs text-orange-600">
                  * 미철거 시 AS작업이 자동 할당됩니다.
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-3 sm:px-4 py-2.5 sm:py-3 border-t border-gray-200 bg-gray-50">
          <div className="flex gap-1.5 sm:gap-2">
            <button
              onClick={onClose}
              className="flex-1 px-3 sm:px-4 py-2 sm:py-3 bg-gray-200 text-gray-700 rounded-lg font-semibold hover:bg-gray-300 transition-colors text-sm sm:text-base"
            >
              취소
            </button>
            <button
              onClick={handleSave}
              disabled={isLoading}
              className="flex-1 px-3 sm:px-4 py-2 sm:py-3 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition-colors disabled:opacity-50 text-sm sm:text-base"
            >
              {isLoading ? '저장 중...' : '저장'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default RemovalLineModal;
