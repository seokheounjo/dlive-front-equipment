import React, { useState, useEffect } from 'react';
import { getEquipmentHistoryInfo } from '../../services/apiService';
import BaseModal from '../common/BaseModal';

interface EquipmentStatusModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialEqtSerno?: string;
  initialMacAddress?: string;
}

// Dataset: ds_equipmentinfo (75+ fields from legacy)
interface EquipmentInfo {
  BAR_CD: string;
  CCU_NO: string;
  CHG_DATE: string;
  CHG_KND_CD: string;
  CHG_UID: string;
  CMIS_DATE: string;
  CMIS_REG_FLG: string;
  CMIS_REG_UID: string;
  CRR_ID: string;
  CRR_NM: string;
  CTRT_ID: string;
  CUST_ID: string;
  CUST_NM: string;
  EQT_CL_CD: string;
  EQT_CL_NM: string;
  EQT_LOC_TP_CD: string;
  EQT_LOC_TP_CD_NM: string;
  EQT_LOC_NM: string;
  EQT_NO: string;
  EQT_SERNO: string;
  EQT_STAT_CD: string;
  EQT_STAT_CD_NM: string;
  EQT_TP_CD: string;
  EQT_TP_CD_NM: string;
  EQT_UNI_ID: string;
  EQT_USE_ARR_YN: string;
  EQT_USE_ARR_YN_NM: string;
  EQT_USE_END_DT: string;
  EQT_USE_STAT_CD: string;
  EQT_USE_STAT_CD_NM: string;
  FIRST_IN_DT: string;
  IN_GRP_NO: string;
  IRD_SN: string;
  ITEM_CD: string;
  ITEM_NM: string;
  MAC_ADDRESS: string;
  MAKER: string;
  MNFCT_DT: string;
  MST_SO_ID: string;
  MST_SO_NM: string;
  OBS_RCPT_CD: string;
  OBS_RCPT_CD_NM: string;
  OBS_RCPT_DTL_CD: string;
  OBS_RCPT_DTL_CD_NM: string;
  OLD_CRR_ID: string;
  OLD_CRR_NM: string;
  OLD_CUST_ID: string;
  OLD_EQT_LOC_TP_CD: string;
  OLD_EQT_LOC_TP_CD_NM: string;
  OLD_EQT_LOC_NM: string;
  OLD_MST_SO_ID: string;
  OLD_MST_SO_NM: string;
  OLD_SO_ID: string;
  OLD_SO_NM: string;
  OLD_WRKR_ID: string;
  OLD_WRKR_NM: string;
  OUT_REQ_NO: string;
  OWNER_TP_CD: string;
  OWNER_TP_CD_NM: string;
  PRCHS_CL: string;
  PRCHS_CL_NM: string;
  PRCHS_UT_PRC: number;
  REG_DATE: string;
  REG_UID: string;
  RETN_RESN_CD: string;
  RETN_RESN_CD_NM: string;
  SO_ID: string;
  SO_NM: string;
  STB_CARTON_NO: string;
  STB_CM_MAC_ADDR: string;
  STB_INTERNAL_MAC_ADDR: string;
  STB_RTCA_ID: string;
  WRK_ID: string;
  WRKR_ID: string;
  WRKR_NM: string;
}

/**
 * 장비 상태값 조회 모달 (공통 컴포넌트)
 * - 하나의 장비에 대해서 장비원장 기준 상태값을 조회
 * - 장비가 조회되는 모든 화면에서 공통으로 사용
 */
const EquipmentStatusModal: React.FC<EquipmentStatusModalProps> = ({
  isOpen,
  onClose,
  initialEqtSerno = '',
  initialMacAddress = ''
}) => {
  const [eqtSerno, setEqtSerno] = useState(initialEqtSerno);
  const [macAddress, setMacAddress] = useState(initialMacAddress);
  const [equipmentInfo, setEquipmentInfo] = useState<EquipmentInfo | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 초기값이 변경되면 상태 업데이트
  useEffect(() => {
    if (isOpen) {
      setEqtSerno(initialEqtSerno);
      setMacAddress(initialMacAddress);
      // 초기값이 있으면 자동 조회
      if (initialEqtSerno || initialMacAddress) {
        handleSearch(initialEqtSerno, initialMacAddress);
      }
    }
  }, [isOpen, initialEqtSerno, initialMacAddress]);

  const handleSearch = async (serno?: string, mac?: string) => {
    const searchSerno = serno ?? eqtSerno;
    const searchMac = mac ?? macAddress;

    if (!searchSerno && !searchMac) {
      setError('장비 S/N 또는 MAC 주소를 입력해주세요.');
      return;
    }

    setIsLoading(true);
    setError(null);
    setEquipmentInfo(null);

    try {
      console.log('🔍 [장비상태조회] 시작:', { EQT_SERNO: searchSerno, MAC_ADDRESS: searchMac });

      const result = await getEquipmentHistoryInfo({
        EQT_SERNO: searchSerno || undefined,
        MAC_ADDRESS: searchMac || undefined
      });

      console.log('✅ [장비상태조회] 결과:', result);

      if (result && result.length > 0) {
        setEquipmentInfo(result[0]);
      } else {
        setError('조회된 장비 정보가 없습니다. S/N 또는 MAC 주소를 확인해주세요.');
      }
    } catch (err: any) {
      console.error('❌ [장비상태조회] 실패:', err);
      setError(err.message || '장비 조회에 실패했습니다. 다시 시도해주세요.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleClose = () => {
    setEqtSerno('');
    setMacAddress('');
    setEquipmentInfo(null);
    setError(null);
    onClose();
  };

  // 정보 필드 렌더링 헬퍼
  const InfoField: React.FC<{ label: string; value: string | number | undefined }> = ({ label, value }) => (
    <div className="grid grid-cols-3 gap-1 py-1 border-b border-gray-100">
      <span className="text-xs text-gray-500">{label}</span>
      <span className="col-span-2 text-xs text-gray-900 font-medium truncate">{value || '-'}</span>
    </div>
  );

  return (
    <BaseModal
      isOpen={isOpen}
      onClose={handleClose}
      title="장비조회"
      size="lg"
    >
      <div className="space-y-4">
        {/* 검색 영역 */}
        <div className="bg-gray-50 rounded-lg p-3">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">장비S/N</label>
              <input
                type="text"
                value={eqtSerno}
                onChange={(e) => setEqtSerno(e.target.value.toUpperCase())}
                className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded uppercase"
                placeholder="시리얼 번호"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">MAC</label>
              <input
                type="text"
                value={macAddress}
                onChange={(e) => setMacAddress(e.target.value.toUpperCase())}
                className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded uppercase"
                placeholder="MAC Address"
              />
            </div>
          </div>
          <button
            onClick={() => handleSearch()}
            disabled={isLoading}
            className="w-full mt-2 bg-orange-500 hover:bg-orange-600 disabled:bg-gray-400 text-white py-2 rounded font-medium text-sm"
          >
            {isLoading ? '조회 중...' : '조회'}
          </button>
        </div>

        {/* 에러 메시지 */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-3">
            <p className="text-xs text-red-600">{error}</p>
          </div>
        )}

        {/* 로딩 상태 */}
        {isLoading && (
          <div className="flex flex-col items-center justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500 mb-2"></div>
            <p className="text-sm text-gray-500">장비 정보를 조회하고 있습니다...</p>
          </div>
        )}

        {/* 장비 정보 */}
        {!isLoading && equipmentInfo && (
          <div className="max-h-80 overflow-y-auto">
            <div className="space-y-1">
              <InfoField label="지점명" value={equipmentInfo.SO_NM} />
              <InfoField label="장비모델명" value={equipmentInfo.ITEM_NM} />
              <InfoField label="제조사명" value={equipmentInfo.MAKER} />
              <InfoField label="소유구분" value={equipmentInfo.OWNER_TP_CD_NM} />
              <InfoField label="장비유형" value={equipmentInfo.EQT_CL_NM} />
              <InfoField label="장비위치" value={equipmentInfo.EQT_LOC_NM} />
              <InfoField label="고객/계약ID" value={`${equipmentInfo.CUST_ID || ''} / ${equipmentInfo.CTRT_ID || ''}`} />
              <InfoField label="최초입고일" value={equipmentInfo.FIRST_IN_DT} />
              <InfoField label="구분" value={equipmentInfo.PRCHS_CL_NM} />
              <InfoField label="장비상태" value={equipmentInfo.EQT_STAT_CD_NM} />
              <InfoField label="IRD_SN" value={equipmentInfo.IRD_SN} />
              <InfoField label="TA_MAC" value={equipmentInfo.MAC_ADDRESS} />
              <InfoField label="사용가능여부" value={equipmentInfo.EQT_USE_ARR_YN_NM} />
              <InfoField label="사용가능일" value={equipmentInfo.EQT_USE_END_DT} />
              <InfoField label="이전위치" value={equipmentInfo.OLD_EQT_LOC_NM} />
              <InfoField label="STB_RTCA_ID" value={equipmentInfo.STB_RTCA_ID} />
              <InfoField label="Internal Mac" value={equipmentInfo.STB_INTERNAL_MAC_ADDR} />
              <InfoField label="STB_CMMAC" value={equipmentInfo.STB_CM_MAC_ADDR} />
              <InfoField label="변경종류" value={equipmentInfo.CHG_KND_CD} />
              <InfoField label="현재위치" value={equipmentInfo.EQT_LOC_NM} />
              <InfoField label="이동전위치" value={equipmentInfo.OLD_EQT_LOC_NM} />
            </div>
          </div>
        )}

        {/* 닫기 버튼 */}
        <div className="flex justify-end">
          <button
            onClick={handleClose}
            className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded font-medium text-sm"
          >
            닫기
          </button>
        </div>
      </div>
    </BaseModal>
  );
};

export default EquipmentStatusModal;
