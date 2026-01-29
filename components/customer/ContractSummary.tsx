import React, { useState } from 'react';
import {
  FileText, ChevronDown, ChevronUp, Loader2,
  Cpu, Calendar, MapPin, Filter
} from 'lucide-react';
import { ContractInfo, formatCurrency, formatDate } from '../../services/customerApi';

interface ContractSummaryProps {
  contracts: ContractInfo[];
  isLoading: boolean;
  expanded: boolean;
  onToggle: () => void;
  onContractSelect: (contract: ContractInfo) => void;
  showToast?: (message: string, type: 'success' | 'error' | 'warning' | 'info') => void;
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
  showToast
}) => {
  // 필터 상태
  const [filterStatus, setFilterStatus] = useState<'all' | 'active' | 'terminated'>('all');
  const [searchKeyword, setSearchKeyword] = useState('');

  // 선택된 계약
  const [selectedContractId, setSelectedContractId] = useState<string | null>(null);

  // 상세 펼침 상태
  const [expandedContractId, setExpandedContractId] = useState<string | null>(null);

  // 필터링된 계약 목록
  const filteredContracts = contracts.filter(contract => {
    // 상태 필터
    if (filterStatus === 'active' && contract.CTRT_STAT_CD === '30') return false;
    if (filterStatus === 'terminated' && contract.CTRT_STAT_CD !== '30') return false;

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
    active: contracts.filter(c => c.CTRT_STAT_CD !== '30').length,
    terminated: contracts.filter(c => c.CTRT_STAT_CD === '30').length
  };

  // 계약 선택 핸들러
  const handleSelect = (contract: ContractInfo) => {
    setSelectedContractId(contract.CTRT_ID);
    onContractSelect(contract);
  };

  // 상세 토글
  const toggleDetail = (ctrtId: string) => {
    setExpandedContractId(expandedContractId === ctrtId ? null : ctrtId);
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
                    사용중 ({statusCount.active})
                  </button>
                  <button
                    onClick={() => setFilterStatus('terminated')}
                    className={`px-3 py-1.5 text-sm rounded-full transition-colors ${
                      filterStatus === 'terminated'
                        ? 'bg-gray-500 text-white'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    해지 ({statusCount.terminated})
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
                      onClick={() => toggleDetail(contract.CTRT_ID)}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <div className="flex-shrink-0 w-7 h-7 flex items-center justify-center rounded-full bg-blue-500 text-white text-sm font-bold">
                            {index + 1}
                          </div>
                          <span className="text-sm text-gray-600">{contract.PROD_NM}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className={`text-xs px-2 py-0.5 rounded ${getContractStatusStyle(contract.CTRT_STAT_CD)}`}>
                            {contract.CTRT_STAT_NM || (contract.CTRT_STAT_CD === '90' ? '해지' : contract.CTRT_STAT_CD === '20' ? '사용중' : '기타')}
                          </span>
                          <ChevronDown
                            className={`w-4 h-4 text-gray-400 transition-transform ${
                              expandedContractId === contract.CTRT_ID ? 'rotate-180' : ''
                            }`}
                          />
                        </div>
                      </div>

                      <div className="flex items-center justify-between text-sm text-gray-600">
                        <span>계약ID: {contract.CTRT_ID}</span>
                        {contract.INSTL_LOC && (
                          <span className="text-xs px-2 py-0.5 bg-indigo-50 text-indigo-600 rounded mr-6">
                            {contract.INSTL_LOC}
                          </span>
                        )}
                      </div>

                      {contract.INST_ADDR && (
                        <div className="flex items-center gap-1 text-sm text-gray-600 mt-1">
                          <MapPin className="w-4 h-4" />
                          <span className="truncate">{contract.INST_ADDR}</span>
                        </div>
                      )}
                    </div>

                    {/* 계약 상세 정보 (펼침 시) */}
                    {expandedContractId === contract.CTRT_ID && (
                      <div className="mt-3 pt-3 border-t border-gray-200 space-y-2">
                        {/* 약정 정보 */}
                        {contract.AGMT_MON && (
                          <div className="flex items-center gap-2 text-sm">
                            <Calendar className="w-4 h-4 text-gray-400" />
                            <span className="text-gray-600">
                              약정 {contract.AGMT_MON}개월
                              ({formatDate(contract.AGMT_ST_DT)} ~ {formatDate(contract.AGMT_END_DT)})
                            </span>
                          </div>
                        )}

                        {/* 개통일 */}
                        {contract.OPNG_DT && (
                          <div className="flex items-center gap-2 text-sm">
                            <Calendar className="w-4 h-4 text-gray-400" />
                            <span className="text-gray-600">개통일: {formatDate(contract.OPNG_DT)}</span>
                          </div>
                        )}

                        {/* 장비 정보 */}
                        {contract.EQT_SERNO && (
                          <div className="flex items-center gap-2 text-sm">
                            <Cpu className="w-4 h-4 text-gray-400" />
                            <span className="text-gray-600">
                              {contract.EQT_NM} ({contract.EQT_MDL_NM})
                              <br />
                              <span className="text-xs text-gray-500">S/N: {contract.EQT_SERNO}</span>
                            </span>
                          </div>
                        )}

                        {/* 요금 정보 */}
                        <div className="flex items-center gap-4 text-sm">
                          <div>
                            <span className="text-gray-500">전월: </span>
                            <span className="font-medium">{formatCurrency(contract.PREV_MON_AMT || 0)}원</span>
                          </div>
                          <div>
                            <span className="text-gray-500">당월: </span>
                            <span className="font-medium">{formatCurrency(contract.CUR_MON_AMT || 0)}원</span>
                          </div>
                        </div>

                        {/* 단체 정보 */}
                        {contract.GRP_NO && (
                          <div className="text-sm text-gray-600">
                            단체번호: {contract.GRP_NO}
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
