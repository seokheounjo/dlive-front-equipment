import React, { useState, useEffect, useCallback } from 'react';
import { Calendar, AlertCircle } from 'lucide-react';
import { WorkOrder, WorkCompleteData } from '../../../../types';
import { getCommonCodeList, CommonCode, insertWorkRemoveStat, modAsPdaReceipt, getWorkReceiptDetail, sendSignal, getMoveWorkInfo, getLghvProdMap, getMmtSusInfo, modMmtSusInfo, getCommonCodes } from '../../../../services/apiService';
import { setCertifyCL06, getCertifyCL08, getCertifyProdMap } from '../../../../services/certifyApiService';
import Select from '../../../ui/Select';
import InstallInfoModal, { InstallInfoData } from '../../../modal/InstallInfoModal';
import IntegrationHistoryModal from '../../../modal/IntegrationHistoryModal';
import HotbillSection from '../HotbillSection';
import RemovalLineSection, { RemovalLineData } from '../RemovalLineSection';
import RemovalASAssignModal, { ASAssignData } from '../../../modal/RemovalASAssignModal';
import ConfirmModal from '../../../common/ConfirmModal';
import WorkCompleteSummary from '../WorkCompleteSummary';
import MoveWorkInfoModal from '../modals/MoveWorkInfoModal';
import { useWorkProcessStore } from '../../../../stores/workProcessStore';
import { useCertifyStore } from '../../../../stores/certifyStore';
import { useWorkEquipment, useWorkEquipmentStore } from '../../../../stores/workEquipmentStore';
import { useCompleteWork } from '../../../../hooks/mutations/useCompleteWork';
import { isFtthProduct } from '../../../../utils/workValidation';
import '../../../../styles/buttons.css';

/**
 * CompleteRelocateTerminate - 이전철거(WRK_CD=08) 작업완료 컴포넌트
 *
 * 레거시 참조: mowoa03m08.xml - 작업완료(이전철거)
 *
 * 특징:
 * - NET_CL(망구분), INSTL_TP(설치유형) 필수 입력
 * - 장비등록/변경 버튼 숨김 (3단계에서 회수만 가능)
 * - 설치위치 입력 필드 없음
 * - 상향제어, 인터넷/VoIP/디지털 이용구분 없음
 * - 연동이력 버튼만 표시
 * - 작업완료 후 인입선로 철거관리 모달 표시 (조건부)
 * - LGU+ 정보 처리 (fn_uplus_cust_info)
 * - 재사용 체크 (chk_reuse_yn)
 */
interface CompleteRelocateTerminateProps {
  order: WorkOrder;
  onBack: () => void;
  onSuccess: () => void;
  showToast?: (message: string, type: 'success' | 'error' | 'warning' | 'info') => void;
  equipmentData?: any;
  readOnly?: boolean;
  certifyMode?: boolean;    // LGU+ certify: forces certify path regardless of isFtthProduct
}

const CompleteRelocateTerminate: React.FC<CompleteRelocateTerminateProps> = ({
  order,
  onBack,
  onSuccess,
  showToast,
  equipmentData: legacyEquipmentData,
  readOnly = false,
  certifyMode = false,
}) => {
  // 완료/취소된 작업 여부 확인
  const isWorkCompleted = readOnly
    || order.WRK_STAT_CD === '3'
    || order.WRK_STAT_CD === '4'
    || order.WRK_STAT_CD === '7'
    || order.status === '완료'
    || order.status === '취소';

  const [isDataLoaded, setIsDataLoaded] = useState(false);

  // Zustand Store
  const { equipmentData: storeEquipmentData, filteringData, removalLineData: storeRemovalLineData, setRemovalLineData: setStoreRemovalLineData } = useWorkProcessStore();
  const { certifyRegconfInfo } = useCertifyStore();

  // Zustand Equipment Store - 장비 컴포넌트에서 등록한 장비 정보
  const workId = order.id || '';
  const zustandEquipment = useWorkEquipment(workId);

  // 장비정보 단계에서 설정한 재사용 여부 (store에서 가져옴)
  const storeReuseAll = useWorkEquipmentStore(
    (store) => store.workStates[workId]?.reuseAll ?? false
  );
  const setReuseAllAction = useWorkEquipmentStore((store) => store.setReuseAll);

  // equipmentData 병합: Zustand Equipment Store 우선 사용
  // 이전철거 작업(WRK_CD=08)은 removeEquipments(API output5)를 사용 (markedForRemoval은 AS/상품변경용)
  const equipmentData = {
    ...(storeEquipmentData || legacyEquipmentData || filteringData || {}),
    installedEquipments: zustandEquipment.installedEquipments.length > 0
      ? zustandEquipment.installedEquipments
      : (storeEquipmentData?.installedEquipments || legacyEquipmentData?.installedEquipments || []),
    // 이전철거: zustandEquipment.removeEquipments (API output5) 우선 사용
    removedEquipments: zustandEquipment.removeEquipments.length > 0
      ? zustandEquipment.removeEquipments
      : (storeEquipmentData?.removedEquipments || legacyEquipmentData?.removedEquipments || []),
    removalStatus: Object.keys(zustandEquipment.removalStatus).length > 0
      ? zustandEquipment.removalStatus
      : (storeEquipmentData?.removalStatus || legacyEquipmentData?.removalStatus || {}),
  };

  // React Query Mutation
  const { mutate: submitWork, isPending: isLoading } = useCompleteWork();

  // localStorage 키
  const getStorageKey = () => `work_complete_draft_${order.id}`;

  // 기본 정보 State
  const [custRel, setCustRel] = useState('');
  const [memo, setMemo] = useState('');

  // 고객명/연락처 편집 가능 (레거시: edt_cust_nm, edt_cust_telno)
  const [cnfmCustNm, setCnfmCustNm] = useState('');
  const [cnfmCustTelno, setCnfmCustTelno] = useState('');

  // 설치(철거)정보 모달
  const [showInstallInfoModal, setShowInstallInfoModal] = useState(false);
  const [networkType, setNetworkType] = useState('');
  const [networkTypeName, setNetworkTypeName] = useState('');
  const [installInfoData, setInstallInfoData] = useState<InstallInfoData | undefined>(undefined);

  // 연동이력 모달
  const [showIntegrationHistoryModal, setShowIntegrationHistoryModal] = useState(false);

  // 인입선로 철거관리 데이터 (store에서 관리 - 스텝 이동해도 유지)
  const removalLineData = storeRemovalLineData as RemovalLineData | null;
  const setRemovalLineData = setStoreRemovalLineData;

  // AS할당 모달
  const [showASAssignModal, setShowASAssignModal] = useState(false);
  const [isASProcessing, setIsASProcessing] = useState(false);

  // 이전설치정보 모달 (레거시 btn_move_info - "이전설치정보")
  const [showMoveWorkInfoModal, setShowMoveWorkInfoModal] = useState(false);
  const [moveWorkInfoData, setMoveWorkInfoData] = useState<any>(null);

  // 신호 전송 결과 (레거시: IFSVC_CHK, IFSVC_SEND_YN)
  const [signalSent, setSignalSent] = useState(false);
  const [signalResult, setSignalResult] = useState<{ success: boolean; message: string } | null>(null);

  // 작업완료 확인 모달
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [confirmMessage, setConfirmMessage] = useState('');

  // 단말인증 관련 (레거시: fn_certify_cl06, fn_certify_cl08)
  const [showCertifyButtons, setShowCertifyButtons] = useState(false);
  const [certifyProcessing, setCertifyProcessing] = useState(false);
  const [certifyStatus, setCertifyStatus] = useState<'none' | 'success' | 'error'>('none');
  const [certifyMessage, setCertifyMessage] = useState('');
  // LGHV STB 상품 여부 (레거시: bLghvStb)
  const [isLghvStb, setIsLghvStb] = useState(false);
  // LGHV 상품맵 리스트 (레거시: ds_upls_prod) - L→L 전환 체크용
  const [lghvProdList, setLghvProdList] = useState<any[]>([]);
  // 단말인증 상품 목록 (CL-06에서 참조)
  const [certifyProdListState, setCertifyProdListState] = useState<any[]>([]);

  // 공통코드 옵션
  const [custRelOptions, setCustRelOptions] = useState<{ value: string; label: string }[]>([]);

  // 정지기간 상태 (레거시: mowoDivE02.xml btn_mmt_sus_dd - WRK_CD=02,04,08,09)
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
  const [susPendingSave, setSusPendingSave] = useState(false);

  // 작업처리일
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

  // 데이터 복원
  useEffect(() => {
    // 고객명/연락처 초기값 설정
    setCnfmCustNm(order.customer?.name || '');
    setCnfmCustTelno(order.customer?.contactNumber || order.REQ_CUST_TEL_NO || '');

    // 전체재사용 조건은 loadInitialData의 getMoveWorkInfo 응답에서 확인
    // 조건 불충족 시 reuseAll 강제 false (안전장치)

    if (isWorkCompleted) {
      console.log('[WorkCompleteRemovalTerminate] 완료된 작업 - getWorkReceiptDetail API 호출');

      const fetchCompletedWorkDetail = async () => {
        try {
          const detail = await getWorkReceiptDetail({
            WRK_DRCTN_ID: order.directionId || order.WRK_DRCTN_ID || '',
            WRK_ID: order.id,  // order.id가 실제 WRK_ID
            SO_ID: order.SO_ID
          });

          if (detail) {
            console.log('[WorkCompleteRemovalTerminate] API 응답:', detail);
            setCustRel(detail.CUST_REL || '');
            setMemo((detail.WRK_PROC_CT || '').replace(/\\n/g, '\n'));
            setNetworkType(detail.NET_CL || '');
            setNetworkTypeName(detail.NET_CL_NM || '');

            setInstallInfoData({
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

            setMemo((detail.WRK_PROC_CT || '').replace(/\\n/g, '\n'));

            // 작업처리일 복원
            if (detail.WRKR_CMPL_DT && detail.WRKR_CMPL_DT.length >= 8) {
              setWorkCompleteDate(`${detail.WRKR_CMPL_DT.slice(0,4)}-${detail.WRKR_CMPL_DT.slice(4,6)}-${detail.WRKR_CMPL_DT.slice(6,8)}`);
            }
          } else {
            // API 실패 시 order에서 복원 시도 (fallback)
            console.log('[WorkCompleteRemovalTerminate] API 실패 - order에서 복원 시도');
            setCustRel(order.CUST_REL || '');
            setNetworkType(order.NET_CL || '');
            setNetworkTypeName(order.NET_CL_NM || '');
          }
        } catch (error) {
          console.error('[WorkCompleteRemovalTerminate] API 호출 실패:', error);
          setCustRel(order.CUST_REL || '');
          setNetworkType(order.NET_CL || '');
          setNetworkTypeName(order.NET_CL_NM || '');
        } finally {
          setIsDataLoaded(true);
        }
      };

      fetchCompletedWorkDetail();
      return;
    }

    // localStorage에서 복원
    const savedDraft = localStorage.getItem(getStorageKey());
    if (savedDraft) {
      try {
        const draftData = JSON.parse(savedDraft);
        setCustRel(draftData.custRel || '');
        setMemo(draftData.memo || '');
        setNetworkType(draftData.networkType || '');
        setNetworkTypeName(draftData.networkTypeName || '');
        setInstallInfoData(draftData.installInfoData);
        // 고객명/연락처 복원
        if (draftData.cnfmCustNm) setCnfmCustNm(draftData.cnfmCustNm);
        if (draftData.cnfmCustTelno) setCnfmCustTelno(draftData.cnfmCustTelno);
      } catch (error) {
        console.error('[WorkCompleteRemovalTerminate] localStorage 복원 실패:', error);
      }
    }
    setIsDataLoaded(true);
  }, [order.id, isWorkCompleted]);

  // 자동 저장
  useEffect(() => {
    if (!isDataLoaded || isWorkCompleted) return;

    const draftData = {
      custRel, memo,
      networkType, networkTypeName,
      installInfoData,
      cnfmCustNm, cnfmCustTelno,
      savedAt: new Date().toISOString()
    };

    localStorage.setItem(getStorageKey(), JSON.stringify(draftData));
  }, [custRel, memo, networkType, networkTypeName, installInfoData, cnfmCustNm, cnfmCustTelno, isDataLoaded, isWorkCompleted]);

  // 공통코드 로드 및 단말인증/LGHV 체크
  useEffect(() => {
    const loadInitialData = async () => {
      try {
        const codes = await getCommonCodeList(['CMCU005']);

        if (codes['CMCU005']) {
          setCustRelOptions(codes['CMCU005'].map((code: CommonCode) => ({
            value: code.COMMON_CD, label: code.COMMON_CD_NM
          })));
        }

        // 이전설치정보 조회 (레거시: fn_getMoveWorkInfo) - MVM_TP 가져오기
        try {
          const moveInfo = await getMoveWorkInfo({
            RCPT_ID: order.RCPT_ID || '',
            CTRT_ID: order.CTRT_ID || '',
            CRR_ID: order.CRR_ID || '',
            WRKR_ID: (order as any).WRKR_ID || '',
            PROD_CD: order.PROD_CD || '',
            CRR_TSK_CL: '02',
            WRK_ID: order.id || '',
            ADDR_ORD: (order as any).ADDR_ORD || order.customer?.ADDR_ORD || '',
            WRK_CD: order.WRK_CD || '08',
            WRK_STAT_CD: order.WRK_STAT_CD || '',
          });
          console.log('[CompleteRelocateTerminate] 이전설치정보:', moveInfo);
          setMoveWorkInfoData(moveInfo);

          // 전체재사용 조건 확인 (레거시: mowoa03m08.xml 592-601)
          // WRK_STAT_CD='2' && CTRT_ID != OLD_CTRT_ID
          const mvmTp = moveInfo?.MVM_TP || '';
          const moveWrkStatCd = moveInfo?.WRK_STAT_CD || '';
          const moveCtrtId = moveInfo?.CTRT_ID || '';
          const moveOldCtrtId = moveInfo?.OLD_CTRT_ID || '';
          const shouldReuse = moveWrkStatCd === '2';
          console.log('[CompleteRelocateTerminate] 전체재사용 조건:', {
            MVM_TP: mvmTp, WRK_STAT_CD: moveWrkStatCd,
            CTRT_ID: moveCtrtId, OLD_CTRT_ID: moveOldCtrtId, shouldReuse,
          });
          // 조건 불충족인데 reuseAll이 true면 강제 해제 (안전장치)
          if (!shouldReuse && storeReuseAll) {
            setReuseAllAction(workId, false);
          }
        } catch (moveErr) {
          console.error('[CompleteRelocateTerminate] 이전설치정보 조회 실패:', moveErr);
        }

        // LGHV 상품맵 조회 (레거시: fn_getLghvProdMap)
        const lghvList = await getLghvProdMap();
        if (lghvList && lghvList.length > 0) {
          // 상품맵 저장 (L→L 전환 체크용)
          setLghvProdList(lghvList);
          // 현재 상품이 LGHV STB인지 확인
          const prodCd = order.PROD_CD || (order as any).BASIC_PROD_CD || '';
          const isLghv = lghvList.some(item => item.PROD_CD === prodCd);
          setIsLghvStb(isLghv);
          console.log('[WorkCompleteRemovalTerminate] LGHV STB 체크:', { prodCd, isLghv, lghvListCount: lghvList.length });
        }

        // 단말인증 버튼 표시 조건 (레거시: mowoa03m08.xml 391~395)
        // CERTIFY_TG='Y' 이고, 인증 대상 SO/상품인 경우
        const certifyTg = (order as any).CERTIFY_TG || '';
        if (certifyTg === 'Y') {
          // 단말인증 상품맵 조회
          const certifyProdList = await getCertifyProdMap();
          setCertifyProdListState(certifyProdList);
          const newProdCd = (order as any).NEW_PROD_CD || order.PROD_CD || '';
          const soId = order.SO_ID || '';

          // 단말인증 대상 여부 확인
          const isCertifyProd = certifyProdList.some(item => item.PROD_CD === newProdCd);
          console.log('[WorkCompleteRemovalTerminate] 단말인증 체크:', { certifyTg, newProdCd, soId, isCertifyProd });

          // 레거시: nNewPrdRow < 0 이거나 SO_ID가 인증 SO가 아닌 경우 버튼 표시
          if (!isCertifyProd) {
            setShowCertifyButtons(true);
          }
        }
      } catch (error) {
        console.error('[WorkCompleteRemovalTerminate] 초기 데이터 로드 실패:', error);
      }
    };

    loadInitialData();
  }, [order]);

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

  // 정지기간 정보 조회 (레거시: getMmtSusInfo)
  const fetchSuspensionInfo = useCallback(async () => {
    const rcptId = order.RCPT_ID || '';
    const ctrtId = order.CTRT_ID || '';
    if (!rcptId || !ctrtId) return;

    setSusLoading(true);
    setSusError(null);

    try {
      const info = await getMmtSusInfo({ RCPT_ID: rcptId, CTRT_ID: ctrtId });
      console.log('[CompleteRemovalTerminate] 정지기간 조회 결과:', info);

      if (info) {
        setSusInfo(info);
        setSusNewEndDate(formatDateForInput(info.MMT_SUS_HOPE_DD));

        const today = getTodayString();
        if (info.WRK_DTL_TCD === '0430' && info.MMT_SUS_HOPE_DD <= today) {
          setSusCanEdit(true);
          showToast?.('이용정지기간 종료일이 경과되었습니다. 이용정지기간을 다시 설정하십시오.', 'warning');
        } else {
          setSusCanEdit(false);
        }
      }
    } catch (err: any) {
      console.error('[CompleteRemovalTerminate] 정지기간 조회 실패:', err);
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

  // 검증 - 철거해지는 NET_CL, INSTL_TP 필수 (레거시 동일)
  const validate = (): string[] => {
    const errors: string[] = [];
    if (!custRel || custRel === '[]') {
      errors.push('고객과의 관계를 선택해주세요.');
    }
    // 철거해지 필수 검증: 망구분, 배선방식, 설치유형
    if (!installInfoData?.NET_CL) {
      errors.push('철거정보에서 망구분을 선택해주세요.');
    }
    if (!installInfoData?.WRNG_TP) {
      errors.push('철거정보에서 배선방식을 선택해주세요.');
    }
    if (!installInfoData?.INSTL_TP) {
      errors.push('철거정보에서 설치유형을 선택해주세요.');
    } else if (installInfoData.INSTL_TP !== '77') {
      // 레거시 mowoa03m08.xml:816 - 이전철거는 설치유형 '77'(철거) 필수
      errors.push('이전철거 작업은 설치유형이 "철거(77)"이어야 합니다.');
    }
    if (!workCompleteDate) {
      errors.push('작업처리일을 선택해주세요.');
    }

    // 레거시: 철거장비 없어도 작업완료 가능 (신호전송만 skip)

    // 인입선로 철거관리 필수 체크
    if (needsRemovalLineManagement() && !removalLineData) {
      errors.push('인입선로 철거관리를 먼저 완료해주세요.');
    }

    return errors;
  };

  // 철거정보 모달 핸들러
  const handleInstallInfoSave = (data: InstallInfoData) => {
    setInstallInfoData(data);
    if (data.NET_CL) setNetworkType(data.NET_CL);
    if (data.NET_CL_NM) setNetworkTypeName(data.NET_CL_NM);
    showToast?.('철거 정보가 저장되었습니다.', 'success');
  };

  // 이전설치정보 조회 (레거시: fn_getMoveWorkInfo)
  const fetchMoveWorkInfo = async () => {
    try {
      const result = await getMoveWorkInfo({
        RCPT_ID: order.RCPT_ID || '',
        CTRT_ID: order.CTRT_ID || '',
        CRR_ID: order.CRR_ID || '',
        WRKR_ID: (order as any).WRKR_ID || '',
        PROD_CD: order.PROD_CD || '',
        CRR_TSK_CL: '02',  // 이전철거(08)도 철거는 02 (레거시 라인 378-380)
        WRK_ID: order.id || '',
        ADDR_ORD: (order as any).ADDR_ORD || order.customer?.ADDR_ORD || '',
        WRK_CD: order.WRK_CD || '08',
        WRK_STAT_CD: order.WRK_STAT_CD || '',
      });
      setMoveWorkInfoData(result);
      setShowMoveWorkInfoModal(true);
    } catch (error: any) {
      console.error('[이전설치정보 조회 실패]:', error);
      showToast?.(error.message || '이전설치정보 조회에 실패했습니다.', 'error', true);
    }
  };

  /**
   * 단말인증 CL-06 처리 (레거시: fn_certify_cl06)
   * 작업완료 전 단말인증 처리
   */
  const handleCertifyCL06 = async () => {
    setCertifyProcessing(true);
    setCertifyMessage('');
    setCertifyStatus('none');

    try {
      const userInfo = localStorage.getItem('userInfo');
      const user = userInfo ? JSON.parse(userInfo) : {};

      const result = await setCertifyCL06({
        CTRT_ID: order.CTRT_ID || '',
        CUST_ID: order.customer?.id || order.CUST_ID || '',
        SO_ID: order.SO_ID || '',
        REG_UID: user.userId || '',
        WRK_ID: order.id || '',
      });

      if (result?.ERROR) {
        setCertifyStatus('error');
        setCertifyMessage(result.ERROR);
        showToast?.(`단말인증 실패: ${result.ERROR}`, 'error');
      } else {
        setCertifyStatus('success');
        setCertifyMessage('단말인증이 완료되었습니다.');
        showToast?.('단말인증이 완료되었습니다.', 'success');
      }
    } catch (error: any) {
      console.error('[단말인증 CL-06 실패]:', error);
      setCertifyStatus('error');
      setCertifyMessage(error.message || '단말인증 처리 중 오류가 발생했습니다.');
      showToast?.(error.message || '단말인증 처리 중 오류가 발생했습니다.', 'error', true);
    } finally {
      setCertifyProcessing(false);
    }
  };

  /**
   * 단말상태조회 CL-08 (레거시: fn_certify_cl08)
   * 현재 단말 인증 상태 조회
   */
  const handleCertifyCL08 = async () => {
    setCertifyProcessing(true);
    setCertifyMessage('');

    try {
      const userInfo = localStorage.getItem('userInfo');
      const user = userInfo ? JSON.parse(userInfo) : {};

      const rawResult = await getCertifyCL08({
        CTRT_ID: order.CTRT_ID || '',
        CUST_ID: order.customer?.id || order.CUST_ID || '',
        SO_ID: order.SO_ID || '',
        REG_UID: user.userId || '',
        WRK_ID: order.id || '',
      });
      // CL-08 응답이 배열일 수 있음
      const result = Array.isArray(rawResult) ? rawResult[0] : rawResult;

      if (result?.ERROR) {
        setCertifyStatus('error');
        setCertifyMessage(`상태조회 결과: ${result.ERROR}`);
        showToast?.(`상태조회 결과: ${result.ERROR}`, 'warning');
      } else {
        const statusMsg = result?.RESULT || result?.MSG || JSON.stringify(result);
        setCertifyMessage(`상태조회 결과: ${statusMsg}`);
        showToast?.(`상태조회 완료`, 'info');
      }
    } catch (error: any) {
      console.error('[단말상태조회 CL-08 실패]:', error);
      setCertifyMessage(error.message || '상태조회 중 오류가 발생했습니다.');
      showToast?.(error.message || '상태조회 중 오류가 발생했습니다.', 'error', true);
    } finally {
      setCertifyProcessing(false);
    }
  };

  /**
   * 철거 신호 전송 (레거시: fn_signal_trans - mowoa03m08.xml)
   * - 일반 장비: SMR05 전송
   * - LGHV_STB 상품: STB_DEL 전송
   * - LGHV L→L 전환 시 신호 스킵 (동일 계약)
   */
  const sendRemovalSignal = async (): Promise<boolean> => {
    const removedEquipments = equipmentData?.removedEquipments || [];

    // 레거시 m08: 철거장비 없어도 고객장비/ISP상품 있으면 신호 전송
    // (caller에서 이미 조건 체크하므로 여기서는 skip하지 않음)

    // 계약 상태가 '20'이면 신호 전송 불필요 (레거시 동일)
    const ctrtStat = (order as any).CTRT_STAT || '';
    if (ctrtStat === '20') {
      console.log('[신호전송] 계약상태 20 - 스킵');
      return true;
    }

    try {
      const userInfo = localStorage.getItem('userInfo');
      const user = userInfo ? JSON.parse(userInfo) : {};
      const workerId = user.userId || 'A20130708';

      let msgId = 'SMR05';
      let etc1 = '';

      // LGHV_STB 상품인 경우 (레거시: bLghvStb)
      if (isLghvStb) {
        // 이전설치정보에서 NEW_PROD_CD, OLD_PROD_CD 확인 (레거시: ds_move_info)
        const newProdCd = moveWorkInfoData?.NEW_PROD_CD || '';
        const oldProdCd = moveWorkInfoData?.OLD_PROD_CD || '';
        const ctrtId = moveWorkInfoData?.CTRT_ID || order.CTRT_ID || '';
        const oldCtrtId = moveWorkInfoData?.OLD_CTRT_ID || '';

        // NEW_PROD_CD와 OLD_PROD_CD 모두 LGHV 상품맵에 있는지 확인
        const newProdInLghv = lghvProdList.some(item => item.PROD_CD === newProdCd);
        const oldProdInLghv = lghvProdList.some(item => item.PROD_CD === oldProdCd);

        // L → L 전환이고 동일 계약인 경우 신호 전송 스킵 (레거시 line 717-721)
        if (newProdInLghv && oldProdInLghv) {
          if (ctrtId === oldCtrtId) {
            console.log('[신호전송] LGHV L→L 동일계약 - 신호 전송 스킵');
            setSignalSent(true);
            return true;
          }
        } else {
          // L → 비L 전환인 경우 STB 장비번호 추출 (레거시 line 724-726)
          const stbEquipment = removedEquipments.find(
            (eq: any) => (eq.ITEM_MID_CD || eq.itemMidCd || eq.actualEquipment?.ITEM_MID_CD || eq.actualEquipment?.itemMidCd) === '04'
          );
          if (stbEquipment) {
            etc1 = stbEquipment.EQT_NO || stbEquipment.id || stbEquipment.actualEquipment?.EQT_NO || stbEquipment.actualEquipment?.id || '';
          }
        }

        msgId = 'STB_DEL';
      }

      // 사전 체크: 철거 장비의 CTRT_ID와 작업의 DTL_CTRT_ID 일치 여부 (레거시 line 742-745)
      const dtlCtrtId = (order as any).DTL_CTRT_ID || order.CTRT_ID || '';
      const hasMatchingEquipment = removedEquipments.some(
        (eq: any) => eq.CTRT_ID === dtlCtrtId || eq.actualEquipment?.CTRT_ID === dtlCtrtId
      );
      if (removedEquipments.length > 0 && !hasMatchingEquipment) {
        console.warn('[신호전송] 장비 데이터 불일치 - 작업 재검색 필요');
        showToast?.('작업을 재검색후 완료처리 하시기 바랍니다.', 'warning');
        // 경고만 표시하고 계속 진행 (레거시에서는 return false지만, 유연하게 처리)
      }

      // EQT_PROD_CMPS_ID 조회 (레거시: ds_rmv_prod_info에서 PROD_CMPS_CL='23' 찾기)
      // 상품 정보의 PROD_CMPS_ID 우선, 없으면 장비 정보의 EQT_PROD_CMPS_ID 사용
      const broadcastEquip = removedEquipments.find(
        (eq: any) => eq.PROD_CMPS_CL === '23' || eq.actualEquipment?.PROD_CMPS_CL === '23'
      );
      const eqtProdCmpsId = broadcastEquip?.PROD_CMPS_ID
        || broadcastEquip?.actualEquipment?.PROD_CMPS_ID
        || broadcastEquip?.EQT_PROD_CMPS_ID
        || broadcastEquip?.actualEquipment?.EQT_PROD_CMPS_ID
        || '';

      // VoIP 단독 상품인 경우 VOIP_JOIN_CTRT_ID 설정 (레거시 line 747-749)
      const voipProdCd = (order as any).VOIP_PROD_CD || '';
      const voipJoinCtrtId = voipProdCd ? (order.CTRT_ID || '') : '';

      console.log(`[신호전송] ${msgId} 전송 시작`, {
        isLghvStb,
        eqtProdCmpsId,
        etc1,
        voipJoinCtrtId,
      });

      // 신호 전송 (레거시: fn_cm_shncEqt_Signal_VOIP)
      // 레거시: eqt_no="", prod_cd="", etc_2~4 모두 빈값
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
        ETC_2: '',
        ETC_3: '',
        ETC_4: '',
        VOIP_JOIN_CTRT_ID: voipJoinCtrtId,
        WTIME: '3',
      });

      // 결과 판정 (레거시 line 760: TRUE + 000000)
      if (result.code === 'SUCCESS' || result.code === 'OK' ||
          (result.message && result.message.indexOf('TRUE') > -1 && result.message.indexOf('000000') > -1)) {
        console.log('[신호전송] 성공:', result);
        setSignalSent(true);
        setSignalResult({ success: true, message: '신호 전송 성공' });
        return true;
      } else {
        console.warn('[신호전송] 실패:', result);
        setSignalResult({ success: false, message: result.message || '신호 전송 실패' });
        return false;
      }
    } catch (error: any) {
      console.error('[신호전송] 오류:', error);
      setSignalResult({ success: false, message: error.message || '신호 전송 오류' });
      return false;
    }
  };

  // 인입선로 철거관리 필요 여부 체크 (레거시: mowoa03m02 동일 조건)
  // KPI_PROD_GRP_CD in (C, D, I) AND VOIP_CTX != 'T' AND != 'R'
  const needsRemovalLineManagement = () => {
    const kpiProdGrpCd = (order as any).KPI_PROD_GRP_CD || '';
    const voipCtx = (order as any).VOIP_CTX || '';
    return ['C', 'D', 'I'].includes(kpiProdGrpCd)
      && voipCtx !== 'T'
      && voipCtx !== 'R';
  };

  // 인입선로 철거관리 - 완료(완전철거) 핸들러 (임시저장 - 작업완료 시 API 호출)
  const handleRemovalLineComplete = (data: RemovalLineData) => {
    console.log('[WorkCompleteRemovalTerminate] 인입선로 철거관리 완료(완전철거) 임시저장:', data);
    setRemovalLineData(data);
    showToast?.('인입선로 철거관리가 임시저장되었습니다. 작업완료 시 반영됩니다.', 'info');
  };

  // 인입선로 미철거 - AS할당 핸들러
  const handleRemovalLineAssignAS = (data: RemovalLineData) => {
    console.log('[WorkCompleteRemovalTerminate] 인입선로 미철거 - AS할당 모달 열기:', data);
    setRemovalLineData(data);
    setShowASAssignModal(true);
  };

  // AS할당 모달 저장 핸들러
  const handleASAssignSave = async (data: ASAssignData) => {
    console.log('[WorkCompleteRemovalTerminate] AS할당 저장:', data);
    setIsASProcessing(true);

    try {
      const userInfo = localStorage.getItem('userInfo');
      const user = userInfo ? JSON.parse(userInfo) : {};
      const workerId = user.userId || 'A20130708';

      // 1. insertWorkRemoveStat 호출
      const removeStatResult = await insertWorkRemoveStat({
        WRK_ID: order.id,
        REMOVE_LINE_TP: data.REMOVE_LINE_TP,
        REMOVE_GB: data.REMOVE_GB,
        REMOVE_STAT: data.REMOVE_STAT || '',
        REG_UID: workerId,
      });

      if (removeStatResult.code !== 'SUCCESS' && removeStatResult.code !== 'OK') {
        throw new Error(removeStatResult.message || '인입선로 철거상태 저장에 실패했습니다.');
      }

      // 2. modAsPdaReceipt 호출
      const asResult = await modAsPdaReceipt({
        CUST_ID: data.CUST_ID,
        RCPT_ID: data.RCPT_ID || '',
        WRK_DTL_TCD: data.WRK_DTL_TCD,
        WRK_RCPT_CL: data.WRK_RCPT_CL,
        WRK_RCPT_CL_DTL: data.WRK_RCPT_CL_DTL,
        WRK_HOPE_DTTM: data.WRK_HOPE_DTTM,
        MEMO: data.MEMO || '',
        EMRG_YN: data.EMRG_YN || 'N',
        HOLY_YN: data.HOLY_YN || 'N',
        CRR_ID: data.CRR_ID || '01',
        WRKR_ID: data.WRKR_ID || workerId,
        REG_UID: data.REG_UID || workerId,
      });

      if (asResult.code === 'SUCCESS' || asResult.code === 'OK') {
        setShowASAssignModal(false);
        showToast?.('AS가 할당되었습니다. 작업완료를 계속 진행해주세요.', 'success');
      } else {
        throw new Error(asResult.message || 'AS할당에 실패했습니다.');
      }
    } catch (error: any) {
      showToast?.(error.message || 'AS할당 중 오류가 발생했습니다.', 'error', true);
    } finally {
      setIsASProcessing(false);
    }
  };

  // 작업 완료 확인 모달 열기
  const handleSubmit = () => {
    if (isLoading) return;

    // 방송상품 작업완료 불가 체크 (레거시: mowoa03m08 743-744)
    // 회수 장비 중 PROD_CMPS_CL='23'(방송) 있으면 불가
    const removedEquipments = equipmentData?.removedEquipments || [];
    const hasBroadcastEquipment = removedEquipments.some((eq: any) =>
      eq.PROD_CMPS_CL === '23' || eq.actualEquipment?.PROD_CMPS_CL === '23'
    );
    if (hasBroadcastEquipment) {
      showToast?.('철거 대상의 상품을 완료 처리할 수 없습니다. 작업을 확인하세요.', 'error');
      return;
    }

    const errors = validate();
    if (errors.length > 0) {
      errors.forEach(error => showToast?.(error, 'error'));
      // 인입선로 미완료 에러 시 해당 섹션으로 스크롤
      if (errors.some(e => e.includes('인입선로'))) {
        const section = document.getElementById('removal-line-section');
        if (section) {
          section.scrollIntoView({ behavior: 'smooth', block: 'center' });
          section.classList.add('ring-2', 'ring-red-500', 'ring-offset-2');
          setTimeout(() => {
            section.classList.remove('ring-2', 'ring-red-500', 'ring-offset-2');
          }, 2000);
        }
      }
      return;
    }

    // 해지희망일 이전 작업완료 경고
    const hopeDt = (order as any).TERM_HOPE_DT || (order as any).HOPE_DT || '';
    if (hopeDt && workCompleteDate) {
      const hopeDateStr = hopeDt.replace(/-/g, '');
      const completeDateStr = workCompleteDate.replace(/-/g, '');
      if (completeDateStr < hopeDateStr) {
        showToast?.('해지희망일 이전에 작업완료입니다.', 'warning');
      }
    }

    setConfirmMessage('작업을 완료하시겠습니까?');
    setShowConfirmModal(true);
  };

  // 작업 완료 실제 처리 (레거시 mowoa03m08: fn_save)
  const handleConfirmSubmit = async () => {
    console.log('[WorkCompleteRemovalTerminate] 작업완료 처리 시작');

    const userInfo = localStorage.getItem('userInfo');
    const user = userInfo ? JSON.parse(userInfo) : {};
    const workerId = user.userId || 'A20130708';

    // FTTH CL-06 서비스 해지 (레거시: mowoa03m08.xml lines 482-491)
    // CERTIFY_TG 판별: FTTH 상품(IS_CERTIFY_PROD==1 또는 OP_LNKD_CD=F/FG/Z/ZG) 이고 CL-08로 계약 인증 확인
    let certifyTg = 'N';
    const isFtth = certifyMode || isFtthProduct((order as any).OP_LNKD_CD);
    console.log('[CompleteRelocateTerminate] FTTH 판별:', { IS_CERTIFY_PROD: (order as any).IS_CERTIFY_PROD, OP_LNKD_CD: (order as any).OP_LNKD_CD, isFtth });
    if (isFtth) {
      try {
        const ctrtId = order.CTRT_ID || '';
        const cl08Raw = await getCertifyCL08({
          CTRT_ID: ctrtId,
          CUST_ID: order.customer?.id || (order as any).CUST_ID || '',
          SO_ID: order.SO_ID || '',
          REG_UID: workerId,
          WRK_ID: order.id || '',
        });
        // CL-08 응답이 배열일 수 있음
        const cl08Result = Array.isArray(cl08Raw) ? cl08Raw[0] : cl08Raw;
        console.log('[CompleteRelocateTerminate] CL-08 result:', cl08Result, 'ctrtId:', ctrtId);
        if (cl08Result && !cl08Result.ERROR && cl08Result.CONT_ID === ctrtId) {
          certifyTg = 'Y';
          console.log('[CompleteRelocateTerminate] CERTIFY_TG=Y (IS_CERTIFY_PROD=1 + CL-08 confirmed)');
        }
      } catch (cl08Error) {
        console.log('[CompleteRelocateTerminate] CL-08 query failed:', cl08Error);
      }
    }

    if (certifyTg === 'Y') {
      try {
        // 새 상품(이전설치 상품)이 certify 대상인지, 새 SO가 certify 대상인지 확인
        const newProdCd = moveWorkInfoData?.NEW_PROD_CD || '';
        const newSoId = moveWorkInfoData?.SO_ID || order.SO_ID || '';

        // certifyProdList와 certifySoList로 확인
        const isNewProdCertify = certifyProdListState.some((item: any) => item.PROD_CD === newProdCd);
        const certifySoList = await getCommonCodes('CMIF006');
        const certifySoIds = certifySoList.map((item: any) => item.code);
        const isNewSoCertify = certifySoIds.includes(newSoId);

        console.log('[CompleteRelocateTerminate] CL-06 조건 확인:', {
          certifyTg,
          newProdCd,
          newSoId,
          isNewProdCertify,
          isNewSoCertify
        });

        // NEW가 일반상품이거나 단말인증 상품이어도 대상인 SO에 해당되지 않는 경우에만 CL-06 호출
        if (!isNewProdCertify || !isNewSoCertify) {
          console.log('[CompleteRelocateTerminate] FTTH CL-06 서비스 해지 등록 호출');
          const cl06Result = await setCertifyCL06({
            CTRT_ID: order.CTRT_ID || '',
            CUST_ID: order.customer?.id || (order as any).CUST_ID || '',
            WRK_ID: order.id || '',
            SO_ID: newSoId || order.SO_ID || '',
            REG_UID: workerId,
          });

          if (cl06Result?.ERROR) {
            console.error('[CompleteRelocateTerminate] CL-06 호출 실패:', cl06Result.ERROR);
            showToast?.(`단말인증 해지요청 실패: ${cl06Result.ERROR}`, 'error');
            return;
          }
          console.log('[CompleteRelocateTerminate] CL-06 서비스 해지 등록 완료');
        } else {
          console.log('[CompleteRelocateTerminate] 새 상품/SO가 certify 대상이므로 CL-06 스킵');
        }
      } catch (error: any) {
        console.error('[CompleteRelocateTerminate] CL-06 호출 에러:', error);
        showToast?.(`단말인증 해지 중 오류: ${error.message || '알 수 없는 오류'}`, 'error');
        return;
      }
    }

    // 인입선로 완전철거 데이터가 있으면 먼저 API 호출
    if (removalLineData && removalLineData.REMOVE_GB === '4') {
      try {
        console.log('[WorkCompleteRemovalTerminate] 인입선로 완전철거 API 호출:', removalLineData);
        const removeStatResult = await insertWorkRemoveStat({
          WRK_ID: order.id || '',
          REMOVE_LINE_TP: removalLineData.REMOVE_LINE_TP || '',
          REMOVE_GB: removalLineData.REMOVE_GB || '4',
          REMOVE_STAT: removalLineData.REMOVE_STAT || '',
          REG_UID: workerId,
        });

        if (removeStatResult.code !== 'SUCCESS' && removeStatResult.code !== 'OK') {
          showToast?.(removeStatResult.message || '인입선로 철거상태 저장에 실패했습니다.', 'error', true);
          return;
        }
        console.log('[WorkCompleteRemovalTerminate] 인입선로 완전철거 저장 성공');
      } catch (error: any) {
        showToast?.(error.message || '인입선로 철거상태 저장 중 오류가 발생했습니다.', 'error', true);
        return;
      }
    }

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
        console.log('[CompleteRemovalTerminate] 정지기간 수정 성공');
      } catch (err: any) {
        showToast?.(err.message || '정지기간 수정 실패', 'error', true);
        setSusSaving(false);
        return;
      }
      setSusSaving(false);
    }

    const removedEquipments = equipmentData?.removedEquipments || [];
    const customerEquipmentsForSignal = equipmentData?.customerEquipments || [];
    const installedEquipmentsForSignal = equipmentData?.installedEquipments || [];
    const hasIspProdForSignal = !!(order as any).ISP_PROD_CD;
    const ctrtStat = (order as any).CTRT_STAT || '';

    console.log('[CompleteRelocateTerminate] 신호전송 조건 확인:', {
      signalSent,
      certifyTg,
      removedEquipments: removedEquipments.length,
      customerEquipments: customerEquipmentsForSignal.length,
      installedEquipments: installedEquipmentsForSignal.length,
      hasIspProdForSignal,
      ctrtStat,
      ISP_PROD_CD: (order as any).ISP_PROD_CD,
      CTRT_STAT: (order as any).CTRT_STAT,
      shouldSendSignal: !signalSent && certifyTg !== 'Y' &&
        (removedEquipments.length > 0 || customerEquipmentsForSignal.length > 0 ||
         installedEquipmentsForSignal.length > 0 || hasIspProdForSignal) &&
        ctrtStat !== '20'
    });

    // 신호 전송이 필요한 경우 (레거시 m08 line 887-918)
    // 레거시: CERTIFY_TG='Y' → IFSVC_CHK=true → 신호 skip
    // 레거시: IFSVC_CHK==false && (rmv_eqt.rowcount>0 || eqt_cust.rowcount>0 || ISP_PROD_CD)
    if (!signalSent && certifyTg !== 'Y' &&
        (removedEquipments.length > 0 || customerEquipmentsForSignal.length > 0 || installedEquipmentsForSignal.length > 0 || hasIspProdForSignal) &&
        ctrtStat !== '20') {
      showToast?.('신호를 전송합니다...', 'info');

      const signalSuccess = await sendRemovalSignal();
      if (!signalSuccess) {
        // 레거시 line 906-918: VoIP 특정에러 → 차단, MSO → 차단, 그외 → 사용자 확인 팝업
        const prodGrp = (order as any).PROD_GRP || '';
        const errMsg = signalResult?.message || '';

        // VoIP(PROD_GRP='V') + 특정 에러(PROC_VOIP_KCT-029 제외) → 무조건 차단
        if (prodGrp === 'V' && errMsg.indexOf('PROC_VOIP_KCT-029') < 0) {
          showToast?.('VoIP 신호 전송에 실패했습니다.', 'error', true);
          return;
        }

        // MSO 처리 오류 → 차단
        const msoOutYn = (order as any).MSO_OUT_YN || '';
        if (msoOutYn === 'Y') {
          showToast?.('MSO 처리 오류로 신호 전달에 작업완료가 불가능합니다. 담당자에게 문의하세요.', 'error');
          return;
        }

        // 그 외 → 레거시: cfn_SetMsg("I", "Y", "신호전달에 실패하였습니다. 그럼에도 작업을 완료하시겠습니까?")
        const userConfirmed = window.confirm('신호전달에 실패하였습니다.\n그럼에도 작업을 완료하시겠습니까?');
        if (!userConfirmed) {
          console.log('[CompleteRemovalTerminate] 사용자가 신호 실패 후 작업완료 취소');
          return;
        }
        console.log('[CompleteRemovalTerminate] 사용자가 신호 실패에도 작업완료 진행 선택');
      }
    }

    const formattedDate = workCompleteDate.replace(/-/g, '');

    // 장비 데이터 처리 (회수 장비만) - 필수 필드 포함 (레거시 기준)
    // removalStatus 필드명: EQT_LOSS_YN, PART_LOSS_BRK_YN, EQT_BRK_YN, EQT_CABL_LOSS_YN, EQT_CRDL_LOSS_YN (값: '0' 또는 '1')
    const processEquipmentList = (equipments: any[]) => {
      if (!equipments || equipments.length === 0) return [];
      const removalStatus = equipmentData?.removalStatus || {};

      // 장비 객체에 이미 값이 있으면 사용, 없으면 removalStatus에서 가져옴
      // 레거시 호환: '0' = 회수, '1' = 분실
      const getYN = (eqVal: any, statusVal: any) =>
        (eqVal === '1' || eqVal === 'Y' || statusVal === '1' || statusVal === 'Y') ? '1' : '0';

      return equipments.map((eq: any) => {
        const eqtNo = eq.EQT_NO || eq.id || (eq.actualEquipment?.id) || '';
        // 여러 키로 removalStatus 조회 시도 (키 불일치 문제 해결)
        const status = removalStatus[eqtNo]
          || removalStatus[eq.id]
          || removalStatus[eq.EQT_NO]
          || removalStatus[eq.actualEquipment?.id]
          || removalStatus[eq.serialNumber]
          || {};
        // REUSE_YN 값 설정 (장비정보 단계에서 설정한 값 사용)
        const reuseYnValue = storeReuseAll ? '1' : '0';
        // 회수 장비 필수 필드 (레거시 기준)
        // 이전철거(08)도 철거장비는 CRR_TSK_CL="02" (레거시 mowoa03m08.xml:976)
        const removalFields = {
          CRR_TSK_CL: '02',
          RCPT_ID: order.RCPT_ID || '',
          CRR_ID: order.CRR_ID || user.crrId || '01',
          WRKR_ID: workerId,
          // 분실/파손 상태 (EquipmentTerminate에서 저장한 필드명 사용)
          EQT_LOSS_YN: getYN(eq.EQT_LOSS_YN, status.EQT_LOSS_YN),
          PART_LOSS_BRK_YN: getYN(eq.PART_LOSS_BRK_YN, status.PART_LOSS_BRK_YN),
          EQT_BRK_YN: getYN(eq.EQT_BRK_YN, status.EQT_BRK_YN),
          EQT_CABL_LOSS_YN: getYN(eq.EQT_CABL_LOSS_YN, status.EQT_CABL_LOSS_YN),
          EQT_CRDL_LOSS_YN: getYN(eq.EQT_CRDL_LOSS_YN, status.EQT_CRDL_LOSS_YN),
          REUSE_YN: reuseYnValue,
        };

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
            SVC_CMPS_ID: contract.id || contract.SVC_CMPS_ID || actual.SVC_CMPS_ID,
            BASIC_PROD_CMPS_ID: actual.BASIC_PROD_CMPS_ID || contract.BASIC_PROD_CMPS_ID || '',
            EQT_PROD_CMPS_ID: actual.EQT_PROD_CMPS_ID || contract.id,
            PROD_CD: actual.PROD_CD || contract.PROD_CD || order.PROD_CD || '',
            SVC_CD: actual.SVC_CD || contract.SVC_CD || '',
            EQT_SALE_AMT: actual.EQT_SALE_AMT || '0',
            MST_SO_ID: actual.MST_SO_ID || order.SO_ID || '',
            SO_ID: actual.SO_ID || order.SO_ID || '',
            REG_UID: workerId,
            OLD_LENT_YN: actual.OLD_LENT_YN || 'N',
            LENT: actual.LENT || '10',
            ITLLMT_PRD: actual.ITLLMT_PRD || '00',
            EQT_USE_STAT_CD: actual.EQT_USE_STAT_CD || '1',
            EQT_CHG_GB: '1',
            IF_DTL_ID: actual.IF_DTL_ID || '',
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
          WRK_ID: eq.WRK_ID || order.id,
          CUST_ID: eq.CUST_ID || order.customer?.id,
          CTRT_ID: eq.CTRT_ID || order.CTRT_ID,
          WRK_CD: eq.WRK_CD || order.WRK_CD,
          REG_UID: workerId,
          ...removalFields,
        };
      });
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
        // 레거시: 사용자가 입력한 고객명/연락처 (mowoa03m08.xml 1006~1007)
        CNFM_CUST_NM: cnfmCustNm,
        CNFM_CUST_TELNO: cnfmCustTelno,
        REQ_CUST_TEL_NO: cnfmCustTelno,
        // 철거해지: 설치위치 없음
        INSTL_LOC: '',
        // 철거해지: 상향제어, 서비스이용구분 없음
        UP_CTRL_CL: '',
        PSN_USE_CORP: '',
        VOIP_USE_CORP: '',
        DTV_USE_CORP: '',
        WRK_ACT_CL: '20',
        // 철거정보 (필수)
        NET_CL: installInfoData?.NET_CL || '',
        WRNG_TP: installInfoData?.WRNG_TP || '',
        INSTL_TP: installInfoData?.INSTL_TP || '77', // 철거해지 기본값
        CB_WRNG_TP: installInfoData?.CB_WRNG_TP || '',
        CB_INSTL_TP: installInfoData?.CB_INSTL_TP || '',
        INOUT_LINE_TP: installInfoData?.INOUT_LINE_TP || '',
        INOUT_LEN: installInfoData?.INOUT_LEN || '',
        DVDR_YN: installInfoData?.DVDR_YN || '',
        BFR_LINE_YN: installInfoData?.BFR_LINE_YN || '',
        CUT_YN: installInfoData?.CUT_YN || '',
        TERM_NO: installInfoData?.TERM_NO || '',
        RCV_STS: installInfoData?.RCV_STS || '',
        SUBTAP_ID: installInfoData?.SUBTAP_ID || '',
        PORT_NUM: installInfoData?.PORT_NUM || '',
        EXTN_TP: installInfoData?.EXTN_TP || '',
        TAB_LBL: installInfoData?.TAB_LBL || '',
        CVT_LBL: installInfoData?.CVT_LBL || '',
        STB_LBL: installInfoData?.STB_LBL || '',
        KPI_PROD_GRP: '',
        OBS_RCPT_CD: '',
        OBS_RCPT_DTL_CD: '',
        VOIP_JOIN_CTRT_ID: '',
        AGREE_YN: '',
        ISP_YN: '',
        AGREE_GB: '',
        CUST_CLEAN_YN: '',
        EQT_RMV_FLAG: '',
        TV_TYPE: ''
      },
      // 철거해지: 설치장비 없음, 회수장비만
      equipmentList: [],
      removeEquipmentList: processEquipmentList(equipmentData?.removedEquipments || []),
      spendItemList: equipmentData?.spendItems || [],
      agreementList: equipmentData?.agreements || [],
      // 인입선로 정보 (zustand store에서 가져옴)
      poleList: equipmentData?.poleResults || []
    };

    submitWork(completeData, {
      onSuccess: (result) => {
        if (result.code === 'SUCCESS' || result.code === 'OK') {
          localStorage.removeItem(getStorageKey());
          (order as any).WRK_STAT_CD = '3';  // 완료 상태로 변경 (재완료 방지)
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
            {/* 망구분 + 철거정보 버튼 (필수) */}
            <div>
              <label className="block text-xs sm:text-sm font-semibold text-gray-900 mb-1.5 sm:mb-2">
                망구분 {!isWorkCompleted && <span className="text-red-500">*</span>}
              </label>
              <div className="flex gap-1.5 sm:gap-2">
                <input
                  type="text"
                  value={networkTypeName || ''}
                  readOnly
                  disabled
                  placeholder="철거정보에서 입력 (필수)"
                  className="flex-1 min-w-0 min-h-10 sm:min-h-12 px-3 sm:px-4 py-2 sm:py-3 bg-gray-100 border border-gray-200 rounded-lg text-sm sm:text-base text-gray-600 cursor-not-allowed truncate"
                />
                <button
                  type="button"
                  onClick={() => setShowInstallInfoModal(true)}
                  className={`px-3 sm:px-4 py-2 sm:py-3 text-xs sm:text-sm font-semibold rounded-lg transition-colors whitespace-nowrap flex-shrink-0 ${isWorkCompleted ? 'bg-gray-500 hover:bg-gray-600 text-white' : 'bg-green-500 hover:bg-green-600 text-white'}`}
                >
                  {isWorkCompleted ? '보기' : '철거정보'}
                </button>
              </div>
              {!isWorkCompleted && !installInfoData?.NET_CL && (
                <p className="mt-1 text-xs text-red-500">* 철거정보에서 망구분과 설치유형을 입력해주세요.</p>
              )}
            </div>

            {/* 고객관계 */}
            <div>
              <label className="block text-xs sm:text-sm font-semibold text-gray-900 mb-1.5 sm:mb-2">
                고객관계 {!isWorkCompleted && <span className="text-red-500">*</span>}
              </label>
              <Select
                value={custRel}
                onValueChange={setCustRel}
                options={custRelOptions}
                placeholder="고객관계 선택"
                required
                disabled={isWorkCompleted}
              />
            </div>

            {/* 처리내용 */}
            <div>
              <label className="block text-xs sm:text-sm font-semibold text-gray-900 mb-1.5 sm:mb-2">
                처리내용
              </label>
              <textarea
                value={memo}
                onChange={(e) => setMemo(e.target.value)}
                placeholder="작업 내용을 입력하세요..."
                maxLength={500}
                className={`w-full px-3 sm:px-4 py-2 sm:py-3 border border-gray-300 rounded-lg text-sm sm:text-base resize-none ${isWorkCompleted ? 'bg-gray-100 text-gray-600 cursor-not-allowed' : 'focus:ring-2 focus:ring-blue-500 focus:border-blue-500'}`}
                rows={4}
                readOnly={isWorkCompleted}
                disabled={isWorkCompleted}
              />
              {!isWorkCompleted && (
                <p className={`text-xs text-right mt-1 ${memo.length >= 500 ? 'text-red-500' : 'text-gray-400'}`}>{memo.length}/500</p>
              )}
            </div>

            {/* 작업처리일 */}
            <div>
              <label className="block text-xs sm:text-sm font-semibold text-gray-700 mb-1.5 sm:mb-2">
                작업처리일 <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={workCompleteDate}
                readOnly
                disabled
                className="w-full min-h-10 sm:min-h-12 px-3 sm:px-4 py-2 sm:py-3 bg-gray-50 border border-gray-300 rounded-lg text-sm sm:text-base text-gray-500 cursor-not-allowed"
              />
            </div>

            {/* 단말인증 버튼 영역 (레거시: btn_concentrator - CERTIFY_TG='Y'인 경우 표시) */}
            {showCertifyButtons && !isWorkCompleted && (
              <div className="p-3 bg-indigo-50 border border-indigo-200 rounded-lg">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-semibold text-indigo-800">단말인증</span>
                  {certifyStatus === 'success' && (
                    <span className="px-2 py-0.5 text-xs bg-green-100 text-green-700 rounded-full">인증완료</span>
                  )}
                  {certifyStatus === 'error' && (
                    <span className="px-2 py-0.5 text-xs bg-red-100 text-red-700 rounded-full">인증실패</span>
                  )}
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={handleCertifyCL06}
                    disabled={certifyProcessing}
                    className="flex-1 px-3 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white text-sm font-semibold rounded-lg transition-colors flex items-center justify-center gap-1.5"
                  >
                    {certifyProcessing ? (
                      <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                      </svg>
                    ) : (
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                      </svg>
                    )}
                    <span>단말인증</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleCertifyCL08}
                    disabled={certifyProcessing}
                    className="flex-1 px-3 py-2 bg-gray-600 hover:bg-gray-700 disabled:bg-gray-400 text-white text-sm font-semibold rounded-lg transition-colors flex items-center justify-center gap-1.5"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                    </svg>
                    <span>상태조회</span>
                  </button>
                </div>
                {certifyMessage && (
                  <p className={`mt-2 text-xs ${certifyStatus === 'error' ? 'text-red-600' : certifyStatus === 'success' ? 'text-green-600' : 'text-gray-600'}`}>
                    {certifyMessage}
                  </p>
                )}
              </div>
            )}

            {/* LGHV STB 알림 (레거시: bLghvStb) */}
            {isLghvStb && !isWorkCompleted && (
              <div className="p-3 bg-orange-50 border border-orange-200 rounded-lg">
                <div className="flex items-center gap-2">
                  <svg className="w-5 h-5 text-orange-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                  <span className="text-sm font-medium text-orange-800">
                    LGHV STB 상품입니다. 철거 완료 시 STB 삭제 신호가 전송됩니다.
                  </span>
                </div>
              </div>
            )}

            {/* 해지정보 (토글 섹션) */}
            <HotbillSection
              custId={order.customer?.id || order.CUST_ID || ''}
              rcptId={order.RCPT_ID || ''}
              ctrtId={order.CTRT_ID || ''}
              soId={order.SO_ID || ''}
              termDt={(order as any).TERM_DT || ''}
              wrkCd={order.WRK_CD}
              showToast={showToast}
            />

            {/* 인입선로 철거관리 (인라인 섹션) - 조건: KPI_PROD_GRP_CD in C,D,I */}
            {needsRemovalLineManagement() && (
              <RemovalLineSection
                onComplete={handleRemovalLineComplete}
                onAssignAS={handleRemovalLineAssignAS}
                showToast={showToast}
                disabled={isWorkCompleted}
                savedData={removalLineData}
                onReset={() => setRemovalLineData(null)}
              />
            )}

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
                      <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
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

      {/* 철거정보 모달 */}
      <InstallInfoModal
        isOpen={showInstallInfoModal}
        onClose={() => setShowInstallInfoModal(false)}
        onSave={handleInstallInfoSave}
        workId={order.id}
        initialData={installInfoData}
        workType={order.WRK_CD}
        customerId={order.customer.id}
        customerName={order.customer.name}
        contractId={order.CTRT_ID}
        addrOrd={(order as any).ADDR_ORD || ''}
        kpiProdGrpCd={equipmentData?.kpiProdGrpCd || equipmentData?.KPI_PROD_GRP_CD || order.KPI_PROD_GRP_CD}
        prodChgGb={equipmentData?.prodChgGb || equipmentData?.PROD_CHG_GB || (order as any).PROD_CHG_GB}
        chgKpiProdGrpCd={equipmentData?.chgKpiProdGrpCd || equipmentData?.CHG_KPI_PROD_GRP_CD || (order as any).CHG_KPI_PROD_GRP_CD}
        prodGrp={equipmentData?.prodGrp || equipmentData?.PROD_GRP || (order as any).PROD_GRP}
        wrkDtlTcd={order.WRK_DTL_TCD}
        readOnly={isWorkCompleted}
      />

      {/* 연동이력 모달 */}
      <IntegrationHistoryModal
        isOpen={showIntegrationHistoryModal}
        onClose={() => setShowIntegrationHistoryModal(false)}
        ctrtId={order.CTRT_ID}
        custId={order.customer.id}
      />

      {/* 이전설치정보 모달 (레거시 btn_move_info) */}
      <MoveWorkInfoModal
        isOpen={showMoveWorkInfoModal}
        onClose={() => setShowMoveWorkInfoModal(false)}
        moveWorkData={moveWorkInfoData}
        order={order}
      />

      {/* 인입선로미철거 AS할당 모달 (레거시 mowoa03p06) */}
      <RemovalASAssignModal
        isOpen={showASAssignModal}
        onClose={() => setShowASAssignModal(false)}
        onSave={handleASAssignSave}
        removalLineData={removalLineData}
        custId={order.customer?.id || ''}
        custNm={order.customer?.name || ''}
        addrOrd={order.customer?.ADDR_ORD || ''}
        address={order.address || ''}
        showToast={showToast}
      />


      {/* 작업완료 확인 모달 */}
      <ConfirmModal
        isOpen={showConfirmModal}
        onClose={() => setShowConfirmModal(false)}
        onConfirm={handleConfirmSubmit}
        title="작업 완료"
        message={confirmMessage}
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
          order={order}
        />
      </ConfirmModal>
    </div>
  );
};

export default CompleteRelocateTerminate;
