/**
 * LGU+ 재판매/설치 장비정보
 */
import React from 'react';
import EquipmentInstallForm from '../shared/EquipmentInstallForm';
import { EquipmentComponentProps } from '../shared/types';

const LguplusEquipmentInstall: React.FC<EquipmentComponentProps> = (props) => (
  <EquipmentInstallForm {...props} productType="lguplus" />
);

export default LguplusEquipmentInstall;
