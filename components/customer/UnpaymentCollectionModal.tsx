import React, { useState, useEffect } from 'react';
import { X, Loader2, AlertCircle, CheckCircle, CreditCard, ChevronDown } from 'lucide-react';
import {
  UnpaymentInfo,
  formatCurrency,
  getCardVendorBySoId,
  insertDpstAndDTL,
  processCardPayment,
  generateOrderNo,
  getOrderDate,
  CardDpstParams,
  CardDpstDtlItem
} from '../../services/customerApi';

// ID 포맷 (3-3-4) - 납부계정ID, 고객ID 등
const formatId = (id: string): string => {
  if (!id) return '-';
  const cleaned = id.replace(/[^0-9]/g, '');
  if (cleaned.length === 10) {
    return `${cleaned.slice(0, 3)}-${cleaned.slice(3, 6)}-${cleaned.slice(6, 10)}`;
  }
  return id;
};

// 고객명 마스킹 (홍길동 → 홍*동)
const maskName = (name: string): string => {
  if (!name || name.length < 2) return name || '-';
  if (name.length === 2) return name[0] + '*';
  return name[0] + '*'.repeat(name.length - 2) + name[name.length - 1];
};

// 상품명에서 "정기0" 제거
const cleanProdNm = (prodNm: string): string => {
  return prodNm?.replace(/정기\d*/g, '').trim() || '';
};

// 청구년월 포맷 (YYYYMM → YYYY-MM)
const formatBillYm = (ym: string): string => {
  if (!ym || ym.length < 6) return ym || '-';
  return `${ym.slice(0, 4)}-${ym.slice(4, 6)}`;
};

// 카드번호 포맷 (4자리씩)
const formatCardNo = (value: string): string => {
  const digits = value.replace(/\D/g, '').slice(0, 16);
  const groups = [];
  for (let i = 0; i < digits.length; i += 4) {
    groups.push(digits.slice(i, i + 4));
  }
  return groups.join('-');
};

interface UnpaymentCollectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  custId: string;
  custNm?: string;
  pymAcntId?: string;
  soId?: string;
  unpaymentList: UnpaymentInfo[];
  showToast?: (message: string, type: 'success' | 'error' | 'warning' | 'info') => void;
  onSuccess?: () => void;
}

/**
 * 미납금 수납 모달 (카드결제)
 *
 * 결제 흐름:
 * 1. 미납 항목 선택 + 카드정보 입력
 * 2. "카드수납" 클릭 → getCardVendorBySoId + insertDpstAndDTL
 * 3. "결제하기" 클릭 → insertCardPayStage + processCardPayment (PG)
 */
const UnpaymentCollectionModal: React.FC<UnpaymentCollectionModalProps> = ({
  isOpen,
  onClose,
  custId,
  custNm,
  pymAcntId,
  soId,
  unpaymentList,
  showToast,
  onSuccess
}) => {
  // 선택된 미납 항목
  const [selectedItems, setSelectedItems] = useState<Set<number>>(new Set());

  // 처리 상태: 'select' → 'processing' → 'completed'
  const [isProcessing, setIsProcessing] = useState(false);
  const [isCompleted, setIsCompleted] = useState(false);

  // 카드 입력 폼
  const [cardNo, setCardNo] = useState('');
  const [expMonth, setExpMonth] = useState('');
  const [expYear, setExpYear] = useState('');
  const [installment, setInstallment] = useState('00'); // '00' = 일시불
  const [korId, setKorId] = useState('');  // 생년월일(6) 또는 사업자번호(10)

  // 결제 결과 정보
  const [paymentResult, setPaymentResult] = useState<{
    mid?: string;
    orderNo?: string;
    orderDt?: string;
  } | null>(null);

  // 모달 열릴 때 초기화
  useEffect(() => {
    if (isOpen) {
      setSelectedItems(new Set(unpaymentList.map((_, idx) => idx)));
      setIsCompleted(false);
      setCardNo('');
      setExpMonth('');
      setExpYear('');
      setInstallment('00');
      setKorId('');
      setPaymentResult(null);
    }
  }, [isOpen, unpaymentList]);

  // 백그라운드 스크롤 제어
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [isOpen]);

  if (!isOpen) return null;

  // 개별 항목 선택/해제
  const toggleItem = (index: number) => {
    const newSelected = new Set(selectedItems);
    if (newSelected.has(index)) {
      newSelected.delete(index);
    } else {
      newSelected.add(index);
    }
    setSelectedItems(newSelected);
  };

  // 전체 선택/해제
  const toggleAll = () => {
    if (selectedItems.size === unpaymentList.length) {
      setSelectedItems(new Set());
    } else {
      setSelectedItems(new Set(unpaymentList.map((_, idx) => idx)));
    }
  };

  // 선택된 금액 합계
  const selectedTotal = unpaymentList
    .filter((_, idx) => selectedItems.has(idx))
    .reduce((sum, item) => sum + (item.UNPAY_AMT || 0), 0);

  // 전체 미납 금액
  const totalUnpayment = unpaymentList.reduce((sum, item) => sum + (item.UNPAY_AMT || 0), 0);

  // 카드번호 입력 핸들러
  const handleCardNoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value.replace(/\D/g, '').slice(0, 16);
    setCardNo(raw);
  };

  // 생년월일/사업자번호 입력 핸들러
  const handleKorIdChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value.replace(/\D/g, '').slice(0, 10);
    setKorId(raw);
  };

  // 폼 유효성 검증
  const validateForm = (): string | null => {
    if (selectedItems.size === 0) return '수납할 항목을 선택해주세요.';
    if (cardNo.length < 15) return '카드번호를 정확히 입력해주세요.';
    if (!expMonth || !expYear) return '유효기간을 선택해주세요.';
    if (korId.length < 6) return '생년월일(6자리) 또는 사업자번호(10자리)를 입력해주세요.';
    return null;
  };

  // 카드 유효기간 년도 옵션 (현재~10년후)
  const currentYear = new Date().getFullYear();
  const yearOptions = Array.from({ length: 11 }, (_, i) => {
    const y = currentYear + i;
    return { value: String(y).slice(2), label: String(y) };
  });

  // 결제 처리
  const handlePayment = async () => {
    const error = validateForm();
    if (error) {
      showToast?.(error, 'warning');
      return;
    }

    setIsProcessing(true);

    try {
      // Step 1: 카드사 벤더(MID) 조회
      console.log('[Payment] Step 1: getCardVendorBySoId');
      const vendorRes = await getCardVendorBySoId(soId);
      let mid = 'dlivecon';  // 기본 MID
      if (vendorRes.success && vendorRes.data) {
        const vendor = Array.isArray(vendorRes.data) ? vendorRes.data[0] : vendorRes.data;
        if (vendor?.CARD_VENDOR) {
          mid = vendor.CARD_VENDOR;
        }
      }
      console.log('[Payment] MID:', mid);

      const orderDt = getOrderDate();
      const orderNo = generateOrderNo();
      const fullOrderNo = mid + orderDt + orderNo;
      const amountStr = String(selectedTotal);

      // Step 2: 입금 등록 (insertDpstAndDTL)
      console.log('[Payment] Step 2: insertDpstAndDTL');
      const loginId = sessionStorage.getItem('userInfo')
        ? JSON.parse(sessionStorage.getItem('userInfo') || '{}').userId || 'SYSTEM'
        : 'SYSTEM';

      const selectedBills = unpaymentList.filter((_, idx) => selectedItems.has(idx));
      const dtlList: CardDpstDtlItem[] = selectedBills.map((item, idx) => ({
        master_store_id: mid,
        order_dt: orderDt,
        order_no: orderNo,
        BILL_SEQ_NO: String(idx + 1),
        SO_ID: soId || '',
        BILL_AMT: item.BILL_AMT || item.UNPAY_AMT,
        PRE_RCPT_AMT: (item.BILL_AMT || 0) - (item.UNPAY_AMT || 0),
        RCPT_AMT: item.UNPAY_AMT
      }));

      const dpstParams: CardDpstParams = {
        master_store_id: mid,
        order_dt: orderDt,
        order_no: orderNo,
        ctrt_so_id: soId || '',
        pym_acnt_id: pymAcntId || '',
        cust_id: custId,
        prod_info_cd: '0',
        encrypted_amt: amountStr,
        reqr_nm: custNm || '',
        pyr_rel: '01',
        user_id: loginId,
        rcpt_bill_emp_id: loginId,
        smry: '모바일 미납금 카드수납',
        cust_email: '',
        dtlList
      };

      const dpstRes = await insertDpstAndDTL(dpstParams);
      console.log('[Payment] insertDpstAndDTL result:', dpstRes.success);

      // Step 3: PG 결제 요청
      // Stage 03~06은 백엔드 어댑터가 직접 관리 (JSP stage 03 중복 방지)
      console.log('[Payment] Step 3: processCardPayment');
      const payRes = await processCardPayment({
        mid,
        order_dt: orderDt,
        oid: orderNo,
        amount: amountStr,
        buyer: custNm || '',
        productinfo: '미납금수납',
        card_no: cardNo,
        card_expyear: expYear,
        card_expmon: expMonth,
        kor_id: korId,
        install: installment,
        pym_acnt_id: pymAcntId || '',
        encrypted_amt: amountStr,
        so_id: soId || '',
        cust_id: custId
      });

      if (payRes.success) {
        setIsCompleted(true);
        setPaymentResult({ mid, orderNo: fullOrderNo, orderDt });
        showToast?.(`${formatCurrency(selectedTotal)}원 카드수납이 완료되었습니다.`, 'success');
        onSuccess?.();
      } else {
        showToast?.(payRes.message || '결제 처리에 실패했습니다.', 'error');
      }
    } catch (error: any) {
      console.error('[Payment] Error:', error);
      showToast?.(error?.message || '결제 처리 중 오류가 발생했습니다.', 'error');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div
        className="bg-white rounded-xl shadow-xl w-full max-w-md mx-4 max-h-[85vh] flex flex-col"
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
              <span className="font-mono text-blue-600">{formatId(custId)}</span>
            </div>
            {pymAcntId && (
              <div>
                <span className="text-gray-500">납부계정: </span>
                <span className="font-mono text-purple-600">{formatId(pymAcntId)}</span>
              </div>
            )}
          </div>
        </div>

        {/* 완료 상태 */}
        {isCompleted ? (
          <div className="flex-1 flex flex-col items-center justify-center p-8">
            <CheckCircle className="w-16 h-16 text-green-500 mb-4" />
            <h4 className="text-lg font-semibold text-gray-900 mb-2">수납 완료</h4>
            <p className="text-gray-500 text-center mb-6">
              {formatCurrency(selectedTotal)}원이<br />
              정상적으로 수납되었습니다.
            </p>
            <button
              onClick={onClose}
              className="w-full max-w-xs py-3 text-sm font-medium text-white bg-green-500 rounded-lg hover:bg-green-600 transition-colors"
            >
              확인
            </button>
          </div>
        ) : (
          <>
            {/* 미납 목록 */}
            <div className="flex-1 overflow-y-auto p-4 min-h-0">
              {unpaymentList.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 text-gray-400">
                  <AlertCircle className="w-12 h-12 mb-2" />
                  <span>미납 내역이 없습니다.</span>
                </div>
              ) : (
                <div className="space-y-2">
                  {/* 전체 선택 */}
                  <label className="flex items-center gap-3 p-3 bg-blue-50 rounded-lg cursor-pointer border border-blue-200">
                    <input
                      type="checkbox"
                      checked={selectedItems.size === unpaymentList.length}
                      onChange={toggleAll}
                      className="w-5 h-5 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      disabled={isProcessing}
                    />
                    <span className="flex-1 font-medium text-blue-700">
                      전체 선택 ({unpaymentList.length}건)
                    </span>
                    <span className="font-bold text-blue-700">
                      {formatCurrency(totalUnpayment)}원
                    </span>
                  </label>

                  {/* 개별 항목 */}
                  {unpaymentList.map((item, index) => (
                    <label
                      key={index}
                      className={`flex items-center gap-3 p-3 rounded-lg cursor-pointer border transition-colors ${
                        selectedItems.has(index)
                          ? 'bg-red-50 border-red-200'
                          : 'bg-gray-50 border-gray-200'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={selectedItems.has(index)}
                        onChange={() => toggleItem(index)}
                        className="w-5 h-5 rounded border-gray-300 text-red-600 focus:ring-red-500"
                        disabled={isProcessing}
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-medium text-gray-900">
                            {formatBillYm(item.BILL_YM)}
                          </span>
                          <span className={`text-sm font-bold ${
                            selectedItems.has(index) ? 'text-red-600' : 'text-gray-700'
                          }`}>
                            {formatCurrency(item.UNPAY_AMT)}원
                          </span>
                        </div>
                        <div className="text-xs text-gray-500 mt-0.5 truncate">
                          {cleanProdNm(item.PROD_NM)}
                          {item.UNPAY_DAYS ? ` | 미납 ${item.UNPAY_DAYS}일` : ''}
                        </div>
                      </div>
                    </label>
                  ))}
                </div>
              )}
            </div>

            {/* 푸터 - 합계 + 카드폼 + 버튼 */}
            <div className="p-4 border-t border-gray-200 bg-gray-50 rounded-b-xl">
              {/* 선택 합계 */}
              <div className="flex items-center justify-between mb-3 p-3 bg-white rounded-lg border border-gray-200">
                <span className="text-sm text-gray-600">
                  선택 금액 ({selectedItems.size}건)
                </span>
                <span className="text-xl font-bold text-red-600">
                  {formatCurrency(selectedTotal)}원
                </span>
              </div>

              {/* 카드 정보 입력 */}
              <div className="mb-3 p-3 bg-white rounded-lg border border-gray-200">
                <div className="flex items-center gap-1.5 mb-3">
                  <CreditCard className="w-4 h-4 text-gray-500" />
                  <span className="text-sm font-medium text-gray-700">카드 정보</span>
                </div>

                {/* 카드번호 */}
                <div className="mb-2.5">
                  <label className="block text-xs text-gray-500 mb-1">카드번호</label>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={formatCardNo(cardNo)}
                    onChange={handleCardNoChange}
                    placeholder="0000-0000-0000-0000"
                    disabled={isProcessing}
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500 outline-none disabled:bg-gray-100 font-mono tracking-wider"
                    maxLength={19}
                  />
                </div>

                {/* 유효기간 + 할부 (한 줄) */}
                <div className="flex gap-2 mb-2.5">
                  {/* 유효기간 */}
                  <div className="flex-1">
                    <label className="block text-xs text-gray-500 mb-1">유효기간</label>
                    <div className="flex gap-1">
                      <div className="relative flex-1">
                        <select
                          value={expMonth}
                          onChange={(e) => setExpMonth(e.target.value)}
                          disabled={isProcessing}
                          className="w-full px-2 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500 outline-none appearance-none bg-white disabled:bg-gray-100 pr-7"
                        >
                          <option value="">월</option>
                          {Array.from({ length: 12 }, (_, i) => {
                            const m = String(i + 1).padStart(2, '0');
                            return <option key={m} value={m}>{m}</option>;
                          })}
                        </select>
                        <ChevronDown className="absolute right-1.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none" />
                      </div>
                      <span className="self-center text-gray-400 text-sm">/</span>
                      <div className="relative flex-1">
                        <select
                          value={expYear}
                          onChange={(e) => setExpYear(e.target.value)}
                          disabled={isProcessing}
                          className="w-full px-2 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500 outline-none appearance-none bg-white disabled:bg-gray-100 pr-7"
                        >
                          <option value="">년</option>
                          {yearOptions.map(y => (
                            <option key={y.value} value={y.value}>{y.label}</option>
                          ))}
                        </select>
                        <ChevronDown className="absolute right-1.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none" />
                      </div>
                    </div>
                  </div>

                  {/* 할부 */}
                  <div className="w-24">
                    <label className="block text-xs text-gray-500 mb-1">할부</label>
                    <div className="relative">
                      <select
                        value={installment}
                        onChange={(e) => setInstallment(e.target.value)}
                        disabled={isProcessing}
                        className="w-full px-2 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500 outline-none appearance-none bg-white disabled:bg-gray-100 pr-7"
                      >
                        <option value="00">일시불</option>
                        {[2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map(m => (
                          <option key={m} value={String(m).padStart(2, '0')}>{m}개월</option>
                        ))}
                      </select>
                      <ChevronDown className="absolute right-1.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none" />
                    </div>
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
                    value={korId}
                    onChange={handleKorIdChange}
                    placeholder="예) 900101"
                    disabled={isProcessing}
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500 outline-none disabled:bg-gray-100"
                    maxLength={10}
                  />
                </div>
              </div>

              {/* 버튼 */}
              <div className="flex gap-2">
                <button
                  onClick={onClose}
                  disabled={isProcessing}
                  className="flex-1 py-3 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 transition-colors"
                >
                  취소
                </button>
                <button
                  onClick={handlePayment}
                  disabled={isProcessing || selectedItems.size === 0}
                  className="flex-1 py-3 text-sm font-medium text-white bg-red-500 rounded-lg hover:bg-red-600 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
                >
                  {isProcessing ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      결제 처리 중...
                    </>
                  ) : (
                    <>결제하기 {selectedTotal > 0 ? formatCurrency(selectedTotal) + '원' : ''}</>
                  )}
                </button>
              </div>

              {/* 안내 메시지 */}
              <p className="mt-3 text-xs text-gray-400 text-center">
                * 수납 처리 후에는 취소가 불가능합니다.
              </p>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default UnpaymentCollectionModal;
