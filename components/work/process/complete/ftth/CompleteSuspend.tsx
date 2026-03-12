/**
 * FTTH 인증상품/정지(04) 작업완료
 */
import React from 'react';
import CompleteSuspendForm from '../shared/CompleteSuspendForm';
import { CompleteComponentProps } from '../shared/types';

const FtthCompleteSuspend: React.FC<CompleteComponentProps> = (props) => (
  <CompleteSuspendForm {...props} productType="ftth" />
);

export default FtthCompleteSuspend;
