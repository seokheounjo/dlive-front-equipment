import React, { useState, useEffect } from 'react';
import { ArrowDown, ArrowUp, CheckCircle2, XCircle, Loader2, Radio, RotateCcw, ScanBarcode, History } from 'lucide-react';
import { WorkItem, Equipment } from '../../types';
import { getTechnicianEquipments, EquipmentInfo, updateEquipmentComposition, checkStbServerConnection } from '../../services/apiService';
import EquipmentModelChangeModal from '../equipment/EquipmentModelChangeModal';
import IntegrationHistoryModal from '../modal/IntegrationHistoryModal';
import { useWorkProcessStore } from '../../stores/workProcessStore';

interface EquipmentManagementProps {
  workItem: WorkItem;
  onSave: (data: EquipmentData) => void;
  onBack: () => void;
  showToast?: (message: string, type: 'success' | 'error' | 'warning' | 'info') => void;
  preloadedApiData?: any; // Pre-loaded API 데이터 (WorkProcessFlow에서 미리 로드한 것)
  onPreloadedDataUpdate?: (newData: any) => void; // Pre-load 데이터 업데이트 콜백 (장비변경 후)
  readOnly?: boolean; // 완료된 작업 - 읽기 전용 모드
  // WRK_CD별 버튼 표시 옵션 (레거시 동일)
  buttonOptions?: {
    showRegisterButton?: boolean;  // 등록 버튼 (btn_equip_add)
    showRemoveButton?: boolean;    // 회수 버튼 (btn_equip_rmv)
    showModelChangeButton?: boolean; // 장비정보변경 버튼 (btn_eqt_cl_chg)
  };
  // 회수 섹션 숨김 옵션 (레거시 mowoDivD01.xml - 설치 전용)
  // WRK_CD=01(설치)에서는 철거/회수 섹션이 없음
  hideRemovalSection?: boolean;
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
  LENT_YN?: string;        // 대여 여부 (40: 고객 소유)
  ITLLMT_PRD?: string;
  EQT_USE_STAT_CD?: string;
  ITEM_CD?: string;         // 품목 코드
  EQT_UNI_ID?: string;      // 장비 고유 ID
  STB_CM_MAC?: string;      // STB CM MAC
  STB_RTCA_ID?: string;     // STB RTCA ID
  OWNER_TP_CD?: string;     // 소유자 구분 코드
  EQT_CL_NM?: string;       // 장비 클래스명 (에러 메시지용)
}

// 작업코드 → 한글 변환 (레거시 CMWT000 코드 테이블)
// 레거시 mowoa02m01.xml 매핑 기준
const getWorkCodeName = (wrkCd?: string): string => {
  const codeMap: { [key: string]: string } = {
    '01': '설치',       // mowoa03m01 - 작업완료(설치)
    '02': '철거',       // mowoa03m02 - 작업완료(철거)
    '03': 'A/S',        // mowoa03m03 - 작업완료(A/S)
    '04': '정지',       // mowoa03m04 - 작업완료(정지)
    '05': '상품변경',   // mowoa03m05 - 작업완료(상품변경)
    '06': '이전설치',   // mowoa03m06 - 작업완료(이전설치) - 06,07 공용
    '07': '이전설치',   // mowoa03m06 - 작업완료(이전설치) - 06,07 공용
    '08': '이전철거',   // mowoa03m08 - 작업완료(이전철거)
    '09': '부가상품',   // mowoa03m09 - 작업완료(부가상품)
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

const EquipmentManagement: React.FC<EquipmentManagementProps> = ({ workItem, onSave, onBack, showToast, preloadedApiData, onPreloadedDataUpdate, readOnly = false, buttonOptions, hideRemovalSection = false }) => {
  // WRK_CD별 버튼 표시 여부 (기본값: 모두 표시)
  const showRegisterButton = buttonOptions?.showRegisterButton ?? true;
  // hideRemovalSection이 true면 회수 버튼도 숨김 (설치 작업)
  const showRemoveButton = hideRemovalSection ? false : (buttonOptions?.showRemoveButton ?? true);
  const showModelChangeButton = buttonOptions?.showModelChangeButton ?? true;
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

  // 철거 작업 여부 (레거시 mowoa03m02 - 작업완료(철거))
  // WRK_CD='02': 철거, '08': 이전철거
  const isRemovalWork = ['02', '08'].includes(workItem.WRK_CD || '');

  // 정지 작업 여부 (레거시 mowoa03m04 - 작업완료(정지))
  // WRK_CD='04': 정지
  const isSuspensionWork = workItem.WRK_CD === '04';

  // 이전설치(06, 07) 작업에서 재사용 가능한 장비 코드 (레거시 mowoDivD05.xml)
  // 091001: 공유기(WIFI), 091005: 공유기(WIFI5), 091006: 공유기(WIFI6)
  // 091401: 스마트공유기, 092401: OTT_STB(임대용/H5), 090251: 기가와이파이-GU
  const MOVE_INSTALL_REUSABLE_EQT_CL_CDS = ['091001', '091005', '091006', '091401', '092401', '090251'];

  // 이전설치(06, 07) 작업인지 확인 (레거시 mowoa03m06)
  const isMoveInstallWork = workItem.WRK_CD === '06' || workItem.WRK_CD === '07';

  // 이전설치(06, 07) 작업에서 특정 장비인지 확인
  const isMoveInstallReusableEquipment = (eqtClCd?: string): boolean => {
    if (!eqtClCd) return false;
    return MOVE_INSTALL_REUSABLE_EQT_CL_CDS.includes(eqtClCd);
  };

  // 철거 장비 분실/파손 상태 (철거 작업 전용)
  // { [EQT_NO]: { EQT_LOSS_YN, PART_LOSS_BRK_YN, EQT_BRK_YN, EQT_CABL_LOSS_YN, EQT_CRDL_LOSS_YN } }
  const [removalStatus, setRemovalStatus] = useState<{
    [key: string]: {
      EQT_LOSS_YN?: string;        // 장비분실
      PART_LOSS_BRK_YN?: string;   // 아답터분실
      EQT_BRK_YN?: string;         // 리모콘분실
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

  // 연동이력 모달 상태
  const [isIntegrationHistoryModalOpen, setIsIntegrationHistoryModalOpen] = useState(false);

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

    // 장비가 하나라도 있거나, 회수 표시가 있거나, 철거 상태가 있으면 저장
    const hasRemovalStatus = Object.keys(removalStatus).length > 0;
    if (installedEquipments.length > 0 || markedForRemoval.length > 0 || hasRemovalStatus) {
      const draftData = {
        installedEquipments: installedEquipments,
        markedForRemoval: markedForRemoval,
        removalStatus: removalStatus, // 철거 장비 분실/파손 체크박스 상태 저장
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
  }, [installedEquipments, markedForRemoval, removalStatus, isDataLoaded, lastSignalStatus]);

  // WRK_CD를 CRR_TSK_CL로 매핑하는 헬퍼 함수
  const mapWrkCdToCrrTskCl = (wrkCd?: string): string => {
    if (!wrkCd) return '01'; // 기본값

    // WRK_CD IN ('01','05','06','07','09') → CRR_TSK_CL = '01' (설치 관련)
    if (['01', '05', '06', '07', '09'].includes(wrkCd)) {
      return '01';
    }
    // WRK_CD IN ('02','04','08') → CRR_TSK_CL = '02' (철거/정지/이전철거)
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
        apiResponse = preloadedApiData;
      } else {
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

        apiResponse = await getTechnicianEquipments(requestPayload);

        // 장비변경 후 API 재호출 시 부모 컴포넌트의 preloadedData도 업데이트
        if (forceRefresh && onPreloadedDataUpdate) {
          onPreloadedDataUpdate(apiResponse);
        }
      }

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
      const contracts: ContractEquipment[] = (apiResponse.contractEquipments || []).map((eq: any, idx: number) => {
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

      setContractEquipments(contracts);
      setTechnicianEquipments(techStock);
      setRemoveEquipments(removed);
      // API에서 받은 고객장비 수 저장 (서버에 이미 등록된 장비 - 장비정보변경 버튼 비활성화용)
      setCustomerEquipmentCount(installed.length);

      // API output4에 이미 설치된 장비가 있으면 그걸 우선 표시 (서버 데이터 우선)
      if (installed.length > 0) {
        setInstalledEquipments(installed);
        // API 데이터가 있으면 localStorage는 무시 (서버 데이터가 최신)
        // 단, 신호처리 상태와 철거 체크박스 상태는 localStorage에서 복원
        const savedDraft = localStorage.getItem(getStorageKey());
        if (savedDraft) {
          try {
            const draftData = JSON.parse(savedDraft);
            if (draftData.lastSignalStatus) {
              setLastSignalStatus(draftData.lastSignalStatus);
            }
            // 철거 장비 분실/파손 체크박스 상태 복원
            if (draftData.removalStatus && Object.keys(draftData.removalStatus).length > 0) {
              setRemovalStatus(draftData.removalStatus);
            }
          } catch (error) {
            // 무시
          }
        }
      } else {
        // API에 고객장비가 없으면 localStorage에서 복원 시도
        const savedDraft = localStorage.getItem(getStorageKey());

        if (savedDraft) {
          try {
            const draftData = JSON.parse(savedDraft);

            // localStorage 데이터 복원 (등록 버튼으로 추가한 장비만)
            if (draftData.installedEquipments && draftData.installedEquipments.length > 0) {
              setInstalledEquipments(draftData.installedEquipments);
            } else {
              setInstalledEquipments([]);
            }

            // 저장된 회수 선택 장비 복원
            if (draftData.markedForRemoval && draftData.markedForRemoval.length > 0) {
              setMarkedForRemoval(draftData.markedForRemoval);
            }

            // 철거 장비 분실/파손 체크박스 상태 복원
            if (draftData.removalStatus && Object.keys(draftData.removalStatus).length > 0) {
              setRemovalStatus(draftData.removalStatus);
            }

            // 신호처리 상태 복원
            if (draftData.lastSignalStatus) {
              setLastSignalStatus(draftData.lastSignalStatus);
            }
          } catch (error) {
            console.warn('[장비관리] localStorage 데이터 파싱 실패:', error);
            setInstalledEquipments([]);
          }
        } else {
          setInstalledEquipments([]);
        }
      }

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

      // 회수된 장비를 markedForRemoval에 추가 (체크박스 UI 표시용 - 레거시 mowoa03m06.xml 동일)
      const removedActualEquipment = removedEquipment.actualEquipment;
      const isAlreadyMarked = markedForRemoval.some(eq => eq.id === removedActualEquipment.id);
      if (!isAlreadyMarked) {
        setMarkedForRemoval(prev => [...prev, removedActualEquipment]);
        console.log('[장비관리] 회수 장비 목록에 추가:', removedActualEquipment.serialNumber);
      }

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

  // 정지(04) 작업 전용: 회수장비 → 고객설치장비 재사용
  // 레거시 로직: 철거탭에서 장비 선택 후 등록 버튼(↑) 누르면 고객장비로 재사용
  const handleSuspensionReuse = (equipment: ExtendedEquipment) => {
    // 1. 회수목록(markedForRemoval)에서 해당 장비 찾기
    const removedIndex = markedForRemoval.findIndex(eq => eq.id === equipment.id);
    if (removedIndex === -1) {
      showToast?.('회수 장비 목록에서 해당 장비를 찾을 수 없습니다.', 'error');
      return;
    }

    // 2. 원래 계약장비 정보 찾기 (같은 장비 종류로 매칭)
    const matchedContract = contractEquipments.find(c =>
      c.itemMidCd === equipment.itemMidCd &&
      c.model === equipment.model
    );

    if (!matchedContract) {
      // 계약장비를 찾을 수 없으면 기본 정보로 생성
      console.log('[장비관리] 정지 재사용: 매칭되는 계약장비 없음, 기본 정보 사용');
    }

    // 3. 고객설치장비로 추가 (재사용)
    const newInstalled: InstalledEquipment = {
      contractEquipment: matchedContract || {
        id: equipment.id,
        type: equipment.type,
        model: equipment.model || '',
        serialNumber: 'N/A',
        itemMidCd: equipment.itemMidCd,
        eqtClCd: equipment.eqtClCd,
      },
      actualEquipment: {
        ...equipment,
        EQT_CHG_GB: '3', // 재사용 표시 (레거시 동일)
      },
      macAddress: equipment.macAddress,
    };

    setInstalledEquipments(prev => [...prev, newInstalled]);

    // 4. 회수 목록에서 제거
    setMarkedForRemoval(prev => prev.filter(eq => eq.id !== equipment.id));

    // 5. 해당 장비의 분실/파손 상태 제거
    setRemovalStatus(prev => {
      const updated = { ...prev };
      delete updated[equipment.id];
      return updated;
    });

    // 6. 선택 상태 초기화
    setSelectedStock(null);

    console.log('[장비관리] 정지(04) 재사용 완료:', {
      장비: equipment.model || equipment.type,
      시리얼: equipment.serialNumber,
    });
    showToast?.('장비를 재사용하였습니다.', 'success');
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

  // 회수 장비 중 재사용 가능한 장비 (EQT_KND=CUST 고객장비)
  // 레거시 로직: 회수 장비를 다시 설치 장비로 사용 가능
  const getReusableRemovedEquipments = (): ExtendedEquipment[] => {
    // 이미 설치에 사용된 장비 ID
    const usedStockIds = new Set(
      installedEquipments.map(eq => eq.actualEquipment.id)
    );

    // 회수 목록에서 아직 재사용되지 않은 장비만 필터링
    let reusable = markedForRemoval.filter(eq => !usedStockIds.has(eq.id));

    // 계약 장비가 선택되어 있으면 같은 종류 + 같은 모델만 필터링
    if (selectedContract) {
      reusable = reusable.filter(eq =>
        eq.itemMidCd === selectedContract.itemMidCd &&
        eq.model === selectedContract.model
      );
    }

    return reusable;
  };

  // 회수 장비를 설치 장비로 재사용
  const reuseRemovedEquipment = (removedEquipment: ExtendedEquipment) => {
    if (!selectedContract) {
      showToast?.('먼저 계약장비를 선택해주세요.', 'warning');
      return;
    }

    // 설치 장비로 추가
    const newInstalled: InstalledEquipment = {
      contractEquipment: selectedContract,
      actualEquipment: {
        ...removedEquipment,
        // 재사용 표시
        EQT_CHG_GB: '3', // 재사용
      },
      macAddress: removedEquipment.macAddress,
    };

    setInstalledEquipments([...installedEquipments, newInstalled]);

    // 회수 목록에서 제거
    setMarkedForRemoval(markedForRemoval.filter(eq => eq.id !== removedEquipment.id));

    // 계약 장비 선택 해제
    setSelectedContract(null);

    showToast?.('회수 장비를 재사용하였습니다.', 'success');
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

        // 변경된 모델 정보를 installedEquipments에 업데이트 (localStorage 저장용)
        console.log('[장비모델변경] installedEquipments 업데이트 시작');
        const updatedInstalledEquipments = installedEquipments.map(installed => {
          // 모달에서 변경된 장비 찾기 (SVC_CMPS_ID로 매칭)
          const updatedEquipment = selectedEquipmentsFromModal.find(
            modalEq => modalEq.SVC_CMPS_ID === installed.contractEquipment.SVC_CMPS_ID
          );

          if (updatedEquipment) {
            console.log('[장비모델변경] 장비 업데이트:', {
              id: installed.contractEquipment.id,
              oldModel: installed.contractEquipment.model,
              newModel: updatedEquipment.EQT_CL_NM,
              oldEqtClCd: installed.contractEquipment.eqtClCd,
              newEqtClCd: updatedEquipment.EQT_CL || updatedEquipment.EQT_CL_CD,
            });

            return {
              ...installed,
              contractEquipment: {
                ...installed.contractEquipment,
                model: updatedEquipment.EQT_CL_NM || installed.contractEquipment.model,
                eqtClCd: updatedEquipment.EQT_CL || updatedEquipment.EQT_CL_CD || installed.contractEquipment.eqtClCd,
                LENT: updatedEquipment.LENT,
                EQT_USE_STAT_CD: updatedEquipment.EQT_USE_STAT_CD,
                ITLLMT_PRD: updatedEquipment.ITLLMT_PRD,
                EQT_SALE_AMT: String(updatedEquipment.EQT_SALE_AMT || 0),
              },
              actualEquipment: {
                ...installed.actualEquipment,
                model: updatedEquipment.EQT_CL_NM || installed.actualEquipment.model,
                eqtClCd: updatedEquipment.EQT_CL || updatedEquipment.EQT_CL_CD || installed.actualEquipment.eqtClCd,
                LENT: updatedEquipment.LENT,
                EQT_USE_STAT_CD: updatedEquipment.EQT_USE_STAT_CD,
                ITLLMT_PRD: updatedEquipment.ITLLMT_PRD,
                EQT_SALE_AMT: String(updatedEquipment.EQT_SALE_AMT || 0),
              }
            };
          }
          return installed;
        });

        setInstalledEquipments(updatedInstalledEquipments);
        console.log('[장비모델변경] installedEquipments 업데이트 완료:', updatedInstalledEquipments);

        // 변경된 모델 정보를 contractEquipments에도 업데이트 (기사재고 필터링용)
        console.log('[장비모델변경] contractEquipments 업데이트 시작');
        const updatedContractEquipments = contractEquipments.map(contract => {
          const updatedEquipment = selectedEquipmentsFromModal.find(
            modalEq => modalEq.SVC_CMPS_ID === contract.SVC_CMPS_ID || modalEq.SVC_CMPS_ID === contract.id
          );

          if (updatedEquipment) {
            console.log('[장비모델변경] 계약장비 업데이트:', {
              id: contract.id,
              oldModel: contract.model,
              newModel: updatedEquipment.EQT_CL_NM,
              oldEqtClCd: contract.eqtClCd,
              newEqtClCd: updatedEquipment.EQT_CL || updatedEquipment.EQT_CL_CD,
            });

            return {
              ...contract,
              model: updatedEquipment.EQT_CL_NM || contract.model,
              eqtClCd: updatedEquipment.EQT_CL || updatedEquipment.EQT_CL_CD || contract.eqtClCd,
            };
          }
          return contract;
        });

        setContractEquipments(updatedContractEquipments);
        console.log('[장비모델변경] contractEquipments 업데이트 완료:', updatedContractEquipments);

        // 선택된 계약장비 초기화 (새로운 장비 목록에서 다시 선택해야 함)
        setSelectedContract(null);
        setSelectedStock(null);
        console.log('[장비모델변경] 선택 상태 초기화 (장비 구성이 변경됨)');

        // API 재호출하여 서버에서 변경된 계약장비 목록을 새로 받아옴
        // 장비변경은 계약장비 구성 자체를 변경하므로 서버 데이터를 다시 로드해야 함
        console.log('[장비모델변경] API 재호출하여 변경된 계약장비 목록 로드');
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

  // ITEM_MID_CD별 장비 찾기 헬퍼
  const findEquipmentByItemMidCd = (itemMidCd: string): any | undefined => {
    return installedEquipments.find(eq => {
      const midCd = eq.actualEquipment?.itemMidCd || eq.actualEquipment?.ITEM_MID_CD || '';
      return midCd === itemMidCd;
    });
  };

  // 레거시 신호처리 우선순위에 따른 메인 장비 선택 (fn_signal_trans)
  // 우선순위: 05(ONT) > 01(Router) > 03(모뎀) > 02(무선공유기, I그룹만) > 08(VoIP GW) > 04(STB)
  const getSignalEquipmentByPriority = (): { eqtNo: string; itemMidCd: string } | null => {
    const prodGrp = workItem.PROD_GRP || '';
    const voipProdCd = workItem.VOIP_PROD_CD || '';

    // VoIP 단독형인 경우 ITEM_MID_CD=08만 사용
    if (voipProdCd) {
      const voipGw = findEquipmentByItemMidCd('08');
      if (voipGw) {
        return {
          eqtNo: voipGw.actualEquipment?.id || voipGw.actualEquipment?.EQT_NO || '',
          itemMidCd: '08'
        };
      }
      return null;
    }

    // VoIP 미포함 계약의 우선순위
    // 1. ONT (05)
    const ont = findEquipmentByItemMidCd('05');
    if (ont) {
      return { eqtNo: ont.actualEquipment?.id || ont.actualEquipment?.EQT_NO || '', itemMidCd: '05' };
    }

    // 2. Router (01)
    const router = findEquipmentByItemMidCd('01');
    if (router) {
      return { eqtNo: router.actualEquipment?.id || router.actualEquipment?.EQT_NO || '', itemMidCd: '01' };
    }

    // 3. Modem (03)
    const modem03 = findEquipmentByItemMidCd('03');
    if (modem03) {
      return { eqtNo: modem03.actualEquipment?.id || modem03.actualEquipment?.EQT_NO || '', itemMidCd: '03' };
    }

    // 4. Wireless Router (02) - PROD_GRP=I인 경우만
    if (prodGrp === 'I') {
      const wireless = findEquipmentByItemMidCd('02');
      if (wireless) {
        return { eqtNo: wireless.actualEquipment?.id || wireless.actualEquipment?.EQT_NO || '', itemMidCd: '02' };
      }
    }

    // 5. VoIP Gateway (08)
    const voipGw = findEquipmentByItemMidCd('08');
    if (voipGw) {
      return { eqtNo: voipGw.actualEquipment?.id || voipGw.actualEquipment?.EQT_NO || '', itemMidCd: '08' };
    }

    // 6. STB (04) - 마지막 선택
    const stb = findEquipmentByItemMidCd('04');
    if (stb) {
      return { eqtNo: stb.actualEquipment?.id || stb.actualEquipment?.EQT_NO || '', itemMidCd: '04' };
    }

    return null;
  };

  // PROD_GRP별 신호처리 ETC 파라미터 구성 (레거시 로직)
  const buildSignalEtcParams = (): { etc_1: string; etc_2: string; etc_3: string; etc_4: string } => {
    const prodGrp = workItem.PROD_GRP || '';
    const voipProdCd = workItem.VOIP_PROD_CD || '';
    const ispProdCd = workItem.ISP_PROD_CD || '';

    let etc_1 = '';
    let etc_2 = '';
    let etc_3 = '';
    let etc_4 = '';

    // ETC_1: STB(04) EQT_NO 또는 PROD_GRP=A면 네트워크 분류, VoIP 단독이면 02
    if (!voipProdCd) {
      const stb = findEquipmentByItemMidCd('04');
      if (stb) {
        etc_1 = stb.actualEquipment?.id || stb.actualEquipment?.EQT_NO || '';
      } else if (prodGrp === 'A') {
        // 네트워크 분류값 (workItem에서)
        etc_1 = workItem.NET_CL || '';
      }
    } else {
      // VoIP 단독형
      const wireless = findEquipmentByItemMidCd('02');
      if (wireless) {
        etc_1 = wireless.actualEquipment?.id || wireless.actualEquipment?.EQT_NO || '';
      }
    }

    // ETC_2: ITEM_MID_CD=07 장비 EQT_NO
    const special = findEquipmentByItemMidCd('07');
    if (special) {
      etc_2 = special.actualEquipment?.id || special.actualEquipment?.EQT_NO || '';
    }

    // ETC_3: PROD_GRP=C면 무선공유기(02) EQT_NO
    if (prodGrp === 'C') {
      const wireless = findEquipmentByItemMidCd('02');
      if (wireless) {
        etc_3 = wireless.actualEquipment?.id || wireless.actualEquipment?.EQT_NO || '';
      }
    }

    // ETC_4: PROD_GRP=V면 ITEM_MID_CD=10, ISP_PROD_CD가 있으면 21
    if (prodGrp === 'V') {
      const voipExt = findEquipmentByItemMidCd('10');
      if (voipExt) {
        etc_4 = voipExt.actualEquipment?.id || voipExt.actualEquipment?.EQT_NO || '';
      }
    }
    if (ispProdCd) {
      const isp = findEquipmentByItemMidCd('21');
      if (isp) {
        etc_4 = isp.actualEquipment?.id || isp.actualEquipment?.EQT_NO || '';
      }
    }

    return { etc_1, etc_2, etc_3, etc_4 };
  };

  // 신호처리 메시지 ID 결정 (레거시 로직)
  const getSignalMsgId = (): string => {
    const prodGrp = workItem.PROD_GRP || '';

    // VoIP 상품
    if (prodGrp === 'V') {
      return 'SMR60';
    }

    // LGHV 상품 (STB_CRT) - 추후 조건 추가 가능
    // const isLghvProd = ...;
    // if (isLghvProd) return 'STB_CRT';

    // 기본
    return 'SMR03';
  };

  const handleSignalProcess = async () => {
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

      return false;
    };

    // 1차 검증: 장비가 하나라도 등록되어 있는지
    if (installedEquipments.length === 0) {
      if (showToast) {
        showToast('신호처리를 하려면 먼저 장비를 등록해주세요. STB 또는 모뎀 장비가 필요합니다.', 'warning');
      }
      setLastSignalStatus('fail');
      return;
    }

    // VoIP 연결계약 검증 (PROD_GRP=V이고 VOIP_PROD_CD가 없으면 추가계약 정보 필요)
    const prodGrp = workItem.PROD_GRP || '';
    const voipProdCd = workItem.VOIP_PROD_CD || '';

    if (prodGrp === 'V' && !voipProdCd) {
      // VoIP 연결계약 - 추가 계약 정보 체크 (cmb_ctrt_info)
      if (!workItem.CTRT_JOIN_ID) {
        showToast?.('VoIP의 추가계약 정보가 필요합니다.', 'warning');
        setLastSignalStatus('fail');
        return;
      }
    }

    // ISP 계약 검증 (PROD_GRP=I이고 ISP_PROD_CD가 있으면 계약 선택 필수)
    const ispProdCd = workItem.ISP_PROD_CD || '';
    if (prodGrp === 'I' && ispProdCd) {
      if (!workItem.CTRT_JOIN_ID) {
        showToast?.('계약이 필요한 ISP 상품입니다. 계약의 선택이 필수입니다.', 'warning');
        setLastSignalStatus('fail');
        return;
      }
    }

    // 레거시 우선순위에 따른 메인 장비 선택
    const mainEquipment = getSignalEquipmentByPriority();

    // 2차 검증: STB 또는 모뎀 중 하나라도 등록되어 있는지 (기존 로직 유지)
    const hasStb = installedEquipments.some(isStb);
    const hasModem = installedEquipments.some(isModem);

    if (!hasStb && !hasModem && !mainEquipment) {
      if (showToast) {
        showToast('신호처리를 위해 STB 또는 모뎀 장비를 등록해주세요.', 'warning');
      }
      setLastSignalStatus('fail');
      return;
    }

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

      // 레거시 우선순위로 선택된 메인 장비 사용
      const eqtNo = mainEquipment?.eqtNo || '';

      // STB/모뎀 장비 찾기 (하위 호환)
      const stbEquipment = installedEquipments.find(isStb);
      const modemEquipment = installedEquipments.find(isModem);
      const stbEqtNo = stbEquipment?.actualEquipment?.id || stbEquipment?.id || '';
      const modemEqtNo = modemEquipment?.actualEquipment?.id || modemEquipment?.id || '';

      console.log('[신호처리] 장비 ID:', { mainEqtNo: eqtNo, stbEqtNo, modemEqtNo });

      // ETC 파라미터 구성
      const etcParams = buildSignalEtcParams();
      console.log('[신호처리] ETC 파라미터:', etcParams);

      // 메시지 ID 결정
      const msgId = getSignalMsgId();
      console.log('[신호처리] 메시지 ID:', msgId);

      const apiParams = {
        regUid,
        ctrtId: workItem.CTRT_ID || '',
        workId: workItem.id,
        ifSvcCl: msgId,
        stbEqtNo: stbEqtNo || eqtNo,
        modemEqtNo: modemEqtNo || '',
        etc_1: etcParams.etc_1,
        etc_2: etcParams.etc_2,
        etc_3: etcParams.etc_3,
        etc_4: etcParams.etc_4,
      };

      console.log('[신호처리] API 호출 파라미터:', apiParams);

      const result = await checkStbServerConnection(
        regUid,
        workItem.CTRT_ID || '',
        workItem.id,
        msgId,
        apiParams.stbEqtNo,
        apiParams.modemEqtNo
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

  // 장비 매칭 검증 (fn_eqt_match_chk)
  // 레거시 로직: ITEM_MID_CD=06(케이블) 제외하고 모든 장비에 EQT_NO 필수
  const fn_eqt_match_chk = (): boolean => {
    if (installedEquipments.length < 1) return true;

    for (let i = 0; i < installedEquipments.length; i++) {
      const eq = installedEquipments[i].actualEquipment;
      const itemMidCd = eq.itemMidCd || eq.ITEM_MID_CD;

      // 케이블(06)은 검증 제외
      if (itemMidCd === '06') continue;

      // EQT_NO(장비번호) 필수 체크
      if (!eq.id && !eq.EQT_NO) {
        const eqtClNm = eq.EQT_CL_NM || eq.model || '장비';
        showToast?.(`장비번호가 ${eqtClNm}에 누락되어 있습니다.`, 'error');
        return false;
      }
    }

    return true;
  };

  // 고객 소유 장비 검증 (fn_chk_cust_own_eqt)
  // 레거시 로직: LENT_YN="40"인 경우 추가 검증
  const fn_chk_cust_own_eqt = (): boolean => {
    // 고객 소유 장비(LENT_YN="40")가 있는지 확인
    const hasCustomerOwnedEquipment = installedEquipments.some(
      (eq) => eq.actualEquipment.LENT_YN === '40'
    );

    if (!hasCustomerOwnedEquipment) return true;

    for (let i = 0; i < installedEquipments.length; i++) {
      const eq = installedEquipments[i].actualEquipment;

      // 고객 소유 장비가 아니면 스킵
      if (eq.LENT_YN !== '40') continue;

      const itemMidCd = eq.itemMidCd || eq.ITEM_MID_CD;

      // ITEM_MID_CD=03 (인터넷 모뎀): ITEM_CD, EQT_NO, EQT_UNI_ID 필수
      if (itemMidCd === '03') {
        if (!eq.ITEM_CD) {
          showToast?.('고객소유장비의 품목코드가 누락되었습니다.', 'error');
          return false;
        }
        if (!eq.id && !eq.EQT_NO) {
          showToast?.('고객소유장비의 장비일련번호가 누락되었습니다.', 'error');
          return false;
        }
        if (!eq.EQT_UNI_ID) {
          showToast?.('고객소유장비의 장비ID가 누락되었습니다.', 'error');
          return false;
        }
      }
      // ITEM_MID_CD=02 (STB/모뎀): ITEM_CD, EQT_NO, MAC_ADDRESS 필수
      else if (itemMidCd === '02') {
        if (!eq.ITEM_CD) {
          showToast?.('고객소유장비의 품목코드가 누락되었습니다.', 'error');
          return false;
        }
        if (!eq.id && !eq.EQT_NO) {
          showToast?.('고객소유장비의 장비일련번호가 누락되었습니다.', 'error');
          return false;
        }
        if (!eq.macAddress && !eq.MAC_ADDRESS) {
          showToast?.('고객소유장비의 MAC ADDR이 누락되었습니다.', 'error');
          return false;
        }
      }
      // ITEM_MID_CD=04 (STB): ITEM_CD, EQT_NO, MAC_ADDRESS, STB_CM_MAC, STB_RTCA_ID 필수
      else if (itemMidCd === '04') {
        if (!eq.ITEM_CD) {
          showToast?.('고객소유장비의 품목코드가 누락되었습니다.', 'error');
          return false;
        }
        if (!eq.id && !eq.EQT_NO) {
          showToast?.('고객소유장비의 장비일련번호가 누락되었습니다.', 'error');
          return false;
        }
        if (!eq.macAddress && !eq.MAC_ADDRESS) {
          showToast?.('고객소유장비의 MAC ADDR이 누락되었습니다.', 'error');
          return false;
        }
        if (!eq.STB_CM_MAC) {
          showToast?.('고객소유장비의 STB_CM_MAC이 누락되었습니다.', 'error');
          return false;
        }
        if (!eq.STB_RTCA_ID) {
          showToast?.('고객소유장비의 STB_RTCA_ID가 누락되었습니다.', 'error');
          return false;
        }
      }
      // ITEM_MID_CD=21 (ISP): ITEM_CD, EQT_NO, MAC_ADDRESS 필수
      else if (itemMidCd === '21') {
        if (!eq.ITEM_CD) {
          showToast?.('고객소유장비의 품목코드가 누락되었습니다.', 'error');
          return false;
        }
        if (!eq.id && !eq.EQT_NO) {
          showToast?.('고객소유장비의 장비일련번호가 누락되었습니다.', 'error');
          return false;
        }
        if (!eq.macAddress && !eq.MAC_ADDRESS) {
          showToast?.('고객소유장비의 MAC ADDR이 누락되었습니다.', 'error');
          return false;
        }
      }

      // 공통: OWNER_TP_CD(소유자구분코드) 필수
      if (!eq.OWNER_TP_CD || eq.OWNER_TP_CD === '[]') {
        showToast?.('고객소유장비의 소유구분이 누락되었습니다.', 'error');
        return false;
      }
    }

    return true;
  };

  // 장비 중복 체크 (fn_dbl_eqt_check)
  // 레거시 로직: WIFI/AP, DECT/HANDY 쌍 검증, ISP 콤팩트TV 필수 체크
  const fn_dbl_eqt_check = (): boolean => {
    if (installedEquipments.length < 1) return true;

    // EQT_CL(장비분류코드) 기준 검증
    const hasEqtCl = (eqtCl: string): boolean => {
      return installedEquipments.some(eq => {
        const clCd = eq.actualEquipment?.eqtClCd || eq.actualEquipment?.EQT_CL_CD || '';
        return clCd === eqtCl;
      });
    };

    // 1. WIFI/AP 쌍 검증 (090805, 091002)
    const hasWifi1 = hasEqtCl('090805');
    const hasWifi2 = hasEqtCl('091002');
    if ((hasWifi1 && !hasWifi2) || (!hasWifi1 && hasWifi2)) {
      showToast?.('WIFI/AP(WiFi형)이 모두 선택되어야합니다.', 'error');
      return false;
    }

    // 2. DECT/HANDY 쌍 검증 (090804, 090901)
    const hasDect = hasEqtCl('090804');
    const hasHandy = hasEqtCl('090901');
    if ((hasDect && !hasHandy) || (!hasDect && hasHandy)) {
      showToast?.('DECT/HANDY가 모두 선택되어야합니다.', 'error');
      return false;
    }

    // 3. ISP 콤팩트TV 필수 검증 (MAXW 제품)
    // _MAXW_PROD_CD에 포함된 제품은 092101(콤팩트TV) 필수
    const maxwProdCds = ['MAXW001', 'MAXW002', 'MAXW003']; // 실제 코드 목록 추가 필요
    const basicProdCd = workItem.BASIC_PROD_CD || workItem.PROD_CD || '';
    if (maxwProdCds.includes(basicProdCd)) {
      if (!hasEqtCl('092101')) {
        showToast?.('ISP상품_콤팩트TV제품의 경우 반드시 콤팩트TV가 필요합니다.', 'error');
        return false;
      }
    }

    // 4. 동일 장비번호 중복 등록 체크
    const eqtNos = installedEquipments
      .map(eq => eq.actualEquipment?.id || eq.actualEquipment?.EQT_NO)
      .filter(Boolean);
    const uniqueEqtNos = new Set(eqtNos);
    if (eqtNos.length !== uniqueEqtNos.size) {
      showToast?.('동일한 장비번호가 중복 등록되어 있습니다.', 'error');
      return false;
    }

    return true;
  };

  // 부가상품/빌딩정보 검증 (cfn_eqt_buga_prod_check)
  // 레거시 로직: 부가상품별 필수 장비 체크
  const fn_buga_prod_check = (): boolean => {
    // STB(04) 선택 시 DTV 부가상품 체크 필요
    const hasStb = installedEquipments.some(eq => {
      const itemMidCd = eq.actualEquipment?.itemMidCd || eq.actualEquipment?.ITEM_MID_CD || '';
      return itemMidCd === '04';
    });

    // 부가상품 정보가 workItem에 있는 경우
    const additionProducts = workItem.additionProducts || [];

    for (const prod of additionProducts) {
      // ATTR_VAL_22에 0904가 포함되면 STB 필수
      if (prod.ATTR_VAL_22?.includes('0904') && !hasStb) {
        showToast?.(`${prod.PROD_NM || '부가상품'}에 STB가 필요합니다. STB를 선택하거나 부가상품 체크를 해지하세요.`, 'error');
        return false;
      }
    }

    return true;
  };

  // 저장 및 다음 단계
  const handleSave = () => {
    // 장비 매칭 검증 수행
    if (!fn_eqt_match_chk()) {
      return;
    }

    // 고객 소유 장비 검증 수행
    if (!fn_chk_cust_own_eqt()) {
      return;
    }

    // 장비 중복 체크 수행
    if (!fn_dbl_eqt_check()) {
      return;
    }

    // 부가상품 검증 수행
    if (!fn_buga_prod_check()) {
      return;
    }

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

    // 회수 장비 변환 (분실/파손 상태 포함 - 레거시 mowoa03m06.xml 동일)
    const removals: Equipment[] = markedForRemoval.map(eq => {
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
        SVC_CMPS_ID: eq.SVC_CMPS_ID || '',
        BASIC_PROD_CMPS_ID: eq.BASIC_PROD_CMPS_ID || '',
        MST_SO_ID: eq.MST_SO_ID || workItem.SO_ID || user.soId,
        SO_ID: eq.SO_ID || workItem.SO_ID || user.soId,
        REG_UID: user.userId || user.workerId || 'A20230019',

        // 분실/파손 상태 (레거시 ds_rmv_eqt_info 동일)
        EQT_LOSS_YN: status.EQT_LOSS_YN || '0',
        PART_LOSS_BRK_YN: status.PART_LOSS_BRK_YN || '0',
        EQT_BRK_YN: status.EQT_BRK_YN || '0',
        EQT_CABL_LOSS_YN: status.EQT_CABL_LOSS_YN || '0',
        EQT_CRDL_LOSS_YN: status.EQT_CRDL_LOSS_YN || '0',
      } as any;
    });

    const data: EquipmentData = {
      installedEquipments: equipments,
      removedEquipments: removals,
    };

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
  const reusableEquipments = getReusableRemovedEquipments();

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

        // 분실 상태 (철거 장비 전용) - 레거시 동일
        EQT_LOSS_YN: status.EQT_LOSS_YN || '0',           // 장비분실
        PART_LOSS_BRK_YN: status.PART_LOSS_BRK_YN || '0', // 아답터분실
        EQT_BRK_YN: status.EQT_BRK_YN || '0',             // 리모콘분실
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
        EQT_LOSS_YN: (removals[0] as any).EQT_LOSS_YN,
        PART_LOSS_BRK_YN: (removals[0] as any).PART_LOSS_BRK_YN,
        EQT_BRK_YN: (removals[0] as any).EQT_BRK_YN,
        EQT_CABL_LOSS_YN: (removals[0] as any).EQT_CABL_LOSS_YN,
        EQT_CRDL_LOSS_YN: (removals[0] as any).EQT_CRDL_LOSS_YN,
      });
    }
    console.log('[장비관리-철거] =====================================');

    onSave(data);
  };

  // 철거 작업 UI
  if (isRemovalWork) {
    return (
      <div className="px-2 sm:px-4 py-4 sm:py-6 space-y-3 sm:space-y-4 bg-gray-50 pb-20">
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
            <div className="py-12 text-center">
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

                    {/* 분실/파손 체크박스 - 읽기 전용일 때는 숨김 (모바일 터치 최적화) */}
                    {!isWorkCompleted && !readOnly && (
                      <div className="flex flex-wrap gap-2 pt-3 border-t border-gray-100">
                        <label className={`flex items-center gap-1.5 px-2 py-1.5 rounded-lg active:bg-gray-100 whitespace-nowrap ${isCustomerOwned ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}>
                          <input
                            type="checkbox"
                            checked={status.EQT_LOSS_YN === '1'}
                            onChange={() => !isCustomerOwned && handleRemovalStatusChange(eqtNo, 'EQT_LOSS_YN', status.EQT_LOSS_YN || '0')}
                            disabled={isCustomerOwned}
                            className="w-4 h-4 rounded border-gray-300 text-orange-500 focus:ring-orange-500"
                          />
                          <span className="text-xs text-gray-700 font-medium">장비분실</span>
                        </label>
                        <label className={`flex items-center gap-1.5 px-2 py-1.5 rounded-lg active:bg-gray-100 whitespace-nowrap ${isCustomerOwned ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}>
                          <input
                            type="checkbox"
                            checked={status.PART_LOSS_BRK_YN === '1'}
                            onChange={() => !isCustomerOwned && handleRemovalStatusChange(eqtNo, 'PART_LOSS_BRK_YN', status.PART_LOSS_BRK_YN || '0')}
                            disabled={isCustomerOwned}
                            className="w-4 h-4 rounded border-gray-300 text-orange-500 focus:ring-orange-500"
                          />
                          <span className="text-xs text-gray-700 font-medium">아답터분실</span>
                        </label>
                        <label className={`flex items-center gap-1.5 px-2 py-1.5 rounded-lg active:bg-gray-100 whitespace-nowrap ${isCustomerOwned ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}>
                          <input
                            type="checkbox"
                            checked={status.EQT_BRK_YN === '1'}
                            onChange={() => !isCustomerOwned && handleRemovalStatusChange(eqtNo, 'EQT_BRK_YN', status.EQT_BRK_YN || '0')}
                            disabled={isCustomerOwned}
                            className="w-4 h-4 rounded border-gray-300 text-orange-500 focus:ring-orange-500"
                          />
                          <span className="text-xs text-gray-700 font-medium">리모콘분실</span>
                        </label>
                        <label className={`flex items-center gap-1.5 px-2 py-1.5 rounded-lg active:bg-gray-100 whitespace-nowrap ${isCustomerOwned ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}>
                          <input
                            type="checkbox"
                            checked={status.EQT_CABL_LOSS_YN === '1'}
                            onChange={() => !isCustomerOwned && handleRemovalStatusChange(eqtNo, 'EQT_CABL_LOSS_YN', status.EQT_CABL_LOSS_YN || '0')}
                            disabled={isCustomerOwned}
                            className="w-4 h-4 rounded border-gray-300 text-orange-500 focus:ring-orange-500"
                          />
                          <span className="text-xs text-gray-700 font-medium">케이블분실</span>
                        </label>
                        <label className={`flex items-center gap-1.5 px-2 py-1.5 rounded-lg active:bg-gray-100 whitespace-nowrap ${isCustomerOwned ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}>
                          <input
                            type="checkbox"
                            checked={status.EQT_CRDL_LOSS_YN === '1'}
                            onChange={() => !isCustomerOwned && handleRemovalStatusChange(eqtNo, 'EQT_CRDL_LOSS_YN', status.EQT_CRDL_LOSS_YN || '0')}
                            disabled={isCustomerOwned}
                            className="w-4 h-4 rounded border-gray-300 text-orange-500 focus:ring-orange-500"
                          />
                          <span className="text-xs text-gray-700 font-medium">크래들분실</span>
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
              prodGrp={workItem.PROD_GRP || ''}
              showToast={showToast}
              onSave={handleModelChange}
            />
          );
        })()}
      </div>
    );
  }

  // 정지(04) 작업 UI - 기사재고장비 없이 고객장비 회수만 가능 (레거시 mowoDivD05.xml)
  if (isSuspensionWork) {
    return (
      <div className="px-2 sm:px-4 py-4 sm:py-6 space-y-3 sm:space-y-4 bg-gray-50 pb-20">
        {/* 고객 설치 장비 섹션 */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100">
          <div className="flex items-center justify-between p-3 sm:p-4 border-b border-gray-100">
            <h4 className="text-sm sm:text-base font-bold text-gray-900 flex items-center gap-2">
              📦 고객 설치 장비
            </h4>
            <span className="px-2 sm:px-2.5 py-0.5 sm:py-1 bg-blue-100 text-blue-700 text-[10px] sm:text-xs font-semibold rounded-full">
              {installedEquipments.length}개
            </span>
          </div>

          {installedEquipments.length === 0 ? (
            <div className="py-12 text-center">
              <div className="text-sm text-gray-500">고객 설치 장비가 없습니다</div>
            </div>
          ) : (
            <div className="p-3 sm:p-4 space-y-3">
              {installedEquipments.map(eq => {
                const equipment = eq.actualEquipment;
                const isSelected = selectedStock?.id === equipment.id;

                return (
                  <div
                    key={equipment.id}
                    className={`p-3 sm:p-4 rounded-lg border-2 transition-all cursor-pointer active:scale-[0.98] ${
                      isSelected
                        ? 'border-blue-500 bg-blue-50'
                        : 'border-gray-200 bg-white hover:border-gray-300'
                    }`}
                    onClick={() => {
                      if (!isWorkCompleted) {
                        setSelectedStock(isSelected ? null : equipment);
                      }
                    }}
                  >
                    <div className="flex items-start justify-between">
                      <div className="space-y-1">
                        <div className="text-sm font-semibold text-gray-900">{equipment.model || equipment.type}</div>
                        <div className="text-xs text-gray-600">S/N: {equipment.serialNumber}</div>
                        {equipment.macAddress && (
                          <div className="text-xs text-gray-500">MAC: {equipment.macAddress}</div>
                        )}
                      </div>
                      {isSelected && (
                        <div className="w-5 h-5 rounded-full bg-blue-500 text-white flex items-center justify-center text-xs font-bold">
                          ✓
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* 회수/재사용 버튼 영역 */}
        {!isWorkCompleted && (
          <div className="flex justify-center gap-3">
            {/* 회수 버튼 - 고객설치장비 선택 시 */}
            {selectedStock && installedEquipments.some(eq => eq.actualEquipment.id === selectedStock.id) && (
              <button
                onClick={() => handleMarkForRemoval()}
                className="px-6 py-3 rounded-xl font-bold flex items-center gap-2 active:scale-95 transition-all bg-orange-500 hover:bg-orange-600 text-white"
              >
                <ArrowDown size={20} />
                <span>회수</span>
              </button>
            )}
            {/* 재사용 버튼 - 회수장비 선택 시 (레거시: 철거탭 → 고객장비) */}
            {selectedStock && markedForRemoval.some(eq => eq.id === selectedStock.id) && (
              <button
                onClick={() => handleSuspensionReuse(selectedStock)}
                className="px-6 py-3 rounded-xl font-bold flex items-center gap-2 active:scale-95 transition-all bg-green-500 hover:bg-green-600 text-white"
              >
                <ArrowUp size={20} />
                <span>재사용</span>
              </button>
            )}
          </div>
        )}

        {/* 회수 장비 섹션 (철거 작업 전용) */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100">
          <div className="flex items-center justify-between p-3 sm:p-4 border-b border-gray-100">
            <h4 className="text-sm sm:text-base font-bold text-gray-900 flex items-center gap-2">
              <RotateCcw className="w-4 h-4 sm:w-5 sm:h-5 text-orange-500" />
              회수 장비
            </h4>
            <span className="px-2 sm:px-2.5 py-0.5 sm:py-1 bg-orange-100 text-orange-700 text-[10px] sm:text-xs font-semibold rounded-full">
              {markedForRemoval.length}개
            </span>
          </div>

          {markedForRemoval.length === 0 ? (
            <div className="py-8 text-center">
              <div className="text-sm text-gray-500">회수할 장비를 선택하세요</div>
              <div className="text-xs text-gray-400 mt-1">위 고객 설치 장비를 선택 후 회수 버튼을 누르세요</div>
            </div>
          ) : (
            <div className="p-3 sm:p-4 space-y-3">
              {markedForRemoval.map(equipment => {
                const eqtNo = equipment.id;
                const status = removalStatus[eqtNo] || {};
                const isCustomerOwned = (equipment as any).LENT_YN === '40' ||
                                       (equipment as any).VOIP_CUSTOWN_EQT === 'Y' ||
                                       (equipment as any).eqtClCd === '090852';
                const isSelected = selectedStock?.id === equipment.id;

                return (
                  <div
                    key={equipment.id}
                    className={`p-3 sm:p-4 rounded-lg border-2 transition-all cursor-pointer active:scale-[0.98] ${
                      isSelected
                        ? 'border-green-500 bg-green-50'
                        : 'border-orange-300 bg-orange-50 hover:border-orange-400'
                    }`}
                    onClick={() => {
                      if (!isWorkCompleted) {
                        setSelectedStock(isSelected ? null : equipment);
                      }
                    }}
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div className="space-y-1 flex-1">
                        <div className="flex items-center gap-2">
                          <div className="text-sm font-semibold text-gray-900">{equipment.model || equipment.type}</div>
                        </div>
                        <div className="text-xs text-gray-600">S/N: {equipment.serialNumber}</div>
                        {equipment.macAddress && (
                          <div className="text-xs text-gray-500">MAC: {equipment.macAddress}</div>
                        )}
                      </div>
                      <div className={`w-5 h-5 rounded-full text-white flex items-center justify-center text-xs font-bold ${
                        isSelected ? 'bg-green-500' : 'bg-orange-500'
                      }`}>
                        ✓
                      </div>
                    </div>

                    {/* 분실/파손 체크박스 */}
                    {!isWorkCompleted && !readOnly && (
                      <div className="flex flex-wrap gap-2 pt-3 border-t border-orange-200" onClick={(e) => e.stopPropagation()}>
                        <label className={`flex items-center gap-1.5 px-2 py-1.5 rounded-lg active:bg-orange-100 whitespace-nowrap ${isCustomerOwned ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}>
                          <input
                            type="checkbox"
                            checked={status.EQT_LOSS_YN === '1'}
                            onChange={() => !isCustomerOwned && handleRemovalStatusChange(eqtNo, 'EQT_LOSS_YN', status.EQT_LOSS_YN || '0')}
                            disabled={isCustomerOwned}
                            className="w-4 h-4 rounded border-gray-300 text-orange-500 focus:ring-orange-500"
                          />
                          <span className="text-xs text-gray-700 font-medium">장비분실</span>
                        </label>
                        <label className={`flex items-center gap-1.5 px-2 py-1.5 rounded-lg active:bg-orange-100 whitespace-nowrap ${isCustomerOwned ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}>
                          <input
                            type="checkbox"
                            checked={status.PART_LOSS_BRK_YN === '1'}
                            onChange={() => !isCustomerOwned && handleRemovalStatusChange(eqtNo, 'PART_LOSS_BRK_YN', status.PART_LOSS_BRK_YN || '0')}
                            disabled={isCustomerOwned}
                            className="w-4 h-4 rounded border-gray-300 text-orange-500 focus:ring-orange-500"
                          />
                          <span className="text-xs text-gray-700 font-medium">아답터분실</span>
                        </label>
                        <label className={`flex items-center gap-1.5 px-2 py-1.5 rounded-lg active:bg-orange-100 whitespace-nowrap ${isCustomerOwned ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}>
                          <input
                            type="checkbox"
                            checked={status.EQT_BRK_YN === '1'}
                            onChange={() => !isCustomerOwned && handleRemovalStatusChange(eqtNo, 'EQT_BRK_YN', status.EQT_BRK_YN || '0')}
                            disabled={isCustomerOwned}
                            className="w-4 h-4 rounded border-gray-300 text-orange-500 focus:ring-orange-500"
                          />
                          <span className="text-xs text-gray-700 font-medium">리모콘분실</span>
                        </label>
                        <label className={`flex items-center gap-1.5 px-2 py-1.5 rounded-lg active:bg-orange-100 whitespace-nowrap ${isCustomerOwned ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}>
                          <input
                            type="checkbox"
                            checked={status.EQT_CABL_LOSS_YN === '1'}
                            onChange={() => !isCustomerOwned && handleRemovalStatusChange(eqtNo, 'EQT_CABL_LOSS_YN', status.EQT_CABL_LOSS_YN || '0')}
                            disabled={isCustomerOwned}
                            className="w-4 h-4 rounded border-gray-300 text-orange-500 focus:ring-orange-500"
                          />
                          <span className="text-xs text-gray-700 font-medium">케이블분실</span>
                        </label>
                        <label className={`flex items-center gap-1.5 px-2 py-1.5 rounded-lg active:bg-orange-100 whitespace-nowrap ${isCustomerOwned ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}>
                          <input
                            type="checkbox"
                            checked={status.EQT_CRDL_LOSS_YN === '1'}
                            onChange={() => !isCustomerOwned && handleRemovalStatusChange(eqtNo, 'EQT_CRDL_LOSS_YN', status.EQT_CRDL_LOSS_YN || '0')}
                            disabled={isCustomerOwned}
                            className="w-4 h-4 rounded border-gray-300 text-orange-500 focus:ring-orange-500"
                          />
                          <span className="text-xs text-gray-700 font-medium">크래들분실</span>
                        </label>
                      </div>
                    )}

                    {isCustomerOwned && !isWorkCompleted && (
                      <div className="mt-2 text-xs text-orange-600 bg-orange-100 p-2 rounded">
                        고객소유 장비로 분실처리 불가
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* 연동이력 모달 */}
        <IntegrationHistoryModal
          isOpen={isIntegrationHistoryModalOpen}
          onClose={() => setIsIntegrationHistoryModalOpen(false)}
          ctrtId={workItem.CTRT_ID}
          custId={workItem.CUST_ID || workItem.customer?.id}
        />
      </div>
    );
  }

  // 설치 작업 UI (기존 코드)
  return (
    <div className="px-2 sm:px-4 py-4 sm:py-6 space-y-3 sm:space-y-4 bg-gray-50 pb-20">
      {/* 상단: 고객 설치 장비 (리스트 형식) */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between p-3 sm:p-4 border-b border-gray-100 gap-2">
          <h4 className="text-sm sm:text-base font-bold text-gray-900">고객 설치 장비</h4>
          <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
            {/* 작업 완료 시 장비정보변경 및 신호처리 버튼 숨김 */}
            {!isWorkCompleted && (
              <>
                {/* 장비정보변경 버튼 - showModelChangeButton으로 제어 (모바일 터치 최적화) */}
                {showModelChangeButton && (
                  <button
                    className={`px-3 sm:px-4 py-2.5 sm:py-3 text-sm sm:text-base font-semibold rounded-xl transition-colors whitespace-nowrap active:scale-95 ${
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
                )}
                <button
                  className="px-3 sm:px-4 py-2.5 sm:py-3 text-sm sm:text-base font-semibold text-white bg-blue-500 hover:bg-blue-600 rounded-xl transition-colors flex items-center gap-2 whitespace-nowrap active:scale-95"
                  onClick={handleSignalProcess}
                >
                  <span>신호처리</span>
                  <span className={`w-2.5 h-2.5 sm:w-3 sm:h-3 rounded-full flex-shrink-0 ${
                    lastSignalStatus === 'success' ? 'bg-green-400' :
                    lastSignalStatus === 'fail' ? 'bg-red-400' :
                    'bg-gray-400'
                  }`}></span>
                </button>
              </>
            )}
            {/* 연동이력 버튼 - 작업 완료 시에도 표시 */}
            <button
              className="px-3 sm:px-4 py-2.5 sm:py-3 text-sm sm:text-base font-semibold text-purple-600 bg-purple-50 hover:bg-purple-100 rounded-xl transition-colors flex items-center gap-2 whitespace-nowrap active:scale-95"
              onClick={() => setIsIntegrationHistoryModalOpen(true)}
            >
              <History className="w-4 h-4" />
              <span>연동이력</span>
            </button>
            <span className="px-2.5 sm:px-3 py-1 sm:py-1.5 bg-gray-100 text-gray-700 text-xs sm:text-sm font-semibold rounded-full">{contractEquipments.length}개</span>
          </div>
        </div>

        {!isDataLoaded ? (
          <div className="py-12 text-center">
            <div className="flex flex-col items-center gap-3">
              <div className="w-8 h-8 border-3 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
              <div className="text-sm text-gray-500">장비 정보를 불러오는 중...</div>
            </div>
          </div>
        ) : contractEquipments.length === 0 ? (
          <div className="py-12 text-center">
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
                  className={`p-4 sm:p-5 rounded-xl border-2 transition-all active:scale-[0.98] ${
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
                  <div className="space-y-2.5">
                    <div className="flex items-center justify-between">
                      <span className="text-sm sm:text-base font-semibold text-gray-900">{equipment.type}</span>
                      <span className="text-sm sm:text-base font-medium text-gray-600">{equipment.model}</span>
                    </div>

                    {installed && (
                      <div className="pt-2.5 border-t border-gray-200 space-y-1.5">
                        <div className="text-sm text-green-700 font-medium">✓ 등록: {installed.actualEquipment.model}</div>
                        <div className="text-sm text-gray-600">S/N: {installed.actualEquipment.serialNumber}</div>
                        {installed.macAddress && (
                          <div className="text-sm text-gray-600">MAC: {installed.macAddress}</div>
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

      {/* 중간: 등록/회수 버튼 - 완료된 작업에서는 숨김, WRK_CD별 표시 제어 */}
      {!isWorkCompleted && (showRegisterButton || showRemoveButton) && (
        <div className="flex items-center justify-center gap-3 sm:gap-4">
          {/* 등록 버튼 - showRegisterButton으로 제어 */}
          {showRegisterButton && (
            <button
              className={`flex flex-col items-center justify-center w-16 h-16 sm:w-20 sm:h-20 rounded-xl border-2 transition-all ${
                !selectedContract || !selectedStock || installedEquipments.some(eq => eq.actualEquipment.id === selectedStock.id)
                  ? 'border-gray-200 bg-gray-50 text-gray-400 cursor-not-allowed'
                  : 'border-blue-500 bg-blue-50 text-blue-600 hover:bg-blue-100 cursor-pointer active:scale-95'
              }`}
              onClick={handleRegisterEquipment}
              disabled={
                !selectedContract ||
                !selectedStock ||
                installedEquipments.some(eq => eq.actualEquipment.id === selectedStock.id)
              }
              title="재고 → 고객에게 등록"
            >
              <ArrowUp size={32} className="sm:w-10 sm:h-10" strokeWidth={2.5} />
            </button>
          )}
          {/* 회수 버튼 - showRemoveButton으로 제어 */}
          {showRemoveButton && (
            <button
              className={`flex flex-col items-center justify-center w-16 h-16 sm:w-20 sm:h-20 rounded-xl border-2 transition-all ${
                !selectedStock || !(
                  installedEquipments.some(eq => eq.actualEquipment.id === selectedStock.id) ||
                  removeEquipments.some(eq => eq.id === selectedStock.id)
                )
                  ? 'border-gray-200 bg-gray-50 text-gray-400 cursor-not-allowed'
                  : 'border-red-500 bg-red-50 text-red-600 hover:bg-red-100 cursor-pointer active:scale-95'
              }`}
              onClick={handleMarkForRemoval}
              disabled={!selectedStock || !(
                installedEquipments.some(eq => eq.actualEquipment.id === selectedStock.id) ||
                removeEquipments.some(eq => eq.id === selectedStock.id)
              )}
              title="고객 → 재고로 회수"
            >
              <ArrowDown size={32} className="sm:w-10 sm:h-10" strokeWidth={2.5} />
            </button>
          )}
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
            <span className="px-2.5 sm:px-3 py-1 sm:py-1.5 bg-gray-100 text-gray-700 text-xs sm:text-sm font-semibold rounded-full">
              {selectedContract ? availableStock.length : 0}개
            </span>
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
            <div className="p-3 sm:p-4 space-y-2.5">
              {availableStock.map(stock => (
                <div
                  key={stock.id}
                  className={`p-4 sm:p-5 rounded-xl border-2 transition-all cursor-pointer relative active:scale-[0.98] ${
                    selectedStock?.id === stock.id
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-gray-200 bg-white hover:border-gray-300'
                  }`}
                  onClick={() => handleStockClick(stock)}
                >
                  <div className="space-y-2 sm:space-y-2.5">
                    {/* 장비명/모델 - 줄바꿈으로 표시 */}
                    <div className="flex flex-col">
                      <span className="text-sm sm:text-base font-semibold text-gray-900">{stock.type}</span>
                      <span className="text-sm sm:text-base font-medium text-gray-600">{stock.model}</span>
                    </div>
                    <div className="space-y-1 sm:space-y-1.5">
                      <div className="text-xs sm:text-sm text-gray-600">S/N: {stock.serialNumber}</div>
                      {stock.macAddress && (
                        <div className="text-xs sm:text-sm text-gray-600">MAC: {stock.macAddress}</div>
                      )}
                    </div>
                  </div>
                  {selectedStock?.id === stock.id && (
                    <div className="absolute top-3 sm:top-4 right-3 sm:right-4 w-6 h-6 sm:w-7 sm:h-7 rounded-full bg-blue-500 text-white flex items-center justify-center text-sm sm:text-base font-bold">
                      ✓
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* 회수 장비 재사용 섹션 - 레거시 동일: 철거한 장비를 다시 설치 장비로 사용 */}
      {/* WRK_CD=01(설치)에서는 숨김 (레거시 mowoDivD01.xml에는 철거 탭 없음) */}
      {!hideRemovalSection && selectedContract && reusableEquipments.length > 0 && !isWorkCompleted && (
        <div className="bg-white rounded-xl shadow-sm border border-green-200">
          <div className="flex items-center justify-between p-3 sm:p-4 border-b border-green-100">
            <h4 className="text-sm sm:text-base font-bold text-gray-900 flex items-center gap-2">
              <RotateCcw className="w-4 h-4 sm:w-5 sm:h-5 text-green-500" />
              회수 장비 재사용
              {selectedContract && <span className="text-green-600"> ({selectedContract.type})</span>}
            </h4>
            <span className="px-2 sm:px-2.5 py-0.5 sm:py-1 bg-green-100 text-green-700 text-[10px] sm:text-xs font-semibold rounded-full">
              {reusableEquipments.length}개
            </span>
          </div>

          <div className="p-3 sm:p-4 space-y-2.5">
            <div className="text-sm text-gray-500 mb-2">회수한 장비를 다시 설치에 사용할 수 있습니다.</div>
            {reusableEquipments.map(eq => (
              <div
                key={eq.id}
                className="p-4 sm:p-5 rounded-xl border-2 border-green-200 bg-green-50 hover:border-green-400 transition-all cursor-pointer relative active:scale-[0.98]"
                onClick={() => reuseRemovedEquipment(eq)}
              >
                <div className="space-y-2 sm:space-y-2.5">
                  <div className="flex flex-col">
                    <span className="text-sm sm:text-base font-semibold text-gray-900">{eq.type}</span>
                    <span className="text-sm sm:text-base font-medium text-gray-600">{eq.model}</span>
                  </div>
                  <div className="space-y-1 sm:space-y-1.5">
                    <div className="text-xs sm:text-sm text-gray-600">S/N: {eq.serialNumber}</div>
                    {eq.macAddress && (
                      <div className="text-xs sm:text-sm text-gray-600">MAC: {eq.macAddress}</div>
                    )}
                  </div>
                </div>
                <div className="absolute top-3 sm:top-4 right-3 sm:right-4 px-2.5 py-1 bg-green-500 text-white text-xs sm:text-sm font-medium rounded-full">
                  재사용
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 회수 장비 섹션 - 완료된 작업에서는 클릭 불가 */}
      {/* WRK_CD=04(정지)에서 회수 시 철거와 동일한 체크박스 UI 표시 (레거시 mowoDivD05.xml 동일) */}
      {/* markedForRemoval: 회수 버튼으로 회수한 장비 목록 (체크박스 표시용) */}
      {/* WRK_CD=01(설치)에서는 숨김 (레거시 mowoDivD01.xml에는 철거 탭 없음) */}
      {!hideRemovalSection && markedForRemoval.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between p-3 sm:p-4 border-b border-gray-100 gap-2">
            <h4 className="text-sm sm:text-base font-bold text-gray-900 flex items-center gap-1.5 sm:gap-2">
              <RotateCcw className="w-4 h-4 sm:w-5 sm:h-5 text-orange-500" />
              회수 장비
            </h4>
            <span className="px-2 sm:px-2.5 py-0.5 sm:py-1 bg-orange-100 text-orange-700 text-[10px] sm:text-xs font-semibold rounded-full">
              {markedForRemoval.length}개
            </span>
          </div>

          <div className="p-3 sm:p-4 space-y-3">
            {markedForRemoval.map(equipment => {
              const eqtNo = equipment.id;
              const status = removalStatus[eqtNo] || {};
              // 고객소유(LENT_YN='40') 또는 특정 장비는 분실처리 불가 (레거시 로직)
              const isCustomerOwned = (equipment as any).LENT_YN === '40' ||
                                     (equipment as any).VOIP_CUSTOWN_EQT === 'Y' ||
                                     (equipment as any).eqtClCd === '090852';

              return (
                <div
                  key={equipment.id}
                  className="p-3 sm:p-4 rounded-lg border border-orange-500 bg-orange-50"
                >
                  {/* 장비 정보 */}
                  <div className="flex items-start justify-between mb-3">
                    <div className="space-y-1 flex-1">
                      <div className="text-sm font-semibold text-gray-900">{equipment.model || equipment.type}</div>
                      <div className="text-xs text-gray-600">S/N: {equipment.serialNumber}</div>
                      {equipment.macAddress && (
                        <div className="text-xs text-gray-500">MAC: {equipment.macAddress}</div>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded">
                        {(equipment as any).EQT_LOC_TP_NM || '회수'}
                      </span>
                      <div className="w-5 h-5 sm:w-6 sm:h-6 rounded-full bg-orange-500 text-white flex items-center justify-center text-xs sm:text-sm font-bold">
                        ✓
                      </div>
                    </div>
                  </div>

                  {/* 분실/파손 체크박스 (레거시 mowoa03m06.xml 동일) */}
                  {!isWorkCompleted && !readOnly && (
                    <div className="flex flex-wrap gap-2 pt-3 border-t border-orange-200">
                      <label className={`flex items-center gap-1.5 px-2 py-1.5 rounded-lg active:bg-orange-100 whitespace-nowrap ${isCustomerOwned ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}>
                        <input
                          type="checkbox"
                          checked={status.EQT_LOSS_YN === '1'}
                          onChange={() => {
                            if (!isCustomerOwned) handleRemovalStatusChange(eqtNo, 'EQT_LOSS_YN', status.EQT_LOSS_YN || '0');
                          }}
                          disabled={isCustomerOwned}
                          className="w-4 h-4 rounded border-gray-300 text-orange-500 focus:ring-orange-500"
                        />
                        <span className="text-xs text-gray-700 font-medium">장비분실</span>
                      </label>
                      <label className={`flex items-center gap-1.5 px-2 py-1.5 rounded-lg active:bg-orange-100 whitespace-nowrap ${isCustomerOwned ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}>
                        <input
                          type="checkbox"
                          checked={status.PART_LOSS_BRK_YN === '1'}
                          onChange={() => {
                            if (!isCustomerOwned) handleRemovalStatusChange(eqtNo, 'PART_LOSS_BRK_YN', status.PART_LOSS_BRK_YN || '0');
                          }}
                          disabled={isCustomerOwned}
                          className="w-4 h-4 rounded border-gray-300 text-orange-500 focus:ring-orange-500"
                        />
                        <span className="text-xs text-gray-700 font-medium">아답터분실</span>
                      </label>
                      <label className={`flex items-center gap-1.5 px-2 py-1.5 rounded-lg active:bg-orange-100 whitespace-nowrap ${isCustomerOwned ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}>
                        <input
                          type="checkbox"
                          checked={status.EQT_BRK_YN === '1'}
                          onChange={() => {
                            if (!isCustomerOwned) handleRemovalStatusChange(eqtNo, 'EQT_BRK_YN', status.EQT_BRK_YN || '0');
                          }}
                          disabled={isCustomerOwned}
                          className="w-4 h-4 rounded border-gray-300 text-orange-500 focus:ring-orange-500"
                        />
                        <span className="text-xs text-gray-700 font-medium">리모콘분실</span>
                      </label>
                      <label className={`flex items-center gap-1.5 px-2 py-1.5 rounded-lg active:bg-orange-100 whitespace-nowrap ${isCustomerOwned ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}>
                        <input
                          type="checkbox"
                          checked={status.EQT_CABL_LOSS_YN === '1'}
                          onChange={() => {
                            if (!isCustomerOwned) handleRemovalStatusChange(eqtNo, 'EQT_CABL_LOSS_YN', status.EQT_CABL_LOSS_YN || '0');
                          }}
                          disabled={isCustomerOwned}
                          className="w-4 h-4 rounded border-gray-300 text-orange-500 focus:ring-orange-500"
                        />
                        <span className="text-xs text-gray-700 font-medium">케이블분실</span>
                      </label>
                      <label className={`flex items-center gap-1.5 px-2 py-1.5 rounded-lg active:bg-orange-100 whitespace-nowrap ${isCustomerOwned ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}>
                        <input
                          type="checkbox"
                          checked={status.EQT_CRDL_LOSS_YN === '1'}
                          onChange={() => {
                            if (!isCustomerOwned) handleRemovalStatusChange(eqtNo, 'EQT_CRDL_LOSS_YN', status.EQT_CRDL_LOSS_YN || '0');
                          }}
                          disabled={isCustomerOwned}
                          className="w-4 h-4 rounded border-gray-300 text-orange-500 focus:ring-orange-500"
                        />
                        <span className="text-xs text-gray-700 font-medium">크래들분실</span>
                      </label>
                    </div>
                  )}

                  {/* 고객소유 장비 안내 */}
                  {isCustomerOwned && !isWorkCompleted && (
                    <div className="mt-2 text-xs text-orange-600 bg-orange-100 p-2 rounded">
                      고객소유 장비로 분실처리 불가
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

      {/* 연동이력 모달 */}
      <IntegrationHistoryModal
        isOpen={isIntegrationHistoryModalOpen}
        onClose={() => setIsIntegrationHistoryModalOpen(false)}
        ctrtId={workItem.CTRT_ID}
        custId={workItem.CUST_ID || workItem.customer?.id}
      />

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
    </div>
  );
};

export default EquipmentManagement;
