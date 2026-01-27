import React, { useState, useEffect } from 'react';
import {
  CreditCard, ChevronDown, ChevronUp, Loader2,
  Wallet, AlertCircle, Calendar, Receipt,
  RefreshCw, Building2, X, Check, Shield, Search, MapPin
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
  const [selectedPaymentInfo, setSelectedPaymentInfo] = useState<PaymentInfoType | null>(null);

  // 서브섹션 펼침 상태
  const [showBillingDetail, setShowBillingDetail] = useState(false);
  const [showUnpaymentDetail, setShowUnpaymentDetail] = useState(false);

  // 필터 상태
  const [paymentFilter, setPaymentFilter] = useState<'all' | 'auto' | 'card' | 'unpaid'>('all');
  const [billingFilter, setBillingFilter] = useState<'all' | 'unpaid'>('all');

  // 납부방법 변경 팝업
  const [showPaymentChangeModal, setShowPaymentChangeModal] = useState(false);

  // 납부방법 변경 폼 - 와이어프레임 기준 확장
  const [paymentChangeForm, setPaymentChangeForm] = useState({
    // 납부정보
    pymMthCd: '01',           // 01: 자동이체, 02: 카드, 03: 지로
    chgResnLCd: '',           // 변경사유 대분류
    chgResnMCd: '',           // 변경사유 중분류
    acntHolderNm: '',         // 예금주명/카드소유주명
    idTypeCd: '',             // 신분유형
    birthDt: '',              // 생년월일
    bankCd: '',               // 은행코드/카드사코드
    acntNo: '',               // 계좌번호/카드번호
    cardExpMm: '',            // 카드 유효기간 월
    cardExpYy: '',            // 카드 유효기간 년
    partnerCardCd: '',        // 제휴사 카드
    payerRelCd: '',           // 납부자관계
    payDayCd: '',             // 결제일
    // 청구주소정보
    dongNm: '',               // 읍/면/동
    roadAddr: '',             // 도로명주소
    jibunAddr: '',            // 지번주소
    bldgCd: '',               // 건물 구분
    bldgNm: '',               // 건물명
    bldgNo: '',               // 건물번호
    dongNo: '',               // 동
    hoNo: ''                  // 호
  });

  const [isVerifying, setIsVerifying] = useState(false);
  const [isVerified, setIsVerified] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // 섹션 펼침 상태
  const [expandedSections, setExpandedSections] = useState({
    existing: true,
    paymentInfo: true,
    addressInfo: false
  });

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

  // 카드사 코드 목록
  const cardCompanyCodes = [
    { CODE: '01', CODE_NM: '삼성카드' },
    { CODE: '02', CODE_NM: '현대카드' },
    { CODE: '03', CODE_NM: 'KB국민카드' },
    { CODE: '04', CODE_NM: '신한카드' },
    { CODE: '05', CODE_NM: '롯데카드' },
    { CODE: '06', CODE_NM: '하나카드' },
    { CODE: '07', CODE_NM: '우리카드' },
    { CODE: '08', CODE_NM: 'BC카드' },
    { CODE: '09', CODE_NM: 'NH농협카드' }
  ];

  // 변경사유 대분류
  const chgResnLCodes = [
    { CODE: '01', CODE_NM: '고객요청' },
    { CODE: '02', CODE_NM: '계좌변경' },
    { CODE: '03', CODE_NM: '카드변경' },
    { CODE: '04', CODE_NM: '명의변경' },
    { CODE: '05', CODE_NM: '기타' }
  ];

  // 변경사유 중분류
  const [chgResnMCodes, setChgResnMCodes] = useState<{CODE: string; CODE_NM: string}[]>([]);

  // 대분류 변경 시 중분류 설정
  const handleChgResnLChange = (code: string) => {
    setPaymentChangeForm(prev => ({ ...prev, chgResnLCd: code, chgResnMCd: '' }));
    const mCodes: Record<string, {CODE: string; CODE_NM: string}[]> = {
      '01': [
        { CODE: '0101', CODE_NM: '납부방법 변경요청' },
        { CODE: '0102', CODE_NM: '청구주소 변경요청' }
      ],
      '02': [
        { CODE: '0201', CODE_NM: '계좌해지' },
        { CODE: '0202', CODE_NM: '계좌번호 변경' },
        { CODE: '0203', CODE_NM: '은행 변경' }
      ],
      '03': [
        { CODE: '0301', CODE_NM: '카드해지' },
        { CODE: '0302', CODE_NM: '카드번호 변경' },
        { CODE: '0303', CODE_NM: '카드사 변경' },
        { CODE: '0304', CODE_NM: '유효기간 변경' }
      ],
      '04': [
        { CODE: '0401', CODE_NM: '예금주 변경' },
        { CODE: '0402', CODE_NM: '카드소유자 변경' }
      ],
      '05': [
        { CODE: '0501', CODE_NM: '기타' }
      ]
    };
    setChgResnMCodes(mCodes[code] || []);
  };

  // 신분유형 코드
  const idTypeCodes = [
    { CODE: '01', CODE_NM: '주민등록번호' },
    { CODE: '02', CODE_NM: '사업자등록번호' },
    { CODE: '03', CODE_NM: '외국인등록번호' },
    { CODE: '04', CODE_NM: '여권번호' }
  ];

  // 납부자관계 코드
  const payerRelCodes = [
    { CODE: '01', CODE_NM: '본인' },
    { CODE: '02', CODE_NM: '배우자' },
    { CODE: '03', CODE_NM: '부모' },
    { CODE: '04', CODE_NM: '자녀' },
    { CODE: '05', CODE_NM: '기타' }
  ];

  // 결제일 코드
  const payDayCodes = [
    { CODE: '05', CODE_NM: '5일' },
    { CODE: '10', CODE_NM: '10일' },
    { CODE: '15', CODE_NM: '15일' },
    { CODE: '20', CODE_NM: '20일' },
    { CODE: '25', CODE_NM: '25일' }
  ];

  // 건물 구분 코드
  const bldgCodes = [
    { CODE: '01', CODE_NM: '아파트' },
    { CODE: '02', CODE_NM: '빌라' },
    { CODE: '03', CODE_NM: '오피스텔' },
    { CODE: '04', CODE_NM: '단독주택' },
    { CODE: '05', CODE_NM: '상가' },
    { CODE: '06', CODE_NM: '기타' }
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
    if (!paymentChangeForm.acntNo || !paymentChangeForm.cardExpMm || !paymentChangeForm.cardExpYy) {
      showToast?.('카드번호와 유효기간을 모두 입력해주세요.', 'warning');
      return;
    }
    setIsVerifying(true);
    try {
      const cardValidYm = paymentChangeForm.cardExpYy + paymentChangeForm.cardExpMm;

      const response = await verifyCard({
        CARD_NO: paymentChangeForm.acntNo,
        CARD_VALID_YM: cardValidYm,
        CARD_OWNER_NM: paymentChangeForm.acntHolderNm
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
    // 필수값 검증
    if (!paymentChangeForm.pymMthCd) {
      showToast?.('납부방법을 선택해주세요.', 'warning');
      return;
    }
    if (!paymentChangeForm.chgResnLCd || !paymentChangeForm.chgResnMCd) {
      showToast?.('변경사유를 선택해주세요.', 'warning');
      return;
    }
    if (!paymentChangeForm.acntHolderNm) {
      showToast?.('예금주명/카드소유주명을 입력해주세요.', 'warning');
      return;
    }
    if (!paymentChangeForm.bankCd) {
      showToast?.('은행/카드사를 선택해주세요.', 'warning');
      return;
    }
    if (!paymentChangeForm.acntNo) {
      showToast?.('계좌번호/카드번호를 입력해주세요.', 'warning');
      return;
    }
    if (!isVerified) {
      showToast?.('먼저 계좌/카드 인증을 완료해주세요.', 'warning');
      return;
    }
    if (!selectedPymAcntId) {
      showToast?.('납부계정을 선택해주세요.', 'warning');
      return;
    }

    setIsSaving(true);
    try {
      const cardValidYm = paymentChangeForm.cardExpYy + paymentChangeForm.cardExpMm;

      const response = await updatePaymentMethod({
        CUST_ID: custId,
        PYM_ACNT_ID: selectedPymAcntId,
        PYM_MTH_CD: paymentChangeForm.pymMthCd,
        CHG_RESN_L_CD: paymentChangeForm.chgResnLCd,
        CHG_RESN_M_CD: paymentChangeForm.chgResnMCd,
        BANK_CD: paymentChangeForm.pymMthCd === '01' ? paymentChangeForm.bankCd : undefined,
        ACNT_NO: paymentChangeForm.pymMthCd === '01' ? paymentChangeForm.acntNo : undefined,
        CARD_CO_CD: paymentChangeForm.pymMthCd === '02' ? paymentChangeForm.bankCd : undefined,
        CARD_NO: paymentChangeForm.pymMthCd === '02' ? paymentChangeForm.acntNo : undefined,
        CARD_VALID_YM: paymentChangeForm.pymMthCd === '02' ? cardValidYm : undefined,
        ACNT_OWNER_NM: paymentChangeForm.acntHolderNm,
        ID_TYPE_CD: paymentChangeForm.idTypeCd,
        BIRTH_DT: paymentChangeForm.birthDt,
        PAYER_REL_CD: paymentChangeForm.payerRelCd,
        PAY_DAY_CD: paymentChangeForm.payDayCd,
        // 청구주소
        DONG_NM: paymentChangeForm.dongNm,
        ROAD_ADDR: paymentChangeForm.roadAddr,
        JIBUN_ADDR: paymentChangeForm.jibunAddr,
        BLDG_CD: paymentChangeForm.bldgCd,
        BLDG_NM: paymentChangeForm.bldgNm,
        BLDG_NO: paymentChangeForm.bldgNo,
        DONG_NO: paymentChangeForm.dongNo,
        HO_NO: paymentChangeForm.hoNo
      });

      if (response.success) {
        showToast?.('납부방법이 변경되었습니다.', 'success');
        setShowPaymentChangeModal(false);
        resetForm();
        loadData();
      } else {
        showToast?.(response.message || '납부방법 변경에 실패했습니다.', 'error');
      }
    } catch (error) {
      console.error('Save payment method error:', error);
      showToast?.('납부방법 변경에 실패했습니다.', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  // 폼 초기화
  const resetForm = () => {
    setPaymentChangeForm({
      pymMthCd: '01', chgResnLCd: '', chgResnMCd: '',
      acntHolderNm: '', idTypeCd: '', birthDt: '',
      bankCd: '', acntNo: '', cardExpMm: '', cardExpYy: '',
      partnerCardCd: '', payerRelCd: '', payDayCd: '',
      dongNm: '', roadAddr: '', jibunAddr: '',
      bldgCd: '', bldgNm: '', bldgNo: '', dongNo: '', hoNo: ''
    });
    setIsVerified(false);
    setChgResnMCodes([]);
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
        if (paymentRes.data.length > 0) {
          setSelectedPymAcntId(paymentRes.data[0].PYM_ACNT_ID);
          setSelectedPaymentInfo(paymentRes.data[0]);
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

  // 납부계정 선택 시 상세정보 업데이트
  const handleSelectPayment = (payment: PaymentInfoType) => {
    setSelectedPymAcntId(payment.PYM_ACNT_ID);
    setSelectedPaymentInfo(payment);
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
      case '01': return <Building2 className="w-4 h-4 text-blue-500" />;
      case '02': return <CreditCard className="w-4 h-4 text-purple-500" />;
      case '03': return <Receipt className="w-4 h-4 text-green-500" />;
      default: return <Wallet className="w-4 h-4 text-gray-500" />;
    }
  };

  // 주소 검색 (TODO: 실제 주소검색 API 연동)
  const handleAddressSearch = () => {
    showToast?.('주소 검색 기능은 준비 중입니다.', 'info');
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
                            계정ID: {payment.PYM_ACNT_ID}
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
                      </div>
                    ))}
                  </div>
                )}

                {/* 액션 버튼 */}
                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      resetForm();
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

    {/* 납부방법 변경 팝업 - 와이어프레임 기준 */}
    {showPaymentChangeModal && (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
        <div className="bg-white rounded-lg shadow-xl w-full max-w-md mx-4 max-h-[90vh] overflow-y-auto">
          {/* 헤더 */}
          <div className="sticky top-0 bg-white flex items-center justify-between p-4 border-b z-10">
            <h3 className="text-lg font-medium text-gray-800">납부방법 변경</h3>
            <button onClick={() => setShowPaymentChangeModal(false)} className="p-1 text-gray-400 hover:text-gray-600">
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* 본문 */}
          <div className="p-4 space-y-4">
            {/* 기존 정보 섹션 */}
            <div className="bg-gray-50 rounded-lg">
              <button
                onClick={() => setExpandedSections(prev => ({ ...prev, existing: !prev.existing }))}
                className="w-full p-3 flex items-center justify-between"
              >
                <span className="text-sm font-medium text-gray-700">기존 정보</span>
                <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${expandedSections.existing ? 'rotate-180' : ''}`} />
              </button>
              {expandedSections.existing && selectedPaymentInfo && (
                <div className="px-3 pb-3 space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-500">납부계정ID</span>
                    <span className="text-gray-800">{selectedPaymentInfo.PYM_ACNT_ID}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">기존 납부방법</span>
                    <span className="text-gray-800">{selectedPaymentInfo.PYM_MTH_NM || '-'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">기존 은행/카드</span>
                    <span className="text-gray-800">{selectedPaymentInfo.BANK_NM || '-'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">기존 청구주소</span>
                    <span className="text-gray-800 text-right max-w-[200px] truncate">
                      {(selectedPaymentInfo as any).BILL_ADDR || '-'}
                    </span>
                  </div>
                </div>
              )}
            </div>

            {/* 납부정보 섹션 */}
            <div className="bg-blue-50 rounded-lg">
              <button
                onClick={() => setExpandedSections(prev => ({ ...prev, paymentInfo: !prev.paymentInfo }))}
                className="w-full p-3 flex items-center justify-between"
              >
                <span className="text-sm font-medium text-blue-800">납부정보</span>
                <ChevronDown className={`w-4 h-4 text-blue-400 transition-transform ${expandedSections.paymentInfo ? 'rotate-180' : ''}`} />
              </button>
              {expandedSections.paymentInfo && (
                <div className="px-3 pb-3 space-y-3">
                  {/* 납부방법 */}
                  <div>
                    <label className="block text-xs text-gray-600 mb-1">납부방법 *</label>
                    <select
                      value={paymentChangeForm.pymMthCd}
                      onChange={(e) => {
                        setPaymentChangeForm(prev => ({ ...prev, pymMthCd: e.target.value, bankCd: '', acntNo: '' }));
                        setIsVerified(false);
                      }}
                      className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="01">자동이체</option>
                      <option value="02">신용카드</option>
                      <option value="03">지로</option>
                    </select>
                  </div>

                  {/* 변경사유 */}
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-xs text-gray-600 mb-1">변경사유(대) *</label>
                      <select
                        value={paymentChangeForm.chgResnLCd}
                        onChange={(e) => handleChgResnLChange(e.target.value)}
                        className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="">선택</option>
                        {chgResnLCodes.map(code => (
                          <option key={code.CODE} value={code.CODE}>{code.CODE_NM}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs text-gray-600 mb-1">변경사유(중) *</label>
                      <select
                        value={paymentChangeForm.chgResnMCd}
                        onChange={(e) => setPaymentChangeForm(prev => ({ ...prev, chgResnMCd: e.target.value }))}
                        disabled={!paymentChangeForm.chgResnLCd}
                        className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
                      >
                        <option value="">선택</option>
                        {chgResnMCodes.map(code => (
                          <option key={code.CODE} value={code.CODE}>{code.CODE_NM}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* 예금주명/카드소유주명 & 신분유형 */}
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-xs text-gray-600 mb-1">
                        {paymentChangeForm.pymMthCd === '02' ? '카드소유주명' : '예금주명'} *
                      </label>
                      <input
                        type="text"
                        value={paymentChangeForm.acntHolderNm}
                        onChange={(e) => setPaymentChangeForm(prev => ({ ...prev, acntHolderNm: e.target.value }))}
                        className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-600 mb-1">신분유형</label>
                      <select
                        value={paymentChangeForm.idTypeCd}
                        onChange={(e) => setPaymentChangeForm(prev => ({ ...prev, idTypeCd: e.target.value }))}
                        className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="">선택</option>
                        {idTypeCodes.map(code => (
                          <option key={code.CODE} value={code.CODE}>{code.CODE_NM}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* 생년월일 */}
                  <div>
                    <label className="block text-xs text-gray-600 mb-1">생년월일</label>
                    <input
                      type="text"
                      value={paymentChangeForm.birthDt}
                      onChange={(e) => setPaymentChangeForm(prev => ({ ...prev, birthDt: e.target.value.replace(/[^0-9]/g, '') }))}
                      placeholder="YYYYMMDD"
                      maxLength={8}
                      className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  {/* 은행/카드사 & 계좌/카드번호 */}
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-xs text-gray-600 mb-1">
                        {paymentChangeForm.pymMthCd === '02' ? '카드사명' : '은행명'} *
                      </label>
                      <select
                        value={paymentChangeForm.bankCd}
                        onChange={(e) => {
                          setPaymentChangeForm(prev => ({ ...prev, bankCd: e.target.value }));
                          setIsVerified(false);
                        }}
                        className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="">선택</option>
                        {(paymentChangeForm.pymMthCd === '02' ? cardCompanyCodes : bankCodes).map(code => (
                          <option key={code.CODE} value={code.CODE}>{code.CODE_NM}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs text-gray-600 mb-1">
                        {paymentChangeForm.pymMthCd === '02' ? '카드번호' : '계좌번호'} *
                      </label>
                      <input
                        type="text"
                        value={paymentChangeForm.acntNo}
                        onChange={(e) => {
                          setPaymentChangeForm(prev => ({ ...prev, acntNo: e.target.value.replace(/[^0-9]/g, '') }));
                          setIsVerified(false);
                        }}
                        maxLength={16}
                        className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  </div>

                  {/* 카드 유효기간 (카드 선택 시만) */}
                  {paymentChangeForm.pymMthCd === '02' && (
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-xs text-gray-600 mb-1">유효기간 (월)</label>
                        <select
                          value={paymentChangeForm.cardExpMm}
                          onChange={(e) => setPaymentChangeForm(prev => ({ ...prev, cardExpMm: e.target.value }))}
                          className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
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
                        <label className="block text-xs text-gray-600 mb-1">유효기간 (년)</label>
                        <select
                          value={paymentChangeForm.cardExpYy}
                          onChange={(e) => setPaymentChangeForm(prev => ({ ...prev, cardExpYy: e.target.value }))}
                          className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                        >
                          <option value="">년</option>
                          {Array.from({ length: 10 }, (_, i) => (
                            <option key={i} value={String(25 + i)}>20{25 + i}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                  )}

                  {/* 인증 버튼 */}
                  <button
                    onClick={paymentChangeForm.pymMthCd === '02' ? handleVerifyCard : handleVerifyAccount}
                    disabled={isVerifying || isVerified}
                    className={`w-full py-2 rounded-lg flex items-center justify-center gap-2 text-sm ${
                      isVerified
                        ? 'bg-green-100 text-green-700'
                        : 'bg-blue-500 text-white hover:bg-blue-600 disabled:bg-gray-400'
                    }`}
                  >
                    {isVerifying ? (
                      <><Loader2 className="w-4 h-4 animate-spin" /> 인증중...</>
                    ) : isVerified ? (
                      <><Check className="w-4 h-4" /> 인증완료</>
                    ) : (
                      <><Shield className="w-4 h-4" /> {paymentChangeForm.pymMthCd === '02' ? '카드 인증' : '계좌 인증'}</>
                    )}
                  </button>

                  {/* 납부자관계 & 결제일 */}
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-xs text-gray-600 mb-1">납부자관계</label>
                      <select
                        value={paymentChangeForm.payerRelCd}
                        onChange={(e) => setPaymentChangeForm(prev => ({ ...prev, payerRelCd: e.target.value }))}
                        className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="">선택</option>
                        {payerRelCodes.map(code => (
                          <option key={code.CODE} value={code.CODE}>{code.CODE_NM}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs text-gray-600 mb-1">결제일</label>
                      <select
                        value={paymentChangeForm.payDayCd}
                        onChange={(e) => setPaymentChangeForm(prev => ({ ...prev, payDayCd: e.target.value }))}
                        className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="">선택</option>
                        {payDayCodes.map(code => (
                          <option key={code.CODE} value={code.CODE}>{code.CODE_NM}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* 청구주소정보 섹션 */}
            <div className="bg-green-50 rounded-lg">
              <button
                onClick={() => setExpandedSections(prev => ({ ...prev, addressInfo: !prev.addressInfo }))}
                className="w-full p-3 flex items-center justify-between"
              >
                <span className="text-sm font-medium text-green-800">청구주소정보</span>
                <ChevronDown className={`w-4 h-4 text-green-400 transition-transform ${expandedSections.addressInfo ? 'rotate-180' : ''}`} />
              </button>
              {expandedSections.addressInfo && (
                <div className="px-3 pb-3 space-y-3">
                  {/* 읍/면/동 검색 */}
                  <div>
                    <label className="block text-xs text-gray-600 mb-1">읍/면/동</label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={paymentChangeForm.dongNm}
                        onChange={(e) => setPaymentChangeForm(prev => ({ ...prev, dongNm: e.target.value }))}
                        className="flex-1 px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
                      />
                      <button
                        onClick={handleAddressSearch}
                        className="px-3 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600"
                      >
                        <Search className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {/* 도로명주소 */}
                  <div>
                    <label className="block text-xs text-gray-600 mb-1">도로명주소</label>
                    <input
                      type="text"
                      value={paymentChangeForm.roadAddr}
                      readOnly
                      className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg bg-gray-100"
                    />
                  </div>

                  {/* 지번주소 */}
                  <div>
                    <label className="block text-xs text-gray-600 mb-1">지번주소</label>
                    <input
                      type="text"
                      value={paymentChangeForm.jibunAddr}
                      readOnly
                      className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg bg-gray-100"
                    />
                  </div>

                  {/* 건물 */}
                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <label className="block text-xs text-gray-600 mb-1">건물</label>
                      <select
                        value={paymentChangeForm.bldgCd}
                        onChange={(e) => setPaymentChangeForm(prev => ({ ...prev, bldgCd: e.target.value }))}
                        className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
                      >
                        <option value="">선택</option>
                        {bldgCodes.map(code => (
                          <option key={code.CODE} value={code.CODE}>{code.CODE_NM}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs text-gray-600 mb-1">건물명</label>
                      <input
                        type="text"
                        value={paymentChangeForm.bldgNm}
                        onChange={(e) => setPaymentChangeForm(prev => ({ ...prev, bldgNm: e.target.value }))}
                        className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-600 mb-1">번호</label>
                      <input
                        type="text"
                        value={paymentChangeForm.bldgNo}
                        onChange={(e) => setPaymentChangeForm(prev => ({ ...prev, bldgNo: e.target.value }))}
                        className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
                      />
                    </div>
                  </div>

                  {/* 상세 (동/호) */}
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-xs text-gray-600 mb-1">동</label>
                      <div className="flex items-center gap-1">
                        <input
                          type="text"
                          value={paymentChangeForm.dongNo}
                          onChange={(e) => setPaymentChangeForm(prev => ({ ...prev, dongNo: e.target.value }))}
                          className="flex-1 px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
                        />
                        <span className="text-sm text-gray-500">동</span>
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs text-gray-600 mb-1">호</label>
                      <div className="flex items-center gap-1">
                        <input
                          type="text"
                          value={paymentChangeForm.hoNo}
                          onChange={(e) => setPaymentChangeForm(prev => ({ ...prev, hoNo: e.target.value }))}
                          className="flex-1 px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
                        />
                        <span className="text-sm text-gray-500">호</span>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* 푸터 */}
          <div className="sticky bottom-0 bg-white p-4 border-t flex gap-2">
            <button
              onClick={() => setShowPaymentChangeModal(false)}
              className="flex-1 py-2.5 bg-gray-100 text-gray-600 rounded-lg hover:bg-gray-200 text-sm font-medium"
            >
              닫기
            </button>
            <button
              onClick={handleSavePaymentMethod}
              disabled={!isVerified || isSaving}
              className="flex-1 py-2.5 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:bg-gray-400 text-sm font-medium flex items-center justify-center gap-2"
            >
              {isSaving ? (
                <><Loader2 className="w-4 h-4 animate-spin" /> 저장중...</>
              ) : (
                '저장'
              )}
            </button>
          </div>
        </div>
      </div>
    )}
    </>
  );
};

export default PaymentInfo;
