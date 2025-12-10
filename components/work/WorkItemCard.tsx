import React from 'react';
import { WorkItem, WorkOrderStatus } from '../../types';

interface WorkItemCardProps {
  item: any; // 실제 API 데이터 구조 사용
  onSelect: (item: any) => void;
  onComplete: (item: any) => void;
  onCancel: (item: any) => void;
  index?: number; // 시퀀스 번호 (1부터 시작)
}

const getStatusColor = (status: string) => {
  if (status === '할당' || status === '진행중') {
    return 'bg-blue-50 text-blue-700';
  } else if (status === '완료') {
    return 'bg-green-50 text-green-700';
  } else if (status === '취소') {
    return 'bg-red-50 text-red-700';
  }
  return 'bg-gray-50 text-gray-700';
};

const WorkItemCard: React.FC<WorkItemCardProps> = ({ item, onSelect, onComplete, onCancel, index }) => {
  // 실제 API 데이터 매핑
  const status = item.WRK_STAT_CD_NM || item.status || '진행중';
  const isPending = status === '할당' || status === '진행중' || status === WorkOrderStatus.Pending;

  const handleActionClick = (e: React.MouseEvent, action: 'complete' | 'cancel') => {
    e.stopPropagation();

    if (action === 'complete') {
      onComplete(item);
    } else if (action === 'cancel') {
      onCancel(item);
    }
  };

  return (
    <div
      onClick={() => onSelect(item)}
      className={`bg-white rounded-xl border border-gray-100 shadow-sm hover:shadow-md overflow-hidden cursor-pointer transition-all duration-200 active:scale-[0.98] ${!isPending ? 'opacity-60' : ''}`}
      style={{ WebkitTapHighlightColor: 'transparent' }}
    >
      <div className="p-4">
        {/* 헤더: 시퀀스 번호 + 작업 상태 */}
        <div className="flex items-center justify-between mb-4">
          {/* 시퀀스 번호 */}
          {index !== undefined && (
            <div className="flex-shrink-0 w-8 h-8 flex items-center justify-center rounded-full bg-blue-500 text-white text-sm font-bold">
              {index}
            </div>
          )}
          {/* 작업 상태 */}
          <span className={`flex-shrink-0 px-3 py-1.5 text-sm font-semibold rounded-lg ${getStatusColor(status)} whitespace-nowrap`}>
            {status}
          </span>
        </div>

        {/* 작업 정보 그리드 */}
        <div className="space-y-3 mb-4">
          <div className="flex items-center justify-between gap-3">
            <span className="text-sm text-gray-500">작업상세</span>
            <span className="text-sm font-medium text-gray-900 truncate">{item.WRK_DTL_TCD_NM || '설치'}</span>
          </div>
          <div className="flex items-center justify-between gap-3 pt-3 border-t border-gray-100">
            <span className="text-sm text-gray-500">상품명</span>
            <span className="text-sm font-medium text-gray-900 truncate">{item.PROD_NM || 'ISP 서비스'}</span>
          </div>
        </div>

        {/* 버튼 영역 */}
        {isPending && (
          <div className="flex gap-2 mt-4 pt-4 border-t border-gray-100">
            <button
              onClick={(e) => handleActionClick(e, 'complete')}
              className="flex-1 py-2.5 rounded-lg bg-blue-500 hover:bg-blue-600 text-white text-sm font-semibold transition-colors"
            >
              진행
            </button>
            <button
              onClick={(e) => handleActionClick(e, 'cancel')}
              className="flex-1 py-2.5 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm font-semibold transition-colors"
            >
              취소
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default WorkItemCard;
