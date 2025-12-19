import React from 'react';
import { WorkOrder } from '../../../../types';

/**
 * WRK_CD별 분리된 컴포넌트 (레거시 mowoa02m01.xml 기준)
 *
 * | WRK_CD | 작업유형 | 레거시 파일 | 컴포넌트 |
 * |--------|----------|-------------|----------|
 * | 01 | 설치 | mowoa03m01 | CompleteInstall |
 * | 02 | 철거 | mowoa03m02 | CompleteTerminate |
 * | 03 | A/S | mowoa03m03 | CompleteAS |
 * | 04 | 정지 | mowoa03m04 | CompleteMove |
 * | 05 | 상품변경 | mowoa03m05 | CompleteChange |
 * | 06 | 이전설치 | mowoa03m06 | CompleteMoveRemoval |
 * | 07 | 이전설치 | mowoa03m06 | CompleteMoveRemoval |
 * | 08 | 이전철거 | mowoa03m08 | CompleteRemovalTerminate |
 * | 09 | 부가상품 | mowoa03m09 | CompleteRemoval |
 */
import CompleteInstall from './CompleteInstall';           // 01: 설치
import CompleteTerminate from './CompleteTerminate';       // 02: 철거
import CompleteAS from './CompleteAS';                     // 03: A/S
import CompleteMove from './CompleteMove';                 // 04: 정지
import CompleteChange from './CompleteChange';             // 05: 상품변경
import CompleteMoveRemoval from './CompleteMoveRemoval';   // 06, 07: 이전설치
import CompleteRemovalTerminate from './CompleteRemovalTerminate'; // 08: 이전철거
import CompleteRemoval from './CompleteRemoval';           // 09: 부가상품

interface WorkCompleteRouterProps {
  order: WorkOrder;
  onBack: () => void;
  onSuccess: () => void;
  showToast?: (message: string, type: 'success' | 'error' | 'warning' | 'info') => void;
  equipmentData?: any;
  readOnly?: boolean;
}

/**
 * WRK_CD별 작업완료 페이지 라우터 (레거시 mowoa02m01.xml 기준)
 */
const WorkCompleteRouter: React.FC<WorkCompleteRouterProps> = (props) => {
  const { order } = props;
  const wrkCd = order.WRK_CD;

  // WRK_CD에 따라 적절한 컴포넌트 반환
  switch (wrkCd) {
    case '01':
      // 설치 (mowoa03m01)
      return <CompleteInstall {...props} />;

    case '02':
      // 철거 (mowoa03m02)
      return <CompleteTerminate {...props} />;

    case '03':
      // A/S (mowoa03m03)
      return <CompleteAS {...props} />;

    case '04':
      // 정지 (mowoa03m04)
      return <CompleteMove {...props} />;

    case '05':
      // 상품변경 (mowoa03m05)
      return <CompleteChange {...props} />;

    case '06':
    case '07':
      // 이전설치 (mowoa03m06) - 06, 07 공용
      return <CompleteMoveRemoval {...props} />;

    case '08':
      // 이전철거 (mowoa03m08)
      return <CompleteRemovalTerminate {...props} />;

    case '09':
      // 부가상품 (mowoa03m09)
      return <CompleteRemoval {...props} />;

    default:
      // 기본값: 설치 컴포넌트 사용
      console.warn(`[WorkCompleteRouter] Unknown WRK_CD: ${wrkCd}, using default form`);
      return <CompleteInstall {...props} />;
  }
};

// 작업유형명 반환 함수 (레거시 CMWT000 코드 테이블)
export const getWorkTypeName = (wrkCd: string): string => {
  const workTypeMap: Record<string, string> = {
    '01': '설치',
    '02': '철거',
    '03': 'A/S',
    '04': '정지',
    '05': '상품변경',
    '06': '이전설치',
    '07': '이전설치',
    '08': '이전철거',
    '09': '부가상품',
  };
  return workTypeMap[wrkCd] || '작업';
};

export default WorkCompleteRouter;
