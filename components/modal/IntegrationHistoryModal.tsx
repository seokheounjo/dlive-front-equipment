import React, { useState, useEffect } from 'react';
import { API_BASE } from '../../services/apiService';
import BaseModal from '../common/BaseModal';
import '../../styles/buttons.css';

interface IntegrationHistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  ctrtId: string;
  custId?: string;
}

interface HistoryRecord {
  ctrt_id: string;
  prod_nm: string;
  msg_id_nm: string;
  proc_rslt_cd_nm: string;
  strt_dttm: string;
  rslt_cd_nm: string;
}

const IntegrationHistoryModal: React.FC<IntegrationHistoryModalProps> = ({
  isOpen,
  onClose,
  ctrtId,
  custId
}) => {
  const [history, setHistory] = useState<HistoryRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 날짜 포맷 함수 (yyyyMMdd)
  const formatDate = (date: Date): string => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}${month}${day}`;
  };

  // 날짜에 일수 추가
  const addDays = (date: Date, days: number): Date => {
    const result = new Date(date);
    result.setDate(result.getDate() + days);
    return result;
  };

  // 전송일시 포맷 (yyyyMMddHHmmss -> yyyy-MM-dd HH:mm:ss)
  const formatDateTime = (dateTimeStr: string): string => {
    if (!dateTimeStr || dateTimeStr.length < 14) return dateTimeStr;
    const year = dateTimeStr.substring(0, 4);
    const month = dateTimeStr.substring(4, 6);
    const day = dateTimeStr.substring(6, 8);
    const hour = dateTimeStr.substring(8, 10);
    const minute = dateTimeStr.substring(10, 12);
    const second = dateTimeStr.substring(12, 14);
    return `${year}-${month}-${day} ${hour}:${minute}:${second}`;
  };

  // 연동이력 조회
  const fetchHistory = async () => {
    if (!ctrtId) {
      console.error('[연동이력] 계약ID가 없습니다');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const today = new Date();
      const startDate = formatDate(addDays(today, -7)); // 7일 전
      const endDate = formatDate(addDays(today, 1)); // 내일 (오늘까지 포함)

      console.log('[연동이력] 조회 시작:', {
        ctrtId,
        custId,
        startDate,
        endDate
      });

      const origin = typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000';

      // JSON API 호출 (.req 제거)
      const response = await fetch(`${API_BASE}/integration/history`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Origin': origin
        },
        credentials: 'include',
        body: JSON.stringify({
          CTRT_ID: ctrtId,
          CUST_ID: custId || '',
          STRT_DTTM1: startDate,
          STRT_DTTM2: endDate
        })
      });

      if (!response.ok) {
        throw new Error(`API 호출 실패: ${response.status}`);
      }

      const data = await response.json();
      console.log('[연동이력] API 응답:', data);

      // 레거시 API 응답 형식에 맞춰 파싱
      // output 또는 ds_svc_dtl 형식으로 올 수 있음
      const records = data.output || data.ds_svc_dtl || [];

      setHistory(Array.isArray(records) ? records : []);
      console.log('[연동이력] 조회 완료:', records.length, '건');

    } catch (err) {
      console.error('[연동이력] 조회 실패:', err);
      setError(err instanceof Error ? err.message : '조회 중 오류가 발생했습니다');
    } finally {
      setLoading(false);
    }
  };

  // 모달이 열릴 때 조회
  useEffect(() => {
    if (isOpen && ctrtId) {
      fetchHistory();
    }
  }, [isOpen, ctrtId]);

  // SubHeader 컨텐츠
  const subHeader = (
    <div className="text-xs text-gray-700 space-y-0.5">
      <div><span className="text-gray-600">계약ID:</span> <span className="font-medium text-blue-700">{ctrtId}</span></div>
      <div className="text-gray-600">조회기간: 최근 7일</div>
    </div>
  );

  // Footer 컨텐츠
  const footer = (
    <button
      onClick={onClose}
      className="btn btn-secondary btn-sm"
    >
      닫기
    </button>
  );

  return (
    <BaseModal
      isOpen={isOpen}
      onClose={onClose}
      title="연동이력"
      size="medium"
      subHeader={subHeader}
      footer={footer}
    >
      {/* 내용 */}
      <div>
          {loading && (
            <div className="flex items-center justify-center py-8">
              <div className="text-gray-500 text-xs">조회 중...</div>
            </div>
          )}

          {error && (
            <div className="flex items-center justify-center py-8 px-4">
              <div className="text-red-500 text-xs text-center">{error}</div>
            </div>
          )}

          {!loading && !error && history.length === 0 && (
            <div className="flex items-center justify-center py-8">
              <div className="text-gray-500 text-xs">연동이력이 없습니다</div>
            </div>
          )}

          {!loading && !error && history.length > 0 && (
            <div className="space-y-2.5 p-2.5">
              {history.map((record, index) => (
                <div
                  key={index}
                  className={`rounded-lg border shadow-sm p-2.5 ${
                    index % 2 === 0 ? 'bg-white border-gray-200' : 'bg-gray-50 border-gray-200'
                  }`}
                >
                  <div className="space-y-1.5">
                    {/* 상품명 */}
                    <div className="bg-white rounded px-2.5 py-1.5 border border-gray-100">
                      <div className="text-xs text-gray-900 font-medium">
                        <span className="text-gray-600 font-normal">상품명:</span> {record.prod_nm || '-'}
                      </div>
                    </div>

                    {/* 계약ID */}
                    <div className="bg-white rounded px-2.5 py-1.5 border border-gray-100">
                      <div className="text-xs text-gray-900 font-medium">
                        <span className="text-gray-600 font-normal">계약ID:</span> {record.ctrt_id || '-'}
                      </div>
                    </div>

                    {/* 메세지명 */}
                    <div className="bg-white rounded px-2.5 py-1.5 border border-gray-100">
                      <div className="text-xs text-gray-900 font-medium">
                        <span className="text-gray-600 font-normal">메세지명:</span> {record.msg_id_nm || '-'}
                      </div>
                    </div>

                    {/* 처리결과 */}
                    <div className="bg-white rounded px-2.5 py-1.5 border border-gray-100">
                      <div className="text-xs text-gray-900 font-medium">
                        <span className="text-gray-600 font-normal">처리결과:</span> {record.proc_rslt_cd_nm || '-'}
                      </div>
                    </div>

                    {/* 전송결과 */}
                    <div className="bg-white rounded px-2.5 py-1.5 border border-gray-100">
                      <div className="text-xs text-gray-900 font-medium">
                        <span className="text-gray-600 font-normal">전송결과:</span> {record.rslt_cd_nm || '-'}
                      </div>
                    </div>

                    {/* 전송일시 */}
                    <div className="bg-white rounded px-2.5 py-1.5 border border-gray-100">
                      <div className="text-xs text-gray-900 font-medium">
                        <span className="text-gray-600 font-normal">전송일시:</span> {record.strt_dttm ? formatDateTime(record.strt_dttm) : '-'}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
      </div>
    </BaseModal>
  );
};

export default IntegrationHistoryModal;
