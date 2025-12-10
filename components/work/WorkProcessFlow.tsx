import React, { useState, useEffect } from 'react';
import { WorkItem, WorkOrder } from '../../types';
import ContractInfo from '../work/ContractInfo';
import ReceptionInfo from '../work/ReceptionInfo';
import WorkEquipmentManagement from '../work/WorkEquipmentManagement';
import WorkCompleteForm from '../work/WorkCompleteForm';
import { getTechnicianEquipments } from '../../services/apiService';
import { useWorkProcessStore } from '../../stores/workProcessStore';
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
  const { currentStep, setCurrentStep, equipmentData, setEquipmentData, filteringData, setFilteringData } = useWorkProcessStore();

  // 장비 API 데이터 (미리 로드) - 로컬 상태로 유지
  const [preloadedEquipmentApiData, setPreloadedEquipmentApiData] = useState<any>(null);

  // 작업 시작 시 장비 데이터 + 필터링 데이터 미리 로드 (3단계 진입 전에!)
  useEffect(() => {
    const loadEquipmentApiData = async () => {
      if (workItem.CTRT_ID) {
        try {
          console.log('🚀 [WorkProcessFlow] 장비 API 데이터 Pre-loading 시작');
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
          console.log('✅ [WorkProcessFlow] 장비 API 데이터 Pre-loading 완료:', {
            contractEquipments: response.contractEquipments?.length || 0,
            technicianEquipments: response.technicianEquipments?.length || 0,
            customerEquipments: response.customerEquipments?.length || 0,
            removedEquipments: response.removedEquipments?.length || 0,
            filtering
          });
        } catch (error) {
          console.error('❌ [WorkProcessFlow] 장비 API Pre-loading 실패:', error);
        }
      } else {
        console.warn('⚠️ [WorkProcessFlow] CTRT_ID 없음 - 장비 API Pre-loading 불가');
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
        console.log('🔄 3단계 장비 데이터 로드:', draftData);

        if (draftData.installedEquipments && draftData.installedEquipments.length > 0) {
          const equipmentData = {
            // ✅ 모든 필드 보존 - 필터링하지 않음!
            installedEquipments: draftData.installedEquipments,
            removedEquipments: draftData.markedForRemoval || [],
            // 설치정보 모달 필터링용 데이터 (미리 로드한 데이터 우선 사용)
            kpiProdGrpCd: filteringData?.kpiProdGrpCd || draftData.kpiProdGrpCd,
            prodChgGb: filteringData?.prodChgGb || draftData.prodChgGb,
            chgKpiProdGrpCd: filteringData?.chgKpiProdGrpCd || draftData.chgKpiProdGrpCd,
            prodGrp: filteringData?.prodGrp || draftData.prodGrp,
          };
          console.log('🔄 장비 데이터 복원 (필터링 데이터 포함):', equipmentData);
          return equipmentData;
        }
      } catch (error) {
        console.error('❌ 장비 데이터 로드 실패:', error);
      }
    }

    // localStorage에 데이터 없으면 필터링 데이터만이라도 반환
    if (filteringData) {
      console.log('🔄 localStorage 없음 - 필터링 데이터만 반환:', filteringData);
      return {
        installedEquipments: [],
        removedEquipments: [],
        ...filteringData
      };
    }

    return null;
  };

  const steps = [
    { id: 1, title: '계약 정보', completed: isWorkCompleted || currentStep > 1 },
    { id: 2, title: '접수 정보', completed: isWorkCompleted || currentStep > 2 },
    { id: 3, title: '장비 정보', completed: isWorkCompleted || currentStep > 3 },
    { id: 4, title: '작업 완료', completed: isWorkCompleted || currentStep > 4 },
  ];

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
    }
  };

  const handlePrevious = () => {
    if (currentStep > 1) {
      setCurrentStep((prev) => (prev - 1) as ProcessStep);
    }
    // 첫 단계에서는 아무 동작도 하지 않음 (목록 버튼과 구분)
  };

  const handleStepClick = (stepId: ProcessStep) => {
    const stepNames = ['계약정보', '접수정보', '장비정보', '작업완료'];
    const getStepColor = (id: ProcessStep) => {
      if (currentStep === id) return '🔵 파란색 (활성)';
      if (steps[id - 1]?.completed) return '🟢 초록색 (완료)';
      return '⚪ 회색';
    };

    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('🖱️ 단계 탭 클릭 이벤트');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('클릭한 단계:', stepNames[stepId - 1], `(step ${stepId})`);
    console.log('이전 활성 단계:', stepNames[currentStep - 1], `(step ${currentStep})`);
    console.log('');
    console.log('🎨 각 단계별 상태:');
    steps.forEach((step, idx) => {
      console.log(`  ${stepNames[idx]} (step ${step.id}):`, getStepColor(step.id as ProcessStep), `- completed: ${step.completed}`);
    });
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    // 3단계에서 다른 단계로 이동할 때 장비 데이터 먼저 로드
    if (currentStep === 3 && stepId !== 3) {
      const data = loadEquipmentDataFromStorage();
      if (data) {
        setEquipmentData(data);
      }
    }
    // React 18 자동 배치 처리
    setCurrentStep(stepId);
  };

  const handleEquipmentSave = (data: any) => {
    setEquipmentData(data);
    handleNext();
  };

  const handleWorkComplete = () => {
    onComplete();
  };

  const renderStepIndicator = () => (
    <div className="flex items-center px-2 pt-4 pb-3 bg-white w-full">
      {/* 왼쪽 화살표 <- */}
      <button
        onClick={handlePrevious}
        disabled={currentStep <= 1}
        className={`
          w-10 h-10 flex items-center justify-center rounded-full transition-all flex-shrink-0
          ${currentStep <= 1
            ? 'text-gray-300 cursor-not-allowed'
            : 'text-blue-600 hover:bg-blue-50 active:bg-blue-100'}
        `}
        style={{ marginBottom: '18px' }}
      >
        <ArrowLeft className="w-7 h-7" strokeWidth={2.5} />
      </button>

      {/* 단계 표시 영역 - 원형 + 연결선 (균등 배치) */}
      <div className="flex items-center justify-between flex-1 mx-1">
        {steps.map((step, index) => (
          <React.Fragment key={step.id}>
            {/* 단계 아이템 */}
            <div
              className="flex flex-col items-center gap-1 cursor-pointer transition-all"
              onClick={() => handleStepClick(step.id as ProcessStep)}
            >
              <div
                className={`
                  w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm transition-all
                  ${currentStep === step.id
                    ? 'bg-blue-500 text-white shadow-lg scale-110'
                    : step.completed
                      ? 'bg-green-500 text-white'
                      : 'bg-gray-200 text-gray-500'}
                `}
              >
                {step.completed ? <Check className="w-5 h-5" /> : step.id}
              </div>
              <div
                className={`
                  text-[10px] font-medium text-center transition-all whitespace-nowrap
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
          w-10 h-10 flex items-center justify-center rounded-full transition-all flex-shrink-0
          ${currentStep >= 4
            ? 'text-gray-300 cursor-not-allowed'
            : 'text-blue-600 hover:bg-blue-50 active:bg-blue-100'}
        `}
        style={{ marginBottom: '18px' }}
      >
        <ArrowRight className="w-7 h-7" strokeWidth={2.5} />
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
            readOnly={isWorkCompleted}
          />
        );
      case 4:
        return (
          <WorkCompleteForm
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
    <div className="min-h-screen bg-gray-50">
      {/* 완료된 작업 안내 배너 */}
      {isWorkCompleted && (
        <div className="bg-green-50 border-b border-green-200 px-4 py-3">
          <div className="flex items-center gap-2">
            <svg className="w-5 h-5 text-green-600" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
            </svg>
            <span className="text-sm font-medium text-green-800">완료된 작업입니다 (조회만 가능)</span>
          </div>
        </div>
      )}

      {/* Sticky 헤더 영역: 단계 인디케이터 (좌우 화살표 포함) */}
      <div className="sticky top-0 z-50 bg-white border-b border-gray-200 shadow-sm">
        {renderStepIndicator()}
      </div>

      {/* 스크롤 가능한 콘텐츠 영역 */}
      <div className="pb-6">
        {renderCurrentStep()}
      </div>
    </div>
  );
};

export default WorkProcessFlow;
