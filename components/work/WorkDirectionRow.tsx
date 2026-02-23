import React from 'react';
import { WorkOrder, WorkOrderStatus } from '../../types';
import VipBadge from '../common/VipBadge';
import { formatDateTimeFromISO } from '../../utils/dateFormatter';
import { WorkStatusCounts } from '../../services/apiService';

interface WorkDirectionRowProps {
  direction: WorkOrder;
  onSelect: (direction: WorkOrder) => void;
  onSms?: (direction: WorkOrder) => void;
  onWorkerAdjust?: (direction: WorkOrder) => void;
  workStatusCounts?: WorkStatusCounts;
  index?: number;
}

const WorkDirectionRow: React.FC<WorkDirectionRowProps> = ({ direction, onSelect, onSms, onWorkerAdjust, workStatusCounts, index }) => {
  const statusCounts = workStatusCounts || {
    total: 1,
    pending: 1,
    completed: 0,
    cancelled: 0
  };

  // 상품그룹별 총 건수를 문자열로 변환 (D_3 / I_3 / V_2 형태)
  const formatTotalByProdGrp = (): string => {
    const pendingByGrp = statusCounts.pendingByProdGrp || {};
    const completedByGrp = statusCounts.completedByProdGrp || {};

    // 모든 상품그룹의 총 건수 계산
    const totalByGrp: Record<string, number> = {};
    [...Object.keys(pendingByGrp), ...Object.keys(completedByGrp)].forEach(grp => {
      totalByGrp[grp] = (pendingByGrp[grp] || 0) + (completedByGrp[grp] || 0);
    });

    // 상품그룹 표시 순서: D, I, V, C
    const order = ['D', 'I', 'V', 'C'];
    const parts: string[] = [];
    order.forEach(grp => {
      if (totalByGrp[grp] && totalByGrp[grp] > 0) {
        parts.push(`${grp}_${totalByGrp[grp]}`);
      }
    });
    // 정의되지 않은 그룹도 포함 (순서 뒤에)
    Object.keys(totalByGrp).forEach(grp => {
      if (!order.includes(grp) && totalByGrp[grp] > 0) {
        parts.push(`${grp}_${totalByGrp[grp]}`);
      }
    });
    return parts.join(' / ');
  };

  // 상태별 뱃지 렌더링 (2줄: 상태 / 서비스건수)
  const renderStatusBadges = () => {
    // 2행: 서비스 건수 배지 (D_3 / I_3 / V_2)
    const prodGrpText = formatTotalByProdGrp();

    // 상태 배지들 (1행용)
    const statusBadges = (
      <div className="flex items-center gap-1">
        {statusCounts.pending > 0 && (
          <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200">
            진행 {statusCounts.pending}
          </span>
        )}
        {statusCounts.completed > 0 && (
          <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
            완료 {statusCounts.completed}
          </span>
        )}
        {statusCounts.cancelled > 0 && (
          <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-semibold bg-rose-50 text-rose-700 border border-rose-200">
            취소 {statusCounts.cancelled}
          </span>
        )}
      </div>
    );

    // 서비스 건수 배지 (2행용)
    const serviceBadge = prodGrpText ? (
      <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium bg-slate-100 text-slate-600 border border-slate-200">
        {prodGrpText}
      </span>
    ) : null;

    return { statusBadges, serviceBadge };
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
        {(() => {
          const { statusBadges, serviceBadge } = renderStatusBadges();
          return (
            <>
              {/* 1행: 번호 + 고객명 + 작업유형 (왼쪽) / 상태배지 (오른쪽) */}
              <div className="flex items-center justify-between gap-2 mb-2">
                <div className="flex items-center gap-2 min-w-0">
                  {index !== undefined && (
                    <div className="flex-shrink-0 w-7 h-7 flex items-center justify-center rounded-full bg-blue-500 text-white text-sm font-bold">
                      {index}
                    </div>
                  )}
                  <h3 className="font-bold text-gray-900 text-base truncate">
                    {direction.customer.name}
                    {direction.customer.id && (
                      <span className="font-normal ml-1">({direction.customer.id.replace(/(\d{3})(\d{3})(\d{4})/, '$1-$2-$3')})</span>
                    )}
                  </h3>
                  <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-50 text-blue-700 border border-blue-200 flex-shrink-0">
                    {direction.typeDisplay}
                  </span>
                  {direction.WRK_CD === '04' && direction.WRK_DTL_TCD === '0440' && (
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-amber-50 text-amber-700 border border-amber-200 flex-shrink-0">
                      일시철거복구
                    </span>
                  )}
                </div>
                <div className="flex-shrink-0">
                  {statusBadges}
                </div>
              </div>

              {/* 2행: 날짜 + VIP (왼쪽) / 서비스건수 (오른쪽) */}
              <div className="flex items-center justify-between gap-2 mb-3">
                <div className="flex items-center gap-2">
                  <svg className="w-4 h-4 text-gray-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span className="text-sm text-gray-600">{formatDateTimeFromISO(direction.scheduledAt)}</span>
                  <VipBadge customer={direction.customer} />
                </div>
                <div className="flex-shrink-0">
                  {serviceBadge}
                </div>
              </div>
            </>
          );
        })()}

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

          {onWorkerAdjust && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onWorkerAdjust(direction);
              }}
              className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-gray-100 text-gray-700 hover:bg-gray-200 transition-colors text-sm font-medium flex-1"
            >
              <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
              <span className="whitespace-nowrap">작업자보정</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default WorkDirectionRow;
