/**
 * LGU+ 재판매/A/S 장비정보
 */
import React from 'react';
import EquipmentASForm from '../shared/EquipmentASForm';
import { EquipmentComponentProps } from '../shared/types';

const LguplusEquipmentAS: React.FC<EquipmentComponentProps> = (props) => (
  <EquipmentASForm {...props} productType="lguplus" />
);

export default LguplusEquipmentAS;
