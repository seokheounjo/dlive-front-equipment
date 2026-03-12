/**
 * FTTH 인증상품/정지 장비정보
 */
import React from 'react';
import EquipmentSuspendForm from '../shared/EquipmentSuspendForm';
import { EquipmentComponentProps } from '../shared/types';

const FtthEquipmentSuspend: React.FC<EquipmentComponentProps> = (props) => (
  <EquipmentSuspendForm {...props} productType="ftth" />
);

export default FtthEquipmentSuspend;
