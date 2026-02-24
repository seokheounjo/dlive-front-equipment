import React, { useState, useEffect } from 'react';
import {
  ChevronDown, ChevronUp, Loader2,
  AlertCircle
} from 'lucide-react';

import {
  UnpaymentInfo,
  getPaymentAccounts,
  getBillingDetails,
  PaymentAccountInfo,
  BillingDetailInfo,
  ContractInfo,
  formatCurrency,
  maskString
} from '../../services/customerApi';
import UnpaymentCollectionModal from './UnpaymentCollectionModal';
import PaymentChangeModal from './PaymentChangeModal';

// 납부계정ID 포맷 (3-3-4)
const formatPymAcntId = (pymAcntId: string): string => {
  if (!pymAcntId) return '-';
  const cleaned = pymAcntId.replace(/[^0-9]/g, '');
  if (cleaned.length === 10) {
    return `${cleaned.slice(0, 3)}-${cleaned.slice(3, 6)}-${cleaned.slice(6, 10)}`;
  }
  return pymAcntId;
};

// 청구년월 포맷 (YYYYMM -> YYYY-MM)
const formatBillYymm = (yymm: string): string => {
  if (!yymm || yymm.length < 6) return yymm || '-';
  return `${yymm.slice(0, 4)}-${yymm.slice(4, 6)}`;
};

interface PaymentInfoProps {
  custId: string;
  custNm?: string;
  expanded: boolean;
  onToggle: () => void;
  showToast?: (message: string, type: 'success' | 'error' | 'warning' | 'info') => void;
  onNavigateToPaymentChange?: (pymAcntId: string) => void;
  paymentChangeInProgress?: boolean;
  onCancelPaymentChange?: () => void;
  currentWorkingPymAcntId?: string;
  selectedPymAcntIdFromContract?: string;  // 계약 선택 시 해당 납부계정ID
  contracts?: ContractInfo[];  // 계약 목록 (납부계정 → SO_ID 매핑용)
}

/**
 * 납부정보 / 요금내역 컴포넌트
 *
 * D'Live API:
 * - getCustAccountInfo_m: 납부정보 (PYM_ACNT_ID, PYM_MTHD_NM, BANK_CARD_NM, BANK_CARD_NO, BILL_MTHD, UPYM_AMT_ACNT)
 * - getCustBillInfo_m: 요금내역 (BILL_YYMM, BILL_CYCL, BILL_AMT, RCPT_AMT, UPYM_AMT) - PYM_ACNT_ID 선택 시
 */
const PaymentInfo: React.FC<PaymentInfoProps> = ({
  custId,
  custNm,
  expanded,
  onToggle,
  showToast,
  onNavigateToPaymentChange,
  paymentChangeInProgress,
  onCancelPaymentChange,
  currentWorkingPymAcntId,
  selectedPymAcntIdFromContract,
  contracts = []
}) => {
  // 데이터 상태 (D'Live API 응답 기준)
  const [paymentAccounts, setPaymentAccounts] = useState<PaymentAccountInfo[]>([]);
  const [billingDetails, setBillingDetails] = useState<BillingDetailInfo[]>([]);

  // 로딩 상태
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingBilling, setIsLoadingBilling] = useState(false);

  // 선택된 납부계정
  const [selectedPymAcntId, setSelectedPymAcntId] = useState<string | null>(null);

  // 요금내역 펼침 상태
  const [showBillingDetail, setShowBillingDetail] = useState(true);

  // 미납금 수납 모달
  const [showUnpaymentModal, setShowUnpaymentModal] = useState(false);
  const [modalUnpaymentList, setModalUnpaymentList] = useState<UnpaymentInfo[]>([]);
  const [isLoadingUnpayment, setIsLoadingUnpayment] = useState(false);

  // 납부계정 전환 확인 모달
  const [showSwitchConfirm, setShowSwitchConfirm] = useState(false);
  const [pendingSwitchPymAcntId, setPendingSwitchPymAcntId] = useState<string>('');

  // 납부방법 변경 모달
  const [showPaymentChangeModal, setShowPaymentChangeModal] = useState(false);

  // 데이터 로드
  useEffect(() => {
    if (expanded && custId) {
      loadPaymentAccounts();
    }
  }, [expanded, custId]);

  // 계약 선택 시 해당 납부계정 자동 선택 (펼치지는 않음 - 데이터만 준비)
  useEffect(() => {
    if (selectedPymAcntIdFromContract && selectedPymAcntIdFromContract !== selectedPymAcntId) {
      setSelectedPymAcntId(selectedPymAcntIdFromContract);
    }
  }, [selectedPymAcntIdFromContract]);

  // 선택된 납부계정 변경 시 요금내역 로드
  useEffect(() => {
    if (selectedPymAcntId && custId) {
      loadBillingDetails(selectedPymAcntId);
    }
  }, [selectedPymAcntId, custId]);

  // 납부계정 정보 로드 (getCustAccountInfo_m)
  const loadPaymentAccounts = async () => {
    setIsLoading(true);
    try {
      const paymentRes = await getPaymentAccounts(custId);

      if (paymentRes.success && paymentRes.data) {
        setPaymentAccounts(paymentRes.data);
        // 납부계정 자동 선택: 계약에서 지정된 계정이 목록에 있으면 우선, 없으면 첫 번째
        if (paymentRes.data.length > 0) {
          if (selectedPymAcntIdFromContract && paymentRes.data.some(p => p.PYM_ACNT_ID === selectedPymAcntIdFromContract)) {
            setSelectedPymAcntId(selectedPymAcntIdFromContract);
          } else {
            setSelectedPymAcntId(paymentRes.data[0].PYM_ACNT_ID);
          }
        }
      }
    } catch (error) {
      console.error('Load payment accounts error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // 요금내역 로드 (getCustBillInfo_m) - 선택된 납부계정별
  const loadBillingDetails = async (pymAcntId: string) => {
    setIsLoadingBilling(true);
    try {
      const response = await getBillingDetails(custId, pymAcntId);
      if (response.success && response.data) {
        setBillingDetails(response.data);
      } else {
        setBillingDetails([]);
      }
    } catch (error) {
      console.error('Load billing details error:', error);
      setBillingDetails([]);
    } finally {
      setIsLoadingBilling(false);
    }
  };

  // 납부계정 선택 핸들러
  const handleSelectPaymentAccount = (pymAcntId: string) => {
    setSelectedPymAcntId(pymAcntId);
  };

  // 납부정보 변경 버튼 클릭
  const handlePaymentChangeClick = (pymAcntId: string) => {
    if (currentWorkingPymAcntId === pymAcntId) {
      if (onNavigateToPaymentChange) {
        onNavigateToPaymentChange(pymAcntId);
      }
      return;
    }
    if (paymentChangeInProgress) {
      setPendingSwitchPymAcntId(pymAcntId);
      setShowSwitchConfirm(true);
      return;
    }
    if (onNavigateToPaymentChange) {
      onNavigateToPaymentChange(pymAcntId);
    }
  };

  // 납부계정 전환 확정
  const confirmSwitchPaymentAccount = () => {
    if (onCancelPaymentChange) {
      onCancelPaymentChange();
    }
    if (onNavigateToPaymentChange && pendingSwitchPymAcntId) {
      onNavigateToPaymentChange(pendingSwitchPymAcntId);
    }
    setShowSwitchConfirm(false);
    setPendingSwitchPymAcntId('');
  };

  // 선택된 납부계정 정보
  const selectedPayment = paymentAccounts.find(p => p.PYM_ACNT_ID === selectedPymAcntId);

  // 미납금 수납 버튼 클릭 핸들러
  const handleUnpaymentClick = async () => {
    if (!selectedPymAcntId) {
      showToast?.('납부계정을 선택해주세요.', 'warning');
      return;
    }

    setIsLoadingUnpayment(true);
    try {
      // 요금내역에서 미납 내역 조회 (getCustBillInfo_m의 UPYM_AMT > 0인 항목)
      const response = await getBillingDetails(custId, selectedPymAcntId);
      if (response.success && response.data) {
        // 미납금이 있는 항목만 필터링하여 UnpaymentInfo 형태로 변환
        const unpaymentItems: UnpaymentInfo[] = response.data
          .filter(item => item.UPYM_AMT > 0)
          .map(item => ({
            BILL_YM: item.BILL_YYMM,
            CTRT_ID: '',
            PROD_NM: item.BILL_CYCL || '정기',
            BILL_AMT: item.BILL_AMT,
            UNPAY_AMT: item.UPYM_AMT,
            UNPAY_DAYS: 0,
            UNPAY_STAT_NM: '미납'
          }));

        if (unpaymentItems.length > 0) {
          setModalUnpaymentList(unpaymentItems);
          setShowUnpaymentModal(true);
        } else {
          showToast?.('미납 내역이 없습니다.', 'info');
        }
      } else {
        showToast?.('미납 내역 조회에 실패했습니다.', 'error');
      }
    } catch (error) {
      console.error('Load unpayment list error:', error);
      showToast?.('미납 내역 조회 중 오류가 발생했습니다.', 'error');
    } finally {
      setIsLoadingUnpayment(false);
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200">
      {/* 헤더 */}
      <button
        onClick={onToggle}
        className="w-full px-3 py-2.5 flex items-center justify-between text-left"
      >
        <div className="flex items-center gap-2">
          <span className="font-medium text-gray-800">납부정보 / 요금내역</span>
        </div>
        {expanded ? (
          <ChevronUp className="w-4 h-4 text-gray-400" />
        ) : (
          <ChevronDown className="w-4 h-4 text-gray-400" />
        )}
      </button>

      {expanded && (
        <div className="px-3 pb-3">
          {isLoading ? (
            <div className="flex items-center justify-center py-6">
              <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
            </div>
          ) : (
            <div className="space-y-4">
              {/* 납부 정보 섹션 */}
              <div>
                {/* 헤더 */}
                <div className="flex items-center justify-between mb-3">
                  <span className="text-sm font-medium text-gray-700">납부 정보</span>
                  <span className="text-xs text-gray-500">{paymentAccounts.length}건</span>
                </div>

                {/* 납부 정보 목록 - 클릭 시 선택, 세부정보는 아래 고정 표시 */}
                {paymentAccounts.length === 0 ? (
                  <div className="text-center py-4 text-gray-500 text-sm">
                    납부 정보가 없습니다.
                  </div>
                ) : (
                  <>
                    {/* 납부계정 선택 리스트 */}
                    <div className="space-y-1 mb-3">
                      {paymentAccounts.map((payment, index) => {
                        const isWorking = currentWorkingPymAcntId === payment.PYM_ACNT_ID;
                        const isSelected = selectedPymAcntId === payment.PYM_ACNT_ID;

                        return (
                          <div
                            key={payment.PYM_ACNT_ID}
                            onClick={() => handleSelectPaymentAccount(payment.PYM_ACNT_ID)}
                            className={`p-2 rounded-lg border cursor-pointer transition-all ${
                              isWorking
                                ? 'bg-orange-50 border-orange-300'
                                : isSelected
                                  ? 'bg-blue-50 border-blue-400'
                                  : 'bg-gray-50 border-gray-200 hover:border-gray-300'
                            }`}
                          >
                            <div className="flex items-center justify-between text-sm">
                              <div className="flex items-center gap-2">
                                <span className="font-medium text-gray-700">{index + 1}.</span>
                                <span className="text-gray-800">{formatPymAcntId(payment.PYM_ACNT_ID)}</span>
                                <span className="text-gray-400">|</span>
                                <span className="text-gray-600">{payment.PYM_MTHD_NM || '-'}</span>
                                {isWorking && (
                                  <span className="px-1.5 py-0.5 text-xs bg-orange-500 text-white rounded-full animate-pulse">
                                    작업중
                                  </span>
                                )}
                              </div>
                              <span className={`font-medium ${payment.UPYM_AMT_ACNT > 0 ? 'text-red-600' : 'text-gray-600'}`}>
                                {formatCurrency(payment.UPYM_AMT_ACNT || 0)}원
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    {/* 선택된 납부계정 세부정보 (항상 표시) */}
                    {selectedPayment && (
                      <div className="p-3 bg-blue-50 rounded-lg border border-blue-200">
                        <div className="space-y-2 text-sm">
                          {/* 납부방법 */}
                          <div className="flex justify-between items-center">
                            <span className="text-gray-500 text-xs">납부방법</span>
                            <span className="text-gray-800">{selectedPayment.PYM_MTHD_NM || '-'}</span>
                          </div>
                          {/* 은행/카드 */}
                          <div className="flex justify-between items-center">
                            <span className="text-gray-500 text-xs">은행/카드</span>
                            <span className="text-gray-800">{selectedPayment.BANK_CARD_NM || '-'}</span>
                          </div>
                          {/* 계좌/카드번호 */}
                          <div className="flex justify-between items-center">
                            <span className="text-gray-500 text-xs">계좌/카드번호</span>
                            <span className="text-gray-800">{maskString(selectedPayment.BANK_CARD_NO || '', 4, 4)}</span>
                          </div>
                          {/* 청구매체 */}
                          <div className="flex justify-between items-center">
                            <span className="text-gray-500 text-xs">청구매체</span>
                            <span className="text-gray-800">{selectedPayment.BILL_MTHD || '-'}</span>
                          </div>
                          {/* 미납금액 */}
                          <div className="flex justify-between items-center pt-2 border-t border-blue-200">
                            <span className="text-gray-500 text-xs">미납금액</span>
                            <span className={`font-bold ${selectedPayment.UPYM_AMT_ACNT > 0 ? 'text-red-600' : 'text-gray-800'}`}>
                              {formatCurrency(selectedPayment.UPYM_AMT_ACNT || 0)}원
                            </span>
                          </div>
                        </div>
                      </div>
                    )}
                  </>
                )}

                {/* 미납금 수납 버튼 - 미납 계정이 있을 때 */}
                {paymentAccounts.some(p => p.UPYM_AMT_ACNT > 0) && (
                  <button
                    onClick={handleUnpaymentClick}
                    disabled={isLoadingUnpayment || !selectedPymAcntId}
                    className="w-full mt-3 py-2.5 text-sm bg-red-500 text-white rounded-lg hover:bg-red-600 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors font-medium flex items-center justify-center gap-2"
                  >
                    {isLoadingUnpayment ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        조회 중...
                      </>
                    ) : (
                      `미납금 수납 (${formatPymAcntId(selectedPymAcntId || '')})`
                    )}
                  </button>
                )}

                {/* 납부정보 변경 버튼 - 팝업으로 변경 */}
                {selectedPymAcntId && (
                  <button
                    onClick={() => setShowPaymentChangeModal(true)}
                    className="w-full mt-2 py-2 text-sm text-indigo-600 bg-indigo-50 hover:bg-indigo-100 rounded-lg transition-colors font-medium"
                  >
                    납부정보 변경
                  </button>
                )}
              </div>

              {/* 요금 내역 섹션 - 선택된 납부계정별 (getCustBillInfo_m) */}
              <div className="border-t border-gray-200 pt-4">
                <button
                  onClick={() => setShowBillingDetail(!showBillingDetail)}
                  className="w-full flex items-center justify-between mb-3"
                >
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-gray-700">요금내역</span>
                    {selectedPayment && (
                      <span className="text-xs text-blue-600 bg-blue-50 px-2 py-0.5 rounded">
                        {formatPymAcntId(selectedPayment.PYM_ACNT_ID)}
                      </span>
                    )}
                  </div>
                  <ChevronDown
                    className={`w-4 h-4 text-gray-400 transition-transform ${
                      showBillingDetail ? 'rotate-180' : ''
                    }`}
                  />
                </button>

                {showBillingDetail && (
                  <>
                    {!selectedPymAcntId ? (
                      <div className="text-center py-4 text-gray-500 text-sm">
                        납부계정을 선택해주세요.
                      </div>
                    ) : isLoadingBilling ? (
                      <div className="flex items-center justify-center py-4">
                        <Loader2 className="w-4 h-4 animate-spin text-gray-400" />
                      </div>
                    ) : billingDetails.length === 0 ? (
                      <div className="text-center py-4 text-gray-500 text-sm">
                        최근 3개월 요금 내역 또는 미납 내역이 없습니다.
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {/* 요금 상세 목록 */}
                        {billingDetails.slice(0, 10).map((item, index) => (
                          <div
                            key={index}
                            className={`p-3 rounded-lg border ${
                              item.UPYM_AMT > 0 ? 'bg-red-50 border-red-200' : 'bg-gray-50 border-gray-200'
                            }`}
                          >
                            {/* 청구년월 헤더 */}
                            <div className="flex justify-between items-center mb-2 pb-2 border-b border-gray-200">
                              <span className="font-medium text-gray-800">{formatBillYymm(item.BILL_YYMM)}</span>
                              <span className="text-xs text-gray-500">{item.BILL_CYCL || '정기'}</span>
                            </div>
                            {/* 금액 정보 - 세로 배치 */}
                            <div className="space-y-1 text-sm">
                              <div className="flex justify-between">
                                <span className="text-gray-500 text-xs">청구금액</span>
                                <span className="text-gray-800">{formatCurrency(item.BILL_AMT)}원</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-gray-500 text-xs">수납금액</span>
                                <span className="text-green-600">{formatCurrency(item.RCPT_AMT)}원</span>
                              </div>
                              {item.UPYM_AMT > 0 && (
                                <div className="flex justify-between pt-1 border-t border-gray-200">
                                  <span className="text-gray-500 text-xs">미납금액</span>
                                  <span className="text-red-600 font-bold">{formatCurrency(item.UPYM_AMT)}원</span>
                                </div>
                              )}
                            </div>
                          </div>
                        ))}
                        {billingDetails.length > 10 && (
                          <div className="text-center text-sm text-gray-500 py-2">
                            +{billingDetails.length - 10}건 더 있음
                          </div>
                        )}
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* 미납금 수납 모달 */}
      <UnpaymentCollectionModal
        isOpen={showUnpaymentModal}
        onClose={() => {
          setShowUnpaymentModal(false);
          loadPaymentAccounts();
          if (selectedPymAcntId) loadBillingDetails(selectedPymAcntId);
        }}
        custId={custId}
        custNm={custNm}
        pymAcntId={selectedPymAcntId || ''}
        unpaymentList={modalUnpaymentList}
        showToast={showToast}
        onSuccess={() => {
          loadPaymentAccounts();
          if (selectedPymAcntId) {
            loadBillingDetails(selectedPymAcntId);
          }
        }}
        soId={(() => {
          // 1순위: 선택된 납부계정의 SO_ID (API 응답에서 직접 제공)
          if (selectedPymAcntId) {
            const account = paymentAccounts.find(a => a.PYM_ACNT_ID === selectedPymAcntId);
            if (account?.SO_ID) return account.SO_ID;
          }
          // 2순위: 계약 데이터에서 PYM_ACNT_ID → SO_ID 매핑
          if (selectedPymAcntId && contracts.length > 0) {
            const matchedAll = contracts.filter(c => c.PYM_ACNT_ID === selectedPymAcntId && c.SO_ID);
            if (matchedAll.length > 0) {
              const active = matchedAll.find(c => c.CTRT_STAT_CD === '10');
              return (active || matchedAll[0]).SO_ID!;
            }
          }
          // 3순위: 세션 정보 fallback
          try {
            const u = JSON.parse(sessionStorage.getItem('userInfo') || localStorage.getItem('userInfo') || '{}');
            const list = u.authSoList || u.AUTH_SO_List || [];
            return list[0]?.SO_ID || list[0]?.soId || u.soId || u.SO_ID || '';
          } catch { return ''; }
        })()}
      />

      {/* 납부방법 변경 모달 */}
      <PaymentChangeModal
        isOpen={showPaymentChangeModal}
        onClose={() => {
          setShowPaymentChangeModal(false);
          loadPaymentAccounts();
          if (selectedPymAcntId) loadBillingDetails(selectedPymAcntId);
        }}
        custId={custId}
        custNm={custNm}
        soId={(() => {
          if (selectedPymAcntId) {
            const account = paymentAccounts.find(a => a.PYM_ACNT_ID === selectedPymAcntId);
            if (account?.SO_ID) return account.SO_ID;
          }
          if (selectedPymAcntId && contracts.length > 0) {
            const matched = contracts.filter(c => c.PYM_ACNT_ID === selectedPymAcntId && c.SO_ID);
            if (matched.length > 0) return (matched.find(c => c.CTRT_STAT_CD === '10') || matched[0]).SO_ID!;
          }
          try {
            const u = JSON.parse(sessionStorage.getItem('userInfo') || localStorage.getItem('userInfo') || '{}');
            const list = u.authSoList || u.AUTH_SO_List || [];
            return list[0]?.SO_ID || list[0]?.soId || u.soId || u.SO_ID || '';
          } catch { return ''; }
        })()}
        initialPymAcntId={selectedPymAcntId || ''}
        showToast={showToast}
        onSuccess={() => {
          loadPaymentAccounts();
        }}
      />

      {/* 납부계정 전환 확인 모달 */}
      {showSwitchConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-5 max-w-sm mx-4 shadow-xl">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-orange-100 flex items-center justify-center">
                <AlertCircle className="w-5 h-5 text-orange-500" />
              </div>
              <h3 className="text-base font-medium text-gray-900">납부정보 변경 중</h3>
            </div>
            <p className="text-sm text-gray-600 mb-5">
              다른 납부계정의 변경 작업이 진행 중입니다.<br />
              기존 작업을 취소하고 새 계정으로 이동하시겠습니까?
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowSwitchConfirm(false);
                  setPendingSwitchPymAcntId('');
                }}
                className="flex-1 px-4 py-2 text-sm text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
              >
                취소
              </button>
              <button
                onClick={confirmSwitchPaymentAccount}
                className="flex-1 px-4 py-2 text-sm text-white bg-orange-500 rounded-lg hover:bg-orange-600 transition-colors"
              >
                계정 전환
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PaymentInfo;
