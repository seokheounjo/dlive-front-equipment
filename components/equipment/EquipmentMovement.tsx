import React, { useState } from 'react';
import { findUserList } from '../../services/apiService';

interface EquipmentMovementProps {
  onBack: () => void;
}

// Dataset: ds_eqt_trns_search
interface EqtTrnsSearch {
  EQT_NO: string;
  MST_SO_ID: string;
  MST_SO_NM: string;
  SO_ID: string;
  CRR_ID: string;
  CRR_NM: string;
  WRKR_ID: string;
  WRKR_NM: string;
  ITEM_MID_CD: string;
  EQT_CL_CD: string;
  TRNS_STAT: string;
  EQT_SERNO: string;
}

// Dataset: ds_eqt_trns
interface EqtTrns {
  CHK: boolean;
  EQT_NO: string;
  ITEM_MAX_NM: string;
  ITEM_MID_NM: string;
  EQT_CL_CD: string;
  EQT_CL_NM: string;
  ITEM_NM: string;
  ITEM_SPEC: string;
  MST_SO_ID: string;
  MST_SO_NM: string;
  SO_ID: string;
  SO_NM: string;
  EQT_SERNO: string;
  MAC_ADDRESS: string;
  TA_MAC_ADDRESS: string;
  TRGT_WRKR_NM: string;
  REQ_DT: string;
  REQ_DT_FORMAT: string;
  PROC_STAT: string;
  PROC_STAT_NM: string;
  WRKR_NM: string;
  CRR_NM: string;
}

interface SoListItem {
  SO_ID: string;
  SO_NM: string;
}

interface CorpListItem {
  CRR_ID: string;
  CORP_NM: string;
}

interface ItemMidItem {
  COMMON_CD: string;
  COMMON_CD_NM: string;
}

interface EqtClItem {
  COMMON_CD: string;
  COMMON_CD_NM: string;
}

const EquipmentMovement: React.FC<EquipmentMovementProps> = ({ onBack }) => {
  const [searchParams, setSearchParams] = useState<EqtTrnsSearch>({
    EQT_NO: '',
    MST_SO_ID: '',
    MST_SO_NM: '',
    SO_ID: '',
    CRR_ID: '',
    CRR_NM: '',
    WRKR_ID: '',
    WRKR_NM: '',
    ITEM_MID_CD: '',
    EQT_CL_CD: '',
    TRNS_STAT: '1',
    EQT_SERNO: ''
  });

  const [eqtTrnsList, setEqtTrnsList] = useState<EqtTrns[]>([]);
  const [soList, setSoList] = useState<SoListItem[]>([]);
  const [corpList, setCorpList] = useState<CorpListItem[]>([]);
  const [itemMidList, setItemMidList] = useState<ItemMidItem[]>([]);
  const [eqtClList, setEqtClList] = useState<EqtClItem[]>([]);

  // 이관기사 정보
  const [trgtWrkrNm, setTrgtWrkrNm] = useState('');
  const [trgtWrkrId, setTrgtWrkrId] = useState('');

  const handleSearch = async () => {
    // TODO: 실제 API는 getEquipmentTransferList가 필요하지만,
    // 현재는 getWrkrHaveEqtList로 작업자의 보유 장비를 조회
    if (!searchParams.WRKR_ID) {
      alert('보유기사를 선택해주세요.');
      return;
    }

    console.log('기사간 장비이동 신청 조회:', searchParams);
    alert('장비 이동 신청 목록 조회 기능은 백엔드 API 연동 후 활성화됩니다.');
  };

  const handleWorkerSearch = async () => {
    const keyword = prompt('보유기사 이름을 입력하세요:');
    if (!keyword) return;

    try {
      const result = await findUserList({ USR_NM: keyword });
      if (result.length === 0) {
        alert('검색 결과가 없습니다.');
        return;
      }

      // 간단하게 첫 번째 결과 사용 (실제로는 모달로 선택)
      if (result.length === 1) {
        setSearchParams({
          ...searchParams,
          WRKR_ID: result[0].USR_ID,
          WRKR_NM: result[0].USR_NM
        });
      } else {
        // 여러 결과가 있으면 목록 표시
        const selected = result[0]; // 임시로 첫 번째 선택
        setSearchParams({
          ...searchParams,
          WRKR_ID: selected.USR_ID,
          WRKR_NM: selected.USR_NM
        });
        alert(`${result.length}명 중 첫 번째: ${selected.USR_NM} 선택됨`);
      }
    } catch (error) {
      console.error('❌ 보유기사 검색 실패:', error);
      alert('보유기사 검색에 실패했습니다.');
    }
  };

  const handleTrgtWorkerSearch = async () => {
    const keyword = prompt('이관기사 이름을 입력하세요:');
    if (!keyword) return;

    try {
      const result = await findUserList({ USR_NM: keyword });
      if (result.length === 0) {
        alert('검색 결과가 없습니다.');
        return;
      }

      if (result.length === 1) {
        setTrgtWrkrId(result[0].USR_ID);
        setTrgtWrkrNm(result[0].USR_NM);
      } else {
        const selected = result[0];
        setTrgtWrkrId(selected.USR_ID);
        setTrgtWrkrNm(selected.USR_NM);
        alert(`${result.length}명 중 첫 번째: ${selected.USR_NM} 선택됨`);
      }
    } catch (error) {
      console.error('❌ 이관기사 검색 실패:', error);
      alert('이관기사 검색에 실패했습니다.');
    }
  };

  const handleTransfer = async () => {
    const checkedItems = eqtTrnsList.filter(item => item.CHK);
    if (checkedItems.length === 0) {
      alert('이관할 장비를 선택해주세요.');
      return;
    }

    if (!trgtWrkrId) {
      alert('이관기사를 선택해주세요.');
      return;
    }

    if (!confirm(`${trgtWrkrNm}(${trgtWrkrId})에게 ${checkedItems.length}건의 장비를 이관하시겠습니까?`)) {
      return;
    }

    try {
      // TODO: changeEqtWrkr_3 API 호출
      console.log('✅ 장비 이관 처리:', {
        FROM_WRKR_ID: searchParams.WRKR_ID,
        TO_WRKR_ID: trgtWrkrId,
        equipmentList: checkedItems
      });
      alert(`${checkedItems.length}건의 장비 이관 신청이 완료되었습니다.`);

      // 초기화
      setEqtTrnsList([]);
      setTrgtWrkrId('');
      setTrgtWrkrNm('');
    } catch (error) {
      console.error('❌ 장비 이관 실패:', error);
      alert('장비 이관에 실패했습니다.');
    }
  };

  const handleCheckAll = (checked: boolean) => {
    setEqtTrnsList(eqtTrnsList.map(item => ({ ...item, CHK: checked })));
  };

  const handleCheckItem = (index: number, checked: boolean) => {
    const newList = [...eqtTrnsList];
    newList[index].CHK = checked;
    setEqtTrnsList(newList);
  };

  return (
    <div>
      <div className="mb-3">
        <h2 className="text-lg font-bold text-gray-900">작업기사 이관신청</h2>
      </div>

      {/* 보유기사 영역 */}
      <div className="mb-3 bg-white rounded-lg shadow-sm border border-gray-200 p-3">
        <div className="mb-2">
          <h3 className="text-sm font-semibold text-gray-700">보유기사</h3>
        </div>
        <div className="space-y-2">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">지점 <span className="text-red-500">*</span></label>
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
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">협력업체 <span className="text-red-500">*</span></label>
            <select
              value={searchParams.CRR_ID}
              onChange={(e) => setSearchParams({...searchParams, CRR_ID: e.target.value})}
              className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded"
            >
              <option value="">선택</option>
              {corpList.map((item) => (
                <option key={item.CRR_ID} value={item.CRR_ID}>{item.CORP_NM}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">장비</label>
            <div className="grid grid-cols-2 gap-2">
              <select
                value={searchParams.ITEM_MID_CD}
                onChange={(e) => setSearchParams({...searchParams, ITEM_MID_CD: e.target.value})}
                className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded"
              >
                <option value="">중분류</option>
                {itemMidList.map((item) => (
                  <option key={item.COMMON_CD} value={item.COMMON_CD}>{item.COMMON_CD_NM}</option>
                ))}
              </select>
              <select
                value={searchParams.EQT_CL_CD}
                onChange={(e) => setSearchParams({...searchParams, EQT_CL_CD: e.target.value})}
                className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded"
              >
                <option value="">장비클래스</option>
                {eqtClList.map((item) => (
                  <option key={item.COMMON_CD} value={item.COMMON_CD}>{item.COMMON_CD_NM}</option>
                ))}
              </select>
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">일련번호</label>
            <input
              type="text"
              value={searchParams.EQT_SERNO}
              onChange={(e) => setSearchParams({...searchParams, EQT_SERNO: e.target.value.toUpperCase()})}
              className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded uppercase"
              placeholder="장비 일련번호"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">보유기사 <span className="text-red-500">*</span></label>
            <div className="flex gap-2">
              <input
                type="text"
                value={searchParams.WRKR_NM}
                readOnly
                className="flex-1 px-2 py-1.5 text-sm border border-gray-300 rounded bg-gray-50"
                placeholder="기사명"
              />
              <button
                onClick={handleWorkerSearch}
                className="px-3 py-1.5 text-sm border border-gray-300 rounded bg-white hover:bg-gray-50"
              >
                🔍
              </button>
              <input
                type="text"
                value={searchParams.WRKR_ID}
                readOnly
                className="w-24 px-2 py-1.5 text-sm border border-gray-300 rounded bg-gray-50"
                placeholder="ID"
              />
            </div>
          </div>
          <button
            onClick={handleSearch}
            className="w-full bg-orange-500 hover:bg-orange-600 text-white py-2 rounded font-medium text-sm shadow-md transition-all"
          >
            조회
          </button>
        </div>
      </div>

      {/* 이관기사 영역 */}
      <div className="mb-3 bg-white rounded-lg shadow-sm border border-gray-200 p-3">
        <div className="mb-2">
          <h3 className="text-sm font-semibold text-gray-700">이관기사</h3>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">이관기사 <span className="text-red-500">*</span></label>
          <div className="flex gap-2">
            <input
              type="text"
              value={trgtWrkrNm}
              readOnly
              className="flex-1 px-2 py-1.5 text-sm border border-gray-300 rounded bg-gray-50"
              placeholder="기사명"
            />
            <button
              onClick={handleTrgtWorkerSearch}
              className="px-3 py-1.5 text-sm border border-gray-300 rounded bg-white hover:bg-gray-50"
            >
              🔍
            </button>
            <input
              type="text"
              value={trgtWrkrId}
              readOnly
              className="w-24 px-2 py-1.5 text-sm border border-gray-300 rounded bg-gray-50"
              placeholder="ID"
            />
          </div>
        </div>
      </div>

      {/* 장비 목록 */}
      {eqtTrnsList.length > 0 ? (
        <>
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden mb-3">
            <div className="max-h-96 overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="bg-gray-50 sticky top-0">
                  <tr>
                    <th className="px-2 py-2 border-b">
                      <input
                        type="checkbox"
                        onChange={(e) => handleCheckAll(e.target.checked)}
                        checked={eqtTrnsList.every(item => item.CHK)}
                      />
                    </th>
                    <th className="px-2 py-2 text-left text-xs font-semibold text-gray-700 border-b">일련번호</th>
                    <th className="px-2 py-2 text-left text-xs font-semibold text-gray-700 border-b">유형</th>
                    <th className="px-2 py-2 text-left text-xs font-semibold text-gray-700 border-b">중분류</th>
                    <th className="px-2 py-2 text-left text-xs font-semibold text-gray-700 border-b">고유ID</th>
                    <th className="px-2 py-2 text-left text-xs font-semibold text-gray-700 border-b">협력</th>
                    <th className="px-2 py-2 text-left text-xs font-semibold text-gray-700 border-b">기사</th>
                    <th className="px-2 py-2 text-left text-xs font-semibold text-gray-700 border-b">MAC</th>
                    <th className="px-2 py-2 text-left text-xs font-semibold text-gray-700 border-b">TA_MAC</th>
                    <th className="px-2 py-2 text-left text-xs font-semibold text-gray-700 border-b">대분류</th>
                    <th className="px-2 py-2 text-left text-xs font-semibold text-gray-700 border-b">지점</th>
                  </tr>
                </thead>
                <tbody>
                  {eqtTrnsList.map((item, idx) => (
                    <tr key={idx} className="hover:bg-gray-50">
                      <td className="px-2 py-2 border-b text-center">
                        <input
                          type="checkbox"
                          checked={item.CHK || false}
                          onChange={(e) => handleCheckItem(idx, e.target.checked)}
                        />
                      </td>
                      <td className="px-2 py-2 text-xs text-gray-900 border-b">{item.EQT_SERNO}</td>
                      <td className="px-2 py-2 text-xs text-gray-900 border-b">{item.EQT_CL_NM}</td>
                      <td className="px-2 py-2 text-xs text-gray-900 border-b">{item.ITEM_MID_NM}</td>
                      <td className="px-2 py-2 text-xs text-gray-900 border-b">
                        <input
                          type="text"
                          value={item.EQT_NO}
                          onChange={(e) => {
                            const newList = [...eqtTrnsList];
                            newList[idx].EQT_NO = e.target.value;
                            setEqtTrnsList(newList);
                          }}
                          className="w-full px-1 py-0.5 text-xs border border-gray-300 rounded"
                        />
                      </td>
                      <td className="px-2 py-2 text-xs text-gray-900 border-b">{item.CRR_NM}</td>
                      <td className="px-2 py-2 text-xs text-gray-900 border-b">{item.WRKR_NM}</td>
                      <td className="px-2 py-2 text-xs text-gray-900 border-b">{item.MAC_ADDRESS}</td>
                      <td className="px-2 py-2 text-xs text-gray-900 border-b">{item.TA_MAC_ADDRESS}</td>
                      <td className="px-2 py-2 text-xs text-gray-900 border-b">{item.ITEM_MAX_NM}</td>
                      <td className="px-2 py-2 text-xs text-gray-900 border-b">{item.SO_NM}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          <div className="flex justify-end">
            <button
              onClick={handleTransfer}
              className="bg-green-600 hover:bg-green-700 text-white py-2 px-6 rounded font-medium text-sm shadow-md transition-all"
            >
              장비인수
            </button>
          </div>
        </>
      ) : (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <p className="text-center text-gray-500 text-sm">조회 버튼을 눌러 장비를 조회하세요</p>
        </div>
      )}
    </div>
  );
};

export default EquipmentMovement;
