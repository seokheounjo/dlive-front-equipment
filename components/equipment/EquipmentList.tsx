import React, { useState, useEffect } from 'react';
import { getWrkrHaveEqtListAll as getWrkrHaveEqtList, getEquipmentHistoryInfo } from '../../services/apiService';
import { debugApiCall } from './equipmentDebug';
import BarcodeScanner from './BarcodeScanner';

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

// 장비 데이터에 코드명 추가
const enrichEquipmentData = <T extends Record<string, any>>(data: T): T => {
  const result = { ...data };
  // 장비 상태 코드명 추가
  if (result.EQT_STAT_CD && !result.EQT_STAT_CD_NM) {
    result.EQT_STAT_CD_NM = getEqtStatName(result.EQT_STAT_CD);
  }
  // 장비 위치 코드명 추가
  if (result.EQT_LOC_TP_CD && !result.EQT_LOC_TP_CD_NM) {
    result.EQT_LOC_TP_CD_NM = getEqtLocTpName(result.EQT_LOC_TP_CD);
  }
  // 이전 위치 코드명 추가
  if (result.OLD_EQT_LOC_TP_CD && !result.OLD_EQT_LOC_TP_CD_NM) {
    result.OLD_EQT_LOC_TP_CD_NM = getEqtLocTpName(result.OLD_EQT_LOC_TP_CD);
  }
  return result;
};

interface EquipmentListProps {
  onBack: () => void;
  showToast?: (message: string, type: 'success' | 'error' | 'warning' | 'info') => void;
}

// 장비 상세 정보 인터페이스 (75+ fields from legacy)
interface EquipmentDetail {
  // 기본 정보
  EQT_NO: string;
  EQT_SERNO: string;
  MAC_ADDRESS: string;
  BAR_CD: string;
  IRD_SN: string;

  // 장비 유형
  EQT_CL_CD: string;
  EQT_CL_NM: string;
  EQT_TP_CD: string;
  EQT_TP_CD_NM: string;
  ITEM_CD: string;
  ITEM_NM: string;

  // 제조 정보
  MAKER: string;
  MNFCT_DT: string;

  // 상태 정보
  EQT_STAT_CD: string;
  EQT_STAT_CD_NM: string;
  EQT_USE_STAT_CD: string;
  EQT_USE_STAT_CD_NM: string;
  EQT_USE_ARR_YN: string;
  EQT_USE_ARR_YN_NM: string;
  EQT_USE_END_DT: string;

  // 위치 정보
  EQT_LOC_TP_CD: string;
  EQT_LOC_TP_CD_NM: string;
  EQT_LOC_NM: string;
  OLD_EQT_LOC_TP_CD: string;
  OLD_EQT_LOC_TP_CD_NM: string;
  OLD_EQT_LOC_NM: string;

  // 지점/협력사 정보
  SO_ID: string;
  SO_NM: string;
  MST_SO_ID: string;
  MST_SO_NM: string;
  OLD_SO_ID: string;
  OLD_SO_NM: string;
  OLD_MST_SO_ID: string;
  OLD_MST_SO_NM: string;
  CRR_ID: string;
  CRR_NM: string;
  OLD_CRR_ID: string;
  OLD_CRR_NM: string;

  // 작업자 정보
  WRKR_ID: string;
  WRKR_NM: string;
  OLD_WRKR_ID: string;
  OLD_WRKR_NM: string;

  // 고객/계약 정보
  CUST_ID: string;
  CUST_NM: string;
  OLD_CUST_ID: string;
  CTRT_ID: string;

  // 소유/구매 정보
  OWNER_TP_CD: string;
  OWNER_TP_CD_NM: string;
  PRCHS_CL: string;
  PRCHS_CL_NM: string;
  PRCHS_UT_PRC: number;

  // 입고/출고 정보
  FIRST_IN_DT: string;
  IN_GRP_NO: string;
  OUT_REQ_NO: string;

  // 반납/폐기 정보
  RETN_RESN_CD: string;
  RETN_RESN_CD_NM: string;
  OBS_RCPT_CD: string;
  OBS_RCPT_CD_NM: string;
  OBS_RCPT_DTL_CD: string;
  OBS_RCPT_DTL_CD_NM: string;

  // MAC 주소들
  STB_CM_MAC_ADDR: string;
  STB_INTERNAL_MAC_ADDR: string;
  STB_RTCA_ID: string;
  STB_CARTON_NO: string;

  // 변경 정보
  CHG_KND_CD: string;
  CHG_DATE: string;
  CHG_UID: string;
  REG_DATE: string;
  REG_UID: string;

  // 기타
  CCU_NO: string;
  EQT_UNI_ID: string;
  WRK_ID: string;
  CMIS_DATE: string;
  CMIS_REG_FLG: string;
  CMIS_REG_UID: string;
}

// EQT_LOC_NM에서 보유기사 정보 파싱: "전산상작업(S20071136)" -> { name: "전산상작업", id: "S20071136" }
const parseWorkerFromLocNm = (locNm: string | undefined | null): { name: string; id: string } => {
  if (!locNm) return { name: '-', id: '' };
  const match = locNm.match(/^(.+?)\(([A-Za-z0-9]+)\)$/);
  if (match) {
    return { name: match[1], id: match[2] };
  }
  return { name: locNm, id: '' };
};

// 조회 모드 타입
type ScanMode = 'single' | 'multi' | 'manual';

const EquipmentList: React.FC<EquipmentListProps> = ({ onBack, showToast }) => {
  const [searchValue, setSearchValue] = useState(''); // 검색어 (S/N 또는 MAC)
  const [isLoading, setIsLoading] = useState(false);
  const [equipmentDetail, setEquipmentDetail] = useState<EquipmentDetail | null>(null);
  const [rawResponse, setRawResponse] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [myEquipments, setMyEquipments] = useState<any[]>([]);
  const [isLoadingMyEquipments, setIsLoadingMyEquipments] = useState(false);

  // 조회 모드: single(스캔), multi(복수스캔), manual(장비번호 입력)
  const [scanMode, setScanMode] = useState<ScanMode>('single');

  // 복수 스캔 누적 조회 기능
  const [scannedItems, setScannedItems] = useState<EquipmentDetail[]>([]);
  // isMultiScanMode는 scanMode === 'multi'로 대체
  const isMultiScanMode = scanMode === 'multi';

  // 스캔된 바코드 추적 (useRef로 즉시 동기 체크)
  const scannedBarcodesRef = React.useRef<Set<string>>(new Set());
  // 스캔 시도 횟수 (UI 표시용)
  const [scanAttemptCount, setScanAttemptCount] = useState(0);

  // 조회 실패한 S/N 목록 (DB에 없는 장비)
  const [failedBarcodes, setFailedBarcodes] = useState<string[]>([]);

  // 문의 전화번호 (D'Live 고객센터)
  const INQUIRY_PHONE = '1644-1100';

  // 자세히 보기만 사용 (뷰 모드 선택 제거)

  // 일괄 조회 모드
  const [showBulkView, setShowBulkView] = useState(false);

  // 바코드 스캐너 모달
  const [showBarcodeScanner, setShowBarcodeScanner] = useState(false);

  // 바코드 스캔 입력 참조
  const inputRef = React.useRef<HTMLInputElement>(null);

  // 로그인한 사용자 정보 가져오기
  const getLoggedInUser = (): {
    userId: string;
    soId: string | null;
    authSoList: Array<{ SO_ID: string; SO_NM: string }> | null;
  } | null => {
    try {
      const userStr = localStorage.getItem('user');
      if (userStr) {
        const user = JSON.parse(userStr);
        const userId = user.USR_ID || user.WRKR_ID || user.userId || null;
        // 본사 직원: soId가 있음, 타사 직원: soId가 없고 AUTH_SO_List만 있음
        const soId = user.soId || user.SO_ID || null;
        const authSoList = user.AUTH_SO_List || null;

        console.log('[장비처리] 사용자 정보:', { userId, soId: soId || '(없음)', authSoListCount: authSoList?.length || 0 });
        return userId ? { userId, soId, authSoList } : null;
      }
    } catch (e) {
      console.warn('사용자 정보 파싱 실패:', e);
    }
    return null;
  };

  // 내 보유 장비 목록 로드
  useEffect(() => {
    const loadMyEquipments = async () => {
      const userInfo = getLoggedInUser();
      if (!userInfo) return;

      setIsLoadingMyEquipments(true);
      try {
        let allEquipments: any[] = [];

        if (userInfo.soId) {
          // 본사 직원: soId가 있으면 그것으로 조회
          const params = { WRKR_ID: userInfo.userId, SO_ID: userInfo.soId };
          console.log('[장비처리] 본사직원 - SO_ID로 조회:', params);
          const result = await debugApiCall(
            'EquipmentList',
            'getWrkrHaveEqtList',
            () => getWrkrHaveEqtList(params),
            params
          );
          allEquipments = Array.isArray(result) ? result : result?.data || [];
        } else if (userInfo.authSoList && userInfo.authSoList.length > 0) {
          // 타사 직원: AUTH_SO_List의 각 SO_ID로 조회
          console.log('[장비처리] 타사직원 - AUTH_SO_List로 조회:', userInfo.authSoList);
          for (const so of userInfo.authSoList) {
            try {
              const params = { WRKR_ID: userInfo.userId, SO_ID: so.SO_ID };
              const result = await debugApiCall(
                'EquipmentList',
                `getWrkrHaveEqtList(SO_ID=${so.SO_ID})`,
                () => getWrkrHaveEqtList(params),
                params
              );
              const items = Array.isArray(result) ? result : result?.data || [];
              // 본인 장비만 필터링
              const myItems = items.filter((e: any) => e.WRKR_ID === userInfo.userId || e.ID === userInfo.userId);
              allEquipments = [...allEquipments, ...myItems];
            } catch (e) {
              console.warn(`SO_ID ${so.SO_ID} 조회 실패:`, e);
            }
          }
          // 중복 제거 (EQT_SERNO 기준)
          const uniqueMap = new Map();
          allEquipments.forEach(e => {
            if (e.EQT_SERNO && !uniqueMap.has(e.EQT_SERNO)) {
              uniqueMap.set(e.EQT_SERNO, e);
            }
          });
          allEquipments = Array.from(uniqueMap.values());
          console.log('[장비처리] 타사직원 최종 장비:', allEquipments.length, '건');
        } else {
          // 기본: SO_ID 없이 조회
          const params = { WRKR_ID: userInfo.userId };
          console.log('[장비처리] 기본 조회 (SO_ID 없음):', params);
          const result = await debugApiCall(
            'EquipmentList',
            'getWrkrHaveEqtList',
            () => getWrkrHaveEqtList(params),
            params
          );
          allEquipments = Array.isArray(result) ? result : result?.data || [];
        }

        setMyEquipments(allEquipments);
      } catch (err) {
        console.warn('내 보유 장비 로드 실패:', err);
      } finally {
        setIsLoadingMyEquipments(false);
      }
    };

    loadMyEquipments();
  }, []);

  // 내 보유 장비에서 검색
  const searchInMyEquipments = (searchVal: string): any | null => {
    const normalizedSearch = searchVal.toUpperCase().replace(/[:-]/g, '');

    for (const eq of myEquipments) {
      // S/N 검색
      const serno = (eq.EQT_SERNO || eq.SERIAL_NO || eq.SN || '').toUpperCase().replace(/[:-]/g, '');
      if (serno && serno.includes(normalizedSearch)) {
        return eq;
      }

      // MAC 검색
      const mac = (eq.MAC_ADDRESS || eq.MAC || eq.MAC_ADDR || '').toUpperCase().replace(/[:-]/g, '');
      if (mac && mac.includes(normalizedSearch)) {
        return eq;
      }

      // EQT_NO 검색
      const eqtNo = (eq.EQT_NO || '').toUpperCase();
      if (eqtNo && eqtNo.includes(normalizedSearch)) {
        return eq;
      }
    }

    return null;
  };

  // 바코드 스캔 핸들러
  const handleBarcodeScan = async (barcode: string) => {
    console.log('Barcode scanned:', barcode);
    const normalizedBarcode = barcode.toUpperCase().replace(/[:-]/g, '');

    // 복수 스캔 모드: 바코드 값 기준 중복 체크 (useRef로 즉시 동기 체크)
    if (isMultiScanMode) {
      if (scannedBarcodesRef.current.has(normalizedBarcode)) {
        showToast?.('이미 스캔된 바코드입니다.', 'warning');
        return;
      }
      // 바코드 즉시 추가 (동기적으로 즉시 반영됨)
      scannedBarcodesRef.current.add(normalizedBarcode);
      // 스캔 카운트 증가 (UI 표시용)
      setScanAttemptCount(scannedBarcodesRef.current.size);
    }

    setSearchValue(barcode.toUpperCase());

    // 복수 스캔 모드가 아닐 때만 스캐너 닫기
    if (!isMultiScanMode) {
      setShowBarcodeScanner(false);
    }

    showToast?.(`바코드 스캔: ${barcode}`, 'success');

    // 자동 조회 - 바코드 값을 직접 전달 (상태 업데이트 지연 방지)
    const barcodeValue = barcode.toUpperCase();
    setTimeout(() => {
      handleSearch(barcodeValue);
    }, 100);
  };

  const handleSearch = async (directValue?: string) => {
    const valueToSearch = directValue || searchValue.trim();
    if (!valueToSearch) {
      showToast?.('검색어를 입력해주세요.', 'warning');
      return;
    }

    setIsLoading(true);
    setError(null);
    if (!isMultiScanMode) {
      setEquipmentDetail(null);
    }
    setRawResponse(null);

    // 콤마로 구분된 모든 값 추출 (중복 제거)
    const rawValue = String(valueToSearch || '');
    const searchValues: string[] = (typeof rawValue === 'string' && rawValue.includes(','))
      ? [...new Set(rawValue.split(',').map(s => s.trim().toUpperCase().replace(/[\s:-]/g, '')).filter(s => s.length > 0))]
      : [rawValue.toUpperCase().replace(/[\s:-]/g, '')].filter(s => s.length > 0);

    if (searchValues.length === 0) {
      showToast?.('검색할 S/N을 입력해주세요.', 'warning');
      setIsLoading(false);
      return;
    }

    // 단일 장비 검색 헬퍼 함수
    const searchSingleEquipment = async (val: string): Promise<{ found: boolean; equipment?: EquipmentDetail; source?: string }> => {
      if (myEquipments.length > 0) {
        const foundInMy = searchInMyEquipments(val);
        if (foundInMy) return { found: true, equipment: foundInMy as EquipmentDetail, source: 'myEquipments' };
      }
      try {
        const userInfo = getLoggedInUser();
        const historyParams = { EQT_SERNO: val, SO_ID: userInfo?.soId || undefined, WRKR_ID: userInfo?.userId };
        const historyResult = await debugApiCall('EquipmentList', 'getEquipmentHistoryInfo', () => getEquipmentHistoryInfo(historyParams), historyParams);
        if (historyResult && (Array.isArray(historyResult) ? historyResult.length > 0 : true)) {
          const equipment = Array.isArray(historyResult) ? historyResult[0] : historyResult;
          return { found: true, equipment: equipment as EquipmentDetail, source: 'getEquipmentHistoryInfo' };
        }
      } catch (e) { console.error('[장비처리] 검색 에러:', val, e); }
      return { found: false };
    };

    console.log('[장비조회] 검색 시작:', { searchValues, count: searchValues.length, isMultiScanMode });

    // 여러 값이 있으면 병렬로 모두 검색
    if (searchValues.length > 1) {
      const results = await Promise.all(searchValues.map(async (val) => ({ searchVal: val, ...(await searchSingleEquipment(val)) })));
      const foundItems: EquipmentDetail[] = [];
      const notFoundItems: string[] = [];
      results.forEach(({ searchVal: sv, found, equipment }) => {
        if (found && equipment) foundItems.push(equipment);
        else notFoundItems.push(sv);
      });

      console.log('[장비조회] 복수 검색 결과:', { found: foundItems.length, notFound: notFoundItems.length });

      if (foundItems.length > 0) {
        const newItems: EquipmentDetail[] = [];
        foundItems.forEach(equipment => {
          const isDuplicate = scannedItems.some(item =>
            item.EQT_SERNO === equipment.EQT_SERNO || item.EQT_NO === equipment.EQT_NO ||
            (item.MAC_ADDRESS && equipment.MAC_ADDRESS && item.MAC_ADDRESS === equipment.MAC_ADDRESS)
          );
          if (!isDuplicate) newItems.push(equipment);
        });

        if (newItems.length > 0) {
          setScannedItems(prev => [...prev, ...newItems]);
          newItems.forEach(eq => {
            const barcode = (eq.EQT_SERNO || '').toUpperCase().replace(/[:-]/g, '');
            if (barcode) scannedBarcodesRef.current.add(barcode);
          });
          setScanAttemptCount(scannedBarcodesRef.current.size);
        }

        if (notFoundItems.length > 0) {
          setFailedBarcodes(prev => {
            const arr = Array.isArray(prev) ? prev : [];
            return [...arr, ...notFoundItems.filter(sn => !arr.includes(sn))];
          });
        }

        setShowBulkView(true);
        setEquipmentDetail(null);
        setSearchValue('');
        showToast?.(`${newItems.length}건 조회 완료${notFoundItems.length > 0 ? `, ${notFoundItems.length}건 미등록` : ''}`, 'success');
      } else {
        setFailedBarcodes(prev => {
          const arr = Array.isArray(prev) ? prev : [];
          return [...arr, ...notFoundItems.filter(sn => !arr.includes(sn))];
        });
        setError('입력한 장비를 모두 찾을 수 없습니다.');
        showToast?.('장비를 찾을 수 없습니다.', 'error');
      }

      setIsLoading(false);
      return;
    }

    // 단일 값 검색
    const searchVal = searchValues[0];
    const result = await searchSingleEquipment(searchVal);

    if (result.found && result.equipment) {
      const equipment = result.equipment;

      if (isMultiScanMode) {
        const added = handleAddToScannedList(equipment);
        if (added) {
          const scannedSNs = Array.from(scannedBarcodesRef.current).join(', ');
          setSearchValue(scannedSNs);
          showToast?.(`장비가 추가되었습니다. (${scannedItems.length + 1}건)`, 'success');
        } else {
          const normalizedBarcode = searchVal.toUpperCase().replace(/[\s:-]/g, '');
          scannedBarcodesRef.current.delete(normalizedBarcode);
          setScanAttemptCount(scannedBarcodesRef.current.size);
          const scannedSNs = Array.from(scannedBarcodesRef.current).join(', ');
          setSearchValue(scannedSNs || '');
        }
      } else {
        setEquipmentDetail(enrichEquipmentData(equipment));
        setRawResponse({ successApi: result.source, data: equipment, source: result.source });
        showToast?.('장비 정보를 조회했습니다.', 'success');
      }
    } else {
      if (isMultiScanMode) {
        scannedBarcodesRef.current.delete(searchVal);
        setScanAttemptCount(scannedBarcodesRef.current.size);
        setFailedBarcodes(prev => {
          const arr = Array.isArray(prev) ? prev : [];
          if (!arr.includes(searchVal)) return [...arr, searchVal];
          return arr;
        });
        const scannedSNs = Array.from(scannedBarcodesRef.current).join(', ');
        setSearchValue(scannedSNs);
        showToast?.('장비를 찾을 수 없습니다.', 'error');
      } else {
        setError('장비를 찾을 수 없습니다. S/N 또는 MAC 주소를 확인해주세요.');
        showToast?.('장비를 찾을 수 없습니다.', 'error');
      }
    }

    setIsLoading(false);
  };

    // 정보 필드 렌더링 헬퍼
  const InfoRow: React.FC<{ label: string; value: string | number | undefined | null }> = ({ label, value }) => (
    <div className="flex border-b border-gray-100 py-1.5">
      <span className="w-28 flex-shrink-0 text-xs text-gray-500">{label}</span>
      <span className="flex-1 text-xs text-gray-900 font-medium break-all">{value || '-'}</span>
    </div>
  );

  // 섹션 헤더
  const SectionHeader: React.FC<{ title: string }> = ({ title }) => (
    <div className="bg-gradient-to-r from-gray-50 to-white px-3 py-2 -mx-4 mt-4 mb-2 first:mt-0 border-y border-gray-100">
      <h4 className="text-xs font-bold text-gray-600">{title}</h4>
    </div>
  );

  // 스캔 아이템 삭제
  const handleRemoveScannedItem = (index: number) => {
    const removedItem = scannedItems[index];
    if (removedItem) {
      // 해당 바코드도 ref에서 제거
      const barcode = (removedItem.EQT_SERNO || removedItem.MAC_ADDRESS || '').toUpperCase().replace(/[:-]/g, '');
      scannedBarcodesRef.current.delete(barcode);
    }
    setScannedItems(prev => prev.filter((_, i) => i !== index));
  };

  // 스캔 목록 초기화
  const handleClearScannedItems = () => {
    setScannedItems([]);
    setFailedBarcodes([]); // 실패 목록도 초기화
    scannedBarcodesRef.current.clear(); // 바코드 추적도 초기화
    setScanAttemptCount(0); // 스캔 카운트도 초기화
    setEquipmentDetail(null);
    setShowBulkView(false);
    showToast?.('스캔 목록이 초기화되었습니다.', 'info');
  };

  // 바코드 스캐너 닫기 핸들러 (일괄 조회 자동 표시)
  const handleCloseBarcodeScanner = () => {
    setShowBarcodeScanner(false);
    // 스캔된 장비가 있으면 일괄 조회 모드로 자동 전환
    if (isMultiScanMode && (scannedItems.length > 0 || failedBarcodes.length > 0 || scanAttemptCount > 0)) {
      setShowBulkView(true);
      setEquipmentDetail(null);
    }
  };

  // 전화 걸기
  const handleCallInquiry = () => {
    window.location.href = `tel:${INQUIRY_PHONE}`;
  };

  // 복수 스캔 모드에서 장비 추가
  const handleAddToScannedList = (equipment: EquipmentDetail) => {
    // 중복 체크: EQT_SERNO, EQT_NO, MAC_ADDRESS 모두 확인
    // 같은 장비를 S/N으로 스캔하고 MAC으로 다시 스캔해도 중복 처리
    const isDuplicate = scannedItems.some(
      item =>
        item.EQT_SERNO === equipment.EQT_SERNO ||
        item.EQT_NO === equipment.EQT_NO ||
        (item.MAC_ADDRESS && equipment.MAC_ADDRESS && item.MAC_ADDRESS === equipment.MAC_ADDRESS)
    );
    if (isDuplicate) {
      showToast?.('이미 스캔된 장비입니다. (동일 장비번호)', 'warning');
      return false;
    }
    setScannedItems(prev => [...prev, equipment]);
    return true;
  };

  // 바코드 스캔 시 자동 검색 (Enter 없이 일정 시간 후 자동 실행)
  const [scanTimeout, setScanTimeout] = useState<NodeJS.Timeout | null>(null);

  const handleBarcodeInput = (value: string) => {
    setSearchValue(value.toUpperCase());

    // 복수 스캔 모드에서 바코드 스캔 시 자동 검색
    if (isMultiScanMode && value.length >= 6) {
      // 이전 타임아웃 클리어
      if (scanTimeout) {
        clearTimeout(scanTimeout);
      }
      // 300ms 후 자동 검색 (바코드 스캐너 입력 완료 대기)
      const timeout = setTimeout(() => {
        handleSearch();
      }, 300);
      setScanTimeout(timeout);
    }
  };

  // 컴포넌트 언마운트 시 타임아웃 클리어
  useEffect(() => {
    return () => {
      if (scanTimeout) {
        clearTimeout(scanTimeout);
      }
    };
  }, [scanTimeout]);

  return (
    <div className="h-full overflow-y-auto bg-gray-50 px-4 py-4 space-y-3">

        {/* 조회 모드 선택 */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-1">
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => setScanMode('single')}
              className={`py-2 px-2 rounded-lg text-sm font-medium transition-all ${
                scanMode === 'single'
                  ? 'bg-blue-500 text-white shadow-sm'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              스캔
            </button>
            
            <button
              onClick={() => setScanMode('manual')}
              className={`py-2 px-2 rounded-lg text-sm font-medium transition-all ${
                scanMode === 'manual'
                  ? 'bg-green-500 text-white shadow-sm'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              장비번호
            </button>
          </div>

          {/* 복수스캔 모드 결과 표시 */}
          {scanMode === 'multi' && (scannedItems.length > 0 || failedBarcodes.length > 0 || scanAttemptCount > 0) && (
            <div className="mt-3 flex items-center justify-between pt-3 border-t border-gray-100">
              <div className="flex items-center gap-2">
                {scannedItems.length > 0 && (
                  <span className="text-xs text-blue-600 font-medium">
                    성공: {scannedItems.length}건
                  </span>
                )}
                {failedBarcodes.length > 0 && (
                  <span className="text-xs text-red-500 font-medium">
                    미등록: {failedBarcodes.length}건
                  </span>
                )}
              </div>
              <button
                onClick={handleClearScannedItems}
                className="text-xs text-red-500 hover:text-red-700 transition-colors"
              >
                목록 초기화
              </button>
            </div>
          )}
        </div>

        {/* 스캔 버튼 (단일/복수스캔 모드) */}
        {(scanMode === 'single' || scanMode === 'multi') && (
          <button
            onClick={() => setShowBarcodeScanner(true)}
            className={`w-full py-4 rounded-xl font-semibold text-base shadow-lg flex items-center justify-center gap-3 active:scale-[0.98] transition-all touch-manipulation ${
              scanMode === 'single'
                ? 'bg-gradient-to-r from-blue-500 to-blue-600 text-white'
                : 'bg-gradient-to-r from-purple-500 to-purple-600 text-white'
            }`}
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" />
            </svg>
            {scanMode === 'single' ? '바코드 스캔 (1건)' : '바코드 연속 스캔'}
          </button>
        )}

        {/* 장비번호 입력 영역 (manual 모드) */}
        {scanMode === 'manual' && (
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1.5">장비번호 (S/N 또는 MAC)</label>
                <input
                  ref={inputRef}
                  type="text"
                  value={searchValue}
                  onChange={(e) => setSearchValue(e.target.value.toUpperCase())}
                  onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                  className="w-full px-4 py-3 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent uppercase font-mono transition-all"
                  placeholder="S/N 또는 MAC 주소 입력"
                  autoFocus
                />
              </div>
              <button
                onClick={() => handleSearch()}
                disabled={isLoading}
                className="w-full bg-blue-500 hover:bg-blue-600 disabled:bg-gray-400 text-white py-3 rounded-lg font-semibold text-sm shadow-sm transition-all active:scale-[0.98] touch-manipulation flex items-center justify-center gap-2"
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
        )}

        {/* 복수 스캔 모드: 스캔된 장비 목록 */}
        {isMultiScanMode && scannedItems.length > 0 && (
          <div className="bg-white rounded-xl border border-blue-200 shadow-sm p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-bold text-blue-700 flex items-center gap-2">
                <span>스캔된 장비 목록</span>
                <span className="bg-blue-100 text-blue-600 px-2 py-0.5 rounded-full text-xs">
                  {scannedItems.length}건
                </span>
              </h3>
              <button
                onClick={() => setShowBulkView(!showBulkView)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                  showBulkView
                    ? 'bg-blue-500 text-white'
                    : 'bg-blue-100 text-blue-700 hover:bg-blue-200'
                }`}
              >
                {showBulkView ? '목록 보기' : '일괄 조회'}
              </button>
            </div>
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {scannedItems.map((item, index) => (
                <div
                  key={index}
                  className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border border-gray-100"
                >
                  <div
                    className="flex-1 cursor-pointer active:bg-gray-100 rounded-lg -m-1 p-1"
                    onClick={() => setEquipmentDetail(enrichEquipmentData(item))}
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-medium text-gray-800">
                        {item.EQT_CL_NM || item.ITEM_NM || '장비'}
                      </span>
                      <span className="text-xs text-gray-500 font-mono">
                        {item.EQT_SERNO || '-'}
                      </span>
                    </div>
                    <div className="text-[10px] text-gray-400 mt-0.5">
                      {item.EQT_STAT_CD_NM || item.EQT_USE_STAT_CD_NM || ''}
                      {(() => {
                        const worker = parseWorkerFromLocNm(item.EQT_LOC_NM);
                        if (worker.id) return ` · ${worker.name}(${worker.id})`;
                        return item.WRKR_NM ? ` · ${item.WRKR_NM}` : '';
                      })()}
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => setEquipmentDetail(enrichEquipmentData(item))}
                      className="text-blue-500 hover:text-blue-700 p-1.5 hover:bg-blue-50 rounded-lg transition-colors"
                      title="상세 조회"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                      </svg>
                    </button>
                    <button
                      onClick={() => handleRemoveScannedItem(index)}
                      className="text-red-400 hover:text-red-600 p-1.5 hover:bg-red-50 rounded-lg transition-colors"
                      title="삭제"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 일괄 조회 결과 */}
        {isMultiScanMode && showBulkView && scannedItems.length > 0 && (
          <div className="bg-white rounded-xl border border-green-200 shadow-sm p-4">
            <h3 className="text-sm font-bold text-green-700 mb-4 flex items-center gap-2">
              <span>📋</span>
              <span>일괄 조회 결과</span>
              <span className="bg-green-100 text-green-600 px-2 py-0.5 rounded-full text-xs">
                {scannedItems.length}건
              </span>
            </h3>
            <div className="space-y-4 max-h-[60vh] overflow-y-auto">
              {scannedItems.map((item, index) => {
                const enrichedItem = enrichEquipmentData(item);
                return (
                  <div
                    key={index}
                    className="bg-gray-50 rounded-lg p-3 border border-gray-200 cursor-pointer hover:bg-blue-50 hover:border-blue-300 transition-all active:scale-[0.99]"
                    onClick={() => {
                      setEquipmentDetail(enrichedItem);
                      setShowBulkView(false);
                    }}
                  >
                    {/* 헤더: 번호 + 장비명 + 상태 + 화살표 */}
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div className="flex items-center gap-2 min-w-0 flex-1">
                        <span className="bg-blue-500 text-white text-xs font-bold px-1.5 py-0.5 rounded flex-shrink-0">
                          #{index + 1}
                        </span>
                        <span className="font-bold text-gray-800 text-sm truncate">
                          {enrichedItem.EQT_CL_NM || enrichedItem.ITEM_NM || '장비'}
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5 flex-shrink-0">
                        <span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold whitespace-nowrap ${
                          enrichedItem.EQT_STAT_CD === '10' ? 'bg-green-100 text-green-700' :
                          enrichedItem.EQT_STAT_CD === '20' ? 'bg-blue-100 text-blue-700' :
                          'bg-gray-100 text-gray-700'
                        }`}>
                          {enrichedItem.EQT_STAT_CD_NM || '-'}
                        </span>
                        <span className="text-[10px] text-blue-500 whitespace-nowrap">→</span>
                      </div>
                    </div>
                    {/* 상세 정보 */}
                    <div className="space-y-1 text-xs">
                      <div className="flex">
                        <span className="text-gray-400 w-8 flex-shrink-0">S/N</span>
                        <span className="font-mono text-gray-800 truncate">{enrichedItem.EQT_SERNO || '-'}</span>
                      </div>
                      <div className="flex">
                        <span className="text-gray-400 w-8 flex-shrink-0">MAC</span>
                        <span className="font-mono text-gray-700 truncate">{enrichedItem.MAC_ADDRESS || '-'}</span>
                      </div>
                      <div className="flex">
                        <span className="text-gray-400 w-8 flex-shrink-0">No.</span>
                        <span className="font-mono text-gray-700 truncate">{enrichedItem.EQT_NO || '-'}</span>
                      </div>
                      <div className="flex">
                        <span className="text-gray-400 w-8 flex-shrink-0">위치</span>
                        <span className="text-gray-700">{enrichedItem.EQT_LOC_TP_CD_NM || '-'}</span>
                        {enrichedItem.EQT_LOC_NM && (
                          <span className="text-gray-500 ml-1 truncate">· {enrichedItem.EQT_LOC_NM}</span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* 에러 메시지 */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-4">
            <p className="text-xs text-red-600">{error}</p>
          </div>
        )}

        {/* 장비 상세 정보 (단일 조회 또는 일괄 조회가 아닐 때) */}
        {equipmentDetail && !showBulkView && (
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
            {/* 헤더 + 뷰 모드 선택 */}
            <div className="p-4 border-b border-gray-100">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-bold text-gray-800 flex items-center gap-2">
                  <span className="text-blue-500">📦</span> 장비 상세 정보
                </h3>

              </div>

            </div>

            {/* 자세히 보기: 전체 정보 */}
            <div className="p-4 max-h-[60vh] overflow-y-auto">
              {/* 기본 정보 */}
              <SectionHeader title="기본 정보" />
              <InfoRow label="장비번호" value={equipmentDetail.EQT_NO} />
              <InfoRow label="일련번호(S/N)" value={equipmentDetail.EQT_SERNO} />
              <InfoRow label="MAC 주소" value={equipmentDetail.MAC_ADDRESS} />
              <InfoRow label="바코드" value={equipmentDetail.BAR_CD} />
              <InfoRow label="IRD S/N" value={equipmentDetail.IRD_SN} />

              {/* 장비 유형 */}
              <SectionHeader title="장비 유형" />
              <InfoRow label="장비분류" value={equipmentDetail.EQT_CL_NM || equipmentDetail.EQT_CL_CD} />
              <InfoRow label="장비타입" value={equipmentDetail.EQT_TP_CD_NM || equipmentDetail.EQT_TP_CD} />
              <InfoRow label="품목코드" value={equipmentDetail.ITEM_CD} />
              <InfoRow label="품목명" value={equipmentDetail.ITEM_NM} />
              <InfoRow label="제조사" value={equipmentDetail.MAKER} />
              <InfoRow label="제조일" value={equipmentDetail.MNFCT_DT} />

              {/* 상태 정보 */}
              <SectionHeader title="상태 정보" />
              <InfoRow label="장비상태" value={equipmentDetail.EQT_STAT_CD_NM || equipmentDetail.EQT_STAT_CD} />
              <InfoRow label="사용상태" value={equipmentDetail.EQT_USE_STAT_CD_NM || equipmentDetail.EQT_USE_STAT_CD} />
              <InfoRow label="사용가능여부" value={equipmentDetail.EQT_USE_ARR_YN_NM || equipmentDetail.EQT_USE_ARR_YN} />
              <InfoRow label="사용종료일" value={equipmentDetail.EQT_USE_END_DT} />

              {/* 위치 정보 */}
              <SectionHeader title="위치 정보" />
              <InfoRow label="현재위치" value={equipmentDetail.EQT_LOC_NM || equipmentDetail.EQT_LOC_TP_CD_NM} />
              <InfoRow label="이전위치" value={equipmentDetail.OLD_EQT_LOC_NM || equipmentDetail.OLD_EQT_LOC_TP_CD_NM} />

              {/* 지점/협력사 */}
              <SectionHeader title="지점/협력사" />
              <InfoRow label="지점" value={equipmentDetail.SO_NM || equipmentDetail.SO_ID} />
              <InfoRow label="본부" value={equipmentDetail.MST_SO_NM || equipmentDetail.MST_SO_ID} />
              <InfoRow label="협력사" value={equipmentDetail.CRR_NM || equipmentDetail.CRR_ID} />
              <InfoRow label="이전지점" value={equipmentDetail.OLD_SO_NM || equipmentDetail.OLD_SO_ID} />
              <InfoRow label="이전협력사" value={equipmentDetail.OLD_CRR_NM || equipmentDetail.OLD_CRR_ID} />

              {/* 보유기사 정보 */}
              <SectionHeader title="보유기사 정보" />
              <InfoRow label="보유기사" value={(() => {
                const worker = parseWorkerFromLocNm(equipmentDetail.EQT_LOC_NM);
                if (worker.id) return `${worker.name} (${worker.id})`;
                return equipmentDetail.WRKR_NM ? `${equipmentDetail.WRKR_NM} (${equipmentDetail.WRKR_ID})` : (equipmentDetail.WRKR_ID || '-');
              })()} />
              <InfoRow label="이전보유기사" value={(() => {
                const worker = parseWorkerFromLocNm(equipmentDetail.OLD_EQT_LOC_NM);
                if (worker.id) return `${worker.name} (${worker.id})`;
                return equipmentDetail.OLD_WRKR_NM ? `${equipmentDetail.OLD_WRKR_NM} (${equipmentDetail.OLD_WRKR_ID})` : (equipmentDetail.OLD_WRKR_ID || '-');
              })()} />

              {/* 고객/계약 */}
              <SectionHeader title="고객/계약 정보" />
              <InfoRow label="고객ID" value={equipmentDetail.CUST_ID} />
              <InfoRow label="고객명" value={equipmentDetail.CUST_NM} />
              <InfoRow label="계약ID" value={equipmentDetail.CTRT_ID} />

              {/* 소유/구매 */}
              <SectionHeader title="소유/구매 정보" />
              <InfoRow label="소유구분" value={equipmentDetail.OWNER_TP_CD_NM || equipmentDetail.OWNER_TP_CD} />
              <InfoRow label="구매구분" value={equipmentDetail.PRCHS_CL_NM || equipmentDetail.PRCHS_CL} />
              <InfoRow label="구매단가" value={equipmentDetail.PRCHS_UT_PRC ? `${equipmentDetail.PRCHS_UT_PRC.toLocaleString()}원` : '-'} />

              {/* 입고/출고 */}
              <SectionHeader title="입고/출고 정보" />
              <InfoRow label="최초입고일" value={equipmentDetail.FIRST_IN_DT} />
              <InfoRow label="입고그룹번호" value={equipmentDetail.IN_GRP_NO} />
              <InfoRow label="출고요청번호" value={equipmentDetail.OUT_REQ_NO} />

              {/* 반납/폐기 */}
              <SectionHeader title="반납/폐기 정보" />
              <InfoRow label="반납사유" value={equipmentDetail.RETN_RESN_CD_NM || equipmentDetail.RETN_RESN_CD} />
              <InfoRow label="폐기구분" value={equipmentDetail.OBS_RCPT_CD_NM || equipmentDetail.OBS_RCPT_CD} />
              <InfoRow label="폐기상세" value={equipmentDetail.OBS_RCPT_DTL_CD_NM || equipmentDetail.OBS_RCPT_DTL_CD} />

              {/* STB 추가 정보 */}
              <SectionHeader title="STB 추가 정보" />
              <InfoRow label="CM MAC" value={equipmentDetail.STB_CM_MAC_ADDR} />
              <InfoRow label="Internal MAC" value={equipmentDetail.STB_INTERNAL_MAC_ADDR} />
              <InfoRow label="RTCA ID" value={equipmentDetail.STB_RTCA_ID} />
              <InfoRow label="카톤번호" value={equipmentDetail.STB_CARTON_NO} />

              {/* 변경 이력 */}
              <SectionHeader title="변경 이력" />
              <InfoRow label="변경종류" value={equipmentDetail.CHG_KND_CD} />
              <InfoRow label="변경일시" value={equipmentDetail.CHG_DATE} />
              <InfoRow label="변경자" value={equipmentDetail.CHG_UID} />
              <InfoRow label="등록일시" value={equipmentDetail.REG_DATE} />
              <InfoRow label="등록자" value={equipmentDetail.REG_UID} />
            </div>
          </div>
        )}

        {/* 디버그: Raw 응답 데이터 */}
        {rawResponse && (
          <div className="bg-gray-50 rounded-xl border border-gray-200 p-4">
            <details>
              <summary className="text-xs font-medium text-gray-600 cursor-pointer">
                API 원본 응답 (디버그)
              </summary>
              <pre className="mt-2 text-xs text-gray-700 overflow-x-auto whitespace-pre-wrap bg-white p-3 rounded-lg border border-gray-100 max-h-48 overflow-y-auto">
                {JSON.stringify(rawResponse, null, 2)}
              </pre>
            </details>
          </div>
        )}

        {/* 빈 상태 */}
        {!isLoading && !equipmentDetail && !error && (
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-8">
            <div className="text-center">
              <div className="w-16 h-16 mx-auto mb-4 bg-blue-100 rounded-full flex items-center justify-center">
                <svg className="w-8 h-8 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </div>
              <p className="text-gray-600 text-sm mb-1">장비 일련번호(S/N) 또는 MAC 주소로</p>
              <p className="text-gray-600 text-sm mb-3">장비 정보를 조회해보세요</p>
              {myEquipments.length > 0 && (
                <div className="mt-4 p-3 bg-blue-50 rounded-lg">
                  <p className="text-xs text-blue-700">
                    내 보유 장비({myEquipments.length}건)에서 먼저 검색합니다.
                  </p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* 내 보유 장비 목록 미리보기 */}
        {!equipmentDetail && myEquipments.length > 0 && (
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
            <details>
              <summary className="text-xs font-medium text-gray-700 cursor-pointer">
                내 보유 장비 목록 ({myEquipments.length}건)
              </summary>
              <div className="mt-3 space-y-2 max-h-48 overflow-y-auto">
                {myEquipments.slice(0, 20).map((eq, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between p-3 bg-gray-50 rounded-lg text-xs cursor-pointer hover:bg-blue-50 transition-colors active:scale-[0.99] touch-manipulation"
                    style={{ WebkitTapHighlightColor: 'transparent' }}
                    onClick={() => {
                      setSearchValue(eq.EQT_SERNO || eq.SERIAL_NO || eq.MAC_ADDRESS || eq.MAC || '');
                      setEquipmentDetail(enrichEquipmentData(eq));
                      setRawResponse({ source: '내 보유 장비 목록에서 선택', data: eq });
                    }}
                  >
                    <div>
                      <span className="font-medium text-gray-800">{eq.EQT_CL_NM || eq.EQT_TP_CD || '장비'}</span>
                      <span className="ml-2 text-gray-500 font-mono">{eq.EQT_SERNO || eq.SERIAL_NO || '-'}</span>
                    </div>
                    <span className="text-gray-400 text-xs bg-gray-100 px-2 py-0.5 rounded">{eq.EQT_STAT_CD_NM || eq.EQT_USE_STAT_CD || ''}</span>
                  </div>
                ))}
                {myEquipments.length > 20 && (
                  <p className="text-xs text-gray-500 text-center py-2">... 외 {myEquipments.length - 20}건</p>
                )}
              </div>
            </details>
          </div>
        )}

        {/* 등록되지 않은 장비 */}
        {failedBarcodes.length > 0 && (
          <div className="bg-red-50 rounded-xl border border-red-200 shadow-sm p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-bold text-red-700 flex items-center gap-2">
                <span>⚠️</span>
                <span>등록되지 않은 장비</span>
                <span className="bg-red-100 text-red-600 px-2 py-0.5 rounded-full text-xs">
                  {failedBarcodes.length}건
                </span>
              </h3>
              <button
                onClick={() => setFailedBarcodes([])}
                className="text-xs text-red-500 hover:text-red-700"
              >
                목록 삭제
              </button>
            </div>

            {/* 실패한 S/N 목록 */}
            <div className="space-y-2 mb-4">
              {failedBarcodes.map((sn, index) => (
                <div
                  key={index}
                  className="flex items-center justify-between p-2 bg-white rounded-lg border border-red-100"
                >
                  <span className="text-xs font-mono text-red-800">{sn}</span>
                  <span className="text-xs text-red-500">미등록</span>
                </div>
              ))}
            </div>

            {/* 문의 안내 */}
            <div className="bg-white rounded-lg p-3 border border-red-100">
              <p className="text-xs text-gray-600 mb-3 text-center">
                등록되지 않은 장비입니다.<br />
                장비 등록 문의는 아래 번호로 연락해주세요.
              </p>
              <button
                onClick={handleCallInquiry}
                className="w-full py-3 bg-red-500 hover:bg-red-600 text-white rounded-lg font-semibold text-sm transition-all active:scale-[0.98] flex items-center justify-center gap-2"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                </svg>
                {INQUIRY_PHONE} 전화하기
              </button>
            </div>
          </div>
        )}

        {/* Barcode Scanner */}
        <BarcodeScanner
          isOpen={showBarcodeScanner}
          onClose={handleCloseBarcodeScanner}
          onScan={handleBarcodeScan}
          isMultiScanMode={isMultiScanMode}
          scanCount={scanAttemptCount}
        />
    </div>
  );
};

export default EquipmentList;
