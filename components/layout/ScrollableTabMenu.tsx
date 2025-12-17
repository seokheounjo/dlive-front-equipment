import React, { useState, useEffect, useRef } from 'react';

export interface TabItem {
  id: string;
  title: string;
  description?: string;
}

interface ScrollableTabMenuProps {
  tabs: TabItem[];
  activeTab: string;
  onTabChange: (tabId: string) => void;
  className?: string;
}

const ScrollableTabMenu: React.FC<ScrollableTabMenuProps> = ({ 
  tabs, 
  activeTab, 
  onTabChange,
  className = "" 
}) => {
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);



  return (
    <div
      className={`
        bg-white
        ${className}
      `}
    >
      {/* 탭 컨테이너 - 작업관리와 정확히 동일한 스타일 */}
      <div 
        ref={scrollContainerRef}
        className="w-full justify-start bg-white rounded-none h-auto py-2 px-3 overflow-x-auto border-none"
        style={{ 
          scrollbarWidth: 'none', 
          msOverflowStyle: 'none',
          WebkitOverflowScrolling: 'touch' // iOS 부드러운 스크롤
        }}
      >
        <div className="flex">
          {tabs.map((tab, index) => (
            <button
              key={tab.id}
              ref={(el) => (tabRefs.current[index] = el)}
              onClick={() => onTabChange(tab.id)}
              className={`
                rounded-full px-4 py-2 text-sm font-medium flex-shrink-0 mx-1 transition-colors
                ${activeTab === tab.id 
                  ? 'bg-blue-500 text-white' 
                  : 'text-gray-600'
                }
              `}
            >
              {tab.title}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

export default ScrollableTabMenu;
