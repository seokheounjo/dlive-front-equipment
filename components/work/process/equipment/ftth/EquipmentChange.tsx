/**
 * FTTH 인증상품/상품변경 장비정보
 */
import React from 'react';
import EquipmentChangeForm from '../shared/EquipmentChangeForm';
import { EquipmentComponentProps } from '../shared/types';

const FtthEquipmentChange: React.FC<EquipmentComponentProps> = (props) => (
  <EquipmentChangeForm {...props} productType="ftth" />
);

export default FtthEquipmentChange;
