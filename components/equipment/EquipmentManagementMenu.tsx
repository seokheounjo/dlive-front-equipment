import React, { useState } from 'react';
import ScrollableTabMenu, { TabItem } from '../layout/ScrollableTabMenu';
import EquipmentAssignment from '../equipment/EquipmentAssignment';
import EquipmentStatusView from '../equipment/EquipmentStatusView';
import EquipmentMovement from '../equipment/EquipmentMovement';
import EquipmentRecovery from '../equipment/EquipmentRecovery';
import EquipmentApiTester from '../equipment/EquipmentApiTester';

interface EquipmentManagementMenuProps {
  onNavigateToMenu: () => void;
}

const EquipmentManagementMenu: React.FC<EquipmentManagementMenuProps> = ({ onNavigateToMenu }) => {
  const [activeTab, setActiveTab] = useState<string>('equipment-assignment');

  const tabs: TabItem[] = [
    { id: 'equipment-assignment', title: '장비할당/반납처리', description: '장비 할당 및 반납 처리' },
    { id: 'equipment-status', title: '장비상태조회', description: '장비 상태 조회' },
    { id: 'equipment-movement', title: '기사간 장비이동', description: '기사 간 장비 이동 관리' },
    { id: 'equipment-recovery', title: '미회수 장비 회수처리', description: '미회수 장비 회수 처리' },
    { id: 'api-tester', title: '🔧 API 통합 테스터', description: '20개 API 원클릭 테스트 & 디버깅' }
  ];

  const handleTabChange = (tabId: string) => {
    setActiveTab(tabId);
  };

  const renderContent = () => {
    switch (activeTab) {
      case 'equipment-assignment':
        return <EquipmentAssignment onBack={onNavigateToMenu} />;
      case 'equipment-status':
        return <EquipmentStatusView onBack={onNavigateToMenu} />;
      case 'equipment-movement':
        return <EquipmentMovement onBack={onNavigateToMenu} />;
      case 'equipment-recovery':
        return <EquipmentRecovery onBack={onNavigateToMenu} />;
      case 'api-tester':
        return <EquipmentApiTester />;
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

export default EquipmentManagementMenu;
