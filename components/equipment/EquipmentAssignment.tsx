import React, { useState, useEffect } from 'react';
import '../../styles/buttons.css';
import {
  getEquipmentOutList,
  checkEquipmentProc,
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

  // UI 상태
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingDetail, setIsLoadingDetail] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [selectedEquipmentDetail, setSelectedEquipmentDetail] = useState<OutTgtEqt | null>(null);

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
      const params = {
        FROM_OUT_REQ_DT: fromDate,
        TO_OUT_REQ_DT: toDate,
        SO_ID: selectedSoId || undefined
      };

      const result = await debugApiCall(
        'EquipmentAssignment',
        'getEquipmentOutList',
        () => getEquipmentOutList(params),
        params
      );
      setEqtOutList(result || []);
      setSelectedEqtOut(null);
      setOutTgtEqtList([]);

      if (result.length === 0) {
        showToast?.('조회된 출고 내역이 없습니다.', 'info');
      } else {
        showToast?.(`${result.length}건의 출고 내역을 조회했습니다.`, 'success');
      }
    } catch (error: any) {
      console.error('❌ [장비할당] 조회 실패:', error);
      showToast?.(error.message || '장비할당 조회에 실패했습니다.', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const handleEqtOutSelect = async (item: EqtOut) => {
    setSelectedEqtOut(item);
    setIsLoadingDetail(true);

    try {
      const params = { OUT_REQ_NO: item.OUT_REQ_NO };

      const result = await debugApiCall(
        'EquipmentAssignment',
        'checkEquipmentProc',
        () => checkEquipmentProc(params),
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
    } catch (error: any) {
      console.error('❌ [장비할당] 출고 장비 조회 실패:', error);
      showToast?.(error.message || '출고 장비 조회에 실패했습니다.', 'error');
      setOutTgtEqtList([]);
    } finally {
      setIsLoadingDetail(false);
    }
  };

  const handleCheckAccept = async () => {
    if (!selectedEqtOut) {
      showToast?.('출고 정보를 선택해주세요.', 'warning');
      return;
    }

    const checkedItems = outTgtEqtList.filter(item => item.CHK);
    if (checkedItems.length === 0) {
      showToast?.('입고 처리할 장비를 선택해주세요.', 'warning');
      return;
    }

    try {
      const params = {
        OUT_REQ_NO: selectedEqtOut.OUT_REQ_NO,
        equipmentList: checkedItems
      };

      await debugApiCall(
        'EquipmentAssignment',
        'addEquipmentQuota',
        () => addEquipmentQuota(params),
        params
      );

      showToast?.(`${checkedItems.length}건의 장비 입고처리가 완료되었습니다.`, 'success');
      await handleSearch();
    } catch (error: any) {
      console.error('❌ [장비할당] 입고처리 실패:', error);
      showToast?.(error.message || '입고처리에 실패했습니다.', 'error');
    }
  };

  const handleCheckAll = (checked: boolean) => {
    setOutTgtEqtList(outTgtEqtList.map(item => ({ ...item, CHK: checked })));
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

        {/* 출고 리스트 */}
        {eqtOutList.length > 0 && (
          <div>
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-semibold text-gray-700">출고 리스트 (파트너사 → 기사)</h3>
              <span className="text-xs text-gray-500">{eqtOutList.length}건</span>
            </div>
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
              <div className="max-h-48 overflow-y-auto">
                <table className="w-full text-xs">
                  <thead className="bg-gray-50 sticky top-0 z-10">
                    <tr>
                      <th className="px-3 py-2.5 text-center text-xs font-semibold text-gray-600 border-b border-gray-100 whitespace-nowrap">출고일</th>
                      <th className="px-3 py-2.5 text-left text-xs font-semibold text-gray-600 border-b border-gray-100">협력업체</th>
                      <th className="px-3 py-2.5 text-left text-xs font-semibold text-gray-600 border-b border-gray-100">지점</th>
                      <th className="px-3 py-2.5 text-center text-xs font-semibold text-gray-600 border-b border-gray-100">상태</th>
                    </tr>
                  </thead>
                  <tbody>
                    {eqtOutList.map((item, idx) => (
                      <tr
                        key={idx}
                        onClick={() => handleEqtOutSelect(item)}
                        className={`cursor-pointer transition-colors ${
                          selectedEqtOut?.OUT_REQ_NO === item.OUT_REQ_NO
                            ? 'bg-blue-50 border-l-4 border-blue-500'
                            : 'hover:bg-blue-50/50'
                        }`}
                      >
                        <td className="px-3 py-2.5 text-xs text-center text-gray-900 border-b border-gray-50 whitespace-nowrap">
                          {formatOutDttm(item.OUT_DTTM || item.OUT_REQ_DT)}
                        </td>
                        <td className="px-3 py-2.5 text-xs text-gray-700 border-b border-gray-50 truncate max-w-[100px]">
                          {item.CRR_NM || '-'}
                        </td>
                        <td className="px-3 py-2.5 text-xs text-gray-700 border-b border-gray-50">
                          {item.SO_NM || '-'}
                        </td>
                        <td className="px-3 py-2.5 text-xs text-center border-b border-gray-50">
                          <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${
                            item.PROC_STAT === 'C' ? 'bg-green-100 text-green-700' :
                            item.PROC_STAT === 'P' ? 'bg-yellow-100 text-yellow-700' :
                            'bg-gray-100 text-gray-700'
                          }`}>
                            {item.PROC_STAT_NM || (item.PROC_STAT === 'C' ? '완료' : item.PROC_STAT === 'P' ? '진행중' : '대기')}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* 선택된 출고 정보 요약 */}
        {selectedEqtOut && (
          <div className="bg-gradient-to-r from-blue-50 to-blue-100/50 rounded-xl border border-blue-200 p-4">
            <div className="flex items-center gap-2 mb-3">
              <span className="text-blue-600">📦</span>
              <span className="text-sm font-semibold text-gray-800">선택된 출고</span>
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div>
                <span className="text-gray-500">출고번호:</span>
                <span className="ml-1 font-medium">{selectedEqtOut.OUT_REQ_NO}</span>
              </div>
              <div>
                <span className="text-gray-500">출고일:</span>
                <span className="ml-1 font-medium">{formatOutDttm(selectedEqtOut.OUT_DTTM || selectedEqtOut.OUT_REQ_DT)}</span>
              </div>
              <div>
                <span className="text-gray-500">협력업체:</span>
                <span className="ml-1 font-medium">{selectedEqtOut.CRR_NM || '-'}</span>
              </div>
              <div>
                <span className="text-gray-500">할당기사:</span>
                <span className="ml-1 font-medium">{selectedEqtOut.OUT_REQ_UID_NM || '-'}</span>
              </div>
            </div>
          </div>
        )}

        {/* 입고 대상 장비 리스트 */}
        {selectedEqtOut && (
          <div>
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-semibold text-gray-700">입고 대상 장비</h3>
              {outTgtEqtList.length > 0 && (
                <span className="text-xs text-gray-500">{outTgtEqtList.length}개</span>
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
                  {/* 전체 선택 */}
                  <div className="bg-gray-50 px-4 py-3 border-b border-gray-100 flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="checkAll"
                      onChange={(e) => handleCheckAll(e.target.checked)}
                      checked={outTgtEqtList.length > 0 && outTgtEqtList.every(item => item.CHK)}
                      className="w-4 h-4 text-blue-500 rounded focus:ring-blue-500"
                    />
                    <label htmlFor="checkAll" className="text-xs text-gray-600 cursor-pointer">전체 선택</label>
                  </div>

                  {/* 장비 카드 리스트 */}
                  <div className="max-h-64 overflow-y-auto divide-y divide-gray-50">
                    {outTgtEqtList.map((item, idx) => (
                      <div
                        key={idx}
                        className={`p-4 ${item.CHK ? 'bg-blue-50' : 'hover:bg-gray-50'} transition-colors`}
                      >
                        <div className="flex items-start gap-3">
                          {/* 체크박스 */}
                          <input
                            type="checkbox"
                            checked={item.CHK || false}
                            onChange={(e) => handleCheckItem(idx, e.target.checked)}
                            className="w-4 h-4 mt-0.5 text-blue-500 rounded focus:ring-blue-500"
                          />

                          {/* 장비 정보 */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${getItemColor(item.ITEM_MID_CD)}`}>
                                {item.ITEM_MID_CD_NM || item.ITEM_MAX_CD_NM || '장비'}
                              </span>
                              <span className="text-sm font-medium text-gray-900 truncate">
                                {item.EQT_CL_NM || '-'}
                              </span>
                            </div>
                            <div className="text-xs text-gray-500 space-y-0.5">
                              <div className="flex items-center gap-2">
                                <span className="font-mono">S/N: {item.EQT_SERNO || '-'}</span>
                                {item.MAC_ADDRESS && (
                                  <span className="text-gray-400 font-mono">| MAC: {item.MAC_ADDRESS}</span>
                                )}
                              </div>
                              <div className="flex items-center gap-2">
                                <span>수량: {item.OUT_QTY || 1}</span>
                                <span className={`${item.PROC_YN === 'Y' ? 'text-green-600' : 'text-yellow-600'}`}>
                                  {item.PROC_YN === 'Y' ? '✓ 처리완료' : '○ 미처리'}
                                </span>
                              </div>
                            </div>
                          </div>

                          {/* 상세보기 버튼 */}
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleShowDetail(item);
                            }}
                            className="px-3 py-1.5 text-xs text-blue-600 hover:bg-blue-100 rounded-lg transition-colors"
                          >
                            상세
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* 입고처리 버튼 */}
                <div className="mt-3 flex justify-end gap-2">
                  <button
                    onClick={handleCheckAccept}
                    disabled={!outTgtEqtList.some(item => item.CHK)}
                    className="bg-blue-500 hover:bg-blue-600 disabled:bg-gray-300 text-white py-2.5 px-6 rounded-lg font-semibold text-sm shadow-sm transition-all active:scale-[0.98] touch-manipulation disabled:cursor-not-allowed"
                    style={{ WebkitTapHighlightColor: 'transparent' }}
                  >
                    선택 장비 입고처리 ({outTgtEqtList.filter(item => item.CHK).length}건)
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
              <p className="text-gray-600 text-sm mb-1">출고 리스트가 없습니다</p>
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
