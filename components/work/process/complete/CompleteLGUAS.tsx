/**
 * CompleteLGUAS.tsx
 * LGU+ Certify A/S Complete (WRK_CD: 03)
 *
 * Certify flow: CL-08 -> CL-04
 * - Base CompleteAS already has CL-04 logic with REASON='AS'
 * - certifyMode forces the certify path regardless of internal isFtthProduct() check
 * - CL-08 check is done internally by certifyMode detection in handleConfirmSubmit
 * - Signal transmission is skipped for certify products (already handled in base)
 *
 * Legacy: mowoa03m03.xml
 */
import React from 'react';
import { WorkOrder } from '../../../../types';
import CompleteAS from './CompleteAS';

interface CompleteLGUASProps {
  order: WorkOrder;
  onBack: () => void;
  onSuccess: () => void;
  showToast?: (message: string, type: 'success' | 'error' | 'warning' | 'info') => void;
  equipmentData?: any;
  readOnly?: boolean;
}

const CompleteLGUAS: React.FC<CompleteLGUASProps> = (props) => {
  return <CompleteAS {...props} certifyMode />;
};

export default CompleteLGUAS;
