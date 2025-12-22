import React, { useState, useEffect } from 'react';
import { getEquipmentHistoryInfo, apiRequest, getWrkrHaveEqtList } from '../../services/apiService';
import { debugApiCall } from './equipmentDebug';

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

const EquipmentList: React.FC<EquipmentListProps> = ({ onBack, showToast }) => {
  const [searchType, setSearchType] = useState<'SN' | 'MAC'>('SN');
  const [searchValue, setSearchValue] = useState('705KVQS022868'); // 테스트용 하드코딩
  const [isLoading, setIsLoading] = useState(false);
  const [equipmentDetail, setEquipmentDetail] = useState<EquipmentDetail | null>(null);
  const [rawResponse, setRawResponse] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [myEquipments, setMyEquipments] = useState<any[]>([]);
  const [isLoadingMyEquipments, setIsLoadingMyEquipments] = useState(false);

  // 복수 스캔 누적 조회 기능
  const [scannedItems, setScannedItems] = useState<EquipmentDetail[]>([]);
  const [isMultiScanMode, setIsMultiScanMode] = useState(false);

  // 뷰 모드: simple(간단히), medium(중간), detail(자세히)
  const [viewMode, setViewMode] = useState<'simple' | 'medium' | 'detail'>('simple');

  // 바코드 스캔 입력 참조
  const inputRef = React.useRef<HTMLInputElement>(null);

  // 로그인한 사용자 정보 가져오기
  const getLoggedInUser = () => {
    try {
      const userStr = localStorage.getItem('user');
      if (userStr) {
        const user = JSON.parse(userStr);
        return user.USR_ID || user.WRKR_ID || null;
      }
    } catch (e) {
      console.warn('사용자 정보 파싱 실패:', e);
    }
    return null;
  };

  // 내 보유 장비 목록 로드
  useEffect(() => {
    const loadMyEquipments = async () => {
      const wrkrId = getLoggedInUser();
      if (!wrkrId) return;

      setIsLoadingMyEquipments(true);
      try {
        const params = { WRKR_ID: wrkrId };
        const result = await debugApiCall(
          'EquipmentList',
          'getWrkrHaveEqtList',
          () => getWrkrHaveEqtList(params),
          params
        );

        if (Array.isArray(result)) {
          setMyEquipments(result);
        } else if (result && Array.isArray(result.data)) {
          setMyEquipments(result.data);
        }
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

  const handleSearch = async () => {
    if (!searchValue.trim()) {
      showToast?.('검색어를 입력해주세요.', 'warning');
      return;
    }

    setIsLoading(true);
    setError(null);
    if (!isMultiScanMode) {
      setEquipmentDetail(null);
    }
    setRawResponse(null);

    const searchVal = searchValue.toUpperCase().replace(/[:-]/g, '');
    console.log('🔍 [장비조회] 검색 시작:', { searchType, searchValue: searchVal, isMultiScanMode });

    const allResponses: any[] = [];

    // 1. 먼저 내 보유 장비에서 검색 시도
    if (myEquipments.length > 0) {
      console.log('🔍 [장비조회] 내 보유 장비에서 검색 시도...');
      const foundInMy = searchInMyEquipments(searchVal);
      if (foundInMy) {
        console.log('✅ [장비조회] 내 보유 장비에서 발견:', foundInMy);
        const equipment = foundInMy as EquipmentDetail;

        if (isMultiScanMode) {
          // 복수 스캔 모드: 목록에 추가
          const added = handleAddToScannedList(equipment);
          if (added) {
            showToast?.(`장비가 추가되었습니다. (${scannedItems.length + 1}건)`, 'success');
          }
          setSearchValue(''); // 입력 초기화
        } else {
          // 단일 조회 모드
          setEquipmentDetail(enrichEquipmentData(equipment));
          setRawResponse({ successApi: 'myEquipments', data: foundInMy, source: '내 보유 장비' });
          showToast?.('장비 정보를 조회했습니다.', 'success');
        }
        setIsLoading(false);
        return;
      }
      allResponses.push({ api: 'myEquipments', status: 'not_found' });
    }

    // 2. API를 통한 검색 시도
    const apiAttempts = [
      // 1. 장비 이력 조회 API (statistics)
      {
        name: 'getEquipmentHistoryInfo',
        call: () => getEquipmentHistoryInfo(
          searchType === 'SN' ? { EQT_SERNO: searchVal } : { MAC_ADDRESS: searchVal }
        )
      },
      // 2. EQT_NO로 직접 조회
      {
        name: 'getEquipmentHistoryInfo (EQT_NO)',
        call: () => apiRequest('/statistics/equipment/getEquipmentHistoryInfo', 'POST', {
          EQT_NO: searchVal
        })
      },
      // 3. 직접 API 호출 - SERIAL_NO 파라미터
      {
        name: 'getEquipmentHistoryInfo (SERIAL_NO)',
        call: () => apiRequest('/statistics/equipment/getEquipmentHistoryInfo', 'POST', {
          SERIAL_NO: searchVal
        })
      },
      // 4. 직접 API 호출 - MAC_ADDR 파라미터
      {
        name: 'getEquipmentHistoryInfo (MAC_ADDR)',
        call: () => apiRequest('/statistics/equipment/getEquipmentHistoryInfo', 'POST', {
          MAC_ADDR: searchVal
        })
      },
      // 5. 장비 상태 조회 API
      {
        name: 'getEquipmentStatus',
        call: () => apiRequest('/customer/equipment/getStatus', 'POST', {
          EQT_SERNO: searchVal,
          SERIAL_NO: searchVal,
          EQT_NO: searchVal
        })
      },
    ];

    for (const attempt of apiAttempts) {
      try {
        console.log(`🔍 [장비목록] ${attempt.name} 시도...`);
        const result = await attempt.call();
        console.log(`✅ [장비목록] ${attempt.name} 응답:`, result);

        allResponses.push({ api: attempt.name, response: result });

        // 유효한 응답인지 확인
        if (result && typeof result === 'object') {
          // 에러 응답이 아니고 데이터가 있으면 성공
          if (!result.code || result.code === 'SUCCESS') {
            // 배열이면 첫 번째 항목 사용
            const data = Array.isArray(result) ? result[0] : result;
            if (data && Object.keys(data).length > 0 && !data.code) {
              const equipment = data as EquipmentDetail;

              if (isMultiScanMode) {
                // 복수 스캔 모드: 목록에 추가
                const added = handleAddToScannedList(equipment);
                if (added) {
                  showToast?.(`장비가 추가되었습니다. (${scannedItems.length + 1}건)`, 'success');
                }
                setSearchValue(''); // 입력 초기화
              } else {
                // 단일 조회 모드
                setEquipmentDetail(enrichEquipmentData(equipment));
                setRawResponse({ successApi: attempt.name, data: result, allAttempts: allResponses });
                showToast?.('장비 정보를 조회했습니다.', 'success');
              }
              setIsLoading(false);
              return;
            }
          }
        }
      } catch (err: any) {
        console.warn(`⚠️ [장비목록] ${attempt.name} 실패:`, err.message);
        allResponses.push({ api: attempt.name, error: err.message });
      }
    }

    // 모든 시도 실패
    if (isMultiScanMode) {
      setSearchValue(''); // 입력 초기화
      showToast?.('장비를 찾을 수 없습니다. S/N을 확인해주세요.', 'error');
    } else {
      setRawResponse({ allAttempts: allResponses });
      setError('장비 정보를 찾을 수 없습니다. S/N 또는 MAC 주소를 확인해주세요.\n\n참고: 현재 장비 원장 조회 API가 정상 동작하지 않습니다. 내 보유 장비에서만 검색이 가능합니다.');
      showToast?.('장비 정보를 찾을 수 없습니다.', 'error');
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
    setScannedItems(prev => prev.filter((_, i) => i !== index));
  };

  // 스캔 목록 초기화
  const handleClearScannedItems = () => {
    setScannedItems([]);
    setEquipmentDetail(null);
    showToast?.('스캔 목록이 초기화되었습니다.', 'info');
  };

  // 복수 스캔 모드에서 장비 추가
  const handleAddToScannedList = (equipment: EquipmentDetail) => {
    // 중복 체크
    const isDuplicate = scannedItems.some(
      item => item.EQT_SERNO === equipment.EQT_SERNO || item.EQT_NO === equipment.EQT_NO
    );
    if (isDuplicate) {
      showToast?.('이미 스캔된 장비입니다.', 'warning');
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

        {/* 복수 스캔 모드 토글 */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-gray-700">복수 스캔 모드</span>
              <span className="text-xs text-gray-500">(바코드 연속 스캔)</span>
            </div>
            <button
              onClick={() => setIsMultiScanMode(!isMultiScanMode)}
              className={`relative w-12 h-6 rounded-full transition-colors ${
                isMultiScanMode ? 'bg-blue-500' : 'bg-gray-300'
              }`}
              style={{ WebkitTapHighlightColor: 'transparent' }}
            >
              <span
                className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${
                  isMultiScanMode ? 'translate-x-6' : ''
                }`}
              />
            </button>
          </div>
          {isMultiScanMode && scannedItems.length > 0 && (
            <div className="mt-3 flex items-center justify-between pt-3 border-t border-gray-100">
              <span className="text-xs text-blue-600 font-medium">
                스캔된 장비: {scannedItems.length}건
              </span>
              <button
                onClick={handleClearScannedItems}
                className="text-xs text-red-500 hover:text-red-700 transition-colors"
              >
                목록 초기화
              </button>
            </div>
          )}
        </div>

        {/* 검색 영역 */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
          <div className="space-y-3">
            {/* 검색 타입 선택 */}
            <div className="flex gap-2">
              <button
                onClick={() => setSearchType('SN')}
                className={`flex-1 py-2.5 rounded-lg text-sm font-medium transition-all active:scale-[0.98] touch-manipulation ${
                  searchType === 'SN'
                    ? 'bg-blue-500 text-white shadow-sm'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
                style={{ WebkitTapHighlightColor: 'transparent' }}
              >
                S/N (바코드)
              </button>
              <button
                onClick={() => setSearchType('MAC')}
                className={`flex-1 py-2.5 rounded-lg text-sm font-medium transition-all active:scale-[0.98] touch-manipulation ${
                  searchType === 'MAC'
                    ? 'bg-blue-500 text-white shadow-sm'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
                style={{ WebkitTapHighlightColor: 'transparent' }}
              >
                MAC 주소
              </button>
            </div>

            {/* 검색 입력 */}
            <div>
              <input
                ref={inputRef}
                type="text"
                value={searchValue}
                onChange={(e) => handleBarcodeInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent uppercase font-mono transition-all"
                placeholder={searchType === 'SN' ? (isMultiScanMode ? '바코드 스캔하면 자동 추가됩니다' : '바코드 스캔 또는 S/N 입력') : '예: 481B40B6F453'}
                autoFocus
              />
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
              ) : isMultiScanMode ? (
                '스캔'
              ) : (
                '조회'
              )}
            </button>
          </div>
        </div>

        {/* 복수 스캔 모드: 스캔된 장비 목록 */}
        {isMultiScanMode && scannedItems.length > 0 && (
          <div className="bg-white rounded-xl border border-blue-200 shadow-sm p-4">
            <h3 className="text-sm font-bold text-blue-700 mb-3 flex items-center gap-2">
              <span>스캔된 장비 목록</span>
              <span className="bg-blue-100 text-blue-600 px-2 py-0.5 rounded-full text-xs">
                {scannedItems.length}건
              </span>
            </h3>
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {scannedItems.map((item, index) => (
                <div
                  key={index}
                  className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border border-gray-100"
                >
                  <div className="flex-1">
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
                  <button
                    onClick={() => handleRemoveScannedItem(index)}
                    className="text-red-400 hover:text-red-600 p-1.5 hover:bg-red-50 rounded-lg transition-colors"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 에러 메시지 */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-4">
            <p className="text-xs text-red-600">{error}</p>
          </div>
        )}

        {/* 장비 상세 정보 */}
        {equipmentDetail && (
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
            {/* 헤더 + 뷰 모드 선택 */}
            <div className="p-4 border-b border-gray-100">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-bold text-gray-800 flex items-center gap-2">
                  <span className="text-blue-500">📦</span> 장비 상세 정보
                </h3>
                <span className={`px-2 py-1 rounded-full text-xs font-semibold ${
                  equipmentDetail.EQT_STAT_CD === '10' ? 'bg-green-100 text-green-700' :
                  equipmentDetail.EQT_STAT_CD === '20' ? 'bg-blue-100 text-blue-700' :
                  equipmentDetail.EQT_STAT_CD === '40' ? 'bg-amber-100 text-amber-700' :
                  'bg-gray-100 text-gray-700'
                }`}>
                  {equipmentDetail.EQT_STAT_CD_NM || getEqtStatName(equipmentDetail.EQT_STAT_CD)}
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

            {/* 간단히 보기: 품목명 + 상태 */}
            {viewMode === 'simple' && (
              <div className="p-4">
                <div className="bg-gradient-to-r from-blue-50 to-white rounded-xl p-4 border border-blue-100">
                  <div className="text-center">
                    <div className="text-lg font-bold text-gray-800 mb-2">
                      {equipmentDetail.ITEM_NM || equipmentDetail.EQT_CL_NM || '장비'}
                    </div>
                    <div className="text-sm text-gray-500 mb-3">
                      {equipmentDetail.EQT_TP_CD_NM || equipmentDetail.EQT_CL_CD}
                    </div>
                    <div className="inline-flex items-center gap-2 bg-white px-4 py-2 rounded-full shadow-sm">
                      <span className="text-xs text-gray-500">상태</span>
                      <span className={`px-3 py-1 rounded-full text-sm font-bold ${
                        equipmentDetail.EQT_STAT_CD === '10' ? 'bg-green-100 text-green-700' :
                        equipmentDetail.EQT_STAT_CD === '20' ? 'bg-blue-100 text-blue-700' :
                        equipmentDetail.EQT_STAT_CD === '40' ? 'bg-amber-100 text-amber-700' :
                        'bg-gray-100 text-gray-700'
                      }`}>
                        {equipmentDetail.EQT_STAT_CD_NM || getEqtStatName(equipmentDetail.EQT_STAT_CD)}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* 중간 보기: 기본 정보 + S/N + MAC + 위치 */}
            {viewMode === 'medium' && (
              <div className="p-4 space-y-3">
                {/* 품목 정보 카드 */}
                <div className="bg-gradient-to-r from-blue-50 to-white rounded-lg p-3 border border-blue-100">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-sm font-bold text-gray-800">
                        {equipmentDetail.ITEM_NM || equipmentDetail.EQT_CL_NM || '장비'}
                      </div>
                      <div className="text-xs text-gray-500 mt-0.5">
                        {equipmentDetail.EQT_TP_CD_NM || equipmentDetail.EQT_CL_CD}
                      </div>
                    </div>
                    <span className={`px-2 py-1 rounded-full text-xs font-semibold ${
                      equipmentDetail.EQT_STAT_CD === '10' ? 'bg-green-100 text-green-700' :
                      equipmentDetail.EQT_STAT_CD === '20' ? 'bg-blue-100 text-blue-700' :
                      'bg-gray-100 text-gray-700'
                    }`}>
                      {equipmentDetail.EQT_STAT_CD_NM || getEqtStatName(equipmentDetail.EQT_STAT_CD)}
                    </span>
                  </div>
                </div>

                {/* 핵심 정보 그리드 */}
                <div className="bg-gray-50 rounded-lg p-3 space-y-2">
                  <div className="grid grid-cols-2 gap-3 text-xs">
                    <div>
                      <span className="text-gray-400 block mb-0.5">S/N (일련번호)</span>
                      <span className="font-mono text-gray-900 font-medium">{equipmentDetail.EQT_SERNO || '-'}</span>
                    </div>
                    <div>
                      <span className="text-gray-400 block mb-0.5">MAC 주소</span>
                      <span className="font-mono text-gray-700">{equipmentDetail.MAC_ADDRESS || '-'}</span>
                    </div>
                    <div>
                      <span className="text-gray-400 block mb-0.5">현재 위치</span>
                      <span className="text-gray-700">{equipmentDetail.EQT_LOC_TP_CD_NM || getEqtLocTpName(equipmentDetail.EQT_LOC_TP_CD) || '-'}</span>
                    </div>
                    <div>
                      <span className="text-gray-400 block mb-0.5">보유기사</span>
                      <span className="text-gray-700">
                        {(() => {
                          const worker = parseWorkerFromLocNm(equipmentDetail.EQT_LOC_NM);
                          if (worker.id) {
                            return `${worker.name} (${worker.id})`;
                          }
                          return equipmentDetail.WRKR_NM || equipmentDetail.WRKR_ID || '-';
                        })()}
                      </span>
                    </div>
                    <div>
                      <span className="text-gray-400 block mb-0.5">지점</span>
                      <span className="text-gray-700">{equipmentDetail.SO_NM || equipmentDetail.SO_ID || '-'}</span>
                    </div>
                    <div>
                      <span className="text-gray-400 block mb-0.5">사용상태</span>
                      <span className="text-gray-700">{equipmentDetail.EQT_USE_STAT_CD_NM || equipmentDetail.EQT_USE_ARR_YN_NM || '-'}</span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* 자세히 보기: 전체 정보 */}
            {viewMode === 'detail' && (
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
            )}
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
    </div>
  );
};

export default EquipmentList;
