/**
 * 장비정보 라우터 (WRK_CD별 컴포넌트 분기)
 *
 * Complete 폴더와 1:1 매칭되는 구조
 *
 * | WRK_CD | 작업유형 | Equipment 컴포넌트 | Complete 컴포넌트 |
 * |--------|----------|-------------------|-------------------|
 * | 01 | 설치 | EquipmentInstall | CompleteInstall |
 * | 02 | 철거 | EquipmentTerminate | CompleteTerminate |
 * | 03 | A/S | EquipmentAS | CompleteAS |
 * | 04 | 정지 | EquipmentMove | CompleteMove |
 * | 05 | 상품변경 | EquipmentChange | CompleteChange |
 * | 06 | 이전설치 | EquipmentMoveRemoval | CompleteMoveRemoval |
 * | 07 | 이전설치 | EquipmentMoveRemoval | CompleteMoveRemoval |
 * | 08 | 이전철거 | EquipmentTerminate | CompleteRemovalTerminate |
 * | 09 | 부가상품 | EquipmentRemoval | CompleteRemoval |
 */

import React from 'react';
import { EquipmentComponentProps } from './shared/types';
import EquipmentInstall from './EquipmentInstall';       // 01: 설치
import EquipmentTerminate from './EquipmentTerminate';   // 02, 08: 철거, 이전철거
import EquipmentAS from './EquipmentAS';                 // 03: A/S
import EquipmentMove from './EquipmentMove';             // 04: 정지
import EquipmentChange from './EquipmentChange';         // 05: 상품변경
import EquipmentMoveRemoval from './EquipmentMoveRemoval'; // 06, 07: 이전설치
import EquipmentRemoval from './EquipmentRemoval';       // 09: 부가상품

interface EquipmentRouterProps extends EquipmentComponentProps {
  // 추가 props 없음 - EquipmentComponentProps 그대로 사용
}

/**
 * WRK_CD별 장비정보 페이지 라우터
 */
const EquipmentRouter: React.FC<EquipmentRouterProps> = (props) => {
  const { workItem } = props;
  const wrkCd = workItem.WRK_CD;

  // WRK_CD에 따라 적절한 컴포넌트 반환
  switch (wrkCd) {
    case '01':
      // 설치
      return <EquipmentInstall {...props} />;

    case '02':
      // 철거
      return <EquipmentTerminate {...props} />;

    case '03':
      // A/S
      return <EquipmentAS {...props} />;

    case '04':
      // 정지
      return <EquipmentMove {...props} />;

    case '05':
      // 상품변경
      return <EquipmentChange {...props} />;

    case '06':
    case '07':
      // 이전설치 (06, 07 공용)
      return <EquipmentMoveRemoval {...props} />;

    case '08':
      // 이전철거 (철거와 동일한 컴포넌트 사용)
      return <EquipmentTerminate {...props} />;

    case '09':
      // 부가상품
      return <EquipmentRemoval {...props} />;

    default:
      // 기본값: 설치 컴포넌트 사용
      console.warn(`[EquipmentRouter] Unknown WRK_CD: ${wrkCd}, using default (Install)`);
      return <EquipmentInstall {...props} />;
  }
};

// 작업유형명 반환 함수
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

export default EquipmentRouter;
