import React, { useState, useEffect, useRef } from 'react';
import { Search, ChevronDown, ChevronUp, Filter } from 'lucide-react';
import CustomerSearchModal from './CustomerSearchModal';
import {
  getLghvSendHist,
  getLghvSvcRslt,
  getSendHistory,
  getSvcRsltAndDtlRslt,
  getCertifyApiHist,
  getContractList,
  getLghvProdMap,
  getCommonCodes,
  LghvSendHistory,
  LghvSvcResult,
  SendHistory,
  SvcRslt,
  SvcDtlRslt,
  CertifyApiHistory,
  CustomerSearchResult,
} from '../../services/apiService';
import { getCertifyProdMap } from '../../services/certifyApiService';

interface SignalIntegrationProps {
  onBack: () => void;
  userInfo?: { userId: string; userName: string; soId?: string } | null;
  showToast?: (message: string, type: 'success' | 'error' | 'warning' | 'info') => void;
}

interface ContractInfo {
  CTRT_ID: string;
  CUST_ID?: string;
  BASIC_PROD_CD_NM?: string;
  CTRT_STAT_NM?: string;
  CTRT_STAT?: string;
  SO_NM?: string;
  ADDR?: string;
  PROD_NM?: string;
  INSTL_ADDR?: string;
  [key: string]: any;
}

type SignalType = 'basic' | 'lgu' | 'ftth';

const SignalIntegration: React.FC<SignalIntegrationProps> = ({ onBack, userInfo, showToast }) => {
  // Customer search
  const [showSearchModal, setShowSearchModal] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<CustomerSearchResult | null>(null);

  // Contract list
  const [contracts, setContracts] = useState<ContractInfo[]>([]);
  const [selectedContract, setSelectedContract] = useState<ContractInfo | null>(null);
  const [showAllContracts, setShowAllContracts] = useState(false);
  const [contractFilter, setContractFilter] = useState<'all' | 'active'>('all');
  const [contractSearch, setContractSearch] = useState('');
  const [isContractCollapsed, setIsContractCollapsed] = useState(false);

  // Contract loading
  const [isLoadingContracts, setIsLoadingContracts] = useState(false);

  // Signal type
  const [signalType, setSignalType] = useState<SignalType>('basic');

  // Product detection cache (레거시: bLghvStb, ds_certify_prod, ds_certify_so)
  const lghvProdListRef = useRef<any[]>([]);
  const certifyProdListRef = useRef<string[]>([]);
  const certifySoListRef = useRef<string[]>([]);
  const prodCacheLoaded = useRef(false);

  // 상품 목록 캐시 로드
  useEffect(() => {
    if (prodCacheLoaded.current) return;
    prodCacheLoaded.current = true;
    (async () => {
      try {
        const [lghvList, certifyList, soList] = await Promise.all([
          getLghvProdMap().catch(() => []),
          getCertifyProdMap().catch(() => []),
          getCommonCodes('CMIF006').catch(() => []),
        ]);
        lghvProdListRef.current = lghvList || [];
        certifyProdListRef.current = certifyList || [];
        certifySoListRef.current = (soList || []).map((item: any) => item.code || item.COMMON_CD);
      } catch (e) {
        console.error('[SignalIntegration] 상품 캐시 로드 실패:', e);
      }
    })();
  }, []);

  // 계약 선택 시 자동 탭 판별 (레거시: bLghvStb → LGU, certify_prod+certify_so → FTTH, else → basic)
  const detectSignalType = (contract: ContractInfo): SignalType => {
    const prodCd = contract.BASIC_PROD_CD || contract.PROD_CD || '';
    const soId = contract.SO_ID || '';

    if (prodCd && lghvProdListRef.current.some((p: any) => p.PROD_CD === prodCd)) {
      return 'lgu';
    }
    if (prodCd && certifyProdListRef.current.includes(prodCd)
        && soId && certifySoListRef.current.includes(soId)) {
      return 'ftth';
    }
    return 'basic';
  };

  // Auto search trigger
  const [pendingAutoSearch, setPendingAutoSearch] = useState(false);

  // Search conditions
  const [directCtrtId, setDirectCtrtId] = useState('');
  const [dateFrom, setDateFrom] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 7);
    return d.toISOString().slice(0, 10);
  });
  const [dateTo, setDateTo] = useState(new Date().toISOString().slice(0, 10));

  // Loading states
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [isLoadingDetail, setIsLoadingDetail] = useState(false);

  // dlive basic
  const [basicHistories, setBasicHistories] = useState<SendHistory[]>([]);
  const [selectedBasicHistory, setSelectedBasicHistory] = useState<SendHistory | null>(null);
  const [basicSvcRslt, setBasicSvcRslt] = useState<SvcRslt[]>([]);
  const [basicDtlRslt, setBasicDtlRslt] = useState<SvcDtlRslt[]>([]);

  // LGU
  const [lguHistories, setLguHistories] = useState<LghvSendHistory[]>([]);
  const [selectedLguHistory, setSelectedLguHistory] = useState<LghvSendHistory | null>(null);
  const [lguSvcResults, setLguSvcResults] = useState<LghvSvcResult[]>([]);

  // FTTH
  const [ftthHistories, setFtthHistories] = useState<CertifyApiHistory[]>([]);

  // Format CTRT_ID with hyphens
  const formatCtrtId = (id: string) => {
    if (!id) return '-';
    const s = id.replace(/[^0-9]/g, '');
    if (s.length === 10) return `${s.slice(0,3)}-${s.slice(3,6)}-${s.slice(6)}`;
    return id;
  };

  // Format datetime
  const formatDateTime = (dt: string) => {
    if (!dt) return '-';
    const s = dt.replace(/[-: T]/g, '');
    if (s.length >= 14) return `${s.slice(0,4)}-${s.slice(4,6)}-${s.slice(6,8)} ${s.slice(8,10)}:${s.slice(10,12)}:${s.slice(12,14)}`;
    if (s.length >= 8) return `${s.slice(0,4)}-${s.slice(4,6)}-${s.slice(6,8)}`;
    return dt;
  };

  // Clear all history states
  const clearHistories = () => {
    setBasicHistories([]); setSelectedBasicHistory(null); setBasicSvcRslt([]); setBasicDtlRslt([]);
    setLguHistories([]); setSelectedLguHistory(null); setLguSvcResults([]);
    setFtthHistories([]);
  };

  // Customer selected
  const handleCustomerSelected = async (customer: CustomerSearchResult) => {
    setSelectedCustomer(customer);
    setContracts([]);
    setSelectedContract(null);
    clearHistories();
    setIsLoadingContracts(true);

    if (customer.CTRT_ID) {
      const ctrt: ContractInfo = {
        CTRT_ID: customer.CTRT_ID,
        CUST_ID: customer.CUST_ID,
        BASIC_PROD_CD_NM: customer.BASIC_PROD_CD_NM || customer.PROD_NM,
        CTRT_STAT_NM: customer.CTRT_STAT_NM,
        SO_NM: customer.SO_NM,
        ADDR: customer.ADDR,
      };
      setSelectedContract(ctrt);
      setDirectCtrtId(customer.CTRT_ID);
    }

    if (customer.CUST_ID) {
      try {
        const list = await getContractList(customer.CUST_ID);
        if (list.length > 0) {
          setContracts(list);
          const searchedCtrtId = customer.CTRT_ID;
          if (searchedCtrtId) {
            // 정확한 CTRT_ID 매칭 시도
            const match = list.find((c: any) => c.CTRT_ID === searchedCtrtId);
            if (match) {
              setSelectedContract(match);
              setDirectCtrtId(match.CTRT_ID);
              const detected = detectSignalType(match);
              setSignalType(detected);
            } else {
              // 계약 목록에서 매칭 실패해도 검색한 CTRT_ID는 유지
              console.log('[SignalIntegration] 계약 목록에서 CTRT_ID 매칭 실패, 검색 CTRT_ID 유지:', searchedCtrtId);
              setDirectCtrtId(searchedCtrtId);
            }
          } else if (!selectedContract && list.length === 1) {
            // CTRT_ID 없이 검색한 경우 계약이 1건이면 자동 선택
            setSelectedContract(list[0]);
            setDirectCtrtId(list[0].CTRT_ID);
            const detected = detectSignalType(list[0]);
            setSignalType(detected);
          }
        }
      } catch (err) {
        console.error('Failed to load contract list:', err);
      } finally {
        setIsLoadingContracts(false);
      }
    } else {
      // CUST_ID 없이 CTRT_ID만 있는 경우에도 directCtrtId 유지
      setIsLoadingContracts(false);
    }

    // 계약ID로 검색한 경우 자동 조회 트리거
    if (customer.CTRT_ID) {
      setPendingAutoSearch(true);
    }
  };

  // 계약ID 검색 후 자동 조회
  useEffect(() => {
    if (pendingAutoSearch && !isLoadingContracts && directCtrtId) {
      setPendingAutoSearch(false);
      handleSearchHistory();
    }
  }, [pendingAutoSearch, isLoadingContracts, directCtrtId]);

  // Contract selected → 자동 탭 판별
  const handleContractSelect = (contract: ContractInfo) => {
    // 이미 선택된 계약을 다시 누르면 접기/펼치기 토글
    if (selectedContract?.CTRT_ID === contract.CTRT_ID && isContractCollapsed) {
      setIsContractCollapsed(false);
      return;
    }
    setSelectedContract(contract);
    setDirectCtrtId(contract.CTRT_ID);
    clearHistories();
    const detected = detectSignalType(contract);
    setSignalType(detected);
    setIsContractCollapsed(false);
  };

  // Search history
  const handleSearchHistory = async () => {
    const ctrtId = directCtrtId.trim();
    if (!ctrtId) {
      showToast?.('계약ID를 입력하세요.', 'warning');
      return;
    }

    setIsLoadingHistory(true);
    clearHistories();
    setIsContractCollapsed(true);

    try {
      const from = dateFrom.replace(/-/g, '');
      const toDate = new Date(dateTo);
      toDate.setDate(toDate.getDate() + 1);
      const toStr = toDate.toISOString().slice(0, 10).replace(/-/g, '');

      if (signalType === 'basic') {
        const data = await getSendHistory({ CTRT_ID: ctrtId, STRT_DTTM1: from, STRT_DTTM2: toStr, CALL_GB: 'M' });
        setBasicHistories(data.slice(0, 100));
      } else if (signalType === 'lgu') {
        const data = await getLghvSendHist({ CTRT_ID: ctrtId, STRT_DTTM1: from, STRT_DTTM2: toStr, CALL_GB: 'M' });
        setLguHistories(data.slice(0, 100));
      } else {
        const data = await getCertifyApiHist({ CTRT_ID: ctrtId, STRT_DTTM1: from, STRT_DTTM2: toStr });
        setFtthHistories(data.slice(0, 100));
      }

      const count = signalType === 'basic' ? basicHistories.length : signalType === 'lgu' ? lguHistories.length : ftthHistories.length;
      // toast after state update won't reflect new count, so use data directly
      showToast?.('조회가 완료되었습니다.', 'success');
    } catch (err) {
      console.error('Signal history query error:', err);
      showToast?.('통신이력 조회에 실패했습니다.', 'error');
    } finally {
      setIsLoadingHistory(false);
    }
  };

  // Select basic history row → load detail
  const handleBasicHistorySelect = async (item: SendHistory) => {
    setSelectedBasicHistory(item);
    setBasicSvcRslt([]);
    setBasicDtlRslt([]);

    if (!item.IF_DTL_ID) return;
    setIsLoadingDetail(true);
    try {
      const { svcRslt, svcDtlRslt } = await getSvcRsltAndDtlRslt(item.IF_DTL_ID);
      setBasicSvcRslt(svcRslt);
      setBasicDtlRslt(svcDtlRslt);
    } catch (err) {
      console.error('Detail query error:', err);
    } finally {
      setIsLoadingDetail(false);
    }
  };

  // Select LGU history row → load detail
  const handleLguHistorySelect = async (item: LghvSendHistory) => {
    setSelectedLguHistory(item);
    setLguSvcResults([]);

    if (!item.JOB_ID) return;
    setIsLoadingDetail(true);
    try {
      const data = await getLghvSvcRslt(item.JOB_ID);
      setLguSvcResults(data);
    } catch (err) {
      console.error('LGU detail query error:', err);
    } finally {
      setIsLoadingDetail(false);
    }
  };

  // Filtered contracts
  const activeContracts = contracts.filter(c => c.CTRT_STAT_NM === '사용' || c.CTRT_STAT === '10');
  const baseContracts = contractFilter === 'active' ? activeContracts : contracts;
  const filteredContracts = contractSearch
    ? baseContracts.filter(c =>
        (c.CTRT_ID || '').includes(contractSearch) ||
        (c.BASIC_PROD_CD_NM || c.PROD_NM || '').includes(contractSearch) ||
        (c.ADDR || c.INSTL_ADDR || '').includes(contractSearch)
      )
    : baseContracts;

  const historyCount = signalType === 'basic' ? basicHistories.length : signalType === 'lgu' ? lguHistories.length : ftthHistories.length;
  const hasHistories = historyCount > 0;

  return (
    <div className="flex-1 overflow-y-auto px-3 pt-2 pb-4 space-y-3">
      {/* Customer Search Bar */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-3">
        <div className="flex items-center gap-2">
          <label className="text-xs font-medium text-gray-500 w-14 flex-shrink-0">고객검색</label>
          <button
            onClick={() => setShowSearchModal(true)}
            className="flex-1 flex items-center gap-2 px-3 py-2.5 border border-gray-300 rounded-lg text-left hover:bg-gray-50 transition-colors"
          >
            {selectedCustomer ? (
              <span className="text-sm text-gray-900 truncate">
                {selectedCustomer.CUST_NM || '-'} ({selectedCustomer.CUST_ID})
              </span>
            ) : (
              <span className="text-sm text-gray-400">고객명, 고객ID, 계약ID, 전화번호</span>
            )}
            <Search className="h-4 w-4 text-gray-400 ml-auto flex-shrink-0" />
          </button>
        </div>
      </div>

      {/* Contract Loading */}
      {isLoadingContracts && (
        <div className="text-center py-8 bg-white rounded-lg shadow-sm border border-gray-200">
          <div className="inline-block animate-spin rounded-full h-6 w-6 border-[3px] border-blue-500 border-t-transparent"></div>
          <p className="mt-2 text-sm text-gray-500">계약 정보 조회 중...</p>
        </div>
      )}

      {/* Contract List */}
      {contracts.length > 0 && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
          <button
            onClick={() => setIsContractCollapsed(!isContractCollapsed)}
            className="w-full px-3 py-2.5 border-b border-gray-100 flex items-center justify-between hover:bg-gray-50 transition-colors"
          >
            <h3 className="text-sm font-bold text-gray-800 flex items-center gap-1.5">
              <span className="text-blue-500">|</span> 계약 현황 <span className="text-blue-500 font-normal">({filteredContracts.length}건)</span>
              {isContractCollapsed && selectedContract && (
                <span className="text-xs font-normal text-gray-500 ml-1">
                  - {formatCtrtId(selectedContract.CTRT_ID)} ({selectedContract.BASIC_PROD_CD_NM || selectedContract.PROD_NM || ''})
                </span>
              )}
            </h3>
            {isContractCollapsed ? <ChevronDown className="h-4 w-4 text-gray-400" /> : <ChevronUp className="h-4 w-4 text-gray-400" />}
          </button>

          {!isContractCollapsed && (
            <>
              <div className="px-3 py-1.5 border-b border-gray-100 flex items-center justify-end">
                <div className="flex gap-1">
                  <button
                    onClick={() => setContractFilter('all')}
                    className={`px-2.5 py-1 text-xs rounded-full font-medium ${contractFilter === 'all' ? 'bg-blue-500 text-white' : 'bg-gray-100 text-gray-500'}`}
                  >
                    전체({contracts.length})
                  </button>
                  <button
                    onClick={() => setContractFilter('active')}
                    className={`px-2.5 py-1 text-xs rounded-full font-medium ${contractFilter === 'active' ? 'bg-blue-500 text-white' : 'bg-gray-100 text-gray-500'}`}
                  >
                    사용계약({activeContracts.length})
                  </button>
                </div>
              </div>

              {/* Contract search */}
              <div className="px-3 py-2 border-b border-gray-50">
                <div className="relative">
                  <Filter className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
                  <input
                    type="text"
                    value={contractSearch}
                    onChange={(e) => setContractSearch(e.target.value)}
                    className="w-full pl-8 pr-3 py-1.5 text-xs border border-gray-200 rounded-md bg-gray-50 focus:bg-white focus:border-blue-300 focus:outline-none"
                    placeholder="계약ID, 상품명, 장비번호 검색"
                  />
                </div>
              </div>

              <div className={`${showAllContracts ? 'max-h-72' : 'max-h-44'} overflow-y-auto`}>
                {filteredContracts.map((contract, idx) => (
                  <button
                    key={contract.CTRT_ID || idx}
                    onClick={() => handleContractSelect(contract)}
                    className={`w-full text-left px-3 py-2.5 border-b border-gray-50 transition-colors ${
                      selectedContract?.CTRT_ID === contract.CTRT_ID
                        ? 'bg-blue-50 border-l-3 border-l-blue-500'
                        : 'hover:bg-gray-50'
                    }`}
                  >
                    <div className="flex items-start gap-2.5">
                      <span className={`flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                        selectedContract?.CTRT_ID === contract.CTRT_ID ? 'bg-blue-500 text-white' : 'bg-gray-200 text-gray-600'
                      }`}>
                        {idx + 1}
                      </span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <p className="text-sm font-medium text-gray-900 truncate">
                            {contract.BASIC_PROD_CD_NM || contract.PROD_NM || '-'}
                          </p>
                          <span className={`text-xs px-2 py-0.5 rounded-full flex-shrink-0 ml-2 ${
                            contract.CTRT_STAT_NM === '사용' ? 'bg-green-100 text-green-700' :
                            contract.CTRT_STAT_NM === '설치대기' ? 'bg-blue-100 text-blue-600' :
                            contract.CTRT_STAT_NM === '해지' ? 'bg-red-100 text-red-600' :
                            'bg-gray-100 text-gray-600'
                          }`}>
                            {contract.CTRT_STAT_NM || '-'}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 mt-1 text-xs text-gray-500">
                          <span>계약 ID: {formatCtrtId(contract.CTRT_ID)}</span>
                          <span className="text-gray-300">|</span>
                          <span>{contract.SO_NM || 'N/A'}</span>
                        </div>
                        {(contract.ADDR || contract.INSTL_ADDR) && (
                          <p className="mt-0.5 text-xs text-gray-400 truncate">
                            {contract.INSTL_ADDR || contract.ADDR}
                          </p>
                        )}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
              {filteredContracts.length > 3 && (
                <button
                  onClick={() => setShowAllContracts(!showAllContracts)}
                  className="w-full py-1.5 text-xs text-blue-500 hover:bg-blue-50 flex items-center justify-center gap-1"
                >
                  {showAllContracts ? <><ChevronUp className="h-3 w-3" /> 접기</> : <><ChevronDown className="h-3 w-3" /> 더보기</>}
                </button>
              )}
            </>
          )}
        </div>
      )}

      {/* Search Conditions */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-3 space-y-3">
        <div className="flex items-center gap-2">
          <label className="text-xs font-medium text-gray-600 w-14 flex-shrink-0">계약ID</label>
          <input
            type="text"
            value={directCtrtId}
            onChange={(e) => setDirectCtrtId(e.target.value)}
            className="flex-1 px-3 py-2 text-sm border border-gray-300 rounded-lg focus:border-blue-400 focus:outline-none"
            placeholder="계약ID 입력"
            maxLength={15}
          />
        </div>
        <div className="flex items-center gap-2">
          <label className="text-xs font-medium text-gray-600 w-14 flex-shrink-0">기간</label>
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            className="flex-1 px-2 py-2 text-sm border border-gray-300 rounded-lg"
            style={{ colorScheme: 'light' }}
          />
          <span className="text-gray-400 text-sm">~</span>
          <input
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            className="flex-1 px-2 py-2 text-sm border border-gray-300 rounded-lg"
            style={{ colorScheme: 'light' }}
          />
        </div>
        <button
          onClick={handleSearchHistory}
          disabled={isLoadingHistory}
          className="w-full bg-blue-500 hover:bg-blue-600 text-white py-2.5 rounded-lg font-medium text-sm shadow-sm transition-all disabled:opacity-50"
        >
          {isLoadingHistory ? '조회 중...' : '조회'}
        </button>
      </div>

      {/* History Results */}
      {isLoadingHistory ? (
        <div className="text-center py-10 bg-white rounded-lg shadow-sm border border-gray-200">
          <div className="inline-block animate-spin rounded-full h-7 w-7 border-[3px] border-blue-500 border-t-transparent"></div>
          <p className="mt-2 text-sm text-gray-500">통신이력 조회 중...</p>
        </div>
      ) : hasHistories ? (
        <>
          {/* dlive기본 History */}
          {signalType === 'basic' && basicHistories.length > 0 && (
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
              <div className="px-3 py-2.5 border-b border-gray-100">
                <h3 className="text-sm font-bold text-gray-800">
                  통신이력정보 <span className="text-blue-500 font-normal">({basicHistories.length}건)</span>
                </h3>
              </div>
              <div className="overflow-x-auto">
                <div className="max-h-64 overflow-y-auto">
                  <table className="w-full min-w-[780px]">
                    <thead className="bg-gray-50 sticky top-0 z-10">
                      <tr>
                        <th className="px-2 py-2 text-left text-[0.6875rem] font-semibold text-gray-600 border-b whitespace-nowrap">전송ID</th>
                        <th className="px-2 py-2 text-left text-[0.6875rem] font-semibold text-gray-600 border-b whitespace-nowrap">상품명(KCT요금제)</th>
                        <th className="px-2 py-2 text-left text-[0.6875rem] font-semibold text-gray-600 border-b whitespace-nowrap">메세지ID</th>
                        <th className="px-2 py-2 text-left text-[0.6875rem] font-semibold text-gray-600 border-b whitespace-nowrap">메세지명</th>
                        <th className="px-2 py-2 text-center text-[0.6875rem] font-semibold text-gray-600 border-b whitespace-nowrap">전송결과</th>
                        <th className="px-2 py-2 text-center text-[0.6875rem] font-semibold text-gray-600 border-b whitespace-nowrap">처리결과</th>
                        <th className="px-2 py-2 text-center text-[0.6875rem] font-semibold text-gray-600 border-b whitespace-nowrap">SO_ID</th>
                      </tr>
                    </thead>
                    <tbody>
                      {basicHistories.map((item, idx) => (
                        <tr
                          key={`${item.IF_DTL_ID}-${idx}`}
                          onClick={() => handleBasicHistorySelect(item)}
                          className={`cursor-pointer transition-colors ${
                            selectedBasicHistory?.IF_DTL_ID === item.IF_DTL_ID ? 'bg-blue-100' : idx % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'
                          } hover:bg-blue-50`}
                        >
                          <td className="px-2 py-1.5 text-[0.6875rem] text-gray-900 border-b whitespace-nowrap">{item.IF_DTL_ID || '-'}</td>
                          <td className="px-2 py-1.5 text-[0.6875rem] text-gray-900 border-b whitespace-nowrap max-w-[140px] truncate">{item.PROD_NM || '-'}</td>
                          <td className="px-2 py-1.5 text-[0.6875rem] text-gray-900 border-b whitespace-nowrap">{item.MSG_ID || '-'}</td>
                          <td className="px-2 py-1.5 text-[0.6875rem] text-gray-900 border-b whitespace-nowrap max-w-[120px] truncate">{item.MSG_ID_NM || '-'}</td>
                          <td className="px-2 py-1.5 text-[0.6875rem] text-center border-b whitespace-nowrap">
                            <span className={item.RSLT_CD_NM === '정상전송' ? 'text-green-600' : 'text-orange-600'}>{item.RSLT_CD_NM || '-'}</span>
                          </td>
                          <td className="px-2 py-1.5 text-[0.6875rem] text-center border-b whitespace-nowrap">
                            <span className={item.PROC_RSLT_CD_NM === '정상처리' ? 'text-green-600' : 'text-orange-600'}>{item.PROC_RSLT_CD_NM || '-'}</span>
                          </td>
                          <td className="px-2 py-1.5 text-[0.6875rem] text-center text-gray-900 border-b whitespace-nowrap">{item.SO_ID || '-'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* dlive기본 Detail */}
          {signalType === 'basic' && selectedBasicHistory && (
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
              <div className="px-3 py-2.5 border-b border-gray-100">
                <h3 className="text-sm font-bold text-gray-800">
                  전송결과 <span className="text-xs text-gray-400 font-normal ml-1">전송ID: {selectedBasicHistory.IF_DTL_ID}</span>
                </h3>
              </div>
              {isLoadingDetail ? (
                <div className="text-center py-6">
                  <div className="inline-block animate-spin rounded-full h-5 w-5 border-2 border-blue-500 border-t-transparent"></div>
                </div>
              ) : basicSvcRslt.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[700px]">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-2 py-2 text-center text-[0.6875rem] font-semibold text-gray-600 border-b whitespace-nowrap">대상</th>
                        <th className="px-2 py-2 text-center text-[0.6875rem] font-semibold text-gray-600 border-b whitespace-nowrap">전송ID</th>
                        <th className="px-2 py-2 text-center text-[0.6875rem] font-semibold text-gray-600 border-b whitespace-nowrap">처리일시</th>
                        <th className="px-2 py-2 text-center text-[0.6875rem] font-semibold text-gray-600 border-b whitespace-nowrap">상세</th>
                        <th className="px-2 py-2 text-center text-[0.6875rem] font-semibold text-gray-600 border-b whitespace-nowrap">처리결과</th>
                        <th className="px-2 py-2 text-left text-[0.6875rem] font-semibold text-gray-600 border-b whitespace-nowrap">처리메세지</th>
                      </tr>
                    </thead>
                    <tbody>
                      {basicSvcRslt.map((r, idx) => (
                        <tr key={idx} className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'}>
                          <td className="px-2 py-1.5 text-[0.6875rem] text-center text-gray-900 border-b whitespace-nowrap">{r.REQ_SYSTEM || '-'}</td>
                          <td className="px-2 py-1.5 text-[0.6875rem] text-center text-gray-900 border-b whitespace-nowrap">{r.IF_DTL_ID || '-'}</td>
                          <td className="px-2 py-1.5 text-[0.6875rem] text-center text-gray-900 border-b whitespace-nowrap">{formatDateTime(r.REG_DTTM)}</td>
                          <td className="px-2 py-1.5 text-[0.6875rem] text-center text-gray-900 border-b whitespace-nowrap">{r.IF_TP || '-'}</td>
                          <td className="px-2 py-1.5 text-[0.6875rem] text-center border-b whitespace-nowrap">
                            <span className={r.SYSTEM_RSLT_CD && r.SYSTEM_RSLT_CD.startsWith('0') ? 'text-green-600' : 'text-red-600'}>
                              {r.SYSTEM_RSLT_CD || '-'}
                            </span>
                          </td>
                          <td className="px-2 py-1.5 text-[0.6875rem] text-gray-900 border-b whitespace-nowrap">{r.SYSTEM_RSLT_MSG || '-'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="text-center py-4">
                  <p className="text-xs text-gray-400">전송결과 데이터가 없습니다</p>
                </div>
              )}

              {/* DtlRslt table */}
              {basicDtlRslt.length > 0 && (
                <div className="border-t border-gray-200">
                  <div className="px-3 py-2 bg-gray-50 border-b border-gray-100">
                    <h4 className="text-xs font-semibold text-gray-700">상세 처리결과</h4>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[700px]">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-2 py-1.5 text-center text-[0.6875rem] font-semibold text-gray-600 border-b whitespace-nowrap">전송ID</th>
                          <th className="px-2 py-1.5 text-center text-[0.6875rem] font-semibold text-gray-600 border-b whitespace-nowrap">시스템상세</th>
                          <th className="px-2 py-1.5 text-center text-[0.6875rem] font-semibold text-gray-600 border-b whitespace-nowrap">단말 처리결과</th>
                          <th className="px-2 py-1.5 text-center text-[0.6875rem] font-semibold text-gray-600 border-b whitespace-nowrap">위치 처리결과</th>
                          <th className="px-2 py-1.5 text-left text-[0.6875rem] font-semibold text-gray-600 border-b whitespace-nowrap">단말 처리메시지</th>
                          <th className="px-2 py-1.5 text-left text-[0.6875rem] font-semibold text-gray-600 border-b whitespace-nowrap">위치 처리메시지</th>
                        </tr>
                      </thead>
                      <tbody>
                        {basicDtlRslt.map((r, idx) => (
                          <tr key={idx} className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'}>
                            <td className="px-2 py-1.5 text-[0.6875rem] text-center text-gray-900 border-b whitespace-nowrap">{r.IF_DTL_ID || '-'}</td>
                            <td className="px-2 py-1.5 text-[0.6875rem] text-center text-gray-900 border-b whitespace-nowrap">{r.IF_TP || '-'}</td>
                            <td className="px-2 py-1.5 text-[0.6875rem] text-center border-b whitespace-nowrap">
                              <span className={r.TMS_PROC_STATUS_NM?.includes('정상') ? 'text-green-600' : 'text-orange-600'}>{r.TMS_PROC_STATUS_NM || '-'}</span>
                            </td>
                            <td className="px-2 py-1.5 text-[0.6875rem] text-center border-b whitespace-nowrap">
                              <span className={r.LS_PROC_STATUS_NM?.includes('정상') ? 'text-green-600' : 'text-orange-600'}>{r.LS_PROC_STATUS_NM || '-'}</span>
                            </td>
                            <td className="px-2 py-1.5 text-[0.6875rem] text-gray-900 border-b whitespace-nowrap">{r.TMS_ERR_MSG || '-'}</td>
                            <td className="px-2 py-1.5 text-[0.6875rem] text-gray-900 border-b whitespace-nowrap">{r.LS_ERR_MSG || '-'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* LGU History */}
          {signalType === 'lgu' && lguHistories.length > 0 && (
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
              <div className="px-3 py-2.5 border-b border-gray-100">
                <h3 className="text-sm font-bold text-gray-800">
                  통신이력정보 <span className="text-blue-500 font-normal">({lguHistories.length}건)</span>
                </h3>
              </div>
              <div className="overflow-x-auto">
                <div className="max-h-64 overflow-y-auto">
                  <table className="w-full min-w-[780px]">
                    <thead className="bg-gray-50 sticky top-0 z-10">
                      <tr>
                        <th className="px-2 py-2 text-left text-[0.6875rem] font-semibold text-gray-600 border-b whitespace-nowrap">전송ID</th>
                        <th className="px-2 py-2 text-left text-[0.6875rem] font-semibold text-gray-600 border-b whitespace-nowrap">상품명(KCT요금제)</th>
                        <th className="px-2 py-2 text-left text-[0.6875rem] font-semibold text-gray-600 border-b whitespace-nowrap">메세지ID</th>
                        <th className="px-2 py-2 text-left text-[0.6875rem] font-semibold text-gray-600 border-b whitespace-nowrap">메세지명</th>
                        <th className="px-2 py-2 text-center text-[0.6875rem] font-semibold text-gray-600 border-b whitespace-nowrap">전송결과</th>
                        <th className="px-2 py-2 text-center text-[0.6875rem] font-semibold text-gray-600 border-b whitespace-nowrap">처리결과</th>
                        <th className="px-2 py-2 text-center text-[0.6875rem] font-semibold text-gray-600 border-b whitespace-nowrap">SO_ID</th>
                      </tr>
                    </thead>
                    <tbody>
                      {lguHistories.map((item, idx) => (
                        <tr
                          key={`${item.JOB_ID}-${idx}`}
                          onClick={() => handleLguHistorySelect(item)}
                          className={`cursor-pointer transition-colors ${
                            selectedLguHistory?.JOB_ID === item.JOB_ID ? 'bg-blue-100' : idx % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'
                          } hover:bg-blue-50`}
                        >
                          <td className="px-2 py-1.5 text-[0.6875rem] text-gray-900 border-b whitespace-nowrap">{item.JOB_ID || '-'}</td>
                          <td className="px-2 py-1.5 text-[0.6875rem] text-gray-900 border-b whitespace-nowrap max-w-[140px] truncate">{item.PROD_NM || '-'}</td>
                          <td className="px-2 py-1.5 text-[0.6875rem] text-gray-900 border-b whitespace-nowrap">{item.MSG_ID || '-'}</td>
                          <td className="px-2 py-1.5 text-[0.6875rem] text-gray-900 border-b whitespace-nowrap max-w-[120px] truncate">{item.MSG_ID_NM || '-'}</td>
                          <td className="px-2 py-1.5 text-[0.6875rem] text-center border-b whitespace-nowrap">
                            <span className={item.RSLT_CD_NM === '정상전송' ? 'text-green-600' : 'text-orange-600'}>{item.RSLT_CD_NM || '-'}</span>
                          </td>
                          <td className="px-2 py-1.5 text-[0.6875rem] text-center border-b whitespace-nowrap">
                            <span className={item.PROC_RSLT_CD_NM === '정상처리' ? 'text-green-600' : 'text-orange-600'}>{item.PROC_RSLT_CD_NM || '-'}</span>
                          </td>
                          <td className="px-2 py-1.5 text-[0.6875rem] text-center text-gray-900 border-b whitespace-nowrap">{item.SO_ID || '-'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* LGU Detail */}
          {signalType === 'lgu' && selectedLguHistory && (
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
              <div className="px-3 py-2.5 border-b border-gray-100">
                <h3 className="text-sm font-bold text-gray-800">
                  전송결과 <span className="text-xs text-gray-400 font-normal ml-1">전송ID: {selectedLguHistory.JOB_ID}</span>
                </h3>
              </div>
              {isLoadingDetail ? (
                <div className="text-center py-6">
                  <div className="inline-block animate-spin rounded-full h-5 w-5 border-2 border-blue-500 border-t-transparent"></div>
                </div>
              ) : lguSvcResults.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[700px]">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-2 py-2 text-center text-[0.6875rem] font-semibold text-gray-600 border-b whitespace-nowrap">대상</th>
                        <th className="px-2 py-2 text-center text-[0.6875rem] font-semibold text-gray-600 border-b whitespace-nowrap">전송ID</th>
                        <th className="px-2 py-2 text-center text-[0.6875rem] font-semibold text-gray-600 border-b whitespace-nowrap">처리일시</th>
                        <th className="px-2 py-2 text-center text-[0.6875rem] font-semibold text-gray-600 border-b whitespace-nowrap">상세</th>
                        <th className="px-2 py-2 text-center text-[0.6875rem] font-semibold text-gray-600 border-b whitespace-nowrap">처리결과</th>
                        <th className="px-2 py-2 text-left text-[0.6875rem] font-semibold text-gray-600 border-b whitespace-nowrap">처리메세지</th>
                      </tr>
                    </thead>
                    <tbody>
                      {lguSvcResults.map((r, idx) => (
                        <tr key={idx} className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'}>
                          <td className="px-2 py-1.5 text-[0.6875rem] text-center text-gray-900 border-b whitespace-nowrap">{r.REQ_SYSTEM || '-'}</td>
                          <td className="px-2 py-1.5 text-[0.6875rem] text-center text-gray-900 border-b whitespace-nowrap">{r.JOB_ID || '-'}</td>
                          <td className="px-2 py-1.5 text-[0.6875rem] text-center text-gray-900 border-b whitespace-nowrap">{formatDateTime(r.REG_DTTM)}</td>
                          <td className="px-2 py-1.5 text-[0.6875rem] text-center text-gray-900 border-b whitespace-nowrap">{r.RS_FCODE || '-'}</td>
                          <td className="px-2 py-1.5 text-[0.6875rem] text-center border-b whitespace-nowrap">
                            <span className={r.RS_FCODE && r.RS_FCODE.startsWith('0') ? 'text-green-600' : 'text-red-600'}>
                              {r.RS_FCODE || '-'}
                            </span>
                          </td>
                          <td className="px-2 py-1.5 text-[0.6875rem] text-gray-900 border-b whitespace-nowrap">{r.RS_FMSG || '-'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="text-center py-4">
                  <p className="text-xs text-gray-400">전송결과 데이터가 없습니다</p>
                </div>
              )}
            </div>
          )}

          {/* FTTH History */}
          {signalType === 'ftth' && ftthHistories.length > 0 && (
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
              <div className="px-3 py-2.5 border-b border-gray-100">
                <h3 className="text-sm font-bold text-gray-800">
                  전용선 전송이력 <span className="text-blue-500 font-normal">({ftthHistories.length}건)</span>
                </h3>
              </div>
              <div className="overflow-x-auto">
                <div className="max-h-64 overflow-y-auto">
                  <table className="w-full min-w-[850px]">
                    <thead className="bg-gray-50 sticky top-0 z-10">
                      <tr>
                        <th className="px-2 py-2 text-left text-[0.6875rem] font-semibold text-gray-600 border-b whitespace-nowrap">전송ID</th>
                        <th className="px-2 py-2 text-left text-[0.6875rem] font-semibold text-gray-600 border-b whitespace-nowrap">메세지ID</th>
                        <th className="px-2 py-2 text-left text-[0.6875rem] font-semibold text-gray-600 border-b whitespace-nowrap">메세지명</th>
                        <th className="px-2 py-2 text-center text-[0.6875rem] font-semibold text-gray-600 border-b whitespace-nowrap">전송일시</th>
                        <th className="px-2 py-2 text-left text-[0.6875rem] font-semibold text-gray-600 border-b whitespace-nowrap">결과</th>
                        <th className="px-2 py-2 text-center text-[0.6875rem] font-semibold text-gray-600 border-b whitespace-nowrap">수신일시</th>
                        <th className="px-2 py-2 text-center text-[0.6875rem] font-semibold text-gray-600 border-b whitespace-nowrap">AP_MAC</th>
                        <th className="px-2 py-2 text-center text-[0.6875rem] font-semibold text-gray-600 border-b whitespace-nowrap">지점</th>
                      </tr>
                    </thead>
                    <tbody>
                      {ftthHistories.map((item, idx) => (
                        <tr key={`${item.SEQ_API}-${idx}`} className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'}>
                          <td className="px-2 py-1.5 text-[0.6875rem] text-gray-900 border-b whitespace-nowrap">{item.SEQ_API || '-'}</td>
                          <td className="px-2 py-1.5 text-[0.6875rem] text-gray-900 border-b whitespace-nowrap">{item.CMD || '-'}</td>
                          <td className="px-2 py-1.5 text-[0.6875rem] text-gray-900 border-b whitespace-nowrap max-w-[120px] truncate">{item.MSG_TP_DESC || '-'}</td>
                          <td className="px-2 py-1.5 text-[0.6875rem] text-center text-gray-900 border-b whitespace-nowrap">{formatDateTime(item.REQ_DATE)}</td>
                          <td className="px-2 py-1.5 text-[0.6875rem] text-gray-900 border-b whitespace-nowrap max-w-[140px] truncate">{item.RESULT || '-'}</td>
                          <td className="px-2 py-1.5 text-[0.6875rem] text-center text-gray-900 border-b whitespace-nowrap">{formatDateTime(item.RES_DATE)}</td>
                          <td className="px-2 py-1.5 text-[0.6875rem] text-center text-gray-900 border-b whitespace-nowrap">{item.MAC_ADDR || '-'}</td>
                          <td className="px-2 py-1.5 text-[0.6875rem] text-center text-gray-900 border-b whitespace-nowrap">{item.SO_NM || '-'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </>
      ) : !isLoadingHistory && directCtrtId ? null : !isLoadingHistory ? (
        <div className="text-center py-10 bg-white rounded-lg shadow-sm border border-gray-200">
          <p className="text-sm text-gray-400">고객을 검색하거나 계약ID를 입력 후 조회하세요</p>
        </div>
      ) : null}

      {/* Customer Search Modal */}
      <CustomerSearchModal
        isOpen={showSearchModal}
        onClose={() => setShowSearchModal(false)}
        onSelectCustomer={handleCustomerSelected}
      />
    </div>
  );
};

export default SignalIntegration;
