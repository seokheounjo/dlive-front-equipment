import React, { useState, useEffect } from 'react';
import {
  CreditCard, ChevronDown, ChevronUp, Loader2,
  Wallet, AlertCircle, Calendar, Receipt,
  RefreshCw, Building2, X, Check, Shield
} from 'lucide-react';
import {
  PaymentInfo as PaymentInfoType,
  BillingInfo,
  UnpaymentInfo,
  getPaymentInfo,
  getBillingHistory,
  getUnpaymentList,
  updatePaymentMethod,
  verifyBankAccount,
  verifyCard,
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

  // 필터 상태
  const [paymentFilter, setPaymentFilter] = useState<'all' | 'auto' | 'card' | 'unpaid'>('all');
  const [billingFilter, setBillingFilter] = useState<'all' | 'unpaid'>('all');

  // 납부방법 변경 팝업
  const [showPaymentChangeModal, setShowPaymentChangeModal] = useState(false);
  const [paymentChangeForm, setPaymentChangeForm] = useState({
    pymMthCd: '01',      // 01: 자동이체, 02: 카드
    bankCd: '',          // 은행코드
    acntNo: '',          // 계좌번호
    acntHolderNm: '',    // 예금주
    cardNo: '',          // 카드번호
    cardExpMm: '',       // 유효기간 월
    cardExpYy: '',       // 유효기간 년
    cardHolderNm: ''     // 카드소유자
  });
  const [isVerifying, setIsVerifying] = useState(false);
  const [isVerified, setIsVerified] = useState(false);

  // 은행 코드 목록
  const bankCodes = [
    { CODE: '003', CODE_NM: 'IBK기업' },
    { CODE: '004', CODE_NM: 'KB국민' },
    { CODE: '011', CODE_NM: 'NH농협' },
    { CODE: '020', CODE_NM: '우리' },
    { CODE: '023', CODE_NM: 'SC제일' },
    { CODE: '027', CODE_NM: '씨티' },
    { CODE: '031', CODE_NM: '대구' },
    { CODE: '032', CODE_NM: '부산' },
    { CODE: '039', CODE_NM: '경남' },
    { CODE: '045', CODE_NM: '새마을' },
    { CODE: '048', CODE_NM: '신협' },
    { CODE: '071', CODE_NM: '우체국' },
    { CODE: '081', CODE_NM: '하나' },
    { CODE: '088', CODE_NM: '신한' },
    { CODE: '089', CODE_NM: 'K뱅크' },
    { CODE: '090', CODE_NM: '카카오뱅크' },
    { CODE: '092', CODE_NM: '토스뱅크' }
  ];

  // 계좌 인증 처리
  const handleVerifyAccount = async () => {
    if (!paymentChangeForm.bankCd || !paymentChangeForm.acntNo || !paymentChangeForm.acntHolderNm) {
      showToast?.('은행, 계좌번호, 예금주를 모두 입력해주세요.', 'warning');
      return;
    }
    setIsVerifying(true);
    try {
      const response = await verifyBankAccount({
        BANK_CD: paymentChangeForm.bankCd,
        ACNT_NO: paymentChangeForm.acntNo,
        ACNT_OWNER_NM: paymentChangeForm.acntHolderNm
      });

      if (response.success) {
        setIsVerified(true);
        showToast?.('계좌 인증이 완료되었습니다.', 'success');
      } else {
        showToast?.(response.message || '계좌 인증에 실패했습니다.', 'error');
      }
    } catch (error) {
      console.error('Verify account error:', error);
      showToast?.('계좌 인증에 실패했습니다.', 'error');
    } finally {
      setIsVerifying(false);
    }
  };

  // 카드 인증 처리
  const handleVerifyCard = async () => {
    if (!paymentChangeForm.cardNo || !paymentChangeForm.cardExpMm || !paymentChangeForm.cardExpYy) {
      showToast?.('카드번호와 유효기간을 모두 입력해주세요.', 'warning');
      return;
    }
    setIsVerifying(true);
    try {
      // 유효기간 포맷: YYMM (년도 2자리 + 월 2자리)
      const cardValidYm = paymentChangeForm.cardExpYy + paymentChangeForm.cardExpMm;

      const response = await verifyCard({
        CARD_NO: paymentChangeForm.cardNo,
        CARD_VALID_YM: cardValidYm,
        CARD_OWNER_NM: paymentChangeForm.cardHolderNm
      });

      if (response.success) {
        setIsVerified(true);
        showToast?.('카드 인증이 완료되었습니다.', 'success');
      } else {
        showToast?.(response.message || '카드 인증에 실패했습니다.', 'error');
      }
    } catch (error) {
      console.error('Verify card error:', error);
      showToast?.('카드 인증에 실패했습니다.', 'error');
    } finally {
      setIsVerifying(false);
    }
  };

  // 납부방법 변경 저장
  const handleSavePaymentMethod = async () => {
    if (!isVerified) {
      showToast?.('먼저 계좌/카드 인증을 완료해주세요.', 'warning');
      return;
    }

    // 선택된 납부계정 확인
    if (!selectedPymAcntId) {
      showToast?.('납부계정을 선택해주세요.', 'warning');
      return;
    }

    try {
      // 유효기간 포맷: YYMM
      const cardValidYm = paymentChangeForm.cardExpYy + paymentChangeForm.cardExpMm;

      const response = await updatePaymentMethod({
        CUST_ID: custId,
        PYM_ACNT_ID: selectedPymAcntId,
        PYM_MTH_CD: paymentChangeForm.pymMthCd,
        // 자동이체 정보
        BANK_CD: paymentChangeForm.pymMthCd === '01' ? paymentChangeForm.bankCd : undefined,
        ACNT_NO: paymentChangeForm.pymMthCd === '01' ? paymentChangeForm.acntNo : undefined,
        // 카드 정보
        CARD_NO: paymentChangeForm.pymMthCd === '02' ? paymentChangeForm.cardNo : undefined,
        CARD_VALID_YM: paymentChangeForm.pymMthCd === '02' ? cardValidYm : undefined,
        // 소유자명
        ACNT_OWNER_NM: paymentChangeForm.pymMthCd === '01'
          ? paymentChangeForm.acntHolderNm
          : paymentChangeForm.cardHolderNm
      });

      if (response.success) {
        showToast?.('납부방법이 변경되었습니다.', 'success');
        setShowPaymentChangeModal(false);
        setIsVerified(false);
        setPaymentChangeForm({
          pymMthCd: '01', bankCd: '', acntNo: '', acntHolderNm: '',
          cardNo: '', cardExpMm: '', cardExpYy: '', cardHolderNm: ''
        });
        // 데이터 새로고침
        loadData();
      } else {
        showToast?.(response.message || '납부방법 변경에 실패했습니다.', 'error');
      }
    } catch (error) {
      console.error('Save payment method error:', error);
      showToast?.('납부방법 변경에 실패했습니다.', 'error');
    }
  };

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
    <>
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
                    onClick={() => {
                      setIsVerified(false);
                      setPaymentChangeForm({
                        pymMthCd: '01', bankCd: '', acntNo: '', acntHolderNm: '',
                        cardNo: '', cardExpMm: '', cardExpYy: '', cardHolderNm: ''
                      });
                      setShowPaymentChangeModal(true);
                    }}
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
                  <div className="space-y-3">
                    {/* 요금 내역 필터 버튼 */}
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
                      <>
                        {/* 헤더 */}
                        <div className="grid grid-cols-4 gap-2 px-2 text-xs text-gray-500 font-medium">
                          <span>청구월</span>
                          <span className="text-right">청구금액</span>
                          <span className="text-right">수납금액</span>
                          <span className="text-right">미납금액</span>
                        </div>

                        {/* 내역 */}
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

    {/* 납부방법 변경 팝업 */}
    {showPaymentChangeModal && (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
        <div className="bg-white rounded-lg shadow-xl w-full max-w-md mx-4 max-h-[90vh] overflow-y-auto">
          {/* 헤더 */}
          <div className="flex items-center justify-between p-4 border-b">
            <h3 className="text-lg font-medium text-gray-800">납부방법 변경</h3>
            <button onClick={() => setShowPaymentChangeModal(false)} className="p-1 text-gray-400 hover:text-gray-600">
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* 본문 */}
          <div className="p-4 space-y-4">
            {/* 납부방법 선택 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">납부방법</label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => {
                    setPaymentChangeForm(prev => ({ ...prev, pymMthCd: '01' }));
                    setIsVerified(false);
                  }}
                  className={`p-3 rounded-lg border flex items-center justify-center gap-2 ${
                    paymentChangeForm.pymMthCd === '01'
                      ? 'bg-indigo-50 border-indigo-500 text-indigo-700'
                      : 'border-gray-300 text-gray-600 hover:border-gray-400'
                  }`}
                >
                  <Building2 className="w-5 h-5" />
                  자동이체
                </button>
                <button
                  onClick={() => {
                    setPaymentChangeForm(prev => ({ ...prev, pymMthCd: '02' }));
                    setIsVerified(false);
                  }}
                  className={`p-3 rounded-lg border flex items-center justify-center gap-2 ${
                    paymentChangeForm.pymMthCd === '02'
                      ? 'bg-purple-50 border-purple-500 text-purple-700'
                      : 'border-gray-300 text-gray-600 hover:border-gray-400'
                  }`}
                >
                  <CreditCard className="w-5 h-5" />
                  신용카드
                </button>
              </div>
            </div>

            {/* 자동이체 입력 */}
            {paymentChangeForm.pymMthCd === '01' && (
              <div className="space-y-3 p-3 bg-gray-50 rounded-lg">
                <div>
                  <label className="block text-sm text-gray-600 mb-1">은행</label>
                  <select
                    value={paymentChangeForm.bankCd}
                    onChange={(e) => setPaymentChangeForm(prev => ({ ...prev, bankCd: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="">선택</option>
                    {bankCodes.map((bank) => (
                      <option key={bank.CODE} value={bank.CODE}>{bank.CODE_NM}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm text-gray-600 mb-1">계좌번호</label>
                  <input
                    type="text"
                    value={paymentChangeForm.acntNo}
                    onChange={(e) => setPaymentChangeForm(prev => ({ ...prev, acntNo: e.target.value.replace(/[^0-9]/g, '') }))}
                    placeholder="계좌번호 입력 (숫자만)"
                    maxLength={16}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-600 mb-1">예금주</label>
                  <input
                    type="text"
                    value={paymentChangeForm.acntHolderNm}
                    onChange={(e) => setPaymentChangeForm(prev => ({ ...prev, acntHolderNm: e.target.value }))}
                    placeholder="예금주명"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <button
                  onClick={handleVerifyAccount}
                  disabled={isVerifying || isVerified}
                  className={`w-full py-2 rounded-lg flex items-center justify-center gap-2 ${
                    isVerified
                      ? 'bg-green-100 text-green-700'
                      : 'bg-indigo-500 text-white hover:bg-indigo-600 disabled:bg-gray-400'
                  }`}
                >
                  {isVerifying ? (
                    <><Loader2 className="w-4 h-4 animate-spin" /> 인증중...</>
                  ) : isVerified ? (
                    <><Check className="w-4 h-4" /> 인증완료</>
                  ) : (
                    <><Shield className="w-4 h-4" /> 계좌 인증</>
                  )}
                </button>
              </div>
            )}

            {/* 카드 입력 */}
            {paymentChangeForm.pymMthCd === '02' && (
              <div className="space-y-3 p-3 bg-gray-50 rounded-lg">
                <div>
                  <label className="block text-sm text-gray-600 mb-1">카드번호</label>
                  <input
                    type="text"
                    value={paymentChangeForm.cardNo}
                    onChange={(e) => setPaymentChangeForm(prev => ({ ...prev, cardNo: e.target.value.replace(/[^0-9]/g, '') }))}
                    placeholder="카드번호 16자리"
                    maxLength={16}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm text-gray-600 mb-1">유효기간 (월)</label>
                    <select
                      value={paymentChangeForm.cardExpMm}
                      onChange={(e) => setPaymentChangeForm(prev => ({ ...prev, cardExpMm: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                    >
                      <option value="">월</option>
                      {Array.from({ length: 12 }, (_, i) => (
                        <option key={i + 1} value={String(i + 1).padStart(2, '0')}>
                          {String(i + 1).padStart(2, '0')}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm text-gray-600 mb-1">유효기간 (년)</label>
                    <select
                      value={paymentChangeForm.cardExpYy}
                      onChange={(e) => setPaymentChangeForm(prev => ({ ...prev, cardExpYy: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                    >
                      <option value="">년</option>
                      {Array.from({ length: 10 }, (_, i) => (
                        <option key={i} value={String(25 + i)}>
                          20{25 + i}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
                <div>
                  <label className="block text-sm text-gray-600 mb-1">카드 소유자</label>
                  <input
                    type="text"
                    value={paymentChangeForm.cardHolderNm}
                    onChange={(e) => setPaymentChangeForm(prev => ({ ...prev, cardHolderNm: e.target.value }))}
                    placeholder="카드 소유자명"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                  />
                </div>
                <button
                  onClick={handleVerifyCard}
                  disabled={isVerifying || isVerified}
                  className={`w-full py-2 rounded-lg flex items-center justify-center gap-2 ${
                    isVerified
                      ? 'bg-green-100 text-green-700'
                      : 'bg-purple-500 text-white hover:bg-purple-600 disabled:bg-gray-400'
                  }`}
                >
                  {isVerifying ? (
                    <><Loader2 className="w-4 h-4 animate-spin" /> 인증중...</>
                  ) : isVerified ? (
                    <><Check className="w-4 h-4" /> 인증완료</>
                  ) : (
                    <><Shield className="w-4 h-4" /> 카드 인증</>
                  )}
                </button>
              </div>
            )}
          </div>

          {/* 푸터 */}
          <div className="p-4 border-t flex gap-2">
            <button
              onClick={() => setShowPaymentChangeModal(false)}
              className="flex-1 py-2 bg-gray-100 text-gray-600 rounded-lg hover:bg-gray-200"
            >
              취소
            </button>
            <button
              onClick={handleSavePaymentMethod}
              disabled={!isVerified}
              className="flex-1 py-2 bg-indigo-500 text-white rounded-lg hover:bg-indigo-600 disabled:bg-gray-400"
            >
              변경 완료
            </button>
          </div>
        </div>
      </div>
    )}
    </>
  );
};

export default PaymentInfo;
