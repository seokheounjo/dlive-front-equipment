/**
 * 딜라이브 일반/이전철거 장비정보
 */
import React from 'react';
import EquipmentRelocateTerminateForm from '../shared/EquipmentRelocateTerminateForm';
import { EquipmentComponentProps } from '../shared/types';

const BasicEquipmentRelocateTerminate: React.FC<EquipmentComponentProps> = (props) => (
  <EquipmentRelocateTerminateForm {...props} productType="basic" />
);

export default BasicEquipmentRelocateTerminate;
