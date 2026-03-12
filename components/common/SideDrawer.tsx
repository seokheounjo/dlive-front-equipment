import React, { useState, useEffect, useMemo } from 'react';
import { User, FileText, LogOut, X, ClipboardList, Users, Package, MoreHorizontal, Calendar, Bell, BellOff } from 'lucide-react';
import { useUIStore } from '../../stores/uiStore';
import { useWorkOrders } from '../../hooks/queries/useWorkOrders';
import { WorkOrderStatus } from '../../types';

interface SideDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  userName?: string;
  userId?: string;
  stats?: Record<string, number>;
  onLogout?: () => void;
  onNavigate?: (menu: string) => void;
}

const SideDrawer: React.FC<SideDrawerProps> = ({
  isOpen,
  onClose,
  userName = '작업자',
  userId = '사번',
  stats,
  onLogout,
  onNavigate
}) => {
  const { fontScale, setFontScale, preferredNavApp, setPreferredNavApp } = useUIStore();

  // 오늘 작업 데이터 - TodayWork와 동일한 쿼리 키로 캐시 공유
  const { queryStartDate, queryEndDate, todayDateStr } = useMemo(() => {
    const now = new Date();
    const oneMonthAgo = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    const fmt = (d: Date) => d.toISOString().split('T')[0];
    return {
      queryStartDate: fmt(oneMonthAgo),
      queryEndDate: fmt(monthEnd),
      todayDateStr: fmt(now)
    };
  }, []);
  const { data: allWorkOrders = [] } = useWorkOrders({ startDate: queryStartDate, endDate: queryEndDate });

  const todayCounts = useMemo(() => {
    const todayOrders = allWorkOrders.filter(order => {
      if (!order.scheduledAt) return false;
      return order.scheduledAt.split('T')[0] === todayDateStr;
    });
    const delayed = allWorkOrders.filter(order => {
      if (!order.scheduledAt) return false;
      return order.scheduledAt.split('T')[0] < todayDateStr && order.status === WorkOrderStatus.Pending;
    }).length;
    return {
      inProgress: todayOrders.filter(o => o.status === WorkOrderStatus.Pending).length,
      delayed,
      total: todayOrders.length
    };
  }, [allWorkOrders, todayDateStr]);
  const [pushStatus, setPushStatus] = useState<string>('loading');

  useEffect(() => {
    if (isOpen) {
      (window as any).__getPushStatus?.().then((s: string) => setPushStatus(s)).catch(() => setPushStatus('unsupported'));
    }
  }, [isOpen]);

  const handlePushToggle = async () => {
    if (pushStatus === 'subscribed') {
      const result = await (window as any).__unsubscribePush?.();
      if (result?.status === 'unsubscribed') setPushStatus('default');
    } else {
      const result = await (window as any).__subscribePush?.();
      if (result) {
        setPushStatus(result.status === 'granted' ? 'subscribed' : result.status);
      }
    }
  };

  const fontScaleOptions = [
    { key: 'small' as const, label: '작게', size: '14px' },
    { key: 'medium' as const, label: '보통', size: '16px' },
    { key: 'large' as const, label: '크게', size: '18px' },
    { key: 'xlarge' as const, label: '매우 크게', size: '20px' },
  ];

  const navAppOptions = [
    { key: 'kakao' as const, label: '카카오맵', badge: 'K', color: 'bg-yellow-400 text-yellow-900' },
    { key: 'tmap' as const, label: 'T맵', badge: 'T', color: 'bg-blue-500 text-white' },
    { key: 'naver' as const, label: '네이버', badge: 'N', color: 'bg-green-500 text-white' },
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
          <div className="bg-primary-500 p-6 relative">
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

          {/* 오늘의 작업 */}
          <div className="px-6 py-4 bg-gray-50 border-b border-gray-200">
            <div className="bg-white rounded-lg p-3 shadow-sm">
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold text-gray-600">오늘의 작업</span>
                <div className="flex gap-3">
                  <div className="text-center">
                    <span className="text-xs text-gray-500">진행중</span>
                    <p className="text-lg font-bold text-primary-700">{todayCounts.inProgress}</p>
                  </div>
                  <div className="text-center">
                    <span className="text-xs text-gray-500">지연</span>
                    <p className={`text-lg font-bold ${todayCounts.delayed > 0 ? 'text-red-500' : 'text-gray-400'}`}>{todayCounts.delayed}</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* 메뉴 리스트 */}
          <nav className="flex-1 p-4 overflow-y-auto">
            <ul className="space-y-1">
              <li>
                <button
                  className="w-full flex items-center gap-2 sm:gap-3 px-3 sm:px-4 py-2.5 sm:py-3 text-gray-700 hover:bg-primary-50 rounded-lg transition-colors"
                  onClick={() => handleMenuClick('today-work')}
                >
                  <Calendar className="w-5 h-5 text-primary-700" />
                  <span className="font-medium text-sm sm:text-base">오늘의 작업</span>
                </button>
              </li>
              <li>
                <button
                  className="w-full flex items-center gap-2 sm:gap-3 px-3 sm:px-4 py-2.5 sm:py-3 text-gray-700 hover:bg-primary-50 rounded-lg transition-colors"
                  onClick={() => handleMenuClick('work-management')}
                >
                  <ClipboardList className="w-5 h-5 text-primary-700" />
                  <span className="font-medium text-sm sm:text-base">작업관리</span>
                </button>
              </li>
              <li>
                <button
                  className="w-full flex items-center gap-2 sm:gap-3 px-3 sm:px-4 py-2.5 sm:py-3 text-gray-700 hover:bg-primary-50 rounded-lg transition-colors"
                  onClick={() => handleMenuClick('customer-management')}
                >
                  <Users className="w-5 h-5 text-primary-700" />
                  <span className="font-medium text-sm sm:text-base">고객관리</span>
                </button>
              </li>
              <li>
                <button
                  className="w-full flex items-center gap-2 sm:gap-3 px-3 sm:px-4 py-2.5 sm:py-3 text-gray-700 hover:bg-primary-50 rounded-lg transition-colors"
                  onClick={() => handleMenuClick('equipment-management')}
                >
                  <Package className="w-5 h-5 text-primary-700" />
                  <span className="font-medium text-sm sm:text-base">장비관리</span>
                </button>
              </li>
              <li>
                <button
                  className="w-full flex items-center gap-2 sm:gap-3 px-3 sm:px-4 py-2.5 sm:py-3 text-gray-700 hover:bg-primary-50 rounded-lg transition-colors"
                  onClick={() => handleMenuClick('other-management')}
                >
                  <MoreHorizontal className="w-5 h-5 text-primary-700" />
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
                        ? 'border-primary-500 bg-primary-50'
                        : 'border-gray-200 bg-white'
                    }`}
                  >
                    <span
                      className={`font-bold ${fontScale === opt.key ? 'text-primary-700' : 'text-gray-700'}`}
                      style={{ fontSize: opt.size }}
                    >
                      가
                    </span>
                    <span className={`text-[0.625rem] mt-0.5 ${
                      fontScale === opt.key ? 'text-primary-700 font-semibold' : 'text-gray-500'
                    }`}>
                      {opt.label}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            {/* 길찾기 앱 설정 */}
            <div className="mt-4 px-3">
              <h3 className="text-xs font-semibold text-gray-500 mb-2">길찾기 앱</h3>
              <div className="grid grid-cols-3 gap-1.5">
                {navAppOptions.map((opt) => (
                  <button
                    key={opt.key}
                    onClick={() => setPreferredNavApp(opt.key)}
                    className={`flex flex-col items-center py-2 rounded-lg border-2 transition-all ${
                      preferredNavApp === opt.key
                        ? 'border-primary-500 bg-primary-50'
                        : 'border-gray-200 bg-white'
                    }`}
                  >
                    <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${opt.color}`}>
                      {opt.badge}
                    </span>
                    <span className={`text-[0.625rem] mt-1 ${
                      preferredNavApp === opt.key ? 'text-primary-700 font-semibold' : 'text-gray-500'
                    }`}>
                      {opt.label}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            {/* 알림 설정 */}
            <div className="mt-4 px-3">
              <h3 className="text-xs font-semibold text-gray-500 mb-2">알림</h3>
              <div className="grid grid-cols-2 gap-1.5">
                <button
                  onClick={pushStatus !== 'subscribed' ? handlePushToggle : undefined}
                  className={`flex flex-col items-center py-2 rounded-lg border-2 transition-all ${
                    pushStatus === 'subscribed'
                      ? 'border-primary-500 bg-primary-50'
                      : 'border-gray-200 bg-white'
                  }`}
                >
                  <Bell className={`w-5 h-5 ${pushStatus === 'subscribed' ? 'text-primary-600' : 'text-gray-400'}`} />
                  <span className={`text-[0.625rem] mt-1 ${
                    pushStatus === 'subscribed' ? 'text-primary-700 font-semibold' : 'text-gray-500'
                  }`}>ON</span>
                </button>
                <button
                  onClick={pushStatus === 'subscribed' ? handlePushToggle : undefined}
                  className={`flex flex-col items-center py-2 rounded-lg border-2 transition-all ${
                    pushStatus !== 'subscribed'
                      ? 'border-primary-500 bg-primary-50'
                      : 'border-gray-200 bg-white'
                  }`}
                >
                  <BellOff className={`w-5 h-5 ${pushStatus !== 'subscribed' ? 'text-primary-600' : 'text-gray-400'}`} />
                  <span className={`text-[0.625rem] mt-1 ${
                    pushStatus !== 'subscribed' ? 'text-primary-700 font-semibold' : 'text-gray-500'
                  }`}>OFF</span>
                </button>
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
