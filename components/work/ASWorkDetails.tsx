import React from 'react';
import { WorkOrder, ASHistory } from '../../types';

interface ASWorkDetailsProps {
  order: WorkOrder;
}

const InfoRow: React.FC<{ label: string; value?: string; children?: React.ReactNode }> = ({ label, value, children }) => (
  <div className="py-2 sm:py-3 border-b border-gray-100 last:border-b-0">
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-1 sm:gap-4 hover:bg-gray-50/50 transition-colors duration-150 rounded-lg px-2 sm:px-3 py-1 sm:py-2">
      <dt className="text-xs sm:text-sm font-medium text-gray-600 flex items-center">{label}</dt>
      <dd className="sm:col-span-2 flex items-center text-sm sm:text-base text-gray-900 mt-0.5 sm:mt-0">{children || value || '-'}</dd>
    </div>
  </div>
);

const ASWorkDetails: React.FC<ASWorkDetailsProps> = ({ order }) => {
  return (
    <div className="space-y-4">
      {/* AS 작업 특화 정보 */}
      <div className="bg-gradient-to-r from-orange-50 to-yellow-50 border border-orange-200 rounded-lg p-4">
        <h3 className="text-sm font-semibold text-orange-800 mb-2 flex items-center">
          <span className="inline-block w-2 h-2 bg-orange-500 rounded-full mr-2"></span>
          A/S 작업 정보
        </h3>
        <div className="space-y-1 text-sm text-orange-700">
          <InfoRow label="A/S 유형" value={order.WRK_DTL_TCD || 'AS 수리'} />
          <InfoRow label="계약 ID" value={order.CTRT_ID} />
          <InfoRow label="접수 ID" value={order.RCPT_ID} />
        </div>
      </div>

      {/* AS 이력 (있는 경우) */}
      {order.asHistory && order.asHistory.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <h3 className="text-sm font-semibold text-gray-800 mb-3 flex items-center">
            <svg className="w-4 h-4 mr-2 text-primary-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            이전 A/S 이력
          </h3>
          <div className="space-y-2">
            {order.asHistory.map((history, index) => (
              <div key={index} className="border-l-2 border-primary-300 pl-3 py-2 hover:bg-primary-50 transition-colors rounded">
                <div className="flex justify-between items-start mb-1">
                  <span className="text-xs font-medium text-gray-700">{history.asDate}</span>
                  <span className="text-xs px-2 py-0.5 bg-primary-100 text-primary-700 rounded-full">{history.asResult}</span>
                </div>
                <div className="text-sm text-gray-600">{history.asReason}</div>
                <div className="text-xs text-gray-500 mt-1">처리자: {history.asWorker}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* AS 작업 안내 */}
      <div className="bg-primary-50 border border-primary-200 rounded-lg p-3">
        <h4 className="text-xs font-semibold text-primary-700 mb-2">📋 A/S 작업 완료 시 필수 입력 사항</h4>
        <ul className="text-xs text-primary-600 space-y-1">
          <li className="flex items-start">
            <span className="mr-2">•</span>
            <span>교체/수리한 장비 정보 입력 필수</span>
          </li>
          <li className="flex items-start">
            <span className="mr-2">•</span>
            <span>A/S 처리 결과 및 상세 내용 기재</span>
          </li>
          <li className="flex items-start">
            <span className="mr-2">•</span>
            <span>고객 확인 서명 받기</span>
          </li>
        </ul>
      </div>
    </div>
  );
};

export default ASWorkDetails;
