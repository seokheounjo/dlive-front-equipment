/**
 * LGU+ 재판매/댁내이전 장비정보
 */
import React from 'react';
import EquipmentInternalMoveForm from '../shared/EquipmentInternalMoveForm';
import { EquipmentComponentProps } from '../shared/types';

const LguplusEquipmentInternalMove: React.FC<EquipmentComponentProps> = (props) => (
  <EquipmentInternalMoveForm {...props} productType="lguplus" />
);

export default LguplusEquipmentInternalMove;
