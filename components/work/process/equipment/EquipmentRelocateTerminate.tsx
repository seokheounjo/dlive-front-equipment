/**
 * 이전철거 작업 (WRK_CD=08) 전용 장비정보 컴포넌트
 *
 * 레거시 참조: mowoa03m08.xml
 *
 * 상태 관리:
 * - Zustand (useWorkEquipmentStore): 클라이언트 상태 (철거 장비, 분실/파손/재사용 체크박스)
 * - localStorage persist: Zustand middleware로 자동 저장
 *
 * 기능:
 * - 철거 대상 장비 목록 표시 (API output5)
 * - 재사용 체크박스 (레거시 조건: MVM_TP='3' && WRK_STAT_CD='2' && 계약변경 시만 표시)
 * - 분실/파손 체크박스 (장비분실, 아답터분실, 리모콘분실, 케이블분실, 크래들분실)
 * - 재사용 선택 시 분실 체크박스 비활성화
 * - 고객소유 장비는 분실처리 불가
 *
 * 철거(WRK_CD=02)와의 차이점:
 * - 재사용 체크박스 있음
 * - 재사용/분실 상호배타 로직
 */

import React, { useEffect, useState } from 'react';
import { RotateCcw, RefreshCw } from 'lucide-react';
import { getTechnicianEquipments, getMoveWorkInfo } from '../../../../services/apiService';
import { useWorkEquipmentStore, useWorkEquipment } from '../../../../stores/workEquipmentStore';
import {
  EquipmentComponentProps,
  ExtendedEquipment,
  isCustomerOwnedEquipment,
} from './shared/types';

const EquipmentRelocateTerminate: React.FC<EquipmentComponentProps> = ({
  workItem,
  onSave,
  onBack,
  showToast,
  preloadedApiData,
  onPreloadedDataUpdate,
  readOnly = false
}) => {
  const workId = workItem.id;

  // 작업 완료 여부 확인
  const isWorkCompleted = readOnly || workItem.WRK_STAT_CD === '4' || workItem.status === '완료';

  // Work Equipment Store - Actions
  const {
    initWorkState,
    setApiData,
    setDataLoaded: storeSetDataLoaded,
    toggleRemovalStatus,
    setFullRemovalStatus,
    setRemovalStatus,
    setReuseAll: storeSetReuseAll,
  } = useWorkEquipmentStore();

  // Work Equipment Store - State (현재 작업)
  const {
    removeEquipments,
    removalStatus,
    isReady: isDataLoaded,
  } = useWorkEquipment(workId);

  // 새로고침 상태
  const [isRefreshing, setIsRefreshing] = useState(false);

  // 전체재사용 체크박스 표시 여부 (WRK_STAT_CD='2' && CTRT_ID != OLD_CTRT_ID)
  const [showReuseCheckbox, setShowReuseCheckbox] = useState(false);

  // Store에서 reuseAll 상태 가져오기 (완료 단계와 공유)
  const reuseAll = useWorkEquipmentStore(
    (store) => store.workStates[workId]?.reuseAll ?? false
  );

  // 전체 재사용 체크박스 토글 핸들러
  const setReuseAll = (value: boolean) => {
    storeSetReuseAll(workId, value);
  };

  // 전체재사용 표시 조건 확인 (레거시: mowoa03m08.xml 592-601)
  // WRK_STAT_CD='2' && CTRT_ID != OLD_CTRT_ID 일 때만 표시
  const checkReuseCondition = async (autoSet: boolean) => {
    try {
      const userInfo = localStorage.getItem('userInfo');
      const user = userInfo ? JSON.parse(userInfo) : {};
      const moveInfo = await getMoveWorkInfo({
        RCPT_ID: workItem.RCPT_ID || '',
        CTRT_ID: workItem.CTRT_ID || '',
        CRR_ID: workItem.CRR_ID || '',
        WRKR_ID: workItem.WRKR_ID || user.userId || '',
        PROD_CD: workItem.PROD_CD || '',
        CRR_TSK_CL: '02',
        WRK_ID: workItem.id || '',
        ADDR_ORD: (workItem as any).ADDR_ORD || workItem.customer?.ADDR_ORD || '',
        WRK_CD: workItem.WRK_CD || '08',
        WRK_STAT_CD: workItem.WRK_STAT_CD || '',
      });

      const mvmTp = moveInfo?.MVM_TP || '';
      const wrkStatCd = moveInfo?.WRK_STAT_CD || '';
      const ctrtId = moveInfo?.CTRT_ID || '';
      const oldCtrtId = moveInfo?.OLD_CTRT_ID || '';
      const shouldShow = wrkStatCd === '2';

      setShowReuseCheckbox(shouldShow);
      console.log('[장비관리-이전철거] 전체재사용 조건:', {
        WRK_STAT_CD: wrkStatCd,
        CTRT_ID: ctrtId, OLD_CTRT_ID: oldCtrtId, 표시: shouldShow,
      });

      // 최초 로드 시에만 자동 설정 (탭 복귀 시에는 사용자 설정 유지)
      if (autoSet) {
        if (shouldShow) {
          // 조건 충족: 기본값 체크됨 (레거시: chk_reuse_yn.Value = "Y")
          storeSetReuseAll(workId, true);
          console.log('[장비관리-이전철거] 전체재사용 자동 설정: true');
        } else {
          // 조건 불충족: 재사용 해제 (레거시: chk_reuse_yn.Value = "N")
          storeSetReuseAll(workId, false);
        }
      }
    } catch (err) {
      console.error('[장비관리-이전철거] 이전설치정보 조회 실패:', err);
      setShowReuseCheckbox(false);
      if (autoSet) storeSetReuseAll(workId, false);
    }
  };

  // 초기화 및 데이터 로드
  useEffect(() => {
    const isFirstLoad = !isDataLoaded || removeEquipments.length === 0;
    // 전체재사용 조건 확인 (항상 실행 - 탭 복귀 시에도 체크박스 표시/숨김 필요)
    checkReuseCondition(isFirstLoad);

    // 이미 데이터가 로드된 상태면 장비 로딩 건너뜀
    if (!isFirstLoad) {
      console.log('[장비관리-이전철거] 이미 데이터 로드됨 - 기존 데이터 유지, reuseAll:', reuseAll);
      return;
    }
    initWorkState(workId);
    loadEquipmentData();
  }, [workItem.id]);

  // 장비 데이터 로드
  const loadEquipmentData = async (forceRefresh = false) => {
    try {
      console.log('[장비관리-이전철거] 데이터 로드 시작 - isWorkCompleted:', isWorkCompleted, 'WRK_STAT_CD:', workItem.WRK_STAT_CD);
      let apiResponse;

      // Pre-loaded 데이터가 있으면 API 호출 건너뛰기 (forceRefresh가 아닐 때만)
      if (preloadedApiData && !forceRefresh) {
        console.log('[장비관리-이전철거] Pre-loaded 데이터 사용 - API 호출 건너뜀');
        apiResponse = preloadedApiData;
      } else {
        const userInfo = localStorage.getItem('userInfo');
        if (!userInfo) {
          console.error('사용자 정보가 없습니다.');
          return;
        }

        const user = JSON.parse(userInfo);

        const requestPayload = {
          WRKR_ID: workItem.WRKR_ID || user.userId || user.workerId || '',
          SO_ID: workItem.SO_ID || user.soId,
          WRK_ID: workItem.id,  // WORK_ID가 아닌 WRK_ID 사용 (WorkProcessFlow와 동일)
          CUST_ID: workItem.customer?.id || workItem.CUST_ID,
          RCPT_ID: workItem.RCPT_ID || null,
          CTRT_ID: workItem.CTRT_ID || null,
          CRR_ID: workItem.CRR_ID || null,
          ADDR_ORD: workItem.ADDR_ORD || null,
          CRR_TSK_CL: workItem.WRK_CD || '08',  // 이전철거는 '08' (하드코딩 제거)
          WRK_DTL_TCD: workItem.WRK_DTL_TCD || '',
          WRK_CD: workItem.WRK_CD || null,
          WRK_STAT_CD: workItem.WRK_STAT_CD || null,
          WRK_DRCTN_ID: workItem.WRK_DRCTN_ID || workItem.directionId || null,
          BLD_ID: workItem.BLD_ID || null,
          PROD_CD: workItem.PROD_CD || null,
        };

        console.log('[장비관리-이전철거] 장비 데이터 로드 (API 호출)');
        console.log('[장비관리-이전철거] 요청:', requestPayload);

        apiResponse = await getTechnicianEquipments(requestPayload);
      }

      console.log('[장비관리-이전철거] 응답:');
      console.log('  - 철거장비 (output5):', apiResponse.removedEquipments?.length || 0, '개');

      // output5: 철거 대상 장비
      const removed: ExtendedEquipment[] = (apiResponse.removedEquipments || []).map((eq: any) => ({
        ...eq,
        id: eq.EQT_NO,
        type: eq.ITEM_MID_NM,
        model: eq.EQT_CL_NM,
        serialNumber: eq.EQT_SERNO,
        itemMidCd: eq.ITEM_MID_CD,
        eqtClCd: eq.EQT_CL_CD || eq.EQT_CL,
        macAddress: eq.MAC_ADDRESS || eq.MAC_ADDR,
        installLocation: eq.INSTL_LCTN,
      }));

      console.log('[장비관리-이전철거] 상태 업데이트:');
      console.log('  - 철거 대상:', removed.length, '개');

      // Store에 API 데이터 저장
      setApiData(workId, {
        removeEquipments: removed,
      });

      requestAnimationFrame(() => storeSetDataLoaded(workId, true));
    } catch (error) {
      console.error('[장비관리-이전철거] 장비 데이터 로드 실패:', error);
      showToast?.('장비 정보를 불러오는데 실패했습니다.', 'error', true);
      setApiData(workId, { removeEquipments: [] });
      requestAnimationFrame(() => storeSetDataLoaded(workId, true));
    }
  };

  // 전체 재사용 체크박스 토글 (레거시: chk_reuse_yn_OnClick)
  const handleReuseAllChange = () => {
    const newValue = !reuseAll;
    setReuseAll(newValue);

    // 모든 장비에 REUSE_YN 설정
    removeEquipments.forEach(eq => {
      setRemovalStatus(workId, eq.id, 'REUSE_YN', newValue ? '1' : '0');

      if (newValue) {
        // 재사용 선택 시 모든 분실 체크 해제
        setRemovalStatus(workId, eq.id, 'EQT_LOSS_YN', '0');
        setRemovalStatus(workId, eq.id, 'PART_LOSS_BRK_YN', '0');
        setRemovalStatus(workId, eq.id, 'EQT_BRK_YN', '0');
        setRemovalStatus(workId, eq.id, 'EQT_CABL_LOSS_YN', '0');
        setRemovalStatus(workId, eq.id, 'EQT_CRDL_LOSS_YN', '0');
      }
    });

    if (newValue) {
      showToast?.('모든 장비를 재사용 처리합니다. 이전설치 작업에 사용됩니다.', 'info');
    }
  };

  // 분실/파손 상태 토글 핸들러
  const handleRemovalStatusChange = (eqtNo: string, field: string) => {
    toggleRemovalStatus(workId, eqtNo, field);

    // 분실 선택 시 전체 재사용 해제 (레거시 동일)
    const currentValue = removalStatus[eqtNo]?.[field] || '0';
    if (currentValue === '0') {
      // 분실 체크하는 경우 → 전체 재사용 해제
      if (reuseAll) {
        setReuseAll(false);
        // 해당 장비만 재사용 해제, 나머지 장비도 재사용 해제
        removeEquipments.forEach(eq => {
          setRemovalStatus(workId, eq.id, 'REUSE_YN', '0');
        });
        showToast?.('분실 처리로 인해 재사용이 해제되었습니다.', 'warning');
      }
    }
  };

  // 이전철거 작업 저장 핸들러
  const handleRemovalSave = () => {
    const userInfo = localStorage.getItem('userInfo');
    const user = userInfo ? JSON.parse(userInfo) : {};

    // 철거 장비에 분실/파손/재사용 상태 반영
    const removals = removeEquipments.map(eq => {
      const eqtNo = eq.id;
      const status = removalStatus[eqtNo] || {};

      return {
        // 기본 필드
        id: eq.id,
        type: eq.type,
        model: eq.model,
        serialNumber: eq.serialNumber,
        itemMidCd: eq.itemMidCd,
        eqtClCd: eq.eqtClCd,
        macAddress: eq.macAddress,

        // 레거시 시스템 필수 필드
        CUST_ID: workItem.customer?.id || workItem.CUST_ID,
        CTRT_ID: workItem.CTRT_ID,
        EQT_NO: eq.id,
        ITEM_CD: (eq as any).ITEM_CD || '',
        EQT_SERNO: eq.serialNumber,
        WRK_ID: workItem.id,
        WRK_CD: workItem.WRK_CD,
        CRR_TSK_CL: '02',
        RCPT_ID: workItem.RCPT_ID || '',
        CRR_ID: workItem.CRR_ID || '',
        WRKR_ID: workItem.WRKR_ID || user.userId || user.workerId || '',
        EQT_CL: eq.eqtClCd || (eq as any).EQT_CL_CD || (eq as any).EQT_CL || '',

        // 기타 필드
        SVC_CMPS_ID: (eq as any).SVC_CMPS_ID || '',
        BASIC_PROD_CMPS_ID: (eq as any).BASIC_PROD_CMPS_ID || '',
        MST_SO_ID: (eq as any).MST_SO_ID || workItem.SO_ID || user.soId,
        SO_ID: (eq as any).SO_ID || workItem.SO_ID || user.soId,
        REG_UID: user.userId || user.workerId || 'A20230019',

        // 재사용 상태 (전체 재사용) - 레거시와 동일하게 '1'/'0' 사용
        REUSE_YN: reuseAll ? '1' : '0',

        // 분실 상태 (재사용 시 모두 '0')
        EQT_LOSS_YN: reuseAll ? '0' : (status.EQT_LOSS_YN || '0'),
        PART_LOSS_BRK_YN: reuseAll ? '0' : (status.PART_LOSS_BRK_YN || '0'),
        EQT_BRK_YN: reuseAll ? '0' : (status.EQT_BRK_YN || '0'),
        EQT_CABL_LOSS_YN: reuseAll ? '0' : (status.EQT_CABL_LOSS_YN || '0'),
        EQT_CRDL_LOSS_YN: reuseAll ? '0' : (status.EQT_CRDL_LOSS_YN || '0'),
      } as any;
    });

    const data = {
      installedEquipments: [],
      removedEquipments: removals,
      removalStatus: removalStatus,  // 분실/파손 상태 전달 (CompleteRelocateTerminate에서 사용)
    };

    console.log('[장비관리-이전철거] 철거 장비 수:', removals.length);
    console.log('[장비관리-이전철거] 전체 재사용:', reuseAll);
    if (removals.length > 0) {
      console.log('[장비관리-이전철거] 첫번째 철거 장비 샘플:', removals[0]);
      console.log('[장비관리-이전철거] 재사용/분실 상태:', {
        REUSE_YN: (removals[0] as any).REUSE_YN,
        EQT_LOSS_YN: (removals[0] as any).EQT_LOSS_YN,
      });
    }

    onSave(data);
  };

  // 장비 정보 새로고침
  const handleRefresh = async () => {
    if (isRefreshing || isWorkCompleted) return;

    setIsRefreshing(true);
    try {
      await loadEquipmentData(true);
      showToast?.('장비 정보를 새로고침했습니다.', 'success');
    } catch (error) {
      console.error('[장비관리-이전철거] 새로고침 실패:', error);
      showToast?.('장비 정보 새로고침에 실패했습니다.', 'error');
    } finally {
      setIsRefreshing(false);
    }
  };

  return (
    <div className="px-2 sm:px-4 py-4 sm:py-6 space-y-3 sm:space-y-4 bg-gray-50 pb-4">
      {/* 철거장비 섹션 */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 relative">
        {/* 리프레시 로딩 오버레이 */}
        {isRefreshing && (
          <div className="absolute inset-0 bg-white/80 backdrop-blur-sm z-10 flex items-center justify-center rounded-xl">
            <div className="flex flex-col items-center gap-2">
              <RefreshCw className="w-8 h-8 text-blue-500 animate-spin" />
              <span className="text-sm text-gray-600 font-medium">장비 정보 로딩 중...</span>
            </div>
          </div>
        )}
        <div className="flex items-center justify-between p-3 sm:p-4 border-b border-gray-100">
          <div className="flex items-center gap-3">
            <h4 className="text-sm sm:text-base font-bold text-gray-900 flex items-center gap-2">
              <RotateCcw className="w-4 h-4 sm:w-5 sm:h-5 text-orange-500" />
              철거장비
            </h4>
            <button
              onClick={handleRefresh}
              disabled={isRefreshing || isWorkCompleted}
              className={`flex items-center gap-1 px-2 py-1 rounded-lg transition-all text-xs font-medium ${
                isRefreshing || isWorkCompleted
                  ? 'text-gray-300 cursor-not-allowed'
                  : 'text-blue-500 hover:text-blue-600 hover:bg-blue-50 active:scale-95'
              }`}
              title="장비 정보 새로고침"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
              <span>장비 리프레시</span>
            </button>
            {/* 전체 재사용 체크박스 (레거시: chk_reuse_yn) - 조건 충족 시만 표시 */}
            {showReuseCheckbox && !isWorkCompleted && !readOnly && removeEquipments.length > 0 && (
              <label className="flex items-center gap-1.5 px-2 py-1 rounded-lg cursor-pointer hover:bg-blue-50 active:bg-blue-100">
                <input
                  type="checkbox"
                  checked={reuseAll}
                  onChange={handleReuseAllChange}
                  className="w-4 h-4 rounded border-blue-300 text-blue-600 focus:ring-blue-500"
                />
                <span className="text-xs text-blue-700 font-medium">재사용</span>
              </label>
            )}
          </div>
          <span className="px-2 sm:px-2.5 py-0.5 sm:py-1 bg-orange-100 text-orange-700 text-[0.625rem] sm:text-xs font-semibold rounded-full">
            {removeEquipments.length}개
          </span>
        </div>

        {removeEquipments.length === 0 ? (
          <div className="py-12 text-center">
            <div className="text-sm text-gray-500">철거 대상 장비가 없습니다</div>
          </div>
        ) : (
          <div className="p-3 sm:p-4 space-y-3">
            {removeEquipments.map(equipment => {
              const eqtNo = equipment.id;
              const status = removalStatus[eqtNo] || {};
              const isCustomerOwned = isCustomerOwnedEquipment(equipment);

              return (
                <div
                  key={equipment.id}
                  className="p-3 sm:p-4 rounded-lg border border-gray-200 bg-white"
                >
                  {/* 장비 정보 */}
                  <div className="flex items-start justify-between mb-3">
                    <div className="space-y-1">
                      <div className="text-sm font-semibold text-gray-900">{equipment.model || equipment.type}</div>
                      <div className="text-xs text-gray-600">S/N: {equipment.serialNumber}</div>
                      {equipment.macAddress && (
                        <div className="text-xs text-gray-500">MAC: {equipment.macAddress}</div>
                      )}
                    </div>
                    <span className="text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded">
                      {equipment.EQT_LOC_TP_NM || '고객'}
                    </span>
                  </div>

                  {/* 분실 체크박스 - 항상 표시, 분실 체크 시 재사용 해제 */}
                  {!isWorkCompleted && !readOnly && (
                    <div className="flex flex-wrap gap-2 pt-3 border-t border-gray-100">
                      {/* 분실/파손 체크박스 */}
                      <label className={`flex items-center gap-1.5 px-2 py-1.5 rounded-lg whitespace-nowrap ${isCustomerOwned ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer active:bg-gray-100'}`}>
                        <input
                          type="checkbox"
                          checked={status.EQT_LOSS_YN === '1'}
                          onChange={() => handleRemovalStatusChange(eqtNo, 'EQT_LOSS_YN')}
                          disabled={isCustomerOwned}
                          className="w-4 h-4 rounded border-gray-300 text-orange-500 focus:ring-orange-500"
                        />
                        <span className="text-xs text-gray-700 font-medium">장비분실</span>
                      </label>
                      <label className={`flex items-center gap-1.5 px-2 py-1.5 rounded-lg whitespace-nowrap ${isCustomerOwned ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer active:bg-gray-100'}`}>
                        <input
                          type="checkbox"
                          checked={status.PART_LOSS_BRK_YN === '1'}
                          onChange={() => handleRemovalStatusChange(eqtNo, 'PART_LOSS_BRK_YN')}
                          disabled={isCustomerOwned}
                          className="w-4 h-4 rounded border-gray-300 text-orange-500 focus:ring-orange-500"
                        />
                        <span className="text-xs text-gray-700 font-medium">아답터분실</span>
                      </label>
                      <label className={`flex items-center gap-1.5 px-2 py-1.5 rounded-lg whitespace-nowrap ${isCustomerOwned ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer active:bg-gray-100'}`}>
                        <input
                          type="checkbox"
                          checked={status.EQT_BRK_YN === '1'}
                          onChange={() => handleRemovalStatusChange(eqtNo, 'EQT_BRK_YN')}
                          disabled={isCustomerOwned}
                          className="w-4 h-4 rounded border-gray-300 text-orange-500 focus:ring-orange-500"
                        />
                        <span className="text-xs text-gray-700 font-medium">리모콘분실</span>
                      </label>
                      <label className={`flex items-center gap-1.5 px-2 py-1.5 rounded-lg whitespace-nowrap ${isCustomerOwned ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer active:bg-gray-100'}`}>
                        <input
                          type="checkbox"
                          checked={status.EQT_CABL_LOSS_YN === '1'}
                          onChange={() => handleRemovalStatusChange(eqtNo, 'EQT_CABL_LOSS_YN')}
                          disabled={isCustomerOwned}
                          className="w-4 h-4 rounded border-gray-300 text-orange-500 focus:ring-orange-500"
                        />
                        <span className="text-xs text-gray-700 font-medium">케이블분실</span>
                      </label>
                      <label className={`flex items-center gap-1.5 px-2 py-1.5 rounded-lg whitespace-nowrap ${isCustomerOwned ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer active:bg-gray-100'}`}>
                        <input
                          type="checkbox"
                          checked={status.EQT_CRDL_LOSS_YN === '1'}
                          onChange={() => handleRemovalStatusChange(eqtNo, 'EQT_CRDL_LOSS_YN')}
                          disabled={isCustomerOwned}
                          className="w-4 h-4 rounded border-gray-300 text-orange-500 focus:ring-orange-500"
                        />
                        <span className="text-xs text-gray-700 font-medium">크래들분실</span>
                      </label>
                    </div>
                  )}

                  {/* 고객소유 장비 안내 */}
                  {isCustomerOwned && !isWorkCompleted && (
                    <div className="mt-2 text-xs text-orange-600 bg-orange-50 p-2 rounded">
                      고객소유 장비로 분실처리 불가
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default EquipmentRelocateTerminate;
