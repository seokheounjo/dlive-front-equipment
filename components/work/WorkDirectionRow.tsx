import React from 'react';
import { WorkOrder, WorkOrderStatus } from '../../types';
import VipBadge from '../common/VipBadge';
import { formatDateTimeFromISO } from '../../utils/dateFormatter';
import { WorkStatusCounts } from '../../services/apiService';

interface WorkDirectionRowProps {
  direction: WorkOrder;
  onSelect: (direction: WorkOrder) => void;
  onSms?: (direction: WorkOrder) => void;
  workStatusCounts?: WorkStatusCounts;
  index?: number;
}

const WorkDirectionRow: React.FC<WorkDirectionRowProps> = ({ direction, onSelect, onSms, workStatusCounts, index }) => {
  const statusCounts = workStatusCounts || {
    total: 1,
    pending: 1,
    completed: 0,
    cancelled: 0
  };

  // 상태별 뱃지 렌더링
  const renderStatusBadges = () => {
    const badges: React.ReactNode[] = [];

    if (statusCounts.pending > 0) {
      badges.push(
        <span key="pending" className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800 border border-yellow-200">
          진행중 {statusCounts.pending}
        </span>
      );
    }
    if (statusCounts.completed > 0) {
      badges.push(
        <span key="completed" className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800 border border-green-200">
          완료 {statusCounts.completed}
        </span>
      );
    }
    if (statusCounts.cancelled > 0) {
      badges.push(
        <span key="cancelled" className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800 border border-red-200">
          취소 {statusCounts.cancelled}
        </span>
      );
    }

    return badges;
  };

  const handleCall = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (direction.customer.phone) {
      window.location.href = `tel:${direction.customer.phone}`;
    }
  };

  const handleSms = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onSms) {
      onSms(direction);
    }
  };

  return (
    <div
      onClick={() => onSelect(direction)}
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
              {direction.customer.name}
            </h3>
            <VipBadge customer={direction.customer} />
          </div>
          <div className="flex items-center gap-1.5 flex-shrink-0 flex-wrap justify-end">
            {renderStatusBadges()}
          </div>
        </div>

        {/* 작업 유형 + 날짜 */}
        <div className="flex items-center gap-3 mb-3">
          <span className="inline-flex items-center px-3 py-1.5 rounded-lg text-sm font-medium bg-blue-50 text-blue-700 border border-blue-200">
            {direction.typeDisplay}
          </span>
          <div className="flex items-center gap-1.5 text-sm text-gray-600">
            <svg className="w-4 h-4 text-gray-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span>{formatDateTimeFromISO(direction.scheduledAt)}</span>
          </div>
        </div>

        {/* 주소 */}
        <div className="flex items-start gap-2 mb-4">
          <svg className="w-4 h-4 text-gray-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
          <p className="text-sm text-gray-600 leading-relaxed">{direction.customer.address || '주소 정보 없음'}</p>
        </div>

        {/* 액션 버튼 */}
        <div className="flex items-center gap-2 pt-3 border-t border-gray-100">
          <button
            onClick={handleCall}
            className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-blue-500 text-white hover:bg-blue-600 transition-colors text-sm font-medium flex-1"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
            </svg>
            전화
          </button>

          {onSms && (
            <button
              onClick={handleSms}
              className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-green-500 text-white hover:bg-green-600 transition-colors text-sm font-medium flex-1"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
              </svg>
              문자
            </button>
          )}

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

export default WorkDirectionRow;
