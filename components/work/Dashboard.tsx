import React, { useState, useEffect, useCallback, useMemo } from 'react';
import dayjs from 'dayjs';
import { WorkOrder, WorkOrderStatus, SmsSendData } from '../../types';
import WorkDirectionRow from './WorkDirectionRow';
import WorkOrderDetail from './WorkOrderDetail';
import WorkCompleteRouter from './process/complete';
import WorkItemList from './WorkItemList';
import WorkCancelModal from './WorkCancelModal';
import VisitSmsModal from '../modal/VisitSmsModal';
import SafetyCheckList from './safety/SafetyCheckList';
import WorkResultSignalList from './signal/WorkResultSignalList';
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
  userNameEn?: string;
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
  const [showSmsModal, setShowSmsModal] = useState(false);
  const [smsData, setSmsData] = useState<SmsSendData | null>(null);
  const [workStatusCounts, setWorkStatusCounts] = useState<Record<string, WorkStatusCounts>>({});
  const [isStatusCountsLoading, setIsStatusCountsLoading] = useState<boolean>(false);

  // UI Store 사용 (Zustand)
  const { activeTab, setActiveTab, workFilters, setWorkFilters } = useUIStore();

  const [isFilterExpanded, setIsFilterExpanded] = useState<boolean>(false);
  const tabListRef = React.useRef<HTMLDivElement>(null);
  const tabButtonRefs = React.useRef<(HTMLButtonElement | null)[]>([]);

  // 새로운 필터 상태들 (workTypeFilter는 uiStore에서 관리)
  const [dateFilterType, setDateFilterType] = useState<DateFilterType>('예정일');
  const [safetyCheckWarning, setSafetyCheckWarning] = useState<boolean>(false);
  // 안전점검 경고 닫으면 오늘 하루 동안 안 보이게 (localStorage 저장)
  const [dismissedSafetyWarning, setDismissedSafetyWarning] = useState<boolean>(() => {
    const dismissed = localStorage.getItem('safety_warning_dismissed');
    if (dismissed) {
      const dismissedDate = new Date(dismissed).toDateString();
      const today = new Date().toDateString();
      return dismissedDate === today;
    }
    return false;
  });
  const [showMapView, setShowMapView] = useState<boolean>(false);

  // 작업관리 하위 메뉴 탭 데이터
  const workManagementTabs = [
    { id: 'safety-check', title: '안전점검' },
    { id: 'work-receipt', title: '작업처리' },
    { id: 'work-result-signal', title: '작업결과신호현황' }
  ];

  // dayjs 날짜 포맷
  const DATE_FORMAT = 'YYYY-MM-DD';

  // UI Store에서 필터 상태 가져오기
  const { startDate, endDate, filter, workTypeFilter = '전체' } = workFilters;

  // React Query로 작업 목록 조회
  const { data: workOrders = [], isLoading, error: queryError, refetch } = useWorkOrders({ startDate, endDate });
  const error = queryError?.message || null;

  // 필터 업데이트 헬퍼 함수
  const updateFilters = (updates: Partial<typeof workFilters>) => {
    setWorkFilters({ ...workFilters, ...updates });
  };

  // 시작일 변경 핸들러 (해당 월의 1일~말일로 자동 설정)
  const handleStartDateChange = (newStartDate: string) => {
    const d = dayjs(newStartDate);
    updateFilters({
      startDate: d.startOf('month').format(DATE_FORMAT),
      endDate: d.endOf('month').format(DATE_FORMAT)
    });
  };

  // 종료일 변경 핸들러 (해당 월의 1일~말일로 자동 설정)
  const handleEndDateChange = (newEndDate: string) => {
    const d = dayjs(newEndDate);
    updateFilters({
      startDate: d.startOf('month').format(DATE_FORMAT),
      endDate: d.endOf('month').format(DATE_FORMAT)
    });
  };

  // 이전 달로 이동
  const goToPreviousMonth = () => {
    const prev = dayjs(startDate).subtract(1, 'month');
    updateFilters({
      startDate: prev.startOf('month').format(DATE_FORMAT),
      endDate: prev.endOf('month').format(DATE_FORMAT)
    });
  };

  // 다음 달로 이동
  const goToNextMonth = () => {
    const next = dayjs(startDate).add(1, 'month');
    updateFilters({
      startDate: next.startOf('month').format(DATE_FORMAT),
      endDate: next.endOf('month').format(DATE_FORMAT)
    });
  };
  
  // 작업 상태별 개수 조회 (React Query 데이터 로드 후 실행) - 병렬 처리
  useEffect(() => {
    const fetchWorkStatusCounts = async () => {
      // 실제 데이터 모드에서만 각 지시서의 상태별 작업개수 조회
      if (!checkDemoMode() && workOrders.length > 0) {
        setIsStatusCountsLoading(true);

        // 모든 작업지시서에 대해 병렬로 조회
        const promises = workOrders.map(async (order) => {
          try {
            const statusCounts = await getWorkStatusCountsForDirection(order.id);
            return { id: order.id, statusCounts };
          } catch (error) {
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
      } else if (workOrders.length === 0) {
        setIsStatusCountsLoading(false);
      }
    };

    fetchWorkStatusCounts();
  }, [workOrders]);

  // Zustand persist가 자동으로 workFilters를 localStorage에 저장
  // SESSION_KEYS.WORK_FILTERS 수동 저장 불필요

  // 작업처리 탭 진입 시 날짜가 월 단위(1일~말일)가 아니면 현재 월로 초기화
  useEffect(() => {
    if (activeTab === 'work-receipt') {
      const start = dayjs(startDate);
      const end = dayjs(endDate);
      const isFirstDay = start.date() === 1;
      const isLastDay = end.date() === end.endOf('month').date();

      // 시작일이 1일이 아니거나, 종료일이 해당 월의 말일이 아니면 현재 월로 초기화
      if (!isFirstDay || !isLastDay) {
        const now = dayjs();
        updateFilters({
          startDate: now.startOf('month').format(DATE_FORMAT),
          endDate: now.endOf('month').format(DATE_FORMAT)
        });
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab]); // startDate, endDate 의존성 제외 (무한루프 방지)

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

  // SMS 버튼 핸들러
  const handleSmsOrder = (order: WorkOrder) => {
    // scheduledAt ISO 형식(2025-01-15T14:30:00)을 YYYYMMDDHHmm으로 변환
    const convertToWrkHopeDttm = (isoDate: string | undefined): string => {
      if (!isoDate) return '';
      // ISO 형식이면 변환, 아니면 그대로 반환
      if (isoDate.includes('T') || isoDate.includes('-')) {
        const cleaned = isoDate.replace(/[-:T]/g, '').substring(0, 12);
        return cleaned;
      }
      return isoDate;
    };

    const data: SmsSendData = {
      SO_ID: (order as any).SO_ID || '',
      CUST_ID: (order as any).CUST_ID || order.customer?.id || '',
      CUST_NM: order.customer?.name || '',
      SMS_RCV_TEL: order.customer?.phone || (order as any).REQ_CUST_TEL_NO || '',  // 여러 번호 그대로 전달 (모달에서 Select로 선택)
      SMS_SEND_TEL: '',
      WRK_HOPE_DTTM: convertToWrkHopeDttm(order.scheduledAt),
      WRKR_NM: userInfo?.userName || '',
      WRKR_NM_EN: userInfo?.userNameEn || userInfo?.userName || '',
      WRK_CD: (order as any).WRK_CD || '',
      WRK_CD_NM: order.typeDisplay || '',
      WRK_DRCTN_ID: (order as any).WRK_DRCTN_ID || order.id || '',
      RCPT_ID: (order as any).RCPT_ID || ''
    };
    setSmsData(data);
    setShowSmsModal(true);
  };

  const handleCancelOrder = (order: WorkOrder) => {
    setCancelTarget(order);
    setShowCancelModal(true);
  };

  const handleCancelConfirm = async (cancelData: any) => {
    if (!cancelTarget) return;

    setIsLoading(true);
    setShowCancelModal(false);

    try {
      const result = await cancelWork(cancelData);

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
      return <WorkCompleteRouter
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
               key={selectedOrder.id}
               order={selectedOrder}
               onBack={() => setSelectedOrder(null)}
               onUpdateStatus={handleUpdateOrderStatus}
               onComplete={handleCompleteWork}
             />;
    }
  }
  
  const filteredOrders = workOrders.filter(order => {
    // 상태 필터
    if (filter !== '전체' && order.status !== filter) return false;

    // 작업유형 필터 (WRK_CD_NM으로 필터링: "설치", "철거", "A/S" 등 - CMWT000 코드 테이블 값)
    // workTypeFilter가 undefined이거나 '전체'면 필터링 안함
    if (workTypeFilter && workTypeFilter !== '전체' && order.WRK_CD_NM !== workTypeFilter) return false;

    return true;
  });

  // 활성 필터 개수 계산
  const getActiveFilterCount = () => {
    let count = 0;
    if (filter !== '전체') count++;
    if (workTypeFilter !== '전체') count++;
    return count;
  };

  // 모든 필터 초기화
  const clearAllFilters = () => {
    updateFilters({ filter: '전체', workTypeFilter: '전체' });
  };

  // 모든 데이터 표시
  const currentOrders = filteredOrders;

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
  // CMWT000 코드 테이블 순서 (WRK_CD 순)
  const WORK_TYPE_ORDER: Record<string, number> = {
    '설치': 1,
    '철거': 2,
    'A/S': 3,
    '정지': 4,
    '상품변경': 5,
    '댁내이전': 6,
    '이전설치': 7,
    '이전철거': 8,
    '부가상품': 9,
  };

  const workTypeOptions = useMemo(() => {
    const workTypes = new Set<string>();
    workOrders.forEach(order => {
      if (order.WRK_CD_NM) {
        workTypes.add(order.WRK_CD_NM);
      }
    });

    // CMWT000 코드 순서대로 정렬
    const sortedTypes = Array.from(workTypes).sort((a, b) => {
      const orderA = WORK_TYPE_ORDER[a] ?? 99;
      const orderB = WORK_TYPE_ORDER[b] ?? 99;
      return orderA - orderB;
    });

    return [
      { value: '전체', label: '전체' },
      ...sortedTypes.map(typeName => ({
        value: typeName,
        label: typeName
      }))
    ];
  }, [workOrders]);

  // workTypeFilter가 options에 없으면 '전체'로 리셋
  useEffect(() => {
    const validValues = workTypeOptions.map(opt => opt.value);
    if (workTypeFilter && !validValues.includes(workTypeFilter)) {
      updateFilters({ workTypeFilter: '전체' });
    }
  }, [workTypeOptions, workTypeFilter]);

  // 상태 필터 옵션 (Select용) - shortLabel은 버튼에, label은 드롭다운에 표시
  const statusOptions = useMemo(() => [
    { value: '전체', label: `전체 (${getFilterCount('전체')})`, shortLabel: '전체' },
    { value: WorkOrderStatus.Pending, label: `진행중 (${getFilterCount(WorkOrderStatus.Pending)})`, shortLabel: '진행중' },
    { value: WorkOrderStatus.Completed, label: `완료 (${getFilterCount(WorkOrderStatus.Completed)})`, shortLabel: '완료' },
    { value: WorkOrderStatus.Cancelled, label: `취소 (${getFilterCount(WorkOrderStatus.Cancelled)})`, shortLabel: '취소' },
  ], [workOrders]);

  // 날짜 기준 옵션
  const dateFilterOptions = [
    { value: '예정일', label: '예정일' },
    { value: '접수일', label: '접수일' },
  ];

  return (
    <div className="h-[calc(100vh-64px)] flex flex-col overflow-hidden">
      {/* Shadcn Tabs */}
      <Tabs value={activeTab} onValueChange={handleTabChange} className="w-full flex flex-col h-full overflow-hidden">
        <div className="flex-shrink-0 bg-white border-b border-gray-200">
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
        
        <TabsContent value="work-receipt" className="flex-1 flex flex-col overflow-hidden">
          {/* 고정 헤더 영역 */}
          <div className="flex-shrink-0 px-3 pt-1 bg-gray-50">
            {/* 안전점검 경고 배너 */}
            {safetyCheckWarning && !dismissedSafetyWarning && (
              <div className="mb-3 bg-yellow-50 border-l-4 border-yellow-400 p-3 rounded-lg shadow-sm">
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-3">
                    <AlertTriangle className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
                    <div>
                      <h3 className="text-sm font-semibold text-yellow-800">
                        오늘의 안전점검이 완료되지 않았습니다.
                      </h3>
                    </div>
                  </div>
                  <button
                    onClick={() => {
                      setDismissedSafetyWarning(true);
                      localStorage.setItem('safety_warning_dismissed', new Date().toISOString());
                    }}
                    className="text-yellow-600 hover:text-yellow-800 transition-colors"
                    title="닫기"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}


            {/* 토스 스타일 날짜/필터 섹션 */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 mb-3 overflow-hidden">
        {/* 날짜 선택 - 토스 스타일 */}
        <div className="p-3">
          <div className="flex items-center gap-1.5">
            <button
              onClick={goToPreviousMonth}
              className="p-2 rounded-full hover:bg-gray-100 active:bg-gray-200 transition-colors"
            >
              <ChevronLeft className="w-5 h-5 text-gray-500" />
            </button>

            <div className="flex-1 flex items-center justify-center gap-2">
              <div className="relative">
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => handleStartDateChange(e.target.value)}
                  className="absolute inset-0 opacity-0 cursor-pointer"
                  style={{ colorScheme: 'light' }}
                />
                <span className="text-sm font-semibold text-gray-800">
                  {new Date(startDate).toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' })}
                </span>
              </div>
              <span className="text-gray-300">—</span>
              <div className="relative">
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => handleEndDateChange(e.target.value)}
                  className="absolute inset-0 opacity-0 cursor-pointer"
                  style={{ colorScheme: 'light' }}
                />
                <span className="text-sm font-semibold text-gray-800">
                  {new Date(endDate).toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' })}
                </span>
              </div>
            </div>

            <button
              onClick={goToNextMonth}
              className="p-2 rounded-full hover:bg-gray-100 active:bg-gray-200 transition-colors"
            >
              <ChevronRight className="w-5 h-5 text-gray-500" />
            </button>
          </div>
        </div>

        {/* 필터 토글 - 컴팩트 */}
        <button
          onClick={() => setIsFilterExpanded(!isFilterExpanded)}
          className="w-full px-4 py-2.5 flex items-center justify-between border-t border-gray-100 hover:bg-gray-50 transition-colors"
        >
          <div className="flex items-center gap-2">
            <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
            </svg>
            <span className="text-sm text-gray-600">필터</span>
            {getActiveFilterCount() > 0 && (
              <span className="px-1.5 py-0.5 bg-blue-500 text-white text-xs font-medium rounded-full">
                {getActiveFilterCount()}
              </span>
            )}
          </div>
          <svg
            className={`w-4 h-4 text-gray-400 transition-transform duration-200 ${isFilterExpanded ? 'rotate-180' : ''}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>

        {/* 확장 필터 - 컴팩트 */}
        {isFilterExpanded && (
          <div className="px-4 py-3 bg-gray-50 border-t border-gray-100">
            {/* 상태 & 작업유형 & 날짜기준 - 한 줄에 3개 + 초기화 아이콘 */}
            <div className="flex items-end gap-2">
              <div className="flex-1 min-w-0">
                <label className="block text-xs font-medium text-gray-500 mb-1">상태</label>
                <Select
                  value={filter}
                  onValueChange={(val) => updateFilters({ filter: val as FilterType })}
                  options={statusOptions}
                />
              </div>
              <div className="flex-1 min-w-0">
                <label className="block text-xs font-medium text-gray-500 mb-1">작업유형</label>
                <Select
                  value={workTypeFilter}
                  onValueChange={(val) => updateFilters({ workTypeFilter: val })}
                  options={workTypeOptions}
                />
              </div>
              <div className="flex-1 min-w-0">
                <label className="block text-xs font-medium text-gray-500 mb-1">날짜기준</label>
                <Select
                  value={dateFilterType}
                  onValueChange={(val) => setDateFilterType(val as DateFilterType)}
                  options={dateFilterOptions}
                />
              </div>
              <button
                onClick={clearAllFilters}
                className={`p-2 rounded-lg transition-colors flex-shrink-0 ${
                  getActiveFilterCount() > 0
                    ? 'text-blue-600 bg-blue-50 hover:bg-blue-100'
                    : 'text-gray-400 bg-gray-100'
                }`}
                title="필터 초기화"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
              </button>
            </div>
          </div>
        )}
            </div>
          </div>

          {/* 스크롤 가능한 작업 목록 영역 */}
          <div className="flex-1 overflow-y-auto px-3 pb-4">
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
                        onSms={handleSmsOrder}
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

            {/* SMS 모달 */}
            <VisitSmsModal
              isOpen={showSmsModal}
              onClose={() => setShowSmsModal(false)}
              smsData={smsData}
              userId={userInfo?.userId || ''}
            />
          </div>
        </TabsContent>

        {/* 안전점검 탭 */}
        <TabsContent value="safety-check" className="px-3 pt-1 overflow-y-auto">
          <SafetyCheckList onBack={onNavigateToMenu} userInfo={userInfo} showToast={showToast} />
        </TabsContent>

        {/* 작업결과신호현황 탭 */}
        <TabsContent value="work-result-signal" className="px-3 pt-1 overflow-y-auto">
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