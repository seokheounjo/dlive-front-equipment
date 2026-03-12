/**
 * 딜라이브 일반/이전철거(08) 작업완료
 */
import React from 'react';
import CompleteRelocateTerminateForm from '../shared/CompleteRelocateTerminateForm';
import { CompleteComponentProps } from '../shared/types';

const BasicCompleteRelocateTerminate: React.FC<CompleteComponentProps> = (props) => (
  <CompleteRelocateTerminateForm {...props} productType="basic" />
);

export default BasicCompleteRelocateTerminate;
