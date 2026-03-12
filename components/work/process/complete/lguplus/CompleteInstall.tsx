/**
 * lguplus/CompleteInstall - LGU+ 재판매 설치(WRK_CD=01) 작업완료
 *
 * 전처리: 집선등록 필수 체크 + UPLS 작업완료 (executeUplsWorkComplete)
 * 신호: 차단 (sendSignalAfterComplete=false)
 */
import React, { useCallback } from 'react';
import CompleteInstallForm, { PreSubmitContext, PreSubmitResult } from '../shared/CompleteInstallForm';
import { CompleteComponentProps } from '../shared/types';
import { executeUplsWorkComplete } from '../../../../../hooks/useCertifyComplete';

const LguplusCompleteInstall: React.FC<CompleteComponentProps> = (props) => {
  const handlePreSubmit = useCallback(async (ctx: PreSubmitContext): Promise<PreSubmitResult | void> => {
    // 장비 있는데 집선등록 정보 없으면 차단
    if (ctx.installedEquipments.length > 0 && !ctx.certifyRegconfInfo) {
      return { success: false, message: '집선등록 관련정보가 등록되어있지않습니다.' };
    }

    if (!ctx.certifyRegconfInfo) return;

    try {
      const result = await executeUplsWorkComplete({
        order: ctx.order,
        workerId: ctx.workerId,
        certifyRegconfInfo: ctx.certifyRegconfInfo,
        bizType: '01',
      });
      if (!result.success) {
        return { success: false, message: `LGU+ 집선등록 실패: ${result.message}` };
      }
      console.log('[LguplusCompleteInstall] setUplsWorkComplete 완료');
    } catch (error: any) {
      console.error('[LguplusCompleteInstall] UPLS 호출 에러:', error);
      return { success: false, message: `집선등록 중 오류: ${error.message || '알 수 없는 오류'}` };
    }
  }, []);

  return (
    <CompleteInstallForm
      {...props}
      productType="lguplus"
      onPreSubmit={handlePreSubmit}
      sendSignalAfterComplete={false}
    />
  );
};

export default LguplusCompleteInstall;
