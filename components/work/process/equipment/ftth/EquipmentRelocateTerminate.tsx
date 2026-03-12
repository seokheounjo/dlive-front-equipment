/**
 * FTTH 인증상품/이전철거 장비정보
 */
import React from 'react';
import EquipmentRelocateTerminateForm from '../shared/EquipmentRelocateTerminateForm';
import { EquipmentComponentProps } from '../shared/types';

const FtthEquipmentRelocateTerminate: React.FC<EquipmentComponentProps> = (props) => (
  <EquipmentRelocateTerminateForm {...props} productType="ftth" />
);

export default FtthEquipmentRelocateTerminate;
