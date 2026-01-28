import React, { useState, useEffect } from 'react';
import {
  User, Phone, MapPin, CreditCard, FileText,
  ChevronDown, ChevronUp, Loader2, AlertCircle,
  Wrench, MessageSquare, Cpu
} from 'lucide-react';
import CustomerSearch from './CustomerSearch';
import ContractSummary from './ContractSummary';
import PaymentInfo from './PaymentInfo';
import {
  CustomerInfo,
  ContractInfo,
  getCustomerDetail,
  getContractList,
  getPaymentInfo,
  getConsultationHistory,
  getWorkHistory,
  formatPhoneNumber,
  formatCurrency,
  ConsultationHistory,
  WorkHistory
} from '../../services/customerApi';

interface CustomerBasicInfoProps {
  onBack: () => void;
  showToast?: (message: string, type: 'success' | 'error' | 'warning' | 'info') => void;
  onCustomerSelect: (customer: { custId: string; custNm: string; telNo: string }) => void;
  onContractSelect: (contract: { ctrtId: string; prodNm: string; instAddr: string; postId?: string }) => void;
  onNavigateToAS: () => void;
  onNavigateToConsultation?: () => void;
  onNavigateToPaymentChange?: (pymAcntId: string) => void;  // 납부정보 변경 탭으로 이동
  // 탭 이동 시 데이터 보존을 위한 초기값
  savedCustomer?: { custId: string; custNm: string; telNo: string } | null;
  savedContract?: { ctrtId: string; prodNm: string; instAddr: string; postId?: string } | null;
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
  onCustomerSelect,
  onContractSelect,
  onNavigateToAS,
  onNavigateToPaymentChange,
  savedCustomer,
  savedContract
}) => {
  // 선택된 고객 (savedCustomer로 초기화하여 탭 이동 시 복원)
  const [selectedCustomer, setSelectedCustomer] = useState<CustomerInfo | null>(() => {
    // 초기값으로 savedCustomer가 있으면 복원
    if (savedCustomer) {
      return {
        CUST_ID: savedCustomer.custId,
        CUST_NM: savedCustomer.custNm,
        TEL_NO: savedCustomer.telNo,
        HP_NO: savedCustomer.telNo,
        CUST_ADDR: '',
        INST_ADDR: '',
        BILL_ADDR: '',
        UNPAY_AMT: 0,
        CUST_TP_CD: '',
        CUST_TP_NM: '',
        REG_DT: ''
      };
    }
    return null;
  });

  // 데이터 상태
  const [contracts, setContracts] = useState<ContractInfo[]>([]);
  const [consultationHistory, setConsultationHistory] = useState<ConsultationHistory[]>([]);
  const [workHistory, setWorkHistory] = useState<WorkHistory[]>([]);

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

  // 도로명주소 표시 여부
  const [showRoadAddr, setShowRoadAddr] = useState(false);

  // 컴포넌트 마운트 시 savedCustomer가 있으면 데이터 로드
  useEffect(() => {
    if (savedCustomer && contracts.length === 0) {
      loadContracts(savedCustomer.custId);
      loadHistory(savedCustomer.custId);
    }
  }, []); // 마운트 시 한 번만 실행

  // 고객 선택 핸들러
  const handleCustomerSelect = async (customer: CustomerInfo) => {
    setSelectedCustomer(customer);
    onCustomerSelect({
      custId: customer.CUST_ID,
      custNm: customer.CUST_NM,
      telNo: customer.TEL_NO || customer.HP_NO
    });

    // 계약 목록 조회
    await loadContracts(customer.CUST_ID);

    // 이력 조회
    await loadHistory(customer.CUST_ID);
  };

  // 계약 목록 로드
  const loadContracts = async (custId: string) => {
    setIsLoadingContracts(true);
    try {
      const response = await getContractList(custId);
      if (response.success && response.data) {
        setContracts(response.data);
      } else {
        setContracts([]);
      }
    } catch (error) {
      console.error('Load contracts error:', error);
      setContracts([]);
    } finally {
      setIsLoadingContracts(false);
    }
  };

  // 이력 로드
  const loadHistory = async (custId: string) => {
    setIsLoadingHistory(true);
    try {
      const [consultRes, workRes] = await Promise.all([
        getConsultationHistory(custId, 10),
        getWorkHistory(custId, 10)
      ]);

      if (consultRes.success && consultRes.data) {
        setConsultationHistory(consultRes.data);
      }
      if (workRes.success && workRes.data) {
        setWorkHistory(workRes.data);
      }
    } catch (error) {
      console.error('Load history error:', error);
    } finally {
      setIsLoadingHistory(false);
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
      postId: contract.POST_ID
    });
  };

  return (
    <div className="h-full overflow-y-auto bg-gray-50">
      <div className="p-4 space-y-4">
        {/* 고객 검색 */}
        <CustomerSearch
          onCustomerSelect={handleCustomerSelect}
          showToast={showToast}
          selectedCustomer={selectedCustomer}
        />

        {/* 고객 선택 후 상세 정보 표시 */}
        {selectedCustomer && (
          <>
            {/* 고객 기본 정보 */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200">
              <button
                onClick={() => toggleSection('customerInfo')}
                className="w-full px-3 py-2.5 flex items-center justify-between text-left"
              >
                <span className="font-medium text-gray-800 text-sm">고객 정보</span>
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
                      <span className="font-medium text-gray-800">{selectedCustomer.CUST_ID}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">고객명</span>
                      <span className="font-medium text-gray-800">{selectedCustomer.CUST_NM}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">전화번호</span>
                      <span className="text-gray-800">{formatPhoneNumber(selectedCustomer.TEL_NO) || '-'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">휴대폰</span>
                      <span className="text-gray-800">{formatPhoneNumber(selectedCustomer.HP_NO) || '-'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">고객구분</span>
                      <span className="text-gray-800">{selectedCustomer.CUST_TP_NM || '-'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">단체번호</span>
                      <span className="text-gray-800">{selectedCustomer.GRP_NO || '-'}</span>
                    </div>
                  </div>

                  {/* 주소 정보 */}
                  <div className="pt-2 border-t border-gray-100 text-sm">
                    <div className="flex items-start">
                      <div className="flex items-center gap-1 w-16 flex-shrink-0">
                        <span className="text-gray-500">고객주소</span>
                        <input
                          type="checkbox"
                          checked={showRoadAddr}
                          onChange={(e) => setShowRoadAddr(e.target.checked)}
                          className="w-3 h-3 text-blue-600 border-gray-300 rounded focus:ring-blue-500 cursor-pointer"
                          title="도로명주소 보기"
                        />
                      </div>
                      <span className="text-gray-700">
                        {showRoadAddr
                          ? (selectedCustomer.ROAD_ADDR || selectedCustomer.INST_ADDR || selectedCustomer.CUST_ADDR || '-')
                          : (selectedCustomer.INST_ADDR || selectedCustomer.CUST_ADDR || '-')
                        }
                      </span>
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
              onASRequest={onNavigateToAS}
              showToast={showToast}
            />

            {/* 납부정보 / 요금내역 */}
            <PaymentInfo
              custId={selectedCustomer.CUST_ID}
              expanded={expandedSections.payment}
              onToggle={() => toggleSection('payment')}
              showToast={showToast}
              onNavigateToPaymentChange={onNavigateToPaymentChange}
            />

            {/* 상담 이력 */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200">
              <button
                onClick={() => toggleSection('consultation')}
                className="w-full px-3 py-2.5 flex items-center justify-between text-left"
              >
                <div className="flex items-center gap-2">
                  <span className="font-medium text-gray-800 text-sm">상담 이력</span>
                  {consultationHistory.length > 0 && (
                    <span className="text-xs text-gray-500">({consultationHistory.length})</span>
                  )}
                </div>
                {expandedSections.consultation ? (
                  <ChevronUp className="w-4 h-4 text-gray-400" />
                ) : (
                  <ChevronDown className="w-4 h-4 text-gray-400" />
                )}
              </button>

              {expandedSections.consultation && (
                <div className="px-3 pb-3">
                  {isLoadingHistory ? (
                    <div className="flex items-center justify-center py-3">
                      <Loader2 className="w-4 h-4 animate-spin text-gray-400" />
                    </div>
                  ) : consultationHistory.length > 0 ? (
                    <div className="space-y-1.5">
                      {consultationHistory.map((item, index) => (
                        <div key={item.CNSL_ID || index} className="p-2 bg-gray-50 rounded text-sm">
                          <div className="flex items-center justify-between">
                            <span className="font-medium text-gray-700">{item.CNSL_CL_NM}</span>
                            <span className="text-xs text-gray-500">{item.RCPT_DT}</span>
                          </div>
                          <div className="text-gray-600 mt-0.5">{item.REQ_CNTN}</div>
                          <div className="flex items-center gap-2 mt-1">
                            <span className={`text-xs px-1.5 py-0.5 rounded ${
                              item.PROC_STAT_NM === '완료' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'
                            }`}>{item.PROC_STAT_NM}</span>
                            <span className="text-xs text-gray-400">{item.RCPT_USR_NM}</span>
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

            {/* 작업 이력 */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200">
              <button
                onClick={() => toggleSection('work')}
                className="w-full px-3 py-2.5 flex items-center justify-between text-left"
              >
                <div className="flex items-center gap-2">
                  <span className="font-medium text-gray-800 text-sm">작업 이력</span>
                  {workHistory.length > 0 && (
                    <span className="text-xs text-gray-500">({workHistory.length})</span>
                  )}
                </div>
                {expandedSections.work ? (
                  <ChevronUp className="w-4 h-4 text-gray-400" />
                ) : (
                  <ChevronDown className="w-4 h-4 text-gray-400" />
                )}
              </button>

              {expandedSections.work && (
                <div className="px-3 pb-3">
                  {isLoadingHistory ? (
                    <div className="flex items-center justify-center py-3">
                      <Loader2 className="w-4 h-4 animate-spin text-gray-400" />
                    </div>
                  ) : workHistory.length > 0 ? (
                    <div className="space-y-1.5">
                      {workHistory.map((item, index) => (
                        <div key={item.WORK_ID || index} className="p-2 bg-gray-50 rounded text-sm">
                          <div className="flex items-center justify-between">
                            <span className="font-medium text-gray-700">{item.WORK_TP_NM}</span>
                            <span className="text-xs text-gray-500">{item.SCHD_DT}</span>
                          </div>
                          <div className="text-gray-600 mt-0.5">{item.PROD_NM}</div>
                          <div className="flex items-center gap-2 mt-1">
                            <span className={`text-xs px-1.5 py-0.5 rounded ${
                              item.WORK_STAT_NM === '완료' ? 'bg-green-100 text-green-700' :
                              item.WORK_STAT_NM === '진행중' ? 'bg-blue-100 text-blue-700' :
                              'bg-gray-100 text-gray-700'
                            }`}>{item.WORK_STAT_NM}</span>
                            <span className="text-xs text-gray-400">{item.WRKR_NM}</span>
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
        )}
      </div>
    </div>
  );
};

export default CustomerBasicInfo;
