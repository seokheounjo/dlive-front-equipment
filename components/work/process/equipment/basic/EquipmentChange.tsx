/**
 * 딜라이브 일반/상품변경 장비정보
 */
import React from 'react';
import EquipmentChangeForm from '../shared/EquipmentChangeForm';
import { EquipmentComponentProps } from '../shared/types';

const BasicEquipmentChange: React.FC<EquipmentComponentProps> = (props) => (
  <EquipmentChangeForm {...props} productType="basic" />
);

export default BasicEquipmentChange;
