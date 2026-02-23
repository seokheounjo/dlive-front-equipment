/**
 * useCertifyComplete - 인증상품 작업완료 훅
 * Complete 컴포넌트들에서 추출
 *
 * CL-04 서비스 등록 / CL-08+CL-06 서비스 해지 / CERTIFY_TYPE 판별
 *
 * 패턴별 사용:
 * - 설치(01): executeCL04Registration (REASON='신규'|certifyReason)
 * - A/S(03): executeCL04Registration (REASON='AS')
 * - 상품변경(05): determineCertifyType → executeCL04 or CL-06
 * - 이전설치(07)/댁내이전(06): determineCertifyType → executeCL04
 * - 철거(02): executeCL08CL06Termination
 * - 이전철거(08): executeCL08CL06Termination (조건부 CL-06)
 */
import { WorkOrder } from '../types';
import { getCommonCodes } from '../services/apiService';
import {
  setCertifyCL04,
  setCertifyCL06,
  getCertifyCL08,
  getCertifyProdMap,
} from '../services/certifyApiService';
import { useCertifyStore } from '../stores/certifyStore';

interface CL04Params {
  order: WorkOrder;
  workerId: string;
  certifyRegconfInfo: any;
  addOnParam?: string;
  reason?: string;
  certifyType?: string;  // U/C
  contIdOld?: string;    // CONT_ID_OLD for type U
}

interface CL04Result {
  success: boolean;
  code: string;
  message: string;
}

interface CertifyTypeResult {
  certifyType: string;  // 'U' | 'C' | 'D' | ''
  bCl08: boolean;
  cl06Called?: boolean;
}

interface CL06TerminationResult {
  success: boolean;
  certifyTg: string;  // 'Y' | 'N'
  error?: string;
}

/**
 * CL-04 서비스 개통 등록 실행
 */
export const executeCL04Registration = async ({
  order,
  workerId,
  certifyRegconfInfo,
  addOnParam = '',
  reason = '신규',
  certifyType,
  contIdOld,
}: CL04Params): Promise<CL04Result> => {
  if (!certifyRegconfInfo) {
    return { success: false, code: 'NO_DATA', message: '집선정보가 없습니다.' };
  }

  try {
    const result = await setCertifyCL04({
      CONT_ID: order.CTRT_ID || '',
      CUST_ID: order.customer?.id || (order as any).CUST_ID || '',
      WRK_ID: order.id || '',
      SO_ID: order.SO_ID || '',
      REG_UID: workerId,
      CERTIFY_TYPE: certifyType,
      ADDR: (order as any).ADDR || order.customer?.address || '',
      BLD_NM: (order as any).BLD_NM || '',
      T: certifyRegconfInfo.T || '',
      ONT_MAC: certifyRegconfInfo.ONT_MAC || '',
      ONT_SERIAL: certifyRegconfInfo.ONT_SERIAL || '',
      AP_MAC: certifyRegconfInfo.AP_MAC || '',
      DEV_ID: certifyRegconfInfo.DEV_ID || '',
      IP: certifyRegconfInfo.IP || '',
      PORT: certifyRegconfInfo.PORT || '',
      MAX_SPEED: certifyRegconfInfo.MAX_SPEED || '',
      ST: certifyRegconfInfo.ST || '',
      // L2 equipment info (legacy: ds_lgu_regconfinfo)
      EQIP_ID: certifyRegconfInfo.EQIP_ID || '',
      EQIP_PORT_NO: certifyRegconfInfo.EQIP_PORT_NO || '',
      EQIP_DIVS: certifyRegconfInfo.EQIP_DIVS || '',
      SVC: order.PROD_CD || (order as any).PROD_CD || '',
      ADD_ON: addOnParam,
      REASON: reason,
      ...(contIdOld ? { CONT_ID_OLD: contIdOld } : {}),
    });

    console.log('[useCertifyComplete] CL-04 결과:', result);

    // 레거시 패턴: SUCCESS/OK만 성공 (CompleteInstall 등 7개 컴포넌트 공통)
    if (result.code !== 'SUCCESS' && result.code !== 'OK') {
      return { success: false, code: result.code, message: result.message };
    }

    return { success: true, code: result.code, message: result.message };
  } catch (error: any) {
    console.error('[useCertifyComplete] CL-04 실패:', error);
    return { success: false, code: 'ERROR', message: error.message || 'CL-04 호출 실패' };
  }
};

/**
 * CERTIFY_TYPE 판별 (이전설치/댁내이전/상품변경)
 *
 * CL-08로 기존 계약 인증 상태 확인 후:
 * - bCl08 && SO in CMIF006: 'U' (Update - 기존 인증 업데이트)
 * - !bCl08 && SO in CMIF006: 'C' (Create - 신규 인증)
 * - bCl08 && SO not in CMIF006: 'D' (Delete - 기존 인증 해지 필요)
 */
export const determineCertifyType = async (
  order: WorkOrder,
  workerId: string,
  oldCtrtId?: string,
): Promise<CertifyTypeResult> => {
  const ctrtId = oldCtrtId || order.CTRT_ID || '';
  const soId = order.SO_ID || '';
  let bCl08 = false;

  // CL-08: 기존 계약 인증 상태 확인
  try {
    const cl08Raw = await getCertifyCL08({
      CTRT_ID: ctrtId,
      CUST_ID: order.customer?.id || (order as any).CUST_ID || '',
      SO_ID: soId,
      REG_UID: workerId,
      WRK_ID: order.id || '',
    });

    const cl08Result = Array.isArray(cl08Raw) ? cl08Raw[0] : cl08Raw;
    if (cl08Result && !cl08Result.ERROR && cl08Result.CONT_ID === ctrtId) {
      bCl08 = true;
      console.log('[useCertifyComplete] CL-08 인증 확인됨');
    }
  } catch (e) {
    console.log('[useCertifyComplete] CL-08 조회 실패:', e);
  }

  // CMIF006 SO 목록 확인
  let isSoInCertifyList = false;
  try {
    const certifySoList = await getCommonCodes('CMIF006');
    const certifySoIds = certifySoList.map((item: any) => item.code || item.COMMON_CD);
    isSoInCertifyList = certifySoIds.includes(soId);
  } catch (e) {
    console.error('[useCertifyComplete] CMIF006 조회 실패:', e);
  }

  let certifyType = '';
  if (bCl08 && isSoInCertifyList) {
    certifyType = 'U';
  } else if (!bCl08 && isSoInCertifyList) {
    certifyType = 'C';
  } else if (bCl08 && !isSoInCertifyList) {
    certifyType = 'D'; // 해지 필요
  }

  console.log('[useCertifyComplete] CERTIFY_TYPE:', certifyType,
    '| bCl08:', bCl08, '| SO in CMIF006:', isSoInCertifyList);

  return { certifyType, bCl08 };
};

/**
 * CL-08 + CL-06 서비스 해지 실행 (철거/이전철거)
 *
 * 1. CL-08로 인증 상태 확인
 * 2. 인증 확인되면 CL-06 해지 호출
 */
export const executeCL08CL06Termination = async (
  order: WorkOrder,
  workerId: string,
): Promise<CL06TerminationResult> => {
  const ctrtId = order.CTRT_ID || '';
  let certifyTg = 'N';

  // CL-08: 인증 상태 확인
  try {
    const cl08Raw = await getCertifyCL08({
      CTRT_ID: ctrtId,
      CUST_ID: order.customer?.id || (order as any).CUST_ID || '',
      SO_ID: order.SO_ID || '',
      REG_UID: workerId,
      WRK_ID: order.id || '',
    });

    const cl08Result = Array.isArray(cl08Raw) ? cl08Raw[0] : cl08Raw;
    if (cl08Result && !cl08Result.ERROR && cl08Result.CONT_ID === ctrtId) {
      certifyTg = 'Y';
      console.log('[useCertifyComplete] CL-08 인증 확인, CERTIFY_TG=Y');
    }
  } catch (e) {
    console.log('[useCertifyComplete] CL-08 조회 실패:', e);
  }

  // CL-06: 서비스 해지
  if (certifyTg === 'Y') {
    try {
      const cl06Result = await setCertifyCL06({
        CTRT_ID: ctrtId,
        CUST_ID: order.customer?.id || (order as any).CUST_ID || '',
        WRK_ID: order.id || '',
        SO_ID: order.SO_ID || '',
        REG_UID: workerId,
      });

      if (cl06Result?.ERROR) {
        console.error('[useCertifyComplete] CL-06 실패:', cl06Result.ERROR);
        return { success: false, certifyTg, error: cl06Result.ERROR };
      }

      console.log('[useCertifyComplete] CL-06 해지 완료');
    } catch (error: any) {
      console.error('[useCertifyComplete] CL-06 호출 실패:', error);
      return { success: false, certifyTg, error: error.message };
    }
  }

  return { success: true, certifyTg };
};

/**
 * 상품변경 시 CL-06 해지 (이전 상품이 인증, 새 상품이 비인증인 경우)
 */
export const executeCL06ForChange = async (
  order: WorkOrder,
  workerId: string,
  oldCtrtId: string,
): Promise<{ success: boolean; error?: string }> => {
  try {
    const cl06Result = await setCertifyCL06({
      CTRT_ID: oldCtrtId,
      CUST_ID: order.customer?.id || (order as any).CUST_ID || '',
      WRK_ID: order.id || '',
      SO_ID: order.SO_ID || '',
      REG_UID: workerId,
    });

    if (cl06Result?.ERROR) {
      console.error('[useCertifyComplete] CL-06 (Change) 실패:', cl06Result.ERROR);
      return { success: false, error: cl06Result.ERROR };
    }

    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
};

/**
 * useCertifyComplete 훅 (컴포넌트에서 사용)
 */
export const useCertifyComplete = () => {
  const { certifyRegconfInfo } = useCertifyStore();

  return {
    certifyRegconfInfo,
    executeCL04Registration,
    determineCertifyType,
    executeCL08CL06Termination,
    executeCL06ForChange,
  };
};
