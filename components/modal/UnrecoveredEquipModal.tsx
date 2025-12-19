import React, { useState, useEffect } from 'react';
import { getUnreturnedEquipmentList, processEquipmentRecovery } from '../../services/apiService';

/**
 * UnrecoveredEquipModal - 미회수 장비 처리 모달
 *
 * 레거시: getEquipLossInfo, modEquipLoss API 호출
 * - 미회수 장비 목록 조회
 * - 회수 처리 (망실처리, 일부회수 등)
 * - 다중 장비 일괄 처리 지원
 */
interface UnrecoveredEquipModalProps {
  isOpen: boolean;
  onClose: () => void;
  ctrtId: string;
  custId: string;
  soId: string;
  onSuccess?: () => void;
  showToast?: (message: string, type: 'success' | 'error' | 'warning' | 'info') => void;
}

interface UnrecoveredEquipment {
  EQT_NO: string;
  EQT_SERNO: string;
  EQT_NM: string;
  ITEM_MID_CD: string;
  ITEM_MID_NM?: string;
  LOSS_AMT?: string;
  LOSS_STAT?: string;
  LOSS_STAT_NM?: string;
}

const UnrecoveredEquipModal: React.FC<UnrecoveredEquipModalProps> = ({
  isOpen,
  onClose,
  ctrtId,
  custId,
  soId,
  onSuccess,
  showToast
}) => {
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [equipmentList, setEquipmentList] = useState<UnrecoveredEquipment[]>([]);
  const [selectedEquipNos, setSelectedEquipNos] = useState<Set<string>>(new Set());
  const [recoveryType, setRecoveryType] = useState('');

  // 회수처리 옵션
  const recoveryOptions = [
    { value: '1', label: '회수완료' },
    { value: '2', label: '망실처리' },
    { value: '3', label: '고객분실' },
  ];

  // 미회수 장비 조회
  const fetchEquipmentList = async () => {
    if (!ctrtId && !custId) return;

    setIsLoading(true);
    try {
      const result = await getUnreturnedEquipmentList({
        CUST_ID: custId,
        CTRT_ID: ctrtId,
      });

      setEquipmentList(result || []);
    } catch (error: any) {
      console.error('미회수 장비 조회 실패:', error);
      showToast?.(error.message || '미회수 장비 조회에 실패했습니다.', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  // 모달 열릴 때 조회
  useEffect(() => {
    if (isOpen) {
      fetchEquipmentList();
      setSelectedEquipNos(new Set());
      setRecoveryType('');
    }
  }, [isOpen, ctrtId]);

  // 장비 선택/해제 토글
  const toggleEquipSelection = (eqtNo: string) => {
    setSelectedEquipNos(prev => {
      const newSet = new Set(prev);
      if (newSet.has(eqtNo)) {
        newSet.delete(eqtNo);
      } else {
        newSet.add(eqtNo);
      }
      return newSet;
    });
  };

  // 전체 선택/해제
  const toggleSelectAll = () => {
    if (selectedEquipNos.size === equipmentList.length) {
      setSelectedEquipNos(new Set());
    } else {
      setSelectedEquipNos(new Set(equipmentList.map(eq => eq.EQT_NO)));
    }
  };

  if (!isOpen) return null;

  // 회수 처리 (다중 처리 지원)
  const handleRecovery = async () => {
    if (selectedEquipNos.size === 0) {
      showToast?.('처리할 장비를 선택해주세요.', 'error');
      return;
    }
    if (!recoveryType) {
      showToast?.('처리유형을 선택해주세요.', 'error');
      return;
    }

    const selectedCount = selectedEquipNos.size;
    const confirmMsg = recoveryType === '2'
      ? `망실처리 시 고객에게 손해배상금이 청구됩니다.\n선택한 ${selectedCount}건을 처리하시겠습니까?`
      : `선택한 ${selectedCount}건을 회수처리 하시겠습니까?`;

    if (!window.confirm(confirmMsg)) return;

    setIsSaving(true);
    let successCount = 0;
    let failCount = 0;

    try {
      // 선택된 장비들 순차 처리
      for (const eqtNo of selectedEquipNos) {
        try {
          const result = await processEquipmentRecovery({
            EQT_NO: eqtNo,
            CTRT_ID: ctrtId,
            PROC_CL: recoveryType,
          });

          if (result.code === 'SUCCESS' || result.success) {
            successCount++;
          } else {
            failCount++;
          }
        } catch {
          failCount++;
        }
      }

      if (successCount > 0) {
        showToast?.(`${successCount}건 처리 완료${failCount > 0 ? `, ${failCount}건 실패` : ''}`,
          failCount > 0 ? 'warning' : 'success');
        await fetchEquipmentList();
        setSelectedEquipNos(new Set());
        setRecoveryType('');
        onSuccess?.();
      } else {
        showToast?.('처리에 실패했습니다.', 'error');
      }
    } catch (error: any) {
      showToast?.(error.message || '처리 중 오류가 발생했습니다.', 'error');
    } finally {
      setIsSaving(false);
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
      <div className="relative bg-white rounded-xl shadow-2xl w-[95%] max-w-lg mx-4 max-h-[85vh] overflow-hidden">
        {/* Header */}
        <div className="px-3 sm:px-4 py-2.5 sm:py-3 border-b border-gray-200 bg-red-50">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5 sm:gap-2">
              <svg className="w-4 h-4 sm:w-5 sm:h-5 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              <h2 className="text-base sm:text-lg font-bold text-gray-900">미회수 장비 처리</h2>
            </div>
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

        {/* Content - Option 2: 처리유형 상단 고정 + 장비 목록 스크롤 */}
        <div className="flex flex-col">
          {/* 처리유형 선택 - 상단 고정 영역 */}
          {!isLoading && equipmentList.length > 0 && (
            <div className="px-3 sm:px-4 py-2.5 sm:py-3 border-b border-gray-200 bg-white">
              <label className="block text-xs sm:text-sm font-semibold text-gray-700 mb-1.5 sm:mb-2">
                처리유형 <span className="text-red-500">*</span>
              </label>
              <div className="grid grid-cols-3 gap-1.5 sm:gap-2">
                {recoveryOptions.map(opt => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setRecoveryType(opt.value)}
                    className={`px-2 sm:px-3 py-2 sm:py-2.5 rounded-lg text-xs sm:text-sm font-medium transition-colors ${
                      recoveryType === opt.value
                        ? opt.value === '2' ? 'bg-red-600 text-white' : 'bg-blue-600 text-white'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
              {recoveryType === '2' && (
                <p className="mt-1.5 text-xs text-red-600">
                  * 망실처리 시 손해배상금이 청구됩니다.
                </p>
              )}
            </div>
          )}

          {/* 장비 목록 - 스크롤 영역 */}
          <div className="p-4 overflow-y-auto max-h-[45vh]">
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                <span className="ml-2 text-gray-600">조회 중...</span>
              </div>
            ) : equipmentList.length === 0 ? (
              <div className="text-center py-8">
                <svg className="w-12 h-12 mx-auto text-green-500 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <p className="text-gray-600 font-medium">미회수 장비가 없습니다.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {/* 전체선택 + 선택 카운트 */}
                <div className="flex items-center justify-between pb-2 border-b border-gray-100">
                  <button
                    type="button"
                    onClick={toggleSelectAll}
                    className="flex items-center gap-2 text-sm text-blue-600 font-medium"
                  >
                    <div className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${
                      selectedEquipNos.size === equipmentList.length
                        ? 'bg-blue-600 border-blue-600'
                        : 'border-gray-300'
                    }`}>
                      {selectedEquipNos.size === equipmentList.length && (
                        <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                        </svg>
                      )}
                    </div>
                    전체선택
                  </button>
                  <span className="text-sm text-gray-500">
                    {selectedEquipNos.size > 0 ? (
                      <span className="text-blue-600 font-medium">{selectedEquipNos.size}건 선택</span>
                    ) : (
                      `총 ${equipmentList.length}건`
                    )}
                  </span>
                </div>

                {/* 장비 목록 */}
                <div className="space-y-2">
                  {equipmentList.map((eq, idx) => {
                    const isSelected = selectedEquipNos.has(eq.EQT_NO);
                    return (
                      <div
                        key={eq.EQT_NO || idx}
                        onClick={() => toggleEquipSelection(eq.EQT_NO)}
                        className={`p-3 rounded-lg border-2 cursor-pointer transition-colors ${
                          isSelected
                            ? 'border-blue-500 bg-blue-50'
                            : 'border-gray-200 hover:border-gray-300'
                        }`}
                      >
                        <div className="flex items-start gap-3">
                          {/* Checkbox */}
                          <div className={`mt-0.5 w-5 h-5 rounded border-2 flex-shrink-0 flex items-center justify-center transition-colors ${
                            isSelected
                              ? 'bg-blue-600 border-blue-600'
                              : 'border-gray-300'
                          }`}>
                            {isSelected && (
                              <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                              </svg>
                            )}
                          </div>
                          {/* Content */}
                          <div className="flex-1 min-w-0">
                            <div className="flex justify-between items-start">
                              <div>
                                <p className="font-semibold text-gray-900">
                                  {eq.EQT_NM || eq.ITEM_MID_NM || '장비'}
                                </p>
                                <p className="text-sm text-gray-600">
                                  S/N: {eq.EQT_SERNO || '-'}
                                </p>
                                <p className="text-xs text-gray-500">
                                  장비번호: {eq.EQT_NO}
                                </p>
                              </div>
                              {eq.LOSS_AMT && (
                                <span className="text-red-600 font-bold text-sm">
                                  {Number(eq.LOSS_AMT).toLocaleString()}원
                                </span>
                              )}
                            </div>
                            {eq.LOSS_STAT_NM && (
                              <span className="inline-block mt-1 px-2 py-0.5 bg-yellow-100 text-yellow-800 text-xs rounded">
                                {eq.LOSS_STAT_NM}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
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
              닫기
            </button>
            {equipmentList.length > 0 && (
              <button
                onClick={handleRecovery}
                disabled={isSaving || !recoveryType || selectedEquipNos.size === 0}
                className="flex-1 px-3 sm:px-4 py-2 sm:py-3 bg-red-600 text-white rounded-lg font-semibold hover:bg-red-700 transition-colors disabled:opacity-50 text-sm sm:text-base"
              >
                {isSaving ? '처리 중...' : `회수처리${selectedEquipNos.size > 0 ? ` (${selectedEquipNos.size})` : ''}`}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default UnrecoveredEquipModal;
