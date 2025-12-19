import React, { useState, useEffect } from 'react';
import { WorkItem } from '../../../types';
import { getSmsHistory, SmsHistoryItem } from '../../../services/apiService';
import { formatId } from '../../../utils/dateFormatter';

interface ReceptionInfoProps {
  workItem: WorkItem;
  onNext: () => void;
  onBack: () => void;
}

const ReceptionInfo: React.FC<ReceptionInfoProps> = ({ workItem, onNext, onBack }) => {
  // 문자발송이력 상태
  const [smsHistoryOpen, setSmsHistoryOpen] = useState(false);
  const [smsHistory, setSmsHistory] = useState<SmsHistoryItem[]>([]);
  const [smsLoading, setSmsLoading] = useState(false);
  const [smsLoaded, setSmsLoaded] = useState(false);

  // 컴포넌트 마운트 시 문자발송이력 조회 (건수 표시용)
  useEffect(() => {
    const fetchSmsHistory = async () => {
      if (workItem.customer?.id && !smsLoaded) {
        setSmsLoading(true);
        try {
          const history = await getSmsHistory(workItem.customer.id);
          setSmsHistory(history);
          setSmsLoaded(true);
        } catch (error) {
          console.error('문자발송이력 조회 실패:', error);
          setSmsHistory([]);
          setSmsLoaded(true);
        } finally {
          setSmsLoading(false);
        }
      }
    };
    fetchSmsHistory();
  }, [workItem.customer?.id]);

  // 문자발송이력 토글
  const handleSmsHistoryToggle = () => {
    setSmsHistoryOpen(!smsHistoryOpen);
  };

  return (
    <div className="px-3 sm:px-4 py-4 sm:py-6 pb-3 sm:pb-4 space-y-3 sm:space-y-4">
      {/* 접수 기본 정보 */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-3 sm:p-5">
        <h4 className="text-sm sm:text-base font-bold text-gray-900 mb-3 sm:mb-4">접수 기본 정보</h4>
        <div className="space-y-1.5 sm:space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[10px] sm:text-xs text-gray-500">접수ID</span>
            <span className="text-xs sm:text-sm font-medium text-gray-900 whitespace-nowrap">{formatId(workItem.RCPT_ID)}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-[10px] sm:text-xs text-gray-500">작업ID</span>
            <span className="text-xs sm:text-sm font-medium text-gray-900 whitespace-nowrap">{formatId(workItem.id)}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-[10px] sm:text-xs text-gray-500">작업유형</span>
            <span className="text-xs sm:text-sm font-medium text-blue-600 whitespace-nowrap">{workItem.typeDisplay}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-[10px] sm:text-xs text-gray-500">작업상태</span>
            <span className="text-xs sm:text-sm font-medium text-gray-900 whitespace-nowrap">{getStatusText(workItem.WRK_STAT_CD)}</span>
          </div>
          <div className="flex items-center justify-between pt-1.5 sm:pt-2 mt-1.5 sm:mt-2 border-t border-gray-100">
            <span className="text-[10px] sm:text-xs text-gray-500">예정일시</span>
            <span className="text-xs sm:text-sm font-semibold text-blue-600 whitespace-nowrap">{formatDateTime(workItem.scheduledAt)}</span>
          </div>
        </div>
      </div>

      {/* 작업 유형별 세부 정보 */}
      {renderWorkTypeDetails(workItem)}

      {/* 작업 요청 상세 */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-3 sm:p-5">
        <h4 className="text-sm sm:text-base font-bold text-gray-900 mb-2.5 sm:mb-3">작업 요청 상세</h4>
        <div className="p-3 sm:p-4 bg-gray-50 rounded-lg text-xs sm:text-sm text-gray-700 leading-relaxed min-h-20 whitespace-pre-wrap">
          {workItem.details?.replace(/◈/g, '\n◈') || '작업 상세 내용이 없습니다.'}
        </div>
      </div>

      {/* 설치 위치 정보 */}
      {workItem.installLocation && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-3 sm:p-5">
          <h4 className="text-sm sm:text-base font-bold text-gray-900 mb-2.5 sm:mb-3">설치 위치</h4>
          <div className="flex items-center gap-1.5 sm:gap-2 p-2.5 sm:p-3 bg-gray-50 rounded-lg">
            <svg className="w-4 h-4 sm:w-5 sm:h-5 text-gray-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            <span className="text-xs sm:text-sm font-medium text-gray-900">{workItem.installLocation}</span>
          </div>
        </div>
      )}

      {/* 고객 연락처 정보 */}
      {workItem.cellNo && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-3 sm:p-5">
          <h4 className="text-sm sm:text-base font-bold text-gray-900 mb-2.5 sm:mb-3">고객 연락처</h4>
          <div className="flex items-center justify-between gap-2 p-2.5 sm:p-3 bg-gray-50 rounded-lg">
            <span className="text-xs sm:text-sm font-medium text-gray-900 truncate">{workItem.cellNo}</span>
            <button className="min-h-10 sm:min-h-12 px-3 sm:px-4 py-2 bg-green-500 hover:bg-green-600 text-white text-xs sm:text-sm font-medium rounded-lg transition-colors flex items-center gap-1.5 sm:gap-2 whitespace-nowrap flex-shrink-0">
              <svg className="w-3.5 h-3.5 sm:w-4 sm:h-4" fill="currentColor" viewBox="0 0 20 20">
                <path d="M2 3a1 1 0 011-1h2.153a1 1 0 01.986.836l.74 4.435a1 1 0 01-.54 1.06l-1.548.773a11.037 11.037 0 006.105 6.105l.774-1.548a1 1 0 011.059-.54l4.435.74a1 1 0 01.836.986V17a1 1 0 01-1 1h-2C7.82 18 2 12.18 2 5V3z" />
              </svg>
              전화 걸기
            </button>
          </div>
        </div>
      )}

      {/* 문자발송이력 (아코디언) */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <button
          onClick={handleSmsHistoryToggle}
          className="w-full p-3 sm:p-5 flex items-center justify-between hover:bg-gray-50 transition-colors"
        >
          <div className="flex items-center gap-2 sm:gap-3">
            <svg className="w-4 h-4 sm:w-5 sm:h-5 text-blue-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
            </svg>
            <h4 className="text-sm sm:text-base font-bold text-gray-900">문자발송이력</h4>
            {smsLoading ? (
              <span className="px-1.5 sm:px-2 py-0.5 bg-gray-100 text-gray-500 text-[10px] sm:text-xs font-medium rounded-full whitespace-nowrap">
                조회중...
              </span>
            ) : smsLoaded && (
              <span className="px-1.5 sm:px-2 py-0.5 bg-blue-100 text-blue-700 text-[10px] sm:text-xs font-medium rounded-full whitespace-nowrap">
                {smsHistory.length}건
              </span>
            )}
          </div>
          <svg
            className={`w-4 h-4 sm:w-5 sm:h-5 text-gray-400 transition-transform flex-shrink-0 ${smsHistoryOpen ? 'rotate-180' : ''}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>

        {smsHistoryOpen && (
          <div className="border-t border-gray-100 p-3 sm:p-5">
            {smsLoading ? (
              <div className="flex items-center justify-center py-6 sm:py-8">
                <div className="animate-spin rounded-full h-5 w-5 sm:h-6 sm:w-6 border-b-2 border-blue-500"></div>
                <span className="ml-2 sm:ml-3 text-xs sm:text-sm text-gray-500">조회 중...</span>
              </div>
            ) : smsHistory.length === 0 ? (
              <div className="text-center py-6 sm:py-8 text-gray-500 text-xs sm:text-sm">
                최근 7일간 발송이력이 없습니다.
              </div>
            ) : (
              <div className="space-y-2.5 sm:space-y-3 max-h-64 sm:max-h-80 overflow-y-auto">
                {smsHistory.map((item, index) => (
                  <div key={index} className="p-3 sm:p-4 bg-gray-50 rounded-lg border border-gray-100">
                    <div className="flex items-center justify-between mb-1.5 sm:mb-2 gap-2">
                      <div className="flex items-center gap-1.5 sm:gap-2 flex-1 min-w-0">
                        <span className={`px-1.5 sm:px-2 py-0.5 text-[10px] sm:text-xs font-medium rounded whitespace-nowrap ${
                          item.MSG_TYP === 'KKO' ? 'bg-yellow-100 text-yellow-700' :
                          item.MSG_TYP === 'LMS' ? 'bg-purple-100 text-purple-700' :
                          'bg-blue-100 text-blue-700'
                        }`}>
                          {item.MSG_TYP || 'SMS'}
                        </span>
                        <span className="text-xs sm:text-sm font-medium text-gray-900 truncate">{item.EML_SMS_SND_TP_NM || '-'}</span>
                      </div>
                      <span className={`text-[10px] sm:text-xs font-medium whitespace-nowrap ${
                        item.RESULT === '성공' ? 'text-green-600' :
                        item.RESULT === '실패' ? 'text-red-600' : 'text-gray-500'
                      }`}>
                        {item.RESULT || '-'}
                      </span>
                    </div>
                    <div className="grid grid-cols-2 gap-1.5 sm:gap-2 text-[10px] sm:text-xs text-gray-500 mb-1.5 sm:mb-2">
                      <div className="truncate">수신: {item.CELL_PHN || '-'}</div>
                      <div className="truncate">발신: {item.SMS_RCV_NO || '-'}</div>
                      {item.SEND_TIME && <div className="col-span-2">전송시간: {item.SEND_TIME}</div>}
                      {item.REG_NM && <div className="col-span-2">등록자: {item.REG_NM}</div>}
                    </div>
                    {item.MESSAGE && (
                      <div className="mt-1.5 sm:mt-2 p-2 bg-white rounded border border-gray-200 text-xs sm:text-sm text-gray-700 whitespace-pre-wrap">
                        {item.MESSAGE}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

// 작업 유형별 세부 정보 렌더링
const renderWorkTypeDetails = (workItem: WorkItem) => {
  const wrkCd = workItem.WRK_CD;

  // A/S 작업
  if (wrkCd === '03') {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
        <h4 className="text-base font-bold text-gray-900 mb-4">A/S 상세 정보</h4>
        <div className="grid grid-cols-2 gap-3 mb-4">
          {workItem.asReasonCode && (
            <div className="space-y-1">
              <span className="text-xs text-gray-500">A/S 사유 코드</span>
              <p className="text-sm font-medium text-gray-900">{workItem.asReasonCode}</p>
            </div>
          )}
          {workItem.asDetailCode && (
            <div className="space-y-1">
              <span className="text-xs text-gray-500">상세 코드</span>
              <p className="text-sm font-medium text-gray-900">{workItem.asDetailCode}</p>
            </div>
          )}
          {workItem.rcType && (
            <div className="space-y-1 col-span-2">
              <span className="text-xs text-gray-500">접수 유형</span>
              <p className="text-sm font-medium text-gray-900">{workItem.rcType}</p>
            </div>
          )}
        </div>
        {workItem.asHistory && workItem.asHistory.length > 0 && (
          <div className="pt-4 border-t border-gray-100">
            <label className="text-sm font-semibold text-gray-700 mb-3 block">이전 A/S 이력</label>
            <div className="space-y-2">
              {workItem.asHistory.map((history, index) => (
                <div key={index} className="p-3 bg-gray-50 rounded-lg">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-semibold text-gray-600">{history.asDate}</span>
                    <span className="text-xs text-gray-500">담당: {history.asWorker}</span>
                  </div>
                  <p className="text-sm text-gray-700 font-medium mb-1">{history.asReason}</p>
                  <p className="text-sm text-gray-600">{history.asResult}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  }

  // 해지 작업
  if (wrkCd === '02') {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
        <h4 className="text-base font-bold text-gray-900 mb-4">해지 상세 정보</h4>
        <div className="space-y-3">
          {workItem.termReasonCode && (
            <div className="space-y-1">
              <span className="text-xs text-gray-500">해지 사유</span>
              <p className="text-sm font-medium text-gray-900">{workItem.termReasonCode}</p>
            </div>
          )}
          {workItem.termFee && (
            <div className="p-3 bg-red-50 border border-red-100 rounded-lg">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-red-700">위약금</span>
                <span className="text-base font-bold text-red-600">{workItem.termFee.toLocaleString()}원</span>
              </div>
            </div>
          )}
          {workItem.promYn && (
            <div className="space-y-1">
              <span className="text-xs text-gray-500">프로모션 적용</span>
              <p className="text-sm font-medium text-gray-900">{workItem.promYn === 'Y' ? '예' : '아니오'}</p>
            </div>
          )}
        </div>
      </div>
    );
  }

  // 일시정지 작업
  if (wrkCd === '0410' || wrkCd === '06') {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
        <h4 className="text-base font-bold text-gray-900 mb-4">일시정지 상세 정보</h4>
        <div className="grid grid-cols-2 gap-3">
          {workItem.mmtSusCd && (
            <div className="space-y-1 col-span-2">
              <span className="text-xs text-gray-500">정지 사유 코드</span>
              <p className="text-sm font-medium text-gray-900">{workItem.mmtSusCd}</p>
            </div>
          )}
          {workItem.susHopeDd && (
            <div className="space-y-1">
              <span className="text-xs text-gray-500">정지 희망일</span>
              <p className="text-sm font-medium text-gray-900">{formatDate(workItem.susHopeDd)}</p>
            </div>
          )}
          {workItem.mmtSusHopeDd && (
            <div className="space-y-1">
              <span className="text-xs text-gray-500">재개 희망일</span>
              <p className="text-sm font-medium text-gray-900">{formatDate(workItem.mmtSusHopeDd)}</p>
            </div>
          )}
          {workItem.termDays && (
            <div className="space-y-1 col-span-2">
              <span className="text-xs text-gray-500">누적 정지 일수</span>
              <p className="text-sm font-medium text-blue-600">{workItem.termDays}일</p>
            </div>
          )}
        </div>
      </div>
    );
  }

  // 상품변경 작업
  if (wrkCd === '05') {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
        <h4 className="text-base font-bold text-gray-900 mb-4">상품변경 상세 정보</h4>
        <div className="flex items-center gap-3">
          <div className="flex-1 p-4 bg-gray-50 rounded-lg border border-gray-200">
            <span className="text-xs text-gray-500 block mb-1">현재 상품</span>
            <p className="text-sm font-semibold text-gray-900">{workItem.currentProduct || '-'}</p>
          </div>
          <div className="flex-shrink-0">
            <svg className="w-6 h-6 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
            </svg>
          </div>
          <div className="flex-1 p-4 bg-blue-50 rounded-lg border border-blue-200">
            <span className="text-xs text-blue-600 block mb-1">변경 상품</span>
            <p className="text-sm font-semibold text-blue-900">{workItem.newProduct || '-'}</p>
          </div>
        </div>
      </div>
    );
  }

  return null;
};

// Helper functions
const getStatusText = (status?: string): string => {
  const statusMap: { [key: string]: string } = {
    '1': '접수',
    '2': '할당',
    '3': '취소',
    '4': '완료',
    '7': '부분완료',
    '9': '삭제',
  };
  return statusMap[status || ''] || '알 수 없음';
};

const formatDateTime = (dateTime: string): string => {
  try {
    const date = new Date(dateTime);
    return date.toLocaleString('ko-KR', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return dateTime;
  }
};

const formatDate = (dateStr: string): string => {
  // YYYYMMDD 형식을 YYYY-MM-DD로 변환
  if (dateStr && dateStr.length === 8) {
    return `${dateStr.slice(0, 4)}-${dateStr.slice(4, 6)}-${dateStr.slice(6, 8)}`;
  }
  return dateStr;
};

export default ReceptionInfo;
