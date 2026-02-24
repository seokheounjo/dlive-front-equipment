import React, { useState } from 'react';
import { Navigation, Loader2 } from 'lucide-react';
import { WorkItem, WorkOrderStatus } from '../../types';
import { useUIStore } from '../../stores/uiStore';
import { geocodeAndNavigate } from '../../services/navigationService';

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

// 상품군 코드 → 배지 색상 매핑
const getProductGroupStyle = (prodGrp: string | undefined) => {
  switch (prodGrp) {
    case 'D': // DTV
      return 'bg-purple-100 text-purple-700 border-purple-200';
    case 'I': // Internet/ISP
      return 'bg-blue-100 text-blue-700 border-blue-200';
    case 'V': // VoIP
      return 'bg-green-100 text-green-700 border-green-200';
    case 'C': // Cable/번들
      return 'bg-orange-100 text-orange-700 border-orange-200';
    default:
      return 'bg-gray-100 text-gray-600 border-gray-200';
  }
};

const WorkItemCard: React.FC<WorkItemCardProps> = ({ item, onSelect, onComplete, onCancel, index }) => {
  const [navLoading, setNavLoading] = useState(false);
  const preferredNavApp = useUIStore((s) => s.preferredNavApp);

  // 실제 API 데이터 매핑
  const status = item.WRK_STAT_CD_NM || item.status || '진행중';
  const isPending = status === '할당' || status === '진행중' || status === WorkOrderStatus.Pending;
  const address = item.ADDR || item.address || '';

  // 상품군 (D:DTV, I:ISP, V:VoIP, C:번들)
  const prodGrp = item.PROD_GRP || item.KPI_PROD_GRP_CD;

  const handleNavClick = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!address || navLoading) return;
    setNavLoading(true);
    try {
      const ok = await geocodeAndNavigate(address, preferredNavApp);
      if (!ok) alert('주소를 찾을 수 없습니다.');
    } catch {
      alert('길찾기 실행에 실패했습니다.');
    } finally {
      setNavLoading(false);
    }
  };

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
      className={`bg-white rounded-lg border border-gray-100 shadow-sm hover:shadow-md overflow-hidden cursor-pointer transition-all duration-200 active:scale-[0.98] ${!isPending ? 'opacity-60' : ''}`}
      style={{ WebkitTapHighlightColor: 'transparent' }}
    >
      <div className="p-3">
        {/* 헤더: 시퀀스 번호 + 작업 상태 */}
        <div className="flex items-center justify-between mb-2">
          {/* 시퀀스 번호 */}
          {index !== undefined && (
            <div className="flex-shrink-0 w-6 h-6 flex items-center justify-center rounded-full bg-blue-500 text-white text-xs font-bold">
              {index}
            </div>
          )}
          {/* 작업 상태 */}
          <span className={`flex-shrink-0 px-2 py-1 text-xs font-semibold rounded-md ${getStatusColor(status)} whitespace-nowrap`}>
            {status}
          </span>
        </div>

        {/* 작업 정보 그리드 */}
        <div className="space-y-2 mb-2">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs text-gray-500">작업상세</span>
            <div className="flex items-center gap-1.5">
              {/* 상품군 배지 (D/I/V/C) */}
              {prodGrp && (
                <span className={`px-1.5 py-0.5 text-[0.625rem] font-bold rounded border ${getProductGroupStyle(prodGrp)}`}>
                  {prodGrp}
                </span>
              )}
              <span className="text-xs font-medium text-gray-900 truncate">{item.WRK_DTL_TCD_NM || item.WRK_CD_NM || item.typeDisplay || '-'}</span>
            </div>
          </div>
          <div className="flex items-center justify-between gap-2 pt-2 border-t border-gray-100">
            <span className="text-xs text-gray-500">상품명</span>
            <span className="text-xs font-medium text-gray-900 truncate">{item.PROD_NM || '-'}</span>
          </div>
        </div>

        {/* 버튼 영역 */}
        {isPending && (
          <div className="flex gap-2 mt-2 pt-2 border-t border-gray-100">
            <button
              onClick={(e) => handleActionClick(e, 'complete')}
              className="flex-1 py-2 rounded-md bg-blue-500 hover:bg-blue-600 text-white text-xs font-semibold transition-colors"
            >
              진행
            </button>
            <button
              onClick={(e) => handleActionClick(e, 'cancel')}
              className="flex-1 py-2 rounded-md bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-semibold transition-colors"
            >
              취소
            </button>
            <button
              onClick={handleNavClick}
              disabled={!address || navLoading}
              className={`flex-shrink-0 w-10 py-2 rounded-md flex items-center justify-center transition-colors ${
                address
                  ? 'bg-green-500 hover:bg-green-600 text-white'
                  : 'bg-gray-100 text-gray-400 cursor-not-allowed'
              }`}
              title="길찾기"
            >
              {navLoading
                ? <Loader2 className="w-4 h-4 animate-spin" />
                : <Navigation className="w-4 h-4" />
              }
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default WorkItemCard;
