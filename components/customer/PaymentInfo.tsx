import React, { useState, useEffect } from 'react';
import {
  CreditCard, ChevronDown, ChevronUp, Loader2,
  AlertCircle, RefreshCw
} from 'lucide-react';

import {
  PaymentInfo as PaymentInfoType,
  BillingInfo,
  UnpaymentInfo,
  getPaymentInfo,
  getBillingHistory,
  getUnpaymentList,
  formatCurrency,
  maskString
} from '../../services/customerApi';
import UnpaymentCollectionModal from './UnpaymentCollectionModal';

// 납부계정ID 포맷 (3-3-4)
const formatPymAcntId = (pymAcntId: string): string => {
  if (!pymAcntId) return '-';
  const cleaned = pymAcntId.replace(/[^0-9]/g, '');
  if (cleaned.length === 10) {
    return `${cleaned.slice(0, 3)}-${cleaned.slice(3, 6)}-${cleaned.slice(6, 10)}`;
  }
  return pymAcntId;
};

interface PaymentInfoProps {
  custId: string;
  custNm?: string;
  expanded: boolean;
  onToggle: () => void;
  showToast?: (message: string, type: 'success' | 'error' | 'warning' | 'info') => void;
  onNavigateToPaymentChange?: (pymAcntId: string) => void;
  paymentChangeInProgress?: boolean;
  onCancelPaymentChange?: () => void;
  currentWorkingPymAcntId?: string;
}

const PaymentInfo: React.FC<PaymentInfoProps> = ({
  custId,
  custNm,
  expanded,
  onToggle,
  showToast,
  onNavigateToPaymentChange,
  paymentChangeInProgress,
  onCancelPaymentChange,
  currentWorkingPymAcntId
}) => {
  // 데이터 상태
  const [paymentInfo, setPaymentInfo] = useState<PaymentInfoType[]>([]);
  const [billingHistory, setBillingHistory] = useState<BillingInfo[]>([]);
  const [unpaymentList, setUnpaymentList] = useState<UnpaymentInfo[]>([]);

  // 로딩 상태
  const [isLoading, setIsLoading] = useState(false);

  // 필터 상태
  const [paymentFilter, setPaymentFilter] = useState<'all' | 'auto' | 'card'>('all');

  // 요금내역 펼침 상태
  const [showBillingDetail, setShowBillingDetail] = useState(true);

  // 미납금 수납 모달
  const [showUnpaymentModal, setShowUnpaymentModal] = useState(false);

  // 납부계정 전환 확인 모달
  const [showSwitchConfirm, setShowSwitchConfirm] = useState(false);
  const [pendingSwitchPymAcntId, setPendingSwitchPymAcntId] = useState<string>('');

  // 데이터 로드
  useEffect(() => {
    if (expanded && custId) {
      loadData();
    }
  }, [expanded, custId]);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [paymentRes, billingRes, unpaymentRes] = await Promise.all([
        getPaymentInfo(custId),
        getBillingHistory(custId),
        getUnpaymentList(custId)
      ]);

      if (paymentRes.success && paymentRes.data) {
        setPaymentInfo(paymentRes.data);
      }

      if (billingRes.success && billingRes.data) {
        setBillingHistory(billingRes.data);
      }

      if (unpaymentRes.success && unpaymentRes.data) {
        setUnpaymentList(unpaymentRes.data);
      }
    } catch (error) {
      console.error('Load payment info error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // 납부정보 변경 버튼 클릭
  const handlePaymentChangeClick = (pymAcntId: string) => {
    if (currentWorkingPymAcntId === pymAcntId) {
      if (onNavigateToPaymentChange) {
        onNavigateToPaymentChange(pymAcntId);
      }
      return;
    }
    if (paymentChangeInProgress) {
      setPendingSwitchPymAcntId(pymAcntId);
      setShowSwitchConfirm(true);
      return;
    }
    if (onNavigateToPaymentChange) {
      onNavigateToPaymentChange(pymAcntId);
    }
  };

  // 납부계정 전환 확정
  const confirmSwitchPaymentAccount = () => {
    if (onCancelPaymentChange) {
      onCancelPaymentChange();
    }
    if (onNavigateToPaymentChange && pendingSwitchPymAcntId) {
      onNavigateToPaymentChange(pendingSwitchPymAcntId);
    }
    setShowSwitchConfirm(false);
    setPendingSwitchPymAcntId('');
  };

  // 총 미납금액
  const totalUnpayment = unpaymentList.reduce((sum, item) => sum + (item.UNPAY_AMT || 0), 0);

  // 필터링된 납부 정보
  const filteredPaymentInfo = paymentInfo.filter(payment => {
    if (paymentFilter === 'all') return true;
    if (paymentFilter === 'auto') return payment.PYM_MTH_CD === '01';
    if (paymentFilter === 'card') return payment.PYM_MTH_CD === '02';
    return true;
  });

  // 납부방법별 카운트
  const paymentCounts = {
    all: paymentInfo.length,
    auto: paymentInfo.filter(p => p.PYM_MTH_CD === '01').length,
    card: paymentInfo.filter(p => p.PYM_MTH_CD === '02').length
  };

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200">
      {/* 헤더 */}
      <button
        onClick={onToggle}
        className="w-full px-3 py-2.5 flex items-center justify-between text-left"
      >
        <div className="flex items-center gap-2">
          <span className="font-medium text-gray-800">납부정보</span>
          {totalUnpayment > 0 && (
            <span className="text-sm text-red-500 font-medium">
              (미납 {formatCurrency(totalUnpayment)}원)
            </span>
          )}
        </div>
        {expanded ? (
          <ChevronUp className="w-4 h-4 text-gray-400" />
        ) : (
          <ChevronDown className="w-4 h-4 text-gray-400" />
        )}
      </button>

      {expanded && (
        <div className="px-3 pb-3">
          {isLoading ? (
            <div className="flex items-center justify-center py-6">
              <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
            </div>
          ) : (
            <div className="space-y-4">
              {/* 납부 정보 섹션 */}
              <div>
                {/* 헤더 + 필터 탭 */}
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-1">
                    <span className="text-sm font-medium text-gray-700">납부 정보</span>
                    <button
                      onClick={loadData}
                      className="p-1 text-gray-400 hover:text-gray-600"
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  {/* 필터 탭 */}
                  <div className="flex rounded-lg overflow-hidden border border-gray-200">
                    <button
                      onClick={() => setPaymentFilter('all')}
                      className={`px-3 py-1 text-xs font-medium transition-colors ${
                        paymentFilter === 'all'
                          ? 'bg-blue-500 text-white'
                          : 'bg-white text-gray-600 hover:bg-gray-50'
                      }`}
                    >
                      전체
                    </button>
                    <button
                      onClick={() => setPaymentFilter('auto')}
                      className={`px-3 py-1 text-xs font-medium border-l border-gray-200 transition-colors ${
                        paymentFilter === 'auto'
                          ? 'bg-blue-500 text-white'
                          : 'bg-white text-gray-600 hover:bg-gray-50'
                      }`}
                    >
                      자동이체
                    </button>
                    <button
                      onClick={() => setPaymentFilter('card')}
                      className={`px-3 py-1 text-xs font-medium border-l border-gray-200 transition-colors ${
                        paymentFilter === 'card'
                          ? 'bg-blue-500 text-white'
                          : 'bg-white text-gray-600 hover:bg-gray-50'
                      }`}
                    >
                      카드
                    </button>
                  </div>
                </div>

                {/* 납부 정보 목록 */}
                {paymentInfo.length === 0 ? (
                  <div className="text-center py-4 text-gray-500 text-sm">
                    납부 정보가 없습니다.
                  </div>
                ) : filteredPaymentInfo.length === 0 ? (
                  <div className="text-center py-4 text-gray-500 text-sm">
                    조건에 맞는 납부 정보가 없습니다.
                  </div>
                ) : (
                  <div className="space-y-3">
                    {filteredPaymentInfo.map((payment) => {
                      const isWorking = currentWorkingPymAcntId === payment.PYM_ACNT_ID;
                      const isAutoTransfer = payment.PYM_MTH_CD === '01';
                      const bankOrCard = isAutoTransfer ? payment.BANK_NM : (payment.CARD_NM || payment.BANK_NM);
                      const accountOrCard = isAutoTransfer
                        ? maskString(payment.ACNT_NO || '', 4, 4)
                        : maskString(payment.CARD_NO || '', 4, 4);

                      return (
                        <div
                          key={payment.PYM_ACNT_ID}
                          className={`p-3 rounded-lg border ${
                            isWorking
                              ? 'bg-orange-50 border-orange-300'
                              : 'bg-gray-50 border-gray-200'
                          }`}
                        >
                          {/* 작업중 배지 */}
                          {isWorking && (
                            <div className="flex justify-end mb-2">
                              <span className="px-2 py-0.5 text-xs bg-orange-500 text-white rounded-full animate-pulse">
                                작업중
                              </span>
                            </div>
                          )}

                          {/* 정보 그리드 */}
                          <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                            {/* 1행: 납부계정번호 / 납부방법 */}
                            <div className="flex justify-between items-center">
                              <span className="text-gray-500 whitespace-nowrap">납부계정번호</span>
                              <span className="text-gray-800 font-medium">{formatPymAcntId(payment.PYM_ACNT_ID)}</span>
                            </div>
                            <div className="flex justify-between items-center">
                              <span className="text-gray-500 whitespace-nowrap">납부방법</span>
                              <span className="text-gray-800">{payment.PYM_MTH_NM || '-'}</span>
                            </div>

                            {/* 2행: 은행/카드명 / 계좌/카드번호 */}
                            <div className="flex justify-between items-center">
                              <span className="text-gray-500 whitespace-nowrap">{isAutoTransfer ? '은행명' : '카드사'}</span>
                              <span className="text-gray-800">{bankOrCard || '-'}</span>
                            </div>
                            <div className="flex justify-between items-center">
                              <span className="text-gray-500 whitespace-nowrap">{isAutoTransfer ? '계좌번호' : '카드번호'}</span>
                              <span className="text-gray-800">{accountOrCard || '-'}</span>
                            </div>

                            {/* 3행: 청구매체 */}
                            <div className="flex justify-between items-center col-span-2">
                              <span className="text-gray-500 whitespace-nowrap">청구매체</span>
                              <span className="text-gray-800">{payment.BILL_MEDIA_NM || '-'}</span>
                            </div>
                          </div>

                          {/* 미납금액 */}
                          <div className="mt-3 pt-3 border-t border-gray-200">
                            <div className="flex justify-between items-center">
                              <span className="text-sm text-gray-600">납부계정 미납금액</span>
                              <span className={`text-base font-bold ${
                                payment.UNPAY_AMT > 0 ? 'text-red-600' : 'text-gray-800'
                              }`}>
                                {formatCurrency(payment.UNPAY_AMT || 0)}원
                              </span>
                            </div>
                          </div>

                          {/* 납부정보 변경 버튼 */}
                          {onNavigateToPaymentChange && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handlePaymentChangeClick(payment.PYM_ACNT_ID);
                              }}
                              className="w-full mt-3 py-2 text-sm text-indigo-600 bg-indigo-50 hover:bg-indigo-100 rounded-lg transition-colors font-medium"
                            >
                              납부정보 변경
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* 미납금 수납 버튼 */}
                {totalUnpayment > 0 && (
                  <button
                    onClick={() => setShowUnpaymentModal(true)}
                    className="w-full mt-3 py-2.5 text-sm bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors font-medium"
                  >
                    미납금 수납 ({formatCurrency(totalUnpayment)}원)
                  </button>
                )}
              </div>

              {/* 요금 내역 섹션 */}
              <div className="border-t border-gray-200 pt-4">
                <button
                  onClick={() => setShowBillingDetail(!showBillingDetail)}
                  className="w-full flex items-center justify-between mb-3"
                >
                  <span className="text-sm font-medium text-gray-700">요금 내역</span>
                  <ChevronDown
                    className={`w-4 h-4 text-gray-400 transition-transform ${
                      showBillingDetail ? 'rotate-180' : ''
                    }`}
                  />
                </button>

                {showBillingDetail && (
                  <>
                    {billingHistory.length === 0 ? (
                      <div className="text-center py-4 text-gray-500 text-sm">
                        요금 내역이 없습니다.
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {billingHistory.map((item, index) => (
                          <div
                            key={index}
                            className={`p-3 rounded-lg border ${
                              item.UNPAY_AMT > 0 ? 'bg-red-50 border-red-200' : 'bg-gray-50 border-gray-200'
                            }`}
                          >
                            {/* 1행: 청구년월 / 청구주기 */}
                            <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                              <div className="flex justify-between items-center">
                                <span className="text-gray-500 whitespace-nowrap">청구년월</span>
                                <span className="text-gray-800 font-medium">{item.BILL_YM}</span>
                              </div>
                              <div className="flex justify-between items-center">
                                <span className="text-gray-500 whitespace-nowrap">청구주기</span>
                                <span className="text-gray-800">{item.BILL_CYCLE || '정기'}</span>
                              </div>
                            </div>

                            {/* 2행: 금액 정보 */}
                            <div className="grid grid-cols-3 gap-2 mt-2 pt-2 border-t border-gray-200 text-sm">
                              <div className="text-center">
                                <div className="text-gray-500 text-xs mb-1">청구금액</div>
                                <div className="text-gray-800 font-medium">{formatCurrency(item.BILL_AMT)}원</div>
                              </div>
                              <div className="text-center">
                                <div className="text-gray-500 text-xs mb-1">수납금액</div>
                                <div className="text-green-600 font-medium">{formatCurrency(item.RCPT_AMT)}원</div>
                              </div>
                              <div className="text-center">
                                <div className="text-gray-500 text-xs mb-1">미납금액</div>
                                <div className={`font-bold ${item.UNPAY_AMT > 0 ? 'text-red-600' : 'text-gray-600'}`}>
                                  {formatCurrency(item.UNPAY_AMT)}원
                                </div>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* 미납금 수납 모달 */}
      <UnpaymentCollectionModal
        isOpen={showUnpaymentModal}
        onClose={() => setShowUnpaymentModal(false)}
        custId={custId}
        custNm={custNm}
        unpaymentList={unpaymentList}
        showToast={showToast}
        onSuccess={() => {
          loadData();
        }}
      />

      {/* 납부계정 전환 확인 모달 */}
      {showSwitchConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-5 max-w-sm mx-4 shadow-xl">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-orange-100 flex items-center justify-center">
                <AlertCircle className="w-5 h-5 text-orange-500" />
              </div>
              <h3 className="text-base font-medium text-gray-900">납부정보 변경 중</h3>
            </div>
            <p className="text-sm text-gray-600 mb-5">
              다른 납부계정의 변경 작업이 진행 중입니다.<br />
              기존 작업을 취소하고 새 계정으로 이동하시겠습니까?
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowSwitchConfirm(false);
                  setPendingSwitchPymAcntId('');
                }}
                className="flex-1 px-4 py-2 text-sm text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
              >
                취소
              </button>
              <button
                onClick={confirmSwitchPaymentAccount}
                className="flex-1 px-4 py-2 text-sm text-white bg-orange-500 rounded-lg hover:bg-orange-600 transition-colors"
              >
                계정 전환
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PaymentInfo;
