/**
 * 딜라이브 일반/철거(02) 작업완료
 */
import React from 'react';
import CompleteTerminateForm from '../shared/CompleteTerminateForm';
import { CompleteComponentProps } from '../shared/types';

const BasicCompleteTerminate: React.FC<CompleteComponentProps> = (props) => (
  <CompleteTerminateForm {...props} productType="basic" />
);

export default BasicCompleteTerminate;
