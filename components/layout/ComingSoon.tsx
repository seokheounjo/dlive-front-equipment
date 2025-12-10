import React, { useState } from 'react';
import ScrollableTabMenu, { TabItem } from '../layout/ScrollableTabMenu';

interface ComingSoonProps {
  onNavigateToMenu: () => void;
  title?: string;
  description?: string;
  category?: 'customer-management' | 'equipment-management' | 'other-management';
}

const ComingSoon: React.FC<ComingSoonProps> = ({ 
  onNavigateToMenu, 
  title = "준비 중인 기능입니다.",
  description = "현재 페이지는 개발 중에 있습니다. 잠시만 기다려주세요!",
  category
}) => {
  const [activeTab, setActiveTab] = useState<string>('');

  // 카테고리별 하위 메뉴 탭 데이터
  const getTabsForCategory = (): TabItem[] => {
    switch (category) {
      case 'customer-management':
        return [
          { id: 'customer-info', title: '고객정보관리', description: '고객 정보 조회 및 관리' },
          { id: 'business-bot', title: '업무자동화봇', description: '업무 자동화 봇 관리' }
        ];
      case 'equipment-management':
        return [
          { id: 'equipment-assignment', title: '장비할당/반납처리', description: '장비 할당 및 반납 처리' },
          { id: 'equipment-status', title: '장비상태조회', description: '장비 상태 조회' },
          { id: 'equipment-movement', title: '기사간 장비이동', description: '기사 간 장비 이동 관리' },
          { id: 'equipment-recovery', title: '미회수 장비 회수처리', description: '미회수 장비 회수 처리' }
        ];
      case 'other-management':
        return [
          { id: 'overtime-application', title: '시간외근무신청', description: '시간외 근무 신청' },
          { id: 'overtime-input', title: '시간외근무실적입력', description: '시간외 근무 실적 입력' },
          { id: 'announcements', title: '공지사항', description: '공지사항 조회' }
        ];
      default:
        return [];
    }
  };

  const tabs = getTabsForCategory();
  const hasTabs = tabs.length > 0;

  // 초기 활성 탭 설정
  React.useEffect(() => {
    if (hasTabs && !activeTab) {
      setActiveTab(tabs[0].id);
    }
  }, [hasTabs, activeTab, tabs]);

  const handleTabChange = (tabId: string) => {
    setActiveTab(tabId);
    // 탭 변경 시에도 준비 중 화면 유지 (alert 제거)
  };

  return (
    <div className={`${hasTabs ? '' : ''}`}>
      {/* 스크롤 가능한 탭 메뉴 */}
      {hasTabs && (
        <ScrollableTabMenu
          tabs={tabs}
          activeTab={activeTab}
          onTabChange={handleTabChange}
        />
      )}
      
      <div className="text-center p-10 bg-white rounded-lg shadow-md">
        <h2 className="text-3xl font-bold text-gray-800 mb-4">{title}</h2>
        <p className="text-gray-600 mb-8">{description}</p>
        <button
          onClick={onNavigateToMenu}
          className="px-6 py-2 bg-cyan-500 text-white font-bold rounded-md hover:bg-cyan-600 transition-colors"
        >
          메인 메뉴로 돌아가기
        </button>
      </div>
    </div>
  );
};

export default ComingSoon;