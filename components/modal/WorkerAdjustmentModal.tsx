import React, { useState, useEffect, useRef } from 'react';
import { Search, User, X, AlertCircle, CheckCircle, Calendar } from 'lucide-react';
import BaseModal from '../common/BaseModal';
import LoadingSpinner from '../common/LoadingSpinner';
import Select from '../ui/Select';
import { WorkOrder } from '../../types';
import { findUserList, adjustWorker, WorkerAdjustmentParams, getCommonCodes, getWorkReceipts } from '../../services/apiService';

interface UserInfo {
  userId: string;
  userName: string;
  soId?: string;
  crrId?: string;
}

interface WorkerAdjustmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  direction: WorkOrder;
  onSuccess?: () => void;
  showToast?: (message: string, type: 'success' | 'error' | 'warning' | 'info') => void;
  userInfo?: UserInfo | null;
}

interface Worker {
  USR_ID: string;
  USR_NM: string;
  CRR_ID?: string;
  CRR_NM?: string;
  CORP_NM?: string;  // 실제 API 응답 필드
  SO_ID?: string;
  POST_ID?: string;
  POST_NM?: string;
  POSITION_NM?: string;  // 직급명 (API 응답: "사원")
  TEL_NO?: string;
  TEL_NO2?: string;
  TEL_NO3?: string;
  HP_NO?: string;
  MOBILE_NO?: string;
  PDATEL_NO?: string;
  EMP_NO?: string;  // 사번 (API 응답: "70013876")
}

interface ChangeReasonCode {
  code: string;
  name: string;
}

// 시간 옵션 생성 (09-21시)
const HOUR_OPTIONS = Array.from({ length: 13 }, (_, i) => {
  const hour = (i + 9).toString().padStart(2, '0');
  return { value: hour, label: `${hour}시` };
});

// 분 옵션 생성 (00, 10, 20, 30, 40, 50)
const MINUTE_OPTIONS = Array.from({ length: 6 }, (_, i) => {
  const minute = (i * 10).toString().padStart(2, '0');
  return { value: minute, label: `${minute}분` };
});

// ID/전화번호 포맷팅 (3-3-4 형식)
const formatId = (id: string | undefined): string => {
  if (!id) return '-';
  // 숫자만 추출
  const digits = id.replace(/\D/g, '');
  if (digits.length >= 10) {
    return `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6, 10)}`;
  } else if (digits.length >= 6) {
    return `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}`;
  }
  return id;
};

const WorkerAdjustmentModal: React.FC<WorkerAdjustmentModalProps> = ({
  isOpen,
  onClose,
  direction,
  onSuccess,
  showToast,
  userInfo
}) => {

  // Form state
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedWorker, setSelectedWorker] = useState<Worker | null>(null);
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [divDate, setDivDate] = useState('');
  const [hopeHour, setHopeHour] = useState('');
  const [hopeMinute, setHopeMinute] = useState('');
  const [changeReason, setChangeReason] = useState('');
  const [changeReasonOptions, setChangeReasonOptions] = useState<ChangeReasonCode[]>([]);

  // 초기 날짜/시간 값 저장 (변경 감지용)
  const [initialDate, setInitialDate] = useState('');
  const [initialHour, setInitialHour] = useState('');
  const [initialMinute, setInitialMinute] = useState('');

  // 현재 작업업체/작업자 정보 (API에서 조회)
  const [currentCrrNm, setCurrentCrrNm] = useState('');
  const [currentWrkrNm, setCurrentWrkrNm] = useState('');

  // 초기 로딩 상태
  const [isInitialLoading, setIsInitialLoading] = useState(true);

  const searchRef = useRef<HTMLDivElement>(null);
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const datePickerRef = useRef<HTMLInputElement>(null);

  // Initialize form when modal opens
  useEffect(() => {
    if (isOpen) {
      // 기존 작업예정일시 파싱
      // 1순위: WRK_HOPE_DTTM (YYYYMMDDHHMM)
      // 2순위: scheduledAt (ISO 형식: 2026-02-04T08:00:00)
      const hopeDttm = (direction as any).WRK_HOPE_DTTM || '';
      const scheduledAt = direction.scheduledAt || '';

      let dateVal = new Date().toISOString().split('T')[0];
      let hourVal = '';
      let minuteVal = '';

      if (hopeDttm && hopeDttm.length >= 8) {
        // WRK_HOPE_DTTM: YYYYMMDD -> YYYY-MM-DD
        dateVal = `${hopeDttm.substring(0, 4)}-${hopeDttm.substring(4, 6)}-${hopeDttm.substring(6, 8)}`;
        if (hopeDttm.length >= 12) {
          hourVal = hopeDttm.substring(8, 10);
          minuteVal = hopeDttm.substring(10, 12);
        }
      } else if (scheduledAt) {
        // scheduledAt: ISO 형식 파싱
        const date = new Date(scheduledAt);
        if (!isNaN(date.getTime())) {
          dateVal = date.toISOString().split('T')[0];
          hourVal = String(date.getHours()).padStart(2, '0');
          minuteVal = String(date.getMinutes()).padStart(2, '0');
        }
      }

      setDivDate(dateVal);
      setHopeHour(hourVal);
      setHopeMinute(minuteVal);
      setInitialDate(dateVal);
      setInitialHour(hourVal);
      setInitialMinute(minuteVal);
      setSearchQuery('');
      setSelectedWorker(null);
      setWorkers([]);
      setChangeReason('');
      setCurrentCrrNm('');
      setCurrentWrkrNm('');
      setIsInitialLoading(true);

      // 모든 초기 데이터 로드
      initializeData();
    }
  }, [isOpen, direction]);

  // 초기 데이터 로드 (병렬 처리)
  const initializeData = async () => {
    try {
      await Promise.all([
        fetchChangeReasonCodes(),
        fetchCurrentWorkerInfo()
      ]);
    } finally {
      setIsInitialLoading(false);
    }
  };

  // 현재 작업업체/작업자 정보 조회 (레거시: getWorkReceiptListPda)
  const fetchCurrentWorkerInfo = async () => {
    try {
      const directionId = direction.WRK_DRCTN_ID || direction.id;
      if (!directionId) return;

      // direction 객체에서 먼저 확인
      const crrNm = (direction as any).CRR_NM || '';
      const wrkrNm = (direction as any).WRKR_NM || '';

      if (crrNm || wrkrNm) {
        setCurrentCrrNm(crrNm);
        setCurrentWrkrNm(wrkrNm);
        return;
      }

      // 없으면 API 호출해서 가져오기
      const receipts = await getWorkReceipts(directionId);
      if (receipts && receipts.length > 0) {
        const firstReceipt = receipts[0];
        setCurrentCrrNm(firstReceipt.CRR_NM || '');
        setCurrentWrkrNm(firstReceipt.WRKR_NM || '');
        console.log('[작업자보정] 현재 작업자 정보:', {
          CRR_NM: firstReceipt.CRR_NM,
          WRKR_NM: firstReceipt.WRKR_NM
        });
      }
    } catch (error) {
      console.error('현재 작업자 정보 조회 실패:', error);
    }
  };

  // 작업예정일 변경사유 공통코드 조회
  const fetchChangeReasonCodes = async () => {
    try {
      const codes = await getCommonCodes('CMWO224');
      setChangeReasonOptions(codes || []);
    } catch (error) {
      console.error('변경사유 코드 조회 실패:', error);
      // 실패해도 계속 진행
    }
  };

  // 날짜/시간 변경 여부 체크
  const isDateTimeChanged = () => {
    return divDate !== initialDate || hopeHour !== initialHour || hopeMinute !== initialMinute;
  };

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setShowDropdown(false);
      }
    };

    if (showDropdown) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [showDropdown]);

  // Debounced search
  const handleSearchChange = (value: string) => {
    setSearchQuery(value);
    setSelectedWorker(null);

    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    if (value.trim().length >= 2) {
      searchTimeoutRef.current = setTimeout(() => {
        searchWorkers(value.trim());
      }, 300);
    } else {
      setWorkers([]);
      setShowDropdown(false);
    }
  };

  const searchWorkers = async (query: string) => {
    setIsSearching(true);
    setShowDropdown(true);

    try {
      // Search by name or ID
      const result = await findUserList({
        USR_NM: query,
        SO_ID: userInfo?.soId || ''
      });

      setWorkers(result || []);
    } catch (error) {
      console.error('Worker search failed:', error);
      setWorkers([]);
    } finally {
      setIsSearching(false);
    }
  };

  const handleWorkerSelect = (worker: Worker) => {
    setSelectedWorker(worker);
    setSearchQuery(worker.USR_NM);
    setShowDropdown(false);
  };

  const handleSubmit = async () => {
    // 레거시 동일 유효성 검증 (mowob02m01.xml btn_save_OnClick 참조)

    // 1. 작업예정일 8자리 체크
    const dateStr = divDate.replace(/-/g, '');
    if (dateStr.length < 8) {
      showToast?.('작업예정일을 확인하세요.', 'error');
      return;
    }

    // 2. 희망시간(HH) 선택 여부
    if (!hopeHour) {
      showToast?.('작업예정시간을 선택하세요.', 'error');
      return;
    }

    // 3. 희망분(MI) 선택 여부
    if (!hopeMinute) {
      showToast?.('작업예정시간을 선택하세요.', 'error');
      return;
    }

    // 4. 예정일시가 현재시간 이후인지 체크
    const now = new Date();
    const currentDttm = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}`;
    const selectedDttm = `${dateStr}${hopeHour}${hopeMinute}`;
    if (Number(selectedDttm) < Number(currentDttm)) {
      showToast?.('예정일시를 현재시간 이후로 정해주세요.', 'error');
      return;
    }

    // 5. 작업자 선택 여부
    if (!selectedWorker) {
      showToast?.('작업자를 선택해주세요.', 'error');
      return;
    }

    if (!direction.WRK_DRCTN_ID && !direction.id) {
      showToast?.('작업지시 ID가 없습니다.', 'error');
      return;
    }

    // 6. 날짜/시간이 변경된 경우 변경사유 필수 체크
    if (isDateTimeChanged() && !changeReason) {
      showToast?.('작업예정일이 변경되었습니다. 변경사유를 선택해주세요.', 'error');
      return;
    }

    setIsSubmitting(true);

    try {
      // WRK_HOPE_DTTM 생성 (YYYYMMDDHHMM)
      const dateStr = divDate.replace(/-/g, '');
      const hopeDttm = (hopeHour && hopeMinute) ? `${dateStr}${hopeHour}${hopeMinute}` : undefined;

      // CHG_GB 계산 (레거시 로직: AL=전체변경, WR=작업자만, HD=희망일시만)
      const dateChanged = isDateTimeChanged();
      const workerChanged = true; // 항상 작업자 변경 (새 작업자 선택)
      let chgGb = '';
      if (dateChanged && workerChanged) {
        chgGb = 'AL';
      } else if (workerChanged) {
        chgGb = 'WR';
      } else if (dateChanged) {
        chgGb = 'HD';
      }

      // 레거시 동일 파라미터 (mowob02m01.xml btn_save_OnClick 참조)
      const directionAny = direction as any;

      // 당일 여부 체크 (SMS_YN 결정용)
      const today = new Date();
      const todayStr = `${today.getFullYear()}${String(today.getMonth() + 1).padStart(2, '0')}${String(today.getDate()).padStart(2, '0')}`;
      const isToday = dateStr === todayStr;

      const params: WorkerAdjustmentParams = {
        // 레거시 필수 파라미터
        CNTL_FG: 'UPMODE',
        NMLEVEL: '3',  // 작업자
        // 필수 파라미터
        WRK_DRCTN_ID: direction.WRK_DRCTN_ID || direction.id,
        WRKR_ID: selectedWorker.USR_ID,
        CRR_ID: selectedWorker.CRR_ID || userInfo?.crrId || '',
        POST_ID: selectedWorker.POST_ID || '',
        // 날짜/시간 파라미터
        DIV_DATE: dateStr,
        DIV_DT: dateStr,
        DIV_HH: hopeHour || '',
        DIV_MI: hopeMinute || '',
        WRK_HOPE_DTTM: hopeDttm || '',
        // 레거시 필수 파라미터 (누락되어 있던 것들)
        RCPT_ID: directionAny.RCPT_ID || '',
        WRK_ID: direction.id || directionAny.WRK_ID || '',  // direction.id가 WRK_ID
        REG_UID: userInfo?.userId || '',
        CHG_UID: userInfo?.userId || '',
        HOLY_YN: 'N',
        // SMS 발송 여부 (당일이면 Y)
        SMS_YN: isToday ? 'Y' : 'N',
        // 레거시 빈 값 파라미터
        DIV_RESULT: '',
        O_WRK_DIV_ID: '',
        WRK_DIV_CL: '',
        // 변경사유 및 변경구분 (레거시 파라미터명: CHG_RSN, CHG_GB)
        ...(changeReason && { CHG_RSN: changeReason }),
        ...(chgGb && { CHG_GB: chgGb }),
      } as any;

      console.log('Worker adjustment params:', params);

      const result = await adjustWorker(params);
      console.log('Worker adjustment result:', result);

      // 응답 에러 체크 (레거시 동일 구현)
      // result.result가 배열이고 첫 번째 항목에 MSGCODE/MESSAGE가 있으면 에러
      const resultData = result?.result;
      if (Array.isArray(resultData) && resultData.length > 0) {
        const firstItem = resultData[0];
        if (firstItem.MSGCODE && firstItem.MSGCODE !== 'SUCCESS' && firstItem.MSGCODE !== '0') {
          const errorMsg = firstItem.MESSAGE || firstItem.MSG || '작업자 보정에 실패했습니다.';
          showToast?.(errorMsg, 'error');
          return;
        }
      }
      // result 자체에 에러 코드가 있는 경우
      if (result?.code && result.code !== 'SUCCESS' && result.code !== '0') {
        const errorMsg = result.message || result.MESSAGE || '작업자 보정에 실패했습니다.';
        showToast?.(errorMsg, 'error');
        return;
      }

      showToast?.('작업자 보정이 완료되었습니다.', 'success');
      onSuccess?.();
      onClose();
    } catch (error: any) {
      console.error('Worker adjustment failed:', error);
      showToast?.(error.message || '작업자 보정에 실패했습니다.', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const formatDirectionInfo = () => {
    return (
      <div className="bg-gray-50 rounded-lg p-3 mb-4">
        <div className="space-y-1.5 text-sm">
          <div className="flex">
            <span className="text-gray-500 w-20 flex-shrink-0">의뢰서</span>
            <span className="font-mono text-gray-700">{formatId(direction.WRK_DRCTN_ID || direction.id)}</span>
          </div>
          <div className="flex">
            <span className="text-gray-500 w-20 flex-shrink-0">작업유형</span>
            <span className="text-blue-600 font-medium">{direction.typeDisplay || direction.WRK_CD_NM}</span>
          </div>
          <div className="flex">
            <span className="text-gray-500 w-20 flex-shrink-0">고객명</span>
            <span className="font-medium text-gray-900">{direction.customer?.name || (direction as any).CUST_NM}</span>
          </div>
        </div>
      </div>
    );
  };

  const footer = (
    <div className="flex gap-3">
      <button
        type="button"
        onClick={onClose}
        disabled={isSubmitting}
        className="flex-1 px-4 py-3 bg-gray-100 text-gray-700 rounded-lg font-medium hover:bg-gray-200 transition-colors disabled:opacity-50 whitespace-nowrap"
      >
        취소
      </button>
      <button
        type="button"
        onClick={handleSubmit}
        disabled={isSubmitting || !selectedWorker}
        className="flex-1 px-4 py-3 bg-blue-500 text-white rounded-lg font-medium hover:bg-blue-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
      >
        {isSubmitting ? '처리중...' : '저장'}
      </button>
    </div>
  );

  return (
    <BaseModal
      isOpen={isOpen}
      onClose={onClose}
      title="작업자 보정"
      size="medium"
      footer={!isInitialLoading ? footer : undefined}
    >
      {/* 초기 로딩 중 */}
      {isInitialLoading ? (
        <div className="flex items-center justify-center py-12">
          <LoadingSpinner size="medium" message="정보를 불러오는 중..." />
        </div>
      ) : (
      <div className="space-y-4">
        {/* Direction Info */}
        {formatDirectionInfo()}

        {/* Worker Search */}
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-2">
            새 작업자 <span className="text-red-500">*</span>
          </label>
          <div className="relative" ref={searchRef}>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => handleSearchChange(e.target.value)}
                onFocus={() => workers.length > 0 && setShowDropdown(true)}
                placeholder="이름으로 검색 (2자 이상)"
                className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
              {selectedWorker && (
                <button
                  type="button"
                  onClick={() => {
                    setSelectedWorker(null);
                    setSearchQuery('');
                    setWorkers([]);
                  }}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            {/* Search Dropdown */}
            {showDropdown && (
              <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-48 overflow-y-auto z-30">
                {isSearching ? (
                  <div className="p-4 text-center">
                    <LoadingSpinner size="small" message="검색중..." />
                  </div>
                ) : workers.length === 0 ? (
                  <div className="p-4 text-center text-gray-500">
                    <User className="w-8 h-8 mx-auto mb-2 text-gray-300" />
                    <p className="text-sm">검색 결과가 없습니다.</p>
                  </div>
                ) : (
                  workers.map((worker) => {
                    const corpName = worker.CORP_NM || worker.CRR_NM || '';
                    const phone = worker.TEL_NO3 || worker.TEL_NO2 || worker.HP_NO || worker.PDATEL_NO || '';
                    return (
                      <button
                        key={worker.USR_ID}
                        type="button"
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => handleWorkerSelect(worker)}
                        className="w-full p-3 text-left hover:bg-blue-50 transition-colors border-b border-gray-100 last:border-b-0"
                      >
                        <div className="font-medium text-gray-900">{worker.USR_NM}</div>
                        <div className="text-xs text-gray-500 mt-0.5">
                          {worker.USR_ID}{corpName && ` · ${corpName}`}{phone && ` · ${formatId(phone)}`}
                        </div>
                      </button>
                    );
                  })
                )}
              </div>
            )}
          </div>
        </div>

        {/* Selected Worker Display */}
        {selectedWorker && (() => {
          const corpName = selectedWorker.CORP_NM || selectedWorker.CRR_NM || '';
          const phone = selectedWorker.TEL_NO3 || selectedWorker.TEL_NO2 || selectedWorker.HP_NO || selectedWorker.PDATEL_NO || '';
          return (
            <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
              <div className="font-semibold text-gray-900 text-base mb-2">{selectedWorker.USR_NM}</div>
              <div className="space-y-1 text-sm">
                <div className="flex">
                  <span className="text-gray-500 w-16 flex-shrink-0">사번</span>
                  <span className="text-gray-700">{selectedWorker.USR_ID}</span>
                </div>
                {corpName && (
                  <div className="flex">
                    <span className="text-gray-500 w-16 flex-shrink-0">업체명</span>
                    <span className="text-gray-700">{corpName}</span>
                  </div>
                )}
                {phone && (
                  <div className="flex">
                    <span className="text-gray-500 w-16 flex-shrink-0">전화번호</span>
                    <span className="text-gray-700">{formatId(phone)}</span>
                  </div>
                )}
              </div>
            </div>
          );
        })()}

        {/* 작업예정일 */}
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-2">
            작업예정일 <span className="font-normal text-blue-600"></span>
          </label>
          <div className="relative">
            <input
              type="date"
              ref={datePickerRef}
              value={divDate}
              onChange={(e) => setDivDate(e.target.value)}
              className="absolute opacity-0 pointer-events-none h-0 w-0"
              tabIndex={-1}
            />
            <button
              type="button"
              onClick={() => (datePickerRef.current as any)?.showPicker?.()}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 cursor-pointer bg-white flex items-center justify-between"
            >
              <span className={`text-sm sm:text-base ${divDate ? 'text-gray-900' : 'text-gray-500'}`}>
                {divDate || '날짜 선택'}
              </span>
              <Calendar className="w-4 h-4 text-gray-400" />
            </button>
          </div>
        </div>

        {/* 작업예정시간 (시/분 선택) */}
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-2">
            작업예정시간
          </label>
          <div className="flex gap-2">
            <div className="flex-1">
              <Select
                value={hopeHour}
                onValueChange={setHopeHour}
                options={[
                  { value: '', label: '시 선택' },
                  ...HOUR_OPTIONS.map(opt => ({ value: opt.value, label: opt.label }))
                ]}
                placeholder="시 선택"
              />
            </div>
            <div className="flex-1">
              <Select
                value={hopeMinute}
                onValueChange={setHopeMinute}
                options={[
                  { value: '', label: '분 선택' },
                  ...MINUTE_OPTIONS.map(opt => ({ value: opt.value, label: opt.label }))
                ]}
                placeholder="분 선택"
              />
            </div>
          </div>
        </div>

        {/* 작업예정일 변경사유 (항상 표시) */}
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-2">
            작업예정일 변경사유 {isDateTimeChanged() && <span className="text-red-500">*</span>}
          </label>
          <Select
            value={changeReason}
            onValueChange={setChangeReason}
            options={[
              { value: '', label: '변경사유 선택' },
              ...changeReasonOptions.map(opt => ({ value: opt.code, label: opt.name }))
            ]}
            placeholder="변경사유 선택"
          />
          {isDateTimeChanged() && (
            <p className="mt-1 text-xs text-orange-600">
              작업예정일 또는 시간이 변경되어 사유 입력이 필요합니다.
            </p>
          )}
        </div>

        {/* Info Note */}
        <div className="flex items-start gap-2 p-3 bg-amber-50 rounded-lg">
          <AlertCircle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
          <p className="text-xs text-amber-700">
            작업자 보정 시 해당 작업지시서의 모든 개별작업이 새 작업자에게 배정됩니다.
          </p>
        </div>
      </div>
      )}

      {/* Loading Overlay */}
      {isSubmitting && (
        <div className="absolute inset-0 bg-white/80 flex items-center justify-center rounded-lg">
          <LoadingSpinner size="medium" message="작업자 보정 처리중..." />
        </div>
      )}
    </BaseModal>
  );
};

export default WorkerAdjustmentModal;
