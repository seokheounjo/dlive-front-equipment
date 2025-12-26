import React, { useState, useEffect, useRef } from 'react';
import { findUserList, getWrkrHaveEqtList, changeEquipmentWorker, getEquipmentHistoryInfo } from '../../services/apiService';
import { debugApiCall } from './equipmentDebug';
import { Scan, Search, ChevronDown, ChevronUp, Check, X } from 'lucide-react';

interface EquipmentMovementProps {
  onBack: () => void;
}

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
  WRKR_NM: string;
  CRR_NM: string;
  isScanned?: boolean; // 바코드로 스캔된 장비 표시
}

interface SoListItem {
  SO_ID: string;
  SO_NM: string;
}

interface CorpListItem {
  CRR_ID: string;
  CORP_NM: string;
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
            >
              <span className="font-medium text-gray-900">{worker.USR_NM}</span>
              <span className="text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded">{worker.USR_ID}</span>
            </button>
          ))}
        </div>
        <div className="p-3 border-t border-gray-100 bg-gray-50">
          <button onClick={onClose} className="w-full py-2.5 text-sm text-gray-600 hover:bg-gray-200 rounded-lg font-medium transition-colors">
            닫기
          </button>
        </div>
      </div>
    </div>
  );
};

// 바코드 스캔 모달
const BarcodeScanModal: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  onScan: (serialNo: string) => void;
}> = ({ isOpen, onClose, onScan }) => {
  const [inputValue, setInputValue] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSubmit = () => {
    if (inputValue.trim()) {
      onScan(inputValue.trim().toUpperCase());
      setInputValue('');
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-sm overflow-hidden">
        <div className="p-4 border-b border-gray-100 bg-gradient-to-r from-purple-500 to-purple-600">
          <div className="flex items-center gap-2">
            <Scan className="w-5 h-5 text-white" />
            <h3 className="font-semibold text-white">바코드 스캔</h3>
          </div>
          <p className="text-xs text-white/80 mt-1">장비 S/N을 스캔하거나 입력하세요</p>
        </div>
        <div className="p-4 space-y-4">
          <input
            ref={inputRef}
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value.toUpperCase())}
            onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
            placeholder="S/N 입력 또는 스캔"
            className="w-full px-4 py-3 text-lg border-2 border-purple-200 rounded-lg focus:border-purple-500 focus:ring-2 focus:ring-purple-200 uppercase font-mono text-center"
            autoComplete="off"
          />
          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="flex-1 py-2.5 text-sm text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-lg font-medium transition-colors"
            >
              취소
            </button>
            <button
              onClick={handleSubmit}
              disabled={!inputValue.trim()}
              className="flex-1 py-2.5 text-sm text-white bg-purple-500 hover:bg-purple-600 disabled:bg-gray-300 rounded-lg font-medium transition-colors"
            >
              조회
            </button>
          </div>
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

  // 보유기사 정보
  const [workerInfo, setWorkerInfo] = useState<{ WRKR_ID: string; WRKR_NM: string; SO_ID: string; CRR_ID: string }>({
    WRKR_ID: 'A20117965', WRKR_NM: '오현민', SO_ID: '', CRR_ID: ''  // 하드코딩 기본값
  });

  const [eqtTrnsList, setEqtTrnsList] = useState<EqtTrns[]>([]);
  const [soList, setSoList] = useState<SoListItem[]>([]);
  const [corpList, setCorpList] = useState<CorpListItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [scannedSerials, setScannedSerials] = useState<string[]>([]); // 스캔된 S/N 목록

  const [workerModalOpen, setWorkerModalOpen] = useState(false);
  const [scanModalOpen, setScanModalOpen] = useState(false);
  const [searchedWorkers, setSearchedWorkers] = useState<{ USR_ID: string; USR_NM: string }[]>([]);

  // 종류별 접기/펼치기 상태
  const [collapsedCategories, setCollapsedCategories] = useState<Set<string>>(new Set());

  useEffect(() => {
    loadInitialData();
  }, []);

  const loadInitialData = async () => {
    try {
      const userInfo = localStorage.getItem('userInfo');
      if (userInfo) {
        const user = JSON.parse(userInfo);
        setLoggedInUser({
          userId: user.userId || '',
          userName: user.userName || '',
          soId: user.soId || '',
          crrId: user.crrId || ''
        });
      }
    } catch (e) { console.warn('사용자 정보 파싱 실패:', e); }
    await loadDropdownData();
  };

  const loadDropdownData = async () => {
    const userInfo = localStorage.getItem('userInfo');
    const branchList = localStorage.getItem('branchList');
    if (userInfo) {
      try {
        const user = JSON.parse(userInfo);
        let soListData: { SO_ID: string; SO_NM: string }[] = [];

        if (user.authSoList && Array.isArray(user.authSoList) && user.authSoList.length > 0) {
          soListData = user.authSoList;
        } else if (branchList) {
          try {
            const parsed = JSON.parse(branchList);
            if (Array.isArray(parsed) && parsed.length > 0) soListData = parsed;
          } catch (e) { }
        }
        if (soListData.length === 0 && user.soId) {
          soListData = [{ SO_ID: user.soId, SO_NM: user.soNm || `지점(${user.soId})` }];
        }
        if (soListData.length > 0) {
          setSoList(soListData);
          // 기본 지점 설정
          setWorkerInfo(prev => ({ ...prev, SO_ID: soListData[0].SO_ID }));
        }
        if (user.crrId) {
          setCorpList([{ CRR_ID: user.crrId, CORP_NM: user.crrNm || user.corpNm || `협력업체(${user.crrId})` }]);
          setWorkerInfo(prev => ({ ...prev, CRR_ID: user.crrId }));
        }
      } catch (e) { console.warn('사용자 정보 파싱 실패:', e); }
    }
  };

  // 바코드 스캔 시 - 장비 정보로 기사 조회
  const handleBarcodeScan = async (serialNo: string) => {
    setIsLoading(true);
    try {
      // 1. 장비 정보 조회
      const eqtResult = await debugApiCall('EquipmentMovement', 'getEquipmentHistoryInfo',
        () => getEquipmentHistoryInfo({ EQT_SERNO: serialNo }),
        { EQT_SERNO: serialNo }
      );

      if (eqtResult && eqtResult.length > 0) {
        const eqt = eqtResult[0];
        const ownerWrkrId = eqt.WRKR_ID || eqt.OWNER_WRKR_ID;
        const ownerWrkrNm = eqt.WRKR_NM || eqt.OWNER_WRKR_NM || '알수없음';

        if (ownerWrkrId) {
          // 2. 스캔된 S/N 저장
          setScannedSerials(prev => [...new Set([serialNo, ...prev])]);

          // 3. 기사 정보 설정 및 보유장비 조회
          setWorkerInfo(prev => ({ ...prev, WRKR_ID: ownerWrkrId, WRKR_NM: ownerWrkrNm }));
          await searchEquipmentByWorker(ownerWrkrId, ownerWrkrNm, serialNo);
        } else {
          alert(`장비(${serialNo})의 보유기사 정보가 없습니다.`);
        }
      } else {
        alert(`장비(${serialNo})를 찾을 수 없습니다.`);
      }
    } catch (error) {
      console.error('바코드 스캔 처리 실패:', error);
      alert('장비 조회에 실패했습니다.');
    } finally {
      setIsLoading(false);
    }
  };

  // 기사 보유장비 조회
  const searchEquipmentByWorker = async (wrkrId: string, wrkrNm: string, scannedSN?: string) => {
    setIsLoading(true);
    try {
      const params = { WRKR_ID: wrkrId, SO_ID: workerInfo.SO_ID, EQT_SEL: '0', EQT_CL: 'ALL' };
      const result = await debugApiCall('EquipmentMovement', 'getWrkrHaveEqtList', () => getWrkrHaveEqtList(params), params);

      if (Array.isArray(result) && result.length > 0) {
        let transformedList: EqtTrns[] = result.map((item: any) => ({
          CHK: false,
          EQT_NO: item.EQT_NO || '',
          ITEM_MAX_NM: item.ITEM_MAX_NM || '',
          ITEM_MID_NM: item.ITEM_MID_NM || '',
          EQT_CL_CD: item.EQT_CL_CD || '',
          EQT_CL_NM: item.EQT_CL_NM || '',
          ITEM_NM: item.ITEM_NM || '',
          ITEM_SPEC: item.ITEM_SPEC || '',
          MST_SO_ID: item.MST_SO_ID || '',
          MST_SO_NM: item.MST_SO_NM || '',
          SO_ID: item.SO_ID || workerInfo.SO_ID,
          SO_NM: item.SO_NM || '',
          EQT_SERNO: item.EQT_SERNO || '',
          MAC_ADDRESS: item.MAC_ADDRESS || '',
          TA_MAC_ADDRESS: item.TA_MAC_ADDRESS || '',
          WRKR_NM: item.WRKR_NM || wrkrNm,
          CRR_NM: item.CRR_NM || '',
          isScanned: scannedSN ? item.EQT_SERNO === scannedSN || scannedSerials.includes(item.EQT_SERNO) : scannedSerials.includes(item.EQT_SERNO)
        }));

        // 스캔된 장비를 상위로 정렬
        transformedList.sort((a, b) => {
          if (a.isScanned && !b.isScanned) return -1;
          if (!a.isScanned && b.isScanned) return 1;
          return 0;
        });

        // 스캔된 장비는 자동 체크
        transformedList = transformedList.map(item => ({
          ...item,
          CHK: item.isScanned || false
        }));

        setEqtTrnsList(transformedList);
      } else {
        setEqtTrnsList([]);
        alert('조회된 장비가 없습니다.');
      }
    } catch (error) {
      console.error('장비 조회 실패:', error);
      alert('장비 조회에 실패했습니다.');
      setEqtTrnsList([]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSearch = async () => {
    if (!workerInfo.WRKR_ID) { alert('보유기사를 선택해주세요.'); return; }
    await searchEquipmentByWorker(workerInfo.WRKR_ID, workerInfo.WRKR_NM);
  };

  const handleWorkerSearch = async () => {
    const keyword = prompt('기사 이름 또는 ID를 입력하세요:');
    if (!keyword) return;
    try {
      const isIdSearch = /^\d+$/.test(keyword) || /^[A-Z]\d+$/i.test(keyword);
      const searchParam = isIdSearch ? { USR_ID: keyword } : { USR_NM: keyword };
      const result = await debugApiCall('EquipmentMovement', 'findUserList', () => findUserList(searchParam), searchParam);
      if (!result || result.length === 0) { alert('검색 결과가 없습니다.'); return; }
      if (result.length === 1) {
        setWorkerInfo(prev => ({ ...prev, WRKR_ID: result[0].USR_ID, WRKR_NM: result[0].USR_NM }));
      } else { setSearchedWorkers(result.slice(0, 50)); setWorkerModalOpen(true); }
    } catch (error) { console.error('보유기사 검색 실패:', error); alert('보유기사 검색에 실패했습니다.'); }
  };

  const handleTransfer = async () => {
    const checkedItems = eqtTrnsList.filter(item => item.CHK);
    if (checkedItems.length === 0) { alert('이동할 장비를 선택해주세요.'); return; }
    if (!loggedInUser.userId) { alert('로그인 정보가 없습니다.'); return; }
    if (!confirm(`${workerInfo.WRKR_NM}(${workerInfo.WRKR_ID})의 장비 ${checkedItems.length}건을 인수하시겠습니까?`)) return;

    try {
      let successCount = 0;
      for (const item of checkedItems) {
        try {
          const params = {
            EQT_NO: item.EQT_NO,
            FROM_WRKR_ID: workerInfo.WRKR_ID,
            TO_WRKR_ID: loggedInUser.userId
          };
          await debugApiCall('EquipmentMovement', 'changeEquipmentWorker', () => changeEquipmentWorker(params), params);
          successCount++;
        } catch (err) {
          console.error('장비 이동 실패:', item.EQT_SERNO, err);
        }
      }
      if (successCount > 0) {
        alert(`${successCount}건의 장비 이동이 완료되었습니다.`);
        setScannedSerials([]);
        setEqtTrnsList([]);
      } else {
        throw new Error('장비 이동에 실패했습니다.');
      }
    } catch (error) {
      console.error('장비 이동 실패:', error);
      alert('장비 이동에 실패했습니다.');
    }
  };

  // 전체 체크
  const handleCheckAll = (checked: boolean) => setEqtTrnsList(eqtTrnsList.map(item => ({ ...item, CHK: checked })));

  // 개별 체크
  const handleCheckItem = (index: number, checked: boolean) => {
    const newList = [...eqtTrnsList];
    newList[index].CHK = checked;
    setEqtTrnsList(newList);
  };

  // 종류별 전체 체크
  const handleCheckCategory = (category: string, checked: boolean) => {
    setEqtTrnsList(eqtTrnsList.map(item =>
      item.ITEM_MID_NM === category ? { ...item, CHK: checked } : item
    ));
  };

  // 카테고리 접기/펼치기
  const toggleCategory = (category: string) => {
    setCollapsedCategories(prev => {
      const newSet = new Set(prev);
      if (newSet.has(category)) newSet.delete(category);
      else newSet.add(category);
      return newSet;
    });
  };

  // 종류별로 그룹화
  const groupedEquipment = eqtTrnsList.reduce((acc, item) => {
    const category = item.ITEM_MID_NM || '기타';
    if (!acc[category]) acc[category] = [];
    acc[category].push(item);
    return acc;
  }, {} as Record<string, EqtTrns[]>);

  const categories = Object.keys(groupedEquipment);

  return (
    <div className="h-full overflow-y-auto bg-gray-50 px-4 py-4 space-y-3">
      {/* 이관기사 (로그인한 사용자 = 인수받는 사람) */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium text-blue-600">이관 대상 (나)</span>
          <span className="text-sm font-bold text-gray-900">{loggedInUser.userName} ({loggedInUser.userId})</span>
        </div>
      </div>

      {/* 바코드 스캔 버튼 */}
      <button
        onClick={() => setScanModalOpen(true)}
        className="w-full bg-gradient-to-r from-purple-500 to-purple-600 text-white py-4 rounded-xl font-semibold text-base shadow-lg flex items-center justify-center gap-3 active:scale-[0.98] transition-all touch-manipulation"
      >
        <Scan className="w-6 h-6" />
        바코드 스캔으로 장비 조회
      </button>

      {/* 보유기사 조회 영역 */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
        <div className="mb-3">
          <h3 className="text-sm font-semibold text-gray-800">보유기사 직접 조회</h3>
          <p className="text-xs text-gray-500 mt-0.5">기사를 검색하여 보유 장비를 조회합니다</p>
        </div>
        <div className="space-y-3">
          {/* 지점 */}
          <div className="flex items-center gap-2">
            <label className="text-xs font-medium text-gray-600 w-16 flex-shrink-0">지점</label>
            <select
              value={workerInfo.SO_ID}
              onChange={(e) => setWorkerInfo({...workerInfo, SO_ID: e.target.value})}
              className="flex-1 px-3 py-2 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500"
            >
              <option value="">선택</option>
              {soList.map((item) => (<option key={item.SO_ID} value={item.SO_ID}>{item.SO_NM}</option>))}
            </select>
          </div>

          {/* 보유기사 */}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1.5">보유기사 <span className="text-red-500">*</span></label>
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={workerInfo.WRKR_NM}
                onChange={(e) => setWorkerInfo({...workerInfo, WRKR_NM: e.target.value})}
                className="flex-1 min-w-0 px-3 py-2 text-sm border border-gray-200 rounded-lg"
                placeholder="기사명"
              />
              <button
                onClick={handleWorkerSearch}
                className="flex-shrink-0 px-3 py-2 text-sm border border-gray-200 rounded-lg bg-white hover:bg-gray-50 active:scale-[0.98] transition-all"
              >
                <Search className="w-4 h-4" />
              </button>
              <input
                type="text"
                value={workerInfo.WRKR_ID}
                onChange={(e) => setWorkerInfo({...workerInfo, WRKR_ID: e.target.value})}
                className="w-24 px-2 py-2 text-xs border border-gray-200 rounded-lg flex-shrink-0"
                placeholder="ID"
              />
            </div>
          </div>

          {/* 조회 버튼 */}
          <button
            onClick={handleSearch}
            disabled={isLoading || !workerInfo.WRKR_ID}
            className="w-full bg-blue-500 hover:bg-blue-600 disabled:bg-gray-300 text-white py-2.5 rounded-lg font-semibold text-sm shadow-sm transition-all active:scale-[0.98]"
          >
            {isLoading ? '조회 중...' : '조회'}
          </button>
        </div>
      </div>

      {/* 스캔된 장비 표시 */}
      {scannedSerials.length > 0 && (
        <div className="bg-purple-50 border border-purple-200 rounded-xl p-3">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-purple-700">스캔된 장비 ({scannedSerials.length})</span>
            <button
              onClick={() => setScannedSerials([])}
              className="text-xs text-purple-600 hover:text-purple-800"
            >
              초기화
            </button>
          </div>
          <div className="flex flex-wrap gap-1">
            {scannedSerials.map((sn, idx) => (
              <span key={idx} className="px-2 py-1 bg-purple-100 text-purple-800 text-xs rounded-md font-mono">
                {sn}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* 조회 결과 - 종류별 그룹화 */}
      {eqtTrnsList.length > 0 && (
        <>
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
            {/* 헤더 */}
            <div className="px-4 py-3 bg-gradient-to-r from-gray-50 to-white border-b border-gray-100 flex items-center justify-between">
              <div>
                <span className="text-sm font-semibold text-gray-800">
                  {workerInfo.WRKR_NM} 보유장비: {eqtTrnsList.length}건
                </span>
                <span className="text-sm text-blue-600 ml-2 font-medium">
                  (선택: {eqtTrnsList.filter(item => item.CHK).length}건)
                </span>
              </div>
              <label className="flex items-center gap-2 text-xs">
                <input
                  type="checkbox"
                  onChange={(e) => handleCheckAll(e.target.checked)}
                  checked={eqtTrnsList.length > 0 && eqtTrnsList.every(item => item.CHK)}
                  className="rounded"
                />
                전체선택
              </label>
            </div>

            {/* 종류별 그룹 */}
            <div className="divide-y divide-gray-100">
              {categories.map(category => {
                const items = groupedEquipment[category];
                const isCollapsed = collapsedCategories.has(category);
                const allChecked = items.every(item => item.CHK);
                const someChecked = items.some(item => item.CHK);

                return (
                  <div key={category}>
                    {/* 카테고리 헤더 */}
                    <div
                      className="px-4 py-3 bg-gray-50 flex items-center justify-between cursor-pointer hover:bg-gray-100 transition-colors"
                      onClick={() => toggleCategory(category)}
                    >
                      <div className="flex items-center gap-3">
                        <input
                          type="checkbox"
                          checked={allChecked}
                          onChange={(e) => { e.stopPropagation(); handleCheckCategory(category, e.target.checked); }}
                          className="rounded"
                        />
                        <span className="text-sm font-semibold text-gray-700">{category}</span>
                        <span className="text-xs text-gray-500 bg-gray-200 px-2 py-0.5 rounded-full">
                          {items.length}건
                          {someChecked && !allChecked && ` (${items.filter(i => i.CHK).length} 선택)`}
                        </span>
                      </div>
                      {isCollapsed ? <ChevronDown className="w-4 h-4 text-gray-500" /> : <ChevronUp className="w-4 h-4 text-gray-500" />}
                    </div>

                    {/* 장비 목록 */}
                    {!isCollapsed && (
                      <div className="divide-y divide-gray-50">
                        {items.map((item, idx) => {
                          const globalIndex = eqtTrnsList.findIndex(e => e.EQT_NO === item.EQT_NO);
                          return (
                            <div
                              key={item.EQT_NO || idx}
                              className={`px-4 py-3 flex items-start gap-3 transition-colors ${item.isScanned ? 'bg-purple-50' : 'hover:bg-blue-50/50'}`}
                            >
                              <input
                                type="checkbox"
                                checked={item.CHK || false}
                                onChange={(e) => handleCheckItem(globalIndex, e.target.checked)}
                                className="rounded mt-0.5"
                              />
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                  <span className="text-sm font-bold text-gray-900 font-mono">{item.EQT_SERNO}</span>
                                  {item.isScanned && (
                                    <span className="px-1.5 py-0.5 bg-purple-500 text-white text-[10px] rounded font-medium">스캔</span>
                                  )}
                                </div>
                                <div className="text-xs text-gray-600 mt-0.5">{item.EQT_CL_NM || item.ITEM_NM}</div>
                                {item.MAC_ADDRESS && (
                                  <div className="text-xs text-gray-400 font-mono mt-0.5">{item.MAC_ADDRESS}</div>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* 장비이동 버튼 */}
          <button
            onClick={handleTransfer}
            disabled={eqtTrnsList.filter(item => item.CHK).length === 0}
            className="w-full bg-gradient-to-r from-blue-500 to-blue-600 disabled:from-gray-300 disabled:to-gray-400 text-white py-4 rounded-xl font-bold text-base shadow-lg flex items-center justify-center gap-2 active:scale-[0.98] transition-all"
          >
            <Check className="w-5 h-5" />
            장비 이동 ({eqtTrnsList.filter(item => item.CHK).length}건)
          </button>
        </>
      )}

      {eqtTrnsList.length === 0 && !isLoading && (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-8">
          <p className="text-center text-gray-500 text-sm">
            바코드를 스캔하거나 기사를 검색하여<br />장비를 조회하세요
          </p>
        </div>
      )}

      {isLoading && (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-8">
          <p className="text-center text-gray-500 text-sm">조회 중...</p>
        </div>
      )}

      {/* 모달들 */}
      <WorkerSearchModal
        isOpen={workerModalOpen}
        onClose={() => setWorkerModalOpen(false)}
        onSelect={(worker) => setWorkerInfo({...workerInfo, WRKR_ID: worker.USR_ID, WRKR_NM: worker.USR_NM})}
        workers={searchedWorkers}
        title="보유기사 선택"
      />

      <BarcodeScanModal
        isOpen={scanModalOpen}
        onClose={() => setScanModalOpen(false)}
        onScan={handleBarcodeScan}
      />
    </div>
  );
};

export default EquipmentMovement;
