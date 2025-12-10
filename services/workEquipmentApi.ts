/**
 * 작업 프로세스용 장비 API 서비스
 * - 작업 컨텍스트가 필요한 장비 관련 API
 * - 작업 3단계(장비정보)에서 사용
 * - 작업 완료 시 장비 정보 저장
 */

import { checkDemoMode, fetchWithRetry, NetworkError } from './apiService';

const API_BASE = import.meta.env.VITE_API_BASE_URL || '';

// ============ 타입 정의 ============

export interface EquipmentQueryResponse {
  contractEquipments: any[];      // output2: 계약 장비 (설치해야 할 장비)
  technicianEquipments: any[];    // output3: 기사 재고 장비
  customerEquipments: any[];      // output4: 고객 설치 장비
  removedEquipments: any[];       // output5: 회수 장비
  // output1: 프로모션/제품 정보 (설치정보 모달 필터링용)
  kpiProdGrpCd?: string;          // KPI 제품 그룹 코드 (V, I, C 등)
  prodChgGb?: string;             // 제품 변경 구분 (01=업그레이드, 02=다운그레이드)
  chgKpiProdGrpCd?: string;       // 변경 후 KPI 제품 그룹 코드
  prodGrp?: string;               // 제품 그룹 (V, I, C)
}

export interface STBServerConnectionResult {
  isConnected: boolean;
  message: string;
  serverStatus?: string;
  timestamp: string;
}

// ============ 작업용 장비 조회 API ============

/**
 * 작업에 필요한 장비 정보 조회 (작업 프로세스 3단계용)
 * - 계약 장비 (설치해야 할 장비)
 * - 기사 재고 장비 (설치 가능한 장비)
 * - 고객 설치 장비 (이미 설치된 장비)
 * - 회수 장비 (회수해야 할 장비)
 */
export const getEquipmentForWork = async (params: {
  WRKR_ID: string;          // 기사 ID
  SO_ID?: string;           // 지점 ID
  WORK_ID?: string;         // 작업 ID
  PROD_CD?: string;         // 상품 코드
  CUST_ID?: string;         // 고객 ID
  CRR_TSK_CL?: string;      // 작업 유형 코드 (01:신규설치, 05:이전설치, 07:상품변경, 09:AS 등)
  WRK_DTL_TCD?: string;     // 작업 상세 타입 코드
  CTRT_ID?: string;         // 계약 ID
  RCPT_ID?: string;         // 접수 ID
  CRR_ID?: string;          // 권역/통신사 ID
  ADDR_ORD?: string;        // 주소 순번
  WRK_CD?: string;          // 작업 코드
  WRK_STAT_CD?: string;     // 작업 상태 코드
  WRK_DRCTN_ID?: string;    // 작업지시 ID
  BLD_ID?: string;          // 건물 ID
}): Promise<EquipmentQueryResponse> => {
  console.log('[작업장비 API] 작업용 장비 조회:', params);

  const isDemoMode = checkDemoMode();

  if (isDemoMode) {
    console.log('[작업장비 API] 더미 모드: 장비 데이터 반환');
    await new Promise(resolve => setTimeout(resolve, 500));
    return {
      contractEquipments: [
        {
          SVC_CMPS_ID: 'SVC001',
          ITEM_MID_NM: '모뎀',
          EQT_CL_NM: 'RS-M100',
          ITEM_MID_CD: '04',
        },
        {
          SVC_CMPS_ID: 'SVC002',
          ITEM_MID_NM: '셋톱박스',
          EQT_CL_NM: 'DTV-STB100',
          ITEM_MID_CD: '05',
        }
      ],
      technicianEquipments: [
        {
          EQT_NO: 'EQT001',
          ITEM_MID_NM: '모뎀',
          EQT_CL_NM: 'RS-M100',
          EQT_SERNO: 'RSM100001',
          ITEM_MID_CD: '04',
          MAC_ADDRESS: 'AA:BB:CC:DD:EE:01'
        },
        {
          EQT_NO: 'EQT002',
          ITEM_MID_NM: '셋톱박스',
          EQT_CL_NM: 'DTV-STB100',
          EQT_SERNO: 'DTV100001',
          ITEM_MID_CD: '05',
        }
      ],
      customerEquipments: [],
      removedEquipments: []
    };
  }

  try {
    const origin = typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000';

    const requestParams = {
      ...params,
      EQT_SEL: '0',
      EQT_CL: 'ALL'
    };

    console.log('[작업장비 API] API 호출:', `${API_BASE}/customer/work/getCustProdInfo`);

    const response = await fetchWithRetry(`${API_BASE}/customer/work/getCustProdInfo`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Origin': origin
      },
      credentials: 'include',
      body: JSON.stringify(requestParams),
    });

    const result = await response.json();

    console.log('[작업장비 API] 응답 데이터:');
    console.log('  ├─ 계약장비:', result?.output2?.length || 0, '개');
    console.log('  ├─ 기사장비:', result?.output3?.length || 0, '개');
    console.log('  ├─ 고객장비:', result?.output4?.length || 0, '개');
    console.log('  └─ 회수장비:', result?.output5?.length || 0, '개');

    const promotionInfo = result?.output1?.[0] || {};

    return {
      contractEquipments: result?.output2 || [],
      technicianEquipments: result?.output3 || [],
      customerEquipments: result?.output4 || [],
      removedEquipments: result?.output5 || [],
      kpiProdGrpCd: promotionInfo.KPI_PROD_GRP_CD,
      prodChgGb: promotionInfo.PROD_CHG_GB,
      chgKpiProdGrpCd: promotionInfo.CHG_KPI_PROD_GRP_CD,
      prodGrp: promotionInfo.PROD_GRP,
    };
  } catch (error) {
    console.error('[작업장비 API] 장비 조회 실패:', error);
    if (error instanceof NetworkError) {
      throw error;
    }
    throw new NetworkError('작업 장비 정보를 불러오는데 실패했습니다.');
  }
};

// ============ 작업 완료용 장비 저장 API ============

/**
 * 장비 구성 정보 변경 (작업 완료 시)
 */
export const updateEquipmentComposition = async (data: {
  WRK_ID: string;
  equipments: any[];
  RCPT_ID?: string;
  CTRT_ID?: string;
  PROM_CNT?: string;
  CUST_ID?: string;
}): Promise<{ code: string; message: string }> => {
  console.log('[장비구성변경 API] 장비 구성 변경:', data);

  const isDemoMode = checkDemoMode();

  if (isDemoMode) {
    await new Promise(resolve => setTimeout(resolve, 1000));
    return { code: 'SUCCESS', message: '장비 구성이 변경되었습니다 (더미)' };
  }

  try {
    const origin = typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000';

    // 선택된 장비만 필터링
    const selectedOrdered = (data.equipments || [])
      .filter(item => item.SELECTED === 'Y' || item.selected === true)
      .sort((a, b) => {
        const orderA = parseInt(a.displayOrder || a.DISPLAY_ORDER || '999', 10);
        const orderB = parseInt(b.displayOrder || b.DISPLAY_ORDER || '999', 10);
        return orderA - orderB;
      });

    console.log('[장비구성변경 API] 선택된 장비:', selectedOrdered.length, '개');

    const requestData = {
      WRK_ID: data.WRK_ID,
      RCPT_ID: data.RCPT_ID,
      CTRT_ID: data.CTRT_ID,
      PROM_CNT: data.PROM_CNT,
      CUST_ID: data.CUST_ID,
      parameters: selectedOrdered.map((eq, index) => ({
        ...eq,
        displayOrder: (index + 1).toString(),
        DISPLAY_ORDER: (index + 1).toString(),
      }))
    };

    const response = await fetchWithRetry(`${API_BASE}/customer/work/eqtCmpsInfoChg`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Origin': origin
      },
      credentials: 'include',
      body: JSON.stringify(requestData),
    });

    const result = await response.json();
    console.log('[장비구성변경 API] 변경 성공:', result);

    return {
      code: 'SUCCESS',
      message: '장비 구성이 변경되었습니다.'
    };
  } catch (error) {
    console.error('[장비구성변경 API] 변경 실패:', error);
    if (error instanceof NetworkError) {
      throw error;
    }
    throw new NetworkError('장비 구성 변경에 실패했습니다.');
  }
};

/**
 * 작업 완료 시 설치 정보 저장
 */
export const saveInstallInfo = async (data: {
  WRK_ID: string;
  installData: any;
}): Promise<{ code: string; message: string }> => {
  console.log('[설치정보 API] 설치 정보 저장:', data);

  const isDemoMode = checkDemoMode();

  if (isDemoMode) {
    await new Promise(resolve => setTimeout(resolve, 1000));
    return { code: 'SUCCESS', message: '설치 정보가 저장되었습니다 (더미)' };
  }

  try {
    const origin = typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000';

    const response = await fetchWithRetry(`${API_BASE}/customer/work/saveInstallInfo`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Origin': origin
      },
      credentials: 'include',
      body: JSON.stringify(data),
    });

    const result = await response.json();
    console.log('[설치정보 API] 저장 성공:', result);
    return result;
  } catch (error) {
    console.error('[설치정보 API] 저장 실패:', error);
    if (error instanceof NetworkError) {
      throw error;
    }
    throw new NetworkError('설치 정보 저장에 실패했습니다.');
  }
};

// ============ 장비 모델 관련 API ============

/**
 * 상품별 장비 모델 조회
 */
export const getEquipmentModelsForProduct = async (
  prodCd: string,
  itemMidCd?: string
): Promise<any[]> => {
  console.log('[장비모델 API] 상품별 장비 모델 조회:', { prodCd, itemMidCd });

  const isDemoMode = checkDemoMode();

  if (isDemoMode) {
    await new Promise(resolve => setTimeout(resolve, 500));
    return [];
  }

  try {
    const origin = typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000';

    const response = await fetchWithRetry(`${API_BASE}/customer/receipt/contract/getEquipmentNmListOfProd`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Origin': origin
      },
      credentials: 'include',
      body: JSON.stringify({
        PROD_CD: prodCd,
        ...(itemMidCd && { ITEM_MID_CD: itemMidCd })
      }),
    });

    const result = await response.json();
    console.log('[장비모델 API] 모델 조회 성공:', result?.length || 0, '개');
    return result || [];
  } catch (error) {
    console.error('[장비모델 API] 모델 조회 실패:', error);
    if (error instanceof NetworkError) {
      throw error;
    }
    throw new NetworkError('장비 모델 정보를 불러오는데 실패했습니다.');
  }
};

/**
 * 계약 장비 리스트 조회
 */
export const getContractEquipmentList = async (
  ctrtId: string,
  prodCd: string
): Promise<any[]> => {
  console.log('[계약장비 API] 계약 장비 리스트 조회:', { ctrtId, prodCd });

  const isDemoMode = checkDemoMode();

  if (isDemoMode) {
    await new Promise(resolve => setTimeout(resolve, 500));
    return [];
  }

  try {
    const origin = typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000';

    const response = await fetchWithRetry(`${API_BASE}/customer/receipt/contract/getContractEqtList`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Origin': origin
      },
      credentials: 'include',
      body: JSON.stringify({
        CTRT_ID: ctrtId,
        PROD_CD: prodCd
      }),
    });

    const result = await response.json();
    console.log('[계약장비 API] 리스트 조회 성공:', result?.length || 0, '개');
    return result || [];
  } catch (error) {
    console.error('[계약장비 API] 리스트 조회 실패:', error);
    if (error instanceof NetworkError) {
      throw error;
    }
    throw new NetworkError('계약 장비 리스트를 불러오는데 실패했습니다.');
  }
};

/**
 * 장비 모델 변경
 */
export const changeEquipmentModel = async (
  equipments: Array<{
    SVC_CMPS_ID: string;
    ITEM_MID_CD: string;
    EQT_CL_CD: string;
  }>
): Promise<{ code: string; message: string }> => {
  console.log('[장비모델변경 API] 모델 변경:', equipments);

  const isDemoMode = checkDemoMode();

  if (isDemoMode) {
    await new Promise(resolve => setTimeout(resolve, 1000));
    return { code: 'SUCCESS', message: '장비 모델이 변경되었습니다 (더미)' };
  }

  try {
    const origin = typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000';

    const response = await fetchWithRetry(`${API_BASE}/customer/receipt/contract/changeEqtMdl`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Origin': origin
      },
      credentials: 'include',
      body: JSON.stringify({ equipments }),
    });

    const result = await response.json();
    console.log('[장비모델변경 API] 변경 성공:', result);
    return result;
  } catch (error) {
    console.error('[장비모델변경 API] 변경 실패:', error);
    if (error instanceof NetworkError) {
      throw error;
    }
    throw new NetworkError('장비 모델 변경에 실패했습니다.');
  }
};

// ============ STB 서버 연결 체크 API ============

/**
 * STB 서버 연결 체크
 */
export const checkStbServerConnection = async (
  stbSerialNo: string
): Promise<STBServerConnectionResult> => {
  console.log('[STB연결 API] 서버 연결 체크:', stbSerialNo);

  const isDemoMode = checkDemoMode();

  if (isDemoMode) {
    await new Promise(resolve => setTimeout(resolve, 2000));
    return {
      isConnected: Math.random() > 0.3,
      message: Math.random() > 0.3 ? 'STB 서버에 정상 연결되었습니다.' : 'STB 서버 연결 실패',
      serverStatus: Math.random() > 0.3 ? 'ONLINE' : 'OFFLINE',
      timestamp: new Date().toISOString()
    };
  }

  try {
    const origin = typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000';

    const response = await fetchWithRetry(`${API_BASE}/customer/work/checkStbServerConnection`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Origin': origin
      },
      credentials: 'include',
      body: JSON.stringify({ STB_SERNO: stbSerialNo }),
    });

    const result = await response.json();
    console.log('[STB연결 API] 연결 체크 성공:', result);
    return result;
  } catch (error) {
    console.error('[STB연결 API] 연결 체크 실패:', error);
    if (error instanceof NetworkError) {
      throw error;
    }
    throw new NetworkError('STB 서버 연결 체크에 실패했습니다.');
  }
};
