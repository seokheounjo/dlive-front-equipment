/**
 * LGU+ 재판매/이전철거 장비정보
 */
import React from 'react';
import EquipmentRelocateTerminateForm from '../shared/EquipmentRelocateTerminateForm';
import { EquipmentComponentProps } from '../shared/types';

const LguplusEquipmentRelocateTerminate: React.FC<EquipmentComponentProps> = (props) => (
  <EquipmentRelocateTerminateForm {...props} productType="lguplus" />
);

export default LguplusEquipmentRelocateTerminate;
