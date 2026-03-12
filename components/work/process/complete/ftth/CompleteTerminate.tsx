/**
 * ftth/CompleteTerminate - FTTH 인증상품 철거(WRK_CD=02) 작업완료
 *
 * 전처리: CL-08 인증 확인 + CL-06 서비스 해지
 * 신호: D-Live 신호 차단 (sendSignalAfterComplete=false)
 *
 * 레거시 참조: mowoa03m02.xml lines 1053-1059
 * CERTIFY_TG='Y' → fn_certify_cl06() 호출
 */
import React, { useState, useCallback } from 'react';
import CompleteTerminateForm, { PreSubmitContext, PreSubmitResult } from '../shared/CompleteTerminateForm';
import { CompleteComponentProps } from '../shared/types';
import { executeCL08CL06Termination } from '../../../../../hooks/useCertifyComplete';
import ConfirmModal from '../../../../common/ConfirmModal';

const FtthCompleteTerminate: React.FC<CompleteComponentProps> = (props) => {
  const [warningModal, setWarningModal] = useState<{message: string, resolve: () => void} | null>(null);

  const showWarning = useCallback((message: string): Promise<void> => {
    return new Promise((resolve) => {
      setWarningModal({ message, resolve });
    });
  }, []);

  const handlePreSubmit = useCallback(async (ctx: PreSubmitContext): Promise<PreSubmitResult | void> => {
    // CL-08 인증 확인 → CL-06 서비스 해지 (레거시 mowoa03m02 line 1053-1059)
    try {
      const result = await executeCL08CL06Termination(ctx.order, ctx.workerId);
      if (!result.success) {
        console.warn('[FtthCompleteTerminate] CL-06 해지 실패:', result.error);
        await showWarning(`CL-06 해지 실패: ${result.error || '알 수 없는 오류'}`);
        // 레거시 동일: CL-06 실패해도 계속 진행
      } else if (result.certifyTg === 'Y') {
        console.log('[FtthCompleteTerminate] CL-08 확인 + CL-06 해지 완료');
      } else {
        console.log('[FtthCompleteTerminate] CL-08 인증 미확인 (CL-06 스킵)');
      }
    } catch (error: any) {
      console.warn('[FtthCompleteTerminate] CL-06 처리 오류 (무시하고 계속):', error);
      await showWarning(`CL-06 처리 오류: ${error?.message || '알 수 없는 오류'}`);
    }
  }, [showWarning]);

  return (
    <>
      <CompleteTerminateForm
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

export default FtthCompleteTerminate;
