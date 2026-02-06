import React, { useState } from 'react';
import {
  FileText, ChevronDown, ChevronUp, Loader2,
  MapPin, Filter, MessageSquare, Wrench, Home
} from 'lucide-react';
import { ContractInfo, formatCurrency, formatDate } from '../../services/customerApi';

// ID 포맷 (3-3-4 형식)
const formatId = (id: string): string => {
  if (!id) return '-';
  const cleaned = id.replace(/[^0-9]/g, '');
  if (cleaned.length === 10) {
    return `${cleaned.slice(0, 3)}-${cleaned.slice(3, 6)}-${cleaned.slice(6, 10)}`;
  }
  return id;
};

interface ContractSummaryProps {
  contracts: ContractInfo[];
  isLoading: boolean;
  expanded: boolean;
  onToggle: () => void;
  onContractSelect: (contract: ContractInfo) => void;
  showToast?: (message: string, type: 'success' | 'error' | 'warning' | 'info') => void;
  onNavigateToConsultation?: (contract: ContractInfo) => void;  // 상담등록으로 이동
  onNavigateToAS?: (contract: ContractInfo) => void;            // AS접수로 이동
  onNavigateToAddressChange?: (contract: ContractInfo) => void; // 주소변경으로 이동
}

// 계약 상태별 스타일
const getContractStatusStyle = (statCd: string): string => {
  switch (statCd) {
    case '10': // 사용중
    case 'Y':
      return 'bg-green-100 text-green-700';
    case '20': // 일시정지
      return 'bg-yellow-100 text-yellow-700';
    case '30': // 해지
    case 'N':
      return 'bg-gray-100 text-gray-600';
    default:
      return 'bg-blue-100 text-blue-700';
  }
};

/**
 * 계약현황 컴포넌트
 *
 * 회의록 기준:
 * - 계약ID, 계약상태, 상품명, 약정정보, 설치위치, 개통일, 단체정보
 * - 장비정보 - 장비명, 모델명, 시리얼
 * - 이벤트 버튼: AS, 상담, 필터링(계약ID/장비시리얼/계약상태)
 */
const ContractSummary: React.FC<ContractSummaryProps> = ({
  contracts,
  isLoading,
  expanded,
  onToggle,
  onContractSelect,
  showToast,
  onNavigateToConsultation,
  onNavigateToAS,
  onNavigateToAddressChange
}) => {
  // 필터 상태 (기본값: 전체)
  const [filterStatus, setFilterStatus] = useState<'all' | 'active'>('all');
  const [searchKeyword, setSearchKeyword] = useState('');

  // 선택된 계약
  const [selectedContractId, setSelectedContractId] = useState<string | null>(null);

  // 상세 펼침 상태
  const [expandedContractId, setExpandedContractId] = useState<string | null>(null);

  // 해지 여부 판별 (해지된 계약은 상담/AS 버튼 비활성화)
  const isTerminated = (contract: ContractInfo) => {
    const statNm = contract.CTRT_STAT_NM || '';
    const statCd = contract.CTRT_STAT_CD || '';
    // 해지 상태인 경우
    if (statNm.includes('해지')) return true;
    if (['90', '30'].includes(statCd)) return true;
    return false;
  };

  // 사용계약 여부 판별 (해지가 아닌 모든 계약 = 사용계약)
  const isActiveContract = (contract: ContractInfo) => {
    return !isTerminated(contract);
  };

  // 필터링된 계약 목록
  const filteredContracts = contracts.filter(contract => {
    // 상태 필터 (사용계약 선택 시 해지 제외)
    if (filterStatus === 'active' && !isActiveContract(contract)) return false;

    // 키워드 검색 (계약ID, 상품명, 장비시리얼)
    if (searchKeyword) {
      const keyword = searchKeyword.toLowerCase();
      const matchCtrtId = contract.CTRT_ID?.toLowerCase().includes(keyword);
      const matchProdNm = contract.PROD_NM?.toLowerCase().includes(keyword);
      const matchEqtSerno = contract.EQT_SERNO?.toLowerCase().includes(keyword);
      return matchCtrtId || matchProdNm || matchEqtSerno;
    }

    return true;
  });

  // 계약 상태별 카운트
  const statusCount = {
    all: contracts.length,
    active: contracts.filter(c => isActiveContract(c)).length
  };

  // 계약 선택 핸들러
  const handleSelect = (contract: ContractInfo) => {
    setSelectedContractId(contract.CTRT_ID);
    onContractSelect(contract);
  };

  // 상세 토글 + 계약 선택
  const toggleDetail = (contract: ContractInfo) => {
    const ctrtId = contract.CTRT_ID;
    setExpandedContractId(expandedContractId === ctrtId ? null : ctrtId);
    // 계약 선택 시 이력 로드도 함께 수행
    handleSelect(contract);
  };

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200">
      {/* 헤더 */}
      <button
        onClick={onToggle}
        className="w-full p-4 flex items-center justify-between text-left"
      >
        <div className="flex items-center gap-2">
          <FileText className="w-5 h-5 text-purple-500" />
          <span className="font-medium text-gray-800">계약 현황</span>
          <span className="text-sm text-gray-500">({contracts.length}건)</span>
        </div>
        {expanded ? (
          <ChevronUp className="w-5 h-5 text-gray-400" />
        ) : (
          <ChevronDown className="w-5 h-5 text-gray-400" />
        )}
      </button>

      {expanded && (
        <div className="px-4 pb-4">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
            </div>
          ) : contracts.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              계약 정보가 없습니다.
            </div>
          ) : (
            <>
              {/* 필터 영역 */}
              <div className="mb-4 space-y-3">
                {/* 상태 필터 버튼 */}
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => setFilterStatus('all')}
                    className={`px-3 py-1.5 text-sm rounded-full transition-colors ${
                      filterStatus === 'all'
                        ? 'bg-blue-500 text-white'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    전체 ({statusCount.all})
                  </button>
                  <button
                    onClick={() => setFilterStatus('active')}
                    className={`px-3 py-1.5 text-sm rounded-full transition-colors ${
                      filterStatus === 'active'
                        ? 'bg-green-500 text-white'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    사용계약 ({statusCount.active})
                  </button>
                </div>

                {/* 검색 필드 */}
                <div className="relative">
                  <Filter className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="text"
                    value={searchKeyword}
                    onChange={(e) => setSearchKeyword(e.target.value)}
                    placeholder="계약ID, 상품명, 장비번호 검색"
                    className="w-full pl-10 pr-4 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
              </div>

              {/* 계약 목록 */}
              <div className="space-y-3 max-h-96 overflow-y-auto">
                {filteredContracts.map((contract, index) => (
                  <div
                    key={contract.CTRT_ID}
                    className={`p-3 rounded-lg border transition-colors ${
                      selectedContractId === contract.CTRT_ID
                        ? 'bg-blue-50 border-blue-300'
                        : 'bg-gray-50 border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    {/* 계약 기본 정보 */}
                    <div
                      className="cursor-pointer"
                      onClick={() => toggleDetail(contract)}
                    >
                      {/* 1행: 번호 + 상품명 + 상태 + 화살표 */}
                      <div className="flex items-center justify-between mb-1 gap-2">
                        <div className="flex items-center gap-2 min-w-0 flex-1">
                          <div className="flex-shrink-0 w-7 h-7 flex items-center justify-center rounded-full bg-blue-500 text-white text-sm font-bold">
                            {index + 1}
                          </div>
                          <span className="text-sm text-gray-600 truncate">{contract.PROD_NM}</span>
                        </div>
                        <div className="flex items-center gap-1 flex-shrink-0">
                          <span className={`text-xs px-2 py-0.5 rounded whitespace-nowrap ${getContractStatusStyle(contract.CTRT_STAT_CD)}`}>
                            {contract.CTRT_STAT_NM || (contract.CTRT_STAT_CD === '90' ? '해지' : contract.CTRT_STAT_CD === '20' ? '사용중' : '기타')}
                          </span>
                          <ChevronDown
                            className={`w-4 h-4 text-gray-400 transition-transform flex-shrink-0 ${
                              expandedContractId === contract.CTRT_ID ? 'rotate-180' : ''
                            }`}
                          />
                        </div>
                      </div>

                      {/* 2행: 계약 ID + 설치위치 + 지점 */}
                      <div className="flex items-center justify-between mb-1 ml-9">
                        <span className="text-sm text-gray-600">계약 ID: {formatId(contract.CTRT_ID)}</span>
                        <div className="flex items-center gap-1">
                          <span className="text-xs px-2 py-0.5 bg-indigo-50 text-indigo-600 rounded">
                            {contract.INSTL_LOC || 'N/A'}
                          </span>
                          {contract.SO_NM && (
                            <span className="text-xs px-1.5 py-0.5 bg-purple-50 text-purple-600 rounded">
                              {contract.SO_NM}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* 주소 표시 - 도로명 주소 우선 */}
                      {(contract.STREET_ADDR_FULL || contract.ADDR_FULL || contract.INST_ADDR) && (
                        <div className="flex items-start gap-1 text-sm text-gray-600 mt-1">
                          <MapPin className="w-4 h-4 flex-shrink-0 mt-0.5" />
                          <div className="min-w-0">
                            {contract.STREET_ADDR_FULL ? (
                              <>
                                <span className="text-xs text-blue-600 mr-1">[도로명]</span>
                                <span>{contract.STREET_ADDR_FULL}</span>
                              </>
                            ) : (
                              <span>{contract.ADDR_FULL || contract.INST_ADDR}</span>
                            )}
                          </div>
                        </div>
                      )}
                    </div>

                    {/* 계약 상세 정보 (펼침 시) */}
                    {expandedContractId === contract.CTRT_ID && (
                      <div className="mt-3 pt-3 border-t border-gray-200 space-y-2">
                        {/* 약정 정보 */}
                        <div className="text-sm text-gray-600">
                          약정: {contract.AGMT_MON
                            ? `${contract.AGMT_MON}개월 (${formatDate(contract.CTRT_APLY_STRT_DT) || '-'} ~ ${formatDate(contract.CTRT_APLY_END_DT) || '-'})`
                            : '-'
                          }
                        </div>

                        {/* 개통일 */}
                        <div className="text-sm text-gray-600">
                          개통일: {contract.OPNG_DT ? formatDate(contract.OPNG_DT) : '-'}
                        </div>

                        {/* 장비 (NOTRECEV) */}
                        <div className="text-sm text-gray-600">
                          장비: {contract.NOTRECEV || '-'}
                        </div>

                        {/* 단체 정보 */}
                        {contract.GRP_NO && (
                          <div className="text-sm text-gray-600">
                            단체번호: {contract.GRP_NO}
                          </div>
                        )}

                        {/* 상담/AS/주소변경 버튼 - 사용계약만 (해지 제외) */}
                        {isActiveContract(contract) && (
                          <div className="flex gap-2 mt-3 pt-3 border-t border-gray-200">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleSelect(contract);
                                if (onNavigateToConsultation) {
                                  onNavigateToConsultation(contract);
                                }
                              }}
                              className="flex-1 flex items-center justify-center gap-1 px-2 py-2 bg-blue-500 hover:bg-blue-600 text-white text-xs font-medium rounded-lg transition-colors"
                            >
                              <MessageSquare className="w-3.5 h-3.5" />
                              상담
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleSelect(contract);
                                if (onNavigateToAS) {
                                  onNavigateToAS(contract);
                                }
                              }}
                              className="flex-1 flex items-center justify-center gap-1 px-2 py-2 bg-orange-500 hover:bg-orange-600 text-white text-xs font-medium rounded-lg transition-colors"
                            >
                              <Wrench className="w-3.5 h-3.5" />
                              AS
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleSelect(contract);
                                if (onNavigateToAddressChange) {
                                  onNavigateToAddressChange(contract);
                                }
                              }}
                              className="flex-1 flex items-center justify-center gap-1 px-2 py-2 bg-green-500 hover:bg-green-600 text-white text-xs font-medium rounded-lg transition-colors"
                            >
                              <Home className="w-3.5 h-3.5" />
                              주소변경
                            </button>
                          </div>
                        )}

                      </div>
                    )}
                  </div>
                ))}

                {filteredContracts.length === 0 && (
                  <div className="text-center py-4 text-gray-500 text-sm">
                    조건에 맞는 계약이 없습니다.
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
};

export default ContractSummary;
