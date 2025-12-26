import React, { useState, useEffect, useCallback } from 'react';
import { QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { queryClient } from './lib/queryClient';
import Header from './components/common/Header';
import Dashboard from './components/work/Dashboard';
import Login from './components/layout/Login';
import MainMenu from './components/layout/MainMenu';
import ComingSoon from './components/layout/ComingSoon';
import BottomNavigation from './components/common/BottomNavigation';
import WorkOrderDetail from './components/work/WorkOrderDetail';
import WorkCompleteRouter from './components/work/process/complete';
import WorkCompletionResult from './components/work/WorkCompletionResult';
import WorkItemList from './components/work/WorkItemList';
import TodayWork from './components/work/TodayWork';
import WorkProcessFlow from './components/work/process/WorkProcessFlow';
import Toast, { ToastType } from './components/common/Toast';
import SideDrawer from './components/common/SideDrawer';
import ErrorBoundary from './components/common/ErrorBoundary';
import CustomerManagement from './components/customer/CustomerManagement';
import EquipmentManagementMenu from './components/equipment/EquipmentManagementMenu';
import ApiExplorer from './components/equipment/ApiExplorer';
import OtherManagement from './components/other/OtherManagement';
import { clearAllSessions } from './utils/sessionStorage';
import { getWorkOrders } from './services/apiService';
import { WorkOrderStatus } from './types';
import { useUIStore } from './stores/uiStore';
import NoticePopup, { shouldShowNoticePopup } from './components/common/NoticePopup';

export type View = 'today-work' | 'menu' | 'work-management' | 'work-order-detail' | 'work-process-flow' | 'work-complete-form' | 'work-complete-detail' | 'work-item-list' | 'customer-management' | 'equipment-management' | 'other-management' | 'api-explorer' | 'coming-soon';

interface UserInfo {
  userId: string;
  userName: string;
  userRole: string;
  crrId?: string;
  soId?: string;
  mstSoId?: string;
}

// 계층 구조 정의 - 새로운 페이지 추가 시 여기만 수정하면 됨
const NAVIGATION_HIERARCHY: Record<View, View | null> = {
  'today-work': null, // 최상위 - 오늘의 작업
  'menu': 'today-work',
  'work-management': 'today-work',
  'work-item-list': 'work-management',
  'work-order-detail': 'work-item-list', // 사용하지 않지만 유지
  'work-process-flow': 'work-item-list', // 작업 목록에서 바로 진입
  'work-complete-form': 'work-order-detail',
  'work-complete-detail': 'work-management',
  'customer-management': 'today-work',
  'equipment-management': 'today-work',
  'other-management': 'today-work',
  'api-explorer': 'today-work',
  'coming-soon': 'today-work'
};

const App: React.FC = () => {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [userInfo, setUserInfo] = useState<UserInfo | null>(null);
  const [toast, setToast] = useState<{ message: string; type: ToastType } | null>(null);
  const [comingSoonTitle, setComingSoonTitle] = useState<string>('');
  const [showNoticePopup, setShowNoticePopup] = useState<boolean>(false);

  // UI Store 사용 (Zustand) - Props Drilling 제거
  const {
    isDrawerOpen,
    openDrawer,
    closeDrawer,
    currentView,
    setCurrentView,
    setWorkFilters,
    selectedWorkItem,
    setSelectedWorkItem,
    selectedWorkDirection,
    setSelectedWorkDirection
  } = useUIStore();
  const [workStats, setWorkStats] = useState({
    todayInProgress: 0,
    todayCompleted: 0,
    weekTotal: 0,
    monthTotal: 0
  });

  // 전역 에러 핸들러 설정
  useEffect(() => {
    // unhandledrejection 이벤트 처리
    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      console.error('Unhandled Promise Rejection:', event.reason);
      showToast('처리되지 않은 오류가 발생했습니다.', 'error');
      // 에러 로깅 (프로덕션 환경에서는 로깅 서비스로 전송)
      if (process.env.NODE_ENV === 'production') {
        // 여기에 로깅 서비스 연동
      }
    };

    // 전역 에러 이벤트 처리
    const handleError = (event: ErrorEvent) => {
      console.error('Global Error:', event.error);
      // ErrorBoundary가 캐치하지 못한 에러들 처리
    };

    window.addEventListener('unhandledrejection', handleUnhandledRejection);
    window.addEventListener('error', handleError);

    return () => {
      window.removeEventListener('unhandledrejection', handleUnhandledRejection);
      window.removeEventListener('error', handleError);
    };
  }, []);

  // Zustand persist가 자동으로 currentView를 localStorage에 저장
  // SESSION_KEYS.ACTIVE_VIEW 수동 저장 불필요

  const handleLogin = (userId?: string, userName?: string, userRole?: string, crrId?: string, soId?: string, mstSoId?: string, telNo2?: string, authSoList?: Array<{SO_ID: string; SO_NM: string; MST_SO_ID: string}>) => {
    setIsAuthenticated(true);
    setCurrentView('today-work');
    if (userId) {
      const userInfoData = {
        userId,
        userName: userName || '작업자',
        userRole: userRole || '전산작업자',
        crrId,
        soId,
        mstSoId,
        telNo2,  // SMS 발신번호
        authSoList: authSoList || []  // 지점 목록 (타사 직원용)
      };
      setUserInfo(userInfoData);
      // localStorage에도 저장 (EquipmentManagement에서 사용)
      localStorage.setItem('userInfo', JSON.stringify(userInfoData));
      // 'user' 키에도 저장 (EquipmentList에서 AUTH_SO_List 읽음)
      localStorage.setItem('user', JSON.stringify({
        USR_ID: userId,
        WRKR_ID: userId,
        userId: userId,
        soId: soId,
        SO_ID: soId,
        AUTH_SO_List: authSoList || []
      }));
      // branchList도 별도로 저장 (EquipmentInquiry에서 사용)
      if (authSoList && authSoList.length > 0) {
        localStorage.setItem('branchList', JSON.stringify(authSoList));
        console.log('[App] AUTH_SO_List 저장:', authSoList.length, '개 지점');
      }
    }

    const today = new Date().toISOString().split('T')[0];
    setWorkFilters({
      startDate: today,
      endDate: today,
      filter: '전체'
    });

    // 로그인 후 공지사항 팝업 표시 (하루동안 안보기 체크 확인)
    if (shouldShowNoticePopup()) {
      setShowNoticePopup(true);
    }
  };
  
  const handleLogout = () => {
    setIsAuthenticated(false);
    setUserInfo(null);
    // 로그아웃 시 모든 세션 데이터 및 userInfo 삭제
    localStorage.removeItem('userInfo');
    localStorage.removeItem('user');
    localStorage.removeItem('branchList');
    clearAllSessions();
  };

  const navigateToMenu = () => {
    setCurrentView('today-work');
  };

  const navigateToComingSoon = (title: string) => {
    setComingSoonTitle(title);
    setCurrentView('coming-soon');
  };

  const showToast = useCallback((message: string, type: ToastType = 'info') => {
    setToast({ message, type });
  }, []);

  // 작업 통계 계산 (무한루프 방지)
  const [statsCalculationRetries, setStatsCalculationRetries] = useState<number>(0);
  const [lastStatsCalculationError, setLastStatsCalculationError] = useState<number>(0);

  const calculateWorkStats = async () => {
    // 최근 1분 이내에 3번 이상 실패했으면 계산 중단
    const now = Date.now();
    if (statsCalculationRetries >= 3 && now - lastStatsCalculationError < 60000) {
      console.warn('⚠️ 작업 통계 계산 중단: 반복 실패 감지 (1분 후 재시도)');
      return;
    }

    try {
      const today = new Date();
      const todayStr = today.toISOString().split('T')[0];

      // 이번 주 시작일 (일요일)
      const weekStart = new Date(today);
      weekStart.setDate(today.getDate() - today.getDay());
      const weekStartStr = weekStart.toISOString().split('T')[0];

      // 이번 달 시작일
      const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
      const monthStartStr = monthStart.toISOString().split('T')[0];

      // 오늘 작업 조회
      const todayOrders = await getWorkOrders({ startDate: todayStr, endDate: todayStr });
      const todayInProgress = todayOrders.filter(order => order.status === WorkOrderStatus.Pending).length;
      const todayCompleted = todayOrders.filter(order => order.status === WorkOrderStatus.Completed).length;

      // 이번 주 작업 조회
      const weekOrders = await getWorkOrders({ startDate: weekStartStr, endDate: todayStr });
      const weekTotal = weekOrders.length;

      // 이번 달 작업 조회
      const monthOrders = await getWorkOrders({ startDate: monthStartStr, endDate: todayStr });
      const monthTotal = monthOrders.length;

      setWorkStats({
        todayInProgress,
        todayCompleted,
        weekTotal,
        monthTotal
      });

      // 성공 시 재시도 카운터 초기화
      setStatsCalculationRetries(0);
    } catch (error) {
      console.error('Failed to calculate work stats:', error);
      // 에러 발생 시 재시도 카운터 증가
      setStatsCalculationRetries(prev => prev + 1);
      setLastStatsCalculationError(Date.now());
    }
  };

  // 로그인 후 작업 통계 계산 (today-work 화면이 아닐 때만)
  useEffect(() => {
    if (isAuthenticated && currentView !== 'today-work') {
      // today-work 화면은 자체적으로 데이터를 불러오므로 중복 호출 방지
      calculateWorkStats();
      // 5분마다 통계 업데이트
      const interval = setInterval(calculateWorkStats, 5 * 60 * 1000);
      return () => clearInterval(interval);
    }
  }, [isAuthenticated, currentView]);

  const navigateToView = (view: View, data?: any) => {
    setCurrentView(view);

    // 데이터가 있으면 Store에 저장 (Props Drilling 제거)
    if (data) {
      switch(view) {
        case 'work-order-detail':
        case 'work-process-flow':
        case 'work-complete-form':
        case 'work-complete-detail':
          setSelectedWorkItem(data);
          break;
        case 'work-item-list':
          setSelectedWorkDirection(data);
          break;
      }
    }
  };

  const navigateBack = () => {
    // 계층 구조에서 상위 페이지 찾기
    const parentView = NAVIGATION_HIERARCHY[currentView];

    if (parentView) {
      setCurrentView(parentView);
    }
  };

  if (!isAuthenticated) {
    return <Login onLogin={handleLogin} />;
  }
  
  const renderContent = () => {
    switch(currentView) {
      case 'today-work':
        return <TodayWork
          onNavigateToView={navigateToView}
          onNavigateToComingSoon={navigateToComingSoon}
          userInfo={userInfo}
          showToast={showToast}
        />;
      case 'menu':
        return <MainMenu onSelectMenu={navigateToView} />;
      case 'work-management':
        return <Dashboard
          onNavigateToMenu={navigateToMenu}
          onNavigateToView={navigateToView}
          userInfo={userInfo}
          showToast={showToast}
        />;
      case 'work-order-detail':
        return selectedWorkItem ? (
          <WorkOrderDetail
            key={selectedWorkItem.id}
            order={selectedWorkItem}
            onBack={navigateBack}
            onStartWorkProcess={(order) => {
              setSelectedWorkItem(order);
              setCurrentView('work-process-flow');
            }}
            onComplete={(order) => {
              setSelectedWorkItem(order);
              setCurrentView('work-process-flow');
            }}
            showToast={showToast}
          />
        ) : <div>작업 상세 정보를 찾을 수 없습니다.</div>;
      case 'work-process-flow':
        return selectedWorkItem ? (
          <WorkProcessFlow
            workItem={selectedWorkItem}
            onComplete={() => {
              showToast('작업이 성공적으로 완료되었습니다.', 'success');
              setCurrentView('work-complete-detail');
            }}
            onBack={navigateBack}
            showToast={showToast}
          />
        ) : <div>작업 정보를 찾을 수 없습니다.</div>;
      case 'work-complete-form':
        return selectedWorkItem ? (
          <WorkCompleteRouter
            order={selectedWorkItem}
            onBack={navigateBack}
            onSuccess={() => {
              showToast('작업이 성공적으로 완료되었습니다.', 'success');
              setCurrentView('work-complete-detail');
            }}
            showToast={showToast}
          />
        ) : <div>작업 정보를 찾을 수 없습니다.</div>;
      case 'work-complete-detail':
        return selectedWorkItem ? (
          <WorkCompletionResult
            order={selectedWorkItem}
            onBack={() => {
              setSelectedWorkItem(null);
              setCurrentView('work-item-list');
            }}
          />
        ) : <div>작업 정보를 찾을 수 없습니다.</div>;
      case 'work-item-list':
        return selectedWorkDirection ? <WorkItemList direction={selectedWorkDirection} onBack={navigateBack} onNavigateToView={navigateToView} userId={userInfo?.userId} showToast={showToast} /> : <div>작업 목록을 찾을 수 없습니다.</div>;
      case 'customer-management':
        return <CustomerManagement onNavigateToMenu={navigateToMenu} />;
      case 'equipment-management':
        return <EquipmentManagementMenu onNavigateToMenu={navigateToMenu} />;
      case 'api-explorer':
        return <ApiExplorer />;
      case 'other-management':
        return <OtherManagement onNavigateToMenu={navigateToMenu} userInfo={userInfo} showToast={showToast} />;
      case 'coming-soon':
        return <ComingSoon onNavigateToMenu={navigateToMenu} title={comingSoonTitle} />;
      default:
        return <MainMenu onSelectMenu={navigateToView} />;
    }
  };

  const handleSidebarNavigate = (menu: string) => {
    switch (menu) {
      case 'today-work':
        navigateToView('today-work');
        break;
      case 'work-management':
        navigateToView('work-management');
        break;
      case 'customer-management':
        navigateToView('customer-management');
        break;
      case 'equipment-management':
        navigateToView('equipment-management');
        break;
      case 'other-management':
        navigateToView('other-management');
        break;
      case 'settings':
        navigateToComingSoon('설정');
        break;
      default:
        navigateToView('today-work');
    }
  };

  return (
    <QueryClientProvider client={queryClient}>
      <ErrorBoundary>
        <div className="h-[100dvh] bg-white font-sans overflow-hidden flex flex-col">
          <SideDrawer
            isOpen={isDrawerOpen}
            onClose={closeDrawer}
            userName={userInfo?.userName}
            userId={userInfo?.userId}
            stats={workStats}
            onLogout={handleLogout}
            onNavigate={handleSidebarNavigate}
          />
          <Header
            onLogout={handleLogout}
            onNavigateHome={navigateToMenu}
            onNavigateBack={navigateBack}
            onMenuClick={openDrawer}
            currentView={currentView}
            userInfo={userInfo}
            selectedWorkItem={selectedWorkItem}
          />
          <main className="flex-1 w-full max-w-7xl mx-auto pt-12 pb-[calc(52px+env(safe-area-inset-bottom,0px))] flex flex-col overflow-hidden">
            {renderContent()}
          </main>
          <BottomNavigation currentView={currentView} onSelectMenu={navigateToView} />
          {toast && (
            <Toast
              message={toast.message}
              type={toast.type}
              onClose={() => setToast(null)}
            />
          )}
          {/* 공지사항 팝업 */}
          <NoticePopup
            isOpen={showNoticePopup}
            onClose={() => setShowNoticePopup(false)}
          />
        </div>
      </ErrorBoundary>
      {/* React Query DevTools - 개발 환경에서만 표시 */}
      <ReactQueryDevtools initialIsOpen={false} />
    </QueryClientProvider>
  );
};

export default App;
