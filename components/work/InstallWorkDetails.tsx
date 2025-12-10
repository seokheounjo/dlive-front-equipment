import React from 'react';
import { WorkOrder } from '../../types';

interface InstallWorkDetailsProps {
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

const InstallWorkDetails: React.FC<InstallWorkDetailsProps> = ({ order }) => {
  return (
    <div className="space-y-4">
      {/* 신규 설치 특화 정보 */}
      <div className="bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200 rounded-lg p-4">
        <h3 className="text-sm font-semibold text-green-800 mb-2 flex items-center">
          <span className="inline-block w-2 h-2 bg-green-500 rounded-full mr-2"></span>
          신규 설치 정보
        </h3>
        <div className="space-y-1">
          <InfoRow label="상품명" value={order.productName || '기본 상품'} />
          <InfoRow label="설치 위치" value={order.installLocation || order.customer.address} />
          <InfoRow label="계약 ID" value={order.CTRT_ID} />
          <InfoRow label="접수 ID" value={order.RCPT_ID} />
        </div>
      </div>

      {/* 설치 체크리스트 */}
      <div className="bg-white border border-gray-200 rounded-lg p-4">
        <h3 className="text-sm font-semibold text-gray-800 mb-3 flex items-center">
          <svg className="w-4 h-4 mr-2 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          설치 체크리스트
        </h3>
        <div className="space-y-2 text-sm text-gray-700">
          <label className="flex items-center space-x-2 hover:bg-gray-50 p-2 rounded transition-colors">
            <input type="checkbox" className="rounded text-green-600 focus:ring-green-500" disabled />
            <span>장비 설치 완료</span>
          </label>
          <label className="flex items-center space-x-2 hover:bg-gray-50 p-2 rounded transition-colors">
            <input type="checkbox" className="rounded text-green-600 focus:ring-green-500" disabled />
            <span>인터넷 연결 테스트</span>
          </label>
          <label className="flex items-center space-x-2 hover:bg-gray-50 p-2 rounded transition-colors">
            <input type="checkbox" className="rounded text-green-600 focus:ring-green-500" disabled />
            <span>고객 사용법 안내</span>
          </label>
          <label className="flex items-center space-x-2 hover:bg-gray-50 p-2 rounded transition-colors">
            <input type="checkbox" className="rounded text-green-600 focus:ring-green-500" disabled />
            <span>약관 동의 및 서명 완료</span>
          </label>
        </div>
      </div>

      {/* 신규 설치 안내 */}
      <div className="bg-green-50 border border-green-200 rounded-lg p-3">
        <h4 className="text-xs font-semibold text-green-800 mb-2">📋 신규 설치 완료 시 필수 입력 사항</h4>
        <ul className="text-xs text-green-700 space-y-1">
          <li className="flex items-start">
            <span className="mr-2">•</span>
            <span>설치한 장비 정보 입력 필수 (모델명, 시리얼 번호)</span>
          </li>
          <li className="flex items-start">
            <span className="mr-2">•</span>
            <span>약관 동의 확인 및 전자서명 받기</span>
          </li>
          <li className="flex items-start">
            <span className="mr-2">•</span>
            <span>설치 완료 사진 촬영 (선택사항)</span>
          </li>
          <li className="flex items-start">
            <span className="mr-2">•</span>
            <span>고객 만족도 확인</span>
          </li>
        </ul>
      </div>
    </div>
  );
};

export default InstallWorkDetails;
