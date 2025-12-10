
export enum WorkOrderStatus {
  Pending = '진행중',
  Completed = '완료',
  Cancelled = '취소',
}

export enum WorkOrderType {
  Installation = '신규설치',
  AS = 'A/S',
  Change = '상품변경',
  Move = '이전설치',
  Etc = '기타', // API 응답에 대한 기본값 추가
}

export interface Customer {
  id: string;
  name: string;
  phone?: string; // Made optional as it's not in the API response
  address: string;
  isVip?: boolean; // VIP 고객 여부
  vipLevel?: 'VIP' | 'VVIP'; // VIP 등급
}

export interface Equipment {
  id: string;
  type: string;                // 장비 유형
  model: string;               // 모델명
  serialNumber: string;        // 시리얼 번호
  itemMidCd?: string;          // ITEM_MID_CD (04:모뎀, 05:셋톱박스, 07:특수장비, 03:추가장비, 02:기타)
}

// 장비 모델 타입 정의
export interface EquipmentModelType {
  code: string;        // ITEM_MID_CD
  name: string;        // 한글명
  icon: string;        // 아이콘
}

// 장비 모델 타입 상수
export const EQUIPMENT_MODEL_TYPES: EquipmentModelType[] = [
  { code: '04', name: '모뎀', icon: '' },
  { code: '05', name: '셋톱박스', icon: '' },
  { code: '07', name: '특수장비', icon: '' },
  { code: '03', name: '추가장비', icon: '' },
  { code: '02', name: '기타', icon: '' },
];

// 장비정보변경 요청 데이터
export interface EquipmentChangeRequest {
  CTRT_ID: string;           // 계약 ID
  RCPT_ID?: string;          // 접수 ID
  WRK_ID: string;            // 작업 ID
  CRR_ID?: string;           // 통신사 ID
  WRKR_ID: string;           // 작업자 ID
  REG_UID: string;           // 등록자 ID
  PROD_GRPS?: string;        // 상품 그룹
  PROD_CMPS_CLS?: string;    // 상품 구성 클래스
  PROD_CDS?: string;         // 상품 코드
  PROD_CNT?: string;         // 상품 개수
  SVC_CDS?: string;          // 서비스 코드
  ITEM_MID_CDS: string;      // 장비 모델 코드 (변경할 값)
  EQT_CLS?: string;          // 장비 클래스
  LENTS?: string;            // 대여 정보
  EQT_USE_STATS?: string;    // 장비 사용 상태
  EQT_SALE_AMTS?: string;    // 장비 판매 금액
  ITLLMT_PRDS?: string;      // 할부 기간
  SERVICE_CNT?: string;      // 서비스 개수
  WRKR_CMPL_DT?: string;     // 작업자 완료 일시
  CTRT_KEEP_YN?: string;     // 계약 유지 여부
}

// 작업지시서 (기존 WorkOrder를 변경)
export interface WorkDirection {
  id: string;              // WRK_DRCTN_ID
  type: WorkOrderType;
  typeDisplay: string;
  status: WorkOrderStatus;
  scheduledAt: string;
  customer: Customer;
  details: string;
  totalWorks: number;      // 총 작업 개수
  completedWorks: number;  // 완료된 작업 개수
}

// 개별 작업 (새로 추가)
export interface WorkItem {
  id: string;              // WRK_ID
  directionId: string;     // WRK_DRCTN_ID (부모)
  type: WorkOrderType;
  typeDisplay: string;
  status: WorkOrderStatus;
  scheduledAt: string;
  customer: Customer;
  details: string;
  assignedEquipment: Equipment[];
  productName?: string;    // 상품명
  cellNo?: string;         // CELL NO
  installLocation?: string; // 설치위치

  // 작업 분기처리 필드
  WRK_CD?: string;         // 작업코드 (01:개통, 02:해지, 03:AS, 04:이전, 05:상품변경, 06:정지, 07:철거(이전), 08:철거(해지), 09:기타, 0410:일시정지, 0420:일시정지해제)
  WRK_CD_NM?: string;      // 작업코드명 (설치, 해지, A/S, 이전, 상품변경 등 - 백엔드 CMWT000 코드 테이블 값)
  WRK_DTL_TCD?: string;    // 작업 세부 유형 코드
  WRK_STAT_CD?: string;    // 작업 상태 코드 (1:접수, 2:할당, 3:취소, 4:완료, 7:부분완료, 9:삭제)
  WRK_DRCTN_ID?: string;   // 작업지시 ID (directionId와 동일하지만 API 호출 시 필요)

  // 계약 정보
  CUST_ID?: string;        // 고객 ID (계약정보 API 호출에 필요)
  CTRT_ID?: string;        // 계약 ID
  CTRT_STAT?: string;      // 계약 상태 (10:설치예정, 20:정상, 30:일시정지, 37:일시정지(특정), 90:해지완료 등)
  CTRT_STAT_NM?: string;   // 계약 상태명
  RCPT_ID?: string;        // 접수 ID
  SO_NM?: string;          // 지사명

  // 상품 정보
  PROD_NM?: string;        // 상품명
  PROD_GRP?: string;       // 상품 그룹 (D:DTV, V:VoIP, I:Internet, C:Cable)

  // 납부방법/약정정보
  PYM_MTHD?: string;       // 납부방법
  PYM_ACNT_ID?: string;    // 납부계정ID
  AGRE_MON?: string;       // 약정개월
  AGRE_STRT_DT?: string;   // 약정시작일
  AGRE_END_DT?: string;    // 약정종료일
  RATE_STRT_DT?: string;   // 요금시작일
  RATE_END_DT?: string;    // 요금종료일
  PROM_CNT?: string;       // 프로모션 개월수
  CTRT_APLY_STRT_DT?: string; // 계약적용시작일
  CTRT_APLY_END_DT?: string;  // 계약적용종료일

  // 단체정보
  GRP_ID?: string;         // 단체ID
  GRP_NM?: string;         // 단체명

  // VoIP
  VOIP_TEL_NO?: string;    // VoIP번호

  // 가입동기
  SUBS_MOT_NM?: string;    // 가입동기명

  // 신분할인 관련
  CUST_CL_DC_APLY_YN?: string; // 신분할인적용여부
  PNTY_EXMP_YN?: string;       // 위약금면제여부
  TERM_CALC_YN?: string;       // 해지위약금계산여부
  IP_CNT?: string;             // IP수

  // 청구/미납 정보
  BILL_AMT_BEFORE?: string;    // 변경전청구금액
  BILL_AMT?: string;           // 청구금액
  UPYM_AMT?: string;           // 총미납금

  // 추가 작업 관련 정보
  SO_ID?: string;          // 지점 ID
  PROD_CD?: string;        // 상품 코드
  ADDR_ORD?: string;       // 주소 순번
  CRR_ID?: string;         // 권역/통신사 ID
  BLD_ID?: string;         // 건물 ID

  // A/S 작업 관련 (WRK_CD = '03')
  asHistory?: ASHistory[];   // A/S 이력
  asReasonCode?: string;     // A/S 접수 유형 (WRK_RCPT_CL)
  asDetailCode?: string;     // A/S 접수 상세 유형 (WRK_RCPT_CL_DTL)
  rcType?: string;           // RC 유형

  // 해지 작업 관련 (WRK_CD = '02')
  termReasonCode?: string;   // 해지 사유 코드
  termFee?: number;          // 해지 위약금
  promYn?: string;           // 프로모션 적용 여부 (Y/N)
  promCnt?: number;          // 프로모션 개월 수

  // 일시정지 관련 (WRK_CD = '0410', '0420')
  mmtSusCd?: string;         // 일시정지 사유 코드
  susHopeDd?: string;        // 정지 희망일 (YYYYMMDD)
  mmtSusHopeDd?: string;     // 재개 희망일 (YYYYMMDD)
  susProcYn?: string;        // 정지 처리 여부 (Y/N)
  termDays?: string;         // 누적 정지 일수
  mmtCnt?: string;           // 월 중 정지 횟수

  // 상품변경 관련 (WRK_CD = '05')
  currentProduct?: string;   // 현재 상품
  newProduct?: string;       // 변경 상품

  // 장비 정보
  installEquipments?: Equipment[];  // 설치할 장비
  removeEquipments?: Equipment[];   // 회수/철거할 장비

  // 설치정보 (완료된 작업 조회 시 사용)
  NET_CL?: string;           // 망구분 코드
  NET_CL_NM?: string;        // 망구분명
  WRNG_TP?: string;          // 배선유형 코드
  WRNG_TP_NM?: string;       // 배선유형명
  INSTL_TP?: string;         // 설치유형 코드
  INSTL_TP_NM?: string;      // 설치유형명
  CB_WRNG_TP?: string;       // 메인보드 배선유형
  CB_INSTL_TP?: string;      // 메인보드 설치유형
  INOUT_LINE_TP?: string;    // 실내외 라인 타입
  INOUT_LEN?: string;        // 실내외 길이
  DVDR_YN?: string;          // 분배기 여부
  BFR_LINE_YN?: string;      // 기존 라인 여부
  CUT_YN?: string;           // 컷 여부
  TERM_NO?: string;          // 터미널 번호
  RCV_STS?: string;          // 수신 상태
  SUBTAP_ID?: string;        // 서브탭 ID
  PORT_NUM?: string;         // 포트 번호
  EXTN_TP?: string;          // 확장 타입
  TAB_LBL?: string;          // TAB 라벨
  CVT_LBL?: string;          // CVT 라벨
  STB_LBL?: string;          // STB 라벨
}

// AS 이력 인터페이스
export interface ASHistory {
  asDate: string;          // AS 처리일
  asReason: string;        // AS 사유
  asWorker: string;        // AS 처리자
  asResult: string;        // AS 처리 결과
}

// 호환성을 위해 기존 WorkOrder도 유지
export interface WorkOrder extends WorkItem {
  // 기존 코드 호환성을 위해 유지
}

// ============ 작업 완료 관련 타입 정의 ============

// 작업 완료 - 작업 기본 정보
export interface WorkCompleteInfo {
  WRK_ID: string;           // 작업 ID
  WRK_CD?: string;          // 작업 코드
  WRK_DTL_TCD?: string;     // 작업 세부 유형 코드
  CUST_ID?: string;         // 고객 ID
  RCPT_ID?: string;         // 접수 ID
  CRR_ID?: string;          // 통신사 ID
  WRKR_ID: string;          // 작업자 ID
  WRKR_CMPL_DT: string;     // 작업 완료 일시 (YYYYMMDD)
  MEMO?: string;            // 작업 메모
  STTL_YN?: string;         // 정산 여부 (Y/N)
  REG_UID: string;          // 등록자 ID

  // 확인자 정보
  CUST_REL?: string;        // 고객과의 관계
  CNFM_CUST_NM?: string;    // 확인자 이름
  CNFM_CUST_TELNO?: string; // 확인자 전화번호
  REQ_CUST_TEL_NO?: string; // 요청 고객 전화번호

  // 이용 구분
  PSN_USE_CORP?: string;    // 인터넷 이용 구분 (1:개인, 2:법인)
  DTV_USE_CORP?: string;    // DTV 이용 구분 (1:개인, 2:법인)
  VOIP_USE_CORP?: string;   // VoIP 이용 구분 (1:개인, 2:법인)

  // 기본 설치 정보
  INSTL_LOC?: string;       // 설치 위치
  NET_CL?: string;          // 망 구분
  WRNG_TP?: string;         // 배선 유형
  INSTL_TP?: string;        // 설치 유형
  UP_CTRL_CL?: string;      // 상향 제어 구분 (DTV)
  TV_TYPE?: string;         // TV 유형 (DTV)

  // DB 프로시저 필수 필드
  KPI_PROD_GRP?: string;    // KPI 상품 그룹
  OBS_RCPT_CD?: string;     // 장애 접수 코드
  OBS_RCPT_DTL_CD?: string; // 장애 접수 상세 코드
  VOIP_JOIN_CTRT_ID?: string; // VoIP 결합 계약 ID
  AGREE_YN?: string;        // 동의 여부
  ISP_YN?: string;          // ISP 서비스 사용 여부
  AGREE_GB?: string;        // 동의 구분
  CUST_CLEAN_YN?: string;   // 고객 청소 여부
  EQT_RMV_FLAG?: string;    // 장비 철거 플래그

  // 추가 설치 상세 정보 (dlive mdc 레거시 호환)
  CB_WRNG_TP?: string;      // 케이블 배선 유형
  TERM_NO?: string;         // 단자 번호
  DVDR_YN?: string;         // 분배기 여부 (Y/N)
  CUT_YN?: string;          // 절단 여부 (Y/N)
  INOUT_LINE_TP?: string;   // 인입 관통 여부
  INOUT_LEN?: string;       // 인입선 길이
  BFR_LINE_YN?: string;     // 기존 선로 여부 (Y/N)
  RCV_STS?: string;         // 수신 상태
  CB_INSTL_TP?: string;     // 케이블 설치 유형
  AV_JOIN_TP?: string;      // AV 접속 유형 (DTV)
  RF_JOIN_TP?: string;      // RF 접속 유형 (DTV)
  SUBTAP_ID?: string;       // 분탭 ID
  PORT_NUM?: string;        // 포트 번호
  EXTN_TP?: string;         // 확장 보정
  TAP_ID?: string;          // 탭 ID
  TAB_LBL?: string;         // 탭 라벨
  CVT_LBL?: string;         // 컨버터 라벨
  STB_LBL?: string;         // STB 라벨

  // 주소 확인 체크박스
  CHK_CUST_ADDR?: string;   // 고객 주소 변경 (Y/N)
  CHK_PYM_ADDR?: string;    // 청구지 주소 변경 (Y/N)

  // 작업 행위 구분
  WRK_ACT_CL?: string;      // 작업 행위 구분 코드
}

// 작업 완료 - 설치 장비 정보
export interface InstallEquipmentInfo {
  CUST_ID?: string;         // 고객 ID
  ITEM_CD: string;          // 장비 코드
  EQT_NO?: string;          // 장비 번호
  EQT_SERNO?: string;       // 장비 시리얼 번호
  MAC_ADDRESS?: string;     // MAC 주소
  LENT_YN?: string;         // 대여 여부 (Y/N)
  EQT_NM?: string;          // 장비명
  MODEL_NM?: string;        // 모델명
}

// 작업 완료 - 소모품 정보
export interface SpendItemInfo {
  ITEM_CD: string;          // 소모품 코드
  QTY: number;              // 수량
  UNIT_PRC?: number;        // 단가
  ITEM_NM?: string;         // 소모품명
}

// 작업 완료 - 회수 장비 정보
export interface RemoveEquipmentInfo {
  EQT_NO: string;           // 장비 번호
  RETN_RESN_CD?: string;    // 반납 사유 코드
  EQT_NM?: string;          // 장비명
  EQT_SERNO?: string;       // 장비 시리얼 번호
}

// 작업 완료 - 약관 동의 정보
export interface AgreementInfo {
  CTRT_ID: string;          // 계약 ID
  AGREE_YN: string;         // 동의 여부 (Y/N)
  AGREE_DT: string;         // 동의 일시 (YYYYMMDD)
  AGREE_TYPE?: string;      // 약관 유형
}

// 작업 완료 - 전주 작업 결과
export interface PoleResultInfo {
  POLE_ID: string;          // 전주 ID
  POLE_STAT_CD?: string;    // 전주 상태 코드
  MEMO?: string;            // 메모
}

// 작업 완료 - 전체 요청 데이터
export interface WorkCompleteData {
  workInfo: WorkCompleteInfo;
  equipmentList?: InstallEquipmentInfo[];
  spendItemList?: SpendItemInfo[];
  removeEquipmentList?: RemoveEquipmentInfo[];
  agreementList?: AgreementInfo[];
  poleList?: PoleResultInfo[];
}

// ============ 설치 정보 팝업 관련 타입 정의 ============

// 설치 정보 (망구분, 설치유형, 배선유형 등)
export interface InstallInfo {
  WRK_ID: string;           // 작업 ID
  NET_CL?: string;          // 망 구분
  INSTL_TP?: string;        // 설치 유형
  WRNG_TP?: string;         // 배선 유형
  CB_WRNG_TP?: string;      // 케이블 배선 유형
  TERM_NO?: string;         // 단자 번호
  DVDR_YN?: string;         // 분배기 여부 (Y/N)
  CUT_YN?: string;          // 절단 여부 (Y/N)
  INOUT_LINE_TP?: string;   // 인입 관통 여부
  INOUT_LEN?: string;       // 인입선 길이
  BFR_LINE_YN?: string;     // 기존 선로 여부 (Y/N)
  RCV_STS?: string;         // 수신 상태
  CB_INSTL_TP?: string;     // 케이블 설치 유형
  INSTL_LOC?: string;       // 설치 위치
  AV_JOIN_TP?: string;      // AV 접속 유형 (DTV)
  RF_JOIN_TP?: string;      // RF 접속 유형 (DTV)
  UP_CTRL_CL?: string;      // 상향 제어 구분 (DTV)

  // 추가 DTV 관련 필드
  SUBTAP_ID?: string;       // 분탭 ID
  PORT_NUM?: string;        // 포트 번호
  EXTN_TP?: string;         // 확장 보정
  TAP_ID?: string;          // 탭 ID
  TAB_LBL?: string;         // 탭 라벨
  CVT_LBL?: string;         // 컨버터 라벨
  STB_LBL?: string;         // STB 라벨
}

// 공통 코드 항목
export interface CommonCodeItem {
  code: string;             // 코드 값
  name: string;             // 코드 명
  description?: string;     // 설명
  ref_code?: string;        // 참조코드 (상품그룹코드 등)
  ref_code2?: string;       // 참조코드2 (설치유형 등)
  ref_code3?: string;       // 참조코드3 (날짜 등)
}

// ============ 카카오맵 관련 타입 정의 ============

// 카카오맵 전역 타입
declare global {
  interface Window {
    kakao: typeof kakao;
  }
}

declare namespace kakao.maps {
  function load(callback: () => void): void;

  class Map {
    constructor(container: HTMLElement, options: MapOptions);
    setCenter(latlng: LatLng): void;
    setLevel(level: number): void;
    getLevel(): number;
    setBounds(bounds: LatLngBounds): void;
  }

  class LatLng {
    constructor(lat: number, lng: number);
    getLat(): number;
    getLng(): number;
  }

  class LatLngBounds {
    constructor();
    extend(latlng: LatLng): void;
  }

  class Marker {
    constructor(options: MarkerOptions);
    setMap(map: Map | null): void;
    getPosition(): LatLng;
  }

  class InfoWindow {
    constructor(options: InfoWindowOptions);
    open(map: Map, marker: Marker): void;
    close(): void;
  }

  class CustomOverlay {
    constructor(options: CustomOverlayOptions);
    setMap(map: Map | null): void;
  }

  interface MapOptions {
    center: LatLng;
    level: number;
  }

  interface MarkerOptions {
    position: LatLng;
    map?: Map;
    image?: MarkerImage;
  }

  interface InfoWindowOptions {
    content: string;
    removable?: boolean;
  }

  interface CustomOverlayOptions {
    position: LatLng;
    content: string | HTMLElement;
    yAnchor?: number;
    xAnchor?: number;
  }

  class MarkerImage {
    constructor(src: string, size: Size, options?: MarkerImageOptions);
  }

  class Size {
    constructor(width: number, height: number);
  }

  interface MarkerImageOptions {
    offset?: Point;
  }

  class Point {
    constructor(x: number, y: number);
  }

  namespace event {
    function addListener(target: any, type: string, callback: Function): void;
    function removeListener(target: any, type: string, callback: Function): void;
  }

  namespace services {
    class Geocoder {
      addressSearch(address: string, callback: (result: GeocoderResult[], status: Status) => void): void;
    }

    interface GeocoderResult {
      x: string;
      y: string;
      address_name: string;
      road_address?: {
        address_name: string;
      };
    }

    enum Status {
      OK = 'OK',
      ZERO_RESULT = 'ZERO_RESULT',
      ERROR = 'ERROR'
    }
  }
}

// 지도 마커 데이터
export interface MapMarkerData {
  id: string;
  address: string;
  customerName: string;
  workType: string;
  status: WorkOrderStatus;
  lat?: number;
  lng?: number;
}
