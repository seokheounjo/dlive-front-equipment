import React, { useState, useEffect } from 'react';
import { WorkOrder, WorkOrderStatus } from '../../types';
import { getWorkTypeIcon, getWorkTypeIconColor } from '../../utils/workTypeIcons';
import VipCounter from '../common/VipCounter';
import VipBadge from '../common/VipBadge';
import LoadingSpinner from '../common/LoadingSpinner';
import ErrorMessage from '../common/ErrorMessage';
import FloatingMapButton from '../common/FloatingMapButton';
import WorkMapView from './WorkMapView';
import { Calendar, Clock, Phone, MapPin, ChevronRight } from 'lucide-react';
import { useWorkOrders } from '../../hooks/queries/useWorkOrders';
import { useUIStore } from '../../stores/uiStore';

interface UserInfo {
  userId: string;
  userName: string;
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
  // 지도 보기 상태
  const [showMapView, setShowMapView] = useState(false);
  // Get today's date in YYYY-MM-DD format
  const getTodayString = () => {
    const today = new Date();
    return today.toISOString().split('T')[0];
  };

  const todayStr = getTodayString();

  // React Query로 오늘 작업 목록 조회
  const { data: workOrders = [], isLoading, error: queryError } = useWorkOrders({
    startDate: todayStr,
    endDate: todayStr
  });
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

  const today = new Date();
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

  // Handle phone call
  const handleCall = (e: React.MouseEvent, phone?: string) => {
    e.stopPropagation();
    if (phone) {
      window.location.href = `tel:${phone}`;
    } else {
      if (showToast) showToast('전화번호가 없습니다.', 'warning');
    }
  };

  // Handle map navigation
  const handleMap = (e: React.MouseEvent, address: string) => {
    e.stopPropagation();
    if (address) {
      const encodedAddress = encodeURIComponent(address);
      window.open(`https://map.kakao.com/link/search/${encodedAddress}`, '_blank');
    }
  };

  // Get status badge styling
  const getStatusBadge = (status: WorkOrderStatus) => {
    switch (status) {
      case WorkOrderStatus.Pending:
        return 'bg-blue-100 text-blue-800 border-blue-300';
      case WorkOrderStatus.Completed:
        return 'bg-green-100 text-green-800 border-green-300';
      case WorkOrderStatus.Cancelled:
        return 'bg-red-100 text-red-800 border-red-300';
      default:
        return 'bg-gray-100 text-gray-700 border-gray-300';
    }
  };

  // Render work order card
  const renderWorkCard = (order: WorkOrder, index?: number) => {
    const WorkTypeIcon = getWorkTypeIcon(order.typeDisplay);
    const iconColorClass = getWorkTypeIconColor(order.typeDisplay);

    return (
      <div
        key={order.id}
        onClick={() => handleSelectOrder(order)}
        className="bg-white rounded-xl shadow-md hover:shadow-xl border border-gray-100 transition-all duration-200 cursor-pointer active:scale-[0.98] mb-3 overflow-hidden"
        style={{ WebkitTapHighlightColor: 'transparent' }}
      >
        {/* Card Header */}
        <div className="p-4 pb-3">
          <div className="flex items-start justify-between mb-3">
            <div className="flex items-start gap-3 flex-1 min-w-0">
              {/* 시퀀스 번호 */}
              {index !== undefined && (
                <div className="flex-shrink-0 w-8 h-8 flex items-center justify-center rounded-full bg-blue-600 text-white text-sm font-bold">
                  {index}
                </div>
              )}

              {/* Work Type Icon */}
              <div className={`flex-shrink-0 w-12 h-12 rounded-full ${iconColorClass} bg-opacity-10 flex items-center justify-center`}>
                <WorkTypeIcon className="w-6 h-6" />
              </div>

              {/* Customer Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <h3 className="font-bold text-gray-900 text-lg truncate">
                    {order.customer.name}
                  </h3>
                  <VipBadge customer={order.customer} />
                </div>

                {/* Work Type Badge */}
                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${iconColorClass} bg-opacity-10 mb-2`}>
                  {order.typeDisplay}
                </span>

                {/* Address */}
                <div className="flex items-start gap-1 text-sm text-gray-600 mb-1">
                  <MapPin className="w-4 h-4 flex-shrink-0 mt-0.5 text-gray-400" />
                  <p className="truncate">{order.customer.address || '주소 정보 없음'}</p>
                </div>

                {/* Scheduled Time */}
                <div className="flex items-center gap-1 text-xs text-gray-500">
                  <Clock className="w-3.5 h-3.5 text-gray-400" />
                  <span>
                    {order.scheduledAt
                      ? new Date(order.scheduledAt).toLocaleTimeString('ko-KR', {
                          hour: '2-digit',
                          minute: '2-digit'
                        })
                      : '시간 미정'}
                  </span>
                </div>
              </div>
            </div>

            {/* Status Badge */}
            <div className="flex-shrink-0 ml-2">
              <span className={`inline-block px-3 py-1 text-xs font-bold rounded-full border-2 shadow-sm ${getStatusBadge(order.status)}`}>
                {order.status}
              </span>
            </div>
          </div>
        </div>

        {/* Quick Action Buttons */}
        <div className="flex items-center gap-2 px-4 py-3 bg-gray-50 border-t border-gray-200">
          <button
            onClick={(e) => handleCall(e, order.customer.phone)}
            className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 active:scale-95 transition-all text-sm font-medium shadow-sm flex-1"
          >
            <Phone className="w-4 h-4" />
            전화
          </button>

          <button
            onClick={(e) => {
              e.stopPropagation();
              // TODO: 문자발송 기능 구현
              console.log('문자발송 클릭:', order.customer.name);
            }}
            className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-green-600 text-white hover:bg-green-700 active:scale-95 transition-all text-sm font-medium shadow-sm flex-1"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
            </svg>
            문자
          </button>

          <button
            onClick={(e) => {
              e.stopPropagation();
              // TODO: 작업자보정 기능 구현
              console.log('작업자보정 클릭:', order.id);
            }}
            className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-orange-600 text-white hover:bg-orange-700 active:scale-95 transition-all text-sm font-medium shadow-sm flex-1"
          >
            <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
            <span className="whitespace-nowrap">작업자보정</span>
          </button>
        </div>
      </div>
    );
  };

  // Render status section
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

        {/* Order Cards */}
        <div className="space-y-3">
          {orders.map((order, index) => renderWorkCard(order, index + 1))}
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header with Today's Date */}
      <div className="sticky top-16 z-30 bg-blue-600 text-white shadow-lg">
        <div className="px-4 py-4">
          <div className="flex items-center justify-between mb-2">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <Calendar className="w-5 h-5" />
                <h1 className="text-xl font-bold">오늘의 작업</h1>
              </div>
              <p className="text-blue-100 text-sm">{todayDisplay.full}</p>
            </div>
            <div className="text-right">
              <div className="text-3xl font-bold">{workOrders.length}</div>
              <div className="text-xs text-blue-100">총 작업</div>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="px-3 py-4">
        {/* VIP Counter */}
        <VipCounter workOrders={workOrders} className="mb-4" />

        {/* Loading State */}
        {isLoading ? (
          <LoadingSpinner size="medium" message="오늘 작업을 불러오는 중..." />
        ) : error ? (
          <ErrorMessage
            type="error"
            message={error}
            onRetry={() => window.location.reload()}
          />
        ) : workOrders.length === 0 ? (
          /* Empty State */
          <div className="text-center py-16 px-6">
            <div className="bg-white rounded-2xl shadow-md p-8 mx-auto max-w-sm border border-gray-200">
              <div className="w-20 h-20 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Calendar className="w-10 h-10 text-blue-600" />
              </div>
              <h3 className="text-lg sm:text-xl font-bold text-gray-800 mb-2 whitespace-nowrap">오늘 예정된 작업이 없습니다</h3>
              <p className="text-gray-500">편안한 하루 되세요!</p>
            </div>
          </div>
        ) : (
          /* Work Orders by Status */
          <div>
            {/* In Progress */}
            {renderStatusSection(
              '진행중',
              groupedOrders.pending,
              'bg-blue-100',
              'text-blue-700',
              <div className="w-6 h-6 rounded-full bg-blue-600 flex items-center justify-center">
                <Clock className="w-4 h-4 text-white" />
              </div>
            )}

            {/* Completed */}
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

            {/* Cancelled */}
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
        )}
      </div>

      {/* Summary Footer */}
      {!isLoading && !error && workOrders.length > 0 && (
        <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 shadow-lg px-4 py-3">
          <div className="flex items-center justify-around text-center max-w-2xl mx-auto">
            <div className="flex-1">
              <div className="text-2xl font-bold text-blue-600">{groupedOrders.pending.length}</div>
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

      {/* 플로팅 지도 버튼 */}
      {!isLoading && !error && workOrders.length > 0 && (
        <FloatingMapButton
          onClick={() => setShowMapView(true)}
          workCount={workOrders.length}
        />
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
    </div>
  );
};

export default TodayWork;
