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
  onContractSelect: (contract: { ctrtId: string; prodNm: string; instAddr: string }) => void;
  onNavigateToAS: () => void;
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
  onNavigateToAS
}) => {
  // 선택된 고객
  const [selectedCustomer, setSelectedCustomer] = useState<CustomerInfo | null>(null);

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
      instAddr: contract.INST_ADDR
    });
    showToast?.(`${contract.PROD_NM} 계약이 선택되었습니다.`, 'success');
  };

  return (
    <div className="h-full overflow-y-auto bg-gray-50">
      <div className="p-4 space-y-4">
        {/* 고객 검색 */}
        <CustomerSearch
          onCustomerSelect={handleCustomerSelect}
          showToast={showToast}
        />

        {/* 고객 선택 후 상세 정보 표시 */}
        {selectedCustomer && (
          <>
            {/* 고객 기본 정보 */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200">
              <button
                onClick={() => toggleSection('customerInfo')}
                className="w-full p-4 flex items-center justify-between text-left"
              >
                <div className="flex items-center gap-2">
                  <User className="w-5 h-5 text-blue-500" />
                  <span className="font-medium text-gray-800">고객 정보</span>
                </div>
                {expandedSections.customerInfo ? (
                  <ChevronUp className="w-5 h-5 text-gray-400" />
                ) : (
                  <ChevronDown className="w-5 h-5 text-gray-400" />
                )}
              </button>

              {expandedSections.customerInfo && (
                <div className="px-4 pb-4 space-y-3">
                  {/* 기본 정보 그리드 */}
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs text-gray-500">고객명</label>
                      <div className="font-medium text-gray-800">{selectedCustomer.CUST_NM}</div>
                    </div>
                    <div>
                      <label className="text-xs text-gray-500">고객ID</label>
                      <div className="font-medium text-gray-800">{selectedCustomer.CUST_ID}</div>
                    </div>
                    <div>
                      <label className="text-xs text-gray-500">전화번호</label>
                      <div className="font-medium text-gray-800">
                        {formatPhoneNumber(selectedCustomer.TEL_NO)}
                      </div>
                    </div>
                    <div>
                      <label className="text-xs text-gray-500">휴대폰</label>
                      <div className="font-medium text-gray-800">
                        {formatPhoneNumber(selectedCustomer.HP_NO)}
                      </div>
                    </div>
                  </div>

                  {/* 주소 정보 */}
                  <div className="space-y-2 pt-2 border-t border-gray-100">
                    <div className="flex items-start gap-2">
                      <MapPin className="w-4 h-4 text-gray-400 mt-0.5" />
                      <div className="flex-1">
                        <label className="text-xs text-gray-500">설치주소</label>
                        <div className="text-sm text-gray-700">{selectedCustomer.INST_ADDR || '-'}</div>
                      </div>
                    </div>
                    <div className="flex items-start gap-2">
                      <MapPin className="w-4 h-4 text-gray-400 mt-0.5" />
                      <div className="flex-1">
                        <label className="text-xs text-gray-500">고객주소</label>
                        <div className="text-sm text-gray-700">{selectedCustomer.CUST_ADDR || '-'}</div>
                      </div>
                    </div>
                    <div className="flex items-start gap-2">
                      <MapPin className="w-4 h-4 text-gray-400 mt-0.5" />
                      <div className="flex-1">
                        <label className="text-xs text-gray-500">청구지주소</label>
                        <div className="text-sm text-gray-700">{selectedCustomer.BILL_ADDR || '-'}</div>
                      </div>
                    </div>
                  </div>

                  {/* 미납금액 */}
                  {selectedCustomer.UNPAY_AMT > 0 && (
                    <div className="p-3 bg-red-50 rounded-lg border border-red-200">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <AlertCircle className="w-5 h-5 text-red-500" />
                          <span className="text-red-700 font-medium">미납금액</span>
                        </div>
                        <span className="text-red-600 font-bold text-lg">
                          {formatCurrency(selectedCustomer.UNPAY_AMT)}원
                        </span>
                      </div>
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
            />

            {/* 상담 이력 */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200">
              <button
                onClick={() => toggleSection('consultation')}
                className="w-full p-4 flex items-center justify-between text-left"
              >
                <div className="flex items-center gap-2">
                  <MessageSquare className="w-5 h-5 text-green-500" />
                  <span className="font-medium text-gray-800">상담 이력</span>
                  {consultationHistory.length > 0 && (
                    <span className="text-sm text-gray-500">({consultationHistory.length}건)</span>
                  )}
                </div>
                {expandedSections.consultation ? (
                  <ChevronUp className="w-5 h-5 text-gray-400" />
                ) : (
                  <ChevronDown className="w-5 h-5 text-gray-400" />
                )}
              </button>

              {expandedSections.consultation && (
                <div className="px-4 pb-4">
                  {isLoadingHistory ? (
                    <div className="flex items-center justify-center py-4">
                      <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
                    </div>
                  ) : consultationHistory.length > 0 ? (
                    <div className="space-y-2">
                      {consultationHistory.map((item, index) => (
                        <div key={item.CNSL_ID || index} className="p-3 bg-gray-50 rounded-lg">
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-sm font-medium text-gray-700">{item.CNSL_CL_NM}</span>
                            <span className="text-xs text-gray-500">{item.RCPT_DT}</span>
                          </div>
                          <div className="text-sm text-gray-600">{item.REQ_CNTN}</div>
                          {item.RSP_CNTN && (
                            <div className="text-sm text-gray-500 mt-1">→ {item.RSP_CNTN}</div>
                          )}
                          <div className="flex items-center gap-2 mt-2">
                            <span className={`text-xs px-2 py-0.5 rounded ${
                              item.PROC_STAT_NM === '완료' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'
                            }`}>
                              {item.PROC_STAT_NM}
                            </span>
                            <span className="text-xs text-gray-400">접수: {item.RCPT_USR_NM}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-4 text-gray-500 text-sm">
                      상담 이력이 없습니다.
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* 작업 이력 */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200">
              <button
                onClick={() => toggleSection('work')}
                className="w-full p-4 flex items-center justify-between text-left"
              >
                <div className="flex items-center gap-2">
                  <Wrench className="w-5 h-5 text-orange-500" />
                  <span className="font-medium text-gray-800">작업 이력</span>
                  {workHistory.length > 0 && (
                    <span className="text-sm text-gray-500">({workHistory.length}건)</span>
                  )}
                </div>
                {expandedSections.work ? (
                  <ChevronUp className="w-5 h-5 text-gray-400" />
                ) : (
                  <ChevronDown className="w-5 h-5 text-gray-400" />
                )}
              </button>

              {expandedSections.work && (
                <div className="px-4 pb-4">
                  {isLoadingHistory ? (
                    <div className="flex items-center justify-center py-4">
                      <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
                    </div>
                  ) : workHistory.length > 0 ? (
                    <div className="space-y-2">
                      {workHistory.map((item, index) => (
                        <div key={item.WORK_ID || index} className="p-3 bg-gray-50 rounded-lg">
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-sm font-medium text-gray-700">{item.WORK_TP_NM}</span>
                            <span className="text-xs text-gray-500">{item.SCHD_DT}</span>
                          </div>
                          <div className="text-sm text-gray-600">{item.PROD_NM}</div>
                          {item.WORK_DRCTN && (
                            <div className="text-sm text-gray-500 mt-1">{item.WORK_DRCTN}</div>
                          )}
                          <div className="flex items-center gap-2 mt-2">
                            <span className={`text-xs px-2 py-0.5 rounded ${
                              item.WORK_STAT_NM === '완료' ? 'bg-green-100 text-green-700' :
                              item.WORK_STAT_NM === '진행중' ? 'bg-blue-100 text-blue-700' :
                              'bg-gray-100 text-gray-700'
                            }`}>
                              {item.WORK_STAT_NM}
                            </span>
                            <span className="text-xs text-gray-400">{item.WRKR_NM}</span>
                            {item.CMPL_DT && (
                              <span className="text-xs text-gray-400">완료: {item.CMPL_DT}</span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-4 text-gray-500 text-sm">
                      작업 이력이 없습니다.
                    </div>
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
