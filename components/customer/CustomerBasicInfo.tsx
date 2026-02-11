import React, { useState, useEffect } from 'react';
import {
  ChevronDown, ChevronUp, Loader2
} from 'lucide-react';
import ContractSummary from './ContractSummary';
import PaymentInfo from './PaymentInfo';
import {
  CustomerInfo,
  ContractInfo,
  getContractList,
  getConsultationHistory,
  getWorkHistory,
  maskPhoneNumber,
  formatCurrency,
  maskString,
  ConsultationHistory,
  WorkHistory
} from '../../services/customerApi';

// ID 포맷 (3-3-4 형식)
const formatId = (id: string): string => {
  if (!id) return '-';
  const cleaned = id.replace(/[^0-9]/g, '');
  if (cleaned.length === 10) {
    return `${cleaned.slice(0, 3)}-${cleaned.slice(3, 6)}-${cleaned.slice(6, 10)}`;
  }
  return id;
};

interface CustomerBasicInfoProps {
  onBack: () => void;
  showToast?: (message: string, type: 'success' | 'error' | 'warning' | 'info') => void;
  onContractSelect: (contract: { ctrtId: string; prodNm: string; instAddr: string; streetAddr?: string; instlLoc?: string; postId?: string; soId?: string; prodGrp?: string }) => void;
  onNavigateToPaymentChange?: (pymAcntId: string) => void;  // 납부정보 변경 탭으로 이동
  onNavigateToConsultationAS?: (initialTab: 'consultation' | 'as') => void;  // 상담/AS 탭으로 이동
  onNavigateToAddressChange?: () => void;  // 주소변경 탭으로 이동
  // 상위 컴포넌트에서 전달받은 선택된 고객 정보
  selectedCustomer?: CustomerInfo | null;
  savedContract?: { ctrtId: string; prodNm: string; instAddr: string; postId?: string } | null;
  // 캐싱된 데이터 (탭 전환 시 재로드 방지)
  cachedContracts?: ContractInfo[];
  cachedConsultationHistory?: ConsultationHistory[];
  cachedWorkHistory?: WorkHistory[];
  cachedDataCustId?: string;
  onDataLoaded?: (custId: string, contracts: ContractInfo[], consultationHistory: ConsultationHistory[], workHistory: WorkHistory[]) => void;
  // 납부방법 변경 작업 중 상태
  paymentChangeInProgress?: boolean;
  onCancelPaymentChange?: () => void;
  currentWorkingPymAcntId?: string;  // 현재 작업 중인 납부계정 ID
}

/**
 * 기본조회 화면
 *
 * 회의록 기준 구성:
 * 1. 고객정보 (이름, 고객ID, 전화번호, 주소들, 미납금액 합)
 * 2. 계약현황 summary (접기/펼치기)
 * 3. 납부정보 summary (접기/펼치기)
 * 4. 요금내역 (접기/펼치기)
 * 5. 상담이력 / 작업이력 (접기/펼치기)
 */
const CustomerBasicInfo: React.FC<CustomerBasicInfoProps> = ({
  onBack,
  showToast,
  onContractSelect,
  onNavigateToPaymentChange,
  onNavigateToConsultationAS,
  onNavigateToAddressChange,
  selectedCustomer,
  savedContract,
  cachedContracts = [],
  cachedConsultationHistory = [],
  cachedWorkHistory = [],
  cachedDataCustId = '',
  onDataLoaded,
  paymentChangeInProgress,
  onCancelPaymentChange,
  currentWorkingPymAcntId
}) => {
  // 데이터 상태
  const [contracts, setContracts] = useState<ContractInfo[]>([]);
  const [consultationHistory, setConsultationHistory] = useState<ConsultationHistory[]>([]);
  const [workHistory, setWorkHistory] = useState<WorkHistory[]>([]);

  // 일자별/계약별 뷰 모드
  const [historyViewMode, setHistoryViewMode] = useState<'byDate' | 'byContract'>('byDate');
  const [allConsultationHistory, setAllConsultationHistory] = useState<ConsultationHistory[]>([]);
  const [allWorkHistory, setAllWorkHistory] = useState<WorkHistory[]>([]);

  // 로딩 상태
  const [isLoadingContracts, setIsLoadingContracts] = useState(false);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);

  // 섹션 펼침/접기 상태
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    customerInfo: true,
    contracts: true,
    payment: false,
    consultation: false,
    work: false
  });

  // 상담/작업 이력 개별 접기/펼치기
  const [expandedConsultItems, setExpandedConsultItems] = useState<Set<number>>(new Set());
  const [expandedWorkItems, setExpandedWorkItems] = useState<Set<number>>(new Set());

  const toggleConsultItem = (index: number) => {
    setExpandedConsultItems(prev => {
      const next = new Set(prev);
      next.has(index) ? next.delete(index) : next.add(index);
      return next;
    });
  };
  const toggleWorkItem = (index: number) => {
    setExpandedWorkItems(prev => {
      const next = new Set(prev);
      next.has(index) ? next.delete(index) : next.add(index);
      return next;
    });
  };

  // 이전 고객 ID 추적
  const [prevCustomerId, setPrevCustomerId] = useState<string | null>(null);

  // 선택된 고객이 변경되면 데이터 로드 (캐시 확인 후)
  useEffect(() => {
    if (selectedCustomer && selectedCustomer.CUST_ID !== prevCustomerId) {
      setPrevCustomerId(selectedCustomer.CUST_ID);

      // 캐시된 데이터가 있고 같은 고객이면 캐시 사용
      if (cachedDataCustId === selectedCustomer.CUST_ID && (cachedContracts.length > 0 || cachedConsultationHistory.length > 0 || cachedWorkHistory.length > 0)) {
        setContracts(cachedContracts);
        setConsultationHistory(cachedConsultationHistory);
        setWorkHistory(cachedWorkHistory);
        // 전체 이력이 없으면 로드
        if (allConsultationHistory.length === 0 && allWorkHistory.length === 0) {
          loadAllHistory(selectedCustomer.CUST_ID);
        }
      } else {
        // 캐시가 없으면 새로 로드
        loadAllData(selectedCustomer.CUST_ID);
      }
    } else if (!selectedCustomer && prevCustomerId) {
      // 고객 선택 해제 시 데이터 초기화
      setPrevCustomerId(null);
      setContracts([]);
      setConsultationHistory([]);
      setWorkHistory([]);
    }
  }, [selectedCustomer, cachedDataCustId]);

  // savedContract가 있으면 자동으로 이력 로드
  useEffect(() => {
    if (selectedCustomer && savedContract && savedContract.ctrtId && savedContract.ctrtId !== selectedCtrtIdForHistory) {
      setSelectedCtrtIdForHistory(savedContract.ctrtId);
      loadHistory(selectedCustomer.CUST_ID, savedContract.ctrtId);
    }
  }, [selectedCustomer, savedContract]);

  // 계약 목록 로드
  const loadContracts = async (custId: string): Promise<ContractInfo[]> => {
    setIsLoadingContracts(true);
    try {
      const response = await getContractList(custId);
      if (response.success && response.data) {
        setContracts(response.data);
        return response.data;
      } else {
        setContracts([]);
        return [];
      }
    } catch (error) {
      console.error('Load contracts error:', error);
      setContracts([]);
      return [];
    } finally {
      setIsLoadingContracts(false);
    }
  };

  // 선택된 계약 ID (이력 조회용)
  const [selectedCtrtIdForHistory, setSelectedCtrtIdForHistory] = useState<string>('');
  // 선택된 계약의 납부계정 ID (납부정보 필터링용)
  const [selectedPymAcntIdFromContract, setSelectedPymAcntIdFromContract] = useState<string>('');

  // 이력 로드 (CUST_ID 필수, CTRT_ID 선택)
  const loadHistory = async (custId: string, ctrtId?: string): Promise<{ consultation: ConsultationHistory[], work: WorkHistory[] }> => {
    setIsLoadingHistory(true);
    try {
      const [consultRes, workRes] = await Promise.all([
        getConsultationHistory(custId, ctrtId, 10),
        getWorkHistory(custId, ctrtId, 10)
      ]);

      const consultData = consultRes.success && consultRes.data ? consultRes.data : [];
      const workData = workRes.success && workRes.data ? workRes.data : [];

      setConsultationHistory(consultData);
      setWorkHistory(workData);

      return { consultation: consultData, work: workData };
    } catch (error) {
      console.error('Load history error:', error);
      return { consultation: [], work: [] };
    } finally {
      setIsLoadingHistory(false);
    }
  };

  // 전체 이력 로드 (CUST_ID만으로 조회 - 계약 유무 무관)
  const loadAllHistory = async (custId: string) => {
    setIsLoadingHistory(true);
    try {
      // CTRT_ID 없이 CUST_ID만으로 1회 호출 (백엔드에서 최근 3개월, 최대 10건 반환)
      const [consultRes, workRes] = await Promise.all([
        getConsultationHistory(custId, undefined, 10),
        getWorkHistory(custId, undefined, 10)
      ]);

      const allConsult = consultRes.success && consultRes.data ? consultRes.data : [];
      const allWork = workRes.success && workRes.data ? workRes.data : [];

      setAllConsultationHistory(allConsult);
      setAllWorkHistory(allWork);
    } catch (error) {
      console.error('Load all history error:', error);
    } finally {
      setIsLoadingHistory(false);
    }
  };

  // 계약 목록 로드 (고객 선택 시)
  const loadAllData = async (custId: string) => {
    // 계약별 이력 데이터 초기화 (이전 고객 데이터 제거)
    setConsultationHistory([]);
    setWorkHistory([]);
    setSelectedCtrtIdForHistory('');

    const contractsResult = await loadContracts(custId);

    // 전체 이력 로드 (일자별 보기)
    setHistoryViewMode('byDate');
    await loadAllHistory(custId);

    if (onDataLoaded) {
      onDataLoaded(custId, contractsResult, [], []);
    }
  };

  // 섹션 토글
  const toggleSection = (section: string) => {
    setExpandedSections(prev => ({
      ...prev,
      [section]: !prev[section]
    }));
  };

  // 계약 선택 핸들러
  const handleContractSelect = (contract: ContractInfo) => {
    onContractSelect({
      ctrtId: contract.CTRT_ID,
      prodNm: contract.PROD_NM,
      instAddr: contract.INST_ADDR,
      streetAddr: contract.STREET_ADDR_FULL,
      instlLoc: contract.INSTL_LOC,
      postId: contract.POST_ID,
      notrecev: contract.NOTRECEV,
      soId: contract.SO_ID,
      prodGrp: contract.PROD_GRP,
    });

    // 선택된 계약으로 계약별 모드 전환 (클라이언트 필터링)
    if (contract.CTRT_ID !== selectedCtrtIdForHistory) {
      setSelectedCtrtIdForHistory(contract.CTRT_ID);
      setHistoryViewMode('byContract');
    }

    // 선택된 계약의 납부계정 자동 연동
    if (contract.PYM_ACNT_ID) {
      setSelectedPymAcntIdFromContract(contract.PYM_ACNT_ID);
    }
  };

  // 계약별 모드: CTRT_ID로 클라이언트 필터링
  // 상담이력: SQL에 CTRT_ID가 없으므로 CTRT_ID가 있는 항목만 필터, 없으면 전체 표시
  const filteredConsultation = historyViewMode === 'byContract' && selectedCtrtIdForHistory
    ? (() => {
        const matched = allConsultationHistory.filter(item => item.CTRT_ID === selectedCtrtIdForHistory);
        return matched.length > 0 ? matched : allConsultationHistory;
      })()
    : historyViewMode === 'byContract' ? [] : allConsultationHistory;

  // 작업이력: SQL에 CTRT_ID 포함되어 있어 정상 필터링
  const filteredWork = historyViewMode === 'byContract' && selectedCtrtIdForHistory
    ? allWorkHistory.filter(item => item.CTRT_ID === selectedCtrtIdForHistory)
    : historyViewMode === 'byContract' ? [] : allWorkHistory;

  return (
    <div className="h-full overflow-y-auto bg-gray-50">
      <div className="p-4 space-y-4">
        {/* 고객 선택 후 상세 정보 표시 */}
        {selectedCustomer ? (
          <>
            {/* 고객 기본 정보 */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200">
              <button
                onClick={() => toggleSection('customerInfo')}
                className="w-full px-3 py-2.5 flex items-center justify-between text-left"
              >
                <span className="font-medium text-gray-800">고객 정보</span>
                {expandedSections.customerInfo ? (
                  <ChevronUp className="w-4 h-4 text-gray-400" />
                ) : (
                  <ChevronDown className="w-4 h-4 text-gray-400" />
                )}
              </button>

              {expandedSections.customerInfo && (
                <div className="px-3 pb-3 space-y-2">
                  {/* 기본 정보 */}
                  <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-500">고객번호</span>
                      <span className="font-medium text-gray-800">{formatId(selectedCustomer.CUST_ID)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">고객명</span>
                      <span className="font-medium text-gray-800">{selectedCustomer.CUST_NM}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">전화번호</span>
                      <span className="text-gray-800">{maskPhoneNumber(selectedCustomer.TEL_NO) || '-'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">휴대폰</span>
                      <span className="text-gray-800">{maskPhoneNumber(selectedCustomer.HP_NO) || '-'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">고객구분</span>
                      <span className="text-gray-800">{selectedCustomer.CUST_TP_NM || '-'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">단체 이름</span>
                      <span className="text-gray-800">{selectedCustomer.GRP_NM || '-'}</span>
                    </div>
                  </div>

                  {/* 주소 정보 - ADDR_FULL(ROAD_ADDR) 우선 표시 */}
                  <div className="pt-2 border-t border-gray-100 text-sm space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-gray-500">고객주소</span>
                    </div>
                    <div className="text-gray-700 break-words">
                      {selectedCustomer.ROAD_ADDR || selectedCustomer.INST_ADDR || selectedCustomer.CUST_ADDR || '-'}
                    </div>
                  </div>

                  {/* 미납금액 */}
                  {selectedCustomer.UNPAY_AMT > 0 && (
                    <div className="flex items-center justify-between p-2 bg-red-50 rounded border border-red-200">
                      <span className="text-red-700 text-sm">미납금액</span>
                      <span className="text-red-600 font-bold">{formatCurrency(selectedCustomer.UNPAY_AMT)}원</span>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* 계약현황 */}
            <ContractSummary
              contracts={contracts}
              isLoading={isLoadingContracts}
              expanded={expandedSections.contracts}
              onToggle={() => toggleSection('contracts')}
              onContractSelect={handleContractSelect}
              showToast={showToast}
              onNavigateToConsultation={(contract) => {
                handleContractSelect(contract);
                if (onNavigateToConsultationAS) {
                  onNavigateToConsultationAS('consultation');
                }
              }}
              onNavigateToAS={(contract) => {
                handleContractSelect(contract);
                if (onNavigateToConsultationAS) {
                  onNavigateToConsultationAS('as');
                }
              }}
              onNavigateToAddressChange={(contract) => {
                handleContractSelect(contract);
                if (onNavigateToAddressChange) {
                  onNavigateToAddressChange();
                }
              }}
            />

            {/* 납부정보 / 요금내역 */}
            <PaymentInfo
              custId={selectedCustomer.CUST_ID}
              custNm={selectedCustomer.CUST_NM}
              expanded={expandedSections.payment}
              onToggle={() => toggleSection('payment')}
              showToast={showToast}
              onNavigateToPaymentChange={onNavigateToPaymentChange}
              paymentChangeInProgress={paymentChangeInProgress}
              onCancelPaymentChange={onCancelPaymentChange}
              currentWorkingPymAcntId={currentWorkingPymAcntId}
              selectedPymAcntIdFromContract={selectedPymAcntIdFromContract}
            />

            {/* 상담 이력 */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200">
              <div className="flex items-center justify-between px-3 py-2.5">
                <button
                  onClick={() => toggleSection('consultation')}
                  className="flex items-center gap-2 flex-1 text-left"
                >
                  <span className="font-medium text-gray-800">상담이력</span>
                  <span className="text-xs text-gray-500">
                    ({filteredConsultation.length})
                  </span>
                </button>
                <div className="flex items-center gap-1 mr-2">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setHistoryViewMode('byDate');
                      if (selectedCustomer && allConsultationHistory.length === 0 && allWorkHistory.length === 0) {
                        loadAllHistory(selectedCustomer.CUST_ID);
                      }
                    }}
                    className={`px-2 py-0.5 text-xs rounded-full transition-colors ${
                      historyViewMode === 'byDate'
                        ? 'bg-blue-500 text-white'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                  >일자별</button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setHistoryViewMode('byContract');
                    }}
                    className={`px-2 py-0.5 text-xs rounded-full transition-colors ${
                      historyViewMode === 'byContract'
                        ? 'bg-blue-500 text-white'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                  >계약별</button>
                </div>
                <button onClick={() => toggleSection('consultation')}>
                  {expandedSections.consultation ? (
                    <ChevronUp className="w-4 h-4 text-gray-400" />
                  ) : (
                    <ChevronDown className="w-4 h-4 text-gray-400" />
                  )}
                </button>
              </div>

              {expandedSections.consultation && (
                <div className="px-3 pb-3">
                  {isLoadingHistory ? (
                    <div className="flex items-center justify-center py-3">
                      <Loader2 className="w-4 h-4 animate-spin text-gray-400" />
                    </div>
                  ) : historyViewMode === 'byContract' && !selectedCtrtIdForHistory ? (
                    <div className="text-center py-3 text-gray-500 text-sm">
                      계약 현황에서 계약을 선택하세요
                    </div>
                  ) : filteredConsultation.length > 0 ? (
                    <div className="space-y-3">
                      {filteredConsultation.map((item, index) => (
                        <div key={index} className="bg-gray-50 rounded-lg text-sm border border-gray-100">
                          {/* 상단 정보 (클릭으로 접기/펼치기) */}
                          <div
                            className="p-3 cursor-pointer flex items-center justify-between"
                            onClick={() => toggleConsultItem(index)}
                          >
                            <div className="grid grid-cols-4 gap-2 text-xs flex-1">
                              <div className="flex flex-col">
                                <span className="text-gray-500 whitespace-nowrap">접수일</span>
                                <span className="text-gray-800 font-medium">{item.START_DATE || '-'}</span>
                              </div>
                              <div className="flex flex-col">
                                <span className="text-gray-500 whitespace-nowrap">상담소분류</span>
                                <span className="text-gray-800 font-medium truncate">{item.CNSL_SLV_CL_NM || '-'}</span>
                              </div>
                              <div className="flex flex-col">
                                <span className="text-gray-500 whitespace-nowrap">처리상태</span>
                                <span className={`font-medium ${
                                  item.CNSL_RSLT?.includes('완료') ? 'text-green-600' : 'text-yellow-600'
                                }`}>{item.CNSL_RSLT || '처리중'}</span>
                              </div>
                              <div className="flex flex-col">
                                <span className="text-gray-500 whitespace-nowrap">접수자</span>
                                <span className="text-gray-800 font-medium">{item.RCPT_NM || '-'}</span>
                              </div>
                            </div>
                            {expandedConsultItems.has(index) ? (
                              <ChevronUp className="w-4 h-4 text-gray-400 ml-2 flex-shrink-0" />
                            ) : (
                              <ChevronDown className="w-4 h-4 text-gray-400 ml-2 flex-shrink-0" />
                            )}
                          </div>

                          {/* 요청사항 + 응대내용 (접기/펼치기) */}
                          {expandedConsultItems.has(index) && (
                            <div className="px-3 pb-3">
                              <div>
                                <div className="text-xs text-gray-500 mb-1">요청사항</div>
                                <div className="p-2 bg-white border border-gray-200 rounded min-h-[48px] text-gray-700 text-xs">
                                  {item.REQ_CTX || '-'}
                                </div>
                              </div>
                              <div className="mt-2">
                                <div className="text-xs text-gray-500 mb-1">응대내용</div>
                                <div className="p-2 bg-white border border-gray-200 rounded min-h-[48px] text-gray-700 text-xs">
                                  {item.PROC_CT || '-'}
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-3 text-gray-500 text-sm">이력 없음</div>
                  )}
                </div>
              )}
            </div>

            {/* 작업 이력 */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200">
              <div className="flex items-center justify-between px-3 py-2.5">
                <button
                  onClick={() => toggleSection('work')}
                  className="flex items-center gap-2 flex-1 text-left"
                >
                  <span className="font-medium text-gray-800">작업이력</span>
                  <span className="text-xs text-gray-500">
                    ({filteredWork.length})
                  </span>
                </button>
                <div className="flex items-center gap-1 mr-2">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setHistoryViewMode('byDate');
                      if (selectedCustomer && allConsultationHistory.length === 0 && allWorkHistory.length === 0) {
                        loadAllHistory(selectedCustomer.CUST_ID);
                      }
                    }}
                    className={`px-2 py-0.5 text-xs rounded-full transition-colors ${
                      historyViewMode === 'byDate'
                        ? 'bg-blue-500 text-white'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                  >일자별</button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setHistoryViewMode('byContract');
                    }}
                    className={`px-2 py-0.5 text-xs rounded-full transition-colors ${
                      historyViewMode === 'byContract'
                        ? 'bg-blue-500 text-white'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                  >계약별</button>
                </div>
                <button onClick={() => toggleSection('work')}>
                  {expandedSections.work ? (
                    <ChevronUp className="w-4 h-4 text-gray-400" />
                  ) : (
                    <ChevronDown className="w-4 h-4 text-gray-400" />
                  )}
                </button>
              </div>

              {expandedSections.work && (
                <div className="px-3 pb-3">
                  {isLoadingHistory ? (
                    <div className="flex items-center justify-center py-3">
                      <Loader2 className="w-4 h-4 animate-spin text-gray-400" />
                    </div>
                  ) : historyViewMode === 'byContract' && !selectedCtrtIdForHistory ? (
                    <div className="text-center py-3 text-gray-500 text-sm">
                      계약 현황에서 계약을 선택하세요
                    </div>
                  ) : filteredWork.length > 0 ? (
                    <div className="space-y-3">
                      {filteredWork.map((item, index) => (
                        <div key={index} className="p-3 bg-gray-50 rounded-lg text-sm border border-gray-100">
                          {/* 상단: 계약ID | 작업예정일 | 작업구분 | 작업상태 */}
                          <div className="grid grid-cols-4 gap-2 text-xs">
                            <div className="flex flex-col">
                              <span className="text-gray-500 whitespace-nowrap">계약ID</span>
                              <span className="text-gray-800 font-medium text-[10px]">{item.CTRT_ID ? formatId(item.CTRT_ID) : '-'}</span>
                            </div>
                            <div className="flex flex-col">
                              <span className="text-gray-500 whitespace-nowrap">작업예정일</span>
                              <span className="text-gray-800 font-medium">{item.HOPE_DT || '-'}</span>
                            </div>
                            <div className="flex flex-col">
                              <span className="text-gray-500 whitespace-nowrap">작업구분</span>
                              <span className="text-gray-800 font-medium">{item.WRK_CD_NM || '-'}</span>
                            </div>
                            <div className="flex flex-col">
                              <span className="text-gray-500 whitespace-nowrap">작업상태</span>
                              <span className={`font-medium ${
                                item.WRK_STAT_CD_NM?.includes('완료') ? 'text-green-600' :
                                item.WRK_STAT_CD_NM?.includes('진행') ? 'text-blue-600' :
                                'text-gray-800'
                              }`}>{item.WRK_STAT_CD_NM || '-'}</span>
                            </div>
                          </div>

                          {/* 상품명 */}
                          <div className="mt-2 grid grid-cols-[auto_1fr] gap-2 text-xs items-center">
                            <span className="text-gray-500 whitespace-nowrap">상품명</span>
                            <span className="text-gray-800 font-medium truncate">{item.PROD_NM || '-'}</span>
                          </div>

                          {/* 완료일자 | 작업자 | 작업자소속 */}
                          <div className="mt-2 grid grid-cols-3 gap-2 text-xs">
                            <div className="flex flex-col">
                              <span className="text-gray-500 whitespace-nowrap">완료일자</span>
                              <span className="text-gray-800 font-medium">{item.CMPL_DATE || '-'}</span>
                            </div>
                            <div className="flex flex-col">
                              <span className="text-gray-500 whitespace-nowrap">작업자</span>
                              <span className="text-gray-800 font-medium">{item.WRK_NM || '-'}</span>
                            </div>
                            <div className="flex flex-col">
                              <span className="text-gray-500 whitespace-nowrap">작업자소속</span>
                              <span className="text-gray-800 font-medium">{item.WRK_CRR_NM || '-'}</span>
                            </div>
                          </div>

                          {/* 설치주소 */}
                          <div className="mt-2 grid grid-cols-[auto_1fr] gap-2 text-xs items-start">
                            <span className="text-gray-500 whitespace-nowrap">설치주소</span>
                            <span className="text-gray-800">{item.CTRT_ADDR || '-'}</span>
                          </div>

                          {/* 작업지시내용 (접기/펼치기) */}
                          <div
                            className="mt-3 cursor-pointer"
                            onClick={() => toggleWorkItem(index)}
                          >
                            <div className="flex items-center justify-between mb-1">
                              <div className="text-xs text-gray-500">작업지시내용</div>
                              {expandedWorkItems.has(index) ? (
                                <ChevronUp className="w-3.5 h-3.5 text-gray-400" />
                              ) : (
                                <ChevronDown className="w-3.5 h-3.5 text-gray-400" />
                              )}
                            </div>
                            {expandedWorkItems.has(index) && (
                              <div className="p-2 bg-white border border-gray-200 rounded min-h-[48px] text-gray-700 text-xs">
                                {item.MEMO || '-'}
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-3 text-gray-500 text-sm">이력 없음</div>
                  )}
                </div>
              )}
            </div>
          </>
        ) : (
          <div className="flex items-center justify-center h-48 text-gray-400 text-sm">
            상단에서 고객을 검색하고 선택해주세요.
          </div>
        )}
      </div>
    </div>
  );
};

export default CustomerBasicInfo;
