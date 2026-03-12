/**
 * lguplus/CompleteTerminate - LGU+ 재판매 철거(WRK_CD=02) 작업완료
 *
 * 전처리: 없음
 * 신호: 차단 (sendSignalAfterComplete=false)
 */
import React from 'react';
import CompleteTerminateForm from '../shared/CompleteTerminateForm';
import { CompleteComponentProps } from '../shared/types';

const LguplusCompleteTerminate: React.FC<CompleteComponentProps> = (props) => (
  <CompleteTerminateForm {...props} productType="lguplus" sendSignalAfterComplete={false} />
);

export default LguplusCompleteTerminate;
