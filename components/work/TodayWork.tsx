import React, { useState, useMemo } from 'react';
import { WorkOrder, WorkOrderStatus, SmsSendData } from '../../types';
import WorkDirectionRow from '../work/WorkDirectionRow';
import LoadingSpinner from '../common/LoadingSpinner';
import ErrorMessage from '../common/ErrorMessage';
import WorkMapView from './WorkMapView';
import VisitSmsModal from '../modal/VisitSmsModal';
import WorkerAdjustmentModal from '../modal/WorkerAdjustmentModal';
import { Calendar, Clock, RefreshCw } from 'lucide-react';
import { useWorkOrders } from '../../hooks/queries/useWorkOrders';
import { useUIStore } from '../../stores/uiStore';
import { parseWorkStatusFromStrings, WorkStatusCounts } from '../../services/apiService';

interface UserInfo {
  userId: string;
  userName: string;
  userNameEn?: string;
  userRole: string;
}

interface TodayWorkProps {
  onNavigateToView?: (view: string) => void;
  onNavigateToComingSoon?: (tabTitle: string) => void;
  userInfo?: UserInfo;
  showToast?: (message: string, type: 'success' | 'error' | 'warning' | 'info') => void;
}

const TodayWork: React.FC<TodayWorkProps> = ({
  onNavigateToView,
  onNavigateToComingSoon,
  userInfo,
  showToast
}) => {
  // UI Store 사용 (Props Drilling 제거)
  const { setSelectedWorkItem, setSelectedWorkDirection } = useUIStore();
  // 탭 상태
  const [activeTab, setActiveTab] = useState<'today' | 'delayed'>('today');
  // 지도 보기 상태
  const [showMapView, setShowMapView] = useState(false);
  // SMS 모달 상태
  const [showSmsModal, setShowSmsModal] = useState(false);
  const [smsData, setSmsData] = useState<SmsSendData | null>(null);
  // 작업자보정 모달 상태
  const [showWorkerAdjustModal, setShowWorkerAdjustModal] = useState(false);
  const [workerAdjustTarget, setWorkerAdjustTarget] = useState<WorkOrder | null>(null);

  // 오늘 날짜 (필터링용)
  const today = new Date();
  const todayStr = today.toISOString().split('T')[0];

  // 날짜 범위 직접 계산 (Zustand hydration에 의존하지 않음)
  // 오늘의 작업 + 지연된 작업(과거 1달) 모두 커버
  const { queryStartDate, queryEndDate } = useMemo(() => {
    const now = new Date();
    // 이번 달 1일
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    // 1달 전 1일
    const oneMonthAgo = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    // 이번 달 말일
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);

    const fmt = (d: Date) => d.toISOString().split('T')[0];
    return {
      queryStartDate: fmt(oneMonthAgo),
      queryEndDate: fmt(monthEnd)
    };
  }, []);

  // React Query - 직접 계산한 날짜로 조회 (Zustand store 불필요, 항상 즉시 실행)
  const { data: allWorkOrders = [], isLoading, isFetching, error: queryError, refetch } = useWorkOrders({
    startDate: queryStartDate,
    endDate: queryEndDate
  });

  // 오늘 날짜 작업만 필터링
  const workOrders = allWorkOrders.filter(order => {
    if (!order.scheduledAt) return false;
    const orderDate = order.scheduledAt.split('T')[0];
    return orderDate === todayStr;
  });

  // 지연된 작업 필터링 (오늘 이전 + 미완료)
  const delayedOrders = useMemo(() => {
    return allWorkOrders.filter(order => {
      if (!order.scheduledAt) return false;
      const orderDate = order.scheduledAt.split('T')[0];
      return orderDate < todayStr && order.status === WorkOrderStatus.Pending;
    }).sort((a, b) => {
      // 오래된 것 먼저
      return (a.scheduledAt || '').localeCompare(b.scheduledAt || '');
    });
  }, [allWorkOrders, todayStr]);

  // workStatusCounts 계산 (Dashboard 동일 패턴)
  const workStatusCounts = useMemo(() => {
    const counts: Record<string, WorkStatusCounts> = {};
    allWorkOrders.forEach(order => {
      const parsed = parseWorkStatusFromStrings((order as any).PROD_GRPS, (order as any).WRK_STATS);
      if (parsed && parsed.total > 0) {
        counts[order.id] = parsed;
      } else {
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
    return counts;
  }, [allWorkOrders]);

  // 재약정 대상 맵
  const recontractMap = useMemo(() => {
    const map: Record<string, boolean> = {};
    allWorkOrders.forEach((d: any) => {
      if (d.CLOSE_DANGER === 'Y') map[d.id] = true;
    });
    return map;
  }, [allWorkOrders]);

  const error = queryError?.message || null;

  // Format date for display
  const formatDateDisplay = (date: Date) => {
    const days = ['일', '월', '화', '수', '목', '금', '토'];
    const year = date.getFullYear();
    const month = date.getMonth() + 1;
    const day = date.getDate();
    const dayOfWeek = days[date.getDay()];

    return {
      full: `${year}년 ${month}월 ${day}일 (${dayOfWeek})`,
      short: `${month}월 ${day}일`
    };
  };

  const todayDisplay = formatDateDisplay(today);

  // Group orders by status
  const groupedOrders = {
    pending: workOrders.filter(order => order.status === WorkOrderStatus.Pending),
    completed: workOrders.filter(order => order.status === WorkOrderStatus.Completed),
    cancelled: workOrders.filter(order => order.status === WorkOrderStatus.Cancelled)
  };

  // Handle work order selection
  const handleSelectOrder = (order: WorkOrder) => {
    setSelectedWorkDirection(order);
    if (onNavigateToView) {
      onNavigateToView('work-item-list');
    }
  };

  // SMS 래퍼 (WorkDirectionRow 콜백용: order만 받음)
  const handleSmsFromRow = (order: WorkOrder) => {
    const convertToWrkHopeDttm = (isoDate: string | undefined): string => {
      if (!isoDate) return '';
      if (isoDate.includes('T') || isoDate.includes('-')) {
        const cleaned = isoDate.replace(/[-:T]/g, '').substring(0, 12);
        return cleaned;
      }
      return isoDate;
    };

    const data: SmsSendData = {
      SO_ID: (order as any).SO_ID || '328',
      CUST_ID: (order as any).CUST_ID || order.customer.id || '',
      CUST_NM: order.customer.name || '',
      SMS_RCV_TEL: order.customer.phone || '',
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

  // 작업자보정 래퍼 (WorkDirectionRow 콜백용)
  const handleWorkerAdjustFromRow = (order: WorkOrder) => {
    setWorkerAdjustTarget(order);
    setShowWorkerAdjustModal(true);
  };

  // Render status section (오늘의 작업용)
  const renderStatusSection = (
    title: string,
    orders: WorkOrder[],
    bgGradient: string,
    textColor: string,
    icon: React.ReactNode
  ) => {
    if (orders.length === 0) return null;

    return (
      <div className="mb-6">
        {/* Section Header */}
        <div className={`flex items-center justify-between mb-3 px-4 py-2 rounded-lg ${bgGradient} shadow-sm`}>
          <div className="flex items-center gap-2">
            {icon}
            <h3 className={`font-bold text-base ${textColor}`}>{title}</h3>
          </div>
          <div className={`flex items-center justify-center w-8 h-8 rounded-full bg-white ${textColor} font-bold text-sm shadow-sm`}>
            {orders.length}
          </div>
        </div>

        {/* Order Cards - WorkDirectionRow 사용 */}
        <div className="space-y-3">
          {orders.map((order, index) => (
            <WorkDirectionRow
              key={order.id}
              direction={order}
              index={index + 1}
              onSelect={handleSelectOrder}
              onSms={handleSmsFromRow}
              onWorkerAdjust={handleWorkerAdjustFromRow}
              workStatusCounts={workStatusCounts[order.id]}
              isRecontract={recontractMap[order.id]}
            />
          ))}
        </div>
      </div>
    );
  };

  // 활성 탭에 따른 건수
  const activeCount = activeTab === 'today' ? workOrders.length : delayedOrders.length;

  return (
    <div className="h-[calc(100dvh-64px)] flex flex-col bg-gray-50 overflow-hidden">
      {/* Header with Today's Date - 고정 */}
      <div className="flex-shrink-0 bg-primary-500 text-white shadow-lg z-30">
        <div className="px-4 py-4">
          <div className="flex items-center justify-between mb-2">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <Calendar className="w-5 h-5" />
                <h1 className="text-xl font-bold">
                  {activeTab === 'today' ? '오늘의 작업' : '지연된 작업'}
                </h1>
              </div>
              <p
                className="text-primary-100 text-sm cursor-pointer underline"
                onClick={() => {
                  useUIStore.getState().setActiveTab('work-receipt');
                  useUIStore.getState().setCurrentView('work-management' as any);
                }}
              >{todayDisplay.full}</p>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={() => refetch()}
                disabled={isFetching}
                className="p-2 rounded-full hover:bg-primary-400 transition-colors disabled:opacity-50"
                aria-label="새로고침"
              >
                <RefreshCw className={`w-5 h-5 text-white ${isFetching ? 'animate-spin' : ''}`} />
              </button>
              <div className="text-right">
                <div className="text-3xl font-bold">{activeCount}</div>
                <div className="text-xs text-primary-100">
                  {activeTab === 'today' ? '총 작업' : '미완료'}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* 탭 바 */}
        <div className="flex border-t border-primary-400">
          <button
            onClick={() => setActiveTab('today')}
            className={`flex-1 py-3 text-sm font-semibold text-center transition-colors ${
              activeTab === 'today'
                ? 'text-white border-b-2 border-white'
                : 'text-primary-200 border-b-2 border-transparent'
            }`}
          >
            오늘의 작업 ({workOrders.length})
          </button>
          <button
            onClick={() => setActiveTab('delayed')}
            className={`flex-1 py-3 text-sm font-semibold text-center transition-colors ${
              activeTab === 'delayed'
                ? 'text-white border-b-2 border-white'
                : 'text-primary-200 border-b-2 border-transparent'
            }`}
          >
            지연된 작업 ({delayedOrders.length})
          </button>
        </div>
      </div>

      {/* Content - 스크롤 영역 */}
      <div className="flex-1 overflow-y-auto px-3 py-4 relative">

        {/* Refetching 오버레이 (초기 로딩이 아닌 새로고침 시) */}
        {isFetching && !isLoading && (
          <div className="absolute inset-0 bg-white/60 z-10 flex items-center justify-center">
            <RefreshCw className="w-8 h-8 text-primary-500 animate-spin" />
          </div>
        )}

        {/* Loading State */}
        {isLoading ? (
          <LoadingSpinner size="medium" message="작업을 불러오는 중..." />
        ) : error ? (
          <ErrorMessage
            type="error"
            message={error}
            onRetry={() => window.location.reload()}
          />
        ) : activeTab === 'today' ? (
          /* 오늘의 작업 탭 */
          workOrders.length === 0 ? (
            <div className="text-center py-16 px-6">
              <div className="bg-white rounded-2xl shadow-md p-8 mx-auto max-w-sm border border-gray-200">
                <div className="w-20 h-20 bg-primary-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Calendar className="w-10 h-10 text-primary-700" />
                </div>
                <h3 className="text-lg sm:text-xl font-bold text-gray-800 mb-2 whitespace-nowrap">오늘 예정된 작업이 없습니다</h3>
                <p className="text-gray-500">편안한 하루 되세요!</p>
              </div>
            </div>
          ) : (
            <div>
              {renderStatusSection(
                '진행중',
                groupedOrders.pending,
                'bg-primary-100',
                'text-primary-600',
                <div className="w-6 h-6 rounded-full bg-primary-500 flex items-center justify-center">
                  <Clock className="w-4 h-4 text-white" />
                </div>
              )}
              {renderStatusSection(
                '완료',
                groupedOrders.completed,
                'bg-green-100',
                'text-green-700',
                <div className="w-6 h-6 rounded-full bg-green-600 flex items-center justify-center">
                  <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
              )}
              {renderStatusSection(
                '취소',
                groupedOrders.cancelled,
                'bg-red-100',
                'text-red-700',
                <div className="w-6 h-6 rounded-full bg-red-600 flex items-center justify-center">
                  <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </div>
              )}
            </div>
          )
        ) : (
          /* 지연된 작업 탭 */
          delayedOrders.length === 0 ? (
            <div className="text-center py-16 px-6">
              <div className="bg-white rounded-2xl shadow-md p-8 mx-auto max-w-sm border border-gray-200">
                <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <svg className="w-10 h-10 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <h3 className="text-lg sm:text-xl font-bold text-gray-800 mb-2">지연된 작업이 없습니다</h3>
                <p className="text-gray-500">모든 작업이 정상 처리되었습니다!</p>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              {delayedOrders.map((order, index) => (
                <WorkDirectionRow
                  key={order.id}
                  direction={order}
                  index={index + 1}
                  onSelect={handleSelectOrder}
                  onSms={handleSmsFromRow}
                  onWorkerAdjust={handleWorkerAdjustFromRow}
                  workStatusCounts={workStatusCounts[order.id]}
                  isRecontract={recontractMap[order.id]}
                />
              ))}
            </div>
          )
        )}
      </div>

      {/* Summary Footer - 오늘의 작업 탭에서만 표시 */}
      {activeTab === 'today' && !isLoading && !error && workOrders.length > 0 && (
        <div className="flex-shrink-0 bg-white border-t border-gray-200 shadow-lg px-4 py-3">
          <div className="flex items-center justify-around text-center max-w-2xl mx-auto">
            <div className="flex-1">
              <div className="text-2xl font-bold text-primary-700">{groupedOrders.pending.length}</div>
              <div className="text-xs text-gray-600">진행중</div>
            </div>
            <div className="w-px h-10 bg-gray-300"></div>
            <div className="flex-1">
              <div className="text-2xl font-bold text-green-600">{groupedOrders.completed.length}</div>
              <div className="text-xs text-gray-600">완료</div>
            </div>
            <div className="w-px h-10 bg-gray-300"></div>
            <div className="flex-1">
              <div className="text-2xl font-bold text-red-600">{groupedOrders.cancelled.length}</div>
              <div className="text-xs text-gray-600">취소</div>
            </div>
          </div>
        </div>
      )}


      {/* 지도 뷰 */}
      {showMapView && (
        <WorkMapView
          workOrders={workOrders}
          onBack={() => setShowMapView(false)}
          onSelectWork={(work) => {
            setShowMapView(false);
            handleSelectOrder(work);
          }}
        />
      )}

      {/* SMS 모달 */}
      <VisitSmsModal
        isOpen={showSmsModal}
        onClose={() => setShowSmsModal(false)}
        smsData={smsData}
        userId={userInfo?.userId || ''}
      />

      {/* 작업자보정 모달 */}
      {workerAdjustTarget && (
        <WorkerAdjustmentModal
          isOpen={showWorkerAdjustModal}
          onClose={() => {
            setShowWorkerAdjustModal(false);
            setWorkerAdjustTarget(null);
          }}
          direction={workerAdjustTarget}
          onSuccess={() => {
            refetch();
          }}
          showToast={showToast}
          userInfo={userInfo}
        />
      )}
    </div>
  );
};

export default TodayWork;
