import React, { useState, useEffect } from 'react';
import { getWrkrHaveEqtListAll as getWrkrHaveEqtList, getEquipmentHistoryInfo, changeEquipmentWorker } from '../../services/apiService';
import { debugApiCall } from './equipmentDebug';
import BarcodeScanner from './BarcodeScanner';

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

  const [isTransferring, setIsTransferring] = useState(false);

  // 조회 모드: single(스캔), multi(복수스캔), manual(장비번호 입력)
  const [scanMode, setScanMode] = useState<ScanMode>('manual');

  // 복수 결과 선택 모달
  const [showMultipleResultModal, setShowMultipleResultModal] = useState(false);
  const [multipleResults, setMultipleResults] = useState<EquipmentDetail[]>([]);

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
    crrId: string | null;
    authSoList: Array<{ SO_ID: string; SO_NM: string }> | null;
  } | null => {
    try {
      const userStr = localStorage.getItem('user');
      const userInfoStr = localStorage.getItem('userInfo');
      if (userStr || userInfoStr) {
        const user = userStr ? JSON.parse(userStr) : {};
        const ui = userInfoStr ? JSON.parse(userInfoStr) : {};
        const userId = user.USR_ID || user.WRKR_ID || user.userId || ui.userId || null;
        const soId = user.soId || user.SO_ID || ui.soId || null;
        const crrId = user.crrId || user.CRR_ID || ui.crrId || null;
        const authSoList = user.AUTH_SO_List || ui.authSoList || null;

        console.log('[장비처리] 사용자 정보:', { userId, soId: soId || '(없음)', crrId: crrId || '(없음)', authSoListCount: authSoList?.length || 0 });
        return userId ? { userId, soId, crrId, authSoList } : null;
      }
    } catch (e) {
      console.warn('사용자 정보 파싱 실패:', e);
    }
    return null;
  };

  // 기사보유장비로 이관
  const handleTransferToMe = async () => {
    if (!equipmentDetail || isTransferring) return;
    const userInfo = getLoggedInUser();
    if (!userInfo) {
      showToast?.('로그인 정보를 찾을 수 없습니다.', 'error');
      return;
    }
    if (equipmentDetail.EQT_LOC_TP_CD === '4') {
      showToast?.('고객사용장비는 이관할 수 없습니다.', 'warning');
      return;
    }
    setIsTransferring(true);
    try {
      const eqtSoId = equipmentDetail.SO_ID || userInfo.soId || '';
      const params = {
        SO_ID: eqtSoId,
        EQT_NO: equipmentDetail.EQT_NO || '',
        EQT_SERNO: equipmentDetail.EQT_SERNO || '',
        CHG_UID: userInfo.userId,
        MV_SO_ID: userInfo.soId || eqtSoId,
        MV_CRR_ID: userInfo.crrId || '',
        MV_WRKR_ID: userInfo.userId,
        TO_WRKR_ID: userInfo.userId,
      };
      console.log('[장비처리] 기사보유장비로 이관:', params);
      const result = await changeEquipmentWorker(params);
      console.log('[장비처리] 이관 결과:', result);
      if (result.code === 'SUCCESS' || result.MSGCODE === 'SUCCESS') {
        showToast?.('장비가 내 보유로 이관되었습니다.', 'success');
        setEquipmentDetail(null);
        setMyEquipments([]);
      } else {
        showToast?.(result.message || result.MESSAGE || '이관에 실패했습니다.', 'error');
      }
    } catch (err: any) {
      console.error('[장비처리] 이관 실패:', err);
      showToast?.(err?.message || '이관에 실패했습니다.', 'error');
    } finally {
      setIsTransferring(false);
    }
  };

  // 내 보유 장비 목록 로드 (사용자 액션 시에만 호출 - 자동 로딩 금지!)
  // 주의: useEffect 자동 로딩 제거됨 (2026-03-17)
  // 이유: 마운트 시 자동 호출 → 0건이면 SO_ID별 30+ 재시도 → 서버 과부하
  const loadMyEquipments = async () => {
    const userInfo = getLoggedInUser();
    if (!userInfo) return;

    setIsLoadingMyEquipments(true);
    try {
      // CRR_ID 필수 전송 (협력업체 ID - 장비 소속 확인용)
      const baseParams: any = { WRKR_ID: userInfo.userId };
      if (userInfo.crrId) baseParams.CRR_ID = userInfo.crrId;

      // 전체 조회 1회만 수행 (SO_ID 없이) - SO_ID별 재시도 루프 제거!
      console.log('[장비조회] 보유장비 조회:', baseParams);
      const result = await debugApiCall(
        'EquipmentList',
        'getWrkrHaveEqtList(전체)',
        () => getWrkrHaveEqtList(baseParams),
        baseParams
      );
      const allEquipments = Array.isArray(result) ? result : result?.data || [];
      console.log('[장비조회] 보유장비:', allEquipments.length, '건');
      setMyEquipments(allEquipments);
    } catch (err) {
      console.warn('내 보유 장비 로드 실패:', err);
    } finally {
      setIsLoadingMyEquipments(false);
    }
  };

  // 자동 로딩 제거 (2026-03-17): 탭 전환마다 리마운트 → 반복 호출 원인
  // 보유장비는 사용자가 검색 버튼 클릭 시에만 로드

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

    // 보유장비 목록이 없으면 먼저 1회 로드 (자동 로딩 제거 후 대체)
    if (myEquipments.length === 0 && !isLoadingMyEquipments) {
      await loadMyEquipments();
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

    // 단일 장비 검색 헬퍼 함수 (복수 결과 반환 가능)
    const searchSingleEquipment = async (val: string): Promise<{ found: boolean; equipment?: EquipmentDetail; equipments?: EquipmentDetail[]; source?: string; isMultiple?: boolean }> => {
      if (myEquipments.length > 0) {
        const foundInMy = searchInMyEquipments(val);
        if (foundInMy) return { found: true, equipment: foundInMy as EquipmentDetail, source: 'myEquipments' };
      }
      try {
        const userInfo = getLoggedInUser();
        const historyParams = { EQT_SERNO: val, SO_ID: userInfo?.soId || undefined, WRKR_ID: userInfo?.userId };
        const historyResult = await debugApiCall('EquipmentList', 'getEquipmentHistoryInfo', () => getEquipmentHistoryInfo(historyParams), historyParams);
        if (historyResult) {
          // MCONA wrapped response 이중 방어: {success, data: [...], debugLogs}
          let unwrapped = historyResult;
          if (historyResult && !Array.isArray(historyResult) && historyResult.data && Array.isArray(historyResult.data)) {
            unwrapped = historyResult.data.length === 1 ? historyResult.data[0] : historyResult.data;
          }
          const resultArray = Array.isArray(unwrapped) ? unwrapped : [unwrapped];
          if (resultArray.length > 1) {
            // 복수 결과 - 모달 표시 필요
            return { found: true, equipments: resultArray as EquipmentDetail[], source: 'getEquipmentHistoryInfo', isMultiple: true };
          } else if (resultArray.length === 1) {
            return { found: true, equipment: resultArray[0] as EquipmentDetail, source: 'getEquipmentHistoryInfo' };
          }
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

    if (result.found) {
      // 복수 결과인 경우 모달 표시
      if (result.isMultiple && result.equipments && result.equipments.length > 1) {
        setMultipleResults(result.equipments);
        setShowMultipleResultModal(true);
        setSearchValue('');
        showToast?.(`${result.equipments.length}건의 장비가 검색되었습니다. 선택해주세요.`, 'info');
        setIsLoading(false);
        return;
      }

      // 단일 결과
      const equipment = result.equipment;
      if (equipment) {
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

        {/* 장비번호 입력 + 스캔 버튼 */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
          <div className="space-y-3">
            {/* S/N + 스캔 버튼 */}
            <div className="flex items-center gap-2 overflow-hidden">
              <label className="text-xs font-medium text-gray-600 w-14 flex-shrink-0">S/N</label>
              <input
                ref={inputRef}
                type="text"
                value={searchValue}
                onChange={(e) => setSearchValue(e.target.value.toUpperCase())}
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                className="flex-1 min-w-0 px-3 py-2.5 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent uppercase transition-all font-mono"
                placeholder="S/N 또는 MAC 주소 입력"
                autoFocus
              />
              <button
                onClick={() => setShowBarcodeScanner(true)}
                className="px-4 py-2.5 bg-green-500 hover:bg-green-600 text-white rounded-lg font-semibold text-sm transition-all active:scale-[0.98] touch-manipulation flex items-center gap-1.5 flex-shrink-0"
                style={{ WebkitTapHighlightColor: 'transparent' }}
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" />
                </svg>
                스캔
              </button>
            </div>
            {/* 조회 버튼 */}
            <button
              onClick={() => handleSearch()}
              disabled={isLoading || !searchValue.trim()}
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
                        <span className="font-bold text-gray-800 text-xs sm:text-sm truncate">
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
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-8">
            <div className="text-center">
              <div className="w-16 h-16 mx-auto mb-4 bg-blue-100 rounded-full flex items-center justify-center">
                <svg className="w-8 h-8 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                </svg>
              </div>
              <p className="text-gray-500 text-sm mb-1">장비를 찾을 수 없습니다</p>
              <p className="text-gray-400 text-xs">S/N 또는 MAC 주소를 확인해주세요</p>
            </div>
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

              {/* 장비 유형 */}
              <SectionHeader title="장비 유형" />
              <InfoRow label="장비분류" value={equipmentDetail.EQT_CL_NM || equipmentDetail.EQT_CL_CD} />
              <InfoRow label="장비타입" value={equipmentDetail.EQT_TP_CD_NM || equipmentDetail.EQT_TP_CD} />
              <InfoRow label="품목코드" value={equipmentDetail.ITEM_CD} />
              <InfoRow label="품목명" value={equipmentDetail.ITEM_NM} />
              <InfoRow label="제조사" value={equipmentDetail.MAKER} />
              <InfoRow label="제조일" value={equipmentDetail.MNFCT_DT} />

              {/* 상태 정보 - 강조 박스 */}
              <div className="bg-amber-50 border-2 border-amber-400 rounded-lg p-3 -mx-4 my-3">
                <div className="bg-gradient-to-r from-amber-100 to-amber-50 px-3 py-2 -mx-3 -mt-3 mb-2 border-b border-amber-200">
                  <h4 className="text-xs font-bold text-amber-700 flex items-center gap-1">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    상태 정보
                  </h4>
                </div>
                <div className="flex border-b border-amber-200 py-1.5">
                  <span className="w-28 flex-shrink-0 text-xs text-amber-700 font-medium">장비상태</span>
                  <span className="flex-1 text-xs text-gray-900 font-medium break-all">{equipmentDetail.EQT_STAT_CD_NM || equipmentDetail.EQT_STAT_CD || '-'}</span>
                </div>
                <div className="flex border-b border-amber-200 py-1.5">
                  <span className="w-28 flex-shrink-0 text-xs text-amber-700 font-medium">사용가능여부</span>
                  <span className={`flex-1 text-xs font-bold break-all ${
                    equipmentDetail.EQT_USE_ARR_YN === 'Y' ? 'text-green-600' :
                    equipmentDetail.EQT_USE_ARR_YN === 'A' ? 'text-purple-600' :
                    equipmentDetail.EQT_USE_ARR_YN === 'N' ? 'text-red-600' : 'text-gray-900'
                  }`}>{equipmentDetail.EQT_USE_ARR_YN_NM || equipmentDetail.EQT_USE_ARR_YN || '-'}</span>
                </div>
                <div className="flex py-1.5">
                  <span className="w-28 flex-shrink-0 text-xs text-amber-700 font-medium">사용종료일</span>
                  <span className="flex-1 text-xs text-gray-900 font-medium break-all">{equipmentDetail.EQT_USE_END_DT || '-'}</span>
                </div>
              </div>

              {/* 위치 정보 */}
              <SectionHeader title="위치 정보" />
              <InfoRow label="현재위치" value={equipmentDetail.EQT_LOC_NM || equipmentDetail.EQT_LOC_TP_CD_NM} />
              <InfoRow label="이전위치" value={equipmentDetail.OLD_EQT_LOC_NM || equipmentDetail.OLD_EQT_LOC_TP_CD_NM} />

              {/* 지점/협력사 */}
              <SectionHeader title="지점/협력사" />
              <InfoRow label="지점" value={equipmentDetail.SO_NM || equipmentDetail.SO_ID} />
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

              {/* 입고 정보 */}
              <SectionHeader title="입고 정보" />
              <InfoRow label="최초입고일" value={equipmentDetail.FIRST_IN_DT} />

              {/* STB 추가 정보 */}
              <SectionHeader title="STB 추가 정보" />
              <InfoRow label="CM MAC" value={equipmentDetail.STB_CM_MAC_ADDR} />
              <InfoRow label="RTCA ID" value={equipmentDetail.STB_RTCA_ID} />

              {/* 변경 이력 */}
              <SectionHeader title="변경 이력" />
              <InfoRow label="변경종류" value={equipmentDetail.CHG_KND_CD_NM || equipmentDetail.CHG_KND_CD} />
              <InfoRow label="변경일시" value={equipmentDetail.CHG_DATE} />
              <InfoRow label="변경자" value={equipmentDetail.CHG_UID_NM || equipmentDetail.CHG_UID} />
            </div>

          </div>
        )}


        {/* 빈 상태 */}
        {!isLoading && !equipmentDetail && !error && (
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-8">
            <div className="text-center">
              <div className="w-16 h-16 mx-auto mb-4 bg-blue-100 rounded-full flex items-center justify-center">
                <svg className="w-8 h-8 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                </svg>
              </div>
              <p className="text-gray-500 text-sm mb-1">조회된 장비가 없습니다</p>
              <p className="text-gray-400 text-xs">S/N 또는 MAC 주소를 입력하고 조회하세요</p>
            </div>
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

        {/* 하단 여백 (고정 버튼 공간) */}
        {equipmentDetail && equipmentDetail.EQT_LOC_TP_CD !== '4' && <div className="h-16"></div>}

        {/* Barcode Scanner */}
        <BarcodeScanner
          isOpen={showBarcodeScanner}
          onClose={handleCloseBarcodeScanner}
          onScan={handleBarcodeScan}
          isMultiScanMode={isMultiScanMode}
          scanCount={scanAttemptCount}
        />

        {/* 복수 결과 선택 모달 */}
        {showMultipleResultModal && multipleResults.length > 0 && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm sm:max-w-md max-h-[90vh] flex flex-col">
              {/* 모달 헤더 */}
              <div className="px-4 sm:px-5 py-3 sm:py-4 border-b border-gray-100 bg-gradient-to-r from-blue-50 to-white rounded-t-2xl flex-shrink-0">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm sm:text-base font-bold text-gray-800 flex items-center gap-2">
                    <span className="text-blue-500">📋</span>
                    장비 선택
                  </h3>
                  <button
                    onClick={() => {
                      setShowMultipleResultModal(false);
                      setMultipleResults([]);
                    }}
                    className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
                <p className="text-sm text-gray-500 mt-1">
                  {multipleResults.length}건의 장비가 검색되었습니다. 하나를 선택해주세요.
                </p>
              </div>

              {/* 장비 목록 */}
              <div className="p-4 space-y-3 overflow-y-auto flex-1">
                {multipleResults.map((equipment, index) => {
                  const enrichedEquipment = enrichEquipmentData(equipment) as any;
                  // 폐기 여부 판단: EQT_STAT_CD_NM이 '폐기' 포함 또는 CHG_KND_CD_NM이 '폐기' 포함
                  const isDisposed = (enrichedEquipment.EQT_STAT_CD_NM || '').includes('폐기') ||
                                     (enrichedEquipment.CHG_KND_CD_NM || '').includes('폐기');
                  const isUsable = enrichedEquipment.EQT_USE_ARR_YN === 'Y' ||
                                   (enrichedEquipment.EQT_USE_ARR_YN_NM || '').includes('사용가능');

                  return (
                    <div
                      key={index}
                      className={`p-4 rounded-xl border-2 cursor-pointer transition-all active:scale-[0.98] ${
                        isDisposed
                          ? 'bg-red-50 border-red-200 hover:bg-red-100 hover:border-red-300'
                          : 'bg-green-50 border-green-200 hover:bg-green-100 hover:border-green-300'
                      }`}
                      onClick={() => {
                        setEquipmentDetail(enrichedEquipment);
                        setShowMultipleResultModal(false);
                        setMultipleResults([]);
                        setRawResponse({ source: 'multiple_result_selection', data: enrichedEquipment });
                        showToast?.('장비를 선택했습니다.', 'success');
                      }}
                    >
                      {/* 상태 배지 (폐기/정상) */}
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <span className={`text-xs font-bold px-2 py-1 rounded ${
                            isDisposed ? 'bg-red-500 text-white' : 'bg-green-500 text-white'
                          }`}>
                            {isDisposed ? '⛔ 폐기' : '✅ 정상'}
                          </span>
                          <span className={`text-xs px-2 py-0.5 rounded ${
                            isUsable ? 'bg-blue-100 text-blue-700' : 'bg-gray-200 text-gray-600'
                          }`}>
                            {enrichedEquipment.EQT_USE_ARR_YN_NM || (isUsable ? '사용가능' : '사용불가')}
                          </span>
                        </div>
                        <span className="text-xs text-gray-400">{index + 1}/{multipleResults.length}</span>
                      </div>

                      {/* 장비 정보 */}
                      <div className="mb-3">
                        <div className="font-bold text-gray-800 text-sm mb-1">
                          {enrichedEquipment.EQT_CL_NM || enrichedEquipment.ITEM_NM || '장비'}
                        </div>
                        <div className="text-xs text-gray-500">
                          {enrichedEquipment.ITEM_MODEL && `모델: ${enrichedEquipment.ITEM_MODEL}`}
                          {enrichedEquipment.MAKER && ` · ${enrichedEquipment.MAKER}`}
                        </div>
                      </div>

                      {/* 상세 정보 */}
                      <div className="space-y-1.5 text-xs bg-white/60 rounded-lg p-2.5">
                        <div className="flex">
                          <span className="text-gray-400 w-16 flex-shrink-0">S/N</span>
                          <span className="font-mono text-gray-800 font-medium">{enrichedEquipment.EQT_SERNO || '-'}</span>
                        </div>
                        <div className="flex">
                          <span className="text-gray-400 w-16 flex-shrink-0">장비상태</span>
                          <span className={`font-medium ${isDisposed ? 'text-red-600' : 'text-green-600'}`}>
                            {enrichedEquipment.EQT_STAT_CD_NM || '-'}
                          </span>
                        </div>
                        <div className="flex">
                          <span className="text-gray-400 w-16 flex-shrink-0">장비타입</span>
                          <span className={`${enrichedEquipment.EQT_TP_CD_NM === '불량' ? 'text-orange-600' : 'text-gray-700'}`}>
                            {enrichedEquipment.EQT_TP_CD_NM || '-'}
                          </span>
                        </div>
                        <div className="flex">
                          <span className="text-gray-400 w-16 flex-shrink-0">위치</span>
                          <span className="text-gray-700">
                            {enrichedEquipment.EQT_LOC_NM || enrichedEquipment.SO_NM || '-'}
                          </span>
                        </div>
                        <div className="flex">
                          <span className="text-gray-400 w-16 flex-shrink-0">변경이력</span>
                          <span className={`${isDisposed ? 'text-red-600 font-medium' : 'text-gray-700'}`}>
                            {enrichedEquipment.CHG_KND_CD_NM || '-'}
                          </span>
                        </div>
                        <div className="flex">
                          <span className="text-gray-400 w-16 flex-shrink-0">변경일</span>
                          <span className="text-gray-600">
                            {enrichedEquipment.CHG_DATE ? enrichedEquipment.CHG_DATE.split(' ')[0] : '-'}
                          </span>
                        </div>
                      </div>

                      {/* 선택 버튼 */}
                      <div className="flex justify-end mt-3">
                        <span className={`text-xs flex items-center gap-1 px-3 py-1.5 rounded-lg ${
                          isDisposed
                            ? 'bg-red-100 text-red-600'
                            : 'bg-green-100 text-green-600'
                        }`}>
                          이 장비 선택
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                          </svg>
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* 모달 푸터 */}
              <div className="px-5 py-3 border-t border-gray-100 bg-gray-50 rounded-b-2xl flex-shrink-0">
                <button
                  onClick={() => {
                    setShowMultipleResultModal(false);
                    setMultipleResults([]);
                  }}
                  className="w-full py-2.5 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-lg font-medium text-sm transition-all"
                >
                  취소
                </button>
              </div>
            </div>
          </div>
        )}

        {/* 기사보유장비로 이관 - 하단 고정 버튼 */}
        {equipmentDetail && equipmentDetail.EQT_LOC_TP_CD !== '4' && (
          <div className="fixed bottom-[56px] left-0 right-0 p-3 z-40" style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}>
            <button
              onClick={handleTransferToMe}
              disabled={isTransferring}
              className="w-full bg-indigo-500 hover:bg-indigo-600 disabled:bg-gray-400 text-white py-3 rounded-lg font-semibold text-sm shadow-md transition-all active:scale-[0.98] touch-manipulation flex items-center justify-center gap-2"
              style={{ WebkitTapHighlightColor: 'transparent' }}
            >
              {isTransferring ? (
                <>
                  <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  이관 중...
                </>
              ) : (
                '기사보유장비로 이관'
              )}
            </button>
          </div>
        )}
    </div>
  );
};

export default EquipmentList;
