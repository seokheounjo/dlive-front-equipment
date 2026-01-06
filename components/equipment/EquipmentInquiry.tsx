import React, { useState, useEffect } from 'react';
import {
  getWorkerEquipmentList,
  getEquipmentReturnRequestList,
  addEquipmentReturnRequest,
  delEquipmentReturnRequest,
  processEquipmentLoss,
  setEquipmentCheckStandby,
  getCommonCodes,
  getEquipmentHistoryInfo,
  // 새 API 함수 (받은문서 20251223 분석 기반)
  getWrkrHaveEqtListAll,      // 보유장비 전체 조회
  getEquipmentReturnRequestListAll,  // 반납요청 장비 조회 (getEquipmentReturnRequestList_All)
  getEquipmentChkStndByAAll   // 검사대기 장비 조회
} from '../../services/apiService';
import BaseModal from '../common/BaseModal';
// getCustProdInfo 활용 API (테스트 완료: 기사보유장비 조회)
import { getTechnicianEquipmentFromWork } from '../../services/equipmentWorkApi';
import { debugApiCall } from './equipmentDebug';
// BarcodeScanner removed - using S/N input instead

interface EquipmentInquiryProps {
  onBack: () => void;
  showToast?: (message: string, type: 'success' | 'error' | 'warning' | 'info') => void;
}

interface UserInfo {
  userId: string;
  userName: string;
  soId?: string;
  crrId?: string;
  mstSoId?: string;
}

// 검색 카테고리 (단일 선택)
type SearchCategory = 'OWNED' | 'RETURN_REQUESTED' | 'INSPECTION_WAITING';

// 장비 상태 코드 매핑 (CMEP301)
const EQT_STAT_CODE_MAP: Record<string, string> = {
  '10': '양호',
  '11': '사용불가(불량)',
  '20': '설치완료',
  '35': '검수대기',
  '50': '폐기대기입고',
  '60': '폐품',
  '70': '분실',
  '71': '도난',
  '72': '분실',
  '73': 'AS업체보유',
  '74': '고객분실',
  '75': '분실예정',
  '80': '자가진단불량',
  '81': '고객판매',
  '82': '고객소비자판매',
  '83': '고객분실판매',
  '84': '업체분실판매',
  '90': '미등록중'
};

// 장비 위치 코드 매핑 (CMEP306)
const EQT_LOC_TP_CODE_MAP: Record<string, string> = {
  '1': 'SO(직영대리점)',
  '2': '협력업체',
  '3': '작업기사',
  '4': '고객'
};

// 코드 이름 변환 헬퍼 함수
const getEqtStatName = (code: string): string => EQT_STAT_CODE_MAP[code] || code;
const getEqtLocTpName = (code: string): string => EQT_LOC_TP_CODE_MAP[code] || code;

// 장비 아이템 인터페이스
interface EquipmentItem {
  CHK: boolean;
  EQT_NO: string;
  EQT_SERNO: string;
  MAC_ADDRESS: string;
  EQT_CL_CD: string;
  EQT_CL_NM: string;
  ITEM_CD?: string;
  ITEM_MID_CD: string;
  ITEM_MID_NM: string;
  ITEM_NM: string;
  SO_ID: string;
  SO_NM: string;
  EQT_STAT_CD: string;
  EQT_STAT_NM: string;
  EQT_LOC_TP_CD?: string;
  EQT_LOC_TP_NM?: string;
  PROC_STAT?: string;
  PROC_STAT_NM?: string;
  WRKR_ID?: string;
  WRKR_NM?: string;
  CUST_ID?: string;
  CTRT_ID?: string;
  CTRT_STAT?: string;
  WRK_ID?: string;
  CRR_ID?: string;
  EQT_USE_END_DT?: string;
  RETN_RESN_CD?: string;
  RETN_RESN_NM?: string;
  // 카테고리 구분용 (OWNED, RETURN_REQUESTED, INSPECTION_WAITING)
  _category?: 'OWNED' | 'RETURN_REQUESTED' | 'INSPECTION_WAITING';
}

// 상태 변경 결과 인터페이스
interface StatusChangeResult {
  success: { EQT_SERNO: string; EQT_NO: string; ITEM_NM: string }[];
  failed: { EQT_SERNO: string; EQT_NO: string; ITEM_NM: string; error: string }[];
}

interface SoListItem {
  SO_ID: string;
  SO_NM: string;
}

interface ItemMidItem {
  COMMON_CD: string;
  COMMON_CD_NM: string;
}

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
        console.log('✅ [장비처리] branchList에서 지점 목록 로드:', parsed.length, '건');
        return parsed;
      }
    }

    // 2순위: userInfo의 authSoList
    const userInfo = localStorage.getItem('userInfo');
    if (userInfo) {
      const user = JSON.parse(userInfo);
      if (user.authSoList && Array.isArray(user.authSoList) && user.authSoList.length > 0) {
        console.log('✅ [장비처리] authSoList에서 지점 목록 로드:', user.authSoList.length, '건');
        return user.authSoList;
      }
    }

    // 3순위: API 호출 (/statistics/equipment/getAuthSoList)
    console.log('🔍 [장비처리] API에서 지점 목록 로드 시도...');
    const response = await fetch(`${API_BASE}/statistics/equipment/getAuthSoList`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ USR_ID: userInfo ? JSON.parse(userInfo).userId : '' })
    });

    if (response.ok) {
      const data = await response.json();
      if (Array.isArray(data) && data.length > 0) {
        console.log('✅ [장비처리] API에서 지점 목록 로드:', data.length, '건');
        localStorage.setItem('branchList', JSON.stringify(data));
        return data;
      }
    }

    console.log('⚠️ [장비처리] 지점 목록 없음 - 전체 조회 모드');
    return [];
  } catch (error) {
    console.error('❌ [장비처리] 지점 목록 로드 실패:', error);
    return [];
  }
};

// 장비 중분류 목록
const DEFAULT_ITEM_MID_LIST: ItemMidItem[] = [
  { COMMON_CD: '', COMMON_CD_NM: '전체' },
  { COMMON_CD: '03', COMMON_CD_NM: '추가장비' },
  { COMMON_CD: '04', COMMON_CD_NM: '모뎀' },
  { COMMON_CD: '05', COMMON_CD_NM: '셋톱박스' },
  { COMMON_CD: '07', COMMON_CD_NM: '특수장비' },
];

const EquipmentInquiry: React.FC<EquipmentInquiryProps> = ({ onBack, showToast }) => {
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

  // 검색 조건
  const [selectedSoId, setSelectedSoId] = useState<string>(userInfo?.soId || '');
  
  const [selectedItemMidCd, setSelectedItemMidCd] = useState<string>('');
  const [eqtSerno, setEqtSerno] = useState<string>('');

  // 검색 카테고리 - 라디오 버튼으로 단일 선택
  const [selectedCategory, setSelectedCategory] = useState<SearchCategory>('OWNED');
  
  // 필터 패널 열림/닫힘 상태
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  
  // 필터 카운트 (적용된 필터 개수)
  const getFilterCount = () => {
    let count = 0;
    if (selectedSoId) count++;
    if (selectedItemMidCd) count++;
    if (eqtSerno) count++;
    return count;
  };

  // 데이터
  const [equipmentList, setEquipmentList] = useState<EquipmentItem[]>([]);
  const [soList, setSoList] = useState<SoListItem[]>([]);
  const [itemMidList] = useState<ItemMidItem[]>(DEFAULT_ITEM_MID_LIST);

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
  const [showReturnModal, setShowReturnModal] = useState(false);
  const [showLossModal, setShowLossModal] = useState(false);
  const [selectedEquipment, setSelectedEquipment] = useState<EquipmentItem | null>(null);
  const [returnReason, setReturnReason] = useState<string>('');
  const [lossReason, setLossReason] = useState<string>('');

  // 뷰 모드: simple(간단히), medium(중간), detail(자세히)
  const [viewMode, setViewMode] = useState<'simple' | 'medium' | 'detail'>('simple');

  // 상태 변경 결과 (검사대기 다중처리용)
  const [statusChangeResult, setStatusChangeResult] = useState<StatusChangeResult | null>(null);
  const [showStatusChangeResult, setShowStatusChangeResult] = useState(false);

  // Barcode scanner state
  // BarcodeScanner state removed

  // 초기 데이터 로드
  useEffect(() => {
    loadDropdownData();
  }, []);

  // 테스트용: 컴포넌트 마운트 시 자동 조회 (S/N 고정값 설정된 경우)
  useEffect(() => {
    if (eqtSerno === '705KVQS022868' && userInfo?.userId) {
      console.log('🚀 [자동조회] S/N 고정값으로 자동 조회 시작...');
      // 지점 목록 로드 완료 후 조회
      const timer = setTimeout(() => {
        handleSearch();
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [userInfo?.userId]);

  const loadDropdownData = async () => {
    // 지점 목록은 useEffect의 fetchAuthSoList()에서 이미 로드됨
    // 이 함수는 다른 드롭다운 데이터가 필요할 경우를 위해 유지
    console.log('📋 [드롭다운] 초기화 완료');
  };

  // 장비 조회
  const handleSearch = async () => {
    if (!userInfo?.userId) {
      showToast?.('로그인 정보가 없습니다. 다시 로그인해주세요.', 'error');
      return;
    }

    setIsLoading(true);
    setEquipmentList([]);

    try {
      console.log('🔍 [장비처리] 시작:', {
        selectedCategory,
        SO_ID: selectedSoId,
        WRKR_ID: userInfo.userId,
            CRR_ID: userInfo.crrId, // CRR_ID = WRKR_ID (기사 본인)
        ITEM_MID_CD: selectedItemMidCd,
        EQT_SERNO: eqtSerno
      });

      let result: any[] = [];

      // 장비처리: 항상 보유장비/반납요청/검사대기 API 사용 (S/N 입력 시 결과에서 필터링)
      // S/N 입력 시에도 보유장비만 조회됨 (getEquipmentHistoryInfo 사용 금지)
      {
        //// 일반 조회: 체크된 조건에 따라 여러 API 호출 후 합치기
        const baseParams: any = {
          WRKR_ID: userInfo.userId,
            CRR_ID: userInfo.crrId, // CRR_ID = WRKR_ID (기사 본인)
          SO_ID: selectedSoId || userInfo.soId || undefined,
          ITEM_MID_CD: selectedItemMidCd || undefined,
        };

        // 체크된 조건에 따라 API 호출
        const allResults: any[] = [];

        // 보유장비 선택 시 - getWrkrHaveEqtList_All 사용 (CRR_ID 필수!)
        if (selectedCategory === 'OWNED') {
          try {
            const ownedResult = await debugApiCall(
              'EquipmentInquiry',
              'getWrkrHaveEqtListAll (보유장비)',
              () => getWrkrHaveEqtListAll({
                WRKR_ID: userInfo.userId,
                CRR_ID: userInfo.crrId || '',  // 협력업체 ID (필수!)
                SO_ID: selectedSoId || userInfo.soId || undefined,
              }),
              { WRKR_ID: userInfo.userId, CRR_ID: userInfo.crrId }
            );
            if (Array.isArray(ownedResult)) {
              // ITEM_MID_CD 필터 적용 (프론트엔드에서)
              let filtered = ownedResult;
              if (selectedItemMidCd) {
                filtered = ownedResult.filter((item: any) => item.ITEM_MID_CD === selectedItemMidCd);
              }
              // 보유장비 표시용 태그 추가
              allResults.push(...filtered.map((item: any) => ({ ...item, _category: 'OWNED' })));
            }
          } catch (e) {
            console.log('보유장비 조회 실패 (getCustProdInfo):', e);
          }
        }

        // 반납요청 선택 시 - getEquipmentReturnRequestListAll 사용 (phoneNumberManager)
        if (selectedCategory === 'RETURN_REQUESTED') {
          const returnParams = {
            WRKR_ID: userInfo.userId,
            SO_ID: selectedSoId || userInfo.soId || undefined,
            CRR_ID: userInfo.crrId,  // 협력업체 ID
          };
          try {
            const returnResult = await debugApiCall(
              'EquipmentInquiry',
              'getEquipmentReturnRequestListAll (반납요청)',
              () => getEquipmentReturnRequestListAll(returnParams),
              returnParams
            );
            if (Array.isArray(returnResult)) {
              // ITEM_MID_CD 필터 적용 (프론트엔드에서)
              let filtered = returnResult;
              if (selectedItemMidCd) {
                filtered = returnResult.filter((item: any) => item.ITEM_MID_CD === selectedItemMidCd);
              }
              // 반납요청 표시용 태그 추가
              allResults.push(...filtered.map(item => ({ ...item, _category: 'RETURN_REQUESTED' })));
            }
          } catch (e) {
            console.log('반납요청 조회 실패:', e);
          }
        }

        // 검사대기 선택 시
        if (selectedCategory === 'INSPECTION_WAITING') {
          const inspectionParams = {
            WRKR_ID: userInfo.userId,
            CRR_ID: userInfo.crrId, // CRR_ID = WRKR_ID (기사 본인)
            SO_ID: selectedSoId || userInfo.soId || undefined,
            EQT_SERNO: undefined, // 전체 조회
          };
          try {
            const inspectionResult = await debugApiCall(
              'EquipmentInquiry',
              'getEquipmentChkStndByAAll (검사대기)',
              () => getEquipmentChkStndByAAll(inspectionParams),
              inspectionParams
            );
            if (Array.isArray(inspectionResult)) {
              // 검사대기 표시용 태그 추가
              allResults.push(...inspectionResult.map(item => ({ ...item, _category: 'INSPECTION_WAITING' })));
            }
          } catch (e) {
            console.log('검사대기 조회 실패:', e);
          }
        }

        result = allResults;

        // S/N 입력 시 결과에서 필터링 (보유장비 중에서만 검색)
        if (eqtSerno && eqtSerno.trim().length > 0) {
          const searchSerno = eqtSerno.trim().toUpperCase();
          result = result.filter((item: any) => {
            const itemSerno = (item.EQT_SERNO || '').toUpperCase();
            const itemMac = (item.MAC_ADDRESS || '').toUpperCase();
            return itemSerno.includes(searchSerno) || itemMac.includes(searchSerno);
          });
          console.log('🔍 [장비처리] S/N 필터 후:', result.length, '건 (검색어:', searchSerno, ')');
        }
      }

      // 결과 변환
      const transformedList: EquipmentItem[] = (Array.isArray(result) ? result : []).map((item: any) => ({
        CHK: false,
        EQT_NO: item.EQT_NO || '',
        EQT_SERNO: item.EQT_SERNO || item.SERIAL_NO || '',
        MAC_ADDRESS: item.MAC_ADDRESS || item.MAC || item.TA_MAC_ADDRESS || '',
        EQT_CL_CD: item.EQT_CL_CD || '',
        EQT_CL_NM: item.EQT_CL_NM || item.EQT_TYPE || '',
        ITEM_MID_CD: item.ITEM_MID_CD || '',
        ITEM_MID_NM: item.ITEM_MID_NM || '',
        ITEM_NM: item.ITEM_NM || item.ITEM_MODEL || '',
        SO_ID: item.SO_ID || selectedSoId,
        SO_NM: item.SO_NM || '',
        EQT_STAT_CD: item.EQT_STAT_CD || item.STATUS || '',
        EQT_STAT_NM: item.EQT_STAT_NM || item.STATUS_NM || item.EQT_STAT_CD_NM || getEqtStatName(item.EQT_STAT_CD || item.STATUS || ''),
        EQT_LOC_TP_CD: item.EQT_LOC_TP_CD || '',
        EQT_LOC_TP_NM: item.EQT_LOC_TP_NM || item.EQT_LOC_TP_CD_NM || getEqtLocTpName(item.EQT_LOC_TP_CD || ''),
        PROC_STAT: item.PROC_STAT || '',
        PROC_STAT_NM: item.PROC_STAT_NM || '',
        WRKR_ID: item.WRKR_ID || userInfo.userId,
        WRKR_NM: item.WRKR_NM || userInfo.userName,
        CUST_ID: item.CUST_ID || '',
        CTRT_ID: item.CTRT_ID || '',
        EQT_USE_END_DT: item.EQT_USE_END_DT || '',
        RETN_RESN_CD: item.RETN_RESN_CD || '',
        RETN_RESN_NM: item.RETN_RESN_NM || item.RETN_RESN_CD_NM || '',
        // 카테고리 유지 (API 호출시 추가된 _category)
        _category: item._category || undefined,
      }));

      // 장비 종류 필터링 (S/N 검색에서도 적용)
      let filteredList = transformedList;
      if (selectedItemMidCd) {
        filteredList = filteredList.filter(item => item.ITEM_MID_CD === selectedItemMidCd);
      }

      // 카테고리별 정렬 (보유 -> 반납요청 -> 검사대기, 그 다음 장비종류별)
      filteredList.sort((a, b) => {
        const categoryOrder = { 'OWNED': 1, 'RETURN_REQUESTED': 2, 'INSPECTION_WAITING': 3 };
        const catA = categoryOrder[a._category || 'OWNED'] || 4;
        const catB = categoryOrder[b._category || 'OWNED'] || 4;
        if (catA !== catB) return catA - catB;
        // 같은 카테고리 내에서 장비종류별 정렬
        const midA = a.ITEM_MID_CD || '';
        const midB = b.ITEM_MID_CD || '';
        return midA.localeCompare(midB);
      });

      setEquipmentList(filteredList);

      if (filteredList.length === 0) {
        showToast?.('조회된 장비가 없습니다.', 'info');
      } else {
        showToast?.(`${filteredList.length}건의 장비를 조회했습니다.`, 'success');
      }
    } catch (error: any) {
      console.error('❌ [장비조회] 실패:', error);
      showToast?.(error.message || '장비 조회에 실패했습니다.', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  // 전체 선택/해제
  const handleCheckAll = (checked: boolean) => {
    setEquipmentList(equipmentList.map(item => ({ ...item, CHK: checked })));
  };

  // 개별 선택
  const handleCheckItem = (index: number, checked: boolean) => {
    const newList = [...equipmentList];
    newList[index].CHK = checked;
    setEquipmentList(newList);
  };

  // 장비 중분류별 색상
  const getItemColor = (itemMidCd: string) => {
    switch (itemMidCd) {
      case '03': return 'bg-green-100 text-green-800';  // 추가장비
      case '04': return 'bg-blue-100 text-blue-800';    // 모뎀
      case '05': return 'bg-purple-100 text-purple-800'; // 셋톱박스
      case '07': return 'bg-orange-100 text-orange-800'; // 특수장비
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  // 장비반납/취소 버튼 클릭
  const handleReturnClick = () => {
    const checkedItems = equipmentList.filter(item => item.CHK);
    if (checkedItems.length === 0) {
      showToast?.('반납할 장비를 선택해주세요.', 'warning');
      return;
    }
    setShowReturnModal(true);
  };

  // 장비반납 처리
  const handleReturnRequest = async (action: 'RETURN' | 'CANCEL') => {
    const checkedItems = equipmentList.filter(item => item.CHK);
    if (checkedItems.length === 0) {
      showToast?.('처리할 장비를 선택해주세요.', 'warning');
      return;
    }

    try {
      if (action === 'CANCEL') {
        // 반납취소는 delEquipmentReturnRequest API 사용
        const cancelParams = {
          WRKR_ID: userInfo?.userId || '',
          CRR_ID: userInfo?.crrId || '',
          SO_ID: checkedItems[0]?.SO_ID || selectedSoId || userInfo?.soId || '',
          equipmentList: checkedItems.map(item => ({
            EQT_NO: item.EQT_NO,
            EQT_SERNO: item.EQT_SERNO,
          })),
        };
        const result = await debugApiCall(
          'EquipmentInquiry',
          'delEquipmentReturnRequest',
          () => delEquipmentReturnRequest(cancelParams),
          cancelParams
        );
      } else {
        // 반납요청은 addEquipmentReturnRequest API 사용
        const params = {
          WRKR_ID: userInfo?.userId || '',
          CRR_ID: userInfo?.crrId || '',           // 협력업체 ID (필수!)
          SO_ID: checkedItems[0]?.SO_ID || selectedSoId || userInfo?.soId || '',
          MST_SO_ID: userInfo?.mstSoId || userInfo?.soId || '',
          RETURN_TP: '2',                          // 2 = 작업기사 반납
          equipmentList: checkedItems.map(item => ({
            EQT_NO: item.EQT_NO,
            EQT_SERNO: item.EQT_SERNO,
            ACTION: action,
            RETN_RESN_CD: returnReason || '01',
          })),
        };

        const result = await debugApiCall(
          'EquipmentInquiry',
          'addEquipmentReturnRequest',
          () => addEquipmentReturnRequest(params),
          params
        );
      }
      showToast?.(
        action === 'RETURN'
          ? `${checkedItems.length}건의 장비 반납 요청이 완료되었습니다.`
          : `${checkedItems.length}건의 반납 요청이 취소되었습니다.`,
        'success'
      );
      setShowReturnModal(false);
      setReturnReason('');
      await handleSearch(); // 리스트 새로고침
    } catch (error: any) {
      console.error('❌ 반납 처리 실패:', error);
      showToast?.(error.message || '반납 처리에 실패했습니다.', 'error');
    }
  };

  // 분실처리 버튼 클릭
  const handleLossClick = () => {
    const checkedItems = equipmentList.filter(item => item.CHK);
    if (checkedItems.length === 0) {
      showToast?.('분실 처리할 장비를 선택해주세요.', 'warning');
      return;
    }
    if (checkedItems.length > 1) {
      showToast?.('분실 처리는 한 번에 1건만 가능합니다.', 'warning');
      return;
    }
    setSelectedEquipment(checkedItems[0]);
    setShowLossModal(true);
  };

  // 분실처리 실행
  const handleLossProcess = async () => {
    if (!selectedEquipment) return;

    try {
      // 순차적 API 호출: getWrkrListDetail -> cmplEqtCustLossIndem
      const params = {
        EQT_NO: selectedEquipment.EQT_NO,
        EQT_SERNO: selectedEquipment.EQT_SERNO || '',
        WRKR_ID: userInfo?.userId || '',
        CRR_ID: userInfo?.crrId || '',
        SO_ID: selectedEquipment.SO_ID || selectedSoId || userInfo?.soId || '',  // 장비 데이터에서 SO_ID 우선
        EQT_CL_CD: selectedEquipment.EQT_CL_CD || '',
        LOSS_REASON: lossReason || undefined,
      };

      const result = await debugApiCall(
        'EquipmentInquiry',
        'processEquipmentLoss',
        () => processEquipmentLoss(params),
        params
      );
      showToast?.('장비 분실 처리가 완료되었습니다.', 'success');
      setShowLossModal(false);
      setSelectedEquipment(null);
      setLossReason('');
      await handleSearch(); // 리스트 새로고침
    } catch (error: any) {
      console.error('❌ 분실 처리 실패:', error);
      showToast?.(error.message || '분실 처리에 실패했습니다.', 'error');
    }
  };

  // 사용가능변경 버튼 클릭
  const handleStatusChangeClick = async () => {
    const checkedItems = equipmentList.filter(item => item.CHK);
    if (checkedItems.length === 0) {
      showToast?.('상태 변경할 장비를 선택해주세요.', 'warning');
      return;
    }

    // 동일고객의 당일해지 후 당일설치 작업이 발생하는 경우만 변경 가능
    // 이 검증은 서버에서 처리되지만 UI에서도 안내
    if (!confirm('동일 고객의 당일해지 후 당일설치 작업이 발생하는 경우에만 변경 가능합니다. 계속하시겠습니까?')) {
      return;
    }

    try {
      let successCount = 0;
      for (const item of checkedItems) {
        // setEquipmentChkStndByY requires full parameters from equipment data
        const params = {
          EQT_NO: item.EQT_NO,
          SO_ID: item.SO_ID || userInfo.soId || '',
          EQT_SERNO: item.EQT_SERNO || '',
          USER_ID: userInfo.userId || '',
          CRR_ID: item.CRR_ID || userInfo.crrId || '',
          WRKR_ID: userInfo.userId || '',
          CUST_ID: item.CUST_ID || '',
          WRK_ID: item.WRK_ID || '',
          CTRT_ID: item.CTRT_ID || '',
          CTRT_STAT: item.CTRT_STAT || '',
          PROG_GB: 'Y'  // Y = change to usable
        };
        try {
          await debugApiCall(
            'EquipmentInquiry',
            'setEquipmentCheckStandby',
            () => setEquipmentCheckStandby(params),
            params
          );
          successCount++;
        } catch (err) {
          console.error('장비 상태 변경 실패:', item.EQT_SERNO, err);
        }
      }

      if (successCount > 0) {
        showToast?.(`${successCount}건의 장비 상태가 '사용가능'으로 변경되었습니다.`, 'success');
        await handleSearch(); // 리스트 새로고침
      } else {
        throw new Error('장비 상태 변경에 실패했습니다.');
      }
    } catch (error: any) {
      console.error('❌ 상태 변경 실패:', error);
      showToast?.(error.message || '상태 변경에 실패했습니다.', 'error');
    }
  };

  // 바코드 스캔 핸들러
  const handleBarcodeScan = (barcode: string) => {
    console.log('Barcode scanned:', barcode);
    setEqtSerno(barcode.toUpperCase());
    setShowBarcodeScanner(false);
    showToast?.(`바코드 스캔 완료: ${barcode}`, 'success');
    // Auto search after scan
    setTimeout(() => {
      handleSearch();
    }, 300);
  };

  // 선택된 장비 수
  const selectedCount = equipmentList.filter(item => item.CHK).length;

  // 카테고리별 선택된 장비 수 (버튼 활성화용)
  const selectedOwned = equipmentList.filter(item => item.CHK && item._category === 'OWNED').length;
  const selectedReturn = equipmentList.filter(item => item.CHK && item._category === 'RETURN_REQUESTED').length;
  const selectedInspection = equipmentList.filter(item => item.CHK && item._category === 'INSPECTION_WAITING').length;

  // 카테고리별 전체 장비 수 (그룹화 표시용)
  const totalOwned = equipmentList.filter(item => item._category === 'OWNED').length;
  const totalReturn = equipmentList.filter(item => item._category === 'RETURN_REQUESTED').length;
  const totalInspection = equipmentList.filter(item => item._category === 'INSPECTION_WAITING').length;

  // 카테고리별 전체 선택 핸들러
  const handleCheckCategory = (category: 'OWNED' | 'RETURN_REQUESTED' | 'INSPECTION_WAITING', checked: boolean) => {
    setEquipmentList(equipmentList.map(item =>
      item._category === category ? { ...item, CHK: checked } : item
    ));
  };

  return (
    <div className="h-full overflow-y-auto bg-gray-50 px-4 py-4 space-y-3">
        {/* 검색 조건 선택 박스 - 체크박스로 복수 선택 가능 */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-3">
          <div className="grid grid-cols-3 gap-2">
            {/* 보유장비 체크박스 */}
            <button
              type="button"
              onClick={() => setSelectedCategory('OWNED')}
              className={`p-3 rounded-lg border-2 transition-all text-center active:scale-[0.98] touch-manipulation ${
                selectedCategory === 'OWNED'
                  ? 'bg-green-50 border-green-500 text-green-700 shadow-sm'
                  : 'border-gray-200 hover:bg-gray-50 text-gray-400'
              }`}
              style={{ WebkitTapHighlightColor: 'transparent' }}
            >
              <div className="flex items-center justify-center gap-1.5 mb-1">
                <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                  selectedCategory === 'OWNED' ? 'bg-green-500 border-green-500' : 'border-gray-300'
                }`}>
                  {selectedCategory === 'OWNED' && (
                    <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                  )}
                </div>
                <span className="text-sm font-bold">보유</span>
              </div>
              
            </button>

            {/* 반납요청 체크박스 */}
            <button
              type="button"
              onClick={() => setSelectedCategory('RETURN_REQUESTED')}
              className={`p-3 rounded-lg border-2 transition-all text-center active:scale-[0.98] touch-manipulation ${
                selectedCategory === 'RETURN_REQUESTED'
                  ? 'bg-amber-50 border-amber-500 text-amber-700 shadow-sm'
                  : 'border-gray-200 hover:bg-gray-50 text-gray-400'
              }`}
              style={{ WebkitTapHighlightColor: 'transparent' }}
            >
              <div className="flex items-center justify-center gap-1.5 mb-1">
                <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                  selectedCategory === 'RETURN_REQUESTED' ? 'bg-amber-500 border-amber-500' : 'border-gray-300'
                }`}>
                  {selectedCategory === 'RETURN_REQUESTED' && (
                    <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                  )}
                </div>
                <span className="text-sm font-bold">반납요청</span>
              </div>
              
            </button>

            {/* 검사대기 체크박스 */}
            <button
              type="button"
              onClick={() => setSelectedCategory('INSPECTION_WAITING')}
              className={`p-3 rounded-lg border-2 transition-all text-center active:scale-[0.98] touch-manipulation ${
                selectedCategory === 'INSPECTION_WAITING'
                  ? 'bg-purple-50 border-purple-500 text-purple-700 shadow-sm'
                  : 'border-gray-200 hover:bg-gray-50 text-gray-400'
              }`}
              style={{ WebkitTapHighlightColor: 'transparent' }}
            >
              <div className="flex items-center justify-center gap-1.5 mb-1">
                <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                  selectedCategory === 'INSPECTION_WAITING' ? 'bg-purple-500 border-purple-500' : 'border-gray-300'
                }`}>
                  {selectedCategory === 'INSPECTION_WAITING' && (
                    <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                  )}
                </div>
                <span className="text-sm font-bold">검사대기</span>
              </div>
              
            </button>
          </div>
        </div>

        {/* 조회 버튼 */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
          <button
            onClick={handleSearch}
            disabled={isLoading}
            className="w-full bg-blue-500 hover:bg-blue-600 disabled:bg-gray-400 text-white py-4 rounded-xl font-bold text-base shadow-md transition-all flex items-center justify-center gap-2 active:scale-[0.98] touch-manipulation"
            style={{ WebkitTapHighlightColor: 'transparent' }}
          >
            {isLoading ? (
              <>
                <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                조회 중...
              </>
            ) : (
              <>
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                조회
              </>
            )}
          </button>
        </div>

        {/* 상세 필터 영역 - 접기/펼치기 */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
          {/* 필터 헤더 (토글 버튼) */}
          <button
            onClick={() => setIsFilterOpen(!isFilterOpen)}
            className="w-full px-4 py-3 flex items-center justify-between bg-gray-50 hover:bg-gray-100 transition-colors"
          >
            <div className="flex items-center gap-2">
              <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
              </svg>
              <span className="text-sm font-semibold text-gray-700">상세 필터</span>
              {(selectedSoId || selectedItemMidCd || eqtSerno) && (
                <span className="px-1.5 py-0.5 bg-blue-500 text-white text-[10px] rounded-full font-medium">
                  {[selectedSoId, selectedItemMidCd, eqtSerno].filter(Boolean).length}
                </span>
              )}
            </div>
            <svg
              className={`w-5 h-5 text-gray-400 transition-transform duration-200 ${isFilterOpen ? 'rotate-180' : ''}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>

          {/* 필터 내용 (접기/펼치기) */}
          {isFilterOpen && (
            <div className="p-4 border-t border-gray-100 space-y-3">
              {/* 지점 */}
              <div className="flex items-center gap-2">
                <label className="text-xs font-medium text-gray-600 w-16 flex-shrink-0">지점</label>
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
              {/* 장비종류 */}
              <div className="flex items-center gap-2">
                <label className="text-xs font-medium text-gray-600 w-16 flex-shrink-0">장비종류</label>
                <select
                  value={selectedItemMidCd}
                  onChange={(e) => setSelectedItemMidCd(e.target.value)}
                  className="flex-1 px-3 py-2 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                >
                  {itemMidList.map((item) => (
                    <option key={item.COMMON_CD} value={item.COMMON_CD}>{item.COMMON_CD_NM}</option>
                  ))}
                </select>
              </div>
              {/* S/N */}
              <div className="flex items-center gap-2">
                <label className="text-xs font-medium text-gray-600 w-16 flex-shrink-0">S/N</label>
                <input
                  type="text"
                  value={eqtSerno}
                  onChange={(e) => setEqtSerno(e.target.value.toUpperCase())}
                  className="flex-1 px-3 py-2 text-sm border border-gray-200 rounded-lg uppercase focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                  placeholder="바코드 또는 일련번호"
                />
              </div>
            </div>
          )}
        </div>

        {/* 장비 리스트 */}
        {equipmentList.length > 0 && (
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
            {/* 헤더: 전체 선택 + 카테고리별 선택 + 뷰 모드 선택 */}
            <div className="px-4 py-3 bg-gradient-to-r from-gray-50 to-white border-b border-gray-100">
              <div className="flex items-center justify-between mb-2">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    onChange={(e) => handleCheckAll(e.target.checked)}
                    checked={equipmentList.length > 0 && equipmentList.every(item => item.CHK)}
                    className="w-4 h-4 text-blue-500 rounded focus:ring-blue-500"
                  />
                  <span className="text-sm font-semibold text-gray-800">전체선택</span>
                </label>
                <span className="text-xs text-gray-500">
                  {equipmentList.length}건 (선택: {selectedCount}건)
                </span>
              </div>
              {/* 카테고리별 전체 선택 */}
              <div className="flex gap-2 mb-2 flex-wrap">
                {totalReturn > 0 && (
                  <label className="flex items-center gap-1.5 px-2 py-1 bg-amber-50 rounded-lg cursor-pointer border border-amber-200">
                    <input
                      type="checkbox"
                      onChange={(e) => handleCheckCategory('RETURN_REQUESTED', e.target.checked)}
                      checked={totalReturn > 0 && selectedReturn === totalReturn}
                      className="w-3.5 h-3.5 text-amber-500 rounded focus:ring-amber-500"
                    />
                    <span className="text-xs font-medium text-amber-700">반납요청 ({selectedReturn}/{totalReturn})</span>
                  </label>
                )}
                {totalInspection > 0 && (
                  <label className="flex items-center gap-1.5 px-2 py-1 bg-purple-50 rounded-lg cursor-pointer border border-purple-200">
                    <input
                      type="checkbox"
                      onChange={(e) => handleCheckCategory('INSPECTION_WAITING', e.target.checked)}
                      checked={totalInspection > 0 && selectedInspection === totalInspection}
                      className="w-3.5 h-3.5 text-purple-500 rounded focus:ring-purple-500"
                    />
                    <span className="text-xs font-medium text-purple-700">검사대기 ({selectedInspection}/{totalInspection})</span>
                  </label>
                )}
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
                  onClick={() => setViewMode('medium')}
                  className={`flex-1 py-1.5 px-2 text-xs font-medium rounded-md transition-all ${
                    viewMode === 'medium'
                      ? 'bg-white text-blue-600 shadow-sm'
                      : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  중간
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

            {/* 간단히 보기: 품목명 + 상태 + 카테고리 */}
            {viewMode === 'simple' && (
              <div className="max-h-80 overflow-y-auto p-3 space-y-2">
                {equipmentList.map((item, idx) => (
                  <div
                    key={idx}
                    onClick={() => handleCheckItem(idx, !item.CHK)}
                    className={`flex items-center justify-between p-3 rounded-lg border-2 cursor-pointer transition-all ${
                      item.CHK
                        ? 'bg-blue-50 border-blue-400'
                        : item._category === 'OWNED' ? 'bg-green-50/50 border-green-200 hover:border-green-300'
                        : item._category === 'RETURN_REQUESTED' ? 'bg-amber-50/50 border-amber-200 hover:border-amber-300'
                        : item._category === 'INSPECTION_WAITING' ? 'bg-purple-50/50 border-purple-200 hover:border-purple-300'
                        : 'bg-gray-50 border-transparent hover:border-gray-200'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <input
                        type="checkbox"
                        checked={item.CHK || false}
                        onChange={(e) => { e.stopPropagation(); handleCheckItem(idx, e.target.checked); }}
                        className="w-5 h-5 text-blue-500 rounded focus:ring-blue-500"
                      />
                      <div>
                        <div className="flex items-center gap-2">
                          {/* 카테고리 배지 */}
                          <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                            item._category === 'OWNED' ? 'bg-green-500 text-white' :
                            item._category === 'RETURN_REQUESTED' ? 'bg-amber-500 text-white' :
                            item._category === 'INSPECTION_WAITING' ? 'bg-purple-500 text-white' :
                            'bg-gray-400 text-white'
                          }`}>
                            {item._category === 'OWNED' ? '보유' :
                             item._category === 'RETURN_REQUESTED' ? '반납' :
                             item._category === 'INSPECTION_WAITING' ? '검사' : '-'}
                          </span>
                          <span className={`px-2 py-0.5 rounded text-xs font-bold ${getItemColor(item.ITEM_MID_CD)}`}>
                            {item.ITEM_NM || item.EQT_CL_NM || item.ITEM_MID_NM || '장비'}
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="flex flex-col items-end">
                      <span className={`px-2 py-1 rounded-full text-xs font-semibold ${
                        item.EQT_STAT_CD === '10' ? 'bg-green-100 text-green-700' :
                        item.EQT_STAT_CD === '20' ? 'bg-blue-100 text-blue-700' :
                        item.EQT_STAT_CD === '40' ? 'bg-amber-100 text-amber-700' :
                        item.EQT_STAT_CD === '50' ? 'bg-purple-100 text-purple-700' :
                        'bg-gray-100 text-gray-700'
                      }`}>
                        {item.EQT_STAT_NM || getEqtStatName(item.EQT_STAT_CD)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* 중간 보기: 품목명 + 상태 + S/N + MAC + 카테고리 */}
            {viewMode === 'medium' && (
              <div className="max-h-80 overflow-y-auto p-3 space-y-2">
                {equipmentList.map((item, idx) => (
                  <div
                    key={idx}
                    onClick={() => handleCheckItem(idx, !item.CHK)}
                    className={`p-3 rounded-lg border-2 cursor-pointer transition-all ${
                      item.CHK
                        ? 'bg-blue-50 border-blue-400'
                        : item._category === 'OWNED' ? 'bg-green-50/50 border-green-200 hover:border-green-300'
                        : item._category === 'RETURN_REQUESTED' ? 'bg-amber-50/50 border-amber-200 hover:border-amber-300'
                        : item._category === 'INSPECTION_WAITING' ? 'bg-purple-50/50 border-purple-200 hover:border-purple-300'
                        : 'bg-gray-50 border-transparent hover:border-gray-200'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <input
                        type="checkbox"
                        checked={item.CHK || false}
                        onChange={(e) => { e.stopPropagation(); handleCheckItem(idx, e.target.checked); }}
                        className="w-5 h-5 text-blue-500 rounded focus:ring-blue-500 mt-0.5"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            {/* 카테고리 배지 */}
                            <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                              item._category === 'OWNED' ? 'bg-green-500 text-white' :
                              item._category === 'RETURN_REQUESTED' ? 'bg-amber-500 text-white' :
                              item._category === 'INSPECTION_WAITING' ? 'bg-purple-500 text-white' :
                              'bg-gray-400 text-white'
                            }`}>
                              {item._category === 'OWNED' ? '보유' :
                               item._category === 'RETURN_REQUESTED' ? '반납' :
                               item._category === 'INSPECTION_WAITING' ? '검사' : '-'}
                            </span>
                            <span className={`px-2 py-0.5 rounded text-xs font-bold ${getItemColor(item.ITEM_MID_CD)}`}>
                              {item.ITEM_NM || item.EQT_CL_NM || item.ITEM_MID_NM || '장비'}
                            </span>
                          </div>
                          <span className={`px-2 py-1 rounded-full text-xs font-semibold ${
                            item.EQT_STAT_CD === '10' ? 'bg-green-100 text-green-700' :
                            item.EQT_STAT_CD === '20' ? 'bg-blue-100 text-blue-700' :
                            item.EQT_STAT_CD === '40' ? 'bg-amber-100 text-amber-700' :
                            item.EQT_STAT_CD === '50' ? 'bg-purple-100 text-purple-700' :
                            'bg-gray-100 text-gray-700'
                          }`}>
                            {item.EQT_STAT_NM || getEqtStatName(item.EQT_STAT_CD)}
                          </span>
                        </div>
                        <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
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
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* 자세히 보기: 테이블 형식으로 모든 정보 + 카테고리 */}
            {viewMode === 'detail' && (
              <div className="max-h-80 overflow-y-auto p-3 space-y-2">
                {equipmentList.map((item, idx) => (
                  <div
                    key={idx}
                    onClick={() => handleCheckItem(idx, !item.CHK)}
                    className={`p-3 rounded-lg border-2 cursor-pointer transition-all ${
                      item.CHK
                        ? 'bg-blue-50 border-blue-400'
                        : item._category === 'OWNED' ? 'bg-green-50/30 border-green-200 hover:border-green-300'
                        : item._category === 'RETURN_REQUESTED' ? 'bg-amber-50/30 border-amber-200 hover:border-amber-300'
                        : item._category === 'INSPECTION_WAITING' ? 'bg-purple-50/30 border-purple-200 hover:border-purple-300'
                        : 'bg-white border-gray-100 hover:border-gray-300'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <input
                        type="checkbox"
                        checked={item.CHK || false}
                        onChange={(e) => { e.stopPropagation(); handleCheckItem(idx, e.target.checked); }}
                        className="w-5 h-5 text-blue-500 rounded focus:ring-blue-500 mt-0.5"
                      />
                      <div className="flex-1 min-w-0">
                        {/* 상단: 카테고리 + 품목명 + 상태 */}
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center gap-2">
                            {/* 카테고리 배지 */}
                            <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                              item._category === 'OWNED' ? 'bg-green-500 text-white' :
                              item._category === 'RETURN_REQUESTED' ? 'bg-amber-500 text-white' :
                              item._category === 'INSPECTION_WAITING' ? 'bg-purple-500 text-white' :
                              'bg-gray-400 text-white'
                            }`}>
                              {item._category === 'OWNED' ? '보유' :
                               item._category === 'RETURN_REQUESTED' ? '반납' :
                               item._category === 'INSPECTION_WAITING' ? '검사' : '-'}
                            </span>
                            <span className={`px-2 py-0.5 rounded text-xs font-bold ${getItemColor(item.ITEM_MID_CD)}`}>
                              {item.ITEM_NM || item.EQT_CL_NM || '장비'}
                            </span>
                            <span className="text-xs text-gray-400">{item.ITEM_MID_NM}</span>
                          </div>
                          <span className={`px-2 py-1 rounded-full text-xs font-semibold ${
                            item.EQT_STAT_CD === '10' ? 'bg-green-100 text-green-700' :
                            item.EQT_STAT_CD === '20' ? 'bg-blue-100 text-blue-700' :
                            item.EQT_STAT_CD === '40' ? 'bg-amber-100 text-amber-700' :
                            item.EQT_STAT_CD === '50' ? 'bg-purple-100 text-purple-700' :
                            'bg-gray-100 text-gray-700'
                          }`}>
                            {item.EQT_STAT_NM || getEqtStatName(item.EQT_STAT_CD)}
                          </span>
                        </div>

                        {/* 상세 정보 - 세로 배치로 전체 표시 */}
                        <div className="bg-gray-50 rounded-lg p-3 space-y-2">
                          <div className="space-y-1.5 text-xs">
                            <div className="flex">
                              <span className="text-gray-400 w-20 flex-shrink-0">S/N</span>
                              <span className="font-mono text-gray-900 font-medium">{item.EQT_SERNO || '-'}</span>
                            </div>
                            <div className="flex">
                              <span className="text-gray-400 w-20 flex-shrink-0">MAC</span>
                              <span className="font-mono text-gray-700">{item.MAC_ADDRESS || '-'}</span>
                            </div>
                            <div className="flex">
                              <span className="text-gray-400 w-20 flex-shrink-0">지점</span>
                              <span className="text-gray-700">{item.SO_NM || item.SO_ID || '-'}</span>
                            </div>
                            <div className="flex">
                              <span className="text-gray-400 w-20 flex-shrink-0">위치</span>
                              <span className="text-gray-700">{item.EQT_LOC_TP_NM || getEqtLocTpName(item.EQT_LOC_TP_CD || '') || '-'}</span>
                            </div>
                            <div className="flex">
                              <span className="text-gray-400 w-20 flex-shrink-0">장비상태</span>
                              <span className={`font-medium ${item.EQT_STAT_CD === '10' ? 'text-green-600' : item.EQT_STAT_CD === '20' ? 'text-blue-600' : 'text-gray-600'}`}>{item.EQT_STAT_NM || getEqtStatName(item.EQT_STAT_CD) || '-'}</span>
                            </div>
                            <div className="flex">
                              <span className="text-gray-400 w-20 flex-shrink-0">사용가능</span>
                              <span className={`font-medium ${item.EQT_USE_ARR_YN === 'Y' ? 'text-green-600' : item.EQT_USE_ARR_YN === 'A' ? 'text-amber-600' : 'text-gray-600'}`}>{item.EQT_USE_ARR_YN === 'Y' ? '사용가능' : item.EQT_USE_ARR_YN === 'A' ? '검사대기' : item.EQT_USE_ARR_YN === 'N' ? '사용불가' : '-'}</span>
                            </div>
                          </div>
                          {item.RETN_RESN_NM && (
                            <div className="pt-1.5 border-t border-gray-200">
                              <span className="text-gray-400 text-xs">반납사유: </span>
                              <span className="text-amber-600 text-xs font-medium">{item.RETN_RESN_NM}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* 빈 상태 */}
        {equipmentList.length === 0 && !isLoading && (
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-8">
            <div className="text-center">
              <div className="w-16 h-16 mx-auto mb-4 bg-blue-100 rounded-full flex items-center justify-center">
                <svg className="w-8 h-8 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                </svg>
              </div>
              <p className="text-gray-500 text-sm mb-1">조회된 장비가 없습니다</p>
              <p className="text-gray-400 text-xs">검색 조건을 설정하고 조회 버튼을 눌러주세요</p>
            </div>
          </div>
        )}

        {/* 하단 버튼 영역 - 선택된 장비의 실제 카테고리에 따라 버튼 활성화 */}
        <div className="flex gap-2 flex-wrap">
          {/* 보유장비가 선택되었을 때만: 장비반납, 분실처리 */}
          {totalOwned > 0 && (
            <>
              <button
                onClick={handleReturnClick}
                disabled={selectedOwned === 0}
                className={`flex-1 min-w-[100px] py-2.5 rounded-lg font-semibold text-sm shadow-sm transition-all active:scale-[0.98] touch-manipulation ${
                  selectedOwned > 0
                    ? 'bg-blue-500 hover:bg-blue-600 text-white'
                    : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                }`}
                style={{ WebkitTapHighlightColor: 'transparent' }}
              >
                장비반납 {selectedOwned > 0 && `(${selectedOwned})`}
              </button>
              <button
                onClick={handleLossClick}
                disabled={selectedOwned === 0}
                className={`flex-1 min-w-[100px] py-2.5 rounded-lg font-semibold text-sm shadow-sm transition-all active:scale-[0.98] touch-manipulation ${
                  selectedOwned > 0
                    ? 'bg-red-500 hover:bg-red-600 text-white'
                    : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                }`}
                style={{ WebkitTapHighlightColor: 'transparent' }}
              >
                분실처리 {selectedOwned > 0 && `(${selectedOwned})`}
              </button>
            </>
          )}

          {/* 반납요청 장비가 선택되었을 때만: 반납취소 */}
          {totalReturn > 0 && (
            <button
              onClick={() => handleReturnRequest('CANCEL')}
              disabled={selectedReturn === 0}
              className={`flex-1 min-w-[100px] py-2.5 rounded-lg font-semibold text-sm shadow-sm transition-all active:scale-[0.98] touch-manipulation ${
                selectedReturn > 0
                  ? 'bg-amber-500 hover:bg-amber-600 text-white'
                  : 'bg-gray-200 text-gray-400 cursor-not-allowed'
              }`}
              style={{ WebkitTapHighlightColor: 'transparent' }}
            >
              반납취소 {selectedReturn > 0 && `(${selectedReturn})`}
            </button>
          )}

          {/* 검사대기 장비가 선택되었을 때만: 사용가능변경 */}
          {totalInspection > 0 && (
            <button
              onClick={handleStatusChangeClick}
              disabled={selectedInspection === 0}
              className={`flex-1 min-w-[100px] py-2.5 rounded-lg font-semibold text-sm shadow-sm transition-all active:scale-[0.98] touch-manipulation ${
                selectedInspection > 0
                  ? 'bg-green-500 hover:bg-green-600 text-white'
                  : 'bg-gray-200 text-gray-400 cursor-not-allowed'
              }`}
              style={{ WebkitTapHighlightColor: 'transparent' }}
            >
              사용가능변경 {selectedInspection > 0 && `(${selectedInspection})`}
            </button>
          )}
        </div>

      {/* 장비반납 모달 */}
      <BaseModal
        isOpen={showReturnModal}
        onClose={() => setShowReturnModal(false)}
        title="장비반납요청-장비선택"
        size="md"
      >
        <div className="space-y-4">
          {/* 지점 (ReadOnly) */}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">지점</label>
            <input
              type="text"
              value={equipmentList.filter(item => item.CHK)[0]?.SO_NM || soList.find(s => s.SO_ID === selectedSoId)?.SO_NM || soList.find(s => s.SO_ID === userInfo?.soId)?.SO_NM || userInfo?.soId || '-'}
              readOnly
              className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded bg-gray-100"
            />
          </div>

          {/* 반납 사유 선택 */}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">반납 사유</label>
            <select
              value={returnReason}
              onChange={(e) => setReturnReason(e.target.value)}
              className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded"
            >
              <option value="">선택</option>
              <option value="01">장비 사용일 만료</option>
              <option value="02">장비 불량 (고객 설치 불가)</option>
              <option value="03">기타</option>
            </select>
          </div>

          {/* 선택된 장비 리스트 */}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">선택된 장비</label>
            <div className="max-h-40 overflow-y-auto border border-gray-200 rounded">
              <table className="w-full text-xs">
                <thead className="bg-gray-50 sticky top-0">
                  <tr>
                    <th className="px-2 py-1.5 text-left">장비유형</th>
                    <th className="px-2 py-1.5 text-left">S/N</th>
                    <th className="px-2 py-1.5 text-left">상태</th>
                  </tr>
                </thead>
                <tbody>
                  {equipmentList.filter(item => item.CHK).map((item, idx) => (
                    <tr key={idx} className="border-t border-gray-100">
                      <td className="px-2 py-1.5">{item.ITEM_NM || item.EQT_CL_NM}</td>
                      <td className="px-2 py-1.5 font-mono text-[10px]">{item.EQT_SERNO}</td>
                      <td className="px-2 py-1.5">
                        <span className={`px-1 py-0.5 rounded text-[10px] ${item.EQT_USE_ARR_YN === 'Y' ? 'bg-green-100 text-green-700' : item.EQT_USE_ARR_YN === 'A' ? 'bg-amber-100 text-amber-700' : 'bg-gray-100 text-gray-600'}`}>
                          {item.EQT_STAT_NM || (item.EQT_USE_ARR_YN === 'Y' ? '사용가능' : item.EQT_USE_ARR_YN === 'A' ? '검사대기' : item.EQT_STAT_CD === '10' ? '재고' : item.EQT_STAT_CD === '20' ? '설치' : '-')}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* 버튼 */}
          <div className="flex gap-2">
            <button
              onClick={() => setShowReturnModal(false)}
              className="flex-1 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg font-semibold text-sm transition-all active:scale-[0.98] touch-manipulation"
              style={{ WebkitTapHighlightColor: 'transparent' }}
            >
              재선택
            </button>
            <button
              onClick={() => handleReturnRequest('RETURN')}
              className="flex-1 py-2.5 bg-blue-500 hover:bg-blue-600 text-white rounded-lg font-semibold text-sm transition-all active:scale-[0.98] touch-manipulation"
              style={{ WebkitTapHighlightColor: 'transparent' }}
            >
              반납요청
            </button>
          </div>
        </div>
      </BaseModal>

      {/* 분실처리 모달 - 장비반납 스타일 통일 */}
      <BaseModal
        isOpen={showLossModal}
        onClose={() => { setShowLossModal(false); setSelectedEquipment(null); }}
        title="분실처리-장비선택"
        size="md"
      >
        {selectedEquipment && (
          <div className="space-y-4">
            {/* 지점 (ReadOnly) */}
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">지점</label>
              <input
                type="text"
                value={selectedEquipment.SO_NM || soList.find(s => s.SO_ID === selectedEquipment.SO_ID)?.SO_NM || soList.find(s => s.SO_ID === userInfo?.soId)?.SO_NM || '-'}
                readOnly
                className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded bg-gray-100"
              />
            </div>

            {/* 분실 사유 */}
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">분실 사유</label>
              <textarea
                value={lossReason}
                onChange={(e) => setLossReason(e.target.value)}
                className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded h-20 resize-none"
                placeholder="분실 사유를 입력해주세요"
              />
            </div>

            {/* 선택된 장비 리스트 (테이블 형식) */}
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">선택된 장비</label>
              <div className="max-h-40 overflow-y-auto border border-gray-200 rounded">
                <table className="w-full text-xs">
                  <thead className="bg-gray-50 sticky top-0">
                    <tr>
                      <th className="px-2 py-1.5 text-left">장비유형</th>
                      <th className="px-2 py-1.5 text-left">S/N</th>
                      <th className="px-2 py-1.5 text-left">상태</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="border-t border-gray-100">
                      <td className="px-2 py-1.5">{selectedEquipment.ITEM_NM || selectedEquipment.EQT_CL_NM}</td>
                      <td className="px-2 py-1.5 font-mono text-[10px]">{selectedEquipment.EQT_SERNO}</td>
                      <td className="px-2 py-1.5">
                        <span className={`px-1 py-0.5 rounded text-[10px] ${selectedEquipment.EQT_USE_ARR_YN === 'Y' ? 'bg-green-100 text-green-700' : selectedEquipment.EQT_USE_ARR_YN === 'A' ? 'bg-amber-100 text-amber-700' : 'bg-gray-100 text-gray-600'}`}>
                          {selectedEquipment.EQT_STAT_NM || (selectedEquipment.EQT_USE_ARR_YN === 'Y' ? '사용가능' : selectedEquipment.EQT_USE_ARR_YN === 'A' ? '검사대기' : selectedEquipment.EQT_STAT_CD === '10' ? '재고' : selectedEquipment.EQT_STAT_CD === '20' ? '설치' : '-')}
                        </span>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            {/* 경고 메시지 */}
            <div className="bg-red-50 border border-red-200 rounded-lg p-3">
              <p className="text-xs text-red-600">
                분실 처리 시 장비 변상금이 청구될 수 있습니다.
              </p>
            </div>

            {/* 버튼 */}
            <div className="flex gap-2">
              <button
                onClick={() => { setShowLossModal(false); setSelectedEquipment(null); }}
                className="flex-1 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg font-semibold text-sm transition-all active:scale-[0.98] touch-manipulation"
                style={{ WebkitTapHighlightColor: 'transparent' }}
              >
                재선택
              </button>
              <button
                onClick={handleLossProcess}
                className="flex-1 py-2.5 bg-red-500 hover:bg-red-600 text-white rounded-lg font-semibold text-sm transition-all active:scale-[0.98] touch-manipulation"
                style={{ WebkitTapHighlightColor: 'transparent' }}
              >
                분실처리
              </button>
            </div>
          </div>
        )}
      </BaseModal>
      {/* 상태 변경 결과 모달 */}
      {showStatusChangeResult && statusChangeResult && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md max-h-[80vh] overflow-hidden">
            <div className={`p-4 ${
              statusChangeResult.failed.length === 0
                ? 'bg-gradient-to-r from-green-500 to-green-600'
                : statusChangeResult.success.length === 0
                  ? 'bg-gradient-to-r from-red-500 to-red-600'
                  : 'bg-gradient-to-r from-amber-500 to-amber-600'
            }`}>
              <h3 className="font-semibold text-white text-lg">
                {statusChangeResult.failed.length === 0 ? '상태 변경 완료' :
                 statusChangeResult.success.length === 0 ? '상태 변경 실패' : '부분 성공'}
              </h3>
              <p className="text-white/80 text-sm mt-1">
                성공: {statusChangeResult.success.length}건 / 실패: {statusChangeResult.failed.length}건
              </p>
            </div>
            <div className="p-4 max-h-96 overflow-y-auto space-y-4">
              {statusChangeResult.success.length > 0 && (
                <div>
                  <h4 className="text-sm font-semibold text-green-700 mb-2">성공 ({statusChangeResult.success.length}건)</h4>
                  <div className="space-y-1">
                    {statusChangeResult.success.map((item, idx) => (
                      <div key={idx} className="flex items-center justify-between p-2 bg-green-50 rounded-lg text-xs">
                        <span className="font-mono text-green-800">{item.EQT_SERNO}</span>
                        <span className="text-green-600">{item.ITEM_NM}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {statusChangeResult.failed.length > 0 && (
                <div>
                  <h4 className="text-sm font-semibold text-red-700 mb-2">실패 ({statusChangeResult.failed.length}건)</h4>
                  <div className="space-y-1">
                    {statusChangeResult.failed.map((item, idx) => (
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
            <div className="p-4 border-t border-gray-100 bg-gray-50">
              <button
                onClick={() => {
                  setShowStatusChangeResult(false);
                  setStatusChangeResult(null);
                }}
                className="w-full py-2.5 bg-gray-800 hover:bg-gray-900 text-white rounded-lg font-medium transition-colors"
              >
                확인
              </button>
            </div>
          </div>
        </div>
      )}


      {/* Barcode Scanner - removed, using S/N input instead */}
    </div>
  );
};

export default EquipmentInquiry;
