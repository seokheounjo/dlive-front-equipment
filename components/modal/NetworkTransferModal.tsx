import React, { useState, useEffect } from 'react';
import { getUplsCtrtInfo } from '../../services/certifyApiService';
import { getLguMangReq, getLguMangRslt, getUplsNwtbDetail, getUplsApiReq, saveLguMangReq } from '../../services/certifyApiService';

interface NetworkTransferModalProps {
  isOpen: boolean;
  onClose: () => void;
  item: any;
  userId?: string;
  showToast?: (message: string, type: 'success' | 'error' | 'warning' | 'info') => void;
}

const NetworkTransferModal: React.FC<NetworkTransferModalProps> = ({
  isOpen,
  onClose,
  item,
  userId,
  showToast,
}) => {
  const [isLoading, setIsLoading] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [entrNo, setEntrNo] = useState('');
  const [reqList, setReqList] = useState<any[]>([]);
  const [rsltList, setRsltList] = useState<any[]>([]);
  const [selectedReqIdx, setSelectedReqIdx] = useState<number>(-1);
  const [nwtbDetail, setNwtbDetail] = useState<any>(null);

  // Memo fields (legacy: tx_memo_11 ~ tx_memo_14)
  const [memoInstlLoc, setMemoInstlLoc] = useState('');
  const [memoEqtCheck, setMemoEqtCheck] = useState('');
  const [memoSignalCheck, setMemoSignalCheck] = useState('');
  const [memoRequest, setMemoRequest] = useState('');

  const CTRT_ID = item?.CTRT_ID || '';
  const WRK_ID = item?.WRK_ID || item?.id || '';
  const WRK_CD = item?.WRK_CD || '';
  const RCPT_ID = item?.RCPT_ID || '';

  useEffect(() => {
    if (isOpen && CTRT_ID) {
      loadData();
    }
    return () => {
      // Reset state on close
      if (!isOpen) {
        setReqList([]);
        setRsltList([]);
        setSelectedReqIdx(-1);
        setNwtbDetail(null);
        setMemoInstlLoc('');
        setMemoEqtCheck('');
        setMemoSignalCheck('');
        setMemoRequest('');
      }
    };
  }, [isOpen, CTRT_ID]);

  const loadData = async () => {
    setIsLoading(true);
    try {
      // Step 1: Get ENTR_NO from CTRT_ID
      const ctrtInfo = await getUplsCtrtInfo({ CTRT_ID });
      const fetchedEntrNo = ctrtInfo?.[0]?.ENTR_NO || '';
      setEntrNo(fetchedEntrNo);

      if (!fetchedEntrNo) {
        if (showToast) showToast('ENTR_NO(가입자번호)를 조회할 수 없습니다.', 'error');
        setIsLoading(false);
        return;
      }

      // Step 2: Get LGU+ management request list
      const requests = await getLguMangReq({ ENTR_NO: fetchedEntrNo });
      setReqList(requests);

      // Step 3: Get NWTB detail (if WRK_ID exists)
      if (WRK_ID) {
        const detail = await getUplsNwtbDetail({ WRK_ID, WRK_CD });
        setNwtbDetail(detail);
      }
    } catch (error) {
      console.error('[NetworkTransfer] loadData error:', error);
      if (showToast) showToast('망이관 정보 조회에 실패했습니다.', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const handleReqRowClick = async (idx: number) => {
    setSelectedReqIdx(idx);
    const selectedReq = reqList[idx];
    if (!selectedReq?.TLRCPTID || !entrNo) return;

    try {
      const results = await getLguMangRslt({
        ENTR_NO: entrNo,
        TLRCPTID: selectedReq.TLRCPTID,
      });
      setRsltList(results);
    } catch (error) {
      console.error('[NetworkTransfer] getLguMangRslt error:', error);
      setRsltList([]);
    }
  };

  const handleSend = async () => {
    if (!RCPT_ID && !WRK_ID) {
      if (showToast) showToast('접수 정보가 없습니다.', 'warning');
      return;
    }

    if (!entrNo) {
      if (showToast) showToast('가입자번호가 없습니다.', 'error');
      return;
    }

    // 레거시 동일: RCPT_ID 중복 이관 체크
    const alreadyTransferred = reqList.some(req => req.RCPT_ID === RCPT_ID);
    if (alreadyTransferred) {
      if (!window.confirm('이미 이관처리 하였습니다.\n그래도 LGU에 망장애이관을 하시겠습니까?')) {
        return;
      }
    } else {
      if (!window.confirm('LGU에 망장애이관을 하시겠습니까?')) {
        return;
      }
    }

    // Build memo string (레거시 동일 포맷: 한국어 키-값 형태)
    const now = new Date();
    const dateFormatted = `${now.getFullYear()}년${String(now.getMonth() + 1).padStart(2, '0')}월${String(now.getDate()).padStart(2, '0')}일${String(now.getHours()).padStart(2, '0')}시${String(now.getMinutes()).padStart(2, '0')}분`;

    // 레거시 동일: 방문요청시간 RCPT_DTTM 포맷팅
    const rcptDttm = nwtbDetail?.RCPT_DTTM || '';
    let rcptDttmFormatted = '';
    if (rcptDttm.length >= 12) {
      rcptDttmFormatted = `${rcptDttm.substring(0,4)}년${rcptDttm.substring(4,6)}월${rcptDttm.substring(6,8)}일${rcptDttm.substring(8,10)}시${rcptDttm.substring(10,12)}분`;
    }

    // 레거시 동일: 고객명 마스킹
    const usrNm = nwtbDetail?.USR_NM || '';
    const maskedName = usrNm.length > 1 ? usrNm[0] + '*'.repeat(usrNm.length - 1) : usrNm;

    let memo = '';
    memo += `접수처리일시:${dateFormatted}\n`;
    memo += `고객명:디라이브\n`;
    memo += `가입번호:${entrNo}\n`;
    memo += `고객주소:${nwtbDetail?.ADDR || ''}\n`;
    memo += `서비스권역:${nwtbDetail?.SO_NM || ''}\n`;
    memo += `고객연락처:${maskedName},${nwtbDetail?.TEL_NO2 || ''}\n`;
    memo += `방문요청시간:${rcptDttmFormatted}\n`;
    memo += `사용중인상품:${nwtbDetail?.PROD_NM || ''}\n`;
    memo += `사용중인장비:${nwtbDetail?.EQT_LIST || ''}\n`;
    memo += `설치위치:${memoInstlLoc}\n`;
    memo += `장비검사:${memoEqtCheck}\n`;
    memo += `인터넷속도(검사):${memoSignalCheck}\n`;
    memo += `요청사항:${memoRequest}`;

    setIsSending(true);
    try {
      // Step 1: Send to NTOSS (레거시 동일: getUplsApiReq)
      const apiResult = await getUplsApiReq({
        COMMAND: 'lghvNwtbWorkDcl',
        CTRT_ID,
        entrNo,
        memo,
      });

      // Extract response fields (레거시: camelCase 필드명)
      const resultData = Array.isArray(apiResult) ? apiResult[0] : apiResult;
      const tlrcptid = resultData?.TLRCPTID || resultData?.tlRcptId || resultData?.tlrcptid || '';
      const prssRsltCd = resultData?.PRSSRSLTCD || resultData?.prssRsltCd || '';
      const logId = resultData?.LOGID || resultData?.logId || '';
      const errCd = resultData?.ERRCD || resultData?.errCd || '';
      const resMsg = resultData?.RES_MSG || resultData?.msg || resultData?.resultMsg || '';
      const apiSeq = resultData?.API_SEQ || resultData?.api_seq || '';

      if (!tlrcptid) {
        const resultCd = resultData?.resultCd || '';
        const resultMsg = resultData?.resultMsg || '';
        if (showToast) showToast(`[${resultCd}] ${resultMsg || 'NTOSS 접수ID를 받지 못했습니다.'}`, 'error');
        setIsSending(false);
        return;
      }

      // Step 2: Save to DLIVE DB (레거시 동일: 15개 파라미터)
      let regUid = userId || '';
      try {
        const stored = localStorage.getItem('userInfo');
        if (stored) {
          const parsed = JSON.parse(stored);
          regUid = regUid || parsed.userId || '';
        }
      } catch (e) { /* ignore */ }

      await saveLguMangReq({
        RCPT_ID,
        CTRT_ID,
        WRK_ID,
        ENTR_NO: entrNo,
        ENTR_RQST_NO: '',
        REQ_TEXT: '',
        TLRCPTID: tlrcptid,
        PRSSRSLTCD: prssRsltCd,
        LOGID: logId,
        ERRCD: errCd,
        RES_MSG: resMsg,
        API_SEQ: apiSeq,
        REG_UID: regUid,
        BIGO: '',
        NOTE: '',
        API_MEMO: memo,
      });

      if (showToast) showToast('망이관 요청이 전송되었습니다.', 'success');

      // Refresh request list + auto-click first row (레거시 동일)
      const requests = await getLguMangReq({ ENTR_NO: entrNo });
      setReqList(requests);
      setRsltList([]);
      setSelectedReqIdx(-1);
      if (requests.length > 0) {
        handleReqRowClick(0);
      }

      // Clear memo fields (레거시 동일: div_memo_btn_memo_close)
      setMemoInstlLoc('');
      setMemoEqtCheck('');
      setMemoSignalCheck('');
      setMemoRequest('');
    } catch (error: any) {
      console.error('[NetworkTransfer] handleSend error:', error);
      if (showToast) showToast(`망이관 요청 실패: ${error.message || '알 수 없는 오류'}`, 'error');
    } finally {
      setIsSending(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div
        className="bg-white rounded-xl shadow-2xl w-[95vw] max-w-lg max-h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 bg-indigo-500 rounded-t-xl">
          <h2 className="text-base font-bold text-white">망이관 (LGU+ 망장애 이관)</h2>
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
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-500"></div>
              <span className="ml-3 text-sm text-gray-600">조회 중...</span>
            </div>
          ) : (
            <>
              {/* Info */}
              <div className="text-xs text-gray-500 space-y-1">
                <div>가입자번호: <span className="font-medium text-gray-700">{entrNo || '-'}</span></div>
                <div>계약ID: <span className="font-medium text-gray-700">{CTRT_ID}</span></div>
              </div>

              {/* Request List Grid */}
              <div>
                <h3 className="text-sm font-semibold text-gray-800 mb-2">접수 요청 목록</h3>
                <div className="border border-gray-200 rounded-lg overflow-hidden">
                  <div className="grid grid-cols-4 bg-gray-50 text-xs font-medium text-gray-600 px-2 py-1.5 border-b">
                    <span>등록일자</span>
                    <span>등록자</span>
                    <span>처리상태</span>
                    <span>NTOSS접수ID</span>
                  </div>
                  <div className="max-h-32 overflow-y-auto">
                    {reqList.length === 0 ? (
                      <div className="text-xs text-gray-400 text-center py-3">조회된 데이터가 없습니다.</div>
                    ) : (
                      reqList.map((req, idx) => (
                        <div
                          key={idx}
                          onClick={() => handleReqRowClick(idx)}
                          className={`grid grid-cols-4 text-xs px-2 py-1.5 cursor-pointer border-b border-gray-50 ${
                            selectedReqIdx === idx ? 'bg-indigo-50' : 'hover:bg-gray-50'
                          }`}
                        >
                          <span className="truncate">{req.REG_DATE || '-'}</span>
                          <span className="truncate">{req.REG_UID_NM || '-'}</span>
                          <span className="truncate">{req.RES_MSG || '-'}</span>
                          <span className="truncate">{req.TLRCPTID || '-'}</span>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>

              {/* Result List Grid */}
              {rsltList.length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold text-gray-800 mb-2">처리 결과</h3>
                  <div className="border border-gray-200 rounded-lg overflow-hidden">
                    <div className="grid grid-cols-5 bg-gray-50 text-xs font-medium text-gray-600 px-2 py-1.5 border-b">
                      <span>순번</span>
                      <span>상태</span>
                      <span>처리내용</span>
                      <span>등록일시</span>
                      <span>NTOSS접수ID</span>
                    </div>
                    <div className="max-h-32 overflow-y-auto">
                      {rsltList.map((rslt, idx) => (
                        <div key={idx} className="grid grid-cols-5 text-xs px-2 py-1.5 border-b border-gray-50">
                          <span className="truncate">{rslt.TLPGRSSNO || '-'}</span>
                          <span className="truncate">{rslt.TLPGRSSTUSCD_NM || '-'}</span>
                          <span className="truncate">{rslt.TLPGRSCNTN || '-'}</span>
                          <span className="truncate">{rslt.REG_DATE || '-'}</span>
                          <span className="truncate">{rslt.TLRCPTID || '-'}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* Memo Input Panel */}
              {WRK_ID && (
                <div>
                  <h3 className="text-sm font-semibold text-gray-800 mb-2">요청 메모</h3>
                  <div className="space-y-2">
                    <div>
                      <label className="text-xs text-gray-600 mb-0.5 block">설치위치</label>
                      <textarea
                        value={memoInstlLoc}
                        onChange={(e) => setMemoInstlLoc(e.target.value.slice(0, 100))}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm resize-none focus:ring-2 focus:ring-indigo-300 focus:border-indigo-400"
                        rows={2}
                        maxLength={100}
                        placeholder="설치위치 입력"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-gray-600 mb-0.5 block">장비점검</label>
                      <textarea
                        value={memoEqtCheck}
                        onChange={(e) => setMemoEqtCheck(e.target.value.slice(0, 100))}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm resize-none focus:ring-2 focus:ring-indigo-300 focus:border-indigo-400"
                        rows={2}
                        maxLength={100}
                        placeholder="장비점검 내용 입력"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-gray-600 mb-0.5 block">인터넷속도(검사)</label>
                      <textarea
                        value={memoSignalCheck}
                        onChange={(e) => setMemoSignalCheck(e.target.value.slice(0, 100))}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm resize-none focus:ring-2 focus:ring-indigo-300 focus:border-indigo-400"
                        rows={2}
                        maxLength={100}
                        placeholder="인터넷속도(검사) 결과 입력"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-gray-600 mb-0.5 block">요청사항</label>
                      <textarea
                        value={memoRequest}
                        onChange={(e) => setMemoRequest(e.target.value.slice(0, 100))}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm resize-none focus:ring-2 focus:ring-indigo-300 focus:border-indigo-400"
                        rows={2}
                        maxLength={100}
                        placeholder="요청사항 입력"
                      />
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="flex gap-2 px-4 py-3 border-t border-gray-200">
          {WRK_ID && (
            <button
              onClick={handleSend}
              disabled={isSending || isLoading || !entrNo}
              className="flex-1 py-2.5 rounded-lg bg-indigo-500 hover:bg-indigo-600 text-white text-sm font-semibold transition-colors disabled:bg-gray-400 disabled:text-white disabled:cursor-not-allowed"
            >
              {isSending ? '전송 중...' : '요청 전송'}
            </button>
          )}
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

export default NetworkTransferModal;
