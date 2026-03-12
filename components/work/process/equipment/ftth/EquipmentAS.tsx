/**
 * FTTH 인증상품/A/S 장비정보
 */
import React from 'react';
import EquipmentASForm from '../shared/EquipmentASForm';
import { EquipmentComponentProps } from '../shared/types';

const FtthEquipmentAS: React.FC<EquipmentComponentProps> = (props) => (
  <EquipmentASForm {...props} productType="ftth" />
);

export default FtthEquipmentAS;
