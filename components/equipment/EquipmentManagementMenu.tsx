import React, { useState } from 'react';
import ScrollableTabMenu, { TabItem } from '../layout/ScrollableTabMenu';
import EquipmentAssignment from '../equipment/EquipmentAssignment';
import EquipmentInquiry from '../equipment/EquipmentInquiry';
import EquipmentMovement from '../equipment/EquipmentMovement';
import EquipmentRecovery from '../equipment/EquipmentRecovery';
import EquipmentList from '../equipment/EquipmentList';

interface EquipmentManagementMenuProps {
  onNavigateToMenu: () => void;
  showToast?: (message: string, type: 'success' | 'error' | 'warning' | 'info') => void;
}

/**
 * 장비관리 메뉴 (5개 메인 메뉴)
 *
 * 1. 장비할당: 파트너사에서 출고된 장비를 기사가 입고 확인
 * 2. 장비처리: 나의 보유 장비 조회 및 반납/분실/사용가능변경 처리
 * 3. 장비조회: S/N 또는 바코드로 장비 상세 조회 (복수 스캔 지원)
 * 4. 장비이동: 타기사의 장비를 나의 장비로 이관 (바코드 스캔 지원)
 * 5. 미회수장비: 해지 철거시 미회수된 장비 회수 처리 (바코드 스캔)
 */
const EquipmentManagementMenu: React.FC<EquipmentManagementMenuProps> = ({ onNavigateToMenu, showToast }) => {
  const [activeTab, setActiveTab] = useState<string>('equipment-assignment');

  const tabs: TabItem[] = [
    { id: 'equipment-assignment', title: '장비할당', description: '파트너사 출고 장비 입고 처리' },
    { id: 'equipment-inquiry', title: '장비처리', description: '나의 보유 장비 반납 / 분실 / 사용가능변경' },
    { id: 'equipment-list', title: '장비조회', description: 'S/N 또는 바코드로 장비 상세 조회' },
    { id: 'equipment-movement', title: '장비이동', description: '바코드 스캔으로 타기사 장비 이관' },
    { id: 'equipment-recovery', title: '미회수장비', description: '미회수 장비 회수 처리' }
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
      default:
        return null;
    }
  };

  return (
    <div className="h-[calc(100vh-64px)] flex flex-col bg-gray-50 overflow-hidden">
      {/* 탭 메뉴 - Dashboard와 동일한 패턴 */}
      <div className="flex-shrink-0 bg-white border-b border-gray-200 z-40">
        <ScrollableTabMenu
          tabs={tabs}
          activeTab={activeTab}
          onTabChange={handleTabChange}
        />
      </div>
      {/* 콘텐츠 영역 - flex-1로 남은 공간 채움, 내부 스크롤 */}
      <div className="flex-1 overflow-hidden">
        {renderContent()}
      </div>
    </div>
  );
};

export default EquipmentManagementMenu;
