/**
 * lguplus/CompleteRelocate - LGU+ 재판매 이전설치(WRK_CD=07) 작업완료
 *
 * 전처리: 집선등록 필수 체크 + UPLS 작업완료 (bizType='01')
 * 신호: 개통신호 차단 (sendSignalAfterComplete=false)
 *       철거장비 있으면 SMR05 해지신호 전송 (레거시 mowou03m06 line 2469-2489)
 */
import React, { useState, useCallback } from 'react';
import CompleteRelocateForm, { PreSubmitContext, PreSubmitResult } from '../shared/CompleteRelocateForm';
import { CompleteComponentProps } from '../shared/types';
import { executeUplsWorkComplete } from '../../../../../hooks/useCertifyComplete';
import { sendSignal } from '../../../../../services/apiService';
import ConfirmModal from '../../../../common/ConfirmModal';

const LguplusCompleteRelocate: React.FC<CompleteComponentProps> = (props) => {
  const [warningModal, setWarningModal] = useState<{message: string, resolve: () => void} | null>(null);

  const showWarning = useCallback((message: string): Promise<void> => {
    return new Promise((resolve) => {
      setWarningModal({ message, resolve });
    });
  }, []);

  const handlePreSubmit = useCallback(async (ctx: PreSubmitContext): Promise<PreSubmitResult | void> => {
    // === 철거장비 SMR05 해지신호 (레거시 mowou03m06 fn_delsignal_trans) ===
    // HANDY(090901)/AP(091001/091005) 제외, VoIP+WRK_CD=07 제외
    const removedEquipments = ctx.removedEquipments || [];
    if (removedEquipments.length > 0) {
      let delSignalFlag = false;
      for (const eq of removedEquipments) {
        const actual = eq.actualEquipment || eq;
        const eqtClCd = actual.eqtClCd || actual.EQT_CL_CD || '';
        if (eqtClCd === '090901' || eqtClCd === '091001' || eqtClCd === '091005') continue;
        delSignalFlag = true;
      }

      const prodGrp = (ctx.order as any).PROD_GRP || '';
      if (ctx.order.WRK_CD === '07' && prodGrp === 'V') {
        delSignalFlag = false;
      }

      if (delSignalFlag) {
        try {
          const removedProdPromo = (props.equipmentData as any)?.removedProdPromoInfo || (props.equipmentData as any)?.prodPromoInfo || [];
          const delEqtProdCmpsId = removedProdPromo.find?.((item: any) => item.PROD_CMPS_CL === '23')?.PROD_CMPS_ID || '';

          // VoIP면 VOIP_JOIN_CTRT_ID 전달 (레거시 mowou03m06 line 2185-2193)
          const prodGrp = (ctx.order as any).PROD_GRP || '';
          let voipJoinCtrtId = '';
          if (prodGrp === 'V') {
            const voipProdCd = (ctx.order as any).VOIP_PROD_CD || '';
            voipJoinCtrtId = voipProdCd ? (ctx.order.CTRT_ID || '') : ((ctx.order as any).VOIP_JOIN_CTRT_ID || '');
          } else if (prodGrp === 'I') {
            const ispProdCd = (ctx.order as any).ISP_PROD_CD || '';
            if (ispProdCd) {
              voipJoinCtrtId = (ctx.order as any).VOIP_JOIN_CTRT_ID || '';
            }
          }

          console.log(`[신호연동] LGU+ 이전설치(WRK_CD=07) | SMR05 해지신호 전송 | 철거장비 ${removedEquipments.length}개`);
          const result = await sendSignal({
            MSG_ID: 'SMR05',
            CUST_ID: ctx.order.customer?.id || (ctx.order as any).CUST_ID || '',
            CTRT_ID: ctx.order.CTRT_ID || '',
            SO_ID: ctx.order.SO_ID || '',
            EQT_NO: '',
            EQT_PROD_CMPS_ID: delEqtProdCmpsId,
            PROD_CD: '',
            WRK_ID: ctx.order.id || '',
            REG_UID: ctx.workerId,
            WTIME: '3',
            VOIP_JOIN_CTRT_ID: voipJoinCtrtId,
          });
          if (result.code !== 'SUCCESS' && result.code !== 'OK') {
            console.warn('[LguplusCompleteRelocate] SMR05 해지신호 실패 (계속 진행):', result.message);
            await showWarning(`SMR05 해지신호 실패: ${result.message || '알 수 없는 오류'}`);
          } else {
            console.log('[LguplusCompleteRelocate] SMR05 해지신호 완료');
          }
        } catch (error) {
          console.warn('[LguplusCompleteRelocate] SMR05 해지신호 오류 (계속 진행):', error);
          await showWarning(`SMR05 해지신호 오류: ${(error as any)?.message || '알 수 없는 오류'}`);
        }
      }
    }

    // === UPLS 작업완료 ===
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
      console.log('[LguplusCompleteRelocate] setUplsWorkComplete 완료');
    } catch (error: any) {
      console.error('[LguplusCompleteRelocate] UPLS 호출 에러:', error);
      return { success: false, message: `집선등록 중 오류: ${error.message || '알 수 없는 오류'}` };
    }
  }, [showWarning]);

  return (
    <>
      <CompleteRelocateForm
        {...props}
        productType="lguplus"
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

export default LguplusCompleteRelocate;
