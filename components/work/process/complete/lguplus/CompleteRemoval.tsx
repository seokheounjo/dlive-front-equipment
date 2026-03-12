/**
 * LGU+ 재판매/부가상품(09) 작업완료
 */
import React from 'react';
import CompleteRemovalForm from '../shared/CompleteRemovalForm';
import { CompleteComponentProps } from '../shared/types';

const LguplusCompleteRemoval: React.FC<CompleteComponentProps> = (props) => (
  <CompleteRemovalForm {...props} productType="lguplus" />
);

export default LguplusCompleteRemoval;
