import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import dayjs from 'dayjs';
import { WorkOrder, WorkDirection, WorkOrderStatus, SmsSendData } from '../../types';
import WorkDirectionRow from './WorkDirectionRow';
import WorkOrderDetail from './WorkOrderDetail';
import WorkCompleteRouter from './process/complete';
import WorkItemList from './WorkItemList';
import WorkCancelModal from './WorkCancelModal';
import VisitSmsModal from '../modal/VisitSmsModal';
import WorkerAdjustmentModal from '../modal/WorkerAdjustmentModal';
import SafetyCheckList from './safety/SafetyCheckList';
import WorkResultSignalList from './signal/WorkResultSignalList';
import SignalIntegration from '../other/SignalIntegration';
import FloatingMapButton from '../common/FloatingMapButton';
import WorkMapView from './WorkMapView';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '../ui/tabs';
import { cancelWork,  parseWorkStatusFromStrings, WorkStatusCounts, NetworkError, getSafetyCheckResultInfo, getAfterProcInfo } from '../../services/apiService';
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
  const [showWorkerAdjustModal, setShowWorkerAdjustModal] = useState(false);
  const [workerAdjustTarget, setWorkerAdjustTarget] = useState<WorkOrder | null>(null);
  const [workStatusCounts, setWorkStatusCounts] = useState<Record<string, WorkStatusCounts>>({});
  const [isStatusCountsLoading, setIsStatusCountsLoading] = useState<boolean>(false);

  // UI Store 사용 (Zustand)
  const { activeTab, setActiveTab, workFilters, setWorkFilters, recontractMap, setRecontractMap } = useUIStore();

  const [isDatePickerOpen, setIsDatePickerOpen] = useState<boolean>(false);
  const [tempStartDate, setTempStartDate] = useState<string>('');
  const [tempEndDate, setTempEndDate] = useState<string>('');
  const [calendarMonth, setCalendarMonth] = useState<dayjs.Dayjs>(dayjs()); // calendar view month
  const [selectingPhase, setSelectingPhase] = useState<'start' | 'end'>('start'); // start or end date selecting
  const [isFilterVisible, setIsFilterVisible] = useState<boolean>(true);
  const tabListRef = useRef<HTMLDivElement>(null);
  const tabButtonRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const lastScrollY = useRef<number>(0);

  // 새로운 필터 상태들 (workTypeFilter는 uiStore에서 관리)
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
    { id: 'work-result-signal', title: '작업신호' },
    { id: 'signal-interlock', title: '신호연동' }
  ];

  // dayjs 날짜 포맷
  const DATE_FORMAT = 'YYYY-MM-DD';

  // UI Store에서 필터 상태 가져오기
  const { startDate, endDate, filter, workTypeFilter = '전체' } = workFilters;

  // 작업처리 탭 진입 시 상태 필터를 '진행중'으로 설정 (hydration 후 실행)
  useEffect(() => {
    // 약간의 지연을 줘서 zustand hydration이 완료된 후 실행
    const timer = setTimeout(() => {
      if (activeTab === 'work-receipt') {
        const currentFilters = useUIStore.getState().workFilters;
        useUIStore.getState().setWorkFilters({ ...currentFilters, filter: '진행중' as any });
      }
    }, 100);
    return () => clearTimeout(timer);
  }, [activeTab]);

  // React Query로 작업 목록 조회
  const { data: directions = [], isLoading, isFetching, error: queryError, refetch } = useWorkOrders({ startDate, endDate });
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

  // 날짜 피커 열기
  const openDatePicker = () => {
    setTempStartDate(startDate);
    setTempEndDate(endDate);
    setCalendarMonth(dayjs(startDate));
    setSelectingPhase('start');
    setIsDatePickerOpen(true);
  };

  // 캘린더 날짜 클릭
  const handleCalendarDayClick = (dateStr: string) => {
    if (selectingPhase === 'start') {
      setTempStartDate(dateStr);
      setTempEndDate('');
      setSelectingPhase('end');
    } else {
      // end phase
      if (dayjs(dateStr).isBefore(dayjs(tempStartDate))) {
        // clicked before start → reset start
        setTempStartDate(dateStr);
        setTempEndDate('');
        setSelectingPhase('end');
      } else {
        setTempEndDate(dateStr);
        setSelectingPhase('start');
      }
    }
  };

  // 캘린더 그리드 생성
  const calendarDays = useMemo(() => {
    const first = calendarMonth.startOf('month');
    const last = calendarMonth.endOf('month');
    const startDay = first.day(); // 0=Sun
    const daysInMonth = last.date();

    const days: { date: string; day: number; isCurrentMonth: boolean }[] = [];

    // prev month padding
    const prevMonth = first.subtract(1, 'month');
    const prevDays = prevMonth.daysInMonth();
    for (let i = startDay - 1; i >= 0; i--) {
      const d = prevDays - i;
      days.push({ date: prevMonth.date(d).format(DATE_FORMAT), day: d, isCurrentMonth: false });
    }

    // current month
    for (let d = 1; d <= daysInMonth; d++) {
      days.push({ date: first.date(d).format(DATE_FORMAT), day: d, isCurrentMonth: true });
    }

    // next month padding (fill to 42 = 6 rows)
    const remaining = 42 - days.length;
    const nextMonth = first.add(1, 'month');
    for (let d = 1; d <= remaining; d++) {
      days.push({ date: nextMonth.date(d).format(DATE_FORMAT), day: d, isCurrentMonth: false });
    }

    return days;
  }, [calendarMonth]);

  // 날짜 피커 적용
  const applyDateRange = () => {
    if (tempStartDate && tempEndDate) {
      updateFilters({ startDate: tempStartDate, endDate: tempEndDate });
    }
    setIsDatePickerOpen(false);
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
  
  // 작업 상태별 개수 조회 - PROD_GRPS/WRK_STATS 필드에서 파싱 (receipt API 호출 없음)
  // 백엔드 getWorkdrctnList_ForM에서 PROD_GRPS, WRK_STATS 필드를 반환
  useEffect(() => {
    if (directions.length > 0) {
      setIsStatusCountsLoading(true);

      const counts: Record<string, WorkStatusCounts> = {};

      // PROD_GRPS/WRK_STATS 필드에서 상태 카운트 파싱 (receipt API 호출 없음)
      directions.forEach((order) => {
        const parsedCounts = parseWorkStatusFromStrings(order.PROD_GRPS, order.WRK_STATS);
        if (parsedCounts && parsedCounts.total > 0) {
          counts[order.id] = parsedCounts;
        } else {
          // 파싱 결과가 없으면 기본값 사용 (진행중 1건으로 표시)
          counts[order.id] = {
            total: 1,
            pending: 1,
            completed: 0,
            cancelled: 0,
            pendingByProdGrp: {},
            completedByProdGrp: {}
          };
        }
      });

      setWorkStatusCounts(counts);
      setIsStatusCountsLoading(false);
    } else if (directions.length === 0) {
      setIsStatusCountsLoading(false);
    }
  }, [directions]);

  // 재약정 대상 맵 (directions의 CLOSE_DANGER 필드에서 직접 생성)
  useEffect(() => {
    if (directions.length === 0) return;
    const map: Record<string, boolean> = {};
    directions.forEach((d: any) => {
      if (d.CLOSE_DANGER === 'Y') {
        map[d.id] = true;
      }
    });
    setRecontractMap(map);
  }, [directions, setRecontractMap]);

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

  // 안전점검 확인 (오늘 안전점검 제출 여부 체크)
  useEffect(() => {
    const checkTodaySafetyCheck = async () => {
      if (!userInfo?.userId) return;

      try {
        // getSafetyCheckResultInfo: 오늘 제출된 체크리스트 답변 조회
        const results = await getSafetyCheckResultInfo(userInfo.userId);

        // 결과가 있으면 오늘 안전점검 완료
        const hasTodayCheck = results && results.length > 0;

        setSafetyCheckWarning(!hasTodayCheck);
      } catch (error) {
        console.error('안전점검 확인 실패:', error);
        // Gracefully handle API error - don't show warning banner if API fails
        setSafetyCheckWarning(false);
      }
    };

    if (activeTab === 'work-receipt') {
      checkTodaySafetyCheck();
    }
  }, [userInfo, activeTab]);

  // 스크롤 방향에 따른 필터 영역 숨김/표시 (모바일 최적화)
  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;

    let ticking = false;
    let pendingVisible: boolean | null = null;
    let debounceTimer: ReturnType<typeof setTimeout> | null = null;

    const applyVisibility = (visible: boolean) => {
      // 실제 상태 변경은 debounce 후 적용
      if (debounceTimer) clearTimeout(debounceTimer);

      debounceTimer = setTimeout(() => {
        setIsFilterVisible(prev => {
          // 이미 같은 상태면 변경 안 함
          if (prev === visible) return prev;
          return visible;
        });
      }, 50); // 50ms debounce
    };

    const updateFilterVisibility = () => {
      const currentScrollY = container.scrollTop;
      const scrollDelta = currentScrollY - lastScrollY.current;
      const maxScroll = container.scrollHeight - container.clientHeight;

      // 스크롤 가능 영역이 부족하면 필터 항상 표시 (컨텐츠 짧을 때 필터 사라짐 방지)
      if (maxScroll <= 30) {
        applyVisibility(true);
        lastScrollY.current = currentScrollY;
        ticking = false;
        return;
      }

      // 스크롤 끝 영역에서는 상태 변경 안 함 (바운스 방지)
      const isAtBottom = currentScrollY >= maxScroll - 10;
      const isAtTop = currentScrollY <= 10;

      if (isAtBottom || isAtTop) {
        lastScrollY.current = currentScrollY;
        ticking = false;
        return;
      }

      // 임계값 (15px) - 민감도 낮춤
      if (Math.abs(scrollDelta) < 15) {
        ticking = false;
        return;
      }

      if (scrollDelta > 0 && currentScrollY > 80) {
        // 아래로 스크롤 & 최상단이 아닐 때 -> 숨김
        applyVisibility(false);
      } else if (scrollDelta < -5) {
        // 위로 스크롤 (5px 이상) -> 표시
        applyVisibility(true);
      }

      lastScrollY.current = currentScrollY;
      ticking = false;
    };

    const handleScroll = () => {
      // requestAnimationFrame으로 throttle (60fps 동기화)
      if (!ticking) {
        requestAnimationFrame(updateFilterVisibility);
        ticking = true;
      }
    };

    container.addEventListener('scroll', handleScroll, { passive: true });
    return () => {
      container.removeEventListener('scroll', handleScroll);
      if (debounceTimer) clearTimeout(debounceTimer);
    };
  }, []);

  // React Query가 자동으로 데이터 fetch (startDate, endDate 변경 시 자동 리페칭)

  const handleUpdateOrderStatus = async (orderId: string, status: WorkOrderStatus) => {
    // React Query 캐시 무효화 및 리페칭
    await refetch();
    if (selectedOrder && selectedOrder.id === orderId) {
      setSelectedOrder(null);
    }
  };
  
  const handleSelectDirection = (order: WorkOrder) => {
    // 작업지시서 카드 클릭 시 작업 목록으로 이동
    setStoreWorkDirection(order);
    if (onNavigateToView) {
      onNavigateToView('work-item-list');
    } else {
      setSelectedDirection(order);
    }
  };

  // SMS 버튼 핸들러
  const handleSmsDirection = (order: WorkOrder) => {
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
      SMS_SEND_TEL: (userInfo as any)?.telNo2 || '',
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

  const handleCancelDirection = (order: WorkOrder) => {
    setCancelTarget(order);
    setShowCancelModal(true);
  };

  // Worker adjustment handler
  const handleWorkerAdjust = (order: WorkOrder) => {
    setWorkerAdjustTarget(order);
    setShowWorkerAdjustModal(true);
  };

  const handleWorkerAdjustSuccess = () => {
    // Refresh the list after successful adjustment
    refetch();
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
        if (showToast) showToast(`작업취소 실패: ${result.message}`, 'error', true);
      }
    } catch (error: any) {
      console.error('작업취소 오류:', error);

      // NetworkError인 경우 사용자 친화적인 메시지 사용
      const errorMessage = error instanceof NetworkError
        ? error.message
        : (error.message || '작업취소 중 오류가 발생했습니다.');

      if (showToast) showToast(errorMessage, 'error', true);
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
  
  const filteredDirections = directions.filter(order => {
    // 상태 필터
    if (filter !== '전체') {
      // receipts가 빈 배열이면 취소로 간주 (isEmpty 플래그)
      const counts = workStatusCounts[order.id];
      const isEmptyReceipts = counts?.isEmpty === true;

      if (filter === WorkOrderStatus.Cancelled) {
        // 취소 필터: order.status가 취소이거나 receipts가 비어있으면 포함
        if (order.status !== WorkOrderStatus.Cancelled && !isEmptyReceipts) return false;
      } else {
        // 다른 필터: receipts가 비어있으면 취소로 간주하므로 제외
        if (isEmptyReceipts) return false;
        if (order.status !== filter) return false;
      }
    }

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

  // 작업 목록 새로고침
  const refreshDirections = () => {
    refetch();
  };

  // 모든 데이터 표시
  const currentDirections = filteredDirections;

  const getFilterCount = (filterType: FilterType) => {
    if (filterType === '전체') {
      return directions.length;
    }
    return directions.filter(order => {
      const counts = workStatusCounts[order.id];
      const isEmptyReceipts = counts?.isEmpty === true;

      if (filterType === WorkOrderStatus.Cancelled) {
        // 취소 필터: order.status가 취소이거나 receipts가 비어있으면 포함
        return order.status === WorkOrderStatus.Cancelled || isEmptyReceipts;
      } else {
        // 다른 필터: receipts가 비어있으면 취소로 간주하므로 제외
        if (isEmptyReceipts) return false;
        return order.status === filterType;
      }
    }).length;
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
    directions.forEach(order => {
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
  }, [directions]);

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
  ], [directions]);


  return (
    <div className="h-[calc(100dvh-64px)] flex flex-col overflow-hidden">
      {/* Shadcn Tabs */}
      <Tabs value={activeTab} onValueChange={handleTabChange} className="w-full flex flex-col h-full overflow-hidden">
        <div className="flex-shrink-0 bg-white border-b border-gray-200">
          <TabsList ref={tabListRef} className="w-full justify-start bg-white rounded-none h-auto py-2 px-3 overflow-x-auto border-none">
            {workManagementTabs.map((tab, idx) => (
              <TabsTrigger 
                key={tab.id} 
                value={tab.id}
                ref={(el) => (tabButtonRefs.current[idx] = el)}
                className="data-[state=active]:bg-primary-500 data-[state=active]:text-white data-[state=inactive]:text-gray-600 rounded-full px-4 py-2 text-sm font-medium flex-shrink-0 mx-1 transition-colors"
              >
                {tab.title}
              </TabsTrigger>
            ))}
          </TabsList>
        </div>
        
        <TabsContent value="work-receipt" className="flex-1 data-[state=active]:flex flex-col overflow-hidden">
          {/* 필터 영역 - 스크롤 시 숨김/표시 (GPU 가속 transform 방식) */}
          <div
            className={`flex-shrink-0 bg-gray-50 grid transition-[grid-template-rows] duration-300 ease-out ${
              isFilterVisible
                ? 'grid-rows-[1fr]'
                : 'grid-rows-[0fr]'
            }`}
            style={{ willChange: 'grid-template-rows' }}
          >
            <div className={`min-h-0 overflow-hidden px-3 pt-1 transition-opacity duration-200 ${
              isFilterVisible ? 'opacity-100' : 'opacity-0'
            }`}
          >
            {/* 안전점검 경고 배너 */}
            {safetyCheckWarning && !dismissedSafetyWarning && (
              <div className="mb-3 bg-yellow-50 border-l-4 border-yellow-400 p-3 rounded-lg shadow-sm">
                <div className="flex items-start justify-between">
                  <button
                    className="flex items-start gap-3 flex-1 text-left"
                    onClick={() => {
                      setActiveTab('safety-check');
                      setDismissedSafetyWarning(true);
                      localStorage.setItem('safety_warning_dismissed', new Date().toISOString());
                    }}
                  >
                    <AlertTriangle className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
                    <div>
                      <h3 className="text-sm font-semibold text-yellow-800">
                        오늘의 안전점검이 완료되지 않았습니다.
                      </h3>
                      <p className="text-xs text-yellow-600 mt-0.5">터치하여 안전점검으로 이동</p>
                    </div>
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setDismissedSafetyWarning(true);
                      localStorage.setItem('safety_warning_dismissed', new Date().toISOString());
                    }}
                    className="text-yellow-600 hover:text-yellow-800 transition-colors flex-shrink-0 ml-2"
                    title="닫기"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}


            {/* 날짜 + 필터 한 줄 */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 mb-3 overflow-hidden">
              <div className="px-2 py-2 flex items-center gap-1">
                {/* 이전 달 */}
                <button
                  onClick={goToPreviousMonth}
                  className="p-2.5 rounded-full hover:bg-gray-100 active:bg-gray-200 transition-colors flex-shrink-0"
                >
                  <ChevronLeft className="w-4 h-4 text-gray-400" />
                </button>

                {/* 날짜 범위 버튼 */}
                <button
                  onClick={openDatePicker}
                  className="px-2 py-1.5 rounded-lg hover:bg-gray-50 active:bg-gray-100 transition-colors flex-shrink-0"
                >
                  <span className="text-xs font-semibold text-gray-800 whitespace-nowrap">
                    {dayjs(startDate).format('M/D')}~{dayjs(endDate).format('M/D')}
                  </span>
                </button>

                {/* 다음 달 */}
                <button
                  onClick={goToNextMonth}
                  className="p-2.5 rounded-full hover:bg-gray-100 active:bg-gray-200 transition-colors flex-shrink-0"
                >
                  <ChevronRight className="w-4 h-4 text-gray-400" />
                </button>

                {/* 구분선 */}
                <div className="w-px h-5 bg-gray-200 flex-shrink-0" />

                {/* 상태 필터 */}
                <div className="flex-1 min-w-0">
                  <Select
                    value={filter}
                    onValueChange={(val) => updateFilters({ filter: val as FilterType })}
                    options={statusOptions}
                    className="[&_button]:p-1.5 [&_button]:text-xs [&_button]:border-0 [&_button]:bg-transparent [&_button]:rounded-lg [&_button]:hover:bg-gray-50"
                  />
                </div>

                {/* 작업유형 필터 */}
                <div className="flex-1 min-w-0">
                  <Select
                    value={workTypeFilter}
                    onValueChange={(val) => updateFilters({ workTypeFilter: val })}
                    options={workTypeOptions}
                    className="[&_button]:p-1.5 [&_button]:text-xs [&_button]:border-0 [&_button]:bg-transparent [&_button]:rounded-lg [&_button]:hover:bg-gray-50"
                  />
                </div>

                {/* 새로고침 */}
                <button
                  onClick={refreshDirections}
                  disabled={isFetching}
                  className="p-2.5 rounded-full text-primary-600 hover:bg-primary-50 active:bg-primary-100 transition-colors flex-shrink-0 disabled:text-gray-400 disabled:cursor-not-allowed"
                  title="목록 새로고침"
                >
                  <svg className={`w-3.5 h-3.5 ${isFetching ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                </button>
              </div>
            </div>
            </div>
          </div>

          {/* 스크롤 가능한 작업 목록 영역 */}
          <div ref={scrollContainerRef} className="flex-1 overflow-y-auto px-3 pb-4">
            {(isLoading || isStatusCountsLoading || (isFetching && !isLoading)) ? (
              <LoadingSpinner size="medium" message={isLoading ? "작업 목록을 불러오는 중..." : "작업 상태를 불러오는 중..."} />
            ) : error ? (
              <ErrorMessage
                type="error"
                message={error}
                onRetry={() => refetch()}
              />
            ) : (
              <div>
                {filteredDirections.length > 0 ? (
                  <div className="space-y-3">
                    {/* 카드 형식으로 작업지시서 표시 */}
                    {currentDirections.map((order, index) => (
                      <WorkDirectionRow
                        key={order.id}
                        direction={order}
                        index={index + 1}
                        onSelect={handleSelectDirection}
                        onSms={handleSmsDirection}
                        onWorkerAdjust={handleWorkerAdjust}
                        workStatusCounts={workStatusCounts[order.id]}
                        isRecontract={recontractMap[order.id]}
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

            {/* Worker Adjustment Modal */}
            {workerAdjustTarget && (
              <WorkerAdjustmentModal
                isOpen={showWorkerAdjustModal}
                onClose={() => {
                  setShowWorkerAdjustModal(false);
                  setWorkerAdjustTarget(null);
                }}
                direction={workerAdjustTarget}
                onSuccess={handleWorkerAdjustSuccess}
                showToast={showToast}
                userInfo={userInfo}
              />
            )}
          </div>
        </TabsContent>

        {/* 안전점검 탭 */}
        <TabsContent value="safety-check" className="px-3 pt-1 overflow-y-auto">
          <SafetyCheckList onBack={onNavigateToMenu} userInfo={userInfo} showToast={showToast} />
        </TabsContent>

        {/* 작업신호 탭 */}
        <TabsContent value="work-result-signal" className="px-3 pt-1 overflow-y-auto">
          <WorkResultSignalList onBack={onNavigateToMenu} />
        </TabsContent>

        {/* 신호연동 탭 */}
        <TabsContent value="signal-interlock" className="mt-0 flex-1 data-[state=active]:flex flex-col overflow-hidden">
          <SignalIntegration onBack={onNavigateToMenu} userInfo={userInfo} showToast={showToast} />
        </TabsContent>

      </Tabs>

      {/* 플로팅 지도 버튼 - 작업처리 탭에서만 표시 */}
      {activeTab === 'work-receipt' && !isLoading && !error && filteredDirections.length > 0 && (
        <FloatingMapButton
          onClick={() => setShowMapView(true)}
          workCount={filteredDirections.length}
        />
      )}

      {/* 지도 뷰 */}
      {showMapView && (
        <WorkMapView
          directions={filteredDirections}
          onBack={() => setShowMapView(false)}
          onSelectWork={(work) => {
            setShowMapView(false);
            handleSelectDirection(work);
          }}
        />
      )}

      {/* 날짜 범위 선택 바텀시트 */}
      {isDatePickerOpen && createPortal(
        <>
          <div
            className="fixed inset-0 bg-black/50"
            style={{ zIndex: 99999 }}
            onClick={() => setIsDatePickerOpen(false)}
          />
          <div
            className="fixed bottom-0 left-0 right-0 bg-white rounded-t-xl shadow-2xl"
            style={{ zIndex: 100000 }}
          >
            <div className="flex justify-center py-2">
              <div className="w-8 h-1 bg-gray-300 rounded-full" />
            </div>
            <div className="px-4 pb-2">
              {/* 선택된 범위 표시 */}
              <div className="flex items-center justify-center gap-2 mb-3">
                <button
                  onClick={() => { setSelectingPhase('start'); }}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                    selectingPhase === 'start' ? 'bg-primary-500 text-white' : 'bg-gray-100 text-gray-700'
                  }`}
                >
                  {tempStartDate ? `${dayjs(tempStartDate).format('M/D')}(${['일','월','화','수','목','금','토'][dayjs(tempStartDate).day()]})` : '시작일'}
                </button>
                <span className="text-gray-400">~</span>
                <button
                  onClick={() => { if (tempStartDate) setSelectingPhase('end'); }}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                    selectingPhase === 'end' ? 'bg-primary-500 text-white' : 'bg-gray-100 text-gray-700'
                  }`}
                >
                  {tempEndDate ? `${dayjs(tempEndDate).format('M/D')}(${['일','월','화','수','목','금','토'][dayjs(tempEndDate).day()]})` : '종료일'}
                </button>
              </div>

              {/* 월 네비게이션 */}
              <div className="flex items-center justify-between mb-2">
                <button
                  onClick={() => setCalendarMonth(calendarMonth.subtract(1, 'month'))}
                  className="p-2 rounded-full hover:bg-gray-100 active:bg-gray-200 transition-colors"
                >
                  <ChevronLeft className="w-5 h-5 text-gray-600" />
                </button>
                <span className="text-base font-bold text-gray-800">
                  {calendarMonth.format('YYYY년 M월')}
                </span>
                <button
                  onClick={() => setCalendarMonth(calendarMonth.add(1, 'month'))}
                  className="p-2 rounded-full hover:bg-gray-100 active:bg-gray-200 transition-colors"
                >
                  <ChevronRight className="w-5 h-5 text-gray-600" />
                </button>
              </div>

              {/* 요일 헤더 */}
              <div className="grid grid-cols-7 mb-1">
                {['일','월','화','수','목','금','토'].map((d, i) => (
                  <div key={d} className={`text-center text-xs font-medium py-1 ${i === 0 ? 'text-red-400' : i === 6 ? 'text-blue-400' : 'text-gray-400'}`}>
                    {d}
                  </div>
                ))}
              </div>

              {/* 날짜 그리드 */}
              <div className="grid grid-cols-7">
                {calendarDays.map((cell, idx) => {
                  const isStart = tempStartDate === cell.date;
                  const isEnd = tempEndDate === cell.date;
                  const isInRange = tempStartDate && tempEndDate &&
                    dayjs(cell.date).isAfter(dayjs(tempStartDate)) &&
                    dayjs(cell.date).isBefore(dayjs(tempEndDate));
                  const isToday = cell.date === dayjs().format(DATE_FORMAT);
                  const dow = idx % 7;

                  return (
                    <button
                      key={cell.date}
                      onClick={() => handleCalendarDayClick(cell.date)}
                      className={`relative h-10 flex items-center justify-center text-sm transition-colors
                        ${!cell.isCurrentMonth ? 'text-gray-300' : dow === 0 ? 'text-red-500' : dow === 6 ? 'text-blue-500' : 'text-gray-700'}
                        ${isStart || isEnd ? 'bg-primary-500 text-white font-bold rounded-full z-10' : ''}
                        ${isInRange ? 'bg-primary-50' : ''}
                        ${!isStart && !isEnd && cell.isCurrentMonth ? 'hover:bg-gray-100 active:bg-gray-200 rounded-full' : ''}
                      `}
                    >
                      {isToday && !isStart && !isEnd && (
                        <span className="absolute bottom-0.5 left-1/2 -translate-x-1/2 w-1 h-1 bg-primary-500 rounded-full" />
                      )}
                      {cell.day}
                    </button>
                  );
                })}
              </div>

              {/* 빠른 선택 */}
              <div className="flex gap-2 mt-3">
                {[
                  { label: '이번 달', fn: () => {
                    const s = dayjs().startOf('month').format(DATE_FORMAT);
                    const e = dayjs().endOf('month').format(DATE_FORMAT);
                    setTempStartDate(s); setTempEndDate(e); setCalendarMonth(dayjs()); setSelectingPhase('start');
                  }},
                  { label: '지난 달', fn: () => {
                    const p = dayjs().subtract(1, 'month');
                    setTempStartDate(p.startOf('month').format(DATE_FORMAT)); setTempEndDate(p.endOf('month').format(DATE_FORMAT));
                    setCalendarMonth(p); setSelectingPhase('start');
                  }},
                  { label: '최근 7일', fn: () => {
                    setTempStartDate(dayjs().subtract(6, 'day').format(DATE_FORMAT)); setTempEndDate(dayjs().format(DATE_FORMAT));
                    setCalendarMonth(dayjs()); setSelectingPhase('start');
                  }},
                ].map((btn) => (
                  <button
                    key={btn.label}
                    onClick={btn.fn}
                    className="flex-1 py-2 text-xs font-medium text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 active:bg-gray-300 transition-colors"
                  >
                    {btn.label}
                  </button>
                ))}
              </div>
            </div>
            <div
              className="px-5 py-3 border-t border-gray-200 flex gap-3"
              style={{ paddingBottom: 'calc(0.75rem + env(safe-area-inset-bottom))' }}
            >
              <button
                onClick={() => setIsDatePickerOpen(false)}
                className="flex-1 py-2.5 text-sm font-medium text-gray-600 bg-gray-100 rounded-lg"
              >
                취소
              </button>
              <button
                onClick={applyDateRange}
                disabled={!tempStartDate || !tempEndDate}
                className={`flex-1 py-2.5 text-sm font-medium rounded-lg ${tempStartDate && tempEndDate ? 'text-white bg-primary-500 active:bg-primary-600' : 'text-gray-400 bg-gray-200 cursor-not-allowed'}`}
              >
                적용
              </button>
            </div>
          </div>
        </>,
        document.body
      )}
    </div>
  );
};

export default Dashboard;