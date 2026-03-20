import React, { useState, useCallback } from 'react';
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
 * 탭 전환 시 조회 상태 유지:
 * - 최초 방문 시에만 컴포넌트 마운트 (API 과다호출 방지)
 * - 방문한 탭은 숨김 (언마운트 안 함 → 조회 결과 유지)
 * - 활성 탭: height 100%, 비활성: height 0 + overflow hidden + invisible
 */
const EquipmentManagementMenu: React.FC<EquipmentManagementMenuProps> = ({ onNavigateToMenu, showToast }) => {
  const [activeTab, setActiveTab] = useState<string>('equipment-assignment');
  const [visitedTabs, setVisitedTabs] = useState<Set<string>>(new Set(['equipment-assignment']));

  const tabs: TabItem[] = [
    { id: 'equipment-assignment', title: '장비할당', description: '파트너사 출고 장비 입고 처리' },
    { id: 'equipment-inquiry', title: '장비처리', description: '나의 보유 장비 반납 / 분실 / 사용가능변경' },
    { id: 'equipment-list', title: '장비조회', description: 'S/N 또는 바코드로 장비 상세 조회' },
    { id: 'equipment-movement', title: '장비이동', description: '바코드 스캔으로 타기사 장비 이관' },
    { id: 'equipment-recovery', title: '미회수장비', description: '미회수 장비 회수 처리' }
  ];

  const handleTabChange = useCallback((tabId: string) => {
    setActiveTab(tabId);
    setVisitedTabs(prev => {
      if (prev.has(tabId)) return prev;
      const next = new Set(prev);
      next.add(tabId);
      return next;
    });
  }, []);

  const tabStyle = (tabId: string): React.CSSProperties =>
    activeTab === tabId
      ? { height: '100%', overflow: 'auto' }
      : { height: 0, overflow: 'hidden', visibility: 'hidden' as const, position: 'absolute' as const };

  return (
    <div className="h-[calc(100dvh-64px)] flex flex-col bg-gray-50">
      <div className="flex-shrink-0 bg-white border-b border-gray-200 z-40">
        <ScrollableTabMenu
          tabs={tabs}
          activeTab={activeTab}
          onTabChange={handleTabChange}
        />
      </div>
      <div className="flex-1 relative overflow-hidden">
        {visitedTabs.has('equipment-assignment') && (
          <div style={tabStyle('equipment-assignment')}>
            <EquipmentAssignment onBack={onNavigateToMenu} showToast={showToast} />
          </div>
        )}
        {visitedTabs.has('equipment-inquiry') && (
          <div style={tabStyle('equipment-inquiry')}>
            <EquipmentInquiry onBack={onNavigateToMenu} showToast={showToast} />
          </div>
        )}
        {visitedTabs.has('equipment-list') && (
          <div style={tabStyle('equipment-list')}>
            <EquipmentList onBack={onNavigateToMenu} showToast={showToast} />
          </div>
        )}
        {visitedTabs.has('equipment-movement') && (
          <div style={tabStyle('equipment-movement')}>
            <EquipmentMovement onBack={onNavigateToMenu} showToast={showToast} />
          </div>
        )}
        {visitedTabs.has('equipment-recovery') && (
          <div style={tabStyle('equipment-recovery')}>
            <EquipmentRecovery onBack={onNavigateToMenu} showToast={showToast} />
          </div>
        )}
      </div>
    </div>
  );
};

export default EquipmentManagementMenu;
