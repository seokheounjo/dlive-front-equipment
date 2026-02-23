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
 * | 04 | 정지 | mowoa03m04 | CompleteSuspend |
 * | 05 | 상품변경 | mowoa03m05 | CompleteChange |
 * | 06 | 댁내이전 | mowoa03m06 | CompleteInternalMove |
 * | 07 | 이전설치 | mowoa03m07 | CompleteRelocate |
 * | 08 | 이전철거 | mowoa03m08 | CompleteRelocateTerminate |
 * | 09 | 부가상품 | mowoa03m09 | CompleteRemoval |
 *
 * LGU+ Certify (isCertifyProd=true) 상품은 전용 래퍼 컴포넌트로 라우팅:
 * | WRK_CD | LGU+ 컴포넌트 | Certify 플로우 |
 * |--------|---------------|---------------|
 * | 01,06,07 | CompleteLGUInstall | LDAP -> CL-04 |
 * | 02,08 | CompleteLGUTerminate | CL-08 -> CL-06 |
 * | 03 | CompleteLGUAS | CL-08 -> CL-04 |
 * | 05 | CompleteLGUChange | CL-08 -> CL-06/CL-04 |
 */
import CompleteInstall from './CompleteInstall';           // 01: 설치
import CompleteTerminate from './CompleteTerminate';       // 02: 철거
import CompleteAS from './CompleteAS';                     // 03: A/S
import CompleteSuspend from './CompleteSuspend';           // 04: 정지
import CompleteChange from './CompleteChange';             // 05: 상품변경
import CompleteInternalMove from './CompleteInternalMove'; // 06: 댁내이전
import CompleteRelocate from './CompleteRelocate';         // 07: 이전설치
import CompleteRelocateTerminate from './CompleteRelocateTerminate'; // 08: 이전철거
import CompleteRemoval from './CompleteRemoval';           // 09: 부가상품

// LGU+ Certify 전용 래퍼 컴포넌트
import CompleteLGUInstall from './CompleteLGUInstall';           // 01,06,07 certify
import CompleteLGUTerminate from './CompleteLGUTerminate';       // 02,08 certify
import CompleteLGUAS from './CompleteLGUAS';                     // 03 certify
import CompleteLGUChange from './CompleteLGUChange';             // 05 certify

interface WorkCompleteRouterProps {
  order: WorkOrder;
  onBack: () => void;
  onSuccess: () => void;
  showToast?: (message: string, type: 'success' | 'error' | 'warning' | 'info') => void;
  equipmentData?: any;
  readOnly?: boolean;
  onEquipmentRefreshNeeded?: () => void; // Called when equipment transfer succeeds (WRK_CD=07)
  isCertifyProd?: boolean; // LGU+ certify product -> route to LGU+ components
}

/**
 * WRK_CD별 작업완료 페이지 라우터 (레거시 mowoa02m01.xml 기준)
 * isCertifyProd=true이면 LGU+ 전용 컴포넌트로 라우팅
 */
const WorkCompleteRouter: React.FC<WorkCompleteRouterProps> = (props) => {
  const { order, isCertifyProd } = props;
  const wrkCd = order.WRK_CD;

  // LGU+ Certify 상품: 전용 컴포넌트로 라우팅
  // 04(정지), 09(부가상품)은 certify 플로우 없음 -> 기존 컴포넌트 사용
  if (isCertifyProd) {
    switch (wrkCd) {
      case '01': case '06': case '07':
        return <CompleteLGUInstall {...props} />;
      case '02': case '08':
        return <CompleteLGUTerminate {...props} />;
      case '03':
        return <CompleteLGUAS {...props} />;
      case '05':
        return <CompleteLGUChange {...props} />;
      // 04, 09: certify 플로우 없음, fall through to default routing
    }
  }

  // WRK_CD에 따라 적절한 컴포넌트 반환 (비-certify 또는 certify 플로우 없는 작업유형)
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
      return <CompleteSuspend {...props} />;

    case '05':
      // 상품변경 (mowoa03m05)
      return <CompleteChange {...props} />;

    case '06':
      // 댁내이전 (mowoa03m06)
      return <CompleteInternalMove {...props} />;

    case '07':
      // 이전설치 (mowoa03m07)
      return <CompleteRelocate {...props} />;

    case '08':
      // 이전철거 (mowoa03m08)
      return <CompleteRelocateTerminate {...props} />;

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
