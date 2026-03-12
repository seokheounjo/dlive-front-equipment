/**
 * 딜라이브 일반/정지 장비정보
 */
import React from 'react';
import EquipmentSuspendForm from '../shared/EquipmentSuspendForm';
import { EquipmentComponentProps } from '../shared/types';

const BasicEquipmentSuspend: React.FC<EquipmentComponentProps> = (props) => (
  <EquipmentSuspendForm {...props} productType="basic" />
);

export default BasicEquipmentSuspend;
