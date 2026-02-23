/**
 * 작업별 장비 상태 관리 Store
 * - 각 작업(workId)별로 장비 상태 분리 저장
 * - 설치/철거/AS/이전 등 모든 장비 작업 공통 사용
 * - persist middleware로 localStorage 자동 저장
 *
 * 작업 유형별 저장 데이터:
 * - 설치(01): installedEquipments (등록된 장비), signalStatus
 * - 철거(02): removalStatus (분실/파손 체크박스)
 * - AS(03): installedEquipments, removalStatus, signalStatus
 * - 정지(04): installedEquipments, removalStatus
 * - 상품변경(05): installedEquipments, removalStatus, signalStatus
 * - 댁내이전(06): installedEquipments, signalStatus
 * - 이전설치(07): installedEquipments, signalStatus
 * - 이전철거(08): removalStatus
 * - 부가상품(09): installedEquipments
 */
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import {
  ExtendedEquipment,
  ContractEquipment,
  InstalledEquipment,
  RemovalStatus,
  LossStatusData,
} from '../components/work/process/equipment/shared/types';

// 작업별 장비 상태
interface WorkEquipmentState {
  // API 응답 데이터 (서버 상태 캐시)
  contractEquipments: ContractEquipment[];      // output2: 계약장비
  technicianEquipments: ExtendedEquipment[];    // output3: 기사재고
  customerEquipments: ExtendedEquipment[];      // output4: 고객장비
  removeEquipments: ExtendedEquipment[];        // output5: 철거장비

  // 클라이언트 상태 (로컬 변경사항) - 작업 완료 시 필요
  installedEquipments: InstalledEquipment[];    // 등록된 장비 (설치/AS/상품변경/이전)
  removalStatus: RemovalStatus;                  // 분실/파손 체크박스 상태 (철거/AS/정지)
  markedForRemoval: ExtendedEquipment[];         // 회수 등록할 장비 목록 (AS/상품변경)
  pendingLossStatusList: LossStatusData[];       // 분실 상태 목록 (작업완료 시 API 호출용)
  reuseAll: boolean;                             // 전체 재사용 체크 (이전철거 - 레거시 chk_reuse_yn)

  // 선택 상태 (UI 상태)
  selectedContract: ContractEquipment | null;
  selectedStock: ExtendedEquipment | null;

  // 신호처리 상태
  signalStatus: 'idle' | 'processing' | 'success' | 'fail';
  signalResult: string;

  // 필터링 데이터 (장비변경 모달용)
  filteringData: {
    kpiProdGrpCd?: string;
    prodChgGb?: string;
    chgKpiProdGrpCd?: string;
    prodGrp?: string;
  };

  // 메타 정보
  lastUpdated: string | null;
  isDataLoaded: boolean;
}

// 전체 Store 상태
interface WorkEquipmentStore {
  // 작업별 상태 저장
  workStates: Record<string, WorkEquipmentState>;

  // 현재 활성 작업 ID
  currentWorkId: string | null;

  // Actions - 작업 상태 관리
  initWorkState: (workId: string) => void;
  setCurrentWorkId: (workId: string | null) => void;
  clearWorkState: (workId: string) => void;
  clearAllWorkStates: () => void;

  // Actions - API 데이터 설정 (서버 상태)
  setApiData: (workId: string, data: {
    contractEquipments?: ContractEquipment[];
    technicianEquipments?: ExtendedEquipment[];
    customerEquipments?: ExtendedEquipment[];
    removeEquipments?: ExtendedEquipment[];
    filteringData?: WorkEquipmentState['filteringData'];
  }) => void;

  // Actions - 설치 장비 관리
  addInstalledEquipment: (workId: string, item: InstalledEquipment) => void;
  removeInstalledEquipment: (workId: string, contractId: string) => void;
  updateInstalledEquipment: (workId: string, contractId: string, updates: Partial<InstalledEquipment>) => void;
  setInstalledEquipments: (workId: string, items: InstalledEquipment[]) => void;
  clearInstalledEquipments: (workId: string) => void;

  // Actions - 철거 상태 관리
  setRemovalStatus: (workId: string, eqtNo: string, field: string, value: string) => void;
  toggleRemovalStatus: (workId: string, eqtNo: string, field: string) => void;
  setFullRemovalStatus: (workId: string, status: RemovalStatus) => void;
  clearRemovalStatus: (workId: string) => void;

  // Actions - 회수 장비 관리 (AS/상품변경용)
  addMarkedForRemoval: (workId: string, equipment: ExtendedEquipment) => void;
  removeMarkedForRemoval: (workId: string, eqtNo: string) => void;
  setMarkedForRemoval: (workId: string, equipments: ExtendedEquipment[]) => void;
  clearMarkedForRemoval: (workId: string) => void;

  // Actions - 분실 상태 목록 관리
  addPendingLossStatus: (workId: string, lossStatus: LossStatusData) => void;
  setPendingLossStatusList: (workId: string, list: LossStatusData[]) => void;
  clearPendingLossStatusList: (workId: string) => void;

  // Actions - 전체 재사용 체크 (이전철거)
  setReuseAll: (workId: string, value: boolean) => void;

  // Actions - 선택 상태 관리
  setSelectedContract: (workId: string, contract: ContractEquipment | null) => void;
  setSelectedStock: (workId: string, stock: ExtendedEquipment | null) => void;
  clearSelection: (workId: string) => void;

  // Actions - 신호처리 상태 관리
  setSignalStatus: (workId: string, status: WorkEquipmentState['signalStatus']) => void;
  setSignalResult: (workId: string, result: string) => void;

  // Actions - 데이터 로드 상태
  setDataLoaded: (workId: string, loaded: boolean) => void;

  // Selectors - 현재 작업 상태 조회
  getCurrentWorkState: () => WorkEquipmentState | null;
  getWorkState: (workId: string) => WorkEquipmentState | null;
}

// 기본 상태 생성
const createDefaultState = (): WorkEquipmentState => ({
  contractEquipments: [],
  technicianEquipments: [],
  customerEquipments: [],
  removeEquipments: [],
  installedEquipments: [],
  removalStatus: {},
  markedForRemoval: [],
  pendingLossStatusList: [],
  reuseAll: false,
  selectedContract: null,
  selectedStock: null,
  signalStatus: 'idle',
  signalResult: '',
  filteringData: {},
  lastUpdated: null,
  isDataLoaded: false,
});

export const useWorkEquipmentStore = create<WorkEquipmentStore>()(
  persist(
    (set, get) => ({
      // 초기 상태
      workStates: {},
      currentWorkId: null,

      // 작업 상태 초기화
      initWorkState: (workId) => {
        set((state) => {
          if (state.workStates[workId]) return state;
          return {
            ...state,
            workStates: {
              ...state.workStates,
              [workId]: createDefaultState(),
            },
          };
        });
      },

      setCurrentWorkId: (workId) => {
        set((state) => {
          const newWorkStates = { ...state.workStates };
          if (workId && !newWorkStates[workId]) {
            newWorkStates[workId] = createDefaultState();
          }
          return {
            ...state,
            currentWorkId: workId,
            workStates: newWorkStates,
          };
        });
      },

      clearWorkState: (workId) => {
        set((state) => {
          const newWorkStates = { ...state.workStates };
          delete newWorkStates[workId];
          return {
            ...state,
            workStates: newWorkStates,
          };
        });
      },

      clearAllWorkStates: () => {
        set({ workStates: {}, currentWorkId: null });
      },

      // API 데이터 설정
      setApiData: (workId, data) => {
        // Debug log - API에서 받은 초기 장비 데이터
        console.log('[Equipment Store] API 데이터 수신', {
          workId,
          계약장비: data.contractEquipments?.length ?? 0,
          기사재고: data.technicianEquipments?.length ?? 0,
          고객장비: data.customerEquipments?.length ?? 0,
          철거장비: data.removeEquipments?.length ?? 0,
          상세: {
            contractEquipments: data.contractEquipments?.map(eq => ({ id: eq.id, model: eq.model, type: eq.type })),
            removeEquipments: data.removeEquipments?.map((eq: any) => ({ id: eq.id, model: eq.model, EQT_NO: eq.EQT_NO })),
          }
        });

        set((state) => {
          const currentWs = state.workStates[workId] || createDefaultState();
          const updatedWs: WorkEquipmentState = {
            ...currentWs,
            lastUpdated: new Date().toISOString(),
          };

          if (data.contractEquipments !== undefined) {
            updatedWs.contractEquipments = data.contractEquipments;
          }
          if (data.technicianEquipments !== undefined) {
            updatedWs.technicianEquipments = data.technicianEquipments;
          }
          if (data.customerEquipments !== undefined) {
            updatedWs.customerEquipments = data.customerEquipments;
          }
          if (data.removeEquipments !== undefined) {
            updatedWs.removeEquipments = data.removeEquipments;
          }
          if (data.filteringData !== undefined) {
            updatedWs.filteringData = data.filteringData;
          }

          return {
            ...state,
            workStates: {
              ...state.workStates,
              [workId]: updatedWs,
            },
          };
        });
      },

      // 설치 장비 관리
      addInstalledEquipment: (workId, item) => {
        set((state) => {
          const currentWs = state.workStates[workId] || createDefaultState();
          const existingIndex = currentWs.installedEquipments.findIndex(
            eq => eq.contractEquipment.id === item.contractEquipment.id
          );

          let newInstalled: InstalledEquipment[];
          if (existingIndex >= 0) {
            newInstalled = [...currentWs.installedEquipments];
            newInstalled[existingIndex] = item;
          } else {
            newInstalled = [...currentWs.installedEquipments, item];
          }

          // Debug log
          console.log('[Equipment Store] 장비 등록', {
            workId,
            action: existingIndex >= 0 ? '교체' : '추가',
            equipment: {
              contractId: item.contractEquipment.id,
              contractModel: item.contractEquipment.model,
              actualId: item.actualEquipment.id,
              actualModel: item.actualEquipment.model,
              EQT_CHG_GB: item.actualEquipment.EQT_CHG_GB,
            },
            총등록수: newInstalled.length,
          });

          return {
            ...state,
            workStates: {
              ...state.workStates,
              [workId]: {
                ...currentWs,
                installedEquipments: newInstalled,
                lastUpdated: new Date().toISOString(),
              },
            },
          };
        });
      },

      removeInstalledEquipment: (workId, contractId) => {
        set((state) => {
          const currentWs = state.workStates[workId];
          if (!currentWs) return state;

          const removed = currentWs.installedEquipments.find(eq => eq.contractEquipment.id === contractId);
          const newInstalled = currentWs.installedEquipments.filter(eq => eq.contractEquipment.id !== contractId);

          // Debug log
          console.log('[Equipment Store] 장비 등록 취소', {
            workId,
            removed: removed ? {
              contractId: removed.contractEquipment.id,
              actualId: removed.actualEquipment.id,
              model: removed.actualEquipment.model,
            } : null,
            남은등록수: newInstalled.length,
          });

          return {
            ...state,
            workStates: {
              ...state.workStates,
              [workId]: {
                ...currentWs,
                installedEquipments: newInstalled,
                lastUpdated: new Date().toISOString(),
              },
            },
          };
        });
      },

      updateInstalledEquipment: (workId, contractId, updates) => {
        set((state) => {
          const currentWs = state.workStates[workId];
          if (!currentWs) return state;

          const index = currentWs.installedEquipments.findIndex(
            eq => eq.contractEquipment.id === contractId
          );
          if (index < 0) return state;

          const newInstalled = [...currentWs.installedEquipments];
          newInstalled[index] = { ...newInstalled[index], ...updates };

          return {
            ...state,
            workStates: {
              ...state.workStates,
              [workId]: {
                ...currentWs,
                installedEquipments: newInstalled,
                lastUpdated: new Date().toISOString(),
              },
            },
          };
        });
      },

      setInstalledEquipments: (workId, items) => {
        set((state) => {
          const currentWs = state.workStates[workId] || createDefaultState();
          return {
            ...state,
            workStates: {
              ...state.workStates,
              [workId]: {
                ...currentWs,
                installedEquipments: items,
                lastUpdated: new Date().toISOString(),
              },
            },
          };
        });
      },

      clearInstalledEquipments: (workId) => {
        set((state) => {
          const currentWs = state.workStates[workId];
          if (!currentWs) return state;

          return {
            ...state,
            workStates: {
              ...state.workStates,
              [workId]: {
                ...currentWs,
                installedEquipments: [],
                lastUpdated: new Date().toISOString(),
              },
            },
          };
        });
      },

      // 철거 상태 관리
      setRemovalStatus: (workId, eqtNo, field, value) => {
        set((state) => {
          const currentWs = state.workStates[workId] || createDefaultState();
          const currentStatus = currentWs.removalStatus[eqtNo] || {};

          return {
            ...state,
            workStates: {
              ...state.workStates,
              [workId]: {
                ...currentWs,
                removalStatus: {
                  ...currentWs.removalStatus,
                  [eqtNo]: {
                    ...currentStatus,
                    [field]: value,
                  },
                },
                lastUpdated: new Date().toISOString(),
              },
            },
          };
        });
      },

      toggleRemovalStatus: (workId, eqtNo, field) => {
        set((state) => {
          const currentWs = state.workStates[workId] || createDefaultState();
          const currentStatus = currentWs.removalStatus[eqtNo] || {};
          const currentValue = currentStatus[field] || '0';
          const newValue = currentValue === '1' ? '0' : '1';

          // Debug log
          const fieldNames: Record<string, string> = {
            EQT_LOSS_YN: '장비분실',
            PART_LOSS_BRK_YN: '부품분실/파손',
            EQT_BRK_YN: '장비파손',
            EQT_CABL_LOSS_YN: '케이블분실',
            EQT_CRDL_LOSS_YN: '크래들분실',
          };
          console.log('[Equipment Store] 분실/파손 체크', {
            workId,
            eqtNo,
            field: fieldNames[field] || field,
            값: newValue === '1' ? 'Y' : 'N',
            전체상태: { ...currentStatus, [field]: newValue },
          });

          return {
            ...state,
            workStates: {
              ...state.workStates,
              [workId]: {
                ...currentWs,
                removalStatus: {
                  ...currentWs.removalStatus,
                  [eqtNo]: {
                    ...currentStatus,
                    [field]: newValue,
                  },
                },
                lastUpdated: new Date().toISOString(),
              },
            },
          };
        });
      },

      setFullRemovalStatus: (workId, status) => {
        set((state) => {
          const currentWs = state.workStates[workId] || createDefaultState();
          return {
            ...state,
            workStates: {
              ...state.workStates,
              [workId]: {
                ...currentWs,
                removalStatus: status,
                lastUpdated: new Date().toISOString(),
              },
            },
          };
        });
      },

      clearRemovalStatus: (workId) => {
        set((state) => {
          const currentWs = state.workStates[workId];
          if (!currentWs) return state;

          return {
            ...state,
            workStates: {
              ...state.workStates,
              [workId]: {
                ...currentWs,
                removalStatus: {},
                lastUpdated: new Date().toISOString(),
              },
            },
          };
        });
      },

      // 회수 장비 관리 (AS/상품변경용)
      addMarkedForRemoval: (workId, equipment) => {
        set((state) => {
          const currentWs = state.workStates[workId] || createDefaultState();
          const isAlreadyMarked = currentWs.markedForRemoval.some(eq => eq.id === equipment.id);
          if (isAlreadyMarked) return state;

          const newMarked = [...currentWs.markedForRemoval, equipment];

          // Debug log
          console.log('[Equipment Store] 회수 등록', {
            workId,
            equipment: {
              id: equipment.id,
              model: equipment.model,
              serialNumber: equipment.serialNumber,
              itemMidCd: equipment.itemMidCd,
            },
            총회수수: newMarked.length,
          });

          return {
            ...state,
            workStates: {
              ...state.workStates,
              [workId]: {
                ...currentWs,
                markedForRemoval: newMarked,
                lastUpdated: new Date().toISOString(),
              },
            },
          };
        });
      },

      removeMarkedForRemoval: (workId, eqtNo) => {
        set((state) => {
          const currentWs = state.workStates[workId];
          if (!currentWs) return state;

          const removed = currentWs.markedForRemoval.find(eq => eq.id === eqtNo);
          const newMarked = currentWs.markedForRemoval.filter(eq => eq.id !== eqtNo);

          // Debug log
          console.log('[Equipment Store] 회수 취소', {
            workId,
            removed: removed ? {
              id: removed.id,
              model: removed.model,
            } : null,
            남은회수수: newMarked.length,
          });

          return {
            ...state,
            workStates: {
              ...state.workStates,
              [workId]: {
                ...currentWs,
                markedForRemoval: newMarked,
                lastUpdated: new Date().toISOString(),
              },
            },
          };
        });
      },

      setMarkedForRemoval: (workId, equipments) => {
        set((state) => {
          const currentWs = state.workStates[workId] || createDefaultState();

          // Debug log
          console.log('[Equipment Store] 회수 목록 설정', {
            workId,
            총회수수: equipments.length,
            장비목록: equipments.map(eq => ({ id: eq.id, model: eq.model })),
          });

          return {
            ...state,
            workStates: {
              ...state.workStates,
              [workId]: {
                ...currentWs,
                markedForRemoval: equipments,
                lastUpdated: new Date().toISOString(),
              },
            },
          };
        });
      },

      clearMarkedForRemoval: (workId) => {
        set((state) => {
          const currentWs = state.workStates[workId];
          if (!currentWs) return state;

          return {
            ...state,
            workStates: {
              ...state.workStates,
              [workId]: {
                ...currentWs,
                markedForRemoval: [],
                lastUpdated: new Date().toISOString(),
              },
            },
          };
        });
      },

      // 분실 상태 목록 관리
      addPendingLossStatus: (workId, lossStatus) => {
        set((state) => {
          const currentWs = state.workStates[workId] || createDefaultState();
          // 같은 EQT_SERNO 장비는 제거하고 새로 추가
          const filtered = currentWs.pendingLossStatusList.filter(
            p => p.EQT_SERNO !== lossStatus.EQT_SERNO
          );

          return {
            ...state,
            workStates: {
              ...state.workStates,
              [workId]: {
                ...currentWs,
                pendingLossStatusList: [...filtered, lossStatus],
                lastUpdated: new Date().toISOString(),
              },
            },
          };
        });
      },

      setPendingLossStatusList: (workId, list) => {
        set((state) => {
          const currentWs = state.workStates[workId] || createDefaultState();
          return {
            ...state,
            workStates: {
              ...state.workStates,
              [workId]: {
                ...currentWs,
                pendingLossStatusList: list,
                lastUpdated: new Date().toISOString(),
              },
            },
          };
        });
      },

      clearPendingLossStatusList: (workId) => {
        set((state) => {
          const currentWs = state.workStates[workId];
          if (!currentWs) return state;

          return {
            ...state,
            workStates: {
              ...state.workStates,
              [workId]: {
                ...currentWs,
                pendingLossStatusList: [],
                lastUpdated: new Date().toISOString(),
              },
            },
          };
        });
      },

      // 전체 재사용 체크 (이전철거)
      setReuseAll: (workId, value) => {
        set((state) => {
          const currentWs = state.workStates[workId] || createDefaultState();

          console.log('[Equipment Store] 전체 재사용 설정', {
            workId,
            value: value ? 'Y' : 'N',
          });

          return {
            ...state,
            workStates: {
              ...state.workStates,
              [workId]: {
                ...currentWs,
                reuseAll: value,
                lastUpdated: new Date().toISOString(),
              },
            },
          };
        });
      },

      // 선택 상태 관리
      setSelectedContract: (workId, contract) => {
        set((state) => {
          const currentWs = state.workStates[workId] || createDefaultState();
          return {
            ...state,
            workStates: {
              ...state.workStates,
              [workId]: {
                ...currentWs,
                selectedContract: contract,
              },
            },
          };
        });
      },

      setSelectedStock: (workId, stock) => {
        set((state) => {
          const currentWs = state.workStates[workId] || createDefaultState();
          return {
            ...state,
            workStates: {
              ...state.workStates,
              [workId]: {
                ...currentWs,
                selectedStock: stock,
              },
            },
          };
        });
      },

      clearSelection: (workId) => {
        set((state) => {
          const currentWs = state.workStates[workId];
          if (!currentWs) return state;

          return {
            ...state,
            workStates: {
              ...state.workStates,
              [workId]: {
                ...currentWs,
                selectedContract: null,
                selectedStock: null,
              },
            },
          };
        });
      },

      // 신호처리 상태 관리
      setSignalStatus: (workId, status) => {
        set((state) => {
          const currentWs = state.workStates[workId] || createDefaultState();
          return {
            ...state,
            workStates: {
              ...state.workStates,
              [workId]: {
                ...currentWs,
                signalStatus: status,
              },
            },
          };
        });
      },

      setSignalResult: (workId, result) => {
        set((state) => {
          const currentWs = state.workStates[workId] || createDefaultState();
          return {
            ...state,
            workStates: {
              ...state.workStates,
              [workId]: {
                ...currentWs,
                signalResult: result,
              },
            },
          };
        });
      },

      // 데이터 로드 상태
      setDataLoaded: (workId, loaded) => {
        set((state) => {
          const currentWs = state.workStates[workId] || createDefaultState();
          return {
            ...state,
            workStates: {
              ...state.workStates,
              [workId]: {
                ...currentWs,
                isDataLoaded: loaded,
              },
            },
          };
        });
      },

      // Selectors
      getCurrentWorkState: () => {
        const { currentWorkId, workStates } = get();
        if (!currentWorkId) return null;
        return workStates[currentWorkId] || null;
      },

      getWorkState: (workId) => {
        return get().workStates[workId] || null;
      },
    }),
    {
      name: 'dlive-work-equipment-storage',
      partialize: (state) => ({
        // 작업별 상태 중 persist할 데이터만 선택
        workStates: Object.fromEntries(
          Object.entries(state.workStates).map(([workId, ws]) => [
            workId,
            {
              // 클라이언트 변경사항만 persist (API 데이터는 매번 조회)
              installedEquipments: ws.installedEquipments,
              removalStatus: ws.removalStatus,
              markedForRemoval: ws.markedForRemoval,
              pendingLossStatusList: ws.pendingLossStatusList,
              reuseAll: ws.reuseAll,
              signalStatus: ws.signalStatus,
              signalResult: ws.signalResult,
              filteringData: ws.filteringData,
              lastUpdated: ws.lastUpdated,
            },
          ])
        ),
        currentWorkId: state.currentWorkId,
      }),
      // localStorage에서 복원 시 기본 상태와 병합
      merge: (persistedState: any, currentState) => {
        const merged = { ...currentState };
        if (persistedState?.workStates) {
          merged.workStates = {};
          for (const [workId, ws] of Object.entries(persistedState.workStates)) {
            merged.workStates[workId] = {
              ...createDefaultState(),
              ...(ws as any),
            };
          }
        }
        if (persistedState?.currentWorkId) {
          merged.currentWorkId = persistedState.currentWorkId;
        }
        return merged;
      },
    }
  )
);

// 기본 반환 객체 (재사용하여 불필요한 객체 생성 방지)
const defaultWorkEquipmentResult = {
  workId: null as string | null,
  state: null as WorkEquipmentState | null,
  isReady: false,
  contractEquipments: [] as ContractEquipment[],
  technicianEquipments: [] as ExtendedEquipment[],
  customerEquipments: [] as ExtendedEquipment[],
  removeEquipments: [] as ExtendedEquipment[],
  installedEquipments: [] as InstalledEquipment[],
  removalStatus: {} as RemovalStatus,
  markedForRemoval: [] as ExtendedEquipment[],
  pendingLossStatusList: [] as LossStatusData[],
  selectedContract: null as ContractEquipment | null,
  selectedStock: null as ExtendedEquipment | null,
  signalStatus: 'idle' as const,
  signalResult: '',
  filteringData: {} as WorkEquipmentState['filteringData'],
};

// 편의를 위한 hooks
export const useCurrentWorkEquipment = () => {
  // 현재 workId와 해당 상태만 구독
  const currentWorkId = useWorkEquipmentStore((store) => store.currentWorkId);
  const state = useWorkEquipmentStore(
    (store) => currentWorkId ? store.workStates[currentWorkId] ?? null : null
  );

  if (!currentWorkId) {
    return defaultWorkEquipmentResult;
  }

  if (!state) {
    return {
      ...defaultWorkEquipmentResult,
      workId: currentWorkId,
    };
  }

  return {
    workId: currentWorkId,
    state,
    isReady: state.isDataLoaded ?? false,

    // 데이터
    contractEquipments: state.contractEquipments ?? [],
    technicianEquipments: state.technicianEquipments ?? [],
    customerEquipments: state.customerEquipments ?? [],
    removeEquipments: state.removeEquipments ?? [],
    installedEquipments: state.installedEquipments ?? [],
    removalStatus: state.removalStatus ?? {},
    markedForRemoval: state.markedForRemoval ?? [],
    pendingLossStatusList: state.pendingLossStatusList ?? [],

    // 선택 상태
    selectedContract: state.selectedContract ?? null,
    selectedStock: state.selectedStock ?? null,

    // 신호처리
    signalStatus: state.signalStatus ?? 'idle',
    signalResult: state.signalResult ?? '',

    // 필터링
    filteringData: state.filteringData ?? {},
  };
};

/**
 * 특정 작업의 장비 상태를 조회하는 hook
 * - 특정 workId의 상태만 구독하여 불필요한 재렌더링 방지
 */
export const useWorkEquipment = (workId: string | null) => {
  // 특정 workId의 상태만 구독 (selector 사용으로 다른 workId 변경 시 재렌더링 방지)
  const state = useWorkEquipmentStore(
    (store) => workId ? store.workStates[workId] ?? null : null
  );

  // workId가 없으면 기본값 반환
  if (!workId) {
    return defaultWorkEquipmentResult;
  }

  // state가 없으면 기본값 반환 (workId는 있음)
  if (!state) {
    return {
      ...defaultWorkEquipmentResult,
      workId,
    };
  }

  // state가 있으면 해당 상태 반환
  return {
    workId,
    state,
    isReady: state.isDataLoaded ?? false,

    contractEquipments: state.contractEquipments ?? [],
    technicianEquipments: state.technicianEquipments ?? [],
    customerEquipments: state.customerEquipments ?? [],
    removeEquipments: state.removeEquipments ?? [],
    installedEquipments: state.installedEquipments ?? [],
    removalStatus: state.removalStatus ?? {},
    markedForRemoval: state.markedForRemoval ?? [],
    pendingLossStatusList: state.pendingLossStatusList ?? [],

    selectedContract: state.selectedContract ?? null,
    selectedStock: state.selectedStock ?? null,

    signalStatus: state.signalStatus ?? 'idle',
    signalResult: state.signalResult ?? '',

    filteringData: state.filteringData ?? {},
  };
};
