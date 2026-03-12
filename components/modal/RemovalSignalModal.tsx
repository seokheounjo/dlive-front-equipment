import React, { useState, useEffect } from 'react';
import { sendSignal, SignalResult } from '../../services/apiService';
import ConfirmModal from '../common/ConfirmModal';

/**
 * RemovalSignalModal - 철거 신호 전송 모달
 *
 * 레거시: modIfSvc API (MSG_ID='SMR91')
 * - 철거 시 장비 신호 차단 처리
 * - 회수 장비에 대해 SMR91 신호 전송
 */
interface RemovalSignalModalProps {
  isOpen: boolean;
  onClose: () => void;
  custId: string;
  ctrtId: string;
  soId: string;
  workId: string;
  prodGrp?: string;       // 상품그룹 (D/C/I/A/V 등)
  prodCd?: string;        // 기본상품코드
  equipmentList?: any[];  // 회수장비 목록
  onSuccess?: () => void;
  showToast?: (message: string, type: 'success' | 'error' | 'warning' | 'info') => void;
}

const RemovalSignalModal: React.FC<RemovalSignalModalProps> = ({
  isOpen,
  onClose,
  custId,
  ctrtId,
  soId,
  workId,
  prodGrp = '',
  prodCd = '',
  equipmentList = [],
  onSuccess,
  showToast
}) => {
  const [isLoading, setIsLoading] = useState(false);
  const [results, setResults] = useState<{ eqtNo: string; eqtNm: string; result: SignalResult }[]>([]);
  const [selectedEquipments, setSelectedEquipments] = useState<Set<string>>(new Set());
  const [showConfirmModal, setShowConfirmModal] = useState(false);

  // 모달 열릴 때 초기화
  useEffect(() => {
    if (isOpen) {
      setResults([]);
      // 기본적으로 모든 장비 선택
      setSelectedEquipments(new Set(equipmentList.map(eq => eq.EQT_NO || eq.id)));
    }
  }, [isOpen, equipmentList]);

  if (!isOpen) return null;

  // 장비 선택 토글
  const toggleEquipment = (eqtNo: string) => {
    const newSelected = new Set(selectedEquipments);
    if (newSelected.has(eqtNo)) {
      newSelected.delete(eqtNo);
    } else {
      newSelected.add(eqtNo);
    }
    setSelectedEquipments(newSelected);
  };

  // 전체 선택/해제
  const toggleAll = () => {
    if (selectedEquipments.size === equipmentList.length) {
      setSelectedEquipments(new Set());
    } else {
      setSelectedEquipments(new Set(equipmentList.map(eq => eq.EQT_NO || eq.id)));
    }
  };

  // 철거 신호 전송 확인
  const handleSendSignal = () => {
    if (selectedEquipments.size === 0) {
      showToast?.('신호를 전송할 장비를 선택해주세요.', 'error');
      return;
    }
    setShowConfirmModal(true);
  };

  /**
   * 레거시 fn_seteqt() 동일구현: ITEM_MID_CD 기반 장비 파라미터 분류
   * D/C 상품: 05→EQT_NO, 04→ETC_1, 07→ETC_2, 02/08(C)→ETC_3, 03(C)→EQT_NO
   * I 상품: 21→ETC_4, 그 외→EQT_NO
   * 기타: 선택 장비→EQT_NO
   */
  const buildSignalParams = (selectedEqs: any[]): { EQT_NO: string; ETC_1: string; ETC_2: string; ETC_3: string; ETC_4: string } => {
    let eqtNo = '';
    let etc1 = '';
    let etc2 = '';
    let etc3 = '';
    let etc4 = '';

    if (prodGrp === 'D' || prodGrp === 'C') {
      for (const eq of selectedEqs) {
        const midCd = eq.ITEM_MID_CD || eq.itemMidCd || '';
        const no = eq.EQT_NO || eq.id || '';
        if (midCd === '05') eqtNo = no;
        else if (midCd === '04') etc1 = no;
        else if (midCd === '07') etc2 = no;
        else if (prodGrp === 'C' && midCd === '02') etc3 = no;
        else if (prodGrp === 'C' && midCd === '08') etc3 = no;
        else if (prodGrp === 'C' && midCd === '03') eqtNo = no;
      }
    } else if (prodGrp === 'I') {
      for (const eq of selectedEqs) {
        const midCd = eq.ITEM_MID_CD || eq.itemMidCd || '';
        const no = eq.EQT_NO || eq.id || '';
        if (midCd === '21') etc4 = no;
        else eqtNo = no;
      }
    } else {
      // 기타 상품: 첫 번째 장비를 EQT_NO로
      if (selectedEqs.length > 0) {
        eqtNo = selectedEqs[0].EQT_NO || selectedEqs[0].id || '';
      }
    }

    return { EQT_NO: eqtNo, ETC_1: etc1, ETC_2: etc2, ETC_3: etc3, ETC_4: etc4 };
  };

  // 실제 철거 신호 전송 (레거시 동일: 한 번의 API 호출로 모든 장비 정보 전송)
  const handleConfirmSendSignal = async () => {
    setShowConfirmModal(false);
    setIsLoading(true);
    setResults([]);

    const userInfo = localStorage.getItem('userInfo');
    const user = userInfo ? JSON.parse(userInfo) : {};

    // 선택된 장비만 필터
    const selectedEqs = equipmentList.filter(eq => {
      const eqtNo = eq.EQT_NO || eq.id;
      return selectedEquipments.has(eqtNo);
    });

    // 레거시 fn_seteqt() 동일: ITEM_MID_CD 기반 분류
    const params = buildSignalParams(selectedEqs);

    console.log('[RemovalSignal] 레거시 동일 파라미터:', { prodGrp, ...params });

    const newResults: { eqtNo: string; eqtNm: string; result: SignalResult }[] = [];

    try {
      const result = await sendSignal({
        MSG_ID: 'SMR91',
        CUST_ID: custId,
        CTRT_ID: ctrtId,
        SO_ID: soId,
        EQT_NO: params.EQT_NO,
        ETC_1: params.ETC_1,
        ETC_2: params.ETC_2,
        ETC_3: params.ETC_3,
        ETC_4: params.ETC_4,
        PROD_CD: prodCd,
        WRK_ID: workId,
        REG_UID: user.userId || user.workerId || '',
        WTIME: '3',
      });

      // 결과를 각 장비별로 매핑
      for (const eq of selectedEqs) {
        const eqtNo = eq.EQT_NO || eq.id;
        newResults.push({
          eqtNo,
          eqtNm: eq.EQT_NM || eq.ITEM_MID_NM || eq.name || '장비',
          result
        });
      }
    } catch (error: any) {
      for (const eq of selectedEqs) {
        const eqtNo = eq.EQT_NO || eq.id;
        newResults.push({
          eqtNo,
          eqtNm: eq.EQT_NM || eq.ITEM_MID_NM || eq.name || '장비',
          result: {
            code: 'ERROR',
            message: error.message || '신호 전송 실패',
            MSG_ID: 'SMR91'
          }
        });
      }
    }

    setResults(newResults);
    setIsLoading(false);

    const successCount = newResults.filter(r => r.result.code === 'SUCCESS' || r.result.code === 'OK').length;
    const failCount = newResults.length - successCount;

    if (failCount === 0 && successCount > 0) {
      showToast?.(`철거 신호 전송 완료 (${selectedEqs.length}개 장비)`, 'success');
      onSuccess?.();
    } else if (failCount > 0) {
      showToast?.('철거 신호 전송 실패', 'error', true);
    }
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative bg-white rounded-xl shadow-2xl w-[95%] max-w-lg mx-4 max-h-[85vh] overflow-hidden">
        {/* Header */}
        <div className="px-3 sm:px-4 py-2.5 sm:py-3 border-b border-gray-200 bg-yellow-50">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5 sm:gap-2">
              <svg className="w-4 h-4 sm:w-5 sm:h-5 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
              <h2 className="text-base sm:text-lg font-bold text-gray-900">철거 신호 전송 (SMR91)</h2>
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

        {/* Content */}
        <div className="p-3 sm:p-4 overflow-y-auto max-h-[55vh]">
          {equipmentList.length === 0 ? (
            <div className="text-center py-6 sm:py-8">
              <svg className="w-10 h-10 sm:w-12 sm:h-12 mx-auto text-gray-400 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
              </svg>
              <p className="text-gray-600 font-medium text-sm sm:text-base">회수 대상 장비가 없습니다.</p>
              <p className="text-xs sm:text-sm text-gray-500 mt-1">장비 회수 단계에서 회수 장비를 등록해주세요.</p>
            </div>
          ) : (
            <div className="space-y-3 sm:space-y-4">
              {/* 전체 선택 */}
              <div className="flex items-center justify-between">
                <label className="text-xs sm:text-sm font-semibold text-gray-700">
                  회수 장비 목록 ({equipmentList.length}건)
                </label>
                <button
                  type="button"
                  onClick={toggleAll}
                  className="text-sm text-primary-700 hover:text-primary-700"
                >
                  {selectedEquipments.size === equipmentList.length ? '전체 해제' : '전체 선택'}
                </button>
              </div>

              {/* 장비 목록 */}
              <div className="space-y-2">
                {equipmentList.map((eq, idx) => {
                  const eqtNo = eq.EQT_NO || eq.id;
                  const isSelected = selectedEquipments.has(eqtNo);
                  const resultItem = results.find(r => r.eqtNo === eqtNo);

                  return (
                    <div
                      key={eqtNo || idx}
                      onClick={() => !isLoading && toggleEquipment(eqtNo)}
                      className={`p-3 rounded-lg border-2 cursor-pointer transition-colors ${
                        isSelected
                          ? 'border-yellow-500 bg-yellow-50'
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => {}}
                          className="mt-1 w-5 h-5 text-yellow-600 rounded"
                        />
                        <div className="flex-1">
                          <p className="font-semibold text-gray-900">
                            {eq.EQT_NM || eq.ITEM_MID_NM || eq.name || '장비'}
                          </p>
                          <p className="text-sm text-gray-600">
                            S/N: {eq.EQT_SERNO || eq.serialNumber || '-'}
                          </p>
                          <p className="text-xs text-gray-500">
                            장비번호: {eqtNo}
                          </p>
                        </div>
                        {/* 결과 표시 */}
                        {resultItem && (
                          <div className={`px-2 py-1 rounded text-xs font-medium ${
                            resultItem.result.code === 'SUCCESS' || resultItem.result.code === 'OK'
                              ? 'bg-green-100 text-green-800'
                              : 'bg-red-100 text-red-800'
                          }`}>
                            {resultItem.result.code === 'SUCCESS' || resultItem.result.code === 'OK'
                              ? '성공'
                              : '실패'}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* 결과 요약 */}
              {results.length > 0 && (
                <div className="mt-4 p-3 bg-gray-100 rounded-lg">
                  <p className="text-sm font-semibold text-gray-700 mb-2">전송 결과</p>
                  <div className="flex gap-4">
                    <span className="text-green-600">
                      성공: {results.filter(r => r.result.code === 'SUCCESS' || r.result.code === 'OK').length}건
                    </span>
                    <span className="text-red-600">
                      실패: {results.filter(r => r.result.code !== 'SUCCESS' && r.result.code !== 'OK').length}건
                    </span>
                  </div>
                </div>
              )}
            </div>
          )}
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
                onClick={handleSendSignal}
                disabled={isLoading || selectedEquipments.size === 0}
                className="flex-1 px-3 sm:px-4 py-2 sm:py-3 bg-yellow-600 text-white rounded-lg font-semibold hover:bg-yellow-700 transition-colors disabled:bg-gray-400 disabled:text-white disabled:cursor-not-allowed flex items-center justify-center gap-1.5 sm:gap-2 text-sm sm:text-base"
              >
                {isLoading ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                    <span>전송 중...</span>
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                    </svg>
                    <span>신호 전송</span>
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* 철거 신호 전송 확인 모달 */}
      <ConfirmModal
        isOpen={showConfirmModal}
        onClose={() => setShowConfirmModal(false)}
        onConfirm={handleConfirmSendSignal}
        title="철거 신호 전송"
        message={`선택한 ${selectedEquipments.size}개 장비에 철거 신호(SMR91)를 전송하시겠습니까?`}
        type="confirm"
        confirmText="전송"
        cancelText="취소"
      />
    </div>
  );
};

export default RemovalSignalModal;
