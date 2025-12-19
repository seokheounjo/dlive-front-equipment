/**
 * 작업 프로세스 상태 관리 Store
 * - 4단계 프로세스 (계약정보 → 접수정보 → 장비정보 → 작업완료)
 * - 작업 항목 데이터
 * - 장비 데이터
 * - 작업 ID별 step 분리 저장
 */
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

// 타입 정의 (나중에 types 파일에서 import)
interface WorkItem {
  id: string;
  [key: string]: any;
}

interface EquipmentData {
  installedEquipments?: any[];
  removedEquipments?: any[];
  [key: string]: any;
}

type ProcessStep = 1 | 2 | 3 | 4;

// 작업 ID별 step 저장
interface WorkStepMap {
  [workId: string]: ProcessStep;
}

interface WorkProcessStore {
  // 현재 작업 ID
  currentWorkId: string | null;
  setCurrentWorkId: (workId: string | null) => void;

  // 작업 ID별 step 저장
  workSteps: WorkStepMap;

  // 현재 단계 (현재 작업 ID 기준)
  currentStep: ProcessStep;
  setCurrentStep: (step: ProcessStep | ((prev: ProcessStep) => ProcessStep)) => void;

  // 작업 항목
  workItem: WorkItem | null;
  setWorkItem: (item: WorkItem | null) => void;

  // 장비 데이터 (3단계에서 수집)
  equipmentData: EquipmentData | null;
  setEquipmentData: (data: EquipmentData | null) => void;

  // 필터링 데이터 (설치정보 모달용)
  filteringData: any;
  setFilteringData: (data: any) => void;

  // 특정 작업의 step 가져오기
  getStepForWork: (workId: string) => ProcessStep;

  // 전체 초기화
  reset: () => void;

  // 특정 작업 초기화
  resetWork: (workId: string) => void;

  // 다른 작업 선택 시 이전 작업 draft 삭제
  clearPreviousWorkDraft: (newWorkId: string) => void;
}

export const useWorkProcessStore = create<WorkProcessStore>()(
  persist(
    (set, get) => ({
      // 초기값
      currentWorkId: null,
      workSteps: {},
      currentStep: 1,
      workItem: null,
      equipmentData: null,
      filteringData: null,

      // Actions
      setCurrentWorkId: (workId) => {
        const { workSteps } = get();
        const step = workId ? (workSteps[workId] || 1) : 1;
        set({ currentWorkId: workId, currentStep: step });
      },

      setCurrentStep: (step) => set((state) => {
        const newStep = typeof step === 'function' ? step(state.currentStep) : step;
        const newWorkSteps = { ...state.workSteps };

        // 현재 작업 ID가 있으면 해당 작업의 step도 업데이트
        if (state.currentWorkId) {
          newWorkSteps[state.currentWorkId] = newStep;
        }

        return {
          currentStep: newStep,
          workSteps: newWorkSteps
        };
      }),

      setWorkItem: (item) => set({ workItem: item }),
      setEquipmentData: (data) => set({ equipmentData: data }),
      setFilteringData: (data) => set({ filteringData: data }),

      getStepForWork: (workId: string) => {
        const { workSteps } = get();
        return workSteps[workId] || 1;
      },

      reset: () =>
        set({
          currentWorkId: null,
          workSteps: {},
          currentStep: 1,
          workItem: null,
          equipmentData: null,
          filteringData: null,
        }),

      resetWork: (workId: string) => set((state) => {
        const newWorkSteps = { ...state.workSteps };
        delete newWorkSteps[workId];
        return { workSteps: newWorkSteps };
      }),

      // 다른 작업 선택 시 이전 작업 draft 삭제
      clearPreviousWorkDraft: (newWorkId: string) => {
        const { currentWorkId, workSteps } = get();

        // 이전 작업과 새 작업이 다른 경우에만 삭제
        if (currentWorkId && currentWorkId !== newWorkId) {
          console.log(`🗑️ [WorkProcessStore] 이전 작업(${currentWorkId}) draft 삭제`);

          // 1. localStorage에서 이전 작업의 draft 삭제
          try {
            // Complete*.tsx에서 저장하는 키
            localStorage.removeItem(`work_complete_draft_${currentWorkId}`);
            // Equipment*.tsx에서 저장하는 키
            localStorage.removeItem(`equipment_draft_${currentWorkId}`);
            console.log(`✅ localStorage draft 삭제 완료`);
          } catch (e) {
            console.error('localStorage 삭제 실패:', e);
          }

          // 2. workSteps에서 이전 작업 step 삭제
          const newWorkSteps = { ...workSteps };
          delete newWorkSteps[currentWorkId];

          // 3. store 상태 초기화 후 새 작업 ID 설정
          set({
            currentWorkId: newWorkId,
            workSteps: newWorkSteps,
            currentStep: newWorkSteps[newWorkId] || 1,
            workItem: null,
            equipmentData: null,
            filteringData: null,
          });
        } else {
          // 같은 작업이면 currentWorkId만 설정
          const step = workSteps[newWorkId] || 1;
          set({ currentWorkId: newWorkId, currentStep: step });
        }
      },
    }),
    {
      name: 'dlive-work-process-storage', // localStorage 키
      partialize: (state) => ({
        workSteps: state.workSteps, // 작업 ID별 step
        currentWorkId: state.currentWorkId, // 현재 작업 ID
        filteringData: state.filteringData, // 필터링 데이터 (설치정보 모달용)
        equipmentData: state.equipmentData, // 장비 데이터 (3단계에서 수집)
      }),
    }
  )
);
