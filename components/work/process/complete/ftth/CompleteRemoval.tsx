/**
 * FTTH 인증상품/부가상품(09) 작업완료
 */
import React from 'react';
import CompleteRemovalForm from '../shared/CompleteRemovalForm';
import { CompleteComponentProps } from '../shared/types';

const FtthCompleteRemoval: React.FC<CompleteComponentProps> = (props) => (
  <CompleteRemovalForm {...props} productType="ftth" />
);

export default FtthCompleteRemoval;
