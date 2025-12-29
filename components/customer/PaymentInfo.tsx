import React, { useState, useEffect } from 'react';
import {
  CreditCard, ChevronDown, ChevronUp, Loader2,
  Wallet, AlertCircle, Calendar, Receipt,
  RefreshCw, Building2
} from 'lucide-react';
import {
  PaymentInfo as PaymentInfoType,
  BillingInfo,
  UnpaymentInfo,
  getPaymentInfo,
  getBillingHistory,
  getUnpaymentList,
  formatCurrency,
  formatDate,
  maskString
} from '../../services/customerApi';

interface PaymentInfoProps {
  custId: string;
  expanded: boolean;
  onToggle: () => void;
  showToast?: (message: string, type: 'success' | 'error' | 'warning' | 'info') => void;
}

/**
 * 납부정보 / 요금정보 컴포넌트
 *
 * 회의록 기준:
 * - 납부계정ID, 납부방법, 은행/카드, 계좌/카드번호(마스킹), 청구매체
 * - 납부계정 미납금액의 합
 * - 요금내역: 청구월, 청구주기, 청구금액, 수납금액, 미납금액 (디폴트 3개월, 미납있으면 전체)
 * - 이벤트 버튼: 납부방법 변경, 미납금 수납
 */
const PaymentInfo: React.FC<PaymentInfoProps> = ({
  custId,
  expanded,
  onToggle,
  showToast
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
        // 첫 번째 납부계정 자동 선택
        if (paymentRes.data.length > 0) {
          setSelectedPymAcntId(paymentRes.data[0].PYM_ACNT_ID);
        }
      }

      if (billingRes.success && billingRes.data) {
        setBillingHistory(billingRes.data);
      }

      if (unpaymentRes.success && unpaymentRes.data) {
        setUnpaymentList(unpaymentRes.data);
        // 미납이 있으면 자동 펼침
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

  // 총 미납금액 계산
  const totalUnpayment = unpaymentList.reduce((sum, item) => sum + (item.UNPAY_AMT || 0), 0);

  // 납부방법 아이콘
  const getPaymentMethodIcon = (methodCd: string) => {
    switch (methodCd) {
      case '01': // 자동이체
        return <Building2 className="w-4 h-4 text-blue-500" />;
      case '02': // 신용카드
        return <CreditCard className="w-4 h-4 text-purple-500" />;
      case '03': // 지로
        return <Receipt className="w-4 h-4 text-green-500" />;
      default:
        return <Wallet className="w-4 h-4 text-gray-500" />;
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
                    className="text-sm text-blue-500 hover:text-blue-600 flex items-center gap-1"
                  >
                    <RefreshCw className="w-3 h-3" />
                    새로고침
                  </button>
                </div>

                {paymentInfo.length === 0 ? (
                  <div className="text-center py-4 text-gray-500 text-sm">
                    납부 정보가 없습니다.
                  </div>
                ) : (
                  <div className="space-y-2">
                    {paymentInfo.map((payment) => (
                      <div
                        key={payment.PYM_ACNT_ID}
                        className={`p-3 rounded-lg border transition-colors cursor-pointer ${
                          selectedPymAcntId === payment.PYM_ACNT_ID
                            ? 'bg-indigo-50 border-indigo-300'
                            : 'bg-gray-50 border-gray-200 hover:border-gray-300'
                        }`}
                        onClick={() => setSelectedPymAcntId(payment.PYM_ACNT_ID)}
                      >
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            {getPaymentMethodIcon(payment.PYM_MTH_CD)}
                            <span className="text-sm font-medium text-gray-800">
                              {payment.PYM_MTH_NM || '납부방법 미등록'}
                            </span>
                          </div>
                          <span className="text-xs text-gray-500">
                            계정ID: {payment.PYM_ACNT_ID}
                          </span>
                        </div>

                        {/* 계좌/카드 정보 */}
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

                        {/* 청구매체 */}
                        {payment.BILL_MEDIA_NM && (
                          <div className="text-xs text-gray-500 mt-1">
                            청구매체: {payment.BILL_MEDIA_NM}
                          </div>
                        )}

                        {/* 미납금액 */}
                        {payment.UNPAY_AMT > 0 && (
                          <div className="mt-2 p-2 bg-red-50 rounded flex items-center justify-between">
                            <span className="text-sm text-red-600">미납금액</span>
                            <span className="text-sm font-bold text-red-600">
                              {formatCurrency(payment.UNPAY_AMT)}원
                            </span>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {/* 액션 버튼 */}
                <div className="flex gap-2">
                  <button
                    onClick={() => showToast?.('납부방법 변경 기능은 준비 중입니다.', 'info')}
                    className="flex-1 py-2 text-sm bg-indigo-100 text-indigo-700 rounded-lg hover:bg-indigo-200 transition-colors"
                  >
                    납부방법 변경
                  </button>
                  {totalUnpayment > 0 && (
                    <button
                      onClick={() => showToast?.('미납금 수납 기능은 준비 중입니다.', 'info')}
                      className="flex-1 py-2 text-sm bg-red-100 text-red-700 rounded-lg hover:bg-red-200 transition-colors"
                    >
                      미납금 수납
                    </button>
                  )}
                </div>
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
                  <div className="space-y-2">
                    {billingHistory.length === 0 ? (
                      <div className="text-center py-4 text-gray-500 text-sm">
                        요금 내역이 없습니다.
                      </div>
                    ) : (
                      <>
                        {/* 헤더 */}
                        <div className="grid grid-cols-4 gap-2 px-2 text-xs text-gray-500 font-medium">
                          <span>청구월</span>
                          <span className="text-right">청구금액</span>
                          <span className="text-right">수납금액</span>
                          <span className="text-right">미납금액</span>
                        </div>

                        {/* 내역 */}
                        {billingHistory.map((item, index) => (
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
                      </>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default PaymentInfo;
