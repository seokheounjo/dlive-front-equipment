/**
 * 딜라이브 일반/이전설치(07) 작업완료
 */
import React from 'react';
import CompleteRelocateForm from '../shared/CompleteRelocateForm';
import { CompleteComponentProps } from '../shared/types';

const BasicCompleteRelocate: React.FC<CompleteComponentProps> = (props) => (
  <CompleteRelocateForm {...props} productType="basic" />
);

export default BasicCompleteRelocate;
