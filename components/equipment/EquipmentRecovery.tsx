import React, { useState, useEffect } from 'react';
import { getUnreturnedEquipmentList, processEquipmentRecovery, getEquipmentHistoryInfo } from '../../services/apiService';
import { debugApiCall } from './equipmentDebug';
import { Scan, Check, ChevronDown, ChevronUp } from 'lucide-react';
import BarcodeScanner from './BarcodeScanner';

// SO (jijum) info type
interface SoInfo {
  SO_ID: string;
  SO_NM: string;
}

interface EquipmentRecoveryProps {
  onBack: () => void;
}

interface UnreturnedEqtSearch {
  CUST_ID: string;
  CUST_NM: string;
  PHONE_NO: string;
  EQT_CL_CD: string;
  EQT_SERNO: string;
}

interface UnreturnedEqt {
  CHK: boolean;
  CUST_ID: string;
  CUST_NM: string;
  CTRT_ID: string;
  EQT_NO: string;
  EQT_SERNO: string;
  EQT_CL_CD: string;
  EQT_CL_NM: string;
  ITEM_NM: string;
  TRML_DT: string;
  WRK_ID: string;
  WRKR_ID: string;
  WRKR_NM: string;
  SO_ID: string;
  SO_NM: string;
  PHONE_NO: string;
  ADDRESS: string;
  RETN_REQ_YN: string;
  LOSS_AMT: string;
  CRR_ID: string;
  CMPL_DATE: string;
  isScanned?: boolean;
}

// Date format function (YYYY.MM.DD)
const formatDateDot = (dateStr: string): string => {
  if (!dateStr) return '';
  if (dateStr.length === 8 && !dateStr.includes('-') && !dateStr.includes('.')) {
    return `${dateStr.slice(0, 4)}.${dateStr.slice(4, 6)}.${dateStr.slice(6, 8)}`;
  }
  if (dateStr.includes('-')) {
    return dateStr.replace(/-/g, '.');
  }
  return dateStr;
};

// Date to YYYYMMDD (API)
const formatDateApi = (dateStr: string): string => {
  if (!dateStr) return '';
  return dateStr.replace(/[-\.]/g, '');
};

// Date to YYYY-MM-DD (input)
const formatDateInput = (dateStr: string): string => {
  if (!dateStr) return '';
  if (dateStr.length === 8 && !dateStr.includes('-') && !dateStr.includes('.')) {
    return `${dateStr.slice(0, 4)}-${dateStr.slice(4, 6)}-${dateStr.slice(6, 8)}`;
  }
  if (dateStr.includes('.')) {
    return dateStr.replace(/\./g, '-');
  }
  return dateStr;
};

// Recovery Modal
const RecoveryModal: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  selectedItems: UnreturnedEqt[];
  onProcess: (procType: string, soId: string) => void;
  isProcessing: boolean;
  soList: SoInfo[];
}> = ({ isOpen, onClose, selectedItems, onProcess, isProcessing, soList }) => {
  const [selectedSoId, setSelectedSoId] = useState<string>('');

  useEffect(() => {
    if (isOpen && soList.length > 0 && !selectedSoId) {
      setSelectedSoId(soList[0].SO_ID);
    }
  }, [isOpen, soList, selectedSoId]);

  if (!isOpen) return null;

  const handleProcess = () => {
    if (!selectedSoId) {
      alert('jijum selection required.');
      return;
    }
    onProcess('1', selectedSoId);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-sm overflow-hidden">
        <div className="p-4 border-b border-gray-100 bg-gradient-to-r from-green-500 to-green-600">
          <h3 className="font-semibold text-white">미회수 장비 회수</h3>
          <p className="text-xs text-white/80 mt-1">{selectedItems.length}건 처리 예정</p>
        </div>
        <div className="p-4 space-y-3">
          <div className="bg-gray-50 rounded-lg p-3 max-h-32 overflow-y-auto">
            {selectedItems.map((item, idx) => (
              <div key={idx} className="text-xs text-gray-600 py-1 border-b border-gray-100 last:border-0">
                <span className="font-mono font-medium">{item.EQT_SERNO}</span>
                <span className="text-gray-400 ml-2">{item.CUST_NM}</span>
              </div>
            ))}
          </div>
          <div className="space-y-2">
            <label className="text-xs font-medium text-gray-700">회수 지점 선택</label>
            <select
              value={selectedSoId}
              onChange={(e) => setSelectedSoId(e.target.value)}
              className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
              disabled={isProcessing}
            >
              <option value="">지점 선택</option>
              {soList.map((so) => (
                <option key={so.SO_ID} value={so.SO_ID}>
                  {so.SO_NM} ({so.SO_ID})
                </option>
              ))}
            </select>
          </div>
          <button
            onClick={handleProcess}
            disabled={isProcessing || !selectedSoId}
            className="w-full py-3 text-sm text-white bg-green-500 hover:bg-green-600 disabled:bg-gray-300 rounded-lg font-medium transition-colors flex items-center justify-center gap-2"
          >
            <Check className="w-4 h-4" />
            {isProcessing ? '처리 중...' : '회수 완료'}
          </button>
          <button
            onClick={onClose}
            disabled={isProcessing}
            className="w-full py-2.5 text-sm text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-lg font-medium transition-colors"
          >
            취소
          </button>
        </div>
      </div>
    </div>
  );
};

const EquipmentRecovery: React.FC<EquipmentRecoveryProps> = ({ onBack }) => {
  const [searchParams, setSearchParams] = useState<UnreturnedEqtSearch>({
    CUST_ID: '',
    CUST_NM: '',
    PHONE_NO: '',
    EQT_CL_CD: '',
    EQT_SERNO: ''
  });

  const [unreturnedList, setUnreturnedList] = useState<UnreturnedEqt[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [scanModalOpen, setScanModalOpen] = useState(false);
  const [recoveryModalOpen, setRecoveryModalOpen] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [scannedSerials, setScannedSerials] = useState<string[]>([]);
  const [soList, setSoList] = useState<SoInfo[]>([]);
  const [viewMode, setViewMode] = useState<'simple' | 'detail'>('simple');
  const [lossFilter, setLossFilter] = useState<'all' | 'lost' | 'notLost'>('all');
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());

  // Toggle group collapse
  const toggleGroup = (groupKey: string) => {
    setCollapsedGroups(prev => {
      const newSet = new Set(Array.from(prev));
      if (newSet.has(groupKey)) {
        newSet.delete(groupKey);
      } else {
        newSet.add(groupKey);
      }
      return newSet;
    });
  };

  // Lost equipment check (LOSS_AMT > 0 means lost)
  const isLostEquipment = (item: UnreturnedEqt): boolean => {
    return item.LOSS_AMT !== '' && item.LOSS_AMT !== '0' && Number(item.LOSS_AMT) > 0;
  };

  // Filtered list
  const getFilteredList = (): UnreturnedEqt[] => {
    if (lossFilter === 'all') return unreturnedList;
    if (lossFilter === 'lost') return unreturnedList.filter(item => isLostEquipment(item));
    return unreturnedList.filter(item => !isLostEquipment(item));
  };

  const filteredList = getFilteredList();
  const lostCount = unreturnedList.filter(item => isLostEquipment(item)).length;
  const notLostCount = unreturnedList.length - lostCount;

  // 2-level grouping: Branch > Equipment Type
  const groupedByLocation = filteredList.reduce((acc, item, idx) => {
    const soKey = item.SO_NM || item.SO_ID || 'Unassigned';
    const itemTypeKey = item.EQT_CL_NM || 'Other';
    if (!acc[soKey]) acc[soKey] = {};
    if (!acc[soKey][itemTypeKey]) acc[soKey][itemTypeKey] = [];
    acc[soKey][itemTypeKey].push({ ...item, _globalIdx: idx });
    return acc;
  }, {} as Record<string, Record<string, (UnreturnedEqt & { _globalIdx: number })[]>>);

  const soKeys = Object.keys(groupedByLocation).sort();

  // Check all in SO group
  const handleCheckSo = (soKey: string, checked: boolean) => {
    setUnreturnedList(unreturnedList.map(item => {
      const itemSo = item.SO_NM || item.SO_ID || 'Unassigned';
      const isLost = isLostEquipment(item);
      return itemSo === soKey && isLost ? { ...item, CHK: checked } : item;
    }));
  };

  // Check all in item type group
  const handleCheckItemType = (soKey: string, itemTypeKey: string, checked: boolean) => {
    setUnreturnedList(unreturnedList.map(item => {
      const itemSo = item.SO_NM || item.SO_ID || 'Unassigned';
      const itemType = item.EQT_CL_NM || 'Other';
      const isLost = isLostEquipment(item);
      return (itemSo === soKey && itemType === itemTypeKey && isLost) ? { ...item, CHK: checked } : item;
    }));
  };

  // SO list load
  useEffect(() => {
    const userInfoStr = typeof window !== 'undefined' ? sessionStorage.getItem('userInfo') : null;
    if (userInfoStr) {
      try {
        const userInfo = JSON.parse(userInfoStr);
        const authSoList = userInfo.authSoList || userInfo.AUTH_SO_List || [];
        if (Array.isArray(authSoList) && authSoList.length > 0) {
          const mappedList: SoInfo[] = authSoList.map((so: any) => ({
            SO_ID: so.SO_ID || so.soId || '',
            SO_NM: so.SO_NM || so.soNm || so.SO_ID || ''
          })).filter((so: SoInfo) => so.SO_ID);
          setSoList(mappedList);
        }
      } catch (e) {
        console.error('SO list load failed:', e);
      }
    }
  }, []);

  // Barcode scan handler
  const handleBarcodeScan = async (serialNo: string) => {
    setIsLoading(true);
    try {
      setScannedSerials(prev => [...new Set([serialNo, ...prev])]);

      const params = {
        EQT_SERNO: serialNo
      };

      const result = await debugApiCall(
        'EquipmentRecovery',
        'getUnreturnedEquipmentList (barcode)',
        () => getUnreturnedEquipmentList(params),
        params
      );

      if (result && result.length > 0) {
        const transformedList: UnreturnedEqt[] = result.map((item: any) => ({
          CHK: item.EQT_SERNO === serialNo,
          CUST_ID: item.CUST_ID || '',
          CUST_NM: item.CUST_NM || '',
          CTRT_ID: item.CTRT_ID || '',
          EQT_NO: item.EQT_NO || '',
          EQT_SERNO: item.EQT_SERNO || '',
          EQT_CL_CD: item.EQT_CL_CD || '',
          EQT_CL_NM: item.EQT_CL_NM || item.EQT_NM || '',
          ITEM_NM: item.ITEM_NM || '',
          TRML_DT: item.TRML_DT || '',
          WRK_ID: item.WRK_ID || '',
          WRKR_ID: item.WRKR_ID || '',
          WRKR_NM: item.WRKR_NM || '',
          SO_ID: item.SO_ID || '',
          SO_NM: item.SO_NM || '',
          PHONE_NO: item.PHONE_NO || '',
          ADDRESS: item.ADDRESS || '',
          RETN_REQ_YN: item.RETN_REQ_YN || '',
          LOSS_AMT: item.LOSS_AMT || '',
          CRR_ID: item.CRR_ID || '',
          CMPL_DATE: item.CMPL_DATE || '',
          isScanned: item.EQT_SERNO === serialNo
        }));
        setUnreturnedList(transformedList);
      } else {
        const eqtResult = await debugApiCall(
          'EquipmentRecovery',
          'getEquipmentHistoryInfo',
          () => getEquipmentHistoryInfo({ EQT_SERNO: serialNo }),
          { EQT_SERNO: serialNo }
        );

        if (eqtResult && eqtResult.length > 0) {
          const eqt = eqtResult[0];
          alert(`Equipment (${serialNo}) is not unreturned.\n\nHolder: ${eqt.WRKR_NM || 'None'}\nBranch: ${eqt.SO_NM || 'None'}\nStatus: ${eqt.EQT_STAT_NM || eqt.EQT_STAT_CD || 'Unknown'}`);
        } else {
          alert(`Equipment (${serialNo}) not found.`);
        }
        setUnreturnedList([]);
      }
    } catch (error) {
      console.error('Barcode scan failed:', error);
      alert('Equipment lookup failed.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSearch = async () => {
    if (!searchParams.EQT_SERNO && !searchParams.CUST_ID && !searchParams.CUST_NM) {
      alert('Enter at least one of S/N, Customer ID, or Customer Name.');
      return;
    }

    setIsLoading(true);
    try {
      const params: any = {};

      if (searchParams.EQT_SERNO) params.EQT_SERNO = searchParams.EQT_SERNO;
      if (searchParams.CUST_ID) params.CUST_ID = searchParams.CUST_ID;
      if (searchParams.CUST_NM) params.CUST_NM = searchParams.CUST_NM;

      const result = await debugApiCall(
        'EquipmentRecovery',
        'getUnreturnedEquipmentList',
        () => getUnreturnedEquipmentList(params),
        params
      );

      const transformedList: UnreturnedEqt[] = (result || []).map((item: any) => ({
        CHK: scannedSerials.includes(item.EQT_SERNO),
        CUST_ID: item.CUST_ID || '',
        CUST_NM: item.CUST_NM || '',
        CTRT_ID: item.CTRT_ID || '',
        EQT_NO: item.EQT_NO || '',
        EQT_SERNO: item.EQT_SERNO || '',
        EQT_CL_CD: item.EQT_CL_CD || '',
        EQT_CL_NM: item.EQT_CL_NM || item.EQT_NM || '',
        ITEM_NM: item.ITEM_NM || '',
        TRML_DT: item.TRML_DT || '',
        WRK_ID: item.WRK_ID || '',
        WRKR_ID: item.WRKR_ID || '',
        WRKR_NM: item.WRKR_NM || '',
        SO_ID: item.SO_ID || '',
        SO_NM: item.SO_NM || '',
        PHONE_NO: item.PHONE_NO || '',
        ADDRESS: item.ADDRESS || '',
        RETN_REQ_YN: item.RETN_REQ_YN || '',
        LOSS_AMT: item.LOSS_AMT || '',
        CRR_ID: item.CRR_ID || '',
        CMPL_DATE: item.CMPL_DATE || '',
        isScanned: scannedSerials.includes(item.EQT_SERNO)
      }));

      transformedList.sort((a, b) => {
        if (a.isScanned && !b.isScanned) return -1;
        if (!a.isScanned && b.isScanned) return 1;
        return 0;
      });

      setUnreturnedList(transformedList);
    } catch (error) {
      console.error('Unreturned equipment lookup failed:', error);
      alert('Unreturned equipment lookup failed.');
      setUnreturnedList([]);
    } finally {
      setIsLoading(false);
    }
  };

  // Recovery process
  const handleRecoveryProcess = async (procType: string, soId: string) => {
    const selectedItems = unreturnedList.filter(item => item.CHK);
    if (selectedItems.length === 0) return;

    setIsProcessing(true);
    try {
      let successCount = 0;
      let skipCount = 0;
      for (const item of selectedItems) {
        try {
          if (!item.EQT_NO || item.EQT_NO.length !== 20 || !/^\d+$/.test(item.EQT_NO)) {
            console.warn('Invalid EQT_NO format:', item.EQT_SERNO, item.EQT_NO);
            skipCount++;
            continue;
          }

          const userInfoStr = typeof window !== 'undefined' ? sessionStorage.getItem('userInfo') : null;
          const userInfo = userInfoStr ? JSON.parse(userInfoStr) : {};
          const today = new Date().toISOString().slice(0,10).replace(/-/g, '');

          const params = {
            EQT_NO: item.EQT_NO,
            EQT_SERNO: item.EQT_SERNO,
            PROC_CL: procType,
            CUST_ID: item.CUST_ID,
            CTRT_ID: item.CTRT_ID,
            WRK_ID: item.WRK_ID,
            CRR_ID: item.CRR_ID || userInfo.crrId || '',
            WRKR_ID: item.WRKR_ID || userInfo.userId || '',
            SO_ID: soId || item.SO_ID || userInfo.soId || '',
            CHG_UID: userInfo.userId || '',
            PROC_UID_SO_ID: soId || userInfo.soId || item.SO_ID || '',
            RTN_DD: today,
            RTN_TP: '3',
            STTL_YN: 'N'
          };
          await debugApiCall(
            'EquipmentRecovery',
            'processEquipmentRecovery',
            () => processEquipmentRecovery(params),
            params
          );
          successCount++;
        } catch (err) {
          console.error('Recovery process failed:', item.EQT_SERNO, err);
        }
      }

      if (successCount > 0) {
        let msg = successCount + ' items recovery completed.';
        if (skipCount > 0) {
          msg += `\n(${skipCount} items skipped due to EQT_NO format error)`;
        }
        alert(msg);
        setRecoveryModalOpen(false);
        setScannedSerials([]);
        handleSearch();
      } else {
        throw new Error('Process failed.');
      }
    } catch (error) {
      console.error('Recovery process failed:', error);
      alert('Recovery process failed.');
    } finally {
      setIsProcessing(false);
    }
  };

  // Check all (only lost equipment)
  const handleCheckAll = (checked: boolean) => {
    setUnreturnedList(unreturnedList.map(item => {
      const isLost = isLostEquipment(item);
      return { ...item, CHK: isLost ? checked : false };
    }));
  };

  // Individual check (only lost equipment)
  const handleCheckItem = (index: number, checked: boolean) => {
    const newList = [...unreturnedList];
    const item = newList[index];
    if (isLostEquipment(item)) {
      newList[index].CHK = checked;
      setUnreturnedList(newList);
    }
  };

  const selectedCount = unreturnedList.filter(item => item.CHK).length;

  // Render equipment item - 장비처리와 동일한 레이아웃
  const renderEquipmentItem = (item: UnreturnedEqt & { _globalIdx: number }) => {
    const isLost = isLostEquipment(item);
    const canSelect = isLost;
    const originalIdx = unreturnedList.findIndex(u => u.EQT_SERNO === item.EQT_SERNO);

    return (
      <div
        key={item._globalIdx}
        onClick={() => canSelect && handleCheckItem(originalIdx, !item.CHK)}
        className={`p-3 rounded-lg border-2 cursor-pointer transition-all ${
          item.CHK
            ? 'bg-blue-50 border-blue-400'
            : !canSelect
              ? 'opacity-60 bg-gray-100 border-gray-200 cursor-not-allowed'
              : item.isScanned
                ? 'bg-orange-50 border-orange-200 hover:border-orange-300'
                : 'bg-white border-gray-100 hover:border-gray-300'
        }`}
      >
        <div className="flex items-start gap-3">
          <input
            type="checkbox"
            checked={item.CHK || false}
            onChange={(e) => { e.stopPropagation(); handleCheckItem(originalIdx, e.target.checked); }}
            disabled={!canSelect}
            className={`w-5 h-5 rounded focus:ring-blue-500 mt-0.5 ${
              !canSelect ? 'text-gray-300 cursor-not-allowed' : 'text-blue-500'
            }`}
          />
          <div className="flex-1 min-w-0">
            {/* 상단: 품목 배지 + 장비명 + 상태 배지 */}
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center gap-2 min-w-0 flex-1 mr-2">
                <span className="px-1.5 py-0.5 bg-orange-100 text-orange-700 text-[10px] rounded font-medium flex-shrink-0">
                  {item.EQT_CL_NM || '장비'}
                </span>
                {item.isScanned && (
                  <span className="px-1.5 py-0.5 bg-orange-500 text-white text-[10px] rounded font-medium flex-shrink-0">스캔</span>
                )}
                <span className={`text-sm font-medium truncate ${canSelect ? 'text-gray-900' : 'text-gray-500'}`}>
                  {item.ITEM_NM || item.EQT_CL_NM || '-'}
                </span>
              </div>
              <span className={`px-2 py-1 rounded-full text-xs font-semibold flex-shrink-0 ${
                isLost ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-500'
              }`}>
                {isLost ? '분실' : '정상'}
              </span>
            </div>

            {/* 간단히 보기: S/N만 표시 */}
            {viewMode === 'simple' && (
              <div className="font-mono text-xs text-gray-700">
                {item.EQT_SERNO || '-'}
              </div>
            )}

            {/* 자세히 보기: 장비처리와 동일한 회색 박스 레이아웃 */}
            {viewMode === 'detail' && (
              <div className="bg-gray-50 rounded-lg p-3 mt-2">
                <div className="space-y-1.5 text-xs">
                  {/* S/N */}
                  <div className="font-mono text-gray-700 font-medium">{item.EQT_SERNO || '-'}</div>

                  {/* 해지일 */}
                  <div className="text-gray-700">{formatDateDot(item.TRML_DT) || '-'}</div>

                  {/* 현재위치 */}
                  <div className="flex items-center gap-2">
                    <span className="text-gray-400">현재위치</span>
                    <span className="text-gray-700 font-medium">고객</span>
                  </div>

                  {/* 고객명 */}
                  <div className="flex items-center gap-2">
                    <span className="text-gray-400">고객</span>
                    <span className="text-gray-700">{item.CUST_NM || '-'}</span>
                  </div>

                  {/* 지점 */}
                  <div className="text-gray-600">{item.SO_NM || '-'}</div>
                </div>
                {/* 분실금액 표시 (분실인 경우) */}
                {isLost && item.LOSS_AMT && (
                  <div className="mt-2 pt-1.5 border-t border-gray-200">
                    <span className="text-gray-400 text-xs">분실금액: </span>
                    <span className="text-red-600 text-xs font-medium">{Number(item.LOSS_AMT).toLocaleString()}원</span>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="h-full overflow-y-auto bg-gray-50 px-4 py-4 space-y-3">
      {/* Scanned equipment display */}
      {scannedSerials.length > 0 && (
        <div className="bg-orange-50 border border-orange-200 rounded-xl p-3">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-orange-700">스캔된 장비 ({scannedSerials.length})</span>
            <button
              onClick={() => setScannedSerials([])}
              className="text-xs text-orange-600 hover:text-orange-800"
            >
              초기화
            </button>
          </div>
          <div className="flex flex-wrap gap-1">
            {scannedSerials.map((sn, idx) => (
              <span key={idx} className="px-2 py-1 bg-orange-100 text-orange-800 text-xs rounded-md font-mono">
                {sn}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Search area */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <label className="text-xs font-medium text-gray-600 w-14 flex-shrink-0">S/N</label>
            <input
              type="text"
              value={searchParams.EQT_SERNO}
              onChange={(e) => setSearchParams({...searchParams, EQT_SERNO: e.target.value.toUpperCase()})}
              className="flex-1 px-3 py-2 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent transition-all font-mono"
              placeholder="장비 S/N"
            />
          </div>

          <div className="flex items-center gap-2">
            <label className="text-xs font-medium text-gray-600 w-14 flex-shrink-0">고객ID</label>
            <input
              type="text"
              value={searchParams.CUST_ID}
              onChange={(e) => setSearchParams({...searchParams, CUST_ID: e.target.value})}
              className="flex-1 px-3 py-2 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent transition-all"
              placeholder="고객 ID"
            />
          </div>

          <div className="flex items-center gap-2">
            <label className="text-xs font-medium text-gray-600 w-14 flex-shrink-0">고객명</label>
            <input
              type="text"
              value={searchParams.CUST_NM}
              onChange={(e) => setSearchParams({...searchParams, CUST_NM: e.target.value})}
              className="flex-1 px-3 py-2 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent transition-all"
              placeholder="고객명"
            />
          </div>

          <div className="flex gap-2">
            <button
              onClick={handleSearch}
              disabled={isLoading}
              className="flex-1 bg-blue-500 hover:bg-blue-600 disabled:bg-gray-300 text-white py-2.5 rounded-lg font-semibold text-sm shadow-sm transition-all active:scale-[0.98] touch-manipulation"
              style={{ WebkitTapHighlightColor: 'transparent' }}
            >
              {isLoading ? '조회 중...' : '조회'}
            </button>
            <button
              onClick={() => setScanModalOpen(true)}
              className="flex-1 bg-orange-500 hover:bg-orange-600 text-white py-2.5 rounded-lg font-semibold text-sm shadow-sm transition-all active:scale-[0.98] touch-manipulation flex items-center justify-center gap-2"
              style={{ WebkitTapHighlightColor: 'transparent' }}
            >
              <Scan className="w-4 h-4" />
              스캔
            </button>
          </div>
        </div>
      </div>

      {/* Unreturned equipment list */}
      {unreturnedList.length > 0 ? (
        <>
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="px-4 py-3 bg-gradient-to-r from-gray-50 to-white border-b border-gray-100">
              <div className="flex items-center justify-between mb-2">
                <div>
                  <span className="text-sm font-semibold text-gray-800">
                    조회결과: {filteredList.length}건
                  </span>
                  {selectedCount > 0 && (
                    <span className="text-sm text-orange-600 ml-2 font-medium">
                      (선택: {selectedCount}건)
                    </span>
                  )}
                </div>
                <label className="flex items-center gap-2 text-xs">
                  <input
                    type="checkbox"
                    onChange={(e) => handleCheckAll(e.target.checked)}
                    checked={filteredList.length > 0 && filteredList.filter(item => isLostEquipment(item)).every(item => item.CHK)}
                    className="rounded"
                  />
                  전체선택
                </label>
              </div>
              {/* 분실 필터 버튼 */}
              <div className="flex gap-1 bg-gray-100 p-1 rounded-lg">
                <button
                  onClick={() => setLossFilter('all')}
                  className={`flex-1 py-1.5 px-2 text-xs font-medium rounded-md transition-all ${
                    lossFilter === 'all'
                      ? 'bg-white text-orange-600 shadow-sm'
                      : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  전체 ({unreturnedList.length})
                </button>
                <button
                  onClick={() => setLossFilter('lost')}
                  className={`flex-1 py-1.5 px-2 text-xs font-medium rounded-md transition-all ${
                    lossFilter === 'lost'
                      ? 'bg-white text-red-600 shadow-sm'
                      : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  분실 ({lostCount})
                </button>
                <button
                  onClick={() => setLossFilter('notLost')}
                  className={`flex-1 py-1.5 px-2 text-xs font-medium rounded-md transition-all ${
                    lossFilter === 'notLost'
                      ? 'bg-white text-gray-700 shadow-sm'
                      : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  정상 ({notLostCount})
                </button>
              </div>
            </div>
            {/* 뷰 모드 선택 버튼 */}
            <div className="px-4 py-2 border-b border-gray-100">
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
            {/* Grouped list */}
            <div className="max-h-[50vh] overflow-y-auto">
              {soKeys.map(soKey => {
                const soItems = groupedByLocation[soKey];
                const itemTypeKeys = Object.keys(soItems).sort();
                const soTotalCount = itemTypeKeys.reduce((sum, k) => sum + soItems[k].length, 0);
                const soCheckedCount = itemTypeKeys.reduce((sum, k) => sum + soItems[k].filter(i => i.CHK).length, 0);
                const soLostCount = itemTypeKeys.reduce((sum, k) => sum + soItems[k].filter(i => isLostEquipment(i)).length, 0);
                const isSoCollapsed = collapsedGroups.has(`so_${soKey}`);

                return (
                  <div key={soKey} className="border-b border-gray-100 last:border-0">
                    {/* 지점 헤더 */}
                    <div
                      className="px-4 py-2 bg-blue-50 flex items-center justify-between cursor-pointer hover:bg-blue-100"
                      onClick={() => toggleGroup(`so_${soKey}`)}
                    >
                      <div className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={soLostCount > 0 && soCheckedCount === soLostCount}
                          onChange={(e) => {
                            e.stopPropagation();
                            handleCheckSo(soKey, e.target.checked);
                          }}
                          onClick={(e) => e.stopPropagation()}
                          className="rounded"
                          disabled={soLostCount === 0}
                        />
                        <span className="text-sm font-bold text-blue-800">{soKey}</span>
                        <span className="text-xs text-blue-600 bg-blue-100 px-2 py-0.5 rounded-full">{soTotalCount}건</span>
                      </div>
                      {isSoCollapsed ? <ChevronDown className="w-4 h-4 text-blue-600" /> : <ChevronUp className="w-4 h-4 text-blue-600" />}
                    </div>

                    {/* Item Type Groups */}
                    {!isSoCollapsed && itemTypeKeys.map(itemTypeKey => {
                      const items = soItems[itemTypeKey];
                      const itemTypeLostCount = items.filter(i => isLostEquipment(i)).length;
                      const itemTypeCheckedCount = items.filter(i => i.CHK).length;
                      const isItemTypeCollapsed = collapsedGroups.has(`so_${soKey}_type_${itemTypeKey}`);

                      return (
                        <div key={itemTypeKey}>
                          {/* 장비종류 헤더 */}
                          <div
                            className="px-6 py-1.5 bg-gray-50 flex items-center justify-between cursor-pointer hover:bg-gray-100"
                            onClick={() => toggleGroup(`so_${soKey}_type_${itemTypeKey}`)}
                          >
                            <div className="flex items-center gap-2">
                              <input
                                type="checkbox"
                                checked={itemTypeLostCount > 0 && itemTypeCheckedCount === itemTypeLostCount}
                                onChange={(e) => {
                                  e.stopPropagation();
                                  handleCheckItemType(soKey, itemTypeKey, e.target.checked);
                                }}
                                onClick={(e) => e.stopPropagation()}
                                className="rounded"
                                disabled={itemTypeLostCount === 0}
                              />
                              <span className="text-xs font-semibold text-gray-700">{itemTypeKey}</span>
                              <span className="text-[10px] text-gray-500 bg-gray-200 px-1.5 py-0.5 rounded">{items.length}건</span>
                            </div>
                            {isItemTypeCollapsed ? <ChevronDown className="w-3 h-3 text-gray-500" /> : <ChevronUp className="w-3 h-3 text-gray-500" />}
                          </div>

                          {/* Equipment Items */}
                          {!isItemTypeCollapsed && (
                            <div className="divide-y divide-gray-50">
                              {items.map(item => renderEquipmentItem(item))}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          </div>

          {/* 회수 버튼 */}
          <button
            onClick={() => setRecoveryModalOpen(true)}
            disabled={selectedCount === 0}
            className="w-full bg-gradient-to-r from-green-500 to-green-600 disabled:from-gray-300 disabled:to-gray-400 text-white py-4 rounded-xl font-bold text-base shadow-lg flex items-center justify-center gap-2 active:scale-[0.98] transition-all"
          >
            <Check className="w-5 h-5" />
            회수 처리 ({selectedCount}건)
          </button>
        </>
      ) : (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-8">
          <div className="text-center">
            <div className="w-16 h-16 mx-auto mb-4 bg-orange-100 rounded-full flex items-center justify-center">
              <svg className="w-8 h-8 text-orange-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
            </div>
            <p className="text-gray-500 text-sm whitespace-pre-line">
              {isLoading ? '조회 중...' : '바코드 스캔 또는 검색 조건을 입력하여\n미회수 장비를 조회하세요'}
            </p>
          </div>
        </div>
      )}

      {/* Barcode Scanner */}
      <BarcodeScanner
        isOpen={scanModalOpen}
        onClose={() => setScanModalOpen(false)}
        onScan={handleBarcodeScan}
      />

      <RecoveryModal
        isOpen={recoveryModalOpen}
        onClose={() => setRecoveryModalOpen(false)}
        selectedItems={unreturnedList.filter(item => item.CHK)}
        onProcess={handleRecoveryProcess}
        isProcessing={isProcessing}
        soList={soList}
      />
    </div>
  );
};

export default EquipmentRecovery;
