/**
 * EquipmentMoveRemoval Component
 * WRK_CD=06 (댁내이전), WRK_CD=07 (이전설치) 장비정보 컴포넌트
 * 레거시 참조: mowoDivD05.xml, mowoa03m06.xml, mowoa03m07.xml
 *
 * 주요 기능:
 * - 댁내이전/이전설치 전용 컴포넌트
 * - WRK_CD=06 (댁내이전): 특정 6개 장비 코드만 철거 가능, 분실처리만 (장비이관 없음)
 * - WRK_CD=07 (이전설치): **모든 장비 철거 가능**, 장비이관 + 분실처리 모두 가능
 * - 철거한 장비를 재사용하여 설치 가능
 * - 설치 + 철거 기능 모두 포함
 * - 분실/파손 체크박스 처리
 * - 신호처리, 장비모델변경, 연동이력 기능
 *
 * 레거시 장비이관 버튼 조건 (mowoa03m06.xml 893-915줄):
 * - WRK_CD=07 (이전설치): btn_eqt_move.Visible = "true" (장비이관 가능)
 * - WRK_CD=06 (댁내이전): btn_eqt_move.Visible = "false" (장비이관 없음, 분실처리만)
 *
 * 재사용 가능한 장비 코드 (WRK_CD=06만 해당):
 * - 091001: 공유기(WIFI)
 * - 091005: 공유기(WIFI5)
 * - 091006: 공유기(WIFI6)
 * - 091401: 스마트공유기
 * - 092401: OTT_STB(임대용/H5)
 * - 090251: 기가와이파이-GU
 */

import React, { useState, useEffect, useMemo } from 'react';
import { ArrowDown, ArrowUp, CheckCircle2, XCircle, Loader2, RotateCcw, ScanBarcode, History } from 'lucide-react';
import { getTechnicianEquipments, updateEquipmentComposition, checkStbServerConnection, getEqtSoMoveInfo, getMVRemoveEqtInfo } from '../../../../services/apiService';
import EquipmentModelChangeModal from '../../../equipment/EquipmentModelChangeModal';
import IntegrationHistoryModal from '../../../modal/IntegrationHistoryModal';
import EquipmentMoveModal from '../modals/EquipmentMoveModal';
import { useWorkProcessStore } from '../../../../stores/workProcessStore';
import { useWorkEquipmentStore, useWorkEquipment } from '../../../../stores/workEquipmentStore';
import {
  EquipmentComponentProps,
  ExtendedEquipment,
  ContractEquipment,
  InstalledEquipment,
  EquipmentData,
  LossStatusData,
  getWorkCodeName,
  getContractStatusName,
  MOVE_INSTALL_REUSABLE_EQT_CL_CDS,
  mapWrkCdToCrrTskCl,
} from './shared/types';

const EquipmentMoveRemoval: React.FC<EquipmentComponentProps> = ({
  workItem,
  onSave,
  onBack,
  showToast,
  preloadedApiData,
  onPreloadedDataUpdate,
  readOnly = false,
}) => {
  // 작업 완료 여부 확인
  const isWorkCompleted = readOnly || workItem.WRK_STAT_CD === '4' || workItem.status === '완료';

  // Work Process Store (필터링 데이터 저장용)
  const { setFilteringData } = useWorkProcessStore();

  // Zustand store actions
  const workId = workItem.id;
  const {
    initWorkState,
    setApiData,
    setDataLoaded: storeSetDataLoaded,
    setInstalledEquipments: storeSetInstalledEquipments,
    setMarkedForRemoval: storeSetMarkedForRemoval,
    addMarkedForRemoval,
    removeMarkedForRemoval,
    setSelectedContract: storeSetSelectedContract,
    setSelectedStock: storeSetSelectedStock,
    setSignalStatus: storeSetSignalStatus,
    setSignalResult: storeSetSignalResult,
    setPendingLossStatusList: storeSetPendingLossStatusList,
    setRemovalStatus: storeSetRemovalStatus,
  } = useWorkEquipmentStore();

  // Zustand store state
  const {
    contractEquipments,
    technicianEquipments,
    customerEquipments,
    removeEquipments,
    installedEquipments,
    markedForRemoval,
    removalStatus,
    pendingLossStatusList,
    selectedContract,
    selectedStock,
    signalStatus: lastSignalStatus,
    signalResult,
    isReady: isDataLoaded,
  } = useWorkEquipment(workId);

  // API output4에서 받아온 고객장비 수 (서버에 이미 등록된 장비)
  const customerEquipmentCount = customerEquipments.length;

  // 장비정보변경 모달 상태
  const [isModelChangeModalOpen, setIsModelChangeModalOpen] = useState(false);

  // 연동이력 모달 상태
  const [isIntegrationHistoryModalOpen, setIsIntegrationHistoryModalOpen] = useState(false);

  // 장비이관 모달 상태 (WRK_CD=07 전용)
  const [isEquipmentMoveModalOpen, setIsEquipmentMoveModalOpen] = useState(false);

  // 신호처리 팝업 상태
  const [isSignalPopupOpen, setIsSignalPopupOpen] = useState(false);
  const [isSignalProcessing, setIsSignalProcessing] = useState(false);

  // 바코드 스캔 상태
  const [isBarcodeScanning, setIsBarcodeScanning] = useState(false);

  // 하단 탭 상태 (철거장비/기사재고장비)
  const [bottomTab, setBottomTab] = useState<'removal' | 'stock'>('stock');

  // 이관된 장비 시리얼 넘버 (하이라이트 표시용) - API에서 가져온 이관 완료 장비
  const [transferredEquipmentSerials, setTransferredEquipmentSerials] = useState<Set<string>>(new Set());
  // 방금 이관한 장비 (깜빡임 애니메이션용)
  const [recentlyTransferredSerials, setRecentlyTransferredSerials] = useState<Set<string>>(new Set());

  // 철거장비 개수 (getMVRemoveEqtInfo API에서 조회 - WRK_CD=07 전용)
  const [removalEquipmentCount, setRemovalEquipmentCount] = useState(0);

  // 초기 데이터 로드
  useEffect(() => {
    // 이미 데이터가 로드된 상태면 건너뜀 (탭 이동 시 기존 데이터 유지)
    if (isDataLoaded && (installedEquipments.length > 0 || markedForRemoval.length > 0 || contractEquipments.length > 0)) {
      console.log('[장비관리-이전] 이미 데이터 로드됨 - 기존 데이터 유지');
      return;
    }
    initWorkState(workId);
    loadEquipmentData();
  }, [workItem.id]);

  // 이전설치(07)인 경우 철거장비 개수 미리 조회 (뱃지 표시용)
  useEffect(() => {
    if (workItem.WRK_CD === '07') {
      const loadRemovalCount = async () => {
        try {
          const custId = workItem.customer?.id || workItem.CUST_ID || '';
          const rcptId = workItem.RCPT_ID || '';
          if (custId && rcptId) {
            const result = await getMVRemoveEqtInfo({ CUST_ID: custId, RCPT_ID: rcptId });
            setRemovalEquipmentCount(result.length);
          }
        } catch (error) {
          console.error('[장비철거] 철거장비 개수 조회 실패:', error);
        }
      };
      loadRemovalCount();
    }
  }, [workItem.id, workItem.WRK_CD]);

  // Zustand store가 자동으로 localStorage에 persist하므로 별도 저장 로직 불필요

  const loadEquipmentData = async (forceRefresh = false) => {
    try {
      let apiResponse;

      // 이전설치(06/07) 작업은 반드시 계약장비(output2)가 있어야 함
      // preloadedApiData가 있어도 계약장비가 비어있으면 API 재호출
      const hasValidPreloadedData = preloadedApiData &&
        preloadedApiData.contractEquipments &&
        preloadedApiData.contractEquipments.length > 0;

      if (hasValidPreloadedData && !forceRefresh) {
        console.log('[장비관리-이전설치] Pre-loaded 데이터 사용 -', preloadedApiData.contractEquipments.length, '개 계약장비');
        apiResponse = preloadedApiData;
      } else {
        if (forceRefresh) {
          console.log('[장비관리-이전설치] 강제 새로고침 - API 호출');
        } else if (preloadedApiData && (!preloadedApiData.contractEquipments || preloadedApiData.contractEquipments.length === 0)) {
          console.log('[장비관리-이전설치] preloadedApiData 계약장비 없음 - API 재호출');
        }

        const userInfo = localStorage.getItem('userInfo');
        if (!userInfo) {
          console.error('사용자 정보가 없습니다.');
          return;
        }

        const user = JSON.parse(userInfo);
        const crrTskCl = mapWrkCdToCrrTskCl(workItem.WRK_CD);

        const requestPayload = {
          WRKR_ID: user.workerId || 'A20130708',
          SO_ID: workItem.SO_ID || user.soId,
          WORK_ID: workItem.id,
          CUST_ID: workItem.customer?.id || workItem.CUST_ID,
          RCPT_ID: workItem.RCPT_ID || null,
          CTRT_ID: workItem.CTRT_ID || null,
          CRR_ID: workItem.CRR_ID || null,
          ADDR_ORD: workItem.ADDR_ORD || null,
          CRR_TSK_CL: crrTskCl,
          WRK_DTL_TCD: workItem.WRK_DTL_TCD || '',
          WRK_CD: workItem.WRK_CD || null,
          WRK_STAT_CD: workItem.WRK_STAT_CD || null,
          WRK_DRCTN_ID: workItem.WRK_DRCTN_ID || workItem.directionId || null,
          BLD_ID: workItem.BLD_ID || null,
          PROD_CD: workItem.PROD_CD || null,
        };

        console.log('[장비관리-이전설치] API 호출:', requestPayload);
        apiResponse = await getTechnicianEquipments(requestPayload);

        if (forceRefresh && onPreloadedDataUpdate) {
          console.log('[장비관리-이전설치] 부모 컴포넌트 preloadedData 업데이트');
          onPreloadedDataUpdate(apiResponse);
        }
      }

      console.log('[장비관리-이전설치] API 응답:', {
        contractEquipments: apiResponse.contractEquipments?.length || 0,
        technicianEquipments: apiResponse.technicianEquipments?.length || 0,
        customerEquipments: apiResponse.customerEquipments?.length || 0,
        removedEquipments: apiResponse.removedEquipments?.length || 0,
      });

      // 필터링 데이터를 Zustand Store에 저장
      const filterData = {
        kpiProdGrpCd: apiResponse.kpiProdGrpCd,
        prodChgGb: apiResponse.prodChgGb,
        chgKpiProdGrpCd: apiResponse.chgKpiProdGrpCd,
        prodGrp: apiResponse.prodGrp,
      };
      setFilteringData(filterData);
      (window as any).__equipmentFilterData = filterData;

      // output2: 계약 장비
      const contracts: ContractEquipment[] = (apiResponse.contractEquipments || []).map((eq: any) => ({
        id: eq.SVC_CMPS_ID || eq.PROD_CMPS_ID,
        type: eq.ITEM_MID_NM || eq.EQT_NM,
        model: eq.EQT_CL_NM,
        serialNumber: 'N/A',
        itemMidCd: eq.ITEM_MID_CD,
        eqtClCd: eq.EQT_CL_CD || eq.EQT_CL,
        SVC_CMPS_ID: eq.SVC_CMPS_ID,
        BASIC_PROD_CMPS_ID: eq.BASIC_PROD_CMPS_ID,
        PROD_CD: eq.PROD_CD,
        SVC_CD: eq.SVC_CD,
      }));

      // output3: 기사 재고
      const techStock: ExtendedEquipment[] = (apiResponse.technicianEquipments || []).map((eq: any) => ({
        id: eq.EQT_NO,
        type: eq.ITEM_MID_NM,
        model: eq.EQT_CL_NM,
        serialNumber: eq.EQT_SERNO,
        itemMidCd: eq.ITEM_MID_CD,
        eqtClCd: eq.EQT_CL_CD || eq.EQT_CL,
        macAddress: eq.MAC_ADDRESS,
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
        LENT_YN: eq.LENT_YN,
        ITLLMT_PRD: eq.ITLLMT_PRD,
        EQT_USE_STAT_CD: eq.EQT_USE_STAT_CD,
      }));

      // output4: 고객 설치 장비
      const installed: InstalledEquipment[] = (apiResponse.customerEquipments || []).map((eq: any) => {
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
            eqtClCd: eq.EQT_CL_CD || eq.EQT_CL,
            macAddress: eq.MAC_ADDRESS || eq.MAC_ADDR,
            LENT_YN: eq.LENT_YN,
            VOIP_CUSTOWN_EQT: eq.VOIP_CUSTOWN_EQT,
          },
          macAddress: eq.MAC_ADDRESS || eq.MAC_ADDR,
          installLocation: eq.INSTL_LCTN,
        };
      });

      // output4에서 고객장비 원본 데이터 추출 (장비이관 모달용)
      const custEquipments: ExtendedEquipment[] = (apiResponse.customerEquipments || []).map((eq: any) => ({
        id: eq.EQT_NO,
        type: eq.ITEM_MID_NM,
        model: eq.EQT_CL_NM,
        serialNumber: eq.EQT_SERNO,
        itemMidCd: eq.ITEM_MID_CD,
        eqtClCd: eq.EQT_CL_CD || eq.EQT_CL,
        macAddress: eq.MAC_ADDRESS || eq.MAC_ADDR,
        SVC_CMPS_ID: eq.SVC_CMPS_ID,
        BASIC_PROD_CMPS_ID: eq.BASIC_PROD_CMPS_ID,
        LENT_YN: eq.LENT_YN,
        VOIP_CUSTOWN_EQT: eq.VOIP_CUSTOWN_EQT,
      }));

      // output5: 회수 장비 (고객 현장에서 철거 가능한 장비)
      const removed: ExtendedEquipment[] = (apiResponse.removedEquipments || []).map((eq: any) => ({
        id: eq.EQT_NO,
        type: eq.ITEM_MID_NM,
        model: eq.EQT_CL_NM,
        serialNumber: eq.EQT_SERNO,
        itemMidCd: eq.ITEM_MID_CD,
        eqtClCd: eq.EQT_CL_CD || eq.EQT_CL,
        macAddress: eq.MAC_ADDRESS || eq.MAC_ADDR,
        installLocation: eq.INSTL_LCTN,
        SVC_CMPS_ID: eq.SVC_CMPS_ID,
        BASIC_PROD_CMPS_ID: eq.BASIC_PROD_CMPS_ID,
        MST_SO_ID: eq.MST_SO_ID,
        SO_ID: eq.SO_ID,
        LENT_YN: eq.LENT_YN,
        VOIP_CUSTOWN_EQT: eq.VOIP_CUSTOWN_EQT,
      }));

      // Zustand store에 API 데이터 설정
      setApiData(workId, {
        contractEquipments: contracts,
        technicianEquipments: techStock,
        customerEquipments: custEquipments,
        removeEquipments: removed,
        filteringData: filterData,
      });

      // WRK_CD=07 (이전설치)인 경우 이관된 장비 목록 조회
      if (workItem.WRK_CD === '07' && workItem.id) {
        try {
          const moveInfoList = await getEqtSoMoveInfo({ WRK_ID: workItem.id });
          // SUCCESS인 장비의 시리얼만 추출
          const transferredSerials = moveInfoList
            .filter((info: any) => info.SUCCESS_GUBN === 'SUCCESS')
            .map((info: any) => info.EQT_SERNO)
            .filter(Boolean);
          console.log('[장비관리-이전설치] 이관 완료된 장비:', transferredSerials);
          setTransferredEquipmentSerials(new Set(transferredSerials));
        } catch (err) {
          console.error('[장비관리-이전설치] 이관 장비 조회 실패:', err);
        }
      }

      // Zustand persist에서 이미 복원된 상태가 있는지 확인
      const existingMarkedForRemoval = markedForRemoval || [];

      if (installed.length > 0) {
        console.log('[장비관리-이전설치] API에서 받은 고객 설치 장비 사용:', installed.length, '개');

        // 기존에 철거 등록된 장비가 있으면 설치 장비에서 제외
        if (existingMarkedForRemoval.length > 0) {
          const markedForRemovalIds = new Set(existingMarkedForRemoval.map(eq => eq.id));
          const filteredInstalled = installed.filter(eq => !markedForRemovalIds.has(eq.actualEquipment.id));
          storeSetInstalledEquipments(workId, filteredInstalled);
        } else {
          storeSetInstalledEquipments(workId, installed);
        }
        // Zustand persist에서 자동으로 신호처리 상태, 분실처리 대기 데이터 복원됨
      }
      // else: Zustand persist에서 이미 복원된 installedEquipments, markedForRemoval 사용

      // Use requestAnimationFrame to ensure state updates are applied before marking data as loaded
      requestAnimationFrame(() => storeSetDataLoaded(workId, true));
    } catch (error) {
      console.error('[장비관리-이전설치] 장비 데이터 로드 실패:', error);
      requestAnimationFrame(() => storeSetDataLoaded(workId, true));
    }
  };

  // 대내이전설치(06) 작업에서 재사용 가능한 장비인지 확인
  // 이전설치(07)에서는 이 검증을 사용하지 않음 (모든 장비 철거 가능)
  const isMoveInstallReusableEquipment = (eqtClCd?: string): boolean => {
    if (!eqtClCd) return false;
    return MOVE_INSTALL_REUSABLE_EQT_CL_CDS.includes(eqtClCd);
  };

  // 계약 장비 카드 클릭
  const handleContractClick = (contract: ContractEquipment) => {
    const installed = installedEquipments.find(eq => eq.contractEquipment.id === contract.id);

    if (selectedContract?.id === contract.id) {
      storeSetSelectedContract(workId, null);
      storeSetSelectedStock(workId, null);
    } else {
      storeSetSelectedContract(workId, contract);
      if (installed) {
        storeSetSelectedStock(workId, installed.actualEquipment);
      } else {
        storeSetSelectedStock(workId, null);
      }
    }
  };

  // 재고 장비 클릭
  const handleStockClick = (stock: ExtendedEquipment) => {
    if (selectedStock?.id === stock.id) {
      storeSetSelectedStock(workId, null);
    } else {
      storeSetSelectedStock(workId, stock);
    }
  };

  // 등록 버튼
  // WRK_CD=06 (댁내이전): 특정 장비만 등록 가능 (레거시 mowoDivD05.xml 435-448줄)
  // WRK_CD=07 (이전설치): 모든 장비 등록 가능
  const handleRegisterEquipment = () => {
    if (!selectedContract || !selectedStock) return;

    // 레거시 검증: 댁내이전(06) 작업 시 재사용 가능한 장비만 등록 가능
    // 레거시 mowoa03m06.xml 라인 1905-1918
    if (workItem.WRK_CD === '06') {
      const eqtClCd = selectedStock.eqtClCd || selectedStock.EQT_CL_CD;
      if (!isMoveInstallReusableEquipment(eqtClCd)) {
        showToast?.('댁내이전 작업으로 장비 철거하실 수 없습니다.\n장비교체처리불가', 'error');
        return;
      }
    }

    const existingIndex = installedEquipments.findIndex(eq => eq.contractEquipment.id === selectedContract.id);

    if (existingIndex >= 0) {
      const updated = [...installedEquipments];
      updated[existingIndex] = {
        contractEquipment: selectedContract,
        actualEquipment: selectedStock,
        macAddress: selectedStock.macAddress || '',
        installLocation: '',
      };
      storeSetInstalledEquipments(workId, updated);
    } else {
      const newInstalled: InstalledEquipment = {
        contractEquipment: selectedContract,
        actualEquipment: selectedStock,
        macAddress: selectedStock.macAddress || '',
        installLocation: '',
      };
      storeSetInstalledEquipments(workId, [...installedEquipments, newInstalled]);
    }

    storeSetSignalStatus(workId, 'idle');
    storeSetSelectedStock(workId, null);
    storeSetSelectedContract(workId, null);
  };

  // 회수 버튼
  // WRK_CD=06 (대내이전설치): 특정 장비만 철거 가능
  // WRK_CD=07 (이전설치): 모든 장비 철거 가능 (제한 없음!)
  const handleMarkForRemoval = () => {
    if (!selectedStock) return;

    // 레거시 검증: 댁내이전(06) 작업 시만 재사용 가능한 장비만 철거 가능
    // 이전설치(07)은 제한 없음 - 레거시 mowoa03m06.xml 라인 1905-1918
    if (workItem.WRK_CD === '06') {
      const eqtClCd = selectedStock.eqtClCd || selectedStock.EQT_CL_CD;
      if (!isMoveInstallReusableEquipment(eqtClCd)) {
        showToast?.('댁내이전 작업으로 장비 철거하실 수 없습니다.\n장비교체처리불가', 'error');
        return;
      }
    }
    // WRK_CD='07' (이전설치)은 여기서 검증 없이 통과 -> 모든 장비 철거 가능!

    const installedIndex = installedEquipments.findIndex(eq => eq.actualEquipment.id === selectedStock.id);

    if (installedIndex >= 0) {
      const updated = [...installedEquipments];
      const removedEquipment = updated.splice(installedIndex, 1)[0];
      storeSetInstalledEquipments(workId, updated);

      const removedActualEquipment = removedEquipment.actualEquipment;
      const isAlreadyMarked = markedForRemoval.some(eq => eq.id === removedActualEquipment.id);
      if (!isAlreadyMarked) {
        addMarkedForRemoval(workId, removedActualEquipment);
      }

      storeSetSignalStatus(workId, 'idle');
      storeSetSelectedStock(workId, null);
      storeSetSelectedContract(workId, null);
      if (workItem.WRK_CD === '06') {
        setBottomTab('removal'); // 댁내이전만 철거장비 탭으로 전환
      }
      return;
    }

    const isAlreadyMarked = markedForRemoval.some(eq => eq.id === selectedStock.id);
    if (isAlreadyMarked) return;

    const isRemoveEquipment = removeEquipments.some(eq => eq.id === selectedStock.id);
    if (isRemoveEquipment) {
      addMarkedForRemoval(workId, selectedStock);
      if (workItem.WRK_CD === '06') {
        setBottomTab('removal'); // 댁내이전만 철거장비 탭으로 전환
      }
    }
  };

  // 회수 장비를 설치 장비로 재사용
  const reuseRemovedEquipment = (removedEquipment: ExtendedEquipment) => {
    if (!selectedContract) {
      showToast?.('먼저 계약장비를 선택해주세요.', 'warning');
      return;
    }

    const newInstalled: InstalledEquipment = {
      contractEquipment: selectedContract,
      actualEquipment: {
        ...removedEquipment,
        EQT_CHG_GB: '3', // 재사용
      },
      macAddress: removedEquipment.macAddress,
    };

    storeSetInstalledEquipments(workId, [...installedEquipments, newInstalled]);
    removeMarkedForRemoval(workId, removedEquipment.id);
    storeSetSelectedContract(workId, null);

    showToast?.('회수 장비를 재사용하였습니다.', 'success');
  };

  // 장비 모델 변경 처리
  const handleModelChange = async (selectedEquipmentsFromModal: any[], _selectedPromotionCount?: string) => {
    try {
      const userInfo = localStorage.getItem('userInfo');
      if (!userInfo) {
        showToast?.('사용자 정보가 없습니다.', 'error');
        return;
      }

      const user = JSON.parse(userInfo);

      const equipments = selectedEquipmentsFromModal.map((eq: any, idx: number) => {
        let itemMidCd: string = eq.ITEM_MID_CD || eq.ITM_MID_CD || eq.EQT || eq.EQT_CD || '';
        let modelCode: string = eq.EQT_CL || eq.EQT_CL_CD || '';
        let svcCmpsId: string = eq.SVC_CMPS_ID || eq.PROD_CMPS_ID || eq.SVC_CMPS_SEQ || eq.EQUIP_SEQ || '';

        itemMidCd = String(itemMidCd).trim().padStart(2, '0');
        modelCode = String(modelCode).trim().padStart(6, '0');
        svcCmpsId = String(svcCmpsId || (idx + 1));

        return {
          CTRT_ID: workItem.CTRT_ID || '',
          RCPT_ID: workItem.RCPT_ID || '',
          CRR_ID: workItem.CRR_ID || user.crrId || '',
          WRKR_ID: user.workerId || 'A20130708',
          REG_UID: user.userId || user.workerId || 'A20130708',
          ITEM_MID_CD: itemMidCd,
          EQT_CL: modelCode,
          SVC_CMPS_ID: svcCmpsId,
          EQT: itemMidCd,
          EQT_CD: itemMidCd,
          LENT: String(eq.LENT || '10'),
          EQT_USE_STAT_CD: String(eq.EQT_USE_STAT_CD || '1'),
          ITLLMT_PRD: String(eq.ITLLMT_PRD || '00'),
          EQT_SALE_AMT: Number(eq.EQT_SALE_AMT || 0),
          PROD_GRP: String(eq.PROD_GRP || workItem.PROD_GRP || ''),
          PROD_CD: String(eq.PROD_CD || workItem.PROD_CD || ''),
          SVC_CD: String(eq.SVC_CD || ''),
          PROM_CNT: _selectedPromotionCount || '',
          SEL: '1',
          EQT_BASIC_YN: String(eq.EQT_BASIC_YN || 'N'),
          PROD_TYP: eq.PROD_TYP,
          EQUIP_SEQ: eq.EQUIP_SEQ,
        };
      });

      const result = await updateEquipmentComposition({
        WRK_ID: workItem.id,
        RCPT_ID: workItem.RCPT_ID || '',
        CTRT_ID: workItem.CTRT_ID || '',
        PROM_CNT: _selectedPromotionCount || '',
        equipments
      });

      if ((result as any).MSGCODE === 'SUCCESS' || (result as any).MSGCODE === '0' || (result as any).code === 'SUCCESS') {
        showToast?.('장비 모델이 변경되었습니다.', 'success');
        await loadEquipmentData(true);
      } else {
        throw new Error((result as any).MESSAGE || (result as any).message || '장비 모델 변경에 실패했습니다.');
      }
    } catch (error: any) {
      console.error('[장비모델변경] 실패:', error);
      showToast?.(error.message || '장비 모델 변경 중 오류가 발생했습니다.', 'error');
      throw error;
    }
  };

  // 신호처리
  const handleSignalProcess = async () => {

    if (installedEquipments.length === 0) {
      showToast?.('신호처리를 하려면 먼저 장비를 등록해주세요.', 'warning');
      storeSetSignalStatus(workId, 'fail');
      return;
    }

    try {
      setIsSignalProcessing(true);
      setIsSignalPopupOpen(true);
      storeSetSignalResult(workId, '신호처리 중...');

      const userInfo = localStorage.getItem('userInfo');
      if (!userInfo) {
        storeSetSignalResult(workId, '사용자 정보를 찾을 수 없습니다.');
        storeSetSignalStatus(workId, 'fail');
        setIsSignalProcessing(false);
        return;
      }

      const user = JSON.parse(userInfo);
      const regUid = user.userId || user.id || 'UNKNOWN';

      const result = await checkStbServerConnection(
        regUid,
        workItem.CTRT_ID || '',
        workItem.id,
        'SMR03',
        installedEquipments[0]?.actualEquipment?.id || '',
        ''
      );

      if (result.O_IFSVC_RESULT && result.O_IFSVC_RESULT.startsWith('TRUE')) {
        storeSetSignalResult(workId, `신호처리 완료\n\n결과: ${result.O_IFSVC_RESULT || '성공'}`);
        storeSetSignalStatus(workId, 'success');
      } else {
        storeSetSignalResult(workId, `신호처리 실패\n\n${result.MESSAGE || '알 수 없는 오류'}`);
        storeSetSignalStatus(workId, 'fail');
      }
    } catch (error: any) {
      storeSetSignalResult(workId, `신호처리 실패\n\n${error.message || '알 수 없는 오류'}`);
      storeSetSignalStatus(workId, 'fail');
    } finally {
      setIsSignalProcessing(false);
    }
  };

  // 저장
  const handleSave = () => {
    const userInfo = localStorage.getItem('userInfo');
    const user = userInfo ? JSON.parse(userInfo) : {};

    const equipments = installedEquipments.map(eq => ({
      actualEquipment: {
        ...eq.actualEquipment,
        id: eq.actualEquipment.id,
        type: eq.actualEquipment.type,
        model: eq.actualEquipment.model,
        serialNumber: eq.actualEquipment.serialNumber,
        itemMidCd: eq.actualEquipment.itemMidCd,
        eqtClCd: eq.actualEquipment.eqtClCd,
        macAddress: eq.macAddress || eq.actualEquipment.macAddress,
        BASIC_PROD_CMPS_ID: eq.actualEquipment.BASIC_PROD_CMPS_ID || '',
        EQT_PROD_CMPS_ID: eq.actualEquipment.EQT_PROD_CMPS_ID || eq.contractEquipment.id,
        PROD_CD: eq.actualEquipment.PROD_CD || workItem.PROD_CD,
        SVC_CD: eq.actualEquipment.SVC_CD || '',
        SVC_CMPS_ID: eq.actualEquipment.SVC_CMPS_ID || eq.contractEquipment.id,
        EQT_SALE_AMT: eq.actualEquipment.EQT_SALE_AMT || '0',
        MST_SO_ID: eq.actualEquipment.MST_SO_ID || workItem.SO_ID || user.soId,
        SO_ID: eq.actualEquipment.SO_ID || workItem.SO_ID || user.soId,
        OLD_LENT_YN: eq.actualEquipment.OLD_LENT_YN || 'N',
        LENT: eq.actualEquipment.LENT || '10',
        ITLLMT_PRD: eq.actualEquipment.ITLLMT_PRD || '00',
        EQT_USE_STAT_CD: eq.actualEquipment.EQT_USE_STAT_CD || '1',
        EQT_CHG_GB: eq.actualEquipment.EQT_CHG_GB || '1',
        IF_DTL_ID: eq.actualEquipment.IF_DTL_ID || '',
      },
      contractEquipment: {
        ...eq.contractEquipment,
        id: eq.contractEquipment.id,
        SVC_CMPS_ID: eq.contractEquipment.SVC_CMPS_ID || eq.contractEquipment.id,
        BASIC_PROD_CMPS_ID: eq.contractEquipment.BASIC_PROD_CMPS_ID || '',
        PROD_CD: eq.contractEquipment.PROD_CD || '',
        SVC_CD: eq.contractEquipment.SVC_CD || '',
      },
      macAddress: eq.macAddress || eq.actualEquipment.macAddress,
    } as any));

    const removals = markedForRemoval.map(eq => {
      const eqtNo = eq.id;
      const status = removalStatus[eqtNo] || {};

      return {
        id: eq.id,
        type: eq.type,
        model: eq.model,
        serialNumber: eq.serialNumber,
        itemMidCd: eq.itemMidCd,
        EQT_NO: eq.id,
        EQT_SERNO: eq.serialNumber,
        ITEM_MID_CD: eq.itemMidCd,
        EQT_CL_CD: eq.eqtClCd,
        MAC_ADDRESS: eq.macAddress,
        WRK_ID: workItem.id,
        CUST_ID: workItem.customer?.id || workItem.CUST_ID,
        CTRT_ID: workItem.CTRT_ID,
        WRK_CD: workItem.WRK_CD,
        SVC_CMPS_ID: eq.SVC_CMPS_ID || '',
        BASIC_PROD_CMPS_ID: eq.BASIC_PROD_CMPS_ID || '',
        MST_SO_ID: eq.MST_SO_ID || workItem.SO_ID || user.soId,
        SO_ID: eq.SO_ID || workItem.SO_ID || user.soId,
        REG_UID: user.userId || user.workerId || 'A20230019',
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
      pendingLossStatusList: pendingLossStatusList.length > 0 ? pendingLossStatusList : undefined,
    };

    console.log('[장비관리-이전설치] 저장 데이터:', {
      설치장비: equipments.length,
      회수장비: removals.length,
      분실처리대기: pendingLossStatusList.length,
    });

    onSave(data);
  };

  // 분실 상태 저장 핸들러 (모달에서 호출, API는 작업완료 시 호출)
  const handleSaveLossStatus = (lossStatusList: LossStatusData[]) => {
    console.log('[장비관리-이전설치] 분실 상태 저장 (작업완료 시 API 호출 예정):', lossStatusList.length, '개');
    // 기존 데이터와 병합 (동일 장비는 덮어쓰기)
    const existingSerNos = new Set(lossStatusList.map(l => l.EQT_SERNO));
    const filtered = pendingLossStatusList.filter(p => !existingSerNos.has(p.EQT_SERNO));
    storeSetPendingLossStatusList(workId, [...filtered, ...lossStatusList]);
  };

  // 인라인 분실/파손 체크박스 상태 변경 핸들러 (AS처럼 동작)
  const handleRemovalStatusChange = (eqtNo: string, statusKey: string, currentValue: string) => {
    const newValue = currentValue === '1' ? '0' : '1';
    const currentStatus = removalStatus[eqtNo] || {};
    storeSetRemovalStatus(workId, eqtNo, {
      ...currentStatus,
      [statusKey]: newValue,
    });
  };

  // 기사 재고 필터링 (이관된 장비를 상단에 배치)
  const availableStock = useMemo((): ExtendedEquipment[] => {
    const usedStockIds = new Set(installedEquipments.map(eq => eq.actualEquipment.id));
    let available = technicianEquipments.filter(stock => !usedStockIds.has(stock.id));

    if (selectedContract) {
      available = available.filter(stock =>
        stock.itemMidCd === selectedContract.itemMidCd &&
        stock.model === selectedContract.model
      );
    }

    // 이관된 장비를 상단에 배치 (방금 이관 > 이관 완료 > 일반)
    const hasTransferred = transferredEquipmentSerials.size > 0 || recentlyTransferredSerials.size > 0;
    if (hasTransferred) {
      available.sort((a, b) => {
        const aSerial = a.serialNumber || '';
        const bSerial = b.serialNumber || '';
        const aIsRecent = recentlyTransferredSerials.has(aSerial);
        const bIsRecent = recentlyTransferredSerials.has(bSerial);
        const aIsTransferred = transferredEquipmentSerials.has(aSerial);
        const bIsTransferred = transferredEquipmentSerials.has(bSerial);

        // 방금 이관된 장비 최우선
        if (aIsRecent && !bIsRecent) return -1;
        if (!aIsRecent && bIsRecent) return 1;
        // 이관 완료된 장비 그 다음
        if (aIsTransferred && !bIsTransferred) return -1;
        if (!aIsTransferred && bIsTransferred) return 1;
        return 0;
      });
    }

    return available;
  }, [installedEquipments, technicianEquipments, selectedContract, transferredEquipmentSerials, recentlyTransferredSerials]);

  // 회수 장비 중 재사용 가능한 장비
  const reusableEquipments = useMemo((): ExtendedEquipment[] => {
    const usedStockIds = new Set(installedEquipments.map(eq => eq.actualEquipment.id));
    let reusable = markedForRemoval.filter(eq => !usedStockIds.has(eq.id));

    if (selectedContract) {
      reusable = reusable.filter(eq =>
        eq.itemMidCd === selectedContract.itemMidCd &&
        eq.model === selectedContract.model
      );
    }

    return reusable;
  }, [installedEquipments, markedForRemoval, selectedContract]);

  // 바코드 스캔
  const handleBarcodeScan = () => {
    setIsBarcodeScanning(true);
    setTimeout(() => {
      setIsBarcodeScanning(false);
      showToast?.('바코드 스캔 기능은 준비 중입니다.', 'info');
    }, 500);
  };

  return (
    <div className="px-2 sm:px-4 py-4 sm:py-6 space-y-3 sm:space-y-4 bg-gray-50 pb-4">
      {/* 고객 설치 장비 섹션 */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100">
        <div className="p-3 sm:p-4 border-b border-gray-100">
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-sm sm:text-base font-bold text-gray-900">고객 설치 장비</h4>
            <span className="px-2.5 sm:px-3 py-1 sm:py-1.5 bg-gray-100 text-gray-700 text-xs sm:text-sm font-semibold rounded-full">{contractEquipments.length}개</span>
          </div>
          {/* 버튼 그룹 - 모바일에서 그리드 레이아웃 */}
          <div className="grid grid-cols-4 gap-2">
            <button
              className={`flex flex-col items-center justify-center py-2.5 px-1 rounded-lg border-2 transition-all active:scale-95 min-h-[56px] ${
                isWorkCompleted
                  ? 'border-gray-200 bg-gray-50 text-gray-400 cursor-not-allowed'
                  : 'border-blue-200 bg-blue-50 text-blue-600 hover:bg-blue-100 hover:border-blue-300'
              }`}
              onClick={() => !isWorkCompleted && setIsModelChangeModalOpen(true)}
              disabled={isWorkCompleted}
            >
              <svg className="w-5 h-5 mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
              </svg>
              <span className="text-xs font-semibold">장비변경</span>
            </button>
            <button
              className={`flex flex-col items-center justify-center py-2.5 px-1 rounded-lg border-2 transition-all active:scale-95 min-h-[56px] ${
                isWorkCompleted
                  ? 'border-gray-200 bg-gray-50 text-gray-400 cursor-not-allowed'
                  : lastSignalStatus === 'success'
                    ? 'border-green-300 bg-green-100 text-green-700 hover:bg-green-200 hover:border-green-400'
                    : lastSignalStatus === 'fail'
                      ? 'border-red-500 bg-red-200 text-red-800 hover:bg-red-300 hover:border-red-600'
                      : 'border-red-300 bg-red-100 text-red-700 hover:bg-red-200 hover:border-red-400'
              }`}
              onClick={() => !isWorkCompleted && !isSignalProcessing && handleSignalProcess()}
              disabled={isWorkCompleted || isSignalProcessing}
            >
              <svg className="w-5 h-5 mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
              </svg>
              <span className="text-xs font-semibold">신호처리</span>
            </button>
            {/* 장비철거 버튼 - WRK_CD=07(이전설치)만 표시
                - WRK_CD=06(댁내이전): 인라인 체크박스로 분실처리 (버튼 숨김)
                - WRK_CD=07(이전설치): 장비철거 모달 (장비이관 가능) */}
            {workItem.WRK_CD === '07' && (
              <button
                className={`relative flex flex-col items-center justify-center py-2.5 px-1 rounded-lg border-2 transition-all active:scale-95 min-h-[56px] ${
                  isWorkCompleted
                    ? 'border-gray-200 bg-gray-50 text-gray-400 cursor-not-allowed'
                    : 'border-indigo-200 bg-indigo-50 text-indigo-600 hover:bg-indigo-100 hover:border-indigo-300'
                }`}
                onClick={() => !isWorkCompleted && setIsEquipmentMoveModalOpen(true)}
                disabled={isWorkCompleted}
              >
                {/* 철거장비 개수 뱃지 */}
                {removalEquipmentCount > 0 && (
                  <span className="absolute -top-1.5 -right-1.5 min-w-[20px] h-5 px-1.5 flex items-center justify-center text-xs font-bold text-white bg-red-500 rounded-full shadow-sm">
                    {removalEquipmentCount}
                  </span>
                )}
                <svg className="w-5 h-5 mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                <span className="text-xs font-semibold">장비철거</span>
              </button>
            )}
            <button
              className="flex flex-col items-center justify-center py-2.5 px-1 rounded-lg border-2 transition-all active:scale-95 min-h-[56px] border-purple-200 bg-purple-50 text-purple-600 hover:bg-purple-100 hover:border-purple-300"
              onClick={() => setIsIntegrationHistoryModalOpen(true)}
            >
              <History className="w-5 h-5 mb-1" />
              <span className="text-xs font-semibold">연동이력</span>
            </button>
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
              const installed = installedEquipments.find(eq => eq.contractEquipment.id === equipment.id);
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

      {/* 등록/회수 버튼 */}
      {!isWorkCompleted && (
        <div className="flex items-center justify-center gap-3 sm:gap-4">
          <button
            className={`flex flex-col items-center justify-center w-16 h-16 sm:w-20 sm:h-20 rounded-xl border-2 transition-all ${
              !selectedContract || !selectedStock || installedEquipments.some(eq => eq.actualEquipment.id === selectedStock.id)
                ? 'border-gray-200 bg-gray-50 text-gray-400 cursor-not-allowed'
                : 'border-blue-500 bg-blue-50 text-blue-600 hover:bg-blue-100 cursor-pointer active:scale-95'
            }`}
            onClick={handleRegisterEquipment}
            disabled={!selectedContract || !selectedStock || installedEquipments.some(eq => eq.actualEquipment.id === selectedStock.id)}
          >
            <ArrowUp size={32} className="sm:w-10 sm:h-10" strokeWidth={2.5} />
          </button>
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
          >
            <ArrowDown size={32} className="sm:w-10 sm:h-10" strokeWidth={2.5} />
          </button>
        </div>
      )}

      {/* WRK_CD=06 (댁내이전): 철거장비/기사재고장비 탭 섹션 */}
      {!isWorkCompleted && workItem.WRK_CD === '06' && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100">
          {/* 탭 헤더 */}
          <div className="flex border-b-2 border-gray-200">
            <button
              className={`flex-1 py-3 px-4 text-sm font-semibold transition-all border-b-2 -mb-[2px] ${
                bottomTab === 'removal'
                  ? 'border-orange-500 text-orange-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
              onClick={() => setBottomTab('removal')}
            >
              <div className="flex items-center justify-center gap-2">
                <span>철거장비</span>
                {markedForRemoval.length > 0 && (
                  <span className={`px-2 py-0.5 text-xs font-bold rounded-full ${
                    bottomTab === 'removal' ? 'bg-orange-500 text-white' : 'bg-gray-300 text-gray-600'
                  }`}>
                    {markedForRemoval.length}
                  </span>
                )}
              </div>
            </button>
            <button
              className={`flex-1 py-3 px-4 text-sm font-semibold transition-all border-b-2 -mb-[2px] ${
                bottomTab === 'stock'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
              onClick={() => setBottomTab('stock')}
            >
              <div className="flex items-center justify-center gap-2">
                <span>기사재고장비</span>
                {selectedContract && availableStock.length > 0 && (
                  <span className={`px-2 py-0.5 text-xs font-bold rounded-full ${
                    bottomTab === 'stock' ? 'bg-blue-500 text-white' : 'bg-gray-300 text-gray-600'
                  }`}>
                    {availableStock.length}
                  </span>
                )}
              </div>
            </button>
          </div>

          {/* 탭 콘텐츠 */}
          {bottomTab === 'removal' ? (
            /* 철거장비 탭 */
            <>
              {markedForRemoval.length === 0 ? (
                <div className="py-8 sm:py-12 text-center">
                  <div className="text-xs sm:text-sm text-gray-500">회수된 장비가 없습니다</div>
                  <div className="text-xs text-gray-400 mt-1">상단 고객 설치 장비에서 선택 후 ↓ 버튼을 눌러주세요</div>
                </div>
              ) : (
                <div className="p-3 sm:p-4 space-y-3">
                  {markedForRemoval.map((equipment, idx) => {
                    const eqtNo = equipment.id;
                    const status = removalStatus[eqtNo] || {};
                    const hasLoss = status.EQT_LOSS_YN === '1' || status.PART_LOSS_BRK_YN === '1' ||
                                    status.EQT_BRK_YN === '1' || status.EQT_CABL_LOSS_YN === '1' ||
                                    status.EQT_CRDL_LOSS_YN === '1';
                    const isSelected = selectedStock?.id === equipment.id;

                    return (
                      <div
                        key={eqtNo || idx}
                        className={`p-4 rounded-xl border-2 transition-all cursor-pointer ${
                          isSelected
                            ? 'border-blue-500 bg-blue-50'
                            : 'border-orange-200 bg-orange-50 hover:border-orange-300'
                        }`}
                        onClick={() => handleStockClick(equipment)}
                      >
                        {/* 장비 정보 + 뱃지 */}
                        <div className="flex items-start justify-between mb-3">
                          <div className="flex items-center gap-3">
                            <div className="w-6 h-6 rounded-full bg-orange-500 text-white flex items-center justify-center text-sm font-bold">
                              ✓
                            </div>
                            <div>
                              <div className="text-sm font-semibold text-gray-900">{equipment.type}</div>
                              <div className="text-xs text-gray-600">{equipment.model}</div>
                              <div className="text-xs text-gray-500">S/N: {equipment.serialNumber}</div>
                            </div>
                          </div>
                          <span className={`px-2.5 py-1 text-xs font-bold rounded-full ${
                            hasLoss ? 'bg-red-500 text-white' : 'bg-green-500 text-white'
                          }`}>
                            {hasLoss ? '분실' : '재사용'}
                          </span>
                        </div>

                        {/* 분실/파손 체크박스 */}
                        <div className="grid grid-cols-3 gap-2 mt-2">
                          {[
                            { key: 'EQT_LOSS_YN', label: '장비분실' },
                            { key: 'PART_LOSS_BRK_YN', label: '아답터' },
                            { key: 'EQT_BRK_YN', label: '리모콘' },
                            { key: 'EQT_CABL_LOSS_YN', label: '케이블' },
                            { key: 'EQT_CRDL_LOSS_YN', label: '크래들' },
                          ].map(item => (
                            <label
                              key={item.key}
                              className={`flex items-center gap-1.5 px-2 py-1.5 rounded-lg border cursor-pointer transition-all ${
                                status[item.key] === '1'
                                  ? 'border-red-300 bg-red-50 text-red-700'
                                  : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300'
                              }`}
                              onClick={(e) => {
                                e.stopPropagation();
                                handleRemovalStatusChange(eqtNo, item.key, status[item.key] || '0');
                              }}
                            >
                              <input
                                type="checkbox"
                                checked={status[item.key] === '1'}
                                onChange={() => {}}
                                className="w-3.5 h-3.5 rounded border-gray-300 text-red-500 focus:ring-red-500"
                              />
                              <span className="text-xs font-medium">{item.label}</span>
                            </label>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </>
          ) : (
            /* 기사재고장비 탭 */
            <>
              {!selectedContract ? (
                <div className="py-8 sm:py-12 text-center">
                  <div className="text-xs sm:text-sm text-gray-500">상단에서 고객 설치 장비를 먼저 선택해주세요</div>
                </div>
              ) : availableStock.length === 0 ? (
                <div className="py-8 sm:py-12 text-center">
                  <div className="text-xs sm:text-sm text-gray-500">해당 종류의 사용 가능한 재고가 없습니다</div>
                </div>
              ) : (
                <div className="p-3 sm:p-4 space-y-2.5 max-h-72 overflow-y-auto">
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
            </>
          )}
        </div>
      )}

      {/* WRK_CD=07 (이전설치): 기사재고장비만 표시 (철거는 모달로 처리) */}
      {!isWorkCompleted && workItem.WRK_CD === '07' && (
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
            <div className="p-3 sm:p-4 space-y-2.5 max-h-72 overflow-y-auto">
              {availableStock.map(stock => {
                const serial = stock.serialNumber || '';
                const isRecentlyTransferred = recentlyTransferredSerials.has(serial);
                const isTransferred = transferredEquipmentSerials.has(serial);
                const isHighlighted = isRecentlyTransferred || isTransferred;

                return (
                  <div
                    key={stock.id}
                    className={`p-4 sm:p-5 rounded-xl border-2 transition-all cursor-pointer relative active:scale-[0.98] ${
                      selectedStock?.id === stock.id
                        ? 'border-blue-500 bg-blue-50'
                        : isRecentlyTransferred
                          ? 'border-purple-500 bg-purple-50 ring-2 ring-purple-300 ring-opacity-50 animate-pulse'
                          : isTransferred
                            ? 'border-purple-400 bg-purple-50'
                            : 'border-gray-200 bg-white hover:border-gray-300'
                    }`}
                    onClick={() => handleStockClick(stock)}
                  >
                    {/* 이관 배지 */}
                    {isHighlighted && (
                      <div className={`absolute -top-2 left-3 px-2 py-0.5 text-white text-[10px] sm:text-xs font-bold rounded-full shadow-sm ${
                        isRecentlyTransferred ? 'bg-purple-600' : 'bg-purple-500'
                      }`}>
                        {isRecentlyTransferred ? '방금 이관됨' : '이관장비'}
                      </div>
                    )}
                    <div className="space-y-2 sm:space-y-2.5">
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
                );
              })}
            </div>
          )}
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
            ctrtStatNm={displayCtrtStatNm}
            prodGrp={workItem.PROD_GRP || ''}
            prodNm={displayProdNm}
            wrkCdNm={displayWrkCdNm}
            onSave={handleModelChange}
            showToast={showToast}
          />
        );
      })()}

      {/* 바코드 스캔 플로팅 버튼 */}
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

      {/* 장비이관 모달 - WRK_CD=07 (이전설치) 전용
          - WRK_CD=06 (댁내이전): 인라인 체크박스로 분실처리 (모달 사용 안함)
          - WRK_CD=07 (이전설치): 장비이관 + 분실처리 모달
          - deferLossProcessing=true: 분실처리 API는 작업완료 시 호출 */}
      {workItem.WRK_CD === '07' && (
        <EquipmentMoveModal
          isOpen={isEquipmentMoveModalOpen}
          onClose={() => setIsEquipmentMoveModalOpen(false)}
          removedEquipmentsData={
            // removeEquipments(output5)가 있으면 사용, 없으면 customerEquipments(output4) 사용
            (removeEquipments.length > 0 ? removeEquipments : customerEquipments).map(eq => ({
              EQT_NO: eq.id || (eq as any).EQT_NO || '',
              EQT_SERNO: eq.serialNumber || (eq as any).EQT_SERNO || '',
              EQT_CL_CD: eq.eqtClCd || (eq as any).EQT_CL_CD || (eq as any).EQT_CL || '',
              EQT_CL_NM: eq.model || (eq as any).EQT_CL_NM || '',
              ITEM_MID_CD: eq.itemMidCd || (eq as any).ITEM_MID_CD || '',
              ITEM_MID_NM: eq.type || (eq as any).ITEM_MID_NM || '',
              MAC_ADDRESS: eq.macAddress || (eq as any).MAC_ADDRESS || '',
              SVC_CMPS_ID: eq.SVC_CMPS_ID || '',
              BASIC_PROD_CMPS_ID: eq.BASIC_PROD_CMPS_ID || '',
              LENT_YN: (eq as any).LENT_YN || '',
              VOIP_CUSTOWN_EQT: (eq as any).VOIP_CUSTOWN_EQT || '',
            }))
          }
          custId={workItem.CUST_ID || workItem.customer?.id || ''}
          rcptId={workItem.RCPT_ID || ''}
          wrkId={workItem.id}
          ctrtId={workItem.CTRT_ID || ''}
          hideTransfer={false}
          mstSoId={(workItem as any).MST_SO_ID || ''}
          soId={workItem.SO_ID || ''}
          crrId={workItem.CRR_ID || ''}
          wrkrId={(workItem as any).WRKR_ID || ''}
          chgUid={(workItem as any).REG_UID || (workItem as any).WRKR_ID || ''}
          showToast={showToast}
          deferLossProcessing={true}
          onSaveLossStatus={handleSaveLossStatus}
          onSuccess={(transferredSerials: string[]) => {
            // 이관/분실처리 성공 시 장비 데이터 갱신 및 하이라이트 표시
            console.log('[EquipmentMoveRemoval] 장비처리 성공 - 데이터 갱신, 처리된 장비:', transferredSerials);
            setRecentlyTransferredSerials(new Set(transferredSerials));
            loadEquipmentData(true);
            // 10초 후 하이라이트 제거
            setTimeout(() => {
              setRecentlyTransferredSerials(new Set());
            }, 10000);
          }}
        />
      )}

      {/* 신호처리 팝업 */}
      {isSignalPopupOpen && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
          onClick={() => !isSignalProcessing && setIsSignalPopupOpen(false)}
        >
          <div
            className="bg-white rounded-xl shadow-lg max-w-md w-full overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-6 py-4 border-b border-gray-100">
              <h3 className="text-lg font-bold text-gray-900">신호처리</h3>
            </div>

            <div className="px-6 py-8">
              {isSignalProcessing ? (
                <div className="flex flex-col items-center space-y-4">
                  <div className="text-blue-500">
                    <Loader2 className="animate-spin" size={64} />
                  </div>
                  <p className="text-base font-semibold text-gray-900">신호처리 중...</p>
                  <p className="text-sm text-gray-500">잠시만 기다려주세요</p>
                </div>
              ) : lastSignalStatus === 'success' ? (
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

export default EquipmentMoveRemoval;
