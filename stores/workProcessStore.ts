/**
 * 작업 프로세스 상태 관리 Store
 * - 4단계 프로세스 (계약정보 → 접수정보 → 장비정보 → 작업완료)
 * - 작업 항목 데이터
 * - 장비 데이터
 *
 * Phase 1-2에서 구현 예정
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

interface WorkProcessStore {
  // 현재 단계
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

  // 전체 초기화
  reset: () => void;
}

export const useWorkProcessStore = create<WorkProcessStore>()(
  persist(
    (set) => ({
      // 초기값
      currentStep: 1,
      workItem: null,
      equipmentData: null,
      filteringData: null,

      // Actions
      setCurrentStep: (step) => set((state) => ({
        currentStep: typeof step === 'function' ? step(state.currentStep) : step
      })),
      setWorkItem: (item) => set({ workItem: item }),
      setEquipmentData: (data) => set({ equipmentData: data }),
      setFilteringData: (data) => set({ filteringData: data }),
      reset: () =>
        set({
          currentStep: 1,
          workItem: null,
          equipmentData: null,
          filteringData: null,
        }),
    }),
    {
      name: 'dlive-work-process-storage', // localStorage 키
      // workItem ID별로 분리 저장하려면 추가 로직 필요 (Phase 1-2에서 구현)
    }
  )
);
