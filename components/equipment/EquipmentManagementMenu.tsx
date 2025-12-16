import React, { useState } from 'react';
import ScrollableTabMenu, { TabItem } from '../layout/ScrollableTabMenu';
import EquipmentAssignment from '../equipment/EquipmentAssignment';
import EquipmentInquiry from '../equipment/EquipmentInquiry';
import EquipmentMovement from '../equipment/EquipmentMovement';
import EquipmentRecovery from '../equipment/EquipmentRecovery';
import EquipmentList from '../equipment/EquipmentList';
import EquipmentApiTester from '../equipment/EquipmentApiTester';

interface EquipmentManagementMenuProps {
  onNavigateToMenu: () => void;
  showToast?: (message: string, type: 'success' | 'error' | 'warning' | 'info') => void;
}

/**
 * 장비관리 메뉴 (1안 기준 - 4개 메인 메뉴 + API 테스터)
 *
 * 1. 장비할당: 파트너사에서 출고된 장비를 기사가 입고 확인
 * 2. 장비조회: 나의 보유 장비 조회 및 반납/분실/사용가능변경 처리
 * 3. 기사간 장비이동: 타기사의 장비를 나의 장비로 이관
 * 4. 미회수장비: 해지 철거시 미회수된 장비 회수 처리
 */
const EquipmentManagementMenu: React.FC<EquipmentManagementMenuProps> = ({ onNavigateToMenu, showToast }) => {
  const [activeTab, setActiveTab] = useState<string>('equipment-assignment');

  const tabs: TabItem[] = [
    { id: 'equipment-assignment', title: '장비할당', description: '파트너사 출고 장비 입고 처리' },
    { id: 'equipment-inquiry', title: '장비조회', description: '나의 보유 장비 조회 / 반납 / 분실 / 사용가능변경' },
    { id: 'equipment-list', title: '장비목록', description: 'S/N 또는 MAC으로 장비 상세 조회' },
    { id: 'equipment-movement', title: '기사간 장비이동', description: '타 기사 장비를 나에게로 이관' },
    { id: 'equipment-recovery', title: '미회수장비', description: '미회수 장비 회수 처리' },
    { id: 'api-tester', title: '🔧 API', description: 'API 테스트' }
  ];

  const handleTabChange = (tabId: string) => {
    setActiveTab(tabId);
  };

  const renderContent = () => {
    switch (activeTab) {
      case 'equipment-assignment':
        return <EquipmentAssignment onBack={onNavigateToMenu} showToast={showToast} />;
      case 'equipment-inquiry':
        return <EquipmentInquiry onBack={onNavigateToMenu} showToast={showToast} />;
      case 'equipment-list':
        return <EquipmentList onBack={onNavigateToMenu} showToast={showToast} />;
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
