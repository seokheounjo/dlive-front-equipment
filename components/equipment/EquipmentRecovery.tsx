import React, { useState, useEffect, useRef } from 'react';
import { getUnreturnedEquipmentList, processEquipmentRecovery, getEquipmentHistoryInfo } from '../../services/apiService';
import { debugApiCall } from './equipmentDebug';
import { Scan, Check, AlertTriangle, Package } from 'lucide-react';

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
        <div className="p-4 border-b border-gray-100 bg-gradient-to-r from-orange-500 to-orange-600">
          <div className="flex items-center gap-2">
            <Scan className="w-5 h-5 text-white" />
            <h3 className="font-semibold text-white">바코드 스캔</h3>
          </div>
          <p className="text-xs text-white/80 mt-1">미회수 장비 S/N을 스캔하거나 입력하세요</p>
        </div>
        <div className="p-4 space-y-4">
          <input
            ref={inputRef}
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value.toUpperCase())}
            onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
            placeholder="S/N 입력 또는 스캔"
            className="w-full px-4 py-3 text-lg border-2 border-orange-200 rounded-lg focus:border-orange-500 focus:ring-2 focus:ring-orange-200 uppercase font-mono text-center"
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
              className="flex-1 py-2.5 text-sm text-white bg-orange-500 hover:bg-orange-600 disabled:bg-gray-300 rounded-lg font-medium transition-colors"
            >
              조회
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

// 회수처리 모달
const RecoveryModal: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  selectedItems: UnreturnedEqt[];
  onProcess: (procType: string) => void;
  isProcessing: boolean;
}> = ({ isOpen, onClose, selectedItems, onProcess, isProcessing }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-sm overflow-hidden">
        <div className="p-4 border-b border-gray-100 bg-gradient-to-r from-green-500 to-green-600">
          <h3 className="font-semibold text-white">미회수 장비 처리</h3>
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
            <button
              onClick={() => onProcess('1')}
              disabled={isProcessing}
              className="w-full py-3 text-sm text-white bg-green-500 hover:bg-green-600 disabled:bg-gray-300 rounded-lg font-medium transition-colors flex items-center justify-center gap-2"
            >
              <Check className="w-4 h-4" />
              회수완료
            </button>
            <button
              onClick={() => onProcess('2')}
              disabled={isProcessing}
              className="w-full py-3 text-sm text-white bg-yellow-500 hover:bg-yellow-600 disabled:bg-gray-300 rounded-lg font-medium transition-colors flex items-center justify-center gap-2"
            >
              <AlertTriangle className="w-4 h-4" />
              망실처리
            </button>
            <button
              onClick={() => onProcess('3')}
              disabled={isProcessing}
              className="w-full py-3 text-sm text-white bg-red-500 hover:bg-red-600 disabled:bg-gray-300 rounded-lg font-medium transition-colors flex items-center justify-center gap-2"
            >
              <Package className="w-4 h-4" />
              고객분실
            </button>
          </div>

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
  const handleRecoveryProcess = async (procType: string) => {
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
            SO_ID: item.SO_ID || userInfo.soId || '',
            CHG_UID: userInfo.userId || '',
            PROC_UID_SO_ID: userInfo.soId || item.SO_ID || '',
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
        let msg = `${successCount}건의 장비가 "${procTypeNames[procType]}" 처리되었습니다.`;
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

  // 전체 체크
  const handleCheckAll = (checked: boolean) => {
    setUnreturnedList(unreturnedList.map(item => ({ ...item, CHK: checked })));
  };

  // 개별 체크
  const handleCheckItem = (index: number, checked: boolean) => {
    const newList = [...unreturnedList];
    newList[index].CHK = checked;
    setUnreturnedList(newList);
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
            <div className="px-4 py-3 bg-gradient-to-r from-gray-50 to-white border-b border-gray-100 flex items-center justify-between">
              <div>
                <span className="text-sm font-semibold text-gray-800">
                  조회 결과: {unreturnedList.length}건
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
                  checked={unreturnedList.length > 0 && unreturnedList.every(item => item.CHK)}
                  className="rounded"
                />
                전체선택
              </label>
            </div>
            <div className="max-h-[50vh] overflow-y-auto divide-y divide-gray-50">
              {unreturnedList.map((item, idx) => (
                <div
                  key={idx}
                  className={`px-4 py-3 transition-colors ${item.isScanned ? 'bg-orange-50' : 'hover:bg-blue-50/50'}`}
                >
                  <div className="flex items-start gap-3">
                    <input
                      type="checkbox"
                      checked={item.CHK || false}
                      onChange={(e) => handleCheckItem(idx, e.target.checked)}
                      className="rounded mt-0.5"
                    />
                    <div className="flex-1 min-w-0">
                      {/* S/N 및 스캔 표시 */}
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-bold text-gray-900 font-mono">{item.EQT_SERNO}</span>
                        {item.isScanned && (
                          <span className="px-1.5 py-0.5 bg-orange-500 text-white text-[10px] rounded font-medium">스캔</span>
                        )}
                        <span className={`px-2 py-0.5 rounded text-[10px] ${item.RETN_REQ_YN === 'Y' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>
                          {item.RETN_REQ_YN === 'Y' ? '회수요청' : '미요청'}
                        </span>
                      </div>

                      {/* 장비 정보 */}
                      <div className="text-xs text-gray-600 mt-1">{item.EQT_CL_NM || item.ITEM_NM}</div>

                      {/* 고객 정보 */}
                      <div className="text-xs text-gray-700 mt-1">
                        <span className="font-medium">고객:</span> {item.CUST_NM}
                      </div>

                      {/* 보유기사/지점 정보 */}
                      {(item.WRKR_NM || item.SO_NM) && (
                        <div className="flex items-center gap-3 mt-1 text-xs">
                          {item.WRKR_NM && (
                            <span className="text-blue-600">
                              <span className="text-gray-500">기사:</span> {item.WRKR_NM}
                            </span>
                          )}
                          {item.SO_NM && (
                            <span className="text-purple-600">
                              <span className="text-gray-500">지점:</span> {item.SO_NM}
                            </span>
                          )}
                        </div>
                      )}

                      {/* 해지일/손실금액 */}
                      <div className="flex items-center gap-3 mt-1 text-xs text-gray-500">
                        {item.TRML_DT && (
                          <span>해지: {formatDateDot(item.TRML_DT)}</span>
                        )}
                        {item.LOSS_AMT && (
                          <span className="text-red-600">손실: {Number(item.LOSS_AMT).toLocaleString()}원</span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
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

      {/* 모달들 */}
      <BarcodeScanModal
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
      />
    </div>
  );
};

export default EquipmentRecovery;
