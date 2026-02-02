import React, { useState, useEffect } from 'react';
import {
  ChevronDown, ChevronUp, Loader2,
  AlertCircle, RefreshCw
} from 'lucide-react';

import {
  UnpaymentInfo,
  getPaymentAccounts,
  getBillingDetails,
  getUnpaymentList,
  PaymentAccountInfo,
  BillingDetailInfo,
  formatCurrency,
  maskString
} from '../../services/customerApi';
import UnpaymentCollectionModal from './UnpaymentCollectionModal';

// 납부계정ID 포맷 (3-3-4)
const formatPymAcntId = (pymAcntId: string): string => {
  if (!pymAcntId) return '-';
  const cleaned = pymAcntId.replace(/[^0-9]/g, '');
  if (cleaned.length === 10) {
    return `${cleaned.slice(0, 3)}-${cleaned.slice(3, 6)}-${cleaned.slice(6, 10)}`;
  }
  return pymAcntId;
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
  currentWorkingPymAcntId
}) => {
  // 데이터 상태 (D'Live API 응답 기준)
  const [paymentAccounts, setPaymentAccounts] = useState<PaymentAccountInfo[]>([]);
  const [billingDetails, setBillingDetails] = useState<BillingDetailInfo[]>([]);
  const [unpaymentList, setUnpaymentList] = useState<UnpaymentInfo[]>([]);

  // 로딩 상태
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingBilling, setIsLoadingBilling] = useState(false);

  // 선택된 납부계정
  const [selectedPymAcntId, setSelectedPymAcntId] = useState<string | null>(null);

  // 요금내역 펼침 상태
  const [showBillingDetail, setShowBillingDetail] = useState(true);

  // 미납금 수납 모달
  const [showUnpaymentModal, setShowUnpaymentModal] = useState(false);

  // 납부계정 전환 확인 모달
  const [showSwitchConfirm, setShowSwitchConfirm] = useState(false);
  const [pendingSwitchPymAcntId, setPendingSwitchPymAcntId] = useState<string>('');

  // 데이터 로드
  useEffect(() => {
    if (expanded && custId) {
      loadPaymentAccounts();
    }
  }, [expanded, custId]);

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
      const [paymentRes, unpaymentRes] = await Promise.all([
        getPaymentAccounts(custId),
        getUnpaymentList(custId)
      ]);

      if (paymentRes.success && paymentRes.data) {
        setPaymentAccounts(paymentRes.data);
        // 첫 번째 납부계정 자동 선택
        if (paymentRes.data.length > 0 && !selectedPymAcntId) {
          setSelectedPymAcntId(paymentRes.data[0].PYM_ACNT_ID);
        }
      }

      if (unpaymentRes.success && unpaymentRes.data) {
        setUnpaymentList(unpaymentRes.data);
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

  // 총 미납금액 (납부계정별 합계)
  const totalUnpayment = paymentAccounts.reduce((sum, item) => sum + (item.UPYM_AMT_ACNT || 0), 0);

  // 선택된 납부계정 정보
  const selectedPayment = paymentAccounts.find(p => p.PYM_ACNT_ID === selectedPymAcntId);

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200">
      {/* 헤더 */}
      <button
        onClick={onToggle}
        className="w-full px-3 py-2.5 flex items-center justify-between text-left"
      >
        <div className="flex items-center gap-2">
          <span className="font-medium text-gray-800">납부정보 / 요금내역</span>
          {totalUnpayment > 0 && (
            <span className="text-sm text-red-500 font-medium">
              (미납 {formatCurrency(totalUnpayment)}원)
            </span>
          )}
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
                  <div className="flex items-center gap-1">
                    <span className="text-sm font-medium text-gray-700">납부 정보</span>
                    <button
                      onClick={loadPaymentAccounts}
                      className="p-1 text-gray-400 hover:text-gray-600"
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <span className="text-xs text-gray-500">{paymentAccounts.length}건</span>
                </div>

                {/* 납부 정보 목록 */}
                {paymentAccounts.length === 0 ? (
                  <div className="text-center py-4 text-gray-500 text-sm">
                    납부 정보가 없습니다.
                  </div>
                ) : (
                  <div className="space-y-3">
                    {paymentAccounts.map((payment) => {
                      const isWorking = currentWorkingPymAcntId === payment.PYM_ACNT_ID;
                      const isSelected = selectedPymAcntId === payment.PYM_ACNT_ID;

                      return (
                        <div
                          key={payment.PYM_ACNT_ID}
                          onClick={() => handleSelectPaymentAccount(payment.PYM_ACNT_ID)}
                          className={`p-3 rounded-lg border cursor-pointer transition-all ${
                            isWorking
                              ? 'bg-orange-50 border-orange-300'
                              : isSelected
                                ? 'bg-blue-50 border-blue-400 ring-2 ring-blue-200'
                                : 'bg-gray-50 border-gray-200 hover:border-gray-300'
                          }`}
                        >
                          {/* 배지 (선택됨 / 작업중) */}
                          {(isSelected || isWorking) && (
                            <div className="flex justify-end mb-2 gap-1">
                              {isSelected && (
                                <span className="px-2 py-0.5 text-xs bg-blue-500 text-white rounded-full">
                                  선택됨
                                </span>
                              )}
                              {isWorking && (
                                <span className="px-2 py-0.5 text-xs bg-orange-500 text-white rounded-full animate-pulse">
                                  작업중
                                </span>
                              )}
                            </div>
                          )}

                          {/* 정보 테이블 - 가로 키-값 형태 */}
                          <table className="w-full text-sm table-fixed">
                            <colgroup>
                              <col style={{ width: '25%' }} />
                              <col style={{ width: '25%' }} />
                              <col style={{ width: '25%' }} />
                              <col style={{ width: '25%' }} />
                            </colgroup>
                            <tbody>
                              <tr>
                                <td className="text-gray-500 py-1 text-xs">납부계정번호</td>
                                <td className="text-gray-800 font-medium py-1 truncate">{formatPymAcntId(payment.PYM_ACNT_ID)}</td>
                                <td className="text-gray-500 py-1 text-xs">납부방법</td>
                                <td className="text-gray-800 py-1 truncate">{payment.PYM_MTHD_NM || '-'}</td>
                              </tr>
                              <tr>
                                <td className="text-gray-500 py-1 text-xs">은행/카드명</td>
                                <td className="text-gray-800 py-1 truncate">{payment.BANK_CARD_NM || '-'}</td>
                                <td className="text-gray-500 py-1 text-xs">계좌/카드번호</td>
                                <td className="text-gray-800 py-1 truncate">{maskString(payment.BANK_CARD_NO || '', 4, 4)}</td>
                              </tr>
                              <tr>
                                <td className="text-gray-500 py-1 text-xs">청구매체</td>
                                <td className="text-gray-800 py-1 truncate" colSpan={3}>{payment.BILL_MTHD || '-'}</td>
                              </tr>
                              <tr>
                                <td className="text-gray-500 py-1 text-xs">미납금액 합계</td>
                                <td className={`py-1 font-bold ${payment.UPYM_AMT_ACNT > 0 ? 'text-red-600' : 'text-gray-800'}`} colSpan={3}>
                                  {formatCurrency(payment.UPYM_AMT_ACNT || 0)}원
                                </td>
                              </tr>
                            </tbody>
                          </table>

                          {/* 납부정보 변경 버튼 */}
                          {onNavigateToPaymentChange && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handlePaymentChangeClick(payment.PYM_ACNT_ID);
                              }}
                              className="w-full mt-3 py-2 text-sm text-indigo-600 bg-indigo-50 hover:bg-indigo-100 rounded-lg transition-colors font-medium"
                            >
                              납부정보 변경
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* 미납금 수납 버튼 */}
                {totalUnpayment > 0 && (
                  <button
                    onClick={() => setShowUnpaymentModal(true)}
                    className="w-full mt-3 py-2.5 text-sm bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors font-medium"
                  >
                    미납금 수납 ({formatCurrency(totalUnpayment)}원)
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
                        요금 내역이 없습니다.
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {billingDetails.map((item, index) => (
                          <div
                            key={index}
                            className={`p-3 rounded-lg border ${
                              item.UPYM_AMT > 0 ? 'bg-red-50 border-red-200' : 'bg-gray-50 border-gray-200'
                            }`}
                          >
                            <table className="w-full text-sm table-fixed">
                              <colgroup>
                                <col style={{ width: '25%' }} />
                                <col style={{ width: '25%' }} />
                                <col style={{ width: '25%' }} />
                                <col style={{ width: '25%' }} />
                              </colgroup>
                              <tbody>
                                <tr>
                                  <td className="text-gray-500 py-1 text-xs">청구년월</td>
                                  <td className="text-gray-800 font-medium py-1">{item.BILL_YYMM}</td>
                                  <td className="text-gray-500 py-1 text-xs">청구주기</td>
                                  <td className="text-gray-800 py-1">{item.BILL_CYCL || '정기'}</td>
                                </tr>
                                <tr>
                                  <td className="text-gray-500 py-1 text-xs">청구금액</td>
                                  <td className="text-gray-800 font-medium py-1">{formatCurrency(item.BILL_AMT)}원</td>
                                  <td className="text-gray-500 py-1 text-xs">수납금액</td>
                                  <td className="text-green-600 font-medium py-1">{formatCurrency(item.RCPT_AMT)}원</td>
                                </tr>
                                <tr>
                                  <td className="text-gray-500 py-1 text-xs">미납금액</td>
                                  <td className={`py-1 font-bold ${item.UPYM_AMT > 0 ? 'text-red-600' : 'text-gray-600'}`} colSpan={3}>
                                    {formatCurrency(item.UPYM_AMT)}원
                                  </td>
                                </tr>
                              </tbody>
                            </table>
                          </div>
                        ))}
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
        onClose={() => setShowUnpaymentModal(false)}
        custId={custId}
        custNm={custNm}
        unpaymentList={unpaymentList}
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
