import React, { useState, useEffect, useCallback } from 'react';
import {
  Loader2, AlertCircle, Send, Calendar,
  RefreshCw, CheckCircle, XCircle, FileText
} from 'lucide-react';
import {
  getPromOfContract,
  savePromCtrtInfo,
  getPromMonthCodes,
  getPromChangeReasonCodes,
  getPromChangeCodes,
  ContractInfo,
  formatDate
} from '../../services/customerApi';

// ID 포맷 (3-3-4 형식)
const formatId = (id: string): string => {
  if (!id) return '-';
  const cleaned = id.replace(/[^0-9]/g, '');
  if (cleaned.length === 10) {
    return `${cleaned.slice(0, 3)}-${cleaned.slice(3, 6)}-${cleaned.slice(6, 10)}`;
  }
  return id;
};

interface ReContractRegistrationProps {
  onBack: () => void;
  showToast?: (message: string, type: 'success' | 'error' | 'warning' | 'info') => void;
  selectedCustomer: {
    custId: string;
    custNm: string;
    telNo: string;
  } | null;
  selectedContract: {
    ctrtId: string;
    prodNm: string;
    instAddr: string;
    postId?: string;
    soId?: string;
  } | null;
  contracts?: ContractInfo[];
  onNavigateToBasicInfo: () => void;
}

interface CodeItem {
  CODE: string;
  CODE_NM: string;
}

interface PromInfo {
  CTRT_ID: string;
  PROM_CTRT_ID: string;
  PROM_YN: string;
  PROM_CHG_CD: string;
  PROM_CHG_CD_NM: string;
  PROM_CHGRSN_CD: string;
  PROM_CHGRSN_CD_NM: string;
  PROM_CNT: string;
  PROM_CNT_NM: string;
  CTRT_APLY_STRT_DT: string;
  CTRT_APLY_END_DT: string;
  OPEN_DD: string;
  PROD_NM: string;
  CTRT_STAT: string;
  CTRT_STAT_NM: string;
  RCPT_ID: string;
  USE_PROM_CTRT: string;
  RATE_STRT_DT: string;
  EFFECT_DT: string;
}

/**
 * 재약정 등록 화면
 *
 * 회의내용:
 * - 계약을 물고 들어가야 한다 (AS/상담처럼)
 * - 사용중(기간도래)만 활성화
 * - 상담코드 1개, 드롭다운 코드 불러와야 함
 * - 약정변경사유 드롭다운 불러와야 함
 */
const ReContractRegistration: React.FC<ReContractRegistrationProps> = ({
  onBack,
  showToast,
  selectedCustomer,
  selectedContract,
  contracts = [],
  onNavigateToBasicInfo
}) => {
  // 약정 정보
  const [promInfo, setPromInfo] = useState<PromInfo | null>(null);
  const [promLoading, setPromLoading] = useState(false);

  // 코드 목록
  const [promMonthCodes, setPromMonthCodes] = useState<CodeItem[]>([]);
  const [promChangeReasonCodes, setPromChangeReasonCodes] = useState<CodeItem[]>([]);
  const [promChangeCodes, setPromChangeCodes] = useState<CodeItem[]>([]);
  const [codesLoaded, setCodesLoaded] = useState(false);

  // 폼 상태
  const [form, setForm] = useState({
    promChgCd: '05',        // 약정변경코드 (05=재약정)
    promChgrsnCd: '',       // 약정변경사유
    promCnt: '',            // 약정개월수
    startDate: '',          // 시작일
    endDate: '',            // 종료일
  });

  // 등록 상태
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [resultPopup, setResultPopup] = useState<{
    show: boolean;
    success: boolean;
    message: string;
  }>({ show: false, success: false, message: '' });

  // 코드 로드
  const loadCodes = useCallback(async () => {
    if (codesLoaded) return;
    try {
      const [monthRes, reasonRes, changeRes] = await Promise.all([
        getPromMonthCodes(),
        getPromChangeReasonCodes(),
        getPromChangeCodes(),
      ]);

      if (monthRes.success && monthRes.data) {
        // D'Live 코드 형식 변환
        const codes = (monthRes.data as any[]).map((c: any) => ({
          CODE: c.code || c.CODE || '',
          CODE_NM: c.name || c.CODE_NM || '',
        })).filter((c: CodeItem) => c.CODE);
        setPromMonthCodes(codes.length > 0 ? codes : [
          { CODE: '0', CODE_NM: '약정없음' },
          { CODE: '12', CODE_NM: '12개월' },
          { CODE: '24', CODE_NM: '24개월' },
          { CODE: '36', CODE_NM: '36개월' },
          { CODE: '48', CODE_NM: '48개월' },
          { CODE: '60', CODE_NM: '60개월' },
        ]);
      } else {
        setPromMonthCodes([
          { CODE: '0', CODE_NM: '약정없음' },
          { CODE: '12', CODE_NM: '12개월' },
          { CODE: '24', CODE_NM: '24개월' },
          { CODE: '36', CODE_NM: '36개월' },
          { CODE: '48', CODE_NM: '48개월' },
          { CODE: '60', CODE_NM: '60개월' },
        ]);
      }

      if (reasonRes.success && reasonRes.data) {
        const codes = (reasonRes.data as any[]).map((c: any) => ({
          CODE: c.code || c.CODE || '',
          CODE_NM: c.name || c.CODE_NM || '',
        })).filter((c: CodeItem) => c.CODE);
        setPromChangeReasonCodes(codes.length > 0 ? codes : [
          { CODE: 'A', CODE_NM: '연장' },
          { CODE: 'B', CODE_NM: '신규' },
          { CODE: 'C', CODE_NM: '변경' },
          { CODE: 'D', CODE_NM: '기타' },
        ]);
      } else {
        setPromChangeReasonCodes([
          { CODE: 'A', CODE_NM: '연장' },
          { CODE: 'B', CODE_NM: '신규' },
          { CODE: 'C', CODE_NM: '변경' },
          { CODE: 'D', CODE_NM: '기타' },
        ]);
      }

      if (changeRes.success && changeRes.data) {
        const codes = (changeRes.data as any[]).map((c: any) => ({
          CODE: c.code || c.CODE || '',
          CODE_NM: c.name || c.CODE_NM || '',
        })).filter((c: CodeItem) => c.CODE);
        setPromChangeCodes(codes.length > 0 ? codes : [
          { CODE: '01', CODE_NM: '신규약정' },
          { CODE: '02', CODE_NM: '약정변경' },
          { CODE: '03', CODE_NM: '약정취소' },
          { CODE: '04', CODE_NM: '약정변경처리' },
          { CODE: '05', CODE_NM: '재약정' },
        ]);
      } else {
        setPromChangeCodes([
          { CODE: '01', CODE_NM: '신규약정' },
          { CODE: '02', CODE_NM: '약정변경' },
          { CODE: '03', CODE_NM: '약정취소' },
          { CODE: '04', CODE_NM: '약정변경처리' },
          { CODE: '05', CODE_NM: '재약정' },
        ]);
      }

      setCodesLoaded(true);
    } catch (e) {
      console.error('Code loading failed:', e);
      // Set defaults
      setPromMonthCodes([
        { CODE: '0', CODE_NM: '약정없음' },
        { CODE: '12', CODE_NM: '12개월' },
        { CODE: '24', CODE_NM: '24개월' },
        { CODE: '36', CODE_NM: '36개월' },
        { CODE: '48', CODE_NM: '48개월' },
        { CODE: '60', CODE_NM: '60개월' },
      ]);
      setPromChangeReasonCodes([
        { CODE: 'A', CODE_NM: '연장' },
        { CODE: 'B', CODE_NM: '신규' },
        { CODE: 'C', CODE_NM: '변경' },
        { CODE: 'D', CODE_NM: '기타' },
      ]);
      setPromChangeCodes([
        { CODE: '01', CODE_NM: '신규약정' },
        { CODE: '02', CODE_NM: '약정변경' },
        { CODE: '03', CODE_NM: '약정취소' },
        { CODE: '04', CODE_NM: '약정변경처리' },
        { CODE: '05', CODE_NM: '재약정' },
      ]);
      setCodesLoaded(true);
    }
  }, [codesLoaded]);

  // 약정정보 로드
  const loadPromInfo = useCallback(async () => {
    if (!selectedContract?.ctrtId) return;
    setPromLoading(true);
    try {
      const res = await getPromOfContract(selectedContract.ctrtId);
      if (res.success && res.data && res.data.length > 0) {
        setPromInfo(res.data[0] as PromInfo);
        // Set default start date to current end date + 1 day (re-contract starts after current)
        const endDt = res.data[0].CTRT_APLY_END_DT;
        if (endDt) {
          setForm(prev => ({ ...prev, startDate: endDt }));
        }
      } else {
        setPromInfo(null);
      }
    } catch (e) {
      console.error('Promotion info load failed:', e);
      setPromInfo(null);
    } finally {
      setPromLoading(false);
    }
  }, [selectedContract?.ctrtId]);

  // 초기 로드
  useEffect(() => {
    loadCodes();
  }, [loadCodes]);

  useEffect(() => {
    if (selectedContract?.ctrtId) {
      loadPromInfo();
    }
  }, [selectedContract?.ctrtId, loadPromInfo]);

  // 약정개월수 변경 시 종료일 자동 계산
  useEffect(() => {
    if (form.startDate && form.promCnt && form.promCnt !== '0') {
      const months = parseInt(form.promCnt, 10);
      if (!isNaN(months) && months > 0) {
        // startDate: YYYYMMDD format
        const start = form.startDate.replace(/[^0-9]/g, '');
        if (start.length === 8) {
          const y = parseInt(start.substring(0, 4), 10);
          const m = parseInt(start.substring(4, 6), 10) - 1; // 0-indexed
          const d = parseInt(start.substring(6, 8), 10);
          const endDate = new Date(y, m + months, d - 1); // months later, -1 day
          const endStr = `${endDate.getFullYear()}${String(endDate.getMonth() + 1).padStart(2, '0')}${String(endDate.getDate()).padStart(2, '0')}`;
          setForm(prev => ({ ...prev, endDate: endStr }));
        }
      }
    } else if (form.promCnt === '0') {
      setForm(prev => ({ ...prev, endDate: '' }));
    }
  }, [form.startDate, form.promCnt]);

  // 날짜 표시 포맷 (YYYYMMDD → YYYY-MM-DD)
  const formatDateStr = (dt: string): string => {
    if (!dt) return '-';
    const clean = dt.replace(/[^0-9]/g, '');
    if (clean.length === 8) {
      return `${clean.substring(0, 4)}-${clean.substring(4, 6)}-${clean.substring(6, 8)}`;
    }
    return dt;
  };

  // 오늘 날짜 (YYYYMMDD)
  const getTodayStr = (): string => {
    const now = new Date();
    return `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`;
  };

  // 등록 핸들러
  const handleSubmit = async () => {
    if (!selectedCustomer || !selectedContract) {
      showToast?.('고객/계약이 선택되지 않았습니다.', 'error');
      return;
    }

    if (!form.promChgCd) {
      showToast?.('약정변경코드를 선택해주세요.', 'warning');
      return;
    }

    if (!form.promCnt) {
      showToast?.('약정개월수를 선택해주세요.', 'warning');
      return;
    }

    if (!form.promChgrsnCd) {
      showToast?.('약정변경사유를 선택해주세요.', 'warning');
      return;
    }

    if (!form.startDate) {
      showToast?.('약정시작일을 입력해주세요.', 'warning');
      return;
    }

    if (form.promCnt !== '0' && !form.endDate) {
      showToast?.('약정종료일이 계산되지 않았습니다.', 'warning');
      return;
    }

    setIsSubmitting(true);
    try {
      const params = {
        CTRT_ID: selectedContract.ctrtId,
        PROM_CHG_CD: form.promChgCd,
        PROM_CHGRSN_CD: form.promChgrsnCd,
        PROM_CNT: form.promCnt,
        CTRT_APLY_STRT_DT: form.startDate.replace(/[^0-9]/g, ''),
        CTRT_APLY_END_DT: form.endDate ? form.endDate.replace(/[^0-9]/g, '') : '',
        PROM_CTRT_ID: promInfo?.PROM_CTRT_ID || '',
        RCPT_ID: promInfo?.RCPT_ID || '',
        CHK_OPEN_DD: 'N',
        REPROM_CANCEL: 'N',
      };

      const res = await savePromCtrtInfo(params);
      if (res.success) {
        setResultPopup({ show: true, success: true, message: '재약정이 등록되었습니다.' });
        // Refresh promotion info
        loadPromInfo();
        // Reset form
        setForm(prev => ({
          ...prev,
          promChgrsnCd: '',
          promCnt: '',
          endDate: '',
        }));
      } else {
        setResultPopup({ show: true, success: false, message: res.message || '재약정 등록에 실패했습니다.' });
      }
    } catch (e: any) {
      setResultPopup({ show: true, success: false, message: '재약정 등록 중 오류가 발생했습니다.' });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="h-full overflow-y-auto">
      <div className="p-4 space-y-4 pb-8">

        {/* 헤더 */}
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-gray-800 flex items-center gap-2">
            <FileText className="w-5 h-5 text-purple-500" />
            재약정 등록
          </h2>
          {selectedContract && (
            <button
              onClick={() => loadPromInfo()}
              className="p-2 text-gray-500 hover:text-gray-700 rounded-lg hover:bg-gray-100"
              title="새로고침"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* 고객/계약 미선택 안내 */}
        {!selectedCustomer ? (
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
            <div className="flex items-start gap-2">
              <AlertCircle className="w-5 h-5 text-yellow-500 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-yellow-700">고객을 먼저 선택해주세요.</p>
                <p className="text-xs text-yellow-600 mt-1">
                  기본조회에서 고객을 검색하고, 계약현황에서 재약정 버튼을 클릭하세요.
                </p>
                <button
                  onClick={onNavigateToBasicInfo}
                  className="mt-2 text-xs text-blue-600 hover:text-blue-800 underline"
                >
                  기본조회로 이동
                </button>
              </div>
            </div>
          </div>
        ) : !selectedContract ? (
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
            <div className="flex items-start gap-2">
              <AlertCircle className="w-5 h-5 text-yellow-500 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-yellow-700">계약을 선택해주세요.</p>
                <p className="text-xs text-yellow-600 mt-1">
                  계약현황에서 사용중(기간도래) 계약의 재약정 버튼을 클릭하세요.
                </p>
                <button
                  onClick={onNavigateToBasicInfo}
                  className="mt-2 text-xs text-blue-600 hover:text-blue-800 underline"
                >
                  기본조회로 이동
                </button>
              </div>
            </div>
          </div>
        ) : (
          <>
            {/* 선택된 계약 정보 */}
            <div className="bg-purple-50 border border-purple-200 rounded-lg p-3">
              <div className="text-xs text-purple-600 font-medium mb-2">선택된 계약</div>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div>
                  <span className="text-gray-500">고객명:</span>{' '}
                  <span className="font-medium">{selectedCustomer.custNm}</span>
                </div>
                <div>
                  <span className="text-gray-500">고객ID:</span>{' '}
                  <span className="font-medium">{formatId(selectedCustomer.custId)}</span>
                </div>
                <div>
                  <span className="text-gray-500">계약ID:</span>{' '}
                  <span className="font-medium">{formatId(selectedContract.ctrtId)}</span>
                </div>
                <div>
                  <span className="text-gray-500">상품:</span>{' '}
                  <span className="font-medium">{selectedContract.prodNm || '-'}</span>
                </div>
                <div className="col-span-2">
                  <span className="text-gray-500">설치주소:</span>{' '}
                  <span className="font-medium">{selectedContract.instAddr || '-'}</span>
                </div>
              </div>
            </div>

            {/* 현재 약정 정보 */}
            <div className="bg-white border border-gray-200 rounded-lg p-3">
              <div className="text-xs text-gray-600 font-medium mb-2 flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5" />
                현재 약정정보
              </div>
              {promLoading ? (
                <div className="flex items-center justify-center py-4">
                  <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
                </div>
              ) : promInfo ? (
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div>
                    <span className="text-gray-500">약정여부:</span>{' '}
                    <span className={`font-medium ${promInfo.PROM_YN === 'Y' ? 'text-green-600' : 'text-gray-600'}`}>
                      {promInfo.PROM_YN === 'Y' ? '약정중' : '약정없음'}
                    </span>
                  </div>
                  <div>
                    <span className="text-gray-500">약정개월:</span>{' '}
                    <span className="font-medium">{promInfo.PROM_CNT_NM || promInfo.PROM_CNT || '-'}</span>
                  </div>
                  <div>
                    <span className="text-gray-500">약정시작:</span>{' '}
                    <span className="font-medium">{formatDateStr(promInfo.CTRT_APLY_STRT_DT)}</span>
                  </div>
                  <div>
                    <span className="text-gray-500">약정종료:</span>{' '}
                    <span className="font-medium">{formatDateStr(promInfo.CTRT_APLY_END_DT)}</span>
                  </div>
                  <div>
                    <span className="text-gray-500">변경유형:</span>{' '}
                    <span className="font-medium">{promInfo.PROM_CHG_CD_NM || '-'}</span>
                  </div>
                  <div>
                    <span className="text-gray-500">변경사유:</span>{' '}
                    <span className="font-medium">{promInfo.PROM_CHGRSN_CD_NM || '-'}</span>
                  </div>
                </div>
              ) : (
                <div className="text-sm text-gray-500 text-center py-2">
                  약정정보가 없습니다.
                </div>
              )}
            </div>

            {/* 재약정 등록 폼 */}
            <div className="bg-white border border-gray-200 rounded-lg p-4 space-y-4">
              <div className="text-sm font-bold text-gray-800 border-b pb-2">재약정 등록</div>

              {/* 약정변경코드 */}
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">약정변경코드</label>
                <select
                  value={form.promChgCd}
                  onChange={(e) => setForm(prev => ({ ...prev, promChgCd: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                >
                  <option value="">선택</option>
                  {promChangeCodes.map(c => (
                    <option key={c.CODE} value={c.CODE}>{c.CODE_NM}</option>
                  ))}
                </select>
              </div>

              {/* 약정변경사유 */}
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">약정변경사유</label>
                <select
                  value={form.promChgrsnCd}
                  onChange={(e) => setForm(prev => ({ ...prev, promChgrsnCd: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                >
                  <option value="">선택</option>
                  {promChangeReasonCodes.map(c => (
                    <option key={c.CODE} value={c.CODE}>{c.CODE_NM}</option>
                  ))}
                </select>
              </div>

              {/* 약정개월수 */}
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">약정개월수</label>
                <select
                  value={form.promCnt}
                  onChange={(e) => setForm(prev => ({ ...prev, promCnt: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                >
                  <option value="">선택</option>
                  {promMonthCodes.map(c => (
                    <option key={c.CODE} value={c.CODE}>{c.CODE_NM}</option>
                  ))}
                </select>
              </div>

              {/* 약정시작일 */}
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">약정시작일</label>
                <input
                  type="date"
                  value={form.startDate ? formatDateStr(form.startDate) : ''}
                  onChange={(e) => {
                    const val = e.target.value.replace(/-/g, '');
                    setForm(prev => ({ ...prev, startDate: val }));
                  }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                />
              </div>

              {/* 약정종료일 (자동 계산) */}
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">약정종료일 (자동 계산)</label>
                <input
                  type="text"
                  value={form.endDate ? formatDateStr(form.endDate) : '-'}
                  readOnly
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm bg-gray-50 text-gray-600"
                />
              </div>

              {/* 등록 버튼 */}
              <button
                onClick={handleSubmit}
                disabled={isSubmitting || !form.promChgCd || !form.promCnt || !form.promChgrsnCd || !form.startDate}
                className={`w-full flex items-center justify-center gap-2 py-3 rounded-lg text-sm font-bold transition-colors ${
                  isSubmitting || !form.promChgCd || !form.promCnt || !form.promChgrsnCd || !form.startDate
                    ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                    : 'bg-purple-500 hover:bg-purple-600 text-white'
                }`}
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    등록 중...
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4" />
                    재약정 등록
                  </>
                )}
              </button>
            </div>
          </>
        )}

        {/* 결과 팝업 */}
        {resultPopup.show && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl shadow-xl max-w-sm w-full p-6">
              <div className="flex flex-col items-center text-center">
                {resultPopup.success ? (
                  <CheckCircle className="w-12 h-12 text-green-500 mb-3" />
                ) : (
                  <XCircle className="w-12 h-12 text-red-500 mb-3" />
                )}
                <h3 className="text-lg font-bold text-gray-800 mb-2">
                  {resultPopup.success ? '등록 완료' : '등록 실패'}
                </h3>
                <p className="text-sm text-gray-600 mb-4">{resultPopup.message}</p>
                <button
                  onClick={() => setResultPopup({ show: false, success: false, message: '' })}
                  className={`w-full py-2.5 rounded-lg text-sm font-bold text-white ${
                    resultPopup.success ? 'bg-green-500 hover:bg-green-600' : 'bg-red-500 hover:bg-red-600'
                  }`}
                >
                  확인
                </button>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
};

export default ReContractRegistration;
