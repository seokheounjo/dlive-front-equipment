import React, { useState } from 'react';
import { X } from 'lucide-react';

interface RemovalLineManageModalProps {
  isOpen: boolean;
  onClose: () => void;
  onComplete: (data: RemovalLineData) => void;
  onAssignAS: (data: RemovalLineData) => void;
  showToast?: (message: string, type: 'success' | 'error' | 'warning' | 'info') => void;
}

export interface RemovalLineData {
  REMOVE_LINE_TP: string;  // 철거배선상태 (1:간선공용, 2:1:1배선, 3:공동인입, 4:단독인입)
  REMOVE_GB: string;       // 철거상태 (1:미철거, 4:완전철거)
  REMOVE_STAT: string;     // 미철거 사유 (5:출입불가, 6:2층1인, 7:특수지역)
}

const RemovalLineManageModal: React.FC<RemovalLineManageModalProps> = ({
  isOpen,
  onClose,
  onComplete,
  onAssignAS,
  showToast
}) => {
  // 철거배선상태 (var_1)
  const [removeLineType, setRemoveLineType] = useState<string>('');
  // 철거상태 (var_2) - 기본값: 완전철거
  const [removeGb, setRemoveGb] = useState<string>('4');
  // 미철거 사유 (var_3)
  const [removeStat, setRemoveStat] = useState<string>('');

  // 철거배선상태 옵션
  const lineTypeOptions = [
    { value: '1', label: '간선공용' },
    { value: '2', label: '1:1배선' },
    { value: '3', label: '공동인입' },
    { value: '4', label: '단독인입' },
  ];

  // 철거상태 옵션
  const removeGbOptions = [
    { value: '4', label: '완전철거' },
    { value: '1', label: '미철거' },
  ];

  // 미철거 사유 옵션
  const removeStatOptions = [
    { value: '5', label: '출입불가' },
    { value: '6', label: '2층1인' },
    { value: '7', label: '특수지역' },
  ];

  // 철거배선상태 선택 핸들러
  const handleLineTypeSelect = (value: string) => {
    setRemoveLineType(value);
    // 1단계 선택 시 2단계 초기화 (완전철거로)
    setRemoveGb('4');
    setRemoveStat('');
  };

  // 철거상태 선택 핸들러
  const handleRemoveGbSelect = (value: string) => {
    setRemoveGb(value);
    // 완전철거 선택 시 미철거 사유 초기화
    if (value === '4') {
      setRemoveStat('');
    }
  };

  // 완료 버튼 클릭 (완전철거)
  const handleComplete = () => {
    if (!removeLineType) {
      if (showToast) {
        showToast('철거배선 상태를 선택하세요', 'warning');
      }
      return;
    }
    if (!removeGb) {
      if (showToast) {
        showToast('철거상태를 선택하세요', 'warning');
      }
      return;
    }

    const data: RemovalLineData = {
      REMOVE_LINE_TP: removeLineType,
      REMOVE_GB: removeGb,
      REMOVE_STAT: removeStat,
    };

    onComplete(data);
  };

  // AS할당 버튼 클릭 (미철거)
  const handleAssignAS = () => {
    if (!removeLineType) {
      if (showToast) {
        showToast('철거배선 상태를 선택하세요', 'warning');
      }
      return;
    }
    if (!removeGb) {
      if (showToast) {
        showToast('철거상태를 선택하세요', 'warning');
      }
      return;
    }
    if (removeGb === '1' && !removeStat) {
      if (showToast) {
        showToast('미철거 사유를 선택하세요', 'warning');
      }
      return;
    }

    const data: RemovalLineData = {
      REMOVE_LINE_TP: removeLineType,
      REMOVE_GB: removeGb,
      REMOVE_STAT: removeStat,
    };

    onAssignAS(data);
  };

  // 모달 초기화
  const resetModal = () => {
    setRemoveLineType('');
    setRemoveGb('4');
    setRemoveStat('');
  };

  // 모달 닫기
  const handleClose = () => {
    resetModal();
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* 오버레이 */}
      <div
        className="absolute inset-0 bg-black/50"
        onClick={handleClose}
      />

      {/* 모달 컨텐츠 */}
      <div className="relative bg-white rounded-xl shadow-2xl w-[90%] max-w-md mx-4 overflow-hidden">
        {/* 헤더 */}
        <div className="bg-orange-600 text-white px-3 sm:px-4 py-2.5 sm:py-3 flex items-center justify-between">
          <h2 className="text-base sm:text-lg font-bold">인입선로 철거관리</h2>
          <button
            onClick={handleClose}
            className="p-1 hover:bg-orange-700 rounded-full transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* 바디 */}
        <div className="p-3 sm:p-4 space-y-3 sm:space-y-4">
          {/* 1. 철거배선상태 */}
          <div>
            <label className="block text-xs sm:text-sm font-semibold text-gray-700 mb-1.5 sm:mb-2">
              철거배선상태
            </label>
            <div className="grid grid-cols-2 gap-1.5 sm:gap-2">
              {lineTypeOptions.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => handleLineTypeSelect(opt.value)}
                  className={`py-2 sm:py-3 px-3 sm:px-4 rounded-lg font-medium text-xs sm:text-sm transition-colors border-2 ${
                    removeLineType === opt.value
                      ? 'bg-green-100 border-green-500 text-green-700'
                      : 'bg-gray-100 border-gray-300 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* 2. 철거상태 - 1단계 선택 후 표시 */}
          {removeLineType && (
            <div>
              <label className="block text-xs sm:text-sm font-semibold text-gray-700 mb-1.5 sm:mb-2">
                철거상태
              </label>
              <div className="grid grid-cols-2 gap-1.5 sm:gap-2">
                {removeGbOptions.map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => handleRemoveGbSelect(opt.value)}
                    className={`py-2 sm:py-3 px-3 sm:px-4 rounded-lg font-bold text-sm sm:text-base transition-colors border-2 ${
                      removeGb === opt.value
                        ? opt.value === '4'
                          ? 'bg-blue-100 border-blue-500 text-blue-700'
                          : 'bg-red-100 border-red-500 text-red-700'
                        : 'bg-gray-100 border-gray-300 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* 3. 미철거 사유 - 미철거 선택 시 표시 */}
          {removeLineType && removeGb === '1' && (
            <div>
              <label className="block text-xs sm:text-sm font-semibold text-gray-700 mb-1.5 sm:mb-2">
                미철거 사유
              </label>
              <div className="grid grid-cols-3 gap-1.5 sm:gap-2">
                {removeStatOptions.map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => setRemoveStat(opt.value)}
                    className={`py-2 sm:py-3 px-1.5 sm:px-2 rounded-lg font-bold text-xs sm:text-sm transition-colors border-2 ${
                      removeStat === opt.value
                        ? 'bg-yellow-100 border-yellow-500 text-yellow-700'
                        : 'bg-gray-100 border-gray-300 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* 푸터 - 버튼 영역 */}
        <div className="p-3 sm:p-4 bg-gray-50 border-t border-gray-200 flex gap-1.5 sm:gap-2">
          {/* 완료 버튼 - 완전철거 선택 시 활성화 */}
          <button
            onClick={handleComplete}
            disabled={!removeLineType || !removeGb || removeGb === '1'}
            className={`flex-1 py-2 sm:py-3 rounded-lg font-bold transition-colors text-sm sm:text-base ${
              removeLineType && removeGb === '4'
                ? 'bg-blue-600 hover:bg-blue-700 text-white'
                : 'bg-gray-300 text-gray-500 cursor-not-allowed'
            }`}
          >
            완료
          </button>

          {/* AS할당 버튼 - 미철거 선택 시 활성화 */}
          <button
            onClick={handleAssignAS}
            disabled={!removeLineType || removeGb !== '1' || !removeStat}
            className={`flex-1 py-2 sm:py-3 rounded-lg font-bold transition-colors text-sm sm:text-base ${
              removeLineType && removeGb === '1' && removeStat
                ? 'bg-orange-600 hover:bg-orange-700 text-white'
                : 'bg-gray-300 text-gray-500 cursor-not-allowed'
            }`}
          >
            AS할당
          </button>
        </div>
      </div>
    </div>
  );
};

export default RemovalLineManageModal;
