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
      if (workItem.CTRT_ID) {
        try {
          const userInfo = localStorage.getItem('userInfo');
          const user = userInfo ? JSON.parse(userInfo) : {};

          const response = await getTechnicianEquipments({
            WRKR_ID: 'A20130708',
            SO_ID: workItem.SO_ID || user.soId,
            WORK_ID: workItem.id,
            CUST_ID: workItem.customer?.id,
            RCPT_ID: workItem.RCPT_ID || null,
            CTRT_ID: workItem.CTRT_ID || null,
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
          };

          // 전체 API response 저장 (3단계에서 재사용)
          setPreloadedEquipmentApiData(response);
          setFilteringData(filtering);

          // 철거 작업(WRK_CD=02,08,09): API 응답의 회수 장비를 Store에 자동 저장
          // 3단계를 건너뛰어도 4단계에서 철거 신호 전송이 가능하도록
          const isRemovalWork = ['02', '08', '09'].includes(workItem.WRK_CD || '');
          if (isRemovalWork && response.removedEquipments?.length > 0) {
            setEquipmentData({
              installedEquipments: [],
              removedEquipments: response.removedEquipments,
              ...filtering
            });
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
    const storageKey = `equipment_draft_${workItem.id}`;
    const savedDraft = localStorage.getItem(storageKey);

    if (savedDraft) {
      try {
        const draftData = JSON.parse(savedDraft);

        if (draftData.installedEquipments && draftData.installedEquipments.length > 0) {
          const equipmentData = {
            installedEquipments: draftData.installedEquipments,
            removedEquipments: draftData.markedForRemoval || [],
            kpiProdGrpCd: filteringData?.kpiProdGrpCd || draftData.kpiProdGrpCd,
            prodChgGb: filteringData?.prodChgGb || draftData.prodChgGb,
            chgKpiProdGrpCd: filteringData?.chgKpiProdGrpCd || draftData.chgKpiProdGrpCd,
            prodGrp: filteringData?.prodGrp || draftData.prodGrp,
          };
          return equipmentData;
        }
      } catch (error) {
        console.error('장비 데이터 로드 실패:', error);
      }
    }

    if (filteringData) {
      return {
        installedEquipments: [],
        removedEquipments: [],
        ...filteringData
      };
    }

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

  const handleNext = () => {
    if (currentStep < 4) {
      // 3단계에서 벗어날 때 장비 데이터 먼저 로드하고 상태 설정
      if (currentStep === 3) {
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
    handleNext();
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
