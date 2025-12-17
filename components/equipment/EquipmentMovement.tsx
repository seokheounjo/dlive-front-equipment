import React, { useState, useEffect } from 'react';
import { findUserList, getWrkrHaveEqtList, changeEquipmentWorker } from '../../services/apiService';

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
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-sm max-h-[80vh] overflow-hidden">
        <div className="p-4 border-b border-gray-100 bg-gradient-to-r from-blue-500 to-blue-600">
          <h3 className="font-semibold text-white">{title}</h3>
          <p className="text-xs text-white/80 mt-1">{workers.length}명 검색됨</p>
        </div>
        <div className="max-h-64 overflow-y-auto">
          {workers.map((worker, idx) => (
            <button
              key={idx}
              onClick={() => { onSelect(worker); onClose(); }}
              className="w-full px-4 py-3 text-left hover:bg-blue-50 border-b border-gray-50 flex justify-between items-center transition-colors active:bg-blue-100 touch-manipulation"
              style={{ WebkitTapHighlightColor: 'transparent' }}
            >
              <span className="font-medium text-gray-900">{worker.USR_NM}</span>
              <span className="text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded">{worker.USR_ID}</span>
            </button>
          ))}
        </div>
        <div className="p-3 border-t border-gray-100 bg-gray-50">
          <button
            onClick={onClose}
            className="w-full py-2.5 text-sm text-gray-600 hover:bg-gray-200 rounded-lg font-medium transition-colors active:scale-[0.98] touch-manipulation"
            style={{ WebkitTapHighlightColor: 'transparent' }}
          >
            닫기
          </button>
        </div>
      </div>
    </div>
  );
};

const EquipmentMovement: React.FC<EquipmentMovementProps> = ({ onBack }) => {
  // 로그인한 사용자 = 이관기사 (장비를 인수받는 사람)
  const [loggedInUser, setLoggedInUser] = useState<{ userId: string; userName: string; soId: string; crrId: string }>({
    userId: '', userName: '', soId: '', crrId: ''
  });

  // 보유기사 = 장비를 내놓는 타 기사 (조회 대상)
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

  const [workerModalOpen, setWorkerModalOpen] = useState(false);
  const [searchedWorkers, setSearchedWorkers] = useState<{ USR_ID: string; USR_NM: string }[]>([]);

  useEffect(() => {
    loadInitialData();
  }, []);

  const loadInitialData = async () => {
    try {
      const userInfo = localStorage.getItem('userInfo');
      if (userInfo) {
        const user = JSON.parse(userInfo);
        // 로그인한 사용자 = 이관기사 (인수받는 사람)
        setLoggedInUser({
          userId: user.userId || '',
          userName: user.userName || '',
          soId: user.soId || '',
          crrId: user.crrId || ''
        });
        // 보유기사 조회용 기본값 (지점, 협력업체)
        setSearchParams(prev => ({
          ...prev, SO_ID: user.soId || '', CRR_ID: user.crrId || ''
        }));
      }
    } catch (e) { console.warn('사용자 정보 파싱 실패:', e); }
    await loadDropdownData();
  };

  const loadDropdownData = async () => {
    let soMapSize = 0;
    let crrMapSize = 0;

    try {
      console.log('📋 [장비이동] 지점/협력업체 목록 로드 시작');

      // 기사 조회를 통해 지점 목록 수집 시도
      const userResult = await findUserList({ USR_NM: '' });

      if (Array.isArray(userResult) && userResult.length > 0) {
        const soMap = new Map<string, string>();
        const crrMap = new Map<string, string>();

        userResult.forEach((user: any) => {
          if (user.SO_ID && user.SO_NM) {
            soMap.set(user.SO_ID, user.SO_NM);
          }
          if (user.CRR_ID && user.CRR_NM) {
            crrMap.set(user.CRR_ID, user.CRR_NM);
          }
        });

        soMapSize = soMap.size;
        crrMapSize = crrMap.size;

        if (soMap.size > 0) {
          const soListFromApi = Array.from(soMap.entries()).map(([id, nm]) => ({ SO_ID: id, SO_NM: nm }));
          setSoList(soListFromApi);
          console.log('✅ [장비이동] 지점 목록 로드 성공:', soListFromApi.length, '건');
        }

        if (crrMap.size > 0) {
          const crrListFromApi = Array.from(crrMap.entries()).map(([id, nm]) => ({ CRR_ID: id, CORP_NM: nm }));
          setCorpList(crrListFromApi);
          console.log('✅ [장비이동] 협력업체 목록 로드 성공:', crrListFromApi.length, '건');
        }
      }
    } catch (error) {
      console.error('드롭다운 데이터 로드 실패:', error);
    }

    // API 결과가 없으면 로그인한 사용자 정보 기반으로 설정
    if (soMapSize === 0 || crrMapSize === 0) {
      const userInfo = localStorage.getItem('userInfo');
      const branchList = localStorage.getItem('branchList');
      if (userInfo) {
        try {
          const user = JSON.parse(userInfo);

          // 지점 목록: authSoList 또는 branchList 사용
          if (soMapSize === 0) {
            let soListData: { SO_ID: string; SO_NM: string }[] = [];

            // 1순위: authSoList (로그인 응답에서)
            if (user.authSoList && Array.isArray(user.authSoList) && user.authSoList.length > 0) {
              soListData = user.authSoList;
              console.log('✅ [장비이동] authSoList에서 지점 목록 사용:', soListData.length, '건');
            }
            // 2순위: localStorage branchList
            else if (branchList) {
              try {
                const parsed = JSON.parse(branchList);
                if (Array.isArray(parsed) && parsed.length > 0) {
                  soListData = parsed;
                  console.log('✅ [장비이동] branchList에서 지점 목록 사용:', soListData.length, '건');
                }
              } catch (e) { }
            }
            // 3순위: 단일 지점 (soNm 있으면 사용)
            if (soListData.length === 0 && user.soId) {
              const displayName = user.soNm || `지점(${user.soId})`;
              soListData = [{ SO_ID: user.soId, SO_NM: displayName }];
              console.log('⚠️ [장비이동] 단일 지점 사용:', displayName);
            }

            if (soListData.length > 0) {
              setSoList(soListData.map(so => ({ SO_ID: so.SO_ID, SO_NM: so.SO_NM })));
            }
          }

          // 협력업체: crrNm 또는 corpNm 사용
          if (crrMapSize === 0 && user.crrId) {
            // crrNm이 없으면 corpNm 사용 (로그인 응답에서 corpNm은 있음)
            const displayName = user.crrNm || user.corpNm || `협력업체(${user.crrId})`;
            setCorpList([{ CRR_ID: user.crrId, CORP_NM: displayName }]);
            console.log('⚠️ [장비이동] 협력업체 사용:', displayName);
          }
        } catch (e) {
          console.warn('사용자 정보 파싱 실패:', e);
        }
      }
    }

    // 장비 중분류
    setItemMidList([
      { COMMON_CD: '', COMMON_CD_NM: '전체' },
      { COMMON_CD: '03', COMMON_CD_NM: '추가장비' },
      { COMMON_CD: '04', COMMON_CD_NM: '모뎀' },
      { COMMON_CD: '05', COMMON_CD_NM: '셋톱박스' },
      { COMMON_CD: '07', COMMON_CD_NM: '특수장비' }
    ]);

    // 장비 클래스
    setEqtClList([
      { COMMON_CD: '', COMMON_CD_NM: '전체' },
      { COMMON_CD: 'MDM01', COMMON_CD_NM: '케이블모뎀 3.0' },
      { COMMON_CD: 'STB01', COMMON_CD_NM: 'HD 셋톱박스' },
      { COMMON_CD: 'STB02', COMMON_CD_NM: 'UHD 셋톱박스' }
    ]);
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

  const handleTransfer = async () => {
    const checkedItems = eqtTrnsList.filter(item => item.CHK);
    if (checkedItems.length === 0) { alert('인수할 장비를 선택해주세요.'); return; }
    if (!loggedInUser.userId) { alert('로그인 정보가 없습니다.'); return; }
    if (!confirm(`${searchParams.WRKR_NM}(${searchParams.WRKR_ID})의 장비 ${checkedItems.length}건을 인수하시겠습니까?`)) return;
    try {
      // 각 장비에 대해 이관 처리 (보유기사 → 로그인한 기사)
      let successCount = 0;
      for (const item of checkedItems) {
        try {
          await changeEquipmentWorker({
            EQT_NO: item.EQT_NO,
            FROM_WRKR_ID: searchParams.WRKR_ID,  // 보유기사 (장비를 내놓는 사람)
            TO_WRKR_ID: loggedInUser.userId       // 이관기사 = 로그인한 사람 (인수받는 사람)
          });
          successCount++;
        } catch (err) {
          console.error('장비 인수 실패:', item.EQT_SERNO, err);
        }
      }
      if (successCount > 0) {
        alert(successCount + '건의 장비 인수가 완료되었습니다. 보유기사에게 SMS가 발송되었습니다.');
      } else {
        throw new Error('장비 인수에 실패했습니다.');
      }
      setEqtTrnsList([]);
    } catch (error) { console.error('장비 인수 실패:', error); alert('장비 인수에 실패했습니다.'); }
  };

  const handleCheckAll = (checked: boolean) => setEqtTrnsList(eqtTrnsList.map(item => ({ ...item, CHK: checked })));
  const handleCheckItem = (index: number, checked: boolean) => { const newList = [...eqtTrnsList]; newList[index].CHK = checked; setEqtTrnsList(newList); };

  return (
    <div className="h-full flex flex-col bg-gray-50 overflow-hidden">
      {/* 헤더 - 고정 */}
      <div className="flex-shrink-0 bg-gradient-to-br from-blue-500 to-blue-600 px-4 py-3 shadow-lg z-40">
        <h1 className="text-lg font-bold text-white">기사간 장비이동</h1>
      </div>

      {/* 콘텐츠 - 스크롤 영역 */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
        {/* 이관기사 (로그인한 사용자 = 인수받는 사람) */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-blue-600">이관기사 (나)</span>
            <span className="text-sm font-bold text-gray-900">{loggedInUser.userName} ({loggedInUser.userId})</span>
          </div>
        </div>

        {/* 보유기사 조회 영역 */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
          <div className="mb-3">
            <h3 className="text-sm font-semibold text-gray-800">보유기사 조회</h3>
            <p className="text-xs text-gray-500 mt-0.5">장비를 넘겨받을 기사를 검색하세요</p>
          </div>
          <div className="space-y-3">
            {/* 지점 */}
            <div className="flex items-center gap-2">
              <label className="text-xs font-medium text-gray-600 w-16 flex-shrink-0">지점 <span className="text-red-500">*</span></label>
              <select value={searchParams.SO_ID} onChange={(e) => setSearchParams({...searchParams, SO_ID: e.target.value})} className="flex-1 px-3 py-2 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all">
                <option value="">선택</option>
                {soList.map((item) => (<option key={item.SO_ID} value={item.SO_ID}>{item.SO_NM}</option>))}
              </select>
            </div>
            {/* 협력업체 */}
            <div className="flex items-center gap-2">
              <label className="text-xs font-medium text-gray-600 w-16 flex-shrink-0">협력업체 <span className="text-red-500">*</span></label>
              <select value={searchParams.CRR_ID} onChange={(e) => setSearchParams({...searchParams, CRR_ID: e.target.value})} className="flex-1 px-3 py-2 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all">
                <option value="">선택</option>
                {corpList.map((item) => (<option key={item.CRR_ID} value={item.CRR_ID}>{item.CORP_NM}</option>))}
              </select>
            </div>
            {/* 장비종류 */}
            <div className="flex items-center gap-2">
              <label className="text-xs font-medium text-gray-600 w-16 flex-shrink-0">장비</label>
              <select value={searchParams.ITEM_MID_CD} onChange={(e) => setSearchParams({...searchParams, ITEM_MID_CD: e.target.value})} className="flex-1 px-3 py-2 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all">
                <option value="">중분류</option>
                {itemMidList.map((item) => (<option key={item.COMMON_CD} value={item.COMMON_CD}>{item.COMMON_CD_NM}</option>))}
              </select>
              <select value={searchParams.EQT_CL_CD} onChange={(e) => setSearchParams({...searchParams, EQT_CL_CD: e.target.value})} className="flex-1 px-3 py-2 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all">
                <option value="">클래스</option>
                {eqtClList.map((item) => (<option key={item.COMMON_CD} value={item.COMMON_CD}>{item.COMMON_CD_NM}</option>))}
              </select>
            </div>
            {/* S/N */}
            <div className="flex items-center gap-2">
              <label className="text-xs font-medium text-gray-600 w-16 flex-shrink-0">S/N</label>
              <input type="text" value={searchParams.EQT_SERNO} onChange={(e) => setSearchParams({...searchParams, EQT_SERNO: e.target.value.toUpperCase()})} className="flex-1 px-3 py-2 text-sm border border-gray-200 rounded-lg uppercase focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all" placeholder="일련번호" />
            </div>
            {/* 보유기사 */}
            <div className="flex items-center gap-2">
              <label className="text-xs font-medium text-gray-600 w-16 flex-shrink-0">보유기사 <span className="text-red-500">*</span></label>
              <input type="text" value={searchParams.WRKR_NM} readOnly className="flex-1 px-3 py-2 text-sm border border-gray-200 rounded-lg bg-gray-50" placeholder="기사명" />
              <button onClick={handleWorkerSearch} className="flex-shrink-0 px-3 py-2 text-sm border border-gray-200 rounded-lg bg-white hover:bg-gray-50 active:scale-[0.98] transition-all touch-manipulation" title="검색" style={{ WebkitTapHighlightColor: 'transparent' }}>🔍</button>
              <input type="text" value={searchParams.WRKR_ID} readOnly className="w-20 px-3 py-2 text-xs border border-gray-200 rounded-lg bg-gray-50" placeholder="ID" />
            </div>
            {/* 조회 버튼 */}
            <button
              onClick={handleSearch}
              disabled={isLoading || !searchParams.WRKR_ID}
              className="w-full bg-blue-500 hover:bg-blue-600 disabled:bg-gray-300 text-white py-2.5 rounded-lg font-semibold text-sm shadow-sm transition-all active:scale-[0.98] touch-manipulation"
              style={{ WebkitTapHighlightColor: 'transparent' }}
            >
              {isLoading ? '조회 중...' : '조회'}
            </button>
          </div>
        </div>

        {eqtTrnsList.length > 0 ? (
          <>
            {/* 조회 결과 테이블 */}
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
              <div className="px-4 py-3 bg-gradient-to-r from-gray-50 to-white border-b border-gray-100">
                <span className="text-sm font-semibold text-gray-800">조회 결과: {eqtTrnsList.length}건</span>
                <span className="text-sm text-blue-600 ml-2 font-medium">(선택: {eqtTrnsList.filter(item => item.CHK).length}건)</span>
              </div>
              <div className="max-h-96 overflow-x-auto">
                <table className="w-full text-xs">
                  <thead className="bg-gray-50 sticky top-0">
                    <tr>
                      <th className="px-3 py-2.5 border-b border-gray-100"><input type="checkbox" onChange={(e) => handleCheckAll(e.target.checked)} checked={eqtTrnsList.length > 0 && eqtTrnsList.every(item => item.CHK)} className="rounded" /></th>
                      <th className="px-3 py-2.5 text-left text-xs font-semibold text-gray-600 border-b border-gray-100">일련번호</th>
                      <th className="px-3 py-2.5 text-left text-xs font-semibold text-gray-600 border-b border-gray-100">유형</th>
                      <th className="px-3 py-2.5 text-left text-xs font-semibold text-gray-600 border-b border-gray-100">중분류</th>
                      <th className="px-3 py-2.5 text-left text-xs font-semibold text-gray-600 border-b border-gray-100">기사</th>
                      <th className="px-3 py-2.5 text-left text-xs font-semibold text-gray-600 border-b border-gray-100">MAC</th>
                    </tr>
                  </thead>
                  <tbody>
                    {eqtTrnsList.map((item, idx) => (
                      <tr key={idx} className="hover:bg-blue-50/50 transition-colors">
                        <td className="px-3 py-2.5 border-b border-gray-50 text-center"><input type="checkbox" checked={item.CHK || false} onChange={(e) => handleCheckItem(idx, e.target.checked)} className="rounded" /></td>
                        <td className="px-3 py-2.5 text-xs text-gray-900 border-b border-gray-50 font-medium">{item.EQT_SERNO}</td>
                        <td className="px-3 py-2.5 text-xs text-gray-700 border-b border-gray-50">{item.EQT_CL_NM}</td>
                        <td className="px-3 py-2.5 text-xs text-gray-700 border-b border-gray-50">{item.ITEM_MID_NM}</td>
                        <td className="px-3 py-2.5 text-xs text-gray-700 border-b border-gray-50">{item.WRKR_NM}</td>
                        <td className="px-3 py-2.5 text-xs text-gray-500 border-b border-gray-50 font-mono">{item.MAC_ADDRESS}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
            {/* 장비인수 버튼 */}
            <div className="flex justify-end">
              <button
                onClick={handleTransfer}
                className="bg-blue-500 hover:bg-blue-600 text-white py-2.5 px-8 rounded-lg font-semibold text-sm shadow-sm transition-all active:scale-[0.98] touch-manipulation"
                style={{ WebkitTapHighlightColor: 'transparent' }}
              >
                장비인수
              </button>
            </div>
          </>
        ) : (
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-8">
            <p className="text-center text-gray-500 text-sm">{isLoading ? '장비 조회 중...' : '조회 버튼을 눌러 장비를 조회하세요'}</p>
          </div>
        )}

        <WorkerSearchModal isOpen={workerModalOpen} onClose={() => setWorkerModalOpen(false)} onSelect={(worker) => setSearchParams({...searchParams, WRKR_ID: worker.USR_ID, WRKR_NM: worker.USR_NM})} workers={searchedWorkers} title="보유기사 선택" />
      </div>
    </div>
  );
};

export default EquipmentMovement;
