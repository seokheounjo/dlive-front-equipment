import React, { useState } from 'react';
import { AlertCircle } from 'lucide-react';
import ScrollableTabMenu, { TabItem } from '../layout/ScrollableTabMenu';
import CustomerBasicInfo from './CustomerBasicInfo';
import CustomerInfoChange from './CustomerInfoChange';
import ElectronicContract from './ElectronicContract';
import CustomerSearch from './CustomerSearch';
import { CustomerInfo, ContractInfo, ConsultationHistory, WorkHistory } from '../../services/customerApi';

interface CustomerManagementMenuProps {
  onNavigateToMenu: () => void;
  showToast?: (message: string, type: 'success' | 'error' | 'warning' | 'info') => void;
}

/**
 * 고객관리 메뉴 (TO-BE 메뉴구조도 기준)
 *
 * 1. 기본조회: 고객 검색 및 정보 조회 (계약현황, 납부정보, 요금내역)
 * 2. 정보변경: 전화번호/주소 변경 (설치주소, 고객주소, 청구지주소)
 * 3. 상담/AS: 상담이력 조회/등록 및 AS 접수
 * 4. 전자계약: 전자계약서 서명/발송 (모두싸인 API 연동)
 * 5. 고객생성: 잠재고객 신규 등록
 */
const CustomerManagementMenu: React.FC<CustomerManagementMenuProps> = ({ onNavigateToMenu, showToast }) => {
  const [activeTab, setActiveTab] = useState<string>('basic-info');

  // 선택된 고객 정보 (탭 간 공유) - 전체 CustomerInfo 저장
  const [selectedCustomer, setSelectedCustomer] = useState<CustomerInfo | null>(null);

  // 선택된 계약 정보 (AS 접수 등에서 사용)
  const [selectedContract, setSelectedContract] = useState<{
    ctrtId: string;
    prodNm: string;
    instAddr: string;
    postId?: string;
  } | null>(null);

  // 정보변경 탭의 초기 섹션 및 납부계정 ID
  const [infoChangeInitialSection, setInfoChangeInitialSection] = useState<'phone' | 'address' | 'payment' | 'hpPay'>('phone');
  const [infoChangeInitialPymAcntId, setInfoChangeInitialPymAcntId] = useState<string>('');

  // 납부방법 변경 작업 중 상태 (탭 이동 후 돌아가기 위함)
  const [paymentChangeInProgress, setPaymentChangeInProgress] = useState(false);

  // 납부방법 변경 폼 상태 (탭 전환 시 유지)
  const [paymentFormData, setPaymentFormData] = useState<{
    pymMthCd: string;
    changeReasonL: string;
    changeReasonM: string;
    acntHolderNm: string;
    idType: string;
    birthDt: string;
    bankCd: string;
    acntNo: string;
    cardExpMm: string;
    cardExpYy: string;
    joinCardYn: string;
    pyrRel: string;
    pymDay: string;
    billZipCd: string;
    billAddr: string;
    billAddrJibun: string;
    billAddrDtl: string;
    billAddrDtl2: string;
    billPostId: string;
  } | null>(null);
  const [paymentSelectedPymAcntId, setPaymentSelectedPymAcntId] = useState<string>('');
  const [paymentIsVerified, setPaymentIsVerified] = useState(false);

  // 기본조회 데이터 캐싱 (탭 전환 시 재로드 방지)
  const [cachedContracts, setCachedContracts] = useState<ContractInfo[]>([]);
  const [cachedConsultationHistory, setCachedConsultationHistory] = useState<ConsultationHistory[]>([]);
  const [cachedWorkHistory, setCachedWorkHistory] = useState<WorkHistory[]>([]);
  const [cachedDataCustId, setCachedDataCustId] = useState<string>('');  // 어떤 고객의 데이터인지 추적

  // 탭 전환 확인 모달 (정보변경 작성 중일 때)
  const [showTabSwitchConfirm, setShowTabSwitchConfirm] = useState(false);
  const [pendingTabId, setPendingTabId] = useState<string>('');

  // 납부폼이 수정되었는지 확인
  const isPaymentFormDirty = (): boolean => {
    if (!paymentFormData) return false;
    return paymentFormData.acntHolderNm !== '' ||
           paymentFormData.birthDt !== '' ||
           paymentFormData.bankCd !== '' ||
           paymentFormData.acntNo !== '' ||
           paymentFormData.changeReasonL !== '' ||
           paymentIsVerified;
  };

  const tabs: TabItem[] = [
    { id: 'basic-info', title: '기본조회', description: '고객 검색 및 정보 조회' },
    { id: 'info-change', title: '정보변경', description: '전화번호/주소 변경' },
    { id: 'electronic-contract', title: '전자계약', description: '전자계약서 서명/발송' }
  ];

  const handleTabChange = (tabId: string) => {
    // 정보변경 탭에서 다른 탭으로 이동 시 작성 중인 내용 확인
    if (activeTab === 'info-change' && tabId !== 'info-change' && isPaymentFormDirty()) {
      setPendingTabId(tabId);
      setShowTabSwitchConfirm(true);
      return;
    }
    setActiveTab(tabId);
  };

  // 탭 전환 확인 후 실행
  const confirmTabSwitch = () => {
    // 폼 데이터 초기화
    setPaymentFormData(null);
    setPaymentSelectedPymAcntId('');
    setPaymentIsVerified(false);
    setPaymentChangeInProgress(false);
    // 탭 전환
    setActiveTab(pendingTabId);
    setShowTabSwitchConfirm(false);
    setPendingTabId('');
  };

  // 고객 선택 핸들러 (CustomerSearch에서 고객 선택 시 호출)
  const handleCustomerSelect = (customer: CustomerInfo) => {
    // 새로운 고객 선택 시 캐시된 데이터 초기화
    if (customer.CUST_ID !== cachedDataCustId) {
      setCachedContracts([]);
      setCachedConsultationHistory([]);
      setCachedWorkHistory([]);
      setCachedDataCustId('');
    }
    setSelectedCustomer(customer);
    // 계약 정보 초기화
    setSelectedContract(null);
  };

  // 고객 선택 해제
  const handleCustomerClear = () => {
    setSelectedCustomer(null);
    setSelectedContract(null);
    // 캐시 데이터도 초기화
    setCachedContracts([]);
    setCachedConsultationHistory([]);
    setCachedWorkHistory([]);
    setCachedDataCustId('');
  };

  // 기본조회 데이터 로드 완료 핸들러 (캐싱용)
  const handleDataLoaded = (
    custId: string,
    contracts: ContractInfo[],
    consultationHistory: ConsultationHistory[],
    workHistory: WorkHistory[]
  ) => {
    setCachedDataCustId(custId);
    setCachedContracts(contracts);
    setCachedConsultationHistory(consultationHistory);
    setCachedWorkHistory(workHistory);
  };

  // 계약 선택 핸들러 (계약현황에서 계약 선택 시 호출)
  const handleContractSelect = (contract: { ctrtId: string; prodNm: string; instAddr: string; postId?: string }) => {
    setSelectedContract(contract);
  };

  // 탭 이동 핸들러
  const handleNavigateToTab = (tabId: string) => {
    setActiveTab(tabId);
  };

  // 납부정보 변경으로 이동 핸들러
  const handleNavigateToPaymentChange = (pymAcntId: string) => {
    setInfoChangeInitialSection('payment');
    setInfoChangeInitialPymAcntId(pymAcntId);
    setActiveTab('info-change');
  };

  const renderContent = () => {
    switch (activeTab) {
      case 'basic-info':
        return (
          <CustomerBasicInfo
            onBack={onNavigateToMenu}
            showToast={showToast}
            onContractSelect={handleContractSelect}
            onNavigateToPaymentChange={handleNavigateToPaymentChange}
            selectedCustomer={selectedCustomer}
            savedContract={selectedContract}
            cachedContracts={cachedContracts}
            cachedConsultationHistory={cachedConsultationHistory}
            cachedWorkHistory={cachedWorkHistory}
            cachedDataCustId={cachedDataCustId}
            onDataLoaded={handleDataLoaded}
          />
        );
      case 'info-change':
        return (
          <CustomerInfoChange
            onBack={onNavigateToMenu}
            showToast={showToast}
            selectedCustomer={selectedCustomer ? {
              custId: selectedCustomer.CUST_ID,
              custNm: selectedCustomer.CUST_NM,
              telNo: selectedCustomer.TEL_NO || selectedCustomer.HP_NO
            } : null}
            initialSection={infoChangeInitialSection}
            initialPymAcntId={infoChangeInitialPymAcntId}
            onPaymentChangeStart={() => setPaymentChangeInProgress(true)}
            onPaymentChangeEnd={() => {
              setPaymentChangeInProgress(false);
              setPaymentFormData(null);
              setPaymentSelectedPymAcntId('');
              setPaymentIsVerified(false);
            }}
            savedPaymentForm={paymentFormData}
            savedPymAcntId={paymentSelectedPymAcntId}
            savedIsVerified={paymentIsVerified}
            onPaymentFormChange={(form, pymAcntId, isVerified) => {
              setPaymentFormData(form);
              setPaymentSelectedPymAcntId(pymAcntId);
              setPaymentIsVerified(isVerified);
            }}
          />
        );
      case 'electronic-contract':
        return (
          <ElectronicContract
            onBack={onNavigateToMenu}
            showToast={showToast}
            selectedCustomer={selectedCustomer ? {
              custId: selectedCustomer.CUST_ID,
              custNm: selectedCustomer.CUST_NM,
              telNo: selectedCustomer.TEL_NO || selectedCustomer.HP_NO
            } : null}
            selectedContract={selectedContract}
            onNavigateToBasicInfo={() => handleNavigateToTab('basic-info')}
          />
        );
      default:
        return null;
    }
  };

  return (
    <div className="h-[calc(100vh-64px)] flex flex-col bg-gray-50 overflow-hidden">
      {/* 탭 메뉴 - 장비관리와 동일한 패턴 */}
      <div className="flex-shrink-0 bg-white border-b border-gray-200 z-40">
        <div className="flex items-center">
          <div className="flex-1">
            <ScrollableTabMenu
              tabs={tabs}
              activeTab={activeTab}
              onTabChange={handleTabChange}
            />
          </div>
          {/* 납부방법 변경 작업 중일 때 돌아가기 버튼 */}
          {paymentChangeInProgress && activeTab !== 'info-change' && (
            <button
              onClick={() => {
                setInfoChangeInitialSection('payment');
                setActiveTab('info-change');
              }}
              className="flex-shrink-0 mr-2 px-3 py-1.5 text-sm bg-orange-500 text-white rounded-lg hover:bg-orange-600 flex items-center gap-1"
            >
              <ArrowLeft className="w-4 h-4" />
              납부변경
            </button>
          )}
        </div>
      </div>

      {/* 고객 검색 - 고객생성 탭 제외하고 모든 탭에서 표시 */}
      {/* 고객 검색 - 모든 탭에서 표시 */}
      <div className="flex-shrink-0 bg-white border-b border-gray-200 p-3">
        <CustomerSearch
            onCustomerSelect={handleCustomerSelect}
            showToast={showToast}
            selectedCustomer={selectedCustomer}
          />
      </div>

      {/* 콘텐츠 영역 - flex-1로 남은 공간 채움, 내부 스크롤 */}
      <div className="flex-1 overflow-hidden">
        {renderContent()}
      </div>

      {/* 탭 전환 확인 모달 */}
      {showTabSwitchConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm overflow-hidden">
            <div className="p-4 border-b border-gray-100 bg-gradient-to-r from-yellow-500 to-orange-500">
              <h3 className="font-semibold text-white flex items-center gap-2">
                <AlertCircle className="w-5 h-5" />
                작성 내용 확인
              </h3>
            </div>
            <div className="p-4">
              <p className="text-gray-700 text-sm">
                현재 작성 중인 납부정보 변경 내용이 있습니다.<br />
                다른 탭으로 이동하시면 작성 내용이 초기화됩니다.
              </p>
              <p className="text-gray-500 text-xs mt-2">
                계속하시겠습니까?
              </p>
            </div>
            <div className="p-4 bg-gray-50 flex gap-2">
              <button
                onClick={() => {
                  setShowTabSwitchConfirm(false);
                  setPendingTabId('');
                }}
                className="flex-1 py-2.5 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors text-sm font-medium"
              >
                취소
              </button>
              <button
                onClick={confirmTabSwitch}
                className="flex-1 py-2.5 bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition-colors text-sm font-medium"
              >
                계속하기
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CustomerManagementMenu;
