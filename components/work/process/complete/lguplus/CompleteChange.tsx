/**
 * lguplus/CompleteChange - LGU+ 재판매 상품변경(WRK_CD=05) 작업완료
 *
 * 전처리: 집선등록 필수 체크 + UPLS 작업완료 (bizType='01')
 * 신호: 개통신호 차단 (sendSignalAfterComplete=false)
 *       구 상품이 LGU+가 아니면 해지신호 전송
 *       - FTTH 인증상품 → CL-06
 *       - 일반 D'Live → SMR05 (레거시 mowou03m05 line 2173)
 */
import React, { useState, useCallback } from 'react';
import CompleteChangeForm, { PreSubmitContext, PreSubmitResult } from '../shared/CompleteChangeForm';
import { CompleteComponentProps } from '../shared/types';
import { executeUplsWorkComplete } from '../../../../../hooks/useCertifyComplete';
import { sendSignal, getCommonCodes, getProdPromotionInfo } from '../../../../../services/apiService';
import { getCertifyProdMap, setCertifyCL06 } from '../../../../../services/certifyApiService';
import ConfirmModal from '../../../../common/ConfirmModal';

const LguplusCompleteChange: React.FC<CompleteComponentProps> = (props) => {
  const [warningModal, setWarningModal] = useState<{message: string, resolve: () => void} | null>(null);

  const showWarning = useCallback((message: string): Promise<void> => {
    return new Promise((resolve) => {
      setWarningModal({ message, resolve });
    });
  }, []);

  const handlePreSubmit = useCallback(async (ctx: PreSubmitContext): Promise<PreSubmitResult | void> => {
    // === 구 상품이 LGU+가 아니면 SMR05 해지신호 전송 ===
    // 레거시 mowou03m05 lines 2167-2185: OLD_PROD_CD가 LGU+ 아닐 때 fn_delsignal_trans(SMR05)
    const oldProdCd = (ctx.order as any).OLD_PROD_CD || '';
    if (oldProdCd && ctx.removedEquipments.length > 0) {
      let isOldUpls = false;
      try {
        const uplsCodes = await getCommonCodes('LGCT001');
        isOldUpls = uplsCodes.some((item: any) => (item.code || item.COMMON_CD) === oldProdCd);
      } catch (e) {
        console.warn('[LguplusCompleteChange] LGCT001 조회 실패:', e);
        await showWarning(`LGCT001 조회 실패: ${(e as any)?.message || '알 수 없는 오류'}`);
      }

      if (!isOldUpls) {
        // 구 상품이 FTTH 인증상품인지 확인
        let isOldFtth = false;
        try {
          const certifyProdList = await getCertifyProdMap();
          isOldFtth = (certifyProdList || []).some((cd: string) => cd === oldProdCd);
        } catch (e) {
          console.warn('[LguplusCompleteChange] getCertifyProdMap 실패:', e);
        }

        if (isOldFtth) {
          // FTTH 인증상품 → CL-06 해지신호
          try {
            console.log(`[신호연동] LGU+ 상품변경(WRK_CD=05) | 구상품(${oldProdCd}) FTTH → CL-06 해지신호 전송`);
            const result = await setCertifyCL06({
              CTRT_ID: ctx.order.CTRT_ID || '',
              CUST_ID: ctx.order.customer?.id || (ctx.order as any).CUST_ID || '',
              SO_ID: ctx.order.SO_ID || '',
              REG_UID: ctx.workerId,
            });
            if (result && !result.ERROR) {
              console.log('[LguplusCompleteChange] CL-06 해지신호 완료');
            } else {
              console.warn('[LguplusCompleteChange] CL-06 해지신호 실패 (계속 진행):', result?.ERROR);
              await showWarning(`CL-06 해지신호 실패: ${result?.ERROR || '알 수 없는 오류'}`);
            }
          } catch (error) {
            console.warn('[LguplusCompleteChange] CL-06 해지신호 오류 (계속 진행):', error);
            await showWarning(`CL-06 해지신호 오류: ${(error as any)?.message || '알 수 없는 오류'}`);
          }
        } else {
          // 일반 D'Live → SMR05 해지신호
          try {
            let eqtProdCmpsId = '';
            try {
              const rmvProdInfo = await getProdPromotionInfo({
                CTRT_ID: ctx.order.CTRT_ID || '',
                RCPT_ID: ctx.order.RCPT_ID || '',
                PROC_CL: 'TERM',
                WRK_CD: '05',
              });
              const prodCmpsRow = rmvProdInfo.find((row: any) => row.PROD_CMPS_CL === '23');
              if (prodCmpsRow) eqtProdCmpsId = prodCmpsRow.PROD_CMPS_ID || '';
            } catch (e) {
              console.warn('[LguplusCompleteChange] getProdPromotionInfo 실패:', e);
              await showWarning(`상품프로모션 정보 조회 실패: ${(e as any)?.message || '알 수 없는 오류'}`);
            }

            // VoIP면 VOIP_JOIN_CTRT_ID 전달 (레거시 mowou03m05 line 2398-2403)
            const prodGrp = (ctx.order as any).PROD_GRP || '';
            let voipJoinCtrtId = '';
            if (prodGrp === 'V' || prodGrp === 'I') {
              const voipProdCd = (ctx.order as any).VOIP_PROD_CD || '';
              voipJoinCtrtId = voipProdCd ? (ctx.order.CTRT_ID || '') : ((ctx.order as any).VOIP_JOIN_CTRT_ID || '');
            }

            console.log(`[신호연동] LGU+ 상품변경(WRK_CD=05) | 구상품(${oldProdCd}) 일반 D'Live → SMR05 해지신호 전송`);
            const result = await sendSignal({
              MSG_ID: 'SMR05',
              CUST_ID: ctx.order.customer?.id || (ctx.order as any).CUST_ID || '',
              CTRT_ID: ctx.order.CTRT_ID || '',
              SO_ID: ctx.order.SO_ID || '',
              EQT_NO: '',
              EQT_PROD_CMPS_ID: eqtProdCmpsId,
              PROD_CD: '',
              WRK_ID: ctx.order.id || '',
              REG_UID: ctx.workerId,
              WTIME: '3',
              VOIP_JOIN_CTRT_ID: voipJoinCtrtId,
            });
            if (result.code !== 'SUCCESS' && result.code !== 'OK') {
              console.warn('[LguplusCompleteChange] SMR05 해지신호 실패 (계속 진행):', result.message);
              await showWarning(`SMR05 해지신호 실패: ${result.message || '알 수 없는 오류'}`);
            } else {
              console.log('[LguplusCompleteChange] SMR05 해지신호 완료');
            }
          } catch (error) {
            console.warn('[LguplusCompleteChange] SMR05 해지신호 오류 (계속 진행):', error);
            await showWarning(`SMR05 해지신호 오류: ${(error as any)?.message || '알 수 없는 오류'}`);
          }
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
      console.log('[LguplusCompleteChange] setUplsWorkComplete 완료');
    } catch (error: any) {
      console.error('[LguplusCompleteChange] UPLS 호출 에러:', error);
      return { success: false, message: `집선등록 중 오류: ${error.message || '알 수 없는 오류'}` };
    }
  }, [showWarning]);

  return (
    <>
      <CompleteChangeForm
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

export default LguplusCompleteChange;
