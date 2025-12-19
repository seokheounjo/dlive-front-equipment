import React, { useState, useEffect, useCallback } from 'react';
import { Calendar, AlertCircle } from 'lucide-react';
import BaseModal from '../common/BaseModal';
import { getMmtSusInfo, modMmtSusInfo } from '../../services/apiService';

interface SuspensionPeriodModalProps {
  isOpen: boolean;
  onClose: () => void;
  rcptId: string;
  ctrtId: string;
  userId: string;
  showToast?: (message: string, type: 'success' | 'error' | 'warning' | 'info') => void;
}

interface SuspensionInfo {
  SUS_HOPE_DD: string;      // 정지시작일 (YYYYMMDD)
  MMT_SUS_HOPE_DD: string;  // 정지종료일 (YYYYMMDD)
  VALID_SUS_DAYS: string;   // 유효 정지일수
  MMT_SUS_CD: string;       // 정지 사유 코드
  WRK_DTL_TCD: string;      // 작업 상세 유형 코드
}

const SuspensionPeriodModal: React.FC<SuspensionPeriodModalProps> = ({
  isOpen,
  onClose,
  rcptId,
  ctrtId,
  userId,
  showToast,
}) => {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [susInfo, setSusInfo] = useState<SuspensionInfo | null>(null);
  const [newEndDate, setNewEndDate] = useState<string>('');
  const [canEdit, setCanEdit] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // YYYYMMDD -> YYYY-MM-DD
  const formatDateForInput = (yyyymmdd: string): string => {
    if (!yyyymmdd || yyyymmdd.length !== 8) return '';
    return `${yyyymmdd.slice(0, 4)}-${yyyymmdd.slice(4, 6)}-${yyyymmdd.slice(6, 8)}`;
  };

  // YYYY-MM-DD -> YYYYMMDD
  const formatDateForApi = (isoDate: string): string => {
    return isoDate.replace(/-/g, '');
  };

  // 날짜 표시 포맷 (YYYYMMDD -> YYYY.MM.DD)
  const formatDateDisplay = (yyyymmdd: string): string => {
    if (!yyyymmdd || yyyymmdd.length !== 8) return '-';
    return `${yyyymmdd.slice(0, 4)}.${yyyymmdd.slice(4, 6)}.${yyyymmdd.slice(6, 8)}`;
  };

  // 두 날짜 사이 일수 계산
  const calculateDays = (startDate: string, endDate: string): number => {
    if (!startDate || !endDate) return 0;
    const start = new Date(formatDateForInput(startDate));
    const end = new Date(formatDateForInput(endDate));
    const diffTime = end.getTime() - start.getTime();
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  };

  // 오늘 날짜 (YYYYMMDD)
  const getTodayString = (): string => {
    const today = new Date();
    return today.toISOString().slice(0, 10).replace(/-/g, '');
  };

  // 정지기간 정보 조회
  const fetchSuspensionInfo = useCallback(async () => {
    if (!rcptId || !ctrtId) return;

    setLoading(true);
    setError(null);

    try {
      const info = await getMmtSusInfo({ RCPT_ID: rcptId, CTRT_ID: ctrtId });
      console.log('[SuspensionPeriodModal] 정지기간 조회 결과:', info);

      if (info) {
        setSusInfo(info);
        setNewEndDate(formatDateForInput(info.MMT_SUS_HOPE_DD));

        // 수정 가능 여부 판단 (레거시와 동일)
        // WRK_DTL_TCD == "0430" (일시철거)이고 정지종료일이 오늘 이하면 수정 필요
        const today = getTodayString();
        if (info.WRK_DTL_TCD === '0430' && info.MMT_SUS_HOPE_DD <= today) {
          setCanEdit(true);
          if (showToast) {
            showToast('이용정지기간 종료일이 경과되었습니다. 이용정지기간을 다시 설정하십시오.', 'warning');
          }
        } else {
          setCanEdit(false);
        }
      } else {
        setError('정지기간 정보를 찾을 수 없습니다.');
      }
    } catch (err: any) {
      console.error('[SuspensionPeriodModal] 정지기간 조회 실패:', err);
      setError(err.message || '정지기간 정보 조회에 실패했습니다.');
    } finally {
      setLoading(false);
    }
  }, [rcptId, ctrtId, showToast]);

  useEffect(() => {
    if (isOpen) {
      fetchSuspensionInfo();
    }
  }, [isOpen, fetchSuspensionInfo]);

  // 종료일 변경 핸들러
  const handleEndDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newDate = e.target.value;
    setNewEndDate(newDate);
    setError(null);

    if (!susInfo) return;

    const startDateStr = formatDateForInput(susInfo.SUS_HOPE_DD);

    // 종료일이 시작일보다 이전인지 검증
    if (newDate < startDateStr) {
      setError('종료일은 시작일 이후로 설정해주세요.');
      return;
    }

    // VALID_SUS_DAYS 검증 (레거시의 fn_sus_perid_check와 동일)
    if (susInfo.VALID_SUS_DAYS && parseInt(susInfo.VALID_SUS_DAYS) > 0) {
      const validDays = parseInt(susInfo.VALID_SUS_DAYS);
      const startDate = new Date(startDateStr);
      const maxEndDate = new Date(startDate);
      maxEndDate.setDate(maxEndDate.getDate() + validDays - 1);

      const selectedEndDate = new Date(newDate);
      if (selectedEndDate > maxEndDate) {
        const maxEndDateStr = maxEndDate.toISOString().slice(0, 10);
        setError(`해당 정지유형의 이용정지기간은 ${maxEndDateStr} 까지 가능합니다.`);
      }
    }
  };

  // 저장 핸들러
  const handleSave = async () => {
    if (!susInfo || !newEndDate) return;

    // 유효성 검증
    const startDateStr = formatDateForInput(susInfo.SUS_HOPE_DD);
    if (newEndDate < startDateStr) {
      if (showToast) showToast('종료일은 시작일 이후로 설정해주세요.', 'error');
      return;
    }

    // 일수 계산
    const susStartDate = formatDateForApi(susInfo.SUS_HOPE_DD);
    const susEndDate = formatDateForApi(newEndDate);
    const susDays = calculateDays(susStartDate, susEndDate);

    setSaving(true);

    try {
      const result = await modMmtSusInfo({
        CTRT_ID: ctrtId,
        RCPT_ID: rcptId,
        SUS_HOPE_DD: susStartDate,
        MMT_SUS_HOPE_DD: susEndDate,
        SUS_DD_NUM: String(susDays),
        REG_UID: userId,
      });

      console.log('[SuspensionPeriodModal] 정지기간 수정 결과:', result);

      if (result.code === 'SUCCESS') {
        if (showToast) showToast(result.message, 'success');
        onClose();
      } else {
        if (showToast) showToast(result.message, 'error');
      }
    } catch (err: any) {
      console.error('[SuspensionPeriodModal] 정지기간 수정 실패:', err);
      if (showToast) showToast(err.message || '정지기간 수정에 실패했습니다.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const footer = (
    <div className="flex gap-2">
      {canEdit && (
        <button
          onClick={handleSave}
          disabled={saving || !!error}
          className="flex-1 px-4 py-2.5 bg-blue-500 hover:bg-blue-600 text-white rounded-lg font-medium text-sm shadow-md transition-all disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {saving ? '저장 중...' : '저장'}
        </button>
      )}
      <button
        onClick={onClose}
        className="flex-1 px-4 py-2.5 bg-gray-500 hover:bg-gray-600 text-white rounded-lg font-medium text-sm shadow-md transition-all"
      >
        닫기
      </button>
    </div>
  );

  return (
    <BaseModal
      isOpen={isOpen}
      onClose={onClose}
      title="이용정지설정기간"
      size="small"
      footer={footer}
    >
      {loading ? (
        <div className="flex items-center justify-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
          <span className="ml-2 text-gray-600">정보 조회 중...</span>
        </div>
      ) : susInfo ? (
        <div className="space-y-4">
          {/* 현재 정지기간 (읽기 전용) */}
          <div className="bg-gray-50 rounded-lg p-3">
            <div className="text-sm font-medium text-gray-700 mb-2 flex items-center gap-1">
              <Calendar size={16} />
              정지기간
            </div>
            <div className="flex items-center gap-2 text-sm">
              <input
                type="date"
                value={formatDateForInput(susInfo.SUS_HOPE_DD)}
                disabled
                className="flex-1 px-2 py-1.5 border border-gray-300 rounded bg-gray-100 text-gray-600"
              />
              <span className="text-gray-500">~</span>
              <input
                type="date"
                value={formatDateForInput(susInfo.MMT_SUS_HOPE_DD)}
                disabled
                className="flex-1 px-2 py-1.5 border border-gray-300 rounded bg-gray-100 text-gray-600"
              />
            </div>
          </div>

          {/* 수정 가능한 경우 - 새 정지기간 설정 */}
          {canEdit && (
            <div className="bg-blue-50 rounded-lg p-3 border border-blue-200">
              <div className="text-sm font-medium text-blue-700 mb-2 flex items-center gap-1">
                <Calendar size={16} />
                정지기간 (수정)
              </div>
              <div className="flex items-center gap-2 text-sm">
                <input
                  type="date"
                  value={formatDateForInput(susInfo.SUS_HOPE_DD)}
                  disabled
                  className="flex-1 px-2 py-1.5 border border-gray-300 rounded bg-gray-100 text-gray-600"
                />
                <span className="text-gray-500">~</span>
                <input
                  type="date"
                  value={newEndDate}
                  onChange={handleEndDateChange}
                  min={formatDateForInput(susInfo.SUS_HOPE_DD)}
                  className="flex-1 px-2 py-1.5 border border-blue-300 rounded bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              {newEndDate && (
                <div className="mt-2 text-xs text-blue-600">
                  정지일수: {calculateDays(susInfo.SUS_HOPE_DD, formatDateForApi(newEndDate))}일
                </div>
              )}
            </div>
          )}

          {/* 에러 메시지 */}
          {error && (
            <div className="flex items-center gap-2 p-2 bg-red-50 border border-red-200 rounded-lg">
              <AlertCircle size={16} className="text-red-500 flex-shrink-0" />
              <span className="text-xs text-red-600">{error}</span>
            </div>
          )}

          {/* 수정 불가 안내 */}
          {!canEdit && (
            <div className="text-xs text-gray-500 text-center py-2">
              현재 정지기간을 확인합니다.
            </div>
          )}
        </div>
      ) : (
        <div className="text-center py-8 text-gray-500">
          {error || '정보를 불러오지 못했습니다.'}
        </div>
      )}
    </BaseModal>
  );
};

export default SuspensionPeriodModal;
