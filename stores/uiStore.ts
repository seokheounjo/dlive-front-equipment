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
import dayjs from 'dayjs';

type View = 'today-work' | 'menu' | 'work-management' | 'work-order-detail' | 'work-process-flow' | 'work-complete-form' | 'work-complete-detail' | 'work-item-list' | 'customer-management' | 'equipment-management' | 'other-management' | 'coming-soon';
// FilterType은 WorkOrderStatus enum 값과 일치해야 함 (진행중, 완료, 취소)
type FilterType = '진행중' | '완료' | '취소' | '전체';

interface WorkFilters {
  startDate: string;
  endDate: string;
  filter: FilterType;
  workTypeFilter: string; // 작업유형 필터 (전체, 설치, 철거, A/S, 정지, 상품변경, 댁내이전, 이전설치, 이전철거, 부가상품)
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

// dayjs로 현재 월 기간 계산
const getCurrentMonthStart = () => dayjs().startOf('month').format('YYYY-MM-DD');
const getCurrentMonthEnd = () => dayjs().endOf('month').format('YYYY-MM-DD');

export const useUIStore = create<UIStore>()(
  persist(
    (set) => ({
      // 초기값
      isDrawerOpen: false,
      activeTab: 'work-receipt',
      currentView: 'today-work',
      workFilters: {
        startDate: getCurrentMonthStart(),
        endDate: getCurrentMonthEnd(),
        filter: '전체',
        workTypeFilter: '전체',
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
      // localStorage에서 불러올 때 기본값 병합 (새 필드 추가 시 대응)
      merge: (persistedState: any, currentState) => {
        const persistedFilter = persistedState?.workFilters?.filter;
        // 유효한 한글 필터값인지 확인 (이전 영어 값은 무효화)
        const validFilters = ['진행중', '완료', '취소', '전체'];
        const filter = validFilters.includes(persistedFilter) ? persistedFilter : '전체';

        return {
          ...currentState,
          ...persistedState,
          workFilters: {
            ...currentState.workFilters,
            ...(persistedState?.workFilters || {}),
            // filter가 유효한 한글 값이 아니면 '전체'로 설정
            filter,
            // workTypeFilter가 없거나 빈 값이면 '전체'로 설정
            workTypeFilter: persistedState?.workFilters?.workTypeFilter || '전체',
          },
        };
      },
    }
  )
);
