/**
 * CompleteLGUTerminate.tsx
 * LGU+ Certify Terminate Complete (WRK_CD: 02, 08)
 *
 * Certify flow: CL-08 -> CL-06
 * - Base components (CompleteTerminate, CompleteRelocateTerminate) already have CL-08/CL-06 logic
 * - certifyMode forces the certify path regardless of internal isFtthProduct() check
 * - Signal transmission is skipped for certify products (already handled in base)
 *
 * Legacy: mowoa03m02.xml, mowoa03m08.xml
 */
import React from 'react';
import { WorkOrder } from '../../../../types';
import CompleteTerminate from './CompleteTerminate';
import CompleteRelocateTerminate from './CompleteRelocateTerminate';

interface CompleteLGUTerminateProps {
  order: WorkOrder;
  onBack: () => void;
  onSuccess: () => void;
  showToast?: (message: string, type: 'success' | 'error' | 'warning' | 'info') => void;
  equipmentData?: any;
  readOnly?: boolean;
}

const CompleteLGUTerminate: React.FC<CompleteLGUTerminateProps> = (props) => {
  const { order } = props;
  const certifyProps = { certifyMode: true as const };

  if (order.WRK_CD === '08') {
    return <CompleteRelocateTerminate {...props} {...certifyProps} />;
  }

  return <CompleteTerminate {...props} {...certifyProps} />;
};

export default CompleteLGUTerminate;
