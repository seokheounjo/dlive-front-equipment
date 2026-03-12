/**
 * 딜라이브 일반/A/S 장비정보
 */
import React from 'react';
import EquipmentASForm from '../shared/EquipmentASForm';
import { EquipmentComponentProps } from '../shared/types';

const BasicEquipmentAS: React.FC<EquipmentComponentProps> = (props) => (
  <EquipmentASForm {...props} productType="basic" />
);

export default BasicEquipmentAS;
