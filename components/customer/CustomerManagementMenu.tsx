import React, { useState } from 'react';
import ScrollableTabMenu, { TabItem } from '../layout/ScrollableTabMenu';
import CustomerBasicInfo from './CustomerBasicInfo';
import CustomerInfoChange from './CustomerInfoChange';
import CustomerSearch from './CustomerSearch';
import ConsultationAS from './ConsultationAS';
import ReContractModule from './ReContractModule';
import CustomerCreate from './CustomerCreate';
import { CustomerInfo, ContractInfo, ConsultationHistory, WorkHistory, getContractList } from '../../services/customerApi';

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
 * 5. 고객생성: 재약정 등록
 */
const CustomerManagementMenu: React.FC<CustomerManagementMenuProps> = ({ onNavigateToMenu, showToast }) => {
  const [activeTab, setActiveTab] = useState<string>('basic-info');

  // 선택된 고객 정보 (탭 간 공유) - 전체 CustomerInfo 저장
  const [selectedCustomer, setSelectedCustomer] = useState<CustomerInfo | null>(null);

  // 선택된 계약 정보 (AS 접수, 주소변경 등에서 사용)
  const [selectedContract, setSelectedContract] = useState<{
    ctrtId: string;
    prodNm: string;
    instAddr: string;
    streetAddr?: string;
    instlLoc?: string;
    postId?: string;
    notrecev?: string;
    soId?: string;
    prodGrp?: string;
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

  // 상담/AS 탭의 초기 탭 상태
  const [consultationASInitialTab, setConsultationASInitialTab] = useState<'consultation' | 'as'>('consultation');

  // 재약정 대상 수 계산 (CLOSE_DANGER='Y' + 사용중)
  const reContractCount = cachedContracts.filter(c => {
    const isActive = !['해지', '정지'].some(s => (c.CTRT_STAT_NM || '').includes(s));
    const isCloseDanger = c.CLOSE_DANGER === 'Y';
    const isInUse = (c.CTRT_STAT_NM || '').includes('사용중');
    return isActive && isCloseDanger && isInUse;
  }).length;

  const tabs: TabItem[] = [
    { id: 'basic-info', title: '기본조회', description: '고객 검색 및 정보 조회' },
    { id: 'info-change', title: '정보변경', description: '전화번호/주소 변경' },
    { id: 'consultation-as', title: '상담/AS', description: '상담등록, AS접수' },
    { id: 're-contract', title: '재약정', description: '재약정 등록/일괄처리', badge: reContractCount },
  ];

  const handleTabChange = (tabId: string) => {
    setActiveTab(tabId);
  };

  // 고객 선택 핸들러 (CustomerSearch에서 고객 선택 시 호출)
  const handleCustomerSelect = (customer: CustomerInfo) => {
    // 항상 캐시 초기화 (같은 고객 재선택 시에도 리프레시)
    setCachedContracts([]);
    setCachedConsultationHistory([]);
    setCachedWorkHistory([]);
    setCachedDataCustId('');
    // 고객 변경 시 기본조회 탭으로 이동
    setActiveTab('basic-info');
    // 같은 고객 재선택 시 React 변화 감지를 위해 null 후 재설정
    setSelectedCustomer(null);
    setTimeout(() => {
      setSelectedCustomer(customer);
      setSelectedContract(null);
    }, 0);
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
  const handleContractSelect = (contract: { ctrtId: string; prodNm: string; instAddr: string; streetAddr?: string; instlLoc?: string; postId?: string; notrecev?: string; soId?: string; prodGrp?: string }) => {
    setSelectedContract(contract);
  };

  // 주소/설치위치 변경 후 계약 데이터 리프레시
  const handleAddressChanged = async () => {
    if (!selectedCustomer) return;
    try {
      const res = await getContractList(selectedCustomer.CUST_ID);
      if (res.success && res.data) {
        setCachedContracts(res.data);
        setCachedDataCustId(selectedCustomer.CUST_ID);
        // selectedContract가 있으면 최신 데이터로 갱신
        if (selectedContract) {
          const updated = res.data.find((c: ContractInfo) => c.CTRT_ID === selectedContract.ctrtId);
          if (updated) {
            setSelectedContract({
              ctrtId: updated.CTRT_ID,
              prodNm: updated.PROD_NM,
              instAddr: updated.INST_ADDR,
              streetAddr: updated.STREET_ADDR_FULL,
              instlLoc: updated.INSTL_LOC,
              postId: updated.POST_ID,
              notrecev: updated.NOTRECEV,
              soId: updated.SO_ID,
              prodGrp: updated.PROD_GRP,
            });
          }
        }
      }
    } catch (e) {
      console.error('Failed to refresh contracts after address change:', e);
    }
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
      case 'info-change':
        return (
          <CustomerInfoChange
            onBack={onNavigateToMenu}
            showToast={showToast}
            selectedCustomer={selectedCustomer ? {
              custId: selectedCustomer.CUST_ID,
              custNm: selectedCustomer.CUST_NM,
              telNo: selectedCustomer.TEL_NO || '',
              hpNo: selectedCustomer.HP_NO || '',
              phoneList: selectedCustomer.PHONE_LIST
            } : null}
            selectedContract={selectedContract}
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
            onAddressChanged={handleAddressChanged}
          />
        );
      case 'consultation-as':
        return (
          <ConsultationAS
            onBack={onNavigateToMenu}
            showToast={showToast}
            selectedCustomer={selectedCustomer ? {
              custId: selectedCustomer.CUST_ID,
              custNm: selectedCustomer.CUST_NM,
              telNo: selectedCustomer.TEL_NO || selectedCustomer.HP_NO || ''
            } : null}
            selectedContract={selectedContract}
            contracts={cachedContracts}
            onNavigateToBasicInfo={() => handleNavigateToTab('basic-info')}
            initialTab={consultationASInitialTab}
          />
        );
      case 're-contract':
        return (
          <ReContractModule
            onBack={onNavigateToMenu}
            showToast={showToast}
            selectedCustomer={selectedCustomer ? {
              custId: selectedCustomer.CUST_ID,
              custNm: selectedCustomer.CUST_NM,
              telNo: selectedCustomer.TEL_NO || selectedCustomer.HP_NO || ''
            } : null}
            selectedContract={selectedContract}
            contracts={cachedContracts}
            onNavigateToBasicInfo={() => handleNavigateToTab('basic-info')}
          />
        );
      case 'customer-create':
        return (
          <CustomerCreate
            onBack={onNavigateToMenu}
            showToast={showToast}
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
              납부변경
            </button>
          )}
        </div>
      </div>

      {/* 고객 검색 - 모든 탭에서 표시 */}
      {(
        <div className="flex-shrink-0 bg-white border-b border-gray-200 p-3">
          <CustomerSearch
              onCustomerSelect={handleCustomerSelect}
              onCustomerClear={handleCustomerClear}
              showToast={showToast}
              selectedCustomer={selectedCustomer}
            />
        </div>
      )}

      {/* 콘텐츠 영역 - flex-1로 남은 공간 채움, 내부 스크롤 */}
      <div className="flex-1 overflow-hidden">
        {/* 기본조회 - 항상 마운트 (탭 전환 시 상태 보존) */}
        <div className={`h-full ${activeTab === 'basic-info' ? '' : 'hidden'}`}>
          <CustomerBasicInfo
            onBack={onNavigateToMenu}
            showToast={showToast}
            onContractSelect={handleContractSelect}
            onNavigateToPaymentChange={handleNavigateToPaymentChange}
            onNavigateToConsultationAS={(initialTab) => {
              setConsultationASInitialTab(initialTab);
              setActiveTab('consultation-as');
            }}
            onNavigateToAddressChange={() => {
              setInfoChangeInitialSection('address');
              setActiveTab('info-change');
            }}
            onNavigateToReContract={() => {
              setActiveTab('re-contract');
            }}
            selectedCustomer={selectedCustomer}
            savedContract={selectedContract}
            cachedContracts={cachedContracts}
            cachedConsultationHistory={cachedConsultationHistory}
            cachedWorkHistory={cachedWorkHistory}
            cachedDataCustId={cachedDataCustId}
            onDataLoaded={handleDataLoaded}
            paymentChangeInProgress={paymentChangeInProgress}
            onCancelPaymentChange={() => {
              setPaymentChangeInProgress(false);
              setPaymentFormData(null);
              setPaymentSelectedPymAcntId('');
              setPaymentIsVerified(false);
            }}
            currentWorkingPymAcntId={paymentSelectedPymAcntId}
          />
        </div>
        {/* 나머지 탭은 조건부 렌더링 */}
        {activeTab !== 'basic-info' && renderContent()}
      </div>

    </div>
  );
};

export default CustomerManagementMenu;
