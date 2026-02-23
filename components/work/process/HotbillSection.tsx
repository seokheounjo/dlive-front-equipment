import React, { useState, useEffect } from 'react';
import {
  getHotbillSummary,
  HotbillSummary,
  runHotbillSimulation,
  getHotbillByContract,
  getHotbillByCharge,
  HotbillChargeItem
} from '../../../services/apiService';

interface HotbillSectionProps {
  custId: string;
  rcptId: string;
  ctrtId?: string;
  soId?: string;
  termHopeDt?: string;  // 해지희망일 (TERM_HOPE_DT)
  wrkCd?: string;
  wrkStatCd?: string;  // 작업상태코드 (7이면 핫빌 영역 숨김)
  showToast?: (message: string, type: 'success' | 'error' | 'warning' | 'info') => void;
  onHotbillConfirmChange?: (confirmed: boolean) => void;  // 핫빌 확인 상태 콜백
  onSimulatingChange?: (simulating: boolean) => void;  // 시뮬레이션 진행 상태 콜백
  readOnly?: boolean;  // 읽기 전용 모드 (완료된 작업)
}

/**
 * 해지요금(핫빌) 섹션
 *
 * 레거시 참조: mocir23m01.xml - getSimurationBillInfo()
 *
 * 조건: WRK_CD === '02' && WRK_STAT_CD !== '7' 일 때만 표시
 *
 * 케이스:
 * 1. 정상 케이스 (재계산 불필요)
 *    - 핫빌 이력 있음 + 오늘 === 해지희망일
 *    - "핫빌 확인" 체크박스만 표시
 *
 * 2. 재계산 필요 케이스
 *    - 핫빌 이력 없음 OR 해지희망일이 오늘보다 미래
 *    - 2가지 옵션 제공:
 *      2.1 핫빌 재계산 버튼 → 완료 후 "핫빌 재계산 확인" 체크박스
 *      2.2 "핫빌 재계산 미진행" 체크박스
 */
const HotbillSection: React.FC<HotbillSectionProps> = ({
  custId,
  rcptId,
  ctrtId,
  soId,
  termHopeDt,
  wrkCd,
  wrkStatCd,
  showToast,
  onHotbillConfirmChange,
  onSimulatingChange,
  readOnly = false
}) => {
  const [summary, setSummary] = useState<HotbillSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [simulating, setSimulating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 청구항목별 상세 (getHotbillDtlbyCharge_ForM)
  const [chargeItems, setChargeItems] = useState<HotbillChargeItem[]>([]);
  const [chargeTotal, setChargeTotal] = useState(0);

  // 핫빌 상태
  const [hasHotbillHistory, setHasHotbillHistory] = useState(false);  // 핫빌 이력 존재 여부
  const [needsRecalculation, setNeedsRecalculation] = useState(false);  // 재계산 필요 여부
  const [recalculationDone, setRecalculationDone] = useState(false);  // 재계산 완료 여부

  // 체크박스 상태
  const [hotbillConfirmed, setHotbillConfirmed] = useState(false);  // 정상 케이스: 핫빌 확인
  const [recalcConfirmed, setRecalcConfirmed] = useState(false);  // 재계산 케이스: 재계산 확인
  const [skipRecalc, setSkipRecalc] = useState(false);  // 재계산 케이스: 미진행
  const [wantRecalc, setWantRecalc] = useState(false);  // 재계산 진행 의사 체크박스

  // 조건 불충족 시 렌더링 안함 (WRK_CD !== '02' 또는 WRK_STAT_CD === '7')
  const shouldShow = wrkCd === '02' && wrkStatCd !== '7';

  // 오늘 날짜 (YYYYMMDD)
  const getTodayStr = (): string => {
    const today = new Date();
    return today.getFullYear().toString() +
      String(today.getMonth() + 1).padStart(2, '0') +
      String(today.getDate()).padStart(2, '0');
  };

  // 날짜 포맷 (YYYYMMDD → YYYY-MM-DD)
  const formatDate = (dateStr?: string): string => {
    if (!dateStr) return '-';
    const cleaned = dateStr.replace(/-/g, '');
    if (cleaned.length >= 8) {
      return `${cleaned.slice(0, 4)}-${cleaned.slice(4, 6)}-${cleaned.slice(6, 8)}`;
    }
    return dateStr;
  };

  // 금액 포맷
  const formatAmount = (amount: number): string => {
    return amount.toLocaleString('ko-KR');
  };

  // 핫빌 이력 조회
  // API 순서: getHotbillDtl -> getHotbillDtlbyCtrt -> getHotbillDtlbyCharge_ForM
  const fetchHotbillHistory = async () => {
    if (!custId || !rcptId) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Step 1: 기본 핫빌 정보 조회 (getHotbillSummary = getHotbillDtl + getHotbillTotalRefundAmt)
      const result = await getHotbillSummary(custId, rcptId);
      setSummary(result);

      const hasData = result && result.details && result.details.length > 0;
      setHasHotbillHistory(hasData);

      // Step 2: 계약별 상세 조회 (getHotbillDtlbyCtrt) - CLC_WRK_NO 획득
      // Step 3: 청구항목별 상세 조회 (getHotbillDtlbyCharge_ForM)
      if (hasData && result.details.length > 0) {
        const detail = result.details[0];
        const billSeqNo = detail.BILL_SEQ_NO || '';
        const prodGrp = detail.PROD_GRP || '';
        const detailSoId = detail.SO_ID || soId || '';
        const detailCtrtId = detail.CTRT_ID || ctrtId || '';

        // CLC_WRK_CL: summary에서 가져온 값 사용 (없으면 '4' = 해지)
        const clcWrkCl = detail.CLC_WRK_CL || '4';
        console.log('[HotbillSection] Step 2 - 계약별 조회 파라미터:', { billSeqNo, prodGrp, detailSoId, clcWrkCl, rcptId });

        if (billSeqNo && prodGrp && detailSoId && rcptId) {
          try {
            // Step 2: getHotbillDtlbyCtrt 호출하여 CLC_WRK_NO 획득
            const contractResult = await getHotbillByContract(billSeqNo, prodGrp, detailSoId, clcWrkCl, rcptId);
            console.log('[HotbillSection] 계약별 조회 결과:', contractResult);

            // CLC_WRK_NO 획득 (첫 번째 항목 또는 CTRT_ID 매칭)
            let clcWrkNo = '';
            let targetCtrtId = detailCtrtId;

            if (contractResult.length > 0) {
              // CTRT_ID가 일치하는 항목 찾기
              const matchingContract = contractResult.find(c => c.CTRT_ID === detailCtrtId);
              if (matchingContract) {
                clcWrkNo = matchingContract.CLC_WRK_NO;
                targetCtrtId = matchingContract.CTRT_ID;
              } else {
                // 없으면 첫 번째 항목 사용
                clcWrkNo = contractResult[0].CLC_WRK_NO;
                targetCtrtId = contractResult[0].CTRT_ID || detailCtrtId;
              }
            }

            console.log('[HotbillSection] Step 3 - 청구항목 조회 파라미터:', { billSeqNo, clcWrkNo, targetCtrtId });

            // Step 3: getHotbillDtlbyCharge_ForM 호출
            if (billSeqNo && clcWrkNo && targetCtrtId) {
              const chargeResult = await getHotbillByCharge(billSeqNo, clcWrkNo, targetCtrtId);

              // 원본 데이터 로그
              console.log('[HotbillSection] ========== 청구항목 원본 데이터 ==========');
              console.log('[HotbillSection] 전체 건수:', chargeResult.length);
              chargeResult.forEach((item, idx) => {
                console.log(`[HotbillSection] [${idx}] CHRG_ITEM_NM: ${item.CHRG_ITEM_NM}, BILL_AMT: ${item.BILL_AMT}, REQ_YN: ${item.REQ_YN}, SORT_SEQ: ${item.SORT_SEQ}`);
              });

              // 필터링: BILL_AMT > 0 OR REQ_YN = 'Y'
              const filteredItems = chargeResult
                .filter(item => item.BILL_AMT > 0 || item.REQ_YN === 'Y')
                .sort((a, b) => parseInt(a.SORT_SEQ || '0') - parseInt(b.SORT_SEQ || '0'));

              // 필터링 후 데이터 로그
              console.log('[HotbillSection] ========== 필터링 후 데이터 (BILL_AMT > 0 OR REQ_YN = Y) ==========');
              console.log('[HotbillSection] 필터링 후 건수:', filteredItems.length);
              filteredItems.forEach((item, idx) => {
                console.log(`[HotbillSection] [${idx}] CHRG_ITEM_NM: ${item.CHRG_ITEM_NM}, BILL_AMT: ${item.BILL_AMT}, REQ_YN: ${item.REQ_YN}, SORT_SEQ: ${item.SORT_SEQ}`);
              });

              setChargeItems(filteredItems);

              // 합계 계산
              const total = filteredItems.reduce((sum, item) => sum + item.BILL_AMT, 0);
              console.log('[HotbillSection] 합계:', total);
              setChargeTotal(total);
            }
          } catch (chargeErr) {
            console.warn('[HotbillSection] 청구항목 조회 실패 (무시):', chargeErr);
            // 청구항목 조회 실패해도 기본 핫빌 정보는 유지
          }
        }
      }

      // 재계산 필요 여부 판단
      const todayStr = getTodayStr();
      const hopeDtStr = (termHopeDt || '').replace(/-/g, '');

      // 케이스 판단
      // 1. 이력 없음 → 재계산 필요
      // 2. 해지희망일이 오늘보다 미래 → 재계산 필요
      // 3. 그 외 → 정상 (재계산 불필요)
      if (!hasData || hopeDtStr > todayStr) {
        setNeedsRecalculation(true);
      } else {
        setNeedsRecalculation(false);
      }
    } catch (err) {
      console.error('[HotbillSection] 조회 실패:', err);
      setError('핫빌 조회 실패');
      setHasHotbillHistory(false);
      setNeedsRecalculation(true);  // 에러 시 재계산 필요로 간주
    } finally {
      setLoading(false);
    }
  };

  // 핫빌 재계산 실행
  const runRecalculation = async () => {
    if (!custId || !ctrtId || !soId) {
      showToast?.('핫빌 재계산에 필요한 정보가 부족합니다', 'error');
      return;
    }

    const todayStr = getTodayStr();

    setSimulating(true);
    onSimulatingChange?.(true);
    setError(null);

    try {
      const simResult = await runHotbillSimulation({
        CUST_ID: custId,
        CTRT_ID: ctrtId,
        SO_ID: soId,
        HOPE_DT: todayStr,
        CLC_WRK_CL: '2',  // 철거
        PNTY_EXMP_YN: 'N',
      });

      if (simResult.code === 'SUCCESS' || simResult.code === 'OK') {
        showToast?.('핫빌 재계산이 완료되었습니다.', 'success');
        setRecalculationDone(true);

        // 재조회
        const newRcptId = simResult.RCPT_ID || rcptId;
        const result = await getHotbillSummary(custId, newRcptId);
        setSummary(result);
        const hasData = result && result.details && result.details.length > 0;
        setHasHotbillHistory(hasData);

        // 청구항목별 상세 조회 (재계산 후)
        if (hasData && result.details.length > 0) {
          const detail = result.details[0];
          const billSeqNo = detail.BILL_SEQ_NO || '';
          const prodGrp = detail.PROD_GRP || '';
          const detailSoId = detail.SO_ID || soId || '';
          const detailCtrtId = detail.CTRT_ID || ctrtId || '';

          if (billSeqNo && prodGrp && detailSoId && rcptId) {
            try {
              // Step 2: getHotbillDtlbyCtrt 호출 (CLC_WRK_CL='4' 해지)
              const contractResult = await getHotbillByContract(billSeqNo, prodGrp, detailSoId, '4', rcptId);

              let clcWrkNo = '';
              let targetCtrtId = detailCtrtId;

              if (contractResult.length > 0) {
                const matchingContract = contractResult.find(c => c.CTRT_ID === detailCtrtId);
                if (matchingContract) {
                  clcWrkNo = matchingContract.CLC_WRK_NO;
                  targetCtrtId = matchingContract.CTRT_ID;
                } else {
                  clcWrkNo = contractResult[0].CLC_WRK_NO;
                  targetCtrtId = contractResult[0].CTRT_ID || detailCtrtId;
                }
              }

              // Step 3: getHotbillDtlbyCharge_ForM 호출
              if (billSeqNo && clcWrkNo && targetCtrtId) {
                const chargeResult = await getHotbillByCharge(billSeqNo, clcWrkNo, targetCtrtId);
                const filteredItems = chargeResult
                  .filter(item => item.BILL_AMT > 0 || item.REQ_YN === 'Y')
                  .sort((a, b) => parseInt(a.SORT_SEQ || '0') - parseInt(b.SORT_SEQ || '0'));
                setChargeItems(filteredItems);
                const total = filteredItems.reduce((sum, item) => sum + item.BILL_AMT, 0);
                setChargeTotal(total);
              }
            } catch (chargeErr) {
              console.warn('[HotbillSection] 청구항목 조회 실패 (무시):', chargeErr);
            }
          }
        }
      } else {
        setError(simResult.message || '핫빌 재계산 실패');
        showToast?.(simResult.message || '핫빌 재계산 실패', 'error', true);
      }
    } catch (err: any) {
      console.error('[HotbillSection] 재계산 오류:', err);
      setError(err.message || '핫빌 재계산 중 오류가 발생했습니다');
      showToast?.(err.message || '핫빌 재계산 중 오류가 발생했습니다', 'error', true);
    } finally {
      setSimulating(false);
      onSimulatingChange?.(false);
    }
  };

  // 컴포넌트 마운트 시 조회
  useEffect(() => {
    if (shouldShow && custId) {
      fetchHotbillHistory();
    } else {
      setLoading(false);
    }
  }, [custId, rcptId, shouldShow]);

  // 확인 상태 변경 시 부모에게 알림
  useEffect(() => {
    if (!shouldShow) {
      // 조건 불충족 시 항상 확인됨으로 처리
      onHotbillConfirmChange?.(true);
      return;
    }

    let isConfirmed = false;

    if (!needsRecalculation) {
      // 정상 케이스: 핫빌 확인 체크 필요
      isConfirmed = hotbillConfirmed;
    } else {
      // 재계산 케이스: 재계산 확인 OR 미진행 중 하나라도 체크되면 OK
      isConfirmed = recalcConfirmed || skipRecalc;
    }

    onHotbillConfirmChange?.(isConfirmed);
  }, [shouldShow, needsRecalculation, hotbillConfirmed, recalcConfirmed, skipRecalc]);

  // 조건 불충족 시 렌더링 안함
  if (!shouldShow) {
    return null;
  }

  // 핫빌 데이터 존재 여부
  const hasHotbillData = summary && summary.details && summary.details.length > 0;

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
      {/* 헤더 */}
      <div className="px-3 sm:px-4 py-2.5 sm:py-3 flex items-center bg-orange-50">
        <div className="flex items-center gap-1.5 sm:gap-2">
          <svg className="w-4 h-4 sm:w-5 sm:h-5 text-orange-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span className="text-xs sm:text-sm font-bold text-orange-800">해지요금</span>
        </div>
      </div>

      {/* 내용 */}
      <div className="p-2.5 sm:p-3 space-y-2.5 sm:space-y-3">
        {/* 해지희망일 */}
        <div className="bg-gray-50 rounded-lg p-2.5 sm:p-3">
          <div className="text-[0.625rem] sm:text-xs text-gray-500 mb-1">해지희망일</div>
          <div className="text-xs sm:text-sm font-semibold text-gray-900">{formatDate(termHopeDt)}</div>
        </div>

        {/* 로딩 */}
        {loading && (
          <div className="flex flex-col items-center justify-center py-5 sm:py-6 gap-1.5 sm:gap-2">
            <div className="animate-spin rounded-full h-5 w-5 sm:h-6 sm:w-6 border-b-2 border-blue-600"></div>
            <div className="text-gray-500 text-[0.625rem] sm:text-xs">핫빌 이력 조회 중...</div>
          </div>
        )}

        {/* 에러 */}
        {!loading && error && (
          <div className="flex items-center justify-center py-3 sm:py-4 px-3 sm:px-4">
            <div className="text-red-500 text-[0.625rem] sm:text-xs text-center">{error}</div>
          </div>
        )}

        {/* 메인 컨텐츠 */}
        {!loading && !error && (
          <>
            {/* 핫빌 데이터 테이블 */}
            {hasHotbillData && (
              <div className="space-y-2.5 sm:space-y-3">
                <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
                  {/* 테이블 헤더 - 청구항목별 상세 */}
                  <div className="grid grid-cols-12 bg-gray-100 border-b border-gray-200">
                    <div className="col-span-8 px-1.5 sm:px-2 py-1.5 sm:py-2 text-[0.625rem] sm:text-xs font-semibold text-gray-700 text-center">청구항목명</div>
                    <div className="col-span-4 px-1.5 sm:px-2 py-1.5 sm:py-2 text-[0.625rem] sm:text-xs font-semibold text-gray-700 text-center">청구금액</div>
                  </div>

                  {/* 테이블 바디 - chargeItems 우선, 없으면 summary.details 사용 */}
                  <div className="divide-y divide-gray-100 max-h-40 sm:max-h-48 overflow-y-auto">
                    {chargeItems.length > 0 ? (
                      // 청구항목별 상세 (getHotbillDtlbyCharge_ForM)
                      chargeItems.map((item, index) => (
                        <div key={index} className={`grid grid-cols-12 ${index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}`}>
                          <div className="col-span-8 px-1.5 sm:px-2 py-1.5 sm:py-2 text-[0.625rem] sm:text-xs text-gray-900">
                            {item.CHRG_ITEM_NM || '-'}
                          </div>
                          <div className="col-span-4 px-1.5 sm:px-2 py-1.5 sm:py-2 text-[0.625rem] sm:text-xs font-medium text-gray-900 text-right">
                            {formatAmount(item.BILL_AMT)}
                          </div>
                        </div>
                      ))
                    ) : (
                      // 기본 핫빌 상세 (summary.details)
                      summary!.details.map((detail, index) => (
                        <div key={index} className={`grid grid-cols-12 ${index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}`}>
                          <div className="col-span-8 px-1.5 sm:px-2 py-1.5 sm:py-2 text-[0.625rem] sm:text-xs text-gray-900">
                            {detail.CHRG_ITM_NM || detail.CHG_NM || '-'}
                          </div>
                          <div className="col-span-4 px-1.5 sm:px-2 py-1.5 sm:py-2 text-[0.625rem] sm:text-xs font-medium text-gray-900 text-right">
                            {formatAmount(detail.BILL_AMT)}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                {/* 청구금액 합계 */}
                <div className="bg-blue-50 rounded-lg border border-blue-200 p-2.5 sm:p-3">
                  <div className="flex items-center justify-end gap-1.5 sm:gap-2">
                    <span className="text-xs sm:text-sm font-semibold text-gray-800 whitespace-nowrap">합계:</span>
                    <span className="text-base sm:text-lg font-bold text-blue-700">
                      {formatAmount(chargeTotal > 0 ? chargeTotal : (summary!.refundAmount || summary!.totalAmount))}원
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* 핫빌 데이터 없음 */}
            {!hasHotbillData && (
              <div className="flex items-center gap-1.5 sm:gap-2 py-2.5 sm:py-3 px-2.5 sm:px-3 bg-amber-50 rounded-lg border border-amber-200">
                <svg className="w-4 h-4 sm:w-5 sm:h-5 text-amber-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                <span className="text-xs sm:text-sm text-amber-800">핫빌 이력이 없습니다</span>
              </div>
            )}

            {/* 케이스별 확인 UI */}
            <div className="space-y-2">
              {!needsRecalculation ? (
                /* 케이스 1: 정상 (재계산 불필요) - 핫빌 확인 체크박스만 */
                <button
                  type="button"
                  onClick={() => !readOnly && setHotbillConfirmed(!hotbillConfirmed)}
                  disabled={readOnly}
                  className={`w-full p-3 rounded-lg border-2 transition-all flex items-center gap-3 ${
                    readOnly
                      ? 'bg-gray-100 border-gray-300 cursor-not-allowed'
                      : hotbillConfirmed
                        ? 'bg-green-50 border-green-500'
                        : 'bg-white border-gray-300 hover:border-gray-400'
                  }`}
                >
                  <div className={`w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 ${
                    hotbillConfirmed
                      ? 'bg-green-500 border-green-500'
                      : 'bg-white border-gray-400'
                  }`}>
                    {hotbillConfirmed && (
                      <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                  </div>
                  <span className={`text-sm font-medium ${readOnly ? 'text-gray-500' : hotbillConfirmed ? 'text-green-700' : 'text-gray-700'}`}>
                    핫빌 확인
                  </span>
                </button>
              ) : (
                /* 케이스 2: 재계산 필요 */
                <>
                  {/* 해지희망일이 미래인 경우 경고 문구 + 체크박스 */}
                  {(() => {
                    const todayStr = getTodayStr();
                    const hopeDtStr = (termHopeDt || '').replace(/-/g, '');
                    const isFutureDate = hopeDtStr > todayStr;

                    if (isFutureDate) {
                      return (
                        <>
                          {/* 경고 문구 */}
                          <div className="flex items-center gap-1.5 sm:gap-2 py-2 px-2.5 sm:px-3 bg-red-50 rounded-lg border border-red-200">
                            <svg className="w-4 h-4 sm:w-5 sm:h-5 text-red-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                            </svg>
                            <span className="text-xs sm:text-sm text-red-800 font-medium">해지희망일 이전에 작업완료입니다.</span>
                          </div>

                          {/* 핫빌 재계산 진행 체크박스 */}
                          <button
                            type="button"
                            onClick={() => {
                              if (readOnly) return;
                              setWantRecalc(!wantRecalc);
                              if (wantRecalc) {
                                setRecalcConfirmed(false);
                              }
                            }}
                            disabled={readOnly}
                            className={`w-full p-3 rounded-lg border-2 transition-all flex items-center gap-3 ${
                              readOnly
                                ? 'bg-gray-100 border-gray-300 cursor-not-allowed'
                                : wantRecalc
                                  ? 'bg-amber-50 border-amber-500'
                                  : 'bg-white border-gray-300 hover:border-gray-400'
                            }`}
                          >
                            <div className={`w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 ${
                              wantRecalc
                                ? 'bg-amber-500 border-amber-500'
                                : 'bg-white border-gray-400'
                            }`}>
                              {wantRecalc && (
                                <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                                </svg>
                              )}
                            </div>
                            <span className={`text-sm font-medium ${readOnly ? 'text-gray-500' : wantRecalc ? 'text-amber-700' : 'text-gray-700'}`}>
                              핫빌 재계산 진행
                            </span>
                          </button>

                          {/* 재계산 진행 체크 시에만 버튼/확인 표시 */}
                          {wantRecalc && !readOnly && (
                            <div className="space-y-2">
                              {!recalculationDone ? (
                                <button
                                  type="button"
                                  onClick={runRecalculation}
                                  disabled={simulating || readOnly}
                                  className="w-full py-3 bg-amber-600 hover:bg-amber-700 disabled:bg-gray-400 text-white text-sm font-bold rounded-lg transition-colors flex items-center justify-center gap-2"
                                >
                                  {simulating ? (
                                    <>
                                      <svg className="animate-spin h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                      </svg>
                                      <span>재계산 중...</span>
                                    </>
                                  ) : (
                                    <>
                                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                                      </svg>
                                      <span>핫빌 재계산</span>
                                    </>
                                  )}
                                </button>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => {
                                    if (readOnly) return;
                                    setRecalcConfirmed(!recalcConfirmed);
                                    if (!recalcConfirmed) setSkipRecalc(false);
                                  }}
                                  disabled={readOnly}
                                  className={`w-full p-3 rounded-lg border-2 transition-all flex items-center gap-3 ${
                                    readOnly
                                      ? 'bg-gray-100 border-gray-300 cursor-not-allowed'
                                      : recalcConfirmed
                                        ? 'bg-green-50 border-green-500'
                                        : 'bg-white border-gray-300 hover:border-gray-400'
                                  }`}
                                >
                                  <div className={`w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 ${
                                    recalcConfirmed
                                      ? 'bg-green-500 border-green-500'
                                      : 'bg-white border-gray-400'
                                  }`}>
                                    {recalcConfirmed && (
                                      <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                                      </svg>
                                    )}
                                  </div>
                                  <span className={`text-sm font-medium ${readOnly ? 'text-gray-500' : recalcConfirmed ? 'text-green-700' : 'text-gray-700'}`}>
                                    핫빌 재계산 확인
                                  </span>
                                </button>
                              )}
                            </div>
                          )}
                        </>
                      );
                    } else {
                      // 해지희망일이 미래가 아닌 경우 (이력 없음 등) - 기존 로직
                      return (
                        <div className="space-y-2">
                          {!recalculationDone && !readOnly ? (
                            <button
                              type="button"
                              onClick={runRecalculation}
                              disabled={simulating || readOnly}
                              className="w-full py-3 bg-amber-600 hover:bg-amber-700 disabled:bg-gray-400 text-white text-sm font-bold rounded-lg transition-colors flex items-center justify-center gap-2"
                            >
                              {simulating ? (
                                <>
                                  <svg className="animate-spin h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                  </svg>
                                  <span>재계산 중...</span>
                                </>
                              ) : (
                                <>
                                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                                  </svg>
                                  <span>핫빌 재계산</span>
                                </>
                              )}
                            </button>
                          ) : recalculationDone ? (
                            <button
                              type="button"
                              onClick={() => {
                                if (readOnly) return;
                                setRecalcConfirmed(!recalcConfirmed);
                                if (!recalcConfirmed) setSkipRecalc(false);
                              }}
                              disabled={readOnly}
                              className={`w-full p-3 rounded-lg border-2 transition-all flex items-center gap-3 ${
                                readOnly
                                  ? 'bg-gray-100 border-gray-300 cursor-not-allowed'
                                  : recalcConfirmed
                                    ? 'bg-green-50 border-green-500'
                                    : 'bg-white border-gray-300 hover:border-gray-400'
                              }`}
                            >
                              <div className={`w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 ${
                                recalcConfirmed
                                  ? 'bg-green-500 border-green-500'
                                  : 'bg-white border-gray-400'
                              }`}>
                                {recalcConfirmed && (
                                  <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                                  </svg>
                                )}
                              </div>
                              <span className={`text-sm font-medium ${readOnly ? 'text-gray-500' : recalcConfirmed ? 'text-green-700' : 'text-gray-700'}`}>
                                핫빌 재계산 확인
                              </span>
                            </button>
                          ) : null}
                        </div>
                      );
                    }
                  })()}

                  {/* 2.2 핫빌 재계산 미진행 체크박스 */}
                  <button
                    type="button"
                    onClick={() => {
                      if (readOnly) return;
                      setSkipRecalc(!skipRecalc);
                      if (!skipRecalc) {
                        setRecalcConfirmed(false);
                        setWantRecalc(false);
                      }
                    }}
                    disabled={readOnly}
                    className={`w-full p-3 rounded-lg border-2 transition-all flex items-center gap-3 ${
                      readOnly
                        ? 'bg-gray-100 border-gray-300 cursor-not-allowed'
                        : skipRecalc
                          ? 'bg-gray-100 border-gray-500'
                          : 'bg-white border-gray-300 hover:border-gray-400'
                    }`}
                  >
                    <div className={`w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 ${
                      skipRecalc
                        ? 'bg-gray-500 border-gray-500'
                        : 'bg-white border-gray-400'
                    }`}>
                      {skipRecalc && (
                        <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                        </svg>
                      )}
                    </div>
                    <span className={`text-sm font-medium ${readOnly ? 'text-gray-500' : skipRecalc ? 'text-gray-700' : 'text-gray-600'}`}>
                      핫빌 재계산 미진행
                    </span>
                  </button>
                </>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default HotbillSection;
