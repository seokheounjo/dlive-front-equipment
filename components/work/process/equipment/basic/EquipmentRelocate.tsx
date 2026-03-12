/**
 * 딜라이브 일반/이전설치 장비정보
 */
import React from 'react';
import EquipmentRelocateForm from '../shared/EquipmentRelocateForm';
import { EquipmentComponentProps } from '../shared/types';

const BasicEquipmentRelocate: React.FC<EquipmentComponentProps> = (props) => (
  <EquipmentRelocateForm {...props} productType="basic" />
);

export default BasicEquipmentRelocate;
