import React, { useState, useEffect, useRef } from 'react';
import { findUserList, getWrkrHaveEqtListAll as getWrkrHaveEqtList, changeEquipmentWorker, getEquipmentHistoryInfo } from '../../services/apiService';
import { debugApiCall } from './equipmentDebug';
import { Scan, Search, ChevronDown, ChevronUp, Check, X, User, RotateCcw } from 'lucide-react';
import BarcodeScanner from './BarcodeScanner';
import BaseModal from '../common/BaseModal';

// Scan mode type: scan(단일스캔), equipment(장비번호), worker(보유기사)
type ScanMode = 'scan' | 'equipment' | 'worker';

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

// Transfer result interface
interface TransferResult {
  success: { EQT_SERNO: string; EQT_NO: string; ITEM_NM: string }[];
  failed: { EQT_SERNO: string; EQT_NO: string; ITEM_NM: string; error: string }[];
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

const EquipmentMovement: React.FC<EquipmentMovementProps> = ({ onBack }) => {
  // 로그인한 사용자 = 이관기사 (장비를 인수받는 사람)
  const [loggedInUser, setLoggedInUser] = useState<{ userId: string; userName: string; soId: string; crrId: string }>({
    userId: '', userName: '', soId: '', crrId: ''
  });

  // 보유기사 정보 (타 기사 = 장비를 넘겨주는 사람)
  const [workerInfo, setWorkerInfo] = useState<{ WRKR_ID: string; WRKR_NM: string; SO_ID: string; CRR_ID: string }>({
    WRKR_ID: '', WRKR_NM: '', SO_ID: '', CRR_ID: ''
  });

  const [eqtTrnsList, setEqtTrnsList] = useState<EqtTrns[]>([]);
  const [soList, setSoList] = useState<SoListItem[]>([]);
  const [corpList, setCorpList] = useState<CorpListItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [scannedSerials, setScannedSerials] = useState<string[]>([]); // 스캔된 S/N 목록

  const [workerModalOpen, setWorkerModalOpen] = useState(false);
  const [showBarcodeScanner, setShowBarcodeScanner] = useState(false);
  const [searchedWorkers, setSearchedWorkers] = useState<{ USR_ID: string; USR_NM: string }[]>([]);

  // 조회 모드: equipment(장비조회), worker(보유기사)
  const [scanMode, setScanMode] = useState<ScanMode>('scan');

  // 장비번호 입력
  const [serialInput, setSerialInput] = useState<string>('');

  // 이동 결과
  const [transferResult, setTransferResult] = useState<TransferResult | null>(null);
  const [showResultModal, setShowResultModal] = useState(false);

  // 종류별 접기/펼치기 상태
  const [collapsedCategories, setCollapsedCategories] = useState<Set<string>>(new Set());

  // 뷰 모드: simple(간단히), detail(자세히)
  const [viewMode, setViewMode] = useState<'simple' | 'detail'>('simple');

  // 조회 완료 상태 (결과 표시 여부)
  const [hasSearched, setHasSearched] = useState(false);

  // 기사 검색 팝업 상태
  const [workerSearchKeyword, setWorkerSearchKeyword] = useState('');
  const [isSearchingWorker, setIsSearchingWorker] = useState(false);

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

    // 바코드 스캔 시 - S/N만 저장 (조회 버튼 눌러야 조회됨)
  const handleBarcodeScan = async (serialNo: string) => {
    const normalizedSN = serialNo.toUpperCase().replace(/[:-]/g, '');

    // 이미 스캔된 장비인지 확인 (중복 제거)
    if (scannedSerials.includes(normalizedSN)) {
      alert('이미 스캔된 장비입니다.');
      return;
    }

    // S/N만 저장, 스캐너 닫기
    setScannedSerials(prev => [...new Set([normalizedSN, ...prev])]);
    setShowBarcodeScanner(false);
  };

  // 스캔된 장비로 보유기사 조회
  const handleScannedSearch = async () => {
    if (scannedSerials.length === 0) {
      alert('스캔된 장비가 없습니다.');
      return;
    }

    setIsLoading(true);
    try {
      // 첫 번째 스캔된 S/N으로 장비 정보 조회
      const firstSN = scannedSerials[0];
      const eqtResult = await debugApiCall('EquipmentMovement', 'getEquipmentHistoryInfo',
        () => getEquipmentHistoryInfo({ EQT_SERNO: firstSN }),
        { EQT_SERNO: firstSN }
      );

      if (eqtResult && eqtResult.length > 0) {
        const eqt = eqtResult[0];
        const ownerWrkrId = eqt.WRKR_ID || eqt.OWNER_WRKR_ID;
        const ownerWrkrNm = eqt.WRKR_NM || eqt.OWNER_WRKR_NM || '알수없음';

        if (ownerWrkrId) {
          setWorkerInfo(prev => ({ ...prev, WRKR_ID: ownerWrkrId, WRKR_NM: ownerWrkrNm }));
          await searchEquipmentByWorker(ownerWrkrId, ownerWrkrNm, firstSN);
          setHasSearched(true);
        } else {
          alert(`장비(${firstSN})의 보유기사 정보가 없습니다.`);
        }
      } else {
        alert(`장비(${firstSN})를 찾을 수 없습니다.`);
      }
    } catch (error) {
      console.error('장비 조회 실패:', error);
      alert('장비 조회에 실패했습니다.');
    } finally {
      setIsLoading(false);
    }
  };

  // 장비번호 검색 - 직접 조회
  const handleSerialSearch = async () => {
    const normalizedSN = serialInput.trim().toUpperCase().replace(/[:-]/g, '');
    if (!normalizedSN) {
      alert('장비번호(S/N)를 입력해주세요.');
      return;
    }

    setIsLoading(true);
    try {
      // 장비 정보로 보유기사 조회
      const eqtResult = await debugApiCall('EquipmentMovement', 'getEquipmentHistoryInfo',
        () => getEquipmentHistoryInfo({ EQT_SERNO: normalizedSN }),
        { EQT_SERNO: normalizedSN }
      );

      if (eqtResult && eqtResult.length > 0) {
        const eqt = eqtResult[0];
        const ownerWrkrId = eqt.WRKR_ID || eqt.OWNER_WRKR_ID;
        const ownerWrkrNm = eqt.WRKR_NM || eqt.OWNER_WRKR_NM || '알수없음';

        if (ownerWrkrId) {
          setScannedSerials([normalizedSN]);
          setWorkerInfo(prev => ({ ...prev, WRKR_ID: ownerWrkrId, WRKR_NM: ownerWrkrNm }));
          await searchEquipmentByWorker(ownerWrkrId, ownerWrkrNm, normalizedSN);
          setHasSearched(true);
        } else {
          alert('장비(' + normalizedSN + ')의 보유기사 정보가 없습니다.');
        }
      } else {
        alert('장비(' + normalizedSN + ')를 찾을 수 없습니다.');
      }
    } catch (error) {
      console.error('장비 조회 실패:', error);
      alert('장비 조회에 실패했습니다.');
    } finally {
      setIsLoading(false);
      setSerialInput('');
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
    setHasSearched(true);
  };

  // 기사 검색 팝업 열기
  const openWorkerSearchModal = () => {
    setWorkerSearchKeyword('');
    setSearchedWorkers([]);
    setWorkerModalOpen(true);
  };

  // 기사 검색 (팝업 내에서) - 보유장비 API로 기사 확인
  const handleWorkerModalSearch = async () => {
    if (!workerSearchKeyword.trim()) {
      alert('기사 ID를 입력해주세요.');
      return;
    }
    setIsSearchingWorker(true);
    try {
      const workerId = workerSearchKeyword.trim().toUpperCase();
      // 보유장비 API로 기사 존재 여부 확인
      const equipmentResult = await debugApiCall('EquipmentMovement', 'getWrkrHaveEqtList', 
        () => getWrkrHaveEqtList({ WRKR_ID: workerId, CRR_ID: loggedInUser.crrId || '' }), 
        { WRKR_ID: workerId });
      
      if (equipmentResult && equipmentResult.length > 0) {
        // 보유장비가 있으면 첫번째 장비에서 기사 이름 추출
        const workerName = equipmentResult[0].WRKR_NM || workerId;
        setSearchedWorkers([{ USR_ID: workerId, USR_NM: workerName, EQT_COUNT: equipmentResult.length }]);
      } else {
        // 보유장비가 없어도 기사 ID로 검색 결과 표시
        setSearchedWorkers([{ USR_ID: workerId, USR_NM: workerId, EQT_COUNT: 0 }]);
      }
    } catch (error) {
      console.error('기사 검색 실패:', error);
      alert('기사 검색에 실패했습니다.');
      setSearchedWorkers([]);
    } finally {
      setIsSearchingWorker(false);
    }
  };

  // 기사 선택
  const handleWorkerSelect = (worker: { USR_ID: string; USR_NM: string; EQT_COUNT?: number }) => {
    setWorkerInfo(prev => ({ ...prev, WRKR_ID: worker.USR_ID, WRKR_NM: worker.USR_NM }));
    setWorkerModalOpen(false);
  };

  // 초기화 (검색 모드로 복귀)
  const handleReset = () => {
    setHasSearched(false);
    setEqtTrnsList([]);
    setScannedSerials([]);
    setWorkerInfo(prev => ({ ...prev, WRKR_ID: '', WRKR_NM: '' }));
    setSerialInput('');
  };

  const handleTransfer = async () => {
    const checkedItems = eqtTrnsList.filter(item => item.CHK);
    if (checkedItems.length === 0) { alert('이동할 장비를 선택해주세요.'); return; }
    if (!loggedInUser.userId) { alert('로그인 정보가 없습니다.'); return; }
    if (!confirm(`${workerInfo.WRKR_NM}(${workerInfo.WRKR_ID})의 장비 ${checkedItems.length}건을 인수하시겠습니까?`)) return;

    setIsLoading(true);
    const results: TransferResult = { success: [], failed: [] };

    try {
      for (const item of checkedItems) {
        try {
          const params = {
            EQT_NO: item.EQT_NO,
            FROM_WRKR_ID: workerInfo.WRKR_ID,
            TO_WRKR_ID: loggedInUser.userId
          };
          await debugApiCall('EquipmentMovement', 'changeEquipmentWorker', () => changeEquipmentWorker(params), params);
          results.success.push({
            EQT_SERNO: item.EQT_SERNO,
            EQT_NO: item.EQT_NO,
            ITEM_NM: item.ITEM_NM || item.EQT_CL_NM
          });
        } catch (err: any) {
          console.error('장비 이동 실패:', item.EQT_SERNO, err);
          results.failed.push({
            EQT_SERNO: item.EQT_SERNO,
            EQT_NO: item.EQT_NO,
            ITEM_NM: item.ITEM_NM || item.EQT_CL_NM,
            error: err?.message || '알 수 없는 오류'
          });
        }
      }

      // 결과 표시
      setTransferResult(results);
      setShowResultModal(true);

      if (results.success.length > 0) {
        // 성공한 장비는 목록에서 제거
        const successNos = new Set(results.success.map(r => r.EQT_NO));
        setEqtTrnsList(prev => prev.filter(item => !successNos.has(item.EQT_NO)));
        setScannedSerials(prev => prev.filter(sn =>
          !results.success.some(r => r.EQT_SERNO === sn)
        ));
      }
    } catch (error) {
      console.error('장비 이동 실패:', error);
      alert('장비 이동에 실패했습니다.');
    } finally {
      setIsLoading(false);
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

  // 스캔 초기화
  const handleClearScanned = () => {
    setScannedSerials([]);
    setEqtTrnsList([]);
    setWorkerInfo({ WRKR_ID: '', WRKR_NM: '', SO_ID: workerInfo.SO_ID, CRR_ID: '' });
  };

  return (
    <div className="h-full overflow-y-auto bg-gray-50 px-4 py-4 space-y-3">
      {/* 검색 영역 - 조회 전에만 표시 */}
      {!hasSearched && (
        <>
          {/* 조회 모드 선택 - 3개 버튼 */}
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
            <div className="grid grid-cols-3 gap-2">
          <button
            onClick={() => setScanMode('scan')}
            className={`py-3 px-2 rounded-lg text-sm font-medium transition-all ${
              scanMode === 'scan'
                ? 'bg-purple-500 text-white shadow-sm'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >단일스캔</button>
          <button
            onClick={() => setScanMode('equipment')}
            className={`py-3 px-2 rounded-lg text-sm font-medium transition-all ${
              scanMode === 'equipment'
                ? 'bg-blue-500 text-white shadow-sm'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >장비번호</button>
          <button
            onClick={() => setScanMode('worker')}
            className={`py-3 px-2 rounded-lg text-sm font-medium transition-all ${
              scanMode === 'worker'
                ? 'bg-green-500 text-white shadow-sm'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >보유기사</button>
        </div>
      </div>

      {/* 단일스캔 영역 (scan 모드) - 바코드 스캔만 */}
      {scanMode === 'scan' && (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
          <div className="mb-3">
            <h3 className="text-sm font-semibold text-gray-800 flex items-center gap-2">
              <Scan className="w-4 h-4" />
              바코드 스캔
            </h3>
            <p className="text-xs text-gray-500 mt-0.5">바코드를 스캔하여 장비를 조회합니다</p>
          </div>

          {/* 바코드 스캔 버튼 */}
          <button
            onClick={() => setShowBarcodeScanner(true)}
            className="w-full py-4 rounded-xl font-semibold text-base shadow-lg flex items-center justify-center gap-3 active:scale-[0.98] transition-all touch-manipulation bg-gradient-to-r from-purple-500 to-purple-600 text-white"
          >
            <Scan className="w-6 h-6" />
            바코드 스캔
          </button>

          {/* 스캔된 장비 표시 영역 */}
          {scannedSerials.length > 0 && (
            <div className="mt-3 p-3 bg-purple-50 border border-purple-200 rounded-lg">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-medium text-purple-700">스캔된 장비 ({scannedSerials.length}건)</span>
                <button
                  onClick={() => setScannedSerials([])}
                  className="text-xs text-purple-600 hover:text-purple-800"
                >
                  전체 삭제
                </button>
              </div>
              <div className="space-y-1 max-h-24 overflow-y-auto">
                {scannedSerials.map((sn, idx) => (
                  <div key={idx} className="flex items-center justify-between text-xs bg-white px-2 py-1 rounded">
                    <span className="font-mono text-gray-800">{sn}</span>
                    <button
                      onClick={() => setScannedSerials(prev => prev.filter(s => s !== sn))}
                      className="text-red-400 hover:text-red-600"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>
              <button
                onClick={handleScannedSearch}
                disabled={isLoading}
                className="w-full mt-2 py-2 bg-purple-500 hover:bg-purple-600 disabled:bg-gray-300 text-white rounded-lg font-semibold text-sm transition-all active:scale-[0.98]"
              >
                {isLoading ? '조회 중...' : '조회'}
              </button>
            </div>
          )}
        </div>
      )}

      {/* 장비번호 영역 (equipment 모드) - S/N 입력만 */}
      {scanMode === 'equipment' && (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
          <div className="mb-3">
            <h3 className="text-sm font-semibold text-gray-800 flex items-center gap-2">
              <Search className="w-4 h-4" />
              장비번호 조회
            </h3>
            <p className="text-xs text-gray-500 mt-0.5">S/N 또는 MAC 주소를 입력하여 조회합니다</p>
          </div>

          {/* S/N 직접 입력 */}
          <div className="space-y-3">
            <input
              type="text"
              value={serialInput}
              onChange={(e) => setSerialInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSerialSearch()}
              className="w-full px-4 py-3 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 font-mono uppercase"
              placeholder="S/N 또는 MAC 주소 입력"
            />
            <button
              onClick={handleSerialSearch}
              disabled={isLoading || !serialInput.trim()}
              className="w-full py-3 bg-blue-500 hover:bg-blue-600 disabled:bg-gray-300 text-white rounded-lg font-semibold text-sm shadow-sm transition-all active:scale-[0.98]"
            >
              {isLoading ? '조회 중...' : '조회'}
            </button>
          </div>
        </div>
      )}

      {/* 보유기사 조회 영역 (worker 모드) - 지점 제거, ID로만 조회 */}

      {scanMode === 'worker' && (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
          <div className="mb-3">
            <h3 className="text-sm font-semibold text-gray-800 flex items-center gap-2">
              <User className="w-4 h-4" />
              보유기사 검색
            </h3>
            <p className="text-xs text-gray-500 mt-0.5">기사를 검색하여 보유 장비를 조회합니다</p>
          </div>
          <div className="space-y-3">
            {/* 보유기사 입력 - 전체 영역 클릭 시 팝업 */}
            <div
              className="flex items-center gap-2 cursor-pointer"
              onClick={openWorkerSearchModal}
            >
              <input
                type="text"
                value={workerInfo.WRKR_NM}
                readOnly
                className="flex-1 min-w-0 px-3 py-2.5 text-sm border border-gray-200 rounded-lg bg-gray-50 cursor-pointer"
                placeholder="기사명"
              />
              <button
                type="button"
                className="flex-shrink-0 px-4 py-2.5 text-sm border border-green-500 text-green-600 rounded-lg bg-white hover:bg-green-50 active:scale-[0.98] transition-all font-medium"
              >
                <Search className="w-4 h-4" />
              </button>
              <input
                type="text"
                value={workerInfo.WRKR_ID}
                readOnly
                className="w-28 px-2 py-2.5 text-xs border border-gray-200 rounded-lg flex-shrink-0 bg-gray-50 cursor-pointer"
                placeholder="ID"
              />
            </div>

            {/* 조회 버튼 */}
            <button
              onClick={handleSearch}
              disabled={isLoading || !workerInfo.WRKR_ID}
              className="w-full bg-green-500 hover:bg-green-600 disabled:bg-gray-300 text-white py-2.5 rounded-lg font-semibold text-sm shadow-sm transition-all active:scale-[0.98]"
            >
              {isLoading ? '조회 중...' : '조회'}
            </button>
          </div>
        </div>
      )}
        </>
      )}

      {/* 스캔된 장비 표시 - 조회 전에만 */}
      {!hasSearched && scannedSerials.length > 0 && (
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
          <div className="flex flex-wrap gap-1 mb-3">
            {scannedSerials.map((sn, idx) => (
              <span key={idx} className="px-2 py-1 bg-purple-100 text-purple-800 text-xs rounded-md font-mono">
                {sn}
              </span>
            ))}
          </div>
          {/* 조회 버튼 */}
          <button
            onClick={handleScannedSearch}
            disabled={isLoading}
            className="w-full bg-purple-500 hover:bg-purple-600 disabled:bg-gray-300 text-white py-3 rounded-lg font-semibold text-sm shadow-sm transition-all active:scale-[0.98]"
          >
            {isLoading ? '조회 중...' : '조회'}
          </button>
        </div>
      )}

      {/* 조회 결과 - 종류별 그룹화 */}
      {eqtTrnsList.length > 0 && (
        <>
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
            {/* 헤더 */}
            <div className="px-4 py-3 bg-gradient-to-r from-gray-50 to-white border-b border-gray-100">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleReset}
                    className="p-1.5 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
                    title="초기화"
                  >
                    <RotateCcw className="w-4 h-4" />
                  </button>
                  <div>
                    <span className="text-sm font-semibold text-gray-800">
                      {workerInfo.WRKR_NM} 보유장비: {eqtTrnsList.length}건
                    </span>
                    <span className="text-sm text-blue-600 ml-2 font-medium">
                      (선택: {eqtTrnsList.filter(item => item.CHK).length}건)
                    </span>
                  </div>
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
              {/* 뷰 모드 선택 버튼 */}
              <div className="flex gap-1 bg-gray-100 p-1 rounded-lg">
                <button
                  onClick={() => setViewMode('simple')}
                  className={`flex-1 py-1.5 px-2 text-xs font-medium rounded-md transition-all ${
                    viewMode === 'simple'
                      ? 'bg-white text-blue-600 shadow-sm'
                      : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  간단히
                </button>
                <button
                  onClick={() => setViewMode('detail')}
                  className={`flex-1 py-1.5 px-2 text-xs font-medium rounded-md transition-all ${
                    viewMode === 'detail'
                      ? 'bg-white text-blue-600 shadow-sm'
                      : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  자세히
                </button>
              </div>
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
                              {/* 간단히 보기 */}
                              {viewMode === 'simple' && (
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                      <span className="px-1.5 py-0.5 bg-blue-100 text-blue-700 text-[10px] rounded font-medium">
                                        {item.ITEM_MID_NM || item.EQT_CL_NM || '장비'}
                                      </span>
                                      {item.isScanned && (
                                        <span className="px-1.5 py-0.5 bg-purple-500 text-white text-[10px] rounded font-medium">스캔</span>
                                      )}
                                    </div>
                                  </div>
                                  <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs mt-1.5">
                                    <div className="flex items-center gap-1">
                                      <span className="text-gray-400 w-10">S/N</span>
                                      <span className="font-mono text-gray-800 truncate">{item.EQT_SERNO || '-'}</span>
                                    </div>
                                    <div className="flex items-center gap-1">
                                      <span className="text-gray-400 w-10">MAC</span>
                                      <span className="font-mono text-gray-600 truncate">{item.MAC_ADDRESS || '-'}</span>
                                    </div>
                                  </div>
                                </div>
                              )}
                              {/* 자세히 보기 */}
                              {viewMode === 'detail' && (
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center justify-between mb-2">
                                    <div className="flex items-center gap-2">
                                      <span className="text-sm font-bold text-gray-900">{item.ITEM_NM || item.EQT_CL_NM || '장비'}</span>
                                      {item.isScanned && (
                                        <span className="px-1.5 py-0.5 bg-purple-500 text-white text-[10px] rounded font-medium">스캔</span>
                                      )}
                                    </div>
                                  </div>
                                  <div className="bg-gray-50 rounded-lg p-2">
                                    <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
                                      <div className="flex">
                                        <span className="text-gray-400 w-14 flex-shrink-0">S/N</span>
                                        <span className="font-mono text-gray-900">{item.EQT_SERNO || '-'}</span>
                                      </div>
                                      <div className="flex">
                                        <span className="text-gray-400 w-14 flex-shrink-0">MAC</span>
                                        <span className="font-mono text-gray-700">{item.MAC_ADDRESS || '-'}</span>
                                      </div>
                                      <div className="flex">
                                        <span className="text-gray-400 w-14 flex-shrink-0">지점</span>
                                        <span className="text-gray-700">{item.SO_NM || item.SO_ID || '-'}</span>
                                      </div>
                                      <div className="flex">
                                        <span className="text-gray-400 w-14 flex-shrink-0">보유자</span>
                                        <span className="text-gray-700">{item.WRKR_NM || '-'}</span>
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              )}
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
      <BaseModal
        isOpen={workerModalOpen}
        onClose={() => setWorkerModalOpen(false)}
        title="기사 검색"
        size="medium"
        subHeader={
          <div className="flex gap-2">
            <input
              type="text"
              value={workerSearchKeyword}
              onChange={(e) => setWorkerSearchKeyword(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleWorkerModalSearch()}
              className="flex-1 px-3 py-2 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-green-500"
              placeholder="이름 또는 ID 입력"
              autoFocus
            />
            <button
              onClick={handleWorkerModalSearch}
              disabled={isSearchingWorker}
              className="px-4 py-2 bg-green-500 hover:bg-green-600 disabled:bg-gray-300 text-white rounded-lg font-medium text-sm"
            >
              {isSearchingWorker ? '...' : '검색'}
            </button>
          </div>
        }
        footer={
          <button
            onClick={() => setWorkerModalOpen(false)}
            className="w-full py-2.5 text-sm text-gray-600 hover:bg-gray-100 rounded-lg font-medium transition-colors"
          >
            닫기
          </button>
        }
      >
        {searchedWorkers.length === 0 ? (
          <div className="py-8 text-center text-gray-500 text-sm">
            {isSearchingWorker ? '검색 중...' : '기사 이름 또는 ID를 검색하세요'}
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {searchedWorkers.map((worker, idx) => (
              <button
                key={idx}
                onClick={() => handleWorkerSelect(worker)}
                className="w-full px-4 py-3 text-left hover:bg-green-50 flex justify-between items-center transition-colors active:bg-green-100 touch-manipulation"
              >
                <div className="flex flex-col">
                  <span className="font-medium text-gray-900">{worker.USR_NM}</span>
                  <span className="text-xs text-gray-500">{worker.USR_ID}</span>
                </div>
                <span className="text-xs text-blue-600 bg-blue-50 px-2 py-1 rounded">
                  {worker.EQT_COUNT !== undefined ? `${worker.EQT_COUNT}건` : ''}
                </span>
              </button>
            ))}
          </div>
        )}
      </BaseModal>

      {/* 바코드 스캐너 */}
      <BarcodeScanner
        isOpen={showBarcodeScanner}
        onClose={() => setShowBarcodeScanner(false)}
        onScan={handleBarcodeScan}
        isMultiScanMode={false}
        scanCount={scannedSerials.length}
      />

      {/* 이동 결과 모달 */}
      {showResultModal && transferResult && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md max-h-[80vh] overflow-hidden">
            {/* 헤더 */}
            <div className={`p-4 ${
              transferResult.failed.length === 0
                ? 'bg-gradient-to-r from-green-500 to-green-600'
                : transferResult.success.length === 0
                  ? 'bg-gradient-to-r from-red-500 to-red-600'
                  : 'bg-gradient-to-r from-amber-500 to-amber-600'
            }`}>
              <h3 className="font-semibold text-white text-lg">
                {transferResult.failed.length === 0 ? '이동 완료' :
                 transferResult.success.length === 0 ? '이동 실패' : '부분 성공'}
              </h3>
              <p className="text-white/80 text-sm mt-1">
                성공: {transferResult.success.length}건 / 실패: {transferResult.failed.length}건
              </p>
            </div>

            {/* 내용 */}
            <div className="p-4 max-h-96 overflow-y-auto space-y-4">
              {/* 성공 목록 */}
              {transferResult.success.length > 0 && (
                <div>
                  <h4 className="text-sm font-semibold text-green-700 mb-2 flex items-center gap-2">
                    <Check className="w-4 h-4" />
                    성공 ({transferResult.success.length}건)
                  </h4>
                  <div className="space-y-1">
                    {transferResult.success.map((item, idx) => (
                      <div key={idx} className="flex items-center justify-between p-2 bg-green-50 rounded-lg text-xs">
                        <span className="font-mono text-green-800">{item.EQT_SERNO}</span>
                        <span className="text-green-600">{item.ITEM_NM}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* 실패 목록 */}
              {transferResult.failed.length > 0 && (
                <div>
                  <h4 className="text-sm font-semibold text-red-700 mb-2 flex items-center gap-2">
                    <X className="w-4 h-4" />
                    실패 ({transferResult.failed.length}건)
                  </h4>
                  <div className="space-y-1">
                    {transferResult.failed.map((item, idx) => (
                      <div key={idx} className="p-2 bg-red-50 rounded-lg text-xs">
                        <div className="flex items-center justify-between">
                          <span className="font-mono text-red-800">{item.EQT_SERNO}</span>
                          <span className="text-red-600">{item.ITEM_NM}</span>
                        </div>
                        <div className="text-red-500 mt-1">{item.error}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* 닫기 버튼 */}
            <div className="p-4 border-t border-gray-100 bg-gray-50">
              <button
                onClick={() => {
                  setShowResultModal(false);
                  setTransferResult(null);
                }}
                className="w-full py-2.5 bg-gray-800 hover:bg-gray-900 text-white rounded-lg font-medium transition-colors"
              >
                확인
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default EquipmentMovement;
