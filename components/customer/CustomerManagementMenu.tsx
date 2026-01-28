import React, { useState } from 'react';
import { ArrowLeft } from 'lucide-react';
import ScrollableTabMenu, { TabItem } from '../layout/ScrollableTabMenu';
import CustomerBasicInfo from './CustomerBasicInfo';
import CustomerInfoChange from './CustomerInfoChange';
import ConsultationAS from './ConsultationAS';
import ElectronicContract from './ElectronicContract';
import CustomerCreate from './CustomerCreate';
import CustomerSearch from './CustomerSearch';
import { CustomerInfo } from '../../services/customerApi';

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

  // 상담/AS 탭의 초기 서브탭 ('consultation' 또는 'as')
  const [consultationInitialTab, setConsultationInitialTab] = useState<'consultation' | 'as'>('consultation');

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

  const tabs: TabItem[] = [
    { id: 'basic-info', title: '기본조회', description: '고객 검색 및 정보 조회' },
    { id: 'info-change', title: '정보변경', description: '전화번호/주소 변경' },
    { id: 'consultation-as', title: '상담/AS', description: '상담이력 및 AS 접수' },
    { id: 'electronic-contract', title: '전자계약', description: '전자계약서 서명/발송' },
    { id: 'customer-create', title: '고객생성', description: '잠재고객 신규 등록' }
  ];

  const handleTabChange = (tabId: string) => {
    setActiveTab(tabId);
  };

  // 고객 선택 핸들러 (CustomerSearch에서 고객 선택 시 호출)
  const handleCustomerSelect = (customer: CustomerInfo) => {
    setSelectedCustomer(customer);
    // 계약 정보 초기화
    setSelectedContract(null);
  };

  // 고객 선택 해제
  const handleCustomerClear = () => {
    setSelectedCustomer(null);
    setSelectedContract(null);
  };

  // 계약 선택 핸들러 (계약현황에서 계약 선택 시 호출)
  const handleContractSelect = (contract: { ctrtId: string; prodNm: string; instAddr: string; postId?: string }) => {
    setSelectedContract(contract);
  };

  // 탭 이동 핸들러 (예: AS 접수 버튼 클릭 시 상담/AS 탭으로 이동)
  const handleNavigateToTab = (tabId: string, subTab?: 'consultation' | 'as') => {
    setActiveTab(tabId);
    // 상담/AS 탭으로 이동 시 서브탭 설정
    if (tabId === 'consultation-as' && subTab) {
      setConsultationInitialTab(subTab);
    }
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
            onNavigateToAS={() => handleNavigateToTab('consultation-as', 'as')}
            onNavigateToConsultation={() => handleNavigateToTab('consultation-as', 'consultation')}
            onNavigateToPaymentChange={handleNavigateToPaymentChange}
            selectedCustomer={selectedCustomer}
            savedContract={selectedContract}
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
      case 'consultation-as':
        return (
          <ConsultationAS
            onBack={onNavigateToMenu}
            showToast={showToast}
            selectedCustomer={selectedCustomer ? {
              custId: selectedCustomer.CUST_ID,
              custNm: selectedCustomer.CUST_NM,
              telNo: selectedCustomer.TEL_NO || selectedCustomer.HP_NO
            } : null}
            selectedContract={selectedContract}
            onNavigateToBasicInfo={() => handleNavigateToTab('basic-info')}
            initialTab={consultationInitialTab}
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
              <ArrowLeft className="w-4 h-4" />
              납부변경
            </button>
          )}
        </div>
      </div>

      {/* 고객 검색 - 고객생성 탭 제외하고 모든 탭에서 표시 */}
      {activeTab !== 'customer-create' && (
        <div className="flex-shrink-0 bg-white border-b border-gray-200 p-3">
          <CustomerSearch
            onCustomerSelect={handleCustomerSelect}
            showToast={showToast}
            selectedCustomer={selectedCustomer}
          />
        </div>
      )}

      {/* 콘텐츠 영역 - flex-1로 남은 공간 채움, 내부 스크롤 */}
      <div className="flex-1 overflow-hidden">
        {renderContent()}
      </div>
    </div>
  );
};

export default CustomerManagementMenu;
