import React, { useState, useEffect } from 'react';
import { findUserList, searchWorkersByName, getWrkrHaveEqtListAll as getWrkrHaveEqtList, changeEquipmentWorker, getEquipmentHistoryInfo, saveTransferredEquipment, getEqtMasterInfo, getEquipmentTypeList } from '../../services/apiService';
import { debugApiCall } from './equipmentDebug';
import { Search, ChevronDown, ChevronUp, Check, X, User, RotateCcw, AlertTriangle } from 'lucide-react';
import BarcodeScanner from './BarcodeScanner';
import BaseModal from '../common/BaseModal';

// 장비 중분류 코드 (ITEM_MID_CD) - 장비조회와 동일
const ITEM_MID_OPTIONS = [
  { code: '', name: '전체' },
  { code: '02', name: '모뎀' },
  { code: '03', name: 'CVT' },
  { code: '04', name: 'STB' },
  { code: '05', name: 'Smart card' },
  { code: '06', name: '캐치온필터' },
  { code: '07', name: 'Cable Card' },
  { code: '08', name: 'IP폰' },
  { code: '10', name: '유무선공유기(AP)' },
  { code: '23', name: 'OTT_STB(체험형)' },
];

// MAC address format (XX:XX:XX:XX:XX:XX)
const formatMac = (mac: string | null | undefined): string => {
  if (!mac) return '-';
  const cleaned = mac.replace(/[^A-Fa-f0-9]/g, '');
  if (cleaned.length !== 12) return mac;
  return cleaned.match(/.{2}/g)?.join(':') || mac;
};

// Date format (YYYY.MM.DD)
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

// Date format (YYYY-MM-DD)
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


// 레거시 방식: 타지점 이동 제한 지점 (경기동부, 강남방송, 서초지점)
const RESTRICTED_SO_IDS = ['401', '402', '328'];
const RESTRICTED_SO_NAMES: { [key: string]: string } = {
  '401': '경기동부',
  '402': '강남방송',
  '328': '서초지점'
};

interface EquipmentMovementProps {
  onBack: () => void;
}

interface EqtTrns {
  CHK: boolean;
  EQT_NO: string;
  ITEM_MAX_NM: string;
  ITEM_MID_CD: string;    // 중분류 코드 (모델2 필터용)
  ITEM_MID_NM: string;
  EQT_CL_CD: string;
  EQT_CL_NM: string;
  ITEM_NM: string;
  ITEM_SPEC: string;
  MST_SO_ID: string;
  MST_SO_NM: string;
  SO_ID: string;
  SO_NM: string;
  EQT_SERNO: string;
  MAC_ADDRESS: string;
  TA_MAC_ADDRESS: string;
  WRKR_NM: string;
  CRR_NM: string;
  isScanned?: boolean;
  isTransferable?: boolean;  // 이관 가능 여부 (장비의 SO_ID가 사용자의 AUTH_SO_List에 있는지)
  // 통일된 간단히/자세히 형식용 필드 (실제 API 응답 필드명)
  EQT_USE_ARR_YN?: string;
  EQT_USE_END_DT?: string;      // 사용가능일자
  EQT_STAT_CD_NM?: string;      // 장비상태 (API: EQT_STAT_CD_NM)
  CHG_KND_NM?: string;          // 변경유형 (API: CHG_KND_NM)
  EQT_LOC_TP_NM?: string;       // 장비위치유형
  EQT_LOC_NM?: string;          // 장비위치
  OLD_EQT_LOC_NM?: string;      // 이전장비위치 (API: OLD_EQT_LOC_NM)
}

interface SoListItem {
  SO_ID: string;
  SO_NM: string;
}

interface CorpListItem {
  CRR_ID: string;
  CORP_NM: string;
}

// Transfer result interface
interface TransferResult {
  success: { EQT_SERNO: string; EQT_NO: string; ITEM_NM: string }[];
  failed: { EQT_SERNO: string; EQT_NO: string; ITEM_NM: string; error: string }[];
}

// 기사 검색 결과 모달
const WorkerSearchModal: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  onSelect: (worker: { USR_ID: string; USR_NM: string }) => void;
  workers: { USR_ID: string; USR_NM: string }[];
  title: string;
}> = ({ isOpen, onClose, onSelect, workers, title }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-sm max-h-[80vh] overflow-hidden">
        <div className="p-4 border-b border-gray-100 bg-gradient-to-r from-blue-500 to-blue-600">
          <h3 className="font-semibold text-white">{title}</h3>
          <p className="text-xs text-white/80 mt-1">{workers.length}명 검색됨</p>
        </div>
        <div className="max-h-64 overflow-y-auto">
          {workers.map((worker, idx) => (
            <button
              key={idx}
              onClick={() => { onSelect(worker); onClose(); }}
              className="w-full px-4 py-3 text-left hover:bg-blue-50 border-b border-gray-50 flex justify-between items-center transition-colors active:bg-blue-100 touch-manipulation"
            >
              <span className="font-medium text-gray-900">{worker.USR_NM}</span>
              <span className="text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded">{worker.USR_ID}</span>
            </button>
          ))}
        </div>
        <div className="p-3 border-t border-gray-100 bg-gray-50">
          <button onClick={onClose} className="w-full py-2.5 text-sm text-gray-600 hover:bg-gray-200 rounded-lg font-medium transition-colors">
            닫기
          </button>
        </div>
      </div>
    </div>
  );
};

const EquipmentMovement: React.FC<EquipmentMovementProps> = ({ onBack }) => {
  // 로그인한 사용자 = 이관기사 (장비를 인수받는 사람)
  const [loggedInUser, setLoggedInUser] = useState<{ userId: string; userName: string; soId: string; crrId: string }>({
    userId: '', userName: '', soId: '', crrId: ''
  });

  // 보유기사 정보 (타 기사 = 장비를 넘겨주는 사람)
  const [workerInfo, setWorkerInfo] = useState<{ WRKR_ID: string; WRKR_NM: string; SO_ID: string; CRR_ID: string }>({
    WRKR_ID: '', WRKR_NM: '', SO_ID: '', CRR_ID: ''
  });

  const [eqtTrnsList, setEqtTrnsList] = useState<EqtTrns[]>([]);
  const [soList, setSoList] = useState<SoListItem[]>([]);
  const [corpList, setCorpList] = useState<CorpListItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [scannedSerials, setScannedSerials] = useState<string[]>([]); // 스캔된 S/N 목록

  const [workerModalOpen, setWorkerModalOpen] = useState(false);
  const [showBarcodeScanner, setShowBarcodeScanner] = useState(false);
  const [searchedWorkers, setSearchedWorkers] = useState<{
    USR_ID: string;
    USR_NM: string;
    CRR_ID?: string;
    SO_ID?: string;
    SO_NM?: string;      // 지점명
    CORP_NM?: string;    // 파트너사명
    EQT_COUNT?: number;  // 보유장비 수
  }[]>([]);


  // 장비번호 입력
  const [serialInput, setSerialInput] = useState<string>('');

  // 이동 결과
  const [transferResult, setTransferResult] = useState<TransferResult | null>(null);
  const [showResultModal, setShowResultModal] = useState(false);

  // 종류별 접기/펼치기 상태
  const [collapsedCategories, setCollapsedCategories] = useState<Set<string>>(new Set());

  // 뷰 모드: simple(간단히), detail(자세히)
  const [viewMode, setViewMode] = useState<'simple' | 'detail'>('simple');

  // 조회 완료 상태 (결과 표시 여부)
  const [hasSearched, setHasSearched] = useState(false);

  // 기사 검색 팝업 상태
  const [workerSearchKeyword, setWorkerSearchKeyword] = useState('');
  const [isSearchingWorker, setIsSearchingWorker] = useState(false);

  // 모달 내 장비 선택 상태
  const [modalSelectedWorker, setModalSelectedWorker] = useState<{ USR_ID: string; USR_NM: string; CRR_ID?: string } | null>(null);
  const [modalEquipmentList, setModalEquipmentList] = useState<EqtTrns[]>([]);
  const [isLoadingModalEquipment, setIsLoadingModalEquipment] = useState(false);
  const [modalModelFilter, setModalModelFilter] = useState<string>('');  // 모델 필터 (빈값=전체)
  const [modalSearchModelFilter, setModalSearchModelFilter] = useState<string>('');  // 검색 시 모델 필터

  // 이관지점 선택 (AUTH_SO_List 기반)
  const [userAuthSoList, setUserAuthSoList] = useState<{ SO_ID: string; SO_NM: string }[]>([]);
  const [targetSoId, setTargetSoId] = useState<string>('');

  // 이관 확인 모달
  const [showTransferModal, setShowTransferModal] = useState(false);

  // 모델 필터 (중분류, 소분류)
  const [selectedItemMidCd, setSelectedItemMidCd] = useState<string>('');  // 중분류 (ITEM_MID_CD)
  const [selectedEqtClCd, setSelectedEqtClCd] = useState<string>('');      // 소분류 (EQT_CL_CD)
  const [eqtClOptions, setEqtClOptions] = useState<{ code: string; name: string }[]>([]);  // 소분류 옵션 (동적 로드)
  const [isLoadingEqtCl, setIsLoadingEqtCl] = useState(false);             // 소분류 로딩 상태

  // 고객사용중 장비 팝업
  const [showCustomerEquipmentModal, setShowCustomerEquipmentModal] = useState(false);
  const [customerEquipmentInfo, setCustomerEquipmentInfo] = useState<any>(null);

  // 조회 조건 메시지 (결과 없을 때 표시용)
  const [searchConditionMessage, setSearchConditionMessage] = useState<string>('');

  // 선택 모드: 'none' | 'restricted-{soId}' | 'normal'
  // 제한지점(401,402,328) 장비 선택 시 해당 지점만 선택 가능
  // 일반지점 장비 선택 시 제한지점 장비 선택 불가
  const [selectionMode, setSelectionMode] = useState<string>('none');

  useEffect(() => {
    loadInitialData();
  }, []);

  // 중분류(모델1) 변경 시 소분류(모델2) 목록 API로 로드
  useEffect(() => {
    // 중분류 선택 해제 시 소분류도 초기화
    if (!selectedItemMidCd) {
      setEqtClOptions([]);
      setSelectedEqtClCd('');
      return;
    }

    // API로 소분류 목록 가져오기
    const loadEqtClOptions = async () => {
      setIsLoadingEqtCl(true);
      try {
        const result = await getEquipmentTypeList({ ITEM_MID_CD: selectedItemMidCd });
        if (result && Array.isArray(result) && result.length > 0) {
          // API 응답에서 소분류 목록 추출 (중복 제거)
          const uniqueEqtCl = new Map<string, string>();
          result.forEach((item: any) => {
            if (item.EQT_CL_CD && item.EQT_CL_NM) {
              uniqueEqtCl.set(item.EQT_CL_CD, item.EQT_CL_NM);
            }
          });

          const options = Array.from(uniqueEqtCl.entries()).map(([code, name]) => ({
            code,
            name
          })).sort((a, b) => a.name.localeCompare(b.name));

          setEqtClOptions(options);
          console.log('[장비이동] 소분류 목록 로드:', options.length, '개');
        } else {
          // API 결과가 없으면 장비 목록에서 추출 시도
          const uniqueEqtCl = new Map<string, string>();
          eqtTrnsList.forEach(item => {
            if (item.ITEM_MID_CD === selectedItemMidCd && item.EQT_CL_CD && item.EQT_CL_NM) {
              uniqueEqtCl.set(item.EQT_CL_CD, item.EQT_CL_NM);
            }
          });

          const options = Array.from(uniqueEqtCl.entries()).map(([code, name]) => ({
            code,
            name
          })).sort((a, b) => a.name.localeCompare(b.name));

          setEqtClOptions(options);
          console.log('[장비이동] 소분류 목록 (장비 목록에서 추출):', options.length, '개');
        }
      } catch (error) {
        console.error('[장비이동] 소분류 목록 로드 실패:', error);
        // 실패 시 장비 목록에서 추출
        const uniqueEqtCl = new Map<string, string>();
        eqtTrnsList.forEach(item => {
          if (item.ITEM_MID_CD === selectedItemMidCd && item.EQT_CL_CD && item.EQT_CL_NM) {
            uniqueEqtCl.set(item.EQT_CL_CD, item.EQT_CL_NM);
          }
        });

        const options = Array.from(uniqueEqtCl.entries()).map(([code, name]) => ({
          code,
          name
        })).sort((a, b) => a.name.localeCompare(b.name));

        setEqtClOptions(options);
      } finally {
        setIsLoadingEqtCl(false);
      }
    };

    loadEqtClOptions();

    // 중분류 변경 시 소분류 선택 초기화
    setSelectedEqtClCd('');
  }, [selectedItemMidCd]);

  // 선택된 장비 기준으로 선택 모드 결정
  const getSelectionModeFromCheckedItems = (items: EqtTrns[]): string => {
    const checkedItems = items.filter(item => item.CHK);
    if (checkedItems.length === 0) return 'none';

    const firstItem = checkedItems[0];
    const firstSoId = firstItem.SO_ID || '';

    if (RESTRICTED_SO_IDS.includes(firstSoId)) {
      return `restricted-${firstSoId}`;
    }
    return 'normal';
  };

  // 현재 선택 모드에서 해당 장비 선택 가능 여부 판단
  const canSelectItem = (item: EqtTrns, currentMode: string): boolean => {
    const itemSoId = item.SO_ID || '';
    const isRestrictedItem = RESTRICTED_SO_IDS.includes(itemSoId);

    if (currentMode === 'none') return true;  // 아무것도 선택 안됨

    if (currentMode.startsWith('restricted-')) {
      // 제한 지점 모드: 같은 지점만 선택 가능
      const restrictedSoId = currentMode.replace('restricted-', '');
      return itemSoId === restrictedSoId;
    }

    // normal 모드: 제한 지점 장비 선택 불가
    return !isRestrictedItem;
  };

  // 선택 모드에 따라 이관 가능한 지점 목록 계산
  const getAvailableTargetSoList = (): { SO_ID: string; SO_NM: string }[] => {
    const checkedItems = eqtTrnsList.filter(item => item.CHK);
    if (checkedItems.length === 0) return userAuthSoList;

    const firstItem = checkedItems[0];
    const firstSoId = firstItem.SO_ID || '';

    if (RESTRICTED_SO_IDS.includes(firstSoId)) {
      // 제한 지점 장비 선택됨 → 해당 지점만 이관 가능
      return userAuthSoList.filter(so => so.SO_ID === firstSoId);
    }

    // 일반 지점 장비 선택됨 → 제한 지점 제외
    return userAuthSoList.filter(so => !RESTRICTED_SO_IDS.includes(so.SO_ID));
  };

  // selectionMode 변경 시 이관 가능 여부 재계산
  useEffect(() => {
    if (eqtTrnsList.length > 0) {
      setEqtTrnsList(prev => prev.map(item => {
        const canSelect = canSelectItem(item, selectionMode);
        return {
          ...item,
          isTransferable: canSelect,
          CHK: canSelect ? item.CHK : false  // 선택 불가 장비는 체크 해제
        };
      }));
    }
    // 모달 내 장비 목록도 재계산
    if (modalEquipmentList.length > 0) {
      setModalEquipmentList(prev => prev.map(item => {
        const canSelect = canSelectItem(item, selectionMode);
        return {
          ...item,
          isTransferable: canSelect,
          CHK: canSelect ? item.CHK : false
        };
      }));
    }
  }, [selectionMode]);

  // 이관지점 자동 설정 (선택 모드 변경 시)
  useEffect(() => {
    if (selectionMode.startsWith('restricted-')) {
      // 제한 지점 모드: 해당 지점으로 자동 설정
      const restrictedSoId = selectionMode.replace('restricted-', '');
      setTargetSoId(restrictedSoId);
    } else if (selectionMode === 'normal') {
      // 일반 모드: 제한 지점이 아닌 첫 번째 지점으로 설정
      const availableSo = userAuthSoList.find(so => !RESTRICTED_SO_IDS.includes(so.SO_ID));
      if (availableSo) {
        setTargetSoId(availableSo.SO_ID);
      }
    }
  }, [selectionMode, userAuthSoList]);

  const loadInitialData = async () => {
    try {
      const userInfo = localStorage.getItem('userInfo');
      if (userInfo) {
        const user = JSON.parse(userInfo);
        // AUTH_SO_List 저장
        const authList = (user.authSoList && Array.isArray(user.authSoList)) ? user.authSoList : [];
        setUserAuthSoList(authList);
        
        // soId가 없으면 AUTH_SO_List의 첫 번째 항목 사용
        let userSoId = user.soId || '';
        if (!userSoId && authList.length > 0) {
          userSoId = authList[0].SO_ID || '';
        }
        setLoggedInUser({
          userId: user.userId || '',
          userName: user.userName || '',
          soId: userSoId,
          crrId: user.crrId || ''
        });
        
        // 기본 이관지점 설정
        if (authList.length > 0) {
          setTargetSoId(authList[0].SO_ID || '');
        }
      }
    } catch (e) { console.warn('사용자 정보 파싱 실패:', e); }
    await loadDropdownData();
  };

  const loadDropdownData = async () => {
    const userInfo = localStorage.getItem('userInfo');
    const branchList = localStorage.getItem('branchList');
    if (userInfo) {
      try {
        const user = JSON.parse(userInfo);
        let soListData: { SO_ID: string; SO_NM: string }[] = [];

        if (user.authSoList && Array.isArray(user.authSoList) && user.authSoList.length > 0) {
          soListData = user.authSoList;
        } else if (branchList) {
          try {
            const parsed = JSON.parse(branchList);
            if (Array.isArray(parsed) && parsed.length > 0) soListData = parsed;
          } catch (e) { }
        }
        if (soListData.length === 0 && user.soId) {
          soListData = [{ SO_ID: user.soId, SO_NM: user.soNm || `지점(${user.soId})` }];
        }
        if (soListData.length > 0) {
          setSoList(soListData);
          // 기본 지점 설정
          setWorkerInfo(prev => ({ ...prev, SO_ID: soListData[0].SO_ID }));
        }
        if (user.crrId) {
          setCorpList([{ CRR_ID: user.crrId, CORP_NM: user.crrNm || user.corpNm || `협력업체(${user.crrId})` }]);
          setWorkerInfo(prev => ({ ...prev, CRR_ID: user.crrId }));
        }
      } catch (e) { console.warn('사용자 정보 파싱 실패:', e); }
    }
  };

    // 바코드 스캔 시 - S/N만 저장 (조회 버튼 눌러야 조회됨)
  const handleBarcodeScan = async (serialNo: string) => {
    const normalizedSN = serialNo.toUpperCase().replace(/[:-]/g, '');

    // 이미 스캔된 장비인지 확인 (중복 제거)
    if (scannedSerials.includes(normalizedSN)) {
      alert('이미 스캔된 장비입니다.');
      return;
    }

    // S/N만 저장, 스캐너 닫기
    setScannedSerials(prev => [...new Set([normalizedSN, ...prev])]);
    setShowBarcodeScanner(false);
  };

  // 스캔된 장비로 보유기사 조회
  const handleScannedSearch = async () => {
    if (scannedSerials.length === 0) {
      alert('스캔된 장비가 없습니다.');
      return;
    }

    setIsLoading(true);
    try {
      // 첫 번째 스캔된 S/N으로 장비 정보 조회
      const firstSN = scannedSerials[0];
      const eqtResult = await debugApiCall('EquipmentMovement', 'getEquipmentHistoryInfo',
        () => getEquipmentHistoryInfo({ EQT_SERNO: firstSN }),
        { EQT_SERNO: firstSN }
      );

      if (eqtResult && eqtResult.length > 0) {
        const eqt = eqtResult[0];
        // WRKR_ID 추출: 직접 필드 또는 EQT_LOC_NM에서 추출 (형식: "이름(ID)")
        let ownerWrkrId = eqt.WRKR_ID || eqt.OWNER_WRKR_ID;
        if (!ownerWrkrId && eqt.EQT_LOC_NM) {
          const match = eqt.EQT_LOC_NM.match(/\(([A-Z]\d+)\)$/);
          if (match) ownerWrkrId = match[1];
        }
        const ownerWrkrNm = eqt.WRKR_NM || eqt.OWNER_WRKR_NM || '알수없음';
        const ownerCrrId = eqt.CRR_ID || '';

        if (ownerWrkrId) {
          setWorkerInfo(prev => ({ ...prev, WRKR_ID: ownerWrkrId, WRKR_NM: ownerWrkrNm, CRR_ID: ownerCrrId }));
          await searchEquipmentByWorker(ownerWrkrId, ownerWrkrNm, ownerCrrId, firstSN);
          setHasSearched(true);
        } else {
          alert(`장비(${firstSN})의 보유기사 정보가 없습니다.`);
        }
      } else {
        alert(`장비(${firstSN})를 찾을 수 없습니다.`);
      }
    } catch (error) {
      console.error('장비 조회 실패:', error);
      alert('장비 조회에 실패했습니다.');
    } finally {
      setIsLoading(false);
    }
  };

  // 장비번호 검색 - 직접 조회
  const handleSerialSearch = async () => {
    const normalizedSN = serialInput.trim().toUpperCase().replace(/[:-]/g, '');
    if (!normalizedSN) {
      alert('장비번호(S/N)를 입력해주세요.');
      return;
    }

    setIsLoading(true);
    try {
      // 장비 정보로 보유기사 조회
      const eqtResult = await debugApiCall('EquipmentMovement', 'getEquipmentHistoryInfo',
        () => getEquipmentHistoryInfo({ EQT_SERNO: normalizedSN }),
        { EQT_SERNO: normalizedSN }
      );

      // API가 단일 객체 또는 배열 반환 가능
      const eqt = Array.isArray(eqtResult) ? eqtResult[0] : eqtResult;

      if (eqt && eqt.EQT_SERNO) {
        // 고객사용중(EQT_LOC_TP_CD='4') 또는 협력업체(EQT_LOC_TP_CD_NM='협력업체') 체크
        const eqtLocTpCd = eqt.EQT_LOC_TP_CD || '';
        const eqtLocTpNm = eqt.EQT_LOC_TP_CD_NM || eqt.EQT_LOC_TP_NM || '';

        if (eqtLocTpCd === '4') {
          // 고객사용중 장비 - 팝업으로 정보 표시
          setCustomerEquipmentInfo({
            EQT_SERNO: eqt.EQT_SERNO,
            EQT_NO: eqt.EQT_NO || '',
            ITEM_NM: eqt.ITEM_NM || eqt.EQT_CL_NM || '',
            ITEM_MID_NM: eqt.ITEM_MID_NM || '',
            SO_NM: eqt.SO_NM || '',
            EQT_LOC_NM: eqt.EQT_LOC_NM || '',
            EQT_LOC_TP_NM: '고객사용중',
            MAC_ADDRESS: eqt.MAC_ADDRESS || '',
            WRKR_NM: eqt.WRKR_NM || eqt.OWNER_WRKR_NM || '-'
          });
          setShowCustomerEquipmentModal(true);
          setIsLoading(false);
          setSerialInput('');
          return;
        }

        // WRKR_ID 추출: 직접 필드 또는 EQT_LOC_NM에서 추출 (형식: "이름(ID)")
        let ownerWrkrId = eqt.WRKR_ID || eqt.OWNER_WRKR_ID;
        if (!ownerWrkrId && eqt.EQT_LOC_NM) {
          // EQT_LOC_NM: "오현민(할당불가)(A20117965)" -> A20117965 추출
          const match = eqt.EQT_LOC_NM.match(/\(([A-Z]\d+)\)$/);
          if (match) ownerWrkrId = match[1];
        }
        const ownerWrkrNm = eqt.WRKR_NM || eqt.OWNER_WRKR_NM || '알수없음';
        const ownerCrrId = eqt.CRR_ID || '';

        if (ownerWrkrId) {
          setScannedSerials([normalizedSN]);
          setWorkerInfo(prev => ({ ...prev, WRKR_ID: ownerWrkrId, WRKR_NM: ownerWrkrNm, CRR_ID: ownerCrrId }));
          await searchEquipmentByWorker(ownerWrkrId, ownerWrkrNm, ownerCrrId, normalizedSN);
          setHasSearched(true);
        } else {
          // 보유기사 없는 장비 - getEqtMasterInfo로 추가 정보 조회 후 표시
          console.log('[장비이동] 보유기사 없는 장비:', normalizedSN, '위치:', eqtLocTpNm);

          // 장비 마스터 정보 조회 시도
          try {
            const masterInfo = await getEqtMasterInfo({ EQT_SERNO: normalizedSN });
            const masterData = Array.isArray(masterInfo) ? masterInfo[0] : masterInfo;

            // 위치 정보 표시
            const locInfo = masterData?.EQT_LOC_TP_NM || eqtLocTpNm || '알수없음';
            const displayLoc = locInfo === '협력업체' ? '협력업체' : locInfo;

            setCustomerEquipmentInfo({
              EQT_SERNO: normalizedSN,
              EQT_NO: masterData?.EQT_NO || eqt.EQT_NO || '',
              ITEM_NM: masterData?.ITEM_NM || eqt.ITEM_NM || eqt.EQT_CL_NM || '',
              ITEM_MID_NM: masterData?.ITEM_MID_NM || eqt.ITEM_MID_NM || '',
              SO_NM: masterData?.SO_NM || eqt.SO_NM || '',
              EQT_LOC_NM: masterData?.EQT_LOC_NM || eqt.EQT_LOC_NM || '',
              EQT_LOC_TP_NM: displayLoc,
              MAC_ADDRESS: masterData?.MAC_ADDRESS || eqt.MAC_ADDRESS || '',
              WRKR_NM: ownerWrkrNm
            });
            setShowCustomerEquipmentModal(true);
          } catch (err) {
            // 마스터 정보 조회 실패해도 기본 정보 표시
            const displayLoc = eqtLocTpNm === '협력업체' ? '협력업체' : (eqtLocTpNm || '보유기사 없음');
            setCustomerEquipmentInfo({
              EQT_SERNO: normalizedSN,
              EQT_NO: eqt.EQT_NO || '',
              ITEM_NM: eqt.ITEM_NM || eqt.EQT_CL_NM || '',
              ITEM_MID_NM: eqt.ITEM_MID_NM || '',
              SO_NM: eqt.SO_NM || '',
              EQT_LOC_NM: eqt.EQT_LOC_NM || '',
              EQT_LOC_TP_NM: displayLoc,
              MAC_ADDRESS: eqt.MAC_ADDRESS || '',
              WRKR_NM: ownerWrkrNm
            });
            setShowCustomerEquipmentModal(true);
          }
        }
      } else {
        setSearchConditionMessage(`S/N: ${normalizedSN}`);
        setHasSearched(true);
        alert('장비(' + normalizedSN + ')를 찾을 수 없습니다.');
      }
    } catch (error) {
      console.error('장비 조회 실패:', error);
      alert('장비 조회에 실패했습니다.');
    } finally {
      setIsLoading(false);
      setSerialInput('');
    }
  };

  // 기사 보유장비 조회 - CRR_ID=""로 전체 협력업체 조회 가능
  // EQT_SERNO 파라미터 추가 시 특정 장비만 조회 (효율적)
  const searchEquipmentByWorker = async (wrkrId: string, wrkrNm: string, crrId?: string, scannedSN?: string) => {
    setIsLoading(true);
    try {
      // CRR_ID=""로 전체 협력업체 조회 (타기사 장비 조회용)
      const params: any = { WRKR_ID: wrkrId, CRR_ID: '' };

      // 장비번호가 있으면 EQT_SERNO 파라미터 추가 (효율적인 필터링)
      // 백엔드 SQL: A.EQT_SERNO IN ($EQT_SERNO$)
      if (scannedSN) {
        // 단일 장비번호 또는 여러 스캔된 장비가 있으면 함께 조회
        const allSerials = scannedSerials.length > 0
          ? [...new Set([scannedSN, ...scannedSerials])]
          : [scannedSN];
        params.EQT_SERNO = allSerials.map(s => `'${s}'`).join(',');
      } else if (scannedSerials.length > 0) {
        // 스캔된 장비들만 조회
        params.EQT_SERNO = scannedSerials.map(s => `'${s}'`).join(',');
      }
      // EQT_SERNO 없으면 기사의 전체 장비 조회 (기존 동작)

      // 모델 필터 파라미터 추가 (백엔드에서 지원하면 사용)
      if (selectedItemMidCd) params.ITEM_MID_CD = selectedItemMidCd;
      if (selectedEqtClCd) params.EQT_CL_CD = selectedEqtClCd;

      const result = await debugApiCall('EquipmentMovement', 'getWrkrHaveEqtList', () => getWrkrHaveEqtList(params), params);

      if (Array.isArray(result) && result.length > 0) {
        // 모델 필터 클라이언트 필터링 (백엔드에서 지원 안 할 경우 대비)
        let filteredResult = result;
        if (selectedItemMidCd) {
          filteredResult = result.filter((item: any) => {
            return item.ITEM_MID_CD === selectedItemMidCd;
          });
        }
        // 소분류 필터 추가
        if (selectedEqtClCd) {
          filteredResult = filteredResult.filter((item: any) => {
            return item.EQT_CL_CD === selectedEqtClCd;
          });
        }

        // 레거시 방식: 특정 지점(401, 402, 328)만 타지점 이동 제한

        let transformedList: EqtTrns[] = filteredResult.map((item: any) => {
          const itemSoId = item.SO_ID || '';
          // 이관 가능 여부:
          // - 제한 지점(401, 402, 328) 장비 → 해당 지점으로만 이동 가능 (targetSoId와 일치해야 함)
          // - 다른 지점 장비 → 자유롭게 이동 가능
          const isRestrictedSo = RESTRICTED_SO_IDS.includes(itemSoId);
          const isTransferable = isRestrictedSo ? (targetSoId === itemSoId) : true;

          return {
            CHK: false,
            EQT_NO: item.EQT_NO || '',
            ITEM_MAX_NM: item.ITEM_MAX_NM || '',
            ITEM_MID_CD: item.ITEM_MID_CD || '',
            ITEM_MID_NM: item.ITEM_MID_NM || '',
            EQT_CL_CD: item.EQT_CL_CD || '',
            EQT_CL_NM: item.EQT_CL_NM || '',
            ITEM_NM: item.ITEM_NM || '',
            ITEM_SPEC: item.ITEM_SPEC || '',
            MST_SO_ID: item.MST_SO_ID || '',
            MST_SO_NM: item.MST_SO_NM || '',
            SO_ID: itemSoId,
            SO_NM: item.SO_NM || '',
            EQT_SERNO: item.EQT_SERNO || '',
            MAC_ADDRESS: item.MAC_ADDRESS || '',
            TA_MAC_ADDRESS: item.TA_MAC_ADDRESS || '',
            WRKR_NM: item.WRKR_NM || wrkrNm,
            CRR_NM: item.CRR_NM || '',
            isScanned: scannedSN ? item.EQT_SERNO === scannedSN || scannedSerials.includes(item.EQT_SERNO) : scannedSerials.includes(item.EQT_SERNO),
            isTransferable
          };
        });

        // 스캔된 장비를 상위로 정렬
        transformedList.sort((a, b) => {
          if (a.isScanned && !b.isScanned) return -1;
          if (!a.isScanned && b.isScanned) return 1;
          return 0;
        });

        // 스캔된 장비는 자동 체크
        transformedList = transformedList.map(item => ({
          ...item,
          CHK: item.isScanned || false
        }));

        if (transformedList.length > 0) {
          setEqtTrnsList(transformedList);
        } else {
          // 모델 필터로 인해 결과 없음
          setEqtTrnsList([]);
          const model1Name = selectedItemMidCd ? ITEM_MID_OPTIONS.find(o => o.code === selectedItemMidCd)?.name : '';
          const model2Name = selectedEqtClCd ? eqtClOptions.find(o => o.code === selectedEqtClCd)?.name : '';
          let modelText = '';
          if (model1Name) modelText += `, 모델1: ${model1Name}`;
          if (model2Name) modelText += `, 모델2: ${model2Name}`;
          setSearchConditionMessage(`기사: ${wrkrNm}${modelText}`);
        }
      } else {
        setEqtTrnsList([]);
        // 검색 조건 메시지 설정
        const model1Name = selectedItemMidCd ? ITEM_MID_OPTIONS.find(o => o.code === selectedItemMidCd)?.name : '';
        const model2Name = selectedEqtClCd ? eqtClOptions.find(o => o.code === selectedEqtClCd)?.name : '';
        let modelText = '';
        if (model1Name) modelText += `, 모델1: ${model1Name}`;
        if (model2Name) modelText += `, 모델2: ${model2Name}`;
        setSearchConditionMessage(`기사: ${wrkrNm}${modelText}`);
      }
    } catch (error) {
      console.error('장비 조회 실패:', error);
      alert('장비 조회에 실패했습니다.');
      setEqtTrnsList([]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSearch = async () => {
    if (!workerInfo.WRKR_ID) { alert('보유기사를 선택해주세요.'); return; }
    await searchEquipmentByWorker(workerInfo.WRKR_ID, workerInfo.WRKR_NM, workerInfo.CRR_ID);
    setHasSearched(true);
  };

  // 기사 검색 팝업 열기
  const openWorkerSearchModal = () => {
    setWorkerSearchKeyword('');
    setSearchedWorkers([]);
    setWorkerModalOpen(true);
  };

  // 기사 검색 (팝업 내에서) - 장비 수량 조회 없이 빠른 검색
  const handleWorkerModalSearch = async () => {
    const keyword = workerSearchKeyword.trim();
    if (!keyword) {
      alert('기사명 또는 ID를 입력해주세요.');
      return;
    }

    // 한글 입력 감지 - 이름 검색
    const koreanRegex = /[가-힣]/;
    const isNameSearch = koreanRegex.test(keyword);

    if (isNameSearch && keyword.length < 2) {
      alert('이름은 2글자 이상 입력해주세요.');
      return;
    }
    setIsSearchingWorker(true);
    try {
      if (isNameSearch) {
        // 이름 검색: searchWorkersByName API 사용 (WRKR_NM 파라미터)
        console.log('[장비이동] 이름 검색:', keyword);

        const allWorkers = await searchWorkersByName({ WRKR_NM: keyword });
        console.log('[장비이동] 이름 검색 결과:', allWorkers.length, '명');

        if (allWorkers.length > 0) {
          const workersToShow = allWorkers.slice(0, 30).map((w: any) => ({
            USR_ID: w.USR_ID || w.WRKR_ID || '',
            USR_NM: w.USR_NM || w.USR_NAME_EN || w.WRKR_NM || '-',
            CRR_ID: w.CRR_ID || '',
            SO_ID: w.SO_ID || '',
            SO_NM: w.SO_NM || '',
            CORP_NM: w.CORP_NM || ''
          }));
          setSearchedWorkers(workersToShow);
        } else {
          setSearchedWorkers([]);
        }
      } else {
        // ID 검색: findUserList API 사용 (USR_ID 파라미터)
        console.log('[장비이동] ID 검색:', keyword.toUpperCase());

        const userSearchResult = await findUserList({ USR_ID: keyword.toUpperCase() });

        if (userSearchResult && userSearchResult.length > 0) {
          const userInfo = userSearchResult[0];
          setSearchedWorkers([{
            USR_ID: userInfo.USR_ID || keyword.toUpperCase(),
            USR_NM: userInfo.USR_NM || userInfo.WRKR_NM || keyword.toUpperCase(),
            CRR_ID: userInfo.CRR_ID || '',
            SO_ID: userInfo.SO_ID || '',
            SO_NM: userInfo.SO_NM || '',
            CORP_NM: userInfo.CORP_NM || ''
          }]);
        } else {
          setSearchedWorkers([]);
        }
      }
    } catch (error) {
      console.error('기사 검색 실패:', error);
      alert('기사 검색에 실패했습니다.');
      setSearchedWorkers([]);
    } finally {
      setIsSearchingWorker(false);
    }
  };

  // 기사 클릭 시 - 장비 목록 조회 (모달 내)
  const handleWorkerClickInModal = async (worker: { USR_ID: string; USR_NM: string; CRR_ID?: string }) => {
    setModalSelectedWorker(worker);
    setIsLoadingModalEquipment(true);
    // 검색 시 선택한 모델 필터가 있으면 적용, 없으면 초기화
    setModalModelFilter(modalSearchModelFilter || '');
    try {
      const params: any = { WRKR_ID: worker.USR_ID, CRR_ID: '' };
      const result = await debugApiCall('EquipmentMovement', 'getWrkrHaveEqtList (modal)', () => getWrkrHaveEqtList(params), params);
      if (Array.isArray(result) && result.length > 0) {
        // 레거시 방식: 특정 지점(401, 402, 328)만 타지점 이동 제한

        const transformedList: EqtTrns[] = result.map((item: any) => {
          const itemSoId = item.SO_ID || '';
          // 이관 가능 여부:
          // - 제한 지점(401, 402, 328) 장비 → 해당 지점으로만 이동 가능
          // - 다른 지점 장비 → 자유롭게 이동 가능
          const isRestrictedSo = RESTRICTED_SO_IDS.includes(itemSoId);
          const isTransferable = isRestrictedSo ? (targetSoId === itemSoId) : true;

          return {
            CHK: false,
            EQT_NO: item.EQT_NO || '',
            ITEM_MAX_NM: item.ITEM_MAX_NM || '',
            ITEM_MID_CD: item.ITEM_MID_CD || '',
            ITEM_MID_NM: item.ITEM_MID_NM || '',
            EQT_CL_CD: item.EQT_CL_CD || '',
            EQT_CL_NM: item.EQT_CL_NM || '',
            ITEM_NM: item.ITEM_NM || '',
            ITEM_SPEC: item.ITEM_SPEC || '',
            MST_SO_ID: item.MST_SO_ID || '',
            MST_SO_NM: item.MST_SO_NM || '',
            SO_ID: itemSoId,
            SO_NM: item.SO_NM || '',
            EQT_SERNO: item.EQT_SERNO || '',
            MAC_ADDRESS: item.MAC_ADDRESS || '',
            TA_MAC_ADDRESS: item.TA_MAC_ADDRESS || '',
            WRKR_NM: item.WRKR_NM || worker.USR_NM,
            CRR_NM: item.CRR_NM || '',
            isScanned: false,
            isTransferable
          };
        });
        setModalEquipmentList(transformedList);
      } else {
        setModalEquipmentList([]);
      }
    } catch (error) {
      console.error('모달 장비 조회 실패:', error);
      setModalEquipmentList([]);
    } finally {
      setIsLoadingModalEquipment(false);
    }
  };

  // 모달 내 장비 체크박스 토글
  const handleModalEquipmentCheck = (index: number, checked: boolean) => {
    const newList = [...modalEquipmentList];
    newList[index].CHK = checked;
    setModalEquipmentList(newList);
  };

  // 모달 내 전체 선택 (필터 적용, 이관가능 장비만)
  const handleModalCheckAll = (checked: boolean) => {
    setModalEquipmentList(modalEquipmentList.map(item => {
      // 이관불가 장비는 선택 불가
      if (item.isTransferable === false) {
        return item;
      }
      // 필터가 없으면 전체 선택, 필터가 있으면 해당 모델만 선택
      if (!modalModelFilter || (item.ITEM_MID_NM || item.EQT_CL_NM || '기타') === modalModelFilter) {
        return { ...item, CHK: checked };
      }
      return item;
    }));
  };

  // 모달에서 선택 확정 - 메인 리스트로 이동
  const handleModalEquipmentConfirm = () => {
    const checkedItems = modalEquipmentList.filter(item => item.CHK);
    if (checkedItems.length === 0) {
      alert('선택된 장비가 없습니다.');
      return;
    }
    // 워커 정보 설정
    if (modalSelectedWorker) {
      setWorkerInfo(prev => ({
        ...prev,
        WRKR_ID: modalSelectedWorker.USR_ID,
        WRKR_NM: modalSelectedWorker.USR_NM,
        CRR_ID: modalSelectedWorker.CRR_ID || ''
      }));
    }
    // 선택된 장비만 메인 리스트에 추가
    setEqtTrnsList(checkedItems);
    setHasSearched(true);
    // 모달 초기화 및 닫기
    setModalSelectedWorker(null);
    setModalEquipmentList([]);
    setSearchedWorkers([]);
    setWorkerSearchKeyword('');
    setWorkerModalOpen(false);
  };

  // 모달 뒤로가기 (장비 목록 → 기사 목록)
  const handleModalBack = () => {
    setModalSelectedWorker(null);
    setModalEquipmentList([]);
  };

  // 기사 선택 - 클릭 시 바로 workerInfo 설정하고 모달 닫기
  // 기사 변경 시 이전 조회 결과 초기화
  const handleWorkerSelect = (worker: { USR_ID: string; USR_NM: string; CRR_ID?: string; EQT_COUNT?: number }) => {
    setWorkerInfo(prev => ({ ...prev, WRKR_ID: worker.USR_ID, WRKR_NM: worker.USR_NM, CRR_ID: worker.CRR_ID || '' }));
    setWorkerModalOpen(false);
    // 이전 조회 결과 초기화
    setEqtTrnsList([]);
    setScannedSerials([]);
    setHasSearched(false);
  };

  // 초기화 (검색 모드로 복귀)
  const handleReset = () => {
    setHasSearched(false);
    setEqtTrnsList([]);
    setScannedSerials([]);
    setWorkerInfo(prev => ({ ...prev, WRKR_ID: '', WRKR_NM: '' }));
    setSerialInput('');
    setSelectionMode('none');  // 선택 모드 초기화
  };

  const handleTransfer = async () => {
    const checkedItems = eqtTrnsList.filter(item => item.CHK);
    if (checkedItems.length === 0) { alert('이동할 장비를 선택해주세요.'); return; }
    if (!loggedInUser.userId) { alert('로그인 정보가 없습니다.'); return; }

    // 본인에게 이동 불가 체크
    if (workerInfo.WRKR_ID === loggedInUser.userId) {
      alert('본인에게는 장비를 이동할 수 없습니다.');
      return;
    }

    setIsLoading(true);
    const results: TransferResult = { success: [], failed: [] };

    try {
      for (const item of checkedItems) {
        try {
          // SO_ID는 장비의 원래 SO_ID 사용 (Oracle 프로시저가 SO_ID + EQT_NO로 장비원장 조회)
          // 중요: MST_SO_ID가 아닌 SO_ID를 사용해야 함!
          // - 테스트 결과: SO_ID=402로 성공, MST_SO_ID=100으로 실패
          // - 원장 테이블은 조회 API의 SO_ID 기준으로 저장됨
          const params = {
            EQT_NO: item.EQT_NO,
            EQT_SERNO: item.EQT_SERNO,
            SO_ID: item.SO_ID,                    // 장비의 원래 SO_ID 사용! (MST_SO_ID 아님!)
            FROM_WRKR_ID: workerInfo.WRKR_ID,
            TO_WRKR_ID: loggedInUser.userId,
            MV_SO_ID: targetSoId || item.SO_ID,   // 이관 지점 (선택한 지점 또는 장비 SO_ID)
            MV_CRR_ID: loggedInUser.crrId,        // 이관 협력업체 (이관받는 기사의 CRR_ID)
            CHG_UID: loggedInUser.userId          // 변경자 ID
          };
          await debugApiCall('EquipmentMovement', 'changeEquipmentWorker', () => changeEquipmentWorker(params), params);
          results.success.push({
            EQT_SERNO: item.EQT_SERNO,
            EQT_NO: item.EQT_NO,
            ITEM_NM: item.ITEM_NM || item.EQT_CL_NM
          });
          // Save to local storage for display
          saveTransferredEquipment({
            EQT_NO: item.EQT_NO,
            EQT_SERNO: item.EQT_SERNO,
            ITEM_NM: item.ITEM_NM || item.EQT_CL_NM,
            ITEM_MID_NM: item.ITEM_MID_NM,
            ITEM_MAX_NM: item.ITEM_MAX_NM,
            EQT_CL_NM: item.EQT_CL_NM,
            SO_ID: item.SO_ID || '',
            SO_NM: item.SO_NM || item.MST_SO_NM || '',
            FROM_WRKR_ID: workerInfo.WRKR_ID,
            FROM_WRKR_NM: workerInfo.WRKR_NM,
            TO_WRKR_ID: loggedInUser.userId
          });
        } catch (err: any) {
          console.error('장비 이동 실패:', item.EQT_SERNO, err);
          results.failed.push({
            EQT_SERNO: item.EQT_SERNO,
            EQT_NO: item.EQT_NO,
            ITEM_NM: item.ITEM_NM || item.EQT_CL_NM,
            error: err?.message || '알 수 없는 오류'
          });
        }
      }

      // 결과 표시
      setTransferResult(results);
      setShowResultModal(true);

      if (results.success.length > 0) {
        // 성공한 장비는 목록에서 제거
        const successNos = new Set(results.success.map(r => r.EQT_NO));
        setEqtTrnsList(prev => prev.filter(item => !successNos.has(item.EQT_NO)));
        setScannedSerials(prev => prev.filter(sn =>
          !results.success.some(r => r.EQT_SERNO === sn)
        ));
      }
    } catch (error) {
      console.error('장비 이동 실패:', error);
      alert('장비 이동에 실패했습니다.');
    } finally {
      setIsLoading(false);
    }
  };

  // 전체 체크 (선택 가능 장비만)
  const handleCheckAll = (checked: boolean) => {
    if (checked) {
      // 전체 선택 시: 첫 번째 장비 기준으로 선택 모드 결정
      const firstItem = eqtTrnsList.find(item => item.isTransferable !== false);
      if (firstItem) {
        const firstSoId = firstItem.SO_ID || '';
        const newMode = RESTRICTED_SO_IDS.includes(firstSoId) ? `restricted-${firstSoId}` : 'normal';
        setSelectionMode(newMode);

        // 새 모드에 맞는 장비만 체크
        setEqtTrnsList(eqtTrnsList.map(item => ({
          ...item,
          CHK: canSelectItem(item, newMode) ? true : false
        })));
      }
    } else {
      // 전체 해제: 선택 모드 초기화
      setSelectionMode('none');
      setEqtTrnsList(eqtTrnsList.map(item => ({ ...item, CHK: false })));
    }
  };

  // 개별 체크 - 선택 모드에 따른 제한 적용
  const handleCheckItem = (index: number, checked: boolean) => {
    const item = eqtTrnsList[index];
    const itemSoId = item.SO_ID || '';
    const isRestrictedItem = RESTRICTED_SO_IDS.includes(itemSoId);

    if (checked) {
      // 선택 시: 선택 모드 확인/설정
      const currentCheckedCount = eqtTrnsList.filter(i => i.CHK).length;

      if (currentCheckedCount === 0) {
        // 첫 번째 선택: 선택 모드 설정
        const newMode = isRestrictedItem ? `restricted-${itemSoId}` : 'normal';
        setSelectionMode(newMode);
      } else {
        // 추가 선택: 선택 모드 호환 확인
        if (!canSelectItem(item, selectionMode)) {
          const modeDesc = selectionMode.startsWith('restricted-')
            ? `${RESTRICTED_SO_NAMES[selectionMode.replace('restricted-', '')]}(${selectionMode.replace('restricted-', '')}) 지점 장비만`
            : '일반 지점 장비만';
          alert(`현재 ${modeDesc} 선택 가능합니다.\n제한지점(경기동부/강남방송/서초지점)과 일반지점 장비는 함께 선택할 수 없습니다.`);
          return;
        }
      }
    }

    // 체크 상태 업데이트
    const newList = [...eqtTrnsList];
    newList[index].CHK = checked;
    setEqtTrnsList(newList);

    // 모두 해제되면 선택 모드 초기화
    if (!checked && newList.filter(i => i.CHK).length === 0) {
      setSelectionMode('none');
    }
  };

  // 지점별 전체 체크 (선택 가능 장비만)
  const handleCheckSo = (soKey: string, checked: boolean) => {
    if (checked) {
      // 해당 지점의 첫 장비로 선택 모드 결정
      const firstSoItem = eqtTrnsList.find(item =>
        (item.SO_NM || item.SO_ID || '미지정') === soKey
      );
      if (firstSoItem) {
        const firstSoId = firstSoItem.SO_ID || '';
        const isRestricted = RESTRICTED_SO_IDS.includes(firstSoId);

        // 현재 선택 모드와 호환 확인
        const currentChecked = eqtTrnsList.filter(i => i.CHK);
        if (currentChecked.length > 0) {
          if (!canSelectItem(firstSoItem, selectionMode)) {
            alert('제한지점과 일반지점 장비는 함께 선택할 수 없습니다.');
            return;
          }
        } else {
          // 첫 선택: 모드 설정
          setSelectionMode(isRestricted ? `restricted-${firstSoId}` : 'normal');
        }
      }
    }

    setEqtTrnsList(eqtTrnsList.map(item => {
      const itemSo = item.SO_NM || item.SO_ID || '미지정';
      if (itemSo === soKey && canSelectItem(item, checked ? selectionMode : 'none')) {
        return { ...item, CHK: checked };
      }
      return item;
    }));

    // 모두 해제되면 선택 모드 초기화
    if (!checked) {
      const remaining = eqtTrnsList.filter(i =>
        (i.SO_NM || i.SO_ID || '미지정') !== soKey && i.CHK
      );
      if (remaining.length === 0) {
        setSelectionMode('none');
      }
    }
  };

  // 장비종류별 전체 체크 (선택 가능 장비만)
  const handleCheckItemType = (soKey: string, itemTypeKey: string, checked: boolean) => {
    if (checked) {
      const firstTypeItem = eqtTrnsList.find(item =>
        (item.SO_NM || item.SO_ID || '미지정') === soKey &&
        (item.ITEM_MID_NM || '기타') === itemTypeKey
      );
      if (firstTypeItem) {
        const currentChecked = eqtTrnsList.filter(i => i.CHK);
        if (currentChecked.length > 0 && !canSelectItem(firstTypeItem, selectionMode)) {
          alert('제한지점과 일반지점 장비는 함께 선택할 수 없습니다.');
          return;
        }
        if (currentChecked.length === 0) {
          const firstSoId = firstTypeItem.SO_ID || '';
          const isRestricted = RESTRICTED_SO_IDS.includes(firstSoId);
          setSelectionMode(isRestricted ? `restricted-${firstSoId}` : 'normal');
        }
      }
    }

    setEqtTrnsList(eqtTrnsList.map(item => {
      const itemSo = item.SO_NM || item.SO_ID || '미지정';
      const itemType = item.ITEM_MID_NM || '기타';
      if (itemSo === soKey && itemType === itemTypeKey && canSelectItem(item, checked ? selectionMode : 'none')) {
        return { ...item, CHK: checked };
      }
      return item;
    }));

    if (!checked) {
      const remaining = eqtTrnsList.filter(i =>
        !((i.SO_NM || i.SO_ID || '미지정') === soKey && (i.ITEM_MID_NM || '기타') === itemTypeKey) && i.CHK
      );
      if (remaining.length === 0) {
        setSelectionMode('none');
      }
    }
  };

  // 카테고리 접기/펼치기
  const toggleCategory = (category: string) => {
    setCollapsedCategories(prev => {
      const newSet = new Set(Array.from(prev));
      if (newSet.has(category)) newSet.delete(category);
      else newSet.add(category);
      return newSet;
    });
  };

  // 지점 > 장비중분류로 2단계 그룹화 + 그룹 내 EQT_CL_NM 정렬
  const groupedByLocation = eqtTrnsList.reduce((acc, item, idx) => {
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

    const itemKey = item.ITEM_MID_NM || '기타';
    if (!acc[soKey]) acc[soKey] = {};
    if (!acc[soKey][itemKey]) acc[soKey][itemKey] = [];
    acc[soKey][itemKey].push({ ...item, _globalIdx: idx });
    return acc;
  }, {} as Record<string, Record<string, (EqtTrns & { _globalIdx: number })[]>>);

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

  // 스캔 초기화
  const handleClearScanned = () => {
    setScannedSerials([]);
    setEqtTrnsList([]);
    setWorkerInfo({ WRKR_ID: '', WRKR_NM: '', SO_ID: workerInfo.SO_ID, CRR_ID: '' });
  };

  return (
    <div className="h-full overflow-y-auto bg-gray-50 px-4 py-4 space-y-3">
      {/* 통합 검색 영역 */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
        <div className="mb-3">
          <h3 className="text-sm font-semibold text-gray-800 flex items-center gap-2">
            <Search className="w-4 h-4" />
            장비 이동
          </h3>
          <p className="text-xs text-gray-500 mt-0.5">타 기사의 장비를 나에게 이동합니다</p>
        </div>
        <div className="space-y-3">
          {/* 1. 기사명 (보유기사 검색) */}
          <div className="flex items-center gap-2">
            <label className="text-xs font-medium text-gray-600 w-14 flex-shrink-0">기사명</label>
            <div
              className="flex-1 flex items-center gap-2 cursor-pointer"
              onClick={openWorkerSearchModal}
            >
              <input
                type="text"
                value={workerInfo.WRKR_NM || ''}
                readOnly
                className="flex-1 min-w-0 px-3 py-2.5 text-sm border border-gray-200 rounded-lg bg-gray-50 cursor-pointer"
                placeholder="클릭하여 기사 검색"
              />
              <input
                type="text"
                value={workerInfo.WRKR_ID || ''}
                readOnly
                className="w-24 px-2 py-2.5 text-sm border border-gray-200 rounded-lg bg-gray-50 cursor-pointer font-mono text-center"
                placeholder="ID"
              />
            </div>
          </div>

          {/* 2. 모델1 (중분류) */}
          <div className="flex items-center gap-2">
            <label className="text-xs font-medium text-gray-600 w-14 flex-shrink-0">모델1</label>
            <select
              value={selectedItemMidCd}
              onChange={(e) => setSelectedItemMidCd(e.target.value)}
              className="flex-1 px-3 py-2.5 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              {ITEM_MID_OPTIONS.map(opt => (
                <option key={opt.code} value={opt.code}>{opt.name}</option>
              ))}
            </select>
          </div>

          {/* 3. 모델2 (소분류) - 항상 표시, 모델1 미선택 시 비활성화 */}
          <div className="flex items-center gap-2">
            <label className="text-xs font-medium text-gray-600 w-14 flex-shrink-0">모델2</label>
            <select
              value={selectedEqtClCd}
              onChange={(e) => setSelectedEqtClCd(e.target.value)}
              disabled={!selectedItemMidCd || isLoadingEqtCl || eqtClOptions.length === 0}
              className="flex-1 px-3 py-2.5 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-100 disabled:cursor-not-allowed"
            >
              <option value="">
                {!selectedItemMidCd ? '모델1을 먼저 선택하세요' :
                 isLoadingEqtCl ? '로딩중...' :
                 (eqtClOptions.length === 0 ? '소분류 없음' : '전체')}
              </option>
              {eqtClOptions.map(opt => (
                <option key={opt.code} value={opt.code}>{opt.name}</option>
              ))}
            </select>
          </div>

          {/* 4. 장비번호 + 스캔 */}
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={serialInput}
              onChange={(e) => setSerialInput(e.target.value.toUpperCase())}
              onKeyDown={(e) => e.key === 'Enter' && serialInput.trim() && handleSerialSearch()}
              className="flex-1 px-4 py-3 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent uppercase font-mono transition-all"
              placeholder="S/N 또는 MAC 주소 입력"
            />
            <button
              onClick={() => setShowBarcodeScanner(true)}
              className="px-4 py-3 bg-green-500 hover:bg-green-600 text-white rounded-lg font-semibold text-sm transition-all active:scale-[0.98] touch-manipulation flex items-center gap-1.5"
              style={{ WebkitTapHighlightColor: 'transparent' }}
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" />
              </svg>
              스캔
            </button>
          </div>

          {/* 스캔된 장비 표시 영역 */}
          {scannedSerials.length > 0 && (
            <div className="p-3 bg-purple-50 border border-purple-200 rounded-lg">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-medium text-purple-700">스캔된 장비 ({scannedSerials.length}건)</span>
                <button
                  onClick={() => setScannedSerials([])}
                  className="text-xs text-purple-600 hover:text-purple-800"
                >
                  전체 삭제
                </button>
              </div>
              <div className="space-y-1 max-h-20 overflow-y-auto">
                {scannedSerials.map((sn, idx) => (
                  <div key={idx} className="flex items-center justify-between text-xs bg-white px-2 py-1 rounded">
                    <span className="font-mono text-gray-800">{sn}</span>
                    <button
                      onClick={() => setScannedSerials(prev => prev.filter(s => s !== sn))}
                      className="text-red-400 hover:text-red-600"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 5. 조회 버튼 */}
          <button
            onClick={() => {
              // 조회 조건 메시지 생성
              const conditions: string[] = [];
              if (workerInfo.WRKR_NM) conditions.push(`기사: ${workerInfo.WRKR_NM}`);
              if (selectedItemMidCd) {
                const midName = ITEM_MID_OPTIONS.find(o => o.code === selectedItemMidCd)?.name;
                if (midName) conditions.push(`모델1: ${midName}`);
              }
              if (selectedEqtClCd) {
                const eqtClName = eqtClOptions.find(o => o.code === selectedEqtClCd)?.name;
                if (eqtClName) conditions.push(`모델2: ${eqtClName}`);
              }
              if (serialInput.trim()) conditions.push(`S/N: ${serialInput.trim()}`);
              setSearchConditionMessage(conditions.join(', ') || '전체');

              if (serialInput.trim()) {
                handleSerialSearch();
              } else if (scannedSerials.length > 0) {
                handleScannedSearch();
              } else if (workerInfo.WRKR_ID) {
                handleSearch();
              } else {
                alert('기사를 선택하거나 장비번호를 입력해주세요.');
              }
            }}
            disabled={isLoading || (!workerInfo.WRKR_ID && !serialInput.trim() && scannedSerials.length === 0)}
            className="w-full bg-blue-500 hover:bg-blue-600 disabled:bg-gray-300 text-white py-2.5 rounded-lg font-semibold text-sm shadow-sm transition-all active:scale-[0.98] touch-manipulation"
          >
            {isLoading ? '조회 중...' : '조회'}
          </button>
        </div>
      </div>

      {/* 조회 결과 - 종류별 그룹화 */}
      {eqtTrnsList.length > 0 && (
        <>
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
            {/* 헤더 */}
            <div className="px-4 py-3 bg-gradient-to-r from-gray-50 to-white border-b border-gray-100">
              <div className="flex items-center justify-between gap-2 mb-2">
                <div className="flex items-center gap-2 min-w-0 flex-1">
                  <button
                    onClick={handleReset}
                    className="p-1.5 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors flex-shrink-0"
                    title="초기화"
                  >
                    <RotateCcw className="w-4 h-4" />
                  </button>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1 text-sm">
                      <span className="font-semibold text-gray-800 truncate max-w-[120px]">{workerInfo.WRKR_NM}</span>
                      <span className="text-gray-600 whitespace-nowrap">{eqtTrnsList.length}건</span>
                      <span className="text-blue-600 font-medium whitespace-nowrap">(선택:{eqtTrnsList.filter(item => item.CHK).length})</span>
                    </div>
                  </div>
                </div>
                <label className="flex items-center gap-2 text-xs flex-shrink-0 whitespace-nowrap">
                  <input
                    type="checkbox"
                    onChange={(e) => handleCheckAll(e.target.checked)}
                    checked={eqtTrnsList.length > 0 && eqtTrnsList.every(item => item.CHK)}
                    className="rounded"
                  />
                  전체
                </label>
              </div>
              {/* 선택 모드 표시 */}
              {selectionMode !== 'none' && (
                <div className={`mb-2 px-3 py-2 rounded-lg text-xs font-medium flex items-center justify-between ${
                  selectionMode.startsWith('restricted-')
                    ? 'bg-amber-100 text-amber-800 border border-amber-200'
                    : 'bg-blue-100 text-blue-800 border border-blue-200'
                }`}>
                  <span>
                    {selectionMode.startsWith('restricted-')
                      ? `${RESTRICTED_SO_NAMES[selectionMode.replace('restricted-', '')]} 지점 전용 모드`
                      : '일반 지점 모드 (제한지점 선택 불가)'}
                  </span>
                  <button
                    onClick={() => {
                      setSelectionMode('none');
                      setEqtTrnsList(prev => prev.map(item => ({ ...item, CHK: false, isTransferable: true })));
                    }}
                    className={`px-2 py-0.5 rounded text-xs ${
                      selectionMode.startsWith('restricted-')
                        ? 'bg-amber-200 hover:bg-amber-300'
                        : 'bg-blue-200 hover:bg-blue-300'
                    }`}
                  >
                    초기화
                  </button>
                </div>
              )}
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

            {/* 지점 > 장비종류 2단계 그룹 */}
            <div className="divide-y divide-gray-100">
              {soKeys.map(soKey => {
                const itemGroups = groupedByLocation[soKey];
                const itemKeys = Object.keys(itemGroups).sort();
                const soCollapsed = collapsedCategories.has(soKey);
                const soItemCount = itemKeys.reduce((sum, k) => sum + itemGroups[k].length, 0);
                const soAllItems = itemKeys.flatMap(k => itemGroups[k]);
                const soAllChecked = soAllItems.every(i => i.CHK);
                const soSomeChecked = soAllItems.some(i => i.CHK);

                return (
                  <div key={soKey}>
                    {/* 지점 헤더 */}
                    <div
                      className="px-4 py-2 bg-blue-50 flex items-center justify-between cursor-pointer hover:bg-blue-100"
                      onClick={() => toggleCategory(soKey)}
                    >
                      <div className="flex items-center gap-3">
                        <input
                          type="checkbox"
                          checked={soAllChecked}
                          onClick={(e) => e.stopPropagation()}
                          onChange={(e) => handleCheckSo(soKey, e.target.checked)}
                          className="rounded"
                        />
                        <span className="text-sm font-bold text-blue-800">{soKey}</span>
                        <span className="text-xs text-blue-600 bg-blue-100 px-2 py-0.5 rounded-full">
                          {soItemCount}건 {soSomeChecked && !soAllChecked && `(${soAllItems.filter(i => i.CHK).length}선택)`}
                        </span>
                      </div>
                      {soCollapsed ? <ChevronDown className="w-4 h-4 text-blue-600" /> : <ChevronUp className="w-4 h-4 text-blue-600" />}
                    </div>

                    {/* 지점 내 장비종류 */}
                    {!soCollapsed && itemKeys.map(itemTypeKey => {
                      const items = itemGroups[itemTypeKey];
                      const itemGroupKey = `${soKey}-${itemTypeKey}`;
                      const itemCollapsed = collapsedCategories.has(itemGroupKey);
                      const allChecked = items.every(i => i.CHK);
                      const someChecked = items.some(i => i.CHK);

                      return (
                        <div key={itemGroupKey}>
                          {/* 장비종류 헤더 */}
                          <div
                            className="px-6 py-1.5 bg-gray-50 flex items-center justify-between cursor-pointer hover:bg-gray-100"
                            onClick={() => toggleCategory(itemGroupKey)}
                          >
                            <div className="flex items-center gap-2">
                              <input
                                type="checkbox"
                                checked={allChecked}
                                onClick={(e) => e.stopPropagation()}
                                onChange={(e) => handleCheckItemType(soKey, itemTypeKey, e.target.checked)}
                                className="rounded w-4 h-4"
                              />
                              <span className="text-xs font-semibold text-gray-700">{itemTypeKey}</span>
                              <span className="text-[10px] text-gray-500 bg-gray-200 px-1.5 py-0.5 rounded">
                                {items.length}건 {someChecked && !allChecked && `(${items.filter(i => i.CHK).length}선택)`}
                              </span>
                            </div>
                            {itemCollapsed ? <ChevronDown className="w-3 h-3 text-gray-500" /> : <ChevronUp className="w-3 h-3 text-gray-500" />}
                          </div>

                          {/* 장비 목록 */}
                          {!itemCollapsed && (
                            <div className="divide-y divide-gray-50">
                              {items.map((item, idx) => {
                                const globalIndex = item._globalIdx;
                                return (
                            <div
                              key={item.EQT_NO || idx}
                              className={`p-3 rounded-lg border-2 transition-all ${
                                item.isTransferable === false ? 'bg-red-50 border-red-200 opacity-60' :
                                item.isScanned ? 'bg-purple-50 border-purple-200' :
                                'bg-gray-50 border-transparent hover:border-gray-200'
                              }`}
                            >
                              <div className="flex items-start gap-3">
                                <input
                                  type="checkbox"
                                  checked={item.CHK || false}
                                  onChange={(e) => handleCheckItem(globalIndex, e.target.checked)}
                                  disabled={item.isTransferable === false}
                                  className={`w-5 h-5 rounded focus:ring-blue-500 mt-0.5 ${
                                    item.isTransferable === false ? 'text-gray-300 cursor-not-allowed' : 'text-blue-500'
                                  }`}
                                />
                                <div className="flex-1 min-w-0">
                                  {/* Line 1: 모델명 + 이관불가/스캔뱃지 */}
                                  <div className="flex items-center justify-between">
                                    <span className={`text-base font-bold truncate ${
                                      item.isTransferable === false ? 'text-gray-500' : 'text-gray-900'
                                    }`}>{item.EQT_CL_NM || item.ITEM_NM || '-'}</span>
                                    <div className="flex items-center gap-1 flex-shrink-0 ml-2">
                                      {/* 제한 지점 장비 표시 */}
                                      {RESTRICTED_SO_IDS.includes(item.SO_ID) && (
                                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                                          item.isTransferable === false
                                            ? 'bg-red-100 text-red-700'
                                            : 'bg-amber-100 text-amber-700'
                                        }`}>
                                          {RESTRICTED_SO_NAMES[item.SO_ID]}{item.isTransferable === false ? '(선택불가)' : ''}
                                        </span>
                                      )}
                                      {item.isScanned && (
                                        <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-700">스캔</span>
                                      )}
                                    </div>
                                  </div>
                                  {/* Line 2: S/N + [EQT_USE_ARR_YN] 뱃지 */}
                                  <div className="flex items-center justify-between mt-1">
                                    <span className="text-sm text-gray-600">{item.EQT_SERNO || '-'}</span>
                                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium flex-shrink-0 ml-2 ${
                                      item.EQT_USE_ARR_YN === 'Y' ? 'bg-green-100 text-green-700' :
                                      item.EQT_USE_ARR_YN === 'A' ? 'bg-purple-100 text-purple-700' :
                                      item.EQT_USE_ARR_YN === 'N' ? 'bg-red-100 text-red-700' :
                                      'bg-gray-100 text-gray-700'
                                    }`}>
                                      {item.EQT_USE_ARR_YN === 'Y' ? '사용가능' :
                                       item.EQT_USE_ARR_YN === 'A' ? '검사대기' :
                                       item.EQT_USE_ARR_YN === 'N' ? '사용불가' : 'N/A'}
                                    </span>
                                  </div>
                                  {/* Line 3: MAC + 날짜 (YYYY-MM-DD) */}
                                  <div className="flex items-center justify-between mt-0.5">
                                    <span className="text-sm text-gray-600">{formatMac(item.MAC_ADDRESS)}</span>
                                    <span className="text-sm text-gray-600">{formatDateDash(item.EQT_USE_END_DT || '')}</span>
                                  </div>
                                </div>
                              </div>
                              {/* 자세히 보기: 추가 정보 */}
                              {viewMode === 'detail' && (
                                <div className="bg-gray-100 rounded-lg p-2 mt-2 text-xs space-y-1">
                                  <div className="flex items-center justify-between"><span className="text-gray-800">{item.ITEM_MODEL || item.MODEL_NM || '-'}</span><span className="font-medium text-gray-800">{item.SO_NM || '-'}</span></div>
                                  <div className="flex items-center justify-between"><span><span className="text-gray-500">장비상태  : </span><span className="text-gray-800">{item.EQT_STAT_CD_NM || '-'}</span></span><span className="text-gray-400 text-xs">{item.EQT_NO || '-'}</span></div>
                                  <div><span className="text-gray-500">변경종류  : </span><span className="text-gray-800">{item.CHG_KND_NM || '-'}</span></div>
                                  <div><span className="text-gray-500">현재위치  : </span><span className="text-gray-800">{item.EQT_LOC_NM || item.EQT_LOC_TP_NM || '-'}</span></div>
                                  <div><span className="text-gray-500">이전위치  : </span><span className="text-gray-800">{item.OLD_EQT_LOC_NM || '-'}</span></div>
                                  <div><span className="text-gray-500">MAC주소   : </span><span className="text-gray-800">{item.MAC_ADDRESS || '-'}</span></div>
                                </div>
                              )}
                            </div>
                                );
                              })}
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

          {/* 하단 여백 (고정 버튼 공간 확보) */}
          <div className="h-24"></div>
        </>
      )}

      {eqtTrnsList.length === 0 && !isLoading && (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-8">
          <p className="text-center text-gray-500 text-sm">
            {hasSearched && searchConditionMessage ? (
              <>
                <span className="text-amber-600 font-medium">{searchConditionMessage}</span>
                <span className="text-gray-600"> 조건에 충족하는 값이 없습니다</span>
              </>
            ) : (
              <>기사를 선택하거나 장비번호를 입력하여<br />조회 버튼을 눌러주세요</>
            )}
          </p>
        </div>
      )}

      {isLoading && (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-8">
          <p className="text-center text-gray-500 text-sm">조회 중...</p>
        </div>
      )}

      {/* 하단 고정 버튼 - 항상 표시 (장비 목록이 있을 때) */}
      {eqtTrnsList.length > 0 && (
        <div className="fixed bottom-16 left-0 right-0 px-4 pb-2 z-[45]">
          <button
            onClick={() => setShowTransferModal(true)}
            disabled={eqtTrnsList.filter(item => item.CHK).length === 0}
            className={`w-full py-4 rounded-xl font-bold text-base shadow-lg flex items-center justify-center gap-2 active:scale-[0.98] transition-all touch-manipulation ${
              eqtTrnsList.filter(item => item.CHK).length > 0
                ? 'bg-gradient-to-r from-blue-500 to-blue-600 text-white'
                : 'bg-gray-300 text-gray-500 cursor-not-allowed'
            }`}
          >
            <Check className="w-5 h-5" />
            장비 이동 ({eqtTrnsList.filter(item => item.CHK).length}건)
          </button>
        </div>
      )}

      {/* 이관 확인 모달 */}
      <BaseModal
        isOpen={showTransferModal}
        onClose={() => setShowTransferModal(false)}
        title="장비 이관 확인"
        size="large"
        footer={
          <div className="w-full grid grid-cols-2 gap-4">
            <button
              onClick={() => setShowTransferModal(false)}
              className="py-4 text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-xl font-semibold text-base transition-colors touch-manipulation"
            >
              취소
            </button>
            <button
              onClick={() => {
                setShowTransferModal(false);
                handleTransfer();
              }}
              className="py-4 bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-xl font-semibold text-base shadow-lg active:scale-[0.98] transition-all touch-manipulation"
            >
              이관하기
            </button>
          </div>
        }
      >
        <div className="space-y-4">
          {/* 이관지점 선택 - 선택된 장비에 따라 제한 */}
          {(() => {
            const availableSoList = getAvailableTargetSoList();
            const isRestrictedMode = selectionMode.startsWith('restricted-');
            const restrictedSoId = isRestrictedMode ? selectionMode.replace('restricted-', '') : '';

            return (
              <div className={`rounded-xl p-4 ${isRestrictedMode ? 'bg-amber-50 border border-amber-200' : 'bg-blue-50 border border-blue-200'}`}>
                <label className={`block text-sm font-semibold mb-2 ${isRestrictedMode ? 'text-amber-800' : 'text-blue-800'}`}>
                  이관지점 {isRestrictedMode ? `(${RESTRICTED_SO_NAMES[restrictedSoId]} 전용)` : '선택'}
                </label>
                {isRestrictedMode ? (
                  <>
                    {/* 제한 지점 모드: 해당 지점만 표시 (읽기 전용) */}
                    <div className="w-full px-4 py-3 border border-amber-300 rounded-xl text-sm bg-amber-100 text-amber-900 font-semibold">
                      {RESTRICTED_SO_NAMES[restrictedSoId]} ({restrictedSoId})
                    </div>
                    <p className="text-xs text-amber-600 mt-2">
                      {RESTRICTED_SO_NAMES[restrictedSoId]} 장비는 해당 지점 내에서만 이관 가능합니다
                    </p>
                  </>
                ) : availableSoList.length > 1 ? (
                  <>
                    {/* 일반 모드: 제한 지점 제외한 지점 선택 */}
                    <select
                      value={targetSoId}
                      onChange={(e) => setTargetSoId(e.target.value)}
                      className="w-full px-4 py-3 border border-blue-300 rounded-xl text-sm bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    >
                      {availableSoList.map((so) => (
                        <option key={so.SO_ID} value={so.SO_ID}>
                          {so.SO_NM} ({so.SO_ID})
                        </option>
                      ))}
                    </select>
                    <p className="text-xs text-blue-600 mt-2">
                      장비가 선택한 지점으로 이관됩니다
                    </p>
                  </>
                ) : availableSoList.length === 1 ? (
                  <>
                    {/* 선택 가능 지점이 1개뿐 */}
                    <div className="w-full px-4 py-3 border border-blue-300 rounded-xl text-sm bg-blue-100 text-blue-900 font-semibold">
                      {availableSoList[0].SO_NM} ({availableSoList[0].SO_ID})
                    </div>
                    <p className="text-xs text-blue-600 mt-2">
                      이관 가능한 지점으로 자동 설정됩니다
                    </p>
                  </>
                ) : null}
              </div>
            );
          })()}

          {/* 이관 정보 요약 */}
          <div className="bg-gray-50 rounded-xl p-4">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-semibold text-gray-700">이관 정보</span>
            </div>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-500">보유기사</span>
                <span className="font-medium text-gray-900">{workerInfo.WRKR_NM} ({workerInfo.WRKR_ID})</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">인수기사</span>
                <span className="font-medium text-gray-900">{loggedInUser.userName} ({loggedInUser.userId})</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">선택장비</span>
                <span className="font-bold text-blue-600">{eqtTrnsList.filter(item => item.CHK).length}건</span>
              </div>
            </div>
          </div>

          {/* 선택된 장비 목록 */}
          <div className="border border-gray-200 rounded-xl overflow-hidden">
            <div className="bg-gray-100 px-4 py-2 border-b border-gray-200">
              <span className="text-xs font-semibold text-gray-600">선택된 장비</span>
            </div>
            <div className="max-h-48 overflow-y-auto divide-y divide-gray-100">
              {eqtTrnsList.filter(item => item.CHK).map((item, idx) => (
                <div key={item.EQT_NO || idx} className="px-4 py-2 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 bg-blue-100 text-blue-700 text-[10px] rounded font-medium">
                      {item.ITEM_MID_NM || item.EQT_CL_NM || '장비'}
                    </span>
                    <span className="text-xs font-mono text-gray-800">{item.EQT_SERNO}</span>
                  </div>
                  <span className="text-[10px] text-gray-500">{item.SO_NM || item.SO_ID}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </BaseModal>

      {/* 기사 검색 + 장비 선택 모달 */}
      <BaseModal
        isOpen={workerModalOpen}
        onClose={() => {
          setWorkerModalOpen(false);
          setModalSelectedWorker(null);
          setModalEquipmentList([]);
          setSearchedWorkers([]);
          setWorkerSearchKeyword('');
          setModalSelectedSoId('');
        }}
        title={modalSelectedWorker ? `${modalSelectedWorker.USR_NM} 보유장비` : '기사 검색'}
        size="large"
        subHeader={
          modalSelectedWorker ? (
            <div className="flex items-center justify-between">
              <button
                onClick={handleModalBack}
                className="flex items-center gap-1 text-sm text-gray-600 hover:text-gray-900"
              >
                <ChevronUp className="w-4 h-4 rotate-[-90deg]" />
                뒤로
              </button>
              <label className="flex items-center gap-2 text-xs">
                <input
                  type="checkbox"
                  onChange={(e) => handleModalCheckAll(e.target.checked)}
                  checked={(() => {
                    const filtered = modalEquipmentList.filter(item =>
                      !modalModelFilter || (item.ITEM_MID_NM || item.EQT_CL_NM || '기타') === modalModelFilter
                    );
                    return filtered.length > 0 && filtered.every(item => item.CHK);
                  })()}
                  className="rounded"
                />
                {modalModelFilter ? `${modalModelFilter} 전체선택` : '전체선택'}
              </label>
            </div>
          ) : (
            <div className="space-y-2">
              {/* 검색 입력 */}
              <div className="flex gap-2">
                <input
                  type="text"
                  value={workerSearchKeyword}
                  onChange={(e) => setWorkerSearchKeyword(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleWorkerModalSearch()}
                  className="flex-1 px-3 py-2 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-green-500"
                  placeholder="기사명 또는 ID 입력"
                  autoFocus
                />
                <button
                  onClick={handleWorkerModalSearch}
                  disabled={isSearchingWorker}
                  className="px-4 py-2 bg-green-500 hover:bg-green-600 disabled:bg-gray-300 text-white rounded-lg font-medium text-sm touch-manipulation"
                >
                  {isSearchingWorker ? '...' : '검색'}
                </button>
              </div>
            </div>
          )
        }
        footer={
          modalSelectedWorker ? (
            <div className="w-full grid grid-cols-2 gap-3">
              <button
                onClick={handleModalBack}
                className="py-3 text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-xl font-semibold text-sm transition-colors touch-manipulation"
              >
                뒤로
              </button>
              <button
                onClick={handleModalEquipmentConfirm}
                disabled={modalEquipmentList.filter(item => item.CHK).length === 0}
                className="py-3 bg-gradient-to-r from-blue-500 to-blue-600 disabled:from-gray-300 disabled:to-gray-400 text-white rounded-xl font-semibold text-sm shadow-lg active:scale-[0.98] transition-all touch-manipulation"
              >
                선택 완료 ({modalEquipmentList.filter(item => item.CHK).length}건)
              </button>
            </div>
          ) : (
            <button
              onClick={() => setWorkerModalOpen(false)}
              className="w-full py-2.5 text-sm text-gray-600 hover:bg-gray-100 rounded-lg font-medium transition-colors touch-manipulation"
            >
              닫기
            </button>
          )
        }
      >
        {/* 장비 목록 보기 (기사 선택 후) */}
        {modalSelectedWorker ? (
          isLoadingModalEquipment ? (
            <div className="py-8 text-center text-gray-500 text-sm">
              장비 조회 중...
            </div>
          ) : modalEquipmentList.length === 0 ? (
            <div className="py-8 text-center text-gray-500 text-sm">
              보유 장비가 없습니다
            </div>
          ) : (
            <>
              {/* 모델 필터 드롭다운 */}
              <div className="px-4 py-2 border-b border-gray-100 bg-gray-50">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-600 font-medium">모델:</span>
                  <select
                    value={modalModelFilter}
                    onChange={(e) => setModalModelFilter(e.target.value)}
                    className="flex-1 text-xs border border-gray-200 rounded-lg px-2 py-1.5 bg-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                  >
                    <option value="">전체 ({modalEquipmentList.length}건)</option>
                    {Array.from(new Set(modalEquipmentList.map(item => item.ITEM_MID_NM || item.EQT_CL_NM || '기타')))
                      .sort()
                      .map(model => {
                        const count = modalEquipmentList.filter(item => (item.ITEM_MID_NM || item.EQT_CL_NM || '기타') === model).length;
                        return (
                          <option key={model} value={model}>{model} ({count}건)</option>
                        );
                      })
                    }
                  </select>
                </div>
              </div>
              {/* 장비 목록 */}
              <div className="divide-y divide-gray-100 max-h-72 overflow-y-auto">
                {modalEquipmentList
                  .map((item, idx) => ({ item, idx }))
                  .filter(({ item }) => !modalModelFilter || (item.ITEM_MID_NM || item.EQT_CL_NM || '기타') === modalModelFilter)
                  .map(({ item, idx }) => (
                  <div
                    key={item.EQT_NO || idx}
                    className={`px-4 py-3 flex items-center gap-3 ${
                      item.isTransferable === false ? 'bg-red-50 opacity-60' :
                      item.CHK ? 'bg-blue-50' : 'hover:bg-gray-50'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={item.CHK || false}
                      onChange={(e) => handleModalEquipmentCheck(idx, e.target.checked)}
                      disabled={item.isTransferable === false}
                      className={`rounded flex-shrink-0 ${
                        item.isTransferable === false ? 'text-gray-300 cursor-not-allowed' : ''
                      }`}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className={`px-1.5 py-0.5 text-[10px] rounded font-medium ${
                          item.isTransferable === false ? 'bg-red-100 text-red-700' : 'bg-blue-100 text-blue-700'
                        }`}>
                          {item.isTransferable === false && RESTRICTED_SO_IDS.includes(item.SO_ID)
                            ? `${RESTRICTED_SO_NAMES[item.SO_ID]}전용`
                            : (item.ITEM_MID_NM || item.EQT_CL_NM || '장비')}
                        </span>
                        <span className={`font-mono text-xs truncate ${
                          item.isTransferable === false ? 'text-gray-500' : 'text-gray-800'
                        }`}>
                          {item.EQT_SERNO || '-'}
                        </span>
                      </div>
                      <div className="text-[10px] text-gray-500 mt-1">
                        {item.SO_NM || item.SO_ID || '미지정'}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )
        ) : (
          /* 기사 목록 보기 (초기 상태) */
          searchedWorkers.length === 0 ? (
            <div className="py-8 text-center text-gray-500 text-sm">
              {isSearchingWorker ? '검색 중...' : '이름 또는 ID를 검색하세요'}
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {searchedWorkers.map((worker, idx) => (
                <button
                  key={idx}
                  onClick={() => handleWorkerSelect(worker)}
                  className="w-full px-4 py-3 text-left hover:bg-green-50 flex justify-between items-center transition-colors active:bg-green-100 touch-manipulation"
                >
                  <div className="flex flex-col gap-0.5">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-gray-900">{worker.USR_NM}</span>
                      <span className="text-xs text-gray-500 font-mono">({worker.USR_ID})</span>
                    </div>
                    {/* 지점명, 파트너사 표시 */}
                    <div className="flex items-center gap-2 text-xs">
                      {worker.SO_NM && (
                        <span className="text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded">{worker.SO_NM}</span>
                      )}
                      {worker.CORP_NM && (
                        <span className="text-purple-600 bg-purple-50 px-1.5 py-0.5 rounded">{worker.CORP_NM}</span>
                      )}
                      {!worker.SO_NM && !worker.CORP_NM && (
                        <span className="text-gray-400">-</span>
                      )}
                    </div>
                  </div>
                  <span className="text-xs px-2 py-1 rounded text-blue-600 bg-blue-50 font-medium">
                    {worker.EQT_COUNT !== undefined ? `${worker.EQT_COUNT}건` : ''}
                  </span>
                </button>
              ))}
            </div>
          )
        )}
      </BaseModal>

      {/* 바코드 스캐너 */}
      <BarcodeScanner
        isOpen={showBarcodeScanner}
        onClose={() => setShowBarcodeScanner(false)}
        onScan={handleBarcodeScan}
        isMultiScanMode={false}
        scanCount={scannedSerials.length}
      />

      {/* 이동 결과 모달 */}
      {showResultModal && transferResult && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md max-h-[80vh] overflow-hidden">
            {/* 헤더 */}
            <div className={`p-4 ${
              transferResult.failed.length === 0
                ? 'bg-gradient-to-r from-green-500 to-green-600'
                : transferResult.success.length === 0
                  ? 'bg-gradient-to-r from-red-500 to-red-600'
                  : 'bg-gradient-to-r from-amber-500 to-amber-600'
            }`}>
              <h3 className="font-semibold text-white text-lg">
                {transferResult.failed.length === 0 ? '이동 완료' :
                 transferResult.success.length === 0 ? '이동 실패' : '부분 성공'}
              </h3>
              <p className="text-white/80 text-sm mt-1">
                성공: {transferResult.success.length}건 / 실패: {transferResult.failed.length}건
              </p>
            </div>

            {/* 내용 */}
            <div className="p-4 max-h-96 overflow-y-auto space-y-4">
              {/* 성공 목록 */}
              {transferResult.success.length > 0 && (
                <div>
                  <h4 className="text-sm font-semibold text-green-700 mb-2 flex items-center gap-2">
                    <Check className="w-4 h-4" />
                    성공 ({transferResult.success.length}건)
                  </h4>
                  <div className="space-y-1">
                    {transferResult.success.map((item, idx) => (
                      <div key={idx} className="flex items-center justify-between p-2 bg-green-50 rounded-lg text-xs">
                        <span className="font-mono text-green-800">{item.EQT_SERNO}</span>
                        <span className="text-green-600">{item.ITEM_NM}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* 실패 목록 */}
              {transferResult.failed.length > 0 && (
                <div>
                  <h4 className="text-sm font-semibold text-red-700 mb-2 flex items-center gap-2">
                    <X className="w-4 h-4" />
                    실패 ({transferResult.failed.length}건)
                  </h4>
                  <div className="space-y-1">
                    {transferResult.failed.map((item, idx) => (
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

            {/* 닫기 버튼 */}
            <div className="p-4 border-t border-gray-100 bg-gray-50">
              <button
                onClick={() => {
                  setShowResultModal(false);
                  setTransferResult(null);
                }}
                className="w-full py-2.5 bg-gray-800 hover:bg-gray-900 text-white rounded-lg font-medium transition-colors"
              >
                확인
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 고객사용중/보유기사없음 장비 정보 팝업 */}
      {showCustomerEquipmentModal && customerEquipmentInfo && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden">
            {/* 헤더 */}
            <div className={`p-4 ${
              customerEquipmentInfo.EQT_LOC_TP_NM === '고객사용중'
                ? 'bg-gradient-to-r from-amber-500 to-amber-600'
                : 'bg-gradient-to-r from-purple-500 to-purple-600'
            }`}>
              <h3 className="font-semibold text-white text-lg flex items-center gap-2">
                <AlertTriangle className="w-5 h-5" />
                {customerEquipmentInfo.EQT_LOC_TP_NM === '고객사용중' ? '고객사용중 장비' : '장비 정보'}
              </h3>
              <p className="text-white/80 text-sm mt-1">
                이 장비는 {customerEquipmentInfo.EQT_LOC_TP_NM === '고객사용중'
                  ? '현재 고객이 사용중입니다'
                  : customerEquipmentInfo.EQT_LOC_TP_NM === '협력업체'
                    ? '협력업체에 있습니다'
                    : '보유기사가 없습니다'}
              </p>
            </div>

            {/* 장비 정보 */}
            <div className="p-4 space-y-3">
              <div className="bg-gray-50 rounded-lg p-3 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">S/N</span>
                  <span className="font-mono font-medium text-gray-900">{customerEquipmentInfo.EQT_SERNO}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">모델</span>
                  <span className="font-medium text-gray-900">{customerEquipmentInfo.ITEM_NM || '-'}</span>
                </div>
                {customerEquipmentInfo.ITEM_MID_NM && (
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">분류</span>
                    <span className="text-gray-700">{customerEquipmentInfo.ITEM_MID_NM}</span>
                  </div>
                )}
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">지점</span>
                  <span className="text-gray-700">{customerEquipmentInfo.SO_NM || '-'}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">위치</span>
                  <span className={`font-medium ${
                    customerEquipmentInfo.EQT_LOC_TP_NM === '고객사용중' ? 'text-amber-600' :
                    customerEquipmentInfo.EQT_LOC_TP_NM === '협력업체' ? 'text-purple-600' :
                    'text-gray-600'
                  }`}>
                    {customerEquipmentInfo.EQT_LOC_TP_NM}
                  </span>
                </div>
                {customerEquipmentInfo.EQT_LOC_NM && (
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">상세위치</span>
                    <span className="text-gray-700 text-right max-w-[200px] truncate">{customerEquipmentInfo.EQT_LOC_NM}</span>
                  </div>
                )}
                {customerEquipmentInfo.WRKR_NM && customerEquipmentInfo.WRKR_NM !== '-' && (
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">보유기사</span>
                    <span className="text-gray-700">{customerEquipmentInfo.WRKR_NM}</span>
                  </div>
                )}
                {customerEquipmentInfo.MAC_ADDRESS && (
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">MAC</span>
                    <span className="font-mono text-xs text-gray-600">{formatMac(customerEquipmentInfo.MAC_ADDRESS)}</span>
                  </div>
                )}
              </div>

              {customerEquipmentInfo.EQT_LOC_TP_NM === '고객사용중' && (
                <p className="text-xs text-amber-600 bg-amber-50 p-2 rounded-lg">
                  고객사용중 장비는 이동할 수 없습니다. 해지/반납 후 이동 가능합니다.
                </p>
              )}
            </div>

            {/* 닫기 버튼 */}
            <div className="p-4 border-t border-gray-100 bg-gray-50">
              <button
                onClick={() => {
                  setShowCustomerEquipmentModal(false);
                  setCustomerEquipmentInfo(null);
                }}
                className="w-full py-2.5 bg-gray-800 hover:bg-gray-900 text-white rounded-lg font-medium transition-colors"
              >
                확인
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default EquipmentMovement;
