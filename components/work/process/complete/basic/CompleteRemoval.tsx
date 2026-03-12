/**
 * 딜라이브 일반/부가상품(09) 작업완료
 */
import React from 'react';
import CompleteRemovalForm from '../shared/CompleteRemovalForm';
import { CompleteComponentProps } from '../shared/types';

const BasicCompleteRemoval: React.FC<CompleteComponentProps> = (props) => (
  <CompleteRemovalForm {...props} productType="basic" />
);

export default BasicCompleteRemoval;
