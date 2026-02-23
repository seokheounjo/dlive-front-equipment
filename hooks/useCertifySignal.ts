/**
 * useCertifySignal - 인증상품 신호 차단 확인 훅
 * Complete 컴포넌트들에서 추출
 *
 * LGU+ 인증상품(IS_CERTIFY_PROD==1)이면서 인증 대상 SO에 속하면
 * SMR03/SMR05 등 신호 전송을 차단
 *
 * Legacy: IS_CERTIFY_PROD + CMIF006 SO list 체크
 */
import { getCommonCodes } from '../services/apiService';

/**
 * 인증상품 신호 차단 여부 확인
 * @param soId - 작업의 SO_ID
 * @param isCertifyProdField - workItem.IS_CERTIFY_PROD (1 or '1' = true)
 * @returns true이면 신호 전송 차단
 */
export const checkCertifySignalBlocked = async (
  soId: string,
  isCertifyProdField: any,
): Promise<boolean> => {
  // IS_CERTIFY_PROD 필드 체크
  const isCertifyProdFlag = isCertifyProdField == 1 || isCertifyProdField === '1';
  if (!isCertifyProdFlag) {
    return false;
  }

  try {
    const certifySoList = await getCommonCodes('CMIF006');
    const certifySoIds = certifySoList.map((item: any) => item.code || item.COMMON_CD);
    return certifySoIds.includes(soId);
  } catch (e) {
    console.error('[useCertifySignal] CMIF006 조회 실패:', e);
    return false;
  }
};

/**
 * useCertifySignal 훅 (컴포넌트에서 사용)
 */
export const useCertifySignal = () => {
  return { checkCertifySignalBlocked };
};
