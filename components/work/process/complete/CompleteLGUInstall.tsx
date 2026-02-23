/**
 * CompleteLGUInstall.tsx
 * LGU+ Certify Install/Move Complete (WRK_CD: 01, 06, 07)
 *
 * Certify flow: LDAP -> CL-04
 * - Checks LDAP subscription (getUplsLdapRslt) on mount to determine REASON
 * - LDAP result empty -> REASON='신규' (new subscription)
 * - LDAP result exists -> REASON='변경' (existing modification)
 * - Passes certifyMode + certifyReason to the appropriate base component
 * - Base component handles CL-04 call with the dynamic REASON
 *
 * Legacy: mowoa03m01.xml fn_certify_cl04 + LDAP check
 */
import React, { useState, useEffect } from 'react';
import { WorkOrder } from '../../../../types';
import { getUplsLdapRslt } from '../../../../services/certifyApiService';
import CompleteInstall from './CompleteInstall';
import CompleteInternalMove from './CompleteInternalMove';
import CompleteRelocate from './CompleteRelocate';

interface CompleteLGUInstallProps {
  order: WorkOrder;
  onBack: () => void;
  onSuccess: () => void;
  showToast?: (message: string, type: 'success' | 'error' | 'warning' | 'info') => void;
  equipmentData?: any;
  readOnly?: boolean;
  onEquipmentRefreshNeeded?: () => void;
}

const CompleteLGUInstall: React.FC<CompleteLGUInstallProps> = (props) => {
  const { order } = props;
  const [certifyReason, setCertifyReason] = useState<string>('신규');
  const [ldapChecked, setLdapChecked] = useState(false);

  // LDAP subscription check on mount
  useEffect(() => {
    const checkLdap = async () => {
      try {
        // 20220919 레거시 변경: CTRT_ID → DTL_CTRT_ID 사용
        const ctrtId = (order as any).DTL_CTRT_ID || order.CTRT_ID || '';
        if (ctrtId) {
          console.log('[CompleteLGUInstall] LDAP subscription check:', ctrtId, '(DTL_CTRT_ID:', (order as any).DTL_CTRT_ID, ', CTRT_ID:', order.CTRT_ID, ')');
          const result = await getUplsLdapRslt(ctrtId);
          const reason = result.exists ? '변경' : '신규';
          setCertifyReason(reason);
          console.log('[CompleteLGUInstall] LDAP result:', { exists: result.exists, reason });
        }
      } catch (error) {
        console.log('[CompleteLGUInstall] LDAP check failed, using default:', error);
        setCertifyReason('신규');
      }
      setLdapChecked(true);
    };
    checkLdap();
  }, [order.CTRT_ID]);

  if (!ldapChecked) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="flex flex-col items-center gap-3">
          <svg className="animate-spin h-8 w-8 text-blue-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          <span className="text-sm text-gray-500">LGU+ 인증 정보 확인 중...</span>
        </div>
      </div>
    );
  }

  const certifyProps = { certifyMode: true as const, certifyReason };
  const wrkCd = order.WRK_CD;

  switch (wrkCd) {
    case '06':
      return <CompleteInternalMove {...props} {...certifyProps} />;
    case '07':
      return <CompleteRelocate {...props} {...certifyProps} />;
    default:
      return <CompleteInstall {...props} {...certifyProps} />;
  }
};

export default CompleteLGUInstall;
