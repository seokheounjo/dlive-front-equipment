import React, { useState, useEffect } from 'react';
import { ArrowDown, ArrowUp, CheckCircle2, XCircle, Loader2, Radio, RotateCcw, Camera, ScanBarcode } from 'lucide-react';
import { WorkItem, Equipment } from '../../types';
import { getTechnicianEquipments, EquipmentInfo, updateEquipmentComposition, checkStbServerConnection } from '../../services/apiService';
import EquipmentModelChangeModal from '../equipment/EquipmentModelChangeModal';
import { useWorkProcessStore } from '../../stores/workProcessStore';

interface EquipmentManagementProps {
  workItem: WorkItem;
  onSave: (data: EquipmentData) => void;
  onBack: () => void;
  showToast?: (message: string, type: 'success' | 'error' | 'warning' | 'info') => void;
  preloadedApiData?: any; // Pre-loaded API 데이터 (WorkProcessFlow에서 미리 로드한 것)
  readOnly?: boolean; // 완료된 작업 - 읽기 전용 모드
}

interface EquipmentData {
  installedEquipments: Equipment[];
  removedEquipments: Equipment[];
}

interface ExtendedEquipment extends Equipment {
  itemMidCd?: string; // 04:모뎀, 05:셋톱박스, 07:특수장비, 03:추가장비
  eqtClCd?: string;   // 장비 클래스 코드 (모델 코드)
  macAddress?: string;
  installLocation?: string;
  // 레거시 시스템 필수 필드 추가
  SVC_CMPS_ID?: string;
  WRK_ID?: string;
  CUST_ID?: string;
  CTRT_ID?: string;
  BASIC_PROD_CMPS_ID?: string;
  EQT_PROD_CMPS_ID?: string;
  MST_SO_ID?: string;
  SO_ID?: string;
  REG_UID?: string;
  OLD_LENT_YN?: string;
  WRK_CD?: string;
  EQT_CHG_GB?: string;
  IF_DTL_ID?: string;
  PROD_CD?: string;
  SVC_CD?: string;
  EQT_SALE_AMT?: string;
  LENT?: string;
  ITLLMT_PRD?: string;
  EQT_USE_STAT_CD?: string;
}

// 작업코드 → 한글 변환 (레거시 CMWT000 코드 테이블)
const getWorkCodeName = (wrkCd?: string): string => {
  const codeMap: { [key: string]: string } = {
    '01': '설치',
    '02': '해지',
    '03': 'A/S',
    '04': '이전',
    '05': '상품변경',
    '06': '재설치',
    '07': '추가설치',
    '08': '철거',
    '09': '장비교체',
  };
  return codeMap[wrkCd || ''] || '';
};

// 계약상태코드 → 한글 변환 (레거시 CMCU036 코드 테이블)
const getContractStatusName = (ctrtStat?: string): string => {
  const statusMap: { [key: string]: string } = {
    '10': '설치예정',
    '20': '정상',
    '30': '일시정지',
    '40': '해지예정',
    '90': '해지완료',
  };
  return statusMap[ctrtStat || ''] || '';
};

// 계약 장비 (왼쪽 리스트)
interface ContractEquipment extends ExtendedEquipment {
  // 계약 단계에서는 실제 시리얼 번호가 없음
}

// 고객 설치 장비 (오른쪽 리스트) - 계약 장비 + 실제 재고 매핑
interface InstalledEquipment {
  contractEquipment: ContractEquipment; // 계약 장비 정보
  actualEquipment: ExtendedEquipment;   // 실제 할당된 재고 장비
  macAddress?: string;
  installLocation?: string;
}

const EquipmentManagement: React.FC<EquipmentManagementProps> = ({ workItem, onSave, onBack, showToast, preloadedApiData, readOnly = false }) => {
  // 작업 완료 여부 확인 (props 또는 workItem 상태로 판단)
  const isWorkCompleted = readOnly || workItem.WRK_STAT_CD === '4' || workItem.status === '완료';

  // Work Process Store (필터링 데이터 저장용)
  const { setFilteringData } = useWorkProcessStore();

  // 계약 장비 (상단 카드)
  const [contractEquipments, setContractEquipments] = useState<ContractEquipment[]>([]);
  // 기사 재고 장비 전체 (하단에서 필터링하여 표시)
  const [technicianEquipments, setTechnicianEquipments] = useState<ExtendedEquipment[]>([]);
  // 고객 설치 장비 (할당 완료된 결과)
  const [installedEquipments, setInstalledEquipments] = useState<InstalledEquipment[]>([]);
  // API output4에서 받아온 고객장비 수 (서버에 이미 등록된 장비)
  const [customerEquipmentCount, setCustomerEquipmentCount] = useState<number>(0);
  // 회수 장비 목록 (고객으로부터 회수할 장비)
  const [removeEquipments, setRemoveEquipments] = useState<ExtendedEquipment[]>([]);
  // 회수 등록할 장비 목록
  const [markedForRemoval, setMarkedForRemoval] = useState<ExtendedEquipment[]>([]);

  // 철거 작업 여부 (WRK_CD='02' 또는 '08')
  const isRemovalWork = ['02', '08'].includes(workItem.WRK_CD || '');

  // 철거 장비 분실/파손 상태 (철거 작업 전용)
  // { [EQT_NO]: { EQT_LOSS_YN, PART_LOSS_BRK_YN, EQT_BRK_YN, EQT_CABL_LOSS_YN, EQT_CRDL_LOSS_YN } }
  const [removalStatus, setRemovalStatus] = useState<{
    [key: string]: {
      EQT_LOSS_YN?: string;        // 분실여부
      PART_LOSS_BRK_YN?: string;   // 아답터분실
      EQT_BRK_YN?: string;         // 장비단분실
      EQT_CABL_LOSS_YN?: string;   // 케이블분실
      EQT_CRDL_LOSS_YN?: string;   // 크래들분실
    };
  }>({});

  // 초기 데이터 로드 완료 여부
  const [isDataLoaded, setIsDataLoaded] = useState(false);

  // 현재 선택된 계약 장비
  const [selectedContract, setSelectedContract] = useState<ContractEquipment | null>(null);

  // 선택된 재고 장비
  const [selectedStock, setSelectedStock] = useState<ExtendedEquipment | null>(null);

  // 장비정보변경 모달 상태
  const [isModelChangeModalOpen, setIsModelChangeModalOpen] = useState(false);

  // 신호처리 팝업 상태
  const [isSignalPopupOpen, setIsSignalPopupOpen] = useState(false);
  const [signalResult, setSignalResult] = useState<string>('');
  const [isSignalProcessing, setIsSignalProcessing] = useState(false);
  const [lastSignalStatus, setLastSignalStatus] = useState<'success' | 'fail' | null>(null);

  // 바코드 스캔 상태
  const [isBarcodeScanning, setIsBarcodeScanning] = useState(false);

  // 초기 데이터 로드
  useEffect(() => {
    setIsDataLoaded(false); // 새로운 workItem이면 로드 상태 초기화
    loadEquipmentData();
  }, [workItem]);

  // localStorage 키 생성
  const getStorageKey = () => `equipment_draft_${workItem.id}`;

  // 작업 중인 데이터 자동 저장 (다른 곳 갔다가 돌아와도 유지)
  useEffect(() => {
    // 초기 데이터 로드가 완료되기 전에는 저장하지 않음 (빈 배열로 덮어쓰는 것 방지)
    if (!isDataLoaded) {
      console.log('[장비관리] 데이터 로드 중 - localStorage 저장 건너뜀');
      return;
    }

    const storageKey = getStorageKey();

    // 장비가 하나라도 있거나, 회수 표시가 있으면 저장
    if (installedEquipments.length > 0 || markedForRemoval.length > 0) {
      const draftData = {
        installedEquipments: installedEquipments,
        markedForRemoval: markedForRemoval,
        lastSignalStatus: lastSignalStatus, // 신호처리 상태 저장
        savedAt: new Date().toISOString(),
        // 설치정보 모달 필터링용 데이터 (API 응답에서 받아온 값)
        kpiProdGrpCd: (window as any).__equipmentFilterData?.kpiProdGrpCd,
        prodChgGb: (window as any).__equipmentFilterData?.prodChgGb,
        chgKpiProdGrpCd: (window as any).__equipmentFilterData?.chgKpiProdGrpCd,
        prodGrp: (window as any).__equipmentFilterData?.prodGrp,
      };
      localStorage.setItem(storageKey, JSON.stringify(draftData));
      console.log('[장비관리] 장비 작업 내용 임시 저장:', draftData);
    } else {
      // 모든 장비를 회수했으면 localStorage에서 삭제
      localStorage.removeItem(storageKey);
      console.log('[장비관리] 모든 장비 회수됨 - localStorage 삭제');
    }
  }, [installedEquipments, markedForRemoval, isDataLoaded, lastSignalStatus]);

  // WRK_CD를 CRR_TSK_CL로 매핑하는 헬퍼 함수
  const mapWrkCdToCrrTskCl = (wrkCd?: string): string => {
    if (!wrkCd) return '01'; // 기본값

    // WRK_CD IN ('01','05','06','07','09') → CRR_TSK_CL = '01' (설치 관련)
    if (['01', '05', '06', '07', '09'].includes(wrkCd)) {
      return '01';
    }
    // WRK_CD IN ('02','04','08') → CRR_TSK_CL = '02' (해지/이전)
    if (['02', '04', '08'].includes(wrkCd)) {
      return '02';
    }
    // WRK_CD = '03' → CRR_TSK_CL = '03' (AS)
    if (wrkCd === '03') {
      return '03';
    }

    return '01'; // 기본값
  };

  const loadEquipmentData = async (forceRefresh = false) => {
    try {
      let apiResponse;

      // forceRefresh가 true면 캐시 무시하고 무조건 API 호출
      // Pre-loaded 데이터가 있으면 API 호출 건너뛰기 (성능 최적화!)
      if (preloadedApiData && !forceRefresh) {
        console.log('🚀 [장비관리] Pre-loaded 데이터 사용 - API 호출 건너뜀!');
        console.log('[장비관리] Pre-loaded 데이터:', {
          contractEquipments: preloadedApiData.contractEquipments?.length || 0,
          technicianEquipments: preloadedApiData.technicianEquipments?.length || 0,
          customerEquipments: preloadedApiData.customerEquipments?.length || 0,
          removedEquipments: preloadedApiData.removedEquipments?.length || 0,
        });
        apiResponse = preloadedApiData;
      } else {
        // forceRefresh=true이거나 Pre-loaded 데이터 없으면 API 호출
        if (forceRefresh) {
          console.log('🔄 [장비관리] 강제 새로고침 - API 호출');
        }
        const userInfo = localStorage.getItem('userInfo');
        if (!userInfo) {
          console.error('사용자 정보가 없습니다.');
          return;
        }

        const user = JSON.parse(userInfo);
        const crrTskCl = workItem.WRK_CD || '';
        const wrkDtlTcd = workItem.WRK_DTL_TCD || '';

        const requestPayload = {
          WRKR_ID: 'A20130708',
          SO_ID: workItem.SO_ID || user.soId,
          WORK_ID: workItem.id,
          CUST_ID: workItem.customer?.id,
          RCPT_ID: workItem.RCPT_ID || null,
          CTRT_ID: workItem.CTRT_ID || null,
          CRR_ID: workItem.CRR_ID || null,
          ADDR_ORD: workItem.ADDR_ORD || null,
          CRR_TSK_CL: crrTskCl,
          WRK_DTL_TCD: wrkDtlTcd,
          WRK_CD: workItem.WRK_CD || null,
          WRK_STAT_CD: workItem.WRK_STAT_CD || null,
          WRK_DRCTN_ID: workItem.WRK_DRCTN_ID || workItem.directionId || null,
          BLD_ID: workItem.BLD_ID || null,
          PROD_CD: workItem.PROD_CD || null,
        };

        console.log('\n[장비관리] EquipmentManagement - 장비 데이터 로드 (API 호출)');
        console.log('[장비관리] 요청:', requestPayload);

        apiResponse = await getTechnicianEquipments(requestPayload);
      }

      console.log('[장비관리] 응답:');
      console.log('  - 계약장비 (output2):', apiResponse.contractEquipments?.length || 0, '개');
      console.log('  - 기사재고 (output3):', apiResponse.technicianEquipments?.length || 0, '개');
      console.log('  - 고객장비 (output4):', apiResponse.customerEquipments?.length || 0, '개');
      console.log('  - 회수장비 (output5):', apiResponse.removedEquipments?.length || 0, '개');
      console.log('  - 필터링 데이터:', {
        kpiProdGrpCd: apiResponse.kpiProdGrpCd,
        prodChgGb: apiResponse.prodChgGb,
        chgKpiProdGrpCd: apiResponse.chgKpiProdGrpCd,
        prodGrp: apiResponse.prodGrp,
      });

      // 필터링 데이터를 Zustand Store에 저장
      const filterData = {
        kpiProdGrpCd: apiResponse.kpiProdGrpCd,
        prodChgGb: apiResponse.prodChgGb,
        chgKpiProdGrpCd: apiResponse.chgKpiProdGrpCd,
        prodGrp: apiResponse.prodGrp,
      };
      setFilteringData(filterData);
      // 하위 호환성을 위해 window 객체에도 저장
      (window as any).__equipmentFilterData = filterData;

      // output2: 계약 장비 (왼쪽)
      console.log('[장비관리] 🔍 output2 원본 데이터:', apiResponse.contractEquipments);
      const contracts: ContractEquipment[] = (apiResponse.contractEquipments || []).map((eq: any, idx: number) => {
        console.log(`[장비관리] 🔍 계약장비[${idx}] 매핑:`, {
          원본: eq,
          id: eq.SVC_CMPS_ID || eq.PROD_CMPS_ID,
          type: eq.ITEM_MID_NM || eq.EQT_NM,
          model: eq.EQT_CL_NM,
          itemMidCd: eq.ITEM_MID_CD,
        });
        return {
          id: eq.SVC_CMPS_ID || eq.PROD_CMPS_ID,
          type: eq.ITEM_MID_NM || eq.EQT_NM,
          model: eq.EQT_CL_NM,
          serialNumber: 'N/A',
          itemMidCd: eq.ITEM_MID_CD,
          eqtClCd: eq.EQT_CL_CD || eq.EQT_CL,
          // API 응답의 추가 필드 보존
          SVC_CMPS_ID: eq.SVC_CMPS_ID,
          BASIC_PROD_CMPS_ID: eq.BASIC_PROD_CMPS_ID,
          PROD_CD: eq.PROD_CD,
          SVC_CD: eq.SVC_CD,
        };
      });

      // output3: 기사 재고 (팝업 선택용)
      const techStock: ExtendedEquipment[] = (apiResponse.technicianEquipments || []).map((eq: any) => ({
        id: eq.EQT_NO,
        type: eq.ITEM_MID_NM,
        model: eq.EQT_CL_NM,
        serialNumber: eq.EQT_SERNO,
        itemMidCd: eq.ITEM_MID_CD,
        eqtClCd: eq.EQT_CL_CD || eq.EQT_CL,
        macAddress: eq.MAC_ADDRESS,
        // API 응답의 모든 필드 보존
        SVC_CMPS_ID: eq.SVC_CMPS_ID,
        BASIC_PROD_CMPS_ID: eq.BASIC_PROD_CMPS_ID,
        EQT_PROD_CMPS_ID: eq.EQT_PROD_CMPS_ID,
        PROD_CD: eq.PROD_CD,
        SVC_CD: eq.SVC_CD,
        EQT_SALE_AMT: eq.EQT_SALE_AMT,
        MST_SO_ID: eq.MST_SO_ID,
        SO_ID: eq.SO_ID,
        OLD_LENT_YN: eq.OLD_LENT_YN,
        LENT: eq.LENT,
        ITLLMT_PRD: eq.ITLLMT_PRD,
        EQT_USE_STAT_CD: eq.EQT_USE_STAT_CD,
      }));

      // output4: 고객 설치 장비 (이미 등록된 경우)
      const installed: InstalledEquipment[] = (apiResponse.customerEquipments || []).map((eq: any) => {
        // 고객 장비가 이미 있는 경우, 어떤 계약 장비에 대응되는지 찾기
        const matchedContract = contracts.find(c => c.itemMidCd === eq.ITEM_MID_CD);
        return {
          contractEquipment: matchedContract || {
            id: 'unknown',
            type: eq.ITEM_MID_NM,
            model: '',
            serialNumber: 'N/A',
            itemMidCd: eq.ITEM_MID_CD,
          },
          actualEquipment: {
            id: eq.EQT_NO,
            type: eq.ITEM_MID_NM,
            model: eq.EQT_CL_NM,
            serialNumber: eq.EQT_SERNO,
            itemMidCd: eq.ITEM_MID_CD,
            macAddress: eq.MAC_ADDRESS || eq.MAC_ADDR,
          },
          macAddress: eq.MAC_ADDRESS || eq.MAC_ADDR,
          installLocation: eq.INSTL_LCTN,
        };
      });

      // output5: 회수 장비 (고객으로부터 회수해야 할 장비)
      const removed: ExtendedEquipment[] = (apiResponse.removedEquipments || []).map((eq: any) => ({
        id: eq.EQT_NO,
        type: eq.ITEM_MID_NM,
        model: eq.EQT_CL_NM,
        serialNumber: eq.EQT_SERNO,
        itemMidCd: eq.ITEM_MID_CD,
        eqtClCd: eq.EQT_CL_CD || eq.EQT_CL,
        macAddress: eq.MAC_ADDRESS || eq.MAC_ADDR,
        installLocation: eq.INSTL_LCTN,
        // API 응답의 모든 필드 보존
        SVC_CMPS_ID: eq.SVC_CMPS_ID,
        BASIC_PROD_CMPS_ID: eq.BASIC_PROD_CMPS_ID,
        MST_SO_ID: eq.MST_SO_ID,
        SO_ID: eq.SO_ID,
      }));

      console.log('[장비관리] 상태 업데이트:');
      console.log('  - 계약 장비:', contracts.length, '개');
      console.log('  - 기사 재고:', techStock.length, '개');
      console.log('  - 설치 완료:', installed.length, '개');
      console.log('  - 회수 대상:', removed.length, '개\n');

      setContractEquipments(contracts);
      setTechnicianEquipments(techStock);
      setRemoveEquipments(removed);
      // API에서 받은 고객장비 수 저장 (서버에 이미 등록된 장비 - 장비정보변경 버튼 비활성화용)
      setCustomerEquipmentCount(installed.length);

      console.log('[장비관리] ====== 장비 초기화 시작 ======');
      console.log('[장비관리] API에서 받은 고객 설치 장비 (output4):', installed.length, '개');
      console.log('[장비관리] 작업 완료 여부:', isWorkCompleted);
      if (installed.length > 0) {
        console.log('[장비관리] API 장비 상세:', installed);
      }

      // ⭐️ API output4에 이미 설치된 장비가 있으면 그걸 우선 표시 (서버 데이터 우선)
      if (installed.length > 0) {
        console.log('[장비관리] ✅ API에서 받은 고객 설치 장비 사용:', installed.length, '개');
        setInstalledEquipments(installed);
        // API 데이터가 있으면 localStorage는 무시 (서버 데이터가 최신)
        // 단, 신호처리 상태는 localStorage에서 복원
        const savedDraft = localStorage.getItem(getStorageKey());
        if (savedDraft) {
          try {
            const draftData = JSON.parse(savedDraft);
            if (draftData.lastSignalStatus) {
              console.log('[장비관리] localStorage에서 신호처리 상태 복원:', draftData.lastSignalStatus);
              setLastSignalStatus(draftData.lastSignalStatus);
            }
          } catch (error) {
            // 무시
          }
        }
      } else {
        // API에 고객장비가 없으면 localStorage에서 복원 시도
        const savedDraft = localStorage.getItem(getStorageKey());
        console.log('[장비관리] localStorage 키:', getStorageKey());
        console.log('[장비관리] localStorage 데이터 존재:', !!savedDraft);

        if (savedDraft) {
          try {
            const draftData = JSON.parse(savedDraft);
            console.log('[장비관리] localStorage에서 발견된 데이터:', {
              installedCount: draftData.installedEquipments?.length || 0,
              markedForRemovalCount: draftData.markedForRemoval?.length || 0,
              savedAt: draftData.savedAt
            });

            // ⚠️ 중요: localStorage 데이터 복원 (등록 버튼으로 추가한 장비만)
            if (draftData.installedEquipments && draftData.installedEquipments.length > 0) {
              console.log('[장비관리] ⚠️ localStorage에서 장비 복원:', draftData.installedEquipments.length, '개');
              setInstalledEquipments(draftData.installedEquipments);
            } else {
              console.log('[장비관리] localStorage에 장비 없음 - 빈 배열로 초기화');
              setInstalledEquipments([]);
            }

            // 저장된 회수 선택 장비 복원
            if (draftData.markedForRemoval && draftData.markedForRemoval.length > 0) {
              setMarkedForRemoval(draftData.markedForRemoval);
            }

            // 신호처리 상태 복원
            if (draftData.lastSignalStatus) {
              console.log('[장비관리] localStorage에서 신호처리 상태 복원:', draftData.lastSignalStatus);
              setLastSignalStatus(draftData.lastSignalStatus);
            }
          } catch (error) {
            console.warn('[장비관리] localStorage 데이터 파싱 실패:', error);
            setInstalledEquipments([]);
          }
        } else {
          console.log('[장비관리] localStorage 없음 - 완전히 새로운 작업');
          setInstalledEquipments([]);
        }
      }

      console.log('[장비관리] ====== 장비 초기화 완료 ======\n');

      // 데이터 로드 완료 표시
      setIsDataLoaded(true);
    } catch (error) {
      console.error('[장비관리] 장비 데이터 로드 실패:', error);
      setContractEquipments([]);
      setTechnicianEquipments([]);
      setInstalledEquipments([]);

      // 에러가 나도 로드는 완료된 것으로 처리
      setIsDataLoaded(true);
    }
  };

  // 계약 장비 카드 클릭 - 선택/해제
  const handleContractClick = (contract: ContractEquipment) => {
    // 이미 설치된 장비인지 확인
    const installed = installedEquipments.find(
      eq => eq.contractEquipment.id === contract.id
    );

    if (selectedContract?.id === contract.id) {
      // 이미 선택된 것을 다시 클릭하면 선택 해제
      setSelectedContract(null);
      setSelectedStock(null);
    } else {
      // 신규 선택
      setSelectedContract(contract);

      // 이미 설치된 장비면 회수를 위해 실제 장비를 selectedStock에 설정
      if (installed) {
        setSelectedStock(installed.actualEquipment);
      } else {
        setSelectedStock(null);
      }
    }
  };

  // 재고 장비 클릭 - 선택/해제
  const handleStockClick = (stock: ExtendedEquipment) => {
    if (selectedStock?.id === stock.id) {
      // 이미 선택된 것을 다시 클릭하면 선택 해제
      setSelectedStock(null);
    } else {
      // 신규 선택
      setSelectedStock(stock);
    }
  };

  // 등록 버튼 - 계약 장비에 재고 할당
  const handleRegisterEquipment = () => {
    if (!selectedContract || !selectedStock) {
      return; // 조용히 무시
    }

    console.log('[장비관리] 장비 등록 시작:', {
      계약장비: selectedContract.type,
      재고장비: `${selectedStock.type} (S/N: ${selectedStock.serialNumber})`
    });

    // 기존에 할당된 장비인지 확인
    const existingIndex = installedEquipments.findIndex(
      eq => eq.contractEquipment.id === selectedContract.id
    );

    if (existingIndex >= 0) {
      // 수정: 기존 할당 교체
      const updated = [...installedEquipments];
      updated[existingIndex] = {
        contractEquipment: selectedContract,
        actualEquipment: selectedStock,
        macAddress: selectedStock.macAddress || '',
        installLocation: '', // 나중에 입력
      };
      setInstalledEquipments(updated);
      console.log('[장비관리] ✅ 기존 장비 교체 완료, 총', updated.length, '개');
    } else {
      // 신규 할당
      const newInstalled: InstalledEquipment = {
        contractEquipment: selectedContract,
        actualEquipment: selectedStock,
        macAddress: selectedStock.macAddress || '',
        installLocation: '', // 나중에 입력
      };
      const updated = [...installedEquipments, newInstalled];
      setInstalledEquipments(updated);
      console.log('[장비관리] ✅ 신규 장비 등록 완료, 총', updated.length, '개');
    }
    // useEffect가 자동으로 localStorage에 저장

    // 신호처리 상태 초기화 (장비가 변경되었으므로)
    setLastSignalStatus(null);
    console.log('[장비관리] 장비 등록 - 신호처리 상태 초기화');

    // 선택 초기화
    setSelectedStock(null);
    setSelectedContract(null);
  };

  // 회수 버튼 - 선택한 재고를 회수 목록에 추가 또는 설치된 장비 제거
  const handleMarkForRemoval = () => {
    if (!selectedStock) {
      return; // 조용히 무시
    }

    // 설치된 장비인지 확인 (installedEquipments에 있는지)
    const installedIndex = installedEquipments.findIndex(
      eq => eq.actualEquipment.id === selectedStock.id
    );

    if (installedIndex >= 0) {
      // 설치된 장비면 installedEquipments에서 제거
      const updated = [...installedEquipments];
      const removedEquipment = updated.splice(installedIndex, 1)[0];
      console.log('[장비관리] 장비 회수 (등록 취소):', {
        장비: removedEquipment.actualEquipment.type,
        시리얼: removedEquipment.actualEquipment.serialNumber,
        계약장비ID: removedEquipment.contractEquipment.id,
        남은개수: updated.length
      });
      setInstalledEquipments(updated);

      // 신호처리 상태 초기화 (장비가 회수되었으므로)
      setLastSignalStatus(null);
      console.log('[장비관리] 장비 회수 - 신호처리 상태 초기화');

      // 선택 상태 초기화 (계약장비가 다시 선택 가능하도록)
      setSelectedStock(null);
      setSelectedContract(null);

      // useEffect가 자동으로 localStorage 업데이트 (빈 배열이면 삭제)
      return;
    }

    // removeEquipments에 있는 장비면 회수 목록에 추가
    const isAlreadyMarked = markedForRemoval.some(eq => eq.id === selectedStock.id);
    if (isAlreadyMarked) {
      return; // 이미 추가된 경우 무시
    }

    // removeEquipments에 있는 장비인지 확인
    const isRemoveEquipment = removeEquipments.some(eq => eq.id === selectedStock.id);
    if (isRemoveEquipment) {
      setMarkedForRemoval([...markedForRemoval, selectedStock]);
    }
    // 선택 상태 유지
  };

  // 할당 삭제
  const handleRemoveAssignment = (contract: ContractEquipment) => {
    setInstalledEquipments(installedEquipments.filter(
      eq => eq.contractEquipment.id !== contract.id
    ));

    // 현재 선택된 것이면 선택 해제
    if (selectedContract?.id === contract.id) {
      setSelectedContract(null);
    }
  };

  // MAC 주소 수정
  const handleMacAddressChange = (contractId: string, newMacAddress: string) => {
    const updated = installedEquipments.map(eq => {
      if (eq.contractEquipment.id === contractId) {
        return { ...eq, macAddress: newMacAddress };
      }
      return eq;
    });
    setInstalledEquipments(updated);
  };

  // 기사 재고 필터링 - 레거시와 동일하게 모델명(EQT_CL_NM)까지 필터링
  // 레거시: ds_wrkr_eqt_info.Filter("length(BAR_CD)==0 && EQT_CL_NM='"+ds_eqt_info.GetColumn(0,"EQT_CL_NM")+"'")
  const getAvailableStock = (): ExtendedEquipment[] => {
    // 이미 할당된 재고 ID 수집
    const usedStockIds = new Set(
      installedEquipments.map(eq => eq.actualEquipment.id)
    );

    // 사용 중이 아닌 재고 필터링
    let available = technicianEquipments.filter(stock => !usedStockIds.has(stock.id));

    // 고객 장비가 선택되어 있으면 같은 종류 + 같은 모델만 필터링 (레거시 동일)
    if (selectedContract) {
      available = available.filter(stock =>
        stock.itemMidCd === selectedContract.itemMidCd &&
        stock.model === selectedContract.model  // EQT_CL_NM 일치 조건 추가
      );
    }

    return available;
  };

  // 회수 장비 토글
  const toggleRemovalMark = (equipment: ExtendedEquipment) => {
    const isMarked = markedForRemoval.some(eq => eq.id === equipment.id);

    if (isMarked) {
      setMarkedForRemoval(markedForRemoval.filter(eq => eq.id !== equipment.id));
    } else {
      setMarkedForRemoval([...markedForRemoval, equipment]);
    }
  };

  // 장비 모델 변경 처리 - 모달에서 선택된 계약장비 리스트와 현 상태를 기반으로 전송
  const handleModelChange = async (selectedEquipmentsFromModal: any[], _selectedPromotionCount?: string) => {
    try {
      const userInfo = localStorage.getItem('userInfo');
      if (!userInfo) {
        showToast?.('사용자 정보가 없습니다.', 'error');
        return;
      }

      const user = JSON.parse(userInfo);

      console.log('[장비모델변경] 장비 모델 변경 요청(선택 장비 기반):', {
        selectedEquipmentsFromModal,
        workItem,
      });

      // 각 장비마다 변경 요청 객체 생성 (모달에서 전달된 계약장비 객체 기준)
      const equipments = selectedEquipmentsFromModal.map((eq: any, idx: number) => {
        console.log(`[장비모델변경] handleModelChange 장비[${idx}] 처리:`, {
          PROD_TYP: eq.PROD_TYP,
          EQUIP_SEQ: eq.EQUIP_SEQ,
          전체객체: eq,
        });

        // 모달의 eq는 ContractEquipment 형태를 유지
        let itemMidCd: string =
          eq.ITEM_MID_CD || eq.ITM_MID_CD || eq.EQT || eq.EQT_CD || '';
        let modelCode: string =
          eq.EQT_CL || eq.EQT_CL_CD || '';
        let svcCmpsId: string =
          eq.SVC_CMPS_ID || eq.PROD_CMPS_ID || eq.SVC_CMPS_SEQ || eq.EQUIP_SEQ || '';

        // 코드 포맷 보정 (레거시 호환)
        itemMidCd = String(itemMidCd).trim().padStart(2, '0'); // 2자리
        modelCode = String(modelCode).trim().padStart(6, '0'); // 6자리
        svcCmpsId = String(svcCmpsId || (idx + 1)); // 비어있으면 고유한 순번

        return {
          CTRT_ID: workItem.CTRT_ID || '',
          RCPT_ID: workItem.RCPT_ID || '',
          CRR_ID: workItem.CRR_ID || user.crrId || '',
          WRKR_ID: user.workerId || 'A20130708',
          REG_UID: user.userId || user.workerId || 'A20130708',
          ITEM_MID_CD: itemMidCd,
          EQT_CL: modelCode,
          SVC_CMPS_ID: svcCmpsId,
          // 레거시 키 호환 추가
          EQT: itemMidCd,
          EQT_CD: itemMidCd,
          // 추가 속성(레거시 검증 대응)
          LENT: String(eq.LENT || '10'),
          EQT_USE_STAT_CD: String(eq.EQT_USE_STAT_CD || '1'),
          ITLLMT_PRD: String(eq.ITLLMT_PRD || '00'),
          EQT_SALE_AMT: Number(eq.EQT_SALE_AMT || 0),
          PROD_GRP: String(eq.PROD_GRP || workItem.PROD_GRP || ''),
          PROD_CD: String(eq.PROD_CD || workItem.PROD_CD || ''),
          SVC_CD: String(eq.SVC_CD || ''),
          PROM_CNT: _selectedPromotionCount || '',
          // 선택 표시(셋 구성 확정)
          SEL: '1',
          EQT_BASIC_YN: String(eq.EQT_BASIC_YN || 'N'),
          // ✨ 중요: PROD_TYP과 EQUIP_SEQ를 모달에서 전달받은 그대로 유지
          PROD_TYP: eq.PROD_TYP,
          EQUIP_SEQ: eq.EQUIP_SEQ,
        };
      });

      // 레거시 호환: 누적 파라미터 + equipments 동시 전송
      const result = await updateEquipmentComposition({
        WRK_ID: workItem.id,
        RCPT_ID: workItem.RCPT_ID || '',
        CTRT_ID: workItem.CTRT_ID || '',
        PROM_CNT: _selectedPromotionCount || '',
        equipments
      });

      if ((result as any).MSGCODE === 'SUCCESS' || (result as any).MSGCODE === '0' || (result as any).code === 'SUCCESS') {
        showToast?.('장비 모델이 변경되었습니다.', 'success');
        // 데이터 리로드 (강제 새로고침으로 최신 데이터 가져오기)
        await loadEquipmentData(true);
      } else {
        throw new Error((result as any).MESSAGE || (result as any).message || '장비 모델 변경에 실패했습니다.');
      }
    } catch (error: any) {
      console.error('[장비모델변경] 장비 모델 변경 실패:', error);
      showToast?.(error.message || '장비 모델 변경 중 오류가 발생했습니다.', 'error');
      throw error;
    }
  };

  const handleSignalProcess = async () => {
    console.log('[신호처리] 시작');
    console.log('[신호처리] showToast 함수 존재:', !!showToast);
    console.log('[신호처리] 현재 등록된 장비:', installedEquipments);

    // 장비 타입 판단 헬퍼 함수 (EQT_CL_CD, ITEM_MID_CD, type 복합 판단)
    const isStb = (eq: any): boolean => {
      const eqtClCd = eq.actualEquipment?.eqtClCd || eq.eqtClCd || '';
      const itemMidCd = eq.actualEquipment?.itemMidCd || eq.itemMidCd || '';
      const type = (eq.actualEquipment?.type || eq.type || '').toLowerCase();

      // EQT_CL_CD로 판단 (0904xxx = STB)
      if (eqtClCd.startsWith('0904')) return true;
      // ITEM_MID_CD로 판단 (04 = 모뎀, 05 = STB)
      if (itemMidCd === '05') return true;
      // type 문자열로 판단
      if (type.includes('stb') || type.includes('셋톱') || type.includes('셋탑')) return true;

      console.log('[신호처리] STB 체크:', { type, eqtClCd, itemMidCd, isStb: false });
      return false;
    };

    const isModem = (eq: any): boolean => {
      const eqtClCd = eq.actualEquipment?.eqtClCd || eq.eqtClCd || '';
      const itemMidCd = eq.actualEquipment?.itemMidCd || eq.itemMidCd || '';
      const type = (eq.actualEquipment?.type || eq.type || '').toLowerCase();

      // EQT_CL_CD로 판단 (0902xxx = 모뎀)
      if (eqtClCd.startsWith('0902')) return true;
      // ITEM_MID_CD로 판단 (04 = 모뎀)
      if (itemMidCd === '04') return true;
      // type 문자열로 판단
      if (type.includes('modem') || type.includes('모뎀') || type.includes('케이블모뎀')) return true;

      console.log('[신호처리] 모뎀 체크:', { type, eqtClCd, itemMidCd, isModem: false });
      return false;
    };

    // 1차 검증: 장비가 하나라도 등록되어 있는지
    if (installedEquipments.length === 0) {
      console.log('[신호처리] ❌ 검증 실패: 등록된 장비 없음');
      if (showToast) {
        showToast('신호처리를 하려면 먼저 장비를 등록해주세요. STB 또는 모뎀 장비가 필요합니다.', 'warning');
      } else {
        console.error('[신호처리] showToast 함수가 없어서 토스트를 띄울 수 없습니다!');
      }
      setLastSignalStatus('fail');
      return;
    }

    // 2차 검증: STB 또는 모뎀 중 하나라도 등록되어 있는지
    const hasStb = installedEquipments.some(isStb);
    const hasModem = installedEquipments.some(isModem);

    console.log('[신호처리] 장비 타입 검증 결과:', { hasStb, hasModem });

    if (!hasStb && !hasModem) {
      console.log('[신호처리] ❌ 검증 실패: STB와 모뎀 모두 없음');
      if (showToast) {
        showToast('신호처리를 위해 STB 또는 모뎀 장비를 등록해주세요.', 'warning');
      } else {
        console.error('[신호처리] showToast 함수가 없어서 토스트를 띄울 수 없습니다!');
      }
      setLastSignalStatus('fail');
      return;
    }

    console.log('[신호처리] ✅ 사전 검증 통과 - STB 또는 모뎀이 등록됨:', { hasStb, hasModem });

    try {
      setIsSignalProcessing(true);
      setIsSignalPopupOpen(true);
      setSignalResult('신호처리 중...');

      const userInfo = localStorage.getItem('userInfo');
      if (!userInfo) {
        console.error('[신호처리] 사용자 정보 없음');
        setSignalResult('사용자 정보를 찾을 수 없습니다.');
        setLastSignalStatus('fail');
        setIsSignalProcessing(false);
        return;
      }

      const user = JSON.parse(userInfo);
      const regUid = user.userId || user.id || 'UNKNOWN';
      console.log('[신호처리] 사용자 정보:', { regUid, user });

      // STB와 모뎀 장비 찾기 (둘 중 하나는 있음 - 이미 검증 완료)
      const stbEquipment = installedEquipments.find(isStb);
      const modemEquipment = installedEquipments.find(isModem);

      console.log('[신호처리] STB 장비:', stbEquipment);
      console.log('[신호처리] 모뎀 장비:', modemEquipment);

      // 장비 ID (EQT_NO) 추출 - 프로시저는 EQT_NO를 사용
      // actualEquipment.id = EQT_NO (장비 관리 ID)
      // actualEquipment.serialNumber = EQT_SERNO (시리얼 번호)
      const stbEqtNo = stbEquipment?.actualEquipment?.id || stbEquipment?.id || '';
      const modemEqtNo = modemEquipment?.actualEquipment?.id || modemEquipment?.id || '';

      // STB가 없으면 신호처리 불가 - 토스트 알림 후 건너뛰기
      if (!stbEqtNo) {
        console.log('[신호처리] STB 장비가 없어 신호처리를 건너뜁니다.');
        setSignalResult('STB 장비가 없어 신호처리를 건너뜁니다.\n(모뎀만 있는 경우 신호처리 불필요)');
        setLastSignalStatus('success'); // 성공으로 처리하여 다음 단계 진행 가능
        setIsSignalProcessing(false);
        showToast?.('STB 장비가 없어 신호처리를 건너뜁니다.', 'info');
        return;
      }

      console.log('[신호처리] 장비 ID (EQT_NO):', { stbEqtNo, modemEqtNo });

      // 등록된 장비의 ID가 있는지 체크
      if ((hasStb && !stbEqtNo) || (hasModem && !modemEqtNo)) {
        console.error('[신호처리] 장비 ID 누락:', { hasStb, hasModem, stbEqtNo, modemEqtNo });
        console.error('[신호처리]   STB 장비:', stbEquipment);
        console.error('[신호처리]   모뎀 장비:', modemEquipment);
        setSignalResult('장비 정보를 찾을 수 없습니다.\n장비를 다시 선택해주세요.');
        setLastSignalStatus('fail');
        setIsSignalProcessing(false);
        return;
      }

      const apiParams = {
        regUid,
        ctrtId: workItem.CTRT_ID || '',
        workId: workItem.id,
        ifSvcCl: 'SMR03',
        stbEqtNo,
        modemEqtNo
      };

      console.log('[신호처리] API 호출 파라미터:', apiParams);

      const result = await checkStbServerConnection(
        regUid,
        workItem.CTRT_ID || '',
        workItem.id,
        'SMR03',
        stbEqtNo,
        modemEqtNo
      );

      console.log('[신호처리] API 응답:', result);

      // O_IFSVC_RESULT가 "TRUE"로 시작하면 성공으로 처리
      if (result.O_IFSVC_RESULT && result.O_IFSVC_RESULT.startsWith('TRUE')) {
        console.log('[신호처리] 성공');
        setSignalResult(`신호처리 완료\n\n결과: ${result.O_IFSVC_RESULT || '성공'}`);
        setLastSignalStatus('success');
      } else {
        console.error('[신호처리] 실패:', result.MESSAGE);
        setSignalResult(`신호처리 실패\n\n${result.MESSAGE || '알 수 없는 오류'}`);
        setLastSignalStatus('fail');
      }
    } catch (error: any) {
      console.error('[신호처리] 에러:', error);
      setSignalResult(`신호처리 실패\n\n${error.message || '알 수 없는 오류'}`);
      setLastSignalStatus('fail');
    } finally {
      console.log('[신호처리] 종료');
      setIsSignalProcessing(false);
    }
  };

  // 저장 및 다음 단계
  const handleSave = () => {
    // 장비가 없어도 다음 단계로 진행 가능 (마지막 완료 단계에서 체크)

    const userInfo = localStorage.getItem('userInfo');
    const user = userInfo ? JSON.parse(userInfo) : {};

    // Equipment[] 형태로 변환 - 레거시 시스템 필수 필드 포함
    const equipments: Equipment[] = installedEquipments.map(eq => ({
      // 기본 필드
      id: eq.actualEquipment.id,
      type: eq.actualEquipment.type,
      model: eq.actualEquipment.model,
      serialNumber: eq.actualEquipment.serialNumber,
      itemMidCd: eq.actualEquipment.itemMidCd,

      // 레거시 시스템 필수 필드 - 대문자 키로 전송
      EQT_NO: eq.actualEquipment.id,
      EQT_SERNO: eq.actualEquipment.serialNumber,
      ITEM_MID_CD: eq.actualEquipment.itemMidCd,
      EQT_CL_CD: eq.actualEquipment.eqtClCd,
      MAC_ADDRESS: eq.macAddress || eq.actualEquipment.macAddress,

      // workItem에서 가져오는 필드
      WRK_ID: workItem.id,
      CUST_ID: workItem.customer?.id || workItem.CUST_ID,
      CTRT_ID: workItem.CTRT_ID,
      WRK_CD: workItem.WRK_CD,

      // 계약 장비에서 가져오는 필드
      SVC_CMPS_ID: eq.contractEquipment.id,
      BASIC_PROD_CMPS_ID: eq.actualEquipment.BASIC_PROD_CMPS_ID || '',
      EQT_PROD_CMPS_ID: eq.actualEquipment.EQT_PROD_CMPS_ID || eq.contractEquipment.id,

      // API 응답에서 보존된 필드
      PROD_CD: eq.actualEquipment.PROD_CD || workItem.PROD_CD,
      SVC_CD: eq.actualEquipment.SVC_CD || '',
      EQT_SALE_AMT: eq.actualEquipment.EQT_SALE_AMT || '0',
      MST_SO_ID: eq.actualEquipment.MST_SO_ID || workItem.SO_ID || user.soId,
      SO_ID: eq.actualEquipment.SO_ID || workItem.SO_ID || user.soId,

      // 기타 필수 필드
      REG_UID: user.userId || user.workerId || 'A20230019',
      OLD_LENT_YN: eq.actualEquipment.OLD_LENT_YN || 'N',
      LENT: eq.actualEquipment.LENT || '10',
      ITLLMT_PRD: eq.actualEquipment.ITLLMT_PRD || '00',
      EQT_USE_STAT_CD: eq.actualEquipment.EQT_USE_STAT_CD || '1',
      EQT_CHG_GB: '1', // 장비 변경 구분 (1: 신규 등록)
      IF_DTL_ID: eq.actualEquipment.IF_DTL_ID || '',
    } as any));

    // 회수 장비 변환
    const removals: Equipment[] = markedForRemoval.map(eq => ({
      // 기본 필드
      id: eq.id,
      type: eq.type,
      model: eq.model,
      serialNumber: eq.serialNumber,
      itemMidCd: eq.itemMidCd,

      // 레거시 시스템 필수 필드
      EQT_NO: eq.id,
      EQT_SERNO: eq.serialNumber,
      ITEM_MID_CD: eq.itemMidCd,
      EQT_CL_CD: eq.eqtClCd,
      MAC_ADDRESS: eq.macAddress,

      // workItem에서 가져오는 필드
      WRK_ID: workItem.id,
      CUST_ID: workItem.customer?.id || workItem.CUST_ID,
      CTRT_ID: workItem.CTRT_ID,
      WRK_CD: workItem.WRK_CD,

      // 기타 필드
      SVC_CMPS_ID: eq.SVC_CMPS_ID || '',
      BASIC_PROD_CMPS_ID: eq.BASIC_PROD_CMPS_ID || '',
      MST_SO_ID: eq.MST_SO_ID || workItem.SO_ID || user.soId,
      SO_ID: eq.SO_ID || workItem.SO_ID || user.soId,
      REG_UID: user.userId || user.workerId || 'A20230019',
    } as any));

    const data: EquipmentData = {
      installedEquipments: equipments,
      removedEquipments: removals,
    };

    console.log('[장비관리] ========== 저장 데이터 ==========');
    console.log('[장비관리] 설치 장비 수:', equipments.length);
    if (equipments.length > 0) {
      console.log('[장비관리] 첫번째 설치 장비 샘플:', equipments[0]);
    }
    console.log('[장비관리] 회수 장비 수:', removals.length);
    if (removals.length > 0) {
      console.log('[장비관리] 첫번째 회수 장비 샘플:', removals[0]);
    }
    console.log('[장비관리] =====================================');

    // localStorage는 유지 (회수 버튼으로만 제거됨)
    console.log('[장비관리] 장비 데이터 전달 - localStorage는 유지됨');

    onSave(data);
  };

  // 장비 타입명 가져오기
  const getEquipmentTypeName = (itemMidCd?: string): string => {
    const typeMap: { [key: string]: string } = {
      '04': '모뎀',
      '05': '셋톱박스',
      '07': '특수장비',
      '03': '추가장비',
      '02': '기타',
    };
    return typeMap[itemMidCd || ''] || '기타';
  };

  const availableStock = getAvailableStock();

  // 바코드 스캔 핸들러 (실제 기능은 추후 구현)
  const handleBarcodeScan = () => {
    setIsBarcodeScanning(true);
    // TODO: 실제 바코드 스캔 기능 구현
    // 예: 카메라 API 호출 또는 바코드 스캐너 라이브러리 연동
    console.log('[바코드스캔] 바코드 스캔 시작');

    // 임시: 2초 후 스캔 종료 (실제 구현 시 제거)
    setTimeout(() => {
      setIsBarcodeScanning(false);
      showToast?.('바코드 스캔 기능은 준비 중입니다.', 'info');
    }, 500);
  };

  // 철거 장비 분실/파손 상태 토글 핸들러
  const handleRemovalStatusChange = (eqtNo: string, field: string, value: string) => {
    setRemovalStatus(prev => ({
      ...prev,
      [eqtNo]: {
        ...prev[eqtNo],
        [field]: value === '1' ? '0' : '1'  // 토글
      }
    }));
  };

  // 철거 작업 저장 핸들러 (분실/파손 체크박스 값 포함)
  const handleRemovalSave = () => {
    const userInfo = localStorage.getItem('userInfo');
    const user = userInfo ? JSON.parse(userInfo) : {};

    // 철거 장비에 분실/파손 상태 반영
    const removals: Equipment[] = removeEquipments.map(eq => {
      const eqtNo = eq.id;
      const status = removalStatus[eqtNo] || {};

      return {
        // 기본 필드
        id: eq.id,
        type: eq.type,
        model: eq.model,
        serialNumber: eq.serialNumber,
        itemMidCd: eq.itemMidCd,

        // 레거시 시스템 필수 필드
        EQT_NO: eq.id,
        EQT_SERNO: eq.serialNumber,
        ITEM_MID_CD: eq.itemMidCd,
        EQT_CL_CD: eq.eqtClCd,
        MAC_ADDRESS: eq.macAddress,

        // workItem에서 가져오는 필드
        WRK_ID: workItem.id,
        CUST_ID: workItem.customer?.id || workItem.CUST_ID,
        CTRT_ID: workItem.CTRT_ID,
        WRK_CD: workItem.WRK_CD,

        // 기타 필드
        SVC_CMPS_ID: (eq as any).SVC_CMPS_ID || '',
        BASIC_PROD_CMPS_ID: (eq as any).BASIC_PROD_CMPS_ID || '',
        MST_SO_ID: (eq as any).MST_SO_ID || workItem.SO_ID || user.soId,
        SO_ID: (eq as any).SO_ID || workItem.SO_ID || user.soId,
        REG_UID: user.userId || user.workerId || 'A20230019',

        // 분실/파손 상태 (철거 장비 전용)
        EQT_LOSS_YN: status.EQT_LOSS_YN || '0',           // 분실여부
        PART_LOSS_BRK_YN: status.PART_LOSS_BRK_YN || '0', // 아답터분실
        EQT_BRK_YN: status.EQT_BRK_YN || '0',             // 장비단분실
        EQT_CABL_LOSS_YN: status.EQT_CABL_LOSS_YN || '0', // 케이블분실
        EQT_CRDL_LOSS_YN: status.EQT_CRDL_LOSS_YN || '0', // 크래들분실
      } as any;
    });

    const data: EquipmentData = {
      installedEquipments: [], // 철거 작업에서는 설치 장비 없음
      removedEquipments: removals,
    };

    console.log('[장비관리-철거] ========== 저장 데이터 ==========');
    console.log('[장비관리-철거] 철거 장비 수:', removals.length);
    if (removals.length > 0) {
      console.log('[장비관리-철거] 첫번째 철거 장비 샘플:', removals[0]);
      console.log('[장비관리-철거] 분실/파손 상태:', {
        EQT_LOSS_YN: removals[0].EQT_LOSS_YN,
        PART_LOSS_BRK_YN: removals[0].PART_LOSS_BRK_YN,
        EQT_BRK_YN: removals[0].EQT_BRK_YN,
        EQT_CABL_LOSS_YN: removals[0].EQT_CABL_LOSS_YN,
        EQT_CRDL_LOSS_YN: removals[0].EQT_CRDL_LOSS_YN,
      });
    }
    console.log('[장비관리-철거] =====================================');

    onSave(data);
  };

  // 철거 작업 UI
  if (isRemovalWork) {
    return (
      <div className={`px-2 sm:px-4 ${isWorkCompleted ? 'py-2 sm:py-3' : 'py-4 sm:py-6'} space-y-3 sm:space-y-4 bg-gray-50 ${isWorkCompleted ? '' : 'min-h-screen'}`}>
        {/* 철거장비 섹션 */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100">
          <div className="flex items-center justify-between p-3 sm:p-4 border-b border-gray-100">
            <h4 className="text-sm sm:text-base font-bold text-gray-900 flex items-center gap-2">
              <RotateCcw className="w-4 h-4 sm:w-5 sm:h-5 text-orange-500" />
              철거장비
            </h4>
            <span className="px-2 sm:px-2.5 py-0.5 sm:py-1 bg-orange-100 text-orange-700 text-[10px] sm:text-xs font-semibold rounded-full">
              {removeEquipments.length}개
            </span>
          </div>

          {removeEquipments.length === 0 ? (
            <div className={`${isWorkCompleted ? 'py-6' : 'py-12'} text-center`}>
              <div className="text-sm text-gray-500">철거 대상 장비가 없습니다</div>
            </div>
          ) : (
            <div className="p-3 sm:p-4 space-y-3">
              {removeEquipments.map(equipment => {
                const eqtNo = equipment.id;
                const status = removalStatus[eqtNo] || {};
                // 고객소유(LENT_YN='40') 또는 특정 장비는 분실처리 불가 (레거시 로직)
                const isCustomerOwned = (equipment as any).LENT_YN === '40' ||
                                       (equipment as any).VOIP_CUSTOWN_EQT === 'Y' ||
                                       (equipment as any).eqtClCd === '090852';

                return (
                  <div
                    key={equipment.id}
                    className="p-3 sm:p-4 rounded-lg border border-gray-200 bg-white"
                  >
                    {/* 장비 정보 */}
                    <div className="flex items-start justify-between mb-3">
                      <div className="space-y-1">
                        <div className="text-sm font-semibold text-gray-900">{equipment.model || equipment.type}</div>
                        <div className="text-xs text-gray-600">S/N: {equipment.serialNumber}</div>
                        {equipment.macAddress && (
                          <div className="text-xs text-gray-500">MAC: {equipment.macAddress}</div>
                        )}
                      </div>
                      <span className="text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded">
                        {(equipment as any).EQT_LOC_TP_NM || '고객'}
                      </span>
                    </div>

                    {/* 분실/파손 체크박스 - 읽기 전용일 때는 숨김 */}
                    {!isWorkCompleted && !readOnly && (
                      <div className="grid grid-cols-3 sm:grid-cols-5 gap-2 pt-3 border-t border-gray-100">
                        <label className={`flex items-center gap-1.5 ${isCustomerOwned ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}>
                          <input
                            type="checkbox"
                            checked={status.EQT_LOSS_YN === '1'}
                            onChange={() => !isCustomerOwned && handleRemovalStatusChange(eqtNo, 'EQT_LOSS_YN', status.EQT_LOSS_YN || '0')}
                            disabled={isCustomerOwned}
                            className="w-4 h-4 rounded border-gray-300 text-orange-500 focus:ring-orange-500"
                          />
                          <span className="text-xs text-gray-600">분실</span>
                        </label>
                        <label className={`flex items-center gap-1.5 ${isCustomerOwned ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}>
                          <input
                            type="checkbox"
                            checked={status.PART_LOSS_BRK_YN === '1'}
                            onChange={() => !isCustomerOwned && handleRemovalStatusChange(eqtNo, 'PART_LOSS_BRK_YN', status.PART_LOSS_BRK_YN || '0')}
                            disabled={isCustomerOwned}
                            className="w-4 h-4 rounded border-gray-300 text-orange-500 focus:ring-orange-500"
                          />
                          <span className="text-xs text-gray-600">아답터</span>
                        </label>
                        <label className={`flex items-center gap-1.5 ${isCustomerOwned ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}>
                          <input
                            type="checkbox"
                            checked={status.EQT_BRK_YN === '1'}
                            onChange={() => !isCustomerOwned && handleRemovalStatusChange(eqtNo, 'EQT_BRK_YN', status.EQT_BRK_YN || '0')}
                            disabled={isCustomerOwned}
                            className="w-4 h-4 rounded border-gray-300 text-orange-500 focus:ring-orange-500"
                          />
                          <span className="text-xs text-gray-600">장비단</span>
                        </label>
                        <label className={`flex items-center gap-1.5 ${isCustomerOwned ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}>
                          <input
                            type="checkbox"
                            checked={status.EQT_CABL_LOSS_YN === '1'}
                            onChange={() => !isCustomerOwned && handleRemovalStatusChange(eqtNo, 'EQT_CABL_LOSS_YN', status.EQT_CABL_LOSS_YN || '0')}
                            disabled={isCustomerOwned}
                            className="w-4 h-4 rounded border-gray-300 text-orange-500 focus:ring-orange-500"
                          />
                          <span className="text-xs text-gray-600">케이블</span>
                        </label>
                        <label className={`flex items-center gap-1.5 ${isCustomerOwned ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}>
                          <input
                            type="checkbox"
                            checked={status.EQT_CRDL_LOSS_YN === '1'}
                            onChange={() => !isCustomerOwned && handleRemovalStatusChange(eqtNo, 'EQT_CRDL_LOSS_YN', status.EQT_CRDL_LOSS_YN || '0')}
                            disabled={isCustomerOwned}
                            className="w-4 h-4 rounded border-gray-300 text-orange-500 focus:ring-orange-500"
                          />
                          <span className="text-xs text-gray-600">크래들</span>
                        </label>
                      </div>
                    )}

                    {/* 고객소유 장비 안내 */}
                    {isCustomerOwned && !isWorkCompleted && (
                      <div className="mt-2 text-xs text-orange-600 bg-orange-50 p-2 rounded">
                        고객소유 장비로 분실처리 불가
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* 저장 버튼 (철거 작업) */}
        {!isWorkCompleted && (
          <div className="mt-4">
            <button
              onClick={handleRemovalSave}
              className="w-full py-3 px-4 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg transition-colors flex items-center justify-center gap-2"
            >
              <CheckCircle2 className="w-5 h-5" />
              <span>다음 단계</span>
            </button>
          </div>
        )}

        {/* 장비정보변경 모달 */}
        {(() => {
          const displayWrkCdNm = workItem.WRK_CD_NM || getWorkCodeName(workItem.WRK_CD) || workItem.workType || '-';
          const displayProdNm = workItem.PROD_NM || workItem.productName || workItem.customer?.productName || '-';
          const displayCtrtStatNm = workItem.CTRT_STAT_NM || getContractStatusName(workItem.CTRT_STAT) || '-';
          return (
            <EquipmentModelChangeModal
              isOpen={isModelChangeModalOpen}
              onClose={() => setIsModelChangeModalOpen(false)}
              prodCd={workItem.PROD_CD || ''}
              ctrtId={workItem.CTRT_ID || ''}
              wrkCdNm={displayWrkCdNm}
              prodNm={displayProdNm}
              ctrtStatNm={displayCtrtStatNm}
              showToast={showToast}
              onSave={() => {
                setIsModelChangeModalOpen(false);
                loadEquipmentData(true);
                showToast?.('장비 정보가 변경되었습니다.', 'success');
              }}
            />
          );
        })()}
      </div>
    );
  }

  // 설치 작업 UI (기존 코드)
  return (
    <div className={`px-2 sm:px-4 ${isWorkCompleted ? 'py-2 sm:py-3' : 'py-4 sm:py-6'} space-y-3 sm:space-y-4 bg-gray-50 ${isWorkCompleted ? '' : 'min-h-screen'}`}>
      {/* 상단: 고객 설치 장비 (리스트 형식) */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between p-3 sm:p-4 border-b border-gray-100 gap-2">
          <h4 className="text-sm sm:text-base font-bold text-gray-900">고객 설치 장비</h4>
          <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
            {/* 작업 완료 시 장비정보변경 및 신호처리 버튼 숨김 */}
            {!isWorkCompleted && (
              <>
                <button
                  className={`px-3 sm:px-4 py-2 sm:py-2.5 text-sm sm:text-base font-medium rounded-lg transition-colors whitespace-nowrap min-h-[44px] ${
                    (installedEquipments.length > 0 || customerEquipmentCount > 0)
                      ? 'text-gray-400 bg-gray-100 cursor-not-allowed'
                      : 'text-blue-600 bg-blue-50 hover:bg-blue-100'
                  }`}
                  onClick={() => {
                    if (customerEquipmentCount > 0) {
                      showToast?.('이미 고객에게 설치된 장비가 있어 장비정보를 변경할 수 없습니다.', 'warning');
                      return;
                    }
                    if (installedEquipments.length > 0) {
                      showToast?.('등록된 장비를 먼저 회수한 후 장비정보를 변경할 수 있습니다.', 'warning');
                      return;
                    }
                    setIsModelChangeModalOpen(true);
                  }}
                  disabled={installedEquipments.length > 0 || customerEquipmentCount > 0}
                >
                  장비변경
                </button>
                <button
                  className="px-3 sm:px-4 py-2 sm:py-2.5 text-sm sm:text-base font-medium text-white bg-blue-500 hover:bg-blue-600 rounded-lg transition-colors flex items-center gap-1.5 sm:gap-2 whitespace-nowrap min-h-[44px]"
                  onClick={handleSignalProcess}
                >
                  <span>신호처리</span>
                  <span className={`w-2 h-2 sm:w-2.5 sm:h-2.5 rounded-full flex-shrink-0 ${
                    lastSignalStatus === 'success' ? 'bg-green-400' :
                    lastSignalStatus === 'fail' ? 'bg-red-400' :
                    'bg-gray-400'
                  }`}></span>
                </button>
              </>
            )}
            <span className="px-2 sm:px-2.5 py-0.5 sm:py-1 bg-gray-100 text-gray-700 text-[10px] sm:text-xs font-semibold rounded-full">{contractEquipments.length}개</span>
          </div>
        </div>

        {contractEquipments.length === 0 ? (
          <div className={`${isWorkCompleted ? 'py-6' : 'py-12'} text-center`}>
            <div className="text-sm text-gray-500">계약 장비가 없습니다</div>
          </div>
        ) : (
          <div className="p-4 space-y-2">
            {contractEquipments.map(equipment => {
              const installed = installedEquipments.find(
                eq => eq.contractEquipment.id === equipment.id
              );
              const isSelected = selectedContract?.id === equipment.id;

              return (
                <div
                  key={equipment.id}
                  className={`p-4 rounded-lg border-2 transition-all ${
                    isWorkCompleted
                      ? installed
                        ? 'border-green-200 bg-green-50 cursor-default'
                        : 'border-gray-200 bg-white cursor-default'
                      : isSelected
                        ? 'border-blue-500 bg-blue-50 cursor-pointer'
                        : installed
                          ? 'border-green-200 bg-green-50 cursor-pointer'
                          : 'border-gray-200 bg-white hover:border-gray-300 cursor-pointer'
                  }`}
                  onClick={() => !isWorkCompleted && handleContractClick(equipment)}
                >
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-semibold text-gray-900">{equipment.type}</span>
                      <span className="text-sm font-medium text-gray-600">{equipment.model}</span>
                    </div>

                    {installed && (
                      <div className="pt-2 border-t border-gray-200 space-y-1">
                        <div className="text-xs text-green-700 font-medium">✓ 등록: {installed.actualEquipment.model}</div>
                        <div className="text-xs text-gray-600">S/N: {installed.actualEquipment.serialNumber}</div>
                        {installed.macAddress && (
                          <div className="text-xs text-gray-600">MAC: {installed.macAddress}</div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* 중간: 등록/회수 버튼 - 완료된 작업에서는 숨김 */}
      {!isWorkCompleted && (
        <div className="flex items-center justify-center gap-3 sm:gap-4">
          <button
            className={`flex flex-col items-center justify-center w-20 h-20 sm:w-28 sm:h-28 rounded-xl border-2 transition-all ${
              !selectedContract || !selectedStock || installedEquipments.some(eq => eq.actualEquipment.id === selectedStock.id)
                ? 'border-gray-200 bg-gray-50 text-gray-400 cursor-not-allowed'
                : 'border-blue-500 bg-blue-50 text-blue-600 hover:bg-blue-100 cursor-pointer'
            }`}
            onClick={handleRegisterEquipment}
            disabled={
              !selectedContract ||
              !selectedStock ||
              installedEquipments.some(eq => eq.actualEquipment.id === selectedStock.id)
            }
            title="재고 → 고객에게 등록"
          >
            <ArrowUp size={24} className="sm:w-8 sm:h-8" strokeWidth={2.5} />
            <span className="mt-1 sm:mt-2 text-xs sm:text-sm font-semibold">등록</span>
          </button>
          <button
            className={`flex flex-col items-center justify-center w-20 h-20 sm:w-28 sm:h-28 rounded-xl border-2 transition-all ${
              !selectedStock || !(
                installedEquipments.some(eq => eq.actualEquipment.id === selectedStock.id) ||
                removeEquipments.some(eq => eq.id === selectedStock.id)
              )
                ? 'border-gray-200 bg-gray-50 text-gray-400 cursor-not-allowed'
                : 'border-red-500 bg-red-50 text-red-600 hover:bg-red-100 cursor-pointer'
            }`}
            onClick={handleMarkForRemoval}
            disabled={!selectedStock || !(
              installedEquipments.some(eq => eq.actualEquipment.id === selectedStock.id) ||
              removeEquipments.some(eq => eq.id === selectedStock.id)
            )}
            title="고객 → 재고로 회수"
          >
            <ArrowDown size={24} className="sm:w-8 sm:h-8" strokeWidth={2.5} />
            <span className="mt-1 sm:mt-2 text-xs sm:text-sm font-semibold">회수</span>
          </button>
        </div>
      )}

      {/* 하단: 기사 재고 장비 (리스트 형식) - 완료된 작업에서는 숨김 */}
      {!isWorkCompleted && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between p-3 sm:p-4 border-b border-gray-100 gap-2">
            <h4 className="text-sm sm:text-base font-bold text-gray-900">
              기사 재고 장비
              {selectedContract && <span className="text-blue-600"> ({selectedContract.type})</span>}
            </h4>
            <div className="flex items-center gap-1.5 sm:gap-2">
              {/* 바코드 스캔 버튼 */}
              <button
                className={`p-2.5 sm:p-3 rounded-lg transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center ${
                  isBarcodeScanning
                    ? 'bg-blue-500 text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
                onClick={handleBarcodeScan}
                disabled={isBarcodeScanning}
                title="바코드 스캔"
              >
                <Camera className="w-5 h-5 sm:w-6 sm:h-6" />
              </button>
              <span className="px-2 sm:px-2.5 py-0.5 sm:py-1 bg-gray-100 text-gray-700 text-[10px] sm:text-xs font-semibold rounded-full">
                {selectedContract ? availableStock.length : 0}개
              </span>
            </div>
          </div>

          {!selectedContract ? (
            <div className="py-8 sm:py-12 text-center">
              <div className="text-xs sm:text-sm text-gray-500">상단에서 고객 설치 장비를 먼저 선택해주세요</div>
            </div>
          ) : availableStock.length === 0 ? (
            <div className="py-8 sm:py-12 text-center">
              <div className="text-xs sm:text-sm text-gray-500">해당 종류의 사용 가능한 재고가 없습니다</div>
            </div>
          ) : (
            <div className="p-3 sm:p-4 space-y-2">
              {availableStock.map(stock => (
                <div
                  key={stock.id}
                  className={`p-3 sm:p-4 rounded-lg border-2 transition-all cursor-pointer relative ${
                    selectedStock?.id === stock.id
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-gray-200 bg-white hover:border-gray-300'
                  }`}
                  onClick={() => handleStockClick(stock)}
                >
                  <div className="space-y-1.5 sm:space-y-2">
                    {/* 장비명/모델 - 줄바꿈으로 표시 */}
                    <div className="flex flex-col">
                      <span className="text-xs sm:text-sm font-semibold text-gray-900">{stock.type}</span>
                      <span className="text-xs sm:text-sm font-medium text-gray-600">{stock.model}</span>
                    </div>
                    <div className="space-y-0.5 sm:space-y-1">
                      <div className="text-[10px] sm:text-xs text-gray-600">S/N: {stock.serialNumber}</div>
                      {stock.macAddress && (
                        <div className="text-[10px] sm:text-xs text-gray-600">MAC: {stock.macAddress}</div>
                      )}
                    </div>
                  </div>
                  {selectedStock?.id === stock.id && (
                    <div className="absolute top-2 sm:top-3 right-2 sm:right-3 w-5 h-5 sm:w-6 sm:h-6 rounded-full bg-blue-500 text-white flex items-center justify-center text-xs sm:text-sm font-bold">
                      ✓
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* 회수 장비 섹션 - 완료된 작업에서는 클릭 불가 */}
      {removeEquipments.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between p-3 sm:p-4 border-b border-gray-100 gap-2">
            <h4 className="text-sm sm:text-base font-bold text-gray-900 flex items-center gap-1.5 sm:gap-2">
              <RotateCcw className="w-4 h-4 sm:w-5 sm:h-5 text-orange-500" />
              회수 장비
            </h4>
            <span className="px-2 sm:px-2.5 py-0.5 sm:py-1 bg-gray-100 text-gray-700 text-[10px] sm:text-xs font-semibold rounded-full">
              {isWorkCompleted ? `${removeEquipments.length}개` : `${markedForRemoval.length} / ${removeEquipments.length}개 선택`}
            </span>
          </div>

          <div className="p-3 sm:p-4 grid grid-cols-2 gap-2 sm:gap-3">
            {removeEquipments.map(equipment => {
              const isMarked = markedForRemoval.some(eq => eq.id === equipment.id);
              return (
                <div
                  key={equipment.id}
                  className={`p-2.5 sm:p-3 rounded-lg border-2 transition-all relative ${
                    isWorkCompleted
                      ? 'border-gray-200 bg-gray-50 cursor-default'
                      : isMarked
                        ? 'border-orange-500 bg-orange-50 cursor-pointer'
                        : 'border-gray-200 bg-white hover:border-gray-300 cursor-pointer'
                  }`}
                  onClick={() => !isWorkCompleted && toggleRemovalMark(equipment)}
                >
                  <div className="space-y-1 sm:space-y-1.5">
                    <div className="text-xs sm:text-sm font-semibold text-gray-900">{equipment.type}</div>
                    <div className="text-[10px] sm:text-xs font-medium text-gray-600">{equipment.model}</div>
                    <div className="text-[10px] sm:text-xs text-gray-500">S/N: {equipment.serialNumber}</div>
                    {equipment.macAddress && (
                      <div className="text-[10px] sm:text-xs text-gray-500">MAC: {equipment.macAddress}</div>
                    )}
                    {equipment.installLocation && (
                      <div className="text-[10px] sm:text-xs text-gray-500">{equipment.installLocation}</div>
                    )}
                  </div>
                  {isMarked && !isWorkCompleted && (
                    <div className="absolute top-1.5 sm:top-2 right-1.5 sm:right-2 w-4 h-4 sm:w-5 sm:h-5 rounded-full bg-orange-500 text-white flex items-center justify-center text-[10px] sm:text-xs font-bold">
                      ✓
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 장비정보변경 모달 */}
      {(() => {
        // 작업코드명: API 응답 → 코드 변환 → 폴백
        const displayWrkCdNm =
          workItem.WRK_CD_NM ||
          getWorkCodeName(workItem.WRK_CD) ||
          workItem.workType ||
          '-';
        // 상품명: API 응답 → workItem 직접 → customer 객체 → 폴백
        const displayProdNm =
          workItem.PROD_NM ||
          workItem.productName ||
          workItem.customer?.productName ||
          '-';
        // 계약상태명: API 응답 → 코드 변환 → 폴백
        const displayCtrtStatNm =
          workItem.CTRT_STAT_NM ||
          getContractStatusName(workItem.CTRT_STAT) ||
          '-';
        return (
      <EquipmentModelChangeModal
        isOpen={isModelChangeModalOpen}
        onClose={() => setIsModelChangeModalOpen(false)}
        prodCd={workItem.PROD_CD || ''}
        ctrtId={workItem.CTRT_ID || ''}
        ctrtStatNm={displayCtrtStatNm}
        prodGrp={workItem.PROD_GRP || ''}
        prodNm={displayProdNm}
        wrkCdNm={displayWrkCdNm}
        onSave={handleModelChange}
        showToast={showToast}
      />
        );
      })()}

      {isSignalPopupOpen && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
          onClick={() => !isSignalProcessing && setIsSignalPopupOpen(false)}
        >
          <div
            className="bg-white rounded-xl shadow-lg max-w-md w-full overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* 헤더 */}
            <div className="px-6 py-4 border-b border-gray-100">
              <h3 className="text-lg font-bold text-gray-900">신호처리</h3>
            </div>

            {/* 본문 */}
            <div className="px-6 py-8">
              {isSignalProcessing ? (
                // 처리 중
                <div className="flex flex-col items-center space-y-4">
                  <div className="text-blue-500">
                    <Loader2 className="animate-spin" size={64} />
                  </div>
                  <p className="text-base font-semibold text-gray-900">신호처리 중...</p>
                  <p className="text-sm text-gray-500">잠시만 기다려주세요</p>
                </div>
              ) : lastSignalStatus === 'success' ? (
                // 성공
                <div className="flex flex-col items-center space-y-4">
                  <div className="text-green-500">
                    <CheckCircle2 size={64} />
                  </div>
                  <p className="text-base font-semibold text-gray-900">신호처리 완료!</p>
                  <div className="w-full p-4 bg-gray-50 rounded-lg border border-gray-200">
                    <pre className="text-xs text-gray-700 whitespace-pre-wrap font-mono">{signalResult}</pre>
                  </div>
                </div>
              ) : (
                // 실패
                <div className="flex flex-col items-center space-y-4">
                  <div className="text-red-500">
                    <XCircle size={64} />
                  </div>
                  <p className="text-base font-semibold text-gray-900">신호처리 실패</p>
                  <div className="w-full p-4 bg-red-50 rounded-lg border border-red-200">
                    <pre className="text-xs text-red-700 whitespace-pre-wrap font-mono">{signalResult}</pre>
                  </div>
                </div>
              )}
            </div>

            {/* 버튼 영역 */}
            <div className="px-6 py-4 border-t border-gray-100">
              <button
                className={`w-full py-3 rounded-lg font-semibold transition-colors ${
                  lastSignalStatus === 'success'
                    ? 'bg-green-500 hover:bg-green-600 text-white'
                    : 'bg-blue-500 hover:bg-blue-600 text-white'
                }`}
                onClick={() => setIsSignalPopupOpen(false)}
                disabled={isSignalProcessing}
              >
                {isSignalProcessing ? '처리 중...' : '확인'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 바코드 스캔 플로팅 버튼 - 우측 하단 고정 */}
      {!isWorkCompleted && (
        <button
          onClick={handleBarcodeScan}
          disabled={isBarcodeScanning}
          className={`fixed bottom-24 right-4 z-40 w-14 h-14 sm:w-16 sm:h-16 rounded-full shadow-lg flex items-center justify-center transition-all active:scale-95 ${
            isBarcodeScanning
              ? 'bg-blue-600 text-white'
              : 'bg-blue-500 hover:bg-blue-600 text-white'
          }`}
          title="바코드 스캔"
        >
          <ScanBarcode className="w-7 h-7 sm:w-8 sm:h-8" />
        </button>
      )}
    </div>
  );
};

export default EquipmentManagement;
