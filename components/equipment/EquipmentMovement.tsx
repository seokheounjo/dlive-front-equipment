import React, { useState, useEffect } from 'react';
import { findUserList, getCommonCodes, getWrkrHaveEqtList, changeEquipmentWorker } from '../../services/apiService';

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

// 기사 검색 결과 모달
const WorkerSearchModal: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  onSelect: (worker: { USR_ID: string; USR_NM: string }) => void;
  workers: { USR_ID: string; USR_NM: string }[];
  title: string;
}> = ({ isOpen, onClose, onSelect, workers, title }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-80 max-h-96 overflow-hidden">
        <div className="p-3 border-b bg-gray-50">
          <h3 className="font-semibold text-gray-800">{title}</h3>
          <p className="text-xs text-gray-500 mt-1">{workers.length}명 검색됨</p>
        </div>
        <div className="max-h-64 overflow-y-auto">
          {workers.map((worker, idx) => (
            <button
              key={idx}
              onClick={() => { onSelect(worker); onClose(); }}
              className="w-full px-3 py-2 text-left hover:bg-blue-50 border-b border-gray-100 flex justify-between items-center"
            >
              <span className="font-medium text-gray-900">{worker.USR_NM}</span>
              <span className="text-xs text-gray-500">{worker.USR_ID}</span>
            </button>
          ))}
        </div>
        <div className="p-2 border-t bg-gray-50">
          <button onClick={onClose} className="w-full py-2 text-sm text-gray-600 hover:bg-gray-100 rounded">닫기</button>
        </div>
      </div>
    </div>
  );
};

const EquipmentMovement: React.FC<EquipmentMovementProps> = ({ onBack }) => {
  const [searchParams, setSearchParams] = useState<EqtTrnsSearch>({
    EQT_NO: '', MST_SO_ID: '', MST_SO_NM: '', SO_ID: '', CRR_ID: '', CRR_NM: '',
    WRKR_ID: '', WRKR_NM: '', ITEM_MID_CD: '', EQT_CL_CD: '', TRNS_STAT: '1', EQT_SERNO: ''
  });

  const [eqtTrnsList, setEqtTrnsList] = useState<EqtTrns[]>([]);
  const [soList, setSoList] = useState<SoListItem[]>([]);
  const [corpList, setCorpList] = useState<CorpListItem[]>([]);
  const [itemMidList, setItemMidList] = useState<ItemMidItem[]>([]);
  const [eqtClList, setEqtClList] = useState<EqtClItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const [trgtWrkrNm, setTrgtWrkrNm] = useState('');
  const [trgtWrkrId, setTrgtWrkrId] = useState('');

  const [workerModalOpen, setWorkerModalOpen] = useState(false);
  const [trgtWorkerModalOpen, setTrgtWorkerModalOpen] = useState(false);
  const [searchedWorkers, setSearchedWorkers] = useState<{ USR_ID: string; USR_NM: string }[]>([]);

  useEffect(() => {
    loadInitialData();
  }, []);

  const loadInitialData = async () => {
    try {
      const userInfo = localStorage.getItem('userInfo');
      if (userInfo) {
        const user = JSON.parse(userInfo);
        setSearchParams(prev => ({
          ...prev, SO_ID: user.soId || '', CRR_ID: user.crrId || '',
          WRKR_ID: user.userId || '', WRKR_NM: user.userName || ''
        }));
      }
    } catch (e) { console.warn('사용자 정보 파싱 실패:', e); }
    await loadDropdownData();
  };

  const loadDropdownData = async () => {
    try {
      const soData = await getCommonCodes({ GRP_CD: 'SO_CD' });
      if (Array.isArray(soData) && soData.length > 0) {
        setSoList(soData.map((item: any) => ({ SO_ID: item.COMMON_CD || item.CD, SO_NM: item.COMMON_CD_NM || item.CD_NM || item.NM })));
      } else {
        setSoList([{ SO_ID: '100', SO_NM: '본사' }, { SO_ID: '200', SO_NM: '강남지점' }]);
      }

      const corpData = await getCommonCodes({ GRP_CD: 'CRR_CD' });
      if (Array.isArray(corpData) && corpData.length > 0) {
        setCorpList(corpData.map((item: any) => ({ CRR_ID: item.COMMON_CD || item.CD, CORP_NM: item.COMMON_CD_NM || item.CD_NM || item.NM })));
      } else {
        setCorpList([{ CRR_ID: 'CRR001', CORP_NM: '협력업체A' }]);
      }

      setItemMidList([{ COMMON_CD: '03', COMMON_CD_NM: '추가장비' }, { COMMON_CD: '04', COMMON_CD_NM: '모뎀' }, { COMMON_CD: '05', COMMON_CD_NM: '셋톱박스' }, { COMMON_CD: '07', COMMON_CD_NM: '특수장비' }]);
      setEqtClList([{ COMMON_CD: 'MDM01', COMMON_CD_NM: '케이블모뎀 3.0' }, { COMMON_CD: 'STB01', COMMON_CD_NM: 'HD 셋톱박스' }]);
    } catch (error) {
      console.error('드롭다운 데이터 로드 실패:', error);
      setSoList([{ SO_ID: '100', SO_NM: '본사' }]);
      setCorpList([{ CRR_ID: 'CRR001', CORP_NM: '협력업체A' }]);
      setItemMidList([{ COMMON_CD: '04', COMMON_CD_NM: '모뎀' }, { COMMON_CD: '05', COMMON_CD_NM: '셋톱박스' }]);
      setEqtClList([{ COMMON_CD: 'STB01', COMMON_CD_NM: 'HD 셋톱박스' }]);
    }
  };

  const handleSearch = async () => {
    if (!searchParams.WRKR_ID) { alert('보유기사를 선택해주세요.'); return; }
    setIsLoading(true);
    try {
      const result = await getWrkrHaveEqtList({ WRKR_ID: searchParams.WRKR_ID, SO_ID: searchParams.SO_ID, EQT_SEL: '0', EQT_CL: 'ALL' });
      if (Array.isArray(result) && result.length > 0) {
        const transformedList: EqtTrns[] = result.map((item: any) => ({
          CHK: false, EQT_NO: item.EQT_NO || '', ITEM_MAX_NM: item.ITEM_MAX_NM || '', ITEM_MID_NM: item.ITEM_MID_NM || '',
          EQT_CL_CD: item.EQT_CL_CD || '', EQT_CL_NM: item.EQT_CL_NM || '', ITEM_NM: item.ITEM_NM || '', ITEM_SPEC: item.ITEM_SPEC || '',
          MST_SO_ID: item.MST_SO_ID || '', MST_SO_NM: item.MST_SO_NM || '', SO_ID: item.SO_ID || searchParams.SO_ID, SO_NM: item.SO_NM || '',
          EQT_SERNO: item.EQT_SERNO || '', MAC_ADDRESS: item.MAC_ADDRESS || '', TA_MAC_ADDRESS: item.TA_MAC_ADDRESS || '',
          TRGT_WRKR_NM: '', REQ_DT: '', REQ_DT_FORMAT: '', PROC_STAT: item.PROC_STAT || '', PROC_STAT_NM: item.PROC_STAT_NM || '',
          WRKR_NM: item.WRKR_NM || searchParams.WRKR_NM, CRR_NM: item.CRR_NM || ''
        }));
        setEqtTrnsList(transformedList);
      } else { setEqtTrnsList([]); alert('조회된 장비가 없습니다.'); }
    } catch (error) {
      console.error('장비 조회 실패:', error);
      alert('장비 조회에 실패했습니다.');
      setEqtTrnsList([]);
    } finally { setIsLoading(false); }
  };

  const handleWorkerSearch = async () => {
    const keyword = prompt('기사 이름 또는 ID를 입력하세요:');
    if (!keyword) return;
    try {
      const isIdSearch = /^\d+$/.test(keyword);
      const searchParam = isIdSearch ? { USR_ID: keyword } : { USR_NM: keyword };
      const result = await findUserList(searchParam);
      if (!result || result.length === 0) { alert('검색 결과가 없습니다.'); return; }
      if (result.length === 1) {
        setSearchParams({ ...searchParams, WRKR_ID: result[0].USR_ID, WRKR_NM: result[0].USR_NM });
      } else { setSearchedWorkers(result); setWorkerModalOpen(true); }
    } catch (error) { console.error('보유기사 검색 실패:', error); alert('보유기사 검색에 실패했습니다.'); }
  };

  const handleTrgtWorkerSearch = async () => {
    const keyword = prompt('이관기사 이름 또는 ID를 입력하세요:');
    if (!keyword) return;
    try {
      const isIdSearch = /^\d+$/.test(keyword);
      const searchParam = isIdSearch ? { USR_ID: keyword } : { USR_NM: keyword };
      const result = await findUserList(searchParam);
      if (!result || result.length === 0) { alert('검색 결과가 없습니다.'); return; }
      if (result.length === 1) { setTrgtWrkrId(result[0].USR_ID); setTrgtWrkrNm(result[0].USR_NM); }
      else { setSearchedWorkers(result); setTrgtWorkerModalOpen(true); }
    } catch (error) { console.error('이관기사 검색 실패:', error); alert('이관기사 검색에 실패했습니다.'); }
  };

  const handleTransfer = async () => {
    const checkedItems = eqtTrnsList.filter(item => item.CHK);
    if (checkedItems.length === 0) { alert('이관할 장비를 선택해주세요.'); return; }
    if (!trgtWrkrId) { alert('이관기사를 선택해주세요.'); return; }
    if (!confirm(`${trgtWrkrNm}(${trgtWrkrId})에게 ${checkedItems.length}건의 장비를 이관하시겠습니까?`)) return;
    try {
      // 각 장비에 대해 이관 처리
      let successCount = 0;
      for (const item of checkedItems) {
        try {
          await changeEquipmentWorker({
            EQT_NO: item.EQT_NO,
            FROM_WRKR_ID: searchParams.WRKR_ID,
            TO_WRKR_ID: trgtWrkrId
          });
          successCount++;
        } catch (err) {
          console.error('장비 이관 실패:', item.EQT_SERNO, err);
        }
      }
      if (successCount > 0) {
        alert(successCount + '건의 장비 인수가 완료되었습니다. 보유기사에게 SMS가 발송되었습니다.');
      } else {
        throw new Error('장비 인수에 실패했습니다.');
      }
      setEqtTrnsList([]); setTrgtWrkrId(''); setTrgtWrkrNm('');
    } catch (error) { console.error('장비 이관 실패:', error); alert('장비 이관에 실패했습니다.'); }
  };

  const handleCheckAll = (checked: boolean) => setEqtTrnsList(eqtTrnsList.map(item => ({ ...item, CHK: checked })));
  const handleCheckItem = (index: number, checked: boolean) => { const newList = [...eqtTrnsList]; newList[index].CHK = checked; setEqtTrnsList(newList); };

  return (
    <div>
      <div className="mb-3"><h2 className="text-lg font-bold text-gray-900">작업기사 이관신청</h2></div>

      <div className="mb-3 bg-white rounded-lg shadow-sm border border-gray-200 p-3">
        <div className="mb-2"><h3 className="text-sm font-semibold text-gray-700">보유기사</h3></div>
        <div className="space-y-2">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">지점 <span className="text-red-500">*</span></label>
            <select value={searchParams.SO_ID} onChange={(e) => setSearchParams({...searchParams, SO_ID: e.target.value})} className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded">
              <option value="">선택</option>
              {soList.map((item) => (<option key={item.SO_ID} value={item.SO_ID}>{item.SO_NM}</option>))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">협력업체 <span className="text-red-500">*</span></label>
            <select value={searchParams.CRR_ID} onChange={(e) => setSearchParams({...searchParams, CRR_ID: e.target.value})} className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded">
              <option value="">선택</option>
              {corpList.map((item) => (<option key={item.CRR_ID} value={item.CRR_ID}>{item.CORP_NM}</option>))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">장비</label>
            <div className="grid grid-cols-2 gap-2">
              <select value={searchParams.ITEM_MID_CD} onChange={(e) => setSearchParams({...searchParams, ITEM_MID_CD: e.target.value})} className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded">
                <option value="">중분류</option>
                {itemMidList.map((item) => (<option key={item.COMMON_CD} value={item.COMMON_CD}>{item.COMMON_CD_NM}</option>))}
              </select>
              <select value={searchParams.EQT_CL_CD} onChange={(e) => setSearchParams({...searchParams, EQT_CL_CD: e.target.value})} className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded">
                <option value="">장비클래스</option>
                {eqtClList.map((item) => (<option key={item.COMMON_CD} value={item.COMMON_CD}>{item.COMMON_CD_NM}</option>))}
              </select>
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">일련번호</label>
            <input type="text" value={searchParams.EQT_SERNO} onChange={(e) => setSearchParams({...searchParams, EQT_SERNO: e.target.value.toUpperCase()})} className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded uppercase" placeholder="장비 일련번호" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">보유기사 <span className="text-red-500">*</span></label>
            <div className="flex gap-2">
              <input type="text" value={searchParams.WRKR_NM} readOnly className="flex-1 px-2 py-1.5 text-sm border border-gray-300 rounded bg-gray-50" placeholder="기사명" />
              <button onClick={handleWorkerSearch} className="px-3 py-1.5 text-sm border border-gray-300 rounded bg-white hover:bg-gray-50" title="이름 또는 ID로 검색">🔍</button>
              <input type="text" value={searchParams.WRKR_ID} readOnly className="w-24 px-2 py-1.5 text-sm border border-gray-300 rounded bg-gray-50" placeholder="ID" />
            </div>
            <p className="text-xs text-gray-400 mt-1">* 돋보기 클릭 후 이름 또는 기사ID 입력</p>
          </div>
          <button onClick={handleSearch} disabled={isLoading} className="w-full bg-orange-500 hover:bg-orange-600 disabled:bg-orange-300 text-white py-2 rounded font-medium text-sm shadow-md transition-all">{isLoading ? '조회 중...' : '조회'}</button>
        </div>
      </div>

      <div className="mb-3 bg-white rounded-lg shadow-sm border border-gray-200 p-3">
        <div className="mb-2"><h3 className="text-sm font-semibold text-gray-700">이관기사</h3></div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">이관기사 <span className="text-red-500">*</span></label>
          <div className="flex gap-2">
            <input type="text" value={trgtWrkrNm} readOnly className="flex-1 px-2 py-1.5 text-sm border border-gray-300 rounded bg-gray-50" placeholder="기사명" />
            <button onClick={handleTrgtWorkerSearch} className="px-3 py-1.5 text-sm border border-gray-300 rounded bg-white hover:bg-gray-50" title="이름 또는 ID로 검색">🔍</button>
            <input type="text" value={trgtWrkrId} readOnly className="w-24 px-2 py-1.5 text-sm border border-gray-300 rounded bg-gray-50" placeholder="ID" />
          </div>
          <p className="text-xs text-gray-400 mt-1">* 돋보기 클릭 후 이름 또는 기사ID 입력</p>
        </div>
      </div>

      {eqtTrnsList.length > 0 ? (
        <>
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden mb-3">
            <div className="px-3 py-2 bg-gray-50 border-b">
              <span className="text-sm font-medium text-gray-700">조회 결과: {eqtTrnsList.length}건</span>
              <span className="text-sm text-blue-600 ml-2">(선택: {eqtTrnsList.filter(item => item.CHK).length}건)</span>
            </div>
            <div className="max-h-96 overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="bg-gray-50 sticky top-0">
                  <tr>
                    <th className="px-2 py-2 border-b"><input type="checkbox" onChange={(e) => handleCheckAll(e.target.checked)} checked={eqtTrnsList.length > 0 && eqtTrnsList.every(item => item.CHK)} /></th>
                    <th className="px-2 py-2 text-left text-xs font-semibold text-gray-700 border-b">일련번호</th>
                    <th className="px-2 py-2 text-left text-xs font-semibold text-gray-700 border-b">유형</th>
                    <th className="px-2 py-2 text-left text-xs font-semibold text-gray-700 border-b">중분류</th>
                    <th className="px-2 py-2 text-left text-xs font-semibold text-gray-700 border-b">기사</th>
                    <th className="px-2 py-2 text-left text-xs font-semibold text-gray-700 border-b">MAC</th>
                  </tr>
                </thead>
                <tbody>
                  {eqtTrnsList.map((item, idx) => (
                    <tr key={idx} className="hover:bg-gray-50">
                      <td className="px-2 py-2 border-b text-center"><input type="checkbox" checked={item.CHK || false} onChange={(e) => handleCheckItem(idx, e.target.checked)} /></td>
                      <td className="px-2 py-2 text-xs text-gray-900 border-b">{item.EQT_SERNO}</td>
                      <td className="px-2 py-2 text-xs text-gray-900 border-b">{item.EQT_CL_NM}</td>
                      <td className="px-2 py-2 text-xs text-gray-900 border-b">{item.ITEM_MID_NM}</td>
                      <td className="px-2 py-2 text-xs text-gray-900 border-b">{item.WRKR_NM}</td>
                      <td className="px-2 py-2 text-xs text-gray-900 border-b">{item.MAC_ADDRESS}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          <div className="flex justify-end">
            <button onClick={handleTransfer} className="bg-green-600 hover:bg-green-700 text-white py-2 px-6 rounded font-medium text-sm shadow-md transition-all">장비인수</button>
          </div>
        </>
      ) : (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <p className="text-center text-gray-500 text-sm">{isLoading ? '장비 조회 중...' : '조회 버튼을 눌러 장비를 조회하세요'}</p>
        </div>
      )}

      <WorkerSearchModal isOpen={workerModalOpen} onClose={() => setWorkerModalOpen(false)} onSelect={(worker) => setSearchParams({...searchParams, WRKR_ID: worker.USR_ID, WRKR_NM: worker.USR_NM})} workers={searchedWorkers} title="보유기사 선택" />
      <WorkerSearchModal isOpen={trgtWorkerModalOpen} onClose={() => setTrgtWorkerModalOpen(false)} onSelect={(worker) => { setTrgtWrkrId(worker.USR_ID); setTrgtWrkrNm(worker.USR_NM); }} workers={searchedWorkers} title="이관기사 선택" />
    </div>
  );
};

export default EquipmentMovement;
