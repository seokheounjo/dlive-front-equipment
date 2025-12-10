import { WorkOrder } from '../types';
import {
  isValidPhoneNumber,
  isValidDate,
  isValidSerialNumber,
  isValidAddress,
  isValidName
} from './formValidation';

/**
 * 작업 유형별 검증 로직
 */

// 작업 유형 코드 상수
export const WORK_TYPE_CODES = {
  INSTALLATION: '01',     // 개통
  TERMINATION: '02',      // 해지
  AS: '03',               // A/S
  RELOCATION: '04',       // 이전
  PRODUCT_CHANGE: '05',   // 상품변경
  SUSPENSION: '06',       // 정지
  REMOVAL_MOVE: '07',     // 철거(이전)
  REMOVAL_TERM: '08',     // 철거(해지)
  ETC: '09',              // 기타
  TEMP_SUSPENSION: '0410', // 일시정지
  SUSPENSION_RELEASE: '0420' // 일시정지 해제
} as const;

// 계약 상태 코드 상수
export const CONTRACT_STATUS_CODES = {
  INSTALL_SCHEDULED: '10',  // 설치예정
  ACTIVE: '20',             // 정상
  SUSPENDED: '30',          // 일시정지
  SUSPENDED_SPECIFIC: '37', // 일시정지(특정)
  TERMINATED: '90'          // 해지완료
} as const;

// 작업 상태 코드 상수
export const WORK_STATUS_CODES = {
  RECEIVED: '1',            // 접수
  ASSIGNED: '2',            // 할당
  CANCELLED: '3',           // 취소
  COMPLETED: '4',           // 완료
  PARTIAL_COMPLETED: '7',   // 부분완료
  DELETED: '9'              // 삭제
} as const;

/**
 * 작업 유형 확인 헬퍼 함수들
 */
export const isInstallWork = (wrkCd?: string): boolean => {
  return wrkCd === WORK_TYPE_CODES.INSTALLATION;
};

export const isASWork = (wrkCd?: string): boolean => {
  return wrkCd === WORK_TYPE_CODES.AS;
};

export const isTerminationWork = (wrkCd?: string): boolean => {
  return wrkCd === WORK_TYPE_CODES.TERMINATION;
};

export const isRemovalWork = (wrkCd?: string): boolean => {
  return wrkCd === WORK_TYPE_CODES.REMOVAL_MOVE ||
         wrkCd === WORK_TYPE_CODES.REMOVAL_TERM;
};

export const isProductChangeWork = (wrkCd?: string): boolean => {
  return wrkCd === WORK_TYPE_CODES.PRODUCT_CHANGE;
};

export const isRelocationWork = (wrkCd?: string): boolean => {
  return wrkCd === WORK_TYPE_CODES.RELOCATION;
};

export const isSuspensionWork = (wrkCd?: string): boolean => {
  return wrkCd === WORK_TYPE_CODES.SUSPENSION ||
         wrkCd === WORK_TYPE_CODES.TEMP_SUSPENSION ||
         wrkCd === WORK_TYPE_CODES.SUSPENSION_RELEASE;
};

export const isTempSuspensionWork = (wrkCd?: string): boolean => {
  return wrkCd === WORK_TYPE_CODES.TEMP_SUSPENSION;
};

export const isSuspensionReleaseWork = (wrkCd?: string): boolean => {
  return wrkCd === WORK_TYPE_CODES.SUSPENSION_RELEASE;
};

/**
 * 작업 유형별 계약 상태 검증
 *
 * 각 작업 유형에 따라 허용되는 계약 상태를 검증합니다.
 *
 * @param wrkCd 작업 유형 코드
 * @param ctrtStat 계약 상태 코드
 * @returns 유효한 계약 상태이면 true
 */
export const isValidContractStatus = (wrkCd: string, ctrtStat: string): boolean => {
  if (!wrkCd || !ctrtStat) {
    return false;
  }

  switch (wrkCd) {
    case WORK_TYPE_CODES.INSTALLATION: // 01: 개통
      // 설치예정 상태만 허용
      return ctrtStat === CONTRACT_STATUS_CODES.INSTALL_SCHEDULED;

    case WORK_TYPE_CODES.TERMINATION: // 02: 해지
      // 정상 또는 일시정지 상태만 허용 (해지완료 제외)
      return ctrtStat === CONTRACT_STATUS_CODES.ACTIVE ||
             ctrtStat === CONTRACT_STATUS_CODES.SUSPENDED ||
             ctrtStat === CONTRACT_STATUS_CODES.SUSPENDED_SPECIFIC;

    case WORK_TYPE_CODES.AS: // 03: A/S
      // 해지완료 제외 모든 상태 허용
      return ctrtStat !== CONTRACT_STATUS_CODES.TERMINATED;

    case WORK_TYPE_CODES.TEMP_SUSPENSION: // 0410: 일시정지
      // 정상 상태만 허용
      return ctrtStat === CONTRACT_STATUS_CODES.ACTIVE;

    case WORK_TYPE_CODES.SUSPENSION_RELEASE: // 0420: 정지해제
      // 일시정지 상태만 허용
      return ctrtStat === CONTRACT_STATUS_CODES.SUSPENDED ||
             ctrtStat === CONTRACT_STATUS_CODES.SUSPENDED_SPECIFIC;

    case WORK_TYPE_CODES.RELOCATION: // 04: 이전
    case WORK_TYPE_CODES.PRODUCT_CHANGE: // 05: 상품변경
    case WORK_TYPE_CODES.REMOVAL_MOVE: // 07: 철거(이전)
    case WORK_TYPE_CODES.REMOVAL_TERM: // 08: 철거(해지)
      // 정상 상태만 허용
      return ctrtStat === CONTRACT_STATUS_CODES.ACTIVE;

    default:
      // 기타 작업은 해지완료 제외
      return ctrtStat !== CONTRACT_STATUS_CODES.TERMINATED;
  }
};

/**
 * 계약 상태 검증 결과 메시지
 *
 * @param wrkCd 작업 유형 코드
 * @param ctrtStat 계약 상태 코드
 * @returns 검증 결과 객체
 */
export const validateContractStatus = (
  wrkCd: string,
  ctrtStat: string
): { valid: boolean; message?: string } => {
  const valid = isValidContractStatus(wrkCd, ctrtStat);

  if (valid) {
    return { valid: true };
  }

  // 에러 메시지 생성
  let message = '현재 계약 상태에서는 이 작업을 수행할 수 없습니다.';

  switch (wrkCd) {
    case WORK_TYPE_CODES.INSTALLATION:
      message = '개통 작업은 설치예정 상태에서만 가능합니다.';
      break;
    case WORK_TYPE_CODES.TERMINATION:
      message = '해지 작업은 정상 또는 일시정지 상태에서만 가능합니다.';
      break;
    case WORK_TYPE_CODES.TEMP_SUSPENSION:
      message = '일시정지는 정상 상태에서만 가능합니다.';
      break;
    case WORK_TYPE_CODES.SUSPENSION_RELEASE:
      message = '정지해제는 일시정지 상태에서만 가능합니다.';
      break;
    case WORK_TYPE_CODES.AS:
      message = 'A/S 작업은 해지완료 상태에서는 불가능합니다.';
      break;
  }

  return { valid: false, message };
};

/**
 * 작업 상태 전환 검증
 *
 * 현재 작업 상태에서 새로운 상태로 전환이 가능한지 검증합니다.
 *
 * 전환 규칙:
 * - 1(접수) → 2(할당), 3(취소)
 * - 2(할당) → 3(취소), 4(완료), 7(부분완료)
 * - 7(부분완료) → 4(완료)
 *
 * @param currentStatus 현재 작업 상태 코드
 * @param newStatus 새로운 작업 상태 코드
 * @returns 검증 결과 객체
 */
export const isValidStatusTransition = (
  currentStatus: string,
  newStatus: string
): { valid: boolean; message?: string } => {
  if (!currentStatus || !newStatus) {
    return { valid: false, message: '작업 상태 정보가 올바르지 않습니다.' };
  }

  // 같은 상태로 전환은 허용하지 않음
  if (currentStatus === newStatus) {
    return { valid: false, message: '이미 해당 상태입니다.' };
  }

  const transitions: { [key: string]: string[] } = {
    [WORK_STATUS_CODES.RECEIVED]: [
      WORK_STATUS_CODES.ASSIGNED,
      WORK_STATUS_CODES.CANCELLED
    ],
    [WORK_STATUS_CODES.ASSIGNED]: [
      WORK_STATUS_CODES.CANCELLED,
      WORK_STATUS_CODES.COMPLETED,
      WORK_STATUS_CODES.PARTIAL_COMPLETED
    ],
    [WORK_STATUS_CODES.PARTIAL_COMPLETED]: [
      WORK_STATUS_CODES.COMPLETED
    ]
  };

  const allowedTransitions = transitions[currentStatus] || [];

  if (!allowedTransitions.includes(newStatus)) {
    let message = '해당 상태로 전환할 수 없습니다.';

    if (currentStatus === WORK_STATUS_CODES.COMPLETED) {
      message = '이미 완료된 작업입니다.';
    } else if (currentStatus === WORK_STATUS_CODES.CANCELLED) {
      message = '이미 취소된 작업입니다.';
    } else if (newStatus === WORK_STATUS_CODES.CANCELLED &&
               currentStatus !== WORK_STATUS_CODES.RECEIVED &&
               currentStatus !== WORK_STATUS_CODES.ASSIGNED) {
      message = '접수 또는 할당 상태에서만 취소가 가능합니다.';
    }

    return { valid: false, message };
  }

  return { valid: true };
};

/**
 * 작업 취소 가능 여부 확인
 *
 * @param workStatus 현재 작업 상태
 * @returns 취소 가능하면 true
 */
export const isCancellable = (workStatus?: string): boolean => {
  if (!workStatus) {
    return false;
  }

  return workStatus === WORK_STATUS_CODES.RECEIVED ||
         workStatus === WORK_STATUS_CODES.ASSIGNED;
};

/**
 * 작업 완료 시 필수 입력 항목 검증
 */
export interface WorkCompleteData {
  equipmentList?: any[];
  removeEquipmentList?: any[];
  spendItemList?: any[];
  agreementList?: any[];
  poleList?: any[];
  workInfo?: any;
}

export const validateWorkComplete = (order: WorkOrder, data: WorkCompleteData): { valid: boolean; errors: string[] } => {
  const errors: string[] = [];

  // 공통 필수 항목 검증
  if (!data.workInfo?.REG_UID && !data.workInfo?.CHG_UID) {
    errors.push('사용자 정보가 필요합니다.');
  }

  // 고객 정보 검증
  if (order.customer) {
    // 고객명 검증
    if (order.customer.name && !isValidName(order.customer.name)) {
      errors.push('고객명이 올바르지 않습니다. (한글/영문 2-20자)');
    }

    // 전화번호 검증
    if (order.customer.phone && !isValidPhoneNumber(order.customer.phone)) {
      errors.push('전화번호 형식이 올바르지 않습니다. (예: 010-1234-5678)');
    }

    // 주소 검증
    if (order.customer.address && !isValidAddress(order.customer.address)) {
      errors.push('주소를 10자 이상 입력해주세요.');
    }
  }

  // 장비 시리얼 번호 검증
  if (data.equipmentList && data.equipmentList.length > 0) {
    data.equipmentList.forEach((equipment, index) => {
      if (equipment.serialNumber && !isValidSerialNumber(equipment.serialNumber)) {
        errors.push(`설치 장비 ${index + 1}의 시리얼 번호가 올바르지 않습니다. (영문+숫자 조합 6자 이상)`);
      }
    });
  }

  if (data.removeEquipmentList && data.removeEquipmentList.length > 0) {
    data.removeEquipmentList.forEach((equipment, index) => {
      if (equipment.serialNumber && !isValidSerialNumber(equipment.serialNumber)) {
        errors.push(`회수 장비 ${index + 1}의 시리얼 번호가 올바르지 않습니다. (영문+숫자 조합 6자 이상)`);
      }
    });
  }

  // 날짜 형식 검증
  if (order.susHopeDd && !isValidDate(order.susHopeDd)) {
    errors.push('정지 희망일 형식이 올바르지 않습니다. (YYYYMMDD)');
  }

  if (order.mmtSusHopeDd && !isValidDate(order.mmtSusHopeDd)) {
    errors.push('재개 희망일 형식이 올바르지 않습니다. (YYYYMMDD)');
  }

  // 계약 상태 검증
  if (order.WRK_CD && order.CTRT_STAT) {
    const contractValidation = validateContractStatus(order.WRK_CD, order.CTRT_STAT);
    if (!contractValidation.valid) {
      errors.push(contractValidation.message || '계약 상태가 올바르지 않습니다.');
    }
  }

  // 작업 유형별 필수 항목 검증
  switch (order.WRK_CD) {
    case WORK_TYPE_CODES.INSTALLATION: // 개통 (신규설치)
      if (!data.installEquipments || data.installEquipments.length === 0) {
        errors.push('설치 장비를 입력해야 합니다.');
      }
      if (!data.agreements || data.agreements.length === 0) {
        errors.push('약관 동의가 필요합니다.');
      }
      break;

    case WORK_TYPE_CODES.AS: // A/S
      if (!data.installEquipments || data.installEquipments.length === 0) {
        errors.push('교체/수리한 장비 정보를 입력해야 합니다.');
      }
      break;

    case WORK_TYPE_CODES.TERMINATION: // 해지
      if (!data.removeEquipments || data.removeEquipments.length === 0) {
        errors.push('회수한 장비 정보를 입력해야 합니다.');
      }
      if (!order.termReasonCode && !data.workInfo?.TERM_RESN_CD) {
        errors.push('해지 사유를 선택해야 합니다.');
      }
      break;

    case WORK_TYPE_CODES.REMOVAL_MOVE: // 철거(이전)
    case WORK_TYPE_CODES.REMOVAL_TERM: // 철거(해지)
      if (!data.removeEquipments || data.removeEquipments.length === 0) {
        errors.push('철거한 장비 정보를 입력해야 합니다.');
      }
      break;

    case WORK_TYPE_CODES.PRODUCT_CHANGE: // 상품변경
      if (!order.newProduct && !data.workInfo?.NEW_PROD_CD) {
        errors.push('변경할 상품을 선택해야 합니다.');
      }
      break;

    case WORK_TYPE_CODES.TEMP_SUSPENSION: // 일시정지
      if (!order.mmtSusCd && !data.workInfo?.MMT_SUS_CD) {
        errors.push('일시정지 사유를 선택해야 합니다.');
      }
      if (!order.susHopeDd || !order.mmtSusHopeDd) {
        if (!data.workInfo?.SUS_HOPE_DD || !data.workInfo?.MMT_SUS_HOPE_DD) {
          errors.push('정지 및 재개 희망일을 입력해야 합니다.');
        }
      }
      break;

    case WORK_TYPE_CODES.RELOCATION: // 이전
      if (!data.installEquipments || data.installEquipments.length === 0) {
        errors.push('이전 설치할 장비 정보를 입력해야 합니다.');
      }
      break;

    default:
      // 기본적으로 작업 완료 정보만 확인
      if (!data.workInfo || !data.workInfo.WRK_ID) {
        errors.push('작업 정보가 올바르지 않습니다.');
      }
      break;
  }

  return {
    valid: errors.length === 0,
    errors
  };
};

/**
 * 작업 취소 시 검증
 */
export const validateWorkCancel = (
  order: WorkOrder,
  cancelReasonCode: string,
  cancelDetail?: string
): { valid: boolean; errors: string[] } => {
  const errors: string[] = [];

  // 취소 사유 필수 체크
  if (!cancelReasonCode || cancelReasonCode.trim() === '') {
    errors.push('취소 사유를 선택해야 합니다.');
  }

  // 작업 상태 체크 - 접수(1) 또는 할당(2) 상태에서만 취소 가능
  if (order.WRK_STAT_CD) {
    if (!isCancellable(order.WRK_STAT_CD)) {
      errors.push('접수 또는 할당 상태에서만 작업을 취소할 수 있습니다.');
    }
  }

  // 기타 사유인 경우 상세 내용 필수
  if (cancelReasonCode === '099Z') {
    if (!cancelDetail || cancelDetail.trim().length < 10) {
      errors.push('기타 사유 선택 시 상세 내용을 10자 이상 입력해야 합니다.');
    }
  }

  // 철거 작업의 특수 취소 사유 처리
  if (order.WRK_CD === WORK_TYPE_CODES.REMOVAL_MOVE && cancelReasonCode === '0136') {
    // 특수 취소 사유 - 추가 검증 필요 시 여기에 추가
  }

  return {
    valid: errors.length === 0,
    errors
  };
};

/**
 * 검증 오류 메시지 생성
 *
 * @param validationType 검증 유형
 * @param fieldName 필드명
 * @param additionalInfo 추가 정보
 * @returns 상세한 오류 메시지
 */
export const getValidationErrorMessage = (
  validationType: string,
  fieldName: string,
  additionalInfo?: string
): string => {
  const messages: { [key: string]: string } = {
    'required': `${fieldName}은(는) 필수 입력 항목입니다.`,
    'format': `${fieldName}의 형식이 올바르지 않습니다.`,
    'length': `${fieldName}의 길이가 올바르지 않습니다.`,
    'range': `${fieldName}의 값이 허용 범위를 벗어났습니다.`,
    'phone': '전화번호 형식이 올바르지 않습니다. (예: 010-1234-5678)',
    'date': '날짜 형식이 올바르지 않습니다. (YYYYMMDD)',
    'serial': '시리얼 번호는 영문+숫자 조합 6자 이상이어야 합니다.',
    'address': '주소는 10자 이상 입력해야 합니다.',
    'name': '이름은 한글 또는 영문 2-20자로 입력해야 합니다.',
    'equipment': '장비 정보를 입력해야 합니다.',
    'agreement': '약관 동의가 필요합니다.',
    'reason': '사유를 선택해야 합니다.',
    'contract_status': '계약 상태가 올바르지 않습니다.',
    'work_status': '작업 상태가 올바르지 않습니다.'
  };

  let message = messages[validationType] || `${fieldName} 검증에 실패했습니다.`;

  if (additionalInfo) {
    message += ` ${additionalInfo}`;
  }

  return message;
};

/**
 * 작업 유형에 따른 완료 버튼 텍스트
 */
export const getCompleteButtonText = (wrkCd?: string): string => {
  switch (wrkCd) {
    case WORK_TYPE_CODES.INSTALLATION:
      return '설치 완료';
    case WORK_TYPE_CODES.AS:
      return 'A/S 완료';
    case WORK_TYPE_CODES.TERMINATION:
      return '해지 완료';
    case WORK_TYPE_CODES.REMOVAL_MOVE:
    case WORK_TYPE_CODES.REMOVAL_TERM:
      return '철거 완료';
    case WORK_TYPE_CODES.PRODUCT_CHANGE:
      return '상품변경 완료';
    case WORK_TYPE_CODES.SUSPENSION:
    case WORK_TYPE_CODES.TEMP_SUSPENSION:
      return '정지처리 완료';
    case WORK_TYPE_CODES.SUSPENSION_RELEASE:
      return '정지해제 완료';
    default:
      return '작업 완료';
  }
};

/**
 * 작업 유형에 따른 안내 메시지
 */
export const getWorkTypeGuideMessage = (wrkCd?: string): string => {
  switch (wrkCd) {
    case WORK_TYPE_CODES.INSTALLATION:
      return '신규 설치 작업입니다. 장비 설치 및 약관 동의를 완료해주세요.';
    case WORK_TYPE_CODES.AS:
      return 'A/S 작업입니다. 고장 원인을 확인하고 장비를 교체/수리해주세요.';
    case WORK_TYPE_CODES.TERMINATION:
      return '해지 작업입니다. 모든 장비를 회수하고 위약금을 안내해주세요.';
    case WORK_TYPE_CODES.REMOVAL_MOVE:
      return '이전을 위한 철거 작업입니다. 장비를 안전하게 철거해주세요.';
    case WORK_TYPE_CODES.REMOVAL_TERM:
      return '해지를 위한 철거 작업입니다. 모든 장비를 회수해주세요.';
    case WORK_TYPE_CODES.PRODUCT_CHANGE:
      return '상품 변경 작업입니다. 고객에게 변경 내용을 안내해주세요.';
    case WORK_TYPE_CODES.SUSPENSION:
    case WORK_TYPE_CODES.TEMP_SUSPENSION:
      return '일시정지 작업입니다. 고객 요청 사유를 확인해주세요.';
    case WORK_TYPE_CODES.SUSPENSION_RELEASE:
      return '정지 해제 작업입니다. 서비스를 재개해주세요.';
    default:
      return '작업을 진행해주세요.';
  }
};
