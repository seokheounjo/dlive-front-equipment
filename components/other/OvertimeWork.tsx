import React, { useState, useEffect, useCallback } from 'react';
import {
  Clock, Plus, ChevronDown, ChevronUp, FileText, Loader2, Send,
  Calendar, AlertCircle, CheckCircle, XCircle, X
} from 'lucide-react';

interface OvertimeWorkProps {
  onBack: () => void;
  userInfo?: { userId: string; userName: string; soId?: string } | null;
  showToast?: (message: string, type: 'success' | 'error' | 'warning' | 'info') => void;
}

interface OvertimeRecord {
  DOC_COMP: string;
  DOC_DATE: string;
  DOC_GBN: string;
  DOC_NO: string;
  FROM_DATE1_PLAN: string;
  FROM_HOUR1_PLAN: string;
  FROM_MINU1_PLAN: string;
  TO_DATE1_PLAN: string;
  TO_HOUR1_PLAN: string;
  TO_MINU1_PLAN: string;
  FROM_DATE1: string;
  FROM_HOUR1: string;
  FROM_MINU1: string;
  TO_DATE1: string;
  TO_HOUR1: string;
  TO_MINU1: string;
  REASON1: string;
  PLAN_TIME: string;
  RUN_TIME: string;
  REASON_GUBN: string;
  SUDANG_GUBN: string;
  APPROVE: string;
  GUBN_S: string;
  sanct_yn: string;
}

interface GubnCode {
  GUBN_CODE: string;
  GUBN_NAME: string;
}

interface ResultPopup {
  show: boolean;
  type: 'success' | 'error';
  title: string;
  message: string;
}

// Calculate hours between time range
function calcHours(fromDate: string, fromHour: string, fromMinu: string, toDate: string, toHour: string, toMinu: string): string {
  if (!fromHour || !toHour) return '';
  const startMin = parseInt(fromHour) * 60 + parseInt(fromMinu || '0');
  const endMin = parseInt(toHour) * 60 + parseInt(toMinu || '0');
  let diffMin = endMin - startMin;
  if (fromDate && toDate && fromDate !== toDate) {
    diffMin += 24 * 60;
  }
  if (diffMin <= 0) return '';
  const h = Math.floor(diffMin / 60);
  const m = diffMin % 60;
  return m > 0 ? `${h}H${m}M` : `${h}H`;
}

// Format time range for display
function formatTimeRange(fromDate: string, fromHour: string, fromMinu: string, toDate: string, toHour: string, toMinu: string): string {
  if (!fromDate || !fromHour) return '-';
  const fDate = fromDate.replace(/\//g, '-');
  const tDate = toDate ? toDate.replace(/\//g, '-') : fDate;
  const fTime = `${fromHour.padStart(2, '0')}:${(fromMinu || '00').padStart(2, '0')}`;
  const tTime = `${toHour.padStart(2, '0')}:${(toMinu || '00').padStart(2, '0')}`;
  const hours = calcHours(fromDate, fromHour, fromMinu, toDate, toHour, toMinu);

  if (fDate === tDate) {
    return `${fDate} ${fTime} ~ ${tTime}${hours ? ` (${hours})` : ''}`;
  }
  return `${fDate} ${fTime} ~ ${tDate} ${tTime}${hours ? ` (${hours})` : ''}`;
}

const HOURS = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, '0'));
const MINUTES = ['00', '10', '20', '30', '40', '50'];

export default function OvertimeWork({ onBack, userInfo, showToast }: OvertimeWorkProps) {
  // Auth
  const [authorized, setAuthorized] = useState<boolean | null>(null);
  const [authChecking, setAuthChecking] = useState(true);

  // Common codes
  const [gubnCodes, setGubnCodes] = useState<GubnCode[]>([]);

  // List
  const [records, setRecords] = useState<OvertimeRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [period, setPeriod] = useState('1');

  // New application modal
  const [showApplyModal, setShowApplyModal] = useState(false);
  const [applyForm, setApplyForm] = useState({
    gubn: '',
    fromDate: new Date().toISOString().split('T')[0],
    fromHour: '18',
    fromMinu: '00',
    toDate: new Date().toISOString().split('T')[0],
    toHour: '22',
    toMinu: '00',
    reason: ''
  });
  const [submitting, setSubmitting] = useState(false);

  // Actual input modal
  const [showActualModal, setShowActualModal] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState<OvertimeRecord | null>(null);
  const [actualForm, setActualForm] = useState({
    fromDate: '',
    fromHour: '',
    fromMinu: '00',
    toDate: '',
    toHour: '',
    toMinu: '00',
    reason: ''
  });
  const [savingActual, setSavingActual] = useState(false);

  // Result popup
  const [resultPopup, setResultPopup] = useState<ResultPopup>({ show: false, type: 'success', title: '', message: '' });

  // Auth check — server error (500) is NOT auth denial, allow access
  useEffect(() => {
    if (!userInfo?.userId) return;
    (async () => {
      try {
        const res = await fetch('/api/other/overtime/checkAuth', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ USR_ID: userInfo.userId })
        });
        // 200 = authorized, 403 = denied, 500 = server error (allow access)
        if (res.ok) {
          setAuthorized(true);
        } else if (res.status === 403) {
          setAuthorized(false);
        } else {
          // Server error - allow access, individual APIs have their own error handling
          console.warn('[OvertimeWork] checkAuth server error, allowing access:', res.status);
          setAuthorized(true);
        }
      } catch {
        // Network error - allow access
        console.warn('[OvertimeWork] checkAuth network error, allowing access');
        setAuthorized(true);
      } finally {
        setAuthChecking(false);
      }
    })();
  }, [userInfo?.userId]);

  // Load common codes
  useEffect(() => {
    if (!authorized) return;
    (async () => {
      try {
        const res = await fetch('/api/other/overtime/getGubn', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({})
        });
        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data)) {
            setGubnCodes(data);
            if (data.length > 0 && !applyForm.gubn) {
              setApplyForm(prev => ({ ...prev, gubn: data[0].GUBN_CODE }));
            }
          }
        }
      } catch {
        // ignore
      }
    })();
  }, [authorized]);

  // Load list
  const loadList = useCallback(async (periodVal?: string) => {
    if (!userInfo?.userId || !authorized) return;
    setLoading(true);
    try {
      const res = await fetch('/api/other/overtime/list', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          USR_ID: userInfo.userId,
          period_chk: periodVal || period
        })
      });
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data)) {
          setRecords(data);
        }
      }
    } catch {
      showToast?.('조회에 실패했습니다.', 'error');
    } finally {
      setLoading(false);
    }
  }, [userInfo?.userId, authorized, period]);

  useEffect(() => {
    if (authorized) loadList();
  }, [authorized, loadList]);

  const handlePeriodChange = (val: string) => {
    setPeriod(val);
    loadList(val);
  };

  // Submit new application
  const handleApply = async () => {
    if (!userInfo?.userId) return;
    if (!applyForm.gubn) {
      setResultPopup({ show: true, type: 'error', title: '입력 오류', message: '구분을 선택해주세요.' });
      return;
    }
    if (!applyForm.reason.trim()) {
      setResultPopup({ show: true, type: 'error', title: '입력 오류', message: '근무사유를 입력해주세요.' });
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch('/api/other/overtime/savePlan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          USR_ID: userInfo.userId,
          FROM_DATE: applyForm.fromDate.replace(/-/g, '/'),
          FROM_HOUR: applyForm.fromHour,
          FROM_MINU: applyForm.fromMinu,
          TO_DATE: applyForm.toDate.replace(/-/g, '/'),
          TO_HOUR: applyForm.toHour,
          TO_MINU: applyForm.toMinu,
          GUBN: applyForm.gubn,
          REASON: applyForm.reason
        })
      });

      if (res.ok) {
        setShowApplyModal(false);
        setApplyForm(prev => ({ ...prev, reason: '' }));
        loadList();
        setResultPopup({ show: true, type: 'success', title: '신청 완료', message: '시간외근무가 신청되었습니다.' });
      } else {
        const err = await res.json().catch(() => null);
        const msg = err?.rootCause || err?.cause || err?.message || '신청에 실패했습니다.';
        setResultPopup({ show: true, type: 'error', title: '신청 실패', message: msg });
      }
    } catch {
      setResultPopup({ show: true, type: 'error', title: '신청 실패', message: '서버 연결에 실패했습니다.' });
    } finally {
      setSubmitting(false);
    }
  };

  // Open actual input modal
  const openActualModal = (record: OvertimeRecord) => {
    setSelectedRecord(record);
    setActualForm({
      fromDate: record.FROM_DATE1_PLAN?.replace(/\//g, '-') || '',
      fromHour: record.FROM_HOUR1_PLAN || '18',
      fromMinu: record.FROM_MINU1_PLAN || '00',
      toDate: record.TO_DATE1_PLAN?.replace(/\//g, '-') || '',
      toHour: record.TO_HOUR1_PLAN || '22',
      toMinu: record.TO_MINU1_PLAN || '00',
      reason: record.REASON1 || ''
    });
    setShowActualModal(true);
  };

  // Save actual
  const handleSaveActual = async () => {
    if (!userInfo?.userId || !selectedRecord) return;
    if (!actualForm.reason.trim()) {
      setResultPopup({ show: true, type: 'error', title: '입력 오류', message: '근무사유를 입력해주세요.' });
      return;
    }

    setSavingActual(true);
    try {
      const res = await fetch('/api/other/overtime/saveActual', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          USR_ID: userInfo.userId,
          FROM_DATE: actualForm.fromDate.replace(/-/g, '/'),
          FROM_HOUR: actualForm.fromHour,
          FROM_MINU: actualForm.fromMinu,
          TO_DATE: actualForm.toDate.replace(/-/g, '/'),
          TO_HOUR: actualForm.toHour,
          TO_MINU: actualForm.toMinu,
          GUBN: selectedRecord.GUBN_S,
          REASON: actualForm.reason,
          DOC_NO: selectedRecord.DOC_NO,
          DOC_DATE: selectedRecord.DOC_DATE,
          DOC_COMP: selectedRecord.DOC_COMP,
          DOC_GBN: selectedRecord.DOC_GBN || '74'
        })
      });

      if (res.ok) {
        setShowActualModal(false);
        loadList();
        setResultPopup({ show: true, type: 'success', title: '저장 완료', message: '실적이 저장되었습니다.' });
      } else {
        const err = await res.json().catch(() => null);
        const msg = err?.rootCause || err?.cause || err?.message || '저장에 실패했습니다.';
        setResultPopup({ show: true, type: 'error', title: '저장 실패', message: msg });
      }
    } catch {
      setResultPopup({ show: true, type: 'error', title: '저장 실패', message: '서버 연결에 실패했습니다.' });
    } finally {
      setSavingActual(false);
    }
  };

  const getGubnName = (code: string) => {
    return gubnCodes.find(g => g.GUBN_CODE === code)?.GUBN_NAME || code || '-';
  };

  // Auth checking
  if (authChecking) {
    return (
      <div className="p-4 flex items-center justify-center gap-2 text-gray-500">
        <Loader2 className="w-5 h-5 animate-spin" />
        <span>권한 확인 중...</span>
      </div>
    );
  }

  if (!authorized) {
    return (
      <div className="p-4">
        <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center space-y-2">
          <AlertCircle className="w-10 h-10 text-red-400 mx-auto" />
          <p className="text-red-700 font-medium">접근 권한이 없습니다.</p>
          <p className="text-sm text-red-500">시간외근무 기능 사용 권한이 없습니다.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 space-y-4 flex-1 min-h-0 overflow-y-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="font-medium text-gray-800 flex items-center gap-2">
          <Clock className="w-5 h-5 text-primary-500" />
          시간외근무 현황
        </h3>
        <button
          onClick={() => setShowApplyModal(true)}
          className="flex items-center gap-1 px-3 py-1.5 bg-primary-500 text-white rounded-lg text-sm hover:bg-primary-600 transition-colors"
        >
          <Plus className="w-4 h-4" />
          신규 신청
        </button>
      </div>

      {/* Period filter */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-1 flex gap-1">
        {[
          { val: '1', label: '1주일' },
          { val: '2', label: '1개월' },
          { val: '3', label: '3개월' }
        ].map(opt => (
          <button
            key={opt.val}
            onClick={() => handlePeriodChange(opt.val)}
            className={`flex-1 py-2 rounded-lg transition-colors text-sm ${
              period === opt.val
                ? 'bg-primary-500 text-white'
                : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {/* List */}
      {loading ? (
        <div className="flex items-center justify-center py-8 text-gray-400">
          <Loader2 className="w-5 h-5 animate-spin mr-2" />
          조회 중...
        </div>
      ) : records.length === 0 ? (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8 text-center text-gray-400">
          <FileText className="w-8 h-8 mx-auto mb-2 opacity-50" />
          <p className="text-sm">시간외근무 내역이 없습니다.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {records.map((record, idx) => {
            const isApproved = record.APPROVE === 'Y';
            const isSanctioned = record.sanct_yn === 'Y';
            const hasPlan = !!record.FROM_DATE1_PLAN && !!record.FROM_HOUR1_PLAN;
            const hasActual = !!record.FROM_DATE1 && !!record.FROM_HOUR1;
            const canInputActual = isApproved && !isSanctioned;

            const planDisplay = hasPlan
              ? formatTimeRange(record.FROM_DATE1_PLAN, record.FROM_HOUR1_PLAN, record.FROM_MINU1_PLAN, record.TO_DATE1_PLAN, record.TO_HOUR1_PLAN, record.TO_MINU1_PLAN)
              : (record.PLAN_TIME || '-');
            const actualDisplay = hasActual
              ? formatTimeRange(record.FROM_DATE1, record.FROM_HOUR1, record.FROM_MINU1, record.TO_DATE1, record.TO_HOUR1, record.TO_MINU1)
              : (record.RUN_TIME || '-');

            return (
              <div key={`${record.DOC_DATE}-${record.DOC_NO}-${idx}`} className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 space-y-2.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                      isApproved ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'
                    }`}>
                      {isApproved ? (<><CheckCircle className="w-3 h-3 mr-0.5" />승인</>) : (<><XCircle className="w-3 h-3 mr-0.5" />미승인</>)}
                    </span>
                    {isSanctioned && (
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-700">실적확정</span>
                    )}
                    <span className="text-xs text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded">{getGubnName(record.GUBN_S)}</span>
                  </div>
                  <span className="text-xs text-gray-400">{record.DOC_DATE}</span>
                </div>

                <div className="flex items-start gap-2">
                  <span className="text-xs text-gray-500 w-8 flex-shrink-0 pt-0.5">계획</span>
                  <span className="text-sm text-gray-800 font-medium">{planDisplay}</span>
                </div>

                <div className="flex items-start gap-2">
                  <span className="text-xs text-gray-500 w-8 flex-shrink-0 pt-0.5">실적</span>
                  <span className={`text-sm ${hasActual ? 'text-gray-800 font-medium' : 'text-gray-400'}`}>{actualDisplay}</span>
                </div>

                {!isSanctioned && (
                  <button
                    onClick={() => openActualModal(record)}
                    disabled={!canInputActual}
                    className={`w-full py-2 rounded-lg text-sm transition-colors ${
                      canInputActual
                        ? 'bg-primary-50 text-primary-600 border border-primary-200 hover:bg-primary-100'
                        : 'bg-gray-50 text-gray-400 border border-gray-200 cursor-not-allowed'
                    }`}
                  >
                    {hasActual ? '실적 수정하기' : '실적 입력하기'}
                    {!isApproved && <span className="text-xs ml-1">(승인 후 가능)</span>}
                  </button>
                )}

                {record.REASON1 && (
                  <div className="flex items-start gap-2 pt-1 border-t border-gray-100">
                    <span className="text-xs text-gray-500 w-8 flex-shrink-0 pt-0.5">사유</span>
                    <span className="text-sm text-gray-600">{record.REASON1}</span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* ===== New Application Modal (center overlay) ===== */}
      {showApplyModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-[60] flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-lg rounded-xl max-h-[85vh] flex flex-col shadow-xl">
            <div className="flex-shrink-0 border-b border-gray-200 px-4 py-3 flex items-center justify-between">
              <h3 className="font-medium text-gray-800">시간외근무 신청</h3>
              <button onClick={() => setShowApplyModal(false)} className="p-1 text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              <div>
                <label className="block text-sm text-gray-600 mb-1">결재선</label>
                <div className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-500">-</div>
              </div>

              <div>
                <label className="block text-sm text-gray-600 mb-1">신청자</label>
                <div className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-700">
                  {userInfo?.userName || userInfo?.userId || '-'}
                </div>
              </div>

              <div>
                <label className="block text-sm text-gray-600 mb-1">구분</label>
                <div className="flex gap-2">
                  {gubnCodes.map(g => (
                    <button
                      key={g.GUBN_CODE}
                      onClick={() => setApplyForm(prev => ({ ...prev, gubn: g.GUBN_CODE }))}
                      className={`flex-1 py-2 rounded-lg text-sm border transition-colors ${
                        applyForm.gubn === g.GUBN_CODE
                          ? 'bg-primary-500 text-white border-primary-500'
                          : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'
                      }`}
                    >
                      {g.GUBN_NAME}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm text-gray-600 mb-1">근무일자</label>
                <div className="space-y-2">
                  <input
                    type="date"
                    value={applyForm.fromDate}
                    onChange={e => setApplyForm(prev => ({ ...prev, fromDate: e.target.value, toDate: e.target.value }))}
                    className="w-full px-2 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                  />
                  <div className="flex items-center gap-1.5">
                    <select value={applyForm.fromHour} onChange={e => setApplyForm(prev => ({ ...prev, fromHour: e.target.value }))} className="w-16 px-1 py-2 border border-gray-300 rounded-lg text-sm text-center">
                      {HOURS.map(h => <option key={h} value={h}>{h}</option>)}
                    </select>
                    <span className="text-gray-400">:</span>
                    <select value={applyForm.fromMinu} onChange={e => setApplyForm(prev => ({ ...prev, fromMinu: e.target.value }))} className="w-16 px-1 py-2 border border-gray-300 rounded-lg text-sm text-center">
                      {MINUTES.map(m => <option key={m} value={m}>{m}</option>)}
                    </select>
                    <span className="text-gray-400 mx-1">~</span>
                    <select value={applyForm.toHour} onChange={e => setApplyForm(prev => ({ ...prev, toHour: e.target.value }))} className="w-16 px-1 py-2 border border-gray-300 rounded-lg text-sm text-center">
                      {HOURS.map(h => <option key={h} value={h}>{h}</option>)}
                    </select>
                    <span className="text-gray-400">:</span>
                    <select value={applyForm.toMinu} onChange={e => setApplyForm(prev => ({ ...prev, toMinu: e.target.value }))} className="w-16 px-1 py-2 border border-gray-300 rounded-lg text-sm text-center">
                      {MINUTES.map(m => <option key={m} value={m}>{m}</option>)}
                    </select>
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-sm text-gray-600 mb-1">근무사유</label>
                <textarea
                  placeholder="근무사유를 입력해주세요."
                  rows={3}
                  value={applyForm.reason}
                  onChange={e => setApplyForm(prev => ({ ...prev, reason: e.target.value }))}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 resize-none"
                />
              </div>
            </div>

            <div className="flex-shrink-0 border-t border-gray-200 bg-white px-4 py-3 flex gap-3 rounded-b-xl">
              <button onClick={() => setShowApplyModal(false)} className="flex-1 py-2.5 border border-gray-300 text-gray-700 rounded-lg text-sm hover:bg-gray-50 transition-colors">
                닫기
              </button>
              <button onClick={handleApply} disabled={submitting} className="flex-1 py-2.5 bg-primary-500 text-white rounded-lg text-sm hover:bg-primary-600 disabled:bg-gray-400 transition-colors flex items-center justify-center gap-1">
                {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                상신
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ===== Actual Input Modal (center overlay) ===== */}
      {showActualModal && selectedRecord && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-[60] flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-lg rounded-xl max-h-[85vh] flex flex-col shadow-xl">
            <div className="flex-shrink-0 border-b border-gray-200 px-4 py-3 flex items-center justify-between">
              <h3 className="font-medium text-gray-800">실적 입력</h3>
              <button onClick={() => setShowActualModal(false)} className="p-1 text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              <div>
                <label className="block text-sm text-gray-600 mb-1">결재선</label>
                <div className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-500">-</div>
              </div>

              <div>
                <label className="block text-sm text-gray-600 mb-1">신청자</label>
                <div className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-700">
                  {userInfo?.userName || userInfo?.userId || '-'}
                </div>
              </div>

              <div>
                <label className="block text-sm text-gray-600 mb-1">구분</label>
                <div className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-700">
                  {getGubnName(selectedRecord.GUBN_S)}
                </div>
              </div>

              <div>
                <label className="block text-sm text-gray-600 mb-1">계획일자</label>
                <div className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-700">
                  {formatTimeRange(
                    selectedRecord.FROM_DATE1_PLAN, selectedRecord.FROM_HOUR1_PLAN, selectedRecord.FROM_MINU1_PLAN,
                    selectedRecord.TO_DATE1_PLAN, selectedRecord.TO_HOUR1_PLAN, selectedRecord.TO_MINU1_PLAN
                  )}
                </div>
              </div>

              <div>
                <label className="block text-sm text-gray-600 mb-1">근무일자 (실적)</label>
                <div className="space-y-2">
                  <input
                    type="date"
                    value={actualForm.fromDate}
                    onChange={e => setActualForm(prev => ({ ...prev, fromDate: e.target.value, toDate: e.target.value }))}
                    className="w-full px-2 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                  />
                  <div className="flex items-center gap-1.5">
                    <select value={actualForm.fromHour} onChange={e => setActualForm(prev => ({ ...prev, fromHour: e.target.value }))} className="w-16 px-1 py-2 border border-gray-300 rounded-lg text-sm text-center">
                      {HOURS.map(h => <option key={h} value={h}>{h}</option>)}
                    </select>
                    <span className="text-gray-400">:</span>
                    <select value={actualForm.fromMinu} onChange={e => setActualForm(prev => ({ ...prev, fromMinu: e.target.value }))} className="w-16 px-1 py-2 border border-gray-300 rounded-lg text-sm text-center">
                      {MINUTES.map(m => <option key={m} value={m}>{m}</option>)}
                    </select>
                    <span className="text-gray-400 mx-1">~</span>
                    <select value={actualForm.toHour} onChange={e => setActualForm(prev => ({ ...prev, toHour: e.target.value }))} className="w-16 px-1 py-2 border border-gray-300 rounded-lg text-sm text-center">
                      {HOURS.map(h => <option key={h} value={h}>{h}</option>)}
                    </select>
                    <span className="text-gray-400">:</span>
                    <select value={actualForm.toMinu} onChange={e => setActualForm(prev => ({ ...prev, toMinu: e.target.value }))} className="w-16 px-1 py-2 border border-gray-300 rounded-lg text-sm text-center">
                      {MINUTES.map(m => <option key={m} value={m}>{m}</option>)}
                    </select>
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-sm text-gray-600 mb-1">근무사유</label>
                <textarea
                  placeholder="근무사유를 입력해주세요."
                  rows={3}
                  value={actualForm.reason}
                  onChange={e => setActualForm(prev => ({ ...prev, reason: e.target.value }))}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 resize-none"
                />
              </div>
            </div>

            <div className="flex-shrink-0 border-t border-gray-200 bg-white px-4 py-3 flex gap-3 rounded-b-xl">
              <button onClick={() => setShowActualModal(false)} className="flex-1 py-2.5 border border-gray-300 text-gray-700 rounded-lg text-sm hover:bg-gray-50 transition-colors">
                닫기
              </button>
              <button onClick={handleSaveActual} disabled={savingActual} className="flex-1 py-2.5 bg-primary-500 text-white rounded-lg text-sm hover:bg-primary-600 disabled:bg-gray-400 transition-colors flex items-center justify-center gap-1">
                {savingActual ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                저장
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ===== Result Popup ===== */}
      {resultPopup.show && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[70] p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-sm w-full p-5 space-y-4">
            <div className={`flex items-center gap-2 ${resultPopup.type === 'success' ? 'text-green-600' : 'text-red-600'}`}>
              {resultPopup.type === 'success' ? <CheckCircle className="w-6 h-6" /> : <AlertCircle className="w-6 h-6" />}
              <span className="font-semibold text-lg">{resultPopup.title}</span>
            </div>
            <p className="text-gray-700 text-sm whitespace-pre-wrap">{resultPopup.message}</p>
            <button
              onClick={() => setResultPopup(prev => ({ ...prev, show: false }))}
              className={`w-full py-2.5 rounded-lg text-sm font-medium transition-colors ${
                resultPopup.type === 'success'
                  ? 'bg-green-500 text-white hover:bg-green-600'
                  : 'bg-red-500 text-white hover:bg-red-600'
              }`}
            >
              확인
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
