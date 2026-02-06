import React, { useState, useEffect } from 'react';
import { X, Loader2, AlertCircle, CreditCard, Check, PenTool } from 'lucide-react';
import SignaturePad from '../common/SignaturePad';
import {
  getPaymentAccounts,
  PaymentAccountInfo,
  updatePaymentMethod,
  verifyBankAccount,
  verifyCard
} from '../../services/customerApi';

// 납부계정ID 포맷 (3-3-4)
const formatPymAcntId = (pymAcntId: string): string => {
  if (!pymAcntId) return '-';
  const cleaned = pymAcntId.replace(/[^0-9]/g, '');
  if (cleaned.length === 10) {
    return `${cleaned.slice(0, 3)}-${cleaned.slice(3, 6)}-${cleaned.slice(6, 10)}`;
  }
  return pymAcntId;
};

interface PaymentChangeModalProps {
  isOpen: boolean;
  onClose: () => void;
  custId: string;
  custNm?: string;
  initialPymAcntId?: string;
  showToast?: (message: string, type: 'success' | 'error' | 'warning' | 'info') => void;
  onSuccess?: () => void;
}

// 폼 데이터 타입
interface PaymentFormData {
  pymMthCd: string;
  changeReasonL: string;
  changeReasonM: string;
  acntHolderNm: string;
  idType: string;
  birthDt: string;
  bankCd: string;
  acntNo: string;
  cardExpMm: string;
  cardExpYy: string;
  joinCardYn: string;
  pyrRel: string;
  pymDay: string;
}

const defaultPaymentForm: PaymentFormData = {
  pymMthCd: '01',
  changeReasonL: '',
  changeReasonM: '',
  acntHolderNm: '',
  idType: '01',
  birthDt: '',
  bankCd: '',
  acntNo: '',
  cardExpMm: '',
  cardExpYy: '',
  joinCardYn: 'N',
  pyrRel: '01',
  pymDay: ''
};

/**
 * 납부방법 변경 모달
 */
const PaymentChangeModal: React.FC<PaymentChangeModalProps> = ({
  isOpen,
  onClose,
  custId,
  custNm,
  initialPymAcntId,
  showToast,
  onSuccess
}) => {
  // 납부계정 목록
  const [paymentAccounts, setPaymentAccounts] = useState<PaymentAccountInfo[]>([]);
  const [selectedPymAcntId, setSelectedPymAcntId] = useState<string>(initialPymAcntId || '');
  const [isLoading, setIsLoading] = useState(false);

  // 납부정보 폼
  const [paymentForm, setPaymentForm] = useState<PaymentFormData>({ ...defaultPaymentForm });
  const [isVerified, setIsVerified] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // 서명 모달
  const [showSignatureModal, setShowSignatureModal] = useState(false);

  // 알림 팝업
  const [alertPopup, setAlertPopup] = useState<{
    show: boolean;
    title: string;
    message: string;
    type: 'success' | 'error' | 'warning' | 'info';
  }>({ show: false, title: '', message: '', type: 'info' });

  // 은행 코드 목록
  const bankCodes = [
    { CODE: '003', CODE_NM: 'IBK기업' },
    { CODE: '004', CODE_NM: 'KB국민' },
    { CODE: '011', CODE_NM: 'NH농협' },
    { CODE: '020', CODE_NM: '우리' },
    { CODE: '023', CODE_NM: 'SC제일' },
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
  const changeReasonLargeCodes = [
    { CODE: '01', CODE_NM: '개인사정' },
    { CODE: '02', CODE_NM: '요금관련' },
    { CODE: '03', CODE_NM: '서비스관련' },
    { CODE: '04', CODE_NM: '기타' }
  ];

  // 변경사유 중분류
  const changeReasonMiddleCodes: Record<string, { CODE: string; CODE_NM: string }[]> = {
    '01': [
      { CODE: '0101', CODE_NM: '계좌/카드 변경' },
      { CODE: '0102', CODE_NM: '명의 변경' },
      { CODE: '0103', CODE_NM: '주소 이전' }
    ],
    '02': [
      { CODE: '0201', CODE_NM: '요금 미납' },
      { CODE: '0202', CODE_NM: '요금 문의' },
      { CODE: '0203', CODE_NM: '할인 요청' }
    ],
    '03': [
      { CODE: '0301', CODE_NM: '서비스 불만' },
      { CODE: '0302', CODE_NM: '상품 변경' }
    ],
    '04': [
      { CODE: '0401', CODE_NM: '기타 사유' }
    ]
  };

  // 신분유형 코드
  const idTypeCodes = [
    { CODE: '01', CODE_NM: '주민등록번호' },
    { CODE: '02', CODE_NM: '사업자등록번호' },
    { CODE: '03', CODE_NM: '외국인등록번호' }
  ];

  // 납부자관계 코드
  const pyrRelCodes = [
    { CODE: '01', CODE_NM: '본인' },
    { CODE: '02', CODE_NM: '배우자' },
    { CODE: '03', CODE_NM: '부모' },
    { CODE: '04', CODE_NM: '자녀' },
    { CODE: '05', CODE_NM: '기타' }
  ];

  // 결제일 목록
  const paymentDays = [
    { CODE: '05', CODE_NM: '5일' },
    { CODE: '10', CODE_NM: '10일' },
    { CODE: '15', CODE_NM: '15일' },
    { CODE: '20', CODE_NM: '20일' },
    { CODE: '25', CODE_NM: '25일' },
    { CODE: '27', CODE_NM: '27일' }
  ];

  // 모달 열릴 때 데이터 로드
  useEffect(() => {
    if (isOpen && custId) {
      loadPaymentAccounts();
    }
  }, [isOpen, custId]);

  // 모달 열릴 때 초기화
  useEffect(() => {
    if (isOpen) {
      setPaymentForm({ ...defaultPaymentForm });
      setIsVerified(false);
      if (initialPymAcntId) {
        setSelectedPymAcntId(initialPymAcntId);
      }
    }
  }, [isOpen, initialPymAcntId]);

  // 배경 스크롤 제어
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

  const loadPaymentAccounts = async () => {
    setIsLoading(true);
    try {
      const response = await getPaymentAccounts(custId);
      if (response.success && response.data) {
        setPaymentAccounts(response.data);
        if (response.data.length > 0 && !selectedPymAcntId) {
          setSelectedPymAcntId(response.data[0].PYM_ACNT_ID);
        }
      }
    } catch (error) {
      console.error('Load payment accounts error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const showAlert = (message: string, type: 'success' | 'error' | 'warning' | 'info' = 'info') => {
    setAlertPopup({
      show: true,
      title: type === 'success' ? '완료' : type === 'error' ? '오류' : type === 'warning' ? '알림' : '안내',
      message,
      type
    });
  };

  // 계좌/카드 인증
  const handleVerify = async () => {
    if (!paymentForm.acntHolderNm) {
      showAlert('예금주/카드소유주 명을 입력해주세요.', 'warning');
      return;
    }
    if (!paymentForm.bankCd) {
      showAlert('은행/카드사를 선택해주세요.', 'warning');
      return;
    }
    if (!paymentForm.acntNo) {
      showAlert('계좌번호/카드번호를 입력해주세요.', 'warning');
      return;
    }

    setIsVerifying(true);
    try {
      if (paymentForm.pymMthCd === '01') {
        const response = await verifyBankAccount({
          BANK_CD: paymentForm.bankCd,
          ACNT_NO: paymentForm.acntNo,
          ACNT_OWNER_NM: paymentForm.acntHolderNm
        });
        if (response.success) {
          setIsVerified(true);
          showAlert('계좌 인증이 완료되었습니다.', 'success');
        } else {
          showAlert(response.message || '계좌 인증에 실패했습니다.', 'error');
        }
      } else {
        if (!paymentForm.cardExpMm || !paymentForm.cardExpYy) {
          showAlert('카드 유효기간을 입력해주세요.', 'warning');
          setIsVerifying(false);
          return;
        }
        const cardValidYm = paymentForm.cardExpYy + paymentForm.cardExpMm;
        const response = await verifyCard({
          CARD_NO: paymentForm.acntNo,
          CARD_VALID_YM: cardValidYm,
          CARD_OWNER_NM: paymentForm.acntHolderNm
        });
        if (response.success) {
          setIsVerified(true);
          showAlert('카드 인증이 완료되었습니다.', 'success');
        } else {
          showAlert(response.message || '카드 인증에 실패했습니다.', 'error');
        }
      }
    } catch (error) {
      console.error('Verify error:', error);
      showAlert('인증 중 오류가 발생했습니다.', 'error');
    } finally {
      setIsVerifying(false);
    }
  };

  // 저장 (서명 모달 표시)
  const handleSave = () => {
    if (!selectedPymAcntId) {
      showAlert('납부계정을 선택해주세요.', 'warning');
      return;
    }
    if (!isVerified) {
      showAlert('계좌/카드 인증을 먼저 완료해주세요.', 'warning');
      return;
    }
    if (!paymentForm.changeReasonL || !paymentForm.changeReasonM) {
      showAlert('변경사유를 선택해주세요.', 'warning');
      return;
    }
    setShowSignatureModal(true);
  };

  // 서명 완료 후 저장
  const handleSignatureComplete = async (signature: string) => {
    setShowSignatureModal(false);
    setIsSaving(true);

    try {
      const response = await updatePaymentMethod({
        CUST_ID: custId,
        PYM_ACNT_ID: selectedPymAcntId,
        PYM_MTHD_CD: paymentForm.pymMthCd,
        BANK_CD: paymentForm.bankCd,
        ACNT_NO: paymentForm.acntNo,
        ACNT_OWNER_NM: paymentForm.acntHolderNm,
        ID_TP_CD: paymentForm.idType,
        BIRTH_DT: paymentForm.birthDt,
        PYR_REL_CD: paymentForm.pyrRel,
        PYM_DAY: paymentForm.pymDay,
        CARD_VALID_YM: paymentForm.pymMthCd === '02' ? paymentForm.cardExpYy + paymentForm.cardExpMm : undefined,
        JOIN_CARD_YN: paymentForm.pymMthCd === '02' ? paymentForm.joinCardYn : undefined,
        CHG_REAS_L_CD: paymentForm.changeReasonL,
        CHG_REAS_M_CD: paymentForm.changeReasonM,
        SIGNATURE: signature
      });

      if (response.success) {
        showToast?.('납부방법이 변경되었습니다.', 'success');
        onSuccess?.();
        onClose();
      } else {
        showAlert(response.message || '납부방법 변경에 실패했습니다.', 'error');
      }
    } catch (error) {
      console.error('Save payment error:', error);
      showAlert('납부방법 변경 중 오류가 발생했습니다.', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  // 납부계정 선택
  const handleAccountSelect = (pymAcntId: string) => {
    if (pymAcntId !== selectedPymAcntId) {
      setSelectedPymAcntId(pymAcntId);
      setPaymentForm({ ...defaultPaymentForm });
      setIsVerified(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div
        className="bg-white rounded-xl shadow-xl w-full max-w-md mx-4 max-h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* 헤더 */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200 bg-gradient-to-r from-orange-500 to-orange-600 rounded-t-xl">
          <div className="flex items-center gap-2 text-white">
            <CreditCard className="w-5 h-5" />
            <h3 className="font-semibold">납부방법 변경</h3>
          </div>
          <button
            onClick={onClose}
            className="text-white/80 hover:text-white transition-colors"
            disabled={isSaving}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* 컨텐츠 */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4 min-h-0">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 text-orange-500 animate-spin" />
            </div>
          ) : paymentAccounts.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <CreditCard className="w-12 h-12 text-gray-300 mx-auto mb-2" />
              <p>납부계정 정보가 없습니다.</p>
            </div>
          ) : (
            <>
              {/* 납부계정 선택 */}
              <div className="space-y-2">
                {paymentAccounts.map((item) => (
                  <div
                    key={item.PYM_ACNT_ID}
                    onClick={() => handleAccountSelect(item.PYM_ACNT_ID)}
                    className={`p-3 rounded-lg border cursor-pointer transition-colors ${
                      selectedPymAcntId === item.PYM_ACNT_ID
                        ? 'bg-orange-50 border-orange-300'
                        : 'bg-gray-50 border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-mono text-sm text-blue-600">{formatPymAcntId(item.PYM_ACNT_ID)}</span>
                      <span className="text-xs text-gray-500">{item.PYM_MTHD_NM || '-'}</span>
                    </div>
                    <div className="text-sm text-gray-700">{item.BANK_CARD_NM || '-'} {item.BANK_CARD_NO || ''}</div>
                  </div>
                ))}
              </div>

              {/* 납부정보 폼 */}
              <div className="border border-gray-200 rounded-lg p-3 space-y-2">
                {/* 납부방법 */}
                <div className="flex items-center">
                  <label className="w-20 flex-shrink-0 text-xs text-gray-500">납부방법</label>
                  <select
                    value={paymentForm.pymMthCd}
                    onChange={(e) => {
                      setPaymentForm(prev => ({ ...prev, pymMthCd: e.target.value, bankCd: '', acntNo: '' }));
                      setIsVerified(false);
                    }}
                    className="flex-1 px-2 py-1.5 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-orange-500"
                  >
                    <option value="01">자동이체(신)</option>
                    <option value="02">신용카드</option>
                  </select>
                </div>

                {/* 변경사유 */}
                <div className="flex items-center">
                  <label className="w-20 flex-shrink-0 text-xs text-gray-500">변경사유</label>
                  <div className="flex-1 flex gap-1">
                    <select
                      value={paymentForm.changeReasonL}
                      onChange={(e) => setPaymentForm(prev => ({ ...prev, changeReasonL: e.target.value, changeReasonM: '' }))}
                      className="flex-1 px-2 py-1.5 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-orange-500"
                    >
                      <option value="">대분류</option>
                      {changeReasonLargeCodes.map(code => (
                        <option key={code.CODE} value={code.CODE}>{code.CODE_NM}</option>
                      ))}
                    </select>
                    <select
                      value={paymentForm.changeReasonM}
                      onChange={(e) => setPaymentForm(prev => ({ ...prev, changeReasonM: e.target.value }))}
                      disabled={!paymentForm.changeReasonL}
                      className="flex-1 px-2 py-1.5 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-orange-500 disabled:bg-gray-100"
                    >
                      <option value="">중분류</option>
                      {(changeReasonMiddleCodes[paymentForm.changeReasonL] || []).map(code => (
                        <option key={code.CODE} value={code.CODE}>{code.CODE_NM}</option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* 예금주명/카드소유주 */}
                <div className="flex items-center">
                  <label className="w-20 flex-shrink-0 text-xs text-gray-500">
                    {paymentForm.pymMthCd === '01' ? '예금주명' : '카드소유주'}
                  </label>
                  <input
                    type="text"
                    value={paymentForm.acntHolderNm}
                    onChange={(e) => {
                      setPaymentForm(prev => ({ ...prev, acntHolderNm: e.target.value }));
                      setIsVerified(false);
                    }}
                    placeholder="이름 입력"
                    className="flex-1 px-2 py-1.5 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-orange-500"
                  />
                </div>

                {/* 신분유형 */}
                <div className="flex items-center">
                  <label className="w-20 flex-shrink-0 text-xs text-gray-500">신분유형</label>
                  <select
                    value={paymentForm.idType}
                    onChange={(e) => setPaymentForm(prev => ({ ...prev, idType: e.target.value }))}
                    className="flex-1 px-2 py-1.5 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-orange-500"
                  >
                    {idTypeCodes.map(code => (
                      <option key={code.CODE} value={code.CODE}>{code.CODE_NM}</option>
                    ))}
                  </select>
                </div>

                {/* 생년월일 */}
                <div className="flex items-center">
                  <label className="w-20 flex-shrink-0 text-xs text-gray-500">생년월일</label>
                  <input
                    type="text"
                    value={paymentForm.birthDt}
                    onChange={(e) => setPaymentForm(prev => ({ ...prev, birthDt: e.target.value.replace(/[^0-9]/g, '').slice(0, 8) }))}
                    placeholder="YYYYMMDD"
                    maxLength={8}
                    className="flex-1 px-2 py-1.5 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-orange-500"
                  />
                </div>

                {/* 은행명/카드사명 */}
                <div className="flex items-center">
                  <label className="w-20 flex-shrink-0 text-xs text-gray-500">
                    {paymentForm.pymMthCd === '01' ? '은행명' : '카드사명'}
                  </label>
                  <select
                    value={paymentForm.bankCd}
                    onChange={(e) => {
                      setPaymentForm(prev => ({ ...prev, bankCd: e.target.value }));
                      setIsVerified(false);
                    }}
                    className="flex-1 px-2 py-1.5 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-orange-500"
                  >
                    <option value="">선택</option>
                    {(paymentForm.pymMthCd === '01' ? bankCodes : cardCompanyCodes).map(code => (
                      <option key={code.CODE} value={code.CODE}>{code.CODE_NM}</option>
                    ))}
                  </select>
                </div>

                {/* 계좌번호/카드번호 + 인증 */}
                <div className="flex items-center">
                  <label className="w-20 flex-shrink-0 text-xs text-gray-500">
                    {paymentForm.pymMthCd === '01' ? '계좌번호' : '카드번호'}
                  </label>
                  <div className="flex-1 flex gap-2">
                    <input
                      type="text"
                      value={paymentForm.acntNo}
                      onChange={(e) => {
                        setPaymentForm(prev => ({ ...prev, acntNo: e.target.value.replace(/[^0-9]/g, '') }));
                        setIsVerified(false);
                      }}
                      placeholder={paymentForm.pymMthCd === '01' ? '계좌번호 (- 제외)' : '카드번호 (- 제외)'}
                      className="flex-1 min-w-0 px-2 py-1.5 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-orange-500"
                    />
                    <button
                      onClick={handleVerify}
                      disabled={isVerifying || isVerified}
                      className={`flex-shrink-0 px-3 py-1.5 text-sm rounded font-medium transition-colors whitespace-nowrap ${
                        isVerified
                          ? 'bg-green-100 text-green-700 border border-green-300'
                          : 'bg-blue-500 text-white hover:bg-blue-600'
                      }`}
                    >
                      {isVerifying ? '인증중' : isVerified ? '완료' : '인증'}
                    </button>
                  </div>
                </div>

                {/* 카드 전용 필드: 유효기간 + 제휴카드 */}
                {paymentForm.pymMthCd === '02' && (
                  <>
                    <div className="flex items-center">
                      <label className="w-20 flex-shrink-0 text-xs text-gray-500">유효기간</label>
                      <div className="flex items-center gap-1">
                        <input
                          type="text"
                          value={paymentForm.cardExpMm}
                          onChange={(e) => {
                            setPaymentForm(prev => ({ ...prev, cardExpMm: e.target.value.replace(/[^0-9]/g, '').slice(0, 2) }));
                            setIsVerified(false);
                          }}
                          placeholder="MM"
                          maxLength={2}
                          className="w-14 px-2 py-1.5 text-sm border border-gray-300 rounded text-center focus:ring-1 focus:ring-orange-500"
                        />
                        <span className="text-gray-400">/</span>
                        <input
                          type="text"
                          value={paymentForm.cardExpYy}
                          onChange={(e) => {
                            setPaymentForm(prev => ({ ...prev, cardExpYy: e.target.value.replace(/[^0-9]/g, '').slice(0, 2) }));
                            setIsVerified(false);
                          }}
                          placeholder="YY"
                          maxLength={2}
                          className="w-14 px-2 py-1.5 text-sm border border-gray-300 rounded text-center focus:ring-1 focus:ring-orange-500"
                        />
                      </div>
                    </div>

                    <div className="flex items-center">
                      <label className="w-20 flex-shrink-0 text-xs text-gray-500">제휴카드</label>
                      <select
                        value={paymentForm.joinCardYn}
                        onChange={(e) => setPaymentForm(prev => ({ ...prev, joinCardYn: e.target.value }))}
                        className="flex-1 px-2 py-1.5 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-orange-500"
                      >
                        <option value="N">아니오</option>
                        <option value="Y">예</option>
                      </select>
                    </div>
                  </>
                )}

                {/* 납부자관계 */}
                <div className="flex items-center">
                  <label className="w-20 flex-shrink-0 text-xs text-gray-500">납부자관계</label>
                  <select
                    value={paymentForm.pyrRel}
                    onChange={(e) => setPaymentForm(prev => ({ ...prev, pyrRel: e.target.value }))}
                    className="flex-1 px-2 py-1.5 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-orange-500"
                  >
                    {pyrRelCodes.map(code => (
                      <option key={code.CODE} value={code.CODE}>{code.CODE_NM}</option>
                    ))}
                  </select>
                </div>

                {/* 결제일 */}
                <div className="flex items-center">
                  <label className="w-20 flex-shrink-0 text-xs text-gray-500">결제일</label>
                  <select
                    value={paymentForm.pymDay}
                    onChange={(e) => setPaymentForm(prev => ({ ...prev, pymDay: e.target.value }))}
                    className="flex-1 px-2 py-1.5 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-orange-500"
                  >
                    <option value="">선택</option>
                    {paymentDays.map(day => (
                      <option key={day.CODE} value={day.CODE}>{day.CODE_NM}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* 안내 메시지 */}
              <div className="p-3 bg-orange-50 border border-orange-200 rounded-lg">
                <div className="flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 text-orange-600 mt-0.5" />
                  <div className="text-sm text-orange-700">
                    <p>납부방법 변경 시 다음 청구월부터 적용됩니다.</p>
                    <p className="text-xs mt-1">계좌/카드 인증 후 변경이 가능합니다.</p>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>

        {/* 푸터 - 버튼 */}
        {paymentAccounts.length > 0 && (
          <div className="p-4 border-t border-gray-200 bg-gray-50 rounded-b-xl">
            <div className="flex gap-2">
              <button
                onClick={handleSave}
                disabled={isSaving || !isVerified}
                className="flex-1 py-2.5 bg-orange-500 text-white rounded-lg hover:bg-orange-600 disabled:bg-gray-400 transition-colors text-sm font-medium flex items-center justify-center gap-2"
              >
                {isSaving ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    저장 중...
                  </>
                ) : (
                  '저장'
                )}
              </button>
              <button
                onClick={onClose}
                disabled={isSaving}
                className="flex-1 py-2.5 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors text-sm font-medium"
              >
                닫기
              </button>
            </div>
          </div>
        )}
      </div>

      {/* 서명 모달 */}
      {showSignatureModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] p-4">
          <div className="w-full max-w-md">
            <SignaturePad
              title="납부방법 변경 서명"
              onSave={handleSignatureComplete}
              onCancel={() => setShowSignatureModal(false)}
            />
          </div>
        </div>
      )}

      {/* 알림 팝업 */}
      {alertPopup.show && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[70]">
          <div className="bg-white rounded-lg p-5 max-w-sm mx-4 shadow-xl">
            <div className="flex items-center gap-3 mb-4">
              <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                alertPopup.type === 'success' ? 'bg-green-100' :
                alertPopup.type === 'error' ? 'bg-red-100' :
                alertPopup.type === 'warning' ? 'bg-orange-100' : 'bg-blue-100'
              }`}>
                {alertPopup.type === 'success' ? (
                  <Check className="w-5 h-5 text-green-500" />
                ) : (
                  <AlertCircle className={`w-5 h-5 ${
                    alertPopup.type === 'error' ? 'text-red-500' :
                    alertPopup.type === 'warning' ? 'text-orange-500' : 'text-blue-500'
                  }`} />
                )}
              </div>
              <h3 className="text-base font-medium text-gray-900">{alertPopup.title}</h3>
            </div>
            <p className="text-sm text-gray-600 mb-5 whitespace-pre-line">
              {alertPopup.message}
            </p>
            <button
              onClick={() => setAlertPopup({ show: false, title: '', message: '', type: 'info' })}
              className={`w-full px-4 py-2 text-sm text-white rounded-lg transition-colors ${
                alertPopup.type === 'success' ? 'bg-green-500 hover:bg-green-600' :
                alertPopup.type === 'error' ? 'bg-red-500 hover:bg-red-600' :
                alertPopup.type === 'warning' ? 'bg-orange-500 hover:bg-orange-600' : 'bg-blue-500 hover:bg-blue-600'
              }`}
            >
              확인
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default PaymentChangeModal;
