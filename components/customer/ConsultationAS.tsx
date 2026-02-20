import React, { useState, useEffect } from 'react';
import {
  MessageSquare, Wrench, ChevronDown, ChevronUp,
  Loader2, AlertCircle, Send, Calendar, Clock,
  RefreshCw, ArrowLeft, FileText, CheckCircle, XCircle
} from 'lucide-react';
import {
  getConsultationHistory,
  getWorkHistory,
  registerConsultation,
  registerASRequest,
  getConsultationCodes,
  getConsultationLargeCodes,
  getConsultationMiddleCodes,
  getConsultationSmallCodes,
  getASClassCodes,
  getASReasonLargeCodes,
  getASReasonDetailCodes,
  getProductGroups,
  getPromOfContract,
  saveCtrtAgreeInfo,
  getPromMonthCodes,
  getPromChangeReasonCodes,
  getPromChangeCodes,
  ConsultationHistory,
  WorkHistory,
  ContractInfo,
  ConsultationRequest,
  ASRequestParams,
  formatDate
} from '../../services/customerApi';
import ReContractRegistration from './ReContractRegistration';

// ID 포맷 (3-3-4 형식)
const formatId = (id: string): string => {
  if (!id) return '-';
  const cleaned = id.replace(/[^0-9]/g, '');
  if (cleaned.length === 10) {
    return `${cleaned.slice(0, 3)}-${cleaned.slice(3, 6)}-${cleaned.slice(6, 10)}`;
  }
  return id;
};

interface ConsultationASProps {
  onBack: () => void;
  showToast?: (message: string, type: 'success' | 'error' | 'warning' | 'info') => void;
  selectedCustomer: {
    custId: string;
    custNm: string;
    telNo: string;
  } | null;
  selectedContract: {
    ctrtId: string;
    prodNm: string;
    instAddr: string;
    postId?: string;
    notrecev?: string;
    soId?: string;
    prodGrp?: string;
  } | null;
  contracts?: ContractInfo[];  // 전체 계약 목록 (일자별 이력 조회용)
  onNavigateToBasicInfo: () => void;
  initialTab?: 'consultation' | 'as' | 're-contract';  // 초기 탭 지정
}

interface CodeItem {
  CODE: string;
  CODE_NM: string;
  ref_code?: string;  // 상위 코드 참조 (CMAS001 → CMAS000 연결)
}

// D'Live 코드 형식 (CMCS010/020/030)
interface DLiveCode {
  code: string;
  name: string;
  ref_code?: string;   // 상위 분류 코드 참조
  ref_code2?: string;  // 추가 참조 코드 (CMAS000: 상품그룹 필터용)
  ref_code12?: string; // 모바일 표시 여부 (CMCS030: 'Y'=모바일 표시)
}

/**
 * 상담/AS 화면
 *
 * 회의록 기준:
 * - 상담이력 조회/등록
 * - AS 접수 (반드시 1개의 계약이 특정되어야 함)
 * - 작업이력 조회
 */
const ConsultationAS: React.FC<ConsultationASProps> = ({
  onBack,
  showToast,
  selectedCustomer,
  selectedContract,
  contracts = [],
  onNavigateToBasicInfo,
  initialTab = 'consultation'
}) => {
  // 탭 상태 (initialTab prop으로 초기값 설정)
  const [activeTab, setActiveTab] = useState<'consultation' | 'as' | 're-contract'>(initialTab);

  // initialTab이 변경되면 activeTab 업데이트
  useEffect(() => {
    setActiveTab(initialTab);
  }, [initialTab]);

  // 재약정 탭 차단 팝업
  const [showReContractBlock, setShowReContractBlock] = useState(false);

  // 재약정 탭 클릭 핸들러 - 사용중(기간도래)만 허용
  const handleReContractTabClick = () => {
    if (!selectedContract) {
      setShowReContractBlock(true);
      return;
    }
    // contracts에서 선택된 계약 찾아서 CLOSE_DANGER 확인
    const found = contracts.find(c => c.CTRT_ID === selectedContract.ctrtId);
    const isCloseDanger = found && found.CLOSE_DANGER === 'Y' && (found.CTRT_STAT_NM || '').includes('사용중');
    if (!isCloseDanger) {
      setShowReContractBlock(true);
      return;
    }
    setActiveTab('re-contract');
  };

  // 이력 데이터
  const [consultationHistory, setConsultationHistory] = useState<ConsultationHistory[]>([]);
  const [workHistory, setWorkHistory] = useState<WorkHistory[]>([]);

  // 일자별/계약별 뷰 모드
  const [historyViewMode, setHistoryViewMode] = useState<'byDate' | 'byContract'>(selectedContract ? 'byContract' : 'byDate');
  const [allConsultationHistory, setAllConsultationHistory] = useState<ConsultationHistory[]>([]);
  const [allWorkHistory, setAllWorkHistory] = useState<WorkHistory[]>([]);

  // 코드 데이터
  const [consultationCodes, setConsultationCodes] = useState<CodeItem[]>([]);

  // 상담/AS 대상 단위 (계약 or 고객) - 기본값 고객단위
  const [targetUnit, setTargetUnit] = useState<'contract' | 'customer'>('customer');

  // AS접수 가입자/비가입자 구분
  const [asSubscriberType, setAsSubscriberType] = useState<'subscriber' | 'nonSubscriber'>('subscriber');

  // 계약단위 선택 확인 팝업
  const [showContractConfirm, setShowContractConfirm] = useState(false);

  // 계약단위 선택 핸들러
  const handleTargetUnitChange = (unit: 'contract' | 'customer') => {
    if (unit === 'contract') {
      if (!selectedContract) {
        // 계약이 선택되지 않은 경우 확인 팝업 표시
        setShowContractConfirm(true);
      } else {
        setTargetUnit('contract');
      }
    } else {
      setTargetUnit('customer');
    }
  };

  // 계약이 선택되면 자동으로 계약단위로 변경
  useEffect(() => {
    if (selectedContract) {
      setTargetUnit('contract');
    }
  }, [selectedContract]);

  // 상담 등록 폼 (와이어프레임 기준: 대/중/소분류)
  const [consultationForm, setConsultationForm] = useState({
    cnslLClCd: '',      // 상담대분류
    cnslMClCd: '',      // 상담중분류
    cnslSClCd: '',      // 상담소분류
    reqCntn: '',
    transYn: 'N',
    transDeptCd: ''
  });

  // 상담/작업 이력 개별 접기/펼치기
  const [expandedConsultItems, setExpandedConsultItems] = useState<Set<number>>(new Set());
  const [expandedWorkItems, setExpandedWorkItems] = useState<Set<number>>(new Set());

  const toggleConsultItem = (index: number) => {
    setExpandedConsultItems(prev => {
      const next = new Set(prev);
      next.has(index) ? next.delete(index) : next.add(index);
      return next;
    });
  };
  const toggleWorkItem = (index: number) => {
    setExpandedWorkItems(prev => {
      const next = new Set(prev);
      next.has(index) ? next.delete(index) : next.add(index);
      return next;
    });
  };

  // 상담 분류 코드 데이터 (D'Live API에서 로드)
  const [cnslLCodes, setCnslLCodes] = useState<DLiveCode[]>([]);
  const [allCnslMCodes, setAllCnslMCodes] = useState<DLiveCode[]>([]);  // 전체 중분류 (필터용)
  const [allCnslSCodes, setAllCnslSCodes] = useState<DLiveCode[]>([]);  // 전체 소분류 (필터용)
  const [cnslMCodes, setCnslMCodes] = useState<DLiveCode[]>([]);        // 필터된 중분류
  const [cnslSCodes, setCnslSCodes] = useState<DLiveCode[]>([]);        // 필터된 소분류

  // 상담대분류 변경 시 중분류 필터링
  const handleCnslLChange = (code: string) => {
    setConsultationForm(prev => ({ ...prev, cnslLClCd: code, cnslMClCd: '', cnslSClCd: '' }));
    setCnslSCodes([]);
    // allCnslMCodes에서 ref_code가 선택된 대분류와 일치하는 것만 필터링
    const filtered = allCnslMCodes.filter(m => m.ref_code === code);
    setCnslMCodes(filtered);
  };

  // 상담중분류 변경 시 소분류 필터링
  const handleCnslMChange = (code: string) => {
    setConsultationForm(prev => ({ ...prev, cnslMClCd: code, cnslSClCd: '' }));
    // allCnslSCodes에서 ref_code가 선택된 중분류와 일치하는 것만 필터링
    const filtered = allCnslSCodes.filter(s => s.ref_code === code);
    setCnslSCodes(filtered);
  };

  // 작업예정시 기본값: 현재 시간 +1시간 (09~21 범위, 범위 밖이면 09시)
  const getDefaultHour = () => {
    const nextHour = new Date().getHours() + 1;
    if (nextHour >= 9 && nextHour <= 21) return nextHour.toString().padStart(2, '0');
    return '09';
  };

  // AS 접수 폼 (와이어프레임 기준 확장)
  const [asForm, setASForm] = useState({
    asClCd: '',           // AS구분
    asClDtlCd: '',        // 콤보상세 (reserved)
    asResnLCd: '',        // AS접수사유(대)
    asResnMCd: '',        // AS접수사유(중)
    asCntn: '',           // AS 내용
    schdDt: new Date().toISOString().split('T')[0],  // 작업예정일
    schdHour: getDefaultHour(),  // 작업예정시 (현재+1시간, 09~21)
    schdMin: '00'         // 작업예정분 (10분 단위)
  });

  // AS 코드 데이터 (API에서 로드)
  const [asClCodes, setAsClCodes] = useState<CodeItem[]>([]);        // AS구분 (CMWT001 ref_code='03')
  const [asClDtlCodes, setAsClDtlCodes] = useState<CodeItem[]>([]);  // 콤보상세 (reserved)

  const [asResnLCodes, setAsResnLCodes] = useState<CodeItem[]>([]);  // AS사유 대분류 (CMAS000)
  const [allAsResnMCodes, setAllAsResnMCodes] = useState<CodeItem[]>([]);  // AS사유 중분류 전체 (CMAS001)
  const [asResnMCodes, setAsResnMCodes] = useState<CodeItem[]>([]);  // 필터된 AS사유 중분류

  // AS사유 대분류: 선택된 계약의 PROD_GRP로 필터링 (mowoe03m03.xml 기준)
  // ref_code에 PROD_GRP 문자가 포함된 항목만 표시 (예: PROD_GRP='D' → ref_code에 'D' 포함)
  const filteredAsResnLCodes = selectedContract?.prodGrp
    ? asResnLCodes.filter(c => !c.ref_code || c.ref_code.includes(selectedContract.prodGrp!))
    : asResnLCodes;

  // AS사유(대) 변경 시 중분류 필터링 (CMAS001의 ref_code로 연결)
  const handleAsResnLChange = (code: string) => {
    setASForm(prev => ({ ...prev, asResnLCd: code, asResnMCd: '' }));
    const filtered = allAsResnMCodes.filter(m => m.ref_code === code);
    setAsResnMCodes(filtered);
  };

  // 시간 옵션 생성
  const hourOptions = Array.from({ length: 13 }, (_, i) => {
    const hour = (9 + i).toString().padStart(2, '0');
    return { value: hour, label: `${hour}시` };
  });

  const minOptions = Array.from({ length: 6 }, (_, i) => {
    const min = (i * 10).toString().padStart(2, '0');
    return { value: min, label: `${min}분` };
  });

  // 로딩 상태
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [isLoadingCodes, setIsLoadingCodes] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // 결과 팝업 상태
  const [resultPopup, setResultPopup] = useState<{
    show: boolean;
    type: 'success' | 'error' | 'warning';
    title: string;
    message: string;
  }>({ show: false, type: 'success', title: '', message: '' });

  const showPopup = (type: 'success' | 'error' | 'warning', title: string, message: string) => {
    setResultPopup({ show: true, type, title, message });
  };

  // 섹션 펼침 상태
  const [showHistory, setShowHistory] = useState(true);

  // 일자별: 전체 이력 (allHistory), 계약별: 서버 필터링 결과 (consultationHistory/workHistory)
  const filteredConsultation = (() => {
    if (historyViewMode === 'byContract') {
      if (!selectedContract?.ctrtId) return [];
      return consultationHistory; // loadHistory()로 서버에서 CTRT_ID 필터된 결과
    }
    return allConsultationHistory;
  })();

  const filteredWork = (() => {
    if (historyViewMode === 'byContract') {
      if (!selectedContract?.ctrtId) return [];
      return workHistory; // loadHistory()로 서버에서 CTRT_ID 필터된 결과
    }
    return allWorkHistory;
  })();

  // 초기 데이터 로드
  useEffect(() => {
    loadCodes();
    if (selectedCustomer && selectedContract) {
      setHistoryViewMode('byContract');
      loadHistory();
    } else if (selectedCustomer) {
      setHistoryViewMode('byDate');
      loadAllHistory();
    }
  }, [selectedCustomer, selectedContract]);

  // 고객 선택 시 전체 이력 로드 (계약 유무 무관)
  useEffect(() => {
    if (selectedCustomer && allConsultationHistory.length === 0 && allWorkHistory.length === 0) {
      loadAllHistory();
    }
  }, [contracts]);

  // 계약 선택 시 콤보상세 (상품그룹) 로드 - PROD_GRP='C'(케이블)인 경우에만
  useEffect(() => {
    if (selectedContract?.ctrtId && selectedContract?.prodGrp === 'C') {
      getProductGroups(selectedContract.ctrtId).then(res => {
        if (res.success && res.data) {
          const codes = (Array.isArray(res.data) ? res.data : [res.data])
            .filter((item: any) => item.biz_cl || item.BIZ_CL || item.code)
            .map((item: any) => ({
              CODE: item.biz_cl || item.BIZ_CL || item.code || '',
              CODE_NM: item.SVC_NM || item.svc_nm || item.name || item.biz_cl || ''
            }));
          setAsClDtlCodes(codes);
        }
      }).catch(() => setAsClDtlCodes([]));
    } else {
      setAsClDtlCodes([]);
    }
  }, [selectedContract]);

  const loadCodes = async () => {
    setIsLoadingCodes(true);
    try {
      // 상담분류 (CMCS010/020/030) + AS구분 (CMWT001) + AS사유 (CMAS000/001) 동시 로드
      const [lCodesRes, mCodesRes, sCodesRes, asClRes, asResnLRes, asResnMRes] = await Promise.all([
        getConsultationLargeCodes(),
        getConsultationMiddleCodes(),
        getConsultationSmallCodes(),
        getASClassCodes(),           // CMWT001 (AS구분)
        getASReasonLargeCodes(),     // CMAS000 (AS사유 대분류)
        getASReasonDetailCodes(),    // CMAS001 (AS사유 중분류)
      ]);

      const filterCodes = (data: any[]) => data
        .filter((item: any) => item.code && item.code !== '[]' && item.name !== '선택')
        .map((item: any) => ({
          code: item.code,
          name: item.name,
          ref_code: item.ref_code,
          ref_code2: item.ref_code2,
          ref_code12: item.ref_code12,
        }));

      // 상담 대분류 (CMCS010)
      if (lCodesRes.success && lCodesRes.data) {
        setCnslLCodes(filterCodes(lCodesRes.data));
      }

      // 상담 중분류 (CMCS020) - ref_code로 대분류와 연결
      if (mCodesRes.success && mCodesRes.data) {
        setAllCnslMCodes(filterCodes(mCodesRes.data));
      }

      // 상담 소분류 (CMCS030) - ref_code로 중분류와 연결
      // 대→중→소 캐스케이딩 패턴에서는 전체 소분류 사용 (ref_code12 필터 미적용)
      // ref_code12='Y' 항목은 OPA/OBG/OBE/RTC/OBI/OBD 중분류만 커버하여 AS 등에서 빈 목록 발생
      if (sCodesRes.success && sCodesRes.data) {
        setAllCnslSCodes(filterCodes(sCodesRes.data));
      }

      // AS구분 (CMWT001, ref_code='03'이 AS 관련)
      // mowoe03m03.xml 기준: 0350(현장방어), 0360(OTT BOX), 0370(올인원) 제외
      if (asClRes.success && asClRes.data) {
        const excludeCodes = ['0350', '0360', '0370'];
        const asCodes = asClRes.data
          .filter((item: any) => item.code && item.code !== '[]' && item.ref_code === '03' && !excludeCodes.includes(item.code))
          .map((item: any) => ({ CODE: item.code, CODE_NM: item.name }));
        setAsClCodes(asCodes);
      }

      // AS사유 대분류 (CMAS000) - ref_code2에 상품그룹(PROD_GRP) 필터 정보 포함
      if (asResnLRes.success && asResnLRes.data) {
        const resnLCodes = asResnLRes.data
          .filter((item: any) => item.code && item.code !== '[]' && item.name !== '선택')
          .map((item: any) => ({ CODE: item.code, CODE_NM: item.name, ref_code: item.ref_code2 || '' }));
        setAsResnLCodes(resnLCodes);
      }

      // AS사유 중분류 (CMAS001) - ref_code로 대분류와 연결
      if (asResnMRes.success && asResnMRes.data) {
        const resnMCodes = asResnMRes.data
          .filter((item: any) => item.code && item.code !== '[]' && item.name !== '선택')
          .map((item: any) => ({ CODE: item.code, CODE_NM: item.name, ref_code: item.ref_code }));
        setAllAsResnMCodes(resnMCodes);
      }

    } catch (error) {
      console.error('Load codes error:', error);
    } finally {
      setIsLoadingCodes(false);
    }
  };

  // 전체 이력 로드 (CUST_ID만으로 조회 - 계약 유무 무관)
  const loadAllHistory = async () => {
    if (!selectedCustomer) {
      setAllConsultationHistory([]);
      setAllWorkHistory([]);
      return;
    }

    setIsLoadingHistory(true);
    try {
      // CTRT_ID 없이 CUST_ID만으로 1회 호출 (백엔드에서 최근 3개월, 최대 10건 반환)
      const [consultRes, workRes] = await Promise.all([
        getConsultationHistory(selectedCustomer.custId, undefined, 10),
        getWorkHistory(selectedCustomer.custId, undefined, 10)
      ]);

      const allConsult = consultRes.success && consultRes.data ? consultRes.data : [];
      const allWork = workRes.success && workRes.data ? workRes.data : [];

      setAllConsultationHistory(allConsult);
      setAllWorkHistory(allWork);
    } catch (error) {
      console.error('Load all history error:', error);
    } finally {
      setIsLoadingHistory(false);
    }
  };

  const loadHistory = async () => {
    if (!selectedCustomer || !selectedContract) {
      setConsultationHistory([]);
      setWorkHistory([]);
      return;
    }

    setIsLoadingHistory(true);
    try {
      const [consultRes, workRes] = await Promise.all([
        getConsultationHistory(selectedCustomer.custId, selectedContract.ctrtId, 10),
        getWorkHistory(selectedCustomer.custId, selectedContract.ctrtId, 10)
      ]);

      if (consultRes.success && consultRes.data) {
        setConsultationHistory(consultRes.data);
      }
      if (workRes.success && workRes.data) {
        setWorkHistory(workRes.data);
      }
    } catch (error) {
      console.error('Load history error:', error);
    } finally {
      setIsLoadingHistory(false);
    }
  };

  // 상담 등록
  const handleRegisterConsultation = async () => {
    if (!selectedCustomer) {
      showPopup('warning', '안내', '먼저 고객을 선택해주세요.');
      return;
    }

    if (!selectedContract) {
      showPopup('warning', '안내', '상담등록을 위해 계약을 선택해주세요.\n기본조회 탭에서 계약을 선택 후 진행해주세요.');
      return;
    }

    if (!consultationForm.cnslLClCd || !consultationForm.cnslMClCd || !consultationForm.cnslSClCd) {
      showPopup('warning', '안내', '상담 분류를 모두 선택해주세요.');
      return;
    }

    if (!consultationForm.reqCntn.trim()) {
      showPopup('warning', '안내', '요청사항을 입력해주세요.');
      return;
    }

    setIsSaving(true);
    try {
      // ConsultationRequest 인터페이스에 맞는 파라미터명 사용
      const params: ConsultationRequest = {
        CUST_ID: selectedCustomer.custId,
        CTRT_ID: selectedContract?.ctrtId || '',
        CNSL_MST_CL: consultationForm.cnslLClCd,   // 대분류 (CMCS010)
        CNSL_MID_CL: consultationForm.cnslMClCd,   // 중분류 (CMCS020)
        CNSL_SLV_CL: consultationForm.cnslSClCd,   // 소분류 (CMCS030)
        REQ_CTX: consultationForm.reqCntn,          // 요청사항
        POST_ID: selectedContract?.postId || '',
        SAVE_TP: '2',
        CNSL_RSLT: '5',   // 완료 (원본 CONA mowoe03m04.xml 기준)
        RCPT_TP: 'G1', CUST_REL: 'A', PRESS_RCPT_YN: 'N',
        SUBS_TP: '1', CTI_CID: '0',
        SO_ID: '', MST_SO_ID: ''
      };

      const response = await registerConsultation(params);

      if (response.success) {
        showPopup('success', '상담 등록 완료', '상담이 정상적으로 등록되었습니다.');
        // 폼 초기화
        setConsultationForm({
          cnslLClCd: '',
          cnslMClCd: '',
          cnslSClCd: '',
          reqCntn: '',
          transYn: 'N',
          transDeptCd: ''
        });
        setCnslMCodes([]);
        setCnslSCodes([]);
        // 이력 새로고침 (계약별 + 전체)
        loadHistory();
        loadAllHistory();
      } else {
        showPopup('error', '상담 등록 실패', response.message || '상담 등록에 실패했습니다.');
      }
    } catch (error) {
      console.error('Register consultation error:', error);
      showPopup('error', '오류', '상담 등록 중 오류가 발생했습니다.');
    } finally {
      setIsSaving(false);
    }
  };

  // AS 접수
  const handleRegisterAS = async () => {
    if (!selectedCustomer) {
      showPopup('warning', '안내', '먼저 고객을 선택해주세요.');
      return;
    }

    // 가입자 모드: 계약 필수
    if (asSubscriberType === 'subscriber' && !selectedContract) {
      showPopup('warning', '안내', '가입자 AS 접수를 위해 계약을 선택해주세요.');
      return;
    }

    if (!asForm.asClCd) {
      showPopup('warning', '안내', 'AS구분을 선택해주세요.');
      return;
    }

    if (!asForm.asResnLCd) {
      showPopup('warning', '안내', 'AS접수사유(대)를 선택해주세요.');
      return;
    }

    // 중분류가 있는 대분류인 경우에만 중분류 필수 검증
    if (asResnMCodes.length > 0 && !asForm.asResnMCd) {
      showPopup('warning', '안내', 'AS접수사유(중)를 선택해주세요.');
      return;
    }

    if (!asForm.asCntn.trim()) {
      showPopup('warning', '안내', 'AS 내용을 입력해주세요.');
      return;
    }

    setIsSaving(true);
    try {
      // 로그인 사용자 정보 (localStorage에서)
      const userInfo = JSON.parse(localStorage.getItem('userInfo') || '{}');

      const isSubscriber = asSubscriberType === 'subscriber';
      // non-subscriber: use first active contract for POST_ID/CTRT_ID (CONA needs these for work direction)
      const fallbackContract = !isSubscriber && contracts.length > 0
        ? (contracts.find(c => (c.CTRT_STAT_NM || '').includes('사용')) || contracts[0])
        : null;
      const params = {
        CUST_ID: selectedCustomer.custId,
        CTRT_ID: isSubscriber ? (selectedContract?.ctrtId || '') : (fallbackContract?.CTRT_ID || ''),
        POST_ID: isSubscriber ? (selectedContract?.postId || '') : (fallbackContract?.POST_ID || ''),
        INST_ADDR: isSubscriber ? (selectedContract?.instAddr || '') : (fallbackContract?.INST_ADDR || ''),
        AS_CL_CD: asForm.asClCd,
        AS_RESN_L_CD: asForm.asResnLCd,
        AS_RESN_M_CD: asForm.asResnMCd,
        AS_CNTN: asForm.asCntn,
        SCHD_DT: asForm.schdDt.replace(/-/g, ''),
        SCHD_TM: asForm.schdHour + asForm.schdMin,
        WRKR_ID: userInfo.userId || '',
        PG_GUBUN: '0',
        SO_ID: isSubscriber
          ? (selectedContract?.soId || '')
          : (fallbackContract?.SO_ID || userInfo.authSoList?.[0]?.SO_ID || userInfo.authSoList?.[0]?.soId || userInfo.soId || userInfo.SO_ID || ''),
        MST_SO_ID: ''
      };

      const response = await registerASRequest(params);

      if (response.success) {
        showPopup('success', 'AS 접수 완료', 'AS가 정상적으로 접수되었습니다.');
        // 폼 초기화
        setASForm({
          asClCd: '',
          asClDtlCd: '',
          asResnLCd: '',
          asResnMCd: '',
          asCntn: '',
          schdDt: new Date().toISOString().split('T')[0],
          schdHour: getDefaultHour(),
          schdMin: '00'
        });
        setAsResnMCodes([]);
        // 이력 새로고침 (계약별 + 전체)
        loadHistory();
        loadAllHistory();
      } else {
        showPopup('error', 'AS 접수 실패', response.message || 'AS 접수에 실패했습니다.');
      }
    } catch (error) {
      console.error('Register AS error:', error);
      showPopup('error', '오류', 'AS 접수 중 오류가 발생했습니다.');
    } finally {
      setIsSaving(false);
    }
  };

  // 고객 미선택 시 안내
  if (!selectedCustomer) {
    return (
      <div className="h-full flex items-center justify-center bg-gray-50">
        <div className="text-center p-8">
          <AlertCircle className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-700 mb-2">고객을 먼저 선택해주세요</h3>
          <p className="text-gray-500 mb-4">
            기본조회 탭에서 고객을 검색하고 선택한 후<br />
            상담/AS를 진행할 수 있습니다.
          </p>
          <button
            onClick={onNavigateToBasicInfo}
            className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
          >
            <ArrowLeft className="w-4 h-4 inline mr-2" />
            기본조회로 이동
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto bg-gray-50">
      <div className="p-4 space-y-4">
        {/* 탭 선택 */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-1 flex gap-1">
          <button
            onClick={() => setActiveTab('consultation')}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg transition-colors text-sm ${
              activeTab === 'consultation'
                ? 'bg-blue-500 text-white'
                : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            <MessageSquare className="w-4 h-4" />
            상담
          </button>
          <button
            onClick={() => setActiveTab('as')}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg transition-colors text-sm ${
              activeTab === 'as'
                ? 'bg-orange-500 text-white'
                : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            <Wrench className="w-4 h-4" />
            AS
          </button>
          <button
            onClick={handleReContractTabClick}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg transition-colors text-sm ${
              activeTab === 're-contract'
                ? 'bg-purple-500 text-white'
                : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            <RefreshCw className="w-4 h-4" />
            재약정
          </button>
        </div>

        {/* 상담 등록 */}
        {activeTab === 'consultation' && (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 space-y-4">
            <h3 className="font-medium text-gray-800 flex items-center gap-2">
              <MessageSquare className="w-5 h-5 text-blue-500" />
              상담 등록
            </h3>

            {/* 대상 단위 선택 + 고객/계약 정보 (통합) */}
            <div className="p-3 bg-blue-50 rounded-lg border border-blue-200">
              <div className="flex items-center justify-between mb-2">
                <div className="text-sm text-blue-800">
                  <span className="font-medium">{selectedCustomer.custNm}</span>
                  <span className="ml-1 text-blue-600 text-xs">(고객ID: {formatId(selectedCustomer.custId)})</span>
                </div>
                <div className="flex gap-3">
                  <label className="flex items-center gap-1 cursor-pointer">
                    <input
                      type="radio"
                      name="targetUnit"
                      value="customer"
                      checked={targetUnit === 'customer'}
                      onChange={() => handleTargetUnitChange('customer')}
                      className="w-3.5 h-3.5 text-blue-600"
                    />
                    <span className="text-xs text-gray-700">고객</span>
                  </label>
                  <label className="flex items-center gap-1 cursor-pointer">
                    <input
                      type="radio"
                      name="targetUnit"
                      value="contract"
                      checked={targetUnit === 'contract'}
                      onChange={() => handleTargetUnitChange('contract')}
                      className="w-3.5 h-3.5 text-blue-600"
                    />
                    <span className="text-xs text-gray-700">계약</span>
                  </label>
                </div>
              </div>
              {targetUnit === 'contract' && selectedContract && (
                <div className="text-xs text-blue-700 pt-1 border-t border-blue-200 space-y-0.5">
                  <div className="flex"><span className="text-blue-500 w-14 flex-shrink-0">상품명</span><span className="font-medium">{selectedContract.prodNm}</span></div>
                  <div className="flex"><span className="text-blue-500 w-14 flex-shrink-0">계약ID</span><span>{formatId(selectedContract.ctrtId)}</span></div>
                  {selectedContract.instAddr && (
                    <div className="flex"><span className="text-blue-500 w-14 flex-shrink-0">설치주소</span><span>{selectedContract.instAddr}</span></div>
                  )}
                  {selectedContract.notrecev && (
                    <div className="flex"><span className="text-blue-500 w-14 flex-shrink-0">장비</span><span>{selectedContract.notrecev}</span></div>
                  )}
                </div>
              )}
            </div>

            {/* 상담 분류 (대/중/소) - D'Live CMCS010/020/030 코드 사용 */}
            <div className="space-y-3">
              <div>
                <label className="block text-sm text-gray-600 mb-1">상담대분류 *</label>
                <select
                  value={consultationForm.cnslLClCd}
                  onChange={(e) => handleCnslLChange(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="">선택</option>
                  {cnslLCodes.map(item => (
                    <option key={item.code} value={item.code}>{item.name}</option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm text-gray-600 mb-1">상담중분류 *</label>
                  <select
                    value={consultationForm.cnslMClCd}
                    onChange={(e) => handleCnslMChange(e.target.value)}
                    disabled={!consultationForm.cnslLClCd || cnslMCodes.length === 0}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100"
                  >
                    <option value="">선택</option>
                    {cnslMCodes.map(item => (
                      <option key={item.code} value={item.code}>{item.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm text-gray-600 mb-1">상담소분류 *</label>
                  <select
                    value={consultationForm.cnslSClCd}
                    onChange={(e) => setConsultationForm(prev => ({ ...prev, cnslSClCd: e.target.value }))}
                    disabled={!consultationForm.cnslMClCd || cnslSCodes.length === 0}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100"
                  >
                    <option value="">선택</option>
                    {cnslSCodes.map(item => (
                      <option key={item.code} value={item.code}>{item.name}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            {/* 요청사항 */}
            <div>
              <label className="block text-sm text-gray-600 mb-1">요청사항 *</label>
              <textarea
                value={consultationForm.reqCntn}
                onChange={(e) => setConsultationForm(prev => ({
                  ...prev,
                  reqCntn: e.target.value
                }))}
                placeholder="요청사항을 입력해주세요."
                rows={4}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none"
              />
            </div>

            {/* 전달 처리 */}
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="transYn"
                checked={consultationForm.transYn === 'Y'}
                onChange={(e) => setConsultationForm(prev => ({
                  ...prev,
                  transYn: e.target.checked ? 'Y' : 'N'
                }))}
                className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
              />
              <label htmlFor="transYn" className="text-sm text-gray-600">
                전달 처리 (지점/업체에 전달)
              </label>
            </div>

            {/* 등록 버튼 */}
            <button
              onClick={handleRegisterConsultation}
              disabled={isSaving}
              className="w-full flex items-center justify-center gap-2 py-3 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:bg-gray-400 transition-colors"
            >
              {isSaving ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  등록 중...
                </>
              ) : (
                <>
                  <Send className="w-5 h-5" />
                  상담 등록
                </>
              )}
            </button>
          </div>
        )}

        {/* AS 접수 */}
        {activeTab === 'as' && (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 space-y-4">
            <h3 className="font-medium text-gray-800 flex items-center gap-2">
              <Wrench className="w-5 h-5 text-orange-500" />
              AS 접수
            </h3>

            {/* 고객/계약 정보 + 가입자/비가입자 선택 (상담등록과 동일 형태) */}
            <div className="p-3 bg-orange-50 rounded-lg border border-orange-200">
              <div className="flex items-center justify-between mb-2">
                <div className="text-sm text-orange-800">
                  <span className="font-medium">{selectedCustomer.custNm}</span>
                  <span className="ml-1 text-orange-600 text-xs">(고객ID: {formatId(selectedCustomer.custId)})</span>
                </div>
                <div className="flex gap-3">
                  <label className="flex items-center gap-1 cursor-pointer">
                    <input
                      type="radio"
                      name="asSubscriberType"
                      value="subscriber"
                      checked={asSubscriberType === 'subscriber'}
                      onChange={() => setAsSubscriberType('subscriber')}
                      className="w-3.5 h-3.5 text-orange-600"
                    />
                    <span className="text-xs text-gray-700">가입자</span>
                  </label>
                  <label className="flex items-center gap-1 cursor-pointer">
                    <input
                      type="radio"
                      name="asSubscriberType"
                      value="nonSubscriber"
                      checked={asSubscriberType === 'nonSubscriber'}
                      onChange={() => setAsSubscriberType('nonSubscriber')}
                      className="w-3.5 h-3.5 text-orange-600"
                    />
                    <span className="text-xs text-gray-700">비가입자</span>
                  </label>
                </div>
              </div>
              {asSubscriberType === 'subscriber' && selectedContract && (
                <div className="text-xs text-orange-700 pt-1 border-t border-orange-200 space-y-0.5">
                  <div className="flex"><span className="text-orange-500 w-14 flex-shrink-0">상품명</span><span className="font-medium">{selectedContract.prodNm}</span></div>
                  <div className="flex"><span className="text-orange-500 w-14 flex-shrink-0">계약ID</span><span>{formatId(selectedContract.ctrtId)}</span></div>
                  {selectedContract.instAddr && (
                    <div className="flex"><span className="text-orange-500 w-14 flex-shrink-0">설치주소</span><span>{selectedContract.instAddr}</span></div>
                  )}
                  {selectedContract.notrecev && (
                    <div className="flex"><span className="text-orange-500 w-14 flex-shrink-0">장비</span><span>{selectedContract.notrecev}</span></div>
                  )}
                </div>
              )}
              {asSubscriberType === 'nonSubscriber' && (
                <div className="text-xs text-orange-600 pt-1 border-t border-orange-200">
                  비가입자 AS접수 - 계약 없이 접수합니다.
                </div>
              )}
            </div>

            {/* 가입자 모드: 계약 미선택 안내 */}
            {asSubscriberType === 'subscriber' && !selectedContract ? (
              <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                <div className="flex items-start gap-2">
                  <AlertCircle className="w-5 h-5 text-yellow-600 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-yellow-800">
                      AS 접수를 위해 계약을 선택해주세요
                    </p>
                    <p className="text-xs text-yellow-700 mt-1">
                      기본조회 탭에서 계약현황에서 계약을 선택한 후 AS 접수가 가능합니다.
                    </p>
                    <button
                      onClick={onNavigateToBasicInfo}
                      className="mt-2 text-sm text-yellow-700 underline hover:text-yellow-800"
                    >
                      계약 선택하러 가기 →
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <>

                {/* AS구분 */}
                <div>
                  <label className="block text-sm text-gray-600 mb-1">AS구분 *</label>
                  <select
                    value={asForm.asClCd}
                    onChange={(e) => setASForm(prev => ({ ...prev, asClCd: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                  >
                    <option value="">선택</option>
                    {asClCodes.map(code => (
                      <option key={code.CODE} value={code.CODE}>{code.CODE_NM}</option>
                    ))}
                  </select>
                </div>

                {/* AS접수사유 (대/중) */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm text-gray-600 mb-1">AS접수사유(대) *</label>
                    <select
                      value={asForm.asResnLCd}
                      onChange={(e) => handleAsResnLChange(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                    >
                      <option value="">선택</option>
                      {filteredAsResnLCodes.map(code => (
                        <option key={code.CODE} value={code.CODE}>{code.CODE_NM}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm text-gray-600 mb-1">
                      AS접수사유(중) {asResnMCodes.length > 0 ? '*' : ''}
                    </label>
                    <select
                      value={asForm.asResnMCd}
                      onChange={(e) => setASForm(prev => ({ ...prev, asResnMCd: e.target.value }))}
                      disabled={!asForm.asResnLCd || asResnMCodes.length === 0}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 disabled:bg-gray-100"
                    >
                      <option value="">{asResnMCodes.length === 0 ? '해당없음' : '선택'}</option>
                      {asResnMCodes.map(code => (
                        <option key={code.CODE} value={code.CODE}>{code.CODE_NM}</option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* AS 내용 */}
                <div>
                  <label className="block text-sm text-gray-600 mb-1">AS 내용 *</label>
                  <textarea
                    value={asForm.asCntn}
                    onChange={(e) => setASForm(prev => ({ ...prev, asCntn: e.target.value }))}
                    placeholder="AS 내용을 입력해주세요."
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 resize-none"
                  />
                </div>

                {/* 작업예정일시 */}
                <div>
                  <label className="block text-sm text-gray-600 mb-1">작업예정일시 *</label>
                  <div className="flex gap-2">
                    <input
                      type="date"
                      value={asForm.schdDt}
                      onChange={(e) => setASForm(prev => ({ ...prev, schdDt: e.target.value }))}
                      min={new Date().toISOString().split('T')[0]}
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                    />
                    <select
                      value={asForm.schdHour}
                      onChange={(e) => setASForm(prev => ({ ...prev, schdHour: e.target.value }))}
                      className="w-20 px-2 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                    >
                      {hourOptions.map(opt => (
                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                      ))}
                    </select>
                    <select
                      value={asForm.schdMin}
                      onChange={(e) => setASForm(prev => ({ ...prev, schdMin: e.target.value }))}
                      className="w-20 px-2 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                    >
                      {minOptions.map(opt => (
                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* 접수 버튼 */}
                <button
                  onClick={handleRegisterAS}
                  disabled={isSaving}
                  className="w-full flex items-center justify-center gap-2 py-3 bg-orange-500 text-white rounded-lg hover:bg-orange-600 disabled:bg-gray-400 transition-colors"
                >
                  {isSaving ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      접수 중...
                    </>
                  ) : (
                    <>
                      <Wrench className="w-5 h-5" />
                      AS 접수
                    </>
                  )}
                </button>
              </>
            )}
          </div>
        )}

        {/* 재약정 */}
        {activeTab === 're-contract' && selectedCustomer && (
          <ReContractRegistration
            onBack={onBack}
            showToast={showToast}
            selectedCustomer={selectedCustomer}
            selectedContract={selectedContract}
            contracts={contracts}
            onNavigateToBasicInfo={onNavigateToBasicInfo}
          />
        )}

        {/* 이력 조회 - 재약정 탭에서는 숨김 */}
        {activeTab !== 're-contract' && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200">
          <div className="flex items-center justify-between p-4">
            <button
              onClick={() => setShowHistory(!showHistory)}
              className="flex items-center gap-2 flex-1 text-left"
            >
              <FileText className="w-5 h-5 text-gray-500" />
              <span className="font-medium text-gray-800">
                {activeTab === 'consultation' ? '상담 이력' : '작업 이력'}
              </span>
              <span className="text-sm text-gray-500">
                ({activeTab === 'consultation'
                  ? filteredConsultation.length
                  : filteredWork.length}건)
              </span>
            </button>
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1 mr-1">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setHistoryViewMode('byDate');
                    if (allConsultationHistory.length === 0 && allWorkHistory.length === 0) {
                      loadAllHistory();
                    }
                  }}
                  className={`px-2 py-0.5 text-xs rounded-full transition-colors ${
                    historyViewMode === 'byDate'
                      ? 'bg-blue-500 text-white'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >일자별</button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setHistoryViewMode('byContract');
                    // 계약이 선택되어 있으면 서버에서 계약별 이력 조회
                    if (selectedContract?.ctrtId) {
                      loadHistory();
                    }
                  }}
                  className={`px-2 py-0.5 text-xs rounded-full transition-colors ${
                    historyViewMode === 'byContract'
                      ? 'bg-blue-500 text-white'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >계약별</button>
              </div>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  loadAllHistory();
                }}
                className="p-1 text-gray-400 hover:text-gray-600"
              >
                <RefreshCw className={`w-4 h-4 ${isLoadingHistory ? 'animate-spin' : ''}`} />
              </button>
              <button onClick={() => setShowHistory(!showHistory)}>
                {showHistory ? (
                  <ChevronUp className="w-5 h-5 text-gray-400" />
                ) : (
                  <ChevronDown className="w-5 h-5 text-gray-400" />
                )}
              </button>
            </div>
          </div>

          {showHistory && (
            <div className="px-4 pb-4">
              {isLoadingHistory ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
                </div>
              ) : historyViewMode === 'byContract' && !selectedContract ? (
                <div className="text-center py-4 text-gray-500 text-sm">
                  기본조회에서 계약을 선택해주세요.
                </div>
              ) : activeTab === 'consultation' ? (
                filteredConsultation.length > 0 ? (
                  <div className="space-y-3 max-h-[400px] overflow-y-auto">
                    {filteredConsultation.map((item, index) => (
                      <div key={index} className="bg-gray-50 rounded-lg text-sm border border-gray-100">
                        {/* 상단 정보 (클릭으로 접기/펼치기) */}
                        <div
                          className="p-3 cursor-pointer flex items-center justify-between"
                          onClick={() => toggleConsultItem(index)}
                        >
                          <div className="grid grid-cols-5 gap-2 text-xs flex-1">
                            <div className="flex flex-col">
                              <span className="text-gray-500 whitespace-nowrap">계약ID</span>
                              <span className="text-gray-800 font-medium text-[10px]">{item.CTRT_ID || '-'}</span>
                            </div>
                            <div className="flex flex-col">
                              <span className="text-gray-500 whitespace-nowrap">접수일</span>
                              <span className="text-gray-800 font-medium">{item.START_DATE || '-'}</span>
                            </div>
                            <div className="flex flex-col">
                              <span className="text-gray-500 whitespace-nowrap">상담소분류</span>
                              <span className="text-gray-800 font-medium truncate">{item.CNSL_SLV_CL_NM || '-'}</span>
                            </div>
                            <div className="flex flex-col">
                              <span className="text-gray-500 whitespace-nowrap">처리상태</span>
                              <span className={`font-medium ${
                                item.CNSL_RSLT?.includes('완료') ? 'text-green-600' : 'text-yellow-600'
                              }`}>{item.CNSL_RSLT || '처리중'}</span>
                            </div>
                            <div className="flex flex-col">
                              <span className="text-gray-500 whitespace-nowrap">접수자</span>
                              <span className="text-gray-800 font-medium">{item.RCPT_NM || '-'}</span>
                            </div>
                          </div>
                          {expandedConsultItems.has(index) ? (
                            <ChevronUp className="w-4 h-4 text-gray-400 ml-2 flex-shrink-0" />
                          ) : (
                            <ChevronDown className="w-4 h-4 text-gray-400 ml-2 flex-shrink-0" />
                          )}
                        </div>

                        {/* 요청사항 + 응대내용 (접기/펼치기) */}
                        {expandedConsultItems.has(index) && (
                          <div className="px-3 pb-3">
                            <div>
                              <div className="text-xs text-gray-500 mb-1">요청사항</div>
                              <div className="p-2 bg-white border border-gray-200 rounded min-h-[48px] text-gray-700 text-xs">
                                {item.REQ_CTX || '-'}
                              </div>
                            </div>
                            <div className="mt-2">
                              <div className="text-xs text-gray-500 mb-1">응대내용</div>
                              <div className="p-2 bg-white border border-gray-200 rounded min-h-[48px] text-gray-700 text-xs">
                                {item.PROC_CT || '-'}
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-4 text-gray-500 text-sm">
                    상담 이력이 없습니다.
                  </div>
                )
              ) : (
                filteredWork.length > 0 ? (
                  <div className="space-y-3 max-h-[400px] overflow-y-auto">
                    {filteredWork.map((item, index) => (
                      <div key={index} className="p-3 bg-gray-50 rounded-lg text-sm border border-gray-100">
                        {/* 상단: 계약ID | 작업예정일 | 작업구분 | 작업상태 */}
                        <div className="grid grid-cols-4 gap-2 text-xs">
                          <div className="flex flex-col">
                            <span className="text-gray-500 whitespace-nowrap">계약ID</span>
                            <span className="text-gray-800 font-medium text-[10px]">{item.CTRT_ID || '-'}</span>
                          </div>
                          <div className="flex flex-col">
                            <span className="text-gray-500 whitespace-nowrap">작업예정일</span>
                            <span className="text-gray-800 font-medium">{item.HOPE_DT || '-'}</span>
                          </div>
                          <div className="flex flex-col">
                            <span className="text-gray-500 whitespace-nowrap">작업구분</span>
                            <span className="text-gray-800 font-medium">{item.WRK_CD_NM || '-'}</span>
                          </div>
                          <div className="flex flex-col">
                            <span className="text-gray-500 whitespace-nowrap">작업상태</span>
                            <span className={`font-medium ${
                              item.WRK_STAT_CD_NM?.includes('완료') ? 'text-green-600' :
                              item.WRK_STAT_CD_NM?.includes('진행') ? 'text-blue-600' :
                              'text-gray-800'
                            }`}>{item.WRK_STAT_CD_NM || '-'}</span>
                          </div>
                        </div>

                        {/* 상품명 */}
                        <div className="mt-2 grid grid-cols-[auto_1fr] gap-2 text-xs items-center">
                          <span className="text-gray-500 whitespace-nowrap">상품명</span>
                          <span className="text-gray-800 font-medium truncate">{item.PROD_NM || '-'}</span>
                        </div>

                        {/* 완료일자 | 작업자 | 작업자소속 */}
                        <div className="mt-2 grid grid-cols-3 gap-2 text-xs">
                          <div className="flex flex-col">
                            <span className="text-gray-500 whitespace-nowrap">완료일자</span>
                            <span className="text-gray-800 font-medium">{item.CMPL_DATE || '-'}</span>
                          </div>
                          <div className="flex flex-col">
                            <span className="text-gray-500 whitespace-nowrap">작업자</span>
                            <span className="text-gray-800 font-medium">{item.WRK_NM || '-'}</span>
                          </div>
                          <div className="flex flex-col">
                            <span className="text-gray-500 whitespace-nowrap">작업자소속</span>
                            <span className="text-gray-800 font-medium">{item.WRK_CRR_NM || '-'}</span>
                          </div>
                        </div>

                        {/* 설치주소 */}
                        <div className="mt-2 grid grid-cols-[auto_1fr] gap-2 text-xs items-start">
                          <span className="text-gray-500 whitespace-nowrap">설치주소</span>
                          <span className="text-gray-800">{item.CTRT_ADDR || '-'}</span>
                        </div>

                        {/* 작업지시내용 (접기/펼치기) */}
                        <div
                          className="mt-3 cursor-pointer"
                          onClick={() => toggleWorkItem(index)}
                        >
                          <div className="flex items-center justify-between mb-1">
                            <div className="text-xs text-gray-500">작업지시내용</div>
                            {expandedWorkItems.has(index) ? (
                              <ChevronUp className="w-3.5 h-3.5 text-gray-400" />
                            ) : (
                              <ChevronDown className="w-3.5 h-3.5 text-gray-400" />
                            )}
                          </div>
                          {expandedWorkItems.has(index) && (
                            <div className="p-2 bg-white border border-gray-200 rounded min-h-[48px] text-gray-700 text-xs">
                              {item.MEMO || '-'}
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-4 text-gray-500 text-sm">
                    작업 이력이 없습니다.
                  </div>
                )
              )}
            </div>
          )}
        </div>
        )}
      </div>

      {/* 재약정 차단 팝업 */}
      {showReContractBlock && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-5 max-w-sm mx-4 shadow-xl">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-purple-100 flex items-center justify-center">
                <AlertCircle className="w-5 h-5 text-purple-500" />
              </div>
              <h3 className="text-base font-medium text-gray-900">재약정 불가</h3>
            </div>
            <p className="text-sm text-gray-600 mb-5">
              재약정은 <span className="font-bold text-orange-600">사용중(기간도래)</span> 상태의 계약만 가능합니다.<br />
              기본조회에서 해당 계약을 선택해주세요.
            </p>
            <button
              onClick={() => setShowReContractBlock(false)}
              className="w-full px-4 py-2 text-sm text-white bg-purple-500 rounded-lg hover:bg-purple-600 transition-colors"
            >
              확인
            </button>
          </div>
        </div>
      )}

      {/* 결과 팝업 */}
      {resultPopup.show && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-5 max-w-sm mx-4 shadow-xl">
            <div className="flex items-center gap-3 mb-4">
              <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                resultPopup.type === 'success' ? 'bg-green-100' :
                resultPopup.type === 'error' ? 'bg-red-100' : 'bg-yellow-100'
              }`}>
                {resultPopup.type === 'success' ? (
                  <CheckCircle className="w-5 h-5 text-green-500" />
                ) : resultPopup.type === 'error' ? (
                  <XCircle className="w-5 h-5 text-red-500" />
                ) : (
                  <AlertCircle className="w-5 h-5 text-yellow-500" />
                )}
              </div>
              <h3 className="text-base font-medium text-gray-900">{resultPopup.title}</h3>
            </div>
            <p className="text-sm text-gray-600 mb-5">{resultPopup.message}</p>
            <button
              onClick={() => setResultPopup(prev => ({ ...prev, show: false }))}
              className={`w-full px-4 py-2 text-sm text-white rounded-lg transition-colors ${
                resultPopup.type === 'success' ? 'bg-green-500 hover:bg-green-600' :
                resultPopup.type === 'error' ? 'bg-red-500 hover:bg-red-600' :
                'bg-yellow-500 hover:bg-yellow-600'
              }`}
            >
              확인
            </button>
          </div>
        </div>
      )}

      {/* 계약단위 선택 확인 팝업 */}
      {showContractConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-5 max-w-sm mx-4 shadow-xl">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center">
                <FileText className="w-5 h-5 text-blue-500" />
              </div>
              <h3 className="text-base font-medium text-gray-900">계약 선택 필요</h3>
            </div>
            <p className="text-sm text-gray-600 mb-5">
              계약 단위로 상담을 등록하려면 먼저 계약을 선택해야 합니다.<br />
              기본조회 화면으로 이동하여 계약을 선택하시겠습니까?
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowContractConfirm(false)}
                className="flex-1 px-4 py-2 text-sm text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
              >
                취소
              </button>
              <button
                onClick={() => {
                  setShowContractConfirm(false);
                  onNavigateToBasicInfo();
                }}
                className="flex-1 px-4 py-2 text-sm text-white bg-blue-500 rounded-lg hover:bg-blue-600 transition-colors"
              >
                계약 선택하기
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ConsultationAS;
