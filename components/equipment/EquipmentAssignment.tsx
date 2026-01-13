import React, { useState, useEffect, useRef } from 'react';
import '../../styles/buttons.css';
import {
  getEquipmentOutList,
  getOutEquipmentTargetList,
  addEquipmentQuota
} from '../../services/apiService';
import BaseModal from '../common/BaseModal';
import { debugApiCall } from './equipmentDebug';

interface UserInfo {
  userId: string;
  userName: string;
  userRole: string;
  crrId?: string;
  soId?: string;
  mstSoId?: string;
}

interface EquipmentAssignmentProps {
  onBack: () => void;
  showToast?: (message: string, type: 'success' | 'error' | 'warning' | 'info') => void;
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
  // 수령 상태 (계산됨)
  _receiveStatus?: 'received' | 'partial' | 'none';
  _receivedCount?: number;
  _totalCount?: number;
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
  MAC_ADDRESS?: string;
  PROC_YN: string;
  EQT_CHECK: string;
  REMARK: string;
  CHK: boolean;
}

interface SoListItem {
  SO_ID: string;
  SO_NM: string;
}

// 날짜 포맷 함수 (YYYY.MM.DD)
const formatDateDot = (dateStr: string): string => {
  if (!dateStr) return '';
  // YYYYMMDD -> YYYY.MM.DD
  if (dateStr.length === 8 && !dateStr.includes('-') && !dateStr.includes('.')) {
    return `${dateStr.slice(0, 4)}.${dateStr.slice(4, 6)}.${dateStr.slice(6, 8)}`;
  }
  // YYYY-MM-DD -> YYYY.MM.DD
  if (dateStr.includes('-')) {
    return dateStr.replace(/-/g, '.');
  }
  return dateStr;
};

// API Base URL
const API_BASE = typeof window !== 'undefined' && window.location.hostname !== 'localhost'
  ? `${window.location.protocol}//${window.location.hostname}:8080/api`
  : 'http://52.63.232.141:8080/api';

// 지점 목록 API 호출 (백엔드에서 AUTH_SO_List 가져오기)
const fetchAuthSoList = async (): Promise<SoListItem[]> => {
  try {
    // 1순위: localStorage의 branchList
    const branchList = localStorage.getItem('branchList');
    if (branchList) {
      const parsed = JSON.parse(branchList);
      if (Array.isArray(parsed) && parsed.length > 0) {
        console.log('✅ [장비할당] branchList에서 지점 목록 로드:', parsed.length, '건');
        return parsed;
      }
    }

    // 2순위: userInfo의 authSoList
    const userInfo = localStorage.getItem('userInfo');
    if (userInfo) {
      const user = JSON.parse(userInfo);
      if (user.authSoList && Array.isArray(user.authSoList) && user.authSoList.length > 0) {
        console.log('✅ [장비할당] authSoList에서 지점 목록 로드:', user.authSoList.length, '건');
        return user.authSoList;
      }
    }

    // 3순위: API 호출 (/statistics/equipment/getAuthSoList)
    console.log('🔍 [장비할당] API에서 지점 목록 로드 시도...');
    const response = await fetch(`${API_BASE}/statistics/equipment/getAuthSoList`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ USR_ID: userInfo ? JSON.parse(userInfo).userId : '' })
    });

    if (response.ok) {
      const data = await response.json();
      if (Array.isArray(data) && data.length > 0) {
        console.log('✅ [장비할당] API에서 지점 목록 로드:', data.length, '건');
        // localStorage에 캐시
        localStorage.setItem('branchList', JSON.stringify(data));
        return data;
      }
    }

    console.log('⚠️ [장비할당] 지점 목록 없음 - 전체 조회 모드');
    return [];
  } catch (error) {
    console.error('❌ [장비할당] 지점 목록 로드 실패:', error);
    return [];
  }
};

const EquipmentAssignment: React.FC<EquipmentAssignmentProps> = ({ onBack, showToast }) => {
  // localStorage에서 userInfo 가져오기
  const getUserInfo = (): UserInfo | null => {
    try {
      const stored = localStorage.getItem('userInfo');
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  };

  const userInfo = getUserInfo();

  // 검색 조건 (레거시: 7일 전 ~ 오늘)
  const getDefaultFromDate = () => {
    const d = new Date();
    d.setDate(d.getDate() - 7);
    return d.toISOString().slice(0, 10).replace(/-/g, '');
  };
  const [fromDate, setFromDate] = useState<string>(getDefaultFromDate());
  const [toDate, setToDate] = useState<string>(new Date().toISOString().slice(0, 10).replace(/-/g, ''));
  const [selectedSoId, setSelectedSoId] = useState<string>(userInfo?.soId || '');

  // 데이터
  const [eqtOutList, setEqtOutList] = useState<EqtOut[]>([]);
  const [selectedEqtOut, setSelectedEqtOut] = useState<EqtOut | null>(null);
  const [outTgtEqtList, setOutTgtEqtList] = useState<OutTgtEqt[]>([]);
  const [soList, setSoList] = useState<SoListItem[]>([]);

  // 지점 목록 로드 (컴포넌트 마운트 시)
  useEffect(() => {
    const loadSoList = async () => {
      const list = await fetchAuthSoList();
      setSoList(list);
    };
    loadSoList();
  }, []);

  // 지점 변경 시 리스트 초기화
  useEffect(() => {
    setEqtOutList([]);
    setSelectedEqtOut(null);
    setOutTgtEqtList([]);
  }, [selectedSoId]);

  // UI 상태
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingDetail, setIsLoadingDetail] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [selectedEquipmentDetail, setSelectedEquipmentDetail] = useState<OutTgtEqt | null>(null);
  const [viewMode, setViewMode] = useState<'simple' | 'detail'>('simple');

  // 입고대상장비 섹션 ref (자동 스크롤용)
  const equipmentListRef = useRef<HTMLDivElement>(null);

  // 날짜 형식 변환 (YYYYMMDD -> YYYY-MM-DD)
  const formatDateForInput = (date: string) => {
    if (date.length === 8) {
      return `${date.slice(0, 4)}-${date.slice(4, 6)}-${date.slice(6, 8)}`;
    }
    return date;
  };

  // 날짜 형식 변환 (YYYY-MM-DD -> YYYYMMDD)
  const formatDateForApi = (date: string) => {
    return date.replace(/-/g, '');
  };

  const handleSearch = async () => {
    setIsLoading(true);
    try {
      let allResults: EqtOut[] = [];

      // 전체 선택 시 모든 지점 조회
      if (!selectedSoId && soList.length > 0) {
        console.log('[장비할당] 전체 지점 조회 모드 - ', soList.length, '개 지점');
        const promises = soList.map(so => {
          const params = {
            FROM_OUT_REQ_DT: fromDate,
            TO_OUT_REQ_DT: toDate,
            SO_ID: so.SO_ID,
            PROC_STAT: '%'
          };
          return getEquipmentOutList(params).catch(() => []);
        });
        const results = await Promise.all(promises);
        allResults = results.flat();
        console.log('[장비할당] 전체 지점 조회 완료 - 총', allResults.length, '건');
      } else {
        // 특정 지점 선택 시
        const params = {
          FROM_OUT_REQ_DT: fromDate,
          TO_OUT_REQ_DT: toDate,
          SO_ID: selectedSoId || userInfo?.soId || '209',
          PROC_STAT: '%'
        };
        const result = await debugApiCall(
          'EquipmentAssignment',
          'getEquipmentOutList',
          () => getEquipmentOutList(params),
          params
        );
        allResults = result || [];
      }

      // 지점별 정렬 (SO_NM 기준)
      allResults.sort((a, b) => (a.SO_NM || '').localeCompare(b.SO_NM || ''));

      if (allResults.length === 0) {
        setEqtOutList([]);
        setSelectedEqtOut(null);
        setOutTgtEqtList([]);
        showToast?.('조회된 출고 내역이 없습니다.', 'info');
      } else {
        // 수령 상태를 먼저 계산한 후 목록 표시 (배지가 함께 표시되도록)
        const resultsWithStatus = await Promise.all(
          allResults.map(async (item) => {
            try {
              const equipments = await getOutEquipmentTargetList({ OUT_REQ_NO: item.OUT_REQ_NO });
              const eqList = Array.isArray(equipments) ? equipments : (equipments.output1 || []);

              if (eqList.length === 0) {
                return { ...item, _receiveStatus: 'none' as const, _receivedCount: 0, _totalCount: 0 };
              }

              const receivedCount = eqList.filter((eq: any) => eq.PROC_YN === 'Y').length;
              const totalCount = eqList.length;

              let status: 'received' | 'partial' | 'none' = 'none';
              if (receivedCount === totalCount) {
                status = 'received';
              } else if (receivedCount > 0) {
                status = 'partial';
              }

              return { ...item, _receiveStatus: status, _receivedCount: receivedCount, _totalCount: totalCount };
            } catch {
              return { ...item, _receiveStatus: 'none' as const, _receivedCount: 0, _totalCount: 0 };
            }
          })
        );
        
        setEqtOutList(resultsWithStatus);
        setSelectedEqtOut(null);
        setOutTgtEqtList([]);
        showToast?.(`${resultsWithStatus.length}건의 출고 내역을 조회했습니다.`, 'success');
      }
    } catch (error: any) {
      console.error('❌ [장비할당] 조회 실패:', error);
      showToast?.(error.message || '장비할당 조회에 실패했습니다.', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  // 자동 조회 제거 - 조회 버튼 클릭 시에만 조회

  const handleEqtOutSelect = async (item: EqtOut) => {
    setSelectedEqtOut(item);
    setIsLoadingDetail(true);

    try {
      const params = { OUT_REQ_NO: item.OUT_REQ_NO };

      const result = await debugApiCall(
        'EquipmentAssignment',
        'getOutEquipmentTargetList',
        () => getOutEquipmentTargetList(params),
        params
      );

      const equipmentList = Array.isArray(result) ? result : (result.output1 || []);
      setOutTgtEqtList(equipmentList.map((eq: any) => ({
        ...eq,
        CHK: false
      })));

      if (equipmentList.length === 0) {
        showToast?.('출고된 장비 내역이 없습니다.', 'info');
      }
      
      // 입고대상장비 섹션으로 스크롤
      setTimeout(() => {
        equipmentListRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 100);
    } catch (error: any) {
      console.error('❌ [장비할당] 출고 장비 조회 실패:', error);
      showToast?.(error.message || '출고 장비 조회에 실패했습니다.', 'error');
      setOutTgtEqtList([]);
    } finally {
      setIsLoadingDetail(false);
    }
  };

  const handleCheckAccept = async () => {
    console.log('[입고처리] 버튼 클릭됨');
    console.log('[입고처리] selectedEqtOut:', selectedEqtOut);

    if (!selectedEqtOut) {
      showToast?.('출고 정보를 선택해주세요.', 'warning');
      return;
    }

    // 입고완료가 아닌 선택된 장비만 필터링
    const checkedItems = outTgtEqtList.filter(item => item.CHK && item.PROC_YN !== 'Y');
    console.log('[입고처리] 선택된 장비:', checkedItems.length, '건');
    console.log('[입고처리] 선택된 장비 상세:', checkedItems);

    if (checkedItems.length === 0) {
      showToast?.('입고 처리할 장비를 선택해주세요.', 'warning');
      return;
    }

    // 미할당 장비도 처리 가능 - EQT_NO 없어도 진행
    const validItems = checkedItems;
    console.log('[입고처리] 처리할 장비:', validItems.length, '건');

    try {
      const params = {
        OUT_REQ_NO: selectedEqtOut.OUT_REQ_NO,
        SO_ID: selectedEqtOut.SO_ID || userInfo?.soId || '',
        WRKR_ID: userInfo?.userId || '',
        CARRIER_ID: selectedEqtOut.CRR_ID || userInfo?.crrId || '',
        CRR_ID: selectedEqtOut.CRR_ID || userInfo?.crrId || '',
        equipmentList: validItems.map(item => ({
          EQT_NO: item.EQT_NO || '',
          EQT_SERNO: item.EQT_SERNO || '',
          OUT_REQ_NO: item.OUT_REQ_NO || '',
          PROC_YN: 'Y',  // Required: Mark as received
          CHG_UID: userInfo?.userId || '',  // Required: Change user ID
        }))
      };

      console.log('[입고처리] API 요청 파라미터:', params);

      await debugApiCall(
        'EquipmentAssignment',
        'addEquipmentQuota',
        () => addEquipmentQuota(params),
        params
      );

      showToast?.(`${validItems.length}건의 장비 입고처리가 완료되었습니다.`, 'success');
      await handleSearch();
    } catch (error: any) {
      console.error('❌ [장비할당] 입고처리 실패:', error);
      showToast?.(error.message || '입고처리에 실패했습니다.', 'error');
    }
  };

  const handleCheckAll = (checked: boolean) => {
    setOutTgtEqtList(outTgtEqtList.map(item => {
      const isReceived = item.PROC_YN === 'Y';
      const hasSerial = item.EQT_SERNO && item.EQT_SERNO.trim() !== '';
      const canSelect = !isReceived;  // 입고완료가 아니면 선택 가능 (미할당도 선택 가능)
      return {
        ...item,
        CHK: canSelect ? checked : (isReceived ? true : false)
      };
    }));
  };

  const handleCheckItem = (index: number, checked: boolean) => {
    const newList = [...outTgtEqtList];
    newList[index].CHK = checked;
    setOutTgtEqtList(newList);
  };

  const handleShowDetail = (equipment: OutTgtEqt) => {
    setSelectedEquipmentDetail(equipment);
    setShowDetailModal(true);
  };

  const formatOutDttm = (dttm: string) => {
    if (dttm && dttm.length >= 8) {
      return `${dttm.slice(0, 4)}-${dttm.slice(4, 6)}-${dttm.slice(6, 8)}`;
    }
    return dttm || '-';
  };

  // 장비 품목 중분류에 따른 색상
  const getItemColor = (itemMidCd: string) => {
    switch (itemMidCd) {
      case '03': return 'bg-green-100 text-green-800';  // 추가장비
      case '04': return 'bg-blue-100 text-blue-800';    // 모뎀
      case '05': return 'bg-purple-100 text-purple-800'; // 셋톱박스
      case '07': return 'bg-orange-100 text-orange-800'; // 특수장비
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  // 수령 상태 표시
  const getReceiveStatusDisplay = (item: EqtOut) => {
    if (!item._receiveStatus) {
      return { label: '-', color: 'bg-gray-400 text-white' };
    }
    switch (item._receiveStatus) {
      case 'received':
        return { label: '수령', color: 'bg-green-500 text-white' };
      case 'partial':
        return { label: `일부(${item._receivedCount}/${item._totalCount})`, color: 'bg-yellow-500 text-white' };
      case 'none':
        return { label: '미수령', color: 'bg-red-500 text-white' };
      default:
        return { label: '-', color: 'bg-gray-400 text-white' };
    }
  };

  // MAC 주소 포맷팅
  const formatMac = (mac: string) => {
    if (!mac) return '-';
    if (mac.includes(':') || mac.includes('-')) return mac;
    return mac.match(/.{1,2}/g)?.join(':') || mac;
  };

  return (
    <div className="h-full overflow-y-auto bg-gray-50 px-4 py-4 space-y-3">
        {/* 검색 영역 */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
          <div className="space-y-3">
            {/* 출고일자 범위 */}
            <div className="flex items-center gap-2">
              <label className="text-xs font-medium text-gray-600 w-14 flex-shrink-0">출고일자</label>
              <div className="flex-1 flex items-center gap-2 min-w-0">
                <div className="relative flex-1 min-w-0">
                  <input
                    type="date"
                    value={formatDateForInput(fromDate)}
                    onChange={(e) => setFromDate(formatDateForApi(e.target.value))}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                  />
                  <div className="flex items-center px-3 py-2 text-sm border border-gray-200 rounded-lg bg-white pointer-events-none">
                    <span className="flex-1">{formatDateDot(fromDate)}</span>
                    <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                  </div>
                </div>
                <span className="text-gray-400 flex-shrink-0">~</span>
                <div className="relative flex-1 min-w-0">
                  <input
                    type="date"
                    value={formatDateForInput(toDate)}
                    onChange={(e) => setToDate(formatDateForApi(e.target.value))}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                  />
                  <div className="flex items-center px-3 py-2 text-sm border border-gray-200 rounded-lg bg-white pointer-events-none">
                    <span className="flex-1">{formatDateDot(toDate)}</span>
                    <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                  </div>
                </div>
              </div>
            </div>

            {/* 지점 선택 */}
            <div className="flex items-center gap-2">
              <label className="text-xs font-medium text-gray-600 w-14 flex-shrink-0">지점</label>
              <select
                value={selectedSoId}
                onChange={(e) => setSelectedSoId(e.target.value)}
                className="flex-1 px-3 py-2 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
              >
                <option value="">전체</option>
                {soList.map((item) => (
                  <option key={item.SO_ID} value={item.SO_ID}>{item.SO_NM}</option>
                ))}
              </select>
            </div>

            {/* 조회 버튼 */}
            <button
              onClick={handleSearch}
              disabled={isLoading}
              className="w-full bg-blue-500 hover:bg-blue-600 disabled:bg-gray-400 text-white py-2.5 rounded-lg font-semibold text-sm shadow-sm transition-all active:scale-[0.98] touch-manipulation flex items-center justify-center gap-2"
              style={{ WebkitTapHighlightColor: 'transparent' }}
            >
              {isLoading ? (
                <>
                  <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  조회 중...
                </>
              ) : (
                '조회'
              )}
            </button>
          </div>
        </div>

        {/* 리스트 - 지점별 그룹핑 */}
        {eqtOutList.length > 0 && (
          <div>
            <div className="mb-2">
              <h3 className="text-sm font-semibold text-gray-700">리스트 (파트너사 → 기사)</h3>
            </div>
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
              {/* 컬럼 헤더 */}
              <div className="bg-gray-50 px-3 py-2 border-b border-gray-200 flex items-center text-xs font-semibold text-gray-600">
                <span className="w-24">출고일</span>
                <span className="flex-1">협력업체</span>
                <span className="w-28 text-right">출고번호</span>
              </div>
              {/* 지점별 그룹핑된 리스트 */}
              <div>
                {(() => {
                  const grouped = eqtOutList.reduce((acc, item) => {
                    const key = item.SO_NM || '기타';
                    if (!acc[key]) acc[key] = [];
                    acc[key].push(item);
                    return acc;
                  }, {} as Record<string, EqtOut[]>);
                  const soNames = Object.keys(grouped).sort();

                  return soNames.map((soName) => (
                    <div key={soName}>
                      <div className="bg-gray-100 px-3 py-2 border-b border-gray-200">
                        <span className="text-xs font-semibold text-gray-700">{soName}</span>
                        <span className="ml-2 text-xs text-gray-500">({grouped[soName].length}건)</span>
                      </div>
                      {grouped[soName].map((item, idx) => (
                        <div
                          key={idx}
                          onClick={() => handleEqtOutSelect(item)}
                          className={`px-3 py-2.5 border-b border-gray-50 cursor-pointer transition-colors ${
                            selectedEqtOut?.OUT_REQ_NO === item.OUT_REQ_NO
                              ? 'bg-blue-50 border-l-4 border-blue-500'
                              : 'hover:bg-blue-50/50'
                          }`}
                        >
                          <div className="flex items-center text-xs">
                            <span className="w-20 text-gray-900 whitespace-nowrap">{formatOutDttm(item.OUT_DTTM || item.OUT_REQ_DT)}</span>
                            <span className="flex-1 text-gray-600 truncate">{item.CRR_NM || '-'}</span>
                            <span className="text-[10px] text-gray-500 mr-2 font-mono">{item.OUT_REQ_NO}</span>
                            <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${getReceiveStatusDisplay(item).color}`}>
                              {getReceiveStatusDisplay(item).label}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  ));
                })()}
              </div>
            </div>
          </div>
        )}



        {/* 입고 대상 장비 리스트 */}
        {selectedEqtOut && (
          <div ref={equipmentListRef}>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-gray-700">입고 대상 장비</h3>
              {outTgtEqtList.length > 0 && (
                <span className="text-xs text-gray-500">{outTgtEqtList.filter(i => i.CHK && i.PROC_YN !== 'Y').length}/{outTgtEqtList.filter(i => i.PROC_YN !== 'Y').length}</span>
              )}
            </div>

            {isLoadingDetail ? (
              <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6 flex items-center justify-center">
                <svg className="animate-spin h-6 w-6 text-blue-500 mr-2" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                <span className="text-sm text-gray-600">장비 목록 조회 중...</span>
              </div>
            ) : outTgtEqtList.length > 0 ? (
              <>
                <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
                  {/* 헤더: 전체선택 + 뷰모드 */}
                  <div className="px-4 py-3 bg-gradient-to-r from-gray-50 to-white border-b border-gray-100">
                    <div className="flex items-center justify-between mb-2">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          onChange={(e) => handleCheckAll(e.target.checked)}
                          checked={outTgtEqtList.filter(i => i.PROC_YN !== 'Y').length > 0 &&
                                   outTgtEqtList.filter(i => i.PROC_YN !== 'Y').every(item => item.CHK)}
                          disabled={outTgtEqtList.filter(i => i.PROC_YN !== 'Y').length === 0}
                          className="w-4 h-4 text-blue-500 rounded focus:ring-blue-500"
                        />
                        <span className="text-sm font-semibold text-gray-800">전체선택</span>
                      </label>
                      <span className="text-xs text-gray-500">
                        {outTgtEqtList.length}건 (선택: {outTgtEqtList.filter(i => i.CHK && i.PROC_YN !== 'Y').length}건)
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

                  {/* 간단히 보기 */}
                  {viewMode === 'simple' && (
                    <div className="p-3 space-y-2">
                      {outTgtEqtList.map((item, idx) => {
                        const isReceived = item.PROC_YN === 'Y';
                        const hasSerial = item.EQT_SERNO && item.EQT_SERNO.trim() !== '';
                        const canSelect = !isReceived && hasSerial;  // 입고완료 또는 미할당은 선택 불가

                        return (
                          <div
                            key={idx}
                            onClick={() => canSelect && handleCheckItem(idx, !item.CHK)}
                            className={`p-3 rounded-lg border-2 transition-all ${
                              canSelect ? 'cursor-pointer' : 'cursor-not-allowed opacity-70'
                            } ${
                              item.CHK
                                ? 'bg-blue-50 border-blue-400'
                                : isReceived ? 'bg-green-50/50 border-green-200'
                                : !hasSerial ? 'bg-gray-100/50 border-gray-200'
                                : 'bg-gray-50 border-transparent hover:border-gray-200'
                            }`}
                          >
                            <div className="flex items-start gap-3">
                              <input
                                type="checkbox"
                                checked={isReceived ? true : (item.CHK || false)}
                                onChange={(e) => { e.stopPropagation(); canSelect && handleCheckItem(idx, e.target.checked); }}
                                disabled={!canSelect}
                                className={`w-5 h-5 rounded focus:ring-blue-500 mt-0.5 ${
                                  !canSelect ? 'text-gray-300 cursor-not-allowed' : 'text-blue-500'
                                }`}
                              />
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center justify-between mb-2">
                                  <div className="flex items-center gap-2 min-w-0 flex-1 mr-2">
                                    <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium flex-shrink-0 ${getItemColor(item.ITEM_MID_CD)}`}>
                                      {item.ITEM_MID_CD_NM || '장비'}
                                    </span>
                                    <span className="text-sm font-medium text-gray-900 truncate">
                                      {item.EQT_CL_NM || '-'}
                                    </span>
                                  </div>
                                  <span className={`px-2 py-1 rounded-full text-xs font-semibold ${
                                    isReceived ? 'bg-green-100 text-green-700' :
                                    !hasSerial ? 'bg-gray-100 text-gray-700' :
                                    'bg-blue-100 text-blue-700'
                                  }`}>
                                    {isReceived ? '입고완료' : !hasSerial ? '미할당' : '대기'}
                                  </span>
                                </div>
                                <div className="space-y-0.5 text-xs">
                                  <div className="font-mono text-gray-800 text-[11px]">{item.EQT_SERNO || '-'}</div>
                                  <div className="font-mono text-gray-600 text-[11px]">{formatMac(item.MAC_ADDRESS || '')}</div>
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* 자세히 보기 */}
                  {viewMode === 'detail' && (
                    <div className="p-3 space-y-2">
                      {outTgtEqtList.map((item, idx) => {
                        const isReceived = item.PROC_YN === 'Y';
                        const hasSerial = item.EQT_SERNO && item.EQT_SERNO.trim() !== '';
                        const canSelect = !isReceived && hasSerial;  // 입고완료 또는 미할당은 선택 불가

                        return (
                          <div
                            key={idx}
                            onClick={() => canSelect && handleCheckItem(idx, !item.CHK)}
                            className={`p-3 rounded-lg border-2 transition-all ${
                              canSelect ? 'cursor-pointer' : 'cursor-not-allowed opacity-70'
                            } ${
                              item.CHK
                                ? 'bg-blue-50 border-blue-400'
                                : isReceived ? 'bg-green-50/30 border-green-200'
                                : 'bg-white border-gray-100 hover:border-gray-300'
                            }`}
                          >
                            <div className="flex items-start gap-3">
                              <input
                                type="checkbox"
                                checked={isReceived ? true : (item.CHK || false)}
                                onChange={(e) => { e.stopPropagation(); canSelect && handleCheckItem(idx, e.target.checked); }}
                                disabled={!canSelect}
                                className={`w-5 h-5 rounded focus:ring-blue-500 mt-0.5 ${
                                  isReceived ? 'text-green-500 cursor-not-allowed' : 'text-blue-500'
                                }`}
                              />
                              <div className="flex-1 min-w-0">
                                {/* 상단: 품목 배지 + 장비명 + 상태 */}
                                <div className="flex items-center justify-between mb-3">
                                  <div className="flex items-center gap-2 min-w-0 flex-1 mr-2">
                                    <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium flex-shrink-0 ${getItemColor(item.ITEM_MID_CD)}`}>
                                      {item.ITEM_MID_CD_NM || '장비'}
                                    </span>
                                    <span className="text-sm font-medium text-gray-900 truncate">
                                      {item.EQT_CL_NM || '-'}
                                    </span>
                                  </div>
                                  <span className={`px-2 py-1 rounded-full text-xs font-semibold ${
                                    isReceived ? 'bg-green-100 text-green-700' :
                                    !hasSerial ? 'bg-gray-100 text-gray-700' :
                                    'bg-blue-100 text-blue-700'
                                  }`}>
                                    {isReceived ? '입고완료' : !hasSerial ? '미할당' : '대기'}
                                  </span>
                                </div>

                                {/* 상세 정보 - 장비처리와 동일한 회색 박스 레이아웃 */}
                                <div className="bg-gray-50 rounded-lg p-3">
                                  <div className="space-y-1.5 text-xs">
                                    {/* 요청수량 (값만) */}
                                    <div className="text-gray-700">{item.OUT_REQ_QTY || 0}개 요청</div>

                                    {/* 출고수량 (값만) */}
                                    <div className="text-green-600">{item.OUT_QTY || 0}개 출고</div>

                                    {/* 현재위치 (라벨 유지) */}
                                    <div className="flex items-center gap-2">
                                      <span className="text-gray-400">현재위치</span>
                                      <span className="text-gray-700 font-medium">작업기사</span>
                                    </div>

                                    {/* 이전위치 (라벨 유지) */}
                                    <div className="flex items-center gap-2">
                                      <span className="text-gray-400">이전위치</span>
                                      <span className="text-gray-700">창고</span>
                                    </div>

                                    {/* 입고수량 (값만) */}
                                    <div className={`font-medium ${(item.IBGO_QTY || 0) > 0 ? 'text-blue-600' : 'text-gray-600'}`}>
                                      {item.IBGO_QTY || 0}개 입고
                                    </div>

                                    {/* 장비분류 (값만) */}
                                    <div className="text-gray-600">{item.EQT_CL_NM || '-'}</div>
                                  </div>
                                  {item.REMARK && (
                                    <div className="mt-2 pt-1.5 border-t border-gray-200">
                                      <span className="text-gray-400 text-xs">비고: </span>
                                      <span className="text-gray-600 text-xs">{item.REMARK}</span>
                                    </div>
                                  )}
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
                {/* 하단 버튼 영역 확보용 여백 */}
                <div className="h-20"></div>

                {/* 입고처리 버튼 - 네비게이션 바 바로 위 고정 */}
                <div className="fixed bottom-[56px] left-0 right-0 p-3 z-40" style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}>
                  <button
                    onClick={handleCheckAccept}
                    disabled={!outTgtEqtList.some(item => item.CHK && item.PROC_YN !== 'Y')}
                    className="w-full bg-blue-500 hover:bg-blue-600 disabled:bg-gray-300 text-white py-3 px-6 rounded-lg font-semibold text-sm shadow-sm transition-all active:scale-[0.98] touch-manipulation disabled:cursor-not-allowed"
                    style={{ WebkitTapHighlightColor: 'transparent' }}
                  >
                    선택 장비 입고처리 ({outTgtEqtList.filter(item => item.CHK && item.PROC_YN !== 'Y').length}건)
                  </button>
                </div>
              </>
            ) : (
              <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
                <p className="text-center text-gray-500 text-sm">출고된 장비 내역이 없습니다</p>
              </div>
            )}
          </div>
        )}

        {/* 빈 상태 */}
        {eqtOutList.length === 0 && !isLoading && (
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-8">
            <div className="text-center">
              <div className="w-16 h-16 mx-auto mb-4 bg-blue-100 rounded-full flex items-center justify-center">
                <svg className="w-8 h-8 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                </svg>
              </div>
              <p className="text-gray-600 text-sm mb-1">리스트가 없습니다</p>
              <p className="text-gray-400 text-xs">검색 조건을 설정하고 조회 버튼을 눌러주세요</p>
            </div>
          </div>
        )}

      {/* 장비 상세 모달 */}
      <BaseModal
        isOpen={showDetailModal}
        onClose={() => setShowDetailModal(false)}
        title="장비 상세 정보"
        size="md"
      >
        {selectedEquipmentDetail && (
          <div className="space-y-4">
            {/* 기본 정보 */}
            <div className="bg-gray-50 rounded-lg p-3">
              <h4 className="text-sm font-semibold text-gray-700 mb-2">기본 정보</h4>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div>
                  <span className="text-gray-500">장비분류:</span>
                  <span className="ml-1 font-medium">{selectedEquipmentDetail.ITEM_MAX_CD_NM || '-'}</span>
                </div>
                <div>
                  <span className="text-gray-500">장비명:</span>
                  <span className="ml-1 font-medium">{selectedEquipmentDetail.EQT_CL_NM || '-'}</span>
                </div>
                <div>
                  <span className="text-gray-500">품목코드:</span>
                  <span className="ml-1 font-medium">{selectedEquipmentDetail.ITEM_MID_CD || '-'}</span>
                </div>
                <div>
                  <span className="text-gray-500">품목명:</span>
                  <span className="ml-1 font-medium">{selectedEquipmentDetail.ITEM_MID_CD_NM || '-'}</span>
                </div>
              </div>
            </div>

            {/* 장비 식별 정보 */}
            <div className="bg-blue-50 rounded-lg p-3">
              <h4 className="text-sm font-semibold text-blue-700 mb-2">장비 식별 정보</h4>
              <div className="space-y-2 text-xs">
                <div className="flex justify-between">
                  <span className="text-gray-500">장비번호:</span>
                  <span className="font-mono font-medium">{selectedEquipmentDetail.EQT_NO || '-'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">시리얼번호:</span>
                  <span className="font-mono font-medium">{selectedEquipmentDetail.EQT_SERNO || '-'}</span>
                </div>
                {selectedEquipmentDetail.MAC_ADDRESS && (
                  <div className="flex justify-between">
                    <span className="text-gray-500">MAC 주소:</span>
                    <span className="font-mono font-medium">{selectedEquipmentDetail.MAC_ADDRESS}</span>
                  </div>
                )}
              </div>
            </div>

            {/* 출고/수량 정보 */}
            <div className="bg-green-50 rounded-lg p-3">
              <h4 className="text-sm font-semibold text-green-700 mb-2">출고 정보</h4>
              <div className="grid grid-cols-3 gap-2 text-xs">
                <div className="text-center">
                  <div className="text-gray-500">요청수량</div>
                  <div className="text-lg font-bold text-gray-800">{selectedEquipmentDetail.OUT_REQ_QTY || 0}</div>
                </div>
                <div className="text-center">
                  <div className="text-gray-500">출고수량</div>
                  <div className="text-lg font-bold text-green-600">{selectedEquipmentDetail.OUT_QTY || 0}</div>
                </div>
                <div className="text-center">
                  <div className="text-gray-500">입고수량</div>
                  <div className="text-lg font-bold text-blue-600">{selectedEquipmentDetail.IBGO_QTY || 0}</div>
                </div>
              </div>
            </div>

            {/* 처리 상태 */}
            <div className="bg-yellow-50 rounded-lg p-3">
              <h4 className="text-sm font-semibold text-yellow-700 mb-2">처리 상태</h4>
              <div className="flex items-center justify-between text-xs">
                <span className="text-gray-500">처리여부:</span>
                <span className={`px-2 py-1 rounded font-medium ${
                  selectedEquipmentDetail.PROC_YN === 'Y'
                    ? 'bg-green-100 text-green-700'
                    : 'bg-yellow-100 text-yellow-700'
                }`}>
                  {selectedEquipmentDetail.PROC_YN === 'Y' ? '처리완료' : '미처리'}
                </span>
              </div>
              {selectedEquipmentDetail.REMARK && (
                <div className="mt-2">
                  <span className="text-gray-500">비고:</span>
                  <p className="mt-1 text-gray-700 bg-white p-2 rounded">{selectedEquipmentDetail.REMARK}</p>
                </div>
              )}
            </div>

            {/* 닫기 버튼 */}
            <div className="flex justify-end">
              <button
                onClick={() => setShowDetailModal(false)}
                className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded font-medium text-sm transition-colors"
              >
                닫기
              </button>
            </div>
          </div>
        )}
      </BaseModal>
    </div>
  );
};

export default EquipmentAssignment;
