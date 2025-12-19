import React from 'react';
import { View } from '../App';
import { ClipboardList, UserCheck, Boxes, MoreHorizontal } from 'lucide-react';

interface BottomNavigationProps {
  currentView: View;
  onNavigate?: (view: View) => void;
  onSelectMenu: (view: View) => void;
}

const BottomNavigation: React.FC<BottomNavigationProps> = ({
  currentView,
  onNavigate,
  onSelectMenu
}) => {
  const handleNavigation = (view: View) => {
    onSelectMenu(view);
    onNavigate?.(view);
  };

  const navItems = [
    {
      id: 'work-management' as View,
      label: '작업관리',
      icon: ClipboardList,
    },
    {
      id: 'customer-management' as View,
      label: '고객관리',
      icon: UserCheck,
    },
    {
      id: 'equipment-management' as View,
      label: '장비관리',
      icon: Boxes,
    },
    {
      id: 'other-management' as View,
      label: '기타관리',
      icon: MoreHorizontal,
    },
  ];

  return (
    <div
      className="fixed bottom-0 left-0 right-0 bg-white shadow-lg border-t border-gray-200 z-50"
      style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
    >
      <div className="max-w-7xl mx-auto">
        <div className="flex h-[52px]">
          {navItems.map((item) => {
            const isActive = currentView === item.id;
            const IconComponent = item.icon;

            return (
              <button
                key={item.id}
                onClick={() => handleNavigation(item.id)}
                className="flex-1 flex flex-col items-center justify-center gap-0.5 px-2 py-1 transition-all duration-200 active:scale-95 touch-manipulation"
              >
                <IconComponent
                  className={`
                    transition-all duration-200
                    ${isActive
                      ? 'h-5 w-5 text-blue-600'
                      : 'h-5 w-5 text-gray-500'
                    }
                  `}
                  strokeWidth={isActive ? 2.5 : 2}
                />
                <span
                  className={`
                    text-[10px] transition-all duration-200
                    ${isActive
                      ? 'text-blue-600 font-bold'
                      : 'text-gray-500 font-medium'
                    }
                  `}
                >
                  {item.label}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default BottomNavigation;
