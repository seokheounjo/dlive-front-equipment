import React, { useState, useEffect } from 'react';
import { WorkResultSignal, getWorkResultSignals } from '../../../services/apiService';

interface WorkResultSignalListProps {
  onBack: () => void;
}

const WorkResultSignalList: React.FC<WorkResultSignalListProps> = ({ onBack }) => {
  const [signals, setSignals] = useState<WorkResultSignal[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // 필터 상태
  const [hopeDt, setHopeDt] = useState<string>(new Date().toISOString().slice(0, 10));

  useEffect(() => {
    fetchSignals();
  }, []);

  const fetchSignals = async () => {
    try {
      setIsLoading(true);
      setError(null);

      const params: any = {};
      if (hopeDt) params.HOPE_DT = hopeDt.replace(/-/g, '');

      const data = await getWorkResultSignals(params);
      setSignals(data);
      console.log('✅ 작업결과신호 조회 성공:', data.length);
    } catch (err) {
      console.error('❌ 작업결과신호 조회 실패:', err);
      setError('작업결과신호현황을 불러오는데 실패했습니다.');
    } finally {
      setIsLoading(false);
    }
  };


  return (
    <div>
      {/* 헤더 */}
      <div className="mb-3">
        <h2 className="text-lg font-bold text-gray-900">작업결과신호현황</h2>
      </div>

      {/* 필터 영역 */}
      <div className="mb-3 bg-white rounded-lg shadow-sm border border-gray-200 p-3">
        <div className="space-y-2">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">접수일</label>
            <input
              type="date"
              value={hopeDt}
              onChange={(e) => setHopeDt(e.target.value)}
              className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded"
              style={{ colorScheme: 'light' }}
            />
          </div>
          <button
            onClick={fetchSignals}
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
            onClick={fetchSignals}
            className="mt-4 px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600"
          >
            다시 시도
          </button>
        </div>
      ) : (
        <>
          {/* 작업결과신호 목록 - 그리드 테이블 */}
          {signals.length > 0 ? (
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
              <div className="max-h-96 overflow-y-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 sticky top-0">
                    <tr>
                      <th className="px-2 py-2 text-left text-xs font-semibold text-gray-700 border-b">작업자</th>
                      <th className="px-2 py-2 text-center text-xs font-semibold text-gray-700 border-b">작업구분</th>
                      <th className="px-2 py-2 text-center text-xs font-semibold text-gray-700 border-b">진행중</th>
                      <th className="px-2 py-2 text-center text-xs font-semibold text-gray-700 border-b">완료</th>
                      <th className="px-2 py-2 text-center text-xs font-semibold text-gray-700 border-b">계</th>
                    </tr>
                  </thead>
                  <tbody>
                    {signals.map((signal, idx) => (
                      <tr key={`${signal.WRK_ID}-${idx}`} className="hover:bg-orange-50 transition-colors">
                        <td className="px-2 py-2 text-xs text-gray-900 border-b">{signal.WRKR_NM || '-'}</td>
                        <td className="px-2 py-2 text-xs text-center text-gray-900 border-b">{signal.WRK_CD_NM || '-'}</td>
                        <td className="px-2 py-2 text-xs text-center text-gray-900 border-b">{signal.ING_CNT || 0}</td>
                        <td className="px-2 py-2 text-xs text-center text-gray-900 border-b">{signal.CMPL_CNT || 0}</td>
                        <td className="px-2 py-2 text-xs text-center text-gray-900 border-b">{signal.SUM_CNT || 0}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <div className="text-center py-10 bg-white rounded-lg shadow-sm border border-gray-200">
              <p className="text-gray-500 text-sm">조회된 작업결과신호 내역이 없습니다</p>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default WorkResultSignalList;

