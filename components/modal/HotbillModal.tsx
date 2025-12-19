import React, { useState, useEffect } from 'react';
import { getHotbillSummary, HotbillSummary, runHotbillSimulation } from '../../services/apiService';
import BaseModal from '../common/BaseModal';
import { formatId } from '../../utils/dateFormatter';
import '../../styles/buttons.css';

interface HotbillModalProps {
  isOpen: boolean;
  onClose: () => void;
  custId: string;
  rcptId: string;
  custNm?: string;  // 고객명 (선택)
  prodGrp?: string; // 제품그룹 (선택)
  // 시뮬레이션 실행을 위한 추가 파라미터
  ctrtId?: string;  // 계약ID
  soId?: string;    // SO_ID
  hopeDt?: string;  // 해지희망일 (YYYYMMDD)
  wrkCd?: string;   // 작업코드 (01:설치, 02:철거 등)
  showToast?: (message: string, type: 'success' | 'error' | 'warning' | 'info') => void;
}

/**
 * Hot Bill (즉납) 모달 - 계산 + 조회 통합
 *
 * 레거시: btn_hot_bill (mowoa03m02.xml)
 * - 버튼 클릭 시 시뮬레이션(계산)과 조회를 동시에 실행
 * - calcHotbillSumul.req 호출 후 결과 표시
 *
 * 철거/해지 작업에서 미납/환불 정보를 계산하고 조회하는 모달
 * - 총 청구금액, 납부금액, 미납금액, 환불금액 요약
 * - 상세 청구 내역 목록
 */
const HotbillModal: React.FC<HotbillModalProps> = ({
  isOpen,
  onClose,
  custId,
  rcptId,
  custNm,
  prodGrp,
  ctrtId,
  soId,
  hopeDt,
  wrkCd,
  showToast
}) => {
  const [summary, setSummary] = useState<HotbillSummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [simulating, setSimulating] = useState(false);  // 시뮬레이션 진행 상태
  const [error, setError] = useState<string | null>(null);
  const [simulationRcptId, setSimulationRcptId] = useState<string>('');  // 시뮬레이션 결과 RCPT_ID

  // 금액 포맷 (천 단위 콤마)
  const formatAmount = (amount: number): string => {
    return amount.toLocaleString('ko-KR');
  };

  // 시뮬레이션 실행 + 조회 통합 (레거시 동작 구현)
  const runSimulationAndFetch = async () => {
    if (!custId) {
      console.error('[Hot Bill] 고객ID 누락:', { custId });
      setError('고객ID가 없습니다');
      return;
    }

    // 시뮬레이션 필수 파라미터 체크
    if (!ctrtId || !soId) {
      console.warn('[Hot Bill] 시뮬레이션 파라미터 부족, 기존 데이터 조회 시도');
      // 시뮬레이션 불가 시 기존 조회만 시도
      await fetchHotbill(rcptId);
      return;
    }

    // 해지희망일: 없으면 현재날짜 사용 (레거시: isReRun==true일 때 CURRENT_DT 사용)
    let formattedHopeDt = hopeDt?.replace(/-/g, '') || '';
    if (!formattedHopeDt) {
      // 현재날짜 YYYYMMDD 형식
      const today = new Date();
      formattedHopeDt = today.getFullYear().toString() +
        String(today.getMonth() + 1).padStart(2, '0') +
        String(today.getDate()).padStart(2, '0');
      console.log('[Hot Bill] 해지희망일 없음, 현재날짜 사용:', formattedHopeDt);
    }

    setSimulating(true);
    setError(null);

    try {
      console.log('[Hot Bill] 시뮬레이션 시작:', { custId, ctrtId, soId, hopeDt: formattedHopeDt, wrkCd });

      // 1. 시뮬레이션 실행
      const simResult = await runHotbillSimulation({
        CUST_ID: custId,
        CTRT_ID: ctrtId,
        SO_ID: soId,
        HOPE_DT: formattedHopeDt,
        CLC_WRK_CL: wrkCd === '02' ? '2' : '1',  // 철거(02)=2, 그 외=1
        PNTY_EXMP_YN: 'N',
      });

      console.log('[Hot Bill] 시뮬레이션 결과:', simResult);

      if (simResult.code === 'SUCCESS' || simResult.code === 'OK') {
        const newRcptId = simResult.RCPT_ID || rcptId;
        setSimulationRcptId(newRcptId);

        // 2. 시뮬레이션 성공 후 결과 조회
        setSimulating(false);
        await fetchHotbill(newRcptId);
      } else {
        setError(simResult.message || '즉납계산 실패');
        setSimulating(false);
      }
    } catch (err: any) {
      console.error('[Hot Bill] 시뮬레이션 오류:', err);
      setError(err.message || '즉납계산 중 오류가 발생했습니다');
      setSimulating(false);
    }
  };

  // Hot Bill 조회
  const fetchHotbill = async (targetRcptId?: string) => {
    const queryRcptId = targetRcptId || simulationRcptId || rcptId;

    if (!queryRcptId) {
      console.warn('[Hot Bill] RCPT_ID 없음 - 조회 불가');
      setError('접수ID가 없어 조회할 수 없습니다.');
      return;
    }

    setLoading(true);

    try {
      console.log('[Hot Bill] 조회 시작:', { custId, rcptId: queryRcptId, prodGrp });

      const result = await getHotbillSummary(custId, queryRcptId);
      console.log('[Hot Bill] 조회 결과:', result);

      setSummary(result);
      setError(null);
    } catch (err) {
      console.error('[Hot Bill] 조회 실패:', err);
      setError(err instanceof Error ? err.message : '조회 중 오류가 발생했습니다');
    } finally {
      setLoading(false);
    }
  };

  // 모달이 열릴 때 시뮬레이션 + 조회 자동 실행
  useEffect(() => {
    if (isOpen && custId) {
      // 시뮬레이션 파라미터가 있으면 시뮬레이션부터 실행
      if (ctrtId && soId) {
        runSimulationAndFetch();
      } else {
        // 없으면 기존 데이터 조회만
        fetchHotbill(rcptId);
      }
    }
    // 모달 닫힐 때 상태 초기화
    if (!isOpen) {
      setSummary(null);
      setError(null);
      setSimulationRcptId('');
    }
  }, [isOpen, custId]);

  // 미납 여부에 따른 상태 뱃지
  const getStatusBadge = (unpaidAmount: number) => {
    if (unpaidAmount > 0) {
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
          미납
        </span>
      );
    }
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
        완납
      </span>
    );
  };

  // SubHeader 컨텐츠
  const subHeader = (
    <div className="text-xs text-gray-700 space-y-0.5">
      <div className="flex gap-4">
        {custNm && (
          <div className="whitespace-nowrap"><span className="text-gray-600">고객명:</span> <span className="font-medium text-blue-700">{custNm}</span></div>
        )}
        <div className="whitespace-nowrap"><span className="text-gray-600">고객ID:</span> <span className="font-medium">{formatId(custId)}</span></div>
      </div>
      <div className="flex gap-4">
        <div className="whitespace-nowrap"><span className="text-gray-600">접수ID:</span> <span className="font-medium">{formatId(rcptId)}</span></div>
        {prodGrp && (
          <div className="whitespace-nowrap"><span className="text-gray-600">제품그룹:</span> <span className="font-medium">{prodGrp}</span></div>
        )}
      </div>
    </div>
  );

  // 재계산 버튼 클릭
  const handleRefresh = () => {
    if (ctrtId && soId) {
      runSimulationAndFetch();
    } else {
      fetchHotbill();
    }
  };

  // Footer 컨텐츠
  const footer = (
    <div className="flex gap-2">
      <button
        onClick={handleRefresh}
        disabled={loading || simulating}
        className="btn btn-primary btn-sm"
      >
        {simulating ? '계산 중...' : loading ? '조회 중...' : '재계산'}
      </button>
      <button
        onClick={onClose}
        className="btn btn-secondary btn-sm"
      >
        닫기
      </button>
    </div>
  );

  return (
    <BaseModal
      isOpen={isOpen}
      onClose={onClose}
      title="즉납 조회 (Hot Bill)"
      size="medium"
      subHeader={subHeader}
      footer={footer}
    >
      {/* 시뮬레이션 중 */}
      {simulating && (
        <div className="flex flex-col items-center justify-center py-8 gap-2">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-amber-600"></div>
          <div className="text-amber-600 text-xs font-medium">즉납 계산 중...</div>
          <div className="text-gray-400 text-xs">잠시만 기다려주세요</div>
        </div>
      )}

      {/* 조회 중 */}
      {!simulating && loading && (
        <div className="flex flex-col items-center justify-center py-8 gap-2">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
          <div className="text-gray-500 text-xs">조회 중...</div>
        </div>
      )}

      {/* 에러 */}
      {!simulating && !loading && error && (
        <div className="flex items-center justify-center py-8 px-4">
          <div className="text-red-500 text-xs text-center">{error}</div>
        </div>
      )}

      {/* 데이터 없음 */}
      {!simulating && !loading && !error && !summary && (
        <div className="flex flex-col items-center justify-center py-8 gap-2">
          <svg className="w-10 h-10 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 14l6-6m-5.5.5h.01m4.99 5h.01M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16l3.5-2 3.5 2 3.5-2 3.5 2zM10 8.5a.5.5 0 11-1 0 .5.5 0 011 0zm5 5a.5.5 0 11-1 0 .5.5 0 011 0z" />
          </svg>
          <div className="text-gray-500 text-xs">즉납 정보가 없습니다</div>
        </div>
      )}

      {/* Hot Bill 정보 - 레거시 mocir23m01 스타일 */}
      {!simulating && !loading && !error && summary && (
        <div className="space-y-3 p-2">
          {/* 상세 내역 테이블 (레거시: 서비스, 요금항목명, 청구금액) */}
          {summary.details.length > 0 && (
            <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
              {/* 테이블 헤더 */}
              <div className="grid grid-cols-12 bg-gray-100 border-b border-gray-200">
                <div className="col-span-3 px-2 py-2 text-xs font-semibold text-gray-700 text-center">서비스</div>
                <div className="col-span-6 px-2 py-2 text-xs font-semibold text-gray-700 text-center">요금항목명</div>
                <div className="col-span-3 px-2 py-2 text-xs font-semibold text-gray-700 text-center">청구금액</div>
              </div>

              {/* 테이블 바디 */}
              <div className="divide-y divide-gray-100 max-h-64 overflow-y-auto">
                {summary.details.map((detail, index) => (
                  <div key={index} className={`grid grid-cols-12 ${index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}`}>
                    <div className="col-span-3 px-2 py-2.5 text-xs text-gray-700 text-center">
                      {detail.SVC_NM || detail.PROD_GRP || '-'}
                    </div>
                    <div className="col-span-6 px-2 py-2.5 text-xs text-gray-900">
                      {detail.CHRG_ITM_NM || detail.CHG_NM || '-'}
                    </div>
                    <div className="col-span-3 px-2 py-2.5 text-xs font-medium text-gray-900 text-right">
                      {formatAmount(detail.BILL_AMT)}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 상세 내역 없음 */}
          {summary.details.length === 0 && (
            <div className="bg-gray-50 rounded-lg border border-gray-200 p-4 text-center">
              <div className="text-xs text-gray-500">청구 상세 내역이 없습니다</div>
            </div>
          )}

          {/* 반환금 합계 (레거시 스타일) */}
          <div className="bg-blue-50 rounded-lg border border-blue-200 p-3">
            <div className="flex items-center justify-end">
              <span className="text-sm font-semibold text-gray-800 mr-2">반환금 합계:</span>
              <span className="text-lg font-bold text-blue-700">
                {formatAmount(summary.refundAmount || summary.totalAmount)}원
              </span>
            </div>
          </div>
        </div>
      )}
    </BaseModal>
  );
};

export default HotbillModal;
