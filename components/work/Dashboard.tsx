import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { WorkOrder, WorkOrderStatus } from '../../types';
import WorkDirectionRow from '../work/WorkDirectionRow';
import WorkOrderDetail from '../work/WorkOrderDetail';
import WorkCompleteForm from '../work/WorkCompleteForm';
import WorkItemList from '../work/WorkItemList';
import WorkCancelModal from '../work/WorkCancelModal';
import VipCounter from '../common/VipCounter';
import SafetyCheckList from '../work/SafetyCheckList';
import WorkResultSignalList from '../work/WorkResultSignalList';
import FloatingMapButton from '../common/FloatingMapButton';
import WorkMapView from './WorkMapView';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '../ui/tabs';
import { cancelWork, checkDemoMode, getWorkStatusCountsForDirection, WorkStatusCounts, NetworkError, getSafetyChecks } from '../../services/apiService';
import LoadingSpinner from '../common/LoadingSpinner';
import ErrorMessage from '../common/ErrorMessage';
import { AlertTriangle, X, ChevronLeft, ChevronRight, ClipboardList } from 'lucide-react';
import Select from '../ui/Select';
import { useUIStore } from '../../stores/uiStore';
import { useWorkOrders } from '../../hooks/queries/useWorkOrders';

interface UserInfo {
  userId: string;
  userName: string;
  userRole: string;
  soId?: string;
  crrId?: string;
}

interface DashboardProps {
  onNavigateToMenu: () => void;
  onNavigateToView?: (view: string) => void;
  onNavigateToComingSoon?: (tabTitle: string) => void;
  userInfo?: UserInfo | null;
  showToast?: (message: string, type: 'success' | 'error' | 'warning' | 'info') => void;
}

type FilterType = WorkOrderStatus | '전체';
type DateFilterType = '예정일' | '접수일';

const Dashboard: React.FC<DashboardProps> = ({
  onNavigateToMenu,
  onNavigateToView,
  onNavigateToComingSoon,
  userInfo,
  showToast
}) => {
  // UI Store 사용 (Props Drilling 제거)
  const { setSelectedWorkItem, setSelectedWorkDirection: setStoreWorkDirection } = useUIStore();
  const [selectedOrder, setSelectedOrder] = useState<WorkOrder | null>(null);
  const [selectedDirection, setSelectedDirection] = useState<WorkOrder | null>(null);
  const [showCompleteForm, setShowCompleteForm] = useState<WorkOrder | null>(null);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [cancelTarget, setCancelTarget] = useState<WorkOrder | null>(null);
  const [workStatusCounts, setWorkStatusCounts] = useState<Record<string, WorkStatusCounts>>({});
  const [isStatusCountsLoading, setIsStatusCountsLoading] = useState<boolean>(false);

  // UI Store 사용 (Zustand)
  const { activeTab, setActiveTab, workFilters, setWorkFilters } = useUIStore();

  const [isFilterExpanded, setIsFilterExpanded] = useState<boolean>(false);
  const tabListRef = React.useRef<HTMLDivElement>(null);
  const tabButtonRefs = React.useRef<(HTMLButtonElement | null)[]>([]);

  // 새로운 필터 상태들
  const [workTypeFilter, setWorkTypeFilter] = useState<string>('전체');
  const [dateFilterType, setDateFilterType] = useState<DateFilterType>('예정일');
  const [showCurrentUserOnly, setShowCurrentUserOnly] = useState<boolean>(false);
  const [safetyCheckWarning, setSafetyCheckWarning] = useState<boolean>(false);
  const [dismissedSafetyWarning, setDismissedSafetyWarning] = useState<boolean>(false);
  const [showMapView, setShowMapView] = useState<boolean>(false);

  // 작업관리 하위 메뉴 탭 데이터
  const workManagementTabs = [
    { id: 'safety-check', title: '안전점검' },
    { id: 'work-receipt', title: '작업처리' },
    { id: 'work-result-signal', title: '작업결과신호현황' }
  ];

  const getTodayString = () => new Date().toISOString().split('T')[0];
  
  const get14DaysAgoString = () => {
    const today = new Date();
    const fourteenDaysAgo = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 14);
    return fourteenDaysAgo.toISOString().split('T')[0];
  };

  // 날짜 헬퍼들 - 과거/미래 자유롭게 선택 가능, 기간은 최대 7일
  const formatDate = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).toISOString().split('T')[0];

  const getEndMax = () => {
    // 종료일의 최대 선택 가능 일자 = 시작일 + 6일 (7일간)
    const start = new Date(startDate);
    const max = new Date(start);
    max.setDate(max.getDate() + 6);
    return formatDate(max);
  };
  const getEndMin = () => {
    // 종료일의 최소 선택 가능 일자 = 시작일
    return startDate;
  };
  const getStartMax = () => {
    // 시작일의 최대 선택 가능 일자 = 제한 없음
    return '2099-12-31';
  };
  const getStartMin = () => {
    // 시작일의 최소 선택 가능 일자 = 제한 없음
    return '2020-01-01';
  };

  // UI Store에서 필터 상태 가져오기
  const { startDate, endDate, filter } = workFilters;

  // React Query로 작업 목록 조회
  const { data: workOrders = [], isLoading, error: queryError, refetch } = useWorkOrders({ startDate, endDate });
  const error = queryError?.message || null;

  // 필터 업데이트 헬퍼 함수
  const updateFilters = (updates: Partial<typeof workFilters>) => {
    setWorkFilters({ ...workFilters, ...updates });
  };

  const handleStartDateChange = (newStartDate: string) => {
    // 시작일 변경 시 종료일을 자동으로 +6일로 설정 (1주일)
    const start = new Date(newStartDate);
    const autoEnd = new Date(start);
    autoEnd.setDate(autoEnd.getDate() + 6); // 시작일 포함 7일

    updateFilters({ startDate: newStartDate, endDate: formatDate(autoEnd) });
  };

  const handleEndDateChange = (newEndDate: string) => {
    const start = new Date(startDate);
    const end = new Date(newEndDate);
    const diffDays = Math.floor((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));

    if (diffDays > 6) {
      // 7일 초과 시 시작일을 종료일 기준 -6일로 자동 조정
      const autoStart = new Date(end);
      autoStart.setDate(autoStart.getDate() - 6);
      updateFilters({ startDate: formatDate(autoStart), endDate: newEndDate });
    } else if (diffDays < 0) {
      // 종료일이 시작일보다 이전이면 시작일과 종료일 교환
      updateFilters({ startDate: newEndDate, endDate: startDate });
    } else {
      updateFilters({ endDate: newEndDate });
    }
  };

  // 이번 주 월요일~일요일로 설정
  const setThisWeek = () => {
    const today = new Date();
    const dayOfWeek = today.getDay(); // 0: 일요일, 1: 월요일, ...
    const monday = new Date(today);
    monday.setDate(today.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1));
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6); // 월요일 + 6 = 일요일
    updateFilters({ startDate: formatDate(monday), endDate: formatDate(sunday) });
  };

  // 이전 주로 이동 (1주 전, 월~일 기준)
  const goToPreviousWeek = () => {
    const start = new Date(startDate);
    // 현재 시작일 기준으로 이전 주 월요일 계산
    const dayOfWeek = start.getDay();
    const prevMonday = new Date(start);
    prevMonday.setDate(start.getDate() - 7 - (dayOfWeek === 0 ? 6 : dayOfWeek - 1) + (dayOfWeek === 0 ? 6 : dayOfWeek - 1));
    // 간단하게: 현재 시작일에서 7일 빼기
    prevMonday.setDate(start.getDate() - 7);
    const prevSunday = new Date(prevMonday);
    prevSunday.setDate(prevMonday.getDate() + 6);
    updateFilters({ startDate: formatDate(prevMonday), endDate: formatDate(prevSunday) });
  };

  // 다음 주로 이동 (1주 후, 월~일 기준)
  const goToNextWeek = () => {
    const start = new Date(startDate);
    const nextMonday = new Date(start);
    nextMonday.setDate(start.getDate() + 7);
    const nextSunday = new Date(nextMonday);
    nextSunday.setDate(nextMonday.getDate() + 6);
    updateFilters({ startDate: formatDate(nextMonday), endDate: formatDate(nextSunday) });
  };

  // 현재 선택된 기간 텍스트 (예: "12/02 (월) ~ 12/08 (일)")
  const getDateRangeText = () => {
    const start = new Date(startDate);
    const end = new Date(endDate);
    const days = ['일', '월', '화', '수', '목', '금', '토'];
    const startText = `${start.getMonth() + 1}/${start.getDate()} (${days[start.getDay()]})`;
    const endText = `${end.getMonth() + 1}/${end.getDate()} (${days[end.getDay()]})`;
    return `${startText} ~ ${endText}`;
  };
  
  // 작업 상태별 개수 조회 (React Query 데이터 로드 후 실행) - 병렬 처리
  useEffect(() => {
    const fetchWorkStatusCounts = async () => {
      // 실제 데이터 모드에서만 각 지시서의 상태별 작업개수 조회
      if (!checkDemoMode() && workOrders.length > 0) {
        setIsStatusCountsLoading(true);
        console.log('🔍 각 작업지시서의 상태별 작업개수 병렬 조회 시작...');

        // 모든 작업지시서에 대해 병렬로 조회
        const promises = workOrders.map(async (order) => {
          try {
            const statusCounts = await getWorkStatusCountsForDirection(order.id);
            return { id: order.id, statusCounts };
          } catch (error) {
            console.error(`상태별 작업개수 조회 실패 - ${order.id}:`, error);
            return { id: order.id, statusCounts: { total: 1, pending: 1, completed: 0, cancelled: 0 } };
          }
        });

        const results = await Promise.all(promises);
        const counts: Record<string, WorkStatusCounts> = {};
        results.forEach(({ id, statusCounts }) => {
          counts[id] = statusCounts;
        });

        setWorkStatusCounts(counts);
        setIsStatusCountsLoading(false);
        console.log('✅ 상태별 작업개수 병렬 조회 완료:', counts);
      } else if (workOrders.length === 0) {
        setIsStatusCountsLoading(false);
      }
    };

    fetchWorkStatusCounts();
  }, [workOrders]);

  // Zustand persist가 자동으로 workFilters를 localStorage에 저장
  // SESSION_KEYS.WORK_FILTERS 수동 저장 불필요

  // 안전점검 확인 (오늘 안전점검이 있는지 체크)
  useEffect(() => {
    const checkTodaySafetyCheck = async () => {
      if (!userInfo?.soId || !userInfo?.crrId) return;

      try {
        const checks = await getSafetyChecks({
          SO_ID: userInfo.soId,
          CRR_ID: userInfo.crrId
        });

        const today = new Date().toISOString().split('T')[0].replace(/-/g, '');
        const hasTodayCheck = checks.some(check =>
          check.INSP_END_DT && check.INSP_END_DT.startsWith(today)
        );

        setSafetyCheckWarning(!hasTodayCheck);
      } catch (error) {
        console.error('안전점검 확인 실패:', error);
        // Gracefully handle API error - don't show warning banner if API fails
        // Assume safety check is OK to allow work to proceed
        setSafetyCheckWarning(false);
      }
    };

    if (activeTab === 'work-receipt') {
      checkTodaySafetyCheck();
    }
  }, [userInfo, activeTab]);

  // React Query가 자동으로 데이터 fetch (startDate, endDate 변경 시 자동 리페칭)

  const handleUpdateOrderStatus = async (orderId: string, status: WorkOrderStatus) => {
    // React Query 캐시 무효화 및 리페칭
    await refetch();
    if (selectedOrder && selectedOrder.id === orderId) {
      setSelectedOrder(null);
    }
  };
  
  const handleSelectOrder = (order: WorkOrder) => {
    // 작업지시서 카드 클릭 시 작업 목록으로 이동
    setStoreWorkDirection(order);
    if (onNavigateToView) {
      onNavigateToView('work-item-list');
    } else {
      setSelectedDirection(order);
    }
  };

  const handleCancelOrder = (order: WorkOrder) => {
    setCancelTarget(order);
    setShowCancelModal(true);
  };

  const handleCancelConfirm = async (cancelData: any) => {
    if (!cancelTarget) return;

    console.log('🔍 작업 취소 API 호출 - cancelData:', cancelData);

    setIsLoading(true);
    setShowCancelModal(false);

    try {
      const result = await cancelWork(cancelData);
      console.log('✅ 작업 취소 API 응답:', result);

      if (result.code === "SUCCESS" || result.code === "OK") {
        if (showToast) showToast('작업이 성공적으로 취소되었습니다.', 'success');
        await handleUpdateOrderStatus(cancelTarget.id, WorkOrderStatus.Cancelled);
      } else {
        if (showToast) showToast(`작업취소 실패: ${result.message}`, 'error');
      }
    } catch (error: any) {
      console.error('❌ 작업취소 오류:', error);

      // NetworkError인 경우 사용자 친화적인 메시지 사용
      const errorMessage = error instanceof NetworkError
        ? error.message
        : (error.message || '작업취소 중 오류가 발생했습니다.');

      if (showToast) showToast(errorMessage, 'error');
    } finally {
      setIsLoading(false);
      setCancelTarget(null);
    }
  };

  const handleCompleteWork = (order: WorkOrder) => {
    // 작업완료 입력 폼으로 이동
    setSelectedWorkItem(order);
    if (onNavigateToView) {
      onNavigateToView('work-complete-form');
    } else {
      setShowCompleteForm(order);
    }
  };

  const handleCompleteSuccess = async () => {
    // 작업 완료 성공 시 목록으로 복귀
    setShowCompleteForm(null);
    setSelectedOrder(null);
    // 작업 목록 새로고침
    await refetch();
    if (showToast) {
      showToast('작업이 성공적으로 완료되었습니다.', 'success');
    }
  };

  // 작업 상세 화면들은 이제 App.tsx에서 처리되지만,
  // onNavigateToView가 없을 때는 기존 방식으로 처리
  if (!onNavigateToView) {
    if (showCompleteForm) {
      return <WorkCompleteForm
               order={showCompleteForm}
               onBack={() => setShowCompleteForm(null)}
               onSuccess={handleCompleteSuccess}
               showToast={showToast} 
             />;
    }

    if (selectedDirection) {
      return <WorkItemList 
               direction={selectedDirection} 
               onBack={() => setSelectedDirection(null)} 
             />;
    }

    if (selectedOrder) {
      return <WorkOrderDetail 
               order={selectedOrder} 
               onBack={() => setSelectedOrder(null)} 
               onUpdateStatus={handleUpdateOrderStatus}
               onComplete={handleCompleteWork}
             />;
    }
  }
  
  const filters: FilterType[] = ['전체', WorkOrderStatus.Pending, WorkOrderStatus.Completed, WorkOrderStatus.Cancelled];

  const filteredOrders = workOrders.filter(order => {
    // 상태 필터
    if (filter !== '전체' && order.status !== filter) return false;

    // 작업유형 필터 (WRK_CD_NM으로 필터링: "설치", "해지" 등)
    if (workTypeFilter !== '전체' && order.WRK_CD_NM !== workTypeFilter) return false;

    // 현재 작업자만 보기
    if (showCurrentUserOnly && order.customer.name !== userInfo?.userName) return false;

    return true;
  });

  // 활성 필터 개수 계산
  const getActiveFilterCount = () => {
    let count = 0;
    if (filter !== '전체') count++;
    if (workTypeFilter !== '전체') count++;
    if (showCurrentUserOnly) count++;
    return count;
  };

  // 모든 필터 초기화
  const clearAllFilters = () => {
    updateFilters({ filter: '전체' });
    setWorkTypeFilter('전체');
    setShowCurrentUserOnly(false);
  };

  // 모든 데이터 표시
  const currentOrders = filteredOrders;

  // 필터 변경 함수
  const handleFilterChange = (newFilter: FilterType) => {
    updateFilters({ filter: newFilter });
  };

  const getFilterButtonClasses = (f: FilterType) => {
    const baseClasses = "px-2 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-sm font-medium rounded-full transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-50 flex items-center gap-1 sm:gap-2";
    if (f === filter) {
      return `${baseClasses} bg-blue-500 text-white shadow-sm`;
    }
    return `${baseClasses} bg-gray-100 text-gray-600 hover:bg-gray-200 border border-gray-200`;
  };

  const getFilterCount = (filterType: FilterType) => {
    if (filterType === '전체') {
      return workOrders.length;
    }
    return workOrders.filter(order => order.status === filterType).length;
  };

  const handleTabChange = (tabId: string) => {
    setActiveTab(tabId);
    // Zustand persist가 자동으로 localStorage에 저장

    // 선택된 탭을 중앙으로 스크롤 (ref 기반)
    const scrollToCenter = () => {
      const tabList = tabListRef.current;
      if (!tabList) return;
      const index = workManagementTabs.findIndex(t => t.id === tabId);
      const selectedBtn = tabButtonRefs.current[index];
      if (!selectedBtn) return;
      const containerWidth = tabList.getBoundingClientRect().width;
      const targetLeft = selectedBtn.offsetLeft - (containerWidth / 2) + (selectedBtn.offsetWidth / 2);
      tabList.scrollTo({ left: targetLeft, behavior: 'smooth' });
    };
    if (typeof window !== 'undefined') {
      if ('requestAnimationFrame' in window) {
        requestAnimationFrame(scrollToCenter);
      } else {
        setTimeout(scrollToCenter, 50);
      }
    }
    
    // 구현되지 않은 탭들만 준비중 화면으로 이동
    const implementedTabs = ['work-receipt', 'safety-check', 'signal-interlock', 'work-result-signal', 'lgu-construction', 'lgu-network-fault'];
    if (!implementedTabs.includes(tabId)) {
      const selectedTab = workManagementTabs.find(tab => tab.id === tabId);
      if (selectedTab && onNavigateToComingSoon) {
        onNavigateToComingSoon(selectedTab.title);
      }
    }
  };

  // 커스텀 Select용 옵션 구성 (실제 데이터에서 동적 추출)
  const workTypeOptions = useMemo(() => {
    const workTypes = new Set<string>();
    workOrders.forEach(order => {
      if (order.WRK_CD_NM) {
        workTypes.add(order.WRK_CD_NM);
      }
    });

    return [
      { value: '전체', label: '전체' },
      ...Array.from(workTypes).sort().map(typeName => ({
        value: typeName,
        label: typeName
      }))
    ];
  }, [workOrders]);

  return (
    <div>
      {/* Shadcn Tabs */}
      <Tabs value={activeTab} onValueChange={handleTabChange} className="w-full">
        <div className="sticky top-16 z-40 bg-white border-b border-gray-200">
          <TabsList ref={tabListRef} className="w-full justify-start bg-white rounded-none h-auto py-2 px-3 overflow-x-auto border-none">
            {workManagementTabs.map((tab, idx) => (
              <TabsTrigger 
                key={tab.id} 
                value={tab.id}
                ref={(el) => (tabButtonRefs.current[idx] = el)}
                className="data-[state=active]:bg-blue-500 data-[state=active]:text-white data-[state=inactive]:text-gray-600 rounded-full px-4 py-2 text-sm font-medium flex-shrink-0 mx-1 transition-colors"
              >
                {tab.title}
              </TabsTrigger>
            ))}
          </TabsList>
        </div>
        
        <TabsContent value="work-receipt" className="px-3 pt-1">

      {/* 안전점검 경고 배너 */}
      {safetyCheckWarning && !dismissedSafetyWarning && (
        <div className="mb-4 bg-yellow-50 border-l-4 border-yellow-400 p-4 rounded-lg shadow-sm">
          <div className="flex items-start justify-between">
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
              <div>
                <h3 className="text-sm font-semibold text-yellow-800 mb-1">
                  오늘의 안전점검이 완료되지 않았습니다
                </h3>
                <p className="text-xs text-yellow-700 mb-2">
                  작업 시작 전 안전점검을 완료해주세요.
                </p>
                <button
                  onClick={() => handleTabChange('safety-check')}
                  className="text-xs font-medium text-yellow-800 hover:text-yellow-900 underline"
                >
                  안전점검 페이지로 이동
                </button>
              </div>
            </div>
            <button
              onClick={() => setDismissedSafetyWarning(true)}
              className="text-yellow-600 hover:text-yellow-800 transition-colors"
              title="닫기"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* 헤더 영역 */}
      <div className="mb-4">
        {/* VIP 카운터 */}
        <VipCounter workOrders={workOrders} className="mb-4" />
      </div>
      
      {/* 검색 조건 - 컴팩트 디자인 */}
      <div className="mb-3">
        {/* 날짜 선택 */}
        <div className="flex items-center gap-2 mb-2">
          <input
            type="date"
            id="start-date"
            value={startDate}
            onChange={(e) => handleStartDateChange(e.target.value)}
            className="border border-gray-300 text-gray-900 text-sm sm:text-base rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 block w-full p-3 sm:p-2.5 flex-1 min-h-[48px]"
            style={{ colorScheme: 'light' }}
          />
          <span className="text-gray-500 text-sm font-medium">~</span>
          <input
            type="date"
            id="end-date"
            value={endDate}
            onChange={(e) => handleEndDateChange(e.target.value)}
            className="border border-gray-300 text-gray-900 text-sm sm:text-base rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 block w-full p-3 sm:p-2.5 flex-1 min-h-[48px]"
            style={{ colorScheme: 'light' }}
          />
        </div>

        {/* 필터 토글 버튼 - 아래로 이동 */}
        <button
          onClick={() => setIsFilterExpanded(!isFilterExpanded)}
          className="w-full p-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-md transition-colors text-xs font-medium flex items-center justify-center gap-1"
        >
          <svg
            className={`w-4 h-4 transition-transform duration-200 ${
              isFilterExpanded ? 'rotate-180' : ''
            }`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
          </svg>
          {isFilterExpanded ? "필터 접기" : "필터 펼치기"}
        </button>

        {/* 확장 필터 섹션 */}
        {isFilterExpanded && (
          <div className="space-y-2 pt-2 mt-2 border-t border-gray-200">
            {/* 활성 필터 칩 표시 및 전체 초기화 버튼 */}
            {getActiveFilterCount() > 0 && (
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs text-gray-600">
                  {getActiveFilterCount()}개 필터 적용 중
                </span>
                <button
                  onClick={clearAllFilters}
                  className="text-xs text-blue-600 hover:text-blue-700 font-medium"
                >
                  전체 초기화
                </button>
              </div>
            )}

            {/* 상태 필터 */}
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1.5">상태</label>
              <div className="flex flex-wrap items-center gap-1 sm:gap-2">
                {filters.map(f => (
                  <button key={f} onClick={() => handleFilterChange(f)} className={getFilterButtonClasses(f)}>
                    <span className="whitespace-nowrap">{f}</span>
                    <span className={`text-xs px-1.5 sm:px-2 py-0.5 rounded-full min-w-[20px] text-center ${
                      f === filter
                        ? 'bg-white/20 text-white'
                        : 'bg-gray-100 text-gray-600'
                    }`}>
                      {getFilterCount(f)}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            {/* 작업유형 필터 */}
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1.5">작업유형</label>
              <Select
                value={workTypeFilter}
                onValueChange={(val) => setWorkTypeFilter(val)}
                options={workTypeOptions}
                placeholder="작업유형 선택"
              />
            </div>

            {/* 날짜 필터 유형 토글 */}
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1.5">날짜 기준</label>
              <div className="flex gap-2">
                <button
                  onClick={() => setDateFilterType('예정일')}
                  className={`flex-1 px-3 py-2 text-sm font-medium rounded-lg transition-colors ${
                    dateFilterType === '예정일'
                      ? 'bg-blue-500 text-white'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  예정일
                </button>
                <button
                  onClick={() => setDateFilterType('접수일')}
                  className={`flex-1 px-3 py-2 text-sm font-medium rounded-lg transition-colors ${
                    dateFilterType === '접수일'
                      ? 'bg-blue-500 text-white'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  접수일
                </button>
              </div>
            </div>

            {/* 현재 작업자만 보기 토글 */}
            <div>
              <label className="flex items-center justify-between cursor-pointer">
                <span className="text-xs font-semibold text-gray-700">현재 작업자만 보기</span>
                <div className="relative">
                  <input
                    type="checkbox"
                    checked={showCurrentUserOnly}
                    onChange={(e) => setShowCurrentUserOnly(e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-500"></div>
                </div>
              </label>
              {showCurrentUserOnly && userInfo?.userName && (
                <p className="text-xs text-gray-500 mt-1">
                  작업자: {userInfo.userName}
                </p>
              )}
            </div>
          </div>
        )}
      </div>
      
      {isLoading || isStatusCountsLoading ? (
          <LoadingSpinner size="medium" message={isLoading ? "작업 목록을 불러오는 중..." : "작업 상태를 불러오는 중..."} />
      ) : error ? (
          <ErrorMessage
            type="error"
            message={error}
            onRetry={() => refetch()}
          />
      ) : (
        <div>
          {filteredOrders.length > 0 ? (
            <div className="space-y-3">
              {/* 카드 형식으로 작업지시서 표시 */}
              {currentOrders.map((order, index) => (
                <WorkDirectionRow
                  key={order.id}
                  direction={order}
                  index={index + 1}
                  onSelect={handleSelectOrder}
                  workStatusCounts={workStatusCounts[order.id]}
                />
              ))}
            </div>
          ) : (
            <div className="text-center py-10 sm:py-12 px-4 sm:px-6 bg-white rounded-xl shadow-sm border border-gray-100">
              <div className="w-16 h-16 sm:w-20 sm:h-20 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <ClipboardList className="w-8 h-8 sm:w-10 sm:h-10 text-gray-400" />
              </div>
              <h4 className="text-sm sm:text-base font-bold text-gray-900 mb-2 whitespace-nowrap">선택하신 기간에 작업이 없습니다</h4>
            </div>
          )}
        </div>
      )}

      {/* 작업취소 모달 */}
      {cancelTarget && (
        <WorkCancelModal
          isOpen={showCancelModal}
          onClose={() => {
            setShowCancelModal(false);
            setCancelTarget(null);
          }}
          onConfirm={handleCancelConfirm}
          workOrder={cancelTarget}
          userId={userInfo?.userId}
          showToast={showToast}
        />
      )}
        </TabsContent>

        {/* 안전점검 탭 */}
        <TabsContent value="safety-check" className="px-3 pt-1">
          <SafetyCheckList onBack={onNavigateToMenu} userInfo={userInfo} showToast={showToast} />
        </TabsContent>

        {/* 작업결과신호현황 탭 */}
        <TabsContent value="work-result-signal" className="px-3 pt-1">
          <WorkResultSignalList onBack={onNavigateToMenu} />
        </TabsContent>

      </Tabs>

      {/* 플로팅 지도 버튼 - 작업처리 탭에서만 표시 */}
      {activeTab === 'work-receipt' && !isLoading && !error && filteredOrders.length > 0 && (
        <FloatingMapButton
          onClick={() => setShowMapView(true)}
          workCount={filteredOrders.length}
        />
      )}

      {/* 지도 뷰 */}
      {showMapView && (
        <WorkMapView
          workOrders={filteredOrders}
          onBack={() => setShowMapView(false)}
          onSelectWork={(work) => {
            setShowMapView(false);
            handleSelectOrder(work);
          }}
        />
      )}
    </div>
  );
};

export default Dashboard;