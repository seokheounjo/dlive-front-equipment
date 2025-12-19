/**
 * 철거/이전철거 작업 (WRK_CD=02,08) 전용 장비정보 컴포넌트
 *
 * 레거시 참조: mowoa03m02.xml, mowoa03m08.xml
 *
 * 기능:
 * - 철거 대상 장비 목록 표시 (API output5)
 * - 분실/파손 체크박스 (장비분실, 아답터분실, 리모콘분실, 케이블분실, 크래들분실)
 * - 고객소유 장비는 분실처리 불가
 * - 연동이력 조회
 * - 저장 기능
 *
 * 제거된 기능:
 * - 계약 장비 선택 로직
 * - 기사 재고 관련 로직
 * - 등록 버튼 및 기능
 * - 신호처리 (설치 전용)
 */

import React, { useState, useEffect } from 'react';
import { RotateCcw } from 'lucide-react';
import { getTechnicianEquipments } from '../../../../services/apiService';
import {
  EquipmentComponentProps,
  ExtendedEquipment,
  RemovalStatus,
  isCustomerOwnedEquipment,
  getEquipmentStorageKey
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
  // 작업 완료 여부 확인
  const isWorkCompleted = readOnly || workItem.WRK_STAT_CD === '4' || workItem.status === '완료';

  // 철거 대상 장비 목록 (API output5)
  const [removeEquipments, setRemoveEquipments] = useState<ExtendedEquipment[]>([]);

  // 철거 장비 분실/파손 상태
  const [removalStatus, setRemovalStatus] = useState<RemovalStatus>({});


  // 초기 데이터 로드 완료 여부
  const [isDataLoaded, setIsDataLoaded] = useState(false);

  // 초기 데이터 로드
  useEffect(() => {
    setIsDataLoaded(false);
    loadEquipmentData();
  }, [workItem]);

  // localStorage 키 생성
  const getStorageKey = () => getEquipmentStorageKey(workItem.id);

  // 작업 중인 데이터 자동 저장
  useEffect(() => {
    if (!isDataLoaded) {
      return;
    }

    const storageKey = getStorageKey();
    const hasRemovalStatus = Object.keys(removalStatus).length > 0;

    if (hasRemovalStatus) {
      const draftData = {
        removalStatus: removalStatus,
        savedAt: new Date().toISOString(),
      };
      localStorage.setItem(storageKey, JSON.stringify(draftData));
    } else {
      localStorage.removeItem(storageKey);
    }
  }, [removalStatus, isDataLoaded]);

  // 장비 데이터 로드
  const loadEquipmentData = async () => {
    try {
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

      // output5: 철거 대상 장비
      const removed: ExtendedEquipment[] = (apiResponse.removedEquipments || []).map((eq: any) => ({
        id: eq.EQT_NO,
        type: eq.ITEM_MID_NM,
        model: eq.EQT_CL_NM,
        serialNumber: eq.EQT_SERNO,
        itemMidCd: eq.ITEM_MID_CD,
        eqtClCd: eq.EQT_CL_CD || eq.EQT_CL,
        macAddress: eq.MAC_ADDRESS || eq.MAC_ADDR,
        installLocation: eq.INSTL_LCTN,
        // API 응답의 모든 필드 보존
        SVC_CMPS_ID: eq.SVC_CMPS_ID,
        BASIC_PROD_CMPS_ID: eq.BASIC_PROD_CMPS_ID,
        MST_SO_ID: eq.MST_SO_ID,
        SO_ID: eq.SO_ID,
        LENT_YN: eq.LENT_YN,
        VOIP_CUSTOWN_EQT: eq.VOIP_CUSTOWN_EQT,
        EQT_LOC_TP_NM: eq.EQT_LOC_TP_NM,
      }));

      console.log('[장비관리-철거] 상태 업데이트:');
      console.log('  - 철거 대상:', removed.length, '개');

      setRemoveEquipments(removed);

      // localStorage에서 저장된 상태 복원
      const storageKey = getStorageKey();
      const savedData = localStorage.getItem(storageKey);
      if (savedData) {
        try {
          const parsed = JSON.parse(savedData);
          if (parsed.removalStatus) {
            setRemovalStatus(parsed.removalStatus);
            console.log('[장비관리-철거] localStorage에서 분실/파손 상태 복원:', parsed.removalStatus);
          }
        } catch (err) {
          console.error('[장비관리-철거] localStorage 파싱 오류:', err);
        }
      }

      setIsDataLoaded(true);
    } catch (error) {
      console.error('[장비관리-철거] 장비 데이터 로드 실패:', error);
      showToast?.('장비 정보를 불러오는데 실패했습니다.', 'error');
      setIsDataLoaded(true);
    }
  };

  // 철거 장비 분실/파손 상태 토글 핸들러
  const handleRemovalStatusChange = (eqtNo: string, field: string, value: string) => {
    setRemovalStatus(prev => ({
      ...prev,
      [eqtNo]: {
        ...prev[eqtNo],
        [field]: value === '1' ? '0' : '1'  // 토글
      }
    }));
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

        // 레거시 시스템 필수 필드
        CUST_ID: workItem.customer?.id || workItem.CUST_ID,
        CTRT_ID: workItem.CTRT_ID,
        EQT_NO: eq.id,
        ITEM_CD: eq.ITEM_CD || '',
        EQT_SERNO: eq.serialNumber,
        WRK_ID: workItem.id,
        WRK_CD: workItem.WRK_CD,

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
                  {!isWorkCompleted && !readOnly && (
                    <div className="flex flex-wrap gap-2 pt-3 border-t border-gray-100">
                      <label className={`flex items-center gap-1.5 px-2 py-1.5 rounded-lg active:bg-gray-100 whitespace-nowrap ${isCustomerOwned ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}>
                        <input
                          type="checkbox"
                          checked={status.EQT_LOSS_YN === '1'}
                          onChange={() => !isCustomerOwned && handleRemovalStatusChange(eqtNo, 'EQT_LOSS_YN', status.EQT_LOSS_YN || '0')}
                          disabled={isCustomerOwned}
                          className="w-4 h-4 rounded border-gray-300 text-orange-500 focus:ring-orange-500"
                        />
                        <span className="text-xs text-gray-700 font-medium">장비분실</span>
                      </label>
                      <label className={`flex items-center gap-1.5 px-2 py-1.5 rounded-lg active:bg-gray-100 whitespace-nowrap ${isCustomerOwned ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}>
                        <input
                          type="checkbox"
                          checked={status.PART_LOSS_BRK_YN === '1'}
                          onChange={() => !isCustomerOwned && handleRemovalStatusChange(eqtNo, 'PART_LOSS_BRK_YN', status.PART_LOSS_BRK_YN || '0')}
                          disabled={isCustomerOwned}
                          className="w-4 h-4 rounded border-gray-300 text-orange-500 focus:ring-orange-500"
                        />
                        <span className="text-xs text-gray-700 font-medium">아답터분실</span>
                      </label>
                      <label className={`flex items-center gap-1.5 px-2 py-1.5 rounded-lg active:bg-gray-100 whitespace-nowrap ${isCustomerOwned ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}>
                        <input
                          type="checkbox"
                          checked={status.EQT_BRK_YN === '1'}
                          onChange={() => !isCustomerOwned && handleRemovalStatusChange(eqtNo, 'EQT_BRK_YN', status.EQT_BRK_YN || '0')}
                          disabled={isCustomerOwned}
                          className="w-4 h-4 rounded border-gray-300 text-orange-500 focus:ring-orange-500"
                        />
                        <span className="text-xs text-gray-700 font-medium">리모콘분실</span>
                      </label>
                      <label className={`flex items-center gap-1.5 px-2 py-1.5 rounded-lg active:bg-gray-100 whitespace-nowrap ${isCustomerOwned ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}>
                        <input
                          type="checkbox"
                          checked={status.EQT_CABL_LOSS_YN === '1'}
                          onChange={() => !isCustomerOwned && handleRemovalStatusChange(eqtNo, 'EQT_CABL_LOSS_YN', status.EQT_CABL_LOSS_YN || '0')}
                          disabled={isCustomerOwned}
                          className="w-4 h-4 rounded border-gray-300 text-orange-500 focus:ring-orange-500"
                        />
                        <span className="text-xs text-gray-700 font-medium">케이블분실</span>
                      </label>
                      <label className={`flex items-center gap-1.5 px-2 py-1.5 rounded-lg active:bg-gray-100 whitespace-nowrap ${isCustomerOwned ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}>
                        <input
                          type="checkbox"
                          checked={status.EQT_CRDL_LOSS_YN === '1'}
                          onChange={() => !isCustomerOwned && handleRemovalStatusChange(eqtNo, 'EQT_CRDL_LOSS_YN', status.EQT_CRDL_LOSS_YN || '0')}
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

export default EquipmentTerminate;
