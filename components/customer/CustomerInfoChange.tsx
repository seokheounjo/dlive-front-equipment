import React, { useState, useEffect } from 'react';
import {
  Phone, MapPin, Edit2, Save, X, Loader2,
  ChevronDown, ChevronUp, AlertCircle, Check, Search,
  Smartphone, RefreshCw, CreditCard, Building2, Shield
} from 'lucide-react';
import {
  updatePhoneNumber,
  updateAddress,
  getTelecomCodes,
  getHPPayList,
  formatPhoneNumber,
  PhoneChangeRequest,
  AddressChangeRequest,
  HPPayInfo,
  getPaymentInfo,
  updatePaymentMethod,
  verifyBankAccount,
  verifyCard,
  PaymentInfo,
  searchPostAddress,
  searchStreetAddress,
  PostAddressInfo,
  StreetAddressInfo
} from '../../services/customerApi';

// 납부폼 타입 정의
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
  billZipCd: string;
  billAddr: string;
  billAddrJibun: string;
  billAddrDtl: string;
  billAddrDtl2: string;
  billPostId: string;
}

interface CustomerInfoChangeProps {
  onBack: () => void;
  showToast?: (message: string, type: 'success' | 'error' | 'warning' | 'info') => void;
  selectedCustomer: {
    custId: string;
    custNm: string;
    telNo: string;
  } | null;
  initialSection?: 'phone' | 'address' | 'payment' | 'hpPay';  // 초기 펼칠 섹션
  initialPymAcntId?: string;  // 초기 선택할 납부계정 ID
  onPaymentChangeStart?: () => void;  // 납부방법 변경 시작 알림
  onPaymentChangeEnd?: () => void;    // 납부방법 변경 종료 알림
  // 폼 상태 유지를 위한 props
  savedPaymentForm?: PaymentFormData | null;
  savedPymAcntId?: string;
  savedIsVerified?: boolean;
  onPaymentFormChange?: (form: PaymentFormData, pymAcntId: string, isVerified: boolean) => void;
}

interface TelecomCode {
  CODE: string;
  CODE_NM: string;
}

/**
 * 정보변경 화면
 *
 * 회의록 기준:
 * - 전화번호 변경
 * - 설치주소 변경
 * - 고객주소 변경
 * - 청구지주소 변경
 * - 휴대폰결제(선결제) 현황 변경
 */
const CustomerInfoChange: React.FC<CustomerInfoChangeProps> = ({
  onBack,
  showToast,
  selectedCustomer,
  initialSection = 'phone',
  initialPymAcntId = '',
  onPaymentChangeStart,
  onPaymentChangeEnd,
  savedPaymentForm,
  savedPymAcntId = '',
  savedIsVerified = false,
  onPaymentFormChange
}) => {
  // 섹션 펼침 상태 (initialSection prop에 따라 초기값 설정)
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    phone: initialSection === 'phone',
    address: initialSection === 'address',
    payment: initialSection === 'payment',
    hpPay: initialSection === 'hpPay'
  });

  // 전화번호 변경 폼
  const [phoneForm, setPhoneForm] = useState({
    telNo: '',
    telTpCd: '',  // 통신사
    disconnYn: 'N'  // 결번여부
  });
  const [telecomCodes, setTelecomCodes] = useState<TelecomCode[]>([]);

  // 주소 변경 폼
  const [addressForm, setAddressForm] = useState({
    zipCd: '',
    addr1: '',
    addr2: '',
    changeInstAddr: false,  // 설치주소 (CTRT_ID 필요)
    changeCustAddr: true,   // 고객주소 (기본 선택)
    changeBillAddr: false,  // 청구지주소
    // 주소 검색 결과에서 가져오는 추가 정보
    postId: '',             // 주소ID (POST_ID)
    streetId: '',           // 도로명ID (STREET_ID)
    dongmyonNm: ''          // 읍면동명 (DONGMYON_NM)
  });

  // 로딩/저장 상태
  const [isLoadingCodes, setIsLoadingCodes] = useState(false);
  const [isSavingPhone, setIsSavingPhone] = useState(false);
  const [isSavingAddress, setIsSavingAddress] = useState(false);

  // 휴대폰결제(선결제) 현황
  const [hpPayList, setHpPayList] = useState<HPPayInfo[]>([]);
  const [isLoadingHpPay, setIsLoadingHpPay] = useState(false);
  const [hpPayLoaded, setHpPayLoaded] = useState(false);

  // 납부방법 변경
  const [paymentInfoList, setPaymentInfoList] = useState<PaymentInfo[]>([]);
  const [selectedPymAcntId, setSelectedPymAcntId] = useState<string>(savedPymAcntId);
  const [isLoadingPayment, setIsLoadingPayment] = useState(false);
  const [paymentLoaded, setPaymentLoaded] = useState(false);
  // 기본 납부폼 초기값
  const defaultPaymentForm: PaymentFormData = {
    pymMthCd: '01',           // 01: 자동이체, 02: 카드
    changeReasonL: '',        // 변경사유 대분류
    changeReasonM: '',        // 변경사유 중분류
    acntHolderNm: '',         // 예금주명/카드소유주명
    idType: '01',             // 신분유형 (01: 주민등록번호, 02: 사업자등록번호, 03: 외국인등록번호)
    birthDt: '',              // 생년월일 (YYYYMMDD)
    bankCd: '',               // 은행코드/카드사코드
    acntNo: '',               // 계좌번호/카드번호
    cardExpMm: '',            // 카드 유효기간 월
    cardExpYy: '',            // 카드 유효기간 년
    joinCardYn: 'N',          // 제휴카드 여부
    pyrRel: '01',             // 납부자관계 (01: 본인, 02: 가족, 03: 기타)
    pymDay: '',               // 결제일
    // 청구주소정보
    billZipCd: '',            // 청구지 우편번호
    billAddr: '',             // 청구지 도로명주소
    billAddrJibun: '',        // 청구지 지번주소
    billAddrDtl: '',          // 청구지 상세주소 (동)
    billAddrDtl2: '',         // 청구지 상세주소 (호)
    billPostId: ''            // 청구지 주소ID
  };

  // 저장된 값이 있으면 사용, 없으면 기본값
  const [paymentForm, setPaymentForm] = useState<PaymentFormData>(savedPaymentForm || defaultPaymentForm);
  const [isVerifying, setIsVerifying] = useState(false);
  const [isVerified, setIsVerified] = useState(savedIsVerified);
  const [isSavingPayment, setIsSavingPayment] = useState(false);

  // 청구주소 검색 모달
  const [showBillAddressModal, setShowBillAddressModal] = useState(false);
  const [billAddressSearchQuery, setBillAddressSearchQuery] = useState('');
  const [billAddressResults, setBillAddressResults] = useState<PostAddressInfo[]>([]);
  const [billStreetResults, setBillStreetResults] = useState<StreetAddressInfo[]>([]);
  const [isSearchingBillAddress, setIsSearchingBillAddress] = useState(false);
  const [billAddressSearchType, setBillAddressSearchType] = useState<'post' | 'street'>('post');
  const [billStreetSearchForm, setBillStreetSearchForm] = useState({
    streetNm: '',
    streetBunM: '',
    streetBunS: '',
    buildNm: ''
  });

  // 주소 검색 모달
  const [showAddressModal, setShowAddressModal] = useState(false);
  const [addressSearchType, setAddressSearchType] = useState<'post' | 'street'>('post');
  const [addressSearchQuery, setAddressSearchQuery] = useState('');
  const [streetSearchForm, setStreetSearchForm] = useState({
    streetNm: '',      // 도로명
    streetBunM: '',    // 건물본번
    streetBunS: '',    // 건물부번
    buildNm: ''        // 건물명
  });
  const [postAddressResults, setPostAddressResults] = useState<PostAddressInfo[]>([]);
  const [streetAddressResults, setStreetAddressResults] = useState<StreetAddressInfo[]>([]);
  const [isSearchingAddress, setIsSearchingAddress] = useState(false);
  const [selectedPostId, setSelectedPostId] = useState<string>('');

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

  // 통신사 코드 로드
  useEffect(() => {
    loadTelecomCodes();
  }, []);

  // 납부폼 상태 변경 시 부모 컴포넌트에 동기화 (탭 전환 시 상태 유지)
  useEffect(() => {
    if (onPaymentFormChange) {
      onPaymentFormChange(paymentForm, selectedPymAcntId, isVerified);
    }
  }, [paymentForm, selectedPymAcntId, isVerified]);

  const loadTelecomCodes = async () => {
    setIsLoadingCodes(true);
    try {
      const response = await getTelecomCodes();
      if (response.success && response.data) {
        setTelecomCodes(response.data);
      }
    } catch (error) {
      console.error('Load telecom codes error:', error);
    } finally {
      setIsLoadingCodes(false);
    }
  };

  // 휴대폰결제(선결제) 목록 로드
  const loadHpPayList = async () => {
    if (!selectedCustomer) return;

    setIsLoadingHpPay(true);
    try {
      const response = await getHPPayList(selectedCustomer.custId);
      if (response.success && response.data) {
        setHpPayList(response.data);
      } else {
        setHpPayList([]);
      }
      setHpPayLoaded(true);
    } catch (error) {
      console.error('Load HP pay list error:', error);
      setHpPayList([]);
    } finally {
      setIsLoadingHpPay(false);
    }
  };

  // 납부정보 로드
  const loadPaymentInfo = async () => {
    if (!selectedCustomer) return;

    setIsLoadingPayment(true);
    try {
      const response = await getPaymentInfo(selectedCustomer.custId);
      if (response.success && response.data) {
        setPaymentInfoList(response.data);
        // initialPymAcntId가 있으면 해당 계정 선택, 없으면 첫 번째 계정 선택
        if (response.data.length > 0) {
          const targetId = initialPymAcntId && response.data.find(p => p.PYM_ACNT_ID === initialPymAcntId)
            ? initialPymAcntId
            : response.data[0].PYM_ACNT_ID;
          setSelectedPymAcntId(targetId);
        }
      } else {
        setPaymentInfoList([]);
      }
      setPaymentLoaded(true);
    } catch (error) {
      console.error('Load payment info error:', error);
      setPaymentInfoList([]);
    } finally {
      setIsLoadingPayment(false);
    }
  };

  // 초기 섹션이 payment일 때 자동으로 납부정보 로드
  useEffect(() => {
    if (initialSection === 'payment' && selectedCustomer && !paymentLoaded) {
      loadPaymentInfo();
    }
  }, [initialSection, selectedCustomer]);

  // 계좌/카드 인증
  const handleVerify = async () => {
    if (!paymentForm.acntHolderNm) {
      showToast?.('예금주/카드소유주 명을 입력해주세요.', 'warning');
      return;
    }
    if (!paymentForm.bankCd) {
      showToast?.('은행/카드사를 선택해주세요.', 'warning');
      return;
    }
    if (!paymentForm.acntNo) {
      showToast?.('계좌번호/카드번호를 입력해주세요.', 'warning');
      return;
    }

    setIsVerifying(true);
    try {
      if (paymentForm.pymMthCd === '01') {
        // 은행 계좌 인증
        const response = await verifyBankAccount({
          BANK_CD: paymentForm.bankCd,
          ACNT_NO: paymentForm.acntNo,
          ACNT_OWNER_NM: paymentForm.acntHolderNm
        });
        if (response.success) {
          setIsVerified(true);
          showToast?.('계좌 인증이 완료되었습니다.', 'success');
        } else {
          showToast?.(response.message || '계좌 인증에 실패했습니다.', 'error');
        }
      } else {
        // 카드 인증
        if (!paymentForm.cardExpMm || !paymentForm.cardExpYy) {
          showToast?.('카드 유효기간을 입력해주세요.', 'warning');
          setIsVerifying(false);
          return;
        }
        // 유효기간: YYMM 형식
        const cardValidYm = paymentForm.cardExpYy + paymentForm.cardExpMm;
        const response = await verifyCard({
          CARD_NO: paymentForm.acntNo,
          CARD_VALID_YM: cardValidYm,
          CARD_OWNER_NM: paymentForm.acntHolderNm
        });
        if (response.success) {
          setIsVerified(true);
          showToast?.('카드 인증이 완료되었습니다.', 'success');
        } else {
          showToast?.(response.message || '카드 인증에 실패했습니다.', 'error');
        }
      }
    } catch (error) {
      console.error('Verify error:', error);
      showToast?.('인증 중 오류가 발생했습니다.', 'error');
    } finally {
      setIsVerifying(false);
    }
  };

  // 납부방법 변경 저장
  const handleSavePayment = async () => {
    if (!selectedPymAcntId) {
      showToast?.('납부계정을 선택해주세요.', 'warning');
      return;
    }
    if (!isVerified) {
      showToast?.('먼저 계좌/카드 인증을 완료해주세요.', 'warning');
      return;
    }
    if (!paymentForm.changeReasonL || !paymentForm.changeReasonM) {
      showToast?.('변경사유를 선택해주세요.', 'warning');
      return;
    }
    if (!paymentForm.birthDt || paymentForm.birthDt.length !== 8) {
      showToast?.('생년월일을 정확히 입력해주세요.', 'warning');
      return;
    }
    if (!paymentForm.pyrRel) {
      showToast?.('납부자관계를 선택해주세요.', 'warning');
      return;
    }

    setIsSavingPayment(true);
    try {
      // 모든 필드 포함
      const params: any = {
        PYM_ACNT_ID: selectedPymAcntId,
        CUST_ID: selectedCustomer!.custId,
        ACNT_NM: paymentForm.acntHolderNm,
        PYM_MTHD: paymentForm.pymMthCd === '01' ? '02' : '04',  // 02: 자동이체, 04: 신용카드
        BANK_CARD: paymentForm.bankCd,
        ACNT_CARD_NO: paymentForm.acntNo,
        // 변경사유
        CHG_RESN_L: paymentForm.changeReasonL,
        CHG_RESN_M: paymentForm.changeReasonM,
        // 신분유형 및 생년월일
        ID_TP: paymentForm.idType,
        BIRTH_DT: paymentForm.birthDt,
        // 납부자관계
        PYR_REL: paymentForm.pyrRel,
        // 결제일
        PYM_DAY: paymentForm.pymDay
      };

      // 카드인 경우 유효기간 추가
      if (paymentForm.pymMthCd === '02' && paymentForm.cardExpYy && paymentForm.cardExpMm) {
        params.CDTCD_EXP_DT = paymentForm.cardExpYy + paymentForm.cardExpMm;  // YYMM 형식
        params.REQR_NM = paymentForm.acntHolderNm;  // 카드소유주명
        params.JOIN_CARD_YN = paymentForm.joinCardYn;  // 제휴카드 여부
      }

      // 자동이체인 경우 예금주 정보 추가
      if (paymentForm.pymMthCd === '01') {
        params.PYM_CUST_NM = paymentForm.acntHolderNm;  // 예금주명
      }

      // 청구주소 정보 (입력된 경우만)
      if (paymentForm.billPostId) {
        params.BILL_POST_ID = paymentForm.billPostId;
        params.BILL_ZIP_CD = paymentForm.billZipCd;
        params.BILL_ADDR = paymentForm.billAddr;
        params.BILL_ADDR_JIBUN = paymentForm.billAddrJibun;
        params.BILL_ADDR_DTL = `${paymentForm.billAddrDtl || ''} ${paymentForm.billAddrDtl2 || ''}`.trim();
      }

      const response = await updatePaymentMethod(params);

      if (response.success) {
        showToast?.('납부방법이 변경되었습니다.', 'success');
        // 폼 초기화
        setPaymentForm({
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
          pymDay: '',
          billZipCd: '',
          billAddr: '',
          billAddrJibun: '',
          billAddrDtl: '',
          billAddrDtl2: '',
          billPostId: ''
        });
        setIsVerified(false);
        onPaymentChangeEnd?.();
        // 납부정보 다시 로드
        loadPaymentInfo();
      } else {
        showToast?.(response.message || '납부방법 변경에 실패했습니다.', 'error');
      }
    } catch (error) {
      console.error('Save payment error:', error);
      showToast?.('납부방법 변경 중 오류가 발생했습니다.', 'error');
    } finally {
      setIsSavingPayment(false);
    }
  };

  // 섹션 토글
  const toggleSection = (section: string) => {
    const newState = !expandedSections[section];
    setExpandedSections(prev => ({
      ...prev,
      [section]: newState
    }));

    // 휴대폰결제 섹션 펼칠 때 데이터 로드 (최초 1회)
    if (section === 'hpPay' && newState && !hpPayLoaded) {
      loadHpPayList();
    }

    // 납부방법 섹션 펼칠 때 데이터 로드 (최초 1회)
    if (section === 'payment' && newState && !paymentLoaded) {
      loadPaymentInfo();
    }
  };

  // 납부계정ID 포맷 (000-000-0000)
  const formatPymAcntId = (id: string) => {
    if (!id) return '-';
    const cleaned = id.replace(/[^0-9]/g, '');
    if (cleaned.length === 10) {
      return `${cleaned.slice(0, 3)}-${cleaned.slice(3, 6)}-${cleaned.slice(6)}`;
    }
    return id;
  };

  // 전화번호 변경 저장
  const handleSavePhone = async () => {
    if (!selectedCustomer) {
      showToast?.('먼저 고객을 선택해주세요.', 'warning');
      return;
    }

    if (!phoneForm.telNo || phoneForm.telNo.length < 10) {
      showToast?.('올바른 전화번호를 입력해주세요.', 'warning');
      return;
    }

    setIsSavingPhone(true);
    try {
      // 전화번호 분리 (010-1234-5678 형식으로 분리)
      const telNo = phoneForm.telNo.replace(/[^0-9]/g, '');
      let telDdd = '';
      let telFix = '';
      let telDtl = '';

      if (telNo.length === 11) {
        // 010-1234-5678
        telDdd = telNo.substring(0, 3);
        telFix = telNo.substring(3, 7);
        telDtl = telNo.substring(7, 11);
      } else if (telNo.length === 10) {
        // 02-1234-5678 or 031-123-4567
        if (telNo.startsWith('02')) {
          telDdd = telNo.substring(0, 2);
          telFix = telNo.substring(2, 6);
          telDtl = telNo.substring(6, 10);
        } else {
          telDdd = telNo.substring(0, 3);
          telFix = telNo.substring(3, 6);
          telDtl = telNo.substring(6, 10);
        }
      }

      const params: PhoneChangeRequest = {
        CUST_ID: selectedCustomer.custId,
        TEL_DDD: telDdd,
        TEL_FIX: telFix,
        TEL_DTL: telDtl,
        MB_CORP_TP: phoneForm.telTpCd,
        NO_SVC_YN: phoneForm.disconnYn,
        TEL_NO_TP: '2',
        USE_YN: 'Y',
        CHG_UID: ''
      };

      const response = await updatePhoneNumber(params);

      if (response.success) {
        showToast?.('전화번호가 변경되었습니다.', 'success');
        // 폼 초기화
        setPhoneForm({ telNo: '', telTpCd: '', disconnYn: 'N' });
      } else {
        showToast?.(response.message || '전화번호 변경에 실패했습니다.', 'error');
      }
    } catch (error) {
      console.error('Update phone error:', error);
      showToast?.('전화번호 변경 중 오류가 발생했습니다.', 'error');
    } finally {
      setIsSavingPhone(false);
    }
  };

  // 주소 변경 저장
  const handleSaveAddress = async () => {
    if (!selectedCustomer) {
      showToast?.('먼저 고객을 선택해주세요.', 'warning');
      return;
    }

    if (!addressForm.zipCd || !addressForm.addr1) {
      showToast?.('우편번호와 기본주소를 입력해주세요.', 'warning');
      return;
    }

    if (!addressForm.changeInstAddr && !addressForm.changeCustAddr && !addressForm.changeBillAddr) {
      showToast?.('변경할 주소 유형을 선택해주세요.', 'warning');
      return;
    }

    // 설치주소 변경 시 계약ID 필요 - 현재는 미지원
    if (addressForm.changeInstAddr) {
      showToast?.('설치주소 변경은 기본조회 탭에서 계약을 선택한 후 진행해주세요.', 'warning');
      return;
    }

    setIsSavingAddress(true);
    try {
      // 상세주소 = 기본주소 + 상세주소
      const fullAddr = addressForm.addr2
        ? `${addressForm.addr1} ${addressForm.addr2}`
        : addressForm.addr1;

      // D'Live API 스펙에 맞는 파라미터
      // saveMargeAddrOrdInfo: 고객주소 변경
      // - CUST_ID: 고객ID
      // - ADDR_ORD: 주소순번
      // - DONGMYON_NM: 읍면동명 (선택)
      // - STREET_ID: 도로명ID (선택)
      // - ZIP_CD: 우편번호 (선택)
      // - ADDR_DTL: 상세주소 (선택)
      const params: AddressChangeRequest = {
        CUST_ID: selectedCustomer.custId,
        ADDR_ORD: '1',  // 기본 주소순번
        ZIP_CD: addressForm.zipCd,
        ADDR_DTL: fullAddr,
        // 추가 정보 (검색 결과에서)
        DONGMYON_NM: addressForm.dongmyonNm || undefined,
        STREET_ID: addressForm.streetId || undefined
      };

      const response = await updateAddress(params);

      if (response.success) {
        showToast?.('주소가 변경되었습니다.', 'success');
        // 폼 초기화
        setAddressForm({
          zipCd: '',
          addr1: '',
          addr2: '',
          changeInstAddr: false,
          changeCustAddr: true,
          changeBillAddr: false,
          postId: '',
          streetId: '',
          dongmyonNm: ''
        });
        setSelectedPostId('');
      } else {
        showToast?.(response.message || '주소 변경에 실패했습니다.', 'error');
      }
    } catch (error) {
      console.error('Update address error:', error);
      showToast?.('주소 변경 중 오류가 발생했습니다.', 'error');
    } finally {
      setIsSavingAddress(false);
    }
  };

  // 주소 검색 모달 열기
  const handleOpenAddressModal = () => {
    setShowAddressModal(true);
    setAddressSearchQuery('');
    setStreetSearchForm({ streetNm: '', streetBunM: '', streetBunS: '', buildNm: '' });
    setPostAddressResults([]);
    setStreetAddressResults([]);
  };

  // 주소 검색 모달 닫기
  const handleCloseAddressModal = () => {
    setShowAddressModal(false);
    setPostAddressResults([]);
    setStreetAddressResults([]);
  };

  // 지번주소 검색
  const handleSearchPostAddress = async () => {
    if (!addressSearchQuery || addressSearchQuery.length < 2) {
      showToast?.('동/면 이름을 2자 이상 입력해주세요.', 'warning');
      return;
    }

    setIsSearchingAddress(true);
    try {
      const response = await searchPostAddress({
        DONGMYONG: addressSearchQuery
      });

      if (response.success && response.data) {
        setPostAddressResults(response.data);
        if (response.data.length === 0) {
          showToast?.('검색 결과가 없습니다.', 'info');
        }
      } else {
        showToast?.(response.message || '주소 검색에 실패했습니다.', 'error');
        setPostAddressResults([]);
      }
    } catch (error) {
      console.error('Search post address error:', error);
      showToast?.('주소 검색 중 오류가 발생했습니다.', 'error');
      setPostAddressResults([]);
    } finally {
      setIsSearchingAddress(false);
    }
  };

  // 도로명주소 검색
  const handleSearchStreetAddress = async () => {
    if (!streetSearchForm.streetNm || streetSearchForm.streetNm.length < 2) {
      showToast?.('도로명을 2자 이상 입력해주세요.', 'warning');
      return;
    }

    setIsSearchingAddress(true);
    try {
      const response = await searchStreetAddress({
        STREET_NM: streetSearchForm.streetNm,
        STREET_BUN_M: streetSearchForm.streetBunM || undefined,
        STREET_BUN_S: streetSearchForm.streetBunS || undefined,
        BUILD_NM: streetSearchForm.buildNm || undefined
      });

      if (response.success && response.data) {
        setStreetAddressResults(response.data);
        if (response.data.length === 0) {
          showToast?.('검색 결과가 없습니다.', 'info');
        }
      } else {
        showToast?.(response.message || '주소 검색에 실패했습니다.', 'error');
        setStreetAddressResults([]);
      }
    } catch (error) {
      console.error('Search street address error:', error);
      showToast?.('주소 검색 중 오류가 발생했습니다.', 'error');
      setStreetAddressResults([]);
    } finally {
      setIsSearchingAddress(false);
    }
  };

  // 지번주소 선택
  const handleSelectPostAddress = (addr: PostAddressInfo) => {
    setAddressForm(prev => ({
      ...prev,
      zipCd: addr.ZIP_CD,
      addr1: addr.ADDR_FULL || addr.ADDR,
      addr2: '',
      postId: addr.POST_ID,
      streetId: '',  // 지번주소는 도로명ID 없음
      dongmyonNm: addr.DONGMYON_NM || ''
    }));
    setSelectedPostId(addr.POST_ID);
    handleCloseAddressModal();
    showToast?.('주소가 입력되었습니다. 상세주소를 입력해주세요.', 'info');
  };

  // 도로명주소 선택
  const handleSelectStreetAddress = (addr: StreetAddressInfo) => {
    setAddressForm(prev => ({
      ...prev,
      zipCd: addr.ZIP_CD,
      addr1: addr.STREET_ADDR || addr.ADDR_FULL,
      addr2: '',
      postId: addr.POST_ID,
      streetId: addr.STREET_ID,
      dongmyonNm: addr.DONGMYON_NM || addr.NM_SMALL || ''
    }));
    setSelectedPostId(addr.POST_ID);
    handleCloseAddressModal();
    showToast?.('주소가 입력되었습니다. 상세주소를 입력해주세요.', 'info');
  };

  // 청구주소 검색 모달 열기
  const handleOpenBillAddressModal = () => {
    setShowBillAddressModal(true);
    setBillAddressSearchQuery('');
    setBillStreetSearchForm({ streetNm: '', streetBunM: '', streetBunS: '', buildNm: '' });
    setBillAddressResults([]);
    setBillStreetResults([]);
  };

  // 청구주소 검색 모달 닫기
  const handleCloseBillAddressModal = () => {
    setShowBillAddressModal(false);
    setBillAddressResults([]);
    setBillStreetResults([]);
  };

  // 청구주소 지번검색
  const handleSearchBillPostAddress = async () => {
    if (!billAddressSearchQuery || billAddressSearchQuery.length < 2) {
      showToast?.('동/면 이름을 2자 이상 입력해주세요.', 'warning');
      return;
    }

    setIsSearchingBillAddress(true);
    try {
      const response = await searchPostAddress({
        DONGMYONG: billAddressSearchQuery
      });

      if (response.success && response.data) {
        setBillAddressResults(response.data);
        if (response.data.length === 0) {
          showToast?.('검색 결과가 없습니다.', 'info');
        }
      } else {
        showToast?.(response.message || '주소 검색에 실패했습니다.', 'error');
        setBillAddressResults([]);
      }
    } catch (error) {
      console.error('Search bill address error:', error);
      showToast?.('주소 검색 중 오류가 발생했습니다.', 'error');
      setBillAddressResults([]);
    } finally {
      setIsSearchingBillAddress(false);
    }
  };

  // 청구주소 도로명검색
  const handleSearchBillStreetAddress = async () => {
    if (!billStreetSearchForm.streetNm || billStreetSearchForm.streetNm.length < 2) {
      showToast?.('도로명을 2자 이상 입력해주세요.', 'warning');
      return;
    }

    setIsSearchingBillAddress(true);
    try {
      const response = await searchStreetAddress({
        STREET_NM: billStreetSearchForm.streetNm,
        STREET_BUN_M: billStreetSearchForm.streetBunM || undefined,
        STREET_BUN_S: billStreetSearchForm.streetBunS || undefined,
        BUILD_NM: billStreetSearchForm.buildNm || undefined
      });

      if (response.success && response.data) {
        setBillStreetResults(response.data);
        if (response.data.length === 0) {
          showToast?.('검색 결과가 없습니다.', 'info');
        }
      } else {
        showToast?.(response.message || '주소 검색에 실패했습니다.', 'error');
        setBillStreetResults([]);
      }
    } catch (error) {
      console.error('Search bill street address error:', error);
      showToast?.('주소 검색 중 오류가 발생했습니다.', 'error');
      setBillStreetResults([]);
    } finally {
      setIsSearchingBillAddress(false);
    }
  };

  // 청구주소 지번주소 선택
  const handleSelectBillPostAddress = (addr: PostAddressInfo) => {
    setPaymentForm(prev => ({
      ...prev,
      billZipCd: addr.ZIP_CD,
      billAddr: addr.ADDR_FULL || addr.ADDR,
      billAddrJibun: addr.ADDR || addr.ADDR_FULL,
      billPostId: addr.POST_ID
    }));
    handleCloseBillAddressModal();
    showToast?.('청구주소가 입력되었습니다. 상세주소를 입력해주세요.', 'info');
    onPaymentChangeStart?.();
  };

  // 청구주소 도로명주소 선택
  const handleSelectBillStreetAddress = (addr: StreetAddressInfo) => {
    setPaymentForm(prev => ({
      ...prev,
      billZipCd: addr.ZIP_CD,
      billAddr: addr.STREET_ADDR || addr.ADDR_FULL,
      billAddrJibun: addr.ADDR_FULL,
      billPostId: addr.POST_ID
    }));
    handleCloseBillAddressModal();
    showToast?.('청구주소가 입력되었습니다. 상세주소를 입력해주세요.', 'info');
    onPaymentChangeStart?.();
  };

  // 고객 미선택 시 안내
  if (!selectedCustomer) {
    return (
      <div className="h-full flex items-center justify-center bg-gray-50">
        <div className="text-center p-8">
          <AlertCircle className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-700 mb-2">고객을 먼저 선택해주세요</h3>
          <p className="text-gray-500">
            기본조회 탭에서 고객을 검색하고 선택한 후<br />
            정보변경을 진행할 수 있습니다.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto bg-gray-50">
      <div className="p-4 space-y-4">
        {/* 전화번호 변경 */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200">
          <button
            onClick={() => toggleSection('phone')}
            className="w-full p-4 flex items-center justify-between text-left"
          >
            <div className="flex items-center gap-2">
              <Phone className="w-5 h-5 text-blue-500" />
              <span className="font-medium text-gray-800">전화번호 변경</span>
            </div>
            {expandedSections.phone ? (
              <ChevronUp className="w-5 h-5 text-gray-400" />
            ) : (
              <ChevronDown className="w-5 h-5 text-gray-400" />
            )}
          </button>

          {expandedSections.phone && (
            <div className="px-4 pb-4 space-y-4">
              {/* 현재 전화번호 */}
              <div className="p-3 bg-gray-50 rounded-lg">
                <div className="text-xs text-gray-500 mb-1">현재 전화번호</div>
                <div className="font-medium text-gray-800">
                  {formatPhoneNumber(selectedCustomer.telNo) || '-'}
                </div>
              </div>

              {/* 새 전화번호 입력 */}
              <div>
                <label className="block text-sm text-gray-600 mb-1">새 전화번호</label>
                <input
                  type="tel"
                  value={phoneForm.telNo}
                  onChange={(e) => setPhoneForm(prev => ({
                    ...prev,
                    telNo: e.target.value.replace(/[^0-9]/g, '')
                  }))}
                  placeholder="01012345678"
                  maxLength={11}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              {/* 통신사 선택 */}
              <div>
                <label className="block text-sm text-gray-600 mb-1">통신사</label>
                <select
                  value={phoneForm.telTpCd}
                  onChange={(e) => setPhoneForm(prev => ({
                    ...prev,
                    telTpCd: e.target.value
                  }))}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="">선택</option>
                  {telecomCodes.map(code => (
                    <option key={code.CODE} value={code.CODE}>
                      {code.CODE_NM}
                    </option>
                  ))}
                  {/* 기본 통신사 옵션 (코드 로드 실패 시) */}
                  {telecomCodes.length === 0 && (
                    <>
                      <option value="SKT">SKT</option>
                      <option value="KT">KT</option>
                      <option value="LGU">LG U+</option>
                      <option value="MVNO">알뜰폰</option>
                    </>
                  )}
                </select>
              </div>

              {/* 결번 여부 */}
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="disconnYn"
                  checked={phoneForm.disconnYn === 'Y'}
                  onChange={(e) => setPhoneForm(prev => ({
                    ...prev,
                    disconnYn: e.target.checked ? 'Y' : 'N'
                  }))}
                  className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                />
                <label htmlFor="disconnYn" className="text-sm text-gray-600">
                  결번 (연락 불가)
                </label>
              </div>

              {/* 저장 버튼 */}
              <button
                onClick={handleSavePhone}
                disabled={isSavingPhone}
                className="w-full flex items-center justify-center gap-2 py-3 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:bg-gray-400 transition-colors"
              >
                {isSavingPhone ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    저장 중...
                  </>
                ) : (
                  <>
                    <Save className="w-5 h-5" />
                    전화번호 변경
                  </>
                )}
              </button>
            </div>
          )}
        </div>

        {/* 주소 변경 */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200">
          <button
            onClick={() => toggleSection('address')}
            className="w-full p-4 flex items-center justify-between text-left"
          >
            <div className="flex items-center gap-2">
              <MapPin className="w-5 h-5 text-green-500" />
              <span className="font-medium text-gray-800">주소 변경</span>
            </div>
            {expandedSections.address ? (
              <ChevronUp className="w-5 h-5 text-gray-400" />
            ) : (
              <ChevronDown className="w-5 h-5 text-gray-400" />
            )}
          </button>

          {expandedSections.address && (
            <div className="px-4 pb-4 space-y-4">
              {/* 변경할 주소 유형 선택 */}
              <div className="space-y-2">
                <label className="block text-sm text-gray-600 mb-2">변경할 주소 선택</label>
                <div className="space-y-2">
                  <label className="flex items-center gap-2 p-3 bg-gray-100 rounded-lg cursor-not-allowed opacity-60">
                    <input
                      type="checkbox"
                      checked={addressForm.changeInstAddr}
                      disabled
                      onChange={(e) => setAddressForm(prev => ({
                        ...prev,
                        changeInstAddr: e.target.checked
                      }))}
                      className="w-4 h-4 text-gray-400 border-gray-300 rounded"
                    />
                    <div>
                      <span className="text-sm text-gray-500">설치주소</span>
                      <span className="text-xs text-gray-400 ml-2">(계약 선택 필요)</span>
                    </div>
                  </label>
                  <label className="flex items-center gap-2 p-3 bg-gray-50 rounded-lg cursor-pointer hover:bg-gray-100">
                    <input
                      type="checkbox"
                      checked={addressForm.changeCustAddr}
                      onChange={(e) => setAddressForm(prev => ({
                        ...prev,
                        changeCustAddr: e.target.checked
                      }))}
                      className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                    />
                    <span className="text-sm text-gray-700">고객주소</span>
                  </label>
                  <label className="flex items-center gap-2 p-3 bg-gray-100 rounded-lg cursor-not-allowed opacity-60">
                    <input
                      type="checkbox"
                      checked={addressForm.changeBillAddr}
                      disabled
                      onChange={(e) => setAddressForm(prev => ({
                        ...prev,
                        changeBillAddr: e.target.checked
                      }))}
                      className="w-4 h-4 text-gray-400 border-gray-300 rounded"
                    />
                    <div>
                      <span className="text-sm text-gray-500">청구지주소</span>
                      <span className="text-xs text-gray-400 ml-2">(계약 선택 필요)</span>
                    </div>
                  </label>
                </div>
              </div>

              {/* 우편번호 */}
              <div>
                <label className="block text-sm text-gray-600 mb-1">우편번호</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={addressForm.zipCd}
                    readOnly
                    placeholder="주소검색 버튼을 눌러주세요"
                    className="flex-1 px-4 py-2 border border-gray-300 rounded-lg bg-gray-50 cursor-pointer"
                    onClick={handleOpenAddressModal}
                  />
                  <button
                    onClick={handleOpenAddressModal}
                    className="px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors flex items-center gap-1"
                  >
                    <Search className="w-4 h-4" />
                    주소검색
                  </button>
                </div>
              </div>

              {/* 기본주소 */}
              <div>
                <label className="block text-sm text-gray-600 mb-1">기본주소</label>
                <input
                  type="text"
                  value={addressForm.addr1}
                  onChange={(e) => setAddressForm(prev => ({
                    ...prev,
                    addr1: e.target.value
                  }))}
                  placeholder="기본주소 입력"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              {/* 상세주소 */}
              <div>
                <label className="block text-sm text-gray-600 mb-1">상세주소</label>
                <input
                  type="text"
                  value={addressForm.addr2}
                  onChange={(e) => setAddressForm(prev => ({
                    ...prev,
                    addr2: e.target.value
                  }))}
                  placeholder="상세주소 입력"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              {/* 안내 메시지 */}
              <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                <div className="flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 text-yellow-600 mt-0.5" />
                  <div className="text-sm text-yellow-700">
                    <p>설치 위치 변경은 작업관리에서 처리됩니다.</p>
                    <p className="text-xs mt-1">이 화면에서는 주소 정보만 수정됩니다.</p>
                  </div>
                </div>
              </div>

              {/* 저장 버튼 */}
              <button
                onClick={handleSaveAddress}
                disabled={isSavingAddress}
                className="w-full flex items-center justify-center gap-2 py-3 bg-green-500 text-white rounded-lg hover:bg-green-600 disabled:bg-gray-400 transition-colors"
              >
                {isSavingAddress ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    저장 중...
                  </>
                ) : (
                  <>
                    <Save className="w-5 h-5" />
                    주소 변경
                  </>
                )}
              </button>
            </div>
          )}
        </div>

        {/* 납부방법 변경 */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200">
          <button
            onClick={() => toggleSection('payment')}
            className="w-full p-4 flex items-center justify-between text-left"
          >
            <div className="flex items-center gap-2">
              <CreditCard className="w-5 h-5 text-orange-500" />
              <span className="font-medium text-gray-800">납부방법 변경</span>
            </div>
            {expandedSections.payment ? (
              <ChevronUp className="w-5 h-5 text-gray-400" />
            ) : (
              <ChevronDown className="w-5 h-5 text-gray-400" />
            )}
          </button>

          {expandedSections.payment && (
            <div className="px-4 pb-4 space-y-4">
              {/* 로딩 상태 */}
              {isLoadingPayment && (
                <div className="flex items-center justify-center py-4">
                  <Loader2 className="w-6 h-6 text-orange-500 animate-spin" />
                  <span className="ml-2 text-gray-500">조회 중...</span>
                </div>
              )}

              {/* 납부계정 목록 */}
              {!isLoadingPayment && paymentLoaded && (
                <>
                  {paymentInfoList.length > 0 ? (
                    <div className="space-y-4">
                      {/* 기존 납부정보 - 카드형 레이아웃 (모바일 친화적) */}
                      <div className="space-y-2">
                        {paymentInfoList.map((item) => (
                          <div
                            key={item.PYM_ACNT_ID}
                            onClick={() => {
                              setSelectedPymAcntId(item.PYM_ACNT_ID);
                              onPaymentChangeStart?.();
                            }}
                            className={`p-3 rounded-lg border cursor-pointer transition-colors ${
                              selectedPymAcntId === item.PYM_ACNT_ID
                                ? 'bg-orange-50 border-orange-300'
                                : 'bg-gray-50 border-gray-200 hover:border-gray-300'
                            }`}
                          >
                            <div className="flex items-center justify-between mb-1">
                              <span className="font-mono text-sm text-blue-600">{formatPymAcntId(item.PYM_ACNT_ID)}</span>
                              <span className="text-xs text-gray-500">{item.PYM_MTH_NM || '-'}</span>
                            </div>
                            <div className="text-sm text-gray-700">{item.BANK_NM || item.CARD_NM || '-'}</div>
                            {item.BILL_ADDR && (
                              <div className="text-xs text-gray-500 truncate mt-1">{item.BILL_ADDR}</div>
                            )}
                          </div>
                        ))}
                      </div>

                      {/* 납부정보 섹션 */}
                      <div className="border border-gray-200 rounded-lg p-3">
                        <h4 className="text-sm font-medium text-gray-700 mb-3 flex items-center gap-1">
                          <ChevronDown className="w-4 h-4" />
                          납부정보
                        </h4>

                        <div className="space-y-3">
                          {/* 첫번째 행: 납부방법 + 변경사유 */}
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            {/* 납부방법 */}
                            <div>
                              <label className="block text-xs text-gray-500 mb-1">납부방법</label>
                              <select
                                value={paymentForm.pymMthCd}
                                onChange={(e) => {
                                  setPaymentForm(prev => ({ ...prev, pymMthCd: e.target.value, bankCd: '', acntNo: '' }));
                                  setIsVerified(false);
                                  onPaymentChangeStart?.();
                                }}
                                className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-orange-500"
                              >
                                <option value="01">자동이체(신)</option>
                                <option value="02">신용카드</option>
                              </select>
                            </div>

                            {/* 변경사유 - 세로 레이아웃으로 변경 */}
                            <div>
                              <label className="block text-xs text-gray-500 mb-1">변경사유</label>
                              <div className="space-y-1">
                                <select
                                  value={paymentForm.changeReasonL}
                                  onChange={(e) => {
                                    setPaymentForm(prev => ({ ...prev, changeReasonL: e.target.value, changeReasonM: '' }));
                                    onPaymentChangeStart?.();
                                  }}
                                  className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-orange-500"
                                >
                                  <option value="">대분류</option>
                                  {changeReasonLargeCodes.map(code => (
                                    <option key={code.CODE} value={code.CODE}>{code.CODE_NM}</option>
                                  ))}
                                </select>
                                <select
                                  value={paymentForm.changeReasonM}
                                  onChange={(e) => {
                                    setPaymentForm(prev => ({ ...prev, changeReasonM: e.target.value }));
                                    onPaymentChangeStart?.();
                                  }}
                                  disabled={!paymentForm.changeReasonL}
                                  className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-orange-500 disabled:bg-gray-100"
                                >
                                  <option value="">중분류</option>
                                  {(changeReasonMiddleCodes[paymentForm.changeReasonL] || []).map(code => (
                                    <option key={code.CODE} value={code.CODE}>{code.CODE_NM}</option>
                                  ))}
                                </select>
                              </div>
                            </div>
                          </div>

                          {/* 두번째 행: 예금주명 + 신분유형 */}
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            {/* 예금주명/카드소유주명 */}
                            <div>
                              <label className="block text-xs text-gray-500 mb-1">
                                {paymentForm.pymMthCd === '01' ? '예금주명' : '카드소유주명'}
                              </label>
                              <input
                                type="text"
                                value={paymentForm.acntHolderNm}
                                onChange={(e) => {
                                  setPaymentForm(prev => ({ ...prev, acntHolderNm: e.target.value }));
                                  setIsVerified(false);
                                  onPaymentChangeStart?.();
                                }}
                                placeholder="이름 입력"
                                className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-orange-500"
                              />
                            </div>

                            {/* 신분유형 */}
                            <div>
                              <label className="block text-xs text-gray-500 mb-1">신분유형</label>
                              <select
                                value={paymentForm.idType}
                                onChange={(e) => {
                                  setPaymentForm(prev => ({ ...prev, idType: e.target.value }));
                                  onPaymentChangeStart?.();
                                }}
                                className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-orange-500"
                              >
                                {idTypeCodes.map(code => (
                                  <option key={code.CODE} value={code.CODE}>{code.CODE_NM}</option>
                                ))}
                              </select>
                            </div>
                          </div>

                          {/* 세번째 행: 생년월일 + 은행/카드사 */}
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            {/* 생년월일 */}
                            <div>
                              <label className="block text-xs text-gray-500 mb-1">생년월일</label>
                              <input
                                type="text"
                                value={paymentForm.birthDt}
                                onChange={(e) => {
                                  setPaymentForm(prev => ({ ...prev, birthDt: e.target.value.replace(/[^0-9]/g, '').slice(0, 8) }));
                                  onPaymentChangeStart?.();
                                }}
                                placeholder="YYYYMMDD"
                                maxLength={8}
                                className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-orange-500"
                              />
                            </div>

                            {/* 은행명/카드사명 */}
                            <div>
                              <label className="block text-xs text-gray-500 mb-1">
                                {paymentForm.pymMthCd === '01' ? '은행명' : '카드사명'}
                              </label>
                              <select
                                value={paymentForm.bankCd}
                                onChange={(e) => {
                                  setPaymentForm(prev => ({ ...prev, bankCd: e.target.value }));
                                  setIsVerified(false);
                                  onPaymentChangeStart?.();
                                }}
                                className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-orange-500"
                              >
                                <option value="">선택</option>
                                {(paymentForm.pymMthCd === '01' ? bankCodes : cardCompanyCodes).map(code => (
                                  <option key={code.CODE} value={code.CODE}>{code.CODE_NM}</option>
                                ))}
                              </select>
                            </div>
                          </div>

                          {/* 계좌번호/카드번호 + 인증 버튼 - 전체 너비 */}
                          <div>
                            <label className="block text-xs text-gray-500 mb-1">
                              {paymentForm.pymMthCd === '01' ? '계좌번호' : '카드번호'}
                            </label>
                            <div className="flex gap-2">
                              <input
                                type="text"
                                value={paymentForm.acntNo}
                                onChange={(e) => {
                                  setPaymentForm(prev => ({ ...prev, acntNo: e.target.value.replace(/[^0-9]/g, '') }));
                                  setIsVerified(false);
                                  onPaymentChangeStart?.();
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
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                              <div>
                                <label className="block text-xs text-gray-500 mb-1">카드유효기간</label>
                                <div className="flex items-center gap-1">
                                  <input
                                    type="text"
                                    value={paymentForm.cardExpMm}
                                    onChange={(e) => {
                                      setPaymentForm(prev => ({ ...prev, cardExpMm: e.target.value.replace(/[^0-9]/g, '').slice(0, 2) }));
                                      setIsVerified(false);
                                      onPaymentChangeStart?.();
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
                                      onPaymentChangeStart?.();
                                    }}
                                    placeholder="YY"
                                    maxLength={2}
                                    className="w-14 px-2 py-1.5 text-sm border border-gray-300 rounded text-center focus:ring-1 focus:ring-orange-500"
                                  />
                                </div>
                              </div>

                              <div>
                                <label className="block text-xs text-gray-500 mb-1">제휴카드</label>
                                <select
                                  value={paymentForm.joinCardYn}
                                  onChange={(e) => {
                                    setPaymentForm(prev => ({ ...prev, joinCardYn: e.target.value }));
                                    onPaymentChangeStart?.();
                                  }}
                                  className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-orange-500"
                                >
                                  <option value="N">아니오</option>
                                  <option value="Y">예</option>
                                </select>
                              </div>
                            </div>
                          )}

                          {/* 마지막 행: 납부자관계 + 결제일 */}
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            {/* 납부자관계 */}
                            <div>
                              <label className="block text-xs text-gray-500 mb-1">납부자관계</label>
                              <select
                                value={paymentForm.pyrRel}
                                onChange={(e) => {
                                  setPaymentForm(prev => ({ ...prev, pyrRel: e.target.value }));
                                  onPaymentChangeStart?.();
                                }}
                                className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-orange-500"
                              >
                                {pyrRelCodes.map(code => (
                                  <option key={code.CODE} value={code.CODE}>{code.CODE_NM}</option>
                                ))}
                              </select>
                            </div>

                            {/* 결제일 */}
                            <div>
                              <label className="block text-xs text-gray-500 mb-1">결제일</label>
                              <select
                                value={paymentForm.pymDay}
                                onChange={(e) => {
                                  setPaymentForm(prev => ({ ...prev, pymDay: e.target.value }));
                                  onPaymentChangeStart?.();
                                }}
                                className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-orange-500"
                              >
                                <option value="">선택</option>
                                {paymentDays.map(day => (
                                  <option key={day.CODE} value={day.CODE}>{day.CODE_NM}</option>
                                ))}
                              </select>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* 청구주소정보 섹션 */}
                      <div className="border border-gray-200 rounded-lg p-3">
                        <h4 className="text-sm font-medium text-gray-700 mb-3 flex items-center gap-1">
                          <ChevronDown className="w-4 h-4" />
                          청구주소정보
                        </h4>

                        <div className="space-y-3">
                          {/* 읍/면/동 검색 */}
                          <div>
                            <label className="block text-xs text-gray-500 mb-1">읍/면/동</label>
                            <div className="flex gap-2">
                              <input
                                type="text"
                                value={paymentForm.billAddr ? `${paymentForm.billZipCd} - ${paymentForm.billAddr.substring(0, 30)}...` : ''}
                                readOnly
                                placeholder="주소 검색 버튼 클릭"
                                onClick={handleOpenBillAddressModal}
                                className="flex-1 px-2 py-1.5 text-sm border border-gray-300 rounded bg-gray-50 cursor-pointer truncate"
                              />
                              <button
                                onClick={handleOpenBillAddressModal}
                                className="px-3 py-1.5 text-sm bg-orange-100 text-orange-700 rounded hover:bg-orange-200 flex items-center gap-1"
                              >
                                <Search className="w-4 h-4" />
                                검색
                              </button>
                            </div>
                          </div>

                          {/* 도로명주소 */}
                          <div>
                            <label className="block text-xs text-gray-500 mb-1">도로명주소</label>
                            <input
                              type="text"
                              value={paymentForm.billAddr}
                              readOnly
                              placeholder="주소 검색 후 자동 입력"
                              className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded bg-gray-50"
                            />
                          </div>

                          {/* 지번주소 */}
                          <div>
                            <label className="block text-xs text-gray-500 mb-1">지번주소</label>
                            <input
                              type="text"
                              value={paymentForm.billAddrJibun}
                              readOnly
                              placeholder="주소 검색 후 자동 입력"
                              className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded bg-gray-50"
                            />
                          </div>

                          {/* 상세주소 */}
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            <div>
                              <label className="block text-xs text-gray-500 mb-1">상세 (동)</label>
                              <input
                                type="text"
                                value={paymentForm.billAddrDtl}
                                onChange={(e) => {
                                  setPaymentForm(prev => ({ ...prev, billAddrDtl: e.target.value }));
                                  onPaymentChangeStart?.();
                                }}
                                placeholder="동"
                                className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-orange-500"
                              />
                            </div>
                            <div>
                              <label className="block text-xs text-gray-500 mb-1">호</label>
                              <input
                                type="text"
                                value={paymentForm.billAddrDtl2}
                                onChange={(e) => {
                                  setPaymentForm(prev => ({ ...prev, billAddrDtl2: e.target.value }));
                                  onPaymentChangeStart?.();
                                }}
                                placeholder="호"
                                className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-orange-500"
                              />
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* 저장/닫기 버튼 */}
                      <div className="flex gap-2">
                        <button
                          onClick={handleSavePayment}
                          disabled={isSavingPayment || !isVerified}
                          className="flex-1 py-2.5 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:bg-gray-400 transition-colors text-sm font-medium"
                        >
                          {isSavingPayment ? '저장 중...' : '저장'}
                        </button>
                        <button
                          onClick={() => {
                            setPaymentForm({
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
                              pymDay: '',
                              billZipCd: '',
                              billAddr: '',
                              billAddrJibun: '',
                              billAddrDtl: '',
                              billAddrDtl2: '',
                              billPostId: ''
                            });
                            setIsVerified(false);
                            onPaymentChangeEnd?.();
                          }}
                          className="flex-1 py-2.5 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors text-sm font-medium"
                        >
                          닫기
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="text-center py-8 text-gray-500">
                      <CreditCard className="w-12 h-12 text-gray-300 mx-auto mb-2" />
                      <p>납부계정 정보가 없습니다.</p>
                    </div>
                  )}
                </>
              )}

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
            </div>
          )}
        </div>

        {/* 휴대폰결제(선결제) 현황 */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200">
          <button
            onClick={() => toggleSection('hpPay')}
            className="w-full p-4 flex items-center justify-between text-left"
          >
            <div className="flex items-center gap-2">
              <Smartphone className="w-5 h-5 text-purple-500" />
              <span className="font-medium text-gray-800">휴대폰결제(선결제) 현황</span>
            </div>
            {expandedSections.hpPay ? (
              <ChevronUp className="w-5 h-5 text-gray-400" />
            ) : (
              <ChevronDown className="w-5 h-5 text-gray-400" />
            )}
          </button>

          {expandedSections.hpPay && (
            <div className="px-4 pb-4 space-y-3">
              {/* 새로고침 버튼 */}
              <div className="flex justify-end">
                <button
                  onClick={loadHpPayList}
                  disabled={isLoadingHpPay}
                  className="flex items-center gap-1 px-3 py-1 text-sm text-purple-600 hover:bg-purple-50 rounded-lg transition-colors"
                >
                  <RefreshCw className={`w-4 h-4 ${isLoadingHpPay ? 'animate-spin' : ''}`} />
                  새로고침
                </button>
              </div>

              {/* 로딩 상태 */}
              {isLoadingHpPay && (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-6 h-6 text-purple-500 animate-spin" />
                  <span className="ml-2 text-gray-500">조회 중...</span>
                </div>
              )}

              {/* 데이터 없음 */}
              {!isLoadingHpPay && hpPayLoaded && hpPayList.length === 0 && (
                <div className="text-center py-8 text-gray-500">
                  <Smartphone className="w-12 h-12 text-gray-300 mx-auto mb-2" />
                  <p>휴대폰결제 신청 내역이 없습니다.</p>
                </div>
              )}

              {/* 계약별 목록 */}
              {!isLoadingHpPay && hpPayList.length > 0 && (
                <div className="space-y-2">
                  {hpPayList.map((item, index) => (
                    <div
                      key={item.CTRT_ID || index}
                      className="p-3 bg-gray-50 rounded-lg border border-gray-100"
                    >
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-medium text-gray-800 text-sm">
                          {item.PROD_NM || '상품명 없음'}
                        </span>
                        <span
                          className={`px-2 py-0.5 text-xs rounded-full ${
                            item.HP_PAY_YN === 'Y'
                              ? 'bg-green-100 text-green-700'
                              : 'bg-gray-100 text-gray-600'
                          }`}
                        >
                          {item.HP_PAY_YN === 'Y' ? '신청' : '미신청'}
                        </span>
                      </div>
                      <div className="text-xs text-gray-500 space-y-1">
                        <div className="flex justify-between">
                          <span>계약ID:</span>
                          <span className="text-gray-700">{item.CTRT_ID}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>계약상태:</span>
                          <span className="text-gray-700">{item.CTRT_STAT_NM || '-'}</span>
                        </div>
                        {item.INST_ADDR && (
                          <div className="flex justify-between">
                            <span>설치주소:</span>
                            <span className="text-gray-700 text-right max-w-[200px] truncate">
                              {item.INST_ADDR}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* 안내 메시지 */}
              <div className="p-3 bg-purple-50 border border-purple-200 rounded-lg">
                <div className="flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 text-purple-600 mt-0.5" />
                  <div className="text-sm text-purple-700">
                    <p>휴대폰결제 신청/해지는 고객센터를 통해 처리됩니다.</p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 주소 검색 모달 */}
      {showAddressModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg overflow-hidden max-h-[85vh] flex flex-col">
            {/* 헤더 */}
            <div className="p-3 border-b border-gray-100 bg-gradient-to-r from-green-500 to-green-600 flex-shrink-0">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-white flex items-center gap-2">
                  <MapPin className="w-4 h-4" />
                  주소 검색
                </h3>
                <button onClick={handleCloseAddressModal} className="text-white/80 hover:text-white">
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* 탭 선택 */}
            <div className="p-3 border-b border-gray-200 flex-shrink-0">
              <div className="flex gap-2">
                <button
                  onClick={() => {
                    setAddressSearchType('post');
                    setPostAddressResults([]);
                    setStreetAddressResults([]);
                  }}
                  className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${
                    addressSearchType === 'post'
                      ? 'bg-green-500 text-white'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  지번주소
                </button>
                <button
                  onClick={() => {
                    setAddressSearchType('street');
                    setPostAddressResults([]);
                    setStreetAddressResults([]);
                  }}
                  className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${
                    addressSearchType === 'street'
                      ? 'bg-green-500 text-white'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  도로명주소
                </button>
              </div>
            </div>

            {/* 검색 입력 */}
            <div className="p-3 border-b border-gray-200 flex-shrink-0">
              {addressSearchType === 'post' ? (
                <div className="space-y-2">
                  <input
                    type="text"
                    value={addressSearchQuery}
                    onChange={(e) => setAddressSearchQuery(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && handleSearchPostAddress()}
                    placeholder="읍/면/동 이름 입력 (예: 역삼동)"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
                  />
                </div>
              ) : (
                <div className="space-y-2">
                  <input
                    type="text"
                    value={streetSearchForm.streetNm}
                    onChange={(e) => setStreetSearchForm(prev => ({ ...prev, streetNm: e.target.value }))}
                    onKeyPress={(e) => e.key === 'Enter' && handleSearchStreetAddress()}
                    placeholder="도로명 입력 (예: 테헤란로)"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
                  />
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={streetSearchForm.streetBunM}
                      onChange={(e) => setStreetSearchForm(prev => ({ ...prev, streetBunM: e.target.value.replace(/[^0-9]/g, '') }))}
                      placeholder="건물본번"
                      className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
                    />
                    <input
                      type="text"
                      value={streetSearchForm.streetBunS}
                      onChange={(e) => setStreetSearchForm(prev => ({ ...prev, streetBunS: e.target.value.replace(/[^0-9]/g, '') }))}
                      placeholder="건물부번"
                      className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
                    />
                  </div>
                  <input
                    type="text"
                    value={streetSearchForm.buildNm}
                    onChange={(e) => setStreetSearchForm(prev => ({ ...prev, buildNm: e.target.value }))}
                    placeholder="건물명 (선택)"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
                  />
                </div>
              )}

              <button
                onClick={addressSearchType === 'post' ? handleSearchPostAddress : handleSearchStreetAddress}
                disabled={isSearchingAddress}
                className="w-full mt-3 flex items-center justify-center gap-2 py-2.5 bg-green-500 text-white rounded-lg hover:bg-green-600 disabled:bg-gray-400 transition-colors"
              >
                {isSearchingAddress ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    검색 중...
                  </>
                ) : (
                  <>
                    <Search className="w-4 h-4" />
                    검색
                  </>
                )}
              </button>
            </div>

            {/* 검색 결과 */}
            <div className="flex-1 overflow-y-auto p-3 min-h-0">
              {addressSearchType === 'post' ? (
                postAddressResults.length > 0 ? (
                  <div className="space-y-2">
                    <div className="text-xs text-gray-500 mb-2">검색 결과: {postAddressResults.length}건</div>
                    {postAddressResults.map((addr, idx) => (
                      <button
                        key={addr.POST_ID || idx}
                        onClick={() => handleSelectPostAddress(addr)}
                        className="w-full p-3 bg-gray-50 hover:bg-green-50 rounded-lg border border-gray-200 hover:border-green-300 text-left transition-colors"
                      >
                        <div className="text-sm font-medium text-gray-900">{addr.ADDR_FULL || addr.ADDR}</div>
                        <div className="mt-1 text-xs text-gray-500">
                          우편번호: {addr.ZIP_CD} | {addr.SIDO_NAME} {addr.GUGUN_NM} {addr.DONGMYON_NM}
                        </div>
                      </button>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8 text-gray-400 text-sm">
                    읍/면/동 이름을 입력하고 검색하세요.
                  </div>
                )
              ) : (
                streetAddressResults.length > 0 ? (
                  <div className="space-y-2">
                    <div className="text-xs text-gray-500 mb-2">검색 결과: {streetAddressResults.length}건</div>
                    {streetAddressResults.map((addr, idx) => (
                      <button
                        key={addr.STREET_ID || idx}
                        onClick={() => handleSelectStreetAddress(addr)}
                        className="w-full p-3 bg-gray-50 hover:bg-green-50 rounded-lg border border-gray-200 hover:border-green-300 text-left transition-colors"
                      >
                        <div className="text-sm font-medium text-gray-900">{addr.STREET_ADDR}</div>
                        <div className="mt-1 text-xs text-gray-500">
                          우편번호: {addr.ZIP_CD} | {addr.ADDR_FULL}
                        </div>
                        {addr.BLD_NM && (
                          <div className="mt-0.5 text-xs text-green-600">건물명: {addr.BLD_NM}</div>
                        )}
                      </button>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8 text-gray-400 text-sm">
                    도로명과 건물번호를 입력하고 검색하세요.
                  </div>
                )
              )}
            </div>

            {/* 하단 버튼 */}
            <div className="p-3 border-t border-gray-200 flex-shrink-0">
              <button
                onClick={handleCloseAddressModal}
                className="w-full py-2.5 bg-gray-100 text-gray-600 rounded-lg hover:bg-gray-200 transition-colors"
              >
                닫기
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 청구주소 검색 모달 */}
      {showBillAddressModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg overflow-hidden max-h-[85vh] flex flex-col">
            {/* 헤더 */}
            <div className="p-3 border-b border-gray-100 bg-gradient-to-r from-orange-500 to-orange-600 flex-shrink-0">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-white flex items-center gap-2">
                  <MapPin className="w-4 h-4" />
                  청구주소 검색
                </h3>
                <button onClick={handleCloseBillAddressModal} className="text-white/80 hover:text-white">
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* 탭 선택 */}
            <div className="p-3 border-b border-gray-200 flex-shrink-0">
              <div className="flex gap-2">
                <button
                  onClick={() => {
                    setBillAddressSearchType('post');
                    setBillAddressResults([]);
                    setBillStreetResults([]);
                  }}
                  className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${
                    billAddressSearchType === 'post'
                      ? 'bg-orange-500 text-white'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  지번주소
                </button>
                <button
                  onClick={() => {
                    setBillAddressSearchType('street');
                    setBillAddressResults([]);
                    setBillStreetResults([]);
                  }}
                  className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${
                    billAddressSearchType === 'street'
                      ? 'bg-orange-500 text-white'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  도로명주소
                </button>
              </div>
            </div>

            {/* 검색 입력 */}
            <div className="p-3 border-b border-gray-200 flex-shrink-0">
              {billAddressSearchType === 'post' ? (
                <div className="space-y-2">
                  <input
                    type="text"
                    value={billAddressSearchQuery}
                    onChange={(e) => setBillAddressSearchQuery(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && handleSearchBillPostAddress()}
                    placeholder="읍/면/동 이름 입력 (예: 역삼동)"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                  />
                </div>
              ) : (
                <div className="space-y-2">
                  <input
                    type="text"
                    value={billStreetSearchForm.streetNm}
                    onChange={(e) => setBillStreetSearchForm(prev => ({ ...prev, streetNm: e.target.value }))}
                    onKeyPress={(e) => e.key === 'Enter' && handleSearchBillStreetAddress()}
                    placeholder="도로명 입력 (예: 테헤란로)"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                  />
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={billStreetSearchForm.streetBunM}
                      onChange={(e) => setBillStreetSearchForm(prev => ({ ...prev, streetBunM: e.target.value.replace(/[^0-9]/g, '') }))}
                      placeholder="건물본번"
                      className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                    />
                    <input
                      type="text"
                      value={billStreetSearchForm.streetBunS}
                      onChange={(e) => setBillStreetSearchForm(prev => ({ ...prev, streetBunS: e.target.value.replace(/[^0-9]/g, '') }))}
                      placeholder="건물부번"
                      className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                    />
                  </div>
                  <input
                    type="text"
                    value={billStreetSearchForm.buildNm}
                    onChange={(e) => setBillStreetSearchForm(prev => ({ ...prev, buildNm: e.target.value }))}
                    placeholder="건물명 (선택)"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                  />
                </div>
              )}

              <button
                onClick={billAddressSearchType === 'post' ? handleSearchBillPostAddress : handleSearchBillStreetAddress}
                disabled={isSearchingBillAddress}
                className="w-full mt-3 flex items-center justify-center gap-2 py-2.5 bg-orange-500 text-white rounded-lg hover:bg-orange-600 disabled:bg-gray-400 transition-colors"
              >
                {isSearchingBillAddress ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    검색 중...
                  </>
                ) : (
                  <>
                    <Search className="w-4 h-4" />
                    검색
                  </>
                )}
              </button>
            </div>

            {/* 검색 결과 */}
            <div className="flex-1 overflow-y-auto p-3 min-h-0">
              {billAddressSearchType === 'post' ? (
                billAddressResults.length > 0 ? (
                  <div className="space-y-2">
                    <div className="text-xs text-gray-500 mb-2">검색 결과: {billAddressResults.length}건</div>
                    {billAddressResults.map((addr, idx) => (
                      <button
                        key={addr.POST_ID || idx}
                        onClick={() => handleSelectBillPostAddress(addr)}
                        className="w-full p-3 bg-gray-50 hover:bg-orange-50 rounded-lg border border-gray-200 hover:border-orange-300 text-left transition-colors"
                      >
                        <div className="text-sm font-medium text-gray-900">{addr.ADDR_FULL || addr.ADDR}</div>
                        <div className="mt-1 text-xs text-gray-500">
                          우편번호: {addr.ZIP_CD} | {addr.SIDO_NAME} {addr.GUGUN_NM} {addr.DONGMYON_NM}
                        </div>
                      </button>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8 text-gray-400 text-sm">
                    읍/면/동 이름을 입력하고 검색하세요.
                  </div>
                )
              ) : (
                billStreetResults.length > 0 ? (
                  <div className="space-y-2">
                    <div className="text-xs text-gray-500 mb-2">검색 결과: {billStreetResults.length}건</div>
                    {billStreetResults.map((addr, idx) => (
                      <button
                        key={addr.STREET_ID || idx}
                        onClick={() => handleSelectBillStreetAddress(addr)}
                        className="w-full p-3 bg-gray-50 hover:bg-orange-50 rounded-lg border border-gray-200 hover:border-orange-300 text-left transition-colors"
                      >
                        <div className="text-sm font-medium text-gray-900">{addr.STREET_ADDR}</div>
                        <div className="mt-1 text-xs text-gray-500">
                          우편번호: {addr.ZIP_CD} | {addr.ADDR_FULL}
                        </div>
                        {addr.BLD_NM && (
                          <div className="mt-0.5 text-xs text-orange-600">건물명: {addr.BLD_NM}</div>
                        )}
                      </button>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8 text-gray-400 text-sm">
                    도로명과 건물번호를 입력하고 검색하세요.
                  </div>
                )
              )}
            </div>

            {/* 하단 버튼 */}
            <div className="p-3 border-t border-gray-200 flex-shrink-0">
              <button
                onClick={handleCloseBillAddressModal}
                className="w-full py-2.5 bg-gray-100 text-gray-600 rounded-lg hover:bg-gray-200 transition-colors"
              >
                닫기
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CustomerInfoChange;
