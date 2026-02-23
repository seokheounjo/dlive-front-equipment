/**
 * CompleteSuspend.tsx
 * WRK_CD=04 (정지) 작업완료 페이지
 *
 * 레거시 참조: mowoa03m04.xml - 작업완료(정지)
 * 특징:
 * - 이용정지기간 버튼 (btn_mmt_sus_dd)
 * - 설치정보 입력 필수
 * - WRK_DTL_TCD=0440 (일시철거복구) 시 장비추가 가능
 */
import React, { useState, useEffect, useCallback } from 'react';
import { WorkOrder, WorkCompleteData } from '../../../../types';
import { getCommonCodeList, CommonCode, getWorkReceiptDetail, getCustomerContractInfo, getMmtSusInfo, modMmtSusInfo, sendSignal, getLghvProdMap, getProdPromotionInfo } from '../../../../services/apiService';
import Select from '../../../ui/Select';
import InstallInfoModal, { InstallInfoData } from '../../../modal/InstallInfoModal';
import IntegrationHistoryModal from '../../../modal/IntegrationHistoryModal';
import InstallLocationModal, { InstallLocationData } from '../../../modal/InstallLocationModal';
import ConfirmModal from '../../../common/ConfirmModal';
import WorkCompleteSummary from '../WorkCompleteSummary';
import { useWorkProcessStore } from '../../../../stores/workProcessStore';
import { useCertifyStore } from '../../../../stores/certifyStore';
import { useWorkEquipment } from '../../../../stores/workEquipmentStore';
import { useCompleteWork } from '../../../../hooks/mutations/useCompleteWork';
import { Calendar, AlertCircle } from 'lucide-react';
import '../../../../styles/buttons.css';

interface CompleteSuspendProps {
  order: WorkOrder;
  onBack: () => void;
  onSuccess: () => void;
  showToast?: (message: string, type: 'success' | 'error' | 'warning' | 'info') => void;
  equipmentData?: any;
  readOnly?: boolean;
}

const CompleteSuspend: React.FC<CompleteSuspendProps> = ({
  order,
  onBack,
  onSuccess,
  showToast,
  equipmentData: legacyEquipmentData,
  readOnly = false
}) => {
  const isWorkCompleted = readOnly
    || order.WRK_STAT_CD === '3'
    || order.WRK_STAT_CD === '4'
    || order.WRK_STAT_CD === '7'
    || order.status === '완료'
    || order.status === '취소';

  // 일시철거복구 여부 (레거시: WRK_DTL_TCD == "0440")
  const isTempRemovalRecovery = order.WRK_DTL_TCD === '0440';
  // 단순이전 여부 (레거시: WRK_DTL_TCD == "0430")
  const isSimpleRelocation = order.WRK_DTL_TCD === '0430';

  const [isDataLoaded, setIsDataLoaded] = useState(false);
  const { equipmentData: storeEquipmentData, filteringData } = useWorkProcessStore();
  const { certifyRegconfInfo } = useCertifyStore();

  // Zustand Equipment Store - 장비 컴포넌트에서 등록한 장비 정보
  const workId = order.id || '';
  const zustandEquipment = useWorkEquipment(workId);

  // equipmentData 병합: Zustand Equipment Store 우선 사용
  const equipmentData = {
    ...(storeEquipmentData || legacyEquipmentData || filteringData || {}),
    installedEquipments: zustandEquipment.installedEquipments.length > 0
      ? zustandEquipment.installedEquipments
      : (storeEquipmentData?.installedEquipments || legacyEquipmentData?.installedEquipments || []),
    removedEquipments: zustandEquipment.markedForRemoval.length > 0
      ? zustandEquipment.markedForRemoval
      : (storeEquipmentData?.removedEquipments || legacyEquipmentData?.removedEquipments || []),
    removalStatus: Object.keys(zustandEquipment.removalStatus).length > 0
      ? zustandEquipment.removalStatus
      : (storeEquipmentData?.removalStatus || legacyEquipmentData?.removalStatus || {}),
  };

  const { mutate: submitWork, isPending: isLoading } = useCompleteWork();

  const getStorageKey = () => `work_complete_draft_${order.id}`;

  // 폼 상태
  const [custRel, setCustRel] = useState('');
  const [memo, setMemo] = useState('');
  const [internetUse, setInternetUse] = useState('');
  const [voipUse, setVoipUse] = useState('');
  const [dtvUse, setDtvUse] = useState('');

  // 타사이용여부 접기/펼치기 상태
  const [isServiceUseExpanded, setIsServiceUseExpanded] = useState(false);

  // 결합계약 선택 (VoIP/ISP)
  const [voipJoinCtrtId, setVoipJoinCtrtId] = useState('');
  const [joinCtrtOptions, setJoinCtrtOptions] = useState<{ value: string; label: string }[]>([]);
  const [showJoinCtrt, setShowJoinCtrt] = useState(false);
  const [customerCtrtList, setCustomerCtrtList] = useState<any[]>([]);

  // 모달
  const [showInstallInfoModal, setShowInstallInfoModal] = useState(false);
  const [networkType, setNetworkType] = useState((order as any).NET_CL || '');
  const [networkTypeName, setNetworkTypeName] = useState((order as any).NET_CL_NM || '');
  const [installInfoData, setInstallInfoData] = useState<InstallInfoData | undefined>(() => {
    // 정지작업은 기존 계약 정보가 있으므로 order에서 초기값 설정
    if ((order as any).NET_CL) {
      return {
        NET_CL: (order as any).NET_CL || '',
        NET_CL_NM: (order as any).NET_CL_NM || '',
        WRNG_TP: (order as any).WRNG_TP || '',
        INSTL_TP: (order as any).INSTL_TP || '',
        CB_WRNG_TP: (order as any).CB_WRNG_TP || '',
        CB_INSTL_TP: (order as any).CB_INSTL_TP || '',
        INOUT_LINE_TP: (order as any).INOUT_LINE_TP || '',
        INOUT_LEN: (order as any).INOUT_LEN || '',
        DVDR_YN: (order as any).DVDR_YN || '',
        BFR_LINE_YN: (order as any).BFR_LINE_YN || '',
        CUT_YN: (order as any).CUT_YN || '',
        TERM_NO: (order as any).TERM_NO || '',
        RCV_STS: (order as any).RCV_STS || '',
        SUBTAP_ID: (order as any).SUBTAP_ID || '',
        PORT_NUM: (order as any).PORT_NUM || '',
        EXTN_TP: (order as any).EXTN_TP || '',
        TAB_LBL: (order as any).TAB_LBL || '',
        CVT_LBL: (order as any).CVT_LBL || '',
        STB_LBL: (order as any).STB_LBL || '',
      };
    }
    return undefined;
  });
  const [showIntegrationHistoryModal, setShowIntegrationHistoryModal] = useState(false);
  const [showInstallLocationModal, setShowInstallLocationModal] = useState(false);
  const [installLocationText, setInstallLocationText] = useState('');
  const [viewModCd, setViewModCd] = useState('');
  const [viewModNm, setViewModNm] = useState('');

  // 작업완료 확인 모달
  const [showConfirmModal, setShowConfirmModal] = useState(false);

  // 정지기간 인라인 상태
  const [susInfo, setSusInfo] = useState<{
    SUS_HOPE_DD: string;
    MMT_SUS_HOPE_DD: string;
    VALID_SUS_DAYS: string;
    MMT_SUS_CD: string;
    WRK_DTL_TCD: string;
  } | null>(null);
  const [susLoading, setSusLoading] = useState(false);
  const [susNewEndDate, setSusNewEndDate] = useState('');
  const [susCanEdit, setSusCanEdit] = useState(false);
  const [susError, setSusError] = useState<string | null>(null);
  const [susSaving, setSusSaving] = useState(false);
  const [susPendingSave, setSusPendingSave] = useState(false); // 임시저장 상태

  // LGHV STB 상품 판단 (레거시: bLghvStb, ds_lghv_prod)
  const [isLghvStb, setIsLghvStb] = useState(false);
  const [lghvProdList, setLghvProdList] = useState<any[]>([]);

  // 공통코드
  const [custRelOptions, setCustRelOptions] = useState<{ value: string; label: string }[]>([]);
  const [internetOptions, setInternetOptions] = useState<{ value: string; label: string }[]>([]);
  const [voipOptions, setVoipOptions] = useState<{ value: string; label: string }[]>([]);
  const [dtvOptions, setDtvOptions] = useState<{ value: string; label: string }[]>([]);

  const [workCompleteDate, setWorkCompleteDate] = useState(() => {
    const cmplDt = (order as any).WRKR_CMPL_DT || (order as any).WRK_END_DTTM;
    if (cmplDt && cmplDt.length >= 8) {
      return `${cmplDt.slice(0,4)}-${cmplDt.slice(4,6)}-${cmplDt.slice(6,8)}`;
    }
    const today = new Date();
    return today.getFullYear() + '-' +
      String(today.getMonth() + 1).padStart(2, '0') + '-' +
      String(today.getDate()).padStart(2, '0');
  });

  // 데이터 복원 - 정지작업은 기존 설치정보가 있으므로 API에서 가져옴
  useEffect(() => {
    const fetchWorkDetail = async () => {
      try {
        console.log('[WorkCompleteMove] 작업 상세 조회 시작');
        const detail = await getWorkReceiptDetail({
          WRK_DRCTN_ID: order.directionId || order.WRK_DRCTN_ID || '',
          WRK_ID: order.id,  // order.id가 실제 WRK_ID
          SO_ID: order.SO_ID
        });

        if (detail) {
          console.log('[WorkCompleteMove] 작업 상세 조회 성공:', { NET_CL: detail.NET_CL, NET_CL_NM: detail.NET_CL_NM });

          // 완료된 작업이면 모든 값 복원
          if (isWorkCompleted) {
            setCustRel(detail.CUST_REL || '');
            setMemo((detail.WRK_PROC_CT || '').replace(/\\n/g, '\n'));
            setInternetUse(detail.PSN_USE_CORP || '');
            setVoipUse(detail.VOIP_USE_CORP || '');
            setDtvUse(detail.DTV_USE_CORP || '');
            if (detail.WRKR_CMPL_DT && detail.WRKR_CMPL_DT.length >= 8) {
              setWorkCompleteDate(`${detail.WRKR_CMPL_DT.slice(0,4)}-${detail.WRKR_CMPL_DT.slice(4,6)}-${detail.WRKR_CMPL_DT.slice(6,8)}`);
            }
            // 결합계약 ID 복원
            if (detail.VOIP_JOIN_CTRT_ID) {
              setVoipJoinCtrtId(detail.VOIP_JOIN_CTRT_ID);
            }
          }

          // 설치정보는 항상 API에서 가져옴 (기존 계약 정보)
          setNetworkType(detail.NET_CL || '');
          setNetworkTypeName(detail.NET_CL_NM || '');
          setInstallLocationText(prev => prev || detail.INSTL_LOC || '');
          setInstallInfoData(prev => prev || {
            NET_CL: detail.NET_CL || '',
            NET_CL_NM: detail.NET_CL_NM || '',
            WRNG_TP: detail.WRNG_TP || '',
            INSTL_TP: detail.INSTL_TP || '',
            CB_WRNG_TP: detail.CB_WRNG_TP || '',
            CB_INSTL_TP: detail.CB_INSTL_TP || '',
            INOUT_LINE_TP: detail.INOUT_LINE_TP || '',
            INOUT_LEN: detail.INOUT_LEN || '',
            DVDR_YN: detail.DVDR_YN || '',
            BFR_LINE_YN: detail.BFR_LINE_YN || '',
            CUT_YN: detail.CUT_YN || '',
            TERM_NO: detail.TERM_NO || '',
            RCV_STS: detail.RCV_STS || '',
            SUBTAP_ID: detail.SUBTAP_ID || '',
            PORT_NUM: detail.PORT_NUM || '',
            EXTN_TP: detail.EXTN_TP || '',
            TAB_LBL: detail.TAB_LBL || '',
            CVT_LBL: detail.CVT_LBL || '',
            STB_LBL: detail.STB_LBL || '',
          });
        }
      } catch (error) {
        console.error('[WorkCompleteMove] 작업 상세 조회 실패:', error);
      }

      // 진행 중인 작업이면 localStorage에서 사용자 입력값 복원
      if (!isWorkCompleted) {
        const savedDraft = localStorage.getItem(getStorageKey());
        if (savedDraft) {
          try {
            const draftData = JSON.parse(savedDraft);
            setCustRel(draftData.custRel || '');
            setMemo(draftData.memo || '');
            // 사용자가 설치정보를 수정했으면 그 값 사용
            if (draftData.installInfoData) {
              setNetworkType(draftData.networkType || '');
              setNetworkTypeName(draftData.networkTypeName || '');
              setInstallLocationText(draftData.installLocationText || '');
              setInstallInfoData(draftData.installInfoData);
            }
            // 결합계약 ID 복원
            if (draftData.voipJoinCtrtId) {
              setVoipJoinCtrtId(draftData.voipJoinCtrtId);
            }
          } catch (error) {
            console.error('[WorkCompleteMove] localStorage 복원 실패:', error);
          }
        }
      }

      setIsDataLoaded(true);
    };

    fetchWorkDetail();
  }, [order.id, isWorkCompleted]);

  // 자동 저장
  useEffect(() => {
    if (!isDataLoaded || isWorkCompleted) return;
    const draftData = {
      custRel, memo, internetUse, voipUse, dtvUse,
      networkType, networkTypeName, installLocationText, installInfoData,
      voipJoinCtrtId,
      savedAt: new Date().toISOString()
    };
    localStorage.setItem(getStorageKey(), JSON.stringify(draftData));
  }, [custRel, memo, internetUse, voipUse, dtvUse,
      networkType, networkTypeName, installLocationText, installInfoData, voipJoinCtrtId, isDataLoaded, isWorkCompleted]);

  // 정지기간 헬퍼 함수들
  const formatDateForInput = (yyyymmdd: string): string => {
    if (!yyyymmdd || yyyymmdd.length !== 8) return '';
    return `${yyyymmdd.slice(0, 4)}-${yyyymmdd.slice(4, 6)}-${yyyymmdd.slice(6, 8)}`;
  };
  const formatDateForApi = (isoDate: string): string => isoDate.replace(/-/g, '');
  const getTodayString = (): string => new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const calculateSusDays = (startDate: string, endDate: string): number => {
    if (!startDate || !endDate) return 0;
    const start = new Date(formatDateForInput(startDate));
    const end = new Date(formatDateForInput(endDate));
    return Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
  };

  // 해당월 말일 계산
  const getLastDayOfMonth = (date: Date): Date => {
    return new Date(date.getFullYear(), date.getMonth() + 1, 0);
  };

  // 현재가 해당월 마지막 주인지 확인 (해당월 마지막 7일)
  const isLastWeekOfMonth = (date: Date): boolean => {
    const lastDay = getLastDayOfMonth(date);
    const daysUntilEnd = lastDay.getDate() - date.getDate();
    return daysUntilEnd < 7;
  };

  // 기본 종료일 계산: 마지막 주면 익월 말일, 아니면 해당월 말일
  const getDefaultEndDate = (): string => {
    const today = new Date();
    let targetDate: Date;

    if (isLastWeekOfMonth(today)) {
      // 마지막 주면 익월 말일
      targetDate = new Date(today.getFullYear(), today.getMonth() + 2, 0);
    } else {
      // 그 외 해당월 말일
      targetDate = getLastDayOfMonth(today);
    }

    return targetDate.toISOString().slice(0, 10); // YYYY-MM-DD
  };

  // 정지기간 정보 조회
  const fetchSuspensionInfo = useCallback(async () => {
    const rcptId = order.RCPT_ID || '';
    const ctrtId = order.CTRT_ID || '';
    if (!rcptId || !ctrtId) return;

    setSusLoading(true);
    setSusError(null);

    try {
      const info = await getMmtSusInfo({ RCPT_ID: rcptId, CTRT_ID: ctrtId });
      console.log('[CompleteMove] 정지기간 조회 결과:', info);

      if (info) {
        setSusInfo(info);

        const today = getTodayString();
        if (info.WRK_DTL_TCD === '0430' && info.MMT_SUS_HOPE_DD <= today) {
          // 수정 모드: 기본 종료일을 해당월 말일로 설정 (마지막 주면 익월 말일)
          const defaultEndDate = getDefaultEndDate();
          setSusNewEndDate(defaultEndDate);
          setSusCanEdit(true);
          console.log('[CompleteMove] 수정 모드 - 기본 종료일 설정:', defaultEndDate);
          showToast?.('이용정지기간 종료일이 경과되었습니다. 이용정지기간을 다시 설정하십시오.', 'warning');
        } else {
          // 읽기 모드: API에서 받아온 값 사용
          setSusNewEndDate(formatDateForInput(info.MMT_SUS_HOPE_DD));
          setSusCanEdit(false);
        }
      }
    } catch (err: any) {
      console.error('[CompleteMove] 정지기간 조회 실패:', err);
      setSusError(err.message || '정지기간 정보 조회 실패');
    } finally {
      setSusLoading(false);
    }
  }, [order.RCPT_ID, order.CTRT_ID, showToast]);

  useEffect(() => {
    fetchSuspensionInfo();
  }, [fetchSuspensionInfo]);

  // 정지기간 종료일 변경 핸들러
  const handleSusEndDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newDate = e.target.value;
    setSusNewEndDate(newDate);
    setSusError(null);

    if (!susInfo) return;

    const startDateStr = formatDateForInput(susInfo.SUS_HOPE_DD);
    if (newDate < startDateStr) {
      setSusError('종료일은 시작일 이후로 설정해주세요.');
      return;
    }

    if (susInfo.VALID_SUS_DAYS && parseInt(susInfo.VALID_SUS_DAYS) > 0) {
      const validDays = parseInt(susInfo.VALID_SUS_DAYS);
      const startDate = new Date(startDateStr);
      const maxEndDate = new Date(startDate);
      maxEndDate.setDate(maxEndDate.getDate() + validDays - 1);

      if (new Date(newDate) > maxEndDate) {
        setSusError(`해당 정지유형의 이용정지기간은 ${maxEndDate.toISOString().slice(0, 10)} 까지 가능합니다.`);
      }
    }
  };

  // 정지기간 임시저장 핸들러 (작업완료 시 API 호출)
  const handleSusSave = () => {
    if (!susInfo || !susNewEndDate) return;

    const startDateStr = formatDateForInput(susInfo.SUS_HOPE_DD);
    if (susNewEndDate < startDateStr) {
      showToast?.('종료일은 시작일 이후로 설정해주세요.', 'error');
      return;
    }

    // 임시저장 - 작업완료 시 API 호출됨
    setSusPendingSave(true);
    setSusCanEdit(false);
    showToast?.('정지기간이 임시저장되었습니다. 작업완료 시 반영됩니다.', 'info');
  };

  // 공통코드 로드
  useEffect(() => {
    const loadCodes = async () => {
      try {
        const codes = await getCommonCodeList([
          'CMCU005', 'CMCU057', 'CMCU110', 'CMCU148'
        ]);

        if (codes['CMCU005']) {
          setCustRelOptions(codes['CMCU005'].map((code: CommonCode) => ({
            value: code.COMMON_CD, label: code.COMMON_CD_NM
          })));
        }
        if (codes['CMCU057']) {
          setInternetOptions(codes['CMCU057'].map((code: CommonCode) => ({
            value: code.COMMON_CD, label: code.COMMON_CD_NM
          })));
        }
        if (codes['CMCU110']) {
          setVoipOptions(codes['CMCU110'].map((code: CommonCode) => ({
            value: code.COMMON_CD, label: code.COMMON_CD_NM
          })));
        }
        if (codes['CMCU148']) {
          setDtvOptions(codes['CMCU148'].map((code: CommonCode) => ({
            value: code.COMMON_CD, label: code.COMMON_CD_NM
          })));
        }
      } catch (error) {
        console.error('[WorkCompleteMove] 공통코드 로드 실패:', error);
      }
    };
    loadCodes();
  }, []);

  // LGHV 상품맵 조회 및 판단 (레거시: fn_getLghvProdMap)
  useEffect(() => {
    const fetchLghvProdMap = async () => {
      try {
        const result = await getLghvProdMap();
        const prodList = result?.output || result || [];
        setLghvProdList(prodList);

        const currentProdCd = order.PROD_CD || (order as any).PROD_CD || '';
        const isLghv = prodList.some((item: any) => item.PROD_CD === currentProdCd);
        setIsLghvStb(isLghv);
        console.log('[CompleteSuspend] LGHV 판단:', { currentProdCd, isLghv, prodListCount: prodList.length });
      } catch (error) {
        console.error('[CompleteSuspend] LGHV 상품맵 조회 실패:', error);
      }
    };
    fetchLghvProdMap();
  }, [order.PROD_CD]);

  // 고객 계약 목록 로드 (결합계약 선택용)
  useEffect(() => {
    if (isWorkCompleted) return;

    const custId = order.customer?.id || (order as any).CUST_ID;
    if (!custId) return;

    const loadCustomerContracts = async () => {
      try {
        console.log('[WorkCompleteMove] 고객 계약 목록 조회 시작:', custId);
        const contracts = await getCustomerContractInfo({ CUST_ID: custId });
        console.log('[WorkCompleteMove] 고객 계약 목록:', contracts);
        setCustomerCtrtList(contracts || []);
      } catch (error) {
        console.error('[WorkCompleteMove] 고객 계약 목록 조회 실패:', error);
        setCustomerCtrtList([]);
      }
    };

    loadCustomerContracts();
  }, [order.customer?.id, (order as any).CUST_ID, isWorkCompleted]);

  // VoIP/ISP 결합 계약 처리
  useEffect(() => {
    if (isWorkCompleted) return;
    if (customerCtrtList.length === 0) {
      console.log('[WorkCompleteMove] 고객 계약 목록 대기 중...');
      return;
    }

    const prodGrp = (order as any).PROD_GRP || '';
    const voipProdCd = (order as any).VOIP_PROD_CD || '';
    const ispProdCd = (order as any).ISP_PROD_CD || '';
    const wrkStatCd = order.WRK_STAT_CD || '';
    const addrOrd = (order as any).ADDR_ORD || '';

    console.log('[WorkCompleteMove] 결합계약 필터링 시작:', {
      prodGrp, voipProdCd, ispProdCd, wrkStatCd, addrOrd,
      customerCtrtListCount: customerCtrtList.length
    });

    if (prodGrp === 'V' && !voipProdCd) {
      const filteredContracts = customerCtrtList.filter((ctrt: any) => {
        const ctrtProdGrp = ctrt.PROD_GRP || '';
        const ctrtStat = ctrt.CTRT_STAT || '';
        const ctrtAddrOrd = ctrt.ADDR_ORD || ctrt.addr_ord || '';
        return (ctrtProdGrp === 'C' || ctrtProdGrp === 'D' || ctrtProdGrp === 'I')
          && ctrtStat === '20'
          && (!addrOrd || ctrtAddrOrd === addrOrd);
      });

      console.log('[WorkCompleteMove] VoIP 결합계약 필터링 결과:', filteredContracts);

      if (filteredContracts.length < 1 && wrkStatCd === '2') {
        showToast?.('VOIP와 결합될 DTV, ISP 계약이 없습니다. ISP나 DTV 설치완료 후 작업하여 주십시오.', 'warning');
      }

      const options = [
        { value: '', label: '선택' },
        ...filteredContracts.map((ctrt: any) => ({
          value: ctrt.CTRT_ID || '',
          label: `[${ctrt.CTRT_ID}] ${ctrt.BASIC_PROD_CD_NM || ctrt.PROD_NM || ''}`
        }))
      ];
      setJoinCtrtOptions(options);
      setShowJoinCtrt(true);
      return;
    }

    if (prodGrp === 'I' && ispProdCd) {
      const filteredContracts = customerCtrtList.filter((ctrt: any) => {
        const ctrtProdGrp = ctrt.PROD_GRP || '';
        const ctrtStat = ctrt.CTRT_STAT || '';
        const ctrtAddrOrd = ctrt.ADDR_ORD || ctrt.addr_ord || '';
        const ispJoinId = ctrt.ISP_JOIN_ID || '';
        const kpiProdGrpCd = ctrt.KPI_PROD_GRP_CD || '';
        return (ctrtProdGrp === 'D' || ctrtProdGrp === 'C')
          && ctrtStat === '20'
          && !ispJoinId
          && kpiProdGrpCd === 'D'
          && (!addrOrd || ctrtAddrOrd === addrOrd);
      });

      console.log('[WorkCompleteMove] ISP 결합계약 필터링 결과:', filteredContracts);

      if (filteredContracts.length < 1 && wrkStatCd === '2') {
        showToast?.('ISP와 결합될 DTV 계약이 없습니다. DTV 설치완료 후 작업하여 주십시오.', 'warning');
      }

      const options = [
        { value: '', label: '선택' },
        ...filteredContracts.map((ctrt: any) => ({
          value: ctrt.CTRT_ID || '',
          label: `[${ctrt.CTRT_ID}] ${ctrt.BASIC_PROD_CD_NM || ctrt.PROD_NM || ''}`
        }))
      ];
      setJoinCtrtOptions(options);
      setShowJoinCtrt(true);
      return;
    }

    setShowJoinCtrt(false);
    setJoinCtrtOptions([]);
  }, [order.id, order.WRK_STAT_CD, isWorkCompleted, showToast, customerCtrtList]);

  // 검증
  const validate = (): string[] => {
    const errors: string[] = [];
    if (!custRel) errors.push('고객과의 관계를 선택해주세요.');
    if (!installInfoData?.NET_CL) errors.push('설치정보를 입력해주세요.');
    // 정지작업(04)은 설치위치 체크 제외
    if (order.WRK_CD !== '04' && !installLocationText && !order.installLocation) errors.push('설치위치를 설정해주세요.');
    if (!workCompleteDate) errors.push('작업처리일을 선택해주세요.');

    // VoIP/ISP 결합계약 선택 validation
    const prodGrp = (order as any).PROD_GRP || '';

    // WRK_DTL_TCD=0430 (단순이전) 시 모든 장비 철거 체크
    if (order.WRK_DTL_TCD === '0430') {
      const installedCount = equipmentData?.installedEquipments?.length || 0;
      if (installedCount > 0) {
        errors.push('모든 장비를 철거해주세요.');
      }
    } else {
      // 일반 정지/복구: 설치 장비 검증 (레거시: mowoa03m04.xml 694줄)
      // VoIP가 아닌 경우 장비가 최소 1개 이상 등록되어 있어야 함
      const installedEquipments = equipmentData?.installedEquipments || [];
      if (prodGrp !== 'V' && installedEquipments.length < 1) {
        errors.push('신호처리(장비등록)를 먼저 진행해주세요.');
      }
    }
    const voipProdCd = (order as any).VOIP_PROD_CD || '';
    const ispProdCd = (order as any).ISP_PROD_CD || '';

    if (prodGrp === 'V' && !voipProdCd && showJoinCtrt) {
      if (!voipJoinCtrtId) {
        errors.push('VOIP의 결합할 계약을 선택하여 주십시오.');
      }
    }
    if (prodGrp === 'I' && ispProdCd && showJoinCtrt) {
      if (!voipJoinCtrtId) {
        errors.push('결합이 필요한 ISP 상품입니다. 결합할 계약을 선택하여 주십시오.');
      }
    }

    return errors;
  };

  const handleInstallInfoSave = (data: InstallInfoData) => {
    setInstallInfoData(data);
    if (data.NET_CL) setNetworkType(data.NET_CL);
    if (data.NET_CL_NM) setNetworkTypeName(data.NET_CL_NM);
    showToast?.('설치 정보가 저장되었습니다.', 'success');
  };

  // 작업 완료 처리 - 확인 모달 표시
  const handleSubmit = () => {
    if (isLoading) return;

    const errors = validate();
    if (errors.length > 0) {
      errors.forEach(error => showToast?.(error, 'error'));
      return;
    }

    setShowConfirmModal(true);
  };

  // 장비 목록 변환 함수 (nested → flat 구조)
  const processEquipmentList = (equipments: any[], isRemoval = false) => {
    if (!equipments || equipments.length === 0) return [];
    const userInfo = localStorage.getItem('userInfo');
    const user = userInfo ? JSON.parse(userInfo) : {};
    const workerId = user.userId || 'A20130708';
    const removalStatus = equipmentData?.removalStatus || {};

    // 레거시 호환: '0' = 회수, '1' = 분실
    const getYN = (eqVal: any, statusVal: any) =>
      (eqVal === '1' || eqVal === 'Y' || statusVal === '1' || statusVal === 'Y') ? '1' : '0';

    return equipments.map((eq: any) => {
      const eqtNo = eq.EQT_NO || eq.id || (eq.actualEquipment?.id) || '';
      const status = removalStatus[eqtNo] || {};
      // 회수 장비 필수 필드 - 5개 분실/파손 필드 모두 포함 (정지에서는 REUSE_YN 미사용)
      const removalFields = isRemoval ? {
        CRR_TSK_CL: order.WRK_CD || '04',
        RCPT_ID: order.RCPT_ID || '',
        CRR_ID: order.CRR_ID || user.crrId || '01',
        WRKR_ID: workerId,
        EQT_LOSS_YN: getYN(eq.EQT_LOSS_YN, status.EQT_LOSS_YN),
        PART_LOSS_BRK_YN: getYN(eq.PART_LOSS_BRK_YN, status.PART_LOSS_BRK_YN),
        EQT_BRK_YN: getYN(eq.EQT_BRK_YN, status.EQT_BRK_YN),
        EQT_CABL_LOSS_YN: getYN(eq.EQT_CABL_LOSS_YN, status.EQT_CABL_LOSS_YN),
        EQT_CRDL_LOSS_YN: getYN(eq.EQT_CRDL_LOSS_YN, status.EQT_CRDL_LOSS_YN),
      } : {};

      if (eq.actualEquipment) {
        const actual = eq.actualEquipment;
        const contract = eq.contractEquipment || {};
        return {
          ...actual,
          EQT_NO: actual.id,
          EQT_SERNO: actual.serialNumber,
          ITEM_MID_CD: actual.itemMidCd,
          EQT_CL_CD: actual.eqtClCd,
          MAC_ADDRESS: eq.macAddress || actual.macAddress,
          WRK_ID: order.id,
          CUST_ID: order.customer?.id,
          CTRT_ID: order.CTRT_ID,
          WRK_CD: order.WRK_CD,
          REG_UID: workerId,
          SVC_CMPS_ID: contract.SVC_CMPS_ID || eq.SVC_CMPS_ID || '',
          BASIC_PROD_CMPS_ID: contract.BASIC_PROD_CMPS_ID || eq.BASIC_PROD_CMPS_ID || '',
          PROD_CMPS_ID: contract.PROD_CMPS_ID || eq.PROD_CMPS_ID || '',
          SVC_CD: contract.SVC_CD || eq.SVC_CD || '',
          PROD_CD: contract.PROD_CD || eq.PROD_CD || '',
          LENT_YN: eq.lentYn || eq.LENT_YN || contract.LENT_YN || '',
          EQT_CHG_GB: eq.EQT_CHG_GB || '01',
          ...removalFields,
        };
      }

      // 중첩 구조가 아닌 경우도 필드 매핑 필요
      return {
        ...eq,
        EQT_NO: eq.EQT_NO || eq.id || '',
        EQT_SERNO: eq.EQT_SERNO || eq.serialNumber || '',
        ITEM_MID_CD: eq.ITEM_MID_CD || eq.itemMidCd || '',
        EQT_CL_CD: eq.EQT_CL_CD || eq.eqtClCd || '',
        MAC_ADDRESS: eq.MAC_ADDRESS || eq.macAddress || '',
        SVC_CMPS_ID: eq.SVC_CMPS_ID || '',
        BASIC_PROD_CMPS_ID: eq.BASIC_PROD_CMPS_ID || '',
        PROD_CD: eq.PROD_CD || '',
        SVC_CD: eq.SVC_CD || '',
        WRK_ID: order.id,
        CUST_ID: order.customer?.id,
        CTRT_ID: order.CTRT_ID,
        WRK_CD: order.WRK_CD,
        REG_UID: workerId,
        ...removalFields,
      };
    });
  };

  // 실제 작업 완료 처리
  const handleConfirmSubmit = async () => {
    const formattedDate = workCompleteDate.replace(/-/g, '');
    const userInfo = localStorage.getItem('userInfo');
    const user = userInfo ? JSON.parse(userInfo) : {};
    const workerId = user.userId || 'A20130708';

    // 레거시(mowoa03m04.xml)에는 정지 작업에 대한 certify(집선등록) 로직이 없음
    // CL-04/CL-06 호출 없이 바로 작업완료 처리

    // 임시저장된 정지기간이 있으면 먼저 API 호출
    if (susPendingSave && susInfo && susNewEndDate) {
      setSusSaving(true);
      try {
        const susStartDate = susInfo.SUS_HOPE_DD;
        const susEndDate = formatDateForApi(susNewEndDate);
        const susDays = calculateSusDays(susStartDate, susEndDate);

        const susResult = await modMmtSusInfo({
          CTRT_ID: order.CTRT_ID || '',
          RCPT_ID: order.RCPT_ID || '',
          SUS_HOPE_DD: susStartDate,
          MMT_SUS_HOPE_DD: susEndDate,
          SUS_DD_NUM: String(susDays),
          REG_UID: workerId,
        });

        if (susResult.code !== 'SUCCESS') {
          showToast?.(susResult.message || '정지기간 수정 실패', 'error', true);
          setSusSaving(false);
          return;
        }
        console.log('[CompleteMove] 정지기간 수정 성공');
      } catch (err: any) {
        showToast?.(err.message || '정지기간 수정 실패', 'error', true);
        setSusSaving(false);
        return;
      }
      setSusSaving(false);
    }

    // 철거 신호 호출 (레거시: mowoa03m04.xml btn_save line 1023-1031)
    // 레거시 조건: WRK_DTL_TCD=0430일 때, ds_eqt_cust.rowcount>0 || ds_rmv_eqt_info.rowcount>0 || ISP_PROD_CD
    const removedEquipments = equipmentData?.removedEquipments || [];
    const customerEquipmentsForDel = equipmentData?.customerEquipments || [];
    const installedEquipmentsForDel = equipmentData?.installedEquipments || [];
    const hasIspProdForDel = !!(order as any).ISP_PROD_CD;
    const isDelsignalTarget = order.WRK_DTL_TCD === '0430' || order.WRK_DTL_TCD === '0470';
    if (isDelsignalTarget && (removedEquipments.length > 0 || customerEquipmentsForDel.length > 0 || installedEquipmentsForDel.length > 0 || hasIspProdForDel)) {
      try {
        let msgId = 'SMR05';
        let etc1 = '';

        if (isLghvStb) {
          msgId = 'STB_DEL';
          // 레거시: 철거신호에서는 etc_1~4 모두 빈값 (개통신호와 다름)
        }

        const firstEquip = removedEquipments[0];
        const actual = firstEquip.actualEquipment || firstEquip;
        const eqtProdCmpsId = actual.PROD_CMPS_ID || firstEquip.PROD_CMPS_ID || actual.EQT_PROD_CMPS_ID || firstEquip.EQT_PROD_CMPS_ID || '';

        const voipProdCd = (order as any).VOIP_PROD_CD || '';
        const voipJoinCtrtId = voipProdCd ? (order.CTRT_ID || '') : '';

        console.log('[CompleteMove] 철거 신호 호출:', { msgId, isLghvStb, etc1, eqtProdCmpsId });

        const result = await sendSignal({
          MSG_ID: msgId,
          CUST_ID: order.customer?.id || order.CUST_ID || '',
          CTRT_ID: order.CTRT_ID || '',
          SO_ID: order.SO_ID || '',
          EQT_NO: '',
          EQT_PROD_CMPS_ID: eqtProdCmpsId,
          PROD_CD: '',
          WRK_ID: order.id || '',
          REG_UID: workerId,
          ETC_1: etc1,
          VOIP_JOIN_CTRT_ID: voipJoinCtrtId,
          WTIME: '3',
        });

        // 레거시 mowoa03m04.xml: 신호 실패 시 메시지만 띄우고 항상 계속 진행 (return 없음)
        if (result.code !== 'SUCCESS' && result.code !== 'OK') {
          console.warn('[CompleteMove] 철거 신호 실패 - 계속 진행:', result.message);
          showToast?.('철거 신호 전송에 실패했습니다.', 'warning');
        } else {
          console.log('[CompleteMove] 철거 신호 호출 완료');
        }
      } catch (error) {
        // 레거시 동일: 신호 오류 시에도 작업완료 계속 진행
        console.warn('[CompleteMove] 철거 신호 처리 중 오류 - 계속 진행:', error);
        showToast?.('철거 신호 처리 중 오류가 발생했습니다.', 'warning');
      }
    }

    // 개통 신호 전송 함수 (레거시: modWorkComplete SUCCESS 콜백에서 호출)
    const sendInstallationSignal = async () => {
    const customerEquipments = equipmentData?.customerEquipments || [];
    const installedEquipments = equipmentData?.installedEquipments || [];
    const hasIspProd = !!(order as any).ISP_PROD_CD;
    if (order.WRK_DTL_TCD === '0440' && (customerEquipments.length > 0 || installedEquipments.length > 0 || hasIspProd)) {
      try {
        const prodGrp = (order as any).PROD_GRP || '';
        let msgId = 'SMR03';
        let eqtNo = '';
        let etc1 = '';
        let etc2 = '';
        let etc3 = '';
        let etc4 = '';
        let voipJoinCtrtIdForSignal = '';

        // LGHV STB -> STB_CRT (레거시 line 813-814)
        // VoIP 단독 -> SMR60 (레거시 line 796-798)
        if (prodGrp === 'V') {
          msgId = 'SMR60';
        } else if (isLghvStb) {
          msgId = 'STB_CRT';
        }

        // prodPromoInfo에서 파라미터 추출 (레거시 line 688, 702, 737)
        let prodPromoInfo = equipmentData?.prodPromoInfo || [];
        if (prodPromoInfo.length === 0) {
          try {
            prodPromoInfo = await getProdPromotionInfo({
              RCPT_ID: order.RCPT_ID || '',
              CTRT_ID: order.CTRT_ID || '',
              CRR_ID: order.CRR_ID || '',
              WRKR_ID: workerId,
              PROD_CD: order.PROD_CD || '',
              CRR_TSK_CL: order.WRK_CD || '04',
              WRK_ID: order.id || '',
              ADDR_ORD: (order as any).ADDR_ORD || '',
              WRK_CD: order.WRK_CD || '04',
              WRK_STAT_CD: order.WRK_STAT_CD || '',
            });
          } catch (e) { console.log('[CompleteSuspend] prodPromoInfo 조회 실패:', e); }
        }

        const eqtProdCmpsId = prodPromoInfo.find((item: any) => item.PROD_CMPS_CL === '23')?.PROD_CMPS_ID || '';
        const cmps11 = prodPromoInfo.find((item: any) => item.PROD_CMPS_CL === '11');
        const prodCd = cmps11?.PROD_CD || '';
        const prodGrpFromPromo = cmps11?.PROD_GRP || prodGrp;
        const subProds = prodPromoInfo
          .filter((item: any) => item.BASIC_PROD_FL === 'V')
          .map((item: any) => item.PROD_CD);
        const subProdCd = subProds.length > 0 ? subProds.join(',') : '';

        // 장비번호(eqt_no) 결정 - 레거시 우선순위: 05>01>03>02(I)>08
        const allEquips = [...customerEquipments, ...installedEquipments];
        const findEqtNo = (itemMidCd: string) => {
          const eq = allEquips.find((e: any) => {
            const a = e.actualEquipment || e;
            return (a.itemMidCd || a.ITEM_MID_CD) === itemMidCd;
          });
          if (!eq) return '';
          const a = eq.actualEquipment || eq;
          return a.id || a.EQT_NO || '';
        };

        if (!(order as any).VOIP_PROD_CD) {
          eqtNo = findEqtNo('05') || findEqtNo('01') || findEqtNo('03') ||
                  (prodGrpFromPromo === 'I' ? findEqtNo('02') : '') || findEqtNo('08') || '';
          etc1 = findEqtNo('04');
        } else {
          eqtNo = findEqtNo('08');
          etc1 = findEqtNo('02');
        }
        etc2 = findEqtNo('07');
        if (prodGrpFromPromo === 'C') etc3 = findEqtNo('02');
        if (prodGrpFromPromo === 'V') etc4 = findEqtNo('10');
        if (hasIspProd) etc4 = findEqtNo('21');

        // VoIP/ISP 결합계약 ID
        if (prodGrp === 'V' || hasIspProd) {
          voipJoinCtrtIdForSignal = voipJoinCtrtId || order.CTRT_ID || '';
        }

        // wrk_id 결정 - AP(091003/091004)→EQT_NO, OTT-STB(092201)→MAC_ADDRESS, else→WRK_ID
        let signalWrkId = order.id || '';
        for (const e of allEquips) {
          const a = e.actualEquipment || e;
          const eqtClCd = a.eqtClCd || a.EQT_CL_CD || '';
          if (eqtClCd === '091003' || eqtClCd === '091004') {
            signalWrkId = a.id || a.EQT_NO || order.id || '';
            break;
          }
          if (eqtClCd === '092201') {
            signalWrkId = a.macAddress || a.MAC_ADDRESS || a.id || a.EQT_NO || order.id || '';
            break;
          }
        }

        console.log('[CompleteSuspend] 일시철거복구 개통 신호:', { msgId, eqtNo, prodCd, subProdCd, etc1, etc2, etc3, etc4 });

        await sendSignal({
          MSG_ID: msgId,
          CUST_ID: order.customer?.id || order.CUST_ID || '',
          CTRT_ID: order.CTRT_ID || '',
          SO_ID: order.SO_ID || '',
          EQT_NO: eqtNo,
          EQT_PROD_CMPS_ID: eqtProdCmpsId,
          PROD_CD: prodCd,
          ITV_USR_ID: '',
          IP_CNT: '',
          ETC_1: etc1,
          ETC_2: etc2,
          ETC_3: etc3,
          ETC_4: etc4,
          SUB_PROD_CD: subProdCd,
          IF_DTL_ID: '',
          WRK_ID: signalWrkId,
          REG_UID: workerId,
          VOIP_JOIN_CTRT_ID: voipJoinCtrtIdForSignal,
          WTIME: '3',
        });
        console.log('[CompleteSuspend] 개통 신호 호출 완료');
      } catch (error) {
        console.log('[CompleteSuspend] 개통 신호 처리 중 오류 (무시하고 계속 진행):', error);
      }
    }
    };

    const completeData: WorkCompleteData = {
      workInfo: {
        WRK_ID: order.id,
        WRK_CD: order.WRK_CD,
        WRK_DTL_TCD: order.WRK_DTL_TCD,
        CUST_ID: order.customer?.id,
        CTRT_ID: order.CTRT_ID || '',
        RCPT_ID: order.RCPT_ID,
        CRR_ID: order.CRR_ID || user.crrId || '01',
        WRKR_ID: workerId,
        WRKR_CMPL_DT: formattedDate,
        MEMO: memo || '작업 완료',
        STTL_YN: 'Y',
        REG_UID: workerId,
        CUST_REL: custRel,
        CNFM_CUST_NM: order.customer?.name || '',
        CNFM_CUST_TELNO: order.customer?.contactNumber || '',
        INSTL_LOC: installLocationText || order.installLocation || '',
        PSN_USE_CORP: internetUse || '',
        VOIP_USE_CORP: voipUse || '',
        DTV_USE_CORP: dtvUse || '',
        WRK_ACT_CL: '20',
        NET_CL: installInfoData?.NET_CL || '',
        WRNG_TP: installInfoData?.WRNG_TP || '',
        INSTL_TP: installInfoData?.INSTL_TP || '',
        VOIP_JOIN_CTRT_ID: voipJoinCtrtId || '',
      },
      equipmentList: processEquipmentList(equipmentData?.installedEquipments || [], false),
      removeEquipmentList: processEquipmentList(equipmentData?.removedEquipments || [], true),
      spendItemList: equipmentData?.spendItems || [],
      agreementList: equipmentData?.agreements || [],
      poleList: equipmentData?.poleResults || []
    };

    submitWork(completeData, {
      onSuccess: (result) => {
        if (result.code === 'SUCCESS' || result.code === 'OK') {
          localStorage.removeItem(getStorageKey());
          (order as any).WRK_STAT_CD = '3';  // 완료 상태로 변경 (재완료 방지)
          sendInstallationSignal();
          showToast?.('작업이 성공적으로 완료되었습니다.', 'success');
          onSuccess();
        } else {
          showToast?.(result.message || '작업 완료 처리에 실패했습니다.', 'error', true);
        }
      },
      onError: (error: any) => {
        showToast?.(error.message || '작업 완료 중 오류가 발생했습니다.', 'error', true);
      },
    });
  };

  return (
    <div className="px-2 sm:px-4 py-4 sm:py-6 bg-gray-50 min-h-0 relative">
      {/* 전체 화면 로딩 오버레이 */}
      {isLoading && (
        <div className="fixed inset-0 bg-black/50 z-[9999] flex items-center justify-center">
          <div className="bg-white rounded-xl p-6 flex flex-col items-center gap-3 shadow-xl">
            <svg className="animate-spin h-10 w-10 text-blue-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            <span className="text-gray-700 font-medium">작업완료 처리중...</span>
          </div>
        </div>
      )}
      <div className="max-w-2xl mx-auto">
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-3 sm:p-5">
          <div className="space-y-3 sm:space-y-5">
            {/* 일시철거복구 안내 */}
            {isTempRemovalRecovery && (
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                <p className="text-sm text-yellow-800 font-medium">
                  일시철거복구 작업입니다. 장비 추가가 가능합니다.
                </p>
              </div>
            )}


            {/* 결합계약 */}
            {showJoinCtrt && (
              <div>
                <label className="block text-xs sm:text-sm font-semibold text-gray-900 mb-1.5">
                  결합계약 {!isWorkCompleted && <span className="text-red-500">*</span>}
                </label>
                <Select
                  value={voipJoinCtrtId}
                  onValueChange={setVoipJoinCtrtId}
                  options={joinCtrtOptions}
                  placeholder="결합계약 선택"
                  required
                  disabled={isWorkCompleted}
                />
              </div>
            )}

            {/* 망구분 + 철거정보 버튼 */}
            <div>
              <label className="block text-xs sm:text-sm font-semibold text-gray-900 mb-1.5">망구분</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={networkTypeName || ''}
                  readOnly disabled
                  placeholder="철거정보에서 입력"
                  className="flex-1 min-h-10 px-3 py-2 bg-gray-100 border border-gray-200 rounded-lg text-sm text-gray-600 cursor-not-allowed"
                />
                <button
                  type="button"
                  onClick={() => setShowInstallInfoModal(true)}
                  className={`px-4 py-2 text-sm font-semibold rounded-lg ${isWorkCompleted ? 'bg-gray-500 text-white' : 'bg-green-500 hover:bg-green-600 text-white'}`}
                >
                  {isWorkCompleted ? '보기' : '철거정보'}
                </button>
              </div>
            </div>

            {/* 고객관계 */}
            <div>
              <label className="block text-xs sm:text-sm font-semibold text-gray-900 mb-1.5">
                고객관계 {!isWorkCompleted && <span className="text-red-500">*</span>}
              </label>
              <Select value={custRel} onValueChange={setCustRel} options={custRelOptions}
                placeholder="고객관계 선택" required disabled={isWorkCompleted} />
            </div>

            {/* 설치위치 - 정지작업(04)에서는 숨김 */}
            {order.WRK_CD !== '04' && (
              <div>
                <label className="block text-xs sm:text-sm font-semibold text-gray-900 mb-1.5">
                  설치위치 {!isWorkCompleted && <span className="text-red-500">*</span>}
                </label>
                <div className="flex gap-2">
                  <div className="flex-1 flex items-center min-h-10 px-3 border border-gray-300 rounded-lg bg-gray-50 text-gray-700 text-sm">
                    <span className="truncate">{installLocationText || order.installLocation || '미설정'}</span>
                    {viewModNm && <span className="ml-2 text-xs text-gray-500 flex-shrink-0 whitespace-nowrap">(시청: {viewModNm})</span>}
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowInstallLocationModal(true)}
                    className={`min-h-10 px-4 py-2 rounded-lg font-bold text-sm whitespace-nowrap ${isWorkCompleted ? 'bg-gray-500 text-white' : 'bg-cyan-600 hover:bg-cyan-700 text-white'}`}
                  >
                    {isWorkCompleted ? '보기' : '설정'}
                  </button>
                </div>
              </div>
            )}

            {/* 처리내용 */}
            <div>
              <label className="block text-xs sm:text-sm font-semibold text-gray-900 mb-1.5 sm:mb-2">처리내용</label>
              <textarea
                value={memo}
                onChange={(e) => setMemo(e.target.value)}
                placeholder="작업 내용을 입력하세요..."
                maxLength={500}
                className={`w-full px-3 sm:px-4 py-2 sm:py-3 border border-gray-300 rounded-lg text-sm sm:text-base resize-none ${isWorkCompleted ? 'bg-gray-100 text-gray-600 cursor-not-allowed' : ''}`}
                rows={3}
                readOnly={isWorkCompleted}
                disabled={isWorkCompleted}
              />
              {!isWorkCompleted && (
                <p className={`text-xs text-right mt-1 ${memo.length >= 500 ? 'text-red-500' : 'text-gray-400'}`}>{memo.length}/500</p>
              )}
            </div>

            {/* 작업처리일 */}
            <div>
              <label className="block text-xs sm:text-sm font-semibold text-gray-700 mb-1.5 sm:mb-2">작업처리일 <span className="text-red-500">*</span></label>
              <input
                type="text"
                value={workCompleteDate}
                readOnly disabled
                className="w-full min-h-10 sm:min-h-12 px-3 sm:px-4 py-2 sm:py-3 bg-gray-50 border border-gray-300 rounded-lg text-sm sm:text-base text-gray-500 cursor-not-allowed"
              />
            </div>

            {/* 정지기간 인라인 */}
            <div className="bg-indigo-50 rounded-lg p-3 border border-indigo-200">
              <div className="text-sm font-semibold text-indigo-800 mb-2 flex items-center justify-between">
                <div className="flex items-center gap-1">
                  <Calendar size={16} />
                  이용정지기간
                </div>
                {!isWorkCompleted && susInfo && !susCanEdit && (
                  <button
                    type="button"
                    onClick={() => setSusCanEdit(true)}
                    className="px-2 py-0.5 bg-indigo-500 hover:bg-indigo-600 text-white rounded text-xs font-medium"
                  >
                    수정
                  </button>
                )}
              </div>
              {susLoading ? (
                <div className="flex items-center gap-2 text-sm text-gray-500">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-indigo-500"></div>
                  조회 중...
                </div>
              ) : susInfo ? (
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-sm">
                    <input
                      type="date"
                      value={formatDateForInput(susInfo.SUS_HOPE_DD)}
                      disabled
                      className="flex-1 px-2 py-1.5 border border-gray-300 rounded bg-gray-100 text-gray-600 text-sm"
                    />
                    <span className="text-gray-500">~</span>
                    {susCanEdit && !isWorkCompleted ? (
                      <input
                        type="date"
                        value={susNewEndDate}
                        onChange={handleSusEndDateChange}
                        min={formatDateForInput(susInfo.SUS_HOPE_DD)}
                        className="flex-1 px-2 py-1.5 border border-indigo-300 rounded bg-white text-gray-900 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      />
                    ) : (
                      <input
                        type="date"
                        value={susPendingSave ? susNewEndDate : formatDateForInput(susInfo.MMT_SUS_HOPE_DD)}
                        disabled
                        className={`flex-1 px-2 py-1.5 border rounded text-sm ${susPendingSave ? 'border-orange-300 bg-orange-50 text-orange-700' : 'border-gray-300 bg-gray-100 text-gray-600'}`}
                      />
                    )}
                  </div>
                  {susCanEdit && !isWorkCompleted && susNewEndDate && (
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-indigo-600">
                        정지일수: {calculateSusDays(susInfo.SUS_HOPE_DD, formatDateForApi(susNewEndDate))}일
                      </span>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            setSusCanEdit(false);
                            setSusPendingSave(false);
                            setSusNewEndDate(formatDateForInput(susInfo.MMT_SUS_HOPE_DD));
                            setSusError(null);
                          }}
                          className="px-3 py-1 bg-gray-400 hover:bg-gray-500 text-white rounded text-xs font-medium"
                        >
                          취소
                        </button>
                        <button
                          type="button"
                          onClick={handleSusSave}
                          disabled={!!susError}
                          className="px-3 py-1 bg-indigo-500 hover:bg-indigo-600 text-white rounded text-xs font-medium disabled:opacity-50"
                        >
                          확인
                        </button>
                      </div>
                    </div>
                  )}
                  {susPendingSave && !susCanEdit && !isWorkCompleted && (
                    <div className="flex items-center justify-between mt-1">
                      <span className="text-xs text-orange-600 font-medium">
                        ⏳ 임시저장됨 (작업완료 시 반영)
                      </span>
                      <button
                        type="button"
                        onClick={() => setSusCanEdit(true)}
                        className="px-2 py-0.5 bg-orange-500 hover:bg-orange-600 text-white rounded text-xs font-medium"
                      >
                        다시 수정
                      </button>
                    </div>
                  )}
                  {susError && (
                    <div className="flex items-center gap-1 text-xs text-red-600">
                      <AlertCircle size={12} />
                      {susError}
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-sm text-gray-500">정지기간 정보 없음</div>
              )}
            </div>

            {/* 하단 버튼 영역 */}
            <div className="flex gap-1.5 sm:gap-2 pt-3 sm:pt-4 mt-3 sm:mt-4 border-t border-gray-200">
              {/* 작업완료 버튼 */}
              {!isWorkCompleted && (
                <button
                  onClick={handleSubmit}
                  disabled={isLoading}
                  className={`flex-1 min-h-12 py-3 px-4 rounded-lg font-bold text-sm sm:text-base flex items-center justify-center gap-2 transition-colors ${
                    isLoading
                      ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                      : 'bg-blue-600 hover:bg-blue-700 text-white'
                  }`}
                >
                  {isLoading ? (
                    <>
                      <svg className="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      <span>처리 중...</span>
                    </>
                  ) : (
                    <>
                      <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                      <span>작업완료</span>
                    </>
                  )}
                </button>
              )}
              {/* 연동이력 버튼 */}
              <button
                type="button"
                onClick={() => setShowIntegrationHistoryModal(true)}
                className="flex-1 min-h-10 sm:min-h-12 px-3 sm:px-4 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-bold transition-colors flex items-center justify-center gap-1.5 sm:gap-2 text-sm sm:text-base"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
                <span>연동이력</span>
              </button>
            </div>

          </div>
        </div>
      </div>

      {/* 모달들 */}
      <InstallInfoModal
        isOpen={showInstallInfoModal}
        onClose={() => setShowInstallInfoModal(false)}
        onSave={handleInstallInfoSave}
        workId={order.id}
        initialData={installInfoData}
        workType={order.WRK_CD}
        customerId={order.customer?.id}
        customerName={order.customer?.name}
        contractId={order.CTRT_ID}
        addrOrd={(order as any).ADDR_ORD || ''}
        kpiProdGrpCd={equipmentData?.kpiProdGrpCd || equipmentData?.KPI_PROD_GRP_CD || order.KPI_PROD_GRP_CD}
        prodChgGb={equipmentData?.prodChgGb || equipmentData?.PROD_CHG_GB || (order as any).PROD_CHG_GB}
        chgKpiProdGrpCd={equipmentData?.chgKpiProdGrpCd || equipmentData?.CHG_KPI_PROD_GRP_CD || (order as any).CHG_KPI_PROD_GRP_CD}
        prodGrp={equipmentData?.prodGrp || equipmentData?.PROD_GRP || (order as any).PROD_GRP}
        wrkDtlTcd={order.WRK_DTL_TCD}
        readOnly={isWorkCompleted}
      />

      <IntegrationHistoryModal
        isOpen={showIntegrationHistoryModal}
        onClose={() => setShowIntegrationHistoryModal(false)}
        ctrtId={order.CTRT_ID}
        custId={order.customer?.id}
      />

      <InstallLocationModal
        isOpen={showInstallLocationModal}
        onClose={() => setShowInstallLocationModal(false)}
        onSave={(data: InstallLocationData) => {
          setInstallLocationText(data.INSTL_LOC);
          setViewModCd(data.VIEW_MOD_CD);
          setViewModNm(data.VIEW_MOD_NM);
          setShowInstallLocationModal(false);
        }}
        workId={order.id}
        ctrtId={order.CTRT_ID}
        prodGrp={equipmentData?.prodGrp || equipmentData?.PROD_GRP}
        initialInstlLoc={installLocationText || order.installLocation}
        initialViewModCd={viewModCd}
        initialViewModNm={viewModNm}
        showToast={showToast}
        readOnly={isWorkCompleted}
      />

      {/* 작업완료 확인 모달 */}
      <ConfirmModal
        isOpen={showConfirmModal}
        onClose={() => setShowConfirmModal(false)}
        onConfirm={handleConfirmSubmit}
        title="작업 완료"
        message="작업을 완료하시겠습니까?"
        type="confirm"
        confirmText="완료"
        cancelText="취소"
      >
        <WorkCompleteSummary
          equipmentData={equipmentData}
          installInfoData={installInfoData}
          custRel={custRel}
          custRelOptions={custRelOptions}
          memo={memo}
          installLocationText={installLocationText}
          order={order}
        />
      </ConfirmModal>
    </div>
  );
};

export default CompleteSuspend;
