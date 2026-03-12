import React, { useState, useEffect, useCallback } from 'react';
import {
  getAsRcptEqtStatInfo,
  getCntFMSSession,
  getCntFMSSession2,
  callEqtStatReqIns4ASRcpt,
  getEqtStatInfo,
} from '../../services/certifyApiService';

interface EquipmentStatusModalProps {
  isOpen: boolean;
  onClose: () => void;
  item: any;
  userId?: string;
  showToast?: (message: string, type: 'success' | 'error' | 'warning' | 'info') => void;
}

const MAX_FMS_SESSION = 20;
const MAX_FMS_LOCK = 10;

// PING_RESPONSE based status determination (legacy logic)
const determineEqtStat = (row: any): string => {
  if (!row.CMPL_DTTM) {
    if (row.MAC_ADDRESS) return '응답대기(FMS)';
    return '';
  }
  const pingResponse = parseInt(row.PING_RESPONSE, 10);
  if (isNaN(pingResponse)) return '통신불가';
  if (pingResponse === -1) {
    if (!row.CM_IP_ADDRESS) return '장비OFF';
    return '장비ON-Ping무응답';
  }
  if (pingResponse <= 100) return '정상';
  if (pingResponse > 100) return '비정상';
  return '통신불가';
};

const getStatusColor = (stat: string): string => {
  if (stat === '정상' || stat === '') return 'text-blue-600';
  return 'text-red-600';
};

const getResetResultColor = (result: string): string => {
  if (result === '성공') return 'text-blue-600';
  if (result === '실패') return 'text-red-600';
  return 'text-gray-700';
};

const EquipmentStatusModal: React.FC<EquipmentStatusModalProps> = ({
  isOpen,
  onClose,
  item,
  userId,
  showToast,
}) => {
  const [isLoading, setIsLoading] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const [statusData, setStatusData] = useState<any[]>([]);
  const [selectedIdx, setSelectedIdx] = useState(0);
  const [fmsError, setFmsError] = useState(false);

  // Cable product uses service group combo
  const prodGrp = item?.PROD_GRP || '';
  const kpiProdGrpCd = item?.KPI_PROD_GRP_CD || '';
  const isCable = prodGrp === 'C';

  // Service group options for Cable
  const [svcGroups, setSvcGroups] = useState<{ code: string; name: string }[]>([]);
  const [selectedSvcGrp, setSelectedSvcGrp] = useState('');

  const CTRT_ID = item?.CTRT_ID || '';
  const RCPT_ID = item?.RCPT_ID || '';

  useEffect(() => {
    if (isOpen && CTRT_ID) {
      // Setup service groups for Cable
      if (isCable) {
        if (kpiProdGrpCd === 'C') {
          setSvcGroups([{ code: 'I', name: 'ISP' }]);
          setSelectedSvcGrp('I');
        } else {
          setSvcGroups([
            { code: 'D', name: 'DTV' },
            { code: 'I', name: 'ISP' },
          ]);
          setSelectedSvcGrp('D');
        }
      }
      loadEquipmentStatus();
    }
    return () => {
      if (!isOpen) {
        setStatusData([]);
        setSelectedIdx(0);
        setFmsError(false);
      }
    };
  }, [isOpen, CTRT_ID]);

  const checkFmsLoad = async (): Promise<boolean> => {
    try {
      const [sessionCount, lockCount] = await Promise.all([
        getCntFMSSession(),
        getCntFMSSession2(),
      ]);
      console.log('[EqtStatus] FMS session:', sessionCount, 'lock:', lockCount);
      if (sessionCount >= MAX_FMS_SESSION || lockCount >= MAX_FMS_LOCK) {
        if (showToast) showToast('FMS 시스템 부하가 높아 장비상태 조회가 불가합니다. 잠시 후 다시 시도해주세요.', 'warning');
        setFmsError(true);
        return false;
      }
      setFmsError(false);
      return true;
    } catch (error) {
      console.error('[EqtStatus] FMS check error:', error);
      // If FMS check fails, allow the query to proceed
      return true;
    }
  };

  const loadEquipmentStatus = async () => {
    setIsLoading(true);
    try {
      const fmsOk = await checkFmsLoad();
      if (!fmsOk) {
        setIsLoading(false);
        return;
      }

      // First check for cached FMS data
      const data = await getAsRcptEqtStatInfo({
        CTRT_ID,
        RCPT_ID,
      });

      if (data.length > 0) {
        // Cached data exists
        const enrichedData = data.map((row: any) => ({
          ...row,
          EQT_STAT: determineEqtStat(row),
        }));
        setStatusData(enrichedData);
      } else {
        // No cached data - request fresh FMS data automatically
        console.log('[EqtStatus] No cached data, requesting fresh FMS data...');
        const freshData = await callEqtStatReqIns4ASRcpt({
          USER_ID: userId || '',
          WRK_ACT_CL: '20',
          RCPT_ID,
          CTRT_ID,
          RESET_YN: ' ',
          CM_IP_ADDRESS: ' ',
          REQ_PING_YN: ' ',
          SVC_GRP: ' ',
        });
        const enrichedData = freshData.map((row: any) => ({
          ...row,
          EQT_STAT: determineEqtStat(row),
        }));
        setStatusData(enrichedData);
      }
      setSelectedIdx(0);
    } catch (error) {
      console.error('[EqtStatus] loadEquipmentStatus error:', error);
      if (showToast) showToast('장비상태 조회에 실패했습니다.', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const handleRefresh = async () => {
    setIsLoading(true);
    try {
      const fmsOk = await checkFmsLoad();
      if (!fmsOk) {
        setIsLoading(false);
        return;
      }

      const data = await callEqtStatReqIns4ASRcpt({
        USER_ID: userId || '',
        WRK_ACT_CL: '20',
        RCPT_ID,
        CTRT_ID,
        RESET_YN: ' ',
        CM_IP_ADDRESS: ' ',
        REQ_PING_YN: ' ',
        SVC_GRP: ' ',
      });

      const enrichedData = data.map((row: any) => ({
        ...row,
        EQT_STAT: determineEqtStat(row),
      }));

      setStatusData(enrichedData);
      if (showToast) showToast('장비상태를 다시 조회했습니다.', 'success');
    } catch (error: any) {
      console.error('[EqtStatus] handleRefresh error:', error);
      if (showToast) showToast(`장비상태 조회 실패: ${error.message || ''}`, 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const handleReset = async () => {
    if (statusData.length === 0) return;

    const current = getDisplayRow();
    if (!current) return;

    // Reset enable conditions (legacy)
    if (current.EQT_STAT !== '정상') {
      if (showToast) showToast('장비 상태가 "정상"일 때만 리셋이 가능합니다.', 'warning');
      return;
    }
    if (!current.CM_IP_ADDRESS) {
      if (showToast) showToast('CM IP 주소가 없어 리셋이 불가합니다.', 'warning');
      return;
    }
    if (current.RESET_REQ_DTTM) {
      if (showToast) showToast('이미 리셋 요청이 진행 중입니다.', 'warning');
      return;
    }

    setIsResetting(true);
    try {
      const fmsOk = await checkFmsLoad();
      if (!fmsOk) {
        setIsResetting(false);
        return;
      }

      const data = await callEqtStatReqIns4ASRcpt({
        USER_ID: userId || '',
        WRK_ACT_CL: '20',
        RCPT_ID,
        CTRT_ID: current.CTRT_ID || CTRT_ID,
        RESET_YN: 'Y',
        CM_IP_ADDRESS: statusData[0]?.CM_IP_ADDRESS || '',
        REQ_PING_YN: 'N',
        SVC_GRP: current.SVC_GRP || '',
      });

      const enrichedData = data.map((row: any) => ({
        ...row,
        EQT_STAT: determineEqtStat(row),
      }));

      setStatusData(enrichedData);
      if (showToast) showToast('장비 리셋 요청을 전송했습니다.', 'success');
    } catch (error: any) {
      console.error('[EqtStatus] handleReset error:', error);
      if (showToast) showToast(`장비 리셋 실패: ${error.message || ''}`, 'error');
    } finally {
      setIsResetting(false);
    }
  };

  const getDisplayRow = useCallback(() => {
    if (statusData.length === 0) return null;
    if (!isCable) return statusData[0] || null;
    // Cable: find row matching selected service group
    const idx = statusData.findIndex((r: any) => r.SVC_GRP === selectedSvcGrp);
    return idx >= 0 ? statusData[idx] : statusData[0];
  }, [statusData, isCable, selectedSvcGrp]);

  const canReset = useCallback(() => {
    const row = getDisplayRow();
    if (!row) return false;
    return row.EQT_STAT === '정상' && !!row.CM_IP_ADDRESS && !row.RESET_REQ_DTTM;
  }, [getDisplayRow]);

  if (!isOpen) return null;

  const displayRow = getDisplayRow();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div
        className="bg-white rounded-xl shadow-2xl w-[95vw] max-w-lg max-h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 bg-teal-500 rounded-t-xl">
          <h2 className="text-base font-bold text-white">장비상태정보 (A/S)</h2>
          <button onClick={onClose} className="text-white/80 hover:text-white">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {isLoading ? (
            <div className="flex items-center justify-center py-10">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-teal-500"></div>
              <span className="ml-3 text-sm text-gray-600">조회 중...</span>
            </div>
          ) : fmsError ? (
            <div className="text-center py-8">
              <div className="text-amber-500 text-4xl mb-3">&#9888;</div>
              <p className="text-sm text-gray-700 font-medium mb-2">FMS 시스템 부하 초과</p>
              <p className="text-xs text-gray-500">잠시 후 다시 시도해주세요.</p>
              <button
                onClick={handleRefresh}
                className="mt-4 px-4 py-2 rounded-lg bg-teal-500 text-white text-sm font-medium hover:bg-teal-600 transition-colors"
              >
                재시도
              </button>
            </div>
          ) : (
            <>
              {/* Cable: Service Group Selector */}
              {isCable && svcGroups.length > 0 && (
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-600 font-medium">서비스:</span>
                  <select
                    value={selectedSvcGrp}
                    onChange={(e) => setSelectedSvcGrp(e.target.value)}
                    className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:ring-2 focus:ring-teal-300"
                  >
                    {svcGroups.map((grp) => (
                      <option key={grp.code} value={grp.code}>{grp.name}</option>
                    ))}
                  </select>
                </div>
              )}

              {/* Status Display */}
              {displayRow ? (
                <div className="space-y-3">
                  {/* Equipment Status */}
                  <div className="bg-gray-50 rounded-lg p-3 border border-gray-200">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs text-gray-500">장비상태</span>
                      <span className={`text-sm font-bold ${getStatusColor(displayRow.EQT_STAT)}`}>
                        {displayRow.EQT_STAT || '-'}
                      </span>
                    </div>
                    {displayRow.SVC_GRP_NM && (
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs text-gray-500">서비스</span>
                        <span className="text-xs text-gray-700">{displayRow.SVC_GRP_NM}</span>
                      </div>
                    )}
                  </div>

                  {/* Signal Info Grid */}
                  <div className="bg-white rounded-lg border border-gray-200">
                    <div className="grid grid-cols-2 gap-px bg-gray-200">
                      <div className="bg-white p-2">
                        <span className="text-[0.625rem] text-gray-500 block">PING응답시간(ms)</span>
                        <span className="text-xs font-medium text-gray-800">{displayRow.PING_RESPONSE ?? '-'}</span>
                      </div>
                      <div className="bg-white p-2">
                        <span className="text-[0.625rem] text-gray-500 block">CM IP</span>
                        <span className="text-xs font-medium text-gray-800">{displayRow.CM_IP_ADDRESS || '-'}</span>
                      </div>
                      <div className="bg-white p-2">
                        <span className="text-[0.625rem] text-gray-500 block">하향파워(dB)</span>
                        <span className="text-xs font-medium text-gray-800">{displayRow.DS_PWR ?? '-'}</span>
                      </div>
                      <div className="bg-white p-2">
                        <span className="text-[0.625rem] text-gray-500 block">하향SNR(dB)</span>
                        <span className="text-xs font-medium text-gray-800">{displayRow.DS_SNR ?? '-'}</span>
                      </div>
                      <div className="bg-white p-2">
                        <span className="text-[0.625rem] text-gray-500 block">상향파워(dB)</span>
                        <span className="text-xs font-medium text-gray-800">{displayRow.US_PWR ?? '-'}</span>
                      </div>
                      <div className="bg-white p-2">
                        <span className="text-[0.625rem] text-gray-500 block">상향SNR(dB)</span>
                        <span className="text-xs font-medium text-gray-800">{displayRow.US_SNR ?? '-'}</span>
                      </div>
                      <div className="bg-white p-2">
                        <span className="text-[0.625rem] text-gray-500 block">MAC 주소</span>
                        <span className="text-xs font-medium text-gray-800">{displayRow.MAC_ADDRESS || '-'}</span>
                      </div>
                      <div className="bg-white p-2">
                        <span className="text-[0.625rem] text-gray-500 block">PING손실율(%)</span>
                        <span className="text-xs font-medium text-gray-800">{displayRow.PING_LOSS ?? '-'}</span>
                      </div>
                    </div>
                  </div>

                  {/* Reset Section */}
                  <div className="bg-gray-50 rounded-lg p-3 border border-gray-200">
                    <h4 className="text-xs font-semibold text-gray-700 mb-2">장비 리셋</h4>
                    <div className="space-y-1 mb-2">
                      <div className="flex items-center justify-between">
                        <span className="text-[0.625rem] text-gray-500">리셋요청시간</span>
                        <span className="text-xs text-gray-700">{displayRow.RESET_REQ_DTTM || '-'}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-[0.625rem] text-gray-500">리셋처리시간</span>
                        <span className="text-xs text-gray-700">{displayRow.RESET_CMPL_DTTM || '-'}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-[0.625rem] text-gray-500">리셋결과</span>
                        <span className={`text-xs font-medium ${getResetResultColor(displayRow.RESET_RSLT || '')}`}>
                          {displayRow.RESET_RSLT || '-'}
                        </span>
                      </div>
                    </div>
                    <button
                      onClick={handleReset}
                      disabled={isResetting || !canReset()}
                      className="w-full py-2 rounded-lg bg-orange-500 hover:bg-orange-600 text-white text-xs font-semibold transition-colors disabled:bg-gray-400 disabled:text-white disabled:cursor-not-allowed"
                    >
                      {isResetting ? '리셋 요청 중...' : '장비리셋요청'}
                    </button>
                  </div>

                  {/* Full Data Grid */}
                  {statusData.length > 1 && (
                    <div>
                      <h4 className="text-xs font-semibold text-gray-700 mb-2">전체 장비 목록</h4>
                      <div className="border border-gray-200 rounded-lg overflow-hidden">
                        <div className="grid grid-cols-4 bg-gray-50 text-[0.625rem] font-medium text-gray-600 px-2 py-1.5 border-b">
                          <span>서비스</span>
                          <span>장비상태</span>
                          <span>PING(ms)</span>
                          <span>CM IP</span>
                        </div>
                        <div className="max-h-40 overflow-y-auto">
                          {statusData.map((row, idx) => (
                            <div
                              key={idx}
                              onClick={() => {
                                setSelectedIdx(idx);
                                if (isCable && row.SVC_GRP) setSelectedSvcGrp(row.SVC_GRP);
                              }}
                              className={`grid grid-cols-4 text-[0.625rem] px-2 py-1.5 cursor-pointer border-b border-gray-50 ${
                                selectedIdx === idx ? 'bg-teal-50' : 'hover:bg-gray-50'
                              }`}
                            >
                              <span>{row.SVC_GRP_NM || '-'}</span>
                              <span className={getStatusColor(row.EQT_STAT)}>{row.EQT_STAT || '-'}</span>
                              <span>{row.PING_RESPONSE ?? '-'}</span>
                              <span className="truncate">{row.CM_IP_ADDRESS || '-'}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-center py-8">
                  <p className="text-sm text-gray-500">장비상태 데이터가 없습니다.</p>
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="flex gap-2 px-4 py-3 border-t border-gray-200">
          <button
            onClick={handleRefresh}
            disabled={isLoading}
            className="flex-1 py-2.5 rounded-lg bg-teal-500 hover:bg-teal-600 text-white text-sm font-semibold transition-colors disabled:bg-gray-400 disabled:text-white disabled:cursor-not-allowed"
          >
            {isLoading ? '조회 중...' : '새로고침'}
          </button>
          <button
            onClick={onClose}
            className="flex-1 py-2.5 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm font-semibold transition-colors"
          >
            닫기
          </button>
        </div>
      </div>
    </div>
  );
};

export default EquipmentStatusModal;
