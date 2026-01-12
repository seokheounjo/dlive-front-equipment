import React, { useEffect, useState } from 'react';
import { getMoveWorkInfo, MoveWorkInfo } from '../../../../services/apiService';

interface MoveWorkInfoModalProps {
  isOpen: boolean;
  onClose: () => void;
  wrkCd: string;    // '07': 이전설치, '08': 이전철거
  wrkId: string;
  rcptId?: string;
}

/**
 * 철거이전정보 모달
 * WRK_CD=07: 이전설치 작업일 때 -> 철거이전정보 표시
 * WRK_CD=08: 이전철거 작업일 때 -> 이전설치정보 표시
 */
export const MoveWorkInfoModal: React.FC<MoveWorkInfoModalProps> = ({
  isOpen,
  onClose,
  wrkCd,
  wrkId,
  rcptId,
}) => {
  const [loading, setLoading] = useState(false);
  const [moveWorkInfo, setMoveWorkInfo] = useState<MoveWorkInfo | null>(null);
  const [error, setError] = useState<string | null>(null);

  // 타이틀 결정 (레거시 mowoa01p02.xml 참고)
  const title = wrkCd === '07' ? '이전설치작업정보' : '이전철거작업정보';

  useEffect(() => {
    if (isOpen && wrkId) {
      loadMoveWorkInfo();
    }
  }, [isOpen, wrkId, wrkCd]);

  const loadMoveWorkInfo = async () => {
    setLoading(true);
    setError(null);

    try {
      const result = await getMoveWorkInfo({
        WRK_CD: wrkCd,
        WRK_ID: wrkId,
        RCPT_ID: rcptId,
      });

      if (result) {
        setMoveWorkInfo(result);
      } else {
        setError('이사작업정보를 찾을 수 없습니다.');
      }
    } catch (err: any) {
      console.error('이사작업정보 조회 실패:', err);
      setError(err.message || '이사작업정보 조회에 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-2 sm:p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md max-h-[95vh] sm:max-h-[90vh] overflow-hidden flex flex-col">
        {/* 헤더 */}
        <div className="bg-indigo-600 text-white px-3 sm:px-4 py-2.5 sm:py-3 flex items-center justify-between flex-shrink-0">
          <h2 className="text-base sm:text-lg font-bold">{title}</h2>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-white/20 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* 내용 */}
        <div className="p-3 sm:p-4 overflow-y-auto flex-1">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
              <span className="ml-3 text-gray-600">조회 중...</span>
            </div>
          ) : error ? (
            <div className="text-center py-8">
              <div className="text-red-500 mb-2">{error}</div>
              <button
                onClick={loadMoveWorkInfo}
                className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm hover:bg-indigo-700"
              >
                다시 시도
              </button>
            </div>
          ) : moveWorkInfo ? (
            <div className="space-y-4">
              {/* 이사유형 */}
              <div className="bg-gray-50 rounded-lg p-3">
                <label className="block text-xs text-gray-500 mb-1">이사유형</label>
                <div className="text-gray-900 font-medium">
                  {moveWorkInfo.MVM_TP_NM || '-'}
                </div>
              </div>

              {/* 상품명 */}
              <div className="bg-gray-50 rounded-lg p-3">
                <label className="block text-xs text-gray-500 mb-1">상품명</label>
                <div className="text-gray-900 font-medium">
                  {moveWorkInfo.PROD_NM || '-'}
                </div>
              </div>

              {/* 작업희망일 */}
              <div className="bg-gray-50 rounded-lg p-3">
                <label className="block text-xs text-gray-500 mb-1">작업희망일</label>
                <div className="text-gray-900 font-medium">
                  {moveWorkInfo.HOPE_DTTM || '-'}
                </div>
              </div>

              {/* 작업상태 */}
              <div className="bg-gray-50 rounded-lg p-3">
                <label className="block text-xs text-gray-500 mb-1">작업상태</label>
                <div className="text-gray-900 font-medium">
                  {moveWorkInfo.WRK_STAT_NM || '-'}
                </div>
              </div>

              {/* 작업주소 */}
              <div className="bg-gray-50 rounded-lg p-3">
                <label className="block text-xs text-gray-500 mb-1">작업주소</label>
                <div className="text-gray-900 font-medium whitespace-pre-wrap">
                  {moveWorkInfo.ADDR_ORD || '-'}
                </div>
              </div>
            </div>
          ) : (
            <div className="text-center py-8 text-gray-500">
              이사작업정보가 없습니다.
            </div>
          )}
        </div>

        {/* 푸터 */}
        <div className="border-t border-gray-200 px-4 py-3">
          <button
            onClick={onClose}
            className="w-full px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-semibold transition-colors"
          >
            확인
          </button>
        </div>
      </div>
    </div>
  );
};

export default MoveWorkInfoModal;
