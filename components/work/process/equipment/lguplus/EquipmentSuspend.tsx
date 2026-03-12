/**
 * LGU+ 재판매/정지 장비정보
 */
import React from 'react';
import EquipmentSuspendForm from '../shared/EquipmentSuspendForm';
import { EquipmentComponentProps } from '../shared/types';

const LguplusEquipmentSuspend: React.FC<EquipmentComponentProps> = (props) => (
  <EquipmentSuspendForm {...props} productType="lguplus" />
);

export default LguplusEquipmentSuspend;
