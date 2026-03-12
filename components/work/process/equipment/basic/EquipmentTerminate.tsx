/**
 * 딜라이브 일반/철거 장비정보
 */
import React from 'react';
import EquipmentTerminateForm from '../shared/EquipmentTerminateForm';
import { EquipmentComponentProps } from '../shared/types';

const BasicEquipmentTerminate: React.FC<EquipmentComponentProps> = (props) => (
  <EquipmentTerminateForm {...props} productType="basic" />
);

export default BasicEquipmentTerminate;
