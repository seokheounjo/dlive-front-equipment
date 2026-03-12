/**
 * 딜라이브 일반/상품변경(05) 작업완료
 *
 * 구 상품이 FTTH 인증상품이고 신 상품이 비인증(일반)인 경우:
 * → CL-06 해지 호출 (레거시 mowoa03m05 CERTIFY_OLD='Y' 분기)
 */
import React, { useState, useCallback } from 'react';
import CompleteChangeForm, { PreSubmitContext, PreSubmitResult } from '../shared/CompleteChangeForm';
import { CompleteComponentProps } from '../shared/types';
import { determineCertifyType, executeCL06ForChange } from '../../../../../hooks/useCertifyComplete';
import ConfirmModal from '../../../../common/ConfirmModal';

const BasicCompleteChange: React.FC<CompleteComponentProps> = (props) => {
  const [warningModal, setWarningModal] = useState<{message: string, resolve: () => void} | null>(null);

  const showWarning = useCallback((message: string): Promise<void> => {
    return new Promise((resolve) => {
      setWarningModal({ message, resolve });
    });
  }, []);

  const handlePreSubmit = useCallback(async (ctx: PreSubmitContext): Promise<PreSubmitResult | void> => {
    // 구 상품이 FTTH 인증이고 신 상품이 비인증(basic)이면 CL-06 해지
    // 레거시 mowoa03m05 lines 1842-1849: CERTIFY_OLD='Y' → fn_certify_cl06()
    try {
      const oldCtrtId = ctx.order.CTRT_ID || '';
      const { certifyType, bCl08 } = await determineCertifyType(ctx.order, ctx.workerId, oldCtrtId);
      console.log('[BasicCompleteChange] determineCertifyType:', certifyType, 'bCl08:', bCl08);

      if (certifyType === 'D') {
        // 구 상품 FTTH 인증 → 신 상품 비인증: CL-06 해지 필요
        console.log('[BasicCompleteChange] FTTH→일반 상품변경: CL-06 해지 호출');
        const cl06Result = await executeCL06ForChange(ctx.order, ctx.workerId, oldCtrtId);
        if (!cl06Result.success) {
          console.warn('[BasicCompleteChange] CL-06 해지 실패:', cl06Result.error);
          await showWarning(`CL-06 해지 실패: ${cl06Result.error || '알 수 없는 오류'}`);
          // 레거시 동일: CL-06 실패해도 계속 진행
        } else {
          console.log('[BasicCompleteChange] CL-06 해지 성공');
        }
      }
    } catch (error: any) {
      console.warn('[BasicCompleteChange] CL-06 체크/호출 오류 (무시하고 계속):', error);
      await showWarning(`CL-06 처리 오류: ${error?.message || '알 수 없는 오류'}`);
    }
  }, [showWarning]);

  return (
    <>
      <CompleteChangeForm
        {...props}
        productType="basic"
        onPreSubmit={handlePreSubmit}
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

export default BasicCompleteChange;
