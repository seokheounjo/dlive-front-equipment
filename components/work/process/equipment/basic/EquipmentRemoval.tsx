/**
 * 딜라이브 일반/부가상품 장비정보
 */
import React from 'react';
import EquipmentRemovalForm from '../shared/EquipmentRemovalForm';
import { EquipmentComponentProps } from '../shared/types';

const BasicEquipmentRemoval: React.FC<EquipmentComponentProps> = (props) => (
  <EquipmentRemovalForm {...props} productType="basic" />
);

export default BasicEquipmentRemoval;
