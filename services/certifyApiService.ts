/**
 * LGU+/FTTH Certify API Service
 * apiService.ts에서 분리된 LGU+ 인증상품 전용 API
 *
 * - CL-02: 포트현황조회
 * - CL-03: 집선정보조회
 * - CL-04: 서비스 개통 등록
 * - CL-06: 단말인증 해지
 * - CL-08: 단말상태 조회
 * - LDAP: 청약 조회
 * - 청약정보(getUplsCtrtInfo), L2 배선(getUplsNwcs), 가입장비(getUplsEntrEqipDtl)
 * - 인증 대상 상품 맵(getCertifyProdMap)
 * - 인증 API 이력(getCertifyApiHist)
 * - LGU 공사요청/망장애 처리
 */

import { API_BASE, checkDemoMode } from './apiService';

// ============ Interfaces ============

export interface UplsCtrtInfo {
  CTRT_ID?: string;
  CUST_ID?: string;
  ENTR_NO?: string;
  PROD_CD?: string;
  PROD_NM?: string;
  STAT_CD?: string;
  [key: string]: any;
}

export interface UplsNwcsInfo {
  MDL_NM?: string;        // Model name (EQIP_MDL_NM)
  EQIP_ID?: string;       // Equipment ID
  PRT_INDX_NM?: string;   // Port index name (-> EQIP_PORT)
  ESTB_PLC_NM?: string;   // Building/establishment name
  RESULT_CD?: string;     // Result code (Y=success, N=fail)
  RESULT_MSG?: string;    // Result message
  [key: string]: any;
}

export interface CertifyResult {
  ERROR?: string;
  MSG?: string;
  RESULT?: string;
  [key: string]: any;
}

export interface CertifyInfo {
  T?: string;           // 장비유형 (L2-IP-PORT, ONT 등)
  ONT_MAC?: string;     // ONT MAC 주소
  ONT_SERIAL?: string;  // ONT 시리얼
  AP_MAC?: string;      // AP MAC 주소
  DEV_ID?: string;      // 장치 ID
  IP?: string;          // 장치 IP 주소
  PORT?: string;        // 포트번호
  MAX_SPEED?: string;   // 최고속도
  SPEED?: string;       // 속도
  ST?: string;          // 상태값
  ADDR?: string;        // 위치
  LAST_FOUND?: string;  // 감지시간
  CONT_ID?: string;     // 집선관리아이디
  RESULT_CODE?: string; // 결과코드
  RESULT_MSG?: string;  // 결과메시지
  ERROR?: string;       // 에러 메시지
  [key: string]: any;
}

export interface LGUConstructionRequest {
  WRK_ID: string;
  CUST_ID: string;
  CTRT_ID: string;
  CRR_ID: string;
  SO_ID: string;
  WRKR_ID: string;
  PROD_CD: string;
  REG_UID: string;
}

export interface LGUNetworkFault {
  CTRT_ID: string;
  CUST_ID: string;
  WRK_ID: string;
  CRR_ID: string;
  SO_ID: string;
  REG_UID: string;
  CANCEL_TYPE?: string;
  MRKT_CD?: string;
  OPERATOR_ID?: string;
}

export interface UplsEntrBgnEstbChgRequest {
  WRK_ID: string;
  CTRT_ID: string;
  MRKT_CD: string;
  OPERATOR_ID: string;
  REG_UID: string;
  RQST_DV_CD?: string;  // mowou03m06 (relocate) only
}

export interface UplsEntrBgnEstbChgResponse {
  RESULT_CD: string;     // Y=success, N=failure
  RESULT_MSG: string;
  ENTR_NO?: string;
  ENTR_RQST_NO?: string;
  ENTR_CNTRT_NO?: string;
  SVC_CD?: string;
  UPLS_PROD_YN?: string;
  RQST_DV_CD?: string;
  NET_TYP?: string;
  [key: string]: any;
}

export interface ReqUplsHspdLdapRequest {
  WRK_ID?: string;
  CUST_ID?: string;
  CTRT_ID: string;
  CRR_ID?: string;
  SO_ID?: string;
  WRKR_ID?: string;
  PROD_CD?: string;
  REG_UID: string;
  MSG_ID?: string;        // SMR05
  EVNT_CD?: string;       // AP/ONT event code
  AP_MAC?: string;
  AP_EQT_NO?: string;
  ONT_MAC?: string;
  ONT_EQT_NO?: string;
  JOB_TYPE?: string;
  JOB_TYPE_CONF?: string;
  ENTR_NO?: string;
  ENTR_RQST_NO?: string;
}

export interface CertifyApiHistory {
  SEQ_API: string;
  CMD: string;
  MSG_TP_DESC: string;
  REQ_DATE: string;
  RESULT: string;
  RES_DATE: string;
  MAC_ADDR: string;
  SO_NM: string;
  CUST_NM: string;
  CTRT_ID: string;
  CUST_ID: string;
  SO_ID: string;
  REG_UID: string;
}

// ============ 청약/L2/가입장비 조회 ============

/**
 * LGU+ Contract Info (getUplsCtrtInfo)
 * Legacy: /customer/etc/getUplsCtrtInfo.req
 */
export const getUplsCtrtInfo = async (params: {
  CTRT_ID?: string;
  CUST_ID?: string;
  ENTR_NO?: string;
}): Promise<UplsCtrtInfo[] | null> => {
  console.log('[LGU API] getUplsCtrtInfo params:', params);

  try {
    const response = await fetch(`${API_BASE}/customer/etc/getUplsCtrtInfo`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(params),
    });

    if (!response.ok) {
      console.error('[LGU API] getUplsCtrtInfo HTTP error:', response.status);
      return null;
    }

    const result = await response.json();
    console.log('[LGU API] getUplsCtrtInfo response:', result);

    if (Array.isArray(result)) {
      return result;
    }
    if (result.data && Array.isArray(result.data)) {
      return result.data;
    }
    return result ? [result] : null;
  } catch (error) {
    console.error('[LGU API] getUplsCtrtInfo error:', error);
    return null;
  }
};

/**
 * L2 Network Wiring Status (auto equipment info query)
 * Legacy: /customer/etc/getUplsNwcs.req
 * Returns: MDL_NM, EQIP_ID, PRT_INDX_NM, ESTB_PLC_NM, RESULT_CD, RESULT_MSG
 */
export const getUplsNwcs = async (params: {
  ENTR_NO: string;
  CTRT_ID: string;
}): Promise<UplsNwcsInfo | null> => {
  console.log('[L2 API] getUplsNwcs params:', params);

  try {
    const response = await fetch(`${API_BASE}/customer/etc/getUplsNwcs`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(params),
    });

    if (!response.ok) {
      console.error('[L2 API] getUplsNwcs HTTP error:', response.status);
      return null;
    }

    const result = await response.json();
    console.log('[L2 API] getUplsNwcs response:', result);

    // Result can be a list or single object
    if (Array.isArray(result) && result.length > 0) {
      return result[0];
    }
    if (result && typeof result === 'object') {
      return result;
    }
    return null;
  } catch (error) {
    console.error('[L2 API] getUplsNwcs error:', error);
    return null;
  }
};

/**
 * L2 Enterprise Equipment Detail Query
 * Legacy: /customer/etc/getUplsEntrEqipDtl.req
 */
export const getUplsEntrEqipDtl = async (params: {
  ENTR_NO: string;
  ENTR_RQST_NO?: string;
  BIZ_TYPE?: string;
  CTRT_ID: string;
}): Promise<any> => {
  console.log('[L2 API] getUplsEntrEqipDtl params:', params);

  try {
    const response = await fetch(`${API_BASE}/customer/etc/getUplsEntrEqipDtl`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(params),
    });

    if (!response.ok) {
      console.error('[L2 API] getUplsEntrEqipDtl HTTP error:', response.status);
      return null;
    }

    const result = await response.json();
    console.log('[L2 API] getUplsEntrEqipDtl response:', result);
    return result;
  } catch (error) {
    console.error('[L2 API] getUplsEntrEqipDtl error:', error);
    return null;
  }
};

// ============ CL-02 ~ CL-08 단말인증 API ============

/**
 * 포트현황조회 (CL-02)
 * Legacy: /customer/etc/getCertifyCL02.req (mowoc01m02.xml)
 * OLT/RN 장비 포트 현황을 주소 기반으로 조회
 */
export const getCertifyCL02 = async (params: {
  ZIP_CDCODE?: string;
  ADDR?: string;
  APT_NAME?: string;
  BLD_ID?: string;
  CONT_ID: string;
  CUST_ID: string;
  WRK_ID: string;
  SO_ID: string;
  REG_UID: string;
}): Promise<any[]> => {
  console.log('[Certify API] getCertifyCL02 params:', params);

  try {
    const response = await fetch(`${API_BASE}/customer/etc/getCertifyCL02`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({
        CMD: 'CL-02',
        ...params,
      }),
    });

    const result = await response.json().catch(() => null);

    if (!response.ok) {
      const errMsg = result?.message || result?.RESULT_MSG || `포트현황조회 서버 오류 (${response.status})`;
      console.error('[Certify API] getCertifyCL02 error:', errMsg, result);
      throw new Error(errMsg);
    }

    console.log('[Certify API] getCertifyCL02 response:', result);

    return result?.output || result?.data || [];
  } catch (error) {
    console.error('[Certify API] getCertifyCL02 error:', error);
    return [];
  }
};

/**
 * 집선정보 조회 (CL-03)
 * Legacy: /customer/etc/getCertifyCL03.req
 * FTTH 상품 작업 시 집선정보를 조회
 */
export const getCertifyCL03 = async (params: {
  ONT_MAC?: string;
  ONT_SERIAL?: string;
  AP_MAC?: string;
  CONT_ID: string;
  CUST_ID: string;
  WRK_ID: string;
  SO_ID: string;
  REG_UID: string;
}): Promise<CertifyInfo | null> => {
  console.log('[집선등록 API] getCertifyCL03 params:', params);

  // 더미 모드 체크
  if (checkDemoMode()) {
    await new Promise(resolve => setTimeout(resolve, 500));
    return {
      T: 'ONT',
      ONT_MAC: params.ONT_MAC || 'AA:BB:CC:DD:EE:FF',
      DEV_ID: 'DEV001',
      IP: '192.168.1.100',
      PORT: '8080',
      MAX_SPEED: '1000',
      ST: 'ACTIVE',
      RESULT_CODE: 'SUCCESS',
      RESULT_MSG: '조회 성공',
    };
  }

  try {
    const response = await fetch(`${API_BASE}/customer/etc/getCertifyCL03`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({
        CMD: 'CL-03',
        ...params,
      }),
    });

    if (!response.ok) {
      console.error('[집선등록 API] getCertifyCL03 HTTP error:', response.status);
      return null;
    }

    const result = await response.json();
    console.log('[집선등록 API] getCertifyCL03 response:', result);

    if (result.data) {
      return result.data;
    }
    return result;
  } catch (error) {
    console.error('[집선등록 API] getCertifyCL03 error:', error);
    return null;
  }
};

/**
 * 서비스 개통 등록 (CL-04)
 * Legacy: /customer/etc/getCertifyCL04.req
 * FTTH 작업완료 시 서비스 개통 등록
 */
export const setCertifyCL04 = async (params: {
  CONT_ID: string;
  CUST_ID: string;
  WRK_ID: string;
  SO_ID: string;
  REG_UID: string;
  CERTIFY_TYPE?: string;
  // L2 equipment info (from CL-03 or manual)
  EQIP_ID?: string;
  EQIP_PORT_NO?: string;
  EQIP_MDL_NM?: string;
  EQIP_DIVS?: string;
  BLD_NM?: string;
  // Certify info from ds_certify_regconfinfo
  T?: string;
  ONT_MAC?: string;
  ONT_SERIAL?: string;
  AP_MAC?: string;
  DEV_ID?: string;
  IP?: string;
  PORT?: string;
  MAX_SPEED?: string;
  ST?: string;
  // Product info (legacy: SVC, ADD_ON, REASON)
  SVC?: string;
  ADD_ON?: string;
  REASON?: string;
  CONT_ID_OLD?: string;
}): Promise<{ code: string; message: string }> => {
  console.log('[집선등록 API] setCertifyCL04 params:', params);

  // 더미 모드 체크
  if (checkDemoMode()) {
    await new Promise(resolve => setTimeout(resolve, 500));
    return {
      code: 'SUCCESS',
      message: '서비스 개통 등록 완료',
    };
  }

  try {
    const response = await fetch(`${API_BASE}/customer/etc/setCertifyCL04`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({
        CMD: 'CL-04',
        ...params,
      }),
    });

    if (!response.ok) {
      console.error('[집선등록 API] setCertifyCL04 HTTP error:', response.status);
      return { code: 'ERROR', message: `HTTP error: ${response.status}` };
    }

    const result = await response.json();
    console.log('[집선등록 API] setCertifyCL04 response:', result);

    return {
      code: result.code || result.RESULT_CODE || 'SUCCESS',
      message: result.message || result.RESULT_MSG || '서비스 개통 등록 완료',
    };
  } catch (error) {
    console.error('[집선등록 API] setCertifyCL04 error:', error);
    return { code: 'ERROR', message: String(error) };
  }
};

/**
 * Terminal Authentication CL-06 (setCertifyCL06)
 * Legacy: /customer/etc/setCertifyCL06.req
 * Sends CL-06 command for terminal certification
 */
export const setCertifyCL06 = async (params: {
  CTRT_ID: string;
  CUST_ID: string;
  SO_ID: string;
  REG_UID: string;
  WRK_ID?: string;
}): Promise<CertifyResult | null> => {
  console.log('[Certify API] setCertifyCL06 params:', params);

  try {
    const response = await fetch(`${API_BASE}/customer/etc/setCertifyCL06`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({
        ...params,
        CONT_ID: params.CTRT_ID, // Legacy uses CONT_ID
      }),
    });

    if (!response.ok) {
      console.error('[Certify API] setCertifyCL06 HTTP error:', response.status);
      return { ERROR: `HTTP ${response.status}` };
    }

    const result = await response.json();
    console.log('[Certify API] setCertifyCL06 response:', result);

    if (result.data) {
      return result.data;
    }
    return result;
  } catch (error) {
    console.error('[Certify API] setCertifyCL06 error:', error);
    return { ERROR: String(error) };
  }
};

/**
 * Terminal Status Query CL-08 (getCertifyCL08)
 * Legacy: /customer/etc/getCertifyCL08.req
 * Queries current certification status
 */
export const getCertifyCL08 = async (params: {
  CTRT_ID: string;
  CUST_ID: string;
  SO_ID: string;
  REG_UID: string;
  WRK_ID?: string;
}): Promise<CertifyResult | null> => {
  console.log('[Certify API] getCertifyCL08 params:', params);

  try {
    const response = await fetch(`${API_BASE}/customer/etc/getCertifyCL08`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({
        ...params,
        CONT_ID: params.CTRT_ID, // Legacy uses CONT_ID
      }),
    });

    if (!response.ok) {
      console.error('[Certify API] getCertifyCL08 HTTP error:', response.status);
      return { ERROR: `HTTP ${response.status}` };
    }

    const result = await response.json();
    console.log('[Certify API] getCertifyCL08 response:', result);

    if (result.data) {
      return result.data;
    }
    return result;
  } catch (error) {
    console.error('[Certify API] getCertifyCL08 error:', error);
    return { ERROR: String(error) };
  }
};

// ============ 인증 대상 상품 / LDAP ============

/**
 * FTTH 단말인증 대상 상품 목록 조회
 * Legacy: /customer/work/getCertifyProdMap.req
 * TP_PROD_ATTR 테이블에서 AT10000005='FL' 속성을 가진 상품 목록 반환
 */
export const getCertifyProdMap = async (): Promise<string[]> => {
  console.log('[FTTH API] getCertifyProdMap 호출');

  // 더미 모드 체크
  if (checkDemoMode()) {
    await new Promise(resolve => setTimeout(resolve, 300));
    // 더미 데이터 - 실제로는 DB에서 조회
    return ['PD10007399', 'PD10007400'];
  }

  try {
    const origin = typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000';

    const response = await fetch(`${API_BASE}/customer/work/getCertifyProdMap`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Origin': origin
      },
      credentials: 'include',
      body: JSON.stringify({}),
    });

    if (!response.ok) {
      console.error('[FTTH API] getCertifyProdMap HTTP error:', response.status);
      return [];
    }

    const result = await response.json();
    console.log('[FTTH API] getCertifyProdMap response:', result);

    // output이 중첩된 경우 처리 (Legacy 서버 응답: {output: {output: [...]}})
    const outputData = result.output?.output || result.output;

    if (outputData && Array.isArray(outputData)) {
      const prodCodes = outputData.map((item: any) => item.PROD_CD).filter(Boolean);
      console.log('[FTTH API] FTTH 대상 상품 목록:', prodCodes.length, '개');
      return prodCodes;
    }

    // 직접 배열인 경우
    if (Array.isArray(result)) {
      const prodCodes = result.map((item: any) => item.PROD_CD).filter(Boolean);
      console.log('[FTTH API] FTTH 대상 상품 목록:', prodCodes.length, '개');
      return prodCodes;
    }

    return [];
  } catch (error) {
    console.error('[FTTH API] getCertifyProdMap error:', error);
    return [];
  }
};

/**
 * LDAP 청약 조회 (LGU+ ISP 구독 확인)
 * Legacy: /customer/etc/getUplsLdapRslt.req (mowou03m01.xml)
 * 결과가 없으면 신규 가입 (REASON="신규"), 있으면 기존 수정 (REASON="변경")
 */
export const getUplsLdapRslt = async (ctrtId: string): Promise<{ exists: boolean; data: any[] }> => {
  console.log('[Certify API] getUplsLdapRslt CTRT_ID:', ctrtId);

  try {
    const response = await fetch(`${API_BASE}/customer/etc/getUplsLdapRslt`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ CTRT_ID: ctrtId }),
    });

    if (!response.ok) {
      console.error('[Certify API] getUplsLdapRslt HTTP error:', response.status);
      return { exists: false, data: [] };
    }

    const result = await response.json();
    console.log('[Certify API] getUplsLdapRslt response:', result);

    const output = result.output || result.data || [];
    const rowcount = result.rowcount || output.length || 0;

    return {
      exists: rowcount > 0,
      data: Array.isArray(output) ? output : [],
    };
  } catch (error) {
    console.error('[Certify API] getUplsLdapRslt error:', error);
    return { exists: false, data: [] };
  }
};

// ============ 인증 API 이력 ============

/**
 * FTTH/전용선 인증 API 이력 조회
 * Legacy: moifc01m01.xml
 */
export const getCertifyApiHist = async (params: {
  CTRT_ID?: string;
  CUST_ID?: string;
  SEQ_API?: string;
  MSG_ID?: string;
  SO_ID?: string;
  STRT_DTTM1?: string;
  STRT_DTTM2?: string;
}): Promise<CertifyApiHistory[]> => {
  try {
    const response = await fetch(`${API_BASE}/customer/etc/getCertifyApiHist`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(params),
    });
    if (!response.ok) return [];
    const result = await response.json();
    return result.output || [];
  } catch (error) {
    console.error('[Signal API] getCertifyApiHist error:', error);
    return [];
  }
};

// ============ LGU 공사요청/망장애 ============

/**
 * LGU 공사요청진행정보 (LDAP 요청)
 */
export const requestLGUConstruction = async (data: LGUConstructionRequest): Promise<any> => {
  // 더미 모드 체크
  if (checkDemoMode()) {
    await new Promise(resolve => setTimeout(resolve, 1500));
    return [{
      code: 'SUCCESS',
      message: 'LGU 공사요청이 완료되었습니다 (더미)',
      REQUEST_ID: 'LGU' + Date.now(),
      STATUS: '접수완료'
    }];
  }

  try {
    const origin = typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000';
    const response = await fetch(`${API_BASE}/lgu/construction-request`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Origin': origin
      },
      credentials: 'include',
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      throw new Error(`LGU 공사요청 실패: ${response.status}`);
    }

    const result = await response.json();
    return result;
  } catch (error) {
    console.error('LGU 공사요청 실패:', error);
    throw error;
  }
};

/**
 * LGU 공사요청 목록 조회
 */
export const getLGUConstructionList = async (params: any): Promise<any[]> => {
  // 더미 모드 체크
  if (checkDemoMode()) {
    await new Promise(resolve => setTimeout(resolve, 1000));

    // 더미 데이터
    return [
      {
        CONSREQNO: '20240101001',
        CTRT_ID: 'CTRT001',
        CONSCHRRNM: '김철수',
        CONSCHRRTLNO: '010-1234-5678',
        CONSCHRRMAKRMKS: 'LGU+ 인터넷 회선 공사요청',
        CONSFNSHSCDLDT: '20240115',
        CONSFNSHDT: '20240114',
        CONSNEEDDIVSNM: '신규설치',
        CONSDLYRSNNM: '',
        CONSIPSBPRSSDT: '',
        CONSIPSBRSNNM: '',
        CONSNREQPRSSDT: '',
        CONSNREQRSNNM: '',
        ENTR_NO: '500030621784',
        ENTR_RQST_NO: '300241327941',
        MSTR_FL: 'Y',
        SBGNEGNRNM: 'LGU+'
      },
      {
        CONSREQNO: '20240102002',
        CTRT_ID: 'CTRT002',
        CONSCHRRNM: '이영희',
        CONSCHRRTLNO: '010-2345-6789',
        CONSCHRRMAKRMKS: '속도 업그레이드 요청',
        CONSFNSHSCDLDT: '20240120',
        CONSFNSHDT: '',
        CONSNEEDDIVSNM: '회선변경',
        CONSDLYRSNNM: '장비 부족',
        CONSIPSBPRSSDT: '',
        CONSIPSBRSNNM: '',
        CONSNREQPRSSDT: '',
        CONSNREQRSNNM: '',
        ENTR_NO: '500030621785',
        ENTR_RQST_NO: '300241327942',
        MSTR_FL: 'Y',
        SBGNEGNRNM: 'LGU+'
      }
    ];
  }

  try {
    const origin = typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000';
    const response = await fetch(`${API_BASE}/customer/etc/getUplsRqstConsList`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Origin': origin
      },
      credentials: 'include',
      body: JSON.stringify(params),
    });

    if (!response.ok) {
      throw new Error(`LGU 공사요청 목록 조회 실패: ${response.status}`);
    }

    const result = await response.json();
    return result;
  } catch (error) {
    console.error('LGU 공사요청 목록 조회 실패:', error);
    throw error;
  }
};

/**
 * LGU+ Subscription Registration (uplsEntrBgnEstbChg)
 * Legacy: /customer/receipt/uplsEntrBgnEstbChg.req
 * Service: receiptContract.uplsEntrBgnEstbChg
 * Called from: btn_LGU_Cust_Req_OnClick (mowou03m01, mowou03m05, mowou03m06)
 */
export const uplsEntrBgnEstbChg = async (params: UplsEntrBgnEstbChgRequest): Promise<UplsEntrBgnEstbChgResponse> => {
  console.log('[LGU API] uplsEntrBgnEstbChg params:', params);

  try {
    const response = await fetch(`${API_BASE}/customer/receipt/uplsEntrBgnEstbChg`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(params),
    });

    if (!response.ok) {
      console.error('[LGU API] uplsEntrBgnEstbChg HTTP error:', response.status);
      return { RESULT_CD: 'N', RESULT_MSG: `HTTP error: ${response.status}` };
    }

    const result = await response.json();
    console.log('[LGU API] uplsEntrBgnEstbChg response:', result);

    return {
      RESULT_CD: result.RESULT_CD || 'N',
      RESULT_MSG: result.RESULT_MSG || '',
      ENTR_NO: result.ENTR_NO || '',
      ENTR_RQST_NO: result.ENTR_RQST_NO || '',
      ENTR_CNTRT_NO: result.ENTR_CNTRT_NO || '',
      SVC_CD: result.SVC_CD || '',
      UPLS_PROD_YN: result.UPLS_PROD_YN || '',
      RQST_DV_CD: result.RQST_DV_CD || '',
      NET_TYP: result.NET_TYP || '',
    };
  } catch (error) {
    console.error('[LGU API] uplsEntrBgnEstbChg error:', error);
    return { RESULT_CD: 'N', RESULT_MSG: String(error) };
  }
};

/**
 * LGU+ LDAP Signal Request (reqUplsHspdLdap)
 * Legacy: /customer/etc/reqUplsHspdLdap.req
 * Service: etcManagement.reqUplsHspdLdap
 * Uses same backend endpoint as requestLGUConstruction (/lgu/construction-request)
 * but with extended parameters for subscription + LDAP integration
 */
export const reqUplsHspdLdap = async (params: ReqUplsHspdLdapRequest): Promise<any> => {
  console.log('[LGU API] reqUplsHspdLdap params:', params);

  try {
    const response = await fetch(`${API_BASE}/lgu/construction-request`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(params),
    });

    if (!response.ok) {
      console.error('[LGU API] reqUplsHspdLdap HTTP error:', response.status);
      throw new Error(`LDAP request failed: ${response.status}`);
    }

    const result = await response.json();
    console.log('[LGU API] reqUplsHspdLdap response:', result);
    return result;
  } catch (error) {
    console.error('[LGU API] reqUplsHspdLdap error:', error);
    throw error;
  }
};

// ============ 집선등록 관련 API (레거시: mowouDivF01/G01) ============

/**
 * LGU+ 집선정보 등록 (setUplsWorkComplete)
 * Legacy: /customer/etc/setUplsWorkComplete.req
 * 작업완료 시 포트 등록 처리 (CL-04와 별도)
 * 16개 파라미터 전부 전송 필수
 */
export const setUplsWorkComplete = async (params: {
  OPLN_KD_CD: string;    // 광종구분 (N/NG/F/FG/Z/ZG)
  ENTR_NO: string;       // 가입자번호
  ENTR_RQST_NO: string;  // 가입요청번호
  BIZ_TYPE: string;      // 업무유형 (01=설치, 02=A/S)
  OLT_ID: string;        // OLT 장비ID (광랜은 빈값)
  OLT_PORT: string;      // OLT 포트 (광랜은 빈값)
  EQIP_ID: string;       // 장비번호 (L2 or RN)
  EQIP_PORT_NO: string;  // 장비 포트번호
  SYS_DIVS: string;      // 시스템구분 (마켓코드)
  PRSS_KD: string;       // 처리종류 (부가서비스)
  CUST_DIVS: string;     // 고객구분 (HS)
  EQIP_DIVS: string;     // 장비구분 (L2 or OLT)
  DVIC_DIVS: string;     // 단말기구분 (X or T)
  USR_ID: string;        // 사용자ID
  DEL_YN: string;        // 삭제여부 (N)
  CTRT_ID: string;       // 계약ID
}): Promise<{ success: boolean; RESULT_CD: string; RESULT_MSG: string }> => {
  console.log('[LGU API] setUplsWorkComplete params:', params);

  try {
    const response = await fetch(`${API_BASE}/customer/etc/setUplsWorkComplete`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(params),
    });

    if (!response.ok) {
      return { success: false, RESULT_CD: 'N', RESULT_MSG: `HTTP error: ${response.status}` };
    }

    const result = await response.json();
    console.log('[LGU API] setUplsWorkComplete response:', result);

    const resultCd = result.RESULT_CD || '';
    if (resultCd.startsWith('N')) {
      return { success: false, RESULT_CD: resultCd, RESULT_MSG: result.RESULT_MSG || '' };
    }

    return { success: true, RESULT_CD: resultCd, RESULT_MSG: result.RESULT_MSG || '' };
  } catch (error) {
    console.error('[LGU API] setUplsWorkComplete error:', error);
    return { success: false, RESULT_CD: 'N', RESULT_MSG: String(error) };
  }
};

/**
 * LGU+ 중복가입자 조회 (getUplsDuplicationMember)
 * Legacy: /customer/etc/getUplsDuplicationMember.req
 * 광랜(N/NG) 전용 - 포트에 다른 가입자가 있는지 확인
 * PORT_NM: "/" -> "__" 치환 필수 (레거시 동일)
 */
export const getUplsDuplicationMember = async (params: {
  ENTR_NO: string;
  EQIP_ID: string;
  PORT_NM: string;   // EQIP_PORT_NO에서 "/" -> "__" 치환된 값
  CTRT_ID: string;
}): Promise<{ success: boolean; ENTR_EXIST: string; RESULT_CD: string; RESULT_MSG: string }> => {
  console.log('[LGU API] getUplsDuplicationMember params:', params);

  try {
    const response = await fetch(`${API_BASE}/customer/etc/getUplsDuplicationMember`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(params),
    });

    if (!response.ok) {
      return { success: false, ENTR_EXIST: 'N', RESULT_CD: 'N', RESULT_MSG: `HTTP error: ${response.status}` };
    }

    const result = await response.json();
    console.log('[LGU API] getUplsDuplicationMember response:', result);

    const data = Array.isArray(result) ? result[0] : result;
    const resultCd = data?.RESULT_CD || '';
    if (resultCd.startsWith('N')) {
      return { success: false, ENTR_EXIST: 'N', RESULT_CD: resultCd, RESULT_MSG: data?.RESULT_MSG || '' };
    }

    return {
      success: true,
      ENTR_EXIST: data?.ENTR_EXIST || 'N',
      RESULT_CD: resultCd,
      RESULT_MSG: data?.RESULT_MSG || '',
    };
  } catch (error) {
    console.error('[LGU API] getUplsDuplicationMember error:', error);
    return { success: false, ENTR_EXIST: 'N', RESULT_CD: 'N', RESULT_MSG: String(error) };
  }
};

/**
 * LGU+ 장비목록 조회 (getUplsEqipInfo)
 * Legacy: /customer/etc/getUplsEqipInfo.req
 * FTTH: COMMAND=ftthEqipList (RN 목록)
 * 광랜: COMMAND=opticEqipList (L2 목록)
 */
export const getUplsEqipInfo = async (params: {
  COMMAND: string;      // ftthEqipList / opticEqipList / vdslEqipList
  ENTR_NO: string;
  ENTR_RQST_NO: string; // A/S일 때 "null"
  BIZ_TYPE: string;
  CTRT_ID: string;
}): Promise<any[]> => {
  console.log('[LGU API] getUplsEqipInfo params:', params);

  try {
    const response = await fetch(`${API_BASE}/customer/etc/getUplsEqipInfo`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(params),
    });

    if (!response.ok) return [];

    const result = await response.json();
    console.log('[LGU API] getUplsEqipInfo response:', result);

    if (Array.isArray(result)) return result;
    if (result.output && Array.isArray(result.output)) return result.output;
    return result ? [result] : [];
  } catch (error) {
    console.error('[LGU API] getUplsEqipInfo error:', error);
    return [];
  }
};

/**
 * LGU+ 장비포트 목록 조회 (getUplsEqipPortInfo)
 * Legacy: /customer/etc/getUplsEqipPortInfo.req
 * FTTH: COMMAND=ftthEqipPortList (RN 포트)
 * 광랜: COMMAND=opticEqipPortList (L2 포트)
 */
export const getUplsEqipPortInfo = async (params: {
  COMMAND: string;      // ftthEqipPortList / opticEqipPortList
  EQIP_ID: string;
  CTRT_ID: string;
}): Promise<any[]> => {
  console.log('[LGU API] getUplsEqipPortInfo params:', params);

  try {
    const response = await fetch(`${API_BASE}/customer/etc/getUplsEqipPortInfo`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(params),
    });

    if (!response.ok) return [];

    const result = await response.json();
    console.log('[LGU API] getUplsEqipPortInfo response:', result);

    if (Array.isArray(result)) return result;
    if (result.output && Array.isArray(result.output)) return result.output;
    return result ? [result] : [];
  } catch (error) {
    console.error('[LGU API] getUplsEqipPortInfo error:', error);
    return [];
  }
};

/**
 * LGU+ Port공사요청 등록/수정/삭제
 * Legacy: /customer/etc/setUplsRqstConsReq.req
 * Used by: mowou04p01 (등록), mowou04p02 (수정), mowou04p03 (삭제)
 */
export const setUplsRqstConsReq = async (params: {
  ENTR_RQST_NO: string;
  CONS_REQ_RSN_CD: string;
  HSVC_INCR_RSN_CNTN: string;
  HSVC_CONS_RQMN_DIVS_CD: string;
  SBGN_DEAL_NM: string;
  SBGN_DEAL_TLNO: string;
  SBGN_EGNR_NM: string;
  SBGN_EGNR_HPHN_TLNO: string;
  CTRT_ID: string;
  RCPT_ID: string;
  WRK_ID: string;
  ENTR_NO: string;
}): Promise<{ RESULT_CD: string; RESULT_MSG: string; CONS_REQ_NO?: string }> => {
  console.log('[LGU API] setUplsRqstConsReq params:', params);

  try {
    const response = await fetch(`${API_BASE}/customer/etc/setUplsRqstConsReq`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(params),
    });

    if (!response.ok) {
      throw new Error(`Port공사요청 실패: ${response.status}`);
    }

    const result = await response.json();
    console.log('[LGU API] setUplsRqstConsReq response:', result);
    return result;
  } catch (error) {
    console.error('[LGU API] setUplsRqstConsReq error:', error);
    throw error;
  }
};

/**
 * LGU 망장애이관리스트 (엔트 처리 취소)
 */
export const requestLGUNetworkFault = async (data: LGUNetworkFault): Promise<any> => {
  // 더미 모드 체크
  if (checkDemoMode()) {
    await new Promise(resolve => setTimeout(resolve, 1500));
    return [{
      code: 'SUCCESS',
      message: 'LGU 망장애 처리가 완료되었습니다 (더미)',
      CANCEL_ID: 'FAULT' + Date.now(),
      STATUS: '취소완료'
    }];
  }

  try {
    const origin = typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000';
    const response = await fetch(`${API_BASE}/lgu/network-fault`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Origin': origin
      },
      credentials: 'include',
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      throw new Error(`LGU 망장애 처리 실패: ${response.status}`);
    }

    const result = await response.json();
    return result;
  } catch (error) {
    console.error('LGU 망장애 처리 실패:', error);
    throw error;
  }
};
