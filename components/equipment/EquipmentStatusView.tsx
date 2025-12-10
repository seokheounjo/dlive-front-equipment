import React, { useState } from 'react';
import { getEquipmentHistoryInfo } from '../../services/apiService';

interface EquipmentStatusViewProps {
  onBack: () => void;
}

// Dataset: ds_request
interface EqtRequest {
  SO_ID: string;
  EQT_NO: string;
  EQT_SERNO: string;
  ITEM_MID_CD: string;
  EQT_CL_CD: string;
  EQT_UNI_ID: string;
  COLUMN_ID: string;
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

const EquipmentStatusView: React.FC<EquipmentStatusViewProps> = ({ onBack }) => {
  const [eqtSerno, setEqtSerno] = useState('');
  const [eqtMac, setEqtMac] = useState('');
  const [equipmentInfo, setEquipmentInfo] = useState<EquipmentInfo | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSearch = async () => {
    // 입력 검증
    if (!eqtSerno && !eqtMac) {
      setError('장비 S/N 또는 MAC 주소를 입력해주세요.');
      return;
    }

    setIsLoading(true);
    setError(null);
    setEquipmentInfo(null);

    try {
      console.log('🔍 장비 상태 조회 시작:', { EQT_SERNO: eqtSerno, MAC_ADDRESS: eqtMac });

      const result = await getEquipmentHistoryInfo({
        EQT_SERNO: eqtSerno || undefined,
        MAC_ADDRESS: eqtMac || undefined
      });

      console.log('✅ 장비 조회 결과:', result);

      if (result && result.length > 0) {
        setEquipmentInfo(result[0]);
        console.log('✅ 장비 정보 설정 완료:', result[0]);
      } else {
        setError('조회된 장비 정보가 없습니다. S/N 또는 MAC 주소를 확인해주세요.');
      }
    } catch (err: any) {
      console.error('❌ 장비 조회 실패:', err);
      setError(err.message || '장비 조회에 실패했습니다. 다시 시도해주세요.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleClearSn = () => {
    setEqtSerno('');
  };

  const handleClearMac = () => {
    setEqtMac('');
  };

  return (
    <div>
      <div className="mb-3">
        <h2 className="text-lg font-bold text-gray-900">장비조회(개별)</h2>
      </div>

      {/* 검색 영역 */}
      <div className="mb-3 bg-white rounded-lg shadow-sm border border-gray-200 p-3">
        <div className="space-y-2">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">장비S/N</label>
            <div className="flex gap-2">
              <input
                type="text"
                value={eqtSerno}
                onChange={(e) => setEqtSerno(e.target.value.toUpperCase())}
                className="flex-1 px-2 py-1.5 text-sm border border-gray-300 rounded uppercase"
                placeholder="시리얼 번호 입력"
              />
              <button
                onClick={handleClearSn}
                className="px-3 py-1.5 text-sm border border-gray-300 rounded bg-white hover:bg-gray-50"
              >
                지움
              </button>
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">MAC</label>
            <div className="flex gap-2">
              <input
                type="text"
                value={eqtMac}
                onChange={(e) => setEqtMac(e.target.value.toUpperCase())}
                className="flex-1 px-2 py-1.5 text-sm border border-gray-300 rounded uppercase"
                placeholder="MAC Address"
              />
              <button
                onClick={handleClearMac}
                className="px-3 py-1.5 text-sm border border-gray-300 rounded bg-white hover:bg-gray-50"
              >
                지움
              </button>
            </div>
          </div>
          <button
            onClick={handleSearch}
            disabled={isLoading}
            className="w-full bg-orange-500 hover:bg-orange-600 text-white py-2 rounded font-medium text-sm shadow-md transition-all disabled:bg-gray-400 disabled:cursor-not-allowed"
          >
            {isLoading ? '조회 중...' : '조회'}
          </button>
        </div>
      </div>

      {/* 에러 메시지 */}
      {error && (
        <div className="mb-3 bg-red-50 border border-red-200 rounded-lg p-3">
          <p className="text-sm text-red-600">{error}</p>
        </div>
      )}

      {/* 로딩 상태 */}
      {isLoading && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex flex-col items-center justify-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500 mb-3"></div>
            <p className="text-center text-gray-500 text-sm">장비 정보를 조회하고 있습니다...</p>
          </div>
        </div>
      )}

      {/* 장비 정보 */}
      {!isLoading && equipmentInfo ? (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-3 space-y-2">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">지점명</label>
            <input
              type="text"
              value={equipmentInfo.SO_NM || ''}
              readOnly
              className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded bg-gray-50"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">장비모델명</label>
            <input
              type="text"
              value={equipmentInfo.ITEM_NM || ''}
              readOnly
              className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded bg-gray-50"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">제조사명</label>
            <input
              type="text"
              value={equipmentInfo.MAKER || ''}
              readOnly
              className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded bg-gray-50"
            />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">장비유형</label>
              <input
                type="text"
                value={equipmentInfo.EQT_CL_NM || ''}
                readOnly
                className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded bg-gray-50"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">구매구분</label>
              <input
                type="text"
                value={equipmentInfo.PRCHS_CL_NM || ''}
                readOnly
                className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded bg-gray-50"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">장비위치유형</label>
              <input
                type="text"
                value={equipmentInfo.EQT_LOC_TP_CD_NM || ''}
                readOnly
                className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded bg-gray-50"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">최초입고일</label>
              <input
                type="text"
                value={equipmentInfo.FIRST_IN_DT || ''}
                readOnly
                className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded bg-gray-50"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">장비상태</label>
              <input
                type="text"
                value={equipmentInfo.EQT_STAT_CD_NM || ''}
                readOnly
                className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded bg-gray-50"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">사용가능여부</label>
              <input
                type="text"
                value={equipmentInfo.EQT_USE_ARR_YN_NM || ''}
                readOnly
                className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded bg-gray-50"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">IRD_SN</label>
              <input
                type="text"
                value={equipmentInfo.IRD_SN || ''}
                readOnly
                className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded bg-gray-50"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">TA_MAC</label>
              <input
                type="text"
                value={equipmentInfo.MAC_ADDRESS || ''}
                readOnly
                className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded bg-gray-50"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">MACAddress</label>
            <input
              type="text"
              value={equipmentInfo.MAC_ADDRESS || ''}
              readOnly
              className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded bg-gray-50"
            />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">STB_RTCA_ID</label>
              <input
                type="text"
                value={equipmentInfo.STB_RTCA_ID || ''}
                readOnly
                className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded bg-gray-50"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Internal Mac</label>
              <input
                type="text"
                value={equipmentInfo.STB_INTERNAL_MAC_ADDR || ''}
                readOnly
                className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded bg-gray-50"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">STB_CMMAC</label>
            <input
              type="text"
              value={equipmentInfo.STB_CM_MAC_ADDR || ''}
              readOnly
              className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded bg-gray-50"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">변경종류</label>
            <input
              type="text"
              value={equipmentInfo.CHG_KND_CD || ''}
              readOnly
              className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded bg-gray-50"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">현재위치</label>
            <input
              type="text"
              value={equipmentInfo.EQT_LOC_NM || ''}
              readOnly
              className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded bg-gray-50"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">이동전위치</label>
            <input
              type="text"
              value={equipmentInfo.OLD_EQT_LOC_NM || ''}
              readOnly
              className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded bg-gray-50"
            />
          </div>
        </div>
      ) : !isLoading && !error && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <p className="text-center text-gray-500 text-sm">조회 버튼을 눌러 장비를 조회하세요</p>
        </div>
      )}
    </div>
  );
};

export default EquipmentStatusView;
