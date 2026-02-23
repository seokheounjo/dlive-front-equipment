import React from 'react';
import { User, FileText, LogOut, X, ClipboardList, Users, Package, MoreHorizontal, Calendar } from 'lucide-react';
import { useUIStore } from '../../stores/uiStore';

interface SideDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  userName?: string;
  userId?: string;
  stats?: {
    todayInProgress: number;
    todayCompleted: number;
    weekTotal: number;
    monthTotal: number;
  };
  onLogout?: () => void;
  onNavigate?: (menu: string) => void;
}

const SideDrawer: React.FC<SideDrawerProps> = ({
  isOpen,
  onClose,
  userName = '작업자',
  userId = '사번',
  stats = {
    todayInProgress: 0,
    todayCompleted: 0,
    weekTotal: 0,
    monthTotal: 0
  },
  onLogout,
  onNavigate
}) => {
  const { fontScale, setFontScale } = useUIStore();

  const fontScaleOptions = [
    { key: 'small' as const, label: '작게', size: '14px' },
    { key: 'medium' as const, label: '보통', size: '16px' },
    { key: 'large' as const, label: '크게', size: '18px' },
    { key: 'xlarge' as const, label: '매우 크게', size: '20px' },
  ];

  const handleLogout = () => {
    if (onLogout) {
      onLogout();
      onClose();
    }
  };

  const handleMenuClick = (menu: string) => {
    if (onNavigate) {
      onNavigate(menu);
    }
    onClose();
  };

  return (
    <>
      {/* 오버레이 */}
      <div
        className={`fixed inset-0 bg-black/50 backdrop-blur-sm transition-opacity duration-300 ${
          isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
        onClick={onClose}
        aria-hidden="true"
        style={{ zIndex: 9998 }}
      />

      {/* 드로어 */}
      <div
        className={`fixed top-0 left-0 h-full w-80 bg-white shadow-2xl transform transition-transform duration-300 ease-out ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
        style={{ touchAction: 'pan-y', zIndex: 9999 }}
      >
        <div className="flex flex-col h-full">
          {/* 헤더 */}
          <div className="bg-blue-600 p-6 relative">
            <button
              onClick={onClose}
              className="absolute top-4 right-4 text-white hover:bg-white/20 rounded-full p-2 transition-colors"
              aria-label="닫기"
            >
              <X className="w-5 h-5" />
            </button>

            {/* 사용자 프로필 */}
            <div className="flex items-center gap-4 mt-2">
              <div className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center">
                <User className="w-8 h-8 text-white" />
              </div>
              <div className="text-white">
                <p className="text-xl font-bold">{userName}</p>
                <p className="text-sm text-white/90">{userId}</p>
              </div>
            </div>
          </div>

          {/* 통계 카드 */}
          <div className="p-6 bg-gray-50 border-b border-gray-200">
            <h3 className="text-sm font-semibold text-gray-600 mb-3">작업 통계</h3>
            <div className="space-y-2">
              {/* 오늘의 작업 */}
              <div className="bg-white rounded-lg p-3 shadow-sm">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-gray-600">오늘의 작업</span>
                  <div className="flex gap-2 sm:gap-3">
                    <div className="text-right">
                      <span className="text-xs text-gray-500">진행중</span>
                      <p className="text-sm font-bold text-blue-600">{stats.todayInProgress}</p>
                    </div>
                    <div className="text-right">
                      <span className="text-xs text-gray-500">완료</span>
                      <p className="text-sm font-bold text-blue-600">{stats.todayCompleted}</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* 이번 주 작업 */}
              <div className="bg-white rounded-lg p-3 shadow-sm">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-gray-600">이번 주</span>
                  <p className="text-sm font-bold text-blue-600">{stats.weekTotal}</p>
                </div>
              </div>

              {/* 이번 달 작업 */}
              <div className="bg-white rounded-lg p-3 shadow-sm">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-gray-600">이번 달</span>
                  <p className="text-sm font-bold text-blue-600">{stats.monthTotal}</p>
                </div>
              </div>
            </div>
          </div>

          {/* 메뉴 리스트 */}
          <nav className="flex-1 p-4 overflow-y-auto">
            <ul className="space-y-1">
              <li>
                <button
                  className="w-full flex items-center gap-2 sm:gap-3 px-3 sm:px-4 py-2.5 sm:py-3 text-gray-700 hover:bg-blue-50 rounded-lg transition-colors"
                  onClick={() => handleMenuClick('today-work')}
                >
                  <Calendar className="w-5 h-5 text-blue-600" />
                  <span className="font-medium text-sm sm:text-base">오늘의 작업</span>
                </button>
              </li>
              <li>
                <button
                  className="w-full flex items-center gap-2 sm:gap-3 px-3 sm:px-4 py-2.5 sm:py-3 text-gray-700 hover:bg-blue-50 rounded-lg transition-colors"
                  onClick={() => handleMenuClick('work-management')}
                >
                  <ClipboardList className="w-5 h-5 text-blue-600" />
                  <span className="font-medium text-sm sm:text-base">작업관리</span>
                </button>
              </li>
              <li>
                <button
                  className="w-full flex items-center gap-2 sm:gap-3 px-3 sm:px-4 py-2.5 sm:py-3 text-gray-700 hover:bg-blue-50 rounded-lg transition-colors"
                  onClick={() => handleMenuClick('customer-management')}
                >
                  <Users className="w-5 h-5 text-blue-600" />
                  <span className="font-medium text-sm sm:text-base">고객관리</span>
                </button>
              </li>
              <li>
                <button
                  className="w-full flex items-center gap-2 sm:gap-3 px-3 sm:px-4 py-2.5 sm:py-3 text-gray-700 hover:bg-blue-50 rounded-lg transition-colors"
                  onClick={() => handleMenuClick('equipment-management')}
                >
                  <Package className="w-5 h-5 text-blue-600" />
                  <span className="font-medium text-sm sm:text-base">장비관리</span>
                </button>
              </li>
              <li>
                <button
                  className="w-full flex items-center gap-2 sm:gap-3 px-3 sm:px-4 py-2.5 sm:py-3 text-gray-700 hover:bg-blue-50 rounded-lg transition-colors"
                  onClick={() => handleMenuClick('other-management')}
                >
                  <MoreHorizontal className="w-5 h-5 text-blue-600" />
                  <span className="font-medium text-sm sm:text-base">기타관리</span>
                </button>
              </li>
            </ul>

            {/* 글자 크기 설정 */}
            <div className="mt-4 px-3">
              <h3 className="text-xs font-semibold text-gray-500 mb-2">글자 크기</h3>
              <div className="grid grid-cols-4 gap-1.5">
                {fontScaleOptions.map((opt) => (
                  <button
                    key={opt.key}
                    onClick={() => setFontScale(opt.key)}
                    className={`flex flex-col items-center py-2 rounded-lg border-2 transition-all ${
                      fontScale === opt.key
                        ? 'border-blue-500 bg-blue-50'
                        : 'border-gray-200 bg-white'
                    }`}
                  >
                    <span
                      className={`font-bold ${fontScale === opt.key ? 'text-blue-600' : 'text-gray-700'}`}
                      style={{ fontSize: opt.size }}
                    >
                      가
                    </span>
                    <span className={`text-[0.625rem] mt-0.5 ${
                      fontScale === opt.key ? 'text-blue-600 font-semibold' : 'text-gray-500'
                    }`}>
                      {opt.label}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          </nav>

          {/* 하단 로그아웃 버튼 */}
          <div className="p-3 sm:p-4 border-t border-gray-200">
            <button
              onClick={handleLogout}
              className="w-full flex items-center justify-center gap-2 sm:gap-3 px-3 sm:px-4 py-2.5 sm:py-3 bg-red-50 text-red-600 hover:bg-red-100 rounded-lg transition-colors font-medium text-sm sm:text-base"
            >
              <LogOut className="w-5 h-5" />
              <span>로그아웃</span>
            </button>
          </div>
        </div>
      </div>
    </>
  );
};

export default SideDrawer;
