/**
 * 장비관리 상태 관리 Store
 * - 기사 재고 장비
 * - 선택된 장비
 * - 장비 필터
 * - 신호 체크 상태
 *
 * 작업관리(workProcessStore)와 독립적으로 동작
 */
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

// 타입 정의
interface Equipment {
  id: string;
  serialNo?: string;
  modelCode?: string;
  modelName?: string;
  itemMidCd?: string; // 04:모뎀, 05:셋톱박스, 07:특수장비, 03:추가장비
  eqtClCd?: string;   // 장비 클래스 코드
  status?: string;
  macAddress?: string;
  installLocation?: string;
  [key: string]: any;
}

interface SignalStatus {
  stbSerialNo?: string;
  status?: 'success' | 'fail';
  message?: string;
  timestamp?: string;
}

interface EquipmentFilters {
  itemMidCd?: string; // 장비 분류 (모뎀/셋톱/특수/추가)
  status?: string;    // 장비 상태
  searchTerm?: string; // 검색어 (시리얼번호/모델명)
}

interface EquipmentStore {
  // 기사 재고 장비 전체
  technicianInventory: Equipment[];
  setTechnicianInventory: (items: Equipment[]) => void;
  addToInventory: (item: Equipment) => void;
  removeFromInventory: (serialNo: string) => void;

  // 선택된 장비
  selectedEquipment: Equipment | null;
  setSelectedEquipment: (item: Equipment | null) => void;

  // 장비 필터
  equipmentFilters: EquipmentFilters;
  setEquipmentFilters: (filters: EquipmentFilters) => void;

  // 신호 체크 상태
  signalCheckStatus: SignalStatus | null;
  setSignalCheckStatus: (status: SignalStatus | null) => void;

  // 장비 이관/이동 임시 상태
  transferQueue: Equipment[];
  addToTransferQueue: (item: Equipment) => void;
  removeFromTransferQueue: (serialNo: string) => void;
  clearTransferQueue: () => void;

  // 전체 초기화
  reset: () => void;
}

export const useEquipmentStore = create<EquipmentStore>()(
  persist(
    (set, get) => ({
      // 초기값
      technicianInventory: [],
      selectedEquipment: null,
      equipmentFilters: {},
      signalCheckStatus: null,
      transferQueue: [],

      // Actions
      setTechnicianInventory: (items) => set({ technicianInventory: items }),

      addToInventory: (item) => set((state) => ({
        technicianInventory: [...state.technicianInventory, item],
      })),

      removeFromInventory: (serialNo) => set((state) => ({
        technicianInventory: state.technicianInventory.filter(
          (item) => item.serialNo !== serialNo
        ),
      })),

      setSelectedEquipment: (item) => set({ selectedEquipment: item }),

      setEquipmentFilters: (filters) => set({ equipmentFilters: filters }),

      setSignalCheckStatus: (status) => set({ signalCheckStatus: status }),

      addToTransferQueue: (item) => set((state) => ({
        transferQueue: [...state.transferQueue, item],
      })),

      removeFromTransferQueue: (serialNo) => set((state) => ({
        transferQueue: state.transferQueue.filter(
          (item) => item.serialNo !== serialNo
        ),
      })),

      clearTransferQueue: () => set({ transferQueue: [] }),

      reset: () =>
        set({
          technicianInventory: [],
          selectedEquipment: null,
          equipmentFilters: {},
          signalCheckStatus: null,
          transferQueue: [],
        }),
    }),
    {
      name: 'dlive-equipment-storage', // localStorage 키
      partialize: (state) => ({
        // technicianInventory는 persist하지 않음 (API에서 매번 조회)
        equipmentFilters: state.equipmentFilters,
        // selectedEquipment, signalCheckStatus, transferQueue는 세션 간 유지 불필요
      }),
    }
  )
);
