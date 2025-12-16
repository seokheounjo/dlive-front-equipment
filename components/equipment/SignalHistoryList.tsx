import React, { useState, useEffect } from 'react';
import { ENSHistory, getENSHistory } from '../../services/apiService';

interface SignalHistoryListProps {
  onBack: () => void;
}

// 날짜 포맷 함수 (YYYY.MM.DD)
const formatDateDot = (dateStr: string): string => {
  if (!dateStr) return '';
  // YYYYMMDD -> YYYY.MM.DD
  if (dateStr.length === 8 && !dateStr.includes('-') && !dateStr.includes('.')) {
    return `${dateStr.slice(0, 4)}.${dateStr.slice(4, 6)}.${dateStr.slice(6, 8)}`;
  }
  // YYYY-MM-DD -> YYYY.MM.DD
  if (dateStr.includes('-')) {
    return dateStr.replace(/-/g, '.');
  }
  return dateStr;
};

// 날짜를 YYYYMMDD로 변환 (API용)
const formatDateApi = (dateStr: string): string => {
  if (!dateStr) return '';
  return dateStr.replace(/[-\.]/g, '');
};

// 날짜를 YYYY-MM-DD로 변환 (input용)
const formatDateInput = (dateStr: string): string => {
  if (!dateStr) return '';
  // YYYYMMDD -> YYYY-MM-DD
  if (dateStr.length === 8 && !dateStr.includes('-') && !dateStr.includes('.')) {
    return `${dateStr.slice(0, 4)}-${dateStr.slice(4, 6)}-${dateStr.slice(6, 8)}`;
  }
  return dateStr;
};

const SignalHistoryList: React.FC<SignalHistoryListProps> = ({ onBack }) => {
  const [histories, setHistories] = useState<ENSHistory[]>([]);
  const [selectedHistory, setSelectedHistory] = useState<ENSHistory | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // 필터 상태
  const [custId, setCustId] = useState<string>('');
  const [regDate1, setRegDate1] = useState<string>(() => {
    const date = new Date();
    date.setMonth(date.getMonth() - 1);
    return date.toISOString().slice(0, 10).replace(/-/g, '');
  });
  const [regDate2, setRegDate2] = useState<string>(new Date().toISOString().slice(0, 10).replace(/-/g, ''));
  const [filterStatus, setFilterStatus] = useState<string>('전체');

  useEffect(() => {
    fetchHistory();
  }, []);

  const fetchHistory = async () => {
    try {
      setIsLoading(true);
      setError(null);

      const params: any = {};
      if (custId) params.CUST_ID = custId;
      if (regDate1) params.REG_DATE1 = formatDateApi(regDate1);
      if (regDate2) params.REG_DATE2 = formatDateApi(regDate2);

      const data = await getENSHistory(params);
      setHistories(data);
      if (data.length > 0) {
        setSelectedHistory(data[0]);
      }
      console.log('✅ ENS 이력 조회 성공:', data.length);
    } catch (err) {
      console.error('❌ ENS 이력 조회 실패:', err);
      setError('ENS 전송 이력을 불러오는데 실패했습니다.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div>
      {/* 헤더 */}
      <div className="mb-3">
        <h2 className="text-lg font-bold text-gray-900">발송이력</h2>
      </div>

      {/* 필터 영역 */}
      <div className="mb-3 bg-white rounded-lg shadow-sm border border-gray-200 p-3">
        <div className="space-y-2">
          {/* 조회기간 - 한 줄 레이아웃 */}
          <div className="flex items-center gap-1.5">
            <label className="text-xs font-medium text-gray-600 w-14 flex-shrink-0">조회기간</label>
            <div className="flex-1 flex items-center gap-1 min-w-0">
              <div className="relative flex-1 min-w-0">
                <input
                  type="date"
                  value={formatDateInput(regDate1)}
                  onChange={(e) => setRegDate1(formatDateApi(e.target.value))}
                  className="absolute inset-0 opacity-0 cursor-pointer z-10"
                />
                <div className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded bg-white truncate">
                  {formatDateDot(regDate1) || '시작일'}
                </div>
              </div>
              <span className="text-gray-400 flex-shrink-0">~</span>
              <div className="relative flex-1 min-w-0">
                <input
                  type="date"
                  value={formatDateInput(regDate2)}
                  onChange={(e) => setRegDate2(formatDateApi(e.target.value))}
                  className="absolute inset-0 opacity-0 cursor-pointer z-10"
                />
                <div className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded bg-white truncate">
                  {formatDateDot(regDate2) || '종료일'}
                </div>
              </div>
            </div>
          </div>
          <button
            onClick={fetchHistory}
            disabled={isLoading}
            className="w-full bg-orange-500 hover:bg-orange-600 text-white py-2 rounded font-medium text-sm shadow-md transition-all disabled:opacity-50"
          >
            조회
          </button>
        </div>
      </div>

      {/* 로딩/에러 상태 */}
      {isLoading ? (
        <div className="text-center p-10">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-orange-500 border-t-transparent"></div>
          <p className="mt-2 text-gray-600">로딩 중...</p>
        </div>
      ) : error ? (
        <div className="text-center p-10 bg-white rounded-lg shadow-sm border border-red-200">
          <p className="text-red-500">{error}</p>
          <button
            onClick={fetchHistory}
            className="mt-4 px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600"
          >
            다시 시도
          </button>
        </div>
      ) : (
        <>
          {/* ENS 이력 목록 - 그리드 테이블 */}
          {histories.length > 0 ? (
            <>
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden mb-3">
                <div className="max-h-80 overflow-y-auto">
                  <table className="w-full">
                    <thead className="bg-gray-50 sticky top-0">
                      <tr>
                        <th className="px-2 py-2 text-left text-xs font-semibold text-gray-700 border-b">SMS유형</th>
                        <th className="px-2 py-2 text-left text-xs font-semibold text-gray-700 border-b">수신번호</th>
                        <th className="px-2 py-2 text-left text-xs font-semibold text-gray-700 border-b">발신번호</th>
                        <th className="px-2 py-2 text-center text-xs font-semibold text-gray-700 border-b">발송결과</th>
                        <th className="px-2 py-2 text-center text-xs font-semibold text-gray-700 border-b">전송시간</th>
                      </tr>
                    </thead>
                    <tbody>
                      {histories.map((history, idx) => (
                        <tr
                          key={`${history.EML_SMS_SND_ID}-${idx}`}
                          onClick={() => setSelectedHistory(history)}
                          className={`cursor-pointer hover:bg-orange-50 transition-colors ${
                            selectedHistory === history ? 'bg-orange-100' : ''
                          }`}
                        >
                          <td className="px-2 py-2 text-xs text-gray-900 border-b">{history.EML_SMS_SND_TP_NM || history.MSG_TYP || '-'}</td>
                          <td className="px-2 py-2 text-xs text-gray-900 border-b">{history.CELL_PHN || '-'}</td>
                          <td className="px-2 py-2 text-xs text-gray-900 border-b">{history.SMS_RCV_NO || '-'}</td>
                          <td className="px-2 py-2 text-xs text-center border-b">
                            <span className={`${history.RESULT === '성공' || history.RESULT === '전송' ? 'text-green-600' : 'text-red-600'}`}>
                              {history.RESULT || '-'}
                            </span>
                          </td>
                          <td className="px-2 py-2 text-xs text-gray-900 text-center border-b">{history.SEND_TIME || '-'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* 하단: 선택된 메시지 내용 */}
              {selectedHistory && (
                <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-3">
                  <label className="block text-xs font-medium text-gray-600 mb-1">전송메시지</label>
                  <textarea
                    value={selectedHistory.MESSAGE || ''}
                    readOnly
                    rows={5}
                    className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded bg-gray-50 resize-none"
                  />
                </div>
              )}
            </>
          ) : (
            <div className="text-center py-10 bg-white rounded-lg shadow-sm border border-gray-200">
              <p className="text-gray-500 text-sm">조회된 발송 이력이 없습니다</p>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default SignalHistoryList;

