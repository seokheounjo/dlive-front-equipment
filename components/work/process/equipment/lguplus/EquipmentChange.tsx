/**
 * LGU+ 재판매/상품변경 장비정보
 */
import React from 'react';
import EquipmentChangeForm from '../shared/EquipmentChangeForm';
import { EquipmentComponentProps } from '../shared/types';

const LguplusEquipmentChange: React.FC<EquipmentComponentProps> = (props) => (
  <EquipmentChangeForm {...props} productType="lguplus" />
);

export default LguplusEquipmentChange;
