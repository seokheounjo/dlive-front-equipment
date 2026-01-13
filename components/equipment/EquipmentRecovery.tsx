import React, { useState, useEffect } from 'react';
import { getUnreturnedEquipmentList, processEquipmentRecovery, getEquipmentHistoryInfo } from '../../services/apiService';
import { debugApiCall } from './equipmentDebug';
import { Scan, Check } from 'lucide-react';
import BarcodeScanner from './BarcodeScanner';

// SO (지점) 정보 타입
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
  LOSS_AMT: string;CRR_ID: string;CMPL_DATE: string;isScanned?: boolean;
}

// 날짜 포맷 함수 (YYYY.MM.DD)
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

// 날짜를 YYYYMMDD로 변환 (API용)
const formatDateApi = (dateStr: string): string => {
  if (!dateStr) return '';
  return dateStr.replace(/[-\.]/g, '');
};

// 날짜를 YYYY-MM-DD로 변환 (input용)
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

// 회수처리 모달 - 회수완료만 + 지점 선택
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
      alert('지점을 선택해주세요.');
      return;
    }
    onProcess('1', selectedSoId);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-sm overflow-hidden">
        <div className="p-4 border-b border-gray-100 bg-gradient-to-r from-green-500 to-green-600">
          <h3 className="font-semibold text-white">미회수 장비 회수완료</h3>
          <p className="text-xs text-white/80 mt-1">{selectedItems.length}건의 장비를 처리합니다</p>
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
              <option value="">지점을 선택하세요</option>
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
            {isProcessing ? '처리 중...' : '회수완료'}
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

  // Lost equipment check (LOSS_AMT > 0 means lost)
  const isLostEquipment = (item: UnreturnedEqt | null | undefined): boolean => {
    if (!item || !item.LOSS_AMT) return false;
    const amt = item.LOSS_AMT;
    if (amt === '' || amt === '0' || amt === 'null' || amt === 'undefined') return false;
    const numAmt = Number(amt);
    return !isNaN(numAmt) && numAmt > 0;
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

  // SO 목록 로드
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
        console.error('SO 목록 로드 실패:', e);
      }
    }
  }, []);

  // 바코드 스캔 처리
  const handleBarcodeScan = async (serialNo: string) => {
    setIsLoading(true);
    try {
      // 스캔된 S/N 저장
      setScannedSerials(prev => [...new Set([serialNo, ...prev])]);

      // S/N으로 미회수 장비 조회
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
        // 미회수 장비에서 찾음
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
        // 미회수 목록에 없으면 장비 정보 조회 후 안내
        const eqtResult = await debugApiCall(
          'EquipmentRecovery',
          'getEquipmentHistoryInfo',
          () => getEquipmentHistoryInfo({ EQT_SERNO: serialNo }),
          { EQT_SERNO: serialNo }
        );

        if (eqtResult && eqtResult.length > 0) {
          const eqt = eqtResult[0];
          alert(`장비(${serialNo})는 미회수 장비가 아닙니다.\n\n보유기사: ${eqt.WRKR_NM || '없음'}\n지점: ${eqt.SO_NM || '없음'}\n상태: ${eqt.EQT_STAT_NM || eqt.EQT_STAT_CD || '알수없음'}`);
        } else {
          alert(`장비(${serialNo})를 찾을 수 없습니다.`);
        }
        setUnreturnedList([]);
      }
    } catch (error) {
      console.error('바코드 스캔 처리 실패:', error);
      alert('장비 조회에 실패했습니다.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSearch = async () => {
    // 검색 조건 검증 - 최소 1개 이상 필수
    if (!searchParams.EQT_SERNO && !searchParams.CUST_ID && !searchParams.CUST_NM) {
      alert('S/N, 고객ID, 고객명 중 하나 이상을 입력해주세요.');
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

      // 스캔된 장비 상위 정렬
      transformedList.sort((a, b) => {
        if (a.isScanned && !b.isScanned) return -1;
        if (!a.isScanned && b.isScanned) return 1;
        return 0;
      });

      setUnreturnedList(transformedList);
    } catch (error) {
      console.error('미회수 장비 조회 실패:', error);
      alert('미회수 장비 조회에 실패했습니다.');
      setUnreturnedList([]);
    } finally {
      setIsLoading(false);
    }
  };

  // 회수 처리
  const handleRecoveryProcess = async (procType: string, soId: string) => {
    const selectedItems = unreturnedList.filter(item => item.CHK);
    if (selectedItems.length === 0) return;

    setIsProcessing(true);
    try {
      let successCount = 0;
      let skipCount = 0;
      for (const item of selectedItems) {
        try {
          // EQT_NO 형식 검증 (20자리 숫자여야 함)
          if (!item.EQT_NO || item.EQT_NO.length !== 20 || !/^\d+$/.test(item.EQT_NO)) {
            console.warn('잘못된 EQT_NO 형식 (처리 불가):', item.EQT_SERNO, item.EQT_NO);
            skipCount++;
            continue;
          }

          // Get user info for CHG_UID
          const userInfoStr = typeof window !== 'undefined' ? sessionStorage.getItem('userInfo') : null;
          const userInfo = userInfoStr ? JSON.parse(userInfoStr) : {};
          const today = new Date().toISOString().slice(0,10).replace(/-/g, '');

          const params = {
            EQT_NO: item.EQT_NO,
            EQT_SERNO: item.EQT_SERNO,
            PROC_CL: procType, // 1=회수완료, 2=망실처리, 3=고객분실
            CUST_ID: item.CUST_ID,
            CTRT_ID: item.CTRT_ID,
            WRK_ID: item.WRK_ID,
            CRR_ID: item.CRR_ID || userInfo.crrId || '',
            WRKR_ID: item.WRKR_ID || userInfo.userId || '',
            SO_ID: soId || item.SO_ID || userInfo.soId || '',
            CHG_UID: userInfo.userId || '',
            PROC_UID_SO_ID: soId || userInfo.soId || item.SO_ID || '',
            RTN_DD: today,
            RTN_TP: '3', // 3=기사회수
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
          console.error('회수 처리 실패:', item.EQT_SERNO, err);
        }
      }

      const procTypeNames: Record<string, string> = {
        '1': '회수완료',
        '2': '망실처리',
        '3': '고객분실'
      };

      if (successCount > 0) {
        let msg = successCount + '건의 장비가 회수완료 처리되었습니다.';
        if (skipCount > 0) {
          msg += `\n(${skipCount}건은 EQT_NO 형식 오류로 건너뜀)`;
        }
        alert(msg);
        setRecoveryModalOpen(false);
        setScannedSerials([]);
        // 목록 새로고침
        handleSearch();
      } else {
        throw new Error('처리에 실패했습니다.');
      }
    } catch (error) {
      console.error('회수 처리 실패:', error);
      alert('회수 처리에 실패했습니다.');
    } finally {
      setIsProcessing(false);
    }
  };

  // 전체 체크 (분실장비만 체크 가능)
  const handleCheckAll = (checked: boolean) => {
    setUnreturnedList(unreturnedList.map(item => {
      const isLost = isLostEquipment(item);
      return { ...item, CHK: isLost ? checked : false };
    }));
  };

  // 개별 체크 (분실장비만 체크 가능)
  const handleCheckItem = (index: number, checked: boolean) => {
    if (index < 0 || index >= unreturnedList.length) return;
    const newList = [...unreturnedList];
    const item = newList[index];
    if (!item) return;
    // Only allow checking lost equipment
    if (isLostEquipment(item)) {
      newList[index].CHK = checked;
      setUnreturnedList(newList);
    }
  };

  const selectedCount = unreturnedList.filter(item => item.CHK).length;

  return (
    <div className="h-full overflow-y-auto bg-gray-50 px-4 py-4 space-y-3">
      {/* 스캔된 장비 표시 */}
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

      {/* 검색 영역 */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
        <div className="space-y-3">
          {/* S/N 검색 */}
          <div className="flex items-center gap-2">
            <label className="text-xs font-medium text-gray-600 w-14 flex-shrink-0">S/N</label>
            <input
              type="text"
              value={searchParams.EQT_SERNO}
              onChange={(e) => setSearchParams({...searchParams, EQT_SERNO: e.target.value.toUpperCase()})}
              className="flex-1 px-3 py-2 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent transition-all font-mono"
              placeholder="장비 S/N 입력"
            />
          </div>

          {/* 고객ID */}
          <div className="flex items-center gap-2">
            <label className="text-xs font-medium text-gray-600 w-14 flex-shrink-0">고객ID</label>
            <input
              type="text"
              value={searchParams.CUST_ID}
              onChange={(e) => setSearchParams({...searchParams, CUST_ID: e.target.value})}
              className="flex-1 px-3 py-2 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent transition-all"
              placeholder="고객ID 입력"
            />
          </div>

          {/* 고객명 */}
          <div className="flex items-center gap-2">
            <label className="text-xs font-medium text-gray-600 w-14 flex-shrink-0">고객명</label>
            <input
              type="text"
              value={searchParams.CUST_NM}
              onChange={(e) => setSearchParams({...searchParams, CUST_NM: e.target.value})}
              className="flex-1 px-3 py-2 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent transition-all"
              placeholder="고객명 입력"
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

      {/* 미회수 장비 목록 */}
      {unreturnedList.length > 0 ? (
        <>
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="px-4 py-3 bg-gradient-to-r from-gray-50 to-white border-b border-gray-100">
              <div className="flex items-center justify-between mb-2">
                <div>
                  <span className="text-sm font-semibold text-gray-800">
                    조회 결과: {filteredList.length}건
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
              {/* Loss filter buttons */}
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
                  비분실 ({notLostCount})
                </button>
              </div>
            </div>
            {/* 뷰 모드 선택 버튼 */}
            <div className="px-4 pb-3">
              <div className="flex gap-1 bg-gray-100 p-1 rounded-lg">
                <button
                  onClick={() => setViewMode('simple')}
                  className={`flex-1 py-1.5 px-2 text-xs font-medium rounded-md transition-all ${
                    viewMode === 'simple'
                      ? 'bg-white text-orange-600 shadow-sm'
                      : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  간단히
                </button>
                <button
                  onClick={() => setViewMode('detail')}
                  className={`flex-1 py-1.5 px-2 text-xs font-medium rounded-md transition-all ${
                    viewMode === 'detail'
                      ? 'bg-white text-orange-600 shadow-sm'
                      : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  자세히
                </button>
              </div>
            </div>
            <div className="max-h-[50vh] overflow-y-auto divide-y divide-gray-50">
              {filteredList.map((item, idx) => {
                const isLost = isLostEquipment(item);
                const canSelect = isLost;
                const originalIdx = unreturnedList.findIndex(u => u.EQT_SERNO === item.EQT_SERNO);
                return (
                <div
                  key={idx}
                  className={`px-4 py-3 transition-colors ${
                    !canSelect ? 'opacity-60 bg-gray-50' :
                    item.isScanned ? 'bg-orange-50' : 'hover:bg-blue-50/50'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <input
                      type="checkbox"
                      checked={item.CHK || false}
                      onChange={(e) => handleCheckItem(originalIdx, e.target.checked)}
                      disabled={!canSelect}
                      className={`rounded mt-0.5 ${!canSelect ? 'cursor-not-allowed' : ''}`}
                      title={!canSelect ? '분실장비만 회수 가능' : ''}
                    />
                    <div className="flex-1 min-w-0">
                      {/* 간단히 보기 */}
                      {viewMode === 'simple' && (
                        <>
                          {/* [품목] 모델명 [상태] */}
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2 min-w-0 flex-1 mr-2">
                              <span className="px-1.5 py-0.5 bg-orange-100 text-orange-700 text-[10px] rounded font-medium flex-shrink-0">
                                {item.EQT_CL_NM || '장비'}
                              </span>
                              <span className={`text-sm font-medium truncate ${canSelect ? 'text-gray-900' : 'text-gray-500'}`}>{item.ITEM_NM || '-'}</span>
                              {item.isScanned && (
                                <span className="px-1.5 py-0.5 bg-orange-500 text-white text-[10px] rounded font-medium flex-shrink-0">스캔</span>
                              )}
                            </div>
                            <div className="flex items-center gap-1">
                              {isLost ? (
                                <span className="px-2 py-0.5 rounded text-[10px] flex-shrink-0 bg-red-100 text-red-700">분실</span>
                              ) : (
                                <span className="px-2 py-0.5 rounded text-[10px] flex-shrink-0 bg-gray-200 text-gray-500">회수불가</span>
                              )}
                            </div>
                          </div>
                          {/* S/N - 한 줄 (MAC 없음) */}
                          <div className="font-mono text-xs text-gray-700 mt-1">
                            {item.EQT_SERNO || '-'}
                          </div>
                        </>
                      )}
                      {/* 자세히 보기 */}
                      {viewMode === 'detail' && (
                        <>
                          {/* 간단히와 동일: [품목] S/N [상태] */}
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-2 min-w-0 flex-1 mr-2">
                              <span className="px-1.5 py-0.5 bg-orange-100 text-orange-700 text-[10px] rounded font-medium flex-shrink-0">
                                {item.EQT_CL_NM || item.ITEM_NM || '장비'}
                              </span>
                              <span className={`font-mono text-xs truncate ${canSelect ? 'text-gray-800' : 'text-gray-500'}`}>{item.EQT_SERNO}</span>
                              {item.isScanned && (
                                <span className="px-1.5 py-0.5 bg-orange-500 text-white text-[10px] rounded font-medium flex-shrink-0">스캔</span>
                              )}
                            </div>
                            <div className="flex items-center gap-1">
                              {isLost ? (
                                <span className="px-2 py-0.5 rounded text-[10px] flex-shrink-0 bg-red-100 text-red-700">분실</span>
                              ) : (
                                <span className="px-2 py-0.5 rounded text-[10px] flex-shrink-0 bg-gray-200 text-gray-500">회수불가</span>
                              )}
                            </div>
                          </div>
                          {/* 추가 정보 (회색 박스) */}
                          <div className="bg-gray-50 rounded-lg p-2">
                            <div className="space-y-1 text-xs">
                              {/* 고객명 (값만) */}
                              <div className="text-gray-700 font-medium">{item.CUST_NM || '-'}</div>
                              {/* 현재위치 (라벨+값) */}
                              <div className="flex items-center gap-2">
                                <span className="text-gray-400">현재위치</span>
                                <span className="text-gray-700">{item.SO_NM || '-'}</span>
                              </div>
                              {/* 보유자 (값만) */}
                              {item.WRKR_NM && <div className="text-gray-600">{item.WRKR_NM}</div>}
                              {/* 해지일 (값만) */}
                              {item.TRML_DT && <div className="text-gray-500">{formatDateDot(item.TRML_DT)}</div>}
                              {/* 손실금액 (값만) */}
                              {item.LOSS_AMT && <div className="text-red-600">{Number(item.LOSS_AMT).toLocaleString()}원</div>}
                            </div>
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                </div>
                );
              })}
            </div>
          </div>

          {/* 회수 처리 버튼 */}
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
            <p className="text-gray-500 text-sm">
              {isLoading ? '조회 중...' : '바코드를 스캔하거나 조건을 입력하여\n미회수 장비를 조회하세요'}
            </p>
          </div>
        </div>
      )}

      {/* 바코드 스캐너 */}
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
