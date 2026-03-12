import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { CheckCircle, AlertCircle, Server, Wifi, Zap, X, Database, ChevronDown } from 'lucide-react';
import { WorkItem } from '../../../types';
import { getCertifyCL03, CertifyInfo, getUplsCtrtInfo, getUplsNwcs, getUplsEntrEqipDtl, getCodeDetail, CommonCodeDetail } from '../../../services/apiService';
import {
  getUplsEqipInfo,
  getUplsEqipPortInfo,
  getUplsDuplicationMember,
  setUplsWorkComplete,
} from '../../../services/certifyApiService';
import { useCertifyStore } from '../../../stores/certifyStore';
import { useWorkEquipmentStore } from '../../../stores/workEquipmentStore';

interface LineRegistrationProps {
  workItem: WorkItem;
  onNext?: () => void;
  onBack?: () => void;
  showToast?: (message: string, type: 'success' | 'error' | 'warning' | 'info') => void;
  readOnly?: boolean;
}

interface ApInfo {
  mac: string;
  serialNumber: string;
  model: string;
  type: string;
}

interface L2EquipmentInfo {
  autoYn: string;
  buildingName: string;
  portNo: string;
  equipId: string;
  modelNm: string;
  maxSpeed: string;
  manufacturer: string;
  remarks: string;
  mdlNmRaw: string;
}

// FTTH RN equipment info (from getUplsEqipInfo)
interface RnEquipment {
  EQIP_ID: string;
  EQIP_NM: string;
  MDL_NM: string;
  EQIP_ESTB_FLOO_NM: string;
  EQIP_IP?: string;
  ESTB_PLC_NM?: string;
}

// FTTH RN port info (from getUplsEqipPortInfo)
interface RnPort {
  EQIP_ID: string;
  PORT_NO: string;
  PT_USE: string;    // Y=in use, N=available
  ENTR_NO: string;   // subscriber on this port
  CTRT_ID?: string;
}

// OLT info (from getUplsNwcs for FTTH)
interface OltInfo {
  OLT_ID: string;
  OLT_MDL_NM: string;
  OLT_PORT_NO: string;
  ESTB_PLC_NM: string;
  EQIP_IP: string;
}

const EMPTY_EQUIPMENTS: any[] = [];

/**
 * LGU+ 집선등록 컴포넌트
 * - 광랜(N/NG): L2 자동정보조회 + CL-03 + DuplicationMember 검증
 * - FTTH(F/FG/Z/ZG): OLT 정보 + RN 콤보 + 포트 그리드 + CL-03
 * - 레거시: mowouDivF01.xml (광랜), mowouDivG01.xml (FTTH)
 */
const LineRegistration: React.FC<LineRegistrationProps> = ({
  workItem,
  showToast,
  readOnly = false,
}) => {
  const [isLoading, setIsLoading] = useState(false);
  const [certifyInfo, setCertifyInfo] = useState<CertifyInfo | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isQueried, setIsQueried] = useState(false);
  const [selectedApIndex, setSelectedApIndex] = useState<number>(0);

  // L2 equipment info (광랜)
  const [l2Info, setL2Info] = useState<L2EquipmentInfo | null>(null);
  const [isL2Loading, setIsL2Loading] = useState(false);
  const [isL2Queried, setIsL2Queried] = useState(false);
  const [l2Error, setL2Error] = useState<string | null>(null);

  // FTTH OLT info
  const [oltInfo, setOltInfo] = useState<OltInfo | null>(null);

  // FTTH RN equipment list & port grid
  const [rnList, setRnList] = useState<RnEquipment[]>([]);
  const [selectedRnId, setSelectedRnId] = useState<string>('');
  const [rnPorts, setRnPorts] = useState<RnPort[]>([]);
  const [selectedPortIdx, setSelectedPortIdx] = useState<number>(-1);
  const [isRnLoading, setIsRnLoading] = useState(false);
  const [isPortLoading, setIsPortLoading] = useState(false);
  const [isRnDropdownOpen, setIsRnDropdownOpen] = useState(false);
  const rnDropdownRef = useRef<HTMLDivElement>(null);

  // ENTR_NO (from getUplsCtrtInfo)
  const [entrNo, setEntrNo] = useState<string>('');
  const [entrRqstNo, setEntrRqstNo] = useState<string>('');
  const [isEntrLoading, setIsEntrLoading] = useState(false);

  // L2 ref modal
  const [showL2RefModal, setShowL2RefModal] = useState(false);
  const [l2RefData, setL2RefData] = useState<CommonCodeDetail[]>([]);
  const [isL2RefLoading, setIsL2RefLoading] = useState(false);

  // 집선등록 진행 중
  const [isRegistering, setIsRegistering] = useState(false);

  // Store
  const {
    certifyRegconfInfo, setCertifyRegconfInfo,
    certifyOpLnkdCd,
    isCertifyProd,
    isLineRegistrationDone, setIsLineRegistrationDone,
    isSubscriptionDone,
    ldapResult,
    entrNo: storeEntrNo,
    setEntrNo: storeSetEntrNo,
    lguMarketCd,
    certifyProdList,
  } = useCertifyStore();

  // 광랜(N/NG) vs FTTH(F/FG/Z/ZG)
  const isFtthProd = ['F', 'FG', 'Z', 'ZG'].includes(certifyOpLnkdCd);

  // 단말인증 대상 상품 여부 (레거시 mowoc01m01: ds_certify_prod.FindRow)
  const prodCd = workItem.PROD_CD || '';
  const isCertifyTarget = !prodCd || certifyProdList.length === 0 || certifyProdList.includes(prodCd);
  const eqipDivs = isFtthProd ? 'OLT' : 'L2';

  // Command mapping (레거시: cm_lib.js fn_get_CommondForEqip)
  const getEqipCommand = () => {
    if (['F', 'FG', 'Z', 'ZG'].includes(certifyOpLnkdCd)) return 'ftthEqipList';
    if (['V', 'VG'].includes(certifyOpLnkdCd)) return 'vdslEqipList';
    return 'opticEqipList';
  };
  const getEqipPortCommand = () => {
    if (['F', 'FG', 'Z', 'ZG'].includes(certifyOpLnkdCd)) return 'ftthEqipPortList';
    if (['V', 'VG'].includes(certifyOpLnkdCd)) return 'vdslEqipPortList';
    return 'opticEqipPortList';
  };

  // Equipment data
  const workId = workItem.id;
  const installedEquipments = useWorkEquipmentStore(
    (state) => state.workStates[workId]?.installedEquipments ?? EMPTY_EQUIPMENTS
  );

  const equipmentFingerprint = useMemo(() =>
    installedEquipments.map(eq => eq.actualEquipment?.id || '').sort().join(','),
    [installedEquipments]
  );
  const prevFingerprintRef = useRef(equipmentFingerprint);

  // RN 드롭다운 외부 클릭 닫기
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (rnDropdownRef.current && !rnDropdownRef.current.contains(e.target as Node)) {
        setIsRnDropdownOpen(false);
      }
    };
    if (isRnDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isRnDropdownOpen]);

  // Restore on mount
  useEffect(() => {
    if (certifyRegconfInfo) {
      const savedFingerprint = (certifyRegconfInfo as any)._equipmentFingerprint;
      if (savedFingerprint && savedFingerprint !== equipmentFingerprint) {
        setCertifyRegconfInfo(null as any);
        return;
      }
      setCertifyInfo(certifyRegconfInfo);
      setIsQueried(true);
    }
  }, []);

  // Fetch ENTR_NO on mount (U+ 전용 - getUplsCtrtInfo)
  useEffect(() => {
    if (!isCertifyProd) return; // 일반 FTTH는 ENTR_NO 불필요
    const fetchEntrNo = async () => {
      // 상품변경(05)/이전설치(07): 변경후 계약ID(DTL_CTRT_ID) 사용
      const ctrtId = (['05', '07'].includes(workItem.WRK_CD || ''))
        ? ((workItem as any).DTL_CTRT_ID || workItem.CTRT_ID || '')
        : (workItem.CTRT_ID || '');
      if (!ctrtId) return;
      setIsEntrLoading(true);
      try {
        const result = await getUplsCtrtInfo({ CTRT_ID: ctrtId });
        if (result && result.length > 0) {
          const info = result[0];
          setEntrNo(info.ENTR_NO || '');
          setEntrRqstNo(info.ENTR_RQST_NO || '');
          // 스토어에도 ENTR_RQST_NO 동기화 (작업완료 시 executeUplsWorkComplete에서 사용)
          if (info.ENTR_RQST_NO) {
            storeSetEntrNo(storeEntrNo || info.ENTR_NO || '', info.ENTR_RQST_NO);
          }
        } else if (storeEntrNo) {
          // Fallback: 청약 단계에서 이미 확보한 ENTR_NO 사용
          console.log('[집선등록] getUplsCtrtInfo 결과 없음 → storeEntrNo 사용:', storeEntrNo);
          setEntrNo(storeEntrNo);
        }
      } catch (e) {
        console.error('[집선등록] ENTR_NO 조회 실패:', e);
        // 에러 시에도 storeEntrNo fallback
        if (storeEntrNo) {
          console.log('[집선등록] ENTR_NO 조회 실패 → storeEntrNo 사용:', storeEntrNo);
          setEntrNo(storeEntrNo);
        }
      } finally {
        setIsEntrLoading(false);
      }
    };
    fetchEntrNo();
  }, [workItem.CTRT_ID, (workItem as any).DTL_CTRT_ID]);

  // Equipment change detection
  useEffect(() => {
    if (prevFingerprintRef.current === equipmentFingerprint) return;
    prevFingerprintRef.current = equipmentFingerprint;
    if (isQueried) {
      setCertifyInfo(null);
      setCertifyRegconfInfo(null as any);
      setIsQueried(false);
      setSelectedApIndex(0);
      setIsLineRegistrationDone(false);
    }
  }, [equipmentFingerprint]);

  // AP selection change
  useEffect(() => {
    if (prevFingerprintRef.current !== equipmentFingerprint) return;
    if (isQueried) {
      setCertifyInfo(null);
      setCertifyRegconfInfo(null as any);
      setIsQueried(false);
      setIsLineRegistrationDone(false);
    }
  }, [selectedApIndex]);

  // Extract MAC addresses
  const { ontMac, apMac, ontSerial, apList } = useMemo(() => {
    let _ontMac = '';
    let _ontSerial = '';
    const _apList: ApInfo[] = [];

    for (const eq of installedEquipments) {
      const actual = eq.actualEquipment || {};
      const contract = eq.contractEquipment || {};
      const itemMidCd = actual.itemMidCd || actual.ITEM_MID_CD || contract.itemMidCd || contract.ITEM_MID_CD || '';
      const macAddress = actual.macAddress || actual.MAC_ADDRESS || eq.macAddress || '';
      const serialNumber = actual.serialNumber || actual.EQT_SERNO || '';

      if (itemMidCd === '02' || itemMidCd === '31') {
        _ontMac = macAddress || serialNumber;
        _ontSerial = serialNumber;
      }
      if (itemMidCd === '10' || itemMidCd === '32') {
        _apList.push({
          mac: macAddress || serialNumber,
          serialNumber,
          model: actual.model || actual.EQT_CL_NM || '',
          type: contract.type || actual.type || 'AP',
        });
      }
    }
    const _apMac = _apList.length > 0 ? (_apList[selectedApIndex]?.mac || _apList[0].mac) : '';
    return { ontMac: _ontMac, apMac: _apMac, ontSerial: _ontSerial, apList: _apList };
  }, [installedEquipments, selectedApIndex]);

  const hasMacInfo = !!(ontMac || apMac || ontSerial);

  const getUserId = () => {
    try {
      const userInfo = localStorage.getItem('userInfo');
      if (userInfo) {
        const user = JSON.parse(userInfo);
        return user.userId || user.id || '';
      }
    } catch (e) {}
    return '';
  };

  // ============ 광랜: L2 자동정보조회 (레거시: btn_upls_auto_info_OnClick in DivF01) ============
  const handleL2AutoQuery = useCallback(async () => {
    if (readOnly) return;
    if (!entrNo) {
      setL2Error('ENTR_NO가 없습니다. LGU+ 계약정보를 확인해주세요.');
      showToast?.('ENTR_NO가 없습니다.', 'error');
      return;
    }

    setIsL2Loading(true);
    setL2Error(null);

    try {
      const ctrtId = workItem.CTRT_ID || '';

      // 1. getUplsNwcs
      const nwcsResult = await getUplsNwcs({ ENTR_NO: entrNo, CTRT_ID: ctrtId });
      if (!nwcsResult || (nwcsResult.RESULT_CD || '').startsWith('N')) {
        const msg = nwcsResult?.RESULT_MSG || 'L2 자동정보조회 실패';
        setL2Error(`LGU 자동설정정보 조회 실패 (${ctrtId})\n${msg}`);
        showToast?.(`L2 자동정보조회 실패: ${msg}`, 'error');
        return;
      }

      const mdlNm = nwcsResult.MDL_NM || '';
      const eqipId = nwcsResult.EQIP_ID || '';
      const eqipPort = nwcsResult.PRT_INDX_NM || '';
      const estbPlcNm = nwcsResult.ESTB_PLC_NM || '';

      // 2. getUplsEntrEqipDtl
      try {
        await getUplsEntrEqipDtl({
          ENTR_NO: entrNo,
          ENTR_RQST_NO: entrRqstNo || 'null',
          BIZ_TYPE: '01',
          CTRT_ID: ctrtId,
        });
      } catch (e) {
        console.warn('[L2] getUplsEntrEqipDtl error (non-critical):', e);
      }

      // 3. LGCT015 model info
      let modelName = '', maxSpeed = '', manufacturer = '', remarks = '';
      if (mdlNm) {
        try {
          const lgct015 = await getCodeDetail({ COMMON_GRP: 'LGCT015' });
          if (lgct015) {
            const match = lgct015.find(item => item.COMMON_CD === mdlNm);
            if (match) {
              modelName = match.COMMON_CD_NM || '';
              maxSpeed = match.REF_CODE || '';
              manufacturer = match.REF_CODE2 || '';
              remarks = match.REF_CODE3 || '';
            }
          }
        } catch (e) {
          console.warn('[L2] LGCT015 lookup error:', e);
        }
      }

      const l2Data: L2EquipmentInfo = {
        autoYn: 'Y', buildingName: estbPlcNm, portNo: eqipPort,
        equipId: eqipId, modelNm: modelName, maxSpeed, manufacturer, remarks, mdlNmRaw: mdlNm,
      };
      setL2Info(l2Data);
      setIsL2Queried(true);

      // Store에 L2 정보 저장
      const currentRegconf = certifyRegconfInfo || {};
      setCertifyRegconfInfo({
        ...currentRegconf,
        EQIP_ID: eqipId,
        EQIP_PORT_NO: eqipPort,
        EQIP_DIVS: 'L2',
        DEL_YN: 'N',
      } as any);

      showToast?.('L2 자동정보조회가 완료되었습니다.', 'success');
    } catch (err) {
      setL2Error('L2 자동정보조회 중 오류가 발생했습니다.');
      showToast?.('L2 자동정보조회 중 오류가 발생했습니다.', 'error');
    } finally {
      setIsL2Loading(false);
    }
  }, [entrNo, entrRqstNo, workItem.CTRT_ID, readOnly, certifyRegconfInfo, setCertifyRegconfInfo, showToast]);

  // ============ FTTH: OLT + RN 자동정보조회 (레거시: btn_upls_olt_auto_info_OnClick in DivG01) ============
  const handleFtthAutoQuery = useCallback(async () => {
    if (readOnly || !entrNo) return;

    setIsRnLoading(true);
    setL2Error(null);

    try {
      const ctrtId = workItem.CTRT_ID || '';

      // 1. getUplsNwcs → OLT info
      const nwcsResult = await getUplsNwcs({ ENTR_NO: entrNo, CTRT_ID: ctrtId });
      if (!nwcsResult || (nwcsResult.RESULT_CD || '').startsWith('N')) {
        const msg = nwcsResult?.RESULT_MSG || 'OLT 자동정보조회 실패';
        setL2Error(`LGU OLT 자동정보 조회 실패 (${ctrtId})\n${msg}`);
        showToast?.(`OLT 조회 실패: ${msg}`, 'error');
        return;
      }

      const olt: OltInfo = {
        OLT_ID: nwcsResult.EQIP_ID || '',
        OLT_MDL_NM: nwcsResult.MDL_NM || '',
        OLT_PORT_NO: nwcsResult.PRT_INDX_NM || '',
        ESTB_PLC_NM: nwcsResult.ESTB_PLC_NM || '',
        EQIP_IP: nwcsResult.EQIP_IP || '',
      };
      setOltInfo(olt);

      // 2. getUplsEntrEqipDtl
      try {
        await getUplsEntrEqipDtl({
          ENTR_NO: entrNo,
          ENTR_RQST_NO: entrRqstNo || 'null',
          BIZ_TYPE: '01',
          CTRT_ID: ctrtId,
        });
      } catch (e) {
        console.warn('[FTTH] getUplsEntrEqipDtl error:', e);
      }

      // 3. getUplsEqipInfo → RN equipment list
      const eqipList = await getUplsEqipInfo({
        COMMAND: getEqipCommand(),
        ENTR_NO: entrNo,
        ENTR_RQST_NO: entrRqstNo || 'null',
        BIZ_TYPE: '01',
        CTRT_ID: ctrtId,
      });

      if (!eqipList || eqipList.length === 0) {
        setL2Error('RN 장비 목록이 없습니다.');
        showToast?.('RN 장비 목록이 없습니다.', 'warning');
        return;
      }

      // Normalize keys
      const normalized = eqipList.map((item: any) => {
        const n: any = {};
        for (const k of Object.keys(item)) n[k.toUpperCase()] = item[k];
        return n;
      });
      setRnList(normalized);

      // Auto-select first RN
      const firstRnId = normalized[0]?.EQIP_ID || '';
      setSelectedRnId(firstRnId);

      // 4. Load ports for first RN
      if (firstRnId) {
        await loadRnPorts(firstRnId, ctrtId);
      }

      showToast?.('FTTH 자동정보조회 완료', 'success');
    } catch (err) {
      console.error('[FTTH] 자동정보조회 에러:', err);
      setL2Error('FTTH 자동정보조회 중 오류가 발생했습니다.');
      showToast?.('FTTH 자동정보조회 오류', 'error');
    } finally {
      setIsRnLoading(false);
    }
  }, [entrNo, entrRqstNo, workItem.CTRT_ID, readOnly, certifyOpLnkdCd, showToast]);

  // 자동현황조회 - 페이지 진입 시 자동 호출 (U+ 전용, entrNo 확보되면)
  const autoQueryDoneRef = useRef(false);
  useEffect(() => {
    if (!isCertifyProd) return; // 일반 FTTH는 L2/FTTH 자동조회 불필요
    if (autoQueryDoneRef.current || readOnly || !entrNo || isEntrLoading) return;
    autoQueryDoneRef.current = true;
    if (isFtthProd) {
      handleFtthAutoQuery();
    } else {
      handleL2AutoQuery();
    }
  }, [entrNo, isEntrLoading, readOnly, isFtthProd, handleL2AutoQuery, handleFtthAutoQuery]);

  // Load RN ports
  const loadRnPorts = async (rnEqipId: string, ctrtId: string) => {
    setIsPortLoading(true);
    setSelectedPortIdx(-1);
    try {
      const ports = await getUplsEqipPortInfo({
        COMMAND: getEqipPortCommand(),
        EQIP_ID: rnEqipId,
        CTRT_ID: ctrtId,
      });

      const normalized = (ports || []).map((item: any) => {
        const n: any = {};
        for (const k of Object.keys(item)) n[k.toUpperCase()] = item[k];
        return n;
      });
      setRnPorts(normalized);
    } catch (e) {
      console.error('[FTTH] 포트 조회 실패:', e);
      setRnPorts([]);
    } finally {
      setIsPortLoading(false);
    }
  };

  // RN 콤보 변경 (레거시: cmb_lgu_rn_list_OnChanged)
  const handleRnChange = async (newRnId: string) => {
    setSelectedRnId(newRnId);
    setSelectedPortIdx(-1);
    const ctrtId = workItem.CTRT_ID || '';
    if (newRnId) {
      await loadRnPorts(newRnId, ctrtId);
    }
  };

  // FTTH 포트 선택 (레거시: fn_upls_rn_port_select)
  const handlePortSelect = (idx: number) => {
    setSelectedPortIdx(idx);
    const port = rnPorts[idx];
    if (!port || !oltInfo) return;

    // Store에 regconfinfo 설정 (레거시: ds_lgu_regconfinfo)
    const currentRegconf = certifyRegconfInfo || {};
    setCertifyRegconfInfo({
      ...currentRegconf,
      OLT_ID: oltInfo.OLT_ID,
      OLT_PORT: oltInfo.OLT_PORT_NO,
      EQIP_ID: selectedRnId,
      EQIP_PORT_NO: port.PORT_NO,
      EQIP_PORT_USE: port.PT_USE,
      PORT_ENTR_NO: port.ENTR_NO,
      EQIP_DIVS: 'OLT',
      DEL_YN: 'N',
    } as any);
  };

  // L2 ref modal
  const handleOpenL2Ref = useCallback(async () => {
    setShowL2RefModal(true);
    if (l2RefData.length > 0) return;
    setIsL2RefLoading(true);
    try {
      const data = await getCodeDetail({ COMMON_GRP: 'LGCT015' });
      setL2RefData(data || []);
    } catch (e) {
      console.error('[L2] LGCT015 조회 실패:', e);
    } finally {
      setIsL2RefLoading(false);
    }
  }, [l2RefData.length]);

  // CL-03 집선정보 조회
  const handleQuery = async () => {
    if (readOnly) return;
    if (!hasMacInfo) {
      setError('단말기 MAC 값이 존재하지 않습니다.');
      showToast?.('단말기 MAC 값이 없습니다.', 'error');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const params: any = {
        CONT_ID: workItem.CTRT_ID || '',
        CUST_ID: workItem.CUST_ID || workItem.customer?.id || '',
        WRK_ID: workItem.id || workItem.WRK_ID || '',
        SO_ID: workItem.SO_ID || '',
        REG_UID: getUserId(),
      };
      if (ontMac) params.ONT_MAC = ontMac;
      if (ontSerial) params.ONT_SERIAL = ontSerial;
      if (apMac) params.AP_MAC = apMac;

      const result = await getCertifyCL03(params);

      if (result) {
        if (result.ERROR) {
          setError(`집선정보 조회 실패: ${result.ERROR}`);
          showToast?.(`집선정보 조회 실패: ${result.ERROR}`, 'error');
          return;
        }

        // Merge CL-03 result with existing regconfinfo (L2/OLT info preserved)
        const currentRegconf = certifyRegconfInfo || {};
        const certifyData = {
          ...currentRegconf,
          ...result,
          AP_MAC: apMac,
          ONT_MAC: (result.ONT_MAC || ontMac || '').toUpperCase(),
          ONT_SERIAL: (result.ONT_SERIAL || ontSerial || '').toUpperCase(),
          _equipmentFingerprint: equipmentFingerprint,
          DEL_YN: 'N',
        };

        setCertifyInfo(certifyData);
        setCertifyRegconfInfo(certifyData);
        setIsQueried(true);

        // 비U+ FTTH: CL-03 조회 성공 시 집선등록 자동 완료 (별도 집선등록 버튼 없으므로)
        if (!isCertifyProd) {
          setIsLineRegistrationDone(true);
          console.log('[집선등록] 비U+ 자동 완료 - isLineRegistrationDone=true');
          showToast?.('집선등록이 완료되었습니다.', 'success');
        } else {
          showToast?.('집선정보 조회가 완료되었습니다.', 'success');
        }
      } else {
        setError('집선정보 조회 실패');
        showToast?.('집선정보 조회 실패', 'error');
      }
    } catch (err) {
      setError('집선정보 조회 중 오류가 발생했습니다.');
      showToast?.('집선정보 조회 오류', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  // ============ 집선등록 버튼 (레거시: btn_LGU_Line_Req_OnClick) ============
  const handleLineRegistration = async () => {
    if (readOnly) return;

    console.log('[집선등록] 버튼 클릭 - 검증 시작', {
      storeEntrNo, entrNo,
      ldapResult: !!ldapResult,
      certifyRegconfInfo: certifyRegconfInfo ? {
        EQIP_ID: certifyRegconfInfo.EQIP_ID,
        EQIP_PORT_NO: certifyRegconfInfo.EQIP_PORT_NO,
        EQIP_DIVS: certifyRegconfInfo.EQIP_DIVS,
        EQIP_PORT_USE: certifyRegconfInfo.EQIP_PORT_USE,
        PORT_ENTR_NO: certifyRegconfInfo.PORT_ENTR_NO,
        OLT_ID: certifyRegconfInfo.OLT_ID,
        OLT_PORT: certifyRegconfInfo.OLT_PORT,
      } : null,
      isFtthProd,
      certifyOpLnkdCd,
      isLineRegistrationDone,
      isCertifyProd,
    });

    // === 일반 FTTH 인증상품 모드 (비U+) ===
    // CL-03 결과만 확인 (청약/LDAP/포트/DuplicationMember 불필요)
    if (!isCertifyProd) {
      if (!certifyRegconfInfo) {
        showToast?.('집선정보 조회를 먼저 실행하세요.', 'warning');
        return;
      }
      setIsLineRegistrationDone(true);
      console.log('[집선등록] 일반 FTTH 완료 - isLineRegistrationDone=true');
      showToast?.('단말인증 집선정보등록이 완료되었습니다.', 'success');
      return;
    }

    // Check 0-A, 0-B: U+ 전용 선행 체크 (청약/LDAP은 LGU+ 재판매 상품만 필요)
    // 일반 FTTH 인증상품(IS_CERTIFY_PROD+CMIF006)은 U+ 작업 불필요
    if (isCertifyProd) {
      // 청약신청 확인 (레거시: LGU_ENTR_NO 존재 여부)
      if (!storeEntrNo && !entrNo) {
        console.log('[집선등록] 실패 - 청약신청 미완료 (ENTR_NO 없음)');
        showToast?.('청약신청 버튼을 먼저 클릭하세요.', 'warning');
        return;
      }
      // LDAP연동 확인 (레거시: LGU_LDAP_INPUT == "Y")
      if (!ldapResult) {
        console.log('[집선등록] 실패 - LDAP연동 미완료');
        showToast?.('LDAP연동 버튼을 먼저 클릭하세요.', 'warning');
        return;
      }
    }

    // Check 1: 포트 선택 여부
    const regconf = certifyRegconfInfo;
    if (!regconf?.EQIP_PORT_NO) {
      console.log('[집선등록] 실패 - 포트 미선택', { isFtthProd, regconf });
      if (isFtthProd) {
        showToast?.('RN 포트를 선택하세요. (포트 목록에서 행을 터치)', 'warning');
      } else {
        showToast?.('L2 자동정보조회가 완료되지 않았습니다. 잠시 후 다시 시도하세요.', 'warning');
      }
      return;
    }

    console.log('[집선등록] 검증 통과 - 처리 시작');
    setIsRegistering(true);
    setError(null);

    try {
      // Check 2: FTTH - EQIP_PORT_USE validation (레거시 동일)
      if (isFtthProd) {
        console.log('[집선등록] FTTH 포트 사용여부 확인:', {
          EQIP_PORT_USE: regconf.EQIP_PORT_USE,
          PORT_ENTR_NO: regconf.PORT_ENTR_NO,
          currentEntrNo: storeEntrNo || entrNo,
        });
        if (regconf.EQIP_PORT_USE === 'Y' && regconf.PORT_ENTR_NO !== (storeEntrNo || entrNo)) {
          console.log('[집선등록] 실패 - FTTH 포트 다른 가입자 사용중');
          showToast?.('다른 가입자 사용중입니다. 다른 포트로 변경해 주세요.', 'error');
          setIsRegistering(false);
          return;
        }
      }

      // Check 3: 광랜 - DuplicationMember (레거시: fn_upls_DuplicationMember)
      if (!isFtthProd && (certifyOpLnkdCd === 'N' || certifyOpLnkdCd === 'NG')) {
        const portNm = (regconf.EQIP_PORT_NO || '').replace(/\//g, '__');
        console.log('[집선등록] 광랜 중복가입자 조회:', {
          ENTR_NO: storeEntrNo || entrNo,
          EQIP_ID: regconf.EQIP_ID,
          PORT_NM: portNm,
          CTRT_ID: workItem.CTRT_ID,
        });
        const dupResult = await getUplsDuplicationMember({
          ENTR_NO: storeEntrNo || entrNo,
          EQIP_ID: regconf.EQIP_ID || '',
          PORT_NM: portNm,
          CTRT_ID: workItem.CTRT_ID || '',
        });

        console.log('[집선등록] 중복가입자 조회 결과:', dupResult);

        if (!dupResult.success) {
          console.log('[집선등록] 실패 - 중복가입자 조회 API 에러');
          showToast?.(`LGU+ 중복가입자 조회 실패\n${dupResult.RESULT_MSG}`, 'error');
          setIsRegistering(false);
          return;
        }

        if (dupResult.ENTR_EXIST === 'Y') {
          console.log('[집선등록] 실패 - 중복가입자 존재');
          showToast?.('LGU+ 중복가입자가 존재합니다. 포트를 변경하여 주세요.', 'error');
          setCertifyRegconfInfo(null as any);
          setIsRegistering(false);
          return;
        }
      }

      // 성공: 집선등록 완료 플래그 (레거시: LGU_LINE_INPUT = "Y")
      // NOTE: 실제 API 호출(setUplsWorkComplete)은 작업완료 시 실행됨
      setIsLineRegistrationDone(true);
      console.log('[집선등록] 완료 - isLineRegistrationDone=true (실제 API는 작업완료 시 호출)');
      showToast?.('LGU+ 집선등록이 처리되었습니다.', 'success');
    } catch (err) {
      console.error('[집선등록] 등록 에러:', err);
      setError('집선등록 처리 중 오류가 발생했습니다.');
      showToast?.('집선등록 처리 오류', 'error');
    } finally {
      setIsRegistering(false);
    }
  };

  // Info row helper
  const InfoRow = ({ label, value }: { label: string; value: string }) => (
    <div className="flex items-center justify-between py-1.5 border-b border-gray-100 last:border-b-0">
      <span className="text-xs text-gray-500">{label}</span>
      <span className="text-xs font-medium text-gray-900 text-right max-w-[60%] truncate">{value || '-'}</span>
    </div>
  );

  const selectedRn = rnList.find(r => r.EQIP_ID === selectedRnId);

  return (
    <div className="px-3 sm:px-4 py-4 sm:py-6 pb-3 sm:pb-4 space-y-3 sm:space-y-4">
      {/* AP 선택 */}
      {apList.length > 1 && !readOnly && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 sm:p-4">
          <h5 className="text-xs sm:text-sm font-semibold text-amber-800 mb-2 flex items-center gap-1.5">
            <Wifi className="w-4 h-4" />
            AP 선택 ({apList.length}개 감지)
          </h5>
          <div className="space-y-2">
            {apList.map((ap, index) => (
              <label
                key={index}
                className={`flex items-center gap-3 p-2.5 rounded-lg border cursor-pointer transition-colors ${
                  selectedApIndex === index ? 'border-amber-400 bg-amber-100' : 'border-gray-200 bg-white hover:border-amber-300'
                }`}
                onClick={() => setSelectedApIndex(index)}
              >
                <input type="radio" name="apSelect" checked={selectedApIndex === index} onChange={() => setSelectedApIndex(index)} className="w-4 h-4 text-amber-600" />
                <div className="flex-1 min-w-0">
                  <div className="text-xs sm:text-sm font-medium text-gray-900">{ap.type} {ap.model && `(${ap.model})`}</div>
                  <div className="text-xs text-gray-500 font-mono truncate">MAC: {ap.mac || '-'}</div>
                </div>
              </label>
            ))}
          </div>
        </div>
      )}

      {/* ============ 광랜: 개통장비정보(광랜) (mowouDivF01) — U+ 전용 ============ */}
      {isCertifyProd && !isFtthProd && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-3 sm:p-4">
          <div className="flex items-center justify-between mb-2">
            <h5 className="text-xs sm:text-sm font-bold text-gray-900 flex items-center gap-1.5">
              <Zap className="w-4 h-4 text-purple-500" />
              개통장비정보(광랜)
              {isL2Queried && <CheckCircle className="w-3.5 h-3.5 text-green-500 ml-1" />}
              {isL2Loading && <div className="w-3.5 h-3.5 border-2 border-purple-500 border-t-transparent rounded-full animate-spin ml-1" />}
            </h5>
          </div>

          {l2Error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-2 mb-2 flex items-start gap-1.5">
              <AlertCircle className="w-3.5 h-3.5 text-red-500 flex-shrink-0 mt-0.5" />
              <p className="text-xs text-red-700">{l2Error}</p>
            </div>
          )}

          <div className="space-y-0">
            <InfoRow label="장비형명" value="L2" />
            <InfoRow label="자동연동여부" value={l2Info?.autoYn || '-'} />
            <InfoRow label="장소명칭" value={l2Info?.buildingName || '-'} />
            <InfoRow label="포트번호" value={l2Info?.portNo || '-'} />
            <InfoRow label="장비ID" value={l2Info?.equipId || '-'} />
            <InfoRow label="모형명" value={l2Info?.modelNm || '-'} />
            <InfoRow label="통신속도" value={l2Info?.maxSpeed || '-'} />
            <InfoRow label="제조사명" value={l2Info?.manufacturer || '-'} />
            <InfoRow label="비고" value={l2Info?.remarks || '-'} />
          </div>

          <div className="mt-2 flex justify-end">
            <button onClick={handleOpenL2Ref} className="px-3 py-1.5 rounded-lg text-xs font-medium bg-gray-100 hover:bg-gray-200 text-gray-700 flex items-center gap-1 transition-colors">
              <Database className="w-3 h-3" /> L2 기준정보
            </button>
          </div>
        </div>
      )}

      {/* ============ FTTH: 개통장비정보(OLT) (mowouDivG01) — U+ 전용 ============ */}
      {isCertifyProd && isFtthProd && (
        <>
          {/* 개통장비정보(OLT) 섹션 */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-3 sm:p-4">
            <div className="flex items-center justify-between mb-2">
              <h5 className="text-xs sm:text-sm font-bold text-gray-900 flex items-center gap-1.5">
                <Zap className="w-4 h-4 text-orange-500" />
                개통장비정보(OLT)
                {oltInfo && <CheckCircle className="w-3.5 h-3.5 text-green-500 ml-1" />}
                {isRnLoading && <div className="w-3.5 h-3.5 border-2 border-orange-500 border-t-transparent rounded-full animate-spin ml-1" />}
              </h5>
            </div>

            {l2Error && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-2 mb-2 flex items-start gap-1.5">
                <AlertCircle className="w-3.5 h-3.5 text-red-500 flex-shrink-0 mt-0.5" />
                <p className="text-xs text-red-700">{l2Error}</p>
              </div>
            )}

            {/* OLT Info */}
            <div className="space-y-0">
              <InfoRow label="장비형명" value="OLT" />
              <InfoRow label="모델" value={oltInfo?.OLT_MDL_NM || '-'} />
              <InfoRow label="개통포트" value={oltInfo?.OLT_PORT_NO || '-'} />
              <InfoRow label="IP주소" value={oltInfo?.EQIP_IP || '-'} />
            </div>
          </div>

          {/* ============ FTTH: RN 장비 정보 ============ */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-3 sm:p-4">
            <h5 className="text-xs sm:text-sm font-bold text-gray-900 mb-2 flex items-center gap-1.5">
              <Server className="w-4 h-4 text-orange-500" />
              RN 장비 정보
            </h5>

            {/* RN Combo (레거시: cmb_lgu_rn_list) */}
            {rnList.length > 0 && (
              <div className="mb-3">
                <div className="text-xs font-semibold text-gray-700 mb-1.5">RN 장비 선택</div>
                <div className="relative" ref={rnDropdownRef}>
                  <button
                    type="button"
                    onClick={() => setIsRnDropdownOpen(!isRnDropdownOpen)}
                    className={`w-full px-3 py-2.5 text-xs border rounded-lg bg-white text-left flex items-center justify-between transition-colors ${
                      isRnDropdownOpen ? 'border-orange-400 ring-1 ring-orange-200' : 'border-gray-300'
                    }`}
                  >
                    <span className="truncate text-gray-900">
                      {selectedRn ? (selectedRn.ESTB_PLC_NM || `${selectedRn.EQIP_ID} - ${selectedRn.MDL_NM || selectedRn.EQIP_NM || ''}`) : '장비를 선택하세요'}
                    </span>
                    <ChevronDown className={`w-3.5 h-3.5 text-gray-400 flex-shrink-0 ml-2 transition-transform ${isRnDropdownOpen ? 'rotate-180' : ''}`} />
                  </button>

                  {isRnDropdownOpen && (
                    <div className="absolute z-20 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg max-h-52 overflow-y-auto">
                      {rnList.map((rn) => (
                        <button
                          key={rn.EQIP_ID}
                          type="button"
                          onClick={() => {
                            handleRnChange(rn.EQIP_ID);
                            setIsRnDropdownOpen(false);
                          }}
                          className={`w-full text-left px-3 py-2.5 text-xs transition-colors border-b border-gray-50 last:border-b-0 ${
                            selectedRnId === rn.EQIP_ID
                              ? 'bg-orange-50 text-orange-700 font-semibold'
                              : 'text-gray-700 hover:bg-gray-50 active:bg-gray-100'
                          }`}
                        >
                          <div className="font-medium">{rn.ESTB_PLC_NM || rn.EQIP_ID}</div>
                          <div className="text-[0.65rem] text-gray-500 mt-0.5">
                            {rn.EQIP_ID} · {rn.MDL_NM || rn.EQIP_NM || '-'} · {rn.EQIP_ESTB_FLOO_NM || '-'}
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {selectedRn && (
                  <div className="mt-1.5 space-y-1">
                    <InfoRow label="모델" value={selectedRn.MDL_NM || '-'} />
                    <InfoRow label="설치장소" value={selectedRn.EQIP_ESTB_FLOO_NM || '-'} />
                  </div>
                )}
              </div>
            )}

            {/* RN Port Grid (레거시: gd_line_eqt_port) */}
            {rnPorts.length > 0 && (
              <div>
                <div className="text-xs font-semibold text-gray-700 mb-1.5">포트 목록 ({rnPorts.length}개)</div>
                <div className="border border-gray-200 rounded-lg overflow-hidden">
                  <div className="max-h-48 overflow-y-auto">
                    <table className="w-full text-xs">
                      <thead className="bg-gray-50 sticky top-0">
                        <tr>
                          <th className="px-2 py-1.5 text-left font-semibold text-gray-600 border-b">포트번호</th>
                          <th className="px-2 py-1.5 text-center font-semibold text-gray-600 border-b">사용여부</th>
                          <th className="px-2 py-1.5 text-left font-semibold text-gray-600 border-b">설치ID</th>
                        </tr>
                      </thead>
                      <tbody>
                        {rnPorts.map((port, idx) => (
                          <tr
                            key={`${port.EQIP_ID}-${port.PORT_NO}-${idx}`}
                            onClick={() => !readOnly && handlePortSelect(idx)}
                            className={`cursor-pointer transition-colors ${
                              selectedPortIdx === idx ? 'bg-orange-100 border-l-2 border-l-orange-500' :
                              port.PT_USE === 'Y' ? 'bg-red-50/50' : idx % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'
                            } hover:bg-orange-50`}
                          >
                            <td className="px-2 py-1.5 font-mono border-b">{port.PORT_NO || '-'}</td>
                            <td className="px-2 py-1.5 text-center border-b">
                              <span className={`px-1.5 py-0.5 rounded text-[0.625rem] font-medium ${
                                port.PT_USE === 'Y' ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'
                              }`}>
                                {port.PT_USE === 'Y' ? '사용' : '빈포트'}
                              </span>
                            </td>
                            <td className="px-2 py-1.5 font-mono text-gray-600 border-b">{port.ENTR_NO || '-'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {isPortLoading && (
              <div className="text-center py-4">
                <div className="inline-block w-5 h-5 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
                <p className="mt-1 text-xs text-gray-500">포트 목록 조회 중...</p>
              </div>
            )}
          </div>
        </>
      )}

      {/* ============ 단말인증 집선등록 (비U+ 모드, 레거시 mowoc01m01.xml 동일) ============ */}
      {!isCertifyProd && !isCertifyTarget && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-3 sm:p-4 flex items-start gap-2">
          <AlertCircle className="w-5 h-5 text-yellow-500 flex-shrink-0 mt-0.5" />
          <p className="text-xs sm:text-sm text-yellow-700">단말인증 상품일 경우만 처리 가능합니다.</p>
        </div>
      )}
      {!isCertifyProd && isCertifyTarget && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-3 sm:p-4">
          <h5 className="text-xs sm:text-sm font-bold text-gray-900 mb-3 flex items-center gap-1.5">
            <Wifi className="w-4 h-4 text-blue-500" />
            단말인증 집선등록
            {isQueried && <CheckCircle className="w-3.5 h-3.5 text-green-500 ml-1" />}
            {isLoading && <div className="w-3.5 h-3.5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin ml-1" />}
          </h5>

          {/* 레거시 mowoc01m01 필드 순서 동일 (ds_certify_cl03 바인딩) */}
          <div className="space-y-0 mb-3">
            <InfoRow label="장비유형" value={(certifyInfo as any)?.T || '-'} />
            <InfoRow label="ONT MAC" value={(certifyInfo as any)?.ONT_MAC || ontMac || '-'} />
            <InfoRow label="AP MAC" value={(certifyInfo as any)?.AP_MAC || apMac || '-'} />
            <InfoRow label="ONT_SERIAL" value={(certifyInfo as any)?.ONT_SERIAL || ontSerial || '-'} />
            <InfoRow label="장비 ID" value={(certifyInfo as any)?.DEV_ID || '-'} />
            <InfoRow label="장비 IP" value={(certifyInfo as any)?.IP || '-'} />
            <InfoRow label="포트번호" value={(certifyInfo as any)?.PORT || '-'} />
            <InfoRow label="최고속도" value={(certifyInfo as any)?.MAX_SPEED || '-'} />
            <InfoRow label="속도" value={(certifyInfo as any)?.SPEED || '-'} />
            <InfoRow label="장비상태" value={(certifyInfo as any)?.ST || '-'} />
            <InfoRow label="위치" value={(certifyInfo as any)?.ADDR || '-'} />
            <InfoRow label="집선시간" value={(certifyInfo as any)?.LAST_FOUND || '-'} />
            <InfoRow label="집선계약아이디" value={(certifyInfo as any)?.CONT_ID || '-'} />
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-2 mb-3 flex items-start gap-1.5">
              <AlertCircle className="w-3.5 h-3.5 text-red-500 flex-shrink-0 mt-0.5" />
              <p className="text-xs text-red-700">{error}</p>
            </div>
          )}

          {/* 자동정보조회 버튼 (레거시 btn_auto_info_search) */}
          {!readOnly && (
            <button
              onClick={handleQuery}
              disabled={isLoading || !hasMacInfo}
              className={`w-full py-2.5 rounded-lg font-semibold text-sm flex items-center justify-center gap-2 transition-colors ${
                isLoading ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                : !hasMacInfo ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                : 'bg-blue-500 hover:bg-blue-600 text-white'
              }`}
            >
              {isLoading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  조회 중...
                </>
              ) : (
                <>
                  <Database className="w-4 h-4" />
                  집선등록
                </>
              )}
            </button>
          )}
        </div>
      )}

      {/* 집선등록 버튼 (레거시: btn_LGU_Line_Req_OnClick) - U+ 전용 */}
      {!readOnly && isCertifyProd && (
        <button
          onClick={handleLineRegistration}
          disabled={isRegistering || isLineRegistrationDone || isL2Loading || isLoading || isRnLoading}
          className={`w-full py-3 sm:py-4 rounded-xl font-semibold text-sm sm:text-base flex items-center justify-center gap-2 transition-colors ${
            isLineRegistrationDone
              ? 'bg-green-500 text-white cursor-default'
              : (isRegistering || isL2Loading || isLoading || isRnLoading)
              ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
              : 'bg-orange-500 hover:bg-orange-600 text-white'
          }`}
        >
          {(isL2Loading || isLoading || isRnLoading) && !isRegistering ? (
            <>
              <div className="w-5 h-5 border-2 border-gray-400 border-t-transparent rounded-full animate-spin" />
              자동정보조회 중...
            </>
          ) : isLineRegistrationDone ? (
            <>
              <CheckCircle className="w-4 h-4 sm:w-5 sm:h-5" />
              집선등록 완료
            </>
          ) : isRegistering ? (
            <>
              <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              등록 중...
            </>
          ) : (
            <>
              <Server className="w-4 h-4 sm:w-5 sm:h-5" />
              집선등록
            </>
          )}
        </button>
      )}

      {/* 에러 메시지 */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-3 sm:p-4 flex items-start gap-2">
          <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
          <p className="text-xs sm:text-sm text-red-700">{error}</p>
        </div>
      )}

      {/* 안내 메시지 */}
      {isLineRegistrationDone && !readOnly && (
        <div className="bg-green-50 border border-green-200 rounded-xl p-3 sm:p-4">
          <p className="text-xs sm:text-sm text-green-700">
            집선등록이 완료되었습니다. 상단의 화살표 버튼을 눌러 다음 단계로 이동하세요.
          </p>
        </div>
      )}

      {/* L2 기준정보 모달 */}
      {showL2RefModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md max-h-[80vh] flex flex-col">
            <div className="flex items-center justify-between p-4 border-b border-gray-200">
              <h3 className="text-sm font-bold text-gray-900">LGU+ L2 장비 기준정보</h3>
              <button onClick={() => setShowL2RefModal(false)} className="p-1 hover:bg-gray-100 rounded-lg">
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>
            <div className="flex-1 overflow-auto p-3">
              {isL2RefLoading ? (
                <div className="flex items-center justify-center py-8">
                  <div className="w-6 h-6 border-2 border-purple-500 border-t-transparent rounded-full animate-spin" />
                </div>
              ) : l2RefData.length === 0 ? (
                <div className="text-center py-8 text-sm text-gray-500">데이터가 없습니다.</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-xs" style={{ minWidth: '400px' }}>
                    <thead>
                      <tr className="bg-gray-100">
                        <th className="px-2 py-2 text-left font-semibold text-gray-700 whitespace-nowrap">모델명</th>
                        <th className="px-2 py-2 text-left font-semibold text-gray-700 whitespace-nowrap">제공속도</th>
                        <th className="px-2 py-2 text-left font-semibold text-gray-700 whitespace-nowrap">제조사</th>
                        <th className="px-2 py-2 text-left font-semibold text-gray-700 whitespace-nowrap">비고</th>
                      </tr>
                    </thead>
                    <tbody>
                      {l2RefData.map((item, idx) => (
                        <tr key={idx} className={`border-b border-gray-50 ${idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}`}>
                          <td className="px-2 py-2 text-gray-900 whitespace-nowrap">{item.COMMON_CD_NM || '-'}</td>
                          <td className="px-2 py-2 text-gray-700 whitespace-nowrap">{item.REF_CODE || '-'}</td>
                          <td className="px-2 py-2 text-gray-700 whitespace-nowrap">{item.REF_CODE2 || '-'}</td>
                          <td className="px-2 py-2 text-gray-700 whitespace-nowrap">{item.REF_CODE3 || '-'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
            <div className="p-3 border-t border-gray-200 flex justify-end">
              <button onClick={() => setShowL2RefModal(false)} className="px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg text-sm font-medium text-gray-700">닫기</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default LineRegistration;
