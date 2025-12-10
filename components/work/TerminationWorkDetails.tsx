import React from 'react';
import { AlertTriangle } from 'lucide-react';
import { WorkOrder } from '../../types';

interface TerminationWorkDetailsProps {
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

const TerminationWorkDetails: React.FC<TerminationWorkDetailsProps> = ({ order }) => {
  return (
    <div className="space-y-4">
      {/* 해지 작업 특화 정보 */}
      <div className="bg-gradient-to-r from-red-50 to-pink-50 border border-red-200 rounded-lg p-4">
        <h3 className="text-sm font-semibold text-red-800 mb-2 flex items-center">
          <span className="inline-block w-2 h-2 bg-red-500 rounded-full mr-2"></span>
          해지 작업 정보
        </h3>
        <div className="space-y-1">
          <InfoRow label="해지 사유" value={order.termReasonCode || '고객 요청'} />
          <InfoRow label="위약금" value={order.termFee ? `${order.termFee.toLocaleString()}원` : '없음'} />
          <InfoRow label="계약 ID" value={order.CTRT_ID} />
          <InfoRow label="접수 ID" value={order.RCPT_ID} />
        </div>
      </div>

      {/* 장비 회수 체크리스트 */}
      <div className="bg-white border border-gray-200 rounded-lg p-4">
        <h3 className="text-sm font-semibold text-gray-800 mb-3 flex items-center">
          <svg className="w-4 h-4 mr-2 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
          </svg>
          장비 회수 체크리스트
        </h3>
        <div className="space-y-2 text-sm text-gray-700">
          <label className="flex items-center space-x-2 hover:bg-gray-50 p-2 rounded transition-colors">
            <input type="checkbox" className="rounded text-red-600 focus:ring-red-500" disabled />
            <span>모뎀 회수 완료</span>
          </label>
          <label className="flex items-center space-x-2 hover:bg-gray-50 p-2 rounded transition-colors">
            <input type="checkbox" className="rounded text-red-600 focus:ring-red-500" disabled />
            <span>셋톱박스 회수 완료</span>
          </label>
          <label className="flex items-center space-x-2 hover:bg-gray-50 p-2 rounded transition-colors">
            <input type="checkbox" className="rounded text-red-600 focus:ring-red-500" disabled />
            <span>기타 장비 회수 완료</span>
          </label>
          <label className="flex items-center space-x-2 hover:bg-gray-50 p-2 rounded transition-colors">
            <input type="checkbox" className="rounded text-red-600 focus:ring-red-500" disabled />
            <span>고객 확인 서명 받기</span>
          </label>
        </div>
      </div>

      {/* 해지 처리 안내 */}
      <div className="bg-red-50 border border-red-200 rounded-lg p-3">
        <h4 className="text-xs font-semibold text-red-800 mb-2 flex items-center gap-1">
          <AlertTriangle size={14} />
          해지 작업 완료 시 필수 입력 사항
        </h4>
        <ul className="text-xs text-red-700 space-y-1">
          <li className="flex items-start">
            <span className="mr-2">•</span>
            <span>회수한 장비 정보 입력 필수 (모델명, 시리얼 번호)</span>
          </li>
          <li className="flex items-start">
            <span className="mr-2">•</span>
            <span>해지 사유 선택 및 상세 내용 기재</span>
          </li>
          <li className="flex items-start">
            <span className="mr-2">•</span>
            <span>위약금 안내 및 고객 동의 확인</span>
          </li>
          <li className="flex items-start">
            <span className="mr-2">•</span>
            <span>해지 완료 서명 받기</span>
          </li>
        </ul>
      </div>

      {/* 위약금 안내 (있는 경우) */}
      {order.termFee && order.termFee > 0 && (
        <div className="bg-yellow-50 border border-yellow-300 rounded-lg p-3">
          <h4 className="text-xs font-semibold text-yellow-800 mb-2 flex items-center">
            <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            위약금 청구 안내
          </h4>
          <p className="text-xs text-yellow-700">
            위약금 <strong className="text-yellow-900">{order.termFee.toLocaleString()}원</strong>이 발생합니다.
            고객에게 위약금 내역을 안내하고 동의를 받으시기 바랍니다.
          </p>
        </div>
      )}
    </div>
  );
};

export default TerminationWorkDetails;
