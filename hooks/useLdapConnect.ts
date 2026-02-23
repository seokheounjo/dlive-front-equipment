/**
 * useLdapConnect - LDAP 연동 훅
 * WorkEquipmentManagement.tsx에서 추출
 *
 * LGU+ 인증상품 장비등록 시 LDAP 연동:
 * - 장비 유효성 검증 (FTTH: ONT+AP 필수, 와이드: AP 필수)
 * - getUplsLdapRslt API 호출
 * - 연동 결과 저장 (certifyStore)
 *
 * Legacy: mowou03m01.xml btn_LGU_LDAP_Req_OnClick
 */
import { useState } from 'react';
import { getUplsLdapRslt } from '../services/certifyApiService';
import { useCertifyStore } from '../stores/certifyStore';

// LdapResult 타입 (Phase 5에서 certifyStore로 이전 예정)
interface LdapResult {
  ONT_EQT_NO?: string;
  ONT_MAC_ADDR?: string;
  AP_EQT_NO?: string;
  AP_MAC_ADDR?: string;
  PROC_DV_CD?: string;
  PRSS_RSLT_CD?: string;
  [key: string]: any;
}

interface UseLdapConnectParams {
  ctrtId: string;       // DTL_CTRT_ID || CTRT_ID
  certifyOpLnkdCd: string; // 통신방식 (F/FG/Z/ZG=FTTH, N/NG=와이드)
  installedEquipments: any[];
  showToast?: (message: string, type: 'success' | 'error' | 'warning' | 'info') => void;
}

interface UseLdapConnectResult {
  handleLdapConnect: (skipConfirm?: boolean) => Promise<void>;
  ldapLoading: boolean;
  ldapResult: LdapResult | null;
  isLdapDone: boolean;
}

export const useLdapConnect = ({
  ctrtId,
  certifyOpLnkdCd,
  installedEquipments,
  showToast,
}: UseLdapConnectParams): UseLdapConnectResult => {
  const [ldapLoading, setLdapLoading] = useState(false);
  const { ldapResult, setLdapResult } = useCertifyStore();
  const isLdapDone = !!ldapResult;

  const handleLdapConnect = async (skipConfirm = false) => {
    // 1. 상품 유형에 따른 필수 장비 검증
    const isFtth = ['F', 'FG', 'Z', 'ZG'].includes(certifyOpLnkdCd);
    const isWide = ['N', 'NG'].includes(certifyOpLnkdCd);

    const hasOnt = installedEquipments.some((eq: any) => {
      const mid = eq.actualEquipment?.ITEM_MID_CD || eq.actualEquipment?.itemMidCd ||
                  eq.contractEquipment?.ITEM_MID_CD || eq.contractEquipment?.itemMidCd ||
                  eq.ITEM_MID_CD || eq.itemMidCd || '';
      return mid === '02' || mid === '31'; // ONT
    });
    const hasAp = installedEquipments.some((eq: any) => {
      const mid = eq.actualEquipment?.ITEM_MID_CD || eq.actualEquipment?.itemMidCd ||
                  eq.contractEquipment?.ITEM_MID_CD || eq.contractEquipment?.itemMidCd ||
                  eq.ITEM_MID_CD || eq.itemMidCd || '';
      return mid === '10' || mid === '32'; // AP / WiFi AP
    });

    if (isFtth) {
      if (!hasOnt) {
        showToast?.('FTTH용 필수 ONT단말이 설치되어야 합니다.', 'warning');
        return;
      }
      if (!hasAp) {
        showToast?.('FTTH용 필수 AP가 설치되어야 합니다.', 'warning');
        return;
      }
    } else if (isWide) {
      if (!hasAp) {
        showToast?.('와이드용 필수 AP가 설치되어야 합니다.', 'warning');
        return;
      }
    }

    if (installedEquipments.length < 1) {
      showToast?.('장비정보를 선택해주세요.', 'warning');
      return;
    }

    // 3. LDAP API 호출
    if (!ctrtId) {
      showToast?.('계약 ID가 없습니다.', 'error');
      return;
    }

    setLdapLoading(true);
    try {
      console.log('[useLdapConnect] 연동 요청:', { ctrtId, opLnkdCd: certifyOpLnkdCd });
      const result = await getUplsLdapRslt(ctrtId);
      console.log('[useLdapConnect] 연동 결과:', result);

      if (result.exists && result.data.length > 0) {
        const ldapData = result.data[0];
        setLdapResult(ldapData);
        showToast?.('LDAP 연동이 완료되었습니다.', 'success');
      } else {
        setLdapResult({ _empty: true } as any);
        showToast?.('LDAP 연동이 완료되었습니다. (응답 데이터 없음)', 'info');
      }
    } catch (error: any) {
      console.error('[useLdapConnect] 연동 실패:', error);
      showToast?.(error.message || 'LDAP 연동에 실패했습니다.', 'error');
    } finally {
      setLdapLoading(false);
    }
  };

  return {
    handleLdapConnect,
    ldapLoading,
    ldapResult,
    isLdapDone,
  };
};
