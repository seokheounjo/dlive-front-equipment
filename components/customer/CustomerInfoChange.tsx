import React, { useState, useEffect } from 'react';
import {
  Phone, MapPin, Edit2, X, Loader2,
  ChevronDown, ChevronUp, AlertCircle, Check, Search,
  Smartphone, RefreshCw, CreditCard, Building2, Shield, PenTool
} from 'lucide-react';
import SignaturePad from '../common/SignaturePad';
import ConfirmModal, { UseConfirmState, useConfirmInitialState } from '../common/ConfirmModal';
import {
  updatePhoneNumber,
  validatePhoneNumber,
  splitPhoneNumber,
  updateAddress,
  updateInstallAddress,
  getTelecomCodes,
  getHPPayList,
  formatPhoneNumber,
  PhoneChangeRequest,
  AddressChangeRequest,
  InstallAddressChangeRequest,
  HPPayInfo,
  getPaymentAccounts,
  PaymentAccountInfo,
  updatePaymentMethod,
  verifyBankAccount,
  verifyCard,
  searchPostAddress,
  searchStreetAddress,
  PostAddressInfo,
  StreetAddressInfo,
  registerConsultation,
  ConsultationRequest,
  saveHPPayInfo,
  getBankCodesDLive,
  getCardCompanyCodes,
  getPayerRelationCodes,
  getIdTypeCodes
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
}

// 전화번호 항목 타입 (customerApi.ts와 동일)
interface PhoneItem {
  type: 'tel' | 'hp';
  typeNm: string;
  number: string;
  fieldName: string;
}

interface CustomerInfoChangeProps {
  onBack: () => void;
  showToast?: (message: string, type: 'success' | 'error' | 'warning' | 'info') => void;
  selectedCustomer: {
    custId: string;
    custNm: string;
    telNo: string;   // 전화번호
    hpNo: string;    // 휴대폰번호
    phoneList?: PhoneItem[];  // 전화번호 목록 (다중)
  } | null;
  // 선택된 계약 정보 (설치주소 변경에 필요)
  selectedContract?: {
    ctrtId: string;
    prodNm: string;
    instAddr: string;
    streetAddr?: string;    // 도로명주소
    instlLoc?: string;      // 설치위치 (거실, 안방 등)
    postId?: string;
    soId?: string;          // 지점ID (주소검색 지역 제한용)
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
  selectedContract,
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
    telNoType: 'hp' as 'tel' | 'hp',  // 변경할 번호 유형: tel=전화번호, hp=휴대폰번호
    telNo: '',
    telTpCd: '',  // 통신사
    disconnYn: 'N'  // 결번여부
  });
  const [telecomCodes, setTelecomCodes] = useState<TelecomCode[]>([]);

  // 주소 변경 - 중분류 탭 (설치주소 변경 / 설치위치 변경)
  const [addressSubTab, setAddressSubTab] = useState<'address' | 'location'>('address');

  // 기존 설치 정보 (저장 완료 시 최신화)
  const [currentInstallInfo, setCurrentInstallInfo] = useState({
    addr: '',       // 기존 설치주소
    instlLoc: ''    // 기존 설치위치
  });

  // 청구지주소 변경 가능 여부 (API 응답에 따라 설정)
  const [canChangeBillAddr, setCanChangeBillAddr] = useState(false);

  // 주소 변경 폼
  const [addressForm, setAddressForm] = useState({
    zipCd: '',
    addr1: '',
    addr2: '',
    instlLoc: '',           // 설치위치 (거실, 안방 등)
    changeBillAddr: false,  // 청구지주소 함께 변경
    // 주소 검색 결과에서 가져오는 추가 정보
    postId: '',             // 주소ID (POST_ID)
    streetId: '',           // 도로명ID (STREET_ID)
    dongmyonNm: '',         // 읍면동명 (DONGMYON_NM)
    bldCl: '0',             // 건물구분 (0:일반, 1:건물, 2:아파트)
    bldNm: '',              // 건물명
    bunNo: '',              // 본번
    hoNm: ''                // 부번(호명)
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
  const [paymentInfoList, setPaymentInfoList] = useState<PaymentAccountInfo[]>([]);
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
    pymDay: ''                // 결제일
  };

  // 저장된 값이 있으면 사용, 없으면 기본값
  const [paymentForm, setPaymentForm] = useState<PaymentFormData>(savedPaymentForm || defaultPaymentForm);
  const [isVerifying, setIsVerifying] = useState(false);
  const [isVerified, setIsVerified] = useState(savedIsVerified);
  const [isSavingPayment, setIsSavingPayment] = useState(false);

  // 서명 관련 상태
  const [showSignatureModal, setShowSignatureModal] = useState(false);
  const [signatureData, setSignatureData] = useState<string | null>(null);

  // 납부계정 전환 확인 모달
  const [showSwitchConfirm, setShowSwitchConfirm] = useState(false);
  const [pendingSwitchPymAcntId, setPendingSwitchPymAcntId] = useState<string>('');

  // 휴대폰결제 신청/해지 확인 모달
  const [confirmModal, setConfirmModal] = useState<UseConfirmState>(useConfirmInitialState);

  // 알림 모달 (Toast 대체)
  const [alertModal, setAlertModal] = useState<{
    isOpen: boolean;
    message: string;
    type: 'success' | 'error' | 'warning' | 'info';
  }>({ isOpen: false, message: '', type: 'info' });

  // showToast 대체 함수 (모달로 표시)
  const showAlert = (message: string, type: 'success' | 'error' | 'warning' | 'info' = 'info') => {
    setAlertModal({ isOpen: true, message, type });
  };

  // 폼이 수정되었는지 확인하는 함수
  const isPaymentFormDirty = (): boolean => {
    // 기본 폼값과 비교하여 변경 여부 확인
    return paymentForm.acntHolderNm !== '' ||
           paymentForm.birthDt !== '' ||
           paymentForm.bankCd !== '' ||
           paymentForm.acntNo !== '' ||
           paymentForm.changeReasonL !== '' ||
           isVerified;
  };

  // 납부계정 전환 핸들러
  const handlePaymentAccountClick = (newPymAcntId: string) => {
    console.log('[납부계정 전환] 클릭:', newPymAcntId);
    console.log('[납부계정 전환] 현재 선택:', selectedPymAcntId);
    console.log('[납부계정 전환] 폼 더티:', isPaymentFormDirty());

    // 같은 계정 클릭 시 무시
    if (newPymAcntId === selectedPymAcntId) {
      console.log('[납부계정 전환] 같은 계정 - 무시');
      return;
    }

    // 현재 작성 중인 내용이 있으면 확인 모달 표시
    if (selectedPymAcntId && isPaymentFormDirty()) {
      console.log('[납부계정 전환] 작성 중 - 모달 표시');
      setPendingSwitchPymAcntId(newPymAcntId);
      setShowSwitchConfirm(true);
      return;
    }

    // 작성 중인 내용이 없으면 바로 전환
    console.log('[납부계정 전환] 바로 전환');
    switchPaymentAccount(newPymAcntId);
  };

  // 실제 계정 전환 실행
  const switchPaymentAccount = (newPymAcntId: string) => {
    console.log('[납부계정 전환] 실행:', newPymAcntId);
    console.log('[납부계정 전환] 폼 초기화 전:', paymentForm.acntHolderNm);
    // 폼 초기화 - 새 객체로 확실히 리셋
    const resetForm = { ...defaultPaymentForm };
    setPaymentForm(resetForm);
    setIsVerified(false);
    setSelectedPymAcntId(newPymAcntId);
    onPaymentChangeStart?.();
    setShowSwitchConfirm(false);
    setPendingSwitchPymAcntId('');
    console.log('[납부계정 전환] 폼 초기화 완료');
  };

  // 주소 검색 모달
  const [showAddressModal, setShowAddressModal] = useState(false);
  const [addressSearchType, setAddressSearchType] = useState<'post' | 'street'>('post');
  const [addressSearchQuery, setAddressSearchQuery] = useState('');
  const [streetSearchForm, setStreetSearchForm] = useState({
    streetNm: '',      // 도로명
    streetBunM: '',    // 건물본번
    streetBunS: '',    // 건물부번
  });
  const [postAddressResults, setPostAddressResults] = useState<PostAddressInfo[]>([]);
  const [streetAddressResults, setStreetAddressResults] = useState<StreetAddressInfo[]>([]);
  const [isSearchingAddress, setIsSearchingAddress] = useState(false);
  const [selectedPostId, setSelectedPostId] = useState<string>('');

  // 코드 데이터 (API에서 로드)
  const [bankCodes, setBankCodes] = useState<{ CODE: string; CODE_NM: string }[]>([]);
  const [cardCompanyCodes, setCardCompanyCodes] = useState<{ CODE: string; CODE_NM: string }[]>([]);
  const [changeReasonLargeCodes, setChangeReasonLargeCodes] = useState<{ CODE: string; CODE_NM: string }[]>([]);
  const [changeReasonMiddleCodes, setChangeReasonMiddleCodes] = useState<Record<string, { CODE: string; CODE_NM: string }[]>>({});
  const [idTypeCodes, setIdTypeCodes] = useState<{ CODE: string; CODE_NM: string }[]>([]);
  const [pyrRelCodes, setPyrRelCodes] = useState<{ CODE: string; CODE_NM: string }[]>([]);
  const [paymentDays, setPaymentDays] = useState<{ CODE: string; CODE_NM: string }[]>([]);

  // 코드 데이터 로드 (통신사, 은행, 카드사, 납부자관계, 신분유형 등)
  useEffect(() => {
    loadTelecomCodes();
    loadPaymentCodes();
  }, []);


  // 선택된 계약 변경 시 기존 설치정보 초기화
  useEffect(() => {
    if (selectedContract) {
      setCurrentInstallInfo({
        addr: selectedContract.streetAddr || selectedContract.instAddr || '',
        instlLoc: selectedContract.instlLoc || ''
      });
      // 청구지주소 변경 가능 여부 (납부계정 1개일 때만)
      setCanChangeBillAddr(paymentInfoList.length === 1);
    }
  }, [selectedContract, paymentInfoList.length]);

  // 납부폼 상태 변경 시 부모 컴포넌트에 동기화 (탭 전환 시 상태 유지)
  useEffect(() => {
    if (onPaymentFormChange) {
      onPaymentFormChange(paymentForm, selectedPymAcntId, isVerified);
    }
  }, [paymentForm, selectedPymAcntId, isVerified]);

  // API 응답 매핑 헬퍼 (code, name → CODE, CODE_NM)
  const mapApiCodes = (data: any[]) => data
    .filter((item: any) => item.code && item.code !== '[]' && item.name !== '선택')
    .map((item: any) => ({
      CODE: item.code || item.CODE,
      CODE_NM: item.name || item.CODE_NM,
      ref_code: item.ref_code || ''
    }));

  const loadTelecomCodes = async () => {
    setIsLoadingCodes(true);
    try {
      const response = await getTelecomCodes();
      if (response.success && response.data) {
        setTelecomCodes(mapApiCodes(response.data));
      }
    } catch (error) {
      console.error('Load telecom codes error:', error);
    } finally {
      setIsLoadingCodes(false);
    }
  };

  // 납부 관련 코드 로드 (은행, 카드사, 납부자관계, 신분유형, 결제일, 변경사유)
  const loadPaymentCodes = async () => {
    try {
      const [bankRes, cardRes, pyrRelRes, idTypeRes] = await Promise.all([
        getBankCodesDLive(),      // BLPY015 (은행)
        getCardCompanyCodes(),    // BLPY016 (카드사)
        getPayerRelationCodes(),  // CMCU005 (납부자관계)
        getIdTypeCodes(),         // CMCU002 (신분유형)
      ]);

      if (bankRes.success && bankRes.data) {
        setBankCodes(mapApiCodes(bankRes.data));
      }
      if (cardRes.success && cardRes.data) {
        setCardCompanyCodes(mapApiCodes(cardRes.data));
      }
      if (pyrRelRes.success && pyrRelRes.data) {
        setPyrRelCodes(mapApiCodes(pyrRelRes.data));
      }
      if (idTypeRes.success && idTypeRes.data) {
        setIdTypeCodes(mapApiCodes(idTypeRes.data));
      }

      // 변경사유 및 결제일 - D'Live 공통코드에 해당 CODE_GROUP이 없어 기본값 설정
      // 추후 D'Live 공통코드 테이블에 추가 시 API 로드로 전환 가능
      setChangeReasonLargeCodes([
        { CODE: '01', CODE_NM: '개인사정' },
        { CODE: '02', CODE_NM: '요금관련' },
        { CODE: '03', CODE_NM: '서비스관련' },
        { CODE: '04', CODE_NM: '기타' }
      ]);
      setChangeReasonMiddleCodes({
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
      });
      setPaymentDays([
        { CODE: '05', CODE_NM: '5일' },
        { CODE: '10', CODE_NM: '10일' },
        { CODE: '15', CODE_NM: '15일' },
        { CODE: '20', CODE_NM: '20일' },
        { CODE: '25', CODE_NM: '25일' },
        { CODE: '27', CODE_NM: '27일' }
      ]);
    } catch (error) {
      console.error('Load payment codes error:', error);
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
      const response = await getPaymentAccounts(selectedCustomer.custId);
      if (response.success && response.data) {
        setPaymentInfoList(response.data);
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
        // 은행 계좌 인증
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
        // 카드 인증
        if (!paymentForm.cardExpMm || !paymentForm.cardExpYy) {
          showAlert('카드 유효기간을 입력해주세요.', 'warning');
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

  // 납부방법 변경 저장
  // 서명 완료 후 실제 저장
  const handleSignatureComplete = async (signature: string) => {
    setShowSignatureModal(false);
    setSignatureData(signature);

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
        PYM_DAY: paymentForm.pymDay,
        // 서명 데이터
        SIGNATURE: signature
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

      const response = await updatePaymentMethod(params);

      if (response.success) {
        showAlert('납부방법이 변경되었습니다.', 'success');
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
          pymDay: ''
        });
        setIsVerified(false);
        setSignatureData(null);
        onPaymentChangeEnd?.();
        // 납부정보 다시 로드
        loadPaymentInfo();
      } else {
        showAlert(response.message || '납부방법 변경에 실패했습니다.', 'error');
      }
    } catch (error) {
      console.error('Save payment error:', error);
      showAlert('납부방법 변경 중 오류가 발생했습니다.', 'error');
    } finally {
      setIsSavingPayment(false);
    }
  };

  // 납부방법 변경 저장 (서명 모달 표시)
  const handleSavePayment = () => {
    if (!selectedPymAcntId) {
      showAlert('납부계정을 선택해주세요.', 'warning');
      return;
    }
    if (!isVerified) {
      showAlert('먼저 계좌/카드 인증을 완료해주세요.', 'warning');
      return;
    }
    if (!paymentForm.changeReasonL || !paymentForm.changeReasonM) {
      showAlert('변경사유를 선택해주세요.', 'warning');
      return;
    }
    if (!paymentForm.birthDt || paymentForm.birthDt.length !== 8) {
      showAlert('생년월일을 정확히 입력해주세요.', 'warning');
      return;
    }
    if (!paymentForm.pyrRel) {
      showAlert('납부자관계를 선택해주세요.', 'warning');
      return;
    }

    // 서명 모달 표시
    setShowSignatureModal(true);
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

  // 휴대폰결제 신청/해지 실제 처리
  const executeHpPayChange = async (item: HPPayInfo, actionText: string) => {
    if (!selectedCustomer) return;

    const isApply = actionText === '신청';
    const userInfo = JSON.parse(sessionStorage.getItem('userInfo') || localStorage.getItem('userInfo') || '{}');

    try {
      // 1차: 직접 HP Pay 상태 변경 API 호출
      const saveParams = {
        CUST_ID: selectedCustomer.custId,
        CTRT_ID: item.CTRT_ID,
        HP_PAY_STAT: isApply ? 'Y' : 'N',
        SO_ID: selectedContract?.soId || userInfo.soId || '',
        MST_SO_ID: userInfo.mstSoId || '200',
        USR_ID: userInfo.userId || userInfo.USR_ID || ''
      };

      const response = await saveHPPayInfo(saveParams);

      if (response.success) {
        showAlert(`휴대폰결제 ${actionText} 완료되었습니다.`, 'success');
        loadHpPayList();
        return;
      }

      // 2차: 직접 변경 실패 시 상담 등록으로 폴백
      console.warn('HP Pay direct save failed, falling back to consultation:', response.message);
      const consultParams: Partial<ConsultationRequest> = {
        CUST_ID: selectedCustomer.custId,
        CTRT_ID: item.CTRT_ID,
        CNSL_MST_CL: '04',
        CNSL_MID_CL: '0401',
        CNSL_SLV_CL: '040101',
        REQ_CTX: `[휴대폰결제 ${actionText} 요청]\n상품: ${item.PROD_NM}\n계약ID: ${item.CTRT_ID}\n현재상태: ${item.HP_STAT || '미신청'}\n요청: ${actionText}`
      };

      const consultResponse = await registerConsultation(consultParams as ConsultationRequest);
      if (consultResponse.success) {
        showAlert(`휴대폰결제 ${actionText} 상담이 접수되었습니다. 담당자 확인 후 처리됩니다.`, 'info');
        loadHpPayList();
      } else {
        showAlert(consultResponse.message || `${actionText} 요청에 실패했습니다.`, 'error');
      }
    } catch (error) {
      console.error('HP Pay change error:', error);
      showAlert(`${actionText} 요청 중 오류가 발생했습니다.`, 'error');
    }
  };

  // 휴대폰결제: 신청/해지 그룹 분리
  const filteredHpPayList = hpPayList.filter(item => item.CTRT_STAT_NM === '사용중');
  const hpPayApplyList = filteredHpPayList.filter(item => item.HP_STAT !== '신청');  // 해제 상태 → 신청 대상
  const hpPayCancelList = filteredHpPayList.filter(item => item.HP_STAT === '신청'); // 신청 상태 → 해지 대상
  const [hpPayApplySelected, setHpPayApplySelected] = useState<Set<string>>(new Set());
  const [hpPayCancelSelected, setHpPayCancelSelected] = useState<Set<string>>(new Set());

  const handleHpPayGroupSelect = (group: 'apply' | 'cancel', checked: boolean) => {
    if (group === 'apply') {
      setHpPayApplySelected(checked ? new Set(hpPayApplyList.map(i => i.CTRT_ID)) : new Set());
    } else {
      setHpPayCancelSelected(checked ? new Set(hpPayCancelList.map(i => i.CTRT_ID)) : new Set());
    }
  };
  const handleHpPayItemSelect = (group: 'apply' | 'cancel', ctrtId: string, checked: boolean) => {
    const setter = group === 'apply' ? setHpPayApplySelected : setHpPayCancelSelected;
    setter(prev => {
      const next = new Set(prev);
      if (checked) next.add(ctrtId); else next.delete(ctrtId);
      return next;
    });
  };

  // 휴대폰결제 일괄 신청
  const handleHpPayBulkApply = async () => {
    if (hpPayApplySelected.size === 0) {
      showAlert('신청할 항목을 선택해주세요.', 'warning');
      return;
    }
    const targets = hpPayApplyList.filter(item => hpPayApplySelected.has(item.CTRT_ID));
    setConfirmModal({
      isOpen: true,
      title: '휴대폰결제 일괄 신청',
      message: `${targets.length}건을 신청하시겠습니까?`,
      type: 'confirm',
      onConfirm: async () => {
        for (const item of targets) {
          await executeHpPayChange(item, '신청');
        }
        setHpPayApplySelected(new Set());
      }
    });
  };

  // 휴대폰결제 일괄 해지
  const handleHpPayBulkCancel = async () => {
    if (hpPayCancelSelected.size === 0) {
      showAlert('해지할 항목을 선택해주세요.', 'warning');
      return;
    }
    const targets = hpPayCancelList.filter(item => hpPayCancelSelected.has(item.CTRT_ID));
    setConfirmModal({
      isOpen: true,
      title: '휴대폰결제 일괄 해지',
      message: `${targets.length}건을 해지하시겠습니까?`,
      type: 'confirm',
      onConfirm: async () => {
        for (const item of targets) {
          await executeHpPayChange(item, '해지');
        }
        setHpPayCancelSelected(new Set());
      }
    });
  };

  // 휴대폰결제 신청/해지 처리 (확인 모달 표시)
  const handleHpPayChange = (item: HPPayInfo) => {
    if (!selectedCustomer) {
      showAlert('고객 정보가 없습니다.', 'warning');
      return;
    }

    const isApply = item.HP_STAT !== '신청';
    const actionText = isApply ? '신청' : '해지';

    // ConfirmModal 표시
    setConfirmModal({
      isOpen: true,
      title: `휴대폰결제 ${actionText}`,
      message: `${item.PROD_NM || '해당 상품'}의 휴대폰결제를 ${actionText}하시겠습니까?\n\n상담 접수 후 처리됩니다.`,
      type: 'confirm',
      onConfirm: () => executeHpPayChange(item, actionText)
    });
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
      showAlert('먼저 고객을 선택해주세요.', 'warning');
      return;
    }

    const telNo = phoneForm.telNo.replace(/[^0-9]/g, '');

    // 결번이 아닌 경우에만 전화번호 검증 (결번은 기존 번호에 NO_SVC_YN='Y'만 설정)
    if (phoneForm.disconnYn !== 'Y') {
      const validationError = validatePhoneNumber(telNo, phoneForm.telNoType);
      if (validationError) {
        showAlert(validationError, 'warning');
        return;
      }
    } else if (!telNo) {
      showAlert('전화번호를 입력하세요.', 'warning');
      return;
    }

    setIsSavingPhone(true);
    try {
      // 전화번호 분리 (02→2자리, 0130→4자리, 나머지→3자리 DDD)
      const { ddd: telDdd, fix: telFix, dtl: telDtl } = splitPhoneNumber(telNo);

      // TEL_NO_TP: '1'=전화번호, '2'=휴대폰번호
      const telNoTp = phoneForm.telNoType === 'tel' ? '1' : '2';
      const phoneTypeLabel = phoneForm.telNoType === 'tel' ? '전화번호' : '휴대폰번호';

      // 기존 전화번호 (UPDATE 대상 식별용)
      const existingTelNo = phoneForm.telNoType === 'tel'
        ? selectedCustomer.telNo?.replace(/[^0-9]/g, '') || ''
        : selectedCustomer.hpNo?.replace(/[^0-9]/g, '') || '';

      const params: PhoneChangeRequest = {
        CUST_ID: selectedCustomer.custId,
        TEL_NO: existingTelNo,
        TEL_DDD: telDdd,
        TEL_FIX: telFix,
        TEL_DTL: telDtl,
        MB_CORP_TP: phoneForm.telTpCd,
        NO_SVC_YN: phoneForm.disconnYn,
        TEL_NO_TP: telNoTp,
        USE_YN: 'Y',
        CTRT_ID: selectedContract?.ctrtId || '',
        MAIN_TEL_YN: 'N',
        CHG_UID: ''
      };

      const response = await updatePhoneNumber(params);

      if (response.success) {
        showAlert(`${phoneTypeLabel}가 변경되었습니다.`, 'success');
        setPhoneForm({ telNoType: 'hp', telNo: '', telTpCd: '', disconnYn: 'N' });
      } else {
        showAlert(response.message || '전화번호 변경에 실패했습니다.', 'error');
      }
    } catch (error) {
      console.error('Update phone error:', error);
      showAlert('전화번호 변경 중 오류가 발생했습니다.', 'error');
    } finally {
      setIsSavingPhone(false);
    }
  };

  // 설치주소 변경 저장
  const handleSaveAddress = async () => {
    if (!selectedContract?.ctrtId) {
      showAlert('기본조회 탭에서 계약을 선택한 후 진행해주세요.', 'warning');
      return;
    }

    if (!addressForm.zipCd || !addressForm.addr1) {
      showAlert('우편번호와 기본주소를 입력해주세요.', 'warning');
      return;
    }
    if (!addressForm.postId) {
      showAlert('주소 검색 후 주소를 선택해주세요.', 'warning');
      return;
    }

    setIsSavingAddress(true);
    try {
      // ADDR_DTL은 상세주소만 전달 (기본주소는 POST_ID로 결정됨)
      // 기본주소까지 넣으면 ADDR_FULL에서 중복 발생
      const installParams: InstallAddressChangeRequest = {
        CTRT_ID: selectedContract.ctrtId,
        POST_ID: addressForm.postId,
        BLD_CL: addressForm.bldCl || '0',
        BLD_NM: addressForm.bldNm || '',
        BUN_NO: addressForm.bunNo || '',
        HO_NM: addressForm.hoNm || '',
        ADDR_DTL: addressForm.addr2 || '',
        STREET_ID: addressForm.streetId || undefined,
        INSTL_LOC: currentInstallInfo.instlLoc || undefined,
        CUST_FLAG: '0',
        PYM_FLAG: addressForm.changeBillAddr ? '1' : '0'
      };

      const response = await updateInstallAddress(installParams);

      if (response.success) {
        showAlert('설치주소가 변경되었습니다.', 'success');

        const newAddr = `${addressForm.addr1}${addressForm.addr2 ? ' ' + addressForm.addr2 : ''}`;
        setCurrentInstallInfo(prev => ({ ...prev, addr: newAddr }));

        setAddressForm({
          zipCd: '',
          addr1: '',
          addr2: '',
          instlLoc: '',
          changeBillAddr: false,
          postId: '',
          streetId: '',
          dongmyonNm: '',
          bldCl: '0',
          bldNm: '',
          bunNo: '',
          hoNm: ''
        });
        setSelectedPostId('');
      } else {
        showAlert(response.message || '주소 변경에 실패했습니다.', 'error');
      }
    } catch (error) {
      console.error('Update address error:', error);
      showAlert('주소 변경 중 오류가 발생했습니다.', 'error');
    } finally {
      setIsSavingAddress(false);
    }
  };

  // 설치위치 변경 저장
  const [isSavingLocation, setIsSavingLocation] = useState(false);
  const [locationForm, setLocationForm] = useState('');

  const handleSaveLocation = async () => {
    if (!selectedContract?.ctrtId) {
      showAlert('기본조회 탭에서 계약을 선택한 후 진행해주세요.', 'warning');
      return;
    }
    if (!locationForm) {
      showAlert('변경할 설치위치를 입력해주세요.', 'warning');
      return;
    }

    setIsSavingLocation(true);
    try {
      const installParams: InstallAddressChangeRequest = {
        CTRT_ID: selectedContract.ctrtId,
        POST_ID: selectedContract.postId || '',
        ADDR_DTL: '',
        INSTL_LOC: locationForm,
        CUST_FLAG: '0',
        PYM_FLAG: '0'
      };

      const response = await updateInstallAddress(installParams);

      if (response.success) {
        showAlert('설치위치가 변경되었습니다.', 'success');
        setCurrentInstallInfo(prev => ({ ...prev, instlLoc: locationForm }));
        setLocationForm('');
      } else {
        showAlert(response.message || '설치위치 변경에 실패했습니다.', 'error');
      }
    } catch (error) {
      console.error('Update location error:', error);
      showAlert('설치위치 변경 중 오류가 발생했습니다.', 'error');
    } finally {
      setIsSavingLocation(false);
    }
  };

  // 주소 검색 모달 열기
  const handleOpenAddressModal = () => {
    setShowAddressModal(true);
    setAddressSearchQuery('');
    setStreetSearchForm({ streetNm: '', streetBunM: '', streetBunS: '' });
    setPostAddressResults([]);
    setStreetAddressResults([]);
  };

  // 주소 검색 모달 닫기
  const handleCloseAddressModal = () => {
    setShowAddressModal(false);
    setPostAddressResults([]);
    setStreetAddressResults([]);
  };

  // 주소 필터링 함수 (클라이언트 폴백용)
  const filterAddressList = (list: PostAddressInfo[], searchTerm: string): PostAddressInfo[] => {
    const term = searchTerm.toLowerCase();
    return list.filter((item: PostAddressInfo) => {
      const dongmyonNm = (item.DONGMYON_NM || '').toLowerCase();
      const addr = (item.ADDR || '').toLowerCase();
      const gugunNm = (item.GUGUN_NM || '').toLowerCase();
      const bldNm = (item.BLD_NM || '').toLowerCase();

      return dongmyonNm.includes(term) ||
             addr.includes(term) ||
             gugunNm.includes(term) ||
             bldNm.includes(term);
    });
  };

  // 지번주소 검색 (서버 필터링 + 클라이언트 폴백)
  const handleSearchPostAddress = async () => {
    if (!addressSearchQuery || addressSearchQuery.length < 2) {
      showAlert('동/면 이름을 2자 이상 입력해주세요.', 'warning');
      return;
    }

    setIsSearchingAddress(true);
    try {
      // 계약의 SO_ID로 해당 지역만 조회 (송파 계약이면 송파만)
      const contractSoId = selectedContract?.soId || '';
      const response = await searchPostAddress({
        DONGMYONG: addressSearchQuery,
        ...(contractSoId ? { SO_ID: contractSoId } : {})
      });

      if (response.success && response.data) {
        let results = response.data;

        // 서버는 SO_ID 지역 전체 주소 반환 → 항상 클라이언트 필터링 적용
        if (results.length > 0) {
          const filtered = filterAddressList(results, addressSearchQuery);
          console.log(`[AddressSearch] 필터링: ${results.length}건 → ${filtered.length}건 (검색어: ${addressSearchQuery})`);
          results = filtered;
        }

        setPostAddressResults(results);
        if (results.length === 0) {
          showAlert('검색 결과가 없습니다.', 'info');
        }
        // 검색 결과가 있으면 목록이 바로 보이므로 Toast 불필요
      } else {
        showAlert(response.message || '주소 검색에 실패했습니다.', 'error');
        setPostAddressResults([]);
      }
    } catch (error) {
      console.error('Search post address error:', error);
      showAlert('주소 검색 중 오류가 발생했습니다.', 'error');
      setPostAddressResults([]);
    } finally {
      setIsSearchingAddress(false);
    }
  };

  // 도로명주소 검색 (.req 서블릿 호출)
  const handleSearchStreetAddress = async () => {
    if (!streetSearchForm.streetNm || streetSearchForm.streetNm.length < 2) {
      showAlert('도로명을 2자 이상 입력해주세요.', 'warning');
      return;
    }

    setIsSearchingAddress(true);
    try {
      const response = await searchStreetAddress({
        STREET_NM: streetSearchForm.streetNm,
        STREET_BUN_M: streetSearchForm.streetBunM || '',
        STREET_BUN_S: streetSearchForm.streetBunS || '',
        SO_ID: selectedContract?.soId || ''
      });

      if (response.success && response.data) {
        setStreetAddressResults(response.data);
        if (response.data.length === 0) {
          showAlert('검색 결과가 없습니다.', 'info');
        }
      } else {
        showAlert(response.message || '도로명주소 검색에 실패했습니다.', 'warning');
        setStreetAddressResults([]);
      }
    } catch (error) {
      console.error('Search street address error:', error);
      showAlert('주소 검색 중 오류가 발생했습니다.', 'error');
      setStreetAddressResults([]);
    } finally {
      setIsSearchingAddress(false);
    }
  };

  // 지번주소 선택
  const handleSelectPostAddress = (addr: PostAddressInfo) => {
    // 건물구분: 건물명이 있으면 '1'(건물), 아파트면 '2', 없으면 '0'(일반)
    const bldCl = addr.BLD_NM
      ? (addr.BLD_NM.includes('아파트') || addr.BLD_NM.includes('APT') ? '2' : '1')
      : '0';
    setAddressForm(prev => ({
      ...prev,
      zipCd: addr.ZIP_CD,
      addr1: addr.ADDR_FULL || addr.ADDR,
      addr2: '',
      postId: addr.POST_ID,
      streetId: '',  // 지번주소는 도로명ID 없음
      dongmyonNm: addr.DONGMYON_NM || '',
      bldCl,
      bldNm: addr.BLD_NM || '',
      bunNo: addr.STRT_BUNGIHO || '',
      hoNm: ''
    }));
    setSelectedPostId(addr.POST_ID);
    handleCloseAddressModal();
    showAlert('주소가 입력되었습니다. 상세주소를 입력해주세요.', 'info');
  };

  // 도로명주소 선택
  const handleSelectStreetAddress = (addr: StreetAddressInfo) => {
    // 건물구분: 건물명이 있으면 '1'(건물), 아파트면 '2', 없으면 '0'(일반)
    const bldCl = addr.BLD_NM
      ? (addr.BLD_NM.includes('아파트') || addr.BLD_NM.includes('APT') ? '2' : '1')
      : '0';
    setAddressForm(prev => ({
      ...prev,
      zipCd: addr.ZIP_CD,
      addr1: addr.STREET_ADDR || addr.ADDR_FULL,
      addr2: '',
      postId: addr.POST_ID,
      streetId: addr.STREET_ID,
      dongmyonNm: addr.DONGMYON_NM || addr.NM_SMALL || '',
      bldCl,
      bldNm: addr.BLD_NM || '',
      bunNo: addr.BUN_NO || '',
      hoNm: addr.HO_NM || ''
    }));
    setSelectedPostId(addr.POST_ID);
    handleCloseAddressModal();
    showAlert('주소가 입력되었습니다. 상세주소를 입력해주세요.', 'info');
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
              {/* 현재 전화번호 목록 - 클릭하여 변경할 번호 선택 */}
              <div className="p-3 bg-gray-50 rounded-lg space-y-2">
                <div className="text-xs text-gray-500 mb-2 font-medium">변경할 번호 선택 (클릭)</div>
                {/* 다중 전화번호 지원 */}
                {selectedCustomer.phoneList && selectedCustomer.phoneList.length > 2 ? (
                  // 3개 이상일 때: 리스트 형태로 표시
                  <div className="space-y-2">
                    {selectedCustomer.phoneList.map((phone, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => setPhoneForm(prev => ({ ...prev, telNoType: phone.type }))}
                        className={`w-full p-2 rounded border flex justify-between items-center transition-colors ${
                          phoneForm.telNoType === phone.type
                            ? 'bg-blue-50 border-blue-500 ring-2 ring-blue-200'
                            : 'bg-white border-gray-200 hover:border-blue-300'
                        }`}
                      >
                        <div className={`text-xs ${phoneForm.telNoType === phone.type ? 'text-blue-600 font-medium' : 'text-gray-500'}`}>
                          {phone.typeNm}
                        </div>
                        <div className={`font-medium text-sm ${phoneForm.telNoType === phone.type ? 'text-blue-700' : 'text-gray-800'}`}>
                          {formatPhoneNumber(phone.number) || '-'}
                        </div>
                      </button>
                    ))}
                  </div>
                ) : (
                  // 2개 이하일 때: 기존 2열 그리드 형태 (클릭 가능)
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setPhoneForm(prev => ({ ...prev, telNoType: 'tel' }))}
                      className={`p-2 rounded border text-left transition-colors ${
                        phoneForm.telNoType === 'tel'
                          ? 'bg-blue-50 border-blue-500 ring-2 ring-blue-200'
                          : 'bg-white border-gray-200 hover:border-blue-300'
                      }`}
                    >
                      <div className={`text-xs ${phoneForm.telNoType === 'tel' ? 'text-blue-600 font-medium' : 'text-gray-500'}`}>
                        전화번호
                      </div>
                      <div className={`font-medium text-sm ${phoneForm.telNoType === 'tel' ? 'text-blue-700' : 'text-gray-800'}`}>
                        {formatPhoneNumber(selectedCustomer.telNo) || '-'}
                      </div>
                    </button>
                    <button
                      type="button"
                      onClick={() => setPhoneForm(prev => ({ ...prev, telNoType: 'hp' }))}
                      className={`p-2 rounded border text-left transition-colors ${
                        phoneForm.telNoType === 'hp'
                          ? 'bg-blue-50 border-blue-500 ring-2 ring-blue-200'
                          : 'bg-white border-gray-200 hover:border-blue-300'
                      }`}
                    >
                      <div className={`text-xs ${phoneForm.telNoType === 'hp' ? 'text-blue-600 font-medium' : 'text-gray-500'}`}>
                        휴대폰번호
                      </div>
                      <div className={`font-medium text-sm ${phoneForm.telNoType === 'hp' ? 'text-blue-700' : 'text-gray-800'}`}>
                        {formatPhoneNumber(selectedCustomer.hpNo) || '-'}
                      </div>
                    </button>
                  </div>
                )}
              </div>

              {/* 새 전화번호 입력 */}
              <div>
                <label className="block text-sm text-gray-600 mb-1">
                  새 {phoneForm.telNoType === 'tel' ? '전화번호' : '휴대폰번호'}
                </label>
                <input
                  type="tel"
                  value={phoneForm.telNo}
                  onChange={(e) => setPhoneForm(prev => ({
                    ...prev,
                    telNo: e.target.value.replace(/[^0-9]/g, '')
                  }))}
                  placeholder={phoneForm.telNoType === 'tel' ? '0212345678' : '01012345678'}
                  maxLength={12}
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
                  {telecomCodes.length === 0 && isLoadingCodes && (
                    <option value="" disabled>로딩중...</option>
                  )}
                </select>
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
                    {phoneForm.telNoType === 'tel' ? '전화번호' : '휴대폰번호'} 변경
                  </>
                )}
              </button>
            </div>
          )}
        </div>

        {/* 설치 주소/위치 변경 */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200">
          <button
            onClick={() => toggleSection('address')}
            className="w-full p-4 flex items-center justify-between text-left"
          >
            <div className="flex items-center gap-2">
              <MapPin className="w-5 h-5 text-green-500" />
              <span className="font-medium text-gray-800">설치 주소/위치 변경</span>
            </div>
            {expandedSections.address ? (
              <ChevronUp className="w-5 h-5 text-gray-400" />
            ) : (
              <ChevronDown className="w-5 h-5 text-gray-400" />
            )}
          </button>

          {expandedSections.address && (
            <div className="px-4 pb-4 space-y-4">
              {/* 계약 미선택 시 안내 */}
              {!selectedContract?.ctrtId ? (
                <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                  <div className="flex items-start gap-2">
                    <AlertCircle className="w-5 h-5 text-yellow-600 mt-0.5" />
                    <div>
                      <p className="text-sm font-medium text-yellow-700">계약을 먼저 선택해주세요</p>
                      <p className="text-xs text-yellow-600 mt-1">
                        기본조회 탭에서 계약을 선택한 후 주소/위치 변경이 가능합니다.
                      </p>
                    </div>
                  </div>
                </div>
              ) : (
                <>
                  {/* 기존 설치 정보 표시 */}
                  <div className="p-3 bg-gray-100 border border-gray-300 rounded-lg">
                    <div className="flex items-center gap-2 mb-2">
                      <Building2 className="w-4 h-4 text-gray-600" />
                      <span className="text-sm font-medium text-gray-700">현재 설치 정보</span>
                    </div>
                    <div className="text-sm text-gray-700 space-y-1">
                      <p><span className="text-gray-500">상품:</span> {selectedContract.prodNm}</p>
                      <p><span className="text-gray-500">설치주소:</span> {currentInstallInfo.addr || '-'}</p>
                      <p><span className="text-gray-500">설치위치:</span> {currentInstallInfo.instlLoc || '-'}</p>
                    </div>
                  </div>

                  {/* ── 설치주소 변경 ── */}
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
                      onChange={(e) => setAddressForm(prev => ({ ...prev, addr1: e.target.value }))}
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
                      onChange={(e) => setAddressForm(prev => ({ ...prev, addr2: e.target.value }))}
                      placeholder="상세주소 입력 (선택)"
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>

                  {/* 청구지주소 함께 변경 옵션 */}
                  <div className="p-3 bg-gray-50 border border-gray-200 rounded-lg">
                    <label className={`flex items-center gap-2 ${canChangeBillAddr ? 'cursor-pointer' : 'cursor-not-allowed opacity-50'}`}>
                      <input
                        type="checkbox"
                        checked={addressForm.changeBillAddr}
                        onChange={(e) => setAddressForm(prev => ({ ...prev, changeBillAddr: e.target.checked }))}
                        disabled={!canChangeBillAddr}
                        className="w-4 h-4 text-green-600 rounded"
                      />
                      <span className="text-sm text-gray-700">청구지주소도 함께 변경</span>
                      {!canChangeBillAddr && (
                        <span className="text-xs text-orange-500">
                          (납부계정 {paymentInfoList.length}개 - 단일 계정만 가능)
                        </span>
                      )}
                    </label>

                    {addressForm.changeBillAddr && canChangeBillAddr && (
                      <div className="mt-2 p-2 bg-blue-50 border border-blue-200 rounded text-xs">
                        <p className="text-blue-700">
                          <strong>현재 청구지:</strong> {(paymentInfoList[0] as any)?.BILL_ADDR || '설치주소와 동일하게 변경됩니다'}
                        </p>
                        <p className="text-blue-600 mt-1">
                          → 변경된 주소로 청구지도 함께 변경됩니다
                        </p>
                      </div>
                    )}
                  </div>

                  {/* 설치주소 변경 버튼 */}
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
                      '설치주소 변경'
                    )}
                  </button>

                  {/* ── 설치위치 변경 (별도 영역) ── */}
                  <div className="border-t border-gray-200 pt-4 space-y-3">
                    <div className="text-sm font-medium text-gray-700">설치위치 변경</div>
                    <div>
                      <input
                        type="text"
                        value={locationForm}
                        onChange={(e) => setLocationForm(e.target.value)}
                        placeholder={currentInstallInfo.instlLoc ? `현재: ${currentInstallInfo.instlLoc}` : '예: 거실, 안방, 침실 등'}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      />
                    </div>
                    <button
                      onClick={handleSaveLocation}
                      disabled={isSavingLocation}
                      className="w-full flex items-center justify-center gap-2 py-3 bg-green-500 text-white rounded-lg hover:bg-green-600 disabled:bg-gray-400 transition-colors"
                    >
                      {isSavingLocation ? (
                        <>
                          <Loader2 className="w-5 h-5 animate-spin" />
                          저장 중...
                        </>
                      ) : (
                        '설치위치 변경'
                      )}
                    </button>
                  </div>
                </>
              )}
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
              {!isLoadingHpPay && hpPayLoaded && filteredHpPayList.length === 0 && (
                <div className="text-center py-8 text-gray-500">
                  <Smartphone className="w-12 h-12 text-gray-300 mx-auto mb-2" />
                  <p>사용중인 휴대폰결제 내역이 없습니다.</p>
                </div>
              )}

              {/* 신청 그룹 (현재 해제 상태 → 신청 가능) */}
              {!isLoadingHpPay && hpPayApplyList.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="flex items-center gap-2 text-sm font-medium text-purple-700">
                      <input
                        type="checkbox"
                        checked={hpPayApplyList.length > 0 && hpPayApplySelected.size === hpPayApplyList.length}
                        onChange={(e) => handleHpPayGroupSelect('apply', e.target.checked)}
                        className="w-4 h-4 text-purple-600 rounded"
                      />
                      신청 대상 ({hpPayApplyList.length}건)
                    </label>
                    <button
                      onClick={handleHpPayBulkApply}
                      disabled={hpPayApplySelected.size === 0}
                      className="px-3 py-1 text-xs font-medium bg-purple-500 text-white rounded-lg hover:bg-purple-600 disabled:bg-gray-300 transition-colors"
                    >
                      선택 신청 ({hpPayApplySelected.size})
                    </button>
                  </div>
                  {hpPayApplyList.map((item, index) => (
                    <div
                      key={item.CTRT_ID || `apply-${index}`}
                      className={`p-3 rounded-lg border ${
                        hpPayApplySelected.has(item.CTRT_ID)
                          ? 'bg-purple-50 border-purple-300'
                          : 'bg-gray-50 border-gray-100'
                      }`}
                    >
                      <div className="flex items-center gap-2 mb-2">
                        <input
                          type="checkbox"
                          checked={hpPayApplySelected.has(item.CTRT_ID)}
                          onChange={(e) => handleHpPayItemSelect('apply', item.CTRT_ID, e.target.checked)}
                          className="w-4 h-4 text-purple-600 rounded flex-shrink-0"
                        />
                        <span className="font-medium text-gray-800 text-sm flex-1">
                          {item.PROD_NM || '상품명 없음'}
                        </span>
                        <span className="px-2 py-0.5 text-xs rounded-full flex-shrink-0 bg-orange-100 text-orange-700">
                          해제
                        </span>
                      </div>
                      <div className="text-xs text-gray-500 space-y-1 ml-6">
                        <div className="flex justify-between">
                          <span>계약ID:</span>
                          <span className="text-gray-700">{item.CTRT_ID}</span>
                        </div>
                        {item.ADDR && (
                          <div>
                            <span className="text-gray-400">설치주소: </span>
                            <span className="text-gray-700 break-all">{item.ADDR}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* 해지 그룹 (현재 신청 상태 → 해지 가능) */}
              {!isLoadingHpPay && hpPayCancelList.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="flex items-center gap-2 text-sm font-medium text-green-700">
                      <input
                        type="checkbox"
                        checked={hpPayCancelList.length > 0 && hpPayCancelSelected.size === hpPayCancelList.length}
                        onChange={(e) => handleHpPayGroupSelect('cancel', e.target.checked)}
                        className="w-4 h-4 text-green-600 rounded"
                      />
                      해지 대상 ({hpPayCancelList.length}건)
                    </label>
                    <button
                      onClick={handleHpPayBulkCancel}
                      disabled={hpPayCancelSelected.size === 0}
                      className="px-3 py-1 text-xs font-medium bg-red-500 text-white rounded-lg hover:bg-red-600 disabled:bg-gray-300 transition-colors"
                    >
                      선택 해지 ({hpPayCancelSelected.size})
                    </button>
                  </div>
                  {hpPayCancelList.map((item, index) => (
                    <div
                      key={item.CTRT_ID || `cancel-${index}`}
                      className={`p-3 rounded-lg border ${
                        hpPayCancelSelected.has(item.CTRT_ID)
                          ? 'bg-green-50 border-green-300'
                          : 'bg-gray-50 border-gray-100'
                      }`}
                    >
                      <div className="flex items-center gap-2 mb-2">
                        <input
                          type="checkbox"
                          checked={hpPayCancelSelected.has(item.CTRT_ID)}
                          onChange={(e) => handleHpPayItemSelect('cancel', item.CTRT_ID, e.target.checked)}
                          className="w-4 h-4 text-green-600 rounded flex-shrink-0"
                        />
                        <span className="font-medium text-gray-800 text-sm flex-1">
                          {item.PROD_NM || '상품명 없음'}
                        </span>
                        <span className="px-2 py-0.5 text-xs rounded-full flex-shrink-0 bg-green-100 text-green-700">
                          신청
                        </span>
                      </div>
                      <div className="text-xs text-gray-500 space-y-1 ml-6">
                        <div className="flex justify-between">
                          <span>계약ID:</span>
                          <span className="text-gray-700">{item.CTRT_ID}</span>
                        </div>
                        {item.ADDR && (
                          <div>
                            <span className="text-gray-400">설치주소: </span>
                            <span className="text-gray-700 break-all">{item.ADDR}</span>
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
                    <p>신청/해지 버튼 클릭 시 상담이 접수되며, 담당자 확인 후 처리됩니다.</p>
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
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">도로명 *</label>
                    <input
                      type="text"
                      value={streetSearchForm.streetNm}
                      onChange={(e) => setStreetSearchForm(prev => ({ ...prev, streetNm: e.target.value }))}
                      onKeyPress={(e) => e.key === 'Enter' && handleSearchStreetAddress()}
                      placeholder="예: 테헤란로"
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
                    />
                  </div>
                  <div className="flex gap-2">
                    <div className="flex-1">
                      <label className="block text-xs text-gray-500 mb-1">건물본번</label>
                      <input
                        type="text"
                        value={streetSearchForm.streetBunM}
                        onChange={(e) => setStreetSearchForm(prev => ({ ...prev, streetBunM: e.target.value.replace(/[^0-9]/g, '') }))}
                        placeholder="예: 123"
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
                      />
                    </div>
                    <div className="flex-1">
                      <label className="block text-xs text-gray-500 mb-1">건물부번</label>
                      <input
                        type="text"
                        value={streetSearchForm.streetBunS}
                        onChange={(e) => setStreetSearchForm(prev => ({ ...prev, streetBunS: e.target.value.replace(/[^0-9]/g, '') }))}
                        placeholder="예: 0"
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
                      />
                    </div>
                  </div>
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
                    도로명을 입력하고 검색하세요.
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

      {/* 서명 모달 */}
      {showSignatureModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="w-full max-w-md">
            <SignaturePad
              title="납부방법 변경 서명"
              onSave={handleSignatureComplete}
              onCancel={() => setShowSignatureModal(false)}
            />
          </div>
        </div>
      )}

      {/* 납부계정 전환 확인 모달 */}
      {showSwitchConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm overflow-hidden">
            <div className="p-4 border-b border-gray-100 bg-gradient-to-r from-yellow-500 to-orange-500">
              <h3 className="font-semibold text-white flex items-center gap-2">
                <AlertCircle className="w-5 h-5" />
                작성 내용 확인
              </h3>
            </div>
            <div className="p-4">
              <p className="text-gray-700 text-sm">
                현재 작성 중인 납부정보 변경 내용이 있습니다.<br />
                다른 납부계정으로 전환하시면 작성 내용이 초기화됩니다.
              </p>
              <p className="text-gray-500 text-xs mt-2">
                계속하시겠습니까?
              </p>
            </div>
            <div className="p-4 bg-gray-50 flex gap-2">
              <button
                onClick={() => {
                  setShowSwitchConfirm(false);
                  setPendingSwitchPymAcntId('');
                }}
                className="flex-1 py-2.5 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors text-sm font-medium"
              >
                취소
              </button>
              <button
                onClick={() => switchPaymentAccount(pendingSwitchPymAcntId)}
                className="flex-1 py-2.5 bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition-colors text-sm font-medium"
              >
                계속하기
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 휴대폰결제 신청/해지 확인 모달 */}
      <ConfirmModal
        isOpen={confirmModal.isOpen}
        onClose={() => setConfirmModal(useConfirmInitialState)}
        onConfirm={confirmModal.onConfirm}
        title={confirmModal.title}
        message={confirmModal.message}
        type={confirmModal.type}
        confirmText="확인"
        cancelText="취소"
      />

      {/* 알림 모달 (Toast 대체) */}
      <ConfirmModal
        isOpen={alertModal.isOpen}
        onClose={() => setAlertModal({ isOpen: false, message: '', type: 'info' })}
        onConfirm={() => {}}
        message={alertModal.message}
        type={alertModal.type === 'success' ? 'confirm' : alertModal.type === 'warning' ? 'warning' : alertModal.type === 'error' ? 'error' : 'info'}
        confirmText="확인"
        showCancel={false}
      />
    </div>
  );
};

export default CustomerInfoChange;
