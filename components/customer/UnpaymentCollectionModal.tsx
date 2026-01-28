import React, { useState, useEffect } from 'react';
import { X, Loader2, AlertCircle, CheckCircle, CreditCard } from 'lucide-react';
import { UnpaymentInfo, formatCurrency } from '../../services/customerApi';

interface UnpaymentCollectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  custId: string;
  custNm?: string;
  unpaymentList: UnpaymentInfo[];
  showToast?: (message: string, type: 'success' | 'error' | 'warning' | 'info') => void;
  onSuccess?: () => void;
}

/**
 * 미납금 수납 모달
 *
 * 기능:
 * - 미납 내역 목록 표시 (체크박스로 선택 가능)
 * - 선택된 미납금 합계 계산
 * - 수납 처리 (현재는 UI만 - 실제 결제 연동은 추후 구현)
 *
 * 와이어프레임 기준:
 * - 납부정보에서 미납금 있을 때 "미납금 수납" 버튼 클릭 시 표시
 */
const UnpaymentCollectionModal: React.FC<UnpaymentCollectionModalProps> = ({
  isOpen,
  onClose,
  custId,
  custNm,
  unpaymentList,
  showToast,
  onSuccess
}) => {
  // 선택된 미납 항목
  const [selectedItems, setSelectedItems] = useState<Set<number>>(new Set());

  // 처리 중 상태
  const [isProcessing, setIsProcessing] = useState(false);

  // 처리 완료 상태
  const [isCompleted, setIsCompleted] = useState(false);

  // 모달 열릴 때 초기화
  useEffect(() => {
    if (isOpen) {
      // 기본으로 모든 항목 선택
      setSelectedItems(new Set(unpaymentList.map((_, idx) => idx)));
      setIsCompleted(false);
    }
  }, [isOpen, unpaymentList]);

  // 모달 닫힐 때 백그라운드 스크롤 제어
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  if (!isOpen) return null;

  // 개별 항목 선택/해제
  const toggleItem = (index: number) => {
    const newSelected = new Set(selectedItems);
    if (newSelected.has(index)) {
      newSelected.delete(index);
    } else {
      newSelected.add(index);
    }
    setSelectedItems(newSelected);
  };

  // 전체 선택/해제
  const toggleAll = () => {
    if (selectedItems.size === unpaymentList.length) {
      setSelectedItems(new Set());
    } else {
      setSelectedItems(new Set(unpaymentList.map((_, idx) => idx)));
    }
  };

  // 선택된 금액 합계
  const selectedTotal = unpaymentList
    .filter((_, idx) => selectedItems.has(idx))
    .reduce((sum, item) => sum + (item.UNPAY_AMT || 0), 0);

  // 전체 미납 금액
  const totalUnpayment = unpaymentList.reduce((sum, item) => sum + (item.UNPAY_AMT || 0), 0);

  // 수납 처리 (실제 결제 API 연동 전 - UI 데모)
  const handlePayment = async () => {
    if (selectedItems.size === 0) {
      showToast?.('수납할 항목을 선택해주세요.', 'warning');
      return;
    }

    setIsProcessing(true);

    try {
      // TODO: 실제 수납 API 연동
      // 현재는 데모용으로 2초 대기 후 완료 표시
      await new Promise(resolve => setTimeout(resolve, 2000));

      setIsCompleted(true);
      showToast?.(`${formatCurrency(selectedTotal)}원 수납 처리가 완료되었습니다.`, 'success');
      onSuccess?.();

      // 2초 후 모달 닫기
      setTimeout(() => {
        onClose();
      }, 2000);
    } catch (error) {
      console.error('Payment error:', error);
      showToast?.('수납 처리 중 오류가 발생했습니다.', 'error');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div
        className="bg-white rounded-xl shadow-xl w-full max-w-md mx-4 max-h-[85vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* 헤더 */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200 bg-gradient-to-r from-red-500 to-red-600 rounded-t-xl">
          <div className="flex items-center gap-2 text-white">
            <CreditCard className="w-5 h-5" />
            <h3 className="font-semibold">미납금 수납</h3>
          </div>
          <button
            onClick={onClose}
            className="text-white/80 hover:text-white transition-colors"
            disabled={isProcessing}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* 고객 정보 */}
        <div className="p-3 bg-gray-50 border-b border-gray-200">
          <div className="flex items-center gap-4 text-sm">
            <div>
              <span className="text-gray-500">고객명: </span>
              <span className="font-medium text-gray-900">{custNm || '-'}</span>
            </div>
            <div>
              <span className="text-gray-500">고객ID: </span>
              <span className="font-mono text-blue-600">{custId}</span>
            </div>
          </div>
        </div>

        {/* 완료 상태 */}
        {isCompleted ? (
          <div className="flex-1 flex flex-col items-center justify-center p-8">
            <CheckCircle className="w-16 h-16 text-green-500 mb-4" />
            <h4 className="text-lg font-semibold text-gray-900 mb-2">수납 완료</h4>
            <p className="text-gray-500 text-center">
              {formatCurrency(selectedTotal)}원이<br />
              정상적으로 수납되었습니다.
            </p>
          </div>
        ) : (
          <>
            {/* 미납 목록 */}
            <div className="flex-1 overflow-y-auto p-4 min-h-0">
              {unpaymentList.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 text-gray-400">
                  <AlertCircle className="w-12 h-12 mb-2" />
                  <span>미납 내역이 없습니다.</span>
                </div>
              ) : (
                <div className="space-y-2">
                  {/* 전체 선택 */}
                  <label className="flex items-center gap-3 p-3 bg-blue-50 rounded-lg cursor-pointer border border-blue-200">
                    <input
                      type="checkbox"
                      checked={selectedItems.size === unpaymentList.length}
                      onChange={toggleAll}
                      className="w-5 h-5 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      disabled={isProcessing}
                    />
                    <span className="flex-1 font-medium text-blue-700">
                      전체 선택 ({unpaymentList.length}건)
                    </span>
                    <span className="font-bold text-blue-700">
                      {formatCurrency(totalUnpayment)}원
                    </span>
                  </label>

                  {/* 개별 항목 */}
                  {unpaymentList.map((item, index) => (
                    <label
                      key={index}
                      className={`flex items-center gap-3 p-3 rounded-lg cursor-pointer border transition-colors ${
                        selectedItems.has(index)
                          ? 'bg-red-50 border-red-200'
                          : 'bg-gray-50 border-gray-200'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={selectedItems.has(index)}
                        onChange={() => toggleItem(index)}
                        className="w-5 h-5 rounded border-gray-300 text-red-600 focus:ring-red-500"
                        disabled={isProcessing}
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-medium text-gray-900">
                            {item.BILL_YM || '-'}
                          </span>
                          <span className={`text-sm font-bold ${
                            selectedItems.has(index) ? 'text-red-600' : 'text-gray-700'
                          }`}>
                            {formatCurrency(item.UNPAY_AMT)}원
                          </span>
                        </div>
                        <div className="text-xs text-gray-500 mt-0.5 truncate">
                          {item.PROD_NM}
                          {item.UNPAY_DAYS && ` | 미납 ${item.UNPAY_DAYS}일`}
                        </div>
                      </div>
                    </label>
                  ))}
                </div>
              )}
            </div>

            {/* 푸터 - 합계 및 버튼 */}
            <div className="p-4 border-t border-gray-200 bg-gray-50 rounded-b-xl">
              {/* 선택 합계 */}
              <div className="flex items-center justify-between mb-4 p-3 bg-white rounded-lg border border-gray-200">
                <span className="text-sm text-gray-600">
                  선택 금액 ({selectedItems.size}건)
                </span>
                <span className="text-xl font-bold text-red-600">
                  {formatCurrency(selectedTotal)}원
                </span>
              </div>

              {/* 버튼 */}
              <div className="flex gap-2">
                <button
                  onClick={onClose}
                  disabled={isProcessing}
                  className="flex-1 py-3 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 transition-colors"
                >
                  취소
                </button>
                <button
                  onClick={handlePayment}
                  disabled={isProcessing || selectedItems.size === 0}
                  className="flex-1 py-3 text-sm font-medium text-white bg-red-500 rounded-lg hover:bg-red-600 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
                >
                  {isProcessing ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      처리 중...
                    </>
                  ) : (
                    '수납하기'
                  )}
                </button>
              </div>

              {/* 안내 메시지 */}
              <p className="mt-3 text-xs text-gray-400 text-center">
                * 수납 처리 후에는 취소가 불가능합니다.
              </p>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default UnpaymentCollectionModal;
