/**
 * LGU+ 재판매/부가상품 장비정보
 */
import React from 'react';
import EquipmentRemovalForm from '../shared/EquipmentRemovalForm';
import { EquipmentComponentProps } from '../shared/types';

const LguplusEquipmentRemoval: React.FC<EquipmentComponentProps> = (props) => (
  <EquipmentRemovalForm {...props} productType="lguplus" />
);

export default LguplusEquipmentRemoval;
