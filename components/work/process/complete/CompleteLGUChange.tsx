/**
 * CompleteLGUChange.tsx
 * LGU+ Certify Product Change Complete (WRK_CD: 05)
 *
 * Certify flow: CL-08 -> CL-06(old) + CL-04(new)
 * - Base CompleteChange already has full certify type determination logic:
 *   - CL-08 on OLD contract -> check registration
 *   - certifyType U: OLD+NEW certified -> CL-06(old) + CL-04(new) with REASON='상변'
 *   - certifyType C: only NEW certified -> CL-04(new) with REASON='신규'
 *   - certifyType D: only OLD certified -> CL-06(old) only
 * - certifyMode forces the certify path regardless of internal isFtthProduct() check
 * - Signal transmission is skipped for certify products (already handled in base)
 *
 * Legacy: mowoa03m05.xml
 */
import React from 'react';
import { WorkOrder } from '../../../../types';
import CompleteChange from './CompleteChange';

interface CompleteLGUChangeProps {
  order: WorkOrder;
  onBack: () => void;
  onSuccess: () => void;
  showToast?: (message: string, type: 'success' | 'error' | 'warning' | 'info') => void;
  equipmentData?: any;
  readOnly?: boolean;
}

const CompleteLGUChange: React.FC<CompleteLGUChangeProps> = (props) => {
  return <CompleteChange {...props} certifyMode />;
};

export default CompleteLGUChange;
