/**
 * 장비관리 전용 API 서비스
 * - 순수 장비관리 기능 (작업과 독립)
 * - 기사 재고 관리
 * - 장비 배정/이관/회수
 * - 신호 체크
 */

import { checkDemoMode, fetchWithRetry, NetworkError } from './apiService';

const API_BASE = import.meta.env.VITE_API_BASE_URL || '';

// ============ 타입 정의 ============

export interface Equipment {
  EQT_NO?: string;          // 장비번호
  EQT_SERNO?: string;       // 시리얼번호
  ITEM_MID_CD?: string;     // 품목 중분류 (04:모뎀, 05:셋톱박스, 07:특수장비, 03:추가장비)
  ITEM_MID_NM?: string;     // 품목명
  EQT_CL_CD?: string;       // 장비 클래스 코드 (모델 코드)
  EQT_CL_NM?: string;       // 장비 클래스명 (모델명)
  MAC_ADDRESS?: string;     // MAC 주소
  EQT_STAT_CD?: string;     // 장비 상태 코드
  EQT_LOC_TP_CD?: string;   // 장비 위치 타입
  WRKR_ID?: string;         // 기사 ID
  SO_ID?: string;           // 지점 ID
  [key: string]: any;
}

export interface SignalCheckParams {
  serialNo: string;         // 시리얼번호
  equipmentType: string;    // 장비 유형 (modem/stb)
  macAddress?: string;      // MAC 주소
  workId?: string;          // 작업 ID (선택)
}

export interface SignalCheckResult {
  status: 'success' | 'fail' | 'warning';
  message: string;
  timestamp: string;
  internetSignal?: {
    download: number;
    upload: number;
    ping: number;
  };
  tvSignal?: {
    channels: number;
    quality: number;
    errors: number;
  };
  deviceStatus?: {
    macAddress: string;
    connection: string;
    ipAddress: string;
  };
  signalStrength?: number;
  issues?: string[];
}

// ============ 기사 재고 관리 API ============

/**
 * 기사 보유 장비 조회 (순수 재고 조회)
 * 작업 컨텍스트 없이 기사 ID만으로 재고 조회
 */
export const getTechnicianInventory = async (params: {
  WRKR_ID: string;          // 기사 ID
  SO_ID?: string;           // 지점 ID (선택)
  ITEM_MID_CD?: string;     // 장비 분류 필터 (선택)
}): Promise<Equipment[]> => {
  console.log('[장비재고 API] 기사 재고 조회:', params);

  const isDemoMode = checkDemoMode();

  if (isDemoMode) {
    console.log('[장비재고 API] 더미 모드: 재고 데이터 반환');
    await new Promise(resolve => setTimeout(resolve, 500));
    return [
      {
        EQT_NO: 'EQT001',
        ITEM_MID_NM: '모뎀',
        EQT_CL_NM: 'RS-M100',
        EQT_SERNO: 'RSM100001',
        ITEM_MID_CD: '04',
        MAC_ADDRESS: 'AA:BB:CC:DD:EE:01',
        EQT_STAT_CD: '10',
        WRKR_ID: params.WRKR_ID,
        SO_ID: params.SO_ID
      },
      {
        EQT_NO: 'EQT002',
        ITEM_MID_NM: '셋톱박스',
        EQT_CL_NM: 'DTV-STB100',
        EQT_SERNO: 'DTV100001',
        ITEM_MID_CD: '05',
        EQT_STAT_CD: '10',
        WRKR_ID: params.WRKR_ID,
        SO_ID: params.SO_ID
      }
    ];
  }

  try {
    const origin = typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000';

    // 순수 재고 조회용 파라미터
    const requestParams = {
      WRKR_ID: params.WRKR_ID,
      SO_ID: params.SO_ID,
      EQT_SEL: '0',
      EQT_CL: 'ALL',
      // 작업 관련 파라미터는 제외
    };

    const response = await fetchWithRetry(`${API_BASE}/customer/equipment/getTechnicianInventory`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Origin': origin
      },
      credentials: 'include',
      body: JSON.stringify(requestParams),
    });

    const result = await response.json();
    console.log('[장비재고 API] 재고 조회 성공:', result?.length || 0, '개');

    // 필터링 (ITEM_MID_CD)
    if (params.ITEM_MID_CD && Array.isArray(result)) {
      return result.filter(item => item.ITEM_MID_CD === params.ITEM_MID_CD);
    }

    return result || [];
  } catch (error) {
    console.error('[장비재고 API] 재고 조회 실패:', error);
    if (error instanceof NetworkError) {
      throw error;
    }
    throw new NetworkError('장비 재고를 불러오는데 실패했습니다.');
  }
};

/**
 * 장비 상태 조회
 */
export const getEquipmentStatus = async (serialNo: string): Promise<Equipment | null> => {
  console.log('[장비상태 API] 장비 상태 조회:', serialNo);

  const isDemoMode = checkDemoMode();

  if (isDemoMode) {
    await new Promise(resolve => setTimeout(resolve, 300));
    return {
      EQT_NO: 'EQT001',
      EQT_SERNO: serialNo,
      ITEM_MID_NM: '모뎀',
      EQT_CL_NM: 'RS-M100',
      EQT_STAT_CD: '10',
      EQT_STAT_NM: '정상'
    };
  }

  try {
    const origin = typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000';

    const response = await fetchWithRetry(`${API_BASE}/customer/equipment/getStatus`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Origin': origin
      },
      credentials: 'include',
      body: JSON.stringify({ EQT_SERNO: serialNo }),
    });

    const result = await response.json();
    console.log('[장비상태 API] 상태 조회 성공:', result);
    return result;
  } catch (error) {
    console.error('[장비상태 API] 상태 조회 실패:', error);
    if (error instanceof NetworkError) {
      throw error;
    }
    throw new NetworkError('장비 상태를 불러오는데 실패했습니다.');
  }
};

// ============ 장비 이동 관리 API ============

/**
 * 장비 이관 (기사 → 기사)
 */
export const transferEquipment = async (params: {
  equipmentList: Equipment[];
  fromWrkrId: string;
  toWrkrId: string;
  transferReason?: string;
}): Promise<{ code: string; message: string }> => {
  console.log('[장비이관 API] 장비 이관 요청:', params);

  const isDemoMode = checkDemoMode();

  if (isDemoMode) {
    await new Promise(resolve => setTimeout(resolve, 1000));
    return { code: 'SUCCESS', message: '장비 이관이 완료되었습니다 (더미)' };
  }

  try {
    const origin = typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000';

    const response = await fetchWithRetry(`${API_BASE}/customer/equipment/changeEqtWrkr_3`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Origin': origin
      },
      credentials: 'include',
      body: JSON.stringify(params),
    });

    const result = await response.json();
    console.log('[장비이관 API] 이관 성공:', result);
    return result;
  } catch (error) {
    console.error('[장비이관 API] 이관 실패:', error);
    if (error instanceof NetworkError) {
      throw error;
    }
    throw new NetworkError('장비 이관에 실패했습니다.');
  }
};

/**
 * 장비 회수 요청 목록 조회
 */
export const getEquipmentReturnRequests = async (params: {
  WRKR_ID: string;
  SO_ID?: string;
  START_DT?: string;
  END_DT?: string;
}): Promise<any[]> => {
  console.log('[장비회수 API] 회수 요청 목록 조회:', params);

  const isDemoMode = checkDemoMode();

  if (isDemoMode) {
    await new Promise(resolve => setTimeout(resolve, 500));
    return [];
  }

  try {
    const origin = typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000';

    const response = await fetchWithRetry(`${API_BASE}/customer/equipment/getEquipmentReturnRequestList`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Origin': origin
      },
      credentials: 'include',
      body: JSON.stringify(params),
    });

    const result = await response.json();
    console.log('[장비회수 API] 회수 목록 조회 성공:', result?.length || 0, '개');
    return result || [];
  } catch (error) {
    console.error('[장비회수 API] 회수 목록 조회 실패:', error);
    if (error instanceof NetworkError) {
      throw error;
    }
    throw new NetworkError('회수 요청 목록을 불러오는데 실패했습니다.');
  }
};

/**
 * 장비 회수 등록
 */
export const registerEquipmentReturn = async (params: {
  WRKR_ID: string;
  equipmentList: any[];
  returnReason?: string;
}): Promise<{ code: string; message: string }> => {
  console.log('[장비회수 API] 장비 회수 등록:', params);

  const isDemoMode = checkDemoMode();

  if (isDemoMode) {
    await new Promise(resolve => setTimeout(resolve, 1000));
    return { code: 'SUCCESS', message: '장비 회수가 등록되었습니다 (더미)' };
  }

  try {
    const origin = typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000';

    const response = await fetchWithRetry(`${API_BASE}/customer/equipment/addEquipmentReturnRequest`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Origin': origin
      },
      credentials: 'include',
      body: JSON.stringify(params),
    });

    const result = await response.json();
    console.log('[장비회수 API] 회수 등록 성공:', result);
    return result;
  } catch (error) {
    console.error('[장비회수 API] 회수 등록 실패:', error);
    if (error instanceof NetworkError) {
      throw error;
    }
    throw new NetworkError('장비 회수 등록에 실패했습니다.');
  }
};

// ============ 신호 체크 API ============

/**
 * 신호 체크 (모뎀/셋톱박스)
 */
export const checkSignal = async (params: SignalCheckParams): Promise<SignalCheckResult> => {
  console.log('[신호체크 API] 신호 점검 시작:', params);

  const isDemoMode = checkDemoMode();

  if (isDemoMode) {
    console.log('[신호체크 API] 더미 모드: 신호 점검 시뮬레이션');
    await new Promise(resolve => setTimeout(resolve, 2000));

    const mockResult: SignalCheckResult = {
      status: Math.random() > 0.2 ? 'success' : 'warning',
      message: Math.random() > 0.2 ? '신호 상태가 양호합니다.' : '신호 품질이 낮습니다.',
      timestamp: new Date().toISOString(),
    };

    if (params.equipmentType === 'modem') {
      mockResult.internetSignal = {
        download: Math.floor(Math.random() * 200) + 100,
        upload: Math.floor(Math.random() * 50) + 20,
        ping: Math.floor(Math.random() * 20) + 5,
      };
      mockResult.deviceStatus = {
        macAddress: params.macAddress || 'AA:BB:CC:DD:EE:FF',
        connection: 'connected',
        ipAddress: `192.168.1.${Math.floor(Math.random() * 200) + 10}`,
      };
    } else {
      mockResult.tvSignal = {
        channels: Math.floor(Math.random() * 50) + 100,
        quality: Math.floor(Math.random() * 20) + 80,
        errors: Math.floor(Math.random() * 5),
      };
    }

    return mockResult;
  }

  try {
    const origin = typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000';

    const response = await fetchWithRetry(`${API_BASE}/customer/work/signalCheck`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Origin': origin
      },
      credentials: 'include',
      body: JSON.stringify(params),
    });

    const result = await response.json();
    console.log('[신호체크 API] 신호 점검 성공:', result);
    return result;
  } catch (error) {
    console.error('[신호체크 API] 신호 점검 실패:', error);
    if (error instanceof NetworkError) {
      throw error;
    }
    throw new NetworkError('신호 점검에 실패했습니다.');
  }
};

/**
 * 신호 이력 조회
 */
export const getSignalHistory = async (params: {
  serialNo: string;
  startDate?: string;
  endDate?: string;
}): Promise<any[]> => {
  console.log('[신호이력 API] 신호 이력 조회:', params);

  const isDemoMode = checkDemoMode();

  if (isDemoMode) {
    await new Promise(resolve => setTimeout(resolve, 500));
    return [];
  }

  try {
    const origin = typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000';

    const queryParams = new URLSearchParams({
      serialNo: params.serialNo,
      ...(params.startDate && { startDate: params.startDate }),
      ...(params.endDate && { endDate: params.endDate }),
    });

    const response = await fetchWithRetry(`${API_BASE}/signal/ens-history?${queryParams.toString()}`, {
      method: 'GET',
      headers: {
        'Origin': origin
      },
      credentials: 'include',
    });

    const result = await response.json();
    console.log('[신호이력 API] 이력 조회 성공:', result?.length || 0, '개');
    return result || [];
  } catch (error) {
    console.error('[신호이력 API] 이력 조회 실패:', error);
    if (error instanceof NetworkError) {
      throw error;
    }
    throw new NetworkError('신호 이력을 불러오는데 실패했습니다.');
  }
};

// ============ 장비 출고/쿼터 관리 API ============

/**
 * 장비 출고 목록 조회
 */
export const getEquipmentOutList = async (params: {
  WRKR_ID: string;
  SO_ID?: string;
  START_DT?: string;
  END_DT?: string;
}): Promise<any[]> => {
  console.log('[장비출고 API] 출고 목록 조회:', params);

  const isDemoMode = checkDemoMode();

  if (isDemoMode) {
    await new Promise(resolve => setTimeout(resolve, 500));
    return [];
  }

  try {
    const origin = typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000';

    const response = await fetchWithRetry(`${API_BASE}/customer/equipment/getEquipmentOutList`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Origin': origin
      },
      credentials: 'include',
      body: JSON.stringify(params),
    });

    const result = await response.json();
    console.log('[장비출고 API] 출고 목록 조회 성공:', result?.length || 0, '개');
    return result || [];
  } catch (error) {
    console.error('[장비출고 API] 출고 목록 조회 실패:', error);
    if (error instanceof NetworkError) {
      throw error;
    }
    throw new NetworkError('출고 목록을 불러오는데 실패했습니다.');
  }
};

/**
 * 장비 처리 여부 확인
 */
export const checkEquipmentProc = async (params: {
  EQT_SERNO: string;
}): Promise<{ canProcess: boolean; reason?: string }> => {
  console.log('[장비처리 API] 처리 가능 여부 확인:', params);

  const isDemoMode = checkDemoMode();

  if (isDemoMode) {
    await new Promise(resolve => setTimeout(resolve, 300));
    return { canProcess: true };
  }

  try {
    const origin = typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000';

    const response = await fetchWithRetry(`${API_BASE}/customer/equipment/getEquipmentProcYnCheck`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Origin': origin
      },
      credentials: 'include',
      body: JSON.stringify(params),
    });

    const result = await response.json();
    console.log('[장비처리 API] 확인 성공:', result);
    return result;
  } catch (error) {
    console.error('[장비처리 API] 확인 실패:', error);
    if (error instanceof NetworkError) {
      throw error;
    }
    throw new NetworkError('장비 처리 여부 확인에 실패했습니다.');
  }
};

/**
 * 법인 장비 쿼터 추가
 */
export const addEquipmentQuota = async (params: {
  CORP_ID: string;
  equipmentList: any[];
}): Promise<{ code: string; message: string }> => {
  console.log('[장비쿼터 API] 쿼터 추가:', params);

  const isDemoMode = checkDemoMode();

  if (isDemoMode) {
    await new Promise(resolve => setTimeout(resolve, 1000));
    return { code: 'SUCCESS', message: '쿼터가 추가되었습니다 (더미)' };
  }

  try {
    const origin = typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000';

    const response = await fetchWithRetry(`${API_BASE}/customer/equipment/addCorporationEquipmentQuota`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Origin': origin
      },
      credentials: 'include',
      body: JSON.stringify(params),
    });

    const result = await response.json();
    console.log('[장비쿼터 API] 쿼터 추가 성공:', result);
    return result;
  } catch (error) {
    console.error('[장비쿼터 API] 쿼터 추가 실패:', error);
    if (error instanceof NetworkError) {
      throw error;
    }
    throw new NetworkError('장비 쿼터 추가에 실패했습니다.');
  }
};
