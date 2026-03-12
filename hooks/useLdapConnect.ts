/**
 * useLdapConnect - LDAP 연동 훅
 * WorkEquipmentManagement.tsx에서 추출
 *
 * LGU+ 인증상품 장비등록 시 LDAP 연동:
 * - 청약신청 선행 검증 (LGU_ENTR_NO)
 * - 장비 시리얼번호 검증 (fn_eqt_match_chk)
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

// Helper: get ITEM_MID_CD from equipment object
const getMidCd = (eq: any): string => {
  return eq.actualEquipment?.ITEM_MID_CD || eq.actualEquipment?.itemMidCd ||
         eq.contractEquipment?.ITEM_MID_CD || eq.contractEquipment?.itemMidCd ||
         eq.ITEM_MID_CD || eq.itemMidCd || '';
};

// Helper: get EQT_NO (serial) from equipment object
const getEqtNo = (eq: any): string => {
  return eq.actualEquipment?.EQT_NO || eq.actualEquipment?.id ||
         eq.contractEquipment?.EQT_NO || eq.contractEquipment?.id ||
         eq.EQT_NO || eq.id || '';
};

// Helper: get EQT_CL_NM (equipment class name) for error messaging
const getEqtClNm = (eq: any): string => {
  return eq.actualEquipment?.EQT_CL_NM || eq.contractEquipment?.EQT_CL_NM ||
         eq.EQT_CL_NM || eq.actualEquipment?.itemMidCdNm || '장비번호';
};

export const useLdapConnect = ({
  ctrtId,
  certifyOpLnkdCd,
  installedEquipments,
  showToast,
}: UseLdapConnectParams): UseLdapConnectResult => {
  const [ldapLoading, setLdapLoading] = useState(false);
  const { ldapResult, setLdapResult, entrNo, isSubscriptionDone } = useCertifyStore();
  const isLdapDone = !!ldapResult;

  const handleLdapConnect = async (skipConfirm = false) => {
    // 1. 청약신청 선행 검증 (legacy: LGU_ENTR_NO check, line 3490-3500)
    if (!entrNo && !isSubscriptionDone) {
      showToast?.('청약신청 버튼을 먼저 클릭하시기 바랍니다.', 'warning');
      return;
    }

    // 2. 장비 수 검증 (legacy: ds_eqt_cust.Count < 1, line 3518-3522)
    if (installedEquipments.length < 1) {
      showToast?.('장비정보를 선택해주세요.', 'warning');
      return;
    }

    // 3. 장비 시리얼번호 검증 (legacy: fn_eqt_match_chk, line 3513-3516)
    // ITEM_MID_CD='06' (부속품) 제외, 나머지는 EQT_NO 필수
    for (const eq of installedEquipments) {
      const midCd = getMidCd(eq);
      if (midCd === '06') continue;
      const eqtNo = getEqtNo(eq);
      if (!eqtNo) {
        const eqtClNm = getEqtClNm(eq);
        showToast?.(`장비의 ${eqtClNm}이 등록되어 있지 않습니다.`, 'warning');
        return;
      }
    }

    // 4. 상품 유형에 따른 필수 장비 검증 (legacy: g_Oplnkdcd check, line 3525-3551)
    const isFtth = ['F', 'FG', 'Z', 'ZG'].includes(certifyOpLnkdCd);
    const isWide = ['N', 'NG'].includes(certifyOpLnkdCd);

    // 와이드 (N/NG): AP 필수 (legacy: "광대역 설치 AP가 장착되어야 합니다.")
    if (isWide) {
      const hasAp = installedEquipments.some((eq: any) => {
        const mid = getMidCd(eq);
        return mid === '10' || mid === '32'; // AP / WiFi AP
      });
      if (!hasAp) {
        showToast?.('광대역 설치 AP가 장착되어야 합니다.', 'warning');
        return;
      }
    }

    // FTTH (F/FG/Z/ZG): ONT + AP 필수
    if (isFtth) {
      const hasOnt = installedEquipments.some((eq: any) => {
        const mid = getMidCd(eq);
        return mid === '02' || mid === '31'; // ONT
      });
      if (!hasOnt) {
        showToast?.('FTTH용 필수 ONT단말이 장착되어야 합니다.', 'warning');
        return;
      }
      const hasAp = installedEquipments.some((eq: any) => {
        const mid = getMidCd(eq);
        return mid === '10' || mid === '32'; // AP / WiFi AP
      });
      if (!hasAp) {
        showToast?.('FTTH용 필수 AP가 장착되어야 합니다.', 'warning');
        return;
      }
    }

    // 5. 계약 ID 검증
    if (!ctrtId) {
      showToast?.('계약 ID가 없습니다.', 'error');
      return;
    }

    // 6. LDAP API 호출 (legacy: fn_lgu_ldap_chk, line 3565)
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
        showToast?.('LDAP 연동이 완료되었습니다.', 'info');
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
