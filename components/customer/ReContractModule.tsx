import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Loader2, AlertCircle, Send,
  RefreshCw, CheckCircle, XCircle, FileText, ChevronDown, ChevronUp, PenTool,
  MessageSquare
} from 'lucide-react';
import {
  getPromOfContract,
  saveCtrtAgreeInfo,
  getPromMonthCodes,
  getPromChangeReasonCodes,
  getPromChangeCodes,
  ContractInfo,
} from '../../services/customerApi';

// ID format (3-3-4)
const formatId = (id: string): string => {
  if (!id) return '-';
  const cleaned = id.replace(/[^0-9]/g, '');
  if (cleaned.length === 10) {
    return `${cleaned.slice(0, 3)}-${cleaned.slice(3, 6)}-${cleaned.slice(6, 10)}`;
  }
  return id;
};

// Date format (YYYYMMDD -> YYYY-MM-DD)
const formatDateStr = (dt: string): string => {
  if (!dt) return '-';
  const clean = dt.replace(/[^0-9]/g, '');
  if (clean.length === 8) {
    return `${clean.substring(0, 4)}-${clean.substring(4, 6)}-${clean.substring(6, 8)}`;
  }
  return dt;
};

interface CodeItem {
  CODE: string;
  CODE_NM: string;
}

interface PromInfo {
  CTRT_ID: string;
  PROM_CTRT_ID: string;
  PROM_YN: string;
  PROM_CHG_CD: string;
  PROM_CHG_CD_NM: string;
  PROM_CHGRSN_CD: string;
  PROM_CHGRSN_CD_NM: string;
  PROM_CNT: string;
  PROM_CNT_NM: string;
  CTRT_APLY_STRT_DT: string;
  CTRT_APLY_END_DT: string;
  OPEN_DD: string;
  PROD_NM: string;
  CTRT_STAT: string;
  CTRT_STAT_NM: string;
  RCPT_ID: string;
  USE_PROM_CTRT: string;
  RATE_STRT_DT: string;
  EFFECT_DT: string;
}

interface ReContractModuleProps {
  onBack: () => void;
  showToast?: (message: string, type: 'success' | 'error' | 'warning' | 'info') => void;
  selectedCustomer: {
    custId: string;
    custNm: string;
    telNo: string;
    hpNo?: string;
    phoneList?: { type: string; typeNm: string; number: string; fieldName: string }[];
  } | null;
  selectedContract: {
    ctrtId: string;
    prodNm: string;
    instAddr: string;
    postId?: string;
    soId?: string;
  } | null;
  contracts: ContractInfo[];
  onNavigateToBasicInfo: () => void;
}

/**
 * 재약정 모듈 (상담/AS에서 분리)
 * - 재약정 대상 계약 목록 표시
 * - 개별/일괄 재약정 처리
 */
const ReContractModule: React.FC<ReContractModuleProps> = ({
  onBack,
  showToast,
  selectedCustomer,
  selectedContract,
  contracts,
  onNavigateToBasicInfo
}) => {
  // 재약정 대상 계약 필터링 (CLOSE_DANGER='Y' + 사용중)
  const eligibleContracts = contracts.filter(c => {
    const isActive = !['해지', '정지'].some(s => (c.CTRT_STAT_NM || '').includes(s));
    const isCloseDanger = c.CLOSE_DANGER === 'Y';
    const isInUse = (c.CTRT_STAT_NM || '').includes('사용중');
    return isActive && isCloseDanger && isInUse;
  });

  // 선택된 계약들 (일괄처리용)
  const [selectedCtrtIds, setSelectedCtrtIds] = useState<Set<string>>(new Set());

  // 개별 약정정보 캐시
  const [promInfoMap, setPromInfoMap] = useState<Record<string, PromInfo | null>>({});
  const [promLoadingSet, setPromLoadingSet] = useState<Set<string>>(new Set());

  // 코드
  const [promMonthCodes, setPromMonthCodes] = useState<CodeItem[]>([]);
  const [promChangeReasonCodes, setPromChangeReasonCodes] = useState<CodeItem[]>([]);
  const [promChangeCodes, setPromChangeCodes] = useState<CodeItem[]>([]);
  const [codesLoaded, setCodesLoaded] = useState(false);

  // 일괄 폼
  // 오늘 날짜 YYYYMMDD
  const today = (() => {
    const d = new Date();
    return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
  })();

  const [batchForm, setBatchForm] = useState({
    promChgCd: '',
    promChgrsnCd: '',
    promCnt: '36',
    startDate: today,
    endDate: '',
  });

  // 접수방식: 대면 / 직접
  const [receiptMethod, setReceiptMethod] = useState<'face' | 'direct'>('face');

  // 직접 전송 시 전화번호
  const [selectedPhoneField, setSelectedPhoneField] = useState<string>('');
  const [directPhone, setDirectPhone] = useState<string>('');
  const [isManualPhone, setIsManualPhone] = useState(false);
  const [phoneDropdownOpen, setPhoneDropdownOpen] = useState(false);

  // 일괄등록 완료 여부
  const [batchRegistered, setBatchRegistered] = useState(false);

  // 다시보내기 처리 중
  const [isResending, setIsResending] = useState(false);

  // 전자서명 URL (API에서 받아올 값)
  const [signUrl, setSignUrl] = useState<string>('');

  // 스크롤 ref
  const actionAreaRef = useRef<HTMLDivElement>(null);

  // 상태
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [expandedCtrt, setExpandedCtrt] = useState<string | null>(null);
  const [resultPopup, setResultPopup] = useState<{
    show: boolean;
    success: boolean;
    message: string;
  }>({ show: false, success: false, message: '' });

  // 코드 로드
  const loadCodes = useCallback(async () => {
    if (codesLoaded) return;
    try {
      const [monthRes, reasonRes, changeRes] = await Promise.all([
        getPromMonthCodes(),
        getPromChangeReasonCodes(),
        getPromChangeCodes(),
      ]);

      const parseCodes = (res: any, fallback: CodeItem[], allowedCodes?: string[]): CodeItem[] => {
        if (res.success && res.data) {
          const codes = (res.data as any[]).map((c: any) => ({
            CODE: c.code || c.CODE || '',
            CODE_NM: c.name || c.CODE_NM || '',
          })).filter((c: CodeItem) => c.CODE && c.CODE !== '[]');
          const filtered = allowedCodes
            ? codes.filter(c => allowedCodes.includes(c.CODE))
            : codes;
          return filtered.length > 0 ? filtered : fallback;
        }
        return fallback;
      };

      setPromMonthCodes(parseCodes(monthRes, [
        { CODE: '0', CODE_NM: '무약정' },
        { CODE: '12', CODE_NM: '12개월' },
        { CODE: '24', CODE_NM: '24개월' },
        { CODE: '36', CODE_NM: '36개월' },
      ]));
      setPromChangeReasonCodes(parseCodes(reasonRes, [
        { CODE: 'A', CODE_NM: '고객요청' },
        { CODE: 'B', CODE_NM: 'TM유치' },
        { CODE: 'C', CODE_NM: '해지방어' },
        { CODE: 'D', CODE_NM: '전산처리' },
      ]));
      // CMCU252: 02(약정만기후재계약), 03(약정상향변경)만
      setPromChangeCodes(parseCodes(changeRes, [
        { CODE: '02', CODE_NM: '약정만기후재계약' },
        { CODE: '03', CODE_NM: '약정상향변경' },
      ], ['02', '03']));
      setCodesLoaded(true);
    } catch (e) {
      console.error('Code loading failed:', e);
      setPromMonthCodes([
        { CODE: '0', CODE_NM: '무약정' },
        { CODE: '12', CODE_NM: '12개월' },
        { CODE: '24', CODE_NM: '24개월' },
        { CODE: '36', CODE_NM: '36개월' },
      ]);
      setPromChangeReasonCodes([
        { CODE: 'A', CODE_NM: '고객요청' },
        { CODE: 'B', CODE_NM: 'TM유치' },
        { CODE: 'C', CODE_NM: '해지방어' },
        { CODE: 'D', CODE_NM: '전산처리' },
      ]);
      setPromChangeCodes([
        { CODE: '02', CODE_NM: '약정만기후재계약' },
        { CODE: '03', CODE_NM: '약정상향변경' },
      ]);
      setCodesLoaded(true);
    }
  }, [codesLoaded]);

  useEffect(() => { loadCodes(); }, [loadCodes]);

  // 최초 마운트 시 전체 선택
  useEffect(() => {
    if (eligibleContracts.length > 0 && selectedCtrtIds.size === 0) {
      setSelectedCtrtIds(new Set(eligibleContracts.map(c => c.CTRT_ID)));
    }
  }, [eligibleContracts.length]);

  // 고객 전화번호 목록
  const phoneOptions = (() => {
    if (!selectedCustomer) return [];
    if (selectedCustomer.phoneList && selectedCustomer.phoneList.length > 0) {
      return selectedCustomer.phoneList.filter(p => p.number);
    }
    const list: { type: string; typeNm: string; number: string; fieldName: string }[] = [];
    if (selectedCustomer.hpNo) list.push({ type: 'hp', typeNm: '휴대폰', number: selectedCustomer.hpNo, fieldName: 'HP_NO' });
    if (selectedCustomer.telNo) list.push({ type: 'tel', typeNm: '전화', number: selectedCustomer.telNo, fieldName: 'TEL_NO' });
    return list;
  })();

  // 고객 전화번호 초기값
  useEffect(() => {
    if (phoneOptions.length > 0 && !selectedPhoneField) {
      setSelectedPhoneField(phoneOptions[0].fieldName);
      setDirectPhone(phoneOptions[0].number);
    }
  }, [selectedCustomer?.custId]);

  // 선택된 계약 자동 선택
  useEffect(() => {
    if (selectedContract) {
      const isEligible = eligibleContracts.some(c => c.CTRT_ID === selectedContract.ctrtId);
      if (isEligible) {
        setSelectedCtrtIds(new Set([selectedContract.ctrtId]));
        setExpandedCtrt(selectedContract.ctrtId);
        loadPromInfoForCtrt(selectedContract.ctrtId);
      }
    }
  }, [selectedContract?.ctrtId]);

  // 약정정보 로드
  const loadPromInfoForCtrt = async (ctrtId: string) => {
    if (promInfoMap[ctrtId] !== undefined || promLoadingSet.has(ctrtId)) return;
    setPromLoadingSet(prev => new Set(prev).add(ctrtId));
    try {
      const res = await getPromOfContract(ctrtId);
      if (res.success && res.data && res.data.length > 0) {
        setPromInfoMap(prev => ({ ...prev, [ctrtId]: res.data![0] as PromInfo }));
      } else {
        setPromInfoMap(prev => ({ ...prev, [ctrtId]: null }));
      }
    } catch (e) {
      setPromInfoMap(prev => ({ ...prev, [ctrtId]: null }));
    } finally {
      setPromLoadingSet(prev => {
        const next = new Set(prev);
        next.delete(ctrtId);
        return next;
      });
    }
  };

  // 전체 선택/해제
  const toggleAll = () => {
    if (selectedCtrtIds.size === eligibleContracts.length) {
      setSelectedCtrtIds(new Set());
    } else {
      setSelectedCtrtIds(new Set(eligibleContracts.map(c => c.CTRT_ID)));
    }
  };

  // 개별 선택
  const toggleCtrt = (ctrtId: string) => {
    const next = new Set(selectedCtrtIds);
    if (next.has(ctrtId)) {
      next.delete(ctrtId);
    } else {
      next.add(ctrtId);
      loadPromInfoForCtrt(ctrtId);
    }
    setSelectedCtrtIds(next);
  };

  // 약정개월수 변경 시 종료일 자동 계산
  useEffect(() => {
    if (batchForm.startDate && batchForm.promCnt && batchForm.promCnt !== '0') {
      const months = parseInt(batchForm.promCnt, 10);
      if (!isNaN(months) && months > 0) {
        const start = batchForm.startDate.replace(/[^0-9]/g, '');
        if (start.length === 8) {
          const y = parseInt(start.substring(0, 4), 10);
          const m = parseInt(start.substring(4, 6), 10) - 1;
          const d = parseInt(start.substring(6, 8), 10);
          const endDate = new Date(y, m + months, d - 1);
          const endStr = `${endDate.getFullYear()}${String(endDate.getMonth() + 1).padStart(2, '0')}${String(endDate.getDate()).padStart(2, '0')}`;
          setBatchForm(prev => ({ ...prev, endDate: endStr }));
        }
      }
    } else if (batchForm.promCnt === '0') {
      setBatchForm(prev => ({ ...prev, endDate: '' }));
    }
  }, [batchForm.startDate, batchForm.promCnt]);

  // 일괄 등록
  const handleBatchSubmit = async () => {
    if (!selectedCustomer) return;
    if (selectedCtrtIds.size === 0) {
      showToast?.('재약정할 계약을 선택해주세요.', 'warning');
      return;
    }
    if (!batchForm.promChgCd || !batchForm.promChgrsnCd || !batchForm.promCnt || !batchForm.startDate) {
      showToast?.('필수 항목을 모두 입력해주세요.', 'warning');
      return;
    }

    setIsSubmitting(true);
    let successCount = 0;
    let failCount = 0;
    const failMessages: string[] = [];

    for (const ctrtId of selectedCtrtIds) {
      try {
        const promInfo = promInfoMap[ctrtId];
        const params = {
          CUST_ID: selectedCustomer.custId,
          CTRT_ID: ctrtId,
          RCPT_ID: promInfo?.RCPT_ID || '',
          WRK_ID: '',
          AGREE_YN: 'Y',
          AGREE_GB: batchForm.promChgrsnCd,
          AGREE_SIGN: '',
          WRK_CD: batchForm.promChgCd,
        };

        const res = await saveCtrtAgreeInfo(params);
        if (res.success) {
          successCount++;
        } else {
          failCount++;
          failMessages.push(`${formatId(ctrtId)}: ${res.message || '실패'}`);
        }
      } catch (e: any) {
        failCount++;
        failMessages.push(`${formatId(ctrtId)}: 오류 발생`);
      }
    }

    setIsSubmitting(false);

    if (failCount === 0) {
      setResultPopup({
        show: true,
        success: true,
        message: `${successCount}건의 재약정이 등록되었습니다.`
      });
      setBatchRegistered(true);
    } else {
      setResultPopup({
        show: true,
        success: false,
        message: `성공 ${successCount}건, 실패 ${failCount}건\n\n${failMessages.join('\n')}`
      });
      if (successCount > 0) setBatchRegistered(true);
    }

    // Refresh prom info for all
    setPromInfoMap({});
  };

  if (!selectedCustomer) {
    return (
      <div className="h-full overflow-y-auto p-4">
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <div className="flex items-start gap-2">
            <AlertCircle className="w-5 h-5 text-yellow-500 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-yellow-700">고객을 먼저 선택해주세요.</p>
              <p className="text-xs text-yellow-600 mt-1">
                기본조회에서 고객을 검색한 후 재약정을 진행할 수 있습니다.
              </p>
              <button
                onClick={onNavigateToBasicInfo}
                className="mt-2 text-xs text-blue-600 hover:text-blue-800 underline"
              >
                기본조회로 이동
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto p-4 space-y-4">
      {/* 헤더 */}
      <div className="flex items-center justify-between">
        <h3 className="font-medium text-gray-800 flex items-center gap-2">
          <RefreshCw className="w-5 h-5 text-purple-500" />
          재약정 관리
        </h3>
        <span className="text-xs text-gray-500">
          대상 {eligibleContracts.length}건
        </span>
      </div>

      {/* 고객 정보 */}
      <div className="p-3 bg-purple-50 rounded-lg border border-purple-200">
        <div className="text-sm text-purple-800">
          <span className="font-medium">{selectedCustomer.custNm}</span>
          <span className="ml-1 text-purple-600 text-xs">(고객ID: {formatId(selectedCustomer.custId)})</span>
        </div>
      </div>

      {/* 재약정 대상 계약 목록 */}
      {eligibleContracts.length === 0 ? (
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-6 text-center">
          <AlertCircle className="w-10 h-10 text-gray-400 mx-auto mb-2" />
          <p className="text-sm text-gray-600">재약정 대상 계약이 없습니다.</p>
          <p className="text-xs text-gray-400 mt-1">사용중(재약정) 상태의 계약만 재약정할 수 있습니다.</p>
        </div>
      ) : (
        <>
          {/* 전체 선택 */}
          <label className="flex items-center gap-3 p-3 bg-purple-50 rounded-lg cursor-pointer border border-purple-200">
            <input
              type="checkbox"
              checked={selectedCtrtIds.size === eligibleContracts.length}
              onChange={toggleAll}
              className="w-5 h-5 rounded border-gray-300 text-purple-600 focus:ring-purple-500"
              disabled={isSubmitting}
            />
            <span className="flex-1 font-medium text-purple-700">
              전체 선택 ({eligibleContracts.length}건)
            </span>
            <span className="text-xs text-purple-500">
              {selectedCtrtIds.size}건 선택됨
            </span>
          </label>

          {/* 계약 목록 */}
          <div className="space-y-2">
            {eligibleContracts.map(ctrt => {
              const isSelected = selectedCtrtIds.has(ctrt.CTRT_ID);
              const isExpanded = expandedCtrt === ctrt.CTRT_ID;
              const promInfo = promInfoMap[ctrt.CTRT_ID];
              const isLoadingProm = promLoadingSet.has(ctrt.CTRT_ID);

              return (
                <div
                  key={ctrt.CTRT_ID}
                  className={`rounded-lg border transition-all ${
                    isSelected
                      ? 'bg-purple-50 border-purple-300'
                      : 'bg-white border-gray-200'
                  }`}
                >
                  {/* 계약 행 */}
                  <div className="flex items-center gap-3 p-3">
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => toggleCtrt(ctrt.CTRT_ID)}
                      className="w-4 h-4 rounded border-gray-300 text-purple-600 focus:ring-purple-500"
                      disabled={isSubmitting}
                    />
                    <div
                      className="flex-1 min-w-0 cursor-pointer"
                      onClick={() => {
                        setExpandedCtrt(isExpanded ? null : ctrt.CTRT_ID);
                        if (!isExpanded) loadPromInfoForCtrt(ctrt.CTRT_ID);
                      }}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1 min-w-0">
                          <span className="text-sm font-medium text-gray-900 truncate">
                            {ctrt.PROD_NM || '상품명 없음'}
                          </span>
                          <span className="text-xs text-gray-400 flex-shrink-0">
                            (계약ID: {formatId(ctrt.CTRT_ID)})
                          </span>
                        </div>
                        <span className="text-xs text-orange-600 bg-orange-100 px-1.5 py-0.5 rounded-full flex-shrink-0 ml-1">
                          사용중(재약정)
                        </span>
                      </div>
                    </div>
                    <button
                      onClick={() => {
                        setExpandedCtrt(isExpanded ? null : ctrt.CTRT_ID);
                        if (!isExpanded) loadPromInfoForCtrt(ctrt.CTRT_ID);
                      }}
                      className="flex-shrink-0"
                    >
                      {isExpanded ? (
                        <ChevronUp className="w-4 h-4 text-gray-400" />
                      ) : (
                        <ChevronDown className="w-4 h-4 text-gray-400" />
                      )}
                    </button>
                  </div>

                  {/* 약정 상세 (펼침) */}
                  {isExpanded && (
                    <div className="px-3 pb-3 pt-1 border-t border-gray-100">
                      {isLoadingProm ? (
                        <div className="flex items-center justify-center py-3">
                          <Loader2 className="w-4 h-4 animate-spin text-purple-500" />
                          <span className="ml-2 text-xs text-gray-500">약정정보 조회 중...</span>
                        </div>
                      ) : promInfo ? (
                        <div className="grid grid-cols-2 gap-1 text-xs">
                          <div><span className="text-gray-400">약정여부:</span> <span className={promInfo.PROM_YN === 'Y' ? 'text-green-600 font-medium' : 'text-gray-600'}>{promInfo.PROM_YN === 'Y' ? '약정중' : '약정없음'}</span></div>
                          <div><span className="text-gray-400">약정개월:</span> <span className="font-medium">{promInfo.PROM_CNT_NM || promInfo.PROM_CNT || '-'}</span></div>
                          <div><span className="text-gray-400">시작일:</span> <span>{formatDateStr(promInfo.CTRT_APLY_STRT_DT)}</span></div>
                          <div><span className="text-gray-400">종료일:</span> <span>{formatDateStr(promInfo.CTRT_APLY_END_DT)}</span></div>
                          <div><span className="text-gray-400">변경유형:</span> <span>{promInfo.PROM_CHG_CD_NM || '-'}</span></div>
                          <div><span className="text-gray-400">변경사유:</span> <span>{promInfo.PROM_CHGRSN_CD_NM || '-'}</span></div>
                        </div>
                      ) : (
                        <div className="text-xs text-gray-400 text-center py-2">약정정보 없음</div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* 일괄 재약정 폼 */}
          {selectedCtrtIds.size > 0 && (
            <>
              {/* Box 1: 약정 정보 */}
              <div className="bg-white rounded-lg border border-purple-300 p-4 space-y-3 shadow-sm">
                <div className="flex items-center gap-2 text-sm font-medium text-purple-700">
                  <FileText className="w-4 h-4" />
                  재약정 등록 ({selectedCtrtIds.size}건)
                </div>

                <div className="flex items-center gap-2">
                  <label className="text-xs text-gray-600 flex-shrink-0 w-16">변경 구분</label>
                  <select
                    value={batchForm.promChgCd}
                    onChange={(e) => setBatchForm(prev => ({ ...prev, promChgCd: e.target.value }))}
                    className="flex-1 px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                  >
                    <option value="">선택</option>
                    {promChangeCodes.map(c => (
                      <option key={c.CODE} value={c.CODE}>{c.CODE_NM}</option>
                    ))}
                  </select>
                </div>

                <div className="flex items-center gap-2">
                  <label className="text-xs text-gray-600 flex-shrink-0 w-16">변경사유</label>
                  <select
                    value={batchForm.promChgrsnCd}
                    onChange={(e) => setBatchForm(prev => ({ ...prev, promChgrsnCd: e.target.value }))}
                    className="flex-1 px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                  >
                    <option value="">선택</option>
                    {promChangeReasonCodes.filter(c => c.CODE !== '0').map(c => (
                      <option key={c.CODE} value={c.CODE}>{c.CODE_NM}</option>
                    ))}
                  </select>
                </div>

                <div className="flex items-center gap-2">
                  <label className="text-xs text-gray-600 flex-shrink-0 w-16">약정개월</label>
                  <span className="flex-1 px-3 py-2 text-sm border border-gray-200 rounded-lg bg-gray-50 text-gray-700 font-medium">36개월</span>
                </div>

                <div className="flex items-center gap-2">
                  <label className="text-xs text-gray-600 flex-shrink-0 w-16">약정일</label>
                  <span className="flex-1 px-2 py-2 text-sm border border-gray-200 rounded-lg bg-gray-50 text-gray-700 font-medium">{formatDateStr(batchForm.startDate)}</span>
                  <span className="text-xs text-gray-400">~</span>
                  <span className="flex-1 px-2 py-2 text-sm border border-gray-200 rounded-lg bg-gray-50 text-gray-600">{batchForm.endDate ? formatDateStr(batchForm.endDate) : '-'}</span>
                </div>
              </div>

              {/* Box 2: 접수방식 + 등록 + 전자서명/다시보내기 */}
              <div className="bg-white rounded-lg border border-purple-300 p-4 space-y-3 shadow-sm">
                {/* 접수방식 */}
                <div className="flex items-center gap-2">
                  <label className="text-xs text-gray-600 flex-shrink-0 w-16">접수방식</label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="receiptMethod"
                      value="face"
                      checked={receiptMethod === 'face'}
                      onChange={() => setReceiptMethod('face')}
                      className="w-4 h-4 text-purple-600 focus:ring-purple-500"
                    />
                    <span className="text-sm text-gray-700">대면</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="receiptMethod"
                      value="direct"
                      checked={receiptMethod === 'direct'}
                      onChange={() => {
                        setReceiptMethod('direct');
                        setTimeout(() => actionAreaRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 100);
                      }}
                      className="w-4 h-4 text-purple-600 focus:ring-purple-500"
                    />
                    <span className="text-sm text-gray-700">직접</span>
                  </label>
                </div>

                {/* 직접 선택 시 전화번호 */}
                {receiptMethod === 'direct' && (
                  <div className="flex items-center gap-2">
                    {/* 전화번호 타입 드롭다운 */}
                    <div className="flex-shrink-0 w-20 relative">
                      <button
                        type="button"
                        onClick={() => setPhoneDropdownOpen(!phoneDropdownOpen)}
                        disabled={isManualPhone}
                        className={`w-full px-2 py-2 text-sm text-left border rounded-lg flex items-center justify-between ${
                          isManualPhone ? 'bg-gray-100 border-gray-200 text-gray-400' : 'bg-white border-gray-300 hover:border-gray-400'
                        }`}
                      >
                        <span className="truncate">
                          {isManualPhone ? '직접' : (phoneOptions.find(p => p.fieldName === selectedPhoneField)?.typeNm || '선택')}
                        </span>
                        <ChevronDown className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                      </button>
                      {phoneDropdownOpen && !isManualPhone && (
                        <div className="absolute top-full left-0 mt-1 w-32 bg-white border border-gray-200 rounded-lg shadow-lg z-10">
                          {phoneOptions.map(p => (
                            <button
                              key={p.fieldName}
                              type="button"
                              onClick={() => {
                                setSelectedPhoneField(p.fieldName);
                                setDirectPhone(p.number);
                                setPhoneDropdownOpen(false);
                              }}
                              className={`w-full px-3 py-2 text-left text-sm hover:bg-purple-50 ${
                                selectedPhoneField === p.fieldName ? 'bg-purple-50 text-purple-700 font-medium' : 'text-gray-700'
                              }`}
                            >
                              <div>{p.typeNm}</div>
                              <div className="text-xs text-gray-400">{p.number}</div>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                    {/* 전화번호 입력 */}
                    <input
                      type="tel"
                      value={directPhone}
                      onChange={(e) => setDirectPhone(e.target.value)}
                      readOnly={!isManualPhone}
                      placeholder="전화번호 입력"
                      className={`flex-1 px-3 py-2 text-sm border rounded-lg ${
                        isManualPhone
                          ? 'border-gray-300 focus:ring-2 focus:ring-purple-500 focus:border-purple-500'
                          : 'border-gray-200 bg-gray-50 text-gray-700'
                      }`}
                    />
                    {/* 직접입력 체크 */}
                    <label className="flex items-center gap-1 flex-shrink-0 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={isManualPhone}
                        onChange={(e) => {
                          setIsManualPhone(e.target.checked);
                          setPhoneDropdownOpen(false);
                          if (e.target.checked) {
                            setDirectPhone('');
                          } else if (phoneOptions.length > 0) {
                            const selected = phoneOptions.find(p => p.fieldName === selectedPhoneField) || phoneOptions[0];
                            setDirectPhone(selected.number);
                          }
                        }}
                        className="w-3.5 h-3.5 rounded border-gray-300 text-purple-600 focus:ring-purple-500"
                      />
                      <span className="text-xs text-gray-500">직접입력</span>
                    </label>
                  </div>
                )}

                {/* 재약정 일괄등록 버튼 */}
                <button
                  onClick={handleBatchSubmit}
                  disabled={isSubmitting || !batchForm.promChgCd || !batchForm.promChgrsnCd || !batchForm.promCnt || !batchForm.startDate}
                  className={`w-full flex items-center justify-center gap-2 py-3 rounded-lg text-sm font-bold transition-colors ${
                    isSubmitting || !batchForm.promChgCd || !batchForm.promChgrsnCd || !batchForm.promCnt || !batchForm.startDate
                      ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                      : 'bg-purple-500 hover:bg-purple-600 text-white'
                  }`}
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      일괄 등록 중...
                    </>
                  ) : (
                    <>
                      <Send className="w-4 h-4" />
                      재약정 일괄 등록 ({selectedCtrtIds.size}건)
                    </>
                  )}
                </button>

                {/* 다시보내기 / 전자서명하기 버튼 */}
                <div ref={actionAreaRef} className="flex gap-2">
                  <button
                    onClick={async () => {
                      setIsResending(true);
                      try {
                        // TODO: 다시보내기 API 연결
                        await new Promise(r => setTimeout(r, 500));
                        setResultPopup({ show: true, success: true, message: '문자가 전송되었습니다.' });
                      } catch {
                        setResultPopup({ show: true, success: false, message: '문자 전송에 실패했습니다.' });
                      } finally {
                        setIsResending(false);
                      }
                    }}
                    disabled={!(receiptMethod === 'direct' && batchRegistered) || isResending}
                    className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-lg text-sm font-bold transition-colors ${
                      receiptMethod === 'direct' && batchRegistered && !isResending
                        ? 'bg-blue-500 hover:bg-blue-600 text-white'
                        : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                    }`}
                  >
                    {isResending ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <MessageSquare className="w-4 h-4" />
                    )}
                    다시보내기
                  </button>
                  <button
                    onClick={() => {
                      // TODO: API에서 전자서명 URL 받아오기
                      const url = signUrl || '';
                      if (url) {
                        window.open(url, '_blank');
                      } else {
                        showToast?.('전자서명 URL이 아직 준비되지 않았습니다.', 'warning');
                      }
                    }}
                    disabled={!(receiptMethod === 'face' && batchRegistered)}
                    className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-lg text-sm font-bold transition-colors ${
                      receiptMethod === 'face' && batchRegistered
                        ? 'bg-amber-500 hover:bg-amber-600 text-white'
                        : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                    }`}
                  >
                    <PenTool className="w-4 h-4" />
                    전자서명하기
                  </button>
                </div>

                {/* 전자서명 URL 표시 (URL 있을 때) */}
                {signUrl && receiptMethod === 'face' && batchRegistered && (
                  <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg">
                    <p className="text-xs text-gray-500 mb-1">전자서명 URL</p>
                    <a
                      href={signUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm text-blue-600 underline break-all"
                    >
                      {signUrl}
                    </a>
                  </div>
                )}
              </div>

              {/* 일괄 등록 취소 버튼 */}
              <button
                onClick={() => {
                  // TODO: 일괄 등록 취소 API
                  setBatchRegistered(false);
                  showToast?.('일괄 등록이 취소되었습니다.', 'info');
                }}
                disabled={!batchRegistered}
                className={`w-full flex items-center justify-center gap-2 py-3 rounded-lg text-sm font-bold transition-colors ${
                  batchRegistered
                    ? 'bg-red-500 hover:bg-red-600 text-white'
                    : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                }`}
              >
                <XCircle className="w-4 h-4" />
                일괄 등록 취소
              </button>
            </>
          )}
        </>
      )}

      {/* 결과 팝업 */}
      {resultPopup.show && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-sm w-full p-6">
            <div className="flex flex-col items-center text-center">
              {resultPopup.success ? (
                <CheckCircle className="w-12 h-12 text-green-500 mb-3" />
              ) : (
                <XCircle className="w-12 h-12 text-red-500 mb-3" />
              )}
              <h3 className="text-lg font-bold text-gray-800 mb-2">
                {resultPopup.success ? '등록 완료' : '등록 결과'}
              </h3>
              <p className="text-sm text-gray-600 mb-4 whitespace-pre-line">{resultPopup.message}</p>
              <button
                onClick={() => setResultPopup({ show: false, success: false, message: '' })}
                className={`w-full py-2.5 rounded-lg text-sm font-bold text-white ${
                  resultPopup.success ? 'bg-green-500 hover:bg-green-600' : 'bg-red-500 hover:bg-red-600'
                }`}
              >
                확인
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ReContractModule;
