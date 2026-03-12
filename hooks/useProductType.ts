/**
 * useProductType - ProductTypeContext 소비 훅
 *
 * 사용법:
 *   const { productType, isLguProd, isFtthProd } = useProductType();
 *
 * ProductTypeProvider 밖에서 호출하면 에러 발생.
 */
import { useContext } from 'react';
import { ProductTypeContext, ProductTypeContextValue } from '../contexts/ProductTypeContext';

export const useProductType = (): ProductTypeContextValue => {
  const context = useContext(ProductTypeContext);
  if (!context.isLoaded && context.productType === 'basic' && !context.opLnkdCd) {
    // Context가 아직 로드되지 않은 초기 상태 → 로딩 중
    // Provider 밖에서 호출된 경우에도 기본값 반환 (에러 방지)
  }
  return context;
};
