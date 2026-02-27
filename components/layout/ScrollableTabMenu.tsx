import React, { useState, useEffect, useRef } from 'react';

export interface TabItem {
  id: string;
  title: string;
  description?: string;
  badge?: number;
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
        bg-white border-b border-gray-200
        ${className}
      `}
    >
      <style>{`
        @keyframes breathe {
          0%, 100% { background-color: #fef3c7; border-color: #f59e0b; }
          50% { background-color: #fde68a; border-color: #d97706; }
        }
        .tab-breathe {
          animation: breathe 2s ease-in-out infinite;
          border-width: 2px;
          border-style: solid;
        }
      `}</style>
      {/* 탭 컨테이너 - 작업관리와 정확히 동일한 스타일 */}
      <div
        ref={scrollContainerRef}
        className="w-full justify-start bg-white rounded-none h-auto py-2 px-3 overflow-x-auto border-none"
        style={{
          scrollbarWidth: 'none',
          msOverflowStyle: 'none',
          WebkitOverflowScrolling: 'touch'
        }}
      >
        <div className="flex">
          {tabs.map((tab, index) => {
            const isActive = activeTab === tab.id;
            const hasBadge = tab.badge != null && tab.badge > 0;
            const showBreathe = hasBadge && !isActive;

            return (
              <button
                key={tab.id}
                ref={(el) => (tabRefs.current[index] = el)}
                onClick={() => onTabChange(tab.id)}
                className={`
                  rounded-full px-4 py-2 text-sm font-medium flex-shrink-0 mx-1 transition-colors
                  ${isActive
                    ? 'bg-blue-500 text-white'
                    : showBreathe
                      ? 'tab-breathe text-amber-800'
                      : 'text-gray-600'
                  }
                `}
              >
                {tab.title}
                {hasBadge && (
                  <span className={`ml-1 inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 text-xs font-bold rounded-full ${
                    isActive
                      ? 'bg-white/30 text-white'
                      : 'bg-amber-500 text-white'
                  }`}>
                    {tab.badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default ScrollableTabMenu;
