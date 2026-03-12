/**
 * ftth/CompleteAS - FTTH 인증상품 A/S(WRK_CD=03) 작업완료
 *
 * 전처리: 교체장비 있으면 CL-04 집선정보 등록
 * 신호: D-Live 신호 차단 (sendSignalAfterComplete=false)
 *
 * 레거시 참조: mowoa03m03.xml lines 1584-1594
 * CERTIFY_TG='Y' && ds_eqt_info.Count > 0 → fn_certify_cl04()
 */
import React, { useCallback } from 'react';
import CompleteASForm, { PreSubmitContext, PreSubmitResult } from '../shared/CompleteASForm';
import { CompleteComponentProps } from '../shared/types';
import { executeCL04Registration } from '../../../../../hooks/useCertifyComplete';

const FtthCompleteAS: React.FC<CompleteComponentProps> = (props) => {
  const handlePreSubmit = useCallback(async (ctx: PreSubmitContext): Promise<PreSubmitResult | void> => {
    // 교체장비가 있을 때만 CL-04 호출 (레거시 mowoa03m03 line 1584: ds_eqt_info.Count > 0)
    if (ctx.installedEquipments.length === 0) return;
    if (!ctx.certifyRegconfInfo) return;

    try {
      console.log('[FtthCompleteAS] 교체장비 있음 → CL-04 집선정보 등록');
      const result = await executeCL04Registration({
        order: ctx.order,
        workerId: ctx.workerId,
        certifyRegconfInfo: ctx.certifyRegconfInfo,
        reason: 'AS',
        certifyType: 'U',
      });
      if (!result.success) {
        console.warn('[FtthCompleteAS] CL-04 실패:', result.message);
        return { success: false, message: `집선정보 등록 실패: ${result.message}`, severity: 'warning' };
      }
      console.log('[FtthCompleteAS] CL-04 성공');
    } catch (error: any) {
      console.warn('[FtthCompleteAS] CL-04 처리 오류:', error);
      return { success: false, message: `집선정보 처리 중 오류: ${error.message || ''}`, severity: 'warning' };
    }
  }, []);

  return (
    <CompleteASForm
      {...props}
      productType="ftth"
      onPreSubmit={handlePreSubmit}
      sendSignalAfterComplete={false}
    />
  );
};

export default FtthCompleteAS;
