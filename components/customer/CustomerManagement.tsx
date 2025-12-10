import React, { useState } from 'react';
import ScrollableTabMenu, { TabItem } from '../layout/ScrollableTabMenu';
import CustomerInfoManagement from '../customer/CustomerInfoManagement';
import ComingSoon from '../layout/ComingSoon';

interface CustomerManagementProps {
  onNavigateToMenu: () => void;
}

const CustomerManagement: React.FC<CustomerManagementProps> = ({ onNavigateToMenu }) => {
  const [activeTab, setActiveTab] = useState<string>('customer-info');

  const tabs: TabItem[] = [
    { id: 'customer-info', title: '고객정보관리', description: '고객 정보 조회 및 관리' },
    { id: 'business-bot', title: '업무자동화봇', description: '업무 자동화 봇 관리' }
  ];

  const handleTabChange = (tabId: string) => {
    setActiveTab(tabId);
  };

  const renderContent = () => {
    switch (activeTab) {
      case 'customer-info':
        return <CustomerInfoManagement onBack={onNavigateToMenu} />;
      case 'business-bot':
        return <ComingSoon onNavigateToMenu={onNavigateToMenu} title="업무자동화봇" description="업무 자동화 봇 기능이 준비 중입니다." />;
      default:
        return null;
    }
  };

  return (
    <div>
      <ScrollableTabMenu
        tabs={tabs}
        activeTab={activeTab}
        onTabChange={handleTabChange}
      />
      <div className="p-4">
        {renderContent()}
      </div>
    </div>
  );
};

export default CustomerManagement;
