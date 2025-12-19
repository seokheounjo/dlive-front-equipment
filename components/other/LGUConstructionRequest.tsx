import React, { useState, useEffect } from 'react';
import { HardHat, RefreshCw } from 'lucide-react';
import { getLGUConstructionList } from '../../services/apiService';

interface LGUConstructionRequestProps {
  onBack: () => void;
  userInfo?: {
    userId: string;
    userName: string;
    userRole: string;
  } | null;
  showToast?: (message: string, type: 'success' | 'error' | 'warning' | 'info') => void;
}

interface LGUConstructionItem {
  CONSREQNO: string;        // 공사요청번호
  CTRT_ID: string;          // 계약ID
  CONSCHRRNM: string;       // 담당자명
  CONSCHRRTLNO: string;     // 담당자연락처
  CONSCHRRMAKRMKS: string;  // 담당자비고
  CONSFNSHSCDLDT: string;   // 완료예정일
  CONSFNSHDT: string;       // 완료일자
  CONSNEEDDIVSNM: string;   // 공사필요구분
  CONSDLYRSNNM: string;     // 지연사유
  CONSIPSBPRSSDT: string;   // 불가처리일
  CONSIPSBRSNNM: string;    // 불가사유
  CONSNREQPRSSDT: string;   // 불요청처리일
  CONSNREQRSNNM: string;    // 불요청사유
  ENTR_NO: string;
  ENTR_RQST_NO: string;
  MSTR_FL: string;
  SBGNEGNRNM: string;
}

const LGUConstructionRequest: React.FC<LGUConstructionRequestProps> = ({ onBack, userInfo, showToast }) => {
  const [list, setList] = useState<LGUConstructionItem[]>([]);
  const [selectedItem, setSelectedItem] = useState<LGUConstructionItem | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchList();
  }, []);

  // 목록 조회
  const fetchList = async () => {
    try {
      setIsLoading(true);
      setError(null);

      const today = new Date();
      const oneMonthAgo = new Date();
      oneMonthAgo.setMonth(today.getMonth() - 1);

      const params = {
        ENTR_NO: '',
        CTRT_ID: '',
        WORK_DT_FROM: oneMonthAgo.toISOString().slice(0, 10).replace(/-/g, ''),
        WORK_DT_TO: today.toISOString().slice(0, 10).replace(/-/g, ''),
        WRKR_ID: userInfo?.userId || ''
      };

      const data = await getLGUConstructionList(params);
      setList(data);

      // 첫 번째 항목 자동 선택
      if (data.length > 0) {
        setSelectedItem(data[0]);
      }

      console.log('✅ LGU 공사요청 목록 조회 성공:', data.length);
    } catch (err) {
      console.error('❌ LGU 공사요청 목록 조회 실패:', err);
      setError('공사요청 목록을 불러오는데 실패했습니다.');
    } finally {
      setIsLoading(false);
    }
  };

  // 목록 행 선택
  const handleRowClick = (item: LGUConstructionItem) => {
    setSelectedItem(item);
  };

  // 요청 버튼
  const handleRequest = () => {
    if (showToast) showToast('공사요청 기능은 준비 중입니다.', 'info');
  };

  // 수정 버튼
  const handleModify = () => {
    if (!selectedItem || !selectedItem.CONSREQNO) {
      if (showToast) showToast('공사요청번호가 없는 항목은 수정할 수 없습니다.', 'warning');
      return;
    }
    if (showToast) showToast('수정 기능은 준비 중입니다.', 'info');
  };

  // 삭제 버튼
  const handleDelete = () => {
    if (!selectedItem || !selectedItem.CONSREQNO) {
      if (showToast) showToast('공사요청번호가 없는 항목은 삭제할 수 없습니다.', 'warning');
      return;
    }
    if (showToast) showToast('삭제 기능은 준비 중입니다.', 'info');
  };

  return (
    <div>
      {/* 헤더 */}
      <div className="mb-2 sm:mb-3 flex items-center justify-between gap-2">
        <div>
          <h2 className="text-base sm:text-lg font-bold text-gray-900">(LGU) 공사요청진행정보</h2>
        </div>
        <button
          onClick={fetchList}
          disabled={isLoading}
          className="flex items-center gap-1 px-2.5 sm:px-3 py-1 sm:py-1.5 bg-gray-100 hover:bg-gray-200 rounded text-xs sm:text-sm text-gray-700 disabled:opacity-50"
        >
          <RefreshCw className={`w-3.5 h-3.5 sm:w-4 sm:h-4 ${isLoading ? 'animate-spin' : ''}`} />
          새로고침
        </button>
      </div>

      {isLoading ? (
        <div className="text-center p-6 sm:p-10">
          <div className="inline-block animate-spin rounded-full h-6 w-6 sm:h-8 sm:w-8 border-4 border-orange-500 border-t-transparent"></div>
          <p className="mt-2 text-gray-600 text-sm sm:text-base">로딩 중...</p>
        </div>
      ) : error ? (
        <div className="text-center p-6 sm:p-10 bg-white rounded-lg shadow-sm border border-red-200">
          <p className="text-red-500 text-sm sm:text-base">{error}</p>
          <button
            onClick={fetchList}
            className="mt-3 sm:mt-4 px-3 sm:px-4 py-1.5 sm:py-2 bg-orange-500 text-white text-sm rounded-lg hover:bg-orange-600"
          >
            다시 시도
          </button>
        </div>
      ) : (
        <>
          {/* 상단: 공사요청 목록 Grid */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden mb-2 sm:mb-3">
            {list.length > 0 ? (
              <div className="max-h-40 sm:max-h-48 overflow-y-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 sticky top-0">
                    <tr>
                      <th className="px-2 sm:px-3 py-1.5 sm:py-2 text-left text-xs font-semibold text-gray-700 border-b">공사요청번호</th>
                      <th className="px-2 sm:px-3 py-1.5 sm:py-2 text-left text-xs font-semibold text-gray-700 border-b">계약ID</th>
                      <th className="px-2 sm:px-3 py-1.5 sm:py-2 text-left text-xs font-semibold text-gray-700 border-b">담당자명</th>
                      <th className="px-2 sm:px-3 py-1.5 sm:py-2 text-left text-xs font-semibold text-gray-700 border-b">완료예정일</th>
                    </tr>
                  </thead>
                  <tbody>
                    {list.map((item, idx) => (
                      <tr
                        key={idx}
                        onClick={() => handleRowClick(item)}
                        className={`cursor-pointer hover:bg-orange-50 transition-colors ${
                          selectedItem === item ? 'bg-orange-100' : ''
                        }`}
                      >
                        <td className="px-2 sm:px-3 py-1.5 sm:py-2 text-xs text-gray-900 border-b">{item.CONSREQNO || '-'}</td>
                        <td className="px-2 sm:px-3 py-1.5 sm:py-2 text-xs text-gray-900 border-b">{item.CTRT_ID || '-'}</td>
                        <td className="px-2 sm:px-3 py-1.5 sm:py-2 text-xs text-gray-900 border-b">{item.CONSCHRRNM || '-'}</td>
                        <td className="px-2 sm:px-3 py-1.5 sm:py-2 text-xs text-gray-900 border-b">{item.CONSFNSHSCDLDT || '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="p-4 sm:p-6 text-center text-gray-500 text-xs sm:text-sm">
                조회된 공사요청 내역이 없습니다
              </div>
            )}
          </div>

          {/* 하단: 선택된 항목 상세정보 */}
          {selectedItem && (
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-3 sm:p-4 space-y-2 sm:space-y-3">
              <div className="grid grid-cols-2 gap-2 sm:gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">공사요청번호</label>
                  <input
                    type="text"
                    value={selectedItem.CONSREQNO || ''}
                    readOnly
                    className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded bg-gray-50"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">담당자명</label>
                  <input
                    type="text"
                    value={selectedItem.CONSCHRRNM || ''}
                    readOnly
                    className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded bg-gray-50"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">담당자연락처</label>
                <input
                  type="text"
                  value={selectedItem.CONSCHRRTLNO || ''}
                  readOnly
                  className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded bg-gray-50"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">담당자비고</label>
                <textarea
                  value={selectedItem.CONSCHRRMAKRMKS || ''}
                  readOnly
                  rows={2}
                  className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded bg-gray-50 resize-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-2 sm:gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">완료예정일</label>
                  <input
                    type="text"
                    value={selectedItem.CONSFNSHSCDLDT || ''}
                    readOnly
                    className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded bg-gray-50"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">완료일자</label>
                  <input
                    type="text"
                    value={selectedItem.CONSFNSHDT || ''}
                    readOnly
                    className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded bg-gray-50"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">공사필요구분</label>
                <input
                  type="text"
                  value={selectedItem.CONSNEEDDIVSNM || ''}
                  readOnly
                  className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded bg-gray-50"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">지연사유</label>
                <input
                  type="text"
                  value={selectedItem.CONSDLYRSNNM || ''}
                  readOnly
                  className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded bg-gray-50"
                />
              </div>

              <div className="grid grid-cols-2 gap-2 sm:gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">불가처리일</label>
                  <input
                    type="text"
                    value={selectedItem.CONSIPSBPRSSDT || ''}
                    readOnly
                    className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded bg-gray-50"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">불가사유</label>
                  <input
                    type="text"
                    value={selectedItem.CONSIPSBRSNNM || ''}
                    readOnly
                    className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded bg-gray-50"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">불요청처리일</label>
                <input
                  type="text"
                  value={selectedItem.CONSNREQPRSSDT || ''}
                  readOnly
                  className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded bg-gray-50"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">불요청사유</label>
                <textarea
                  value={selectedItem.CONSNREQRSNNM || ''}
                  readOnly
                  rows={2}
                  className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded bg-gray-50 resize-none"
                />
              </div>
            </div>
          )}

          {/* 하단 버튼 */}
          <div className="mt-3 sm:mt-4 grid grid-cols-3 gap-1.5 sm:gap-2">
            <button
              onClick={handleRequest}
              className="px-3 sm:px-4 py-2 sm:py-2.5 bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white rounded-lg font-medium text-xs sm:text-sm shadow-md transition-all"
            >
              요청
            </button>
            <button
              onClick={handleModify}
              className="px-3 sm:px-4 py-2 sm:py-2.5 bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white rounded-lg font-medium text-xs sm:text-sm shadow-md transition-all"
            >
              수정
            </button>
            <button
              onClick={handleDelete}
              className="px-3 sm:px-4 py-2 sm:py-2.5 bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white rounded-lg font-medium text-xs sm:text-sm shadow-md transition-all"
            >
              삭제
            </button>
          </div>
        </>
      )}
    </div>
  );
};

export default LGUConstructionRequest;

