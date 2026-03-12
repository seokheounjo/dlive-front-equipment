/**
 * Complete 컴포넌트 공통 타입/인터페이스
 */
import { WorkOrder, WorkCompleteData } from '../../../../../types';

/** 상품유형 */
export type ProductType = 'basic' | 'ftth' | 'lguplus';

/** Complete 컴포넌트 공통 Props */
export interface CompleteComponentProps {
  order: WorkOrder;
  onBack: () => void;
  onSuccess: () => void;
  showToast?: (message: string, type: 'success' | 'error' | 'warning' | 'info') => void;
  equipmentData?: any;
  readOnly?: boolean;
  onEquipmentRefreshNeeded?: () => void;
}

/** 작업유형 코드 → 작업유형명 매핑 */
export const WORK_TYPE_MAP: Record<string, string> = {
  '01': '설치',
  '02': '철거',
  '03': 'A/S',
  '04': '정지',
  '05': '상품변경',
  '06': '댁내이전',
  '07': '이전설치',
  '08': '이전철거',
  '09': '부가상품',
};
