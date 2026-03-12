import React from 'react';
import { AlertTriangle, List, Play, CheckSquare, XSquare } from 'lucide-react';
import { WorkOrder } from '../../types';
import { isTempSuspensionWork, isSuspensionReleaseWork } from '../../utils/workValidation';

interface SuspensionWorkDetailsProps {
  order: WorkOrder;
}

const InfoRow: React.FC<{ label: string; value?: string; highlight?: boolean }> = ({ label, value, highlight }) => (
  <div className={`flex py-2 border-b border-gray-100 ${highlight ? 'bg-yellow-50' : ''}`}>
    <div className="w-1/3 text-xs sm:text-sm font-medium text-gray-700">{label}</div>
    <div className="w-2/3 text-xs sm:text-sm text-gray-900">{value || '-'}</div>
  </div>
);

const SuspensionWorkDetails: React.FC<SuspensionWorkDetailsProps> = ({ order }) => {
  const isTempSuspension = isTempSuspensionWork(order.WRK_CD, order.WRK_DTL_TCD);
  const isSuspensionRelease = isSuspensionReleaseWork(order.WRK_CD, order.WRK_DTL_TCD);

  return (
    <div className="space-y-4">
      {/* 일시정지 신청 */}
      {isTempSuspension && (
        <div className="bg-gradient-to-r from-orange-50 to-amber-50 border border-orange-200 rounded-lg p-4">
          <h3 className="text-sm font-semibold text-orange-800 mb-3 flex items-center">
            <span className="mr-2">⏸️</span>
            일시정지 신청 정보
          </h3>
          <div className="bg-white rounded-lg border border-orange-100 divide-y divide-gray-100">
            <InfoRow
              label="정지 사유"
              value={order.mmtSusCd || '미입력'}
              highlight={!order.mmtSusCd}
            />
            <InfoRow
              label="정지 희망일"
              value={order.susHopeDd ? formatDate(order.susHopeDd) : '미입력'}
              highlight={!order.susHopeDd}
            />
            <InfoRow
              label="재개 희망일"
              value={order.mmtSusHopeDd ? formatDate(order.mmtSusHopeDd) : '미입력'}
              highlight={!order.mmtSusHopeDd}
            />
            <InfoRow
              label="처리 여부"
              value={order.susProcYn === 'Y' ? '처리완료' : '미처리'}
            />
            {order.termDays && (
              <InfoRow
                label="누적 정지 일수"
                value={`${order.termDays}일`}
              />
            )}
            {order.mmtCnt && (
              <InfoRow
                label="월 중 정지 횟수"
                value={`${order.mmtCnt}회`}
              />
            )}
          </div>

          {/* 일시정지 필수 입력 안내 */}
          <div className="mt-3 bg-orange-100 border border-orange-200 rounded-lg p-3">
            <h4 className="text-xs font-semibold text-orange-800 mb-2">📋 필수 입력 항목</h4>
            <ul className="text-xs text-orange-700 space-y-1">
              <li>• 일시정지 사유 코드 (MMT_SUS_CD)</li>
              <li>• 정지 희망일 (SUS_HOPE_DD)</li>
              <li>• 재개 희망일 (MMT_SUS_HOPE_DD)</li>
              <li>• 정지 처리 여부 (SUS_PROC_YN)</li>
            </ul>
          </div>

          {/* 계약 상태 확인 */}
          <div className="mt-3 bg-white border border-orange-200 rounded-lg p-3">
            <h4 className="text-xs font-semibold text-gray-700 mb-2 flex items-center gap-1">
              <AlertTriangle size={14} />
              계약 상태 확인
            </h4>
            <p className="text-xs text-gray-600">
              일시정지는 계약 상태가 <span className="font-semibold text-orange-600">'20'(정상)</span>인 경우에만 가능합니다.
            </p>
            <div className="mt-2 text-xs flex items-center gap-1">
              <span className="text-gray-600">현재 계약 상태: </span>
              <span className={`font-semibold flex items-center gap-1 ${order.CTRT_STAT === '20' ? 'text-green-600' : 'text-red-600'}`}>
                {order.CTRT_STAT || '미확인'}
                {order.CTRT_STAT === '20' ? <CheckSquare size={14} /> : <XSquare size={14} />}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* 일시정지 해제 */}
      {isSuspensionRelease && (
        <div className="bg-gradient-to-r from-primary-50 to-cyan-50 border border-primary-200 rounded-lg p-4">
          <h3 className="text-sm font-semibold text-primary-700 mb-3 flex items-center gap-2">
            <Play size={16} />
            일시정지 해제 정보
          </h3>
          <div className="bg-white rounded-lg border border-primary-100 divide-y divide-gray-100">
            <InfoRow
              label="정지 사유"
              value={order.mmtSusCd || '미입력'}
            />
            <InfoRow
              label="정지 시작일"
              value={order.susHopeDd ? formatDate(order.susHopeDd) : '미입력'}
            />
            <InfoRow
              label="예정 재개일"
              value={order.mmtSusHopeDd ? formatDate(order.mmtSusHopeDd) : '미입력'}
            />
            {order.termDays && (
              <InfoRow
                label="정지 경과 일수"
                value={`${order.termDays}일`}
              />
            )}
          </div>

          {/* 해제 필수 입력 안내 */}
          <div className="mt-3 bg-primary-100 border border-primary-200 rounded-lg p-3">
            <h4 className="text-xs font-semibold text-primary-700 mb-2 flex items-center gap-1">
              <List size={14} />
              필수 입력 항목
            </h4>
            <ul className="text-xs text-primary-600 space-y-1">
              <li>• 해제 사유</li>
              <li>• 해제 처리일</li>
              <li>• 서비스 재개 확인</li>
            </ul>
          </div>

          {/* 계약 상태 확인 */}
          <div className="mt-3 bg-white border border-primary-200 rounded-lg p-3">
            <h4 className="text-xs font-semibold text-gray-700 mb-2 flex items-center gap-1">
              <AlertTriangle size={14} />
              계약 상태 확인
            </h4>
            <p className="text-xs text-gray-600">
              일시정지 해제는 계약 상태가 <span className="font-semibold text-primary-700">'30'(일시정지)</span> 또는{' '}
              <span className="font-semibold text-primary-700">'37'(일시정지-특정)</span>인 경우에만 가능합니다.
            </p>
            <div className="mt-2 text-xs flex items-center gap-1">
              <span className="text-gray-600">현재 계약 상태: </span>
              <span className={`font-semibold flex items-center gap-1 ${order.CTRT_STAT === '30' || order.CTRT_STAT === '37' ? 'text-green-600' : 'text-red-600'}`}>
                {order.CTRT_STAT || '미확인'}
                {order.CTRT_STAT === '30' || order.CTRT_STAT === '37' ? <CheckSquare size={14} /> : <XSquare size={14} />}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* 댁내설치 (WRK_CD = '06') */}
      {order.WRK_CD === '06' && (
        <div className="bg-gradient-to-r from-gray-50 to-slate-50 border border-gray-200 rounded-lg p-4">
          <h3 className="text-sm font-semibold text-gray-800 mb-3 flex items-center">
            <span className="mr-2">🏠</span>
            댁내설치 작업 정보
          </h3>
          <div className="bg-white rounded-lg border border-gray-100 divide-y divide-gray-100">
            <InfoRow
              label="세부 유형"
              value={order.WRK_DTL_TCD === '0610' ? '설치보류' : order.WRK_DTL_TCD === '0620' ? '부재변경' : order.WRK_DTL_TCD || '미확인'}
            />
            <InfoRow
              label="작업 내용"
              value={order.details || '미입력'}
            />
          </div>

          <div className="mt-3 bg-gray-100 border border-gray-200 rounded-lg p-3">
            <h4 className="text-xs font-semibold text-gray-700 mb-2">📋 세부 유형 설명</h4>
            <ul className="text-xs text-gray-600 space-y-1">
              <li>• <span className="font-semibold">0610 (설치보류)</span>: 설치 일정을 보류하는 경우</li>
              <li>• <span className="font-semibold">0620 (부재변경)</span>: 고객 부재로 일정을 변경하는 경우</li>
            </ul>
          </div>
        </div>
      )}

      {/* 작업 진행 안내 */}
      <div className="bg-white border border-gray-200 rounded-lg p-4">
        <h4 className="text-sm font-semibold text-gray-800 mb-2">작업 진행 가이드</h4>
        <ul className="text-xs text-gray-600 space-y-2">
          {isTempSuspension && (
            <>
              <li className="flex items-start">
                <span className="mr-2">1.</span>
                <span>고객의 정지 사유를 정확히 확인하고 기록합니다.</span>
              </li>
              <li className="flex items-start">
                <span className="mr-2">2.</span>
                <span>정지 기간(시작일~재개일)을 고객과 협의하여 결정합니다.</span>
              </li>
              <li className="flex items-start">
                <span className="mr-2">3.</span>
                <span>계약 상태가 '정상(20)'인지 확인합니다.</span>
              </li>
              <li className="flex items-start">
                <span className="mr-2">4.</span>
                <span>월 중 정지 횟수 및 누적 정지 일수를 확인합니다.</span>
              </li>
            </>
          )}
          {isSuspensionRelease && (
            <>
              <li className="flex items-start">
                <span className="mr-2">1.</span>
                <span>현재 정지된 계약인지 상태를 확인합니다.</span>
              </li>
              <li className="flex items-start">
                <span className="mr-2">2.</span>
                <span>서비스 재개 희망일을 고객과 협의합니다.</span>
              </li>
              <li className="flex items-start">
                <span className="mr-2">3.</span>
                <span>장비 상태를 점검하고 서비스 연결을 테스트합니다.</span>
              </li>
              <li className="flex items-start">
                <span className="mr-2">4.</span>
                <span>서비스가 정상 작동하는지 고객과 함께 확인합니다.</span>
              </li>
            </>
          )}
        </ul>
      </div>
    </div>
  );
};

// 날짜 포맷 헬퍼 함수 (YYYYMMDD -> YYYY-MM-DD)
const formatDate = (dateStr: string): string => {
  if (!dateStr || dateStr.length !== 8) return dateStr;
  return `${dateStr.slice(0, 4)}-${dateStr.slice(4, 6)}-${dateStr.slice(6, 8)}`;
};

export default SuspensionWorkDetails;
