/**
 * LGU+ 재판매/철거 장비정보
 */
import React from 'react';
import EquipmentTerminateForm from '../shared/EquipmentTerminateForm';
import { EquipmentComponentProps } from '../shared/types';

const LguplusEquipmentTerminate: React.FC<EquipmentComponentProps> = (props) => (
  <EquipmentTerminateForm {...props} productType="lguplus" />
);

export default LguplusEquipmentTerminate;
