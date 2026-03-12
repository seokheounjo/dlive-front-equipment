/**
 * 딜라이브 일반/댁내이전 장비정보
 */
import React from 'react';
import EquipmentInternalMoveForm from '../shared/EquipmentInternalMoveForm';
import { EquipmentComponentProps } from '../shared/types';

const BasicEquipmentInternalMove: React.FC<EquipmentComponentProps> = (props) => (
  <EquipmentInternalMoveForm {...props} productType="basic" />
);

export default BasicEquipmentInternalMove;
