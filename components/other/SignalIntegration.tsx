import React, { useState, useEffect, useRef } from 'react';
import { ChevronDown, ChevronUp, Filter, Bot, ArrowLeft } from 'lucide-react';
import { useUIStore } from '../../stores/uiStore';
import CustomerSearch from '../customer/CustomerSearch';
import { CustomerInfo } from '../../services/customerApi';
import {
  getLghvSendHist,
  getLghvSvcRslt,
  getSendHistory,
  getSvcRsltAndDtlRslt,
  getCertifyApiHist,
  getContractList,
  getLghvProdMap,
  getCommonCodes,
  getCustomerCtrtInfo,
  sendSignal,
  modSvcDtlErrResend,
  modSvcDtlErrResend_2,
  getCtrtEquipmentList,
  getProdPromoInfo,
  LghvSendHistory,
  LghvSvcResult,
  SendHistory,
  SvcRslt,
  SvcDtlRslt,
  CertifyApiHistory,
  SignalParams,
  CtrtEquipment,
  ProdPromoInfo,
} from '../../services/apiService';
import { getCertifyProdMap, setCertifyCL06, getCertifyCL03, setCertifyCL04 } from '../../services/certifyApiService';

interface SignalIntegrationProps {
  onBack: () => void;
  userInfo?: { userId: string; userName: string; soId?: string } | null;
  showToast?: (message: string, type: 'success' | 'error' | 'warning' | 'info') => void;
}

interface ContractInfo {
  CTRT_ID: string;
  CUST_ID?: string;
  BASIC_PROD_CD_NM?: string;
  CTRT_STAT_NM?: string;
  CTRT_STAT?: string;
  SO_NM?: string;
  ADDR?: string;
  PROD_NM?: string;
  INSTL_ADDR?: string;
  [key: string]: any;
}

type SignalType = 'basic' | 'lgu' | 'ftth';

const SignalIntegration: React.FC<SignalIntegrationProps> = ({ onBack, userInfo, showToast }) => {
  // Customer search
  const [selectedCustomer, setSelectedCustomer] = useState<CustomerInfo | null>(null);

  // Contract list
  const [contracts, setContracts] = useState<ContractInfo[]>([]);
  const [selectedContract, setSelectedContract] = useState<ContractInfo | null>(null);
  const [showAllContracts, setShowAllContracts] = useState(false);
  const [contractFilter, setContractFilter] = useState<'all' | 'active'>('all');
  const [contractSearch, setContractSearch] = useState('');
  const [isContractCollapsed, setIsContractCollapsed] = useState(false);

  // Contract loading
  const [isLoadingContracts, setIsLoadingContracts] = useState(false);

  // Signal type
  const [signalType, setSignalType] = useState<SignalType>('basic');

  // Product detection cache
  const lghvProdListRef = useRef<any[]>([]);
  const certifyProdListRef = useRef<string[]>([]);
  const certifySoListRef = useRef<string[]>([]);
  const prodCacheLoaded = useRef(false);

  // Load product cache + signalNavContext 감지 (캐시 로드 완료 후 signalType 판별)
  const [cacheLoaded, setCacheLoaded] = useState(false);
  useEffect(() => {
    if (prodCacheLoaded.current) return;
    prodCacheLoaded.current = true;
    (async () => {
      try {
        const [lghvList, certifyList, soList] = await Promise.all([
          getLghvProdMap().catch(() => []),
          getCertifyProdMap().catch(() => []),
          getCommonCodes('CMIF006').catch(() => []),
        ]);
        lghvProdListRef.current = lghvList || [];
        certifyProdListRef.current = certifyList || [];
        certifySoListRef.current = (soList || []).map((item: any) => item.code || item.COMMON_CD);
        setCacheLoaded(true);
      } catch (e) {
        console.error('[SignalIntegration] cache load error:', e);
        setCacheLoaded(true);
      }
    })();
  }, []);

  const detectSignalType = (contract: ContractInfo): SignalType => {
    const prodCd = contract.BASIC_PROD_CD || contract.PROD_CD || '';
    const soId = contract.SO_ID || '';
    if (prodCd && lghvProdListRef.current.some((p: any) => p.PROD_CD === prodCd)) return 'lgu';
    if (prodCd && certifyProdListRef.current.includes(prodCd) && soId && certifySoListRef.current.includes(soId)) return 'ftth';
    return 'basic';
  };

  // 신호연동 네비게이션 컨텍스트 (작업완료 화면에서 진입 시)
  const signalNavContext = useUIStore((s) => s.signalNavContext);

  // mount 시 signalNavContext → directCtrtId 설정 + 자동 조회 트리거
  useEffect(() => {
    const ctx = useUIStore.getState().signalNavContext;
    if (ctx?.ctrtId) {
      console.log(`[신호연동] 작업완료에서 진입 | WRK_CD=${ctx.workType}, CTRT_ID=${ctx.ctrtId}, PROD_CD=${ctx.prodCd}, SO_ID=${ctx.soId}`);
      setDirectCtrtId(ctx.ctrtId);
      setPendingAutoSearch(true);
    }
  }, []);

  // 캐시 로드 완료 후 signalNavContext의 prodCd/soId로 signalType 감지
  // (레이스 컨디션 방지: 캐시가 먼저 로드되어야 detectSignalType이 정상 동작)
  useEffect(() => {
    if (!cacheLoaded) return;
    const ctx = useUIStore.getState().signalNavContext;
    if (ctx?.ctrtId && (ctx.prodCd || ctx.soId)) {
      const detectedType = detectSignalType({ BASIC_PROD_CD: ctx.prodCd || '', PROD_CD: ctx.prodCd || '', SO_ID: ctx.soId || '' } as any);
      console.log(`[신호연동] signalType 감지 (캐시 로드 완료): ${detectedType} (prodCd=${ctx.prodCd}, soId=${ctx.soId}, certifyProdList=${certifyProdListRef.current.length}개, certifySoList=${certifySoListRef.current.length}개)`);
      setSignalType(detectedType);
    }
  }, [cacheLoaded]);

  // 작업유형별 버튼 활성화 로직
  const getButtonEnabled = () => {
    // LGHV 상품은 해지/개통만 활성화 (STB_DEL/STB_CRT), 나머지 비활성
    if (signalType === 'lgu') {
      return { termination: true, activation: true, itvInit: false, errorResend: false, signalBot: false };
    }
    // FTTH 인증상품은 해지/개통만 활성화 (CL-06/CL-03→CL-04)
    if (signalType === 'ftth') {
      return { termination: true, activation: true, itvInit: false, errorResend: false, signalBot: false };
    }
    if (!signalNavContext) return { termination: true, activation: true, itvInit: true, errorResend: true, signalBot: true };
    const wt = signalNavContext.workType;
    const dtl = signalNavContext.wrkDtlTcd || '';
    // 설치(01), 이전설치(07): 개통 활성, 해지 비활성
    if (wt === '01' || wt === '07') return { termination: false, activation: true, itvInit: true, errorResend: true, signalBot: true };
    // 철거(02), 이전철거(08): 해지 활성, 개통 비활성
    if (wt === '02' || wt === '08') return { termination: true, activation: false, itvInit: true, errorResend: true, signalBot: true };
    // 정지(04): 일시정지/직권정지/직권정지철거 → 해지, 정지해제/직권정지해제/철거복구 → 개통
    if (wt === '04') {
      const suspendTerminate = ['0410', '0430', '0450', '0470'];
      const suspendActivate = ['0420', '0440', '0460', '0480'];
      return {
        termination: suspendTerminate.includes(dtl),
        activation: suspendActivate.includes(dtl),
        itvInit: true, errorResend: true, signalBot: true
      };
    }
    // A/S(03), 상품변경(05), 댁내이전(06), 부가상품(09): 전부 활성
    return { termination: true, activation: true, itvInit: true, errorResend: true, signalBot: true };
  };
  const buttonEnabled = getButtonEnabled();

  // Auto search trigger
  const [pendingAutoSearch, setPendingAutoSearch] = useState(false);

  // Search conditions
  const [directCtrtId, setDirectCtrtId] = useState('');
  const [dateFrom, setDateFrom] = useState(() => {
    const d = new Date(); d.setDate(d.getDate() - 7);
    return d.toISOString().slice(0, 10);
  });
  const [dateTo, setDateTo] = useState(new Date().toISOString().slice(0, 10));

  // Loading states
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [isLoadingDetail, setIsLoadingDetail] = useState(false);
  const [isActionLoading, setIsActionLoading] = useState(false);

  // dlive basic
  const [basicHistories, setBasicHistories] = useState<SendHistory[]>([]);
  const [selectedBasicHistory, setSelectedBasicHistory] = useState<SendHistory | null>(null);
  const [basicSvcRslt, setBasicSvcRslt] = useState<SvcRslt[]>([]);
  const [basicDtlRslt, setBasicDtlRslt] = useState<SvcDtlRslt[]>([]);

  // LGU
  const [lguHistories, setLguHistories] = useState<LghvSendHistory[]>([]);
  const [selectedLguHistory, setSelectedLguHistory] = useState<LghvSendHistory | null>(null);
  const [lguSvcResults, setLguSvcResults] = useState<LghvSvcResult[]>([]);

  // FTTH
  const [ftthHistories, setFtthHistories] = useState<CertifyApiHistory[]>([]);

  // Confirm dialog (확인/취소)
  const [confirmDialog, setConfirmDialog] = useState<{ message: string; onConfirm: () => void } | null>(null);

  // Alert dialog (확인만 - 서버 응답/결과 표시용)
  const [alertDialog, setAlertDialog] = useState<{ message: string; type: 'success' | 'error' | 'warning' | 'info' } | null>(null);

  // Refs
  const detailRef = useRef<HTMLDivElement>(null);

  // Format helpers
  const formatCtrtId = (id: string) => {
    if (!id) return '-';
    const s = id.replace(/[^0-9]/g, '');
    if (s.length === 10) return `${s.slice(0,3)}-${s.slice(3,6)}-${s.slice(6)}`;
    return id;
  };
  const formatDateTime = (dt: string) => {
    if (!dt) return '-';
    const s = dt.replace(/[-: T]/g, '');
    if (s.length >= 14) return `${s.slice(0,4)}-${s.slice(4,6)}-${s.slice(6,8)} ${s.slice(8,10)}:${s.slice(10,12)}:${s.slice(12,14)}`;
    if (s.length >= 8) return `${s.slice(0,4)}-${s.slice(4,6)}-${s.slice(6,8)}`;
    return dt;
  };

  // Clear all history states
  const clearHistories = () => {
    setBasicHistories([]); setSelectedBasicHistory(null); setBasicSvcRslt([]); setBasicDtlRslt([]);
    setLguHistories([]); setSelectedLguHistory(null); setLguSvcResults([]);
    setFtthHistories([]);
  };

  // ===== Equipment parameter population (legacy fn_seteqt equivalent) =====
  // VoIP single product codes (PROD_GRP='V', PROD_TYP='11')
  const VOIP_SINGLE_PROD_CDS = ['PD10004039', 'PD10004040', 'PD10004251', 'PD10004841'];
  // VoIP other-carrier product codes (voip_join_ctrt_id = own ctrt_id)
  const VOIP_OTHER_CARRIER_CDS = ['PD10005153', 'PD10005154', 'PD10005155', 'PD10005330', 'PD10005331'];

  const populateEquipmentParams = async (ctrtId: string, ctrtData: any): Promise<Partial<SignalParams>> => {
    const prodGrp = ctrtData.PROD_GRP || '';
    const prodCd = ctrtData.BASIC_PROD_CD || '';
    const soId = ctrtData.SO_ID || '';
    const voipProdCd = ctrtData.VOIP_PROD_CD || '';
    const ispProdCd = ctrtData.ISP_PROD_CD || '';
    const wrkId = ctrtData.WRK_ID || '';
    const ifDtlId = ctrtData.IF_DTL_ID || '';

    // Use signalNavContext.equipmentData if available (from work complete screen), otherwise fetch
    const navEqtData = signalNavContext?.equipmentData;
    let equipList: any[] = [];
    let promoList: any[] = [];

    if (navEqtData) {
      console.log(`[fn_seteqt] signalNavContext.equipmentData keys:`, Object.keys(navEqtData));
    }
    // signalNavContext.equipmentData has prodPromoInfo but no raw contract equipment list
    // Always fetch from API for contract equipment list
    {
      // Fetch from API
      const [eqtResult, promoResult] = await Promise.all([
        getCtrtEquipmentList(ctrtId).catch((err) => { console.error('[fn_seteqt] getCtrtEquipmentList failed:', err); return []; }),
        getProdPromoInfo(ctrtId).catch((err) => { console.error('[fn_seteqt] getProdPromoInfo failed:', err); return []; }),
      ]);
      equipList = eqtResult;
      promoList = promoResult;
      console.log(`[fn_seteqt] Fetched from API: eqt=${equipList.length}, promo=${promoList.length}`);
      if (equipList.length > 0) console.log(`[fn_seteqt] First equip:`, JSON.stringify(equipList[0]));
      if (promoList.length > 0) console.log(`[fn_seteqt] First promo:`, JSON.stringify(promoList[0]));
    }

    console.log(`[fn_seteqt] PROD_GRP=${prodGrp}, PROD_CD=${prodCd}, VOIP_PROD_CD=${voipProdCd}, ISP_PROD_CD=${ispProdCd}, equipList=${equipList.length}, promoList=${promoList.length}`);

    const findByMid = (mid: string) => equipList.find((e: any) => (e.ITEM_MID_CD || '') === mid);
    const findByEqtCl = (cl: string) => equipList.find((e: any) => (e.EQT_CL_CD || e.EQT_CL || '') === cl);
    const getEqtNo = (mid: string) => findByMid(mid)?.EQT_NO || '';

    let eqtNo = '';
    let etc1 = '';
    let etc2 = '';
    let etc3 = '';
    let etc4 = '';
    let voipJoinCtrtId = '';
    let subProdCd = '';

    // === EQT_NO: legacy priority 05 → 01 → 03 → 02(I only) → 08 ===
    if (!voipProdCd) {
      // Non-VOIP
      if (findByMid('05')) eqtNo = getEqtNo('05');
      else if (findByMid('01')) eqtNo = getEqtNo('01');
      else if (findByMid('03')) eqtNo = getEqtNo('03');
      else if (findByMid('02') && prodGrp === 'I') eqtNo = getEqtNo('02');
      else if (findByMid('08')) eqtNo = getEqtNo('08');
    } else {
      // VOIP: eqt_no = 08(WiFi)
      if (findByMid('08')) eqtNo = getEqtNo('08');
    }

    // === ETC_1: legacy — non-VOIP:04, VOIP:02 ===
    if (!voipProdCd) {
      if (findByMid('04')) {
        etc1 = getEqtNo('04');
      } else if (prodGrp === 'A') {
        // Analog: net_cl value (simplified — no combo in mobile)
        etc1 = '';
      }
    } else {
      if (findByMid('02')) etc1 = getEqtNo('02');
    }

    // === ETC_2: legacy — 07 (POD/OOB) ===
    etc2 = getEqtNo('07');

    // === ETC_3: legacy — prod_grp=='C' → 02 ===
    if (prodGrp === 'C') etc3 = getEqtNo('02');

    // === ETC_4: legacy — prod_grp=='V' → 10, ISP_PROD_CD → 21 ===
    if (prodGrp === 'V' && findByMid('10')) {
      etc4 = getEqtNo('10');
    }
    if (ispProdCd) {
      etc4 = getEqtNo('21');
    }

    // === WRK_ID: legacy — EQT_CL_CD 091003 → 091004 → 092201(MAC) → WRK_ID ===
    let resolvedWrkId = wrkId;
    if (findByEqtCl('091003')) {
      resolvedWrkId = findByEqtCl('091003')?.EQT_NO || wrkId;
    } else if (findByEqtCl('091004')) {
      resolvedWrkId = findByEqtCl('091004')?.EQT_NO || wrkId;
    } else if (findByEqtCl('092201')) {
      resolvedWrkId = findByEqtCl('092201')?.MAC_ADDRESS || wrkId;
    }

    // === PROD_CD: legacy — PROD_CMPS_CL='11' promo PROD_CD ===
    const prodCdFromPromo = promoList.find((p: any) => p.PROD_CMPS_CL === '11')?.PROD_CD || '';

    // === SUB_PROD_CD: legacy — BASIC_PROD_FL='V' promo comma-separated ===
    const subProdParts: string[] = [];
    for (const p of promoList) {
      if ((p.BASIC_PROD_FL || '') === 'V') {
        subProdParts.push(p.PROD_CD || '');
      }
    }
    subProdCd = subProdParts.join(',');

    // === VoIP specific logic ===
    if (prodGrp === 'V') {
      const prodTyp = promoList[0]?.PROD_TYP || '';

      // VoIP single product detection
      if (VOIP_SINGLE_PROD_CDS.includes(prodCd) && prodTyp === '11') {
        const taPriority = ['090803', '090804', '090801', '090805'];
        for (const cl of taPriority) {
          const found = findByEqtCl(cl);
          if (found) { eqtNo = found.EQT_NO || ''; break; }
        }
        const modem = findByMid('04');
        if (modem) etc1 = modem.EQT_NO || '';
        voipJoinCtrtId = promoList[0]?.CTRT_ID || '';
      }

      if (VOIP_OTHER_CARRIER_CDS.includes(prodCd) && prodTyp === '11') {
        voipJoinCtrtId = ctrtId;
      }

      // VoIP WiFi override
      const wifiEqt = findByMid('08');
      if (wifiEqt) {
        const apEqt = findByMid('10');
        if (apEqt) {
          etc4 = apEqt.EQT_NO || '';
          eqtNo = wifiEqt.EQT_NO || '';
        }
      }
    }

    // === ISP_PROD_CD → VOIP_JOIN_CTRT_ID (legacy: cmb_ctrt_info.value) ===
    if (ispProdCd && !voipJoinCtrtId) {
      // Legacy uses combo value; closest match is first promo CTRT_ID
      voipJoinCtrtId = promoList[0]?.CTRT_ID || '';
    }

    console.log(`[fn_seteqt] Result: EQT_NO=${eqtNo}, ETC_1=${etc1}, ETC_2=${etc2}, ETC_3=${etc3}, ETC_4=${etc4}, WRK_ID=${resolvedWrkId}, SUB_PROD_CD=${subProdCd}, VOIP_JOIN=${voipJoinCtrtId}`);

    return {
      EQT_NO: eqtNo,
      ETC_1: etc1,
      ETC_2: etc2,
      ETC_3: etc3,
      ETC_4: etc4,
      VOIP_JOIN_CTRT_ID: voipJoinCtrtId,
      SUB_PROD_CD: subProdCd,
      PROD_CD: prodCdFromPromo,
      EQT_PROD_CMPS_ID: '',
      WRK_ID: resolvedWrkId,
      IF_DTL_ID: ifDtlId,
      WTIME: '3',
    };
  };

  // ===== 5-B: Result post-processing (legacy transSendHistory callback) =====
  const postProcessBasicHistories = (items: SendHistory[]): SendHistory[] => {
    return items.map(item => {
      const processed = { ...item };

      // 1. LDAP error display (legacy line 917-928)
      if (processed.IS_LDAP_ERROR === 'ERROR_LDAP') {
        processed.PROC_RSLT_CD_NM = (processed.PROC_RSLT_CD_NM || '').replace('정상처리', '정상') + '(LDAP오류)';
      } else {
        processed.PROC_RSLT_CD_NM = (processed.PROC_RSLT_CD_NM || '').replace('정상처리', '정상');
      }

      // 2. CG/GO result code conversion (legacy line 930-991)
      if (processed.IF_SEND_GB === 'CG') {
        // RSLT_CD
        if (processed.RSLT_CD === '000000' && processed.RSLT_CD_NDS === '000000') {
          processed.RSLT_CD_NM = '정상전송';
        } else if (processed.RSLT_CD === 'N' || processed.RSLT_CD_NDS === 'N') {
          processed.RSLT_CD_NM = '처리중';
        } else {
          processed.RSLT_CD_NM = '기타오류';
        }
        // PROC_RSLT_CD
        if (processed.PROC_RSLT_CD === '000000' && processed.PROC_RSLT_CD_NDS === '000000') {
          processed.PROC_RSLT_CD_NM = '정상';
        } else if (processed.PROC_RSLT_CD === 'N' || processed.PROC_RSLT_CD_NDS === 'N') {
          processed.PROC_RSLT_CD_NM = '처리중';
        } else {
          processed.PROC_RSLT_CD_NM = '기타오류';
        }
      } else if (processed.IF_SEND_GB === 'GO') {
        // NDS result only
        if (processed.RSLT_CD_NDS === '000000') {
          processed.RSLT_CD_NM = '정상전송';
        } else if (processed.RSLT_CD_NDS === 'N') {
          processed.RSLT_CD_NM = '처리중';
        } else if (processed.RSLT_CD_NDS) {
          processed.RSLT_CD_NM = '기타오류';
        }
        if (processed.PROC_RSLT_CD_NDS === '000000') {
          processed.PROC_RSLT_CD_NM = '정상';
        } else if (processed.PROC_RSLT_CD_NDS === 'N') {
          processed.PROC_RSLT_CD_NM = '처리중';
        } else if (processed.PROC_RSLT_CD_NDS) {
          processed.PROC_RSLT_CD_NM = '기타오류';
        }
      }

      return processed;
    });
  };

  // Customer selected (CustomerInfo from CustomerSearch component)
  const handleCustomerSelected = async (customer: CustomerInfo) => {
    setSelectedCustomer(customer);
    setContracts([]); setSelectedContract(null);
    clearHistories();
    setIsLoadingContracts(true);

    if (customer.CTRT_ID) {
      const ctrt: ContractInfo = {
        CTRT_ID: customer.CTRT_ID,
        CUST_ID: customer.CUST_ID,
        BASIC_PROD_CD_NM: (customer as any).BASIC_PROD_CD_NM || (customer as any).PROD_NM,
        CTRT_STAT_NM: (customer as any).CTRT_STAT_NM,
        SO_NM: (customer as any).SO_NM,
        ADDR: customer.CUST_ADDR || customer.INST_ADDR || (customer as any).ADDR,
        PROD_GRP: (customer as any).PROD_GRP,
      };
      setSelectedContract(ctrt);
      setDirectCtrtId(customer.CTRT_ID);
    }

    if (customer.CUST_ID) {
      try {
        const list = await getContractList(customer.CUST_ID);
        if (list.length > 0) {
          setContracts(list);
          const searchedCtrtId = customer.CTRT_ID;
          if (searchedCtrtId) {
            const match = list.find((c: any) => c.CTRT_ID === searchedCtrtId);
            if (match) {
              setSelectedContract(match);
              setDirectCtrtId(match.CTRT_ID);
              setSignalType(detectSignalType(match));
            } else {
              setDirectCtrtId(searchedCtrtId);
            }
          } else if (!selectedContract && list.length === 1) {
            setSelectedContract(list[0]);
            setDirectCtrtId(list[0].CTRT_ID);
            setSignalType(detectSignalType(list[0]));
          }
        }
      } catch (err) {
        console.error('Failed to load contract list:', err);
      } finally {
        setIsLoadingContracts(false);
      }
    } else {
      setIsLoadingContracts(false);
    }

    if (customer.CTRT_ID) setPendingAutoSearch(true);
  };

  useEffect(() => {
    if (pendingAutoSearch && !isLoadingContracts && directCtrtId && cacheLoaded) {
      setPendingAutoSearch(false);
      handleSearchHistory();
    }
  }, [pendingAutoSearch, isLoadingContracts, directCtrtId, cacheLoaded]);

  const handleContractSelect = (contract: ContractInfo) => {
    if (selectedContract?.CTRT_ID === contract.CTRT_ID && isContractCollapsed) {
      setIsContractCollapsed(false);
      return;
    }
    setSelectedContract(contract);
    setDirectCtrtId(contract.CTRT_ID);
    clearHistories();
    setSignalType(detectSignalType(contract));
    setIsContractCollapsed(false);
  };

  // Search history
  const handleSearchHistory = async (overrideDateFrom?: string, overrideDateTo?: string) => {
    const ctrtId = directCtrtId.trim();
    if (!ctrtId) { setAlertDialog({ message: '계약ID를 입력하세요.', type: 'warning' }); return; }

    setIsLoadingHistory(true);
    clearHistories();
    setIsContractCollapsed(true);

    try {
      // 계약 선택 없이 직접 계약ID 입력한 경우 → 계약정보 조회해서 상품명/signalType 세팅
      let currentSignalType = signalType;
      if (!selectedContract && !signalNavContext?.ctrtId) {
        try {
          const ctrtInfo = await getCustomerCtrtInfo(ctrtId);
          const ctrtData = ctrtInfo?.data?.[0] || ctrtInfo?.output?.[0] || ctrtInfo || {};
          if (ctrtData.CTRT_ID || ctrtData.BASIC_PROD_CD || ctrtData.CUST_ID) {
            const contract: ContractInfo = {
              CTRT_ID: ctrtId,
              CUST_ID: ctrtData.CUST_ID || '',
              BASIC_PROD_CD_NM: ctrtData.BASIC_PROD_CD_NM || ctrtData.PROD_NM || '',
              BASIC_PROD_CD: ctrtData.BASIC_PROD_CD || '',
              PROD_CD: ctrtData.BASIC_PROD_CD || '',
              SO_ID: ctrtData.SO_ID || '',
              SO_NM: ctrtData.SO_NM || '',
              PROD_GRP: ctrtData.PROD_GRP || '',
              CTRT_STAT_NM: ctrtData.CTRT_STAT_NM || '',
              ADDR: ctrtData.ADDR || ctrtData.INSTL_ADDR || '',
            };
            setSelectedContract(contract);
            const detected = detectSignalType(contract);
            setSignalType(detected);
            currentSignalType = detected;
            console.log(`[신호연동] 계약ID 직접입력 조회: ${ctrtId}, 상품=${contract.BASIC_PROD_CD_NM}, signalType=${detected}`);
          } else {
            setAlertDialog({ message: '입력하신 계약은 조회되지 않습니다.', type: 'warning' });
            setIsLoadingHistory(false);
            return;
          }
        } catch (err) {
          console.error('[신호연동] 계약정보 조회 실패:', err);
          setAlertDialog({ message: '입력하신 계약은 조회되지 않습니다.', type: 'warning' });
          setIsLoadingHistory(false);
          return;
        }
      }

      const from = (overrideDateFrom || dateFrom).replace(/-/g, '');
      const toDate = new Date(overrideDateTo || dateTo);
      toDate.setDate(toDate.getDate() + 1);
      const toStr = toDate.toISOString().slice(0, 10).replace(/-/g, '');

      const baseParams: any = { CTRT_ID: ctrtId, STRT_DTTM1: from, STRT_DTTM2: toStr, CALL_GB: 'M' };

      if (currentSignalType === 'basic') {
        const data = await getSendHistory(baseParams);
        setBasicHistories(postProcessBasicHistories(data.slice(0, 100)));
      } else if (currentSignalType === 'lgu') {
        console.log(`[LGHV이력] 조회 시작 | signalType=${currentSignalType}, CTRT_ID=${ctrtId}, from=${from}, to=${toStr}`);
        const data = await getLghvSendHist(baseParams);
        console.log(`[LGHV이력] 조회 결과: ${data.length}건`, data.length > 0 ? data[0] : 'empty');
        setLguHistories(data.slice(0, 100));
      } else {
        const data = await getCertifyApiHist({ CTRT_ID: ctrtId, STRT_DTTM1: from, STRT_DTTM2: toStr });
        setFtthHistories(data.slice(0, 100));
      }
    } catch (err) {
      console.error('Signal history query error:', err);
      setAlertDialog({ message: '통신이력 조회에 실패했습니다.', type: 'error' });
    } finally {
      setIsLoadingHistory(false);
    }
  };

  // "Today" button handler (legacy btn_search2_OnClick)
  const handleSearchToday = () => {
    const today = new Date().toISOString().slice(0, 10);
    setDateFrom(today);
    setDateTo(today);
    handleSearchHistory(today, today);
  };

  // Re-search with current date range (after action buttons)
  const reSearchToday = () => {
    // Keep existing date range instead of overriding to today
    setTimeout(() => handleSearchHistory(), 300);
  };

  // Select basic history row
  const handleBasicHistorySelect = async (item: SendHistory) => {
    setSelectedBasicHistory(item);
    setBasicSvcRslt([]); setBasicDtlRslt([]);
    if (!item.IF_DTL_ID) return;
    setIsLoadingDetail(true);
    try {
      const { svcRslt, svcDtlRslt } = await getSvcRsltAndDtlRslt(item.IF_DTL_ID);
      setBasicSvcRslt(svcRslt);
      setBasicDtlRslt(svcDtlRslt);
      setTimeout(() => detailRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
    } catch (err) {
      console.error('Detail query error:', err);
    } finally {
      setIsLoadingDetail(false);
    }
  };

  // Select LGU history row
  const handleLguHistorySelect = async (item: LghvSendHistory) => {
    setSelectedLguHistory(item);
    setLguSvcResults([]);
    if (!item.JOB_ID) return;
    setIsLoadingDetail(true);
    try {
      const data = await getLghvSvcRslt(item.JOB_ID);
      setLguSvcResults(data);
    } catch (err) {
      console.error('LGU detail query error:', err);
    } finally {
      setIsLoadingDetail(false);
    }
  };

  // ===== 5-C: Action button handlers =====

  // Helper: get first history row
  const getFirstBasicRow = (): SendHistory | null => basicHistories.length > 0 ? basicHistories[0] : null;

  // Error resend (btn_err_resend) - modSvcDtlErrResend
  const handleErrorResend = async () => {
    if (basicHistories.length === 0 || basicSvcRslt.length === 0) {
      setAlertDialog({ message: '오류재전송 대상이 없습니다.', type: 'warning' });
      return;
    }
    const row = getFirstBasicRow();
    if (!row) return;

    // Validation (legacy line 1384-1583)
    const isLdapError = row.IS_LDAP_ERROR === 'ERROR_LDAP';

    if (!isLdapError) {
      if (row.RSLT_CD !== '000000') {
        setAlertDialog({ message: '전송결과가 정상전송인 건만 오류재전송 가능합니다.', type: 'warning' });
        return;
      }
      if (row.PROC_RSLT_CD === '000000') {
        setAlertDialog({ message: '처리결과가 정상인 건은 오류재전송할 수 없습니다.', type: 'warning' });
        return;
      }

      if (row.MSG_ID !== 'SMR03' && row.MSG_ID !== 'SMR53') {
        setAlertDialog({ message: 'SMR03 또는 SMR53 메세지만 오류재전송 가능합니다.', type: 'warning' });
        return;
      }

      const eqtCl = row.EQT_CL || '';
      if (eqtCl.substring(0, 4) !== '0904') {
        setAlertDialog({ message: '장비구분이 0904인 건만 오류재전송 가능합니다.', type: 'warning' });
        return;
      }
    }

    const hasSystemError = basicSvcRslt.some(r =>
      r.SYSTEM_RSLT_CD && r.SYSTEM_RSLT_CD !== '000000' && r.SYSTEM_RSLT_CD !== 'N'
    );
    if (!hasSystemError && !isLdapError) {
      setAlertDialog({ message: '오류가 발생한 시스템이 없습니다.', type: 'warning' });
      return;
    }

    setConfirmDialog({
      message: '기타오류 재전송을 실행하시겠습니까?',
      onConfirm: async () => {
        setConfirmDialog(null);
        setIsActionLoading(true);
        try {
          const result = await modSvcDtlErrResend(row.IF_DTL_ID);
          setAlertDialog({ message: result.RSLT_MSG ? `오류재전송: ${result.RSLT_MSG}` : '오류재전송 작업이 정상 처리되었습니다.', type: 'success' });
          reSearchToday();
        } catch (err) {
          setAlertDialog({ message: '오류재전송에 실패했습니다.', type: 'error' });
        } finally {
          setIsActionLoading(false);
        }
      }
    });
  };

  // iTV init resend (btn_err_resend_2) - modSvcDtlErrResend_2
  const handleItvInitResend = async () => {
    const row = getFirstBasicRow();
    if (!row) { setAlertDialog({ message: '이력이 없습니다.', type: 'warning' }); return; }

    if (row.RSLT_CD !== '000000') {
      setAlertDialog({ message: '전송결과가 정상전송인 건만 iTV초기화 가능합니다.', type: 'warning' });
      return;
    }
    if (row.PROC_RSLT_CD === '000000') {
      setAlertDialog({ message: '처리결과가 정상인 건은 iTV초기화할 수 없습니다.', type: 'warning' });
      return;
    }
    if (row.MSG_ID !== 'SMR59') {
      setAlertDialog({ message: 'SMR59 메세지만 iTV초기화 가능합니다.', type: 'warning' });
      return;
    }

    setConfirmDialog({
      message: 'iTV초기화 재전송을 실행하시겠습니까?',
      onConfirm: async () => {
        setConfirmDialog(null);
        setIsActionLoading(true);
        try {
          const result = await modSvcDtlErrResend_2(row.IF_DTL_ID);
          setAlertDialog({ message: result.RSLT_MSG ? `iTV초기화: ${result.RSLT_MSG}` : 'iTV초기화 작업이 정상 처리되었습니다.', type: 'success' });
          reSearchToday();
        } catch (err) {
          setAlertDialog({ message: 'iTV초기화에 실패했습니다.', type: 'error' });
        } finally {
          setIsActionLoading(false);
        }
      }
    });
  };

  // Termination (Button2) - SMR05 or CL-06
  const handleTerminationSignal = async () => {
    const ctrtId = directCtrtId.trim();
    if (!ctrtId) { setAlertDialog({ message: '계약ID가 없습니다.', type: 'warning' }); return; }

    const msgLabel = signalType === 'ftth' ? '해지(CL-06)' : signalType === 'lgu' ? '해지(STB_DEL)' : '해지(SMR05)';
    setConfirmDialog({
      message: `${msgLabel} 신호를 전송하시겠습니까?`,
      onConfirm: async () => {
        setConfirmDialog(null);
        setIsActionLoading(true);
        try {
          if (signalType === 'ftth') {
            const custId = selectedContract?.CUST_ID || '';
            const soId = selectedContract?.SO_ID || '';
            const result = await setCertifyCL06({
              CTRT_ID: ctrtId,
              CUST_ID: custId,
              SO_ID: soId,
              REG_UID: userInfo?.userId || 'SYSTEM',
            });
            if (result && !result.ERROR) {
              setAlertDialog({ message: '해지(CL-06) 신호가 정상 전송되었습니다.', type: 'success' });
            } else {
              setAlertDialog({ message: `해지(CL-06) 실패: ${result?.ERROR || '알 수 없는 오류'}`, type: 'error' });
            }
          } else {
            const ctrtInfo = await getCustomerCtrtInfo(ctrtId);
            const ctrtData = ctrtInfo?.data?.[0] || ctrtInfo?.output?.[0] || ctrtInfo || {};
            console.log(`[해지신호] ctrtData:`, JSON.stringify({ PROD_GRP: ctrtData.PROD_GRP, BASIC_PROD_CD: ctrtData.BASIC_PROD_CD, SO_ID: ctrtData.SO_ID, CUST_ID: ctrtData.CUST_ID, VOIP_PROD_CD: ctrtData.VOIP_PROD_CD, ISP_PROD_CD: ctrtData.ISP_PROD_CD }));

            // LGHV: STB_DEL, 일반: SMR05
            const msgId = signalType === 'lgu' ? 'STB_DEL' : 'SMR05';

            // Populate equipment params (fn_seteqt)
            const eqtParams = await populateEquipmentParams(ctrtId, ctrtData);
            console.log(`[해지신호] eqtParams:`, JSON.stringify(eqtParams));

            const signalParams: SignalParams = {
              ...eqtParams,
              MSG_ID: msgId,
              CUST_ID: ctrtData.CUST_ID || selectedContract?.CUST_ID || '',
              CTRT_ID: ctrtId,
              SO_ID: ctrtData.SO_ID || selectedContract?.SO_ID || '',
              PROD_CD: '', // legacy: termination sends empty PROD_CD
              REG_UID: userInfo?.userId || 'SYSTEM',
            };
            console.log(`[해지신호] 최종 signalParams:`, JSON.stringify(signalParams));

            const result = await sendSignal(signalParams);
            if (result.code === 'SUCCESS') {
              setAlertDialog({ message: `${msgLabel} 신호가 정상 전송되었습니다.`, type: 'success' });
            } else {
              setAlertDialog({ message: `해지 전송 결과: ${result.message}`, type: result.code === 'ERROR' ? 'error' : 'warning' });
            }
          }
          reSearchToday();
        } catch (err) {
          setAlertDialog({ message: '해지 신호 전송에 실패했습니다.', type: 'error' });
        } finally {
          setIsActionLoading(false);
        }
      }
    });
  };

  // Activation (Button4) - SMR03 or CL-03→CL-04
  const handleActivationSignal = async () => {
    const ctrtId = directCtrtId.trim();
    if (!ctrtId) { setAlertDialog({ message: '계약ID가 없습니다.', type: 'warning' }); return; }

    const actLabel = signalType === 'ftth' ? '개통(CL-03→CL-04)' : signalType === 'lgu' ? '개통(STB_CRT)' : '개통(SMR03)';
    setConfirmDialog({
      message: `${actLabel} 신호를 전송하시겠습니까?`,
      onConfirm: async () => {
        setConfirmDialog(null);
        setIsActionLoading(true);
        try {
          if (signalType === 'ftth') {
            const custId = selectedContract?.CUST_ID || '';
            const soId = selectedContract?.SO_ID || '';
            const regUid = userInfo?.userId || 'SYSTEM';
            const basicProdCd = selectedContract?.BASIC_PROD_CD || '';

            // CL-03: concentrator inquiry
            const cl03Result = await getCertifyCL03({
              CONT_ID: ctrtId,
              CUST_ID: custId,
              SO_ID: soId,
              REG_UID: regUid,
              WRK_ID: '',
            });
            console.log('[FTTH개통] CL-03 result:', JSON.stringify(cl03Result));

            if (cl03Result) {
              // Build CL-04 params from CL-03 response (legacy: ds_certify_cl03 → CL-04)
              const cl04Params: any = {
                CONT_ID: ctrtId,
                CUST_ID: custId,
                WRK_ID: '',
                SO_ID: soId,
                REG_UID: regUid,
                // Equipment info from CL-03 response
                T: cl03Result.T || '',
                ONT_MAC: cl03Result.ONT_MAC || '',
                ONT_SERIAL: cl03Result.ONT_SERIAL || '',
                AP_MAC: cl03Result.AP_MAC || '',
                DEV_ID: cl03Result.DEV_ID || '',
                IP: cl03Result.IP || '',
                PORT: cl03Result.PORT || '',
                MAX_SPEED: cl03Result.MAX_SPEED || '',
                ST: cl03Result.ST || '',
                // Product info (legacy: SVC=BASIC_PROD_CD, ADD_ON=SUB_PROD_CD)
                SVC: basicProdCd,
                REASON: '',
              };
              console.log('[FTTH개통] CL-04 params:', JSON.stringify(cl04Params));

              const cl04Result = await setCertifyCL04(cl04Params);
              if (cl04Result.code !== 'ERROR') {
                setAlertDialog({ message: '개통(CL-03→CL-04) 신호가 정상 전송되었습니다.', type: 'success' });
              } else {
                setAlertDialog({ message: `개통(CL-04) 실패: ${cl04Result.message}`, type: 'error' });
              }
            } else {
              setAlertDialog({ message: '개통(CL-03) 조회 실패', type: 'error' });
            }
          } else {
            const ctrtInfo = await getCustomerCtrtInfo(ctrtId);
            const ctrtData = ctrtInfo?.data?.[0] || ctrtInfo?.output?.[0] || ctrtInfo || {};
            console.log(`[개통신호] ctrtData:`, JSON.stringify({ PROD_GRP: ctrtData.PROD_GRP, BASIC_PROD_CD: ctrtData.BASIC_PROD_CD, SO_ID: ctrtData.SO_ID, CUST_ID: ctrtData.CUST_ID }));

            // LGHV: STB_CRT, VoIP: SMR60, 일반: SMR03
            let msgId = signalType === 'lgu' ? 'STB_CRT' : 'SMR03';
            if (ctrtData.PROD_GRP === 'V') msgId = 'SMR60'; // VoIP activation

            // Populate equipment params (fn_seteqt)
            const eqtParams = await populateEquipmentParams(ctrtId, ctrtData);
            console.log(`[개통신호] eqtParams:`, JSON.stringify(eqtParams));

            const signalParams: SignalParams = {
              ...eqtParams,  // EQT_NO, ETC_1~4, WRK_ID, IF_DTL_ID, SUB_PROD_CD, PROD_CD, WTIME
              MSG_ID: msgId,
              CUST_ID: ctrtData.CUST_ID || selectedContract?.CUST_ID || '',
              CTRT_ID: ctrtId,
              SO_ID: ctrtData.SO_ID || selectedContract?.SO_ID || '',
              REG_UID: userInfo?.userId || 'SYSTEM',
            };
            console.log(`[개통신호] 최종 signalParams:`, JSON.stringify(signalParams));

            const result = await sendSignal(signalParams);
            if (result.code === 'SUCCESS') {
              setAlertDialog({ message: `${actLabel} 신호가 정상 전송되었습니다.`, type: 'success' });
            } else {
              setAlertDialog({ message: `개통 전송 결과: ${result.message}`, type: result.code === 'ERROR' ? 'error' : 'warning' });
            }
          }
          reSearchToday();
        } catch (err) {
          setAlertDialog({ message: '개통 신호 전송에 실패했습니다.', type: 'error' });
        } finally {
          setIsActionLoading(false);
        }
      }
    });
  };

  // Signal bot (신호연동봇 - moifa01m03 rcp_btn_OnClick)
  const handleSignalBot = async () => {
    const ctrtId = directCtrtId.trim();
    if (!ctrtId) { setAlertDialog({ message: '계약ID가 없습니다.', type: 'warning' }); return; }

    if (basicHistories.length === 0) {
      setAlertDialog({ message: '조회 후 수행해 주세요.', type: 'warning' });
      return;
    }

    setConfirmDialog({
      message: '신호연동봇 수행하시겠습니까?',
      onConfirm: async () => {
        setConfirmDialog(null);
        setIsActionLoading(true);
        try {
          const ctrtInfo = await getCustomerCtrtInfo(ctrtId);
          const ctrtData = ctrtInfo?.data?.[0] || ctrtInfo?.output?.[0] || ctrtInfo || {};
          const custId = ctrtData.CUST_ID || selectedContract?.CUST_ID || '';
          const soId = ctrtData.SO_ID || selectedContract?.SO_ID || '';
          const prodCd = ctrtData.BASIC_PROD_CD || '';

          // VoIP: SMR68, 일반: SMR53 (legacy 2020.4.22)
          const msgId = ctrtData.PROD_GRP === 'V' ? 'SMR68' : 'SMR53';

          // Populate equipment params (fn_seteqt)
          const eqtParams = await populateEquipmentParams(ctrtId, ctrtData);

          const signalParams: SignalParams = {
            ...eqtParams,  // EQT_NO, ETC_1~4, WRK_ID, IF_DTL_ID, SUB_PROD_CD, PROD_CD, WTIME
            MSG_ID: msgId,
            CUST_ID: custId,
            CTRT_ID: ctrtId,
            SO_ID: soId,
            REG_UID: userInfo?.userId || 'SYSTEM',
          };

          const result = await sendSignal(signalParams);
          if (result.code === 'SUCCESS') {
            setAlertDialog({ message: '신호연동봇 수행을 하였습니다.', type: 'success' });
          } else {
            setAlertDialog({ message: `신호연동봇 결과: ${result.message}`, type: result.code === 'ERROR' ? 'error' : 'warning' });
          }
          reSearchToday();
        } catch (err) {
          setAlertDialog({ message: '신호연동봇 수행에 실패했습니다.', type: 'error' });
        } finally {
          setIsActionLoading(false);
        }
      }
    });
  };

  // Filtered contracts
  const activeContracts = contracts.filter(c => c.CTRT_STAT_NM === '사용' || c.CTRT_STAT === '20');
  const baseContracts = contractFilter === 'active' ? activeContracts : contracts;
  const filteredContracts = contractSearch
    ? baseContracts.filter(c =>
        (c.CTRT_ID || '').includes(contractSearch) ||
        (c.BASIC_PROD_CD_NM || c.PROD_NM || '').includes(contractSearch) ||
        (c.ADDR || c.INSTL_ADDR || '').includes(contractSearch)
      )
    : baseContracts;

  const historyCount = signalType === 'basic' ? basicHistories.length : signalType === 'lgu' ? lguHistories.length : ftthHistories.length;
  const hasHistories = historyCount > 0;

  // 5-C visibility: ftth hides most buttons
  const isFtth = signalType === 'ftth';

  return (
    <div className="flex-1 overflow-y-auto px-3 pt-2 pb-4 space-y-3">
      {/* Confirm Dialog */}
      {confirmDialog && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 px-6">
          <div className="bg-white rounded-xl shadow-xl p-5 max-w-sm w-full">
            <p className="text-sm text-gray-800 mb-4">{confirmDialog.message}</p>
            <div className="flex gap-2">
              <button onClick={() => setConfirmDialog(null)} className="flex-1 py-2 text-sm bg-gray-100 text-gray-600 rounded-lg hover:bg-gray-200">취소</button>
              <button onClick={confirmDialog.onConfirm} className="flex-1 py-2 text-sm bg-primary-500 text-white rounded-lg hover:bg-primary-600">확인</button>
            </div>
          </div>
        </div>
      )}

      {/* Alert Dialog (확인만) */}
      {alertDialog && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 px-6">
          <div className="bg-white rounded-xl shadow-xl p-5 max-w-sm w-full">
            <div className="flex items-start gap-3 mb-4">
              <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${alertDialog.type === 'success' ? 'bg-green-100' : alertDialog.type === 'error' ? 'bg-red-100' : 'bg-yellow-100'}`}>
                {alertDialog.type === 'success' ? (
                  <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                ) : alertDialog.type === 'error' ? (
                  <svg className="w-5 h-5 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                ) : (
                  <svg className="w-5 h-5 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4.5c-.77-.833-2.694-.833-3.464 0L3.34 16.5c-.77.833.192 2.5 1.732 2.5z" /></svg>
                )}
              </div>
              <p className="text-sm text-gray-800 pt-1.5">{alertDialog.message}</p>
            </div>
            <button onClick={() => setAlertDialog(null)} className={`w-full py-2.5 text-sm font-medium rounded-lg ${alertDialog.type === 'success' ? 'bg-green-500 hover:bg-green-600 text-white' : alertDialog.type === 'error' ? 'bg-red-500 hover:bg-red-600 text-white' : 'bg-yellow-500 hover:bg-yellow-600 text-white'}`}>확인</button>
          </div>
        </div>
      )}

      {/* Action loading overlay */}
      {isActionLoading && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl p-6 flex flex-col items-center">
            <div className="animate-spin rounded-full h-8 w-8 border-[3px] border-primary-500 border-t-transparent"></div>
            <p className="mt-3 text-sm text-gray-600">처리 중...</p>
          </div>
        </div>
      )}

      {/* Customer Search - 고객관리와 동일한 컴포넌트 사용 */}
      <CustomerSearch
        onCustomerSelect={handleCustomerSelected}
        onCustomerClear={() => {
          setSelectedCustomer(null);
          setContracts([]);
          setSelectedContract(null);
          clearHistories();
        }}
        showToast={showToast}
        selectedCustomer={selectedCustomer}
      />

      {/* Contract Loading */}
      {isLoadingContracts && (
        <div className="text-center py-8 bg-white rounded-lg shadow-sm border border-gray-200">
          <div className="inline-block animate-spin rounded-full h-6 w-6 border-[3px] border-primary-500 border-t-transparent"></div>
          <p className="mt-2 text-sm text-gray-500">계약 정보 조회 중...</p>
        </div>
      )}

      {/* Contract List */}
      {contracts.length > 0 && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
          <button
            onClick={() => setIsContractCollapsed(!isContractCollapsed)}
            className="w-full px-3 py-2.5 border-b border-gray-100 flex items-center justify-between hover:bg-gray-50 transition-colors"
          >
            <h3 className="text-sm font-bold text-gray-800 flex items-center gap-1.5">
              <span className="text-primary-700">|</span> 계약 현황 <span className="text-primary-700 font-normal">({filteredContracts.length}건)</span>
              {isContractCollapsed && selectedContract && (
                <span className="text-xs font-normal text-gray-500 ml-1">
                  - {formatCtrtId(selectedContract.CTRT_ID)} ({selectedContract.BASIC_PROD_CD_NM || selectedContract.PROD_NM || ''})
                </span>
              )}
            </h3>
            {isContractCollapsed ? <ChevronDown className="h-4 w-4 text-gray-400" /> : <ChevronUp className="h-4 w-4 text-gray-400" />}
          </button>

          {!isContractCollapsed && (
            <>
              <div className="px-3 py-1.5 border-b border-gray-100 flex items-center justify-end">
                <div className="flex gap-1">
                  <button onClick={() => setContractFilter('all')} className={`px-2.5 py-1 text-xs rounded-full font-medium ${contractFilter === 'all' ? 'bg-primary-500 text-white' : 'bg-gray-100 text-gray-500'}`}>전체({contracts.length})</button>
                  <button onClick={() => setContractFilter('active')} className={`px-2.5 py-1 text-xs rounded-full font-medium ${contractFilter === 'active' ? 'bg-primary-500 text-white' : 'bg-gray-100 text-gray-500'}`}>사용계약({activeContracts.length})</button>
                </div>
              </div>
              <div className="px-3 py-2 border-b border-gray-50">
                <div className="relative">
                  <Filter className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
                  <input type="text" value={contractSearch} onChange={(e) => setContractSearch(e.target.value)} className="w-full pl-8 pr-3 py-1.5 text-xs border border-gray-200 rounded-md bg-gray-50 focus:bg-white focus:border-primary-300 focus:outline-none" placeholder="계약ID, 상품명, 장비번호 검색" />
                </div>
              </div>
              <div className={`${showAllContracts ? 'max-h-72' : 'max-h-44'} overflow-y-auto`}>
                {filteredContracts.map((contract, idx) => (
                  <button key={contract.CTRT_ID || idx} onClick={() => handleContractSelect(contract)} className={`w-full text-left px-3 py-2.5 border-b border-gray-50 transition-colors ${selectedContract?.CTRT_ID === contract.CTRT_ID ? 'bg-primary-50 border-l-3 border-l-primary-500' : 'hover:bg-gray-50'}`}>
                    <div className="flex items-start gap-2.5">
                      <span className={`flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${selectedContract?.CTRT_ID === contract.CTRT_ID ? 'bg-primary-500 text-white' : 'bg-gray-200 text-gray-600'}`}>{idx + 1}</span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <p className="text-sm font-medium text-gray-900 truncate">{contract.BASIC_PROD_CD_NM || contract.PROD_NM || '-'}</p>
                          <span className={`text-xs px-2 py-0.5 rounded-full flex-shrink-0 ml-2 ${contract.CTRT_STAT_NM === '사용' ? 'bg-green-100 text-green-700' : contract.CTRT_STAT_NM === '설치대기' ? 'bg-primary-100 text-primary-700' : contract.CTRT_STAT_NM === '해지' ? 'bg-red-100 text-red-600' : 'bg-gray-100 text-gray-600'}`}>{contract.CTRT_STAT_NM || '-'}</span>
                        </div>
                        <div className="flex items-center gap-2 mt-1 text-xs text-gray-500">
                          <span>계약 ID: {formatCtrtId(contract.CTRT_ID)}</span>
                          <span className="text-gray-300">|</span>
                          <span>{contract.SO_NM || 'N/A'}</span>
                        </div>
                        {(contract.ADDR || contract.INSTL_ADDR) && <p className="mt-0.5 text-xs text-gray-400 truncate">{contract.INSTL_ADDR || contract.ADDR}</p>}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
              {filteredContracts.length > 3 && (
                <button onClick={() => setShowAllContracts(!showAllContracts)} className="w-full py-1.5 text-xs text-primary-700 hover:bg-primary-50 flex items-center justify-center gap-1">
                  {showAllContracts ? <><ChevronUp className="h-3 w-3" /> 접기</> : <><ChevronDown className="h-3 w-3" /> 더보기</>}
                </button>
              )}
            </>
          )}
        </div>
      )}

      {/* Search Conditions */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-3 space-y-3">
        <div className="flex items-center gap-2">
          <label className="text-xs font-medium text-gray-600 w-14 flex-shrink-0">계약ID</label>
          <input type="text" value={directCtrtId} onChange={(e) => setDirectCtrtId(e.target.value)} className="flex-1 px-3 py-2 text-sm border border-gray-300 rounded-lg focus:border-primary-400 focus:outline-none" placeholder="계약ID 입력" maxLength={15} />
        </div>
        {/* 상품명 표시 (계약 선택 또는 작업완료에서 진입 시) */}
        {(selectedContract || signalNavContext?.prodNm) && (
          <div className="flex items-center gap-2">
            <label className="text-xs font-medium text-gray-600 w-14 flex-shrink-0">상품명</label>
            <span className="flex-1 px-3 py-1.5 text-sm text-gray-700 bg-gray-50 border border-gray-200 rounded-lg truncate">
              {selectedContract?.BASIC_PROD_CD_NM || selectedContract?.PROD_NM || signalNavContext?.prodNm || '-'}
              {signalType === 'lgu' && <span className="ml-1.5 text-xs text-blue-600 font-medium">(LGHV)</span>}
              {signalType === 'ftth' && <span className="ml-1.5 text-xs text-purple-600 font-medium">(FTTH)</span>}
            </span>
          </div>
        )}
        <div className="flex items-center gap-1.5">
          <label className="text-xs font-medium text-gray-600 w-10 flex-shrink-0">기간</label>
          <div className="flex-1 min-w-0 relative">
            <div className="px-2.5 py-2.5 text-[13px] border border-gray-300 rounded-lg bg-white text-gray-700 pointer-events-none">{dateFrom}</div>
            <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="absolute inset-0 opacity-0 w-full h-full cursor-pointer" style={{ colorScheme: 'light' }} />
          </div>
          <span className="text-gray-400 text-xs flex-shrink-0">~</span>
          <div className="flex-1 min-w-0 relative">
            <div className="px-2.5 py-2.5 text-[13px] border border-gray-300 rounded-lg bg-white text-gray-700 pointer-events-none">{dateTo}</div>
            <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="absolute inset-0 opacity-0 w-full h-full cursor-pointer" style={{ colorScheme: 'light' }} />
          </div>
        </div>

        <div className="flex gap-2">
          <button onClick={() => handleSearchHistory()} disabled={isLoadingHistory} className="flex-1 bg-primary-500 hover:bg-primary-600 text-white py-2.5 rounded-lg font-medium text-sm shadow-sm transition-all disabled:bg-gray-400 disabled:cursor-not-allowed">
            {isLoadingHistory ? '조회 중...' : '조회'}
          </button>
        </div>
      </div>

      {/* Action Buttons - 항상 표시 (signalNavContext 있으면 작업유형별 활성화/비활성화) */}
      {(directCtrtId.trim() || signalNavContext) && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-2.5">
          <div className="grid grid-cols-3 gap-1.5 sm:grid-cols-5">
            <button onClick={handleTerminationSignal} disabled={isActionLoading || !buttonEnabled.termination} className={`py-2.5 text-xs font-medium rounded-lg transition-colors border ${buttonEnabled.termination ? 'bg-red-50 text-red-700 hover:bg-red-100 active:bg-red-200 border-red-100' : 'bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed'} disabled:opacity-50`}>해지</button>
            <button onClick={handleActivationSignal} disabled={isActionLoading || !buttonEnabled.activation} className={`py-2.5 text-xs font-medium rounded-lg transition-colors border ${buttonEnabled.activation ? 'bg-green-50 text-green-700 hover:bg-green-100 active:bg-green-200 border-green-100' : 'bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed'} disabled:opacity-50`}>개통</button>
            {!isFtth && (
              <>
                <button onClick={handleItvInitResend} disabled={isActionLoading || !buttonEnabled.itvInit} className={`py-2.5 text-xs font-medium rounded-lg transition-colors border ${buttonEnabled.itvInit ? 'bg-purple-50 text-purple-700 hover:bg-purple-100 active:bg-purple-200 border-purple-100' : 'bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed'} disabled:opacity-50`}>iTV초기화</button>
                <button onClick={handleErrorResend} disabled={isActionLoading || !buttonEnabled.errorResend} className={`py-2.5 text-xs font-medium rounded-lg transition-colors border ${buttonEnabled.errorResend ? 'bg-orange-50 text-orange-700 hover:bg-orange-100 active:bg-orange-200 border-orange-100' : 'bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed'} disabled:opacity-50`}>기타오류</button>
              </>
            )}
            <button onClick={handleSignalBot} disabled={isActionLoading || !buttonEnabled.signalBot} className={`py-2.5 text-xs font-medium rounded-lg transition-colors border flex items-center justify-center gap-0.5 ${buttonEnabled.signalBot ? 'bg-blue-50 text-blue-700 hover:bg-blue-100 active:bg-blue-200 border-blue-100' : 'bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed'} disabled:opacity-50`}><Bot className="h-3 w-3" />신호봇</button>
          </div>
        </div>
      )}

      {/* History Results */}
      {isLoadingHistory ? (
        <div className="text-center py-10 bg-white rounded-lg shadow-sm border border-gray-200">
          <div className="inline-block animate-spin rounded-full h-7 w-7 border-[3px] border-primary-500 border-t-transparent"></div>
          <p className="mt-2 text-sm text-gray-500">통신이력 조회 중...</p>
        </div>
      ) : hasHistories ? (
        <>
          {/* dlive basic History */}
          {signalType === 'basic' && basicHistories.length > 0 && (
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
              <div className="px-3 py-2.5 border-b border-gray-100">
                <h3 className="text-sm font-bold text-gray-800">
                  통신이력정보 <span className="text-primary-700 font-normal">({basicHistories.length}건)</span>
                </h3>
              </div>
              <div className="overflow-x-auto">
                <div className="max-h-64 overflow-y-auto">
                  <table className="w-full min-w-[900px]">
                    <thead className="bg-gray-50 sticky top-0 z-10">
                      <tr>
                        <th className="px-2 py-2 text-center text-[0.6875rem] font-semibold text-gray-600 border-b whitespace-nowrap">연동시각</th>
                        <th className="px-2 py-2 text-center text-[0.6875rem] font-semibold text-gray-600 border-b whitespace-nowrap">메시지</th>
                        <th className="px-2 py-2 text-left text-[0.6875rem] font-semibold text-gray-600 border-b whitespace-nowrap">메세지명</th>
                        <th className="px-2 py-2 text-center text-[0.6875rem] font-semibold text-gray-600 border-b whitespace-nowrap">처리결과</th>
                        <th className="px-2 py-2 text-center text-[0.6875rem] font-semibold text-gray-600 border-b whitespace-nowrap">연동결과</th>
                        <th className="px-2 py-2 text-center text-[0.6875rem] font-semibold text-gray-600 border-b whitespace-nowrap">대상시스템</th>
                        <th className="px-2 py-2 text-center text-[0.6875rem] font-semibold text-gray-600 border-b whitespace-nowrap">HOST_MAC</th>
                        <th className="px-2 py-2 text-center text-[0.6875rem] font-semibold text-gray-600 border-b whitespace-nowrap">지점</th>
                      </tr>
                    </thead>
                    <tbody>
                      {basicHistories.map((item, idx) => (
                        <tr key={`${item.IF_DTL_ID}-${idx}`} onClick={() => handleBasicHistorySelect(item)} className={`cursor-pointer transition-colors ${selectedBasicHistory?.IF_DTL_ID === item.IF_DTL_ID ? 'bg-primary-100' : idx % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'} hover:bg-primary-50`}>
                          <td className="px-2 py-1.5 text-[0.6875rem] text-center text-gray-900 border-b whitespace-nowrap">{formatDateTime(item.REG_DATE || '')}</td>
                          <td className="px-2 py-1.5 text-[0.6875rem] text-center text-gray-900 border-b whitespace-nowrap">{item.MSG_ID || '-'}</td>
                          <td className="px-2 py-1.5 text-[0.6875rem] text-gray-900 border-b whitespace-nowrap max-w-[120px] truncate">{item.MSG_ID_NM || '-'}</td>
                          <td className="px-2 py-1.5 text-[0.6875rem] text-center border-b whitespace-nowrap">
                            <span className={(item.RSLT_CD || '') === '0' || item.RSLT_CD_NM === '정상전송' ? 'text-green-600' : 'text-orange-600'}>{item.RSLT_CD || item.RSLT_CD_NM || '-'}</span>
                          </td>
                          <td className="px-2 py-1.5 text-[0.6875rem] text-center border-b whitespace-nowrap">
                            <span className={(item.PROC_RSLT_CD_NM || '').includes('정상') ? 'text-green-600' : 'text-orange-600'}>{item.PROC_RSLT_CD_NM || '-'}</span>
                          </td>
                          <td className="px-2 py-1.5 text-[0.6875rem] text-center text-gray-900 border-b whitespace-nowrap">{item.IF_TP || '-'}</td>
                          <td className="px-2 py-1.5 text-[0.6875rem] text-center text-gray-900 border-b whitespace-nowrap">{(item as any).HOST_MAC || '-'}</td>
                          <td className="px-2 py-1.5 text-[0.6875rem] text-center text-gray-900 border-b whitespace-nowrap">{(item as any).SO_NM || '-'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* dlive basic Detail */}
          {signalType === 'basic' && selectedBasicHistory && (
            <div ref={detailRef} className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
              <div className="px-3 py-2.5 border-b border-gray-100">
                <h3 className="text-sm font-bold text-gray-800">
                  전송결과 <span className="text-xs text-gray-400 font-normal ml-1">전송ID: {selectedBasicHistory.IF_DTL_ID}</span>
                </h3>
              </div>
              {isLoadingDetail ? (
                <div className="text-center py-6">
                  <div className="inline-block animate-spin rounded-full h-5 w-5 border-2 border-primary-500 border-t-transparent"></div>
                </div>
              ) : basicSvcRslt.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[700px]">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-2 py-2 text-center text-[0.6875rem] font-semibold text-gray-600 border-b whitespace-nowrap">대상</th>
                        <th className="px-2 py-2 text-center text-[0.6875rem] font-semibold text-gray-600 border-b whitespace-nowrap">전송ID</th>
                        <th className="px-2 py-2 text-center text-[0.6875rem] font-semibold text-gray-600 border-b whitespace-nowrap">처리일시</th>
                        <th className="px-2 py-2 text-center text-[0.6875rem] font-semibold text-gray-600 border-b whitespace-nowrap">상세</th>
                        <th className="px-2 py-2 text-center text-[0.6875rem] font-semibold text-gray-600 border-b whitespace-nowrap">처리결과</th>
                        <th className="px-2 py-2 text-left text-[0.6875rem] font-semibold text-gray-600 border-b whitespace-nowrap">처리메세지</th>
                      </tr>
                    </thead>
                    <tbody>
                      {basicSvcRslt.map((r, idx) => (
                        <tr key={idx} className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'}>
                          <td className="px-2 py-1.5 text-[0.6875rem] text-center text-gray-900 border-b whitespace-nowrap">{r.REQ_SYSTEM || '-'}</td>
                          <td className="px-2 py-1.5 text-[0.6875rem] text-center text-gray-900 border-b whitespace-nowrap">{r.IF_DTL_ID || '-'}</td>
                          <td className="px-2 py-1.5 text-[0.6875rem] text-center text-gray-900 border-b whitespace-nowrap">{formatDateTime(r.REG_DTTM)}</td>
                          <td className="px-2 py-1.5 text-[0.6875rem] text-center text-gray-900 border-b whitespace-nowrap">{r.IF_TP || '-'}</td>
                          <td className="px-2 py-1.5 text-[0.6875rem] text-center border-b whitespace-nowrap">
                            <span className={r.SYSTEM_RSLT_CD && r.SYSTEM_RSLT_CD.startsWith('0') ? 'text-green-600' : 'text-red-600'}>{r.SYSTEM_RSLT_CD || '-'}</span>
                          </td>
                          <td className="px-2 py-1.5 text-[0.6875rem] text-gray-900 border-b whitespace-nowrap">{r.SYSTEM_RSLT_MSG || '-'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="text-center py-4"><p className="text-xs text-gray-400">전송결과 데이터가 없습니다</p></div>
              )}

              {/* DtlRslt table */}
              {basicDtlRslt.length > 0 && (
                <div className="border-t border-gray-200">
                  <div className="px-3 py-2 bg-gray-50 border-b border-gray-100">
                    <h4 className="text-xs font-semibold text-gray-700">상세 처리결과</h4>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[700px]">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-2 py-1.5 text-center text-[0.6875rem] font-semibold text-gray-600 border-b whitespace-nowrap">전송ID</th>
                          <th className="px-2 py-1.5 text-center text-[0.6875rem] font-semibold text-gray-600 border-b whitespace-nowrap">시스템상세</th>
                          <th className="px-2 py-1.5 text-center text-[0.6875rem] font-semibold text-gray-600 border-b whitespace-nowrap">단말 처리결과</th>
                          <th className="px-2 py-1.5 text-center text-[0.6875rem] font-semibold text-gray-600 border-b whitespace-nowrap">위치 처리결과</th>
                          <th className="px-2 py-1.5 text-left text-[0.6875rem] font-semibold text-gray-600 border-b whitespace-nowrap">단말 처리메시지</th>
                          <th className="px-2 py-1.5 text-left text-[0.6875rem] font-semibold text-gray-600 border-b whitespace-nowrap">위치 처리메시지</th>
                        </tr>
                      </thead>
                      <tbody>
                        {basicDtlRslt.map((r, idx) => (
                          <tr key={idx} className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'}>
                            <td className="px-2 py-1.5 text-[0.6875rem] text-center text-gray-900 border-b whitespace-nowrap">{r.IF_DTL_ID || '-'}</td>
                            <td className="px-2 py-1.5 text-[0.6875rem] text-center text-gray-900 border-b whitespace-nowrap">{r.IF_TP || '-'}</td>
                            <td className="px-2 py-1.5 text-[0.6875rem] text-center border-b whitespace-nowrap">
                              <span className={r.TMS_PROC_STATUS_NM?.includes('정상') ? 'text-green-600' : 'text-orange-600'}>{r.TMS_PROC_STATUS_NM || '-'}</span>
                            </td>
                            <td className="px-2 py-1.5 text-[0.6875rem] text-center border-b whitespace-nowrap">
                              <span className={r.LS_PROC_STATUS_NM?.includes('정상') ? 'text-green-600' : 'text-orange-600'}>{r.LS_PROC_STATUS_NM || '-'}</span>
                            </td>
                            <td className="px-2 py-1.5 text-[0.6875rem] text-gray-900 border-b whitespace-nowrap">{r.TMS_ERR_MSG || '-'}</td>
                            <td className="px-2 py-1.5 text-[0.6875rem] text-gray-900 border-b whitespace-nowrap">{r.LS_ERR_MSG || '-'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* LGU History */}
          {signalType === 'lgu' && lguHistories.length > 0 && (
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
              <div className="px-3 py-2.5 border-b border-gray-100">
                <h3 className="text-sm font-bold text-gray-800">
                  통신이력정보 <span className="text-primary-700 font-normal">({lguHistories.length}건)</span>
                </h3>
              </div>
              <div className="overflow-x-auto">
                <div className="max-h-64 overflow-y-auto">
                  <table className="w-full min-w-[900px]">
                    <thead className="bg-gray-50 sticky top-0 z-10">
                      <tr>
                        <th className="px-2 py-2 text-center text-[0.6875rem] font-semibold text-gray-600 border-b whitespace-nowrap">연동시각</th>
                        <th className="px-2 py-2 text-center text-[0.6875rem] font-semibold text-gray-600 border-b whitespace-nowrap">메시지</th>
                        <th className="px-2 py-2 text-left text-[0.6875rem] font-semibold text-gray-600 border-b whitespace-nowrap">메시지명</th>
                        <th className="px-2 py-2 text-center text-[0.6875rem] font-semibold text-gray-600 border-b whitespace-nowrap">처리결과</th>
                        <th className="px-2 py-2 text-left text-[0.6875rem] font-semibold text-gray-600 border-b whitespace-nowrap">연동경과</th>
                        <th className="px-2 py-2 text-center text-[0.6875rem] font-semibold text-gray-600 border-b whitespace-nowrap">SMS_TAG</th>
                        <th className="px-2 py-2 text-center text-[0.6875rem] font-semibold text-gray-600 border-b whitespace-nowrap">HOST_MAC</th>
                        <th className="px-2 py-2 text-center text-[0.6875rem] font-semibold text-gray-600 border-b whitespace-nowrap">지점</th>
                      </tr>
                    </thead>
                    <tbody>
                      {lguHistories.map((item, idx) => (
                        <tr key={`${item.JOB_ID}-${idx}`} onClick={() => handleLguHistorySelect(item)} className={`cursor-pointer transition-colors ${selectedLguHistory?.JOB_ID === item.JOB_ID ? 'bg-primary-100' : idx % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'} hover:bg-primary-50`}>
                          <td className="px-2 py-1.5 text-[0.6875rem] text-center text-gray-900 border-b whitespace-nowrap">{formatDateTime(item.API_DATE || item.STATUS_DATE || item.REG_DATE || '')}</td>
                          <td className="px-2 py-1.5 text-[0.6875rem] text-center text-gray-900 border-b whitespace-nowrap">{item.MSG_ID || '-'}</td>
                          <td className="px-2 py-1.5 text-[0.6875rem] text-gray-900 border-b whitespace-nowrap max-w-[120px] truncate">{item.MSG_ID_NM || '-'}</td>
                          <td className="px-2 py-1.5 text-[0.6875rem] text-center border-b whitespace-nowrap">
                            <span className={(item.PROC_RSLT_MSG || '').includes('정상') ? 'text-green-600' : 'text-orange-600'}>{item.PROC_RSLT_MSG || '-'}</span>
                          </td>
                          <td className="px-2 py-1.5 text-[0.6875rem] text-gray-900 border-b whitespace-nowrap max-w-[150px] truncate">{item.RS_FMSG || '-'}</td>
                          <td className="px-2 py-1.5 text-[0.6875rem] text-center text-gray-900 border-b whitespace-nowrap">{item.SMS_TAG || '-'}</td>
                          <td className="px-2 py-1.5 text-[0.6875rem] text-center text-gray-900 border-b whitespace-nowrap">{item.HOST_MAC || '-'}</td>
                          <td className="px-2 py-1.5 text-[0.6875rem] text-center text-gray-900 border-b whitespace-nowrap">{item.SO_NM || '-'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* LGU Detail */}
          {signalType === 'lgu' && selectedLguHistory && (
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
              <div className="px-3 py-2.5 border-b border-gray-100">
                <h3 className="text-sm font-bold text-gray-800">
                  전송결과 <span className="text-xs text-gray-400 font-normal ml-1">전송ID: {selectedLguHistory.JOB_ID}</span>
                </h3>
              </div>
              {isLoadingDetail ? (
                <div className="text-center py-6">
                  <div className="inline-block animate-spin rounded-full h-5 w-5 border-2 border-primary-500 border-t-transparent"></div>
                </div>
              ) : lguSvcResults.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[700px]">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-2 py-2 text-center text-[0.6875rem] font-semibold text-gray-600 border-b whitespace-nowrap">대상</th>
                        <th className="px-2 py-2 text-center text-[0.6875rem] font-semibold text-gray-600 border-b whitespace-nowrap">전송ID</th>
                        <th className="px-2 py-2 text-center text-[0.6875rem] font-semibold text-gray-600 border-b whitespace-nowrap">처리일시</th>
                        <th className="px-2 py-2 text-center text-[0.6875rem] font-semibold text-gray-600 border-b whitespace-nowrap">상세</th>
                        <th className="px-2 py-2 text-center text-[0.6875rem] font-semibold text-gray-600 border-b whitespace-nowrap">처리결과</th>
                        <th className="px-2 py-2 text-left text-[0.6875rem] font-semibold text-gray-600 border-b whitespace-nowrap">처리메세지</th>
                      </tr>
                    </thead>
                    <tbody>
                      {lguSvcResults.map((r, idx) => (
                        <tr key={idx} className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'}>
                          <td className="px-2 py-1.5 text-[0.6875rem] text-center text-gray-900 border-b whitespace-nowrap">{r.REQ_SYSTEM || '-'}</td>
                          <td className="px-2 py-1.5 text-[0.6875rem] text-center text-gray-900 border-b whitespace-nowrap">{r.JOB_ID || '-'}</td>
                          <td className="px-2 py-1.5 text-[0.6875rem] text-center text-gray-900 border-b whitespace-nowrap">{formatDateTime(r.REG_DTTM)}</td>
                          <td className="px-2 py-1.5 text-[0.6875rem] text-center text-gray-900 border-b whitespace-nowrap">{r.RS_FCODE || '-'}</td>
                          <td className="px-2 py-1.5 text-[0.6875rem] text-center border-b whitespace-nowrap">
                            <span className={r.RS_FCODE && r.RS_FCODE.startsWith('0') ? 'text-green-600' : 'text-red-600'}>{r.RS_FCODE || '-'}</span>
                          </td>
                          <td className="px-2 py-1.5 text-[0.6875rem] text-gray-900 border-b whitespace-nowrap">{r.RS_FMSG || '-'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="text-center py-4"><p className="text-xs text-gray-400">전송결과 데이터가 없습니다</p></div>
              )}
            </div>
          )}

          {/* FTTH History */}
          {signalType === 'ftth' && ftthHistories.length > 0 && (
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
              <div className="px-3 py-2.5 border-b border-gray-100">
                <h3 className="text-sm font-bold text-gray-800">
                  전용선 전송이력 <span className="text-primary-700 font-normal">({ftthHistories.length}건)</span>
                </h3>
              </div>
              <div className="overflow-x-auto">
                <div className="max-h-64 overflow-y-auto">
                  <table className="w-full min-w-[850px]">
                    <thead className="bg-gray-50 sticky top-0 z-10">
                      <tr>
                        <th className="px-2 py-2 text-left text-[0.6875rem] font-semibold text-gray-600 border-b whitespace-nowrap">전송ID</th>
                        <th className="px-2 py-2 text-left text-[0.6875rem] font-semibold text-gray-600 border-b whitespace-nowrap">메세지ID</th>
                        <th className="px-2 py-2 text-left text-[0.6875rem] font-semibold text-gray-600 border-b whitespace-nowrap">메세지명</th>
                        <th className="px-2 py-2 text-center text-[0.6875rem] font-semibold text-gray-600 border-b whitespace-nowrap">전송일시</th>
                        <th className="px-2 py-2 text-left text-[0.6875rem] font-semibold text-gray-600 border-b whitespace-nowrap">결과</th>
                        <th className="px-2 py-2 text-center text-[0.6875rem] font-semibold text-gray-600 border-b whitespace-nowrap">수신일시</th>
                        <th className="px-2 py-2 text-center text-[0.6875rem] font-semibold text-gray-600 border-b whitespace-nowrap">AP_MAC</th>
                        <th className="px-2 py-2 text-center text-[0.6875rem] font-semibold text-gray-600 border-b whitespace-nowrap">지점</th>
                      </tr>
                    </thead>
                    <tbody>
                      {ftthHistories.map((item, idx) => (
                        <tr key={`${item.SEQ_API}-${idx}`} className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'}>
                          <td className="px-2 py-1.5 text-[0.6875rem] text-gray-900 border-b whitespace-nowrap">{item.SEQ_API || '-'}</td>
                          <td className="px-2 py-1.5 text-[0.6875rem] text-gray-900 border-b whitespace-nowrap">{item.CMD || '-'}</td>
                          <td className="px-2 py-1.5 text-[0.6875rem] text-gray-900 border-b whitespace-nowrap max-w-[120px] truncate">{item.MSG_TP_DESC || '-'}</td>
                          <td className="px-2 py-1.5 text-[0.6875rem] text-center text-gray-900 border-b whitespace-nowrap">{formatDateTime(item.REQ_DATE)}</td>
                          <td className="px-2 py-1.5 text-[0.6875rem] text-gray-900 border-b whitespace-nowrap max-w-[140px] truncate">{item.RESULT || '-'}</td>
                          <td className="px-2 py-1.5 text-[0.6875rem] text-center text-gray-900 border-b whitespace-nowrap">{formatDateTime(item.RES_DATE)}</td>
                          <td className="px-2 py-1.5 text-[0.6875rem] text-center text-gray-900 border-b whitespace-nowrap">{item.MAC_ADDR || '-'}</td>
                          <td className="px-2 py-1.5 text-[0.6875rem] text-center text-gray-900 border-b whitespace-nowrap">{item.SO_NM || '-'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </>
      ) : !isLoadingHistory && directCtrtId ? null : !isLoadingHistory ? (
        <div className="text-center py-10 bg-white rounded-lg shadow-sm border border-gray-200">
          <p className="text-sm text-gray-400">고객을 검색하거나 계약ID를 입력 후 조회하세요</p>
        </div>
      ) : null}


      {/* 플로팅 뒤로가기 버튼 (작업완료 화면에서 진입 시) */}
      {signalNavContext && (
        <button
          onClick={() => {
            useUIStore.getState().setCurrentView(signalNavContext.returnView);
            useUIStore.getState().setSignalNavContext(null);
          }}
          className="fixed bottom-24 right-4 z-40 w-14 h-14 bg-primary-600 text-white rounded-full shadow-lg flex items-center justify-center active:bg-primary-700 transition-colors"
        >
          <ArrowLeft className="w-6 h-6" />
        </button>
      )}
    </div>
  );
};

export default SignalIntegration;
