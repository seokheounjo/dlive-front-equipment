/**
 * basic/CompleteInstall - 딜라이브 일반 설치(WRK_CD=01) 작업완료
 *
 * 특징:
 * - SMR03/STB_CRT/SMR60 신호 전송
 * - UPLS/CL-04 없음
 */
import React from 'react';
import CompleteInstallForm from '../shared/CompleteInstallForm';
import { CompleteComponentProps } from '../shared/types';

const BasicCompleteInstall: React.FC<CompleteComponentProps> = (props) => (
  <CompleteInstallForm {...props} productType="basic" />
);

export default BasicCompleteInstall;
