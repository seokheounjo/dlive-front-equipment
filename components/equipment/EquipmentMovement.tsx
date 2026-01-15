import React, { useState, useEffect, useRef } from 'react';
import { findUserList, getWrkrHaveEqtListAll as getWrkrHaveEqtList, searchWorkersByName, changeEquipmentWorker, getEquipmentHistoryInfo, saveTransferredEquipment } from '../../services/apiService';
import { debugApiCall } from './equipmentDebug';
import { Scan, Search, ChevronDown, ChevronUp, Check, X, User, RotateCcw } from 'lucide-react';
import BarcodeScanner from './BarcodeScanner';
import BaseModal from '../common/BaseModal';

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

// Scan mode type: scan(단일스캔), equipment(장비번호), worker(보유기사)
type ScanMode = 'scan' | 'equipment' | 'worker';

interface EquipmentMovementProps {
  onBack: () => void;
}

interface EqtTrns {
  CHK: boolean;
  EQT_NO: string;
  ITEM_MAX_NM: string;
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
  const [searchedWorkers, setSearchedWorkers] = useState<{ USR_ID: string; USR_NM: string }[]>([]);

  // 조회 모드: equipment(장비조회), worker(보유기사)
  const [scanMode, setScanMode] = useState<ScanMode>('scan');

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
  const [modalSelectedSoId, setModalSelectedSoId] = useState<string>('');  // 모달 내 지점 선택
  const [modalEquipmentList, setModalEquipmentList] = useState<EqtTrns[]>([]);
  const [isLoadingModalEquipment, setIsLoadingModalEquipment] = useState(false);
  const [modalModelFilter, setModalModelFilter] = useState<string>('');  // 모델 필터 (빈값=전체)
  const [modalSearchModelFilter, setModalSearchModelFilter] = useState<string>('');  // 검색 시 모델 필터

  // 이관지점 선택 (AUTH_SO_List 기반)
  const [userAuthSoList, setUserAuthSoList] = useState<{ SO_ID: string; SO_NM: string }[]>([]);
  const [targetSoId, setTargetSoId] = useState<string>('');

  // 이관 확인 모달
  const [showTransferModal, setShowTransferModal] = useState(false);

  useEffect(() => {
    loadInitialData();
  }, []);

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
        const ownerWrkrId = eqt.WRKR_ID || eqt.OWNER_WRKR_ID;
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
        const ownerWrkrId = eqt.WRKR_ID || eqt.OWNER_WRKR_ID;
        const ownerWrkrNm = eqt.WRKR_NM || eqt.OWNER_WRKR_NM || '알수없음';
        const ownerCrrId = eqt.CRR_ID || '';

        if (ownerWrkrId) {
          setScannedSerials([normalizedSN]);
          setWorkerInfo(prev => ({ ...prev, WRKR_ID: ownerWrkrId, WRKR_NM: ownerWrkrNm, CRR_ID: ownerCrrId }));
          await searchEquipmentByWorker(ownerWrkrId, ownerWrkrNm, ownerCrrId, normalizedSN);
          setHasSearched(true);
        } else {
          // WRKR_ID 없으면 WRKR_NM으로 장비 정보만 표시
          alert('장비(' + normalizedSN + ')의 보유기사 ID가 없습니다.\n현재 보유: ' + ownerWrkrNm);
        }
      } else {
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
  const searchEquipmentByWorker = async (wrkrId: string, wrkrNm: string, crrId?: string, scannedSN?: string) => {
    setIsLoading(true);
    try {
      // CRR_ID=""로 전체 협력업체 조회 (타기사 장비 조회용)
      const params: any = { WRKR_ID: wrkrId, CRR_ID: '' };
      const result = await debugApiCall('EquipmentMovement', 'getWrkrHaveEqtList', () => getWrkrHaveEqtList(params), params);

      if (Array.isArray(result) && result.length > 0) {
        let transformedList: EqtTrns[] = result.map((item: any) => ({
          CHK: false,
          EQT_NO: item.EQT_NO || '',
          ITEM_MAX_NM: item.ITEM_MAX_NM || '',
          ITEM_MID_NM: item.ITEM_MID_NM || '',
          EQT_CL_CD: item.EQT_CL_CD || '',
          EQT_CL_NM: item.EQT_CL_NM || '',
          ITEM_NM: item.ITEM_NM || '',
          ITEM_SPEC: item.ITEM_SPEC || '',
          MST_SO_ID: item.MST_SO_ID || '',
          MST_SO_NM: item.MST_SO_NM || '',
          SO_ID: item.SO_ID || workerInfo.SO_ID,
          SO_NM: item.SO_NM || '',
          EQT_SERNO: item.EQT_SERNO || '',
          MAC_ADDRESS: item.MAC_ADDRESS || '',
          TA_MAC_ADDRESS: item.TA_MAC_ADDRESS || '',
          WRKR_NM: item.WRKR_NM || wrkrNm,
          CRR_NM: item.CRR_NM || '',
          isScanned: scannedSN ? item.EQT_SERNO === scannedSN || scannedSerials.includes(item.EQT_SERNO) : scannedSerials.includes(item.EQT_SERNO)
        }));

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

        setEqtTrnsList(transformedList);
      } else {
        setEqtTrnsList([]);
        alert('조회된 장비가 없습니다.');
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

  // 기사 검색 (팝업 내에서) - 보유장비 API로 기사 확인
  const handleWorkerModalSearch = async () => {
    const keyword = workerSearchKeyword.trim();
    if (!keyword) {
      alert('기사 ID를 입력해주세요.');
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
      let params: any;
      if (isNameSearch) {
        // 이름 검색: SO_ID로 지점 작업자 전체 조회 후 클라이언트 필터링
        // (레거시 API가 이름 검색을 지원하지 않음)
        if (!modalSelectedSoId) {
          alert('이름으로 검색하려면 지점을 먼저 선택해주세요.');
          setIsSearchingWorker(false);
          return;
        }
        console.log('[장비이동] 이름 검색:', keyword, '지점:', modalSelectedSoId, '협력업체:', loggedInUser.crrId);

        // 지점별 전체 작업자 조회 (CRR_ID 필수)
        const allWorkers = await findUserList({
          SO_ID: modalSelectedSoId,
          CRR_ID: loggedInUser.crrId  // 협력업체 필수
        });
        console.log('[장비이동] 지점 작업자 전체:', allWorkers.length, '명');

        // 클라이언트에서 이름 필터링 (부분 일치)
        const searchLower = keyword.toLowerCase();
        const filteredWorkers = allWorkers.filter((w: any) => {
          const name = w.USR_NAME_EN || w.USR_NM || w.WRKR_NM || '';
          return name.toLowerCase().includes(searchLower);
        });

        if (filteredWorkers.length > 0) {
          const workersToShow = filteredWorkers.slice(0, 20);  // 최대 20명 (장비 조회 때문에)
          console.log('[장비이동] 이름 검색 결과:', workersToShow.length, '명, 장비 수 조회 중...', modalSearchModelFilter ? `(모델: ${modalSearchModelFilter})` : '');

          // 각 기사별 장비 수 병렬 조회 (모델 필터 적용)
          const workersWithCount = await Promise.all(
            workersToShow.map(async (w: any) => {
              const wrkrId = w.USR_ID || w.WRKR_ID;
              try {
                const eqtResult = await getWrkrHaveEqtList({ WRKR_ID: wrkrId, CRR_ID: '' });
                // 모델 필터가 있으면 해당 모델만 카운트
                let filteredEqt = Array.isArray(eqtResult) ? eqtResult : [];
                if (modalSearchModelFilter && filteredEqt.length > 0) {
                  filteredEqt = filteredEqt.filter((e: any) => {
                    const modelName = e.ITEM_MID_NM || e.EQT_CL_NM || '';
                    return modelName.includes(modalSearchModelFilter);
                  });
                }
                return {
                  USR_ID: wrkrId,
                  USR_NM: w.USR_NAME_EN || w.USR_NM || w.WRKR_NM || '-',
                  CRR_ID: w.CRR_ID || '',
                  EQT_COUNT: filteredEqt.length
                };
              } catch {
                return {
                  USR_ID: wrkrId,
                  USR_NM: w.USR_NAME_EN || w.USR_NM || w.WRKR_NM || '-',
                  CRR_ID: w.CRR_ID || '',
                  EQT_COUNT: 0
                };
              }
            })
          );

          // 모델 필터 시 0건인 기사 제외 옵션 (장비가 있는 기사만 표시)
          const finalWorkers = modalSearchModelFilter
            ? workersWithCount.filter(w => w.EQT_COUNT > 0)
            : workersWithCount;

          console.log('[장비이동] 장비 수 조회 완료:', finalWorkers.map(w => `${w.USR_NM}(${w.EQT_COUNT}건)`).join(', '));
          setSearchedWorkers(finalWorkers);

          if (modalSearchModelFilter && finalWorkers.length === 0) {
            alert(`'${modalSearchModelFilter}' 장비를 보유한 기사가 없습니다.`);
          }
        } else {
          setSearchedWorkers([]);
          alert('해당 이름의 기사를 찾을 수 없습니다.');
        }
      } else {
        // ID 검색: getWrkrHaveEqtList API 사용
        console.log('[장비이동] ID 검색:', keyword.toUpperCase(), '지점:', modalSelectedSoId, modalSearchModelFilter ? `모델: ${modalSearchModelFilter}` : '');
        const params = { WRKR_ID: keyword.toUpperCase(), CRR_ID: '', SO_ID: modalSelectedSoId || undefined };
        const equipmentResult = await debugApiCall('EquipmentMovement', 'getWrkrHaveEqtList',
          () => getWrkrHaveEqtList(params),
          params);
        if (equipmentResult && equipmentResult.length > 0) {
          const workerName = equipmentResult[0].WRKR_NM || keyword.toUpperCase();
          const workerCrrId = equipmentResult[0].CRR_ID || '';

          // 모델 필터 적용
          let filteredEqt = equipmentResult;
          if (modalSearchModelFilter) {
            filteredEqt = equipmentResult.filter((e: any) => {
              const modelName = e.ITEM_MID_NM || e.EQT_CL_NM || '';
              return modelName.includes(modalSearchModelFilter);
            });
          }

          if (filteredEqt.length > 0) {
            setSearchedWorkers([{ USR_ID: keyword.toUpperCase(), USR_NM: workerName, CRR_ID: workerCrrId, EQT_COUNT: filteredEqt.length }]);
          } else {
            setSearchedWorkers([]);
            alert(`해당 기사가 '${modalSearchModelFilter}' 장비를 보유하지 않습니다.`);
          }
        } else {
          // 장비가 없는 기사는 표시하지 않음
          setSearchedWorkers([]);
          alert('해당 ID의 기사가 없거나 보유 장비가 없습니다.');
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
        const transformedList: EqtTrns[] = result.map((item: any) => ({
          CHK: false,
          EQT_NO: item.EQT_NO || '',
          ITEM_MAX_NM: item.ITEM_MAX_NM || '',
          ITEM_MID_NM: item.ITEM_MID_NM || '',
          EQT_CL_CD: item.EQT_CL_CD || '',
          EQT_CL_NM: item.EQT_CL_NM || '',
          ITEM_NM: item.ITEM_NM || '',
          ITEM_SPEC: item.ITEM_SPEC || '',
          MST_SO_ID: item.MST_SO_ID || '',
          MST_SO_NM: item.MST_SO_NM || '',
          SO_ID: item.SO_ID || '',
          SO_NM: item.SO_NM || '',
          EQT_SERNO: item.EQT_SERNO || '',
          MAC_ADDRESS: item.MAC_ADDRESS || '',
          TA_MAC_ADDRESS: item.TA_MAC_ADDRESS || '',
          WRKR_NM: item.WRKR_NM || worker.USR_NM,
          CRR_NM: item.CRR_NM || '',
          isScanned: false
        }));
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

  // 모달 내 전체 선택 (필터 적용)
  const handleModalCheckAll = (checked: boolean) => {
    setModalEquipmentList(modalEquipmentList.map(item => {
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
  const handleWorkerSelect = (worker: { USR_ID: string; USR_NM: string; CRR_ID?: string; EQT_COUNT?: number }) => {
    setWorkerInfo(prev => ({ ...prev, WRKR_ID: worker.USR_ID, WRKR_NM: worker.USR_NM, CRR_ID: worker.CRR_ID || '' }));
    setWorkerModalOpen(false);
  };

  // 초기화 (검색 모드로 복귀)
  const handleReset = () => {
    setHasSearched(false);
    setEqtTrnsList([]);
    setScannedSerials([]);
    setWorkerInfo(prev => ({ ...prev, WRKR_ID: '', WRKR_NM: '' }));
    setSerialInput('');
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
    // confirm is now handled in the modal

    setIsLoading(true);
    const results: TransferResult = { success: [], failed: [] };

    try {
      for (const item of checkedItems) {
        try {
          const params = {
            EQT_NO: item.EQT_NO,
            EQT_SERNO: item.EQT_SERNO,
            SO_ID: item.SO_ID || '',
            FROM_WRKR_ID: workerInfo.WRKR_ID,
            TO_WRKR_ID: loggedInUser.userId,
            MV_SO_ID: targetSoId || loggedInUser.soId,  // 선택된 이관지점
            MV_CRR_ID: loggedInUser.crrId,    // 이관 협력업체 (이관받는 기사의 CRR_ID)
            CHG_UID: loggedInUser.userId      // 변경자 ID
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

  // 전체 체크
  const handleCheckAll = (checked: boolean) => setEqtTrnsList(eqtTrnsList.map(item => ({ ...item, CHK: checked })));

  // 개별 체크
  const handleCheckItem = (index: number, checked: boolean) => {
    const newList = [...eqtTrnsList];
    newList[index].CHK = checked;
    setEqtTrnsList(newList);
  };

  // 지점별 전체 체크
  const handleCheckSo = (soKey: string, checked: boolean) => {
    setEqtTrnsList(eqtTrnsList.map(item => {
      const itemSo = item.SO_NM || item.SO_ID || '미지정';
      return itemSo === soKey ? { ...item, CHK: checked } : item;
    }));
  };

  // 장비종류별 전체 체크
  const handleCheckItemType = (soKey: string, itemTypeKey: string, checked: boolean) => {
    setEqtTrnsList(eqtTrnsList.map(item => {
      const itemSo = item.SO_NM || item.SO_ID || '미지정';
      const itemType = item.ITEM_MID_NM || '기타';
      return (itemSo === soKey && itemType === itemTypeKey) ? { ...item, CHK: checked } : item;
    }));
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
    const soKey = item.SO_NM || item.SO_ID || '미지정';
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
      {/* 검색 영역 - 항상 표시 */}
      <>
          {/* 조회 모드 선택 - 3개 버튼 */}
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-1">
            <div className="grid grid-cols-3 gap-2">
          <button
            onClick={() => setScanMode('scan')}
            className={`py-2 px-2 rounded-lg text-sm font-medium transition-all ${
              scanMode === 'scan'
                ? 'bg-purple-500 text-white shadow-sm'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >스캔</button>
          <button
            onClick={() => setScanMode('equipment')}
            className={`py-2 px-2 rounded-lg text-sm font-medium transition-all ${
              scanMode === 'equipment'
                ? 'bg-blue-500 text-white shadow-sm'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >장비번호</button>
          <button
            onClick={() => setScanMode('worker')}
            className={`py-2 px-2 rounded-lg text-sm font-medium transition-all ${
              scanMode === 'worker'
                ? 'bg-green-500 text-white shadow-sm'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >보유기사</button>
        </div>
      </div>

      {/* 단일스캔 영역 (scan 모드) - 바코드 스캔만 */}
      {scanMode === 'scan' && (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
          <div className="mb-3">
            <h3 className="text-sm font-semibold text-gray-800 flex items-center gap-2">
              <Scan className="w-4 h-4" />
              바코드 스캔
            </h3>
            <p className="text-xs text-gray-500 mt-0.5">바코드를 스캔하여 장비를 조회합니다</p>
          </div>

          {/* 바코드 스캔 버튼 */}
          <button
            onClick={() => setShowBarcodeScanner(true)}
            className="w-full py-4 rounded-xl font-semibold text-base shadow-lg flex items-center justify-center gap-3 active:scale-[0.98] transition-all touch-manipulation bg-gradient-to-r from-purple-500 to-purple-600 text-white"
          >
            <Scan className="w-6 h-6" />
            바코드 스캔
          </button>

          {/* 스캔된 장비 표시 영역 */}
          {scannedSerials.length > 0 && (
            <div className="mt-3 p-3 bg-purple-50 border border-purple-200 rounded-lg">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-medium text-purple-700">스캔된 장비 ({scannedSerials.length}건)</span>
                <button
                  onClick={() => setScannedSerials([])}
                  className="text-xs text-purple-600 hover:text-purple-800"
                >
                  전체 삭제
                </button>
              </div>
              <div className="space-y-1 max-h-24 overflow-y-auto">
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
              <button
                onClick={handleScannedSearch}
                disabled={isLoading}
                className="w-full mt-2 py-2 bg-purple-500 hover:bg-purple-600 disabled:bg-gray-300 text-white rounded-lg font-semibold text-sm transition-all active:scale-[0.98]"
              >
                {isLoading ? '조회 중...' : '조회'}
              </button>
            </div>
          )}
        </div>
      )}

      {/* 장비번호 영역 (equipment 모드) - S/N 입력만 */}
      {scanMode === 'equipment' && (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
          <div className="mb-3">
            <h3 className="text-sm font-semibold text-gray-800 flex items-center gap-2">
              <Search className="w-4 h-4" />
              장비번호 조회
            </h3>
            <p className="text-xs text-gray-500 mt-0.5">S/N 또는 MAC 주소를 입력하여 조회합니다</p>
          </div>

          {/* S/N 직접 입력 */}
          <div className="space-y-3">
            <input
              type="text"
              value={serialInput}
              onChange={(e) => setSerialInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSerialSearch()}
              className="w-full px-4 py-3 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 font-mono uppercase"
              placeholder="S/N 또는 MAC 주소 입력"
            />
            <button
              onClick={handleSerialSearch}
              disabled={isLoading || !serialInput.trim()}
              className="w-full py-3 bg-blue-500 hover:bg-blue-600 disabled:bg-gray-300 text-white rounded-lg font-semibold text-sm shadow-sm transition-all active:scale-[0.98]"
            >
              {isLoading ? '조회 중...' : '조회'}
            </button>
          </div>
        </div>
      )}

      {/* 보유기사 조회 영역 (worker 모드) - 지점 제거, ID로만 조회 */}

      {scanMode === 'worker' && (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
          <div className="mb-3">
            <h3 className="text-sm font-semibold text-gray-800 flex items-center gap-2">
              <User className="w-4 h-4" />
              보유기사 검색
            </h3>
            <p className="text-xs text-gray-500 mt-0.5">기사를 검색하여 보유 장비를 조회합니다</p>
          </div>
          <div className="space-y-3">
            {/* 보유기사 입력 - 이름/ID 분리 */}
            <div
              className="flex items-center gap-2 cursor-pointer"
              onClick={openWorkerSearchModal}
            >
              <input
                type="text"
                value={workerInfo.WRKR_NM || ''}
                readOnly
                className="flex-1 min-w-0 px-3 py-2.5 text-sm border border-gray-200 rounded-lg bg-gray-50 cursor-pointer"
                placeholder="기사명"
              />
              <input
                type="text"
                value={workerInfo.WRKR_ID || ''}
                readOnly
                className="w-28 px-3 py-2.5 text-sm border border-gray-200 rounded-lg bg-gray-50 cursor-pointer font-mono"
                placeholder="ID"
              />
            </div>

            {/* 조회 버튼 */}
            <button
              onClick={handleSearch}
              disabled={isLoading || !workerInfo.WRKR_ID}
              className="w-full bg-green-500 hover:bg-green-600 disabled:bg-gray-300 text-white py-2.5 rounded-lg font-semibold text-sm shadow-sm transition-all active:scale-[0.98] touch-manipulation"
            >
              {isLoading ? '조회 중...' : '조회'}
            </button>
          </div>
        </div>
      )}
      </>

      {/* 스캔된 장비 표시 - 조회 전에만 */}
      {!hasSearched && scannedSerials.length > 0 && (
        <div className="bg-purple-50 border border-purple-200 rounded-xl p-3">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-purple-700">스캔된 장비 ({scannedSerials.length})</span>
            <button
              onClick={() => setScannedSerials([])}
              className="text-xs text-purple-600 hover:text-purple-800"
            >
              초기화
            </button>
          </div>
          <div className="flex flex-wrap gap-1 mb-3">
            {scannedSerials.map((sn, idx) => (
              <span key={idx} className="px-2 py-1 bg-purple-100 text-purple-800 text-xs rounded-md font-mono">
                {sn}
              </span>
            ))}
          </div>
          {/* 조회 버튼 */}
          <button
            onClick={handleScannedSearch}
            disabled={isLoading}
            className="w-full bg-purple-500 hover:bg-purple-600 disabled:bg-gray-300 text-white py-3 rounded-lg font-semibold text-sm shadow-sm transition-all active:scale-[0.98]"
          >
            {isLoading ? '조회 중...' : '조회'}
          </button>
        </div>
      )}

      {/* 조회 결과 - 종류별 그룹화 */}
      {eqtTrnsList.length > 0 && (
        <>
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
            {/* 헤더 */}
            <div className="px-4 py-3 bg-gradient-to-r from-gray-50 to-white border-b border-gray-100">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleReset}
                    className="p-1.5 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
                    title="초기화"
                  >
                    <RotateCcw className="w-4 h-4" />
                  </button>
                  <div>
                    <span className="text-sm font-semibold text-gray-800">
                      {workerInfo.WRKR_NM} 보유장비: {eqtTrnsList.length}건
                    </span>
                    <span className="text-sm text-blue-600 ml-2 font-medium">
                      (선택: {eqtTrnsList.filter(item => item.CHK).length}건)
                    </span>
                  </div>
                </div>
                <label className="flex items-center gap-2 text-xs">
                  <input
                    type="checkbox"
                    onChange={(e) => handleCheckAll(e.target.checked)}
                    checked={eqtTrnsList.length > 0 && eqtTrnsList.every(item => item.CHK)}
                    className="rounded"
                  />
                  전체선택
                </label>
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
                          onChange={(e) => { e.stopPropagation(); handleCheckSo(soKey, e.target.checked); }}
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
                                onChange={(e) => { e.stopPropagation(); handleCheckItemType(soKey, itemTypeKey, e.target.checked); }}
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
                              {items.map((item) => {
                                const globalIndex = item._globalIdx;
                                return (
                            <div
                              key={item.EQT_NO || idx}
                              className={`p-3 rounded-lg border-2 transition-all ${item.isScanned ? 'bg-purple-50 border-purple-200' : 'bg-gray-50 border-transparent hover:border-gray-200'}`}
                            >
                              <div className="flex items-start gap-3">
                                <input
                                  type="checkbox"
                                  checked={item.CHK || false}
                                  onChange={(e) => handleCheckItem(globalIndex, e.target.checked)}
                                  className="w-5 h-5 rounded focus:ring-blue-500 mt-0.5 text-blue-500"
                                />
                                <div className="flex-1 min-w-0">
                                  {/* 간단히 보기: 1줄 - 모델명 */}
                                  <div className="flex items-center gap-2">
                                    <span className="text-base font-bold text-gray-900 truncate">{item.EQT_CL_NM || item.ITEM_NM || '-'}</span>
                                    {item.isScanned && (
                                      <span className="px-1.5 py-0.5 bg-purple-500 text-white text-xs rounded font-medium flex-shrink-0">스캔</span>
                                    )}
                                  </div>
                                  {/* 간단히 보기: 2줄 - S/N + 상태뱃지 */}
                                  <div className="flex items-center justify-between mt-1">
                                    <span className="font-mono text-sm text-gray-700">{item.EQT_SERNO || '-'}</span>
                                    <span className={`px-2 py-0.5 rounded-full text-sm font-semibold flex-shrink-0 ${
                                      item.EQT_USE_ARR_YN === 'Y' ? 'bg-green-100 text-green-700' :
                                      item.EQT_USE_ARR_YN === 'A' ? 'bg-purple-100 text-purple-700' :
                                      item.EQT_USE_ARR_YN === 'N' ? 'bg-red-100 text-red-700' :
                                      'bg-gray-100 text-gray-700'
                                    }`}>
                                      {item.EQT_USE_ARR_YN === 'Y' ? '사용가능' :
                                       item.EQT_USE_ARR_YN === 'A' ? '검사대기' :
                                       item.EQT_USE_ARR_YN === 'N' ? '사용불가' : 'n/a'}
                                    </span>
                                  </div>
                                  {/* 간단히 보기: 3줄 - MAC + 사용가능일자 */}
                                  <div className="flex items-center justify-between mt-0.5">
                                    <span className="font-mono text-sm text-gray-500">{formatMac(item.MAC_ADDRESS)}</span>
                                    <span className="text-sm text-gray-500">{formatDateDot(item.EQT_USE_END_DT || '')}</span>
                                  </div>
                                </div>
                              </div>
                              {/* 자세히 보기 - 체크박스 영역 바깥, ml-6으로 정렬 */}
                              {viewMode === 'detail' && (
                                <div className="bg-gray-100 rounded-lg p-2 mt-2 ml-6 text-sm space-y-1">
                                  <div><span className="text-sm text-gray-500">지점          </span><span className="text-sm font-medium text-gray-800">{item.SO_NM || '-'}</span></div>
                                  <div><span className="text-sm text-gray-500">장비상태  : </span><span className="text-sm text-gray-800">{item.EQT_STAT_CD_NM || '-'}</span></div>
                                  <div><span className="text-sm text-gray-500">변경종류  : </span><span className="text-sm text-gray-800">{item.CHG_KND_NM || '-'}</span></div>
                                  <div><span className="text-sm text-gray-500">현재위치  : </span><span className="text-sm text-gray-800">{item.EQT_LOC_NM || item.EQT_LOC_TP_NM || '-'}</span></div>
                                  <div><span className="text-sm text-gray-500">이전위치  : </span><span className="text-sm text-gray-800">{item.OLD_EQT_LOC_NM || '-'}</span></div>
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
            바코드를 스캔하거나 기사를 검색하여<br />장비를 조회하세요
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
          {/* 이관지점 선택 */}
          {userAuthSoList.length > 1 && (
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
              <label className="block text-sm font-semibold text-blue-800 mb-2">
                이관지점 선택
              </label>
              <select
                value={targetSoId}
                onChange={(e) => setTargetSoId(e.target.value)}
                className="w-full px-4 py-3 border border-blue-300 rounded-xl text-sm bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                {userAuthSoList.map((so) => (
                  <option key={so.SO_ID} value={so.SO_ID}>
                    {so.SO_NM} ({so.SO_ID})
                  </option>
                ))}
              </select>
              <p className="text-xs text-blue-600 mt-2">
                장비가 선택한 지점으로 이관됩니다
              </p>
            </div>
          )}

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
              {/* 지점 + 모델 선택 */}
              <div className="flex gap-2">
                {userAuthSoList.length > 0 && (
                  <select
                    value={modalSelectedSoId}
                    onChange={(e) => setModalSelectedSoId(e.target.value)}
                    className="flex-1 px-3 py-2 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-green-500 bg-white"
                  >
                    <option value="">전체 지점</option>
                    {userAuthSoList.map((so) => (
                      <option key={so.SO_ID} value={so.SO_ID}>
                        {so.SO_NM}
                      </option>
                    ))}
                  </select>
                )}
                <select
                  value={modalSearchModelFilter}
                  onChange={(e) => setModalSearchModelFilter(e.target.value)}
                  className="flex-1 px-3 py-2 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-green-500 bg-white"
                >
                  <option value="">전체 모델</option>
                  <option value="STB">STB</option>
                  <option value="모뎀">모뎀</option>
                  <option value="Smart card">Smart card</option>
                  <option value="CVT">CVT</option>
                  <option value="Cable Card">Cable Card</option>
                  <option value="Converter">Converter</option>
                  <option value="IP폰">IP폰</option>
                  <option value="HANDY">HANDY</option>
                </select>
              </div>
              {/* 검색 입력 */}
              <div className="flex gap-2">
                <input
                  type="text"
                  value={workerSearchKeyword}
                  onChange={(e) => setWorkerSearchKeyword(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleWorkerModalSearch()}
                  className="flex-1 px-3 py-2 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-green-500"
                  placeholder="이름 또는 ID 입력"
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
                    className={`px-4 py-3 flex items-center gap-3 ${item.CHK ? 'bg-blue-50' : 'hover:bg-gray-50'}`}
                  >
                    <input
                      type="checkbox"
                      checked={item.CHK || false}
                      onChange={(e) => handleModalEquipmentCheck(idx, e.target.checked)}
                      className="rounded flex-shrink-0"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="px-1.5 py-0.5 bg-blue-100 text-blue-700 text-[10px] rounded font-medium">
                          {item.ITEM_MID_NM || item.EQT_CL_NM || '장비'}
                        </span>
                        <span className="font-mono text-xs text-gray-800 truncate">
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
                  <div className="flex flex-col">
                    <span className="font-medium text-gray-900">{worker.USR_NM}</span>
                    <span className="text-xs text-gray-500">{worker.USR_ID}</span>
                  </div>
                  <span className={`text-xs px-2 py-1 rounded ${modalSearchModelFilter ? 'text-green-600 bg-green-50' : 'text-blue-600 bg-blue-50'}`}>
                    {worker.EQT_COUNT !== undefined ? `${worker.EQT_COUNT}건${modalSearchModelFilter ? ` (${modalSearchModelFilter})` : ''}` : ''}
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
    </div>
  );
};

export default EquipmentMovement;
