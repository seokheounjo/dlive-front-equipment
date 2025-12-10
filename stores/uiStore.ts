/**
 * UI 상태 관리 Store
 * - 모달 열림/닫힘
 * - 활성 탭
 * - 현재 View (라우팅)
 * - 작업 필터
 * - 선택된 작업 항목 (Props Drilling 제거)
 */
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

type View = 'today-work' | 'menu' | 'work-management' | 'work-order-detail' | 'work-process-flow' | 'work-complete-form' | 'work-complete-detail' | 'work-item-list' | 'customer-management' | 'equipment-management' | 'other-management' | 'coming-soon';
type FilterType = 'Pending' | 'Completed' | 'Cancelled' | '전체';

interface WorkFilters {
  startDate: string;
  endDate: string;
  filter: FilterType;
}

interface UIStore {
  // 사이드 드로어
  isDrawerOpen: boolean;
  openDrawer: () => void;
  closeDrawer: () => void;

  // 활성 탭
  activeTab: string;
  setActiveTab: (tab: string) => void;

  // 현재 View (라우팅)
  currentView: View;
  setCurrentView: (view: View) => void;

  // 작업 필터
  workFilters: WorkFilters;
  setWorkFilters: (filters: WorkFilters) => void;

  // 선택된 작업 항목 (Props Drilling 제거)
  selectedWorkItem: any | null;
  setSelectedWorkItem: (item: any | null) => void;

  // 선택된 작업 지시 (WorkItemList용)
  selectedWorkDirection: any | null;
  setSelectedWorkDirection: (direction: any | null) => void;
}

const getTodayString = () => new Date().toISOString().split('T')[0];

export const useUIStore = create<UIStore>()(
  persist(
    (set) => ({
      // 초기값
      isDrawerOpen: false,
      activeTab: 'work-receipt',
      currentView: 'today-work',
      workFilters: {
        startDate: getTodayString(),
        endDate: getTodayString(),
        filter: '전체',
      },
      selectedWorkItem: null,
      selectedWorkDirection: null,

      // Actions
      openDrawer: () => set({ isDrawerOpen: true }),
      closeDrawer: () => set({ isDrawerOpen: false }),
      setActiveTab: (tab: string) => set({ activeTab: tab }),
      setCurrentView: (view: View) => set({ currentView: view }),
      setWorkFilters: (filters: WorkFilters) => set({ workFilters: filters }),
      setSelectedWorkItem: (item: any | null) => set({ selectedWorkItem: item }),
      setSelectedWorkDirection: (direction: any | null) => set({ selectedWorkDirection: direction }),
    }),
    {
      name: 'dlive-ui-storage', // localStorage 키
      partialize: (state) => ({
        activeTab: state.activeTab,
        currentView: state.currentView,
        workFilters: state.workFilters,
        // selectedWorkItem과 selectedWorkDirection은 persist하지 않음 (세션 간 유지 불필요)
      }),
    }
  )
);
