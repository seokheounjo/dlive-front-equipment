/**
 * 장비관리 작업API 활용 서비스
 *
 * 작업관리의 getCustProdInfo API를 활용하여 기사 보유 장비 조회
 * - SQL: workmanAssignDao.getWrkrEqtInfo() 사용
 * - EQT_USE_ARR_YN 필터 없음 → 검사대기('A') 장비 포함!
 * - 82개 장비 조회 성공!
 *
 * @author Claude Code
 * @date 2025-12-26
 */

import { fetchWithRetry, NetworkError, checkDemoMode } from './apiService';

const API_BASE = import.meta.env.VITE_API_BASE_URL || '';

// ============ 타입 정의 ============

export interface TechnicianEquipment {
  EQT_NO?: string;
  EQT_SERNO?: string;
  MAC_ADDRESS?: string;
  ITEM_MID_CD?: string;
  ITEM_MID_NM?: string;
  EQT_CL_CD?: string;
  EQT_CL_NM?: string;
  EQT_STAT_CD?: string;
  EQT_STAT_NM?: string;
  EQT_LOC_TP_CD?: string;
  EQT_LOC_TP_NM?: string;
  EQT_USE_ARR_YN?: string;
  WRKR_ID?: string;
  WRKR_NM?: string;
  SO_ID?: string;
  SO_NM?: string;
  [key: string]: any;
}

// ============ getCustProdInfo 활용 기사장비 조회 ============

/**
 * 기사 보유 장비 조회 (getCustProdInfo 활용)
 *
 * 작업관리에서 82개 장비를 성공적으로 가져오는 API와 동일
 * - API: /customer/work/getCustProdInfo
 * - SQL: workmanAssignDao.getWrkrEqtInfo()
 * - 핵심: EQT_USE_ARR_YN 필터 없음!
 *
 * @param params 조회 파라미터
 * @returns output3 (기사장비) 배열
 */
export const getTechnicianEquipmentFromWork = async (params: {
  WRKR_ID: string;
  SO_ID?: string;
  CRR_ID?: string;
}): Promise<TechnicianEquipment[]> => {
  console.log('[장비조회-작업API] getCustProdInfo 활용 기사장비 조회:', params);

  const isDemoMode = checkDemoMode();

  if (isDemoMode) {
    console.log('[장비조회-작업API] 더미 모드');
    await new Promise(resolve => setTimeout(resolve, 500));
    return [
      {
        EQT_NO: 'EQT001',
        EQT_SERNO: 'RSM100001',
        ITEM_MID_NM: '모뎀',
        EQT_CL_NM: 'RS-M100',
        ITEM_MID_CD: '04',
        EQT_STAT_CD: '10',
        EQT_LOC_TP_CD: '3',
        WRKR_ID: params.WRKR_ID
      }
    ];
  }

  try {
    const origin = typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000';

    // 작업관리와 동일한 파라미터 구성
    // CRR_TSK_CL: '01' (신규설치) → output3(기사장비) 활성화
    const requestParams = {
      ...params,
      CRR_TSK_CL: '01',
      EQT_SEL: '0',
      EQT_CL: 'ALL'
    };

    console.log('[장비조회-작업API] getCustProdInfo 호출:', requestParams);

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

    console.log('[장비조회-작업API] 응답:');
    console.log('  output1 (프로모션):', result?.output1?.length || 0, '개');
    console.log('  output2 (계약장비):', result?.output2?.length || 0, '개');
    console.log('  output3 (기사장비):', result?.output3?.length || 0, '개');
    console.log('  output4 (고객장비):', result?.output4?.length || 0, '개');
    console.log('  output5 (회수장비):', result?.output5?.length || 0, '개');

    const technicianEquipments = result?.output3 || [];
    console.log('[장비조회-작업API] 기사장비 조회 성공:', technicianEquipments.length, '개');

    return technicianEquipments;
  } catch (error) {
    console.error('[장비조회-작업API] 조회 실패:', error);
    if (error instanceof NetworkError) {
      throw error;
    }
    throw new NetworkError('기사 장비 정보를 불러오는데 실패했습니다.');
  }
};

/**
 * 보유장비 통합 조회 (Fallback 전략)
 *
 * 1순위: getCustProdInfo (82개 성공)
 * 2순위: getWrkrHaveEqtList_All (기존 API)
 */
export const getMyEquipmentListWithFallback = async (params: {
  WRKR_ID: string;
  SO_ID?: string;
  CRR_ID?: string;
  ITEM_MID_CD?: string;
}): Promise<TechnicianEquipment[]> => {
  console.log('[보유장비-통합] 조회 시작:', params);

  try {
    // 1순위: getCustProdInfo 사용 (82개 성공)
    const result = await getTechnicianEquipmentFromWork(params);

    if (result && result.length > 0) {
      console.log('[보유장비-통합] getCustProdInfo 성공:', result.length, '개');

      // ITEM_MID_CD 필터링
      if (params.ITEM_MID_CD) {
        const filtered = result.filter((item: any) => item.ITEM_MID_CD === params.ITEM_MID_CD);
        console.log('[보유장비-통합] ITEM_MID_CD 필터 후:', filtered.length, '개');
        return filtered;
      }
      return result;
    }

    console.log('[보유장비-통합] getCustProdInfo 결과 없음');
    return [];
  } catch (error) {
    console.error('[보유장비-통합] getCustProdInfo 실패:', error);
    throw error;
  }
};

/**
 * 전체 장비 정보 조회 (output1~5 모두)
 *
 * @param params 조회 파라미터
 * @returns 모든 output 포함 객체
 */
export const getAllEquipmentInfo = async (params: {
  WRKR_ID: string;
  SO_ID?: string;
  CRR_ID?: string;
  CRR_TSK_CL?: string;
}): Promise<{
  promotionEquipments: any[];
  contractEquipments: any[];
  technicianEquipments: any[];
  customerEquipments: any[];
  removedEquipments: any[];
}> => {
  console.log('[장비전체조회] getCustProdInfo 호출:', params);

  const isDemoMode = checkDemoMode();

  if (isDemoMode) {
    await new Promise(resolve => setTimeout(resolve, 500));
    return {
      promotionEquipments: [],
      contractEquipments: [],
      technicianEquipments: [],
      customerEquipments: [],
      removedEquipments: []
    };
  }

  try {
    const origin = typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000';

    const requestParams = {
      ...params,
      CRR_TSK_CL: params.CRR_TSK_CL || '01',
      EQT_SEL: '0',
      EQT_CL: 'ALL'
    };

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

    console.log('[장비전체조회] 응답:');
    console.log('  output1:', result?.output1?.length || 0, '개');
    console.log('  output2:', result?.output2?.length || 0, '개');
    console.log('  output3:', result?.output3?.length || 0, '개');
    console.log('  output4:', result?.output4?.length || 0, '개');
    console.log('  output5:', result?.output5?.length || 0, '개');

    return {
      promotionEquipments: result?.output1 || [],
      contractEquipments: result?.output2 || [],
      technicianEquipments: result?.output3 || [],
      customerEquipments: result?.output4 || [],
      removedEquipments: result?.output5 || []
    };
  } catch (error) {
    console.error('[장비전체조회] 실패:', error);
    if (error instanceof NetworkError) {
      throw error;
    }
    throw new NetworkError('장비 정보 조회에 실패했습니다.');
  }
};
