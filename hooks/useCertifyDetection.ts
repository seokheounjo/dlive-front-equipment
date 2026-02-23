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

interface UplsProdItem {
  code: string;
  opLnkdCd: string;
}

interface UseCertifyDetectionParams {
  prodCd: string;
  soId: string;
  isCertifyProdField: any; // workItem.IS_CERTIFY_PROD
}

interface UseCertifyDetectionResult {
  isCertifyProd: boolean;
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

  // isCertifyProd 판별: LGCT001에 상품이 있으면 LGU+ (레거시 동일)
  const isCertifyProd = useMemo(() => {
    const uplsItem = uplsProdList.find(item => item.code === prodCd);
    const result = !!uplsItem;
    console.log('[useCertifyDetection] PROD_CD:', prodCd, '| SO_ID:', soId,
      '| LGCT001:', uplsItem ? uplsItem.opLnkdCd : 'N/A',
      '| result:', result);
    return result;
  }, [prodCd, soId, uplsProdList]);

  // certifyOpLnkdCd (F/FG/Z/ZG=FTTH, N/NG=와이드)
  const certifyOpLnkdCd = useMemo(() => {
    const uplsItem = uplsProdList.find(item => item.code === prodCd);
    return uplsItem?.opLnkdCd || '';
  }, [prodCd, uplsProdList]);

  return {
    isCertifyProd,
    certifyOpLnkdCd,
    isLoaded,
    certifyProdList,
    certifySoList,
    uplsProdList,
  };
};
