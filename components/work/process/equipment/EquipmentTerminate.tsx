/**
 * 철거/이전철거 작업 (WRK_CD=02,08) 전용 장비정보 컴포넌트
 *
 * 레거시 참조: mowoa03m02.xml, mowoa03m08.xml
 *
 * 상태 관리:
 * - Zustand (useWorkEquipmentStore): 클라이언트 상태 (철거 장비, 분실/파손 체크박스)
 * - localStorage persist: Zustand middleware로 자동 저장
 *
 * 기능:
 * - 철거 대상 장비 목록 표시 (API output5)
 * - 분실/파손 체크박스 (장비분실, 아답터분실, 리모콘분실, 케이블분실, 크래들분실)
 * - 고객소유 장비는 분실처리 불가
 */

import React, { useEffect } from 'react';
import { RotateCcw } from 'lucide-react';
import { getTechnicianEquipments } from '../../../../services/apiService';
import { useWorkEquipmentStore, useWorkEquipment } from '../../../../stores/workEquipmentStore';
import {
  EquipmentComponentProps,
  ExtendedEquipment,
  isCustomerOwnedEquipment,
} from './shared/types';

const EquipmentTerminate: React.FC<EquipmentComponentProps> = ({
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
  } = useWorkEquipmentStore();

  // Work Equipment Store - State (현재 작업)
  const {
    removeEquipments,
    removalStatus,
    isReady: isDataLoaded,
  } = useWorkEquipment(workId);

  // 초기화 및 데이터 로드
  useEffect(() => {
    // 이미 데이터가 로드된 상태면 건너뜀 (탭 이동 시 기존 데이터 유지)
    if (isDataLoaded && removeEquipments.length > 0) {
      console.log('[장비관리-철거] 이미 데이터 로드됨 - 기존 데이터 유지');
      return;
    }
    initWorkState(workId);
    loadEquipmentData();
  }, [workItem.id]);

  // Zustand store가 자동으로 localStorage에 persist하므로 별도 저장 로직 불필요

  // 장비 데이터 로드
  const loadEquipmentData = async () => {
    try {
      console.log('[장비관리-철거] 데이터 로드 시작 - isWorkCompleted:', isWorkCompleted, 'WRK_STAT_CD:', workItem.WRK_STAT_CD);
      let apiResponse;

      // Pre-loaded 데이터가 있으면 API 호출 건너뛰기
      if (preloadedApiData) {
        console.log('[장비관리-철거] Pre-loaded 데이터 사용 - API 호출 건너뜀');
        apiResponse = preloadedApiData;
      } else {
        const userInfo = localStorage.getItem('userInfo');
        if (!userInfo) {
          console.error('사용자 정보가 없습니다.');
          return;
        }

        const user = JSON.parse(userInfo);

        const requestPayload = {
          WRKR_ID: user.workerId || 'A20130708',
          SO_ID: workItem.SO_ID || user.soId,
          WORK_ID: workItem.id,
          CUST_ID: workItem.customer?.id || workItem.CUST_ID,
          RCPT_ID: workItem.RCPT_ID || null,
          CTRT_ID: workItem.CTRT_ID || null,
          CRR_ID: workItem.CRR_ID || null,
          ADDR_ORD: workItem.ADDR_ORD || null,
          CRR_TSK_CL: '02', // 철거 작업
          WRK_DTL_TCD: workItem.WRK_DTL_TCD || '',
          WRK_CD: workItem.WRK_CD || null,
          WRK_STAT_CD: workItem.WRK_STAT_CD || null,
          WRK_DRCTN_ID: workItem.WRK_DRCTN_ID || workItem.directionId || null,
          BLD_ID: workItem.BLD_ID || null,
          PROD_CD: workItem.PROD_CD || null,
        };

        console.log('[장비관리-철거] 장비 데이터 로드 (API 호출)');
        console.log('[장비관리-철거] 요청:', requestPayload);

        apiResponse = await getTechnicianEquipments(requestPayload);
      }

      console.log('[장비관리-철거] 응답:');
      console.log('  - 철거장비 (output5):', apiResponse.removedEquipments?.length || 0, '개');
      // 원본 API 응답 로깅 (첫번째 장비)
      if (apiResponse.removedEquipments?.length > 0) {
        console.log('[장비관리-철거] 원본 API 응답[0]:', apiResponse.removedEquipments[0]);
      }

      // output5: 철거 대상 장비
      // API 응답의 모든 필드를 보존하고, 프론트엔드용 별칭 추가
      const removed: ExtendedEquipment[] = (apiResponse.removedEquipments || []).map((eq: any) => ({
        // 원본 API 응답 필드 모두 보존 (레거시 필드명 그대로)
        ...eq,
        // 프론트엔드용 별칭 추가
        id: eq.EQT_NO,
        type: eq.ITEM_MID_NM,
        model: eq.EQT_CL_NM,
        serialNumber: eq.EQT_SERNO,
        itemMidCd: eq.ITEM_MID_CD,
        eqtClCd: eq.EQT_CL_CD || eq.EQT_CL,
        macAddress: eq.MAC_ADDRESS || eq.MAC_ADDR,
        installLocation: eq.INSTL_LCTN,
      }));

      console.log('[장비관리-철거] 상태 업데이트:');
      console.log('  - 철거 대상:', removed.length, '개');

      // Store에 API 데이터 저장
      setApiData(workId, {
        removeEquipments: removed,
      });

      // Store에 persist된 removalStatus가 없으면 빈 상태로 시작
      // (persist middleware가 자동으로 복원해줌)

      // Use requestAnimationFrame to ensure state updates are applied before marking data as loaded
      requestAnimationFrame(() => storeSetDataLoaded(workId, true));
    } catch (error) {
      console.error('[장비관리-철거] 장비 데이터 로드 실패:', error);
      showToast?.('장비 정보를 불러오는데 실패했습니다.', 'error');
      setApiData(workId, { removeEquipments: [] });
      requestAnimationFrame(() => storeSetDataLoaded(workId, true));
    }
  };

  // 철거 장비 분실/파손 상태 토글 핸들러
  const handleRemovalStatusChange = (eqtNo: string, field: string) => {
    toggleRemovalStatus(workId, eqtNo, field);
  };

  // 철거 작업 저장 핸들러
  const handleRemovalSave = () => {
    const userInfo = localStorage.getItem('userInfo');
    const user = userInfo ? JSON.parse(userInfo) : {};

    // 철거 장비에 분실/파손 상태 반영
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

        // 레거시 시스템 필수 필드 (mowoa03m02.xml:1094-1100 참조)
        CUST_ID: workItem.customer?.id || workItem.CUST_ID,
        CTRT_ID: workItem.CTRT_ID,
        EQT_NO: eq.id,
        ITEM_CD: (eq as any).ITEM_CD || '',
        EQT_SERNO: eq.serialNumber,
        WRK_ID: workItem.id,
        WRK_CD: workItem.WRK_CD,
        // 레거시 필수 필드 추가 (mowoa03m02.xml에서 작업완료 전 설정)
        CRR_TSK_CL: '02',  // 철거 작업
        RCPT_ID: workItem.RCPT_ID || '',
        CRR_ID: workItem.CRR_ID || '',
        WRKR_ID: user.workerId || 'A20130708',
        // EQT_CL 필드 (장비분실처리에서 필수 - TCMCT_EQT_LOSS_INFO 테이블)
        EQT_CL: eq.eqtClCd || (eq as any).EQT_CL_CD || (eq as any).EQT_CL || '',

        // 기타 필드
        SVC_CMPS_ID: (eq as any).SVC_CMPS_ID || '',
        BASIC_PROD_CMPS_ID: (eq as any).BASIC_PROD_CMPS_ID || '',
        MST_SO_ID: (eq as any).MST_SO_ID || workItem.SO_ID || user.soId,
        SO_ID: (eq as any).SO_ID || workItem.SO_ID || user.soId,
        REG_UID: user.userId || user.workerId || 'A20230019',

        // 분실 상태 (철거 장비 전용)
        EQT_LOSS_YN: status.EQT_LOSS_YN || '0',           // 장비분실
        PART_LOSS_BRK_YN: status.PART_LOSS_BRK_YN || '0', // 아답터분실
        EQT_BRK_YN: status.EQT_BRK_YN || '0',             // 리모콘분실
        EQT_CABL_LOSS_YN: status.EQT_CABL_LOSS_YN || '0', // 케이블분실
        EQT_CRDL_LOSS_YN: status.EQT_CRDL_LOSS_YN || '0', // 크래들분실
      } as any;
    });

    const data = {
      installedEquipments: [], // 철거 작업에서는 설치 장비 없음
      removedEquipments: removals,
    };

    console.log('[장비관리-철거] 철거 장비 수:', removals.length);
    if (removals.length > 0) {
      console.log('[장비관리-철거] 첫번째 철거 장비 샘플:', removals[0]);
      console.log('[장비관리-철거] 분실/파손 상태:', {
        EQT_LOSS_YN: (removals[0] as any).EQT_LOSS_YN,
        PART_LOSS_BRK_YN: (removals[0] as any).PART_LOSS_BRK_YN,
        EQT_BRK_YN: (removals[0] as any).EQT_BRK_YN,
        EQT_CABL_LOSS_YN: (removals[0] as any).EQT_CABL_LOSS_YN,
        EQT_CRDL_LOSS_YN: (removals[0] as any).EQT_CRDL_LOSS_YN,
      });
    }

    onSave(data);
  };

  return (
    <div className="px-2 sm:px-4 py-4 sm:py-6 space-y-3 sm:space-y-4 bg-gray-50 pb-4">
      {/* 철거장비 섹션 */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100">
        <div className="flex items-center justify-between p-3 sm:p-4 border-b border-gray-100">
          <h4 className="text-sm sm:text-base font-bold text-gray-900 flex items-center gap-2">
            <RotateCcw className="w-4 h-4 sm:w-5 sm:h-5 text-orange-500" />
            철거장비
          </h4>
          <span className="px-2 sm:px-2.5 py-0.5 sm:py-1 bg-orange-100 text-orange-700 text-[10px] sm:text-xs font-semibold rounded-full">
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

                  {/* 분실/파손 체크박스 - 읽기 전용일 때는 숨김 */}
                  {!isWorkCompleted && !readOnly && (() => {
                    // 분실/파손 체크 여부에 따라 재사용 상태 자동 계산 (UI 표시용)
                    const hasAnyLoss = status.EQT_LOSS_YN === '1' ||
                      status.PART_LOSS_BRK_YN === '1' ||
                      status.EQT_BRK_YN === '1' ||
                      status.EQT_CABL_LOSS_YN === '1' ||
                      status.EQT_CRDL_LOSS_YN === '1';
                    const isReusable = !hasAnyLoss;

                    return (
                    <div className="flex flex-wrap gap-2 pt-3 border-t border-gray-100">
                      {/* 재사용 체크박스 (표시용 - 분실 체크 시 자동 해제) */}
                      <label className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg whitespace-nowrap opacity-70 cursor-not-allowed">
                        <input
                          type="checkbox"
                          checked={isReusable}
                          disabled={true}
                          className={`w-4 h-4 rounded border-gray-300 ${isReusable ? 'text-green-500' : 'text-gray-300'} focus:ring-green-500`}
                        />
                        <span className={`text-xs font-medium ${isReusable ? 'text-green-700' : 'text-gray-400'}`}>재사용</span>
                      </label>
                      <div className="w-px h-5 bg-gray-300 self-center mx-1" />
                      <label className={`flex items-center gap-1.5 px-2 py-1.5 rounded-lg active:bg-gray-100 whitespace-nowrap ${isCustomerOwned ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}>
                        <input
                          type="checkbox"
                          checked={status.EQT_LOSS_YN === '1'}
                          onChange={() => !isCustomerOwned && handleRemovalStatusChange(eqtNo, 'EQT_LOSS_YN')}
                          disabled={isCustomerOwned}
                          className="w-4 h-4 rounded border-gray-300 text-orange-500 focus:ring-orange-500"
                        />
                        <span className="text-xs text-gray-700 font-medium">장비분실</span>
                      </label>
                      <label className={`flex items-center gap-1.5 px-2 py-1.5 rounded-lg active:bg-gray-100 whitespace-nowrap ${isCustomerOwned ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}>
                        <input
                          type="checkbox"
                          checked={status.PART_LOSS_BRK_YN === '1'}
                          onChange={() => !isCustomerOwned && handleRemovalStatusChange(eqtNo, 'PART_LOSS_BRK_YN')}
                          disabled={isCustomerOwned}
                          className="w-4 h-4 rounded border-gray-300 text-orange-500 focus:ring-orange-500"
                        />
                        <span className="text-xs text-gray-700 font-medium">아답터분실</span>
                      </label>
                      <label className={`flex items-center gap-1.5 px-2 py-1.5 rounded-lg active:bg-gray-100 whitespace-nowrap ${isCustomerOwned ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}>
                        <input
                          type="checkbox"
                          checked={status.EQT_BRK_YN === '1'}
                          onChange={() => !isCustomerOwned && handleRemovalStatusChange(eqtNo, 'EQT_BRK_YN')}
                          disabled={isCustomerOwned}
                          className="w-4 h-4 rounded border-gray-300 text-orange-500 focus:ring-orange-500"
                        />
                        <span className="text-xs text-gray-700 font-medium">리모콘분실</span>
                      </label>
                      <label className={`flex items-center gap-1.5 px-2 py-1.5 rounded-lg active:bg-gray-100 whitespace-nowrap ${isCustomerOwned ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}>
                        <input
                          type="checkbox"
                          checked={status.EQT_CABL_LOSS_YN === '1'}
                          onChange={() => !isCustomerOwned && handleRemovalStatusChange(eqtNo, 'EQT_CABL_LOSS_YN')}
                          disabled={isCustomerOwned}
                          className="w-4 h-4 rounded border-gray-300 text-orange-500 focus:ring-orange-500"
                        />
                        <span className="text-xs text-gray-700 font-medium">케이블분실</span>
                      </label>
                      <label className={`flex items-center gap-1.5 px-2 py-1.5 rounded-lg active:bg-gray-100 whitespace-nowrap ${isCustomerOwned ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}>
                        <input
                          type="checkbox"
                          checked={status.EQT_CRDL_LOSS_YN === '1'}
                          onChange={() => !isCustomerOwned && handleRemovalStatusChange(eqtNo, 'EQT_CRDL_LOSS_YN')}
                          disabled={isCustomerOwned}
                          className="w-4 h-4 rounded border-gray-300 text-orange-500 focus:ring-orange-500"
                        />
                        <span className="text-xs text-gray-700 font-medium">크래들분실</span>
                      </label>
                    </div>
                    );
                  })()}

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

export default EquipmentTerminate;
