/**
 * FTTH 인증상품/부가상품 장비정보
 */
import React from 'react';
import EquipmentRemovalForm from '../shared/EquipmentRemovalForm';
import { EquipmentComponentProps } from '../shared/types';

const FtthEquipmentRemoval: React.FC<EquipmentComponentProps> = (props) => (
  <EquipmentRemovalForm {...props} productType="ftth" />
);

export default FtthEquipmentRemoval;
