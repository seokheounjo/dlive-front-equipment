import React, { useState, useEffect } from 'react';
import { WorkOrder, WorkOrderStatus, SmsSendData } from '../../types';
import { getWorkTypeIcon, getWorkTypeIconColor } from '../../utils/workTypeIcons';
import VipBadge from '../common/VipBadge';
import LoadingSpinner from '../common/LoadingSpinner';
import ErrorMessage from '../common/ErrorMessage';
import FloatingMapButton from '../common/FloatingMapButton';
import WorkMapView from './WorkMapView';
import VisitSmsModal from '../modal/VisitSmsModal';
import { Calendar, Clock, Phone, MapPin, ChevronRight } from 'lucide-react';
import { useWorkOrders } from '../../hooks/queries/useWorkOrders';
import { useUIStore } from '../../stores/uiStore';

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
  // 지도 보기 상태
  const [showMapView, setShowMapView] = useState(false);
  // SMS 모달 상태
  const [showSmsModal, setShowSmsModal] = useState(false);
  const [smsData, setSmsData] = useState<SmsSendData | null>(null);
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

  // Handle SMS modal open
  const handleSms = (e: React.MouseEvent, order: WorkOrder) => {
    e.stopPropagation();

    // Build SMS data from WorkOrder
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
      SO_ID: (order as any).SO_ID || '328',
      CUST_ID: (order as any).CUST_ID || order.customer.id || '',
      CUST_NM: order.customer.name || '',
      SMS_RCV_TEL: order.customer.phone || '',  // 여러 번호 그대로 전달 (모달에서 Select로 선택)
      SMS_SEND_TEL: '',  // VisitSmsModal에서 localStorage userInfo.telNo2로 설정됨
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

  // Render work order card - 작업처리 카드와 동일한 형태
  const renderWorkCard = (order: WorkOrder, index?: number) => {
    return (
      <div
        key={order.id}
        onClick={() => handleSelectOrder(order)}
        className="bg-white rounded-xl shadow-sm hover:shadow-md border border-gray-100 transition-all duration-200 cursor-pointer active:scale-[0.99] mb-3 touch-manipulation"
        style={{ WebkitTapHighlightColor: 'transparent' }}
      >
        <div className="p-4">
          {/* 헤더: 고객명 + 상태 배지 */}
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2 flex-1 min-w-0">
              {/* 시퀀스 번호 */}
              {index !== undefined && (
                <div className="flex-shrink-0 w-7 h-7 flex items-center justify-center rounded-full bg-blue-500 text-white text-sm font-bold">
                  {index}
                </div>
              )}
              <h3 className="font-bold text-gray-900 text-base truncate">
                {order.customer.name}
              </h3>
              <VipBadge customer={order.customer} />
            </div>
            <div className="flex items-center gap-1.5 flex-shrink-0 flex-wrap justify-end">
              <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${getStatusBadge(order.status)}`}>
                {order.status}
              </span>
            </div>
          </div>

          {/* 작업 유형 + 날짜 */}
          <div className="flex items-center gap-3 mb-3">
            <span className="inline-flex items-center px-3 py-1.5 rounded-lg text-sm font-medium bg-blue-50 text-blue-700 border border-blue-200">
              {order.typeDisplay}
            </span>
            <div className="flex items-center gap-1.5 text-sm text-gray-600">
              <svg className="w-4 h-4 text-gray-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span>
                {order.scheduledAt
                  ? new Date(order.scheduledAt).toLocaleString('ko-KR', {
                      month: 'long',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit'
                    })
                  : '시간 미정'}
              </span>
            </div>
          </div>

          {/* 주소 */}
          <div className="flex items-start gap-2 mb-4">
            <svg className="w-4 h-4 text-gray-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            <p className="text-sm text-gray-600 leading-relaxed">{order.customer.address || '주소 정보 없음'}</p>
          </div>

          {/* 액션 버튼 */}
          <div className="flex items-center gap-2 pt-3 border-t border-gray-100">
            <button
              onClick={(e) => handleCall(e, order.customer.phone)}
              className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-blue-500 text-white hover:bg-blue-600 transition-colors text-sm font-medium flex-1"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
              </svg>
              전화
            </button>

            <button
              onClick={(e) => handleSms(e, order)}
              className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-green-500 text-white hover:bg-green-600 transition-colors text-sm font-medium flex-1"
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
              }}
              className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-gray-100 text-gray-700 hover:bg-gray-200 transition-colors text-sm font-medium flex-1"
            >
              <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
              <span className="whitespace-nowrap">작업자보정</span>
            </button>
          </div>
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
    <div className="h-[calc(100vh-64px)] flex flex-col bg-gray-50 overflow-hidden">
      {/* Header with Today's Date - 고정 */}
      <div className="flex-shrink-0 bg-blue-600 text-white shadow-lg z-30">
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

      {/* Content - 스크롤 영역 */}
      <div className="flex-1 overflow-y-auto px-3 py-4">

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
        <div className="flex-shrink-0 bg-white border-t border-gray-200 shadow-lg px-4 py-3">
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

      {/* SMS 모달 */}
      <VisitSmsModal
        isOpen={showSmsModal}
        onClose={() => setShowSmsModal(false)}
        smsData={smsData}
        userId={userInfo?.userId || ''}
      />
    </div>
  );
};

export default TodayWork;
