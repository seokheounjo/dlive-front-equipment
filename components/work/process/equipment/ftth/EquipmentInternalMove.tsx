/**
 * FTTH 인증상품/댁내이전 장비정보
 */
import React from 'react';
import EquipmentInternalMoveForm from '../shared/EquipmentInternalMoveForm';
import { EquipmentComponentProps } from '../shared/types';

const FtthEquipmentInternalMove: React.FC<EquipmentComponentProps> = (props) => (
  <EquipmentInternalMoveForm {...props} productType="ftth" />
);

export default FtthEquipmentInternalMove;
