import React, { useState, useEffect } from 'react';
import { WorkOrder, WorkOrderStatus } from '../../types';
import { MapPinIcon } from '../icons/MapPinIcon';
import { PhoneIcon } from '../icons/PhoneIcon';
import { UserIcon } from '../icons/UserIcon';
import { PackageIcon } from '../icons/PackageIcon';
import { CalendarIcon } from '../icons/CalendarIcon';
import { InformationCircleIcon } from '../icons/InformationCircleIcon';
import { ChevronDownIcon } from '../icons/ChevronDownIcon';
import { cancelWork, getTechnicianEquipments } from '../../services/apiService';
import WorkCancelModal from '../work/WorkCancelModal';
import { getWorkTypeIcon, getWorkTypeIconColor } from '../../utils/workTypeIcons';
import { formatDate, formatTime, formatDateTimeFromISO } from '../../utils/dateFormatter';
import {
  isInstallWork,
  isASWork,
  isTerminationWork,
  isRemovalWork,
  isSuspensionWork,
  isProductChangeWork,
  isRelocationWork,
  getCompleteButtonText,
  getWorkTypeGuideMessage,
  validateContractStatus,
  isCancellable,
  WORK_STATUS_CODES
} from '../../utils/workValidation';
import ASWorkDetails from '../work/ASWorkDetails';
import InstallWorkDetails from '../work/InstallWorkDetails';
import TerminationWorkDetails from '../work/TerminationWorkDetails';
import SuspensionWorkDetails from '../work/SuspensionWorkDetails';
import ProductChangeWorkDetails from '../work/ProductChangeWorkDetails';
import RelocationWorkDetails from '../work/RelocationWorkDetails';

interface WorkOrderDetailProps {
  order: WorkOrder;
  onBack: () => void;
  onUpdateStatus?: (orderId: string, status: WorkOrderStatus) => void;
  onComplete?: (order: WorkOrder) => void;
  onStartWorkProcess?: (order: WorkOrder) => void; // 작업진행 버튼용
  showToast?: (message: string, type: 'success' | 'error' | 'warning' | 'info') => void;
}

const InfoRow: React.FC<{ label: string; value?: string; children?: React.ReactNode; icon?: React.ReactNode }> = ({ label, value, children, icon }) => (
  <div className="bg-gray-50 rounded-md px-3 py-2 flex items-center justify-between gap-3">
    <dt className="flex items-center gap-1.5 text-xs text-gray-700 font-semibold flex-shrink-0">
      {icon && <span className="text-gray-500">{icon}</span>}
      {label}
    </dt>
    <dd className="text-sm text-black font-semibold text-right break-words">{children || value}</dd>
  </div>
);

const WorkOrderDetail: React.FC<WorkOrderDetailProps> = ({
  order,
  onBack,
  onUpdateStatus,
  onComplete,
  onStartWorkProcess,
  showToast
}) => {
  // 작업 완료 여부 확인
  const isWorkCompleted = order.WRK_STAT_CD === '4' || order.status === WorkOrderStatus.Completed || order.status === '완료';

  // 작업 완료 시 계약정보 탭으로 시작, 아니면 info 탭
  const [activeTab, setActiveTab] = useState<'info' | 'equipment' | 'workflow'>(isWorkCompleted ? 'info' : 'info');
  const [isLoading, setIsLoading] = useState(false);
  const [showCancelModal, setShowCancelModal] = useState(false);

  // 안전점검 완료 여부 (작업 완료 시 true)
  const safetyInspectionCompleted = isWorkCompleted;

  // 장비 정보 미리 로드 (작업 상세 진입 시)
  useEffect(() => {
    const preloadEquipmentData = async () => {
      try {
        const userInfo = localStorage.getItem('userInfo');
        if (!userInfo) return;

        const user = JSON.parse(userInfo);
        const requestPayload = {
          WRKR_ID: 'A20130708',
          SO_ID: order.SO_ID || user.soId,
          WORK_ID: order.id,
          CUST_ID: order.customer?.id,
          RCPT_ID: order.RCPT_ID || null,
          CTRT_ID: order.CTRT_ID || null,
          CRR_ID: order.CRR_ID || null,
          ADDR_ORD: order.ADDR_ORD || null,
          CRR_TSK_CL: order.WRK_CD || '',
          WRK_DTL_TCD: order.WRK_DTL_TCD || '',
          WRK_CD: order.WRK_CD || null,
          WRK_STAT_CD: order.WRK_STAT_CD || null,
          WRK_DRCTN_ID: order.WRK_DRCTN_ID || order.directionId || null,
          BLD_ID: order.BLD_ID || null,
          PROD_CD: order.PROD_CD || null,
        };

        await getTechnicianEquipments(requestPayload);
      } catch (error) {
        // 에러 무시 (EquipmentManagement에서 재시도)
      }
    };

    preloadEquipmentData();
  }, [order.id]);

  const handleStartWork = () => {
    // 계약 상태 검증
    if (order.WRK_CD && order.CTRT_STAT) {
      const contractValidation = validateContractStatus(order.WRK_CD, order.CTRT_STAT);
      if (!contractValidation.valid) {
        if (showToast) {
          showToast(contractValidation.message || '계약 상태가 올바르지 않습니다.', 'error');
        }
        return;
      }
    }

    // 4단계 작업 프로세스로 이동
    if (onStartWorkProcess) {
      onStartWorkProcess(order);
    } else if (onComplete) {
      // fallback
      onComplete(order);
    }
  };

  const handleCancelClick = () => {
    // 작업 취소 가능 여부 확인
    if (order.WRK_STAT_CD && !isCancellable(order.WRK_STAT_CD)) {
      if (showToast) {
        showToast('접수 또는 할당 상태에서만 작업을 취소할 수 있습니다.', 'warning');
      }
      return;
    }

    setShowCancelModal(true);
  };

  const handleCancelConfirm = async (cancelData: any) => {
    setIsLoading(true);
    setShowCancelModal(false);
    
    try {
      const result = await cancelWork(cancelData);
      
      if (result.code === "SUCCESS" || result.code === "OK") {
        if (showToast) showToast('작업이 성공적으로 취소되었습니다.', 'success');
        if (onUpdateStatus) onUpdateStatus(order.id, WorkOrderStatus.Cancelled);
      } else {
        if (showToast) showToast(`작업취소 실패: ${result.message}`, 'error');
      }
    } catch (error: any) {
      if (showToast) showToast(error.message || '작업취소 중 오류가 발생했습니다.', 'error');
      console.error('작업취소 오류:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const TabButton: React.FC<{tabId: 'info' | 'equipment' | 'workflow', title: string, icon: React.ReactNode}> = ({tabId, title, icon}) => {
    // 작업 완료 시 모든 탭에 체크 표시
    const showCheck = isWorkCompleted;
    const isActive = activeTab === tabId;

    return (
      <button
        onClick={() => setActiveTab(tabId)}
        className={`relative px-4 sm:px-6 py-3 sm:py-3.5 text-sm sm:text-base font-semibold transition-all duration-200 flex items-center gap-2 ${
          isActive
            ? 'text-blue-600 bg-blue-50'
            : isWorkCompleted
            ? 'text-green-600 bg-green-50 hover:text-green-700 hover:bg-green-100'
            : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
        }`}
      >
        {showCheck ? (
          <svg className={`w-5 h-5 ${isActive ? 'text-blue-600' : 'text-green-600'}`} fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
          </svg>
        ) : (
          icon
        )}
        {title}
        {isActive && (
          <div className={`absolute bottom-0 left-0 right-0 h-1 rounded-t-lg ${isWorkCompleted ? 'bg-blue-600' : 'bg-blue-600'}`}></div>
        )}
      </button>
    );
  };

  const WorkTypeIcon = getWorkTypeIcon(order.typeDisplay);
  const iconColorClass = getWorkTypeIconColor(order.typeDisplay);

  // 작업 유형별 색상 가져오기
  const getWorkTypeColor = (wrkCd?: string) => {
    if (!wrkCd) return 'bg-blue-500';

    if (isInstallWork(wrkCd)) return 'bg-green-600';
    if (isASWork(wrkCd)) return 'bg-orange-500';
    if (isTerminationWork(wrkCd) || isRemovalWork(wrkCd)) return 'bg-red-600';
    if (isRelocationWork(wrkCd)) return 'bg-blue-600';
    if (isProductChangeWork(wrkCd)) return 'bg-purple-600';
    if (isSuspensionWork(wrkCd)) return 'bg-gray-600';

    return 'bg-blue-500';
  };

  return (
    <div className="h-full flex flex-col bg-gray-50 overflow-hidden">
      {/* 스크롤 가능한 콘텐츠 영역 */}
      <div className="flex-1 overflow-y-auto pb-40">
      {/* 메인 카드 */}
      <div className="bg-white overflow-hidden max-w-4xl mx-auto">
        {/* 상단 헤더 - 심플한 블루 디자인 */}
        <div className="bg-blue-600 px-4 py-4 text-white">

          {/* 첫번째 줄: 고객명과 상태 */}
          <div className="flex items-center justify-between gap-3 mb-3">
            <div className="flex items-center gap-3 flex-1 min-w-0">
              <div className={`flex-shrink-0 w-10 h-10 rounded-lg bg-white/20 flex items-center justify-center`}>
                <WorkTypeIcon className="w-5 h-5 text-white" />
              </div>
              <div className="flex items-center gap-2 flex-1 min-w-0">
                <h1 className="text-xl font-bold text-white truncate">{order.customer.name}</h1>
                {order.customer.isVip && (
                  <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-bold bg-yellow-400 text-yellow-900 flex-shrink-0">
                    {order.customer.vipLevel || 'VIP'}
                  </span>
                )}
              </div>
            </div>
            <span className={`inline-flex items-center px-3 py-1.5 rounded-full text-sm font-bold flex-shrink-0 ${
              order.status === '진행중' ? 'bg-yellow-400 text-yellow-900' :
              order.status === '완료' ? 'bg-green-400 text-green-900' :
              'bg-red-400 text-red-900'
            }`}>
              {order.status}
            </span>
          </div>

          {/* 두번째 줄: 작업 타입과 일정 */}
          <div className="flex items-center justify-between text-sm">
            <span className="inline-flex items-center px-3 py-1 rounded-md font-semibold bg-white/20 border border-white/30">
              {order.typeDisplay}
            </span>
            <div className="text-right flex items-center gap-1.5">
              <CalendarIcon className="w-4 h-4 text-white/80" />
              <span className="font-semibold">
                {formatDateTimeFromISO(order.scheduledAt)}
              </span>
            </div>
          </div>
        </div>

        {/* 탭 네비게이션 - 개선된 디자인 */}
        <div className="border-b-2 border-gray-200 bg-white shadow-sm">
          <div className="flex overflow-x-auto">
            <TabButton tabId="info" title="고객/작업 정보" icon={<UserIcon className="w-5 h-5" />} />
            <TabButton tabId="equipment" title="할당 장비" icon={<PackageIcon className="w-5 h-5" />} />
            <TabButton tabId="workflow" title="작업 진행" icon={<svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" /></svg>} />
          </div>
        </div>

        {/* 콘텐츠 영역 */}
        <div className="px-4 sm:px-6 py-4 sm:py-6 pb-28">
          {activeTab === 'info' && (
            <div className="space-y-4">
              {/* 작업 유형별 안내 메시지 - 심플한 디자인 */}
              {order.WRK_CD && (
                <div className={`${getWorkTypeColor(order.WRK_CD)} rounded-lg p-4`}>
                  <div className="flex items-start gap-3">
                    <div className="flex-shrink-0 w-8 h-8 bg-white/20 rounded-lg flex items-center justify-center">
                      <InformationCircleIcon className="w-5 h-5 text-white" />
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-semibold text-white leading-relaxed">
                        {getWorkTypeGuideMessage(order.WRK_CD)}
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* 기본 정보 섹션 */}
              <div className="space-y-3">
                <h3 className="text-base font-bold text-gray-700 mb-3 flex items-center gap-2 px-1">
                  <div className="w-1 h-5 bg-blue-600 rounded-full"></div>
                  기본 정보
                </h3>

                {/* 작지서ID & 작업ID */}
                <InfoRow
                  label="작지서ID"
                  value={order.directionId || order.id}
                  icon={<InformationCircleIcon className="w-4 h-4" />}
                />
                <InfoRow
                  label="작업ID"
                  value={order.id}
                  icon={<InformationCircleIcon className="w-4 h-4" />}
                />
                <InfoRow
                  label="접수ID"
                  value={order.RCPT_ID || '-'}
                  icon={<InformationCircleIcon className="w-4 h-4" />}
                />

                <InfoRow
                  label="작업 유형"
                  value={order.typeDisplay}
                  icon={<WorkTypeIcon className="w-4 h-4" />}
                />

                {/* 우선순위 표시 */}
                {order.WRK_CD && (
                  <InfoRow
                    label="작업 우선순위"
                    icon={<svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                      <path d="M10 2a1 1 0 011 1v1.323l3.954 1.582 1.599-.8a1 1 0 01.894 1.79l-1.233.616 1.738 5.42a1 1 0 01-.285 1.05A3.989 3.989 0 0115 15a3.989 3.989 0 01-2.667-1.019 1 1 0 01-.285-1.05l1.738-5.42-1.233-.617a1 1 0 01.894-1.788l1.599.799L11 4.323V3a1 1 0 011-1h-2zm-5 8.274l-.818 2.552c-.25.78.409 1.565 1.237 1.474L9 13.796l3.581.504c.828.091 1.487-.694 1.237-1.474l-.818-2.552-3-1.2-3 1.2z"/>
                    </svg>}
                  >
                    <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-bold ${
                      isInstallWork(order.WRK_CD) ? 'bg-red-100 text-red-800' :
                      isASWork(order.WRK_CD) ? 'bg-yellow-100 text-yellow-800' :
                      'bg-blue-100 text-blue-800'
                    }`}>
                      {isInstallWork(order.WRK_CD) ? '높음 (신규개통)' :
                       isASWork(order.WRK_CD) ? '중간 (A/S)' : '보통'}
                    </span>
                  </InfoRow>
                )}

                {/* 계약 상태 */}
                {order.CTRT_STAT && (
                  <InfoRow
                    label="계약 상태"
                    icon={<InformationCircleIcon className="w-4 h-4" />}
                  >
                    <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-bold ${
                      order.CTRT_STAT === '20' ? 'bg-green-100 text-green-800' :
                      order.CTRT_STAT === '10' ? 'bg-blue-100 text-blue-800' :
                      order.CTRT_STAT === '30' ? 'bg-yellow-100 text-yellow-800' :
                      'bg-gray-100 text-gray-800'
                    }`}>
                      {order.CTRT_STAT === '20' ? '정상' :
                       order.CTRT_STAT === '10' ? '설치예정' :
                       order.CTRT_STAT === '30' ? '일시정지' :
                       order.CTRT_STAT === '90' ? '해지완료' : `상태코드: ${order.CTRT_STAT}`}
                    </span>
                  </InfoRow>
                )}

                {order.CTRT_ID && (
                  <InfoRow
                    label="계약ID"
                    value={order.CTRT_ID}
                    icon={<InformationCircleIcon className="w-4 h-4" />}
                  />
                )}
              </div>

              {/* 고객 정보 섹션 */}
              <div className="space-y-3 mt-6">
                <h3 className="text-base font-bold text-gray-700 mb-3 flex items-center gap-2 px-1">
                  <div className="w-1 h-5 bg-blue-600 rounded-full"></div>
                  고객 정보
                </h3>

                <InfoRow
                  label="고객명"
                  value={order.customer.name}
                  icon={<UserIcon className="w-4 h-4" />}
                />
                <InfoRow
                  label="연락처"
                  icon={<PhoneIcon className="w-4 h-4" />}
                >
                    <div className="flex flex-col xs:flex-row items-start xs:items-center justify-between gap-2 xs:gap-2 w-full">
                        <span className="text-gray-900 font-medium flex-1 min-w-0 break-all">{order.customer.phone || '정보 없음'}</span>
                        <button
                            onClick={() => { if (showToast) showToast('전화 기능은 준비 중입니다.', 'info'); }}
                            className="flex-shrink-0 w-full xs:w-9 py-2 xs:py-0 xs:h-9 rounded-full bg-blue-600 hover:bg-blue-700 active:bg-blue-800 transition-all duration-200 shadow-sm hover:shadow-md disabled:opacity-50 disabled:cursor-not-allowed active:scale-95 flex items-center justify-center gap-1.5"
                            disabled={!order.customer.phone}
                        >
                            <PhoneIcon className="h-4 w-4 text-white"/>
                            <span className="xs:hidden text-white text-sm font-medium">전화 걸기</span>
                        </button>
                    </div>
                </InfoRow>
                <InfoRow
                  label="설치 주소"
                  icon={<MapPinIcon className="w-4 h-4" />}
                 >
                    <div className="flex flex-col xs:flex-row items-start justify-between gap-2 xs:gap-2 w-full">
                        <span className="text-gray-900 flex-1 min-w-0 leading-relaxed break-all">{order.customer.address}</span>
                        <button
                            onClick={() => { if (showToast) showToast('지도 보기 기능은 준비 중입니다.', 'info'); }}
                            className="flex-shrink-0 w-full xs:w-9 py-2 xs:py-0 xs:h-9 rounded-full bg-blue-600 hover:bg-blue-700 active:bg-blue-800 transition-all duration-200 shadow-sm hover:shadow-md active:scale-95 xs:mt-0.5 flex items-center justify-center gap-1.5"
                        >
                            <MapPinIcon className="h-4 w-4 text-white"/>
                            <span className="xs:hidden text-white text-sm font-medium">지도 보기</span>
                        </button>
                    </div>
                </InfoRow>

                {order.installLocation && (
                  <InfoRow
                    label="설치 위치 상세"
                    value={order.installLocation}
                    icon={<MapPinIcon className="w-4 h-4" />}
                  />
                )}

                {order.cellNo && (
                  <InfoRow
                    label="CELL NO"
                    value={order.cellNo}
                    icon={<InformationCircleIcon className="w-4 h-4" />}
                  />
                )}
              </div>

              {/* 일정 정보 섹션 */}
              <div className="space-y-3 mt-6">
                <h3 className="text-base font-bold text-gray-700 mb-3 flex items-center gap-2 px-1">
                  <div className="w-1 h-5 bg-blue-600 rounded-full"></div>
                  일정 정보
                </h3>

                <InfoRow
                  label="예정 일시"
                  value={formatDateTimeFromISO(order.scheduledAt)}
                  icon={<CalendarIcon className="w-4 h-4" />}
                />

                {/* 접수일은 예정일과 다를 수 있으므로 별도 표시 */}
                <InfoRow
                  label="접수일"
                  value={formatDate(order.scheduledAt)}
                  icon={<CalendarIcon className="w-4 h-4" />}
                />

                <InfoRow
                  label="작업 상세"
                  icon={<InformationCircleIcon className="w-4 h-4" />}
                >
                  <div className="bg-gray-50 p-4 rounded-lg border-l-4 border-blue-600 w-full">
                    <p className="text-gray-800 whitespace-pre-wrap leading-relaxed">{order.details}</p>
                  </div>
                </InfoRow>
              </div>

              {/* 작업 유형별 특화 정보 - 분기처리 */}
              {(isASWork(order.WRK_CD) || isInstallWork(order.WRK_CD) || isTerminationWork(order.WRK_CD) ||
                isRemovalWork(order.WRK_CD) || isSuspensionWork(order.WRK_CD) || isProductChangeWork(order.WRK_CD) ||
                isRelocationWork(order.WRK_CD)) && (
                <div className="mt-6 pt-6 border-t-2 border-gray-200">
                  <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
                    <div className="w-1 h-6 bg-blue-600 rounded-full"></div>
                    작업 상세 정보
                  </h3>
                  {isASWork(order.WRK_CD) && <ASWorkDetails order={order} />}
                  {isInstallWork(order.WRK_CD) && <InstallWorkDetails order={order} />}
                  {(isTerminationWork(order.WRK_CD) || isRemovalWork(order.WRK_CD)) && <TerminationWorkDetails order={order} />}
                  {isSuspensionWork(order.WRK_CD) && <SuspensionWorkDetails order={order} />}
                  {isProductChangeWork(order.WRK_CD) && <ProductChangeWorkDetails order={order} />}
                  {isRelocationWork(order.WRK_CD) && <RelocationWorkDetails order={order} />}
                </div>
              )}
              
              {/* 작업 안내 메시지 */}
              {order.status === WorkOrderStatus.Pending && (
                <div className="mt-8 pt-6 border-t-2 border-gray-200">
                  <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border-l-4 border-blue-600 p-5 rounded-lg shadow-sm">
                    <div className="flex items-start gap-4">
                      <div className="flex-shrink-0">
                        <div className="w-12 h-12 bg-blue-600 rounded-full flex items-center justify-center">
                          <svg className="w-7 h-7 text-white" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M11.3 1.046A1 1 0 0112 2v5h4a1 1 0 01.82 1.573l-7 10A1 1 0 018 18v-5H4a1 1 0 01-.82-1.573l7-10a1 1 0 011.12-.38z" clipRule="evenodd" />
                          </svg>
                        </div>
                      </div>
                      <div className="flex-1">
                        <h3 className="text-lg font-bold text-gray-900 mb-2">
                          작업을 시작하시겠습니까?
                        </h3>
                        <p className="text-sm text-gray-700 leading-relaxed mb-3">
                          {getWorkTypeGuideMessage(order.WRK_CD)}
                        </p>
                        <div className="flex flex-col sm:flex-row gap-2 text-xs text-gray-600">
                          <div className="flex items-center gap-1.5">
                            <svg className="w-4 h-4 text-blue-600" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                            </svg>
                            <span>계약 정보 확인</span>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <svg className="w-4 h-4 text-blue-600" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                            </svg>
                            <span>장비 등록/설치</span>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <svg className="w-4 h-4 text-blue-600" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                            </svg>
                            <span>작업 완료</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab === 'equipment' && (
            <div>
              <h3 className="text-base font-bold text-gray-700 mb-4 flex items-center gap-2 px-1">
                <div className="w-1 h-5 bg-blue-600 rounded-full"></div>
                할당 장비 목록
              </h3>

              {order.assignedEquipment.length > 0 ? (
                  <div className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {order.assignedEquipment.map(eq => {
                          // 장비 유형별 아이콘 색상 및 레이블
                          const getEquipmentInfo = (itemMidCd?: string) => {
                            if (itemMidCd === '04') return { color: 'bg-blue-600', label: '모뎀', status: '정상' };
                            if (itemMidCd === '05') return { color: 'bg-purple-600', label: '셋톱박스', status: '정상' };
                            if (itemMidCd === '07') return { color: 'bg-orange-500', label: '특수장비', status: '정상' };
                            if (itemMidCd === '03') return { color: 'bg-green-600', label: '추가장비', status: '정상' };
                            return { color: 'bg-gray-600', label: '기타', status: '정상' };
                          };

                          const eqInfo = getEquipmentInfo(eq.itemMidCd);

                          return (
                            <div
                              key={eq.id}
                              className="bg-white rounded-lg shadow-sm hover:shadow-md transition-all duration-200 p-4 border border-gray-200 hover:border-blue-300"
                            >
                              <div className="flex items-start gap-3">
                                <div className={`flex-shrink-0 w-10 h-10 rounded-lg ${eqInfo.color} flex items-center justify-center`}>
                                  <PackageIcon className="w-5 h-5 text-white" />
                                </div>
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-start justify-between gap-2">
                                    <p className="font-bold text-gray-800 text-base">{eq.type}</p>
                                    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-bold bg-green-100 text-green-800 flex-shrink-0">
                                      {eqInfo.status}
                                    </span>
                                  </div>
                                  <p className="text-sm text-gray-600 mt-0.5">{eq.model}</p>
                                  <div className="mt-2 pt-2 border-t border-gray-100">
                                    <p className="text-xs text-gray-500 font-mono">S/N: {eq.serialNumber}</p>
                                    {eq.itemMidCd && (
                                      <p className="text-xs text-gray-500 mt-0.5">유형: {eqInfo.label}</p>
                                    )}
                                  </div>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                    </div>

                  </div>
              ) : (
                  <div className="bg-gray-50 rounded-lg p-8 text-center">
                    <PackageIcon className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                    <p className="text-gray-500 text-sm">할당된 장비가 없습니다.</p>
                    <p className="text-gray-400 text-xs mt-2">작업진행 버튼을 눌러 장비를 등록하세요.</p>
                  </div>
              )}
            </div>
          )}

          {activeTab === 'workflow' && (
            <div>
              <h3 className="text-base font-bold text-gray-700 mb-3 flex items-center gap-2 px-1">
                <div className="w-1 h-5 bg-blue-600 rounded-full"></div>
                작업 진행 현황
              </h3>

              {/* 전체 진행률 요약 - 상단으로 이동 */}
              <div className="mb-4 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg p-4 border border-blue-200">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-sm font-bold text-gray-800">전체 진행률</p>
                  <p className="text-lg font-bold text-blue-600">
                    {isWorkCompleted ? '100%' :
                     safetyInspectionCompleted && order.assignedEquipment.length > 0 ? '50%' :
                     safetyInspectionCompleted ? '25%' : '0%'}
                  </p>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2.5">
                  <div
                    className="bg-gradient-to-r from-blue-600 to-indigo-600 h-2.5 rounded-full transition-all duration-500 shadow-sm"
                    style={{
                      width: `${
                        isWorkCompleted ? 100 :
                        safetyInspectionCompleted && order.assignedEquipment.length > 0 ? 50 :
                        safetyInspectionCompleted ? 25 : 0
                      }%`
                    }}
                  ></div>
                </div>
                <p className="text-xs text-gray-600 mt-1.5">
                  {isWorkCompleted ? '모든 작업이 완료되었습니다' :
                   safetyInspectionCompleted && order.assignedEquipment.length > 0 ? '작업이 순조롭게 진행 중입니다' :
                   safetyInspectionCompleted ? '안전점검이 완료되었습니다' : '작업을 시작해주세요'}
                </p>
              </div>

              {/* 워크플로우 스텝 표시 */}
              <div className="space-y-3">
                {/* 안전점검 단계 */}
                <div className={`rounded-lg border-2 p-3.5 transition-all duration-200 ${
                  safetyInspectionCompleted
                    ? 'bg-green-50 border-green-500 shadow-sm'
                    : !safetyInspectionCompleted && !order.assignedEquipment.length && order.status !== WorkOrderStatus.Completed
                    ? 'bg-blue-50 border-blue-500 shadow-md ring-2 ring-blue-200'
                    : 'bg-gray-50 border-gray-300'
                }`}>
                  <div className="flex items-start gap-3">
                    <div className={`flex-shrink-0 w-9 h-9 rounded-full flex items-center justify-center shadow-sm ${
                      safetyInspectionCompleted ? 'bg-green-500' :
                      !safetyInspectionCompleted && !order.assignedEquipment.length && order.status !== WorkOrderStatus.Completed
                      ? 'bg-blue-500 animate-pulse' : 'bg-gray-400'
                    }`}>
                      {safetyInspectionCompleted ? (
                        <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                        </svg>
                      ) : (
                        <span className="text-white font-bold text-sm">1</span>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <p className={`font-bold text-sm ${
                          safetyInspectionCompleted ? 'text-green-800' :
                          !safetyInspectionCompleted && !order.assignedEquipment.length && order.status !== WorkOrderStatus.Completed
                          ? 'text-blue-800' : 'text-gray-700'
                        }`}>
                          안전점검
                        </p>
                        {safetyInspectionCompleted ? (
                          <span className="text-xs font-semibold text-green-700 bg-green-100 px-2 py-0.5 rounded-full">완료</span>
                        ) : !safetyInspectionCompleted && !order.assignedEquipment.length && order.status !== WorkOrderStatus.Completed ? (
                          <span className="text-xs font-semibold text-blue-700 bg-blue-100 px-2 py-0.5 rounded-full animate-pulse">진행 필요</span>
                        ) : (
                          <span className="text-xs font-semibold text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">대기</span>
                        )}
                      </div>
                      <p className="text-xs text-gray-600 leading-relaxed">
                        {safetyInspectionCompleted ? '안전점검이 완료되었습니다.' : '작업 전 안전점검을 완료해주세요.'}
                      </p>
                    </div>
                  </div>
                </div>

                {/* 장비설치 단계 */}
                <div className={`rounded-lg border-2 p-3.5 transition-all duration-200 ${
                  isWorkCompleted || order.assignedEquipment.length > 0
                    ? 'bg-green-50 border-green-500 shadow-sm'
                    : safetyInspectionCompleted && !order.assignedEquipment.length && order.status !== WorkOrderStatus.Completed
                    ? 'bg-blue-50 border-blue-500 shadow-md ring-2 ring-blue-200'
                    : 'bg-gray-50 border-gray-300'
                }`}>
                  <div className="flex items-start gap-3">
                    <div className={`flex-shrink-0 w-9 h-9 rounded-full flex items-center justify-center shadow-sm ${
                      isWorkCompleted || order.assignedEquipment.length > 0 ? 'bg-green-500' :
                      safetyInspectionCompleted && !order.assignedEquipment.length && order.status !== WorkOrderStatus.Completed
                      ? 'bg-blue-500 animate-pulse' : 'bg-gray-400'
                    }`}>
                      {isWorkCompleted || order.assignedEquipment.length > 0 ? (
                        <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                        </svg>
                      ) : (
                        <span className="text-white font-bold text-sm">2</span>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <p className={`font-bold text-sm ${
                          isWorkCompleted || order.assignedEquipment.length > 0 ? 'text-green-800' :
                          safetyInspectionCompleted && !order.assignedEquipment.length && order.status !== WorkOrderStatus.Completed
                          ? 'text-blue-800' : 'text-gray-700'
                        }`}>
                          장비 설치
                        </p>
                        {isWorkCompleted || order.assignedEquipment.length > 0 ? (
                          <span className="text-xs font-semibold text-green-700 bg-green-100 px-2 py-0.5 rounded-full">완료</span>
                        ) : safetyInspectionCompleted && !order.assignedEquipment.length && order.status !== WorkOrderStatus.Completed ? (
                          <span className="text-xs font-semibold text-blue-700 bg-blue-100 px-2 py-0.5 rounded-full animate-pulse">진행 필요</span>
                        ) : (
                          <span className="text-xs font-semibold text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">대기</span>
                        )}
                      </div>
                      <p className="text-xs text-gray-600 leading-relaxed">
                        {order.assignedEquipment.length > 0
                          ? `${order.assignedEquipment.length}개 장비가 할당되었습니다.`
                          : '장비를 할당하고 설치해주세요.'}
                      </p>
                    </div>
                  </div>
                </div>

                {/* 집선조회 단계 - 네트워크 설정 */}
                <div className={`rounded-lg border-2 p-3.5 transition-all duration-200 ${
                  isWorkCompleted
                    ? 'bg-green-50 border-green-500 shadow-sm'
                    : 'bg-gray-50 border-gray-300'
                }`}>
                  <div className="flex items-start gap-3">
                    <div className={`flex-shrink-0 w-9 h-9 rounded-full flex items-center justify-center shadow-sm ${
                      isWorkCompleted ? 'bg-green-500' : 'bg-gray-400'
                    }`}>
                      {isWorkCompleted ? (
                        <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                        </svg>
                      ) : (
                        <span className="text-white font-bold text-sm">3</span>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <p className={`font-bold text-sm ${isWorkCompleted ? 'text-green-800' : 'text-gray-700'}`}>
                          집선조회 / 네트워크 설정
                        </p>
                        {isWorkCompleted ? (
                          <span className="text-xs font-semibold text-green-700 bg-green-100 px-2 py-0.5 rounded-full">완료</span>
                        ) : (
                          <span className="text-xs font-semibold text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">선택</span>
                        )}
                      </div>
                      <p className="text-xs text-gray-600 leading-relaxed">
                        LGU 청약 등록 및 네트워크 설정 (선택사항)
                      </p>
                    </div>
                  </div>
                </div>

                {/* 작업완료 단계 */}
                <div className={`rounded-lg border-2 p-3.5 transition-all duration-200 ${
                  isWorkCompleted
                    ? 'bg-green-50 border-green-500 shadow-sm'
                    : safetyInspectionCompleted && order.assignedEquipment.length > 0 && order.status !== WorkOrderStatus.Completed
                    ? 'bg-blue-50 border-blue-500 shadow-md ring-2 ring-blue-200'
                    : 'bg-gray-50 border-gray-300'
                }`}>
                  <div className="flex items-start gap-3">
                    <div className={`flex-shrink-0 w-9 h-9 rounded-full flex items-center justify-center shadow-sm ${
                      isWorkCompleted ? 'bg-green-500' :
                      safetyInspectionCompleted && order.assignedEquipment.length > 0 && order.status !== WorkOrderStatus.Completed
                      ? 'bg-blue-500 animate-pulse' : 'bg-gray-400'
                    }`}>
                      {isWorkCompleted ? (
                        <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                        </svg>
                      ) : (
                        <span className="text-white font-bold text-sm">4</span>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <p className={`font-bold text-sm ${
                          isWorkCompleted ? 'text-green-800' :
                          safetyInspectionCompleted && order.assignedEquipment.length > 0 && order.status !== WorkOrderStatus.Completed
                          ? 'text-blue-800' : 'text-gray-700'
                        }`}>
                          작업 완료 처리
                        </p>
                        {isWorkCompleted ? (
                          <span className="text-xs font-semibold text-green-700 bg-green-100 px-2 py-0.5 rounded-full">완료</span>
                        ) : safetyInspectionCompleted && order.assignedEquipment.length > 0 && order.status !== WorkOrderStatus.Completed ? (
                          <span className="text-xs font-semibold text-blue-700 bg-blue-100 px-2 py-0.5 rounded-full animate-pulse">진행 필요</span>
                        ) : (
                          <span className="text-xs font-semibold text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">대기</span>
                        )}
                      </div>
                      <p className="text-xs text-gray-600 leading-relaxed">
                        {isWorkCompleted
                          ? '모든 작업이 완료되었습니다.'
                          : '모든 단계 완료 후 작업완료 버튼을 눌러주세요.'}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 작업취소 모달 */}
      <WorkCancelModal
        isOpen={showCancelModal}
        onClose={() => setShowCancelModal(false)}
        onConfirm={handleCancelConfirm}
        workOrder={order}
        showToast={showToast}
      />

      </div>
      {/* 콘텐츠 영역 끝 */}

      {/* 고정 하단 액션 바 - 모바일 최적화 */}
      {order.status === WorkOrderStatus.Pending && (
        <div className="fixed left-0 right-0 bg-white border-t border-gray-200 shadow-2xl z-50" style={{ bottom: '68px' }}>
          <div className="max-w-4xl mx-auto px-3 py-2">
            <div className="flex items-center gap-2.5">
              {/* 작업취소 버튼 */}
              <button
                onClick={handleCancelClick}
                disabled={isLoading}
                className="flex-shrink-0 w-24 px-4 py-3 bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800 text-white rounded-xl font-bold transition-all duration-200 flex flex-col items-center justify-center gap-0.5 shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed active:scale-95"
              >
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                </svg>
                <span className="text-xs font-bold">{isLoading ? '취소중' : '취소'}</span>
              </button>

              {/* 작업진행 버튼 - 메인 */}
              <button
                onClick={handleStartWork}
                className="flex-1 px-6 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-xl font-bold transition-all duration-200 flex items-center justify-center gap-2 shadow-lg hover:shadow-xl active:scale-[0.98]"
              >
                <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M11.3 1.046A1 1 0 0112 2v5h4a1 1 0 01.82 1.573l-7 10A1 1 0 018 18v-5H4a1 1 0 01-.82-1.573l7-10a1 1 0 011.12-.38z" clipRule="evenodd" />
                </svg>
                <div className="flex flex-col items-start">
                  <span className="text-base leading-tight font-bold">작업진행</span>
                  <span className="text-[10px] opacity-90 leading-tight">{order.typeDisplay}</span>
                </div>
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default WorkOrderDetail;