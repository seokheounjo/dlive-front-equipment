import React, { useState, useEffect, useRef } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import {
  getWorkerEquipmentList,
  getEquipmentReturnRequestList,
  addEquipmentReturnRequest,
  delEquipmentReturnRequest,
  processEquipmentLoss,
  setEquipmentCheckStandby,
  getCommonCodes,
  getEquipmentHistoryInfo,
  getEquipmentTypeList,  // 소분류 (모델2) 조회용
  // 새 API 함수 (받은문서 20251223 분석 기반)
  getWrkrHaveEqtListAll,      // 보유장비 전체 조회
  getEquipmentReturnRequestListAll,  // 반납요청 장비 조회 (getEquipmentReturnRequestList_All)
  getEquipmentChkStndByAAll,  // 검사대기 장비 조회
  mergeWithTransferredEquipment,  // 이관 장비 병합
  getTransferredEquipmentCount,   // 이관받은 장비 수
  getTransferredOutCount          // 이관해준 장비 수
} from '../../services/apiService';
import BaseModal from '../common/BaseModal';
import Select from '../ui/Select';
// getCustProdInfo 활용 API (테스트 완료: 기사보유장비 조회)
import { getTechnicianEquipmentFromWork } from '../../services/equipmentWorkApi';
import { debugApiCall } from './equipmentDebug';
import BarcodeScanner from './BarcodeScanner';

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

// 장비 상태 코드 매핑 (CMEP301) - EQT_STAT_NM 기준으로 통일
const EQT_STAT_CODE_MAP: Record<string, string> = {
  '10': '재고',
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

// 날짜 포맷 함수 (YYYYMMDD -> YYYY.MM.DD)
const formatDateDot = (dateStr: string): string => {
  if (!dateStr) return '-';
  if (dateStr.length === 8 && !dateStr.includes('-') && !dateStr.includes('.')) {
    return `${dateStr.slice(0, 4)}.${dateStr.slice(4, 6)}.${dateStr.slice(6, 8)}`;
  }
  if (dateStr.includes('-')) {
    return dateStr.replace(/-/g, '.');
  }
  return dateStr;
};

// 날짜 포맷 함수 (YYYYMMDD -> YYYY-MM-DD)
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
  EQT_STAT_CD_NM?: string;    // API: 장비상태명
  EQT_LOC_TP_CD?: string;
  EQT_LOC_TP_NM?: string;
  EQT_LOC_NM?: string;        // API: 현재위치명
  OLD_EQT_LOC_NM?: string;    // API: 이전위치명
  CHG_KND_NM?: string;        // API: 변경종류명
  CHG_TP_NM?: string;         // fallback: 변경유형
  BEF_EQT_LOC_NM?: string;    // fallback: 이전장비위치
  BEF_LOC_NM?: string;        // fallback: 이전위치
  EQT_CHG_TP_NM?: string;     // fallback: 장비변경유형
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
  USE_END_DT?: string;      // fallback: 사용종료일
  REQ_DT?: string;          // 반납요청일자
  RETURN_TP?: string;       // 반납유형
  EQT_USE_ARR_YN?: string;  // 장비사용도착여부
  RETN_RESN_CD?: string;
  RETN_RESN_NM?: string;
  // 카테고리 구분용 (OWNED, RETURN_REQUESTED, INSPECTION_WAITING)
  _category?: 'OWNED' | 'RETURN_REQUESTED' | 'INSPECTION_WAITING';
  // 보유장비이면서 반납요청 중인 장비 표시
  _hasReturnRequest?: boolean;
  // 반납취소 시 모든 REQ_DT 삭제용
  _allReqDts?: { REQ_DT: string; RETURN_TP: string; EQT_USE_ARR_YN: string }[];
}

// 상태 변경 결과 인터페이스
interface StatusChangeResult {
  success: { EQT_SERNO: string; EQT_NO: string; ITEM_NM: string; note?: string }[];
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
const API_BASE = typeof window !== 'undefined' ? (() => {
  const hostname = window.location.hostname;
  if (hostname === 'localhost' || hostname === '127.0.0.1') {
    return 'https://dlivestore2.store/api';
  }
  return '/api';
})() : '/api';

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
    const response = await fetch(`${API_BASE}/customer/equipment/getAuthSoList`, {
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

// 장비 중분류 목록 (ITEM_MID_CD, ITEM_MID_NM)
const DEFAULT_ITEM_MID_LIST: ItemMidItem[] = [
  { COMMON_CD: '', COMMON_CD_NM: '전체' },
  { COMMON_CD: '02', COMMON_CD_NM: '모뎀' },
  { COMMON_CD: '03', COMMON_CD_NM: 'CVT' },
  { COMMON_CD: '04', COMMON_CD_NM: 'STB' },
  { COMMON_CD: '05', COMMON_CD_NM: 'Smart card' },
  { COMMON_CD: '06', COMMON_CD_NM: '캐치온필터' },
  { COMMON_CD: '07', COMMON_CD_NM: 'Cable Card' },
  { COMMON_CD: '08', COMMON_CD_NM: 'IP폰' },
  { COMMON_CD: '10', COMMON_CD_NM: '유무선공유기(AP)' },
  { COMMON_CD: '23', COMMON_CD_NM: 'OTT_STB(체험형)' },
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
  // 초기값을 빈 문자열로 설정 - 전체 SO 조회가 기본 (이관받은 장비 포함)
  const [selectedSoId, setSelectedSoId] = useState<string>('');
  
  const [selectedItemMidCd, setSelectedItemMidCd] = useState<string>('');  // 모델1 (중분류)
  const [selectedEqtClCd, setSelectedEqtClCd] = useState<string>('');      // 모델2 (소분류)
  const [eqtClOptions, setEqtClOptions] = useState<{ code: string; name: string }[]>([]);  // 모델2 옵션
  const [isLoadingEqtCl, setIsLoadingEqtCl] = useState(false);  // 모델2 로딩 중
  const [eqtSerno, setEqtSerno] = useState<string>('');
  const [showBarcodeScanner, setShowBarcodeScanner] = useState(false);  // 바코드 스캐너

  // 검색 카테고리 - 라디오 버튼으로 단일 선택
  const [selectedCategory, setSelectedCategory] = useState<SearchCategory>('OWNED');

  // 필터 패널 열림/닫힘 상태
  const [isFilterOpen, setIsFilterOpen] = useState(false);

  // 필터 카운트 (적용된 필터 개수)
  const getFilterCount = () => {
    let count = 0;
    if (selectedSoId) count++;
    if (selectedItemMidCd) count++;
    if (selectedEqtClCd) count++;
    if (eqtSerno) count++;
    return count;
  };

  // 복수 결과 선택 모달 상태
  const [showMultipleResultModal, setShowMultipleResultModal] = useState(false);
  const [multipleResults, setMultipleResults] = useState<EquipmentItem[]>([]);

  // 데이터
  const [equipmentList, setEquipmentList] = useState<EquipmentItem[]>([]);
  const [soList, setSoList] = useState<SoListItem[]>([]);
  const [itemMidList] = useState<ItemMidItem[]>(DEFAULT_ITEM_MID_LIST);

  // 지점 목록 로드 (컴포넌트 마운트 시)
  useEffect(() => {
    const loadSoList = async () => {
      let list = await fetchAuthSoList();

      // 본사직원의 경우 soId가 있으면 지점 목록에 추가 (AUTH_SO_List가 비어있을 수 있음)
      if (userInfo?.soId && !list.find(s => s.SO_ID === userInfo.soId)) {
        const soName = userInfo.soNm || (userInfo.soId === '100' ? '본사' : `지점(${userInfo.soId})`);
        list = [{ SO_ID: userInfo.soId, SO_NM: soName }, ...list];
        console.log('[장비조회] 본사직원 soId 추가:', userInfo.soId, soName);
      }

      setSoList(list);
    };
    loadSoList();
  }, [userInfo?.soId]);

  // 모델2 (소분류) 옵션 로드 - 모델1 선택 시
  useEffect(() => {
    // 모델1 미선택 시 초기화
    if (!selectedItemMidCd) {
      setEqtClOptions([]);
      setSelectedEqtClCd('');
      return;
    }

    const loadEqtClOptions = async () => {
      setIsLoadingEqtCl(true);
      try {
        console.log('[장비처리] 소분류 API 호출:', selectedItemMidCd);
        const result = await getEquipmentTypeList({ ITEM_MID_CD: selectedItemMidCd });
        console.log('[장비처리] 소분류 API 결과:', result);

        // API returns {data: [...]} or array directly
        const dataArray = Array.isArray(result) ? result : (result?.data || []);
        if (Array.isArray(dataArray) && dataArray.length > 0) {
          const options = dataArray.map((item: any) => ({
            code: item.COMMON_CD || item.EQT_CL_CD || '',
            name: item.COMMON_CD_NM || item.EQT_CL_NM || ''
          })).filter((opt: any) => opt.code && opt.name)
            .sort((a: any, b: any) => a.name.localeCompare(b.name));

          console.log('[장비처리] 소분류 옵션:', options.length, '개');
          setEqtClOptions(options);
        } else {
          setEqtClOptions([]);
        }
      } catch (error) {
        console.error('[장비처리] 소분류 로드 실패:', error);
        setEqtClOptions([]);
      } finally {
        setIsLoadingEqtCl(false);
      }
    };

    loadEqtClOptions();
    setSelectedEqtClCd('');  // 모델1 변경 시 모델2 초기화
  }, [selectedItemMidCd]);

  // UI 상태
  const [isLoading, setIsLoading] = useState(false);
  const [showReturnModal, setShowReturnModal] = useState(false);

  // 대량 처리 진행 상태
  const [showProgressModal, setShowProgressModal] = useState(false);
  const [progressInfo, setProgressInfo] = useState({ current: 0, total: 0, item: '', action: '' });
  const [showLossModal, setShowLossModal] = useState(false);
  const [selectedEquipment, setSelectedEquipment] = useState<EquipmentItem | null>(null);
  const [returnReason, setReturnReason] = useState<string>('');
  const [returnReasonText, setReturnReasonText] = useState<string>('');  // 기타 사유 입력
  const [lossReason, setLossReason] = useState<string>('');
  const [showReasonWarning, setShowReasonWarning] = useState(false);  // 반납사유 미선택 경고

  // 카테고리 전환 시 장비 목록 초기화
  useEffect(() => {
    setEquipmentList([]);
    setSelectedEquipment(null);
  }, [selectedCategory]);

  // 뷰 모드: simple(간단히), detail(자세히)
  const [viewMode, setViewMode] = useState<'simple' | 'detail'>('simple');
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());

  // 카테고리별 필터 (체크박스로 즉시 필터링)
  const [showStock, setShowStock] = useState(true);           // 재고 (사용가능)
  const [showInspection, setShowInspection] = useState(true); // 검사대기
  const [showReturnReq, setShowReturnReq] = useState(true);   // 반납요청중

  // 당일해지 여부 확인
  const isTodayTermination = (endDt: string) => {
    if (!endDt) return false;
    const today = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    return endDt.slice(0, 8) === today;
  };

  // 필터 적용된 장비 목록 (보유장비 탭에서만 필터 적용)
  const getFilteredList = () => {
    // 반납요청/검사대기 탭에서는 필터 적용하지 않음
    if (selectedCategory !== 'OWNED') {
      return equipmentList;
    }

    return equipmentList.filter(item => {
      // 반납요청중 (반납요청 카테고리 또는 보유장비 중 반납요청중)
      const isReturnReq = item._category === 'RETURN_REQUESTED' || item._hasReturnRequest;
      // 검사대기 (검사대기 카테고리 또는 EQT_USE_ARR_YN=A)
      const isInspection = item._category === 'INSPECTION_WAITING' || item.EQT_USE_ARR_YN === 'A';
      // 재고 (사용가능) - 반납요청도 아니고 검사대기도 아닌 것
      const isStock = !isReturnReq && !isInspection;

      if (isReturnReq && !showReturnReq) return false;
      if (isInspection && !showInspection) return false;
      if (isStock && !showStock) return false;
      return true;
    });
  };

  const filteredDisplayList = getFilteredList();

  // 상태 변경 결과 (검사대기 다중처리용)
  const [statusChangeResult, setStatusChangeResult] = useState<StatusChangeResult | null>(null);
  const [showStatusChangeResult, setShowStatusChangeResult] = useState(false);
  
  // 사용가능변경 확인 모달
  const [showStatusChangeConfirm, setShowStatusChangeConfirm] = useState(false);
  const [pendingStatusChangeItems, setPendingStatusChangeItems] = useState<EquipmentItem[]>([]);

  // 반납요청 중인 장비 경고 모달
  const [showReturnWarningModal, setShowReturnWarningModal] = useState(false);
  const [returnWarningItems, setReturnWarningItems] = useState<EquipmentItem[]>([]);

  // Barcode scanner state
  // BarcodeScanner state removed

  // 초기 데이터 로드
  useEffect(() => {
    loadDropdownData();
  }, []);

  const loadDropdownData = async () => {
    // 지점 목록은 useEffect의 fetchAuthSoList()에서 이미 로드됨
    console.log('[드롭다운] 초기화 완료');
  };

  // 장비 조회
  const handleSearch = async () => {
    // DEBUG: 조회 시작 시점의 상태 출력
    console.log('===== 장비조회 시작 =====');
    console.log('[DEBUG] userInfo:', userInfo);
    console.log('[DEBUG] userInfo.soId:', userInfo?.soId);
    console.log('[DEBUG] selectedSoId (state):', selectedSoId);
    console.log('[DEBUG] localStorage userInfo:', localStorage.getItem('userInfo'));

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
        userInfo_soId: userInfo.soId,
        WRKR_ID: userInfo.userId,
        CRR_ID: userInfo.crrId,
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
            // 보유장비 조회
            const apiParams: any = {
              WRKR_ID: userInfo.userId,
              CRR_ID: userInfo.crrId || '',
              SO_ID: selectedSoId || '',
            };
            if (selectedItemMidCd) apiParams.ITEM_MID_CD = selectedItemMidCd;
            if (selectedEqtClCd) apiParams.EQT_CL_CD = selectedEqtClCd;
            if (eqtSerno) apiParams.EQT_SERNO = eqtSerno;
            console.log('[보유장비] API 호출 파라미터:', apiParams);

            const ownedResult = await debugApiCall(
              'EquipmentInquiry',
              'getWrkrHaveEqtListAll (보유장비)',
              () => getWrkrHaveEqtListAll(apiParams),
              apiParams
            );

            console.log('[DEBUG] 보유장비 API 결과:', {
              isArray: Array.isArray(ownedResult),
              length: Array.isArray(ownedResult) ? ownedResult.length : 'N/A',
              raw: ownedResult
            });
            // 반납요청 목록도 조회하여 중복 체크
            let returnRequestEqtNos = new Set<string>();
            try {
              const returnResult = await getEquipmentReturnRequestListAll({
                WRKR_ID: userInfo.userId,
                CRR_ID: userInfo.crrId || '',
                SO_ID: selectedSoId || userInfo.soId || undefined,
              });
              console.log('[보유장비] 반납요청 조회 결과:', returnResult);
              if (Array.isArray(returnResult)) {
                returnResult.forEach((item: any) => {
                  if (item.EQT_NO) {
                    returnRequestEqtNos.add(item.EQT_NO);
                    console.log('[반납요청] EQT_NO 추가:', item.EQT_NO);
                  }
                });
                console.log('[보유장비] 반납요청 중인 장비 수:', returnRequestEqtNos.size, '/ EQT_NO Set:', Array.from(returnRequestEqtNos));
              }
            } catch (returnErr) {
              console.log('[보유장비] 반납요청 목록 조회 실패 (무시):', returnErr);
            }

            if (Array.isArray(ownedResult)) {
              // ITEM_MID_CD 필터 적용 (프론트엔드에서)
              let filtered = ownedResult;
              if (selectedItemMidCd) {
                filtered = filtered.filter((item: any) => item.ITEM_MID_CD === selectedItemMidCd);
              }
              // EQT_CL_CD (모델2) 필터 적용
              if (selectedEqtClCd) {
                console.log('[버그1 디버그] 보유장비 EQT_CL_CD 필터 전:', filtered.length, '건');
                console.log('[버그1 디버그] selectedEqtClCd:', selectedEqtClCd);
                console.log('[버그1 디버그] 장비 EQT_CL_CD 목록:', filtered.map((i: any) => ({ serno: i.EQT_SERNO, eqtClCd: i.EQT_CL_CD })));
                filtered = filtered.filter((item: any) => item.EQT_CL_CD === selectedEqtClCd);
                console.log('[버그1 디버그] 보유장비 EQT_CL_CD 필터 후:', filtered.length, '건');
              }
              // 보유장비: 검사대기(A) 포함하여 모두 표시
              // Y(사용가능), N(사용불가), A(검사대기), NULL/빈값 모두 보유 탭에서 표시
              console.log('[보유장비] 전체 (검사대기 포함):', filtered.length, '건');
              // 보유장비 표시용 태그 추가 + 반납요청 중인지 표시
              allResults.push(...filtered.map((item: any) => {
                const hasReturn = returnRequestEqtNos.has(item.EQT_NO);
                if (hasReturn) {
                  console.log('[보유장비] 반납요청중 장비 발견:', item.EQT_NO, item.EQT_SERNO);
                }
                return {
                  ...item,
                  _category: 'OWNED',
                  _hasReturnRequest: hasReturn
                };
              }));
              
              // 이관받은 장비 병합 (API에서 조회되지 않는 SO_ID 다른 장비)
              const { merged, transferredCount } = mergeWithTransferredEquipment(allResults, userInfo.userId);
              if (transferredCount > 0) {
                console.log('[보유장비] 이관받은 장비 병합:', transferredCount, '건');
                allResults.length = 0; // 기존 배열 비우기
                allResults.push(...merged.map((item: any) => ({
                  ...item,
                  _category: item._category || 'OWNED',
                  _hasReturnRequest: returnRequestEqtNos.has(item.EQT_NO)
                })));
              }

              // 검사대기 전용 API도 호출하여 누락된 검사대기 장비 병합
              try {
                const inspResult = await getEquipmentChkStndByAAll({
                  WRKR_ID: userInfo.userId,
                  CRR_ID: userInfo.crrId || '',
                  SO_ID: selectedSoId || '',
                });
                if (Array.isArray(inspResult)) {
                  const existingEqtNos = new Set(allResults.map((item: any) => item.EQT_NO));
                  const newInspItems = inspResult.filter((item: any) => item.EQT_NO && !existingEqtNos.has(item.EQT_NO));
                  if (newInspItems.length > 0) {
                    console.log('[보유장비] 검사대기 API에서 추가 장비 병합:', newInspItems.length, '건');
                    allResults.push(...newInspItems.map((item: any) => ({
                      ...item,
                      _category: 'OWNED',
                      _hasReturnRequest: returnRequestEqtNos.has(item.EQT_NO),
                      EQT_USE_ARR_YN: item.EQT_USE_ARR_YN || 'A',
                    })));
                  } else {
                    console.log('[보유장비] 검사대기 API - 추가 장비 없음 (모두 보유장비에 포함됨)');
                  }
                }
              } catch (inspErr) {
                console.log('[보유장비] 검사대기 API 호출 실패 (무시):', inspErr);
              }
            }
          } catch (e) {
            console.log('보유장비 조회 실패 (getCustProdInfo):', e);
          }
        }
        // 반납요청 선택 시 - getEquipmentReturnRequestListAll 사용 (phoneNumberManager)
        if (selectedCategory === 'RETURN_REQUESTED') {
          const returnParams: any = {
            WRKR_ID: userInfo.userId,
            SO_ID: selectedSoId || '',
            CRR_ID: userInfo.crrId || '',
          };
          if (selectedItemMidCd) returnParams.ITEM_MID_CD = selectedItemMidCd;
          if (selectedEqtClCd) returnParams.EQT_CL_CD = selectedEqtClCd;
          console.log('[반납요청] API 호출 파라미터:', returnParams);
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
                filtered = filtered.filter((item: any) => item.ITEM_MID_CD === selectedItemMidCd);
              }
              // EQT_CL_CD (모델2) 필터 적용
              if (selectedEqtClCd) {
                filtered = filtered.filter((item: any) => item.EQT_CL_CD === selectedEqtClCd);
              }
              // 중복 제거 (EQT_NO 기준) + 같은 EQT_NO의 모든 REQ_DT 저장 (반납취소 시 전체 삭제용)
              const eqtNoMap = new Map<string, any[]>(); // EQT_NO -> 모든 레코드 배열
              filtered.forEach((item: any) => {
                if (item.EQT_NO) {
                  if (!eqtNoMap.has(item.EQT_NO)) {
                    eqtNoMap.set(item.EQT_NO, []);
                  }
                  eqtNoMap.get(item.EQT_NO)!.push(item);
                }
              });

              // 각 EQT_NO별 첫 번째 레코드만 표시하되, _allReqDts에 모든 REQ_DT 저장
              const deduped: any[] = [];
              eqtNoMap.forEach((records, eqtNo) => {
                const firstRecord = records[0];
                // 모든 REQ_DT를 배열로 저장 (반납취소 시 모두 삭제)
                const allReqDts = records.map(r => ({
                  REQ_DT: r.REQ_DT,
                  RETURN_TP: r.RETURN_TP || '2',
                  EQT_USE_ARR_YN: r.EQT_USE_ARR_YN || 'Y'
                }));
                deduped.push({ ...firstRecord, _allReqDts: allReqDts });
              });

              if (filtered.length !== deduped.length) {
                console.log('[반납요청] 중복 제거:', filtered.length, '->', deduped.length, '(_allReqDts 저장됨)');
              }
              // 반납요청 표시용 태그 추가
              allResults.push(...deduped.map(item => ({ ...item, _category: 'RETURN_REQUESTED' })));
            }
          } catch (e) {
            console.log('반납요청 조회 실패:', e);
          }
        }

        // 검사대기 선택 시 - getEquipmentChkStndByA_All API 사용 + STB만 표시
        if (selectedCategory === 'INSPECTION_WAITING') {
          const inspectionParams: any = {
            WRKR_ID: userInfo.userId,
            CRR_ID: userInfo.crrId || '',
            SO_ID: selectedSoId || '',
          };
          if (selectedItemMidCd) inspectionParams.ITEM_MID_CD = selectedItemMidCd;
          if (selectedEqtClCd) inspectionParams.EQT_CL_CD = selectedEqtClCd;
          if (eqtSerno) inspectionParams.EQT_SERNO = eqtSerno;
          console.log('[검사대기] API 호출 파라미터:', inspectionParams);
          try {
            const inspectionResult = await debugApiCall(
              'EquipmentInquiry',
              'getEquipmentChkStndByAAll (검사대기)',
              () => getEquipmentChkStndByAAll(inspectionParams),
              inspectionParams
            );
            if (Array.isArray(inspectionResult)) {
              console.log('[검사대기] API 결과:', inspectionResult.length, '건');
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
        ITEM_MODEL: item.ITEM_MODEL || item.MODEL_NM || '',  // 모델명
        SO_ID: item.SO_ID || selectedSoId,
        SO_NM: item.SO_NM || '',
        EQT_STAT_CD: item.EQT_STAT_CD || item.STATUS || '',
        EQT_STAT_NM: item.EQT_STAT_NM || item.EQT_STAT_CD_NM || getEqtStatName(item.EQT_STAT_CD || item.STATUS || '') || '재고',
        EQT_LOC_TP_CD: item.EQT_LOC_TP_CD || '',
        EQT_LOC_TP_NM: item.EQT_LOC_TP_NM || item.EQT_LOC_TP_CD_NM || getEqtLocTpName(item.EQT_LOC_TP_CD || ''),
        EQT_LOC_NM: item.EQT_LOC_NM || '',  // 현재위치 상세
        OLD_EQT_LOC_NM: item.OLD_EQT_LOC_NM || item.BEF_EQT_LOC_NM || item.BEF_LOC_NM || '',  // 이전위치
        CHG_KND_NM: item.CHG_KND_NM || item.CHG_TP_NM || item.EQT_CHG_TP_NM || '',  // 변경종류
        PROC_STAT: item.PROC_STAT || '',
        PROC_STAT_NM: item.PROC_STAT_NM || '',
        WRKR_ID: item.WRKR_ID || userInfo.userId,
        WRKR_NM: item.WRKR_NM || userInfo.userName,
        CUST_ID: item.CUST_ID || '',
        CTRT_ID: item.CTRT_ID || '',
        CTRT_STAT: item.CTRT_STAT || '',
        WRK_ID: item.WRK_ID || '',
        EQT_USE_END_DT: item.EQT_USE_END_DT || item.USE_END_DT || item.EXPIRE_DT || '',
        RETN_RESN_CD: item.RETN_RESN_CD || '',
        RETN_RESN_NM: item.RETN_RESN_NM || item.RETN_RESN_CD_NM || '',
        // 반납취소 DELETE SQL WHERE 조건 필수 파라미터 (CRITICAL!)
        REQ_DT: item.REQ_DT || '',               // 반납요청일자 (예: "20251229104116")
        RETURN_TP: item.RETURN_TP || '2',        // 반납유형 (항상 "2")
        // EQT_USE_ARR_YN: API 응답값 그대로 유지 (버그2 수정)
        // - 'Y': 사용가능, 'N': 사용불가, 'A': 검사대기
        // - 기본값 처리하지 않음 (실제 상태와 불일치 방지)
        EQT_USE_ARR_YN: item.EQT_USE_ARR_YN || '',
        // 카테고리 유지 (API 호출시 추가된 _category)
        _category: item._category || undefined,
        // 반납요청 중인 장비 플래그 유지
        _hasReturnRequest: item._hasReturnRequest || false,
      }));

      // 장비 종류 필터링 (S/N 검색에서도 적용)
      let filteredList = transformedList;
      if (selectedItemMidCd) {
        filteredList = filteredList.filter(item => item.ITEM_MID_CD === selectedItemMidCd);
      }
      // 모델2 (소분류) 필터링
      if (selectedEqtClCd) {
        filteredList = filteredList.filter(item => item.EQT_CL_CD === selectedEqtClCd);
      }

      // 카테고리별 정렬: 재고(사용가능) -> 검사대기 -> 반납요청중
      filteredList.sort((a, b) => {
        // 정렬 우선순위 계산
        const getOrder = (item: any) => {
          // 반납요청중 (반납요청 카테고리 또는 보유장비 중 반납요청중)
          if (item._category === 'RETURN_REQUESTED' || item._hasReturnRequest) return 3;
          // 검사대기 (검사대기 카테고리 또는 EQT_USE_ARR_YN='A')
          if (item._category === 'INSPECTION_WAITING' || item.EQT_USE_ARR_YN === 'A') return 2;
          // 재고 (사용가능)
          return 1;
        };

        const orderA = getOrder(a);
        const orderB = getOrder(b);
        if (orderA !== orderB) return orderA - orderB;

        // 같은 그룹 내에서 장비종류별 정렬
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

  // 스캔 검색 (장비번호로 직접 검색 - 복수 결과시 팝업)
  const handleScanSearch = async () => {
    if (!eqtSerno.trim()) {
      showToast?.('장비번호를 입력해주세요.', 'warning');
      return;
    }

    if (!userInfo?.userId) {
      showToast?.('로그인 정보가 없습니다. 다시 로그인해주세요.', 'error');
      return;
    }

    setIsLoading(true);
    setEquipmentList([]);

    try {
      console.log('[스캔검색] 시작:', eqtSerno);

      // 보유장비에서 검색
      const ownedResult = await getWrkrHaveEqtListAll({
        WRKR_ID: userInfo.userId,
        CRR_ID: userInfo.crrId || '',
        SO_ID: '',
      });

      let matchedItems: EquipmentItem[] = [];
      const searchSerno = eqtSerno.toUpperCase().trim();

      if (Array.isArray(ownedResult)) {
        matchedItems = ownedResult
          .filter((item: any) => {
            const itemSerno = (item.EQT_SERNO || '').toUpperCase();
            const itemMac = (item.MAC_ADDRESS || '').toUpperCase().replace(/[:-]/g, '');
            const searchNoSeparator = searchSerno.replace(/[:-]/g, '');
            return itemSerno.includes(searchSerno) || itemMac.includes(searchNoSeparator);
          })
          .map((item: any) => ({
            ...item,
            CHK: false,
            EQT_SERNO: item.EQT_SERNO || '',
            MAC_ADDRESS: item.MAC_ADDRESS || '',
            EQT_CL_NM: item.EQT_CL_NM || item.ITEM_NM || '',
            ITEM_MID_NM: item.ITEM_MID_NM || item.ITEM_MID_CD_NM || '',
            EQT_STAT_NM: item.EQT_STAT_CD_NM || getEqtStatName(item.EQT_STAT_CD || ''),
            EQT_USE_ARR_YN: item.EQT_USE_ARR_YN || 'Y',
            _category: 'OWNED' as const,
          }));
      }

      console.log('[스캔검색] 결과:', matchedItems.length, '건');

      if (matchedItems.length === 0) {
        showToast?.('일치하는 장비가 없습니다.', 'info');
      } else if (matchedItems.length === 1) {
        // 1건이면 바로 선택
        matchedItems[0].CHK = true;
        setEquipmentList(matchedItems);
        showToast?.('장비를 조회했습니다.', 'success');
      } else {
        // 복수 결과면 선택 팝업 표시
        setMultipleResults(matchedItems);
        setShowMultipleResultModal(true);
      }
    } catch (error: any) {
      console.error('[스캔검색] 실패:', error);
      showToast?.(error.message || '스캔 검색에 실패했습니다.', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  // 복수 결과 중 하나 선택
  const handleSelectFromMultiple = (item: EquipmentItem) => {
    item.CHK = true;
    setEquipmentList([item]);
    setShowMultipleResultModal(false);
    setMultipleResults([]);
    showToast?.('장비를 선택했습니다.', 'success');
  };

  // 전체 선택/해제 (반납요청중 장비는 제외)
  const handleCheckAll = (checked: boolean) => {
    setEquipmentList(equipmentList.map(item => ({
      ...item,
      // 보유장비 중 반납요청중인 장비는 선택 불가
      CHK: (item._category === 'OWNED' && item._hasReturnRequest) ? false : checked
    })));
  };

  // 개별 선택 (EQT_NO로 찾기 - 필터링 시에도 동작)
  const handleCheckItem = (eqtNo: string, checked: boolean) => {
    setEquipmentList(equipmentList.map(item =>
      item.EQT_NO === eqtNo ? { ...item, CHK: checked } : item
    ));
  };

  // MAC 주소 포맷팅 (2자리마다 : 추가)
  const formatMac = (mac: string) => {
    if (!mac) return '-';
    // 이미 포맷된 경우 그대로 반환
    if (mac.includes(':') || mac.includes('-')) return mac;
    // 2자리마다 : 추가
    return mac.match(/.{1,2}/g)?.join(':') || mac;
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
    
    // 이미 반납요청 중인 장비 확인
    const alreadyRequested = checkedItems.filter(item => item._hasReturnRequest);
    if (alreadyRequested.length > 0) {
      setReturnWarningItems(alreadyRequested);
      setShowReturnWarningModal(true);
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

    // 반납요청 시 반납사유 필수 검증
    if (action === 'RETURN') {
      if (!returnReason) {
        setShowReasonWarning(true);
        return;
      }
      // 기타 선택 시 사유 텍스트 필수
      if (returnReason === '03' && !returnReasonText.trim()) {
        setShowReasonWarning(true);
        return;
      }
    }

    try {
      // 진행 상태 표시: 반납요청은 항상, 반납취소는 3개 이상일 때
      const showProgress = action === 'RETURN' || checkedItems.length >= 3;
      if (showProgress) {
        setProgressInfo({ current: 0, total: checkedItems.length, item: '', action: action === 'CANCEL' ? '반납취소' : '반납요청' });
        setShowProgressModal(true);
      }

      const onProgress = (current: number, total: number, item: string) => {
        if (showProgress) {
          setProgressInfo({ current, total, item, action: action === 'CANCEL' ? '반납취소' : '반납요청' });
        }
      };

      if (action === 'CANCEL') {
        // 반납취소는 delEquipmentReturnRequest API 사용
        // CRITICAL: 같은 EQT_NO에 여러 REQ_DT 레코드가 있을 수 있음 → 모두 삭제 필요
        const allDeleteItems: any[] = [];
        checkedItems.forEach(item => {
          if (item._allReqDts && Array.isArray(item._allReqDts) && item._allReqDts.length > 0) {
            // _allReqDts에 저장된 모든 REQ_DT에 대해 삭제 요청 생성
            item._allReqDts.forEach((reqDtItem: any) => {
              allDeleteItems.push({
                EQT_NO: item.EQT_NO,
                EQT_SERNO: item.EQT_SERNO,
                REQ_DT: reqDtItem.REQ_DT,
                RETURN_TP: reqDtItem.RETURN_TP || '2',
                EQT_USE_ARR_YN: reqDtItem.EQT_USE_ARR_YN || 'Y',
              });
            });
          } else {
            // fallback: _allReqDts가 없으면 단일 REQ_DT 사용
            allDeleteItems.push({
              EQT_NO: item.EQT_NO,
              EQT_SERNO: item.EQT_SERNO,
              REQ_DT: item.REQ_DT,
              RETURN_TP: item.RETURN_TP || '2',
              EQT_USE_ARR_YN: item.EQT_USE_ARR_YN || '',
            });
          }
        });
        console.log('[반납취소] 총 삭제 요청 수:', allDeleteItems.length, '(장비', checkedItems.length, '개)');

        const cancelParams = {
          WRKR_ID: userInfo?.userId || '',
          CRR_ID: userInfo?.crrId || '',
          SO_ID: checkedItems[0]?.SO_ID || selectedSoId || userInfo?.soId || '',
          equipmentList: allDeleteItems,
        };
        const result = await debugApiCall(
          'EquipmentInquiry',
          'delEquipmentReturnRequest',
          () => delEquipmentReturnRequest(cancelParams, onProgress),
          cancelParams
        );
      } else {
        // 반납사유 필수 체크
        if (!returnReason) {
          showToast?.('반납사유를 선택해주세요.', 'warning');
          setShowProgressModal(false);
          return;
        }
        // 기타 선택 시 사유 입력 필수
        if (returnReason === '03' && !returnReasonText.trim()) {
          showToast?.('기타 사유를 입력해주세요.', 'warning');
          setShowProgressModal(false);
          return;
        }

        // 반납요청은 addEquipmentReturnRequest API 사용
        const params = {
          WRKR_ID: userInfo?.userId || '',
          CRR_ID: userInfo?.crrId || '',           // 협력업체 ID (필수!)
          SO_ID: checkedItems[0]?.SO_ID || selectedSoId || userInfo?.soId || '',
          MST_SO_ID: userInfo?.mstSoId || userInfo?.soId || '',
          RETURN_TP: '2',                          // 2 = 작업기사 반납
          RETN_RESN_TEXT: returnReason === '03' ? returnReasonText : undefined,  // 기타 사유 텍스트
          equipmentList: checkedItems.map(item => ({
            EQT_NO: item.EQT_NO,
            EQT_SERNO: item.EQT_SERNO,
            ACTION: action,
            RETN_RESN_CD: returnReason,
            EQT_USE_ARR_YN: item.EQT_USE_ARR_YN,  // Y/A 값 그대로 전달
          })),
        };

        const result = await debugApiCall(
          'EquipmentInquiry',
          'addEquipmentReturnRequest',
          () => addEquipmentReturnRequest(params, onProgress),
          params
        );
      }
      // 진행 상태 모달 닫기
      setShowProgressModal(false);

      showToast?.(
        action === 'RETURN'
          ? `${checkedItems.length}건의 장비 반납 요청이 완료되었습니다.`
          : `${checkedItems.length}건의 반납 요청이 취소되었습니다.`,
        'success'
      );
      setShowReturnModal(false);
      setReturnReason('');
      setReturnReasonText('');  // 기타 사유도 초기화
      await handleSearch(); // 리스트 새로고침
    } catch (error: any) {
      console.error('❌ 반납 처리 실패:', error);
      showToast?.(error.message || '반납 처리에 실패했습니다.', 'error');
      setShowProgressModal(false);
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

  // 사용가능변경 버튼 클릭 - 확인 모달 표시
  const handleStatusChangeClick = () => {
    const checkedItems = equipmentList.filter(item => item.CHK);
    if (checkedItems.length === 0) {
      showToast?.('상태 변경할 장비를 선택해주세요.', 'warning');
      return;
    }
    // 모달로 확인
    setPendingStatusChangeItems(checkedItems);
    setShowStatusChangeConfirm(true);
  };

  // 사용가능변경 처리 중 상태 (중복 클릭 방지)
  const [isStatusChanging, setIsStatusChanging] = useState(false);
  // useRef로 동기적 중복 방지 (useState는 비동기라 더블클릭 시 둘 다 실행될 수 있음)
  const statusChangeInProgressRef = useRef(false);

  // 사용가능변경 실행 (확인 후)
  const executeStatusChange = async () => {
    // 동기적 중복 클릭 방지 (useRef 사용 - 즉시 체크/설정)
    if (statusChangeInProgressRef.current) {
      console.log('[사용가능변경] 이미 처리 중입니다. (ref check)');
      return;
    }
    statusChangeInProgressRef.current = true;

    // 비동기 상태도 업데이트 (UI용)
    if (isStatusChanging) {
      console.log('[사용가능변경] 이미 처리 중입니다. (state check)');
      statusChangeInProgressRef.current = false;
      return;
    }

    setShowStatusChangeConfirm(false);
    const checkedItems = pendingStatusChangeItems;

    if (checkedItems.length === 0) return;

    // 이미 사용가능(Y)인 장비는 제외
    const itemsToProcess = checkedItems.filter(item => item.EQT_USE_ARR_YN !== 'Y');
    if (itemsToProcess.length === 0) {
      showToast?.('선택된 장비가 이미 사용가능 상태입니다.', 'info');
      setPendingStatusChangeItems([]);
      return;
    }

    setIsStatusChanging(true);

    // 진행 상태 모달 표시
    setProgressInfo({ current: 0, total: itemsToProcess.length, item: '', action: '사용가능변경' });
    setShowProgressModal(true);

    const result: StatusChangeResult = {
      success: [],
      failed: []
    };

    // 처리된 EQT_NO 추적 (중복 호출 방지)
    const processedEqtNos = new Set<string>();
    let processedCount = 0;

    try {
      for (const item of itemsToProcess) {
        // 같은 장비 중복 호출 방지
        if (processedEqtNos.has(item.EQT_NO)) {
          console.log('[사용가능변경] 중복 장비 건너뜀:', item.EQT_SERNO);
          continue;
        }
        processedEqtNos.add(item.EQT_NO);

        // 진행 상태 업데이트
        processedCount++;
        setProgressInfo({
          current: processedCount,
          total: itemsToProcess.length,
          item: item.EQT_SERNO || '',
          action: '사용가능변경'
        });

        const params = {
          EQT_NO: item.EQT_NO,
          SO_ID: item.SO_ID || userInfo?.soId || '',
          EQT_SERNO: item.EQT_SERNO || '',
          USER_ID: userInfo?.userId || '',
          CRR_ID: item.CRR_ID || userInfo?.crrId || '',
          WRKR_ID: userInfo?.userId || '',
          CUST_ID: item.CUST_ID || '',
          WRK_ID: item.WRK_ID || '',
          CTRT_ID: item.CTRT_ID || '',
          CTRT_STAT: item.CTRT_STAT || '',
          PROG_GB: 'M'  // M=Mobile, C=PC (not Y)
        };

        // ORA-00001 재시도 로직 제거 - 1번만 호출
        let retryCount = 0;
        const maxRetries = 0;
        let lastError: any = null;
        let apiSuccess = false;

        while (retryCount <= maxRetries) {
          try {
            await debugApiCall(
              'EquipmentInquiry',
              'setEquipmentCheckStandby',
              () => setEquipmentCheckStandby(params),
              params
            );
            result.success.push({
              EQT_SERNO: item.EQT_SERNO,
              EQT_NO: item.EQT_NO,
              ITEM_NM: item.ITEM_NM || item.ITEM_MID_NM || ''
            });
            apiSuccess = true;
            break; // 성공 시 루프 종료
          } catch (err: any) {
            lastError = err;
            const errorMsg = err?.message || '';

            // ORA-00001 (무결성 제약 조건 위배) 에러인 경우 재시도
            if (errorMsg.includes('ORA-00001') && retryCount < maxRetries) {
              retryCount++;
              console.log(`[사용가능변경] ORA-00001 발생, ${retryCount}/${maxRetries} 재시도 (1초 대기):`, item.EQT_SERNO);
              // 1초 대기 (Oracle 프로시저가 초 단위 EFFECT_DTTM 사용하므로 다른 초가 되도록)
              await new Promise(resolve => setTimeout(resolve, 1000));
              continue;
            }

            // ORA-00001 최종 실패 시: 장비 상태 조회하여 실제 변경 여부 확인
            if (errorMsg.includes('ORA-00001')) {
              console.log(`[사용가능변경] ORA-00001 발생, 실제 상태 확인 중:`, item.EQT_SERNO);
              try {
                const checkResult = await getEquipmentHistoryInfo({ EQT_SERNO: item.EQT_SERNO });
                console.log(`[사용가능변경] 장비 조회 결과:`, checkResult);

                // getEquipmentHistoryInfo 응답 형태 처리:
                // 1. {data: [...]} - data 배열에서 첫 번째
                // 2. {resultList: [...]} - resultList에서 첫 번째
                // 3. [...] - 배열 직접 반환 시 첫 번째 (apiService가 result.data 반환)
                // 4. {...} - 객체 직접 반환
                let equipData;
                if (checkResult?.data?.[0]) {
                  equipData = checkResult.data[0];
                } else if (checkResult?.resultList?.[0]) {
                  equipData = checkResult.resultList[0];
                } else if (Array.isArray(checkResult) && checkResult.length > 0) {
                  equipData = checkResult[0];
                } else {
                  equipData = checkResult;
                }
                console.log(`[사용가능변경] 장비 데이터:`, equipData);
                const currentStatus = equipData?.EQT_USE_ARR_YN;
                console.log(`[사용가능변경] 현재 상태 EQT_USE_ARR_YN:`, currentStatus);

                // 상태가 Y로 변경됨 = 실제로는 성공 (ORA-00001은 히스토리 로깅 중복)
                // 또는 상태가 A가 아님 = 이미 처리됨 (검사대기에서 벗어남)
                if (currentStatus === 'Y' || (currentStatus && currentStatus !== 'A')) {
                  console.log(`[사용가능변경] 장비 상태 변경 확인 (${currentStatus}), 성공 처리:`, item.EQT_SERNO);
                  result.success.push({
                    EQT_SERNO: item.EQT_SERNO,
                    EQT_NO: item.EQT_NO,
                    ITEM_NM: item.ITEM_NM || item.ITEM_MID_NM || '',
                    note: currentStatus === 'Y' ? '사용가능 변경 완료' : `상태: ${currentStatus}`
                  });
                  apiSuccess = true;
                  break;
                } else {
                  console.log(`[사용가능변경] 장비 상태가 여전히 A (검사대기), 실패 처리`);
                }
              } catch (checkErr) {
                console.error('[사용가능변경] 장비 상태 조회 실패:', checkErr);
              }
            }

            // 재시도 횟수 초과 또는 다른 에러
            console.error('장비 처리 결과:', item.EQT_SERNO, err);
            result.failed.push({
              EQT_SERNO: item.EQT_SERNO,
              EQT_NO: item.EQT_NO,
              ITEM_NM: item.ITEM_NM || item.ITEM_MID_NM || '',
              error: retryCount > 0
                ? `${errorMsg} (${retryCount}회 재시도 후 실패)`
                : (errorMsg || '당일해지 후 당일설치 조건 미충족')
            });
            break;
          }
        }

        // 다음 장비 호출 전 200ms 대기 (ORA-00001 방지)
        await new Promise(resolve => setTimeout(resolve, 200));
      }

      // 결과 모달 표시
      setStatusChangeResult(result);
      setShowStatusChangeResult(true);
      setPendingStatusChangeItems([]);

      if (result.success.length > 0) {
        await handleSearch(); // 리스트 새로고침
      }
    } catch (error: any) {
      console.error('❌ 처리 결과:', error);
      showToast?.(error.message || '상태 변경에 실패했습니다.', 'error');
    } finally {
      setShowProgressModal(false);
      setIsStatusChanging(false);
      // ref도 리셋 (중복 방지 해제)
      statusChangeInProgressRef.current = false;
    }
  };

  // 바코드 스캔 핸들러
  const handleBarcodeScan = (barcode: string) => {
    console.log('Barcode scanned:', barcode);
    setEqtSerno(barcode.toUpperCase());
    setShowBarcodeScanner(false);  // 스캐너 모달 닫기
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

  // 장비중분류별 그룹 체크 핸들러
  const handleCheckItemMid = (soKey: string, itemMidKey: string, checked: boolean) => {
    setEquipmentList(equipmentList.map(item => {
      const itemSoKey = item.SO_NM || item.SO_ID || '미지정';
      const itemMid = item.ITEM_MID_NM || '기타';
      if (itemSoKey !== soKey || itemMid !== itemMidKey) return item;
      // 보유장비 중 반납요청중인 장비는 선택 불가
      if (item._category === 'OWNED' && item._hasReturnRequest) return item;
      return { ...item, CHK: checked };
    }));
  };

  // 그룹 접기/펼치기
  const toggleGroup = (groupKey: string) => {
    setCollapsedGroups(prev => {
      const newSet = new Set(Array.from(prev));
      if (newSet.has(groupKey)) newSet.delete(groupKey);
      else newSet.add(groupKey);
      return newSet;
    });
  };

  // 지점(SO_NM) > 장비중분류(ITEM_MID_NM) 2단계 그룹화 + 그룹 내 EQT_CL_NM 정렬
  const groupedByLocation = filteredDisplayList.reduce((acc, item, idx) => {
    // 지점명 결정: SO_NM > MST_SO_NM > '본부' (100인 경우) > SO_ID
    // '100'은 본부를 의미하므로 '본부'로 표시
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

    const itemMidKey = item.ITEM_MID_NM || '기타';
    if (!acc[soKey]) acc[soKey] = {};
    if (!acc[soKey][itemMidKey]) acc[soKey][itemMidKey] = [];
    acc[soKey][itemMidKey].push({ ...item, _globalIdx: idx });
    return acc;
  }, {} as Record<string, Record<string, (EquipmentItem & { _globalIdx: number })[]>>);

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


  return (
    <div className="h-full overflow-y-auto bg-gray-50 px-4 py-4 space-y-3">
        {/* 검색 조건 + 필터 + 조회 - 한 박스 */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
          {/* 카테고리 선택 */}
          <div className="p-3 pb-0">
            <div className="grid grid-cols-3 gap-2">
              {/* 보유장비 */}
              <button
                type="button"
                onClick={() => setSelectedCategory('OWNED')}
                className={`p-2 rounded-lg border-2 transition-all text-center active:scale-[0.98] touch-manipulation ${
                  selectedCategory === 'OWNED'
                    ? 'bg-green-50 border-green-500 text-green-700 shadow-sm'
                    : 'border-gray-200 hover:bg-gray-50 text-gray-400'
                }`}
                style={{ WebkitTapHighlightColor: 'transparent' }}
              >
                <div className="flex items-center justify-center gap-1.5">
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

              {/* 반납요청 */}
              <button
                type="button"
                onClick={() => setSelectedCategory('RETURN_REQUESTED')}
                className={`p-2 rounded-lg border-2 transition-all text-center active:scale-[0.98] touch-manipulation ${
                  selectedCategory === 'RETURN_REQUESTED'
                    ? 'bg-amber-50 border-amber-500 text-amber-700 shadow-sm'
                    : 'border-gray-200 hover:bg-gray-50 text-gray-400'
                }`}
                style={{ WebkitTapHighlightColor: 'transparent' }}
              >
                <div className="flex items-center justify-center gap-1.5">
                  <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                    selectedCategory === 'RETURN_REQUESTED' ? 'bg-orange-500 border-amber-500' : 'border-gray-300'
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

              {/* 검사대기 */}
              <button
                type="button"
                onClick={() => setSelectedCategory('INSPECTION_WAITING')}
                className={`p-2 rounded-lg border-2 transition-all text-center active:scale-[0.98] touch-manipulation ${
                  selectedCategory === 'INSPECTION_WAITING'
                    ? 'bg-purple-50 border-purple-500 text-purple-700 shadow-sm'
                    : 'border-gray-200 hover:bg-gray-50 text-gray-400'
                }`}
                style={{ WebkitTapHighlightColor: 'transparent' }}
              >
                <div className="flex items-center justify-center gap-1.5">
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

          {/* 상세 필터 영역 - 접기/펼치기 */}
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
                  {getFilterCount()}
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
                <label className="text-xs font-medium text-gray-600 w-14 flex-shrink-0">지점</label>
                <Select
                  value={selectedSoId}
                  onValueChange={(val) => setSelectedSoId(val)}
                  options={[
                    { value: '', label: '전체' },
                    ...soList.map((item) => ({ value: item.SO_ID, label: item.SO_NM }))
                  ]}
                  placeholder="전체"
                  className="flex-1"
                />
              </div>
              {/* 장비종류 (중분류 + 소분류 한 줄) */}
              <div className="flex items-center gap-2 overflow-hidden">
                <label className="text-xs font-medium text-gray-600 w-14 flex-shrink-0">장비종류</label>
                <Select
                  value={selectedItemMidCd}
                  onValueChange={(val) => setSelectedItemMidCd(val)}
                  options={itemMidList.map((item) => ({ value: item.COMMON_CD, label: item.COMMON_CD_NM }))}
                  placeholder="중분류"
                  className="flex-1 min-w-0"
                />
                <Select
                  value={selectedEqtClCd}
                  onValueChange={(val) => setSelectedEqtClCd(val)}
                  options={[
                    { value: '', label: !selectedItemMidCd ? '-' : isLoadingEqtCl ? '...' : (eqtClOptions.length === 0 ? '-' : '전체') },
                    ...eqtClOptions.map(opt => ({ value: opt.code, label: opt.name }))
                  ]}
                  placeholder={!selectedItemMidCd ? '-' : isLoadingEqtCl ? '...' : (eqtClOptions.length === 0 ? '-' : '전체')}
                  disabled={!selectedItemMidCd || isLoadingEqtCl || eqtClOptions.length === 0}
                  className="flex-1 min-w-0"
                />
              </div>
              {/* S/N + 스캔 버튼 */}
              <div className="flex items-center gap-2 overflow-hidden">
                <label className="text-xs font-medium text-gray-600 w-14 flex-shrink-0">S/N</label>
                <input
                  type="text"
                  value={eqtSerno}
                  onChange={(e) => setEqtSerno(e.target.value.toUpperCase())}
                  className="flex-1 min-w-0 px-3 py-2.5 text-sm border border-gray-200 rounded-lg uppercase focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all font-mono"
                  placeholder="S/N 또는 MAC 주소 입력"
                />
                <button
                  onClick={() => setShowBarcodeScanner(true)}
                  className="px-4 py-2.5 bg-green-500 hover:bg-green-600 text-white rounded-lg font-semibold text-sm transition-all active:scale-[0.98] touch-manipulation flex items-center gap-1.5 flex-shrink-0"
                  style={{ WebkitTapHighlightColor: 'transparent' }}
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" />
                  </svg>
                  스캔
                </button>
              </div>
            </div>
          )}
          {/* 조회 버튼 */}
          <div className="px-4 pb-4 pt-2">
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

        {/* 장비 리스트 */}
        {equipmentList.length > 0 && (
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
            {/* 헤더: 전체 선택 + 카테고리별 선택 + 뷰 모드 선택 */}
            <div className="px-4 py-3 bg-gradient-to-r from-gray-50 to-white border-b border-gray-100">
              <div className="flex items-center justify-between">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    onChange={(e) => handleCheckAll(e.target.checked)}
                    checked={
                      filteredDisplayList.length > 0 &&
                      filteredDisplayList
                        .filter(item => !(item._category === 'OWNED' && item._hasReturnRequest))
                        .length > 0 &&
                      filteredDisplayList
                        .filter(item => !(item._category === 'OWNED' && item._hasReturnRequest))
                        .every(item => item.CHK)
                    }
                    className="w-4 h-4 text-blue-500 rounded focus:ring-blue-500"
                  />
                  <span className="text-sm font-semibold text-gray-800">전체선택</span>
                </label>
                <span className="text-xs text-gray-500">
                  {filteredDisplayList.length}건 (선택: {filteredDisplayList.filter(i => i.CHK).length}건)
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

            {/* 그룹핑된 장비 목록: 지점(SO_NM) > 장비중분류(ITEM_MID_NM) */}
            <div className="divide-y divide-gray-100">
              {soKeys.map(soKey => {
                const itemMidGroups = groupedByLocation[soKey];
                const itemMidKeys = Object.keys(itemMidGroups).sort();
                const soTotalCount = itemMidKeys.reduce((sum, k) => sum + itemMidGroups[k].length, 0);
                const isSoCollapsed = collapsedGroups.has(`so_${soKey}`);

                return (
                  <div key={soKey} className="border-b border-gray-100 last:border-0">
                    {/* 지점 헤더 */}
                    <div
                      className="px-4 py-2 bg-blue-50 flex items-center justify-between cursor-pointer hover:bg-blue-100"
                      onClick={() => toggleGroup(`so_${soKey}`)}
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-bold text-blue-800">{soKey}</span>
                        <span className="text-xs text-blue-600 bg-blue-100 px-2 py-0.5 rounded-full">{soTotalCount}건</span>
                      </div>
                      {isSoCollapsed ? <ChevronDown className="w-4 h-4 text-blue-600" /> : <ChevronUp className="w-4 h-4 text-blue-600" />}
                    </div>

                    {/* 장비중분류 그룹 */}
                    {!isSoCollapsed && itemMidKeys.map(itemMidKey => {
                      const items = itemMidGroups[itemMidKey];
                      const isItemMidCollapsed = collapsedGroups.has(`so_${soKey}_mid_${itemMidKey}`);
                      const selectableItems = items.filter(i => !(i._category === 'OWNED' && i._hasReturnRequest));
                      const checkedCount = selectableItems.filter(i => i.CHK).length;
                      const allChecked = selectableItems.length > 0 && checkedCount === selectableItems.length;

                      return (
                        <div key={itemMidKey}>
                          {/* 장비중분류 헤더 */}
                          <div
                            className="px-6 py-1.5 bg-gray-50 flex items-center justify-between cursor-pointer hover:bg-gray-100"
                            onClick={() => toggleGroup(`so_${soKey}_mid_${itemMidKey}`)}
                          >
                            <div className="flex items-center gap-2">
                              <input
                                type="checkbox"
                                checked={allChecked}
                                onClick={(e) => e.stopPropagation()}
                                onChange={(e) => handleCheckItemMid(soKey, itemMidKey, e.target.checked)}
                                className="rounded w-4 h-4"
                                disabled={selectableItems.length === 0}
                              />
                              <span className="text-xs font-semibold text-gray-700">{itemMidKey}</span>
                              <span className="text-[10px] text-gray-500 bg-gray-200 px-1.5 py-0.5 rounded">
                                {items.length}건 {checkedCount > 0 && `(${checkedCount}선택)`}
                              </span>
                            </div>
                            {isItemMidCollapsed ? <ChevronDown className="w-3 h-3 text-gray-500" /> : <ChevronUp className="w-3 h-3 text-gray-500" />}
                          </div>

                          {/* 장비 목록 */}
                          {!isItemMidCollapsed && (
                            <div className="space-y-2">
                              {items.map((item, idx) => (
                  <div
                    key={item.EQT_NO || idx}
                    onClick={() => { if (!(item._category === 'OWNED' && item._hasReturnRequest)) handleCheckItem(item.EQT_NO, !item.CHK); }}
                    className={`p-3 rounded-lg border-2 cursor-pointer transition-all ${
                      item.CHK
                        ? 'bg-blue-50 border-blue-400'
                        : item._category === 'OWNED' ? 'bg-green-50/50 border-green-200 hover:border-green-300'
                        : item._category === 'RETURN_REQUESTED' ? 'bg-amber-50/50 border-amber-200 hover:border-amber-300'
                        : item._category === 'INSPECTION_WAITING' ? 'bg-purple-50/50 border-purple-200 hover:border-purple-300'
                        : 'bg-gray-50 border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <input
                        type="checkbox"
                        checked={item.CHK || false}
                        disabled={item._category === 'OWNED' && item._hasReturnRequest}
                        onChange={(e) => { e.stopPropagation(); handleCheckItem(item.EQT_NO, e.target.checked); }}
                        className={`w-5 h-5 rounded focus:ring-blue-500 mt-0.5 ${
                          item._category === 'OWNED' && item._hasReturnRequest
                            ? 'text-gray-300 cursor-not-allowed'
                            : 'text-blue-500'
                        }`}
                      />
                      <div className="flex-1 min-w-0">
                        {/* Line 1: 모델명 + [반납요청/보유] 뱃지 */}
                        <div className="flex items-center justify-between">
                          <span className="text-sm sm:text-base font-bold text-gray-900 truncate">{item.EQT_CL_NM || item.ITEM_NM || '-'}</span>
                          <div className="flex-shrink-0 ml-2">
                            {(item._hasReturnRequest || item._category === 'RETURN_REQUESTED') ? (
                              <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-orange-100 text-orange-700">반납요청</span>
                            ) : (
                              <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700">보유</span>
                            )}
                          </div>
                        </div>
                        {/* Line 2: S/N + [EQT_USE_ARR_YN] 뱃지 */}
                        <div className="flex items-center justify-between mt-1">
                          <span className="text-sm text-gray-600"><span className="text-gray-500">S/N : </span>{item.EQT_SERNO || '-'}</span>
                          <div className="flex-shrink-0 ml-2">
                            {item.EQT_USE_ARR_YN === 'Y' && (
                              <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700">사용가능</span>
                            )}
                            {item.EQT_USE_ARR_YN === 'A' && (
                              <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-700">검사대기</span>
                            )}
                            {item.EQT_USE_ARR_YN === 'N' && (
                              <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700">사용불가</span>
                            )}
                            {!item.EQT_USE_ARR_YN && (
                              <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-700">N/A</span>
                            )}
                          </div>
                        </div>
                        {/* Line 3: MAC + 날짜 (YYYY-MM-DD) */}
                        <div className="flex items-center justify-between mt-0.5">
                          <span className="text-sm text-gray-600"><span className="text-gray-500">MAC : </span>{formatMac(item.MAC_ADDRESS)}</span>
                          <span className="text-sm text-gray-600">{formatDateDash(item.EQT_USE_END_DT || item.USE_END_DT || '')}</span>
                        </div>
                      </div>
                    </div>
                    {/* 자세히 보기: 추가 정보 */}
                    {viewMode === 'detail' && (
                      <div className="bg-gray-100 rounded-lg p-2 mt-2 text-xs space-y-1 ml-6">
                        <div className="flex items-center justify-between"><span><span className="text-gray-500">모델 : </span><span className="text-gray-800">{item.ITEM_MODEL || item.MODEL_NM || '-'}</span></span><span className="font-medium text-gray-800">{item.SO_NM || '-'}</span></div>
                        <div className="flex items-center justify-between"><span><span className="text-gray-500">장비상태  : </span><span className="text-gray-800">{item.EQT_STAT_NM || item.EQT_STAT_CD_NM || getEqtStatName(item.EQT_STAT_CD || '') || '-'}</span></span><span className="text-gray-400 text-xs">{item.EQT_NO || '-'}</span></div>
                        <div><span className="text-gray-500">변경종류  : </span><span className="text-gray-800">{item.CHG_KND_NM || '-'}</span></div>
                        <div><span className="text-gray-500">현재위치  : </span><span className="text-gray-800">{item.EQT_LOC_NM || item.EQT_LOC_TP_NM || getEqtLocTpName(item.EQT_LOC_TP_CD || '') || '-'}</span></div>
                        <div><span className="text-gray-500">이전위치  : </span><span className="text-gray-800">{item.OLD_EQT_LOC_NM || '-'}</span></div>
                      </div>
                    )}
                  </div>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                );
              })}
            </div>

            {/* 자세히 보기 - 그룹핑 내부로 통합됨 (아래 블록 비활성화) */}
            {false && (
              <div className="p-3 space-y-2">
                {filteredDisplayList.map((item, idx) => (
                  <div
                    key={item.EQT_NO || idx}
                    onClick={() => { if (!(item._category === 'OWNED' && item._hasReturnRequest)) handleCheckItem(item.EQT_NO, !item.CHK); }}
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
                        disabled={item._category === 'OWNED' && item._hasReturnRequest}
                        onChange={(e) => { e.stopPropagation(); handleCheckItem(item.EQT_NO, e.target.checked); }}
                        className={`w-5 h-5 rounded focus:ring-blue-500 mt-0.5 ${
                          item._category === 'OWNED' && item._hasReturnRequest 
                            ? 'text-gray-300 cursor-not-allowed' 
                            : 'text-blue-500'
                        }`}
                      />
                      <div className="flex-1 min-w-0">
                        {/* 간단히와 동일: [품목] S/N | MAC [상태] */}
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center gap-2 min-w-0 flex-1 mr-2">
                            <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium flex-shrink-0 ${getItemColor(item.ITEM_MID_CD)}`}>
                              {item.ITEM_MID_NM || '장비'}
                            </span>
                            {isTodayTermination(item.EQT_USE_END_DT) && (
                              <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-red-500 text-white flex-shrink-0">
                                당일해지
                              </span>
                            )}
                            <span className="text-sm font-medium text-gray-900 truncate">
                              {item.EQT_CL_NM || '-'}
                            </span>
                          </div>
                          <span className={`px-2 py-1 rounded-full text-xs font-semibold flex-shrink-0 ${
                            (item._hasReturnRequest || item._category === 'RETURN_REQUESTED') ? 'bg-orange-100 text-orange-700' :
                            item.EQT_USE_ARR_YN === 'Y' ? 'bg-green-100 text-green-700' :
                            item.EQT_USE_ARR_YN === 'A' ? 'bg-purple-100 text-purple-700' :
                            item.EQT_USE_ARR_YN === 'N' ? 'bg-red-100 text-red-700' :
                            'bg-gray-100 text-gray-700'
                          }`}>
                            {(item._hasReturnRequest || item._category === 'RETURN_REQUESTED') ? '반납요청' :
                             item.EQT_USE_ARR_YN === 'Y' ? '사용가능' :
                             item.EQT_USE_ARR_YN === 'A' ? '검사대기' :
                             item.EQT_USE_ARR_YN === 'N' ? '사용불가' : 'N/A'}
                          </span>
                        </div>
                        {/* S/N | MAC - 한 줄 */}
                        <div className="font-mono text-xs text-gray-700 mt-1">
                          {item.EQT_SERNO || '-'} | {formatMac(item.MAC_ADDRESS)}
                        </div>

                        {/* 추가 정보 (회색 박스) */}
                        <div className="bg-gray-50 rounded-lg p-3">
                          <div className="space-y-1.5 text-xs">
                            {/* 모델명 (값만) */}
                            <div className="text-gray-700 font-medium">{item.EQT_CL_NM || '-'}</div>

                            {/* 사용가능 날짜 (값만) */}
                            <div className="text-gray-600">{item.USE_END_DT || item.EXPIRE_DT || item.EQT_USE_END_DT || '-'}</div>

                            {/* 변경종류 (값만) */}
                            <div className="text-gray-600">{item.CHG_KND_NM || item.CHG_TP_NM || item.PROC_STAT_NM || item.EQT_CHG_TP_NM || '-'}</div>

                            {/* 현재위치 (라벨+값) */}
                            <div className="flex items-center gap-2">
                              <span className="text-gray-400">현재위치</span>
                              <span className="text-gray-700">{item.EQT_LOC_NM || item.EQT_LOC_TP_NM || getEqtLocTpName(item.EQT_LOC_TP_CD || '') || '-'}</span>
                            </div>

                            {/* 이전위치 (라벨+값) */}
                            <div className="flex items-center gap-2">
                              <span className="text-gray-400">이전위치</span>
                              <span className="text-gray-700">{item.OLD_EQT_LOC_NM || item.BEF_EQT_LOC_NM || item.BEF_LOC_NM || '-'}</span>
                            </div>

                            {/* 장비상태 (값만) */}
                            <div className="text-gray-600">{item.EQT_STAT_NM || item.EQT_STAT_CD_NM || item.EQT_STAT_CD || '-'}</div>

                            {/* 지점 (값만) */}
                            <div className="text-gray-600">{item.SO_NM || item.SO_ID || '-'}</div>
                          </div>
                          {item.RETN_RESN_NM && (
                            <div className="mt-2 pt-1.5 border-t border-gray-200">
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

        {/* 하단 버튼 영역 확보용 여백 */}
        <div className="h-20"></div>

      {/* 하단 고정 버튼 영역 - 네비게이션 바 바로 위 */}
      <div className="fixed bottom-[56px] left-0 right-0 p-3 z-40" style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}>
        <div className="flex gap-2">
          {/* 보유장비가 선택되었을 때만: 장비반납 */}
          {totalOwned > 0 && (
            <button
              onClick={handleReturnClick}
              disabled={selectedOwned === 0}
              className={`flex-1 py-3 px-4 rounded-lg font-semibold text-sm shadow-sm transition-all active:scale-[0.98] touch-manipulation ${
                selectedOwned > 0
                  ? 'bg-blue-500 hover:bg-blue-600 text-white'
                  : 'bg-gray-300 text-white cursor-not-allowed'
              }`}
              style={{ WebkitTapHighlightColor: 'transparent' }}
            >
              장비반납 {selectedOwned > 0 && `(${selectedOwned})`}
            </button>
          )}

          {/* 반납요청 장비가 선택되었을 때만: 반납취소 */}
          {totalReturn > 0 && (
            <button
              onClick={() => handleReturnRequest('CANCEL')}
              disabled={selectedReturn === 0}
              className={`flex-1 py-3 px-4 rounded-lg font-semibold text-sm shadow-sm transition-all active:scale-[0.98] touch-manipulation ${
                selectedReturn > 0
                  ? 'bg-orange-500 hover:bg-orange-600 text-white'
                  : 'bg-gray-300 text-white cursor-not-allowed'
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
              disabled={selectedInspection === 0 || isStatusChanging}
              className={`flex-1 py-3 px-4 rounded-lg font-semibold text-sm shadow-sm transition-all active:scale-[0.98] touch-manipulation ${
                selectedInspection > 0 && !isStatusChanging
                  ? 'bg-green-500 hover:bg-green-600 text-white'
                  : 'bg-gray-300 text-white cursor-not-allowed'
              }`}
              style={{ WebkitTapHighlightColor: 'transparent' }}
            >
              {isStatusChanging ? '처리중...' : `사용가능변경 ${selectedInspection > 0 ? `(${selectedInspection})` : ''}`}
            </button>
          )}
        </div>
      </div>

      {/* 복수 결과 선택 모달 */}
      <BaseModal
        isOpen={showMultipleResultModal}
        onClose={() => {
          setShowMultipleResultModal(false);
          setMultipleResults([]);
        }}
        title="장비 선택"
        size="md"
      >
        <div className="space-y-4">
          <p className="text-sm text-gray-600">
            {multipleResults.length}건의 장비가 검색되었습니다. 선택할 장비를 클릭하세요.
          </p>
          <div className="max-h-80 overflow-y-auto border border-gray-200 rounded-lg divide-y divide-gray-100">
            {multipleResults.map((item, idx) => (
              <button
                key={idx}
                onClick={() => handleSelectFromMultiple(item)}
                className="w-full p-3 text-left hover:bg-blue-50 transition-colors active:bg-blue-100"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-semibold text-gray-900">{item.EQT_CL_NM || item.ITEM_NM || '장비'}</div>
                    <div className="text-sm text-gray-600 font-mono">{item.EQT_SERNO}</div>
                    <div className="text-xs text-gray-500">{item.SO_NM} | {formatMac(item.MAC_ADDRESS)}</div>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                      item.EQT_USE_ARR_YN === 'Y' ? 'bg-green-100 text-green-700' :
                      item.EQT_USE_ARR_YN === 'A' ? 'bg-purple-100 text-purple-700' :
                      'bg-gray-100 text-gray-700'
                    }`}>
                      {item.EQT_USE_ARR_YN === 'Y' ? '사용가능' :
                       item.EQT_USE_ARR_YN === 'A' ? '검사대기' : 'N/A'}
                    </span>
                    <span className="text-xs text-gray-400">{item.ITEM_MID_NM}</span>
                  </div>
                </div>
              </button>
            ))}
          </div>
          <button
            onClick={() => {
              setShowMultipleResultModal(false);
              setMultipleResults([]);
            }}
            className="w-full py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg font-semibold text-sm transition-all"
          >
            취소
          </button>
        </div>
      </BaseModal>

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

          {/* 반납 사유 선택 (필수) */}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">
              반납 사유 <span className="text-red-500">*</span>
            </label>
            <Select
              value={returnReason}
              onValueChange={(val) => {
                setReturnReason(val);
                if (val !== '03') setReturnReasonText('');  // 기타 아니면 입력 초기화
              }}
              options={[
                { value: '', label: '선택해주세요' },
                { value: '01', label: '장비 사용일 만료' },
                { value: '02', label: '장비 불량 (고객 설치 불가)' },
                { value: '03', label: '기타' },
              ]}
              placeholder="선택해주세요"
              required={true}
            />
          </div>

          {/* 기타 사유 입력 (기타 선택 시에만 표시) */}
          {returnReason === '03' && (
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">
                기타 사유 <span className="text-red-500">*</span>
                <span className="text-gray-400 ml-1">({returnReasonText.length}/100 bytes)</span>
              </label>
              <textarea
                value={returnReasonText}
                onChange={(e) => {
                  // 100바이트 제한 (한글 3바이트, 영문/숫자 1바이트)
                  const text = e.target.value;
                  const byteLength = new Blob([text]).size;
                  if (byteLength <= 100) {
                    setReturnReasonText(text);
                  }
                }}
                className={`w-full px-2 py-1.5 text-sm border rounded h-20 resize-none ${!returnReasonText.trim() ? 'border-red-300' : 'border-gray-300'}`}
                placeholder="기타 사유를 입력해주세요 (최대 100바이트)"
              />
            </div>
          )}

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
                        <span className={`px-1 py-0.5 rounded text-[10px] ${item.EQT_USE_ARR_YN === 'Y' ? 'bg-green-100 text-green-700' : item.EQT_USE_ARR_YN === 'A' ? 'bg-amber-100 text-amber-700' : item.EQT_USE_ARR_YN === 'N' ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-600'}`}>
                          {item.EQT_STAT_NM || (item.EQT_USE_ARR_YN === 'Y' ? '사용가능' : item.EQT_USE_ARR_YN === 'A' ? '검사대기' : item.EQT_USE_ARR_YN === 'N' ? '사용불가' : 'N/A')}
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
              onClick={() => {
                setShowReturnModal(false);
                setReturnReason('');
                setReturnReasonText('');
              }}
              className="flex-1 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg font-semibold text-sm transition-all active:scale-[0.98] touch-manipulation"
              style={{ WebkitTapHighlightColor: 'transparent' }}
            >
              닫기
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

      {/* 반납사유 미선택 경고 팝업 */}
      {showReasonWarning && (
        <div
          className="fixed inset-0 bg-black/30 flex items-center justify-center z-[250]"
          onClick={() => setShowReasonWarning(false)}
        >
          <div
            className="bg-white rounded-xl p-5 mx-4 shadow-2xl max-w-sm animate-pulse"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center flex-shrink-0">
                <svg className="w-6 h-6 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <div>
                <h3 className="font-bold text-gray-800">반납사유를 선택해주세요</h3>
                <p className="text-sm text-gray-500 mt-0.5">
                  {returnReason === '03' ? '기타 사유를 입력해주세요.' : '반납 사유는 필수 항목입니다.'}
                </p>
              </div>
            </div>
            <button
              onClick={() => setShowReasonWarning(false)}
              className="w-full py-2.5 bg-red-500 hover:bg-red-600 text-white rounded-lg font-semibold text-sm transition-all"
            >
              확인
            </button>
          </div>
        </div>
      )}

      {/* 대량 처리 진행 상태 모달 - BaseModal(z-100)보다 위에 표시 */}
      {showProgressModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[200]">
          <div className="bg-white rounded-xl p-6 w-80 shadow-2xl">
            <div className="text-center">
              <div className="text-lg font-semibold text-gray-800 mb-4">
                {progressInfo.action} 진행 중...
              </div>
              <div className="mb-3">
                <div className="h-3 bg-gray-200 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-blue-500 transition-all duration-300"
                    style={{ width: progressInfo.total > 0 ? `${(progressInfo.current / progressInfo.total) * 100}%` : '0%' }}
                  />
                </div>
              </div>
              <div className="text-sm text-gray-600 mb-2">
                {progressInfo.current} / {progressInfo.total}
              </div>
              <div className="text-xs text-gray-400 truncate">
                {progressInfo.item && `처리 중: ${progressInfo.item}`}
              </div>
            </div>
          </div>
        </div>
      )}

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
                        <span className={`px-1 py-0.5 rounded text-[10px] ${selectedEquipment.EQT_USE_ARR_YN === 'Y' ? 'bg-green-100 text-green-700' : selectedEquipment.EQT_USE_ARR_YN === 'A' ? 'bg-amber-100 text-amber-700' : selectedEquipment.EQT_USE_ARR_YN === 'N' ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-600'}`}>
                          {selectedEquipment.EQT_STAT_NM || (selectedEquipment.EQT_USE_ARR_YN === 'Y' ? '사용가능' : selectedEquipment.EQT_USE_ARR_YN === 'A' ? '검사대기' : selectedEquipment.EQT_USE_ARR_YN === 'N' ? '사용불가' : 'N/A')}
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

      {/* 사용가능변경 확인 모달 */}
      {showStatusChangeConfirm && pendingStatusChangeItems.length > 0 && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden">
            <div className="p-4 bg-gradient-to-r from-blue-500 to-blue-600">
              <h3 className="font-semibold text-white text-lg">사용가능 변경</h3>
              <p className="text-white/80 text-sm mt-1">
                선택된 장비: {pendingStatusChangeItems.length}건
              </p>
            </div>
            <div className="p-4 space-y-4">
              {/* 안내 메시지 */}
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                <p className="text-sm text-amber-800 font-medium mb-1">변경 조건 안내</p>
                <p className="text-xs text-amber-600">
                  동일 고객의 당일해지 후 당일설치 작업이 발생하는 경우에만 변경 가능합니다.
                </p>
              </div>
              
              {/* 선택된 장비 목록 */}
              <div>
                <h4 className="text-sm font-semibold text-gray-700 mb-2">변경 대상 장비</h4>
                <div className="max-h-40 overflow-y-auto space-y-1">
                  {pendingStatusChangeItems.map((item, idx) => (
                    <div key={idx} className="flex items-center justify-between p-2 bg-gray-50 rounded-lg text-xs">
                      <span className="font-mono text-gray-800">{item.EQT_SERNO}</span>
                      <span className="text-gray-600">{item.ITEM_NM || item.ITEM_MID_NM}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <div className="p-4 border-t border-gray-100 bg-gray-50 flex gap-2">
              <button
                onClick={() => {
                  setShowStatusChangeConfirm(false);
                  setPendingStatusChangeItems([]);
                }}
                className="flex-1 py-2.5 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-lg font-medium transition-colors"
              >
                취소
              </button>
              <button
                onClick={executeStatusChange}
                disabled={isStatusChanging}
                className={`flex-1 py-2.5 rounded-lg font-medium transition-colors ${
                  isStatusChanging
                    ? 'bg-gray-400 text-white cursor-not-allowed'
                    : 'bg-blue-500 hover:bg-blue-600 text-white'
                }`}
              >
                {isStatusChanging ? '처리중...' : '변경하기'}
              </button>
            </div>
          </div>
        </div>
      )}

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
                {statusChangeResult.failed.length === 0 ? '사용가능 변경 완료' :
                 statusChangeResult.success.length === 0 ? '처리 결과' : '처리 결과 (일부 성공)'}
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
                      <div key={idx} className="p-2 bg-green-50 rounded-lg text-xs">
                        <div className="flex items-center justify-between">
                          <span className="font-mono text-green-800">{item.EQT_SERNO}</span>
                          <span className="text-green-600">{item.ITEM_NM}</span>
                        </div>
                        {item.note && (
                          <div className="text-amber-600 mt-1 text-[10px]">⚠️ {item.note}</div>
                        )}
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


      {/* 반납요청 중복 경고 모달 */}
      {showReturnWarningModal && returnWarningItems.length > 0 && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md max-h-[80vh] overflow-hidden">
            <div className="p-4 bg-gradient-to-r from-amber-500 to-amber-600">
              <h3 className="font-semibold text-white text-lg flex items-center gap-2">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                반납요청 진행중인 장비
              </h3>
              <p className="text-white/80 text-sm mt-1">
                {returnWarningItems.length}개의 선택된 장비가 이미 반납요청 중입니다
              </p>
            </div>
            <div className="p-4 max-h-60 overflow-y-auto">
              <p className="text-gray-600 text-sm mb-3">
                다음 장비들은 이미 반납요청이 진행 중입니다. 반납요청 카테고리에서 상태를 확인해주세요.
              </p>
              <div className="space-y-2">
                {returnWarningItems.map((item, idx) => (
                  <div key={idx} className="flex items-center justify-between p-2 bg-amber-50 rounded-lg text-xs">
                    <span className="font-mono text-amber-800">{item.EQT_SERNO}</span>
                    <span className="text-amber-600">{item.ITEM_NM || item.ITEM_MID_NM || '장비'}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="p-4 border-t border-gray-100 bg-gray-50">
              <button
                onClick={() => {
                  setShowReturnWarningModal(false);
                  setReturnWarningItems([]);
                }}
                className="w-full py-2.5 bg-orange-500 hover:bg-amber-600 text-white rounded-lg font-medium transition-colors"
              >
                확인
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Barcode Scanner */}
      <BarcodeScanner
        isOpen={showBarcodeScanner}
        onClose={() => setShowBarcodeScanner(false)}
        onScan={handleBarcodeScan}
      />
    </div>
  );
};

export default EquipmentInquiry;
