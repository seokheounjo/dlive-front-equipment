import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  X, CreditCard, Lock, Loader2, AlertCircle,
  CheckCircle, ChevronDown, ChevronUp, RefreshCw
} from 'lucide-react';

import Select from '../ui/Select';
import {
  UnpaymentInfo,
  PendingPaymentInfo,
  formatCurrency,
  getCardVendorBySoId,
  insertDpstAndDTL,
  processCardPayment,
  checkPaymentResult,
  getPendingPayments,
  savePendingPayment,
  removePendingPayment,
  getPendingInfoForBillYm
} from '../../services/customerApi';

// ID 포맷 (3-3-4)
const formatId = (id: string): string => {
  if (!id) return '-';
  const cleaned = id.replace(/[^0-9]/g, '');
  if (cleaned.length === 10) {
    return `${cleaned.slice(0, 3)}-${cleaned.slice(3, 6)}-${cleaned.slice(6, 10)}`;
  }
  return id;
};

// 고객명 마스킹
const maskName = (name?: string): string => {
  if (!name || name.length < 2) return name || '-';
  if (name.length === 2) return name[0] + '*';
  return name[0] + '*'.repeat(name.length - 2) + name[name.length - 1];
};

// 청구년월 포맷 (YYYYMM -> YYYY-MM)
const formatBillYm = (ym: string): string => {
  if (!ym || ym.length < 6) return ym || '-';
  return `${ym.slice(0, 4)}-${ym.slice(4, 6)}`;
};

// 상품명 정리
const cleanProdNm = (prodNm: string): string => {
  return prodNm?.replace(/정기\d*/g, '').trim() || '';
};

interface UnpaymentCollectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  custId: string;
  custNm?: string;
  pymAcntId: string;
  unpaymentList: UnpaymentInfo[];
  showToast?: (message: string, type: 'success' | 'error' | 'warning' | 'info') => void;
  onSuccess?: () => void;
}

const UnpaymentCollectionModal: React.FC<UnpaymentCollectionModalProps> = ({
  isOpen,
  onClose,
  custId,
  custNm,
  pymAcntId,
  unpaymentList,
  showToast,
  onSuccess
}) => {
  // ========== State ==========
  const [selectedBillYms, setSelectedBillYms] = useState<Set<string>>(new Set());
  const [pendingPayments, setPendingPayments] = useState<PendingPaymentInfo[]>([]);

  // Card form
  const [cardNo, setCardNo] = useState('');
  const [expMonth, setExpMonth] = useState('');
  const [expYear, setExpYear] = useState('');
  const [korId, setKorId] = useState('');
  const [installment, setInstallment] = useState('00');

  // Processing state
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingBillYms, setProcessingBillYms] = useState<string[]>([]);

  // UI state
  const [showCardForm, setShowCardForm] = useState(true);
  const [completedBillYms, setCompletedBillYms] = useState<Set<string>>(new Set());

  // Payment popup
  const [paymentPopup, setPaymentPopup] = useState<{
    visible: boolean;
    status: 'processing' | 'success' | 'fail' | 'pending';
    message: string;
  } | null>(null);

  // Refresh state
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Initialize on open
  useEffect(() => {
    if (isOpen && pymAcntId) {
      const stored = getPendingPayments(pymAcntId);
      setPendingPayments(stored);
      setCompletedBillYms(new Set());
      // 기본 전체 선택 (non-pending만)
      const nonPendingYms = unpaymentList
        .filter(item => !stored.some(p => p.pendingBillYms.includes(item.BILL_YM)))
        .map(item => item.BILL_YM);
      setSelectedBillYms(new Set(nonPendingYms));
    }
  }, [isOpen, pymAcntId, unpaymentList]);

  // Body scroll lock (position: fixed 방식 — 모바일 overlay 스크롤 차단 방지)
  useEffect(() => {
    if (isOpen) {
      const scrollY = window.scrollY;
      document.body.style.position = 'fixed';
      document.body.style.top = `-${scrollY}px`;
      document.body.style.width = '100%';
    } else {
      const scrollY = Math.abs(parseInt(document.body.style.top || '0', 10));
      document.body.style.position = '';
      document.body.style.top = '';
      document.body.style.width = '';
      window.scrollTo(0, scrollY);
    }
    return () => {
      const scrollY = Math.abs(parseInt(document.body.style.top || '0', 10));
      document.body.style.position = '';
      document.body.style.top = '';
      document.body.style.width = '';
      window.scrollTo(0, scrollY);
    };
  }, [isOpen]);

  // ========== Derived ==========

  const pendingBillYmMap = useMemo(() => {
    const map = new Map<string, PendingPaymentInfo>();
    for (const p of pendingPayments) {
      for (const ym of p.pendingBillYms) {
        map.set(ym, p);
      }
    }
    return map;
  }, [pendingPayments]);

  const nonPendingSelected = useMemo(() => {
    return unpaymentList.filter(
      item => selectedBillYms.has(item.BILL_YM) && !pendingBillYmMap.has(item.BILL_YM)
    );
  }, [unpaymentList, selectedBillYms, pendingBillYmMap]);

  const selectedTotal = useMemo(() => {
    return nonPendingSelected.reduce((sum, item) => sum + (item.UNPAY_AMT || 0), 0);
  }, [nonPendingSelected]);

  const pendingItems = useMemo(() => {
    return unpaymentList.filter(item => pendingBillYmMap.has(item.BILL_YM));
  }, [unpaymentList, pendingBillYmMap]);

  const pendingTotal = useMemo(() => {
    return pendingItems.reduce((sum, item) => sum + (item.UNPAY_AMT || 0), 0);
  }, [pendingItems]);

  const selectableItems = useMemo(() => {
    return unpaymentList.filter(item => !pendingBillYmMap.has(item.BILL_YM));
  }, [unpaymentList, pendingBillYmMap]);

  const allSelectableSelected = selectableItems.length > 0 &&
    selectableItems.every(item => selectedBillYms.has(item.BILL_YM));

  // Card input disabled when processing or pending exists
  const isCardInputDisabled = isProcessing || pendingPayments.length > 0;

  // ========== Handlers ==========

  const toggleBillYm = useCallback((billYm: string) => {
    if (pendingBillYmMap.has(billYm)) return;
    setSelectedBillYms(prev => {
      const next = new Set(prev);
      if (next.has(billYm)) {
        next.delete(billYm);
      } else {
        next.add(billYm);
      }
      return next;
    });
  }, [pendingBillYmMap]);

  const toggleAll = useCallback(() => {
    if (allSelectableSelected) {
      setSelectedBillYms(prev => {
        const next = new Set(prev);
        selectableItems.forEach(item => next.delete(item.BILL_YM));
        return next;
      });
    } else {
      setSelectedBillYms(prev => {
        const next = new Set(prev);
        selectableItems.forEach(item => next.add(item.BILL_YM));
        return next;
      });
    }
  }, [allSelectableSelected, selectableItems]);

  // Refresh all pending payments
  const handleRefreshAll = useCallback(async () => {
    if (pendingPayments.length === 0 || isRefreshing) return;
    setIsRefreshing(true);

    let anyCompleted = false;

    try {
      for (const pendingInfo of [...pendingPayments]) {
        try {
          const res = await checkPaymentResult({
            OID: pendingInfo.orderNo,
            MID: pendingInfo.mid,
            AMT: pendingInfo.selectedTotal,
            ORDER_DT: pendingInfo.orderDt,
            PYM_ACNT_ID: pymAcntId
          });

          if (res.success) {
            removePendingPayment(pymAcntId, pendingInfo.orderNo);
            setCompletedBillYms(prev => {
              const next = new Set(prev);
              pendingInfo.pendingBillYms.forEach(ym => next.add(ym));
              return next;
            });
            showToast?.(`${formatCurrency(pendingInfo.selectedTotal)}원 결제 완료 확인`, 'success');
            anyCompleted = true;
          } else if (res.errorCode === 'TIMEOUT') {
            showToast?.('결과 조회 시간 초과. 잠시 후 다시 시도해주세요.', 'warning');
          } else if (res.errorCode === 'NOT_FOUND' || res.errorCode === 'PENDING') {
            // Still pending - keep
          } else {
            // Failed - remove pending
            removePendingPayment(pymAcntId, pendingInfo.orderNo);
            showToast?.(`결제 실패 확인: ${res.message || '알 수 없는 오류'}`, 'error');
          }
        } catch (error) {
          console.error('[UnpaymentModal] Refresh check error:', error);
        }
      }

      setPendingPayments(getPendingPayments(pymAcntId));
      if (anyCompleted) {
        onSuccess?.();
      } else {
        showToast?.('아직 처리중입니다. 잠시 후 다시 시도해주세요.', 'info');
      }
    } finally {
      setIsRefreshing(false);
    }
  }, [pendingPayments, isRefreshing, pymAcntId, showToast, onSuccess]);

  // Payment popup handlers
  const closePaymentPopup = useCallback(() => {
    if (paymentPopup?.status === 'processing') return;
    setPaymentPopup(null);
  }, [paymentPopup]);

  const retryPayment = () => {
    setPaymentPopup(null);
    // Auto-retry: trigger payment again after popup closes
    setTimeout(() => handlePayment(), 300);
  };

  // SO_ID 획득 헬퍼
  const getSoId = (): string => {
    try {
      const userInfoStr = sessionStorage.getItem('userInfo') || localStorage.getItem('userInfo');
      if (userInfoStr) {
        const userInfo = JSON.parse(userInfoStr);
        const authSoList = userInfo.authSoList || userInfo.AUTH_SO_List || [];
        if (authSoList.length > 0) {
          return authSoList[0].SO_ID || authSoList[0].soId || '';
        }
        return userInfo.soId || userInfo.SO_ID || '';
      }
    } catch (e) {
      console.error('[UnpaymentModal] Failed to get SO_ID');
    }
    return '';
  };

  // ORDER_NO 생성 (10자리)
  const generateOrderNo = (): string => {
    const ts = Date.now().toString().slice(-7);
    const rand = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
    return ts + rand;
  };

  const handlePayment = async () => {
    if (nonPendingSelected.length === 0) {
      showToast?.('결제할 항목을 선택해주세요.', 'warning');
      return;
    }

    // 카드 검증
    const cleanCardNo = cardNo.replace(/\s/g, '');
    if (cleanCardNo.length !== 16) {
      showToast?.('카드번호 16자리를 입력해주세요.', 'warning');
      return;
    }
    if (!expMonth || !expYear) {
      showToast?.('유효기간을 입력해주세요.', 'warning');
      return;
    }
    if (!korId || (korId.length !== 6 && korId.length !== 10)) {
      showToast?.('생년월일(6자리) 또는 사업자번호(10자리)를 입력해주세요.', 'warning');
      return;
    }

    const billYmList = nonPendingSelected.map(item => item.BILL_YM);

    // Show payment popup
    setPaymentPopup({ visible: true, status: 'processing', message: '' });
    setIsProcessing(true);
    setProcessingBillYms(billYmList);

    try {
      // Step 1: Get MID
      const soId = getSoId();
      let mid = '';
      if (soId) {
        const vendorRes = await getCardVendorBySoId(soId);
        if (vendorRes.success && vendorRes.data) {
          const vendorData = Array.isArray(vendorRes.data) ? vendorRes.data[0] : vendorRes.data;
          mid = vendorData?.MID || vendorData?.CARD_VENDOR || '';
        }
      }
      if (!mid) {
        setPaymentPopup({ visible: true, status: 'fail', message: '가맹점 정보를 조회할 수 없습니다.' });
        setIsProcessing(false);
        setProcessingBillYms([]);
        return;
      }

      const orderNo = generateOrderNo();
      const now = new Date();
      const orderDt = now.getFullYear().toString() +
        (now.getMonth() + 1).toString().padStart(2, '0') +
        now.getDate().toString().padStart(2, '0');

      // Step 2: Insert DPST & DTL
      const dpstRes = await insertDpstAndDTL({
        CUST_ID: custId,
        PYM_ACNT_ID: pymAcntId,
        SO_ID: soId,
        AMT: selectedTotal,
        MID: mid,
        ORDER_DT: orderDt,
        OID: orderNo,
        CUST_NM: custNm || custId || 'Mobile',
        BILL_YM_LIST: billYmList.join(','),
      });

      if (!dpstRes.success) {
        setPaymentPopup({ visible: true, status: 'fail', message: dpstRes.message || '입금 등록 실패' });
        setIsProcessing(false);
        setProcessingBillYms([]);
        return;
      }

      // Use backend-generated ORDER_NO and MERT_KEY if available
      const actualOrderNo = dpstRes.data?.ORDER_NO || orderNo;
      const mertKey = dpstRes.data?.MERT_KEY || '';

      // Step 3: Save pending BEFORE PG call
      const pendingInfo: PendingPaymentInfo = {
        cardNo: cleanCardNo.slice(-4),
        expMonth,
        expYear,
        installment,
        korId: korId.slice(0, 2) + '****',
        mid,
        orderNo: actualOrderNo,
        orderDt,
        selectedTotal,
        timestamp: Date.now(),
        pendingBillYms: billYmList
      };
      savePendingPayment(pymAcntId, pendingInfo);
      setPendingPayments(getPendingPayments(pymAcntId));

      // 선택 해제 (pending으로 전환됨)
      setSelectedBillYms(prev => {
        const next = new Set(prev);
        billYmList.forEach(ym => next.delete(ym));
        return next;
      });

      // Step 4: Process card payment (may timeout)
      const pgRes = await processCardPayment({
        mid,
        oid: actualOrderNo,
        order_dt: orderDt,
        amount: String(selectedTotal),
        buyer: custNm || '',
        productinfo: 'DLIVE_UNPAY',
        card_no: cleanCardNo,
        card_expyear: expYear,
        card_expmon: expMonth,
        kor_id: korId,
        install: installment,
        pym_acnt_id: pymAcntId,
        encrypted_amt: String(selectedTotal),
        so_id: soId,
        cust_id: custId,
        mert_key: mertKey,
      });

      if (pgRes.success) {
        removePendingPayment(pymAcntId, actualOrderNo);
        setPendingPayments(getPendingPayments(pymAcntId));
        setCompletedBillYms(prev => {
          const next = new Set(prev);
          billYmList.forEach(ym => next.add(ym));
          return next;
        });
        setPaymentPopup({ visible: true, status: 'success', message: '' });
        showToast?.(`${formatCurrency(selectedTotal)}원 결제가 완료되었습니다.`, 'success');
        onSuccess?.();
      } else if (pgRes.errorCode === 'TIMEOUT') {
        // PG timeout - pending remains
        setPaymentPopup({ visible: true, status: 'pending', message: '' });
      } else {
        // Explicit failure - remove pending
        removePendingPayment(pymAcntId, actualOrderNo);
        setPendingPayments(getPendingPayments(pymAcntId));
        setPaymentPopup({ visible: true, status: 'fail', message: pgRes.message || '서버 오류' });
      }
    } catch (error: any) {
      console.error('[UnpaymentModal] Payment error:', error);
      // Network error etc - pending may still be processing
      setPaymentPopup({ visible: true, status: 'pending', message: '' });
    } finally {
      setIsProcessing(false);
      setProcessingBillYms([]);
    }
  };

  // Card number formatting
  const formatCardInput = (value: string) => {
    const digits = value.replace(/\D/g, '').slice(0, 16);
    const parts = digits.match(/.{1,4}/g);
    return parts ? parts.join(' ') : digits;
  };

  if (!isOpen) return null;

  const pendingCount = pendingPayments.reduce((sum, p) => sum + p.pendingBillYms.length, 0);

  return (
    <>
      <div className="fixed inset-0 z-[200] overflow-y-auto overscroll-contain bg-black/50 p-4">
        <div
          className="bg-white rounded-xl shadow-xl w-full max-w-md mx-auto flex flex-col"
          onClick={(e) => e.stopPropagation()}
        >
          {/* 헤더 */}
          <div className="flex items-center justify-between p-4 border-b border-gray-200 bg-gradient-to-r from-red-500 to-red-600 rounded-t-xl">
            <div className="flex items-center gap-2 text-white">
              <CreditCard className="w-5 h-5" />
              <h3 className="font-semibold">미납금 수납</h3>
            </div>
            <button
              onClick={onClose}
              className="text-white/80 hover:text-white transition-colors"
              disabled={isProcessing}
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* 고객 정보 */}
          <div className="p-3 bg-gray-50 border-b border-gray-200">
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
              <div>
                <span className="text-gray-500">고객명: </span>
                <span className="font-medium text-gray-900">{maskName(custNm)}</span>
              </div>
              <div>
                <span className="text-gray-500">고객ID: </span>
                <span className="font-mono text-primary-700">{formatId(custId)}</span>
              </div>
              {pymAcntId && (
                <div>
                  <span className="text-gray-500">납부계정: </span>
                  <span className="font-mono text-purple-600">{formatId(pymAcntId)}</span>
                </div>
              )}
            </div>
          </div>

          <div className="p-4 space-y-4">
            {/* Pending 배너 */}
            {pendingCount > 0 && (
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                <div className="flex items-center gap-2 text-amber-700">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span className="text-sm font-medium">
                    진행중인 결제 {pendingPayments.length}건 ({pendingCount}개 항목, {formatCurrency(pendingTotal)}원)
                  </span>
                </div>
              </div>
            )}

            {/* 미납 항목 리스트 */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <h4 className="text-sm font-medium text-gray-700">미납 항목</h4>
                {selectableItems.length > 0 && (
                  <button
                    onClick={toggleAll}
                    disabled={isProcessing}
                    className="text-xs text-blue-500 hover:text-blue-600 disabled:opacity-50"
                  >
                    {allSelectableSelected ? '전체 해제' : '전체 선택'}
                  </button>
                )}
              </div>

              <div className="space-y-2">
                {unpaymentList.map((item) => {
                  const isPending = pendingBillYmMap.has(item.BILL_YM);
                  const pendingInfo = isPending ? pendingBillYmMap.get(item.BILL_YM) : null;
                  const isCompleted = completedBillYms.has(item.BILL_YM);
                  const isCurrentlyProcessing = processingBillYms.includes(item.BILL_YM);
                  const isSelected = selectedBillYms.has(item.BILL_YM);

                  return (
                    <div
                      key={item.BILL_YM + '_' + item.CTRT_ID}
                      className={`rounded-lg border p-3 transition-colors ${
                        isCompleted
                          ? 'bg-green-50 border-green-200'
                          : isPending
                            ? 'bg-amber-50 border-amber-200'
                            : isCurrentlyProcessing
                              ? 'bg-blue-50 border-blue-200'
                              : isSelected
                                ? 'bg-red-50 border-red-200'
                                : 'bg-gray-50 border-gray-200'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        {/* Checkbox */}
                        <div className="flex-shrink-0">
                          {isPending ? (
                            <div className="w-5 h-5 rounded bg-amber-400 flex items-center justify-center">
                              <Lock className="w-3 h-3 text-white" />
                            </div>
                          ) : isCompleted ? (
                            <div className="w-5 h-5 rounded bg-green-500 flex items-center justify-center">
                              <CheckCircle className="w-3 h-3 text-white" />
                            </div>
                          ) : isCurrentlyProcessing ? (
                            <Loader2 className="w-5 h-5 text-blue-500 animate-spin" />
                          ) : (
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => toggleBillYm(item.BILL_YM)}
                              className="w-5 h-5 rounded border-gray-300 text-red-600 focus:ring-red-500"
                              disabled={isProcessing}
                            />
                          )}
                        </div>

                        {/* Content */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-medium text-gray-900">
                                {formatBillYm(item.BILL_YM)}
                              </span>
                              {isPending && (
                                <span className="px-1.5 py-0.5 text-xs font-medium bg-amber-200 text-amber-800 rounded">
                                  진행중
                                </span>
                              )}
                              {isCompleted && (
                                <span className="px-1.5 py-0.5 text-xs font-medium bg-green-200 text-green-800 rounded">
                                  완료
                                </span>
                              )}
                              {isCurrentlyProcessing && (
                                <span className="px-1.5 py-0.5 text-xs font-medium bg-blue-200 text-blue-800 rounded">
                                  처리중
                                </span>
                              )}
                            </div>
                            <span className={`text-sm font-bold ${
                              isCompleted ? 'text-green-600' : 'text-red-600'
                            }`}>
                              {formatCurrency(item.UNPAY_AMT)}원
                            </span>
                          </div>
                          <div className="text-xs text-gray-500 mt-0.5 truncate">
                            {cleanProdNm(item.PROD_NM)}
                            {item.UNPAY_DAYS > 0 && ` | 미납 ${item.UNPAY_DAYS}일`}
                          </div>

                          {/* Pending detail (no check button) */}
                          {isPending && pendingInfo && (
                            <div className="mt-1">
                              <span className="text-xs text-amber-600">
                                카드 ****{pendingInfo.cardNo} | {formatCurrency(pendingInfo.selectedTotal)}원
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* 합계 */}
            <div className="space-y-2">
              {nonPendingSelected.length > 0 && (
                <div className="flex items-center justify-between p-3 bg-white rounded-lg border border-gray-200">
                  <span className="text-sm text-gray-600">
                    선택 금액 ({nonPendingSelected.length}건)
                  </span>
                  <span className="text-xl font-bold text-red-600">
                    {formatCurrency(selectedTotal)}원
                  </span>
                </div>
              )}
              {pendingItems.length > 0 && (
                <div className="flex items-center justify-between p-3 bg-amber-50 rounded-lg border border-amber-200">
                  <span className="text-sm text-amber-700">
                    진행중 ({pendingItems.length}건)
                  </span>
                  <span className="text-sm font-medium text-amber-700">
                    {formatCurrency(pendingTotal)}원
                  </span>
                </div>
              )}
            </div>

            {/* 카드 입력폼 */}
            <div>
              <button
                onClick={() => setShowCardForm(!showCardForm)}
                className="w-full flex items-center justify-between mb-2"
              >
                <h4 className="text-sm font-medium text-gray-700 flex items-center gap-1">
                  <CreditCard className="w-4 h-4" />
                  카드 정보 입력
                </h4>
                {showCardForm ? (
                  <ChevronUp className="w-4 h-4 text-gray-400" />
                ) : (
                  <ChevronDown className="w-4 h-4 text-gray-400" />
                )}
              </button>

              {showCardForm && (
                <div className={`space-y-3 rounded-lg p-3 border ${
                  isCardInputDisabled
                    ? 'bg-gray-100 border-gray-300'
                    : 'bg-gray-50 border-gray-200'
                }`}>
                  {isCardInputDisabled && pendingPayments.length > 0 && (
                    <div className="text-xs text-amber-600 flex items-center gap-1">
                      <Lock className="w-3 h-3" />
                      진행중인 결제가 있어 카드 입력이 잠겨있습니다.
                    </div>
                  )}
                  {/* 카드번호 */}
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">카드번호</label>
                    <input
                      type="text"
                      inputMode="numeric"
                      placeholder="0000 0000 0000 0000"
                      value={formatCardInput(cardNo)}
                      onChange={(e) => setCardNo(e.target.value.replace(/\D/g, '').slice(0, 16))}
                      className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-red-500 focus:border-transparent disabled:bg-gray-100 disabled:text-gray-400"
                      disabled={isCardInputDisabled}
                    />
                  </div>

                  {/* 유효기간 */}
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">유효기간 (월)</label>
                      <Select
                        value={expMonth}
                        onValueChange={(val) => setExpMonth(val)}
                        options={[
                          { value: '', label: 'MM' },
                          ...Array.from({ length: 12 }, (_, i) => {
                            const m = (i + 1).toString().padStart(2, '0');
                            return { value: m, label: m };
                          })
                        ]}
                        placeholder="MM"
                        disabled={isCardInputDisabled}
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">유효기간 (년)</label>
                      <Select
                        value={expYear}
                        onValueChange={(val) => setExpYear(val)}
                        options={[
                          { value: '', label: 'YY' },
                          ...Array.from({ length: 10 }, (_, i) => {
                            const y = (new Date().getFullYear() % 100 + i).toString().padStart(2, '0');
                            return { value: y, label: y };
                          })
                        ]}
                        placeholder="YY"
                        disabled={isCardInputDisabled}
                      />
                    </div>
                  </div>

                  {/* 생년월일/사업자번호 */}
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">
                      생년월일(6자리) / 사업자번호(10자리)
                    </label>
                    <input
                      type="text"
                      inputMode="numeric"
                      placeholder="YYMMDD"
                      value={korId}
                      onChange={(e) => setKorId(e.target.value.replace(/\D/g, '').slice(0, 10))}
                      className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-red-500 focus:border-transparent disabled:bg-gray-100 disabled:text-gray-400"
                      disabled={isCardInputDisabled}
                    />
                  </div>

                  {/* 할부 */}
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">할부</label>
                    <Select
                      value={installment}
                      onValueChange={(val) => setInstallment(val)}
                      options={[
                        { value: '00', label: '일시불' },
                        { value: '02', label: '2개월' },
                        { value: '03', label: '3개월' },
                        { value: '06', label: '6개월' },
                        { value: '12', label: '12개월' }
                      ]}
                      disabled={isCardInputDisabled}
                    />
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* 푸터 */}
          <div className="p-4 border-t border-gray-200 bg-gray-50 rounded-b-xl">
            <div className="flex gap-2">
              <button
                onClick={onClose}
                disabled={isProcessing}
                className="flex-1 py-3 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 transition-colors"
              >
                닫기
              </button>
              {pendingPayments.length > 0 ? (
                <button
                  onClick={handleRefreshAll}
                  disabled={isRefreshing}
                  className="flex-1 py-3 text-sm font-medium text-white bg-blue-500 rounded-lg hover:bg-blue-600 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
                >
                  {isRefreshing ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      조회 중...
                    </>
                  ) : (
                    <>
                      <RefreshCw className="w-4 h-4" />
                      최신화
                    </>
                  )}
                </button>
              ) : nonPendingSelected.length > 0 ? (
                <button
                  onClick={handlePayment}
                  disabled={isProcessing || cardNo.replace(/\D/g, '').length !== 16}
                  className="flex-1 py-3 text-sm font-medium text-white bg-red-500 rounded-lg hover:bg-red-600 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
                >
                  {isProcessing ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      처리 중...
                    </>
                  ) : (
                    `${formatCurrency(selectedTotal)}원 카드수납`
                  )}
                </button>
              ) : (
                <button
                  disabled
                  className="flex-1 py-3 text-sm font-medium text-white bg-gray-400 rounded-lg cursor-not-allowed"
                >
                  항목을 선택하세요
                </button>
              )}
            </div>
            <p className="mt-3 text-xs text-gray-400 text-center">
              * 수납 처리 후에는 취소가 불가능합니다.
            </p>
          </div>
        </div>
      </div>

      {/* Payment Popup Overlay */}
      {paymentPopup?.visible && (
        <div
          className="fixed inset-0 z-[210] flex items-center justify-center bg-black/60"
          onClick={() => paymentPopup.status !== 'processing' && closePaymentPopup()}
        >
          <div
            className="bg-white rounded-2xl shadow-2xl w-72 p-6 text-center"
            onClick={e => e.stopPropagation()}
          >
            {paymentPopup.status === 'processing' && (
              <>
                <Loader2 className="w-14 h-14 text-blue-500 animate-spin mx-auto mb-4" />
                <p className="text-lg font-semibold text-gray-900">결제 진행중...</p>
                <p className="text-sm text-gray-500 mt-1">잠시만 기다려주세요</p>
              </>
            )}

            {paymentPopup.status === 'success' && (
              <>
                <CheckCircle className="w-14 h-14 text-green-500 mx-auto mb-4" />
                <p className="text-lg font-semibold text-gray-900">결제가 완료되었습니다</p>
                <button
                  onClick={closePaymentPopup}
                  className="mt-5 w-full py-2.5 text-sm font-medium text-white bg-green-500 rounded-lg hover:bg-green-600 transition-colors"
                >
                  닫기
                </button>
              </>
            )}

            {paymentPopup.status === 'fail' && (
              <>
                <AlertCircle className="w-14 h-14 text-red-500 mx-auto mb-4" />
                <p className="text-lg font-semibold text-gray-900">결제 실패</p>
                {paymentPopup.message && (
                  <p className="text-sm text-gray-500 mt-1">{paymentPopup.message}</p>
                )}
                <div className="flex gap-2 mt-5">
                  <button
                    onClick={retryPayment}
                    className="flex-1 py-2.5 text-sm font-medium text-white bg-red-500 rounded-lg hover:bg-red-600 transition-colors"
                  >
                    다시시도
                  </button>
                  <button
                    onClick={closePaymentPopup}
                    className="flex-1 py-2.5 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                  >
                    닫기
                  </button>
                </div>
              </>
            )}

            {paymentPopup.status === 'pending' && (
              <>
                <Loader2 className="w-14 h-14 text-amber-500 mx-auto mb-4" />
                <p className="text-lg font-semibold text-gray-900">결제 요청 완료</p>
                <p className="text-sm text-gray-500 mt-1">처리중입니다.</p>
                <p className="text-sm text-gray-500">최신화로 결과를 확인하세요.</p>
                <button
                  onClick={closePaymentPopup}
                  className="mt-5 w-full py-2.5 text-sm font-medium text-white bg-amber-500 rounded-lg hover:bg-amber-600 transition-colors"
                >
                  닫기
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
};

export default UnpaymentCollectionModal;
