/**
 * 딜라이브 일반/정지(04) 작업완료
 */
import React from 'react';
import CompleteSuspendForm from '../shared/CompleteSuspendForm';
import { CompleteComponentProps } from '../shared/types';

const BasicCompleteSuspend: React.FC<CompleteComponentProps> = (props) => (
  <CompleteSuspendForm {...props} productType="basic" />
);

export default BasicCompleteSuspend;
