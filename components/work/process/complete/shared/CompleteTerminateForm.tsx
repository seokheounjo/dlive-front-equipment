/**
 * CompleteTerminate.tsx
 * WRK_CD=02 (철거) 작업완료 페이지
 *
 * 레거시 참조: mowoa03m02.xml - 작업완료(철거)
 * 특징:
 * - btn_eqt_rmv (장비철거) 버튼 표시 (SO_ID != 403일 때)
 * - btn_hot_bill (즉납) 버튼 표시
 * - btn_save (작업완료) 버튼 - KPI_PROD_GRP가 C/D면 숨김
 * - 철거정보 입력 필수
 */
import React, { useState, useEffect, useCallback } from 'react';
import { WorkOrder, WorkCompleteData } from '../../../../../types';
import { getCommonCodeList, CommonCode, getWorkReceiptDetail, sendSignal, getLghvProdMap, getWorkCancelInfo } from '../../../../../services/apiService';
import { getCertifyProdMap, setCertifyCL06 } from '../../../../../services/certifyApiService';
import Select from '../../../../ui/Select';
import InstallInfoModal, { InstallInfoData } from '../../../../modal/InstallInfoModal';
import HotbillSection from '../../HotbillSection';
import RemovalLineSection, { RemovalLineData } from '../../RemovalLineSection';
import RemovalASAssignModal, { ASAssignData } from '../../../../modal/RemovalASAssignModal';
import ConfirmModal from '../../../../common/ConfirmModal';
import WorkCompleteSummary from '../../WorkCompleteSummary';
import { insertWorkRemoveStat, modAsPdaReceipt } from '../../../../../services/apiService';
import { useWorkProcessStore } from '../../../../../stores/workProcessStore';
import { useCertifyStore } from '../../../../../stores/certifyStore';
import { useWorkEquipment } from '../../../../../stores/workEquipmentStore';
import { useCompleteWork } from '../../../../../hooks/mutations/useCompleteWork';
import '../../../../../styles/buttons.css';
import { ProductType } from './types';

export interface PreSubmitContext {
  order: WorkOrder;
  workerId: string;
}

export interface PreSubmitResult {
  success: boolean;
  message?: string;
  severity?: 'error' | 'warning';
}

interface CompleteTerminateFormProps {
  order: WorkOrder;
  onBack: () => void;
  onSuccess: () => void;
  showToast?: (message: string, type: 'success' | 'error' | 'warning' | 'info') => void;
  equipmentData?: any;
  readOnly?: boolean;
  productType: ProductType;
  /** 작업완료 후 신호 전송 여부 (기본값: true, ftth/lguplus는 false) */
  sendSignalAfterComplete?: boolean;
  onPreSubmit?: (ctx: PreSubmitContext) => Promise<PreSubmitResult | void>;
}

const CompleteTerminateForm: React.FC<CompleteTerminateFormProps> = ({
  order,
  onBack,
  onSuccess,
  showToast,
  equipmentData: legacyEquipmentData,
  readOnly = false,
  productType,
  sendSignalAfterComplete = true,
  onPreSubmit,
}) => {
  // 완료/취소된 작업 여부 확인
  const isWorkCompleted = readOnly
    || order.WRK_STAT_CD === '3'
    || order.WRK_STAT_CD === '4'
    || order.WRK_STAT_CD === '7'
    || order.status === '완료'
    || order.status === '취소';

  const [isDataLoaded, setIsDataLoaded] = useState(false);

  // OST (원스톱) 상태 - 별도 API로 조회 (order 객체에 값이 안 올 수 있음)
  const [ostWorkableStat, setOstWorkableStat] = useState<string>('');
  const [isOstChecking, setIsOstChecking] = useState(false);

  // Store에서 장비 데이터 + 인입선로 철거관리 데이터
  const { equipmentData: storeEquipmentData, filteringData, removalLineData: storeRemovalLineData, setRemovalLineData: setStoreRemovalLineData } = useWorkProcessStore();
  const { certifyRegconfInfo } = useCertifyStore();

  // Zustand Equipment Store - 장비 컴포넌트에서 등록한 장비 정보
  const workId = order.id || '';
  const zustandEquipment = useWorkEquipment(workId);

  // equipmentData 병합: Zustand Equipment Store 우선 사용
  // 철거 작업(WRK_CD=02)은 removeEquipments(API output5)를 사용 (markedForRemoval은 AS/상품변경용)
  const equipmentData = {
    ...(storeEquipmentData || legacyEquipmentData || filteringData || {}),
    installedEquipments: zustandEquipment.installedEquipments.length > 0
      ? zustandEquipment.installedEquipments
      : (storeEquipmentData?.installedEquipments || legacyEquipmentData?.installedEquipments || []),
    // 철거: zustandEquipment.removeEquipments (API output5) 우선 사용
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

  // 폼 상태
  const [custRel, setCustRel] = useState('');
  const [memo, setMemo] = useState('');

  // 모달 상태
  const [showInstallInfoModal, setShowInstallInfoModal] = useState(false);
  const [networkType, setNetworkType] = useState('');
  const [networkTypeName, setNetworkTypeName] = useState('');
  const [installInfoData, setInstallInfoData] = useState<InstallInfoData | undefined>(undefined);

  // 인입선로 철거관리 (store에서 관리 - 스텝 이동해도 유지)
  const removalLineData = storeRemovalLineData as RemovalLineData | null;
  const setRemovalLineData = setStoreRemovalLineData;
  const [showASAssignModal, setShowASAssignModal] = useState(false);
  const [isASProcessing, setIsASProcessing] = useState(false);
  const [pendingASData, setPendingASData] = useState<ASAssignData | null>(null);  // AS할당 임시 저장

  // 작업완료 확인 모달
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [warningModal, setWarningModal] = useState<{message: string, resolve: () => void} | null>(null);
  const [confirmWarningModal, setConfirmWarningModal] = useState<{message: string, resolve: (confirmed: boolean) => void} | null>(null);

  const showWarning = useCallback((message: string): Promise<void> => {
    return new Promise((resolve) => {
      setWarningModal({ message, resolve });
    });
  }, []);

  const showConfirmWarning = useCallback((message: string): Promise<boolean> => {
    return new Promise((resolve) => {
      setConfirmWarningModal({ message, resolve });
    });
  }, []);
  const [confirmMessage, setConfirmMessage] = useState('');
  const [pendingIsEquipmentRemoval, setPendingIsEquipmentRemoval] = useState(false);

  // 핫빌 계산 중 상태 (전체 화면 스피너용)
  const [isHotbillSimulating, setIsHotbillSimulating] = useState(false);

  // 핫빌 확인 상태 (작업완료 전 필수 체크)
  const [isHotbillConfirmed, setIsHotbillConfirmed] = useState(false);

  // LGHV STB 상품 판단 (레거시: bLghvStb, ds_lghv_prod)
  const [isLghvStb, setIsLghvStb] = useState(false);
  const [lghvProdList, setLghvProdList] = useState<any[]>([]);

  // 공통코드
  const [custRelOptions, setCustRelOptions] = useState<{ value: string; label: string }[]>([]);

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

  // 장비철거 버튼 표시 여부 (레거시: SO_ID != 403)
  const showEquipmentRemovalButton = order.SO_ID !== '403';

  // 레거시 조건값들
  const voipCtx = (order as any).VOIP_CTX || '';
  const wrkStatCd = order.WRK_STAT_CD || '';
  const kpiProdGrp = (order as any).KPI_PROD_GRP_CD || '';

  // OST 차단 여부 (0: 불가, 1: 철거만가능, 4: 화면접수불가/설치불가)
  const isOstBlocked = ostWorkableStat === '0' || ostWorkableStat === '1' || ostWorkableStat === '4';

  // 장비철거 버튼 활성화 여부 (레거시: mowoa03m02.xml fn_chg_button_state)
  // - WRK_STAT_CD = 1(접수) 또는 2(할당)일 때 활성화
  // - WRK_STAT_CD = 7(취소요청)일 때 비활성화
  // - VOIP_CTX가 있으면 비활성화 (Line 509-510)
  // - OST_WORKABLE_STAT = 0, 1, 4이면 비활성화 (Line 523-534)
  const isEquipmentRemovalEnabled = (() => {
    if (isWorkCompleted) return false;
    if (isOstChecking) return false; // OST 체크 중에는 비활성화
    if (isOstBlocked) return false;
    if (voipCtx) return false;
    if (wrkStatCd === '1' || wrkStatCd === '2') return true;
    return false;
  })();

  // 작업완료 버튼 표시 여부 (레거시: KPI_PROD_GRP != C, D - Line 507-508)
  const showSaveButton = kpiProdGrp !== 'C' && kpiProdGrp !== 'D';

  // 작업완료 버튼 활성화 여부 (레거시: mowoa03m02.xml fn_chg_button_state)
  const isSaveButtonEnabled = (() => {
    if (isWorkCompleted) return false;
    if (isOstChecking) return false; // OST 체크 중에는 비활성화
    if (isOstBlocked) return false;
    if (wrkStatCd === '1' || wrkStatCd === '2' || wrkStatCd === '7') return true;
    return false;
  })();

  // OST 상태 조회 (별도 API 호출 - 작업지시서 목록에서 값이 안 올 수 있음)
  useEffect(() => {
    const checkOstStatus = async () => {
      if (!order.id || isWorkCompleted) return;

      setIsOstChecking(true);
      try {
        console.log('[CompleteTerminate] OST 상태 조회:', order.id);
        const cancelInfo = await getWorkCancelInfo({
          WRK_ID: order.id,
          RCPT_ID: order.RCPT_ID,
          CUST_ID: order.customer?.id
        });

        if (cancelInfo) {
          const stat = cancelInfo.OST_WORKABLE_STAT || '';
          console.log('[CompleteTerminate] OST 상태 응답:', stat);
          setOstWorkableStat(stat);

          // OST 차단 시 토스트 메시지 (persistent: X 버튼으로만 닫힘)
          if (stat === '0' || stat === '1' || stat === '4') {
            showToast?.('원스톱전환해지건으로 철거완료 작업은 불가능한 상태입니다.', 'warning', true);
          }
        }
      } catch (error) {
        console.error('[CompleteTerminate] OST 상태 조회 실패:', error);
      } finally {
        setIsOstChecking(false);
      }
    };

    checkOstStatus();
  }, [order.id, order.RCPT_ID, order.customer?.id, isWorkCompleted]);

  // 데이터 복원 - 기존 설치정보 API에서 가져오기 (정지 작업과 동일)
  useEffect(() => {
    const fetchWorkDetail = async () => {
      try {
        console.log('[WorkCompleteTerminate] 작업 상세 조회 시작');
        const detail = await getWorkReceiptDetail({
          WRK_DRCTN_ID: order.directionId || order.WRK_DRCTN_ID || '',
          WRK_ID: order.id,  // order.id가 실제 WRK_ID
          SO_ID: order.SO_ID
        });

        if (detail) {
          console.log('[WorkCompleteTerminate] API 응답 전체:', detail);
          console.log('[WorkCompleteTerminate] 망구분:', { NET_CL: detail.NET_CL, NET_CL_NM: detail.NET_CL_NM });
          console.log('[WorkCompleteTerminate] 설치정보:', { INSTL_TP: detail.INSTL_TP, WRNG_TP: detail.WRNG_TP });
          console.log('[WorkCompleteTerminate] 고객관계/메모:', { CUST_REL: detail.CUST_REL, WRK_PROC_CT: detail.WRK_PROC_CT });
          console.log('[WorkCompleteTerminate] isWorkCompleted:', isWorkCompleted);

          // 완료된 작업이면 모든 값 복원
          if (isWorkCompleted) {
            console.log('[WorkCompleteTerminate] 완료된 작업 - 데이터 복원 시작');
            setCustRel(detail.CUST_REL || '');
            setMemo((detail.WRK_PROC_CT || '').replace(/\\n/g, '\n'));
            if (detail.WRKR_CMPL_DT && detail.WRKR_CMPL_DT.length >= 8) {
              setWorkCompleteDate(`${detail.WRKR_CMPL_DT.slice(0,4)}-${detail.WRKR_CMPL_DT.slice(4,6)}-${detail.WRKR_CMPL_DT.slice(6,8)}`);
            }
          }

          // 철거정보는 항상 API에서 가져옴 (기존 계약 정보)
          setNetworkType(detail.NET_CL || '');
          setNetworkTypeName(detail.NET_CL_NM || '');
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
        console.error('[WorkCompleteTerminate] 작업 상세 조회 실패:', error);
      }

      // 진행 중인 작업이면 localStorage에서 사용자 입력값 복원
      if (!isWorkCompleted) {
        const savedDraft = localStorage.getItem(getStorageKey());
        if (savedDraft) {
          try {
            const draftData = JSON.parse(savedDraft);
            setCustRel(draftData.custRel || '');
            setMemo(draftData.memo || '');
            // 사용자가 철거정보를 수정했으면 그 값 사용
            if (draftData.installInfoData) {
              setNetworkType(draftData.networkType || '');
              setNetworkTypeName(draftData.networkTypeName || '');
              setInstallInfoData(draftData.installInfoData);
            }
          } catch (error) {
            console.error('[WorkCompleteTerminate] localStorage 복원 실패:', error);
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
      custRel, memo, networkType, networkTypeName, installInfoData,
      savedAt: new Date().toISOString()
    };
    localStorage.setItem(getStorageKey(), JSON.stringify(draftData));
  }, [custRel, memo, networkType, networkTypeName, installInfoData, isDataLoaded, isWorkCompleted]);

  // 공통코드 로드
  useEffect(() => {
    const loadCodes = async () => {
      try {
        const codes = await getCommonCodeList(['CMCU005']);
        if (codes['CMCU005']) {
          setCustRelOptions(codes['CMCU005'].map((code: CommonCode) => ({
            value: code.COMMON_CD,
            label: code.COMMON_CD_NM
          })));
        }
      } catch (error) {
        console.error('[WorkCompleteTerminate] 공통코드 로드 실패:', error);
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

        // 현재 상품이 LGHV STB인지 판단
        const currentProdCd = order.PROD_CD || (order as any).PROD_CD || '';
        const isLghv = prodList.some((item: any) => item.PROD_CD === currentProdCd);
        setIsLghvStb(isLghv);
        console.log('[CompleteTerminate] LGHV 판단:', { currentProdCd, isLghv, prodListCount: prodList.length });
      } catch (error) {
        console.error('[CompleteTerminate] LGHV 상품맵 조회 실패:', error);
      }
    };
    fetchLghvProdMap();
  }, [order.PROD_CD]);

  // 원스톱 작업 불가 안내 로그 (레거시: mowoa03m02.xml Line 408-410)
  useEffect(() => {
    console.log('[CompleteTerminate] OST 상태 체크:', {
      OST_WORKABLE_STAT: ostWorkableStat,
      isOstBlocked,
      isOstChecking,
      isWorkCompleted,
      WRK_CD: order.WRK_CD,
      WRK_DTL_TCD: order.WRK_DTL_TCD,
      '설명': ostWorkableStat === '0' ? '불가'
           : ostWorkableStat === '1' ? '철거만가능'
           : ostWorkableStat === '2' ? '철거완료'
           : ostWorkableStat === '3' ? '완료'
           : ostWorkableStat === '4' ? '화면접수불가/설치불가'
           : ostWorkableStat === 'X' ? 'OST아님'
           : ostWorkableStat === '' ? '조회중 또는 일반작업'
           : '알수없음'
    });
  }, [ostWorkableStat, isOstBlocked, isOstChecking, isWorkCompleted]);

  // 검증
  const validate = (): string[] => {
    const errors: string[] = [];
    if (!custRel) errors.push('고객과의 관계를 선택해주세요.');
    // 철거정보 필수 (레거시: 망구분, 배선유형, 설치유형=77)
    if (!installInfoData?.NET_CL) {
      errors.push('철거정보를 입력해주세요. (망구분 필수)');
    }
    if (!workCompleteDate) errors.push('작업처리일을 선택해주세요.');
    // 핫빌 확인 필수 (WRK_CD=02 && WRK_STAT_CD !== '7' 일 때)
    if (order.WRK_CD === '02' && wrkStatCd !== '7' && !isHotbillConfirmed) {
      errors.push('핫빌 확인이 필요합니다.');
    }

    // 장비 철거 검증 (레거시 동일)
    // VoIP가 아닌 경우 철거 장비가 최소 1개 이상 있어야 함
    const prodGrp = (order as any).PROD_GRP || '';
    const removedEquipments = equipmentData?.removedEquipments || [];
    if (prodGrp !== 'V' && removedEquipments.length < 1) {
      errors.push('철거할 장비가 없습니다. 장비 정보를 확인해주세요.');
    }

    // 인입선로 철거관리 필수 체크
    if (needsRemovalLineManagement() && !removalLineData) {
      errors.push('인입선로 철거관리를 먼저 완료해주세요.');
    }

    return errors;
  };

  // 설치정보 모달 핸들러
  const handleInstallInfoSave = (data: InstallInfoData) => {
    setInstallInfoData(data);
    if (data.NET_CL) setNetworkType(data.NET_CL);
    if (data.NET_CL_NM) setNetworkTypeName(data.NET_CL_NM);
  };

  // 장비철거 버튼 클릭 (레거시: btn_eqt_rmv)
  const handleEquipmentRemoval = () => {
    // 레거시: fn_save() 호출하되 EQT_RMV_FLAG = 'Y' 설정
    handleSubmit(true);
  };

  // 작업완료 처리 - 확인 모달 표시
  const handleSubmit = (isEquipmentRemoval = false) => {
    if (isLoading) return;

    // 원스톱 작업 차단 체크
    if (isOstBlocked) {
      showToast?.('원스톱전환해지건으로 철거완료 작업은 불가능한 상태입니다.', 'warning');
      return;
    }

    // 방송상품 작업완료 불가 체크 (레거시: mowoa03m02 btn_save_OnClick)
    // KPI_PROD_GRP_CD가 'C'(케이블) 또는 'D'(DTV)인 경우 작업완료 불가
    // 단, 장비철거(btn_eqt_rmv)는 방송상품 체크 없이 진행 가능 (레거시: btn_eqt_rmv_OnClick → fn_save 직접 호출)
    if (!isEquipmentRemoval) {
      const kpiProdGrp = (order as any).KPI_PROD_GRP_CD || '';
      if (kpiProdGrp === 'C' || kpiProdGrp === 'D') {
        showToast?.('방송 상품은 작업완료 처리하실수 없습니다.', 'error');
        return;
      }
    }

    const errors = validate();
    if (errors.length > 0) {
      errors.forEach(error => showToast?.(error, 'error'));
      const fieldMap: [string, string][] = [
        ['고객과의 관계', 'field-custRel'],
        ['철거정보', 'field-installInfo'],
        ['망구분', 'field-installInfo'],
        ['작업처리일', 'field-workDate'],
        ['핫빌', 'field-hotbill'],
        ['철거할 장비', 'field-equipment'],
        ['장비 정보', 'field-equipment'],
        ['인입선로', 'removal-line-section'],
      ];
      for (const [keyword, id] of fieldMap) {
        if (errors[0].includes(keyword)) {
          const el = document.getElementById(id);
          if (el) {
            el.scrollIntoView({ behavior: 'smooth', block: 'center' });
            el.classList.add('ring-2', 'ring-red-500', 'ring-offset-2');
            setTimeout(() => el.classList.remove('ring-2', 'ring-red-500', 'ring-offset-2'), 2000);
          }
          break;
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

    const message = isEquipmentRemoval
      ? '장비철거를 진행하시겠습니까?'
      : '작업을 완료하시겠습니까?';

    setConfirmMessage(message);
    setPendingIsEquipmentRemoval(isEquipmentRemoval);
    setShowConfirmModal(true);
  };

  // 인입선로 철거관리 필요 여부 체크 (레거시: mowoa03m02)
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
    console.log('[WorkCompleteTerminate] 인입선로 철거관리 완료(완전철거) 임시저장:', data);
    setRemovalLineData(data);
    showToast?.('인입선로 철거관리가 임시저장되었습니다. 작업완료 시 반영됩니다.', 'info');
  };

  // 인입선로 미철거 - AS할당 핸들러
  const handleRemovalLineAssignAS = (data: RemovalLineData) => {
    console.log('[WorkCompleteTerminate] 인입선로 미철거 - AS할당 모달 열기:', data);
    setRemovalLineData(data);
    setShowASAssignModal(true);
  };

  // AS할당 확인 핸들러 (임시 저장 - 작업완료 시 같이 호출)
  const handleASAssignSave = (asData: ASAssignData) => {
    console.log('[WorkCompleteTerminate] AS할당 임시 저장:', asData);
    // 임시 저장 (작업완료 시 같이 API 호출)
    setPendingASData(asData);
    setShowASAssignModal(false);
    showToast?.('인입선로 미철거 AS할당 정보가 입력되었습니다.', 'info');
  };

  // 실제 작업 완료 처리
  const handleConfirmSubmit = async () => {
    const formattedDate = workCompleteDate.replace(/-/g, '');
    const userInfo = localStorage.getItem('userInfo');
    const user = userInfo ? JSON.parse(userInfo) : {};
    const workerId = user.userId || '';

    // === 상품유형별 전처리 (wrapper에서 주입한 콜백) ===
    if (onPreSubmit) {
      try {
        const preResult = await onPreSubmit({ order, workerId });
        if (preResult && !preResult.success) {
          const severity = preResult.severity || 'error';
          if (severity === 'error') {
            showToast?.(preResult.message || '전처리 실패', 'error');
            return;
          }
          showToast?.(preResult.message || '', 'warning');
        }
      } catch (error: any) {
        showToast?.(`전처리 중 오류: ${error.message || '알 수 없는 오류'}`, 'error');
        return;
      }
    }

    // 신호 전송 여부: wrapper에서 sendSignalAfterComplete로 제어
    // sendSignalAfterComplete=false(ftth/lguplus) → certifyTg='Y' (삭제신호 skip)
    // sendSignalAfterComplete=true(basic) → certifyTg='N' (삭제신호 발동)
    const certifyTg = !sendSignalAfterComplete ? 'Y' : 'N';

    // 인입선로 완전철거 데이터가 있으면 먼저 API 호출
    if (removalLineData && removalLineData.REMOVE_GB === '4') {
      try {
        console.log('[WorkCompleteTerminate] 인입선로 완전철거 API 호출:', removalLineData);
        const removeStatResult = await insertWorkRemoveStat({
          WRK_ID: order.id || (order as any).WRK_ID || '',
          REMOVE_LINE_TP: removalLineData.REMOVE_LINE_TP || '',
          REMOVE_GB: removalLineData.REMOVE_GB || '4',
          REMOVE_STAT: removalLineData.REMOVE_STAT || '',
          REG_UID: workerId,
        });

        if (removeStatResult.code !== 'SUCCESS' && removeStatResult.code !== 'OK') {
          showToast?.(removeStatResult.message || '인입선로 철거상태 저장에 실패했습니다.', 'error', true);
          return;
        }
        console.log('[WorkCompleteTerminate] 인입선로 완전철거 저장 성공');
      } catch (error: any) {
        showToast?.(error.message || '인입선로 철거상태 저장 중 오류가 발생했습니다.', 'error', true);
        return;
      }
    }

    // 철거 신호 호출 (레거시: mowoa03m02.xml btn_save line 1005-1024)
    // 레거시 조건: IFSVC_CHK==false(CERTIFY_TG!='Y') && (rmv_eqt.rowcount>0 || ISP_PROD_CD)
    const removedEquipments = equipmentData?.removedEquipments || [];
    const hasIspProdForDel = !!(order as any).ISP_PROD_CD;
    if (certifyTg !== 'Y' && (removedEquipments.length > 0 || hasIspProdForDel)) {
      // 방어 로직: 현재 상품이 FTTH 인증상품이면 CL-06으로 전환
      const currentProdCd = (order as any).BASIC_PROD_CD || order.PROD_CD || '';
      let isCurrentFtth = false;
      try {
        const certifyProdList = await getCertifyProdMap();
        isCurrentFtth = (certifyProdList || []).some((cd: string) => cd === currentProdCd);
      } catch (e) {
        console.warn('[CompleteTerminate] getCertifyProdMap 실패:', e);
      }

      if (isCurrentFtth) {
        // FTTH 인증상품 → CL-06 해지신호 (wrapper 미적용 방어)
        try {
          console.log(`[신호연동] 철거(WRK_CD=02) | 상품(${currentProdCd}) FTTH → CL-06 해지신호 전송`);
          const cl06Result = await setCertifyCL06({
            CTRT_ID: order.CTRT_ID || '',
            CUST_ID: order.customer?.id || order.CUST_ID || '',
            SO_ID: order.SO_ID || '',
            REG_UID: workerId,
          });
          if (cl06Result && !cl06Result.ERROR) {
            console.log('[CompleteTerminate] CL-06 해지신호 완료');
          } else {
            console.warn('[CompleteTerminate] CL-06 해지신호 실패:', cl06Result?.ERROR);
            const userConfirmed = await showConfirmWarning('CL-06 신호전달에 실패하였습니다.\n그럼에도 작업을 완료하시겠습니까?');
            if (!userConfirmed) return;
          }
        } catch (error) {
          console.warn('[CompleteTerminate] CL-06 해지신호 오류:', error);
          const userConfirmed = await showConfirmWarning('신호전달에 실패하였습니다.\n그럼에도 작업을 완료하시겠습니까?');
          if (!userConfirmed) return;
        }
      } else {
      try {
        let msgId = 'SMR05';
        let etc1 = '';

        if (isLghvStb) {
          msgId = 'STB_DEL';
          const stbEquipment = removedEquipments.find(
            (eq: any) => (eq.ITEM_MID_CD || eq.itemMidCd || eq.actualEquipment?.ITEM_MID_CD || eq.actualEquipment?.itemMidCd) === '04'
          );
          if (stbEquipment) {
            etc1 = stbEquipment.EQT_NO || stbEquipment.id || stbEquipment.actualEquipment?.EQT_NO || stbEquipment.actualEquipment?.id || '';
          }
        }

        const firstEquip = removedEquipments[0];
        const actual = firstEquip ? (firstEquip.actualEquipment || firstEquip) : {};
        const eqtProdCmpsId = actual.PROD_CMPS_ID
          || firstEquip?.PROD_CMPS_ID
          || actual.EQT_PROD_CMPS_ID
          || firstEquip?.EQT_PROD_CMPS_ID
          || '';

        const voipProdCd = (order as any).VOIP_PROD_CD || '';
        const voipJoinCtrtId = voipProdCd ? (order.CTRT_ID || '') : '';

        const prodTypeDesc = isLghvStb ? 'LGHV STB' : voipProdCd ? 'VoIP 포함' : '딜라이브 일반';
        const signalDesc = msgId === 'STB_DEL' ? 'LGHV STB 삭제' : 'SMR05 철거';
        console.log(`[신호연동] 철거 작업완료(WRK_CD=02) | 상품: ${prodTypeDesc} | PROD_CD=${order.PROD_CD} | ${signalDesc} 신호 전송 | CTRT_ID=${order.CTRT_ID}`, {
          msgId, isLghvStb, etc1, eqtProdCmpsId, voipJoinCtrtId
        });

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

        // 결과 처리 (레거시 mowoa03m02.xml btn_save line 1022-1034)
        // 1) VoIP(PROD_GRP='V') + 특정 에러(PROC_VOIP_KCT-029 제외) → 무조건 차단
        // 2) MSO_OUT_YN='Y' → 차단
        // 3) 그 외 실패 → "신호전달에 실패하였습니다. 그럼에도 작업을 완료하시겠습니까?" 팝업
        if (result.code !== 'SUCCESS' && result.code !== 'OK') {
          const prodGrp = (order as any).PROD_GRP || '';
          const isVoipSpecificError = prodGrp === 'V' &&
            result.message?.indexOf('PROC_VOIP_KCT-029') === -1;

          if (isVoipSpecificError) {
            console.warn('[CompleteTerminate] VoIP 철거 신호 실패 - 작업완료 차단:', result.message);
            await showWarning('철거 신호 전송에 실패했습니다.');
            return;
          }

          // 비-VoIP 또는 VoIP-029 에러: MSO 체크 후 사용자 확인
          const msoOutYn = (order as any).MSO_OUT_YN || '';
          if (msoOutYn === 'Y') {
            await showWarning('MSO 처리 오류로 신호 전달에 작업완료가 불가능합니다. 담당자에게 문의하세요.');
            return;
          }

          // 레거시: cfn_SetMsg("I", "Y", "신호전달에 실패하였습니다. 그럼에도 작업을 완료하시겠습니까?")
          const userConfirmed = await showConfirmWarning('신호전달에 실패하였습니다.\n그럼에도 작업을 완료하시겠습니까?');
          if (!userConfirmed) {
            console.log('[CompleteTerminate] 사용자가 신호 실패 후 작업완료 취소');
            return;
          }
          console.log('[CompleteTerminate] 사용자가 신호 실패에도 작업완료 진행 선택');
        } else {
          console.log('[CompleteTerminate] 철거 신호 호출 완료');
        }
      } catch (error) {
        // 네트워크 에러 등 예외 발생 시에도 사용자에게 확인
        console.warn('[CompleteTerminate] 철거 신호 처리 중 오류:', error);
        const userConfirmed = await showConfirmWarning('신호전달에 실패하였습니다.\n그럼에도 작업을 완료하시겠습니까?');
        if (!userConfirmed) {
          return;
        }
      }
      } // end else (non-FTTH)
    }

    // 철거 장비 목록에 필수 필드 매핑 (레거시 mowoa03m02.xml 기준)
    // removalStatus 필드명: EQT_LOSS_YN, PART_LOSS_BRK_YN, EQT_BRK_YN, EQT_CABL_LOSS_YN, EQT_CRDL_LOSS_YN (값: '0' 또는 '1')
    const removalStatus = equipmentData?.removalStatus || {};
    const mappedRemoveEquipmentList = removedEquipments.map((eq: any) => {
      // nested 구조 처리: actualEquipment/contractEquipment가 있으면 그 안의 값 사용
      const actual = eq.actualEquipment || eq;
      const contract = eq.contractEquipment || {};
      const eqtNo = actual.id || eq.EQT_NO || eq.id || '';

      // 여러 키로 removalStatus 조회 시도 (키 불일치 문제 해결)
      const status = removalStatus[eqtNo]
        || removalStatus[eq.id]
        || removalStatus[eq.EQT_NO]
        || removalStatus[actual.id]
        || removalStatus[eq.serialNumber]
        || removalStatus[actual.serialNumber]
        || {};

      // 장비 객체에 이미 값이 있으면 사용, 없으면 removalStatus에서 가져옴
      // 레거시 호환: '0' = 회수, '1' = 분실
      const getYN = (eqVal: any, statusVal: any) =>
        (eqVal === '1' || eqVal === 'Y' || statusVal === '1' || statusVal === 'Y') ? '1' : '0';

      return {
        ...actual,
        // 레거시 필수 필드 매핑 (프론트엔드 → 레거시)
        EQT_NO: eqtNo,
        ITEM_MID_CD: actual.ITEM_MID_CD || actual.itemMidCd || eq.ITEM_MID_CD || eq.itemMidCd || '',
        ITEM_MID_NM: actual.ITEM_MID_NM || actual.type || eq.ITEM_MID_NM || eq.type || '',
        EQT_CL_CD: actual.EQT_CL_CD || actual.eqtClCd || eq.EQT_CL_CD || eq.eqtClCd || '',
        EQT_CL_NM: actual.EQT_CL_NM || actual.model || eq.EQT_CL_NM || eq.model || '',
        EQT_SERNO: actual.EQT_SERNO || actual.serialNumber || eq.EQT_SERNO || eq.serialNumber || '',
        MAC_ADDRESS: eq.macAddress || actual.MAC_ADDRESS || actual.macAddress || eq.MAC_ADDRESS || '',
        // 작업 관련 필드
        CRR_TSK_CL: '02',                    // 철거 하드코딩 (레거시 Line 1095)
        RCPT_ID: order.RCPT_ID || '',
        WRK_ID: order.id || '',
        CUST_ID: eq.CUST_ID || order.customer?.id || '',
        CTRT_ID: eq.CTRT_ID || order.CTRT_ID || '',
        CRR_ID: order.CRR_ID || user.crrId || '01',
        WRKR_ID: workerId,
        REG_UID: workerId,
        // 기타 레거시 필드 (contract 구조도 확인)
        SVC_CMPS_ID: contract.SVC_CMPS_ID || eq.SVC_CMPS_ID || '',
        BASIC_PROD_CMPS_ID: contract.BASIC_PROD_CMPS_ID || eq.BASIC_PROD_CMPS_ID || '',
        EQT_PROD_CMPS_ID: eq.EQT_PROD_CMPS_ID || '',
        PROD_CD: contract.PROD_CD || eq.PROD_CD || '',
        SVC_CD: contract.SVC_CD || eq.SVC_CD || '',
        MST_SO_ID: eq.MST_SO_ID || order.SO_ID || '',
        SO_ID: eq.SO_ID || order.SO_ID || '',
        OLD_LENT_YN: eq.OLD_LENT_YN || 'N',
        LENT_YN: eq.lentYn || eq.LENT_YN || contract.LENT_YN || '10',
        // 분실/파손 상태 (EquipmentTerminate에서 저장한 필드명 사용)
        // 디버그: 분실 상태 확인
        ...(console.log('[CompleteTerminate] 분실상태 매핑:', {
          eqtNo,
          'eq.EQT_LOSS_YN': eq.EQT_LOSS_YN,
          'status.EQT_LOSS_YN': status.EQT_LOSS_YN,
          'status 전체': status,
          'removalStatus 키들': Object.keys(removalStatus),
        }), {}),
        EQT_LOSS_YN: getYN(eq.EQT_LOSS_YN, status.EQT_LOSS_YN),
        PART_LOSS_BRK_YN: getYN(eq.PART_LOSS_BRK_YN, status.PART_LOSS_BRK_YN),
        EQT_BRK_YN: getYN(eq.EQT_BRK_YN, status.EQT_BRK_YN),
        EQT_CABL_LOSS_YN: getYN(eq.EQT_CABL_LOSS_YN, status.EQT_CABL_LOSS_YN),
        EQT_CRDL_LOSS_YN: getYN(eq.EQT_CRDL_LOSS_YN, status.EQT_CRDL_LOSS_YN),
        REUSE_YN: eq.REUSE_YN || status.REUSE_YN || '1',  // 레거시 기본값 '1'
      };
    });

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
        CNFM_CUST_NM: order.customer?.name,
        CNFM_CUST_TELNO: order.customer?.contactNumber || '',
        WRK_ACT_CL: '20',
        NET_CL: installInfoData?.NET_CL || '',
        WRNG_TP: installInfoData?.WRNG_TP || '',
        INSTL_TP: installInfoData?.INSTL_TP || '',
        // 장비철거 플래그 (레거시: EQT_RMV_FLAG)
        EQT_RMV_FLAG: pendingIsEquipmentRemoval ? 'Y' : '',
      },
      equipmentList: [],
      removeEquipmentList: mappedRemoveEquipmentList,
      spendItemList: equipmentData?.spendItems || [],
      agreementList: equipmentData?.agreements || [],
      // 인입선로 정보 (zustand store에서 가져옴)
      poleList: equipmentData?.poleResults || []
    };

    // 디버깅: 전송 데이터 확인
    console.log('[CompleteTerminate] 작업완료 요청 데이터:');
    console.log('  - workInfo:', completeData.workInfo);
    console.log('  - 🔑 modNetInfo 호출 조건 확인:');
    console.log('    - NET_CL:', completeData.workInfo.NET_CL, '(빈값이면 modNetInfo 미호출)');
    console.log('    - INSTL_TP:', completeData.workInfo.INSTL_TP);
    console.log('    - WRNG_TP:', completeData.workInfo.WRNG_TP);
    console.log('    - WRK_ID:', completeData.workInfo.WRK_ID);
    console.log('    - CTRT_ID:', completeData.workInfo.CTRT_ID);
    console.log('    - installInfoData 전체:', installInfoData);
    console.log('  - removeEquipmentList 개수:', mappedRemoveEquipmentList.length);
    if (mappedRemoveEquipmentList.length > 0) {
      console.log('  - removeEquipmentList[0] 전체:', mappedRemoveEquipmentList[0]);
      console.log('  - 원본 장비 데이터[0]:', removedEquipments[0]);
    }

    submitWork(completeData, {
      onSuccess: async (result) => {
        if (result.code === 'SUCCESS' || result.code === 'OK') {
          localStorage.removeItem(getStorageKey());
          (order as any).WRK_STAT_CD = '3';  // 완료 상태로 변경 (재완료 방지)

          // 인입선로 미철거 AS할당 데이터가 있으면 API 호출
          if (pendingASData) {
            try {
              // 1. 인입선로 철거상태 저장 (미철거)
              const removeStatResult = await insertWorkRemoveStat({
                WRK_ID: order.id || (order as any).WRK_ID || '',
                REMOVE_LINE_TP: pendingASData.REMOVE_LINE_TP || '',
                REMOVE_GB: pendingASData.REMOVE_GB || '1',
                REMOVE_STAT: pendingASData.REMOVE_STAT || '',
                REG_UID: pendingASData.REG_UID || workerId,
              });

              if (removeStatResult.code !== 'SUCCESS' && removeStatResult.code !== 'OK') {
                console.error('[WorkCompleteTerminate] 인입선로 철거상태 저장 실패:', removeStatResult.message);
              }

              // 2. AS 접수 생성 (레거시 modAsPdaReceipt.req 파라미터와 동일)
              const asResult = await modAsPdaReceipt({
                CUST_ID: pendingASData.CUST_ID || order.customer?.id || '',
                RCPT_ID: pendingASData.RCPT_ID || '',
                WRK_DTL_TCD: pendingASData.WRK_DTL_TCD || '0380',  // 선로철거(AS할당)
                WRK_RCPT_CL: pendingASData.WRK_RCPT_CL || 'JH',    // CS(전화회수)
                WRK_RCPT_CL_DTL: pendingASData.WRK_RCPT_CL_DTL || '',
                WRK_HOPE_DTTM: pendingASData.WRK_HOPE_DTTM || '',
                MEMO: pendingASData.MEMO || '',
                EMRG_YN: pendingASData.EMRG_YN || 'N',
                HOLY_YN: pendingASData.HOLY_YN || 'N',
                CRR_ID: pendingASData.CRR_ID || '',
                WRKR_ID: pendingASData.WRKR_ID || '',
                REG_UID: pendingASData.REG_UID || workerId,
                // Address fields (from pendingASData)
                POST_ID: pendingASData.POST_ID || '',
                BLD_ID: pendingASData.BLD_ID || '',
                BLD_CL: pendingASData.BLD_CL || '',
                BLD_NM: pendingASData.BLD_NM || '',
                BUN_CL: pendingASData.BUN_CL || '',
                BUN_NO: pendingASData.BUN_NO || '',
                HO_NM: pendingASData.HO_NM || '',
                APT_DONG_NO: pendingASData.APT_DONG_NO || '',
                APT_HO_CNT: pendingASData.APT_HO_CNT || '',
                ADDR: pendingASData.ADDR || '',
                ADDR_DTL: pendingASData.ADDR_DTL || '',
              });

              if (asResult.code === 'SUCCESS' || asResult.code === 'OK') {
                console.log('[WorkCompleteTerminate] AS할당 완료');
              } else {
                console.error('[WorkCompleteTerminate] AS할당 실패:', asResult.message);
              }
            } catch (asError: any) {
              console.error('[WorkCompleteTerminate] AS할당 처리 오류:', asError);
            }
          }

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
      {/* 핫빌 계산 중 전체 화면 스피너 - 다른 조작 차단 */}
      {isHotbillSimulating && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-[9999]"
          onClick={(e) => e.stopPropagation()}
          onTouchStart={(e) => e.stopPropagation()}
        >
          <div className="bg-white rounded-xl p-6 flex flex-col items-center gap-4 shadow-xl">
            <div className="w-12 h-12 border-4 border-primary-500 border-t-transparent rounded-full animate-spin" />
            <p className="text-gray-700 font-medium">핫빌 계산 중...</p>
            <p className="text-gray-500 text-sm">잠시만 기다려주세요</p>
          </div>
        </div>
      )}
      {/* 작업완료 처리 중 전체 화면 스피너 */}
      {isLoading && (
        <div className="fixed inset-0 bg-black/50 z-[9999] flex items-center justify-center">
          <div className="bg-white rounded-xl p-6 flex flex-col items-center gap-3 shadow-xl">
            <svg className="animate-spin h-10 w-10 text-primary-700" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
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
            {/* 결합계약 */}
            <div>
              <label className="block text-xs sm:text-sm font-semibold text-gray-900 mb-1.5 sm:mb-2">
                결합계약
              </label>
              <input
                type="text"
                value=""
                readOnly
                disabled
                className="w-full min-h-10 sm:min-h-12 px-3 sm:px-4 py-2 sm:py-3 bg-gray-100 border border-gray-200 rounded-lg text-sm sm:text-base text-gray-600 cursor-not-allowed"
              />
            </div>

            {/* 망구분 + 철거정보 버튼 */}
            <div id="field-installInfo">
              <label className="block text-xs sm:text-sm font-semibold text-gray-900 mb-1.5 sm:mb-2">
                망구분
              </label>
              <div className="flex gap-1.5 sm:gap-2">
                <input
                  type="text"
                  value={networkTypeName || ''}
                  readOnly
                  disabled
                  placeholder="철거정보에서 입력"
                  className="flex-1 min-w-0 min-h-10 sm:min-h-12 px-3 sm:px-4 py-2 sm:py-3 bg-gray-100 border border-gray-200 rounded-lg text-sm sm:text-base text-gray-600 cursor-not-allowed truncate"
                />
                <button
                  type="button"
                  onClick={() => setShowInstallInfoModal(true)}
                  className={`min-h-10 sm:min-h-12 px-3 sm:px-4 py-2 sm:py-3 text-xs sm:text-sm font-semibold rounded-lg transition-colors whitespace-nowrap flex-shrink-0 ${
                    isWorkCompleted ? 'bg-gray-500 hover:bg-gray-600 text-white' : 'bg-green-500 hover:bg-green-600 text-white'
                  }`}
                >
                  {isWorkCompleted ? '보기' : '철거정보'}
                </button>
              </div>
            </div>

            {/* 고객관계 */}
            <div id="field-custRel">
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
                className={`w-full px-3 sm:px-4 py-2 sm:py-3 border border-gray-300 rounded-lg text-sm sm:text-base resize-none ${
                  isWorkCompleted ? 'bg-gray-100 text-gray-600 cursor-not-allowed' : 'focus:ring-2 focus:ring-primary-500 focus:border-primary-500'
                }`}
                rows={4}
                readOnly={isWorkCompleted}
                disabled={isWorkCompleted}
              />
              {!isWorkCompleted && (
                <p className={`text-xs text-right mt-1 ${memo.length >= 500 ? 'text-red-500' : 'text-gray-400'}`}>{memo.length}/500</p>
              )}
            </div>

            {/* 작업처리일 */}
            <div id="field-workDate">
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

            {/* 해지요금 (토글 섹션) */}
            <HotbillSection
              custId={order.customer?.id || ''}
              rcptId={order.RCPT_ID || ''}
              ctrtId={order.CTRT_ID || ''}
              soId={order.SO_ID || ''}
              termHopeDt={(order as any).TERM_HOPE_DT || (order as any).HOPE_DT || ''}
              wrkCd={order.WRK_CD || '02'}
              wrkStatCd={wrkStatCd}
              showToast={showToast}
              onHotbillConfirmChange={setIsHotbillConfirmed}
              onSimulatingChange={setIsHotbillSimulating}
              readOnly={isWorkCompleted}
            />

            {/* 인입선로 철거관리 (토글 섹션) - 조건: KPI_PROD_GRP_CD in C,D,I */}
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
              {/* 장비철거 버튼 (레거시: btn_eqt_rmv) - 모든 철거 작업에서 표시 */}
              {!isWorkCompleted && (
                <button
                  onClick={() => handleEquipmentRemoval()}
                  disabled={isLoading || !isEquipmentRemovalEnabled}
                  className={`flex-1 min-h-12 py-3 px-4 rounded-lg font-bold text-sm sm:text-base flex items-center justify-center gap-2 transition-colors ${
                    isEquipmentRemovalEnabled
                      ? 'bg-orange-500 hover:bg-orange-600 text-white'
                      : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                  }`}
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                  <span>장비철거</span>
                </button>
              )}

              {/* 작업완료 버튼 (레거시: btn_save) - 모든 철거 작업에서 표시 */}
              {!isWorkCompleted && (
                <button
                  onClick={() => handleSubmit(false)}
                  disabled={isLoading || !isSaveButtonEnabled}
                  className={`flex-1 min-h-12 py-3 px-4 rounded-lg font-bold text-sm sm:text-base flex items-center justify-center gap-2 transition-colors ${
                    isSaveButtonEnabled
                      ? 'bg-primary-500 hover:bg-primary-600 text-white'
                      : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                  }`}
                >
                  {isLoading ? (
                    <>
                      <svg className="animate-spin h-5 w-5 text-white" fill="none" viewBox="0 0 24 24">
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

            </div>

          </div>
        </div>
      </div>

      {/* 설치정보 모달 (철거정보로 사용) */}
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
        addrOrd={order.ADDR_ORD || (order as any).addrOrd || ''}
        kpiProdGrpCd={(order as any).KPI_PROD_GRP_CD || ''}
        prodChgGb={(order as any).PROD_CHG_GB || ''}
        chgKpiProdGrpCd={(order as any).CHG_KPI_PROD_GRP_CD || ''}
        prodGrp={(order as any).PROD_GRP || ''}
        wrkDtlTcd={order.WRK_DTL_TCD || ''}
        soId={order.SO_ID || ''}
        readOnly={isWorkCompleted}
        isCertifyProd={useCertifyStore.getState().isCertifyProd}
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
        addressInfo={{
          POST_ID: (order as any).POST_ID || '',
          BLD_ID: (order as any).BLD_ID || '',
          BLD_CL: (order as any).BLD_CL || '',
          BLD_NM: (order as any).BLD_NM || '',
          BUN_CL: (order as any).BUN_CL || '',
          BUN_NO: (order as any).BUN_NO || '',
          HO_NM: (order as any).HO_NM || '',
          APT_DONG_NO: (order as any).APT_DONG_NO || '',
          APT_HO_CNT: (order as any).APT_HO_CNT || '',
          ADDR: (order as any).ADDR_TOTAL || (order as any).ADDR || order.address || '',
          ADDR_DTL: (order as any).ADDR_DTL || '',
        }}
      />

      {/* 작업완료 확인 모달 */}
      <ConfirmModal
        isOpen={showConfirmModal}
        onClose={() => setShowConfirmModal(false)}
        onConfirm={handleConfirmSubmit}
        title={pendingIsEquipmentRemoval ? '장비 철거' : '작업 완료'}
        message={confirmMessage}
        type="confirm"
        confirmText={pendingIsEquipmentRemoval ? '철거' : '완료'}
        cancelText="취소"
      >
        <WorkCompleteSummary
          workType="02"
          workTypeName={pendingIsEquipmentRemoval ? '장비철거' : '철거'}
          custRel={custRel}
          custRelName={custRelOptions.find(o => o.value === custRel)?.label}
          networkType={networkType}
          networkTypeName={networkTypeName}
          installType={installInfoData?.INSTL_TP}
          installTypeName={installInfoData?.INSTL_TP_NM}
          removedEquipments={equipmentData?.removedEquipments || []}
          memo={memo}
        />
      </ConfirmModal>

      {/* 신호 실패 등 경고 모달 (확인만) */}
      {warningModal && (
        <ConfirmModal
          isOpen={true}
          message={warningModal.message}
          type="warning"
          showCancel={false}
          confirmText="확인"
          onConfirm={() => { warningModal.resolve(); setWarningModal(null); }}
          onClose={() => { warningModal.resolve(); setWarningModal(null); }}
        />
      )}

      {/* 신호 실패 시 계속 진행 여부 확인 모달 */}
      {confirmWarningModal && (
        <ConfirmModal
          isOpen={true}
          message={confirmWarningModal.message}
          type="warning"
          showCancel={true}
          confirmText="계속 진행"
          cancelText="취소"
          onConfirm={() => { confirmWarningModal.resolve(true); setConfirmWarningModal(null); }}
          onClose={() => { confirmWarningModal.resolve(false); setConfirmWarningModal(null); }}
        />
      )}

    </div>
  );
};

export default CompleteTerminateForm;
