import React from 'react';
import { WorkItem } from '../../../../types';
import { useProductType } from '../../../../hooks/useProductType';
import { ProductType } from './shared/types';

/**
 * WRK_CD × ProductType 라우터
 *
 * 진입 시점에서 ProductTypeContext로부터 상품유형을 가져와
 * productType + WRK_CD 조합으로 적절한 컴포넌트를 선택.
 *
 * 구조:
 *   equipment/
 *   ├── shared/     → 공유 폼 컴포넌트 (Equipment*Form.tsx)
 *   ├── basic/      → 딜라이브 일반
 *   ├── ftth/       → FTTH 인증상품
 *   └── lguplus/    → LGU+ 재판매
 */

// basic/ (딜라이브 일반)
import BasicInstall from './basic/EquipmentInstall';
import BasicTerminate from './basic/EquipmentTerminate';
import BasicAS from './basic/EquipmentAS';
import BasicSuspend from './basic/EquipmentSuspend';
import BasicChange from './basic/EquipmentChange';
import BasicInternalMove from './basic/EquipmentInternalMove';
import BasicRelocate from './basic/EquipmentRelocate';
import BasicRelocateTerminate from './basic/EquipmentRelocateTerminate';
import BasicRemoval from './basic/EquipmentRemoval';

// ftth/ (FTTH 인증상품)
import FtthInstall from './ftth/EquipmentInstall';
import FtthTerminate from './ftth/EquipmentTerminate';
import FtthAS from './ftth/EquipmentAS';
import FtthSuspend from './ftth/EquipmentSuspend';
import FtthChange from './ftth/EquipmentChange';
import FtthInternalMove from './ftth/EquipmentInternalMove';
import FtthRelocate from './ftth/EquipmentRelocate';
import FtthRelocateTerminate from './ftth/EquipmentRelocateTerminate';
import FtthRemoval from './ftth/EquipmentRemoval';

// lguplus/ (LGU+ 재판매)
import LguplusInstall from './lguplus/EquipmentInstall';
import LguplusTerminate from './lguplus/EquipmentTerminate';
import LguplusAS from './lguplus/EquipmentAS';
import LguplusSuspend from './lguplus/EquipmentSuspend';
import LguplusChange from './lguplus/EquipmentChange';
import LguplusInternalMove from './lguplus/EquipmentInternalMove';
import LguplusRelocate from './lguplus/EquipmentRelocate';
import LguplusRelocateTerminate from './lguplus/EquipmentRelocateTerminate';
import LguplusRemoval from './lguplus/EquipmentRemoval';

/** productType × WRK_CD 라우팅 테이블 */
const router: Record<ProductType, Record<string, React.FC<any>>> = {
  basic: {
    '01': BasicInstall,
    '02': BasicTerminate,
    '03': BasicAS,
    '04': BasicSuspend,
    '05': BasicChange,
    '06': BasicInternalMove,
    '07': BasicRelocate,
    '08': BasicRelocateTerminate,
    '09': BasicRemoval,
  },
  ftth: {
    '01': FtthInstall,
    '02': FtthTerminate,
    '03': FtthAS,
    '04': FtthSuspend,
    '05': FtthChange,
    '06': FtthInternalMove,
    '07': FtthRelocate,
    '08': FtthRelocateTerminate,
    '09': FtthRemoval,
  },
  lguplus: {
    '01': LguplusInstall,
    '02': LguplusTerminate,
    '03': LguplusAS,
    '04': LguplusSuspend,
    '05': LguplusChange,
    '06': LguplusInternalMove,
    '07': LguplusRelocate,
    '08': LguplusRelocateTerminate,
    '09': LguplusRemoval,
  },
};

import { EquipmentComponentProps } from './shared/types';

interface EquipmentRouterProps extends EquipmentComponentProps {
  // 추가 props 없음 - EquipmentComponentProps 그대로 사용
}

/**
 * WRK_CD별 장비정보 페이지 라우터
 * ProductTypeContext에서 상품유형을 가져와 productType × WRK_CD 조합으로 라우팅
 */
const EquipmentRouter: React.FC<EquipmentRouterProps> = (props) => {
  const { workItem } = props;
  const wrkCd = workItem.WRK_CD;
  const { productType } = useProductType();

  const Component = router[productType]?.[wrkCd] || router.basic[wrkCd] || BasicInstall;

  return <Component {...props} />;
};

// 작업유형명 반환 함수
export const getWorkTypeName = (wrkCd: string): string => {
  const workTypeMap: Record<string, string> = {
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
  return workTypeMap[wrkCd] || '작업';
};

export default EquipmentRouter;
