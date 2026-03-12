/**
 * LGU+ 재판매/이전설치 장비정보
 */
import React from 'react';
import EquipmentRelocateForm from '../shared/EquipmentRelocateForm';
import { EquipmentComponentProps } from '../shared/types';

const LguplusEquipmentRelocate: React.FC<EquipmentComponentProps> = (props) => (
  <EquipmentRelocateForm {...props} productType="lguplus" />
);

export default LguplusEquipmentRelocate;
