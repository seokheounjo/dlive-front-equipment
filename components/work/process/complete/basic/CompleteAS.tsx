/**
 * 딜라이브 일반/A/S(03) 작업완료
 */
import React from 'react';
import CompleteASForm from '../shared/CompleteASForm';
import { CompleteComponentProps } from '../shared/types';

const BasicCompleteAS: React.FC<CompleteComponentProps> = (props) => (
  <CompleteASForm {...props} productType="basic" />
);

export default BasicCompleteAS;
