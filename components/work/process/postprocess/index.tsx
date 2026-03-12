/**
 * PostProcess - 후처리 화면 메인 컴포넌트
 *
 * 작업완료 이후 모든 작업유형에서 표시되는 후처리 화면
 * 완료된 작업 조회 시에도 표시됨
 */
import React, { useState, useEffect, useCallback } from 'react';
import { WorkOrder } from '../../../../types';
import { ExternalLink, Check, Loader2, RefreshCw, Send, Monitor, Smartphone, Zap, AlertCircle } from 'lucide-react';
import { getAfterProcInfo, getCommonCodeList, getNBGuide, saveNBGuide, CommonCode } from '../../../../services/apiService';
import { useUIStore } from '../../../../stores/uiStore';
import { useWorkProcessStore } from '../../../../stores/workProcessStore';

interface AfterProcStatus {
  hasWarning: boolean;
  message: string | null;
}

interface PostProcessProps {
  order: WorkOrder;
  onBack: () => void;
  onComplete: () => void;
  showToast?: (message: string, type: 'success' | 'error' | 'warning' | 'info') => void;
  onAfterProcStatus?: (status: AfterProcStatus) => void;
}

const PostProcess: React.FC<PostProcessProps> = ({
  order,
  onBack,
  onComplete,
  showToast,
  onAfterProcStatus
}) => {
  // 후처리 미처리 추적 상태
  const [recontractClicked, setRecontractClicked] = useState(false);
  const [newBusinessReviewed, setNewBusinessReviewed] = useState(false);

  // 전자서명 상태 (세분화)
  const [signTarget, setSignTarget] = useState(false);      // 전자서명 대상 여부
  const [signCompleted, setSignCompleted] = useState(false); // 전자서명 완료 여부
  const [signMode, setSignMode] = useState<'customer' | 'face'>('customer'); // 고객서명/대면서명 모드

  // 재약정 상태
  const [recontractTarget, setRecontractTarget] = useState(false);
  const [recontractCompleted, setRecontractCompleted] = useState(false);

  // 자동이체현장접수 상태
  const [autoTransferTarget, setAutoTransferTarget] = useState(false);
  const [autoTransferCompleted, setAutoTransferCompleted] = useState(false);

  // 새로고침 상태
  const [isRefreshing, setIsRefreshing] = useState(false);

  // 신사업안내 상태 (CMCU171, CMCU172)
  const [guideOptions, setGuideOptions] = useState<CommonCode[]>([]);
  const [noGuideOptions, setNoGuideOptions] = useState<CommonCode[]>([]);
  const [guideChecks, setGuideChecks] = useState<{[key: string]: boolean}>({});
  const [noGuideReason, setNoGuideReason] = useState('');
  const [alreadyGuided, setAlreadyGuided] = useState(false);
  const [guideSaving, setGuideSaving] = useState(false);
  const [guideLoading, setGuideLoading] = useState(false);

  // 작업코드
  const wrkCd = order.WRK_CD || '';

  // 신사업홍보 표시 조건: 설치(01), AS(03), 상변(05), 이전설치(07)
  const showNewBusiness = ['01', '03', '05', '07'].includes(wrkCd);

  // 미안내(g0) 선택 여부
  const isNoGuideSelected = guideOptions.length > 0 && guideChecks[guideOptions[0].COMMON_CD] === true;

  // 안내항목(g1~g3) 하나라도 선택 여부
  const hasAnyGuideSelected = guideOptions.slice(1).some(opt => guideChecks[opt.COMMON_CD] === true);

  // 상태 초기화 및 조건 체크
  const loadStatus = useCallback(() => {
    // 전자서명 조건
    const signTyp = (order as any).SIGN_TYP || '';
    const custCl = (order as any).CUST_CL || order.customer?.CUST_CL || '';
    const pdaClickYn = (order as any).PDA_CLICK_YN || '';

    if (signTyp === 'NN' || custCl === 'H') {
      setSignTarget(false);
      setSignCompleted(false);
    } else if (pdaClickYn === 'Y') {
      setSignTarget(true);
      setSignCompleted(true);
    } else {
      setSignTarget(true);
      setSignCompleted(false);
    }

    // 재약정 조건
    const closeDanger = (order as any).CLOSE_DANGER || '';
    if (closeDanger === 'Y') {
      setRecontractTarget(true);
    } else {
      setRecontractTarget(false);
      setRecontractCompleted(false);
    }

    // 자동이체현장접수 조건
    const pymMthd = (order as any).PYM_MTHD || '';
    const atmtYn = (order as any).ATMT_YN || '';
    if (['01', '05', '07'].includes(wrkCd) && pymMthd === '01' && atmtYn === 'Y') {
      setAutoTransferTarget(true);
    } else {
      setAutoTransferTarget(false);
      setAutoTransferCompleted(false);
    }
  }, [order, wrkCd]);

  useEffect(() => {
    loadStatus();
  }, [loadStatus]);

  // 새로고침 핸들러
  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    try {
      loadStatus();
      // afterProcInfo도 재호출
      const wrkDrctnId = order.WRK_DRCTN_ID || order.directionId || '';
      if (wrkDrctnId) {
        const info = await getAfterProcInfo(wrkDrctnId);
        if (info) {
          if (info.CLOSE_DANGER === 'Y') setRecontractTarget(true);
        }
      }
      showToast?.('후처리 정보를 갱신했습니다.', 'success');
    } catch (error) {
      console.error('[PostProcess] refresh error:', error);
    } finally {
      setIsRefreshing(false);
    }
  }, [order, loadStatus, showToast]);

  // 신사업안내 공통코드 + 이미 안내 여부 로드
  useEffect(() => {
    if (!showNewBusiness) return;

    const loadGuideData = async () => {
      setGuideLoading(true);
      try {
        const codes = await getCommonCodeList(['CMCU171', 'CMCU172']);
        const cmcu171 = codes['CMCU171'] || [];
        const cmcu172 = codes['CMCU172'] || [];
        setGuideOptions(cmcu171);
        setNoGuideOptions(cmcu172);

        const initialChecks: {[key: string]: boolean} = {};
        cmcu171.forEach(opt => { initialChecks[opt.COMMON_CD] = false; });
        setGuideChecks(initialChecks);

        const userInfo = localStorage.getItem('userInfo');
        const user = userInfo ? JSON.parse(userInfo) : {};
        const regUid = user.userId || '';
        const custId = (order as any).CUST_ID || order.customer?.id || '';

        if (custId && regUid) {
          const guideResult = await getNBGuide(custId, regUid);
          if (Array.isArray(guideResult) && guideResult.length > 0) {
            setAlreadyGuided(true);
            setNewBusinessReviewed(true);
          }
        }
      } catch (error) {
        console.error('[PostProcess] Failed to load guide data:', error);
      } finally {
        setGuideLoading(false);
      }
    };

    loadGuideData();
  }, [showNewBusiness, order]);

  // 후처리 미처리 상태를 부모에게 전달
  useEffect(() => {
    if (!onAfterProcStatus) return;

    const warnings: string[] = [];
    if (recontractTarget && !recontractClicked && !recontractCompleted) {
      warnings.push('재약정');
    }
    if (signTarget && !signCompleted) {
      warnings.push('전자서명');
    }
    if (showNewBusiness && !newBusinessReviewed) {
      warnings.push('신사업안내');
    }

    if (warnings.length > 0) {
      onAfterProcStatus({
        hasWarning: true,
        message: `${warnings.join(' 및 ')} 처리를 확인해주세요.`,
      });
    } else {
      onAfterProcStatus({ hasWarning: false, message: null });
    }
  }, [recontractClicked, recontractCompleted, recontractTarget, signTarget, signCompleted, newBusinessReviewed, showNewBusiness, onAfterProcStatus]);

  // 미안내(g0) 체크 핸들러
  const handleNoGuideCheck = useCallback((checked: boolean) => {
    if (guideOptions.length === 0) return;
    const newChecks: {[key: string]: boolean} = {};
    guideOptions.forEach((opt, idx) => {
      if (idx === 0) {
        newChecks[opt.COMMON_CD] = checked;
      } else {
        newChecks[opt.COMMON_CD] = checked ? false : guideChecks[opt.COMMON_CD];
      }
    });
    setGuideChecks(newChecks);
    if (!checked) setNoGuideReason('');
  }, [guideOptions, guideChecks]);

  // 안내항목 체크 핸들러
  const handleGuideItemCheck = useCallback((code: string, checked: boolean) => {
    if (guideOptions.length === 0) return;
    const newChecks = { ...guideChecks };
    newChecks[code] = checked;
    if (checked && guideOptions.length > 0) {
      newChecks[guideOptions[0].COMMON_CD] = false;
    }
    setGuideChecks(newChecks);
    if (checked) setNoGuideReason('');
  }, [guideOptions, guideChecks]);

  const handleNoGuideReasonSelect = useCallback((code: string) => {
    setNoGuideReason(code);
  }, []);

  // 신사업안내 저장
  const handleGuideSave = useCallback(async () => {
    if (isNoGuideSelected) {
      if (!noGuideReason) {
        showToast?.('미안내 사유를 선택해주세요.', 'warning');
        return;
      }
    } else if (!hasAnyGuideSelected) {
      showToast?.('안내 항목을 하나 이상 선택하거나, 미안내를 선택해주세요.', 'warning');
      return;
    }

    let guideCds = '';
    guideOptions.forEach(opt => {
      guideCds += guideChecks[opt.COMMON_CD] ? opt.COMMON_CD : 'N';
    });

    let noGuideCds = '';
    if (isNoGuideSelected && noGuideReason) {
      noGuideOptions.forEach(opt => {
        noGuideCds += (opt.COMMON_CD === noGuideReason) ? opt.COMMON_CD : 'N';
      });
    }

    const userInfo = localStorage.getItem('userInfo');
    const user = userInfo ? JSON.parse(userInfo) : {};
    const regUid = user.userId || '';
    const wrkId = order.id || (order as any).WRK_ID || '';

    if (!wrkId) {
      showToast?.('작업 ID를 찾을 수 없습니다.', 'error');
      return;
    }

    setGuideSaving(true);
    try {
      await saveNBGuide(wrkId, guideCds, regUid, noGuideCds);
      showToast?.('신사업안내가 저장되었습니다.', 'success');
      setAlreadyGuided(true);
      setNewBusinessReviewed(true);
    } catch (error) {
      console.error('[PostProcess] saveNBGuide error:', error);
      showToast?.('신사업안내 저장에 실패했습니다.', 'error');
    } finally {
      setGuideSaving(false);
    }
  }, [guideOptions, guideChecks, isNoGuideSelected, hasAnyGuideSelected, noGuideReason, order, showToast]);

  // 버튼 핸들러들
  const handleConsultationClick = () => {
    showToast?.('상담접수 기능은 고객관리 탭에서 이용 가능합니다.', 'info');
  };

  const handleAsReceiptClick = () => {
    showToast?.('AS접수 기능은 고객관리 탭에서 이용 가능합니다.', 'info');
  };

  const handleCustomerSignClick = () => {
    showToast?.('고객서명(모두싸인) 기능 연동 예정', 'info');
  };

  const handleFaceSignClick = () => {
    showToast?.('대면서명(모두싸인) 기능 연동 예정', 'info');
  };

  const handleResendClick = () => {
    showToast?.('재발송(모두싸인) 기능 연동 예정', 'info');
  };

  const handleRecontractClick = () => {
    setRecontractClicked(true);
    showToast?.('재약정(모두싸인) 기능 연동 예정', 'info');
  };

  const handleAutoTransferClick = () => {
    showToast?.('자동이체현장접수 기능 연동 예정', 'info');
  };

  // 신호연동 네비게이션
  const { equipmentData: storeEquipmentData, filteringData } = useWorkProcessStore();
  const signalEquipmentData = storeEquipmentData || filteringData;

  const handleSignalInterlock = () => {
    const { setCurrentView, setActiveTab, setSignalNavContext } = useUIStore.getState();
    // 상품변경(WRK_CD='05')은 DTL_CTRT_ID가 신규 계약ID
    const effectiveCtrtId = order.WRK_CD === '05'
      ? ((order as any).DTL_CTRT_ID || order.CTRT_ID)
      : order.CTRT_ID;
    console.log(`[화면전환] 후처리(WRK_CD=${order.WRK_CD}) → 신호연동 | CTRT_ID=${effectiveCtrtId}, PROD_CD=${order.PROD_CD}, SO_ID=${order.SO_ID}`);
    setSignalNavContext({
      ctrtId: effectiveCtrtId,
      custId: order.customer?.id || (order as any).CUST_ID || '',
      workType: order.WRK_CD || '',
      wrkDtlTcd: order.WRK_DTL_TCD,
      prodCd: order.PROD_CD || (order as any).BASIC_PROD_CD || '',
      prodNm: order.PROD_NM || (order as any).BASIC_PROD_CD_NM || '',
      soId: order.SO_ID || '',
      equipmentData: signalEquipmentData,
      returnView: 'work-process-flow',
    });
    setActiveTab('signal-interlock');
    setCurrentView('work-management');
  };

  // 후처리 미완료 항목 목록
  const pendingItems: string[] = [];
  if (signTarget && !signCompleted) pendingItems.push('전자서명');
  if (recontractTarget && !recontractClicked && !recontractCompleted) pendingItems.push('재약정');
  if (autoTransferTarget && !autoTransferCompleted) pendingItems.push('자동이체현장접수');
  if (showNewBusiness && !newBusinessReviewed) pendingItems.push('신사업안내');

  return (
    <div className="p-3 sm:p-4 space-y-3 sm:space-y-4">
      {/* 후처리 안내 배너 */}
      <div className={`rounded-xl overflow-hidden shadow-sm border ${
        pendingItems.length > 0
          ? 'bg-amber-50 border-amber-200'
          : 'bg-green-50 border-green-200'
      }`}>
        <div className="px-4 py-3 flex items-start gap-3">
          {pendingItems.length > 0 ? (
            <>
              <AlertCircle className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-bold text-amber-800">후처리 미완료 항목이 있습니다</p>
                <p className="text-xs text-amber-600 mt-1">
                  {pendingItems.map((item, idx) => (
                    <span key={item}>
                      {idx > 0 && ', '}
                      <span className="font-semibold">{item}</span>
                    </span>
                  ))}
                  {' '}처리를 완료해주세요.
                </p>
              </div>
            </>
          ) : (
            <>
              <Check className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-bold text-green-800">모든 후처리가 완료되었습니다</p>
                <p className="text-xs text-green-600 mt-1">목록으로 돌아가셔도 됩니다.</p>
              </div>
            </>
          )}
        </div>
      </div>

      {/* 상단: 작업 정보 + 새로고침 */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="bg-gradient-to-r from-slate-600 to-slate-700 px-4 py-3 flex items-center justify-between">
          <h3 className="text-sm font-bold text-white">작업 정보</h3>
          <button
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="p-1.5 rounded-full hover:bg-slate-500 transition-colors disabled:opacity-50"
            aria-label="새로고침"
          >
            <RefreshCw className={`w-4 h-4 text-white ${isRefreshing ? 'animate-spin' : ''}`} />
          </button>
        </div>
        <div className="p-4 space-y-2">
          <div className="flex justify-between items-center py-1.5 border-b border-gray-100">
            <span className="text-xs text-gray-500">고객명</span>
            <span className="text-sm font-semibold text-gray-900">{order.customer?.name || order.CUST_NM || '-'}</span>
          </div>
          <div className="flex justify-between items-center py-1.5 border-b border-gray-100">
            <span className="text-xs text-gray-500">작업유형</span>
            <span className="text-sm font-medium text-gray-800">{order.typeDisplay || order.WRK_CD_NM || '-'}</span>
          </div>
          <div className="flex justify-between items-center py-1.5 border-b border-gray-100">
            <span className="text-xs text-gray-500">상품명</span>
            <span className="text-sm font-medium text-gray-800 text-right max-w-[60%] truncate">{order.PROD_NM || '-'}</span>
          </div>
          <div className="flex justify-between items-start py-1.5">
            <span className="text-xs text-gray-500 flex-shrink-0">주소</span>
            <span className="text-xs text-gray-700 text-right ml-2">{order.customer?.address || (order as any).ST_ADDR || '-'}</span>
          </div>
        </div>
      </div>

      {/* 신호연동 */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="p-4">
          <button
            type="button"
            onClick={handleSignalInterlock}
            className="w-full flex items-center justify-center gap-2.5 px-4 py-3.5 bg-purple-600 hover:bg-purple-700 active:bg-purple-800 text-white rounded-lg font-bold transition-all text-sm shadow-sm"
          >
            <Zap className="w-5 h-5" />
            <span>신호연동</span>
          </button>
        </div>
      </div>

      {/* 고객 서비스 */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="bg-gradient-to-r from-primary-500 to-primary-600 px-4 py-3">
          <h3 className="text-sm font-bold text-white">고객 서비스</h3>
        </div>
        <div className="p-4 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={handleConsultationClick}
              className="flex items-center justify-center gap-2 px-4 py-3 bg-primary-50 hover:bg-primary-100 active:bg-primary-200 text-primary-600 rounded-lg font-semibold transition-all text-sm border border-primary-200"
            >
              <span>상담접수</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={handleAsReceiptClick}
              className="flex items-center justify-center gap-2 px-4 py-3 bg-orange-50 hover:bg-orange-100 active:bg-orange-200 text-orange-700 rounded-lg font-semibold transition-all text-sm border border-orange-200"
            >
              <span>AS접수</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* 신사업안내 (설치/AS/상변/이전설치만) - 고객서비스와 필수후작업 사이 */}
      {showNewBusiness && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3.5 bg-amber-50">
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-amber-800">신사업안내</span>
              {alreadyGuided && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-green-100 text-green-700 text-xs font-medium">
                  <Check className="w-3 h-3" />
                  완료
                </span>
              )}
            </div>
          </div>
          <div className="p-4 bg-white border-t border-amber-100">
              {guideLoading ? (
                <div className="flex items-center justify-center py-6">
                  <Loader2 className="w-5 h-5 animate-spin text-amber-500 mr-2" />
                  <span className="text-sm text-gray-500">로딩 중...</span>
                </div>
              ) : alreadyGuided ? (
                <div className="text-center py-4">
                  <div className="inline-flex items-center gap-2 px-4 py-2 bg-green-50 rounded-lg border border-green-200">
                    <Check className="w-4 h-4 text-green-600" />
                    <span className="text-sm font-medium text-green-700">오늘 이미 안내 완료되었습니다.</span>
                  </div>
                </div>
              ) : guideOptions.length === 0 ? (
                <p className="text-sm text-gray-500 text-center py-4">공통코드를 불러올 수 없습니다.</p>
              ) : (
                <div className="space-y-4">
                  <div className="space-y-2">
                    {guideOptions.map((opt, idx) => {
                      const isG0 = idx === 0;
                      const isChecked = guideChecks[opt.COMMON_CD] === true;
                      const isDisabled = !isG0 && isNoGuideSelected;

                      return (
                        <label
                          key={opt.COMMON_CD}
                          className={`flex items-center gap-3 px-3 py-2.5 rounded-lg border transition-all cursor-pointer ${
                            isDisabled
                              ? 'bg-gray-50 border-gray-200 opacity-50 cursor-not-allowed'
                              : isChecked
                                ? isG0
                                  ? 'bg-red-50 border-red-300'
                                  : 'bg-amber-50 border-amber-300'
                                : 'bg-white border-gray-200 hover:border-gray-300'
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={isChecked}
                            disabled={isDisabled}
                            onChange={(e) => {
                              if (isG0) {
                                handleNoGuideCheck(e.target.checked);
                              } else {
                                handleGuideItemCheck(opt.COMMON_CD, e.target.checked);
                              }
                            }}
                            className={`w-4.5 h-4.5 rounded border-gray-300 ${
                              isG0 ? 'text-red-500 focus:ring-red-400' : 'text-amber-500 focus:ring-amber-400'
                            }`}
                          />
                          <span className={`text-sm font-medium ${
                            isDisabled ? 'text-gray-400' : isChecked ? (isG0 ? 'text-red-700' : 'text-amber-800') : 'text-gray-700'
                          }`}>
                            {opt.COMMON_CD_NM}
                          </span>
                        </label>
                      );
                    })}
                  </div>

                  {isNoGuideSelected && noGuideOptions.length > 0 && (
                    <div className="mt-3 p-3 bg-red-50 rounded-lg border border-red-200">
                      <p className="text-xs font-semibold text-red-700 mb-2">미안내 사유 선택</p>
                      <div className="space-y-1.5">
                        {noGuideOptions.map(opt => (
                          <label
                            key={opt.COMMON_CD}
                            className={`flex items-center gap-3 px-3 py-2 rounded-md cursor-pointer transition-all ${
                              noGuideReason === opt.COMMON_CD
                                ? 'bg-red-100 border border-red-300'
                                : 'bg-white border border-gray-200 hover:border-red-200'
                            }`}
                          >
                            <input
                              type="radio"
                              name="noGuideReason"
                              checked={noGuideReason === opt.COMMON_CD}
                              onChange={() => handleNoGuideReasonSelect(opt.COMMON_CD)}
                              className="w-4 h-4 text-red-500 focus:ring-red-400"
                            />
                            <span className={`text-sm ${
                              noGuideReason === opt.COMMON_CD ? 'font-medium text-red-700' : 'text-gray-700'
                            }`}>
                              {opt.COMMON_CD_NM}
                            </span>
                          </label>
                        ))}
                      </div>
                    </div>
                  )}

                  <button
                    type="button"
                    onClick={handleGuideSave}
                    disabled={guideSaving}
                    className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-amber-500 hover:bg-amber-600 active:bg-amber-700 text-white rounded-lg font-semibold transition-all text-sm shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {guideSaving ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>저장 중...</span>
                      </>
                    ) : (
                      <span>저장</span>
                    )}
                  </button>
                </div>
              )}
            </div>
        </div>
      )}

      {/* 전자서명 */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
          <span className="text-sm font-bold text-gray-800">전자서명</span>
          {signTarget && !signCompleted && (
            <span className="text-xs font-semibold text-orange-600 bg-orange-50 px-2 py-0.5 rounded-full">미완료</span>
          )}
          {signTarget && signCompleted && (
            <span className="inline-flex items-center gap-1 text-xs font-semibold text-green-600 bg-green-50 px-2 py-0.5 rounded-full">
              <Check className="w-3 h-3" />완료
            </span>
          )}
        </div>
        <div className="p-4">
          {!signTarget ? (
            <div className="flex items-center gap-2 px-3 py-2.5 bg-gray-50 rounded-lg border border-gray-200">
              <div className="w-2 h-2 rounded-full bg-gray-300" />
              <span className="text-sm text-gray-400">전자서명 대상이 아닙니다</span>
            </div>
          ) : signCompleted ? (
            <div className="flex items-center gap-2 px-3 py-2.5 bg-green-50 rounded-lg border border-green-200">
              <Check className="w-4 h-4 text-green-600" />
              <span className="text-sm font-medium text-green-700">전자서명이 완료되었습니다</span>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex items-center gap-2 px-3 py-2.5 bg-orange-50 rounded-lg border border-orange-200">
                <div className="w-2 h-2 rounded-full bg-orange-400 animate-pulse" />
                <span className="text-sm font-medium text-orange-700">전자서명 대상입니다</span>
              </div>
              {/* 현재 모드 라벨 */}
              <p className="text-xs font-semibold text-gray-500 px-1">
                {signMode === 'customer' ? '고객서명' : '대면서명'}
              </p>
              {/* 버튼들 */}
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={handleResendClick}
                  className="flex items-center justify-center gap-1.5 px-3 py-2.5 bg-blue-50 hover:bg-blue-100 active:bg-blue-200 text-blue-700 rounded-lg font-semibold transition-all text-xs border border-blue-200"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>재발송</span>
                </button>
                {signMode === 'customer' ? (
                  <button
                    type="button"
                    onClick={() => setSignMode('face')}
                    className="flex items-center justify-center gap-1.5 px-3 py-2.5 bg-purple-50 hover:bg-purple-100 active:bg-purple-200 text-purple-700 rounded-lg font-semibold transition-all text-xs border border-purple-200"
                  >
                    <Monitor className="w-3.5 h-3.5" />
                    <span>대면서명으로 변경발송</span>
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => setSignMode('customer')}
                    className="flex items-center justify-center gap-1.5 px-3 py-2.5 bg-teal-50 hover:bg-teal-100 active:bg-teal-200 text-teal-700 rounded-lg font-semibold transition-all text-xs border border-teal-200"
                  >
                    <Smartphone className="w-3.5 h-3.5" />
                    <span>고객서명으로 변경발송</span>
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 재약정 */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
          <span className="text-sm font-bold text-gray-800">재약정</span>
          {recontractTarget && (recontractCompleted || recontractClicked) && (
            <span className="inline-flex items-center gap-1 text-xs font-semibold text-green-600 bg-green-50 px-2 py-0.5 rounded-full">
              <Check className="w-3 h-3" />완료
            </span>
          )}
        </div>
        <div className="p-4">
          {!recontractTarget ? (
            <div className="flex items-center gap-2 px-3 py-2.5 bg-gray-50 rounded-lg border border-gray-200">
              <div className="w-2 h-2 rounded-full bg-gray-300" />
              <span className="text-sm text-gray-400">재약정 대상이 아닙니다</span>
            </div>
          ) : recontractCompleted ? (
            <div className="flex items-center gap-2 px-3 py-2.5 bg-green-50 rounded-lg border border-green-200">
              <Check className="w-4 h-4 text-green-600" />
              <span className="text-sm font-medium text-green-700">재약정이 완료되었습니다</span>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex items-center gap-2 px-3 py-2.5 bg-orange-50 rounded-lg border border-orange-200">
                <div className="w-2 h-2 rounded-full bg-orange-400 animate-pulse" />
                <span className="text-sm font-medium text-orange-700">재약정 대상입니다</span>
              </div>
              <button
                type="button"
                onClick={handleRecontractClick}
                className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-green-500 hover:bg-green-600 active:bg-green-700 text-white rounded-lg font-semibold transition-all text-sm shadow-sm"
              >
                <span>재약정 진행 (모두싸인)</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>
      </div>

      {/* 자동이체현장접수 */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
          <span className="text-sm font-bold text-gray-800">자동이체현장접수</span>
          {autoTransferTarget && autoTransferCompleted && (
            <span className="inline-flex items-center gap-1 text-xs font-semibold text-green-600 bg-green-50 px-2 py-0.5 rounded-full">
              <Check className="w-3 h-3" />완료
            </span>
          )}
        </div>
        <div className="p-4">
          {!autoTransferTarget ? (
            <div className="flex items-center gap-2 px-3 py-2.5 bg-gray-50 rounded-lg border border-gray-200">
              <div className="w-2 h-2 rounded-full bg-gray-300" />
              <span className="text-sm text-gray-400">자동이체현장접수 대상이 아닙니다</span>
            </div>
          ) : autoTransferCompleted ? (
            <div className="flex items-center gap-2 px-3 py-2.5 bg-green-50 rounded-lg border border-green-200">
              <Check className="w-4 h-4 text-green-600" />
              <span className="text-sm font-medium text-green-700">자동이체현장접수가 완료되었습니다</span>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex items-center gap-2 px-3 py-2.5 bg-orange-50 rounded-lg border border-orange-200">
                <div className="w-2 h-2 rounded-full bg-orange-400 animate-pulse" />
                <span className="text-sm font-medium text-orange-700">자동이체현장접수 대상입니다</span>
              </div>
              <button
                type="button"
                onClick={handleAutoTransferClick}
                className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-cyan-500 hover:bg-cyan-600 active:bg-cyan-700 text-white rounded-lg font-semibold transition-all text-sm shadow-sm"
              >
                <span>자동이체/Email청구서 현장접수</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>
      </div>

      {/* 목록으로 버튼 */}
      <div className="pt-2 pb-4">
        <button
          type="button"
          onClick={onComplete}
          className="w-full px-4 py-4 bg-gradient-to-r from-slate-700 to-slate-800 hover:from-slate-800 hover:to-slate-900 active:from-slate-900 active:to-black text-white rounded-xl font-bold text-base shadow-lg transition-all"
        >
          목록으로
        </button>
      </div>
    </div>
  );
};

export default PostProcess;
