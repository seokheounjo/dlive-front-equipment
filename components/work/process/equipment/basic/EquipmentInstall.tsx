/**
 * 딜라이브 일반/설치 장비정보
 */
import React from 'react';
import EquipmentInstallForm from '../shared/EquipmentInstallForm';
import { EquipmentComponentProps } from '../shared/types';

const BasicEquipmentInstall: React.FC<EquipmentComponentProps> = (props) => (
  <EquipmentInstallForm {...props} productType="basic" />
);

export default BasicEquipmentInstall;
