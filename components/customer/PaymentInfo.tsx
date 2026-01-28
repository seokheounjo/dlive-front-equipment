import React, { useState, useEffect } from 'react';
import {
  CreditCard, ChevronDown, ChevronUp, Loader2,
  Wallet, AlertCircle, Calendar, Receipt, Building2
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
  custNm?: string;  // 고객명 (수납 모달에서 사용)
  expanded: boolean;
  onToggle: () => void;
  showToast?: (message: string, type: 'success' | 'error' | 'warning' | 'info') => void;
  onNavigateToPaymentChange?: (pymAcntId: string) => void;  // 납부정보 변경 탭으로 이동
}

/**
 * 납부정보 / 요금정보 컴포넌트 (조회 전용)
 *
 * - 납부계정ID, 납부방법, 은행/카드, 계좌/카드번호(마스킹), 청구매체
 * - 납부계정 미납금액의 합
 * - 요금내역: 청구월, 청구주기, 청구금액, 수납금액, 미납금액
 *
 * 납부방법 변경은 정보변경 탭에서 처리
 */
const PaymentInfo: React.FC<PaymentInfoProps> = ({
  custId,
  custNm,
  expanded,
  onToggle,
  showToast,
  onNavigateToPaymentChange
}) => {
  // 데이터 상태
  const [paymentInfo, setPaymentInfo] = useState<PaymentInfoType[]>([]);
  const [billingHistory, setBillingHistory] = useState<BillingInfo[]>([]);
  const [unpaymentList, setUnpaymentList] = useState<UnpaymentInfo[]>([]);

  // 로딩 상태
  const [isLoading, setIsLoading] = useState(false);

  // 선택된 납부계정
  const [selectedPymAcntId, setSelectedPymAcntId] = useState<string | null>(null);

  // 서브섹션 펼침 상태
  const [showBillingDetail, setShowBillingDetail] = useState(false);
  const [showUnpaymentDetail, setShowUnpaymentDetail] = useState(false);

  // 미납금 수납 모달 상태
  const [showUnpaymentModal, setShowUnpaymentModal] = useState(false);

  // 필터 상태
  const [paymentFilter, setPaymentFilter] = useState<'all' | 'auto' | 'card' | 'unpaid'>('all');
  const [billingFilter, setBillingFilter] = useState<'all' | 'unpaid'>('all');

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
        if (paymentRes.data.length > 0) {
          setSelectedPymAcntId(paymentRes.data[0].PYM_ACNT_ID);
        }
      }

      if (billingRes.success && billingRes.data) {
        setBillingHistory(billingRes.data);
      }

      if (unpaymentRes.success && unpaymentRes.data) {
        setUnpaymentList(unpaymentRes.data);
        if (unpaymentRes.data.length > 0) {
          setShowUnpaymentDetail(true);
        }
      }
    } catch (error) {
      console.error('Load payment info error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // 납부계정 선택
  const handleSelectPayment = (payment: PaymentInfoType) => {
    setSelectedPymAcntId(payment.PYM_ACNT_ID);
  };

  // 총 미납금액
  const totalUnpayment = unpaymentList.reduce((sum, item) => sum + (item.UNPAY_AMT || 0), 0);

  // 필터링된 납부 정보
  const filteredPaymentInfo = paymentInfo.filter(payment => {
    if (paymentFilter === 'all') return true;
    if (paymentFilter === 'auto') return payment.PYM_MTH_CD === '01';
    if (paymentFilter === 'card') return payment.PYM_MTH_CD === '02';
    if (paymentFilter === 'unpaid') return payment.UNPAY_AMT > 0;
    return true;
  });

  // 필터링된 요금 내역
  const filteredBillingHistory = billingHistory.filter(item => {
    if (billingFilter === 'all') return true;
    if (billingFilter === 'unpaid') return item.UNPAY_AMT > 0;
    return true;
  });

  // 납부방법별 카운트
  const paymentCounts = {
    all: paymentInfo.length,
    auto: paymentInfo.filter(p => p.PYM_MTH_CD === '01').length,
    card: paymentInfo.filter(p => p.PYM_MTH_CD === '02').length,
    unpaid: paymentInfo.filter(p => p.UNPAY_AMT > 0).length
  };

  // 납부방법 아이콘
  const getPaymentMethodIcon = (methodCd: string) => {
    switch (methodCd) {
      case '01': return <Building2 className="w-4 h-4 text-blue-500" />;
      case '02': return <CreditCard className="w-4 h-4 text-purple-500" />;
      case '03': return <Receipt className="w-4 h-4 text-green-500" />;
      default: return <Wallet className="w-4 h-4 text-gray-500" />;
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200">
      {/* 헤더 */}
      <button
        onClick={onToggle}
        className="w-full p-4 flex items-center justify-between text-left"
      >
        <div className="flex items-center gap-2">
          <CreditCard className="w-5 h-5 text-indigo-500" />
          <span className="font-medium text-gray-800">납부정보 / 요금내역</span>
          {totalUnpayment > 0 && (
            <span className="text-sm text-red-500 font-medium">
              (미납 {formatCurrency(totalUnpayment)}원)
            </span>
          )}
        </div>
        {expanded ? (
          <ChevronUp className="w-5 h-5 text-gray-400" />
        ) : (
          <ChevronDown className="w-5 h-5 text-gray-400" />
        )}
      </button>

      {expanded && (
        <div className="px-4 pb-4">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
            </div>
          ) : (
            <div className="space-y-4">
              {/* 납부정보 섹션 */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-medium text-gray-700">납부 정보</h4>
                  <button
                    onClick={loadData}
                    className="text-sm text-blue-500 hover:text-blue-600"
                  >
                    새로고침
                  </button>
                </div>

                {/* 필터 버튼 */}
                {paymentInfo.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    <button
                      onClick={() => setPaymentFilter('all')}
                      className={`px-2.5 py-1 text-xs rounded-full transition-colors ${
                        paymentFilter === 'all'
                          ? 'bg-blue-500 text-white'
                          : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                      }`}
                    >
                      전체 ({paymentCounts.all})
                    </button>
                    <button
                      onClick={() => setPaymentFilter('auto')}
                      className={`px-2.5 py-1 text-xs rounded-full transition-colors ${
                        paymentFilter === 'auto'
                          ? 'bg-blue-500 text-white'
                          : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                      }`}
                    >
                      자동이체 ({paymentCounts.auto})
                    </button>
                    <button
                      onClick={() => setPaymentFilter('card')}
                      className={`px-2.5 py-1 text-xs rounded-full transition-colors ${
                        paymentFilter === 'card'
                          ? 'bg-purple-500 text-white'
                          : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                      }`}
                    >
                      카드 ({paymentCounts.card})
                    </button>
                    {paymentCounts.unpaid > 0 && (
                      <button
                        onClick={() => setPaymentFilter('unpaid')}
                        className={`px-2.5 py-1 text-xs rounded-full transition-colors ${
                          paymentFilter === 'unpaid'
                            ? 'bg-red-500 text-white'
                            : 'bg-red-100 text-red-600 hover:bg-red-200'
                        }`}
                      >
                        미납 ({paymentCounts.unpaid})
                      </button>
                    )}
                  </div>
                )}

                {paymentInfo.length === 0 ? (
                  <div className="text-center py-4 text-gray-500 text-sm">
                    납부 정보가 없습니다.
                  </div>
                ) : filteredPaymentInfo.length === 0 ? (
                  <div className="text-center py-4 text-gray-500 text-sm">
                    조건에 맞는 납부 정보가 없습니다.
                  </div>
                ) : (
                  <div className="space-y-2">
                    {filteredPaymentInfo.map((payment) => (
                      <div
                        key={payment.PYM_ACNT_ID}
                        className={`p-3 rounded-lg border transition-colors cursor-pointer ${
                          selectedPymAcntId === payment.PYM_ACNT_ID
                            ? 'bg-indigo-50 border-indigo-300'
                            : 'bg-gray-50 border-gray-200 hover:border-gray-300'
                        }`}
                        onClick={() => handleSelectPayment(payment)}
                      >
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            {getPaymentMethodIcon(payment.PYM_MTH_CD)}
                            <span className="text-sm font-medium text-gray-800">
                              {payment.PYM_MTH_NM || '납부방법 미등록'}
                            </span>
                          </div>
                          <span className="text-xs text-gray-500">
                            계정ID: {formatPymAcntId(payment.PYM_ACNT_ID)}
                          </span>
                        </div>

                        {payment.BANK_NM && (
                          <div className="text-sm text-gray-600">
                            {payment.BANK_NM} {maskString(payment.ACNT_NO || '', 4, 4)}
                          </div>
                        )}
                        {payment.CARD_NO && (
                          <div className="text-sm text-gray-600">
                            카드 {maskString(payment.CARD_NO, 4, 4)}
                          </div>
                        )}

                        {payment.BILL_MEDIA_NM && (
                          <div className="text-xs text-gray-500 mt-1">
                            청구매체: {payment.BILL_MEDIA_NM}
                          </div>
                        )}

                        {payment.UNPAY_AMT > 0 && (
                          <div className="mt-2 p-2 bg-red-50 rounded flex items-center justify-between">
                            <span className="text-sm text-red-600">미납금액</span>
                            <span className="text-sm font-bold text-red-600">
                              {formatCurrency(payment.UNPAY_AMT)}원
                            </span>
                          </div>
                        )}

                        {/* 납부정보 변경 버튼 */}
                        {onNavigateToPaymentChange && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              onNavigateToPaymentChange(payment.PYM_ACNT_ID);
                            }}
                            className="w-full mt-2 py-2 text-sm text-indigo-600 bg-indigo-50 hover:bg-indigo-100 rounded-lg transition-colors"
                          >
                            납부정보 변경
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {/* 미납금 수납 버튼 (미납 있을 때만) */}
                {totalUnpayment > 0 && (
                  <div className="flex gap-2">
                    <button
                      onClick={() => setShowUnpaymentModal(true)}
                      className="flex-1 py-2 text-sm bg-red-100 text-red-700 rounded-lg hover:bg-red-200 transition-colors font-medium"
                    >
                      미납금 수납 ({formatCurrency(totalUnpayment)}원)
                    </button>
                  </div>
                )}
              </div>

              {/* 미납 내역 섹션 */}
              {unpaymentList.length > 0 && (
                <div className="border-t border-gray-200 pt-4">
                  <button
                    onClick={() => setShowUnpaymentDetail(!showUnpaymentDetail)}
                    className="w-full flex items-center justify-between mb-3"
                  >
                    <div className="flex items-center gap-2">
                      <AlertCircle className="w-4 h-4 text-red-500" />
                      <span className="text-sm font-medium text-red-700">
                        미납 내역 ({unpaymentList.length}건)
                      </span>
                    </div>
                    <ChevronDown
                      className={`w-4 h-4 text-gray-400 transition-transform ${
                        showUnpaymentDetail ? 'rotate-180' : ''
                      }`}
                    />
                  </button>

                  {showUnpaymentDetail && (
                    <div className="space-y-2">
                      {unpaymentList.map((item, index) => (
                        <div key={index} className="p-2 bg-red-50 rounded-lg">
                          <div className="flex items-center justify-between">
                            <span className="text-sm text-gray-700">{item.BILL_YM}</span>
                            <span className="text-sm font-medium text-red-600">
                              {formatCurrency(item.UNPAY_AMT)}원
                            </span>
                          </div>
                          <div className="text-xs text-gray-500 mt-1">
                            {item.PROD_NM} | 미납 {item.UNPAY_DAYS}일
                          </div>
                        </div>
                      ))}

                      <div className="p-3 bg-red-100 rounded-lg flex items-center justify-between">
                        <span className="text-sm font-medium text-red-700">총 미납금액</span>
                        <span className="text-lg font-bold text-red-700">
                          {formatCurrency(totalUnpayment)}원
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* 요금 내역 섹션 */}
              <div className="border-t border-gray-200 pt-4">
                <button
                  onClick={() => setShowBillingDetail(!showBillingDetail)}
                  className="w-full flex items-center justify-between mb-3"
                >
                  <div className="flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-gray-500" />
                    <span className="text-sm font-medium text-gray-700">
                      요금 내역 (최근 {billingHistory.length}개월)
                    </span>
                  </div>
                  <ChevronDown
                    className={`w-4 h-4 text-gray-400 transition-transform ${
                      showBillingDetail ? 'rotate-180' : ''
                    }`}
                  />
                </button>

                {showBillingDetail && (
                  <div className="space-y-3">
                    {billingHistory.length > 0 && (
                      <div className="flex gap-2">
                        <button
                          onClick={() => setBillingFilter('all')}
                          className={`px-2.5 py-1 text-xs rounded-full transition-colors ${
                            billingFilter === 'all'
                              ? 'bg-blue-500 text-white'
                              : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                          }`}
                        >
                          전체 ({billingHistory.length})
                        </button>
                        {billingHistory.filter(b => b.UNPAY_AMT > 0).length > 0 && (
                          <button
                            onClick={() => setBillingFilter('unpaid')}
                            className={`px-2.5 py-1 text-xs rounded-full transition-colors ${
                              billingFilter === 'unpaid'
                                ? 'bg-red-500 text-white'
                                : 'bg-red-100 text-red-600 hover:bg-red-200'
                            }`}
                          >
                            미납만 ({billingHistory.filter(b => b.UNPAY_AMT > 0).length})
                          </button>
                        )}
                      </div>
                    )}

                    {billingHistory.length === 0 ? (
                      <div className="text-center py-4 text-gray-500 text-sm">
                        요금 내역이 없습니다.
                      </div>
                    ) : filteredBillingHistory.length === 0 ? (
                      <div className="text-center py-4 text-gray-500 text-sm">
                        조건에 맞는 요금 내역이 없습니다.
                      </div>
                    ) : (
                      <div className="overflow-x-auto">
                        <div className="min-w-[320px]">
                          <div className="grid grid-cols-4 gap-2 px-2 text-xs text-gray-500 font-medium">
                            <span>청구월</span>
                            <span className="text-right">청구금액</span>
                            <span className="text-right">수납금액</span>
                            <span className="text-right">미납금액</span>
                          </div>

                          {filteredBillingHistory.map((item, index) => (
                            <div
                              key={index}
                              className={`grid grid-cols-4 gap-2 p-2 rounded ${
                                item.UNPAY_AMT > 0 ? 'bg-red-50' : 'bg-gray-50'
                              }`}
                            >
                              <span className="text-sm text-gray-700">{item.BILL_YM}</span>
                              <span className="text-sm text-right text-gray-700">
                                {formatCurrency(item.BILL_AMT)}
                              </span>
                              <span className="text-sm text-right text-green-600">
                                {formatCurrency(item.RCPT_AMT)}
                              </span>
                              <span className={`text-sm text-right font-medium ${
                                item.UNPAY_AMT > 0 ? 'text-red-600' : 'text-gray-600'
                              }`}>
                                {formatCurrency(item.UNPAY_AMT)}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
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
          // 수납 완료 후 데이터 새로고침
          loadData();
        }}
      />
    </div>
  );
};

export default PaymentInfo;
