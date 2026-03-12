/**
 * lguplus/CompleteRelocateTerminate - LGU+ 재판매 이전철거(WRK_CD=08) 작업완료
 *
 * 전처리: 없음
 * 신호: 차단 (sendSignalAfterComplete=false) - certifyTg='Y' 고정 (SMR05 skip, CL-06 skip)
 */
import React from 'react';
import CompleteRelocateTerminateForm from '../shared/CompleteRelocateTerminateForm';
import { CompleteComponentProps } from '../shared/types';

const LguplusCompleteRelocateTerminate: React.FC<CompleteComponentProps> = (props) => (
  <CompleteRelocateTerminateForm {...props} productType="lguplus" sendSignalAfterComplete={false} />
);

export default LguplusCompleteRelocateTerminate;
