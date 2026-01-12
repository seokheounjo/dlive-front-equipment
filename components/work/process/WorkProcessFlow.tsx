import React, { useState, useEffect } from 'react';
import { WorkItem, WorkOrder } from '../../../types';
import ContractInfo from './ContractInfo';
import ReceptionInfo from './ReceptionInfo';
import WorkEquipmentManagement from './WorkEquipmentManagement';
import WorkCompleteRouter, { getWorkTypeName } from './complete';
import { getTechnicianEquipments } from '../../../services/apiService';
import { useWorkProcessStore } from '../../../stores/workProcessStore';
import { Check, ArrowLeft, ArrowRight } from 'lucide-react';
import './WorkProcessFlow.css';

interface WorkProcessFlowProps {
  workItem: WorkItem;
  onComplete: () => void;
  onBack: () => void;
  showToast?: (message: string, type: 'success' | 'error' | 'warning' | 'info') => void;
}

type ProcessStep = 1 | 2 | 3 | 4;

const WorkProcessFlow: React.FC<WorkProcessFlowProps> = ({ workItem, onComplete, onBack, showToast }) => {
  // 작업 완료 여부 확인 (레거시와 동일: WRK_STAT_CD === '4')
  const isWorkCompleted = workItem.WRK_STAT_CD === '4' || workItem.status === '완료';

  // 편집 가능 여부 (레거시: WRK_STAT_CD가 '1' 또는 '2'일 때만 편집 가능)
  const isEditable = workItem.WRK_STAT_CD === '1' || workItem.WRK_STAT_CD === '2';

  // Work Process Store 사용 (Zustand)
  const { currentStep, setCurrentStep, setCurrentWorkId, equipmentData, setEquipmentData, filteringData, setFilteringData } = useWorkProcessStore();

  // 장비 API 데이터 (미리 로드) - 로컬 상태로 유지
  const [preloadedEquipmentApiData, setPreloadedEquipmentApiData] = useState<any>(null);

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

  // 작업 시작 시 장비 데이터 + 필터링 데이터 미리 로드 (3단계 진입 전에!)
  useEffect(() => {
    const loadEquipmentApiData = async () => {
      // 상품변경(05) 작업은 DTL_CTRT_ID 사용, 그 외는 CTRT_ID 사용
      const ctrtIdToUse = workItem.WRK_CD === '05'
        ? (workItem.DTL_CTRT_ID || workItem.CTRT_ID)
        : workItem.CTRT_ID;

      if (ctrtIdToUse) {
        try {
          const userInfo = localStorage.getItem('userInfo');
          const user = userInfo ? JSON.parse(userInfo) : {};

          console.log('[WorkProcessFlow] 장비 프리로드 - WRK_CD:', workItem.WRK_CD, 'CTRT_ID:', ctrtIdToUse);

          const response = await getTechnicianEquipments({
            WRKR_ID: user.workerId || 'A20130708',
            SO_ID: workItem.SO_ID || user.soId,
            WRK_ID: workItem.id,  // 레거시와 동일하게 WRK_ID 사용
            CUST_ID: workItem.customer?.id || workItem.CUST_ID,
            RCPT_ID: workItem.RCPT_ID || null,
            CTRT_ID: ctrtIdToUse,
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

          // 필터링 데이터 추출
          const filtering = {
            kpiProdGrpCd: response.kpiProdGrpCd,
            prodChgGb: response.prodChgGb,
            chgKpiProdGrpCd: response.chgKpiProdGrpCd,
            prodGrp: response.prodGrp,
            upCtrlCl: response.upCtrlCl,
          };

          // 전체 API response 저장 (3단계에서 재사용)
          setPreloadedEquipmentApiData(response);
          setFilteringData(filtering);

          // 철거 작업(WRK_CD=02,08,09): API 응답의 회수 장비를 Store에 자동 저장
          // 3단계를 건너뛰어도 4단계에서 철거 신호 전송이 가능하도록
          const isRemovalWork = ['02', '08', '09'].includes(workItem.WRK_CD || '');
          if (isRemovalWork) {
            // API 응답을 Complete 컴포넌트에서 사용할 수 있는 형태로 변환
            const userInfo = localStorage.getItem('userInfo');
            const user = userInfo ? JSON.parse(userInfo) : {};

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
              MST_SO_ID: eq.MST_SO_ID || workItem.SO_ID || user.soId,
              SO_ID: eq.SO_ID || workItem.SO_ID || user.soId,
              REG_UID: user.userId || user.workerId || 'A20230019',

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
              ...filtering
            });
            console.log('[WorkProcessFlow] 철거 장비 자동 저장:', removals.length, '개');
          }
        } catch (error) {
          console.error('장비 API Pre-loading 실패:', error);
        }
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

  const steps = [
    { id: 1, title: '계약 정보', completed: isWorkCompleted || currentStep > 1 },
    { id: 2, title: '접수 정보', completed: isWorkCompleted || currentStep > 2 },
    { id: 3, title: '장비 정보', completed: isWorkCompleted || currentStep > 3 },
    { id: 4, title: '작업 완료', completed: isWorkCompleted || currentStep > 4 },
  ];

  // 스크롤을 맨 위로 이동 (모바일 환경)
  const scrollToTop = () => {
    window.scrollTo(0, 0);
    document.documentElement.scrollTop = 0;
    document.body.scrollTop = 0;
  };

  const handleNext = (skipEquipmentLoad = false) => {
    if (currentStep < 4) {
      // 3단계에서 벗어날 때 장비 데이터 먼저 로드하고 상태 설정
      // skipEquipmentLoad=true면 이미 저장된 데이터 사용 (handleEquipmentSave에서 호출 시)
      if (currentStep === 3 && !skipEquipmentLoad) {
        const data = loadEquipmentDataFromStorage();
        if (data) {
          setEquipmentData(data);
        }
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

  const stepNames = ['계약정보', '접수정보', '장비정보', '작업완료'];

  const handleStepClick = (stepId: ProcessStep) => {
    // 3단계에서 다른 단계로 이동할 때 장비 데이터 먼저 로드
    if (currentStep === 3 && stepId !== 3) {
      const data = loadEquipmentDataFromStorage();
      if (data) {
        setEquipmentData(data);
      }
    }
    // React 18 자동 배치 처리
    setCurrentStep(stepId);
    // 단계 변경 시 스크롤 맨 위로
    requestAnimationFrame(() => scrollToTop());
  };

  const handleEquipmentSave = (data: any) => {
    setEquipmentData(data);
    handleNext(true); // 이미 데이터 저장했으므로 loadEquipmentDataFromStorage 건너뜀
  };

  const handleWorkComplete = () => {
    onComplete();
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
                  text-[9px] sm:text-[10px] font-medium text-center transition-all whitespace-nowrap
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
        disabled={currentStep >= 4}
        className={`
          w-8 h-8 sm:w-10 sm:h-10 flex items-center justify-center rounded-full transition-all flex-shrink-0
          ${currentStep >= 4
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
          />
        );
      case 4:
        return (
          <WorkCompleteRouter
            order={workItem as WorkOrder}
            onBack={handlePrevious}
            onSuccess={handleWorkComplete}
            showToast={showToast}
            equipmentData={equipmentData || filteringData}
            readOnly={isWorkCompleted}
            onEquipmentRefreshNeeded={() => {
              // Invalidate equipment cache to force refresh when going back to equipment step
              console.log('[WorkProcessFlow] 장비이전 성공 - 장비 캐시 무효화');
              setPreloadedEquipmentApiData(null);
            }}
          />
        );
      default:
        return null;
    }
  };

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
              <span className="text-[10px] sm:text-xs font-medium text-green-800 whitespace-nowrap">완료된 작업입니다 (조회만 가능)</span>
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
