/**
 * 장비관리 공통 타입 정의
 * 레거시 참조: mowoDivD01.xml, mowoDivD05.xml
 */

import { Equipment, WorkItem } from '../../../../../types';

// 확장 장비 타입 (레거시 필드 포함)
export interface ExtendedEquipment extends Equipment {
  itemMidCd?: string;         // 04:모뎀, 05:셋톱박스, 07:특수장비, 03:추가장비
  eqtClCd?: string;           // 장비 클래스 코드 (모델 코드)
  macAddress?: string;
  installLocation?: string;
  // 레거시 시스템 필수 필드
  SVC_CMPS_ID?: string;
  WRK_ID?: string;
  CUST_ID?: string;
  CTRT_ID?: string;
  BASIC_PROD_CMPS_ID?: string;
  EQT_PROD_CMPS_ID?: string;
  MST_SO_ID?: string;
  SO_ID?: string;
  REG_UID?: string;
  OLD_LENT_YN?: string;
  WRK_CD?: string;
  EQT_CHG_GB?: string;
  IF_DTL_ID?: string;
  PROD_CD?: string;
  SVC_CD?: string;
  EQT_SALE_AMT?: string;
  LENT?: string;
  LENT_YN?: string;           // 대여 여부 (40: 고객 소유)
  ITLLMT_PRD?: string;
  EQT_USE_STAT_CD?: string;
  ITEM_CD?: string;           // 품목 코드
  EQT_UNI_ID?: string;        // 장비 고유 ID
  STB_CM_MAC?: string;        // STB CM MAC
  STB_RTCA_ID?: string;       // STB RTCA ID
  OWNER_TP_CD?: string;       // 소유자 구분 코드
  EQT_CL_NM?: string;         // 장비 클래스명
  EQT_LOC_TP_NM?: string;     // 장비 위치 타입명
  VOIP_CUSTOWN_EQT?: string;  // VoIP 고객소유 장비 여부
  CRR_TSK_CL?: string;        // 작업 구분 (01:설치, 02:철거, 03:AS)
  EQT_KND?: string;           // 장비 종류 (RMV:철거, CUST:고객)
  BAR_CD?: string;            // 바코드
  CHG_RESN_CD?: string;       // 변경사유코드
}

// 계약 장비
export interface ContractEquipment extends ExtendedEquipment {}

// 고객 설치 장비 (계약 장비 + 실제 재고 매핑)
export interface InstalledEquipment {
  contractEquipment: ContractEquipment;
  actualEquipment: ExtendedEquipment;
  macAddress?: string;
  installLocation?: string;
}

// 분실 상태 저장 데이터 타입 (작업완료 시 API 호출용)
export interface LossStatusData {
  EQT_NO: string;
  EQT_SERNO: string;
  EQT_CL_CD: string;
  EQT_CL: string;
  EQT_CL_NM: string;
  ITEM_MID_CD: string;
  SVC_CMPS_ID: string;
  BASIC_PROD_CMPS_ID: string;
  LENT_YN: string;
  EQT_LOSS_YN: string;
  PART_LOSS_BRK_YN: string;
  EQT_BRK_YN: string;
  EQT_CABL_LOSS_YN: string;
  EQT_CRDL_LOSS_YN: string;
}

// 장비 데이터 (저장용)
export interface EquipmentData {
  installedEquipments: Equipment[];
  removedEquipments: Equipment[];
  pendingLossStatusList?: LossStatusData[]; // 작업완료 시 분실처리 API 호출용
}

// 철거 장비 분실/파손 상태
export interface RemovalStatus {
  [key: string]: {
    EQT_LOSS_YN?: string;        // 장비분실
    PART_LOSS_BRK_YN?: string;   // 아답터분실
    EQT_BRK_YN?: string;         // 리모콘분실
    EQT_CABL_LOSS_YN?: string;   // 케이블분실
    EQT_CRDL_LOSS_YN?: string;   // 크래들분실
  };
}

// 장비관리 공통 Props
export interface EquipmentComponentProps {
  workItem: WorkItem;
  onSave: (data: EquipmentData) => void;
  onBack: () => void;
  showToast?: (message: string, type: 'success' | 'error' | 'warning' | 'info') => void;
  preloadedApiData?: any;
  onPreloadedDataUpdate?: (newData: any) => void;
  readOnly?: boolean;
}

// 작업코드 → 한글 변환 (레거시 CMWT000 코드 테이블)
export const getWorkCodeName = (wrkCd?: string): string => {
  const codeMap: { [key: string]: string } = {
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
  return codeMap[wrkCd || ''] || '';
};

// 계약상태코드 → 한글 변환 (레거시 CMCU036 코드 테이블)
export const getContractStatusName = (ctrtStat?: string): string => {
  const statusMap: { [key: string]: string } = {
    '10': '설치예정',
    '20': '정상',
    '30': '일시정지',
    '40': '해지예정',
    '90': '해지완료',
  };
  return statusMap[ctrtStat || ''] || '';
};

// 이전설치(06, 07) 작업에서 재사용 가능한 장비 코드 (레거시 mowoDivD05.xml)
export const MOVE_INSTALL_REUSABLE_EQT_CL_CDS = [
  '091001', // 공유기(WIFI)
  '091005', // 공유기(WIFI5)
  '091006', // 공유기(WIFI6)
  '091401', // 스마트공유기
  '092401', // OTT_STB(임대용/H5)
  '090251', // 기가와이파이-GU
];

// WRK_CD를 CRR_TSK_CL로 매핑하는 헬퍼 함수
export const mapWrkCdToCrrTskCl = (wrkCd?: string): string => {
  if (!wrkCd) return '01'; // 기본값

  // WRK_CD IN ('01','05','06','07','09') → CRR_TSK_CL = '01' (설치 관련)
  if (['01', '05', '06', '07', '09'].includes(wrkCd)) {
    return '01';
  }
  // WRK_CD IN ('02','08') → CRR_TSK_CL = '02' (철거/이전철거)
  if (['02', '08'].includes(wrkCd)) {
    return '02';
  }
  // WRK_CD = '03' → CRR_TSK_CL = '03' (AS)
  if (wrkCd === '03') {
    return '03';
  }
  // WRK_CD = '04' → CRR_TSK_CL = '04' (정지)
  // 정지는 철거와 다르게 계약장비/기사장비가 필요함
  if (wrkCd === '04') {
    return '04';
  }

  return '01'; // 기본값
};

// 장비 타입명 변환 (ITEM_MID_CD → 한글)
export const getEquipmentTypeName = (itemMidCd?: string): string => {
  const typeMap: { [key: string]: string } = {
    '01': '라우터',
    '02': '무선장비',
    '03': '추가장비',
    '04': '모뎀',
    '05': '셋톱박스',
    '07': '특수장비',
    '08': 'VoIP',
  };
  return typeMap[itemMidCd || ''] || '기타';
};

// 고객소유 장비 여부 확인 (분실처리 불가 조건)
export const isCustomerOwnedEquipment = (equipment: ExtendedEquipment): boolean => {
  return (
    equipment.LENT_YN === '40' ||
    equipment.VOIP_CUSTOWN_EQT === 'Y' ||
    equipment.eqtClCd === '090852'
  );
};

// localStorage 키 생성
export const getEquipmentStorageKey = (workItemId: string) => `equipment_draft_${workItemId}`;

// STB 장비 여부 확인 (셋톱박스)
// itemMidCd=04 또는 05, 또는 모델명에 STB 포함
export const isSTBEquipment = (equipment: ExtendedEquipment | ContractEquipment): boolean => {
  const itemMidCd = equipment.itemMidCd || '';
  const model = (equipment.model || '').toUpperCase();
  const type = (equipment.type || '').toUpperCase();
  const eqtClCd = (equipment.eqtClCd || '').toUpperCase();

  // itemMidCd가 04(STB) 또는 05(셋톱박스)
  if (itemMidCd === '04' || itemMidCd === '05') {
    return true;
  }

  // 모델명이나 타입명에 STB 포함
  if (model.includes('STB') || type.includes('STB') || type.includes('셋톱')) {
    return true;
  }

  // eqtClCd가 09로 시작 (STB 계열)
  if (eqtClCd.startsWith('09')) {
    return true;
  }

  return false;
};

// 스마트카드/케이블카드 장비 여부 확인
// itemMidCd=03, 또는 모델명/타입명에 카드, CARD, 스마트 포함
export const isCardEquipment = (equipment: ExtendedEquipment | ContractEquipment): boolean => {
  const itemMidCd = equipment.itemMidCd || '';
  const model = (equipment.model || '').toUpperCase();
  const type = (equipment.type || '').toUpperCase();

  // itemMidCd가 03(추가장비 - 카드류 포함)
  if (itemMidCd === '03') {
    return true;
  }

  // 모델명이나 타입명에 카드, CARD, 스마트, SMART, 케이블 포함
  if (
    model.includes('CARD') || model.includes('카드') ||
    model.includes('SMART') || model.includes('스마트') ||
    model.includes('CABLE') || model.includes('케이블') ||
    type.includes('CARD') || type.includes('카드') ||
    type.includes('SMART') || type.includes('스마트')
  ) {
    return true;
  }

  return false;
};

// 같은 상품 구성에 속하는 장비인지 확인 (SVC_CMPS_ID 또는 BASIC_PROD_CMPS_ID 기반)
export const isSameProductGroup = (
  equipment1: ExtendedEquipment | ContractEquipment,
  equipment2: ExtendedEquipment | ContractEquipment
): boolean => {
  // BASIC_PROD_CMPS_ID가 같으면 같은 상품 구성
  if (equipment1.BASIC_PROD_CMPS_ID && equipment2.BASIC_PROD_CMPS_ID) {
    return equipment1.BASIC_PROD_CMPS_ID === equipment2.BASIC_PROD_CMPS_ID;
  }

  // PROD_CD가 같으면 같은 상품
  if (equipment1.PROD_CD && equipment2.PROD_CD) {
    return equipment1.PROD_CD === equipment2.PROD_CD;
  }

  return false;
};
