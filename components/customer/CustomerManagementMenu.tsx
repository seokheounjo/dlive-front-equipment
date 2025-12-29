import React, { useState } from 'react';
import ScrollableTabMenu, { TabItem } from '../layout/ScrollableTabMenu';
import CustomerBasicInfo from './CustomerBasicInfo';
import CustomerInfoChange from './CustomerInfoChange';
import ConsultationAS from './ConsultationAS';
import ElectronicContract from './ElectronicContract';
import CustomerCreate from './CustomerCreate';

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

  // 선택된 고객 정보 (탭 간 공유)
  const [selectedCustomer, setSelectedCustomer] = useState<{
    custId: string;
    custNm: string;
    telNo: string;
  } | null>(null);

  // 선택된 계약 정보 (AS 접수 등에서 사용)
  const [selectedContract, setSelectedContract] = useState<{
    ctrtId: string;
    prodNm: string;
    instAddr: string;
  } | null>(null);

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

  // 고객 선택 핸들러 (기본조회에서 고객 선택 시 호출)
  const handleCustomerSelect = (customer: { custId: string; custNm: string; telNo: string }) => {
    setSelectedCustomer(customer);
    // 계약 정보 초기화
    setSelectedContract(null);
  };

  // 계약 선택 핸들러 (계약현황에서 계약 선택 시 호출)
  const handleContractSelect = (contract: { ctrtId: string; prodNm: string; instAddr: string }) => {
    setSelectedContract(contract);
  };

  // 탭 이동 핸들러 (예: AS 접수 버튼 클릭 시 상담/AS 탭으로 이동)
  const handleNavigateToTab = (tabId: string) => {
    setActiveTab(tabId);
  };

  const renderContent = () => {
    switch (activeTab) {
      case 'basic-info':
        return (
          <CustomerBasicInfo
            onBack={onNavigateToMenu}
            showToast={showToast}
            onCustomerSelect={handleCustomerSelect}
            onContractSelect={handleContractSelect}
            onNavigateToAS={() => handleNavigateToTab('consultation-as')}
          />
        );
      case 'info-change':
        return (
          <CustomerInfoChange
            onBack={onNavigateToMenu}
            showToast={showToast}
            selectedCustomer={selectedCustomer}
          />
        );
      case 'consultation-as':
        return (
          <ConsultationAS
            onBack={onNavigateToMenu}
            showToast={showToast}
            selectedCustomer={selectedCustomer}
            selectedContract={selectedContract}
            onNavigateToBasicInfo={() => handleNavigateToTab('basic-info')}
          />
        );
      case 'electronic-contract':
        return (
          <ElectronicContract
            onBack={onNavigateToMenu}
            showToast={showToast}
            selectedCustomer={selectedCustomer}
            selectedContract={selectedContract}
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
        <ScrollableTabMenu
          tabs={tabs}
          activeTab={activeTab}
          onTabChange={handleTabChange}
        />
      </div>

      {/* 선택된 고객 정보 표시 바 (고객 선택 시에만) */}
      {selectedCustomer && activeTab !== 'customer-create' && (
        <div className="flex-shrink-0 bg-blue-50 border-b border-blue-200 px-4 py-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4 text-sm">
              <span className="font-medium text-blue-800">선택된 고객:</span>
              <span className="text-blue-700">{selectedCustomer.custNm}</span>
              <span className="text-blue-600">({selectedCustomer.custId})</span>
              <span className="text-blue-600">{selectedCustomer.telNo}</span>
            </div>
            <button
              onClick={() => {
                setSelectedCustomer(null);
                setSelectedContract(null);
              }}
              className="text-blue-600 hover:text-blue-800 text-sm"
            >
              선택 해제
            </button>
          </div>
          {selectedContract && (
            <div className="flex items-center gap-4 text-sm mt-1">
              <span className="font-medium text-blue-800">선택된 계약:</span>
              <span className="text-blue-700">{selectedContract.prodNm}</span>
              <span className="text-blue-600">({selectedContract.ctrtId})</span>
            </div>
          )}
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
