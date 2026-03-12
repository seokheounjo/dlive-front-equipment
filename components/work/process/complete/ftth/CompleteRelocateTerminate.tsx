/**
 * ftth/CompleteRelocateTerminate - FTTH 인증상품 이전철거(WRK_CD=08) 작업완료
 *
 * 전처리: 없음 (CL-08/CL-06은 신호 페이즈에서 처리)
 * 신호: 차단 (sendSignalAfterComplete=false) - certifyTg는 CL-08 결과로 판별
 */
import React from 'react';
import CompleteRelocateTerminateForm from '../shared/CompleteRelocateTerminateForm';
import { CompleteComponentProps } from '../shared/types';

const FtthCompleteRelocateTerminate: React.FC<CompleteComponentProps> = (props) => (
  <CompleteRelocateTerminateForm {...props} productType="ftth" sendSignalAfterComplete={false} />
);

export default FtthCompleteRelocateTerminate;
