/**
 * 작업 프로세스 3단계 전용 장비관리 컴포넌트
 * - 작업 컨텍스트가 필요한 장비 할당
 * - 계약 장비 + 기사 재고 매핑
 * - 작업 완료를 위한 장비 정보 수집
 *
 * WRK_CD별로 분리된 컴포넌트를 EquipmentRouter가 라우팅
 * - EquipmentInstall: WRK_CD=01 (설치)
 * - EquipmentTerminate: WRK_CD=02,08 (철거, 이전철거)
 * - EquipmentGeneral: WRK_CD=03,04,05,06,07,09 (A/S, 정지, 상품변경, 이전설치, 부가상품)
 */

import React from 'react';
import { WorkItem, Equipment } from '../../../types';
import EquipmentRouter from './equipment';
import { useWorkProcessStore } from '../../../stores/workProcessStore';

interface WorkEquipmentManagementProps {
  workItem: WorkItem;
  onSave: (data: EquipmentData) => void;
  onBack: () => void;
  showToast?: (message: string, type: 'success' | 'error' | 'warning' | 'info') => void;
  preloadedApiData?: any; // WorkProcessFlow에서 Pre-load한 데이터
  onPreloadedDataUpdate?: (newData: any) => void; // Pre-load 데이터 업데이트 콜백
  readOnly?: boolean; // 완료된 작업 - 읽기 전용 모드
}

interface EquipmentData {
  installedEquipments: Equipment[];
  removedEquipments: Equipment[];
}

/**
 * 작업 프로세스 3단계: 장비 정보
 *
 * WRK_CD에 따라 적절한 장비관리 컴포넌트를 렌더링합니다.
 * - 설치(01): 고객설치장비 + 기사재고 (회수 섹션 없음)
 * - 철거(02,08): 철거장비 목록 + 분실/파손 체크
 * - 기타(03,04,05,06,07,09): 고객설치장비 + 기사재고 + 철거장비
 */
const WorkEquipmentManagement: React.FC<WorkEquipmentManagementProps> = ({
  workItem,
  onSave,
  onBack,
  showToast,
  preloadedApiData,
  onPreloadedDataUpdate,
  readOnly = false
}) => {
  // Work Process Store (작업 프로세스 상태 관리)
  const { setEquipmentData } = useWorkProcessStore();

  // 장비 저장 핸들러
  const handleSave = (data: EquipmentData) => {
    console.log('[WorkEquipmentManagement] 장비 저장:', data);

    // Work Process Store에 저장 (4단계에서 사용)
    setEquipmentData(data);

    // 부모 컴포넌트(WorkProcessFlow)로 전달
    onSave(data);
  };

  return (
    <div className="work-equipment-management">
      {/* WRK_CD별 분리된 장비관리 컴포넌트 라우터 */}
      <EquipmentRouter
        workItem={workItem}
        onSave={handleSave}
        onBack={onBack}
        showToast={showToast}
        preloadedApiData={preloadedApiData}
        onPreloadedDataUpdate={onPreloadedDataUpdate}
        readOnly={readOnly}
      />
    </div>
  );
};

export default WorkEquipmentManagement;
