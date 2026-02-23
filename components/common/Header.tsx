import React, { useState, useRef, useEffect } from 'react';
import { Menu, User } from 'lucide-react';
import { DliveLogo } from '../common/DliveLogo';
import { View } from '../../App';
import { WorkOrder } from '../../types';

interface UserInfo {
  name: string;
  id: string;
  role: string;
}

interface HeaderProps {
  onLogout: () => void;
  onNavigateHome: () => void;
  onNavigateBack?: () => void;
  onMenuClick?: () => void;
  currentView?: View;
  userInfo?: UserInfo | null;
  selectedWorkItem?: WorkOrder | null;
}


const Header: React.FC<HeaderProps> = ({ onLogout, onNavigateHome, onNavigateBack, onMenuClick, currentView, userInfo, selectedWorkItem }) => {
  const [showUserMenu, setShowUserMenu] = useState(false);
  const userMenuRef = useRef<HTMLDivElement>(null);

  // 외부 클릭 시 메뉴 닫기
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (userMenuRef.current && !userMenuRef.current.contains(event.target as Node)) {
        setShowUserMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const getViewTitle = (view?: View): { title: string; workType?: string } | null => {
    // WRK_CD_NM 우선 사용, 없으면 typeDisplay 사용 (예: '설치', '철거', 'A/S' 등 - CMWT000 코드 값)
    const workTypeName = selectedWorkItem?.WRK_CD_NM || selectedWorkItem?.typeDisplay || '';

    switch (view) {
      case 'today-work':
        return { title: '오늘의 작업' };
      case 'work-management':
        return { title: '작업관리' };
      case 'work-order-detail':
        return { title: '작업상세' };
      case 'work-complete-form':
        return { title: '작업완료', workType: workTypeName };
      case 'work-complete-detail':
        return { title: '작업완료', workType: workTypeName };
      case 'work-item-list':
        return { title: '작업목록' };
      case 'work-process-flow':
        return { title: '작업진행', workType: workTypeName };
      case 'customer-management':
        return { title: '고객관리' };
      case 'equipment-management':
        return { title: '장비관리' };
      case 'other-management':
        return { title: '기타관리' };
      case 'coming-soon':
        return { title: '준비중' };
      default:
        return null;
    }
  };

  const viewTitle = getViewTitle(currentView);
  const isHome = currentView === 'today-work' || currentView === 'menu' || !currentView;

  return (
    <header className="bg-white shadow-sm fixed top-0 left-0 right-0 z-[100] border-b border-gray-200">
      <div className="max-w-7xl mx-auto px-2 sm:px-4 lg:px-6">
        <div className="flex items-center h-12">
          {/* 왼쪽 영역 - 고정 너비 */}
          <div className="flex items-center gap-0 w-24 flex-shrink-0">
            {/* 뒤로가기 버튼 - 홈이 아닐 때만 */}
            {!isHome && (
              <button
                onClick={onNavigateBack || onNavigateHome}
                className="p-1.5 text-blue-600 hover:text-blue-700 hover:bg-blue-50 rounded-lg transition-colors duration-200"
                aria-label="뒤로가기"
              >
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
              </button>
            )}
            {/* 햄버거 메뉴 */}
            {onMenuClick && (
              <button
                onClick={onMenuClick}
                className="p-1.5 text-blue-600 hover:text-blue-700 hover:bg-blue-50 rounded-lg transition-colors duration-200"
                aria-label="메뉴 열기"
              >
                <Menu className="w-5 h-5" />
              </button>
            )}
          </div>

          {/* 중앙 영역 - flex-1로 남은 공간 채움 */}
          <div className="flex-1 flex items-center justify-center">
            {isHome ? (
              <button onClick={onNavigateHome} className="flex items-center cursor-pointer" aria-label="메인 메뉴로 이동">
                <DliveLogo className="text-xl text-blue-600" />
              </button>
            ) : viewTitle ? (
              <span className="text-sm font-bold text-gray-900">
                {viewTitle.title}
                {viewTitle.workType && (
                  <span className="text-blue-600">({viewTitle.workType})</span>
                )}
              </span>
            ) : null}
          </div>

          {/* 오른쪽 영역 - 고정 너비 */}
          <div className="w-24 flex-shrink-0 flex justify-end">
          <div className="relative" ref={userMenuRef}>
            <button
              onClick={() => setShowUserMenu(!showUserMenu)}
              className={`flex flex-col items-center p-1.5 rounded-lg transition-colors duration-200 ${showUserMenu ? 'text-blue-700 bg-blue-50' : 'text-blue-600 hover:text-blue-700 hover:bg-blue-50'}`}
              aria-label="사용자 메뉴"
            >
              <User className="w-4 h-4" />
              <span className="text-[0.5625rem] mt-0.5 truncate max-w-[60px]">
                {userInfo ? `${userInfo.userName || '작업자'}` : '작업자'}
              </span>
            </button>
            {/* 드롭다운 메뉴 */}
            {showUserMenu && (
              <div className="fixed right-2 top-12 w-48 bg-white rounded-lg shadow-lg border border-gray-200 py-2 z-[9999]">
                <div className="px-4 py-2 border-b border-gray-100">
                  <p className="text-sm font-medium text-gray-900">
                    {userInfo?.userName || '작업자'}
                  </p>
                  <p className="text-xs text-gray-500">
                    {userInfo?.userId || '사번'}
                  </p>
                  <p className="text-xs text-gray-400">
                    {userInfo?.userRole || '전산작업자'}
                  </p>
                </div>
                <button
                  onClick={() => {
                    setShowUserMenu(false);
                    onLogout();
                  }}
                  className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 transition-colors"
                >
                  로그아웃
                </button>
              </div>
            )}
          </div>
          </div>
        </div>
      </div>
    </header>
  );
};

export default Header;