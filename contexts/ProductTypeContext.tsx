/**
 * ProductTypeContext - 상품유형 판별 Context
 *
 * 진입 시점에서 상품유형을 한 번 판별하여 하위 컴포넌트에 제공.
 * useCertifyDetection을 내부에서 래핑하여 단일 진실 소스 역할.
 *
 * productType 판별:
 * - 'lguplus': LGCT001 기반 LGU+ 재판매 상품 (isCertifyProd)
 * - 'ftth': getCertifyProdMap 기반 FTTH 인증상품 (isCertifyForLineReg && !isCertifyProd)
 * - 'basic': 딜라이브 일반 상품
 */
import React, { createContext, useMemo } from 'react';
import { useCertifyDetection, UplsProdItem } from '../hooks/useCertifyDetection';

export type ProductType = 'basic' | 'ftth' | 'lguplus';

export interface ProductTypeContextValue {
  productType: ProductType;
  isLguProd: boolean;         // LGCT001 기반 LGU+ 재판매 상품 (구: isCertifyProd)
  isFtthProd: boolean;        // getCertifyProdMap 기반 FTTH 인증상품
  needsLineRegistration: boolean; // 집선등록 필요 여부 (구: isCertifyForLineReg)
  opLnkdCd: string;           // 통신방식 코드 F/FG/Z/ZG=FTTH, N/NG=와이드 (구: certifyOpLnkdCd)
  certifyProdList: string[];
  certifySoList: string[];
  uplsProdList: UplsProdItem[];
  isLoaded: boolean;
}

const defaultValue: ProductTypeContextValue = {
  productType: 'basic',
  isLguProd: false,
  isFtthProd: false,
  needsLineRegistration: false,
  opLnkdCd: '',
  certifyProdList: [],
  certifySoList: [],
  uplsProdList: [],
  isLoaded: false,
};

export const ProductTypeContext = createContext<ProductTypeContextValue>(defaultValue);

interface ProductTypeProviderProps {
  prodCd: string;
  soId: string;
  isCertifyProdField: any; // workItem.IS_CERTIFY_PROD
  children: React.ReactNode;
}

export const ProductTypeProvider: React.FC<ProductTypeProviderProps> = ({
  prodCd,
  soId,
  isCertifyProdField,
  children,
}) => {
  const {
    isCertifyProd,
    isCertifyForLineReg,
    certifyOpLnkdCd,
    isLoaded,
    certifyProdList,
    certifySoList,
    uplsProdList,
  } = useCertifyDetection({ prodCd, soId, isCertifyProdField });

  const value = useMemo<ProductTypeContextValue>(() => {
    // isFtthProd: 집선등록 대상이면서 LGU+ 재판매가 아닌 경우
    const isFtthProd = isCertifyForLineReg && !isCertifyProd;

    // productType 판별
    const productType: ProductType = isCertifyProd
      ? 'lguplus'
      : isFtthProd
        ? 'ftth'
        : 'basic';

    return {
      productType,
      isLguProd: isCertifyProd,
      isFtthProd,
      needsLineRegistration: isCertifyForLineReg,
      opLnkdCd: certifyOpLnkdCd,
      certifyProdList,
      certifySoList,
      uplsProdList,
      isLoaded,
    };
  }, [isCertifyProd, isCertifyForLineReg, certifyOpLnkdCd, isLoaded, certifyProdList, certifySoList, uplsProdList]);

  return (
    <ProductTypeContext.Provider value={value}>
      {children}
    </ProductTypeContext.Provider>
  );
};
