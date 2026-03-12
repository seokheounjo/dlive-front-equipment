/**
 * 딜라이브 일반/댁내이전(06) 작업완료
 */
import React from 'react';
import CompleteInternalMoveForm from '../shared/CompleteInternalMoveForm';
import { CompleteComponentProps } from '../shared/types';

const BasicCompleteInternalMove: React.FC<CompleteComponentProps> = (props) => (
  <CompleteInternalMoveForm {...props} productType="basic" />
);

export default BasicCompleteInternalMove;
