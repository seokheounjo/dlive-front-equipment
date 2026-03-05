import React, { useState } from 'react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '../ui/tabs';
import AttendanceRegistration from './AttendanceRegistration';
import LGUConstructionRequest from '../other/LGUConstructionRequest';
import LGUNetworkFault from '../other/LGUNetworkFault';
import ComingSoon from '../layout/ComingSoon';

interface UserInfo {
  userId: string;
  userName: string;
  userRole: string;
  soId?: string;
  crrId?: string;
}

interface OtherManagementProps {
  onNavigateToMenu: () => void;
  userInfo?: UserInfo | null;
  showToast?: (message: string, type: 'success' | 'error' | 'warning' | 'info') => void;
}

const OtherManagement: React.FC<OtherManagementProps> = ({
  onNavigateToMenu,
  userInfo,
  showToast
}) => {
  const [activeTab, setActiveTab] = useState<string>('notice');
  const tabListRef = React.useRef<HTMLDivElement>(null);
  const tabButtonRefs = React.useRef<(HTMLButtonElement | null)[]>([]);

  const otherManagementTabs = [
    { id: 'notice', title: '공지사항' },
    { id: 'attendance', title: '근태등록' },
    { id: 'lgu-construction', title: '(LGU)공사요청진행정보' },
    { id: 'lgu-network-fault', title: '(LGU)망장애이관리스트' },
  ];

  const handleTabChange = (tabId: string) => {
    setActiveTab(tabId);

    const scrollToCenter = () => {
      const tabList = tabListRef.current;
      const activeButton = tabButtonRefs.current[otherManagementTabs.findIndex(tab => tab.id === tabId)];

      if (tabList && activeButton) {
        const tabListRect = tabList.getBoundingClientRect();
        const activeButtonRect = activeButton.getBoundingClientRect();
        const scrollLeft = activeButtonRect.left - tabListRect.left - (tabListRect.width / 2) + (activeButtonRect.width / 2);

        tabList.scrollTo({
          left: tabList.scrollLeft + scrollLeft,
          behavior: 'smooth'
        });
      }
    };

    setTimeout(scrollToCenter, 0);
  };

  return (
    <div className="w-full">
      <Tabs value={activeTab} onValueChange={handleTabChange} className="w-full">
        <div className="bg-white border-b border-gray-200">
          <div
            ref={tabListRef}
            className="w-full overflow-x-auto scrollbar-hide"
          >
            <TabsList className="inline-flex justify-start bg-white rounded-none h-auto py-2 px-3 border-none min-w-max overflow-visible">
              {otherManagementTabs.map((tab, idx) => (
                <TabsTrigger
                  key={tab.id}
                  value={tab.id}
                  ref={(el) => (tabButtonRefs.current[idx] = el)}
                  className="data-[state=active]:bg-blue-500 data-[state=active]:text-white data-[state=inactive]:text-gray-600 rounded-full px-4 py-2 text-sm font-medium flex-shrink-0 mx-1 transition-colors whitespace-nowrap"
                >
                  {tab.title}
                </TabsTrigger>
              ))}
            </TabsList>
          </div>
        </div>

        <TabsContent value="notice" className="px-3 pt-1">
          <ComingSoon
            onNavigateToMenu={onNavigateToMenu}
            title="공지사항"
            description="공지사항 기능이 준비 중입니다."
          />
        </TabsContent>

        <TabsContent value="attendance" className="px-0 pt-1">
          <AttendanceRegistration onBack={onNavigateToMenu} userInfo={userInfo} showToast={showToast} />
        </TabsContent>

        <TabsContent value="lgu-construction" className="px-3 pt-1">
          <LGUConstructionRequest onBack={onNavigateToMenu} userInfo={userInfo} showToast={showToast} />
        </TabsContent>

        <TabsContent value="lgu-network-fault" className="px-3 pt-1">
          <LGUNetworkFault onBack={onNavigateToMenu} userInfo={userInfo} showToast={showToast} />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default OtherManagement;
