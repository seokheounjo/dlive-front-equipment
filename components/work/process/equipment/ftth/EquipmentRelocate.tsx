/**
 * FTTH 인증상품/이전설치 장비정보
 */
import React from 'react';
import EquipmentRelocateForm from '../shared/EquipmentRelocateForm';
import { EquipmentComponentProps } from '../shared/types';

const FtthEquipmentRelocate: React.FC<EquipmentComponentProps> = (props) => (
  <EquipmentRelocateForm {...props} productType="ftth" />
);

export default FtthEquipmentRelocate;
