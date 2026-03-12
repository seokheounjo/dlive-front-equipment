/**
 * ftth/CompleteInstall - FTTH 인증상품 설치(WRK_CD=01) 작업완료
 *
 * 전처리: CL-04 서비스 개통 등록
 * 신호: 차단 (sendSignalAfterComplete=false)
 */
import React, { useCallback } from 'react';
import CompleteInstallForm, { PreSubmitContext, PreSubmitResult } from '../shared/CompleteInstallForm';
import { CompleteComponentProps } from '../shared/types';
import { executeCL04Registration } from '../../../../../hooks/useCertifyComplete';

const FtthCompleteInstall: React.FC<CompleteComponentProps> = (props) => {
  const handlePreSubmit = useCallback(async (ctx: PreSubmitContext): Promise<PreSubmitResult | void> => {
    if (!ctx.certifyRegconfInfo) return;

    try {
      console.log('[FtthCompleteInstall] CL-04 호출 시작');
      const result = await executeCL04Registration({
        order: ctx.order,
        workerId: ctx.workerId,
        certifyRegconfInfo: ctx.certifyRegconfInfo,
        reason: '신규',
      });
      if (!result.success) {
        console.warn('[FtthCompleteInstall] CL-04 실패:', result.message);
        return { success: false, message: `집선정보 등록 실패: ${result.message}`, severity: 'warning' };
      }
      console.log('[FtthCompleteInstall] CL-04 성공');
    } catch (error: any) {
      console.error('[FtthCompleteInstall] CL-04 처리 오류:', error);
      return { success: false, message: `집선정보 처리 중 오류: ${error.message || ''}`, severity: 'warning' };
    }
  }, []);

  return (
    <CompleteInstallForm
      {...props}
      productType="ftth"
      onPreSubmit={handlePreSubmit}
      sendSignalAfterComplete={false}
    />
  );
};

export default FtthCompleteInstall;
