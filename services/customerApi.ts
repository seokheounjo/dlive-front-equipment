/**
 * Customer Management API Service
 * 고객관리 API 서비스
 *
 * 기능분해도 문서 기반 API 정의 (20251229)
 * - 기본조회: 고객정보, 계약현황, 납부정보, 요금내역
 * - 정보변경: 전화번호, 주소(설치/고객/청구지)
 * - 상담/AS: 상담이력, AS접수
 * - 전자계약: 모두싸인 연동
 * - 잠재고객: 고객 신규 등록
 */

// API Base URL (EC2 프록시 서버 직접 연결)
const API_BASE = 'http://52.63.232.141:8080/api';

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

// 고객 기본 정보
export interface CustomerInfo {
  CUST_ID: string;           // 고객ID
  CUST_NM: string;           // 고객명
  TEL_NO: string;            // 전화번호
  HP_NO: string;             // 휴대폰번호
  CUST_ADDR: string;         // 고객주소
  INST_ADDR: string;         // 설치주소
  BILL_ADDR: string;         // 청구지주소
  UNPAY_AMT: number;         // 미납금액 합계
  CUST_TP_CD: string;        // 고객유형코드
  CUST_TP_NM: string;        // 고객유형명
  REG_DT: string;            // 등록일
}

// 계약 정보
export interface ContractInfo {
  CTRT_ID: string;           // 계약ID
  CTRT_STAT_CD: string;      // 계약상태코드
  CTRT_STAT_NM: string;      // 계약상태명
  PROD_NM: string;           // 상품명
  PROD_GRP_NM: string;       // 상품군명
  INST_ADDR: string;         // 설치위치
  OPNG_DT: string;           // 개통일
  TERM_DT: string;           // 해지일
  AGMT_MON: string;          // 약정개월
  AGMT_ST_DT: string;        // 약정시작일
  AGMT_END_DT: string;       // 약정종료일
  GRP_NO: string;            // 단체번호
  PYM_ACNT_ID: string;       // 납부계정ID
  DPST_AMT: number;          // 보증금
  PREPAY_AMT: number;        // 선납금
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
  ACNT_NO: string;           // 계좌번호 (마스킹)
  CARD_NO: string;           // 카드번호 (마스킹)
  BILL_MEDIA_CD: string;     // 청구매체코드
  BILL_MEDIA_NM: string;     // 청구매체명
  UNPAY_AMT: number;         // 미납금액
}

// 요금 내역
export interface BillingInfo {
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

// 상담 이력
export interface ConsultationHistory {
  CNSL_ID: string;           // 상담ID
  RCPT_DT: string;           // 접수일
  CNSL_CL_NM: string;        // 상담소분류
  PROC_STAT_NM: string;      // 처리상태
  RCPT_USR_NM: string;       // 접수자
  REQ_CNTN: string;          // 요청사항
  RSP_CNTN: string;          // 응대내용
}

// 작업 이력
export interface WorkHistory {
  WORK_ID: string;           // 작업ID
  SCHD_DT: string;           // 작업예정일
  PROD_NM: string;           // 상품명
  WORK_TP_NM: string;        // 작업구분
  WORK_STAT_NM: string;      // 작업상태
  CMPL_DT: string;           // 완료일자
  WRKR_NM: string;           // 작업자
  WRKR_DEPT_NM: string;      // 작업자소속
  INST_ADDR: string;         // 설치(작업)주소
  WORK_DRCTN: string;        // 작업지시내용
  WORK_RSLT: string;         // 작업처리내용
}

// 휴대폰결제(선불) 정보
export interface HPPayInfo {
  CTRT_ID: string;           // 계약ID
  PROD_NM: string;           // 상품명
  HP_PAY_YN: string;         // 신청여부 (Y/N)
  INST_ADDR: string;         // 설치주소
  CTRT_STAT_NM: string;      // 계약상태
}

// 상담 등록 요청 (와이어프레임 기준: 대/중/소분류)
export interface ConsultationRequest {
  CUST_ID: string;           // 고객ID
  CTRT_ID?: string;          // 계약ID (선택)
  CNSL_L_CL_CD: string;      // 상담대분류코드
  CNSL_M_CL_CD: string;      // 상담중분류코드
  CNSL_CL_CD: string;        // 상담소분류코드 (최종코드)
  REQ_CNTN: string;          // 요청사항
  TRANS_YN: string;          // 전달처리여부 (Y/N)
  TRANS_DEPT_CD?: string;    // 전달지점코드
}

// AS 접수 요청 (와이어프레임 기준 확장)
export interface ASRequestParams {
  CUST_ID: string;           // 고객ID
  CTRT_ID: string;           // 계약ID (필수)
  INST_ADDR: string;         // 설치주소
  AS_CL_CD: string;          // AS구분코드
  AS_CL_DTL_CD?: string;     // 콤보상세코드
  TRIP_FEE_CD?: string;      // 출장비코드
  AS_RESN_L_CD: string;      // AS접수사유(대)
  AS_RESN_M_CD: string;      // AS접수사유(중)
  AS_CNTN: string;           // AS내용
  SCHD_DT: string;           // 작업예정일 (YYYYMMDD)
  SCHD_TM: string;           // 작업예정시간 (HHMM)
  WRKR_ID: string;           // 작업자ID (로그인 사용자)
}

// 전화번호 변경 요청
export interface PhoneChangeRequest {
  CUST_ID: string;           // 고객ID
  TEL_NO: string;            // 새 전화번호
  TEL_TP_CD: string;         // 통신사코드
  DISCONN_YN: string;        // 결번여부 (Y/N)
}

// 주소 변경 요청
export interface AddressChangeRequest {
  CUST_ID: string;           // 고객ID
  CTRT_ID?: string;          // 계약ID (선택)
  ADDR_TP: 'INST' | 'CUST' | 'BILL';  // 주소유형
  ZIP_CD: string;            // 우편번호
  ADDR1: string;             // 기본주소
  ADDR2: string;             // 상세주소
  // 복수 주소 동시 변경 옵션
  CHANGE_CUST_ADDR?: boolean;  // 고객주소도 변경
  CHANGE_BILL_ADDR?: boolean;  // 청구지주소도 변경
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

// 납부방법 변경 요청
export interface PaymentMethodChangeRequest {
  PYM_ACNT_ID: string;       // 납부계정ID
  PYM_MTH_CD: string;        // 납부방법코드
  BANK_CD?: string;          // 은행코드
  ACNT_NO?: string;          // 계좌번호
  CARD_NO?: string;          // 카드번호
  CARD_VALID?: string;       // 카드유효기간
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
    console.log(`[CustomerAPI] ${method} ${url}`, params);

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
    console.log(`[CustomerAPI] Response:`, result);

    // 레거시 API 응답 형식 처리
    if (result.resultCode === '0000' || result.success) {
      return {
        success: true,
        data: result.data || result.resultData || result,
        totalCount: result.totalCount || result.resultCount
      };
    }

    return {
      success: false,
      message: result.resultMsg || result.message || '요청 처리에 실패했습니다.',
      errorCode: result.resultCode || result.errorCode
    };
  } catch (error) {
    console.error(`[CustomerAPI] Error:`, error);
    return {
      success: false,
      message: error instanceof Error ? error.message : '네트워크 오류가 발생했습니다.'
    };
  }
};

// ============ 기본조회 API ============

/**
 * 고객 검색 (조건별)
 *
 * 성능 최적화 버전:
 * - CUST_ID 검색: getConditionalCustList2 (SERCH_GB 없이, 빠름)
 * - 전화번호/계약ID/장비번호: getCustInfo를 통해 고객 상세 조회
 *
 * 테스트용 고객 ID:
 * - 푸꾸옥: 1001857577 (TEL: 010-5134-6878)
 * - 하노이: 1001857578
 * - 가나다: 1001846265
 */
export const searchCustomer = async (params: CustomerSearchParams): Promise<ApiResponse<CustomerInfo[]>> => {
  // 고객ID 검색 - getConditionalCustList2 사용 (빠름)
  if (params.searchType === 'CUSTOMER_ID' && params.customerId) {
    const reqParams = { CUST_ID: params.customerId };
    const result = await apiCall<any>('/customer/common/customercommon/getConditionalCustList2', reqParams);

    if (result.success && result.data) {
      const dataArray = Array.isArray(result.data) ? result.data : [result.data];
      return { ...result, data: dataArray };
    }
    return { ...result, data: [] };
  }

  // 계약ID 검색 - getCustomerCtrtInfo로 CUST_ID 획득 후 조회
  if (params.searchType === 'CONTRACT_ID' && params.contractId) {
    // 1단계: 계약ID로 고객ID 조회
    const ctrtResult = await apiCall<any>('/customer/negociation/getCustomerCtrtInfo', { CTRT_ID: params.contractId });

    if (ctrtResult.success && ctrtResult.data) {
      const ctrtData = Array.isArray(ctrtResult.data) ? ctrtResult.data[0] : ctrtResult.data;
      const custId = ctrtData?.CUST_ID;

      if (custId) {
        // 2단계: 고객ID로 고객정보 조회
        const result = await apiCall<any>('/customer/common/customercommon/getConditionalCustList2', { CUST_ID: custId });
        if (result.success && result.data) {
          const dataArray = Array.isArray(result.data) ? result.data : [result.data];
          return { ...result, data: dataArray };
        }
      }
    }
    return { success: false, message: '계약ID로 고객을 찾을 수 없습니다.', data: [] };
  }

  // 전화번호/고객명 검색 - SERCH_GB=3 사용 (D'Live 서버 성능에 따라 Timeout 가능)
  if (params.searchType === 'PHONE_NAME') {
    if (!params.phoneNumber && !params.customerName) {
      return { success: false, message: '전화번호 또는 고객명을 입력해주세요.', data: [] };
    }

    const reqParams: Record<string, any> = {
      SERCH_GB: '3',
      LOGIN_ID: 'SYSTEM'
    };
    if (params.phoneNumber) reqParams.TEL_NO = params.phoneNumber;
    if (params.customerName) reqParams.CUST_NM = params.customerName;

    try {
      const result = await apiCall<any>('/customer/common/customercommon/getConditionalCustList2', reqParams);
      if (result.success && result.data) {
        const dataArray = Array.isArray(result.data) ? result.data : [result.data];
        return { ...result, data: dataArray };
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
      EQT_SERNO: params.equipmentNo,
      MAC_ADDR: ''
    };

    try {
      const result = await apiCall<any>('/customer/common/customercommon/getConditionalCustList2', reqParams);
      if (result.success && result.data) {
        const dataArray = Array.isArray(result.data) ? result.data : [result.data];
        return { ...result, data: dataArray };
      }
      return { ...result, data: [] };
    } catch (error) {
      return { success: false, message: '장비번호 검색 시간이 초과되었습니다. 고객ID로 검색해주세요.', data: [] };
    }
  }

  return { success: false, message: '검색 조건을 입력해주세요.', data: [] };
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
  return apiCall<ContractInfo[]>('/customer/negociation/getCustCtrtAll', { CUST_ID: custId });
};

/**
 * 계약 상세 검색
 * API: customer/negociation/getCustSearchCtrt.req
 */
export const searchContract = async (custId: string, searchParams?: Record<string, any>): Promise<ApiResponse<ContractInfo[]>> => {
  return apiCall<ContractInfo[]>('/customer/negociation/getCustSearchCtrt', {
    CUST_ID: custId,
    ...searchParams
  });
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
  return apiCall<BillingInfo[]>('/customer/negociation/getCustAccountInfo', {
    CUST_ID: custId,
    PYM_ACNT_ID: pymAcntId
  });
};

/**
 * 수납 내역 조회
 * API: customer/negociation/getCustDpstInfo.req
 */
export const getPaymentHistory = async (custId: string): Promise<ApiResponse<any[]>> => {
  return apiCall<any[]>('/customer/negociation/getCustDpstInfo', { CUST_ID: custId });
};

/**
 * 미납 내역 조회 (현재 기준)
 * API: billing/unpayment/upreport/getUnpaymentNowList.req
 */
export const getUnpaymentList = async (custId: string, pymAcntId?: string): Promise<ApiResponse<UnpaymentInfo[]>> => {
  return apiCall<UnpaymentInfo[]>('/billing/unpayment/upreport/getUnpaymentNowList', {
    CUST_ID: custId,
    PYM_ACNT_ID: pymAcntId
  });
};

/**
 * 미납 상세 내역 조회
 * API: billing/unpayment/upreport/getUnpaymentNowDtlList.req
 */
export const getUnpaymentDetail = async (custId: string, billYm: string): Promise<ApiResponse<any[]>> => {
  return apiCall<any[]>('/billing/unpayment/upreport/getUnpaymentNowDtlList', {
    CUST_ID: custId,
    BILL_YM: billYm
  });
};

/**
 * 납부 정보 조회
 */
export const getPaymentInfo = async (custId: string): Promise<ApiResponse<PaymentInfo[]>> => {
  return apiCall<PaymentInfo[]>('/customer/negociation/getCustPymInfo', { CUST_ID: custId });
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
 * API: customer/negociation/getCallHistory.req
 */
export const getConsultationHistory = async (
  custId: string,
  limit: number = 10
): Promise<ApiResponse<ConsultationHistory[]>> => {
  return apiCall<ConsultationHistory[]>('/customer/negociation/getCallHistory', {
    CUST_ID: custId,
    PAGE_SIZE: limit
  });
};

/**
 * 작업 이력 조회
 * API: customer/negociation/getCustWorkList.req
 */
export const getWorkHistory = async (
  custId: string,
  limit: number = 10
): Promise<ApiResponse<WorkHistory[]>> => {
  return apiCall<WorkHistory[]>('/customer/negociation/getCustWorkList', {
    CUST_ID: custId,
    PAGE_SIZE: limit
  });
};

// ============ 정보 변경 API ============

/**
 * 전화번호 변경
 * API: customer/negociation/updateCustTelDetailInfo.req
 */
export const updatePhoneNumber = async (params: PhoneChangeRequest): Promise<ApiResponse<any>> => {
  return apiCall<any>('/customer/negociation/updateCustTelDetailInfo', params);
};

/**
 * 주소 변경 (설치/고객/청구지)
 * API: customer/etc/saveMargeAddrOrdInfo.req
 */
export const updateAddress = async (params: AddressChangeRequest): Promise<ApiResponse<any>> => {
  const reqParams: Record<string, any> = {
    CUST_ID: params.CUST_ID,
    ZIP_CD: params.ZIP_CD,
    ADDR1: params.ADDR1,
    ADDR2: params.ADDR2,
  };

  // 주소 유형별 플래그 설정
  if (params.ADDR_TP === 'INST') {
    reqParams.INST_ADDR_CHG_YN = 'Y';
  }
  if (params.ADDR_TP === 'CUST' || params.CHANGE_CUST_ADDR) {
    reqParams.CUST_ADDR_CHG_YN = 'Y';
  }
  if (params.ADDR_TP === 'BILL' || params.CHANGE_BILL_ADDR) {
    reqParams.BILL_ADDR_CHG_YN = 'Y';
  }
  if (params.CTRT_ID) {
    reqParams.CTRT_ID = params.CTRT_ID;
  }

  return apiCall<any>('/customer/etc/saveMargeAddrOrdInfo', reqParams);
};

/**
 * 납부방법 변경
 * API: customer/customer/general/customerPymChgAddManager.req
 */
export const updatePaymentMethod = async (params: PaymentMethodChangeRequest): Promise<ApiResponse<any>> => {
  return apiCall<any>('/customer/customer/general/customerPymChgAddManager', params);
};

// ============ 상담/AS API ============

/**
 * 상담 이력 등록
 * API: customer/negociation/saveCnslRcptInfo.req
 */
export const registerConsultation = async (params: ConsultationRequest): Promise<ApiResponse<any>> => {
  return apiCall<any>('/customer/negociation/saveCnslRcptInfo', params);
};

/**
 * AS 접수
 * API: customer/work/modAsPdaReceipt.req
 */
export const registerASRequest = async (params: ASRequestParams): Promise<ApiResponse<any>> => {
  return apiCall<any>('/customer/work/modAsPdaReceipt', params);
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
 * 상담소분류 코드 조회
 */
export const getConsultationCodes = async (): Promise<ApiResponse<any[]>> => {
  return apiCall<any[]>('/common/getCommonCodes', { CODE_GROUP: 'CNSL_CL' });
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

// ============ 유틸리티 함수 ============

/**
 * 전화번호 포맷팅
 */
export const formatPhoneNumber = (phone: string): string => {
  if (!phone) return '';
  const cleaned = phone.replace(/\D/g, '');
  if (cleaned.length === 11) {
    return `${cleaned.slice(0, 3)}-${cleaned.slice(3, 7)}-${cleaned.slice(7)}`;
  }
  if (cleaned.length === 10) {
    return `${cleaned.slice(0, 3)}-${cleaned.slice(3, 6)}-${cleaned.slice(6)}`;
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
  getASReasonCodes,
  getCustomerTypeCodes,
  getTelecomCodes,
  getBankCodes,
  // 유틸
  formatPhoneNumber,
  formatCurrency,
  formatDate,
  maskString
};
