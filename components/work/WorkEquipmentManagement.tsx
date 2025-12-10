/**
 * 작업 프로세스 3단계 전용 장비관리 컴포넌트
 * - 작업 컨텍스트가 필요한 장비 할당
 * - 계약 장비 + 기사 재고 매핑
 * - 작업 완료를 위한 장비 정보 수집
 *
 * 현재는 EquipmentManagement를 래핑하여 사용
 * 향후 작업 전용 기능만 남기고 리팩토링 예정
 */

import React from 'react';
import { WorkItem, Equipment } from '../../types';
import EquipmentManagement from '../equipment/EquipmentManagement';
import { useWorkProcessStore } from '../../stores/workProcessStore';

interface WorkEquipmentManagementProps {
  workItem: WorkItem;
  onSave: (data: EquipmentData) => void;
  onBack: () => void;
  showToast?: (message: string, type: 'success' | 'error' | 'warning' | 'info') => void;
  preloadedApiData?: any; // WorkProcessFlow에서 Pre-load한 데이터
}

interface EquipmentData {
  installedEquipments: Equipment[];
  removedEquipments: Equipment[];
}

/**
 * 작업 프로세스 3단계: 장비 정보
 *
 * 역할:
 * 1. 계약 장비 목록 표시 (설치해야 할 장비)
 * 2. 기사 재고 장비 목록 표시 (설치 가능한 장비)
 * 3. 계약 장비 ↔ 재고 장비 매핑
 * 4. 설치 위치, MAC 주소 입력
 * 5. 신호 체크 (STB)
 * 6. 장비 정보 저장 → 4단계(작업 완료)로 전달
 */
const WorkEquipmentManagement: React.FC<WorkEquipmentManagementProps> = ({
  workItem,
  onSave,
  onBack,
  showToast,
  preloadedApiData
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
      {/* 기존 EquipmentManagement 컴포넌트 사용 */}
      <EquipmentManagement
        workItem={workItem}
        onSave={handleSave}
        onBack={onBack}
        showToast={showToast}
        preloadedApiData={preloadedApiData}
      />

    </div>
  );
};

export default WorkEquipmentManagement;
