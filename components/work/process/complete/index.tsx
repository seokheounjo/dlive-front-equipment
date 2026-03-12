import React from 'react';
import { WorkOrder } from '../../../../types';
import { useProductType } from '../../../../hooks/useProductType';
import { ProductType } from './shared/types';

/**
 * WRK_CD × ProductType 라우터
 *
 * 진입 시점에서 ProductTypeContext로부터 상품유형을 가져와
 * productType + WRK_CD 조합으로 적절한 컴포넌트를 선택.
 *
 * 구조:
 *   complete/
 *   ├── shared/     → 공유 폼 컴포넌트 (CompleteXXXForm.tsx)
 *   ├── basic/      → 딜라이브 일반
 *   ├── ftth/       → FTTH 인증상품
 *   └── lguplus/    → LGU+ 재판매
 */

// basic/ (딜라이브 일반)
import BasicInstall from './basic/CompleteInstall';
import BasicTerminate from './basic/CompleteTerminate';
import BasicAS from './basic/CompleteAS';
import BasicSuspend from './basic/CompleteSuspend';
import BasicChange from './basic/CompleteChange';
import BasicInternalMove from './basic/CompleteInternalMove';
import BasicRelocate from './basic/CompleteRelocate';
import BasicRelocateTerminate from './basic/CompleteRelocateTerminate';
import BasicRemoval from './basic/CompleteRemoval';

// ftth/ (FTTH 인증상품)
import FtthInstall from './ftth/CompleteInstall';
import FtthTerminate from './ftth/CompleteTerminate';
import FtthAS from './ftth/CompleteAS';
import FtthSuspend from './ftth/CompleteSuspend';
import FtthChange from './ftth/CompleteChange';
import FtthInternalMove from './ftth/CompleteInternalMove';
import FtthRelocate from './ftth/CompleteRelocate';
import FtthRelocateTerminate from './ftth/CompleteRelocateTerminate';
import FtthRemoval from './ftth/CompleteRemoval';

// lguplus/ (LGU+ 재판매)
import LguplusInstall from './lguplus/CompleteInstall';
import LguplusTerminate from './lguplus/CompleteTerminate';
import LguplusAS from './lguplus/CompleteAS';
import LguplusSuspend from './lguplus/CompleteSuspend';
import LguplusChange from './lguplus/CompleteChange';
import LguplusInternalMove from './lguplus/CompleteInternalMove';
import LguplusRelocate from './lguplus/CompleteRelocate';
import LguplusRelocateTerminate from './lguplus/CompleteRelocateTerminate';
import LguplusRemoval from './lguplus/CompleteRemoval';

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

interface WorkCompleteRouterProps {
  order: WorkOrder;
  onBack: () => void;
  onSuccess: () => void;
  showToast?: (message: string, type: 'success' | 'error' | 'warning' | 'info') => void;
  equipmentData?: any;
  readOnly?: boolean;
  onEquipmentRefreshNeeded?: () => void;
}

/**
 * WRK_CD별 작업완료 페이지 라우터
 * ProductTypeContext에서 상품유형을 가져와 productType × WRK_CD 조합으로 라우팅
 */
const WorkCompleteRouter: React.FC<WorkCompleteRouterProps> = (props) => {
  const { order } = props;
  const wrkCd = order.WRK_CD;
  const { productType } = useProductType();

  const Component = router[productType]?.[wrkCd] || router.basic[wrkCd] || BasicInstall;

  return <Component {...props} />;
};

// 작업유형명 반환 함수 (레거시 CMWT000 코드 테이블)
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

// 작업상세유형명 반환 함수 (레거시 CMWT001 코드 테이블)
export const getWorkDetailTypeName = (wrkDtlTcd: string): string | null => {
  const detailTypeMap: Record<string, string> = {
    // 02 철거
    '0210': '해지',
    '0220': '직권해지',
    // 04 정지
    '0410': '일시정지',
    '0420': '일시정지해제',
    '0430': '일시철거',
    '0440': '일시철거복구',
    '0450': '직권정지',
    '0460': '직권정지해제',
    '0470': '직권정지철거',
    '0480': '직권정지철거복구',
    // 05 상품변경
    '0510': '상품변경설치',
    '0520': '상품변경철거',
    '0550': '서비스전환설치',
    '0560': '서비스전환철거',
  };
  return detailTypeMap[wrkDtlTcd] || null;
};

export default WorkCompleteRouter;
