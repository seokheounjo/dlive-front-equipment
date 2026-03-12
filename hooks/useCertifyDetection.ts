/**
 * useCertifyDetection - LGU+/FTTH 인증상품 감지 훅
 * WorkProcessFlow.tsx에서 추출
 *
 * 3개 API를 병렬 로드:
 * - CMIF006: 인증 대상 SO(지점) 목록 (Complete에서 CL-08/CL-06 판별용)
 * - getCertifyProdMap: 인증 대상 상품 코드 (Complete에서 CL-08/CL-06 판별용)
 * - LGCT001: UPLS 상품 목록 (opLnkdCd 포함)
 *
 * isCertifyProd 판별 조건 (레거시 동일):
 * - PROD_CD가 LGCT001(ds_upls_prod_cd)에 있으면 LGU+ 상품
 */
import { useState, useEffect, useMemo } from 'react';
import { getCommonCodes } from '../services/apiService';
import { getCertifyProdMap } from '../services/certifyApiService';
import { useCertifyStore } from '../stores/certifyStore';

export interface UplsProdItem {
  code: string;
  opLnkdCd: string;
  refCode2: string;  // speed (500M etc) - REF_CODE2
  refCode6: string;  // network type (N=optical etc) - REF_CODE6
}

interface UseCertifyDetectionParams {
  prodCd: string;
  soId: string;
  isCertifyProdField: any; // workItem.IS_CERTIFY_PROD
}

interface UseCertifyDetectionResult {
  isCertifyProd: boolean;       // LGCT001 기반 (LGU+ 재판매) → U+ 전용 기능 (청약, LDAP, 포트)
  isCertifyForLineReg: boolean; // LGCT001 OR (IS_CERTIFY_PROD+CMIF006) → 집선등록 표시용
  certifyOpLnkdCd: string;
  isLoaded: boolean;
  certifyProdList: string[];
  certifySoList: string[];
  uplsProdList: UplsProdItem[];
}

export const useCertifyDetection = ({
  prodCd,
  soId,
  isCertifyProdField,
}: UseCertifyDetectionParams): UseCertifyDetectionResult => {
  const [certifySoList, setCertifySoList] = useState<string[]>([]);
  const [isSoListLoaded, setIsSoListLoaded] = useState(false);

  const [certifyProdList, setCertifyProdList] = useState<string[]>([]);
  const [isProdListLoaded, setIsProdListLoaded] = useState(false);

  const [uplsProdList, setUplsProdList] = useState<UplsProdItem[]>([]);
  const [isUplsListLoaded, setIsUplsListLoaded] = useState(false);

  const isLoaded = isSoListLoaded && isProdListLoaded && isUplsListLoaded;

  // CMIF006: 인증 대상 SO 목록
  useEffect(() => {
    const load = async () => {
      try {
        const codes = await getCommonCodes('CMIF006');
        const soIds = codes.map((item: any) => item.code || item.COMMON_CD);
        setCertifySoList(soIds);
        console.log('[useCertifyDetection] CMIF006 SO 목록:', soIds.length, '개');
      } catch (e) {
        console.error('[useCertifyDetection] CMIF006 로드 실패:', e);
      }
      setIsSoListLoaded(true);
    };
    load();
  }, []);

  // getCertifyProdMap: 인증 대상 상품 목록
  useEffect(() => {
    const load = async () => {
      try {
        const prodList = await getCertifyProdMap();
        setCertifyProdList(prodList);
        console.log('[useCertifyDetection] CertifyProdMap:', prodList.length, '개');
      } catch (e) {
        console.error('[useCertifyDetection] CertifyProdMap 로드 실패:', e);
      }
      setIsProdListLoaded(true);
    };
    load();
  }, []);

  // LGCT001: UPLS 상품 목록
  useEffect(() => {
    const load = async () => {
      try {
        const codes = await getCommonCodes('LGCT001');
        const uplsList = codes.map((item: any) => ({
          code: item.code || item.COMMON_CD,
          opLnkdCd: item.ref_code8 || '',
          refCode2: item.ref_code2 || item.REF_CODE2 || '',
          refCode6: item.ref_code6 || item.REF_CODE6 || '',
        }));
        setUplsProdList(uplsList);
        console.log('[useCertifyDetection] LGCT001 UPLS 상품:', uplsList.length, '개');
      } catch (e) {
        console.error('[useCertifyDetection] LGCT001 로드 실패:', e);
      }
      setIsUplsListLoaded(true);
    };
    load();
  }, []);

  // isCertifyProd: LGCT001 기반 (LGU+ 재판매 상품만)
  // → U+ 전용 기능 (청약신청, LDAP연동, 포트현황 등) 제어용
  const isCertifyProd = useMemo(() => {
    const uplsItem = uplsProdList.find(item => item.code === prodCd);
    const result = !!uplsItem;
    console.log('[useCertifyDetection] PROD_CD:', prodCd, '| SO_ID:', soId,
      '| LGCT001:', uplsItem ? uplsItem.opLnkdCd : 'N/A',
      '| isCertifyProd(U+):', result);
    return result;
  }, [prodCd, soId, uplsProdList]);

  // isCertifyForLineReg: 집선등록 표시 판별 (레거시 mowoa03m05 CERTIFY_TG 동일)
  // LGCT001(U+재판매) OR (IS_CERTIFY_PROD + CMIF006 SO)(일반 FTTH 인증상품)
  const isCertifyForLineReg = useMemo(() => {
    const uplsItem = uplsProdList.find(item => item.code === prodCd);
    const byUpls = !!uplsItem;
    const byField = (isCertifyProdField == 1 || isCertifyProdField == '1') &&
      certifySoList.includes(soId);
    const result = byUpls || byField;
    if (result !== byUpls) {
      console.log('[useCertifyDetection] isCertifyForLineReg:', result,
        '| IS_CERTIFY_PROD:', isCertifyProdField, '| SO_in_CMIF006:', certifySoList.includes(soId));
    }
    return result;
  }, [prodCd, soId, uplsProdList, isCertifyProdField, certifySoList]);

  // certifyOpLnkdCd (F/FG/Z/ZG=FTTH, N/NG=와이드)
  // LGCT001에서 우선 조회, 없으면 빈값 (일반 인증상품은 opLnkdCd 없을 수 있음)
  const certifyOpLnkdCd = useMemo(() => {
    const uplsItem = uplsProdList.find(item => item.code === prodCd);
    return uplsItem?.opLnkdCd || '';
  }, [prodCd, uplsProdList]);

  // 두 데이터셋 교차 비교 디버그 로그
  useEffect(() => {
    if (isLoaded && certifyProdList.length > 0 && uplsProdList.length > 0) {
      const uplsCodes = uplsProdList.map(item => item.code);
      const overlap = certifyProdList.filter(code => uplsCodes.includes(code));
      const onlyCertify = certifyProdList.filter(code => !uplsCodes.includes(code));
      const onlyUpls = uplsCodes.filter(code => !certifyProdList.includes(code));
      console.log('[useCertifyDetection] === 데이터셋 비교 ===');
      console.log(`  getCertifyProdMap(FTTH인증): ${certifyProdList.length}개 →`, certifyProdList);
      console.log(`  LGCT001(LGU+재판매): ${uplsProdList.length}개 →`, uplsCodes);
      console.log(`  교집합: ${overlap.length}개 →`, overlap);
      console.log(`  getCertifyProdMap에만: ${onlyCertify.length}개 →`, onlyCertify);
      console.log(`  LGCT001에만: ${onlyUpls.length}개 →`, onlyUpls);
      console.log(`  현재 PROD_CD=${prodCd} → getCertifyProdMap: ${certifyProdList.includes(prodCd)}, LGCT001: ${!!uplsProdList.find(i => i.code === prodCd)}`);
    }
  }, [isLoaded, certifyProdList, uplsProdList, prodCd]);

  // certifyStore에 동기화 (LineRegistration 등에서 store를 통해 참조)
  const { setCertifyOpLnkdCd, setIsCertifyProd, setCertifyProdList: storeSetCertifyProdList } = useCertifyStore();
  useEffect(() => {
    if (isLoaded) {
      setCertifyOpLnkdCd(certifyOpLnkdCd);
      setIsCertifyProd(isCertifyProd);
      storeSetCertifyProdList(certifyProdList);
      console.log('[useCertifyDetection] Store 동기화: certifyOpLnkdCd=', certifyOpLnkdCd, 'isCertifyProd=', isCertifyProd, 'certifyProdList=', certifyProdList.length);
    }
  }, [isLoaded, certifyOpLnkdCd, isCertifyProd, certifyProdList, setCertifyOpLnkdCd, setIsCertifyProd, storeSetCertifyProdList]);

  return {
    isCertifyProd,
    isCertifyForLineReg,
    certifyOpLnkdCd,
    isLoaded,
    certifyProdList,
    certifySoList,
    uplsProdList,
  };
};
