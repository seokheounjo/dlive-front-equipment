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

const EquipmentRecovery: React.FC<EquipmentRecoveryProps> = ({ onBack }) => {
  const [searchParams, setSearchParams] = useState<UnreturnedEqtSearch>({
    CUST_ID: '',
    CUST_NM: '',
    PHONE_NO: '',
    FROM_DT: (() => {
      const date = new Date();
      date.setMonth(date.getMonth() - 3);
      return date.toISOString().slice(0, 10);
    })(),
    TO_DT: new Date().toISOString().slice(0, 10),
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
    <div className="p-2">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-lg font-bold text-gray-900">미회수장비</h2>
        <button onClick={onBack} className="text-sm text-gray-600 hover:text-gray-800">← 뒤로</button>
      </div>

      {/* 검색 영역 - 키-값 한줄 레이아웃 */}
      <div className="mb-3 bg-white rounded-lg shadow-sm border border-gray-200 p-3">
        <div className="space-y-2">
          {/* 해지일자 (한 줄) */}
          <div className="flex items-center gap-2">
            <label className="text-xs font-medium text-gray-600 w-16 flex-shrink-0">해지일자</label>
            <input
              type="date"
              value={searchParams.FROM_DT}
              onChange={(e) => setSearchParams({...searchParams, FROM_DT: e.target.value})}
              className="flex-1 px-2 py-1.5 text-sm border border-gray-300 rounded"
              style={{ colorScheme: 'light' }}
            />
            <span className="text-gray-400">~</span>
            <input
              type="date"
              value={searchParams.TO_DT}
              onChange={(e) => setSearchParams({...searchParams, TO_DT: e.target.value})}
              className="flex-1 px-2 py-1.5 text-sm border border-gray-300 rounded"
              style={{ colorScheme: 'light' }}
            />
          </div>
          {/* 고객ID (한 줄) */}
          <div className="flex items-center gap-2">
            <label className="text-xs font-medium text-gray-600 w-16 flex-shrink-0">고객ID</label>
            <input
              type="text"
              value={searchParams.CUST_ID}
              onChange={(e) => setSearchParams({...searchParams, CUST_ID: e.target.value})}
              className="flex-1 px-2 py-1.5 text-sm border border-gray-300 rounded"
              placeholder="고객ID 입력"
            />
          </div>
          {/* 고객명 (한 줄) */}
          <div className="flex items-center gap-2">
            <label className="text-xs font-medium text-gray-600 w-16 flex-shrink-0">고객명</label>
            <input
              type="text"
              value={searchParams.CUST_NM}
              onChange={(e) => setSearchParams({...searchParams, CUST_NM: e.target.value})}
              className="flex-1 px-2 py-1.5 text-sm border border-gray-300 rounded"
              placeholder="고객명 입력"
            />
          </div>
          <button
            onClick={handleSearch}
            className="w-full bg-orange-500 hover:bg-orange-600 text-white py-2 rounded font-medium text-sm shadow-md transition-all"
          >
            조회
          </button>
        </div>
      </div>

      {/* 미회수 장비 목록 */}
      {unreturnedList.length > 0 ? (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
          <div className="max-h-96 overflow-y-auto">
            <table className="w-full">
              <thead className="bg-gray-50 sticky top-0">
                <tr>
                  <th className="px-2 py-2 text-left text-xs font-semibold text-gray-700 border-b">고객명</th>
                  <th className="px-2 py-2 text-left text-xs font-semibold text-gray-700 border-b">장비명</th>
                  <th className="px-2 py-2 text-left text-xs font-semibold text-gray-700 border-b">S/N</th>
                  <th className="px-2 py-2 text-center text-xs font-semibold text-gray-700 border-b">해지일</th>
                  <th className="px-2 py-2 text-center text-xs font-semibold text-gray-700 border-b">회수요청</th>
                </tr>
              </thead>
              <tbody>
                {unreturnedList.map((item, idx) => (
                  <tr key={idx} className="hover:bg-gray-50">
                    <td className="px-2 py-2 text-xs text-gray-900 border-b">{item.CUST_NM}</td>
                    <td className="px-2 py-2 text-xs text-gray-900 border-b">{item.EQT_CL_NM}</td>
                    <td className="px-2 py-2 text-xs text-gray-900 border-b">{item.EQT_SERNO}</td>
                    <td className="px-2 py-2 text-xs text-center text-gray-900 border-b">{item.TRML_DT}</td>
                    <td className="px-2 py-2 text-xs text-center text-gray-900 border-b">{item.RETN_REQ_YN}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <p className="text-center text-gray-500 text-sm">미회수 장비가 없습니다</p>
        </div>
      )}
    </div>
  );
};

export default EquipmentRecovery;
