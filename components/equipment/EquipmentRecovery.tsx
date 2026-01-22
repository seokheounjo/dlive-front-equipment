import React, { useState, useEffect } from 'react';
import { getUnreturnedEquipmentList, processEquipmentRecovery, getEquipmentHistoryInfo } from '../../services/apiService';
import { searchCustomer, CustomerInfo } from '../../services/customerApi';
import { debugApiCall } from './equipmentDebug';
import { Check, ChevronDown, ChevronUp, Search, User, X, Loader2, Phone, FileText, Cpu } from 'lucide-react';
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
  ITEM_MID_NM?: string;           // 장비중분류 (2단계)
  BIZ_CL_NM?: string;             // 업무분류 (1단계: DTV, CVT 등)
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
  // 통일된 간단히/자세히 형식용 필드 (실제 API 응답 필드명)
  MAC_ADDRESS?: string;
  EQT_USE_END_DT?: string;      // 사용가능일자
  EQT_STAT_CD_NM?: string;      // 장비상태 (API: EQT_STAT_CD_NM)
  CHG_KND_NM?: string;          // 변경유형 (API: CHG_KND_NM)
  EQT_LOC_TP_NM?: string;       // 장비위치유형
  EQT_LOC_NM?: string;          // 장비위치
  OLD_EQT_LOC_NM?: string;      // 이전장비위치 (API: OLD_EQT_LOC_NM)
  ITEM_MODEL?: string;          // 모델명
  EQT_USE_ARR_YN?: string;      // 장비사용도착여부 (Y/A/N/W/R/D)
  MST_SO_ID?: string;           // 본부 SO ID (100 = 본부)
  MST_SO_NM?: string;           // 본부 SO 명
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

// Date format function (YYYY-MM-DD)
const formatDateDash = (dateStr: string): string => {
  if (!dateStr) return '-';
  if (dateStr.length === 8 && !dateStr.includes('-') && !dateStr.includes('.')) {
    return `${dateStr.slice(0, 4)}-${dateStr.slice(4, 6)}-${dateStr.slice(6, 8)}`;
  }
  if (dateStr.includes('.')) {
    return dateStr.replace(/\./g, '-');
  }
  return dateStr;
};

// MAC address format (XX:XX:XX:XX:XX:XX)
const formatMac = (mac: string | null | undefined): string => {
  if (!mac) return '-';
  const cleaned = mac.replace(/[^A-Fa-f0-9]/g, '');
  if (cleaned.length !== 12) return mac;
  return cleaned.match(/.{2}/g)?.join(':') || mac;
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

// CTRT_ID format (XXX-XXX-XXXX) 3-3-4
const formatCtrtId = (ctrtId: string): string => {
  if (!ctrtId) return '-';
  const cleaned = ctrtId.replace(/[^0-9]/g, '');
  if (cleaned.length === 10) {
    return `${cleaned.slice(0, 3)}-${cleaned.slice(3, 6)}-${cleaned.slice(6, 10)}`;
  }
  return ctrtId;
};

// Recovery Modal
const RecoveryModal: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  selectedItems: UnreturnedEqt[];
  onProcess: (procType: string, soId: string) => void;
  isProcessing: boolean;
  soList: SoInfo[];
  userSoId?: string;
}> = ({ isOpen, onClose, selectedItems, onProcess, isProcessing, soList, userSoId }) => {
  const [selectedSoId, setSelectedSoId] = useState<string>('');

  // 모달이 열릴 때마다 지점 선택 초기화 (항상 "지점 선택"으로 시작)
  useEffect(() => {
    if (isOpen) {
      setSelectedSoId('');
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleProcess = () => {
    if (!selectedSoId) {
      alert('지점을 선택해야 회수 처리를 할 수 있습니다.\n회수 지점을 선택해주세요.');
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
            disabled={isProcessing}
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

// 고객 검색 모달
const CustomerSearchModal: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  onSelect: (customer: { CUST_ID: string; CUST_NM: string }) => void;
}> = ({ isOpen, onClose, onSelect }) => {
  const [customerId, setCustomerId] = useState('');
  const [contractId, setContractId] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [equipmentNo, setEquipmentNo] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<CustomerInfo[]>([]);
  const [hasSearched, setHasSearched] = useState(false);
  const [showScanner, setShowScanner] = useState(false);

  // Barcode scan handler for CustomerSearchModal
  const handleModalBarcodeScan = (serialNo: string) => {
    setEquipmentNo(serialNo.toUpperCase());
    setShowScanner(false);
  };

  if (!isOpen) return null;

  const handleSearch = async () => {
    // 최소 하나의 검색 조건 필요
    const hasCustomerId = customerId.length >= 4;
    const hasContractId = contractId.length >= 4;
    const hasPhoneName = phoneNumber.length >= 4 || customerName.length >= 2;
    const hasEquipmentNo = equipmentNo.length >= 4;

    if (!hasCustomerId && !hasContractId && !hasPhoneName && !hasEquipmentNo) {
      alert('검색 조건을 하나 이상 입력해주세요.');
      return;
    }

    // 검색 유형 결정 (우선순위: 고객ID > 계약ID > 장비번호 > 전화번호/이름)
    let searchType: 'CUSTOMER_ID' | 'CONTRACT_ID' | 'PHONE_NAME' | 'EQUIPMENT_NO' = 'PHONE_NAME';
    if (hasCustomerId) searchType = 'CUSTOMER_ID';
    else if (hasContractId) searchType = 'CONTRACT_ID';
    else if (hasEquipmentNo) searchType = 'EQUIPMENT_NO';

    setIsSearching(true);
    setHasSearched(true);
    try {
      const response = await searchCustomer({
        searchType,
        customerId: hasCustomerId ? customerId : undefined,
        contractId: hasContractId ? contractId : undefined,
        phoneNumber: hasPhoneName ? phoneNumber : undefined,
        customerName: hasPhoneName ? customerName : undefined,
        equipmentNo: hasEquipmentNo ? equipmentNo : undefined,
      });

      if (response.success && response.data) {
        setSearchResults(response.data);
        // 1건이어도 자동 선택하지 않음 - 사용자가 직접 선택하도록
      } else {
        setSearchResults([]);
      }
    } catch (error) {
      console.error('Customer search error:', error);
      setSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleSearch();
  };

  const handleClear = () => {
    setCustomerId('');
    setContractId('');
    setPhoneNumber('');
    setCustomerName('');
    setEquipmentNo('');
    setSearchResults([]);
    setHasSearched(false);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden max-h-[80vh] flex flex-col">
        {/* 헤더 */}
        <div className="p-3 border-b border-gray-100 bg-gradient-to-r from-blue-500 to-blue-600 flex-shrink-0">
          <h3 className="font-semibold text-white flex items-center gap-2">
            <User className="w-4 h-4" />
            고객 검색
          </h3>
        </div>

        {/* 스크롤 가능한 콘텐츠 영역 */}
        <div className="p-4 space-y-3 flex-1 overflow-y-auto min-h-0">
          {/* 고객ID */}
          <div className="flex items-center gap-2">
            <label className="text-xs font-medium text-gray-600 w-16 flex-shrink-0">고객ID</label>
            <input
              type="text"
              value={customerId}
              onChange={(e) => setCustomerId(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="고객ID"
              className="flex-1 px-3 py-2 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* 계약ID */}
          <div className="flex items-center gap-2">
            <label className="text-xs font-medium text-gray-600 w-16 flex-shrink-0">계약ID</label>
            <input
              type="text"
              value={contractId}
              onChange={(e) => setContractId(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="계약ID"
              className="flex-1 px-3 py-2 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* 전화번호 + 이름 (50:50) */}
          <div className="flex items-center gap-2 overflow-hidden">
            <label className="text-xs font-medium text-gray-600 w-16 flex-shrink-0">전화번호</label>
            <div className="flex-1 flex gap-2 min-w-0">
              <input
                type="tel"
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(e.target.value.replace(/[^0-9]/g, ''))}
                onKeyPress={handleKeyPress}
                placeholder="전화번호"
                className="flex-1 min-w-0 px-3 py-2 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
              <input
                type="text"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="이름"
                className="flex-1 min-w-0 px-3 py-2 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          {/* S/N + 스캔 버튼 */}
          <div className="flex items-center gap-2 overflow-hidden">
            <label className="text-xs font-medium text-gray-600 w-16 flex-shrink-0">S/N</label>
            <input
              type="text"
              value={equipmentNo}
              onChange={(e) => setEquipmentNo(e.target.value.toUpperCase())}
              onKeyPress={handleKeyPress}
              placeholder="S/N 또는 MAC 주소 입력"
              className="flex-1 min-w-0 px-3 py-2.5 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent uppercase transition-all font-mono"
            />
            <button
              onClick={() => setShowScanner(true)}
              className="px-4 py-2.5 bg-green-500 hover:bg-green-600 text-white rounded-lg font-semibold text-sm transition-all active:scale-[0.98] touch-manipulation flex items-center gap-1.5 flex-shrink-0"
              style={{ WebkitTapHighlightColor: 'transparent' }}
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" />
              </svg>
              스캔
            </button>
          </div>

          {/* 검색 결과 */}
          {hasSearched && (
            <div className="border-t border-gray-100 pt-3">
              {searchResults.length > 0 ? (
                <div className="space-y-2 max-h-40 overflow-y-auto">
                  <div className="text-xs text-gray-500 mb-2">검색 결과: {searchResults.length}건</div>
                  {searchResults.map((customer, idx) => (
                    <button
                      key={customer.CUST_ID || idx}
                      onClick={() => { setCustomerName(customer.CUST_NM); onSelect({ CUST_ID: customer.CUST_ID, CUST_NM: customer.CUST_NM }); onClose(); }}
                      className="w-full p-2.5 bg-gray-50 hover:bg-blue-50 rounded-lg border border-gray-200 hover:border-blue-300 text-left"
                    >
                      <div className="flex items-center gap-2 text-sm truncate">
                        <span className="text-blue-600 font-mono flex-shrink-0">{customer.CUST_ID}</span>
                        <span className="font-medium text-gray-800 flex-shrink-0">{customer.CUST_NM}</span>
                        <span className="text-gray-600 truncate">{customer.INST_ADDR || customer.ADDR || customer.ADDRESS || ''}</span>
                      </div>
                    </button>
                  ))}
                </div>
              ) : (
                <div className="text-center py-4 text-gray-500 text-sm">
                  검색 결과가 없습니다.
                </div>
              )}
            </div>
          )}
        </div>

        {/* 하단 버튼 (고정) */}
        <div className="p-4 border-t border-gray-100 bg-white flex-shrink-0">
          <div className="flex gap-2">
            <button
              onClick={handleSearch}
              disabled={isSearching}
              className="flex-1 py-2.5 text-sm text-white bg-blue-500 hover:bg-blue-600 disabled:bg-gray-300 rounded-lg font-medium flex items-center justify-center gap-2"
            >
              {isSearching ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
              {isSearching ? '조회 중...' : '조회'}
            </button>
            <button
              onClick={onClose}
              className="px-4 py-2.5 text-sm text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-lg font-medium"
            >
              닫기
            </button>
          </div>
        </div>
      </div>

      {/* Barcode Scanner for CustomerSearchModal */}
      <BarcodeScanner
        isOpen={showScanner}
        onClose={() => setShowScanner(false)}
        onScan={handleModalBarcodeScan}
      />
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
  const [customerModalOpen, setCustomerModalOpen] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<{ CUST_ID: string; CUST_NM: string } | null>(null);

  const [unreturnedList, setUnreturnedList] = useState<UnreturnedEqt[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [scanModalOpen, setScanModalOpen] = useState(false);
  const [recoveryModalOpen, setRecoveryModalOpen] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [scannedSerials, setScannedSerials] = useState<string[]>([]);
  const [soList, setSoList] = useState<SoInfo[]>([]);
  const [userSoId, setUserSoId] = useState<string>('');
  const [viewMode, setViewMode] = useState<'simple' | 'detail'>('simple');
  const [lossFilter, setLossFilter] = useState<'all' | 'lost'>('all');
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());

  // SO_ID로 SO_NM을 찾는 헬퍼 함수
  const getSoName = (soIdOrNm: string): string => {
    if (!soIdOrNm) return '미지정';
    // 본부 ID는 '본부'로 반환
    if (soIdOrNm === '100') return '본부';
    // 숫자만 있는지 확인 (SO_ID인 경우)
    const isNumericId = /^\d+$/.test(soIdOrNm);
    // 이미 지점명이면 그대로 반환 (숫자가 아닌 경우)
    if (!isNumericId) {
      const found = soList.find(s => s.SO_NM === soIdOrNm);
      if (found) return soIdOrNm;
    }
    // SO_ID로 검색
    const foundById = soList.find(s => s.SO_ID === soIdOrNm);
    if (foundById && foundById.SO_NM) return foundById.SO_NM;
    // soList에 없으면 "지점(ID)" 형식으로 반환
    if (isNumericId) {
      return `지점(${soIdOrNm})`;
    }
    return soIdOrNm;
  };

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

  // Lost equipment check (EQT_STAT_CD_NM='분실' or LOSS_AMT > 0)
  const isLostEquipment = (item: UnreturnedEqt): boolean => {
    // EQT_STAT_CD_NM이 '분실'이면 분실 장비 (API 필드명: EQT_STAT_CD_NM)
    if (item.EQT_STAT_CD_NM === '분실') return true;
    // LOSS_AMT > 0이면 분실 장비 (레거시 호환)
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

  // 지점 > 업무분류(1단계)로 그룹화 + 그룹 내 EQT_CL_NM 정렬
  const groupedByLocation = filteredList.reduce((acc, item, idx) => {
    // 지점명 결정: SO_NM > MST_SO_NM > '본부' (100인 경우) > SO_ID
    let soKey = '미지정';
    const soNm = item.SO_NM?.trim();
    const mstSoNm = item.MST_SO_NM?.trim();
    const soId = item.SO_ID?.trim();
    const mstSoId = item.MST_SO_ID?.trim();

    if (soNm && soNm !== '100') {
      soKey = soNm;
    } else if (mstSoNm && mstSoNm !== '100') {
      soKey = mstSoNm;
    } else if (soId === '100' || mstSoId === '100' || soNm === '100' || mstSoNm === '100') {
      soKey = '본부';
    } else if (soId) {
      soKey = soId;
    }

    const itemMidKey = item.BIZ_CL_NM || item.ITEM_MID_NM || item.EQT_CL_NM || '기타';
    if (!acc[soKey]) acc[soKey] = {};
    if (!acc[soKey][itemMidKey]) acc[soKey][itemMidKey] = [];
    acc[soKey][itemMidKey].push({ ...item, _globalIdx: idx });
    return acc;
  }, {} as Record<string, Record<string, (UnreturnedEqt & { _globalIdx: number })[]>>);

  // 각 그룹 내에서 EQT_CL_NM(모델명) 기준 정렬
  Object.keys(groupedByLocation).forEach(soKey => {
    Object.keys(groupedByLocation[soKey]).forEach(itemMidKey => {
      groupedByLocation[soKey][itemMidKey].sort((a, b) => {
        const aModel = a.EQT_CL_NM || a.ITEM_NM || '';
        const bModel = b.EQT_CL_NM || b.ITEM_NM || '';
        return aModel.localeCompare(bModel);
      });
    });
  });

  const soKeys = Object.keys(groupedByLocation).sort();

  // Check all in SO group
  const handleCheckSo = (soKey: string, checked: boolean) => {
    setUnreturnedList(unreturnedList.map(item => {
      const itemSo = item.SO_NM || item.SO_ID || '미지정';
      const isLost = isLostEquipment(item);
      return itemSo === soKey && isLost ? { ...item, CHK: checked } : item;
    }));
  };

  // Check all in item type group
  const handleCheckItemType = (soKey: string, itemMidKey: string, checked: boolean) => {
    setUnreturnedList(unreturnedList.map(item => {
      const itemSo = item.SO_NM || item.SO_ID || '미지정';
      const itemMid = item.BIZ_CL_NM || item.ITEM_MID_NM || item.EQT_CL_NM || '기타';
      const isLost = isLostEquipment(item);
      return (itemSo === soKey && itemMid === itemMidKey && isLost) ? { ...item, CHK: checked } : item;
    }));
  };

  // SO list load (장비처리와 동일한 방식)
  useEffect(() => {
    const loadSoList = () => {
      try {
        // 먼저 사용자 기본 지점 가져오기
        const sessionUserInfoStr = sessionStorage.getItem('userInfo');
        if (sessionUserInfoStr) {
          const userInfo = JSON.parse(sessionUserInfoStr);
          const defaultSoId = userInfo.soId || userInfo.SO_ID || '';
          if (defaultSoId) {
            setUserSoId(defaultSoId);
            console.log('[미회수장비] 사용자 기본 지점:', defaultSoId);
          }
        }

        // 1순위: localStorage의 branchList
        const branchList = localStorage.getItem('branchList');
        if (branchList) {
          const parsed = JSON.parse(branchList);
          if (Array.isArray(parsed) && parsed.length > 0) {
            console.log('[미회수장비] branchList에서 지점 목록 로드:', parsed.length, '건');
            const mappedList: SoInfo[] = parsed.map((so: any) => ({
              SO_ID: so.SO_ID || so.soId || '',
              SO_NM: so.SO_NM || so.soNm || so.SO_ID || ''
            })).filter((so: SoInfo) => so.SO_ID);
            // MST_SO_ID(본부) 정보도 추가 (중복 제거)
            const mstSoIds = new Set<string>();
            parsed.forEach((so: any) => {
              const mstId = so.MST_SO_ID || so.mstSoId;
              if (mstId && !mappedList.some(s => s.SO_ID === mstId)) {
                mstSoIds.add(mstId);
              }
            });
            mstSoIds.forEach(mstId => {
              mappedList.push({ SO_ID: mstId, SO_NM: `본부(${mstId})` });
            });
            setSoList(mappedList);
            return;
          }
        }

        // 2순위: localStorage의 userInfo.authSoList
        const userInfoStr = localStorage.getItem('userInfo');
        if (userInfoStr) {
          const userInfo = JSON.parse(userInfoStr);
          const authSoList = userInfo.authSoList || userInfo.AUTH_SO_List || [];
          if (Array.isArray(authSoList) && authSoList.length > 0) {
            console.log('[미회수장비] authSoList에서 지점 목록 로드:', authSoList.length, '건');
            const mappedList: SoInfo[] = authSoList.map((so: any) => ({
              SO_ID: so.SO_ID || so.soId || '',
              SO_NM: so.SO_NM || so.soNm || so.SO_ID || ''
            })).filter((so: SoInfo) => so.SO_ID);
            // MST_SO_ID(본부) 정보도 추가 (중복 제거)
            const mstSoIds = new Set<string>();
            authSoList.forEach((so: any) => {
              const mstId = so.MST_SO_ID || so.mstSoId;
              if (mstId && !mappedList.some(s => s.SO_ID === mstId)) {
                mstSoIds.add(mstId);
              }
            });
            mstSoIds.forEach(mstId => {
              mappedList.push({ SO_ID: mstId, SO_NM: `본부(${mstId})` });
            });
            setSoList(mappedList);
            return;
          }
        }

        // 3순위: sessionStorage의 userInfo (fallback)
        if (sessionUserInfoStr) {
          const userInfo = JSON.parse(sessionUserInfoStr);
          const authSoList = userInfo.authSoList || userInfo.AUTH_SO_List || [];
          if (Array.isArray(authSoList) && authSoList.length > 0) {
            console.log('[미회수장비] sessionStorage authSoList에서 지점 목록 로드:', authSoList.length, '건');
            const mappedList: SoInfo[] = authSoList.map((so: any) => ({
              SO_ID: so.SO_ID || so.soId || '',
              SO_NM: so.SO_NM || so.soNm || so.SO_ID || ''
            })).filter((so: SoInfo) => so.SO_ID);
            // MST_SO_ID(본부) 정보도 추가 (중복 제거)
            const mstSoIds = new Set<string>();
            authSoList.forEach((so: any) => {
              const mstId = so.MST_SO_ID || so.mstSoId;
              if (mstId && !mappedList.some(s => s.SO_ID === mstId)) {
                mstSoIds.add(mstId);
              }
            });
            mstSoIds.forEach(mstId => {
              mappedList.push({ SO_ID: mstId, SO_NM: `본부(${mstId})` });
            });
            setSoList(mappedList);
            return;
          }

          // 단일 SO 정보로 fallback
          const userInfo2 = JSON.parse(sessionUserInfoStr);
          const singleSo = userInfo2.soId || userInfo2.SO_ID;
          const singleSoNm = userInfo2.soNm || userInfo2.SO_NM || singleSo;
          if (singleSo) {
            console.log('[미회수장비] 단일 SO 정보 사용:', singleSo, singleSoNm);
            setSoList([{ SO_ID: singleSo, SO_NM: singleSoNm }]);
            return;
          }
        }

        console.log('[미회수장비] 지점 목록 없음');
      } catch (e) {
        console.error('[미회수장비] SO list load failed:', e);
      }
    };

    loadSoList();
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
          EQT_CL_CD: item.EQT_CL_CD || item.EQT_CL || '',
          EQT_CL_NM: item.EQT_CL_NM || item.EQT_NM || '',
          ITEM_NM: item.ITEM_NM || item.EQT_NM || '',
          TRML_DT: item.TRML_DT || item.CMPL_DATE?.split(' ')[0]?.replace(/-/g, '') || '',
          WRK_ID: item.WRK_ID || '',
          WRKR_ID: item.WRKR_ID || '',
          WRKR_NM: item.WRKR_NM || '',
          SO_ID: item.SO_ID || '',
          SO_NM: item.SO_NM || getSoName(item.SO_ID) || '',
          PHONE_NO: item.PHONE_NO || item.TEL_NO || item.TEL_NO_1 || '',
          ADDRESS: item.ADDRESS || item.WORK_ADDR || item.CTRT_ADDR || '',
          RETN_REQ_YN: item.RETN_REQ_YN || '',
          LOSS_AMT: item.LOSS_AMT || '',
          CRR_ID: item.CRR_ID || '',
          CMPL_DATE: item.CMPL_DATE || '',
          EQT_STAT_CD_NM: item.EQT_STAT_NM || item.EQT_STAT_CD_NM || '재고',
          isScanned: item.EQT_SERNO === serialNo,
          // 자세히 보기용 필드
          MAC_ADDRESS: item.MAC_ADDRESS || item.MAC_ADDR || '',
          EQT_USE_END_DT: item.EQT_USE_END_DT || '',
          CHG_KND_NM: item.CHG_KND_NM || '',
          EQT_LOC_NM: item.EQT_LOC_NM || '',
          EQT_LOC_TP_NM: item.EQT_LOC_TP_NM || '',
          OLD_EQT_LOC_NM: item.OLD_EQT_LOC_NM || '',
          ITEM_MODEL: item.ITEM_MODEL || item.MODEL_NM || '',
          EQT_USE_ARR_YN: item.EQT_USE_ARR_YN || '',
          BIZ_CL_NM: item.BIZ_CL_NM || '',
          MST_SO_ID: item.MST_SO_ID || '',
          MST_SO_NM: item.MST_SO_NM || '',
        } as UnreturnedEqt));
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
          alert(`장비 (${serialNo})는 미회수 대상이 아닙니다.\n\n보유자: ${eqt.WRKR_NM || '없음'}\n지점: ${eqt.SO_NM || '없음'}\n상태: ${eqt.EQT_STAT_NM || eqt.EQT_STAT_CD_NM || eqt.EQT_STAT_CD || '알 수 없음'}`);
        } else {
          alert(`장비 (${serialNo})를 찾을 수 없습니다.`);
        }
        setUnreturnedList([]);
      }
    } catch (error) {
      console.error('Barcode scan failed:', error);
      alert('장비 조회에 실패했습니다.');
    } finally {
      setIsLoading(false);
    }
  };

  // 고객 선택 핸들러
  const handleCustomerSelect = (customer: { CUST_ID: string; CUST_NM: string }) => {
    // 새 고객 선택 시 이전 결과 초기화
    setUnreturnedList([]);
    setScannedSerials([]);
    setSelectedCustomer(customer);
    setSearchParams({...searchParams, CUST_ID: customer.CUST_ID, CUST_NM: customer.CUST_NM});
  };

  const handleSearch = async () => {
    if (!searchParams.EQT_SERNO && !selectedCustomer) {
      alert('고객을 선택하거나 S/N을 입력해주세요.');
      return;
    }

    setIsLoading(true);
    try {
      const params: any = {};

      if (searchParams.EQT_SERNO) params.EQT_SERNO = searchParams.EQT_SERNO;
      if (selectedCustomer) params.CUST_ID = selectedCustomer.CUST_ID;

      const result = await debugApiCall(
        'EquipmentRecovery',
        'getUnreturnedEquipmentList',
        () => getUnreturnedEquipmentList(params),
        params
      );

      // S/N만으로 조회했을 때 결과에 고객 정보가 있으면 자동으로 표시
      if (!selectedCustomer && searchParams.EQT_SERNO && result && result.length > 0) {
        const firstItem = result[0];
        if (firstItem.CUST_ID && firstItem.CUST_NM) {
          setSelectedCustomer({ CUST_ID: firstItem.CUST_ID, CUST_NM: firstItem.CUST_NM });
        }
      }

      const transformedList: UnreturnedEqt[] = (result || []).map((item: any) => ({
        CHK: scannedSerials.includes(item.EQT_SERNO),
        CUST_ID: item.CUST_ID || '',
        CUST_NM: item.CUST_NM || '',
        CTRT_ID: item.CTRT_ID || '',
        EQT_NO: item.EQT_NO || '',
        EQT_SERNO: item.EQT_SERNO || '',
        EQT_CL_CD: item.EQT_CL_CD || item.EQT_CL || '',
        EQT_CL_NM: item.EQT_CL_NM || item.EQT_NM || '',
        ITEM_NM: item.ITEM_NM || item.EQT_NM || '',
        TRML_DT: item.TRML_DT || item.CMPL_DATE?.split(' ')[0]?.replace(/-/g, '') || '',
        WRK_ID: item.WRK_ID || '',
        WRKR_ID: item.WRKR_ID || '',
        WRKR_NM: item.WRKR_NM || '',
        SO_ID: item.SO_ID || '',
        SO_NM: item.SO_NM || getSoName(item.SO_ID) || '',
        PHONE_NO: item.PHONE_NO || item.TEL_NO || item.TEL_NO_1 || '',
        ADDRESS: item.ADDRESS || item.WORK_ADDR || item.CTRT_ADDR || '',
        RETN_REQ_YN: item.RETN_REQ_YN || '',
        LOSS_AMT: item.LOSS_AMT || '',
        CRR_ID: item.CRR_ID || '',
        CMPL_DATE: item.CMPL_DATE || '',
        EQT_STAT_CD_NM: item.EQT_STAT_NM || item.EQT_STAT_CD_NM || '재고',
        isScanned: scannedSerials.includes(item.EQT_SERNO),
        // 자세히 보기용 필드
        MAC_ADDRESS: item.MAC_ADDRESS || item.MAC_ADDR || '',
        EQT_USE_END_DT: item.EQT_USE_END_DT || '',
        CHG_KND_NM: item.CHG_KND_NM || '',
        EQT_LOC_NM: item.EQT_LOC_NM || '',
        EQT_LOC_TP_NM: item.EQT_LOC_TP_NM || '',
        OLD_EQT_LOC_NM: item.OLD_EQT_LOC_NM || '',
        ITEM_MODEL: item.ITEM_MODEL || item.MODEL_NM || '',
        EQT_USE_ARR_YN: item.EQT_USE_ARR_YN || '',
        BIZ_CL_NM: item.BIZ_CL_NM || '',
        MST_SO_ID: item.MST_SO_ID || '',
        MST_SO_NM: item.MST_SO_NM || '',
      } as UnreturnedEqt));

      transformedList.sort((a, b) => {
        if (a.isScanned && !b.isScanned) return -1;
        if (!a.isScanned && b.isScanned) return 1;
        return 0;
      });

      setUnreturnedList(transformedList);
    } catch (error) {
      console.error('Unreturned equipment lookup failed:', error);
      alert('미회수장비 조회에 실패했습니다.');
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
            STTL_YN: 'N',
            // PCMWK_NOT_REV_EQT Oracle procedure required parameters
            BILL_YN: (item as any).BILL_YN || 'N',
            RCPT_YN: (item as any).RCPT_YN || '0',
            EQT_PROD_CMPS_ID: (item as any).EQT_PROD_CMPS_ID || '',
            BASIC_PROD_CMPS_ID: (item as any).BASIC_PROD_CMPS_ID || '',
            EQT_CL_CD: item.EQT_CL_CD || (item as any).EQT_CL || '',
            EQT_USE_STAT_CD: (item as any).EQT_USE_STAT_CD || '1',
            SVC_CD: (item as any).SVC_CD || '',
            IF_DTL_ID: (item as any).IF_DTL_ID || '0000000000'
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
        let msg = successCount + '건 회수처리 완료';
        if (skipCount > 0) {
          msg += `\n(${skipCount}건 EQT_NO 형식 오류로 건너뜀)`;
        }
        alert(msg);
        setRecoveryModalOpen(false);
        setScannedSerials([]);
        handleSearch();
      } else {
        throw new Error('회수처리 실패');
      }
    } catch (error) {
      console.error('Recovery process failed:', error);
      alert('회수처리에 실패했습니다.');
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

  // Render equipment item - 통일된 간단히/자세히 형식
  const renderEquipmentItem = (item: UnreturnedEqt & { _globalIdx: number }) => {
    const isLost = isLostEquipment(item);
    const canSelect = isLost;
    const originalIdx = unreturnedList.findIndex(u => u.EQT_SERNO === item.EQT_SERNO);

    return (
      <div
        key={item._globalIdx}
        onClick={() => canSelect && handleCheckItem(originalIdx, !item.CHK)}
        className={`p-3 rounded-lg border-2 transition-all ${
          canSelect ? 'cursor-pointer' : 'cursor-not-allowed opacity-70'
        } ${
          item.CHK
            ? 'bg-blue-50 border-blue-400'
            : item.isScanned
              ? 'bg-orange-50 border-orange-200'
              : 'bg-gray-50 border-gray-200 hover:border-gray-300'
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
            {/* Line 1: 모델명 + [장비상태] 뱃지 */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 min-w-0">
                <span className="text-base font-bold text-gray-900 truncate">{item.EQT_CL_NM || item.ITEM_NM || '-'}</span>
                {item.isScanned && (
                  <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-orange-100 text-orange-700 flex-shrink-0">스캔</span>
                )}
              </div>
              <span className={`px-2 py-0.5 rounded-full text-xs font-medium flex-shrink-0 ml-2 ${
                isLost ? 'bg-red-100 text-red-700' : 'bg-blue-100 text-blue-700'
              }`}>
                {isLost ? '분실' : (item.EQT_STAT_CD_NM || '재고')}
              </span>
            </div>
            {/* Line 2: S/N + [EQT_USE_ARR_YN] 뱃지 */}
            <div className="flex items-center justify-between mt-1">
              <span className="text-sm text-gray-600">{item.EQT_SERNO || '-'}</span>
              {(() => {
                const arrYn = item.EQT_USE_ARR_YN;
                if (!arrYn) return null; // 값 없으면 뱃지 숨김
                let bgColor = 'bg-gray-100 text-gray-700';
                let label = arrYn;
                if (arrYn === 'Y') { bgColor = 'bg-green-100 text-green-700'; label = '사용가능'; }
                else if (arrYn === 'A') { bgColor = 'bg-purple-100 text-purple-700'; label = '검사대기'; }
                else if (arrYn === 'N') { bgColor = 'bg-red-100 text-red-700'; label = '사용불가'; }
                else if (arrYn === 'W') { bgColor = 'bg-blue-100 text-blue-700'; label = '입고대기'; }
                else if (arrYn === 'R') { bgColor = 'bg-yellow-100 text-yellow-700'; label = '반납요청'; }
                else if (arrYn === 'D') { bgColor = 'bg-orange-100 text-orange-700'; label = '폐기대기'; }
                return (
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium flex-shrink-0 ml-2 ${bgColor}`}>
                    {label}
                  </span>
                );
              })()}
            </div>
            {/* Line 3: MAC + 날짜 (YYYY-MM-DD) */}
            <div className="flex items-center justify-between mt-0.5">
              <span className="text-sm text-gray-600">{formatMac(item.MAC_ADDRESS) || '-'}</span>
              <span className="text-sm text-gray-600">{formatDateDash(item.EQT_USE_END_DT || '')}</span>
            </div>
          </div>
        </div>
        {/* 자세히 보기: 추가 정보 */}
        {viewMode === 'detail' && (
          <div className="bg-gray-100 rounded-lg p-2 mt-2 text-xs space-y-1 ml-6">
            <div className="flex items-center justify-between"><span className="text-gray-800">{item.ITEM_MODEL || '-'}</span><span className="font-medium text-gray-800">{getSoName(item.SO_NM || item.SO_ID) || '-'}</span></div>
            <div className="flex items-center justify-between"><span><span className="text-gray-500">장비상태  : </span><span className="text-gray-800">{item.EQT_STAT_CD_NM || '-'}</span></span><span className="text-gray-400 text-xs">{item.EQT_NO || '-'}</span></div>
            <div><span className="text-gray-500">변경종류  : </span><span className="text-gray-800">{item.CHG_KND_NM || '-'}</span></div>
            <div><span className="text-gray-500">현재위치  : </span><span className="text-gray-800">{item.EQT_LOC_NM || item.EQT_LOC_TP_NM || '-'}</span></div>
            <div><span className="text-gray-500">이전위치  : </span><span className="text-gray-800">{item.OLD_EQT_LOC_NM || '-'}</span></div>
            <div><span className="text-gray-500">계약ID    : </span><span className="text-gray-800 font-mono">{formatCtrtId(item.CTRT_ID)}</span></div>
          </div>
        )}
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
          {/* 고객 검색 - 클릭 시 팝업 */}
          <div className="flex items-center gap-2">
            <label className="text-xs font-medium text-gray-600 w-14 flex-shrink-0">고객검색</label>
            <div
              onClick={() => setCustomerModalOpen(true)}
              className="flex-1 flex gap-2 cursor-pointer min-w-0 overflow-hidden"
            >
              <input
                type="text"
                value={selectedCustomer?.CUST_NM || ''}
                readOnly
                className="flex-1 min-w-0 px-2 py-2.5 text-sm border border-gray-200 rounded-lg bg-gray-50 cursor-pointer truncate"
                placeholder="고객명"
              />
              <input
                type="text"
                value={selectedCustomer?.CUST_ID || ''}
                readOnly
                className="w-24 flex-shrink-0 px-2 py-2.5 text-sm border border-gray-200 rounded-lg bg-gray-50 cursor-pointer"
                placeholder="고객ID"
              />
            </div>
            {/* 고객 리셋 버튼 */}
            {selectedCustomer && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setSelectedCustomer(null);
                  setSearchParams({...searchParams, CUST_ID: '', CUST_NM: ''});
                  setUnreturnedList([]);
                }}
                className="w-9 h-9 flex items-center justify-center text-red-500 bg-red-50 hover:bg-red-100 rounded-lg transition-all flex-shrink-0"
                title="고객 초기화"
              >
                <X className="w-5 h-5" />
              </button>
            )}
          </div>

          {/* S/N + 스캔 버튼 */}
          <div className="flex items-center gap-2 overflow-hidden">
            <label className="text-xs font-medium text-gray-600 w-14 flex-shrink-0">S/N</label>
            <input
              type="text"
              value={searchParams.EQT_SERNO}
              onChange={(e) => setSearchParams({...searchParams, EQT_SERNO: e.target.value.toUpperCase()})}
              className="flex-1 min-w-0 px-3 py-2.5 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent uppercase transition-all font-mono"
              placeholder="S/N 또는 MAC 주소 입력"
            />
            <button
              onClick={() => setScanModalOpen(true)}
              className="px-4 py-2.5 bg-green-500 hover:bg-green-600 text-white rounded-lg font-semibold text-sm transition-all active:scale-[0.98] touch-manipulation flex items-center gap-1.5 flex-shrink-0"
              style={{ WebkitTapHighlightColor: 'transparent' }}
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" />
              </svg>
              스캔
            </button>
          </div>

          {/* 조회 버튼 */}
          <button
            onClick={handleSearch}
            disabled={isLoading || (!selectedCustomer && !searchParams.EQT_SERNO)}
            className="w-full bg-blue-500 hover:bg-blue-600 disabled:bg-gray-300 text-white py-3 rounded-lg font-semibold text-sm shadow-sm transition-all active:scale-[0.98] touch-manipulation"
            style={{ WebkitTapHighlightColor: 'transparent' }}
          >
            {isLoading ? '조회 중...' : '조회'}
          </button>
        </div>
      </div>

      {/* Unreturned equipment list */}
      {unreturnedList.length > 0 ? (
        <>
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
            {/* 헤더: 전체선택 + 카운트 (좌) / 간단히-자세히 (우) - EquipmentInquiry 통일 */}
            <div className="px-4 py-2.5 bg-gradient-to-r from-gray-50 to-white border-b border-gray-100 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    onChange={(e) => handleCheckAll(e.target.checked)}
                    checked={filteredList.length > 0 && filteredList.filter(item => isLostEquipment(item)).every(item => item.CHK)}
                    className="w-4 h-4 text-blue-500 rounded focus:ring-blue-500"
                  />
                  <span className="text-sm font-semibold text-gray-800">전체선택</span>
                </label>
                <span className="text-xs text-gray-500">
                  {filteredList.length}건 (선택: {selectedCount}건)
                </span>
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
            {/* 분실 필터 버튼 */}
            <div className="px-4 py-2 border-b border-gray-100">
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
              </div>
            </div>
            {/* Grouped list - 내부 스크롤 제거, 페이지 스크롤 사용 */}
            <div className="divide-y divide-gray-100">
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
                        <span className="text-sm font-bold text-blue-800">{getSoName(soKey)}</span>
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
                            <div className="space-y-2">
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

          {/* 하단 버튼 영역 확보용 여백 */}
          <div className="h-20"></div>
        </>
      ) : (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-8">
          <div className="text-center">
            <div className="w-16 h-16 mx-auto mb-4 bg-blue-100 rounded-full flex items-center justify-center">
              <svg className="w-8 h-8 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
              </svg>
            </div>
            <p className="text-gray-500 text-sm mb-1">
              {isLoading ? '조회 중...' : '미회수 장비가 없습니다'}
            </p>
            <p className="text-gray-400 text-xs">검색 조건을 설정하고 조회 버튼을 눌러주세요</p>
          </div>
        </div>
      )}

      {/* 하단 고정 버튼 영역 - 네비게이션 바 바로 위 */}
      {unreturnedList.length > 0 && (
        <div className="fixed bottom-[56px] left-0 right-0 p-3 z-40" style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}>
          <button
            onClick={() => setRecoveryModalOpen(true)}
            disabled={selectedCount === 0}
            className={`w-full py-3 px-4 rounded-lg font-semibold text-sm shadow-sm transition-all active:scale-[0.98] touch-manipulation flex items-center justify-center gap-2 ${
              selectedCount > 0
                ? 'bg-green-500 hover:bg-green-600 text-white'
                : 'bg-gray-300 text-white cursor-not-allowed'
            }`}
            style={{ WebkitTapHighlightColor: 'transparent' }}
          >
            <Check className="w-4 h-4" />
            회수 처리 {selectedCount > 0 && `(${selectedCount})`}
          </button>
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
        userSoId={userSoId}
      />

      <CustomerSearchModal
        isOpen={customerModalOpen}
        onClose={() => setCustomerModalOpen(false)}
        onSelect={handleCustomerSelect}
      />
    </div>
  );
};

export default EquipmentRecovery;
