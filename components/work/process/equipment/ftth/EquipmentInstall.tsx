/**
 * FTTH 인증상품/설치 장비정보
 */
import React from 'react';
import EquipmentInstallForm from '../shared/EquipmentInstallForm';
import { EquipmentComponentProps } from '../shared/types';

const FtthEquipmentInstall: React.FC<EquipmentComponentProps> = (props) => (
  <EquipmentInstallForm {...props} productType="ftth" />
);

export default FtthEquipmentInstall;
