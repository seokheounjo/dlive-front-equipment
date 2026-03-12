/**
 * ftth/CompleteChange - FTTH 인증상품 상품변경(WRK_CD=05) 작업완료
 *
 * 전처리: CL-04 집선정보 등록 (certifyType U/C) 또는 CL-06 해지 (certifyType D)
 * 신호: 차단 (sendSignalAfterComplete=false)
 */
import React, { useState, useCallback } from 'react';
import CompleteChangeForm, { PreSubmitContext, PreSubmitResult } from '../shared/CompleteChangeForm';
import { CompleteComponentProps } from '../shared/types';
import { executeCL04Registration, determineCertifyType, executeCL06ForChange } from '../../../../../hooks/useCertifyComplete';
import ConfirmModal from '../../../../common/ConfirmModal';

const FtthCompleteChange: React.FC<CompleteComponentProps> = (props) => {
  const [warningModal, setWarningModal] = useState<{message: string, resolve: () => void} | null>(null);

  const showWarning = useCallback((message: string): Promise<void> => {
    return new Promise((resolve) => {
      setWarningModal({ message, resolve });
    });
  }, []);

  const handlePreSubmit = useCallback(async (ctx: PreSubmitContext): Promise<PreSubmitResult | void> => {
    if (!ctx.certifyRegconfInfo) return;

    try {
      const oldCtrtId = ctx.order.CTRT_ID || '';
      const { certifyType, bCl08 } = await determineCertifyType(ctx.order, ctx.workerId, oldCtrtId);
      console.log('[FtthCompleteChange] CL-04 certifyType:', certifyType, 'bCl08:', bCl08);

      if (certifyType === 'U' || certifyType === 'C') {
        // CL-04 집선정보 등록 (상품변경: 신규계약 DTL_CTRT_ID 사용)
        const cl04Order = { ...ctx.order, CTRT_ID: (ctx.order as any).DTL_CTRT_ID || ctx.order.CTRT_ID };
        // 부가서비스: PROD_CMPS_CL 21/22 + PROD_STAT_CD 10/20 (레거시 mowoa03m05 fn_certify_cl04)
        const addOnParam = (ctx.prodPromoInfo || [])
          .filter((item: any) => (item.PROD_CMPS_CL === '21' || item.PROD_CMPS_CL === '22') && (item.PROD_STAT_CD === '10' || item.PROD_STAT_CD === '20'))
          .map((item: any) => item.PROD_CD)
          .join(',');
        const cl04Result = await executeCL04Registration({
          order: cl04Order,
          workerId: ctx.workerId,
          certifyRegconfInfo: ctx.certifyRegconfInfo,
          addOnParam,
          reason: certifyType === 'U' ? '변경' : '신규',
          certifyType,
          contIdOld: certifyType === 'U' ? oldCtrtId : undefined,
        });
        if (!cl04Result.success) {
          console.warn('[FtthCompleteChange] CL-04 실패:', cl04Result.message);
          return { success: false, message: `집선정보 등록 실패: ${cl04Result.message}`, severity: 'warning' };
        }
        console.log('[FtthCompleteChange] CL-04 성공');
      } else if (certifyType === 'D') {
        // CL-06 기존 인증 해지 (구상품 인증 -> 신상품 비인증)
        const cl06Result = await executeCL06ForChange(ctx.order, ctx.workerId, oldCtrtId);
        if (!cl06Result.success) {
          console.warn('[FtthCompleteChange] CL-06 (해지) 실패:', cl06Result.error);
          await showWarning(`CL-06 해지 실패: ${cl06Result.error || '알 수 없는 오류'}`);
        } else {
          console.log('[FtthCompleteChange] CL-06 (해지) 성공');
        }
      }
    } catch (error: any) {
      console.error('[FtthCompleteChange] CL-04/CL-06 처리 오류:', error);
      return { success: false, message: `집선정보 처리 중 오류: ${error.message || ''}`, severity: 'warning' };
    }
  }, [showWarning]);

  return (
    <>
      <CompleteChangeForm
        {...props}
        productType="ftth"
        onPreSubmit={handlePreSubmit}
        sendSignalAfterComplete={false}
      />
      {warningModal && (
        <ConfirmModal
          isOpen={true}
          message={warningModal.message}
          type="warning"
          showCancel={false}
          confirmText="확인"
          onConfirm={() => { warningModal.resolve(); setWarningModal(null); }}
          onClose={() => { warningModal.resolve(); setWarningModal(null); }}
        />
      )}
    </>
  );
};

export default FtthCompleteChange;
