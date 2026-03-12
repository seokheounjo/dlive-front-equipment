/**
 * lguplus/CompleteInternalMove - LGU+ 재판매 댁내이전(WRK_CD=06) 작업완료
 *
 * 전처리: CL-04 서비스 개통 등록 (06은 UPLS 호출하지 않음, CL-04만, 레거시 동일)
 * 신호: 차단 (sendSignalAfterComplete=false)
 */
import React, { useCallback } from 'react';
import CompleteInternalMoveForm, { PreSubmitContext, PreSubmitResult } from '../shared/CompleteInternalMoveForm';
import { CompleteComponentProps } from '../shared/types';
import { executeCL04Registration, determineCertifyType } from '../../../../../hooks/useCertifyComplete';

const LguplusCompleteInternalMove: React.FC<CompleteComponentProps> = (props) => {
  const handlePreSubmit = useCallback(async (ctx: PreSubmitContext): Promise<PreSubmitResult | void> => {
    if (!ctx.certifyRegconfInfo) return;

    try {
      const { certifyType, bCl08 } = await determineCertifyType(ctx.order, ctx.workerId);
      console.log('[LguplusCompleteInternalMove] CL-04 certifyType:', certifyType, 'bCl08:', bCl08);

      if (certifyType === 'U' || certifyType === 'C') {
        const cl04Result = await executeCL04Registration({
          order: ctx.order,
          workerId: ctx.workerId,
          certifyRegconfInfo: ctx.certifyRegconfInfo,
          reason: certifyType === 'U' ? '변경' : '신규',
          certifyType,
          contIdOld: certifyType === 'U' ? (ctx.order.CTRT_ID || '') : undefined,
        });
        if (!cl04Result.success) {
          console.warn('[LguplusCompleteInternalMove] CL-04 실패:', cl04Result.message);
          return { success: false, message: `집선정보 등록 실패: ${cl04Result.message}`, severity: 'warning' };
        }
        console.log('[LguplusCompleteInternalMove] CL-04 성공');
      }
    } catch (error: any) {
      console.error('[LguplusCompleteInternalMove] CL-04 처리 오류:', error);
      return { success: false, message: `집선정보 처리 중 오류: ${error.message || ''}`, severity: 'warning' };
    }
  }, []);

  return (
    <CompleteInternalMoveForm
      {...props}
      productType="lguplus"
      onPreSubmit={handlePreSubmit}
      sendSignalAfterComplete={false}
    />
  );
};

export default LguplusCompleteInternalMove;
