import React, { useState, useEffect, useMemo } from 'react';
import { WorkItem, WorkOrder } from '../../../types';
import ContractInfo from './ContractInfo';
import ReceptionInfo from './ReceptionInfo';
import WorkEquipmentManagement from './WorkEquipmentManagement';
import LineRegistration from './LineRegistration';
import WorkCompleteRouter, { getWorkTypeName } from './complete';
import PostProcess from './postprocess';
import { getTechnicianEquipments, getCommonCodes, getWorkCancelInfo } from '../../../services/apiService';
import { useWorkProcessStore } from '../../../stores/workProcessStore';
import { useCertifyDetection } from '../../../hooks/useCertifyDetection';
import { useWorkEquipmentStore } from '../../../stores/workEquipmentStore';
import { useCertifyStore } from '../../../stores/certifyStore';
import { Check, ArrowLeft, ArrowRight } from 'lucide-react';
import './WorkProcessFlow.css';

interface WorkProcessFlowProps {
  workItem: WorkItem;
  onComplete: () => void;
  onBack: () => void;
  showToast?: (message: string, type: 'success' | 'error' | 'warning' | 'info') => void;
}

type ProcessStep = 1 | 2 | 3 | 4 | 5 | 6;

const WorkProcessFlow: React.FC<WorkProcessFlowProps> = ({ workItem, onComplete, onBack, showToast }) => {
  // 작업 완료 여부 확인 (WRK_STAT_CD: '3'=작업완료, '4'=후처리완료, '7'=기타완료)
  const isWorkCompleted = workItem.WRK_STAT_CD === '3' || workItem.WRK_STAT_CD === '4' || workItem.WRK_STAT_CD === '7' || workItem.status === '완료';

  // 편집 가능 여부 (레거시: WRK_STAT_CD가 '1' 또는 '2'일 때만 편집 가능)
  const isEditable = workItem.WRK_STAT_CD === '1' || workItem.WRK_STAT_CD === '2';

  // Work Process Store 사용 (Zustand)
  const { currentStep, setCurrentStep, setCurrentWorkId, equipmentData, setEquipmentData, filteringData, setFilteringData } = useWorkProcessStore();

  // 장비 API 데이터 (미리 로드) - 로컬 상태로 유지
  const [preloadedEquipmentApiData, setPreloadedEquipmentApiData] = useState<any>(null);

  // FTTH/LGU+ 인증상품 감지 (useCertifyDetection 훅)
  const { isCertifyProd, certifyOpLnkdCd, isLoaded: isFtthCheckLoaded } = useCertifyDetection({
    prodCd: workItem.PROD_CD || '',
    soId: workItem.SO_ID || '',
    isCertifyProdField: workItem.IS_CERTIFY_PROD,
  });

  // 작업 진행 화면 진입 시: 현재 작업 ID 설정 + 스크롤 맨 위로 초기화
  useEffect(() => {
    // 작업 ID 설정 → 해당 작업의 저장된 step으로 복원됨
    setCurrentWorkId(workItem.id);

    // 모바일 환경 스크롤 초기화 (여러 방법 시도)
    const forceScrollToTop = () => {
      window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
      document.documentElement.scrollTop = 0;
      document.body.scrollTop = 0;
    };

    // 즉시 실행
    forceScrollToTop();
    // 렌더링 완료 후
    requestAnimationFrame(() => {
      forceScrollToTop();
    });
    // 약간의 딜레이 후 (컨텐츠 로딩 완료 대응)
    setTimeout(() => {
      forceScrollToTop();
    }, 50);

  }, [workItem.id, setCurrentWorkId]);

  // 원스톱(OST) 작업 체크 - 설치(01), 철거(02)만 해당
  useEffect(() => {
    const checkOstStatus = async () => {
      // 설치(01), 철거(02)만 OST 체크
      if (workItem.WRK_CD !== '01' && workItem.WRK_CD !== '02') return;
      // 완료된 작업은 체크 안함
      if (isWorkCompleted) return;

      try {
        const cancelInfo = await getWorkCancelInfo({
          WRK_ID: workItem.id,
          RCPT_ID: workItem.RCPT_ID,
          CUST_ID: workItem.customer?.id || workItem.CUST_ID
        });

        if (cancelInfo) {
          const stat = cancelInfo.OST_WORKABLE_STAT || '';
          // OST 차단 시 토스트 메시지 (persistent: X 버튼으로만 닫힘)
          if (stat === '0' || stat === '1' || stat === '4') {
            const msg = workItem.WRK_CD === '01'
              ? '원스톱전환신청건으로 설치완료 작업은 불가능한 상태입니다.'
              : '원스톱전환해지건으로 철거완료 작업은 불가능한 상태입니다.';
            showToast?.(msg, 'warning', true);
          }
        }
      } catch (error) {
        console.error('[WorkProcessFlow] OST 상태 조회 실패:', error);
      }
    };

    checkOstStatus();
  }, [workItem.id, workItem.WRK_CD, workItem.RCPT_ID, workItem.customer?.id, workItem.CUST_ID, isWorkCompleted, showToast]);


  // 작업 시작 시 장비 데이터 + 필터링 데이터 미리 로드 (3단계 진입 전에!)
  useEffect(() => {
    const loadEquipmentApiData = async () => {
      // 상품변경(05) 작업은 DTL_CTRT_ID 사용, 그 외는 CTRT_ID 사용
      const ctrtIdToUse = workItem.WRK_CD === '05'
        ? (workItem.DTL_CTRT_ID || workItem.CTRT_ID)
        : workItem.CTRT_ID;

      // 비가입자 AS 등 CTRT_ID가 없어도 장비 프리로드 실행 (기사장비, 필터링 데이터 필요)
      try {
        const userInfo = localStorage.getItem('userInfo');
        const user = userInfo ? JSON.parse(userInfo) : {};

        console.log('[WorkProcessFlow] 장비 프리로드 - WRK_CD:', workItem.WRK_CD, 'CTRT_ID:', ctrtIdToUse || '(없음)');

        const response = await getTechnicianEquipments({
          WRKR_ID: user.workerId || 'A20130708',
          SO_ID: workItem.SO_ID || user.soId,
          WRK_ID: workItem.id,  // 레거시와 동일하게 WRK_ID 사용
          CUST_ID: workItem.customer?.id || workItem.CUST_ID,
          RCPT_ID: workItem.RCPT_ID || null,
          CTRT_ID: ctrtIdToUse || '',
          OLD_CTRT_ID: workItem.WRK_CD === '05' ? workItem.CTRT_ID : null,  // 상품변경용
          CRR_ID: workItem.CRR_ID || null,
          ADDR_ORD: workItem.ADDR_ORD || null,
          CRR_TSK_CL: workItem.WRK_CD || '',
          WRK_DTL_TCD: workItem.WRK_DTL_TCD || '',
          WRK_CD: workItem.WRK_CD || null,
          WRK_STAT_CD: workItem.WRK_STAT_CD || null,
          WRK_DRCTN_ID: workItem.WRK_DRCTN_ID || workItem.directionId || null,
          BLD_ID: workItem.BLD_ID || null,
          PROD_CD: workItem.PROD_CD || null,
        });

        // 필터링 데이터 추출 (prodPromoInfo 포함 - FTTH CL-04 ADD_ON 파라미터용)
        const filtering = {
          kpiProdGrpCd: response.kpiProdGrpCd,
          prodChgGb: response.prodChgGb,
          chgKpiProdGrpCd: response.chgKpiProdGrpCd,
          prodGrp: response.prodGrp,
          upCtrlCl: response.upCtrlCl,
          prodPromoInfo: response.prodPromoInfo || [],  // 부가서비스 정보 (FTTH CL-04 ADD_ON용)
        };

        // 전체 API response 저장 (3단계에서 재사용)
        setPreloadedEquipmentApiData(response);
        setFilteringData(filtering);

        // 설치 작업에서도 prodPromoInfo가 equipmentData에 저장되도록
        // (철거 작업이 아닌 경우에도 FTTH 부가서비스 정보 필요)
        const isRemovalWorkType = ['02', '08', '09'].includes(workItem.WRK_CD || '');
        if (!isRemovalWorkType) {
          setEquipmentData({
            installedEquipments: [],
            removedEquipments: [],
            prodPromoInfo: response.prodPromoInfo || [],
            ...filtering
          });
          console.log('[WorkProcessFlow] 설치 작업 - prodPromoInfo 저장:', (response.prodPromoInfo || []).length, '개');
        }

        // 철거 작업(WRK_CD=02,08,09): API 응답의 회수 장비를 Store에 자동 저장
        // 3단계를 건너뛰어도 4단계에서 철거 신호 전송이 가능하도록
        const isRemovalWork = ['02', '08', '09'].includes(workItem.WRK_CD || '');
        if (isRemovalWork) {
          // API 응답을 Complete 컴포넌트에서 사용할 수 있는 형태로 변환
          const userInfo2 = localStorage.getItem('userInfo');
          const user2 = userInfo2 ? JSON.parse(userInfo2) : {};

          const removals = (response.removedEquipments || []).map((eq: any) => ({
            // 기본 필드
            id: eq.EQT_NO,
            type: eq.ITEM_MID_NM,
            model: eq.EQT_CL_NM,
            serialNumber: eq.EQT_SERNO,
            itemMidCd: eq.ITEM_MID_CD,
            eqtClCd: eq.EQT_CL_CD || eq.EQT_CL,
            macAddress: eq.MAC_ADDRESS || eq.MAC_ADDR,

            // 레거시 시스템 필수 필드
            CUST_ID: workItem.customer?.id || workItem.CUST_ID,
            CTRT_ID: workItem.CTRT_ID,
            EQT_NO: eq.EQT_NO,
            ITEM_CD: eq.ITEM_CD || '',
            EQT_SERNO: eq.EQT_SERNO,
            WRK_ID: workItem.id,
            WRK_CD: workItem.WRK_CD,
            // 장비분실처리 필수 필드 (TCMCT_EQT_LOSS_INFO.EQT_CL)
            EQT_CL: eq.EQT_CL || eq.EQT_CL_CD || '',
            EQT_CL_CD: eq.EQT_CL_CD || eq.EQT_CL || '',
            ITEM_MID_CD: eq.ITEM_MID_CD || '',

            // 기타 필드
            SVC_CMPS_ID: eq.SVC_CMPS_ID || '',
            BASIC_PROD_CMPS_ID: eq.BASIC_PROD_CMPS_ID || '',
            MST_SO_ID: eq.MST_SO_ID || workItem.SO_ID || user2.soId,
            SO_ID: eq.SO_ID || workItem.SO_ID || user2.soId,
            REG_UID: user2.userId || user2.workerId || 'A20230019',

            // 분실 상태 기본값 (3단계에서 수정 가능)
            EQT_LOSS_YN: '0',
            PART_LOSS_BRK_YN: '0',
            EQT_BRK_YN: '0',
            EQT_CABL_LOSS_YN: '0',
            EQT_CRDL_LOSS_YN: '0',
          }));

          setEquipmentData({
            installedEquipments: [],
            removedEquipments: removals,
            prodPromoInfo: response.prodPromoInfo || [],  // 부가서비스 정보
            ...filtering
          });
          console.log('[WorkProcessFlow] 철거 장비 자동 저장:', removals.length, '개, prodPromoInfo:', (response.prodPromoInfo || []).length, '개');
        }
      } catch (error) {
        console.error('장비 API Pre-loading 실패:', error);
      }
    };

    loadEquipmentApiData();
  }, [workItem.id]); // workItem.id가 변경될 때마다 실행

  // Zustand persist가 자동으로 localStorage에 저장
  // 별도의 세션 저장 로직 불필요

  // 3단계에서 장비 데이터 로드하는 함수 (동기적으로 데이터 반환)
  const loadEquipmentDataFromStorage = (): any => {
    // 이미 Store에 장비 데이터가 있으면 그대로 사용 (철거 작업 등에서 EquipmentTerminate가 저장한 데이터)
    if (equipmentData?.installedEquipments?.length > 0 || equipmentData?.removedEquipments?.length > 0) {
      console.log('[WorkProcessFlow] Store에 이미 장비 데이터 있음 - 유지');
      return equipmentData;
    }

    const storageKey = `equipment_draft_${workItem.id}`;
    const savedDraft = localStorage.getItem(storageKey);

    if (savedDraft) {
      try {
        const draftData = JSON.parse(savedDraft);

        // 설치 장비 또는 철거 장비가 있으면 데이터 반환
        const hasInstalled = draftData.installedEquipments && draftData.installedEquipments.length > 0;
        const hasRemoved = draftData.markedForRemoval && draftData.markedForRemoval.length > 0;

        if (hasInstalled || hasRemoved) {
          const userInfo = localStorage.getItem('userInfo');
          const user = userInfo ? JSON.parse(userInfo) : {};

          // 상품변경(05) 작업용 CTRT_ID
          const ctrtIdForProductChange = workItem.DTL_CTRT_ID || workItem.CTRT_ID;

          // markedForRemoval을 removedEquipments 형식으로 변환 (상품변경 필수 필드 추가)
          const removedEquipments = (draftData.markedForRemoval || []).map((eq: any) => {
            const status = draftData.removalStatus?.[eq.id] || {};
            return {
              ...eq,
              id: eq.id,
              type: eq.type,
              model: eq.model,
              serialNumber: eq.serialNumber,
              itemMidCd: eq.itemMidCd,
              EQT_NO: eq.id,
              EQT_SERNO: eq.serialNumber,
              ITEM_MID_CD: eq.itemMidCd,
              EQT_CL_CD: eq.eqtClCd,
              MAC_ADDRESS: eq.macAddress,
              WRK_ID: workItem.id,
              CUST_ID: workItem.customer?.id || workItem.CUST_ID,
              CTRT_ID: ctrtIdForProductChange,
              WRK_CD: workItem.WRK_CD,
              // 상품변경(05) 필수 필드
              CHG_YN: workItem.WRK_CD === '05' ? 'Y' : undefined,
              SVC_CMPS_ID: eq.SVC_CMPS_ID || '',
              BASIC_PROD_CMPS_ID: eq.BASIC_PROD_CMPS_ID || '',
              MST_SO_ID: eq.MST_SO_ID || workItem.SO_ID || user.soId,
              SO_ID: eq.SO_ID || workItem.SO_ID || user.soId,
              REG_UID: user.userId || user.workerId || 'A20230019',
              // 분실/파손 상태
              EQT_LOSS_YN: status.EQT_LOSS_YN || '0',
              PART_LOSS_BRK_YN: status.PART_LOSS_BRK_YN || '0',
              EQT_BRK_YN: status.EQT_BRK_YN || '0',
              EQT_CABL_LOSS_YN: status.EQT_CABL_LOSS_YN || '0',
              EQT_CRDL_LOSS_YN: status.EQT_CRDL_LOSS_YN || '0',
            };
          });

          // installedEquipments를 백엔드 형식으로 변환 (필수 필드 추가)
          const installedEquipments = (draftData.installedEquipments || []).map((eq: any) => {
            const actual = eq.actualEquipment || {};
            const contract = eq.contractEquipment || {};

            return {
              actualEquipment: {
                ...actual,
                id: actual.id,
                type: actual.type,
                model: actual.model,
                serialNumber: actual.serialNumber,
                itemMidCd: actual.itemMidCd,
                eqtClCd: actual.eqtClCd,
                macAddress: eq.macAddress || actual.macAddress,
                // 상품변경: actualEquipment에 없으면 contractEquipment에서 가져옴
                BASIC_PROD_CMPS_ID: actual.BASIC_PROD_CMPS_ID || contract.BASIC_PROD_CMPS_ID || '',
                EQT_PROD_CMPS_ID: actual.EQT_PROD_CMPS_ID || contract.SVC_CMPS_ID || contract.id,
                PROD_CD: actual.PROD_CD || contract.PROD_CD || workItem.PROD_CD,
                SVC_CD: actual.SVC_CD || contract.SVC_CD || '',
                SVC_CMPS_ID: actual.SVC_CMPS_ID || contract.SVC_CMPS_ID || contract.id,
                EQT_SALE_AMT: actual.EQT_SALE_AMT || '0',
                MST_SO_ID: actual.MST_SO_ID || workItem.SO_ID || user.soId,
                SO_ID: actual.SO_ID || workItem.SO_ID || user.soId,
                OLD_LENT_YN: actual.OLD_LENT_YN || 'N',
                LENT: actual.LENT || '10',
                ITLLMT_PRD: actual.ITLLMT_PRD || '00',
                EQT_USE_STAT_CD: actual.EQT_USE_STAT_CD || '1',
                EQT_CHG_GB: actual.EQT_CHG_GB || '1',
                IF_DTL_ID: actual.IF_DTL_ID || '',
              },
              contractEquipment: {
                ...contract,
                id: contract.id,
                SVC_CMPS_ID: contract.SVC_CMPS_ID || contract.id,
                BASIC_PROD_CMPS_ID: contract.BASIC_PROD_CMPS_ID || '',
                PROD_CD: contract.PROD_CD || '',
                SVC_CD: contract.SVC_CD || '',
              },
              macAddress: eq.macAddress || actual.macAddress,
            };
          });

          const loadedData = {
            installedEquipments: installedEquipments,
            removedEquipments: removedEquipments,
            kpiProdGrpCd: filteringData?.kpiProdGrpCd || draftData.kpiProdGrpCd,
            prodChgGb: filteringData?.prodChgGb || draftData.prodChgGb,
            chgKpiProdGrpCd: filteringData?.chgKpiProdGrpCd || draftData.chgKpiProdGrpCd,
            prodGrp: filteringData?.prodGrp || draftData.prodGrp,
            upCtrlCl: filteringData?.upCtrlCl || draftData.upCtrlCl,
          };
          console.log('[WorkProcessFlow] localStorage에서 장비 데이터 로드:', {
            installed: loadedData.installedEquipments.length,
            removed: loadedData.removedEquipments.length,
            첫번째장비_PROD_CD: installedEquipments[0]?.actualEquipment?.PROD_CD,
            첫번째장비_SVC_CMPS_ID: installedEquipments[0]?.actualEquipment?.SVC_CMPS_ID,
          });
          return loadedData;
        }
      } catch (error) {
        console.error('장비 데이터 로드 실패:', error);
      }
    }

    // localStorage에도 없으면 null 반환 (Store 데이터 덮어쓰지 않음)
    return null;
  };

  // 작업유형명 (헤더에 표시)
  const workTypeName = getWorkTypeName(workItem.WRK_CD || '');

  // 작업완료 상태에서는 집선정보가 저장되지 않으므로 4단계로 표시
  // 이전철거(08), 일반철거(02)는 레거시에 집선등록 탭 없음 (CL-06은 작업완료 내부에서 자동 호출)
  const wrkCd = workItem.WRK_CD || '';
  const showLineRegistration = isCertifyProd && !isWorkCompleted && wrkCd !== '08' && wrkCd !== '02';

  // 총 스텝 수 (FTTH 진행중: 6단계, 일반: 5단계)
  // 일반: 계약→접수→장비→작업완료→후처리
  // FTTH: 계약→접수→장비→집선등록→작업완료→후처리
  const totalSteps = showLineRegistration ? 6 : 5;

  // 동적 스텝 구성

  const steps = useMemo(() => {
    if (showLineRegistration) {
      // FTTH 6단계 (작업 진행 중)
      return [
        { id: 1, title: '계약 정보', completed: isWorkCompleted || currentStep > 1 },
        { id: 2, title: '접수 정보', completed: isWorkCompleted || currentStep > 2 },
        { id: 3, title: '장비 정보', completed: isWorkCompleted || currentStep > 3 },
        { id: 4, title: '집선 등록', completed: isWorkCompleted || currentStep > 4 },
        { id: 5, title: '작업 완료', completed: isWorkCompleted || currentStep > 5 },
        { id: 6, title: '후처리', completed: currentStep > 6 },
      ];
    } else {
      // 일반 5단계 또는 FTTH 완료 조회 시
      return [
        { id: 1, title: '계약 정보', completed: isWorkCompleted || currentStep > 1 },
        { id: 2, title: '접수 정보', completed: isWorkCompleted || currentStep > 2 },
        { id: 3, title: '장비 정보', completed: isWorkCompleted || currentStep > 3 },
        { id: 4, title: '작업 완료', completed: isWorkCompleted || currentStep > 4 },
        { id: 5, title: '후처리', completed: currentStep > 5 },
      ];
    }
  }, [showLineRegistration, isWorkCompleted, currentStep]);

  // FTTH 6단계 → 완료 후 5단계 전환 시 currentStep이 totalSteps 초과하지 않도록 보정
  useEffect(() => {
    if (currentStep > totalSteps) {
      setCurrentStep(totalSteps as ProcessStep);
    }
  }, [currentStep, totalSteps]);

  // 스크롤을 맨 위로 이동 (모바일 환경)
  const scrollToTop = () => {
    window.scrollTo(0, 0);
    document.documentElement.scrollTop = 0;
    document.body.scrollTop = 0;
  };

  // FTTH 장비 등록 검증 함수 (공통으로 사용)
  const validateFtthEquipment = (): boolean => {
    if (!isCertifyProd) return true;

    const equipmentStoreState = useWorkEquipmentStore.getState().getWorkState(workItem.id);
    const installedEquipments = equipmentStoreState?.installedEquipments || [];
    const contractEquipments = equipmentStoreState?.contractEquipments || [];

    console.log('[FTTH 검증] 계약장비:', contractEquipments.length, '개 | 등록장비:', installedEquipments.length, '개');

    // 장비가 하나도 등록되지 않은 경우 집선등록 진행 불가
    if (installedEquipments.length === 0) {
      showToast?.('장비를 먼저 등록해주세요.', 'error');
      return false;
    }

    // 계약장비 중 등록 안 된 것 찾기 (레거시: 고객장비에 {장비명}가 누락되어 있습니다)
    for (const contract of contractEquipments) {
      const isRegistered = installedEquipments.some((eq: any) =>
        eq.contractEquipment?.id === contract.id
      );
      if (!isRegistered) {
        const eqtName = contract.type || contract.EQT_CL_NM || 'ONT-PON모뎀';
        showToast?.(`고객장비에 ${eqtName}가 누락되어 있습니다.`, 'error');
        return false;
      }
    }

    console.log('[FTTH 검증] 통과 - 모든 장비 등록됨');
    return true;
  };

  /**
   * 인증상품 단계 이동 가드
   * - Step 3→4 (장비→집선): 와이드(N/NG)이면 LDAP 완료 필수
   * - Step 4→5 (집선→작업완료): CL-03 집선조회 완료 필수
   */
  const validateCertifyStepGuard = (targetStep: number): boolean => {
    if (!showLineRegistration) return true;

    const certifyState = useCertifyStore.getState();
    const isWide = ['N', 'NG'].includes(certifyOpLnkdCd);

    // Step 4(집선등록) 이상으로 이동: 와이드이면 LDAP 필수
    if (targetStep >= 4 && isWide && !certifyState.ldapResult) {
      showToast?.('LDAP 연동을 먼저 완료해주세요.', 'warning');
      return false;
    }

    // Step 5(작업완료) 이상으로 이동: 집선조회(CL-03) 완료 필수
    if (targetStep >= 5 && !certifyState.certifyRegconfInfo) {
      showToast?.('집선등록을 먼저 완료해주세요.', 'warning');
      return false;
    }

    return true;
  };

  const handleNext = (skipEquipmentLoad = false) => {
    if (currentStep < totalSteps) {
      // FTTH 작업 진행 중: 4단계(집선등록) 이상으로 이동 시 장비 등록 체크
      // 어느 단계에서든 4단계 이상으로 가려면 장비 등록이 필요함
      const nextStep = currentStep + 1;
      if (showLineRegistration && nextStep >= 4) {
        if (!validateFtthEquipment()) {
          return;
        }
        if (!validateCertifyStepGuard(nextStep)) {
          return;
        }
      }

      // 3단계에서 벗어날 때 장비 데이터 먼저 로드하고 상태 설정
      // skipEquipmentLoad=true면 이미 저장된 데이터 사용 (handleEquipmentSave에서 호출 시)
      if (currentStep === 3 && !skipEquipmentLoad) {
        const data = loadEquipmentDataFromStorage();
        if (data) {
          setEquipmentData(data);
        }
      }

      // 3→4 (또는 3→5 FTTH) 전환 시 장비 스토어 상태 디버그 로깅
      if (currentStep === 3) {
        // useWorkEquipmentStore에서 직접 데이터 가져오기
        const equipmentStoreState = useWorkEquipmentStore.getState().getWorkState(workItem.id);

        // 분실 여부 판별 함수
        const isLostEquipment = (status: any) => {
          if (!status) return false;
          return status.EQT_LOSS_YN === 'Y' || status.EQT_LOSS_YN === '1' ||
                 status.PART_LOSS_BRK_YN === 'Y' || status.PART_LOSS_BRK_YN === '1' ||
                 status.EQT_BRK_YN === 'Y' || status.EQT_BRK_YN === '1' ||
                 status.EQT_CABL_LOSS_YN === 'Y' || status.EQT_CABL_LOSS_YN === '1' ||
                 status.EQT_CRDL_LOSS_YN === 'Y' || status.EQT_CRDL_LOSS_YN === '1';
        };

        // 분실 항목 상세
        const getLossDetails = (status: any) => {
          if (!status) return '';
          const items = [];
          if (status.EQT_LOSS_YN === 'Y' || status.EQT_LOSS_YN === '1') items.push('장비');
          if (status.PART_LOSS_BRK_YN === 'Y' || status.PART_LOSS_BRK_YN === '1') items.push('아답터');
          if (status.EQT_BRK_YN === 'Y' || status.EQT_BRK_YN === '1') items.push('리모콘');
          if (status.EQT_CABL_LOSS_YN === 'Y' || status.EQT_CABL_LOSS_YN === '1') items.push('케이블');
          if (status.EQT_CRDL_LOSS_YN === 'Y' || status.EQT_CRDL_LOSS_YN === '1') items.push('크래들');
          return items.length > 0 ? items.join(', ') : '';
        };

        console.log('═══════════════════════════════════════════════════════════');
        console.log('📦 [Step 3→4] 장비 스토어 상태 (workEquipmentStore)');
        console.log('═══════════════════════════════════════════════════════════');
        console.log('📥 설치장비 (installedEquipments):', equipmentStoreState?.installedEquipments?.length || 0, '건');
        equipmentStoreState?.installedEquipments?.forEach((eq: any, i: number) => {
          const actual = eq.actualEquipment || {};
          const contract = eq.contractEquipment || {};
          console.log(`  [${i}] ${contract.type || actual.type || '장비'} | 모델: ${actual.model || '-'} | S/N: ${actual.serialNumber || '-'}`);
        });
        console.log('───────────────────────────────────────────────────────────');
        console.log('📤 회수장비 (markedForRemoval):', equipmentStoreState?.markedForRemoval?.length || 0, '건');
        equipmentStoreState?.markedForRemoval?.forEach((eq: any, i: number) => {
          const eqKey = eq.id || eq.EQT_NO;
          const status = equipmentStoreState?.removalStatus?.[eqKey] || {};
          const isLost = isLostEquipment(status);
          const lossDetail = getLossDetails(status);
          const statusText = isLost ? `🔴 분실 (${lossDetail})` : '🟢 회수';
          console.log(`  [${i}] ${eq.type || eq.ITEM_MID_NM || '장비'} | 모델: ${eq.model || '-'} | S/N: ${eq.serialNumber || '-'} → ${statusText}`);
        });
        console.log('───────────────────────────────────────────────────────────');
        console.log('📤 철거장비 (removeEquipments - API):', equipmentStoreState?.removeEquipments?.length || 0, '건');
        console.log('───────────────────────────────────────────────────────────');
        console.log('🔑 removalStatus 저장된 키:');
        const removalStatusKeys = Object.keys(equipmentStoreState?.removalStatus || {});
        if (removalStatusKeys.length > 0) {
          removalStatusKeys.forEach(key => {
            const s = equipmentStoreState?.removalStatus?.[key];
            const isLost = isLostEquipment(s);
            console.log(`  "${key}" → ${isLost ? '분실' : '회수'}`, s);
          });
        } else {
          console.log('  (없음 - 기본 회수처리)');
        }
        console.log('═══════════════════════════════════════════════════════════');
      }

      // React 18은 자동으로 배치 처리하므로 equipmentData와 currentStep이 함께 업데이트됨
      setCurrentStep((prev) => (prev + 1) as ProcessStep);
      // 단계 변경 시 스크롤 맨 위로
      requestAnimationFrame(() => scrollToTop());
    }
  };

  const handlePrevious = () => {
    if (currentStep > 1) {
      setCurrentStep((prev) => (prev - 1) as ProcessStep);
      // 단계 변경 시 스크롤 맨 위로
      requestAnimationFrame(() => scrollToTop());
    }
    // 첫 단계에서는 아무 동작도 하지 않음 (목록 버튼과 구분)
  };

  const stepNames = showLineRegistration
    ? ['계약정보', '접수정보', '장비정보', '집선등록', '작업완료']
    : ['계약정보', '접수정보', '장비정보', '작업완료'];

  const handleStepClick = (stepId: ProcessStep) => {
    // FTTH 작업 진행 중: 4단계(집선등록) 이상으로 이동 시 장비 등록 체크
    // 어느 단계에서든 4단계 이상으로 가려면 장비 등록이 필요함
    if (showLineRegistration && stepId >= 4) {
      if (!validateFtthEquipment()) {
        return;
      }
      if (!validateCertifyStepGuard(stepId)) {
        return;
      }
    }

    // 3단계에서 다른 단계로 이동할 때 장비 데이터 먼저 로드
    if (currentStep === 3 && stepId !== 3) {
      const data = loadEquipmentDataFromStorage();
      if (data) {
        setEquipmentData(data);
      }

      // 3→4+ 전환 시 장비 스토어 상태 디버그 로깅
      if (stepId > 3) {
        // useWorkEquipmentStore에서 직접 데이터 가져오기
        const equipmentStoreState = useWorkEquipmentStore.getState().getWorkState(workItem.id);

        // 분실 여부 판별 함수
        const isLostEquipment = (status: any) => {
          if (!status) return false;
          return status.EQT_LOSS_YN === 'Y' || status.EQT_LOSS_YN === '1' ||
                 status.PART_LOSS_BRK_YN === 'Y' || status.PART_LOSS_BRK_YN === '1' ||
                 status.EQT_BRK_YN === 'Y' || status.EQT_BRK_YN === '1' ||
                 status.EQT_CABL_LOSS_YN === 'Y' || status.EQT_CABL_LOSS_YN === '1' ||
                 status.EQT_CRDL_LOSS_YN === 'Y' || status.EQT_CRDL_LOSS_YN === '1';
        };

        // 분실 항목 상세
        const getLossDetails = (status: any) => {
          if (!status) return '';
          const items = [];
          if (status.EQT_LOSS_YN === 'Y' || status.EQT_LOSS_YN === '1') items.push('장비');
          if (status.PART_LOSS_BRK_YN === 'Y' || status.PART_LOSS_BRK_YN === '1') items.push('아답터');
          if (status.EQT_BRK_YN === 'Y' || status.EQT_BRK_YN === '1') items.push('리모콘');
          if (status.EQT_CABL_LOSS_YN === 'Y' || status.EQT_CABL_LOSS_YN === '1') items.push('케이블');
          if (status.EQT_CRDL_LOSS_YN === 'Y' || status.EQT_CRDL_LOSS_YN === '1') items.push('크래들');
          return items.length > 0 ? items.join(', ') : '';
        };

        console.log('═══════════════════════════════════════════════════════════');
        console.log(`📦 [Step 3→${stepId}] 장비 스토어 상태 (workEquipmentStore)`);
        console.log('═══════════════════════════════════════════════════════════');
        console.log('📥 설치장비 (installedEquipments):', equipmentStoreState?.installedEquipments?.length || 0, '건');
        equipmentStoreState?.installedEquipments?.forEach((eq: any, i: number) => {
          const actual = eq.actualEquipment || {};
          const contract = eq.contractEquipment || {};
          console.log(`  [${i}] ${contract.type || actual.type || '장비'} | 모델: ${actual.model || '-'} | S/N: ${actual.serialNumber || '-'}`);
        });
        console.log('───────────────────────────────────────────────────────────');
        console.log('📤 회수장비 (markedForRemoval):', equipmentStoreState?.markedForRemoval?.length || 0, '건');
        equipmentStoreState?.markedForRemoval?.forEach((eq: any, i: number) => {
          const eqKey = eq.id || eq.EQT_NO;
          const status = equipmentStoreState?.removalStatus?.[eqKey] || {};
          const isLost = isLostEquipment(status);
          const lossDetail = getLossDetails(status);
          const statusText = isLost ? `🔴 분실 (${lossDetail})` : '🟢 회수';
          console.log(`  [${i}] ${eq.type || eq.ITEM_MID_NM || '장비'} | 모델: ${eq.model || '-'} | S/N: ${eq.serialNumber || '-'} → ${statusText}`);
        });
        console.log('───────────────────────────────────────────────────────────');
        console.log('📤 철거장비 (removeEquipments - API):', equipmentStoreState?.removeEquipments?.length || 0, '건');
        console.log('───────────────────────────────────────────────────────────');
        console.log('🔑 removalStatus 저장된 키:');
        const removalStatusKeys = Object.keys(equipmentStoreState?.removalStatus || {});
        if (removalStatusKeys.length > 0) {
          removalStatusKeys.forEach(key => {
            const s = equipmentStoreState?.removalStatus?.[key];
            const isLost = isLostEquipment(s);
            console.log(`  "${key}" → ${isLost ? '분실' : '회수'}`, s);
          });
        } else {
          console.log('  (없음 - 기본 회수처리)');
        }
        console.log('═══════════════════════════════════════════════════════════');
      }
    }
    // React 18 자동 배치 처리
    setCurrentStep(stepId);
    // 단계 변경 시 스크롤 맨 위로
    requestAnimationFrame(() => scrollToTop());
  };

  const handleEquipmentSave = (data: any) => {
    // 기존 prodPromoInfo와 필터링 데이터 유지 (Equipment 컴포넌트에서 전달하지 않음)
    setEquipmentData({
      ...data,
      prodPromoInfo: data.prodPromoInfo || equipmentData?.prodPromoInfo || [],
      kpiProdGrpCd: data.kpiProdGrpCd || equipmentData?.kpiProdGrpCd,
      prodChgGb: data.prodChgGb || equipmentData?.prodChgGb,
      chgKpiProdGrpCd: data.chgKpiProdGrpCd || equipmentData?.chgKpiProdGrpCd,
      prodGrp: data.prodGrp || equipmentData?.prodGrp,
      upCtrlCl: data.upCtrlCl || equipmentData?.upCtrlCl,
    });
    handleNext(true); // 이미 데이터 저장했으므로 loadEquipmentDataFromStorage 건너뜀
  };

  const handleWorkComplete = () => {
    // 작업완료 후 후처리 단계로 이동
    handleNext();
  };

  const renderStepIndicator = () => (
    <div className="flex items-center px-2 pt-3 sm:pt-4 pb-2 sm:pb-3 bg-white w-full">
      {/* 왼쪽 화살표 <- */}
      <button
        onClick={handlePrevious}
        disabled={currentStep <= 1}
        className={`
          w-8 h-8 sm:w-10 sm:h-10 flex items-center justify-center rounded-full transition-all flex-shrink-0
          ${currentStep <= 1
            ? 'text-gray-300 cursor-not-allowed'
            : 'text-blue-600 hover:bg-blue-50 active:bg-blue-100'}
        `}
        style={{ marginBottom: '18px' }}
      >
        <ArrowLeft className="w-6 h-6 sm:w-7 sm:h-7" strokeWidth={2.5} />
      </button>

      {/* 단계 표시 영역 - 원형 + 연결선 (균등 배치) */}
      <div className="flex items-center justify-between flex-1 mx-1">
        {steps.map((step, index) => (
          <React.Fragment key={step.id}>
            {/* 단계 아이템 */}
            <div
              className="flex flex-col items-center gap-0.5 sm:gap-1 cursor-pointer transition-all"
              onClick={() => handleStepClick(step.id as ProcessStep)}
            >
              <div
                className={`
                  w-8 h-8 sm:w-10 sm:h-10 rounded-full flex items-center justify-center font-bold text-xs sm:text-sm transition-all
                  ${currentStep === step.id
                    ? 'bg-blue-500 text-white shadow-lg scale-110'
                    : step.completed
                      ? 'bg-green-500 text-white'
                      : 'bg-gray-200 text-gray-500'}
                `}
              >
                {step.completed ? <Check className="w-4 h-4 sm:w-5 sm:h-5" /> : step.id}
              </div>
              <div
                className={`
                  text-[0.5625rem] sm:text-[0.625rem] font-medium text-center transition-all whitespace-nowrap
                  ${currentStep === step.id
                    ? 'text-blue-600 font-bold'
                    : step.completed
                      ? 'text-green-600'
                      : 'text-gray-500'}
                `}
              >
                {step.title}
              </div>
            </div>
            {/* 연결선 */}
            {index < steps.length - 1 && (
              <div
                className={`flex-1 h-0.5 mx-1 rounded-full ${step.completed ? 'bg-green-400' : 'bg-gray-200'}`}
                style={{ marginBottom: '18px', maxWidth: '24px' }}
              />
            )}
          </React.Fragment>
        ))}
      </div>

      {/* 오른쪽 화살표 -> */}
      <button
        onClick={handleNext}
        disabled={currentStep >= totalSteps}
        className={`
          w-8 h-8 sm:w-10 sm:h-10 flex items-center justify-center rounded-full transition-all flex-shrink-0
          ${currentStep >= totalSteps
            ? 'text-gray-300 cursor-not-allowed'
            : 'text-blue-600 hover:bg-blue-50 active:bg-blue-100'}
        `}
        style={{ marginBottom: '18px' }}
      >
        <ArrowRight className="w-6 h-6 sm:w-7 sm:h-7" strokeWidth={2.5} />
      </button>
    </div>
  );

  const renderCurrentStep = () => {
    switch (currentStep) {
      case 1:
        return (
          <ContractInfo
            workItem={workItem}
            onNext={handleNext}
            onBack={handlePrevious}
          />
        );
      case 2:
        return (
          <ReceptionInfo
            workItem={workItem}
            onNext={handleNext}
            onBack={handlePrevious}
            showToast={showToast}
          />
        );
      case 3:
        return (
          <WorkEquipmentManagement
            workItem={workItem}
            onSave={handleEquipmentSave}
            onBack={handlePrevious}
            showToast={showToast}
            preloadedApiData={preloadedEquipmentApiData}
            onPreloadedDataUpdate={setPreloadedEquipmentApiData}
            readOnly={isWorkCompleted}
            isCertifyProd={isCertifyProd}
            certifyOpLnkdCd={certifyOpLnkdCd}
          />
        );
      case 4:
        // FTTH 진행 중: 집선등록 / 일반 또는 FTTH 완료 조회: 작업완료
        if (showLineRegistration) {
          return (
            <LineRegistration
              workItem={workItem}
              onNext={handleNext}
              onBack={handlePrevious}
              showToast={showToast}
              readOnly={isWorkCompleted}
            />
          );
        } else {
          return (
            <WorkCompleteRouter
              order={workItem as WorkOrder}
              onBack={handlePrevious}
              onSuccess={handleWorkComplete}
              showToast={showToast}
              equipmentData={equipmentData || filteringData}
              readOnly={isWorkCompleted}
              isCertifyProd={isCertifyProd}
              onEquipmentRefreshNeeded={() => {
                console.log('[WorkProcessFlow] 장비이전 성공 - 장비 캐시 무효화');
                setPreloadedEquipmentApiData(null);
              }}
            />
          );
        }
      case 5:
        // FTTH: 작업완료 (5단계) / 일반: 후처리 (5단계)
        if (showLineRegistration) {
          return (
            <WorkCompleteRouter
              order={workItem as WorkOrder}
              onBack={handlePrevious}
              onSuccess={handleWorkComplete}
              showToast={showToast}
              equipmentData={equipmentData || filteringData}
              readOnly={isWorkCompleted}
              isCertifyProd={isCertifyProd}
              onEquipmentRefreshNeeded={() => {
                console.log('[WorkProcessFlow] 장비이전 성공 - 장비 캐시 무효화');
                setPreloadedEquipmentApiData(null);
              }}
            />
          );
        } else {
          return (
            <PostProcess
              order={workItem as WorkOrder}
              onBack={handlePrevious}
              onComplete={onComplete}
              showToast={showToast}
            />
          );
        }
      case 6:
        // FTTH 전용: 후처리 (6단계)
        return (
          <PostProcess
            order={workItem as WorkOrder}
            onBack={handlePrevious}
            onComplete={onComplete}
            showToast={showToast}
          />
        );
      default:
        return null;
    }
  };

  // FTTH 판별 로딩 중일 때 스피너 표시
  if (!isFtthCheckLoaded) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center bg-gray-50">
        <div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
        <p className="mt-4 text-sm text-gray-500">작업 정보 확인 중...</p>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col bg-gray-50 overflow-hidden">
      {/* 고정 헤더 영역 - 완료 배너 + 단계 인디케이터 */}
      <div className="flex-shrink-0 bg-white border-b border-gray-200 shadow-sm">
        {/* 완료된 작업 안내 배너 */}
        {isWorkCompleted && (
          <div className="bg-green-50 border-b border-green-200 px-3 sm:px-4 py-1.5 sm:py-2">
            <div className="flex items-center justify-center gap-1.5 sm:gap-2">
              <svg className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-green-600 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
              <span className="text-[0.625rem] sm:text-xs font-medium text-green-800 whitespace-nowrap">완료된 작업입니다 (조회만 가능)</span>
            </div>
          </div>
        )}
        {/* 단계 인디케이터 (좌우 화살표 포함) */}
        {renderStepIndicator()}
      </div>

      {/* 스크롤 가능한 콘텐츠 영역 */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden">
        {renderCurrentStep()}
      </div>
    </div>
  );
};

export default WorkProcessFlow;
