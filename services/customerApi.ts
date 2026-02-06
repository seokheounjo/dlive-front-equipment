/**
 * Customer Management API Service
 * 고객관리 API 서비스
 *
 * 기능분해도 문서 기반 API 정의 (20251229)
 * @version 2026.01.30 - LOGIN_ID 파라미터 추가
 * - 기본조회: 고객정보, 계약현황, 납부정보, 요금내역
 * - 정보변경: 전화번호, 주소(설치/고객/청구지)
 * - 상담/AS: 상담이력, AS접수
 * - 전자계약: 모두싸인 연동
 * - 잠재고객: 고객 신규 등록
 */

// API Base URL (서버 프록시 경유 - nginx에서 EC2로 전달)
const API_BASE = '/api';

// ============ 타입 정의 ============

// 고객 검색 조건
export interface CustomerSearchParams {
  searchType: 'PHONE_NAME' | 'CUSTOMER_ID' | 'CONTRACT_ID' | 'EQUIPMENT_NO';
  phoneNumber?: string;
  customerName?: string;
  customerId?: string;
  contractId?: string;
  equipmentNo?: string;  // S/N or MAC
}

// 전화번호 항목
export interface PhoneNumberItem {
  type: 'tel' | 'hp';        // tel: 전화번호, hp: 휴대폰번호
  typeNm: string;            // 표시명 (전화번호, 휴대폰번호, 휴대폰번호2 등)
  number: string;            // 실제 번호
  fieldName: string;         // 원본 필드명 (TEL_NO, HP_NO, TEL_NO1 등)
}

// 고객 기본 정보
export interface CustomerInfo {
  CUST_ID: string;           // 고객ID (고객번호)
  CUST_NM: string;           // 고객명
  TEL_NO: string;            // 전화번호 (대표)
  HP_NO: string;             // 휴대폰번호 (대표)
  PHONE_LIST?: PhoneNumberItem[];  // 전화번호 목록 (다중)
  CUST_ADDR: string;         // 고객주소 (지번)
  ROAD_ADDR?: string;        // 도로명주소
  INST_ADDR: string;         // 설치주소
  BILL_ADDR: string;         // 청구지주소
  UNPAY_AMT: number;         // 미납금액 합계
  CUST_TP_CD: string;        // 고객유형코드
  CUST_TP_NM: string;        // 고객유형명 (고객구분)
  GRP_NO?: string;           // 단체번호
  GRP_NM?: string;           // 단체 이름
  REG_DT: string;            // 등록일
}

// 계약 정보
export interface ContractInfo {
  CTRT_ID: string;           // 계약ID
  CTRT_STAT_CD: string;      // 계약상태코드
  CTRT_STAT_NM: string;      // 계약상태명
  PROD_NM: string;           // 상품명
  PROD_GRP_NM: string;       // 상품군명
  INST_ADDR: string;         // 설치주소
  STREET_ADDR_FULL?: string; // 도로명주소 (우선 표시)
  ADDR_FULL?: string;        // 지번주소 (도로명 없을 때 표시)
  INSTL_LOC?: string;        // 설치위치 (거실, 안방, 침실 등)
  POST_ID?: string;          // 주소ID (AS접수에 필요)
  OPNG_DT: string;           // 개통일
  TERM_DT: string;           // 해지일
  AGMT_MON: string;          // 약정개월
  AGMT_ST_DT: string;        // 약정시작일 (기존)
  AGMT_END_DT: string;       // 약정종료일 (기존)
  CTRT_APLY_STRT_DT?: string; // 약정 시작일 (D'Live)
  CTRT_APLY_END_DT?: string;  // 약정 종료일 (D'Live)
  GRP_NO: string;            // 단체번호
  GRP_NM?: string;           // 단체 이름
  PYM_ACNT_ID: string;       // 납부계정ID
  DPST_AMT: number;          // 보증금
  PREPAY_AMT: number;        // 선납금
  SO_NM?: string;            // 지점명
  NOTRECEV?: string;         // 미수신 정보
  // 장비 정보
  EQT_NM: string;            // 장비명
  EQT_MDL_NM: string;        // 모델명
  EQT_SERNO: string;         // 시리얼번호
  // 요금 정보
  PREV_MON_AMT: number;      // 전월요금
  CUR_MON_AMT: number;       // 당월요금
}

// 계약 현황 카운트
export interface ContractStatusCount {
  PROD_GRP_NM: string;       // 상품군명
  ACTIVE_CNT: number;        // 사용중 건수
  TERM_CNT: number;          // 해지 건수
  TOTAL_CNT: number;         // 합계
}

// 납부 정보
export interface PaymentInfo {
  PYM_ACNT_ID: string;       // 납부계정ID
  PYM_MTH_CD: string;        // 납부방법코드
  PYM_MTH_NM: string;        // 납부방법명 (자동이체/신용카드/지로 등)
  BANK_CD: string;           // 은행코드
  BANK_NM: string;           // 은행명
  CARD_CD?: string;          // 카드사코드
  CARD_NM?: string;          // 카드사명
  ACNT_NO: string;           // 계좌번호 (마스킹)
  CARD_NO: string;           // 카드번호 (마스킹)
  ACNT_HOLDER_NM?: string;   // 예금주/카드소유주명
  BILL_MEDIA_CD: string;     // 청구매체코드
  BILL_MEDIA_NM: string;     // 청구매체명
  UNPAY_AMT: number;         // 미납금액
}

// 요금 내역
export interface BillingInfo {
  PYM_ACNT_ID: string;       // 납부계정ID
  BILL_YM: string;           // 청구년월
  BILL_CYCLE: string;        // 청구주기
  BILL_AMT: number;          // 청구금액
  RCPT_AMT: number;          // 수납금액
  UNPAY_AMT: number;         // 미납금액
  BILL_DT: string;           // 청구일
}

// 미납 내역
export interface UnpaymentInfo {
  BILL_YM: string;           // 청구년월
  CTRT_ID: string;           // 계약ID
  PROD_NM: string;           // 상품명
  BILL_AMT: number;          // 청구금액
  UNPAY_AMT: number;         // 미납금액
  UNPAY_DAYS: number;        // 미납일수
  UNPAY_STAT_NM: string;     // 미납상태
}

// 상담 이력 (D'Live: getTgtCtrtRcptHist_m)
export interface ConsultationHistory {
  START_DATE: string;        // 접수일 (yyyy-mm-dd)
  CNSL_SLV_CL_NM: string;    // 상담소분류
  CNSL_RSLT: string;         // 처리결과
  RCPT_NM: string;           // 접수자
  REQ_CTX: string;           // 요청사항
  PROC_CT: string;           // 처리내용
}

// 작업 이력 (D'Live: getTgtCtrtWorkList_m)
export interface WorkHistory {
  HOPE_DT: string;           // 작업희망일 (yyyy-mm-dd)
  CUST_ID: string;           // 고객ID
  CTRT_ID: string;           // 계약ID
  PROD_NM: string;           // 상품명
  WRK_CD_NM: string;         // 작업구분
  WRK_STAT_CD_NM: string;    // 작업상태
  CMPL_DATE: string;         // 완료일 (yyyy-mm-dd)
  WRK_NM: string;            // 작업자
  WRK_CRR_NM: string;        // 작업자소속
  CTRT_ADDR: string;         // 작업주소
  MEMO: string;              // 메모
}

// 휴대폰결제(선불) 정보
export interface HPPayInfo {
  CTRT_ID: string;           // 계약ID
  PROD_NM: string;           // 상품명
  HP_PAY_YN: string;         // 신청여부 (Y/N)
  INST_ADDR: string;         // 설치주소
  CTRT_STAT_NM: string;      // 계약상태
}

// 상담 등록 요청 (Backend: saveCnslRcptInfo)
// 상담은 계약ID 단위로 등록됨 (CTRT_ID 필수)
export interface ConsultationRequest {
  CUST_ID: string;           // 고객ID (필수)
  CTRT_ID: string;           // 계약ID (필수) - 상담은 계약 단위로 등록
  CNSL_MST_CL: string;       // 상담대분류 (CMCS010)
  CNSL_MID_CL: string;       // 상담중분류 (CMCS020)
  CNSL_SLV_CL: string;       // 상담소분류 (CMCS030) (필수)
  REQ_CTX: string;           // 요청사항 (필수)
  // 고정값
  RCPT_TP: string;           // 접수매체구분 - 'G1' 고정 (CMCU217)
  CUST_REL: string;          // 고객과의관계 - 'A' 고정 (CMCU005)
  PRESS_RCPT_YN: string;     // 독촉불만여부 - 'N' 고정
  SUBS_TP: string;           // 가입자구분 - '1' 고정
  CTI_CID: string;           // CTI연계코드 - '0' 고정
  // 필수 정보
  SO_ID: string;             // 지점ID
  MST_SO_ID: string;         // 계열사ID
  POST_ID: string;           // 주소ID
  // 저장 타입 (완료 저장 시)
  SAVE_TP?: string;          // '2' = 완료 저장
  // 전달처리
  PROC_PLNR_ID?: string;     // 전달자ID (전달처리 시)
  DEPT_CD?: string;          // 지점 선택 시
  CRR_ID?: string;           // 업체 선택 시
}

// AS 접수 요청 (Backend: modAsPdaReceipt)
// 모든 필수 파라미터 포함
export interface ASRequestParams {
  // 필수 정보
  POST_ID: string;           // 주소ID (필수)
  CUST_ID: string;           // 고객ID (필수)
  CTRT_ID: string;           // 계약ID (필수)
  WRK_HOPE_DTTM: string;     // 작업희망일시 (ex. 202601201500) (필수)
  HOPE_DTTM: string;         // 고객희망일시 (ex. 202601201500) (필수)
  WRK_DTL_TCD: string;       // AS구분 (CMWT001) (필수)
  WRK_RCPT_CL: string;       // AS접수사유(대) (CMAS000) (필수)
  WRK_RCPT_CL_DTL: string;   // AS접수사유(중) (CMAS001) (필수)
  MEMO: string;              // 요청사항 (필수)
  // 고정값
  EMRG_YN: string;           // 긴급작업여부 - 'N' 고정
  HOLY_YN: string;           // 휴일여부 - 'N' 고정
  TRANS_PROC_YN: string;     // 전달여부 - 'Y' 고정
  // 사용자 정보
  CRR_ID: string;            // 업체ID (작업자의 업체ID)
  WRKR_ID: string;           // 작업자ID
  REG_UID: string;           // 등록자ID
  // 선택 정보
  AS_BIZ_CL?: string;        // 콤보상세
  BIZ_EXPNS_GUIDE?: string;  // 출장비안내 (CMAS004)
}

// AS 접수 프론트엔드 UI 기준 (간소화된 입력)
export interface ASRequestUIParams {
  CUST_ID: string;           // 고객ID
  CTRT_ID: string;           // 계약ID
  POST_ID: string;           // 주소ID
  AS_CL_CD: string;          // AS구분코드 (UI 선택값) -> WRK_DTL_TCD로 매핑
  AS_CL_DTL_CD?: string;     // 콤보상세코드 -> AS_BIZ_CL
  TRIP_FEE_CD?: string;      // 출장비코드 -> BIZ_EXPNS_GUIDE
  AS_RESN_L_CD: string;      // AS접수사유(대) (UI) -> WRK_RCPT_CL로 매핑
  AS_RESN_M_CD: string;      // AS접수사유(중) (UI) -> WRK_RCPT_CL_DTL로 매핑
  AS_CNTN: string;           // AS내용 -> MEMO
  SCHD_DT: string;           // 작업예정일 (YYYYMMDD)
  SCHD_TM: string;           // 작업예정시간 (HHMM)
}

// 전화번호 변경 요청 (Backend: updateCustTelDetailInfo → pcmcu_cust_tel_upd 프로시저)
// 전화번호는 3개로 분리해서 전송 (TEL_DDD, TEL_FIX, TEL_DTL)
// DDD 분리 규칙: 02→2자리, 0130→4자리, 나머지→3자리
export interface PhoneChangeRequest {
  CUST_ID: string;           // 고객ID
  TEL_NO?: string;           // 기존 전화번호 (UPDATE 대상 식별용)
  TEL_DDD: string;           // 지역번호/통신사번호 (02, 031, 010 등)
  TEL_FIX: string;           // 중간번호
  TEL_DTL: string;           // 끝번호 (4자리)
  MB_CORP_TP: string;        // 통신사코드 (CMCU052)
  NO_SVC_YN: string;         // 결번여부 (Y/N)
  TEL_NO_TP: string;         // 전화번호구분 (CMCU109) - '1'=전화, '2'=휴대폰
  USE_YN: string;            // 사용여부 - 'Y'=사용, 'N'=삭제
  CTRT_ID?: string;          // 계약ID
  MAIN_TEL_YN?: string;      // 대표번호여부 (Y/N)
  CUST_REL?: string;         // 고객관계 (대리인 전화일 경우)
  CHG_UID: string;           // 수정자 (로그인 사용자) → REG_UID로 매핑됨
}

/**
 * 전화번호 검증 (fcmcu_cust_tel_check 기반)
 * D'Live 서버 프로시저와 동일한 검증 로직을 프론트에서 사전 체크
 */
export const validatePhoneNumber = (telNo: string, telNoType: 'tel' | 'hp'): string | null => {
  const cleaned = telNo.replace(/[-\s]/g, '');

  if (!cleaned) return '전화번호를 입력하세요.';
  if (cleaned.length < 9) return '전화번호를 정확히 입력하세요.';

  // DDD 분리
  let ddd = '';
  let fix = '';
  const dtl = cleaned.slice(-4);

  if (cleaned.startsWith('02')) {
    ddd = cleaned.substring(0, 2);
    fix = cleaned.substring(2, cleaned.length - 4);
  } else if (cleaned.startsWith('0130')) {
    ddd = cleaned.substring(0, 4);
    fix = cleaned.substring(4, cleaned.length - 4);
  } else {
    ddd = cleaned.substring(0, 3);
    fix = cleaned.substring(3, cleaned.length - 4);
  }

  if (fix.length < 3) return '전화번호를 정확히 입력하세요.';
  if (fix === '111' || fix === '1111') return '전화번호를 정확히 입력하세요.';
  if (ddd === '010' && fix.length < 4) return '휴대폰번호를 정확히 입력하세요.';
  if (telNoType === 'hp' && !['010', '011', '016', '017', '018', '019'].includes(ddd)) {
    return '휴대전화번호를 정확히 입력하세요.';
  }
  if (ddd !== '0130' && fix.startsWith('0')) return '전화번호를 정확히 입력하세요.';

  // 같은 숫자 7연속 체크
  let consecutive = 0;
  for (let i = 0; i < cleaned.length - 1; i++) {
    if (cleaned[i] === cleaned[i + 1]) {
      consecutive++;
      if (consecutive >= 6) return '전화번호를 정확히 입력하세요.';
    } else {
      consecutive = 0;
    }
  }

  return null; // 검증 통과
};

/**
 * 전화번호를 DDD, FIX, DTL로 분리
 * 02→2자리, 0130→4자리, 나머지→3자리 DDD
 */
export const splitPhoneNumber = (telNo: string): { ddd: string; fix: string; dtl: string } => {
  const cleaned = telNo.replace(/[^0-9]/g, '');
  let ddd = '';
  let fix = '';
  const dtl = cleaned.slice(-4);

  if (cleaned.startsWith('02')) {
    ddd = cleaned.substring(0, 2);
    fix = cleaned.substring(2, cleaned.length - 4);
  } else if (cleaned.startsWith('0130')) {
    ddd = cleaned.substring(0, 4);
    fix = cleaned.substring(4, cleaned.length - 4);
  } else {
    ddd = cleaned.substring(0, 3);
    fix = cleaned.substring(3, cleaned.length - 4);
  }

  return { ddd, fix, dtl };
};

// 설치주소 변경 요청 (Backend: saveMargeAddrOrdInfo)
// API: /customer/etc/saveMargeAddrOrdInfo.req
export interface InstallAddressChangeRequest {
  CTRT_ID: string;           // 계약ID (필수)
  POST_ID: string;           // 주소ID (필수)
  BLD_ID?: string;           // 건물ID
  BUN_NO?: string;           // 본번
  HO_NM?: string;            // 호명 (부번)
  BLD_CL?: string;           // 건물분류
  BLD_NM?: string;           // 건물명
  APT_DONG_NO?: string;      // 아파트동번호
  APT_HO_CNT?: string;       // 아파트호수
  ADDR_DTL?: string;         // 상세주소
  STREET_ID?: string;        // 도로명ID
  INSTL_LOC?: string;        // 설치위치 (거실, 안방 등)
  CUST_FLAG?: string;        // '1'이면 고객주소도 변경
  PYM_FLAG?: string;         // '1'이면 청구지주소도 변경
  CHG_UID?: string;          // 변경자ID
}

// 청구지주소 변경 요청 (Backend: savePymAddrInfo)
// API: /customer/etc/savePymAddrInfo.req
export interface BillingAddressChangeRequest {
  CTRT_ID: string;           // 계약ID (필수)
  ADDR_ORD?: string;         // 주소순번
  CHG_UID?: string;          // 변경자ID
  CUST_FLAG?: string;        // '1'이면 고객주소도 변경
  PYM_FLAG?: string;         // '1' 고정
}

// 고객주소 변경 요청 (Backend: 신규 API 필요)
// TODO: 백엔드에서 고객주소만 변경하는 API 개발 필요
export interface CustomerAddressChangeRequest {
  CUST_ID: string;           // 고객ID
  POST_ID: string;           // 주소ID
  ADDR_DTL?: string;         // 상세주소
  STREET_ID?: string;        // 도로명ID
  CHG_UID?: string;          // 변경자ID
}

// Legacy 주소 변경 요청 (호환성 유지)
export interface AddressChangeRequest {
  CUST_ID: string;           // 고객ID
  ADDR_ORD: string;          // 주소순번 (필수)
  DONGMYON_NM?: string;      // 읍/면/동
  STREET_ID?: string;        // 도로명 ID (5자리 숫자)
  ZIP_CD?: string;           // 우편번호
  ADDR_DTL?: string;         // 상세주소
}

// 잠재고객 생성 요청
export interface CustomerCreateRequest {
  CUST_NM: string;           // 고객명
  JUMIN_NO: string;          // 주민등록번호
  CUST_TP_CD: string;        // 고객유형 (01:개인, 02:사업자, 03:외국인, 04:단체)
  TEL_NO?: string;           // 전화번호
  HP_NO?: string;            // 휴대폰번호
  ADDR?: string;             // 주소
}

// 납부방법 변경 요청 (Backend: CustomerManagementController.handleLegacyChangePaymentMethod)
// 실제 D'Live API 스펙 기반
export interface PaymentMethodChangeRequest {
  // 공통 필수
  PYM_ACNT_ID: string;       // 납부계정ID
  CUST_ID: string;           // 고객ID
  ACNT_NM?: string;          // 납부자명
  PYM_MTHD?: string;         // 납부방법 (BLIV005) - 02: 자동이체, 04: 신용카드
  PMC_RESN?: string;         // 납부방법변경사유 (CMCU079)
  BANK_CARD?: string;        // 은행/카드코드 (자동이체: BLPY015, 카드: BLPY016)
  ACNT_CARD_NO?: string;     // 계좌/카드번호
  PYM_CARD_DATE?: string;    // 희망결제일
  // 청구지 정보
  BILL_POST_ID?: string;     // 청구주소ID
  BILL_ZIP_CD?: string;      // 우편번호
  BILL_ADDR?: string;        // 청구지주소
  // 자동이체 (PYM_MTHD=02)
  CORP_CD?: string;          // 승인코드
  PYM_CUST_NM?: string;      // 예금주
  PYM_CUST_CRRNO?: string;   // 예금주 주민등록번호
  // 신용카드 (PYM_MTHD=04)
  REQR_NM?: string;          // 카드소유주명
  PYR_REL?: string;          // 납부자관계
  CARD_CL?: string;          // 카드구분 (CMCU112)
  CARD_RSDT_CRRNO?: string;  // 카드소유주 주민등록번호
  CDTCD_EXP_DT?: string;     // 카드유효기간
  JOIN_CARD_YN?: string;     // 제휴카드 여부
  // 기타
  MST_SO_ID?: string;        // 계열사ID
  SO_ID?: string;            // 지점ID
  USR_ID?: string;           // 사용자ID
  // Legacy 호환용 (백엔드에서 자동 매핑됨)
  PYM_MTH_CD?: string;       // -> PYM_MTHD로 매핑 (01->02, 02->04)
  BANK_CD?: string;          // -> BANK_CARD로 매핑
  ACNT_NO?: string;          // -> ACNT_CARD_NO로 매핑
  CARD_NO?: string;          // -> ACNT_CARD_NO로 매핑
  CARD_CO_CD?: string;       // -> BANK_CARD로 매핑 (카드사)
  CARD_VALID_YM?: string;    // -> CDTCD_EXP_DT로 매핑
  ACNT_OWNER_NM?: string;    // -> PYM_CUST_NM/REQR_NM/ACNT_NM으로 매핑
  // 모바일 프론트엔드 추가 필드 (백엔드에서 매핑)
  CHG_RESN_L_CD?: string;    // -> PMC_RESN으로 매핑 (변경사유 대분류)
  CHG_RESN_M_CD?: string;    // -> PMC_RESN으로 매핑 (변경사유 중분류)
  PAYER_REL_CD?: string;     // -> PYR_REL으로 매핑
  PAY_DAY_CD?: string;       // -> PYM_CARD_DATE로 매핑
  ID_TYPE_CD?: string;       // 신분유형
  BIRTH_DT?: string;         // -> PYM_CUST_CRRNO/CARD_RSDT_CRRNO로 매핑
  // 청구주소 상세필드
  DONG_NM?: string;          // 읍/면/동
  ROAD_ADDR?: string;        // 도로명주소
  JIBUN_ADDR?: string;       // 지번주소
  BLDG_CD?: string;          // 건물구분
  BLDG_NM?: string;          // 건물명
  BLDG_NO?: string;          // 건물번호
  DONG_NO?: string;          // 동
  HO_NO?: string;            // 호
}

// 계좌 인증 요청
export interface AccountVerifyRequest {
  BANK_CD: string;           // 은행코드
  ACNT_NO: string;           // 계좌번호
  ACNT_OWNER_NM: string;     // 예금주명
}

// 카드 인증 요청
export interface CardVerifyRequest {
  CARD_NO: string;           // 카드번호
  CARD_VALID_YM: string;     // 유효기간 YYMM
  CARD_OWNER_NM?: string;    // 카드소유자명
}

// 지번주소 검색 요청 (statistics/customer/getPostList)
export interface PostAddressSearchRequest {
  SO_ID?: string;            // 지점ID
  DONGMYONG?: string;        // 읍/면/동
  USE_FLAG?: string;         // 사용여부
  SALES_AREA_YN?: string;    // 영업권역여부
}

// 지번주소 검색 결과
export interface PostAddressInfo {
  POST_ID: string;           // 주소ID
  ADDR_FULL: string;         // 전체주소 (우편번호) 시도 구군 동면 건물명 번지
  ADDR: string;              // 기본주소
  ZIP_CD: string;            // 우편번호
  BUN_CL: string;            // 번지구분
  SIDO_NAME: string;         // 시도명
  GUGUN_NM: string;          // 구군명
  DONGMYON_NM: string;       // 읍면동명
  NM_RI_BD: string;          // 리/건물
  BLD_NM: string;            // 건물명
  STRT_BUNGIHO: string;      // 시작번지
  END_BUNGIHO: string;       // 끝번지
  STRT_DONGBUN_NO: string;   // 시작동번호
  END_DONGBUN_NO: string;    // 끝동번호
  USE_FLAG: string;          // 사용여부
}

// 도로명주소 검색 요청 (customer/common/customercommon/getStreetAddrList)
export interface StreetAddressSearchRequest {
  STREET_NM?: string;        // 도로명
  STREET_BUN_M?: string;     // 건물본번
  STREET_BUN_S?: string;     // 건물부번
  ZIP_SEQ?: string;          // 우편번호순번
  ZIP_SEQ_NEW?: string;      // 신규우편번호순번
  NM_WIDE?: string;          // 시도
  NM_MID?: string;           // 시군구
  NM_SMALL?: string;         // 읍면동
  HEAD_BUNJI?: string;       // 본번지
  GAJI_BUNJI?: string;       // 부번지
  BUILD_NM?: string;         // 건물명
  SO_ID?: string;            // 지점ID
}

// 도로명주소 검색 결과
export interface StreetAddressInfo {
  STREET_ID: string;         // 도로명ID
  STREET_ADDR: string;       // 도로명주소
  STREET_ADDR_REF: string;   // 참조주소
  ZIP_CD: string;            // 우편번호
  POST_ID: string;           // 지번주소ID
  MST_SO_ID: string;         // 계열사ID
  SO_ID: string;             // 지점ID
  SO_NM: string;             // 지점명
  BUN_CL: string;            // 번지구분
  SIDO_NAME: string;         // 시도명
  GUGUN_NM: string;          // 구군명
  NM_SMALL: string;          // 읍면동(신)
  DONGMYON_NM: string;       // 읍면동(기존)
  NM_RI_BD: string;          // 리/건물
  BUN_NO: string;            // 본번
  HO_NM: string;             // 부번
  BLD_NM: string;            // 건물명
  BLD_DTL_NM: string;        // 건물상세명
  ADDR: string;              // 기본주소
  ADDR1: string;             // 기본주소1
  ADDR_FULL: string;         // 전체주소
  STREET_NM: string;         // 도로명
  STREET_BUN_M: string;      // 건물본번
  STREET_BUN_S: string;      // 건물부번
  POST_ZIP_CD: string;       // 지번우편번호
}

// API 응답 공통 형태
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  message?: string;
  errorCode?: string;
  totalCount?: number;
}

// ============ API 함수들 ============

/**
 * API 호출 헬퍼 함수
 */
const apiCall = async <T>(
  endpoint: string,
  params: Record<string, any> = {},
  method: 'GET' | 'POST' = 'POST'
): Promise<ApiResponse<T>> => {
  try {
    const url = `${API_BASE}${endpoint}`;
    console.log(`[CustomerAPI] ${method} ${url}`);
    console.log(JSON.stringify(params, null, 2));

    const response = await fetch(url, {
      method,
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
      body: method === 'POST' ? JSON.stringify(params) : undefined,
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const result = await response.json();
    console.log(`[CustomerAPI] Response:`);
    console.log(JSON.stringify(result, null, 2));

    // 레거시 API 응답 형식 처리
    // D'Live API: { code: 'SUCCESS', message: 'OK', data: [...] }
    // 레거시 API: { resultCode: '0000', resultData: [...] }
    if (result.code === 'SUCCESS' || result.resultCode === '0000' || result.success) {
      return {
        success: true,
        data: result.data || result.resultData || result,
        totalCount: result.totalCount || result.resultCount
      };
    }

    return {
      success: false,
      message: result.message || result.resultMsg || '요청 처리에 실패했습니다.',
      errorCode: result.code || result.resultCode || result.errorCode
    };
  } catch (error) {
    console.error(`[CustomerAPI] Error:`, error);
    return {
      success: false,
      message: error instanceof Error ? error.message : '네트워크 오류가 발생했습니다.'
    };
  }
};

// ============ 세션 헬퍼 함수 ============

/**
 * 세션에서 LOGIN_ID 획득 (접속자 ID, ex. A20117965)
 * D'Live API 호출 시 권한 체크에 필요
 */
const getLoginIdFromSession = (): string => {
  try {
    const userInfoStr = sessionStorage.getItem('userInfo') || localStorage.getItem('userInfo');
    if (userInfoStr) {
      const userInfo = JSON.parse(userInfoStr);
      return userInfo.userId || userInfo.USR_ID || userInfo.LOGIN_ID || 'SYSTEM';
    }
  } catch (e) {
    console.log('[CustomerAPI] Failed to get LOGIN_ID from session');
  }
  return 'SYSTEM';
};

// ============ 필드 매핑 함수 ============

/**
 * 고객 검색 응답 필드 매핑
 * D'Live API 응답 -> 프론트엔드 인터페이스
 */
const mapCustomerFields = (data: any): CustomerInfo => {
  // 전체 주소 조합: ADDRESS + BUN_NO번지 + HO_NM호 + BLD_NM
  const buildFullAddress = (): string => {
    if (data.ADDR_FULL) return data.ADDR_FULL;

    const parts: string[] = [];
    const baseAddr = data.ADDRESS || data.ADDR || '';
    if (baseAddr) parts.push(baseAddr);
    if (data.BUN_NO) parts.push(`${data.BUN_NO}번지`);
    if (data.HO_NM) parts.push(`${data.HO_NM}호`);
    if (data.BLD_NM) parts.push(data.BLD_NM);

    return parts.join(' ') || '';
  };

  // 전화번호 목록 추출 (다중 전화번호 지원)
  const buildPhoneList = (): PhoneNumberItem[] => {
    const phoneList: PhoneNumberItem[] = [];

    // TEL_NO (전화번호)
    const telNo = data.TEL_NO || data.TEL_NO1 || '';
    if (telNo) {
      phoneList.push({
        type: 'tel',
        typeNm: '전화번호',
        number: telNo,
        fieldName: 'TEL_NO'
      });
    }

    // HP_NO (휴대폰번호)
    const hpNo = data.HP_NO || data.TEL_NO2 || '';
    if (hpNo) {
      phoneList.push({
        type: 'hp',
        typeNm: '휴대폰번호',
        number: hpNo,
        fieldName: 'HP_NO'
      });
    }

    // 추가 전화번호 (TEL_NO3, TEL_NO4, ... TEL_NO9까지)
    for (let i = 3; i <= 9; i++) {
      const fieldName = `TEL_NO${i}`;
      const value = data[fieldName];
      if (value) {
        // 010으로 시작하면 휴대폰, 아니면 전화번호
        const isHp = value.startsWith('010') || value.startsWith('011') || value.startsWith('016') || value.startsWith('017') || value.startsWith('018') || value.startsWith('019');
        phoneList.push({
          type: isHp ? 'hp' : 'tel',
          typeNm: isHp ? `휴대폰번호${i - 1}` : `전화번호${i - 1}`,
          number: value,
          fieldName: fieldName
        });
      }
    }

    return phoneList;
  };

  const fullAddress = buildFullAddress();
  const phoneList = buildPhoneList();

  return {
    CUST_ID: data.CUST_ID || '',
    CUST_NM: data.CUST_NM || '',
    TEL_NO: data.TEL_NO || data.TEL_NO1 || '',           // TEL_NO1 -> TEL_NO
    HP_NO: data.HP_NO || data.TEL_NO2 || '',             // TEL_NO2 -> HP_NO
    PHONE_LIST: phoneList.length > 0 ? phoneList : undefined,
    CUST_ADDR: fullAddress || data.CUST_ADDR || data.ADDR || data.ADDRESS || '',  // 전체주소 우선
    ROAD_ADDR: data.ROAD_ADDR || fullAddress || '',      // 전체주소 -> ROAD_ADDR
    INST_ADDR: data.INST_ADDR || fullAddress || '',      // 전체주소 -> INST_ADDR
    BILL_ADDR: data.BILL_ADDR || '',                     // D'Live API does not return this
    UNPAY_AMT: data.UNPAY_AMT || 0,                      // D'Live API does not return this
    CUST_TP_CD: data.CUST_TP_CD || data.CUST_TP || '',   // CUST_TP -> CUST_TP_CD
    CUST_TP_NM: data.CUST_TP_NM || data.CUST_CL_NM || '', // CUST_CL_NM -> CUST_TP_NM
    GRP_NO: data.GRP_NO || data.GRP_ID || '',            // GRP_ID -> GRP_NO
    GRP_NM: data.GRP_NM || '',                           // 단체 이름
    REG_DT: data.REG_DT || ''                            // D'Live API does not return this
  };
};

/**
 * 계약 정보 응답 필드 매핑
 * D'Live API 응답 -> 프론트엔드 인터페이스
 */
const mapContractFields = (data: any): ContractInfo => {
  return {
    CTRT_ID: data.CTRT_ID || '',
    CTRT_STAT_CD: data.CTRT_STAT_CD || data.CTRT_STAT || '',    // CTRT_STAT -> CTRT_STAT_CD
    CTRT_STAT_NM: data.CTRT_STAT_NM || '',
    PROD_NM: data.PROD_NM || data.BASIC_PROD_CD_NM || '',       // BASIC_PROD_CD_NM -> PROD_NM
    PROD_GRP_NM: data.PROD_GRP_NM || '',
    INST_ADDR: data.INST_ADDR || data.ADDR_FULL || data.ADDR || '', // ADDR_FULL -> INST_ADDR
    INSTL_LOC: data.INSTL_LOC || '',                            // 설치위치 (거실, 안방, 침실 등)
    POST_ID: data.POST_ID || '',                                // 주소ID
    OPNG_DT: data.OPNG_DT || data.OPEN_DD || '',                // OPEN_DD -> OPNG_DT
    TERM_DT: data.TERM_DT || '',
    AGMT_MON: data.AGMT_MON || data.PROM_CNT?.toString() || '', // PROM_CNT -> AGMT_MON
    AGMT_ST_DT: data.AGMT_ST_DT || data.RATE_STRT_DT || '',     // RATE_STRT_DT -> AGMT_ST_DT
    AGMT_END_DT: data.AGMT_END_DT || data.RATE_END_DT || '',    // RATE_END_DT -> AGMT_END_DT
    GRP_NO: data.GRP_NO || data.GRP_ID || '',                   // GRP_ID -> GRP_NO
    GRP_NM: data.GRP_NM || '',                                  // 단체 이름
    PYM_ACNT_ID: data.PYM_ACNT_ID || '',
    DPST_AMT: data.DPST_AMT || data.ASSR_BAL || 0,              // ASSR_BAL -> DPST_AMT
    PREPAY_AMT: data.PREPAY_AMT || data.PREPD_BAL || 0,         // PREPD_BAL -> PREPAY_AMT
    EQT_NM: data.EQT_NM || '',
    EQT_MDL_NM: data.EQT_MDL_NM || data.VIEW_MOD_NM || '',      // VIEW_MOD_NM -> EQT_MDL_NM
    EQT_SERNO: data.EQT_SERNO || data.SERNO_DTOA || '',         // SERNO_DTOA -> EQT_SERNO
    PREV_MON_AMT: data.PREV_MON_AMT || data.BILL_AMT_BEFORE || 0,
    CUR_MON_AMT: data.CUR_MON_AMT || data.BILL_AMT_NOW || 0,
    // 추가 필드
    SO_NM: data.SO_NM || '',                                    // 지점명
    STREET_ADDR_FULL: data.STREET_ADDR_FULL || data.ROAD_ADDR || '', // 도로명주소
    ADDR_FULL: data.ADDR_FULL || data.JIBUN_ADDR || '',         // 지번주소
    CTRT_APLY_STRT_DT: data.CTRT_APLY_STRT_DT || '',              // 약정 시작일 (없으면 '-' 표시)
    CTRT_APLY_END_DT: data.CTRT_APLY_END_DT || '',                // 약정 종료일 (없으면 '-' 표시)
    NOTRECEV: data.NOTRECEV || data.NOT_RECV || ''              // 장비 (미수신 정보)
  };
};

// ============ 기본조회 API ============

/**
 * 고객 검색 (조건별)
 *
 * 성능 최적화 버전:
 * - CUST_ID 검색: getConditionalCustList2 (SERCH_GB 없이 직접 조회)
 * - 전화번호/계약ID/장비번호: getCustInfo를 통해 고객 상세 조회
 *
 * 테스트용 고객 ID:
 * - 푸꾸옥: 1001857577 (TEL: 010-5134-6878)
 * - 하노이: 1001857578
 * - 가나다: 1001846265
 */
export const searchCustomer = async (params: CustomerSearchParams): Promise<ApiResponse<CustomerInfo[]>> => {
  // 세션에서 LOGIN_ID 획득 (접속자 ID, ex. A20117965)
  let loginId = 'SYSTEM';
  try {
    const userInfoStr = sessionStorage.getItem('userInfo') || localStorage.getItem('userInfo');
    if (userInfoStr) {
      const userInfo = JSON.parse(userInfoStr);
      loginId = userInfo.userId || userInfo.USR_ID || userInfo.LOGIN_ID || 'SYSTEM';
    }
  } catch (e) {
    console.log('[CustomerAPI] Failed to get LOGIN_ID from session');
  }

  // 고객ID 검색 - getConditionalCustList2 사용 (CUST_ID + SERCH_GB + LOGIN_ID)
  if (params.searchType === 'CUSTOMER_ID' && params.customerId) {
    const reqParams = {
      CUST_ID: params.customerId,
      SERCH_GB: '3',
      LOGIN_ID: loginId
    };
    console.log('[CustomerAPI] CUSTOMER_ID search params:\n' + JSON.stringify(reqParams, null, 2));
    const result = await apiCall<any>('/customer/common/customercommon/getConditionalCustList2', reqParams);

    if (result.success && result.data) {
      const dataArray = Array.isArray(result.data) ? result.data : [result.data];
      // Apply field mapping
      const mappedData = dataArray.map(mapCustomerFields);
      return { ...result, data: mappedData };
    }
    return { ...result, data: [] };
  }

  // 계약ID 검색
  // 1차: getCtrtIDforSmartPhone API 시도 (JAR 배포 후 사용 가능)
  // 2차: getCustomerCtrtInfo -> getConditionalCustList2 fallback
  if (params.searchType === 'CONTRACT_ID' && params.contractId) {
    // SO_ID 획득 (세션에서)
    let soId = '';
    try {
      const userInfoStr = sessionStorage.getItem('userInfo') || localStorage.getItem('userInfo');
      if (userInfoStr) {
        const userInfo = JSON.parse(userInfoStr);
        const authSoList = userInfo.authSoList || userInfo.AUTH_SO_List || [];
        if (authSoList.length > 0) {
          soId = authSoList[0].SO_ID || authSoList[0].soId || '';
        }
        if (!soId) {
          soId = userInfo.soId || userInfo.SO_ID || '';
        }
      }
    } catch (e) {
      console.log('[CustomerAPI] Failed to get SO_ID from session');
    }

    // 1차 시도: getCtrtIDforSmartPhone (JAR 배포 후 활성화)
    if (soId) {
      try {
        console.log('[CustomerAPI] Trying getCtrtIDforSmartPhone for CONTRACT_ID: ' + params.contractId);
        const ctrtResult = await apiCall<any>('/customer/phoneNumber/getCtrtIDforSmartPhone', {
          SO_ID: soId,
          CTRT_ID: params.contractId
        });

        if (ctrtResult.success && ctrtResult.data) {
          const dataArray = Array.isArray(ctrtResult.data) ? ctrtResult.data : [ctrtResult.data];
          if (dataArray.length > 0) {
            console.log('[CustomerAPI] getCtrtIDforSmartPhone success for CONTRACT_ID');
            const mappedData = dataArray.map(mapCustomerFields);
            return { ...ctrtResult, data: mappedData };
          }
        }
        console.log('[CustomerAPI] getCtrtIDforSmartPhone returned no data for CONTRACT_ID, trying fallback...');
      } catch (error) {
        console.log('[CustomerAPI] getCtrtIDforSmartPhone failed for CONTRACT_ID, trying fallback...', error);
      }
    }

    // 2차 시도: getCustomerCtrtInfo -> getConditionalCustList2 (fallback)
    const ctrtResult = await apiCall<any>('/customer/negociation/getCustomerCtrtInfo', { CTRT_ID: params.contractId });

    if (ctrtResult.success && ctrtResult.data) {
      const ctrtData = Array.isArray(ctrtResult.data) ? ctrtResult.data[0] : ctrtResult.data;
      const custId = ctrtData?.CUST_ID;

      if (custId) {
        const result = await apiCall<any>('/customer/common/customercommon/getConditionalCustList2', {
          CUST_ID: custId,
          SERCH_GB: '3',
          LOGIN_ID: loginId
        });
        if (result.success && result.data) {
          const dataArray = Array.isArray(result.data) ? result.data : [result.data];
          const mappedData = dataArray.map(mapCustomerFields);
          return { ...result, data: mappedData };
        }
      }
    }
    return { success: false, message: '계약ID로 고객을 찾을 수 없습니다.', data: [] };
  }

  // 전화번호/고객명 검색
  // 1차: getCtrtIDforSmartPhone API 시도 (JAR 배포 후 사용 가능)
  // 2차: getConditionalCustList2 SERCH_GB=3 fallback
  if (params.searchType === 'PHONE_NAME') {
    if (!params.phoneNumber && !params.customerName) {
      return { success: false, message: '전화번호 또는 고객명을 입력해주세요.', data: [] };
    }

    // SO_ID 획득 (세션에서)
    let soId = '';
    try {
      const userInfoStr = sessionStorage.getItem('userInfo') || localStorage.getItem('userInfo');
      if (userInfoStr) {
        const userInfo = JSON.parse(userInfoStr);
        // authSoList 첫 번째 항목 또는 soId 사용
        const authSoList = userInfo.authSoList || userInfo.AUTH_SO_List || [];
        if (authSoList.length > 0) {
          soId = authSoList[0].SO_ID || authSoList[0].soId || '';
        }
        if (!soId) {
          soId = userInfo.soId || userInfo.SO_ID || '';
        }
      }
    } catch (e) {
      console.log('[CustomerAPI] Failed to get SO_ID from session');
    }

    // 1차 시도: getCtrtIDforSmartPhone (JAR 배포 후 활성화)
    if (soId) {
      try {
        const ctrtParams: Record<string, any> = { SO_ID: soId };
        if (params.phoneNumber) ctrtParams.TEL_NO = params.phoneNumber;
        if (params.customerName) ctrtParams.CUST_NM = params.customerName;

        console.log('[CustomerAPI] Trying getCtrtIDforSmartPhone:\n' + JSON.stringify(ctrtParams, null, 2));
        const ctrtResult = await apiCall<any>('/customer/phoneNumber/getCtrtIDforSmartPhone', ctrtParams);

        if (ctrtResult.success && ctrtResult.data) {
          const dataArray = Array.isArray(ctrtResult.data) ? ctrtResult.data : [ctrtResult.data];
          if (dataArray.length > 0) {
            console.log('[CustomerAPI] getCtrtIDforSmartPhone success:', dataArray.length, 'results');
            const mappedData = dataArray.map(mapCustomerFields);
            return { ...ctrtResult, data: mappedData };
          }
        }
        console.log('[CustomerAPI] getCtrtIDforSmartPhone returned no data, trying fallback...');
      } catch (error) {
        console.log('[CustomerAPI] getCtrtIDforSmartPhone failed, trying fallback...', error);
      }
    }

    // 2차 시도: getConditionalCustList2 SERCH_GB=3 (fallback)
    const reqParams: Record<string, any> = {
      SERCH_GB: '3',
      LOGIN_ID: loginId
    };
    // 전화번호, 이름 둘 다 전송 (OR 검색)
    if (params.phoneNumber) {
      reqParams.TEL_NO = params.phoneNumber;
    }
    if (params.customerName) {
      reqParams.CUST_NM = params.customerName;
    }
    console.log('[CustomerAPI] PHONE_NAME search params:\n' + JSON.stringify(reqParams, null, 2));

    try {
      const result = await apiCall<any>('/customer/common/customercommon/getConditionalCustList2', reqParams);
      if (result.success && result.data) {
        const dataArray = Array.isArray(result.data) ? result.data : [result.data];
        const mappedData = dataArray.map(mapCustomerFields);
        return { ...result, data: mappedData };
      }
      return { ...result, data: [] };
    } catch (error) {
      return { success: false, message: '전화번호 검색 시간이 초과되었습니다. 고객ID로 검색해주세요.', data: [] };
    }
  }

  // 장비번호 검색 - SERCH_GB=3 사용 (D'Live 서버 성능에 따라 Timeout 가능)
  if (params.searchType === 'EQUIPMENT_NO' && params.equipmentNo) {
    const reqParams = {
      SERCH_GB: '3',
      LOGIN_ID: loginId,
      EQT_SERNO: params.equipmentNo,
      MAC_ADDR: ''
    };
    console.log('[CustomerAPI] EQUIPMENT_NO search params:\n' + JSON.stringify(reqParams, null, 2));

    try {
      const result = await apiCall<any>('/customer/common/customercommon/getConditionalCustList2', reqParams);
      if (result.success && result.data) {
        const dataArray = Array.isArray(result.data) ? result.data : [result.data];
        const mappedData = dataArray.map(mapCustomerFields);
        return { ...result, data: mappedData };
      }
      return { ...result, data: [] };
    } catch (error) {
      return { success: false, message: '장비번호 검색 시간이 초과되었습니다. 고객ID로 검색해주세요.', data: [] };
    }
  }

  return { success: false, message: '검색 조건을 입력해주세요.', data: [] };
};

/**
 * 고객 통합 검색 (모든 파라미터를 한 번에 전송)
 * API: /customer/common/customercommon/getConditionalCustList2 (SERCH_GB=3)
 *
 * getConditionalCustList3 지원 파라미터:
 * - CUST_ID: 고객ID
 * - CUST_NM: 고객명 (LIKE 검색)
 * - TEL_NO: 전화번호
 * - CTRT_ID: 계약ID
 * - EQT_SERNO: 장비번호
 * - MAC_ADDR: MAC 주소
 * - LOGIN_ID: 로그인ID (필수 - 권한체크용)
 *
 * 모든 조건은 AND로 결합되어 모든 조건을 만족하는 결과만 반환
 */
export const searchCustomerAll = async (params: {
  custId?: string;
  contractId?: string;
  phoneNumber?: string;
  customerName?: string;
  equipmentNo?: string;
}): Promise<ApiResponse<CustomerInfo[]>> => {
  // 세션에서 LOGIN_ID 획득
  let loginId = 'SYSTEM';
  try {
    const userInfoStr = sessionStorage.getItem('userInfo') || localStorage.getItem('userInfo');
    if (userInfoStr) {
      const userInfo = JSON.parse(userInfoStr);
      loginId = userInfo.userId || userInfo.USR_ID || userInfo.LOGIN_ID || 'SYSTEM';
    }
  } catch (e) {
    console.log('[CustomerAPI] Failed to get session info');
  }

  // 요청 파라미터 구성 - SERCH_GB=3으로 getConditionalCustList3 사용
  const reqParams: Record<string, any> = {
    SERCH_GB: '3',
    LOGIN_ID: loginId
  };

  // 입력된 값만 추가
  if (params.custId) reqParams.CUST_ID = params.custId;
  if (params.contractId) reqParams.CTRT_ID = params.contractId;
  if (params.phoneNumber) reqParams.TEL_NO = params.phoneNumber;
  if (params.customerName) reqParams.CUST_NM = params.customerName;
  if (params.equipmentNo) reqParams.EQT_SERNO = params.equipmentNo;

  console.log('[CustomerAPI] searchCustomerAll 요청 파라미터:\n' + JSON.stringify(reqParams, null, 2));

  try {
    // getConditionalCustList2 API 호출 (SERCH_GB=3 → getConditionalCustList3 SQL 실행)
    const result = await apiCall<any>('/customer/common/customercommon/getConditionalCustList2', reqParams);
    console.log('[CustomerAPI] searchCustomerAll 응답:', result);

    if (result.success && result.data) {
      const dataArray = Array.isArray(result.data) ? result.data : [result.data];
      const mappedData = dataArray.map(mapCustomerFields);
      return { ...result, data: mappedData };
    }
    return { ...result, data: [] };
  } catch (error) {
    console.error('[CustomerAPI] searchCustomerAll 오류:', error);
    return { success: false, message: '검색 중 오류가 발생했습니다.', data: [] };
  }
};

/**
 * 고객 상세 정보 조회
 */
export const getCustomerDetail = async (custId: string): Promise<ApiResponse<CustomerInfo>> => {
  return apiCall<CustomerInfo>('/customer/negociation/getCustInfo', { CUST_ID: custId });
};

/**
 * 계약 현황 건수 조회
 * API: customer/negociation/getCustCtrtInfoListCnt_1.req
 */
export const getContractStatusCount = async (custId: string): Promise<ApiResponse<ContractStatusCount[]>> => {
  return apiCall<ContractStatusCount[]>('/customer/negociation/getCustCtrtInfoListCnt_1', { CUST_ID: custId });
};

/**
 * 계약 목록 조회 (전체)
 * API: customer/negociation/getCustCtrtAll.req
 */
export const getContractList = async (custId: string): Promise<ApiResponse<ContractInfo[]>> => {
  const result = await apiCall<any>('/customer/negociation/getCustCtrtAll', { CUST_ID: custId });
  if (result.success && result.data) {
    const dataArray = Array.isArray(result.data) ? result.data : [result.data];
    const mappedData = dataArray.map(mapContractFields);
    return { ...result, data: mappedData };
  }
  return result as ApiResponse<ContractInfo[]>;
};

/**
 * 계약 상세 검색
 * API: customer/negociation/getCustSearchCtrt.req
 */
export const searchContract = async (custId: string, searchParams?: Record<string, any>): Promise<ApiResponse<ContractInfo[]>> => {
  const result = await apiCall<any>('/customer/negociation/getCustSearchCtrt', {
    CUST_ID: custId,
    ...searchParams
  });
  if (result.success && result.data) {
    const dataArray = Array.isArray(result.data) ? result.data : [result.data];
    const mappedData = dataArray.map(mapContractFields);
    return { ...result, data: mappedData };
  }
  return result as ApiResponse<ContractInfo[]>;
};

/**
 * 상품/프로모션 정보 조회
 * API: customer/work/getProdPromotionInfo.req
 */
export const getProductPromotionInfo = async (ctrtId: string): Promise<ApiResponse<any>> => {
  return apiCall<any>('/customer/work/getProdPromotionInfo', { CTRT_ID: ctrtId });
};

/**
 * 요금 내역 조회
 * API: customer/negociation/getCustAccountInfo.req
 */
export const getBillingHistory = async (custId: string, pymAcntId?: string): Promise<ApiResponse<BillingInfo[]>> => {
  const loginId = getLoginIdFromSession();
  return apiCall<BillingInfo[]>('/customer/negociation/getCustAccountInfo', {
    CUST_ID: custId,
    PYM_ACNT_ID: pymAcntId,
    LOGIN_ID: loginId
  });
};

/**
 * 수납 내역 조회
 * API: customer/negociation/getCustDpstInfo.req
 */
export const getPaymentHistory = async (custId: string): Promise<ApiResponse<any[]>> => {
  const loginId = getLoginIdFromSession();
  return apiCall<any[]>('/customer/negociation/getCustDpstInfo', { CUST_ID: custId, LOGIN_ID: loginId });
};

/**
 * 미납 내역 조회 (현재 기준)
 * API: billing/unpayment/upreport/getUnpaymentNowList.req
 */
export const getUnpaymentList = async (custId: string, pymAcntId?: string): Promise<ApiResponse<UnpaymentInfo[]>> => {
  const loginId = getLoginIdFromSession();
  return apiCall<UnpaymentInfo[]>('/billing/unpayment/upreport/getUnpaymentNowList', {
    CUST_ID: custId,
    PYM_ACNT_ID: pymAcntId,
    LOGIN_ID: loginId
  });
};

/**
 * 미납 상세 내역 조회
 * API: billing/unpayment/upreport/getUnpaymentNowDtlList.req
 */
export const getUnpaymentDetail = async (custId: string, billYm: string): Promise<ApiResponse<any[]>> => {
  const loginId = getLoginIdFromSession();
  return apiCall<any[]>('/billing/unpayment/upreport/getUnpaymentNowDtlList', {
    LOGIN_ID: loginId,
    CUST_ID: custId,
    BILL_YM: billYm
  });
};

/**
 * 납부 정보 조회 (Legacy)
 */
export const getPaymentInfo = async (custId: string): Promise<ApiResponse<PaymentInfo[]>> => {
  return apiCall<PaymentInfo[]>('/customer/negociation/getCustPymInfo', { CUST_ID: custId });
};

/**
 * 납부계정 정보 조회 (모바일용)
 * API: customer/negociation/getCustAccountInfo_m.req
 *
 * 응답: PYM_ACNT_ID, PYM_MTHD_NM, BANK_CARD_NM, BANK_CARD_NO, BILL_MTHD, UPYM_AMT_ACNT
 */
export interface PaymentAccountInfo {
  PYM_ACNT_ID: string;       // 납부계정ID
  PYM_MTHD_NM: string;       // 납부방법명 (자동이체, 신용카드 등)
  BANK_CARD_NM: string;      // 은행/카드사명
  BANK_CARD_NO: string;      // 계좌/카드번호
  BILL_MTHD: string;         // 청구방법 (실물+이메일+SMS 등)
  UPYM_AMT_ACNT: number;     // 미납금액
}

export const getPaymentAccountsRaw = async (custId: string): Promise<ApiResponse<PaymentAccountInfo[]>> => {
  const loginId = getLoginIdFromSession();
  return apiCall<PaymentAccountInfo[]>('/customer/negociation/getCustAccountInfo_m', {
    CUST_ID: custId,
    LOGIN_ID: loginId
  });
};

/**
 * 납부계정 통합 조회
 * getCustAccountInfo_m API 직접 사용 (ROLLUP 없이 순수 납부계정만)
 * UPYM_AMT → UPYM_AMT_ACNT 매핑
 */
export const getPaymentAccounts = async (custId: string): Promise<ApiResponse<PaymentAccountInfo[]>> => {
  const loginId = getLoginIdFromSession();

  // getCustAccountInfo_m API 직접 호출 (ROLLUP 행 없음)
  const response = await apiCall<any[]>('/customer/negociation/getCustAccountInfo_m', {
    CUST_ID: custId,
    LOGIN_ID: loginId
  });

  if (response.success && response.data) {
    // UPYM_AMT → UPYM_AMT_ACNT 매핑 및 유효한 PYM_ACNT_ID만 필터링
    const mapped: PaymentAccountInfo[] = response.data
      .filter((item: any) => item.PYM_ACNT_ID && /^\d{10}$/.test(item.PYM_ACNT_ID))
      .map((item: any) => ({
        PYM_ACNT_ID: item.PYM_ACNT_ID,
        PYM_MTHD_NM: item.PYM_MTHD_NM || '',
        BANK_CARD_NM: item.BANK_CARD_NM || null,
        BANK_CARD_NO: item.BANK_CARD_NO || null,
        BILL_MTHD: item.BILL_MTHD || '',
        UPYM_AMT_ACNT: item.UPYM_AMT ?? item.UPYM_AMT_ACNT ?? 0
      }));

    return { success: true, data: mapped, code: 'SUCCESS', message: 'OK' } as ApiResponse<PaymentAccountInfo[]>;
  }

  return response as ApiResponse<PaymentAccountInfo[]>;
};

/**
 * 요금내역 조회 (모바일용)
 * API: customer/negociation/getCustBillInfo_m.req
 *
 * 납부정보에서 선택한 납부계정(PYM_ACNT_ID)로 조회
 * 응답: BILL_YYMM, BILL_CYCL, BILL_AMT, RCPT_AMT, UPYM_AMT
 */
export interface BillingDetailInfo {
  BILL_YYMM: string;         // 청구년월
  BILL_CYCL: string;         // 청구주기 (정기, 일회성)
  BILL_AMT: number;          // 청구금액
  RCPT_AMT: number;          // 수납금액
  UPYM_AMT: number;          // 미납금액
}

export const getBillingDetails = async (custId: string, pymAcntId?: string): Promise<ApiResponse<BillingDetailInfo[]>> => {
  const loginId = getLoginIdFromSession();
  const params: Record<string, any> = { CUST_ID: custId, LOGIN_ID: loginId };
  if (pymAcntId) {
    params.PYM_ACNT_ID = pymAcntId;
  }
  return apiCall<BillingDetailInfo[]>('/customer/negociation/getCustBillInfo_m', params);
};

/**
 * 휴대폰결제(선불) 조회
 * API: customer/negociation/getHPPayList.req
 */
export const getHPPayList = async (custId: string): Promise<ApiResponse<HPPayInfo[]>> => {
  return apiCall<HPPayInfo[]>('/customer/negociation/getHPPayList', { CUST_ID: custId });
};

// ============ 이력 조회 API ============

/**
 * 상담 이력 조회
 * API: customer/negociation/getTgtCtrtRcptHist_m.req
 *
 * D'Live SQL: CUST_ID + CTRT_ID 필수
 * 응답: START_DATE, CNSL_SLV_CL_NM, CNSL_RSLT, RCPT_NM, REQ_CTX, PROC_CT
 */
export const getConsultationHistory = async (
  custId: string,
  ctrtId: string,
  limit: number = 10
): Promise<ApiResponse<ConsultationHistory[]>> => {
  const loginId = getLoginIdFromSession();
  return apiCall<ConsultationHistory[]>('/customer/negociation/getTgtCtrtRcptHist_m', {
    CUST_ID: custId,
    CTRT_ID: ctrtId,
    PAGE_SIZE: limit,
    LOGIN_ID: loginId
  });
};

/**
 * 작업 이력 조회
 * API: customer/negociation/getTgtCtrtWorkList_m.req
 *
 * D'Live SQL: CUST_ID + CTRT_ID 필수
 * 응답: HOPE_DT, PROD_NM, WRK_CD_NM, WRK_STAT_CD_NM, CMPL_DATE, WRK_NM, WRK_CRR_NM, CTRT_ADDR, MEMO
 */
export const getWorkHistory = async (
  custId: string,
  ctrtId: string,
  limit: number = 10
): Promise<ApiResponse<WorkHistory[]>> => {
  const loginId = getLoginIdFromSession();
  return apiCall<WorkHistory[]>('/customer/negociation/getTgtCtrtWorkList_m', {
    CUST_ID: custId,
    CTRT_ID: ctrtId,
    PAGE_SIZE: limit,
    LOGIN_ID: loginId
  });
};

// ============ 정보 변경 API ============

/**
 * 전화번호 변경
 * API: customer/negociation/updateCustTelDetailInfo.req
 *
 * 백엔드에서 TEL_NO를 TEL_DDD, TEL_FIX, TEL_DTL로 자동 분리하므로
 * 프론트에서는 TEL_NO만 보내도 됨
 */
export const updatePhoneNumber = async (params: PhoneChangeRequest): Promise<ApiResponse<any>> => {
  // 세션에서 사용자 ID 가져오기
  let chgUid = params.CHG_UID || 'SYSTEM';
  try {
    const userInfoStr = sessionStorage.getItem('userInfo') || localStorage.getItem('userInfo');
    if (userInfoStr) {
      const userInfo = JSON.parse(userInfoStr);
      chgUid = userInfo.userId || userInfo.USR_ID || chgUid;
    }
  } catch (e) {
    console.log('[CustomerAPI] Failed to get CHG_UID from session');
  }

  return apiCall<any>('/customer/negociation/updateCustTelDetailInfo', {
    ...params,
    CHG_UID: chgUid,
    TEL_NO_TP: params.TEL_NO_TP || '2',
    USE_YN: params.USE_YN || 'Y',
    MAIN_TEL_YN: params.MAIN_TEL_YN || 'N',
    CUST_REL: params.CUST_REL || '',
  });
};

/**
 * 설치주소 변경
 * API: /customer/etc/saveMargeAddrOrdInfo.req
 *
 * CUST_FLAG='1' 이면 고객주소도 함께 변경
 * PYM_FLAG='1' 이면 청구지주소도 함께 변경
 */
export const updateInstallAddress = async (params: InstallAddressChangeRequest): Promise<ApiResponse<any>> => {
  // 세션에서 사용자 ID 가져오기
  let chgUid = params.CHG_UID || 'SYSTEM';
  try {
    const userInfoStr = sessionStorage.getItem('userInfo') || localStorage.getItem('userInfo');
    if (userInfoStr) {
      const userInfo = JSON.parse(userInfoStr);
      chgUid = userInfo.userId || userInfo.USR_ID || chgUid;
    }
  } catch (e) {
    console.log('[CustomerAPI] Failed to get CHG_UID from session');
  }

  return apiCall<any>('/customer/etc/saveMargeAddrOrdInfo', {
    CTRT_ID: params.CTRT_ID,
    POST_ID: params.POST_ID,
    BLD_ID: params.BLD_ID || '',
    BUN_NO: params.BUN_NO || '',
    HO_NM: params.HO_NM || '',
    BLD_CL: params.BLD_CL || '',
    BLD_NM: params.BLD_NM || '',
    APT_DONG_NO: params.APT_DONG_NO || '',
    APT_HO_CNT: params.APT_HO_CNT || '',
    ADDR_DTL: params.ADDR_DTL || '',
    STREET_ID: params.STREET_ID || '',
    INSTL_LOC: params.INSTL_LOC || '',
    CUST_FLAG: params.CUST_FLAG || '0',
    PYM_FLAG: params.PYM_FLAG || '0',
    CHG_UID: chgUid
  });
};

/**
 * 청구지주소 변경
 * API: /customer/etc/savePymAddrInfo.req
 *
 * CUST_FLAG='1' 이면 고객주소도 함께 변경
 * PYM_FLAG='1' 고정
 */
export const updateBillingAddress = async (params: BillingAddressChangeRequest): Promise<ApiResponse<any>> => {
  // 세션에서 사용자 ID 가져오기
  let chgUid = params.CHG_UID || 'SYSTEM';
  try {
    const userInfoStr = sessionStorage.getItem('userInfo') || localStorage.getItem('userInfo');
    if (userInfoStr) {
      const userInfo = JSON.parse(userInfoStr);
      chgUid = userInfo.userId || userInfo.USR_ID || chgUid;
    }
  } catch (e) {
    console.log('[CustomerAPI] Failed to get CHG_UID from session');
  }

  return apiCall<any>('/customer/etc/savePymAddrInfo', {
    CTRT_ID: params.CTRT_ID,
    ADDR_ORD: params.ADDR_ORD || '1',
    CHG_UID: chgUid,
    CUST_FLAG: params.CUST_FLAG || '0',
    PYM_FLAG: '1'  // 고정값
  });
};

/**
 * 고객주소 변경 (Legacy - 호환성 유지)
 * TODO: 백엔드에서 고객주소만 변경하는 API 개발 필요
 * 현재는 설치주소 변경 API로 대체 (CUST_FLAG='1' 사용)
 */
export const updateAddress = async (params: AddressChangeRequest): Promise<ApiResponse<any>> => {
  console.warn('[CustomerAPI] updateAddress is deprecated. Use updateInstallAddress with CUST_FLAG instead.');
  const reqParams: Record<string, any> = {
    CUST_ID: params.CUST_ID,
    ADDR_ORD: params.ADDR_ORD || '1',
  };

  if (params.DONGMYON_NM) reqParams.DONGMYON_NM = params.DONGMYON_NM;
  if (params.STREET_ID) reqParams.STREET_ID = params.STREET_ID;
  if (params.ZIP_CD) reqParams.ZIP_CD = params.ZIP_CD;
  if (params.ADDR_DTL) reqParams.ADDR_DTL = params.ADDR_DTL;

  return apiCall<any>('/customer/etc/saveMargeAddrOrdInfo', reqParams);
};

/**
 * 납부방법 변경
 * API: customer/customer/general/customerPymChgAddManager.req
 *
 * Backend params:
 * - CUST_ID: 고객ID
 * - PYM_ACNT_ID: 납부계정ID
 * - PYM_MTH_CD: 납부방법코드 (01: 자동이체, 02: 신용카드)
 * - BANK_CD: 은행코드 (자동이체 시)
 * - ACNT_NO: 계좌번호 (자동이체 시)
 * - CARD_NO: 카드번호 (신용카드 시)
 * - CARD_VALID_YM: 카드유효기간 YYMM (신용카드 시)
 * - ACNT_OWNER_NM: 예금주/카드소유자명
 * - USR_ID: 처리자ID
 */
export const updatePaymentMethod = async (params: PaymentMethodChangeRequest): Promise<ApiResponse<any>> => {
  // 세션에서 사용자 ID 가져오기
  let usrId = params.USR_ID || 'MOBILE_USER';
  try {
    const userInfoStr = sessionStorage.getItem('userInfo') || localStorage.getItem('userInfo');
    if (userInfoStr) {
      const userInfo = JSON.parse(userInfoStr);
      usrId = userInfo.userId || userInfo.USR_ID || usrId;
    }
  } catch (e) {
    console.log('[CustomerAPI] Failed to get USR_ID from session');
  }

  return apiCall<any>('/customer/customer/general/customerPymChgAddManager', {
    ...params,
    USR_ID: usrId
  });
};

/**
 * 계좌 인증 (예금주 실명 확인)
 * 실제 계좌 인증 API가 있으면 연동, 없으면 시뮬레이션
 */
export const verifyBankAccount = async (params: AccountVerifyRequest): Promise<ApiResponse<any>> => {
  // TODO: 실제 계좌 인증 API 연동
  // D'Live 계좌 인증 API가 있는 경우 아래 주석 해제
  // return apiCall<any>('/customer/payment/verifyBankAccount', params);

  // 현재는 시뮬레이션 (API 연동 전까지)
  return new Promise((resolve) => {
    setTimeout(() => {
      // 시뮬레이션: 계좌번호가 10자리 이상이면 성공
      if (params.ACNT_NO && params.ACNT_NO.length >= 10) {
        resolve({
          success: true,
          data: { verified: true, ownerName: params.ACNT_OWNER_NM },
          message: '계좌 인증이 완료되었습니다.'
        });
      } else {
        resolve({
          success: false,
          message: '계좌번호를 정확히 입력해주세요.'
        });
      }
    }, 1000);
  });
};

/**
 * 카드 인증 (카드번호 유효성 확인)
 * 실제 카드 인증 API가 있으면 연동, 없으면 시뮬레이션
 */
export const verifyCard = async (params: CardVerifyRequest): Promise<ApiResponse<any>> => {
  // TODO: 실제 카드 인증 API 연동
  // D'Live 카드 인증 API가 있는 경우 아래 주석 해제
  // return apiCall<any>('/customer/payment/verifyCard', params);

  // 현재는 시뮬레이션 (API 연동 전까지)
  return new Promise((resolve) => {
    setTimeout(() => {
      // 시뮬레이션: 카드번호가 16자리면 성공
      if (params.CARD_NO && params.CARD_NO.length === 16) {
        resolve({
          success: true,
          data: { verified: true },
          message: '카드 인증이 완료되었습니다.'
        });
      } else {
        resolve({
          success: false,
          message: '카드번호 16자리를 정확히 입력해주세요.'
        });
      }
    }, 1000);
  });
};

// ============ 상담/AS API ============

/**
 * 상담 이력 등록
 * API: customer/negociation/saveCnslRcptInfo.req
 *
 * 백엔드 필수 파라미터:
 * - CUST_ID, CTRT_ID (계약 단위 등록)
 * - CNSL_MST_CL (대분류), CNSL_MID_CL (중분류), CNSL_SLV_CL (소분류)
 * - REQ_CTX (요청사항)
 * - SO_ID, MST_SO_ID, POST_ID
 * 고정값: RCPT_TP='G1', CUST_REL='A', PRESS_RCPT_YN='N', SUBS_TP='1', CTI_CID='0'
 */
export const registerConsultation = async (params: ConsultationRequest): Promise<ApiResponse<any>> => {
  // 세션/로컬 스토리지에서 SO_ID, MST_SO_ID 가져오기
  let soId = params.SO_ID || '';
  let mstSoId = params.MST_SO_ID || '';
  try {
    // sessionStorage 먼저 시도, 없으면 localStorage fallback
    const userInfoStr = sessionStorage.getItem('userInfo') || localStorage.getItem('userInfo') || localStorage.getItem('userInfo');
    if (userInfoStr) {
      const userInfo = JSON.parse(userInfoStr);
      if (!soId) {
        const authSoList = userInfo.authSoList || userInfo.AUTH_SO_List || [];
        if (authSoList.length > 0) {
          soId = authSoList[0].SO_ID || authSoList[0].soId || '';
        }
        if (!soId) {
          soId = userInfo.soId || userInfo.SO_ID || '';
        }
      }
      if (!mstSoId) {
        mstSoId = userInfo.mstSoId || userInfo.MST_SO_ID || soId;
      }
    }
  } catch (e) {
    console.log('[CustomerAPI] Failed to get SO_ID from session/localStorage');
  }

  return apiCall<any>('/customer/negociation/saveCnslRcptInfo', {
    ...params,
    SO_ID: soId,
    MST_SO_ID: mstSoId,
    // 고정값
    RCPT_TP: 'G1',
    CUST_REL: 'A',
    PRESS_RCPT_YN: 'N',
    SUBS_TP: '1',
    CTI_CID: '0'
  });
};

/**
 * AS 접수
 * API: customer/work/modAsPdaReceipt.req
 *
 * 프론트엔드 UI 파라미터를 백엔드 파라미터로 매핑:
 * - AS_CL_CD -> WRK_DTL_TCD (작업상세유형코드, CODE_GROUP: CMWT001)
 * - AS_RESN_L_CD -> WRK_RCPT_CL (작업접수분류, CODE_GROUP: CMAS000)
 * - AS_RESN_M_CD -> WRK_RCPT_CL_DTL (작업접수분류상세, CODE_GROUP: CMAS001)
 * - SCHD_DT + SCHD_TM -> WRK_HOPE_DTTM (희망일시)
 * - AS_CNTN -> MEMO
 */
export const registerASRequest = async (params: ASRequestParams): Promise<ApiResponse<any>> => {
  // WRK_DTL_TCD 매핑 (AS구분 -> 작업상세유형코드) - CMWT001
  const wrkDtlTcdMap: Record<string, string> = {
    '01': '0310',  // 장애처리(AS)
    '02': '0320',  // 장비변경(AS)
    '03': '0330',  // 망장애(AS)
    '04': '0350',  // 현장방어(AS)
    '05': '0360',  // OTT BOX (AS)
    '06': '0370',  // 올인원(AS)
    '07': '0380',  // 완전철거(재할당)
  };

  // WRK_RCPT_CL 매핑 (AS사유대분류 -> 작업접수분류) - CMAS000
  const wrkRcptClMap: Record<string, string> = {
    '01': 'EQ',    // 장비
    '02': 'ER',    // 장비/리모콘
    '03': 'CH',    // 채널안나옴
    '04': 'SV',    // 화질/소리불량
    '05': 'IN',    // 인터넷느림/안됨
    '06': 'TL',    // 전화안됨/기능불량
    '07': 'JJ',    // CS(고객서비스)
    '08': 'JH',    // CS(해지회선)
    '09': 'OT',    // OTT BOX
    '10': 'OL',    // 올인원방문서비스
    '11': 'CE',    // 고객환경
    '12': 'SM',    // 스마트카드 장애
  };

  // WRK_RCPT_CL_DTL 매핑 (AS사유중분류 -> 작업접수분류상세) - CMAS001
  const wrkRcptClDtlMap: Record<string, string> = {
    // 장비(EQ)
    '0101': 'EQ1', // 장비교체요청
    '0102': 'EQ3', // 전원불량
    '0103': 'EQ4', // (과금)모뎀 교체
    '0104': 'EQ5', // (과금)AP 교체
    // 장비/리모콘(ER)
    '0201': 'ER4', // STB오작동
    '0202': 'ER5', // 전원불량
    '0203': 'ER6', // 장비교체요청(리모콘)
    '0204': 'ER7', // 장비교체요청(셋탑/모뎀)
    // 채널안나옴(CH)
    '0301': 'CH1', // 전채널 안나옴(수신장애)
    '0302': 'CH2', // 특정채널 안나옴(수신장애)
    // 화질/소리불량(SV)
    '0401': 'SV1', // 소리불량
    '0402': 'SV2', // 화질불량
    // 인터넷(IN) - 상세코드 없음, 대분류만 사용
    // CS(해지회선)(JH)
    '0801': 'JHA', // (해지회선)일정변경
    '0802': 'JHB', // (해지회선)2인1조
    '0803': 'JHC', // (해지회선)고소차량
    // OTT BOX(OT)
    '0901': 'OT1', // 네트워크 장애
    '0902': 'OT2', // 조작설명
    '0903': 'OT7', // 전원불량
    // 올인원(OL)
    '1001': 'OL1', // 올인원방문서비스
    // 고객환경(CE)
    '1101': 'CE1', // 공유기(AP)장애
    '1102': 'CE2', // 사용불편
    '1103': 'CE5', // 재연결
  };

  // 세션에서 사용자 정보 가져오기
  let wrkrId = 'MOBILE_USER';
  let crrId = '';
  try {
    const userInfoStr = sessionStorage.getItem('userInfo') || localStorage.getItem('userInfo');
    if (userInfoStr) {
      const userInfo = JSON.parse(userInfoStr);
      wrkrId = userInfo.userId || userInfo.USR_ID || wrkrId;
      crrId = userInfo.crrId || userInfo.CRR_ID || '';
    }
  } catch (e) {
    console.log('[CustomerAPI] Failed to get user info from session');
  }

  // UI params인 경우 변환
  const uiParams = params as unknown as ASRequestUIParams;
  const isUIParams = 'AS_CL_CD' in params;

  // 백엔드 파라미터 구성
  const backendParams: Record<string, any> = {
    // 필수
    POST_ID: (params as ASRequestParams).POST_ID || '',
    CUST_ID: params.CUST_ID,
    CTRT_ID: (params as ASRequestParams).CTRT_ID || '',
    WRK_HOPE_DTTM: isUIParams
      ? uiParams.SCHD_DT + uiParams.SCHD_TM
      : (params as ASRequestParams).WRK_HOPE_DTTM,
    HOPE_DTTM: isUIParams
      ? uiParams.SCHD_DT + uiParams.SCHD_TM
      : (params as ASRequestParams).HOPE_DTTM || (params as ASRequestParams).WRK_HOPE_DTTM,
    WRK_DTL_TCD: isUIParams
      ? (wrkDtlTcdMap[uiParams.AS_CL_CD] || '0310')
      : (params as ASRequestParams).WRK_DTL_TCD,
    WRK_RCPT_CL: isUIParams
      ? (wrkRcptClMap[uiParams.AS_RESN_L_CD] || 'EQ')
      : (params as ASRequestParams).WRK_RCPT_CL,
    WRK_RCPT_CL_DTL: isUIParams
      ? (wrkRcptClDtlMap[uiParams.AS_RESN_M_CD] || 'EQ1')
      : (params as ASRequestParams).WRK_RCPT_CL_DTL,
    MEMO: isUIParams ? uiParams.AS_CNTN : (params as ASRequestParams).MEMO,
    // 고정값
    EMRG_YN: 'N',
    HOLY_YN: 'N',
    TRANS_PROC_YN: 'Y',
    // 사용자 정보
    CRR_ID: crrId,
    WRKR_ID: wrkrId,
    REG_UID: wrkrId,
  };

  // 선택 정보
  if (isUIParams && uiParams.AS_CL_DTL_CD) {
    backendParams.AS_BIZ_CL = uiParams.AS_CL_DTL_CD;
  }
  if (isUIParams && uiParams.TRIP_FEE_CD) {
    backendParams.BIZ_EXPNS_GUIDE = uiParams.TRIP_FEE_CD;
  }

  return apiCall<any>('/customer/work/modAsPdaReceipt', backendParams);
};

// ============ 고객 생성 API ============

/**
 * 잠재고객 생성
 * API: customer/customer/general/customerManager.req
 */
export const createCustomer = async (params: CustomerCreateRequest): Promise<ApiResponse<any>> => {
  return apiCall<any>('/customer/customer/general/customerManager', {
    ...params,
    ACTION: 'INSERT'
  });
};

// ============ 전자계약 API (모두싸인 연동) ============

/**
 * 전자계약 요청
 */
export const requestElectronicContract = async (ctrtId: string, custId: string): Promise<ApiResponse<any>> => {
  return apiCall<any>('/customer/contract/requestElectronicSign', {
    CTRT_ID: ctrtId,
    CUST_ID: custId
  });
};

/**
 * 전자서명 상태 조회
 */
export const getElectronicSignStatus = async (ctrtId: string): Promise<ApiResponse<any>> => {
  return apiCall<any>('/customer/contract/getElectronicSignStatus', { CTRT_ID: ctrtId });
};

// ============ 공통 코드 API ============
// Backend: TaskSystemController.java - /common/getCommonCodes (CODE_GROUP param)

/**
 * 상담소분류 코드 조회 (기존)
 */
export const getConsultationCodes = async (): Promise<ApiResponse<any[]>> => {
  return apiCall<any[]>('/common/getCommonCodes', { CODE_GROUP: 'CNSL_CL' });
};

/**
 * 상담대분류 코드 조회 (CMCS010)
 * Returns: code (AS, IN, RT, DI, etc), name
 */
export const getConsultationLargeCodes = async (): Promise<ApiResponse<any[]>> => {
  return apiCall<any[]>('/common/getCommonCodes', { CODE_GROUP: 'CMCS010' });
};

/**
 * 상담중분류 코드 조회 (CMCS020)
 * Returns: code (ASC, INE, RTA, etc), name, ref_code (links to CMCS010 code)
 */
export const getConsultationMiddleCodes = async (): Promise<ApiResponse<any[]>> => {
  return apiCall<any[]>('/common/getCommonCodes', { CODE_GROUP: 'CMCS020' });
};

/**
 * 상담소분류 코드 조회 (CMCS030)
 * Returns: code (ASE1, PDD1, etc), name, ref_code (links to CMCS020 code)
 */
export const getConsultationSmallCodes = async (): Promise<ApiResponse<any[]>> => {
  return apiCall<any[]>('/common/getCommonCodes', { CODE_GROUP: 'CMCS030' });
};

/**
 * AS사유 코드 조회
 */
export const getASReasonCodes = async (): Promise<ApiResponse<any[]>> => {
  return apiCall<any[]>('/common/getCommonCodes', { CODE_GROUP: 'AS_RESN' });
};

/**
 * 고객유형 코드 조회
 */
export const getCustomerTypeCodes = async (): Promise<ApiResponse<any[]>> => {
  return apiCall<any[]>('/common/getCommonCodes', { CODE_GROUP: 'CUST_TP' });
};

/**
 * 통신사 코드 조회
 */
export const getTelecomCodes = async (): Promise<ApiResponse<any[]>> => {
  return apiCall<any[]>('/common/getCommonCodes', { CODE_GROUP: 'TEL_TP' });
};

/**
 * 은행 코드 조회
 */
export const getBankCodes = async (): Promise<ApiResponse<any[]>> => {
  return apiCall<any[]>('/common/getCommonCodes', { CODE_GROUP: 'BANK' });
};

// ============ 주소 검색 API ============

/**
 * 지번주소 검색 (statistics/customer/getPostList)
 * SO_ID 필수 - 미전달시 세션에서 자동 획득
 * @param params 검색 조건 (동/면 이름)
 */
export const searchPostAddress = async (params: PostAddressSearchRequest): Promise<ApiResponse<PostAddressInfo[]>> => {
  // SO_ID가 없으면 세션에서 자동 획득 (getPostList는 SO_ID 필수)
  let soId = params.SO_ID || '';
  let mstSoId = '';
  if (!soId) {
    try {
      const userInfoStr = sessionStorage.getItem('userInfo') || localStorage.getItem('userInfo');
      if (userInfoStr) {
        const userInfo = JSON.parse(userInfoStr);
        const authSoList = userInfo.authSoList || userInfo.AUTH_SO_List || [];
        if (authSoList.length > 0) {
          soId = authSoList[0].SO_ID || authSoList[0].soId || '';
          mstSoId = authSoList[0].MST_SO_ID || authSoList[0].mstSoId || '';
        }
        if (!soId) {
          soId = userInfo.soId || userInfo.SO_ID || '';
        }
        if (!mstSoId) {
          mstSoId = userInfo.mstSoId || userInfo.MST_SO_ID || '';
        }
      }
    } catch (e) {
      console.log('[CustomerAPI] Failed to get SO_ID from session for address search');
    }
  }

  // DONGMYON_NM 절대 보내지 않음 - 서버 쿼리가 깨짐 (0건 반환)
  // DONGMYONG도 서버에서 무시됨 - 클라이언트 필터링으로 처리
  const searchParams: Record<string, string> = {
    SO_ID: soId,
    MST_SO_ID: mstSoId || '200',
    USE_FLAG: params.USE_FLAG || 'Y'
  };

  console.log('[CustomerAPI] searchPostAddress:', { SO_ID: soId, search: params.DONGMYONG });
  return apiCall<PostAddressInfo[]>('/statistics/customer/getPostList', searchParams);
};

/**
 * 도로명주소 검색 (customer/common/customercommon/getStreetAddrList)
 * @param params 검색 조건 (도로명, 건물번호 등)
 */
export const searchStreetAddress = async (params: StreetAddressSearchRequest): Promise<ApiResponse<StreetAddressInfo[]>> => {
  return apiCall<StreetAddressInfo[]>('/customer/common/customercommon/getStreetAddrList', params);
};

// ============ 유틸리티 함수 ============

/**
 * 전화번호 포맷팅
 * - 서울 지역번호(02): 02-XXXX-XXXX (10자리) 또는 02-XXX-XXXX (9자리)
 * - 기타 지역번호: 0XX-XXX-XXXX (10자리) 또는 0XX-XXXX-XXXX (11자리)
 * - 휴대폰: 010-XXXX-XXXX (11자리)
 */
export const formatPhoneNumber = (phone: string): string => {
  if (!phone) return '';
  const cleaned = phone.replace(/\D/g, '');

  // 서울 지역번호 (02)
  if (cleaned.startsWith('02')) {
    if (cleaned.length === 10) {
      // 02-XXXX-XXXX
      return `${cleaned.slice(0, 2)}-${cleaned.slice(2, 6)}-${cleaned.slice(6)}`;
    }
    if (cleaned.length === 9) {
      // 02-XXX-XXXX
      return `${cleaned.slice(0, 2)}-${cleaned.slice(2, 5)}-${cleaned.slice(5)}`;
    }
  }

  // 휴대폰 또는 기타 지역번호 (11자리: 010-XXXX-XXXX, 0XX-XXXX-XXXX)
  if (cleaned.length === 11) {
    return `${cleaned.slice(0, 3)}-${cleaned.slice(3, 7)}-${cleaned.slice(7)}`;
  }

  // 기타 지역번호 (10자리: 0XX-XXX-XXXX)
  if (cleaned.length === 10) {
    return `${cleaned.slice(0, 3)}-${cleaned.slice(3, 6)}-${cleaned.slice(6)}`;
  }

  return phone;
};

/**
 * 전화번호 마스킹 (010-****-5678 형식)
 */
export const maskPhoneNumber = (phone: string): string => {
  if (!phone) return '';
  const cleaned = phone.replace(/\D/g, '');

  // 서울 지역번호 (02): 02-****-5678
  if (cleaned.startsWith('02')) {
    if (cleaned.length === 10) {
      return `${cleaned.slice(0, 2)}-****-${cleaned.slice(6)}`;
    }
    if (cleaned.length === 9) {
      return `${cleaned.slice(0, 2)}-***-${cleaned.slice(5)}`;
    }
  }

  // 휴대폰 또는 기타 지역번호 (11자리): 010-****-5678
  if (cleaned.length === 11) {
    return `${cleaned.slice(0, 3)}-****-${cleaned.slice(7)}`;
  }

  // 기타 지역번호 (10자리): 0XX-***-XXXX
  if (cleaned.length === 10) {
    return `${cleaned.slice(0, 3)}-***-${cleaned.slice(6)}`;
  }

  // 그 외: 앞 3자리와 뒤 4자리만 표시
  if (cleaned.length > 7) {
    return `${cleaned.slice(0, 3)}-${'*'.repeat(cleaned.length - 7)}-${cleaned.slice(-4)}`;
  }

  return phone;
};

/**
 * 금액 포맷팅
 */
export const formatCurrency = (amount: number): string => {
  if (isNaN(amount)) return '0';
  return amount.toLocaleString('ko-KR');
};

/**
 * 날짜 포맷팅 (YYYYMMDD -> YYYY-MM-DD)
 */
export const formatDate = (dateStr: string): string => {
  if (!dateStr || dateStr.length !== 8) return dateStr || '';
  return `${dateStr.slice(0, 4)}-${dateStr.slice(4, 6)}-${dateStr.slice(6)}`;
};

/**
 * 마스킹 처리
 */
export const maskString = (str: string, showFirst: number = 4, showLast: number = 4): string => {
  if (!str || str.length <= showFirst + showLast) return str;
  const masked = '*'.repeat(str.length - showFirst - showLast);
  return str.slice(0, showFirst) + masked + str.slice(-showLast);
};

export default {
  // 기본조회
  searchCustomer,
  searchCustomerAll,
  getCustomerDetail,
  getContractStatusCount,
  getContractList,
  searchContract,
  getProductPromotionInfo,
  getBillingHistory,
  getPaymentHistory,
  getUnpaymentList,
  getUnpaymentDetail,
  getPaymentInfo,
  getHPPayList,
  // 이력조회
  getConsultationHistory,
  getWorkHistory,
  // 정보변경
  updatePhoneNumber,
  updateAddress,
  updatePaymentMethod,
  verifyBankAccount,
  verifyCard,
  // 상담/AS
  registerConsultation,
  registerASRequest,
  // 고객생성
  createCustomer,
  // 전자계약
  requestElectronicContract,
  getElectronicSignStatus,
  // 공통코드
  getConsultationCodes,
  getConsultationLargeCodes,
  getConsultationMiddleCodes,
  getConsultationSmallCodes,
  getASReasonCodes,
  getCustomerTypeCodes,
  getTelecomCodes,
  getBankCodes,
  // 주소검색
  searchPostAddress,
  searchStreetAddress,
  // 유틸
  formatPhoneNumber,
  maskPhoneNumber,
  formatCurrency,
  formatDate,
  maskString
};
