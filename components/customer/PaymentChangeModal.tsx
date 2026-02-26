import React, { useState, useEffect } from 'react';
import { X, Loader2, AlertCircle, CreditCard, Check, PenTool, FileDown } from 'lucide-react';
import SignaturePad from '../common/SignaturePad';
import {
  getPaymentAccounts,
  PaymentAccountInfo,
  updatePaymentMethod,
  verifyBankAccount,
  verifyCard,
  savePaymentSignature
} from '../../services/customerApi';
import { generateAutoTransferPdf, downloadPdf } from '../../services/pdfService';

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
  custTpCd?: string;  // 고객유형코드 (A/C/E 등) - 계좌 실명인증용
  soId?: string;
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
  custTpCd,
  soId,
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
  const [verifyProgress, setVerifyProgress] = useState<string>(''); // 로딩 팝업 메시지
  const [isSaving, setIsSaving] = useState(false);

  // 서명
  const [showSignatureModal, setShowSignatureModal] = useState(false);
  const [signatureData, setSignatureData] = useState<string>('');  // base64 서명 이미지

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
      setSignatureData('');
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

  // 계좌/카드 인증 (로딩 팝업 + 재시도 로직)
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
    if (paymentForm.pymMthCd === '02' && (!paymentForm.cardExpMm || !paymentForm.cardExpYy)) {
      showAlert('카드 유효기간을 입력해주세요.', 'warning');
      return;
    }

    setIsVerifying(true);
    setVerifyProgress('인증 요청 중...');

    const doVerify = async (): Promise<{ success: boolean; message: string }> => {
      if (paymentForm.pymMthCd === '01') {
        // 자동이체 계좌 실명인증 (3-step .req flow)
        const response = await verifyBankAccount({
          BANK_CD: paymentForm.bankCd,
          ACNT_NO: paymentForm.acntNo,
          ACNT_OWNER_NM: paymentForm.acntHolderNm,
          BIRTH_DT: paymentForm.birthDt,
          SO_ID: soId || '',
          CUST_TP: custTpCd || 'A',
          ID_TYPE_CD: paymentForm.idType,
          CUST_ID: custId,
          PYM_ACNT_ID: selectedPymAcntId || initialPymAcntId || ''
        });
        return { success: response.success, message: response.message || '' };
      } else {
        const response = await verifyCard({
          CARD_NO: paymentForm.acntNo,
          CARD_EXPYEAR: paymentForm.cardExpYy,
          CARD_EXPMON: paymentForm.cardExpMm,
          CARD_OWNER_NM: paymentForm.acntHolderNm,
          KOR_ID: paymentForm.birthDt,
          SO_ID: soId || '',
          PYM_ACNT_ID: initialPymAcntId || '',
          CUST_ID: custId,
          CUST_NM: custNm || ''
        });
        return { success: response.success, message: response.message || '' };
      }
    };

    try {
      // 1차 시도
      setVerifyProgress('인증 처리 중...');
      const result1 = await doVerify();

      if (result1.success) {
        setIsVerified(true);
        setVerifyProgress('');
        showAlert(paymentForm.pymMthCd === '01' ? '계좌 인증이 완료되었습니다.' : '카드 인증이 완료되었습니다.', 'success');
      } else {
        // 1차 실패 → 5초 대기 후 재시도
        setVerifyProgress('재시도 중... 잠시만 기다려주세요.');
        await new Promise(r => setTimeout(r, 5000));

        const result2 = await doVerify();
        if (result2.success) {
          setIsVerified(true);
          setVerifyProgress('');
          showAlert(paymentForm.pymMthCd === '01' ? '계좌 인증이 완료되었습니다.' : '카드 인증이 완료되었습니다.', 'success');
        } else {
          setVerifyProgress('');
          showAlert('인증에 실패했습니다.\n잠시 후 다시 시도해주세요.\n\n' + (result2.message || ''), 'error');
        }
      }
    } catch (error) {
      console.error('Verify error:', error);
      setVerifyProgress('');
      showAlert('인증 중 오류가 발생했습니다.\n잠시 후 다시 시도해주세요.', 'error');
    } finally {
      setIsVerifying(false);
      setVerifyProgress('');
    }
  };

  // 서명 버튼 클릭 → 서명 모달 표시 (자동이체만)
  const handleOpenSignature = () => {
    if (!selectedPymAcntId) {
      showAlert('납부계정을 선택해주세요.', 'warning');
      return;
    }
    if (!isVerified) {
      showAlert('계좌 인증을 먼저 완료해주세요.', 'warning');
      return;
    }
    if (!paymentForm.changeReasonL || !paymentForm.changeReasonM) {
      showAlert('변경사유를 선택해주세요.', 'warning');
      return;
    }
    setShowSignatureModal(true);
  };

  // 서명 완료 → 서명 이미지 저장 (저장 버튼 활성화)
  const handleSignatureComplete = (signature: string) => {
    setShowSignatureModal(false);
    setSignatureData(signature);
  };

  // 서명 다시하기
  const handleResetSignature = () => {
    setSignatureData('');
  };

  // 코드 → 이름 변환 헬퍼
  const getCodeName = (codes: { CODE: string; CODE_NM: string }[], code: string): string => {
    return codes.find(c => c.CODE === code)?.CODE_NM || code;
  };

  // 변경사유 텍스트
  const getChangeReasonText = (): string => {
    const large = getCodeName(changeReasonLargeCodes, paymentForm.changeReasonL);
    const middleCodes = changeReasonMiddleCodes[paymentForm.changeReasonL] || [];
    const middle = getCodeName(middleCodes, paymentForm.changeReasonM);
    return `${large} > ${middle}`;
  };

  // 자동이체 PDF 생성 및 다운로드
  const handleDownloadPdf = async () => {
    try {
      const blob = await generateAutoTransferPdf({
        custId,
        custNm: custNm || '',
        pymAcntId: selectedPymAcntId,
        pymMthNm: '자동이체(신)',
        changeReasonNm: getChangeReasonText(),
        acntHolderNm: paymentForm.acntHolderNm,
        idTypeNm: getCodeName(idTypeCodes, paymentForm.idType),
        birthDt: paymentForm.birthDt,
        bankNm: getCodeName(bankCodes, paymentForm.bankCd),
        acntNo: paymentForm.acntNo,
        pyrRelNm: getCodeName(pyrRelCodes, paymentForm.pyrRel),
        signatureData,
      });

      const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
      const filename = `자동이체_변경신청_${custId}_${dateStr}.pdf`;
      downloadPdf(blob, filename);
      showToast?.('PDF 다운로드 완료', 'success');
    } catch (error) {
      console.error('PDF generation error:', error);
      showAlert('PDF 생성에 실패했습니다.', 'error');
    }
  };

  // 저장 (자동이체: 서명 필수 / 카드: 서명 불필요)
  const handleSave = async () => {
    if (paymentForm.pymMthCd === '01' && !signatureData) {
      showAlert('서명을 먼저 완료해주세요.', 'warning');
      return;
    }

    setIsSaving(true);
    try {
      // 1. 납부방법 변경 API 호출
      const response = await updatePaymentMethod({
        CUST_ID: custId,
        PYM_ACNT_ID: selectedPymAcntId,
        PYM_MTH_CD: paymentForm.pymMthCd,
        BANK_CD: paymentForm.bankCd,
        ACNT_NO: paymentForm.acntNo,
        ACNT_OWNER_NM: paymentForm.acntHolderNm,
        ID_TYPE_CD: paymentForm.idType,
        BIRTH_DT: paymentForm.birthDt,
        PAYER_REL_CD: paymentForm.pyrRel,
        PAY_DAY_CD: paymentForm.pymDay,
        CARD_VALID_YM: paymentForm.pymMthCd === '02' ? paymentForm.cardExpYy + paymentForm.cardExpMm : undefined,
        JOIN_CARD_YN: paymentForm.pymMthCd === '02' ? paymentForm.joinCardYn : undefined,
        CHG_RESN_L_CD: paymentForm.changeReasonL,
        CHG_RESN_M_CD: paymentForm.changeReasonM,
      });

      if (response.success) {
        // 2. 서명 이미지 저장 (stub - 추후 API 연결)
        try {
          await savePaymentSignature({
            CUST_ID: custId,
            PYM_ACNT_ID: selectedPymAcntId,
            SIGN_TYPE: 'PYM_CHG',
            SIGNATURE_DATA: signatureData,
          });
        } catch (signErr) {
          console.log('[PaymentChange] Signature save stub (API not connected yet):', signErr);
        }

        // 3. 자동이체인 경우 PDF 자동 다운로드
        if (paymentForm.pymMthCd === '01' && signatureData) {
          try {
            await handleDownloadPdf();
          } catch (pdfErr) {
            console.warn('[PaymentChange] PDF auto-download failed:', pdfErr);
          }
        }

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

  // 선택된 납부계정 정보
  const selectedPayment = paymentAccounts.find(p => p.PYM_ACNT_ID === selectedPymAcntId);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      {/* 인증 로딩 오버레이 */}
      {isVerifying && verifyProgress && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-2xl shadow-2xl w-[85vw] max-w-[280px] p-6 flex flex-col items-center">
            <Loader2 className="w-10 h-10 text-blue-500 animate-spin mb-4" />
            <p className="text-sm text-gray-700 text-center font-medium">{verifyProgress}</p>
          </div>
        </div>
      )}

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
          ) : !selectedPayment ? (
            <div className="text-center py-8 text-gray-500">
              <CreditCard className="w-12 h-12 text-gray-300 mx-auto mb-2" />
              <p>납부계정 정보가 없습니다.</p>
            </div>
          ) : (
            <>
              {/* 선택된 납부계정 정보 (단일 표시) */}
              <div className="p-3 rounded-lg bg-orange-50 border border-orange-300">
                <div className="flex items-center justify-between mb-1">
                  <span className="font-mono text-sm text-blue-600">{formatPymAcntId(selectedPayment.PYM_ACNT_ID)}</span>
                  <span className="text-xs text-gray-500">{selectedPayment.PYM_MTHD_NM || '-'}</span>
                </div>
                <div className="text-sm text-gray-700">{selectedPayment.BANK_CARD_NM || '-'} {selectedPayment.BANK_CARD_NO || ''}</div>
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

              </div>

              {/* 서명 영역 - 자동이체만 */}
              {paymentForm.pymMthCd === '01' && (
                <div className="border border-gray-200 rounded-lg p-3">
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-xs font-medium text-gray-700">고객 서명</label>
                    <div className="flex items-center gap-2">
                      {signatureData && (
                        <>
                          <button
                            onClick={handleDownloadPdf}
                            className="text-xs text-blue-500 hover:text-blue-600 flex items-center gap-0.5"
                          >
                            <FileDown className="w-3 h-3" />
                            PDF
                          </button>
                          <button
                            onClick={handleResetSignature}
                            className="text-xs text-red-500 hover:text-red-600"
                          >
                            다시 서명
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                  {signatureData ? (
                    <div className="border border-green-300 rounded-lg bg-green-50 p-2 flex flex-col items-center">
                      <img
                        src={signatureData}
                        alt="서명"
                        className="max-h-24 rounded border border-gray-200 bg-white"
                      />
                      <div className="flex items-center gap-1 mt-1.5">
                        <Check className="w-3.5 h-3.5 text-green-600" />
                        <span className="text-xs text-green-600 font-medium">서명 완료</span>
                      </div>
                    </div>
                  ) : (
                    <button
                      onClick={handleOpenSignature}
                      disabled={!isVerified}
                      className={`w-full py-4 border-2 border-dashed rounded-lg flex flex-col items-center gap-1.5 transition-colors ${
                        isVerified
                          ? 'border-blue-300 bg-blue-50 hover:bg-blue-100 text-blue-600 cursor-pointer'
                          : 'border-gray-200 bg-gray-50 text-gray-400 cursor-not-allowed'
                      }`}
                    >
                      <PenTool className="w-5 h-5" />
                      <span className="text-sm font-medium">
                        {isVerified ? '여기를 눌러 서명하세요' : '인증 완료 후 서명 가능'}
                      </span>
                    </button>
                  )}
                </div>
              )}

              {/* 안내 메시지 */}
              <div className="p-3 bg-orange-50 border border-orange-200 rounded-lg">
                <div className="flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 text-orange-600 mt-0.5" />
                  <div className="text-sm text-orange-700">
                    <p>납부방법 변경 시 다음 청구월부터 적용됩니다.</p>
                    <p className="text-xs mt-1">인증 → 서명 → 저장 순서로 진행해주세요.</p>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>

        {/* 푸터 - 버튼 */}
        {selectedPayment && (
          <div className="p-4 border-t border-gray-200 bg-gray-50 rounded-b-xl">
            <div className="flex gap-2">
              <button
                onClick={handleSave}
                disabled={isSaving || !isVerified || (paymentForm.pymMthCd === '01' && !signatureData)}
                className={`flex-1 py-2.5 rounded-lg transition-colors text-sm font-medium flex items-center justify-center gap-2 ${
                  isVerified && (paymentForm.pymMthCd === '02' || signatureData)
                    ? 'bg-orange-500 text-white hover:bg-orange-600'
                    : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                }`}
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
