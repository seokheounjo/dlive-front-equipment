/**
 * FTTH 인증상품/철거 장비정보
 */
import React from 'react';
import EquipmentTerminateForm from '../shared/EquipmentTerminateForm';
import { EquipmentComponentProps } from '../shared/types';

const FtthEquipmentTerminate: React.FC<EquipmentComponentProps> = (props) => (
  <EquipmentTerminateForm {...props} productType="ftth" />
);

export default FtthEquipmentTerminate;
