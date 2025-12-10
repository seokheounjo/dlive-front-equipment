import React, { useState, useEffect } from 'react';
import '../../styles/buttons.css';
import {
  getEquipmentOutList,
  checkEquipmentProc,
  addEquipmentQuota
} from '../../services/apiService';

interface EquipmentAssignmentProps {
  onBack: () => void;
}

// Dataset: ds_eqt_out_search
interface EqtOutSearch {
  OUT_REQ_NO: string;
  FROM_OUT_REQ_DT: string;
  TO_OUT_REQ_DT: string;
  OUT_EQT_TP: string;
  OUT_TP: string;
  PROC_STAT: string;
  SO_ID: string;
  MST_SO_ID: string;
  MST_SO_NM: string;
  CRR_ID: string;
  CRR_NM: string;
  OUT_REQ_UID: string;
  OUT_REQ_UID_NM: string;
}

// Dataset: ds_eqt_out
interface EqtOut {
  OUT_REQ_NO: string;
  MST_SO_ID: string;
  MST_SO_NM: string;
  SO_ID: string;
  SO_NM: string;
  CRR_ID: string;
  CRR_NM: string;
  OUT_TP: string;
  OUT_REQ_DT: string;
  OUT_REQ_DT_FORMAT: string;
  OUT_REQ_UID: string;
  OUT_REQ_UID_NM: string;
  OUT_CHRG_UID: string;
  OUT_CHRG_UID_NM: string;
  OUT_DTTM: string;
  OUT_REQ_RMRK: string;
  PROC_STAT: string;
  PROC_STAT_NM: string;
  REG_UID: string;
  CHG_UID: string;
}

// Dataset: ds_out_tgt_eqt
interface OutTgtEqt {
  OUT_REQ_NO: string;
  ITEM_MAX_CD: string;
  ITEM_MAX_CD_NM: string;
  ITEM_MID_CD: string;
  ITEM_MID_CD_NM: string;
  EQT_CL_CD: string;
  EQT_CL_NM: string;
  OUT_REQ_QTY: number;
  OUT_QTY: number;
  IBGO_QTY: number;
  EQT_NO: string;
  EQT_SERNO: string;
  PROC_YN: string;
  EQT_CHECK: string;
  REMARK: string;
  CHK: boolean;
}

interface SoListItem {
  SO_ID: string;
  SO_NM: string;
}

const EquipmentAssignment: React.FC<EquipmentAssignmentProps> = ({ onBack }) => {
  const [searchParams, setSearchParams] = useState<EqtOutSearch>({
    OUT_REQ_NO: '',
    FROM_OUT_REQ_DT: new Date().toISOString().slice(0, 10),
    TO_OUT_REQ_DT: new Date().toISOString().slice(0, 10),
    OUT_EQT_TP: '',
    OUT_TP: '',
    PROC_STAT: '',
    SO_ID: '',
    MST_SO_ID: '',
    MST_SO_NM: '',
    CRR_ID: '',
    CRR_NM: '',
    OUT_REQ_UID: '',
    OUT_REQ_UID_NM: ''
  });

  const [eqtOutList, setEqtOutList] = useState<EqtOut[]>([]);
  const [selectedEqtOut, setSelectedEqtOut] = useState<EqtOut | null>(null);
  const [outTgtEqtList, setOutTgtEqtList] = useState<OutTgtEqt[]>([]);
  const [soList, setSoList] = useState<SoListItem[]>([]);

  const handleSearch = async () => {
    try {
      const result = await getEquipmentOutList({
        FROM_OUT_REQ_DT: searchParams.FROM_OUT_REQ_DT,
        TO_OUT_REQ_DT: searchParams.TO_OUT_REQ_DT,
        SO_ID: searchParams.SO_ID || undefined,
        OUT_REQ_NO: searchParams.OUT_REQ_NO || undefined,
        PROC_STAT: searchParams.PROC_STAT || undefined
      });
      console.log('✅ 장비할당 조회 성공:', result);
      setEqtOutList(result);
      setSelectedEqtOut(null);
      setOutTgtEqtList([]);
    } catch (error) {
      console.error('❌ 장비할당 조회 실패:', error);
      alert('장비할당 조회에 실패했습니다.');
    }
  };

  const handleEqtOutSelect = async (item: EqtOut) => {
    setSelectedEqtOut(item);
    try {
      const result = await checkEquipmentProc({
        OUT_REQ_NO: item.OUT_REQ_NO
      });
      console.log('✅ 출고 장비 조회 성공:', result);
      // result가 배열이면 그대로, output1이 있으면 output1 사용
      const equipmentList = Array.isArray(result) ? result : (result.output1 || []);
      setOutTgtEqtList(equipmentList.map((eq: any) => ({
        ...eq,
        CHK: false  // 체크박스 초기값
      })));
    } catch (error) {
      console.error('❌ 출고 장비 조회 실패:', error);
      alert('출고 장비 조회에 실패했습니다.');
      setOutTgtEqtList([]);
    }
  };

  const handleCheckAccept = async () => {
    if (!selectedEqtOut) {
      alert('출고 정보를 선택해주세요.');
      return;
    }

    const checkedItems = outTgtEqtList.filter(item => item.CHK);
    if (checkedItems.length === 0) {
      alert('입고 처리할 장비를 선택해주세요.');
      return;
    }

    try {
      await addEquipmentQuota({
        OUT_REQ_NO: selectedEqtOut.OUT_REQ_NO,
        equipmentList: checkedItems
      });
      console.log('✅ 입고처리 성공');
      alert(`${checkedItems.length}건의 장비 입고처리가 완료되었습니다.`);

      // 목록 새로고침
      await handleSearch();
    } catch (error) {
      console.error('❌ 입고처리 실패:', error);
      alert('입고처리에 실패했습니다.');
    }
  };

  const handleCheckAll = (checked: boolean) => {
    setOutTgtEqtList(outTgtEqtList.map(item => ({ ...item, CHK: checked })));
  };

  const handleCheckItem = (index: number, checked: boolean) => {
    const newList = [...outTgtEqtList];
    newList[index].CHK = checked;
    setOutTgtEqtList(newList);
  };

  const formatOutDttm = (dttm: string) => {
    // substr(OUT_DTTM,4,4) Mask="@@-@@"
    if (dttm && dttm.length >= 8) {
      const sub = dttm.substring(4, 8);
      return `${sub.substring(0, 2)}-${sub.substring(2, 4)}`;
    }
    return '';
  };

  return (
    <div>
      <div className="mb-3">
        <h2 className="text-lg font-bold text-gray-900">작업기사 장비할당확인</h2>
      </div>

      {/* 검색 영역 */}
      <div className="mb-3 bg-white rounded-lg shadow-sm border border-gray-200 p-3">
        <div className="space-y-2">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">출고일자</label>
            <div className="grid grid-cols-2 gap-2">
              <input
                type="date"
                value={searchParams.FROM_OUT_REQ_DT}
                onChange={(e) => setSearchParams({...searchParams, FROM_OUT_REQ_DT: e.target.value})}
                className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded"
                style={{ colorScheme: 'light' }}
              />
              <input
                type="date"
                value={searchParams.TO_OUT_REQ_DT}
                onChange={(e) => setSearchParams({...searchParams, TO_OUT_REQ_DT: e.target.value})}
                className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded"
                style={{ colorScheme: 'light' }}
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">지점</label>
            <select
              value={searchParams.SO_ID}
              onChange={(e) => setSearchParams({...searchParams, SO_ID: e.target.value})}
              className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded"
            >
              <option value="">선택</option>
              {soList.map((item) => (
                <option key={item.SO_ID} value={item.SO_ID}>{item.SO_NM}</option>
              ))}
            </select>
          </div>
          <button
            onClick={handleSearch}
            className="w-full bg-orange-500 hover:bg-orange-600 text-white py-2 rounded font-medium text-sm shadow-md transition-all"
          >
            조회
          </button>
        </div>
      </div>

      {/* 출고리스트 (업체->기사) */}
      {eqtOutList.length > 0 && (
        <>
          <div className="mb-3">
            <h3 className="text-sm font-semibold text-gray-700 mb-2">출고리스트(업체→기사)</h3>
          </div>
          <div className="mb-3 bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
            <div className="max-h-48 overflow-y-auto">
              <table className="w-full text-xs">
                <thead className="bg-gray-50 sticky top-0">
                  <tr>
                    <th className="px-2 py-2 text-center text-xs font-semibold text-gray-700 border-b">출고일자</th>
                    <th className="px-2 py-2 text-left text-xs font-semibold text-gray-700 border-b">협력업체</th>
                    <th className="px-2 py-2 text-center text-xs font-semibold text-gray-700 border-b">할당기사</th>
                    <th className="px-2 py-2 text-center text-xs font-semibold text-gray-700 border-b">출고담당자</th>
                    <th className="px-2 py-2 text-left text-xs font-semibold text-gray-700 border-b">계열사</th>
                    <th className="px-2 py-2 text-left text-xs font-semibold text-gray-700 border-b">지점</th>
                    <th className="px-2 py-2 text-left text-xs font-semibold text-gray-700 border-b">출고번호</th>
                  </tr>
                </thead>
                <tbody>
                  {eqtOutList.map((item, idx) => (
                    <tr
                      key={idx}
                      onClick={() => handleEqtOutSelect(item)}
                      className={`cursor-pointer hover:bg-orange-50 transition-colors ${
                        selectedEqtOut?.OUT_REQ_NO === item.OUT_REQ_NO ? 'bg-orange-100' : ''
                      }`}
                    >
                      <td className="px-2 py-2 text-xs text-center text-gray-900 border-b">{formatOutDttm(item.OUT_DTTM)}</td>
                      <td className="px-2 py-2 text-xs text-gray-900 border-b">{item.CRR_NM}</td>
                      <td className="px-2 py-2 text-xs text-center text-gray-900 border-b">{item.OUT_REQ_UID_NM}</td>
                      <td className="px-2 py-2 text-xs text-center text-gray-900 border-b">{item.OUT_CHRG_UID_NM}</td>
                      <td className="px-2 py-2 text-xs text-gray-900 border-b">{item.MST_SO_NM}</td>
                      <td className="px-2 py-2 text-xs text-gray-900 border-b">{item.SO_NM}</td>
                      <td className="px-2 py-2 text-xs text-gray-900 border-b">{item.OUT_REQ_NO}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* 선택된 출고 정보 */}
      {selectedEqtOut && (
        <div className="mb-3 bg-white rounded-lg shadow-sm border border-gray-200 p-3">
          <div className="space-y-2">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">출고번호</label>
              <input
                type="text"
                value={selectedEqtOut.OUT_REQ_NO}
                readOnly
                className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded bg-gray-50"
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">협력업체</label>
                <input
                  type="text"
                  value={selectedEqtOut.CRR_NM}
                  readOnly
                  className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded bg-gray-50"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">출고일자</label>
                <input
                  type="text"
                  value={selectedEqtOut.OUT_REQ_DT_FORMAT}
                  readOnly
                  className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded bg-gray-50"
                />
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">할당기사</label>
              <input
                type="text"
                value={selectedEqtOut.OUT_REQ_UID_NM}
                readOnly
                className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded bg-gray-50"
              />
            </div>
          </div>
        </div>
      )}

      {/* 출고리스트별 입고대상장비 */}
      {selectedEqtOut && outTgtEqtList.length > 0 && (
        <>
          <div className="mb-2">
            <h3 className="text-sm font-semibold text-gray-700">출고리스트별 입고대상장비</h3>
          </div>
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden mb-3">
            <div className="max-h-64 overflow-y-auto">
              <table className="w-full text-xs">
                <thead className="bg-gray-50 sticky top-0">
                  <tr>
                    <th className="px-2 py-2 text-center border-b">
                      <input
                        type="checkbox"
                        onChange={(e) => handleCheckAll(e.target.checked)}
                        checked={outTgtEqtList.length > 0 && outTgtEqtList.every(item => item.CHK)}
                      />
                    </th>
                    <th className="px-2 py-2 text-left text-xs font-semibold text-gray-700 border-b">장비명</th>
                    <th className="px-2 py-2 text-right text-xs font-semibold text-gray-700 border-b">수량</th>
                    <th className="px-2 py-2 text-left text-xs font-semibold text-gray-700 border-b">장비번호</th>
                    <th className="px-2 py-2 text-center text-xs font-semibold text-gray-700 border-b">확인</th>
                  </tr>
                </thead>
                <tbody>
                  {outTgtEqtList.map((item, idx) => (
                    <tr key={idx} className="hover:bg-gray-50">
                      <td className="px-2 py-2 text-center border-b">
                        <input
                          type="checkbox"
                          checked={item.CHK || false}
                          onChange={(e) => handleCheckItem(idx, e.target.checked)}
                        />
                      </td>
                      <td className="px-2 py-2 text-xs text-gray-900 border-b">{item.EQT_CL_NM}</td>
                      <td className="px-2 py-2 text-xs text-right text-gray-900 border-b">{item.OUT_QTY}</td>
                      <td className="px-2 py-2 text-xs text-gray-900 border-b">{item.EQT_SERNO}</td>
                      <td className="px-2 py-2 text-xs text-center text-gray-900 border-b">{item.EQT_CHECK}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <button
              onClick={handleCheckAccept}
              className="btn btn-success shadow-md"
            >
              입고처리
            </button>
          </div>
        </>
      )}

      {eqtOutList.length === 0 && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <p className="text-center text-gray-500 text-sm">조회 버튼을 눌러 출고 리스트를 조회하세요</p>
        </div>
      )}
    </div>
  );
};

export default EquipmentAssignment;
