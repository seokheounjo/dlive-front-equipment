import React from 'react';
import { CheckCircle, Wrench, Package, RefreshCw, MapPin, Pause } from 'lucide-react';
import { WorkOrder } from '../../types';
import {
  isASWork,
  isInstallWork,
  isTerminationWork,
  isRemovalWork,
  isSuspensionWork,
  isTempSuspensionWork,
  isSuspensionReleaseWork,
  isProductChangeWork,
  isRelocationWork,
  getCompleteButtonText
} from '../../utils/workValidation';

interface WorkCompleteDetailProps {
  order: WorkOrder;
  onBack: () => void;
}

const TableRow: React.FC<{ label: string; value?: string; children?: React.ReactNode }> = ({ label, value, children }) => (
  <tr className="border-b border-gray-200">
    <td className="px-2 py-2 text-xs sm:text-sm font-medium text-gray-700 bg-blue-100 border-r border-gray-200 w-1/3">
      {label}
    </td>
    <td className="px-2 py-2 text-xs sm:text-sm text-gray-900 w-2/3">
      {children || value || '-'}
    </td>
  </tr>
);

const WorkCompleteDetail: React.FC<WorkCompleteDetailProps> = ({ order, onBack }) => {
  return (
    <div className="max-w-4xl mx-auto p-2 sm:p-4">
      {/* 메인 카드 */}
      <div className="bg-white rounded-lg shadow-lg border border-gray-200 overflow-hidden">
        {/* 제목 헤더 - 작업 유형별 동적 제목 */}
        <div className="bg-blue-600 text-white px-3 py-2 text-sm sm:text-base font-semibold">
          {getCompleteButtonText(order.WRK_CD)} [1.작업정보]
        </div>

        {/* 작업 상세 테이블 */}
        <div className="p-3 sm:p-4">
          <div className="mb-4">
            <div className="bg-blue-50 border border-blue-200 rounded-lg overflow-hidden">
              <table className="w-full text-xs sm:text-sm">
                <thead>
                  <tr className="bg-blue-600 text-white">
                    <th className="px-2 py-1.5 text-left font-medium border-r border-blue-500">구분</th>
                    <th className="px-2 py-1.5 text-left font-medium border-r border-blue-500">작업상세</th>
                    <th className="px-2 py-1.5 text-left font-medium border-r border-blue-500">작업상태</th>
                    <th className="px-2 py-1.5 text-left font-medium">상품코드</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="bg-white border-b border-blue-200">
                    <td className="px-2 py-1.5 border-r border-blue-200">{order.typeDisplay}</td>
                    <td className="px-2 py-1.5 border-r border-blue-200">설치</td>
                    <td className="px-2 py-1.5 border-r border-blue-200">완료</td>
                    <td className="px-2 py-1.5">ISP</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* 상세 정보 테이블 */}
          <div className="bg-white border border-gray-300 rounded-lg overflow-hidden">
            <table className="w-full">
              <tbody>
                <TableRow label="상품명" value="ISP 스마트 광랜" />
                <TableRow label="작업상세" value="추가" />
                <TableRow label="고객번호" value={order.customer.id || "1001857578"} />
                <TableRow label="고객명" value={order.customer.name} />
                <TableRow label="연락처" value={order.customer.phone || "01044586687"} />
                <TableRow label="번호구분" value="요청번호" />
                <TableRow label="실치위치" value="/" />
                <TableRow label="CELL NO" value="-" />
                <TableRow label="작업주소" value={order.customer.address || "서울시 송파구 석촌동 261번지 17호"} />
                <TableRow label="도로명" value="석촌호수로 261번지 17호" />
              </tbody>
            </table>
          </div>

          {/* 작업 유형별 필수 입력 안내 */}
          <div className="mt-4">
            {isInstallWork(order.WRK_CD) && (
              <div className="bg-green-50 border border-green-300 rounded-lg p-3 mb-3">
                <h4 className="text-xs sm:text-sm font-semibold text-green-800 mb-2 flex items-center gap-1">
                  <CheckCircle size={16} />
                  신규 설치 완료 체크리스트
                </h4>
                <ul className="text-xs text-green-700 space-y-1">
                  <li>• 설치 장비 정보 입력 완료</li>
                  <li>• 약관 동의 및 전자서명 완료</li>
                  <li>• 인터넷 연결 테스트 완료</li>
                  <li>• 고객 사용법 안내 완료</li>
                  <li>• 자동이체 등록 완료 (해당 시)</li>
                </ul>
              </div>
            )}

            {isASWork(order.WRK_CD) && (
              <div className="bg-orange-50 border border-orange-300 rounded-lg p-3 mb-3">
                <h4 className="text-xs sm:text-sm font-semibold text-orange-800 mb-2 flex items-center gap-1">
                  <Wrench size={16} />
                  A/S 작업 완료 체크리스트
                </h4>
                <ul className="text-xs text-orange-700 space-y-1">
                  <li>• 교체/수리 장비 정보 입력 완료</li>
                  <li>• A/S 처리 결과 및 상세 내용 기재</li>
                  <li>• 고장 원인 파악 및 기록</li>
                  <li>• 서비스 정상 작동 테스트 완료</li>
                  <li>• 고객 확인 서명 받기</li>
                </ul>
              </div>
            )}

            {(isTerminationWork(order.WRK_CD) || isRemovalWork(order.WRK_CD)) && (
              <div className="bg-red-50 border border-red-300 rounded-lg p-3 mb-3">
                <h4 className="text-xs sm:text-sm font-semibold text-red-800 mb-2 flex items-center gap-1">
                  <Package size={16} />
                  회수/철거 완료 체크리스트
                </h4>
                <ul className="text-xs text-red-700 space-y-1">
                  <li>• 회수한 장비 정보 입력 완료</li>
                  <li>• {isTerminationWork(order.WRK_CD) ? '해지 사유 및 위약금 안내' : '철거 사유 기재'}</li>
                  <li>• 장비 상태 확인 및 기록</li>
                  <li>• 고객 확인 서명 받기</li>
                </ul>
              </div>
            )}

            {isProductChangeWork(order.WRK_CD) && (
              <div className="bg-purple-50 border border-purple-300 rounded-lg p-3 mb-3">
                <h4 className="text-xs sm:text-sm font-semibold text-purple-800 mb-2 flex items-center gap-1">
                  <RefreshCw size={16} />
                  상품변경 완료 체크리스트
                </h4>
                <ul className="text-xs text-purple-700 space-y-1">
                  <li>• 변경 상품 정보 입력 완료</li>
                  <li>• 변경 사유 기재 완료</li>
                  <li>• 요금 변경 사항 고객 안내</li>
                  <li>• 장비 변경 작업 완료 (해당 시)</li>
                  <li>• 서비스 정상 작동 확인</li>
                  <li>• 고객 확인 서명 받기</li>
                </ul>
              </div>
            )}

            {isRelocationWork(order.WRK_CD) && (
              <div className="bg-blue-50 border border-blue-300 rounded-lg p-3 mb-3">
                <h4 className="text-xs sm:text-sm font-semibold text-blue-800 mb-2 flex items-center gap-1">
                  <MapPin size={16} />
                  이전 작업 완료 체크리스트
                </h4>
                <ul className="text-xs text-blue-700 space-y-1">
                  <li>• 기존 위치 철거 완료</li>
                  <li>• 새 위치 설치 완료</li>
                  <li>• 장비 상태 점검 완료</li>
                  <li>• 네트워크 연결 테스트 완료</li>
                  <li>• 새 주소 정보 업데이트</li>
                  <li>• 고객 확인 서명 받기</li>
                </ul>
              </div>
            )}

            {isTempSuspensionWork(order.WRK_CD) && (
              <div className="bg-orange-50 border border-orange-300 rounded-lg p-3 mb-3">
                <h4 className="text-xs sm:text-sm font-semibold text-orange-800 mb-2 flex items-center gap-1">
                  <Pause size={16} />
                  일시정지 신청 완료 체크리스트
                </h4>
                <ul className="text-xs text-orange-700 space-y-1">
                  <li>• 일시정지 사유 코드 입력 완료</li>
                  <li>• 정지 희망일 입력 완료</li>
                  <li>• 재개 희망일 입력 완료</li>
                  <li>• 계약 상태 확인 (정상:20)</li>
                  <li>• 누적 정지 일수 확인</li>
                  <li>• 고객 정지 사유 확인 완료</li>
                </ul>
              </div>
            )}

            {isSuspensionReleaseWork(order.WRK_CD) && (
              <div className="bg-blue-50 border border-blue-300 rounded-lg p-3 mb-3">
                <h4 className="text-xs sm:text-sm font-semibold text-blue-800 mb-2 flex items-center gap-1">
                  <CheckCircle size={16} />
                  일시정지 해제 완료 체크리스트
                </h4>
                <ul className="text-xs text-blue-700 space-y-1">
                  <li>• 해제 사유 입력 완료</li>
                  <li>• 해제 처리일 입력 완료</li>
                  <li>• 계약 상태 확인 (정지:30/37)</li>
                  <li>• 서비스 재개 확인</li>
                  <li>• 장비 상태 점검 완료</li>
                  <li>• 고객 서비스 작동 확인</li>
                </ul>
              </div>
            )}

            {order.WRK_CD === '06' && (
              <div className="bg-gray-50 border border-gray-300 rounded-lg p-3 mb-3">
                <h4 className="text-xs sm:text-sm font-semibold text-gray-800 mb-2">⏸️ 정지 작업 완료 체크리스트</h4>
                <ul className="text-xs text-gray-700 space-y-1">
                  <li>• 정지 사유 기재 완료</li>
                  <li>• {order.WRK_DTL_TCD === '0610' ? '설치보류 사유 확인' : order.WRK_DTL_TCD === '0620' ? '부재 사유 확인' : '정지 사유 확인'}</li>
                  <li>• 고객과 재일정 협의 완료</li>
                </ul>
              </div>
            )}

            {order.WRK_CD === '09' && (
              <div className="bg-gray-50 border border-gray-300 rounded-lg p-3 mb-3">
                <h4 className="text-xs sm:text-sm font-semibold text-gray-800 mb-2">📋 기타 작업 완료 체크리스트</h4>
                <ul className="text-xs text-gray-700 space-y-1">
                  <li>• 작업 내용 상세 기재 완료</li>
                  <li>• 작업 결과 기록 완료</li>
                  <li>• 고객 확인 서명 받기</li>
                </ul>
              </div>
            )}
          </div>

          {/* 추가 정보 */}
          <div className="mt-4 bg-gray-50 p-3 rounded-lg">
            <h4 className="text-xs sm:text-sm font-semibold text-gray-700 mb-2">작업 메모</h4>
            <p className="text-xs sm:text-sm text-gray-600">
              {order.details || "작업이 정상적으로 완료되었습니다."}
            </p>
          </div>

          {/* 완료 정보 */}
          <div className="mt-4 bg-green-50 border border-green-300 rounded-lg p-3">
            <h4 className="text-xs sm:text-sm font-semibold text-green-800 mb-2">완료 정보</h4>
            <div className="space-y-1 text-xs sm:text-sm text-green-700">
              <div>완료일시: {new Date().toLocaleString('ko-KR')}</div>
              <div>작업자: 모바일 작업자</div>
              <div>작업 ID: {order.id}</div>
              {order.WRK_CD && <div>작업 코드: {order.WRK_CD}</div>}
              {order.CTRT_ID && <div>계약 ID: {order.CTRT_ID}</div>}
              <div>상태: {getCompleteButtonText(order.WRK_CD)}</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default WorkCompleteDetail;
