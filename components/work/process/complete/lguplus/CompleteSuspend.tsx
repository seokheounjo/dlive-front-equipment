/**
 * LGU+ 재판매/정지(04) 작업완료
 */
import React from 'react';
import CompleteSuspendForm from '../shared/CompleteSuspendForm';
import { CompleteComponentProps } from '../shared/types';

const LguplusCompleteSuspend: React.FC<CompleteComponentProps> = (props) => (
  <CompleteSuspendForm {...props} productType="lguplus" />
);

export default LguplusCompleteSuspend;
