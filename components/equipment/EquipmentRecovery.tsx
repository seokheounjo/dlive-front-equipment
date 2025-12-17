import React, { useState } from 'react';
import { getUnreturnedEquipmentList } from '../../services/apiService';

interface EquipmentRecoveryProps {
  onBack: () => void;
}

interface UnreturnedEqtSearch {
  CUST_ID: string;
  CUST_NM: string;
  PHONE_NO: string;
  FROM_DT: string;
  TO_DT: string;
  EQT_CL_CD: string;
}

interface UnreturnedEqt {
  CUST_ID: string;
  CUST_NM: string;
  CTRT_ID: string;
  EQT_NO: string;
  EQT_SERNO: string;
  EQT_CL_CD: string;
  EQT_CL_NM: string;
  ITEM_NM: string;
  TRML_DT: string;
  WRK_ID: string;
  WRKR_NM: string;
  PHONE_NO: string;
  ADDRESS: string;
  RETN_REQ_YN: string;
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
  // YYYY.MM.DD -> YYYY-MM-DD
  if (dateStr.includes('.')) {
    return dateStr.replace(/\./g, '-');
  }
  return dateStr;
};

const EquipmentRecovery: React.FC<EquipmentRecoveryProps> = ({ onBack }) => {
  const [searchParams, setSearchParams] = useState<UnreturnedEqtSearch>({
    CUST_ID: '',
    CUST_NM: '',
    PHONE_NO: '',
    FROM_DT: (() => {
      const date = new Date();
      date.setMonth(date.getMonth() - 3);
      return date.toISOString().slice(0, 10).replace(/-/g, '');
    })(),
    TO_DT: new Date().toISOString().slice(0, 10).replace(/-/g, ''),
    EQT_CL_CD: ''
  });

  const [unreturnedList, setUnreturnedList] = useState<UnreturnedEqt[]>([]);

  const handleSearch = async () => {
    try {
      const result = await getUnreturnedEquipmentList({
        FROM_DT: searchParams.FROM_DT,
        TO_DT: searchParams.TO_DT,
        CUST_ID: searchParams.CUST_ID || undefined,
        CUST_NM: searchParams.CUST_NM || undefined,
        EQT_SERNO: undefined
      });
      console.log('✅ 미회수 장비 조회 성공:', result);
      setUnreturnedList(result);
    } catch (error) {
      console.error('❌ 미회수 장비 조회 실패:', error);
      alert('미회수 장비 조회에 실패했습니다.');
      setUnreturnedList([]);
    }
  };

  return (
    <div className="h-full overflow-y-auto bg-gray-50 px-4 py-4 space-y-3">
        {/* 검색 영역 */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
          <div className="space-y-3">
            {/* 해지일자 */}
            <div className="flex items-center gap-2">
              <label className="text-xs font-medium text-gray-600 w-14 flex-shrink-0">해지일자</label>
              <div className="flex-1 flex items-center gap-2 min-w-0">
                <div className="relative flex-1 min-w-0">
                  <input
                    type="date"
                    value={formatDateInput(searchParams.FROM_DT)}
                    onChange={(e) => setSearchParams({...searchParams, FROM_DT: formatDateApi(e.target.value)})}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                  />
                  <div className="flex items-center px-3 py-2 text-sm border border-gray-200 rounded-lg bg-white pointer-events-none">
                    <span className="flex-1">{formatDateDot(searchParams.FROM_DT)}</span>
                    <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                  </div>
                </div>
                <span className="text-gray-400 flex-shrink-0">~</span>
                <div className="relative flex-1 min-w-0">
                  <input
                    type="date"
                    value={formatDateInput(searchParams.TO_DT)}
                    onChange={(e) => setSearchParams({...searchParams, TO_DT: formatDateApi(e.target.value)})}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                  />
                  <div className="flex items-center px-3 py-2 text-sm border border-gray-200 rounded-lg bg-white pointer-events-none">
                    <span className="flex-1">{formatDateDot(searchParams.TO_DT)}</span>
                    <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                  </div>
                </div>
              </div>
            </div>
            {/* 고객ID */}
            <div className="flex items-center gap-2">
              <label className="text-xs font-medium text-gray-600 w-14 flex-shrink-0">고객ID</label>
              <input
                type="text"
                value={searchParams.CUST_ID}
                onChange={(e) => setSearchParams({...searchParams, CUST_ID: e.target.value})}
                className="flex-1 px-3 py-2 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                placeholder="고객ID 입력"
              />
            </div>
            {/* 고객명 */}
            <div className="flex items-center gap-2">
              <label className="text-xs font-medium text-gray-600 w-14 flex-shrink-0">고객명</label>
              <input
                type="text"
                value={searchParams.CUST_NM}
                onChange={(e) => setSearchParams({...searchParams, CUST_NM: e.target.value})}
                className="flex-1 px-3 py-2 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                placeholder="고객명 입력"
              />
            </div>
            <button
              onClick={handleSearch}
              className="w-full bg-blue-500 hover:bg-blue-600 text-white py-2.5 rounded-lg font-semibold text-sm shadow-sm transition-all active:scale-[0.98] touch-manipulation"
              style={{ WebkitTapHighlightColor: 'transparent' }}
            >
              조회
            </button>
          </div>
        </div>

        {/* 미회수 장비 목록 */}
        {unreturnedList.length > 0 ? (
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="px-4 py-3 bg-gradient-to-r from-gray-50 to-white border-b border-gray-100">
              <span className="text-sm font-semibold text-gray-800">조회 결과: {unreturnedList.length}건</span>
            </div>
            <div className="max-h-96 overflow-y-auto">
              <table className="w-full">
                <thead className="bg-gray-50 sticky top-0">
                  <tr>
                    <th className="px-3 py-2.5 text-left text-xs font-semibold text-gray-600 border-b border-gray-100">고객명</th>
                    <th className="px-3 py-2.5 text-left text-xs font-semibold text-gray-600 border-b border-gray-100">장비명</th>
                    <th className="px-3 py-2.5 text-left text-xs font-semibold text-gray-600 border-b border-gray-100">S/N</th>
                    <th className="px-3 py-2.5 text-center text-xs font-semibold text-gray-600 border-b border-gray-100">해지일</th>
                    <th className="px-3 py-2.5 text-center text-xs font-semibold text-gray-600 border-b border-gray-100">회수요청</th>
                  </tr>
                </thead>
                <tbody>
                  {unreturnedList.map((item, idx) => (
                    <tr key={idx} className="hover:bg-blue-50/50 transition-colors">
                      <td className="px-3 py-2.5 text-xs text-gray-900 border-b border-gray-50">{item.CUST_NM}</td>
                      <td className="px-3 py-2.5 text-xs text-gray-700 border-b border-gray-50">{item.EQT_CL_NM}</td>
                      <td className="px-3 py-2.5 text-xs text-gray-700 border-b border-gray-50 font-mono">{item.EQT_SERNO}</td>
                      <td className="px-3 py-2.5 text-xs text-center text-gray-700 border-b border-gray-50">{item.TRML_DT}</td>
                      <td className="px-3 py-2.5 text-xs text-center border-b border-gray-50">
                        <span className={`px-2 py-0.5 rounded text-xs ${item.RETN_REQ_YN === 'Y' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>
                          {item.RETN_REQ_YN === 'Y' ? '요청됨' : '미요청'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-8">
            <div className="text-center">
              <div className="w-16 h-16 mx-auto mb-4 bg-blue-100 rounded-full flex items-center justify-center">
                <svg className="w-8 h-8 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                </svg>
              </div>
              <p className="text-gray-500 text-sm">미회수 장비가 없습니다</p>
            </div>
          </div>
        )}
    </div>
  );
};

export default EquipmentRecovery;
